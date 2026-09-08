// Settings: typography (interface font, mono font, interface size) + backup panel.
// Fonts are offline-safe stacks (bundled + system) so nothing hits the network.

import { el, icon, toast, confirmDialog } from './ui.js';
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
  { id: 'heading', label: 'Headings', sub: 'View and section titles.', sample: 'Collections', token: '--t6' },
  { id: 'title', label: 'Titles', sub: 'Card and collection titles.', sample: 'Weekend reading', token: '--t4' },
  { id: 'body', label: 'Body text', sub: 'Navigation, buttons, inputs, notes.', sample: 'Drag a tab down from the tray', token: '--t3' },
  { id: 'small', label: 'Small text', sub: 'Counts, domains, timestamps, section labels.', sample: 'UPDATED SEP 7 · 12 TABS', token: '--t2', mono: true },
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
    : 'Five wrong PINs locks the Vault. No Google Drive account is connected, so the answer above would be your ONLY way back in — connect Drive below if you want a second route.'));
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
    if (a.value !== b.value) { err.textContent = 'The two entries don\u2019t match.'; a.value = ''; b.value = ''; continue; }
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
    const ok = await confirmDialog({ title: 'Enter your current PIN', message: 'Confirm it\u2019s you.', extra, confirmLabel: 'Continue' });
    if (!ok) return false;
    const r = await verifyPin(input.value);
    if (r.ok) return true;
    if (r.lockedOut) { toast('Too many wrong PINs \u2014 the Vault is locked'); return false; }
    note = `Wrong PIN \u2014 ${r.left} attempt${r.left === 1 ? '' : 's'} left.`;
  }
}

/* Recovery route 1: the security question. Clears the lockout and unlocks for this
   session, then sends you straight to setting a new PIN — a recovery that leaves the
   forgotten PIN in place has not recovered anything. */
async function recoverByQuestionFlow() {
  if (!(await promptSecurityAnswer())) return;
  toast('Vault unlocked \u2014 set a new PIN');
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
    await confirmDialog({
      title: 'No recovery account', confirmLabel: 'Close', cancelLabel: 'Close',
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
  toast('PIN cleared \u2014 set a new one to lock the Vault again');
}

async function vaultCard() {
  const [lock, pinSet, lockedOut, hasQ] = await Promise.all([loadLock(), hasPin(), isLockedOut(), hasSecurityQuestion()]);
  const card = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h' }, icon('lock', 16), 'Vault'),
    el('p', { class: 'set-sub', text: 'The Vault holds bookmarks you have moved out of Chrome, behind a PIN. Move things into it from My Space, or straight from the Library.' }),
  );

  // Say what it is worth. A lock that oversells itself is worse than no lock.
  card.append(el('p', { class: 'set-note lock-caveat' },
    el('strong', {}, 'What this does and doesn\u2019t do. '),
    'Moving a bookmark here really does remove it from Chrome, so it leaves the bookmarks bar, chrome://bookmarks and address-bar suggestions. But the Vault\u2019s contents are stored in plain text on this device: the PIN stops the UI from showing them, not someone reading storage directly. Treat it as a locked drawer, not a safe \u2014 and note that an export with bookmarks included does not contain them, since Chrome no longer has them.'));

  if (!pinSet) {
    card.append(el('div', { class: 'set-actions' },
      el('button', { class: 'btnx primary', onclick: withBusy(async () => { if (await setPinFlow()) render(); }) },
        el('span', { text: 'Set a Vault PIN' }))));
    return card;
  }

  if (lockedOut) {
    card.append(el('p', { class: 'set-note lock-out' },
      el('strong', {}, 'The Vault is locked. '),
      `${MAX_FAILS} wrong PINs in a row. Recover it below \u2014 guessing again won\u2019t help.`));
  }

  card.append(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: 'PIN' }),
      el('div', { class: 'set-sub', text: lockedOut
        ? 'Locked after too many wrong attempts.'
        : `Set. ${MAX_FAILS} wrong attempts in a row locks the Vault.` }),
    ),
    el('div', { class: 'set-control' },
      el('button', { class: 'btnx ghosty', disabled: lockedOut ? 'true' : null,
        onclick: withBusy(async () => { if (await requirePin() && await setPinFlow({ keepQuestion: true })) render(); }) },
        el('span', { text: 'Change PIN' })),
    ),
  ));

  card.append(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: 'Recover with your security question' }),
      el('div', { class: 'set-sub', text: hasQ ? lock.question : 'No security question was set for this PIN.' }),
    ),
    el('div', { class: 'set-control' },
      el('button', { class: 'btnx ghosty', disabled: hasQ ? null : 'true',
        onclick: withBusy(async () => { await recoverByQuestionFlow(); render(); }) },
        el('span', { text: 'Answer question' })),
    ),
  ));

  card.append(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: 'Recover with Google' }),
      el('div', { class: 'set-sub', text: lock.ownerEmail
        ? `Sign out of Drive and back in as ${lock.ownerEmail} to clear the PIN.`
        : 'No Google account was connected when this PIN was set, so this route is unavailable.' }),
    ),
    el('div', { class: 'set-control' },
      el('button', { class: 'btnx ghosty', disabled: lock.ownerEmail ? null : 'true',
        onclick: withBusy(async () => { await resetPinFlow(); render(); }) },
        el('span', { text: 'Sign out and reset' })),
    ),
  ));

  return card;
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

