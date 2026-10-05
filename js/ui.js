// Shared DOM helpers, icons, letter-tiles, empty states, the section anatomy (heads, groups), toast, favicon resolution, drag helpers.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  // Every editable field in StackNest holds structured data — collection/space names,
  // URLs, tag slugs — never prose. Turn OFF Chrome's native spellcheck so it stops
  // red-squiggling names/URLs, and so its correction menu can't target a stale word
  // after these frequently-re-rendered inputs are recreated. Callers may opt back in
  // with an explicit spellcheck attr. (The search box already sets spellcheck="false".)
  if ((tag === 'input' || tag === 'textarea') && !node.hasAttribute('spellcheck')) {
    node.setAttribute('spellcheck', 'false');
    node.setAttribute('autocapitalize', 'off');
    node.setAttribute('autocorrect', 'off');
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

// 24-viewBox stroke icons, matching the Stash design language
const ICONS = {
  logo:     '<path d="M7 4h10a1 1 0 0 1 1 1v14l-6-3.4L6 19V5a1 1 0 0 1 1-1Z"/>',
  search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  close:    '<path d="M6 6l12 12M18 6 6 18"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  save:     '<path d="M12 3v10m0 0 3.5-3.5M12 13l-3.5-3.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  archive:  '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  external: '<path d="M15 4h5v5"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  folder:   '<path d="M3 6a1 1 0 0 1 1-1h5l2 2.4h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  rename:   '<path d="M17 3.5 20.5 7 8 19.5 3.5 20.5 4.5 16z"/>',
  sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
  moon:     '<path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/>',
  chevron:  '<path d="m9 6 6 6-6 6"/>',
  window:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>',
  download: '<path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/>',
  grip:     '<path d="M9 5v14M15 5v14"/>',
  undo:     '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a5 5 0 0 1 0 10H9"/>',
  logout:   '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/>',
  lock:     '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  box:      '<path d="M4 7.5 12 3.5l8 4v9L12 20.5 4 16.5Z"/><path d="M4 7.5 12 11.5l8-4"/><path d="M12 11.5v9"/>',
  unlock:   '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/>',
  tag:      '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  cloud:    '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 .5 8.5H7Z"/>',
  refresh:  '<path d="M20 11a8 8 0 0 0-14-4.5L4 8m0 0V4m0 4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16m0 0v4m0-4h-4"/>',
  note:     '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="m8.5 13 1.7 1.7L14 11"/>',
  check:    '<path d="M4 12.5 9 17.5 20 6.5"/>',
  upload:   '<path d="M12 21V10m0 0 4 4m-4-4-4 4"/><path d="M5 5h14"/>',
  bell:     '<path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8Z"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  palette:  '<path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a1.8 1.8 0 0 0-1.2 3.1c.4.5.2 1.4-.6 1.7-.5.2-1.1.2-1.7.2Z"/><circle cx="8" cy="12.5" r="1.1"/><circle cx="9.8" cy="8.6" r="1.1"/><circle cx="14" cy="8" r="1.1"/>',
  help:     '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.8"/><path d="M12 17.2h.01"/>',
  // ——— text formatting ———
  bold:      '<path d="M7.2 5h5.2a3.5 3.5 0 0 1 0 7H7.2z"/><path d="M7.2 12h6.2a3.5 3.5 0 0 1 0 7H7.2z"/>',
  italic:    '<path d="M15 5h-5"/><path d="M14 19H9"/><path d="M13.4 5 10.6 19"/>',
  underline: '<path d="M7 4v6.5a5 5 0 0 0 10 0V4"/><path d="M5.5 20h13"/>',
  strike:    '<path d="M4.5 12h15"/><path d="M8.8 8.2A3.2 3.2 0 0 1 12 5.2h1.2a3.2 3.2 0 0 1 2.9 1.9"/><path d="M8 15.8a3.2 3.2 0 0 0 3.2 3h1.4a3.2 3.2 0 0 0 2.8-1.7"/>',
  textUp:    '<path d="m2.5 18.5 5-12 5 12"/><path d="M4.3 14.6h6.4"/><path d="M17.5 10.5v7"/><path d="M14 14h7"/>',
  textDown:  '<path d="m2.5 18.5 5-12 5 12"/><path d="M4.3 14.6h6.4"/><path d="M14 14h7"/>',
  bullets:   '<circle cx="5" cy="6" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="5" cy="18" r="1.1"/><path d="M10 6h11M10 12h11M10 18h11"/>',
  numbers:   '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  checklist: '<path d="m3 5.5 1.5 1.5L7.4 4"/><path d="m3 12.5 1.5 1.5L7.4 11"/><path d="m3 19.5 1.5 1.5L7.4 18"/><path d="M11 6h10M11 13h10M11 20h10"/>',
  person:   '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  swap:     '<path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5"/><path d="M20 16H7m0 0 3.5 3.5M7 16l3.5-3.5"/>',
};

export function icon(name, size = 15) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic');   // the stroke default lives in css (:where(svg.ic)), so no context can paint a black blob
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

export function actionBtn(name, label, onclick, extraClass = '') {
  const btn = el('button', { class: `icb ${extraClass}`, title: label, 'aria-label': label });
  btn.append(icon(name, 14));
  btn.addEventListener('click', (e) => { e.stopPropagation(); onclick(e, btn); });
  return btn;
}

// ——— letter tile: pastel plate derived from the domain, favicon layered on top ———

export function hueOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function domainOf(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h || url.split(':')[0];
  } catch {
    return '';
  }
}

