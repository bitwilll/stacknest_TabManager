// Zen — the uncluttered page. One switch beside the theme segment hides the whole workspace
// (sidebar, top bar, tab strip, board) and leaves, on a wallpaper:
//
//   a thought for the day       across the top, with a button for another
//   the clock and the date      on the side, with a month calendar under them (folds away)
//   one collection              chosen right here, remembered in settings (zenCollection)
//   To-do                       open reminders and unfinished checklists — tick, or add one
//   Pinned                      anything pinned to Zen: Notes cards, whole collections, plus links
//                               and folders from Collections, the Library and My Space (js/zenpins.js)
//   Quick note                  the bottom-right corner: hover (or click) and a small box opens
//                               upward to jot a note into Notes
//   Wallpaper button            press to shuffle; rest the pointer on it 2 s for a peek at the
//                               wallpaper (everything else fades to a fifth until it leaves)
//
// The switch at the bottom centre turns the page: Lounge, Arcade, Zen, and Notes, which is the
// whole of Notes on the wallpaper (every card, a filter, search, New note / list / reminder),
// so Notes can be reached from Zen without leaving it. A two-finger sideways swipe on a
// trackpad turns the same pages, one per swipe, in the switch's order.
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
  addNoteRow, removeNoteRow, openNoteReminder, deleteNoteCard, addQuickNote, addNoteCard, noteMatches } from './notes.js';
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
let lastNotes = null;        // the notes the last render saw, to fill the Notes page the moment it opens

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
    if (root.dataset.page === 'notes') { e.preventDefault(); goPage('home'); return; }   // the Notes page goes back to Zen first
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
  root.addEventListener('wheel', onSwipeWheel, { passive: false });   // two-finger swipe between pages
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
    setPeek(false);
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
  // opens every wallpaper in Settings. Resting the pointer on it for two seconds is a peek:
  // everything else fades to a fifth so the wallpaper can be seen, until the pointer leaves
  // (or Esc). A press restarts the wait, so shuffling through scenes never peeks by surprise.
  const wallName = el('span', { class: 'zen-wall-name', 'aria-live': 'polite' });
  const peekHint = el('span', { class: 'zen-peek-hint', 'aria-hidden': 'true', text: 'Move away or press Esc to come back' });
  let peekTimer = null;
  const armPeek = () => { clearTimeout(peekTimer); peekTimer = setTimeout(() => setPeek(true), PEEK_AFTER); };
  const wallBtn = el('button', { class: 'zen-icb zen-wall-btn', type: 'button', 'aria-pressed': 'false', title: WALL_TITLE, 'aria-label': 'Next wallpaper',
    onclick: (e) => {
      if (e.shiftKey) { setZen(false); openSettings('set-zen'); return; }
      const b = e.currentTarget; b.classList.remove('is-spin'); void b.offsetWidth; b.classList.add('is-spin');
      peekHint.classList.remove('is-on');   // the scene's name takes the spot under the button
      shuffleWallpaper(wallName);
      if (!root.classList.contains('is-peek') && b.matches(':hover')) armPeek();
    },
    oncontextmenu: (e) => { e.preventDefault(); setZen(false); openSettings('set-zen'); } }, icon('wallShuffle', 19), wallName, peekHint);
  // hover is a mouse thing; a finger resting on the button would also press it
  wallBtn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') armPeek(); });
  wallBtn.addEventListener('pointerleave', () => { clearTimeout(peekTimer); setPeek(false); });
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

  // the little switch at the bottom centre: Lounge · Arcade · Zen · Notes, the order a two-finger
  // sideways swipe walks (Lounge and Arcade are the arcade page, on its lounge or games shelf)
  const pageBtn = (id, label, ic) => el('button', { class: 'zen-page-btn', type: 'button', dataset: { page: id }, 'aria-pressed': 'false',
    onclick: () => goPage(id) }, icon(ic, 14), el('span', { text: label }));
  const pager = el('nav', { class: 'zen-pager', 'aria-label': 'Zen pages', title: 'Or swipe sideways with two fingers' },
    pageBtn('lounge', 'Lounge', 'lounge'),
    pageBtn('arcade', 'Arcade', 'gamepad'),
    pageBtn('home', 'Zen', 'zen'),
    pageBtn('notes', 'Notes', 'note'));
  const np = createNotesPage();

  // the wallpaper on its own layer (so it can breathe), and the motion laid over it: a fixed
  // handful of specks the stylesheet turns into stars, fireflies, petals or leaves per wallpaper
  const fx = el('div', { class: 'zen-fx', 'aria-hidden': 'true' });
  for (let i = 0; i < 22; i++) {
    const r = (n) => ((Math.sin((i + 1) * n * 12.9898) * 43758.5453) % 1 + 1) % 1;   // a fixed scatter, same every load
    fx.append(el('i', { style: `--x:${(r(1) * 100).toFixed(1)}%;--y:${(r(2) * 100).toFixed(1)}%;--d:${(-r(3) * 20).toFixed(1)}s;--t:${(14 + r(4) * 14).toFixed(1)}s;--s:${(0.6 + r(5) * 0.9).toFixed(2)}` }));
  }


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
    np.node,
    pager,
    qn.node,
    rest.node,
  );

  // drag (or Alt+arrow) to arrange: the panes, and the items inside each pane
  sortable(grid, { item: '.zen-pane', handle: '.zen-grip', onSort: (keys) => saveLayout({ panes: keys }) });
  sortable(colBody, { item: '.zen-linkrow', onSort: (keys) => shell.colKey && saveLayout({ order: { [shell.colKey]: keys } }) });
  sortable(todoBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { todo: keys } }) });
  sortable(pinBody, { item: '[data-key]', onSort: (keys) => saveLayout({ order: { pinned: keys } }) });

  shell = { wallBtn, peekHint, cal2, arcade, aTime, aDate, np, pager, time, date, greet, exit, qn, pick, colCount, openAll, colBody, todoCount, todoBody, pinCount, pinBody, thoughtText, thoughtBy, thoughtStar, thoughtOnly, grid, panes, cal, rest, colKey: null };
  paintThought();
  setPage('home', { focus: false });
}

