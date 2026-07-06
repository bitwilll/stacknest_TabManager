// Collections board (kanban columns of saved tabs), the sidebar COLLECTIONS list,
// and the sidebar SPACES (environments) list. A collection lives in one space; the
// board shows only the active space's collections.

import {
  el, icon, actionBtn, toast, tile, domainOf, shortDate, matches,
  addDropTarget, normalizeUrl, confirmDialog, exportDownload,
} from './ui.js';
import {
  SPACES_KEY, WORKSPACES_KEY, ACTIVE_WS_KEY, DOT_COLORS, WS_COLORS,
  loadSpaces, loadActiveSpaces, loadWorkspaces, getActiveWorkspaceId, setActiveWorkspace,
  addWorkspace, renameWorkspace, deleteWorkspace, moveSpaceToWorkspace, reorderWorkspace,
  mutateSpace, deleteSpace, addSpace, moveSpaceTab, reorderSpace, setSpaceProp,
  insertSpaceAt, insertTabAt, restoreWorkspace,
} from './spacesStore.js';
import { pushHistory, flashDeleted } from './history.js';
import { TAGS_KEY, loadTags, tagChips, openTagEditor } from './tags.js';

const TAB_MIME = 'text/x-stacknest-tab';
const SPACETAB_MIME = 'text/x-stacknest-spacetab';
const SPACE_MIME = 'text/x-stacknest-space';
const WS_MIME = 'text/x-stacknest-workspace';
const OPEN_ALL_CONFIRM = 10;

let boardRoot, navRoot, wsRoot, navCount, statsEl, getQuery, ensureBoardVisible, clearSearch;

export function initSpaces(options) {
  ({ boardRoot, navRoot, wsRoot, navCount, statsEl, getQuery, ensureBoardVisible, clearSearch } = options);

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && (changes[SPACES_KEY] || changes[WORKSPACES_KEY] || changes[ACTIVE_WS_KEY] || changes[TAGS_KEY])) render();
  });

  render();
  return { render, createEmpty, exportAll, newWorkspace };
}

async function createEmpty() {
  await addSpace('', []);
  setTimeout(() => boardRoot.querySelector('.colcard .col-name')?.focus(), 80);
}

async function newWorkspace() {
  const ws = await addWorkspace('');
  await setActiveWorkspace(ws.id);
  setTimeout(() => wsRoot.querySelector('.ws-row.is-active .nav-label')?.focus?.(), 80);
}

function colorOf(space, index) {
  return space.color || DOT_COLORS[index % DOT_COLORS.length];
}

/* ————————————————————————— deletes (with undo) ————————————————————————— */

async function removeCollection(space) {
  const spaces = await loadSpaces();
  const index = spaces.findIndex((s) => s.id === space.id);
  const copy = JSON.parse(JSON.stringify(spaces[index] || space));
  await deleteSpace(space.id);
  pushHistory({
    label: `“${copy.title || 'untitled'}”`,
    undo: () => insertSpaceAt(copy, index),
    redo: () => deleteSpace(copy.id),
  });
  flashDeleted(`Deleted “${copy.title || 'collection'}”`);
}

async function removeWorkspace(w) {
  const [wsList, spaces] = await Promise.all([loadWorkspaces(), loadSpaces()]);
  const index = wsList.findIndex((x) => x.id === w.id);
  const wsCopy = JSON.parse(JSON.stringify(w));
  const cols = spaces.filter((s) => s.workspaceId === w.id).map((s) => JSON.parse(JSON.stringify(s)));
  await deleteWorkspace(w.id);
  pushHistory({
    label: `space “${wsCopy.name || 'space'}”`,
    undo: () => restoreWorkspace(wsCopy, index, cols, wsCopy.id),
    redo: () => deleteWorkspace(wsCopy.id),
  });
  flashDeleted(`Deleted space “${wsCopy.name || 'space'}”`);
}

async function removeTab(space, tab, index) {
  const copy = { title: tab.title, url: tab.url };
  const name = tab.title || domainOf(tab.url) || 'link';
  await mutateSpace(space.id, (s) => { s.tabs.splice(index, 1); });
  pushHistory({
    label: `“${name}”`,
    undo: () => insertTabAt(space.id, copy, index),
    redo: () => mutateSpace(space.id, (s) => { const i = s.tabs.findIndex((t) => t.url === copy.url); if (i >= 0) s.tabs.splice(i, 1); }),
  });
  flashDeleted(`Removed “${name}”`);
}

/* ————————————————————————— add / move with dedupe ————————————————————————— */

