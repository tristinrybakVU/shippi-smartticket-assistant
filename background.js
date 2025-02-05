// Add cache cleanup
chrome.runtime.onInstalled.addListener(() => {
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Clear cache every 24 hours
  setInterval(async () => {
    const storage = await chrome.storage.local.get(null);
    const now = Date.now();
    
    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith('enhance_') && now - value.timestamp > oneDay) {
        await chrome.storage.local.remove(key);
      }
    }
  }, oneDay);
});
