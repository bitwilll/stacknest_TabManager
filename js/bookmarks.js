// Library view — Chrome bookmarks as a folder-first card grid with breadcrumbs.

import { el, icon, actionBtn, toast, tile, domainOf, debounce, addDropTarget, confirmDialog } from './ui.js';
import { TAGS_KEY, loadTags, tagChips, openTagEditor } from './tags.js';
import { moveFromLibrary } from './myspace.js';
import { hasPin } from './lock.js';

const BM_MIME = 'text/x-stacknest-bm';
const TAB_MIME = 'text/x-stacknest-tab';
const LAST_FOLDER_KEY = 'stacknest:folder';
const OPEN_ALL_CONFIRM = 10; // matches the Collections board's confirm threshold

/* Chrome's invisible tree root. Its children are the permanent roots — Bookmarks Bar,
   Other Bookmarks, and Mobile Bookmarks where it exists.

   The Library used to start inside Bookmarks Bar with a breadcrumb that only walked UP,
   and the permanent roots are siblings with nothing above them — so "Other Bookmarks" was
   unreachable: no crumb led to it and no card showed it. Browsing it now goes through
   this level, which renders the roots as folder cards and sits at the head of every trail.

   It is a real id to Chrome but a strange one: getSubTree('0') works while get('0')
   throws, so everything here reads it through getTree() instead. */
const ROOT_ID = '0';
const isPermanentRoot = (node) => node.parentId === ROOT_ID;

async function getFolder(id) {
  if (id === ROOT_ID) {
    const [root] = await chrome.bookmarks.getTree();
    return { ...root, id: ROOT_ID, title: 'All bookmarks' };
  }
  const [node] = await chrome.bookmarks.getSubTree(id);
  return node;
}

// A folder Chrome will actually accept writes into — never the tree root.
async function writableFolder() {
  const id = await ensureFolder();
  if (id !== ROOT_ID) return id;
  const roots = (await chrome.bookmarks.getTree())[0].children || [];
  return (roots.find((r) => r.id === '1') || roots[0]).id;
}

let root, getQuery;
let currentFolderId = null;

export function initBookmarks(options) {
  ({ root, getQuery } = options);
  currentFolderId = localStorage.getItem(LAST_FOLDER_KEY);

  const rerender = debounce(render, 120);
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) {
    chrome.bookmarks[ev]?.addListener(rerender);
  }
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && c[TAGS_KEY]) rerender(); });

  // a tab dragged anywhere onto the Library view gets bookmarked in the open folder
  const panel = root.closest('.view-library') || root;
  addDropTarget(panel, TAB_MIME, async ({ title, url }) => {
    if (url) await saveHere({ title, url });
  });

  render();
  return { render };
}

export async function saveHere({ title, url }) {
  if (!url) return;
  const folderId = await writableFolder();
  await chrome.bookmarks.create({ parentId: folderId, title: title || url, url });
  const [folder] = await chrome.bookmarks.get(folderId);
  toast(`Saved to “${folder.title}”`);
}

async function ensureFolder() {
  if (currentFolderId === ROOT_ID) return ROOT_ID;
  if (currentFolderId) {
    try {
      const [node] = await chrome.bookmarks.get(currentFolderId);
      if (node && !node.url) return currentFolderId;
    } catch { /* folder was deleted; fall through */ }
  }
  const roots = (await chrome.bookmarks.getTree())[0].children || [];
  currentFolderId = (roots.find((r) => r.id === '1') || roots[0]).id;
  localStorage.setItem(LAST_FOLDER_KEY, currentFolderId);
  return currentFolderId;
}

function openFolder(id) {
  currentFolderId = id;
  localStorage.setItem(LAST_FOLDER_KEY, id);
  render();
}

