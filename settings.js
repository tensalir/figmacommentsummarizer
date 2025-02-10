document.getElementById('save-btn').addEventListener('click', () => {
  const apiKey = document.getElementById('api-key').value;
  parent.postMessage({
    pluginMessage: {
      type: 'SAVE_CONFIG',
      config: { OPENAI_API_KEY: apiKey }
    }
  }, '*');
});
