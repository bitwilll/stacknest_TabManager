#!/usr/bin/env node
// Loads the REAL extension into a throwaway headless Chrome and walks every view, reporting
// uncaught exceptions, console errors, CSP violations and failed requests. Run it on the store
// build before every upload:
//
//   sh scripts/package.sh && node scripts/smoke-test.mjs            (tests dist/stacknest-<version>)
//   node scripts/smoke-test.mjs .                                    (tests the dev folder)
//
// Uses the DevTools protocol over --remote-debugging-pipe and Extensions.loadUnpacked (branded
// Chrome no longer honours --load-extension). Nothing touches your real profile. Exit code 1 on
// any error, so it can gate a release.

import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWS = ['collections', 'myspace', 'vault', 'library', 'tags', 'duplicates', 'notes', 'settings'];

async function target() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const { version } = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  return join(ROOT, 'dist', `stacknest-${version}`);
}

function cdp(profile) {
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  let buf = '', seq = 0;
  const waiting = new Map(), listeners = [];
  proc.stdio[4].on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (msg.id && waiting.has(msg.id)) {
        const { ok, fail } = waiting.get(msg.id); waiting.delete(msg.id);
        msg.error ? fail(new Error(`${msg.error.message} ${msg.error.data || ''}`)) : ok(msg.result);
      } else for (const fn of listeners) fn(msg);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, { ok, fail });
    proc.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  return { proc, send, on: (fn) => listeners.push(fn) };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = await target();
if (!existsSync(join(dir, 'manifest.json'))) { console.error(`smoke: no extension at ${dir} — run sh scripts/package.sh first`); process.exit(1); }
const profile = await mkdtemp(join(tmpdir(), 'stacknest-smoke-'));
const { proc, send, on } = cdp(profile);
const problems = [];
try {
  const { id } = await send('Extensions.loadUnpacked', { path: dir });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  on((m) => {
    if (m.sessionId !== s) return;
    if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push(`log: ${m.params.entry.text}${m.params.entry.url ? ` (${m.params.entry.url})` : ''}`);
  });
  await send('Runtime.enable', {}, s);
  await send('Log.enable', {}, s);
  await send('Page.enable', {}, s);
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s)).result.value;
  await send('Page.navigate', { url: `chrome-extension://${id}/newtab.html` }, s);
  await pause(2500);
  const ok = await evaluate(`!!document.querySelector('.sec-head') && typeof chrome.tabs?.query === 'function'`);
  if (!ok) problems.push('the board did not render a section head, or the page is not running as the extension');
  for (const theme of ['light', 'dark', 'linen']) {
    await evaluate(`document.querySelector('#theme-${theme}').click()`);
    for (const v of VIEWS) {
      await evaluate(`document.querySelector('#nav-${v}').click()`);
      await pause(350);
      const txt = await evaluate(`document.querySelector('.view:not([hidden])')?.innerText || ''`);
      if (/\bnull\b|\bundefined\b|NaN/.test(txt)) problems.push(`${theme}/${v}: the view shows null/undefined/NaN`);
    }
  }
  for (const side of ['rail', 'full']) { await evaluate(`document.querySelector('#side-collapse').click()`); await pause(200); }
  console.log(`smoke: ${dir}\n  extension id ${id}\n  ${VIEWS.length} views × 3 themes, rail toggled`);
} catch (e) {
  problems.push(`harness: ${e.message}`);
} finally {
  await send('Browser.close').catch(() => {});
  proc.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
if (problems.length) { console.error(`  ${problems.length} problem(s):\n  - ${[...new Set(problems)].join('\n  - ')}`); process.exit(1); }
console.log('  0 exceptions, 0 console errors, 0 CSP violations, 0 failed loads');
