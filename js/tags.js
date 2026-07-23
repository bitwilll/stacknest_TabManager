// Tagging system. Any saved link (collection tab or bookmark) can carry multiple
// tags. Tags are stored once per normalized URL in chrome.storage.local, so the same
// URL shares tags whether it lives in a collection or the Library. The Tags view shows
// a mind-graph (tags as hubs, items linked to them) plus a per-tag sorting grid.

import { el, icon, tile, domainOf, toast, hueOf, matches, normalizeUrl } from './ui.js';
import { getKey, update } from './store.js';
import { loadSpaces, loadWorkspaces } from './spacesStore.js';

export const TAGS_KEY = 'stacknest:tags';

const tagKey = (url) => normalizeUrl(url);
// muted saturation keeps tag dots calm alongside the monochrome chrome
export const tagColor = (name) => `hsl(${hueOf(name.toLowerCase())} 44% 55%)`;

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
export function closeTagEditor() {
  if (!openPopover) return;
  openPopover.remove();
  openPopover = null;
  document.removeEventListener('mousedown', onDocDown, true);
  document.removeEventListener('keydown', onDocKey, true);
  document.removeEventListener('scroll', onDocScroll, true);
  window.removeEventListener('resize', onDocScroll);
}
function onDocDown(e) { if (openPopover && !openPopover.contains(e.target)) closeTagEditor(); }
function onDocKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeTagEditor(); } }
// a fixed-position popover detaches from its anchor when anything scrolls — close it
function onDocScroll(e) { if (openPopover && !openPopover.contains(e.target)) closeTagEditor(); }

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
      el('span', { class: 'tagpop-chip-t', text: t }),
      el('button', { class: 'tagpop-x', title: `Remove ${t}`, 'aria-label': `Remove ${t}`, onclick: () => commit(tags.filter((x) => x !== t)) }, icon('close', 11)),
    )));
    if (!tags.length) chips.append(el('span', { class: 'tagpop-empty', text: 'No tags yet' }));
    place(); // the popover grows/shrinks with its chips — keep it inside the viewport
  }

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

  // Anchor below the button, flipping above only when there's more room there.
  // Re-run after every chip change: the popover grows and must never spill past
  // an edge or cover its own anchor while the user is adding tags.
  // All math happens in visual px (rects/viewport); style writes divide by the
  // interface-size zoom, because lengths inside the zoomed root get multiplied.
  function place() {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, m = 8, gap = 6;
    pop.style.maxHeight = ''; // measure natural size first
    const pr = pop.getBoundingClientRect();
    const w = pr.width, h = pr.height;
    const below = vh - r.bottom - gap - m;    // space under the anchor
    const above = r.top - gap - m;            // space over the anchor
    const openUp = h > below && above > below; // flip only if below can't fit and above is roomier
    const room = Math.max(120, openUp ? above : below);
    if (h > room) pop.style.maxHeight = `${room / zoom}px`; // cap + scroll instead of spilling
    const hFinal = Math.min(h, room);
    const top = openUp ? Math.max(m, r.top - gap - hFinal) : r.bottom + gap;
    const left = Math.min(Math.max(m, r.left), Math.max(m, vw - w - m));
    pop.style.left = `${left / zoom}px`;
    pop.style.top = `${top / zoom}px`;
  }

  document.body.append(pop);
  openPopover = pop;
  renderChips();
  setTimeout(() => input.focus(), 0);
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onDocKey, true);
  document.addEventListener('scroll', onDocScroll, true);
  window.addEventListener('resize', onDocScroll);
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

