// Data layer for Spaces (environments) + Collections (the kanban of saved tabs).
//
// Naming note: internally a "space" object is one COLLECTION (a titled column of
// saved tabs, shown under "COLLECTIONS"); a "workspace" is a SPACE / environment
// (shown under "SPACES") that owns a set of collections. Every collection carries a
// `workspaceId`; the board renders only the active workspace's collections.
//
// All mutations go through the serialized queue in store.js (no lost writes).

import { getKey, setKey, update, queued } from './store.js';
import { normalizeUrl } from './ui.js';

export const SPACES_KEY = 'stacknest:spaces';            // collections
export const WORKSPACES_KEY = 'stacknest:workspaces';    // spaces / environments
export const ACTIVE_WS_KEY = 'stacknest:activeWorkspace';

// Identity-dot palette — muted, dusty tones so the user's own colour reads as
// intentional against the monochrome "Nothing" chrome (still distinguishable).
export const DOT_COLORS = ['#6b73a8', '#5583a0', '#b28a54', '#a86b7e', '#57897f', '#86749f', '#6e8f60'];
// space/environment palette (same family, reordered so Personal ≠ first collection)
export const WS_COLORS = ['#6b73a8', '#6e8f60', '#b28a54', '#5583a0', '#a86b7e', '#57897f', '#86749f'];

function makeId() {
  try { return crypto.randomUUID(); }
  catch { return 's' + Math.abs(Date.now() ^ Math.floor(performance.now() * 1000)).toString(36); }
}

/* ————————————————————————— spaces (environments) ————————————————————————— */

export function makeWorkspace(name = '', color = null) {
  return { id: makeId(), name, color: color || WS_COLORS[0] };
}

export async function loadWorkspaces() {
  const ws = await getKey(WORKSPACES_KEY, []);
  return Array.isArray(ws) ? ws : [];
}

export function getActiveWorkspaceId() {
  return getKey(ACTIVE_WS_KEY, null);
}

export async function setActiveWorkspace(id) {
  await update(ACTIVE_WS_KEY, null, () => id); // through the queue so it can't be clobbered
}

// First-run / migration: guarantee ≥1 workspace, every collection has a workspaceId,
// and the active id is valid. Runs inside the queue so it can't race the app's first render.
export async function ensureWorkspaces() {
  return queued(async () => {
    let ws = await getKey(WORKSPACES_KEY, []);
    if (!Array.isArray(ws) || !ws.length) ws = [makeWorkspace('Personal', WS_COLORS[0])];

    let spaces = await getKey(SPACES_KEY, []);
    if (!Array.isArray(spaces)) spaces = [];

    const defId = ws[0].id;
    const ids = new Set(ws.map((w) => w.id));
    let changed = false;
    // reattach collections with a missing OR orphaned (unknown) workspaceId
    for (const s of spaces) if (!s.workspaceId || !ids.has(s.workspaceId)) { s.workspaceId = defId; changed = true; }

    let active = await getKey(ACTIVE_WS_KEY, null);
    if (!active || !ws.some((w) => w.id === active)) active = ws[0].id;

    await setKey(WORKSPACES_KEY, ws);
    if (changed) await setKey(SPACES_KEY, spaces);
    await setKey(ACTIVE_WS_KEY, active);
    return { workspaces: ws, activeId: active };
  });
}

export async function addWorkspace(name) {
  let created;
  await update(WORKSPACES_KEY, [], (ws) => {
    created = makeWorkspace(name, WS_COLORS[ws.length % WS_COLORS.length]);
    ws.push(created);
    return ws;
  });
  return created;
}

export async function renameWorkspace(id, name) {
  await update(WORKSPACES_KEY, [], (ws) => {
    const w = ws.find((x) => x.id === id);
    if (w) w.name = name;
    return ws;
  });
}

export async function setWorkspaceColor(id, color) {
  await update(WORKSPACES_KEY, [], (ws) => {
    const w = ws.find((x) => x.id === id);
    if (w) w.color = color;
    return ws;
  });
}

// Reorder spaces/environments: move `fromId` before `beforeId` (null = to the end).
export async function reorderWorkspace(fromId, beforeId) {
  await update(WORKSPACES_KEY, [], (ws) => {
    const fromIdx = ws.findIndex((w) => w.id === fromId);
    if (fromIdx < 0) return ws;
    const [w] = ws.splice(fromIdx, 1);
    let toIdx = beforeId == null ? ws.length : ws.findIndex((x) => x.id === beforeId);
    if (toIdx < 0) toIdx = ws.length;
    ws.splice(toIdx, 0, w);
    return ws;
  });
}

// Delete a workspace AND its collections; keep ≥1 workspace and a valid active id.
export async function deleteWorkspace(id) {
  return queued(async () => {
    let ws = (await getKey(WORKSPACES_KEY, [])).filter((w) => w.id !== id);
    if (!ws.length) ws = [makeWorkspace('Personal', WS_COLORS[0])];
    const spaces = (await getKey(SPACES_KEY, [])).filter((s) => s.workspaceId !== id);
    let active = await getKey(ACTIVE_WS_KEY, null);
    if (active === id || !ws.some((w) => w.id === active)) active = ws[0].id;
    await setKey(WORKSPACES_KEY, ws);
    await setKey(SPACES_KEY, spaces);
    await setKey(ACTIVE_WS_KEY, active);
  });
}

/* ————————————————————————— collections ————————————————————————— */

export async function loadSpaces() {
  const s = await getKey(SPACES_KEY, []);
  return Array.isArray(s) ? s : [];
}

// Collections belonging to the active workspace, in stored order.
export async function loadActiveSpaces() {
  const [spaces, active] = await Promise.all([loadSpaces(), getActiveWorkspaceId()]);
  return spaces.filter((s) => s.workspaceId === active);
}

