// Grammar assistant: when the search query reads like a sentence, ask LanguageTool
// (free api.languagetool.org endpoint) for corrections and offer the fully rewritten
// sentence as a one-click "Did you mean" pill under the search box. Strictly opt-in
// via Settings — no text ever leaves the machine while the toggle is off.

import { el, icon } from './ui.js';
import { SETTINGS_KEY, loadSettings } from './settings.js';

const API = 'https://api.languagetool.org/v2/check';
const DEBOUNCE_MS = 700;

let enabled = false;
let input, host, tip;
let timer = null;
let ctrl = null;        // in-flight request, aborted when the user keeps typing
let lastApplied = '';   // don't re-suggest the sentence the user just accepted

export function initGrammar(options) {
  ({ input, host } = options);
  loadSettings().then((s) => { enabled = !!s.grammarEnabled; });
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area === 'local' && c[SETTINGS_KEY]) loadSettings().then((s) => { enabled = !!s.grammarEnabled; if (!enabled) hide(); });
  });
  input.addEventListener('input', schedule);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  document.addEventListener('mousedown', (e) => { if (tip && !tip.contains(e.target) && e.target !== input) hide(); });
}

function schedule() {
  clearTimeout(timer);
  ctrl?.abort();
  const text = input.value.trim();
  if (!enabled || !looksLikeSentence(text) || text === lastApplied) { hide(); return; }
  timer = setTimeout(() => check(text), DEBOUNCE_MS);
}

// Only real prose is worth checking — skip short fragments, URLs and huge pastes.
function looksLikeSentence(text) {
  if (text.length < 12 || text.length > 300) return false;
  if (text.split(/\s+/).filter(Boolean).length < 3) return false;
  if (/^(https?:\/\/|www\.)/i.test(text) || /\.[a-z]{2,6}(\/|$)/i.test(text)) return false;
  return /[a-z]/i.test(text);
}

async function check(text) {
  try {
    ctrl = new AbortController();
    const body = new URLSearchParams({ text, language: 'en-US', level: 'default' });
    const res = await fetch(API, { method: 'POST', body, signal: ctrl.signal });
    if (!res.ok) return;
    const data = await res.json();
    if (input.value.trim() !== text) return; // stale — the query moved on
    const fixed = applyMatches(text, data.matches || []);
    if (fixed && fixed !== text) show(fixed);
    else hide();
  } catch { /* aborted / offline / rate-limited — suggest nothing */ }
}

// Take the first replacement of each non-overlapping match, applied right-to-left
// so earlier offsets stay valid: the result is the whole corrected sentence.
function applyMatches(text, matches) {
  const usable = matches
    .filter((m) => m.replacements?.length && m.replacements[0].value != null)
    .sort((a, b) => a.offset - b.offset);
  const picked = [];
  let end = -1;
  for (const m of usable) if (m.offset >= end) { picked.push(m); end = m.offset + m.length; }
  let out = text;
  for (const m of picked.reverse()) out = out.slice(0, m.offset) + m.replacements[0].value + out.slice(m.offset + m.length);
  return out;
}

function show(fixed) {
  hide();
  tip = el('div', { class: 'gram-tip', role: 'status' },
    el('span', { class: 'gram-k', text: 'Did you mean' }),
    el('button', { class: 'gram-fix', title: 'Use this sentence', onclick: () => apply(fixed) }, el('span', { text: fixed })),
    el('button', { class: 'gram-x', title: 'Dismiss', 'aria-label': 'Dismiss suggestion', onclick: hide }, icon('close', 11)),
  );
  host.append(tip);
}

function apply(fixed) {
  lastApplied = fixed;
  input.value = fixed;
  hide();
  input.dispatchEvent(new Event('input', { bubbles: true })); // re-run the live filter
  input.focus();
}

function hide() { if (tip) { tip.remove(); tip = null; } }
