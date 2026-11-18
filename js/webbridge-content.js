/* StackNest on the web — the page side of the bridge (see js/webbridge.js and
   docs/specs/stacknest-web-bridge.md).

   Registered at run time for the ONE https origin connected in Settings, top frame only,
   at document_start. It is a relay and holds nothing: it never reads chrome.storage, it
   forwards only protocol-1 message types to StackNest's service worker (which checks the
   sender's origin again before answering), and it passes the worker's answers and change
   events back to the page with window.postMessage, addressed to this origin only.

   A classic script, not a module: content scripts can't import. */
(() => {
  // injected twice (Connect while a page was open, then a reload)? the first copy revives
  const existing = globalThis.__stacknestWebBridge;
  if (existing) { existing.revive(); return; }

  const CHANNEL = 'stacknest:web-bridge';
  const PROTOCOL = 1;
  const TYPES = new Set(['hello', 'get', 'subscribe', 'unsubscribe', 'todo.setDone', 'open']);
  const MAX_PAYLOAD = 16 * 1024;   // requests are small; answers are not limited
  const MAX_IN_FLIGHT = 16;
  const origin = location.origin;
  let live = true;
  let inFlight = 0;

  const post = (m) => window.postMessage({ from: 'stacknest', v: PROTOCOL, ...m }, origin);
  const error = (code, message) => ({ ok: false, error: { code, message } });
  // the site can tell, before any script of its own runs, that the bridge is here
  const mark = (on) => {
    try {
      const root = document.documentElement;
      if (!root) return;
      if (on) root.dataset.stacknestBridge = String(PROTOCOL); else delete root.dataset.stacknestBridge;
    } catch { /* no document yet */ }
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== origin) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || m.to !== 'stacknest') return;
    const id = typeof m.id === 'string' || typeof m.id === 'number' ? m.id : null;
    const reply = (r) => post({ kind: 'response', id, type: typeof m.type === 'string' ? m.type : null, ...r });
    if (!live) return reply(error('not-connected', 'This site is no longer connected to StackNest.'));
    if (m.v !== PROTOCOL) return reply(error('unsupported', `This StackNest speaks protocol ${PROTOCOL}.`));
    if (!TYPES.has(m.type)) return reply(error('unsupported', 'Unknown message type.'));
    let payload = null;
    try {
      const json = m.payload == null ? 'null' : JSON.stringify(m.payload);   // plain data only, nothing live crosses
      if (json.length > MAX_PAYLOAD) return reply(error('bad-request', 'That request is too large.'));
      payload = JSON.parse(json);
    } catch { return reply(error('bad-request', 'The payload must be plain JSON data.')); }
    if (inFlight >= MAX_IN_FLIGHT) return reply(error('rate-limited', 'Too many requests at once.'));
    const gesture = !!navigator.userActivation?.isActive;   // `open` needs a click on the page
    inFlight++;
    let sent;
    try { sent = chrome.runtime.sendMessage({ channel: CHANNEL, v: PROTOCOL, type: m.type, payload, gesture }); }
    catch { sent = Promise.reject(new Error('gone')); }
    sent.then(
      (r) => reply(r && typeof r === 'object' && 'ok' in r ? r : error('unavailable', 'StackNest did not answer.')),
      () => reply(error('unavailable', 'StackNest isn’t available. It may have been updated or turned off — reload the page.')),
    ).finally(() => { inFlight--; });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id || msg?.channel !== CHANNEL) return;
    if (msg.event === 'changed' && live) post({ kind: 'event', type: 'changed', data: { sections: Array.isArray(msg.data?.sections) ? msg.data.sections : [] } });
    if (msg.event === 'disconnected') { live = false; mark(false); post({ kind: 'event', type: 'disconnected' }); }
    sendResponse({ ok: true });
  });

  const announce = () => { mark(true); post({ kind: 'event', type: 'ready', data: { protocol: PROTOCOL } }); };
  globalThis.__stacknestWebBridge = { revive: () => { live = true; announce(); } };
  announce();
})();
