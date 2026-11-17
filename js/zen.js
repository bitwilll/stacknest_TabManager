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
import { getKey, setKey, update } from './store.js';
import { SPACES_KEY, ACTIVE_WS_KEY, WORKSPACES_KEY, loadActiveSpaces } from './spacesStore.js';
import { NOTES_KEY, loadNotes, toggleNoteDone, addQuickReminder, setNotePinned } from './notes.js';
import { SETTINGS_KEY, loadSettings, saveSettings } from './settings.js';
import { WALLPAPERS, WALLPAPER_KEY, wallpaperFor, ownWallpapers } from './wallpapers.js';
import { ZENPINS_KEY, ZENLAYOUT_KEY, loadZenPins, unpinZenItem, zenPinBtn } from './zenpins.js';
import { createCalendar } from './zencal.js';
import { createEyeRest } from './zenrest.js';
import { THOUGHTS_KEY, thoughtFor, normalizeThoughts } from './thoughts.js';
import { playChime } from './chime.js';
import { createArcade } from './arcade.js';
import { renderMarkdown, renderInline } from './markdown.js';

export const ZEN_KEY = 'stacknest:zen';
const PANES = ['col', 'todo', 'pinned'];
const ZEN_MIME = 'text/x-stacknest-zen';

let root, shell = null, clockTimer = null, renderTimer = null, lastFocus = null;
let layout = { panes: [...PANES], order: {}, cal: true, folded: [] };
let thoughtOffset = 0;
let thoughtPrefs = { fav: [], only: false };
let chimeOn = true;

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
  const folded = Array.isArray(raw?.folded) ? PANES.filter((p) => raw.folded.includes(p)) : [];   // panes folded to their header
  return { panes, order, cal: raw?.cal !== false, folded };
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
    if (root.classList.contains('is-peek')) { e.preventDefault(); setPeek(false); return; }   // and brings the page back from a peek
    if (root.dataset.page === 'arcade' && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      if (!shell.arcade.escape()) setPage('home');     // a game goes back to the shelf, the shelf back to Zen
      return;
    }
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
    if (typing) { document.activeElement.blur(); return; }   // first Esc leaves the field, the next leaves Zen
    if (document.querySelector('.modal-scrim')) return;       // a dialog owns Escape while it is up
    setZen(false);
  });
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !isOn()) return;
    if (c[NOTES_KEY] || c[SPACES_KEY] || c[ACTIVE_WS_KEY] || c[WORKSPACES_KEY] || c[SETTINGS_KEY] || c[WALLPAPER_KEY]
      || c[ZENPINS_KEY] || c[ZENLAYOUT_KEY] || c[THOUGHTS_KEY]) scheduleRender();
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
    setPeek(false, { focus: false });
    setPage('home', { focus: false });
    if (focus) (lastFocus?.isConnected ? lastFocus : document.getElementById('zen-btn'))?.focus?.({ preventScroll: true });
  }
}

/* ————————————————————————— shell (built once) ————————————————————————— */

