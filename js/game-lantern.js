// Lantern Drift — a paper lantern drifts over a night lake. Move the pointer (or ←/→) and it
// follows, slowly; fireflies float down, and catching one rings a soft note. Every ten gathered
// let a small lantern rise into the sky, where it stays. Nothing can be lost here.

import { SIZE, setupCanvas, runLoop, note, card, pointIn, clamp } from './arcade-kit.js';

export const meta = { id: 'lantern', title: 'Lantern Drift', blurb: 'Gather drifting fireflies. Nothing can be lost.', keys: 'Move the pointer or arrow keys' };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const STARS = (() => { const r = rng(17); return Array.from({ length: 90 }, () => ({ x: r() * SIZE, y: r() * 330, r: 0.5 + r() * 1.3, p: r() * 6 })); })();

function sky(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, '#0b1230'); g.addColorStop(0.55, '#1d2a55'); g.addColorStop(0.62, '#2d3a63'); g.addColorStop(1, '#121a36');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  for (const s of STARS) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // moon and its path on the water
  const mg = ctx.createRadialGradient(470, 120, 10, 470, 120, 110);
  mg.addColorStop(0, 'rgba(255,244,214,.55)'); mg.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = mg; ctx.fillRect(330, 0, 300, 260);
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(470, 120, 30, 0, Math.PI * 2); ctx.fill();
  // hills
  ctx.fillStyle = '#141d3d';
  ctx.beginPath(); ctx.moveTo(0, 390);
  for (let x = 0; x <= SIZE; x += 40) ctx.lineTo(x, 360 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.031) * 10);
  ctx.lineTo(SIZE, 400); ctx.lineTo(0, 400); ctx.fill();
  // lake
  ctx.fillStyle = '#18234a'; ctx.fillRect(0, 396, SIZE, SIZE - 396);
  for (let i = 0; i < 14; i++) {
    const y = 410 + i * 16, w = 30 + i * 7 + Math.sin(t * 0.8 + i) * 8;
    ctx.fillStyle = `rgba(255,236,190,${0.18 - i * 0.01})`;
    ctx.fillRect(470 - w / 2 + Math.sin(t + i * 1.7) * 6, y, w, 2);
  }
}

