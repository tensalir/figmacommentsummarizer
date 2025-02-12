const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();

const PORT = 3000;
const FIGMA_CLIENT_ID = 'TIGvBleCCeIkJMV8jRzAIl';
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

// Verify required environment variables
if (!ANTHROPIC_API_KEY || !FIGMA_CLIENT_SECRET) {
    console.error('Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

// Update CORS configuration to be more explicit
const corsOptions = {
    origin: [
        'https://www.figma.com',
        'http://localhost:3000',
        'https://www.figma.com/oauth'  // Add this for OAuth redirects
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Add error handling middleware for CORS preflight
app.options('*', cors(corsOptions));

// Add CORS error handling
app.use((err, req, res, next) => {
    if (err.name === 'CORSError') {
        console.error('CORS Error:', err.message);
        res.status(403).json({
            error: 'CORS error',
            message: err.message,
            origin: req.headers.origin
        });
    } else {
        next(err);
    }
});

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Origin:', req.headers.origin);
    console.log('Headers:', req.headers);
    next();
});

// Add logging middleware to debug OAuth callback
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body
    });
    next();
});

app.post('/summarize', async (req, res) => {
    try {
        const { comments } = req.body;
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 300,
                messages: [{
                    role: "user",
                    content: `Summarize these Figma comments, focusing on key feedback and recurring themes:\n\n${comments.map(c => c.message).join('\n')}`
                }]
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate summary');
        }

        const data = await response.json();
        res.json({ summary: data.content[0].text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/oauth/callback', async (req, res) => {
    console.log('OAuth callback received:', {
        code: req.query.code ? 'present' : 'missing',
        state: req.query.state || 'no_state',
        code_verifier: req.query.code_verifier ? 'present' : 'missing'
    });
    
    const { code, state } = req.query;
    const code_verifier = req.query.code_verifier;
    
    if (!code) {
        console.error('No authorization code received');
        return res.status(400).send(`
            <script>
                window.opener.postMessage({ 
                    type: 'oauth-error',
                    error: 'No authorization code received'
                }, '*');
                window.close();
            </script>
        `);
    }

    try {
        // Exchange code for token with detailed error logging
        const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: FIGMA_CLIENT_ID,
                client_secret: FIGMA_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code,
                code_verifier,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorData
            });
            throw new Error(`Failed to exchange code for token: ${errorData}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('Token exchange successful');
        
        // Send token back to plugin with improved error handling
        res.send(`
            <script>
                try {
                    window.opener.postMessage({ 
                        type: 'oauth-callback',
                        code: '${code}',
                        state: '${state}',
                        access_token: '${tokenData.access_token}'
                    }, '*');
                } catch (error) {
                    console.error('Error posting message:', error);
                } finally {
                    window.close();
                }
            </script>
        `);
    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).send(`
            <script>
                window.opener.postMessage({ 
                    type: 'oauth-error',
                    error: '${error.message.replace(/'/g, "\\'")}'
                }, '*');
                window.close();
            </script>
        `);
    }
});

// Add these test routes before app.listen()

// Basic server test
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ 
        status: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Test route with query parameters
app.get('/test-params', (req, res) => {
    console.log('Test params endpoint hit:', req.query);
    res.json({
        received_params: req.query,
        status: 'ok'
    });
});

// Test OAuth flow with mock data
app.get('/test-oauth-flow', (req, res) => {
    const mockOAuthResponse = {
        code: 'test_auth_code',
        state: 'test_state',
        code_verifier: 'test_verifier'
    };
    
    console.log('Test OAuth flow endpoint hit');
    res.json(mockOAuthResponse);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Add this test endpoint
app.get('/test-token-exchange', async (req, res) => {
    const { code, code_verifier } = req.query;
    
    try {
        const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: FIGMA_CLIENT_ID,
                client_secret: FIGMA_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code,
                code_verifier,
                grant_type: 'authorization_code'
            })
        });
        
        const responseData = await tokenResponse.text();
        res.json({
            status: tokenResponse.ok ? 'success' : 'error',
            statusCode: tokenResponse.status,
            response: responseData
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`OAuth callback server running at http://localhost:${PORT}`);
}); 