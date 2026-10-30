// Settings: four numbered plates — Appearance (fonts, size, text sizes, tabs bar), Backup &
// sync (file + Google Drive), the Vault's PIN, and the market ticker — with an index beside them.
// Fonts are offline-safe stacks (bundled + system) so nothing hits the network.

import { el, icon, toast, confirmDialog, secGroup, sectionHead } from './ui.js';
import { getKey, update } from './store.js';
import { exportBackup, importFlow } from './backup.js';
import { CLOUD_KEY, loadCloudState, connect, switchAccount, signOut, backupNow, restoreLatest, isLive, isConfigured, canChooseAccount } from './drive.js';
import { LOCK_KEY, loadLock, hasPin, setPin, clearPin, verifyPin, validatePin,
         isLockedOut, hasSecurityQuestion, promptSecurityAnswer,
         SECURITY_QUESTIONS, MAX_FAILS } from './lock.js';

export const SETTINGS_KEY = 'stacknest:settings';

export const FONT_UI = [
  { id: 'hanken', label: 'Hanken Grotesk', stack: "'Hanken Grotesk', system-ui, sans-serif" },
  { id: 'system', label: 'System UI', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'helvetica', label: 'Helvetica Neue', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'georgia', label: 'Georgia (serif)', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, Tahoma, sans-serif' },
];

export const FONT_MONO = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'system', label: 'System Mono', stack: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { id: 'menlo', label: 'Menlo', stack: 'Menlo, Monaco, monospace' },
  { id: 'consolas', label: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
  { id: 'courier', label: 'Courier', stack: "'Courier New', Courier, monospace" },
];

export const SCALES = [
  { id: 'compact', label: 'Compact', zoom: 0.9 },
  { id: 'default', label: 'Standard', zoom: 1 },   // id kept for stored values; the default is Comfortable
  { id: 'comfortable', label: 'Comfortable', zoom: 1.08 },
  { id: 'large', label: 'Large', zoom: 1.2 },
];

/* Where the live tabs of the focused window are shown. They used to appear in BOTH
   places at once — a horizontal strip under the header and again inside the sidebar's
   Windows panel — which is the same information twice and 64px of the board's height
   spent on the duplicate. Now it is one place, and you choose which.

   Whichever you pick, the per-window rows (switch to it, save it, stash it) stay in the
   sidebar: those are window actions, not a tab list, and nothing here removes them. */
export const TAB_BARS = [
  { id: 'top', label: 'Horizontal', sub: 'A strip of tab chips under the header, on the board.' },
  { id: 'side', label: 'Vertical', sub: 'Its own rail beside the sidebar, on every view.' },
  { id: 'off', label: 'Hidden', sub: 'Neither — expand a window in the sidebar to reach its tabs.' },
];

// — market ticker options (used here + by ticker.js) —
export const TICKER_BASES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CNY'];
export const TICKER_CRYPTOS = [
  { id: 'bitcoin', sym: 'BTC' }, { id: 'ethereum', sym: 'ETH' }, { id: 'solana', sym: 'SOL' },
  { id: 'binancecoin', sym: 'BNB' }, { id: 'ripple', sym: 'XRP' }, { id: 'cardano', sym: 'ADA' },
  { id: 'dogecoin', sym: 'DOGE' }, { id: 'polkadot', sym: 'DOT' },
];
export const TICKER_FX = ['EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CNY', 'CHF'];

// ——— text sizes by role ———
// Every piece of text in the stylesheet is set in one of seven scale tokens (--t1…--t7).
// Rather than expose seven dials, they are grouped into four roles a person can name —
// each role is a multiplier the tokens are computed from (see the :root block in the CSS).
// The interface-size zoom above scales everything at once; these tune one kind of text.
export const TYPE_ROLES = [
  { id: 'heading', label: 'Headings', sub: 'View and section titles.', sample: 'Collections', token: '--t7', weight: 800 },
  { id: 'title', label: 'Titles', sub: 'Card and collection titles.', sample: 'Weekend reading', token: '--t4', weight: 700 },
  { id: 'body', label: 'Body text', sub: 'Navigation, buttons, inputs, notes.', sample: 'Drag a tab down from the tray', token: '--t3', weight: 500 },
  { id: 'small', label: 'Small text', sub: 'Counts, domains, timestamps, section labels.', sample: 'updated sep 7 · 12 tabs', token: '--t2', mono: true, weight: 500 },
];
export const TYPE_STEPS = [0.85, 0.92, 1, 1.08, 1.16, 1.25, 1.35];
export const DEFAULT_TYPE_SIZES = Object.fromEntries(TYPE_ROLES.map((r) => [r.id, 1]));

export const DEFAULT_SETTINGS = {
  fontUi: 'hanken', fontMono: 'jetbrains', scale: 'comfortable',   // applies when no size has been chosen
  typeSizes: DEFAULT_TYPE_SIZES,
  tabsBar: 'top',
  tickerEnabled: false, tickerBase: 'USD',
  tickerCrypto: ['bitcoin', 'ethereum', 'solana'], tickerFx: ['EUR', 'GBP'],
};

const pick = (list, id) => list.find((x) => x.id === id) || list[0];

/* ————— is this font actually on this machine? —————
   A CSS font stack fails silently: pick "Consolas" on a Mac and the browser quietly
   serves the next family in the stack, so the user chooses a font, sees no change, and
   concludes the setting is broken. Measure instead of assuming.

   The test renders a string with wildly uneven advance widths in "<candidate>, <base>"
   and in <base> alone. If the candidate is missing, both fall to <base> and the widths
   match exactly. Repeat against three bases, because a candidate can happen to match one
   of them by coincidence but not all three. */
const GENERIC = new Set(['system-ui', 'ui-monospace', 'ui-sans-serif', 'ui-serif', 'monospace', 'sans-serif', 'serif', 'cursive', 'fantasy']);

// the first real family in a stack: "'Hanken Grotesk', system-ui, sans-serif" -> Hanken Grotesk
export function primaryFamily(stack) {
  return String(stack).split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

let probeCtx = null;
export function fontAvailable(stack) {
  const fam = primaryFamily(stack);
  // a generic keyword is resolved by the engine by definition — always "available",
  // even when it resolves to the same face as the base we would compare it against
  if (GENERIC.has(fam.toLowerCase())) return true;
  try {
    probeCtx = probeCtx || document.createElement('canvas').getContext('2d');
    const probe = 'MMMWWWiiillrr 0123456789 @#%&';
    return ['monospace', 'serif', 'sans-serif'].some((base) => {
      probeCtx.font = `72px ${base}`;
      const bare = probeCtx.measureText(probe).width;
      probeCtx.font = `72px "${fam}", ${base}`;
      return probeCtx.measureText(probe).width !== bare;
    });
  } catch { return true; }   // no canvas — don't cry wolf
}

const validId = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);
const validArr = (allowed, arr, fallback) => (Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : fallback);

// Sanitise a raw settings object (storage, a restored backup, a patch) to the defaults — unknown
// ids to the DEFAULT id (not list[0]), text sizes to the ladder. Used on every read AND every
// write, so a bad value that arrived through a backup can never take effect on a later save.
function normalize(raw) {
  const m = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    fontUi: validId(FONT_UI, m.fontUi, DEFAULT_SETTINGS.fontUi),
    fontMono: validId(FONT_MONO, m.fontMono, DEFAULT_SETTINGS.fontMono),
    scale: validId(SCALES, m.scale, DEFAULT_SETTINGS.scale),
    tabsBar: validId(TAB_BARS, m.tabsBar, DEFAULT_SETTINGS.tabsBar),
    // a role missing from an older file, or a value off the ladder, is simply 1
    typeSizes: Object.fromEntries(TYPE_ROLES.map((r) => {
      const v = Number(m.typeSizes?.[r.id]);
      return [r.id, TYPE_STEPS.includes(v) ? v : 1];
    })),
    tickerEnabled: !!m.tickerEnabled,
    tickerBase: TICKER_BASES.includes(m.tickerBase) ? m.tickerBase : DEFAULT_SETTINGS.tickerBase,
    tickerCrypto: validArr(TICKER_CRYPTOS.map((c) => c.id), m.tickerCrypto, DEFAULT_SETTINGS.tickerCrypto),
    tickerFx: validArr(TICKER_FX, m.tickerFx, DEFAULT_SETTINGS.tickerFx),
  };
}

