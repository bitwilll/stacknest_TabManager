// Google Drive cloud backup/restore.
//
// Live (inside the packaged extension): signs in with chrome.identity (Google OAuth)
// and stores a single backup file in the app's private Drive appDataFolder — invisible
// in the user's Drive UI, and scoped so StackNest can only touch its own file.
//
// Making it FUNCTIONAL requires three things the code alone can't provide (see README
// "Cloud sync setup"): the "identity" permission (present), a real "oauth2.client_id"
// in the manifest (currently a placeholder), and a stable extension ID so the OAuth
// client matches — a "key" in the manifest for unpacked dev, or a Web-Store listing.
// isConfigured() detects the placeholder so the UI can say "not set up" instead of
// throwing a cryptic Chrome OAuth error.
//
// Preview (served outside Chrome, mock mode): there is no chrome.identity or network
// auth, so the same public API is backed by an in-memory "cloud" kept in storage, letting
// the whole UX be exercised. Nothing here talks to a StackNest server — the paid
// StackNest Cloud tier needs a hosted backend and is surfaced as "coming soon".

import { getKey, setKey } from './store.js';
import { buildBackup, applyBackup } from './backup.js';

export const CLOUD_KEY = 'stacknest:cloud'; // { connected, email, lastBackupAt, lastRestoreAt }
const DEV_FILE_KEY = 'stacknest:cloud:devfile'; // preview-only simulated Drive file
const FILE_NAME = 'stacknest-backup.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.email'];
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// running inside a real extension (has chrome.identity + a runtime id)
export const isLive = () => !!(globalThis.chrome?.identity?.getAuthToken && chrome.runtime?.id);

// the OAuth client is actually filled in (not the shipped placeholder). Live sync
// can only work when this is true; the UI uses it to show a clear setup prompt.
export const isConfigured = () => {
  try {
    const id = chrome.runtime.getManifest?.()?.oauth2?.client_id || '';
    return /\.apps\.googleusercontent\.com$/.test(id) && !/^REPLACE_WITH/i.test(id);
  } catch { return false; }
};

const NOT_CONFIGURED = () => new Error("Google Drive sync isn't set up in this build yet — add your OAuth client ID to the manifest (see README → Cloud sync setup).");

export async function loadCloudState() {
  const s = await getKey(CLOUD_KEY, {});
  return (s && typeof s === 'object') ? s : {};
}
async function patchState(patch) {
  const next = { ...(await loadCloudState()), ...patch };
  await setKey(CLOUD_KEY, next);
  return next;
}

/* ————————————————————————— OAuth (live) ————————————————————————— */

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: SCOPES }, (token) => {
      const err = chrome.runtime.lastError;
      if (err || !token) { if (err) console.error('getAuthToken:', err.message); reject(authError(err?.message, interactive)); }
      else resolve(token);
    });
  });
}
// turn Chrome's raw OAuth lastError into a message a person can act on
function authError(raw, interactive) {
  const m = (raw || '').toLowerCase();
  if (m.includes('did not approve') || m.includes('cancel')) return new Error('Google sign-in was cancelled.');
  if (m.includes('invalid_client') || m.includes('bad client') || m.includes('not granted') || m.includes('revoked')) {
    return new Error("Couldn't sign in to Google Drive. This build's Drive sync may not be fully set up — see README → Cloud sync setup.");
  }
  if (!interactive) return new Error('Your Google Drive session expired — reconnect in Settings.');
  return new Error('Google sign-in failed. Please try again.');
}
function dropToken(token) {
  return new Promise((resolve) => { try { chrome.identity.removeCachedAuthToken({ token }, resolve); } catch { resolve(); } });
}

class DriveError extends Error {
  constructor(message, status) { super(message); this.name = 'DriveError'; this.status = status; }
}
function driveMessage(status) {
  if (status === 401 || status === 403) return 'Your Google Drive access expired — reconnect your account in Settings.';
  if (status === 404) return 'No cloud backup found yet.';
  if (status >= 500) return 'Google Drive is temporarily unavailable. Try again in a moment.';
  return `Google Drive request failed (${status}).`;
}

