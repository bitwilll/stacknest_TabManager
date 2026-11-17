// Llama Trail — a llama slides down from the mountains and ambles along an endless forest path. Space, ↑ or a tap hops it over
// stones, logs and bushes; apples hang along the way. A stumble is not a game over screen,
// just a sit-down and a breath before walking on. The light drifts from morning through gold
// to dusk and back as the walk goes on; the pace rises slowly and never gets frantic. Bach's
// Prelude in C plays softly underneath (js/arcade-kit.js).

import { SIZE, setupCanvas, runLoop, note, card, mix, playMusic, PRELUDE } from './arcade-kit.js';

export const meta = { id: 'llama', title: 'Llama Trail', blurb: 'Hop over stones on an endless forest path.', keys: 'Space, ↑ or tap to hop' };
const BEST_KEY = 'stacknest:arcade-llama-best';

const GROUND = 520;
const SKIES = [   // top, bottom, sun, hills, far forest, near forest, path, mountains
  ['#bfe0f0', '#f4eedd', '#fff6d8', '#b9cdb6', '#7fa38a', '#4f7a5e', '#cfb58e', '#9fb3c8'],
  ['#f2c79a', '#fbe7c6', '#ffe1a6', '#d1b28f', '#9a9a6e', '#5f7350', '#d6b086', '#b59c95'],
  ['#5b5a8a', '#e3a58f', '#ffd0a0', '#8a7091', '#5d5a78', '#3a4258', '#a98a78', '#6c5f86'],
];
// a snowy range far behind everything (tiles every 1280)
const PEAKS = [[0, 300], [120, 170], [230, 262], [360, 118], [500, 250], [640, 160], [760, 280], [900, 136], [1040, 252], [1160, 186], [1280, 300]];
function drawMountains(ctx, off, color) {
  for (const shift of [0, 1280]) {
    const pts = PEAKS.map(([x, y]) => [x - off + shift, y + 40]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], 460);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], 460);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 150, 0, 270);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(pts[0][0], 140, 1280, 140);
    ctx.restore();
  }
}
// the slope the llama slides down at the start of a walk: from the mountainside to the path
const SLIDE = { p0: [-20, 360], c: [70, 470], p1: [150, GROUND] };
const onSlide = (s) => {
  const u = 1 - s, { p0, c, p1 } = SLIDE;
  return { x: u * u * p0[0] + 2 * u * s * c[0] + s * s * p1[0], y: u * u * p0[1] + 2 * u * s * c[1] + s * s * p1[1],
    a: Math.atan2(2 * u * (c[1] - p0[1]) + 2 * s * (p1[1] - c[1]), 2 * u * (c[0] - p0[0]) + 2 * s * (p1[0] - c[0])) };
};
function drawSlope(ctx, shift, near) {
  const { p0, c, p1 } = SLIDE;
  ctx.save();
  ctx.translate(-shift, 0);
  ctx.beginPath();
  ctx.moveTo(-60, SIZE);
  ctx.lineTo(-60, p0[1] - 10);
  ctx.lineTo(p0[0], p0[1]);
  ctx.quadraticCurveTo(c[0], c[1], p1[0] + 60, p1[1] + 2);
  ctx.lineTo(p1[0] + 60, SIZE);
  ctx.closePath();
  ctx.fillStyle = near;
  ctx.fill();
  // snow along the top of the slope, thinning toward the path
  ctx.beginPath();
  ctx.moveTo(-60, p0[1] - 10);
  ctx.lineTo(p0[0], p0[1]);
  ctx.quadraticCurveTo(c[0], c[1], p1[0] + 60, p1[1] + 2);
  ctx.lineTo(p1[0] + 30, p1[1] + 6);
  ctx.quadraticCurveTo(c[0] - 10, c[1] + 16, p0[0], p0[1] + 22);
  ctx.lineTo(-60, p0[1] + 14);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fill();
  ctx.restore();
}