export async function loadSettings() {
  return normalize(await getKey(SETTINGS_KEY, null));
}

// Writes this view makes itself must not rebuild it: every control already updates in place
// and applySettings has pushed the change into the DOM. Rebuilding on the storage echo used to
// destroy the very button that was just pressed — a stepper is a repeat-press control — and
// dropped keyboard focus to <body>. Each write leaves its serialised value here; the listener
// consumes the matching echo and skips. Bounded, so a lost echo cannot leak.
const ownWrites = [];

export async function saveSettings(patch) {
  let next;
  await update(SETTINGS_KEY, DEFAULT_SETTINGS, (cur) => {
    next = normalize({ ...DEFAULT_SETTINGS, ...(cur || {}), ...patch });
    ownWrites.push(JSON.stringify(next));
    if (ownWrites.length > 20) ownWrites.shift();
    return next;
  });
  applySettings(next);
  // controls sync from this rather than from a rebuild, so a save made elsewhere (a
  // programmatic call, a future keyboard shortcut) still shows in the open Settings view
  document.dispatchEvent(new CustomEvent('stacknest:settings', { detail: next }));
  return next;
}

// Listen for settings changes on behalf of a control; the listener retires itself once the
// control has left the DOM (an external rebuild replaces every row), so nothing accumulates.
function onSettingsChange(node, fn) {
  const handler = (e) => { if (!node.isConnected) { document.removeEventListener('stacknest:settings', handler); return; } fn(e.detail); };
  document.addEventListener('stacknest:settings', handler);
}

// Push settings into the live DOM: font stacks onto the CSS vars, size via zoom.
// zoom multiplies every rendered length — including 100vh — so the stylesheet
// divides viewport units by --app-zoom to keep the app exactly one screen tall.
export function applySettings(s) {
  const root = document.documentElement;
  root.style.setProperty('--grot', pick(FONT_UI, s.fontUi).stack);
  root.style.setProperty('--mono', pick(FONT_MONO, s.fontMono).stack);
  const zoom = pick(SCALES, s.scale).zoom;
  root.style.zoom = String(zoom);
  root.style.setProperty('--app-zoom', String(zoom));
  for (const r of TYPE_ROLES) root.style.setProperty(`--fs-${r.id}`, String(s.typeSizes?.[r.id] ?? 1));
  // layout switches ride on the root element so the stylesheet owns what is shown —
  // no inline display juggling, and nothing to re-apply on every view change
  root.dataset.tabsbar = pick(TAB_BARS, s.tabsBar).id;
  document.dispatchEvent(new CustomEvent('stacknest:tabsbar', { detail: pick(TAB_BARS, s.tabsBar).id }));
}


/* ————————————————————————— settings view ————————————————————————— */

let root;
let includeBookmarks = false; // export choice; survives settings-view re-renders

export function initSettings(options) {
  ({ root } = options);
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local') return;
    let external = !!(c[CLOUD_KEY] || c[LOCK_KEY]);
    if (c[SETTINGS_KEY]) {
      const i = ownWrites.indexOf(JSON.stringify(c[SETTINGS_KEY].newValue));
      if (i !== -1) ownWrites.splice(i, 1);   // our own echo — the view is already right
      else external = true;                     // another tab, an import, a Drive restore
    }
    if (external) render();
  });
  render();
  return { render };
}

