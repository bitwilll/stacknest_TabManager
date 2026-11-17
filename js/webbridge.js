/* ————————————————————————————————————————————————————————————
   StackNest on the web — the bridge that lets ONE website, chosen at run time in
   Settings, show the same content as the new tab. The website's side of it is
   specified in docs/specs/stacknest-web-bridge.md.

   WHY THIS MECHANISM. The site's address is not known when the extension ships, and
   the option has to work without another release once it is.
     · `externally_connectable` would be the textbook route, but its `matches` are fixed
       in the manifest, and a wildcard broad enough to cover any future domain is not
       allowed there.
     · A web-accessible page framed by the site has the same problem (its `matches` are
       static) and, opened wide, would let every site detect the extension.
   So: the manifest declares `optional_host_permissions: ["https://*\/*"]`, which grants
   nothing and warns about nothing at install. Connect asks Chrome for that one origin
   (Chrome shows its own prompt naming the site), then registers a content script for
   that origin only (chrome.scripting.registerContentScripts). Disconnect unregisters
   the script and hands the permission back.

   TRUST. The content script (js/webbridge-content.js) is a relay and nothing more: it
   never reads chrome.storage and holds no data. Every answer is built here, in the
   service worker, after checking that the message came from the top frame of a tab on
   the connected origin, that the connection is on, and that Chrome still grants the
   permission. The Vault (My Space items with `vault: true`), the PIN record, the Google
   account and its tokens are never read into an answer; URLs that live in the Vault are
   also filtered out of Zen pins, the Zen arrangement and tags.

   Nothing here runs, and nothing is sent anywhere, until the person connects.
   ———————————————————————————————————————————————————————————— */

import { getKey, setKey, update, queued } from './store.js';

export const WEB_KEY = 'stacknest:web';       // { origin, connected, connectedAt, lastSeenAt, endedBy } — this device only, never in a backup
export const PROTOCOL = 1;                     // bump only for a breaking change; the site checks it in `hello`
export const CHANNEL = 'stacknest:web-bridge'; // the envelope between the content script and the worker
export const BRIDGE_SCRIPT_ID = 'stacknest-web-bridge';
export const BRIDGE_FILE = 'js/webbridge-content.js';
// shown as the field's placeholder: .example is reserved (RFC 2606), so it can never be a real site
export const PLACEHOLDER_ORIGIN = 'https://stacknest.example';

// what a site can ask for: `get` sections, the one write, the one action
export const SECTIONS = ['board', 'library', 'myspace', 'notes', 'tags', 'zen', 'settings', 'wallpaper'];
const DEFAULT_SECTIONS = SECTIONS.filter((s) => s !== 'wallpaper');   // the custom image is large; ask for it by name
export const WRITES = ['todo.setDone'];
export const ACTIONS = ['open'];
const OPEN_VIEWS = ['board', 'library', 'myspace', 'notes', 'tags', 'settings'];   // never the Vault

// storage keys this module reads. The page modules that own them import DOM helpers, so the
// worker can't import them; the strings must match (js/spacesStore.js, notes.js, …).
const K = {
  collections: 'stacknest:spaces',
  workspaces: 'stacknest:workspaces',
  activeWorkspace: 'stacknest:activeWorkspace',
  myspace: 'stacknest:myspace',
  notes: 'stacknest:notes',
  tags: 'stacknest:tags',
  zenPins: 'stacknest:zenpins',
  zenLayout: 'stacknest:zenlayout',
  thoughts: 'stacknest:thoughts',
  settings: 'stacknest:settings',
  wallpaper: 'stacknest:wallpaper',
};
// which sections a change to a key can alter (My Space is handled on its own: see onStorageChanged)
const KEY_SECTIONS = {
  [K.collections]: ['board'], [K.workspaces]: ['board'], [K.activeWorkspace]: ['board'],
  [K.notes]: ['notes'], [K.tags]: ['tags'],
  [K.zenPins]: ['zen'], [K.zenLayout]: ['zen'], [K.thoughts]: ['zen'],
  [K.settings]: ['settings', 'zen'], [K.wallpaper]: ['wallpaper'],
};
const SUBS_KEY = 'stacknest:web:subs';   // chrome.storage.session: the tabs that asked for change events

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : 0);
export const patternOf = (origin) => `${origin}/*`;

