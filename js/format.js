// Selection-aware text formatting for the note/todo/reminder fields.
//
// Everything here edits a plain <input>/<textarea> holding MARKDOWN SOURCE — the buttons
// insert markers rather than styling a rich-text document, so what you see in the toolbar
// and what round-trips through export/backup are the same thing.
//
// WHY execCommand: it is deprecated, but assigning `field.value` (or setRangeText) blows
// away the browser's native undo stack for that field — ⌘Z would stop working inside a
// note the moment you pressed B once. `document.execCommand('insertText')` on a focused
// field is still the only way to make an edit the browser records as undoable, so it is
// the primary path with a setRangeText fallback for the day it stops working.

// Markers by action. Markdown has no underline, so <u> is used (the renderer allows
// exactly that tag back through — see js/markdown.js).
export const MARKERS = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['<u>', '</u>'],
  strike: ['~~', '~~'],
};

function replaceRange(field, start, end, text) {
  field.focus();
  field.setSelectionRange(start, end);
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
  if (!ok) {
    // fallback: this step won't be in the browser's undo stack, but the edit still lands
    field.setRangeText(text, start, end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return ok;
}

const select = (field, start, end) => { try { field.setSelectionRange(start, end); } catch { /* not selectable */ } };

// `*` and `**` (and `_`/`__`) share a character, so a plain string compare makes italic
// chew one asterisk off each of bold's markers. For repeated-character markers we compare
// the length of the whole RUN instead, which tells `*` and `**` apart exactly.
const isRun = (m) => m.length > 0 && [...m].every((c) => c === m[0]);
const runBefore = (v, i, ch) => { let n = 0; while (i - n - 1 >= 0 && v[i - n - 1] === ch) n++; return n; };
const runAfter = (v, i, ch) => { let n = 0; while (i + n < v.length && v[i + n] === ch) n++; return n; };

// Is the selection [s,e) sitting immediately inside an `open`…`close` pair?
function wrappedOutside(v, s, e, open, close) {
  if (isRun(open) && isRun(close) && open[0] === close[0]) {
    return runBefore(v, s, open[0]) === open.length && runAfter(v, e, close[0]) === close.length;
  }
  return v.slice(Math.max(0, s - open.length), s) === open && v.slice(e, e + close.length) === close;
}

// Toggle `open`…`close` around one line, keeping the markers tight against the text.
// This matters: markdown ignores "** spaced **", so wrapping the whitespace would silently
// produce something that renders as literal asterisks.
function toggleLine(line, open, close) {
  const lead = line.match(/^\s*/)[0];
  const tail = line.match(/\s*$/)[0];
  const core = line.slice(lead.length, line.length - tail.length);
  if (!core) return line;                       // blank line inside a multi-line selection
  const wrapped = core.length >= open.length + close.length && core.startsWith(open) && core.endsWith(close);
  return lead + (wrapped ? core.slice(open.length, core.length - close.length) : open + core + close) + tail;
}

// Apply/remove a marker pair around the current selection. Returns 'on' | 'off'.
//
// - selection already wrapped (markers just outside, or included in the selection) → unwrap
// - collapsed caret sitting inside a pair → unwrap that pair
// - collapsed caret otherwise → insert the pair and park the caret between the markers
// - selection spanning lines → each non-blank line toggles on its own, because `**` does
//   not span a newline in markdown
export function toggleFormat(field, action) {
  const pair = MARKERS[action];
  if (!pair || !field) return null;
  const [open, close] = pair;
  const ol = open.length, cl = close.length;
  const v = field.value;
  let s = field.selectionStart ?? 0;
  let e = field.selectionEnd ?? s;
  // A caret parked in the middle of a word formats that word — pressing ⌘B mid-word to get
  // an empty `****` you then have to retype into is useless, and every editor does this.
  if (s === e && !enclosingPair(v, s, open, close)) {
    const w = wordAt(v, s);
    if (w) { s = w.from; e = w.to; }
  }
  const sel = v.slice(s, e);

  // markers immediately outside the selection
  if (s !== e && wrappedOutside(v, s, e, open, close)) {
    replaceRange(field, s - ol, e + cl, sel);
    select(field, s - ol, s - ol + sel.length);
    return 'off';
  }
  // markers inside the selection
  if (sel.length >= ol + cl && sel.startsWith(open) && sel.endsWith(close)) {
    const inner = sel.slice(ol, sel.length - cl);
    replaceRange(field, s, e, inner);
    select(field, s, s + inner.length);
    return 'off';
  }
  if (s === e) {
    const found = enclosingPair(v, s, open, close);
    if (found) {                                 // caret mid-word inside a pair → unwrap
      const inner = v.slice(found.from + ol, found.to - cl);
      replaceRange(field, found.from, found.to, inner);
      select(field, s - ol, s - ol);
      return 'off';
    }
    replaceRange(field, s, e, open + close);     // → type into the middle
    select(field, s + ol, s + ol);
    return 'on';
  }
  if (sel.includes('\n')) {
    const out = sel.split('\n').map((line) => toggleLine(line, open, close)).join('\n');
    replaceRange(field, s, e, out);
    select(field, s, s + out.length);
    return 'on';
  }
  // single line: keep the user's text selected so B then I stacks cleanly
  const lead = sel.match(/^\s*/)[0].length;
  const tail = sel.match(/\s*$/)[0].length;
  const core = sel.slice(lead, sel.length - tail);
  if (!core) return null;                        // whitespace-only selection — nothing to format
  const out = sel.slice(0, lead) + open + core + close + sel.slice(sel.length - tail);
  replaceRange(field, s, e, out);
  select(field, s + lead + ol, s + lead + ol + core.length);
  return 'on';
}

// The word the caret sits in or against, or null if it is on whitespace/punctuation.
function wordAt(v, pos) {
  const isWord = (c) => c && /[\p{L}\p{N}_'’-]/u.test(c);
  if (!isWord(v[pos]) && !isWord(v[pos - 1])) return null;
  let from = pos, to = pos;
  while (from > 0 && isWord(v[from - 1])) from--;
  while (to < v.length && isWord(v[to])) to++;
  return to > from ? { from, to } : null;
}

// Nearest `open`…`close` pair on the caret's own line that contains `pos`.
function enclosingPair(v, pos, open, close) {
  const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
  let lineEnd = v.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = v.length;
  const from = v.lastIndexOf(open, pos - 1);
  if (from < lineStart) return null;
  // reject a partial hit on a longer run (the `*` inside `**`)
  if (isRun(open) && (runBefore(v, from, open[0]) !== 0 || runAfter(v, from, open[0]) !== open.length)) return null;
  const to = v.indexOf(close, Math.max(pos, from + open.length));
  if (to === -1 || to + close.length > lineEnd) return null;
  if (isRun(close) && runAfter(v, to, close[0]) !== close.length) return null;
  return { from, to: to + close.length };
}

/* ————— per-card text scale ————— */

// Deliberately narrow: the floor keeps 13px body text at ~11px, which stays legible and
// keeps the card inside the contrast work. The ceiling stops one card dwarfing the mosaic.
export const SCALES = [0.85, 1, 1.15, 1.3, 1.5];
export const DEFAULT_SCALE = 1;

export function stepScale(current, dir) {
  const now = SCALES.includes(current) ? current : DEFAULT_SCALE;
  const i = SCALES.indexOf(now);
  return SCALES[Math.min(SCALES.length - 1, Math.max(0, i + dir))];
}
export const canStepScale = (current, dir) => stepScale(current, dir) !== (SCALES.includes(current) ? current : DEFAULT_SCALE);