export async function render() {
  const q = getQuery();
  const tagsMap = await loadTags();
  const frag = document.createDocumentFragment();

  if (q) {
    const results = (await chrome.bookmarks.search(q)).filter((n) => n.url).slice(0, 60);
    if (results.length) {
      frag.append(el('div', { class: 'crumbs' }, el('span', { class: 'crumb current', text: `${results.length} match${results.length === 1 ? '' : 'es'}` })));
      frag.append(el('div', { class: 'bm-grid' }, ...results.map((n) => bookmarkCard(n, tagsMap))));
    } else {
      frag.append(el('div', { class: 'lib-empty' }, 'Nothing in the Library matches ', el('strong', {}, q), '.'));
    }
    root.replaceChildren(frag);
    return;
  }

  const folderId = await ensureFolder();
  const subtree = await getFolder(folderId);
  const children = subtree.children || [];
  const folders = children.filter((n) => !n.url);
  const links = children.filter((n) => n.url);

  frag.append(await crumbsBar(subtree));

  const newFolderSlot = el('div', { style: 'margin-bottom: 12px' });
  if (folderId !== ROOT_ID) frag.append(newFolderSlot);

  if (children.length) {
    frag.append(el('div', { class: 'bm-grid' },
      ...folders.map((n) => folderCard(n)),
      ...links.map((n) => bookmarkCard(n, tagsMap)),
    ));
  } else {
    frag.append(el('div', { class: 'lib-empty' }, folderId === ROOT_ID
      ? 'No bookmark folders in this profile yet.'
      : 'This folder is empty. Drag a tab here from the tray to keep it.'));
  }

  root.replaceChildren(frag);
  root._newFolderSlot = newFolderSlot;
}

async function crumbsBar(current) {
  const trail = [];
  if (current.id !== ROOT_ID) {
    let node = current;
    while (node && node.parentId && node.parentId !== ROOT_ID) {
      const [parent] = await chrome.bookmarks.get(node.parentId);
      trail.unshift(parent);
      node = parent;
    }
    // "All bookmarks" heads every trail, so the permanent roots are always one click away
    trail.unshift({ id: ROOT_ID, title: 'All bookmarks' });
  }

  const bar = el('nav', { class: 'crumbs', 'aria-label': 'Folder path' });
  for (const ancestor of trail) {
    const crumb = el('button', { class: 'crumb', text: ancestor.title || 'Bookmarks', onclick: () => openFolder(ancestor.id) });
    // nothing can be dropped INTO the tree root — Chrome rejects it
    if (ancestor.id !== ROOT_ID) acceptMoves(crumb, ancestor.id);
    bar.append(crumb, el('span', { class: 'crumb-sep', text: '›', 'aria-hidden': 'true' }));
  }
  bar.append(el('span', { class: 'crumb current', text: current.title || 'Bookmarks' }));

  if (current.id !== ROOT_ID) {
    bar.append(el('div', { class: 'bm-toolbar' },
      el('button', { class: 'ghost tool-ghost', title: 'New folder here', onclick: startNewFolder },
        icon('plus', 14), 'New folder'),
    ));
  }
  return bar;
}

function startNewFolder() {
  const slot = root._newFolderSlot;
  if (!slot || slot.firstChild) return;
  const input = el('input', { class: 'inline-edit', placeholder: 'Folder name…', 'aria-label': 'New folder name', style: 'max-width: 280px' });
  slot.append(input);
  input.focus();
  const commit = async () => {
    const title = input.value.trim();
    input.remove();
    if (title) {
      await chrome.bookmarks.create({ parentId: currentFolderId, title });
      toast(`Folder “${title}” created`);
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') input.remove();
  });
  input.addEventListener('blur', commit);
}

function folderTile() {
  const wrap = el('span', { class: 'tile', style: 'width:40px;height:40px' });
  wrap.append(icon('folder', 18));
  return wrap;
}

function folderCard(node) {
  const count = node.children?.length ?? 0;
  // Bookmarks Bar and Other Bookmarks are Chrome's own: it refuses to rename, move or
  // delete them, so those actions are absent rather than present-and-failing.
  const permanent = isPermanentRoot(node);
  const card = el('div', { class: `tcard bmcard folder${permanent ? ' is-root' : ''}`, role: 'button', tabindex: '0', draggable: String(!permanent) });
  card.append(
    folderTile(),
    el('span', { class: 'meta' },
      el('span', { class: 'title', text: node.title || 'Untitled' }),
      el('span', { class: 'domain', text: `${count} item${count === 1 ? '' : 's'}` }),
    ),
    el('span', { class: 'acts' },
      actionBtn('external', 'Open all as a new window', () => openAll(node)),
      permanent ? null : moveOutBtn(node),
      permanent ? null : actionBtn('rename', 'Rename', () => startRename(card, node)),
      permanent ? null : deleteBtn(node, `Delete folder and its ${count} items`),
    ),
  );
  card.addEventListener('click', () => openFolder(node.id));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openFolder(node.id); });
  if (!permanent) makeDraggable(card, node);
  acceptMoves(card, node.id);
  return card;
}