/* ————— the address ————— */

// A web address → its https origin, or { error } in words a person can act on. A bare
// domain means https. Only an origin is accepted: a path, a query, credentials, an IP
// address, a wildcard or plain http would each make the permission mean something else.
export function parseOrigin(input) {
  let s = String(input ?? '').trim();
  if (!s) return { error: 'Enter the site’s address first.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return { error: 'That isn’t a web address. Try one like https://stacknest.example' }; }
  if (u.protocol !== 'https:') return { error: 'Only a secure address (https://) can be connected.' };
  if (u.username || u.password) return { error: 'Leave out the user name and password.' };
  if (u.pathname !== '/' || u.search || u.hash || /[?#]$/.test(s)) return { error: 'Use the site’s address alone, without a path — like https://stacknest.example' };
  const host = u.hostname;
  if (host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) return { error: 'Use the site’s name, not an IP address.' };
  const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
  if (!new RegExp(`^${label}(?:\\.${label})*$`).test(host) || host.length > 253) return { error: 'That isn’t a valid site name.' };
  if (!host.includes('.') && host !== 'localhost') return { error: 'Use the full site name, like stacknest.example' };
  return { origin: u.origin, host: u.port ? `${host}:${u.port}` : host, pattern: patternOf(u.origin) };
}

/* ————— the connection's state ————— */

function normState(raw) {
  const o = isObj(raw) ? raw : {};
  const p = typeof o.origin === 'string' && o.origin ? parseOrigin(o.origin) : null;
  const origin = p?.origin || '';
  return {
    origin,
    connected: !!o.connected && !!origin,
    connectedAt: num(o.connectedAt),
    lastSeenAt: num(o.lastSeenAt),
    endedBy: o.endedBy === 'chrome' ? 'chrome' : null,   // set when Chrome, not this switch, ended it
  };
}
export async function loadWebState() { return normState(await getKey(WEB_KEY, null)); }

const hasOriginPermission = (origin) => chrome.permissions.contains({ origins: [patternOf(origin)] }).catch(() => false);

// The honest status: 'off' (nothing is shared), 'waiting' (connected, but no page of the site
// has asked since), 'seen' (a page asked at lastSeenAt — which says nothing about whether the
// site is up now). Permission taken away in Chrome counts as off.
export async function webStatus() {
  const s = await loadWebState();
  if (!s.connected) return { ...s, state: 'off' };
  if (!(await hasOriginPermission(s.origin))) return { ...s, connected: false, state: 'off', endedBy: 'chrome' };
  return { ...s, state: s.lastSeenAt ? 'seen' : 'waiting' };
}

/* Content scripts can read chrome.storage.local by default. The bridge's own script never
   does, but the site's page process hosts it, so where Chrome allows it local storage is
   closed to everything but StackNest's own pages and worker. Older Chrome only supports this
   for session storage; there the relay design is the protection. */
export async function lockStorageToExtension() {
  try { await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }); } catch { /* not supported for local here */ }
}

async function registerBridge(pattern) {
  const script = { id: BRIDGE_SCRIPT_ID, matches: [pattern], js: [BRIDGE_FILE], runAt: 'document_start', allFrames: false, persistAcrossSessions: true };
  const have = await chrome.scripting.getRegisteredContentScripts({ ids: [BRIDGE_SCRIPT_ID] }).catch(() => []);
  if (have.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

async function unregisterBridge() {
  try { await chrome.scripting.unregisterContentScripts({ ids: [BRIDGE_SCRIPT_ID] }); } catch { /* wasn't registered */ }
}

/* Connect: call straight from the click (or the confirm that follows it) — Chrome only shows
   its permission prompt during a user gesture, so the request is the first thing awaited.
   Resolves { granted:false } when the person declines Chrome's prompt; nothing is stored then. */
export async function connectWeb(input) {
  const p = parseOrigin(input);
  if (p.error) throw new Error(p.error);
  const granted = await chrome.permissions.request({ origins: [p.pattern] });
  if (!granted) return { granted: false, origin: p.origin };
  await lockStorageToExtension();
  await registerBridge(p.pattern);
  await update(WEB_KEY, null, () => ({ origin: p.origin, connected: true, connectedAt: Date.now(), lastSeenAt: 0, endedBy: null }));
  // a page of the site already open gets the relay now instead of on its next load
  try {
    const tabs = await chrome.tabs.query({ url: p.pattern });
    await Promise.all(tabs.map((t) => chrome.scripting.executeScript({ target: { tabId: t.id, frameIds: [0] }, files: [BRIDGE_FILE] }).catch(() => {})));
  } catch { /* they pick it up when reloaded */ }
  return { granted: true, origin: p.origin };
}

/* Disconnect: stop answering first (the worker checks `connected` on every message and tells
   open pages), then unregister the script and give the permission back. The address is kept
   so connecting again is one click. Resolves { removed } — false only if Chrome refused to
   drop the permission (it can't, for one the manifest requires). */
export async function disconnectWeb({ endedBy = null } = {}) {
  const s = await loadWebState();
  await update(WEB_KEY, null, (cur) => ({ ...normState(cur), connected: false, lastSeenAt: 0, endedBy }));
  await unregisterBridge();
  let removed = true;
  if (s.origin) {
    try { removed = await chrome.permissions.remove({ origins: [patternOf(s.origin)] }); } catch { removed = false; }
  }
  return { removed };
}

/* ————————————————————————— the worker side ————————————————————————— */

const fail = (code, message) => ({ ok: false, error: { code, message } });
const lastSeenEvery = 60 * 1000;   // `seen` is written at most once a minute
let lastOpenAt = 0;

// The sender must be this extension's relay, in the top frame of a tab on the connected origin.
function fromBridge(sender, origin) {
  if (sender?.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || sender.origin !== origin) return false;
  try { return new URL(sender.url).origin === origin; } catch { return false; }
}

async function handle(msg, sender) {
  const st = await loadWebState();
  if (!st.connected || !fromBridge(sender, st.origin) || !(await hasOriginPermission(st.origin))) {
    return fail('not-connected', 'This site is not connected to StackNest. Connect it in StackNest’s Settings.');
  }
  if (msg.v !== PROTOCOL) return fail('unsupported', `This StackNest speaks protocol ${PROTOCOL}.`);
  if (!st.lastSeenAt || Date.now() - st.lastSeenAt > lastSeenEvery) {
    await update(WEB_KEY, null, (cur) => { const c = normState(cur); return c.connected ? { ...c, lastSeenAt: Date.now() } : undefined; });
  }
  const p = isObj(msg.payload) ? msg.payload : {};
  switch (msg.type) {
    case 'hello':
      return { ok: true, data: { app: 'StackNest', protocol: PROTOCOL, version: chrome.runtime.getManifest().version, origin: st.origin,
        connectedAt: st.connectedAt, sections: SECTIONS, defaultSections: DEFAULT_SECTIONS, writes: WRITES, actions: ACTIONS } };
    case 'get': {
      const want = p.sections == null ? DEFAULT_SECTIONS : p.sections;
      if (!Array.isArray(want) || !want.length || want.some((s) => !SECTIONS.includes(s))) {
        return fail('bad-request', `sections must be a list drawn from: ${SECTIONS.join(', ')}.`);
      }
      return { ok: true, data: await readSections([...new Set(want)]) };
    }
    case 'subscribe': await setSub(sender, true); return { ok: true, data: { sections: SECTIONS } };
    case 'unsubscribe': await setSub(sender, false); return { ok: true, data: {} };
    case 'todo.setDone': return setDone(p);
    case 'open': return openView(p, !!msg.gesture);
    default: return fail('unsupported', `Unknown message type “${str(String(msg.type), 40)}”.`);
  }
}

/* ————— reading: the stored shapes, minus everything private ————— */

async function readSections(sections) {
  const raw = await chrome.storage.local.get(Object.values(K));
  const space = splitSpace(raw[K.myspace]);
  const out = {};
  for (const s of sections) {
    if (s === 'board') out.board = boardOut(raw);
    else if (s === 'library') out.library = await libraryOut();
    else if (s === 'myspace') out.myspace = { items: space.open };
    else if (s === 'notes') out.notes = notesOut(raw[K.notes]);
    else if (s === 'tags') out.tags = tagsOut(raw[K.tags], space.vault);
    else if (s === 'zen') out.zen = zenOut(raw, space.vault);
    else if (s === 'settings') out.settings = settingsOut(raw[K.settings]);
    else if (s === 'wallpaper') out.wallpaper = wallpaperOut(raw[K.wallpaper]);
  }
  return out;
}

function boardOut(raw) {
  return {
    workspaces: arr(raw[K.workspaces]).filter(isObj).map((w) => ({ id: str(w.id, 80), name: str(w.name, 200), color: str(w.color, 40) || null })),
    activeWorkspace: str(raw[K.activeWorkspace], 80) || null,
    collections: arr(raw[K.collections]).filter(isObj).map((c) => ({
      id: str(c.id, 80), title: str(c.title, 500), color: str(c.color, 40) || null, workspaceId: str(c.workspaceId, 80) || null,
      collapsed: !!c.collapsed, createdAt: num(c.createdAt), updatedAt: num(c.updatedAt),
      tabs: arr(c.tabs).filter((t) => isObj(t) && str(t.url)).map((t) => ({ title: str(t.title, 1000) || str(t.url), url: str(t.url) })),
    })),
  };
}

// Chrome's own bookmarks — what the Library view shows. Bookmarks moved to My Space or the
// Vault are no longer in Chrome, so nothing private is in here.
async function libraryOut() {
  try {
    const [root] = await chrome.bookmarks.getTree();
    const walk = (n) => (n.url
      ? { id: n.id, title: n.title || '', url: n.url, dateAdded: num(n.dateAdded) }
      : { id: n.id, title: n.title || '', dateAdded: num(n.dateAdded), children: (n.children || []).map(walk) });
    return { roots: (root?.children || []).map(walk) };
  } catch { return { roots: [] }; }
}

// My Space as the page shows it, and the Vault's URLs — used only to filter, never sent.
function splitSpace(raw) {
  const open = [];
  const vault = new Set();
  for (const it of arr(raw?.items)) {
    if (!isObj(it) || !str(it.url)) continue;
    if (it.vault) { vault.add(it.url); continue; }
    open.push({ id: str(it.id, 80), url: str(it.url), title: str(it.title, 1000) || str(it.url), group: str(it.group, 200) || null, addedAt: num(it.addedAt) });
  }
  return { open, vault };
}
const inVault = (vault, s) => { for (const v of vault) if (s.includes(v)) return true; return false; };

function notesOut(raw) {
  let items = arr(raw?.items);
  if (!Array.isArray(raw?.items)) {   // the original { todos, notes } split, before the page migrates it
    items = [...arr(raw?.notes).filter(isObj).map((n) => ({ ...n, kind: 'note' })), ...arr(raw?.todos).filter(isObj).map((t) => ({ ...t, kind: 'reminder' }))];
  }
  return { v: 3, items: items.filter(isObj).map(noteOut) };
}
function noteOut(x) {
  const kind = ['note', 'todo', 'reminder'].includes(x.kind) ? x.kind : (Array.isArray(x.list) ? 'todo' : 'note');
  const o = { id: str(String(x.id ?? ''), 80), kind, tags: arr(x.tags).filter((t) => typeof t === 'string').map((t) => t.slice(0, 80)),
    color: str(x.color, 20) || 'none', pinned: !!x.pinned, createdAt: str(x.createdAt, 40) || null };
  if (isObj(x.reminder) && typeof x.reminder.at === 'string') o.reminder = { at: x.reminder.at.slice(0, 40), lead: Number(x.reminder.lead) || 0 };
  if (kind === 'reminder') return { ...o, text: str(x.text, 20000), done: !!x.done };
  if (kind === 'todo') return { ...o, title: str(x.title, 2000), updatedAt: str(x.updatedAt, 40) || o.createdAt,
    list: arr(x.list).filter(isObj).map((r) => ({ id: str(String(r.id ?? ''), 80), text: str(r.text, 4000), done: !!r.done })) };
  return { ...o, title: str(x.title, 2000), body: str(x.body, 100000), updatedAt: str(x.updatedAt, 40) || o.createdAt };
}

function tagsOut(raw, vault) {
  return Object.values(isObj(raw) ? raw : {})
    .filter((t) => isObj(t) && str(t.url) && !inVault(vault, t.url))
    .map((t) => ({ url: str(t.url), title: str(t.title, 1000), tags: arr(t.tags).filter((x) => typeof x === 'string').map((x) => x.slice(0, 80)) }));
}

function zenOut(raw, vault) {
  const s = isObj(raw[K.settings]) ? raw[K.settings] : {};
  const layout = isObj(raw[K.zenLayout]) ? raw[K.zenLayout] : {};
  const order = {};
  for (const [k, v] of Object.entries(isObj(layout.order) ? layout.order : {}).slice(0, 80)) {
    if (Array.isArray(v)) order[k.slice(0, 120)] = v.filter((x) => typeof x === 'string' && !inVault(vault, x)).slice(0, 500).map((x) => x.slice(0, 4100));
  }
  const th = isObj(raw[K.thoughts]) ? raw[K.thoughts] : {};
  return {
    collection: str(s.zenCollection, 200) || null,
    wallpaper: str(s.zenWallpaper, 40) || null,
    motion: s.zenMotion !== false,
    eyeRest: s.zenEyeRest !== false,
    chime: s.reminderChime !== false,
    pins: arr(raw[K.zenPins]?.items).filter(isObj)
      .filter((p) => !(p.kind === 'link' || !p.kind) || !inVault(vault, str(p.url)))
      .map((p) => (p.kind === 'folder'
        ? { id: str(p.id, 80), kind: 'folder', bmId: str(p.bmId, 64), title: str(p.title, 500), from: str(p.from, 20), at: num(p.at) }
        : p.kind === 'collection'
          ? { id: str(p.id, 80), kind: 'collection', colId: str(p.colId, 80), title: str(p.title, 500), from: str(p.from, 20), at: num(p.at) }
          : { id: str(p.id, 80), kind: 'link', url: str(p.url), title: str(p.title, 500), from: str(p.from, 20), at: num(p.at) })),
    layout: { panes: arr(layout.panes).filter((x) => typeof x === 'string').slice(0, 10), order, cal: layout.cal !== false },
    thoughts: { starred: arr(th.fav).filter((x) => typeof x === 'string').slice(0, 500).map((x) => x.slice(0, 1000)), only: !!th.only },
  };
}

// Appearance and the new-tab choice. A field that is missing has never been changed: the
// extension's default applies (listed in the spec).
const SETTING_FIELDS = ['fontUi', 'fontMono', 'scale', 'typeSizes', 'tabsBar', 'newTab', 'tickerEnabled', 'tickerBase', 'tickerCrypto', 'tickerFx'];
function settingsOut(raw) {
  const s = isObj(raw) ? raw : {};
  const out = {};
  for (const f of SETTING_FIELDS) if (f in s) out[f] = JSON.parse(JSON.stringify(s[f] ?? null));
  return out;
}

// the person's own image that 'custom' shows: the gallery's active one ({ images, active }),
// or the single image stored before the gallery ({ dataUrl, tone })
function wallpaperOut(raw) {
  const ok = (x) => isObj(x) && typeof x.dataUrl === 'string' && x.dataUrl.startsWith('data:image/');
  const list = ok(raw) ? [raw] : (isObj(raw) && Array.isArray(raw.images) ? raw.images.filter(ok) : []);
  const img = list.find((x) => x.id === raw?.active) || list[0];
  if (!img) return { custom: null };
  return { custom: { dataUrl: img.dataUrl, tone: str(img.tone, 20) || null } };
}

/* ————— the one write: tick a to-do, or untick it ————— */
// { id, done } for a reminder; { id, rowId, done } for a row of a to-do list. Nothing else
// about a card can change from the web.
async function setDone(p) {
  const id = str(String(p.id ?? ''), 80);
  const rowId = p.rowId == null ? null : str(String(p.rowId), 80);
  if (!id || typeof p.done !== 'boolean') return fail('bad-request', 'todo.setDone needs { id, done: true|false }, plus rowId for a row of a list.');
  let item = null;
  await update(K.notes, null, (raw) => {
    if (!isObj(raw) || !Array.isArray(raw.items)) return undefined;
    const i = raw.items.findIndex((x) => isObj(x) && String(x.id) === id);
    if (i < 0) return undefined;
    const it = raw.items[i];
    let next;
    if (rowId == null) {
      if (it.kind !== 'reminder') return undefined;
      next = { ...it, done: p.done };
    } else {
      const list = arr(it.list);
      const j = list.findIndex((r) => isObj(r) && String(r.id) === rowId);
      if (j < 0) return undefined;
      next = { ...it, list: list.map((r, k) => (k === j ? { ...r, done: p.done } : r)), updatedAt: new Date().toISOString() };
    }
    item = noteOut(next);
    const items = raw.items.slice();
    items[i] = next;
    return { ...raw, items };
  });
  return item ? { ok: true, data: { item } } : fail('not-found', 'No reminder or list row with that id.');
}

// Opens StackNest itself in a new tab, on one of its views. Only on a click in the page,
// and not more than once a second and a half.
async function openView(p, gesture) {
  if (!gesture) return fail('needs-gesture', 'Opening StackNest needs a click on the page.');
  if (Date.now() - lastOpenAt < 1500) return fail('rate-limited', 'StackNest was opened a moment ago.');
  lastOpenAt = Date.now();
  const view = OPEN_VIEWS.includes(p.view) ? p.view : null;
  await chrome.tabs.create({ url: chrome.runtime.getURL(`newtab.html?open=1${view && view !== 'board' ? `#${view}` : ''}`) });
  return { ok: true, data: {} };
}

/* ————— change events ————— */
// Pages that sent `subscribe` get { sections } when something they could read changes —
// names only, never values; the page asks again for what it shows.

const getSubs = async () => arr((await chrome.storage.session.get(SUBS_KEY).catch(() => ({})))[SUBS_KEY]);
const putSubs = (subs) => chrome.storage.session.set({ [SUBS_KEY]: subs.slice(-50) }).catch(() => {});

function setSub(sender, on) {
  return queued(async () => {
    const me = { tabId: sender.tab.id, documentId: sender.documentId || null };
    const subs = (await getSubs()).filter((s) => !(s.tabId === me.tabId && s.documentId === me.documentId));
    if (on) subs.push(me);
    await putSubs(subs);
  });
}

async function push(message) {
  const subs = await getSubs();
  if (!subs.length) return;
  const keep = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await chrome.tabs.sendMessage(s.tabId, { channel: CHANNEL, ...message }, s.documentId ? { documentId: s.documentId } : { frameId: 0 });
      keep.push(s);
    } catch { /* that page is gone or has moved on */ }
  }));
  await putSubs(message.event === 'disconnected' ? [] : keep);
}

let pending = new Set();
let flushTimer = null;
function queueChange(sections) {
  for (const s of sections) pending.add(s);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    const sections = SECTIONS.filter((s) => pending.has(s));
    pending = new Set();
    if (sections.length && (await loadWebState()).connected) await push({ event: 'changed', data: { sections } });
  }, 250);
}

