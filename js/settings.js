// Settings: seven numbered plates — Appearance (fonts, size, text sizes, tabs bar), Backup &
// sync (file + Google Drive), the Vault's PIN, the market ticker, Zen, the new tab page, and
// StackNest on the web (one connected website) — with an index beside them.
// Fonts are offline-safe stacks (bundled + system) so nothing hits the network.

import { el, icon, toast, confirmDialog, secGroup, sectionHead, pickFile } from './ui.js';
import { getKey, setKey, update } from './store.js';
import { playChime } from './chime.js';
import { WALLPAPERS, WALLPAPER_IDS, WALLPAPER_KEY, DEFAULT_WALLPAPER, MAX_OWN, prepareWallpaper, wallpaperFor, ownWallpapers } from './wallpapers.js';
import { exportBackup, importFlow } from './backup.js';
import { CLOUD_KEY, loadCloudState, connect, switchAccount, signOut, backupNow, restoreLatest, driveAvailable, NO_SIGNIN_MSG, isConfigured, canChooseAccount } from './drive.js';
import { LOCK_KEY, loadLock, hasPin, setPin, clearPin, verifyPin, validatePin,
         isLockedOut, hasSecurityQuestion, promptSecurityAnswer,
         SECURITY_QUESTIONS, MAX_FAILS } from './lock.js';
import { WEB_KEY, PLACEHOLDER_ORIGIN, parseOrigin, webStatus, connectWeb, disconnectWeb } from './webbridge.js';

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
  zenWallpaper: DEFAULT_WALLPAPER, zenCollection: '',   // Zen mode (js/zen.js)
  zenEyeRest: true,                                      // a 30-second pause every 30 min in Zen (js/zenrest.js)
  zenMotion: true,                                       // the wallpaper's slow animation in Zen
  boardWallpaper: false,                                 // the Zen wallpaper behind the board too, still (js/wallboard.js)
  reminderChime: true,                                   // a soft chime with reminder notifications (js/chime.js)
  newTab: true,                                          // StackNest replaces Chrome's new tab page (boot.js)
};

// boot.js runs before any module and cannot wait for chrome.storage, so the new-tab choice is
// mirrored into localStorage whenever settings are applied (NTP_KEY must match boot.js)
const NTP_KEY = 'stacknest:ntp';

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
    zenWallpaper: WALLPAPER_IDS.includes(m.zenWallpaper) ? m.zenWallpaper : DEFAULT_WALLPAPER,
    zenCollection: typeof m.zenCollection === 'string' ? m.zenCollection.slice(0, 200) : '',
    zenEyeRest: m.zenEyeRest !== false,
    reminderChime: m.reminderChime !== false,
    zenMotion: m.zenMotion !== false,
    boardWallpaper: m.boardWallpaper === true,
    newTab: m.newTab !== false,
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
  try { localStorage.setItem(NTP_KEY, s.newTab === false ? 'off' : 'on'); } catch { /* boot.js then keeps StackNest */ }
  document.dispatchEvent(new CustomEvent('stacknest:tabsbar', { detail: pick(TAB_BARS, s.tabsBar).id }));
}


/* ————————————————————————— settings view ————————————————————————— */

let root;
let includeBookmarks = false; // export choice; survives settings-view re-renders

export function initSettings(options) {
  ({ root } = options);
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area !== 'local') return;
    let external = !!(c[CLOUD_KEY] || c[LOCK_KEY] || c[WEB_KEY]);
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

/* ————————————————————————— the plates —————————————————————————
   One static head ("applies to · This device"), then an index beside the numbered plates.
   Every plate stays in the scroll, so ⌘F still finds any setting; the index only jumps.
   Its items are buttons, not anchors, so the #view hash router never sees them. */

