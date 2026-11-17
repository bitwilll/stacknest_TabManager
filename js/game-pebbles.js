// Pebbles — tic-tac-toe on a pond. Nine lily pads are the board; you toss pale pebbles from the
// near bank, the pond answers with dark stones from the far one. Each one arcs through the air,
// lands on its pad with a splash, and the ripples spread across the water. A koi drifts below.
// The pond plays well but not perfectly (now and then it is simply admiring the view), so rounds
// can be won. Who starts alternates. Click a pad, or use the arrow keys and Enter (or 1–9).
// Every stone that lands rings the next step of the major scale (do, re, mi, fa, sol…), so a
// round climbs as it fills; a win resolves on a chord.
// In full screen the board stays a square in the middle and the pond carries on to the screen's
// edges: more lily pads (some in flower, none in play), mossy banks with stones and reeds, the
// odd koi passing and a ring where a fish rises.

import { SIZE, setupCanvas, runLoop, tone, card, pointIn, splash } from './arcade-kit.js';
import { water, koi } from './game-ripples.js';

export const meta = { id: 'pebbles', title: 'Pebbles', blurb: 'Tic-tac-toe on a pond: toss a pebble onto a lily pad.', keys: 'Click a pad, arrows + Enter, or 1–9', wide: true };
const SCORE_KEY = 'stacknest:arcade-pebbles';
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const B = 456, X0 = (SIZE - B) / 2, Y0 = 150, CELL = B / 3, PAD = 60, FLIGHT = 0.8;

const DOREMI = [60, 62, 64, 65, 67, 69, 71, 72, 74];   // do re mi fa sol la ti do re
const centre = (i) => [X0 + (i % 3) * CELL + CELL / 2, Y0 + Math.floor(i / 3) * CELL + CELL / 2];
const PADS = Array.from({ length: 9 }, (_, i) => ({ a: ((i * 2.399) % (Math.PI * 2)), shade: i % 3 }));

const winner = (b) => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l }; return b.every(Boolean) ? { who: 'draw' } : null; };

function minimax(b, me, turn) {
  const w = winner(b);
  if (w) return { s: w.who === 'draw' ? 0 : w.who === me ? 10 : -10 };
  let best = { s: turn === me ? -Infinity : Infinity, i: -1 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const r = minimax(b, me, turn === 'P' ? 'G' : 'P');
    b[i] = null;
    const s = r.s - Math.sign(r.s) * 0.01;   // prefer quicker wins, slower losses
    if (turn === me ? s > best.s : s < best.s) best = { s, i };
  }
  return best;
}

function lilyPad(ctx, x, y, a, shade, dip, glow) {
  ctx.save();
  ctx.translate(x, y + dip * 3);
  ctx.scale(1 - dip * 0.05, 1 - dip * 0.05);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.arc(5, 7, PAD, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(5, 7); ctx.fill();
  ctx.fillStyle = ['#5c9a5a', '#67a462', '#548f53'][shade];
  ctx.beginPath(); ctx.arc(0, 0, PAD, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(0, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.arc(-8, -10, PAD * 0.7, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(0, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,40,.32)'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 8; k++) { const r = 0.5 + k * 0.72; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(r) * PAD * 0.92, Math.sin(r) * PAD * 0.92); ctx.stroke(); }
  ctx.restore();
  if (glow) {
    ctx.strokeStyle = glow; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + dip * 3, PAD + 9, 0, Math.PI * 2); ctx.stroke();
  }
}

function stone(ctx, x, y, kind, s = 1) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,30,20,.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 8, 28 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kind === 'P' ? '#f3efe6' : '#3f4247';
  ctx.beginPath(); ctx.ellipse(x, y, 28 * s, 21 * s, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kind === 'P' ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.ellipse(x - 9 * s, y - 7 * s, 10 * s, 5.5 * s, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ——— the wider pond (full screen) ———
   Everything out here is drawn in the board's own space, under a translate that centres the
   square, so it lies at x < 0 (left) and x > SIZE (right). Each side is laid out in "edge" units,
   e = distance in from that side's outer edge. What never moves (the water's light, the banks,
   their stones and grass, the shallows) is painted once per width into one picture; the pads,
   reeds, koi and rings are drawn over it every frame. */

// the square's water (the pond as it is in the frame)
function pondWater(ctx, t) {
  const g = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 40, SIZE / 2, SIZE / 2, SIZE * 0.8);
  g.addColorStop(0, '#2f6f73'); g.addColorStop(1, '#173f48');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  // caustic light
  ctx.strokeStyle = 'rgba(190,240,230,.06)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x += 32) { const y = i * 76 + Math.sin(x * 0.02 + t * 0.6 + i) * 10; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
}

// the same caustic light on a wider pond, each line running from one shore to the other
function caustics(ctx, t, span) {
  ctx.strokeStyle = 'rgba(190,240,230,.06)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const [xa, xb] = span(i * 76), y = (x) => i * 76 + Math.sin(x * 0.02 + t * 0.6 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(xa, y(xa));
    for (let x = Math.ceil(xa / 32 + 0.01) * 32; x < xb; x += 32) ctx.lineTo(x, y(x));
    ctx.lineTo(xb, y(xb));
    ctx.stroke();
  }
}

const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const TAU = Math.PI * 2;
const GREENS = ['#5c9a5a', '#67a462', '#548f53'];
const REEDS = ['#6e9a55', '#5f8b4c', '#80a960', '#557f46', '#8fb46a'];
const ROCKS = [['#70756d', '#959a90'], ['#646a64', '#868b84'], ['#7b8075', '#a0a498'], ['#6d6862', '#918a81']];
const KOI = [['#f5f1ea', '#e8643a'], ['#f08a3c', '#fbe9d6'], ['#f4efe6', '#2b2b2b'], ['#f2c14e', '#fff3d6']];

// a water lily, open (pink or white), seen from above
function lily(c, x, y, s, white) {
  c.fillStyle = 'rgba(10,40,25,.22)';
  c.beginPath(); c.ellipse(x + 2.5, y + 3.5, 12 * s, 10 * s, 0, 0, TAU); c.fill();
  const outer = white ? ['#e9e4d9', '#f7f4ec'] : ['#eaa6b9', '#f5cbd7'];
  for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.2; c.fillStyle = outer[k % 2]; c.beginPath(); c.ellipse(x + Math.cos(a) * 7 * s, y + Math.sin(a) * 7 * s, 8.5 * s, 4.2 * s, a, 0, TAU); c.fill(); }
  for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.55; c.fillStyle = white ? '#fffdf7' : '#fbe2e9'; c.beginPath(); c.ellipse(x + Math.cos(a) * 3.8 * s, y + Math.sin(a) * 3.8 * s, 5 * s, 2.6 * s, a, 0, TAU); c.fill(); }
  c.fillStyle = '#f6d36b'; c.beginPath(); c.arc(x, y, 2.8 * s, 0, TAU); c.fill();
}

