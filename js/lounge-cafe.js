// Pixel Café — a lounge, not a game: the corner table of a small café on a rainy evening.
// Through the big window, a night street in layers: a far skyline in haze, buildings with lit
// windows, fire escapes and vertical neon, power lines, street lamps whose light catches the
// rain, a bus stop, a traffic light, cones, steam from a manhole, people under umbrellas and the
// odd car whose lights smear across the wet road. Inside: a barista at the espresso machine (and
// a kitchen doorway behind her), a chalkboard menu, shelves of jars, a radio, a reader and a cat
// on the window seat, a guest nodding along in headphones. On your table: a latte, an open book,
// a candle and a croissant. In full screen the café carries on — the door with its bell and the
// odd customer, a coat rack, side windows onto the same street, more tables and guests each busy
// with something, bookshelves, a cork board, a radiator, a pastry case and a clock, and an
// armchair, a sleeping dog and a big plant close by.
// Everything is painted into a 320-px-tall pixel buffer (the still layers cached, only the
// moving bits redrawn each frame), blown up by a whole number with smoothing off and then fitted
// to the canvas, so every pixel stays crisp and the same size.

import { setupCanvas, runLoop, pointIn, tone, note, drip, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'cafe', title: 'Pixel Café', blurb: 'A corner table on a rainy evening, in pixels.', keys: 'Click the cup, the window, the sign, the cat, the radio…', lounge: true };

const H = 320;      // the pixel buffer is 320 px tall: one buffer pixel is 2×2 in the 640 space
const CORE = 320;   // the square composition, in buffer pixels; wider screens add café either side

/* ——— small tools ——— */

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// the first number rng() would give for that seed, without making a generator (it's called a lot)
const hash = (x, y = 0) => {
  const a = ((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const RGB = new Map();
function rgb(c) { let v = RGB.get(c); if (!v) { v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); RGB.set(c, v); } return v; }

const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '.': '000000000000010', '-': '000000111000000', ':': '000010000010000', '*': '000101010101000',
};

// A tiny pixel painter over ImageData: integer rects, dithered fills and gradients, dithered
// light falloff, ellipses, outlines. Used for every still layer and sprite.
function painter(w, h) {
  const img = new ImageData(w, h), d = img.data;
  const set = (x, y, k, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (a >= 1) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255; return; }
    if (d[i + 3] === 0) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = a * 255; return; }
    d[i] += (k[0] - d[i]) * a; d[i + 1] += (k[1] - d[i + 1]) * a; d[i + 2] += (k[2] - d[i + 2]) * a;
    if (d[i + 3] < a * 255) d[i + 3] = a * 255;
  };
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const P = {
    w, h, d, solid,
    p(x, y, c, a = 1) { set(Math.round(x), Math.round(y), rgb(c), a); },
    r(x, y, ww, hh, c, a = 1) {
      x = Math.round(x); y = Math.round(y); const k = rgb(c);
      const x1 = Math.min(w, x + ww), y1 = Math.min(h, y + hh);
      for (let yy = Math.max(0, y); yy < y1; yy++) for (let xx = Math.max(0, x); xx < x1; xx++) set(xx, yy, k, a);
    },
    // ordered-dither fill: covers a fraction t of the pixels
    dz(x, y, ww, hh, c, t, a = 1) {
      x = Math.round(x); y = Math.round(y); const k = rgb(c);
      for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) if (bay(xx, yy) < t) set(xx, yy, k, a);
    },
    // the same, but only over pixels already painted (shading a sprite)
    tint(x, y, ww, hh, c, t = 1, a = 1) {
      x = Math.round(x); y = Math.round(y); const k = rgb(c);
      for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) if (solid(xx, yy) && bay(xx, yy) < t) set(xx, yy, k, a);
    },
    // vertical gradient through a list of colours, dithered between steps
    v(x, y, ww, hh, cols) {
      const n = cols.length - 1, ks = cols.map(rgb);
      for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) {
        const f = ((yy - y) / Math.max(1, hh - 1)) * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
        for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) set(xx, yy, bay(xx, yy) < fr ? ks[i + 1] : ks[i], 1);
      }
    },
    ell(cx, cy, rx, ry, c, a = 1) {
      const k = rgb(c);
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
        const dy = (yy + 0.5 - cy) / ry;
        if (dy < -1 || dy > 1) continue;
        const half = rx * Math.sqrt(1 - dy * dy);
        for (let xx = Math.round(cx - half); xx < Math.round(cx + half); xx++) set(xx, yy, k, a);
      }
    },
    thick(x0, y0, x1, y1, rad, c) {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
      for (let i = 0; i <= n; i++) { const t = i / n; P.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rad, rad, c); }
    },
    // light falling off from a centre, in dithered bands
    glow(cx, cy, rx, ry, c, amt, steps = 4) {
      const k = rgb(c);
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry, q = 1 - Math.sqrt(dx * dx + dy * dy);
        if (q <= 0) continue;
        const lv = Math.min(steps, Math.floor(q * q * steps + bay(xx, yy)));
        if (lv > 0) set(xx, yy, k, (lv / steps) * amt);
      }
    },
    line(x0, y0, x1, y1, c, a = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const k = rgb(c), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) { set(x0, y0, k, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    },
    clear(x, y, ww, hh) {
      for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) { const i = (yy * w + xx) * 4; d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; }
    },
    text(str, x, y, c, a = 1) {
      const k = rgb(c);
      let cx = Math.round(x);
      for (const ch of str) {
        const g = FONT[ch];
        if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') set(cx + (i % 3), Math.round(y) + Math.floor(i / 3), k, a);
        cx += 4;
      }
    },
    // atmospheric haze over whatever is painted, thickening downwards
    haze(y0, y1, c, a0, a1) {
      const k = rgb(c);
      for (let yy = Math.max(0, y0); yy < Math.min(h, y1); yy++) {
        const a = a0 + (a1 - a0) * ((yy - y0) / (y1 - y0));
        for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 0) { const q = Math.floor(a * 8 + bay(xx, yy)) / 8; if (q > 0) set(xx, yy, k, Math.min(1, q)); }
      }
    },
    outline(c) {
      const k = rgb(c), on = [];
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (!solid(xx, yy) && (solid(xx - 1, yy) || solid(xx + 1, yy) || solid(xx, yy - 1) || solid(xx, yy + 1))) on.push(xx, yy);
      for (let i = 0; i < on.length; i += 2) set(on[i], on[i + 1], k, 1);
    },
    stamp(src, x, y, flip = false) {
      for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
        const i = (yy * src.w + xx) * 4, a = src.d[i + 3];
        if (a) set(x + (flip ? src.w - 1 - xx : xx), y + yy, [src.d[i], src.d[i + 1], src.d[i + 2]], a / 255);
      }
    },
    canvas() { const cv = mk(w, h); cv.getContext('2d').putImageData(img, 0, 0); return cv; },
    flipped() { const q = painter(w, h); q.stamp(P, 0, 0, true); return q; },
  };
  return P;
}

// per-frame drawing on the buffer's own 2d context
function fr(f, x, y, w, h, c, a = 1) { f.globalAlpha = a; f.fillStyle = c; f.fillRect(Math.round(x), Math.round(y), w, h); }

/* ——— palettes ——— */

const C = {
  beam: '#2a1810', beamHi: '#3d2416',
  wood0: '#22130c', wood1: '#3c2416', wood2: '#56351f', wood3: '#74492a', wood4: '#96643a',
  teal0: '#13232a', teal1: '#1b3236', teal2: '#264541', teal3: '#356059',
  cream: '#efe4cf', creamS: '#c9b89c',
  leaf0: '#183324', leaf1: '#24502f', leaf2: '#357040', leaf3: '#5a9a52',
  terra: '#a4553a', terraS: '#743724',
  steel0: '#2e333b', steel1: '#5e6670', steel2: '#8f99a3', steel3: '#c4ccd4', steel4: '#eef2f5',
  brass: '#c99a4a', brassS: '#8a6a30',
};
const NEON = [
  { core: '#fff0f7', tube: '#ff5fa8', glow: '#ff3d8f' },
  { core: '#effeff', tube: '#47e3f0', glow: '#1fc2d6' },
  { core: '#fff6e0', tube: '#ffb04a', glow: '#ff8a26' },
  { core: '#f5ecff', tube: '#b884ff', glow: '#8d55ff' },
];
const WX = {
  rain: { sky: ['#080b1d', '#0b0f27', '#101534', '#151a3f', '#1c1f4a', '#262654', '#332c5e', '#423468'], far: '#1a1f47', farLit: '#3a4684', haze: '#3a3468', veil: 0.2, cloud: ['#16193c', '#1e2046', '#2a2955', '#3a3264'], clouds: 1 },
  snow: { sky: ['#11162f', '#161d3c', '#1e2648', '#283054', '#333a60', '#41456c', '#514f78'], far: '#272d58', farLit: '#56609a', haze: '#4f4e7c', veil: 0.26, cloud: ['#262b52', '#2f345e', '#3c3f6a', '#4c4a76'], clouds: 1 },
  clear: { sky: ['#03061a', '#060a22', '#0a102d', '#0f1738', '#162044', '#1e2650', '#2a2c5a', '#3b3365'], far: '#141a40', farLit: '#33407a', haze: '#2a2a5a', veil: 0.1, cloud: ['#121842', '#171d48', '#1f2552', '#2a2c5c'], clouds: 0.25 },
};
const BLD = [
  ['#151a35', '#262e58', '#0d1024'], ['#1d1733', '#332852', '#120d22'], ['#132234', '#22394f', '#0b1520'],
  ['#221b38', '#3a2d58', '#150f24'], ['#181d2f', '#2b3350', '#0e111e'], ['#2a1a2e', '#47293f', '#1a0f1c'],
];
const WARM = ['#ffca7a', '#f5a95e', '#ffe0a3', '#ffb86b'];
const SHOP = [['#ffe1a8', '#f3a95c'], ['#d4f6ff', '#79cde3'], ['#ffd0e6', '#f084b4'], ['#fff0c4', '#e8b860'], ['#e8ffd8', '#9cd88a']];
const AWN = [['#7a2632', '#c9b8a0'], ['#1f4f52', '#b8c8b8'], ['#6a4a1a', '#d8c08a'], ['#3a2a5a', '#b8a8d0']];
const WORDS = ['HOTEL', 'BAR', 'RAMEN', 'JAZZ', 'INN', 'SUSHI', 'KARAOKE', 'NOODLE', 'DINER', 'PHO', 'BOOKS', 'GAMES', 'TACOS'];
const SHOPWORDS = ['DELI', 'BOOKS', 'FLOWERS', 'BAKERY', 'RECORDS', 'NOODLES', 'LAUNDRY', 'TEA', '24H', 'VINYL', 'BAR', 'MARKET'];
const BRICK = ['#4a2620', '#55302a', '#3f221d', '#5e3328', '#4d2a22'];
const SPECIALS = ['HONEY LATTE', 'CHAI', 'MATCHA', 'COCOA', 'MOCHA', 'CORTADO'];
const BOOKCOL = ['#8a3a3a', '#3a5a7a', '#c8963a', '#4a6a4a', '#6a4a7a', '#d8cbb0', '#2f4f5f', '#a0603a', '#5a2a3a'];


/* ——— the core window and your table, in core-local coordinates ——— */
const PANES = [[12, 28, 57, 20], [71, 28, 57, 20], [130, 28, 58, 20], [12, 52, 87, 118], [101, 52, 87, 118]];
const LAMPS = [58, 148];
const SIGN = { x: 26, y: 50 };          // the neon sign's sprite position
const CUP = { x: 92, y: 270 };          // where the latte sits (the sprite's top-left)
const PLATE = { x: 40, y: 290 };        // the croissant's plate (its centre)
const BOOK = { x: 122, y: 258 };        // the open book (its top-left)
const CANDLE = 246, VASE = 277;
const DOORWAY = { x: 200, w: 16 };      // the kitchen doorway behind the counter, hung with a curtain
const TILL = 210, MACHINE = 254, KITCHEN = 208;
const VP = { x: 100, y: 96 };           // the floor's vanishing point, about the middle of the window

// '#rrggbb' between two colours, as '#rrggbb' (the painter wants hex)
function mixHex(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// soft light as a cached sprite: dithered bands falling off from the centre, drawn with an alpha
const GLOWS = new Map();
function glowSpr(rx, ry, c, amt, steps = 5) {
  const key = `${rx}|${ry}|${c}|${amt}|${steps}`;
  let g = GLOWS.get(key);
  if (!g) { const p = painter(rx * 2 + 2, ry * 2 + 2); p.glow(rx + 1, ry + 1, rx, ry, c, amt, steps); g = p.canvas(); GLOWS.set(key, g); }
  return g;
}
function glowAt(f, x, y, rx, ry, c, amt, a = 1, steps) {
  if (a <= 0.01) return;
  f.globalAlpha = Math.min(1, a); f.drawImage(glowSpr(rx, ry, c, amt, steps), Math.round(x - rx - 1), Math.round(y - ry - 1)); f.globalAlpha = 1;
}

// a neon tube along a polyline: a 3-px coloured tube, then (separately) its 1-px white-hot core
function tubeStroke(p, pts, c) {
  for (let i = 0; i < pts.length - 1; i++) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) p.line(pts[i][0] + dx, pts[i][1] + dy, pts[i + 1][0] + dx, pts[i + 1][1] + dy, c);
}
function coreStroke(p, pts, c) { for (let i = 0; i < pts.length - 1; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c); }

// the open book lies a little askew, its pages bowing up towards the spine
const bookY = (u) => -Math.round(u * 0.035) - Math.round(3 * Math.max(0, 1 - Math.abs(u - 47.5) / 48) ** 1.8);

/* ——— the street: sky, clouds and the city across the road ——— */

function spans(from, to, seed, minW, maxW, gap, cb) {
  const at = (i) => rng(Math.imul(seed, 7919) + Math.imul(i, 104729) + 17);
  for (let i = 0, x = 0; x < to; i++) { const r = at(i), w = minW + Math.floor(r() * (maxW - minW + 1)); cb(x, w, r, i); x += w + gap; }
  for (let i = -1, x = 0; x > from; i--) { const r = at(i), w = minW + Math.floor(r() * (maxW - minW + 1)); x -= w + gap; cb(x, w, r, i); }
}

function buildSky(BW, ox, wx) {
  const P = WX[wx], p = painter(BW, 170);
  p.v(0, 0, BW, 170, P.sky);
  const r = rng(31);
  const stars = [];
  if (wx === 'clear') {
    for (let i = 0; i < BW * 0.35; i++) { const x = Math.floor(r() * BW), y = Math.floor(r() * 120); p.p(x, y, '#c8d0ff', 0.25 + r() * 0.5); if (r() < 0.25) stars.push({ x, y, ph: r() * 6, sp: 0.6 + r() * 1.4 }); }
    const mx = ox + 116, my = 38;
    p.glow(mx, my, 30, 26, '#c9d4ff', 0.28);
    p.ell(mx, my, 6, 6, '#f6eed6'); p.ell(mx + 2, my - 1, 5, 5.5, P.sky[1], 0.25);
    p.p(mx - 3, my - 2, '#ddd2b4'); p.p(mx - 1, my + 2, '#ddd2b4'); p.r(mx - 4, my + 1, 2, 1, '#ddd2b4');
  } else if (wx === 'snow') {
    p.glow(ox + 116, 34, 40, 30, '#b8bce8', 0.18);
  }
  return { cv: p.canvas(), stars };
}

function buildClouds(BW, wx) {
  const P = WX[wx], CW = BW + 160, p = painter(CW, 110);
  const r = rng(77), n = Math.round((CW / 26) * P.clouds);
  for (let i = 0; i < n; i++) {
    const cx = r() * CW, cy = 6 + r() * (wx === 'clear' ? 60 : 84), len = 16 + r() * 60, th = 2 + r() * (wx === 'clear' ? 2 : 6);
    for (let k = 0; k < len; k += 3) {
      const ry = th * (0.5 + 0.5 * Math.sin((k / len) * Math.PI)) + r() * 1.5;
      for (const dx of [0, -CW, CW]) p.ell(cx + k + dx, cy - ry * 0.4, 4 + r() * 5, ry, P.cloud[1]);
    }
  }
  // light from the city catches the undersides; the tops stay dark
  const lit = rgb(P.cloud[2]), lit2 = rgb(P.cloud[3]), top = rgb(P.cloud[0]);
  const d = p.d, solid = p.solid;
  const paint = [];
  for (let y = 0; y < 110; y++) for (let x = 0; x < CW; x++) {
    if (!solid(x, y)) continue;
    if (!solid(x, y + 1)) paint.push(x, y, lit2);
    else if (!solid(x, y + 3) && bay(x, y) < 0.7) paint.push(x, y, lit);
    else if (!solid(x, y - 2) && bay(x, y) < 0.6) paint.push(x, y, top);
  }
  for (let i = 0; i < paint.length; i += 3) { const j = (paint[i + 1] * CW + paint[i]) * 4, k = paint[i + 2]; d[j] = k[0]; d[j + 1] = k[1]; d[j + 2] = k[2]; }
  if (wx === 'clear') for (let i = 3; i < d.length; i += 4) d[i] = d[i] ? 150 : 0;
  return { cv: p.canvas(), w: CW };
}

function buildCity(BW, ox, wx) {
  const P = WX[wx], p = painter(BW, H);
  const snow = wx === 'snow', B = (x) => x + ox, from = -ox - 8, to = BW - ox + 8;
  const I = { blink: [], toggles: [], tvs: [], neons: [], signal: null, vents: [], puddles: [], lamps: [], vend: null };
  const lights = [], signs = [], props = [];

  // the far skyline: towers half lost in haze, showing over the buildings across the road and down the alleys
  const farHi = mixHex(P.far, P.haze, 0.3);
  spans(from - 30, to + 30, 11, 9, 26, 1, (x, w, r) => {
    const top = 30 + Math.floor(r() * 66), bx = B(x), tone = r() < 0.45 ? P.far : farHi;
    p.r(bx, top, w, 150 - top, tone);
    p.r(bx, top, 1, 150 - top, P.farLit, 0.22);
    if (r() < 0.35) { const sw = 2 + Math.floor(r() * (w / 3)), sh = 4 + Math.floor(r() * 10); p.r(bx + ((w - sw) >> 1), top - sh, sw, sh, tone); }
    else if (r() < 0.35 && w > 12) { p.r(bx + 2, top - 3, w - 4, 3, tone); p.r(bx + 4, top - 6, w - 8, 3, tone); }
    if (r() < 0.3) { const ax = bx + (w >> 1), ah = 6 + Math.floor(r() * 10); p.r(ax, top - ah - 4, 1, ah + 4, tone); I.blink.push({ x: ax, y: top - ah - 5, ph: r() * 3, per: 1.4 + r(), c: '#ff5a5a' }); }
    for (let yy = top + 3; yy < 132; yy += 4) for (let xx = 2; xx < w - 2; xx += 3) if (r() < 0.16) p.p(bx + xx, yy, r() < 0.75 ? P.farLit : '#a07a56');
  });
  p.haze(30, 150, P.haze, 0.06, 0.6);

  // the buildings across the street, now and then with an alley between them
  spans(from - 70, to + 70, 23, 34, 60, 2, (x, w, r) => {
    const alley = w > 44 && r() < 0.3 ? 8 + Math.floor(r() * 6) : 0;
    if (alley) {
      const ax = B(x) + w - alley;
      p.r(ax, 108, alley, 36, '#0b0d1f'); p.r(ax, 126, alley, 18, '#080918');
      p.glow(ax + alley / 2, 136, alley, 9, '#ffb870', 0.3); p.r(ax + 2, 129, 2, 3, '#ffcf87', 0.7);
      for (let yy = 112; yy < 142; yy += 6) p.r(ax, yy, 1, 3, '#151935');
    }
    building(p, B(x), w - alley, r, I, lights, signs, props, snow);
  });
  p.haze(92, 144, P.haze, 0, P.veil);

  // vertical neon, hung after the buildings so their glow falls across the walls
  const hung = [];
  for (const s of signs) {
    if (hung.some((q) => Math.abs(q.x - s.x) < 11)) continue;   // never two on the same corner
    hung.push(s);
    const n = NEON[s.n], hh = s.word.length * 6 + 3;
    p.glow(s.x + 3.5, s.y + hh / 2, 13, hh / 2 + 10, n.glow, 0.34);
    p.r(s.x + (s.left ? 7 : -2), s.y + 3, 2, 1, '#07080f'); p.r(s.x + (s.left ? 7 : -2), s.y + hh - 4, 2, 1, '#07080f');
    p.r(s.x, s.y, 7, hh, '#0a0b18');
    p.r(s.x, s.y, 7, 1, n.tube); p.r(s.x, s.y + hh - 1, 7, 1, n.tube); p.r(s.x, s.y, 1, hh, n.tube); p.r(s.x + 6, s.y, 1, hh, n.tube);
    [...s.word].forEach((ch, k) => p.text(ch, s.x + 2, s.y + 2 + k * 6, n.core));
    I.neons.push({ x: s.x, y: s.y, w: 7, h: hh });
    lights.push({ x: s.x + 3, w: 4, c: n.tube, a: 0.6 });
  }

  // utility poles, and the power lines sagging between them
  const poles = [];
  for (let k = Math.floor((from - 212) / 124) - 1; ; k++) { const px = 212 + k * 124; if (px > to + 130) break; poles.push(B(px)); }
  for (const px of poles) {
    p.r(px, 50, 2, 96, '#0a0c1c'); p.r(px, 50, 1, 96, '#1c2240');
    p.r(px - 6, 55, 14, 1, '#0a0c1c'); p.r(px - 4, 61, 10, 1, '#0a0c1c');
    for (const dx of [-5, 6, -3]) p.p(px + dx, dx === -3 ? 60 : 54, '#3a4266');
    if (snow) { p.r(px - 6, 54, 14, 1, '#dce4f4'); p.r(px, 49, 2, 1, '#dce4f4'); }
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (const [dx, y, sag] of [[-5, 56, 9], [6, 56, 11], [-3, 62, 7]]) {
      for (let x = a + dx; x < b + dx; x++) { const t = (x - a - dx) / (b - a); p.p(x, Math.round(y + sag * 4 * t * (1 - t)), '#070915'); }
    }
  }

  // the far pavement
  p.r(0, 144, BW, 6, '#2a2e4a'); p.r(0, 144, BW, 1, '#3c4268'); p.r(0, 149, BW, 1, '#14172b');
  for (let x = (ox % 9); x < BW; x += 9) p.r(x, 145, 1, 4, '#22263e');
  if (snow) snowCap(p, 0, BW, 143, 149, '#d4dcf0', '#9aa6d4');
  for (const f of props) f();

  // street lamps, every so often
  for (let k = Math.floor((from - 150) / 124) - 1; ; k++) {
    const sx = 150 + k * 124;
    if (sx > to + 20) break;
    streetLamp(p, B(sx), lights, snow);
    I.lamps.push({ x: B(sx) - 8, y: 112 });
  }
  // a bus stop, a vending machine, a traffic light and road works, near the window
  const bs = B(14);
  p.glow(bs + 21, 133, 16, 13, '#ffcf9a', 0.28);
  p.r(bs + 2, 124, 24, 18, '#9fb8e0', 0.12); p.r(bs + 2, 124, 24, 1, '#c8d8f0', 0.25);
  p.r(bs + 17, 125, 8, 15, '#ffe8c0'); p.v(bs + 18, 126, 6, 13, ['#ffd8a0', '#f08a6a', '#8a4a8a']); p.ell(bs + 21, 130, 2, 2, '#fff0c0');
  p.r(bs, 121, 28, 1, '#2a3058'); p.r(bs, 122, 28, 2, '#0c0f22');
  p.r(bs + 1, 124, 1, 22, '#0c0f22'); p.r(bs + 26, 124, 1, 22, '#0c0f22');
  p.r(bs + 3, 138, 12, 2, '#3a3040'); p.r(bs + 3, 138, 12, 1, '#5a4a5a'); p.r(bs + 4, 140, 1, 5, '#0c0f22'); p.r(bs + 13, 140, 1, 5, '#0c0f22');
  p.r(bs - 3, 110, 1, 36, '#0c0f22'); p.r(bs - 5, 106, 5, 5, '#2a6ad0'); p.r(bs - 4, 108, 3, 1, '#e8f0ff');
  if (snow) { p.r(bs - 1, 120, 30, 1, '#e8eef8'); p.r(bs + 3, 137, 12, 1, '#e8eef8'); }
  lights.push({ x: bs + 21, w: 5, c: '#ffc890', a: 0.4 });
  const tl = B(106);
  p.r(tl, 110, 1, 36, '#0c0f22'); p.r(tl - 1, 142, 3, 4, '#0c0f22');
  p.r(tl - 2, 99, 5, 12, '#0b0d1c'); p.r(tl - 2, 99, 5, 1, '#262c4c');
  for (const yy of [101, 104, 107]) p.r(tl - 1, yy, 3, 2, '#191c30');
  if (snow) p.r(tl - 2, 98, 5, 1, '#e8eef8');
  I.signal = { x: tl - 1, y: 101 };
  const vm = B(56);
  p.glow(vm + 5, 136, 16, 14, '#cfe8ff', 0.3);
  p.r(vm, 126, 10, 18, '#c9d8e6'); p.r(vm, 126, 10, 3, '#3f6ad0'); p.r(vm, 126, 10, 1, '#6a8ff0');
  for (let k = 0; k < 4; k++) { p.r(vm + 1 + k * 2, 131, 1, 2, ['#e04a4a', '#4ab04a', '#e0c04a', '#4a8ae0'][k]); p.r(vm + 1 + k * 2, 134, 1, 2, ['#f08a3a', '#e8e8e8', '#8a4ae0', '#4ad0d0'][k]); }
  p.r(vm + 1, 137, 8, 1, '#8a9ab0'); p.r(vm + 2, 140, 6, 2, '#1a1e2c'); p.r(vm + 9, 126, 1, 18, '#7a8aa0');
  if (snow) p.r(vm, 125, 10, 1, '#e8eef8');
  I.vend = { x: vm, y: 126 };
  const cone = (x) => { p.r(x + 2, 141, 1, 2, '#ff8a3a'); p.r(x + 1, 143, 3, 1, '#f2f2f2'); p.r(x + 1, 144, 3, 2, '#ff7a2e'); p.r(x, 146, 5, 1, '#e8e8e8'); p.r(x - 1, 147, 7, 1, '#1a1a22'); if (snow) p.p(x + 2, 140, '#e8eef8'); };
  cone(B(118)); cone(B(136));
  p.r(B(124), 140, 1, 7, '#1a1a22'); p.r(B(132), 140, 1, 7, '#1a1a22');
  for (let k = 0; k < 10; k++) p.r(B(123) + k, 140, 1, 2, k % 4 < 2 ? '#ff8a3a' : '#f2f2f2');
  I.blink.push({ x: B(128), y: 138, ph: 0, per: 1.2, c: '#ffb347', on: 0.5 });

  // the road, wet
  p.v(0, 150, BW, 18, ['#0e1126', '#121630', '#161a37']);
  const rr = rng(404);
  for (let i = 0; i < BW / 6; i++) p.r(Math.floor(rr() * BW), 151 + Math.floor(rr() * 16), 3 + Math.floor(rr() * 10), 1, '#1e2346', 0.7);
  for (let x = (ox % 16) - 16; x < BW; x += 16) p.r(x, 158, 8, 1, '#3a4064');
  for (let k = 0; k < 5; k++) p.r(B(74 + k * 6), 151, 3, 16, '#252a48');
  for (let i = 0; i < BW / 34; i++) {
    const r = rng(900 + i), px = Math.floor(r() * BW), py = 161 + Math.floor(r() * 6), rx = 4 + Math.floor(r() * 9);
    p.ell(px, py, rx, 1.3, '#1d2346'); p.ell(px, py, rx - 1.5, 0.8, '#2a3160');
    I.puddles.push({ x: px, y: py, rx });
  }
  const mh = B(172);
  p.ell(mh, 163, 7, 1.8, '#090b18'); p.ell(mh, 163, 5.5, 1.2, '#1b2040'); p.r(mh - 3, 163, 6, 1, '#0d1020');
  I.vents.push({ x: mh, y: 161 });
  // reflections run down the wet road towards us: the bright lights only, but boldly
  if (snow) for (let i = 0; i < BW / 3; i++) p.r(Math.floor(rr() * BW), 151 + Math.floor(rr() * 16), 2 + Math.floor(rr() * 5), 1, '#9aa6c8', 0.3);
  for (const L of lights) streak(p, L.x, L.w, L.c, L.a * (snow ? 0.6 : 1), 150, 168);
  // the vending machine's own blue, broken into ripples
  for (let y = 152; y < 166; y += 2) { const f = 1 - (y - 152) / 14, ww = 3 + Math.floor(hash(y, vm) * 5); p.r(vm + 5 - (ww >> 1) + Math.round(Math.sin(y * 1.3)), y, ww, 1, '#6a9ae0', 0.26 * f); }

  // our side: kerb and pavement (seen through the door in full screen)
  p.r(0, 168, BW, 2, '#3a4064'); p.r(0, 168, BW, 1, '#4a5078'); p.r(0, 170, BW, 1, '#14172b');
  p.v(0, 171, BW, 70, ['#1e2236', '#22263d', '#262a44']);
  for (const [y, k] of [[175, 0], [180, 1], [186, 2], [193, 3], [201, 4], [210, 5], [220, 6], [231, 7]]) {
    p.r(0, y, BW, 1, '#181b2e');
    const step = 12 + k * 3;
    for (let x = ((ox + k * 7) % step) - step; x < BW; x += step) p.r(x, y + 1, 1, 4 + k * 2, '#1b1e32');
  }
  for (let i = 0; i < BW / 50; i++) {
    const r = rng(1300 + i), px = Math.floor(r() * BW), py = 180 + Math.floor(r() * 30), rx = 6 + Math.floor(r() * 12);
    p.ell(px, py, rx, 2, '#1a1f3c'); p.ell(px, py - 0.5, rx - 2, 1, '#2c3460');
    I.puddles.push({ x: px, y: py, rx });
  }
  for (const L of lights) if (L.a >= 0.6) streak(p, L.x, L.w + 1, L.c, L.a * 0.45, 171, 212);
  if (snow) {
    snowCap(p, 0, BW, 170, 240, '#c4cce6', '#8e9ac6');
    for (let x = (ox % 11); x < BW; x += 11) { p.r(x, 196 + (x % 3), 2, 1, '#8e9ac6'); p.r(x + 5, 203 - (x % 2), 2, 1, '#8e9ac6'); }   // footprints
  }
  p.glow(B(100), 182, 110, 18, '#ffcf87', 0.32);
  return { cv: p.canvas(), I };
}