async function onStorageChanged(c, area) {
  if (area !== 'local') return;
  if (c[WEB_KEY]) {
    const was = !!c[WEB_KEY].oldValue?.connected;
    if (was && !c[WEB_KEY].newValue?.connected) await push({ event: 'disconnected' });
  }
  const touched = Object.keys(c).filter((k) => k in KEY_SECTIONS || k === K.myspace);
  if (!touched.length || !(await getSubs()).length) return;
  const out = new Set(touched.flatMap((k) => KEY_SECTIONS[k] || []));
  if (c[K.myspace]) {
    // only what a site can see: a change inside the Vault alone must not show up as an event
    const before = splitSpace(c[K.myspace].oldValue);
    const after = splitSpace(c[K.myspace].newValue);
    if (JSON.stringify(before.open) !== JSON.stringify(after.open)) out.add('myspace');
    if ([...before.vault].sort().join('\n') !== [...after.vault].sort().join('\n')) {
      const raw = await chrome.storage.local.get([K.zenPins, K.zenLayout, K.settings, K.thoughts, K.tags]);
      if (JSON.stringify(zenOut(raw, before.vault)) !== JSON.stringify(zenOut(raw, after.vault))) out.add('zen');
      if (JSON.stringify(tagsOut(raw[K.tags], before.vault)) !== JSON.stringify(tagsOut(raw[K.tags], after.vault))) out.add('tags');
    }
  }
  if (out.size) queueChange(out);
}

