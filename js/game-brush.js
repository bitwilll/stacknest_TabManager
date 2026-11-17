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

export const meta = { id: 'brush', title: 'Brush Stroke', blurb: 'One ink stroke over old paper, gathering drops of ink.', keys: 'Arrow keys, WASD or swipe' };
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

/* ——— the paper ——— */
let paperCache = null;
function paper(scale = 1) {
  if (paperCache?.scale === scale) return paperCache.cv;
  const cv = document.createElement('canvas');
  cv.width = Math.round(SIZE * scale); cv.height = Math.round(SIZE * scale);
  const p = cv.getContext('2d');
  p.setTransform(scale, 0, 0, scale, 0, 0);
  const r = rng(4242);
  const g = p.createRadialGradient(SIZE * 0.45, SIZE * 0.42, 60, SIZE / 2, SIZE / 2, SIZE * 0.78);
  g.addColorStop(0, '#f3e8cf'); g.addColorStop(0.65, '#ead9b6'); g.addColorStop(1, '#d6bd91');
  p.fillStyle = g; p.fillRect(0, 0, SIZE, SIZE);
  p.strokeStyle = 'rgba(120,88,48,.035)'; p.lineWidth = 1;   // laid lines of handmade paper
  for (let x = 12; x < SIZE; x += 26) { p.beginPath(); p.moveTo(x + r() * 2, 0); p.lineTo(x + r() * 2, SIZE); p.stroke(); }
  for (let i = 0; i < 2200; i++) {   // fibres
    const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI, l = 3 + r() * 11;
    p.strokeStyle = `rgba(${110 + r() * 40},${80 + r() * 30},${45 + r() * 20},${0.04 + r() * 0.06})`;
    p.lineWidth = 0.6 + r() * 0.6;
    p.beginPath(); p.moveTo(x, y); p.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke();
  }
  for (let i = 0; i < 700; i++) { p.fillStyle = `rgba(100,70,38,${0.05 + r() * 0.1})`; p.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 1.4, 1 + r() * 1.4); }
  p.filter = 'blur(3px)';
  for (let i = 0; i < 9; i++) { p.fillStyle = `rgba(150,96,46,${0.05 + r() * 0.07})`; p.beginPath(); p.arc(r() * SIZE, r() * SIZE, 3 + r() * 9, 0, Math.PI * 2); p.fill(); }
  p.filter = 'blur(1.4px)';   // an old coffee ring or two
  for (const [cx, cy, rad] of [[505, 150, 64], [120, 520, 46]]) {
    for (let k = 0; k < 3; k++) {
      p.strokeStyle = `rgba(140,88,40,${0.07 + k * 0.03})`; p.lineWidth = 6 - k * 2;
      p.beginPath(); p.ellipse(cx + k, cy - k, rad - k * 2, rad * 0.94 - k, 0.3, 0.2 + k * 0.4, Math.PI * 2 - 0.3 + k * 0.2); p.stroke();
    }
    p.fillStyle = 'rgba(160,110,60,.05)'; p.beginPath(); p.ellipse(cx, cy, rad - 4, rad * 0.9, 0.3, 0, Math.PI * 2); p.fill();
  }
  p.filter = 'none';
  const v = p.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.75);
  v.addColorStop(0, 'rgba(90,60,30,0)'); v.addColorStop(1, 'rgba(90,60,30,.28)');
  p.fillStyle = v; p.fillRect(0, 0, SIZE, SIZE);
  paperCache = { scale, cv };
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

// the trace: everything the fresh end has passed over, kept on its own layer and laid on the
// paper at about a fifth of the ink's strength
const traceCache = {};
function stampTrace(ctx, path, fromA, toA, wet) {
  const scale = ctx.getTransform().a || 1;
  const T = layer(traceCache, scale);
  if (traceCache.fresh) { traceCache.fresh = false; }
  T.fillStyle = '#000';
  for (let m = Math.ceil(fromA * SUBS * 2); m / (SUBS * 2) <= toA; m++) {
    const a = m / (SUBS * 2), p = path.point(a);
    const r = widthAt(0.04, a, wet) + ragAt(a, 1) * 0.6;
    T.beginPath(); T.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2); T.fill();
  }
}
function clearTrace() { if (traceCache.cv) { const g = traceCache.cv.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, traceCache.cv.width, traceCache.cv.height); g.restore(); } }
const traceTex = {};
function paintTrace(ctx) {
  if (!traceCache.cv) return;
  // the paper's tooth shows through the old ink, as it does through the fresh
  const scale = ctx.getTransform().a || 1;
  const T = layer(traceTex, scale);
  T.save(); T.setTransform(1, 0, 0, 1, 0, 0);
  T.clearRect(0, 0, traceTex.cv.width, traceTex.cv.height);
  T.drawImage(traceCache.cv, 0, 0);
  T.globalCompositeOperation = 'destination-out'; T.globalAlpha = 0.45;
  T.drawImage(grain(scale), 0, 0);
  T.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = TRACE;
  ctx.filter = 'blur(0.5px)';
  ctx.drawImage(traceTex.cv, 0, 0, SIZE, SIZE);
  ctx.restore();
}

