#!/usr/bin/env node
// Captures the Chrome Web Store listing images into docs/store/:
//   screenshots/01-board-light.png … 06-settings-dark.png   1280x800 (the store takes up to 5)
//   promo/small-promo-440x280.png                            the mandatory small promo tile
//
//   node scripts/store-assets.mjs          (set CHROME=/path/to/chrome if it isn't found)
//
// It serves this folder on a private 127.0.0.1 port, opens newtab.html in headless Chrome
// (outside the extension, so js/mock.js supplies sample tabs and bookmarks), seeds a fuller
// board and a Notes mosaic into the in-memory mock storage, and screenshots each view in the
// light and dark themes. Nothing touches your real Chrome profile or your real data.
// Re-run it after any visual change so the listing matches the build you upload.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'store');
const W = 1280, H = 800;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// The small promo tile: the mark, the wordmark and one line, on the Dark Void frame.
const PROMO = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Hanken Grotesk'; src: url('/fonts/HankenGrotesk-var.woff2') format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'JetBrains Mono'; src: url('/fonts/JetBrainsMono-var.woff2') format('woff2'); font-weight: 100 800; }
html, body { margin: 0; width: 440px; height: 280px; overflow: hidden; background: #151419; }
.tile { position: relative; width: 440px; height: 280px; box-sizing: border-box; padding: 0 40px;
  display: flex; flex-direction: column; justify-content: center; gap: 18px; }
.lockup { display: flex; align-items: center; gap: 18px; }
.mark { width: 72px; height: 72px; border-radius: 18px; background: #f56e0f; display: grid; place-items: center; flex: none; }
.mark svg { width: 40px; height: 40px; }
.word { font: 800 50px/1 'Hanken Grotesk', sans-serif; letter-spacing: -0.035em; color: #fbfbfa; }
.word b { color: #f56e0f; font-weight: 800; }
.line { font: 500 15px/1.45 'JetBrains Mono', monospace; letter-spacing: 0.01em; color: #b9b6c0; text-transform: lowercase; margin: 0; }
.line span { color: #fbfbfa; }
.rule { position: absolute; left: 40px; right: 40px; bottom: 28px; height: 1px; background: #2c2a31; }
.rule::after { content: ''; position: absolute; left: 0; top: -1px; width: 56px; height: 3px; border-radius: 2px; background: #f56e0f; }
</style></head><body><div class="tile">
  <div class="lockup">
    <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#151419" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v14l-6-3.4L6 19V5a1 1 0 0 1 1-1Z"/></svg></div>
    <div class="word">stacknest<b>.</b></div>
  </div>
  <p class="line">a calm new tab for<br><span>your tabs &amp; bookmarks</span></p>
  <div class="rule"></div>
</div></body></html>`;

// Illustrative content for the listing. Mock storage is in-memory, so this never persists.
const SEED = `(async () => {
  const day = (d, h = 9, m = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString(); };
  const spaces = (await chrome.storage.local.get('stacknest:spaces'))['stacknest:spaces'] || [];
  spaces.splice(2, 0,
    { id: 'demo-4', title: 'Lisbon trip', workspaceId: 'ws-personal', color: '#57897f', createdAt: 0, updatedAt: 0, tabs: [
      { title: 'Lisbon travel guide — Lonely Planet', url: 'https://www.lonelyplanet.com/portugal/lisbon' },
      { title: 'Tram 28 route and times', url: 'https://www.carris.pt' },
      { title: 'LX Factory', url: 'https://lxfactory.com' },
      { title: 'Time Out Market Lisboa', url: 'https://www.timeoutmarket.com/lisboa' } ] },
    { id: 'demo-5', title: 'Read later', workspaceId: 'ws-personal', color: '#b28a54', createdAt: 0, updatedAt: 0, tabs: [
      { title: 'Butterick’s Practical Typography', url: 'https://practicaltypography.com' },
      { title: 'The Pragmatic Engineer', url: 'https://newsletter.pragmaticengineer.com' },
      { title: 'A List Apart', url: 'https://alistapart.com' } ] });
  // recent dates, so the column captions read "updated <last week>" rather than the epoch
  spaces.forEach((sp, i) => { sp.createdAt = sp.updatedAt = Date.parse(day(-(i * 2 + 1))); });
  await chrome.storage.local.set({ 'stacknest:spaces': spaces });
  await chrome.storage.local.set({ 'stacknest:notes': { v: 3, items: [
    { id: 'n1', kind: 'todo', title: 'Launch checklist', color: 'amber', tags: ['work'], createdAt: day(-2), updatedAt: day(-1),
      reminder: { at: day(1, 10, 0), lead: 10 },
      list: [ { id: 'a', text: 'Final icon set', done: true }, { id: 'b', text: 'Store screenshots', done: true },
              { id: 'c', text: 'Privacy policy page', done: false }, { id: 'd', text: 'Submit for review', done: false } ] },
    { id: 'n2', kind: 'note', title: 'Weekly review', color: 'none', tags: ['habits'], createdAt: day(-3), updatedAt: day(-3),
      body: '## Every Friday\\n- **Inbox** to zero\\n- Stash finished projects into collections\\n- Clear *duplicates* before they pile up\\n\\n> Close the tabs, keep the thread.' },
    { id: 'n3', kind: 'reminder', text: 'Call the landlord about the lease', color: 'rose', tags: ['home'], createdAt: day(-1), done: false,
      reminder: { at: day(0, 17, 30), lead: 0 } },
    { id: 'n4', kind: 'todo', title: 'Groceries', color: 'green', tags: ['home'], createdAt: day(-1), updatedAt: day(-1),
      list: [ { id: 'g1', text: 'Oat milk', done: true }, { id: 'g2', text: 'Lemons', done: false }, { id: 'g3', text: 'Sourdough', done: false } ] },
    { id: 'n5', kind: 'note', title: 'Gift ideas', color: 'violet', tags: [], createdAt: day(-5), updatedAt: day(-4),
      body: 'Mum — the linen apron from the market.\\nSam — **film camera** strap.' },
    { id: 'n6', kind: 'reminder', text: 'Renew passport', color: 'blue', tags: ['admin'], createdAt: day(-6), done: false,
      reminder: { at: day(6, 9, 0), lead: 60 } } ] } });
  return true;
})()`;

const SHOTS = [
  ['01-board-light.png', 'light', 'collections'],
  ['02-notes-dark.png', 'dark', 'notes'],
  ['03-settings-light.png', 'light', 'settings'],
  ['04-board-dark.png', 'dark', 'collections'],
  ['05-notes-light.png', 'light', 'notes'],
  ['06-settings-dark.png', 'dark', 'settings'],
];

function findChrome() {
  const hit = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set CHROME=/path/to/chrome and run again.');
  return hit;
}

// static server for this folder, loopback only, plus the promo page
function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/__store/promo.html') { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(PROMO); }
    const file = path === '/favicon.ico' ? join(ROOT, 'icons', 'icon32.png') : normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Chrome DevTools Protocol over --remote-debugging-pipe (fd 3 in, fd 4 out, NUL-delimited JSON)
function cdp(chrome, profile) {
  const proc = spawn(chrome, ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const pending = new Map(), errors = [];
  let id = 0, buf = '';
  proc.stdio[4].on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let at;
    while ((at = buf.indexOf('\0')) !== -1) {
      const msg = JSON.parse(buf.slice(0, at)); buf = buf.slice(at + 1);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail, method } = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? fail(new Error(`${method}: ${msg.error.message}`)) : ok(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const n = ++id; pending.set(n, { ok, fail, method });
    proc.stdio[3].write(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    setTimeout(() => { if (pending.delete(n)) fail(new Error(`${method}: timed out`)); }, 45_000);
  });
  return { proc, send, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const chrome = findChrome();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(join(tmpdir(), 'stacknest-store-'));
  const { proc, send, errors } = cdp(chrome, profile);
  try {
    await sleep(800);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, s);
    await send('Page.enable', {}, s);
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result?.value;
    };
    const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, s);
    const settle = () => evaluate(`(async () => {
      await document.fonts.ready;
      const pending = [...document.images].filter((i) => !i.complete);
      await Promise.race([Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 4000))]);
      return true; })()`);
    const capture = async (file) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, s);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(file.slice(ROOT.length + 1));
    };

    // ——— screenshots ———
    await mkdir(join(OUT, 'screenshots'), { recursive: true });
    await size(W, H);
    await send('Page.navigate', { url: `${base}/newtab.html` }, s);
    await sleep(2500);
    if (!(await evaluate('!!document.querySelector("#sidebar")'))) throw new Error('newtab.html did not render');
    await evaluate(`(() => { const st = document.createElement('style');
      st.textContent = '*{transition:none!important;animation:none!important;caret-color:transparent!important}';
      document.head.append(st); return 1; })()`);
    await evaluate(SEED);
    await sleep(800);
    for (const [name, theme, view] of SHOTS) {
      await evaluate(`(async () => { document.querySelector('#theme-${theme}').click(); document.querySelector('#nav-${view}').click();
        document.activeElement?.blur?.(); window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 1800)); return 1; })()`);
      await settle();
      await capture(join(OUT, 'screenshots', name));
    }

    // ——— small promo tile ———
    await mkdir(join(OUT, 'promo'), { recursive: true });
    await size(440, 280);
    await send('Page.navigate', { url: `${base}/__store/promo.html` }, s);
    await sleep(800);
    await settle();
    await capture(join(OUT, 'promo', 'small-promo-440x280.png'));

    if (errors.length) { console.error('page exceptions:\n  ' + errors.join('\n  ')); process.exitCode = 1; }
  } finally {
    await send('Browser.close').catch(() => {});
    proc.kill();
    server.close();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => { console.error(`store-assets: ${e.message}`); process.exit(1); });
