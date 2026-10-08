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

import { el, icon, actionBtn, toast, tile, domainOf, matches, confirmDialog, emptyState,
         sectionHead, secGroup, noMatch, goTo, plural, badgeText } from './ui.js';
import { getKey, update, queued } from './store.js';
import { promptUnlock, isSessionUnlocked, hasPin, isLockedOut, relock } from './lock.js';
import { pushHistory, flashDeleted } from './history.js';

export const SPACE_KEY = 'stacknest:myspace';
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
  return { render };
}

export async function render() {
  const { items } = await loadSpace();
  const q = getQuery ? getQuery() : '';

  const open = items.filter((i) => !i.vault);
  const vaulted = items.filter((i) => i.vault);
  if (countEls.space) countEls.space.textContent = badgeText(open.length);
  // the Vault's own badge stays blank while locked — a count is information too
  if (countEls.vault) countEls.vault.textContent = isSessionUnlocked() ? badgeText(vaulted.length) : '';

  if (spaceRoot) spaceRoot.replaceChildren(...mySpacePanel(open, q));
  if (vaultRoot) vaultRoot.replaceChildren(...(await vaultPanel(vaulted, q)));
}

const folderCount = (items) => new Set(items.map((i) => i.group).filter(Boolean)).size;
const searchOf = (items, q) => (q ? items.filter((i) => matches(q, i.title, i.url)) : items);

