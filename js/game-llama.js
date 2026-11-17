// Llama Trail — a llama on a little red sled, riding an endless mountainside down through the
// snow. The slope rolls (long swells, crests that lift you into the air, the odd kicker); the
// speed builds downhill and eases uphill. Space, ↑ or a tap jumps; hold it in the air to flip
// backwards, and land with the sled along the snow to keep the flow (a flip gives a burst of
// speed). Rocks are to be hopped; apples hang above the snow. A landing on your head or a rock
// is a tumble into soft snow, a sit-down, and the card. The sky turns through dawn, day, gold,
// dusk and a starry night as you go. Bach's Prelude in C plays softly underneath.
// Full screen widens the view (the canvas keeps 640 of height): the camera sees further down the
// slope, with the rider kept to the left third and the whole mountainside drawn to the edges.

import { SIZE, setupCanvas, runLoop, note, card, clamp, playMusic, PRELUDE, swish } from './arcade-kit.js';

export const meta = { id: 'llama', wide: true, title: 'Llama Trail', blurb: 'Sled an endless mountainside: jump, flip, ride the snow.', keys: 'Space, ↑ or tap to jump · hold to flip' };
const BEST_KEY = 'stacknest:arcade-llama-best';

const H = SIZE;
const G = 1350, G_AIR = 1000, DRAG = 0.42, MINV = 170, MAXV = 640, JUMP = 610, FLIP = 8.4, FLIP_AFTER = 0.16, LX = 210;   // the air is floatier than the snow
const TAU = Math.PI * 2;
// where the camera holds the rider on a screen W wide: (210, 380) in the square frame; on a wider
// one a touch further left of the same proportion and a little higher, so more of the falling
// slope ahead stays in view
const riderX = (W) => LX + (W - SIZE) * 0.28;
const riderY = (W) => 380 - (W - SIZE) * 0.1;
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// colours as '#rrggbb' or 'rgb(…)', blended (the day's palette is itself a blend)
const rgbOf = (c) => (c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number));
const blend = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };

/* ——— the mountainside: long swells over a steady fall, and a kicker now and then ——— */
function makeGround(seed) {
  const p1 = seed * 1.7, p2 = seed * 2.9, p3 = seed * 4.3;
  const kicker = (x) => {
    const k = ((x + seed * 97) % 980 + 980) % 980;
    if (k < 640 || k > 800) return 0;
    const u = (k - 640) / 160;
    return -46 * Math.sin(Math.PI * u) ** 2 * (u < 0.7 ? 1 : 1 - (u - 0.7) * 1.6);   // a lip at the top
  };
  const y = (x) => x * 0.34 + 66 * Math.sin(x / 340 + p1) + 28 * Math.sin(x / 142 + p2) + 10 * Math.sin(x / 61 + p3) + kicker(x);
  const angle = (x) => Math.atan2(y(x + 2) - y(x - 2), 4);
  return { y, angle };
}

/* ——— the day: dawn, day, gold, dusk, night ——— */
const DAYS = [   // sky top, sky low, far range, mid range, near range, forest, snow, snow shade, light
  ['#2e3a6b', '#f2b48c', '#8e8fb6', '#6f7099', '#4f5679', '#343a58', '#f6e9e8', '#bdb5d2', 0.8],
  ['#69abe2', '#dcf0f7', '#a9c4dc', '#84a6c4', '#5f86a8', '#3c5e78', '#f8fbff', '#c3d6e8', 1],
  ['#ee9f68', '#fde2b0', '#d39c86', '#b0787a', '#865c6e', '#563f55', '#fff2e2', '#e0bfae', 0.9],
  ['#3b3266', '#d8778a', '#8b5f86', '#6a4a73', '#4b3a60', '#2f2846', '#ecdcea', '#a993b8', 0.62],
  ['#0b1030', '#26315e', '#2c3866', '#222c55', '#1a2246', '#10162f', '#ccd5ef', '#7f8cb6', 0.42],
];
function dayAt(c) {   // c in [0,1)
  const n = DAYS.length, x = c * n, i = Math.floor(x) % n, j = (i + 1) % n, t = x - Math.floor(x);
  const e = t < 0.6 ? 0 : ((t - 0.6) / 0.4) ** 2 * (3 - 2 * (t - 0.6) / 0.4);   // hold each hour, then turn
  return DAYS[i].map((v, k) => (k === 8 ? v + (DAYS[j][k] - v) * e : blend(v, DAYS[j][k], e)));
}