async function addLinkChecked(spaceId, link) {
  if (!link?.url) return false;
  const fresh = (await loadSpaces()).find((s) => s.id === spaceId);
  if (!fresh) return false;
  const norm = normalizeUrl(link.url);
  if (fresh.tabs.some((t) => normalizeUrl(t.url) === norm)) {
    const ok = await confirmDialog({
      title: 'Link already exists',
      message: `“${link.title || link.url}” is already in “${fresh.title || 'this collection'}”. Add it again?`,
      confirmLabel: 'Add anyway',
    });
    if (!ok) { toast('Not added — already in this collection'); return false; }
  }
  await mutateSpace(spaceId, (s) => { s.tabs.push({ title: link.title || link.url, url: link.url }); });
  return true;
}

async function moveLinkChecked(fromId, fromIndex, toId, toIndex = null) {
  const spaces = await loadSpaces();
  const from = spaces.find((s) => s.id === fromId);
  const link = from?.tabs?.[fromIndex];
  if (!from || !link) return;
  const linkKey = normalizeUrl(link.url);
  if (fromId !== toId) {
    const to = spaces.find((s) => s.id === toId);
    if (to && to.tabs.some((t) => normalizeUrl(t.url) === linkKey)) {
      const ok = await confirmDialog({
        title: 'Link already exists',
        message: `“${link.title || link.url}” is already in “${to.title || 'that collection'}”. Move it anyway?`,
        confirmLabel: 'Move anyway',
      });
      if (!ok) { toast('Not moved — already there'); return; }
    }
  }
  // pass linkKey so the store re-resolves the real source index atomically
  await moveSpaceTab(fromId, fromIndex, toId, toIndex, linkKey);
}

/* ————————————————————————— export ————————————————————————— */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const datestamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; };

function buildBookmarksHtml(cols) {
  const out = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Bookmarks</TITLE>', '<H1>StackNest Collections</H1>', '<DL><p>'];
  for (const c of cols) {
    out.push(`  <DT><H3>${esc(c.title || 'Untitled collection')}</H3>`, '  <DL><p>');
    for (const t of c.tabs) out.push(`    <DT><A HREF="${esc(t.url)}">${esc(t.title || t.url)}</A>`);
    out.push('  </DL><p>');
  }
  out.push('</DL><p>');
  return out.join('\n');
}
function exportCollections(list) {
  const cols = (list || []).filter((c) => c.tabs.length);
  if (!cols.length) { toast('Nothing to export yet'); return; }
  const base = cols.length === 1 ? (slug(cols[0].title) || 'collection') : 'stash-collections';
  exportDownload(`${base}-${datestamp()}.html`, buildBookmarksHtml(cols), 'text/html');
  const n = cols.reduce((a, c) => a + c.tabs.length, 0);
  toast(`Exported ${n} link${n === 1 ? '' : 's'} → downloads`);
}
async function exportAll() {
  exportCollections(await loadActiveSpaces());
}

/* ————————————————————————— render ————————————————————————— */

export async function render() {
  const q = getQuery();
  const [workspaces, activeId, spaces, tagsMap] = await Promise.all([loadWorkspaces(), getActiveWorkspaceId(), loadActiveSpaces(), loadTags()]);
  const totalTabs = spaces.reduce((n, s) => n + s.tabs.length, 0);

  navCount.textContent = spaces.length ? String(spaces.length) : '';
  const wsName = workspaces.find((w) => w.id === activeId)?.name || 'Space';
  statsEl.textContent = `${wsName} · ${spaces.length} collection${spaces.length === 1 ? '' : 's'} · ${totalTabs} tab${totalTabs === 1 ? '' : 's'}`;

  renderWorkspaces(workspaces, activeId);
  renderBoard(spaces, q, tagsMap);
  renderCollectionsNav(spaces, q);
}

/* — SPACES (environments) sidebar — */

function renderWorkspaces(workspaces, activeId) {
  const frag = document.createDocumentFragment();
  workspaces.forEach((w, i) => {
    const label = el('span', { class: 'nav-label', text: w.name || 'untitled' });
    const row = el('div', {
      class: `navx ws-row${w.id === activeId ? ' is-active' : ''}`,
      role: 'button', tabindex: '0', draggable: 'true', title: w.name || 'untitled', dataset: { id: w.id },
    },
      el('span', { class: 'nav-dot', style: `background: ${w.color || WS_COLORS[0]}` }),
      label,
      el('span', { class: 'nav-n', text: '' }),
      el('span', { class: 'nav-acts' },
        actionBtn('rename', 'Rename space', () => startWsRename(row, label, w)),
        wsDeleteBtn(w, workspaces.length),
      ),
    );
    const activate = () => { if (w.id !== activeId) setActiveWorkspace(w.id); ensureBoardVisible(); };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) activate(); });
    // drag the whole row to reorder spaces (guarded against the action buttons / rename input)
    row.addEventListener('dragstart', (e) => {
      if (e.target.closest('.nav-acts') || e.target.closest('input')) { e.preventDefault(); return; }
      e.dataTransfer.setData(WS_MIME, JSON.stringify({ id: w.id }));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging', 'drop-before', 'drop-after'));
    wsReorderDrop(row, w, workspaces, i);
    // drop a collection onto a space to move it there
    addDropTarget(row, SPACE_MIME, async ({ id }) => { await moveSpaceToWorkspace(id, w.id); toast(`Moved to “${w.name || 'space'}”`); });
    frag.append(row);
  });
  wsRoot.replaceChildren(frag);
}

