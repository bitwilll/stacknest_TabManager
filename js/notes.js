// Notes & Todos — a Keep-style mosaic that mixes free-form notes and single-line
// tasks as peer cards. Every card can be dragged to reorder, tagged, tinted with a
// translucent pastel, and given a reminder that fires a browser notification.
//
// Storage: chrome.storage.local under one key, so it rides along in the full backup
// (local export/import + Google Drive sync). Apple Notes has no API a browser
// extension can reach, so import is by pasting exported text.
//
// TYPING IS SACRED. This view used to rebuild its whole DOM whenever storage
// changed — including the echo of its own debounced auto-save — which tore the
// focused field out from under the caret mid-word. Three rules keep that from
// happening again:
//   1. The shell (header + composer) is built once and never replaced.
//   2. Text edits save with { rerender: false } and their storage echo is ignored.
//   3. Any render that does run snapshots and restores focus + caret.

import { el, icon, actionBtn, toast, confirmDialog, exportDownload, pickFile, matches, shortDate } from './ui.js';
import { getKey, update } from './store.js';
import { exportBackup } from './backup.js';
import { backupNow, restoreLatest, loadCloudState } from './drive.js';
import { pushHistory, flashDeleted } from './history.js';
import { tagColor } from './tags.js';

export const NOTES_KEY = 'stacknest:notes';
const MOS_MIME = 'text/x-stacknest-mos';

