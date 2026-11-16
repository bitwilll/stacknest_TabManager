// Zen — the uncluttered page. One switch beside the theme segment hides the whole workspace
// (sidebar, top bar, tab strip, board) and leaves, on a wallpaper:
//
//   a clock and the date        what time it is, and nothing else up top
//   one collection              chosen right here, remembered in settings (zenCollection)
//   To-do                       open reminders and unfinished checklists — tick, or add one
//   Pinned                      any card pinned from Notes (note, list or reminder)
//
// On/off lives in localStorage like the theme (boot.js puts data-zen on <html> before first
// paint, so a new tab opened in Zen never flashes the board). The wallpaper is a setting
// (Settings → Zen), so it travels with a backup; a custom image stays on this device.

import { el, icon, tile, domainOf } from './ui.js';
import { getKey } from './store.js';
import { SPACES_KEY, ACTIVE_WS_KEY, WORKSPACES_KEY, loadActiveSpaces } from './spacesStore.js';
import { NOTES_KEY, loadNotes, toggleNoteDone, addQuickReminder, setNotePinned } from './notes.js';
import { SETTINGS_KEY, loadSettings, saveSettings } from './settings.js';
import { WALLPAPER_KEY, wallpaperFor } from './wallpapers.js';
import { renderMarkdown, renderInline } from './markdown.js';

export const ZEN_KEY = 'stacknest:zen';

let root, shell = null, clockTimer = null, renderTimer = null, lastFocus = null;

const isOn = () => document.documentElement.dataset.zen === 'on';

export function initZen({ root: r, openSettings }) {
  root = r;
  buildShell(openSettings);
  for (const b of document.querySelectorAll('[data-zen-toggle]')) b.addEventListener('click', () => setZen(!isOn()));
  document.addEventListener('keydown', (e) => {
    if (!isOn() || e.key !== 'Escape') return;
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
    if (typing) { document.activeElement.blur(); return; }   // first Esc leaves the field, the next leaves Zen
    if (document.querySelector('.modal-scrim')) return;       // a dialog owns Escape while it is up
    setZen(false);
  });
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !isOn()) return;
    if (c[NOTES_KEY] || c[SPACES_KEY] || c[ACTIVE_WS_KEY] || c[WORKSPACES_KEY] || c[SETTINGS_KEY] || c[WALLPAPER_KEY]) scheduleRender();
  });
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
  } else if (focus) {
    (lastFocus?.isConnected ? lastFocus : document.getElementById('zen-btn'))?.focus?.({ preventScroll: true });
  }
}

/* ————————————————————————— shell (built once) ————————————————————————— */

function buildShell(openSettings) {
  const time = el('div', { class: 'zen-time', 'aria-live': 'off' });
  const date = el('div', { class: 'zen-date' });
  const greet = el('div', { class: 'zen-greet' });

  const exit = el('button', { class: 'zen-btn-pill', type: 'button', title: 'Leave Zen (Esc)', onclick: () => setZen(false) },
    icon('close', 14), el('span', { text: 'Leave zen' }));
  const wallBtn = el('button', { class: 'zen-icb', type: 'button', title: 'Choose wallpaper', 'aria-label': 'Choose wallpaper',
    onclick: () => { setZen(false); openSettings('set-zen'); } }, icon('image', 16));

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

  const pane = (cls, head, ...body) => el('section', { class: `zen-pane ${cls}` }, el('header', { class: 'zen-pane-head' }, ...head), ...body);

  root.replaceChildren(
    el('div', { class: 'zen-veil', 'aria-hidden': 'true' }),
    el('header', { class: 'zen-bar' },
      el('div', { class: 'zen-clock' }, time, el('div', { class: 'zen-sub' }, greet, el('span', { class: 'zen-dot', 'aria-hidden': 'true', text: '·' }), date)),
      el('div', { class: 'zen-tools' }, wallBtn, exit)),
    el('main', { class: 'zen-grid' },
      pane('zen-col', [el('span', { class: 'zen-cap', text: 'collection' }), pick, colCount, openAll], colBody),
      pane('zen-todo', [el('span', { class: 'zen-cap', text: 'to-do' }), el('h2', { class: 'zen-h', text: 'To-do' }), todoCount],
        el('div', { class: 'zen-addrow' }, icon('plus', 15), add), todoBody),
      pane('zen-pinned', [el('span', { class: 'zen-cap', text: 'pinned' }), el('h2', { class: 'zen-h', text: 'Pinned' }), pinCount], pinBody)),
  );
  shell = { time, date, greet, exit, pick, colCount, openAll, colBody, todoCount, todoBody, pinCount, pinBody };
}

