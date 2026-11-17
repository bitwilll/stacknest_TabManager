// Forest Drive — an old car on an endless country road through a deep, green forest. The road
// winds and rolls (drawn segment by segment in perspective); pines, broadleaf trees, birches
// and ferns crowd both verges. A whole day passes as you drive (sunrise, day, sunset, a starry
// night with the headlights on) and the weather changes on its own: clear, cloudy, rain, snow.
// There is nowhere to crash: steer to keep to the road (the verge only slows you down).
// Pachelbel's Canon plays softly underneath.

import { SIZE, setupCanvas, runLoop, card, clamp, playMusic, CANON, pointIn } from './arcade-kit.js';

export const meta = { id: 'drive', title: 'Forest Drive', blurb: 'An endless road through deep forest: day, night and weather.', keys: '← → to steer, ↑ ↓ for pace' };

const W = SIZE, H = SIZE, HORIZON = H / 2;
const SEG = 200, ROAD = 2000, CAM_H = 900, DEPTH = 0.84, DRAW = 140, LANES = 2;
const DAY = 300;   // seconds for a whole day

// deterministic per-segment noise: the same forest every time you pass that way
const hash = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const curveAt = (i) => Math.sin(i * 0.011) * 2.4 + Math.sin(i * 0.031 + 1.3) * 1.3;
const hillAt = (i) => Math.sin(i * 0.013) * 520 + Math.sin(i * 0.041 + 2) * 170;

/* ——— colour ——— */
const rgbOf = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (a) => `rgb(${a.map((v) => Math.round(clamp(v, 0, 255))).join(',')})`;

// the sky through a day: [time 0–1, sky top, horizon, light, tint of the light]
const KEYS = [
  [0.00, '#0a0f24', '#1c2746', 0.32, '#3a4a8a'],
  [0.19, '#141c3e', '#3a3b66', 0.38, '#5a5a9a'],
  [0.25, '#3f4f8a', '#f3b087', 0.72, '#ffb07a'],
  [0.32, '#86c0e6', '#d9eef3', 1.00, '#ffffff'],
  [0.60, '#74b4e2', '#d4ebf0', 1.00, '#ffffff'],
  [0.69, '#5b67a6', '#f6a46b', 0.78, '#ff9a5a'],
  [0.76, '#262c58', '#5b4a78', 0.48, '#6a5aa0'],
  [0.84, '#0a0f24', '#1c2746', 0.32, '#3a4a8a'],
  [1.00, '#0a0f24', '#1c2746', 0.32, '#3a4a8a'],
].map(([t, top, bot, light, tint]) => ({ t, top: rgbOf(top), bot: rgbOf(bot), light, tint: rgbOf(tint) }));

function skyAt(dayT) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= dayT) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = (dayT - a.t) / (b.t - a.t || 1), e = u * u * (3 - 2 * u);
  return { top: mixRgb(a.top, b.top, e), bot: mixRgb(a.bot, b.bot, e), light: a.light + (b.light - a.light) * e, tint: mixRgb(a.tint, b.tint, e) };
}

const BASE = {
  grassA: '#5c9a48', grassB: '#53913f', road: '#6e6c68', road2: '#696762', rumbleA: '#ede6d3', rumbleB: '#c8bfa8', lane: '#f1ebdc',
  pine: '#2f6b47', pine2: '#3d7d54', leaf: '#4f9a4a', leaf2: '#64ad55', trunk: '#6b4a32', fern: '#5aa457', birch: '#e9e4d8',
};
const BASE_RGB = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, rgbOf(v)]));
const BANDS = 8;
const SNOWY = new Set(['grassA', 'grassB', 'pine', 'pine2', 'leaf', 'leaf2', 'fern', 'rumbleA', 'rumbleB']);

// every frame: the whole palette, lit for the hour, dusted with snow, faded a little with distance
function palette(env) {
  const out = {};
  for (const [k, rgb] of Object.entries(BASE_RGB)) {
    let c = rgb;
    if (env.snow > 0 && SNOWY.has(k)) c = mixRgb(c, [236, 242, 246], env.snow * (k.startsWith('grass') ? 0.75 : 0.4));
    if (env.wet > 0 && (k === 'road' || k === 'road2')) c = mixRgb(c, [70, 76, 86], env.wet * 0.5);
    const lit = c.map((v, i) => v * (0.22 + 0.78 * env.light) * (0.85 + 0.15 * env.tint[i] / 255));
    out[k] = Array.from({ length: BANDS }, (_, b) => css(mixRgb(lit, env.fog, Math.pow(b / (BANDS - 1), 1.8) * env.fogMax)));
  }
  return out;
}