const uid = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.round(Math.random() * 1e6)}`);
const now = () => new Date().toISOString();

/* ————— card tints —————
   Deliberately pale + translucent: they layer over the card surface so the same
   swatch reads as a soft pastel on paper and a quiet wash on ink, without fighting
   the monochrome chrome or hurting text contrast. */
export const CARD_COLORS = [
  { id: 'none', label: 'Default' },
  { id: 'amber', label: 'Amber' },
  { id: 'rose', label: 'Rose' },
  { id: 'violet', label: 'Violet' },
  { id: 'blue', label: 'Blue' },
  { id: 'teal', label: 'Teal' },
  { id: 'green', label: 'Green' },
];

/* ————— reminders —————
   { at: <ISO of the target date/time>, lead: minutes before to notify }. The
   notification fires at (at − lead). All maths is epoch-ms, so the user's local
   timezone is handled for free. */
const LEADS = [
  { v: 0, label: 'At time of event' },
  { v: 5, label: '5 minutes before' },
  { v: 10, label: '10 minutes before' },
  { v: 30, label: '30 minutes before' },
  { v: 60, label: '1 hour before' },
];
const LEAD_CHIP = { 0: '', 5: '5m before', 10: '10m before', 30: '30m before', 60: '1h before' };
const remName = (id) => `reminder:${id}`;
const fireTime = (r) => (r ? new Date(r.at).getTime() - (r.lead || 0) * 60000 : 0);
const armAlarm = (id, fireMs) => { if (fireMs > Date.now()) chrome.alarms?.create(remName(id), { when: fireMs }); };
const clearAlarm = (id) => chrome.alarms?.clear(remName(id));
const pad2 = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

let root, getQuery, countEl;
let shell = null; // { sub, host } — built once, never torn down

export function initNotes(options) {
  ({ root, getQuery, countEl } = options);
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !c[NOTES_KEY]) return;
    if (consumeSelfWrite()) return;   // the echo of a write we just made — DOM is already right
    scheduleRender();                 // a genuine outside change (other tab, Drive restore, import)
  });
  render();
  return { render };
}

/* ————————————————————————— data ————————————————————————— */

// Older builds stored { todos, notes }; fold both into one ordered `items` list so
// they can share a mosaic, drag-ordering, tags, tints and reminders.
export function migrateNotes(d) {
  if (Array.isArray(d?.items)) return { items: d.items.map(normalize) };
  const items = [
    ...(Array.isArray(d?.notes) ? d.notes : []).map((n) => normalize({ ...n, kind: 'note' })),
    ...(Array.isArray(d?.todos) ? d.todos : []).map((t) => normalize({ ...t, kind: 'todo' })),
  ];
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return { items };
}
function normalize(x = {}) {
  const kind = x.kind === 'todo' ? 'todo' : 'note';
  const base = {
    id: x.id || uid(), kind,
    tags: Array.isArray(x.tags) ? x.tags.filter(Boolean).map(String) : [],
    color: CARD_COLORS.some((c) => c.id === x.color) ? x.color : 'none',
    createdAt: x.createdAt || now(),
  };
  if (x.reminder?.at) base.reminder = { at: x.reminder.at, lead: Number(x.reminder.lead) || 0 };
  return kind === 'todo'
    ? { ...base, text: String(x.text || ''), done: !!x.done }
    : { ...base, title: String(x.title || ''), body: String(x.body || ''), updatedAt: x.updatedAt || base.createdAt };
}

async function load() { return migrateNotes(await getKey(NOTES_KEY, {})); }

// Writes we make ourselves come back to us through storage.onChanged. Re-rendering
// on that echo is what used to eat keystrokes, so each write leaves a marker the
// listener consumes. Markers expire after a few seconds: if Chrome ever coalesces
// an event away, a stale marker must not swallow somebody else's real change.
const selfWrites = [];
function consumeSelfWrite() {
  const cutoff = Date.now() - 3000;
  while (selfWrites.length && selfWrites[0] < cutoff) selfWrites.shift();
  if (!selfWrites.length) return false;
  selfWrites.shift();
  return true;
}

// Serialized read-modify-write; fn mutates the { items } draft in place. Structural
// changes re-render (and the caller can await a settled DOM); text saves pass
// { rerender: false } so typing is never interrupted.
async function mutate(fn, { rerender = true } = {}) {
  selfWrites.push(Date.now());
  await update(NOTES_KEY, {}, (d) => { const draft = migrateNotes(d); fn(draft); return draft; });
  if (rerender) await render();
}
const findItem = (d, id) => d.items.find((x) => x.id === id);

/* ————— debounced text saves —————
   Keystrokes accumulate in `pending` and flush as one write. Any structural change
   flushes first, so a re-render can never resurrect a stale value over what the
   user has already typed. */
const pending = new Map(); // id -> { text } | { title, body }
let saveTimer = null;
function queueSave(id, field, value) {
  pending.set(id, { ...(pending.get(id) || {}), [field]: value });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, 400);
}
function flushSaves() {
  clearTimeout(saveTimer);
  if (!pending.size) return Promise.resolve();
  const batch = [...pending.entries()];
  pending.clear();
  return mutate((d) => {
    for (const [id, fields] of batch) {
      const x = findItem(d, id);
      if (!x) continue;
      Object.assign(x, fields);
      if (x.kind === 'note') x.updatedAt = now();
    }
  }, { rerender: false });
}

/* ————————————————————————— render ————————————————————————— */

// An outside change while the user is mid-edit waits for them to click away, so a
// background sync can't yank the field they're typing in.
let renderPending = false;
function editingInMosaic() {
  const a = document.activeElement;
  return !!(a && shell?.host.contains(a) && /^(input|textarea)$/i.test(a.tagName));
}
function scheduleRender() {
  if (editingInMosaic()) { renderPending = true; return; }
  render();
}

export async function render() {
  const { items } = await load();
  const q = getQuery ? getQuery() : '';

  const open = items.filter((i) => i.kind === 'todo' && !i.done).length;
  const noteCount = items.filter((i) => i.kind === 'note').length;
  if (countEl) countEl.textContent = open ? String(open) : '';

  if (!shell || !root.contains(shell.wrap)) buildShell();
  shell.sub.textContent = `${open} open task${open === 1 ? '' : 's'} · ${noteCount} note${noteCount === 1 ? '' : 's'}`;

  const shown = q ? items.filter((i) => matches(q, i.text, i.title, i.body, (i.tags || []).join(' '))) : items;
  const focus = snapshotFocus();
  if (!shown.length) {
    shell.host.replaceChildren(el('div', { class: 'notes-empty big' },
      q ? 'Nothing here matches your search.'
        : el('span', {}, 'Nothing yet — add a task above, or ', el('button', { class: 'linkbtn', onclick: () => newItem('note') }, el('span', { text: 'write your first note' })), '.')));
  } else {
    const mosaic = el('div', { class: 'mosaic' });
    for (const it of shown) mosaic.append(itemCard(it));
    shell.host.replaceChildren(mosaic);
  }
  restoreFocus(focus);
}

// Where the caret was, in terms that survive a rebuild: which card, which field, which
// character. Only the mosaic is ever rebuilt, so the composer needs no snapshot.
function snapshotFocus() {
  const a = document.activeElement;
  if (!a || !shell?.host.contains(a) || !/^(input|textarea)$/i.test(a.tagName)) return null;
  let start = null, end = null;
  try { start = a.selectionStart; end = a.selectionEnd; } catch { /* type doesn't expose a selection */ }
  return { card: a.closest('.mos-card')?.dataset.id || null, cls: a.classList[0], start, end };
}
function restoreFocus(s) {
  if (!s || !s.cls) return;
  const scope = s.card ? shell.host.querySelector(`.mos-card[data-id="${CSS.escape(s.card)}"]`) : shell.host;
  const node = scope?.querySelector('.' + s.cls);
  if (!node) return;
  node.focus({ preventScroll: true });
  if (s.start != null) { try { node.setSelectionRange(s.start, s.end); } catch { /* not selectable */ } }
}

// Header + composer live outside the re-rendered region: their inputs keep focus and
// in-flight text no matter what happens to the mosaic.
function buildShell() {
  const sub = el('p', { class: 'notes-sub' });
  const host = el('div', { class: 'mosaic-host' });
  // Leaving a field commits it immediately and lets any render we deferred while the
  // user was typing finally happen.
  host.addEventListener('focusout', () => setTimeout(() => {
    if (editingInMosaic()) return;
    flushSaves();
    if (renderPending) { renderPending = false; render(); }
  }, 0));
  const wrap = el('div', { class: 'notes-shell' }, headerBar(sub), composer(), host);
  shell = { wrap, sub, host };
  root.replaceChildren(wrap);
}

function headerBar(sub) {
  return el('div', { class: 'notes-head' },
    el('div', { class: 'notes-h-text' },
      el('h2', { class: 'notes-title', text: 'Notes & Todos' }),
      sub,
    ),
    el('div', { class: 'notes-tools' },
      menuButton('Export', 'download', [
        { label: 'Full backup (incl. notes)', run: () => exportBackup(false) },
        { label: 'Notes only', run: exportNotesOnly },
      ]),
      menuButton('Import', 'upload', [
        { label: 'From a file…', run: importFromFile },
        { label: 'From Apple Notes…', run: openAppleNotesImport },
      ]),
      menuButton('Drive', 'cloud', [
        { label: 'Back up to Drive', run: driveBackup },
        { label: 'Fetch from Drive', run: driveRestore },
      ]),
      el('button', { class: 'btnx soft notes-tool notes-help', title: 'How Notes & Todos works', 'aria-label': 'Help', onclick: openGuide }, icon('help', 15)),
    ),
  );
}

// quick-add a task, plus a New menu that can also start a note
function composer() {
  const input = el('input', { class: 'todo-add', placeholder: 'Add a task…', 'aria-label': 'Add a task' });
  const add = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await flushSaves();
    await mutate((d) => { d.items.unshift(normalize({ kind: 'todo', text })); });
    input.focus();          // stay put so tasks can be typed one after another
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return el('div', { class: 'mos-composer' },
    el('div', { class: 'todo-addrow' }, icon('plus', 15), input),
    menuButton('New', 'plus', [
      { label: 'New note', run: () => newItem('note') },
      { label: 'New todo', run: () => newItem('todo') },
    ], 'primary'),
  );
}

async function newItem(kind) {
  const id = uid();
  await flushSaves();
  await mutate((d) => { d.items.unshift(normalize({ id, kind })); });
  focusItem(id);
}

function focusItem(id) {
  const card = shell?.host.querySelector(`.mos-card[data-id="${CSS.escape(id)}"]`);
  card?.querySelector('.note-title, .todo-text-in')?.focus();
}

// tiny click-to-open menu (progressive disclosure — one button, actions on demand)
function menuButton(label, iconName, items, variant = 'soft') {
  const menu = el('div', { class: 'notes-menu', hidden: 'true' },
    ...items.map((it) => el('button', { class: 'notes-menu-item', onclick: () => { close(); it.run(); } }, el('span', { text: it.label }))));
  const btn = el('button', { class: `btnx ${variant} notes-tool`, onclick: (e) => { e.stopPropagation(); toggle(); } },
    icon(iconName, 15), el('span', { text: label }), icon('chevron', 13));
  const wrap = el('div', { class: 'notes-menu-wrap' }, btn, menu);
  function toggle() { menu.hidden ? open() : close(); }
  function open() { closeAllMenus(); menu.hidden = false; document.addEventListener('mousedown', onDoc, true); }
  function close() { menu.hidden = true; document.removeEventListener('mousedown', onDoc, true); }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }
  wrap._closeMenu = close;
  return wrap;
}
function closeAllMenus() { document.querySelectorAll('.notes-menu-wrap').forEach((w) => w._closeMenu?.()); }

/* ————————————————————————— cards ————————————————————————— */

function itemCard(it) {
  const card = el('article', {
    class: `mos-card ${it.kind === 'todo' ? 'is-todo' : 'is-note'}${it.done ? ' is-done' : ''} c-${it.color || 'none'}`,
    draggable: 'true', dataset: { id: it.id },
  });
  card.append(it.kind === 'todo' ? todoBody(it) : noteBody(it));

  const chips = el('div', { class: 'mos-chips' });
  if (it.reminder) chips.append(reminderChip(it));
  (it.tags || []).forEach((t) => chips.append(tagChip(it, t)));
  if (chips.children.length) card.append(chips);

  card.append(el('div', { class: 'mos-foot' },
    // a span, not a button — the drag guard below ignores drags that start on a
    // control, and the card's own text fields swallow the rest of its surface
    el('span', { class: 'mos-grip', title: 'Drag to reorder' }, icon('grip', 13)),
    el('span', { class: 'mos-when', text: it.kind === 'note' ? shortDate(it.updatedAt || it.createdAt) : '' }),
    el('div', { class: 'mos-acts' },
      actionBtn('bell', it.reminder ? 'Edit reminder' : 'Set reminder', (_, b) => openReminderEditor(b, it), it.reminder ? 'rem-bell on' : 'rem-bell'),
      actionBtn('tag', 'Tags', (_, b) => openTagPicker(b, it)),
      actionBtn('palette', 'Card colour', (_, b) => openColorPicker(b, it)),
      actionBtn('close', it.kind === 'todo' ? 'Delete task' : 'Delete note', () => removeCard(it), 'danger'),
    ),
  ));

  wireDrag(card, it);
  return card;
}

function todoBody(it) {
  const box = el('button', {
    class: `todo-check${it.done ? ' is-done' : ''}`, role: 'checkbox', 'aria-checked': String(it.done), 'aria-label': it.text || 'Task',
    onclick: async () => {
      await flushSaves();
      await mutate((d) => { const x = findItem(d, it.id); if (x) x.done = !x.done; });
      if (!it.done) clearAlarm(it.id);                        // now done — stop nagging
      else if (it.reminder) armAlarm(it.id, fireTime(it.reminder)); // re-opened — re-arm
    },
  }, it.done ? icon('check', 13) : null);

  // Always-live input (no click-to-edit dance): it can hold focus across renders,
  // and Enter chains straight into the next task.
  const input = el('input', { class: 'todo-text-in', value: it.text || '', placeholder: 'Task', 'aria-label': 'Task' });
  input.addEventListener('input', () => queueSave(it.id, 'text', input.value));
  input.addEventListener('keydown', (e) => onTodoKey(e, it, input));
  return el('div', { class: 'todo-line' }, box, input);
}

// Enter → a fresh task right below this one, focused. Backspace in an empty task
// removes it and steps back up, so a stray Enter never strands a blank card.
async function onTodoKey(e, it, input) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const id = uid();
    await flushSaves();
    await mutate((d) => {
      const i = d.items.findIndex((x) => x.id === it.id);
      d.items.splice(i < 0 ? d.items.length : i + 1, 0, normalize({ id, kind: 'todo' }));
    });
    focusItem(id);
    return;
  }
  if (e.key === 'Escape') { input.blur(); return; }
  if (e.key === 'Backspace' && !input.value && !it.reminder && !(it.tags || []).length) {
    e.preventDefault();
    pending.delete(it.id);
    let prevId = null;
    await mutate((d) => {
      const i = d.items.findIndex((x) => x.id === it.id);
      if (i < 0) return;
      prevId = d.items[i - 1]?.id || null;
      d.items.splice(i, 1);
    });
    if (prevId) focusItem(prevId);
  }
}

function noteBody(it) {
  const title = el('input', { class: 'note-title', value: it.title || '', placeholder: 'Title', 'aria-label': 'Note title' });
  title.addEventListener('input', () => queueSave(it.id, 'title', title.value));
  const body = el('textarea', { class: 'note-body', placeholder: 'Write…', 'aria-label': 'Note body', rows: '3' });
  body.value = it.body || '';
  const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight, 420) + 'px'; };
  body.addEventListener('input', () => { grow(); queueSave(it.id, 'body', body.value); });
  // Tab out of the title into the body reads as one continuous note
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); } });
  requestAnimationFrame(grow);
  return el('div', { class: 'note-lines' }, title, body);
}

function reminderChip(it) {
  const at = new Date(it.reminder.at);
  const past = fireTime(it.reminder) <= Date.now();
  const when = at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const lead = LEAD_CHIP[it.reminder.lead] || '';
  return el('button', { class: `todo-rem-chip${past ? ' past' : ''}`, title: past ? 'Reminder passed — click to change' : 'Edit reminder', onclick: (_, b) => openReminderEditor(b, it) },
    icon('bell', 11), el('span', { text: when + (lead ? ` · ${lead}` : '') }));
}

function tagChip(it, t) {
  return el('button', { class: 'mos-tag', title: `Remove “${t}”`, onclick: () => mutate((d) => { const x = findItem(d, it.id); if (x) x.tags = x.tags.filter((y) => y !== t); }) },
    el('span', { class: 'tag-dot', style: `background:${tagColor(t)}` }), el('span', { text: t }));
}

/* ————————————————————————— delete (undoable) ————————————————————————— */

// Deleting captures the card and its position, then registers an undo/redo pair with
// the shared history stack — so Cmd/Ctrl+Z (or the snackbar) puts it back exactly
// where it was, reminder and all, without reverting anything you did since.
async function removeCard(it) {
  const label = it.kind === 'todo' ? 'task' : 'note';
  const hasContent = it.kind === 'todo' ? !!it.text : !!(it.title || it.body);
  if (hasContent && !(await confirmDialog({
    title: it.kind === 'todo' ? 'Delete task?' : 'Delete note?',
    message: 'You can undo this with ⌘Z / Ctrl+Z.', confirmLabel: 'Delete', danger: true,
  }))) return;

  await flushSaves();
  let snapshot = null, index = -1;
  await mutate((d) => {
    index = d.items.findIndex((x) => x.id === it.id);
    if (index < 0) return;
    snapshot = structuredClone(d.items[index]);
    d.items.splice(index, 1);
  });
  clearAlarm(it.id);
  if (!snapshot) return;

  const restore = async () => {
    await mutate((d) => {
      if (d.items.some((x) => x.id === snapshot.id)) return;    // already back
      d.items.splice(Math.min(index, d.items.length), 0, normalize(snapshot));
    });
    if (snapshot.reminder) armAlarm(snapshot.id, fireTime(snapshot.reminder));
  };
  const again = async () => {
    await mutate((d) => { d.items = d.items.filter((x) => x.id !== snapshot.id); });
    clearAlarm(snapshot.id);
  };
  pushHistory({ label, undo: restore, redo: again });
  flashDeleted(`Deleted ${label}`);
}

/* ————————————————————————— drag to reorder ————————————————————————— */

function wireDrag(card, it) {
  card.addEventListener('dragstart', (e) => {
    // don't hijack drags that start inside an editable field or a button
    if (e.target.closest('input, textarea, button')) { e.preventDefault(); return; }
    e.dataTransfer.setData(MOS_MIME, it.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => { card.classList.remove('dragging'); clearDropMarks(); });
  card.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(MOS_MIME)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const r = card.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    clearDropMarks();
    card.classList.add(after ? 'drop-after' : 'drop-before');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drop-before', 'drop-after'));
  card.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.types.includes(MOS_MIME)) return;
    e.preventDefault(); e.stopPropagation();
    const fromId = e.dataTransfer.getData(MOS_MIME);
    const after = card.classList.contains('drop-after');
    clearDropMarks();
    if (!fromId || fromId === it.id) return;
    await flushSaves();
    await mutate((d) => {
      const from = d.items.findIndex((x) => x.id === fromId);
      if (from < 0) return;
      const [moved] = d.items.splice(from, 1);
      let to = d.items.findIndex((x) => x.id === it.id);
      if (to < 0) to = d.items.length; else to += after ? 1 : 0;
      d.items.splice(to, 0, moved);
    });
  });
}
function clearDropMarks() { document.querySelectorAll('.mos-card.drop-before, .mos-card.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after')); }

/* ————————————————————————— popovers ————————————————————————— */

let openPop = null;
function closePop() {
  if (!openPop) return;
  openPop.remove(); openPop = null;
  document.removeEventListener('mousedown', onPopDown, true);
  document.removeEventListener('keydown', onPopKey, true);
  document.removeEventListener('scroll', onPopScroll, true);
  // a render deferred while the user was mid-edit can land now
  if (renderPending && !editingInMosaic()) { renderPending = false; render(); }
}
function onPopDown(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
function onPopKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } }
function onPopScroll(e) { if (openPop && !openPop.contains(e.target)) closePop(); }

// place a popover under `anchor`, clamped to the viewport (zoom-aware)
function placePop(pop, anchor) {
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  const r = anchor.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight, m = 8, gap = 6;
  const pr = pop.getBoundingClientRect();
  const openUp = pr.height > vh - r.bottom - gap - m && r.top > vh - r.bottom;
  const top = openUp ? Math.max(m, r.top - gap - pr.height) : r.bottom + gap;
  const left = Math.min(Math.max(m, r.right - pr.width), Math.max(m, vw - pr.width - m));
  pop.style.left = `${left / zoom}px`;
  pop.style.top = `${top / zoom}px`;
}
function mountPop(pop, anchor, focusEl) {
  closePop();
  pop.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.append(pop);
  openPop = pop;
  placePop(pop, anchor);
  if (focusEl) setTimeout(() => focusEl.focus(), 0);
  document.addEventListener('mousedown', onPopDown, true);
  document.addEventListener('keydown', onPopKey, true);
  document.addEventListener('scroll', onPopScroll, true);
}

function openReminderEditor(anchor, it) {
  const start = it.reminder ? new Date(it.reminder.at) : new Date(Date.now() + 60 * 60000);
  if (!it.reminder) start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);
  const dt = el('input', { type: 'datetime-local', class: 'rem-dt', value: toLocalInput(start), 'aria-label': 'Reminder date and time' });
  const lead = el('select', { class: 'rem-lead', 'aria-label': 'How early to notify' },
    ...LEADS.map((l) => el('option', { value: String(l.v), ...(it.reminder?.lead === l.v ? { selected: 'true' } : {}) }, el('span', { text: l.label }))));

  const hint = el('div', { class: 'rem-hint' });
  const refresh = () => {
    const target = new Date(dt.value);
    if (isNaN(target)) { hint.textContent = 'Pick a date & time.'; return; }
    const fireMs = target.getTime() - Number(lead.value) * 60000;
    hint.textContent = fireMs <= Date.now() ? 'That’s in the past — pick a later time.'
      : `Notifies ${new Date(fireMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  };
  dt.addEventListener('input', refresh); lead.addEventListener('change', refresh); refresh();

  const setBtn = el('button', { class: 'btnx primary rem-set', onclick: async () => {
    const target = new Date(dt.value);
    if (isNaN(target)) { toast('Pick a date & time'); return; }
    const leadV = Number(lead.value);
    const fireMs = target.getTime() - leadV * 60000;
    if (fireMs <= Date.now()) { toast('That reminder time is in the past'); return; }
    await flushSaves();
    await mutate((d) => { const x = findItem(d, it.id); if (x) { if (x.kind === 'todo') x.done = false; x.reminder = { at: target.toISOString(), lead: leadV }; } });
    armAlarm(it.id, fireMs);
    closePop(); toast('Reminder set');
  } }, el('span', { text: it.reminder ? 'Update' : 'Set reminder' }));

  const clearBtn = it.reminder ? el('button', { class: 'btnx ghosty rem-clear', onclick: async () => {
    await mutate((d) => { const x = findItem(d, it.id); if (x) delete x.reminder; });
    clearAlarm(it.id); closePop(); toast('Reminder cleared');
  } }, el('span', { text: 'Clear' })) : null;

  mountPop(el('div', { class: 'rem-pop', role: 'dialog', 'aria-label': 'Set reminder' },
    el('div', { class: 'rem-h' }, icon('bell', 13), el('span', { text: 'Reminder' })),
    el('label', { class: 'rem-field' }, el('span', { class: 'rem-lbl', text: 'Date & time' }), dt),
    el('label', { class: 'rem-field' }, el('span', { class: 'rem-lbl', text: 'Remind me' }), lead),
    hint,
    el('div', { class: 'rem-actions' }, clearBtn, setBtn),
  ), anchor, dt);
}