// Mind-graph camera (pan offset + zoom). Kept at module scope so a background
// re-render (a storage/bookmark event) re-frames to where the user left the
// canvas instead of snapping back to the default view mid-exploration.
let graphView = { tx: 0, ty: 0, s: 1 };
let graphSig = ''; // hub layout the retained camera belongs to
const Z_MIN = 0.45, Z_MAX = 5, Z_STEP = 1.25;

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
  const mk = (name, attrs, ...kids) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); kids.forEach((c) => n.append(c)); return n; };

  // role=group, NOT role=img: img makes the whole subtree presentational, which
  // would prune the focusable tag hubs below out of the accessibility tree
  const svg = mk('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'tag-graph', role: 'group',
    preserveAspectRatio: 'xMidYMid meet',
    'aria-label': 'Tag relationship graph',
  });
  // one group holds all content; pan/zoom is a single transform on it
  const viewport = mk('g', { class: 'tg-viewport' });
  svg.append(viewport);

  // a drag past the threshold is a pan, not a click — this guards the hub/dot
  // click handlers below so panning never accidentally filters or navigates
  let didPan = false;

  // edges
  const edges = mk('g', { class: 'tg-edges' });
  drawn.forEach((it) => { const p = pos.get(it.id); it.tags.forEach((t) => { const h = hub.get(t); edges.append(mk('line', { x1: p.x, y1: p.y, x2: h.x, y2: h.y, stroke: tagColor(t), 'stroke-opacity': '0.28', 'stroke-width': '1' })); }); });
  viewport.append(edges);

  // item dots
  const nodes = mk('g', { class: 'tg-nodes' });
  drawn.forEach((it) => {
    const p = pos.get(it.id);
    const c = mk('circle', { cx: p.x, cy: p.y, r: '4.5', fill: tagColor(it.tags[0]), 'fill-opacity': '0.9', class: 'tg-item' });
    c.append(mk('title', {}, document.createTextNode(`${it.title} — ${it.tags.join(', ')}`)));
    c.addEventListener('click', () => { if (didPan) return; window.location.href = it.url; });
    nodes.append(c);
  });
  viewport.append(nodes);

  // tag hubs (clickable → filter)
  const hubs = mk('g', { class: 'tg-hubs' });
  tags.forEach((t) => {
    const h = hub.get(t.name);
    const g = mk('g', { class: 'tg-hub', tabindex: '0', role: 'button', 'aria-label': `Filter by ${t.name} — ${t.count} link${t.count === 1 ? '' : 's'}` });
    const rad = 11 + Math.min(10, t.count * 1.5);
    g.append(mk('circle', { cx: h.x, cy: h.y, r: String(rad), fill: tagColor(t.name), 'fill-opacity': '0.16', stroke: tagColor(t.name), 'stroke-width': '1.5' }));
    // label under the circle, never across it; long names truncate (tooltip has the full name)
    const label = mk('text', { x: h.x, y: h.y + rad + 13, 'text-anchor': 'middle', class: 'tg-hub-label', fill: tagColor(t.name) });
    label.append(document.createTextNode(t.name.length > 16 ? `${t.name.slice(0, 15)}…` : t.name));
    g.append(label);
    g.append(mk('title', {}, document.createTextNode(`${t.name} · ${t.count} — click to filter`)));
    g.addEventListener('click', () => { if (didPan) return; activeTag = t.name; render(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activeTag = t.name; render(); } });
    hubs.append(g);
  });
  viewport.append(hubs);

  /* ————— pan / zoom camera ————— */
  const wrap = el('div', { class: 'tag-graph-wrap' });

  const applyView = () => viewport.setAttribute('transform', `translate(${graphView.tx} ${graphView.ty}) scale(${graphView.s})`);

  // The retained camera only means anything while the hub layout is unchanged. If a
  // re-render added/removed/moved hubs, restoring the old pan could strand the user
  // on empty canvas looking at content that isn't there any more — re-frame instead.
  const layoutSig = `${W}x${H}|${tags.map((t) => t.name).join(' ')}`;
  if (layoutSig !== graphSig) { graphSig = layoutSig; graphView = { tx: 0, ty: 0, s: 1 }; }
  applyView();

  const hint = el('div', { class: 'tg-hint', 'aria-hidden': 'true' },
    el('span', { text: 'Drag to pan · ' }), el('kbd', { text: '⌘/Ctrl' }), el('span', { text: ' + scroll to zoom' }));

  // map a client (screen) point into SVG user units, accounting for the viewBox
  // fit and any interface-size zoom — both live in the SVG's screen CTM
  const clientToUser = (px, py) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    return { x: inv.a * px + inv.c * py + inv.e, y: inv.b * px + inv.d * py + inv.f };
  };

  let zoomLabel = null, zoomStatus = null;
  const updateLabel = () => {
    const pct = `${Math.round(graphView.s * 100)}%`;
    if (zoomLabel) zoomLabel.textContent = pct;
    if (zoomStatus) zoomStatus.textContent = `Zoom ${pct}`; // spoken by screen readers
  };

  // zoom keeping the point under (px,py) fixed on screen — the "zoom to cursor" feel
  const zoomAt = (px, py, factor) => {
    const s0 = graphView.s;
    const s1 = Math.max(Z_MIN, Math.min(Z_MAX, s0 * factor));
    if (s1 === s0) return;
    const u = clientToUser(px, py);
    graphView.tx = u.x - ((u.x - graphView.tx) / s0) * s1;
    graphView.ty = u.y - ((u.y - graphView.ty) / s0) * s1;
    graphView.s = s1;
    applyView(); updateLabel();
  };
  const zoomCenter = (factor) => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor); };
  const resetView = () => { graphView = { tx: 0, ty: 0, s: 1 }; applyView(); updateLabel(); };

  // A focused hub must never be off-canvas — otherwise tabbing lands on something
  // invisible with no keyboard way to bring it back into frame.
  hubs.querySelectorAll('.tg-hub').forEach((g) => g.addEventListener('focus', () => {
    const sr = svg.getBoundingClientRect(), gr = g.getBoundingClientRect();
    if (gr.right < sr.left || gr.left > sr.right || gr.bottom < sr.top || gr.top > sr.bottom) resetView();
  }));

  // Wheel zooms only while ⌘/Ctrl is held. The canvas is tall and sits directly above
  // the card grid, so swallowing every wheel event would trap the page — the user
  // could never scroll past it. Trackpad pinch already arrives as ctrlKey+wheel, so
  // pinch-to-zoom still works; a plain wheel scrolls the page and flashes the hint.
  let nudgeTimer = null;
  const nudgeHint = () => {
    hint.classList.add('is-nudge');
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => hint.classList.remove('is-nudge'), 1400);
  };
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) { nudgeHint(); return; } // let the page scroll
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  // drag → pan. Pointer capture is taken lazily (only once movement crosses the
  // threshold) so a plain click still reaches the hub/dot handlers underneath.
  let panning = false, startUser = null, start0 = null;
  const endPan = (e) => {
    if (!panning) return;
    panning = false;
    wrap.classList.remove('is-panning');
    try { if (e && e.pointerId != null) svg.releasePointerCapture(e.pointerId); } catch { /* nothing captured */ }
    window.removeEventListener('pointerup', endPan);
    window.removeEventListener('pointercancel', endPan);
  };
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    panning = true; didPan = false;
    startUser = clientToUser(e.clientX, e.clientY);
    start0 = { tx: graphView.tx, ty: graphView.ty };
    // capture is lazy, so a release outside the canvas would otherwise never reach
    // us and the graph would keep panning under a button-less cursor
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!panning) return;
    if (e.buttons === 0) { endPan(e); return; } // released somewhere we never saw
    const u = clientToUser(e.clientX, e.clientY);
    const dx = u.x - startUser.x, dy = u.y - startUser.y;
    if (!didPan && Math.hypot(dx, dy) > 4) { didPan = true; wrap.classList.add('is-panning'); try { svg.setPointerCapture(e.pointerId); } catch { /* capture optional */ } }
    if (didPan) { graphView.tx = start0.tx + dx; graphView.ty = start0.ty + dy; applyView(); }
  });

  // keyboard: arrows pan, +/- zoom, 0 resets (when the canvas holds focus)
  const PAN_KEY = 60; // user units per press
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', 'Tag graph canvas — arrow keys pan, plus and minus zoom, 0 resets the view');
  wrap.addEventListener('keydown', (e) => {
    const pan = (dx, dy) => { graphView.tx += dx; graphView.ty += dy; applyView(); };
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(Z_STEP); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(1 / Z_STEP); }
    else if (e.key === '0') { e.preventDefault(); resetView(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pan(PAN_KEY, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); pan(-PAN_KEY, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pan(0, PAN_KEY); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); pan(0, -PAN_KEY); }
  });

  // on-canvas controls: [−] [zoom %] [+] [fit]
  const cbtn = (aria, on, ...paths) => {
    const b = el('button', { class: 'tg-cbtn', type: 'button', title: aria, 'aria-label': aria });
    b.addEventListener('click', (e) => { e.stopPropagation(); on(); });
    b.append(mk('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ...paths.map((d) => mk('path', { d }))));
    return b;
  };
  zoomLabel = el('span', { class: 'tg-czoom', 'aria-hidden': 'true', text: '100%' });
  // the visible % is decorative; this mirrors it for screen readers
  zoomStatus = el('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const controls = el('div', { class: 'tg-controls', role: 'group', 'aria-label': 'Zoom controls' },
    cbtn('Zoom out', () => zoomCenter(1 / Z_STEP), 'M5 12h14'),
    zoomLabel,
    cbtn('Zoom in', () => zoomCenter(Z_STEP), 'M12 5v14', 'M5 12h14'),
    cbtn('Fit to view', () => resetView(), 'M8 4H5a1 1 0 0 0-1 1v3', 'M16 4h3a1 1 0 0 1 1 1v3', 'M8 20H5a1 1 0 0 1-1-1v-3', 'M16 20h3a1 1 0 0 0 1-1v-3'),
  );
  updateLabel();

  wrap.append(svg, hint, controls, zoomStatus);
  return wrap;
}
