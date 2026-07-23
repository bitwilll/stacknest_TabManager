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

/* ————— Task reminders ————— */
// The notes page schedules a chrome.alarms entry ("reminder:<todoId>") for each
// task reminder; this worker fires the OS/browser notification when the alarm
// rings — even with no StackNest tab open. Alarms persist across worker restarts
// (MV3), and Chrome fires ones missed while the browser was closed on next start.

const NOTES_KEY = 'stacknest:notes';
const REMINDER_PREFIX = 'reminder:';

chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (!alarm.name?.startsWith(REMINDER_PREFIX)) return;
  const id = alarm.name.slice(REMINDER_PREFIX.length);
  try {
    const store = (await chrome.storage.local.get(NOTES_KEY))[NOTES_KEY] || {};
    // current shape is { items }; tolerate the older { todos, notes } split
    const list = Array.isArray(store.items) ? store.items : [...(store.todos || []), ...(store.notes || [])];
    const item = list.find((x) => x.id === id);
    if (!item || item.done) return; // completed or deleted — nothing to nag about
    const when = item.reminder?.at ? new Date(item.reminder.at) : null;
    const ctx = when ? `Due ${when.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Reminder';
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: item.text || item.title || 'StackNest reminder',
      message: ctx,
      contextMessage: 'StackNest',
      priority: 2,
    });
  } catch (e) { console.error('reminder alarm failed:', e); }
});

// clicking the notification opens a StackNest tab (the Notes view)
chrome.notifications?.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.tabs.create({ url: 'chrome://newtab' });
});