/* ————————————————————————— the quick-note corner —————————————————————————
   A note button at the bottom-right corner. Hovering it opens a small panel upward with one
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

/* ————————————————————————— the Notes page —————————————————————————
   Zen's fourth page (the switch at the bottom centre): all of Notes on the wallpaper, in the
   Notes view's own order, every card editable in place like the cards on the home page. A
   filter (All · Notes · Lists · Reminders), a search over the same fields the Notes view
   searches, and New note / list / reminder, which start a card at the top and put the caret
   in it. Esc goes back to Zen's home page (from a field, the first Esc leaves the field). */
const NP_KINDS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes' },
  { id: 'todo', label: 'Lists' },
  { id: 'reminder', label: 'Reminders' },
];

function createNotesPage() {
  let kind = 'all';
  const time = el('div', { class: 'zen-a-time' });
  const date = el('div', { class: 'zen-a-date' });
  const count = el('span', { class: 'zen-count' });
  const kinds = el('div', { class: 'zen-np-kinds', role: 'group', 'aria-label': 'Show' },
    ...NP_KINDS.map((k) => el('button', { class: 'zen-page-btn', type: 'button', dataset: { kind: k.id }, 'aria-pressed': String(k.id === kind),
      onclick: () => { kind = k.id; render(); } }, el('span', { text: k.label }))));
  const search = el('input', { class: 'zen-np-q', type: 'search', placeholder: 'Search notes…', 'aria-label': 'Search notes', autocomplete: 'off' });
  let searchTimer = null;
  search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 90); });
  // a new card lands at the top with the caret in it; a filter or search that would hide it steps aside
  // A blank card of that kind already waiting is used instead of making another (addNoteCard),
  // and lit up so it is clear where the caret went.
  const make = async (k) => {
    const { id, reused } = await addNoteCard(k);
    if (kind !== 'all' && kind !== k) kind = 'all';
    search.value = '';
    await render({ force: true });
    focusEdit(editKey('np', { id }, null, k === 'reminder' ? 'text' : 'title'));
    if (reused) { const card = grid.querySelector(`[data-edit^="np|${CSS.escape(id)}|"]`)?.closest('.zen-list'); if (card) flash(card); }
  };
  const newBtn = (k, label, ic) => el('button', { class: 'zen-mini zen-np-new', type: 'button', onclick: () => make(k) }, icon(ic, 13), el('span', { text: label }));
  const grid = el('div', { class: 'zen-np-grid' });
  const node = el('section', { class: 'zen-np', 'aria-label': 'Notes' },
    el('header', { class: 'zen-a-bar zen-np-bar' },
      el('div', { class: 'zen-a-clock zen-np-clock' }, time, date),
      el('button', { class: 'zen-btn-pill', type: 'button', title: 'Leave Zen', onclick: () => setZen(false) }, icon('close', 14), el('span', { text: 'Leave zen' }))),
    el('div', { class: 'zen-np-stage' },
      el('div', { class: 'zen-pane zen-np-pane' },
        el('div', { class: 'zen-np-head' },
          el('h2', { class: 'zen-h', text: 'Notes' }), count,
          el('div', { class: 'zen-np-tools' },
            kinds,
            el('label', { class: 'zen-np-search' }, icon('search', 14), search),
            el('div', { class: 'zen-np-news' }, newBtn('note', 'Note', 'note'), newBtn('todo', 'List', 'checklist'), newBtn('reminder', 'Reminder', 'bell')))),
        grid)));

  function paint(items) {
    for (const b of kinds.children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    const q = search.value.trim();
    const shown = items.filter((it) => (kind === 'all' || it.kind === kind) && noteMatches(it, q));
    const open = items.reduce((n, i) => n + (i.kind === 'reminder' ? (i.done ? 0 : 1) : (i.list || []).filter((r) => !r.done).length), 0);
    count.textContent = q || kind !== 'all' ? `${shown.length} of ${items.length}` : `${items.length} ${items.length === 1 ? 'card' : 'cards'} · ${open} open`;
    grid.replaceChildren(...(shown.length ? shown.map(notesPageCard)
      : [quiet(!items.length ? 'Nothing in Notes yet. Start a note, a list or a reminder above.'
        : q ? `Nothing matches “${q}”.` : `No ${NP_KINDS.find((k) => k.id === kind).label.toLowerCase()} yet.`)]));
  }
  return { node, time, date, paint };
}

