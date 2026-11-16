// Zen — the uncluttered page. One switch beside the theme segment hides the whole workspace
// (sidebar, top bar, tab strip, board) and leaves, on a wallpaper:
//
//   a thought for the day       across the top, with a button for another
//   the clock and the date      on the side, with a month calendar under them (folds away)
//   one collection              chosen right here, remembered in settings (zenCollection)
//   To-do                       open reminders and unfinished checklists — tick, or add one
//   Pinned                      anything pinned to Zen: Notes cards, plus links and folders from
//                               Collections, the Library and My Space (js/zenpins.js)
//
// The three panes, and the items inside each, can be dragged into any order (or moved with
// Alt+arrow keys); the arrangement is saved under ZENLAYOUT_KEY. An eye-rest pause runs on
// top every 30 minutes of screen time (js/zenrest.js; the zenEyeRest setting).
//
// On/off lives in localStorage like the theme (boot.js puts data-zen on <html> before first
// paint, so a new tab opened in Zen never flashes the board). The wallpaper is a setting
// (Settings → Zen), so it travels with a backup; a custom image stays on this device.

import { el, icon, tile, domainOf } from './ui.js';
import { getKey, update } from './store.js';
import { SPACES_KEY, ACTIVE_WS_KEY, WORKSPACES_KEY, loadActiveSpaces } from './spacesStore.js';
import { NOTES_KEY, loadNotes, toggleNoteDone, addQuickReminder, setNotePinned } from './notes.js';
import { SETTINGS_KEY, loadSettings, saveSettings } from './settings.js';
import { WALLPAPER_KEY, wallpaperFor } from './wallpapers.js';
import { ZENPINS_KEY, ZENLAYOUT_KEY, loadZenPins, unpinZenItem, zenPinBtn } from './zenpins.js';
import { createCalendar } from './zencal.js';
import { createEyeRest } from './zenrest.js';
import { thoughtFor } from './thoughts.js';
import { renderMarkdown, renderInline } from './markdown.js';

export const ZEN_KEY = 'stacknest:zen';
const PANES = ['col', 'todo', 'pinned'];
const ZEN_MIME = 'text/x-stacknest-zen';

let root, shell = null, clockTimer = null, renderTimer = null, lastFocus = null;
let layout = { panes: [...PANES], order: {}, cal: true };
let thoughtOffset = 0;

const isOn = () => document.documentElement.dataset.zen === 'on';

function normalizeLayout(raw) {
  const panes = Array.isArray(raw?.panes) ? raw.panes.filter((p, i, a) => PANES.includes(p) && a.indexOf(p) === i) : [];
  for (const p of PANES) if (!panes.includes(p)) panes.push(p);
  const order = {};
  if (raw?.order && typeof raw.order === 'object') {
    for (const [k, v] of Object.entries(raw.order).slice(0, 80)) {
      if (Array.isArray(v)) order[String(k).slice(0, 120)] = v.filter((x) => typeof x === 'string').slice(0, 500).map((x) => x.slice(0, 4100));
    }
  }
  return { panes, order, cal: raw?.cal !== false };
}
const saveLayout = (patch) => update(ZENLAYOUT_KEY, null, (cur) => {
  const base = normalizeLayout(cur);
  layout = normalizeLayout({ ...base, ...patch, order: { ...base.order, ...(patch.order || {}) } });
  return layout;
});

export function initZen({ root: r, openSettings }) {
  root = r;
  buildShell(openSettings);
  for (const b of document.querySelectorAll('[data-zen-toggle]')) b.addEventListener('click', () => setZen(!isOn()));
  document.addEventListener('keydown', (e) => {
    if (!isOn() || e.key !== 'Escape') return;
    if (shell.rest.isShowing()) { e.preventDefault(); shell.rest.skip(); return; }   // Esc ends the pause, not Zen
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
    if (typing) { document.activeElement.blur(); return; }   // first Esc leaves the field, the next leaves Zen
    if (document.querySelector('.modal-scrim')) return;       // a dialog owns Escape while it is up
    setZen(false);
  });
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !isOn()) return;
    if (c[NOTES_KEY] || c[SPACES_KEY] || c[ACTIVE_WS_KEY] || c[WORKSPACES_KEY] || c[SETTINGS_KEY] || c[WALLPAPER_KEY]
      || c[ZENPINS_KEY] || c[ZENLAYOUT_KEY]) scheduleRender();
  });
  // a pinned Library folder shows its links live
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
    chrome.bookmarks?.[ev]?.addListener?.(() => { if (isOn()) scheduleRender(); });
  }
  document.addEventListener('stacknest:imported', () => { if (isOn()) render(); });
  setZen(isOn(), { persist: false, focus: false });
  return { render, setZen };
}

