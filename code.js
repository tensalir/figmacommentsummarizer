// Add these utility functions at the top
function base64encode(buffer) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(buffer);
  let result = '';
  
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += chars[(chunk >> 18) & 63];
    result += chars[(chunk >> 12) & 63];
    result += chars[(chunk >> 6) & 63];
    result += chars[chunk & 63];
  }

  const remainder = bytes.length % 3;
  if (remainder === 1) {
    const chunk = bytes[bytes.length - 1];
    result += chars[chunk >> 2];
    result += chars[(chunk & 3) << 4];
    result += '==';
  } else if (remainder === 2) {
    const chunk = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    result += chars[chunk >> 10];
    result += chars[(chunk >> 4) & 63];
    result += chars[(chunk & 15) << 2];
    result += '=';
  }

  return result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier() {
  // Use a simple string-based verifier that meets PKCE requirements
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < 43; i++) {
    verifier += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return verifier;
}

// Add these debug functions at the top
function debugLog(message, data = null) {
  console.log(`[DEBUG] ${message}`, data || '');
}

function debugError(message, error) {
  console.error(`[ERROR] ${message}:`, error);
  console.error('Stack:', error.stack);
}

// Call it before any other operations
figma.showUI(__html__);
figma.ui.resize(450, 550);

const FIGMA_CLIENT_ID = 'TIGvBleCCeIkJMV8jRzAIl';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'analyze-comments') {
    try {
      debugLog('Starting analysis');
      // Get current file key or use document ID as fallback
      const fileKey = figma.fileKey || figma.currentPage.parent.id;
      debugLog('File key:', fileKey);
      
      if (!fileKey) {
        throw new Error('Could not determine file key. Please save the file first.');
      }
      
      let token = await figma.clientStorage.getAsync('oauth_token');
      debugLog('Existing token:', token ? 'found' : 'not found');
      
      if (!token) {
        debugLog('Generating code verifier');
        try {
          const codeVerifier = generateCodeVerifier();
          debugLog('Code verifier generated:', codeVerifier);
          
          // Store code verifier and file key
          await figma.clientStorage.setAsync('code_verifier', codeVerifier);
          await figma.clientStorage.setAsync('current_file_key', fileKey);
          
          // Construct OAuth URL with state
          const oauthUrl = `https://www.figma.com/oauth?` +
            `client_id=${FIGMA_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `scope=files:read&` +
            `state=${encodeURIComponent(fileKey)}&` +
            `response_type=code&` +
            `code_challenge=${encodeURIComponent(await generateCodeChallenge(codeVerifier))}&` +
            `code_challenge_method=S256`;

          // Open OAuth window with all necessary parameters
          figma.ui.postMessage({ 
            type: 'oauth-start',
            url: oauthUrl,
            codeVerifier: codeVerifier,
            state: fileKey
          });
          
          // Wait for OAuth completion
          token = await new Promise((resolve, reject) => {
            const handler = async (event) => {
              if (event.data.pluginMessage.type === 'oauth-callback') {
                const { access_token } = event.data.pluginMessage;
                if (access_token) {
                  await figma.clientStorage.setAsync('oauth_token', access_token);
                  resolve(access_token);
                } else {
                  reject(new Error('No access token received'));
                }
              }
            };
            
            figma.ui.on('message', handler);
          });
        } catch (innerError) {
          debugError('OAuth setup failed', innerError);
          throw innerError;
        }
      }

      // Fetch comments using Figma API
      const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid, clear it and retry
          await figma.clientStorage.deleteAsync('oauth_token');
          throw new Error('Authentication expired. Please try again.');
        }
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      
      // Send comments to our backend for summarization
      const summaryResponse = await fetch('http://localhost:3000/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments: data.comments })
      });

      if (!summaryResponse.ok) {
        throw new Error('Failed to generate summary');
      }

      const summaryData = await summaryResponse.json();
      
      figma.ui.postMessage({ 
        type: 'summary',
        summary: summaryData.summary 
      });

    } catch (error) {
      debugError('Top level error', error);
      figma.ui.postMessage({ 
        type: 'error',
        error: error.message || 'Unknown error occurred'
      });
    }
  }
};

// Add a simple string to bytes converter
function stringToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// Update the sha256 function
function sha256(str) {
  const bytes = stringToBytes(str);
  // Use a simpler hash for the plugin environment
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash) + bytes[i];
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to byte array
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    result[i] = (hash >> (i * 8)) & 0xff;
  }
  return result;
}

// Update generateCodeChallenge function
async function generateCodeChallenge(verifier) {
  try {
    debugLog('Generating code challenge for verifier:', verifier);
    const hash = sha256(verifier);
    const challenge = base64encode(hash);
    debugLog('Generated code challenge:', challenge);
    return challenge;
  } catch (error) {
    debugError('Error generating code challenge:', error);
    throw new Error('Failed to generate code challenge');
  }
} 