function shortWhen(iso) {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return 'recently'; }
}

/* ————————————————————————— the Vault's PIN ————————————————————————— */

// Two fields, so a typo cannot silently become the PIN you have to remember. The security
// question is asked here too — bolting it on later means the people who need it most (the
// ones who forget) never set it.
async function setPinFlow({ keepQuestion = false } = {}) {
  const cloud = await loadCloudState();
  const owner = cloud.email || null;

  const a = el('input', { type: 'password', class: 'pin-input', inputmode: 'numeric', autocomplete: 'new-password', 'aria-label': 'New PIN' });
  const b = el('input', { type: 'password', class: 'pin-input', inputmode: 'numeric', autocomplete: 'new-password', 'aria-label': 'Confirm PIN' });
  const qSel = el('select', { class: 'set-select pin-q-sel', 'aria-label': 'Security question' });
  for (const q of SECURITY_QUESTIONS) qSel.append(el('option', { value: q, text: q }));
  const ans = el('input', { type: 'text', class: 'pin-input wide', autocomplete: 'off', 'aria-label': 'Answer' });
  const err = el('div', { class: 'pin-err', role: 'alert' });

  const parts = [
    el('label', { class: 'pin-lbl' }, 'PIN', a),
    el('label', { class: 'pin-lbl' }, 'Confirm', b),
  ];
  if (!keepQuestion) {
    parts.push(
      el('div', { class: 'pin-sep' }),
      el('label', { class: 'pin-lbl col' }, 'Security question', qSel),
      el('label', { class: 'pin-lbl col' }, 'Answer', ans),
    );
  }
  // The recovery story is the thing people regret not reading, so it sits where the
  // decision is made rather than in a paragraph they scrolled past.
  parts.push(el('p', { class: 'pin-warn' }, owner
    ? `Five wrong PINs locks the Vault. You can then recover it with the answer above, or by signing in again as ${owner}.`
    : 'Five wrong PINs locks the Vault. No Google Drive account is connected, so the answer above would be your ONLY way back in — connect Google Drive under Settings › Backup & sync if you want a second route.'));
  parts.push(err);
  const extra = el('div', { class: 'pin-field' }, ...parts);

  for (;;) {
    err.textContent = '';
    setTimeout(() => a.focus(), 60);
    const ok = await confirmDialog({
      title: keepQuestion ? 'Change your PIN' : 'Set a Vault PIN',
      extra, confirmLabel: keepQuestion ? 'Change PIN' : 'Set PIN',
      message: 'The Vault stays locked until this PIN is entered, and every new tab starts locked again.',
    });
    if (!ok) return false;
    const bad = validatePin(a.value);
    if (bad) { err.textContent = bad; continue; }
    if (a.value !== b.value) { err.textContent = 'The two entries don’t match.'; a.value = ''; b.value = ''; continue; }
    if (!keepQuestion && !ans.value.trim()) { err.textContent = 'Answer the security question, or you may not get back in.'; continue; }
    await setPin(a.value, keepQuestion
      ? { ownerEmail: owner, question: (await loadLock()).question, answer: null }
      : { ownerEmail: owner, question: qSel.value, answer: ans.value });
    toast(keepQuestion ? 'PIN changed' : 'Vault PIN set');
    return true;
  }
}

// Changing the PIN requires the current one — otherwise the lock is decorative.
async function requirePin() {
  if (!(await hasPin())) return true;
  const input = el('input', { type: 'password', class: 'pin-input', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'PIN' });
  const err = el('div', { class: 'pin-err', role: 'alert' });
  const extra = el('div', { class: 'pin-field' }, input, err);
  // the note survives the reopen, or "Wrong PIN" would be wiped before it was read
  let note = '';
  for (;;) {
    input.value = '';
    err.textContent = note;
    err.classList.toggle('is-warn', !!note);
    setTimeout(() => input.focus(), 60);
    const ok = await confirmDialog({ title: 'Enter your current PIN', message: 'Confirm it’s you.', extra, confirmLabel: 'Continue' });
    if (!ok) return false;
    const r = await verifyPin(input.value);
    if (r.ok) return true;
    if (r.lockedOut) { toast('Too many wrong PINs — the Vault is locked'); return false; }
    note = `Wrong PIN — ${r.left} attempt${r.left === 1 ? '' : 's'} left.`;
  }
}

/* Recovery route 1: the security question. Clears the lockout and unlocks for this
   session, then sends you straight to setting a new PIN — a recovery that leaves the
   forgotten PIN in place has not recovered anything. */
async function recoverByQuestionFlow() {
  if (!(await promptSecurityAnswer())) return;
  toast('Vault unlocked — set a new PIN');
  await setPinFlow();
}

/* Recovery route 2, exactly as specified: sign out of Google and sign back in. Signing in
   as a DIFFERENT account is refused — otherwise "reset the PIN" would just mean "connect
   any Google account", which proves nothing about owning this one.

   Note on scope: an extension cannot verify a Chrome profile password or drive the
   browser's own passkey for the signed-in Google account. Re-running the Google OAuth
   sign-in is the strongest account proof available to this page, and it is what "sign in
   to the respective account" reduces to in practice. */
async function resetPinFlow() {
  const lock = await loadLock();
  const owner = lock.ownerEmail;
  if (!owner) {
    // nothing to decide here, so one neutral button rather than Close / Close
    await confirmDialog({
      title: 'No recovery account', confirmLabel: 'Close', alert: true,
      message: 'This PIN was set with no Google Drive account connected, so there is no account to prove ownership with. Use your security question instead.',
    });
    return;
  }
  const ok = await confirmDialog({
    title: 'Reset PIN with Google?',
    message: `You'll be signed out of Google Drive and asked to sign in again. Sign in as ${owner} and the PIN is cleared and the Vault unlocks. Signing in as any other account leaves it untouched.`,
    confirmLabel: 'Sign out and reset', danger: true,
  });
  if (!ok) return;
  await signOut({ revoke: false });
  const state = await connect({ chooseAccount: true });
  if (state?.email && owner && state.email !== owner) {
    throw new Error(`Signed in as ${state.email}, but the PIN was set by ${owner}. The PIN is unchanged.`);
  }
  await clearPin();
  toast('PIN cleared — set a new one to lock the Vault again');
}

