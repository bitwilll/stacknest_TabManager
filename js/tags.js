// Tagging system. Any saved link (collection tab or bookmark) can carry multiple
// tags. Tags are stored once per normalized URL in chrome.storage.local, so the same
// URL shares tags whether it lives in a collection or the Library. The Tags view shows
// a mind-graph (tags as hubs, items linked to them) plus a per-tag sorting grid.

import { el, icon, tile, domainOf, toast, hueOf, matches, normalizeUrl } from './ui.js';
import { getKey, update } from './store.js';
import { loadSpaces, loadWorkspaces } from './spacesStore.js';

export const TAGS_KEY = 'stacknest:tags';

const tagKey = (url) => normalizeUrl(url);
export const tagColor = (name) => `hsl(${hueOf(name.toLowerCase())} 62% 52%)`;

function dedupe(tags) {
  const seen = new Set();
  const out = [];
  for (let t of tags) {
    t = String(t || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    const low = t.toLowerCase();
    if (t && !seen.has(low)) { seen.add(low); out.push(t); }
  }
  return out.slice(0, 12);
}

export async function loadTags() {
  const m = await getKey(TAGS_KEY, {});
  return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
}

export function tagsOf(map, url) {
  return map[tagKey(url)]?.tags || [];
}

export async function setTagsFor(url, title, tags) {
  const clean = dedupe(tags);
  await update(TAGS_KEY, {}, (m) => {
    const k = tagKey(url);
    if (!clean.length) delete m[k];
    else m[k] = { url, title: title || m[k]?.title || url, tags: clean };
    return m;
  });
}

/* ————————————————————————— inline tag editor popover ————————————————————————— */

let openPopover = null;
export function closeTagEditor() { if (openPopover) { openPopover.remove(); openPopover = null; document.removeEventListener('mousedown', onDocDown, true); document.removeEventListener('keydown', onDocKey, true); } }
function onDocDown(e) { if (openPopover && !openPopover.contains(e.target)) closeTagEditor(); }
function onDocKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeTagEditor(); } }

export async function openTagEditor(anchor, { url, title }) {
  closeTagEditor();
  const map = await loadTags();
  let tags = [...tagsOf(map, url)];
  const known = [...new Set(Object.values(map).flatMap((r) => r.tags))].sort();

  const chips = el('div', { class: 'tagpop-chips' });
  const input = el('input', { class: 'tagpop-input', placeholder: 'Add tag…', 'aria-label': 'Add a tag', list: 'tagpop-known' });
  const datalist = el('datalist', { id: 'tagpop-known' }, ...known.map((t) => el('option', { value: t })));

  const commit = async (next) => { tags = dedupe(next); await setTagsFor(url, title, tags); renderChips(); };
  function renderChips() {
    chips.replaceChildren(...tags.map((t) => el('span', { class: 'tagpop-chip', style: `--tc:${tagColor(t)}` },
      el('span', { class: 'tag-dot', style: `background:${tagColor(t)}` }),
      el('span', { text: t }),
      el('button', { class: 'tagpop-x', title: `Remove ${t}`, 'aria-label': `Remove ${t}`, onclick: () => commit(tags.filter((x) => x !== t)) }, icon('close', 11)),
    )));
    if (!tags.length) chips.append(el('span', { class: 'tagpop-empty', text: 'No tags yet' }));
  }
  renderChips();

  const add = () => { const v = input.value.trim(); if (!v) return; input.value = ''; commit([...tags, ...v.split(',')]); };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Escape') closeTagEditor();
  });

  const pop = el('div', { class: 'tagpop', role: 'dialog', 'aria-label': 'Edit tags' },
    el('div', { class: 'tagpop-h', text: 'Tags' }), chips,
    el('div', { class: 'tagpop-add' }, input, datalist),
    el('div', { class: 'tagpop-hint', text: 'Enter or comma to add · Esc to close' }),
  );
  pop.addEventListener('mousedown', (e) => e.stopPropagation());
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.body.append(pop);
  openPopover = pop;

  // position under the anchor, kept within the viewport
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 10);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  pop.style.left = `${Math.max(8, left)}px`;
  pop.style.top = `${top}px`;
  setTimeout(() => input.focus(), 0);
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onDocKey, true);
}

