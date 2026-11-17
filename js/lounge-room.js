// Night Room — a lounge, not a game: the view from your chair at a desk by the window, late.
// Rain runs down the glass in front of a sleeping city, fairy lights glow along the curtain
// rail, a lava lamp turns slowly, steam lifts off a mug, the keyboard's backlight drifts
// through colours and the cat on the sill breathes. A lo-fi loop plays under the rain.
// Everything you touch answers: the lamp, the screen, the window, the cat, the lava lamp,
// the keyboard and the mug.

import { SIZE, setupCanvas, runLoop, pointIn, note, drip, playMusic, playAmbience, LOFI } from './arcade-kit.js';

export const meta = { id: 'room', title: 'Night Room', blurb: 'A desk by a rainy window, late. A lava lamp, a mug, a sleeping cat.', keys: 'Click the lamp, screen, window, cat…', lounge: true };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const WIN = { x: 120, y: 48, w: 400, h: 282 };
const DESK_Y = 392;
const LAVA = [['#ff7a59', '#ffb36b'], ['#c56cf0', '#7ed6df'], ['#4cd4a8', '#f9e076'], ['#ff6fa8', '#ffc3e1']];

const SKYLINE = (() => {
  const r = rng(7); const far = [], near = [];
  for (let x = WIN.x - 10; x < WIN.x + WIN.w + 10;) { const w = 18 + r() * 34; far.push({ x, w, h: 40 + r() * 90 }); x += w + 2; }
  for (let x = WIN.x - 10; x < WIN.x + WIN.w + 10;) {
    const w = 26 + r() * 46, h = 60 + r() * 120, lit = [];
    for (let wy = 8; wy < h - 6; wy += 11) for (let wx = 5; wx < w - 6; wx += 9) if (r() < 0.32) lit.push([wx, wy, r() * 6]);
    near.push({ x, w, h, lit }); x += w + 3;
  }
  return { far, near };
})();
const STARS = (() => { const r = rng(19); return Array.from({ length: 50 }, () => ({ x: WIN.x + r() * WIN.w, y: WIN.y + r() * 140, p: r() * 6 })); })();

function makeState() {
  const r = rng(3);
  return {
    t: 0, lamp: 1, lampOn: true, weather: 'rain', screen: 0, lavaPal: 0, purr: 0, zzz: [], waves: [], steam: 0,
    drops: Array.from({ length: 26 }, () => ({ x: WIN.x + 8 + r() * (WIN.w - 16), y: WIN.y + r() * WIN.h, r: 1.4 + r() * 2.6, v: 0, hold: r() * 3 })),
    streaks: Array.from({ length: 110 }, () => ({ x: WIN.x + r() * (WIN.w + 80), y: WIN.y + r() * WIN.h, l: 10 + r() * 14, v: 380 + r() * 220 })),
    flakes: Array.from({ length: 90 }, () => ({ x: WIN.x + r() * WIN.w, y: WIN.y + r() * WIN.h, s: 0.8 + r() * 1.8, v: 18 + r() * 26, p: r() * 6 })),
    blobs: Array.from({ length: 6 }, (_, i) => ({ ph: r() * 6, sp: 0.06 + r() * 0.07, r: 6 + r() * 6, dx: (r() - 0.5) * 10, i })),
    motes: Array.from({ length: 26 }, () => ({ x: 60 + r() * 260, y: 250 + r() * 200, vx: (r() - 0.5) * 6, vy: -2 - r() * 5, p: r() * 6 })),
    code: [], codeT: 0, shooting: null,
  };
}

/* ——— the parts of the room ——— */

function wall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  g.addColorStop(0, '#221d33'); g.addColorStop(1, '#2f2742');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, DESK_Y + 2);
  ctx.fillStyle = 'rgba(255,255,255,.018)';
  for (let x = 0; x < SIZE; x += 22) ctx.fillRect(x, 0, 10, DESK_Y);
}

