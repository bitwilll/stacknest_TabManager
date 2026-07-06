// Google Drive cloud backup/restore.
//
// Live (inside the packaged extension): signs in with chrome.identity (Google OAuth)
// and stores a single backup file in the app's private Drive appDataFolder — invisible
// in the user's Drive UI, and scoped so StackNest can only touch its own file. Requires
// the "identity" permission, an "oauth2" client_id in the manifest, and a keyed/published
// extension so the OAuth client is registered.
//
// Preview (served outside Chrome, mock mode): there is no chrome.identity or network
// auth, so the same public API is backed by an in-memory "cloud" kept in storage, letting
// the whole UX be exercised. Nothing here talks to a StackNest server — the paid
// StackNest Cloud tier needs a hosted backend and is surfaced as "coming soon".

import { getKey, setKey } from './store.js';
import { buildBackup, applyBackup } from './backup.js';

export const CLOUD_KEY = 'stacknest:cloud'; // { email, lastBackupAt, lastRestoreAt }
const DEV_FILE_KEY = 'stacknest:cloud:devfile'; // preview-only simulated Drive file
const FILE_NAME = 'stacknest-backup.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.email'];

export const isLive = () => !!(globalThis.chrome?.identity?.getAuthToken && chrome.runtime?.id);

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
      if (err || !token) reject(new Error(err?.message || 'Google sign-in was cancelled'));
      else resolve(token);
    });
  });
}
function dropToken(token) {
  return new Promise((resolve) => { try { chrome.identity.removeCachedAuthToken({ token }, resolve); } catch { resolve(); } });
}

async function api(path, { token, method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`https://www.googleapis.com/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  if (!res.ok) throw new Error(`Drive ${method} ${path} → ${res.status}`);
  return res;
}

async function fetchEmail(token) {
  try { const r = await api('oauth2/v3/userinfo', { token }); return (await r.json()).email || 'Google account'; }
  catch { return 'Google account'; }
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
  return r.json();
}

/* ————————————————————————— public API ————————————————————————— */

export function getAccount(state) { return state?.email || null; }

export async function connect() {
  if (isLive()) {
    const token = await getToken(true);
    const email = await fetchEmail(token);
    return patchState({ email });
  }
  // preview: simulate a connected account
  return patchState({ email: 'you@gmail.com (preview)' });
}

export async function disconnect() {
  if (isLive()) { try { const t = await getToken(false); await dropToken(t); } catch { /* already gone */ } }
  return patchState({ email: null });
}

export async function backupNow(includeBookmarks) {
  const backup = await buildBackup(includeBookmarks);
  const json = JSON.stringify(backup);
  if (isLive()) { const token = await getToken(false); await uploadLive(token, json); }
  else { await setKey(DEV_FILE_KEY, json); }
  const cols = Array.isArray(backup.collections) ? backup.collections.length : 0;
  await patchState({ lastBackupAt: new Date().toISOString() });
  return { collections: cols, bookmarks: !!backup.bookmarks };
}

export async function restoreLatest() {
  let data;
  if (isLive()) { const token = await getToken(false); data = await downloadLive(token); }
  else { const json = await getKey(DEV_FILE_KEY, null); data = json ? JSON.parse(json) : null; }
  if (!data) throw new Error('No cloud backup found yet');
  if (data.app !== 'StackNest' || data.type !== 'backup') throw new Error('Cloud file is not a StackNest backup');
  await applyBackup(data);
  await patchState({ lastRestoreAt: new Date().toISOString() });
  return { collections: Array.isArray(data.collections) ? data.collections.length : 0 };
}

export const cloud = { CLOUD_KEY, isLive, loadCloudState, getAccount, connect, disconnect, backupNow, restoreLatest };