/* Signing out drops every cached token and stops syncing. It used to be a button called
   "Disconnect" that silently revoked the Google grant with no confirmation — a one-click,
   hard-to-undo action that also made the next sign-in re-run the whole consent screen.
   Now it asks first, and the revoke is an explicit choice rather than a hidden side effect. */
async function signOutFlow() {
  const revoke = el('input', { type: 'checkbox', class: 'set-check' });
  const ok = await confirmDialog({
    title: 'Sign out of Google Drive?',
    message: 'StackNest will stop syncing and will forget this account on this device. Your backup file in Drive is not deleted — sign back in any time to restore from it.',
    extra: el('label', { class: 'set-toggle modal-choice' }, revoke,
      el('span', {}, 'Also remove StackNest’s access to my Google account')),
    confirmLabel: 'Sign out',
  });
  if (!ok) return;
  await signOut({ revoke: revoke.checked });
  toast(revoke.checked ? 'Signed out and access removed' : 'Signed out of Google Drive');
}

/* ————————————————————————— the four plates —————————————————————————
   One static head ("applies to · This device"), then an index beside four numbered plates.
   Every plate stays in the scroll, so ⌘F still finds any setting; the index only jumps.
   Its items are buttons, not anchors, so the #view hash router never sees them. */

const PLATES = [
  { id: 'set-appearance', num: '01', name: 'Appearance' },
  { id: 'set-backup',     num: '02', name: 'Backup & sync' },
  { id: 'set-vault',      num: '03', name: 'Vault' },
  { id: 'set-ticker',     num: '04', name: 'Market ticker' },
];
const appearanceStatus = (s) => `${pick(SCALES, s.scale).label} · ${pick(FONT_UI, s.fontUi).label}`;
const tickerStatus = (s) => (s.tickerEnabled ? `on · ${s.tickerCrypto.length + s.tickerFx.length} symbols` : 'off');
let plateObserver = null;
const FOCUS_NEXT = { 'drive-connect': 'drive-backup' };   // a control a rebuild replaces → where focus goes

// A plate: ink number, h2 (focusable, the index's landing spot), live status, one-line
// description; then the controls; then the notes, which become a margin column when wide.
function plate(p, { desc, status, aside = null }, body, notes = []) {
  const hId = `${p.id}-h`;
  return el('section', { class: 'set-card', id: p.id, 'aria-labelledby': hId },
    el('header', { class: 'set-head' },
      el('span', { class: 'set-num', 'aria-hidden': 'true', text: p.num }),
      el('h2', { class: 'set-h', id: hId, tabindex: '-1', dataset: { key: `h-${p.id}` }, text: p.name }),
      el('span', { class: `set-state${status.tone ? ` is-${status.tone}` : ''}`, dataset: { status: p.id }, text: status.text }),
      aside ? el('div', { class: 'set-head-aside' }, aside) : null,
      el('p', { class: 'set-desc', text: desc })),
    el('div', { class: 'set-body' }, ...body),
    notes.length ? el('footer', { class: 'set-notes' }, ...notes) : null);
}
const callout = (content, tone = 'info') => el('p', { class: `set-callout is-${tone}` }, ...[].concat(content));
const group = (caption, ...rows) => secGroup({ caption, level: 3 }, ...rows);
function setRow({ label, help = null, control, forId = null, extra = [] }) {
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      forId ? el('label', { class: 'set-label', for: forId, text: label }) : el('div', { class: 'set-label', text: label }),
      help ? el('div', { class: 'set-sub', text: help }) : null, ...extra),
    el('div', { class: 'set-control' }, ...[].concat(control)));
}

function setIndex(status) {
  const nav = el('nav', { class: 'set-index', 'aria-label': 'Settings sections' });
  for (const p of PLATES) {
    const st = status[p.id];
    nav.append(el('button', { class: 'set-index-item', type: 'button', dataset: { target: p.id, key: `jump-${p.id}` },
      onclick: () => {
        const t = document.getElementById(p.id);
        t?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        t?.querySelector('.set-h')?.focus({ preventScroll: true });
      } },
      el('span', { class: 'set-index-n', 'aria-hidden': 'true', text: p.num }),
      el('span', { class: 'set-index-name', text: p.name }),
      el('span', { class: `set-index-s${st.tone ? ` is-${st.tone}` : ''}`, dataset: { status: p.id }, text: st.text })));
  }
  return nav;
}

// aria-current follows the scroll: the first plate (in page order) inside the band under
// the head marks its index item. Rebuilt on every render, so a rebuild never leaves an
// observer watching plates that have left the DOM.
function watchPlates(nav) {
  plateObserver?.disconnect();
  const visible = new Set();
  plateObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id);
    }
    const cur = PLATES.findLast((p) => visible.has(p.id))?.id;   // the last plate in the band — the short final plate can't reach the top
    for (const b of nav.querySelectorAll('.set-index-item')) {
      if (b.dataset.target === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
  }, { root: null, rootMargin: '-72px 0px -55% 0px' });   // the viewport: at <=880 the document scrolls, not the view
  for (const p of PLATES) { const n = root.querySelector(`#${p.id}`); if (n) plateObserver.observe(n); }
}
// a status shows twice (the plate's chip and its index item); both carry data-status
const setStatus = (id, text) => root.querySelectorAll(`[data-status="${id}"]`).forEach((n) => { n.textContent = text; });

