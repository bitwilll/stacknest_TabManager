/* ————————————————————————————————————————————————————————————
   My Space and the Vault — bookmarks that live in StackNest, not in Chrome.

   Moving a bookmark here COPIES it into chrome.storage.local and then DELETES it from
   Chrome's bookmark tree. That is the whole point: it is the only way to get a link off
   the bookmarks bar, out of chrome://bookmarks and out of address-bar suggestions. A
   folder moves as a group — its items keep the folder's name as their group label rather
   than reconstructing a nested tree, because a flat list with headings is what these two
   views actually render.

   My Space is open. The Vault is the same store behind the PIN (js/lock.js). Moving
   between them is a flag, not a copy, so nothing is duplicated and nothing can drift.

   Every move is reversible: "Put back in Chrome" recreates the bookmark in a chosen
   folder and drops it from here. Nothing is destroyed by moving.
   ———————————————————————————————————————————————————————————— */

import { el, icon, actionBtn, toast, tile, domainOf, matches, confirmDialog } from './ui.js';
import { getKey, update, queued } from './store.js';
import { promptUnlock, isSessionUnlocked, hasPin, isLockedOut, relock } from './lock.js';
import { pushHistory, flashDeleted } from './history.js';

export const SPACE_KEY = 'stacknest:myspace';
const BM_MIME = 'text/x-stacknest-bm';
const TAB_MIME = 'text/x-stacknest-tab';

let spaceRoot, vaultRoot, getQuery, countEls = {};

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

function normalize(raw) {
  const d = (raw && typeof raw === 'object') ? raw : {};
  const items = Array.isArray(d.items) ? d.items : [];
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const url = typeof it.url === 'string' ? it.url : '';
    if (!url) continue;                                  // a bookmark with no URL is nothing
    let id = typeof it.id === 'string' && it.id ? it.id : uid();
    while (seen.has(id)) id = uid();                     // duplicate ids cross-wire every lookup
    seen.add(id);
    out.push({
      id,
      url,
      title: typeof it.title === 'string' && it.title ? it.title : url,
      group: typeof it.group === 'string' && it.group ? it.group : null,
      vault: !!it.vault,
      addedAt: Number.isFinite(it.addedAt) ? it.addedAt : Date.now(),
    });
  }
  return { v: 1, items: out };
}

export async function loadSpace() {
  return normalize(await queued(() => getKey(SPACE_KEY, {})));
}

async function mutate(fn) {
  await update(SPACE_KEY, {}, (cur) => { const d = normalize(cur); fn(d); return d; });
}

/* ————— moving things in and out ————— */

// Pull a Chrome node (link or whole folder) into this store, then delete it from Chrome.
export async function absorbFromChrome(node, { vault = false } = {}) {
  // Chrome refuses to remove its permanent roots (Bookmarks Bar, Other Bookmarks). Copying
  // first and discovering that afterwards would leave every link in both places, so this is
  // checked before anything is written.
  if (!node.url && (node.parentId === '0' || !node.parentId)) {
    toast('Chrome won’t let its top-level folders be moved — open one and move what’s inside');
    return 0;
  }
  const picked = [];
  if (node.url) {
    picked.push({ title: node.title || node.url, url: node.url, group: null });
  } else {
    const [tree] = await chrome.bookmarks.getSubTree(node.id);
    const walk = (n, group) => {
      for (const c of n.children || []) {
        if (c.url) picked.push({ title: c.title || c.url, url: c.url, group });
        else walk(c, c.title || group);      // nested folders collapse onto their own name
      }
    };
    walk(tree, tree.title || null);
  }
  if (!picked.length) { toast('Nothing to move — that folder has no links'); return 0; }

  const added = picked.map((p) => ({ id: uid(), ...p, vault, addedAt: Date.now() }));
  await mutate((d) => { d.items.push(...added); });

  // Remove from Chrome only after the copy is committed, so a crash between the two
  // cannot lose links. If Chrome refuses, roll the copy back rather than leaving the same
  // bookmarks in both places — a silent duplicate is worse than a failed move.
  try {
    if (node.url) await chrome.bookmarks.remove(node.id);
    else await chrome.bookmarks.removeTree(node.id);
  } catch {
    await removeItems(added.map((a) => a.id));
    toast('Chrome wouldn’t release those bookmarks — nothing was moved');
    return 0;
  }
  return picked.length;
}

