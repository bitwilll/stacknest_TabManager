// Lantern Drift — a paper lantern drifts over a night lake. Move the pointer (or ←/→) and it
// follows, slowly; fireflies float down, and catching one rings a soft note. Every ten gathered
// let a small lantern rise into the sky, where it stays. Nothing can be lost here.
// In full screen the lake opens out to the screen's edges: the square scene stays in the middle
// exactly as it is, and the night carries on either side (far mountains, pines along the shore,
// a little pavilion with lit windows, a pier with a lamp, reeds), with fireflies falling across
// the whole width and the lantern free to drift to either edge.

import { SIZE, setupCanvas, runLoop, note, card, pointIn, clamp } from './arcade-kit.js';

export const meta = { id: 'lantern', title: 'Lantern Drift', blurb: 'Gather drifting fireflies. Nothing can be lost.', keys: 'Move the pointer or arrow keys', wide: true };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const STARS = (() => { const r = rng(17); return Array.from({ length: 90 }, () => ({ x: r() * SIZE, y: r() * 330, r: 0.5 + r() * 1.3, p: r() * 6 })); })();
// stars beyond the square come in 640-wide strips of their own, so they stay put at any width
const STRIPS = new Map([[0, STARS]]);
function strip(k) {
  let s = STRIPS.get(k);
  if (!s) { const r = rng(4000 + k * 131); s = Array.from({ length: 90 }, () => ({ x: k * SIZE + r() * SIZE, y: r() * 330, r: 0.5 + r() * 1.3, p: r() * 6 })); STRIPS.set(k, s); }
  return s;
}

/* ——— the scene, in the square's own coordinates: x runs 0…640 across the square and on past
   either edge (negative to the left) when the screen is wider ——— */