async function render() {
  const s = await loadSettings();
  const cloud = await loadCloudState();
  const live = isLive();
  const needsSetup = live && !isConfigured(); // real extension, but no OAuth client ID yet
  const connected = !!(cloud.connected || cloud.email);
  const [pinSet, lockedOut] = await Promise.all([hasPin(), isLockedOut()]);
  const status = {
    'set-appearance': { text: appearanceStatus(s) },
    'set-backup': { text: needsSetup ? 'setup required' : connected ? `drive · last backup ${shortWhen(cloud.lastBackupAt)}` : !live ? 'preview' : 'drive not connected' },
    'set-vault': { text: lockedOut ? 'locked out' : pinSet ? 'pin set' : 'no pin', tone: lockedOut ? 'danger' : null },
    'set-ticker': { text: tickerStatus(s) },
  };
  const index = setIndex(status);
  const frag = [
    sectionHead({ className: 'set-top', scope: { key: 'applies to', value: 'This device' }, note: 'Changes save as you make them — there is no Save button.' }),
    el('div', { class: 'sec-body' }, el('div', { class: 'set-layout' }, index, el('div', { class: 'set-plates' },
      appearancePlate(s, status['set-appearance']),
      backupPlate({ cloud, live, needsSetup, connected }, status['set-backup']),
      await vaultPlate(status['set-vault']),
      tickerPlate(s, status['set-ticker'])))),
  ];
  // an external rebuild must not strand keyboard focus: data-key first, aria-label
  // second (the existing fallback); a control the rebuild replaced (Connect) hands focus to
  // its successor, and anything else that is gone lands on its own plate's heading
  const active = root.contains(document.activeElement) ? document.activeElement : null;
  const key = active?.dataset?.key || null;
  const label = active?.getAttribute('aria-label') || null;
  const plateId = active?.closest('.set-card')?.id || null;
  root.replaceChildren(...frag);
  const byKey = (k) => (k ? root.querySelector(`[data-key="${CSS.escape(k)}"]`) : null);
  const back = byKey(key) || byKey(FOCUS_NEXT[key])
    || (label && root.querySelector(`[aria-label="${CSS.escape(label)}"]`))
    || (plateId && root.querySelector(`#${plateId} .set-h`));
  back?.focus({ preventScroll: true });   // replaceChildren keeps scrollTop; a rebuild must not snap the page to the old focus
  watchPlates(index);
  // the two statuses that change without a rebuild (this view's own writes) follow the live settings
  onSettingsChange(index, (next) => {
    setStatus('set-appearance', appearanceStatus(next));
    setStatus('set-ticker', tickerStatus(next));
  });
}

/* ——— 01 Appearance: type, size, and where the live tabs live ——— */
function appearancePlate(s, st) {
  return plate(PLATES[0], { desc: 'How StackNest looks, and where this window’s live tabs are listed.', status: st }, [
    group('type',
      fontRow('Interface font', 'Titles, cards, navigation — everything but code.', FONT_UI, s.fontUi,
        (v) => saveSettings({ fontUi: v }).then(() => toast('Interface font updated')), 'sample-ui', 'font-ui'),
      fontRow('Monospace font', 'Counts, domains, labels and keyboard hints.', FONT_MONO, s.fontMono,
        (v) => saveSettings({ fontMono: v }).then(() => toast('Monospace font updated')), 'sample-mono', 'font-mono')),
    group('size', segRow('Interface size', 'Scales the whole interface, text and all.', SCALES, s.scale, 'scale')),
    typeSizeGroup(s.typeSizes),
    group('layout', segRow('Open tabs bar', 'Where this window’s live tabs are listed.', TAB_BARS, s.tabsBar, 'tabsBar')),
  ]);
}

/* ——— 02 Backup & sync: a file on this device, or your own Google Drive ——— */
function backupPlate({ cloud, live, needsSetup, connected }, st) {
  const includeBm = el('input', { type: 'checkbox', id: 'set-include-bm', class: 'set-check set-switch', role: 'switch', dataset: { key: 'include-bm' } });
  includeBm.checked = includeBookmarks;
  includeBm.addEventListener('change', () => { includeBookmarks = includeBm.checked; });   // same module variable

  // THE page primary when Drive is not connected; soft once "Back up now" exists
  const exportBtn = el('button', { class: `btnx ${connected ? 'soft' : 'primary'}`, type: 'button', dataset: { key: 'export-backup' },
    onclick: () => exportBackup(includeBookmarks) }, icon('download', 14), el('span', { text: 'Export backup' }));
  const importBtn = el('button', { class: 'btnx soft', type: 'button', dataset: { key: 'import-backup' },
    onclick: () => importFlow() }, icon('upload', 14), el('span', { text: 'Import backup…' }));

  return plate(PLATES[1], {
    desc: 'One copy of everything — spaces, collections, notes, tags, My Space, the Vault (PIN included) and settings — as a file on this device, or in your own Google Drive.',
    status: st,
  }, [
    group('options', setRow({ label: 'Include my Chrome bookmarks', forId: 'set-include-bm', control: includeBm,
      help: 'Applies to Export backup and Back up now. Not remembered after this tab closes.' })),
    group('file on this device', setRow({ label: 'Backup file', help: 'A JSON file you can re-import later or on another machine.', control: [exportBtn, importBtn] })),
    group('google drive', driveGroup(cloud, needsSetup, connected)),
  ], [
    callout('Import replaces your current spaces, collections, notes, tags, My Space, the Vault and settings. Bookmarks, if present, are added under a new "StackNest Import" folder (nothing is overwritten).'),
    callout(driveNote(live, needsSetup)),
  ]);
}