function buildShell(openSettings) {
  const time = el('div', { class: 'zen-time', 'aria-live': 'off' });
  const date = el('div', { class: 'zen-date' });
  const greet = el('div', { class: 'zen-greet' });

  // the thought for the day, across the top
  // the thought for the day, across the top: star the ones worth keeping, and show only those
  const thoughtText = el('blockquote', { class: 'zen-thought-text' });
  const thoughtBy = el('figcaption', { class: 'zen-thought-by' });
  const saveThoughts = (patch) => update(THOUGHTS_KEY, null, (cur) => { thoughtPrefs = normalizeThoughts({ ...normalizeThoughts(cur), ...patch }); return thoughtPrefs; }).then(paintThought);
  const thoughtStar = el('button', { class: 'zen-thought-btn zen-thought-star', type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      const text = shell.thoughtText.textContent;
      const fav = thoughtPrefs.fav.includes(text) ? thoughtPrefs.fav.filter((x) => x !== text) : [...thoughtPrefs.fav, text];
      saveThoughts({ fav, only: thoughtPrefs.only && fav.length > 0 });
    } }, icon('star', 14));
  const thoughtNext = el('button', { class: 'zen-thought-btn', type: 'button', title: 'Another thought', 'aria-label': 'Show another thought',
    onclick: () => { thoughtOffset += 1; paintThought(); } }, icon('reset', 13));
  const thoughtOnly = el('button', { class: 'zen-thought-only', type: 'button', 'aria-pressed': 'false', hidden: '',
    onclick: () => { thoughtOffset = 0; saveThoughts({ only: !thoughtPrefs.only }); } }, icon('star', 11), el('span', { class: 'zen-thought-n' }));
  const thought = el('figure', { class: 'zen-thought' }, el('span', { class: 'zen-thought-mark', 'aria-hidden': 'true' }, icon('quote', 18)),
    el('div', { class: 'zen-thought-body' }, thoughtText, thoughtBy),
    el('div', { class: 'zen-thought-acts' }, thoughtStar, thoughtNext, thoughtOnly));

  const exit = el('button', { class: 'zen-btn-pill', type: 'button', title: 'Leave Zen (Esc)', onclick: () => setZen(false) },
    icon('close', 14), el('span', { text: 'Leave zen' }));
  // the wallpaper button shuffles: each press the next scene from a shuffled deck (and your own
  // image, if you set one), crossfading, its name shown a moment. Shift-click or right-click
  // opens every wallpaper in Settings.
  const wallName = el('span', { class: 'zen-wall-name', 'aria-live': 'polite' });
  const wallBtn = el('button', { class: 'zen-icb zen-wall-btn', type: 'button', title: 'Next wallpaper (Shift-click for all)', 'aria-label': 'Next wallpaper',
    onclick: (e) => { if (e.shiftKey) { setZen(false); openSettings('set-zen'); return; } const b = e.currentTarget; b.classList.remove('is-spin'); void b.offsetWidth; b.classList.add('is-spin'); shuffleWallpaper(wallName); },
    oncontextmenu: (e) => { e.preventDefault(); setZen(false); openSettings('set-zen'); } }, icon('wallShuffle', 19), wallName);
  // eye rest: the pill is itself the switch: eye icon, what it is doing (minutes to the next
  // pause, or off) and a little track whose knob slides over when it is on
  const eyeLabel = el('span', { class: 'zen-eye-label', text: 'Eye rest' });
  const eyeBtn = el('button', { class: 'zen-btn-pill zen-eye', type: 'button', role: 'switch', 'aria-checked': 'false',
    onclick: () => {
      const on = eyeBtn.getAttribute('aria-checked') !== 'true';
      paintEye(on, null);   // flip at once; the saved setting confirms it on the next render
      saveSettings({ zenEyeRest: on });
    } },
  el('span', { class: 'zen-eye-ic', 'aria-hidden': 'true' }, icon('eye', 15)), eyeLabel,
  el('span', { class: 'zen-eye-track', 'aria-hidden': 'true' }, el('span', { class: 'zen-eye-knob' })));
  let eyeMins = null;
  function paintEye(on, mins) {
    if (mins != null) eyeMins = mins;
    eyeBtn.setAttribute('aria-checked', String(on));
    eyeBtn.classList.toggle('is-on', on);
    eyeLabel.textContent = on ? (eyeMins != null ? `Eye rest · ${eyeMins} min` : 'Eye rest on') : 'Eye rest off';
    eyeBtn.title = on ? `Eye rest is on: a 30-second pause after ${eyeMins ?? 30} more min in Zen. Click to turn off.` : 'Eye rest is off. Click for a 30-second pause every 30 minutes in Zen.';
    eyeBtn.setAttribute('aria-label', on ? `Eye rest, on, next pause in ${eyeMins ?? 30} minutes` : 'Eye rest, off');
  }

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
  // each pane folds to its header (like the calendar), remembered in the Zen layout
  const fold = (id, name) => el('button', { class: 'zen-fold', type: 'button', 'aria-expanded': 'true', 'aria-controls': `zen-pane-${id}-body`,
    title: `Fold ${name}`, 'aria-label': `Fold the ${name} pane`,
    onclick: () => saveLayout({ folded: layout.folded.includes(id) ? layout.folded.filter((x) => x !== id) : [...layout.folded, id] }).then(paintFolds) }, icon('chevron', 13));
  const pane = (id, name, head, ...body) => el('section', { class: `zen-pane zen-${id}`, dataset: { key: id }, 'aria-label': name },
    el('header', { class: 'zen-pane-head' }, el('span', { class: 'zen-cap' }, el('span', { text: name.toLowerCase() }), el('span', { class: 'zen-cap-acts' }, fold(id, name), grip(name))), ...head),
    el('div', { class: 'zen-pane-body', id: `zen-pane-${id}-body` }, ...body));
  const panes = {
    col: pane('col', 'Collection', [pick, colCount, openAll], colBody),
    todo: pane('todo', 'To-do', [el('h2', { class: 'zen-h', text: 'To-do' }), todoCount], el('div', { class: 'zen-addrow' }, icon('plus', 15), add), todoBody),
    pinned: pane('pinned', 'Pinned', [el('h2', { class: 'zen-h', text: 'Pinned' }), pinCount], pinBody),
  };
  const grid = el('main', { class: 'zen-grid' }, ...layout.panes.map((p) => panes[p]));

  const cal = createCalendar({ onToggle: (open) => { saveLayout({ cal: open }); shell.cal2?.render(null, open); }, onAdd: async (text, at) => { await addQuickReminder(text, at); render(); } });
  const rest = createEyeRest({
    isActive: isOn,
    onDone: () => { if (chimeOn) playChime(); },   // a soft bell when the pause is over
    onStatus: (on, mins) => {
      paintEye(on, mins);
    },
  });

  // page two: a blank Zen page with a clock, Leave zen and the arcade frame
  const arcade = createArcade({
    isPaused: () => !isOn() || root.dataset.page !== 'arcade' || document.hidden || rest.isShowing(),
    onShelf: () => shell && paintPager(),
    todos: { list: topTodos, tick: (it) => toggleNoteDone(it.id, it.rowId || null, true).then(render), focus: focusTodo },
  });
  const aTime = el('div', { class: 'zen-a-time' });
  const aDate = el('div', { class: 'zen-a-date' });
  // the same calendar sits beside the games (a second view of it; folding either folds both)
  const cal2 = createCalendar({ onToggle: (open) => { saveLayout({ cal: open }); shell.cal.render(null, open); },
    onAdd: async (text, at) => { await addQuickReminder(text, at); render(); } });
  const arcadePage = el('section', { class: 'zen-arcade', 'aria-label': 'Arcade' },
    el('header', { class: 'zen-a-bar' },
      el('button', { class: 'zen-btn-pill', type: 'button', title: 'Leave Zen', onclick: () => setZen(false) }, icon('close', 14), el('span', { text: 'Leave zen' }))),
    el('div', { class: 'zen-a-stage' },
      el('aside', { class: 'zen-a-side' }, el('div', { class: 'zen-a-clock' }, aTime, aDate), cal2.node),
      arcade.node));

  // the little switch at the bottom centre: Zen ↔ Arcade
  // the little switch at the bottom centre: Zen · Arcade · Lounge (the arcade page, on its lounge shelf)
  const pageBtn = (id, label, ic, go) => el('button', { class: 'zen-page-btn', type: 'button', dataset: { page: id }, 'aria-pressed': 'false',
    onclick: go }, icon(ic, 14), el('span', { text: label }));
  const pager = el('nav', { class: 'zen-pager', 'aria-label': 'Zen pages' },
    pageBtn('home', 'Zen', 'zen', () => setPage('home')),
    pageBtn('arcade', 'Arcade', 'gamepad', () => { arcade.showShelf('games'); setPage('arcade'); }),
    pageBtn('lounge', 'Lounge', 'lounge', () => { arcade.showShelf('lounge'); setPage('arcade'); }));

  // the wallpaper on its own layer (so it can breathe), and the motion laid over it: a fixed
  // handful of specks the stylesheet turns into stars, fireflies, petals or leaves per wallpaper
  const fx = el('div', { class: 'zen-fx', 'aria-hidden': 'true' });
  for (let i = 0; i < 22; i++) {
    const r = (n) => ((Math.sin((i + 1) * n * 12.9898) * 43758.5453) % 1 + 1) % 1;   // a fixed scatter, same every load
    fx.append(el('i', { style: `--x:${(r(1) * 100).toFixed(1)}%;--y:${(r(2) * 100).toFixed(1)}%;--d:${(-r(3) * 20).toFixed(1)}s;--t:${(14 + r(4) * 14).toFixed(1)}s;--s:${(0.6 + r(5) * 0.9).toFixed(2)}` }));
  }

  // the corner button: everything else fades to a fifth so the wallpaper can be seen; Esc (or the
  // button again) brings it all back
  const peekHint = el('span', { class: 'zen-peek-hint', 'aria-hidden': 'true', text: 'Esc to come back' });
  const peekBtn = el('button', { class: 'zen-icb zen-peek', type: 'button', 'aria-pressed': 'false', title: 'Look at the wallpaper', 'aria-label': 'Look at the wallpaper',
    onclick: () => setPeek(!root.classList.contains('is-peek')) }, icon('wallWindow', 19), peekHint);

  root.replaceChildren(
    el('div', { class: 'zen-wall', 'aria-hidden': 'true' }),
    fx,
    el('div', { class: 'zen-veil', 'aria-hidden': 'true' }),
    el('header', { class: 'zen-bar' }, thought, el('div', { class: 'zen-tools' }, eyeBtn, wallBtn, exit)),
    el('div', { class: 'zen-stage' },
      el('aside', { class: 'zen-side' },
        el('div', { class: 'zen-clock' }, time, el('div', { class: 'zen-sub' }, greet, el('span', { class: 'zen-dot', 'aria-hidden': 'true', text: '·' }), date)),
        cal.node),
      grid),
    arcadePage,
    pager,
    peekBtn,
    rest.node,
  );

  // drag (or Alt+arrow) to arrange: the panes, and the items inside each pane
  sortable(grid, { item: '.zen-pane', handle: '.zen-grip', onSort: (keys) => saveLayout({ panes: keys }) });
  sortable(colBody, { item: '.zen-linkrow', onSort: (keys) => shell.colKey && saveLayout({ order: { [shell.colKey]: keys } }) });
  sortable(todoBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { todo: keys } }) });
  sortable(pinBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { pinned: keys } }) });

  shell = { peekBtn, cal2, arcade, aTime, aDate, pager, time, date, greet, exit, pick, colCount, openAll, colBody, todoCount, todoBody, pinCount, pinBody, thoughtText, thoughtBy, thoughtStar, thoughtOnly, grid, panes, cal, rest, colKey: null };
  paintThought();
  setPage('home', { focus: false });
}

