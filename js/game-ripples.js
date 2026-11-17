// Ripple Pond — a quiet pond with lily pads and three koi. Tap the water (or press Space) and a
// ripple spreads with a soft note, higher toward the top of the pond; the koi drift over to see.
// Now and then a raindrop falls on its own. No score, no end.
// In full screen the pond runs to both edges: the square's pads, koi and light stay in the
// middle, and the water carries on either side with as many pads, koi and raindrops to a stretch
// of pond as the square has.

import { SIZE, setupCanvas, runLoop, note, card, pointIn } from './arcade-kit.js';

export const meta = { id: 'ripples', title: 'Ripple Pond', blurb: 'Tap the water. The koi come to see.', keys: 'Tap or Space', wide: true };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const PADS = (() => { const r = rng(71); return Array.from({ length: 6 }, () => ({ x: 60 + r() * 520, y: 60 + r() * 520, r: 26 + r() * 22, a: r() * 6, flower: r() < 0.4 })); })();

// A wide pond is drawn in the square's own coordinates, with x running from -(W-640)/2 to
// 640 + (W-640)/2. Its pads come in 640-wide strips either side of the square (strip 0): six to a
// strip like the square, kept clear of each other and of the strip nearer the middle. Each strip is
// made once, outward from the middle, so no pad moves when the screen gets wider.
const STRIPS = new Map([[0, PADS]]);
function strip(k) {
  let pads = STRIPS.get(k);
  if (pads) return pads;
  const near = strip(k > 0 ? k - 1 : k + 1);
  const r = rng(71 + 7919 * (k > 0 ? 2 * k : 1 - 2 * k));
  r(); r();
  pads = [];
  for (let tries = 0; pads.length < PADS.length && tries < 400; tries++) {
    const p = { x: SIZE * k + r() * SIZE, y: 60 + r() * 520, r: 26 + r() * 22, a: r() * 6, flower: r() < 0.4 };
    if (!near.concat(pads).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 18)) pads.push(p);
  }
  STRIPS.set(k, pads);
  return pads;
}
// the pads in view on a pond W wide (the square's own six, then the strips' that show)
function padsFor(W) {
  if (W <= SIZE) return PADS;
  const ox = (W - SIZE) / 2, out = PADS.slice();
  for (let k = 1; SIZE * (k - 1) - 60 < ox; k++) {
    for (const p of strip(k).concat(strip(-k))) if (p.x + p.r + 8 > -ox && p.x - p.r - 8 < SIZE + ox) out.push(p);
  }
  return out;
}

// W: the pond's width, the square by default. A wider pond is centred on the square (draw it under
// the same translate as the rest of the scene), and the square's light is spread across it.
export function water(ctx, t, W = SIZE) {
  shine(ctx, W);
  ripplesOfLight(ctx, t, W);
}

// the light on the water is the same for every frame: one gradient per context, kept
const LIGHT = new WeakMap();
function shine(ctx, W) {
  let g = LIGHT.get(ctx);
  if (!g) {
    g = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 40, SIZE / 2, SIZE / 2, SIZE * 0.8);
    g.addColorStop(0, '#2f6f73'); g.addColorStop(1, '#173f48');
    LIGHT.set(ctx, g);
  }
  ctx.fillStyle = g;
  if (W > SIZE) {
    ctx.save();
    ctx.translate(SIZE / 2, 0); ctx.scale(W / SIZE, 1); ctx.translate(-SIZE / 2, 0);
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
  } else ctx.fillRect(0, 0, SIZE, SIZE);
}

// caustic light
function ripplesOfLight(ctx, t, W) {
  const x0 = W > SIZE ? -Math.ceil((W - SIZE) / 64) * 32 : 0, x1 = SIZE - x0;
  ctx.strokeStyle = 'rgba(190,240,230,.06)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 32) { const y = i * 76 + Math.sin(x * 0.02 + t * 0.6 + i) * 10; x !== x0 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
}

