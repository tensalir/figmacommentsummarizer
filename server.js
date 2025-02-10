import express from 'express';
import axios from 'axios';

const app = express();
const port = 3000;

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/oauth/callback', async (req, res) => {
  console.log('Received OAuth callback with code:', req.query.code);
  const code = req.query.code;
  
  if (!code) {
    console.error('No code received in callback');
    res.status(400).send('No authorization code received');
    return;
  }
  
  try {
    console.log('Exchanging code for token...');
    const response = await axios.post('https://www.figma.com/api/oauth/token', {
      client_id: 'TIGvBleCCeIkJMV8jRzAIl',
      client_secret: 'w1gI0cKVbiD1vBTyWxDN9r2RvNREeI',
      redirect_uri: 'http://localhost:3000/oauth/callback',
      code: code,
      grant_type: 'authorization_code'
    });

    console.log('Received response from Figma:', response.data);

    if (!response.data.access_token) {
      throw new Error('No access token received from Figma');
    }

    console.log('Sending success page with token');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Complete</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
          </style>
        </head>
        <body>
          <h3>Authorization Successful!</h3>
          <p>You can close this window and return to the plugin.</p>
          <script>
            console.log('Attempting to send token to plugin...');
            if (window.opener) {
              try {
                window.opener.postMessage(
                  { 
                    type: 'FIGMA_OAUTH_TOKEN', 
                    token: '${response.data.access_token}'
                  }, 
                  '*'  // We use * since the plugin UI could be on any Figma domain
                );
                console.log('Token sent to opener window');
              } catch (e) {
                console.error('Error sending token:', e);
              }
            } else {
              console.error('No opener window found');
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; color: #ff4444; }
          </style>
        </head>
        <body>
          <h3>Authorization Failed</h3>
          <p>Please close this window and try again.</p>
          <p>Error: ${error.message}</p>
          <script>
            console.error('Authorization failed:', ${JSON.stringify(error.message)});
          </script>
        </body>
      </html>
    `);
  }
});

app.listen(port, () => {
  console.log(`OAuth server running at http://localhost:${port}`);
}); 