// a peek at the wallpaper: the page fades to 20% and can't be clicked or tabbed into; only the
// corner button stays lit (and keeps focus)
function setPeek(on, { focus = true } = {}) {
  if (!shell?.peekBtn) return;
  const b = shell.peekBtn;
  root.classList.toggle('is-peek', on);
  for (const n of root.querySelectorAll(':scope > .zen-bar, :scope > .zen-stage, :scope > .zen-pager')) n.inert = on;
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Back to Zen (Esc)' : 'Look at the wallpaper';
  b.setAttribute('aria-label', on ? 'Back to Zen' : 'Look at the wallpaper');
  if (on && focus) b.focus({ preventScroll: true });
}

// the fold state of each pane, from the layout
function paintFolds() {
  for (const [id, node] of Object.entries(shell?.panes || {})) {
    const folded = layout.folded.includes(id);
    node.classList.toggle('is-folded', folded);
    node.querySelector(':scope > .zen-pane-body').hidden = folded;
    const b = node.querySelector('.zen-fold'), name = node.getAttribute('aria-label');
    b.setAttribute('aria-expanded', String(!folded));
    b.title = folded ? `Unfold ${name}` : `Fold ${name}`;
    b.setAttribute('aria-label', `${folded ? 'Unfold' : 'Fold'} the ${name} pane`);
  }
}