// one captioned group per source folder; ungrouped first, then A→Z (order unchanged)
function groupedBody(shown, vault) {
  const groups = new Map();
  for (const it of shown) { const k = it.group || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  const named = keys.some(Boolean);
  return keys.map((k) => secGroup(
    { caption: k || (named ? 'unfiled' : 'links'), data: !!k, glyph: k ? 'folder' : null, count: groups.get(k).length },
    el('div', { class: 'bm-grid' }, ...groups.get(k).map((it) => spaceCard(it, vault)))));
}

function mySpacePanel(items, q) {
  const shown = searchOf(items, q);
  const g = folderCount(items);
  const head = sectionHead({
    stats: [{ n: items.length, unit: plural(items.length, 'link') }, { n: g, unit: plural(g, 'folder') }],
    match: q ? { q, shown: shown.length, total: items.length } : null,
    note: 'Moved out of Chrome — gone from its bookmarks bar, bookmarks page and address-bar suggestions. Put any back whenever you like.',
    tools: items.length ? [el('button', { class: 'btnx soft', type: 'button', title: 'Open the Library to move bookmarks here', onclick: () => goTo('library') },
      icon('library', 14), el('span', { text: 'Add from Library' }))] : [],
  });
  const body = !items.length
    ? [emptyState({
      icon: 'box', title: 'Nothing kept here yet',
      steps: ['In Library, press the box on a bookmark or folder.', 'It leaves Chrome’s bar, bookmarks page and suggestions.', 'Put it back from here any time.'],
      hint: ['Right-click the box to send it straight to the ', el('strong', {}, 'Vault'), '.'],
      actions: [el('button', { class: 'btnx soft', type: 'button', onclick: () => goTo('library') }, icon('library', 14), el('span', { text: 'Open Library' }))],
    })]
    : !shown.length ? [noMatch(q)] : groupedBody(shown, false);
  return [head, el('div', { class: 'sec-body' }, ...body)];
}

const VAULT_FOOT = 'stored in plain text on this device · the pin hides these links from this page, it doesn’t encrypt them · bookmark exports don’t include them';
const pinRecoveryBtn = () => el('button', { class: 'btnx ghosty', type: 'button', title: 'Open Settings › Vault', onclick: () => goTo('settings', 'set-vault') },
  icon('key', 14), el('span', { text: 'PIN & recovery' }));
const gate = (o) => el('div', { class: 'sec-body' }, emptyState({ variant: 'gate', icon: 'lock', ...o }));

// One anatomy in all five states: the head always renders, only the body swaps; the gate owns its primary.
async function vaultPanel(items, q) {
  const foot = el('p', { class: 'sec-foot', text: VAULT_FOOT });
  if (!(await hasPin())) {
    return [sectionHead({ scope: { key: 'vault', value: 'No PIN yet' }, note: 'The Vault keeps links behind a PIN. Set one to start using it.' }),
      gate({ caption: 'no pin', title: 'Set a PIN to open the Vault', hint: 'The Vault needs a PIN before it can hold anything.',
        actions: [el('button', { class: 'btnx primary', type: 'button', onclick: () => goTo('settings', 'set-vault') }, icon('key', 15), el('span', { text: 'Set a PIN in Settings' }))] }),
      foot];
  }
  if (await isLockedOut()) {
    return [sectionHead({ scope: { key: 'vault', value: 'Locked out', tone: 'danger' }, note: 'Too many wrong PINs. Guessing again won’t help — recover it in Settings.' }),
      gate({ caption: 'locked out', title: 'Too many wrong PINs — the Vault is locked',
        hint: 'Recover it in Settings with your security question, or by signing in to the Google account that set the PIN.',
        actions: [el('button', { class: 'btnx primary', type: 'button', onclick: () => goTo('settings', 'set-vault') }, icon('key', 15), el('span', { text: 'Go to Settings' }))] }),
      foot];
  }
  if (!isSessionUnlocked()) {
    return [sectionHead({ scope: { key: 'vault', value: 'Locked' },
      stats: [{ n: items.length, unit: `${plural(items.length, 'link')} locked` }],   // owner decision: the count shows here (the gate title showed it before); stats: [] would match the blank nav badge
      note: 'Every new tab opens the Vault locked.', tools: [pinRecoveryBtn()] }),
      gate({ caption: 'locked', title: 'Locked for this tab', hint: 'Enter your PIN to open the Vault for this session.',
        actions: [el('button', { class: 'btnx primary', type: 'button', onclick: async () => { if (await promptUnlock()) render(); } }, icon('unlock', 15), el('span', { text: 'Unlock' }))] }),
      foot];
  }
  // unlocked: the same head anatomy as My Space, plus its state and the lock
  const shown = searchOf(items, q);
  const g = folderCount(items);
  const head = sectionHead({
    scope: { key: 'vault', value: 'Unlocked · this tab', tone: 'state' },
    stats: [{ n: items.length, unit: plural(items.length, 'link') }, { n: g, unit: plural(g, 'folder') }],
    match: q ? { q, shown: shown.length, total: items.length } : null,
    note: 'Every new tab opens the Vault locked again.',
    tools: [pinRecoveryBtn(), el('button', { class: 'btnx soft', type: 'button', title: 'Lock the Vault now', onclick: () => { relock(); render(); toast('Vault locked'); } }, icon('lock', 14), el('span', { text: 'Lock now' }))],
  });
  const body = !items.length
    ? [emptyState({ icon: 'lock', title: 'The Vault is empty',
      hint: ['Use ', el('strong', {}, 'Move to the Vault'), ' on a My Space link, or right-click the box on any Library bookmark.'],
      actions: [el('button', { class: 'btnx soft', type: 'button', onclick: () => goTo('myspace') }, icon('box', 14), el('span', { text: 'Open My Space' }))] })]
    : !shown.length ? [noMatch(q)] : groupedBody(shown, true);
  return [head, el('div', { class: 'sec-body' }, ...body), foot];
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
        ? actionBtn('box', 'Move to My Space', async () => { await setVault([item.id], false); toast('Moved to My Space'); })
        : actionBtn('lock', 'Move to the Vault (needs a PIN)', async () => {
          if (!(await hasPin())) { toast('Set a PIN in Settings first'); return; }
          await setVault([item.id], true); toast('Moved to the Vault');
        }),
      actionBtn('library', 'Put back in Chrome bookmarks', async () => {
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
  return actionBtn('trash', 'Delete', async (_, btn) => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.replaceChildren('sure?');
      setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.replaceChildren(icon('trash', 14)); }, 2600);
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
