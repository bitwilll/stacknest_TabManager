// Background service worker.
//
// Four jobs: OAuth delegation for incognito pages, task reminders (alarms → notifications),
// the toolbar button, and answering the one website connected in Settings → StackNest on the
// web (js/webbridge.js). The first exists because chrome.identity's OAuth flows can't run from an
// incognito page, so incognito newtabs delegate token mint/evict here via
// runtime messages (see getToken in drive.js). With "incognito": "spanning"
// there is a single extension instance — this worker always runs in the
// regular profile, where the interactive consent window is allowed to open.
//
// The token logic itself lives in js/auth.js so the page and this worker can't drift
// apart — whichever sign-in path is configured, incognito gets the same one.

import { mintToken, forgetToken, forgetAllTokens } from './auth.js';
import { initBridgeWorker } from './webbridge.js';

initBridgeWorker();

// Only StackNest's own pages may ask for a Google token. Since the web bridge, a content script
// can send runtime messages too; it never sends these, but a compromised page process could try.
const fromExtensionPage = (sender) => sender?.id === chrome.runtime.id
  && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (typeof msg?.type !== 'string' || !msg.type.startsWith('auth:') || !fromExtensionPage(sender)) return;
  if (msg.type === 'auth:getToken') {
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

/* ————— The reminder chime —————
   A worker has no audio, so a short-lived offscreen document plays it (js/offscreen.js, a
   synthesised bell from js/chime.js). Settings → Zen → "Chime with reminders" turns it off.
   The document is closed a few seconds after the last chime. */
let closeTimer = null;
async function chime() {
  try {
    const settings = (await chrome.storage.local.get('stacknest:settings'))['stacknest:settings'];
    if (settings?.reminderChime === false || !chrome.offscreen) return false;
    const url = chrome.runtime.getURL('offscreen.html');
    const open = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (!open?.length) {
      await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play a short chime when a reminder is due.' });
    }
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'chime' });
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { chrome.offscreen.closeDocument().catch(() => {}); }, 4000);
    return !!res?.ok;
  } catch (e) {
    console.warn('reminder chime failed:', e);
    return false;
  }
}

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
    // the chime plays first; when it does, the notification itself stays silent so the two
    // never sound together (the OS sound is the fallback when the chime is off or fails)
    const chimed = await chime();
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: titleOf(item),
      message: ctx,
      contextMessage: 'StackNest',
      priority: 2,
      requireInteraction: true,   // a reminder waits on screen until it is seen
      silent: chimed,
    });
  } catch (e) { console.error('reminder alarm failed:', e); }
});

// Chrome may drop alarms when the extension updates, and a store update arrives silently — so
// the worker re-arms every pending reminder on install/update and on browser start, instead
// of waiting for a StackNest tab to open (notes.js rearmAlarms does the same from the page).
// Same rule as notes.js: fire at `at` minus the lead time, unfinished cards only, future only.
async function rearmReminders() {
  try {
    const store = (await chrome.storage.local.get(NOTES_KEY))[NOTES_KEY] || {};
    const list = Array.isArray(store.items) ? store.items : [...(store.todos || []), ...(store.notes || [])];
    for (const item of list) {
      if (!item?.id || !item.reminder?.at || isFinished(item)) continue;
      const when = new Date(item.reminder.at).getTime() - (item.reminder.lead || 0) * 60000;
      if (when > Date.now()) chrome.alarms.create(REMINDER_PREFIX + item.id, { when });
    }
  } catch (e) { console.error('re-arming reminders failed:', e); }
}
chrome.runtime.onInstalled.addListener(rearmReminders);
chrome.runtime.onStartup.addListener(rearmReminders);

// The toolbar button opens StackNest. While StackNest is the new tab page that is simply a new
// tab; with Settings → New tab off, new tabs belong to Chrome, so it opens StackNest's page by
// its address (the ?open query tells boot.js not to hand the tab over).
chrome.action?.onClicked.addListener(async () => {
  let newTab = true;
  try { newTab = (await chrome.storage.local.get('stacknest:settings'))['stacknest:settings']?.newTab !== false; } catch { /* default */ }
  chrome.tabs.create(newTab ? {} : { url: chrome.runtime.getURL('newtab.html?open=1') });
});

// clicking the notification opens StackNest on the Notes view (app.js reads the hash)
chrome.notifications?.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html#notes') });
});
