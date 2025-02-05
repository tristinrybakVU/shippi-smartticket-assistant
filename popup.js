document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.querySelector('#apiKey');
  const intensitySelect = document.querySelector('#intensity');
  const styleSelect = document.querySelector('#style');
  const autoFormatCheckbox = document.querySelector('#autoFormat');
  const addLinksCheckbox = document.querySelector('#addLinks');
  const autoSaveCheckbox = document.querySelector('#autoSave');
  const saveButton = document.querySelector('#saveSettings');
  const statusMessage = document.querySelector('#statusMessage');
  
  // Load saved settings
  chrome.storage.sync.get([
    'apiKey',
    'intensity',
    'style',
    'autoFormat',
    'addLinks',
    'autoSave'
  ], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      statusMessage.textContent = 'Settings loaded';
      statusMessage.style.color = 'green';
    }
    
    if (result.intensity) {
      intensitySelect.value = result.intensity;
    }
    
    if (result.style) {
      styleSelect.value = result.style;
    }
    
    autoFormatCheckbox.checked = result.autoFormat !== false;
    addLinksCheckbox.checked = result.addLinks !== false;
    autoSaveCheckbox.checked = result.autoSave === true;
  });
  
  // Save settings
  saveButton.addEventListener('click', () => {
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      intensity: intensitySelect.value,
      style: styleSelect.value,
      autoFormat: autoFormatCheckbox.checked,
      addLinks: addLinksCheckbox.checked,
      autoSave: autoSaveCheckbox.checked
    };
    
    if (!settings.apiKey) {
      statusMessage.textContent = 'Please enter an API key';
      statusMessage.style.color = 'red';
      return;
    }
    
    chrome.storage.sync.set(settings, () => {
      statusMessage.textContent = 'Settings saved successfully!';
      statusMessage.style.color = 'green';
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 2000);
    });
  });
});