/* ——— the fallback letter's contrast, solved rather than assumed ———
   The plate is hsl(h 58% 92%) and the letter used to be a flat hsl(h 56% 36%). HSL
   lightness is not perceptual, so that one number meant very different contrast per hue:
   measured, a yellow-ish domain landed at 3.5:1 and a blue one at 4.28:1 — both under AA
   for a glyph that is the only thing identifying a site with no favicon. Darken the letter
   until it actually clears 4.5:1 against its own plate. Memoised: there are only 360 hues. */
const PLATE_S = 58, PLATE_L = 92, LETTER_S = 56;
const letterLightness = new Map();

// Rounded to 8-bit, because that is what the engine paints: solving in float and
// letting hsl() round afterwards left hue 41 at 4.494:1, just under the line.
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}
function relLum([r, g, b]) {
  const c = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function solveLetterL(h) {
  if (letterLightness.has(h)) return letterLightness.get(h);
  const plate = relLum(hslToRgb(h, PLATE_S, PLATE_L)) + 0.05;
  let l = 36;
  // walk down in 1% steps to 4.55 — a little over the floor, so nothing lands on the line
  while (l > 10 && plate / (relLum(hslToRgb(h, LETTER_S, l)) + 0.05) < 4.55) l -= 1;
  letterLightness.set(h, l);
  return l;
}

export function tile(url, size = 34) {
  const domain = domainOf(url) || '?';
  const h = hueOf(domain);
  const letter = domain.charAt(0).toUpperCase();
  const wrap = el('span', {
    class: 'tile',
    style: `width:${size}px;height:${size}px;background:hsl(${h} ${PLATE_S}% ${PLATE_L}%);color:hsl(${h} ${LETTER_S}% ${solveLetterL(h)}%);font-size:${Math.round(size * 0.42)}px`,
  }, el('span', { class: 'tile-letter', text: letter }));
  const img = el('img', {
    src: faviconUrl(url, 64),
    width: Math.round(size * 0.56),
    height: Math.round(size * 0.56),
    alt: '',
    loading: 'lazy',
  });
  img.addEventListener('error', () => img.remove());
  wrap.append(img);
  return wrap;
}

// One empty-state block for every view: an icon tile, a title, a plain-language hint and
// optional actions — so "nothing here yet" looks the same on the board, in the Library,
// under Tags/Duplicates and in Notes, and always says what to do next.
// variant: null | 'gate' (framed bento: hatched mark left, text + one primary right —
// locked/permission states). caption: mono line above the title. steps: numbered mono
// how-to lines. Order is fixed: caption, title, steps, hint, actions.
export function emptyState({ icon: name, title, hint = null, steps = null, actions = [], variant = null, caption = null } = {}) {
  const text = [
    caption ? el('div', { class: 'empty-cap', text: caption }) : null,
    el('div', { class: 'empty-title', text: title }),
    steps ? el('ol', { class: 'empty-steps' }, ...steps.map((s) => el('li', {}, s))) : null,
    hint ? el('p', { class: 'empty-hint' }, ...[].concat(hint)) : null,
    actions.length ? el('div', { class: 'empty-acts' }, ...actions) : null,
  ];
  return el('div', { class: `empty${variant ? ` is-${variant}` : ''}` },
    el('span', { class: 'empty-ic', 'aria-hidden': 'true' }, icon(name || 'folder', variant === 'gate' ? 26 : 20)),
    variant === 'gate' ? el('div', { class: 'empty-body' }, text) : text);
}

/* ————— THE SECTION ————— one anatomy for every view (see css "THE SECTION") ————— */

export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const clearSearchBox = () => document.getElementById('search-clear')?.click();   // = app.js clearSearch + refocus

function matchChip({ q, shown = null, total = null, unit = '' }) {
  const tail = total == null ? '' : ` · ${shown} of ${total}${unit ? ` ${unit}` : ''}`;
  return el('span', { class: 'sec-match' },
    el('span', { text: `matching “${q}”${tail}` }),
    el('button', { class: 'icb', type: 'button', title: 'Clear search', 'aria-label': 'Clear search', onclick: clearSearchBox }, icon('close', 12)));
}

// The STATE part of a head. scope {key, value, swatch?, tone?:'state'|'danger'} · stats [{n, unit, tone?}]
// (stats[0] is the same number as the view's sidebar badge) · match {q, shown?, total?, unit?}.
// Pass `host` to refill an existing node (the board's static head, Notes' persistent shell).
export function secState({ scope = null, stats = [], match = null } = {}, host = el('p', { class: 'sec-state' })) {
  // replaceChildren, unlike el(), turns null into the text "null" — so absent parts are filtered out
  host.replaceChildren(...[
    scope ? el('span', { class: 'sec-scope' },
      el('span', { class: 'sec-scope-k', text: scope.key }),
      el('span', { class: `sec-scope-v${scope.tone ? ` is-${scope.tone}` : ''}`, title: scope.value },
        scope.swatch ? el('span', { class: 'sec-swatch', style: `background:${scope.swatch}`, 'aria-hidden': 'true' }) : null,
        el('span', { class: 'sec-scope-t', text: scope.value }))) : null,
    ...stats.map((s) => el('span', { class: 'sec-stat' },
      el('span', { class: `sec-num${s.tone ? ` is-${s.tone}` : ''}`, text: String(s.n) }),
      el('span', { class: 'sec-unit', text: s.unit }))),
    match?.q ? matchChip(match) : null,
  ].filter(Boolean));
  return host;
}

// The head. tools: quiet controls (segments, .icb circles, .soft/.ghosty pills — each .btnx with an icon).
// primary: the ONE .btnx.primary (create / commit), always last; primaryNote: its scope in mono under it.
// trail: a row above the head (Library path). bar: a row below it (Notes quick-add).
export function sectionHead({ trail = null, scope = null, stats = [], match = null, note = null,
  tools = [], primary = null, primaryNote = null, bar = null, className = '' } = {}) {
  const state = secState({ scope, stats, match });
  const noteEl = el('p', { class: 'sec-note' }, ...[].concat(note ?? []));
  noteEl.hidden = !note;
  const toolEls = tools.filter(Boolean);
  const toolsEl = (toolEls.length || primary) ? el('div', { class: 'sec-tools' }, ...toolEls,
    primary ? el('div', { class: 'sec-next' }, primary,
      primaryNote ? el('span', { class: 'sec-next-note', text: primaryNote }) : null) : null) : null;
  // a head pill folds to an icon-only circle when the panel is narrow (css: .sec-tools .btnx:not(.primary));
  // its label stays the accessible name, and a title gives sighted mouse users the same words
  for (const b of toolsEl ? toolsEl.querySelectorAll('.btnx:not(.primary)') : []) if (!b.title) b.title = b.textContent.trim();
  const top = el('div', { class: `sec-top ${className}`.trim() }, trail, el('header', { class: 'sec-head' }, state, noteEl, toolsEl), bar);
  top._state = state;
  top._note = noteEl;
  headSizes.observe(top);
  return top;
}
// The sticky head's live height, published on its view as --sec-top-h: the view's scroll-padding
// uses it so a focused card is never left hidden under the head (css: THE SECTION).
// offsetHeight is unzoomed CSS px, which is what the custom property needs.
const headSizes = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    if (!target.isConnected) { headSizes.unobserve(target); continue; }
    target.closest('.view')?.style.setProperty('--sec-top-h', `${target.offsetHeight}px`);
  }
});
export function setSecNote(top, note) {
  top._note.replaceChildren(...[].concat(note ?? []));
  top._note.hidden = !note;
}