function pad(ctx, p, t) {
  const bob = Math.sin(t * 0.7 + p.a) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.a);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.arc(4, 5, p.r, 0.25, Math.PI * 2 - 0.05); ctx.lineTo(4, 5); ctx.fill();
  ctx.fillStyle = '#5c9a5a';
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0.25, Math.PI * 2 - 0.05); ctx.lineTo(0, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,40,.35)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k + 0.6) * p.r * 0.9, Math.sin(k + 0.6) * p.r * 0.9); ctx.stroke(); }
  if (p.flower) {
    ctx.rotate(-p.a);
    for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#f7d4de' : '#f1b6c6'; ctx.beginPath(); ctx.ellipse(Math.cos(k * 0.785) * 7, Math.sin(k * 0.785) * 7, 9, 4.5, k * 0.785, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f6d36b'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// drawn at the context's current alpha (a koi fading in or out of a wide pond)
export function koi(ctx, k, t) {
  const A = ctx.globalAlpha;
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.a);
  const wag = Math.sin(t * 6 + k.p) * 0.35;
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  // tail
  ctx.save(); ctx.translate(-22, 0); ctx.rotate(wag);
  ctx.fillStyle = k.c1; ctx.globalAlpha = 0.85 * A;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-14, -12, -20, -10); ctx.quadraticCurveTo(-12, 0, -20, 10); ctx.quadraticCurveTo(-14, 12, 0, 0); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = A;
  ctx.fillStyle = k.c0;
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = k.c1;
  ctx.beginPath(); ctx.ellipse(6, -2, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-10, 2, 7, 4, -0.2, 0, Math.PI * 2); ctx.fill();
  // fins
  ctx.fillStyle = k.c0; ctx.globalAlpha = 0.7 * A;
  ctx.beginPath(); ctx.ellipse(6, 10, 7, 3, 0.6 + wag * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -10, 7, 3, -0.6 - wag * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function makeKoi() {
  return [
    { x: 200, y: 300, a: 0.3, c0: '#f5f1ea', c1: '#e8643a', p: 0 },
    { x: 420, y: 380, a: 2.4, c0: '#f08a3c', c1: '#fbe9d6', p: 2 },
    { x: 330, y: 180, a: 4.0, c0: '#f4efe6', c1: '#2b2b2b', p: 4 },
  ].map((k) => ({ ...k, v: 34, wander: Math.random() * 6 }));
}
// the koi a wide pond adds, in turn
const MORE_KOI = [
  { c0: '#f6d36b', c1: '#fdf1cf' },   // gold
  { c0: '#f4efe6', c1: '#d9483a' },   // white and red
  { c0: '#a3b6c6', c1: '#e47b4b' },   // blue-grey, orange-sided
  { c0: '#f08a3c', c1: '#2b2b2b' },   // orange and black
  { c0: '#fbf7f0', c1: '#f0a04b' },   // white and orange
  { c0: '#e8643a', c1: '#fbe9d6' },   // red and cream
];

export function preview(ctx) {
  water(ctx, 1);
  for (const p of PADS) pad(ctx, p, 0);
  for (const k of makeKoi()) koi(ctx, k, 0);
  ctx.strokeStyle = 'rgba(220,250,245,.5)'; ctx.lineWidth = 2;
  for (const r of [30, 60, 90]) { ctx.beginPath(); ctx.ellipse(320, 330, r, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); }
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  let t = 0, ripples = [], fish = makeKoi(), touched = false, rainT = 2, count = 0;
  // the pond's width this frame and how far it reaches past the square on each side
  let W = canvas._snW || SIZE, ox = (W - SIZE) / 2, padsW = W, pads = padsFor(W), made = 0;
  const hush = ['Breathe in…', 'and out.', 'Nothing to do but this.'];
  setScore('Tap the water');
  const reach = () => ((canvas._snW || SIZE) - SIZE) / 2;

  const drop = (x, y, quiet = false) => {
    ripples.push({ x, y, r: 2, l: 1, big: !quiet });
    if (!quiet) {
      count += 1;
      note(Math.round((1 - y / SIZE) * 9) + 2, { dur: 1.8, vol: 0.07, type: 'sine' });
      // the three koi nearest come to see (on the square, that is all of them)
      const come = fish.length > 3 ? fish.filter((k) => !k.leaving).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 3) : fish;
      for (const k of fish) if (come.includes(k)) k.goal = { x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, until: t + 5 };
      setScore(hush[count % hush.length]);
    }
  };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); const p = pointIn(canvas, e); touched = true; drop(p.x - reach(), p.y); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); touched = true; const o = reach(); drop(-o + 80 + Math.random() * (2 * o + 480), 80 + Math.random() * 480); } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('keydown', onKey);

  // A wide pond keeps the square's share of koi, three to every 640 of width. The square's three
  // stay in the middle; the others each have a stretch of the water either side (right, left, right…),
  // fade in as the pond widens and out as it narrows.
  function school(dt) {
    const want = W > SIZE ? Math.max(0, Math.round((3 * W) / SIZE) - 3) : 0;
    const live = fish.filter((k) => k.f !== undefined && !k.leaving);
    while (live.length < want) {
      let k = fish.find((q) => q.leaving);
      if (k) k.leaving = false;
      else {
        k = { x: 0, y: 0, a: Math.random() * 6.28, ...MORE_KOI[made % MORE_KOI.length], p: made * 1.7 + 1, v: 34, wander: Math.random() * 6, f: 0, leaving: false, placed: false };
        made += 1;
        fish.push(k);
      }
      live.push(k);
    }
    while (live.length > want) live.pop().leaving = true;
    const lay = (group, a, b) => {
      const w = (b - a) / group.length;
      group.forEach((k, i) => {
        k.cx = a + w * (i + 0.5); k.ax = w / 2;
        if (!k.placed) { k.placed = true; k.x = k.cx + (Math.random() - 0.5) * w; k.y = 100 + Math.random() * 440; }
      });
    };
    lay(live.filter((_, i) => i % 2 === 0), SIZE - 120, SIZE + ox - 70);
    lay(live.filter((_, i) => i % 2 === 1), 70 - ox, 120);
    let gone = false;
    for (const k of fish) if (k.f !== undefined) { k.f = Math.max(0, Math.min(1, k.f + (k.leaving ? -dt / 0.8 : dt / 1.2))); gone = gone || (k.leaving && k.f <= 0); }
    if (gone) fish = fish.filter((k) => !(k.leaving && k.f <= 0));
  }

  // A wide pond's light (one soft gradient, the costliest thing to fill) is painted once per width
  // at half scale and laid over the whole pond each frame; it is cheap enough to repaint at once
  // whenever the width changes, even through a window drag.
  let sea = null, seaW = 0;
  function light() {
    if (!sea || seaW !== W) {
      seaW = W;
      sea = sea || document.createElement('canvas');
      sea.width = Math.ceil(W / 2); sea.height = SIZE / 2;
      const c = sea.getContext('2d');
      c.setTransform(sea.width / W, 0, 0, sea.height / SIZE, ox * (sea.width / W), 0);
      shine(c, W);
    }
    ctx.drawImage(sea, -ox, 0, W, SIZE);
  }

  function update(dt) {
    W = canvas._snW || SIZE; ox = (W - SIZE) / 2;
    if (W !== padsW) { padsW = W; pads = padsFor(W); }
    t += dt;
    rainT -= dt;
    if (rainT <= 0) { drop(-ox + 40 + Math.random() * (W - 80), 40 + Math.random() * 560, true); rainT = (1.8 + Math.random() * 3) * (SIZE / W); }
    for (const r of ripples) { r.r += (r.big ? 70 : 45) * dt; r.l -= dt * (r.big ? 0.32 : 0.55); }
    ripples = ripples.filter((r) => r.l > 0);
    if (fish.length > 3 || W > SIZE) school(dt);
    const lo = 20 - ox, hi = SIZE - 20 + ox;
    for (const k of fish) {
      let gx, gy;
      if (k.goal && k.goal.until > t) { gx = k.goal.x; gy = k.goal.y; }
      else { k.wander += dt * 0.3; gx = (k.cx ?? 320) + Math.cos(k.wander + k.p) * (k.ax ?? 220); gy = 320 + Math.sin(k.wander * 1.3 + k.p) * 200; }
      const want = Math.atan2(gy - k.y, gx - k.x);
      let d = want - k.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      k.a += d * Math.min(1, dt * 1.4);
      const near = Math.hypot(gx - k.x, gy - k.y);
      const sp = k.goal && k.goal.until > t ? Math.min(70, 20 + near * 0.5) : 30;
      k.x += Math.cos(k.a) * sp * dt; k.y += Math.sin(k.a) * sp * dt;
      // left out past the edge by a narrower pond: glide back into view rather than jump
      if (k.x < lo - 8 || k.x > hi + 8) k.x += (Math.max(lo, Math.min(hi, k.x)) - k.x) * Math.min(1, dt * 2.5);
      else k.x = Math.max(lo, Math.min(hi, k.x));
      k.y = Math.max(20, Math.min(SIZE - 20, k.y));
    }
    // (the square is drawn exactly as it always was, with no save around it)
    if (ox) { ctx.save(); ctx.translate(ox, 0); light(); ripplesOfLight(ctx, t, W); }
    else water(ctx, t);
    for (const k of fish) {
      if (k.f === undefined) koi(ctx, k, t);
      else if (k.f > 0) { ctx.globalAlpha = k.f * k.f * (3 - 2 * k.f); koi(ctx, k, t); ctx.globalAlpha = 1; }
    }
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(220,250,245,${0.55 * r.l})`; ctx.lineWidth = r.big ? 2.2 : 1.4;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
      if (r.big && r.r > 18) { ctx.strokeStyle = `rgba(220,250,245,${0.3 * r.l})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r - 16, (r.r - 16) * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const p of pads) pad(ctx, p, t);
    if (!touched) card(ctx, [{ text: 'Ripple Pond', size: 32, weight: 700 }, { text: 'Tap the water, or press Space', size: 17, weight: 500, alpha: 0.9 }], { y: 300 });
    if (ox) ctx.restore();
  }
  const stop = runLoop(update, isPaused);
  return () => { stop(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('keydown', onKey); };
}