export function setZen(on, { persist = true, focus = true } = {}) {
  const html = document.documentElement;
  if (on && !isOn()) lastFocus = document.activeElement;
  html.dataset.zen = on ? 'on' : 'off';
  if (persist) { try { localStorage.setItem(ZEN_KEY, on ? 'on' : 'off'); } catch { /* not remembered, still applied */ } }
  for (const b of document.querySelectorAll('[data-zen-toggle]')) b.setAttribute('aria-pressed', String(on));
  document.querySelector('.app').inert = on;   // nothing behind the Zen page is reachable by Tab
  root.inert = !on;
  clearInterval(clockTimer);
  if (on) {
    tick();
    clockTimer = setInterval(tick, 10_000);
    render();
    if (focus) requestAnimationFrame(() => shell.exit.focus({ preventScroll: true }));
  } else {
    shell.rest.stop();
    if (focus) (lastFocus?.isConnected ? lastFocus : document.getElementById('zen-btn'))?.focus?.({ preventScroll: true });
  }
}

/* ————————————————————————— shell (built once) ————————————————————————— */

function buildShell(openSettings) {
  const time = el('div', { class: 'zen-time', 'aria-live': 'off' });
  const date = el('div', { class: 'zen-date' });
  const greet = el('div', { class: 'zen-greet' });

  // the thought for the day, across the top
  const thoughtText = el('blockquote', { class: 'zen-thought-text' });
  const thoughtNext = el('button', { class: 'zen-thought-next', type: 'button', title: 'Another thought', 'aria-label': 'Show another thought',
    onclick: () => { thoughtOffset += 1; paintThought(); } }, icon('reset', 13));
  const thought = el('figure', { class: 'zen-thought' }, el('span', { class: 'zen-thought-mark', 'aria-hidden': 'true' }, icon('quote', 18)), thoughtText, thoughtNext);

  const exit = el('button', { class: 'zen-btn-pill', type: 'button', title: 'Leave Zen (Esc)', onclick: () => setZen(false) },
    icon('close', 14), el('span', { text: 'Leave zen' }));
  const wallBtn = el('button', { class: 'zen-icb', type: 'button', title: 'Choose wallpaper', 'aria-label': 'Choose wallpaper',
    onclick: () => { setZen(false); openSettings('set-zen'); } }, icon('image', 16));
  const eyeBtn = el('button', { class: 'zen-icb zen-eye', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Eye rest breaks',
    onclick: () => saveSettings({ zenEyeRest: eyeBtn.getAttribute('aria-pressed') !== 'true' }) }, icon('eye', 16));

  // collection pane — the picker is the pane's title
  const pick = el('select', { class: 'zen-pick', 'aria-label': 'Collection shown in Zen' });
  pick.addEventListener('change', () => saveSettings({ zenCollection: pick.value }));
  const colCount = el('span', { class: 'zen-count' });
  const openAll = el('button', { class: 'zen-mini', type: 'button', title: 'Open every link in this collection in background tabs' },
    icon('external', 13), el('span', { text: 'Open all' }));
  const colBody = el('div', { class: 'zen-body zen-links' });

  // to-do pane
  const todoCount = el('span', { class: 'zen-count' });
  const add = el('input', { class: 'zen-add', type: 'text', placeholder: 'Add a to-do…', 'aria-label': 'Add a to-do', autocomplete: 'off' });
  add.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = add.value.trim();
    if (!v) return;
    add.value = '';
    await addQuickReminder(v);
    render();
  });
  const todoBody = el('div', { class: 'zen-body zen-todos' });

  // pinned pane
  const pinCount = el('span', { class: 'zen-count' });
  const pinBody = el('div', { class: 'zen-body zen-pins' });

  const grip = (name) => el('button', { class: 'zen-grip', type: 'button', title: `Drag to move ${name} (or arrow keys)`,
    'aria-label': `Move the ${name} pane with the arrow keys` }, icon('grip', 13));
  const pane = (id, name, head, ...body) => el('section', { class: `zen-pane zen-${id}`, dataset: { key: id }, 'aria-label': name },
    el('header', { class: 'zen-pane-head' }, el('span', { class: 'zen-cap' }, el('span', { text: name.toLowerCase() }), grip(name)), ...head), ...body);
  const panes = {
    col: pane('col', 'Collection', [pick, colCount, openAll], colBody),
    todo: pane('todo', 'To-do', [el('h2', { class: 'zen-h', text: 'To-do' }), todoCount], el('div', { class: 'zen-addrow' }, icon('plus', 15), add), todoBody),
    pinned: pane('pinned', 'Pinned', [el('h2', { class: 'zen-h', text: 'Pinned' }), pinCount], pinBody),
  };
  const grid = el('main', { class: 'zen-grid' }, ...layout.panes.map((p) => panes[p]));

  const cal = createCalendar({ onToggle: (open) => saveLayout({ cal: open }) });
  const rest = createEyeRest({
    isActive: isOn,
    onStatus: (on, mins) => {
      eyeBtn.setAttribute('aria-pressed', String(on));
      eyeBtn.title = on ? `Eye rest is on: a 30-second pause after ${mins} more min in Zen. Click to turn off.` : 'Eye rest is off. Click for a 30-second pause every 30 minutes.';
    },
  });

  root.replaceChildren(
    el('div', { class: 'zen-veil', 'aria-hidden': 'true' }),
    el('header', { class: 'zen-bar' }, thought, el('div', { class: 'zen-tools' }, eyeBtn, wallBtn, exit)),
    el('div', { class: 'zen-stage' },
      el('aside', { class: 'zen-side' },
        el('div', { class: 'zen-clock' }, time, el('div', { class: 'zen-sub' }, greet, el('span', { class: 'zen-dot', 'aria-hidden': 'true', text: '·' }), date)),
        cal.node),
      grid),
    rest.node,
  );

  // drag (or Alt+arrow) to arrange: the panes, and the items inside each pane
  sortable(grid, { item: '.zen-pane', handle: '.zen-grip', onSort: (keys) => saveLayout({ panes: keys }) });
  sortable(colBody, { item: '.zen-linkrow', onSort: (keys) => shell.colKey && saveLayout({ order: { [shell.colKey]: keys } }) });
  sortable(todoBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { todo: keys } }) });
  sortable(pinBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { pinned: keys } }) });

  shell = { time, date, greet, exit, pick, colCount, openAll, colBody, todoCount, todoBody, pinCount, pinBody, thoughtText, grid, panes, cal, rest, colKey: null };
  paintThought();
}

