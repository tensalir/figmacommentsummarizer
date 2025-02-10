"use strict";
/// <reference types="@figma/plugin-typings" />
// Initialize UI with a reasonable size
figma.showUI(__html__, { width: 400, height: 500 });
console.log('Plugin initialized');
async function initializePlugin() {
    console.log('Initializing plugin...');
    // Load configuration
    const config = await figma.clientStorage.getAsync('config');
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
}
async function processComments() {
    console.log('Processing comments...');
    // Get comments from the current page
    const allNodes = figma.currentPage.findAll();
    console.log('Found nodes:', allNodes.length);
    const commentThreads = allNodes.filter(node => 'comments' in node && node.comments.length > 0);
    console.log('Found comment threads:', commentThreads.length);
    if (commentThreads.length === 0) {
        throw new Error('No comments found in the current page');
    }
    const processedComments = [];
    for (const node of commentThreads) {
        const comments = node.comments;
        console.log('Processing comments for node:', comments.length);
        for (const comment of comments) {
            processedComments.push({
                text: comment.message,
                author: comment.user.name || 'Unknown',
                createdAt: Date.now(),
                resolved: false
            });
        }
    }
    if (processedComments.length === 0) {
        throw new Error('No comments found in the current page');
    }
    console.log('Processed comments:', processedComments.length);
    return processedComments;
}
async function generateSummary(comments) {
    var _a;
    console.log('Generating summary for comments:', comments.length);
    const config = await figma.clientStorage.getAsync('config');
    if (!(config === null || config === void 0 ? void 0 : config.ANTHROPIC_API_KEY)) {
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
        throw new Error(((_a = error.error) === null || _a === void 0 ? void 0 : _a.message) || 'Failed to generate summary');
    }
    const data = await response.json();
    console.log('Generated summary successfully');
    return data.content[0].text;
}
// Initialize the plugin
initializePlugin().catch(error => {
    console.error('Failed to initialize plugin:', error);
    figma.notify('Failed to initialize plugin');
});
// Handle messages from UI
figma.ui.onmessage = async (msg) => {
    console.log('Received message from UI:', msg);
    if (msg.type === 'SUMMARIZE_COMMENTS') {
        try {
            // Check if plugin is properly configured
            const isInitialized = await initializePlugin();
            if (!isInitialized) {
                return;
            }
            const comments = await processComments();
            if (comments.length === 0) {
                figma.ui.postMessage({
                    type: 'SUMMARY_ERROR',
                    message: 'No comments found in the current page'
                });
                return;
            }
            const summary = await generateSummary(comments);
            figma.ui.postMessage({
                type: 'SUMMARY_RESULT',
                summary: `AI Summary:\n${summary}\n\nTotal comments analyzed: ${comments.length}`
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error:', errorMessage);
            figma.ui.postMessage({
                type: 'SUMMARY_ERROR',
                message: errorMessage
            });
        }
    }
    else if (msg.type === 'SET_API_KEY') {
        console.log('Setting API key...');
        try {
            await figma.clientStorage.setAsync('config', {
                ANTHROPIC_API_KEY: msg.apiKey
            });
            console.log('API key saved successfully');
            figma.ui.postMessage({
                type: 'CONFIG_SAVED'
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to save API key:', errorMessage);
            figma.ui.postMessage({
                type: 'SUMMARY_ERROR',
                message: `Failed to save API key: ${errorMessage}`
            });
        }
    }
};