function skyAt(p) {   // p in [0,1): morning → gold → dusk → morning
  const n = SKIES.length, x = p * n, i = Math.floor(x) % n, j = (i + 1) % n, t = x - Math.floor(x);
  const e = t * t * (3 - 2 * t);
  return SKIES[i].map((c, k) => mix(c, SKIES[j][k], e));
}

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// a repeating ridge (hills, tree line) of width 1280 so it tiles while scrolling
function ridgePts(seed, base, amp, n = 16) {
  const r = rng(seed); const pts = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * 1280, base - r() * amp]);
  pts[n][1] = pts[0][1];
  return pts;
}
function drawRidge(ctx, pts, off, color) {
  ctx.fillStyle = color;
  for (const shift of [0, 1280]) {
    ctx.beginPath();
    ctx.moveTo(-off + shift, SIZE);
    ctx.lineTo(-off + shift + pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      ctx.bezierCurveTo(-off + shift + mx, y0, -off + shift + mx, y1, -off + shift + x1, y1);
    }
    ctx.lineTo(-off + shift + 1280, SIZE);
    ctx.closePath();
    ctx.fill();
  }
}
function pine(ctx, x, base, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const top = base - h + k * h * 0.22, w = h * (0.22 + k * 0.1);
    ctx.moveTo(x, top);
    ctx.lineTo(x - w, top + h * 0.42);
    ctx.lineTo(x + w, top + h * 0.42);
  }
  ctx.fill();
  ctx.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.12);
}