// Small inline chip row for a card (display only). Returns null if untagged.
export function tagChips(map, url, max = 3) {
  const tags = tagsOf(map, url);
  if (!tags.length) return null;
  const wrap = el('span', { class: 'card-tags' });
  tags.slice(0, max).forEach((t) => wrap.append(el('span', { class: 'card-tag', title: t },
    el('span', { class: 'tag-dot', style: `background:${tagColor(t)}` }), t)));
  if (tags.length > max) wrap.append(el('span', { class: 'card-tag more', text: `+${tags.length - max}` }));
  return wrap;
}

/* ————————————————————————— Tags view (graph + grid) ————————————————————————— */

let root, getQuery, countEl, jumpToUrl;
let activeTag = null; // null = overview (graph)

export function initTags(options) {
  ({ root, getQuery, countEl, jumpToUrl } = options);
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && (c[TAGS_KEY] || c['stacknest:spaces'])) render(); });
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) chrome.bookmarks[ev]?.addListener(render);
  render();
  return { render };
}

// One node per unique tagged URL, joined with where it lives (for click-through).
async function gatherItems(map) {
  const byKey = new Map();
  const add = (url, title) => {
    const k = tagKey(url);
    const rec = map[k];
    if (!rec || !rec.tags.length) return;
    if (!byKey.has(k)) byKey.set(k, { id: k, url, title: title || rec.title || url, tags: rec.tags });
  };
  const collections = await loadSpaces();
  for (const c of collections) for (const t of c.tabs || []) if (t.url) add(t.url, t.title);
  try {
    const [tree] = await chrome.bookmarks.getTree();
    const walk = (n) => { for (const ch of n.children || []) { if (ch.url) add(ch.url, ch.title); else walk(ch); } };
    walk(tree);
  } catch { /* ignore */ }
  // include tagged URLs whose source link no longer exists (tags are first-class)
  for (const k in map) if (map[k].tags.length && !byKey.has(k)) byKey.set(k, { id: k, url: map[k].url, title: map[k].title, tags: map[k].tags });
  return [...byKey.values()];
}

