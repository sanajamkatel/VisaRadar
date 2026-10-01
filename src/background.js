// chrome.action.onClicked only fires when the extension has NO default_popup
// set — that's why manifest.json no longer declares one. The toolbar icon
// now toggles the on-page floating widget instead of opening a popup.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  sendToggle(tab.id);
});

function sendToggle(tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'VISARADAR_TOGGLE_WIDGET' }, () => {
    if (chrome.runtime.lastError) {
      // Content script hasn't run in this tab yet (e.g. it was open before
      // the extension loaded) — inject it, then retry the toggle.
      const files = chrome.runtime.getManifest().content_scripts?.[0]?.js || [];
      if (files.length === 0) return;
      chrome.scripting.executeScript({ target: { tabId }, files }, () => {
        chrome.tabs.sendMessage(tabId, { type: 'VISARADAR_TOGGLE_WIDGET' });
      });
    }
  });
}
