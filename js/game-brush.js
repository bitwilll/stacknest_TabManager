// Brush Stroke — the snake game, as ink. One unbroken stroke travels over old, coffee-coloured
// paper and gathers drops of ink as it goes; each drop makes it longer and blooms a little into
// the paper. The edges wrap round. If the stroke crosses itself the brush lifts, and the
// painting is signed with a red seal. Arrow keys / WASD, or swipe. "Sumi" plays softly.
//
// The stroke is laid along a path fixed to the paper (each grid cell is crossed by a straight
// line or a quarter-circle bend, taken with an easing like honey), so it never wobbles: the fresh end grows forward along that
// path and the dry end lifts off behind. Wherever it has been it leaves a faint trace (about
// 22% ink), so every game slowly unfurls into a picture of its own.

import { SIZE, setupCanvas, runLoop, card, playMusic, SUMI, swish, drip, note } from './arcade-kit.js';
import { luckFor } from './luck.js';   // the saved painting's lucky numbers and phrase

export const meta = { id: 'brush', title: 'Brush Stroke', blurb: 'One ink stroke over old paper, gathering drops of ink.', keys: 'Arrow keys, WASD or swipe', wide: true };
const BEST_KEY = 'stacknest:arcade-brush-best';
const N = 16, C = SIZE / N;
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
const INK = '#16130f';
const SUBS = 10;          // samples per cell along the path
const TRACE = 0.22;       // how much ink the trace keeps

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const h1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };
const cellPx = ([cx, cy]) => [cx * C + C / 2, cy * C + C / 2];

// a canvas at the display's resolution, drawn in the 640 space
function layer(cache, scale) {
  const px = Math.round(SIZE * scale);
  if (!cache.cv) cache.cv = document.createElement('canvas');
  if (cache.cv.width !== px) { cache.cv.width = px; cache.cv.height = px; cache.fresh = true; }
  const g = cache.cv.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  return g;
}

/* ——— the paper ———
   Made fresh for every painting from a seed, so no two sheets are alike: one of four stocks
   (rice paper, tea-stained, an old letter, kraft), its colour nudged, then layered like the
   real thing — a soft mottle, a fine grain at the screen's own resolution, fibres (dark and
   pale), laid and chain lines on some, perhaps a fold, coffee rings and water blooms, foxing,
   the odd old ink speck, and edges darkened unevenly where hands have held it. */
const STOCKS = [
  { name: 'rice paper', base: ['#f7f0e1', '#efe4cb', '#dcc8a3'], fibre: 1.5, pale: 0.6, laid: false, fox: 0.4, stain: 0.5, fold: 0.15 },
  { name: 'tea-stained', base: ['#efdcb8', '#e2c796', '#c6a26e'], fibre: 1, pale: 0.25, laid: true, fox: 1, stain: 1.3, fold: 0.3 },
  { name: 'old letter', base: ['#f4ead4', '#e8d9b8', '#d2b98b'], fibre: 0.8, pale: 0.3, laid: true, fox: 1.5, stain: 0.8, fold: 0.85 },
  { name: 'kraft', base: ['#e9d4ae', '#d8bd8b', '#ba9762'], fibre: 1.3, pale: 0.2, laid: false, fox: 0.6, stain: 1, fold: 0.3 },
];
const hexRgb = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const nudge = (c, d) => `rgb(${hexRgb(c).map((v, i) => Math.max(0, Math.min(255, Math.round(v + d[i])))).join(',')})`;

// a few sheets kept (the one on screen, its print-size twin for Save, the shelf's still); while
// the frame is being resized the sheet on screen is stretched rather than remade at every size
const paperCache = new Map();   // `${scale}:${seed}` → canvas
let liveScale = { scale: 0, since: 0 };
function paper(scale = 1, seed = 7, { live = false } = {}) {
  const key = `${scale}:${seed}`;
  if (paperCache.has(key)) return paperCache.get(key);
  if (live) {
    const at = performance.now();
    if (liveScale.scale !== scale) liveScale = { scale, since: at };
    if (at - liveScale.since < 300) for (const [k, sheet] of paperCache) if (k.endsWith(`:${seed}`)) return sheet;
  }
  const px = Math.round(SIZE * scale);
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const p = cv.getContext('2d');
  p.setTransform(scale, 0, 0, scale, 0, 0);
  const r = rng(seed * 104729 + 17);
  const S = STOCKS[seed % STOCKS.length];
  const tint = [(r() - 0.5) * 14, (r() - 0.5) * 12, (r() - 0.5) * 16];
  // ground
  const g = p.createRadialGradient(SIZE * (0.35 + r() * 0.3), SIZE * (0.35 + r() * 0.3), 40, SIZE / 2, SIZE / 2, SIZE * 0.8);
  g.addColorStop(0, nudge(S.base[0], tint)); g.addColorStop(0.62, nudge(S.base[1], tint)); g.addColorStop(1, nudge(S.base[2], tint));
  p.fillStyle = g; p.fillRect(0, 0, SIZE, SIZE);
  // mottle: two octaves of soft cloudiness
  for (const [n, a] of [[18, 0.5], [56, 0.32], [150, 0.18]]) {
    const m = document.createElement('canvas'); m.width = n; m.height = n;
    const mc = m.getContext('2d');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = r();
      mc.fillStyle = v < 0.5 ? `rgba(120,84,40,${(0.5 - v) * 0.16})` : `rgba(255,251,238,${(v - 0.5) * 0.18})`;
      mc.fillRect(x, y, 1, 1);
    }
    p.save(); p.globalAlpha = a; p.imageSmoothingEnabled = true; p.imageSmoothingQuality = 'high';
    p.drawImage(m, 0, 0, SIZE, SIZE); p.restore();
  }
  // fine grain at the device's own resolution
  const gc = document.createElement('canvas'); gc.width = px; gc.height = px;
  const gx = gc.getContext('2d'), id = gx.createImageData(px, px), d = id.data;
  const rg = rng(seed * 7919 + 3);   // its own stream: the grain's pixel count varies with scale,
  for (let i = 0; i < d.length; i += 4) {   // and must not shift where the stains and folds fall
    const v = rg();
    if (v < 0.55) continue;
    const dark = v < 0.85;
    d[i] = dark ? 96 : 255; d[i + 1] = dark ? 66 : 250; d[i + 2] = dark ? 34 : 236; d[i + 3] = dark ? (v - 0.55) * 90 : (v - 0.85) * 120;
  }
  gx.putImageData(id, 0, 0);
  p.save(); p.setTransform(1, 0, 0, 1, 0, 0); p.drawImage(gc, 0, 0); p.restore();
  // laid and chain lines of a mould-made sheet
  if (S.laid) {
    p.fillStyle = 'rgba(110,80,40,.022)';
    for (let y = 0; y < SIZE; y += 2.6) p.fillRect(0, y, SIZE, 0.7);
    const gap = 22 + r() * 8;
    p.strokeStyle = 'rgba(110,80,40,.05)'; p.lineWidth = 1.2;
    for (let x = r() * gap; x < SIZE; x += gap) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x + (r() - 0.5) * 3, SIZE); p.stroke(); }
  }
  // fibres, dark and pale
  const nf = Math.round(1700 * S.fibre);
  for (let i = 0; i < nf; i++) {
    const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI, l = 3 + r() * (r() < 0.1 ? 26 : 11);
    const pale = r() < S.pale;
    p.strokeStyle = pale ? `rgba(255,250,236,${0.15 + r() * 0.3})` : `rgba(${100 + r() * 40},${70 + r() * 30},${36 + r() * 20},${0.04 + r() * 0.08})`;
    p.lineWidth = 0.4 + r() * 0.7;
    p.beginPath(); p.moveTo(x, y);
    p.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l);
    p.stroke();
  }
  // a fold or two: a soft valley with a lit ridge beside it
  if (r() < S.fold) {
    const folds = r() < 0.4 ? 2 : 1;
    for (let k = 0; k < folds; k++) {
      const horiz = r() < 0.5, at = SIZE * (0.28 + r() * 0.44), bow = (r() - 0.5) * 6;
      const line = (off) => { p.beginPath(); if (horiz) { p.moveTo(0, at + off); p.quadraticCurveTo(SIZE / 2, at + off + bow, SIZE, at + off); } else { p.moveTo(at + off, 0); p.quadraticCurveTo(at + off + bow, SIZE / 2, at + off, SIZE); } p.stroke(); };
      p.strokeStyle = 'rgba(90,60,30,.09)'; p.lineWidth = 2.4; line(0);
      p.strokeStyle = 'rgba(255,252,240,.35)'; p.lineWidth = 1; line(1.8);
      p.strokeStyle = 'rgba(90,60,30,.05)'; p.lineWidth = 6; line(-3);
    }
  }
  // stains: coffee rings and water blooms, long dried
  const stains = Math.floor(r() * 2.2 * S.stain + 0.3);
  for (let k = 0; k < stains; k++) {
    const cx = 60 + r() * (SIZE - 120), cy = 60 + r() * (SIZE - 120);
    if (r() < 0.55) {
      const rad = 30 + r() * 42;
      p.filter = 'blur(1.2px)';
      for (let j = 0; j < 3; j++) {
        p.strokeStyle = `rgba(140,88,40,${0.06 + j * 0.03 + r() * 0.03})`; p.lineWidth = 5 - j * 1.6;
        const a0 = r() * Math.PI * 2;
        p.beginPath(); p.ellipse(cx + j, cy - j, rad - j * 2, rad * (0.9 + r() * 0.08) - j, r() * Math.PI, a0, a0 + Math.PI * (1.4 + r() * 0.6)); p.stroke();
      }
      p.fillStyle = `rgba(160,110,60,${0.03 + r() * 0.04})`; p.beginPath(); p.ellipse(cx, cy, rad - 4, rad * 0.9, 0, 0, Math.PI * 2); p.fill();
    } else {
      const pts = 14, rad = 26 + r() * 50;
      p.filter = 'blur(2px)';
      p.beginPath();
      for (let j = 0; j <= pts; j++) { const ang = (j / pts) * Math.PI * 2, rr = rad * (0.75 + r() * 0.45); j ? p.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr) : p.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
      p.closePath();
      p.fillStyle = `rgba(150,105,55,${0.035 + r() * 0.03})`; p.fill();
      p.strokeStyle = `rgba(125,82,38,${0.08 + r() * 0.05})`; p.lineWidth = 2; p.stroke();
    }
    p.filter = 'none';
  }
  // foxing, in little clusters
  const fox = Math.round(5 + r() * 18 * S.fox);
  p.filter = 'blur(1.5px)';
  for (let k = 0; k < fox; k++) {
    const cx = r() * SIZE, cy = r() * SIZE, n = 1 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) { p.fillStyle = `rgba(150,95,45,${0.06 + r() * 0.14})`; p.beginPath(); p.arc(cx + (r() - 0.5) * 18, cy + (r() - 0.5) * 18, 1 + r() * 4.5, 0, Math.PI * 2); p.fill(); }
  }
  p.filter = 'none';
  // an old ink speck or two from some earlier hand
  for (let k = 0; k < 1 + Math.floor(r() * 3); k++) { p.fillStyle = `rgba(30,24,18,${0.18 + r() * 0.25})`; p.beginPath(); p.arc(r() * SIZE, r() * SIZE, 0.6 + r() * 1.6, 0, Math.PI * 2); p.fill(); }
  // edges darkened unevenly, as a sheet that has been handled and kept
  p.filter = 'blur(10px)';
  for (let k = 0; k < 110; k++) {
    const side = Math.floor(r() * 4), t = r() * SIZE, depth = r() * 16;
    const x = side === 0 ? depth : side === 1 ? SIZE - depth : t, y = side === 2 ? depth : side === 3 ? SIZE - depth : t;
    p.fillStyle = `rgba(110,70,30,${0.035 + r() * 0.06})`; p.beginPath(); p.arc(x, y, 14 + r() * 34, 0, Math.PI * 2); p.fill();
  }
  p.filter = 'none';
  const v = p.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.38, SIZE / 2, SIZE / 2, SIZE * 0.76);
  v.addColorStop(0, 'rgba(90,60,30,0)'); v.addColorStop(1, `rgba(90,60,30,${0.18 + r() * 0.12})`);
  p.fillStyle = v; p.fillRect(0, 0, SIZE, SIZE);
  paperCache.set(key, cv);
  while (paperCache.size > 3) paperCache.delete(paperCache.keys().next().value);
  return cv;
}

