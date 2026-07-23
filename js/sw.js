// Background service worker.
//
// Exists for one reason: chrome.identity's OAuth flows can't run from an
// incognito page, so incognito newtabs delegate token mint/evict here via
// runtime messages (see getToken in drive.js). With "incognito": "spanning"
// there is a single extension instance — this worker always runs in the
// regular profile, where the interactive consent window is allowed to open.
//
// Keep SCOPES in sync with js/drive.js.

const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.email'];

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'auth:getToken') {
    chrome.identity.getAuthToken({ interactive: !!msg.interactive, scopes: SCOPES }, (token) => {
      const err = chrome.runtime.lastError;
      sendResponse(err || !token ? { error: err?.message || 'No token returned.' } : { token });
    });
    return true; // keep the channel open for the async sendResponse
  }
  if (msg?.type === 'auth:removeToken') {
    chrome.identity.removeCachedAuthToken({ token: msg.token }, () => {
      void chrome.runtime.lastError; // eviction is best-effort
      sendResponse({ ok: true });
    });
    return true;
  }
});