// a pad of the outer pond: the board's pads in small, with a lily or a bud on some
function decorPad(c, d) {
  const r = d.r, k = r / PAD;
  c.save();
  c.rotate(d.a);
  c.fillStyle = 'rgba(0,0,0,.18)';
  c.beginPath(); c.arc(5 * k, 7 * k, r, 0.22, TAU - 0.05); c.lineTo(5 * k, 7 * k); c.fill();
  c.fillStyle = GREENS[d.shade];
  c.beginPath(); c.arc(0, 0, r, 0.22, TAU - 0.05); c.lineTo(0, 0); c.fill();
  c.fillStyle = 'rgba(255,255,255,.07)';
  c.beginPath(); c.arc(-8 * k, -10 * k, r * 0.7, 0.22, TAU - 0.05); c.lineTo(0, 0); c.fill();
  c.strokeStyle = 'rgba(30,70,40,.32)'; c.lineWidth = Math.max(0.8, 1.4 * k);
  const n = r < 24 ? 6 : 8;
  for (let i = 0; i < n; i++) { const q = 0.5 + i * (5.04 / (n - 1)); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(q) * r * 0.92, Math.sin(q) * r * 0.92); c.stroke(); }
  c.restore();
  const fx = (d.fx - 0.5) * r * 0.6, fy = (d.fy - 0.5) * r * 0.6;
  if (d.flower) lily(c, fx, fy, 0.75 + r / 120, d.flower === 'white');
  else if (d.bud) {
    c.fillStyle = 'rgba(10,40,25,.25)'; c.beginPath(); c.ellipse(fx + 2, fy + 3, 4.5, 6.5, 0.4, 0, TAU); c.fill();
    c.fillStyle = '#4f8a4c'; c.beginPath(); c.ellipse(fx, fy + 1.5, 4.2, 5.2, 0.4, 0, TAU); c.fill();
    c.fillStyle = '#eba5b8'; c.beginPath(); c.ellipse(fx - 0.6, fy - 1.5, 3, 5.6, 0.4, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(fx - 1.6, fy - 3, 1, 2.2, 0.4, 0, TAU); c.fill();
  }
}

// a pad, drawn once at the screen's resolution, then just placed (and bobbed) every frame
function padSprite(d, scale) {
  const m = d.r + 16, n = Math.ceil(2 * m * scale);
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  c.setTransform(scale, 0, 0, scale, m * scale, m * scale);
  decorPad(c, d);
  return { cv, m, s: n / scale };
}

