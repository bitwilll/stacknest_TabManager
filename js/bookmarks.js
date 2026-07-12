// Library view — Chrome bookmarks as a folder-first card grid with breadcrumbs.

import { el, icon, actionBtn, toast, tile, domainOf, debounce, addDropTarget, confirmDialog } from './ui.js';
import { TAGS_KEY, loadTags, tagChips, openTagEditor } from './tags.js';

const BM_MIME = 'text/x-stacknest-bm';
const TAB_MIME = 'text/x-stacknest-tab';
const LAST_FOLDER_KEY = 'stacknest:folder';
const OPEN_ALL_CONFIRM = 10; // matches the Collections board's confirm threshold

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
  const folderId = await ensureFolder();
  await chrome.bookmarks.create({ parentId: folderId, title: title || url, url });
  const [folder] = await chrome.bookmarks.get(folderId);
  toast(`Saved to “${folder.title}”`);
}

async function ensureFolder() {
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
  const [subtree] = await chrome.bookmarks.getSubTree(folderId);
  const children = subtree.children || [];
  const folders = children.filter((n) => !n.url);
  const links = children.filter((n) => n.url);

  frag.append(await crumbsBar(subtree));

  const newFolderSlot = el('div', { style: 'margin-bottom: 12px' });
  frag.append(newFolderSlot);

  if (children.length) {
    frag.append(el('div', { class: 'bm-grid' },
      ...folders.map((n) => folderCard(n)),
      ...links.map((n) => bookmarkCard(n, tagsMap)),
    ));
  } else {
    frag.append(el('div', { class: 'lib-empty' },
      'This folder is empty. Drag a tab here from the tray to keep it.'));
  }

  root.replaceChildren(frag);
  root._newFolderSlot = newFolderSlot;
}

async function crumbsBar(current) {
  const trail = [];
  let node = current;
  while (node && node.parentId && node.parentId !== '0') {
    const [parent] = await chrome.bookmarks.get(node.parentId);
    trail.unshift(parent);
    node = parent;
  }

  const bar = el('nav', { class: 'crumbs', 'aria-label': 'Folder path' });
  for (const ancestor of trail) {
    const crumb = el('button', { class: 'crumb', text: ancestor.title || 'Bookmarks', onclick: () => openFolder(ancestor.id) });
    acceptMoves(crumb, ancestor.id);
    bar.append(crumb, el('span', { class: 'crumb-sep', text: '›', 'aria-hidden': 'true' }));
  }
  bar.append(el('span', { class: 'crumb current', text: current.title || 'Bookmarks' }));

  bar.append(el('div', { class: 'bm-toolbar' },
    el('button', { class: 'ghost tool-ghost', title: 'New folder here', onclick: startNewFolder },
      icon('plus', 14), 'New folder'),
  ));
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
  const card = el('div', { class: 'tcard bmcard folder', role: 'button', tabindex: '0', draggable: 'true' });
  card.append(
    folderTile(),
    el('span', { class: 'meta' },
      el('span', { class: 'title', text: node.title || 'Untitled' }),
      el('span', { class: 'domain', text: `${count} item${count === 1 ? '' : 's'}` }),
    ),
    el('span', { class: 'acts' },
      actionBtn('external', 'Open all as a new window', () => openAll(node)),
      actionBtn('rename', 'Rename', () => startRename(card, node)),
      deleteBtn(node, `Delete folder and its ${count} items`),
    ),
  );
  card.addEventListener('click', () => openFolder(node.id));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openFolder(node.id); });
  makeDraggable(card, node);
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
