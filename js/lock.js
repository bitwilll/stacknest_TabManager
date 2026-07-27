/* ————————————————————————————————————————————————————————————
   The Vault's PIN.

   WHY THE VAULT IS NOT JUST "LOCKED CHROME FOLDERS". Hiding a Chrome bookmark folder
   behind a PIN in this page would be theatre: the same links stay in chrome://bookmarks,
   on the bookmarks bar and in address-bar suggestions, because they live in Chrome's
   bookmark tree and not in ours. So the Vault does not hide Chrome bookmarks — it holds
   bookmarks that have been MOVED OUT of Chrome into StackNest's own storage (see
   js/myspace.js). Once moved, they are genuinely gone from Chrome's surfaces.

   WHAT IS STILL TRUE, and the settings card says so. The Vault's contents sit in
   chrome.storage.local in plain text. This is not encryption: anyone who can open
   devtools on this profile can read them. What the PIN buys is that the Vault does not
   render, is not searched, and cannot be opened from the UI without it — a locked drawer
   in a room you already have the key to, not a safe.

   THE PIN ITSELF is never stored — only a PBKDF2-SHA256 hash over a random per-install
   salt. Same for the security answer.

   ATTEMPTS. Five consecutive wrong PINs lock the Vault. The counter lives in storage, not
   memory, so closing the tab does not clear it. Getting back in then needs one of the two
   proofs of ownership: the security answer, or signing in as the Google account that set
   the PIN. A short numeric PIN has a tiny keyspace, so this cap — not the hash cost — is
   what actually makes guessing infeasible.
   ———————————————————————————————————————————————————————————— */

import { getKey, setKey } from './store.js';
import { el, icon, confirmDialog } from './ui.js';

export const LOCK_KEY = 'stacknest:lock';

// OWASP's 2023 floor for PBKDF2-SHA256.
const ITERATIONS = 310000;
export const MIN_PIN = 4;
export const MAX_PIN = 32;
export const MAX_FAILS = 5;

export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What street did you grow up on?',
  'What was the make of your first car?',
  'What is your oldest cousin’s first name?',
  'What was the name of your first school?',
];

const enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* Unlocking lasts for this page and no longer. Deliberately module state, not storage:
   a new tab is a new page, so every new tab opens locked. */
let sessionUnlocked = false;

export async function loadLock() {
  const s = await getKey(LOCK_KEY, {});
  const o = (s && typeof s === 'object') ? s : {};
  const str = (v) => (typeof v === 'string' ? v : null);
  return {
    salt: str(o.salt), hash: str(o.hash),
    iterations: Number.isFinite(o.iterations) ? o.iterations : ITERATIONS,
    ownerEmail: str(o.ownerEmail),
    question: str(o.question),
    aSalt: str(o.aSalt), aHash: str(o.aHash),
    fails: Number.isFinite(o.fails) ? o.fails : 0,
  };
}

const save = async (patch) => setKey(LOCK_KEY, { ...(await loadLock()), ...patch });

export async function hasPin() {
  const s = await loadLock();
  return !!(s.salt && s.hash);
}

// Locked out after too many wrong tries — needs a recovery proof, not another guess.
export async function isLockedOut() {
  const s = await loadLock();
  return !!(s.salt && s.fails >= MAX_FAILS);
}

export async function attemptsLeft() {
  const s = await loadLock();
  return Math.max(0, MAX_FAILS - s.fails);
}

async function derive(secret, saltBytes, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}

// length-independent compare — an early-exit compare on a secret is a bad habit to leave
// lying around, even where a timing attack is not realistic
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// answers are compared case- and space-insensitively, or nobody would ever get in
const normAnswer = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function validatePin(pin) {
  const s = String(pin ?? '');
  if (s.length < MIN_PIN) return `Use at least ${MIN_PIN} characters.`;
  if (s.length > MAX_PIN) return `Use at most ${MAX_PIN} characters.`;
  return null;
}

export async function setPin(pin, { ownerEmail = null, question = null, answer = null } = {}) {
  const bad = validatePin(pin);
  if (bad) throw new Error(bad);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  const patch = { salt: b64(salt), hash, iterations: ITERATIONS, ownerEmail, fails: 0 };
  if (question && answer) {
    const aSalt = crypto.getRandomValues(new Uint8Array(16));
    patch.question = question;
    patch.aSalt = b64(aSalt);
    patch.aHash = await derive(normAnswer(answer), aSalt, ITERATIONS);
  }
  await save(patch);
  sessionUnlocked = true;   // you just proved you know it
}

/* Verify, counting failures. Returns { ok, lockedOut, left }. A correct PIN resets the
   counter; the count is written before the caller can react, so a reload mid-guess does
   not hand back a fresh five. */
export async function verifyPin(pin) {
  const s = await loadLock();
  if (!s.salt || !s.hash) return { ok: true, lockedOut: false, left: MAX_FAILS };
  if (s.fails >= MAX_FAILS) return { ok: false, lockedOut: true, left: 0 };

  const hash = await derive(String(pin ?? ''), unb64(s.salt), s.iterations);
  if (sameSecret(hash, s.hash)) {
    if (s.fails) await save({ fails: 0 });
    sessionUnlocked = true;
    return { ok: true, lockedOut: false, left: MAX_FAILS };
  }
  const fails = s.fails + 1;
  await save({ fails });
  return { ok: false, lockedOut: fails >= MAX_FAILS, left: Math.max(0, MAX_FAILS - fails) };
}