// snow lying on the ground: solid, with an uneven top edge, a soft dithered lip and a blue shadow
function snowCap(p, x0, w, y0, y1, c, shade) {
  for (let x = x0; x < x0 + w; x++) {
    const top = y0 + (hash(x >> 2, 3) < 0.35 ? 1 : 0) - (hash(x >> 3, 5) < 0.2 ? 1 : 0);
    p.r(x, top, 1, y1 - top, c);
    if (bay(x, top - 1) < 0.4) p.p(x, top - 1, c);
    p.p(x, y1 - 1, shade);
    if (y1 - y0 > 6) for (let y = top + 3; y < y1 - 1; y++) if (hash(x >> 1, y) < 0.04) p.p(x, y, shade);
  }
}

// a reflection on wet ground: a wobbling, fading vertical streak
function streak(p, x, w, c, a, y0, y1) {
  const xi = Math.round(x);
  for (let y = y0; y < y1; y++) {
    const f = 1 - (y - y0) / (y1 - y0);
    if ((y + xi) % 2 && f < 0.85) continue;                 // ripples break it into dashes
    if (hash(xi, y) > 0.45 + 0.55 * f) continue;           // and more so nearer us
    const off = Math.round(Math.sin(y * 0.9 + x * 0.3) * 1.4), ww = Math.max(1, Math.round(w * (0.35 + 0.65 * hash(y, xi)) * (0.6 + 0.4 * f)));
    p.r(Math.round(x - ww / 2) + off, y, ww, 1, c, Math.min(1, a * (0.45 + 0.75 * f)));
  }
}

function streetLamp(p, x, lights, snow) {
  p.glow(x - 8, 105, 24, 19, '#ffcf7a', 0.5);
  p.glow(x - 8, 126, 12, 24, '#ffcf7a', 0.16);
  p.glow(x - 8, 147, 28, 6, '#ffcf7a', 0.55);
  p.r(x, 103, 2, 43, '#0b0e20'); p.r(x, 103, 1, 43, '#262e56'); p.r(x - 1, 140, 4, 6, '#0b0e20');
  p.r(x - 7, 102, 8, 1, '#0b0e20'); p.r(x - 1, 101, 2, 2, '#0b0e20');
  p.r(x - 12, 101, 8, 2, '#141831'); p.r(x - 12, 101, 8, 1, '#2a3058');
  p.r(x - 11, 103, 6, 1, '#fff1c4'); p.r(x - 10, 104, 4, 1, '#ffd88a');
  if (snow) p.r(x - 12, 100, 8, 1, '#e8eef8');
  lights.push({ x: x - 8, w: 3, c: '#ffd88a', a: 0.7 });
}

function building(p, bx, w, r, I, lights, signs, props, snow) {
  const pal = pick(r, BLD), top = 52 + Math.floor(r() * 46);
  p.r(bx, top, w, 144 - top, pal[0]);
  const tex = r();
  if (tex < 0.4) for (let yy = top + 3; yy < 114; yy += 3) p.dz(bx + 1, yy, w - 2, 1, pal[2], 0.3);
  else if (tex < 0.7) for (let xx = bx + 3; xx < bx + w - 2; xx += 6) p.r(xx, top + 2, 1, 112 - top, pal[2], 0.5);
  p.r(bx, top, 1, 144 - top, pal[1]); p.r(bx + w - 1, top, 1, 144 - top, pal[2]);
  p.r(bx - 1, top - 1, w + 2, 2, pal[1]); p.r(bx, top + 1, w, 1, pal[2]);
  if (snow) p.r(bx - 1, top - 2, w + 2, 1, '#dce4f4');
  // the roof
  const k = r();
  if (k < 0.3 && w > 20) {
    const tx = bx + 4 + Math.floor(r() * (w - 16));
    p.r(tx + 1, top - 5, 1, 4, '#120e18'); p.r(tx + 7, top - 5, 1, 4, '#120e18'); p.r(tx + 1, top - 3, 7, 1, '#120e18');
    p.r(tx, top - 14, 9, 9, '#2a1f2a'); p.r(tx, top - 14, 1, 9, '#3d2c38');
    p.r(tx, top - 11, 9, 1, '#1a1219'); p.r(tx, top - 8, 9, 1, '#1a1219');
    p.r(tx - 1, top - 16, 11, 2, '#1d151d'); p.r(tx + 2, top - 17, 5, 1, '#1d151d'); p.r(tx + 4, top - 19, 1, 2, '#1d151d');
    if (snow) p.r(tx - 1, top - 17, 11, 1, '#e8eef8');
  } else if (k < 0.6) {
    const n = 1 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) { const ax = bx + 3 + Math.floor(r() * Math.max(1, w - 10)); p.r(ax, top - 4, 6, 4, '#20253f'); p.r(ax, top - 4, 6, 1, '#343b5e'); p.r(ax + 1, top - 3, 2, 2, '#10132a'); if (snow) p.r(ax, top - 5, 6, 1, '#e8eef8'); }
    if (r() < 0.6) { const ax = bx + 2 + Math.floor(r() * (w - 4)), ah = 8 + Math.floor(r() * 12); p.r(ax, top - ah, 1, ah, '#0e1124'); p.r(ax - 2, top - ah + 3, 5, 1, '#0e1124'); I.blink.push({ x: ax, y: top - ah - 1, ph: r() * 3, per: 1.6 + r(), c: '#ff4a4a' }); }
  } else if (k < 0.75 && w > 30) {
    const bw = w - 8, by = top - 15, n = NEON[Math.floor(r() * 4)];
    p.r(bx + 6, by + 10, 1, 5, '#0e1124'); p.r(bx + w - 7, by + 10, 1, 5, '#0e1124');
    p.glow(bx + w / 2, by + 5, bw * 0.6, 10, n.glow, 0.22);
    p.r(bx + 4, by, bw, 10, '#0d1022'); p.v(bx + 5, by + 1, bw - 2, 8, ['#2a2350', '#4a2e6a']);
    p.r(bx + 6, by + 2, Math.min(bw - 6, 8), 6, n.tube, 0.8);
    const word = pick(r, ['COLA', 'SODA', 'NOVA', 'MOON', 'LUNA', 'RADIO']);
    if (word.length * 4 < bw - 14) p.text(word, bx + 16, by + 3, '#f2e8ff');
  } else {
    p.r(bx, top - 3, w, 1, '#0e1124');
    for (let xx = bx; xx < bx + w; xx += 4) p.r(xx, top - 3, 1, 3, '#0e1124');
  }
  // windows
  const cols = Math.max(1, Math.floor((w - 4) / 7)), x0 = bx + Math.floor((w - (cols * 7 - 3)) / 2);
  const litP = 0.25 + r() * 0.3, warm = r() < 0.75;
  for (let fy = top + 6; fy <= 104; fy += 9) for (let c = 0; c < cols; c++) {
    const wx = x0 + c * 7;
    if (r() < litP) {
      const cool = r() < 0.12, col = cool ? '#8fdcec' : WARM[Math.floor(r() * (warm ? 4 : 2)) + (warm ? 0 : 2)];
      p.r(wx, fy, 4, 5, col);
      p.r(wx, fy + 3, 4, 2, '#000000', 0.18);
      if (r() < 0.35) p.r(wx + (r() < 0.5 ? 0 : 3), fy, 1, 5, '#000000', 0.28);
      if (r() < 0.15) { p.r(wx + 1, fy + 2, 2, 3, '#000000', 0.45); p.r(wx + 1, fy + 1, 2, 1, '#000000', 0.45); }
      if (cool && r() < 0.7) I.tvs.push({ x: wx, y: fy, ph: r() * 9 });
      else if (r() < 0.05) I.toggles.push({ x: wx, y: fy, c: col, on: true, ph: r() * 30, per: 18 + r() * 30 });
    } else {
      p.r(wx, fy, 4, 5, '#0b0e22'); p.p(wx, fy, pal[1]); p.p(wx + 1, fy, pal[1], 0.5);
      if (r() < 0.05) I.toggles.push({ x: wx, y: fy, c: WARM[0], on: false, ph: r() * 30, per: 18 + r() * 30 });
    }
    p.r(wx - 1, fy + 5, 6, 1, snow ? '#b8c2dc' : pal[1]);
  }
  // a fire escape down one side
  if (w > 38 && r() < 0.45) {
    const fx = bx + (r() < 0.5 ? 2 : w - 16), fw = 14;
    for (let fy = top + 12; fy <= 100; fy += 9) {
      p.r(fx, fy + 6, fw, 1, '#080a16'); p.r(fx, fy + 3, fw, 1, '#151933');
      for (let q = 0; q <= fw; q += 3) p.r(fx + q, fy + 3, 1, 3, '#151933');
      if (fy + 15 < 112) p.line(fx + 2, fy + 7, fx + fw - 3, fy + 14, '#0c0f20');
      if (snow) p.r(fx, fy + 5, fw, 1, '#c8d2ea');
    }
  }
  // the shop at street level
  p.r(bx, 113, w, 31, pal[2]); p.r(bx, 113, w, 1, pal[1]);
  if (r() < 0.2) {
    p.r(bx + 3, 122, w - 6, 22, '#262a3d'); for (let yy = 123; yy < 144; yy += 2) p.r(bx + 3, yy, w - 6, 1, '#323750');
    p.r(bx + 3, 117, w - 6, 4, '#0b0c1a');
  } else {
    const L = pick(r, SHOP), ww = w - 13, sx = bx + 3;
    p.v(sx, 123, ww, 17, [L[0], L[1]]);
    for (let yy = 128; yy < 140; yy += 5) {
      p.r(sx, yy, ww, 1, '#000000', 0.28);
      for (let xx = sx + 1; xx < sx + ww - 1; xx += 2) if (r() < 0.6) p.r(xx, yy - 2, 1, 2, pick(r, ['#b04a4a', '#4a7ab0', '#e0c060', '#5a9a5a', '#ffffff']), 0.55);
    }
    if (r() < 0.55) { const hx = sx + 3 + Math.floor(r() * Math.max(1, ww - 8)); p.r(hx, 129, 3, 11, '#000000', 0.55); p.r(hx, 126, 3, 3, '#000000', 0.55); }
    p.r(sx - 1, 122, ww + 2, 1, '#0a0c1a'); p.r(sx - 1, 140, ww + 2, 1, '#0a0c1a'); p.r(sx - 1, 122, 1, 19, '#0a0c1a'); p.r(sx + ww, 122, 1, 19, '#0a0c1a');
    if (ww > 16) p.r(sx + (ww >> 1), 123, 1, 17, '#0a0c1a');
    p.r(sx - 1, 141, ww + 2, 3, pal[0]);
    p.r(bx + w - 9, 124, 6, 20, '#0a0c1a'); p.r(bx + w - 8, 125, 4, 8, L[1], 0.55);
    if (r() < 0.55) {
      const a = pick(r, AWN);
      for (let xx = bx + 1; xx < bx + w - 1; xx++) p.r(xx, 115, 1, 6, ((xx - bx) >> 1) % 2 ? a[0] : a[1]);
      p.r(bx + 1, 115, w - 2, 1, '#ffffff', 0.15);
      for (let xx = bx + 1; xx < bx + w - 1; xx += 4) p.r(xx, 121, 2, 1, a[0]);
      p.r(bx + 1, 122, w - 2, 1, '#000000', 0.35);
      if (snow) p.r(bx + 1, 114, w - 2, 1, '#e4ebf7');
    } else {
      const word = SHOPWORDS.filter((s) => s.length * 4 - 1 <= w - 8);
      p.r(bx + 2, 115, w - 4, 7, '#0b0c1a');
      if (word.length) { const s = pick(r, word), n = NEON[Math.floor(r() * 4)]; p.glow(bx + w / 2, 118, w * 0.5, 6, n.glow, 0.25); p.text(s, bx + Math.floor((w - (s.length * 4 - 1)) / 2), 116, n.core); }
    }
    if (ww > 18) lights.push({ x: sx + (ww >> 1), w: Math.max(3, ww >> 1), c: L[1], a: 0.35 });
    p.glow(sx + ww / 2, 146, ww * 0.8, 4, L[0], 0.4);
  }
  if (r() < 0.6) {
    const word = pick(r, WORDS), hh = word.length * 6 + 3, left = r() < 0.5;
    signs.push({ x: left ? bx - 4 : bx + w - 3, y: Math.max(top + 6, 110 - hh - Math.floor(r() * 24)), word, n: Math.floor(r() * 4), left });
  }
  // something small on the pavement in front
  const pr = r(), px = bx + 4 + Math.floor(r() * Math.max(1, w - 12));
  if (pr < 0.16) props.push(() => { p.r(px, 143, 3, 5, '#a8323a'); p.r(px - 1, 144, 5, 1, '#a8323a'); p.r(px, 142, 3, 1, '#c84a4a'); });
  else if (pr < 0.32) props.push(() => { p.r(px, 141, 4, 7, '#2a3040'); p.r(px - 1, 140, 6, 1, '#3a4256'); });
  else if (pr < 0.44) props.push(() => { p.line(px, 147, px + 3, 144, '#3a4a6a'); p.line(px + 3, 144, px + 7, 147, '#3a4a6a'); p.ell(px, 146, 2, 2, '#10132a'); p.ell(px + 8, 146, 2, 2, '#10132a'); p.r(px + 2, 143, 3, 1, '#4a5a7a'); });
  else if (pr < 0.56) props.push(() => { p.r(px, 142, 8, 6, '#3a2a22'); p.ell(px + 4, 141, 5, 3, '#1f3a2a'); p.p(px + 2, 140, '#2f5a3a'); });
  else if (pr < 0.64) props.push(() => { p.r(px, 139, 4, 8, '#2a4a8a'); p.r(px, 139, 4, 1, '#4a6aaa'); p.r(px + 1, 147, 2, 1, '#14172b'); });
}

/* ——— the room ——— */

// In full screen the café carries on either side of the square: modules along the back wall,
// in a varied order, and things close by on the floor either side of your table.
const WID = { coat: 18, door: 54, table: 50, table2: 68, plant: 22, shelf: 38, case: 36, books: 38, board: 40 };
const LSEQ = ['coat', 'door', 'table', 'plant', 'table2', 'board', 'table', 'books', 'table2', 'shelf', 'table', 'plant'];
const RSEQ = ['case', 'books', 'table', 'table2', 'plant', 'board', 'table', 'shelf', 'table2', 'books', 'table', 'plant'];
const PROPS = ['laptop', 'book', 'write', 'paper', 'knit', 'phone'];
const WALLS = ['window', 'art', 'window', 'shelf'];
// [kind, core-local centre, width]
const FGL = [['chair', -44, 80], ['books', -98, 26], ['chairback', -150, 30], ['books2', -196, 24], ['chairback', -252, 30]];
const FGR = [['plant', 366, 64], ['dog', 418, 46], ['books', 466, 26], ['chairback', 512, 30], ['books2', 560, 24]];

function layout(BW) {
  const ox = Math.floor((BW - CORE) / 2), mods = [];
  let x = ox;
  for (let i = 0; ; i++) { const t = LSEQ[i % LSEQ.length], w = WID[t]; if (x - w < 0) break; x -= w; mods.push({ t, x, w, i, side: -1 }); }
  const lgap = [0, x];
  x = ox + CORE;
  for (let i = 0; ; i++) { const t = RSEQ[i % RSEQ.length], w = WID[t]; if (x + w > BW) break; mods.push({ t, x, w, i, side: 1 }); x += w; }
  const rgap = [x, BW];
  // no two tables alike: the wall behind, who sits there, what they're busy with, the prints
  const n = { '-1': 0, 1: 0 };
  let print = 0, guest = 0;
  for (const m of [...mods].sort((a, b) => a.i - b.i || a.side - b.side)) {
    if (m.t === 'table' || m.t === 'table2') {
      const k = n[m.side]++;
      m.wall = k === 0 ? 'window' : WALLS[(k + (m.side > 0 ? 1 : 0)) % WALLS.length];
      if (m.t === 'table2' && m.wall === 'shelf') m.wall = 'art';
      m.prop = PROPS[(k * 2 + (m.side > 0 ? 1 : 0)) % PROPS.length];
      m.gv = guest; guest += m.t === 'table2' ? 2 : 1;
      m.face = m.side < 0 ? 1 : -1;
      m.tcx = Math.round(m.t === 'table2' ? m.x + m.w / 2 : (m.face > 0 ? m.x + 35 : m.x + m.w - 35));
      m.lamp = (k + (m.side > 0 ? 1 : 0)) % 3;
    }
    m.print = print; print += 3;
  }
  const fg = [];
  if (ox > 0) {
    for (const [kind, cx, w] of FGL) { const ax = ox + cx; if (ax - w / 2 > -w * 0.35) fg.push({ kind, x: ax, w, side: -1 }); }
    for (const [kind, cx, w] of FGR) { const ax = ox + cx; if (ax + w / 2 < BW + w * 0.35) fg.push({ kind, x: ax, w, side: 1 }); }
  }
  const caseMod = mods.find((m) => m.t === 'case');
  return { ox, mods, fg, gaps: [lgap, rgap], counterEnd: caseMod ? caseMod.x + 34 : ox + CORE + 4 };
}

function bricks(p, x0, y0, w, h) {
  p.r(x0, y0, w, h, '#2a1714');
  for (let row = 0, y = y0; y < y0 + h; row++, y += 5) {
    const off = row % 2 ? 0 : 5;
    for (let x = x0 - off; x < x0 + w; x += 10) {
      const c = BRICK[Math.floor(hash(x, y) * BRICK.length)], xa = Math.max(x0, x), xb = Math.min(x0 + w, x + 9);
      if (xb > xa) { p.r(xa, y, xb - xa, 4, c); p.r(xa, y, xb - xa, 1, '#ffd0b0', 0.07); p.r(xa, y + 3, xb - xa, 1, '#000000', 0.14); }
    }
  }
}

// floorboards in perspective: their seams run to a vanishing point by the window, the board ends
// crowd together towards the back wall, and it all darkens away from the lamps
function floorBoards(p, ox) {
  const vx = ox + VP.x, vy = VP.y, BW = p.w;
  const tones = ['#3b2416', '#432a1a', '#352013', '#3f2718', '#30200f'];
  for (let y = 214; y < H; y++) {
    const dz = y - vy, z = 900 / dz, z1 = 900 / (dz + 1), px = 100 / dz;
    for (let x = 0; x < BW; x++) {
      const u = (x + 0.5 - vx) * px, bi = Math.floor(u / 9), fu = u - bi * 9;
      const off = hash(bi, 7) * 3, j = Math.floor((z + off) / 1.25), j1 = Math.floor((z1 + off) / 1.25);
      let c = tones[Math.floor(hash(bi, j) * tones.length)];
      if (fu < px) c = '#160c06';                                   // the seam between boards
      else if (j !== j1) c = '#1c1009';                             // a board's end
      else if (fu < px * 2) c = '#56351f';                          // the worn edge beside the seam
      else if (Math.abs(fu - (2 + hash(bi, j * 3) * 5)) < px * 0.5) c = '#2c1a0e';   // grain
      p.p(x, y, c);
    }
  }
  p.r(0, 214, BW, 1, '#120a06');
  p.haze(214, 236, '#0e0806', 0.3, 0);
}

// the runner on the floor in front of the window seat, in the same perspective
function rug(p, ox) {
  const vx = ox + VP.x, vy = VP.y, y0 = 221, y1 = 252;
  const L = (y) => vx + (ox + 18 - vx) * ((y - vy) / (y1 - vy)), Rt = (y) => vx + (ox + 302 - vx) * ((y - vy) / (y1 - vy));
  for (let y = y0; y < y1; y++) {
    const a = Math.round(L(y)), b = Math.round(Rt(y)), w = b - a, v = y - y0;
    for (let x = a; x < b; x++) {
      const s = (x - a) / w, e = Math.min(x - a, b - 1 - x);
      let c = '#4a2226';
      if (e < 2 || v < 1) c = '#22303c';
      else if (e < 3 || v === 2) c = '#c8a060';
      else if (e < 5 || v < 5) c = '#2a3a46';
      else {
        const cell = w / 17, k = Math.round(s * 17), dx = Math.abs(x - (a + k * cell)), dy = Math.abs(y - (y0 + 15));
        if (dx + dy * 1.2 < 4.5 && dx + dy * 1.2 >= 3.5) c = '#c8a060';
        else if (dx + dy * 1.2 < 2) c = k % 2 ? '#2a6a6a' : '#a85a4a';
        else if (bay(x, y) < 0.08) c = '#5a2a2e';
      }
      p.p(x, y, c);
    }
    if (v === 0) for (let x = a; x < b; x += 2) p.p(x, y - 1, '#d8c8a8', 0.8);
  }
}

// a long tapered leaf, drooping a little towards its tip
function blade(p, x0, y0, ang, len, wid, c, rib = C.leaf3) {
  const at = (i) => { const t = i / len; return [x0 + Math.cos(ang) * i, y0 + Math.sin(ang) * i + t * t * len * 0.35]; };
  for (let i = 0; i <= len; i++) { const t = i / len, w = wid * Math.sin(Math.PI * Math.min(1, t * 1.05)), [x, y] = at(i); if (w > 0.4) p.ell(x, y, w, w * 0.9, c); }
  for (let i = 2; i < len - 2; i++) { const [x, y] = at(i); p.p(x, y, rib, 0.5); }
}

function jar(p, x, by, w, h, fill) {
  p.r(x, by - h, w, h, '#7f9aa3', 0.35);
  p.dz(x + 1, by - h + 3, w - 2, h - 4, fill[0], 1); p.dz(x + 1, by - h + 3, w - 2, h - 4, fill[1], 0.4);
  p.r(x, by - h - 2, w, 2, C.brass); p.r(x, by - h - 2, w, 1, '#e8c070');
  p.r(x + 1, by - h + 5, w - 2, 3, '#e8dcc0'); p.r(x + 2, by - h + 6, w - 4, 1, '#8a6a4a');
  p.r(x, by - h + 1, 1, h - 2, '#ffffff', 0.35);
}

function plantPot(p, x, by, r, tall) {
  p.r(x, by - 7, 8, 7, C.terra); p.r(x - 1, by - 8, 10, 2, '#b8664a'); p.r(x + 6, by - 7, 2, 7, C.terraS);
  const n = tall ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2, len = (tall ? 8 : 4) + r() * (tall ? 10 : 5);
    const ex = x + 4 + Math.cos(a) * len, ey = by - 8 + Math.sin(a) * len;
    p.line(x + 4, by - 8, ex, ey, C.leaf1);
    p.ell(ex, ey, 2, 1.5, pick(r, [C.leaf1, C.leaf2, C.leaf3]));
  }
}

function trailing(p, x, y, len, r) {
  for (let i = 0; i < len; i++) { const xx = x + Math.round(Math.sin(i * 0.5 + x) * 1.5); p.p(xx, y + i, C.leaf1); if (i % 3 === 0) { p.r(xx - 1, y + i, 2, 2, pick(r, [C.leaf2, C.leaf3])); } }
}

// little prints on the walls, eight of them, handed out so that neighbours never repeat
function framedPicture(p, x, y, w, h, kind) {
  kind = ((kind % 8) + 8) % 8;
  p.r(x - 2, y + h + 2, w + 4, 1, '#000000', 0.3);
  p.r(x - 2, y - 2, w + 4, h + 4, C.wood1); p.r(x - 2, y - 2, w + 4, 1, C.wood3); p.r(x - 2, y + h + 1, w + 4, 1, C.wood0); p.r(x - 1, y - 1, w + 2, h + 2, '#d8cbb0');
  if (kind === 0) { p.v(x, y, w, h, ['#2a3a5a', '#7a5a7a', '#e8a070']); p.ell(x + w * 0.7, y + h * 0.45, 3, 3, '#ffe0a0'); for (let k = 0; k < w; k++) p.r(x + k, y + h - 3 - Math.round(Math.abs(Math.sin(k * 0.4)) * 4), 1, 6, '#2a3040'); }
  else if (kind === 1) { p.r(x, y, w, h, '#e8e0cc'); p.ell(x + w * 0.4, y + h * 0.45, w * 0.28, w * 0.28, '#c8563a'); p.ell(x + w * 0.62, y + h * 0.6, w * 0.22, w * 0.22, '#2a5a6a'); p.r(x + 2, y + h - 4, w - 4, 1, '#3a3a3a'); }
  else if (kind === 2) { p.r(x, y, w, h, '#efe6d2'); p.line(x + w / 2, y + h - 2, x + w / 2, y + 3, C.leaf1); for (let k = 0; k < Math.floor((h - 4) / 4); k++) { p.ell(x + w / 2 - 3, y + 5 + k * 4, 2.5, 1.2, C.leaf2); p.ell(x + w / 2 + 3, y + 7 + k * 4, 2.5, 1.2, C.leaf3); } }
  else if (kind === 3) { p.r(x, y, w, h, '#e8dfc8'); for (let k = 0; k < w; k++) { const c = Math.round(y + h * 0.5 + Math.sin(k * 0.8) * 2); p.r(x + k, c, 1, y + h - c, '#2a4a7a'); p.p(x + k, c, '#e8f0f0'); if (k % 4 === 1) p.p(x + k, c - 1, '#e8f0f0'); } p.ell(x + w * 0.75, y + 3, 1.5, 1.5, '#c8563a'); }
  else if (kind === 4) { p.v(x, y, w, h, ['#1a2440', '#3a4a70']); for (let k = 0; k < w; k++) { const m = Math.max(h * 0.75 - Math.abs(k - w * 0.32) * 1.3, h * 0.5 - Math.abs(k - w * 0.72) * 1.2, 2); p.r(x + k, Math.round(y + h - m), 1, Math.round(m), '#5a6a90'); if (m > h * 0.55) p.p(x + k, Math.round(y + h - m), '#f2f2f2'); } p.p(x + w - 3, y + 2, '#fff0c0'); }
  else if (kind === 5) { p.r(x, y, w, h, '#e8b860'); const cx = x + w / 2, by = y + h - 1; p.ell(cx, by - 3, 3.5, 3.5, '#1a1414'); p.ell(cx, by - 8, 2.4, 2.2, '#1a1414'); p.p(cx - 2, by - 11, '#1a1414'); p.p(cx + 1, by - 11, '#1a1414'); p.line(cx + 3, by - 1, cx + 5, by - 5, '#1a1414'); }
  else if (kind === 6) { p.r(x, y, w, h, '#efe6d2'); const cx = Math.round(x + w / 2 - 3), cy = Math.round(y + h * 0.45); p.r(cx, cy, 6, 4, '#6a3a22'); p.r(cx + 6, cy + 1, 1, 2, '#6a3a22'); p.r(cx - 1, cy + 4, 8, 1, '#6a3a22'); for (const k of [1, 4]) { p.p(cx + k, cy - 2, '#a8a090'); p.p(cx + k + 1, cy - 3, '#a8a090'); } }
  else { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.p(x + xx, y + yy, ['#2a3a3a', '#c8563a', '#e8b860', '#5a8a8a'][Math.floor((xx + yy) / 3) % 4]); }
}