// the paper's tooth, which lifts a little ink from anything laid on it
let grainCache = null;
function grain(scale) {
  if (grainCache?.scale === scale) return grainCache.cv;
  const cv = document.createElement('canvas');
  cv.width = Math.round(SIZE * scale); cv.height = Math.round(SIZE * scale);
  const g = cv.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const r = rng(777);
  for (let i = 0; i < 5200; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.75})`; g.fillRect(r() * SIZE, r() * SIZE, 0.6 + r() * 0.9, 0.6 + r() * 0.9); }
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI, l = 2 + r() * 7;
    g.strokeStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`; g.lineWidth = 0.5 + r() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  grainCache = { scale, cv };
  return cv;
}

function inkDrop(ctx, x, y, t, seed, fade = 1) {
  const r = rng(seed * 7919 + 13);
  const wob = 1 + Math.sin(t * 2.4 + seed) * 0.04;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(40,30,20,.12)';   // where it has begun to soak in
  ctx.beginPath(); ctx.ellipse(x + 1, y + 2, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 4; k++) { const a = r() * Math.PI * 2, d = 15 + r() * 10; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + r() * 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(x, y, 10 * wob, 9.2 / wob, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 3, y + 3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';   // its wet gloss
  ctx.beginPath(); ctx.ellipse(x - 3.5, y - 3.5, 3.2, 1.8, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.arc(x + 3, y + 4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function seal(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.05);
  ctx.fillStyle = 'rgba(178,44,34,.86)';
  ctx.beginPath(); ctx.roundRect(-22, -22, 44, 44, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(243,232,207,.92)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -11); ctx.lineTo(12, -11); ctx.moveTo(0, -11); ctx.lineTo(0, 13); ctx.moveTo(-11, 2); ctx.quadraticCurveTo(-4, 14, -12, 14); ctx.moveTo(11, 1); ctx.lineTo(6, 13);
  ctx.stroke();
  ctx.restore();
}

/* ——— the path ———
   trail[i] = { c: [cx, cy], d: [dx, dy] } — a cell, and the direction it was entered from.
   Cell j is crossed from its entry edge to its exit edge (straight, or a quarter circle), so
   the point at path position a (cell j = floor(a)) depends only on cells already painted:
   nothing about the drawn stroke changes when the next turn is chosen. */
function makePath(trail, base) {
  const at = (j) => trail[j - base];
  const last = base + trail.length - 1;
  return {
    point(a) {
      let j = Math.floor(a), u = a - j;
      if (j >= last) { j = last - 1; u = 1; }   // the newest cell's way out isn't known yet
      if (j < base) { j = base; u = 0; }
      const cell = at(j), next = at(j + 1);
      const [px, py] = cellPx(cell.c);
      const din = cell.d, dout = next.d;
      const ex = px - din[0] * C / 2, ey = py - din[1] * C / 2;
      if (din[0] === dout[0] && din[1] === dout[1]) return { x: ex + din[0] * C * u, y: ey + din[1] * C * u, j };   // straight on
      // a bend: a true quarter circle round the cell's inside corner. The angle follows a smooth
      // curve whose speed at both ends matches a straight cell and eases off through the middle,
      // so the stroke takes the turn like honey: slowing a little, never lurching or rippling.
      const kx = px - din[0] * C / 2 + dout[0] * C / 2, ky = py - din[1] * C / 2 + dout[1] * C / 2;
      const v0x = ex - kx, v0y = ey - ky;
      const v1x = px + dout[0] * C / 2 - kx, v1y = py + dout[1] * C / 2 - ky;
      const th = 2 * (u * u * u - 2 * u * u + u) + (Math.PI / 2) * (3 * u * u - 2 * u * u * u) + 2 * (u * u * u - u * u);
      return { x: kx + v0x * Math.cos(th) + v1x * Math.sin(th), y: ky + v0y * Math.cos(th) + v1y * Math.sin(th), j };
    },
    // crossing from cell j to j+1 jumps an edge when the move wrapped round
    wraps(j) { const a = at(j)?.c, b = at(j + 1)?.c; return !!(a && b && (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1)); },
  };
}

// the samples of the stroke from its dry end to its fresh end, at path positions fixed to the
// paper, split into runs where it wraps; returned head first
function sampleStroke(path, tailA, headA, wet) {
  const pts = [];
  const add = (a) => { const p = path.point(a); pts.push({ ...p, a }); };
  add(tailA);
  for (let m = Math.floor(tailA * SUBS) + 1; m / SUBS < headA; m++) add(m / SUBS);
  add(headA);
  const runs = [[]];
  for (let k = 0; k < pts.length; k++) {
    if (k && pts[k].j !== pts[k - 1].j && path.wraps(pts[k - 1].j)) runs.push([]);
    runs[runs.length - 1].push(pts[k]);
  }
  const span = Math.max(0.001, headA - tailA);
  return runs.filter((r) => r.length > 1).map((run) => {
    for (let k = 0; k < run.length; k++) {
      const p = run[k], pa = run[Math.max(0, k - 1)], pb = run[Math.min(run.length - 1, k + 1)];
      const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
      p.nx = -dy / len; p.ny = dx / len;
      p.s = (headA - p.a) / span;   // 0 at the fresh end, 1 at the dry end
      p.w = widthAt(p.s, p.a, wet);
    }
    return run.reverse();
  }).reverse();
}

const widthAt = (s, a, wet) => (3.4 + 12.6 * Math.pow(1 - s, 0.5)) * (0.86 + 0.28 * vnoise(a * 0.75)) * (0.88 + 0.12 * wet);
const ragAt = (a, side) => (vnoise(a * 9 + (side > 0 ? 0 : 57)) - 0.5) * 1.3 + (vnoise(a * 27 + side * 13) - 0.5) * 0.5;

// The live stroke: a true outline with a ragged edge, a grey wash toward the dry end, ink pooled
// darker at the edges, dry-brush streaks opening along the bristles, and the paper's grain.
const inkCache = {};
function paintStroke(ctx, runs, wet) {
  if (!runs.length) return;
  const scale = ctx.getTransform().a || 1;
  const L = layer(inkCache, scale);
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, inkCache.cv.width, inkCache.cv.height); L.restore();
  L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1;

  const outlines = runs.map((S) => {
    const path = new Path2D();
    const edge = (p, side) => { const r = p.w + ragAt(p.a, side) * (0.4 + p.s); return [p.x + p.nx * r * side, p.y + p.ny * r * side]; };
    S.forEach((p, k) => { const [x, y] = edge(p, 1); k ? path.lineTo(x, y) : path.moveTo(x, y); });
    for (let k = S.length - 1; k >= 0; k--) { const [x, y] = edge(S[k], -1); path.lineTo(x, y); }
    path.closePath();
    const h = S[0], t = S[S.length - 1];
    path.moveTo(h.x + h.w, h.y); path.arc(h.x, h.y, h.w, 0, Math.PI * 2);
    path.moveTo(t.x + t.w * 0.8, t.y); path.arc(t.x, t.y, t.w * 0.8, 0, Math.PI * 2);
    return path;
  });
  L.fillStyle = '#100d0a';
  for (const p of outlines) L.fill(p, 'nonzero');

  L.globalCompositeOperation = 'source-atop';
  for (const S of runs) {
    for (const p of S) {
      const wash = Math.max(0, (p.s - 0.25) / 0.75) * (1.15 - wet * 0.25);
      const mott = vnoise(p.a * 2.3 + 7) * 0.05;
      if (wash + mott < 0.01) continue;
      L.fillStyle = `rgba(112,102,88,${Math.min(0.5, wash * 0.11 + mott)})`;
      L.beginPath(); L.arc(p.x + (vnoise(p.a * 4) - 0.5) * p.w * 0.4, p.y + (vnoise(p.a * 4 + 9) - 0.5) * p.w * 0.4, p.w * 0.85, 0, Math.PI * 2); L.fill();
    }
  }
  L.strokeStyle = 'rgba(0,0,0,.7)'; L.lineWidth = 2.2; L.lineJoin = 'round';
  for (const p of outlines) L.stroke(p);

  L.globalCompositeOperation = 'destination-out';
  L.lineCap = 'round';
  const BR = 11;
  for (let k = 0; k < BR; k++) {
    const off = -0.92 + (1.84 * k) / (BR - 1) + (h1(k * 3.7) - 0.5) * 0.08;
    const path = new Path2D();
    for (const S of runs) {
      let open = false;
      for (const p of S) {
        const dry = Math.max(0, (p.s - 0.34) / 0.66) * (1.25 - wet * 0.35);
        const gap = vnoise(p.a * 2.6 + k * 17.3) < dry * 0.8 - Math.abs(off) * 0.08;
        const x = p.x + p.nx * p.w * off, y = p.y + p.ny * p.w * off;
        if (gap) { open ? path.lineTo(x, y) : path.moveTo(x, y); open = true; } else open = false;
      }
    }
    L.strokeStyle = 'rgba(0,0,0,.92)'; L.lineWidth = 0.55 + h1(k * 5.1) * 1.3; L.stroke(path);
  }
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 0.2; L.drawImage(grain(scale), 0, 0); L.restore();
  L.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.16; ctx.filter = 'blur(1.6px)'; ctx.drawImage(inkCache.cv, 0, 0, SIZE, SIZE);
  ctx.filter = 'none'; ctx.globalAlpha = 0.97; ctx.drawImage(inkCache.cv, 0, 0, SIZE, SIZE);
  ctx.restore();
  const head = runs[0].slice(0, 14);   // fresh ink keeps a faint shine right at the head
  if (head.length > 2) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    head.forEach((p, k) => { const x = p.x + p.nx * p.w * 0.45, y = p.y + p.ny * p.w * 0.45; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.restore();
  }
}

// the trace: everything the fresh end has passed over. Two layers: a fresh one that fades
// slowly (half its strength every TRACE_HALF seconds) over a faint one that never fades, so the
// oldest passages settle into the paper while the newest stay clear. Every stamp is kept too,
// so a saved painting can be drawn again at full resolution.
const TRACE_FRESH = 0.22, TRACE_BASE = 0.08, TRACE_HALF = 40;
const traceFresh = {}, traceBase = {};
let stamps = [], fadeAcc = 0;
// The fresh layer fades in steps of at least FADE_STEP seconds: one frame's share of a 40 s
// half-life is far below what an 8-bit canvas can hold, so per-frame fades would round away.
const FADE_STEP = 1.5;
function fadeBy(g, w, h, secs) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.5, secs / TRACE_HALF)})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}
// draw every stamp so far into a base and a fresh layer, the fresh one fading between stamps
// exactly as it does live (used when the layers are resized, and for the saved painting)
function replayTrace(B, F, w, h, now) {
  B.fillStyle = '#000'; F.fillStyle = '#000';
  let last = stamps.length ? stamps[0].t : now;
  for (const st of stamps) {
    if (st.t - last >= FADE_STEP) { fadeBy(F, w, h, st.t - last); last = st.t; }
    for (const L of [B, F]) { L.beginPath(); L.arc(st.x, st.y, st.r, 0, Math.PI * 2); L.fill(); }
  }
  if (now - last >= FADE_STEP) fadeBy(F, w, h, now - last);
}
function stampTrace(ctx, path, fromA, toA, wet, now) {
  const scale = ctx.getTransform().a || 1;
  const F = layer(traceFresh, scale), B = layer(traceBase, scale);
  if (traceFresh.fresh || traceBase.fresh) {   // new size (full screen, a resize): redraw it all
    traceFresh.fresh = traceBase.fresh = false;
    const w = traceFresh.cv.width;
    for (const L of [F, B]) { L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, w, w); L.restore(); }
    replayTrace(B, F, w, w, now);
  }
  F.fillStyle = '#000'; B.fillStyle = '#000';
  for (let m = Math.ceil(fromA * SUBS * 2); m / (SUBS * 2) <= toA; m++) {
    const a = m / (SUBS * 2), p = path.point(a);
    const r = Math.max(1, widthAt(0.04, a, wet) + ragAt(a, 1) * 0.6);
    for (const L of [F, B]) { L.beginPath(); L.arc(p.x, p.y, r, 0, Math.PI * 2); L.fill(); }
    stamps.push({ x: p.x, y: p.y, r, t: now });
  }
}
function fadeTrace(dt) {
  if (!traceFresh.cv) return;
  fadeAcc += dt;
  if (fadeAcc < FADE_STEP) return;
  fadeBy(traceFresh.cv.getContext('2d'), traceFresh.cv.width, traceFresh.cv.height, fadeAcc);
  fadeAcc = 0;
}
function clearTrace() {
  for (const L of [traceFresh, traceBase]) if (L.cv) { const g = L.cv.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.cv.width, L.cv.height); g.restore(); }
  stamps = []; fadeAcc = 0;
}
// lay one trace layer on the paper, with the paper's tooth showing through it
const traceTex = {};
function layTrace(ctx, src, alpha, scale) {
  if (!src) return;
  const T = layer(traceTex, scale);
  T.save(); T.setTransform(1, 0, 0, 1, 0, 0);
  T.clearRect(0, 0, traceTex.cv.width, traceTex.cv.height);
  T.drawImage(src, 0, 0, traceTex.cv.width, traceTex.cv.height);
  T.globalCompositeOperation = 'destination-out'; T.globalAlpha = 0.45;
  T.drawImage(grain(scale), 0, 0, traceTex.cv.width, traceTex.cv.height);
  T.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.filter = 'blur(0.5px)';
  ctx.drawImage(traceTex.cv, 0, 0, SIZE, SIZE);
  ctx.restore();
}
function paintTrace(ctx) {
  const scale = ctx.getTransform().a || 1;
  layTrace(ctx, traceBase.cv, TRACE_BASE, scale);
  layTrace(ctx, traceFresh.cv, TRACE_FRESH, scale);
}

