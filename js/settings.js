// Settings: typography (interface font, mono font, interface size) + backup panel.
// Fonts are offline-safe stacks (bundled + system) so nothing hits the network.

import { el, icon, toast } from './ui.js';
import { getKey, update } from './store.js';
import { exportBackup, importFlow } from './backup.js';
import { CLOUD_KEY, loadCloudState, connect, disconnect, backupNow, restoreLatest, isLive } from './drive.js';
import { confirmDialog } from './ui.js';

export const SETTINGS_KEY = 'stacknest:settings';

export const FONT_UI = [
  { id: 'hanken', label: 'Hanken Grotesk', stack: "'Hanken Grotesk', system-ui, sans-serif" },
  { id: 'system', label: 'System UI', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'helvetica', label: 'Helvetica Neue', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'georgia', label: 'Georgia (serif)', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, Tahoma, sans-serif' },
];

export const FONT_MONO = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'system', label: 'System Mono', stack: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { id: 'menlo', label: 'Menlo', stack: 'Menlo, Monaco, monospace' },
  { id: 'consolas', label: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
  { id: 'courier', label: 'Courier', stack: "'Courier New', Courier, monospace" },
];

export const SCALES = [
  { id: 'compact', label: 'Compact', zoom: 0.9 },
  { id: 'default', label: 'Default', zoom: 1 },
  { id: 'comfortable', label: 'Comfortable', zoom: 1.08 },
  { id: 'large', label: 'Large', zoom: 1.2 },
];

// — market ticker options (used here + by ticker.js) —
export const TICKER_BASES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CNY'];
export const TICKER_CRYPTOS = [
  { id: 'bitcoin', sym: 'BTC' }, { id: 'ethereum', sym: 'ETH' }, { id: 'solana', sym: 'SOL' },
  { id: 'binancecoin', sym: 'BNB' }, { id: 'ripple', sym: 'XRP' }, { id: 'cardano', sym: 'ADA' },
  { id: 'dogecoin', sym: 'DOGE' }, { id: 'polkadot', sym: 'DOT' },
];
export const TICKER_FX = ['EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CNY', 'CHF'];

export const DEFAULT_SETTINGS = {
  fontUi: 'hanken', fontMono: 'jetbrains', scale: 'default',
  tickerEnabled: false, tickerBase: 'USD',
  tickerCrypto: ['bitcoin', 'ethereum', 'solana'], tickerFx: ['EUR', 'GBP'],
};

const pick = (list, id) => list.find((x) => x.id === id) || list[0];

const validId = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);
const validArr = (allowed, arr, fallback) => (Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : fallback);

export async function loadSettings() {
  const s = await getKey(SETTINGS_KEY, null);
  const m = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  // sanitize unknown ids (corrupt / older / hand-edited backup) to the DEFAULTS, not list[0]
  return {
    fontUi: validId(FONT_UI, m.fontUi, DEFAULT_SETTINGS.fontUi),
    fontMono: validId(FONT_MONO, m.fontMono, DEFAULT_SETTINGS.fontMono),
    scale: validId(SCALES, m.scale, DEFAULT_SETTINGS.scale),
    tickerEnabled: !!m.tickerEnabled,
    tickerBase: TICKER_BASES.includes(m.tickerBase) ? m.tickerBase : DEFAULT_SETTINGS.tickerBase,
    tickerCrypto: validArr(TICKER_CRYPTOS.map((c) => c.id), m.tickerCrypto, DEFAULT_SETTINGS.tickerCrypto),
    tickerFx: validArr(TICKER_FX, m.tickerFx, DEFAULT_SETTINGS.tickerFx),
  };
}

export async function saveSettings(patch) {
  let next;
  await update(SETTINGS_KEY, DEFAULT_SETTINGS, (cur) => {
    next = { ...DEFAULT_SETTINGS, ...(cur || {}), ...patch };
    return next;
  });
  applySettings(next);
  return next;
}

// Push settings into the live DOM: font stacks onto the CSS vars, size via zoom.
export function applySettings(s) {
  const root = document.documentElement;
  root.style.setProperty('--grot', pick(FONT_UI, s.fontUi).stack);
  root.style.setProperty('--mono', pick(FONT_MONO, s.fontMono).stack);
  root.style.zoom = String(pick(SCALES, s.scale).zoom);
}

/* ————————————————————————— settings view ————————————————————————— */

let root;
let includeBookmarks = false; // export choice; survives settings-view re-renders

export function initSettings(options) {
  ({ root } = options);
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && (c[SETTINGS_KEY] || c[CLOUD_KEY])) render(); });
  render();
  return { render };
}

function shortWhen(iso) {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return 'recently'; }
}