// a brass wall light with a lit shade
function sconce(p, x, y) {
  p.glow(x, y - 4, 18, 22, '#ffcf87', 0.3);
  p.glow(x, y - 6, 7, 6, '#fff0c8', 0.4);
  p.r(x - 1, y + 1, 3, 5, C.brassS); p.r(x - 2, y + 5, 5, 1, C.brass);
  for (let k = 0; k < 7; k++) p.r(x - 2 - (k >> 2), y - 6 + k, 5 + ((k >> 2) << 1), 1, k < 2 ? '#fff0c8' : '#f0cc88');
  p.r(x - 3, y + 1, 7, 1, '#a07838');
}

// a tall window in the side wall onto the same street; its glass is cut out of the layer
function sideWindow(p, m, wx, ww, r) {
  const y0 = 40, y1 = 150, tr = 60, mid = wx + (ww >> 1);
  p.r(wx - 3, y0 - 3, ww + 6, y1 - y0 + 6, C.wood1); p.r(wx - 3, y0 - 3, ww + 6, 1, C.wood3); p.r(wx - 3, y0 - 3, 1, y1 - y0 + 6, C.wood2); p.r(wx + ww + 2, y0 - 3, 1, y1 - y0 + 6, C.wood0);
  m.glass = [];
  for (const [gx, gy, gw, gh] of [[wx, y0, mid - wx - 1, tr - y0 - 1], [mid + 1, y0, wx + ww - mid - 1, tr - y0 - 1], [wx, tr + 1, mid - wx - 1, y1 - tr - 1], [mid + 1, tr + 1, wx + ww - mid - 1, y1 - tr - 1]]) {
    p.r(gx - 1, gy - 1, gw + 2, gh + 2, C.wood0);
    p.clear(gx, gy, gw, gh);
    for (const [o, wd, a] of [[gw * 0.3, 2, 0.06], [gw * 0.65, 1, 0.08]]) for (let yy = 0; yy < gh; yy++) for (let k = 0; k < wd; k++) { const xx = Math.round(o + k + (gh - yy) * 0.55 - gh * 0.3); if (xx >= 0 && xx < gw) p.p(gx + xx, gy + yy, '#ffffff', a); }
    m.glass.push({ x: gx, y: gy, w: gw, h: gh });
  }
  // the sill, and something on it
  p.r(wx - 5, y1 + 2, ww + 10, 3, C.wood3); p.r(wx - 5, y1 + 2, ww + 10, 1, C.wood4); p.r(wx - 4, y1 + 5, ww + 8, 1, C.wood0);
  const k = r();
  if (k < 0.4) plantPot(p, wx + 2 + Math.floor(r() * (ww - 12)), y1 + 2, r, false);
  else if (k < 0.7) { const jx = wx + 3 + Math.floor(r() * (ww - 10)); p.glow(jx + 2, y1 - 3, 9, 7, '#ffcf87', 0.4); p.r(jx, y1 - 4, 5, 6, '#e8c890', 0.65); p.r(jx + 1, y1 - 4, 3, 1, '#fff0c0'); p.p(jx + 2, y1 - 6, '#ffb347'); }
  else for (let q = 0; q < 3; q++) p.r(wx + 4 + q, y1 + 2 - (q + 1) * 2, 12 - q * 2, 2, pick(r, BOOKCOL));
  p.glow(wx + ww / 2, y1 + 9, ww * 0.7, 6, '#7a86e0', 0.12);
}

// the still back of the room: ceiling, walls, floor, the window (glass cut out), shelves, the
// furniture against the walls in full screen
function buildBack(BW, L) {
  const p = painter(BW, H), ox = L.ox, X = (x) => ox + x, r = rng(5);
  p.r(0, 0, BW, 7, '#140b0e');
  for (let x = (ox % 26) - 26; x < BW; x += 26) { p.r(x, 0, 4, 7, '#1f1210'); p.r(x, 6, 4, 1, '#2d1a14'); }
  p.r(0, 7, BW, 4, C.beam); p.r(0, 7, BW, 1, C.beamHi); p.r(0, 10, BW, 1, '#100808');
  // the wall: dark plum paper with a small diamond print, faint pinstripes and a picture rail
  p.v(0, 11, BW, 154, ['#1a0f15', '#21131a', '#29181f', '#321d24', '#392228']);
  for (let row = 0, y = 17; y < 158; row++, y += 12) for (let x = ((ox + (row % 2) * 6) % 12) - 12; x < BW + 2; x += 12) { p.p(x, y, '#4a2a33', 0.5); p.p(x - 1, y + 1, '#4a2a33', 0.3); p.p(x + 1, y + 1, '#4a2a33', 0.3); p.p(x, y + 2, '#4a2a33', 0.5); }
  for (let x = ((ox + 6) % 12) - 12; x < BW; x += 12) p.r(x, 11, 1, 153, '#000000', 0.07);
  for (let i = 0; i < BW * 2; i++) p.r(Math.floor(r() * BW), 11 + Math.floor(r() * 150), 2, 1, r() < 0.5 ? '#000000' : '#ffd0a0', 0.05);
  p.r(0, 44, BW, 3, C.wood1); p.r(0, 44, BW, 1, C.wood2); p.r(0, 47, BW, 1, '#000000', 0.3);
  // wainscot and skirting
  p.r(0, 164, BW, 3, C.wood2); p.r(0, 164, BW, 1, C.wood3); p.r(0, 167, BW, 1, C.wood0);
  p.r(0, 168, BW, 38, C.teal1);
  for (let x = (ox % 24) - 24; x < BW; x += 24) { p.r(x + 3, 171, 18, 31, C.teal2, 0.55); p.r(x + 3, 171, 18, 1, C.teal3); p.r(x + 3, 171, 1, 31, C.teal3, 0.6); p.r(x + 3, 201, 18, 1, C.teal0); p.r(x + 20, 171, 1, 31, C.teal0); }
  p.r(0, 206, BW, 8, C.wood1); p.r(0, 206, BW, 1, C.wood2);
  // the floor and the runner, and pools of lamplight on them
  floorBoards(p, ox); rug(p, ox);
  for (const lx of LAMPS) p.glow(X(lx), 220, 46, 8, '#ffcf87', 0.3);
  p.glow(X(250), 219, 64, 7, '#ffcf87', 0.2);
  p.glow(X(100), 217, 96, 4, '#7a86e0', 0.1);
  for (const m of L.mods) if (m.tcx) p.glow(m.tcx, 219, 30, 7, '#ffcf87', 0.34);
  // bare brick behind the counter, under a dark trim
  const brickEnd = L.counterEnd + 2;
  bricks(p, X(196), 11, brickEnd - X(196), 153);
  p.haze(11, 60, '#0e0608', 0.35, 0);
  p.r(X(192), 11, 4, 153, C.wood1); p.r(X(192), 11, 1, 153, C.wood2); p.r(X(195), 11, 1, 153, C.wood0);
  if (brickEnd < BW) { p.r(brickEnd, 11, 3, 153, C.wood1); p.r(brickEnd, 11, 1, 153, C.wood2); }
  // the kitchen doorway (its curtain is drawn live): warm and dim, tiles, pots on a shelf
  const kx = X(DOORWAY.x), kw = DOORWAY.w;
  p.r(kx - 2, 87, kw + 4, 72, C.wood1); p.r(kx - 2, 87, kw + 4, 1, C.wood3); p.r(kx - 2, 87, 1, 72, C.wood2); p.r(kx + kw + 1, 87, 1, 72, C.wood0);
  p.r(kx, 89, kw, 70, '#6a4630'); p.r(kx, 89, kw, 18, '#7a5236'); p.r(kx, 89, 2, 70, '#4a2e1c');
  p.r(kx, 118, kw, 24, '#b4a284'); for (let y = 118; y < 142; y += 4) p.r(kx, y, kw, 1, '#8c7a5e'); for (let y = 118; y < 142; y += 4) for (let x = kx + ((y >> 2) % 2) * 2; x < kx + kw; x += 4) p.r(x, y, 1, 4, '#8c7a5e');
  p.r(kx, 142, kw, 2, '#5a3a24'); p.r(kx, 144, kw, 14, '#3a2416');
  p.r(kx, 108, kw, 1, '#3a2416'); p.r(kx + 2, 103, 4, 5, '#8a8a90'); p.r(kx + 2, 103, 4, 1, '#c8c8d0'); p.r(kx + 9, 104, 5, 4, '#a85a3a'); p.r(kx + 9, 104, 5, 1, '#d8865a');
  p.line(kx + 12, 109, kx + 12, 113, '#3a3a40'); p.ell(kx + 12, 115, 2.5, 2, '#4a4a52');
  p.glow(kx + kw / 2, 96, 16, 18, '#ffd89a', 0.5); p.r(kx + 6, 89, 4, 2, '#fff0c8');

  // the window: frame, glass (cut out, so the street shows through), a faint shine
  p.r(X(8), 24, 184, 150, C.wood1);
  p.r(X(8), 24, 184, 1, C.wood3); p.r(X(8), 24, 1, 150, C.wood2); p.r(X(191), 24, 1, 150, C.wood0);
  p.r(X(12), 49, 176, 1, C.wood2); p.r(X(99), 52, 1, 118, C.wood2);
  for (const [x, y, w, h] of PANES) {
    p.r(X(x) - 1, y - 1, w + 2, h + 2, C.wood0);
    p.clear(X(x), y, w, h);
    for (const [o, wd, a] of [[w * 0.25, 3, 0.06], [w * 0.45, 1, 0.08], [w * 0.8, 2, 0.05]]) {
      for (let yy = 0; yy < h; yy++) for (let k = 0; k < wd; k++) { const xx = Math.round(o + k + (h - yy) * 0.55 - h * 0.3); if (xx >= 0 && xx < w) p.p(X(x) + xx, y + yy, '#ffffff', a); }
    }
  }
  // fairy lights along the top of the window (the bulbs twinkle, drawn live)
  for (let x = 12; x <= 188; x++) { const t = (x - 12) / 176, y = 26 + Math.round(Math.sin(t * Math.PI * 3) ** 2 * 3); p.p(X(x), y, '#120a08'); }
  // a hanging plant in a macramé sling over the mullion
  p.line(X(100), 11, X(96), 22, '#c8b48a'); p.line(X(100), 11, X(104), 22, '#c8b48a');
  p.ell(X(100), 25, 6, 4, C.terra); p.r(X(94), 22, 12, 2, '#b8664a'); p.r(X(101), 22, 5, 7, C.terraS, 0.5);
  trailing(p, X(95), 26, 22, r); trailing(p, X(99), 27, 30, r); trailing(p, X(104), 26, 18, r);
  for (let k = 0; k < 9; k++) p.ell(X(94 + k * 1.5), 21 - (k % 3), 2.2, 1.6, pick(r, [C.leaf2, C.leaf3, C.leaf1]));
  // the chains of the neon sign
  p.line(X(SIGN.x + 20), 50, X(SIGN.x + 20), SIGN.y + 5, '#4a4a52'); p.line(X(SIGN.x + 44), 50, X(SIGN.x + 44), SIGN.y + 5, '#4a4a52');
  // the sill, and the window seat under it
  p.r(X(4), 170, 192, 4, C.wood3); p.r(X(4), 170, 192, 1, C.wood4); p.r(X(4), 174, 192, 3, C.wood2); p.r(X(4), 177, 192, 1, C.wood0);
  p.r(X(6), 178, 188, 6, C.teal0);
  p.r(X(6), 184, 188, 5, C.teal3); p.r(X(6), 184, 188, 1, '#4b8278'); p.r(X(6), 189, 188, 6, C.teal2);
  for (let x = 14; x < 192; x += 16) { p.p(X(x), 191, C.teal0); p.p(X(x), 190, '#4b8278'); }
  p.r(X(6), 195, 188, 19, C.wood1); p.r(X(6), 195, 188, 1, C.wood0);
  for (let k = 0; k < 5; k++) { const px = X(10 + k * 37); p.r(px, 198, 32, 13, C.wood2); p.r(px, 198, 32, 1, C.wood3); p.r(px, 198, 1, 13, C.wood3); p.r(px, 210, 32, 1, C.wood0); p.r(px + 31, 198, 1, 13, C.wood0); }
  // cushions: a striped one by the cat, a mustard one behind the reader
  p.ell(X(13), 176, 7, 8, '#7a4a5a'); for (let k = -6; k < 7; k += 3) p.r(X(13 + k), 169, 1, 15, '#9a6a6a', 0.6);
  p.ell(X(170), 172, 14, 12, '#b8862e'); p.ell(X(168), 169, 10, 7, '#d8a64a', 0.6); p.ell(X(183), 175, 6, 10, '#9a7026');
  for (const [x, y] of [[164, 168], [172, 174], [168, 178]]) p.p(X(x), y, '#8a6020');
  // things on the sill: a little plant, the reader's mug, a jar candle
  plantPot(p, X(104), 170, rng(41), false);
  p.r(X(115), 164, 6, 6, '#3a6a7a'); p.r(X(115), 164, 6, 1, '#5a8a9a'); p.r(X(121), 165, 2, 3, '#3a6a7a');
  p.r(X(88), 163, 6, 7, '#e8c890', 0.6); p.r(X(89), 163, 4, 1, '#fff0c0'); p.glow(X(91), 161, 8, 7, '#ffcf87', 0.35);

  // the brick side: a chalkboard menu under a picture light, shelves of jars and tins
  p.glow(X(254), 30, 64, 36, '#ffcf87', 0.2);
  p.r(X(206), 16, 96, 50, C.wood3); p.r(X(206), 16, 96, 1, C.wood4); p.r(X(206), 65, 96, 1, C.wood1);
  p.r(X(208), 18, 92, 46, '#1a2420'); p.dz(X(208), 18, 92, 46, '#24302a', 0.3); p.dz(X(208), 18, 92, 10, '#2a3832', 0.25);
  p.text('MENU', X(246), 21, '#d4d6ca'); p.r(X(244), 27, 20, 1, '#a8b2a8', 0.6);
  const menu = [['LATTE', '4.5'], ['ESPRESSO', '3'], ['FLAT WHITE', '4']];
  menu.forEach(([n, pr], k) => { p.text(n, X(212), 31 + k * 7, '#b2b9ac'); p.text(pr, X(296) - pr.length * 4, 31 + k * 7, '#d4a548'); for (let x = X(212) + n.length * 4 + 1; x < X(294) - pr.length * 4; x += 3) p.p(x, 35 + k * 7, '#55645a'); });
  p.r(X(288), 54, 6, 5, '#c8c8be', 0.7); p.r(X(294), 55, 2, 2, '#c8c8be', 0.6); p.p(X(290), 52, '#c8c8be'); p.p(X(291), 51, '#c8c8be'); p.p(X(290), 50, '#c8c8be'); p.r(X(287), 59, 8, 1, '#c8c8be', 0.6);
  p.text('*', X(212), 20, '#d8b060'); p.text('*', X(292), 20, '#d8b060');
  p.r(X(250), 12, 8, 2, C.brass); p.r(X(253), 11, 2, 2, C.brassS); p.r(X(249), 14, 10, 1, '#fff0c0');
  const shelf = (y, x0) => { p.r(X(x0), y, 318 - x0, 2, C.wood3); p.r(X(x0), y, 318 - x0, 1, C.wood4); p.r(X(x0), y + 2, 318 - x0, 2, C.wood1); p.r(X(x0), y + 4, 318 - x0, 1, '#000000', 0.35); p.r(X(x0 + 6), y + 4, 2, 4, C.wood0); p.r(X(310), y + 4, 2, 4, C.wood0); };
  shelf(78, 198); shelf(102, 220);
  const rs = rng(17);
  jar(p, X(201), 78, 8, 11, ['#3a2216', '#5a3420']); jar(p, X(211), 78, 8, 13, ['#4a2a18', '#6a4024']); jar(p, X(221), 78, 7, 10, ['#c89a5a', '#e8c088']);
  for (const [x, c] of [[231, '#2f6a66'], [238, '#a8423a'], [245, '#c8963a']]) { p.r(X(x), 69, 6, 9, c); p.r(X(x), 68, 6, 1, '#d8d0c0'); p.r(X(x), 72, 6, 2, '#efe4cf', 0.7); p.r(X(x), 69, 1, 9, '#ffffff', 0.2); }
  plantPot(p, X(254), 78, rs, false); trailing(p, X(256), 80, 18, rs); trailing(p, X(260), 80, 12, rs);
  for (let k = 0; k < 4; k++) { p.r(X(268), 76 - k * 2, 9, 2, k % 2 ? '#e8e0d0' : '#d8cfc0'); }
  p.r(X(279), 70, 8, 8, '#3a2a22'); p.r(X(280), 71, 6, 6, '#c8a878', 0.4);
  jar(p, X(290), 78, 8, 12, ['#3a2216', '#5a3420']); jar(p, X(300), 78, 8, 9, ['#6a3a2a', '#8a5a3a']); jar(p, X(309), 78, 7, 11, ['#d8c8a0', '#efe0c0']);
  // the radio (its dial glows live), cookies, plates, a cactus, books
  p.r(X(222), 92, 14, 10, C.wood2); p.r(X(222), 92, 14, 1, C.wood3); p.r(X(224), 94, 5, 5, '#2a1a12'); for (let k = 0; k < 3; k++) p.r(X(224), 95 + k * 2, 5, 1, '#3e2a1e'); p.ell(X(232), 96.5, 2.5, 2.5, '#d8c8a0'); p.p(X(232), 96, '#3a2a22'); p.line(X(234), 92, X(238), 86, '#3a3a3a');
  p.r(X(242), 92, 10, 10, '#a8bcc4', 0.35); p.r(X(242), 91, 10, 2, '#5a3a2a'); for (const [x, y] of [[244, 96], [248, 95], [245, 99], [249, 99]]) p.r(X(x), y, 2, 2, '#c8904a');
  for (let k = 0; k < 4; k++) p.r(X(256), 100 - k * 2, 14, 2, k % 2 ? '#c8d8e0' : '#e8eef0');
  p.r(X(275), 96, 6, 6, C.terra); p.r(X(276), 89, 4, 7, '#4a8a4a'); p.p(X(275), 91, '#4a8a4a'); p.p(X(280), 92, '#4a8a4a'); p.p(X(277), 88, '#f08aa8');
  for (let k = 0; k < 4; k++) p.r(X(286), 101 - k * 2, 26 - k * 3, 2, BOOKCOL[(k * 3 + 1) % BOOKCOL.length]);
  // mugs on hooks under the second shelf
  for (let k = 0; k < 6; k++) { const mx = X(223 + k * 8); p.r(mx + 2, 107, 1, 2, '#2a2a2a'); p.r(mx, 109, 5, 5, ['#e8e0d0', '#c86a5a', '#3a6a7a', '#e8c070', '#7a9a6a', '#e8e0d0'][k]); p.r(mx + 5, 110, 1, 2, '#c8c0b0'); p.r(mx, 109, 1, 5, '#ffffff', 0.25); }
  p.glow(X(250), 118, 70, 40, '#ffb35c', 0.12);

  // the pendant lamps hang over the window seat; their light falls on the seat and wall
  for (const lx of LAMPS) { p.glow(X(lx), 44, 40, 30, '#ffcf87', 0.2); p.glow(X(lx), 186, 48, 15, '#ffcf87', 0.34); }

  // in full screen: the rest of the café
  for (const m of L.mods) backModule(p, m, L);
  for (const [a, b] of L.gaps) if (b - a >= 12) { const cx = Math.floor((a + b) / 2); sconce(p, cx, 96); if (b - a >= 18) framedPicture(p, cx - 5, 116, 10, 13, Math.floor(hash(cx) * 8)); }
  return p;
}