// one side's bank, shallows and shore stones, painted into the background (c: the board's space)
function drawBank(c, side, off) {
  const { dir, bw, maxBw, base, reeds } = side;
  const X = (e) => (dir < 0 ? -off + e : SIZE + off - e);
  const R = rng(dir < 0 ? 8821 : 4409);
  const ss = Math.max(0.55, Math.min(1.15, base / 70));
  const band = (from, to, style) => {
    c.fillStyle = style; c.beginPath();
    for (let y = -24; y <= SIZE + 24; y += 8) c.lineTo(X(bw(y) + from), y);
    for (let y = SIZE + 24; y >= -24; y -= 8) c.lineTo(X(bw(y) + to), y);
    c.closePath(); c.fill();
  };
  // the shallows: lighter water along the shore
  band(-2, 44 * ss, 'rgba(120,200,190,.04)');
  band(-2, 26 * ss, 'rgba(120,200,190,.05)');
  band(-2, 11 * ss, 'rgba(140,215,200,.06)');
  // duckweed drifting in the shallows
  for (let k = 0; k < 5; k++) {
    const y = 30 + R() * (SIZE - 60), e = bw(y) + 18 + R() * 46 * ss, n = 12 + Math.floor(R() * 14), rad = 12 + R() * 16;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * rad;
      c.fillStyle = ['#86b35f', '#9cc66d', '#74a352'][Math.floor(R() * 3)];
      c.beginPath(); c.arc(X(e + Math.cos(a) * d), y + Math.sin(a) * d * 0.8, 1.2 + R() * 1.3, 0, TAU); c.fill();
    }
  }
  // a few stones standing in the shallows, a ring of light where the water meets them
  for (let k = 0; k < 4; k++) {
    const y = 40 + R() * (SIZE - 80), e = bw(y) + 14 * ss + R() * 34 * ss, rx = (5 + R() * 5) * ss, ry = rx * 0.7, rot = (R() - 0.5) * 0.6;
    const x = X(e);
    c.strokeStyle = 'rgba(190,240,230,.14)'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, y + 1, rx + 4, ry + 3, rot, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(8,28,24,.3)'; c.beginPath(); c.ellipse(x + 2, y + 3, rx, ry, rot, 0, TAU); c.fill();
    c.fillStyle = '#596059'; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill();
    c.fillStyle = '#6f766e'; c.beginPath(); c.ellipse(x - rx * 0.12, y - ry * 0.15, rx * 0.84, ry * 0.76, rot, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.38, rx * 0.36, ry * 0.2, rot, 0, TAU); c.fill();
  }
  // the bank's shadow on the water (the light comes from the upper left) and the reeds' roots
  band(-2, dir < 0 ? 9 : 3, 'rgba(4,22,24,.3)');
  for (const cl of reeds) {
    c.fillStyle = 'rgba(6,26,24,.28)'; c.beginPath(); c.ellipse(X(cl.e + 4), cl.y + 3, 16, 5, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(190,240,230,.08)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(X(cl.e + 6), cl.y + 4, 22, 7, 0, 0, TAU); c.stroke();
  }
  // the bank itself: moss, lighter as it rises away from the water
  const shore = new Path2D();
  shore.moveTo(X(-4), -24);
  for (let y = -24; y <= SIZE + 24; y += 8) shore.lineTo(X(bw(y)), y);
  shore.lineTo(X(-4), SIZE + 24); shore.closePath();
  const g = c.createLinearGradient(X(0), 0, X(maxBw), 0);
  g.addColorStop(0, '#4a6f4c'); g.addColorStop(1, '#30503a');
  c.fillStyle = g; c.fill(shore);
  c.save();
  c.clip(shore);
  for (let k = 0; k < 30; k++) {
    const y = R() * SIZE, e = R() * maxBw;
    c.fillStyle = R() < 0.5 ? 'rgba(255,255,235,.04)' : 'rgba(0,24,12,.08)';
    c.beginPath(); c.ellipse(X(e), y, 10 + R() * 22, 6 + R() * 12, R() * 3, 0, TAU); c.fill();
  }
  // grass in tufts, and a few small flowers
  const tufts = Math.round((maxBw * SIZE) / 700);
  for (let k = 0; k < tufts; k++) {
    const y = R() * (SIZE + 20), e = 4 + R() * Math.max(0, bw(y) - 16), n = 3 + Math.floor(R() * 3), col = ['#5e8c55', '#6f9d5f', '#4f7a4a', '#7aa765'][Math.floor(R() * 4)];
    const x = X(e);
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 1.1, len = 5 + R() * 7, bx = x + (R() - 0.5) * 6;
      c.beginPath(); c.moveTo(bx - 1.2, y); c.lineTo(bx + Math.cos(a) * len, y + Math.sin(a) * len); c.lineTo(bx + 1.2, y); c.closePath(); c.fill();
    }
  }
  for (let k = 0; k < 9; k++) {
    const y = R() * SIZE, e = 6 + R() * Math.max(0, bw(y) - 24), col = ['#f3e7a8', '#f6f2ea', '#d9c0e3'][Math.floor(R() * 3)];
    for (let i = 0; i < 3 + Math.floor(R() * 3); i++) { c.fillStyle = col; c.beginPath(); c.arc(X(e) + (R() - 0.5) * 12, y + (R() - 0.5) * 9, 1.4 + R() * 0.8, 0, TAU); c.fill(); }
  }
  c.restore();
  // the damp lip of the bank
  c.strokeStyle = 'rgba(32,54,40,.9)'; c.lineWidth = 3;
  c.beginPath(); for (let y = -24; y <= SIZE + 24; y += 8) c.lineTo(X(bw(y) - 1.5), y); c.stroke();
  // stones along the water's edge (a row of smaller ones just behind), nearer ones overlapping
  const rocks = [];
  for (let y = -16; y < SIZE + 20; y += (15 + R() * 16) * ss) rocks.push({ y: y + (R() - 0.5) * 4, e: bw(y) - (8 + R() * 10) * ss, rx: (5 + R() * 6) * ss, k: R() });
  for (let y = -20; y < SIZE + 24; y += (12 + R() * 13) * ss) rocks.push({ y, e: bw(y) + (R() - 0.55) * 8 * ss, rx: (8 + R() * 9) * ss, k: R() });
  rocks.sort((a, b) => a.y - b.y);
  for (const s of rocks) {
    const x = X(s.e), y = s.y, rx = s.rx, ry = rx * (0.6 + R() * 0.18), rot = (R() - 0.5) * 0.7, [dark, light] = ROCKS[Math.floor(s.k * ROCKS.length)];
    c.fillStyle = 'rgba(8,28,24,.32)'; c.beginPath(); c.ellipse(x + 3 * ss, y + 4.5 * ss, rx * 1.02, ry * 0.95, rot, 0, TAU); c.fill();
    c.fillStyle = dark; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill();
    c.fillStyle = light; c.beginPath(); c.ellipse(x - rx * 0.12, y - ry * 0.16, rx * 0.85, ry * 0.78, rot, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.17)'; c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.38, ry * 0.22, rot, 0, TAU); c.fill();
    if (R() < 0.3) { c.fillStyle = 'rgba(96,140,84,.6)'; c.beginPath(); c.ellipse(x + (R() - 0.5) * rx * 0.5, y - ry * 0.5, rx * 0.45, ry * 0.26, rot, 0, TAU); c.fill(); }
  }
}