function openTagPicker(anchor, it) {
  const chips = el('div', { class: 'tagpop-chips' });
  const input = el('input', { class: 'tagpop-input', placeholder: 'Add tag…', 'aria-label': 'Add a tag' });
  const draw = (tags) => {
    chips.replaceChildren(...tags.map((t) => el('span', { class: 'tagpop-chip' },
      el('span', { class: 'tag-dot', style: `background:${tagColor(t)}` }),
      el('span', { class: 'tagpop-chip-t', text: t }),
      el('button', { class: 'tagpop-x', title: `Remove ${t}`, onclick: () => commit(tags.filter((x) => x !== t)) }, icon('close', 11)))));
    if (!tags.length) chips.append(el('span', { class: 'tagpop-empty', text: 'No tags yet' }));
  };
  let current = [...(it.tags || [])];
  const commit = async (next) => {
    const seen = new Set(); const clean = [];
    for (let t of next) { t = String(t).trim().replace(/\s+/g, ' ').slice(0, 32); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); clean.push(t); } }
    current = clean.slice(0, 12);
    await mutate((d) => { const x = findItem(d, it.id); if (x) x.tags = current; });
    draw(current); placePop(openPop, anchor);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; commit([...current, ...v.split(',')]); } }
    if (e.key === 'Escape') closePop();
  });
  draw(current);
  mountPop(el('div', { class: 'tagpop', role: 'dialog', 'aria-label': 'Edit tags' },
    el('div', { class: 'tagpop-h', text: 'Tags' }), chips,
    el('div', { class: 'tagpop-add' }, input),
    el('div', { class: 'tagpop-hint', text: 'Enter or comma to add · Esc to close' }),
  ), anchor, input);
}

