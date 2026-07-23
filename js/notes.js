// Notes & Todos view. A calm scratchpad next to your tabs: a quick task checklist
// and free-form notes, both kept in chrome.storage.local under one key so they ride
// along in the full backup (local export/import + Google Drive sync). Apple Notes has
// no API a browser extension can reach, so import is by pasting exported text.

import { el, icon, actionBtn, toast, confirmDialog, exportDownload, pickFile, matches, debounce, shortDate } from './ui.js';
import { getKey, update } from './store.js';
import { exportBackup } from './backup.js';
import { backupNow, restoreLatest, loadCloudState } from './drive.js';

export const NOTES_KEY = 'stacknest:notes';

const uid = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.round(Math.random() * 1e6)}`);
const now = () => new Date().toISOString();

/* ————— reminders ————— */
// A task reminder is { at: <ISO of the target date/time, in the user's local zone>,
// lead: <minutes before to notify: 0|5|10|30|60> }. The notification fires at
// (at − lead). All maths is in absolute epoch ms, so local timezone is handled for
// free — the datetime-local input is read as local time and Date gives UTC ms.
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
// chrome.alarms is absent in the dev preview — guard so the UI still works there
const armAlarm = (id, fireMs) => { if (fireMs > Date.now()) chrome.alarms?.create(remName(id), { when: fireMs }); };
const clearAlarm = (id) => chrome.alarms?.clear(remName(id));
const pad2 = (n) => String(n).padStart(2, '0');
// format a Date as a local <input type=datetime-local> value (YYYY-MM-DDTHH:MM)
const toLocalInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

let root, getQuery, countEl;

export function initNotes(options) {
  ({ root, getQuery, countEl } = options);
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && c[NOTES_KEY]) render(); });
  render();
  return { render };
}

async function load() {
  const d = await getKey(NOTES_KEY, {});
  return {
    todos: Array.isArray(d?.todos) ? d.todos : [],
    notes: Array.isArray(d?.notes) ? d.notes : [],
  };
}
// serialized read-modify-write; fn mutates the {todos, notes} draft in place
function mutate(fn) {
  return update(NOTES_KEY, { todos: [], notes: [] }, (d) => {
    const draft = { todos: Array.isArray(d?.todos) ? d.todos : [], notes: Array.isArray(d?.notes) ? d.notes : [] };
    fn(draft);
    return draft;
  });
}

/* ————————————————————————— render ————————————————————————— */

export async function render() {
  const { todos, notes } = await load();
  const q = getQuery ? getQuery() : '';

  const open = todos.filter((t) => !t.done).length;
  if (countEl) countEl.textContent = open ? String(open) : '';

  const frag = document.createDocumentFragment();
  frag.append(headerBar(todos, notes));
  frag.append(el('div', { class: 'notes-cols' },
    todoPanel(todos, q),
    notesPanel(notes, q),
  ));
  root.replaceChildren(frag);
}

function headerBar(todos, notes) {
  const open = todos.filter((t) => !t.done).length;
  const sub = `${open} open task${open === 1 ? '' : 's'} · ${notes.length} note${notes.length === 1 ? '' : 's'}`;
  return el('div', { class: 'notes-head' },
    el('div', { class: 'notes-h-text' },
      el('h2', { class: 'notes-title', text: 'Notes & Todos' }),
      el('p', { class: 'notes-sub', text: sub }),
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
    ),
  );
}

// A tiny click-to-open menu (progressive disclosure — one button, actions on demand).
function menuButton(label, iconName, items) {
  const menu = el('div', { class: 'notes-menu', hidden: 'true' },
    ...items.map((it) => el('button', { class: 'notes-menu-item', onclick: () => { close(); it.run(); } }, el('span', { text: it.label }))));
  const btn = el('button', { class: 'btnx soft notes-tool', onclick: (e) => { e.stopPropagation(); toggle(); } },
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

/* ————————————————————————— todos ————————————————————————— */

function todoPanel(todos, q) {
  const panel = el('section', { class: 'todo-panel' });
  const input = el('input', { class: 'todo-add', placeholder: 'Add a task…', 'aria-label': 'Add a task' });
  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    mutate((d) => { d.todos.unshift({ id: uid(), text, done: false, createdAt: now() }); });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  panel.append(
    el('div', { class: 'panel-head' }, el('h3', { class: 'panel-h', text: 'Todos' })),
    el('div', { class: 'todo-addrow' }, icon('plus', 15), input),
  );

  // open tasks first (newest on top), then done at the bottom
  const filtered = q ? todos.filter((t) => matches(q, t.text)) : todos;
  const ordered = [...filtered].sort((a, b) => Number(a.done) - Number(b.done));
  const list = el('div', { class: 'todo-list' });
  if (!ordered.length) {
    list.append(el('div', { class: 'notes-empty', text: q ? 'No tasks match your search.' : 'No tasks yet — add one above.' }));
  } else {
    for (const t of ordered) list.append(todoRow(t));
  }
  panel.append(list);

  if (todos.some((t) => t.done)) {
    panel.append(el('div', { class: 'todo-foot' },
      el('button', { class: 'linkbtn', onclick: () => mutate((d) => { d.todos = d.todos.filter((t) => !t.done); }) }, el('span', { text: 'Clear completed' }))));
  }
  return panel;
}

function todoRow(t) {
  const box = el('button', {
    class: `todo-check${t.done ? ' is-done' : ''}`, role: 'checkbox', 'aria-checked': String(t.done), 'aria-label': t.text,
    onclick: async () => {
      await mutate((d) => { const it = d.todos.find((x) => x.id === t.id); if (it) it.done = !it.done; });
      if (!t.done) clearAlarm(t.id);                    // was open → now done: stop nagging
      else if (t.reminder) armAlarm(t.id, fireTime(t.reminder)); // re-opened: re-arm a future reminder
    },
  }, t.done ? icon('check', 13) : null);

  const label = el('span', { class: 'todo-text', text: t.text, title: 'Click to edit', tabindex: '0' });
  const beginEdit = () => {
    const edit = el('input', { class: 'todo-edit', value: t.text });
    const commit = () => {
      const v = edit.value.trim();
      if (v && v !== t.text) mutate((d) => { const it = d.todos.find((x) => x.id === t.id); if (it) it.text = v; });
      else render();
    };
    edit.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); edit.blur(); } if (e.key === 'Escape') render(); });
    edit.addEventListener('blur', commit);
    label.replaceWith(edit);
    edit.focus(); edit.select();
  };
  label.addEventListener('click', beginEdit);
  label.addEventListener('keydown', (e) => { if (e.key === 'Enter') beginEdit(); });

  const main = el('div', { class: 'todo-main' }, label);
  if (t.reminder) main.append(reminderChip(t));

  // the bell stays visible (unlike the hover-only delete) so reminders are discoverable
  const bell = actionBtn('bell', t.reminder ? 'Edit reminder' : 'Set reminder', (_, btn) => openReminderEditor(btn, t), t.reminder ? 'rem-bell on' : 'rem-bell');
  const del = actionBtn('close', 'Delete task', () => { clearAlarm(t.id); mutate((d) => { d.todos = d.todos.filter((x) => x.id !== t.id); }); }, 'danger');
  return el('div', { class: `todo-row${t.done ? ' is-done' : ''}` }, box, main, el('div', { class: 'todo-acts' }, bell, del));
}

function reminderChip(t) {
  const at = new Date(t.reminder.at);
  const past = fireTime(t.reminder) <= Date.now();
  const when = at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const lead = LEAD_CHIP[t.reminder.lead] || '';
  return el('button', {
    class: `todo-rem-chip${past ? ' past' : ''}`, title: past ? 'Reminder time passed — click to change' : 'Edit reminder',
    onclick: (_, btn) => openReminderEditor(btn, t),
  }, icon('bell', 11), el('span', { text: when + (lead ? ` · ${lead}` : '') }));
}

// Popover to set/clear a task reminder. Clamped to the viewport (zoom-aware).
let openRem = null;
function closeReminderEditor() {
  if (!openRem) return;
  openRem.remove(); openRem = null;
  document.removeEventListener('mousedown', onRemDown, true);
  document.removeEventListener('keydown', onRemKey, true);
  document.removeEventListener('scroll', onRemScroll, true);
}
function onRemDown(e) { if (openRem && !openRem.contains(e.target)) closeReminderEditor(); }
function onRemKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeReminderEditor(); } }
function onRemScroll(e) { if (openRem && !openRem.contains(e.target)) closeReminderEditor(); }

function openReminderEditor(anchor, t) {
  closeReminderEditor();
  // default: existing reminder, else the next round 5-minute slot an hour out
  const start = t.reminder ? new Date(t.reminder.at) : new Date(Date.now() + 60 * 60000);
  if (!t.reminder) start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);
  const dt = el('input', { type: 'datetime-local', class: 'rem-dt', value: toLocalInput(start), 'aria-label': 'Reminder date and time' });
  const lead = el('select', { class: 'rem-lead', 'aria-label': 'How early to notify' },
    ...LEADS.map((l) => el('option', { value: String(l.v), ...(t.reminder?.lead === l.v ? { selected: 'true' } : {}) }, el('span', { text: l.label }))));

  const hint = el('div', { class: 'rem-hint' });
  const refresh = () => {
    const target = new Date(dt.value);
    if (isNaN(target)) { hint.textContent = 'Pick a date & time.'; return; }
    const fireMs = target.getTime() - Number(lead.value) * 60000;
    hint.textContent = fireMs <= Date.now()
      ? 'That’s in the past — pick a later time.'
      : `Notifies ${new Date(fireMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  };
  dt.addEventListener('input', refresh); lead.addEventListener('change', refresh); refresh();

  const setBtn = el('button', { class: 'btnx primary rem-set', onclick: async () => {
    const target = new Date(dt.value);
    if (isNaN(target)) { toast('Pick a date & time'); return; }
    const leadV = Number(lead.value);
    const fireMs = target.getTime() - leadV * 60000;
    if (fireMs <= Date.now()) { toast('That reminder time is in the past'); return; }
    await mutate((d) => { const it = d.todos.find((x) => x.id === t.id); if (it) { it.done = false; it.reminder = { at: target.toISOString(), lead: leadV }; } });
    armAlarm(t.id, fireMs);
    closeReminderEditor();
    toast('Reminder set');
  } }, el('span', { text: t.reminder ? 'Update' : 'Set reminder' }));

  const clearBtn = t.reminder ? el('button', { class: 'btnx ghosty rem-clear', onclick: async () => {
    await mutate((d) => { const it = d.todos.find((x) => x.id === t.id); if (it) delete it.reminder; });
    clearAlarm(t.id);
    closeReminderEditor();
    toast('Reminder cleared');
  } }, el('span', { text: 'Clear' })) : null;

  const pop = el('div', { class: 'rem-pop', role: 'dialog', 'aria-label': 'Set reminder' },
    el('div', { class: 'rem-h' }, icon('bell', 13), el('span', { text: 'Reminder' })),
    el('label', { class: 'rem-field' }, el('span', { class: 'rem-lbl', text: 'Date & time' }), dt),
    el('label', { class: 'rem-field' }, el('span', { class: 'rem-lbl', text: 'Remind me' }), lead),
    hint,
    el('div', { class: 'rem-actions' }, clearBtn, setBtn),
  );
  pop.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.append(pop);
  openRem = pop;

  // place under the anchor, clamped to the viewport (divide by zoom for layout px)
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  const r = anchor.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight, m = 8, gap = 6;
  const pr = pop.getBoundingClientRect();
  const openUp = pr.height > vh - r.bottom - gap - m && r.top > vh - r.bottom;
  const top = openUp ? Math.max(m, r.top - gap - pr.height) : r.bottom + gap;
  const left = Math.min(Math.max(m, r.right - pr.width), Math.max(m, vw - pr.width - m));
  pop.style.left = `${left / zoom}px`;
  pop.style.top = `${top / zoom}px`;
  setTimeout(() => dt.focus(), 0);
  document.addEventListener('mousedown', onRemDown, true);
  document.addEventListener('keydown', onRemKey, true);
  document.addEventListener('scroll', onRemScroll, true);
}

