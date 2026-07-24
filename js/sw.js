// Background service worker.
//
// Exists for one reason: chrome.identity's OAuth flows can't run from an
// incognito page, so incognito newtabs delegate token mint/evict here via
// runtime messages (see getToken in drive.js). With "incognito": "spanning"
// there is a single extension instance — this worker always runs in the
// regular profile, where the interactive consent window is allowed to open.
//
// The token logic itself lives in js/auth.js so the page and this worker can't drift
// apart — whichever sign-in path is configured, incognito gets the same one.

import { mintToken, forgetToken, forgetAllTokens } from './auth.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'auth:getToken') {
    mintToken({ interactive: !!msg.interactive, chooseAccount: !!msg.chooseAccount, loginHint: msg.loginHint || null })
      .then((token) => sendResponse({ token }))
      .catch((e) => sendResponse({ error: e?.message || 'No token returned.' }));
    return true; // keep the channel open for the async sendResponse
  }
  if (msg?.type === 'auth:removeToken') {
    forgetToken(msg.token).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'auth:removeAll') {
    forgetAllTokens().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
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

// A card is "finished" — and needs no nag — when a reminder is ticked, or when every row
// of a to-do list is ticked. Reading only a top-level `done` would keep pestering about a
// checklist the user has fully completed, because a list card has no top-level done.
function isFinished(item) {
  if (Array.isArray(item.list)) return item.list.length > 0 && item.list.every((r) => r.done);
  return !!item.done;
}

// What to call the card in the notification. Checklists lead with their title; a reminder
// (old shape: kind 'todo' with `text`) leads with its line.
function titleOf(item) {
  if (Array.isArray(item.list)) return item.title || 'StackNest list';
  return item.text || item.title || 'StackNest reminder';
}

chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (!alarm.name?.startsWith(REMINDER_PREFIX)) return;
  const id = alarm.name.slice(REMINDER_PREFIX.length);
  try {
    const store = (await chrome.storage.local.get(NOTES_KEY))[NOTES_KEY] || {};
    // current shape is { v, items }; tolerate the original { todos, notes } split
    const list = Array.isArray(store.items) ? store.items : [...(store.todos || []), ...(store.notes || [])];
    const item = list.find((x) => x.id === id);
    if (!item || isFinished(item)) return; // completed or deleted — nothing to nag about
    const when = item.reminder?.at ? new Date(item.reminder.at) : null;
    let ctx = when ? `Due ${when.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Reminder';
    if (Array.isArray(item.list) && item.list.length) {
      ctx += ` · ${item.list.filter((r) => !r.done).length} of ${item.list.length} left`;
    }
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: titleOf(item),
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
