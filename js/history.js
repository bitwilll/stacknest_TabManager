// Undo / redo for destructive board actions (delete collection / space / link).
//
// Command-based: each delete pushes an entry that knows how to undo (restore just that
// item) and redo (delete it again) — so undoing a delete never reverts unrelated edits
// you made afterwards. In-memory (session) stacks + a transient bottom-right snackbar +
// Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z / Ctrl+Y (redo).

import { el, icon } from './ui.js';

const LIMIT = 100;
const undoStack = [];
const redoStack = [];

let barRoot = null;
let hideTimer = null;

// entry: { label, undo: async fn, redo: async fn }
export function pushHistory(entry) {
  undoStack.push(entry);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
}

export async function doUndo() {
  const entry = undoStack.pop();
  if (!entry) { flash('Nothing to undo', null); return; }
  try { await entry.undo(); } catch { /* restore best-effort */ }
  redoStack.push(entry);
  flash(`Restored ${entry.label}`, { text: 'Redo', fn: doRedo });
}

export async function doRedo() {
  const entry = redoStack.pop();
  if (!entry) { flash('Nothing to redo', null); return; }
  try { await entry.redo(); } catch { /* re-delete best-effort */ }
  undoStack.push(entry);
  flash(`Deleted ${entry.label}`, { text: 'Undo', fn: doUndo });
}

// Show the "Deleted X · Undo" snackbar right after a delete.
export function flashDeleted(message) {
  flash(message, { text: 'Undo', fn: doUndo });
}

export function initHistory(options) {
  barRoot = options.root;
  document.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    if (a && (/^(input|textarea)$/i.test(a.tagName) || a.isContentEditable)) return; // let inputs handle their own undo
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); doRedo(); }
  });
}

function flash(message, action) {
  if (!barRoot) return;
  barRoot.replaceChildren(
    el('span', { class: 'undo-ic' }, icon('undo', 15)),
    el('span', { class: 'undo-msg', text: message }),
    action ? el('button', { class: 'undo-action', text: action.text, onclick: () => { hide(); action.fn(); } }) : null,
  );
  barRoot.hidden = false;
  requestAnimationFrame(() => barRoot.classList.add('show'));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 7000);
}

function hide() {
  if (!barRoot) return;
  clearTimeout(hideTimer);
  barRoot.classList.remove('show');
  setTimeout(() => { if (!barRoot.classList.contains('show')) barRoot.hidden = true; }, 250);
}
