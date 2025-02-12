# Figma Comment Analyzer – Product Requirements Document

_A plugin to automatically fetch, analyze, and summarize comments in a Figma design file or FigJam board, using Anthropic’s Claude API._

---

## 1. Introduction

**Purpose:**  
Help designers, art directors, and project managers quickly understand feedback by summarizing all comments in the active Figma file. This saves time, highlights recurring themes, and guides design iterations.

**Background:**  
Figma’s plugin API does not directly expose comments; instead, we use Figma’s REST API. The summarization leverages Anthropic’s Claude model to distill feedback into a clear, actionable summary. Our internal tool uses centralized authentication so users never need to input their own API keys.

**Target Users:**  
- Designers (UI/UX)  
- Art Directors/Design Leads  
- Project/ Product Managers

**Goals:**  
- Automatically summarize comments with a single click.  
- Optionally expand to include categorization, sentiment analysis, and actionable items in future versions.

---

## 2. User Flows / Use Cases

**Primary Flow: Summarize Comments**  
1. **Open Plugin:**  
   - User selects "Figma Comment Analyzer" from the Plugins menu in a Figma design file or FigJam board.
2. **Initiate Summarization:**  
   - User clicks the “Summarize Comments” button.
   - (If needed, user is prompted to authorize via OAuth.)
3. **Fetch Comments:**  
   - Plugin calls Figma’s `GET /v1/files/:file_key/comments` endpoint with a centralized OAuth token.
4. **Process via Anthropic:**  
   - Plugin sends all comment text (and any useful metadata) as a prompt to Anthropic’s Claude API.
5. **Display Summary:**  
   - Once the API responds, the plugin shows the plain text summary in its UI.
   - The user can copy or review the summary and re-run the process as needed.

---

## 3. Features and Requirements

### 3.1 Core Feature: Automated Comment Summarization

- **Requirement:**  
  - Compile all comments from the active file.
  - Use Anthropic’s Claude API to generate a concise summary capturing main points and recurring themes.
  
- **Acceptance Criteria:**  
  - A single click produces a plain text summary.
  - Summary is clear, highlighting key issues (e.g., design critiques, bug reports).

### 3.2 Future Enhancements

- **Comment Categorization:**  
  - *Optional:* Label or group comments by type (e.g., design critique, bug report, feature request).

- **Sentiment Analysis:**  
  - *Optional:* Determine overall sentiment (positive, neutral, negative) and include a summary note.

- **Tagging Actionable Items:**  
  - *Optional:* Identify and list actionable feedback (e.g., “Fix padding”, “Change color”).

---

## 4. Technical Details

### 4.1 API Integrations

- **Figma REST API:**  
  - Use `GET /v1/files/:file_key/comments` to retrieve comments.
  - Authentication via centralized OAuth token stored securely (using `figma.clientStorage` or similar).

- **Anthropic Claude API:**  
  - Use Claude (preferably the latest stable model, e.g., Claude 3.5 "Sonnet") for summarization.
  - Send a prompt that includes all comment text and instructions (e.g., “Summarize the following comments…”).
  - Handle potential context size issues (if the file has extremely many comments, consider chunking).

### 4.2 Authentication & Security

- **Figma OAuth:**  
  - Implement OAuth 2.0 (using PKCE) so that users authorize once and the plugin uses their token to fetch comments.
  
- **Anthropic API Key:**  
  - Use a centralized Anthropic API key, managed securely on our backend (or obfuscated if called directly).
  - **No user input required** for API keys.

### 4.3 Error Handling & Performance

- **Error Handling:**  
  - Gracefully handle network failures, expired tokens, and API errors (with clear error messages in the UI).
  
- **Performance:**  
  - Use asynchronous calls to avoid UI blocking.
  - Disable the “Summarize Comments” button during processing.
  
- **Rate Limits:**  
  - Ensure single API call per user action; handle potential 429 errors gracefully.

---

## 5. Scope and Limitations

**In Scope (v1):**  
- Summarize comments only from the active Figma design file or FigJam board.
- Read-only access: the plugin only fetches and processes comments.
- Output is a plain text summary.

**Out of Scope (v1):**  
- Cross-file comment aggregation.
- Interactive summary features (e.g., clickable links to comments).
- Advanced visualizations or charts (to be considered for future versions).

---

## 6. LLM Integration (Anthropic’s API Usage)

**Model Choice:**  
- Use Anthropic’s Claude (e.g., Claude 3.5 "Sonnet") for its large context window and high-quality summarization.

**Prompt Design:**  
- Construct a prompt that:
  - Instructs the model: “You are an assistant that summarizes design review comments.”
  - Lists all comments (or a concatenated version) with clear separation.
  - Requests a concise summary focusing on key feedback and recurring themes.
  
**Parameters to Control:**  
- Set limits such as `max_tokens` (~150-300 tokens) and a lower `temperature` for determinism.
- Ensure tone is neutral and objective.
  
**Testing & Tuning:**  
- Iterate prompt wording based on test runs.
- Consider language handling (default to the language of input comments).

---

## 7. Open Questions / Considerations

- **UI/UX:**  
  - How best to indicate progress (loading spinner vs. progress bar)?
  - Should we include a “Copy Summary” button?
  - Refinement of authorization flow visuals.

- **Comment Filtering:**  
  - Whether to include resolved comments in the summary (likely to exclude in v1).

- **Edge Cases:**  
  - Handling files with extremely large numbers of comments (e.g., chunking requests if necessary).

- **Figma Limitations:**  
  - Confirm network fetch policies and domain whitelisting.
  - Ensure the OAuth flow conforms to Figma’s guidelines.

- **Usage Costs:**  
  - Monitor Anthropic API token usage and plan for rate/usage limits.

---

## 8. Glossary / Definitions (Optional)

- **OAuth 2.0:** Protocol used to authorize access without sharing user credentials.
- **Claude:** Anthropic’s large language model used for generating text summaries.
- **API Key:** A secret token used for authenticating API requests (managed on the backend for Anthropic).

---

## Appendix (Optional)

- **References:**  
  - Figma API Documentation: [Figma Developers API](https://www.figma.com/developers/api)  
  - Anthropic API Documentation: [Anthropic API Docs](https://docs.anthropic.com/en/api/)  
  - Relevant Reddit/CodeGuide discussions on PRD structure (links as needed).

---