export async function setVault(ids, vault) {
  const set = new Set(ids);
  await mutate((d) => { for (const it of d.items) if (set.has(it.id)) it.vault = vault; });
}

export async function removeItems(ids) {
  const set = new Set(ids);
  let removed = [];
  await mutate((d) => {
    removed = d.items.filter((it) => set.has(it.id));
    d.items = d.items.filter((it) => !set.has(it.id));
  });
  return removed;
}

// Put a link back where Chrome can see it again.
export async function restoreToChrome(item) {
  const roots = (await chrome.bookmarks.getTree())[0].children || [];
  const bar = roots.find((r) => r.id === '1') || roots[0];
  await chrome.bookmarks.create({ parentId: bar.id, title: item.title, url: item.url });
  await removeItems([item.id]);
  return bar.title || 'Bookmarks';
}

/* ————————————————————————— views ————————————————————————— */

export function initMySpace(options) {
  ({ spaceRoot, vaultRoot, getQuery } = options);
  countEls = { space: options.spaceCountEl, vault: options.vaultCountEl };
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && c[SPACE_KEY]) render(); });
  render();
  return { render, renderVault: () => render() };
}

export async function render() {
  const { items } = await loadSpace();
  const q = getQuery ? getQuery() : '';

  const open = items.filter((i) => !i.vault);
  const vaulted = items.filter((i) => i.vault);
  if (countEls.space) countEls.space.textContent = open.length ? String(open.length) : '';
  // the Vault's own badge stays blank while locked — a count is information too
  if (countEls.vault) countEls.vault.textContent = isSessionUnlocked() && vaulted.length ? String(vaulted.length) : '';

  if (spaceRoot) spaceRoot.replaceChildren(listPanel(open, q, false));
  if (vaultRoot) vaultRoot.replaceChildren(await vaultPanel(vaulted, q));
}

function header(title, sub, tools) {
  return el('div', { class: 'notes-head' },
    el('div', { class: 'notes-h-text' }, el('p', { class: 'notes-sub', text: sub })),
    tools ? el('div', { class: 'notes-tools' }, ...tools) : null,
  );
}