// lay out one side of the wider pond for a width (off: how far the screen reaches past the square)
function buildSide(dir, off, base, scale) {
  const S = rng(dir < 0 ? 52711 : 90173);
  const p1 = S() * TAU, p2 = S() * TAU;
  const bw = (y) => { if (!base) return 0; const u = (y - SIZE / 2) / (SIZE / 2); return base * (1 + 0.4 * u * u + 0.12 * Math.sin(y * 0.019 + p1) + 0.07 * Math.sin(y * 0.047 + p2)); };
  let maxBw = 0;
  for (let y = -24; y <= SIZE + 24; y += 8) maxBw = Math.max(maxBw, bw(y));
  // reeds in clumps along the water's edge, cattails among them
  const reeds = [];
  if (base) {
    const Q = rng(dir < 0 ? 1213 : 6007), hs = Math.min(1, 0.55 + base / 160);
    for (let y = 16 + Q() * 60; y < SIZE + 30; y += 92 + Q() * 120) {
      const keep = Q() < 0.82, n = 5 + Math.floor(Q() * 6), tails = 1 + Math.floor(Q() * 3), e0 = Q(), items = [];
      for (let k = 0; k < n + tails; k++) {
        const tail = k >= n;
        items.push({ tail, de: (Q() - 0.5) * 16, dy: (Q() - 0.5) * 10, len: (tail ? 78 + Q() * 46 : 42 + Q() * 70) * hs, lean: tail ? -0.04 + Q() * 0.24 : -0.12 + Q() * 0.48, w: 1.4 + Q() * 1.6, col: REEDS[Math.floor(Q() * REEDS.length)], ph: Q() * TAU });
      }
      if (!keep) continue;
      items.sort((a, b) => a.dy - b.dy);
      reeds.push({ e: bw(y) - 3 + e0 * 9, y, items });
    }
  }
  // the pads: a fixed run of candidates, so a slightly different width keeps most of them
  const pads = [], P = rng(dir < 0 ? 3301 : 7717);
  for (let i = 0; i < 54; i++) {
    const r = 12 + Math.pow(P(), 0.8) * 32, y = -24 + P() * (SIZE + 48), f = P(), a = P() * TAU, shade = Math.floor(P() * 3), fl = P(), fx = P(), fy = P(), ph = P() * TAU;
    const e = bw(y) + r + 18 + f * 900;
    if (e > off + 30 - r) continue;   // at most a little way over the square's edge, well clear of the board
    if (pads.some((q) => Math.hypot(q.e - e, q.y - y) < q.r + r + 8)) continue;
    const d = { e, y, r, a, shade, fx, fy, ph, flower: r > 22 && fl < 0.4 ? (fl < 0.12 ? 'white' : 'pink') : null, bud: r <= 22 && fl > 0.8 };
    d.sprite = padSprite(d, scale);
    pads.push(d);
  }
  return { dir, bw, maxBw, base, reeds, pads };
}