function openColorPicker(anchor, it) {
  const grid = el('div', { class: 'colr-grid' },
    ...CARD_COLORS.map((c) => el('button', {
      class: `colr-sw c-${c.id}${(it.color || 'none') === c.id ? ' is-active' : ''}`, title: c.label, 'aria-label': c.label,
      onclick: async () => { await mutate((d) => { const x = findItem(d, it.id); if (x) x.color = c.id; }); closePop(); },
    }, (it.color || 'none') === c.id ? icon('check', 12) : null)));
  mountPop(el('div', { class: 'colr-pop', role: 'dialog', 'aria-label': 'Card colour' },
    el('div', { class: 'rem-h' }, icon('palette', 13), el('span', { text: 'Colour' })), grid,
  ), anchor);
}

/* ————————————————————————— guide ————————————————————————— */

const GUIDE = [
  { h: 'Creating', icon: 'plus', rows: [
    ['Add a task…', 'Type in the bar at the top and press Enter. Focus stays put, so you can rattle off tasks one after another.'],
    ['New ▾', 'Starts an empty note (title + body) or an empty task, at the top of the mosaic.'],
    ['Enter inside a task', 'Creates the next task directly below and jumps to it — the fastest way to write a list.'],
    ['Backspace in an empty task', 'Removes it and steps back to the one above, so a stray Enter never leaves a blank card.'],
    ['Autosave', 'Everything saves as you type. There is no Save button and nothing to lose.'],
  ] },
  { h: 'Organising', icon: 'grip', rows: [
    ['Drag to reorder', 'Grab a card by the ⣿ handle in its footer and drop it above or below any other card.'],
    ['Tags', 'The tag button adds any label you like — Enter or comma between them. Click a tag on a card to remove it.'],
    ['Colour', 'Six translucent pastel washes. They sit over the card surface, so they stay readable in light and dark.'],
    ['Search', 'The search box at the top of the window filters cards by title, body, task text and tag.'],
  ] },
  { h: 'Reminders', icon: 'bell', rows: [
    ['Set a reminder', 'The bell on any card — note or task. Pick a date and time, then how early to be told.'],
    ['Lead time', 'At the time of the event, or 5 / 10 / 30 minutes or 1 hour before it.'],
    ['Timezone', 'Times are your computer’s local time. Travelling changes when a reminder lands, as you would expect.'],
    ['Where it appears', 'A browser notification, even with no StackNest tab open. Chrome must be running; ones missed while it was closed fire at next launch.'],
    ['Completing a task', 'Ticking a task cancels its reminder. Un-ticking re-arms it.'],
  ] },
  { h: 'Undo', icon: 'undo', rows: [
    ['⌘Z / Ctrl+Z', 'Puts a deleted card back exactly where it was, with its tags, colour and reminder intact.'],
    ['⇧⌘Z / Ctrl+Y', 'Redo — deletes it again.'],
    ['Undo bar', 'A snackbar appears after every delete with a one-click Undo.'],
    ['Scope', 'The undo stack lasts for this tab’s session, and never reverts edits you made after the delete.'],
  ] },
  { h: 'Backup & sync', icon: 'cloud', rows: [
    ['Export', 'Notes only (a small JSON of just this view) or a full StackNest backup that carries notes alongside spaces and collections.'],
    ['Import', 'Reads either file. Imported cards are added to what you already have — never replacing it — with fresh ids so nothing collides.'],
    ['Apple Notes', 'No extension can read Apple Notes directly. Copy the note there, paste it here, and optionally split on blank lines.'],
    ['Drive', 'Backs up and fetches through the same full backup. Connect an account first in Settings → Cloud sync.'],
  ] },
];