function lantern(ctx, x, y, s, glow, t) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 4 * s, x, y, 70 * s * glow);
  g.addColorStop(0, 'rgba(255,190,110,.55)'); g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 70 * s * glow, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb46a';
  ctx.beginPath(); ctx.ellipse(x, y, 18 * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 4 * s, 7 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(160,80,40,.5)'; ctx.lineWidth = 1.2 * s;
  for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.ellipse(x + dx * s * 0.6, y, Math.abs(10 - Math.abs(dx)) * s * 0.9 + 2, 24 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#6b3a24';
  ctx.fillRect(x - 10 * s, y + 22 * s, 20 * s, 4 * s);
  ctx.fillRect(x - 8 * s, y - 27 * s, 16 * s, 4 * s);
  ctx.restore();
  void t;
}

function firefly(ctx, f, t) {
  const a = 0.6 + 0.4 * Math.sin(t * 5 + f.p);
  const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 16);
  g.addColorStop(0, `rgba(230,255,150,${0.9 * a})`); g.addColorStop(1, 'rgba(230,255,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(250,255,210,${a})`; ctx.beginPath(); ctx.arc(f.x, f.y, 2.6, 0, Math.PI * 2); ctx.fill();
}

export function preview(ctx) {
  sky(ctx, 1);
  for (const [x, y] of [[180, 220], [300, 160], [420, 260], [250, 310]]) firefly(ctx, { x, y, p: x }, 0.3);
  lantern(ctx, 320, 470, 1.2, 1, 0);
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  let t = 0, x = SIZE / 2, y = 470, target = SIZE / 2, targetY = 470, caught = 0, started = false, left = false, right = false, up = false, down = false, spawnT = 0;
  let flies = [], sparks = [], risen = [];
  const say = () => setScore(caught ? `${caught} firefl${caught === 1 ? 'y' : 'ies'}${risen.length ? ` · ${risen.length} lantern${risen.length === 1 ? '' : 's'} risen` : ''}` : 'Drift to gather fireflies');

  const onMove = (e) => { const p = pointIn(canvas, e); target = clamp(p.x, 30, SIZE - 30); targetY = clamp(p.y, 250, 560); started = true; };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { left = e.type === 'keydown'; e.preventDefault(); started = true; }
    if (e.key === 'ArrowRight' || e.key === 'd') { right = e.type === 'keydown'; e.preventDefault(); started = true; }
    if (e.key === 'ArrowUp' || e.key === 'w') { up = e.type === 'keydown'; e.preventDefault(); started = true; }
    if (e.key === 'ArrowDown' || e.key === 's') { down = e.type === 'keydown'; e.preventDefault(); started = true; }
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onMove);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKey);

  function update(dt) {
    t += dt;
    if (left) target = clamp(target - 260 * dt, 30, SIZE - 30);
    if (right) target = clamp(target + 260 * dt, 30, SIZE - 30);
    if (up) targetY = clamp(targetY - 220 * dt, 250, 560);
    if (down) targetY = clamp(targetY + 220 * dt, 250, 560);
    x += (target - x) * Math.min(1, dt * 3.2);
    y += (targetY - y) * Math.min(1, dt * 2.6);
    spawnT -= dt;
    if (spawnT <= 0 && flies.length < 11) { flies.push({ x: 40 + Math.random() * (SIZE - 80), y: t < 2 ? 80 + Math.random() * 260 : -10, v: 40 + Math.random() * 35, p: Math.random() * 6, w: 0.6 + Math.random() }); spawnT = t < 2 ? 0.15 : 0.6 + Math.random() * 0.9; }
    const ly = y + Math.sin(t * 1.4) * 6;
    for (const f of flies) {
      f.y += f.v * dt;
      f.x += Math.sin(t * f.w + f.p) * 22 * dt;
      if (!f.got && Math.hypot(f.x - x, f.y - ly) < 40) {
        f.got = true; caught += 1;
        note(5 + ((caught * 2) % 7), { dur: 1.4, vol: 0.06 });
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; sparks.push({ x: f.x, y: f.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, l: 0.8 }); }
        if (caught % 10 === 0) { risen.push({ x, y: ly, s: 0.55, drift: Math.random() * 6 }); note(9, { dur: 2, vol: 0.06 }); note(11, { dur: 2, vol: 0.04 }); }
        say();
      }
    }
    flies = flies.filter((f) => !f.got && f.y < SIZE + 20);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt; }
    sparks = sparks.filter((s) => s.l > 0);
    for (const r of risen) { if (r.y > 60 + (risen.indexOf(r) % 5) * 26) r.y -= 22 * dt; r.x += Math.sin(t * 0.5 + r.drift) * 4 * dt; }

    sky(ctx, t);
    for (const r of risen) lantern(ctx, r.x, r.y, r.s, 0.6, t);
    for (const f of flies) firefly(ctx, f, t);
    for (const s of sparks) { ctx.fillStyle = `rgba(240,255,190,${s.l})`; ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill(); }
    // reflection, then the lantern
    if (ly > 396) { ctx.globalAlpha = 0.22; lantern(ctx, x, Math.min(SIZE - 20, ly + 80), 0.8, 0.5, t); ctx.globalAlpha = 1; }
    lantern(ctx, x, ly, 1, 1 + Math.sin(t * 2) * 0.08, t);
    if (!started) card(ctx, [{ text: 'Lantern Drift', size: 32, weight: 700 }, { text: 'Move the pointer or arrow keys to drift', size: 17, weight: 500, alpha: 0.9 }], { y: 250 });
  }
  say();
  const stop = runLoop(update, isPaused);
  return () => {
    stop();
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onMove);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('keyup', onKey);
  };
}