function backModule(p, m, L) {
  const x = m.x, r = rng(500 + m.i * 13 + (m.side > 0 ? 7 : 0));
  if (m.t === 'coat') {
    const cx = x + 11;
    p.r(cx - 6, 212, 13, 2, C.wood0); p.line(cx - 6, 213, cx, 206, C.wood1); p.line(cx + 6, 213, cx, 206, C.wood1);
    p.r(cx, 116, 2, 96, C.wood2); p.r(cx, 116, 1, 96, C.wood3); p.ell(cx + 1, 115, 2, 2, C.wood3);
    for (const dx of [-5, 5]) p.line(cx + 1, 122, cx + 1 + dx, 118, C.brass);
    // a trench coat, a scarf, a hat
    p.thick(cx - 3, 124, cx - 5, 158, 3, '#a88a5a'); p.thick(cx - 4, 128, cx - 6, 156, 2, '#8a6e44'); p.r(cx - 6, 140, 6, 1, '#6a5232');
    p.r(cx + 3, 121, 3, 26, '#a83a3a'); for (let y = 124; y < 147; y += 4) p.r(cx + 3, y, 3, 1, '#e8d0b0');
    p.ell(cx + 1, 113, 6, 1.5, '#2a2430'); p.ell(cx + 1, 110, 3.5, 3, '#2a2430'); p.r(cx - 2, 111, 7, 1, '#6a3a3a');
    // the umbrella stand, one umbrella still wet
    p.r(x + 1, 196, 9, 17, '#3a4248'); p.r(x + 1, 196, 9, 1, '#6a7480'); p.r(x + 2, 197, 1, 15, '#5a646e');
    p.line(x + 4, 196, x + 3, 182, '#2a3a5a'); p.ell(x + 3, 181, 2, 1.5, '#5a3a2a', 1);
    p.line(x + 7, 196, x + 9, 184, '#7a2a3a'); p.line(x + 9, 184, x + 10, 183, '#c8a060');
    p.ell(x + 7, 214, 6, 1.5, '#5a6a8a', 0.4);
    p.glow(cx, 160, 20, 40, '#ffcf87', 0.08);
  } else if (m.t === 'door') {
    const dx = x + 4, dw = 46;
    p.r(dx - 2, 82, dw + 4, 132, C.wood1); p.r(dx - 2, 82, dw + 4, 2, C.wood3); p.r(dx - 2, 82, 2, 132, C.wood2); p.r(dx + dw, 82, 2, 132, C.wood0);
    p.r(dx + 2, 86, dw - 4, 7, C.wood0); p.r(dx + dw / 2 - 6, 87, 12, 4, C.brass); p.r(dx + dw / 2 - 6, 87, 12, 1, '#f0d080'); p.text('12', dx + dw / 2 - 4, 87, '#5a3a1a');
    p.clear(dx + 2, 94, dw - 4, 120);
    p.r(dx + 2, 93, dw - 4, 1, C.wood0);
    p.r(dx + 4, 216, dw - 8, 4, '#4a2422'); for (let k = 0; k < dw - 8; k += 3) p.p(dx + 4 + k, 217, '#7a3a32');
    p.glow(dx + dw / 2, 224, 30, 9, '#8090e0', 0.16);
  } else if (m.t === 'table' || m.t === 'table2') {
    const two = m.t === 'table2', face = m.face, tcx = m.tcx;
    // the wall behind: a window onto the street, a little gallery, or a shelf
    if (m.wall === 'window') sideWindow(p, m, x + (two ? 8 : 7), m.w - (two ? 16 : 14), r);
    else if (m.wall === 'shelf') {
      const sx = x + 5, sw = m.w - 10;
      framedPicture(p, face > 0 ? x + 6 : x + m.w - 20, 56, 14, 18, m.print);
      p.r(sx, 108, sw, 2, C.wood3); p.r(sx, 108, sw, 1, C.wood4); p.r(sx, 110, sw, 1, '#000000', 0.4); p.r(sx + 3, 110, 1, 3, C.wood0); p.r(sx + sw - 4, 110, 1, 3, C.wood0);
      let bx = sx + 2;
      while (bx < sx + sw - 8) {
        const k = r();
        if (k < 0.5) { const bw = 2 + Math.floor(r() * 2), bh = 7 + Math.floor(r() * 4); p.r(bx, 108 - bh, bw, bh, pick(r, BOOKCOL)); p.r(bx, 108 - bh, bw, 1, '#ffffff', 0.2); bx += bw; }
        else if (k < 0.75) { plantPot(p, bx, 108, r, false); bx += 10; }
        else { jar(p, bx, 108, 6, 8, pick(r, [['#3a2216', '#5a3420'], ['#c89a5a', '#e8c088']])); bx += 8; }
      }
      trailing(p, sx + sw - 3, 110, 20, r);
    } else if (two) { framedPicture(p, tcx - 11, 84, 22, 17, m.print); framedPicture(p, tcx - 27, 92, 9, 12, m.print + 1); framedPicture(p, tcx + 18, 88, 9, 14, m.print + 2); }
    else { framedPicture(p, tcx - 9, 88, 18, 15, m.print); framedPicture(p, face > 0 ? x + 4 : x + m.w - 13, 64, 9, 11, m.print + 1); }
    // chairs (the guests sit on them, drawn live)
    const chair = (cx, f) => { const bx = cx - 4 * f; p.r(bx - (f > 0 ? 1 : 0), 170, 2, 30, C.wood1); p.r(cx - 5, 198, 11, 2, C.wood2); p.r(cx - 5, 198, 11, 1, C.wood3); p.r(cx - 4, 200, 1, 14, C.wood1); p.r(cx + 4, 200, 1, 14, C.wood1); };
    if (two) { chair(x + 12, 1); chair(x + m.w - 12, -1); } else chair(face > 0 ? x + 12 : x + m.w - 12, face);
    // the table: a round top on a pedestal
    const rx = two ? 10 : 11;
    p.r(tcx - 1, 193, 3, 19, '#1e120c'); p.r(tcx - 6, 212, 13, 2, '#1e120c');
    p.ell(tcx, 191, rx + 1, 3, C.wood1); p.ell(tcx, 190.5, rx, 2.4, C.wood3); p.r(tcx - rx + 2, 189, rx * 2 - 4, 1, C.wood4, 0.6);
    // what's on it (the cups the pair sip from are drawn live)
    const cup = (cx) => { p.r(cx - 2, 184, 5, 5, '#efe4cf'); p.r(cx + 3, 185, 1, 2, '#efe4cf'); p.r(cx - 2, 184, 5, 1, '#8a5a3a'); p.r(cx + 2, 185, 1, 4, '#c9b89c'); p.ell(cx + 0.5, 189.5, 4, 1, '#d8cfc0'); };
    if (two) { p.ell(tcx, 189, 3.5, 1.2, '#e8e0d0'); p.r(tcx - 2, 186, 4, 2, '#7a4a2a'); p.r(tcx - 2, 186, 4, 1, '#c88a4a'); }
    else if (m.prop === 'laptop') { const lx = tcx - 7 * face; p.r(lx - 5, 188, 11, 1, '#9aa3ad'); p.line(lx - 5 * face, 188, lx - 7 * face, 179, '#5a646e'); p.line(lx - 4 * face, 188, lx - 6 * face, 179, '#3a3f48'); cup(tcx + 6 * face); }
    else if (m.prop === 'write') { const nx = tcx - 5 * face; p.r(nx - 4, 187, 9, 2, '#e8e0cc'); p.r(nx - 4, 187, 9, 1, '#fffaf0'); p.r(nx, 187, 1, 2, '#a8a090'); cup(tcx + 6 * face); }
    else if (m.prop === 'knit') { p.ell(tcx + 5 * face, 187, 2.6, 2.2, '#c84a5a'); p.p(tcx + 4 * face, 186, '#e86a7a'); p.line(tcx + 3 * face, 189, tcx - 5 * face, 189, '#c84a5a'); cup(tcx - 3 * face); }
    else if (m.prop === 'paper') { cup(tcx + 2 * face); p.r(tcx - 5 * face - 3, 188, 7, 2, '#c8c0b0'); p.r(tcx - 5 * face - 3, 188, 7, 1, '#e0dace'); }
    else { cup(tcx - 2 * face); p.r(tcx + 3 * face - 3, 188, 7, 2, '#e8e0cc'); p.r(tcx + 3 * face - 3, 188, 7, 1, '#ffffff', 0.5); p.ell(tcx + 3 * face, 187, 2, 1, '#b8783a'); }
  } else if (m.t === 'plant') {
    const cx = x + m.w / 2;
    sconce(p, cx, 92);
    framedPicture(p, cx - 5, 54, 10, 13, m.print);
    p.r(cx - 6, 196, 12, 18, C.terra); p.r(cx - 7, 194, 14, 3, '#b8664a'); p.r(cx + 3, 197, 3, 17, C.terraS);
    const tall = (m.i + (m.side > 0 ? 1 : 0)) % 2 === 0;
    for (let i = 0; i < (tall ? 16 : 11); i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * (tall ? 1.4 : 2.4), len = (tall ? 20 : 10) + r() * (tall ? 34 : 16);
      const ex = cx + Math.cos(a) * len, ey = 194 + Math.sin(a) * len;
      p.line(cx, 194, ex, ey, C.leaf0);
      if (tall) p.ell(ex, ey, 4, 3, pick(r, [C.leaf1, C.leaf2, C.leaf2, C.leaf3]));
      else p.thick(cx + (ex - cx) * 0.3, 194 + (ey - 194) * 0.3, ex, ey, 1.2, pick(r, [C.leaf1, C.leaf2, C.leaf3]));
    }
  } else if (m.t === 'shelf') {
    framedPicture(p, x + 8, 54, 22, 16, m.print);
    for (const y of [102, 128]) {
      p.r(x + 4, y, m.w - 8, 2, C.wood3); p.r(x + 4, y, m.w - 8, 1, C.wood4); p.r(x + 4, y + 2, m.w - 8, 1, '#000000', 0.4);
      let bx = x + 6;
      while (bx < x + m.w - 12) {
        const k = r();
        if (k < 0.5) { const bw = 2 + Math.floor(r() * 3), bh = 8 + Math.floor(r() * 6); p.r(bx, y - bh, bw, bh, pick(r, BOOKCOL)); p.r(bx, y - bh, bw, 1, '#ffffff', 0.2); bx += bw; }
        else if (k < 0.7) { plantPot(p, bx + 1, y, r, false); bx += 11; }
        else { p.r(bx + 1, y - 6, 6, 6, '#e8e0d0'); p.r(bx + 7, y - 5, 1, 3, '#e8e0d0'); bx += 10; }
      }
    }
    // a floor lamp beside the shelves
    const lx = x + m.w - 7;
    p.glow(lx, 146, 24, 22, '#ffcf87', 0.32); p.glow(lx, 212, 18, 4, '#ffcf87', 0.3);
    p.r(lx, 148, 1, 64, '#1a1210'); p.r(lx - 4, 211, 9, 2, '#1a1210'); p.r(lx - 3, 210, 7, 1, '#2a1f1a');
    for (let k = 0; k < 11; k++) { const half = 4 + k * 0.45; p.r(Math.round(lx - half), 136 + k, Math.round(half * 2) + 1, 1, k < 2 ? '#f6e0b0' : '#e8c890'); }
    for (let k = -6; k <= 6; k += 3) p.line(lx + Math.round(k * 0.5), 137, lx + k, 146, '#d0a868');
    p.r(lx - 9, 147, 19, 1, '#a07838');
  } else if (m.t === 'books') {
    const bx = x + 3, bw = m.w - 6;
    p.r(bx, 70, bw, 144, C.wood1); p.r(bx + 2, 72, bw - 4, 140, '#1c100b');
    p.r(bx, 70, bw, 1, C.wood3); p.r(bx, 70, 1, 144, C.wood2); p.r(bx + bw - 1, 70, 1, 144, C.wood0);
    for (let y = 96; y <= 210; y += 23) {
      p.r(bx + 1, y, bw - 2, 2, C.wood2); p.r(bx + 1, y, bw - 2, 1, C.wood3);
      let k = bx + 3;
      while (k < bx + bw - 4) {
        const w = 2 + Math.floor(r() * 3), h = 12 + Math.floor(r() * 8);
        if (r() < 0.1 && k < bx + bw - 10) { plantPot(p, k, y, r, false); k += 10; continue; }
        if (r() < 0.07) { k += 3; continue; }
        p.r(k, y - h, w, h, pick(r, BOOKCOL)); p.r(k, y - h, w, 1, '#ffffff', 0.18); p.r(k + w - 1, y - h, 1, h, '#000000', 0.25);
        if (r() < 0.3) p.r(k, y - h + 3, w, 1, '#e8c070', 0.6);
        k += w;
      }
    }
    plantPot(p, bx + 4, 70, r, true); trailing(p, bx + bw - 6, 70, 26, r); trailing(p, bx + bw - 3, 70, 16, r);
    p.r(bx + 18, 64, 8, 6, '#c8b090'); p.r(bx + 19, 62, 6, 2, '#a89070');
    p.glow(bx + bw / 2, 140, 24, 50, '#ffcf87', 0.07);
  } else if (m.t === 'board') {
    const bx = x + 4, bw = m.w - 8, cx = x + m.w / 2;
    // a cork board of flyers and photos
    p.r(bx, 64, bw, 40, C.wood2); p.r(bx, 64, bw, 1, C.wood3); p.r(bx + 1, 65, bw - 2, 38, '#a8784a'); p.dz(bx + 1, 65, bw - 2, 38, '#8a5e36', 0.3);
    for (let k = 0; k < 7; k++) {
      const fw = 6 + Math.floor(r() * 5), fh = 7 + Math.floor(r() * 4), fx = bx + 2 + Math.floor(r() * (bw - fw - 3)), fy = 67 + Math.floor(r() * (34 - fh)), c = pick(r, ['#efe6d2', '#f2c14e', '#8ad0c8', '#f08aa8', '#e8e8e8']);
      p.r(fx + 1, fy + 1, fw, fh, '#000000', 0.25); p.r(fx, fy, fw, fh, c); p.r(fx + 1, fy + 2, fw - 2, 1, '#6a5a4a', 0.6); p.r(fx + 1, fy + 4, fw - 3, 1, '#6a5a4a', 0.4);
      p.p(fx + (fw >> 1), fy, pick(r, ['#d83a3a', '#3a7ad8', '#e8c040']));
    }
    const qx = bx + bw - 11; p.r(qx, 70, 8, 9, '#f6f2ea'); p.r(qx + 1, 71, 6, 5, '#3a5a7a'); p.r(qx + 1, 74, 6, 2, '#5a8a4a'); p.p(qx + 4, 72, '#ffe0a0');
    // a hanging plant from the ceiling
    p.line(cx, 11, cx - 4, 30, '#c8b48a'); p.line(cx, 11, cx + 4, 30, '#c8b48a');
    p.ell(cx, 33, 6, 4, C.terra); p.r(cx - 6, 30, 12, 2, '#b8664a');
    trailing(p, cx - 4, 34, 20, r); trailing(p, cx + 3, 34, 14, r);
    for (let k = 0; k < 7; k++) p.ell(cx - 5 + k * 1.6, 29 - (k % 3), 2.2, 1.6, pick(r, [C.leaf2, C.leaf3, C.leaf1]));
    // a radiator under it, mittens drying on top and a mug keeping warm
    const rx = x + 6, rw = m.w - 12;
    p.glow(rx + rw / 2, 188, rw * 0.8, 18, '#ff9a5a', 0.1);
    p.r(rx, 176, rw, 28, '#7a7e86'); for (let k = 0; k < rw; k += 3) { p.r(rx + k, 176, 2, 28, '#9a9ea6'); p.r(rx + k, 176, 1, 28, '#b8bcc4'); }
    p.r(rx - 1, 175, rw + 2, 2, '#5a5e66'); p.r(rx, 204, 2, 9, '#4a4e56'); p.r(rx + rw - 2, 204, 2, 9, '#4a4e56');
    p.r(rx + 3, 169, 5, 7, '#c84a5a'); p.r(rx + 3, 169, 5, 1, '#e86a7a'); p.r(rx + 9, 170, 5, 6, '#c84a5a'); p.r(rx + 9, 173, 5, 1, '#e8d0b0'); p.r(rx + 3, 172, 5, 1, '#e8d0b0');
    p.r(rx + rw - 9, 169, 5, 6, '#e8e0d0'); p.r(rx + rw - 4, 171, 1, 2, '#e8e0d0'); p.r(rx + rw - 9, 169, 5, 1, '#6a3a1a');
  } else if (m.t === 'case') {
    // a round clock on the brick
    p.ell(x + 19, 44, 10, 10, '#1a1210'); p.ell(x + 19, 44, 8.5, 8.5, '#efe6d2');
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.p(x + 19 + Math.cos(a) * 7 - 0.5, 44 + Math.sin(a) * 7 - 0.5, k % 3 ? '#a89a80' : '#3a2a22'); }
    p.glow(x + 19, 120, 30, 40, '#ffb35c', 0.1);
  }
}

// the counter, the espresso machine, the plant and stool in front: drawn over the barista
function buildMid(BW, L) {
  const p = painter(BW, H), ox = L.ox, X = (x) => ox + x;
  const c0 = X(196), c1 = L.counterEnd;
  // things on the counter, behind its front edge
  p.r(X(199), 146, 16, 12, '#2a2a32'); p.r(X(199), 146, 16, 1, '#4a4a56'); p.r(X(201), 141, 12, 6, '#1e1e26'); p.r(X(202), 142, 8, 3, '#5ae0a0'); p.glow(X(206), 143, 8, 5, '#5ae0a0', 0.2);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) p.p(X(201 + j * 3), 149 + k * 3, '#d8d0c0');
  p.r(X(216), 151, 5, 7, '#a8bcc4', 0.45); p.r(X(216), 155, 5, 3, '#c8a050', 0.7); p.r(X(216), 150, 5, 1, '#d8e0e4', 0.6);
  // a cake under a glass dome
  p.r(X(246), 156, 16, 2, '#d8d0c0'); p.r(X(253), 152, 2, 4, '#d8d0c0');
  p.r(X(248), 146, 12, 6, '#f2d8c8'); p.r(X(248), 148, 12, 1, '#c84a5a'); p.r(X(248), 150, 12, 1, '#c84a5a'); p.r(X(248), 146, 12, 1, '#ffffff'); p.p(X(251), 145, '#d83a4a'); p.p(X(256), 145, '#d83a4a');
  p.ell(X(254), 146, 9, 10, '#c8e0e8', 0.18); p.ell(X(254), 146, 8, 9, '#c8e0e8', 0.06); p.r(X(249), 139, 1, 6, '#ffffff', 0.5); p.r(X(253), 135, 2, 2, '#c8e0e8', 0.5);
  // the espresso machine
  const m = X(264);
  p.r(m + 1, 126, 40, 4, C.steel2); p.r(m + 1, 126, 40, 1, C.steel4);
  for (let k = 0; k < 4; k++) { p.r(m + 4 + k * 9, 120, 6, 6, '#efe4cf'); p.r(m + 4 + k * 9, 120, 6, 1, '#ffffff'); p.r(m + 9 + k * 9, 121, 1, 5, '#c9b89c'); }
  p.r(m + 2, 130, 38, 26, C.steel1); p.r(m + 2, 130, 1, 26, C.steel3); p.r(m + 38, 130, 2, 26, C.steel0);
  for (let k = 0; k < 5; k++) p.r(m + 6 + k * 7, 131, 1, 10, C.steel2, 0.6);
  p.r(m + 4, 132, 34, 9, C.steel2); p.r(m + 4, 132, 34, 1, C.steel4); p.r(m + 15, 134, 12, 3, '#b8743a'); p.r(m + 15, 134, 12, 1, '#e0a060');
  p.ell(m + 33, 136.5, 3.5, 3.5, '#22252c'); p.ell(m + 33, 136.5, 2.6, 2.6, '#f2f2ea');
  for (const gx of [m + 8, m + 24]) { p.r(gx, 142, 7, 3, C.steel0); p.r(gx + 1, 141, 5, 1, C.steel3); p.r(gx + 6, 144, 8, 2, '#1a1414'); p.r(gx + 6, 144, 8, 1, '#3a3030'); p.r(gx + 2, 145, 1, 2, C.steel0); p.r(gx + 4, 145, 1, 2, C.steel0); }
  p.r(m + 9, 150, 5, 4, '#efe4cf'); p.r(m + 9, 150, 5, 1, '#6a3a1a');
  p.r(m + 4, 154, 34, 4, C.steel0); for (let k = 0; k < 34; k += 2) p.r(m + 4 + k, 155, 1, 2, C.steel1);
  p.line(m + 2, 134, m - 2, 150, C.steel3); p.r(m - 3, 150, 2, 3, C.steel2);
  // the grinder
  p.r(X(307), 136, 11, 22, '#3a3238'); p.r(X(307), 136, 1, 22, '#5a5058'); p.r(X(308), 124, 9, 12, '#a8bcc4', 0.35); p.dz(X(309), 128, 7, 8, '#4a2a18', 0.8); p.r(X(308), 122, 9, 2, '#2a2228'); p.r(X(309), 148, 7, 6, '#1e1a1e');
  // the counter itself
  p.r(c0, 158, c1 - c0, 2, C.wood4); p.r(c0, 158, c1 - c0, 1, '#b07a44'); p.r(c0, 160, c1 - c0, 4, C.wood3); p.r(c0, 164, c1 - c0, 1, C.wood0);
  p.r(c0, 165, c1 - c0, 49, C.wood1);
  for (let x = c0 + 2; x < c1 - 1; x += 5) { p.r(x, 166, 1, 36, C.wood0); p.r(x + 1, 166, 1, 36, C.wood2, 0.45); }
  p.r(c0, 202, c1 - c0, 2, C.brass); p.r(c0, 202, c1 - c0, 1, '#e8c070'); p.r(c0, 204, c1 - c0, 10, '#1f120b');
  for (let x = c0 + 10; x < c1; x += 34) p.r(x, 204, 2, 4, C.brassS);
  p.r(c0 - 2, 156, 3, 58, C.wood2); p.r(c0 - 2, 156, 1, 58, C.wood3);
  if (c1 >= X(CORE) + 10) { p.r(c1 - 1, 156, 3, 58, C.wood2); p.r(c1 + 1, 156, 1, 58, C.wood0); }   // the counter's end, in full screen
  p.glow(X(260), 168, 70, 14, '#ffcf87', 0.12);
  // the pastry case at the end of the counter (full screen)
  const cm = L.mods.find((q) => q.t === 'case');
  if (cm) {
    const x = cm.x + 2;
    p.r(x, 154, 30, 4, C.wood2); p.r(x, 154, 30, 1, C.wood3);
    p.glow(x + 15, 145, 20, 12, '#ffd89a', 0.4);
    p.r(x + 1, 133, 28, 21, '#ffe8c0', 0.12); p.r(x + 1, 143, 28, 1, '#c8d8e0', 0.6);
    for (let k = 0; k < 3; k++) { const cx = x + 4 + k * 9; p.ell(cx + 2, 141, 3.5, 2, '#d8963c'); p.r(cx, 140, 5, 1, '#f0b860'); p.p(cx + 2, 141, '#a86a2a'); }
    for (let k = 0; k < 3; k++) { const cx = x + 3 + k * 9; p.r(cx, 148, 6, 5, k === 1 ? '#5a3020' : '#f2d8c8'); p.r(cx, 149, 6, 1, k === 1 ? '#e8c070' : '#c84a5a'); p.r(cx, 148, 6, 1, '#ffffff', 0.5); }
    p.r(x, 132, 30, 1, C.steel3); p.r(x, 132, 1, 22, C.steel3, 0.6); p.r(x + 29, 132, 1, 22, C.steel3, 0.6);
    p.r(x + 3, 134, 1, 8, '#ffffff', 0.5); p.r(x + 5, 134, 1, 4, '#ffffff', 0.3);
  }
  // a stool for the guest at the counter
  p.ell(X(233), 191, 9, 2.5, C.wood3); p.r(X(225), 190, 17, 1, C.wood4); p.r(X(226), 193, 1, 21, '#1a1010'); p.r(X(240), 193, 1, 21, '#1a1010'); p.r(X(233), 193, 1, 21, '#241612');
  p.r(X(226), 205, 15, 1, C.brass);
  // a big monstera between the window and the counter
  p.r(X(186), 198, 18, 16, C.terra); p.r(X(185), 196, 20, 3, '#b8664a'); p.r(X(199), 199, 5, 15, C.terraS); p.r(X(186), 198, 18, 1, '#c8765a');
  const rp = rng(9), base = X(195);
  const leaves = [[-1.75, 20, 34, 4.2], [-2.25, 16, 30, 3.8], [-1.25, 18, 30, 3.8], [-2.7, 8, 24, 3.4], [-0.75, 10, 26, 3.4], [-1.95, 6, 22, 3.2], [-1.45, 6, 24, 3.2], [-3.0, 2, 18, 3], [-0.35, 3, 18, 3]];
  for (const [a, stem, len, wid] of leaves) {
    const sx = base + Math.cos(a) * stem, sy = 196 + Math.sin(a) * stem;
    p.line(base, 196, sx, sy, C.leaf1);
    blade(p, sx, sy, a, len, wid, pick(rp, [C.leaf1, C.leaf2, C.leaf2]));
  }
  return p;
}

// your table and what's on it, and what stands close by on the floor in full screen
function buildFront(BW, L) {
  const p = painter(BW, H), ox = L.ox, X = (x) => ox + x;
  const tl = Math.max(-4, X(-6)), tr = Math.min(BW + 4, X(CORE + 6));
  p.r(tl - 4, 240, tr - tl + 8, 6, '#000000', 0.3);
  p.r(tl, 244, tr - tl, H - 244, '#5e3820');
  for (let y = 248; y < H; y += 5) for (let k = 0; k < (tr - tl) / 40; k++) {
    const gx = tl + Math.floor(hash(k, y) * (tr - tl)), gl = 10 + Math.floor(hash(y, k) * 40);
    p.r(gx, y + Math.floor(hash(k + 3, y) * 4), gl, 1, hash(k, y + 1) < 0.5 ? '#4e2e1a' : '#6e4428', 0.8);
  }
  for (let y = 252; y < H; y += 17) p.r(tl, y, tr - tl, 1, '#3e2414', 0.5);
  p.r(tl, 244, tr - tl, 1, '#1e0f08'); p.r(tl, 245, tr - tl, 1, '#a8743e'); p.r(tl, 246, tr - tl, 1, '#7e5030');
  if (tl > 0) { p.r(tl, 244, 3, H - 244, '#3a2213'); p.r(tl, 244, 1, H - 244, '#1e0f08'); p.clear(tl, 244, 1, 1); }
  if (tr < BW) { p.r(tr - 3, 244, 3, H - 244, '#3a2213'); p.r(tr - 1, 244, 1, H - 244, '#1e0f08'); p.clear(tr - 1, 244, 1, 1); }
  // light: the lamp overhead and the window's cool spill (the candle's pool is drawn live)
  p.glow(X(160), 262, 170, 42, '#ffcf87', 0.16);
  p.glow(X(60), 250, 90, 12, '#7a86e0', 0.1);
  p.haze(300, H, '#000000', 0, 0.25);
  // a paper napkin under the croissant's plate, set a little askew
  for (let y = 282; y < 302; y++) {
    const sh = Math.round((302 - y) * 0.45), a = X(13) + sh, b = X(64) + sh, edge = y === 282 || y === 301;
    p.r(a, y, b - a, 1, edge ? '#b8584e' : '#d2c6ae'); p.p(a, y, '#b8584e'); p.p(b - 1, y, '#b8584e');
    if (y === 284 || y === 299) p.r(a + 2, y, b - a - 4, 1, '#c27a6c', 0.6);
    p.p(a + Math.round((y - 282) * 1.3) + 6, y, '#bcae94');
  }
  // the croissant's plate
  const qx = X(PLATE.x), qy = PLATE.y;
  p.ell(qx, qy + 3, 22, 7, '#000000', 0.25); p.ell(qx, qy, 22, 7, '#d4ccc0'); p.ell(qx, qy - 0.5, 21, 6, '#e8e1d5'); p.ell(qx, qy, 14, 3.5, '#dad2c5');
  // two sugar cubes
  for (const [sx, sy] of [[68, 302], [73, 305]]) { p.r(X(sx), sy + 3, 5, 1, '#000000', 0.3); p.r(X(sx), sy, 4, 3, '#e8e1d5'); p.r(X(sx), sy, 4, 1, '#f8f4ec'); p.r(X(sx) + 3, sy + 1, 1, 2, '#c4baa8'); }
  // the open book, a little askew, its pages bowing up towards the spine
  const bx = X(BOOK.x), by = BOOK.y, tiltY = (u) => -Math.round(u * 0.035);
  for (let u = -3; u < 99; u++) {
    const y = by + tiltY(Math.max(0, Math.min(95, u)));
    p.r(bx + u, y + 42, 1, 3, '#000000', 0.3);
    p.r(bx + u, y + 3, 1, 39, u === -3 || u === 98 ? '#3e1616' : '#5a2424'); p.p(bx + u, y + 41, '#3a1414');
  }
  for (let u = 0; u < 96; u++) {
    const y = by + bookY(u), lift = tiltY(u) - bookY(u), sp = Math.abs(u - 47.5);
    for (let k = 0; k < 4 + lift; k++) p.p(bx + u, y + 36 + k, k % 2 ? '#a89a7c' : '#c4b898');
    p.r(bx + u, y, 1, 36, '#d6cab0');
    p.p(bx + u, y, '#e4d8be');
    if (sp < 6) p.r(bx + u, y + 1, 1, 35, '#a8987a', (6 - sp) / 6 * 0.7);
    else if (u < 3 || u > 92) p.r(bx + u, y + 1, 1, 35, '#c2b598');
  }
  p.r(bx + 47, by + bookY(47), 2, 38, '#8a7c62');
  p.r(bx + 62, by + bookY(62) + 39, 2, 9, '#a83a3a'); p.p(bx + 62, by + bookY(62) + 48, '#a83a3a');
  // the saucer, over the book's corner, and its spoon
  const sx = X(CUP.x + 14);
  p.ell(sx, 300, 25, 7, '#000000', 0.3);
  p.ell(sx, 297, 24, 7, '#cbc2b4'); p.ell(sx, 296, 23, 6, '#e2dbcf'); p.ell(sx, 296.5, 14, 3.6, '#cfc6b9'); p.ell(sx, 296, 12, 3, '#d9d1c4');
  p.r(X(CUP.x - 8), 294, 6, 1, '#ffffff', 0.5);
  p.line(X(CUP.x + 30), 299, X(CUP.x + 39), 292, '#b8bec6'); p.line(X(CUP.x + 30), 300, X(CUP.x + 38), 294, '#8a9098'); p.ell(X(CUP.x + 40), 291, 2.2, 1.3, '#c8ced6');
  // the candle in its holder
  const cx = X(CANDLE);
  p.ell(cx, 293, 12, 4, '#000000', 0.3); p.ell(cx, 290, 11, 3.5, C.brassS); p.ell(cx, 289, 10, 3, C.brass); p.r(cx - 9, 288, 4, 1, '#f0d080');
  p.r(cx - 5, 266, 10, 23, '#e6d8bc'); p.r(cx + 2, 266, 3, 23, '#cbbb9a'); p.r(cx - 5, 266, 1, 23, '#f4e8d0');
  p.r(cx - 5, 265, 10, 2, '#f2e4c8'); p.r(cx - 6, 267, 2, 6, '#e6d8bc'); p.r(cx + 4, 268, 2, 4, '#ddcfb2');
  // a bud vase with a sprig
  const vx = X(VASE);
  p.ell(vx + 3.5, 288, 5, 1.5, '#000000', 0.25); p.r(vx, 270, 7, 18, '#5a8a9a', 0.6); p.r(vx + 1, 262, 5, 8, '#5a8a9a', 0.6); p.r(vx, 270, 1, 18, '#ffffff', 0.4);
  p.line(vx + 3, 262, vx + 2, 236, C.leaf1); p.line(vx + 3, 250, vx + 9, 240, C.leaf1);
  p.ell(vx, 246, 2, 1.2, C.leaf2); p.ell(vx + 6, 252, 2, 1.2, C.leaf2);
  for (const [fx, fy, c] of [[2, 234, '#f08aa8'], [10, 238, '#f8b8c8']]) { p.ell(vx + fx, fy, 2.5, 2.5, c); p.p(vx + fx, fy, '#ffe070'); }

  // close by. In the square, a dark frond rises into the corner; in full screen, furniture and
  // things on the floor either side
  if (!L.fg.some((q) => q.side > 0)) {
    const q = painter(BW, H), base = X(340);
    for (const [a, len, wid] of [[-1.98, 118, 8], [-2.2, 86, 7], [-1.8, 96, 7], [-2.42, 64, 6]]) blade(q, base, 334, a, len, wid, '#0c110e', '#16201a');
    rim(q, '#3a3226', '#241f18');
    p.stamp(q, 0, 0);
  }
  for (const q of L.fg) fgProp(p, q, BW);
  return p;
}

// light catching the upper and left edges of a dark shape
function rim(q, top, side) {
  const on = [];
  for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.solid(x, y)) { if (!q.solid(x, y - 1)) on.push(x, y, top); else if (!q.solid(x - 1, y)) on.push(x, y, side); }
  for (let i = 0; i < on.length; i += 3) q.p(on[i], on[i + 1], on[i + 2]);
}

