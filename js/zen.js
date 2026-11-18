// Zen — the uncluttered page. One switch beside the theme segment hides the whole workspace
// (sidebar, top bar, tab strip, board) and leaves, on a wallpaper:
//
//   a thought for the day       across the top, with a button for another
//   the clock and the date      on the side, with a month calendar under them (folds away)
//   one collection              chosen right here, remembered in settings (zenCollection)
//   To-do                       open reminders and unfinished checklists — tick, or add one
//   Pinned                      anything pinned to Zen: Notes cards, whole collections, plus links
//                               and folders from Collections, the Library and My Space (js/zenpins.js)
//   Quick note                  the top-right corner: hover (or click) and a small box drops down
//                               to jot a note into Notes
//
// Notes cards edit in place here as they do in the Notes view: click a reminder, a list's title
// or row, or a note to type; Enter adds the next row; the bell sets a time; the bin deletes (with
// Undo). A field being typed in is never rebuilt under the caret: a render that would replace it
// waits until the field is left (see "TYPING IS SACRED" in js/notes.js).
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
import { SPACES_KEY, ACTIVE_WS_KEY, WORKSPACES_KEY, DOT_COLORS, loadSpaces, loadActiveSpaces } from './spacesStore.js';
import { NOTES_KEY, KIND_LABEL, loadNotes, toggleNoteDone, addQuickReminder, setNotePinned, saveNoteField, flushNoteSaves,
  addNoteRow, removeNoteRow, openNoteReminder, deleteNoteCard, addQuickNote } from './notes.js';
import { listContinuation, replaceText } from './format.js';
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
let renderPending = false;   // a render held back while a card's field was being typed in

const isOn = () => document.documentElement.dataset.zen === 'on';
// a Notes field being typed in, here in Zen (every one carries data-edit)
const editingField = () => {
  const a = document.activeElement;
  return !!(a && root?.contains(a) && a.matches?.('[data-edit]'));
};

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
    if (shell.qn.isOpen()) { e.preventDefault(); shell.qn.close({ focus: true }); return; }   // and folds the quick note away
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
  // leaving a card's field saves what was typed, then lets a held-back render through
  root.addEventListener('focusout', (e) => {
    if (!e.target.matches?.('[data-edit]')) return;
    flushNoteSaves().then(() => setTimeout(() => { if (renderPending && !editingField()) render(); }, 0));
  });
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
    shell.qn.close();
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
  const qn = createQuickNote();
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
    el('header', { class: 'zen-bar' }, thought, el('div', { class: 'zen-tools' }, eyeBtn, wallBtn, exit, qn.node)),
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

  shell = { peekBtn, cal2, arcade, aTime, aDate, pager, time, date, greet, exit, qn, pick, colCount, openAll, colBody, todoCount, todoBody, pinCount, pinBody, thoughtText, thoughtBy, thoughtStar, thoughtOnly, grid, panes, cal, rest, colKey: null };
  paintThought();
  setPage('home', { focus: false });
}

/* ————————————————————————— the quick-note corner —————————————————————————
   A note button at the top-right corner. Hovering it drops a small panel down (a peek) with one
   box to jot a note into Notes; nothing else, so other notes stay out of sight. Moving the
   pointer away folds it up again after a moment, unless the box has focus (you are typing) or
   it was opened with a click; then a click outside, Esc, or the button again folds it. A
   half-written note stays in the box (and on this device) until it is saved. */
const QN_DRAFT = 'stacknest:zen-quicknote';