// the whole wider pond for one width: both sides' layouts and the still picture under them
function buildScenery(off, scale) {
  const W = SIZE + 2 * off, base = off < 70 ? 0 : Math.min(110, off * 0.3 - 5);
  const sides = [buildSide(-1, off, base, scale), buildSide(1, off, base, scale)];
  const bg = document.createElement('canvas');
  bg.width = Math.ceil(W * scale); bg.height = Math.ceil(SIZE * scale);
  const c = bg.getContext('2d');
  c.setTransform(scale, 0, 0, scale, off * scale, 0);
  // the square's light on the water, spread across the width
  const g = c.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 40, SIZE / 2, SIZE / 2, SIZE * 0.8);
  g.addColorStop(0, '#2f6f73'); g.addColorStop(1, '#173f48');
  c.fillStyle = g;
  c.save();
  c.translate(SIZE / 2, 0); c.scale(W / SIZE, 1); c.translate(-SIZE / 2, 0);
  c.fillRect(0, 0, SIZE, SIZE);
  c.restore();
  for (const s of sides) if (s.base) drawBank(c, s, off);
  return { off, W, scale, sides, bg };
}

export function preview(ctx) {
  water(ctx, 1);
  const b = ['P', null, 'G', null, 'P', null, 'G', null, null];
  for (let i = 0; i < 9; i++) { const [x, y] = centre(i); lilyPad(ctx, x, y, PADS[i].a, PADS[i].shade, 0, null); if (b[i]) stone(ctx, x, y, b[i]); }
  ctx.strokeStyle = 'rgba(220,250,245,.5)'; ctx.lineWidth = 2;
  const [x, y] = centre(8);
  for (const r of [72, 92, 112]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); }
}