function fgProp(p, q, BW) {
  const x = Math.round(q.x);
  if (q.kind === 'chair') {
    // the armchair, painted on its own so only it gets an outline
    const a = painter(BW, H), ax = x - 30, V0 = '#16302c', V1 = '#1f3d38', V2 = '#2c524c', V3 = '#3d6a62';
    p.ell(x, 318, 38, 6, '#000000', 0.35);
    a.r(ax, 240, 60, 80, V1); a.ell(ax + 30, 242, 30, 9, V1);
    a.tint(ax + 44, 230, 16, 90, V2); a.tint(ax, 230, 8, 90, V0);
    a.ell(ax + 30, 238, 27, 5, V2); a.r(ax + 6, 234, 48, 1, V3);
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) { const tx = ax + 9 + k * 14 + (j % 2) * 7, ty = 252 + j * 16; if (tx < ax + 56) { a.p(tx, ty, '#0e1e1c'); a.p(tx, ty - 1, V3); a.line(tx - 6, ty + 7, tx, ty, V0); a.line(tx + 6, ty + 7, tx, ty, V0); } }
    a.r(ax - 8, 268, 12, 52, V0); a.ell(ax - 2, 268, 6, 5, V1); a.r(ax - 7, 266, 9, 1, V2);
    a.r(ax + 56, 268, 12, 52, V1); a.r(ax + 62, 268, 6, 52, V2); a.ell(ax + 62, 268, 6, 5, V3); a.r(ax + 57, 266, 9, 1, '#5a8a80');
    // a knitted blanket slung over the back
    a.r(ax + 30, 236, 22, 44, '#b8862e'); a.ell(ax + 41, 237, 11, 4, '#c8963a');
    for (let y = 240; y < 280; y += 4) a.r(ax + 30, y, 22, 1, '#9a6c24');
    for (let xx = ax + 32; xx < ax + 52; xx += 5) a.r(xx, 238, 1, 42, '#d0a044');
    for (let xx = ax + 30; xx < ax + 52; xx += 2) a.r(xx, 280, 1, 3, '#d8a64a');
    a.outline('#080d0c');
    p.stamp(a, 0, 0);
  } else if (q.kind === 'plant') {
    const rp = rng(88);
    p.ell(x, 318, 26, 5, '#000000', 0.35);
    p.r(x - 14, 286, 28, 34, '#4a3026'); p.r(x - 16, 282, 32, 5, '#5e3e30'); p.r(x - 16, 282, 32, 1, '#7a5040'); p.r(x + 6, 287, 8, 33, '#2a1c18');
    for (let y = 292; y < 320; y += 6) p.r(x - 14, y, 28, 1, '#3a2620');
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI / 2 + (rp() - 0.5) * 2.8, stem = 6 + rp() * 16, len = 30 + rp() * 34;
      const sx = x + Math.cos(a) * stem, sy = 283 + Math.sin(a) * stem;
      p.line(x, 283, sx, sy, '#10251a');
      blade(p, sx, sy, a, len, 4 + rp() * 2.5, pick(rp, ['#163222', '#1d4029', '#24502f']), '#3a6a42');
    }
  } else if (q.kind === 'dog') {
    // the dog's cushion (the dog sleeps on it, drawn live)
    p.glow(x, 300, 34, 14, '#ffcf87', 0.16);
    p.ell(x, 309, 25, 6, '#000000', 0.35);
    p.ell(x, 305, 23, 6, '#6a3440'); p.ell(x, 304, 21, 4.5, '#8a4652'); p.r(x - 18, 302, 36, 1, '#aa6a72', 0.7);
  } else if (q.kind === 'books' || q.kind === 'books2') {
    const rb = rng(x * 7 + 3), n = q.kind === 'books' ? 4 : 3;
    p.ell(x, 319, 18, 3, '#000000', 0.35);
    let y = 319;
    for (let k = 0; k < n; k++) {
      const w = 24 - k * 2 - Math.floor(rb() * 3), h = 5 + Math.floor(rb() * 2), x0 = Math.round(x - w / 2 + (rb() - 0.5) * 4), c = pick(rb, BOOKCOL);
      y -= h;
      p.r(x0, y, w, h, c); p.r(x0, y, w, 1, mixHex(c, '#ffffff', 0.25)); p.r(x0, y + h - 1, w, 1, mixHex(c, '#000000', 0.45));
      p.r(x0 + w - 4, y + 1, 3, h - 2, '#d8ccb0'); p.r(x0 + w - 4, y + 1, 3, 1, '#ece2cc');
    }
    if (q.kind === 'books') { p.r(x - 3, y - 7, 7, 7, '#c86a5a'); p.r(x + 4, y - 6, 2, 4, '#c86a5a'); p.r(x - 3, y - 7, 7, 1, '#3a1a10'); p.r(x - 3, y - 6, 1, 6, '#e08a7a'); p.r(x + 2, y - 6, 1, 6, '#9a4a3a'); }
    else { p.r(x - 4, y - 6, 8, 6, C.terra); p.r(x - 5, y - 7, 10, 2, '#b8664a'); for (let k = 0; k < 5; k++) p.ell(x - 4 + k * 2, y - 9 - (k % 2), 1.6, 2.4, k % 2 ? C.leaf3 : C.leaf2); }
  } else if (q.kind === 'chairback') {
    // a chair's back in silhouette, close to us
    // a bentwood chair's back in silhouette, close to us: two posts, a curved top rail, a waisted splat
    const c = '#100906', hi = '#3a2416', q = painter(40, 72), o = 20;
    q.r(o - 15, 8, 5, 64, c); q.r(o + 10, 8, 5, 64, c);
    for (let k = -17; k <= 17; k++) { const yy = 2 + Math.round((k * k) / 58); q.r(o + k, yy, 1, 8, c); }
    for (let y = 10; y < 72; y++) { const t = (y - 10) / 62, half = Math.round(5 - Math.sin(t * Math.PI) * 2.5); q.r(o - half, y, half * 2 + 1, 1, c); }
    q.r(o - 13, 48, 26, 4, c);
    rim(q, hi, '#24160e');
    p.stamp(q, x - o, 248);
  }
}

// the dark falling off at the edges (smooth, so it never lays a dot pattern over the picture)
function buildVignette(BW) {
  const p = painter(BW, H), cx = BW / 2, cy = H * 0.45;
  for (let y = 0; y < H; y++) for (let x = 0; x < BW; x++) {
    const dx = (x - cx) / (BW * 0.6), dy = (y - cy) / (H * 0.64), q = Math.sqrt(dx * dx + dy * dy) - 0.56;
    if (q > 0) p.p(x, y, '#05030a', Math.min(0.55, q * 1.05));
  }
  return p.canvas();
}

/* ——— sprites (made once) ——— */

const GV = [
  { hair: '#2a1a18', skin: '#e2b08a', top: '#3a6a5a', pants: '#2a2a3e', long: true },
  { hair: '#6a3a22', skin: '#c88a64', top: '#7a4a6a', pants: '#3a3030', long: false, glasses: true },
  { hair: '#c8a060', skin: '#f0c8a0', top: '#c88a3a', pants: '#2a3040', long: true },
  { hair: '#1a1a24', skin: '#8a5a3a', top: '#4a5a8a', pants: '#2a2a2a', long: false, beanie: '#c84a4a' },
  { hair: '#8a3a2a', skin: '#f0c0a0', top: '#8a3a3a', pants: '#2a2a3e', long: true, glasses: true },
  { hair: '#3a3a40', skin: '#d8a07a', top: '#5a6a3a', pants: '#3a3a4a', long: false },
  { hair: '#e8d8c0', skin: '#e8b890', top: '#3a4a6a', pants: '#2a2a32', long: false, glasses: true },
  { hair: '#4a2a1a', skin: '#b87a54', top: '#b8a07a', pants: '#3a2a2a', long: true, beanie: '#3a6a8a' },
];
const rimOf = (n) => mixHex(n.tube, '#cfe0ff', 0.5);

let SPR = null;
function sprites() {
  if (SPR) return SPR;
  SPR = {
    cat: NEON.map((n) => [0, 1].map((b) => [0, 1].map((e) => [0, 1].map((t) => catFrame(b, e, t, rimOf(n)))))),
    reader: NEON.map((n) => [[0, 0], [1, 0], [0, 1]].map(([t, nd]) => readerFrame(t, nd, rimOf(n)).canvas())),
    croissant: [0, 1, 2, 3].map(croissantSprite),
    barista: {}, sign: NEON.map((n, i) => signSprite(n, NEON[(i + 1) % NEON.length])),
    spill: NEON.map((n) => { const p = painter(132, 40); p.glow(66, 20, 65, 19, n.glow, 0.34, 5); return p.canvas(); }),
    cups: [0, 1, 2, 3, 4].map(cupSprite), arm: armSprite(),
    stool: [0, 1].map((b) => stoolGuest(b).canvas()),
    puffs: [3, 4, 5, 6, 8].map((r) => puffSprite(r)),
    cars: ['#8a2a36', '#2a6a72', '#d8a531', '#b8bcc6', '#2a3466', '#3a3a44'].map((c) => carSprite(c)),
    dog: [0, 1].map(dogFrame),
    guests: new Map(), walk: new Map(), umb: new Map(),
  };
  for (const arm of [0, 1, 2]) for (const blink of [0, 1]) SPR.barista[`${arm}${blink}`] = baristaFrame(arm, blink).canvas();
  return SPR;
}

// the cat sits on the window seat watching the street, its edges lit by the window and the sign
function catFrame(breath, turn, tail, rimC) {
  const p = painter(26, 28);
  const O = '#e39a4c', D = '#b8703a', Lt = '#f7c27c', K = '#3a2010', W = '#f6e9d6';
  const b = breath ? 0.6 : 0;
  p.thick(17, 25.5, 22, 25, 1.5, D); p.thick(22, 25, 23.5, 21 - tail * 2, 1.4, D); p.thick(23.5, 21 - tail * 2, 22.5, 18 - tail * 3, 1.2, D);
  p.ell(12, 19, 7.4 + b, 8.2, O);
  p.ell(12, 23.5, 8.6 + b, 4.2, O);
  const hx = 12 - turn;
  p.r(hx - 2, 10, 5, 4, O);
  p.ell(hx, 8.5, 5.6, 5, O);
  p.r(hx - 5, 3, 3, 3, O); p.r(hx - 5, 2, 2, 1, O); p.p(hx - 5, 1, O);
  p.r(hx + 3, 3, 3, 3, O); p.r(hx + 4, 2, 2, 1, O); p.p(hx + 5, 1, O);
  for (const dx of [-2, 0, 2]) p.tint(hx + dx, 4, 1, 3, D);
  for (const y of [14, 17, 20]) { p.tint(4, y, 4, 1, D); p.tint(16, y, 5, 1, D); p.tint(10, y + 1, 4, 1, D, 0.5); }
  p.tint(17, 11, 6, 17, D); p.tint(5, 13, 2, 10, Lt);
  if (turn) { p.r(hx - 6, 8, 2, 3, O); p.p(hx - 5, 8, K); p.p(hx - 6, 10, '#e07a7a'); p.r(hx - 6, 11, 2, 1, W); p.p(hx - 8, 10, W); p.p(hx - 8, 11, W); }
  // the window behind catches the top edges
  const rimPx = [];
  for (let y = 0; y < 28; y++) for (let x = 0; x < 26; x++) if (p.solid(x, y) && !p.solid(x, y - 1)) rimPx.push(x, y);
  for (let i = 0; i < rimPx.length; i += 2) p.p(rimPx[i], rimPx[i + 1], rimC);
  p.outline(K);
  return p.canvas();
}

function croissantSprite(n) {
  const p = painter(34, 16);
  const segs = [[-0.95, 2.6, 2.4], [-0.5, 3.8, 3.6], [0, 4.6, 4.4], [0.5, 3.8, 3.6], [0.95, 2.6, 2.4]];
  segs.forEach(([a, rx, ry], k) => {
    if (k >= n + 2) return;
    const cx = 17 + Math.sin(a) * 11, cy = 9 - Math.cos(a) * 3.4 + 2;
    p.ell(cx, cy, rx, ry, '#c88634'); p.ell(cx - 0.6, cy - 0.8, rx - 1, ry - 1.2, '#e0a24a'); p.ell(cx - 1, cy - 1.4, rx * 0.45, ry * 0.4, '#f6cc7a');
  });
  for (let k = 0; k < 4; k++) { if (k >= n + 1) break; const a = -0.72 + k * 0.48, cx = 17 + Math.sin(a) * 11, cy = 9 - Math.cos(a) * 3.4 + 2; p.line(cx, cy - 2, cx + 0.5, cy + 2, '#9a5a22'); }
  p.outline('#5a3014');
  if (n < 3) { const a = [-0.5, 0, 0.5][n] + 0.25, cx = 17 + Math.sin(a) * 11 + 3, cy = 10; p.ell(cx, cy, 3, 4, '#000000'); for (let y = 0; y < 16; y++) for (let x = 0; x < 34; x++) { const i = (y * 34 + x) * 4; if (p.d[i] === 0 && p.d[i + 1] === 0 && p.d[i + 2] === 0) p.d[i + 3] = 0; } }
  return p.canvas();
}

function baristaFrame(arm, blink) {
  const p = painter(22, 44);
  const skin = '#e6b48a', skinS = '#c48c64', hair = '#3b2320', hairH = '#5e3a2a', shirt = '#efe4cf', shirtS = '#c8b89c', apron = '#2f5a4a', apronS = '#21443a';
  p.ell(11, 3.5, 3.2, 2.6, hair);
  p.ell(11, 10.5, 5, 5.5, skin);
  p.ell(11, 8, 5.6, 3.6, hair); p.r(6, 8, 2, 5, hair); p.r(15, 8, 2, 4, hair); p.r(9, 5, 3, 1, hairH);
  if (!blink) { p.p(9, 11, '#2a1a18'); p.p(13, 11, '#2a1a18'); } else { p.r(8, 11, 2, 1, skinS); p.r(13, 11, 2, 1, skinS); }
  p.p(8, 13, '#e88a7a'); p.p(14, 13, '#e88a7a'); p.r(10, 14, 2, 1, '#a85a48');
  p.r(10, 16, 3, 2, skinS);
  p.ell(11, 31, 7.5, 14, shirt); p.r(4, 21, 15, 23, shirt);
  p.r(7, 23, 9, 21, apron); p.r(7, 18, 1, 5, apron); p.r(15, 18, 1, 5, apron); p.r(9, 31, 5, 1, apronS); p.r(7, 23, 9, 1, apronS);
  p.tint(16, 19, 4, 25, shirtS);
  if (arm === 0) { p.r(2, 21, 3, 14, shirt); p.r(18, 21, 3, 14, shirtS); p.r(2, 34, 3, 3, skin); p.r(18, 34, 3, 3, skin); }
  else if (arm === 1) { p.r(2, 21, 3, 14, shirt); p.r(2, 34, 3, 3, skin); p.r(18, 21, 3, 7, shirtS); p.r(15, 27, 6, 3, shirt); p.r(13, 27, 3, 3, skin); }
  else { p.r(2, 21, 3, 14, shirt); p.r(2, 34, 3, 3, skin); p.r(18, 11, 3, 11, shirtS); p.r(18, 7, 3, 4, skin); }
  p.outline('#1a1012');
  return p;
}

function readerFrame(turn, nod, rimC) {
  const p = painter(38, 44);
  const skin = '#e2b08a', hair = '#4a2a22', sw = '#b5566a', swS = '#8a3e50', pants = '#2c2f4a', sock = '#e8dccb';
  p.thick(26, 38, 27, 22, 5.6, sw);
  p.tint(29, 18, 7, 22, swS);
  p.thick(25, 37, 14, 26, 3.4, pants);
  p.thick(14, 26, 9, 38, 3, pants);
  p.r(4, 39, 7, 3, sock); p.r(4, 39, 7, 1, '#ffffff', 0.5);
  const hy = 11 + nod;
  p.ell(24, hy, 5, 5.5, skin);
  p.ell(26, hy - 1, 5.6, 6, hair); p.r(19, hy - 6, 9, 3, hair); p.r(28, hy, 3, 7, hair);
  p.p(20, hy, '#2a1a18'); p.p(18, hy + 1, skin); p.p(21, hy + 3, '#c87a6a');
  p.thick(24, 20, 17, 23, 1.7, sw);
  p.ell(16, 22, 1.6, 1.6, skin);
  p.r(9, 15, 9, 9, '#3a5a7a'); p.r(10, 15, 3, 8, '#e8dfca'); p.r(14, 15, 3, 8, '#dcd2bb'); p.r(13, 15, 1, 8, '#b8ab90');
  if (turn) { p.r(13, 12, 4, 4, '#f2eadc'); p.r(14, 11, 2, 1, '#f2eadc'); }
  // the window behind catches the top of the head and shoulders
  const on = [];
  for (let y = 0; y < 44; y++) for (let x = 18; x < 38; x++) if (p.solid(x, y) && !p.solid(x, y - 1)) on.push(x, y);
  for (let i = 0; i < on.length; i += 2) p.p(on[i], on[i + 1], rimC);
  p.outline('#1a0e12');
  return p;
}

// the guest at the counter in headphones, swaying a little (two frames)
function stoolGuest(bob) {
  const p = painter(24, 48);
  const hair = '#2a1c1c', skin = '#d8a07a', hood = '#5a5a8a', hoodS = '#45456e', hoodD = '#38385c', hoodH = '#6e6ea0';
  const y = bob;
  p.ell(12, 27, 9, 13, hood); p.r(3, 27, 18, 15, hood);
  p.tint(15, 14, 9, 28, hoodS); p.tint(19, 20, 5, 22, hoodD); p.tint(3, 18, 3, 16, hoodH);
  p.r(11, 22, 1, 18, hoodS); p.r(3, 40, 18, 2, hoodD); p.r(7, 30, 9, 1, hoodS); p.r(8, 31, 7, 4, hoodS); p.r(8, 31, 7, 1, hoodD);
  p.ell(12, 17, 6, 3, hoodD); p.r(8, 16, 8, 1, hoodS);
  p.r(10, 13 + y, 4, 3, skin);
  p.ell(12, 8 + y, 5.4, 6, hair); p.p(6, 9 + y, skin); p.p(17, 9 + y, skin);
  p.r(8, 3 + y, 2, 1, '#3e2c2c');
  p.line(6, 7 + y, 9, 2 + y, '#2a2a33'); p.line(9, 2 + y, 15, 2 + y, '#2a2a33'); p.line(15, 2 + y, 18, 7 + y, '#2a2a33');
  p.r(5, 7 + y, 2, 5, '#d85a8a'); p.r(17, 7 + y, 2, 5, '#d85a8a'); p.p(5, 7 + y, '#ff8ab0'); p.p(18, 7 + y, '#ff8ab0');
  p.r(5, 42, 6, 5, '#2a2a3e'); p.r(13, 42, 6, 5, '#2a2a3e');
  p.outline('#140c12');
  return p;
}

// a guest at one of the tables, seated, facing right (flipped for the other side). `pose` is
// idle | talk | look (turned to us, waving) | sip, or A / B for whatever they're busy with
function guestFrame(v, pose, prop) {
  const p = painter(30, 50);
  const down = (pose === 'A' || pose === 'B') && (prop === 'laptop' || prop === 'write' || prop === 'phone' || prop === 'knit');
  const nod = pose === 'talk' ? 1 : down ? 1 : 0, hy = 8 + nod, look = pose === 'look';
  const topS = mixHex(v.top, '#000000', 0.3), skinS = mixHex(v.skin, '#000000', 0.2);
  p.thick(10, 33, 10, 16, 4.2, v.top);
  p.tint(5, 12, 3, 24, topS);
  p.thick(10, 33, 21, 33, 3, v.pants);
  p.thick(21, 34, 21, 45, 2.4, v.pants);
  p.r(20, 46, 6, 2, '#1a1414');
  p.r(10, 12 + nod, 3, 3, v.skin);
  if (look) {
    // turned to us: both eyes, a smile
    p.ell(11, hy, 4.8, 5, v.skin);
    p.ell(11, hy - 2.2, 5.3, 3.4, v.hair); p.r(6, hy - 2, 2, v.long ? 9 : 4, v.hair); p.r(15, hy - 2, 2, v.long ? 9 : 4, v.hair);
    p.p(9, hy + 1, '#2a1a18'); p.p(13, hy + 1, '#2a1a18'); p.r(10, hy + 3, 3, 1, '#a85a4a'); p.p(8, hy + 2, '#e88a7a'); p.p(14, hy + 2, '#e88a7a');
    if (v.glasses) { p.r(8, hy + 1, 2, 1, '#1a1a1a'); p.r(12, hy + 1, 2, 1, '#1a1a1a'); p.p(11, hy + 1, '#1a1a1a'); }
    if (v.beanie) { p.ell(11, hy - 3, 5.4, 3, v.beanie); p.r(6, hy - 2, 11, 1, mixHex(v.beanie, '#000000', 0.3)); }
  } else {
    p.ell(11, hy, 4.6, 5, v.skin);
    p.ell(10, hy - 1.4, 5, 4.4, v.hair); p.r(6, hy - 1, 3, v.long ? 9 : 4, v.hair);
    p.p(14, hy, '#2a1a18'); p.p(16, hy + 1, v.skin); p.p(14, hy + 3, '#a85a4a'); p.p(13, hy + 4, skinS);
    if (v.glasses) { p.r(13, hy, 3, 1, '#1a1a1a'); p.r(9, hy, 4, 1, '#1a1a1a', 0.7); }
    if (v.beanie) { p.ell(10, hy - 3, 5.2, 3, v.beanie); p.r(5, hy - 2, 10, 1, mixHex(v.beanie, '#000000', 0.3)); }
  }
  const arm = (pts, c = v.top) => { for (let i = 0; i < pts.length - 1; i++) p.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i ? 1.5 : 1.7, c); };
  const hand = (x, y) => p.ell(x, y, 1.6, 1.4, v.skin);
  if (look) { arm([[11, 18], [16, 13], [17, 7]]); p.r(16, 3, 3, 4, v.skin); p.p(15, 3, v.skin); p.p(19, 4, v.skin); }
  else if (pose === 'talk') { arm([[11, 18], [16, 24], [21, 21]]); hand(23, 20); }
  else if (pose === 'sip') { arm([[11, 18], [16, 23], [16, 15]]); hand(16, 13); p.r(15, 9, 4, 4, '#efe4cf'); p.r(19, 10, 1, 2, '#efe4cf'); p.r(15, 9, 4, 1, '#8a5a3a'); }
  else if (pose === 'idle' || prop === 'chat') { arm([[11, 18], [16, 25], [22, 26]]); hand(24, 26); }
  else if (prop === 'laptop') { const k = pose === 'B' ? 1 : 0; arm([[11, 18], [16, 25], [21 + k, 25 - k]]); hand(23 + k, 25 - k); }
  else if (prop === 'write') { const k = pose === 'B' ? 2 : 0; arm([[11, 18], [16, 25], [21 + k, 26]]); hand(23 + k, 25); p.line(23 + k, 24, 26 + k, 21, '#2a2a3a'); }
  else if (prop === 'book') {
    arm([[11, 18], [15, 24], [18, 21]]); hand(19, 20);
    p.r(17, 13, 8, 9, '#3a6a5a'); p.r(18, 13, 3, 8, '#e8dfca'); p.r(21, 13, 3, 8, '#dcd2bb'); p.r(21, 13, 1, 8, '#a89a80');
    if (pose === 'B') { p.r(21, 11, 3, 3, '#f2eadc'); p.p(22, 10, '#f2eadc'); }
  } else if (prop === 'paper') {
    arm([[11, 18], [16, 22], [19, 19]]);
    const dy = pose === 'B' ? 4 : 0;
    p.r(16, 2 + dy, 12, 18, '#cfc8b8'); p.r(16, 2 + dy, 12, 1, '#e8e2d4'); p.r(21, 2 + dy, 1, 18, '#a8a294');
    for (let k = 0; k < 5; k++) { p.r(17, 5 + dy + k * 3, 3, 1, '#7a7468'); p.r(23, 5 + dy + k * 3, 4, 1, '#7a7468'); }
    p.r(23, 4 + dy, 4, 4, '#8a8478', 0.6);
    hand(17, 12 + dy);
  } else if (prop === 'knit') {
    arm([[11, 18], [15, 24], [18, 22]]); hand(19, 22);
    const k = pose === 'B' ? 1 : 0;
    p.line(16, 17 + k, 23, 24 - k, '#d8c8a8'); p.line(23, 17, 16, 24, '#d8c8a8');
    p.r(17, 23, 6, 4, '#c84a5a'); p.r(17, 24, 6, 1, '#e86a7a');
  } else { // phone
    arm([[11, 18], [15, 24], [17, 20]]); hand(17, 19);
    p.r(17, 15, 3, 4, '#1a1a24'); p.p(18, 16, pose === 'B' ? '#c8f4ff' : '#8ae0ff');
  }
  p.outline('#140c10');
  return p;
}

// the window sign: CAFE in continuous neon tubes, OPEN in a little tube box under it
const NEONW = {
  C: [[[8, 1], [3, 1], [1, 3], [1, 7], [3, 9], [8, 9]]],
  A: [[[1, 9], [1, 4], [4, 1], [5, 1], [8, 4], [8, 9]], [[1, 6], [8, 6]]],
  F: [[[8, 1], [1, 1], [1, 9]], [[1, 5], [6, 5]]],
  E: [[[8, 1], [1, 1], [1, 9], [8, 9]], [[1, 5], [6, 5]]],
};
function signSprite(n, n2) {
  const p = painter(66, 40);
  p.glow(33, 15, 36, 16, n.glow, 0.42, 5);
  p.glow(33, 29, 15, 6, n2.glow, 0.3);
  p.r(17, 2, 33, 1, '#30303a'); p.r(20, 0, 1, 2, '#30303a'); p.r(44, 0, 1, 2, '#30303a');
  const word = [...'CAFE'], at = (k, [a, b]) => [7 + k * 14 + a, 4 + b];
  word.forEach((ch, k) => { for (const pts of NEONW[ch]) tubeStroke(p, pts.map((q) => at(k, q)), n.tube); });
  word.forEach((ch, k) => { for (const pts of NEONW[ch]) coreStroke(p, pts.map((q) => at(k, q)), n.core); });
  // the wire that runs between the letters, as on a real sign
  p.r(17, 15, 2, 1, mixHex(n.tube, '#000000', 0.5)); p.r(31, 15, 2, 1, mixHex(n.tube, '#000000', 0.5)); p.r(45, 15, 2, 1, mixHex(n.tube, '#000000', 0.5));
  tubeStroke(p, [[24, 24], [42, 24], [42, 34], [24, 34], [24, 24]], mixHex(n2.tube, '#000000', 0.25));
  coreStroke(p, [[24, 24], [42, 24], [42, 34], [24, 34], [24, 24]], n2.tube);
  p.text('OPEN', 26, 27, n2.core);
  return p.canvas();
}

function cupSprite(level) {
  const p = painter(36, 30);
  const cer = '#f8f3ea', cerS = '#dcd3c6', cerD = '#bdb2a3', K = '#6a5446';
  p.ell(29, 14, 4.5, 5.5, cerS); p.ell(29, 14, 2.2, 3.2, '#000000'); p.clear(27, 11, 5, 7);
  p.r(32, 12, 1, 5, cerD);
  // the bowl, shaded in clean bands: a highlight on the left, the shadow side on the right
  for (let y = 6; y <= 25; y++) {
    const t = (y - 6) / 19, half = 13 - t * t * 4.5, x0 = Math.round(15 - half), w = Math.round(half * 2);
    p.r(x0, y, w, 1, cer);
    p.r(x0 + Math.round(w * 0.66), y, w - Math.round(w * 0.66), 1, cerS);
    p.r(x0 + Math.round(w * 0.87), y, w - Math.round(w * 0.87), 1, cerD);
    if (y > 8 && y < 21) p.p(x0 + 2, y, '#ffffff');
  }
  p.ell(15, 25, 8, 2, cerS); p.r(9, 25, 6, 1, cer);
  p.ell(15, 6.5, 13, 4.5, '#fffcf6'); p.ell(15, 6.8, 11.8, 3.6, '#e6dfd3');
  const L = [null, ['#7a4a24', 9, 2.4, 1.2], ['#9a6234', 10, 2.8, 0.8], ['#c09060', 11, 3.1, 0.4], ['#e2c49a', 11.4, 3.3, 0.2]][level];
  if (L) {
    p.ell(15, 7 + L[3], L[1], L[2], L[0]);
    if (level >= 3) { p.ell(15, 7.2, L[1] - 1.5, L[2] - 0.8, '#a8703a'); p.ell(15, 7.2, L[1] - 3, L[2] - 1.4, '#f2e2c4'); }
    if (level === 4) { p.ell(13.5, 6.4, 2, 1.3, '#a8703a'); p.ell(16.5, 6.4, 2, 1.3, '#a8703a'); p.r(15, 8, 1, 1, '#a8703a'); p.r(14, 7, 3, 1, '#a8703a'); }
    if (level === 2) p.ell(15, 7, 7, 1.6, '#b89060');
  } else { p.ell(15, 8, 6, 1.6, '#c8b8a0'); p.ell(15, 8, 3, 0.8, '#a88a64'); }
  p.outline(K);
  return p.canvas();
}

