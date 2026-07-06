// Duplicates view — finds the same URL saved more than once across your collections
// and Chrome bookmarks, groups the copies, and lets you prune the redundant ones.

import { el, icon, actionBtn, tile, domainOf, toast, matches, normalizeUrl } from './ui.js';
import { loadSpaces, loadWorkspaces, mutateSpace, insertTabAt } from './spacesStore.js';
import { pushHistory, flashDeleted } from './history.js';

let root, getQuery, countEl;

export function initDuplicates(options) {
  ({ root, getQuery, countEl } = options);
  // collections live in chrome.storage.local; bookmarks in the bookmarks tree — watch both
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && c['stacknest:spaces']) render(); });
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) chrome.bookmarks[ev]?.addListener(render);
  render();
  return { render };
}

// Flatten every saved link into { key, url, title, source } occurrences.
async function collectOccurrences() {
  const out = [];
  const [collections, workspaces] = await Promise.all([loadSpaces(), loadWorkspaces()]);
  const wsName = (id) => workspaces.find((w) => w.id === id)?.name || 'Space';
  for (const c of collections) {
    (c.tabs || []).forEach((t, index) => {
      if (!t.url) return;
      out.push({
        type: 'collection', key: normalizeUrl(t.url), url: t.url, title: t.title || t.url,
        collectionId: c.id, index, sourceLabel: `${c.title || 'Untitled'} · ${wsName(c.workspaceId)}`,
      });
    });
  }
  try {
    const [tree] = await chrome.bookmarks.getTree();
    const walk = (node, path) => {
      for (const n of node.children || []) {
        if (n.url) out.push({ type: 'bookmark', key: normalizeUrl(n.url), url: n.url, title: n.title || n.url, id: n.id, sourceLabel: path || 'Bookmarks' });
        else walk(n, n.title || path);
      }
    };
    walk(tree, '');
  } catch { /* bookmarks unavailable — collections only */ }
  return out;
}

function groupDuplicates(occurrences) {
  const map = new Map();
  for (const o of occurrences) {
    if (!map.has(o.key)) map.set(o.key, []);
    map.get(o.key).push(o);
  }
  // only keys that appear 2+ times are duplicates; sort by most-duplicated first
  return [...map.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}

export async function render() {
  const q = getQuery();
  const groups = groupDuplicates(await collectOccurrences());
  const shown = q ? groups.filter((g) => g.some((o) => matches(q, o.title, o.url))) : groups;

  const totalRedundant = groups.reduce((n, g) => n + (g.length - 1), 0);
  if (countEl) countEl.textContent = totalRedundant ? String(totalRedundant) : '';

  const frag = document.createDocumentFragment();
  frag.append(el('div', { class: 'dup-head' },
    el('div', { class: 'dup-h-text' },
      el('h2', { class: 'dup-title', text: groups.length ? `${groups.length} duplicated link${groups.length === 1 ? '' : 's'}` : 'No duplicates' }),
      el('p', { class: 'dup-sub', text: groups.length
        ? `${totalRedundant} redundant cop${totalRedundant === 1 ? 'y' : 'ies'} across your collections and bookmarks. Pick which copy to keep in each group, then remove the rest — or delete copies one at a time.`
        : 'Every saved link is unique. Nothing to clean up.' }),
    ),
  ));

  if (!shown.length && groups.length) {
    frag.append(el('div', { class: 'lib-empty' }, 'No duplicates match ', el('strong', {}, q), '.'));
  }
  for (const g of shown) frag.append(groupCard(g));

  root.replaceChildren(frag);
}

function groupCard(group) {
  const head = group[0];
  const card = el('section', { class: 'dup-card' });
  const radioName = `keep-${head.key.replace(/[^a-z0-9]/gi, '')}`;
  let keepIdx = 0; // which copy the user chose to keep

  const list = el('div', { class: 'dup-occs' });
  group.forEach((o, i) => {
    const radio = el('input', { type: 'radio', name: radioName, class: 'dup-radio', 'aria-label': `Keep the copy in ${o.sourceLabel}` });
    if (i === 0) radio.checked = true;
    radio.addEventListener('change', () => { if (radio.checked) keepIdx = i; });
    const row = el('div', { class: 'dup-occ' },
      radio,
      el('span', { class: `dup-src-ic ${o.type}` }, icon(o.type === 'bookmark' ? 'archive' : 'folder', 13)),
      el('span', { class: 'dup-src', text: o.sourceLabel }),
      el('span', { class: 'dup-src-kind', text: o.type }),
      actionBtn('close', 'Remove this copy', () => removeOccurrence(o), 'danger'),
    );
    // clicking the row (but not the remove button) selects this copy to keep
    row.addEventListener('click', (e) => { if (!e.target.closest('button')) { radio.checked = true; keepIdx = i; } });
    list.append(row);
  });

  card.append(el('div', { class: 'dup-card-head' },
    tile(head.url, 34),
    el('a', { class: 'dup-link', href: head.url, title: head.url },
      el('span', { class: 'dup-link-title', text: head.title }),
      el('span', { class: 'dup-link-url', text: domainOf(head.url) || head.url }),
    ),
    el('span', { class: 'dup-badge', text: `${group.length}×` }),
    el('button', { class: 'btnx soft dup-resolve', title: 'Remove every copy except the one selected below', onclick: () => resolveGroup(group, keepIdx) },
      el('span', { text: 'Keep selected' })),
  ), list);
  return card;
}

async function removeOccurrence(o) {
  if (o.type === 'collection') {
    const copy = { title: o.title, url: o.url };
    await mutateSpace(o.collectionId, (s) => {
      let i = (s.tabs[o.index] && normalizeUrl(s.tabs[o.index].url) === o.key) ? o.index : s.tabs.findIndex((t) => normalizeUrl(t.url) === o.key);
      if (i >= 0) s.tabs.splice(i, 1);
    });
    pushHistory({
      label: `“${o.title}”`,
      undo: () => insertTabAt(o.collectionId, copy, o.index),
      redo: () => mutateSpace(o.collectionId, (s) => { const i = s.tabs.findIndex((t) => normalizeUrl(t.url) === o.key); if (i >= 0) s.tabs.splice(i, 1); }),
    });
    flashDeleted(`Removed duplicate “${o.title}”`);
  } else {
    try { await chrome.bookmarks.remove(o.id); toast(`Removed bookmark “${o.title}”`); }
    catch { toast('Could not remove that bookmark'); }
  }
}

// Remove every copy in the group except the one the user selected.
async function resolveGroup(group, keepIdx = 0) {
  const keep = group[keepIdx] || group[0];
  for (const o of group) if (o !== keep) await removeOccurrence(o);
}