function createQuickNote() {
  let hover = false, held = false, hideTimer = null;
  const draft = { get: () => { try { return localStorage.getItem(QN_DRAFT) || ''; } catch { return ''; } },
    set: (v) => { try { if (v) localStorage.setItem(QN_DRAFT, v); else localStorage.removeItem(QN_DRAFT); } catch { /* kept in the box only */ } } };

  const input = el('textarea', { class: 'zen-qn-in', rows: '3', placeholder: 'Jot a note…', 'aria-label': 'Quick note', spellcheck: 'true' });
  input.value = draft.get();
  const saved = el('span', { class: 'zen-qn-saved', 'aria-live': 'polite' });
  const save = async () => {
    const v = input.value;
    if (!v.trim()) { input.focus(); return; }
    input.value = ''; draft.set('');
    await addQuickNote(v);
    saved.textContent = 'Saved to Notes';
    saved.classList.remove('is-on'); void saved.offsetWidth; saved.classList.add('is-on');
    input.focus({ preventScroll: true });
  };
  const saveBtn = el('button', { class: 'zen-qn-save', type: 'button', onclick: save }, icon('plus', 13), el('span', { text: 'Save' }));
  input.addEventListener('input', () => draft.set(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close({ focus: true }); return; }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing) { e.preventDefault(); save(); }
  });
  const pop = el('div', { class: 'zen-qn-pop', id: 'zen-qn-pop' },
    el('div', { class: 'zen-qn-card', role: 'group', 'aria-label': 'Quick note' },
      el('div', { class: 'zen-qn-head' }, el('span', { class: 'zen-qn-h', text: 'Quick note' }), saved),
      el('div', { class: 'zen-qn-box' }, input,
        el('div', { class: 'zen-qn-foot' }, el('span', { class: 'zen-qn-tip', text: 'Enter saves to Notes · Shift+Enter, new line' }), saveBtn))));
  const btn = el('button', { class: 'zen-icb zen-qn-btn', type: 'button', title: 'Quick note', 'aria-label': 'Quick note',
    'aria-expanded': 'false', 'aria-controls': 'zen-qn-pop',
    onclick: () => {
      if (held) { held = false; hover = false; paint(); return; }   // a second click folds it, even under the pointer
      held = true; paint();
      input.focus({ preventScroll: true });
    } }, icon('note', 18));
  const node = el('div', { class: 'zen-qn' }, btn, pop);

  const isOpen = () => node.classList.contains('is-open');
  function paint() {
    clearTimeout(hideTimer);
    const show = hover || held || pop.contains(document.activeElement);
    const apply = (on) => { node.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on)); };
    if (show) apply(true);
    else if (isOpen()) hideTimer = setTimeout(() => apply(false), 220);   // a moment's grace for a pointer that slips off
  }
  function close({ focus = false } = {}) {
    hover = false; held = false;
    clearTimeout(hideTimer);
    const inside = pop.contains(document.activeElement);
    node.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
    if (focus || inside) btn.focus({ preventScroll: true });   // focus never stays inside a folded panel
  }
  // hover is a mouse thing; a tap is a click
  node.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { hover = true; paint(); } });
  node.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') { hover = false; paint(); } });
  node.addEventListener('focusin', paint);
  node.addEventListener('focusout', () => setTimeout(paint, 0));
  document.addEventListener('pointerdown', (e) => { if (held && !node.contains(e.target)) { held = false; paint(); } }, true);
  return { node, isOpen, close };
}