// the barista's arm, reaching in from the bottom right: a rolled cuff, the forearm, and a hand
// whose fingers curl through the cup's handle (the handle sits at ARM.x, ARM.y)
const ARM = { x: 5, y: 9 };
function armSprite() {
  const p = painter(78, 60);
  const shirt = '#efe4cf', shirtS = '#cdbd9f', cuff = '#e4d6b8', cuffS = '#b8a582', skin = '#e6b48a', skinS = '#c48c64', skinH = '#f4cba2';
  // the sleeve, then the rolled cuff with its folds
  p.thick(44, 31, 84, 56, 7, shirt); p.thick(47, 36, 84, 60, 4, shirtS);
  p.line(50, 33, 56, 30, shirtS); p.line(60, 40, 66, 36, shirtS);
  p.thick(35, 25, 42, 30, 5.2, cuff); p.thick(36, 28, 43, 33, 2.4, cuffS);
  p.line(39, 21, 34, 30, cuffS); p.line(43, 24, 38, 33, cuffS);
  // the forearm, lit along its top
  p.thick(11, 11, 35, 26, 3.3, skin); p.thick(13, 14, 35, 28, 1.6, skinS); p.line(12, 8, 33, 22, skinH);
  // the hand: a palm, three fingers curled through the handle, the thumb over the top
  p.ell(9, 9.5, 4.6, 4.2, skin); p.ell(10, 12, 3.4, 2, skinS);
  for (const [fx, fy] of [[4, 6.5], [3.6, 9.5], [4.2, 12.5]]) p.ell(fx, fy, 2.3, 1.3, skin);
  p.p(4, 8, skinS); p.p(4, 11, skinS); p.p(2, 7, skinS); p.p(2, 10, skinS);
  p.thick(9, 5, 5, 4, 1.1, skin); p.p(7, 3, skinH); p.p(10, 6, skinH);
  p.outline('#3a2418');
  return p.canvas();
}

// people out in the rain: backlit by the street, with a warm rim from the café's window.
// 20×48, facing right, four walk frames; `lit` draws them in their own colours (inside)
function walkerFrame(o) {
  const p = painter(20, 48);
  const sil = !o.lit;
  const K = sil ? mixHex('#0b0d19', o.coat, 0.3) : o.coat;
  const KS = sil ? mixHex('#07080f', o.coat, 0.15) : mixHex(o.coat, '#000000', 0.3);
  const skin = sil ? mixHex('#0b0d19', o.skin, 0.25) : o.skin;
  const hair = sil ? '#07080f' : o.hair, pants = sil ? '#06070d' : '#24242e', shoe = '#05060a';
  const f = o.frame, leg = [3, 0, -3, 0][f], bob = f % 2 ? -1 : 0, sway = [1, 0, -1, 0][f];
  // legs and shoes
  p.thick(9, 33 + bob, 9 - leg, 44, 1.2, sil ? '#05060b' : '#1a1a22');
  p.thick(9, 33 + bob, 9 + leg, 44, 1.2, pants);
  p.r(8 - leg, 45, 4, 2, shoe); p.r(8 + leg, 45, 4, 2, shoe);
  // the coat: shoulders, a nipped waist and a hem that flares as they walk
  p.ell(10, 14 + bob, 5.4, 2.6, K);
  p.r(5, 14 + bob, 10, 11, K);
  p.r(6, 24 + bob, 8, 4, K);
  p.r(5 + (sway > 0 ? 1 : 0), 28 + bob, 10, 3, K);
  p.r(4 + sway, 31 + bob, 12, 3, K); p.r(4 + sway + (sway < 0 ? 0 : 1), 34 + bob, 11, 1, KS);
  p.r(5, 14 + bob, 2, 20, KS);
  if (o.scarf) { p.r(7, 11 + bob, 6, 3, o.scarf); p.r(7, 14 + bob, 2, 5, o.scarf); }
  // head
  p.r(9, 11 + bob, 3, 2, skin);
  p.ell(10.5, 7 + bob, 3.4, 3.9, skin);
  p.ell(9.8, 5.6 + bob, 3.7, 2.9, hair); p.r(7, 6 + bob, 2, o.long ? 7 : 3, hair);
  if (!sil) { p.p(12, 7 + bob, '#2a1a18'); p.p(14, 8 + bob, skin); }
  if (o.hat) { p.r(5, 3 + bob, 11, 1, sil ? '#06070d' : '#2a2430'); p.r(7, 0 + bob, 7, 3, sil ? '#06070d' : '#2a2430'); }
  // the arm: holding the umbrella up, carrying a coffee, waving, or swinging
  if (o.umb) { p.thick(11, 15 + bob, 14, 20 + bob, 1.4, K); p.thick(14, 20 + bob, 14, 14 + bob, 1.3, K); p.r(13, 12 + bob, 3, 2, skin); }
  else if (o.carry) { p.thick(11, 15 + bob, 13, 22 + bob, 1.4, K); p.thick(13, 22 + bob, 16, 20 + bob, 1.3, K); p.r(15, 16 + bob, 4, 5, '#f0e8dc'); p.r(15, 16 + bob, 4, 1, '#3a2a22'); p.r(15, 18 + bob, 4, 1, '#a86a3a'); }
  else if (o.wave) { p.thick(11, 15 + bob, 15, 9 + bob, 1.4, K); p.thick(15, 9 + bob, 16, 4 + bob, 1.3, K); p.r(15, 2 + bob, 3, 3, skin); }
  else { const ax = 10 - leg * 0.9; p.thick(10, 15 + bob, ax, 27 + bob, 1.4, KS); p.r(Math.round(ax) - 1, 27 + bob, 3, 2, skin); }
  if (o.folded) { p.line(16, 20 + bob, 18, 40, '#1a1a22'); p.line(17, 22 + bob, 19, 38, mixHex(o.folded, '#000000', 0.2)); }
  // light on the edges: cool from the lamps above, warm from the café on the side they walk into
  const top = [], side = [];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 20; x++) if (p.solid(x, y)) { if (!p.solid(x, y - 1)) top.push(x, y); else if (!p.solid(x + 1, y)) side.push(x, y); }
  if (sil) { for (let i = 0; i < top.length; i += 2) p.p(top[i], top[i + 1], '#3e4a80', 0.75); for (let i = 0; i < side.length; i += 2) p.p(side[i], side[i + 1], '#c8885a', 0.55); }
  else { for (let i = 0; i < top.length; i += 2) p.p(top[i], top[i + 1], '#ffe0b0', 0.35); p.outline('#140c10'); }
  return p;
}

// an umbrella: a dome with ribs, a scalloped edge, lit from above; tilt -1 / 0 / 1
function umbrellaSprite(c, tilt) {
  const p = painter(38, 22), D = mixHex(c, '#000000', 0.45), M = mixHex(c, '#000000', 0.2), Lc = mixHex(c, '#ffffff', 0.35);
  const q = painter(38, 22);
  for (let y = 4; y <= 11; y++) { const t = (y - 4) / 7, half = Math.round(4 + 13 * Math.sqrt(t)); q.r(19 - half, y, half * 2 + 1, 1, y < 7 ? Lc : y < 10 ? c : M); }
  for (const rx of [2, 8, 14, 19, 24, 30, 36]) { q.line(19, 4, rx, 11, D); q.p(rx, 12, D); }
  q.r(19, 1, 1, 3, '#1a1a22');
  for (let x = 0; x < 38; x++) for (let y = 0; y < 22; y++) {
    const i = (y * 38 + x) * 4;
    if (!q.d[i + 3]) continue;
    p.p(x, y + 4 + Math.round(tilt * (x - 19) * 0.16), [q.d[i], q.d[i + 1], q.d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).reduce((s, v) => s + v, '#'), q.d[i + 3] / 255);
  }
  return p.canvas();
}

// the sleeping dog on its cushion by your table (two breaths): curled up, ears up, tail over
function dogFrame(b) {
  const p = painter(46, 26);
  const T = '#d09a5c', D = '#9a6a3a', L = '#ecbc7c', W = '#f4e2c4', K = '#3a2414';
  p.ell(27, 16 - b * 0.4, 14 + b * 0.5, 7 + b * 0.4, T);
  p.ell(28, 12 - b * 0.5, 11, 3, L);
  p.ell(35, 15, 6.5, 5.5, T); p.line(30, 19, 36, 21, D);
  p.r(15, 20, 26, 2, D);
  p.thick(40, 19, 42, 15, 1.7, T); p.thick(42, 15, 40, 11, 1.5, L); p.thick(40, 11, 37, 10, 1.3, W);
  p.ell(12, 16, 6.5, 5, T); p.ell(13, 13.5, 4.5, 2, L);
  p.ell(7, 18.5, 3.8, 2.4, W); p.r(3, 17, 2, 2, K); p.p(4, 17, '#6a4a34');
  p.r(9, 15, 3, 1, K); p.p(12, 14, K);
  p.r(10, 8, 3, 4, T); p.p(11, 7, T); p.p(11, 9, '#e8a090'); p.r(15, 9, 3, 3, T); p.p(16, 8, T); p.p(16, 10, '#e8a090');
  p.ell(16, 20, 4, 2, W);
  p.r(4, 21, 11, 2, W); p.p(7, 22, D); p.p(11, 22, D);
  p.outline(K);
  return p.canvas();
}

function puffSprite(r) {
  const p = painter(r * 2 + 2, r * 2 + 2);
  p.glow(r + 1, r + 1, r, r, '#ffffff', 1, 3);
  return p.canvas();
}

function carSprite(c) {
  const p = painter(38, 13);
  p.r(2, 6, 34, 5, c); p.ell(19, 6, 17, 3, c);
  p.r(10, 1, 17, 6, c); p.r(11, 0, 15, 1, c);
  p.r(12, 2, 6, 4, '#2a3a5a'); p.r(19, 2, 6, 4, '#2a3a5a'); p.r(12, 2, 2, 1, '#8ab0d8'); p.r(19, 2, 2, 1, '#8ab0d8');
  p.r(2, 6, 34, 1, '#ffffff', 0.25); p.r(2, 10, 34, 1, '#000000', 0.4);
  p.r(17, 7, 1, 3, '#000000', 0.3);
  p.r(35, 7, 2, 2, '#fff6d0'); p.r(1, 7, 2, 2, '#ff3a3a');
  p.ell(9, 11, 3, 2.5, '#0c0c12'); p.ell(29, 11, 3, 2.5, '#0c0c12'); p.p(9, 11, '#5a5a66'); p.p(29, 11, '#5a5a66');
  p.outline('#07070d');
  const q = p.flipped();
  return { r: p.canvas(), l: q.canvas() };
}

/* ——— building everything for a width ——— */

function build(BW, wx) {
  const L = layout(BW);
  const R = { BW, L, ox: L.ox, wx: null, cache: {}, jobs: [] };
  R.buf = mk(BW, H); R.f = R.buf.getContext('2d');
  R.back = buildBack(BW, L).canvas();
  R.mid = buildMid(BW, L).canvas();
  R.front = buildFront(BW, L).canvas();
  R.vig = buildVignette(BW);
  R.lamps = [...LAMPS.map((x) => ({ x: L.ox + x, y: 30, key: x, style: 0 })), ...L.mods.filter((m) => m.tcx).map((m) => ({ x: m.tcx, y: 62, key: 1000 + m.x, style: m.lamp }))];
  // windows onto the street: the core panes, the side windows and the door's glass in full screen
  R.glass = PANES.map(([x, y, w, h]) => ({ x: L.ox + x, y, w, h }));
  for (const m of L.mods) if (m.glass) R.glass.push(...m.glass);
  R.door = L.mods.find((m) => m.t === 'door') || null;
  if (R.door) R.glass.push({ x: R.door.x + 11, y: 102, w: 32, h: 60, door: true });
  // where rain can be seen at all: the glass, merged into spans (the rest is wall)
  const xs = [];
  for (const s of R.glass.map((g) => [g.x, g.x + g.w]).sort((a, b) => a[0] - b[0])) { const l = xs[xs.length - 1]; if (l && s[0] <= l[1] + 30) l[1] = Math.max(l[1], s[1]); else xs.push([...s]); }
  R.glassX = xs; R.glassW = xs.reduce((n, [a, b]) => n + b - a + 30, 0);
  R.garland = [];
  for (let x = 16; x <= 186; x += 7) { const t = (x - 12) / 176; R.garland.push({ x: L.ox + x, y: 26 + Math.round(Math.sin(t * Math.PI * 3) ** 2 * 3) + 1, c: ['#ffcf6b', '#ff8ab0', '#8ae0ff', '#ffe8a0'][(x / 7) % 4 | 0], ph: x * 0.7 }); }
  weather(R, wx);
  // the other two skies are built a piece at a time in quiet frames, so switching never stalls
  for (const w of ['rain', 'snow', 'clear']) if (w !== wx) for (const part of ['sky', 'clouds', 'city']) R.jobs.push(() => wxPart(R, w, part));
  return R;
}

function wxPart(R, wx, part) {
  const c = R.cache[wx] || (R.cache[wx] = {});
  if (part === 'sky' && !c.sky) { const k = buildSky(R.BW, R.ox, wx); c.sky = k.cv; c.stars = k.stars; }
  else if (part === 'clouds' && !c.clouds) c.clouds = buildClouds(R.BW, wx);
  else if (part === 'city' && !c.city) { const k = buildCity(R.BW, R.ox, wx); c.city = k.cv; c.I = k.I; }
  return c;
}
function wxLayer(R, wx) { for (const part of ['sky', 'clouds', 'city']) wxPart(R, wx, part); return R.cache[wx]; }
function weather(R, wx) { R.I = wxLayer(R, wx).I; R.wx = wx; }

/* ——— the living scene ——— */

function makeState(seed, rand = Math.random) {
  const r = rng(seed);
  return {
    r, rand, t: 0, weather: 'rain', wxFrom: 'rain', wxK: 1, amt: { rain: 1, snow: 0 },
    neon: 0, cup: 1, cupGone: false, sip: 0, bites: 3, pastry: 0, candle: true, candleL: 1, special: 0,
    order: null, barista: { x: MACHINE, goal: MACHINE, wait: 3, work: 0, wave: 0, blink: 3, vis: 1, trip: null },
    hearts: [], notes: [], puffs: [], smoke: [], dust: [], zs: [], sway: {}, purr: 0, catTail: 0,
    page: 0, flip: 0, readerT: 7, readerTurn: 0, readerNod: 0, bob: 0, door: 0, bell: 0, curtain: 0,
    cars: [], carT: 2, walkers: [], rain: [], flakes: [], drops: [], splashes: [], ripples: [], drips: [],
    flick: { i: -1, t: 0, next: 3 }, shoot: null, machine: 0, gauge: 0, guestLook: {},
    radio: 0, can: 0, sigOff: 0, clock: 0, pet: 0, visitor: null, visitT: 20, msg: null,
  };
}

// a random x where falling rain or snow can be seen: over some glass, with room for its drift
function glassSpan(R, r) {
  let k = r() * R.glassW;
  for (const [a, b] of R.glassX) { const w = b - a + 30; if (k < w) return a + k; k -= w; }
  return r() * R.BW;
}

function seedParticles(s, R) {
  const r = s.rand;
  s.rain = Array.from({ length: Math.round(R.glassW * 0.62) }, () => ({ x: glassSpan(R, r), y: r() * 214, v: 150 + r() * 90, l: 3 + Math.floor(r() * 4), near: r() < 0.35 }));
  s.flakes = Array.from({ length: Math.round(R.glassW * 0.45) }, () => ({ x: glassSpan(R, r) - 10, y: r() * 214, v: 8 + r() * 14, ph: r() * 6, sz: r() < 0.25 ? 2 : 1 }));
  s.drops = [];
  for (const g of R.glass) for (let i = 0; i < Math.round((g.w * g.h) / 500); i++) s.drops.push(newDrop(r, g, true));
  s.dust = Array.from({ length: 14 }, () => ({ x: R.ox + 20 + r() * 180, y: 40 + r() * 120, vx: (r() - 0.5) * 2, vy: -0.5 - r(), ph: r() * 6 }));
  const far = Math.round(R.BW / 64), near = Math.round(R.BW / 107);
  if (!s.walkers.length) for (let i = 0; i < far + near; i++) s.walkers.push(newWalker(r, R.BW, i < far ? 0 : 1, true));
  else for (const w of s.walkers) if (w.x > R.BW + 60 || w.x < -60) w.x = r() * R.BW;
}

// when the width changes, everything already moving keeps its place in the scene
function shiftScene(s, dx) {
  for (const k of ['walkers', 'cars', 'rain', 'flakes', 'puffs', 'hearts', 'notes', 'smoke', 'dust', 'drips', 'splashes', 'ripples', 'zs']) for (const q of s[k]) q.x += dx;
  if (s.shoot) s.shoot.x += dx;
}

function newDrop(r, g, anywhere) {
  return { g, x: g.x + 1 + r() * (g.w - 3), y: anywhere ? g.y + r() * g.h : g.y - 2, sz: r() < 0.3 ? 2 : 1, v: 0, hold: r() * 4, trail: [] };
}

const COATS = ['#3a4a6a', '#6a3a3a', '#4a4a3a', '#2a3a3a', '#5a4a6a', '#7a5a3a', '#3a3a4a'];
const UMBS = ['#c84a5a', '#3a7aa8', '#e8c050', '#2a2a32', '#5aa08a', '#b86ad8', '#e8e0d0'];
function newWalker(r, BW, near, anywhere) {
  const dir = r() < 0.5 ? 1 : -1;
  return {
    near, dir, v: near ? 13 + r() * 6 : 7 + r() * 5, x: anywhere ? r() * BW : (dir > 0 ? -30 - r() * 120 : BW + 30 + r() * 120),
    coat: pick(r, COATS), umb: pick(r, UMBS), hair: pick(r, ['#2a1a18', '#5a3a22', '#c8a060', '#1a1a1a', '#8a8a8a']), skin: pick(r, ['#e2b08a', '#c88a64', '#8a5a3a', '#f0c8a0']),
    ph: r() * 4, dog: r() < 0.25, hat: r() < 0.3, long: r() < 0.4, tilt: 0, wave: 0,
  };
}

const bell = () => [88, 93, 88, 91].forEach((n, i) => tone(n, { dur: 1.1, vol: 0.03, delay: i * 0.09, type: 'triangle' }));

function step(s, R, dt) {
  const r = s.rand;
  s.t += dt;
  const t = s.t, BW = R.BW, ox = R.ox, I = R.I;
  // the weather eases from one to the next
  if (s.wxK < 1) s.wxK = Math.min(1, s.wxK + dt / 2.6);
  s.amt.rain += ((s.weather === 'rain' ? 1 : 0) - s.amt.rain) * Math.min(1, dt * 1.2);
  s.amt.snow += ((s.weather === 'snow' ? 1 : 0) - s.amt.snow) * Math.min(1, dt * 1.2);
  const ar = s.amt.rain;
  if (ar > 0.01) {
    for (const d of s.rain) { d.y += d.v * dt; d.x -= d.v * 0.12 * dt; if (d.y > (d.near ? 214 : 168)) { d.y = -r() * 30; d.x = glassSpan(R, r); } }
    if (r() < dt * 40 * (R.glassW / 210) * ar) s.splashes.push({ x: glassSpan(R, r) - 15, y: pick(r, [146, 148, 152 + r() * 15, 172 + r() * 40]), l: 0.14 });
    if (I.puddles.length && r() < dt * 7 * (BW / 320) * ar) { const pd = pick(r, I.puddles); s.ripples.push({ x: pd.x + (r() - 0.5) * pd.rx, y: pd.y, a: 0 }); }
    for (const d of s.drops) {
      if (d.hold > 0) { d.hold -= dt; continue; }
      d.v = Math.min(40, d.v + 30 * dt); d.y += d.v * dt;
      if (d.trail.length < 10 && r() < 0.5) d.trail.push({ x: d.x, y: d.y, l: 1 });
      if (r() < dt * 0.8) { d.hold = 0.3 + r() * 2; d.v = 0; }
      if (d.y > d.g.y + d.g.h) Object.assign(d, newDrop(r, d.g, false));
    }
    for (const d of s.drops) { for (const q of d.trail) q.l -= dt * 0.35; d.trail = d.trail.filter((q) => q.l > 0); }
  }
  if (s.amt.snow > 0.01) for (const f of s.flakes) { f.y += f.v * dt; f.x += Math.sin(t * 0.8 + f.ph) * 5 * dt - 2 * dt; if (f.y > 214) { f.y = -4; f.x = glassSpan(R, r) - 10; } }
  if (s.weather === 'clear' && s.wxK >= 1 && !s.shoot && r() < dt * 0.05) s.shoot = { x: ox + 30 + r() * 140, y: 30 + r() * 30, l: 1 };
  if (s.shoot) { s.shoot.x += 120 * dt; s.shoot.y += 40 * dt; s.shoot.l -= dt * 1.5; if (s.shoot.l <= 0) s.shoot = null; }
  for (const q of s.splashes) q.l -= dt;
  s.splashes = s.splashes.filter((q) => q.l > 0);
  for (const q of s.ripples) q.a += dt;
  s.ripples = s.ripples.filter((q) => q.a < 0.9);
  // the street
  for (const w of s.walkers) {
    w.x += w.v * w.dir * dt; w.ph += dt * w.v / (w.near ? 4.5 : 3.5);
    if (w.tilt > 0) w.tilt -= dt;
    if (w.wave > 0) w.wave -= dt;
    if ((w.dir > 0 && w.x > BW + 40) || (w.dir < 0 && w.x < -40)) Object.assign(w, newWalker(r, BW, w.near, false));
  }
  s.carT -= dt;
  if (s.carT <= 0) { const dir = r() < 0.5 ? 1 : -1; s.cars.push({ dir, x: dir > 0 ? -50 : BW + 50, v: 34 + r() * 14, spr: Math.floor(r() * 6) }); s.carT = 7 + r() * 10; }
  for (const c of s.cars) c.x += c.v * c.dir * dt;
  s.cars = s.cars.filter((c) => c.x > -80 && c.x < BW + 80);
  for (const v of I.vents) if (r() < dt * 2.2) s.puffs.push({ x: v.x + (r() - 0.5) * 6, y: v.y, l: 1, k: 0, vx: (r() - 0.5) * 3, street: true });
  s.flick.next -= dt;
  if (s.flick.next <= 0 && I.neons.length) s.flick = { i: Math.floor(r() * I.neons.length), t: 1.2, next: 7 + r() * 12 };
  if (s.flick.t > 0) s.flick.t -= dt;
  if (s.can > 0) s.can -= dt;
  if (s.clock > 0) s.clock -= dt;
  // the barista: wanders between the till and the machine, now and then into the kitchen
  const b = s.barista;
  b.blink -= dt; if (b.blink < -0.14) b.blink = 2.5 + r() * 3;
  if (b.wave > 0) b.wave -= dt;
  if (s.order) order(s, dt);
  else if (s.visitor && s.visitor.stage === 2 && !b.trip) b.goal = TILL;
  else if (!b.trip) {
    b.wait -= dt;
    if (b.wait <= 0) { if (r() < 0.14) b.trip = { stage: 0, t: 0, away: 3 + r() * 4 }; else { b.goal = pick(r, [TILL, MACHINE, MACHINE, 262, 232]); b.wait = 3 + r() * 5; } }
  }
  if (b.trip) {
    const k = b.trip; k.t += dt;
    if (k.stage === 0) { b.goal = KITCHEN; if (Math.abs(b.x - KITCHEN) < 1) { k.stage = 1; k.t = 0; s.curtain = 1; } }
    else if (k.stage === 1) { b.vis = Math.max(0, 1 - k.t / 0.7); if (k.t >= 0.7) { k.stage = 2; k.t = 0; } }
    else if (k.stage === 2) { if (k.t >= k.away) { k.stage = 3; k.t = 0; s.curtain = 1; } }
    else { b.vis = Math.min(1, k.t / 0.7); if (k.t >= 0.7) { b.trip = null; b.goal = TILL; b.wait = 2 + r() * 2; } }
  }
  const dx = b.goal - b.x;
  b.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 16);
  b.work = Math.abs(b.x - MACHINE) < 1 && b.vis >= 1 ? b.work + dt : 0;
  if (s.machine > 0) s.machine -= dt;
  if ((b.work > 0.5 && r() < dt * 3) || (s.machine > 0 && r() < dt * 14)) s.puffs.push({ x: ox + 262 + r() * 4, y: 146 + r() * 3, l: 1, k: 0, vx: (r() - 0.5) * 4 });
  s.gauge += ((b.work > 0 || s.machine > 0 ? 1 : 0.4) - s.gauge) * dt * 2;
  for (const q of s.puffs) { q.y -= dt * (q.street ? 7 : 11); q.x += q.vx * dt + Math.sin(t * 2 + q.y * 0.3) * dt * 2; q.l -= dt * (q.street ? 0.4 : 0.7); q.k += dt; }
  s.puffs = s.puffs.filter((q) => q.l > 0);
  s.curtain *= Math.exp(-dt * 1.1);
  // a customer now and then, in through the door with the bell (full screen)
  if (R.door) { if (s.visitor) visitorStep(s, R, dt); else { s.visitT -= dt; if (s.visitT <= 0) startVisitor(s, R); } }
  // the room
  for (const k in s.sway) { s.sway[k] *= Math.exp(-dt * 0.6); if (s.sway[k] < 0.02) delete s.sway[k]; }
  for (const h of s.hearts) { h.y -= dt * 10; h.x += Math.sin(t * 3 + h.p) * dt * 6; h.l -= dt * 0.45; }
  s.hearts = s.hearts.filter((h) => h.l > 0);
  for (const n of s.notes) { n.y -= dt * 12; n.x += Math.sin(t * 2.5 + n.p) * dt * 8; n.l -= dt * 0.4; }
  s.notes = s.notes.filter((n) => n.l > 0);
  for (const z of s.zs) { z.y -= dt * 5; z.x += Math.sin(t + z.p) * dt * 3; z.l -= dt * 0.3; }
  s.zs = s.zs.filter((z) => z.l > 0);
  const dog = R.L.fg.find((q) => q.kind === 'dog');
  if (dog && r() < dt * 0.25) s.zs.push({ x: dog.x - 16, y: 286, l: 1, p: r() * 6 });
  if (s.pet > 0) s.pet -= dt;
  if (s.purr > 0) { s.purr -= dt; if (r() < dt * 1.5) s.hearts.push({ x: ox + 26 + r() * 12, y: 158, l: 1, p: r() * 6 }); }
  s.catTail = Math.sin(t * 0.7) > 0.93 || s.purr > 0 ? 1 : 0;
  if (s.sip > 0) s.sip = Math.max(0, s.sip - dt / 1.1);
  if (s.pastry > 0) { s.pastry -= dt; if (s.pastry <= 0) { s.bites = 3; [79, 84].forEach((m, i) => tone(m, { dur: 0.7, vol: 0.03, delay: i * 0.12 })); } }
  s.candleL += ((s.candle ? 1 : 0) - s.candleL) * Math.min(1, dt * (s.candle ? 3 : 5));
  if (s.flip > 0) { s.flip -= dt / 0.7; if (s.flip <= 0) { s.flip = 0; s.page += 1; } }
  s.readerT -= dt;
  if (s.readerT <= 0) { s.readerTurn = 0.5; s.readerT = 8 + r() * 8; }
  if (s.readerTurn > 0) s.readerTurn -= dt;
  s.readerNod = Math.sin(t * 0.4) > 0.96 ? 1 : 0;
  if (s.bob > 0) { s.bob -= dt; if (r() < dt * 2.5) s.notes.push({ x: ox + 234 + (r() - 0.5) * 10, y: 146, l: 1, p: r() * 6, c: pick(r, ['#8ae0ff', '#ff8ab0', '#ffe08a']) }); }
  if (s.radio > 0) { s.radio -= dt; if (r() < dt * 2) s.notes.push({ x: ox + 228 + (r() - 0.5) * 8, y: 88, l: 0.8, p: r() * 6, c: pick(r, ['#ffe08a', '#ffcf87', '#8ae0ff']) }); }
  if (s.door > 0) s.door -= dt;
  if (s.bell > 0) s.bell -= dt;
  for (const d of s.drips) { d.y += d.v * dt; d.v += 120 * dt; }
  s.drips = s.drips.filter((d) => d.y < 214);
  const coat = R.L.mods.find((m) => m.t === 'coat');
  if (coat && r() < dt * 0.5) s.drips.push({ x: coat.x + 7, y: 198, v: 0 });
  for (const q of s.smoke) { q.y -= dt * 9; q.x += Math.sin(t * 2 + q.y * 0.2) * dt * 5; q.l -= dt * 0.5; }
  s.smoke = s.smoke.filter((q) => q.l > 0);
  for (const m of s.dust) { m.x += m.vx * dt + Math.sin(t * 0.4 + m.ph) * dt; m.y += m.vy * dt; if (m.y < 36) { m.y = 160; m.x = ox + 20 + r() * 180; } }
}