let thoughtDay = '';
function paintThought() { shell.thoughtText.textContent = thoughtFor(thoughtOffset); thoughtDay = new Date().toDateString(); }

function tick() {
  const d = new Date();
  shell.time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  shell.date.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const h = d.getHours();
  shell.greet.textContent = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  if (d.toDateString() !== thoughtDay) { thoughtOffset = 0; paintThought(); }   // a new day brings a new thought
}

/* ————————————————————————— drag to arrange ————————————————————————— */

let drag = null;   // { el, container, before }

// Items are direct children of `container` matching `item`, each with data-key. A pane moves
// only from its grip (so text in it can still be selected); list items move from anywhere.
function sortable(container, { item, handle = null, onSort }) {
  const own = (n) => { const it = n?.closest?.(item); return it && it.parentElement === container ? it : null; };
  const keys = () => [...container.children].filter((c) => c.matches(item)).map((c) => c.dataset.key);

  if (handle) {
    container.addEventListener('pointerdown', (e) => { const it = own(e.target); if (it && e.target.closest(handle)) it.draggable = true; });
    container.addEventListener('pointerup', (e) => { const it = own(e.target); if (it && !drag) it.draggable = false; });
  }
  container.addEventListener('dragstart', (e) => {
    const it = own(e.target);
    if (!it || (handle && !it.draggable)) return;
    e.stopPropagation();
    drag = { el: it, container, before: keys().join('\n') };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(ZEN_MIME, it.dataset.key);
    requestAnimationFrame(() => { if (drag?.el === it) it.classList.add('is-dragging'); });   // after the drag image is taken; not if it already ended
  });
  container.addEventListener('dragover', (e) => {
    if (!drag || drag.container !== container) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const over = own(e.target);
    if (!over || over === drag.el) return;
    const after = Boolean(drag.el.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING);
    container.insertBefore(drag.el, after ? over.nextSibling : over);
  });
  container.addEventListener('drop', (e) => { if (drag?.container === container) { e.preventDefault(); e.stopPropagation(); } });
  container.addEventListener('dragend', (e) => {
    if (!drag || drag.container !== container) return;
    e.stopPropagation();
    const d = drag;
    drag = null;
    d.el.classList.remove('is-dragging');
    if (handle) d.el.draggable = false;
    const now = keys();
    if (now.join('\n') !== d.before) onSort(now);
  });

  // keyboard: Alt + an arrow key on anything inside an item (or a plain arrow on a pane's grip)
  container.addEventListener('keydown', (e) => {
    if (!/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    const onGrip = handle && e.target.closest(handle);
    if (!e.altKey && !onGrip) return;
    const it = own(e.target);
    if (!it) return;
    e.preventDefault();
    e.stopPropagation();
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    const sib = back ? it.previousElementSibling : it.nextElementSibling;
    if (!sib || !sib.matches(item)) return;
    const focused = document.activeElement;
    container.insertBefore(it, back ? sib : sib.nextSibling);
    focused?.focus?.();
    onSort(keys());
  });
}

// saved order first; anything the saved order has not seen yet goes on top (newest) or at
// the end (a collection's own order), keeping its natural position among the new ones
function arrange(list, keyOf, saved, unknownFirst) {
  const pos = new Map((saved || []).map((k, i) => [k, i]));
  const miss = unknownFirst ? -1 : Number.MAX_SAFE_INTEGER;
  return list.map((x, i) => ({ x, i, k: keyOf(x) }))
    .sort((a, b) => ((pos.get(a.k) ?? miss) - (pos.get(b.k) ?? miss)) || (a.i - b.i))
    .map((o) => o.x);
}

/* ————————————————————————— render ————————————————————————— */

function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 60); }