// a peek at the wallpaper: the page fades to 20% and can't be clicked or tabbed into; only the
// corner button stays lit (and keeps focus)
function setPeek(on, { focus = true } = {}) {
  if (!shell?.peekBtn) return;
  const b = shell.peekBtn;
  if (on) shell.qn.close();
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
  if (page !== 'home') { setPeek(false, { focus: false }); shell.qn.close(); }
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
  } else {
    // a card moves from anywhere but its text fields, so a press in one selects text instead
    container.addEventListener('pointerdown', (e) => {
      const it = own(e.target);
      if (it?.hasAttribute('draggable')) it.draggable = !e.target.closest('input, textarea, select');
    });
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

// opts.force: rebuild even while a card's field has focus. Only for a change Zen itself just
// made (a row added or removed), after its typing was saved, so nothing on screen is newer
// than what is stored; the focused field and its caret are put back afterwards.
export async function render(opts) {
  const force = opts?.force === true;
  if (!shell || !isOn()) return;
  if (drag) { scheduleRender(); return; }   // never rebuild a list under a drag
  if (!force && editingField()) { renderPending = true; return; }   // never under the caret either
  const [settings, spaces, items, custom, pins, rawLayout, rawThoughts, allSpaces] = await Promise.all([
    loadSettings(), loadActiveSpaces(), loadNotes(), getKey(WALLPAPER_KEY, null), loadZenPins(), getKey(ZENLAYOUT_KEY, null), getKey(THOUGHTS_KEY, null), loadSpaces()]);
  if (!force && editingField()) { renderPending = true; return; }   // typing began while this was loading
  renderPending = false;
  const focus = snapshotFocus();
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
    ? todos.map((i) => (i.kind === 'reminder' ? reminderRow(i, { key: i.id, scope: 'todo' }) : listCard(i, { key: i.id, scope: 'todo' })))
    : [quiet('Nothing open. Add a to-do above — it lands in Notes too.')]));

  const pinned = arrange([
    ...pinnedNotes.map((n) => ({ key: `n:${n.id}`, note: n })),
    ...pins.map((p) => ({ key: `z:${p.id}`, pin: p })),
  ], (x) => x.key, layout.order.pinned, true);
  shell.pinCount.textContent = pinned.length ? String(pinned.length) : '';
  const cards = await Promise.all(pinned.map((x) => (x.note ? pinCard(x.note, x.key)
    : x.pin.kind === 'folder' ? folderPin(x.pin, x.key)
      : x.pin.kind === 'collection' ? collectionPin(x.pin, x.key, allSpaces, spaces)
        : linkPin(x.pin, x.key))));
  shell.pinBody.replaceChildren(...(cards.length ? cards
    : [quiet('Pin anything here: the pin on a Notes card, on a collection, or on any link in Collections, the Library or My Space. Links in the collection pane have one too.')]));
  restoreFocus(focus);
}

// Each editable field is named by data-edit = "<scope>|<card id>|<row id>|<field>" (scope: the
// pane, todo or pin), so focus and the caret can find their way back after a rebuild.
function snapshotFocus() {
  const a = document.activeElement;
  if (!a?.dataset?.edit || !root.contains(a)) return null;
  return { edit: a.dataset.edit, start: a.selectionStart, end: a.selectionEnd };
}
function restoreFocus(s) {
  if (!s || document.activeElement?.dataset?.edit === s.edit) return;
  const f = root.querySelector(`[data-edit="${CSS.escape(s.edit)}"]`);
  if (!f) return;
  f._edit?.();
  f.focus({ preventScroll: true });
  try { f.setSelectionRange(s.start ?? f.value.length, s.end ?? f.value.length); } catch { /* not a text field */ }
}
function focusEdit(key) {
  const f = root.querySelector(`[data-edit="${CSS.escape(key)}"]`);
  if (!f) return;
  f._edit?.();
  f.focus({ preventScroll: true });
  f.scrollIntoView({ block: 'nearest' });
  caretEnd(f);
}
const caretEnd = (f) => { try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* ignore */ } };
const editKey = (scope, it, rowId, field) => `${scope}|${it.id}|${rowId || ''}|${field}`;

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

/* ——— fields: rendered text at rest, a text box the moment you edit it ———
   The same deal as the Notes view (notes.js lineView): links and **marks** read as rendered
   text, a click (or Tab, then any key) drops into the source, leaving shows it rendered again.
   A click on a link follows the link. Esc leaves the field without leaving Zen. */
