// Shared DOM helpers, icons, letter-tiles, toast, favicon resolution, drag helpers.

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
  tag:      '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  cloud:    '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 .5 8.5H7Z"/>',
  refresh:  '<path d="M20 11a8 8 0 0 0-14-4.5L4 8m0 0V4m0 4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16m0 0v4m0-4h-4"/>',
  note:     '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="m8.5 13 1.7 1.7L14 11"/>',
  check:    '<path d="M4 12.5 9 17.5 20 6.5"/>',
  upload:   '<path d="M12 21V10m0 0 4 4m-4-4-4 4"/><path d="M5 5h14"/>',
  bell:     '<path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8Z"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
};

export function icon(name, size = 15) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
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

export function tile(url, size = 34) {
  const domain = domainOf(url) || '?';
  const h = hueOf(domain);
  const letter = domain.charAt(0).toUpperCase();
  const wrap = el('span', {
    class: 'tile',
    style: `width:${size}px;height:${size}px;background:hsl(${h} 58% 92%);color:hsl(${h} 56% 36%);font-size:${Math.round(size * 0.42)}px`,
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
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const confirmBtn = el('button', { class: `modal-btn confirm${danger ? ' danger' : ''}`, text: confirmLabel });
    const cancelBtn = el('button', { class: 'modal-btn cancel', text: cancelLabel });
    const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Confirm' },
      el('h2', { class: 'modal-title', text: title || 'Are you sure?' }),
      message ? el('p', { class: 'modal-msg', text: message }) : null,
      el('div', { class: 'modal-actions' }, cancelBtn, confirmBtn),
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