// Google Drive: set up required / Connect / the connected account with its actions.
// The dot is green only when an account is actually connected.
function driveGroup(cloud, needsSetup, connected) {
  const name = (inner) => el('span', { class: 'cloud-name' }, el('span', { class: `cloud-dot g${connected ? ' is-on' : ''}` }), inner);
  const box = el('div', { class: 'cloud-provider' });
  if (needsSetup) {
    box.append(el('div', { class: 'cloud-row' }, name('Google Drive'),
      el('button', { class: 'btnx soft', disabled: 'true' }, el('span', { text: 'Set up required' }))));
  } else if (!connected) {
    box.append(el('div', { class: 'cloud-row' }, name('Google Drive'),
      el('button', { class: 'btnx soft', type: 'button', dataset: { key: 'drive-connect' },          // was .primary
        onclick: withBusy(async () => { await connect(); toast('Google Drive connected'); }) }, icon('cloud', 14), el('span', { text: 'Connect' }))));
  } else {
    box.append(
      el('div', { class: 'cloud-row' }, name(el('span', { class: 'cloud-acct', text: cloud.email || 'Google Drive' })),
        el('div', { class: 'cloud-btns' },
          // only where Chrome offers an account picker; otherwise the button could only show an error
          canChooseAccount() ? el('button', { class: 'btnx ghosty', type: 'button', dataset: { key: 'drive-switch' }, title: 'Sign in with a different Google account',
            onclick: withBusy(async () => { await switchAccount(); toast('Switched account'); }) }, icon('swap', 15), el('span', { text: 'Switch account' })) : null,
          el('button', { class: 'btnx ghosty', type: 'button', dataset: { key: 'drive-signout' }, title: 'Sign out of Google Drive on this device',
            onclick: withBusy(signOutFlow) }, icon('logout', 15), el('span', { text: 'Sign out' })))),
      el('div', { class: 'cloud-meta', text: `Last backup ${shortWhen(cloud.lastBackupAt)} · last restore ${shortWhen(cloud.lastRestoreAt)}` }),
      el('div', { class: 'set-actions' },
        el('button', { class: 'btnx primary', type: 'button', dataset: { key: 'drive-backup' },              // THE page primary when connected
          onclick: withBusy(async () => { const r = await backupNow(includeBookmarks); toast(`Backed up ${r.collections} collection${r.collections === 1 ? '' : 's'}${r.bookmarks ? ' + bookmarks' : ''} to Drive`); }) },
          icon('cloudUp', 14), el('span', { text: 'Back up now' })),
        el('button', { class: 'btnx soft', type: 'button', dataset: { key: 'drive-restore' }, onclick: withBusy(async () => {
          const ok = await confirmDialog({ title: 'Restore from Drive?', message: 'This replaces your current spaces, collections, notes, tags, My Space, the Vault and settings with the latest cloud backup.', confirmLabel: 'Restore', danger: true });
          if (!ok) return;
          const r = await restoreLatest(); toast(`Restored ${r.collections} collection${r.collections === 1 ? '' : 's'} from Drive`);
        }) }, icon('cloudDown', 14), el('span', { text: 'Restore latest' }))));
  }
  return box;
}

function driveNote(live, needsSetup) {
  if (needsSetup) return 'Google Drive backup isn’t available in this build.';
  if (!live) return 'Preview mode: Google sign-in and Drive aren’t available outside the packaged extension, so this simulates the cloud locally. In the real extension it uses your Google account.';
  // Be explicit about WHOSE account this is: nothing is pre-connected, and the backup
  // goes to the signed-in person's own private Drive folder.
  return canChooseAccount()
    ? 'You choose the Google account. “Connect” opens Google’s account picker, and “Switch account” moves Drive sync to a different one at any time. Your backup lives in that account’s private StackNest folder — no one else can read it.'
    : 'Drive sync uses the Google account this Chrome profile is signed into. To back up to a different account, use a different Chrome profile. Your backup lives in a private folder in your own Drive; the developer has no access to it.';
}

// StackNest Cloud (Pro) — needs a hosted backend; placeholder for now

/* ——— 03 Vault: the PIN and the two ways back in ——— */
async function vaultPlate(st) {
  const [lock, pinSet, lockedOut, hasQ] = await Promise.all([loadLock(), hasPin(), isLockedOut(), hasSecurityQuestion()]);
  const desc = 'The Vault holds bookmarks you have moved out of Chrome, behind a PIN. Move things into it from My Space, or straight from the Library.';
  // Say what it is worth. A lock that oversells itself is worse than no lock. (A margin
  // note now, after the controls rather than before them.)
  const caveat = callout([el('strong', {}, 'What this does and doesn’t do. '),
    'Moving a bookmark here really does remove it from Chrome, so it leaves the bookmarks bar, chrome://bookmarks and address-bar suggestions. But the Vault’s contents are stored in plain text on this device: the PIN stops the UI from showing them, not someone reading storage directly. Treat it as a locked drawer, not a safe — and note that an export with bookmarks included does not contain them, since Chrome no longer has them.']);
  const body = [];
  if (lockedOut) body.push(callout([el('strong', {}, 'The Vault is locked. '), `${MAX_FAILS} wrong PINs in a row. Recover it below — guessing again won’t help.`], 'danger'));

  if (!pinSet) {   // same row skeleton as the PIN-set state; Set a Vault PIN is .soft (was .primary)
    body.push(group('pin', setRow({ label: 'PIN', help: 'Not set — the Vault stays closed until you set one.',
      control: el('button', { class: 'btnx soft', type: 'button', dataset: { key: 'pin-set' },
        onclick: withBusy(async () => { if (await setPinFlow()) render(); }) }, icon('key', 14), el('span', { text: 'Set a Vault PIN' })) })));
    return plate(PLATES[2], { desc, status: st }, body, [caveat]);
  }

  body.push(
    group('pin', setRow({ label: 'PIN',
      help: lockedOut ? 'Locked after too many wrong attempts.' : `Set. ${MAX_FAILS} wrong attempts in a row locks the Vault.`,
      control: el('button', { class: 'btnx ghosty', type: 'button', dataset: { key: 'pin-change' }, disabled: lockedOut ? 'true' : null,
        onclick: withBusy(async () => { if (await requirePin() && await setPinFlow({ keepQuestion: true })) render(); }) }, icon('key', 14), el('span', { text: 'Change PIN' })) })),
    group('recovery',
      setRow({ label: 'Recover with your security question', help: hasQ ? lock.question : 'No security question was set for this PIN.',
        control: el('button', { class: 'btnx ghosty', type: 'button', dataset: { key: 'pin-answer' }, disabled: hasQ ? null : 'true',
          onclick: withBusy(async () => { await recoverByQuestionFlow(); render(); }) }, icon('help', 14), el('span', { text: 'Answer question' })) }),
      setRow({ label: 'Recover with Google',
        help: lock.ownerEmail ? `Sign out of Drive and back in as ${lock.ownerEmail} to clear the PIN.` : 'No Google account was connected when this PIN was set, so this route is unavailable.',
        control: el('button', { class: 'btnx ghosty', type: 'button', dataset: { key: 'pin-reset' }, disabled: lock.ownerEmail ? null : 'true',
          onclick: withBusy(async () => { await resetPinFlow(); render(); }) }, icon('logout', 14), el('span', { text: 'Sign out and reset' })) })),
  );
  return plate(PLATES[2], { desc, status: st }, body, [caveat]);
}