export async function render() {
  if (!shell || !isOn()) return;
  if (drag) { scheduleRender(); return; }   // never rebuild a list under a drag
  const [settings, spaces, items, custom, pins, rawLayout] = await Promise.all([
    loadSettings(), loadActiveSpaces(), loadNotes(), getKey(WALLPAPER_KEY, null), loadZenPins(), getKey(ZENLAYOUT_KEY, null)]);
  layout = normalizeLayout(rawLayout);

  // wallpaper + the ink that reads on it
  const wp = wallpaperFor(settings.zenWallpaper, custom);
  root.style.setProperty('--zen-wall', wp.css);
  root.dataset.tone = wp.tone;
  shell.rest.setEnabled(settings.zenEyeRest);

  // panes in the saved order (moved only when they are not, so a focused field keeps focus)
  const want = layout.panes.map((p) => shell.panes[p]);
  if (want.some((p, i) => shell.grid.children[i] !== p)) shell.grid.append(...want);

  shell.cal.render(items, layout.cal);
  renderCollection(spaces, settings.zenCollection);

  // a focused field in Zen (the add box) is never rebuilt, so only the lists are refilled
  const pinnedNotes = items.filter((i) => i.pinned);
  const open = items.filter((i) => !i.pinned && (
    (i.kind === 'reminder' && !i.done) || (i.kind === 'todo' && (i.list || []).some((r) => !r.done))));
  const openRows = open.reduce((n, i) => n + (i.kind === 'reminder' ? 1 : (i.list || []).filter((r) => !r.done).length), 0);
  shell.todoCount.textContent = openRows ? `${openRows} open` : '';
  const todos = arrange(open, (i) => i.id, layout.order.todo, true);
  shell.todoBody.replaceChildren(...(todos.length
    ? todos.map((i) => (i.kind === 'reminder' ? reminderRow(i, { key: i.id }) : listCard(i, { key: i.id })))
    : [quiet('Nothing open. Add a to-do above — it lands in Notes too.')]));

  const pinned = arrange([
    ...pinnedNotes.map((n) => ({ key: `n:${n.id}`, note: n })),
    ...pins.map((p) => ({ key: `z:${p.id}`, pin: p })),
  ], (x) => x.key, layout.order.pinned, true);
  shell.pinCount.textContent = pinned.length ? String(pinned.length) : '';
  const cards = await Promise.all(pinned.map((x) => (x.note ? pinCard(x.note, x.key) : x.pin.kind === 'folder' ? folderPin(x.pin, x.key) : linkPin(x.pin, x.key))));
  shell.pinBody.replaceChildren(...(cards.length ? cards
    : [quiet('Pin anything here: the pin on a Notes card, or on any link in Collections, the Library or My Space. Links in the collection pane have one too.')]));
}