// A captioned sub-section: "caption  n ———————— aside  acts". User names pass data:true (keep case).
let capSeq = 0;
export function secGroup({ caption, count = null, data = false, glyph = null, swatch = null, aside = null,
  acts = null, level = 2, className = '' }, ...content) {
  const id = `sec-cap-${++capSeq}`;
  return el('section', { class: `sec-group ${className}`.trim(), 'aria-labelledby': id },
    el('div', { class: 'sec-cap' },
      el(`h${level}`, { class: 'sec-cap-h', id },
        el('span', { class: `sec-cap-t${data ? ' is-data' : ''}` },
          glyph ? icon(glyph, 14) : null,
          swatch ? el('span', { class: 'tag-dot', style: `background:${swatch}`, 'aria-hidden': 'true' }) : null,
          el('span', { class: 'sec-cap-tt', text: caption, title: caption })),   // a long folder name truncates; the title keeps it readable
        count == null ? null : el('span', { class: 'sec-cap-n', text: String(count) })),
      aside ? el('span', { class: 'sec-cap-aside' }, ...[].concat(aside)) : null,
      acts ? el('span', { class: 'sec-cap-acts' }, ...[].concat(acts)) : null),
    ...content);
}

// The one no-match state for every searchable view.
export function noMatch(q, hint = 'Search looks at titles and addresses.') {
  return emptyState({ icon: 'search', title: `Nothing here matches “${q}”`, hint,
    actions: [el('button', { class: 'btnx soft', type: 'button', onclick: clearSearchBox }, icon('close', 14), el('span', { text: 'Clear search' }))] });
}