export async function hasSecurityQuestion() {
  const s = await loadLock();
  return !!(s.question && s.aSalt && s.aHash);
}

export async function getQuestion() {
  return (await loadLock()).question;
}

// A right answer clears the lockout and unlocks for this session, but does NOT reveal or
// change the PIN — the user is sent to set a new one.
export async function verifyAnswer(answer) {
  const s = await loadLock();
  if (!s.aSalt || !s.aHash) return false;
  const hash = await derive(normAnswer(answer), unb64(s.aSalt), s.iterations);
  if (!sameSecret(hash, s.aHash)) return false;
  await save({ fails: 0 });
  sessionUnlocked = true;
  return true;
}

// Clears the lockout after an accepted recovery. Keeps the PIN itself.
export async function clearFailures() {
  await save({ fails: 0 });
  sessionUnlocked = true;
}

export async function clearPin() {
  await setKey(LOCK_KEY, {
    salt: null, hash: null, iterations: ITERATIONS,
    ownerEmail: null, question: null, aSalt: null, aHash: null, fails: 0,
  });
  sessionUnlocked = true;   // nothing left to lock
}

export const isSessionUnlocked = () => sessionUnlocked;
export const relock = () => { sessionUnlocked = false; };

/* ————— prompts ————— */

const pinField = (label) => {
  const input = el('input', {
    type: 'password', class: 'pin-input', inputmode: 'numeric',
    autocomplete: 'off', 'aria-label': label, maxlength: String(MAX_PIN),
  });
  return input;
};

/* Ask for the PIN. Returns true once accepted, false if cancelled or locked out. Re-asks
   in place on a wrong entry — a typo should not cost the whole dialog — and counts down
   the remaining tries out loud, so the lockout is never a surprise. */
export async function promptUnlock({ title = 'Unlock the Vault', message } = {}) {
  if (sessionUnlocked) return true;
  if (!(await hasPin())) return true;
  if (await isLockedOut()) { await lockedOutDialog(); return false; }

  const input = pinField('PIN');
  const err = el('div', { class: 'pin-err', role: 'alert' });
  const extra = el('div', { class: 'pin-field' }, input, err);

  // The note carries across iterations. Recomputing it at the top of the loop would
  // overwrite "Wrong PIN" with a bare count the instant the dialog reopened, so a wrong
  // entry looked identical to a fresh one.
  const left0 = await attemptsLeft();
  let note = left0 < MAX_FAILS ? `${left0} attempt${left0 === 1 ? '' : 's'} left.` : '';

  for (;;) {
    input.value = '';
    err.textContent = note;
    err.classList.toggle('is-warn', !!note);
    setTimeout(() => input.focus(), 60);
    const ok = await confirmDialog({
      title,
      message: message || 'Enter your PIN to open the Vault.',
      extra,
      confirmLabel: 'Unlock',
    });
    if (!ok) return false;
    const r = await verifyPin(input.value);
    if (r.ok) return true;
    if (r.lockedOut) { await lockedOutDialog(); return false; }
    note = `Wrong PIN — ${r.left} attempt${r.left === 1 ? '' : 's'} left.`;
  }
}

async function lockedOutDialog() {
  const q = await hasSecurityQuestion();
  await confirmDialog({
    title: 'Vault locked',
    message: `Too many wrong PINs. The Vault is locked until you recover it${q ? ' with your security question' : ''} or by signing in to the Google account that set the PIN — both are in Settings → Vault.`,
    confirmLabel: 'Close', cancelLabel: 'Close', danger: true,
  });
}

/* Recovery by security question. Deliberately NOT rate-limited the same way: it is only
   reachable once already locked out, and locking the recovery too would leave a user with
   no way back at all. */
export async function promptSecurityAnswer() {
  const s = await loadLock();
  if (!s.question || !s.aHash) return false;
  const input = el('input', { type: 'text', class: 'pin-input wide', autocomplete: 'off', 'aria-label': 'Answer' });
  const err = el('div', { class: 'pin-err', role: 'alert' });
  const extra = el('div', { class: 'pin-field' }, el('div', { class: 'pin-q', text: s.question }), input, err);
  for (;;) {
    err.textContent = '';
    setTimeout(() => input.focus(), 60);
    const ok = await confirmDialog({
      title: 'Answer your security question',
      message: 'Answering correctly unlocks the Vault so you can set a new PIN. Case and spacing don’t matter.',
      extra, confirmLabel: 'Unlock',
    });
    if (!ok) return false;
    if (await verifyAnswer(input.value)) return true;
    err.textContent = 'That doesn’t match.';
    err.classList.add('is-warn');
  }
}

export function lockTile() {
  const wrap = el('span', { class: 'tile tile-locked', style: 'width:40px;height:40px' });
  wrap.append(icon('lock', 18));
  return wrap;
}