const PLATES = [
  { id: 'set-appearance', num: '01', name: 'Appearance' },
  { id: 'set-backup',     num: '02', name: 'Backup & sync' },
  { id: 'set-vault',      num: '03', name: 'Vault' },
  { id: 'set-ticker',     num: '04', name: 'Market ticker' },
  { id: 'set-zen',        num: '05', name: 'Zen' },
  { id: 'set-newtab',     num: '06', name: 'New tab' },
  { id: 'set-web',        num: '07', name: 'StackNest on the web' },
];
const newTabStatus = (s) => (s.newTab ? 'stacknest' : 'chrome’s page');
const zenStatus = (s) => `${s.zenWallpaper === 'theme' ? 'no wallpaper' : s.zenWallpaper === 'custom' ? 'your image' : (WALLPAPERS.find((w) => w.id === s.zenWallpaper)?.label || '').toLowerCase()}${s.zenEyeRest ? ' · eye rest' : ''}`;
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
  const needsSetup = !isConfigured();        // no OAuth client ID in this build
  const unavailable = !needsSetup && !driveAvailable();   // a browser without Google sign-in for extensions
  const connected = !!(cloud.connected || cloud.email);
  const [pinSet, lockedOut, web] = await Promise.all([hasPin(), isLockedOut(), webStatus()]);
  const status = {
    'set-appearance': { text: appearanceStatus(s) },
    'set-backup': { text: needsSetup ? 'setup required' : unavailable ? 'drive not available here' : connected ? `drive · last backup ${shortWhen(cloud.lastBackupAt)}` : 'drive not connected' },
    'set-vault': { text: lockedOut ? 'locked out' : pinSet ? 'pin set' : 'no pin', tone: lockedOut ? 'danger' : null },
    'set-ticker': { text: tickerStatus(s) },
    'set-zen': { text: zenStatus(s) },
    'set-newtab': { text: newTabStatus(s) },
    'set-web': { text: WEB_CHIP[web.state] },
  };
  const index = setIndex(status);
  const frag = [
    sectionHead({ className: 'set-top', scope: { key: 'applies to', value: 'This device' }, note: 'Changes save as you make them — there is no Save button.' }),
    el('div', { class: 'sec-body' }, el('div', { class: 'set-layout' }, index, el('div', { class: 'set-plates' },
      appearancePlate(s, status['set-appearance']),
      backupPlate({ cloud, needsSetup, unavailable, connected }, status['set-backup']),
      await vaultPlate(status['set-vault']),
      tickerPlate(s, status['set-ticker']),
      await zenPlate(s, status['set-zen']),
      newTabPlate(s, status['set-newtab']),
      webPlate(web, status['set-web'])))),
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
    setStatus('set-zen', zenStatus(next));
    setStatus('set-newtab', newTabStatus(next));
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
function backupPlate({ cloud, needsSetup, unavailable, connected }, st) {
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
    group('google drive', driveGroup(cloud, needsSetup, unavailable, connected)),
  ], [
    callout('Import replaces your current spaces, collections, notes, tags, My Space, the Vault and settings. Bookmarks, if present, are added under a new "StackNest Import" folder (nothing is overwritten).'),
    callout(driveNote(needsSetup, unavailable)),
  ]);
}