function tick() {
  const d = new Date();
  shell.time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  shell.date.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const h = d.getHours();
  shell.greet.textContent = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}

/* ————————————————————————— render ————————————————————————— */

function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 60); }

export async function render() {
  if (!shell || !isOn()) return;
  const [settings, spaces, items, custom] = await Promise.all([loadSettings(), loadActiveSpaces(), loadNotes(), getKey(WALLPAPER_KEY, null)]);

  // wallpaper + the ink that reads on it
  const wp = wallpaperFor(settings.zenWallpaper, custom);
  root.style.setProperty('--zen-wall', wp.css);
  root.dataset.tone = wp.tone;

  renderCollection(spaces, settings.zenCollection);

  // a focused field in Zen (the add box) is never rebuilt, so only the lists are refilled
  const pinned = items.filter((i) => i.pinned);
  const open = items.filter((i) => !i.pinned && (
    (i.kind === 'reminder' && !i.done) || (i.kind === 'todo' && (i.list || []).some((r) => !r.done))));
  const openRows = open.reduce((n, i) => n + (i.kind === 'reminder' ? (i.done ? 0 : 1) : i.kind === 'todo' ? (i.list || []).filter((r) => !r.done).length : 0), 0);
  shell.todoCount.textContent = openRows ? `${openRows} open` : '';
  const reminders = open.filter((i) => i.kind === 'reminder');
  const lists = open.filter((i) => i.kind === 'todo');
  shell.todoBody.replaceChildren(...(open.length
    ? [...(reminders.length ? [el('div', { class: 'zen-rems' }, ...reminders.map(reminderRow))] : []), ...lists.map((l) => listCard(l))]
    : [quiet('Nothing open. Add a to-do above — it lands in Notes too.')]));

  shell.pinCount.textContent = pinned.length ? String(pinned.length) : '';
  shell.pinBody.replaceChildren(...(pinned.length ? pinned.map((p) => pinCard(p))
    : [quiet('Pin any note, list or reminder from Notes — the pin on its card — and it waits here.')]));
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
  colBody.replaceChildren(...(tabs.length ? tabs.map((t) => linkRow(t))
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

function reminderRow(it) {
  const text = el('span', { class: 'zen-row-text' });
  text.innerHTML = renderInline(it.text || 'Reminder');
  return el('div', { class: `zen-row${it.done ? ' is-done' : ''}` }, check(it.done, it.text || 'Reminder', () => toggleNoteDone(it.id)), text, dueChip(it));
}

function dueChip(it) {
  if (!it.reminder?.at) return null;
  const at = new Date(it.reminder.at);
  const past = at.getTime() <= Date.now();
  return el('span', { class: `zen-due${past ? ' past' : ''}` }, icon('bell', 10),
    el('span', { text: at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
}

function listCard(it, { pinnedCard = false } = {}) {
  const rows = it.list || [];
  const done = rows.filter((r) => r.done).length;
  return el('div', { class: `zen-list c-${it.color || 'none'}` },
    el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: it.title || 'Untitled list' }),
      rows.length ? el('span', { class: 'zen-list-n', text: `${done}/${rows.length}` }) : null,
      pinnedCard ? unpinBtn(it) : null),
    ...rows.map((r) => {
      const text = el('span', { class: 'zen-row-text' });
      text.innerHTML = renderInline(r.text || 'Item');
      return el('div', { class: `zen-row${r.done ? ' is-done' : ''}` }, check(r.done, r.text || 'Item', () => toggleNoteDone(it.id, r.id)), text);
    }));
}

function unpinBtn(it) {
  return el('button', { class: 'zen-unpin', type: 'button', title: 'Unpin from Zen', 'aria-label': `Unpin ${it.title || it.text || 'card'} from Zen`,
    onclick: async () => { await setNotePinned(it.id, false); render(); } }, icon('pin', 13));
}

function pinCard(it) {
  if (it.kind === 'todo') return listCard(it, { pinnedCard: true });
  if (it.kind === 'reminder') {
    return el('div', { class: `zen-list c-${it.color || 'none'}` },
      el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: 'Reminder' }), unpinBtn(it)),
      reminderRow(it));
  }
  const body = el('div', { class: 'zen-note-md' });
  body.innerHTML = renderMarkdown(it.body || '');
  return el('div', { class: `zen-list zen-note c-${it.color || 'none'}` },
    el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: it.title || 'Untitled note' }), unpinBtn(it)),
    (it.body || '').trim() ? body : null);
}