async function cloudCard() {
  const cloud = await loadCloudState();
  const live = isLive();
  const needsSetup = live && !isConfigured(); // real extension, but no OAuth client ID yet
  const connected = !!(cloud.connected || cloud.email);
  const card = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h' }, icon('cloud', 16), 'Cloud sync'),
    el('p', { class: 'set-sub', text: 'Back up everything — spaces, collections, notes, tags, My Space and the Vault (PIN included), and settings — to your own Google Drive and restore it on any machine. One file, overwritten in place on every backup, in a private app folder only StackNest can read; it never appears in your Drive.' }),
  );

  const gdrive = el('div', { class: 'cloud-provider' });
  if (needsSetup) {
    gdrive.append(
      el('div', { class: 'cloud-row' },
        el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot g' }), 'Google Drive'),
        el('button', { class: 'btnx soft', disabled: 'true' }, el('span', { text: 'Set up required' })),
      ),
    );
  } else if (!connected) {
    gdrive.append(
      el('div', { class: 'cloud-row' },
        el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot g' }), 'Google Drive'),
        el('button', { class: 'btnx primary', onclick: withBusy(async () => { await connect(); toast('Google Drive connected'); }) }, el('span', { text: 'Connect' })),
      ),
    );
  } else {
    gdrive.append(
      el('div', { class: 'cloud-row' },
        el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot g' }), el('span', { class: 'cloud-acct', text: cloud.email || 'Google Drive' })),
        el('div', { class: 'cloud-btns' },
          el('button', { class: 'btnx ghosty', title: 'Sign in with a different Google account', onclick: withBusy(async () => { await switchAccount(); toast('Switched account'); }) }, icon('swap', 13), el('span', { text: 'Switch account' })),
          el('button', { class: 'btnx ghosty', title: 'Sign out of Google Drive on this device', onclick: withBusy(signOutFlow) }, icon('logout', 13), el('span', { text: 'Sign out' })),
        ),
      ),
      el('div', { class: 'cloud-meta', text: `Last backup ${shortWhen(cloud.lastBackupAt)} · last restore ${shortWhen(cloud.lastRestoreAt)}` }),
      el('div', { class: 'set-actions' },
        el('button', { class: 'btnx primary', onclick: withBusy(async () => { const r = await backupNow(includeBookmarks); toast(`Backed up ${r.collections} collection${r.collections === 1 ? '' : 's'}${r.bookmarks ? ' + bookmarks' : ''} to Drive`); }) }, el('span', { text: 'Back up now' })),
        el('button', { class: 'btnx soft', onclick: withBusy(async () => {
          const ok = await confirmDialog({ title: 'Restore from Drive?', message: 'This replaces your current spaces, collections, notes, tags, My Space, the Vault and settings with the latest cloud backup.', confirmLabel: 'Restore', danger: true });
          if (!ok) return;
          const r = await restoreLatest(); toast(`Restored ${r.collections} collection${r.collections === 1 ? '' : 's'} from Drive`);
        }) }, el('span', { text: 'Restore latest' })),
      ),
    );
  }
  card.append(gdrive);

  if (needsSetup) {
    card.append(el('p', { class: 'set-note', text: 'Google Drive sync isn’t set up in this build yet. Add your own Google OAuth client ID to the manifest to enable it — see the README’s “Cloud sync setup” steps.' }));
  } else if (!live) {
    card.append(el('p', { class: 'set-note', text: 'Preview mode: Google sign-in and Drive aren’t available outside the packaged extension, so this simulates the cloud locally. In the real extension it uses your Google account.' }));
  } else {
    // Be explicit about WHOSE account this is: nothing is pre-connected, and the backup
    // goes to the signed-in person's own private Drive folder.
    card.append(el('p', { class: 'set-note', text: canChooseAccount()
      ? 'You choose the Google account. “Connect” opens Google’s account picker, and “Switch account” moves Drive sync to a different one at any time. Your backup lives in that account’s private StackNest folder — no one else can read it.'
      : 'Drive sync signs in as the Google account this Chrome profile is signed into, and Chrome offers no picker for it. To use a different account, switch Chrome profiles — or turn on the built-in account chooser by adding a Web OAuth client ID (see js/authConfig.js). Your backup always lives in your own private Drive folder; the developer has no access to it.' }));
  }

  // StackNest Cloud (Pro) — needs a hosted backend; placeholder for now
  card.append(el('div', { class: 'cloud-provider is-soon' },
    el('div', { class: 'cloud-row' },
      el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot pro' }), 'StackNest Cloud', el('span', { class: 'cloud-badge', text: 'PRO' })),
      el('button', { class: 'btnx soft', disabled: 'true' }, el('span', { text: 'Coming soon' })),
    ),
    el('div', { class: 'cloud-meta', text: 'Managed cross-device sync on stacknest.com — a subscription tier arriving later.' }),
  ));

  return card;
}

