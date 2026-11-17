// The offscreen document's only job: play the reminder chime. A service worker has no audio, so
// js/sw.js opens offscreen.html (reason AUDIO_PLAYBACK) when a reminder is due and messages it.

import { playChime } from './chime.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // only StackNest's worker asks (a web-bridge content script can send runtime messages too)
  if (msg?.target !== 'offscreen' || msg.type !== 'chime' || sender?.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  playChime({ wait: false }).then((ok) => sendResponse({ ok }), (e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