function openGuide() {
  const closeBtn = el('button', { class: 'modal-btn confirm', text: 'Got it' });
  const modal = el('div', { class: 'modal help-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Notes & Todos guide' },
    el('h2', { class: 'modal-title', text: 'Notes & Todos' }),
    el('p', { class: 'modal-msg', text: 'Everything this view can do.' }),
    el('div', { class: 'help-body' }, ...GUIDE.map((sec) => el('section', { class: 'help-sec' },
      el('h3', { class: 'help-h' }, icon(sec.icon, 13), el('span', { text: sec.h })),
      el('dl', { class: 'help-list' }, ...sec.rows.flatMap(([k, v]) => [
        el('dt', { class: 'help-k', text: k }),
        el('dd', { class: 'help-v', text: v }),
      ])),
    ))),
    el('div', { class: 'modal-actions' }, closeBtn),
  );
  const scrim = el('div', { class: 'modal-scrim' }, modal);
  let done = false;
  const close = () => { if (done) return; done = true; scrim.classList.remove('show'); document.removeEventListener('keydown', onKey, true); setTimeout(() => scrim.remove(), 200); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } };
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  requestAnimationFrame(() => { scrim.classList.add('show'); closeBtn.focus(); });
}

/* ————————————————————————— export / import ————————————————————————— */

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