async function tickerCard() {
  const s = await loadSettings();
  const card = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h' }, icon('refresh', 15), 'Market ticker'),
    el('p', { class: 'set-sub', text: 'Show a live crypto + forex marquee beside the search bar. Prices come from CoinGecko and open.er-api.com — turning this on makes network requests to those services.' }),
  );

  const enable = el('input', { type: 'checkbox', class: 'set-check' });
  enable.checked = s.tickerEnabled;
  enable.addEventListener('change', () => saveSettings({ tickerEnabled: enable.checked }).then(() => toast(enable.checked ? 'Ticker enabled' : 'Ticker off')));
  card.append(el('label', { class: 'set-toggle' }, enable, el('span', {}, 'Enable market ticker')));

  const baseSel = el('select', { class: 'set-select', 'aria-label': 'Reference currency' });
  for (const c of TICKER_BASES) { const o = el('option', { value: c, text: c }); if (c === s.tickerBase) o.selected = true; baseSel.append(o); }
  baseSel.addEventListener('change', () => saveSettings({ tickerBase: baseSel.value }).then(() => toast(`Quoted in ${baseSel.value}`)));
  card.append(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' }, el('div', { class: 'set-label', text: 'Reference currency' }), el('div', { class: 'set-sub', text: 'Crypto prices and FX pairs are quoted against this.' })),
    el('div', { class: 'set-control' }, baseSel)));

  card.append(checkGroup('Crypto', TICKER_CRYPTOS.map((c) => ({ value: c.id, label: c.sym })), s.tickerCrypto, (vals) => saveSettings({ tickerCrypto: vals })));
  card.append(checkGroup('Forex', TICKER_FX.map((c) => ({ value: c, label: c })), s.tickerFx, (vals) => saveSettings({ tickerFx: vals })));
  return card;
}

function checkGroup(label, options, selected, onChange) {
  const set = new Set(selected);
  const chips = el('div', { class: 'tick-checks' });
  for (const o of options) {
    const btn = el('button', { class: `tick-check${set.has(o.value) ? ' is-active' : ''}`, text: o.label });
    btn.addEventListener('click', () => {
      if (set.has(o.value)) set.delete(o.value); else set.add(o.value);
      btn.classList.toggle('is-active');
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

function fontRow(labelText, subText, list, current, onPick, sampleClass) {
  const select = el('select', { class: 'set-select', 'aria-label': labelText });
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
  // fallback is visible rather than mysterious.
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
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: labelText }),
      el('div', { class: 'set-sub', text: subText }),
      note,
    ),
    el('div', { class: 'set-control' }, select, sample),
  );
}

