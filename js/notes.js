// Notes, To-do lists & Reminders — a Keep-style mosaic of three kinds of card:
//
//   note      title + a markdown body
//   todo      title + a CHECKLIST: many items added one under the other in one card
//   reminder  a single checkable line, optionally with a date/time notification
//
// All three share tags, a pastel tint, a text scale, drag-reordering and reminders.
//
// Storage: chrome.storage.local under one key, so it rides along in the full backup
// (local export/import + Google Drive sync). Apple Notes has no API a browser
// extension can reach, so import is by pasting exported text.
//
// ————— THE 'todo' NAME COLLISION —————
// 'reminder' used to be called 'todo', and 'todo' now means something else with a
// different shape. Every record already in storage, in every export and in every Drive
// backup says kind:'todo', and the stored blob carries no version. So migration is
// SHAPE-driven, never name-driven: a 'todo' with a `list` array is a new checklist; a
// 'todo' with a `text` string and no list is a legacy single-line task, i.e. a reminder.
// A stamp (v: SCHEMA_V) is written going forward so future changes have something
// cheaper to read, but correctness never depends on it.
//
// ————— TYPING IS SACRED —————
// This view used to rebuild its whole DOM whenever storage changed — including the echo
// of its own debounced auto-save — which tore the focused field out from under the caret
// mid-word. Four rules keep that from happening again:
//   1. The shell (header + composer) is built once and never replaced.
//   2. Text edits save with { rerender: false } and their storage echo is ignored.
//   3. Any render that does run snapshots and restores focus + caret — keyed on
//      (card id, ROW id, field class), because a checklist has many same-classed fields
//      and "first match wins" would throw the caret from row 5 back to row 0.
//   4. The markdown preview swap is driven by focus on that one card, never by a render.

import { el, icon, actionBtn, toast, confirmDialog, exportDownload, pickFile, matches, shortDate } from './ui.js';
import { getKey, update } from './store.js';
import { exportBackup } from './backup.js';
import { backupNow, restoreLatest, loadCloudState } from './drive.js';
import { pushHistory, flashDeleted } from './history.js';
import { tagColor } from './tags.js';
import { renderMarkdown, renderInline, hasInlineMarkdown } from './markdown.js';
import { toggleFormat, stepScale, DEFAULT_SCALE, SCALES } from './format.js';

export const NOTES_KEY = 'stacknest:notes';
export const SCHEMA_V = 3;
const MOS_MIME = 'text/x-stacknest-mos';