function renderCollection(spaces, wantedId) {
  const { pick, colBody, colCount, openAll } = shell;
  const chosen = spaces.find((s) => s.id === wantedId) || spaces[0] || null;
  pick.replaceChildren(...(spaces.length
    ? spaces.map((s) => el('option', { value: s.id, text: s.title || 'Untitled collection', selected: s === chosen ? 'true' : null }))
    : [el('option', { value: '', text: 'No collections yet' })]));
  pick.disabled = !spaces.length;
  if (chosen) pick.value = chosen.id;
  const tabs = (chosen?.tabs || []).filter((t) => t?.url);
  colCount.textContent = tabs.length ? String(tabs.length) : '';
  openAll.hidden = tabs.length < 2;
  openAll.onclick = async () => { for (const t of tabs) await chrome.tabs.create({ url: t.url, active: false }); };
  // the same URL twice in one collection gets #2, #3… so each row has its own key
  const seen = new Map();
  const keyed = tabs.map((t) => { const n = (seen.get(t.url) || 0) + 1; seen.set(t.url, n); return { t, key: n > 1 ? `${t.url}#${n}` : t.url }; });
  shell.colKey = chosen ? `col:${chosen.id}` : null;
  const rows = arrange(keyed, (x) => x.key, shell.colKey ? layout.order[shell.colKey] : null, false);
  colBody.replaceChildren(...(rows.length
    ? rows.map(({ t, key }) => el('div', { class: 'zen-linkrow', dataset: { key } },
      linkRow(t), zenPinBtn({ url: t.url, title: t.title || t.url, from: 'collection' }, { cls: 'zen-rowpin', size: 13 })))
    : [quiet(spaces.length ? 'This collection is empty.' : 'Save a window to a collection and it can live here.')]));
}

const quiet = (text) => el('p', { class: 'zen-quiet', text });

function linkRow(t) {
  const a = el('a', { class: 'zen-link', href: t.url, title: t.url },
    tile(t.url, 30),
    el('span', { class: 'zen-link-meta' }, el('span', { class: 'zen-link-title', text: t.title || t.url }), el('span', { class: 'zen-link-dom', text: domainOf(t.url) })));
  // same deal as the board: a plain click goes there, ⌘/Ctrl-click opens behind
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); chrome.tabs.create({ url: t.url, active: false }); }
  });
  return a;
}

function check(done, label, onToggle) {
  return el('button', { class: `zen-check${done ? ' is-done' : ''}`, type: 'button', role: 'checkbox', 'aria-checked': String(!!done), 'aria-label': label,
    onclick: async () => { await onToggle(); render(); } }, done ? icon('check', 12) : null);
}

