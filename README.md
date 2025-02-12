# Figma Comment Analyzer Plugin

A Figma plugin that automatically fetches, analyzes, and summarizes comments in a Figma design file or FigJam board using Anthropic's Claude API.

## Current Implementation Status

### Implemented Features
- OAuth 2.0 authentication with PKCE for secure Figma API access
- Comment fetching from active Figma file using REST API
- Basic comment summarization using Claude 3.5 Sonnet
- Simple UI with summarization button and loading state
- Error handling for authentication and API failures

### Pending Features (from PRD)
- Comment categorization by type (design critique, bug report, etc.)
- Sentiment analysis of comments
- Tagging of actionable items
- Copy summary button
- Advanced error handling for rate limits
- Comment filtering options (e.g., resolved vs. unresolved)

## Current Function Flow

1. **Authentication Flow**
   - Plugin checks for existing OAuth token
   - If no token exists, initiates PKCE OAuth flow
   - Securely stores token in Figma client storage

2. **Comment Analysis Flow**
   - User clicks "Summarize Comments" button
   - Plugin fetches comments using Figma REST API
   - Comments are sent to backend server
   - Backend processes comments using Claude API
   - Summary is displayed in plugin UI

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- A Figma account
- An Anthropic API key

## Setup Instructions

1. **Clone the repository and install dependencies**
   ```bash
   git clone [your-repo-url]
   cd figma-comment-analyzer
   npm install
   ```

2. **Configure environment variables**
   Create a `.env` file in the root directory with:
   ```
   FIGMA_CLIENT_SECRET=your_figma_client_secret
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

3. **Start the local server**
   ```bash
   npm start
   ```
   The server will run on http://localhost:3000

4. **Load the plugin in Figma**
   - Open Figma Desktop app
   - Go to Menu > Plugins > Development > Import plugin from manifest...
   - Select the `manifest.json` file from this project
   - The plugin will appear in your development plugins list

## Usage

1. Open a Figma file with comments
2. Run the plugin from Plugins > Development > Figma Comment Analyzer
3. Click "Summarize Comments" in the plugin UI
4. If prompted, authorize the plugin to access your Figma account
5. Wait for the summary to appear

## Development

### Current Architecture
- Frontend: HTML/CSS/JS (`ui.html`) for plugin interface
- Plugin Logic: (`code.js`) handles Figma API integration and OAuth flow
- Backend: Node.js (`server.js`) manages Anthropic API calls and token exchange

### Key Files
- `manifest.json`: Plugin configuration and permissions
- `code.js`: Core plugin logic and Figma API integration
- `server.js`: Backend server for API handling
- `ui.html`: Plugin user interface

## Troubleshooting

- If you see CORS errors, ensure the server is running on port 3000
- If authentication fails, check your Figma client secret
- If summarization fails, verify your Anthropic API key
- For OAuth issues, ensure your Figma client ID and redirect URI are correct

## Security Notes

- OAuth 2.0 with PKCE is implemented for secure authentication
- API keys are stored server-side only
- Figma client storage is used for token management

## License

[Your chosen license]

## Known Issues

### OAuth Callback Not Working
Currently experiencing an issue with the OAuth flow:

1. **Symptoms:**
   - Browser window opens correctly for Figma authorization
   - "Allow Access" button click doesn't complete the OAuth flow
   - No error message appears in the plugin UI
   - Console shows successful code verifier/challenge generation

2. **Debug Information:**
   - Console logs show code verifier and challenge are generated
   - OAuth window opens with correct parameters
   - Callback handling appears to fail silently

3. **Possible Causes:**
   - Mismatch between redirect URI in code and Figma app settings
   - Message passing between OAuth window and plugin may be failing
   - CORS settings may need adjustment

4. **Temporary Workaround:**
   None available yet. Investigation ongoing.

5. **Next Debug Steps:**
   - Verify redirect URI matches exactly in all locations
   - Add additional logging in OAuth callback handler
   - Check browser console in OAuth window for errors
   - Verify CORS settings in server.js 