export function preview(ctx) {
  ctx.drawImage(paper(ctx.getTransform().a || 1), 0, 0, SIZE, SIZE);
  inkDrop(ctx, 11 * C + C / 2, 5 * C + C / 2, 0, 3);
  const cells = [[3, 11], [3, 10], [3, 9], [4, 9], [5, 9], [5, 8], [5, 7], [6, 7], [7, 7], [7, 6], [8, 6], [9, 6], [10, 6]];
  const trail = cells.map((c, i) => ({ c, d: i ? [c[0] - cells[i - 1][0], c[1] - cells[i - 1][1]] : [0, -1] }));
  const path = makePath(trail, 0);
  paintStroke(ctx, sampleStroke(path, 0.2, trail.length - 1, 1), 1);
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* none */ }
  let state = 'ready', t = 0, acc = 0, dir, queue, food, gathered, restT = 0, wet = 1, blooms = [], eating = [];
  let trail, base, len, visLen, stamped;   // trail of cells, index of trail[0], body length in cells
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
  };
  const say = () => setScore(`${gathered} drop${gathered === 1 ? '' : 's'} of ink${best ? ` · best ${best}` : ''}`);
  reset();

  const turn = (d) => {
    if (state !== 'run') { if (state === 'rest' && restT < 0.6) return; reset(); state = 'run'; say(); swish(0.04); return; }
    const last = queue.length ? queue[queue.length - 1] : dir;
    if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
    if (queue.length < 3) { queue.push(d); swish(0.035); }
  };
  const onKey = (e) => { const d = DIRS[e.key] || DIRS[e.key.toLowerCase?.()]; if (d) { e.preventDefault(); turn(d); } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(dir); } };
  let swipe = null;
  const onDown = (e) => { canvas.focus({ preventScroll: true }); swipe = { x: e.clientX, y: e.clientY }; if (state !== 'run') turn(dir); };
  const onUp = (e) => {
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
    if (headA > stamped) { stampTrace(ctx, path, stamped, headA, wet); stamped = headA; }
    for (const e of eating) {
      if (!e.done && headA >= e.at - 0.15) { e.done = true; blooms.push({ x: e.x * C + C / 2, y: e.y * C + C / 2, r: 6, l: 1 }); drip(0.07); }
    }
    eating = eating.filter((e) => !e.done);

    ctx.drawImage(paper(ctx.getTransform().a || 1), 0, 0, SIZE, SIZE);
    paintTrace(ctx);
    for (const b of blooms) {
      const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(22,19,15,${0.22 * b.l})`); g.addColorStop(1, 'rgba(22,19,15,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of eating) inkDrop(ctx, e.x * C + C / 2, e.y * C + C / 2, t, e.seed);
    inkDrop(ctx, food.x * C + C / 2, food.y * C + C / 2, t, food.seed);
    paintStroke(ctx, sampleStroke(path, tailA, headA, wet), wet);
    if (state === 'rest' && restT > 0.4) seal(ctx, SIZE - 70, SIZE - 70);
    if (state === 'ready') card(ctx, [{ text: 'Brush Stroke', size: 34, weight: 700, color: '#2a2219' }, { text: 'Arrow keys, WASD or swipe to begin', size: 17, weight: 500, color: '#4a3d2c' }], { y: 160, shadow: 'rgba(243,232,207,.9)' });
    if (state === 'rest') card(ctx, [{ text: 'The brush lifts.', size: 28, weight: 700, color: '#2a2219' }, { text: `${gathered} drop${gathered === 1 ? '' : 's'} of ink in this painting`, size: 17, weight: 500, color: '#4a3d2c' },
      { text: restT > 0.6 ? 'Press an arrow to paint again' : ' ', size: 15, weight: 500, color: '#4a3d2c' }], { y: 160, shadow: 'rgba(243,232,207,.95)' });
  }
  say();
  const stopLoop = runLoop(update, isPaused);
  const stopMusic = playMusic(SUMI, isPaused);
  return () => { stopLoop(); stopMusic(); canvas.removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); };
}
