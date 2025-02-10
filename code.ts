/// <reference types="@figma/plugin-typings" />

// Figma Plugin API typings
interface PluginConfig {
  ANTHROPIC_API_KEY: string;
}

interface Comment {
  message: string;
  user: {
    handle: string;
  };
  created_at: string;
  resolved: boolean;
}

interface ProcessedComment {
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
  sentiment?: 'positive'|'neutral'|'negative';
}

interface FigmaComment {
  message: string;
  user: {
    handle: string;
  };
  created_at: string;
  resolved: boolean;
}

const FIGMA_CLIENT_ID = 'TIGvBleCCeIkJMV8jRzAIl';
// We'll need a secure redirect URI - for now we can use a localhost URL for testing
const FIGMA_REDIRECT_URI = 'http://localhost:3000/oauth/callback';

// Initialize UI with a reasonable size
figma.showUI(__html__, { width: 400, height: 500 });
console.log('Plugin initialized');

async function initializePlugin() {
  console.log('Initializing plugin...');
  // Load configuration
  const config = await figma.clientStorage.getAsync('config') as PluginConfig;
  console.log('Loaded config:', config);
  
  if (!config?.ANTHROPIC_API_KEY) {
    console.log('No API key found');
    figma.ui.postMessage({
      type: 'CONFIG_REQUIRED',
      message: 'Please set your Anthropic API key in the plugin settings'
    });
    return false;
  }
  return true;
}

async function processComments(): Promise<ProcessedComment[]> {
  console.log('Processing comments...');
  
  try {
    const fileKey = figma.fileKey;
    if (!fileKey) {
      throw new Error('Could not get current file key');
    }

    // First ensure we have an access token
    const accessToken = await getFigmaAccessToken();
    if (!accessToken) {
      console.log('No access token available, initiating OAuth flow');
      // The OAuth flow will be handled by the UI
      return [];
    }

    const commentsData = await getComments(fileKey);
    console.log('Fetched comments:', commentsData);

    if (!commentsData.comments || commentsData.comments.length === 0) {
      throw new Error('No comments found in the current file');
    }

    const processedComments: ProcessedComment[] = commentsData.comments.map((comment: FigmaComment) => ({
      text: comment.message,
      author: comment.user.handle,
      createdAt: new Date(comment.created_at).getTime(),
      resolved: comment.resolved || false
    }));

    console.log('Processed comments:', processedComments.length);
    return processedComments;
  } catch (error) {
    console.error('Error processing comments:', error);
    throw error;
  }
}

async function generateSummary(comments: ProcessedComment[]): Promise<string> {
  console.log('Generating summary for comments:', comments.length);
  const config = await figma.clientStorage.getAsync('config') as PluginConfig;
  if (!config?.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Summarize these Figma comments and identify key discussion points and decisions made. Also note the overall sentiment of the discussion:

        ${comments.map(c => `${c.author}: ${c.text} ${c.resolved ? '(RESOLVED)' : ''}`).join('\n')}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate summary');
  }

  const data = await response.json();
  console.log('Generated summary successfully');
  return data.content[0].text;
}

async function getFigmaAccessToken() {
  console.log('Getting Figma access token...');
  // Check if we have a stored token
  const token = await figma.clientStorage.getAsync('figma_access_token');
  if (token) {
    console.log('Found existing access token');
    return token;
  }

  console.log('No access token found, showing OAuth UI');
  figma.ui.postMessage({
    type: 'OAUTH_REQUIRED',
    authUrl: `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&redirect_uri=${FIGMA_REDIRECT_URI}&scope=file_read&state=random-state&response_type=code`
  });
  return null;
}

async function getComments(fileKey: string) {
  try {
    console.log('Fetching comments for file:', fileKey);
    const accessToken = await getFigmaAccessToken();
    console.log('Using access token:', accessToken ? 'yes' : 'no');
    
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Failed to fetch comments:', errorBody);
      throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Comments data:', data);
    return data;
  } catch (error) {
    console.error('Error in getComments:', error);
    throw error;
  }
}

// Initialize the plugin
initializePlugin().catch(error => {
  console.error('Failed to initialize plugin:', error);
  figma.notify('Failed to initialize plugin');
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg.type);
  
  switch (msg.type) {
    case 'SAVE_CONFIG':
      try {
        await figma.clientStorage.setAsync('config', msg.config);
        console.log('Config saved successfully, sending CONFIG_SAVED message to UI');
        figma.ui.postMessage({ type: 'CONFIG_SAVED' });
        console.log('CONFIG_SAVED message sent to UI');
        figma.notify('API key saved successfully');
      } catch (error) {
        console.error('Failed to save config:', error);
        figma.notify('Failed to save API key', { error: true });
      }
      break;
      
    case 'SUMMARIZE':
      const initialized = await initializePlugin();
      if (!initialized) {
        return;
      }
      
      try {
        // First check for OAuth token
        const token = await figma.clientStorage.getAsync('figma_access_token');
        if (!token) {
          console.log('No OAuth token found, initiating OAuth flow');
          await getFigmaAccessToken();
          return;
        }

        const comments = await processComments();
        if (comments.length === 0) {
          // This could mean either no comments or OAuth needed
          const token = await figma.clientStorage.getAsync('figma_access_token');
          if (!token) {
            figma.notify('Please authorize access to comments first', { timeout: 5000 });
          } else {
            figma.notify('No comments found in the current file', { timeout: 5000 });
          }
          return;
        }
        
        const summary = await generateSummary(comments);
        figma.ui.postMessage({ 
          type: 'SUMMARY_GENERATED',
          summary 
        });
      } catch (error) {
        console.error('Failed to generate summary:', error);
        figma.notify('Failed to access comments. Please try again.', { timeout: 5000 });
      }
      break;

    case 'SAVE_OAUTH_TOKEN':
      try {
        await figma.clientStorage.setAsync('figma_access_token', msg.token);
        console.log('OAuth token saved');
        figma.notify('Successfully connected to Figma');
      } catch (error) {
        console.error('Failed to save OAuth token:', error);
        figma.notify('Failed to save OAuth token', { error: true });
      }
      break;

    case 'GET_CONFIG':
      try {
        const config = await figma.clientStorage.getAsync('config') as PluginConfig;
        figma.ui.postMessage({ 
          type: 'CONFIG_LOADED',
          config: config 
        });
      } catch (error) {
        console.error('Failed to load config:', error);
      }
      break;
  }
};