async function exportNotesOnly() {
  await flushSaves();
  const { items } = await load();
  if (!items.length) { toast('Nothing to export yet'); return; }
  exportDownload(`stacknest-notes-${stamp()}.json`, JSON.stringify({ app: 'StackNest', type: 'notes', version: 2, exportedAt: now(), items }, null, 2), 'application/json');
  toast(`Exported ${items.length} card${items.length === 1 ? '' : 's'}`);
}

async function importFromFile() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON'); return; }
  // a notes-only file (v1 {todos,notes} or v2 {items}) or a full backup carrying either
  const blob = data?.type === 'notes' ? data
    : (data?.notes && typeof data.notes === 'object' && !Array.isArray(data.notes) ? data.notes : null);
  const incoming = blob ? migrateNotes(blob).items : [];
  if (!incoming.length) { toast('No notes or tasks found in that file'); return; }
  const ok = await confirmDialog({ title: 'Import notes?', message: `Add ${incoming.length} card${incoming.length === 1 ? '' : 's'} to what you already have?`, confirmLabel: 'Import' });
  if (!ok) return;
  await mergeIn(incoming);
  toast(`Imported ${incoming.length} card${incoming.length === 1 ? '' : 's'}`);
}

// add imported cards with fresh ids so nothing collides, newest on top
async function mergeIn(list) {
  await flushSaves();
  return mutate((d) => { for (const x of [...list].reverse()) d.items.unshift(normalize({ ...x, id: uid() })); });
}

