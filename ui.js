// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('UI initialized');
  
  const saveKeyBtn = document.getElementById('save-key-btn');
  const summarizeBtn = document.getElementById('summarize-btn');
  const apiKeyInput = document.getElementById('api-key');
  const outputDiv = document.getElementById('summary-output');

  if (!saveKeyBtn || !summarizeBtn || !apiKeyInput || !outputDiv) {
    console.error('Some UI elements not found:', {
      saveKeyBtn: !!saveKeyBtn,
      summarizeBtn: !!summarizeBtn,
      apiKeyInput: !!apiKeyInput,
      outputDiv: !!outputDiv
    });
    return;
  }

  saveKeyBtn.onclick = () => {
    console.log('Save API key button clicked');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      outputDiv.innerHTML = '<span class="error">Please enter an API key</span>';
      return;
    }
    
    // Send API key to plugin
    parent.postMessage({
      pluginMessage: {
        type: 'SET_API_KEY',
        apiKey
      }
    }, '*');
    
    outputDiv.innerHTML = '<span class="warning">Saving API key...</span>';
  };

  summarizeBtn.onclick = () => {
    console.log('Generate Summary button clicked');
    outputDiv.innerHTML = '<em>Analyzing comments...</em>';
    summarizeBtn.disabled = true;
    
    // Send message to plugin code
    parent.postMessage({
      pluginMessage: {
        type: 'SUMMARIZE_COMMENTS'
      }
    }, '*');
  };

  // Handle responses from plugin
  window.onmessage = (event) => {
    console.log('Received message:', event.data.pluginMessage);
    
    if (!event.data.pluginMessage) return;
    
    const message = event.data.pluginMessage;
    summarizeBtn.disabled = false;

    if (message.type === 'SUMMARY_RESULT') {
      outputDiv.innerHTML = message.summary.replace(/\n/g, '<br>');
    } else if (message.type === 'SUMMARY_ERROR') {
      outputDiv.innerHTML = `<span class="error">Error: ${message.message}</span>`;
    } else if (message.type === 'CONFIG_REQUIRED') {
      outputDiv.innerHTML = `<span class="warning">${message.message}</span>`;
    } else if (message.type === 'CONFIG_SAVED') {
      outputDiv.innerHTML = '<span class="success">API key saved successfully!</span>';
      apiKeyInput.value = '';
    }
  };
});