function startVisitor(s, R) {
  const r = s.rand;
  s.visitor = {
    x: R.door.x + 27 - R.ox, stage: 0, t: 0, dir: 1, a: 0, ph: 0, carry: false,
    coat: pick(r, ['#7a4a3a', '#3a5a6a', '#8a7a5a', '#4a3a5a', '#2f4f4a']), hair: pick(r, ['#2a1a18', '#6a3a22', '#c8a060', '#1a1a24']), skin: pick(r, ['#e2b08a', '#c88a64', '#8a5a3a', '#f0c8a0']),
    scarf: pick(r, ['#c84a5a', '#e8c050', '#5aa08a', null]), long: r() < 0.5, hat: r() < 0.3, umb: s.weather === 'clear' ? null : pick(r, UMBS),
  };
  s.door = 3.2; s.bell = 1.6; bell();
}
function visitorStep(s, R, dt) {
  const v = s.visitor, dc = R.door.x + 27 - R.ox;
  v.t += dt;
  if (v.stage === 0) { v.a = Math.min(1, v.t / 0.8); if (v.t > 1.6) { v.stage = 1; v.t = 0; } }
  else if (v.stage === 1) { v.x += 15 * dt; v.ph += dt * 15 / 4.5; if (v.x >= 202) { v.x = 202; v.stage = 2; v.t = 0; s.barista.wave = 1.4; } }
  else if (v.stage === 2) { if (v.t > 5) v.carry = true; if (v.t > 7.5) { v.stage = 3; v.t = 0; v.dir = -1; } }
  else if (v.stage === 3) { v.x -= 15 * dt; v.ph += dt * 15 / 4.5; if (v.x <= dc) { v.x = dc; v.stage = 4; v.t = 0; s.door = 3.2; s.bell = 1.6; bell(); } }
  else { v.a = Math.max(0, 1 - v.t / 0.8); if (v.t > 1) { s.visitor = null; s.visitT = 60 + s.rand() * 70; } }
}

// the barista makes you another latte, goes through to the back, and brings it round: her hand
// takes the empty cup away, then sets down the new one
function order(s, dt) {
  const o = s.order, b = s.barista, next = (k) => { o.stage = k; o.t = 0; };
  o.t += dt;
  if (o.stage === 0) {
    if (b.trip && b.trip.stage < 2) return;
    if (b.trip) b.trip.away = 0;
    if (b.vis < 1) return;
    b.goal = MACHINE;
    if (Math.abs(b.x - MACHINE) < 1) { if (!o.hiss) { o.hiss = true; o.t = 0; s.machine = 2.4; swish(0.05); drip(0.02, 260, 140); } else if (o.t > 2.8) next(1); }
  } else if (o.stage === 1) { if (!b.trip) b.trip = { stage: 0, t: 0, away: Infinity }; if (b.trip.stage === 2) next(2); }
  else if (o.stage === 2) { if (o.t >= 0.6) next(3); }
  else if (o.stage === 3) { if (o.t >= 1.1) next(4); }
  else if (o.stage === 4) { if (o.t >= 0.35) { s.cupGone = true; next(5); } }
  else if (o.stage === 5) { if (o.t >= 1) next(6); }
  else if (o.stage === 6) { if (o.t >= 0.6) next(7); }
  else if (o.stage === 7) {
    if (o.t >= 1.1) { s.cup = 1; s.cupGone = false; [72, 76, 79, 84].forEach((m, i) => tone(m, { dur: 1.2, vol: 0.035, delay: i * 0.11 })); next(8); o.done?.(); }
  } else if (o.stage === 8 && o.t >= 1) { if (b.trip) b.trip.away = 0; s.order = null; }
}

function armPos(s, R) {
  const o = s.order;
  if (!o || o.stage < 3 || o.stage === 6 || o.stage > 8) return null;
  let k = 1, carry = 0;
  if (o.stage === 3) k = ease(o.t / 1.1);
  else if (o.stage === 5) { k = 1 - ease(o.t / 1); carry = 1; }
  else if (o.stage === 7) { k = ease(o.t / 1.1); carry = 2; }
  else if (o.stage === 8) k = 1 - ease(o.t / 1);
  const u = 1 - k, hx = R.ox + CUP.x + 27, hy = CUP.y + 14;
  return { x: hx + u * 96, y: hy + u * 62 - Math.sin(u * Math.PI) * 8, carry };
}

/* ——— drawing a frame ——— */

function render(R, s) {
  const f = R.f, S = sprites(), t = s.t, ox = R.ox, X = (x) => ox + x;
  f.imageSmoothingEnabled = false;
  f.globalAlpha = 1;
  f.clearRect(0, 0, R.BW, H);
  // sky, drifting clouds, the city: the old weather fading into the new
  if (s.wxK < 1) { sky(f, s, wxLayer(R, s.wxFrom), s.wxFrom, 1); sky(f, s, wxLayer(R, s.weather), s.weather, ease(s.wxK)); }
  else sky(f, s, wxLayer(R, s.weather), s.weather, 1);
  street(f, R, s, S);
  // the room behind the counter, the barista (and the kitchen curtain she passes), the counter
  f.globalAlpha = 1; f.drawImage(R.back, 0, 0);
  const b = s.barista, behind = !!b.trip && b.trip.stage >= 1;
  if (!behind) curtain(f, R, s);
  if (b.vis > 0) {
    const still = Math.abs(b.goal - b.x) <= 0.5, till = still && Math.abs(b.x - TILL) < 1 && Math.sin(t * 0.9) > 0;
    const arm = b.wave > 0 ? 2 : b.work > 0 ? (Math.floor(b.work * 2.5) % 2) : till ? (Math.floor(t * 3) % 2) : 0;
    const walk = Math.abs(b.goal - b.x) > 0.5 ? Math.floor(t * 6) % 2 : 0;
    f.globalAlpha = b.vis; f.drawImage(S.barista[`${arm}${b.blink < 0 ? 1 : 0}`], Math.round(X(b.x) - 11), 117 + walk); f.globalAlpha = 1;
  }
  if (behind) curtain(f, R, s);
  f.drawImage(R.mid, 0, 0);
  room(f, R, s, S);
  // your table
  f.globalAlpha = 1; f.drawImage(R.front, 0, 0);
  table(f, R, s, S);
  f.globalAlpha = 1; f.drawImage(R.vig, 0, 0);
}

function sky(f, s, L, wx, a) {
  f.globalAlpha = a; f.drawImage(L.sky, 0, 0);
  if (wx === 'clear') {
    for (const st of L.stars) fr(f, st.x, st.y, 1, 1, '#ffffff', a * (0.4 + 0.6 * Math.abs(Math.sin(s.t * st.sp + st.ph))));
    if (s.shoot) for (let k = 0; k < 6; k++) fr(f, s.shoot.x - k * 3, s.shoot.y - k, 2, 1, '#ffffff', a * s.shoot.l * (1 - k / 6));
  }
  const cw = L.clouds.w, off = (s.t * 1.6) % cw;
  f.globalAlpha = a; f.drawImage(L.clouds.cv, -off, 0); f.drawImage(L.clouds.cv, cw - off, 0);
  f.drawImage(L.city, 0, 0);
  f.globalAlpha = 1;
}

function street(f, R, s, S) {
  const t = s.t, I = R.I, ar = s.amt.rain, as = s.amt.snow;
  for (const b of I.blink) { const on = ((t + b.ph) % b.per) < (b.on ?? 0.25) * b.per; if (on) { fr(f, b.x, b.y, 1, 1, b.c); fr(f, b.x - 1, b.y - 1, 3, 3, b.c, 0.25); } }
  for (const w of I.toggles) { const on = (((t + w.ph) % w.per) < w.per / 2) === w.on; fr(f, w.x, w.y, 4, 5, on ? w.c : '#0b0e22'); }
  for (const w of I.tvs) { const k = Math.sin(t * 0.9 + w.ph) + 0.6 * Math.sin(t * 0.33 + w.ph * 2); fr(f, w.x, w.y, 4, 5, k > 0.5 ? '#cfefff' : k > -0.4 ? '#8fdcec' : '#4a8ab0', 0.9); }
  if (s.flick.t > 0 && I.neons[s.flick.i]) { const n = I.neons[s.flick.i]; if (Math.floor(s.flick.t * 5) % 3 === 0) fr(f, n.x, n.y, n.w, n.h, '#0a0b18', 0.7); }
  if (I.signal) {
    const ph = (t + s.sigOff) % 18, k = ph < 8 ? 2 : ph < 10 ? 1 : 0, c = ['#ff4a4a', '#ffb347', '#5aff9a'][k];
    fr(f, I.signal.x, I.signal.y + k * 3, 3, 2, c); fr(f, I.signal.x - 1, I.signal.y + k * 3 - 1, 5, 4, c, 0.25);
    for (let y = 151; y < 168; y += 1) if ((y + Math.floor(t * 3)) % 3) fr(f, I.signal.x + Math.round(Math.sin(y * 1.7)), y, 2, 1, c, 0.35 * (1 - (y - 151) / 17) * (0.4 + ar * 0.6));
  }
  // a can rolls out of the vending machine
  if (s.can > 0 && I.vend) { const v = I.vend, k = Math.min(1, (2.6 - s.can) / 0.3); fr(f, v.x + 3, Math.round(131 + k * 9), 3, 2, '#e04a4a'); fr(f, v.x + 3, Math.round(131 + k * 9), 1, 1, '#ffd0d0'); if (s.can > 2.3) fr(f, v.x + 1, 130, 8, 6, '#ffffff', 0.25); }
  // steam from the manhole
  for (const q of s.puffs) if (q.street) { const sp = S.puffs[Math.min(4, Math.floor(q.k * 1.2))]; f.globalAlpha = q.l * 0.22; f.drawImage(sp, Math.round(q.x - sp.width / 2), Math.round(q.y - sp.height / 2)); }
  f.globalAlpha = 1;
  // people on the far pavement
  for (const w of s.walkers) if (!w.near) farWalker(f, w, s);
  // cars, their lights smeared on the wet road
  for (const c of s.cars) {
    const sp = S.cars[c.spr], x = Math.round(c.x - 19), y = c.dir > 0 ? 154 : 151, front = c.dir > 0 ? x + 37 : x, wet = 0.4 + ar * 0.6;
    for (let k = 0; k < 6; k++) fr(f, c.dir > 0 ? front + k * 6 : front - 6 - k * 6, y + 6 - Math.floor(k / 2), 6, 2 + Math.floor(k / 2), '#fff2c0', 0.22 - k * 0.03);
    for (let yy = y + 13; yy < 172; yy++) { const a = 0.45 * wet * (1 - (yy - y - 13) / (172 - y - 13)); fr(f, front - 1 + Math.round(Math.sin(yy * 2.1)), yy, 2, 1, '#fff2c0', a); fr(f, (c.dir > 0 ? x : x + 36) + Math.round(Math.sin(yy * 1.7)), yy, 2, 1, '#ff4a4a', a * 0.7); }
    f.globalAlpha = 0.18 * wet; f.drawImage(c.dir > 0 ? sp.r : sp.l, x, y + 13, 38, 6);
    f.globalAlpha = 1; f.drawImage(c.dir > 0 ? sp.r : sp.l, x, y);
  }
  // people passing close by the window
  for (const w of s.walkers) if (w.near) nearWalker(f, w, s, S);
  // rain (lit up where it falls through a street lamp's light), snow, splashes, ripples
  if (ar > 0.01) {
    const lim = s.rain.length * ar;
    for (let i = 0; i < lim; i++) {
      const d = s.rain[i];
      let c = d.near ? '#c8d6ff' : '#8a9ac8', a = d.near ? 0.5 : 0.35;
      if (!d.near && d.y > 88 && d.y < 146) for (const L of I.lamps) if (Math.abs(d.x - L.x) < 15 && Math.abs(d.y - L.y) < 24) { c = '#ffe2a8'; a = 0.8; break; }
      fr(f, d.x, d.y, 1, d.l, c, a);
    }
    for (const q of s.splashes) { fr(f, q.x, q.y - 1, 1, 1, '#d8e4ff', q.l * 4); fr(f, q.x - 1, q.y, 1, 1, '#d8e4ff', q.l * 3); fr(f, q.x + 1, q.y, 1, 1, '#d8e4ff', q.l * 3); }
  }
  if (as > 0.01) { const lim = s.flakes.length * as; for (let i = 0; i < lim; i++) { const fl = s.flakes[i]; fr(f, fl.x, fl.y, fl.sz, fl.sz, '#f2f6ff', 0.85); } }
  for (const q of s.ripples) { const rr = 1 + q.a * 5, a = 0.5 * (1 - q.a / 0.9); fr(f, q.x - rr, q.y, 1, 1, '#9fb0e0', a); fr(f, q.x + rr, q.y, 1, 1, '#9fb0e0', a); fr(f, q.x - rr * 0.6, q.y - 1, rr * 1.2, 1, '#9fb0e0', a * 0.7); fr(f, q.x - rr * 0.6, q.y + 1, rr * 1.2, 1, '#9fb0e0', a * 0.5); }
  // drops running down the glass (not on the door's while it swings open)
  if (ar > 0.01) for (const d of s.drops) {
    if (d.g.door && s.door > 0) continue;
    for (const q of d.trail) fr(f, q.x, q.y, 1, 1, '#b8c8f0', q.l * 0.3 * ar);
    fr(f, d.x, d.y, d.sz, d.sz + 1, '#c8d8ff', 0.55 * ar); fr(f, d.x, d.y, 1, 1, '#ffffff', 0.8 * ar); fr(f, d.x, d.y + d.sz + 1, d.sz, 1, '#1a1a3a', 0.4 * ar);
  }
  if (as > 0.01) for (const g of R.glass) if (g.h > 40 && !(g.door && s.door > 0)) {
    for (let k = 0; k < g.w; k += 2) { const hh = 1 + Math.round((Math.sin(k * 0.9 + g.x) + 1) * 1.5); fr(f, g.x + k, g.y + g.h - hh, 2, hh, '#e8eef8', 0.55 * as); }
    fr(f, g.x, g.y, 3, 2, '#e8eef8', 0.3 * as); fr(f, g.x, g.y, 2, 4, '#e8eef8', 0.3 * as); fr(f, g.x + g.w - 3, g.y, 3, 2, '#e8eef8', 0.3 * as);
  }
  f.globalAlpha = 1;
}

function farWalker(f, w, s) {
  const x = Math.round(w.x), y = 148, st = Math.floor(w.ph) % 2, umb = s.weather !== 'clear', tl = w.tilt > 0 ? (Math.sin(w.tilt * 5) > 0 ? 1 : -1) : 0;
  fr(f, x - 1 + st, y - 3, 1, 3, '#0e0e18'); fr(f, x + 1 - st, y - 3, 1, 3, '#0e0e18');
  fr(f, x - 1, y - 8, 3, 5, w.coat); fr(f, x - 1, y - 8, 1, 5, '#000000', 0.3);
  fr(f, x - 1, y - 10, 3, 2, w.skin); fr(f, x - 1, y - 11, 3, 1, w.hair);
  if (umb) { fr(f, x - 4 + tl, y - 13, 9, 1, w.umb); fr(f, x - 3 + tl, y - 14, 7, 1, w.umb); fr(f, x - 1 + tl, y - 15, 3, 1, w.umb); fr(f, x - 3 + tl, y - 14, 3, 1, '#ffffff', 0.25); fr(f, x + w.dir, y - 12, 1, 4, '#1a1a1a'); }
  else if (w.wave > 0) fr(f, x + 2, y - 12, 1, 3, w.skin);
  if (w.dog && !umb) { const dx = x + w.dir * 5; fr(f, dx - 2, y - 3, 4, 2, '#c8a070'); fr(f, dx + w.dir * 2, y - 4, 2, 2, '#c8a070'); fr(f, dx - 2 + st, y - 1, 1, 1, '#c8a070'); fr(f, dx + 1 - st, y - 1, 1, 1, '#c8a070'); f.globalAlpha = 0.6; f.fillStyle = '#1a1a1a'; f.fillRect(Math.min(x, dx), y - 6, Math.abs(dx - x), 1); }
  f.globalAlpha = 1;
}

function walkSpr(S, o) {
  const key = [o.coat, o.frame, o.umb ? 1 : 0, o.hat ? 1 : 0, o.lit ? o.hair + o.skin : '', o.carry ? 1 : 0, o.wave ? 1 : 0, o.long ? 1 : 0, o.folded || '', o.scarf || ''].join('|');
  let g = S.walk.get(key);
  if (!g) { const p = walkerFrame(o); g = { r: p.canvas(), l: p.flipped().canvas() }; S.walk.set(key, g); }
  return g;
}
function umbSpr(S, c, tilt) {
  const key = c + tilt;
  let g = S.umb.get(key);
  if (!g) { g = umbrellaSprite(c, tilt); S.umb.set(key, g); }
  return g;
}

function nearWalker(f, w, s, S) {
  const x = Math.round(w.x), top = 145, umb = s.amt.rain + s.amt.snow > 0.5;
  const g = walkSpr(S, { coat: w.coat, skin: w.skin, hair: w.hair, frame: Math.floor(w.ph) % 4, umb, hat: w.hat && !umb, long: w.long, wave: !umb && w.wave > 0 });
  f.drawImage(w.dir > 0 ? g.r : g.l, x - 10, top);
  if (!umb) return;
  const tilt = w.tilt > 0 ? (Math.sin(w.tilt * 4) > 0 ? 1 : -1) : 0, hx = x + (w.dir > 0 ? 4 : -5), bob = Math.floor(w.ph) % 2 ? -1 : 0;
  fr(f, hx, top - 6 + bob, 1, 18, '#15151c');
  f.drawImage(umbSpr(S, w.umb, tilt), hx - 19, top - 15 + bob);
  if (s.amt.rain > 0.3) for (const k of [-18, -12, 11, 17]) { const ph = (s.t * 1.4 + k * 0.37 + w.ph * 0.2) % 1; fr(f, hx + k, top + 2 + bob + Math.round(k * tilt * 0.16) + ph * 9, 1, 1, '#c8d6ff', 0.7 * (1 - ph)); }
}

function lamp(f, L, s) {
  const t = s.t, a = s.sway[L.key] || 0, off = Math.round(Math.sin(t * 2.6) * a * 4);
  const steps = L.y - 11;
  if (!off) fr(f, L.x, 11, 1, steps, '#120a08');
  else for (let k = 0; k < steps; k++) fr(f, L.x + Math.round((off * k) / steps), 11 + k, 1, 1, '#120a08');
  const x = L.x + off, y = L.y, br = 0.93 + 0.07 * Math.sin(t * 0.7 + L.x);
  if (L.style === 1) {
    fr(f, x - 1, y - 1, 3, 1, C.brassS); fr(f, x - 4, y, 9, 2, C.brassS); fr(f, x - 6, y + 2, 13, 4, C.brass); fr(f, x - 6, y + 2, 3, 2, '#f0d080'); fr(f, x + 4, y + 2, 3, 4, C.brassS); fr(f, x - 7, y + 6, 15, 1, C.brassS);
    fr(f, x - 3, y + 7, 7, 1, '#ffe7b0'); fr(f, x - 2, y + 8, 5, 1, '#fff6dc');
  } else if (L.style === 2) {
    fr(f, x - 1, y - 1, 3, 2, C.brassS);
    fr(f, x - 2, y + 1, 5, 1, '#f0cc90'); fr(f, x - 3, y + 2, 7, 5, '#ffe8b8'); fr(f, x - 2, y + 7, 5, 1, '#f0cc90'); fr(f, x - 2, y + 3, 1, 2, '#ffffff'); fr(f, x + 2, y + 3, 1, 3, '#e8c088');
    glowAt(f, x, y + 4, 13, 12, '#ffcf87', 0.32, br);
    return;
  } else {
    fr(f, x - 1, y - 1, 3, 1, '#2a2a2a');
    fr(f, x - 3, y, 7, 2, '#2c4a44'); fr(f, x - 5, y + 2, 11, 2, '#2c4a44'); fr(f, x - 7, y + 4, 15, 3, '#2c4a44');
    fr(f, x - 3, y, 3, 1, '#4a7a70'); fr(f, x - 5, y + 2, 3, 1, '#4a7a70'); fr(f, x - 7, y + 4, 3, 1, '#4a7a70'); fr(f, x + 4, y + 4, 4, 3, '#1a2e2a');
    fr(f, x - 7, y + 7, 15, 1, '#c99a4a');
    fr(f, x - 3, y + 8, 7, 1, '#ffe7b0'); fr(f, x - 2, y + 9, 5, 1, '#fff6dc');
  }
  // the light falling from the shade: a soft cone, breathing very slightly
  glowAt(f, x, y + 26, 19, 20, '#ffcf87', 0.3, br);
  glowAt(f, x, y + 10, 8, 4, '#fff0c8', 0.55, br);
}

// the kitchen's curtain: two indigo panels that sway and part when the barista goes through
function curtain(f, R, s) {
  const x0 = R.ox + DOORWAY.x, t = s.t, a = s.curtain;
  fr(f, x0 - 1, 89, 18, 1, '#24160c');
  for (let y = 90; y < 122; y++) {
    const k = (y - 90) / 32, off = Math.round(Math.sin(t * 3.2 + y * 0.12) * a * 2.5 * k), part = Math.round(a * 3 * k);
    fr(f, x0 + off - part, y, 8, 1, '#2c3c6c'); fr(f, x0 + 8 + off + part, y, 8, 1, '#2c3c6c');
    fr(f, x0 + off - part + 7, y, 1, 1, '#1e2a50'); fr(f, x0 + 8 + off + part + 7, y, 1, 1, '#1e2a50');
    fr(f, x0 + off - part, y, 1, 1, '#3e5088'); fr(f, x0 + 8 + off + part, y, 1, 1, '#3e5088');
  }
  // a little cup and steam on each panel
  for (const [dx, sgn] of [[2, -1], [10, 1]]) { const o = Math.round(a * 2) * sgn; fr(f, x0 + dx + o, 104, 4, 3, '#e8e0d0'); fr(f, x0 + dx + 4 + o, 105, 1, 1, '#e8e0d0'); fr(f, x0 + dx + 1 + o, 101, 1, 2, '#e8e0d0', 0.7); fr(f, x0 + dx + 3 + o, 100, 1, 2, '#e8e0d0', 0.7); }
  fr(f, x0 - Math.round(a * 3), 121, 8, 1, '#1e2a50'); fr(f, x0 + 8 + Math.round(a * 3), 121, 8, 1, '#1e2a50');
}

function room(f, R, s, S) {
  const t = s.t, ox = R.ox, X = (x) => ox + x;
  // fairy lights
  for (const g of R.garland) { const a = 0.55 + 0.45 * Math.sin(t * 1.3 + g.ph); fr(f, g.x, g.y, 1, 2, g.c, a); fr(f, g.x - 1, g.y, 3, 2, g.c, a * 0.18); }
  // the neon sign in the window: once in a long while it stutters, briefly
  const ph = (t + 11) % 47, fl = ph < 0.9 && Math.floor(ph * 6) % 3 === 1 ? 0.55 : 1;
  f.globalAlpha = fl; f.drawImage(S.sign[s.neon], X(SIGN.x), SIGN.y); f.globalAlpha = 1;
  // pendant lamps, and the light falling from them
  for (const L of R.lamps) lamp(f, L, s);
  for (const m of s.dust) { const a = 0.25 + 0.35 * Math.sin(t * 1.5 + m.ph); if (a > 0) fr(f, m.x, m.y, 1, 1, '#ffe7b0', a); }
  steam(f, X(118), 163, t * 0.8, 0.3, 7); steam(f, X(120), 163, t * 0.8 + 1.7, 0.25, 6);
  const jf = Math.sin(t * 5.1) + Math.sin(t * 7.7);
  fr(f, X(91), 160 - (jf > 0.9 ? 1 : 0), 1, 2 + (jf > 0.9 ? 1 : 0), '#ffb347'); fr(f, X(91), 161, 1, 1, '#fff1c8'); glowAt(f, X(91), 160, 6, 5, '#ffcf87', 0.4, 0.9 + jf * 0.04);
  // the reader on the window seat, the cat beside them
  const rf = s.readerTurn > 0 ? 1 : s.readerNod ? 2 : 0;
  f.globalAlpha = 1; f.drawImage(S.reader[s.neon][rf], X(120), 146);
  const breath = Math.sin(t * 1.6) > 0 ? 1 : 0, eyes = s.purr > 0 ? 1 : 0;
  f.drawImage(S.cat[s.neon][breath][eyes][s.catTail], X(21), 161);
  // the sign's colour spills over the sill, the cushion and the cat
  f.globalAlpha = 0.85 * fl; f.drawImage(S.spill[s.neon], X(-7), 158); f.globalAlpha = 1;
  fr(f, X(20), 170, 80, 1, NEON[s.neon].tube, 0.3 * fl);
  for (const h of s.hearts) heart(f, h.x, h.y, '#ff8fb1', h.l);
  // the counter: steam, the pressure gauge, the special on the chalkboard, the radio's dial
  for (const q of s.puffs) if (!q.street) { const sp = S.puffs[Math.min(4, Math.floor(q.k * 2))]; f.globalAlpha = q.l * 0.5; f.drawImage(sp, Math.round(q.x - sp.width / 2), Math.round(q.y - sp.height / 2)); }
  f.globalAlpha = 1;
  const ga = -2.4 + s.gauge * 2.2 + Math.sin(t * 9) * 0.05 * s.gauge;
  fr(f, X(297) + Math.round(Math.cos(ga) * 2), 136 + Math.round(Math.sin(ga) * 2), 1, 1, '#d8302a'); fr(f, X(297), 136, 1, 1, '#3a3a3a');
  textF(f, 'TODAY', X(212), 54, '#d8b060'); textF(f, SPECIALS[s.special], X(236), 54, '#e08aac');
  glowAt(f, X(232), 97, 5, 4, '#ffcf87', 0.5, s.radio > 0 ? 1 : 0.55); fr(f, X(231), 96, 2, 1, s.radio > 0 ? '#fff0c0' : '#e8c890');
  // the guest at the counter, swaying slowly (nodding along in time once you click)
  const sw = s.bob > 0 ? Math.floor(t * 2.5) % 2 : (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 0.31 + 1) * 0.5 > 0.45 ? 1 : 0);
  f.drawImage(S.stool[sw], X(222), 145);
  for (const n of s.notes) noteGlyph(f, n.x, n.y, n.c, n.l);
  // full screen: the door, its bell, the guests at their tables, the clock
  for (const m of R.L.mods) {
    f.globalAlpha = 1;
    if (m.t === 'door') {
      const open = s.door > 0 ? Math.min(1, Math.min(s.door, 3.2 - s.door) * 2.5) : 0, dw = Math.max(4, Math.round(42 * (1 - open * 0.8)));
      door(f, m.x + 6, 94, dw);
      const ba = s.bell > 0 ? Math.sin(s.bell * 18) * s.bell * 0.8 : 0, bx = m.x + 45, by = 86;
      fr(f, bx - 4, by, 5, 1, C.brassS); fr(f, bx, by, 1, 3, '#3a3a3a');
      const bxx = bx + Math.round(ba * 2);
      fr(f, bxx - 2, by + 3, 5, 3, C.brass); fr(f, bxx - 3, by + 6, 7, 1, C.brass); fr(f, bxx - 2, by + 3, 1, 3, '#f0d080'); fr(f, bxx, by + 7, 1, 1, '#5a4a2a');
    } else if (m.t === 'table' || m.t === 'table2') guestsAt(f, m, s, S);
    else if (m.t === 'case') {
      const d = new Date(), hr = ((d.getHours() % 12) + d.getMinutes() / 60) / 12, mn = d.getMinutes() / 60, sh = s.clock > 0 ? Math.round(Math.sin(s.clock * 30) * s.clock * 0.6) : 0;
      hand(f, m.x + 19 + sh, 44, hr * Math.PI * 2, 4, '#2a1a14'); hand(f, m.x + 19 + sh, 44, mn * Math.PI * 2, 6, '#2a1a14'); fr(f, m.x + 19 + sh, 44, 1, 1, '#a83a3a');
    }
  }
  for (const d of s.drips) fr(f, d.x, d.y, 1, 2, '#9ab0e0', 0.7);
  // a customer, in from the street
  if (s.visitor) {
    const v = s.visitor, walking = v.stage === 1 || v.stage === 3;
    const g = walkSpr(S, { coat: v.coat, skin: v.skin, hair: v.hair, frame: walking ? Math.floor(v.ph) % 4 : 0, lit: true, carry: v.carry, folded: v.carry ? null : v.umb, scarf: v.scarf, long: v.long, hat: v.hat });
    const vx = Math.round(X(v.x));
    f.globalAlpha = v.a; f.drawImage(v.dir > 0 ? g.r : g.l, vx - 10, 175); f.globalAlpha = 1;
    if (v.umb && !v.carry && v.stage < 2 && s.weather === 'rain') fr(f, vx + 8 * v.dir, 214 + ((t * 30) % 6), 1, 1, '#9ab0e0', 0.7);
    if (v.stage === 2 && v.t > 0.6 && v.t < 4) bubble(f, vx - 6, 160, '...');
  }
  f.globalAlpha = 1;
}