async function render() {
  const s = await loadSettings();
  const frag = document.createDocumentFragment();

  // — Appearance: type, size, and where the live tabs live —
  const type = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h', text: 'Appearance' }),
    fontRow('Interface font', 'Titles, cards, navigation — everything but code.', FONT_UI, s.fontUi,
      (v) => saveSettings({ fontUi: v }).then(() => toast('Interface font updated')), 'sample-ui'),
    fontRow('Monospace font', 'Counts, domains, labels and keyboard hints.', FONT_MONO, s.fontMono,
      (v) => saveSettings({ fontMono: v }).then(() => toast('Monospace font updated')), 'sample-mono'),
    segRow('Interface size', 'Scales the whole interface, text and all.', SCALES, s.scale, 'scale'),
    ...typeSizeRows(s.typeSizes),
    segRow('Open tabs bar', 'Where this window’s live tabs are listed.', TAB_BARS, s.tabsBar, 'tabsBar'),
  );

  // — Backup —
  const includeBm = el('input', { type: 'checkbox', id: 'set-include-bm', class: 'set-check' });
  includeBm.checked = includeBookmarks;
  includeBm.addEventListener('change', () => { includeBookmarks = includeBm.checked; });
  const backup = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h', text: 'Backup & restore' }),
    el('p', { class: 'set-sub', text: 'Export everything — spaces, collections, notes, tags, My Space and the Vault (PIN included), and settings — to a JSON file you can re-import later or on another machine.' }),
    el('label', { class: 'set-toggle' }, includeBm, el('span', {}, 'Also include my Chrome bookmarks')),
    el('div', { class: 'set-actions' },
      el('button', { class: 'btnx primary', onclick: () => exportBackup(includeBookmarks) },
        el('span', { text: 'Export backup' })),
      el('button', { class: 'btnx soft', onclick: () => importFlow() },
        el('span', { text: 'Import backup…' })),
    ),
    el('p', { class: 'set-note', text: 'Import replaces your current spaces, collections, notes, tags, My Space, the Vault and settings. Bookmarks, if present, are added under a new "StackNest Import" folder (nothing is overwritten).' }),
  );

  frag.append(type, await tickerCard(), await vaultCard(), backup, await cloudCard());
  // an external rebuild must not strand keyboard focus: put it back on the same control
  const focused = root.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
  root.replaceChildren(frag);
  if (focused) root.querySelector(`[aria-label="${CSS.escape(focused)}"]`)?.focus();
}

// A labelled row whose control is a segmented button group. `sub` is the row's own
// description; when an option carries its own `sub`, the selected one's is appended so
// the consequence of the choice is readable without picking it first.
// One stepper per text role: − / percentage / +, with a live sample set in that role's
// own token so the change is visible before you leave the row. A single Reset appears
// once anything is off 100%. Saves merge into the whole typeSizes object, so two quick
// clicks on different rows cannot clobber each other (saveSettings reads inside the queue).
function typeSizeRows(sizes) {
  const rows = [];
  const steppers = {};
  // the explanation lives in a row that is always there, with Reset beside it (disabled at
  // 100%) — nothing below shifts when the first step is taken
  const resetBtn = el('button', { class: 'btnx ghosty', onclick: () => setAll(DEFAULT_TYPE_SIZES) }, el('span', { text: 'Reset' }));
  rows.push(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: 'Text sizes' }),
      el('div', { class: 'set-sub', text: 'Tune one kind of text at a time. 100% is the designed size for that role, relative to the interface size above.' }),
    ),
    el('div', { class: 'set-control' }, resetBtn),
  ));
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

  for (const r of TYPE_ROLES) {
    const value = el('span', { class: 'set-step-val' });
    const sample = el('span', { class: `set-sample set-sample-role${r.mono ? ' sample-mono' : ' sample-ui'}`, text: r.sample, style: `font-size: var(${r.token})` });
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
    rows.push(el('div', { class: 'set-row' },
      el('div', { class: 'set-row-text' },
        el('div', { class: 'set-label', text: r.label }),
        el('div', { class: 'set-sub', text: r.sub }),
      ),
      el('div', { class: 'set-control' }, sample,
        el('div', { class: 'set-stepper', role: 'group', 'aria-label': `${r.label} size` }, minus, value, plus)),
    ));
  }
  syncReset();
  onSettingsChange(rows[0], (next) => {
    sizes = { ...sizes, ...(next.typeSizes || {}) };
    for (const r of TYPE_ROLES) steppers[r.id]?.(sizes[r.id] ?? 1);
    syncReset();
  });
  return rows;
}

function segRow(label, sub, list, current, key) {
  const note = el('div', { class: 'set-seghint' });
  const seg = el('div', { class: 'set-seg', role: 'group', 'aria-label': label });
  const showHint = (id) => { note.textContent = list.find((x) => x.id === id)?.sub || ''; };
  for (const opt of list) {
    const btn = el('button', { class: `set-seg-btn${opt.id === current ? ' is-active' : ''}`, text: opt.label });
    btn.addEventListener('click', () => {
      for (const sib of seg.children) sib.classList.toggle('is-active', sib === btn);
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
    for (const btn of seg.children) btn.classList.toggle('is-active', btn.textContent === list.find((x) => x.id === id)?.label);
    showHint(id);
  });
  return row;
}