function paintPager() {
  const page = root.dataset.page, where = page === 'arcade' ? (shell.arcade.shelf === 'lounge' ? 'lounge' : 'arcade') : 'home';
  for (const b of shell.pager.children) b.setAttribute('aria-pressed', String(b.dataset.page === where));
}

function setPage(page, { focus = true } = {}) {
  const was = root.dataset.page;
  if (page !== 'home') setPeek(false, { focus: false });
  root.dataset.page = page;
  paintPager();
  if (page !== 'arcade') shell.arcade.stop();
  root.scrollTop = 0;
  if (focus && was !== page) requestAnimationFrame(() => (page === 'arcade' ? shell.arcade.focus() : shell.pager.children[0].focus({ preventScroll: true })));
}

let thoughtDay = '';
function paintThought() {
  const t = thoughtFor(thoughtOffset, thoughtPrefs);
  shell.thoughtText.textContent = t.text;
  shell.thoughtBy.textContent = t.by ? `— ${t.by}` : '';
  shell.thoughtBy.hidden = !t.by;
  const starred = thoughtPrefs.fav.includes(t.text);
  shell.thoughtStar.setAttribute('aria-pressed', String(starred));
  shell.thoughtStar.title = starred ? 'Starred — click to unstar' : 'Star this thought';
  shell.thoughtStar.setAttribute('aria-label', starred ? 'Unstar this thought' : 'Star this thought');
  const n = thoughtPrefs.fav.length;
  shell.thoughtOnly.hidden = !n;
  shell.thoughtOnly.setAttribute('aria-pressed', String(thoughtPrefs.only));
  shell.thoughtOnly.querySelector('.zen-thought-n').textContent = thoughtPrefs.only ? `Starred only · ${n}` : `${n} starred`;
  shell.thoughtOnly.title = thoughtPrefs.only ? 'Showing only starred thoughts. Click to show all.' : 'Show only starred thoughts';
  thoughtDay = new Date().toDateString();
}