function bookmarkCard(node, tagsMap) {
  const card = el('div', { class: 'tcard bmcard', role: 'link', tabindex: '0', draggable: 'true', title: node.url });
  card.append(
    tile(node.url, 40),
    el('span', { class: 'meta' },
      el('span', { class: 'title', text: node.title || node.url }),
      el('span', { class: 'domain', text: domainOf(node.url) }),
      tagsMap ? tagChips(tagsMap, node.url) : null,
    ),
    el('span', { class: 'acts' },
      actionBtn('tag', 'Edit tags', (_, btn) => openTagEditor(btn, { url: node.url, title: node.title || node.url })),
      moveOutBtn(node),
      actionBtn('rename', 'Rename', () => startRename(card, node)),
      deleteBtn(node, 'Delete bookmark'),
    ),
  );
  const open = (e) => {
    if (e.metaKey || e.ctrlKey) chrome.tabs.create({ url: node.url, active: false });
    else window.location.href = node.url;
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  makeDraggable(card, node);
  return card;
}

function makeDraggable(card, node) {
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData(BM_MIME, JSON.stringify({ id: node.id }));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
}

function acceptMoves(nodeEl, folderId) {
  addDropTarget(nodeEl, BM_MIME, async ({ id }) => {
    if (id === folderId) return;
    await chrome.bookmarks.move(id, { parentId: folderId });
    toast('Moved');
  });
  addDropTarget(nodeEl, TAB_MIME, async ({ title, url }) => {
    if (!url) return;
    await chrome.bookmarks.create({ parentId: folderId, title: title || url, url });
    const [folder] = await chrome.bookmarks.get(folderId);
    toast(`Saved to “${folder.title}”`);
  });
}

function startRename(card, node) {
  const titleEl = card.querySelector('.title');
  if (!titleEl) return;
  const input = el('input', { class: 'inline-edit', 'aria-label': 'Rename' });
  input.value = node.title;
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('click', (e) => e.stopPropagation());
  const commit = async () => {
    const title = input.value.trim();
    if (title && title !== node.title) await chrome.bookmarks.update(node.id, { title });
    render();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') render();
  });
  input.addEventListener('blur', commit);
}

/* Take this out of Chrome. Left-click moves it to My Space; the Vault needs a PIN, so
   when none is set the action says why instead of silently doing the lesser thing. */
function moveOutBtn(node) {
  const isFolder = !node.url;
  const btn = actionBtn('box', isFolder ? 'Move folder out of Chrome, into My Space' : 'Move out of Chrome, into My Space',
    async () => { await moveFromLibrary(node, { vault: false }); });
  // right-click sends it straight to the Vault — the same move, one step further
  btn.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await hasPin())) { toast('Set a Vault PIN in Settings first'); return; }
    await moveFromLibrary(node, { vault: true });
  });
  btn.title += ' · right-click for the Vault';
  return btn;
}

function deleteBtn(node, label) {
  let armed = false;
  return actionBtn('close', label, async (_, btn) => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => {
        armed = false;
        btn.classList.remove('armed');
        btn.replaceChildren(icon('close', 14));
      }, 2600);
      return;
    }
    if (node.url) await chrome.bookmarks.remove(node.id);
    else await chrome.bookmarks.removeTree(node.id);
    toast(`Deleted “${node.title || 'bookmark'}”`);
  }, 'danger');
}

async function openAll(folder) {
  const links = (folder.children || []).filter((n) => n.url);
  if (!links.length) { toast('Folder has no links'); return; }
  if (links.length > OPEN_ALL_CONFIRM) {
    const ok = await confirmDialog({
      title: `Open ${links.length} tabs?`,
      message: `“${folder.title || 'This folder'}” has ${links.length} links. They'll open together in a new window.`,
      confirmLabel: `Open ${links.length} tabs`,
    });
    if (!ok) return;
  }
  try {
    await chrome.windows.create({ url: links.map((n) => n.url), focused: true });
  } catch {
    for (const n of links) await chrome.tabs.create({ url: n.url, active: false });
  }
  toast(`Opened ${links.length} tab${links.length === 1 ? '' : 's'} from “${folder.title}”`);
}
