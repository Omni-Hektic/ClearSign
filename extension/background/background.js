chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'LEGAL_PAGE_DETECTED') {
    chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#6c8cff', tabId: sender.tab.id });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