// Open a view (same click the sidebar row gets) and, optionally, land on a sub-section such as a Settings plate.
export function goTo(view, anchorId = null) {
  document.querySelector(`.view-link[data-view="${view}"]`)?.click();
  requestAnimationFrame(() => {
    const t = anchorId && document.getElementById(anchorId);
    if (t) {
      t.scrollIntoView({ block: 'start' });
      t.querySelector('h2, h3')?.focus({ preventScroll: true });
      return;
    }
    // the button that called goTo sits in the view just hidden, so focus would fall to <body>:
    // land it on the new view's title instead
    const title = document.getElementById('view-title');
    if (title) { if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  });
}

// Where an open tab can be dragged from right now, for empty-state copy.
export function tabSourceHint() {
  const mode = document.documentElement.dataset.tabsbar;
  if (mode === 'top' || (mode === 'side' && matchMedia('(max-width: 880px)').matches)) return 'the live strip above';
  if (mode === 'side') return 'the tab rail on the left';
  return 'a window in the sidebar';
}

let toastTimer;
export function toast(message) {
  const node = document.getElementById('toast');
  node.hidden = false;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2400);
}

export function faviconUrl(pageUrl, size = 32) {
  try {
    if (chrome?.runtime?.getURL && chrome.runtime.id) {
      const u = new URL(chrome.runtime.getURL('/_favicon/'));
      u.searchParams.set('pageUrl', pageUrl);
      u.searchParams.set('size', String(size));
      return u.toString();
    }
  } catch { /* fall through to public resolver (mock/dev mode only) */ }
  try {
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${new URL(pageUrl).hostname}`;
  } catch {
    return '';
  }
}

export function shortDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// True when the view section hosting `node` is hidden. Views re-render on open (app.js
// refreshView), so a hidden view can skip its DOM work and keep only its nav badge live.
export function viewHidden(node) {
  const view = node?.closest?.('.view');
  return !!(view && view.hidden);
}

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function matches(query, ...fields) {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => (f || '').toLowerCase().includes(q));
}

export function addDropTarget(node, mime, onDrop) {
  node.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes(mime)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    node.classList.add('drop-target');
  });
  node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
  node.addEventListener('drop', async (e) => {
    if (![...e.dataTransfer.types].includes(mime)) return;
    e.preventDefault();
    e.stopPropagation();
    node.classList.remove('drop-target');
    try {
      await onDrop(JSON.parse(e.dataTransfer.getData(mime)));
    } catch (err) {
      console.warn('drop failed', err);
    }
  });
}

// Canonical form of a URL for duplicate detection. Drops the fragment, a trailing
// slash and `www.`, and lowercases only the (case-insensitive) scheme + host — the
// port is kept (`url.host`), and path/query keep their case since those can be
// case-sensitive (e.g. youtube ?v=IDs, doc ids, share tokens).
export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    const host = url.host.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol.toLowerCase()}//${host}${path}${url.search}`;
  } catch {
    return String(u || '').trim().replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

// Open the OS file picker and resolve with the chosen File (or null if cancelled).
export function pickFile(accept = '') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, style: 'position:fixed;left:-9999px' });
    let settled = false;
    const finish = (f) => { if (settled) return; settled = true; input.remove(); resolve(f); };
    input.addEventListener('change', () => finish(input.files?.[0] || null));
    // fallback if the dialog is dismissed without a change event
    window.addEventListener('focus', () => setTimeout(() => finish(input.files?.[0] || null), 400), { once: true });
    document.body.append(input);
    input.click();
  });
}