// After an install, an update or a browser start: the registration must match the state,
// and a permission taken away in Chrome ends the connection.
async function reconcile() {
  const st = await loadWebState();
  if (!st.connected) {
    if ((await chrome.scripting?.getRegisteredContentScripts({ ids: [BRIDGE_SCRIPT_ID] }).catch(() => []))?.length) await unregisterBridge();
    return;
  }
  if (!(await hasOriginPermission(st.origin))) {
    await update(WEB_KEY, null, (cur) => ({ ...normState(cur), connected: false, lastSeenAt: 0, endedBy: 'chrome' }));
    await unregisterBridge();
    return;
  }
  await registerBridge(patternOf(st.origin)).catch((e) => console.warn('web bridge: re-registering failed', e));
}

// Called once from js/sw.js, at the top level so the events can wake the worker.
export function initBridgeWorker() {
  lockStorageToExtension();
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.channel !== CHANNEL || typeof msg.type !== 'string') return;
    handle(msg, sender).then(sendResponse, (e) => sendResponse(fail('error', String(e?.message || e).slice(0, 200))));
    return true;
  });
  chrome.storage.onChanged.addListener((c, area) => { onStorageChanged(c, area).catch(() => {}); });
  chrome.permissions.onRemoved.addListener(() => { reconcile().catch(() => {}); });
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
    chrome.bookmarks?.[ev]?.addListener(() => { getSubs().then((s) => { if (s.length) queueChange(['library']); }); });
  }
  chrome.runtime.onInstalled.addListener(() => { reconcile().catch(() => {}); });
  chrome.runtime.onStartup.addListener(() => { reconcile().catch(() => {}); });
}