export function start(canvas, { setScore, isPaused, finish: showCard }) {
  const ctx = setupCanvas(canvas, { wide: true });
  let tally = { you: 0, garden: 0, draw: 0 };
  try { tally = { ...tally, ...JSON.parse(localStorage.getItem(SCORE_KEY) || '{}') }; } catch { /* fresh */ }
  let t = 0, board = Array(9).fill(null), turn = 'P', starter = 'P', cursor = 4, result = null, thinkT = 0, showCursor = false, moves = 0, hover = -1;
  let throws = [], ripples = [], spray = [], bob = Array(9).fill(0), winT = 0;
  const fish = { x: 120, y: 520, a: 0.2, c0: '#f5f1ea', c1: '#e8643a', p: 0, wander: 0 };
  const say = () => setScore(`You ${tally.you} · Pond ${tally.garden} · Even ${tally.draw}`);
  // the wider pond (full screen): its layout, the koi passing through it and the rings where a
  // fish rises. Its chances come from a generator of its own, so the game's moves never change.
  let off = 0, L = null, seenOff = -1, seenAt = 0, builtAt = -1e9, passers = [], rises = [], passT = 2.5, riseT = 1.2;
  const SR = rng(4242);
  // where a point of the layout (side dir, e in from its edge) is on screen, in the board's space.
  // A layout made for another width (a window still being dragged) is stretched to fit meanwhile.
  const ex = (dir, e) => (dir < 0 ? e : L.W - e) * ((SIZE + 2 * off) / L.W) - off;

  const finish = () => {
    result = winner(board);
    if (!result) return false;
    winT = 0;
    // a resolving chord: rising and bright for you, gently falling for the pond, warm when even
    const chord = result.who === 'P' ? [72, 76, 79, 84] : result.who === 'G' ? [79, 76, 72, 67] : [65, 69, 72, 77];
    chord.forEach((m, i) => tone(m, { dur: 1.8, vol: 0.06, delay: 0.45 + i * 0.16 }));
    if (result.who === 'P') tally.you += 1; else if (result.who === 'G') tally.garden += 1; else tally.draw += 1;
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(tally)); } catch { /* not kept */ }
    say();
    return true;
  };
  let resultT = 0, carded = false;
  const newRound = () => { board = Array(9).fill(null); result = null; resultT = 0; carded = false; starter = starter === 'P' ? 'G' : 'P'; turn = starter; thinkT = 0.8; moves = 0; };

  const toss = (who, i) => {
    const [tx, ty] = centre(i);
    throws.push({ who, cell: i, p: 0, from: who === 'P' ? [SIZE / 2 + (Math.random() - 0.5) * 160, SIZE + 40] : [SIZE / 2 + (Math.random() - 0.5) * 220, -50], to: [tx, ty] });
    turn = 'flying';
  };
  const land = (th) => {
    board[th.cell] = th.who; moves += 1;
    const [x, y] = th.to;
    bob[th.cell] = 1;
    for (let k = 0; k < 3; k++) ripples.push({ x, y, r: PAD * 0.6, l: 1, delay: k * 0.22 });
    for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 80; spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, z: 0, vz: 120 + Math.random() * 80, l: 0.7 }); }
    splash(0.06);
    tone(DOREMI[Math.min(DOREMI.length - 1, moves - 1)], { dur: 1.6, vol: 0.075, type: th.who === 'P' ? 'sine' : 'triangle' });
    if (!finish()) { turn = th.who === 'P' ? 'G' : 'P'; if (turn === 'G') thinkT = 0.6 + Math.random() * 0.5; }
  };

  const place = (i) => {
    if (result) { newRound(); return; }
    if (turn !== 'P' || board[i] || throws.length) return;
    toss('P', i);
  };
  const pondMove = () => {
    const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const relaxed = Math.random() < (moves < 2 ? 0.5 : 0.22);   // a gentle opponent
    toss('G', relaxed ? free[Math.floor(Math.random() * free.length)] : minimax(board.slice(), 'G', 'G').i);
  };

  // the pointer in the board's space: on a wide canvas the square sits in the middle
  const at = (e) => { const p = pointIn(canvas, e); return { x: p.x - ((canvas._snW || SIZE) - SIZE) / 2, y: p.y }; };
  const padAt = (p) => { for (let i = 0; i < 9; i++) { const [x, y] = centre(i); if (Math.hypot(p.x - x, p.y - y) < PAD + 14) return i; } return -1; };
  const onDown = (e) => { canvas.focus({ preventScroll: true }); showCursor = false; const i = padAt(at(e)); if (result) newRound(); else if (i >= 0) place(i); };
  const onMove = (e) => { hover = padAt(at(e)); };
  const onKey = (e) => {
    const k = e.key;
    if (/^[1-9]$/.test(k)) { e.preventDefault(); showCursor = true; cursor = Number(k) - 1; place(cursor); return; }
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[k];
    if (mv) { e.preventDefault(); showCursor = true; const n = cursor + mv; if (n >= 0 && n < 9 && !(Math.abs(mv) === 1 && Math.floor(n / 3) !== Math.floor(cursor / 3))) cursor = n; return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); showCursor = true; place(cursor); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('keydown', onKey);

  // the layout for this width: a jump (into full screen) is built at once; while a window is being
  // dragged the old one is stretched to fit until the width settles
  function scenery() {
    const now = performance.now(), scale = canvas.height / SIZE;
    if (Math.abs(off - seenOff) > 0.5) { seenOff = off; seenAt = now; }
    if (L && Math.abs(L.off - off) <= 0.5 && L.scale === scale) return;
    if (L && now - seenAt < 150 && now - builtAt < 500) return;
    L = buildScenery(off, scale); builtAt = now;
    passers = passers.filter((k) => { const s = L.sides[k.dir < 0 ? 0 : 1]; return k.e - k.amp > s.maxBw + 20 && k.e + k.amp < off + 20; });
    rises = [];
  }
  // a fish rising: two rings, kept out on the open water (never over the bank)
  const rise = (s, e, y) => { if (e > s.bw(y) + 50) rises.push({ dir: s.dir, e, y, r: 3, l: 1, delay: 0 }, { dir: s.dir, e, y, r: 3, l: 0.8, delay: 0.45 }); };
  function sideLife(dt) {
    // a koi now and then, swimming the length of one side
    passT -= dt;
    if (passT <= 0) {
      passT = 6 + SR() * 10;
      const pick = SR() < 0.5 ? 0 : 1, s = L.sides[passers.length ? (passers[0].dir < 0 ? 1 : 0) : pick];   // one to a side
      const amp = Math.min(46, Math.max(0, off - s.maxBw) * 0.14), pal = KOI[Math.floor(SR() * KOI.length)];
      const lo = s.maxBw + 30 + amp, hi = off - amp, down = SR() < 0.5, f = 0.25 + SR() * 0.5, v = 22 + SR() * 10, ph = SR() * TAU, p = SR() * 6, r0 = 2 + SR() * 5;
      if (off >= 130 && hi > lo && passers.length < 2) passers.push({ dir: s.dir, e: lo + (hi - lo) * f, amp, ph, y: down ? -60 : SIZE + 60, vy: down ? v : -v, x: 0, a: 0, c0: pal[0], c1: pal[1], p, riseT: r0 });
    }
    for (const k of passers) {
      k.y += k.vy * dt;
      const w = k.y * 0.011 + k.ph, e = k.e + k.amp * Math.sin(w);
      k.x = ex(k.dir, e);
      k.a = Math.atan2(k.vy, -k.dir * k.amp * 0.011 * Math.cos(w) * k.vy);
      k.riseT -= dt;
      if (k.riseT <= 0) {   // up to the surface for a moment, just ahead of its nose
        k.riseT = 4 + SR() * 6;
        const hy = k.y + Math.sin(k.a) * 20;
        if (hy > 10 && hy < SIZE - 10) rise(L.sides[k.dir < 0 ? 0 : 1], e - k.dir * Math.cos(k.a) * 20, hy);
      }
    }
    passers = passers.filter((k) => k.y > -90 && k.y < SIZE + 90);
    // a fish rising somewhere out in the open water
    riseT -= dt;
    if (riseT <= 0) {
      riseT = 1.6 + SR() * 3.4;
      const s = L.sides[SR() < 0.5 ? 0 : 1], y = 30 + SR() * (SIZE - 60), lo = s.bw(y) + 56, hi = off - 12, f = SR();
      if (hi > lo) rise(s, lo + (hi - lo) * f, y);
    }
    for (const r of rises) { if (r.delay > 0) { r.delay -= dt; continue; } r.r += 24 * dt; r.l -= dt * 0.55; }
    rises = rises.filter((r) => r.l > 0);
  }
  // the still picture (water, banks), then the light on the water from shore to shore
  function drawPond() {
    const k = (SIZE + 2 * off) / L.W;
    ctx.drawImage(L.bg, -off, 0, (L.bg.width / L.scale) * k, L.bg.height / L.scale);
    const [ls, rs] = L.sides;
    caustics(ctx, t, (y) => [ex(-1, ls.bw(y) + (ls.base ? 4 : 0)), ex(1, rs.bw(y) + (rs.base ? 4 : 0))]);
  }
  function drawRises() {
    for (const r of rises) {
      if (r.delay > 0) continue;
      ctx.strokeStyle = `rgba(225,250,245,${0.45 * r.l})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(ex(r.dir, r.e), r.y, r.r, r.r * 0.92, 0, 0, TAU); ctx.stroke();
    }
  }
  function drawPads() {
    for (const s of L.sides) {
      for (const d of s.pads) {
        const x = ex(s.dir, d.e);
        // (a layout made for a wider screen, stretched while the window narrows: leave out the
        // pads that would come too near the board)
        if (s.dir < 0 ? x + d.r > 30.5 : x - d.r < SIZE - 30.5) continue;
        ctx.drawImage(d.sprite.cv, x - d.sprite.m, d.y + Math.sin(t * 0.8 + d.ph) * 1.5 - d.sprite.m, d.sprite.s, d.sprite.s);
      }
    }
  }
  // reeds and cattails, stirring a little in the air
  function drawReeds() {
    for (const s of L.sides) {
      for (const cl of s.reeds) {
        for (const b of cl.items) {
          const bx = ex(s.dir, cl.e + b.de), by = cl.y + b.dy;
          const ang = -s.dir * b.lean + Math.sin(t * 0.9 + b.ph + by * 0.01) * 0.035 + Math.sin(t * 0.37 + b.ph * 2) * 0.02;
          const tx = bx + Math.sin(ang) * b.len, ty = by - Math.cos(ang) * b.len;
          const ma = ang * 0.35, mx = bx + Math.sin(ma) * b.len * 0.5, my = by - Math.cos(ma) * b.len * 0.5;
          if (!b.tail) {
            ctx.fillStyle = b.col;
            ctx.beginPath(); ctx.moveTo(bx - b.w, by); ctx.quadraticCurveTo(mx - b.w * 0.6, my, tx, ty); ctx.quadraticCurveTo(mx + b.w * 0.6, my, bx + b.w, by); ctx.fill();
            continue;
          }
          ctx.strokeStyle = '#6a8c4f'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
          // the brown head, three quarters of the way up, along the stem
          const q = 0.72, u = 1 - q;
          const hx = u * u * bx + 2 * u * q * mx + q * q * tx, hy = u * u * by + 2 * u * q * my + q * q * ty;
          const ha = Math.atan2(2 * u * (my - by) + 2 * q * (ty - my), 2 * u * (mx - bx) + 2 * q * (tx - mx)) + Math.PI / 2;
          ctx.fillStyle = '#6b4630'; ctx.beginPath(); ctx.ellipse(hx, hy, 3.4, 10.5, ha, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,180,.2)'; ctx.beginPath(); ctx.ellipse(hx - 1.2, hy - 1, 1.1, 7, ha, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.lineCap = 'butt';
  }

  function update(dt) {
    t += dt;
    if (!result && turn === 'G' && !throws.length) { thinkT -= dt; if (thinkT <= 0) pondMove(); }
    for (const th of throws) th.p += dt / FLIGHT;
    const landed = throws.filter((th) => th.p >= 1);
    throws = throws.filter((th) => th.p < 1);
    for (const th of landed) land(th);
    for (const r of ripples) { if (r.delay > 0) { r.delay -= dt; continue; } r.r += 60 * dt; r.l -= dt * 0.38; }
    ripples = ripples.filter((r) => r.l > 0);
    for (const s of spray) { s.x += s.vx * dt; s.y += s.vy * dt; s.vz -= 520 * dt; s.z += s.vz * dt; s.l -= dt; }
    spray = spray.filter((s) => s.l > 0 && s.z > -2);
    for (let i = 0; i < 9; i++) bob[i] *= Math.exp(-dt * 2.2);
    // the koi drifts in slow loops under the pads
    fish.wander += dt * 0.25;
    const gx = 320 + Math.cos(fish.wander) * 250, gy = 330 + Math.sin(fish.wander * 1.3) * 230;
    let d = Math.atan2(gy - fish.y, gx - fish.x) - fish.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    fish.a += d * Math.min(1, dt * 1.2); fish.x += Math.cos(fish.a) * 28 * dt; fish.y += Math.sin(fish.a) * 28 * dt;
    // a round over: let the chord ring and the line glow, then the card (Another round / the list)
    if (result) {
      resultT += dt;
      if (resultT > 2 && !carded && showCard) {
        carded = true;
        showCard({ title: result.who === 'P' ? 'three in a row' : result.who === 'G' ? 'the pond wins this one' : 'still water',
          stats: `You ${tally.you} · Pond ${tally.garden} · Even ${tally.draw}`, againLabel: 'Another round', again: newRound });
      }
    }
    if (result?.line) { winT += dt; if (Math.floor(winT / 1.4) !== Math.floor((winT - dt) / 1.4)) for (const i of result.line) { const [x, y] = centre(i); ripples.push({ x, y, r: PAD, l: 0.8, delay: result.line.indexOf(i) * 0.18 }); } }

    // the screen's width this frame (full screen, a resized window): the square stays centred
    const W = canvas._snW || SIZE;
    off = W > SIZE + 1 ? (W - SIZE) / 2 : 0;
    if (off) { scenery(); sideLife(dt); } else if (L) { L = null; passers = []; rises = []; seenOff = -1; }

    ctx.save();
    ctx.translate(off, 0);
    if (L) drawPond(); else pondWater(ctx, t);
    koi(ctx, fish, t);
    if (L) for (const k of passers) koi(ctx, k, t);
    for (const r of ripples) {
      if (r.delay > 0) continue;
      ctx.strokeStyle = `rgba(225,250,245,${0.6 * r.l})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (L) { drawRises(); drawPads(); }
    for (let i = 0; i < 9; i++) {
      const [x, y] = centre(i);
      const dip = bob[i] * Math.sin(t * 9 + i);
      const win = result?.line?.includes(i);
      const glow = win ? `rgba(255,236,180,${0.55 + Math.sin(t * 3) * 0.25})`
        : !result && turn === 'P' && !board[i] && ((showCursor && cursor === i) || (!showCursor && hover === i)) ? 'rgba(255,255,255,.55)' : null;
      lilyPad(ctx, x, y + Math.sin(t * 0.8 + i * 1.7) * 1.5, PADS[i].a, PADS[i].shade, dip, glow);
      if (board[i]) stone(ctx, x, y + dip * 3 + Math.sin(t * 0.8 + i * 1.7) * 1.5, board[i]);
    }
    for (const s of spray) { ctx.fillStyle = `rgba(235,250,255,${Math.min(1, s.l * 1.6)})`; ctx.beginPath(); ctx.arc(s.x, s.y - s.z, 2.4, 0, Math.PI * 2); ctx.fill(); }
    // pebbles in the air: the shadow skims the water, the stone arcs above it
    for (const th of throws) {
      const e = th.p, gx2 = th.from[0] + (th.to[0] - th.from[0]) * e, gy2 = th.from[1] + (th.to[1] - th.from[1]) * e;
      const h = Math.sin(Math.PI * e);
      ctx.fillStyle = `rgba(10,30,20,${0.12 + 0.18 * (1 - h)})`;
      ctx.beginPath(); ctx.ellipse(gx2, gy2 + 8, 26 * (1 - h * 0.4), 13 * (1 - h * 0.4), 0, 0, Math.PI * 2); ctx.fill();
      stone(ctx, gx2, gy2 - h * 150, th.who, 1 + h * 0.45);
    }
    if (L) drawReeds();
    const msg = result
      ? (result.who === 'P' ? 'Three in a row — your pebbles.' : result.who === 'G' ? 'The pond’s stones line up.' : 'Even. Still water.')
      : turn === 'flying' ? ' ' : turn === 'P' ? (moves ? 'Your toss' : starter === 'P' ? 'You begin — toss a pebble' : 'Your toss') : 'The pond is choosing…';
    card(ctx, [{ text: msg, size: 22, weight: 700 }, { text: result ? 'Tap or press Enter for another round' : ' ', size: 15, weight: 500, alpha: 0.9 }], { y: 72, shadow: 'rgba(0,30,30,.55)' });
    ctx.restore();
  }
  say();
  const stop = runLoop(update, isPaused);
  return () => { stop(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('keydown', onKey); };
}
