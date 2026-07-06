// Market ticker — a live crypto + forex marquee shown beside the search bar.
// Crypto from CoinGecko, FX from open.er-api.com. Disabled by default (it makes
// network requests); the user turns it on and configures it in Settings.

import { el } from './ui.js';
import { SETTINGS_KEY, loadSettings, TICKER_CRYPTOS } from './settings.js';

const REFRESH_MS = 60_000;
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', CAD: 'C$', AUD: 'A$', CNY: '¥', CHF: '₣' };
const symOf = (c) => SYMBOLS[c] || `${c} `;
const cryptoSym = (id) => TICKER_CRYPTOS.find((c) => c.id === id)?.sym || id.toUpperCase();

let root, timer = null;

export function initTicker(options) {
  ({ root } = options);
  chrome.storage?.onChanged?.addListener((c, area) => { if (area === 'local' && c[SETTINGS_KEY]) configure(); });
  configure();
  return { render: configure, refresh };
}

async function configure() {
  const s = await loadSettings();
  if (timer) { clearInterval(timer); timer = null; }
  if (!s.tickerEnabled || (!s.tickerCrypto.length && !s.tickerFx.length)) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  root.hidden = false;
  await refresh();
  timer = setInterval(refresh, REFRESH_MS);
}

function fmtPrice(v, sym) {
  if (v == null || !isFinite(v)) return '—';
  const digits = v >= 1000 ? 0 : v >= 1 ? 2 : 4;
  return sym + v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

async function fetchCrypto(ids, base) {
  if (!ids.length) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${base.toLowerCase()}&include_24hr_change=true`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('coingecko');
  return r.json();
}

async function fetchFx(base, quotes) {
  if (!quotes.length) return {};
  const r = await fetch(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('fx');
  return (await r.json()).rates || {};
}

async function refresh() {
  const s = await loadSettings();
  if (!s.tickerEnabled) return;
  const base = s.tickerBase, sym = symOf(base), key = base.toLowerCase();
  const items = [];
  const [crypto, fx] = await Promise.all([
    fetchCrypto(s.tickerCrypto, base).catch(() => null),
    fetchFx(base, s.tickerFx).catch(() => null),
  ]);
  if (crypto) for (const id of s.tickerCrypto) {
    const row = crypto[id];
    if (row) items.push(tickItem(cryptoSym(id), fmtPrice(row[key], sym), row[`${key}_24h_change`]));
  }
  if (fx) for (const q of s.tickerFx) {
    if (q === base) continue; // skip the redundant X/X pair
    if (fx[q] != null) items.push(tickItem(`${base}/${q}`, fx[q].toLocaleString(undefined, { maximumFractionDigits: 4 }), null));
  }

  if (!items.length) {
    root.replaceChildren(el('div', { class: 'tick-track still' }, el('span', { class: 'tick-item muted', text: 'Prices unavailable — check your connection' })));
    return;
  }
  // duplicate the run so the CSS marquee can loop seamlessly (translateX -50%)
  const track = el('div', { class: 'tick-track' }, ...items, ...items.map((n) => n.cloneNode(true)));
  root.replaceChildren(track);
}

function tickItem(label, value, change) {
  const parts = [el('span', { class: 'tick-sym', text: label }), el('span', { class: 'tick-val', text: value })];
  if (change != null && isFinite(change)) {
    const dir = change >= 0 ? ' up' : ' down';
    parts.push(el('span', { class: `tick-chg${dir}`, text: `${change >= 0 ? '▲' : '▼'}${Math.abs(change).toFixed(1)}%` }));
  }
  return el('span', { class: 'tick-item' }, ...parts);
}
