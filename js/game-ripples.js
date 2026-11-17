// Ripple Pond — a quiet pond with lily pads and three koi. Tap the water (or press Space) and a
// ripple spreads with a soft note, higher toward the top of the pond; the koi drift over to see.
// Now and then a raindrop falls on its own. No score, no end.

import { SIZE, setupCanvas, runLoop, note, card, pointIn } from './arcade-kit.js';

export const meta = { id: 'ripples', title: 'Ripple Pond', blurb: 'Tap the water. The koi come to see.', keys: 'Tap or Space' };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const PADS = (() => { const r = rng(71); return Array.from({ length: 6 }, () => ({ x: 60 + r() * 520, y: 60 + r() * 520, r: 26 + r() * 22, a: r() * 6, flower: r() < 0.4 })); })();

export function water(ctx, t) {
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

export function koi(ctx, k, t) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.a);
  const wag = Math.sin(t * 6 + k.p) * 0.35;
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  // tail
  ctx.save(); ctx.translate(-22, 0); ctx.rotate(wag);
  ctx.fillStyle = k.c1; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-14, -12, -20, -10); ctx.quadraticCurveTo(-12, 0, -20, 10); ctx.quadraticCurveTo(-14, 12, 0, 0); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.fillStyle = k.c0;
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = k.c1;
  ctx.beginPath(); ctx.ellipse(6, -2, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-10, 2, 7, 4, -0.2, 0, Math.PI * 2); ctx.fill();
  // fins
  ctx.fillStyle = k.c0; ctx.globalAlpha = 0.7;
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

export function preview(ctx) {
  water(ctx, 1);
  for (const p of PADS) pad(ctx, p, 0);
  for (const k of makeKoi()) koi(ctx, k, 0);
  ctx.strokeStyle = 'rgba(220,250,245,.5)'; ctx.lineWidth = 2;
  for (const r of [30, 60, 90]) { ctx.beginPath(); ctx.ellipse(320, 330, r, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); }
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  let t = 0, ripples = [], fish = makeKoi(), touched = false, rainT = 2, count = 0;
  const hush = ['Breathe in…', 'and out.', 'Nothing to do but this.'];
  setScore('Tap the water');

  const drop = (x, y, quiet = false) => {
    ripples.push({ x, y, r: 2, l: 1, big: !quiet });
    if (!quiet) {
      count += 1;
      note(Math.round((1 - y / SIZE) * 9) + 2, { dur: 1.8, vol: 0.07, type: 'sine' });
      for (const k of fish) k.goal = { x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, until: t + 5 };
      setScore(hush[count % hush.length]);
    }
  };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); const p = pointIn(canvas, e); touched = true; drop(p.x, p.y); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); touched = true; drop(80 + Math.random() * 480, 80 + Math.random() * 480); } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('keydown', onKey);

  function update(dt) {
    t += dt;
    rainT -= dt;
    if (rainT <= 0) { drop(40 + Math.random() * 560, 40 + Math.random() * 560, true); rainT = 1.8 + Math.random() * 3; }
    for (const r of ripples) { r.r += (r.big ? 70 : 45) * dt; r.l -= dt * (r.big ? 0.32 : 0.55); }
    ripples = ripples.filter((r) => r.l > 0);
    for (const k of fish) {
      let gx, gy;
      if (k.goal && k.goal.until > t) { gx = k.goal.x; gy = k.goal.y; }
      else { k.wander += dt * 0.3; gx = 320 + Math.cos(k.wander + k.p) * 220; gy = 320 + Math.sin(k.wander * 1.3 + k.p) * 200; }
      const want = Math.atan2(gy - k.y, gx - k.x);
      let d = want - k.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      k.a += d * Math.min(1, dt * 1.4);
      const near = Math.hypot(gx - k.x, gy - k.y);
      const sp = k.goal && k.goal.until > t ? Math.min(70, 20 + near * 0.5) : 30;
      k.x += Math.cos(k.a) * sp * dt; k.y += Math.sin(k.a) * sp * dt;
      k.x = Math.max(20, Math.min(SIZE - 20, k.x)); k.y = Math.max(20, Math.min(SIZE - 20, k.y));
    }
    water(ctx, t);
    for (const k of fish) koi(ctx, k, t);
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(220,250,245,${0.55 * r.l})`; ctx.lineWidth = r.big ? 2.2 : 1.4;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
      if (r.big && r.r > 18) { ctx.strokeStyle = `rgba(220,250,245,${0.3 * r.l})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r - 16, (r.r - 16) * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const p of PADS) pad(ctx, p, t);
    if (!touched) card(ctx, [{ text: 'Ripple Pond', size: 32, weight: 700 }, { text: 'Tap the water, or press Space', size: 17, weight: 500, alpha: 0.9 }], { y: 300 });
  }
  const stop = runLoop(update, isPaused);
  return () => { stop(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('keydown', onKey); };
}