function listPanel(items, q, vault) {
  const frag = document.createDocumentFragment();
  const shown = q ? items.filter((i) => matches(q, i.title, i.url)) : items;

  frag.append(header(
    vault ? 'Vault' : 'My Space',
    `${items.length} bookmark${items.length === 1 ? '' : 's'} kept in StackNest only${q ? ` · ${shown.length} matching` : ''}`,
    vault ? [el('button', { class: 'btnx soft notes-tool', onclick: () => { relock(); render(); toast('Vault locked'); } }, icon('lock', 14), el('span', { text: 'Lock now' }))] : null,
  ));

  if (!items.length) {
    frag.append(el('div', { class: 'lib-empty' },
      vault
        ? el('span', {}, 'The Vault is empty. Move something here from ', el('strong', {}, 'My Space'), ' to keep it behind your PIN.')
        : el('span', {}, 'Nothing here yet. In ', el('strong', {}, 'Library'), ', use the ', el('strong', {}, 'move'), ' action on a bookmark or folder to take it out of Chrome and keep it here.')));
    return frag;
  }
  if (!shown.length) {
    frag.append(el('div', { class: 'lib-empty' }, 'Nothing here matches ', el('strong', {}, q), '.'));
    return frag;
  }

  // group by the folder the items came from; ungrouped ones come first
  const groups = new Map();
  for (const it of shown) {
    const k = it.group || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  for (const k of keys) {
    if (k) frag.append(el('h3', { class: 'tag-section-h' }, icon('folder', 15), k));
    frag.append(el('div', { class: 'bm-grid' }, ...groups.get(k).map((it) => spaceCard(it, vault))));
  }
  return frag;
}

async function vaultPanel(items, q) {
  if (!(await hasPin())) {
    return el('div', { class: 'lib-empty' },
      el('p', {}, 'The Vault needs a PIN before it can hold anything.'),
      el('button', {
        class: 'btnx primary', style: 'margin-top: 12px',
        onclick: () => document.querySelector('[data-view="settings"]')?.click(),
      }, el('span', { text: 'Set a PIN in Settings' })));
  }
  if (await isLockedOut()) {
    return el('div', { class: 'lib-empty' },
      el('p', {}, 'Too many wrong PINs — the Vault is locked.'),
      el('p', { style: 'margin-top: 6px' }, 'Recover it in Settings with your security question, or by signing in to the Google account that set the PIN.'),
      el('button', {
        class: 'btnx primary', style: 'margin-top: 12px',
        onclick: () => document.querySelector('[data-view="settings"]')?.click(),
      }, el('span', { text: 'Go to Settings' })));
  }
  if (!isSessionUnlocked()) {
    return el('div', { class: 'lib-empty vault-shut' },
      icon('lock', 28),
      el('p', { style: 'margin-top: 10px' }, `${items.length} bookmark${items.length === 1 ? '' : 's'} locked.`),
      el('button', {
        class: 'btnx primary', style: 'margin-top: 12px',
        onclick: async () => { if (await promptUnlock()) render(); },
      }, el('span', { text: 'Unlock' })));
  }
  return listPanel(items, q, true);
}

function spaceCard(item, vault) {
  const card = el('div', { class: 'tcard bmcard', role: 'link', tabindex: '0', draggable: 'true', title: item.url });
  card.append(
    tile(item.url, 40),
    el('span', { class: 'meta' },
      el('span', { class: 'title', text: item.title }),
      el('span', { class: 'domain', text: domainOf(item.url) }),
    ),
    el('span', { class: 'acts' },
      vault
        ? actionBtn('unlock', 'Move to My Space', async () => { await setVault([item.id], false); toast('Moved to My Space'); })
        : actionBtn('lock', 'Move to the Vault', async () => {
          if (!(await hasPin())) { toast('Set a PIN in Settings first'); return; }
          await setVault([item.id], true); toast('Moved to the Vault');
        }),
      actionBtn('external', 'Put back in Chrome bookmarks', async () => {
        const where = await restoreToChrome(item);
        toast(`Put back in “${where}”`);
      }),
      deleteBtn(item),
    ),
  );
  const open = (e) => {
    if (e.metaKey || e.ctrlKey) chrome.tabs.create({ url: item.url, active: false });
    else window.location.href = item.url;
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData(TAB_MIME, JSON.stringify({ title: item.title, url: item.url }));
    e.dataTransfer.effectAllowed = 'copy';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  return card;
}

function deleteBtn(item) {
  let armed = false;
  return actionBtn('close', 'Delete', async (_, btn) => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.replaceChildren(icon('close', 14)); }, 2600);
      return;
    }
    const [removed] = await removeItems([item.id]);
    // This may be the only copy of a link that no longer exists in Chrome, so deleting it
    // here is a real loss — it gets the same undo treatment as deleting a collection.
    if (removed) {
      pushHistory({
        label: `“${removed.title}”`,
        undo: async () => { await mutate((d) => { d.items.push(removed); }); },
        redo: async () => { await removeItems([removed.id]); },
      });
      flashDeleted(`Deleted “${removed.title}”`);
    }
  }, 'danger');
}

/* Used by the Library's move action so it can offer both destinations. */
export async function moveFromLibrary(node, { vault }) {
  const isFolder = !node.url;
  const label = node.title || (node.url ? 'this bookmark' : 'this folder');
  const ok = await confirmDialog({
    title: vault ? 'Move to the Vault?' : 'Move to My Space?',
    message: `“${label}” will be removed from Chrome — it disappears from the bookmarks bar, chrome://bookmarks and address-bar suggestions — and kept in StackNest${vault ? ' behind your PIN' : ''} instead.${isFolder ? ' Every link inside it moves too.' : ''} You can put it back any time.`,
    confirmLabel: vault ? 'Move to Vault' : 'Move to My Space',
  });
  if (!ok) return;
  const n = await absorbFromChrome(node, { vault });
  if (n) toast(`Moved ${n} bookmark${n === 1 ? '' : 's'} to ${vault ? 'the Vault' : 'My Space'}`);
}
