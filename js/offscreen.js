// The offscreen document's only job: play the reminder chime. A service worker has no audio, so
// js/sw.js opens offscreen.html (reason AUDIO_PLAYBACK) when a reminder is due and messages it.

import { playChime } from './chime.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'chime') return;
  playChime({ wait: false }).then((ok) => sendResponse({ ok }), (e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