// Reorder-by-drag for one SPACES row: top half → drop before this row, bottom half →
// drop after it (before the next row, or to the end past the last row). Uses its own
// WS_MIME payload so it never collides with the collection→space move (SPACE_MIME).
function wsReorderDrop(row, w, workspaces, index) {
  const isAfter = (e) => {
    const r = row.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  };
  const clear = () => row.classList.remove('drop-before', 'drop-after');
  row.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(WS_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const after = isAfter(e);
    row.classList.toggle('drop-after', after);
    row.classList.toggle('drop-before', !after);
  });
  row.addEventListener('dragleave', clear);
  row.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.types.includes(WS_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    clear();
    let payload;
    try { payload = JSON.parse(e.dataTransfer.getData(WS_MIME)); } catch { return; }
    if (!payload || payload.id === w.id) return;
    const beforeId = isAfter(e) ? (workspaces[index + 1]?.id ?? null) : w.id;
    if (beforeId === payload.id) return; // dropping right where it already sits
    await reorderWorkspace(payload.id, beforeId);
  });
}

function startWsRename(row, label, w) {
  const input = el('input', { class: 'inline-edit nav-edit', 'aria-label': 'Rename space' });
  input.value = w.name || '';
  label.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('click', (e) => e.stopPropagation());
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.replaceWith(label);
    if (name !== (w.name || '')) { await renameWorkspace(w.id, name); toast('Renamed'); }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { done = true; input.replaceWith(label); }
  });
  input.addEventListener('blur', commit);
}

function wsDeleteBtn(w, total) {
  let armed = false;
  return actionBtn('close', 'Delete space and its collections', async (_, btn) => {
    if (total <= 1) { toast('Keep at least one space'); return; }
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.replaceChildren(icon('close', 14)); }, 2600);
      return;
    }
    await removeWorkspace(w);
  }, 'danger');
}

/* — board — */

function renderBoard(spaces, q, tagsMap) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < spaces.length; i++) frag.append(column(spaces[i], i, q, tagsMap));

  const ghost = el('button', { class: 'ghost newcol', title: 'New collection', onclick: createEmpty },
    el('span', { class: 'plus-tile' }, icon('plus', 18)),
    el('span', { text: 'New collection' }),
  );
  addDropTarget(ghost, TAB_MIME, async ({ title, url }) => { if (url) { await addSpace('', [{ title: title || url, url }]); toast('New collection created'); } });
  addDropTarget(ghost, SPACE_MIME, async ({ id }) => reorderSpace(id, null));
  frag.append(ghost);

  if (!spaces.length) {
    frag.append(el('div', { class: 'board-empty' },
      'No collections in this space yet.', el('br'),
      'Drag a tab from the tray above, or hit ', el('strong', {}, 'Stash window'), ' to park this window.'));
  }
  boardRoot.replaceChildren(frag);
}

/* — COLLECTIONS sidebar — */

