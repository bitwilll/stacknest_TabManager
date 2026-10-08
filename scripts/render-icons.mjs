#!/usr/bin/env node
// Renders the extension icons — icons/icon16.png, icon32.png, icon48.png, icon128.png —
// from the master icons/icon.svg with headless Chrome, then reads every PNG back and checks it.
//
//   node scripts/render-icons.mjs          (set CHROME=/path/to/chrome if it isn't found)
//
// The master is drawn at the Chrome Web Store spec: a 128px canvas, a 96px tile, 16px of
// transparent padding. Small sizes are not plain downscales. Each one crops the padding with
// the viewBox and snaps the glyph to whole pixels, so the bookmark stays a crisp line at
// 16px instead of a grey smear. Tune the table, never the PNGs.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'icons', 'icon.svg');

// size: canvas px. tile/off: tile edge and transparent margin in px. gpx: canvas px per glyph
// unit (the glyph is drawn in a 24-unit box). spx: stroke width in px. cy: glyph-space y that
// lands on the canvas centre (moves the glyph vertically so its top stroke sits on the grid).
const SIZES = [
  { size: 128, tile: 96, off: 16, gpx: 2.25,   spx: 4.5, cy: 11.5   }, // store + install dialog (the master as drawn)
  { size: 48,  tile: 44, off: 2,  gpx: 1,      spx: 2,   cy: 12     }, // chrome://extensions
  { size: 32,  tile: 30, off: 1,  gpx: 5 / 6,  spx: 2,   cy: 11.2   }, // toolbar on 2x screens, Windows
  { size: 16,  tile: 16, off: 0,  gpx: 7 / 12, spx: 1,   cy: 11.714 }, // toolbar on 1x screens, favicon
];
const LAVA = [245, 110, 15];

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set CHROME=/path/to/chrome and run again.');
  return hit;
}

const fmt = (n) => String(+n.toFixed(6));

// rewrite the master for one size: crop the viewBox to tile + margin, rescale and re-stroke the glyph
function svgFor(master, { size, tile, off, gpx, spx, cy }) {
  const s = tile / 96;                  // canvas px per master unit
  const o = 16 - off / s;               // viewBox origin: the tile's corner minus the margin
  const span = size / s;
  let hits = 0;
  const set = (tag, attr, value) => tag.replace(new RegExp(`\\s${attr}="[^"]*"`), () => { hits++; return ` ${attr}="${value}"`; });
  let svg = master.replace(/<svg\b[^>]*>/, (tag) => {
    tag = set(tag, 'width', size);
    tag = set(tag, 'height', size);
    return set(tag, 'viewBox', `${fmt(o)} ${fmt(o)} ${fmt(span)} ${fmt(span)}`);
  });
  svg = svg.replace(/<path\b[^>]*\bid="mark"[^>]*>/, (tag) => {
    tag = set(tag, 'transform', `translate(64 64) scale(${fmt(gpx / s)}) translate(-12 -${fmt(cy)})`);
    return set(tag, 'stroke-width', fmt(spx / gpx));
  });
  if (hits !== 5) throw new Error('icons/icon.svg must keep width, height and viewBox on <svg> and transform + stroke-width on <path id="mark">');
  return svg.replace(/<!--[\s\S]*?-->/g, '');
}

// minimal PNG reader: 8-bit RGBA, non-interlaced (what Chrome's screenshot writes)
function readPng(file) {
  const d = readFileSync(file);
  if (d.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let i = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (i < d.length) {
    const len = d.readUInt32BE(i), kind = d.toString('latin1', i + 4, i + 8), body = d.subarray(i + 8, i + 8 + len);
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    if (kind === 'IDAT') idat.push(body);
    i += 12 + len;
  }
  if (depth !== 8 || type !== 6 || interlace) throw new Error(`${file}: expected 8-bit RGBA (got depth ${depth}, colour type ${type})`);
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { w, h, at: (x, y) => [...px.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)] };
}

function check(file, { size, tile, off }) {
  const img = readPng(file), problems = [];
  if (img.w !== size || img.h !== size) problems.push(`is ${img.w}x${img.h}, expected ${size}x${size}`);
  const corner = img.at(0, 0)[3];
  if (off > 0 ? corner !== 0 : corner > 96) problems.push(`corner alpha ${corner} (should be transparent)`);
  if (off >= 2 && img.at(Math.floor(off / 2), size >> 1)[3] !== 0) problems.push('padding is not transparent');
  const fill = img.at(size >> 1, off + Math.max(1, Math.round(tile * 0.1)));   // inside the tile, above the glyph
  if (fill[3] !== 255 || fill.slice(0, 3).some((v, k) => Math.abs(v - LAVA[k]) > 3)) problems.push(`tile colour ${fill} (expected ${LAVA},255)`);
  let ink = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const [r, g, b, a] = img.at(x, y); if (a === 255 && r < 60 && g < 60 && b < 60) ink++; }
  if (!ink) problems.push('no glyph ink found');
  return { problems, corner, fill, ink };
}

const chrome = findChrome();
const master = readFileSync(SRC, 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'stacknest-icons-'));
let failed = false;
try {
  for (const spec of SIZES) {
    const html = join(tmp, `icon${spec.size}.html`), out = join(ROOT, 'icons', `icon${spec.size}.png`);
    writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${svgFor(master, spec)}</body></html>`);
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${join(tmp, 'profile')}`, '--force-device-scale-factor=1',
      '--default-background-color=00000000', `--window-size=${spec.size},${spec.size}`,
      `--screenshot=${out}`, `file://${html}`,
    ], { encoding: 'utf8', timeout: 60_000 });
    if (r.status !== 0 || !existsSync(out)) throw new Error(`Chrome failed on ${spec.size}px:\n${r.stderr}`);
    const { problems, corner, fill, ink } = check(out, spec);
    console.log(`icons/icon${spec.size}.png  ${spec.size}x${spec.size}  corner alpha ${corner}  tile rgba(${fill})  ink px ${ink}${problems.length ? '  FAIL: ' + problems.join('; ') : '  ok'}`);
    if (problems.length) failed = true;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) { console.error('render-icons: one or more icons failed the check'); process.exit(1); }