async function api(path, { token, method = 'GET', headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(`https://www.googleapis.com/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  } catch {
    throw new DriveError("Couldn't reach Google Drive. Check your connection.", 0);
  }
  if (!res.ok) {
    console.error(`Drive ${method} ${path} → ${res.status}`);
    throw new DriveError(driveMessage(res.status), res.status);
  }
  return res;
}

// Run a Drive operation with the documented chrome.identity stale-token recovery:
// try the cached token; on 401/403 evict it and retry with a fresh one; if the silent
// re-mint fails (grant revoked) escalate to an interactive sign-in so the user can
// re-consent. Without this a single stale cached token bricks every backup/restore.
async function withDrive(fn) {
  let token;
  try { token = await getToken(false); }
  catch { token = await getToken(true); }        // no cached token → prompt
  try {
    return await fn(token);
  } catch (e) {
    if (!(e instanceof DriveError) || (e.status !== 401 && e.status !== 403)) throw e;
    await dropToken(token);                        // stale token — evict and re-mint
    let fresh;
    try { fresh = await getToken(false); }
    catch { fresh = await getToken(true); }        // grant revoked → re-consent
    return await fn(fresh);
  }
}

async function fetchEmail(token) {
  try { const r = await api('oauth2/v3/userinfo', { token }); return (await r.json()).email || null; }
  catch { return null; }                           // don't fabricate a fake address; label falls back to "Google Drive"
}

async function findFileId(token) {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const r = await api(`drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`, { token });
  return (await r.json()).files?.[0]?.id || null;
}

async function uploadLive(token, json) {
  const id = await findFileId(token);
  if (id) {
    await api(`upload/drive/v3/files/${id}?uploadType=media`, { token, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json });
  } else {
    const boundary = 'stacknest' + FILE_NAME.length;
    const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    await api('upload/drive/v3/files?uploadType=multipart', { token, method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
  }
}

async function downloadLive(token) {
  const id = await findFileId(token);
  if (!id) return null;
  const r = await api(`drive/v3/files/${id}?alt=media`, { token });
  try { return await r.json(); }
  catch { throw new Error('The cloud backup file looks corrupted.'); }
}

/* ————————————————————————— public API ————————————————————————— */

// connected shows the account label; email may be null if userinfo was unavailable
export function getAccount(state) { return state?.email || (state?.connected ? 'Google Drive' : null); }

export async function connect() {
  if (isLive()) {
    if (!isConfigured()) throw NOT_CONFIGURED();
    const token = await getToken(true);            // first sign-in: interactive consent
    const email = await fetchEmail(token);
    return patchState({ connected: true, email });
  }
  // preview: simulate a connected account
  return patchState({ connected: true, email: 'you@gmail.com (preview)' });
}

export async function disconnect() {
  if (isLive()) {
    try {
      const t = await getToken(false);
      // actually revoke the grant so "Disconnect" severs access, not just hides the label
      try { await fetch(`${REVOKE_URL}?token=${encodeURIComponent(t)}`, { method: 'POST' }); } catch { /* best effort */ }
      await dropToken(t);
    } catch { /* nothing cached to revoke */ }
  }
  return patchState({ connected: false, email: null });
}

export async function backupNow(includeBookmarks) {
  const backup = await buildBackup(includeBookmarks);
  const json = JSON.stringify(backup);
  if (isLive()) {
    if (!isConfigured()) throw NOT_CONFIGURED();
    await withDrive((token) => uploadLive(token, json));
  } else {
    await setKey(DEV_FILE_KEY, json);
  }
  const cols = Array.isArray(backup.collections) ? backup.collections.length : 0;
  await patchState({ lastBackupAt: new Date().toISOString() });
  return { collections: cols, bookmarks: !!backup.bookmarks };
}

export async function restoreLatest() {
  let data;
  if (isLive()) {
    if (!isConfigured()) throw NOT_CONFIGURED();
    data = await withDrive((token) => downloadLive(token));
  } else {
    const json = await getKey(DEV_FILE_KEY, null); data = json ? JSON.parse(json) : null;
  }
  if (!data) throw new Error('No cloud backup found yet');
  if (data.app !== 'StackNest' || data.type !== 'backup') throw new Error('Cloud file is not a StackNest backup');
  await applyBackup(data);
  await patchState({ lastRestoreAt: new Date().toISOString() });
  return { collections: Array.isArray(data.collections) ? data.collections.length : 0 };
}

export const cloud = { CLOUD_KEY, isLive, isConfigured, loadCloudState, getAccount, connect, disconnect, backupNow, restoreLatest };