/* ——— the foot of the saved painting ———
   Below the painting, on the same paper (mirrored, so the grain meets itself at the fold), the
   card's kind word sits centred in black ink in a formal copperplate hand (Petit Formal Script,
   shipped in fonts/). Under it, a little luck from js/luck.js: five lotto numbers in ink rings
   and a 12-word BIP-39 phrase, with a pencilled caution. The painting itself is left clear. */
const SCRIPT = '"Petit Formal Script", "Snell Roundhand", "Apple Chancery", "Edwardian Script ITC", cursive';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const BLACK_INK = '#100d0a';
const QUOTE_W = SIZE - 110, LUCK_H = 290;   // the quote's measure; the luck block's height (with the date row and sigil)

// the words on one line if they fit at a generous size, else on two lines of about equal
// length (so no word is left alone on the second), at the largest size from `from` to `to`
function fitLines(ctx, text, maxW, from, to) {
  const words = text.split(/\s+/);
  const width = (s) => ctx.measureText(s).width;
  for (let size = from; size >= 22; size -= 1) {   // one line, if it can stay large
    ctx.font = `${size}px ${SCRIPT}`;
    if (width(text) <= maxW) return { lines: [text], size, lh: size * 1.4 };
  }
  let best = null;
  for (let size = from; size >= to; size -= 1) {
    ctx.font = `${size}px ${SCRIPT}`;
    best = null;
    for (let k = 1; k < words.length; k++) {   // the split whose longer half is shortest
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), w = Math.max(width(a), width(b));
      if (!best || w < best.w) best = { lines: [a, b], w };
    }
    if (!best || best.w <= maxW) return { lines: best ? best.lines : [text], size, lh: size * 1.4 };
  }
  return { lines: best ? best.lines : [text], size: to, lh: to * 1.4 };
}
// how tall the foot must be for this quote
function footHeight(quote) {
  const text = String(quote || '').trim();
  if (!text) return 30 + LUCK_H;
  const { lines, size, lh } = fitLines(document.createElement('canvas').getContext('2d'), text, QUOTE_W, 28, 15);
  return 26 + size + (lines.length - 1) * lh + 30 + LUCK_H;
}
// the kind word, centred in black ink; returns where the next thing may start
function inscribe(ctx, quote, top) {
  const text = String(quote || '').trim();
  if (!text) return top + 4;
  const { lines, size, lh } = fitLines(ctx, text, QUOTE_W, 28, 15);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = BLACK_INK;
  ctx.font = `${size}px ${SCRIPT}`;
  lines.forEach((l, k) => ctx.fillText(l, SIZE / 2, top + 26 + size + k * lh));
  ctx.restore();
  return top + 26 + size + (lines.length - 1) * lh + 30;
}
// five lucky numbers and the twelve words, centred under the quote
function colophon(ctx, luck, top) {
  if (!luck) return;
  const cx = SIZE / 2;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = (t, y) => {
    ctx.font = `600 8.5px ${MONO}`; ctx.letterSpacing = '2px'; ctx.fillStyle = 'rgba(16,13,10,.55)';
    ctx.fillText(t.toUpperCase(), cx + 1, y);
    ctx.letterSpacing = '0px';
  };
  ctx.strokeStyle = 'rgba(16,13,10,.3)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - 60, top); ctx.lineTo(cx + 60, top); ctx.stroke();
  label('lucky numbers', top + 20);
  const ry = top + 48;
  luck.lotto.forEach((n, i) => {
    const x = cx + (i - (luck.lotto.length - 1) / 2) * 40;
    ctx.strokeStyle = BLACK_INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, ry, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = BLACK_INK; ctx.font = `600 12px ${MONO}`;
    ctx.fillText(String(n).padStart(2, '0'), x, ry + 0.5);
  });
  label(`seed phrase · bip-39 · ${luck.phrase.length} words`, ry + 36);
  ctx.textAlign = 'left'; ctx.font = `500 10.5px ${MONO}`;
  const cw = 112, x0 = cx - cw * 2 + 16, y0 = ry + 58;
  luck.phrase.forEach((w, i) => {
    const x = x0 + (i % 4) * cw, y = y0 + Math.floor(i / 4) * 17;
    ctx.fillStyle = 'rgba(16,13,10,.42)'; ctx.fillText(String(i + 1).padStart(2, '0'), x, y);
    ctx.fillStyle = BLACK_INK; ctx.fillText(w, x + 21, y);
  });
  // a caution, said plainly: whoever has these words has the wallet
  const wy = y0 + 3 * 17 + 10;
  ctx.textAlign = 'center';
  ctx.font = `700 8px ${MONO}`; ctx.letterSpacing = '1.5px'; ctx.fillStyle = 'rgba(150,40,30,.88)';
  ctx.fillText('CAUTION', cx + 1, wy);
  ctx.letterSpacing = '0px'; ctx.font = `500 8px ${MONO}`; ctx.fillStyle = 'rgba(16,13,10,.7)';
  ctx.fillText('These 12 words are a BIP-39 seed: the master key of a BIP-32 wallet. Whoever reads them owns every coin in it.', cx, wy + 13);
  ctx.fillText('This one has been on a screen and in a picture file. Keep it for luck; never send real funds to it.', cx, wy + 25);
  // the bottom row: when it was made at the left, its own sigil in the corner
  const by = wy + 25 + 46, when = new Date(luck.at || Date.now());
  const id = Array.from(luck.sigil || [], (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 9.5px ${MONO}`; ctx.fillStyle = 'rgba(16,13,10,.78)';
  ctx.fillText(`ink · ${when.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} · ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 24, by - 3);
  ctx.font = `500 8.5px ${MONO}`; ctx.fillStyle = 'rgba(16,13,10,.5)';
  ctx.fillText(`sigil ${id} · stacknest brush stroke`, 24, by + 11);
  if (luck.sigil) sigil(ctx, SIZE - 50, by, 27, luck.sigil);
  ctx.restore();
}

// a sigil of its own for every saved painting, drawn from 16 random bytes: a double ring with
// ticks where bits are set, and a line walked through points on an inner circle, begun with a
// small circle and ended with a bar, as old sigils were; a dot of seal-red at its heart
function sigil(ctx, x, y, r, bytes) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66];
  });
  ctx.save();
  ctx.translate(x, y); ctx.rotate((bytes[0] / 256) * Math.PI * 2);
  ctx.strokeStyle = BLACK_INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, r - 4.5, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 32; i++) {
    if (!((bytes[1 + (i >> 3)] >> (i & 7)) & 1)) continue;
    const a = (i / 32) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 4.5), Math.sin(a) * (r - 4.5)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
  }
  const walk = [bytes[5] % 9];
  for (let k = 0; k < 5 + (bytes[6] % 3); k++) walk.push((walk[k] + 1 + (bytes[7 + k] % 8)) % 9);
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  walk.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[p][0], pts[p][1]));
  ctx.stroke();
  const [sx, sy] = pts[walk[0]];
  ctx.lineWidth = 1.2; ctx.fillStyle = '#efe4cc';
  ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const [ex, ey] = pts[walk[walk.length - 1]], [qx, qy] = pts[walk[walk.length - 2]];
  const len = Math.hypot(ex - qx, ey - qy) || 1, nx = -(ey - qy) / len, ny = (ex - qx) / len;
  ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(ex + nx * 4.5, ey + ny * 4.5); ctx.lineTo(ex - nx * 4.5, ey - ny * 4.5); ctx.stroke();
  ctx.fillStyle = 'rgba(178,44,34,.92)';
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// the finished painting at print size: the paper, the trace redrawn from its stamps (faded by
// age, as on screen), the last stroke and the seal; then the foot below it, with the quote, the
// luck, the date and time, and the painting's own sigil (all made once per painting by the caller)
function artwork(seed, runs, wet, now, quote = '', luck = null) {
  const scale = 2.5, px = Math.round(SIZE * scale), tall = SIZE + footHeight(quote);
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(tall * scale);
  const ctx = cv.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sheet = paper(scale, seed);
  ctx.drawImage(sheet, 0, 0, SIZE, SIZE);
  ctx.save(); ctx.translate(0, SIZE * 2); ctx.scale(1, -1); ctx.drawImage(sheet, 0, 0, SIZE, SIZE); ctx.restore();   // the foot
  const base = document.createElement('canvas'); base.width = px; base.height = px;
  const fresh = document.createElement('canvas'); fresh.width = px; fresh.height = px;
  const bg = base.getContext('2d'), fg = fresh.getContext('2d');
  bg.setTransform(scale, 0, 0, scale, 0, 0); fg.setTransform(scale, 0, 0, scale, 0, 0);
  replayTrace(bg, fg, px, px, now);
  layTrace(ctx, base, TRACE_BASE, scale);
  layTrace(ctx, fresh, TRACE_FRESH, scale);
  if (runs?.length) paintStroke(ctx, runs, wet);
  seal(ctx, SIZE - 70, SIZE - 70);   // the painting stays clear: its date and time are in the foot now
  // the soft fold between the painting and its foot, then what the foot carries
  const fold = ctx.createLinearGradient(0, SIZE - 7, 0, SIZE + 7);
  fold.addColorStop(0, 'rgba(60,40,20,0)'); fold.addColorStop(0.5, 'rgba(60,40,20,.16)'); fold.addColorStop(1, 'rgba(60,40,20,0)');
  ctx.fillStyle = fold; ctx.fillRect(0, SIZE - 7, SIZE, 14);
  colophon(ctx, luck, inscribe(ctx, quote, SIZE));
  return cv;
}