function stopEsc(e, field) {
  if (e.key !== 'Escape') return false;
  e.preventDefault(); e.stopPropagation();
  field.blur();
  return true;
}
function lineField({ key, value, placeholder, label, cls, onInput, onKey }) {
  const input = el('input', { class: 'zen-in', type: 'text', value: value || '', placeholder, 'aria-label': label,
    autocomplete: 'off', spellcheck: 'true', dataset: { edit: key } });
  const view = el('span', { class: `${cls} zen-view`, tabindex: '0', title: 'Click to edit' });
  const edit = () => { view.hidden = true; input.hidden = false; };
  const rest = () => {
    if (!input.value.trim()) { edit(); return; }   // an empty field keeps its placeholder on show
    view.innerHTML = renderInline(input.value);
    view.hidden = false; input.hidden = true;
  };
  input._edit = edit;
  input.addEventListener('input', () => onInput(input.value));
  input.addEventListener('keydown', (e) => { if (!stopEsc(e, input)) onKey?.(e, input); });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) rest(); }, 0));
  const go = () => { edit(); input.focus({ preventScroll: true }); caretEnd(input); };
  view.addEventListener('click', (e) => { if (!e.target.closest('a')) go(); });
  view.addEventListener('focus', () => { if (view.matches(':focus-visible')) go(); });   // reached by Tab, not by a click on a link
  rest();
  return el('span', { class: `zen-field ${cls}-field` }, input, view);
}
function areaField({ key, value, placeholder, label, onInput }) {
  const area = el('textarea', { class: 'zen-area', rows: '2', placeholder, 'aria-label': label, spellcheck: 'true', dataset: { edit: key } });
  area.value = value || '';
  const view = el('div', { class: 'zen-note-md zen-view', tabindex: '0', title: 'Click to edit' });
  const grow = () => { area.style.height = 'auto'; area.style.height = `${Math.min(area.scrollHeight, 320)}px`; };
  const edit = () => { view.hidden = true; area.hidden = false; requestAnimationFrame(grow); };
  const rest = () => {
    if (!area.value.trim()) { edit(); return; }
    view.innerHTML = renderMarkdown(area.value);
    view.hidden = false; area.hidden = true;
  };
  area._edit = edit;
  area.addEventListener('input', () => { grow(); onInput(area.value); });
  // Enter inside a markdown list continues it (next number, a fresh task box), as in Notes
  area.addEventListener('keydown', (e) => {
    if (stopEsc(e, area)) return;
    if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const c = listContinuation(area);
    if (!c) return;
    e.preventDefault();
    if (c.clear) replaceText(area, c.start, c.end, '');
    else replaceText(area, area.selectionStart, area.selectionEnd, c.insert);
  });
  area.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== area) rest(); }, 0));
  const go = () => { edit(); area.focus({ preventScroll: true }); caretEnd(area); };
  view.addEventListener('click', (e) => { if (!e.target.closest('a')) go(); });
  view.addEventListener('focus', () => { if (view.matches(':focus-visible')) go(); });
  rest();
  return el('div', { class: 'zen-field zen-area-field' }, area, view);
}

// A row was added or removed here: save the typing first (mutate does), rebuild at once, and
// put the caret where the next keystroke belongs
async function rowAdded(scope, it, afterRowId) {
  const id = await addNoteRow(it.id, afterRowId);
  await render({ force: true });
  focusEdit(editKey(scope, it, id, 'row'));
}
async function rowRemoved(scope, it, rowId, { stepBack = false } = {}) {
  const prev = await removeNoteRow(it.id, rowId);
  await render({ force: true });
  if (stepBack && prev) focusEdit(editKey(scope, it, prev, 'row'));
}

/* ——— a card's actions: shown on hover or focus, always on a touch screen ——— */
function cardActs(it) {
  const name = it.title || it.text || KIND_LABEL[it.kind] || 'card';
  return el('span', { class: 'zen-acts' },
    !it.reminder ? el('button', { class: 'zen-act', type: 'button', title: 'Set a reminder', 'aria-label': `Set a reminder for ${name}`,
      onclick: (e) => openNoteReminder(e.currentTarget, it.id) }, icon('bell', 13)) : null,
    el('button', { class: 'zen-act zen-act-del', type: 'button', title: `Delete ${KIND_LABEL[it.kind] || 'card'}`, 'aria-label': `Delete ${name}`,
      onclick: () => deleteNoteCard(it.id) }, icon('trash', 13)));
}