// Promise-based confirm dialog styled to the app. Resolves true (confirm) / false (cancel).
// `extra` is an optional node dropped between the message and the buttons — for a choice
// that belongs to the decision itself (e.g. "also revoke access" on sign-out) rather than
// to a settings row you would have had to visit beforehand.
// `alert: true` is a notice, not a decision: one neutral button (confirmLabel) and role=alertdialog.
export function confirmDialog({ title, message, extra = null, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, alert = false } = {}) {
  return new Promise((resolve) => {
    const confirmBtn = el('button', { class: `modal-btn ${alert ? 'cancel' : `confirm${danger ? ' danger' : ''}`}`, text: confirmLabel });
    const cancelBtn = el('button', { class: 'modal-btn cancel', text: cancelLabel });
    const modal = el('div', { class: 'modal', role: alert ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Confirm' },
      el('h2', { class: 'modal-title', text: title || 'Are you sure?' }),
      message ? el('p', { class: 'modal-msg', text: message }) : null,
      extra,
      el('div', { class: 'modal-actions' }, alert ? null : cancelBtn, confirmBtn),
    );
    const scrim = el('div', { class: 'modal-scrim' }, modal);
    let done = false;
    const close = (val) => {
      if (done) return;
      done = true;
      scrim.classList.remove('show');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => scrim.remove(), 200);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(true); }
    };
    confirmBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(scrim);
    requestAnimationFrame(() => { scrim.classList.add('show'); confirmBtn.focus(); });
  });
}

// Trigger a client-side file download of `text`.
export function exportDownload(filename, text, mime = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