/* ——— drawing ——— */
const STARS = Array.from({ length: 120 }, (_, i) => ({ x: hash(i, 1) * W, y: hash(i, 2) * (HORIZON - 30), p: hash(i, 3) * 6, r: 0.6 + hash(i, 4) * 1.2 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: hash(i, 11) * 1400, y: 40 + hash(i, 12) * 180, s: 0.7 + hash(i, 13) * 0.9 }));

function sky(ctx, env, sway, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, css(env.skyTop)); g.addColorStop(1, css(env.skyBot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 40);
  // stars come out as the light goes
  const starA = clamp((0.62 - env.light) / 0.3, 0, 1) * (1 - env.cloud);
  if (starA > 0.02) for (const s of STARS) { ctx.globalAlpha = starA * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the sun crosses from sunrise (0.22) to sunset (0.72); the moon has the night
  const sunA = (env.dayT - 0.22) / 0.5;
  if (sunA > -0.05 && sunA < 1.05) {
    const th = clamp(sunA, 0, 1) * Math.PI, sx = 90 + sunA * 460 - sway * 0.08, sy = HORIZON + 10 - Math.sin(th) * 250;
    const low = 1 - Math.sin(th);
    const col = mixRgb([255, 248, 225], [255, 160, 90], low);
    const rgb = col.map(Math.round).join(',');
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
    sg.addColorStop(0, `rgba(${rgb},${0.55 * (1 - env.cloud * 0.7)})`); sg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = sg; ctx.fillRect(sx - 150, sy - 150, 300, 300);
    ctx.fillStyle = css(col); ctx.globalAlpha = 1 - env.cloud * 0.8;
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const moonA = ((env.dayT + 0.28) % 1) / 0.5;   // up from 0.72 through 0.22
  if (moonA > 0 && moonA < 1 && env.light < 0.8) {
    const th = moonA * Math.PI, mx = 520 - moonA * 420 - sway * 0.06, my = HORIZON - Math.sin(th) * 230;
    ctx.globalAlpha = (1 - env.cloud * 0.8) * clamp((0.8 - env.light) / 0.3, 0, 1);
    ctx.fillStyle = 'rgba(235,240,255,.15)'; ctx.beginPath(); ctx.arc(mx, my, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef1fb'; ctx.beginPath(); ctx.arc(mx, my, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(env.skyTop); ctx.beginPath(); ctx.arc(mx + 7, my - 4, 15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // clouds when the weather turns
  if (env.cloud > 0.02) {
    const cc = mixRgb([200, 206, 214], env.skyBot, 0.35).map((v) => v * (0.45 + 0.55 * env.light));
    ctx.fillStyle = css(cc);
    for (const c of CLOUDS) {
      const x = ((c.x - sway * 0.15 - t * 6) % 1500 + 1500) % 1500 - 300;
      ctx.globalAlpha = env.cloud * 0.9;
      for (const [dx, dy, r] of [[0, 0, 40], [46, -14, 50], [96, 0, 42], [140, 6, 30]]) { ctx.beginPath(); ctx.ellipse(x + dx * c.s, c.y + dy * c.s, r * c.s * 1.3, r * c.s * 0.8, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  // far hills, sliding with the road's bends
  for (const [base, amp, col, k] of [[HORIZON - 40, 50, [150, 186, 168], 0.15], [HORIZON - 14, 40, [118, 164, 132], 0.3]]) {
    const c = mixRgb(mixRgb(col, [236, 242, 246], env.snow * 0.6).map((v) => v * (0.25 + 0.75 * env.light)), env.fog, 0.3);
    ctx.fillStyle = css(c);
    ctx.beginPath(); ctx.moveTo(0, HORIZON + 60);
    for (let x = 0; x <= W; x += 8) { const wx = x + sway * k; ctx.lineTo(x, base - Math.abs(Math.sin(wx * 0.006)) * amp - Math.sin(wx * 0.017) * amp * 0.3); }
    ctx.lineTo(W, HORIZON + 60); ctx.fill();
  }
}

function pine(ctx, P, x, y, h, band, alt) {
  const w = h * 0.36;
  ctx.fillStyle = P.trunk[band]; ctx.fillRect(x - h * 0.03, y - h * 0.16, h * 0.06, h * 0.16);
  ctx.fillStyle = alt ? P.pine2[band] : P.pine[band];
  ctx.beginPath();
  for (let k = 0; k < 4; k++) { const top = y - h + k * h * 0.2, ww = w * (0.45 + k * 0.2); ctx.moveTo(x, top); ctx.lineTo(x - ww, top + h * 0.34); ctx.lineTo(x + ww, top + h * 0.34); }
  ctx.fill();
}
function broadleaf(ctx, P, x, y, h, band, birch) {
  ctx.fillStyle = birch ? P.birch[band] : P.trunk[band];
  ctx.fillRect(x - h * 0.035, y - h * 0.5, h * 0.07, h * 0.5);
  ctx.fillStyle = P.leaf[band];
  ctx.beginPath(); ctx.arc(x, y - h * 0.68, h * 0.3, 0, Math.PI * 2); ctx.arc(x - h * 0.2, y - h * 0.55, h * 0.22, 0, Math.PI * 2); ctx.arc(x + h * 0.21, y - h * 0.57, h * 0.21, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.leaf2[band];
  ctx.beginPath(); ctx.arc(x - h * 0.08, y - h * 0.78, h * 0.15, 0, Math.PI * 2); ctx.fill();
}
function fern(ctx, P, x, y, h, band) {
  ctx.fillStyle = P.fern[band];
  ctx.beginPath(); ctx.ellipse(x, y - h * 0.3, h * 0.7, h * 0.32, 0, Math.PI, 0); ctx.fill();
}

function car(ctx, env, steer, bump, t) {
  const cx = W / 2, cy = H - 70 + bump;
  const night = clamp((0.7 - env.light) / 0.35, 0, 1);
  // headlights on the road ahead
  if (night > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(0, cy - 20, 0, HORIZON + 40);
      g.addColorStop(0, `rgba(255,240,200,${0.22 * night})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx + side * 40, cy - 18); ctx.lineTo(cx + side * 70 - steer * 30, cy - 18);
      ctx.lineTo(cx + side * 150 - steer * 120, HORIZON + 50); ctx.lineTo(cx + side * 10 - steer * 120, HORIZON + 50); ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(steer * 0.04);
  const shade = (c) => css(rgbOf(c).map((v) => v * (0.35 + 0.65 * env.light)));
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 34, 96, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f2124';
  ctx.beginPath(); ctx.roundRect(-84, 6, 30, 30, 6); ctx.roundRect(54, 6, 30, 30, 6); ctx.fill();
  ctx.fillStyle = shade('#6fb3a6');
  ctx.beginPath(); ctx.roundRect(-90, -24, 180, 46, 18); ctx.fill();
  ctx.fillStyle = shade('#5c9f93');
  ctx.beginPath(); ctx.roundRect(-90, 4, 180, 18, [0, 0, 18, 18]); ctx.fill();
  ctx.fillStyle = shade('#6fb3a6');
  ctx.beginPath(); ctx.moveTo(-58, -24); ctx.quadraticCurveTo(-52, -66, 0, -68); ctx.quadraticCurveTo(52, -66, 58, -24); ctx.fill();
  if (env.snow > 0.3) { ctx.fillStyle = `rgba(245,248,252,${(env.snow - 0.3) * 1.2})`; ctx.beginPath(); ctx.moveTo(-50, -40); ctx.quadraticCurveTo(0, -78, 50, -40); ctx.quadraticCurveTo(0, -60, -50, -40); ctx.fill(); }
  ctx.fillStyle = shade('#cfe6ea');
  ctx.beginPath(); ctx.moveTo(-46, -26); ctx.quadraticCurveTo(-42, -58, 0, -59); ctx.quadraticCurveTo(42, -58, 46, -26); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(-14, -54); ctx.lineTo(-4, -54); ctx.lineTo(-20, -30); ctx.fill();
  // tail lights glow brighter after dark
  ctx.fillStyle = night > 0.1 ? '#ff5a4a' : '#e8775a';
  ctx.beginPath(); ctx.roundRect(-82, -12, 26, 12, 5); ctx.roundRect(56, -12, 26, 12, 5); ctx.fill();
  if (night > 0.02) {
    for (const side of [-69, 69]) { const g = ctx.createRadialGradient(side, -6, 2, side, -6, 40); g.addColorStop(0, `rgba(255,80,60,${0.45 * night})`); g.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = g; ctx.fillRect(side - 40, -46, 80, 80); }
  }
  ctx.fillStyle = shade('#e9e2d0'); ctx.beginPath(); ctx.roundRect(-92, 14, 184, 8, 4); ctx.fill();
  ctx.fillStyle = '#f6f1e4'; ctx.fillRect(-20, -8, 40, 14);
  ctx.fillStyle = '#5c6b66'; ctx.font = '600 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('ZEN', 0, 3);
  ctx.fillStyle = `rgba(255,255,255,${0.22 + Math.sin(t * 6) * 0.07})`;
  ctx.beginPath(); ctx.arc(70, 26 + Math.sin(t * 4) * 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function render(ctx, st) {
  const { pos, playerX, steer, t, speed, env } = st;
  const P = palette(env);
  const base = Math.floor(pos / SEG), pct = (pos % SEG) / SEG;
  const camY = CAM_H + hillAt(base) + (hillAt(base + 1) - hillAt(base)) * pct;
  let sway = 0;
  for (let i = 0; i < 40; i++) sway += curveAt(base + i);
  sky(ctx, env, sway * 60 + pos * 0.002, t);

  let x = 0, dx = -curveAt(base) * pct, maxy = H;
  const proj = [], strips = [];
  for (let n = 1; n <= DRAW; n++) {
    const i = base + n;
    const z1 = (n - pct) * SEG, z2 = z1 + SEG;
    const s1 = DEPTH / Math.max(z1, 30), s2 = DEPTH / z2;
    const x1 = x, x2 = x + dx;
    x += dx; dx += curveAt(i);
    const p1 = { sx: W / 2 + s1 * (x1 - playerX * ROAD) * W / 2, sy: HORIZON - s1 * (hillAt(i) - camY) * H / 2, w: s1 * ROAD * W / 2 };
    const p2 = { sx: W / 2 + s2 * (x2 - playerX * ROAD) * W / 2, sy: HORIZON - s2 * (hillAt(i + 1) - camY) * H / 2, w: s2 * ROAD * W / 2 };
    const band = Math.min(BANDS - 1, Math.floor((n / DRAW) ** 0.8 * BANDS));
    proj.push({ i, n, p1, s1, band, clip: maxy });
    if (p2.sy >= maxy || p2.sy >= p1.sy) continue;   // hidden behind a rise
    strips.push({ i, p1, p2, band, bottom: Math.min(p1.sy, maxy) });
    maxy = p2.sy;
  }
  // all the verges first, then the road on top, so no seam of grass shows between segments
  for (const { i, p2, band, bottom } of strips) {
    const alt = Math.floor(i / 3) % 2;
    ctx.fillStyle = alt ? P.grassA[band] : P.grassB[band];
    ctx.fillRect(0, Math.floor(p2.sy), W, Math.ceil(bottom) - Math.floor(p2.sy) + 1);
  }
  for (const { i, p1, p2, band } of strips) {
    const alt = Math.floor(i / 3) % 2;
    const quad = (w1, w2, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(p1.sx - w1, p1.sy + 0.6); ctx.lineTo(p1.sx + w1, p1.sy + 0.6); ctx.lineTo(p2.sx + w2, p2.sy - 0.6); ctx.lineTo(p2.sx - w2, p2.sy - 0.6); ctx.closePath(); ctx.fill();
    };
    quad(p1.w * 1.12, p2.w * 1.12, alt ? P.rumbleA[band] : P.rumbleB[band]);
    quad(p1.w, p2.w, alt ? P.road[band] : P.road2[band]);
    if (alt) {
      for (let l = 1; l < LANES; l++) {
        const lx1 = p1.sx - p1.w + (p1.w * 2 * l) / LANES, lx2 = p2.sx - p2.w + (p2.w * 2 * l) / LANES;
        const lw1 = p1.w * 0.025, lw2 = p2.w * 0.025;
        ctx.fillStyle = P.lane[band];
        ctx.beginPath(); ctx.moveTo(lx1 - lw1, p1.sy); ctx.lineTo(lx1 + lw1, p1.sy); ctx.lineTo(lx2 + lw2, p2.sy); ctx.lineTo(lx2 - lw2, p2.sy); ctx.fill();
      }
    }
  }

  // the forest, far to near; each segment's trees are cut off where a nearer rise hides them
  for (let k = proj.length - 1; k >= 3; k--) {
    const { i, n, p1, s1, band, clip } = proj[k];
    if (p1.sy > clip + 2) continue;
    const per = n > 90 ? 2 : 3 + Math.floor(hash(i, 9) * 3);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, clip); ctx.clip();
    for (const side of [-1, 1]) {
      for (let j = per - 1; j >= 0; j--) {
        const off = side * (1.25 + j * 0.85 + hash(i, j * 2 + (side > 0 ? 1 : 0)) * 0.7);
        const sx = p1.sx + s1 * off * ROAD * W / 2;
        const kind = hash(i, j + 17 + side);
        const hgt = Math.min(H * 1.05, s1 * (kind < 0.55 ? 2600 + hash(i, j + 3) * 1400 : 2000 + hash(i, j + 5) * 1000) * H / 2);
        if (sx < -hgt || sx > W + hgt || hgt < 2) continue;
        if (j === 0 && hash(i, 31 + side) < 0.45) fern(ctx, P, p1.sx + s1 * side * 1.12 * ROAD * W / 2, p1.sy, s1 * 420 * H / 2, band);
        if (kind < 0.55) pine(ctx, P, sx, p1.sy, hgt, band, kind < 0.25);
        else broadleaf(ctx, P, sx, p1.sy, hgt, band, kind > 0.92);
      }
    }
    ctx.restore();
  }

  // weather in front of everything: rain as clean streaks, snow as soft flakes
  if (env.rain > 0.02) {
    ctx.strokeStyle = `rgba(210,222,240,${0.35 * env.rain})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of st.drops) { if (d.k > env.rain) continue; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4 - steer * 6, d.y + 18); }
    ctx.stroke();
  }
  if (env.snowfall > 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const f of st.flakes) { if (f.k > env.snowfall) continue; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
  }
  car(ctx, env, steer, Math.sin(t * 18) * Math.min(1.5, speed / 2400) + (Math.abs(playerX) > 1 ? Math.sin(t * 40) * 1.5 : 0), t);
}

/* ——— the environment: the hour and the weather, blended smoothly ——— */
const WEATHERS = ['clear', 'clear', 'cloudy', 'rain', 'clear', 'snow', 'cloudy'];
export function envFor(dayT, wx) {
  const sky = skyAt(dayT);
  const cloud = wx.cloud, light = sky.light * (1 - cloud * 0.28);
  const grey = mixRgb(sky.bot, [150, 156, 166].map((v) => v * (0.3 + 0.7 * sky.light)), cloud * 0.6);
  return {
    dayT, light, tint: sky.tint, cloud, rain: wx.rain, snowfall: wx.snowfall, snow: wx.snowCover, wet: wx.wet,
    skyTop: mixRgb(sky.top, grey, cloud * 0.55), skyBot: grey, fog: grey,
    fogMax: 0.22 + cloud * 0.18 + wx.rain * 0.08,   // a touch of distance, never a haze
  };
}
const WX_NAME = (w) => (w.rain > 0.5 ? 'rain' : w.snowfall > 0.5 ? 'snow' : w.cloud > 0.5 ? 'cloudy' : 'clear');
const HOUR_NAME = (d) => (d < 0.2 ? 'night' : d < 0.3 ? 'sunrise' : d < 0.66 ? 'day' : d < 0.76 ? 'sunset' : 'night');

// a still of any hour and weather (the shelf's thumbnail uses a sunset)
export function still(ctx, dayT, w = {}) {
  const wx = { cloud: 0, rain: 0, snowfall: 0, snowCover: 0, wet: 0, ...w };
  const drops = Array.from({ length: 160 }, (_, i) => ({ x: hash(i, 21) * W, y: hash(i, 22) * H, k: hash(i, 23) }));
  const flakes = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, 31) * W, y: hash(i, 32) * H, r: 1 + hash(i, 33) * 2.4, k: hash(i, 34) }));
  render(ctx, { pos: 5200, playerX: 0, steer: 0, t: 1, speed: 2000, env: envFor(dayT, wx), drops, flakes });
}
export function preview(ctx) { still(ctx, 0.67); }

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  let t = 0, pos = 0, playerX = 0, speed = 0, steer = 0, left = false, right = false, up = false, down = false, started = false, pointerX = null;
  let dayT = 0.27, wIdx = 0, wNext = 50 + Math.random() * 30;
  const wx = { cloud: 0, rain: 0, snowfall: 0, snowCover: 0, wet: 0 };
  const drops = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 900 + Math.random() * 500, k: Math.random() }));
  const flakes = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 50 + Math.random() * 70, r: 1 + Math.random() * 2.4, p: Math.random() * 6, k: Math.random() }));
  const CRUISE = 2600, MAX = 4200, MIN = 1400;
  let target = CRUISE;
  const onKey = (e) => {
    const on = e.type === 'keydown';
    if (e.key === 'ArrowLeft' || e.key === 'a') { left = on; e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { right = on; e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { up = on; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { down = on; e.preventDefault(); }
    else return;
    started = true;
  };
  const onPointer = (e) => { if (e.type === 'pointerdown') canvas.focus({ preventScroll: true }); if (e.buttons || e.pointerType !== 'mouse') { pointerX = pointIn(canvas, e).x; started = true; } };
  const onUp = () => { pointerX = null; };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKey);
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function update(dt) {
    t += dt;
    dayT = (dayT + dt / DAY) % 1;
    // the weather drifts from one state to the next over several seconds
    wNext -= dt;
    if (wNext <= 0) { wIdx = (wIdx + 1 + Math.floor(Math.random() * 2)) % WEATHERS.length; wNext = 45 + Math.random() * 45; }
    const want = WEATHERS[wIdx];
    const ease = (v, goal, rate) => v + (goal - v) * Math.min(1, dt * rate);
    wx.cloud = ease(wx.cloud, want === 'clear' ? 0 : want === 'cloudy' ? 0.75 : 0.9, 0.25);
    wx.rain = ease(wx.rain, want === 'rain' ? 1 : 0, 0.3);
    wx.snowfall = ease(wx.snowfall, want === 'snow' ? 1 : 0, 0.3);
    wx.snowCover = clamp(wx.snowCover + (want === 'snow' ? dt / 25 : -dt / 40), 0, 1);
    wx.wet = clamp(wx.wet + (want === 'rain' ? dt / 8 : -dt / 30), 0, 1);
    const env = envFor(dayT, wx);

    if (up) target = Math.min(MAX, target + 1400 * dt);
    if (down) target = Math.max(MIN, target - 1400 * dt);
    const offroad = Math.abs(playerX) > 1.05;
    const goal = started ? (offroad ? Math.min(target, 1300) : target) : 900;
    speed += (goal - speed) * Math.min(1, dt * 0.8);
    pos += speed * dt;
    const pct = speed / MAX;
    let wantSteer = (right ? 1 : 0) - (left ? 1 : 0);
    if (pointerX != null) wantSteer = clamp((pointerX - W / 2) / 140, -1, 1);
    steer += (wantSteer - steer) * Math.min(1, dt * 6);
    playerX += steer * dt * 0.95 * (0.4 + pct);
    playerX -= curveAt(Math.floor(pos / SEG)) * pct * dt * 0.3;
    if (!started) playerX += (0 - playerX) * dt;
    playerX = clamp(playerX, -2.2, 2.2);
    for (const d of drops) { d.y += d.v * dt; d.x -= (60 + steer * 120) * dt; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 80); } }
    for (const f of flakes) { f.y += f.v * dt; f.x += (Math.sin(t + f.p) * 18 - steer * 60) * dt; if (f.y > H) { f.y = -6; f.x = Math.random() * W; } if (f.x < -10) f.x += W + 20; if (f.x > W + 10) f.x -= W + 20; }

    render(ctx, { pos, playerX, steer, t, speed, env, drops, flakes });
    if (!started) card(ctx, [{ text: 'Forest Drive', size: 34, weight: 700 }, { text: '← → to steer, ↑ ↓ for pace — or drag', size: 17, weight: 500 }], { y: 150, shadow: 'rgba(20,50,30,.5)' });
    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) setScore(`${(pos / 20000).toFixed(1)} km · ${HOUR_NAME(dayT)} · ${WX_NAME(wx)}${offroad ? ' · on the verge' : ''}`);
  }
  setScore('0.0 km');
  const stop = runLoop(update, isPaused);
  const stopMusic = playMusic(CANON, isPaused);
  return () => {
    stop(); stopMusic();
    for (const [ev, fn] of [['keydown', onKey], ['keyup', onKey], ['pointerdown', onPointer], ['pointermove', onPointer], ['pointerup', onUp], ['pointercancel', onUp]]) canvas.removeEventListener(ev, fn);
  };
}
