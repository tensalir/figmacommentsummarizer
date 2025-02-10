"use strict";
/// <reference types="@figma/plugin-typings" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const FIGMA_CLIENT_ID = 'TIGvBleCCeIkJMV8jRzAIl';
// We'll need a secure redirect URI - for now we can use a localhost URL for testing
const FIGMA_REDIRECT_URI = 'http://localhost:3000/oauth/callback';
// Initialize UI with a reasonable size
figma.showUI(__html__, { width: 400, height: 500 });
console.log('Plugin initialized');
function initializePlugin() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Initializing plugin...');
        // Load configuration
        const config = yield figma.clientStorage.getAsync('config');
        console.log('Loaded config:', config);
        if (!(config === null || config === void 0 ? void 0 : config.ANTHROPIC_API_KEY)) {
            console.log('No API key found');
            figma.ui.postMessage({
                type: 'CONFIG_REQUIRED',
                message: 'Please set your Anthropic API key in the plugin settings'
            });
            return false;
        }
        return true;
    });
}
function processComments() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Processing comments...');
        try {
            const fileKey = figma.fileKey;
            if (!fileKey) {
                throw new Error('Could not get current file key');
            }
            // First ensure we have an access token
            const accessToken = yield getFigmaAccessToken();
            if (!accessToken) {
                console.log('No access token available, initiating OAuth flow');
                // The OAuth flow will be handled by the UI
                return [];
            }
            const commentsData = yield getComments(fileKey);
            console.log('Fetched comments:', commentsData);
            if (!commentsData.comments || commentsData.comments.length === 0) {
                throw new Error('No comments found in the current file');
            }
            const processedComments = commentsData.comments.map((comment) => ({
                text: comment.message,
                author: comment.user.handle,
                createdAt: new Date(comment.created_at).getTime(),
                resolved: comment.resolved || false
            }));
            console.log('Processed comments:', processedComments.length);
            return processedComments;
        }
        catch (error) {
            console.error('Error processing comments:', error);
            throw error;
        }
    });
}
function generateSummary(comments) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log('Generating summary for comments:', comments.length);
        const config = yield figma.clientStorage.getAsync('config');
        if (!(config === null || config === void 0 ? void 0 : config.ANTHROPIC_API_KEY)) {
            throw new Error('Anthropic API key not configured');
        }
        const response = yield fetch('https://api.anthropic.com/v1/messages', {
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
            const error = yield response.json();
            throw new Error(((_a = error.error) === null || _a === void 0 ? void 0 : _a.message) || 'Failed to generate summary');
        }
        const data = yield response.json();
        console.log('Generated summary successfully');
        return data.content[0].text;
    });
}
function getFigmaAccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Getting Figma access token...');
        // Check if we have a stored token
        const token = yield figma.clientStorage.getAsync('figma_access_token');
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
    });
}
function getComments(fileKey) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Fetching comments for file:', fileKey);
            const accessToken = yield getFigmaAccessToken();
            console.log('Using access token:', accessToken ? 'yes' : 'no');
            const response = yield fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorBody = yield response.text();
                console.error('Failed to fetch comments:', errorBody);
                throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
            }
            const data = yield response.json();
            console.log('Comments data:', data);
            return data;
        }
        catch (error) {
            console.error('Error in getComments:', error);
            throw error;
        }
    });
}
// Initialize the plugin
initializePlugin().catch(error => {
    console.error('Failed to initialize plugin:', error);
    figma.notify('Failed to initialize plugin');
});
// Handle messages from UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Received message:', msg.type);
    switch (msg.type) {
        case 'SAVE_CONFIG':
            try {
                yield figma.clientStorage.setAsync('config', msg.config);
                console.log('Config saved successfully, sending CONFIG_SAVED message to UI');
                figma.ui.postMessage({ type: 'CONFIG_SAVED' });
                console.log('CONFIG_SAVED message sent to UI');
                figma.notify('API key saved successfully');
            }
            catch (error) {
                console.error('Failed to save config:', error);
                figma.notify('Failed to save API key', { error: true });
            }
            break;
        case 'SUMMARIZE':
            const initialized = yield initializePlugin();
            if (!initialized) {
                return;
            }
            try {
                // First check for OAuth token
                const token = yield figma.clientStorage.getAsync('figma_access_token');
                if (!token) {
                    console.log('No OAuth token found, initiating OAuth flow');
                    yield getFigmaAccessToken();
                    return;
                }
                const comments = yield processComments();
                if (comments.length === 0) {
                    // This could mean either no comments or OAuth needed
                    const token = yield figma.clientStorage.getAsync('figma_access_token');
                    if (!token) {
                        figma.notify('Please authorize access to comments first', { timeout: 5000 });
                    }
                    else {
                        figma.notify('No comments found in the current file', { timeout: 5000 });
                    }
                    return;
                }
                const summary = yield generateSummary(comments);
                figma.ui.postMessage({
                    type: 'SUMMARY_GENERATED',
                    summary
                });
            }
            catch (error) {
                console.error('Failed to generate summary:', error);
                figma.notify('Failed to access comments. Please try again.', { timeout: 5000 });
            }
            break;
        case 'SAVE_OAUTH_TOKEN':
            try {
                yield figma.clientStorage.setAsync('figma_access_token', msg.token);
                console.log('OAuth token saved');
                figma.notify('Successfully connected to Figma');
            }
            catch (error) {
                console.error('Failed to save OAuth token:', error);
                figma.notify('Failed to save OAuth token', { error: true });
            }
            break;
        case 'GET_CONFIG':
            try {
                const config = yield figma.clientStorage.getAsync('config');
                figma.ui.postMessage({
                    type: 'CONFIG_LOADED',
                    config: config
                });
            }
            catch (error) {
                console.error('Failed to load config:', error);
            }
            break;
    }
});
