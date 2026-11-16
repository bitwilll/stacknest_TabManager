// Zen pins — the links and folders the user has pinned to Zen from Collections, the Library
// and My Space. (Notes cards carry their own `pinned` flag in the notes store; everything
// else lives here, because a Chrome bookmark has nowhere to keep a flag.)
//
// A link is keyed by its URL, so the same page pinned from a collection and from the Library
// is one pin, and its pin button lights up wherever that URL is shown. A Library folder is
// keyed by its bookmark id and shows its links live in Zen.
//
// Every pin button on every view carries data-zenpin; when the store changes (here, in Zen,
// in another tab) syncButtons repaints them in place — no view has to re-render.
//
// The Zen page's arrangement (pane order, item order, calendar open) is stored next door
// under ZENLAYOUT_KEY; both keys go into a backup.

import { icon, toast } from './ui.js';
import { getKey, update, queued } from './store.js';

export const ZENPINS_KEY = 'stacknest:zenpins';
export const ZENLAYOUT_KEY = 'stacknest:zenlayout';
const MAX_PINS = 500;
const FROM = ['collection', 'library', 'myspace', 'zen'];

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

function normalize(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const out = [];
  const seen = new Set();
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const kind = it.kind === 'folder' ? 'folder' : 'link';
    const url = kind === 'link' && typeof it.url === 'string' ? it.url.slice(0, 4000) : '';
    const bmId = kind === 'folder' && typeof it.bmId === 'string' ? it.bmId.slice(0, 64) : '';
    if (kind === 'link' ? !url : !bmId) continue;
    const key = kind === 'link' ? `u:${url}` : `f:${bmId}`;
    if (seen.has(key)) continue;                          // one pin per URL / folder
    seen.add(key);
    out.push({
      id: typeof it.id === 'string' && it.id ? it.id.slice(0, 80) : uid(),
      kind, url, bmId,
      title: typeof it.title === 'string' ? it.title.slice(0, 500) : '',
      from: FROM.includes(it.from) ? it.from : 'collection',
      at: Number.isFinite(it.at) ? it.at : Date.now(),
    });
    if (out.length >= MAX_PINS) break;
  }
  return { v: 1, items: out };
}

let cache = { v: 1, items: [] };
let keys = new Set();
const keyOf = (ref) => (ref.folderId ? `f:${ref.folderId}` : `u:${ref.url}`);
const reindex = () => { keys = new Set(cache.items.map((p) => (p.kind === 'folder' ? `f:${p.bmId}` : `u:${p.url}`))); };

export async function loadZenPins() {
  cache = normalize(await queued(() => getKey(ZENPINS_KEY, null)));
  reindex();
  return cache.items;
}

export const isZenPinned = (ref) => keys.has(keyOf(ref));

// ref: { url, title, from } for a link · { folderId, title, from } for a Library folder
export async function setZenPin(ref, on) {
  const k = keyOf(ref);
  await update(ZENPINS_KEY, null, (cur) => {
    const d = normalize(cur);
    d.items = d.items.filter((p) => (p.kind === 'folder' ? `f:${p.bmId}` : `u:${p.url}`) !== k);
    if (on) {
      d.items.unshift(ref.folderId
        ? { id: uid(), kind: 'folder', bmId: ref.folderId, url: '', title: ref.title || '', from: ref.from || 'library', at: Date.now() }
        : { id: uid(), kind: 'link', url: ref.url, bmId: '', title: ref.title || '', from: ref.from || 'collection', at: Date.now() });
    }
    cache = normalize(d);
    return cache;
  });
  reindex();
  syncButtons();
}

export async function unpinZenItem(id) {
  await update(ZENPINS_KEY, null, (cur) => {
    const d = normalize(cur);
    d.items = d.items.filter((p) => p.id !== id);
    cache = d;
    return d;
  });
  reindex();
  syncButtons();
}

export function initZenPins() {
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !c[ZENPINS_KEY]) return;
    cache = normalize(c[ZENPINS_KEY].newValue);
    reindex();
    syncButtons();
  });
  return loadZenPins().then(syncButtons);
}

/* ——— the pin button every link and folder card carries ——— */

const refs = new WeakMap();
function paint(btn) {
  const ref = refs.get(btn);
  if (!ref) return;
  const on = isZenPinned(ref);
  const label = on ? 'Unpin from Zen' : 'Pin to Zen';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  if (btn.dataset.tip) btn.dataset.tip = label; else btn.title = label;
  btn.setAttribute('aria-label', label);
}
function syncButtons() {
  for (const b of document.querySelectorAll('[data-zenpin]')) paint(b);
}

// cls: the button's own classes — 'icb' on a card's action row, 'zen-rowpin' inside Zen
export function zenPinBtn(ref, { cls = 'icb', size = 14, quiet = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${cls} pin-btn`;
  btn.dataset.zenpin = keyOf(ref);
  btn.append(icon('pin', size));
  refs.set(btn, ref);
  paint(btn);
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const on = !isZenPinned(ref);
    await setZenPin(ref, on);
    if (!quiet) toast(on ? 'Pinned to Zen' : 'Unpinned from Zen');
  });
  return btn;
}