async function cloudCard() {
  const cloud = await loadCloudState();
  const connected = !!cloud.email;
  const card = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h' }, icon('cloud', 16), 'Cloud sync'),
    el('p', { class: 'set-sub', text: 'Back up your spaces, collections and settings to your own Google Drive and restore them on any machine. The backup lives in a private app folder only StackNest can read — it never appears in your Drive.' }),
  );

  const gdrive = el('div', { class: 'cloud-provider' });
  if (!connected) {
    gdrive.append(
      el('div', { class: 'cloud-row' },
        el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot g' }), 'Google Drive'),
        el('button', { class: 'btnx primary', onclick: withBusy(async () => { await connect(); toast('Google Drive connected'); }) }, el('span', { text: 'Connect' })),
      ),
    );
  } else {
    gdrive.append(
      el('div', { class: 'cloud-row' },
        el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot g' }), el('span', { class: 'cloud-acct', text: cloud.email })),
        el('button', { class: 'btnx ghosty', onclick: withBusy(async () => { await disconnect(); toast('Disconnected'); }) }, el('span', { text: 'Disconnect' })),
      ),
      el('div', { class: 'cloud-meta', text: `Last backup ${shortWhen(cloud.lastBackupAt)} · last restore ${shortWhen(cloud.lastRestoreAt)}` }),
      el('div', { class: 'set-actions' },
        el('button', { class: 'btnx primary', onclick: withBusy(async () => { const r = await backupNow(includeBookmarks); toast(`Backed up ${r.collections} collection${r.collections === 1 ? '' : 's'}${r.bookmarks ? ' + bookmarks' : ''} to Drive`); }) }, el('span', { text: 'Back up now' })),
        el('button', { class: 'btnx soft', onclick: withBusy(async () => {
          const ok = await confirmDialog({ title: 'Restore from Drive?', message: 'This replaces your current spaces, collections and settings with the latest cloud backup.', confirmLabel: 'Restore', danger: true });
          if (!ok) return;
          const r = await restoreLatest(); toast(`Restored ${r.collections} collection${r.collections === 1 ? '' : 's'} from Drive`);
        }) }, el('span', { text: 'Restore latest' })),
      ),
    );
  }
  card.append(gdrive);

  if (!isLive()) {
    card.append(el('p', { class: 'set-note', text: 'Preview mode: Google sign-in and Drive aren’t available outside the packaged extension, so this simulates the cloud locally. In the real extension it uses your Google account.' }));
  }

  // StackNest Cloud (Pro) — needs a hosted backend; placeholder for now
  card.append(el('div', { class: 'cloud-provider is-soon' },
    el('div', { class: 'cloud-row' },
      el('span', { class: 'cloud-name' }, el('span', { class: 'cloud-dot pro' }), 'StackNest Cloud', el('span', { class: 'cloud-badge', text: 'PRO' })),
      el('button', { class: 'btnx soft', disabled: 'true' }, el('span', { text: 'Coming soon' })),
    ),
    el('div', { class: 'cloud-meta', text: 'Managed cross-device sync on stacknest.com — a subscription tier arriving later.' }),
  ));

  return card;
}

async function tickerCard() {
  const s = await loadSettings();
  const card = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h' }, icon('refresh', 15), 'Market ticker'),
    el('p', { class: 'set-sub', text: 'Show a live crypto + forex marquee beside the search bar. Prices come from CoinGecko and open.er-api.com — turning this on makes network requests to those services.' }),
  );

  const enable = el('input', { type: 'checkbox', class: 'set-check' });
  enable.checked = s.tickerEnabled;
  enable.addEventListener('change', () => saveSettings({ tickerEnabled: enable.checked }).then(() => toast(enable.checked ? 'Ticker enabled' : 'Ticker off')));
  card.append(el('label', { class: 'set-toggle' }, enable, el('span', {}, 'Enable market ticker')));

  const baseSel = el('select', { class: 'set-select', 'aria-label': 'Reference currency' });
  for (const c of TICKER_BASES) { const o = el('option', { value: c, text: c }); if (c === s.tickerBase) o.selected = true; baseSel.append(o); }
  baseSel.addEventListener('change', () => saveSettings({ tickerBase: baseSel.value }).then(() => toast(`Quoted in ${baseSel.value}`)));
  card.append(el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' }, el('div', { class: 'set-label', text: 'Reference currency' }), el('div', { class: 'set-sub', text: 'Crypto prices and FX pairs are quoted against this.' })),
    el('div', { class: 'set-control' }, baseSel)));

  card.append(checkGroup('Crypto', TICKER_CRYPTOS.map((c) => ({ value: c.id, label: c.sym })), s.tickerCrypto, (vals) => saveSettings({ tickerCrypto: vals })));
  card.append(checkGroup('Forex', TICKER_FX.map((c) => ({ value: c, label: c })), s.tickerFx, (vals) => saveSettings({ tickerFx: vals })));
  return card;
}