function outside(ctx, s) {
  const { x, y, w, h } = WIN;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, s.weather === 'clear' ? '#0d1330' : '#161b36'); g.addColorStop(1, '#3a3c66');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (s.weather === 'clear') for (const st of STARS) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(s.t * 0.8 + st.p))})`; ctx.fillRect(st.x, st.y, 1.6, 1.6); }
  // moon behind thin cloud
  const mg = ctx.createRadialGradient(x + w * 0.75, y + 62, 6, x + w * 0.75, y + 62, 80);
  mg.addColorStop(0, 'rgba(255,244,214,.5)'); mg.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = mg; ctx.fillRect(x, y, w, 180);
  ctx.fillStyle = '#f6eed8'; ctx.beginPath(); ctx.arc(x + w * 0.75, y + 62, 18, 0, Math.PI * 2); ctx.fill();
  if (s.weather !== 'clear') {
    ctx.fillStyle = 'rgba(70,74,110,.55)';
    for (let k = 0; k < 4; k++) { const cx = ((x + k * 140 + s.t * 6) % (w + 200)) + x - 100; ctx.beginPath(); ctx.ellipse(cx, y + 40 + k * 14, 90, 16, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  if (s.shooting) { const p = s.shooting; ctx.strokeStyle = `rgba(255,255,255,${p.l})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 40, p.y - 14); ctx.stroke(); }
  // the city: a far, hazy row and a near one with lit windows
  for (const b of SKYLINE.far) { ctx.fillStyle = '#2a2d52'; ctx.fillRect(b.x, y + h - b.h - 40, b.w, b.h + 40); }
  for (const b of SKYLINE.near) {
    ctx.fillStyle = '#1b1c36'; ctx.fillRect(b.x, y + h - b.h, b.w, b.h);
    for (const [wx, wy, ph] of b.lit) {
      const on = Math.sin(s.t * 0.05 + ph * 3) > -0.85;
      if (!on) continue;
      ctx.fillStyle = ph > 4 ? 'rgba(160,220,255,.75)' : 'rgba(255,214,140,.8)';
      ctx.fillRect(b.x + wx, y + h - b.h + wy, 4, 5);
    }
  }
  // weather beyond the glass
  if (s.weather === 'rain') {
    ctx.strokeStyle = 'rgba(190,205,255,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (const r of s.streaks) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * 0.3, r.y + r.l); } ctx.stroke();
  } else if (s.weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of s.flakes) { ctx.beginPath(); ctx.arc(f.x + Math.sin(s.t + f.p) * 6, f.y, f.s, 0, Math.PI * 2); ctx.fill(); }
  }
  // drops on the glass itself, sliding in fits and starts
  if (s.weather === 'rain') {
    for (const d of s.drops) {
      ctx.strokeStyle = 'rgba(200,215,255,.12)'; ctx.lineWidth = d.r * 0.8;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - 26); ctx.lineTo(d.x, d.y); ctx.stroke();
      const dg = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.4, 0.2, d.x, d.y, d.r * 1.2);
      dg.addColorStop(0, 'rgba(255,255,255,.75)'); dg.addColorStop(0.5, 'rgba(170,190,240,.35)'); dg.addColorStop(1, 'rgba(120,140,200,.15)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the room reflected faintly in the glass
  ctx.fillStyle = 'rgba(255,190,120,.035)'; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function frame(ctx) {
  const { x, y, w, h } = WIN;
  ctx.fillStyle = '#4a3a36';
  ctx.fillRect(x - 12, y - 12, w + 24, 12); ctx.fillRect(x - 12, y + h, w + 24, 10);
  ctx.fillRect(x - 12, y, 12, h); ctx.fillRect(x + w, y, 12, h);
  ctx.fillRect(x + w / 2 - 4, y, 8, h); ctx.fillRect(x, y + h * 0.48, w, 7);
  // the sill, deep enough for a cat
  ctx.fillStyle = '#5a4842'; ctx.fillRect(x - 26, y + h + 8, w + 52, 14);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 26, y + h + 22, w + 52, 6);
}

function curtains(ctx, t) {
  for (const side of [-1, 1]) {
    const edge = side < 0 ? WIN.x - 6 : WIN.x + WIN.w + 6;
    const outer = side < 0 ? WIN.x - 78 : WIN.x + WIN.w + 78;
    const sway = Math.sin(t * 0.5 + side) * 3;
    const g = ctx.createLinearGradient(Math.min(edge, outer), 0, Math.max(edge, outer), 0);
    g.addColorStop(0, '#6b4b62'); g.addColorStop(0.5, '#7f5a74'); g.addColorStop(1, '#5d4156');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(outer, 22); ctx.lineTo(edge, 22);
    ctx.quadraticCurveTo(edge + side * 18 + sway, 200, edge + side * 34 + sway, DESK_Y - 26);
    ctx.lineTo(outer + side * 6, DESK_Y - 26);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 3;
    for (let k = 1; k < 4; k++) { const fx = edge + (outer - edge) * (k / 4); ctx.beginPath(); ctx.moveTo(fx, 26); ctx.quadraticCurveTo(fx + side * 10 + sway, 200, fx + side * (18 + k * 3) + sway, DESK_Y - 30); ctx.stroke(); }
  }
  ctx.fillStyle = '#2b2328'; ctx.fillRect(WIN.x - 96, 18, WIN.w + 192, 6);
}