export async function render() {
  const map = await loadTags();
  const items = await gatherItems(map);

  const counts = new Map();
  for (const it of items) for (const t of it.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const tagList = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  if (countEl) countEl.textContent = tagList.length ? String(tagList.length) : '';
  if (activeTag && !counts.has(activeTag)) activeTag = null;

  const frag = document.createDocumentFragment();

  if (!tagList.length) {
    frag.append(el('div', { class: 'lib-empty' },
      'No tags yet. Open the ', el('strong', {}, 'tag'), ' action on any saved link or bookmark to start tagging.'));
    root.replaceChildren(frag);
    return;
  }

  // filter bar
  const bar = el('div', { class: 'tag-filterbar' });
  bar.append(chip('All', items.length, activeTag === null, () => { activeTag = null; render(); }, null));
  for (const t of tagList) bar.append(chip(t.name, t.count, activeTag === t.name, () => { activeTag = t.name; render(); }, tagColor(t.name)));
  frag.append(bar);

  if (activeTag === null) {
    frag.append(buildGraph(tagList, items));
    frag.append(el('h3', { class: 'tag-section-h', text: 'All tagged links' }));
    frag.append(itemGrid(items, getQuery()));
  } else {
    const subset = items.filter((it) => it.tags.includes(activeTag));
    frag.append(el('h3', { class: 'tag-section-h' },
      el('span', { class: 'tag-dot lg', style: `background:${tagColor(activeTag)}` }),
      `${activeTag} · ${subset.length} link${subset.length === 1 ? '' : 's'}`));
    frag.append(itemGrid(subset, getQuery()));
  }

  root.replaceChildren(frag);
}

function chip(label, count, active, onClick, color) {
  return el('button', { class: `tag-chip${active ? ' is-active' : ''}`, onclick: onClick },
    color ? el('span', { class: 'tag-dot', style: `background:${color}` }) : null,
    el('span', { text: label }),
    el('span', { class: 'tag-chip-n', text: String(count) }),
  );
}

function itemGrid(items, q) {
  const shown = q ? items.filter((it) => matches(q, it.title, it.url) || it.tags.some((t) => matches(q, t))) : items;
  if (!shown.length) return el('div', { class: 'lib-empty' }, 'Nothing here matches your search.');
  const grid = el('div', { class: 'bm-grid' });
  for (const it of shown) {
    const card = el('div', { class: 'tcard bmcard', role: 'link', tabindex: '0', title: it.url });
    card.append(
      tile(it.url, 40),
      el('span', { class: 'meta' },
        el('span', { class: 'title', text: it.title }),
        el('span', { class: 'domain', text: domainOf(it.url) || it.url }),
        el('span', { class: 'card-tags' }, ...it.tags.map((t) => el('span', { class: 'card-tag', title: t },
          el('span', { class: 'tag-dot', style: `background:${tagColor(t)}` }), t))),
      ),
    );
    const open = (e) => { if (e.metaKey || e.ctrlKey) chrome.tabs.create({ url: it.url, active: false }); else window.location.href = it.url; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    grid.append(card);
  }
  return grid;
}

// Deterministic clustered node-link graph (no randomness): tags on a ring, items
// clustered around their tag(s), edges item→tag.
function buildGraph(tagList, items) {
  const W = 860, H = 460, cx = W / 2, cy = H / 2;
  const tags = tagList.slice(0, 14); // keep the hub ring legible
  const names = new Set(tags.map((t) => t.name));
  const R = Math.min(W, H) * 0.36;
  const hub = new Map();
  tags.forEach((t, i) => {
    const a = (2 * Math.PI * i) / tags.length - Math.PI / 2;
    hub.set(t.name, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a, ...t });
  });

  const drawn = items.map((it) => ({ ...it, tags: it.tags.filter((t) => names.has(t)) })).filter((it) => it.tags.length);
  const singleByTag = new Map();
  drawn.forEach((it) => { if (it.tags.length === 1) { const arr = singleByTag.get(it.tags[0]) || []; arr.push(it); singleByTag.set(it.tags[0], arr); } });
  const pos = new Map();
  drawn.forEach((it) => {
    if (it.tags.length === 1) {
      const h = hub.get(it.tags[0]);
      const arr = singleByTag.get(it.tags[0]); const k = arr.indexOf(it); const n = arr.length;
      const spread = Math.min(Math.PI * 0.95, 0.4 + n * 0.14);
      const a = h.a + (n === 1 ? 0 : spread * (k / (n - 1) - 0.5));
      const r = R * 0.4 + (k % 3) * 15;
      pos.set(it.id, { x: h.x + r * Math.cos(a), y: h.y + r * Math.sin(a) });
    } else {
      let sx = 0, sy = 0; it.tags.forEach((t) => { const h = hub.get(t); sx += h.x; sy += h.y; });
      const m = it.tags.length;
      pos.set(it.id, { x: (sx / m) * 0.8 + cx * 0.2, y: (sy / m) * 0.8 + cy * 0.2 });
    }
  });

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'tag-graph');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Tag relationship graph');
  const mk = (name, attrs, ...kids) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); kids.forEach((c) => n.append(c)); return n; };

  // edges
  const edges = mk('g', { class: 'tg-edges' });
  drawn.forEach((it) => { const p = pos.get(it.id); it.tags.forEach((t) => { const h = hub.get(t); edges.append(mk('line', { x1: p.x, y1: p.y, x2: h.x, y2: h.y, stroke: tagColor(t), 'stroke-opacity': '0.28', 'stroke-width': '1' })); }); });
  svg.append(edges);

  // item dots
  const nodes = mk('g', { class: 'tg-nodes' });
  drawn.forEach((it) => {
    const p = pos.get(it.id);
    const c = mk('circle', { cx: p.x, cy: p.y, r: '4.5', fill: tagColor(it.tags[0]), 'fill-opacity': '0.9', class: 'tg-item' });
    c.append(mk('title', {}, document.createTextNode(`${it.title} — ${it.tags.join(', ')}`)));
    c.addEventListener('click', () => { window.location.href = it.url; });
    nodes.append(c);
  });
  svg.append(nodes);

  // tag hubs (clickable → filter)
  const hubs = mk('g', { class: 'tg-hubs' });
  tags.forEach((t) => {
    const h = hub.get(t.name);
    const g = mk('g', { class: 'tg-hub', tabindex: '0', role: 'button' });
    g.append(mk('circle', { cx: h.x, cy: h.y, r: String(11 + Math.min(10, t.count * 1.5)), fill: tagColor(t.name), 'fill-opacity': '0.16', stroke: tagColor(t.name), 'stroke-width': '1.5' }));
    const label = mk('text', { x: h.x, y: h.y + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'tg-hub-label', fill: tagColor(t.name) });
    label.append(document.createTextNode(t.name));
    g.append(label);
    g.append(mk('title', {}, document.createTextNode(`${t.name} · ${t.count}`)));
    g.addEventListener('click', () => { activeTag = t.name; render(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { activeTag = t.name; render(); } });
    hubs.append(g);
  });
  svg.append(hubs);

  return el('div', { class: 'tag-graph-wrap' }, svg);
}