function renderCollectionsNav(spaces, q) {
  const frag = document.createDocumentFragment();
  spaces.forEach((s, i) => {
    const label = el('span', { class: 'nav-label', text: s.title || 'untitled' });
    const row = el('div', {
      class: 'navx', role: 'button', tabindex: '0', draggable: 'true', title: s.title || 'untitled', dataset: { id: s.id },
    },
      el('span', { class: 'nav-sq', style: `background: ${colorOf(s, i)}` }),
      label,
      el('span', { class: 'nav-n', text: String(s.tabs.length) }),
      el('span', { class: 'nav-acts' },
        actionBtn('rename', 'Rename collection', () => startNavRename(row, label, s)),
        navDeleteBtn(s),
      ),
    );
    const jump = () => {
      ensureBoardVisible();
      let target = boardRoot.querySelector(`.colcard[data-id="${s.id}"]`);
      if (getQuery() && (!target || target.classList.contains('filtered') || !target.offsetParent)) {
        clearSearch();
        setTimeout(() => flashColumn(boardRoot.querySelector(`.colcard[data-id="${s.id}"]`)), 130);
        return;
      }
      flashColumn(target);
    };
    row.addEventListener('click', jump);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) jump(); });
    row.addEventListener('dragstart', (e) => {
      if (e.target.closest('.nav-acts') || e.target.closest('input')) { e.preventDefault(); return; }
      e.dataTransfer.setData(SPACE_MIME, JSON.stringify({ id: s.id }));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    addDropTarget(row, SPACE_MIME, async ({ id }) => { if (id !== s.id) await reorderSpace(id, s.id); });
    addDropTarget(row, SPACETAB_MIME, async ({ spaceId, index }) => moveLinkChecked(spaceId, index, s.id, null));
    addDropTarget(row, TAB_MIME, async ({ title, url }) => { if (await addLinkChecked(s.id, { title, url })) toast(`Added to “${s.title || 'collection'}”`); });
    frag.append(row);
  });
  navRoot.replaceChildren(frag);
}

function flashColumn(target) {
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  target.classList.add('highlight');
  setTimeout(() => target.classList.remove('highlight'), 1200);
}

function startNavRename(row, label, space) {
  const input = el('input', { class: 'inline-edit nav-edit', 'aria-label': 'Rename collection' });
  input.value = space.title || '';
  label.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('click', (e) => e.stopPropagation());
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    input.replaceWith(label);
    if (title !== (space.title || '')) { await mutateSpace(space.id, (s) => { s.title = title; }); toast('Renamed'); }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { done = true; input.replaceWith(label); }
  });
  input.addEventListener('blur', commit);
}

// Rename a board column's collection title in place (triggered by the rename action).
function startColRename(nameSpan, space) {
  const input = el('input', { class: 'inline-edit col-edit', 'aria-label': 'Rename collection' });
  input.value = space.title || '';
  nameSpan.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('click', (e) => e.stopPropagation());
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    nameSpan.textContent = title;
    input.replaceWith(nameSpan);
    if (title !== (space.title || '')) { await mutateSpace(space.id, (s) => { s.title = title; }); toast('Renamed'); }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { done = true; input.replaceWith(nameSpan); }
  });
  input.addEventListener('blur', commit);
}

function navDeleteBtn(space) {
  let armed = false;
  return actionBtn('close', 'Delete collection', async (_, btn) => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.replaceChildren(icon('close', 14)); }, 2600);
      return;
    }
    await removeCollection(space);
  }, 'danger');
}

/* — a board column — */

function column(space, index, q, tagsMap) {
  const color = colorOf(space, index);
  const col = el('section', { class: 'colcard', draggable: 'true', dataset: { id: space.id } });
  if (space.collapsed && !q) col.classList.add('collapsed');

  const titleMatch = matches(q, space.title);
  const cards = space.tabs.map((t, i) => {
    const card = tabCard(space, t, i, tagsMap);
    if (q && !titleMatch && !matches(q, t.title, t.url)) card.classList.add('filtered');
    return card;
  });
  if (q && !titleMatch && !cards.some((c) => !c.classList.contains('filtered'))) col.classList.add('filtered');

  const chev = el('button', {
    class: 'col-chev', title: space.collapsed ? 'Expand collection' : 'Collapse collection', 'aria-label': 'Toggle collapse',
    onclick: (e) => { e.stopPropagation(); setSpaceProp(space.id, 'collapsed', !space.collapsed); },
  }, icon('chevron', 15));

  const dot = el('button', {
    class: 'col-dot', style: `background: ${color}`, title: 'Click to recolor',
    onclick: async () => { const next = DOT_COLORS[(DOT_COLORS.indexOf(color) + 1) % DOT_COLORS.length]; await mutateSpace(space.id, (s) => { s.color = next; }); },
  });

  // display-only title — renaming is via the rename action, so a click never edits it
  const name = el('span', { class: 'col-name', title: space.title || 'untitled', text: space.title || '' });

  const acts = el('span', { class: 'acts' },
    actionBtn('rename', 'Rename collection', () => startColRename(name, space)),
    actionBtn('download', 'Export this collection', () => exportCollections([space])),
    actionBtn('external', 'Open all in a new window', () => revive(space)),
    deleteBtn(space),
  );

  const head = el('div', { class: 'colhead' },
    el('div', { class: 'colhead-row' }, chev, dot, name, el('span', { class: 'col-count', text: String(space.tabs.length) }), acts),
    el('div', { class: 'col-note', text: `Updated ${shortDate(space.updatedAt || space.createdAt)}` }),
  );

  const body = el('div', { class: 'colbody' }, ...cards, addTabGhost(space));
  col.append(head, body);

  // the whole tile is a drag handle for reordering (works in column and tile views).
  // inner tab cards stopPropagation on their own dragstart; inputs/buttons are guarded out.
  col.addEventListener('dragstart', (e) => {
    if (e.target.closest('input, textarea, [contenteditable], .acts, .col-chev')) { e.preventDefault(); return; }
    e.dataTransfer.setData(SPACE_MIME, JSON.stringify({ id: space.id }));
    e.dataTransfer.effectAllowed = 'move';
    col.classList.add('dragging');
  });
  col.addEventListener('dragend', () => col.classList.remove('dragging'));

  addDropTarget(col, TAB_MIME, async ({ title, url }) => { if (await addLinkChecked(space.id, { title, url })) toast(`Added to “${space.title || 'collection'}”`); });
  addDropTarget(col, SPACETAB_MIME, async ({ spaceId, index: fromIndex }) => moveLinkChecked(spaceId, fromIndex, space.id, null));
  addDropTarget(col, SPACE_MIME, async ({ id }) => { if (id !== space.id) await reorderSpace(id, space.id); });
  return col;
}

