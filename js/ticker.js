// Market ticker — a live crypto + forex marquee shown beside the search bar.
// Crypto from CoinGecko, FX from open.er-api.com. Disabled by default (it makes
// network requests); the user turns it on and configures it in Settings.
//
// Good-citizen rules, from the providers' terms: the ticker credits both sources on screen,
// FX is fetched at most once an hour (ExchangeRate-API updates daily and rate-limits
// eager pollers), nothing is fetched while the tab is hidden, every request times out, and
// a failed refresh keeps the last good prices rather than blanking the strip.

import { el } from './ui.js';
import { getKey, setKey } from './store.js';
import { SETTINGS_KEY, loadSettings, TICKER_CRYPTOS } from './settings.js';

const REFRESH_MS = 60_000;
const FX_TTL_MS = 60 * 60_000;
const FX_CACHE_KEY = 'stacknest:fxcache';
const TIMEOUT_MS = 8000;
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', CAD: 'C$', AUD: 'A$', CNY: '¥', CHF: '₣' };
const symOf = (c) => SYMBOLS[c] || `${c} `;
const cryptoSym = (id) => TICKER_CRYPTOS.find((c) => c.id === id)?.sym || id.toUpperCase();

let root, timer = null;
let generation = 0;     // bumps on every configure(), so an older, slower call can't start a second interval
let lastGood = null;    // { sig } of the prices on screen — a failed refresh for the same symbols keeps them

export function initTicker(options) {
  ({ root } = options);
  // only a ticker field changing is worth a re-fetch — a text-size or font save is not
  const TICKER_FIELDS = ['tickerEnabled', 'tickerBase', 'tickerCrypto', 'tickerFx'];
  chrome.storage?.onChanged?.addListener((c, area) => {
    const ch = c[SETTINGS_KEY];
    if (area !== 'local' || !ch) return;
    if (TICKER_FIELDS.some((k) => JSON.stringify(ch.oldValue?.[k]) !== JSON.stringify(ch.newValue?.[k]))) configure();
  });
  // a hidden tab doesn't poll; coming back refreshes once, straight away
  document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) refresh(); });
  configure();
  return { render: configure, refresh };
}

async function configure() {
  const gen = ++generation;
  if (timer) { clearInterval(timer); timer = null; }
  const s = await loadSettings();
  if (gen !== generation) return;
  if (!s.tickerEnabled || (!s.tickerCrypto.length && !s.tickerFx.length)) {
    root.hidden = true;
    root.replaceChildren();
    lastGood = null;
    return;
  }
  root.hidden = false;
  await refresh();
  if (gen !== generation) return;
  timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
}

function fmtPrice(v, sym) {
  if (v == null || !isFinite(v)) return '—';
  const digits = v >= 1000 ? 0 : v >= 1 ? 2 : 4;
  return sym + v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

async function fetchCrypto(ids, base) {
  if (!ids.length) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${base.toLowerCase()}&include_24hr_change=true`;
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error('coingecko');
  return r.json();
}

// FX moves once a day at the source: one fetch an hour per base currency, shared by every tab
async function fetchFx(base, quotes) {
  if (!quotes.length) return {};
  const B = base.toUpperCase();
  const cached = await getKey(FX_CACHE_KEY, null).catch(() => null);
  if (cached?.base === B && Date.now() - cached.at < FX_TTL_MS && cached.rates) return cached.rates;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${B}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error('fx');
    const rates = (await r.json()).rates || {};
    await setKey(FX_CACHE_KEY, { base: B, at: Date.now(), rates }).catch(() => {});
    return rates;
  } catch (e) {
    if (cached?.base === B && cached.rates) return cached.rates;   // stale beats nothing
    throw e;
  }
}

async function refresh() {
  const s = await loadSettings();
  if (!s.tickerEnabled) return;
  const base = s.tickerBase, sym = symOf(base), key = base.toLowerCase();
  const sig = JSON.stringify([base, s.tickerCrypto, s.tickerFx]);
  const items = [];
  const [crypto, fx] = await Promise.all([
    fetchCrypto(s.tickerCrypto, base).catch(() => null),
    fetchFx(base, s.tickerFx).catch(() => null),
  ]);
  if (crypto) for (const id of s.tickerCrypto) {
    const row = crypto[id];
    if (row) items.push(tickItem(cryptoSym(id), fmtPrice(row[key], sym), row[`${key}_24h_change`]));
  }
  let fxShown = false;
  if (fx) for (const q of s.tickerFx) {
    if (q === base) continue; // skip the redundant X/X pair
    if (fx[q] != null) { items.push(tickItem(`${base}/${q}`, fx[q].toLocaleString(undefined, { maximumFractionDigits: 4 }), null)); fxShown = true; }
  }

  if (!items.length) {
    // a blip keeps what was already on screen (same symbols and base); only a first failure says so
    if (lastGood?.sig === sig) return;
    root.replaceChildren(el('div', { class: 'tick-track still' }, el('span', { class: 'tick-item muted', text: 'Prices unavailable — check your connection' })));
    return;
  }
  // the sources, credited on screen as their terms ask
  if (crypto && s.tickerCrypto.length) items.push(sourceLink('https://www.coingecko.com', 'Powered by CoinGecko'));
  if (fxShown) items.push(sourceLink('https://www.exchangerate-api.com', 'Rates By Exchange Rate API'));
  // duplicate the run so the CSS marquee can loop seamlessly (translateX -50%)
  const track = el('div', { class: 'tick-track' }, ...items, ...items.map((n) => n.cloneNode(true)));
  root.replaceChildren(track);
  lastGood = { sig };
}

function sourceLink(href, text) {
  return el('a', { class: 'tick-src', href, target: '_blank', rel: 'noopener noreferrer', text });
}

function tickItem(label, value, change) {
  const parts = [el('span', { class: 'tick-sym', text: label }), el('span', { class: 'tick-val', text: value })];
  if (change != null && isFinite(change)) {
    const dir = change >= 0 ? ' up' : ' down';
    parts.push(el('span', { class: `tick-chg${dir}`, text: `${change >= 0 ? '▲' : '▼'}${Math.abs(change).toFixed(1)}%` }));
  }
  return el('span', { class: 'tick-item' }, ...parts);
}