/* ————————————————————————— notes ————————————————————————— */

function notesPanel(notes, q) {
  const panel = el('section', { class: 'notes-panel' });
  panel.append(el('div', { class: 'panel-head' },
    el('h3', { class: 'panel-h', text: 'Notes' }),
    el('button', { class: 'btnx primary notes-new', onclick: newNote }, icon('plus', 15), el('span', { text: 'New note' })),
  ));

  const filtered = q ? notes.filter((n) => matches(q, n.title, n.body)) : notes;
  if (!filtered.length) {
    panel.append(el('div', { class: 'notes-empty big' },
      q ? 'No notes match your search.'
        : el('span', {}, 'Nothing yet. ', el('button', { class: 'linkbtn', onclick: newNote }, el('span', { text: 'Write your first note' })), '.')));
    return panel;
  }
  const grid = el('div', { class: 'notes-grid' });
  for (const n of filtered) grid.append(noteCard(n));
  panel.append(grid);
  return panel;
}

const saveTitle = debounce((id, v) => mutate((d) => { const n = d.notes.find((x) => x.id === id); if (n) { n.title = v; n.updatedAt = now(); } }), 400);
const saveBody = debounce((id, v) => mutate((d) => { const n = d.notes.find((x) => x.id === id); if (n) { n.body = v; n.updatedAt = now(); } }), 400);