function tabCard(space, tab, index, tagsMap) {
  const card = el('div', { class: 'tcard tabcard', role: 'link', tabindex: '0', draggable: 'true', title: tab.url });
  card.append(
    tile(tab.url, 34),
    el('span', { class: 'meta' },
      el('span', { class: 'title', text: tab.title || tab.url }),
      el('span', { class: 'domain', text: domainOf(tab.url) }),
      tagsMap ? tagChips(tagsMap, tab.url) : null,
    ),
    el('span', { class: 'acts' },
      actionBtn('tag', 'Edit tags', (_, btn) => openTagEditor(btn, { url: tab.url, title: tab.title || tab.url })),
      actionBtn('external', 'Open in background tab', () => { chrome.tabs.create({ url: tab.url, active: false }); toast('Opened in background'); }),
      actionBtn('close', 'Remove from collection', () => removeTab(space, tab, index), 'danger'),
    ),
  );
  const open = (e) => { if (e.metaKey || e.ctrlKey) chrome.tabs.create({ url: tab.url, active: false }); else window.location.href = tab.url; };
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  card.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData(SPACETAB_MIME, JSON.stringify({ spaceId: space.id, index }));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  addDropTarget(card, SPACETAB_MIME, async ({ spaceId, index: fromIndex }) => {
    if (spaceId === space.id && fromIndex === index) return;
    await moveLinkChecked(spaceId, fromIndex, space.id, index);
  });
  return card;
}

function addTabGhost(space) {
  const ghost = el('button', { class: 'ghost addtab', title: 'Add a link to this collection' }, icon('plus', 14), el('span', { text: 'Add tab' }));
  ghost.addEventListener('click', () => {
    const input = el('input', { class: 'addtab-input', placeholder: 'Paste a URL and press Enter…', 'aria-label': 'Add link by URL' });
    ghost.replaceWith(input);
    input.focus();
    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      let url = input.value.trim();
      input.replaceWith(ghost);
      if (!url) return;
      if (!/^[a-z]+:\/\//i.test(url)) url = 'https://' + url;
      try { new URL(url); } catch { toast('That does not look like a URL'); return; }
      if (await addLinkChecked(space.id, { title: domainOf(url) || url, url })) toast('Link added');
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') { done = true; input.replaceWith(ghost); } });
    input.addEventListener('blur', commit);
  });
  return ghost;
}

function deleteBtn(space) {
  let armed = false;
  return actionBtn('close', 'Delete collection', async (_, btn) => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.replaceChildren(icon('close', 14)); }, 2600);
      return;
    }
    await removeCollection(space);
  }, 'danger');
}

async function revive(space) {
  const urls = space.tabs.map((t) => t.url).filter(Boolean);
  if (!urls.length) { toast('This collection is empty'); return; }
  if (urls.length > OPEN_ALL_CONFIRM) {
    const ok = await confirmDialog({
      title: `Open ${urls.length} tabs?`,
      message: `“${space.title || 'This collection'}” has ${urls.length} links. They'll open together in a new window.`,
      confirmLabel: `Open ${urls.length} tabs`,
    });
    if (!ok) return;
  }
  try {
    await chrome.windows.create({ url: urls, focused: true });
    toast(`Opened “${space.title || 'collection'}” — ${urls.length} tab${urls.length === 1 ? '' : 's'}`);
  } catch {
    for (const url of urls) await chrome.tabs.create({ url, active: false });
  }
}