// Google Drive: set up required / not available in this browser / Connect / the connected
// account with its actions. The dot is green only when an account is actually connected.
function driveGroup(cloud, needsSetup, unavailable, connected) {
  const name = (inner) => el('span', { class: 'cloud-name' }, el('span', { class: `cloud-dot g${connected ? ' is-on' : ''}` }), inner);
  const box = el('div', { class: 'cloud-provider' });
  if (needsSetup || unavailable) {
    box.append(el('div', { class: 'cloud-row' }, name('Google Drive'),
      el('button', { class: 'btnx soft', disabled: 'true' }, el('span', { text: needsSetup ? 'Set up required' : 'Not available here' }))));
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

function driveNote(needsSetup, unavailable) {
  if (needsSetup) return 'Google Drive backup isn’t available in this build.';
  if (unavailable) return NO_SIGNIN_MSG;
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

/* ——— 05 Zen: the wallpaper behind the uncluttered page ——— */
async function zenPlate(s, st) {
  // your own pictures: a small gallery (up to MAX_OWN). 'custom' is the setting for "one of
  // mine"; which one is the gallery's `active`. Each has a × to remove it.
  let own = ownWallpapers(await getKey(WALLPAPER_KEY, null));
  let current = s.zenWallpaper;
  const grid = el('div', { class: 'wall-grid', role: 'radiogroup', 'aria-label': 'Zen wallpaper' });
  const ownKey = (id) => `own:${id}`;
  const isOn = (key) => (key.startsWith('own:') ? current === 'custom' && own.active === key.slice(4) : current === key);

  const paint = () => { for (const w of grid.querySelectorAll('.wall-sw')) { const on = isOn(w.dataset.wall); w.classList.toggle('is-active', on); w.setAttribute('aria-checked', String(on)); } };
  const keep = async (next) => {
    try { await setKey(WALLPAPER_KEY, next.images.length ? next : null); own = next; return true; }
    catch { toast('Not enough room on this device: remove one of your images first'); return false; }
  };
  // the images can change elsewhere (Zen's shuffle picks which of yours shows): read them fresh
  // before any change here, and redraw when they change
  const fresh = async () => { own = ownWallpapers(await getKey(WALLPAPER_KEY, null)); };
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !(WALLPAPER_KEY in ch)) return;
      own = ownWallpapers(ch[WALLPAPER_KEY].newValue ?? null);
      draw();
    });
  } catch { /* no storage events here */ }
  const choose = async (key) => {
    if (key.startsWith('own:')) {
      await fresh();
      const id = key.slice(4);
      if (own.active !== id && !(await keep({ ...own, active: id }))) return;
      key = 'custom';
    }
    current = key;
    paint();
    saveSettings({ zenWallpaper: key });
  };
  const upload = withBusy(async () => {
    await fresh();
    if (own.images.length >= MAX_OWN) { toast(`Up to ${MAX_OWN} of your own images: remove one to add another`); return; }
    const file = await pickFile('image/*');
    if (!file) return;
    const img = await prepareWallpaper(file);
    await fresh();
    const id = `own${Date.now().toString(36)}`;
    if (!(await keep({ images: [...own.images, { id, ...img }], active: id }))) return;
    draw();
    choose(ownKey(id));
    toast('Wallpaper added');
  });
  const remove = async (id) => {
    await fresh();
    const images = own.images.filter((x) => x.id !== id);
    const wasShowing = current === 'custom' && own.active === id;
    if (!(await keep({ images, active: own.active === id ? images[0]?.id || null : own.active }))) return;
    if (wasShowing && !images.length) choose(DEFAULT_WALLPAPER);
    else if (wasShowing) saveSettings({ zenWallpaper: 'custom' });   // the next of yours takes its place
    draw();
    toast('Image removed');
  };

  const swatch = (key, label, css, extra = null) => {
    const b = el('button', { class: `wall-sw${isOn(key) ? ' is-active' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(isOn(key)),
      dataset: { wall: key, key: `wall-${key}` } },
      el('span', { class: `wall-thumb${key === 'theme' ? ' is-theme' : ''}`, style: css ? `background:${css}` : null }, extra),
      el('span', { class: 'wall-name', text: label }));
    b.addEventListener('click', () => (key === 'add' ? upload() : choose(key)));
    return b;
  };
  // one of yours: the swatch, with a small × beside it (a sibling, not inside the button)
  const ownSwatch = (img, n) => el('div', { class: 'wall-own' },
    swatch(ownKey(img.id), own.images.length > 1 ? `Yours ${n}` : 'Your image', `url("${img.dataUrl}") center / cover no-repeat`),
    el('button', { class: 'wall-own-x', type: 'button', title: 'Remove this image', 'aria-label': `Remove your image${own.images.length > 1 ? ` ${n}` : ''}`,
      dataset: { key: `wall-remove-${img.id}` }, onclick: () => remove(img.id) }, icon('close', 11)));
  function draw() {
    grid.replaceChildren(
      ...WALLPAPERS.map((w) => swatch(w.id, w.label, wallpaperFor(w.id).css)),
      swatch('theme', 'Plain', null),
      ...own.images.map((img, i) => ownSwatch(img, i + 1)),
      ...(own.images.length < MAX_OWN ? [swatch('add', own.images.length ? 'Add image…' : 'Upload…', null, icon('upload', 18))] : []),
    );
  }
  draw();

  const motionSw = switchCtl('set-zen-motion', 'Animate the wallpaper', s.zenMotion, 'zen-motion', (on) => saveSettings({ zenMotion: on })
    .then(() => toast(on ? 'Wallpaper animation on' : 'Wallpaper animation off')));
  onSettingsChange(motionSw, (next) => { motionSw.checked = next.zenMotion; });
  // the same picture behind the board, still (js/wallboard.js paints it)
  const boardSw = switchCtl('set-board-wall', 'Show the wallpaper outside Zen', s.boardWallpaper, 'board-wall', (on) => saveSettings({ boardWallpaper: on })
    .then(() => toast(on ? 'Wallpaper shown behind the board' : 'Wallpaper only in Zen')));
  onSettingsChange(boardSw, (next) => { boardSw.checked = next.boardWallpaper; });
  const replaceBtn = el('button', { class: 'btnx soft sm', type: 'button', dataset: { key: 'wall-upload' }, onclick: upload }, icon('image', 13), el('span', { text: 'Add my own image…' }));
  const openBtn = el('button', { class: 'btnx soft', type: 'button', dataset: { key: 'zen-open' },
    onclick: () => document.getElementById('zen-btn')?.click() }, icon('zen', 14), el('span', { text: 'Enter zen' }));

  const eye = switchCtl('set-zen-eye', 'Rest your eyes', s.zenEyeRest, 'zen-eye', (on) => saveSettings({ zenEyeRest: on })
    .then(() => toast(on ? 'Eye rest on' : 'Eye rest off')));
  onSettingsChange(eye, (next) => { eye.checked = next.zenEyeRest; });
  const chimeSw = switchCtl('set-chime', 'Chime with reminders', s.reminderChime, 'chime-on', (on) => saveSettings({ reminderChime: on })
    .then(() => toast(on ? 'Reminders chime' : 'Reminders are silent')));
  onSettingsChange(chimeSw, (next) => { chimeSw.checked = next.reminderChime; });
  const hear = el('button', { class: 'btnx ghosty sm', type: 'button', dataset: { key: 'chime-play' }, onclick: () => playChime() }, icon('bell', 13), el('span', { text: 'Play' }));

  return plate(PLATES[4], { desc: 'An uncluttered page: one collection, your to-dos, what you have pinned and a calendar, on a wallpaper. Switch it on with the zen button beside the theme; Esc leaves.', status: st }, [
    group('enter', setRow({ label: 'Zen mode', help: 'Pick the collection inside Zen itself. Pin links, folders and Notes cards with the pin on their card. Drag panes and items to arrange them.', control: openBtn })),
    group('breaks', setRow({ label: 'Rest your eyes', forId: 'set-zen-eye', control: eye,
      help: 'After every 30 minutes of screen time in Zen, a 30-second pause to look into the distance. Five minutes away from the screen starts the count again.' }),
      setRow({ label: 'Chime with reminders', forId: 'set-chime', control: [hear, chimeSw],
        help: 'A soft bell when a reminder’s notification appears, and when an eye-rest pause ends. Add a timed reminder from the calendar in Zen.' })),
    secGroup({ caption: 'wallpaper', level: 3, acts: el('div', { class: 'wall-acts' }, replaceBtn) }, grid,
      setRow({ label: 'Animate the wallpaper', forId: 'set-zen-motion', control: motionSw,
        help: 'A slow drift, with mist, petals, leaves, fireflies or stars to suit each picture. Off when your system asks for reduced motion.' }),
      setRow({ label: 'Show it outside Zen too', forId: 'set-board-wall', control: boardSw,
        help: 'The same picture behind the board and every view, held still, with the sidebar and panels turned to frosted glass over it. Plain shows no picture.' })),
  ], [callout(`Add up to ${MAX_OWN} of your own images; the × on one removes it. They are resized and kept on this device only — not in a backup file or a Drive sync. Plain uses the current theme’s background. In Zen, the picture button shuffles through them all.`)]);
}

/* ——— 06 New tab: whether StackNest takes over Chrome's new tab page ——— */
function newTabPlate(s, st) {
  const sw = switchCtl('set-newtab-on', 'Open StackNest in new tabs', s.newTab, 'newtab-on', (on) => saveSettings({ newTab: on })
    .then(() => toast(on ? 'New tabs open StackNest' : 'New tabs open Chrome’s page — use the toolbar button for StackNest')));
  onSettingsChange(sw, (next) => { sw.checked = next.newTab; });
  return plate(PLATES[5], { desc: 'Show StackNest on every new tab, or keep Chrome’s own new tab page and open StackNest from the toolbar.', status: st }, [
    group('new tab', setRow({ label: 'Open StackNest in new tabs', forId: 'set-newtab-on', control: sw,
      help: 'Off: new tabs show Chrome’s own page, and StackNest opens from its button in the toolbar.' })),
  ], [callout(['To keep the button handy, click the puzzle-piece icon in Chrome’s toolbar and pin StackNest. ',
    'Chrome only lets an extension replace the new tab page as a whole, so with this off a new tab opens StackNest for a moment, then hands over to Chrome’s page (its address shows chrome://new-tab-page).'])]);
}

/* ——— 07 StackNest on the web: one website, chosen here, that shows the new tab's content ———
   There is no StackNest website yet. This is the switch for when there is: the address is
   typed here, Connect asks Chrome for that one site, and the bridge in js/webbridge.js answers
   its pages. The status never claims the site is up — only whether it has asked, and when.
   The connection is this device's alone: it is kept under its own key, never in a backup. */
const WEB_CHIP = { off: 'not connected', waiting: 'waiting for the site', seen: 'connected' };
let webDraft = null;   // the address being typed; survives a re-render until it is connected

function webStatusText(web) {
  if (web.state === 'seen') return `Connected. ${web.origin} last asked for your StackNest ${shortWhen(new Date(web.lastSeenAt).toISOString())}. That is when it last asked — not a sign the site is up now.`;
  if (web.state === 'waiting') return `Waiting for the site. StackNest will answer pages on ${web.origin} when they ask; none has asked yet, so nothing has been sent.`;
  if (web.endedBy === 'chrome' && web.origin) return `Not connected. Site access for ${web.origin} was turned off in Chrome, so StackNest stopped answering it. Nothing is shared.`;
  return 'Not connected. Nothing is shared with any website.';
}

function webPlate(web, st) {
  const on = web.state !== 'off';
  const input = el('input', { type: 'url', id: 'set-web-origin', class: 'set-input', inputmode: 'url', autocomplete: 'off',
    placeholder: `${PLACEHOLDER_ORIGIN} (example only)`, 'aria-describedby': 'set-web-error', dataset: { key: 'web-origin' } });
  input.value = on ? web.origin : (webDraft ?? web.origin ?? '');
  input.readOnly = on;   // to change the address, disconnect first: the permission is for one site
  const err = el('div', { class: 'set-fieldnote', id: 'set-web-error', role: 'alert' });
  const showError = (msg) => { err.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  input.addEventListener('input', () => { webDraft = input.value; showError(''); });
  input.addEventListener('change', () => { if (input.value.trim() && !on) showError(parseOrigin(input.value).error); });

  const dot = el('span', { class: `cloud-dot g web-dot is-${web.state}`, 'aria-hidden': 'true' });
  const statusLine = el('p', { class: 'web-status', role: 'status' }, dot, el('span', { text: webStatusText(web) }));

  const sw = switchCtl('set-web-on', 'Connect StackNest to this site', on, 'web-on', async (want) => {
    sw.disabled = true;
    try {
      if (want) {
        const p = parseOrigin(input.value);
        if (p.error) { sw.checked = false; showError(p.error); input.focus(); return; }
        input.value = p.origin;
        const ok = await confirmDialog({
          title: `Connect ${p.host}?`,
          message: `Pages on ${p.origin} will be able to show, in this browser, the same things as your new tab: collections, your Chrome bookmarks (the Library), My Space, notes and to-dos, tags, Zen, and these settings — and to tick to-dos off. The Vault, your PIN and your Google account are never shared. Chrome will ask you to allow StackNest on that site; switching this off takes it all back.`,
          confirmLabel: 'Connect',
        });
        if (!ok) { sw.checked = false; return; }
        const r = await connectWeb(p.origin);   // Chrome's prompt; the click above is the gesture it needs
        if (!r.granted) { sw.checked = false; toast('Chrome’s permission wasn’t given — nothing is shared'); return; }
        webDraft = null;
        toast(`Connected to ${p.host} — waiting for the site`);
      } else {
        const r = await disconnectWeb();
        toast(r.removed ? 'Disconnected — the site gets nothing more' : 'Disconnected — Chrome kept its site access; remove it in Chrome’s extension settings');
      }
    } catch (e) {
      sw.checked = !want;
      toast(e?.message || 'Something went wrong');
    } finally { sw.disabled = false; }
    // the plate re-renders from the storage change; this covers a declined prompt, which stores nothing
  });

  return plate(PLATES[6], { desc: 'Let one website of your choosing show what your new tab shows, so it can be your home page too. There is no StackNest website yet; when there is, connect it here — no extension update needed.', status: st }, [
    group('site', setRow({ label: 'Web address', forId: 'set-web-origin', control: input,
      help: on ? 'Switch off below to change it.' : 'The site’s https address, like the example in the box. Leave it empty until there is a StackNest website.',
      extra: [err] })),
    group('connection', setRow({ label: 'Connect', forId: 'set-web-on', control: sw, extra: [statusLine],
      help: 'Off: StackNest answers no website, and Chrome grants it no access to any site.' })),
  ], [
    callout([el('strong', {}, 'Nothing leaves this device until you connect. '),
      'Then only pages on that one address can ask, only in this browser, and StackNest answers inside the page — there is no StackNest server and nothing goes into a link. What the site then does with what it shows is up to the site, so connect only one you trust.']),
    callout(['Never shared: the Vault and anything in it, your PIN, and your Google account or its Drive backup. Switching off stops the answers at once, unregisters the bridge and gives Chrome’s site access back.']),
  ]);
}

// an on/off switch in the house style (the same control as the ticker's)
function switchCtl(id, label, checked, key, onChange) {
  const sw = el('input', { type: 'checkbox', id, class: 'set-check set-switch', role: 'switch', 'aria-label': label, dataset: { key } });
  sw.checked = !!checked;
  sw.addEventListener('change', () => onChange(sw.checked));
  return sw;
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
