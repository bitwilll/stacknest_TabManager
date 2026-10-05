// Duplicates view — finds the same URL saved more than once across your collections
// and Chrome bookmarks, groups the copies, and lets you prune the redundant ones.

import { el, icon, actionBtn, tile, domainOf, toast, matches, normalizeUrl, confirmDialog, debounce, viewHidden, emptyState, sectionHead, secGroup, noMatch, plural } from './ui.js';
import { SPACES_KEY, loadSpaces, loadWorkspaces, mutateSpace, insertTabAt } from './spacesStore.js';
import { getKey, update } from './store.js';
import { pushHistory, flashDeleted } from './history.js';

// Links the user told us to stop flagging. Keyed by normalized URL; restorable.
export const FORGET_KEY = 'stacknest:dupforgotten';
async function loadForgotten() {
  const m = await getKey(FORGET_KEY, {});
  return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
}
const forgetLink = (o) => update(FORGET_KEY, {}, (m) => { m[o.key] = { url: o.url, title: o.title, at: Date.now() }; return m; });
const restoreLink = (key) => update(FORGET_KEY, {}, (m) => { delete m[key]; return m; });

let root, getQuery, countEl;
let dupSeq = 0; // ids for each card's h3, so the card section is labelled by its link

export function initDuplicates(options) {
  ({ root, getQuery, countEl } = options);
  // collections live in chrome.storage.local; bookmarks in the bookmarks tree — watch both
  // a bulk clean fires one bookmark event per removal — coalesce them into a single scan
  const rerender = debounce(render, 150);
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && (c[SPACES_KEY] || c[FORGET_KEY])) rerender(); });
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) chrome.bookmarks[ev]?.addListener(rerender);
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
  const [occurrences, forgotten] = await Promise.all([collectOccurrences(), loadForgotten()]);
  const allGroups = groupDuplicates(occurrences);
  const groups = allGroups.filter((g) => !forgotten[g[0].key]); // forgotten links stay out of the scan
  const shown = q ? groups.filter((g) => g.some((o) => matches(q, o.title, o.url))) : groups;

  const totalRedundant = groups.reduce((n, g) => n + (g.length - 1), 0);
  if (countEl) countEl.textContent = totalRedundant ? String(totalRedundant) : '';
  if (viewHidden(root)) return; // badge stays live; the DOM is rebuilt when the view opens

  // the head stays in every state — empty and no-match live inside the "duplicated links" group
  const head = sectionHead({
    stats: [{ n: totalRedundant, unit: `redundant ${plural(totalRedundant, 'copy', 'copies')}` }, { n: groups.length, unit: plural(groups.length, 'link') }],
    match: q ? { q, shown: shown.length, total: groups.length, unit: plural(groups.length, 'link') } : null,
    note: groups.length
      ? 'Collections and Chrome bookmarks, re-scanned on their own. Collection removals can be undone; bookmark removals can’t.'
      : 'Every link across your collections and Chrome bookmarks is saved exactly once.',
    primary: groups.length ? el('button', { class: 'btnx primary dup-clean', type: 'button',
      title: 'For every duplicated link: keep one copy, remove all the others',
      onclick: () => autoClean(groups, totalRedundant) }, el('span', { text: 'Keep one of each' })) : null,
    // the truth about the existing scope, next to the button: it ignores search and ticks
    // only worth saying "not just the n shown" when the search actually hides some of them
    primaryNote: groups.length
      ? (q && shown.length && shown.length < groups.length
        ? `all ${groups.length} ${plural(groups.length, 'link')}, not just the ${shown.length} shown`
        : `all ${groups.length} ${plural(groups.length, 'link')} · keeps the first copy listed`)
      : null,
  });
  const list = secGroup({ caption: 'duplicated links', count: q ? `${shown.length} of ${groups.length}` : groups.length, className: 'dup-list' },
    groups.length && shown.length ? el('p', { class: 'sec-help', text: 'Tick the copies to keep · Keep selected removes the rest · × removes one copy.' }) : null,
    ...(!groups.length ? [emptyState({ icon: 'check', title: 'No duplicates', hint: 'This view re-scans on its own whenever something changes.' })]
      : !shown.length ? [noMatch(q, 'Matches any copy’s title or address.')]
      : shown.map(groupCard)));
  root.replaceChildren(head, el('div', { class: 'sec-body' }, el('div', { class: 'sec-split' }, list, forgottenSection(forgotten, allGroups))));
}

// One click, zero redundancy: keep the first copy of every group, remove the rest.
async function autoClean(groups, totalRedundant) {
  const ok = await confirmDialog({
    title: 'Keep one copy of each link?',
    message: `This removes ${totalRedundant} redundant cop${totalRedundant === 1 ? 'y' : 'ies'} across ${groups.length} link${groups.length === 1 ? '' : 's'}, keeping the first copy of each. Collection removals can be undone; bookmark removals cannot.`,
    confirmLabel: 'Clean up',
    danger: true,
  });
  if (!ok) return;
  for (const g of groups) await resolveGroup(g, new Set([0]));
  toast(`Removed ${totalRedundant} redundant cop${totalRedundant === 1 ? 'y' : 'ies'} — one copy of each link kept`);
}