const LAKE = 396;
const PAV = -140, PIER = 794;   // the pavilion's middle; the pier lamp
const hill = (x) => 360 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.031) * 10;
const hillLine = (x) => { const a = Math.floor(x / 40) * 40; return hill(a) + (hill(a + 40) - hill(a)) * ((x - a) / 40); };   // as drawn: straight runs 40 apart
const beyond = (x) => (x < 0 ? -x : x > SIZE ? x - SIZE : 0);   // how far outside the square
const ease = (v) => { const u = clamp(v, 0, 1); return u * u * (3 - 2 * u); };
function hash(i) { let h = (Math.imul(i, 374761393) + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
// far mountains: flat (hidden behind the hills) inside the square, rising beyond it
const ridge = (x) => 400 - ease(beyond(x) / 230) * (74 + Math.sin(x * 0.0069 + 3) * 30 + Math.sin(x * 0.023 + 0.4) * 13 + Math.sin(x * 0.067) * 4);

function sky(ctx, t) { backdrop(ctx, t, 0, SIZE); land(ctx, 0, SIZE); moonPath(ctx, t); }

// what moves in the sky: the gradient, twinkling stars, the moon
function backdrop(ctx, t, x0, x1) {
  const wide = x0 < 0 || x1 > SIZE;
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, '#0b1230'); g.addColorStop(0.55, '#1d2a55'); g.addColorStop(0.62, '#2d3a63'); g.addColorStop(1, '#121a36');
  ctx.fillStyle = g;
  if (wide) ctx.fillRect(x0 - 1, 0, x1 - x0 + 2, SIZE); else ctx.fillRect(0, 0, SIZE, SIZE);
  for (let k = Math.floor(x0 / SIZE); k * SIZE < x1; k++) {
    for (const s of strip(k)) {
      if (s.x < x0 - 3 || s.x > x1 + 3) continue;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // moon
  const mg = ctx.createRadialGradient(470, 120, 10, 470, 120, 110);
  mg.addColorStop(0, 'rgba(255,244,214,.55)'); mg.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = mg; ctx.fillRect(330, 0, 300, 260);
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(470, 120, 30, 0, Math.PI * 2); ctx.fill();
}

// what stays still: hills and lake, and beyond the square the mountains, pines, pavilion, pier, reeds
function land(ctx, x0, x1) {
  const wide = x0 < 0 || x1 > SIZE;
  if (wide) ranges(ctx, x0, x1);
  ctx.fillStyle = '#141d3d';
  const a = Math.floor(x0 / 40) * 40, b = Math.ceil(x1 / 40) * 40;
  ctx.beginPath(); ctx.moveTo(a, 390);
  for (let x = a; x <= b; x += 40) ctx.lineTo(x, hill(x));
  ctx.lineTo(b, 400); ctx.lineTo(a, 400); ctx.fill();
  if (wide) pines(ctx, x0, x1);
  ctx.fillStyle = '#18234a';
  if (wide) ctx.fillRect(x0 - 1, LAKE, x1 - x0 + 2, SIZE - LAKE); else ctx.fillRect(0, LAKE, SIZE, SIZE - LAKE);
  if (wide) {
    if (PAV + 60 > x0 && PAV - 60 < x1) pavilion(ctx, PAV);
    if (PIER + 20 > x0 && PIER - 110 < x1) pier(ctx, PIER);
    reeds(ctx, x0, x1);
  }
}

// the moon's path on the water
function moonPath(ctx, t) {
  for (let i = 0; i < 14; i++) {
    const y = 410 + i * 16, w = 30 + i * 7 + Math.sin(t * 0.8 + i) * 8;
    ctx.fillStyle = `rgba(255,236,190,${0.18 - i * 0.01})`;
    ctx.fillRect(470 - w / 2 + Math.sin(t + i * 1.7) * 6, y, w, 2);
  }
}

function ranges(ctx, x0, x1) {
  ctx.fillStyle = '#161f42';
  for (const [a, b] of [[x0 - 1, Math.min(x1, 0)], [Math.max(x0, SIZE), x1 + 1]]) {
    if (b <= a) continue;
    ctx.beginPath(); ctx.moveTo(a, 400); ctx.lineTo(a, ridge(a));
    for (let x = Math.ceil(a / 10) * 10; x < b; x += 10) ctx.lineTo(x, ridge(x));
    ctx.lineTo(b, ridge(b)); ctx.lineTo(b, 400); ctx.fill();
  }
}

function pines(ctx, x0, x1) {
  ctx.fillStyle = '#0f1736';
  for (let i = Math.floor(x0 / 13) - 1; i <= Math.ceil(x1 / 13) + 1; i++) {
    const x = i * 13 + hash(i) * 9, d = beyond(x);
    if (d < 24 || Math.abs(x - PAV) < 58 || Math.abs(x - PIER) < 14) continue;
    const dens = ease((d - 24) / 110) * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(x * 0.0093 + 0.6)));
    if (hash(i + 9001) > dens) continue;
    pine(ctx, x, hillLine(x) + 5, 16 + hash(i + 77) * 28 * (0.6 + 0.4 * dens));
  }
}

function pine(ctx, x, base, h) {
  ctx.beginPath();
  for (const [t0, t1, hw] of [[0, 0.42, 0.15], [0.2, 0.68, 0.22], [0.42, 0.95, 0.29]]) {
    ctx.moveTo(x, base - h + t0 * h); ctx.lineTo(x + hw * h, base - h + t1 * h); ctx.lineTo(x - hw * h, base - h + t1 * h); ctx.closePath();
  }
  ctx.rect(x - h * 0.03, base - h * 0.1, h * 0.06, h * 0.1);
  ctx.fill();
}

// a little pavilion on stilts at the water's edge, its windows lit, and its dim reflection
function pavilion(ctx, cx) {
  const glow = ctx.createRadialGradient(cx, 372, 4, cx, 372, 64);
  glow.addColorStop(0, 'rgba(255,190,110,.28)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, 372, 64, 0, Math.PI * 2); ctx.fill();
  const lamp = ctx.createRadialGradient(cx + 42, 368, 1, cx + 42, 368, 16);
  lamp.addColorStop(0, 'rgba(255,150,90,.45)'); lamp.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(cx + 42, 368, 16, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.3; ctx.translate(0, 800); ctx.scale(1, -1);   // mirrored in the lake
  pavilionShape(ctx, cx);
  ctx.restore();
  pavilionShape(ctx, cx);
  ctx.fillStyle = '#ffc985';
  ctx.fillRect(cx - 19, 367, 11, 13); ctx.fillRect(cx + 8, 367, 11, 13);
  ctx.fillStyle = '#0e1532';
  ctx.fillRect(cx - 14, 367, 1.2, 13); ctx.fillRect(cx + 13, 367, 1.2, 13);
  ctx.fillStyle = '#ff9a5e'; ctx.beginPath(); ctx.ellipse(cx + 42, 368, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
}

function pavilionShape(ctx, cx) {
  ctx.fillStyle = '#0e1532';
  for (const dx of [-30, -10, 10, 30]) ctx.fillRect(cx + dx - 1.2, 388, 2.4, 16);   // stilts
  ctx.fillRect(cx - 38, 386, 76, 4);   // deck
  ctx.fillRect(cx - 38, 379, 76, 1.5);   // rail
  for (const dx of [-38, -30, 30, 36.5]) ctx.fillRect(cx + dx, 379, 1.5, 8);
  ctx.fillRect(cx - 26, 362, 52, 25);   // walls
  ctx.beginPath();   // the lower roof, eaves turned up
  ctx.moveTo(cx - 49, 356); ctx.quadraticCurveTo(cx - 34, 361, cx - 21, 346); ctx.lineTo(cx + 21, 346);
  ctx.quadraticCurveTo(cx + 34, 361, cx + 49, 356); ctx.lineTo(cx + 40, 364); ctx.lineTo(cx - 40, 364); ctx.closePath(); ctx.fill();
  ctx.beginPath();   // the upper roof
  ctx.moveTo(cx - 25, 345); ctx.quadraticCurveTo(cx - 15, 347, cx - 8, 336); ctx.lineTo(cx + 8, 336);
  ctx.quadraticCurveTo(cx + 15, 347, cx + 25, 345); ctx.lineTo(cx + 19, 348); ctx.lineTo(cx - 19, 348); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - 1, 328, 2, 9);
  ctx.beginPath(); ctx.arc(cx, 327, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx + 41.5, 360, 1, 5);   // the hanging lantern's cord
}

// a short pier with a lamp at its end and a rowboat tied up beside it
function pier(ctx, lx) {
  ctx.fillStyle = '#0e1532';
  ctx.fillRect(lx - 104, 400, 112, 4);
  for (let x = lx - 100; x <= lx + 4; x += 26) ctx.fillRect(x, 404, 2.6, 12);
  ctx.save(); ctx.globalAlpha = 0.3;
  for (let x = lx - 100; x <= lx + 4; x += 26) ctx.fillRect(x, 416, 2.6, 10);
  ctx.restore();
  ctx.fillRect(lx - 1.2, 374, 2.4, 27);   // lamp post and arm
  ctx.fillRect(lx - 1.2, 374, 7, 1.6);
  ctx.fillStyle = '#ffcf8f'; ctx.beginPath(); ctx.ellipse(lx + 5, 379, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e1532';
  ctx.fillRect(lx + 2.5, 374.5, 5, 1.4);
  // the boat
  ctx.beginPath(); ctx.moveTo(lx - 66, 414); ctx.lineTo(lx - 10, 414); ctx.quadraticCurveTo(lx - 14, 423, lx - 24, 425);
  ctx.lineTo(lx - 54, 425); ctx.quadraticCurveTo(lx - 63, 422, lx - 66, 414); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(lx - 54, 427); ctx.lineTo(lx - 24, 427); ctx.quadraticCurveTo(lx - 14, 430, lx - 12, 433); ctx.lineTo(lx - 64, 433); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#0e1532'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx - 12, 415); ctx.quadraticCurveTo(lx - 7, 412, lx - 2, 404); ctx.stroke();
}

// reed clumps along the near shore, low in the corners
function reeds(ctx, x0, x1) {
  ctx.strokeStyle = '#0d1430'; ctx.fillStyle = '#0d1430'; ctx.lineCap = 'round';
  for (let i = Math.floor(x0 / 110) - 1; i <= Math.ceil(x1 / 110) + 1; i++) {
    const cx = i * 110 + hash(i + 501) * 60;
    if (beyond(cx) < 70 || hash(i + 502) > 0.55) continue;
    const n = 5 + Math.floor(hash(i + 503) * 5);
    for (let j = 0; j < n; j++) {
      const r1 = hash(i * 31 + j + 600), r2 = hash(i * 31 + j + 700);
      const bx = cx + (r1 - 0.5) * 34, h = 30 + r2 * 54, lean = (r1 - 0.5) * 22;
      ctx.lineWidth = 1.6 + r2 * 1.2;
      ctx.beginPath(); ctx.moveTo(bx, SIZE + 2); ctx.quadraticCurveTo(bx + lean * 0.2, SIZE - h * 0.6, bx + lean, SIZE - h); ctx.stroke();
      if (r2 > 0.6) { ctx.beginPath(); ctx.ellipse(bx + lean * 0.96, SIZE - h + 9, 2.4, 7, lean * 0.02, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

// beyond the square, every frame: moonlight glinting on open water, warm lights wavering on it
const LIGHTS = [[PAV - 13.5, 414, 6, 12], [PAV + 13.5, 414, 6, 12], [PAV + 42, 426, 4, 5], [PIER + 5, 418, 6, 8]];
function sideLights(ctx, t, x0, x1) {
  if (x0 >= 0 && x1 <= SIZE) return;
  for (let i = Math.floor(x0 / 64) - 1; i <= Math.ceil(x1 / 64) + 1; i++) {
    const x = i * 64 + hash(i + 300) * 40, d = beyond(x);
    if (d < 20) continue;
    const y = 414 + hash(i + 301) * 196, w = 8 + hash(i + 302) * 22;
    ctx.fillStyle = `rgba(180,200,255,${(ease((d - 20) / 160) * (0.06 + 0.04 * Math.sin(t * 0.7 + i * 2.3))).toFixed(3)})`;
    ctx.fillRect(x - w / 2 + Math.sin(t * 0.5 + i) * 4, y, w, 1.5);
  }
  for (const [lx, top, n, wd] of LIGHTS) {
    if (lx < x0 - 30 || lx > x1 + 30) continue;
    for (let i = 0; i < n; i++) {
      const w = wd * (1 - i / (n + 1)) + Math.sin(t * 0.9 + i + lx) * 2;
      ctx.fillStyle = `rgba(255,205,140,${(0.22 - i * 0.03).toFixed(2)})`;
      ctx.fillRect(lx - w / 2 + Math.sin(t * 1.2 + i * 1.7) * 2, top + i * 6, w, 1.6);
    }
  }
  if (PIER + 30 > x0 && PIER - 30 < x1) {   // the pier lamp flickers a little
    const r = 24 * (0.9 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    const g = ctx.createRadialGradient(PIER + 5, 379, 1, PIER + 5, 379, r);
    g.addColorStop(0, 'rgba(255,200,120,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PIER + 5, 379, r, 0, Math.PI * 2); ctx.fill();
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
  const ctx = setupCanvas(canvas, { wide: true });
  let t = 0, x = SIZE / 2, y = 470, target = SIZE / 2, targetY = 470, caught = 0, started = false, left = false, right = false, up = false, down = false, spawnT = 0;
  let flies = [], sparks = [], risen = [];
  // the still part of a wide scene, drawn once per screen shape at the canvas's own pixels
  // (the square's is just two shapes, drawn straight onto the canvas as it always was)
  const still = document.createElement('canvas');
  let stillKey = '';
  const say = () => setScore(caught ? `${caught} firefl${caught === 1 ? 'y' : 'ies'}${risen.length ? ` · ${risen.length} lantern${risen.length === 1 ? '' : 's'} risen` : ''}` : 'Drift to gather fireflies');
  // the visible stretch, in scene coordinates: 0…640 in the square frame, wider in full screen
  const span = () => { const o = ((canvas._snW || SIZE) - SIZE) / 2; return [-o, SIZE + o]; };

  const onMove = (e) => { const p = pointIn(canvas, e), [x0, x1] = span(); target = clamp(p.x + x0, x0 + 30, x1 - 30); targetY = clamp(p.y, 250, 560); started = true; };
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
    const W = canvas._snW || SIZE, [x0, x1] = span();
    t += dt;
    if (left) target = clamp(target - 260 * dt, x0 + 30, x1 - 30);
    if (right) target = clamp(target + 260 * dt, x0 + 30, x1 - 30);
    target = clamp(target, x0 + 30, x1 - 30);   // back into view when the screen narrows
    if (up) targetY = clamp(targetY - 220 * dt, 250, 560);
    if (down) targetY = clamp(targetY + 220 * dt, 250, 560);
    x += (target - x) * Math.min(1, dt * 3.2);
    y += (targetY - y) * Math.min(1, dt * 2.6);
    spawnT -= dt;
    // as many fireflies, and as often, per stretch of sky as in the square
    if (spawnT <= 0 && flies.length < Math.round((11 * W) / SIZE)) { flies.push({ x: x0 + 40 + Math.random() * (W - 80), y: t < 2 ? 80 + Math.random() * 260 : -10, v: 40 + Math.random() * 35, p: Math.random() * 6, w: 0.6 + Math.random() }); spawnT = (t < 2 ? 0.15 : 0.6 + Math.random() * 0.9) * (SIZE / W); }
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
    flies = flies.filter((f) => !f.got && f.y < SIZE + 20 && f.x > x0 - 100 && f.x < x1 + 100);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt; }
    sparks = sparks.filter((s) => s.l > 0);
    for (const r of risen) { if (r.y > 60 + (risen.indexOf(r) % 5) * 26) r.y -= 22 * dt; r.x += Math.sin(t * 0.5 + r.drift) * 4 * dt; }

    const wide = W > SIZE, key = `${canvas.width}x${canvas.height}:${W}`;
    if (wide && key !== stillKey) {
      stillKey = key;
      still.width = canvas.width; still.height = canvas.height;
      const sc = still.getContext('2d'), k = canvas.height / SIZE;
      sc.setTransform(k, 0, 0, k, -x0 * k, 0);
      land(sc, x0, x1);
    }
    ctx.save();
    ctx.translate(-x0, 0);
    backdrop(ctx, t, x0, x1);
    if (wide) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(still, 0, 0); ctx.restore(); } else land(ctx, x0, x1);
    moonPath(ctx, t);
    sideLights(ctx, t, x0, x1);
    for (const r of risen) lantern(ctx, r.x, r.y, r.s, 0.6, t);
    for (const f of flies) firefly(ctx, f, t);
    for (const s of sparks) { ctx.fillStyle = `rgba(240,255,190,${s.l})`; ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill(); }
    // reflection, then the lantern
    if (ly > 396) { ctx.globalAlpha = 0.22; lantern(ctx, x, Math.min(SIZE - 20, ly + 80), 0.8, 0.5, t); ctx.globalAlpha = 1; }
    lantern(ctx, x, ly, 1, 1 + Math.sin(t * 2) * 0.08, t);
    if (!started) card(ctx, [{ text: 'Lantern Drift', size: 32, weight: 700 }, { text: 'Move the pointer or arrow keys to drift', size: 17, weight: 500, alpha: 0.9 }], { y: 250 });
    ctx.restore();
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