/* ——— the desk ———
   In full screen the sheet lies on a low desk of oiled elm that fills the rest of the screen:
   boards running its length, each cut through its own growth rings (worked out per pixel),
   with pores and fibres, the joints between them and an old ink mark or two; a soft shadow
   under the sheet; and round it the tools of the hand — an ink stone with its pool of ink and
   its stick, a celadon water dropper, a spotted-bamboo brush on a porcelain rest, a seal and
   its box of vermilion paste, and a rosewood paperweight holding the sheet's right edge. Light
   falls from the upper left, as on the ink drops' gloss. In the square frame none of it is
   drawn. It is built once for each canvas size, a few slices a frame so that going full screen
   never stalls the stroke, then fades in; after that a frame only copies it. */
const NT = (() => { const r = rng(90217), t = new Float32Array(65536); for (let i = 0; i < t.length; i++) t[i] = r(); return t; })();
function n2(x, y) {   // smooth value noise from a table: quick enough to run for every pixel
  const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = xf & 255, x1 = (xf + 1) & 255, y0 = (yf & 255) << 8, y1 = ((yf + 1) & 255) << 8;
  const a = NT[y0 | x0], b = NT[y0 | x1], c = NT[y1 | x0], d = NT[y1 | x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// the desk's boards, running its length. Each is a slice of a log: its rings are the cylinders
// round the pith, cut by a plane whose distance from the pith wanders along the board, so they
// show as long arches and loops; earlywood pale, latewood darkening to the ring's edge.
const BOARDS = (() => {
  const r = rng(5113), seams = [-34, 104, 257, 391, 537, 690];
  return seams.slice(1).map((y1, i) => {
    const y0 = seams[i], h = y1 - y0, tone = 0.92 + r() * 0.16;
    return {
      i, y0, y1, col: [150 * tone, 103 * tone * (0.97 + r() * 0.06), 63 * tone * (0.92 + r() * 0.16)],
      pith: y0 + h * (r() < 0.5 ? 0.2 + r() * 0.6 : (r() < 0.5 ? -0.7 : 1.4) + r() * 0.3),
      d0: 8 + r() * 46, a1: 30 + r() * 60, f1: 1 / (150 + r() * 200), p1: r() * 6.283, a2: 14 + r() * 26, o: 10 + r() * 200, sp: 5.5 + r() * 4,
    };
  });
})();
// for each board, the squared distance of the cut from the pith down every column
function woodCols(w, q, u0) {
  return BOARDS.map((b) => {
    const a = new Float32Array(w);
    for (let px = 0; px < w; px++) {
      const u = u0 + (px + 0.5) / q;
      const d = Math.abs(b.d0 + b.a1 * Math.sin(u * b.f1 + b.p1) + b.a2 * (n2(u / 120 + b.o, 7.3) - 0.5) * 2) + 3;
      a[px] = d * d;
    }
    return a;
  });
}
// rows yA…yB of the wood, q pixels to the unit, the first column at u0 (from the sheet's middle)
function woodRows(d, w, q, u0, cols, yA, yB) {
  for (let py = yA; py < yB; py++) {
    const y = (py + 0.5) / q;
    let bi = 0;
    while (bi < BOARDS.length - 1 && y >= BOARDS[bi].y1) bi++;
    const b = BOARDS[bi], cc = cols[bi], [cr, cg, cb] = b.col;
    const dy = y - b.pith, dy2 = dy * dy, yw = y * 0.03 + b.o, ys = y * 0.45 + b.o * 3, ys2 = y * 1.8 + b.o;
    const e = Math.min(y - b.y0, b.y1 - y), edge = e < 5 ? 0.14 * (1 - e / 5) ** 2 : 0;   // the boards' eased edges
    let i = py * w * 4;
    for (let px = 0; px < w; px++, i += 4) {
      const u = u0 + (px + 0.5) / q;
      const rr = Math.sqrt(cc[px] + dy2) + (n2(u * 0.0045 + b.o, yw) - 0.5) * 10;
      let t = rr / b.sp;
      t += 0.9 * n2(t * 0.31 + b.o, 3.7);   // rings of uneven width, as the years were
      const ring = Math.floor(t), f = t - ring;
      let lw = 0;
      if (f > 0.4) { const z = Math.min(1, (f - 0.4) / 0.5); lw = z * z * (3 - 2 * z); if (f > 0.95) lw *= (1 - f) / 0.05; }
      const k = 0.45 + 0.55 * NT[(ring * 7919 + b.i * 977) & 65535];
      const dark = lw * k * 0.34 + (n2(u * 0.012 + b.o, ys) - 0.5) * 0.16 + (n2(u * 0.07, ys2) - 0.5) * 0.08 + edge;
      d[i] = cr * (1 - dark); d[i + 1] = cg * (1 - dark * 1.12); d[i + 2] = cb * (1 - dark * 1.25); d[i + 3] = 255;
    }
  }
}
// on the wood, x0…x1 of one side: pores and fibres, the joints, the sheet's shadow, the light
function woodFinish(g, x0, x1, side, ox, s) {
  const w = x1 - x0, r = rng(side ? 4409 : 2203);
  g.lineCap = 'round';
  const n = Math.round((w * SIZE) / 60);
  for (const [a, share, lw] of [[0.14, 0.62, 0.5], [0.26, 0.3, 0.6], [0.42, 0.08, 0.7]]) {
    g.strokeStyle = `rgba(44,22,9,${a})`; g.lineWidth = lw; g.beginPath();
    for (let i = 0; i < n * share; i++) { const x = x0 + r() * w, y = r() * SIZE, l = 0.8 + r() * 2.8; g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 0.3); }
    g.stroke();
  }
  for (const [col, per] of [['rgba(44,22,9,.09)', 1 / 700], ['rgba(255,220,170,.06)', 1 / 1100]]) {
    g.strokeStyle = col; g.lineWidth = 0.6; g.beginPath();
    for (let i = 0; i < w * SIZE * per; i++) {
      const x = x0 - 40 + r() * (w + 40), y = r() * SIZE, l = 24 + r() * 90;
      g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (r() - 0.5) * 1.4, x + l * 0.7, y + (r() - 0.5) * 1.4, x + l, y + (r() - 0.5) * 1.2);
    }
    g.stroke();
  }
  for (const b of BOARDS) {
    const y = b.y0;
    if (y <= 0 || y >= SIZE) continue;
    g.fillStyle = 'rgba(28,14,6,.14)'; g.fillRect(x0, y - 3.2, w, 3.2);
    g.fillStyle = 'rgba(20,10,4,.78)'; g.fillRect(x0, y - 0.75, w, 1.5);
    g.fillStyle = 'rgba(255,224,178,.13)'; g.fillRect(x0, y + 0.75, w, 1.1);
  }
  // the sheet lies a hair above the wood
  g.save(); g.filter = `blur(${9 * s}px)`; g.fillStyle = 'rgba(20,10,4,.5)'; g.fillRect(ox + 5, -60, SIZE, SIZE + 120); g.restore();
  g.save(); g.filter = `blur(${1.8 * s}px)`; g.fillStyle = 'rgba(16,8,3,.55)'; g.fillRect(ox + 0.8, -60, SIZE + 0.6, SIZE + 120); g.restore();
  // the light falls away toward the screen's edges, and comes warm from the upper left
  const far = side ? g.createLinearGradient(ox + SIZE, 0, ox + SIZE + 1000, 0) : g.createLinearGradient(ox, 0, ox - 1000, 0);
  for (const [at, a] of [[0, 0], [0.1, 0.05], [0.3, 0.17], [0.6, 0.36], [1, 0.5]]) far.addColorStop(at, `rgba(14,7,2,${a})`);
  g.fillStyle = far; g.fillRect(x0, 0, w, SIZE);
  const tb = g.createLinearGradient(0, 0, 0, SIZE);
  tb.addColorStop(0, 'rgba(14,7,2,.2)'); tb.addColorStop(0.22, 'rgba(14,7,2,0)'); tb.addColorStop(0.7, 'rgba(14,7,2,0)'); tb.addColorStop(1, 'rgba(14,7,2,.28)');
  g.fillStyle = tb; g.fillRect(x0, 0, w, SIZE);
  g.save(); g.globalCompositeOperation = 'soft-light';
  const lt = g.createRadialGradient(ox + 80, -140, 0, ox + 80, -140, 1200);
  lt.addColorStop(0, 'rgba(255,226,176,.6)'); lt.addColorStop(1, 'rgba(255,226,176,0)');
  g.fillStyle = lt; g.fillRect(x0, 0, w, SIZE);
  g.restore();
}

// a soft shadow of whatever `shape` traces, thrown down and to the right
function castShadow(g, s, dx, dy, blur, alpha, shape) {
  g.save(); g.translate(dx, dy); g.filter = `blur(${blur * s}px)`; g.fillStyle = `rgba(14,7,2,${alpha})`;
  g.beginPath(); shape(); g.fill(); g.restore();
}
// which of a rotated thing's long sides (local −y: −1, +y: 1) faces the light
const litSide = (ang) => (Math.cos(ang) - Math.sin(ang) > 0 ? -1 : 1);
// a made-up character of a few strokes, for gilt, carving and seals
function glyph(g, x, y, sz, seed) {
  const r = rng(seed * 131 + 7), n = 3 + Math.floor(r() * 4);
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const kind = r(), ax = x + (r() - 0.5) * sz * 0.8, ay = y + (r() - 0.5) * sz * 0.8;
    if (kind < 0.4) { g.moveTo(x - sz / 2 + r() * sz * 0.2, ay); g.lineTo(x + sz / 2 - r() * sz * 0.2, ay + (r() - 0.5) * sz * 0.1); }
    else if (kind < 0.7) { g.moveTo(ax, y - sz / 2 + r() * sz * 0.2); g.lineTo(ax + (r() - 0.5) * sz * 0.1, y + sz / 2 - r() * sz * 0.2); }
    else if (kind < 0.85) { g.moveTo(ax, ay); g.lineTo(ax + (r() < 0.5 ? -1 : 1) * sz * 0.3, ay + sz * 0.35); }
    else { g.moveTo(ax, ay); g.lineTo(ax + sz * 0.08, ay + sz * 0.12); }
  }
  g.stroke();
}

// old ink, long dry: a few spots where a brush was shaken, a ring where a wet dropper stood
function inkMarks(g, x, y, s) {
  const r = rng(613);
  g.save(); g.globalCompositeOperation = 'multiply';
  g.filter = `blur(${0.6 * s}px)`;
  for (let k = 0; k < 7; k++) {
    const a = r() * 6.283, d = 6 + r() * 40;
    g.fillStyle = `rgba(30,22,18,${0.25 + r() * 0.3})`;
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 0.8 + r() * 2.4, 0, Math.PI * 2); g.fill();
  }
  g.filter = `blur(${0.8 * s}px)`; g.strokeStyle = 'rgba(40,24,12,.2)'; g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(x + 30, y + 46, 20, 19, 0.3, 0.3, 5.6); g.stroke();
  g.restore();
}