/* ——— the ranges behind ——— */
const peak = (u) => 1 - Math.abs(Math.sin(u));
// A ridge never dips below base + amp/10, so on a wide screen each layer is only filled down to
// where the next one in front always covers it (`low`): the same picture, far fewer pixels. The
// square frame keeps its full fills, so it draws exactly as it always has.
const RANGES = [
  { f: 0.05, base: 340, amp: 175, w1: 260, w2: 113, w3: 47, s: 0.4, col: 2, cap: 1, low: 412 },
  { f: 0.12, base: 395, amp: 135, w1: 190, w2: 83, w3: 37, s: 1.9, col: 3, cap: 0.55, low: 462 },
  { f: 0.26, base: 450, amp: 90, w1: 150, w2: 64, w3: 29, s: 3.1, col: 4, cap: 0, trees: true, low: SIZE },
];
const SKY_LOW = 360;   // below this the far range always hides the sky (wide screens only, as above)
const ridgeY = (x, L) => L.base - L.amp * (0.6 * peak(x / L.w1 + L.s) + 0.3 * peak(x / L.w2 + L.s * 2.1) + 0.1 * Math.sin(x / L.w3));

function pine(ctx, x, base, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const top = base - h + k * h * 0.22, w = h * (0.2 + k * 0.1);
    ctx.moveTo(x, top); ctx.lineTo(x - w, top + h * 0.42); ctx.lineTo(x + w, top + h * 0.42);
  }
  ctx.fill();
  ctx.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.13);
}
const hash = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