// The parking lot for links the user chose to stop flagging — an aside group, never filtered by search.
function forgottenSection(forgotten, allGroups) {
  const keys = Object.keys(forgotten).sort((a, b) => (forgotten[b].at || 0) - (forgotten[a].at || 0));
  if (!keys.length) return el('span', { hidden: true });
  const rows = keys.map((k) => {
    const rec = forgotten[k];
    const copies = allGroups.find((g) => g[0].key === k)?.length || 1;
    return el('div', { class: 'dup-forgot-row' },
      tile(rec.url, 26),
      el('span', { class: 'dup-forgot-meta' },
        el('span', { class: 'dup-forgot-title', text: rec.title || rec.url }),
        el('span', { class: 'dup-forgot-url', text: domainOf(rec.url) || rec.url })),
      el('span', { class: 'dup-saved', text: `${copies}× saved` }),
      el('button', { class: 'btnx soft sm dup-restore', type: 'button', title: 'Flag this link’s duplicates again', onclick: () => restoreLink(k) }, el('span', { text: 'Restore' })));
  });
  return secGroup({ caption: 'forgotten links', count: keys.length, className: 'dup-forgot' },
    el('p', { class: 'sec-help', text: 'Kept out of duplicate scans. Restore one to flag its copies again.' }),
    el('div', { class: 'dup-forgot-list' }, ...rows));
}

function groupCard(group) {
  const head = group[0];
  const titleId = `dup-${++dupSeq}`;
  const card = el('section', { class: 'dup-card', 'aria-labelledby': titleId });
  const keep = new Set([0]); // indices of the copies to keep — one or several; first by default

  const resolveBtn = el('button', { class: 'btnx soft sm dup-resolve', type: 'button', onclick: () => resolveGroup(group, keep) },
    el('span', { text: 'Keep selected' }));
  const footState = el('span', { class: 'dup-foot-state', 'aria-live': 'polite' });
  const syncResolve = () => {
    const removing = group.length - keep.size;
    resolveBtn.disabled = !keep.size || !removing;
    const msg = !keep.size ? 'Tick at least one copy to keep'
      : !removing ? 'Everything is ticked — untick the copies you want removed'
      : `Keep ${keep.size} cop${keep.size === 1 ? 'y' : 'ies'}, remove the other ${removing}`;
    resolveBtn.title = msg;
    footState.textContent = msg;   // visible, not hover-only; set before the card is attached, so no initial announcement
  };

  const list = el('div', { class: 'dup-occs' });
  group.forEach((o, i) => {
    const box = el('input', { type: 'checkbox', class: 'dup-keep', 'aria-label': `Keep the copy in ${o.sourceLabel}` });
    if (keep.has(i)) box.checked = true;
    const setKept = (kept) => { keep[kept ? 'add' : 'delete'](i); syncResolve(); };
    box.addEventListener('change', () => setKept(box.checked));
    const row = el('div', { class: 'dup-occ' },
      box,
      el('span', { class: `dup-src-ic ${o.type}` }, icon(o.type === 'bookmark' ? 'archive' : 'folder', 13)),
      el('span', { class: 'dup-src', text: o.sourceLabel }),
      // says what × does to this copy: collection removals go through undo, bookmark removals do not
      el('span', { class: 'dup-src-kind', text: o.type === 'collection' ? 'collection · undoable' : 'bookmark · permanent' }),
      actionBtn('close', 'Remove this copy', () => removeOccurrence(o), 'danger'),
    );
    // clicking the row toggles keeping this copy (the checkbox and buttons handle themselves)
    row.addEventListener('click', (e) => {
      if (e.target.closest('button, input')) return;
      box.checked = !box.checked;
      setKept(box.checked);
    });
    list.append(row);
  });
  syncResolve();

  card.append(
    el('div', { class: 'dup-card-head' },
      tile(head.url, 34),
      el('h3', { class: 'dup-h', id: titleId },
        el('a', { class: 'dup-link', href: head.url, title: head.url },
          el('span', { class: 'dup-link-title', text: head.title }),
          el('span', { class: 'dup-link-url', text: domainOf(head.url) || head.url }))),
      el('span', { class: 'dup-count', text: `${group.length} copies` }),
      el('button', { class: 'btnx ghosty sm dup-forget', type: 'button',
        title: 'Stop flagging this link as a duplicate — it moves to “Forgotten links”, where you can restore it',
        onclick: () => { forgetLink(head); toast(`Forgot “${head.title}” — restore it any time`); } }, el('span', { text: 'Forget' }))),
    list,
    el('div', { class: 'dup-card-foot' }, footState, resolveBtn));
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

// Remove every copy the user did not tick to keep.
async function resolveGroup(group, keepIdx) {
  for (let i = 0; i < group.length; i++) if (!keepIdx.has(i)) await removeOccurrence(group[i]);
}