function noteCard(n) {
  const title = el('input', { class: 'note-title', value: n.title || '', placeholder: 'Title', 'aria-label': 'Note title' });
  title.addEventListener('input', () => saveTitle(n.id, title.value));

  const body = el('textarea', { class: 'note-body', placeholder: 'Write…', 'aria-label': 'Note body', rows: '3' });
  body.value = n.body || '';
  const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight, 420) + 'px'; };
  body.addEventListener('input', () => { grow(); saveBody(n.id, body.value); });
  requestAnimationFrame(grow);

  const del = actionBtn('close', 'Delete note', async () => {
    if (!(n.title || n.body) || await confirmDialog({ title: 'Delete note?', message: 'This note will be removed.', confirmLabel: 'Delete', danger: true })) {
      mutate((d) => { d.notes = d.notes.filter((x) => x.id !== n.id); });
    }
  }, 'danger');

  return el('article', { class: 'note-card' },
    title,
    body,
    el('div', { class: 'note-foot' },
      el('span', { class: 'note-when', text: n.updatedAt ? shortDate(n.updatedAt) : 'New' }),
      del,
    ),
  );
}

async function newNote() {
  const id = uid();
  await mutate((d) => { d.notes.unshift({ id, title: '', body: '', createdAt: now(), updatedAt: now() }); });
  // focus the fresh card's title after the storage listener re-renders
  requestAnimationFrame(() => root.querySelector('.note-card .note-title')?.focus());
}