function bubble(f, x, y, text) {
  const w = text.length * 4 + 3;
  fr(f, x + 1, y, w - 2, 9, '#f6f0e4'); fr(f, x, y + 1, w, 7, '#f6f0e4'); fr(f, x + 3, y + 9, 2, 1, '#f6f0e4'); fr(f, x + 3, y + 10, 1, 1, '#f6f0e4');
  textF(f, text, x + 2, y + 2, '#5a3a2a');
}

function tableCup(f, cx, y) {
  fr(f, cx - 2, y, 5, 5, '#efe4cf'); fr(f, cx + 3, y + 1, 1, 2, '#efe4cf'); fr(f, cx - 2, y, 5, 1, '#8a5a3a'); fr(f, cx + 2, y + 1, 1, 4, '#c9b89c'); fr(f, cx - 3, y + 5, 8, 1, '#d8cfc0');
}

// what a guest on their own is doing right now: in bursts, with pauses
function activity(prop, t, seed, mx) {
  const burst = hash(Math.floor((t + seed) / 2.6), mx | 0) < 0.6;
  if (prop === 'laptop') return burst && Math.sin(t * 7 + seed) > 0 ? 'B' : 'A';
  if (prop === 'write') return burst && Math.sin(t * 3 + seed) > 0 ? 'B' : 'A';
  if (prop === 'knit') return burst && Math.sin(t * 4 + seed) > 0 ? 'B' : 'A';
  if (prop === 'book') return (t + seed) % 11 < 0.5 ? 'B' : 'A';
  if (prop === 'paper') return (t + seed) % 13 < 2.4 ? 'B' : 'A';
  return (t + seed) % 4.5 < 0.35 ? 'B' : 'A';
}

function guestSpr(S, gv, pose, prop) {
  const key = `${gv % GV.length}|${pose}|${prop}`;
  let g = S.guests.get(key);
  if (!g) { const p = guestFrame(GV[gv % GV.length], pose, prop); g = { r: p.canvas(), l: p.flipped().canvas() }; S.guests.set(key, g); }
  return g;
}

function guestsAt(f, m, s, S) {
  const t = s.t, seed = m.x * 0.37, look = (s.guestLook[m.x] || 0) > t;
  if (m.t === 'table2') {
    // a pair chatting: one talks, the other listens; now and then a sip, now and then a pause
    const v = hash(Math.floor((t + seed) / 2.4), m.x | 0), wob = Math.sin(t * 2.3 + seed) + Math.sin(t * 1.3) > 0.3;
    const pa = look ? 'look' : v < 0.4 ? (wob ? 'talk' : 'idle') : v >= 0.75 && v < 0.87 ? 'sip' : 'idle';
    const pb = look ? 'look' : v >= 0.4 && v < 0.75 ? (wob ? 'talk' : 'idle') : v >= 0.87 && v < 0.97 ? 'sip' : 'idle';
    f.drawImage(guestSpr(S, m.gv, pa, 'chat').r, m.x + 2, 165);
    f.drawImage(guestSpr(S, m.gv + 1, pb, 'chat').l, m.x + m.w - 32, 165);
    if (pa !== 'sip') { tableCup(f, m.tcx - 6, 184); steam(f, m.tcx - 6, 183, t + m.x, 0.35, 5); }
    if (pb !== 'sip') { tableCup(f, m.tcx + 5, 184); steam(f, m.tcx + 5, 183, t + m.x + 2, 0.35, 5); }
    if (look) { bubble(f, m.x + 7, 150, 'HI'); bubble(f, m.x + m.w - 18, 150, 'HI'); }
  } else {
    const face = m.face, gx = face > 0 ? m.x + 2 : m.x + m.w - 32;
    const pose = look ? 'look' : activity(m.prop, t, seed, m.x), g = guestSpr(S, m.gv, pose, m.prop);
    f.drawImage(face > 0 ? g.r : g.l, gx, 165);
    if (m.prop === 'laptop') glowAt(f, m.tcx - 9 * face, 180, 8, 7, '#8ae0ff', 0.36, 0.8 + 0.2 * Math.sin(t * 1.3 + seed));
    else if (m.prop === 'phone' && !look) glowAt(f, gx + (face > 0 ? 18 : 12), 181, 4, 4, '#8ae0ff', 0.4);
    const cx = m.prop === 'laptop' || m.prop === 'write' ? m.tcx + 6 * face : m.prop === 'knit' ? m.tcx - 3 * face : m.prop === 'paper' ? m.tcx + 2 * face : m.tcx - 2 * face;
    steam(f, cx, 183, t + m.x, 0.35, 5);
    if (look) bubble(f, gx + (face > 0 ? 8 : 12), 150, 'HI');
  }
}

// the door panel, `w` wide as it swings open; its glass is left unpainted so the street shows
function door(f, x, y, w) {
  if (w <= 14) { fr(f, x, y, w, 120, C.wood1); fr(f, x, y, 1, 120, C.wood3); return; }
  const gx = x + Math.round(w * 0.13), gw = Math.max(1, Math.round(w * 0.74));
  fr(f, x, y, w, 8, C.wood2); fr(f, x, y + 68, w, 52, C.wood2);
  fr(f, x, y + 8, gx - x, 60, C.wood2); fr(f, gx + gw, y + 8, x + w - gx - gw, 60, C.wood2);
  fr(f, x, y, 1, 120, C.wood3); fr(f, x + w - 1, y, 1, 120, C.wood0);
  fr(f, gx - 1, y + 7, gw + 2, 1, C.wood0); fr(f, gx - 1, y + 68, gw + 2, 1, C.wood3); fr(f, gx - 1, y + 8, 1, 60, C.wood0);
  fr(f, gx, y + 8, gw, 60, '#ffcf87', 0.05);
  for (let k = 0; k < 60; k++) fr(f, gx + Math.round(gw * 0.3 + (60 - k) * 0.4) % gw, y + 8 + k, 2, 1, '#ffffff', 0.06);
  const mx = gx + Math.round(gw / 2);
  fr(f, mx - 4, y + 9, 1, 7, '#8a7a60'); fr(f, mx + 4, y + 9, 1, 7, '#8a7a60');
  fr(f, mx - 10, y + 16, 21, 8, '#e8dcc0'); fr(f, mx - 10, y + 23, 21, 1, '#b8a888');
  textF(f, 'HELLO', mx - 9, y + 17, '#5a3a2a');
  for (const py of [76, 98]) { fr(f, gx, y + py, gw, 18, C.wood1); fr(f, gx, y + py, gw, 1, C.wood0); fr(f, gx, y + py + 17, gw, 1, C.wood3); }
  fr(f, x + w - 6, y + 64, 2, 6, C.brass); fr(f, x + w - 6, y + 64, 1, 6, '#f0d080');
  fr(f, x + 2, y + 114, w - 4, 5, C.brass, 0.7);
}

function hand(f, cx, cy, a, len, c) { for (let k = 0; k <= len; k++) fr(f, cx + Math.round(Math.sin(a) * k), cy - Math.round(Math.cos(a) * k), 1, 1, c); }

function steam(f, x, y, t, a, h) {
  for (let k = 0; k < h; k++) { const ph = (t * 0.8 + k * 0.2) % 1; fr(f, x + Math.round(Math.sin(t * 2 + k) * 1.2), y - k - 1, 1, 1, '#ffffff', a * (1 - k / h) * (0.5 + 0.5 * Math.sin(ph * 6.28))); }
}

function heart(f, x, y, c, a) {
  const rows = ['01010', '11111', '01110', '00100'];
  rows.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') fr(f, x + i, y + j, 1, 1, c, Math.max(0, Math.min(1, a))); }));
}
function noteGlyph(f, x, y, c, a) {
  const rows = ['0110', '0101', '0100', '1100', '1100'];
  rows.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') fr(f, x + i, y + j, 1, 1, c, Math.max(0, Math.min(1, a))); }));
}
function textF(f, str, x, y, c, a = 1) {
  f.globalAlpha = a; f.fillStyle = c;
  let cx = Math.round(x);
  for (const ch of str) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') f.fillRect(cx + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1); cx += 4; }
  f.globalAlpha = 1;
}

// the words on the open book's pages, following the bow of the paper
const PAGES = new Map();
function pageText(n) {
  if (PAGES.has(n)) return PAGES.get(n);
  const p = painter(96, 50), r = rng(1000 + n * 31);
  const dot = (x, y, c) => p.p(x, 6 + y + bookY(x), c);
  for (const side of [0, 1]) {
    const x0 = side ? 54 : 4, last = 4 + Math.floor(r() * 4);
    for (let l = 0; l < 9; l++) {
      if (side === 0 && n % 2 === 0 && l === 0) continue;
      let x = x0 + (l === 0 || l === last + 1 ? 3 : 0);
      const end = x0 + (l === last || l === 8 ? 18 + r() * 18 : 38);
      while (x < end) { const w = 2 + Math.floor(r() * 6); if (x + w > end) break; const oy = bookY(x + (w >> 1)); for (let k = 0; k < w; k++) p.p(x + k, 9 + Math.round(l * 3.6) + oy, '#857a68'); x += w + 1; }
    }
    if (side === 0 && n % 2 === 0) for (let k = 0; k < 22; k += 2) { const oy = bookY(x0 + 9 + k); p.r(x0 + 8 + k, 8 + oy, 2, 2, '#5a4a3a'); }
  }
  const num = (str, x, y) => { let cx = x; for (const ch of str) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') dot(cx + (i % 3), y + Math.floor(i / 3), '#a0927c'); cx += 4; } };
  num(String(41 + n * 2), 20, 31); num(String(42 + n * 2), 70, 31);
  if (PAGES.size > 6) PAGES.delete(PAGES.keys().next().value);
  const cv = p.canvas(); PAGES.set(n, cv); return cv;
}

function table(f, R, s, S) {
  const t = s.t, ox = R.ox, X = (x) => ox + x;
  // the croissant, bite by bite
  const cxp = X(PLATE.x), cyp = PLATE.y - 3;
  if (s.bites > 0) { f.globalAlpha = 1; f.drawImage(S.croissant[s.bites], cxp - 17, cyp - 10); }
  if (s.bites < 3) for (let k = 0; k < 7 - s.bites * 2; k++) fr(f, cxp - 12 + ((k * 7) % 24), cyp + 1 + (k % 3), 1, 1, k % 2 ? '#e0a24a' : '#c88634');
  // the book: words, and a page turning over
  f.globalAlpha = 1; f.drawImage(pageText(s.page), X(BOOK.x), BOOK.y - 6);
  if (s.flip > 0) {
    const k = 1 - s.flip, w = Math.round(Math.cos(k * Math.PI) * 47), lift = Math.round(Math.sin(k * Math.PI) * 6), n = Math.abs(w), x0 = X(BOOK.x) + 48;
    for (let i = 0; i < n; i++) {
      const xx = w >= 0 ? x0 + i : x0 - 1 - i, u = xx - X(BOOK.x), y = BOOK.y + bookY(u) - Math.round(lift * (i / Math.max(1, n)));
      fr(f, xx, y, 1, 36, i === n - 1 ? '#b8ab90' : w >= 0 ? '#e0d4ba' : '#cfc3a8');
      fr(f, xx, y, 1, 1, '#ece2ca');
    }
  }
  // the candle's warm pool on the table and the things on it: only while it burns
  const fl = Math.sin(t * 11) * 0.5 + Math.sin(t * 17.3) * 0.5;
  if (s.candleL > 0.01) { glowAt(f, X(CANDLE), 286, 76, 26, '#ffb35c', 0.32, s.candleL * (0.93 + fl * 0.05)); glowAt(f, X(CANDLE), 276, 30, 14, '#ffcf87', 0.32, s.candleL * (0.9 + fl * 0.08)); }
  // the latte: it lifts when you sip
  const arm = armPos(s, R);
  const lift = s.sip > 0 ? Math.round(Math.sin(Math.PI * (1 - s.sip)) * 10) : 0;
  const level = s.cup <= 0.01 ? 0 : Math.max(1, Math.round(s.cup * 4));
  if (!s.cupGone) {
    if (lift) fr(f, X(CUP.x) + 6, CUP.y + 24, 22, 2, '#000000', 0.25);
    f.globalAlpha = 1; f.drawImage(S.cups[level], X(CUP.x) - 2, CUP.y - lift);
    if (level > 0) for (let i = 0; i < 3; i++) for (let k = 0; k < 14; k++) {
      const ph = (t * 0.6 + i * 0.33) % 1, yy = CUP.y - 2 - lift - k * 1.5 - ph * 4;
      const a = 0.32 * (1 - k / 14) * Math.min(1, s.cup * 2) * (k < 2 ? k / 2 : 1);
      fr(f, X(CUP.x) + 9 + i * 6 + Math.round(Math.sin(t * 1.4 + k * 0.45 + i * 2) * 2), yy, 1, 1, '#ffffff', a);
    }
  }
  if (arm) {
    if (arm.carry) { f.globalAlpha = 1; f.drawImage(S.cups[arm.carry === 1 ? 0 : 4], Math.round(arm.x) - 29, Math.round(arm.y) - 14); }
    f.globalAlpha = 1; f.drawImage(S.arm, Math.round(arm.x) - ARM.x, Math.round(arm.y) - ARM.y);
  }
  // the candle's flame and halo
  const cx = X(CANDLE);
  if (s.candle) {
    const hgt = 7 + Math.round(fl), sway = Math.round(Math.sin(t * 3.1) * 0.6);
    glowAt(f, cx, 258, 13, 15, '#ffcf87', 0.45, 0.85 + fl * 0.1);
    fr(f, cx - 1 + sway, 263 - hgt, 3, hgt, '#ff9a3a'); fr(f, cx + sway, 264 - hgt, 1, 1, '#ffd070');
    fr(f, cx - 1, 260, 3, 3, '#ffd070'); fr(f, cx, 259 - Math.floor(hgt / 2), 1, Math.floor(hgt / 2) + 2, '#fff4d0');
  }
  fr(f, cx, 264, 1, 2, '#2a1a10');
  for (const q of s.smoke) fr(f, q.x, q.y, 1, 2, '#c8c0b8', q.l * 0.5);
  // the dog asleep by your table (full screen)
  for (const q of R.L.fg) if (q.kind === 'dog') f.drawImage(S.dog[Math.sin(t * (s.pet > 0 ? 2.4 : 1.1)) > 0 ? 1 : 0], Math.round(q.x) - 24, 283);
  for (const z of s.zs) textF(f, 'Z', z.x, z.y, '#c8c0e0', Math.max(0, z.l * 0.7));
  f.globalAlpha = 1;
}

/* ——— the shelf thumbnail ——— */

let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const R = build(320, 'rain');
    const s = makeState(7, rng(4242));
    seedParticles(s, R);
    s.t = 3.3;
    const w = (near, dir, x, coat, umb, hair, skin, ph) => ({ near, dir, v: 0, x: R.ox + x, coat, umb, hair, skin, ph, tilt: 0, wave: 0, hat: false, long: false, dog: false });
    s.walkers = [w(1, 1, 88, '#3a4a6a', '#c84a5a', '#2a1a18', '#e2b08a', 0.4), w(0, -1, 40, '#6a3a3a', '#3a7aa8', '#5a3a22', '#c88a64', 1.2), w(0, 1, 132, '#4a4a3a', '#e8c050', '#1a1a1a', '#f0c8a0', 0.1)];
    s.cars = [{ dir: -1, x: R.ox + 50, v: 0, spr: 2 }];
    for (let i = 0; i < 40; i++) step(s, R, 0.016);
    s.cars = [{ dir: -1, x: R.ox + 50, v: 0, spr: 2 }];
    render(R, s);
    PREV = R.buf;
  }
  // sharp pixels at whatever size the thumbnail is shown: a whole-number blow-up, then a smooth fit
  const m = ctx.getTransform?.(), sc = Math.max(1, Math.abs(m?.a || 1)), k = Math.max(1, Math.ceil((640 * sc) / H));
  let up = PREVUP.get(k);
  if (!up) { up = mk(320 * k, H * k); const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(PREV, 0, 0, 320 * k, H * k); PREVUP.set(k, up); }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(up, 0, 0, 640, 640);
  ctx.restore();
}

/* ——— the lounge ——— */

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const s = makeState((Date.now() % 100000) + 1);
  let R = null, W = canvas._snW || 640, seenBW = 0, seenAt = 0, built = -1e9, up = null, upc = null;
  const WTXT = { rain: 'Rain on the window', snow: 'Snow outside', clear: 'A clear evening' };
  const status = () => setScore(s.msg && s.msg.until > s.t ? s.msg.text : s.order && s.order.stage < 8 ? 'The barista is making you another latte…' : `${WTXT[s.weather]} · latte ${Math.round(Math.max(0, s.cup) * 100)}%${s.candle ? '' : ' · candle out'}`);
  const say = (text) => { s.msg = { text, until: s.t + 0.5 }; };
  setScore('Click the cup, the window, the sign, the cat, the book…');
  const hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  const amb = playAmbience({ rain: 0.8, murmur: 1, crackle: 0.15 }, isPaused);
  let stopMusic = playLoungeMusic('cafe', isPaused);

  const inR = (x, y, x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const at = (e) => { const q = pointIn(canvas, e), bx = (q.x / W) * R.BW, by = q.y / 2; return [bx - R.ox, by, bx, by]; };
  // what is under the pointer, as the thing to do if it's clicked (null: nothing there)
  function target(x, y, bx, by) {
    const b = s.barista;
    // your table
    if (inR(x, y, 86, 262, 46, 44)) return () => {
      if (s.order) { say('Your latte is on its way…'); if (b.vis > 0.5) b.wave = 1.2; note(7, { dur: 0.4, vol: 0.025 }); return; }
      if (s.sip > 0) return;
      if (s.cup > 0.01) {
        s.sip = 1; s.cup = Math.max(0, s.cup - 0.25); drip(0.05, 520, 260); tone(64, { dur: 0.3, vol: 0.015, delay: 0.25 });
        if (s.cup <= 0.01) { s.cup = 0; s.order = { stage: 0, t: 0, done: status }; }
      }
    };
    if (inR(x, y, 14, 276, 52, 28)) return () => {
      if (s.bites > 0) { s.bites -= 1; drip(0.03, 900, 500); tone(74, { dur: 0.2, vol: 0.015 }); }
      else if (s.pastry <= 0) { s.pastry = 1.4; say('Another croissant, coming up'); if (b.vis > 0.5) b.wave = 1.2; }
    };
    if (inR(x, y, 122, 250, 98, 52)) return () => { if (s.flip <= 0) { s.flip = 1; swish(0.04); } };
    if (inR(x, y, 232, 244, 28, 52)) return () => {
      s.candle = !s.candle;
      if (s.candle) tone(88, { dur: 0.35, vol: 0.025 }); else { drip(0.03, 420, 160); for (let k = 0; k < 6; k++) s.smoke.push({ x: R.ox + CANDLE, y: 258 - k * 3, l: 1 - k * 0.1 }); }
    };
    for (const q of R.L.fg) if (q.kind === 'dog' && inR(bx, by, q.x - 25, 282, 50, 30)) return () => { s.pet = 4; for (let k = 0; k < 3; k++) s.hearts.push({ x: q.x - 8 + k * 6, y: 282, l: 1 + k * 0.2, p: k * 2 }); tone(67, { dur: 0.5, vol: 0.03 }); tone(71, { dur: 0.5, vol: 0.025, delay: 0.15 }); };
    // the room
    for (const L of R.lamps) if (Math.abs(bx - L.x) < 9 && by > 11 && by < L.y + 10) return () => { s.sway[L.key] = 1; note(8 + (L.key % 3), { dur: 1.4, vol: 0.03 }); };
    if (inR(x, y, SIGN.x + 4, SIGN.y + 2, 58, 34)) return () => { s.neon = (s.neon + 1) % NEON.length; tone(76 + s.neon * 2, { dur: 0.5, vol: 0.04 }); tone(52, { dur: 0.2, vol: 0.012, type: 'square' }); };
    if (inR(x, y, 18, 158, 30, 32)) return () => {
      s.purr = 3.5; for (let k = 0; k < 3; k++) s.hearts.push({ x: R.ox + 24 + k * 6, y: 158, l: 1 + k * 0.2, p: k * 2 });
      tone(79, { dur: 0.8, vol: 0.035 }); for (let k = 0; k < 6; k++) tone(40 + (k % 2), { dur: 0.3, vol: 0.02, delay: 0.1 + k * 0.24 });
    };
    if (inR(x, y, 120, 146, 38, 44)) return () => { s.readerTurn = 0.6; s.readerT = 9; swish(0.03); };
    if (inR(x, y, 204, 14, 100, 54)) return () => { s.special = (s.special + 1) % SPECIALS.length; note(6 + (s.special % 3), { dur: 0.3, vol: 0.03 }); };
    if (inR(x, y, 220, 86, 20, 17)) return () => {
      // the radio: a twist of the dial, a breath of static, another station
      s.radio = 3; swish(0.07); drip(0.015, 2400, 900);
      stopMusic(); stopMusic = playLoungeMusic('cafe', isPaused);
      say('The radio finds another station');
    };
    if (inR(x, y, 246, 135, 18, 23)) return () => { if (s.bites < 3 && s.pastry <= 0) { s.pastry = 1.2; say('A fresh croissant for your plate'); } note(9, { dur: 0.4, vol: 0.03 }); tone(81, { dur: 0.3, vol: 0.02, delay: 0.12 }); };
    if (b.vis > 0.5 && inR(x, y, b.x - 9, 116, 18, 42)) return () => { b.wave = 1.6; note(7, { dur: 0.5, vol: 0.03 }); note(9, { dur: 0.5, vol: 0.03, delay: 0.15 }); };
    if (inR(x, y, 200, 88, 18, 50) && !b.trip && !s.order) return () => { s.curtain = 1; swish(0.025); };
    if (inR(x, y, 220, 143, 26, 50)) return () => { s.bob = 3.5; [5, 7, 9, 7].forEach((n, i) => note(n, { dur: 0.4, vol: 0.03, delay: i * 0.2 })); };
    if (inR(x, y, 258, 118, 62, 42)) return () => { s.machine = 2.2; if (!s.order && !b.trip) b.goal = MACHINE; swish(0.05); drip(0.02, 240, 130); };
    // full screen: the door, the guests, the pastry case and its clock
    for (const m of R.L.mods) {
      if (m.t === 'door' && inR(bx, by, m.x + 4, 82, 54, 132)) return () => {
        if (!s.visitor && R.door) startVisitor(s, R);
        else if (s.door <= 0) { s.door = 3.2; s.bell = 1.6; bell(); }
      };
      if ((m.t === 'table' || m.t === 'table2') && inR(bx, by, m.x, 156, m.w, 58)) return () => { s.guestLook[m.x] = s.t + 2.2; note(4 + (m.i % 4), { dur: 0.4, vol: 0.025 }); note(6 + (m.i % 4), { dur: 0.4, vol: 0.02, delay: 0.14 }); };
      if (m.t === 'case' && inR(bx, by, m.x + 7, 32, 24, 24)) return () => { s.clock = 1.4; [84, 80, 77, 72].forEach((n, i) => tone(n, { dur: 1.2, vol: 0.028, delay: i * 0.32, type: 'triangle' })); };
      if (m.t === 'case' && inR(bx, by, m.x, 130, m.w, 30)) return () => { if (s.bites < 3 && s.pastry <= 0) { s.pastry = 1.2; say('A fresh croissant for your plate'); } note(9, { dur: 0.4, vol: 0.03 }); };
    }
    // the street, through the glass
    if (!R.glass.some((g) => !g.door && inR(bx, by, g.x, g.y, g.w, g.h))) return null;
    for (const w of s.walkers) {
      const hit = w.near ? inR(bx, by, w.x - 17, 128, 34, 66) : inR(bx, by, w.x - 6, 131, 12, 18);
      if (hit) return () => { if (s.weather === 'clear') w.wave = 1.6; else w.tilt = 1.4; note(w.near ? 5 : 8, { dur: 0.35, vol: 0.022 }); };
    }
    const I = R.I;
    if (I.vend && inR(bx, by, I.vend.x - 1, 124, 12, 22)) return () => { if (s.can <= 0) { s.can = 2.6; drip(0.05, 300, 110); tone(55, { dur: 0.15, vol: 0.02, delay: 0.25, type: 'square' }); } };
    if (I.signal && inR(bx, by, I.signal.x - 3, 97, 9, 16)) return () => {
      const ph = (s.t + s.sigOff) % 18, edge = ph < 8 ? 8 : ph < 10 ? 10 : 18;
      s.sigOff += edge - ph + 0.01; tone(ph < 8 ? 81 : ph < 10 ? 76 : 84, { dur: 0.25, vol: 0.02 });
    };
    // the window itself: rain → snow → a clear evening, each fading into the next
    return () => {
      s.wxFrom = s.weather; s.wxK = 0;
      s.weather = s.weather === 'rain' ? 'snow' : s.weather === 'snow' ? 'clear' : 'rain';
      weather(R, s.weather);
      amb.set('rain', s.weather === 'rain' ? 0.8 : 0);
      tone(s.weather === 'clear' ? 84 : s.weather === 'snow' ? 81 : 77, { dur: 1, vol: 0.035 });
    };
  }
  const onDown = (e) => {
    canvas.focus({ preventScroll: true });
    if (!R) return;
    const act = target(...at(e));
    if (act) { act(); status(); }
  };
  const onMove = (e) => { if (R) canvas.style.cursor = target(...at(e)) ? 'pointer' : ''; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);

  function frame(dt) {
    W = canvas._snW || 640;
    const now = performance.now(), BW = Math.max(CORE, Math.round((H * W) / 640));
    if (BW !== seenBW) { seenBW = BW; seenAt = now; }
    if (!R) { R = build(BW, s.weather); built = now; seedParticles(s, R); }
    else if (R.BW !== BW && (now - seenAt >= 150 || now - built > 500)) {
      // a jump (into full screen, say) rebuilds at once; a drag waits until the width settles,
      // stretching the old picture meanwhile
      const old = R;
      R = build(BW, s.weather); built = now;
      shiftScene(s, R.ox - old.ox); seedParticles(s, R);
    } else if (R.jobs.length && now - built > 900) R.jobs.shift()();
    if (R.wx !== s.weather) weather(R, s.weather);
    step(s, R, dt);
    render(R, s);
    // crisp, even pixels at any size: blow the buffer up by a whole number with smoothing off,
    // then fit that to the canvas smoothly (at most a little under 2:1, so nothing smears)
    const pw = canvas.width, ph = canvas.height, k = Math.max(1, Math.ceil(ph / H));
    if (!up || up.width !== R.BW * k || up.height !== H * k) { up = mk(R.BW * k, H * k); upc = up.getContext('2d'); }
    upc.imageSmoothingEnabled = false; upc.drawImage(R.buf, 0, 0, R.BW * k, H * k);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(up, 0, 0, pw, ph);
    ctx.restore();
  }
  const stop = runLoop(frame, isPaused);
  return () => {
    clearTimeout(hint); stop(); stopMusic(); amb.stop();
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.style.cursor = '';
  };
}