function openAppleNotesImport() {
  const ta = el('textarea', { class: 'apple-paste', placeholder: 'Paste text copied from Apple Notes…', rows: '9' });
  const split = el('input', { type: 'checkbox', class: 'apple-split-cb' });
  const cancelBtn = el('button', { class: 'modal-btn cancel', text: 'Cancel' });
  const importBtn = el('button', { class: 'modal-btn confirm', text: 'Import' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Import from Apple Notes' },
    el('h2', { class: 'modal-title', text: 'Import from Apple Notes' }),
    el('p', { class: 'modal-msg', text: 'A browser extension can’t read Apple Notes directly. In Apple Notes, select the note(s) → Edit → Copy (or ⌘A then ⌘C inside a note), then paste below.' }),
    ta,
    el('label', { class: 'apple-splitrow' }, split, el('span', { text: 'Split into separate notes on blank lines' })),
    el('div', { class: 'modal-actions' }, cancelBtn, importBtn),
  );
  const scrim = el('div', { class: 'modal-scrim' }, modal);
  let done = false;
  const close = () => { if (done) return; done = true; scrim.classList.remove('show'); document.removeEventListener('keydown', onKey, true); setTimeout(() => scrim.remove(), 200); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  const doImport = async () => {
    const text = ta.value.trim();
    if (!text) { toast('Paste some text first'); return; }
    const blocks = split.checked ? text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) : [text];
    const list = blocks.map((b) => { const nl = b.indexOf('\n'); return { kind: 'note', ...(nl === -1 ? { title: b.slice(0, 80), body: '' } : { title: b.slice(0, nl).trim().slice(0, 120), body: b.slice(nl + 1).trim() }) }; });
    close();
    await mergeIn(list);
    toast(`Imported ${list.length} note${list.length === 1 ? '' : 's'} from Apple Notes`);
  };
  cancelBtn.addEventListener('click', close);
  importBtn.addEventListener('click', doImport);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  requestAnimationFrame(() => { scrim.classList.add('show'); ta.focus(); });
}

/* ————————————————————————— Drive (via the full backup, which carries notes) ————————————————————————— */

async function driveBackup() {
  const cloud = await loadCloudState();
  if (!(cloud.connected || cloud.email)) { toast('Connect Google Drive first — Settings → Cloud sync'); return; }
  await flushSaves();
  const r = await backupNow(false).catch((e) => { toast(e?.message || 'Backup failed'); return null; });
  if (r) toast('Backed up to Drive (notes included)');
}

async function driveRestore() {
  const cloud = await loadCloudState();
  if (!(cloud.connected || cloud.email)) { toast('Connect Google Drive first — Settings → Cloud sync'); return; }
  const ok = await confirmDialog({ title: 'Fetch from Drive?', message: 'This restores your latest Drive backup — replacing your current spaces, collections, settings and notes.', confirmLabel: 'Fetch & restore', danger: true });
  if (!ok) return;
  const r = await restoreLatest().catch((e) => { toast(e?.message || 'Restore failed'); return null; });
  if (r) toast('Restored from Drive');
}