function inkStick(g, cx, cy, ang, s) {
  const L = 80, W = 15, lit = litSide(ang);
  castShadow(g, s, 2.5, 3.5, 2.2, 0.6, () => { g.translate(cx, cy); g.rotate(ang); g.roundRect(-L / 2, -W / 2, L, W, 1.6); });
  g.save(); g.translate(cx, cy); g.rotate(ang);
  const gr = g.createLinearGradient(0, (lit * W) / 2, 0, (-lit * W) / 2);
  gr.addColorStop(0, '#3a3532'); gr.addColorStop(0.18, '#252120'); gr.addColorStop(0.8, '#171413'); gr.addColorStop(1, '#0c0a0a');
  g.fillStyle = gr; g.beginPath(); g.roundRect(-L / 2, -W / 2, L, W, 1.6); g.fill();
  // the ground end, worn smooth and still wet
  const end = g.createLinearGradient(-L / 2, 0, -L / 2 + 10, 0);
  end.addColorStop(0, 'rgba(0,0,0,.6)'); end.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = end; g.fillRect(-L / 2, -W / 2, 10, W);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-L / 2 + 1, -W / 2 + 2, 1.2, W - 4);
  // a gilt panel with its maker's characters
  g.strokeStyle = 'rgba(206,168,88,.8)'; g.lineWidth = 0.7; g.strokeRect(-L / 2 + 18, -W / 2 + 3, L - 26, W - 6);
  g.strokeStyle = 'rgba(214,178,98,.9)'; g.lineWidth = 0.75; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { g.save(); g.translate(-L / 2 + 28 + k * 16, 0); g.rotate(Math.PI / 2); glyph(g, 0, 0, 6.5, 20 + k); g.restore(); }
  g.restore();
}