function tick() {
  const d = new Date();
  // the numerals large and AM/PM small beside them, so the time always fits on one line
  const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const period = parts.filter((p) => p.type === 'dayPeriod').map((p) => p.value).join('');
  const digits = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  shell.time.replaceChildren(el('span', { class: 'zen-hm', text: digits }), period ? el('span', { class: 'zen-ampm', text: period }) : null);
  shell.time.setAttribute('aria-label', d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  shell.date.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const h = d.getHours();
  shell.aTime.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  shell.aDate.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  shell.greet.textContent = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  if (d.toDateString() !== thoughtDay) { thoughtOffset = 0; paintThought(); }   // a new day brings a new thought
}

/* ————————————————————————— the next thing to do —————————————————————————
   After a game the arcade offers the top of the list: open reminders and unticked checklist
   rows, soonest due first, then pinned, then in the list's own order. Choosing one comes back
   here, to the home page, with that item lit up and its tick box focused. */

// the words as Zen itself shows them: rendered by the same inline renderer, then read back as text
// (links keep their label, <u> and emphasis drop their marks, a # or a bracket stays put)
const plainText = (s) => {
  const t = document.createElement('template');
  t.innerHTML = renderInline(String(s || ''));
  return t.content.textContent.replace(/\s+/g, ' ').trim();
};
function fmtDue(at) {
  const d = new Date(at), now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return at < now.getTime() ? `overdue · ${time}` : `today ${time}`;
  const tmw = new Date(now); tmw.setDate(now.getDate() + 1);
  if (d.toDateString() === tmw.toDateString()) return `tomorrow ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (at < now.getTime() ? ' · overdue' : '');
}
async function topTodos() {
  const items = await loadNotes();
  const now = Date.now();
  const out = [];
  items.forEach((it, order) => {
    const t = it.reminder?.at ? Date.parse(it.reminder.at) : NaN;
    const at = Number.isFinite(t) ? t : null;   // an unreadable date ('tomorrow' from an import) sorts as undated
    if (it.kind === 'reminder' && !it.done) out.push({ id: it.id, rowId: null, text: plainText(it.text) || 'Reminder', at, pinned: !!it.pinned, order });
    if (it.kind === 'todo') {
      (it.list || []).forEach((r, k) => {
        if (!r.done && plainText(r.text)) out.push({ id: it.id, rowId: r.id, text: plainText(r.text), from: plainText(it.title) || 'List', at, pinned: !!it.pinned, order: order + k / 1000 });
      });
    }
  });
  out.sort((a, b) => ((a.at ?? Infinity) - (b.at ?? Infinity)) || (Number(b.pinned) - Number(a.pinned)) || (a.order - b.order));
  return out.map((x) => ({ ...x, due: Number.isFinite(x.at) ? fmtDue(x.at) : '', overdue: Number.isFinite(x.at) && x.at < now }));
}
async function focusTodo(item) {
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  setPage('home', { focus: false });
  // the item has to be seen: open the panes it could be in
  const want = item ? ['todo', 'pinned'] : ['todo'];
  if (want.some((p) => layout.folded.includes(p))) await saveLayout({ folded: layout.folded.filter((p) => !want.includes(p)) });
  await render();
  let target = null;
  if (item) {
    const card = shell.pinBody.querySelector(`[data-key="n:${CSS.escape(item.id)}"]`) || shell.todoBody.querySelector(`[data-key="${CSS.escape(item.id)}"]`);
    target = (item.rowId && card?.querySelector(`[data-row="${CSS.escape(item.rowId)}"]`)) || card;
  }
  if (!target) {   // nothing to point at (or asked for a new one): the add box
    const add = shell.panes.todo.querySelector('.zen-add');
    shell.panes.todo.scrollIntoView({ block: 'nearest', behavior });
    flash(shell.panes.todo);
    add?.focus({ preventScroll: true });
    return;
  }
  target.scrollIntoView({ block: 'center', behavior });
  flash(target);
  (target.querySelector('.zen-check') || target).focus?.({ preventScroll: true });
}
let wallDeck = [], wallNameTimer = null;
async function shuffleWallpaper(nameEl) {
  const [settings, raw] = await Promise.all([loadSettings(), getKey(WALLPAPER_KEY, null)]);
  const own = ownWallpapers(raw);
  const ids = [...WALLPAPERS.map((w) => w.id), ...own.images.map((x) => `own:${x.id}`)];
  const now = settings.zenWallpaper === 'custom' ? `own:${own.active}` : settings.zenWallpaper;
  wallDeck = wallDeck.filter((id) => ids.includes(id));   // an image removed since stays out
  if (!wallDeck.length) wallDeck = ids.filter((id) => id !== now).sort(() => Math.random() - 0.5);
  const next = wallDeck.pop();
  if (!next) return;
  // the old scene fades away over the new one
  const old = root.querySelector('.zen-wall');
  if (old && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ghost = old.cloneNode();
    const cs = getComputedStyle(old);
    ghost.style.background = cs.background;
    ghost.style.transform = cs.transform;   // where its slow breathing had got to
    ghost.classList.add('zen-wall-ghost');
    old.after(ghost);
    ghost.addEventListener('animationend', () => ghost.remove());
    setTimeout(() => ghost.remove(), 1400);
  }
  if (next.startsWith('own:')) {   // one of your own: make it the active one, then show it
    const id = next.slice(4);
    if (own.active !== id) await setKey(WALLPAPER_KEY, { ...own, active: id });
    await saveSettings({ zenWallpaper: 'custom' });
    const n = own.images.findIndex((x) => x.id === id) + 1;
    nameEl.textContent = own.images.length > 1 ? `Yours ${n}` : 'Your image';
  } else {
    await saveSettings({ zenWallpaper: next });
    nameEl.textContent = WALLPAPERS.find((w) => w.id === next)?.label || '';
  }
  nameEl.classList.add('is-on');
  clearTimeout(wallNameTimer);
  wallNameTimer = setTimeout(() => nameEl.classList.remove('is-on'), 1600);
}
function flash(node) {
  node.classList.remove('zen-flash');
  void node.offsetWidth;   // restart the animation
  node.classList.add('zen-flash');
  setTimeout(() => node.classList.remove('zen-flash'), 2600);
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
  const [settings, spaces, items, custom, pins, rawLayout, rawThoughts] = await Promise.all([
    loadSettings(), loadActiveSpaces(), loadNotes(), getKey(WALLPAPER_KEY, null), loadZenPins(), getKey(ZENLAYOUT_KEY, null), getKey(THOUGHTS_KEY, null)]);
  thoughtPrefs = normalizeThoughts(rawThoughts);
  paintThought();
  layout = normalizeLayout(rawLayout);
  paintFolds();

  // wallpaper + the ink that reads on it
  const wp = wallpaperFor(settings.zenWallpaper, custom);
  root.style.setProperty('--zen-wall', wp.css);
  root.dataset.tone = wp.tone;
  root.dataset.motion = settings.zenMotion ? wp.motion : 'none';
  shell.rest.setEnabled(settings.zenEyeRest);
  chimeOn = settings.reminderChime;

  // panes in the saved order (moved only when they are not, so a focused field keeps focus)
  const want = layout.panes.map((p) => shell.panes[p]);
  if (want.some((p, i) => shell.grid.children[i] !== p)) shell.grid.append(...want);

  shell.cal.render(items, layout.cal);
  shell.cal2.render(items, layout.cal);
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
      return el('div', { class: `zen-row${r.done ? ' is-done' : ''}`, dataset: { row: r.id } }, check(r.done, r.text || 'Item', () => toggleNoteDone(it.id, r.id)), text);
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