export function makeSpace(title = '', tabs = [], color = null, workspaceId = null) {
  const now = Date.now();
  return { id: makeId(), title, color, workspaceId, collapsed: false, createdAt: now, updatedAt: now, tabs };
}

// Prepend a new collection into the active workspace. Returns it.
export async function addSpace(title, tabs, color = null) {
  let created;
  await update(SPACES_KEY, [], async (spaces) => {
    const active = await getActiveWorkspaceId();
    const count = spaces.filter((s) => s.workspaceId === active).length;
    created = makeSpace(title, tabs, color ?? DOT_COLORS[count % DOT_COLORS.length], active);
    spaces.unshift(created);
    return spaces;
  });
  return created;
}

export async function mutateSpace(id, fn) {
  await update(SPACES_KEY, [], (spaces) => {
    const sp = spaces.find((s) => s.id === id);
    if (!sp) return spaces;
    fn(sp);
    sp.updatedAt = Date.now();
    return spaces;
  });
}

// Set a UI/meta prop (e.g. `collapsed`) without bumping updatedAt.
export async function setSpaceProp(id, key, value) {
  await update(SPACES_KEY, [], (spaces) => {
    const sp = spaces.find((s) => s.id === id);
    if (sp) sp[key] = value;
    return spaces;
  });
}

export async function deleteSpace(id) {
  await update(SPACES_KEY, [], (spaces) => spaces.filter((s) => s.id !== id));
}

// Reorder collections: move `fromId` before `beforeId` (null = to the end).
export async function reorderSpace(fromId, beforeId) {
  await update(SPACES_KEY, [], (spaces) => {
    const fromIdx = spaces.findIndex((s) => s.id === fromId);
    if (fromIdx < 0) return spaces;
    const [sp] = spaces.splice(fromIdx, 1);
    let toIdx = beforeId == null ? spaces.length : spaces.findIndex((s) => s.id === beforeId);
    if (toIdx < 0) toIdx = spaces.length;
    spaces.splice(toIdx, 0, sp);
    return spaces;
  });
}

// ——— undo helpers (re-create a deleted collection / space / link) ———

// Re-insert a previously-deleted collection at (about) its old position.
export async function insertSpaceAt(collection, index) {
  await update(SPACES_KEY, [], (spaces) => {
    if (spaces.some((s) => s.id === collection.id)) return spaces;
    const i = Math.max(0, Math.min(index ?? spaces.length, spaces.length));
    spaces.splice(i, 0, collection);
    return spaces;
  });
}

// Re-insert a saved tab into a collection at (about) its old position.
export async function insertTabAt(collectionId, tab, index) {
  await update(SPACES_KEY, [], (spaces) => {
    const s = spaces.find((x) => x.id === collectionId);
    if (!s) return spaces;
    const i = Math.max(0, Math.min(index ?? s.tabs.length, s.tabs.length));
    s.tabs.splice(i, 0, tab);
    s.updatedAt = Date.now();
    return spaces;
  });
}

// Re-create a deleted space with its collections, and (optionally) re-activate it.
export async function restoreWorkspace(ws, index, collections, activeId) {
  return queued(async () => {
    const list = await getKey(WORKSPACES_KEY, []);
    if (!list.some((w) => w.id === ws.id)) {
      const i = Math.max(0, Math.min(index ?? list.length, list.length));
      list.splice(i, 0, ws);
      await setKey(WORKSPACES_KEY, list);
    }
    if (collections && collections.length) {
      const spaces = await getKey(SPACES_KEY, []);
      const have = new Set(spaces.map((s) => s.id));
      for (const c of collections) if (!have.has(c.id)) spaces.push(c);
      await setKey(SPACES_KEY, spaces);
    }
    if (activeId) await setKey(ACTIVE_WS_KEY, activeId);
  });
}

// Move a whole collection into another workspace (drag it onto a SPACES row).
export async function moveSpaceToWorkspace(spaceId, workspaceId) {
  await update(SPACES_KEY, [], (spaces) => {
    const sp = spaces.find((s) => s.id === spaceId);
    if (sp && sp.workspaceId !== workspaceId) sp.workspaceId = workspaceId;
    return spaces;
  });
}

// Move a saved tab between collections, or reorder within one. `hintIndex` is the
// drag-time position; `linkKey` (normalizeUrl of the dragged url) lets us re-resolve
// the real source index inside the queued critical section, so a mutation that
// happened while a confirm dialog was open can't make us move the wrong tab.
// toIndex = null appends to the end of the destination.
export async function moveSpaceTab(fromId, hintIndex, toId, toIndex = null, linkKey = null) {
  await update(SPACES_KEY, [], (spaces) => {
    const from = spaces.find((s) => s.id === fromId);
    const to = spaces.find((s) => s.id === toId);
    if (!from || !to) return spaces;

    let fromIndex = hintIndex;
    if (linkKey != null && !(from.tabs[hintIndex] && normalizeUrl(from.tabs[hintIndex].url) === linkKey)) {
      const found = from.tabs.findIndex((t) => normalizeUrl(t.url) === linkKey);
      if (found >= 0) fromIndex = found;
    }

    const [tab] = from.tabs.splice(fromIndex, 1);
    if (!tab) return spaces;

    let idx = toIndex == null ? to.tabs.length : toIndex;
    if (from === to && toIndex != null && fromIndex < idx) idx -= 1; // only for explicit insert-before
    idx = Math.max(0, Math.min(idx, to.tabs.length));
    to.tabs.splice(idx, 0, tab);

    const now = Date.now();
    from.updatedAt = now;
    to.updatedAt = now;
    return spaces;
  });
}
