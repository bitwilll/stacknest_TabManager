// Forest Drive — an old car on an endless country road through a deep, green forest. The road
// winds and rolls (drawn segment by segment in perspective); pines, broadleaf trees, birches
// and ferns crowd both verges. A whole day passes as you drive (sunrise, day, sunset, a starry
// night with the headlights on) and the weather changes on its own: clear, cloudy, rain, snow.
// Space changes the weather (sunny, clear, cloudy, rain, a thunderstorm, snow), in a shuffled
// order so each comes round before any repeats; left alone it changes by itself.
// Some days it's an open-top car, some days a motorbike. The verge only slows you down; steer
// deep into the trees and the journey ends there, kindly, with a word about journeys.
// Pachelbel's Canon plays softly underneath.
// In full screen the canvas is wide (640 high, wider than 640): the road stays centred at the
// same size and the forest, verges, sky and weather simply carry on out to the screen's edges.

import { SIZE, setupCanvas, runLoop, card, clamp, playMusic, playAmbience, CANON, pointIn, swish, rumble } from './arcade-kit.js';

export const meta = { id: 'drive', wide: true, title: 'Forest Drive', blurb: 'Open-top car or motorbike, an endless road through deep forest: day, night and weather.', keys: '← → to steer, ↑ ↓ for pace, Space for weather' };

// when a drive ends in the trees: it was never about getting somewhere
const JOURNEY = [
  'The journey was the point, not the destination.',
  'It was never about where the road ends. It was the trees, the light, the way there.',
  'Life is a journey, not a destination. You just took the scenic part.',
  'To travel well is better than to arrive.',
  'You wandered off the map for a while. That counts as travelling too.',
  'Every road leads somewhere. This one led to a quiet moment, and that was enough.',
];
const CRASH_AT = 1.8;   // how far past the road's edge (in road half-widths) the trees take you

const H = SIZE, HORIZON = H / 2;   // the view is H high and W wide (W = SIZE in the square frame)
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
const STARS = Array.from({ length: 120 }, (_, i) => ({ x: hash(i, 1) * SIZE, y: hash(i, 2) * (HORIZON - 30), p: hash(i, 3) * 6, r: 0.6 + hash(i, 4) * 1.2 }));
// more sky either side of the square for a wide view, as densely starred (x relative to the square)
// (Array.from passes only (value, index) to its map function, so the count is named first)
const SIDE = 1400, SIDE_N = 2 * Math.round(120 * SIDE / SIZE), SIDE_STARS = Array.from({ length: SIDE_N }, (_, i) => ({
  x: i < SIDE_N / 2 ? -hash(i, 51) * SIDE : SIZE + hash(i, 51) * SIDE, y: hash(i, 52) * (HORIZON - 30), p: hash(i, 53) * 6, r: 0.6 + hash(i, 54) * 1.2,
}));
let starsW = SIZE, starsIn = STARS;
function starsFor(W) {   // the stars across a view W wide, rebuilt only when the width changes
  if (W === SIZE) return STARS;
  if (W !== starsW) {
    const ox = (W - SIZE) / 2;
    starsW = W;
    starsIn = [...STARS, ...SIDE_STARS].map((s) => ({ ...s, x: s.x + ox })).filter((s) => s.x > -3 && s.x < W + 3);
  }
  return starsIn;
}
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: hash(i, 11) * 1400, y: 40 + hash(i, 12) * 180, s: 0.7 + hash(i, 13) * 0.9 }));