function reminderRow(it, { key = null, scope, acts = true } = {}) {
  const text = lineField({ key: editKey(scope, it, null, 'text'), value: it.text, placeholder: 'Reminder', label: 'Reminder', cls: 'zen-row-text',
    onInput: (v) => saveNoteField(it.id, 'text', v),
    onKey: (e, input) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } } });
  return el('div', { class: `zen-row${it.done ? ' is-done' : ''}${key ? ' zen-item' : ''}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    check(it.done, it.text || 'Reminder', () => toggleNoteDone(it.id)), text, dueChip(it), acts ? cardActs(it) : null);
}

// the reminder's time; a click changes it (or clears it) in the Notes view's own popover
function dueChip(it) {
  if (!it.reminder?.at) return null;
  const at = new Date(it.reminder.at);
  const past = at.getTime() <= Date.now();
  const when = at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return el('button', { class: `zen-due${past ? ' past' : ''}`, type: 'button', title: 'Change the reminder', 'aria-label': `Reminder ${when}. Change it`,
    onclick: (e) => openNoteReminder(e.currentTarget, it.id) }, icon('bell', 10), el('span', { text: when }));
}

function listCard(it, { key = null, pinnedCard = false, scope } = {}) {
  const rows = it.list || [];
  const done = rows.filter((r) => r.done).length;
  const title = lineField({ key: editKey(scope, it, null, 'title'), value: it.title, placeholder: 'List title', label: 'List title', cls: 'zen-list-title',
    onInput: (v) => saveNoteField(it.id, 'title', v),
    onKey: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (rows[0]) focusEdit(editKey(scope, it, rows[0].id, 'row')); else rowAdded(scope, it, null);
    } });
  const rowEls = rows.map((r) => el('div', { class: `zen-row${r.done ? ' is-done' : ''}`, dataset: { row: r.id } },
    check(r.done, r.text || 'Item', () => toggleNoteDone(it.id, r.id)),
    lineField({ key: editKey(scope, it, r.id, 'row'), value: r.text, placeholder: 'Item', label: 'List item', cls: 'zen-row-text',
      onInput: (v) => saveNoteField(it.id, `row:${r.id}`, v),
      // Enter: the next item under this one. Backspace in an empty one: remove it, step back up
      onKey: (e, input) => {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); rowAdded(scope, it, r.id); return; }
        if (e.key === 'Backspace' && !input.value && rows.length > 1) { e.preventDefault(); rowRemoved(scope, it, r.id, { stepBack: true }); }
      } }),
    el('button', { class: 'zen-act zen-row-x', type: 'button', title: 'Remove item', 'aria-label': `Remove ${r.text || 'this item'}`,
      onclick: () => rowRemoved(scope, it, r.id) }, icon('close', 12))));
  return el('div', { class: `zen-list c-${it.color || 'none'}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    el('div', { class: 'zen-list-head' }, title,
      rows.length ? el('span', { class: 'zen-list-n', text: `${done}/${rows.length}` }) : null,
      dueChip(it), cardActs(it), pinnedCard ? unpinNoteBtn(it) : null),
    ...rowEls,
    el('button', { class: 'zen-additem', type: 'button', onclick: () => rowAdded(scope, it, null) }, icon('plus', 12), el('span', { text: 'Add item' })));
}