const BULBS = ['#ffd27a', '#ff9f80', '#ffe9b0', '#9fe3c6', '#ffc2d6'];
function fairyLights(ctx, t, glowPass) {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18, x = WIN.x - 80 + u * (WIN.w + 160);
    const sag = Math.sin(u * Math.PI * 3) * 0 + (Math.sin(u * Math.PI * 3 - Math.PI / 2) + 1) * 9;
    pts.push([x, 30 + sag]);
  }
  if (!glowPass) {
    ctx.strokeStyle = 'rgba(30,30,30,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  pts.forEach(([x, y], i) => {
    const c = BULBS[i % BULBS.length], b = 0.55 + 0.45 * Math.sin(t * 1.3 + i * 1.7);
    if (glowPass) {
      const g = ctx.createRadialGradient(x, y + 5, 0, x, y + 5, 22);
      g.addColorStop(0, c + '88'); g.addColorStop(1, c + '00');
      ctx.globalAlpha = b * 0.8; ctx.fillStyle = g; ctx.fillRect(x - 22, y - 17, 44, 44); ctx.globalAlpha = 1;
    } else { ctx.fillStyle = c; ctx.globalAlpha = 0.6 + b * 0.4; ctx.beginPath(); ctx.ellipse(x, y + 5, 3, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  });
}

function wallThings(ctx) {
  // a small framed print of mountains
  ctx.fillStyle = '#d9cbb3'; ctx.fillRect(18, 116, 76, 92);
  ctx.fillStyle = '#9fb3c8'; ctx.fillRect(26, 124, 60, 76);
  ctx.fillStyle = '#6a7f9a'; ctx.beginPath(); ctx.moveTo(26, 200); ctx.lineTo(46, 150); ctx.lineTo(60, 172); ctx.lineTo(72, 140); ctx.lineTo(86, 200); ctx.fill();
  ctx.fillStyle = '#f2e8d8'; ctx.beginPath(); ctx.moveTo(66, 152); ctx.lineTo(72, 140); ctx.lineTo(78, 155); ctx.fill();
  // a shelf of books and a tiny cactus
  ctx.fillStyle = '#5a4436'; ctx.fillRect(548, 168, 92, 6);
  const books = [['#c8796b', 12, 44], ['#d8b26e', 9, 38], ['#6f8fa6', 14, 48], ['#8a9a72', 10, 40], ['#b58fb0', 11, 36]];
  let bx = 556; for (const [c, w, h] of books) { ctx.fillStyle = c; ctx.fillRect(bx, 168 - h, w, h); bx += w + 1; }
  ctx.fillStyle = '#b8714f'; ctx.fillRect(616, 152, 14, 16);
  ctx.fillStyle = '#5f9a5f'; ctx.beginPath(); ctx.ellipse(623, 144, 6, 11, 0, 0, Math.PI * 2); ctx.fill();
}

function cat(ctx, s) {
  const x = WIN.x + 58, y = WIN.y + WIN.h + 8;
  const breath = 1 + Math.sin(s.t * 1.3) * 0.025;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(4, 0, 48, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d3a44';
  ctx.beginPath(); ctx.ellipse(0, -18 * breath, 42, 20 * breath, 0, Math.PI, 0); ctx.lineTo(42, 0); ctx.lineTo(-42, 0); ctx.fill();
  // head tucked in, ears, a closed eye
  ctx.beginPath(); ctx.arc(-34, -14, 15, 0, Math.PI * 2); ctx.fill();
  const twitch = Math.sin(s.t * 0.7) > 0.97 ? -3 : 0;
  ctx.beginPath(); ctx.moveTo(-44, -22); ctx.lineTo(-46, -36 + twitch); ctx.lineTo(-36, -27); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-30, -27); ctx.lineTo(-24, -38); ctx.lineTo(-22, -23); ctx.fill();
  ctx.strokeStyle = '#9b96a6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-37, -14, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // tail wrapped round the front
  ctx.strokeStyle = '#3d3a44'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(38, -6); ctx.quadraticCurveTo(30, 4, -8, 2); ctx.stroke();
  ctx.restore();
  for (const z of s.zzz) { ctx.fillStyle = `rgba(230,230,255,${z.l})`; ctx.font = `600 ${12 + (1 - z.l) * 8}px system-ui`; ctx.fillText('z', z.x, z.y); }
}