function sky(ctx, P, c, t, camX, W) {
  const k = W / SIZE;   // 1 in the square frame
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  g.addColorStop(0, P[0]); g.addColorStop(1, P[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W > SIZE ? SKY_LOW : H);
  const night = clamp((0.62 - P[8]) / 0.2, 0, 1);
  if (night > 0) {   // stars
    for (let i = 0, n = Math.round(70 * k); i < n; i++) {
      const x = ((hash(i, 1) * W * 1.4 - camX * 0.01) % W + W) % W, y = hash(i, 2) * 300;
      ctx.fillStyle = `rgba(255,255,255,${night * (0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1 + hash(i, 3) * 2) + i)))})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  // the sun climbs and sets across the day; the moon has the night
  const sunA = ((c + 0.92) % 1) / 0.78;   // up at dawn, down after dusk
  if (sunA < 1) {
    const x = (80 + sunA * 480) * k, y = 300 - Math.sin(sunA * Math.PI) * 230;
    const sg = ctx.createRadialGradient(x, y, 6, x, y, 90);
    sg.addColorStop(0, 'rgba(255,246,220,.9)'); sg.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = '#fff7e2'; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
  }
  if (night > 0.05) {
    ctx.fillStyle = `rgba(244,240,226,${night})`; ctx.beginPath(); ctx.arc(470 * k, 110, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = P[0]; ctx.beginPath(); ctx.arc(470 * k + 8, 104, 16, 0, TAU); ctx.fill();
  }
}

function ranges(ctx, P, camX, W) {
  const trim = W > SIZE;
  for (const L of RANGES) {
    const ox = camX * L.f, low = trim ? L.low : H;
    ctx.beginPath(); ctx.moveTo(0, low);
    for (let sx = 0; sx <= W + 8; sx += 8) ctx.lineTo(sx, ridgeY(sx + ox, L));
    ctx.lineTo(W, low); ctx.closePath();
    ctx.fillStyle = P[L.col]; ctx.fill();
    if (L.cap) {   // snow on the high ground
      ctx.save(); ctx.clip();
      const g = ctx.createLinearGradient(0, L.base - L.amp, 0, L.base - L.amp * 0.35);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * L.cap})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      if (trim) ctx.fillRect(0, L.base - L.amp - 1, W, L.amp * 0.65 + 3);   // just the band the gradient paints
      else ctx.fillRect(0, 0, W, L.base);
      ctx.restore();
    }
    if (L.trees) for (let k = 0, n = Math.max(64, Math.ceil(W / 12) + 2); k < n; k++) {
      const wx = Math.floor(ox / 12) * 12 + k * 12, sx = wx - ox;
      if (hash(Math.floor(wx / 12), 5) < 0.45) continue;
      pine(ctx, sx, ridgeY(wx, L) + 6, 18 + hash(Math.floor(wx / 12), 6) * 16, P[5]);
    }
  }
}

/* ——— the llama on its sled. Origin at the sled's foot, facing right, before rotation ——— */
function rider(ctx, P, pose, t, light) {
  const shade = (c) => blend(c, '#1b2140', (1 - light) * 0.55);
  const wool = shade('#f6ecdb'), line = shade('#cdb894'), dark = '#5d4a38';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (pose !== 'sit') {
    // the sled: two curled runners and a red deck
    ctx.strokeStyle = shade('#6b4a2e'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-36, -2); ctx.lineTo(26, -2); ctx.quadraticCurveTo(40, -2, 38, -14); ctx.quadraticCurveTo(36, -20, 30, -16); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); for (const x of [-26, -6, 14]) { ctx.moveTo(x, -2); ctx.lineTo(x, -9); } ctx.stroke();
    ctx.fillStyle = shade('#c8553d'); ctx.beginPath(); ctx.roundRect(-36, -14, 66, 7, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-34, -10, 62, 1.4);
    if (pose === 'sled') return;   // the sled on its own, after a tumble
  }
  const by = pose === 'sit' ? -20 : -32;
  // tucked legs reaching for the front of the sled
  ctx.strokeStyle = line; ctx.lineWidth = 6.5;
  ctx.beginPath();
  if (pose === 'sit') { ctx.moveTo(8, by + 8); ctx.lineTo(28, by + 18); ctx.moveTo(-18, by + 10); ctx.lineTo(-2, by + 20); }
  else { ctx.moveTo(10, by + 8); ctx.lineTo(26, -16); ctx.moveTo(-14, by + 10); ctx.lineTo(6, -15); }
  ctx.stroke();
  // body and tail
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.arc(-34, by - 6, 8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, by, 31, 18, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  // neck and head
  const lean = pose === 'air' ? -0.06 : 0;
  ctx.save(); ctx.rotate(lean);
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.moveTo(12, by - 8); ctx.quadraticCurveTo(18, by - 34, 18, by - 48); ctx.lineTo(32, by - 48); ctx.quadraticCurveTo(31, by - 24, 28, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  const hx = 30, hy = by - 54;
  ctx.beginPath(); ctx.ellipse(hx, hy, 14, 10, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade('#eadbc0'); ctx.beginPath(); ctx.ellipse(hx + 10, hy + 3, 6.5, 5.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = wool;
  for (const ex of [-6, 1]) { ctx.beginPath(); ctx.moveTo(hx + ex, hy - 7); ctx.lineTo(hx + ex - 4, hy - 20); ctx.lineTo(hx + ex + 4, hy - 9); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 2;
  if (pose === 'sit') { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 2.3, 0, TAU); ctx.fill(); }
  // a scarf, its tail streaming back in the wind
  ctx.fillStyle = shade('#2f8f84');
  ctx.beginPath(); ctx.roundRect(13, by - 30, 19, 7, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15, by - 28);
  const flap = pose === 'sit' ? 0.2 : 1;
  for (let k = 1; k <= 6; k++) ctx.lineTo(15 - k * 6, by - 28 + Math.sin(t * 12 - k) * 2.2 * flap * k / 3 + (pose === 'sit' ? k * 2.6 : k * 0.4));
  for (let k = 6; k >= 0; k--) ctx.lineTo(15 - k * 6, by - 22 + Math.sin(t * 12 - k) * 2.2 * flap * k / 3 + (pose === 'sit' ? k * 2.8 : k * 0.6));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function rock(ctx, sx, sy, r, P, light) {
  ctx.fillStyle = blend('#6d7287', '#1b2140', (1 - light) * 0.5);
  ctx.beginPath(); ctx.moveTo(sx - r.w / 2, sy + 4); ctx.lineTo(sx - r.w * 0.36, sy - r.h * 0.7); ctx.lineTo(sx - r.w * 0.05, sy - r.h); ctx.lineTo(sx + r.w * 0.3, sy - r.h * 0.8); ctx.lineTo(sx + r.w / 2, sy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P[6]; ctx.beginPath(); ctx.moveTo(sx - r.w * 0.3, sy - r.h * 0.74); ctx.lineTo(sx - r.w * 0.05, sy - r.h); ctx.lineTo(sx + r.w * 0.26, sy - r.h * 0.82); ctx.lineTo(sx, sy - r.h * 0.84); ctx.closePath(); ctx.fill();
}
function apple(ctx, sx, sy, t) {
  const bob = Math.sin(t * 3 + sx * 0.05) * 3;
  ctx.fillStyle = 'rgba(255,240,200,.25)'; ctx.beginPath(); ctx.arc(sx, sy + bob, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9443a'; ctx.beginPath(); ctx.arc(sx, sy + bob, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(sx - 3, sy + bob - 3, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy + bob - 8); ctx.lineTo(sx + 2, sy + bob - 13); ctx.stroke();
  ctx.fillStyle = '#5f9a4a'; ctx.beginPath(); ctx.ellipse(sx + 5, sy + bob - 11, 4, 2, -0.5, 0, TAU); ctx.fill();
}

// everything in one pass: sky, ranges, the near slope with its pines and track, rocks, apples,
// spray, the rider, and any word floating up from a landing
function scene(ctx, S) {
  const P = dayAt(S.cycle), light = P[8], W = S.W;
  sky(ctx, P, S.cycle, S.t, S.camX, W);
  ranges(ctx, P, S.camX, W);
  const gy = (x) => S.ground.y(x) - S.camY;
  // pines standing on the slope behind the rider
  for (let k = Math.floor((S.camX - 80) / 230); k <= Math.floor((S.camX + W + 80) / 230); k++) {
    if (hash(k, 11) < 0.5) continue;
    const wx = k * 230 + hash(k, 12) * 120;
    pine(ctx, wx - S.camX, gy(wx) + 4, 70 + hash(k, 13) * 70, blend(P[5], P[7], 0.15));
  }
  // the slope
  ctx.beginPath(); ctx.moveTo(-10, H + 10);
  for (let sx = -10; sx <= W + 10; sx += 6) ctx.lineTo(sx, gy(S.camX + sx));
  ctx.lineTo(W + 10, H + 10); ctx.closePath();
  const sg = ctx.createLinearGradient(0, 200, 0, H);
  sg.addColorStop(0, P[6]); sg.addColorStop(1, P[7]);
  ctx.fillStyle = sg; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = blend(P[7], P[6], 0.4); ctx.globalAlpha = 0.5; ctx.lineWidth = 10;
  ctx.beginPath(); for (let sx = -10; sx <= W + 10; sx += 6) { const y = gy(S.camX + sx) + 9; sx < -4 ? ctx.moveTo(sx, y) : ctx.lineTo(sx, y); } ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); for (let sx = -10; sx <= W + 10; sx += 6) { const y = gy(S.camX + sx) + 0.5; sx < -4 ? ctx.moveTo(sx, y) : ctx.lineTo(sx, y); } ctx.stroke();
  // the sled's track
  ctx.strokeStyle = blend(P[7], '#5a6788', 0.25); ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  for (const p of S.track) { if (!p) { pen = false; continue; } const x = p[0] - S.camX, y = p[1] - S.camY + 1; pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
  ctx.stroke(); ctx.globalAlpha = 1;
  for (const r of S.rocks) if (r.x - S.camX > -60 && r.x - S.camX < W + 60) rock(ctx, r.x - S.camX, gy(r.x), r, P, light);
  for (const a of S.apples) if (!a.got) apple(ctx, a.x - S.camX, a.y - S.camY, S.t);
  // snow thrown up behind the sled
  for (const s of S.spray) { ctx.fillStyle = `rgba(255,255,255,${0.85 * s.l})`; ctx.beginPath(); ctx.arc(s.x - S.camX, s.y - S.camY, s.r, 0, TAU); ctx.fill(); }
  if (S.sled) {   // after a tumble, the sled slides on alone
    ctx.save(); ctx.translate(S.sled.x - S.camX, S.sled.y - S.camY); ctx.rotate(S.sled.rot); rider(ctx, P, 'sled', S.t, light); ctx.restore();
  }
  ctx.save(); ctx.translate(S.px - S.camX, S.py - S.camY); ctx.rotate(S.rot);
  if (S.pose === 'sit') { ctx.save(); ctx.rotate(-S.rot + S.ground.angle(S.px)); rider(ctx, P, 'sit', S.t, light); ctx.restore(); }
  else if (S.pose !== 'sled-only') rider(ctx, P, S.pose, S.t, light);
  ctx.restore();
  for (const w of S.words) {
    ctx.save(); ctx.globalAlpha = Math.min(1, w.l * 1.6); ctx.textAlign = 'center'; ctx.font = '700 20px system-ui';
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(30,40,80,.45)'; ctx.shadowBlur = 10;
    ctx.fillText(w.text, w.x - S.camX, w.y - S.camY); ctx.restore();
  }
  // light snowfall over everything
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = 0, n = Math.round(46 * W / SIZE); i < n; i++) {
    const x = ((hash(i, 21) * W + S.t * (14 + hash(i, 22) * 20) - S.camX * 0.6) % W + W) % W;
    const y = ((hash(i, 23) * H + S.t * (40 + hash(i, 24) * 40)) % H + H) % H;
    ctx.beginPath(); ctx.arc(x, y, 1 + hash(i, 25) * 1.6, 0, TAU); ctx.fill();
  }
}

export function preview(ctx) {
  const ground = makeGround(0);
  const px = 1520, py = ground.y(px) - 70;
  scene(ctx, { W: SIZE, ground, camX: px - LX, camY: py - 380, cycle: 0.47, t: 1, px, py, rot: -0.9, pose: 'air', rocks: [{ x: 1700, w: 34, h: 24 }], apples: [{ x: 1610, y: ground.y(1610) - 120 }], spray: [], track: Array.from({ length: 30 }, (_, i) => [1300 + i * 7, ground.y(1300 + i * 7)]), words: [], sled: null });
}

export function start(canvas, { setScore, isPaused, finish }) {
  const ctx = setupCanvas(canvas, { wide: true });
  let W = canvas._snW || SIZE, lx = riderX(W);   // the view's width, read every frame; the rider's place across it
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* none */ }
  let ground, state = 'ready', t = 0, cycle = 0.02, held = false, carded = false, restT = 0;
  let px, py, vx, vy, grounded, rot, spin, flips, apples, startX, camX, camY, airT = 0, endM = null;
  let rocks, fruit, spray, track, words, sled, nextRock, nextFruit, trackGap;

  const reset = () => {
    ground = makeGround(Math.random() * 1000);
    px = 0; py = ground.y(0); vx = 0; vy = 0; grounded = true; rot = ground.angle(0); spin = 0;
    flips = 0; apples = 0; startX = px; lx = riderX(W); camX = px - lx; camY = py - riderY(W); airT = 0; endM = null;
    rocks = []; fruit = []; spray = []; track = []; words = []; sled = null;
    nextRock = 1700; nextFruit = 620; trackGap = 0;   // a few calm seconds (and apples to jump for) before the first rock
  };
  const meters = () => endM ?? Math.max(0, Math.floor((px - startX) / 40));   // fixed at the tumble
  const score = () => setScore(`${meters()} m${flips ? ` · ${flips} flip${flips === 1 ? '' : 's'}` : ''}${apples ? ` · ${apples} apple${apples === 1 ? '' : 's'}` : ''}${best ? ` · best ${best} m` : ''}`);

  function ride() { reset(); carded = false; state = 'run'; const a = ground.angle(px); vx = 220 * Math.cos(a); vy = 220 * Math.sin(a); score(); swish(0.05); }
  function press() {
    if (state === 'ready') { ride(); return; }
    if (state === 'rest') { if (restT > 0.6) ride(); return; }
    if (state === 'run' && grounded) {
      const a = ground.angle(px);
      vy = Math.min(vy, 0) * 0.3 + vy * 0.7 - JUMP * Math.cos(a);
      vx += JUMP * Math.sin(a) * 0.35;
      grounded = false; spin = 0; airT = 0;
      track.push(null);
      note(4, { dur: 0.35, vol: 0.05 });
    }
  }
  const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'Enter') { e.preventDefault(); if (!held) { held = true; press(); } } };
  const onKeyUp = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'Enter') held = false; };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); held = true; press(); };
  const onUp = () => { held = false; };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function tumble() {
    state = 'rest'; restT = 0;
    endM = meters();
    sled = { x: px, y: py, rot, vx: Math.max(160, Math.hypot(vx, vy) * 0.7) };
    if (meters() > best) { best = meters(); try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* not kept */ } }
    for (let i = 0; i < 24; i++) spray.push({ x: px + (Math.random() - 0.5) * 40, y: py - 10, vx: (Math.random() - 0.3) * 260, vy: -80 - Math.random() * 260, r: 2 + Math.random() * 4, l: 1 });
    note(0, { dur: 1.1, vol: 0.06 }); note(2, { dur: 1.1, vol: 0.04 });
    score();
  }

  function land() {
    const a = ground.angle(px), diff = Math.abs(wrapAng(rot - a));
    const turns = Math.floor((spin + 0.9) / TAU);
    py = ground.y(px); grounded = true; track.push([px, py]);
    if (diff > 1.05) { tumble(); return; }
    // keep the speed that runs along the snow
    let v = vx * Math.cos(a) + vy * Math.sin(a);
    if (diff < 0.5) {
      if (turns > 0) {
        flips += turns; v += 140 * turns;
        words.push({ text: turns > 1 ? `${turns}× backflip` : 'backflip', x: px, y: py - 90, l: 1 });
        note(7, { dur: 0.6, vol: 0.06 }); note(9, { dur: 0.8, vol: 0.05, delay: 0.09 }); if (turns > 1) note(11, { dur: 0.9, vol: 0.05, delay: 0.18 });
      } else note(2, { dur: 0.3, vol: 0.03 });
    } else { v *= 0.72; words.push({ text: 'wobbly…', x: px, y: py - 80, l: 0.8 }); }
    v = clamp(v, MINV, MAXV + 120);
    vx = v * Math.cos(a); vy = v * Math.sin(a); rot = a; spin = 0;
    for (let i = 0; i < 10; i++) spray.push({ x: px - 10 + Math.random() * 30, y: py - 2, vx: (Math.random() - 0.6) * 160, vy: -40 - Math.random() * 120, r: 2 + Math.random() * 3, l: 0.8 });
    score();
  }

  function spawn() {
    while (nextRock < camX + W + 200) {
      const x = nextRock;
      rocks.push({ x, w: 26 + Math.random() * 16, h: 18 + Math.random() * 10 });
      nextRock += (560 + Math.random() * 760) * (1 - Math.min(0.35, meters() / 6000));
    }
    while (nextFruit < camX + W + 200) {   // an arc of apples over a swell, to be jumped for
      const x0 = nextFruit, n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) { const x = x0 + k * 34; fruit.push({ x, y: ground.y(x) - 70 - Math.sin((k / (n - 1)) * Math.PI) * 60, got: false }); }
      nextFruit += 700 + Math.random() * 900;
    }
    rocks = rocks.filter((r) => r.x > camX - 80);
    fruit = fruit.filter((a) => a.x > camX - 40 && !a.got);
  }

  function update(dt) {
    W = canvas._snW || SIZE;
    const lxTo = riderX(W);   // after a resize the camera glides to the new framing
    lx = Math.abs(lxTo - lx) < 0.5 ? lxTo : lx + (lxTo - lx) * Math.min(1, dt * 3);
    t += dt;
    cycle = (cycle + dt / 240) % 1;
    if (state === 'run') {
      if (grounded) {
        const a = ground.angle(px), tx = Math.cos(a), ty = Math.sin(a);
        let v = vx * tx + vy * ty;
        v += (G * ty - DRAG * v) * dt;
        v = clamp(v, MINV, MAXV);
        vx = v * tx; vy = v * ty;
        const nx = px + vx * dt, by = py + vy * dt + 0.5 * G * dt * dt;
        if (ground.y(nx) - by > 1.5 && v > 280) {   // over a crest fast enough: the snow falls away
          grounded = false; spin = 0; airT = 0; px = nx; py = by; vy += G * dt; track.push(null);
        } else {
          px = nx; py = ground.y(px);
          rot += wrapAng(ground.angle(px) - rot) * Math.min(1, dt * 14);
          trackGap += vx * dt;
          if (trackGap > 7) { track.push([px, py]); trackGap = 0; }
          if (Math.random() < v / 700) spray.push({ x: px - 30, y: py - 2, vx: -v * 0.25 - Math.random() * 60, vy: -30 - Math.random() * 90, r: 1.5 + Math.random() * 2.5, l: 0.7 });
        }
      } else {
        vy += G_AIR * dt; vx *= 1 - dt * 0.04;
        px += vx * dt; py += vy * dt;
        airT += dt;
        if (held && airT > FLIP_AFTER) { rot -= FLIP * dt; spin += FLIP * dt; }   // a tap is a jump; holding on flips
        else rot += wrapAng(Math.atan2(vy, vx) * 0.5 - rot) * Math.min(1, dt * 2.2) * (spin > 0.4 ? 0 : 1);   // drift level, unless mid-flip
        const hx = px + Math.sin(rot) * 58, hy = py - Math.cos(rot) * 58;   // the top of the rider
        if (py >= ground.y(px)) land();
        else if (Math.cos(rot - ground.angle(px)) < 0.2 && hy >= ground.y(hx) - 4) { py = Math.min(py, ground.y(px)); tumble(); }   // head first into the snow
      }
      if (state === 'run') {
        // rocks: hop them or take a tumble (the box is kind)
        const feet = py;
        for (const r of rocks) {
          if (Math.abs(r.x - px) < r.w / 2 + 12 && feet > ground.y(r.x) - r.h + 6) { tumble(); break; }
        }
        for (const a of fruit) {
          if (!a.got && Math.hypot(a.x - px, a.y - (py - 40)) < 34) { a.got = true; apples += 1; note(7 + (apples % 5), { dur: 0.6, vol: 0.07 }); score(); }
        }
        spawn();
      }
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) score();
    } else if (state === 'rest') {
      restT += dt;
      // the llama skids to a stop in the snow; the sled runs on a little and stops
      const a = ground.angle(px);
      const v = Math.max(0, Math.hypot(vx, vy) * Math.exp(-dt * 3.2));
      vx = v * Math.cos(a); vy = v * Math.sin(a);
      px += vx * dt; py = ground.y(px);
      rot += wrapAng(a - rot) * Math.min(1, dt * 6);
      if (sled) {
        sled.vx *= Math.exp(-dt * 1.4); sled.x += sled.vx * dt; sled.y = ground.y(sled.x);
        sled.rot += wrapAng(ground.angle(sled.x) - sled.rot) * Math.min(1, dt * 8);
      }
    }
    if (state === 'ready') { rot = ground.angle(px); }
    for (const s of spray) { s.vy += 600 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt * 1.6; }
    spray = spray.filter((s) => s.l > 0);
    for (const w of words) { w.y -= 30 * dt; w.l -= dt * 0.9; }
    words = words.filter((w) => w.l > 0);
    if (track.length > 260) track.splice(0, track.length - 260);
    // the camera keeps the rider a little left of centre, easing up and down with the slope
    camX = px - lx;
    camY += (py - riderY(W) - camY) * Math.min(1, dt * 4);
    draw();
  }

  function draw() {
    scene(ctx, { W, ground, camX, camY, cycle, t, px, py, rot, pose: state === 'rest' ? 'sit' : grounded ? 'ride' : 'air', rocks, apples: fruit, spray, track, words, sled });
    const cx = (W - SIZE) / 2;   // cards stay in the middle of the screen
    if (state === 'ready') { ctx.save(); ctx.translate(cx, 0); card(ctx, [{ text: 'Llama Trail', size: 34, weight: 700 }, { text: 'Tap to jump · hold in the air to flip', size: 18, weight: 500, alpha: 0.95 }, { text: 'Space, ↑ or tap to set off', size: 15, weight: 500, alpha: 0.8 }], { y: 150, shadow: 'rgba(30,40,80,.45)' }); ctx.restore(); }
    // after a breath sitting in the snow, the round's card: a kind word, the ride, what's next
    if (state === 'rest' && restT > 1.1 && !carded && finish) {
      carded = true;
      finish({ title: 'a soft landing in the snow',
        stats: `${meters()} m down the mountain${flips ? ` · ${flips} flip${flips === 1 ? '' : 's'}` : ''}${apples ? ` · ${apples} apple${apples === 1 ? '' : 's'}` : ''}${best ? ` · best ${best} m` : ''}`,
        againLabel: 'Ride again', again: ride });
    }
    if (state === 'rest' && !finish) { ctx.save(); ctx.translate(cx, 0); card(ctx, [{ text: 'A soft landing.', size: 28, weight: 700 }, { text: restT > 0.6 ? 'Tap to ride again' : ' ', size: 16, weight: 500, alpha: 0.85 }], { y: 200 }); ctx.restore(); }
  }

  reset();
  score();
  draw();
  const stopLoop = runLoop(update, isPaused);
  const stopMusic = playMusic(PRELUDE, isPaused);
  return () => {
    stopLoop();
    stopMusic();
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  };
}