/* ——— 04 Market ticker: opt-in, because it makes network requests ——— */
function tickerPlate(s, st) {
  const enable = el('input', { type: 'checkbox', id: 'set-ticker-enable', class: 'set-check set-switch', role: 'switch',
    'aria-label': 'Enable market ticker', dataset: { key: 'ticker-enable' } });
  enable.checked = s.tickerEnabled;
  enable.addEventListener('change', () => saveSettings({ tickerEnabled: enable.checked }).then(() => toast(enable.checked ? 'Ticker enabled' : 'Ticker off')));

  const baseSel = el('select', { class: 'set-select', 'aria-label': 'Reference currency', dataset: { key: 'ticker-base' } });
  for (const c of TICKER_BASES) { const o = el('option', { value: c, text: c }); if (c === s.tickerBase) o.selected = true; baseSel.append(o); }
  baseSel.addEventListener('change', () => saveSettings({ tickerBase: baseSel.value }).then(() => toast(`Quoted in ${baseSel.value}`)));

  return plate(PLATES[3], { desc: 'A live crypto and forex marquee beside the search box.', status: st }, [
    group('display', setRow({ label: 'Enable market ticker', forId: 'set-ticker-enable', control: enable,
      help: 'Shown beside the search box; hidden when the window is narrow.' })),
    secGroup({ caption: 'quote', level: 3, className: 'is-dependent' },
      setRow({ label: 'Reference currency', help: 'Crypto prices and FX pairs are quoted against this.', control: baseSel })),
    secGroup({ caption: 'symbols', level: 3, className: 'is-dependent', aside: 'shown while the ticker is on' },
      checkGroup('Crypto', TICKER_CRYPTOS.map((c) => ({ value: c.id, label: c.sym })), s.tickerCrypto, (vals) => saveSettings({ tickerCrypto: vals })),
      checkGroup('Forex', TICKER_FX.map((c) => ({ value: c, label: c })), s.tickerFx, (vals) => saveSettings({ tickerFx: vals }))),
  ], [callout('Prices come from CoinGecko and open.er-api.com — turning the ticker on makes network requests to those services.')]);
}

function checkGroup(label, options, selected, onChange) {
  const set = new Set(selected);
  const chips = el('div', { class: 'tick-checks' });
  for (const o of options) {
    const btn = el('button', { class: `tick-check${set.has(o.value) ? ' is-active' : ''}`, type: 'button',
      dataset: { key: `tick-${o.value}` }, 'aria-pressed': String(set.has(o.value)), text: o.label });
    btn.addEventListener('click', () => {
      if (set.has(o.value)) set.delete(o.value); else set.add(o.value);
      btn.classList.toggle('is-active');
      btn.setAttribute('aria-pressed', String(set.has(o.value)));
      onChange([...set]);
    });
    chips.append(btn);
  }
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' }, el('div', { class: 'set-label', text: label }), el('div', { class: 'set-sub', text: `Which ${label.toLowerCase()} tickers to show.` })),
    el('div', { class: 'set-control' }, chips));
}

// Wrap an async click handler so the button shows a busy state and errors surface as a toast.
function withBusy(fn) {
  return async (e, btn) => {
    const b = btn || e?.currentTarget;
    if (b) { b.disabled = true; b.classList.add('is-busy'); }
    try { await fn(); }
    catch (err) { toast(err?.message || 'Something went wrong'); }
    finally { if (b) { b.disabled = false; b.classList.remove('is-busy'); } }
  };
}

function fontRow(labelText, subText, list, current, onPick, sampleClass, key) {
  const select = el('select', { class: 'set-select', 'aria-label': labelText, dataset: { key } });
  for (const f of list) {
    const here = fontAvailable(f.stack);
    // Each option renders in its OWN face, so the menu is the preview — you can see
    // what you are choosing before you choose it, not after.
    const opt = el('option', { value: f.id, style: `font-family:${f.stack}`,
      text: here ? f.label : `${f.label} — not installed` });
    if (!here) opt.dataset.missing = '1';
    if (f.id === current) opt.selected = true;
    select.append(opt);
  }

  // Live sample of what is ACTUALLY rendering, plus the resolved family — so a silent
  // fallback is visible rather than mysterious. It sits under the label, full width, so
  // the control column holds only the select.
  const sample = el('span', { class: `set-sample ${sampleClass}`, text: 'Ag 123 — quick brown fox' });
  const note = el('div', { class: 'set-fontnote' });
  const refresh = (id) => {
    const f = pick(list, id);
    const here = fontAvailable(f.stack);
    sample.style.fontFamily = f.stack;
    note.textContent = here ? '' : `${primaryFamily(f.stack)} isn’t installed — falling back to ${primaryFamily(f.stack.split(',').slice(1).join(',')) || 'the system default'}.`;
    note.hidden = here;
  };
  refresh(current);
  select.addEventListener('change', () => { refresh(select.value); onPick(select.value); });

  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' }, el('div', { class: 'set-label', text: labelText }), el('div', { class: 'set-sub', text: subText }), sample, note),
    el('div', { class: 'set-control' }, select));
}