/* ————————————————————————— export / import ————————————————————————— */

function stamp() {
  const d = new Date(), p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function exportNotesOnly() {
  const { todos, notes } = await load();
  if (!todos.length && !notes.length) { toast('Nothing to export yet'); return; }
  const payload = { app: 'StackNest', type: 'notes', version: 1, exportedAt: now(), todos, notes };
  exportDownload(`stacknest-notes-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  toast(`Exported ${notes.length} note${notes.length === 1 ? '' : 's'} + ${todos.length} task${todos.length === 1 ? '' : 's'}`);
}

async function importFromFile() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON'); return; }
  // accept a notes-only file ({type:'notes', todos, notes}) OR a full StackNest
  // backup whose notes blob lives under data.notes = {todos, notes}
  let notes = [], todos = [];
  if (data?.type === 'notes') { notes = data.notes; todos = data.todos; }
  else if (data?.notes && typeof data.notes === 'object' && !Array.isArray(data.notes)) { notes = data.notes.notes; todos = data.notes.todos; }
  notes = Array.isArray(notes) ? notes : [];
  todos = Array.isArray(todos) ? todos : [];
  if (!notes.length && !todos.length) { toast('No notes or tasks found in that file'); return; }
  const ok = await confirmDialog({
    title: 'Import notes?',
    message: `Add ${notes.length} note${notes.length === 1 ? '' : 's'} and ${todos.length} task${todos.length === 1 ? '' : 's'} to what you already have?`,
    confirmLabel: 'Import',
  });
  if (!ok) return;
  await mergeIn(notes, todos);
  toast(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'} + ${todos.length} task${todos.length === 1 ? '' : 's'}`);
}

// add imported items (fresh ids so nothing collides), newest on top
function mergeIn(notes, todos) {
  return mutate((d) => {
    for (const n of [...notes].reverse()) d.notes.unshift({ id: uid(), title: String(n.title || ''), body: String(n.body || ''), createdAt: n.createdAt || now(), updatedAt: n.updatedAt || now() });
    for (const t of [...todos].reverse()) d.todos.unshift({ id: uid(), text: String(t.text || ''), done: !!t.done, createdAt: t.createdAt || now() });
  });
}

// Apple Notes has no API reachable from an extension — import pasted/exported text.
// Reuses the app's .modal-scrim/.modal dialog system for a consistent look.
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
    const notes = blocks.map((b) => { const nl = b.indexOf('\n'); return nl === -1 ? { title: b.slice(0, 80), body: '' } : { title: b.slice(0, nl).trim().slice(0, 120), body: b.slice(nl + 1).trim() }; });
    close();
    await mergeIn(notes, []);
    toast(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'} from Apple Notes`);
  };
  cancelBtn.addEventListener('click', close);
  importBtn.addEventListener('click', doImport);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  requestAnimationFrame(() => { scrim.classList.add('show'); ta.focus(); });
}

/* ————————————————————————— Drive (via the full backup, which now carries notes) ————————————————————————— */

async function driveBackup() {
  const cloud = await loadCloudState();
  if (!(cloud.connected || cloud.email)) { toast('Connect Google Drive first — Settings → Cloud sync'); return; }
  const r = await backupNow(false).catch((e) => { toast(e?.message || 'Backup failed'); return null; });
  if (r) toast('Backed up to Drive (notes included)');
}

async function driveRestore() {
  const cloud = await loadCloudState();
  if (!(cloud.connected || cloud.email)) { toast('Connect Google Drive first — Settings → Cloud sync'); return; }
  const ok = await confirmDialog({
    title: 'Fetch from Drive?',
    message: 'This restores your latest Drive backup — replacing your current spaces, collections, settings and notes.',
    confirmLabel: 'Fetch & restore', danger: true,
  });
  if (!ok) return;
  const r = await restoreLatest().catch((e) => { toast(e?.message || 'Restore failed'); return null; });
  if (r) toast('Restored from Drive');
}