function inkStone(g, cx, cy, s) {
  const w = 100, h = 170, x = cx - w / 2, y = cy - h / 2, r = rng(311);
  const body = () => g.roundRect(x, y, w, h, 9);
  castShadow(g, s, 7, 9, 9, 0.5, body);
  castShadow(g, s, 1.6, 2, 1.8, 0.6, body);
  g.save();
  const bg = g.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, '#4d4548'); bg.addColorStop(0.5, '#3a3336'); bg.addColorStop(1, '#2a2427');
  g.fillStyle = bg; g.beginPath(); body(); g.fill(); g.clip();
  for (let i = 0; i < 320; i++) {   // the stone's speckle and a few faint veins
    g.fillStyle = r() < 0.55 ? `rgba(255,240,236,${0.03 + r() * 0.06})` : `rgba(0,0,0,${0.1 + r() * 0.12})`;
    const sz = 0.5 + r() * 1.1; g.fillRect(x + r() * w, y + r() * h, sz, sz);
  }
  g.lineWidth = 0.7;
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(200,180,190,${0.05 + r() * 0.05})`; g.beginPath();
    let px = x + r() * w, py = y; g.moveTo(px, py);
    while (py < y + h) { px += (r() - 0.5) * 9; py += 6 + r() * 10; g.lineTo(px, py); }
    g.stroke();
  }
  // the rim's edges: lit along the top and left, in shade along the bottom and right
  g.lineWidth = 2.2;
  g.strokeStyle = 'rgba(255,238,226,.17)'; g.beginPath(); g.moveTo(x + 1.6, y + h - 9); g.lineTo(x + 1.6, y + 9); g.arcTo(x + 1.6, y + 1.6, x + 9, y + 1.6, 7.5); g.lineTo(x + w - 9, y + 1.6); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(x + w - 1.4, y + 9); g.lineTo(x + w - 1.4, y + h - 9); g.arcTo(x + w - 1.4, y + h - 1.4, x + w - 9, y + h - 1.4, 7.5); g.lineTo(x + 9, y + h - 1.4); g.stroke();
  g.restore();
  // the hollow: a well of ink at the head, the grinding face sloping down to it
  const ix = x + 10, iy = y + 10, iw = w - 20, ih = h - 20, well = 52;
  g.save();
  g.beginPath(); g.roundRect(ix, iy, iw, ih, 6); g.clip();
  const face = g.createLinearGradient(0, iy + well - 14, 0, iy + ih);
  face.addColorStop(0, '#120f10'); face.addColorStop(0.3, '#211c1e'); face.addColorStop(1, '#302a2c');
  g.fillStyle = face; g.fillRect(ix, iy, iw, ih);
  // a film of fresh ink where the stick has been ground, and the circles it left
  g.save(); g.filter = `blur(${5 * s}px)`; g.fillStyle = 'rgba(6,5,5,.55)'; g.beginPath(); g.ellipse(cx, iy + well + 34, 30, 38, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.lineWidth = 0.8;
  for (let k = 0; k < 7; k++) {
    const rad = 10 + k * 4 + r() * 2, a0 = r() * 6;
    g.strokeStyle = k % 2 ? 'rgba(150,140,150,.06)' : 'rgba(0,0,0,.18)';
    g.beginPath(); g.ellipse(cx + (r() - 0.5) * 4, iy + well + 36, rad * 0.86, rad, 0, a0, a0 + 3.5); g.stroke();
  }
  // the pool
  const pool = () => {
    g.moveTo(ix, iy + well - 16); g.lineTo(ix, iy + 6); g.quadraticCurveTo(ix, iy, ix + 6, iy); g.lineTo(ix + iw - 6, iy);
    g.quadraticCurveTo(ix + iw, iy, ix + iw, iy + 6); g.lineTo(ix + iw, iy + well - 16);
    g.bezierCurveTo(ix + iw, iy + well + 6, ix, iy + well + 6, ix, iy + well - 16); g.closePath();
  };
  const ink = g.createLinearGradient(0, iy, 0, iy + well);
  ink.addColorStop(0, '#0a0807'); ink.addColorStop(1, '#040303');
  g.fillStyle = ink; g.beginPath(); pool(); g.fill();
  // the window's light on its surface, and the meniscus where it meets the slope
  g.save(); g.clip();
  g.filter = `blur(${3 * s}px)`; g.fillStyle = 'rgba(214,220,232,.2)'; g.beginPath(); g.ellipse(ix + iw * 0.4, iy + 15, 24, 7, -0.12, 0, Math.PI * 2); g.fill();
  g.filter = `blur(${0.8 * s}px)`; g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(ix + iw * 0.33, iy + 13, 9, 2.2, -0.12, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(190,182,186,.2)'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(ix + 2, iy + well - 14); g.bezierCurveTo(ix + 2, iy + well + 5.5, ix + iw - 2, iy + well + 5.5, ix + iw - 2, iy + well - 14); g.stroke();
  // the hollow's walls: the top and left in shade, the bottom and right catching the light
  g.save(); g.filter = `blur(${2.5 * s}px)`; g.fillStyle = 'rgba(0,0,0,.65)';
  g.beginPath(); g.rect(ix - 30, iy - 30, iw + 60, ih + 60); g.roundRect(ix + 3, iy + 3.5, iw, ih, 6); g.fill('evenodd'); g.restore();
  g.save(); g.filter = `blur(${0.8 * s}px)`; g.fillStyle = 'rgba(255,236,226,.14)';
  g.beginPath(); g.rect(ix - 30, iy - 30, iw + 60, ih + 60); g.roundRect(ix - 1.4, iy - 1.4, iw, ih, 6); g.fill('evenodd'); g.restore();
  g.restore();
  inkStick(g, cx + 8, iy + well + 42, -1.2, s);
}

function dropper(g, cx, cy, s) {
  const R = 22, sa = -0.75, r = rng(41);
  const spout = () => { g.save(); g.translate(cx, cy); g.rotate(sa); g.roundRect(R - 8, -5, 18, 10, 5); g.restore(); };
  const shape = () => { g.arc(cx, cy, R, 0, Math.PI * 2); spout(); };
  castShadow(g, s, 6, 8, 8, 0.45, shape);
  castShadow(g, s, 1.5, 2, 2, 0.55, shape);
  g.save(); g.translate(cx, cy); g.rotate(sa);
  const sp = g.createLinearGradient(0, -5, 0, 5);
  sp.addColorStop(0, '#c4dac8'); sp.addColorStop(0.5, '#93b39e'); sp.addColorStop(1, '#678872');
  g.fillStyle = sp; g.beginPath(); g.roundRect(R - 8, -5, 18, 10, 5); g.fill();
  g.strokeStyle = 'rgba(60,84,70,.45)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#26322b'; g.beginPath(); g.ellipse(R + 7.5, 0, 1.6, 2.6, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  const bg = g.createRadialGradient(cx - 8, cy - 9, 1, cx, cy, R);
  bg.addColorStop(0, '#eef5ea'); bg.addColorStop(0.28, '#c3d9c5'); bg.addColorStop(0.72, '#90b09b'); bg.addColorStop(1, '#6a8a76');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.save(); g.clip();
  // the celadon's crackle
  g.strokeStyle = 'rgba(64,88,72,.26)'; g.lineWidth = 0.45; g.beginPath();
  for (let k = 0; k < 16; k++) {
    let a = r() * 7; const d = r() * R; let px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
    g.moveTo(px, py);
    for (let j = 0; j < 4; j++) { a += (r() - 0.5) * 1.6; const l = 3 + r() * 5; px += Math.cos(a) * l; py += Math.sin(a) * l; g.lineTo(px, py); }
  }
  g.stroke();
  // warm light thrown back from the desk along its lower edge
  g.filter = `blur(${1.2 * s}px)`; g.strokeStyle = 'rgba(214,170,118,.32)'; g.lineWidth = 2.4;
  g.beginPath(); g.arc(cx, cy, R - 1.5, 0.15, 1.75); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(58,82,66,.5)'; g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, R - 0.4, 0, Math.PI * 2); g.stroke();
  // the collar round the filling hole
  const hx = cx + 2, hy = cy + 1.5;
  const col = g.createRadialGradient(hx - 2, hy - 2, 0.5, hx, hy, 6.5);
  col.addColorStop(0, '#d9e8da'); col.addColorStop(1, '#88a893');
  g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 6.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(58,82,66,.45)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#1d2721'; g.beginPath(); g.arc(hx + 0.3, hy + 0.3, 2.7, 0, Math.PI * 2); g.fill();
  // the glaze's gloss
  g.save(); g.filter = `blur(${1.4 * s}px)`; g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - 9, cy - 10, 6.5, 3.3, -0.75, 0, Math.PI * 2); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(cx - 10, cy - 11, 2.4, 1.1, -0.75, 0, Math.PI * 2); g.fill();
}

// a porcelain rest of two low peaks, lying across the brush (ang: the brush's direction)
function brushRest(g, x, y, ang, s) {
  const a = ang + Math.PI / 2, L = 58, Wd = 15, lit = litSide(a);
  const shape = () => { g.translate(x, y); g.rotate(a); g.roundRect(-L / 2, -Wd / 2, L, Wd, Wd / 2); };
  castShadow(g, s, 3, 4, 3, 0.5, shape);
  castShadow(g, s, 1, 1.4, 1.2, 0.5, shape);
  g.save(); g.translate(x, y); g.rotate(a);
  const along = g.createLinearGradient(-L / 2, 0, L / 2, 0);
  for (const [o, c] of [[0, '#b9bab6'], [0.22, '#f6f4ee'], [0.5, '#cfd0cc'], [0.78, '#f6f4ee'], [1, '#b2b3ae']]) along.addColorStop(o, c);
  g.fillStyle = along; g.beginPath(); g.roundRect(-L / 2, -Wd / 2, L, Wd, Wd / 2); g.fill();
  const across = g.createLinearGradient(0, (lit * Wd) / 2, 0, (-lit * Wd) / 2);
  across.addColorStop(0, 'rgba(255,255,255,.35)'); across.addColorStop(0.45, 'rgba(255,255,255,0)'); across.addColorStop(1, 'rgba(60,60,70,.3)');
  g.fillStyle = across; g.fill();
  g.strokeStyle = 'rgba(52,84,146,.55)'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(-L / 2 + 6, 0); g.bezierCurveTo(-L / 4, -2, -L / 8, 2, 0, 0); g.bezierCurveTo(L / 8, -2, L / 4, 2, L / 2 - 6, 0); g.stroke();
  g.fillStyle = 'rgba(52,84,146,.7)';
  for (const px of [-L * 0.28, L * 0.28]) { g.beginPath(); g.arc(px, 0, 1.6, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(80,80,90,.35)'; g.lineWidth = 0.6; g.beginPath(); g.roundRect(-L / 2, -Wd / 2, L, Wd, Wd / 2); g.stroke();
  g.restore();
}

// a spotted-bamboo brush from the end of its handle (tx, ty) to the tip of its hair (px, py)
function brushOnRest(g, tx, ty, px, py, s) {
  const dx = px - tx, dy = py - ty, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, ang = Math.atan2(uy, ux);
  let nx = -uy, ny = ux;
  if (nx + ny > 0) { nx = -nx; ny = -ny; }   // n: across the brush, toward the light
  const at = (d, o = 0) => [tx + ux * d + nx * o, ty + uy * d + ny * o];
  const HAIR = 50, FER = 6, HANDLE = len - HAIR - FER, REST = HANDLE - 16, H0 = HANDLE + FER;
  const hairR = (v) => (5.4 + 2.4 * Math.sin(Math.PI * 0.5 * Math.min(1, v / 0.5))) * Math.pow(Math.max(0, 1 - Math.pow(v, 2.2)), 0.9);
  const radAt = (d) => (d < 8 ? 5.4 : d < HANDLE ? 5 : d < H0 ? 5.7 : hairR((d - H0) / HAIR));
  const across = (stops) => {
    const [ax, ay] = at(0, 5.6), [bx, by] = at(0, -5.6), gr = g.createLinearGradient(ax, ay, bx, by);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  brushRest(g, ...at(REST), ang, s);
  // its shadow: the end lies on the desk, the rest lifts it toward the hair
  castShadow(g, s, 0, 0, 3.2, 0.42, () => {
    const a = [], b = [];
    for (let d = -3; d <= len; d += 4) {
      const k = Math.max(0, Math.min(1, d / REST)), sx = 1.5 + k * 6.5, sy = 2 + k * 8.5, rad = d < 0 ? 4 : radAt(d);
      const [ax, ay] = at(d, rad), [bx, by] = at(d, -rad);
      a.push([ax + sx, ay + sy]); b.push([bx + sx, by + sy]);
    }
    g.moveTo(...a[0]); for (const p of a) g.lineTo(...p); for (const p of b.reverse()) g.lineTo(...p); g.closePath();
  });
  // the silk loop it hangs by
  g.strokeStyle = '#7e2c20'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(...at(-11), 8.5, 3.6, ang, 0, Math.PI * 2); g.stroke();
  // the handle
  const BAMBOO = [[0, '#9c7f4a'], [0.16, '#efdcae'], [0.42, '#d4b57c'], [0.78, '#a4854f'], [1, '#6c5230']];
  g.lineCap = 'butt'; g.strokeStyle = across(BAMBOO); g.lineWidth = 10;
  g.beginPath(); g.moveTo(...at(7)); g.lineTo(...at(HANDLE)); g.stroke();
  g.save();
  g.beginPath(); g.moveTo(...at(7, 5)); g.lineTo(...at(HANDLE, 5)); g.lineTo(...at(HANDLE, -5)); g.lineTo(...at(7, -5)); g.closePath(); g.clip();
  const r = rng(907);
  g.filter = `blur(${0.5 * s}px)`;
  for (let k = 0; k < 11; k++) {   // the bamboo's spots, like old tears
    const [x, y] = at(14 + r() * (HANDLE - 24), (r() - 0.5) * 7);
    g.fillStyle = `rgba(118,62,26,${0.35 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, 2 + r() * 3.5, 1 + r() * 1.4, ang, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  for (const d of [HANDLE * 0.36, HANDLE * 0.72]) {   // its joints
    g.strokeStyle = across(BAMBOO); g.lineWidth = 11; g.beginPath(); g.moveTo(...at(d - 2.2)); g.lineTo(...at(d + 2.2)); g.stroke();
    g.strokeStyle = 'rgba(84,58,28,.6)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(...at(d, 5.4)); g.lineTo(...at(d, -5.4)); g.stroke();
    g.strokeStyle = 'rgba(255,244,214,.45)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(...at(d + 1.4, 5.1)); g.lineTo(...at(d + 1.4, -5.1)); g.stroke();
  }
  // the horn cap at its end, and the lacquered collar that holds the hair
  g.strokeStyle = across([[0, '#5a4636'], [0.2, '#3d2e22'], [1, '#140e0a']]); g.lineWidth = 10.8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(...at(3)); g.lineTo(...at(8)); g.stroke();
  g.lineCap = 'butt'; g.strokeStyle = across([[0, '#6b5443'], [0.2, '#4a3628'], [0.7, '#2c1f16'], [1, '#160f0a']]); g.lineWidth = 11.4;
  g.beginPath(); g.moveTo(...at(HANDLE - 0.5)); g.lineTo(...at(H0)); g.stroke();
  // the hair: pale at the root, soaked with ink toward the point
  const vs = []; for (let k = 0; k <= 25; k++) vs.push(k / 25);
  const hair = () => {
    g.moveTo(...at(H0, hairR(0)));
    for (const v of vs) g.lineTo(...at(H0 + v * HAIR, hairR(v)));
    for (let k = vs.length - 1; k >= 0; k--) g.lineTo(...at(H0 + vs[k] * HAIR, -hairR(vs[k])));
    g.closePath();
  };
  const hg = g.createLinearGradient(...at(H0), px, py);
  for (const [o, c] of [[0, '#ece3cc'], [0.2, '#d9cbaa'], [0.32, '#7a6c5c'], [0.44, '#241e19'], [1, '#0c0a08']]) hg.addColorStop(o, c);
  g.fillStyle = hg; g.beginPath(); hair(); g.fill();
  g.save(); g.clip();
  g.fillStyle = across([[0, 'rgba(255,255,255,.22)'], [0.35, 'rgba(255,255,255,0)'], [0.65, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.35)']]);
  g.beginPath(); hair(); g.fill();
  const r2 = rng(53);
  g.lineWidth = 0.4;
  for (let k = 0; k < 14; k++) {
    const o = (r2() - 0.5) * 1.6, v1 = 0.25 + r2() * 0.5;
    g.strokeStyle = v1 < 0.4 ? 'rgba(255,250,236,.35)' : 'rgba(0,0,0,.3)';
    g.beginPath(); g.moveTo(...at(H0, o * hairR(0)));
    for (let v = 0.05; v <= v1; v += 0.05) g.lineTo(...at(H0 + v * HAIR, o * hairR(v)));
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.8; g.beginPath();   // the wet ink's gloss
  for (let k = 0; k <= 11; k++) { const v = 0.42 + k * 0.04, p = at(H0 + v * HAIR, hairR(v) * 0.5); k ? g.lineTo(...p) : g.moveTo(...p); }
  g.stroke();
  g.restore();
}

// a stone seal lying on its side: honey-coloured, a little beast carved on its top, its face red
function sealStone(g, cx, cy, ang, s) {
  const lit = litSide(ang), r = rng(271);
  const outline = () => { g.moveTo(-29, -11); g.lineTo(14, -11); g.bezierCurveTo(22, -12.5, 29.5, -7, 29.5, 0); g.bezierCurveTo(29.5, 7, 22, 12.5, 14, 11); g.lineTo(-29, 11); g.closePath(); };
  castShadow(g, s, 3, 4, 3.2, 0.5, () => { g.translate(cx, cy); g.rotate(ang); outline(); });
  castShadow(g, s, 1, 1.3, 1.1, 0.5, () => { g.translate(cx, cy); g.rotate(ang); outline(); });
  g.save(); g.translate(cx, cy); g.rotate(ang);
  const sg = g.createLinearGradient(0, lit * 11, 0, -lit * 11);
  sg.addColorStop(0, '#f6d898'); sg.addColorStop(0.3, '#e2ac60'); sg.addColorStop(0.75, '#c08038'); sg.addColorStop(1, '#8e5622');
  g.fillStyle = sg; g.beginPath(); outline(); g.fill();
  g.save(); g.clip();
  const glow = g.createRadialGradient(-6, 0, 2, -6, 0, 26);   // light through the stone
  glow.addColorStop(0, 'rgba(255,226,160,.35)'); glow.addColorStop(1, 'rgba(255,226,160,0)');
  g.fillStyle = glow; g.fillRect(-30, -12, 60, 24);
  g.lineWidth = 0.6;
  for (let k = 0; k < 5; k++) {
    g.strokeStyle = k % 2 ? 'rgba(255,238,204,.4)' : 'rgba(120,62,20,.28)'; g.beginPath();
    let x = -28 + r() * 40, y = -11; g.moveTo(x, y);
    while (y < 11) { x += (r() - 0.3) * 5; y += 3 + r() * 4; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(104,56,18,.55)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(14, -10); g.bezierCurveTo(13, -4, 13, 4, 14, 10); g.stroke();
  g.beginPath(); g.arc(22, -2, 4, 0.5, 4.2); g.stroke();
  g.beginPath(); g.arc(21, 5, 2.6, -1, 2.4); g.stroke();
  g.beginPath(); g.moveTo(25, -6); g.quadraticCurveTo(28, -2, 26, 3); g.stroke();
  g.restore();
  g.fillStyle = 'rgba(176,38,26,.9)'; g.fillRect(-29, -11, 1.8, 22);
  g.fillStyle = 'rgba(176,38,26,.35)';
  for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-26 + r() * 4, -9 + r() * 18, 0.5 + r() * 0.7, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(255,250,232,.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-27, lit * 9.6); g.lineTo(13, lit * 9.6); g.stroke();
  g.restore();
}

// the porcelain box of seal paste, open: its rim, and the worked vermilion inside
function pasteBox(g, cx, cy, s) {
  const R = 27, P = R - 6.5, r = rng(71), disc = () => g.arc(cx, cy, R, 0, Math.PI * 2);
  castShadow(g, s, 4, 6, 6, 0.48, disc);
  castShadow(g, s, 1, 1.5, 1.6, 0.55, disc);
  const pg = g.createRadialGradient(cx - 9, cy - 10, 2, cx, cy, R);
  pg.addColorStop(0, '#fdfcf7'); pg.addColorStop(0.7, '#e9e5da'); pg.addColorStop(1, '#c8c1b2');
  g.fillStyle = pg; g.beginPath(); disc(); g.fill();
  g.strokeStyle = 'rgba(92,80,64,.4)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(48,80,142,.7)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R - 2.4, 0, Math.PI * 2); g.stroke();
  const wg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  wg.addColorStop(0, '#9d968a'); wg.addColorStop(1, '#efebe2');
  g.fillStyle = wg; g.beginPath(); g.arc(cx, cy, R - 4.6, 0, Math.PI * 2); g.fill();
  const red = g.createRadialGradient(cx - 5, cy - 6, 1, cx, cy, P);
  red.addColorStop(0, '#d65640'); red.addColorStop(0.6, '#b93222'); red.addColorStop(1, '#8c2214');
  g.fillStyle = red; g.beginPath(); g.arc(cx + 0.6, cy + 0.6, P, 0, Math.PI * 2); g.fill();
  g.save(); g.clip();
  g.lineWidth = 0.45;
  for (const [c, n] of [['rgba(255,178,156,.2)', 160], ['rgba(70,8,4,.22)', 160]]) {   // its silk-fibred texture
    g.strokeStyle = c; g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = r() * 7, d = Math.sqrt(r()) * P, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, b = r() * 7, l = 0.8 + r() * 2.2;
      g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
    }
    g.stroke();
  }
  // where the seal was last pressed into it
  g.save(); g.translate(cx + 3.5, cy + 3); g.rotate(0.18);
  g.fillStyle = 'rgba(96,14,8,.22)'; g.fillRect(-6.5, -6.5, 13, 13);
  g.strokeStyle = 'rgba(70,8,4,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6.5, 6.5); g.lineTo(-6.5, -6.5); g.lineTo(6.5, -6.5); g.stroke();
  g.strokeStyle = 'rgba(255,170,150,.35)'; g.beginPath(); g.moveTo(6.5, -6.5); g.lineTo(6.5, 6.5); g.lineTo(-6.5, 6.5); g.stroke();
  g.restore();
  // the rim's shadow across the paste
  g.filter = `blur(${2 * s}px)`; g.fillStyle = 'rgba(40,6,2,.45)';
  g.beginPath(); g.rect(cx - 60, cy - 60, 120, 120); g.moveTo(cx + 2.8 + P, cy + 3.2); g.arc(cx + 2.8, cy + 3.2, P, 0, Math.PI * 2); g.fill('evenodd');
  g.restore();
  g.save(); g.filter = `blur(${0.6 * s}px)`; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.3;
  g.beginPath(); g.arc(cx, cy, R - 1.2, Math.PI * 1.08, Math.PI * 1.45); g.stroke(); g.restore();
}

// the box's lid, set down beside it: blue and white, a flower under the glaze
function pasteLid(g, cx, cy, s) {
  const R = 28, disc = () => g.arc(cx, cy, R, 0, Math.PI * 2), BLUE = (a) => `rgba(46,78,140,${a})`;
  castShadow(g, s, 4, 6, 6, 0.45, disc);
  castShadow(g, s, 1, 1.5, 1.6, 0.5, disc);
  const lg = g.createRadialGradient(cx - 10, cy - 11, 1, cx, cy, R);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.35, '#f2f0ea'); lg.addColorStop(0.85, '#d8d3c6'); lg.addColorStop(1, '#bcb4a5');
  g.fillStyle = lg; g.beginPath(); disc(); g.fill();
  g.strokeStyle = 'rgba(92,80,64,.4)'; g.lineWidth = 0.8; g.stroke();
  g.save(); g.filter = `blur(${0.35 * s}px)`;
  g.strokeStyle = BLUE(0.75); g.lineWidth = 1.3; g.beginPath(); g.arc(cx, cy, R - 3.2, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 0.6; g.beginPath(); g.arc(cx, cy, R - 6, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    g.fillStyle = BLUE(0.32); g.beginPath(); g.ellipse(cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 7.5, 5.6, 2.8, a, 0, Math.PI * 2); g.fill();
    g.strokeStyle = BLUE(0.7); g.lineWidth = 0.7; g.stroke();
  }
  g.fillStyle = BLUE(0.85); g.beginPath(); g.arc(cx, cy, 2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 0.6; g.strokeStyle = BLUE(0.55);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / 5;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
    g.quadraticCurveTo(cx + Math.cos(a + 0.25) * 15, cy + Math.sin(a + 0.25) * 15, cx + Math.cos(a - 0.05) * 18, cy + Math.sin(a - 0.05) * 18); g.stroke();
  }
  g.restore();
  g.save(); g.filter = `blur(${1.4 * s}px)`; g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(cx - 10, cy - 11, 7, 3.4, -0.75, 0, Math.PI * 2); g.fill(); g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - 11, cy - 12, 2.6, 1.1, -0.75, 0, Math.PI * 2); g.fill();
}

// a bar of rosewood, a poem cut into it and filled with green, lying on the sheet's edge
function paperweight(g, x, y, w, h, s) {
  const bar = () => g.roundRect(x, y, w, h, 4), r = rng(1213);
  castShadow(g, s, 4, 6, 6, 0.55, bar);
  castShadow(g, s, 1, 1.5, 1.5, 0.6, bar);
  const bg = g.createLinearGradient(x, 0, x + w, 0);
  bg.addColorStop(0, '#5e382a'); bg.addColorStop(0.2, '#4b2b20'); bg.addColorStop(0.7, '#3a2019'); bg.addColorStop(1, '#22120d');
  g.fillStyle = bg; g.beginPath(); bar(); g.fill();
  g.save(); g.clip();
  g.lineWidth = 0.5;
  for (let k = 0; k < 46; k++) {   // its close, dark grain
    g.strokeStyle = r() < 0.6 ? `rgba(18,6,3,${0.2 + r() * 0.25})` : `rgba(150,86,58,${0.1 + r() * 0.12})`;
    g.beginPath(); let gx = x + r() * w; g.moveTo(gx, y);
    for (let yy = y; yy <= y + h; yy += 8) { gx += (r() - 0.5) * 0.9; g.lineTo(gx, yy); }
    g.stroke();
  }
  g.filter = `blur(${0.8 * s}px)`; g.fillStyle = 'rgba(255,214,186,.16)'; g.fillRect(x + 3, y + 3, 2.5, h - 6);   // the polish
  g.restore();
  g.strokeStyle = 'rgba(255,220,196,.22)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + 4, y + 0.8); g.lineTo(x + w - 4, y + 0.8); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 3.6); g.stroke();
  const gx = x + w / 2 + 1;
  g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const gy = y + 24 + k * 23;
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.5; g.save(); g.translate(-0.5, -0.6); glyph(g, gx, gy, 11, 50 + k); g.restore();
    g.strokeStyle = 'rgba(148,192,166,.9)'; g.lineWidth = 1.1; glyph(g, gx, gy, 11, 50 + k);
  }
  g.fillStyle = 'rgba(176,46,34,.85)'; g.fillRect(gx - 4, y + h - 26, 8, 8);
  g.strokeStyle = 'rgba(240,220,200,.6)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(gx - 2, y + h - 24); g.lineTo(gx + 2, y + h - 24); g.moveTo(gx, y + h - 24); g.lineTo(gx, y + h - 20); g.stroke();
}

// where everything lies, for a sheet whose left edge is at ox (so each side is ox wide). Things
// keep to the sheet, spreading a little on a wider screen; whatever wouldn't fit is left out.
function deskLayout(ox) {
  const sw = ox, t = Math.max(0, Math.min(1, (sw - 170) / 240)), L = (a, b) => a + (b - a) * t;
  const Lx = ox, Rx = ox + SIZE, out = [];
  const add = (side, fits, draw) => { if (fits) out.push({ side, draw }); };
  const st = Math.min(L(98, 142), sw / 2 + 8), sy = L(210, 222);
  add(0, st >= 60 && st + 62 <= sw, (g, s) => inkMarks(g, Lx - st - 4, sy + 104, s));
  add(0, st >= 60 && st + 62 <= sw, (g, s) => inkStone(g, Lx - st, sy, s));
  const dd = Math.min(L(86, 112), sw - 40);
  add(0, dd >= 36 && dd + 36 <= sw, (g, s) => dropper(g, Lx - dd, L(470, 486), s));
  const bd = L(72, 108);
  add(1, bd + 44 <= sw, (g, s) => brushOnRest(g, Rx + bd - 22, L(112, 120), Rx + bd + 22, L(370, 384), s));
  const sd = L(126, 176);
  add(1, sd + 38 <= sw, (g, s) => sealStone(g, Rx + sd, L(424, 436), 0.55, s));
  const pd = Math.min(L(66, 96), sw - 38);
  add(1, pd >= 40 && pd + 36 <= sw, (g, s) => pasteBox(g, Rx + pd, L(504, 512), s));
  add(1, pd >= 40 && pd + 98 <= sw, (g, s) => pasteLid(g, Rx + pd + 62, L(534, 548), s));
  return out;
}

// the desk for a canvas pw × ph (device pixels), a slice at a time: two side strips, and the
// paperweight in a small layer of its own, since it lies over the sheet
function* buildDesk(pw, ph) {
  const s = ph / SIZE, oxDev = Math.round((pw - ph) / 2), ox = oxDev / s, Rx = ox + SIZE;
  const D = { key: `${pw}x${ph}`, pw, ph, at: 0, left: null, right: null, fg: null };
  const q = Math.min(s, 1.5), lay = deskLayout(ox);
  const sides = [{ X0: 0, dev: Math.max(1, oxDev), x0: 0 }, { X0: oxDev + ph, dev: Math.max(1, pw - oxDev - ph), x0: Rx }];
  for (const [i, sd] of sides.entries()) {
    const cv = document.createElement('canvas');
    cv.width = sd.dev; cv.height = ph;
    const g = cv.getContext('2d'), x1 = sd.x0 + sd.dev / s;
    const wq = Math.max(1, Math.ceil((x1 - sd.x0) * q)), hq = Math.round(SIZE * q), u0 = sd.x0 - (ox + SIZE / 2);
    const img = new ImageData(wq, hq), cols = woodCols(wq, q, u0);
    for (let y = 0; y < hq; y += 48) { woodRows(img.data, wq, q, u0, cols, y, Math.min(hq, y + 48)); yield; }
    const tmp = document.createElement('canvas');
    tmp.width = wq; tmp.height = hq;
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.setTransform(s, 0, 0, s, -sd.X0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(tmp, sd.x0, 0, wq / q, SIZE);
    yield;
    woodFinish(g, sd.x0, x1, i, ox, s);
    yield;
    for (const it of lay) if (it.side === i) { it.draw(g, s); yield; }
    if (i) D.right = cv; else D.left = cv;
  }
  if (ox >= 30) {
    const dx = -Math.round(24 * s), dy = Math.round(56 * s);
    const cv = document.createElement('canvas');
    cv.width = Math.round(80 * s); cv.height = Math.round(222 * s);
    const g = cv.getContext('2d');
    g.setTransform(s, 0, 0, s, -(oxDev + ph + dx), -dy);
    paperweight(g, Rx - 7, 72, 28, 174, s);
    D.fg = { cv, dx, dy };
  }
  return D;
}

const desks = new Map();   // `${pw}x${ph}` → a finished desk; the last two are kept
const BARE = '#5d3f28';    // the wood's colour, while the desk is still being laid out
function deskRunner() {
  let job = null, shown = null, prev = null, seenKey = '', seenAt = 0, lastStart = -1e9;
  // a desk built for another size is drawn scaled, kept against the sheet's edges
  const sides = (ctx, D, pw, ph, oxDev, alpha) => {
    const k = ph / D.ph, lw = D.left.width * k, rw = D.right.width * k, rx = oxDev + ph;
    ctx.globalAlpha = alpha;
    if (D.pw === pw && D.ph === ph) { ctx.drawImage(D.left, 0, 0); ctx.drawImage(D.right, rx, 0); return; }
    ctx.drawImage(D.left, oxDev - lw, 0, lw, ph); ctx.drawImage(D.right, rx, 0, rw, ph);
    ctx.fillStyle = BARE;
    if (oxDev - lw > 0) ctx.fillRect(0, 0, oxDev - lw, ph);
    if (rx + rw < pw) ctx.fillRect(rx + rw, 0, pw - rx - rw, ph);
  };
  const weight = (ctx, D, ph, oxDev, alpha) => {
    if (!D.fg) return;
    const k = ph / D.ph;
    ctx.globalAlpha = alpha;
    ctx.drawImage(D.fg.cv, oxDev + ph + D.fg.dx * k, D.fg.dy * k, D.fg.cv.width * k, D.fg.cv.height * k);
  };
  const fadeOf = (now) => (shown ? Math.min(1, (now - shown.at) / 300) : 0);
  return {
    under(ctx, pw, ph, oxDev) {
      const now = performance.now(), key = `${pw}x${ph}`;
      if (key !== seenKey) { seenKey = key; seenAt = now; }
      if (shown?.key !== key) {
        const ready = desks.get(key);
        if (ready) { job = null; prev = null; shown = ready; ready.at = -1e9; }   // seen before: back at once
        else {
          // a jump (into full screen) starts at once; while the window is dragged, wait for it to settle
          if (job?.key !== key && (!shown || now - seenAt >= 120 || now - lastStart > 500)) { job = { key, it: buildDesk(pw, ph) }; lastStart = now; }
          if (job?.key === key) {
            const t0 = performance.now();
            let step;
            do step = job.it.next(); while (!step.done && performance.now() - t0 < 5);
            if (step.done) {
              const D = step.value;
              desks.set(key, D);
              while (desks.size > 2) desks.delete(desks.keys().next().value);
              prev = shown; shown = D; D.at = now; job = null;
            }
          }
        }
      }
      const fade = fadeOf(now);
      if (fade >= 1) prev = null;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fade < 1) {
        if (prev) sides(ctx, prev, pw, ph, oxDev, 1);
        else { ctx.fillStyle = BARE; ctx.fillRect(0, 0, oxDev, ph); ctx.fillRect(oxDev + ph, 0, pw - oxDev - ph, ph); }
      }
      if (shown) sides(ctx, shown, pw, ph, oxDev, fade);
      ctx.restore();
    },
    over(ctx, pw, ph, oxDev) {
      const fade = fadeOf(performance.now());
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fade < 1 && prev) weight(ctx, prev, ph, oxDev, 1);
      if (shown) weight(ctx, shown, ph, oxDev, fade);
      ctx.restore();
    },
  };
}

export function preview(ctx) {
  ctx.drawImage(paper(ctx.getTransform().a || 1, 7), 0, 0, SIZE, SIZE);
  inkDrop(ctx, 11 * C + C / 2, 5 * C + C / 2, 0, 3);
  const cells = [[3, 11], [3, 10], [3, 9], [4, 9], [5, 9], [5, 8], [5, 7], [6, 7], [7, 7], [7, 6], [8, 6], [9, 6], [10, 6]];
  const trail = cells.map((c, i) => ({ c, d: i ? [c[0] - cells[i - 1][0], c[1] - cells[i - 1][1]] : [0, -1] }));
  const path = makePath(trail, 0);
  paintStroke(ctx, sampleStroke(path, 0.2, trail.length - 1, 1), 1);
}

export function start(canvas, { setScore, isPaused, finish }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const desk = deskRunner();   // in full screen, the desk round the sheet
  document.fonts?.load(`40px ${SCRIPT}`).catch(() => { /* the fallbacks will do */ });   // ready for the inscription
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* none */ }
  let state = 'ready', t = 0, acc = 0, dir, queue, food, gathered, restT = 0, wet = 1, blooms = [], eating = [];
  let trail, base, len, visLen, stamped, moves = 0;   // trail of cells, index of trail[0], body length in cells
  let seed = 1 + Math.floor(Math.random() * 1e6), carded = false, lastRuns = null;   // a new sheet for every painting
  const occupied = () => trail.slice(-len).map((e) => e.c);
  const head = () => base + trail.length - 1;
  const place = () => {
    const taken = occupied();
    for (;;) { const f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N), seed: Math.floor(Math.random() * 1000) }; if (!taken.some(([x, y]) => x === f.x && y === f.y)) return f; }
  };
  const reset = () => {
    trail = [[3, 8], [4, 8], [5, 8], [6, 8], [7, 8]].map((c) => ({ c, d: [1, 0] }));
    base = 0; len = 4; visLen = 3.2; stamped = 0.5;
    dir = [1, 0]; queue = []; gathered = 0; wet = 1; blooms = []; eating = [];
    food = place();
    clearTrace();
    // a new sheet only after a finished painting: the one shown on the title is the one painted on
    if (state === 'rest') seed = 1 + Math.floor(Math.random() * 1e6);
    carded = false; moves = 0;
  };
  const say = () => setScore(`${gathered} drop${gathered === 1 ? '' : 's'} of ink${best ? ` · best ${best}` : ''}`);
  reset();

  // the snake's own movement, stirred into the saved painting's phrase on top of the system's
  // random bytes (js/luck.js): the sub-millisecond moment of every turn, its way, how far the
  // brush had come, and each press and swipe's exact place and time
  const stir = new Float64Array(512);
  let stirN = 0;
  const stirIn = (...v) => { for (const x of v) stir[stirN++ % stir.length] = x; };
  const stirBytes = () => new Uint8Array(stir.buffer, 0, Math.min(stirN, stir.length) * 8);
  const turn = (d) => {
    stirIn(performance.now(), d[0] * 3 + d[1], moves, len);
    if (state !== 'run') { if (state === 'rest' && restT < 0.6) return; reset(); state = 'run'; say(); swish(0.04); return; }
    const last = queue.length ? queue[queue.length - 1] : dir;
    if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
    if (queue.length < 3) { queue.push(d); swish(0.035); }
  };
  const onKey = (e) => { const d = DIRS[e.key] || DIRS[e.key.toLowerCase?.()]; if (d) { e.preventDefault(); turn(d); } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(dir); } };
  let swipe = null;
  const onDown = (e) => { stirIn(e.timeStamp, e.clientX, e.clientY); canvas.focus({ preventScroll: true }); swipe = { x: e.clientX, y: e.clientY }; if (state !== 'run') turn(dir); };
  const onUp = (e) => {
    stirIn(e.timeStamp, e.clientX, e.clientY);
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  function advance() {
    if (queue.length) dir = queue.shift();
    const [hx, hy] = trail[trail.length - 1].c;
    const next = [(hx + dir[0] + N) % N, (hy + dir[1] + N) % N];
    if (occupied().slice(1).some(([x, y]) => x === next[0] && y === next[1])) {
      state = 'rest'; restT = 0;
      if (gathered > best) { best = gathered; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* not kept */ } }
      note(0, { dur: 1.6, vol: 0.05 }); note(4, { dur: 1.6, vol: 0.035 });
      say();
      return;
    }
    trail.push({ c: next, d: [...dir] });
    moves += 1;
    if (next[0] === food.x && next[1] === food.y) {
      gathered += 1; len += 1; wet = 1;
      eating.push({ ...food, at: head() });   // absorbed when the fresh end reaches it
      food = place();
      say();
    }
    // keep only what the stroke (and its glide) can still reach
    while (trail.length > len + 6) { trail.shift(); base += 1; }
    wet = Math.max(0.72, wet - 0.01);
  }

  function update(dt) {
    t += dt;
    const every = Math.max(0.1, 0.19 - gathered * 0.0025);
    if (state === 'run') { acc += dt; while (acc >= every) { acc -= every; advance(); if (state !== 'run') break; } }
    else if (state === 'rest') restT += dt;
    visLen += (len - 0.8 - visLen) * Math.min(1, dt * 3);   // a new drop lengthens it smoothly, never with a jump
    for (const b of blooms) { b.r += dt * 26; b.l -= dt * 0.7; }
    blooms = blooms.filter((b) => b.l > 0);

    // the fresh end glides through the newest crossed cell; the dry end follows at visLen
    const k = state === 'run' ? Math.min(1, acc / every) : (state === 'rest' ? 1 : 0.5);
    const headA = head() - 1 + k;
    const tailA = Math.max(base, headA - visLen);
    const path = makePath(trail, base);
    if (headA > stamped) { stampTrace(ctx, path, stamped, headA, wet, t); stamped = headA; }
    if (state === 'run') fadeTrace(dt);
    for (const e of eating) {
      if (!e.done && headA >= e.at - 0.15) { e.done = true; blooms.push({ x: e.x * C + C / 2, y: e.y * C + C / 2, r: 6, l: 1 }); drip(0.07); }
    }
    eating = eating.filter((e) => !e.done);

    // the sheet stays a 640 square; a wider canvas (full screen) centres it on the desk, whose
    // sides are drawn first and whose paperweight is laid over the sheet's edge last
    const pw = canvas.width, ph = canvas.height;
    const oxDev = (canvas._snW || SIZE) - SIZE >= 1 ? Math.round((pw - ph) / 2) : 0;
    if (oxDev > 0) desk.under(ctx, pw, ph, oxDev);
    ctx.save();
    ctx.translate(oxDev / (ph / SIZE), 0);
    ctx.drawImage(paper(ctx.getTransform().a || 1, seed, { live: true }), 0, 0, SIZE, SIZE);
    paintTrace(ctx);
    for (const b of blooms) {
      const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(22,19,15,${0.22 * b.l})`); g.addColorStop(1, 'rgba(22,19,15,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of eating) inkDrop(ctx, e.x * C + C / 2, e.y * C + C / 2, t, e.seed);
    inkDrop(ctx, food.x * C + C / 2, food.y * C + C / 2, t, food.seed);
    lastRuns = sampleStroke(path, tailA, headA, wet);
    paintStroke(ctx, lastRuns, wet);
    if (state === 'rest' && restT > 0.4) seal(ctx, SIZE - 70, SIZE - 70);
    if (state === 'ready') card(ctx, [{ text: 'Brush Stroke', size: 34, weight: 700, color: '#2a2219' }, { text: 'Arrow keys, WASD or swipe to begin', size: 17, weight: 500, color: '#4a3d2c' }], { y: 160, shadow: 'rgba(243,232,207,.9)' });
    ctx.restore();
    if (oxDev > 0) desk.over(ctx, pw, ph, oxDev);
    // the painting is finished: a moment to see it with its seal, then the card (with Save)
    if (state === 'rest' && restT > 1.2 && !carded && finish) {
      carded = true;
      const runs = lastRuns, w = wet, at = t, sd = seed, luck = luckFor(stirBytes());   // one painting, one luck
      const d = new Date(), pad = (n) => String(n).padStart(2, '0');
      finish({
        title: 'the brush lifts',
        stats: `${gathered} drop${gathered === 1 ? '' : 's'} of ink · ${moves} cell${moves === 1 ? '' : 's'} travelled${best ? ` · best ${best}` : ''}`,
        againLabel: 'Paint again',
        again: () => { reset(); state = 'run'; say(); swish(0.04); },
        // the card's switch: save the painting with the last black stroke on it, or the trace alone
        strokeToggle: true,
        artwork: ({ quote, stroke = true } = {}) => artwork(sd, stroke ? runs : null, w, at, quote, luck),
        artworkName: `stacknest-ink-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`,
      });
    }
  }
  say();
  const stopLoop = runLoop(update, isPaused);
  const stopMusic = playMusic(SUMI, isPaused);
  return () => { stopLoop(); stopMusic(); canvas.removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); };
}