// a note: its title and its markdown body
function noteCard(it, { key = null, scope, pinnedCard = false } = {}) {
  const title = lineField({ key: editKey(scope, it, null, 'title'), value: it.title, placeholder: 'Title', label: 'Note title', cls: 'zen-list-title',
    onInput: (v) => saveNoteField(it.id, 'title', v),
    onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); focusEdit(editKey(scope, it, null, 'body')); } } });
  const body = areaField({ key: editKey(scope, it, null, 'body'), value: it.body, placeholder: 'Write… (markdown works)', label: 'Note',
    onInput: (v) => saveNoteField(it.id, 'body', v) });
  return el('div', { class: `zen-list zen-note c-${it.color || 'none'}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    el('div', { class: 'zen-list-head' }, title, dueChip(it), cardActs(it), pinnedCard ? unpinNoteBtn(it) : null),
    body);
}

const unpinBtn = (label, onclick) => el('button', { class: 'zen-unpin', type: 'button', title: 'Unpin from Zen', 'aria-label': `Unpin ${label} from Zen`,
  onclick: async (e) => { e.preventDefault(); e.stopPropagation(); await onclick(); render(); } }, icon('pin', 13));
const unpinNoteBtn = (it) => unpinBtn(it.title || it.text || 'card', () => setNotePinned(it.id, false));

function pinCard(it, key) {
  if (it.kind === 'todo') return listCard(it, { key, pinnedCard: true, scope: 'pin' });
  if (it.kind === 'reminder') {
    return el('div', { class: `zen-list c-${it.color || 'none'}`, draggable: 'true', dataset: { key } },
      el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: 'Reminder' }), cardActs(it), unpinNoteBtn(it)),
      reminderRow(it, { scope: 'pin', acts: false }));
  }
  return noteCard(it, { key, scope: 'pin', pinnedCard: true });
}

const FROM_LABEL = { collection: 'Pinned from a collection', library: 'Pinned from the Library', myspace: 'Pinned from My Space', zen: 'Pinned in Zen' };

function linkPin(p, key) {
  return el('div', { class: 'zen-pinlink', draggable: 'true', dataset: { key, from: p.from } },
    linkRow({ url: p.url, title: p.title }), unpinBtn(p.title || p.url, () => unpinZenItem(p.id)));
}

const FOLDER_SHOW = 8;

// a whole collection, live: its links as they are now, from whichever Space it lives in.
// A deleted collection keeps its pin (so Undo brings the card back) and says it has gone.
function collectionPin(p, key, allSpaces, activeSpaces) {
  const s = allSpaces.find((x) => x.id === p.colId) || null;
  const links = (s?.tabs || []).filter((t) => t?.url);
  const title = s ? (s.title || 'Untitled collection') : (p.title || 'Collection');
  // the same colour the board paints it: its own, or the palette slot it sits in
  const at = activeSpaces.findIndex((x) => x.id === p.colId);
  const color = s?.color || DOT_COLORS[(at < 0 ? 0 : at) % DOT_COLORS.length];
  const head = el('div', { class: 'zen-list-head', title: s ? 'Pinned collection' : '' },
    el('span', { class: 'zen-col-dot', style: `background:${color}`, 'aria-hidden': 'true' }),
    el('span', { class: 'zen-list-title', text: title }),
    links.length ? el('span', { class: 'zen-list-n', text: String(links.length) }) : null,
    links.length > 1 ? el('button', { class: 'zen-unpin', type: 'button', title: 'Open all in background tabs', 'aria-label': 'Open all in background tabs',
      onclick: async () => { for (const t of links) await chrome.tabs.create({ url: t.url, active: false }); } }, icon('external', 13)) : null,
    unpinBtn(title, () => unpinZenItem(p.id)));
  const body = !s
    ? [quiet('This collection is no longer here.')]
    : links.length
      ? [...links.slice(0, FOLDER_SHOW).map((t) => linkRow(t)),
        links.length > FOLDER_SHOW ? el('p', { class: 'zen-more', text: `+ ${links.length - FOLDER_SHOW} more in the collection` }) : null]
      : [quiet('This collection is empty.')];
  return el('div', { class: 'zen-list zen-folder zen-colpin', draggable: 'true', dataset: { key } }, head, ...body);
}

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