function sky(ctx, env, sway, t, W) {
  const ox = (W - SIZE) / 2;   // where the square's left edge sits in a wide view (0 in the square)
  // the sun and moon cross the whole width, keeping the square's margins at either end
  const kx = (W - 180) / (SIZE - 180), across = (x) => (W === SIZE ? x : W / 2 + (x - SIZE / 2) * kx);
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, css(env.skyTop)); g.addColorStop(1, css(env.skyBot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 40);
  // stars come out as the light goes
  const starA = clamp((0.62 - env.light) / 0.3, 0, 1) * (1 - env.cloud);
  if (starA > 0.02) for (const s of starsFor(W)) { ctx.globalAlpha = starA * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the sun crosses from sunrise (0.22) to sunset (0.72); the moon has the night
  const sunA = (env.dayT - 0.22) / 0.5;
  if (sunA > -0.05 && sunA < 1.05) {
    const th = clamp(sunA, 0, 1) * Math.PI, sx = across(90 + sunA * 460) - sway * 0.08, sy = HORIZON + 10 - Math.sin(th) * 250;
    const low = 1 - Math.sin(th);
    const col = mixRgb([255, 248, 225], [255, 160, 90], low);
    const rgb = col.map(Math.round).join(',');
    const R = 150 + env.sun * 90;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, R);
    sg.addColorStop(0, `rgba(${rgb},${(0.55 + env.sun * 0.25) * (1 - env.cloud * 0.7)})`); sg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = sg; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
    if (env.sun > 0.05) {   // a sunny day: soft rays turning slowly round the sun
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.03); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        ctx.rotate(Math.PI / 5);
        ctx.fillStyle = `rgba(${rgb},${0.05 * env.sun * (k % 2 ? 0.6 : 1)})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -320); ctx.lineTo(14, -320); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = css(col); ctx.globalAlpha = 1 - env.cloud * 0.8;
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const moonA = ((env.dayT + 0.28) % 1) / 0.5;   // up from 0.72 through 0.22
  if (moonA > 0 && moonA < 1 && env.light < 0.8) {
    const th = moonA * Math.PI, mx = across(520 - moonA * 420) - sway * 0.06, my = HORIZON - Math.sin(th) * 230;
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
    const reach = Math.ceil((ox + 400) / 1500);
    for (const c of CLOUDS) {
      const x0 = ((c.x - sway * 0.15 - t * 6) % 1500 + 1500) % 1500 - 300;
      ctx.globalAlpha = env.cloud * 0.9;
      // the clouds come round every 1500px; a wide view sees the turns either side as well
      for (let k = -reach; k <= reach; k++) {
        const x = ox + x0 + k * 1500;
        if (k && (x + 300 < 0 || x - 100 > W)) continue;
        for (const [dx, dy, r] of [[0, 0, 40], [46, -14, 50], [96, 0, 42], [140, 6, 30]]) { ctx.beginPath(); ctx.ellipse(x + dx * c.s, c.y + dy * c.s, r * c.s * 1.3, r * c.s * 0.8, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  }
  // a fork of lightning against the clouds
  if (env.bolt && env.flash > 0.05) {
    ctx.save();
    if (ox) ctx.translate(ox, 0);   // the bolt is kept relative to the square
    ctx.strokeStyle = `rgba(245,247,255,${Math.min(1, env.flash * 1.2)})`; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(200,210,255,.9)'; ctx.shadowBlur = 14;
    ctx.beginPath(); env.bolt.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const mid = env.bolt[Math.floor(env.bolt.length / 2)];
    ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mid[0], mid[1]); ctx.lineTo(mid[0] + 34, mid[1] + 40); ctx.lineTo(mid[0] + 30, mid[1] + 66); ctx.stroke();
    ctx.restore();
  }
  // far hills, sliding with the road's bends
  for (const [base, amp, col, k] of [[HORIZON - 40, 50, [150, 186, 168], 0.15], [HORIZON - 14, 40, [118, 164, 132], 0.3]]) {
    const c = mixRgb(mixRgb(col, [236, 242, 246], env.snow * 0.6).map((v) => v * (0.25 + 0.75 * env.light)), env.fog, 0.3);
    ctx.fillStyle = css(c);
    // the same ridge line as in the square, carried on either side (x relative to the square)
    const x0 = -Math.ceil(ox / 8) * 8, x1 = W - ox + (W > SIZE ? 8 : 0);
    ctx.beginPath(); ctx.moveTo(0, HORIZON + 60);
    for (let x = x0; x <= x1; x += 8) { const wx = x + sway * k; ctx.lineTo(ox + x, base - Math.abs(Math.sin(wx * 0.006)) * amp - Math.sin(wx * 0.017) * amp * 0.3); }
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

// the beams ahead after dark: two from the car, one from the bike
function headlights(ctx, env, steer, cx, cy, kind) {
  const night = clamp((0.7 - env.light) / 0.35, 0, 1);
  if (night <= 0.02) return night;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const side of kind === 'bike' ? [0] : [-1, 1]) {
    const g = ctx.createLinearGradient(0, cy - 20, 0, HORIZON + 40);
    g.addColorStop(0, `rgba(255,240,200,${(kind === 'bike' ? 0.26 : 0.22) * night})`); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    const a = side * 40, b = kind === 'bike' ? 26 : 30;
    ctx.beginPath(); ctx.moveTo(cx + a - b, cy - 18); ctx.lineTo(cx + a + b - steer * 30, cy - 18);
    ctx.lineTo(cx + side * 110 + 70 - steer * 120, HORIZON + 50); ctx.lineTo(cx + side * 110 - 70 - steer * 120, HORIZON + 50); ctx.fill();
  }
  ctx.restore();
  return night;
}
function tailGlow(ctx, night, points) {
  if (night <= 0.02) return;
  for (const [x, y] of points) { const g = ctx.createRadialGradient(x, y, 2, x, y, 40); g.addColorStop(0, `rgba(255,80,60,${0.45 * night})`); g.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - 40, y - 40, 80, 80); }
}
// a scarf streaming back in the wind
function scarf(ctx, x, y, t, len, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - 4);
  for (let k = 1; k <= 6; k++) ctx.lineTo(x + k * len / 6, y - 4 + Math.sin(t * 9 - k * 0.9) * (1 + k * 0.9) + k * 0.6);
  for (let k = 6; k >= 0; k--) ctx.lineTo(x + k * len / 6, y + 3 + Math.sin(t * 9 - k * 0.9) * (1 + k * 0.9) + k * 0.9);
  ctx.closePath(); ctx.fill();
}

// an open-top car seen from behind: a folded soft top on the rear deck, two seats, the driver
// (hair and scarf in the wind), the windscreen's frame beyond
function car(ctx, env, steer, bump, t, crash, W) {
  const cx = W / 2, cy = H - 70 + bump;
  const night = headlights(ctx, env, steer, cx, cy, 'car');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(steer * 0.04 + crash * 0.05);
  const shade = (c) => css(rgbOf(c).map((v) => v * (0.35 + 0.65 * env.light)));
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 34, 96, 14, 0, 0, Math.PI * 2); ctx.fill();
  // the windscreen, far side of the open cabin
  ctx.fillStyle = `rgba(${env.skyBot.map((v) => Math.round(v)).join(',')},.28)`;
  ctx.strokeStyle = shade('#c9ced2'); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-60, -22); ctx.lineTo(-52, -54); ctx.quadraticCurveTo(0, -60, 52, -54); ctx.lineTo(60, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the driver: shoulders, head, hair lifting in the wind, a scarf
  ctx.fillStyle = shade('#3f6f8a'); ctx.beginPath(); ctx.roundRect(-52, -50, 44, 30, [14, 14, 4, 4]); ctx.fill();
  ctx.fillStyle = shade('#d9a27c'); ctx.beginPath(); ctx.roundRect(-35, -58, 10, 10, 3); ctx.fill();
  ctx.fillStyle = shade('#3a2a20'); ctx.beginPath(); ctx.arc(-30, -66, 13, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 4; k++) { const a = -2.2 + k * 0.35; ctx.beginPath(); ctx.ellipse(-30 + Math.cos(a) * 12 + 4, -66 + Math.sin(a) * 12, 6, 2.6, a + 0.5 + Math.sin(t * 11 + k) * 0.25, 0, Math.PI * 2); ctx.fill(); }
  scarf(ctx, -24, -52, t, 34, shade('#e8a15a'));
  // seats: two backs and headrests, the driver's head above the left one
  ctx.fillStyle = shade('#6b3f2d');
  ctx.beginPath(); ctx.roundRect(-52, -38, 40, 18, 8); ctx.roundRect(12, -38, 40, 18, 8); ctx.fill();
  ctx.fillStyle = shade('#5a3426');
  ctx.beginPath(); ctx.roundRect(-41, -52, 18, 15, 6); ctx.roundRect(23, -52, 18, 15, 6); ctx.fill();
  // the soft top, folded down on the rear deck
  ctx.fillStyle = shade('#2f3b3c'); ctx.beginPath(); ctx.roundRect(-64, -34, 128, 13, 7); ctx.fill();
  ctx.strokeStyle = shade('#435354'); ctx.lineWidth = 1.2;
  for (const x of [-40, -12, 16, 44]) { ctx.beginPath(); ctx.moveTo(x, -33); ctx.quadraticCurveTo(x + 3, -27, x, -22); ctx.stroke(); }
  if (env.snow > 0.3) { ctx.fillStyle = `rgba(245,248,252,${(env.snow - 0.3) * 1.2})`; ctx.beginPath(); ctx.roundRect(-62, -36, 124, 5, 3); ctx.fill(); }
  // the body
  ctx.fillStyle = '#1f2124';
  ctx.beginPath(); ctx.roundRect(-84, 6, 30, 30, 6); ctx.roundRect(54, 6, 30, 30, 6); ctx.fill();
  ctx.fillStyle = shade('#6fb3a6');
  ctx.beginPath(); ctx.roundRect(-90, -24, 180, 46, 18); ctx.fill();
  ctx.fillStyle = shade('#5c9f93');
  ctx.beginPath(); ctx.roundRect(-90, 4, 180, 18, [0, 0, 18, 18]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.roundRect(-80, -21, 160, 5, 3); ctx.fill();
  // tail lights glow brighter after dark
  ctx.fillStyle = night > 0.1 ? '#ff5a4a' : '#e8775a';
  ctx.beginPath(); ctx.roundRect(-82, -12, 26, 12, 5); ctx.roundRect(56, -12, 26, 12, 5); ctx.fill();
  tailGlow(ctx, night, [[-69, -6], [69, -6]]);
  ctx.fillStyle = shade('#e9e2d0'); ctx.beginPath(); ctx.roundRect(-92, 14, 184, 8, 4); ctx.fill();
  ctx.fillStyle = '#f6f1e4'; ctx.fillRect(-20, -8, 40, 14);
  ctx.fillStyle = '#5c6b66'; ctx.font = '600 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('ZEN', 0, 3);
  if (!crash) { ctx.fillStyle = `rgba(255,255,255,${0.22 + Math.sin(t * 6) * 0.07})`; ctx.beginPath(); ctx.arc(70, 26 + Math.sin(t * 4) * 2, 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// a motorbike seen from behind, leaning into the turns: rider in a jacket and helmet, mirrors
// on their stalks, one tail light, a scarf streaming
function bike(ctx, env, steer, bump, t, crash, W) {
  const cx = W / 2, cy = H - 70 + bump;
  const night = headlights(ctx, env, steer, cx, cy, 'bike');
  const shade = (c) => css(rgbOf(c).map((v) => v * (0.35 + 0.65 * env.light)));
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, cy + 34, 42, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy + 34);   // lean about the tyre's contact with the road
  ctx.rotate(steer * 0.2 + crash * 0.42);
  // handlebars and mirrors beyond the rider
  ctx.strokeStyle = shade('#2a2c30'); ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-52, -96); ctx.quadraticCurveTo(0, -102, 52, -96); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-44, -97); ctx.lineTo(-56, -122); ctx.moveTo(44, -97); ctx.lineTo(56, -122); ctx.stroke();
  ctx.fillStyle = shade('#3a3d42'); ctx.beginPath(); ctx.ellipse(-58, -126, 9, 6, -0.2, 0, Math.PI * 2); ctx.ellipse(58, -126, 9, 6, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade('#26282c'); ctx.beginPath(); ctx.roundRect(-58, -101, 13, 9, 4); ctx.roundRect(45, -101, 13, 9, 4); ctx.fill();
  // the rear tyre and mudguard
  ctx.fillStyle = '#1c1d20'; ctx.beginPath(); ctx.roundRect(-11, -44, 22, 44, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-3, -40, 3, 36);
  ctx.fillStyle = shade('#4f8f86'); ctx.beginPath(); ctx.roundRect(-15, -58, 30, 20, [10, 10, 4, 4]); ctx.fill();
  // exhaust
  ctx.fillStyle = shade('#b9bec4'); ctx.beginPath(); ctx.roundRect(16, -46, 11, 30, 5); ctx.fill();
  ctx.fillStyle = shade('#6c7076'); ctx.beginPath(); ctx.ellipse(21.5, -16, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  // tail light and plate
  ctx.fillStyle = night > 0.1 ? '#ff5a4a' : '#e8775a'; ctx.beginPath(); ctx.roundRect(-12, -66, 24, 8, 4); ctx.fill();
  tailGlow(ctx, night, [[0, -62]]);
  ctx.fillStyle = '#f6f1e4'; ctx.fillRect(-13, -56, 26, 11);
  ctx.fillStyle = '#5c6b66'; ctx.font = '600 8px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('ZEN', 0, -47.5);
  // the rider: legs either side of the tank, boots on the pegs, jacket, helmet
  ctx.fillStyle = shade('#3c4a66');
  ctx.beginPath(); ctx.roundRect(-34, -78, 16, 40, 7); ctx.roundRect(18, -78, 16, 40, 7); ctx.fill();
  ctx.fillStyle = shade('#2a2522'); ctx.beginPath(); ctx.roundRect(-36, -42, 18, 12, 4); ctx.roundRect(18, -42, 18, 12, 4); ctx.fill();
  ctx.fillStyle = shade('#26282c'); ctx.beginPath(); ctx.roundRect(-22, -76, 44, 12, 6); ctx.fill();   // the seat
  ctx.fillStyle = shade('#8a5a3a');
  ctx.beginPath(); ctx.moveTo(-26, -70); ctx.lineTo(-32, -112); ctx.quadraticCurveTo(0, -124, 32, -112); ctx.lineTo(26, -70); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade('#8a5a3a'); ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-28, -108); ctx.lineTo(-48, -97); ctx.moveTo(28, -108); ctx.lineTo(48, -97); ctx.stroke();
  ctx.strokeStyle = shade('#6e472e'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, -74); ctx.stroke();
  scarf(ctx, 6, -122, t, 30, shade('#e8a15a'));
  ctx.fillStyle = shade('#ece6d6'); ctx.beginPath(); ctx.arc(0, -136, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade('#4f8f86'); ctx.fillRect(-3.5, -152, 7, 32);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-6, -142, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// into the trees: ferns and leaves close in around the vehicle, a few leaves shaken loose
function woods(ctx, st, W) {
  const { crash, leaves, env } = st;
  if (!crash) return;
  const k = Math.min(1, crash * 1.6), dark = 0.35 + 0.65 * env.light;
  const P = (c, a = 1) => `rgba(${rgbOf(c).map((v) => Math.round(v * dark)).join(',')},${a})`;
  // nine clumps across the square; a wide view has more of them on out to its edges
  const ox = (W - SIZE) / 2, gap = SIZE / 9;
  const i0 = W > SIZE ? Math.floor(-ox / gap) - 1 : 0, i1 = W > SIZE ? Math.ceil((W - ox) / gap) : 8;
  for (let i = i0; i <= i1; i++) {
    const x = ox + (i + 0.5) * gap + Math.sin(i * 7.1) * 24, h = (70 + hash(i, 41) * 90) * k;
    ctx.fillStyle = P(i % 2 ? '#2f6a3a' : '#3c7d44', 0.95);
    for (let f = -3; f <= 3; f++) {
      const a = -Math.PI / 2 + f * 0.32 + Math.sin(st.t * 1.6 + i) * 0.04;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * h * 0.45, H + 6 + Math.sin(a) * h * 0.45, h * 0.5, 9, a, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const l of leaves) {
    ctx.save(); ctx.translate(ox + l.x, l.y); ctx.rotate(l.rot);
    ctx.fillStyle = P(l.col, Math.min(1, l.life)); ctx.beginPath(); ctx.ellipse(0, 0, l.r, l.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function render(ctx, st) {
  const { pos, playerX, steer, t, speed, env } = st;
  // a wide view keeps the square's scale (H / 2 per unit) with the road centred: it just sees more
  const W = st.W || SIZE, ox = (W - SIZE) / 2;
  const P = palette(env);
  const base = Math.floor(pos / SEG), pct = (pos % SEG) / SEG;
  const camY = CAM_H + hillAt(base) + (hillAt(base + 1) - hillAt(base)) * pct;
  let sway = 0;
  for (let i = 0; i < 40; i++) sway += curveAt(base + i);
  sky(ctx, env, sway * 60 + pos * 0.002, t, W);

  let x = 0, dx = -curveAt(base) * pct, maxy = H;
  const proj = [], strips = [];
  for (let n = 1; n <= DRAW; n++) {
    const i = base + n;
    const z1 = (n - pct) * SEG, z2 = z1 + SEG;
    const s1 = DEPTH / Math.max(z1, 30), s2 = DEPTH / z2;
    const x1 = x, x2 = x + dx;
    x += dx; dx += curveAt(i);
    const p1 = { sx: W / 2 + s1 * (x1 - playerX * ROAD) * H / 2, sy: HORIZON - s1 * (hillAt(i) - camY) * H / 2, w: s1 * ROAD * H / 2 };
    const p2 = { sx: W / 2 + s2 * (x2 - playerX * ROAD) * H / 2, sy: HORIZON - s2 * (hillAt(i + 1) - camY) * H / 2, w: s2 * ROAD * H / 2 };
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
        const sx = p1.sx + s1 * off * ROAD * H / 2;
        const kind = hash(i, j + 17 + side);
        const hgt = Math.min(H * 1.05, s1 * (kind < 0.55 ? 2600 + hash(i, j + 3) * 1400 : 2000 + hash(i, j + 5) * 1000) * H / 2);
        if (sx < -hgt || sx > W + hgt || hgt < 2) continue;
        if (j === 0 && hash(i, 31 + side) < 0.45) fern(ctx, P, p1.sx + s1 * side * 1.12 * ROAD * H / 2, p1.sy, s1 * 420 * H / 2, band);
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
    const len = 18 + env.storm * 10, lean = 4 + env.storm * 8;   // a storm drives the rain harder and slanting
    for (const d of st.drops) { if (d.k > env.rain) continue; const x = ox + d.x; ctx.moveTo(x, d.y); ctx.lineTo(x - lean - steer * 6, d.y + len); }
    ctx.stroke();
  }
  if (env.snowfall > 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const f of st.flakes) { if (f.k > env.snowfall) continue; ctx.beginPath(); ctx.arc(ox + f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
  }
  const bump = Math.sin(t * 18) * Math.min(1.5, speed / 2400) + (Math.abs(playerX) > 1 ? Math.sin(t * 40) * 1.5 * Math.min(1, speed / 900) : 0);
  (st.vehicle === 'bike' ? bike : car)(ctx, env, steer, bump, t, st.crash ? Math.sign(playerX) * Math.min(1, st.crash * 2) : 0, W);
  woods(ctx, st, W);
  if (env.flash > 0.01) { ctx.fillStyle = `rgba(232,238,255,${env.flash * 0.32})`; ctx.fillRect(0, 0, W, H); }   // the lightning lights everything
}

/* ——— the environment: the hour and the weather, blended smoothly ——— */
const WEATHERS = ['sunny', 'clear', 'cloudy', 'rain', 'thunder', 'clear', 'snow', 'cloudy'];   // the drift, left alone
const KINDS = ['sunny', 'clear', 'cloudy', 'rain', 'thunder', 'snow'];                           // what Space shuffles through
const WX_LABEL = { sunny: 'sunny', clear: 'clear', cloudy: 'cloudy', rain: 'rain', thunder: 'thunderstorm', snow: 'snow' };
const WX_BANNER = { sunny: 'Sunny', clear: 'Clear skies', cloudy: 'Cloudy', rain: 'Rain', thunder: 'Thunderstorm', snow: 'Snow' };
// how each weather sets the sky: cloud cover, rain, snowfall, storm, sunshine
const WX_GOAL = {
  sunny: { cloud: 0, rain: 0, snowfall: 0, storm: 0, sun: 1 },
  clear: { cloud: 0.08, rain: 0, snowfall: 0, storm: 0, sun: 0 },
  cloudy: { cloud: 0.75, rain: 0, snowfall: 0, storm: 0, sun: 0 },
  rain: { cloud: 0.9, rain: 1, snowfall: 0, storm: 0, sun: 0 },
  thunder: { cloud: 1, rain: 1, snowfall: 0, storm: 1, sun: 0 },
  snow: { cloud: 0.85, rain: 0, snowfall: 1, storm: 0, sun: 0 },
};
export function envFor(dayT, wx) {
  const sky = skyAt(dayT);
  const storm = wx.storm || 0, sun = wx.sun || 0;
  const cloud = wx.cloud, light = Math.min(1, sky.light * (1 - cloud * 0.28) * (1 - storm * 0.3) * (1 + sun * 0.06));
  const grey = mixRgb(sky.bot, [150, 156, 166].map((v) => v * (0.3 + 0.7 * sky.light) * (1 - storm * 0.35)), cloud * 0.6);
  const day = clamp((sky.light - 0.5) / 0.4, 0, 1);
  return {
    dayT, light, tint: sky.tint, cloud, rain: wx.rain, snowfall: wx.snowfall, snow: wx.snowCover, wet: wx.wet, storm, sun,
    skyTop: mixRgb(mixRgb(sky.top, [62, 140, 226], sun * day * 0.3), grey, cloud * 0.55), skyBot: grey, fog: grey,
    fogMax: 0.22 + cloud * 0.18 + wx.rain * 0.08 - sun * 0.06,   // a touch of distance, never a haze
    flash: wx.flash || 0, bolt: wx.bolt || null,
  };
}
const HOUR_NAME = (d) => (d < 0.2 ? 'night' : d < 0.3 ? 'sunrise' : d < 0.66 ? 'day' : d < 0.76 ? 'sunset' : 'night');

// a still of any hour and weather (the shelf's thumbnail uses a sunset)
// (W: the view's width, the square by default; rain, snow and a bolt are relative to the square)
export function still(ctx, dayT, w = {}, W = SIZE) {
  const wx = { cloud: 0, rain: 0, snowfall: 0, snowCover: 0, wet: 0, storm: 0, sun: 0, ...w };
  const lo = -(W - SIZE) / 2;
  const drops = Array.from({ length: Math.round(160 * W / SIZE) }, (_, i) => ({ x: lo + hash(i, 21) * W, y: hash(i, 22) * H, k: hash(i, 23) }));
  const flakes = Array.from({ length: Math.round(140 * W / SIZE) }, (_, i) => ({ x: lo + hash(i, 31) * W, y: hash(i, 32) * H, r: 1 + hash(i, 33) * 2.4, k: hash(i, 34) }));
  render(ctx, { pos: 5200, playerX: 0, steer: 0, t: 1, speed: 2000, env: envFor(dayT, wx), drops, flakes, W });
}
export function preview(ctx) { still(ctx, 0.67); }

export function start(canvas, { setScore, isPaused, finish }) {
  const ctx = setupCanvas(canvas, { wide: true });
  // the view's width: SIZE in the square frame, wider in full screen; it can change on any frame
  const viewW = () => canvas._snW || SIZE;
  // pointerDX: a drag's distance right of the screen's centre (null when not dragging)
  let t = 0, pos = 0, playerX = 0, speed = 0, steer = 0, left = false, right = false, up = false, down = false, started = false, pointerDX = null;
  // the day's ride, chosen at random (about one drive in three is on two wheels)
  const pick = () => (Math.random() < 0.35 ? 'bike' : 'car');
  let vehicle = pick(), crash = 0, carded = false, leaves = [], journeyAt = Math.floor(Math.random() * JOURNEY.length);
  let dayT = 0.27, wIdx = 0, wNext = 50 + Math.random() * 30, want = 'sunny', quick = 0, banner = null;
  let bag = [], strikeIn = 3, thunderAt = Infinity, flicker = Infinity;
  const wx = { cloud: 0, rain: 0, snowfall: 0, snowCover: 0, wet: 0, storm: 0, sun: 0, flash: 0, bolt: null };
  // Space: the next weather from a shuffled bag (never the one already here), turning quickly
  const nextWeather = () => {
    if (!bag.length) bag = KINDS.filter((k) => k !== want).sort(() => Math.random() - 0.5);
    want = bag.pop();
    quick = 4; wNext = 70 + Math.random() * 40;
    banner = { text: WX_BANNER[want], l: 2.2 };
    if (want === 'thunder') strikeIn = 1.2;
    swish(0.04);
  };
  // rain and snow, x relative to the square's left edge; a wider view gets more of them
  const drop = (x) => ({ x, y: Math.random() * H, v: 900 + Math.random() * 500, k: Math.random() });
  const flake = (x) => ({ x, y: Math.random() * H, v: 50 + Math.random() * 70, r: 1 + Math.random() * 2.4, p: Math.random() * 6, k: Math.random() });
  let drops = Array.from({ length: 160 }, () => drop(Math.random() * SIZE));
  let flakes = Array.from({ length: 140 }, () => flake(Math.random() * SIZE));
  let fitW = SIZE;
  // the width changed: keep what is still in view where it is, and fill any new sky at the same density
  const refit = (list, from, to, extra, per, make) => {
    const lo0 = -(from - SIZE) / 2, hi0 = lo0 + from + extra, lo1 = -(to - SIZE) / 2, hi1 = lo1 + to + extra;
    const out = list.filter((p) => p.x >= lo1 - 120 && p.x <= hi1 + 20);
    const add = (a, b) => { for (let n = Math.round((b - a) * per); n > 0; n--) out.push(make(a + Math.random() * (b - a))); };
    if (lo1 < lo0) add(lo1, Math.min(lo0, hi1));
    if (hi1 > hi0) add(Math.max(hi0, lo1), hi1);
    return out;
  };
  const CRUISE = 2600, MAX = 4200, MIN = 1400;
  let target = CRUISE;
  const onKey = (e) => {
    const on = e.type === 'keydown';
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); if (on && !e.repeat) nextWeather(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'a') { left = on; e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { right = on; e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { up = on; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { down = on; e.preventDefault(); }
    else return;
    started = true;
  };
  const onPointer = (e) => { if (e.type === 'pointerdown') canvas.focus({ preventScroll: true }); if (e.buttons || e.pointerType !== 'mouse') { pointerDX = pointIn(canvas, e).x - viewW() / 2; started = true; } };
  const onUp = () => { pointerDX = null; };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKey);
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function update(dt) {
    const W = viewW(), ox = (W - SIZE) / 2, lo = -ox;
    if (W !== fitW) {
      drops = refit(drops, fitW, W, 80, 160 / (SIZE + 80), drop);
      flakes = refit(flakes, fitW, W, 0, 140 / SIZE, flake);
      fitW = W;
    }
    t += dt;
    dayT = (dayT + dt / DAY) % 1;
    // the weather drifts from one state to the next over several seconds
    wNext -= dt;
    if (wNext <= 0) { wIdx = (wIdx + 1 + Math.floor(Math.random() * 2)) % WEATHERS.length; want = WEATHERS[wIdx]; wNext = 45 + Math.random() * 45; }
    quick = Math.max(0, quick - dt);
    const fast = quick > 0 ? 3.5 : 1;   // a change asked for with Space arrives in a few seconds
    const ease = (v, goal, rate) => v + (goal - v) * Math.min(1, dt * rate * fast);
    const goal = WX_GOAL[want];
    wx.cloud = ease(wx.cloud, goal.cloud, 0.25);
    wx.rain = ease(wx.rain, goal.rain, 0.3);
    wx.snowfall = ease(wx.snowfall, goal.snowfall, 0.3);
    wx.storm = ease(wx.storm, goal.storm, 0.3);
    wx.sun = ease(wx.sun, goal.sun, 0.3);
    wx.snowCover = clamp(wx.snowCover + (want === 'snow' ? dt / 25 : -dt / 40) * fast, 0, 1);
    wx.wet = clamp(wx.wet + (goal.rain ? dt / 8 : -dt / 30) * fast, 0, 1);
    // lightning in a storm: a flash (and a flicker), a forked bolt, thunder a moment later
    if (wx.storm > 0.6) {
      strikeIn -= dt;
      if (strikeIn <= 0) {
        wx.flash = 1; flicker = t + 0.13; strikeIn = 4 + Math.random() * 8;
        const pts = [[60 - ox + Math.random() * (W - 120), 10]];   // anywhere across the sky
        while (pts[pts.length - 1][1] < HORIZON - 30) { const [x, y] = pts[pts.length - 1]; pts.push([x + (Math.random() - 0.5) * 50, y + 14 + Math.random() * 22]); }
        wx.bolt = pts;
        thunderAt = t + 0.35 + Math.random() * 1.3;
      }
    }
    if (t >= flicker) { wx.flash = Math.max(wx.flash, 0.75); flicker = Infinity; }
    wx.flash = Math.max(0, wx.flash - dt * 3.2);
    if (wx.flash <= 0) wx.bolt = null;
    if (t >= thunderAt) { rumble(0.16 + Math.random() * 0.08); thunderAt = Infinity; }
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) amb.set('rain', wx.rain * (0.8 + wx.storm * 0.4));
    if (banner) { banner.l -= dt; if (banner.l <= 0) banner = null; }
    const env = envFor(dayT, wx);

    if (up) target = Math.min(MAX, target + 1400 * dt);
    if (down) target = Math.max(MIN, target - 1400 * dt);
    const offroad = Math.abs(playerX) > 1.05;
    if (crash) {
      // in among the trees: a soft stop, a few leaves shaken loose, then the card
      crash += dt;
      speed *= Math.exp(-dt * 5);
      pos += speed * dt;
      steer += (0 - steer) * Math.min(1, dt * 4);
      for (const l of leaves) { l.vy += 260 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= 1 - dt * 0.8; l.rot += l.spin * dt; l.life -= dt * 0.45; }
      leaves = leaves.filter((l) => l.life > 0 && l.y < H + 20);
      if (crash > 1.5 && !carded) {
        carded = true;
        journeyAt = (journeyAt + 1) % JOURNEY.length;
        const km = (pos / 20000).toFixed(1);
        if (finish) finish({
          title: vehicle === 'bike' ? 'the bike rests in the ferns' : 'the car rests in the ferns',
          message: JOURNEY[journeyAt],
          stats: `${km} km through the forest · ${HOUR_NAME(dayT)} · ${WX_LABEL[want]}`,
          againLabel: 'Back on the road',
          again: newJourney,
        });
        else newJourney();
      }
    } else {
      const goal = started ? (offroad ? Math.min(target, 1300) : target) : 900;
      speed += (goal - speed) * Math.min(1, dt * 0.8);
      pos += speed * dt;
      const pct = speed / MAX;
      let wantSteer = (right ? 1 : 0) - (left ? 1 : 0);
      if (pointerDX != null) wantSteer = clamp(pointerDX / 140, -1, 1);
      steer += (wantSteer - steer) * Math.min(1, dt * 6);
      playerX += steer * dt * 0.95 * (0.4 + pct);
      // hands off the wheel, the car mostly follows the bend and drifts back to its lane: only
      // steering on into the trees takes you there
      const hands = left || right || pointerDX != null;
      playerX -= curveAt(Math.floor(pos / SEG)) * pct * dt * 0.3 * (hands ? 1 : 0.2);
      if (!hands) playerX += (0 - playerX) * Math.min(1, dt * 0.6);
      if (!started) playerX += (0 - playerX) * dt;
      playerX = clamp(playerX, -2.2, 2.2);
      if (started && Math.abs(playerX) > CRASH_AT) {
        crash = 0.001;
        leaves = Array.from({ length: 26 }, (_, i) => ({
          x: SIZE / 2 + (Math.random() - 0.5) * 220, y: H - 120 - Math.random() * 90,
          vx: (Math.random() - 0.5) * 220 - Math.sign(playerX) * 60, vy: -120 - Math.random() * 160,
          r: 4 + Math.random() * 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 8, life: 1 + Math.random() * 0.8,
          col: ['#4f8a3e', '#6f9a3a', '#b58a3a', '#3c7d44'][i % 4],
        }));
        swish(0.06);
        setScore(`${(pos / 20000).toFixed(1)} km · into the trees`);
      }
    }
    for (const d of drops) { d.y += d.v * dt; d.x -= (60 + steer * 120) * dt; if (d.y > H) { d.y = -20; d.x = lo + Math.random() * (W + 80); } }
    for (const f of flakes) { f.y += f.v * dt; f.x += (Math.sin(t + f.p) * 18 - steer * 60) * dt; if (f.y > H) { f.y = -6; f.x = lo + Math.random() * W; } if (f.x < lo - 10) f.x += W + 20; if (f.x > lo + W + 10) f.x -= W + 20; }

    render(ctx, { pos, playerX, steer, t, speed, env, drops, flakes, vehicle, crash, leaves, W });
    // the cards stay in the middle of the screen
    const shift = ox && (!started || banner);
    if (shift) { ctx.save(); ctx.translate(ox, 0); }
    if (!started) card(ctx, [{ text: 'Forest Drive', size: 34, weight: 700 }, { text: vehicle === 'bike' ? 'Today, by motorbike' : 'Today, top down', size: 15, weight: 600 }, { text: '← → to steer, ↑ ↓ for pace — or drag', size: 17, weight: 500 }, { text: 'Space changes the weather', size: 14, weight: 500, alpha: 0.85 }], { y: 160, shadow: 'rgba(20,50,30,.5)' });
    if (banner && started) card(ctx, [{ text: banner.text, size: 26, weight: 700, alpha: Math.min(1, banner.l / 0.6) }], { y: 96, shadow: 'rgba(20,40,60,.55)' });
    if (shift) ctx.restore();
    if (!crash && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) setScore(`${(pos / 20000).toFixed(1)} km · ${HOUR_NAME(dayT)} · ${WX_LABEL[want]}${offroad ? ' · on the verge' : ''}`);
  }
  // back on the road for a new journey: the hour and the weather carry on, the ride may change
  function newJourney() {
    pos = 0; playerX = 0; speed = 0; steer = 0; target = CRUISE;
    crash = 0; carded = false; leaves = []; started = true;
    vehicle = pick();
    setScore('0.0 km');
  }
  setScore('0.0 km');
  const amb = playAmbience({ rain: 0 }, isPaused);   // the rain's own sound, kept low under the music
  const stop = runLoop(update, isPaused);
  const stopMusic = playMusic(CANON, isPaused);
  return () => {
    stop(); stopMusic(); amb.stop();
    for (const [ev, fn] of [['keydown', onKey], ['keyup', onKey], ['pointerdown', onPointer], ['pointermove', onPointer], ['pointerup', onUp], ['pointercancel', onUp]]) canvas.removeEventListener(ev, fn);
  };
}