function checkGroup(label, options, selected, onChange) {
  const set = new Set(selected);
  const chips = el('div', { class: 'tick-checks' });
  for (const o of options) {
    const btn = el('button', { class: `tick-check${set.has(o.value) ? ' is-active' : ''}`, text: o.label });
    btn.addEventListener('click', () => {
      if (set.has(o.value)) set.delete(o.value); else set.add(o.value);
      btn.classList.toggle('is-active');
      onChange([...set]);
    });
    chips.append(btn);
  }
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' }, el('div', { class: 'set-label', text: label }), el('div', { class: 'set-sub', text: `Which ${label.toLowerCase()} tickers to show.` })),
    el('div', { class: 'set-control' }, chips));
}

// Wrap an async click handler so the button shows a busy state and errors surface as a toast.
function withBusy(fn) {
  return async (e, btn) => {
    const b = btn || e?.currentTarget;
    if (b) { b.disabled = true; b.classList.add('is-busy'); }
    try { await fn(); }
    catch (err) { toast(err?.message || 'Something went wrong'); }
    finally { if (b) { b.disabled = false; b.classList.remove('is-busy'); } }
  };
}

function fontRow(labelText, subText, list, current, onPick, sampleClass) {
  const select = el('select', { class: 'set-select', 'aria-label': labelText });
  for (const f of list) {
    const opt = el('option', { value: f.id, text: f.label });
    if (f.id === current) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener('change', () => onPick(select.value));
  const sample = el('span', { class: `set-sample ${sampleClass}`, text: 'Ag 123 — quick brown fox' });
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: labelText }),
      el('div', { class: 'set-sub', text: subText }),
    ),
    el('div', { class: 'set-control' }, select, sample),
  );
}

async function render() {
  const s = await loadSettings();
  const frag = document.createDocumentFragment();

  // — Typography —
  const type = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h', text: 'Typography' }),
    fontRow('Interface font', 'Titles, cards, navigation — everything but code.', FONT_UI, s.fontUi,
      (v) => saveSettings({ fontUi: v }).then(() => toast('Interface font updated')), 'sample-ui'),
    fontRow('Monospace font', 'Counts, domains, labels and keyboard hints.', FONT_MONO, s.fontMono,
      (v) => saveSettings({ fontMono: v }).then(() => toast('Monospace font updated')), 'sample-mono'),
    sizeRow(s.scale),
  );

  // — Backup —
  const includeBm = el('input', { type: 'checkbox', id: 'set-include-bm', class: 'set-check' });
  includeBm.checked = includeBookmarks;
  includeBm.addEventListener('change', () => { includeBookmarks = includeBm.checked; });
  const backup = el('section', { class: 'set-card' },
    el('h2', { class: 'set-h', text: 'Backup & restore' }),
    el('p', { class: 'set-sub', text: 'Export everything — spaces, collections and settings — to a JSON file you can re-import later or on another machine.' }),
    el('label', { class: 'set-toggle' }, includeBm, el('span', {}, 'Also include my Chrome bookmarks')),
    el('div', { class: 'set-actions' },
      el('button', { class: 'btnx primary', onclick: () => exportBackup(includeBookmarks) },
        el('span', { text: 'Export backup' })),
      el('button', { class: 'btnx soft', onclick: () => importFlow() },
        el('span', { text: 'Import backup…' })),
    ),
    el('p', { class: 'set-note', text: 'Import replaces your current spaces, collections and settings. Bookmarks, if present, are added under a new "StackNest Import" folder (nothing is overwritten).' }),
  );

  frag.append(type, await tickerCard(), backup, await cloudCard());
  root.replaceChildren(frag);
}

function sizeRow(current) {
  const seg = el('div', { class: 'set-seg', role: 'group', 'aria-label': 'Interface size' });
  for (const z of SCALES) {
    const btn = el('button', { class: `set-seg-btn${z.id === current ? ' is-active' : ''}`, text: z.label });
    btn.addEventListener('click', () => saveSettings({ scale: z.id }));
    seg.append(btn);
  }
  return el('div', { class: 'set-row' },
    el('div', { class: 'set-row-text' },
      el('div', { class: 'set-label', text: 'Interface size' }),
      el('div', { class: 'set-sub', text: 'Scales the whole interface, text and all.' }),
    ),
    el('div', { class: 'set-control' }, seg),
  );
}
