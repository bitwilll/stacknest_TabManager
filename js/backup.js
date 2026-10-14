// Full backup: export/import spaces + collections + settings, optionally bookmarks.

import { toast, exportDownload, pickFile, confirmDialog } from './ui.js';
import { getKey, setKey, queued } from './store.js';
import { SPACES_KEY, WORKSPACES_KEY, ACTIVE_WS_KEY, ensureWorkspaces } from './spacesStore.js';
import { SETTINGS_KEY } from './settings.js';
import { NOTES_KEY, migrateNotes, rearmAlarms } from './notes.js';
import { TAGS_KEY } from './tags.js';
import { FORGET_KEY } from './duplicates.js';
import { SPACE_KEY } from './myspace.js';
import { LOCK_KEY, relock } from './lock.js';

// Every key a backup carries. Anything the app persists must appear here, or a restore on
// a new machine silently loses it — tags, forgotten duplicates and the whole My Space / Vault
// store were missing until version 2.
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function exportBookmarkTree() {
  try {
    const [root] = await chrome.bookmarks.getTree();
    const walk = (n) => {
      const o = { title: n.title || '' };
      if (n.url) o.url = n.url;
      else o.children = (n.children || []).map(walk);
      return o;
    };
    return (root.children || []).map(walk);
  } catch {
    return null;
  }
}

export async function buildBackup(includeBookmarks) {
  const [workspaces, collections, activeWorkspace, settings, notes, tags, dupForgotten, myspace, lock] = await Promise.all([
    getKey(WORKSPACES_KEY, []),
    getKey(SPACES_KEY, []),
    getKey(ACTIVE_WS_KEY, null),
    getKey(SETTINGS_KEY, null),
    getKey(NOTES_KEY, null),
    getKey(TAGS_KEY, null),
    getKey(FORGET_KEY, null),
    getKey(SPACE_KEY, null),
    getKey(LOCK_KEY, null),
  ]);
  const backup = {
    app: 'StackNest',
    type: 'backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    activeWorkspace,
    workspaces,
    collections,
    settings,
    notes,        // { v, items } — the Notes & Todos view
    tags,         // { normalizedUrl: { url, title, tags[] } }
    dupForgotten, // links excluded from the Duplicates scan
    myspace,      // the My Space + Vault store (bookmarks moved out of Chrome), plain text like storage
    lock,         // the Vault's PIN record: salt + PBKDF2 hash (+ security answer hash) — never the PIN itself
  };
  if (includeBookmarks) backup.bookmarks = await exportBookmarkTree();
  return backup;
}

export async function exportBackup(includeBookmarks) {
  const backup = await buildBackup(includeBookmarks);
  const name = `stacknest-backup${includeBookmarks && backup.bookmarks ? '-with-bookmarks' : ''}-${stamp()}.json`;
  exportDownload(name, JSON.stringify(backup, null, 2), 'application/json');
  const cols = Array.isArray(backup.collections) ? backup.collections.length : 0;
  toast(`Exported ${cols} collection${cols === 1 ? '' : 's'}${backup.bookmarks ? ' + bookmarks' : ''} → downloads`);
}

// Recreate a bookmark tree under a fresh, clearly-named folder (never clobbers).
async function importBookmarkTree(nodes) {
  const [root] = await chrome.bookmarks.getTree();
  const bar = (root.children || []).find((c) => c.id === '1') || root.children?.[0];
  const parentId = bar?.id || '1';
  const folder = await chrome.bookmarks.create({ parentId, title: `StackNest Import ${new Date().toLocaleDateString()}` });
  const createInto = async (pid, list) => {
    for (const n of list || []) {
      if (n.url) {
        await chrome.bookmarks.create({ parentId: pid, title: n.title || n.url, url: n.url });
      } else {
        const f = await chrome.bookmarks.create({ parentId: pid, title: n.title || 'Folder' });
        await createInto(f.id, n.children);
      }
    }
  };
  await createInto(folder.id, nodes);
}

export async function applyBackup(data) {
  await queued(async () => {
    if (Array.isArray(data.workspaces) && data.workspaces.length) await setKey(WORKSPACES_KEY, data.workspaces);
    if (Array.isArray(data.collections)) await setKey(SPACES_KEY, data.collections);
    if (data.settings && typeof data.settings === 'object') await setKey(SETTINGS_KEY, data.settings);
    if (data.activeWorkspace) await setKey(ACTIVE_WS_KEY, data.activeWorkspace);
    // migrate on the way IN, so an old backup can't park a legacy shape in storage — and
    // so a restore of a pre-checklist backup still lands as reminders rather than as
    // malformed lists. Writing raw here was how stale shapes used to survive a round-trip.
    if (isObj(data.notes)) await setKey(NOTES_KEY, migrateNotes(data.notes));
    // version 2 keys — absent from older files, in which case the current values stay
    if (isObj(data.tags)) await setKey(TAGS_KEY, data.tags);
    if (isObj(data.dupForgotten)) await setKey(FORGET_KEY, data.dupForgotten);
    if (isObj(data.myspace)) await setKey(SPACE_KEY, data.myspace);
    if (isObj(data.lock)) { await setKey(LOCK_KEY, data.lock); relock(); }   // a restored PIN starts locked
  });
  // a restore brings reminders that have no chrome.alarms entry behind them
  await rearmAlarms().catch(() => {});
  // repair a missing/invalid active-space pointer and reattach any orphaned collections,
  // so an older / hand-edited / partial backup can never leave the board stranded-empty
  await ensureWorkspaces();
  if (Array.isArray(data.bookmarks) && data.bookmarks.length) {
    try { await importBookmarkTree(data.bookmarks); }
    catch { toast('Restored data; bookmarks could not be imported'); }
  }
  // let the app re-apply settings + re-render everything from the new storage
  document.dispatchEvent(new CustomEvent('stacknest:imported'));
}

export async function importFlow() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { toast('That file is not valid JSON'); return; }
  if (!data || data.app !== 'StackNest' || data.type !== 'backup') { toast('Not a StackNest backup file'); return; }

  const cols = Array.isArray(data.collections) ? data.collections.length : 0;
  const spaces = Array.isArray(data.workspaces) ? data.workspaces.length : 0;
  const hasBm = Array.isArray(data.bookmarks) && data.bookmarks.length;
  // say what else the file carries, so a restore never surprises
  const extras = [];
  const noteCount = Array.isArray(data.notes?.items) ? data.notes.items.length : 0;
  if (noteCount) extras.push(`${noteCount} note${noteCount === 1 ? '' : 's'}`);
  if (isObj(data.tags) && Object.keys(data.tags).length) extras.push('tags');
  if (isObj(data.myspace)) extras.push('My Space and the Vault');
  if (isObj(data.lock) && data.lock.hash) extras.push('the Vault PIN');
  const ok = await confirmDialog({
    title: 'Restore this backup?',
    message: `This replaces your current spaces and collections with ${spaces} space${spaces === 1 ? '' : 's'} and ${cols} collection${cols === 1 ? '' : 's'} from the file`
      + (extras.length ? `, plus ${extras.join(', ')}` : '')
      + (data.settings ? ', and applies its saved settings' : '')
      + (hasBm ? '. Bookmarks are added under a new "StackNest Import" folder' : '') + '.',
    confirmLabel: 'Restore',
    danger: true,
  });
  if (!ok) return;
  await applyBackup(data);
  toast('Backup restored');
}