// One stepper per text role: − / percentage / +, with a live sample set in that role's
// own token so the change is visible before you leave the row. Reset is the group's
// caption action, always there and disabled at 100%, so nothing below shifts when the
// first step is taken. Saves merge into the whole typeSizes object, so two quick clicks
// on different rows cannot clobber each other (saveSettings reads inside the queue).
function typeSizeGroup(sizes) {
  const steppers = {};
  const resetBtn = el('button', { class: 'btnx ghosty sm', type: 'button', dataset: { key: 'type-reset' }, onclick: () => setAll(DEFAULT_TYPE_SIZES) }, icon('reset', 13), el('span', { text: 'Reset' }));
  const syncReset = () => {
    const allDefault = TYPE_ROLES.every((r) => (sizes[r.id] ?? 1) === 1);
    resetBtn.disabled = allDefault;
    resetBtn.setAttribute('aria-disabled', String(allDefault));
  };

  const setAll = async (next) => {
    sizes = { ...sizes, ...next };
    for (const r of TYPE_ROLES) steppers[r.id]?.(sizes[r.id]);
    syncReset();
    await saveSettings({ typeSizes: { ...sizes } });
  };

  const rows = TYPE_ROLES.map((r) => {
    const value = el('span', { class: 'set-step-val' });
    const sample = el('span', { class: `set-sample set-sample-role${r.mono ? ' sample-mono' : ' sample-ui'}`, text: r.sample, style: `font-size: var(${r.token}); font-weight: ${r.weight}` });
    const minus = el('button', { class: 'set-step', title: `Smaller ${r.label.toLowerCase()}`, 'aria-label': `Smaller ${r.label.toLowerCase()}` }, icon('minus', 13));
    const plus = el('button', { class: 'set-step', title: `Larger ${r.label.toLowerCase()}`, 'aria-label': `Larger ${r.label.toLowerCase()}` }, icon('plus', 13));
    const show = (v) => {
      value.textContent = `${Math.round(v * 100)}%`;
      minus.disabled = TYPE_STEPS.indexOf(v) <= 0;
      plus.disabled = TYPE_STEPS.indexOf(v) >= TYPE_STEPS.length - 1;
    };
    steppers[r.id] = show;
    const step = (dir) => {
      const i = TYPE_STEPS.indexOf(sizes[r.id] ?? 1);
      const next = TYPE_STEPS[Math.max(0, Math.min(TYPE_STEPS.length - 1, i + dir))];
      if (next !== sizes[r.id]) setAll({ [r.id]: next });
    };
    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));
    show(sizes[r.id] ?? 1);
    return el('div', { class: 'set-row' },
      el('div', { class: 'set-row-text' },
        el('div', { class: 'set-label', text: r.label }),
        el('div', { class: 'set-sub', text: r.sub }),
      ),
      el('div', { class: 'set-control' }, sample,
        el('div', { class: 'set-stepper', role: 'group', 'aria-label': `${r.label} size` }, minus, value, plus)),
    );
  });
  const node = secGroup({ caption: 'text sizes', level: 3, acts: resetBtn },
    el('p', { class: 'sec-help', text: 'Tune one kind of text at a time. 100% is the designed size for that role, relative to the interface size above.' }),
    ...rows);
  syncReset();
  // bound to the group, which lives as long as the rows do (it was bound to the old
  // pseudo-header row; the listener retires once its node leaves the DOM)
  onSettingsChange(node, (next) => {
    sizes = { ...sizes, ...(next.typeSizes || {}) };
    for (const r of TYPE_ROLES) steppers[r.id]?.(sizes[r.id] ?? 1);
    syncReset();
  });
  return node;
}

// A labelled row whose control is a segmented button group. `sub` is the row's own
// description; when an option carries its own `sub`, the selected one's is appended so
// the consequence of the choice is readable without picking it first.
function segRow(label, sub, list, current, key) {
  const note = el('div', { class: 'set-seghint' });
  const seg = el('div', { class: 'set-seg', role: 'group', 'aria-label': label });
  const showHint = (id) => { note.textContent = list.find((x) => x.id === id)?.sub || ''; };
  for (const opt of list) {
    const btn = el('button', { class: `set-seg-btn${opt.id === current ? ' is-active' : ''}`, type: 'button',
      dataset: { key: `seg-${key}-${opt.id}` }, 'aria-pressed': String(opt.id === current), text: opt.label });
    btn.addEventListener('click', () => {
      for (const sib of seg.children) {
        sib.classList.toggle('is-active', sib === btn);
        sib.setAttribute('aria-pressed', String(sib === btn));
      }
      showHint(opt.id);
      saveSettings({ [key]: opt.id });
    });
    seg.append(btn);
  }
  showHint(current);
  const row = el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: label }),
      el('div', { class: 'set-sub', text: sub }),
      note,
    ),
    el('div', { class: 'set-control' }, seg),
  );
  onSettingsChange(row, (next) => {
    const id = next[key];
    for (const btn of seg.children) {
      const on = btn.textContent === list.find((x) => x.id === id)?.label;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    showHint(id);
  });
  return row;
}