// one card on the Notes page: what the home page shows for it, with a pin to Zen
function notesPageCard(it) {
  const pin = { pinnedCard: it.pinned, pinAct: !it.pinned };
  if (it.kind === 'todo') return listCard(it, { scope: 'np', ...pin });
  if (it.kind === 'note') return noteCard(it, { scope: 'np', ...pin });
  return el('div', { class: `zen-list c-${it.color || 'none'}` },
    el('div', { class: 'zen-list-head' }, el('span', { class: 'zen-list-title', text: 'Reminder' }), cardActs(it, { pin: pin.pinAct }), it.pinned ? unpinNoteBtn(it) : null),
    reminderRow(it, { scope: 'np', acts: false }));
}

// a peek at the wallpaper: the page fades to 20% and can't be clicked or tabbed into; only the
// wallpaper button stays lit and live (it is what the pointer rests on, and a press still
// shuffles, so scenes can be looked at one after another)
const PEEK_AFTER = 2000;
const WALL_TITLE = 'Next wallpaper · rest here 2 s to look at it · Shift-click for all';
const PEEK_DIM = ':scope > .zen-bar > :not(.zen-tools), :scope > .zen-bar .zen-tools > :not(.zen-wall-btn), :scope > .zen-stage, :scope > .zen-pager, :scope > .zen-qn';
function setPeek(on) {
  if (!shell?.wallBtn) return;
  if (on && (!isOn() || root.dataset.page !== 'home')) return;   // only Zen's home page has the wallpaper button
  if (on === root.classList.contains('is-peek')) return;
  const b = shell.wallBtn;
  if (on) shell.qn.close();
  root.classList.toggle('is-peek', on);
  for (const n of root.querySelectorAll(PEEK_DIM)) n.inert = on;
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Back to Zen (move away or Esc)' : WALL_TITLE;
  shell.peekHint.classList.toggle('is-on', on);
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

// where the switch is: the arcade page counts as Lounge or Arcade by its shelf
const PAGE_ORDER = ['lounge', 'arcade', 'home', 'notes'];
const pageNow = () => {
  const page = root.dataset.page;
  return page === 'arcade' ? (shell.arcade.shelf === 'lounge' ? 'lounge' : 'arcade') : page === 'notes' ? 'notes' : 'home';
};
function paintPager() {
  const where = pageNow();
  for (const b of shell.pager.children) b.setAttribute('aria-pressed', String(b.dataset.page === where));
}
// one of the switch's four, from a button or a swipe; the page slides in from the side it lies on
// (a swipe hands on its speed, so the page that comes keeps the pace the fingers set)
function goPage(id, { focus = true, speed = 0 } = {}) {
  const dir = Math.sign(PAGE_ORDER.indexOf(id) - PAGE_ORDER.indexOf(pageNow()));
  if (id === 'lounge' || id === 'arcade') { shell.arcade.showShelf(id === 'lounge' ? 'lounge' : 'games'); setPage('arcade', { focus, dir, speed }); }
  else setPage(id, { focus, dir, speed });
}

function setPage(page, { focus = true, dir = 0, speed = 0 } = {}) {
  const was = root.dataset.page;
  if (!speed) dropSwipe();   // a click or a key takes over from a swipe still under way
  if (page !== 'home') { setPeek(false); shell.qn.close(); }
  root.dataset.page = page;
  paintPager();
  if (page !== 'arcade') shell.arcade.stop();
  root.scrollTop = 0;
  if (page === 'notes' && was !== 'notes') {   // the Notes page is only filled while it is open:
    if (lastNotes) shell.np.paint(lastNotes);    // at once from the last render, so it never slides in empty,
    render();                                    // then fresh
  }
  slideIn(dir, speed);
  if (focus && was !== page) {
    requestAnimationFrame(() => (page === 'arcade' ? shell.arcade.focus()
      : [...shell.pager.children].find((b) => b.dataset.page === page)?.focus({ preventScroll: true })));
  } else if (!focus) {   // (a swipe moves no focus, so no ring lights up; focus left on the page that went is let go)
    const a = document.activeElement;
    if (a && a !== root && root.contains(a) && !a.checkVisibility()) a.blur();
  }
}

/* ——— the page in motion ———
   Only the page's own content moves (the wallpaper, the switch and the corner button stay put),
   by transform and opacity alone, from one requestAnimationFrame loop. turn.x is how far the
   content sits from its place, in px. One loop for following, leaving, coming in and springing
   back is what makes a turn interruptible: a new swipe takes hold of a page that is still
   settling from wherever it is, so nothing ever jumps. Under reduced motion nothing moves; the
   pages simply change. */
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const PAGE_PARTS = { home: ':scope > .zen-bar, :scope > .zen-stage', arcade: ':scope > .zen-arcade', notes: ':scope > .zen-np' };
const SPRING_K = 290, SPRING_C = 2 * Math.sqrt(SPRING_K);   // critically damped: at rest in about 0.4 s, no wobble
const OUT_MS = 110;   // how long a page that was sent on takes to go, before the next one comes in
const turn = { x: 0, v: 0, mode: '', parts: [], fade: () => 1, raf: 0, last: 0, t0: 0, o0: 1, then: null };

function turnSize() {
  const w = root.clientWidth || 1200, clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
  return {
    commit: clamp(64, w * 0.06, 110),   // fingers' travel that turns the page when they lift
    reach: clamp(130, w * 0.16, 280),   // how far the page can be drawn aside (it eases off towards this)
    edge: 56,                           // the give at either end of the row
    enter: clamp(60, w * 0.065, 120),   // the side a swiped-to page comes in from
  };
}
function turnParts() {
  if (turn.parts.length) return;
  turn.parts = [...root.querySelectorAll(PAGE_PARTS[root.dataset.page] || PAGE_PARTS.home)];
  root.classList.add('is-turning');
}
function paintTurn(x, o) {
  const dim = root.classList.contains('is-peek') ? 0.2 : 1;   // a peek keeps its fifth
  for (const n of turn.parts) {
    n.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x.toFixed(2)}px, 0, 0)`;
    n.style.opacity = o >= 1 ? '' : (o * dim).toFixed(3);
  }
}
function stopTurn() {   // at rest: the content in its place, its styles its own again
  cancelAnimationFrame(turn.raf);
  turn.raf = 0;
  for (const n of turn.parts) { n.style.transform = ''; n.style.opacity = ''; }
  turn.parts = [];
  turn.x = 0; turn.v = 0; turn.mode = ''; turn.then = null;
  root.classList.remove('is-turning');
}
function runTurn() {
  turn.last = performance.now();
  if (!turn.raf) turn.raf = requestAnimationFrame(stepTurn);
}
function stepTurn(now) {
  turn.raf = 0;
  let dt = Math.min(0.05, Math.max(0, (now - turn.last) / 1000));
  turn.last = now;
  if (turn.mode === 'out') {   // sent on: straight on at the fingers' pace, fading out
    turn.x += turn.v * dt;
    const p = (now - turn.t0) / OUT_MS;
    if (p >= 1) { finishOut(); return; }
    paintTurn(turn.x, turn.o0 * (1 - p));
  } else if (turn.mode === 'spring') {   // coming in, or going back: a spring to its place
    while (dt > 0) {
      const h = Math.min(dt, 0.004);
      turn.v += (-SPRING_K * turn.x - SPRING_C * turn.v) * h;
      turn.x += turn.v * h;
      dt -= h;
    }
    if (Math.abs(turn.x) < 0.5 && Math.abs(turn.v) < 20) { stopTurn(); return; }
    paintTurn(turn.x, turn.fade(turn.x));
  } else return;
  turn.raf = requestAnimationFrame(stepTurn);
}
function finishOut() {
  const then = turn.then;
  turn.then = null; turn.mode = '';
  then?.();
}
// the page that comes in, from the side it lies on: dir +1 from the right, -1 from the left
function slideIn(dir, speed = 0) {
  stopTurn();
  if (!dir || calm.matches) return;
  turnParts();
  const start = dir * (speed ? turnSize().enter : 44);   // a click brings it from nearer by
  turn.x = start;
  turn.v = -dir * Math.min(speed, 2000);
  turn.fade = (x) => 1 - Math.min(1, Math.max(0, x / start));
  turn.mode = 'spring';
  paintTurn(start, 0);
  runTurn();
}

/* ——— two-finger sideways swipe: the pages in the switch's order ———
   A trackpad's sideways scroll (wheel deltaX) walks the switch: fingers moving left go towards
   Notes (Lounge → Arcade → Zen → Notes), fingers moving right go back. From the first delta the
   page follows the fingers (nearly 1:1, easing off, fading a little) and the switch lights the
   page that is coming. When the fingers lift (the deltas start dying away into momentum, or
   stop) the page goes, if it travelled far enough or was flicked, or springs back into place.
   Drawn far, it goes at once. At either end of the row it gives a little and holds.
   A decided swipe's momentum is spent quietly, but fingers that go again (picking up speed once
   the momentum has eased, or turning the other way) start the next swipe straight away, with
   no pause needed, and take hold of the page wherever it is.
   Left alone: an up-and-down scroll (the first delta decides), an open game or lounge (it owns
   the pointer), anything that itself scrolls sideways that way, a text field, a dialog or
   popover, the eye-rest pause, and pinch zoom. */
const SWIPE_GAP = 110;   // ms without a delta: the fingers have lifted, or rest
const swipe = { lock: '', done: false, raw: 0, raw0: 0, last: -1e9, prev: 0, rate: 0, peak: 0, fall: 0, rise: 0, sign: 0, hist: [], timer: 0, size: null };
const neighbour = (s) => (s ? PAGE_ORDER[PAGE_ORDER.indexOf(pageNow()) + s] || null : null);

// the fingers' travel (raw, + towards Notes) → where the page sits (x, + to the right): nearly
// 1:1 at first, easing off towards reach; towards an end of the row, a short rubber-band give
function toX(raw) {
  const s = Math.sign(raw), a = Math.abs(raw), { reach, edge } = swipe.size;
  return -s * (neighbour(s) ? reach * (1 - Math.exp(-a / reach)) : edge * (1 - 1 / (a * 0.55 / edge + 1)));
}
function toRaw(x) {   // the other way round, to take hold of a page that is still moving
  const s = -Math.sign(x), { reach, edge } = swipe.size;
  if (!s) return 0;
  if (neighbour(s)) return -s * reach * Math.log(1 - Math.min(Math.abs(x), reach * 0.97) / reach);
  return s * (edge / 0.55) * (1 / (1 - Math.min(Math.abs(x), edge * 0.97) / edge) - 1);
}
const trackFade = (x) => 1 - 0.55 * Math.min(1, Math.abs(x) / swipe.size.reach);

function onSwipeWheel(e) {
  if (!isOn() || e.ctrlKey) return;   // ctrl + wheel is a pinch: zoom, not a swipe
  const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? root.clientWidth : 1;
  const dx = e.deltaX * k, dy = e.deltaY * k, ax = Math.abs(dx), t = e.timeStamp;
  const dt = t - swipe.last, prev = swipe.prev, rate = ax / Math.min(40, Math.max(4, dt));
  let fresh = dt > SWIPE_GAP;
  if (!fresh && swipe.done && swipe.lock === 'x') {
    // a decided swipe's momentum, easing off; fingers that go again are the next swipe
    if (dx && swipe.sign && Math.sign(dx) !== swipe.sign && ax >= 2) fresh = true;   // the other way
    else if (ax >= 3 && prev <= swipe.peak * 0.6 && rate > swipe.rate * 1.2 + 0.05) fresh = ++swipe.rise >= 2;   // faster again
    else swipe.rise = 0;
  }
  swipe.last = t; swipe.prev = ax; swipe.rate = rate;
  if (fresh) { swipe.lock = ''; swipe.done = false; }
  if (!swipe.lock) {
    if (!ax && !dy) return;   // nothing yet to tell a swipe from a scroll
    swipe.lock = ax > Math.abs(dy) && e.cancelable && !swipeBlocked(e.target, dx) ? 'x' : 'y';
    if (swipe.lock === 'x') beginSwipe();
  }
  if (swipe.lock !== 'x') return;   // an up-and-down scroll, or a swipe that isn't Zen's: left alone
  e.preventDefault();               // and the browser's own back / forward swipe stays out of Zen
  if (!swipe.done) followSwipe(dx, ax, prev, t);
}

function beginSwipe() {
  clearTimeout(swipe.timer);
  swipe.size = turnSize();
  swipe.peak = 0; swipe.fall = 0; swipe.rise = 0; swipe.sign = 0; swipe.hist = [];
  shell.qn.close();
  if (turn.mode === 'out') finishOut();   // the page that was going is gone; catch the next one coming in
  cancelAnimationFrame(turn.raf);
  turn.raf = 0; turn.mode = 'hold';
  if (!calm.matches) turnParts();
  swipe.raw = swipe.raw0 = toRaw(turn.x);
}

function followSwipe(dx, ax, prev, t) {
  swipe.raw += dx;
  if (dx) swipe.sign = Math.sign(dx);
  swipe.hist.push([t, dx]);
  while (t - swipe.hist[0][0] > 70) swipe.hist.shift();
  if (ax > swipe.peak) { swipe.peak = ax; swipe.fall = 0; }
  else if (ax < prev || (ax === prev && ax < swipe.peak)) swipe.fall++;
  else swipe.fall = 0;
  turn.x = toX(swipe.raw);
  if (!calm.matches) paintTurn(turn.x, trackFade(turn.x));
  hintSwipe();
  clearTimeout(swipe.timer);
  swipe.timer = setTimeout(() => releaseSwipe(true), SWIPE_GAP);
  const moved = swipe.raw - swipe.raw0;
  if (neighbour(Math.sign(moved)) && Math.abs(moved) >= swipe.size.commit * 2.4) releaseSwipe();   // drawn far: it goes now
  else if (swipe.fall >= 3 && swipe.peak >= 6 && ax <= swipe.peak * 0.7) releaseSwipe();   // dying away: the fingers lifted, the rest is momentum
}

function swipeSpeed() {   // px per ms over the last few deltas, + towards Notes
  const h = swipe.hist;
  if (!h.length) return 0;
  return h.reduce((n, [, d]) => n + d, 0) / Math.max(16, h[h.length - 1][0] - h[0][0] + 16);
}

// the fingers have lifted (rested: they stopped first, so nothing is flung). What counts is
// this swipe's own travel, not where the page sits: one that caught a page still coming in
// turns the next page just as one from rest does. One swipe, one page.
function releaseSwipe(rested = false) {
  if (swipe.done || swipe.lock !== 'x') return;
  swipe.done = true;
  clearTimeout(swipe.timer);
  hintSwipe(true);
  const moved = swipe.raw - swipe.raw0, s = Math.sign(moved), to = neighbour(s);
  const v = rested ? 0 : swipeSpeed();
  const carried = moved + v * 100;   // about how far the momentum would carry it
  if (to && Math.abs(moved) >= 12 && Math.sign(carried) === s && Math.abs(carried) >= swipe.size.commit) {
    sendOn(to, s, Math.abs(v) * 1000);
    return;
  }
  // not far enough: back into place, carrying on a moment the way it was going
  if (calm.matches) { stopTurn(); return; }
  const slope = (toX(swipe.raw + 1) - toX(swipe.raw - 1)) / 2;
  turn.v = Math.max(-1500, Math.min(1500, slope * v * 1000));
  turn.fade = trackFade;
  turn.mode = 'spring';
  runTurn();
}

// a decided swipe: the page goes on the way the fingers sent it, fading, and the next comes in
function sendOn(to, s, speed) {
  const pace = Math.min(2600, Math.max(900, speed));   // px per s
  if (calm.matches) { stopTurn(); goPage(to, { speed: pace, focus: false }); return; }
  turn.mode = 'out';
  turn.v = -s * pace;
  turn.o0 = trackFade(turn.x);
  turn.t0 = performance.now();
  turn.then = () => goPage(to, { speed: pace, focus: false });
  runTurn();
}

// the switch lights the page that is coming, more as the swipe nears its turn
function hintSwipe(off = false) {
  const moved = swipe.raw - swipe.raw0, to = off ? null : neighbour(Math.sign(moved));
  const p = to ? Math.min(1, Math.abs(moved) / swipe.size.commit) : 0;
  for (const b of shell.pager.children) {
    if (to && b.dataset.page === to) { b.dataset.swipeTo = ''; b.style.setProperty('--swipe-p', p.toFixed(3)); }
    else if (b.dataset.swipeTo !== undefined) { delete b.dataset.swipeTo; b.style.removeProperty('--swipe-p'); }
  }
}
function dropSwipe() {
  if (swipe.lock === 'x') swipe.done = true;   // the rest of it is spent quietly
  clearTimeout(swipe.timer);
  if (shell) hintSwipe(true);
}

function swipeBlocked(target, dx) {
  if (shell.rest.isShowing() || document.querySelector('.modal-scrim, .rem-pop')) return true;
  if (root.dataset.page === 'arcade' && shell.arcade.playing) return true;
  if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
  for (let n = target; n && n !== root; n = n.parentElement) {   // something here scrolls sideways itself
    if (n.scrollWidth <= n.clientWidth + 1) continue;
    const ox = getComputedStyle(n).overflowX;
    if (ox !== 'auto' && ox !== 'scroll') continue;
    if (dx > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0) return true;
  }
  return false;
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
  shell.np.time.textContent = shell.aTime.textContent;
  shell.np.date.textContent = shell.aDate.textContent;
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
  lastNotes = items;
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
  if (root.dataset.page === 'notes') shell.np.paint(items);
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
function cardActs(it, { pin = false } = {}) {
  const name = it.title || it.text || KIND_LABEL[it.kind] || 'card';
  return el('span', { class: 'zen-acts' },
    !it.reminder ? el('button', { class: 'zen-act', type: 'button', title: 'Set a reminder', 'aria-label': `Set a reminder for ${name}`,
      onclick: (e) => openNoteReminder(e.currentTarget, it.id) }, icon('bell', 13)) : null,
    pin ? el('button', { class: 'zen-act', type: 'button', title: 'Pin to Zen', 'aria-label': `Pin ${name} to Zen`,
      onclick: () => setNotePinned(it.id, true).then(render) }, icon('pin', 13)) : null,
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

function listCard(it, { key = null, pinnedCard = false, pinAct = false, scope } = {}) {
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
      dueChip(it), cardActs(it, { pin: pinAct }), pinnedCard ? unpinNoteBtn(it) : null),
    ...rowEls,
    el('button', { class: 'zen-additem', type: 'button', onclick: () => rowAdded(scope, it, null) }, icon('plus', 12), el('span', { text: 'Add item' })));
}

// a note: its title and its markdown body
function noteCard(it, { key = null, scope, pinnedCard = false, pinAct = false } = {}) {
  const title = lineField({ key: editKey(scope, it, null, 'title'), value: it.title, placeholder: 'Title', label: 'Note title', cls: 'zen-list-title',
    onInput: (v) => saveNoteField(it.id, 'title', v),
    onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); focusEdit(editKey(scope, it, null, 'body')); } } });
  const body = areaField({ key: editKey(scope, it, null, 'body'), value: it.body, placeholder: 'Write… (markdown works)', label: 'Note',
    onInput: (v) => saveNoteField(it.id, 'body', v) });
  return el('div', { class: `zen-list zen-note c-${it.color || 'none'}`, draggable: key ? 'true' : null, dataset: key ? { key } : null },
    el('div', { class: 'zen-list-head' }, title, dueChip(it), cardActs(it, { pin: pinAct }), pinnedCard ? unpinNoteBtn(it) : null),
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