function reminderRow(it, { key = null } = {}) {
  const text = el('span', { class: 'zen-row-text' });
  text.innerHTML = renderInline(it.text || 'Reminder');
  return el('div', { class: `zen-row${it.done ? ' is-done' : ''}${key ? ' zen-item' : ''}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    check(it.done, it.text || 'Reminder', () => toggleNoteDone(it.id)), text, dueChip(it));
}

function dueChip(it) {
  if (!it.reminder?.at) return null;
  const at = new Date(it.reminder.at);
  const past = at.getTime() <= Date.now();
  return el('span', { class: `zen-due${past ? ' past' : ''}` }, icon('bell', 10),
    el('span', { text: at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
}

function listCard(it, { key = null, pinnedCard = false } = {}) {
  const rows = it.list || [];
  const done = rows.filter((r) => r.done).length;
  return el('div', { class: `zen-list c-${it.color || 'none'}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: it.title || 'Untitled list' }),
      rows.length ? el('span', { class: 'zen-list-n', text: `${done}/${rows.length}` }) : null,
      pinnedCard ? unpinNoteBtn(it) : null),
    ...rows.map((r) => {
      const text = el('span', { class: 'zen-row-text' });
      text.innerHTML = renderInline(r.text || 'Item');
      return el('div', { class: `zen-row${r.done ? ' is-done' : ''}` }, check(r.done, r.text || 'Item', () => toggleNoteDone(it.id, r.id)), text);
    }));
}

const unpinBtn = (label, onclick) => el('button', { class: 'zen-unpin', type: 'button', title: 'Unpin from Zen', 'aria-label': `Unpin ${label} from Zen`,
  onclick: async (e) => { e.preventDefault(); e.stopPropagation(); await onclick(); render(); } }, icon('pin', 13));
const unpinNoteBtn = (it) => unpinBtn(it.title || it.text || 'card', () => setNotePinned(it.id, false));

function pinCard(it, key) {
  if (it.kind === 'todo') return listCard(it, { key, pinnedCard: true });
  if (it.kind === 'reminder') {
    return el('div', { class: `zen-list c-${it.color || 'none'}`, draggable: 'true', dataset: { key } },
      el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: 'Reminder' }), unpinNoteBtn(it)),
      reminderRow(it));
  }
  const body = el('div', { class: 'zen-note-md' });
  body.innerHTML = renderMarkdown(it.body || '');
  return el('div', { class: `zen-list zen-note c-${it.color || 'none'}`, draggable: 'true', dataset: { key } },
    el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: it.title || 'Untitled note' }), unpinNoteBtn(it)),
    (it.body || '').trim() ? body : null);
}

const FROM_LABEL = { collection: 'Pinned from a collection', library: 'Pinned from the Library', myspace: 'Pinned from My Space', zen: 'Pinned in Zen' };

function linkPin(p, key) {
  return el('div', { class: 'zen-pinlink', draggable: 'true', dataset: { key, from: p.from } },
    linkRow({ url: p.url, title: p.title }), unpinBtn(p.title || p.url, () => unpinZenItem(p.id)));
}

const FOLDER_SHOW = 8;
async function folderPin(p, key) {
  let node = null;
  try { [node] = await chrome.bookmarks.getSubTree(p.bmId); } catch { node = null; }
  const links = (node?.children || []).filter((n) => n.url);
  const head = el('div', { class: 'zen-list-head', title: FROM_LABEL[p.from] || '' },
    el('span', { class: 'zen-folder-ic', 'aria-hidden': 'true' }, icon('folder', 14)),
    el('span', { class: 'zen-list-title', text: node?.title || p.title || 'Folder' }),
    links.length ? el('span', { class: 'zen-list-n', text: String(links.length) }) : null,
    links.length > 1 ? el('button', { class: 'zen-unpin', type: 'button', title: 'Open all in background tabs', 'aria-label': 'Open all in background tabs',
      onclick: async () => { for (const n of links) await chrome.tabs.create({ url: n.url, active: false }); } }, icon('external', 13)) : null,
    unpinBtn(node?.title || p.title || 'folder', () => unpinZenItem(p.id)));
  const body = !node
    ? [quiet('This folder is no longer in your bookmarks.')]
    : links.length
      ? [...links.slice(0, FOLDER_SHOW).map((n) => linkRow(n)),
        links.length > FOLDER_SHOW ? el('p', { class: 'zen-more', text: `+ ${links.length - FOLDER_SHOW} more in the Library` }) : null]
      : [quiet('No links in this folder.')];
  return el('div', { class: 'zen-list zen-folder', draggable: 'true', dataset: { key } }, head, ...body);
}