function desk(ctx, s) {
  const g = ctx.createLinearGradient(0, DESK_Y, 0, SIZE);
  g.addColorStop(0, '#6b4a3a'); g.addColorStop(1, '#3f2b22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, DESK_Y); ctx.lineTo(SIZE, DESK_Y); ctx.lineTo(SIZE, SIZE); ctx.lineTo(0, SIZE); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 9; k++) { const y = DESK_Y + 14 + k * k * 3.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(200, y - 4, 420, y + 5, SIZE, y - 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, DESK_Y, SIZE, 3);
  void s;
}

function lampBody(ctx, s) {
  ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.ellipse(72, DESK_Y + 10, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#34343c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(72, DESK_Y + 6); ctx.lineTo(60, 300); ctx.lineTo(118, 262); ctx.stroke();
  ctx.save(); ctx.translate(118, 262); ctx.rotate(0.5);
  ctx.fillStyle = '#3b3b44'; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(14, -6); ctx.lineTo(26, 22); ctx.lineTo(-26, 22); ctx.fill();
  ctx.fillStyle = s.lampOn ? '#fff1c9' : '#54545c'; ctx.beginPath(); ctx.ellipse(0, 22, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function lavaLamp(ctx, s) {
  const cx = 186, base = DESK_Y + 8, top = base - 130;
  const [c1, c2] = LAVA[s.lavaPal];
  ctx.fillStyle = '#7d7f88'; ctx.beginPath(); ctx.moveTo(cx - 20, base); ctx.lineTo(cx + 20, base); ctx.lineTo(cx + 13, base - 32); ctx.lineTo(cx - 13, base - 32); ctx.fill();
  const glass = new Path2D();
  glass.moveTo(cx - 14, base - 32); glass.lineTo(cx - 20, base - 70); glass.lineTo(cx - 9, top + 8); glass.lineTo(cx + 9, top + 8); glass.lineTo(cx + 20, base - 70); glass.lineTo(cx + 14, base - 32); glass.closePath();
  const lg = ctx.createLinearGradient(0, top, 0, base);
  lg.addColorStop(0, c2 + '55'); lg.addColorStop(1, c1 + '88');
  ctx.fillStyle = lg; ctx.fill(glass);
  ctx.save(); ctx.clip(glass);
  ctx.shadowColor = c1; ctx.shadowBlur = 10; ctx.fillStyle = c1;
  for (const b of s.blobs) {
    const u = (Math.sin(s.t * b.sp * 2 + b.ph) + 1) / 2;
    const y = base - 36 - u * 82, x = cx + Math.sin(s.t * 0.3 + b.ph) * 4 + b.dx * (1 - u) * 0.5;
    const rr = b.r * (0.8 + 0.3 * Math.sin(s.t * 0.5 + b.i));
    ctx.beginPath(); ctx.ellipse(x, y, rr * 0.9, rr * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(cx, base - 32, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#7d7f88'; ctx.beginPath(); ctx.moveTo(cx - 9, top + 8); ctx.lineTo(cx + 9, top + 8); ctx.lineTo(cx + 6, top - 4); ctx.lineTo(cx - 6, top - 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(cx - 12, base - 66, 3, 34);
}

const SCREEN = { x: 224, y: 222, w: 200, h: 128 };
function monitor(ctx, s) {
  const { x, y, w, h } = SCREEN;
  ctx.fillStyle = '#18181d'; ctx.fillRect(x + w / 2 - 8, y + h + 6, 16, DESK_Y - (y + h) - 2);
  ctx.beginPath(); ctx.ellipse(x + w / 2, DESK_Y + 4, 44, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#121216'; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, w + 16, h + 18, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (s.screen === 0) codeScreen(ctx, s, x, y, w, h);
  else if (s.screen === 1) playerScreen(ctx, s, x, y, w, h);
  else tankScreen(ctx, s, x, y, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.2, y + h); ctx.lineTo(x, y + h); ctx.fill();
}
const TOK = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b', '#a6accd'];
function codeScreen(ctx, s, x, y, w, h) {
  ctx.fillStyle = '#1e2030'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2a2d42'; ctx.fillRect(x, y, w, 12);
  for (const [i, c] of ['#ff6b6b', '#ffd166', '#06d6a0'].entries()) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 8 + i * 9, y + 6, 2.6, 0, Math.PI * 2); ctx.fill(); }
  const lines = s.code;
  lines.forEach((ln, i) => {
    const ly = y + 20 + i * 9;
    ctx.fillStyle = '#4b5068'; ctx.fillRect(x + 4, ly, 8, 4);
    let lx = x + 16 + ln.indent * 8, drawn = 0;
    for (const tk of ln.tokens) {
      const ww = Math.min(tk.w, ln.typed - drawn);
      if (ww <= 0) break;
      ctx.fillStyle = TOK[tk.c]; ctx.fillRect(lx, ly, ww, 4);
      lx += tk.w + 4; drawn += tk.w;
    }
    if (i === lines.length - 1 && Math.sin(s.t * 6) > 0) { ctx.fillStyle = '#e6e6e6'; ctx.fillRect(lx - 2, ly - 1, 2, 6); }
  });
}
function playerScreen(ctx, s, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#2b1f3d'); g.addColorStop(1, '#1b2a3d');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const ag = ctx.createLinearGradient(x + 12, y + 14, x + 12, y + 84);
  ag.addColorStop(0, '#ff9a8b'); ag.addColorStop(0.5, '#ff6a88'); ag.addColorStop(1, '#6c5ce7');
  ctx.fillStyle = ag; ctx.fillRect(x + 12, y + 14, 70, 70);
  ctx.fillStyle = 'rgba(255,240,220,.85)'; ctx.beginPath(); ctx.arc(x + 47, y + 56, 14, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f3f0ff'; ctx.font = '600 11px system-ui'; ctx.fillText('rain & rhodes', x + 92, y + 32);
  ctx.fillStyle = '#a9a3c9'; ctx.font = '500 9px system-ui'; ctx.fillText('stacknest radio', x + 92, y + 46);
  const prog = (s.t % 180) / 180;
  ctx.fillStyle = '#3f3b5c'; ctx.fillRect(x + 92, y + 60, 96, 3); ctx.fillStyle = '#ff9a8b'; ctx.fillRect(x + 92, y + 60, 96 * prog, 3);
  for (let i = 0; i < 22; i++) {
    const v = (Math.sin(s.t * 3.1 + i * 0.7) + Math.sin(s.t * 5.3 + i * 1.9) + 2) / 4;
    ctx.fillStyle = `hsl(${280 + i * 4}, 70%, ${55 + v * 15}%)`;
    const bh = 4 + v * 26; ctx.fillRect(x + 12 + i * 8.2, y + h - 10 - bh, 5, bh);
  }
}
function tankScreen(ctx, s, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0f4a6b'); g.addColorStop(1, '#06283d');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d9c8a0'; ctx.fillRect(x, y + h - 12, w, 12);
  ctx.strokeStyle = '#3a8f5a'; ctx.lineWidth = 3;
  for (const px of [30, 46, 160]) { ctx.beginPath(); ctx.moveTo(x + px, y + h - 10); ctx.quadraticCurveTo(x + px + Math.sin(s.t + px) * 8, y + h - 50, x + px + 4, y + h - 80); ctx.stroke(); }
  for (const [k, col] of [[0, '#ffb347'], [1, '#ff6f91'], [2, '#7ee8fa']]) {
    const fx = x + w / 2 + Math.sin(s.t * 0.4 + k * 2) * 70, fy = y + 40 + k * 22 + Math.sin(s.t * 0.9 + k) * 6;
    const dir = Math.cos(s.t * 0.4 + k * 2) > 0 ? 1 : -1;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx, fy, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx - dir * 8, fy); ctx.lineTo(fx - dir * 15, fy - 5); ctx.lineTo(fx - dir * 15, fy + 5); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 6; i++) { const by = y + h - ((s.t * 20 + i * 23) % h); ctx.beginPath(); ctx.arc(x + 40 + i * 25 + Math.sin(by * 0.1) * 3, by, 1.6, 0, Math.PI * 2); ctx.fill(); }
}

const KB = { far: [254, 392, 476], near: [226, 420, 548] };   // left x, right x, y
function keyboard(ctx, s) {
  const [fl, fr, fy] = KB.far, [nl, nr, ny] = KB.near;
  const pt = (u, v) => { const l = fl + (nl - fl) * v, r = fr + (nr - fr) * v; return [l + (r - l) * u, fy + (ny - fy) * v]; };
  ctx.fillStyle = '#1d1d23'; ctx.beginPath(); ctx.moveTo(...pt(-0.02, -0.05)); ctx.lineTo(...pt(1.02, -0.05)); ctx.lineTo(...pt(1.02, 1.06)); ctx.lineTo(...pt(-0.02, 1.06)); ctx.fill();
  const rows = 5, cols = 14;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = pt(c / cols + 0.006, r / rows + 0.03), b = pt((c + 1) / cols - 0.006, r / rows + 0.03), d = pt((c + 1) / cols - 0.006, (r + 1) / rows - 0.03), e = pt(c / cols + 0.006, (r + 1) / rows - 0.03);
    let light = 0.35;
    for (const wv of s.waves) { const dist = Math.hypot(c - wv.c, (r - wv.r) * 1.6); light += Math.max(0, 1 - Math.abs(dist - wv.age * 18) / 1.6) * wv.l; }
    const hue = (s.t * 30 + c * 14 + r * 8) % 360;
    ctx.fillStyle = `hsla(${hue}, 75%, ${30 + Math.min(1, light) * 35}%, 1)`;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...d); ctx.lineTo(...e); ctx.fill();
    ctx.fillStyle = 'rgba(20,20,26,.78)';
    const inset = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    const cx = (a[0] + d[0]) / 2, cy = (a[1] + d[1]) / 2;
    ctx.beginPath(); ctx.moveTo(...inset(a, [cx, cy], 0.18)); ctx.lineTo(...inset(b, [cx, cy], 0.18)); ctx.lineTo(...inset(d, [cx, cy], 0.18)); ctx.lineTo(...inset(e, [cx, cy], 0.18)); ctx.fill();
  }
  // mouse on its pad
  ctx.fillStyle = '#2b2733'; ctx.beginPath(); ctx.roundRect(462, 498, 110, 70, 10); ctx.fill();
  ctx.fillStyle = '#d7d4de'; ctx.beginPath(); ctx.ellipse(512, 530, 14, 20, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9b97a6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(511, 512); ctx.lineTo(511, 524); ctx.stroke();
}

function mug(ctx, s) {
  const x = 470, y = 452;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 44, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e9dcc8'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x + 26, y + 20, 11, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.fillStyle = '#efe4d2'; ctx.beginPath(); ctx.roundRect(x - 24, y, 48, 44, [4, 4, 12, 12]); ctx.fill();
  ctx.fillStyle = '#c86f5a'; ctx.fillRect(x - 24, y + 14, 48, 8);
  ctx.fillStyle = '#4a2c20'; ctx.beginPath(); ctx.ellipse(x, y + 2, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  const strong = 0.2 + s.steam * 0.5;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(255,255,255,${strong * (0.6 + 0.4 * Math.sin(s.t * 1.1 + k))})`; ctx.lineWidth = 3;
    ctx.beginPath();
    const sx = x - 10 + k * 10;
    ctx.moveTo(sx, y - 4);
    for (let i = 1; i <= 6; i++) ctx.lineTo(sx + Math.sin(s.t * 1.6 + i * 0.9 + k * 2) * (3 + i * 1.3), y - 4 - i * 11);
    ctx.stroke();
  }
}

function plantAndBooks(ctx, s) {
  // a pothos at the far right of the desk, trailing over the edge
  ctx.fillStyle = '#c47a58'; ctx.beginPath(); ctx.moveTo(566, DESK_Y + 6); ctx.lineTo(614, DESK_Y + 6); ctx.lineTo(608, DESK_Y - 34); ctx.lineTo(572, DESK_Y - 34); ctx.fill();
  const leaf = (x, y, a, sz) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#4f9a58'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sz, -sz * 0.8, 0, -sz * 1.8); ctx.quadraticCurveTo(-sz, -sz * 0.8, 0, 0); ctx.fill(); ctx.restore(); };
  for (let k = 0; k < 7; k++) leaf(590 + Math.sin(k * 2.1) * 12, DESK_Y - 36, -0.9 + k * 0.3 + Math.sin(s.t * 0.6 + k) * 0.05, 11);
  ctx.strokeStyle = '#3f7d47'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(606, DESK_Y - 30); ctx.quadraticCurveTo(632 + Math.sin(s.t * 0.5) * 3, DESK_Y + 30, 624, DESK_Y + 90); ctx.stroke();
  for (let k = 0; k < 5; k++) leaf(616 + k * 2 + Math.sin(s.t * 0.5 + k) * 2, DESK_Y + k * 22, 2.6 + Math.sin(k) * 0.4, 8);
  // books with a little clock on top
  for (const [c, y, w] of [['#6f8fa6', 0, 120], ['#c8796b', 14, 112], ['#d8b26e', 26, 118]]) { ctx.fillStyle = c; ctx.fillRect(34, 476 - y, w, 13); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(34 + w - 8, 478 - y, 6, 9); }
  ctx.fillStyle = '#26262c'; ctx.beginPath(); ctx.roundRect(56, 428, 68, 26, 6); ctx.fill();
  const d = new Date();
  ctx.fillStyle = '#ff9f80'; ctx.font = '600 15px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${String(d.getHours()).padStart(2, '0')}${s.t % 2 < 1 ? ':' : ' '}${String(d.getMinutes()).padStart(2, '0')}`, 90, 446);
  ctx.textAlign = 'left';
  // a notebook and pen near you
  ctx.save(); ctx.translate(120, 600); ctx.rotate(-0.12);
  ctx.fillStyle = '#e8dfcf'; ctx.fillRect(-90, -50, 180, 110);
  ctx.strokeStyle = 'rgba(80,110,160,.35)'; ctx.lineWidth = 1; for (let y = -34; y < 56; y += 12) { ctx.beginPath(); ctx.moveTo(-80, y); ctx.lineTo(80, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(40,40,60,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-70, -26); ctx.bezierCurveTo(-40, -32, -20, -18, 10, -26); ctx.moveTo(-70, -14); ctx.bezierCurveTo(-46, -20, -30, -6, -4, -14); ctx.stroke();
  ctx.fillStyle = '#2e4a6b'; ctx.save(); ctx.rotate(0.5); ctx.fillRect(10, -70, 8, 96); ctx.fillStyle = '#d4af37'; ctx.fillRect(10, -70, 8, 10); ctx.restore();
  ctx.restore();
}

function glows(ctx, s) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // the lamp's warm pool on the desk and wall
  if (s.lamp > 0.01) {
    const g = ctx.createRadialGradient(150, 420, 10, 150, 420, 300);
    g.addColorStop(0, `rgba(255,190,120,${0.32 * s.lamp})`); g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 150, 480, 490);
    for (const m of s.motes) { ctx.fillStyle = `rgba(255,230,190,${(0.25 + 0.25 * Math.sin(s.t + m.p)) * s.lamp})`; ctx.fillRect(m.x, m.y, 2, 2); }
  }
  // the screen's cool light
  const sg = ctx.createRadialGradient(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h, 10, SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h + 60, 260);
  sg.addColorStop(0, s.screen === 1 ? 'rgba(255,120,150,.12)' : s.screen === 2 ? 'rgba(80,180,230,.14)' : 'rgba(120,140,255,.12)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, SCREEN.y, SIZE, SIZE - SCREEN.y);
  // lava lamp and keyboard
  const lg = ctx.createRadialGradient(186, DESK_Y - 60, 4, 186, DESK_Y - 60, 110);
  lg.addColorStop(0, LAVA[s.lavaPal][0] + '44'); lg.addColorStop(1, LAVA[s.lavaPal][0] + '00');
  ctx.fillStyle = lg; ctx.fillRect(70, DESK_Y - 170, 240, 240);
  const kg = ctx.createRadialGradient(323, 512, 10, 323, 512, 140);
  kg.addColorStop(0, `hsla(${(s.t * 30) % 360},80%,60%,.12)`); kg.addColorStop(1, 'hsla(0,0%,0%,0)');
  ctx.fillStyle = kg; ctx.fillRect(180, 420, 290, 200);
  fairyLights(ctx, s.t, true);
  ctx.restore();
}

function render(ctx, s) {
  ctx.save();
  ctx.translate(Math.sin(s.t * 0.27) * 1.6, Math.sin(s.t * 0.21) * 1.2);   // a breath of POV, as if sitting there
  ctx.scale(1.012, 1.012);
  wall(ctx);
  outside(ctx, s);
  frame(ctx);
  curtains(ctx, s.t);
  fairyLights(ctx, s.t, false);
  wallThings(ctx);
  cat(ctx, s);
  desk(ctx, s);
  lampBody(ctx, s);
  lavaLamp(ctx, s);
  monitor(ctx, s);
  plantAndBooks(ctx, s);
  keyboard(ctx, s);
  mug(ctx, s);
  // night falls over everything the lamp isn't lighting
  ctx.fillStyle = `rgba(8,8,22,${0.32 - 0.2 * s.lamp})`; ctx.fillRect(-10, -10, SIZE + 20, SIZE + 20);
  glows(ctx, s);
  ctx.restore();
  const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
}

function newCodeLine(r) {
  const n = 1 + Math.floor(r() * 4), tokens = [];
  for (let i = 0; i < n; i++) tokens.push({ w: 8 + Math.floor(r() * 26), c: Math.floor(r() * TOK.length) });
  return { indent: Math.floor(r() * 3), tokens, typed: 0, total: tokens.reduce((a, b) => a + b.w, 0) };
}

export function preview(ctx) {
  const s = makeState();
  s.t = 4.2;
  const r = rng(5);
  for (let i = 0; i < 11; i++) { const l = newCodeLine(r); l.typed = l.total; s.code.push(l); }
  render(ctx, s);
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  const s = makeState();
  const r = rng(Date.now() % 100000);
  s.code.push(newCodeLine(r));
  const status = () => setScore(`${s.weather === 'rain' ? 'Rain on the window' : s.weather === 'snow' ? 'Snow falling' : 'A clear night'} · lamp ${s.lampOn ? 'on' : 'off'}`);
  setScore('Click the lamp, the screen, the window, the cat…');
  const hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene

  const amb = playAmbience({ rain: 1, crackle: 0.5 }, isPaused);
  const stopMusic = playMusic(LOFI, isPaused);

  const inRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  const onDown = (e) => {
    canvas.focus({ preventScroll: true });
    const p = pointIn(canvas, e);
    if (inRect(p, 40, 240, 120, 170)) { s.lampOn = !s.lampOn; note(s.lampOn ? 7 : 4, { dur: 0.5, vol: 0.05 }); }
    else if (inRect(p, 160, 250, 52, 150)) { s.lavaPal = (s.lavaPal + 1) % LAVA.length; note(9, { dur: 1, vol: 0.04 }); }
    else if (inRect(p, SCREEN.x - 8, SCREEN.y - 8, SCREEN.w + 16, SCREEN.h + 18)) { s.screen = (s.screen + 1) % 3; note(5, { dur: 0.4, vol: 0.04 }); }
    else if (inRect(p, WIN.x - 10, WIN.y + WIN.h - 40, 120, 70)) { s.purr = 3; for (let k = 0; k < 3; k++) s.zzz.push({ x: WIN.x + 20 + k * 6, y: WIN.y + WIN.h - 30, l: 1 + k * 0.3 }); note(0, { dur: 1.2, vol: 0.04 }); }
    else if (inRect(p, WIN.x, WIN.y, WIN.w, WIN.h)) {
      s.weather = s.weather === 'rain' ? 'snow' : s.weather === 'snow' ? 'clear' : 'rain';
      amb.set('rain', s.weather === 'rain' ? 1 : 0);
      note(s.weather === 'clear' ? 11 : 8, { dur: 1.2, vol: 0.04 });
      status();
    } else if (inRect(p, 220, 470, 210, 85)) {
      const u = (p.x - 226) / 194, v = (p.y - 476) / 72;
      s.waves.push({ c: u * 14, r: v * 5, age: 0, l: 1 });
      for (let k = 0; k < 3; k++) setTimeout(() => drip(0.025, 2600 + Math.random() * 600, 1800), k * 60);
    } else if (inRect(p, 440, 420, 80, 90)) { s.steam = 1; drip(0.04, 700, 300); }
    status();
  };
  canvas.addEventListener('pointerdown', onDown);

  function update(dt) {
    s.t += dt;
    s.lamp += ((s.lampOn ? 1 : 0) - s.lamp) * Math.min(1, dt * 5);
    s.steam = Math.max(0, s.steam - dt * 0.3);
    for (const d of s.drops) {
      if (d.hold > 0) { d.hold -= dt; continue; }
      d.v = Math.min(140, d.v + 60 * dt); d.y += d.v * dt;
      if (Math.random() < dt * 0.9) { d.hold = 0.4 + Math.random() * 1.6; d.v = 0; }
      if (d.y > WIN.y + WIN.h + 6) { d.y = WIN.y - 6; d.x = WIN.x + 8 + Math.random() * (WIN.w - 16); d.hold = Math.random() * 2; }
    }
    for (const st of s.streaks) { st.y += st.v * dt; st.x -= st.v * 0.3 * dt; if (st.y > WIN.y + WIN.h) { st.y = WIN.y - 20; st.x = WIN.x + Math.random() * (WIN.w + 80); } }
    for (const f of s.flakes) { f.y += f.v * dt; if (f.y > WIN.y + WIN.h) { f.y = WIN.y - 4; f.x = WIN.x + Math.random() * WIN.w; } }
    for (const m of s.motes) { m.x += m.vx * dt + Math.sin(s.t * 0.5 + m.p) * 0.1; m.y += m.vy * dt; if (m.y < 240) { m.y = 460; m.x = 60 + Math.random() * 260; } }
    for (const z of s.zzz) { z.y -= 16 * dt; z.x += 6 * dt; z.l -= dt * 0.35; }
    s.zzz = s.zzz.filter((z) => z.l > 0);
    if (s.purr > 0) { s.purr -= dt; if (Math.random() < dt * 1.2) s.zzz.push({ x: WIN.x + 26, y: WIN.y + WIN.h - 34, l: 1 }); }
    for (const w of s.waves) { w.age += dt; w.l -= dt * 0.8; }
    s.waves = s.waves.filter((w) => w.l > 0);
    if (s.weather === 'clear' && !s.shooting && Math.random() < dt * 0.04) s.shooting = { x: WIN.x + 60 + Math.random() * 200, y: WIN.y + 20 + Math.random() * 60, l: 1 };
    if (s.shooting) { s.shooting.x += 260 * dt; s.shooting.y += 90 * dt; s.shooting.l -= dt * 1.2; if (s.shooting.l <= 0) s.shooting = null; }
    // the screen types itself, slowly
    if (s.screen === 0) {
      const cur = s.code[s.code.length - 1];
      cur.typed += dt * (40 + Math.random() * 30);
      if (cur.typed >= cur.total + 12) { s.code.push(newCodeLine(r)); if (s.code.length > 12) s.code.shift(); }
    }
    render(ctx, s);
  }
  const stop = runLoop(update, isPaused);
  return () => { clearTimeout(hint); stop(); stopMusic(); amb.stop(); canvas.removeEventListener('pointerdown', onDown); };
}