function drawLlama(ctx, x, feet, t, air, sit) {
  const wool = '#f6ecdb', line = '#d4bf9c', dark = '#8a7356';
  ctx.save();
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = line; ctx.lineWidth = 7;
  const swing = air ? 0 : Math.sin(t * 13) * 9;
  const legs = sit ? [[-24, 0], [-12, 0], [10, 0], [22, 0]] : [[-24, swing], [-12, -swing], [12, -swing], [24, swing]];
  for (const [lx, s] of legs) {
    ctx.beginPath();
    const top = feet - 44;
    if (sit) { ctx.moveTo(x + lx, top + 10); ctx.lineTo(x + lx + 8, feet - 4); }
    else if (air) { ctx.moveTo(x + lx, top); ctx.lineTo(x + lx - 6, feet - 14); }
    else { ctx.moveTo(x + lx, top); ctx.lineTo(x + lx + s * 0.6, feet - 2); }
    ctx.stroke();
  }
  const by = sit ? feet - 40 : feet - 56;
  // tail
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.arc(x - 40, by - 10, 9, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.beginPath(); ctx.ellipse(x, by, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  // blanket
  ctx.fillStyle = '#e8775a';
  ctx.beginPath(); ctx.ellipse(x - 2, by - 8, 20, 13, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x - 21, by - 9, 38, 3);
  // neck
  ctx.fillStyle = wool;
  const bob = air || sit ? 0 : Math.sin(t * 13) * 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 22, by - 8);
  ctx.quadraticCurveTo(x + 30, by - 40 + bob, x + 30, by - 58 + bob);
  ctx.lineTo(x + 46, by - 58 + bob);
  ctx.quadraticCurveTo(x + 44, by - 30, x + 40, by - 4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = line; ctx.stroke();
  // head
  const hx = x + 44, hy = by - 64 + bob;
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.ellipse(hx, hy, 15, 11, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#eadbc0';
  ctx.beginPath(); ctx.ellipse(hx + 11, hy + 3, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.fillStyle = wool;
  for (const ex of [-6, 2]) { ctx.beginPath(); ctx.moveTo(hx + ex, hy - 8); ctx.lineTo(hx + ex - 3, hy - 22); ctx.lineTo(hx + ex + 5, hy - 10); ctx.fill(); ctx.stroke(); }
  // eye: a calm closed curve while sitting
  ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 2;
  if (sit) { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 2.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawObstacle(ctx, o) {
  ctx.save();
  if (o.kind === 'stone') {
    ctx.fillStyle = '#8d918f';
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, GROUND, o.w / 2, o.h, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#a9adaa';
    ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.4, GROUND - o.h * 0.55, o.w * 0.2, o.h * 0.25, -0.3, 0, Math.PI * 2); ctx.fill();
  } else if (o.kind === 'log') {
    ctx.fillStyle = '#8a5d3b';
    ctx.beginPath(); ctx.roundRect(o.x, GROUND - o.h, o.w, o.h, o.h / 2); ctx.fill();
    ctx.fillStyle = '#c49a6c';
    ctx.beginPath(); ctx.ellipse(o.x + o.w - 6, GROUND - o.h / 2, 7, o.h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5d3b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(o.x + o.w - 6, GROUND - o.h / 2, 3, o.h / 4, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#5f8f5a';
    for (const [dx, dy, r] of [[0.25, 0.45, 0.3], [0.55, 0.3, 0.36], [0.8, 0.5, 0.28]]) {
      ctx.beginPath(); ctx.arc(o.x + o.w * dx, GROUND - o.h * dy, o.w * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f3d36b';
    ctx.beginPath(); ctx.arc(o.x + o.w * 0.5, GROUND - o.h * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawApple(ctx, a, t) {
  const y = a.y + Math.sin(t * 2 + a.x * 0.01) * 4;
  ctx.save();
  ctx.fillStyle = 'rgba(255,240,200,.35)';
  ctx.beginPath(); ctx.arc(a.x, y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9534f';
  ctx.beginPath(); ctx.arc(a.x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6aa457';
  ctx.beginPath(); ctx.ellipse(a.x + 4, y - 10, 5, 2.5, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function makeWorld() {
  return {
    hills: ridgePts(11, 360, 90), far: ridgePts(23, 420, 50, 24), trees: (() => { const r = rng(37); return Array.from({ length: 18 }, (_, i) => ({ x: i * 72 + r() * 30, h: 70 + r() * 60 })); })(),
    near: (() => { const r = rng(41); return Array.from({ length: 8 }, (_, i) => ({ x: i * 160 + r() * 60, h: 120 + r() * 70 })); })(),
    clouds: (() => { const r = rng(5); return Array.from({ length: 5 }, (_, i) => ({ x: i * 260 + r() * 80, y: 70 + r() * 110, s: 0.7 + r() * 0.6 })); })(),
  };
}

function drawScene(ctx, world, dist, cycle, t) {
  const [top, bottom, sun, hills, far, near, path, peaks] = skyAt(cycle);
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  // sun, sinking a little toward dusk
  const sy = 150 + Math.sin(cycle * Math.PI * 2 - Math.PI / 2) * 40 + 40;
  ctx.fillStyle = sun; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(470, sy, 38, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(470, sy, 70, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (const c of world.clouds) {
    const x = ((c.x - dist * 0.04) % 1300 + 1300) % 1300 - 200;
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 26], [50, 0, 20]]) { ctx.beginPath(); ctx.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2); ctx.fill(); }
  }
  drawMountains(ctx, (dist * 0.04) % 1280, peaks);
  drawRidge(ctx, world.hills, (dist * 0.1) % 1280, hills);
  drawRidge(ctx, world.far, (dist * 0.22) % 1280, far);
  for (const tr of world.trees) { const x = ((tr.x - dist * 0.35) % 1296 + 1296) % 1296 - 40; pine(ctx, x, GROUND - 20, tr.h, far); }
  for (const tr of world.near) { const x = ((tr.x - dist * 0.6) % 1280 + 1280) % 1280 - 60; pine(ctx, x, GROUND + 4, tr.h, near); }
  // the path
  ctx.fillStyle = near; ctx.fillRect(0, GROUND - 4, SIZE, SIZE - GROUND + 4);
  ctx.fillStyle = path; ctx.fillRect(0, GROUND, SIZE, 44);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  for (let x = -((dist) % 64); x < SIZE; x += 64) ctx.fillRect(x, GROUND + 18, 26, 4);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  for (let x = -((dist * 1.0 + 30) % 90); x < SIZE; x += 90) ctx.fillRect(x, GROUND + 32, 12, 3);
  // grass tufts in front
  ctx.strokeStyle = near; ctx.lineWidth = 2;
  for (let x = -((dist * 1.2) % 40); x < SIZE; x += 40) { ctx.beginPath(); ctx.moveTo(x, SIZE - 50); ctx.lineTo(x + 4, SIZE - 62); ctx.moveTo(x + 6, SIZE - 50); ctx.lineTo(x + 12, SIZE - 64); ctx.stroke(); }
  return { path, near };
}

export function preview(ctx) {
  const world = makeWorld();
  const { near } = drawScene(ctx, world, 220, 0.18, 0);
  drawSlope(ctx, 0, near);
  drawObstacle(ctx, { kind: 'stone', x: 420, w: 44, h: 26 });
  const p = onSlide(0.55);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a * 0.55); drawLlama(ctx, 0, 0, 0, true, false); ctx.restore();
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  const world = makeWorld();
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* none */ }
  let state = 'ready', t = 0, dist = 0, speed = 250, y = 0, vy = 0, onGround = true, held = false, apples = 0;
  let obstacles = [], fruit = [], nextGap = 520, cycle = 0.05, restT = 0, puffs = [], slideS = 0, slideShift = 0;
  const LX = SLIDE.p1[0];

  const reset = () => { dist = 0; speed = 250; y = 0; vy = 0; onGround = true; apples = 0; obstacles = []; fruit = []; nextGap = 760; puffs = []; slideS = 0; slideShift = 0; };
  const meters = () => Math.floor(dist / 40);
  const score = () => setScore(`${meters()} m${apples ? ` · ${apples} apple${apples === 1 ? '' : 's'}` : ''}${best ? ` · best ${best} m` : ''}`);

  function jump() {
    if (state === 'ready' || state === 'rest') {
      if (state === 'rest' && restT < 0.6) return;   // a breath before walking on
      reset(); state = 'intro'; score(); note(9, { dur: 1.4, vol: 0.04 }); return;   // down the mountainside first
    }
    if (state === 'run' && onGround) { vy = -760; onGround = false; note(4, { dur: 0.35, vol: 0.05 }); }
  }
  const release = () => { held = false; if (vy < -300) vy = -300; };   // a short tap is a short hop

  const onKey = (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (!held) { held = true; jump(); } }
  };
  const onKeyUp = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') release(); };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); held = true; jump(); };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function spawn() {
    const r = Math.random();
    const kind = r < 0.45 ? 'stone' : r < 0.75 ? 'log' : 'bush';
    const o = kind === 'stone' ? { w: 34 + Math.random() * 20, h: 20 + Math.random() * 12 }
      : kind === 'log' ? { w: 54 + Math.random() * 26, h: 22 } : { w: 42 + Math.random() * 16, h: 34 + Math.random() * 8 };
    obstacles.push({ kind, x: SIZE + 20, ...o });
    if (Math.random() < 0.45) fruit.push({ x: SIZE + 20 + o.w / 2, y: GROUND - 150 - Math.random() * 40, got: false });
    nextGap = (380 + Math.random() * 420) * (speed / 250) ** 0.6;
  }

  function update(dt) {
    t += dt;
    cycle = (cycle + dt / 150) % 1;
    if (state === 'run') {
      speed = Math.min(470, speed + dt * 5);
      const dx = speed * dt;
      dist += dx;
      nextGap -= dx;
      if (nextGap <= 0) spawn();
      for (const o of obstacles) o.x -= dx;
      for (const a of fruit) a.x -= dx;
      obstacles = obstacles.filter((o) => o.x + o.w > -40);
      fruit = fruit.filter((a) => a.x > -30 && !a.got);
      // hop
      vy += 2100 * dt;
      y = Math.min(0, y + vy * dt);
      if (y === 0 && vy > 0) { if (!onGround) puffs.push({ x: LX, t: 0 }); vy = 0; onGround = true; }
      // bump (a forgiving box: wool is soft)
      const feet = GROUND + y;
      for (const o of obstacles) {
        if (LX + 30 > o.x + 6 && LX - 26 < o.x + o.w - 6 && feet > GROUND - o.h + 6) {
          state = 'rest'; restT = 0; y = 0; vy = 0; onGround = true;
          if (meters() > best) { best = meters(); try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* not kept */ } }
          note(0, { dur: 1.1, vol: 0.06 }); note(2, { dur: 1.1, vol: 0.04 });
          break;
        }
      }
      for (const a of fruit) {
        if (!a.got && Math.abs(a.x - (LX + 40)) < 28 && Math.abs(a.y - (feet - 110)) < 40) { a.got = true; apples += 1; note(7 + (apples % 5), { dur: 0.6, vol: 0.07 }); }
      }
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) score();
    } else if (state === 'rest') restT += dt;
    else if (state === 'intro') {
      slideS = Math.min(1, slideS + dt / 1.7);
      const p = onSlide(0.22 + (slideS * slideS * (3 - 2 * slideS) * 0.15 + slideS * 0.85) * 0.78);
      if (Math.random() < 0.6) puffs.push({ x: p.x + 20, y: p.y, t: 0, snow: true });
      if (slideS >= 1) { state = 'run'; puffs.push({ x: LX, t: 0 }); }
    }
    if (state === 'run' && slideShift < 400) slideShift += speed * dt;   // the slope slips away behind
    puffs = puffs.filter((p) => (p.t += dt) < 0.5);
    draw();
  }

  function draw() {
    drawScene(ctx, world, dist + t * (state === 'run' ? 0 : 18), cycle, t);
    for (const a of fruit) if (!a.got) drawApple(ctx, a, t);
    for (const o of obstacles) drawObstacle(ctx, o);
    const near = skyAt(cycle)[5];
    if (state === 'ready' || state === 'intro' || slideShift < 400) drawSlope(ctx, slideShift, near);
    for (const p of puffs) { ctx.fillStyle = `rgba(255,255,255,${0.5 - p.t})`; ctx.beginPath(); ctx.arc(p.x - 30 - p.t * 60, (p.snow ? p.y : GROUND) - 4, 6 + p.t * 14, 0, Math.PI * 2); ctx.fill(); }
    if (state === 'ready' || state === 'intro') {
      const s = state === 'ready' ? 0.22 : 0.22 + (slideS * slideS * (3 - 2 * slideS) * 0.15 + slideS * 0.85) * 0.78;
      const p = onSlide(s);
      // leaning into the slide, not tumbling
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a * 0.55); drawLlama(ctx, 0, 0, t, true, state === 'ready'); ctx.restore();
    } else drawLlama(ctx, LX, GROUND + y, t, !onGround, state === 'rest');
    if (state === 'ready') card(ctx, [{ text: 'Llama Trail', size: 34, weight: 700 }, { text: 'Space, ↑ or tap to slide down and walk', size: 18, weight: 500, alpha: 0.9 }], { y: 140 });
    if (state === 'rest') card(ctx, [{ text: 'A little stumble.', size: 28, weight: 700 }, { text: `${meters()} m walked${apples ? ` · ${apples} apple${apples === 1 ? '' : 's'}` : ''}`, size: 18, weight: 500 },
      { text: restT > 0.6 ? 'Breathe, then hop to walk on' : ' ', size: 16, weight: 500, alpha: 0.85 }], { y: 200 });
  }

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
    canvas.removeEventListener('pointerup', release);
    canvas.removeEventListener('pointercancel', release);
  };
}