const uid = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.round(Math.random() * 1e6)}`);
const now = () => new Date().toISOString();

export const KIND_LABEL = { note: 'note', todo: 'list', reminder: 'reminder' };

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
let shell = null; // { wrap, sub, host } — built once, never torn down

export function initNotes(options) {
  ({ root, getQuery, countEl } = options);
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local' || !c[NOTES_KEY]) return;
    if (consumeSelfWrite()) return;   // the echo of a write we just made — DOM is already right
    scheduleRender();                 // a genuine outside change (other tab, Drive restore, import)
  });
  render();
  rearmAlarms();                      // a restore/import can leave reminders with no alarm behind them
  return { render, rearmAlarms };
}

/* ————————————————————————— data ————————————————————————— */

// Which kind is this record REALLY? Never trust the name alone — see the header.
function detectKind(x) {
  if (Array.isArray(x?.list)) return 'todo';              // only a checklist has rows
  if (x?.kind === 'note') return 'note';
  if (x?.kind === 'reminder') return 'reminder';
  if (x?.kind === 'todo') return 'reminder';              // legacy single-line task
  if (typeof x?.text === 'string' && !('body' in x)) return 'reminder';
  return 'note';
}

const clampScale = (s) => (SCALES.includes(Number(s)) ? Number(s) : DEFAULT_SCALE);

function normalizeRow(r) {
  if (!r || typeof r !== 'object') r = {};
  return { id: r.id || uid(), text: String(r.text ?? ''), done: !!r.done };
}

// NOTE: this is a whitelist and it runs on every read AND every write, so a field that
// isn't constructed here is destroyed. Add new fields in all three branches.
function normalize(x) {
  if (!x || typeof x !== 'object') x = {};   // a null in a hand-edited file must not kill the view
  const kind = detectKind(x);
  const base = {
    id: x.id || uid(), kind,
    tags: Array.isArray(x.tags) ? x.tags.filter(Boolean).map(String) : [],
    color: CARD_COLORS.some((c) => c.id === x.color) ? x.color : 'none',
    scale: clampScale(x.scale),
    createdAt: x.createdAt || now(),
  };
  if (x.reminder?.at) base.reminder = { at: x.reminder.at, lead: Number(x.reminder.lead) || 0 };
  if (kind === 'reminder') return { ...base, text: String(x.text ?? ''), done: !!x.done };
  if (kind === 'todo') {
    const list = (Array.isArray(x.list) ? x.list : []).filter((r) => r && typeof r === 'object').map(normalizeRow);
    return { ...base, title: String(x.title ?? ''), list, updatedAt: x.updatedAt || base.createdAt };
  }
  return { ...base, title: String(x.title ?? ''), body: String(x.body ?? ''), updatedAt: x.updatedAt || base.createdAt };
}

// Folds every historical shape into { v, items }. Lossless and idempotent.
export function migrateNotes(d) {
  let raw;
  if (Array.isArray(d?.items)) raw = d.items;
  else if (Array.isArray(d?.todos) || Array.isArray(d?.notes)) {
    // the original {todos,notes} split — those todos are single-line tasks, i.e. reminders
    raw = [
      ...(Array.isArray(d.notes) ? d.notes : []).map((n) => ({ ...n, kind: 'note' })),
      ...(Array.isArray(d.todos) ? d.todos : []).map((t) => ({ ...t, kind: 'reminder' })),
    ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } else raw = [];
  // drop junk entries rather than materialising phantom empty notes from them
  return { v: SCHEMA_V, items: raw.filter((x) => x && typeof x === 'object').map(normalize) };
}

async function load() { return migrateNotes(await getKey(NOTES_KEY, {})); }

// Re-create alarms for every future reminder. chrome.alarms only ever gained entries at
// set-time, so an import, a Drive restore or a fresh profile left reminders with nothing
// behind them. Cheap and idempotent — creating an alarm with the same name replaces it.
export async function rearmAlarms() {
  if (!chrome.alarms?.create) return 0;
  const { items } = await load();
  let n = 0;
  for (const it of items) {
    if (!it.reminder || it.done) continue;
    const at = fireTime(it.reminder);
    if (at > Date.now()) { armAlarm(it.id, at); n++; }
  }
  return n;
}

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

async function mutate(fn, { rerender = true } = {}) {
  selfWrites.push(Date.now());
  await update(NOTES_KEY, {}, (d) => { const draft = migrateNotes(d); fn(draft); return draft; });
  if (rerender) await render();
}
const findItem = (d, id) => d.items.find((x) => x.id === id);

/* ————— debounced text saves —————
   Keystrokes accumulate in `pending` and flush as one write. Paths address either a
   top-level field ('title' | 'body' | 'text') or a checklist row ('row:<rowId>'), because
   a flat id→field map cannot reach list[3].text. Any structural change flushes first, so a
   re-render can never resurrect a stale value over what the user has already typed. */
const pending = new Map(); // cardId -> { [path]: value }
let saveTimer = null;
function queueSave(id, path, value) {
  pending.set(id, { ...(pending.get(id) || {}), [path]: value });
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
      for (const [path, value] of Object.entries(fields)) {
        if (path.startsWith('row:')) {
          const row = x.list?.find((r) => r.id === path.slice(4));
          if (row) row.text = value;
        } else x[path] = value;
      }
      if (x.kind !== 'reminder') x.updatedAt = now();
    }
  }, { rerender: false });
}

/* ————————————————————————— render ————————————————————————— */

let renderPending = false;
function editingInMosaic() {
  const a = document.activeElement;
  return !!(a && shell?.host.contains(a) && /^(input|textarea)$/i.test(a.tagName));
}
function scheduleRender() {
  if (editingInMosaic()) { renderPending = true; return; }
  render();
}

// open work = unticked reminders + unticked checklist rows
const openCount = (items) => items.reduce((n, i) =>
  n + (i.kind === 'reminder' ? (i.done ? 0 : 1) : 0)
    + (i.kind === 'todo' ? (i.list || []).filter((r) => !r.done).length : 0), 0);

// everything a card can be searched by, checklist rows included
const searchText = (i) => [i.text, i.title, i.body, (i.tags || []).join(' '), (i.list || []).map((r) => r.text).join(' ')];

export async function render() {
  const { items } = await load();
  const q = getQuery ? getQuery() : '';

  const open = openCount(items);
  if (countEl) countEl.textContent = open ? String(open) : '';

  if (!shell || !root.contains(shell.wrap)) buildShell();
  const lists = items.filter((i) => i.kind === 'todo').length;
  const notes = items.filter((i) => i.kind === 'note').length;
  shell.sub.textContent = `${open} open · ${lists} list${lists === 1 ? '' : 's'} · ${notes} note${notes === 1 ? '' : 's'}`;

  const shown = q ? items.filter((i) => matches(q, ...searchText(i))) : items;
  const focus = snapshotFocus();
  if (!shown.length) {
    shell.host.replaceChildren(el('div', { class: 'notes-empty big' },
      q ? 'Nothing here matches your search.'
        : el('span', {}, 'Nothing yet — add a reminder above, or start a ',
            el('button', { class: 'linkbtn', onclick: () => newItem('todo') }, el('span', { text: 'to-do list' })), ' or a ',
            el('button', { class: 'linkbtn', onclick: () => newItem('note') }, el('span', { text: 'note' })), '.')));
  } else {
    const mosaic = el('div', { class: 'mosaic' });
    for (const it of shown) mosaic.append(itemCard(it));
    shell.host.replaceChildren(mosaic);
  }
  restoreFocus(focus);
  syncFormatBar();
}

// Where the caret was, in terms that survive a rebuild. The ROW id matters: a checklist
// has many fields sharing one class, and querySelector('.check-text') would always return
// row 0 — throwing the caret to the top of the list on every render.
function snapshotFocus() {
  const a = document.activeElement;
  if (!a || !shell?.host.contains(a) || !/^(input|textarea)$/i.test(a.tagName)) return null;
  let start = null, end = null;
  try { start = a.selectionStart; end = a.selectionEnd; } catch { /* type doesn't expose a selection */ }
  return {
    card: a.closest('.mos-card')?.dataset.id || null,
    row: a.closest('[data-row]')?.dataset.row || null,
    cls: a.classList[0], start, end,
  };
}
function restoreFocus(s) {
  if (!s || !s.cls) return;
  const card = s.card ? shell.host.querySelector(`.mos-card[data-id="${CSS.escape(s.card)}"]`) : shell.host;
  if (!card) return;
  const scope = s.row ? card.querySelector(`[data-row="${CSS.escape(s.row)}"]`) : card;
  const node = scope?.querySelector('.' + s.cls);
  if (!node) return;
  node._showSource?.();   // a rendered line hides its input; focusing a hidden node is a no-op
  node.focus({ preventScroll: true });
  if (s.start != null) { try { node.setSelectionRange(s.start, s.end); } catch { /* not selectable */ } }
}

function buildShell() {
  const sub = el('p', { class: 'notes-sub' });
  const host = el('div', { class: 'mosaic-host' });
  host.addEventListener('focusout', () => setTimeout(() => {
    if (editingInMosaic()) return;
    flushSaves();
    hideFormatBar();
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

// quick-add a reminder, plus a New menu for all three kinds
function composer() {
  const input = el('input', { class: 'todo-add', placeholder: 'Add a reminder…', 'aria-label': 'Add a reminder' });
  const add = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await flushSaves();
    await mutate((d) => { d.items.unshift(normalize({ kind: 'reminder', text })); });
    input.focus();          // stay put so reminders can be typed one after another
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return el('div', { class: 'mos-composer' },
    el('div', { class: 'todo-addrow' }, icon('plus', 15), input),
    menuButton('New', 'plus', [
      { label: 'New note', run: () => newItem('note') },
      { label: 'New to-do list', run: () => newItem('todo') },
      { label: 'New reminder', run: () => newItem('reminder') },
    ], 'primary'),
  );
}

async function newItem(kind) {
  const id = uid();
  const rowId = uid();
  await flushSaves();
  await mutate((d) => {
    // a new list starts with one blank row so there is something to type into
    d.items.unshift(normalize(kind === 'todo' ? { id, kind, list: [{ id: rowId, text: '' }] } : { id, kind }));
  });
  focusItem(id);
}

function focusItem(id) {
  const card = shell?.host.querySelector(`.mos-card[data-id="${CSS.escape(id)}"]`);
  card?.querySelector('.card-title, .note-title, .check-text, .todo-text-in')?.focus();
}
function focusRow(cardId, rowId) {
  shell?.host.querySelector(`.mos-card[data-id="${CSS.escape(cardId)}"] [data-row="${CSS.escape(rowId)}"] .check-text`)?.focus();
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

const cardDone = (it) => it.kind === 'reminder' && it.done;

function itemCard(it) {
  const card = el('article', {
    class: `mos-card is-${it.kind}${cardDone(it) ? ' is-done' : ''} c-${it.color || 'none'}`,
    draggable: 'true', dataset: { id: it.id, kind: it.kind },
    style: `--card-scale:${it.scale || DEFAULT_SCALE}`,
  });
  card.append(it.kind === 'reminder' ? reminderBody(it) : it.kind === 'todo' ? todoBody(it) : noteBody(it));

  const chips = el('div', { class: 'mos-chips' });
  if (it.reminder) chips.append(reminderChip(it));
  (it.tags || []).forEach((t) => chips.append(tagChip(it, t)));
  if (chips.children.length) card.append(chips);

  const label = KIND_LABEL[it.kind];
  card.append(el('div', { class: 'mos-foot' },
    el('span', { class: 'mos-grip', title: 'Drag to reorder' }, icon('grip', 13)),
    el('span', { class: 'mos-when', text: it.kind === 'reminder' ? '' : shortDate(it.updatedAt || it.createdAt) }),
    el('div', { class: 'mos-acts' },
      actionBtn('bell', it.reminder ? 'Edit reminder' : 'Set reminder', (_, b) => openReminderEditor(b, it), it.reminder ? 'rem-bell on' : 'rem-bell'),
      actionBtn('tag', 'Tags', (_, b) => openTagPicker(b, it)),
      actionBtn('palette', 'Card colour', (_, b) => openColorPicker(b, it)),
      actionBtn('close', `Delete ${label}`, () => removeCard(it), 'danger'),
    ),
  ));

  wireDrag(card, it);
  return card;
}

/* ——— reminder card: one checkable line ——— */

function reminderBody(it) {
  const box = checkbox(it.done, it.text || 'Reminder', async () => {
    await flushSaves();
    await mutate((d) => { const x = findItem(d, it.id); if (x) x.done = !x.done; });
    if (!it.done) clearAlarm(it.id);                              // now done — stop nagging
    else if (it.reminder) armAlarm(it.id, fireTime(it.reminder));  // re-opened — re-arm
  });
  const input = el('input', { class: 'todo-text-in', value: it.text || '', placeholder: 'Reminder', 'aria-label': 'Reminder' });
  wireField(input);
  input.addEventListener('input', () => queueSave(it.id, 'text', input.value));
  input.addEventListener('keydown', (e) => onReminderKey(e, it, input));
  return el('div', { class: 'todo-line' }, box, input, lineView(input));
}

// Enter → a fresh reminder card below this one. Backspace in an empty one removes it.
async function onReminderKey(e, it, input) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const id = uid();
    await flushSaves();
    await mutate((d) => {
      const i = d.items.findIndex((x) => x.id === it.id);
      d.items.splice(i < 0 ? d.items.length : i + 1, 0, normalize({ id, kind: 'reminder' }));
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

/* ——— todo card: a checklist, many items under one title ——— */

function todoBody(it) {
  const title = el('input', { class: 'card-title', value: it.title || '', placeholder: 'List title', 'aria-label': 'List title' });
  wireField(title);
  title.addEventListener('input', () => queueSave(it.id, 'title', title.value));
  title.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = it.list?.[0];
    if (first) focusRow(it.id, first.id); else addRow(it, -1);
  });

  const rows = el('div', { class: 'check-rows' });
  (it.list || []).forEach((r) => rows.append(checkRow(it, r)));

  const done = (it.list || []).filter((r) => r.done).length;
  const total = (it.list || []).length;

  return el('div', { class: 'note-lines' }, title, rows,
    el('button', { class: 'check-add', onclick: () => addRow(it, total - 1) }, icon('plus', 12), el('span', { text: 'Add item' })),
    total ? el('div', { class: 'check-prog', text: `${done} of ${total} done` }) : null,
  );
}

function checkRow(it, r) {
  const row = el('div', { class: `check-row${r.done ? ' is-done' : ''}`, dataset: { row: r.id } });
  const box = checkbox(r.done, r.text || 'Item', async () => {
    await flushSaves();
    await mutate((d) => {
      const x = findItem(d, it.id);
      const row2 = x?.list?.find((y) => y.id === r.id);
      if (row2) row2.done = !row2.done;
    });
  });
  const input = el('input', { class: 'check-text', value: r.text || '', placeholder: 'Item', 'aria-label': 'List item' });
  wireField(input);
  input.addEventListener('input', () => queueSave(it.id, `row:${r.id}`, input.value));
  input.addEventListener('keydown', (e) => onRowKey(e, it, r, input));
  row.append(box, input, lineView(input), actionBtn('close', 'Remove item', () => removeRow(it, r), 'row-x'));
  return row;
}

// Enter adds the next item under this one — "add todo under the same list". Backspace in
// an empty item removes it and steps back up, so a stray Enter never strands a blank row.
async function onRowKey(e, it, r, input) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const at = (it.list || []).findIndex((x) => x.id === r.id);
    await addRow(it, at);
    return;
  }
  if (e.key === 'Escape') { input.blur(); return; }
  if (e.key === 'Backspace' && !input.value && (it.list || []).length > 1) {
    e.preventDefault();
    await removeRow(it, r, { silent: true });
  }
}

async function addRow(it, afterIndex) {
  const id = uid();
  await flushSaves();
  await mutate((d) => {
    const x = findItem(d, it.id);
    if (!x) return;
    if (!Array.isArray(x.list)) x.list = [];
    x.list.splice(afterIndex < 0 ? x.list.length : afterIndex + 1, 0, normalizeRow({ id }));
    x.updatedAt = now();
  });
  focusRow(it.id, id);
}

async function removeRow(it, r, { silent = false } = {}) {
  const path = `row:${r.id}`;
  const p = pending.get(it.id);
  if (p) { delete p[path]; if (!Object.keys(p).length) pending.delete(it.id); }
  let prevId = null;
  await flushSaves();
  await mutate((d) => {
    const x = findItem(d, it.id);
    const i = x?.list?.findIndex((y) => y.id === r.id) ?? -1;
    if (i < 0) return;
    prevId = x.list[i - 1]?.id || null;
    x.list.splice(i, 1);
    x.updatedAt = now();
  });
  if (silent && prevId) focusRow(it.id, prevId);
}

/* ——— note card: title + markdown body ——— */

function noteBody(it) {
  const title = el('input', { class: 'card-title', value: it.title || '', placeholder: 'Title', 'aria-label': 'Note title' });
  wireField(title);
  title.addEventListener('input', () => queueSave(it.id, 'title', title.value));

  const body = el('textarea', { class: 'note-body', placeholder: 'Write… (markdown works)', 'aria-label': 'Note body', rows: '3' });
  body.value = it.body || '';
  wireField(body);
  const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight, 460) + 'px'; };
  body.addEventListener('input', () => { grow(); queueSave(it.id, 'body', body.value); });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); } });

  // Rendered markdown when the card is at rest; raw source the moment you edit it. The
  // swap is local to this card and driven by focus — never by a render — so it cannot
  // pull the field out from under the caret.
  const preview = el('div', { class: 'note-md', title: 'Click to edit' });
  const lines = el('div', { class: 'note-lines' }, title, body, preview);

  const showSource = (focusIt) => {
    preview.hidden = true; body.hidden = false;
    grow();
    if (focusIt) { body.focus(); try { body.setSelectionRange(body.value.length, body.value.length); } catch { /* ignore */ } }
  };
  const showPreview = () => {
    const src = body.value;
    if (!src.trim()) { showSource(false); return; }   // empty note keeps its placeholder
    preview.innerHTML = renderMarkdown(src);
    preview.hidden = false; body.hidden = true;
  };
  body.addEventListener('focus', () => showSource(false));
  body.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== body) showPreview(); }, 0));
  // a click on a link opens it; a click anywhere else drops into the source
  preview.addEventListener('click', (e) => { if (!e.target.closest('a')) showSource(true); });

  showPreview();
  return lines;
}

/* ——— shared bits ——— */

// Formatting has to be VISIBLE, or the B/I/U/S buttons just litter the text with markers.
// A single-line field therefore renders its inline markdown at rest and shows the source
// the moment you edit it — the same deal as a note body, and the swap is local to this one
// field (driven by its own focus/blur), so it can never disturb the caret anywhere else.
// A line with no markdown in it never swaps at all: the input stays, directly typable.
function lineView(input) {
  const view = el('span', { class: 'line-md', title: 'Click to edit' });
  const showSource = (focusIt) => {
    view.hidden = true; input.hidden = false;
    if (focusIt) { input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* ignore */ } }
  };
  const showView = () => {
    if (!hasInlineMarkdown(input.value)) { showSource(false); return; }
    view.innerHTML = renderInline(input.value);
    view.hidden = false; input.hidden = true;
  };
  input._showSource = showSource;      // restoreFocus needs to reveal a hidden field first
  input.addEventListener('focus', () => showSource(false));
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) showView(); }, 0));
  view.addEventListener('click', (e) => { if (!e.target.closest('a')) showSource(true); });
  showView();
  return view;
}

function checkbox(done, label, onToggle) {
  return el('button', {
    class: `todo-check${done ? ' is-done' : ''}`, role: 'checkbox',
    'aria-checked': String(!!done), 'aria-label': label, onclick: onToggle,
  }, done ? icon('check', 13) : null);
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

/* ————————————————————————— formatting bar ————————————————————————— */
//
// ONE shared bar, parked in <body> and moved to whichever field has focus — rather than
// six more buttons on every card. The card footer already carries a grip, a date and four
// actions inside a 250px column; adding B/I/U/S/A+/A− per card would overflow it. Only one
// field can be focused at a time, so one bar is all that can ever be needed.

// formatField is the ONLY state, and it is re-derived from document.activeElement after every
// render (see syncFormatBar) — caching the item alongside it went stale the moment a render
// replaced the card, leaving the buttons editing a detached input.
let formatBar = null, formatField = null;

function buildFormatBar() {
  const mk = (name, action, title, key) => {
    const b = el('button', { class: 'fmt-btn', title: key ? `${title} (${key})` : title, 'aria-label': title });
    b.append(icon(name, 14));
    b.addEventListener('mousedown', (e) => e.preventDefault());   // never steal focus from the field
    b.addEventListener('click', () => action());
    return b;
  };
  const bar = el('div', { class: 'fmt-bar', role: 'toolbar', 'aria-label': 'Text formatting' },
    mk('bold', () => runFormat('bold'), 'Bold', '⌘B'),
    mk('italic', () => runFormat('italic'), 'Italic', '⌘I'),
    mk('underline', () => runFormat('underline'), 'Underline', '⌘U'),
    mk('strike', () => runFormat('strike'), 'Strikethrough'),
    el('span', { class: 'fmt-sep' }),
    mk('textUp', () => runScale(1), 'Bigger text'),
    mk('textDown', () => runScale(-1), 'Smaller text'),
  );
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  document.body.append(bar);
  return bar;
}

function runFormat(action) {
  if (!formatField) return;
  toggleFormat(formatField, action);
  formatField.dispatchEvent(new Event('input', { bubbles: true }));  // trip the autosave
}

// Reads the current scale off the card rather than from cached state, so it is always in step
// with what is on screen.
async function runScale(dir) {
  const card = formatField?.closest('.mos-card');
  if (!card) return;
  const current = parseFloat(card.style.getPropertyValue('--card-scale')) || DEFAULT_SCALE;
  const next = stepScale(current, dir);
  if (next === current) return;
  card.style.setProperty('--card-scale', String(next));   // instant, and the caret never moves
  await mutate((d) => { const x = findItem(d, card.dataset.id); if (x) x.scale = next; }, { rerender: false });
  if (formatField?.tagName === 'TEXTAREA') {
    formatField.style.height = 'auto';
    formatField.style.height = Math.min(formatField.scrollHeight, 460) + 'px';
  }
  placeFormatBar();
}

// After a render the old field node is detached; re-point at whatever now has focus, or hide.
function syncFormatBar() {
  if (!formatBar || formatBar.hidden) return;
  const a = document.activeElement;
  if (a && shell?.host.contains(a) && /^(input|textarea)$/i.test(a.tagName)) {
    formatField = a;
    placeFormatBar();
  } else hideFormatBar();
}

function placeFormatBar() {
  if (!formatBar || !formatField) return;
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  const r = formatField.getBoundingClientRect();
  const br = formatBar.getBoundingClientRect();
  const m = 8;
  let top = r.bottom + 6;
  if (top + br.height > innerHeight - m) top = Math.max(m, r.top - 6 - br.height);
  const left = Math.min(Math.max(m, r.left), Math.max(m, innerWidth - br.width - m));
  formatBar.style.left = `${left / zoom}px`;
  formatBar.style.top = `${top / zoom}px`;
}

function showFormatBar(field) {
  formatField = field;
  if (!formatBar) {
    formatBar = buildFormatBar();
    // the mosaic scrolls inside the view, so the bar has to travel with its field
    addEventListener('scroll', () => { if (formatBar && !formatBar.hidden) placeFormatBar(); }, true);
    addEventListener('resize', () => { if (formatBar && !formatBar.hidden) placeFormatBar(); });
  }
  formatBar.hidden = false;
  placeFormatBar();
}
function hideFormatBar() {
  if (formatBar) formatBar.hidden = true;
  formatField = null;
}

// Every formattable field gets the bar on focus and the keyboard shortcuts. Cmd/Ctrl+B/I/U
// are stopped here so they never reach app.js's Cmd+K / "/" handler; history.js already
// ignores Cmd+Z while a field is focused, leaving native text undo intact.
function wireField(field) {
  field.addEventListener('focus', () => showFormatBar(field));
  field.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const action = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault(); e.stopPropagation();
    runFormat(action);
  });
}

/* ————————————————————————— delete (undoable) ————————————————————————— */

const hasContent = (it) => it.kind === 'reminder' ? !!it.text
  : it.kind === 'todo' ? !!(it.title || (it.list || []).some((r) => r.text))
  : !!(it.title || it.body);

async function removeCard(it) {
  const label = KIND_LABEL[it.kind];
  if (hasContent(it) && !(await confirmDialog({
    title: `Delete ${label}?`,
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
    if (!e.dataTransfer.types.includes(MOS_MIME)) return;   // ignore anything that isn't a card drag
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
  if (renderPending && !editingInMosaic()) { renderPending = false; render(); }
}
function onPopDown(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
function onPopKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } }
function onPopScroll(e) { if (openPop && !openPop.contains(e.target)) closePop(); }

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
    await mutate((d) => {
      const x = findItem(d, it.id);
      if (!x) return;
      if (x.kind === 'reminder') x.done = false;   // re-open a ticked reminder you just re-scheduled
      x.reminder = { at: target.toISOString(), lead: leadV };
    });
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
  { h: 'Three kinds of card', icon: 'checklist', rows: [
    ['Note', 'A title and a free-form body. The body understands Markdown — see below.'],
    ['To-do list', 'A title and a checklist. Press Enter in an item to add the next one under it, so a whole list lives on one card.'],
    ['Reminder', 'A single checkable line, on its own card. This is what used to be called a todo.'],
    ['New ▾', 'Starts any of the three. The bar at the top quick-adds a reminder — press Enter and keep typing for the next one.'],
    ['Autosave', 'Everything saves as you type. There is no Save button and nothing to lose.'],
  ] },
  { h: 'Formatting', icon: 'bold', rows: [
    ['The bar', 'Click into any text field and a formatting bar appears beneath it.'],
    ['B / I / U / S', 'Bold, italic, underline, strikethrough. With nothing selected it formats the word the caret is in; press again to remove it.'],
    ['⌘B / ⌘I / ⌘U', 'The same, from the keyboard (Ctrl on Windows and Linux).'],
    ['A+ / A−', 'Makes everything on that one card bigger or smaller — five steps. Independent of the global interface size in Settings.'],
    ['Undo', 'Formatting goes through the browser’s own text undo, so ⌘Z inside a field steps back through it normally.'],
  ] },
  { h: 'Markdown', icon: 'note', rows: [
    ['Where', 'The body of a note. Click away and it renders; click back in and you get the source.'],
    ['Inline', '**bold**, *italic*, ~~strikethrough~~, `code`, <u>underline</u>, and [links](https://example.com).'],
    ['Blocks', '# headings, - bullet lists, 1. numbered lists, > quotes, ``` code fences, --- rules, and - [ ] task lines.'],
    ['Safety', 'Anything pasted or imported is escaped before it is rendered, and only http, https and mailto links are clickable.'],
  ] },
  { h: 'Organising', icon: 'grip', rows: [
    ['Drag to reorder', 'Grab a card by the ⣿ handle in its footer and drop it above or below any other card.'],
    ['Tags', 'The tag button adds any label you like — Enter or comma between them. Click a tag on a card to remove it.'],
    ['Colour', 'Six translucent pastel washes. They sit over the card surface, so they stay readable in light and dark.'],
    ['Search', 'The search box at the top of the window filters cards by title, body, reminder text, checklist items and tags.'],
  ] },
  { h: 'Reminders', icon: 'bell', rows: [
    ['Set one', 'The bell on any card — note, list or reminder. Pick a date and time, then how early to be told.'],
    ['Lead time', 'At the time of the event, or 5 / 10 / 30 minutes or 1 hour before it.'],
    ['Timezone', 'Times are your computer’s local time. Travelling changes when a reminder lands, as you would expect.'],
    ['Where it appears', 'A browser notification, even with no StackNest tab open. Chrome must be running; ones missed while it was closed fire at next launch.'],
    ['Ticking it off', 'Ticking a reminder cancels its notification. Un-ticking re-arms it.'],
  ] },
  { h: 'Undo', icon: 'undo', rows: [
    ['⌘Z / Ctrl+Z', 'Puts a deleted card back exactly where it was, with its items, tags, colour and reminder intact.'],
    ['⇧⌘Z / Ctrl+Y', 'Redo — deletes it again.'],
    ['Undo bar', 'A snackbar appears after every delete with a one-click Undo.'],
    ['Scope', 'The undo stack lasts for this tab’s session, and never reverts edits you made after the delete.'],
  ] },
  { h: 'Backup & sync', icon: 'cloud', rows: [
    ['Export', 'Notes only (a small JSON of just this view) or a full StackNest backup that carries notes alongside spaces and collections.'],
    ['Import', 'Reads either file, old or new. Imported cards are added to what you already have — never replacing it — with fresh ids so nothing collides.'],
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
  exportDownload(`stacknest-notes-${stamp()}.json`,
    JSON.stringify({ app: 'StackNest', type: 'notes', version: SCHEMA_V, exportedAt: now(), items }, null, 2), 'application/json');
  toast(`Exported ${items.length} card${items.length === 1 ? '' : 's'}`);
}

async function importFromFile() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON'); return; }
  // a notes-only file of any version, or a full backup carrying any of them
  const blob = data?.type === 'notes' ? data
    : (data?.notes && typeof data.notes === 'object' && !Array.isArray(data.notes) ? data.notes : null);
  const incoming = blob ? migrateNotes(blob).items : [];
  if (!incoming.length) { toast('No notes or reminders found in that file'); return; }
  const ok = await confirmDialog({ title: 'Import notes?', message: `Add ${incoming.length} card${incoming.length === 1 ? '' : 's'} to what you already have?`, confirmLabel: 'Import' });
  if (!ok) return;
  await mergeIn(incoming);
  toast(`Imported ${incoming.length} card${incoming.length === 1 ? '' : 's'}`);
}

// Add imported cards with fresh ids so nothing collides — checklist ROW ids too, since two
// imported cards can carry the same row id and row-addressed saves would cross over.
async function mergeIn(list) {
  await flushSaves();
  await mutate((d) => {
    for (const x of [...list].reverse()) {
      const fresh = normalize({ ...x, id: uid() });
      if (Array.isArray(fresh.list)) fresh.list = fresh.list.map((r) => ({ ...r, id: uid() }));
      d.items.unshift(fresh);
    }
  });
  await rearmAlarms();
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
  if (r) { await rearmAlarms(); toast('Restored from Drive'); }
}
