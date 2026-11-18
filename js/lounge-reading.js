// Reading Room — a lounge, not a game: a small private library in an old house on a rainy night,
// seen from your armchair. Pixel art, drawn into a small buffer (320 px tall, as wide as the
// frame's shape) and scaled up by whole steps with no smoothing, so every pixel stays square;
// only when the frame isn't a whole multiple of 320 tall is the last little step smoothed.
// The middle of it is a tall arched window with the rain running down the glass: beyond, a dark
// garden, a wall and a gate, a gas lamp in the wet, the roofs and spire of an old town, and clouds
// that light up now and then with lightning far away. Before it stands the reading table: an old
// book open, its pages lifting and turning, tea steaming on a saucer, a green banker's lamp,
// spectacles, a teapot, an hourglass on a stack of leather books. Around it, shelves to the
// ceiling with a ladder on a brass rail, a fireplace with a clock, a globe and candles on the
// mantel, a cat asleep on a cushion by the hearth, and your own wing chair, its leather arm in
// front of you with a mustard throw over it. In full screen the library goes on in whole bays,
// each drawn only when all of it is on screen: a reading nook with a little window and a window
// seat, more shelves, a standing lamp and a fern on the left; a writing desk under a second
// window, more shelves and a floor globe on the right. What is left at the edges is plain wall.
// Light works as in the Night Room: every still surface is painted once in its daylight colours,
// then each pixel takes its colour from a short ramp made for that colour (night teal and indigo
// on one side, lamp amber and honey on the other), stepped by how much cool and warm light reaches
// it, with ordered dither only where two steps meet. The room is baked once per frame shape for
// the lamp on and off and the fire low and high; each frame blends those by the lamp's state and
// the fire's flicker, and draws only the moving things over them. A candle snuffed or a lamp put
// out re-bakes just the patch of room it lit, a slice a frame.

import { setupCanvas, runLoop, pointIn, note, tone, drip, swish, rumble, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'reading', title: 'Reading Room', blurb: 'An old library on a rainy night: a green lamp, an open book, tea, and the fire.', keys: 'Click the book, the lamp, the fire, the window…', lounge: true };

const H = 320;                                    // buffer height; the core composition is 320 wide
const STEP = 16;                                  // room widths round up to this, so a resize doesn't rebuild every frame
const SIDE = '#130e10';                           // the edges, for the moment a wider room is still being built
// the arched windows' glass: the big one in the middle, the nook's and the desk's (full screen).
// rows: the transoms; src: where in the panorama of the night each one looks
const WIN = { id: 0, x: 120, w: 80, cx: 160, cy: 78, r: 40, top: 38, bot: 196, src: 100, rows: [78, 117, 156] };
const NOOK = { id: 1, x: -64, w: 32, cx: -48, cy: 94, r: 16, top: 78, bot: 184, src: 28, rows: [94, 138] };
const DWIN = { id: 2, x: 346, w: 32, cx: 362, cy: 88, r: 16, top: 72, bot: 174, src: 198, rows: [88, 131] };
const PW = 240, PH = 164, PY = 32;                // the night outside, one panorama all the windows look onto
const FLOOR = 246;                                // where the floor meets the wall
const TB = 230, TF = 280;                         // the reading table's top: its back and front edges
// its sides run toward the same vanishing point as the floorboards and the rug, (160, 108)
const tL = (y) => Math.round(80 - ((Math.min(y, TF) - TB) * 80) / 122);
const tR = (y) => Math.round(246 + ((Math.min(y, TF) - TB) * 86) / 122);
const BOX = { x0: 260, x1: 292, cx: 276, cy: 196, r: 16, bot: 234 };   // the fireplace's arched opening
const CLOCK = { x: 277, y: 128 };
const GLOBE = { x: 301, y: 137, r: 6 };
const BOOK = { x0: 126, x1: 194, y0: 246 };
const CUP = { x: 114, y: 268 };                   // the saucer's centre
const HOUR = { x: 229, y: 193 };                  // the hourglass's top plate
const CANDLES = [[241, 121], [314, 123]];         // the mantel candles' wicks
const DESKC = [388, 171];                         // the desk candle's wick, on the desk's gallery (full screen)
const NLAMP = [-21, 189];                         // the candle in the nook's lantern (full screen)
const RAILY = 23;                                 // the ladder's brass rail
const LAMPP = { x: 172, y: 68 };                  // the gas lamp outside, in panorama pixels
const MOON = { x: 152, y: 20 };
const PUDDLES = [[124, 148, 6], [140, 156, 9], [116, 160, 7], [154, 144, 5], [212, 150, 6], [44, 156, 7]];
const RLV = [0, 0.42, 1];
const RAINS = ['The rain has stopped', 'A soft rain on the window', 'Rain streaming down the glass'];
const FLO = 0.55, FHI = 1;                        // the fire's light, low and high, for the two bakes

// Full screen: the room goes on either side in whole bays, outward from the core. A bay is
// painted, lit and clickable only when all of it is always on screen at this room width (the
// frame can be up to STEP - 1 narrower than the room); what is left at the edge is plain wall.
// The nook and the desk can only ever come first, so they always sit at the same place.
const LEFT_BAYS = [['nook', 96], ['shelf', 64], ['lamp', 24], ['fern', 36]];
const RIGHT_BAYS = [['desk', 76], ['shelf', 90], ['globe', 36]];
function layoutFor(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox;
  const vL = rw > 320 ? L + (STEP >> 1) : 0, vR = rw > 320 ? RT - (STEP >> 1) : 320;
  const lay = { ox, L, RT, vL, vR, bays: [], wins: [WIN], nook: null, desk: null, lamp: null, fern: null, globe: null };
  let x = 0;
  for (const [kind, w] of LEFT_BAYS) if (x - w >= vL) { const b = { kind, side: -1, x0: x - w, x1: x, first: x === 0 }; lay.bays.push(b); if (!lay[kind]) lay[kind] = b; x -= w; }
  lay.lEnd = x;
  x = 324;
  for (const [kind, w] of RIGHT_BAYS) if (x + w <= vR) { const b = { kind, side: 1, x0: x, x1: x + w, first: x === 324 }; lay.bays.push(b); if (!lay[kind]) lay[kind] = b; x += w; }
  lay.rEnd = x;
  if (lay.nook) lay.wins.push(NOOK);
  if (lay.desk) lay.wins.push(DWIN);
  // the ladder runs along the middle shelves, and on along a bay of shelves right beside them
  lay.ladLo = lay.bays.some((b) => b.kind === 'shelf' && b.side < 0 && b.first) ? -54 : 12;
  return lay;
}

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
// a stepped level: flat inside each step, a narrow band of ordered dither where two steps meet
const band = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.36 ? i : f > 0.64 ? i + 1 : bay(x, y) < (f - 0.36) / 0.28 ? i + 1 : i; };
// the same, with a narrower seam, for the light baked on the room
const bandN = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.43 ? i : f > 0.57 ? i + 1 : bay(x, y) < (f - 0.43) / 0.14 ? i + 1 : i; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.round(a * 1000) / 1000})`;
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const inWin = (W, x, y) => x >= W.x && x < W.x + W.w && y < W.bot && (y >= W.cy || sq(x + 0.5 - W.cx, y + 0.5 - W.cy) < W.r);

/* ——— a little raster to paint the still layers in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); this.mark = 0; }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  bay(x, y) { return bay(Math.floor(x + this.ox), Math.floor(y + this.oy)); }
  px(x, y, c, a = 1) {
    const i = this.at(x, y);
    if (i < 0 || a <= 0) return;
    const d = this.d, r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = this.mark || 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a), k = da * (1 - a);
    const na = Math.round(oa * 255);   // 253 and 254 are flags (see bakeGen), never a blend's result
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 253 ? 255 : na;
  }
  tint(x, y, c, a) { const i = this.at(x, y); if (i >= 0 && this.d[i + 3]) this.px(x, y, c, a); }
  get(x, y) { const i = this.at(x, y); return i < 0 || !this.d[i + 3] ? -1 : (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]; }
  clear(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = this.at(xx, yy); if (i >= 0) this.d.fill(0, i, i + 4); } }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  dith(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.bay(xx, yy) < lvl) this.px(xx, yy, c); }
  shade(x, y, w, h, f) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = this.at(xx, yy);
      if (i >= 0 && this.d[i + 3]) { this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f; }
    }
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  ell(cx, cy, rx, ry, c, a = 1) {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / ((rx + 0.5) ** 2) + (y * y) / ((ry + 0.5) ** 2) <= 1) this.px(cx + x, cy + y, c, a);
    }
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < xs[k + 1] - 0.5; x++) this.px(x, y, c);
    }
  }
  vgrad(x, y, w, h, cols, k = 1) {
    for (let j = 0; j < h; j++) {
      const t = (h > 1 ? j / (h - 1) : 0) ** k * (cols.length - 1), i0 = Math.floor(t), f = t - i0;
      for (let xx = x; xx < x + w; xx++) this.px(xx, y + j, f > this.bay(xx, y + j) ? cols[Math.min(cols.length - 1, i0 + 1)] : cols[i0]);
    }
  }
  thick(x0, y0, x1, y1, r, c) {
    const n = Math.ceil(sq(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const u = i / n; this.ell(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), r, r, c); }
  }
  canvas() { return toCanvas(this.d, this.w, this.h); }
}
function toCanvas(d, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
  return c;
}

// a soft glow in a few flat steps, dithered only where the steps meet; drawn with 'lighter'
function glow(rx, ry, c, k = 1, lv = 6) {
  const R = new Ras(rx * 2 + 1, ry * 2 + 1);
  for (let y = 0; y <= ry * 2; y++) for (let x = 0; x <= rx * 2; x++) {
    const d = sq((x - rx) / rx, (y - ry) / ry);
    if (d >= 1) continue;
    const a = bandN((1 - d) ** 2 * k * lv, x, y) / lv;
    if (a > 0) R.px(x, y, c, Math.min(1, a));
  }
  return R.canvas();
}
// a small halo as a few flat nested ellipses, no dither at all: [[size 0–1, alpha], ...]
function steps(rx, ry, c, rings) {
  const R = new Ras(rx * 2 + 1, ry * 2 + 1);
  for (let y = 0; y <= ry * 2; y++) for (let x = 0; x <= rx * 2; x++) {
    const d = sq((x - rx) / (rx + 0.5), (y - ry) / (ry + 0.5));
    let a = 0;
    for (const [k, al] of rings) if (d <= k) a += al;
    if (a > 0) R.px(x, y, c, Math.min(1, a));
  }
  return R.canvas();
}

/* ——— light: colour ramps ———
   For each painted colour, fourteen lit versions: seven on the cool side (deep indigo shadow up to
   window-lit teal-grey) and seven on the warm side (dusky oxblood up to lamp honey). A pixel's step
   comes from the total light on it, its side from how much of that light is warm. */
const CT = [   // intensity, × r g b, + r g b
  [0.17, 0.62, 0.74, 1.22, 8, 9, 22], [0.25, 0.68, 0.80, 1.18, 7, 8, 18], [0.35, 0.74, 0.87, 1.13, 5, 7, 13],
  [0.47, 0.80, 0.93, 1.09, 3, 5, 8], [0.60, 0.86, 0.98, 1.05, 2, 3, 4], [0.74, 0.91, 1.01, 1.03, 0, 2, 2], [0.90, 0.96, 1.02, 1.02, 0, 0, 0],
];
const WT = [
  [0.21, 0.94, 0.72, 0.96, 12, 5, 12], [0.31, 1.03, 0.78, 0.86, 10, 4, 8], [0.43, 1.11, 0.84, 0.76, 8, 4, 4],
  [0.56, 1.16, 0.88, 0.70, 7, 3, 0], [0.71, 1.21, 0.92, 0.68, 8, 4, 0], [0.87, 1.25, 0.96, 0.68, 10, 6, 0], [1.03, 1.27, 1.00, 0.72, 14, 9, 2],
];
const RAMPS = new Map(), RHEX = new Map();
function rampOf(c) {
  let rp = RAMPS.get(c);
  if (rp) return rp;
  rp = new Int32Array(14);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  [CT, WT].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(c, rp);
  return rp;
}
function rampHex(c) { let a = RHEX.get(c); if (!a) { a = Array.from(rampOf(c), hex); RHEX.set(c, a); } return a; }

// the light reaching a point of the room (core coordinates), in four parts
function coolAt(cx, cy, rw, wins) {   // the night through the windows
  let v = 0.28;
  const dx = cx < 120 ? 120 - cx : cx > 200 ? cx - 200 : 0;
  const dy = cy < 40 ? 40 - cy : cy > 196 ? cy - 196 : 0;
  v += Math.max(0, 1 - sq(dx, dy * 0.85) / 104) ** 2 * 0.5;
  for (const W of wins) {
    if (W === WIN) continue;
    const ex = cx < W.x - 2 ? W.x - 2 - cx : cx > W.x + W.w + 2 ? cx - W.x - W.w - 2 : 0, ey = cy < W.top + 4 ? W.top + 4 - cy : cy > W.bot ? cy - W.bot : 0;
    v += Math.max(0, 1 - sq(ex, ey * 0.9) / 62) ** 2 * 0.4;
  }
  const vx = (cx - 160) / (rw / 2 + 110), vy = (cy - 140) / 250;
  return v * (1 - Math.min(0.4, (vx * vx + vy * vy) * 0.8));
}
// candles, the lantern, the standing lamp, the brass library lights, the picture light: each a
// light with an id (so it can be put out), a kind and a box beyond which it gives nothing
//   pt:   a point, falling off over r (sy squashes it: > 1 flatter, < 1 taller)
//   seg:  a brass bar light on a cornice, shining down across [x0, x1]
//   rect: the picture light's even wash over the map, brightest along its top
function lightBox(lt) {
  if (lt.kind === 'pt') return { x0: Math.floor(lt.x - lt.r), x1: Math.ceil(lt.x + lt.r) + 1, y0: Math.floor(lt.y - lt.r / lt.sy), y1: Math.ceil(lt.y + lt.r / lt.sy) + 1 };
  if (lt.kind === 'seg') return { x0: Math.floor(lt.x0 - lt.r / 1.5), x1: Math.ceil(lt.x1 + lt.r / 1.5) + 1, y0: lt.y - 3, y1: Math.ceil(lt.y + lt.r) + 1 };
  return { x0: lt.x0 - 2, x1: lt.x1 + 2, y0: lt.y0 - 2, y1: lt.y1 + 2 };
}
function lightAt(lt, cx, cy) {
  if (lt.kind === 'pt') { const d = sq(cx - lt.x, (cy - lt.y) * lt.sy); return d < lt.r ? (1 - d / lt.r) ** (lt.p || 1.6) * lt.k : 0; }
  if (lt.kind === 'seg') {
    const dy = cy - lt.y;
    if (dy < -2) return 0;
    const d = sq(Math.max(0, lt.x0 - cx, cx - lt.x1) * 1.5, Math.max(0, dy) * 0.9);
    return d < lt.r ? (1 - d / lt.r) ** 1.5 * lt.k * clamp((dy + 3) / 4, 0, 1) : 0;
  }
  const ex = Math.min(cx - lt.x0, lt.x1 - cx), ey = Math.min(cy - lt.y0, lt.y1 - cy);
  if (ex < -2 || ey < -2) return 0;
  return (lt.k + lt.top * Math.max(0, 1 - (cy - lt.y0) / 14)) * clamp((Math.min(ex, ey) + 3) / 4, 0, 1);
}
// the warm light of all the lights still lit, into F.W, inside a box of room pixels
function fillWarm(F, ox, lights, off, box) {
  const rw = F.rw, x0 = clamp(box.x0, 0, rw), x1 = clamp(box.x1, 0, rw), y0 = clamp(box.y0, 0, H), y1 = clamp(box.y1, 0, H);
  for (let y = y0; y < y1; y++) F.W.fill(0, y * rw + x0, y * rw + x1);
  for (const lt of lights) {
    if (off && off.has(lt.id)) continue;
    const b = lightBox(lt), bx0 = Math.max(x0, b.x0 + ox), bx1 = Math.min(x1, b.x1 + ox), by0 = Math.max(y0, b.y0), by1 = Math.min(y1, b.y1);
    for (let y = by0; y < by1; y++) for (let X = bx0; X < bx1; X++) { const v = lightAt(lt, X - ox, y); if (v > 0) F.W[y * rw + X] += v; }
  }
}
function lampAt(cx, cy) {           // the banker's lamp on the table and what stands on it: a strong pool
  // the shade cuts the light off along a line sloping down and out from its lip
  const lip = 211 + Math.max(0, Math.abs(cx - 101) - 16) * 0.42, mask = clamp((cy - lip + 4) / 14, 0, 1);
  const pool = Math.max(0, 1 - sq((cx - 116) / (cx < 116 ? 1.45 : 1.75), (cy - 244) * 1.05) / 64) ** 1.1 * 1.3;
  const above = Math.max(0, 1 - sq((cx - 101) * 1.1, (cy - 206) * 1.5) / 52) ** 2 * 0.42;
  // and the lit table throws a little back toward you, onto your chair
  const bounce = Math.max(0, 1 - sq((cx - 100) / 1.9, (cy - 282) * 1.2) / 80) ** 2 * 0.3 * clamp((cy - 236) / 24, 0, 1);
  return pool * mask + above * (1 - mask) + bounce + Math.max(0, 1 - sq(cx - 108, (cy - 232) * 1.15) / 160) ** 2 * (0.12 + 0.12 * mask);
}
// the same lamp on the wall, the drapes and the shelves, which stand a good way behind it: the
// shade lets no light up and back to them, so what reaches them is thrown back off the bright
// table, falling off with the distance in depth too, and never more than about half the pool
function lampBack(cx, cy) {
  const d = Math.sqrt(((cx - 114) / 1.5) ** 2 + ((cy - 236) * 1.1) ** 2 + 44 * 44);
  return Math.min(0.6, 0.6 * (44 / d) ** 2 + Math.max(0, 1 - sq(cx - 101, (cy - 207) * 1.5) / 26) ** 2 * 0.14);
}
function fireAt(cx, cy) {           // the fire: hard on the hearth, a glow across the room
  const dx = cx - 276, dy = cy - 214;
  let v = 0;
  if (cx >= 258 && cx < 294 && cy >= 176 && cy < 236) v += 0.75;
  v += Math.max(0, 1 - sq(dx, dy * 1.12) / 76) ** 1.4 * 0.95;
  v += Math.max(0, 1 - sq(dx * 0.75, dy * (1 + clamp((160 - cy) / 80, 0, 0.6))) / 250) ** 2 * 0.4;
  if (cy > 236) v += Math.max(0, 1 - sq(dx * 0.6, cy - 252) / 72) ** 1.5 * 0.35;
  return v;
}

// one lit version of a painted raster, k: bit 1 the lamp on, bit 2 the fire high; back: it stands
// at the wall (lit by lampBack) rather than on the table. Alpha 254 glows by itself; alpha 253 is
// the lamp's green glass shade, lit evenly from inside. In bands of rows, so a big one can be
// spread over frames; with a rect, only that part, written into the canvas `into`
function* bakeGen(src, x0, y0, F, k, back, rect, into) {
  const { w, d } = src, rw = F.rw, LA = back ? F.LB : F.L, l = k & 1, fl = k & 2 ? FHI : FLO;
  const bx = rect ? rect.x : 0, by = rect ? rect.y : 0, bw = rect ? rect.w : w, bh = rect ? rect.h : src.h;
  const img = new ImageData(bw, bh), out = img.data;
  let lastC = -1, rp = null;
  for (let yy = 0; yy < bh; yy++) {
    const y = by + yy, Y = y0 + y;
    for (let xx = 0; xx < bw; xx++) {
      const x = bx + xx, i = (y * w + x) * 4, o4 = (yy * bw + xx) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[o4] = d[i]; out[o4 + 1] = d[i + 1]; out[o4 + 2] = d[i + 2]; out[o4 + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.28, warm = 0;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) {
        const j = Y * rw + X;
        cool = F.C[j]; warm = F.W[j] + l * (al === 253 ? 0.8 : LA[j]) + fl * F.FI[j];
      }
      const tot = cool + warm, lv = Math.min(6, bandN(Math.min(6, Math.max(0, (tot - 0.1) / 0.15)), X, Y));
      const wf = warm / tot, side = wf > 0.4 ? 7 : wf < 0.34 ? 0 : bay(X + 2, Y + 1) < (wf - 0.34) / 0.06 ? 7 : 0;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c); }
      const o = rp[side + lv];
      out[o4] = o >> 16; out[o4 + 1] = (o >> 8) & 255; out[o4 + 2] = o & 255; out[o4 + 3] = al >= 253 ? 255 : al;
    }
    if ((yy & 47) === 47) yield;
  }
  if (into) { into.getContext('2d').putImageData(img, bx, by); return into; }
  const c = document.createElement('canvas');
  c.width = bw; c.height = bh; c.getContext('2d').putImageData(img, 0, 0);
  return c;
}
// the lit colour of one painted colour at one point, for the moving things drawn over the bake
function litIdx(RM, cx, cy, l, fl, back) {
  const F = RM.F, X = clamp(Math.round(cx) + RM.ox, 0, RM.bw - 1), Y = clamp(Math.round(cy), 0, H - 1), j = Y * RM.bw + X;
  const cool = F.C[j], warm = F.W[j] + l * (back ? F.LB : F.L)[j] + fl * F.FI[j], tot = cool + warm;
  return (warm / tot > 0.37 ? 7 : 0) + Math.min(6, Math.max(0, Math.round((tot - 0.1) / 0.15)));
}
const flv = (s) => FLO + (FHI - FLO) * s.fire;
// things on the table (front) and things at the wall (back)
const lit = (RM, cx, cy, c, s) => rampHex(c)[litIdx(RM, cx, cy, s.lamp, flv(s), false)];
const litB = (RM, cx, cy, c, s) => rampHex(c)[litIdx(RM, cx, cy, s.lamp, flv(s), true)];

/* ——— outside: the sky, the town, the garden and its gas lamp ——— */
function cloudStrip(seed, n, cols, density) {
  const w = PW, h = 76, r = rng(seed), m = new Float32Array(w * h), R = new Ras(w, h);
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = 10 + r() * 42, rad = 7 + r() * 17, st = 1.7 + r() * 1.5;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad * st); x <= cx + rad * st; x++) {
      if (y < 0 || y >= h) continue;
      const d = sq((x - cx) / st, y - cy) / rad;
      if (d < 1) m[y * w + (((x % w) + w) % w)] += (1 - d) * density;
    }
  }
  // flat steps of colour, dithered only along the seams between them and along the cloud's edge
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = m[y * w + x];
    if (bandN(v / 0.36, x, y) < 1) continue;
    const t = Math.min(1, Math.max(0, (y / h) * 0.85 + (0.65 - Math.min(v, 1.2) * 0.5)));
    R.px(x, y, cols[Math.min(cols.length - 1, bandN(t * (cols.length - 1), x + 1, y))]);
  }
  return R.canvas();
}
// a sky in flat bands of colour, dithered only where two meet
function skyBands(R, x, y, w, h, cols, k = 1) {
  for (let j = 0; j < h; j++) {
    const t = (h > 1 ? j / (h - 1) : 0) ** k * (cols.length - 1);
    for (let xx = x; xx < x + w; xx++) R.px(xx, y + j, cols[Math.min(cols.length - 1, bandN(t, xx, y + j))]);
  }
}

function paintTown(R, geo) {
  const r = rng(71), pick = (a) => a[Math.floor(r() * a.length)];
  // far hills and roofs, soft in the haze
  for (let x = 0; x < PW; x++) { const y = 88 + Math.round(Math.sin(x * 0.045 + 0.7) * 3 + Math.sin(x * 0.017 + 2) * 4); R.rect(x, y, 1, PH - y, 0x172036); }
  for (let x = -2; x < PW;) {
    const w = 5 + Math.floor(r() * 8), top = 93 + Math.floor(r() * 6);
    for (let k = 0; k < w; k++) { const peak = top - Math.round((1 - Math.abs(k - w / 2) / (w / 2)) * 3); R.rect(x + k, peak, 1, PH - peak, 0x141c2e); }
    if (r() < 0.35) R.px(x + 2, top + 3, r() < 0.7 ? 0x8a6a48 : 0x4a5a7a);
    x += w;
  }
  // the town: houses with gables and chimneys, a few windows still lit
  const WARM = [0xffc070, 0xffd890, 0xf0a860, 0xffe0a8];
  for (let x = -6; x < PW;) {
    const w = 12 + Math.floor(r() * 14), eave = 100 + Math.floor(r() * 7), gable = r() < 0.55;
    const wall = pick([0x182030, 0x1b2232, 0x161d2c, 0x1d2030]), roof = pick([0x10161f, 0x121824, 0x0e141c]);
    if (x > 104 && x < 146) { x += 4; continue; }   // leave room for the church
    R.rect(x, eave, w, PH - eave, wall);
    let ridge;
    if (gable) {
      const half = w / 2; ridge = eave - Math.round(half * 0.85);
      for (let y = ridge; y < eave; y++) { const hw = ((y - ridge) / (eave - ridge)) * half; R.rect(Math.round(x + half - hw), y, Math.max(1, Math.round(hw * 2)), 1, wall); }
      R.line(x - 1, eave, Math.round(x + half), ridge - 1, roof); R.line(x + w, eave, Math.round(x + half), ridge - 1, roof);
      R.px(Math.round(x + half), ridge - 1, 0x2e3c50);
      if (r() < 0.5) { R.rect(Math.round(x + half) - 1, ridge + 3, 2, 3, r() < 0.4 ? pick(WARM) : 0x24283a); }
    } else {
      const rh = 5 + Math.floor(r() * 4); ridge = eave - rh;
      for (let k = 0; k < rh; k++) R.rect(x - 1 + Math.floor(k * 0.4), eave - rh + k, w + 2 - Math.floor(k * 0.4) * 2 + k % 2, 1, roof);
      R.rect(x - 1, ridge, w + 2, 1, 0x2a3648);
    }
    // a chimney stack with its pots
    if (r() < 0.75) {
      const cx = x + 2 + Math.floor(r() * (w - 6)), ch = 5 + Math.floor(r() * 4);
      R.rect(cx, ridge - ch + 2, 4, ch, 0x1a1e2a); R.rect(cx - 1, ridge - ch + 1, 6, 1, 0x262c3a);
      R.px(cx, ridge - ch, 0x1e2230); R.px(cx + 2, ridge - ch, 0x1e2230); R.px(cx + 2, ridge - ch - 1, 0x1e2230);
    }
    // windows: two rows, a few lit
    for (let wy = eave + 3; wy < PH - 4; wy += 7) for (let wx = x + 2; wx < x + w - 3; wx += 5) {
      const on = r() < 0.2, c = pick(WARM);
      R.rect(wx, wy, 2, 3, on ? c : 0x10141e);
      if (on) { R.px(wx, wy, mixc(c, 0xffffff, 0.3)); if (geo && r() < 0.4) geo.wins.push({ x: wx, y: wy, w: 2, h: 3 }); }
    }
    x += w + (r() < 0.4 ? 1 : 0);
  }
  // the church, in the left panes against the town-lit cloud: a square tower with its clock (dim at
  // this hour), a louvred belfry, a tall spire with a cockerel, and the nave with its lit windows
  const tx = 112, dy = 8;
  R.rect(tx + 10, 84 + dy, 24, PH - 84 - dy, 0x161c2a); R.rect(tx + 10, 84 + dy, 24, 1, 0x283446);
  for (let k = 0; k < 6; k++) R.line(tx + 10 + k * 4, 84 + dy, tx + 10 + k * 4, 81 + dy, 0x161c2a);
  R.rect(tx, 50 + dy, 11, PH - 50 - dy, 0x121a28); R.rect(tx, 50 + dy, 1, PH - 50 - dy, 0x2e3c52); R.rect(tx + 10, 50 + dy, 1, PH - 50 - dy, 0x0c111c);
  for (let y = 51 + dy; y < PH; y += 6) R.rect(tx + 1, y, 9, 1, 0x161e2c);
  R.rect(tx + 3, 54 + dy, 2, 6, 0x0c1018); R.rect(tx + 6, 54 + dy, 2, 6, 0x0c1018);
  for (let y = 55 + dy; y < 60 + dy; y += 2) { R.rect(tx + 3, y, 2, 1, 0x1e2636); R.rect(tx + 6, y, 2, 1, 0x1e2636); }
  R.rect(tx - 1, 49 + dy, 13, 2, 0x222c3e);
  for (const ddx of [0, 10]) { R.rect(tx + ddx - 1, 46 + dy, 3, 3, 0x1e2636); R.px(tx + ddx, 45 + dy, 0x1e2636); }
  for (let y = 16 + dy; y < 47 + dy; y++) { const hw = ((y - 16 - dy) / 31) * 4.5; R.rect(Math.round(tx + 5.5 - hw), y, Math.max(1, Math.round(hw * 2)), 1, 0x0c111c); R.px(Math.round(tx + 5.5 - hw), y, 0x3a4a62); if (y % 6 === 3) R.rect(Math.round(tx + 5.5 - hw) + 1, y, Math.max(1, Math.round(hw * 2) - 1), 1, 0x141a28); }
  R.line(tx + 5, 15 + dy, tx + 5, 10 + dy, 0x2a3446); R.rect(tx + 4, 12 + dy, 3, 1, 0x2a3446); R.rect(tx + 4, 9 + dy, 3, 1, 0x2a3446); R.px(tx + 6, 8 + dy, 0x2a3446);
  R.ell(tx + 5, 66 + dy, 3, 3, 0x0e121a); R.ell(tx + 5, 66 + dy, 2, 2, 0x5e5848); R.px(tx + 5, 66 + dy, 0x3a3226); R.px(tx + 5, 65 + dy, 0x3a3226); R.px(tx + 6, 66 + dy, 0x3a3226);
  for (const wy of [84, 100]) { R.rect(tx + 4, wy + dy, 3, 6, 0x0e121a); R.px(tx + 5, wy - 1 + dy, 0x0e121a); }
  for (const wx of [tx + 14, tx + 22, tx + 30]) { R.rect(wx, 90 + dy, 3, 7, 0xb8803e); R.px(wx + 1, 89 + dy, 0xb8803e); R.rect(wx + 1, 90 + dy, 1, 7, 0x5a3e26); R.rect(wx, 93 + dy, 3, 1, 0x5a3e26); R.px(wx, 91 + dy, 0xd8a060); }
  if (geo) geo.church = [tx + 5, 66 + dy];
  // haze, thickening toward the horizon
  for (let y = 40; y < PH; y++) { const a = Math.round(Math.max(0, Math.min(0.42, ((y - 40) / 80) * 0.42)) * 20) / 20; for (let x = 0; x < PW; x++) R.tint(x, y, 0x2a3a52, a * (y > 112 ? 0.4 : 1)); }
}

function branch(R, x, y, ang, len, w, depth, r, c) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  if (w >= 1.5) R.thick(x, y, x2, y2, Math.max(0, Math.round(w / 2 - 0.5)), c); else R.line(x, y, x2, y2, c);
  if (depth <= 0) return;
  const n = depth > 3 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
  for (let k = 0; k < n; k++) branch(R, x2, y2, ang + (k - (n - 1) / 2) * (0.5 + r() * 0.35) + (r() - 0.5) * 0.3, len * (0.66 + r() * 0.12), w * 0.66, depth - 1, r, c);
}

function paintGarden(R) {
  const r = rng(83);
  // the gas lamp beyond the wall: its post, the ladder-bar, the lantern
  const { x: lx, y: ly } = LAMPP;
  R.rect(lx - 1, ly + 8, 3, 112 - ly, 0x15181f); R.rect(lx - 1, ly + 8, 1, 112 - ly, 0x3a3a3e);
  R.rect(lx - 4, ly + 12, 9, 1, 0x1a1d24); R.px(lx - 4, ly + 13, 0x1a1d24); R.px(lx + 4, ly + 13, 0x1a1d24);
  R.rect(lx - 2, ly + 6, 5, 2, 0x1a1d24);
  R.rect(lx - 4, ly - 3, 9, 9, 0x1a1d24);
  R.rect(lx - 3, ly - 2, 7, 7, 0xffd890); R.rect(lx - 2, ly - 1, 5, 5, 0xfff2c8); R.rect(lx, ly - 2, 1, 7, 0x8a6a40); R.rect(lx - 3, ly + 1, 7, 1, 0xc8a060);
  for (let k = 0; k < 4; k++) R.rect(lx - 4 + k, ly - 4 - k, 9 - k * 2, 1, 0x1a1d24);
  R.px(lx, ly - 8, 0x2a2c34);
  // the old garden wall, its coping wet, ivy in places; the gate between two stone pillars
  const gx = 129;
  for (let x = 0; x < PW; x++) {
    if (x >= gx - 7 && x < gx + 7) continue;
    R.rect(x, 114, 1, 1, 0x4a5462); R.rect(x, 115, 1, 2, 0x3a424e); R.rect(x, 117, 1, 11, 0x2a3038);
    for (let y = 118; y < 128; y++) { const row = Math.floor((y - 118) / 3), off = row % 2 ? 4 : 0; if ((y - 118) % 3 === 2 || ((x + off) % 8) === 0) R.px(x, y, 0x22262e); }
  }
  for (const px of [gx - 13, gx + 7]) {
    R.rect(px, 104, 6, 24, 0x30363e); R.rect(px, 104, 1, 24, 0x4a525c); R.rect(px + 5, 104, 1, 24, 0x22262c);
    R.rect(px - 1, 102, 8, 2, 0x4a5462); R.ell(px + 2.5, 99, 2, 2, 0x3e4650); R.px(px + 2, 98, 0x5a6470);
    for (let y = 108; y < 128; y += 4) R.rect(px, y, 6, 1, 0x262a32);
  }
  // the iron gate: spear-topped bars, two rails, a scroll at its head
  for (let x = gx - 7; x < gx + 7; x += 2) { R.rect(x, 108, 1, 20, 0x14161c); R.px(x, 107, 0x2a2e36); }
  R.rect(gx - 7, 112, 14, 1, 0x14161c); R.rect(gx - 7, 124, 14, 1, 0x14161c);
  for (let k = -6; k <= 6; k++) R.px(gx + k, 106 - Math.round(Math.cos((k / 6) * 1.4) * 3), 0x1a1c22);
  // the lamp's light on the stones and the bars
  for (let y = 96; y < 132; y++) for (let x = 110; x < 200; x++) { const d = sq(x - lx, (y - ly) * 0.7); if (d < 44) R.tint(x, y, 0xffb060, Math.round((1 - d / 44) ** 1.5 * 0.5 * 8) / 8); }
  // ivy on the wall
  for (const [ix, iw] of [[12, 22], [70, 14], [196, 26]]) for (let k = 0; k < iw * 4; k++) { const x = ix + Math.floor(r() * iw), y = 112 + Math.floor(r() * 14); R.px(x, y, r() < 0.3 ? 0x2a4434 : 0x1a2e24); }
  // hedges along the wall, then the lawn, the gravel path to the gate, puddles
  for (let x = 0; x < PW; x++) {
    const inGate = x > gx - 12 && x < gx + 12;
    const top = inGate ? 999 : 120 + Math.round(Math.sin(x * 0.31) * 1.2 + Math.sin(x * 0.09 + 1) * 1.6 + (x % 23 === 0 ? 1 : 0));
    for (let y = Math.min(top, 140); y < 140; y++) {
      const k = y - top;
      let c = k < 1 ? 0x2a4232 : k < 3 ? 0x1e3428 : 0x15261e;
      if ((x * 7 + y * 3) % 11 === 0) c = 0x24382c;
      if (k < 2 && (x * 13) % 17 === 0) c = 0x5a7a72;
      R.px(x, y, c);
    }
  }
  for (let y = 136; y < PH; y++) {
    const u = (y - 128) / (PH - 128), hw = 7 + u * 40;
    for (let x = 0; x < PW; x++) {
      if (y < 140 && R.get(x, y) >= 0) continue;
      const onPath = Math.abs(x + 0.5 - (gx + u * 4)) < hw;
      let c;
      if (onPath) { c = 0x24252a; if ((x * 31 + y * 17) % 7 === 0) c = 0x32343a; else if ((x * 13 + y * 7) % 9 === 0) c = 0x1c1d22; }
      else { c = 0x0f1b18; if ((x * 5 + y * 11) % 13 === 0) c = 0x15241f; else if (((x + y * 3) % 17) === 0) c = 0x0b1513; }
      R.px(x, y, c);
    }
  }
  // puddles on the path and the lawn, holding the sky, the one by the lamp a little of its light
  for (const [px, py, rx] of PUDDLES) {
    R.ell(px, py, rx, 1, 0x1a2232); R.rect(px - rx + 2, py, rx * 2 - 3, 1, 0x26304a);
    if (px > 136 && px < 190) { R.px(px + 2, py, 0x7a6248); R.px(px + 3, py, 0x5a4a3c); }
  }
  // the old pear tree in the lawn, bare, its branches against the cloud
  const tr = rng(17);
  branch(R, 55, 158, -Math.PI / 2 - 0.08, 38, 6, 6, tr, 0x0d1118);
  branch(R, 58, 130, -Math.PI / 2 + 0.6, 26, 3.2, 5, tr, 0x0d1118);
  R.rect(51, 140, 8, 20, 0x0d1118); R.rect(50, 157, 10, 3, 0x0d1118);
  // a bench in the lawn, near
  R.rect(84, 146, 18, 2, 0x1a1a1e); R.rect(84, 142, 18, 1, 0x1a1a1e); R.rect(85, 148, 1, 5, 0x15151a); R.rect(100, 148, 1, 5, 0x15151a);
  R.ell(18, 158, 22, 10, 0x0b1512); R.ell(226, 160, 18, 8, 0x0b1512);
}

let OUT = null;
function outside() {
  if (OUT) return OUT;
  const O = {}, geo = { wins: [], church: null };
  // the sky in flat bands: night at the top, a paler band of high cloud the spire stands against,
  // and low down the cloud's base lit faintly by the town
  const sky = new Ras(PW, PH);
  skyBands(sky, 0, 0, PW, 26, [0x070a17, 0x0a0f20, 0x0e1528, 0x121a30]);
  skyBands(sky, 0, 26, PW, 34, [0x121a30, 0x182138, 0x1e2840, 0x222c44]);
  skyBands(sky, 0, 60, PW, 18, [0x222c44, 0x1c253a]);
  skyBands(sky, 0, 78, PW, 40, [0x1c253a, 0x232c40, 0x2b3448, 0x343e52, 0x3e4858]);
  sky.rect(0, 118, PW, PH - 118, 0x3e4858);
  O.sky = sky.canvas();
  const CL = [[0x121a2e, 0x18213a, 0x1f2a42, 0x28344a, 0x324052], [0x141c30, 0x1a243c, 0x222e46, 0x2c3a50, 0x3a4a5a]];
  const LT = [[0x2a3a5a, 0x3a4c6e, 0x4c6084, 0x6276a0, 0x7a8eb8], [0x2e3e5e, 0x405474, 0x54688a, 0x6a7ea6, 0x8496c0]];
  O.clouds = [cloudStrip(11, 30, CL[0], 0.72), cloudStrip(23, 20, CL[1], 0.8)];
  O.cloudsLit = [cloudStrip(11, 30, LT[0], 0.72), cloudStrip(23, 20, LT[1], 0.8)];
  const town = new Ras(PW, PH); paintTown(town, geo); O.town = town.canvas();
  const gard = new Ras(PW, PH); paintGarden(gard); O.garden = gard.canvas();
  O.geo = geo;
  const M = new Ras(13, 13);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { const d = sq(x - 6, y - 6); if (d <= 6.2) M.px(x, y, (x - 6) + (y - 6) > 4 ? 0xcfc6ac : 0xf2ecd6); }
  for (const [x, y] of [[4, 4], [5, 4], [8, 8], [4, 8], [8, 5]]) M.px(x, y, 0xc4baa0);
  O.moon = M.canvas(); O.gMoon = glow(30, 30, 0xb8c8f0, 0.5, 4);
  O.gLamp = glow(30, 34, 0xffc070, 0.6, 5); O.gLampCore = steps(8, 9, 0xfff0c0, [[1, 0.25], [0.6, 0.35], [0.3, 0.4]]);
  O.gBolt = glow(90, 50, 0xa8c0f0, 0.75, 5); O.gClock = steps(4, 4, 0xffd890, [[1, 0.2], [0.5, 0.3]]);
  // which colour the rain takes, cell by cell (4 px cells): warm near the gas lamp
  O.tintCols = Math.ceil(PW / 4); O.tint = new Uint8Array(O.tintCols * Math.ceil(PH / 4));
  for (let cy = 0; cy < Math.ceil(PH / 4); cy++) for (let cx = 0; cx < O.tintCols; cx++) {
    const x = cx * 4 + 2, y = cy * 4 + 2;
    O.tint[cy * O.tintCols + cx] = ((x - LAMPP.x) / 24) ** 2 + ((y - LAMPP.y - 6) / 34) ** 2 < 1 ? 1 : 0;
  }
  // a band of mist between the town and the garden; it tiles, and drifts
  const MW = PW + 60, mist = new Ras(MW, 26);
  for (let y = 0; y < 26; y++) for (let x = 0; x < MW; x++) {
    const env = Math.sin((y / 25) * Math.PI) ** 1.4;
    const n = 0.5 + 0.3 * Math.sin((x / MW) * Math.PI * 2 * 3 + y * 0.2) + 0.2 * Math.sin((x / MW) * Math.PI * 2 * 7 + 1.3);
    const q = band(env * n * 3.2, x, y);
    if (q > 0) mist.px(x, y, 0x8aa0c0, [0, 0.05, 0.09, 0.14][Math.min(3, q)]);
  }
  O.mist = mist.canvas(); O.mistW = MW;
  // the night standing still, for the drops on the glass to hold a little of it
  const st = document.createElement('canvas'); st.width = PW; st.height = PH;
  const sg = st.getContext('2d', { willReadFrequently: true });
  sg.drawImage(O.sky, 0, 0); sg.drawImage(O.clouds[0], 0, 0); sg.drawImage(O.clouds[1], 0, 14);
  sg.drawImage(O.town, 0, 0); sg.globalAlpha = 0.8; sg.drawImage(O.mist, 0, 100); sg.globalAlpha = 1; sg.drawImage(O.garden, 0, 0);
  sg.globalCompositeOperation = 'lighter'; sg.globalAlpha = 0.8; sg.drawImage(O.gLamp, LAMPP.x - 30, LAMPP.y - 32); sg.drawImage(O.gLampCore, LAMPP.x - 8, LAMPP.y - 9);
  const sd = sg.getImageData(0, 0, PW, PH).data;
  const stillAt = (x, y) => { x = clamp(Math.round(x), 0, PW - 1); y = clamp(Math.round(y), 0, PH - 1); const i = (y * PW + x) * 4; return (sd[i] << 16) | (sd[i + 1] << 8) | sd[i + 2]; };
  O.glass = [WIN, NOOK, DWIN].map((W, i) => glassBeads(W, 31 + i * 6, stillAt));
  return (OUT = O);
}

// the panes of an arched window below its arch, in the glass's own pixels: [x, y, w, h]
function panesOf(W) {
  const out = [], mx = W.cx - W.x - 1, rows = W.rows.map((r) => r - W.top), gh = W.bot - W.top;
  rows.forEach((r, i) => { const y0 = r + 2, y1 = i + 1 < rows.length ? rows[i + 1] : gh; for (const [x0, x1] of [[0, mx], [mx + 2, W.w]]) out.push([x0, y0, x1 - x0, y1 - y0]); });
  return out;
}
// one drop on the glass: a bright shoulder where it catches the room, a body holding the night
// from a few pixels above it (upside down, as a lens does, and a little brighter), a dark lip below
function paintBead(R, x, y, size, refr) {
  const lip = 0x020409;
  if (size === 1) { R.px(x, y, refr(x, y, 3, 0.3), 0.6); R.px(x, y + 1, lip, 0.35); return; }
  if (size === 2) {
    R.px(x, y, 0xeef4ff, 0.6); R.px(x + 1, y, refr(x + 1, y, 4, 0.2), 0.7);
    R.px(x, y + 1, refr(x, y + 1, 5, 0.25), 0.75); R.px(x + 1, y + 1, refr(x + 1, y + 1, 8, 0.5), 0.85);
    R.px(x, y + 2, lip, 0.5); R.px(x + 1, y + 2, lip, 0.42);
    return;
  }
  R.px(x + 1, y, refr(x + 1, y, 3, 0.25), 0.7);
  R.px(x, y + 1, 0xeef4ff, 0.62); R.px(x + 1, y + 1, refr(x + 1, y + 1, 5, 0.25), 0.74); R.px(x + 2, y + 1, refr(x + 2, y + 1, 5, 0.2), 0.7);
  R.px(x, y + 2, refr(x, y + 2, 7, 0.3), 0.75); R.px(x + 1, y + 2, refr(x + 1, y + 2, 9, 0.55), 0.9); R.px(x + 2, y + 2, refr(x + 2, y + 2, 7, 0.3), 0.75);
  R.px(x, y + 3, lip, 0.35); R.px(x + 1, y + 3, lip, 0.58); R.px(x + 2, y + 3, lip, 0.35);
}
// drops already on a window's glass, gathered mostly along its glazing bars and its foot
function glassBeads(W, seed, stillAt) {
  const gw = W.w, gh = W.bot - W.top, gl = new Ras(gw, gh), dr = rng(seed), taken = new Uint8Array(gw * gh);
  const mx = W.cx - W.x - 1, rows = W.rows.map((r) => r - W.top);
  const nearBar = (x, y) => { let d = Math.min(Math.abs(x - mx - 0.5) - 0.5, x, gw - 1 - x, (gh - 1 - y) * 0.7); for (const r of rows) d = Math.min(d, Math.abs(y - r - 0.5) - 0.5); return Math.max(0, d); };
  const refr = (x, y, up, k) => mixc(stillAt(W.src + x, W.top - PY + y - up), 0xdde6f6, k);
  const n = Math.round((gw * gh) / 9);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(dr() * (gw - 1)), y = Math.floor(dr() * (gh - 4)), near = nearBar(x, y), size = dr() < 0.14 ? 3 : dr() < 0.5 ? 2 : 1;
    if (!inWin(W, W.x + x, W.top + y) || dr() > 0.012 + 0.5 * Math.exp(-near / 1.8)) continue;
    let free = true;
    for (let yy = y - 2; yy < y + size + 3 && free; yy++) for (let xx = x - 2; xx < x + size + 2; xx++) if (xx >= 0 && yy >= 0 && xx < gw && yy < gh && taken[yy * gw + xx]) { free = false; break; }
    if (!free) continue;
    for (let yy = y; yy < y + size + 1; yy++) for (let xx = x; xx < x + size; xx++) if (xx < gw && yy < gh) taken[yy * gw + xx] = 1;
    paintBead(gl, x, y, size, refr);
  }
  return gl.canvas();
}

/* ——— the room ——— */
const GILT = 0xd4ac58;
const SPINES = [0x7a2a26, 0x2e5a3e, 0x2a3a5c, 0x8a5a2a, 0x4a2e22, 0x5c2234, 0xa8803a, 0x2a2628, 0x3e5e5e, 0x6a3a1e, 0xc8b890, 0x3e4a26, 0x8a3a2a, 0x1e3a2e, 0x4a2a4a, 0xb8a078];
function spine(R, x, y, w, h, c, q) {
  R.rect(x, y, w, h, c);
  R.rect(x, y, 1, h, mixc(c, 0xffffff, 0.2));
  if (w > 2) R.rect(x + w - 1, y, 1, h, mixc(c, 0x000000, 0.42));
  R.rect(x, y, w, 1, mixc(c, 0xffffff, 0.1));
  const pale = c === 0xc8b890 || c === 0xb8a078, gilt = pale ? 0x6a4a2a : GILT;
  if (q < 0.62 && h > 12) {
    R.rect(x, y + 2, w, 1, gilt); if (h > 18 && q < 0.3) R.rect(x, y + 4, w, 1, gilt);
    R.rect(x, y + h - 4, w, 1, gilt);
  }
  if (q > 0.22 && w >= 3 && h > 14) {
    const ly = y + Math.floor(h * 0.26);
    if (q > 0.84 && w > 3) { R.rect(x + 1, ly, w - 2, 5, mixc(c, pale ? 0x7a2a26 : 0x000000, 0.4)); R.rect(x + 1, ly + 2, w - 2, 1, gilt); }
    else R.rect(x + 1, ly, w - (w > 3 ? 2 : 1), 1, gilt);
  }
  if (q > 0.64 && q < 0.8 && h > 16) for (let k = 0; k < 3; k++) R.rect(x, y + 8 + k * 5, w, 1, mixc(c, 0x000000, 0.28));
}

// a few things that live on the shelves between the books; each returns the room it takes
function ornament(R, kind, x, base, geo) {
  if (kind === 'candle') {
    R.rect(x, base - 2, 9, 2, 0xc89a48); R.rect(x, base - 2, 9, 1, 0xf0d080); R.rect(x + 8, base - 5, 2, 3, 0xa8803a); R.px(x + 9, base - 6, 0xa8803a);
    R.rect(x + 3, base - 4, 3, 2, 0xa8803a);
    R.rect(x + 2, base - 15, 5, 11, 0xeee4cc); R.rect(x + 2, base - 15, 1, 11, 0xfff8e8); R.rect(x + 6, base - 15, 1, 11, 0xc8bca0);
    R.px(x + 2, base - 12, 0xfff8e8); R.px(x + 6, base - 10, 0xe8dcc0); R.px(x + 6, base - 9, 0xe8dcc0);
    R.px(x + 4, base - 16, 0x2a1a10);
    const i = geo.flames.length;
    geo.flames.push({ x: x + 4, y: base - 17, i, id: 'f' + i });
    geo.lights.push({ id: 'f' + i, kind: 'pt', x: x + 4, y: base - 13, r: 44, k: 0.55, sy: 1.2 });
    return 11;
  }
  if (kind === 'bust') {
    R.rect(x + 1, base - 3, 10, 3, 0x3a2a22); R.rect(x + 1, base - 3, 10, 1, 0x5a4434);
    R.poly([[x + 1, base - 3], [x + 11, base - 3], [x + 9, base - 9], [x + 3, base - 9]], 0xd8d0c0);
    R.rect(x + 5, base - 11, 2, 2, 0xc8c0b0); R.ell(x + 6, base - 14, 2.5, 3, 0xe0d8c8); R.px(x + 4, base - 15, 0xf0ece0); R.rect(x + 4, base - 17, 4, 1, 0xc8c0b0);
    R.px(x + 7, base - 14, 0xb0a898); R.px(x + 8, base - 13, 0xb0a898);
    return 13;
  }
  if (kind === 'jar') {
    R.ell(x + 5, base - 6, 4, 5, 0xe8ecf0); R.rect(x + 3, base - 12, 5, 2, 0xe8ecf0); R.rect(x + 4, base - 13, 3, 1, 0x3a5a9a);
    for (const [dx, dy] of [[-2, -1], [0, -3], [2, 0], [-1, 2], [1, 1], [3, -2], [0, 0]]) R.px(x + 5 + dx, base - 6 + dy, 0x3a5a9a);
    R.rect(x + 1, base - 7, 9, 1, 0x3a5a9a); R.px(x + 2, base - 9, 0xffffff);
    return 11;
  }
  if (kind === 'plant') {
    R.rect(x + 2, base - 7, 7, 7, 0xb86a44); R.rect(x + 1, base - 8, 9, 2, 0xc87a50); R.rect(x + 8, base - 6, 1, 6, 0x8a4a2e);
    for (let k = 0; k < 14; k++) { const ly = base - 8 + k, lx = x + 9 + Math.round(Math.sin(k * 0.6) * 1.2); R.px(lx, ly, 0x3a6a32); if (k % 3 === 0) { R.px(lx + 1, ly, 0x5a9a4a); R.px(lx + 1, ly + 1, 0x4a8a3e); } }
    for (const [dx, dy, c] of [[2, -10, 0x5a9a4a], [4, -11, 0x6aaa58], [6, -10, 0x4a8a3e], [3, -9, 0x3a6a32], [5, -12, 0x5a9a4a], [1, -9, 0x4a8a3e], [7, -9, 0x3a6a32]]) { R.px(x + dx, base + dy, c); R.px(x + dx + 1, base + dy, c); }
    return 12;
  }
  if (kind === 'frame') {
    R.rect(x + 1, base - 13, 9, 13, 0xc89a48); R.rect(x + 2, base - 12, 7, 11, 0xe8dcc0); R.rect(x + 1, base - 13, 9, 1, 0xf0d080);
    R.ell(x + 5, base - 8, 2, 2.5, 0x2a2420); R.rect(x + 4, base - 5, 3, 2, 0x2a2420);
    return 11;
  }
  if (kind === 'shell') {
    // a nautilus: a cream coil striped with brown, its dark mouth to one side
    R.ell(x + 5, base - 5, 5, 4.5, 0xeadcc4); R.ell(x + 4, base - 6, 2, 2, 0xf6ecd8);
    for (const a of [0.4, 1.1, 1.8, 2.5, 3.2, 3.9]) for (let d = 2; d < 5; d++) R.px(Math.round(x + 4 + Math.cos(a) * d), Math.round(base - 5 - Math.sin(a) * d * 0.9), 0xa8703e);
    R.rect(x + 9, base - 8, 2, 6, 0x4a2e22); R.px(x + 8, base - 7, 0x6a4430); R.px(x + 4, base - 5, 0x8a5a36);
    R.rect(x, base - 1, 11, 1, 0x4a3022);
    return 12;
  }
  if (kind === 'stack') {
    const cs = [0x7a2a26, 0x2e5a3e, 0x2a3a5c, 0x6a3a1e];
    for (let k = 0; k < 4; k++) { const w = 14 - (k % 2) * 2, xx = x + (k % 2), yy = base - 4 - k * 4; R.rect(xx, yy, w, 4, cs[k]); R.rect(xx, yy, w, 1, mixc(cs[k], 0xffffff, 0.2)); R.rect(xx + 2, yy + 2, 1, 1, GILT); R.rect(xx + w - 3, yy + 2, 1, 1, GILT); R.rect(xx + w - 1, yy, 1, 4, 0xeadcc0); }
    return 16;
  }
  return 0;
}

// a bay of shelves from floor to cornice: books of every size and colour, a few leaning, a few
// lying in stacks, and here and there a candle, a plaster bust, a jar, a fern, a shell
function* shelves(R, x0, x1, top, bot, seed, geo, force = {}) {
  const lib = { x: Math.round((x0 + x1) / 2), w: Math.min(26, Math.round((x1 - x0) * 0.3)) };
  const r = rng(seed);
  const W = 0x5a3a26, WL = 0x7a5236, WD = 0x3a2618, WH = 0x9a6a44;
  R.rect(x0, top, x1 - x0, bot - top, 0x281a12);
  for (let x = x0 + 6; x < x1 - 4; x += 8) R.rect(x, top, 1, bot - top, 0x20150e);
  // the cornice, with a row of dentils, and the brass rail the ladder runs on
  R.rect(x0 - 2, top, x1 - x0 + 4, 2, WH); R.rect(x0 - 2, top + 2, x1 - x0 + 4, 2, W);
  for (let x = x0 - 2; x < x1 + 2; x += 3) R.rect(x, top + 4, 2, 2, WL);
  R.rect(x0 - 2, top + 6, x1 - x0 + 4, 1, WD); R.rect(x0, top + 7, x1 - x0, 2, W);
  R.rect(x0, top + 9, x1 - x0, 1, WD);
  // the plinth
  R.rect(x0, bot - 8, x1 - x0, 8, W); R.rect(x0, bot - 8, x1 - x0, 1, WH); R.rect(x0, bot - 2, x1 - x0, 2, WD);
  yield;
  // the rows of books
  const inner = bot - 8 - (top + 10), n = Math.max(1, Math.round(inner / 36)), rh = inner / n;
  for (let i = 0; i < n; i++) {
    const ry = Math.round(top + 10 + i * rh), rb = Math.round(top + 10 + (i + 1) * rh) - 3, rowH = rb - ry;
    const a = x0 + 4, b = x1 - 4, forced = (force[i] || []).slice();
    let x = a, lean = 0;
    while (x < b - 1) {
      const f = forced.find(([fx]) => x >= a + fx && x < a + fx + 8);
      if (f) { forced.splice(forced.indexOf(f), 1); x += ornament(R, f[1], x, rb, geo) + 1; continue; }
      const q = r();
      if (q < 0.05 && b - x > 18) { x += ornament(R, ['bust', 'jar', 'plant', 'frame', 'shell'][Math.floor(r() * 5)], x, rb, geo) + 1; continue; }
      if (q < 0.1 && b - x > 18) { x += ornament(R, 'stack', x, rb, geo) + 1; continue; }
      if (q < 0.15 && b - x > 10 && !lean) {
        // a gap, and a book leaning into it
        const w = 3 + Math.floor(r() * 3), h = rowH - 3 - Math.floor(r() * 6), c = SPINES[Math.floor(r() * SPINES.length)], gap = 4 + Math.floor(r() * 3);
        R.poly([[x, rb], [x + w, rb], [x + w + gap, rb - h + 1], [x + gap, rb - h]], c);
        R.line(x + gap, rb - h, x, rb - 1, mixc(c, 0xffffff, 0.2)); R.line(x + Math.round(gap * 0.75) + 1, rb - Math.round(h * 0.75), x + Math.round(gap * 0.75) + w, rb - Math.round(h * 0.75), GILT);
        x += w + gap; lean = 1; continue;
      }
      lean = 0;
      const thick = r() < (i >= n - 2 ? 0.35 : 0.12);
      let w = thick ? 6 + Math.floor(r() * 4) : 3 + Math.floor(r() * 4);
      const h = Math.max(10, rowH - 1 - Math.floor(r() * (thick ? 4 : 9)));
      if (x + w > b) w = b - x;
      if (w < 2) break;
      const c = SPINES[Math.floor(r() * SPINES.length)];
      spine(R, x, rb - h, w, h, c, r());
      geo.books.push({ x, y: rb - h, w, h, c, id: geo.books.length + seed * 1000 });
      x += w;
    }
    // the shelf board below the row, and the shadow it throws on the back
    R.rect(x0 + 4, rb, x1 - x0 - 8, 3, W); R.rect(x0 + 4, rb, x1 - x0 - 8, 1, WH); R.rect(x0 + 4, rb + 2, x1 - x0 - 8, 1, WD);
    R.shade(x0 + 4, ry, x1 - x0 - 8, 2, 0.6);
    if (i % 2 === 1) yield;
  }
  // the uprights, over the ends of the rows
  for (const ux of [x0, x1 - 4]) { R.rect(ux, top + 10, 4, bot - top - 18, W); R.rect(ux, top + 10, 1, bot - top - 18, WH); R.rect(ux + 3, top + 10, 1, bot - top - 18, WD); }
  // the ladder's rail
  R.rect(x0 - 2, RAILY, x1 - x0 + 4, 1, 0xf0d080); R.rect(x0 - 2, RAILY + 1, x1 - x0 + 4, 1, 0xa8803a);
  for (let bx = x0 + 2; bx < x1; bx += 30) R.rect(bx, RAILY - 1, 2, 4, 0x8a6a2a);
  // a brass library light on the cornice, shining down the books (its lit lip is drawn each frame)
  { const { x: lx, w } = lib, a = lx - (w >> 1);
    R.rect(lx - 1, 12, 2, 4, 0x8a6a2a); R.px(lx - 1, 12, 0xd4a44a);
    R.rect(a, 15, w, 4, 0xb8863a); R.rect(a, 15, w, 1, 0xf8e0a0); R.rect(a, 16, w, 1, 0xd4a44a); R.rect(a, 18, w, 1, 0x6a4a1c);
    R.rect(a - 1, 16, 1, 2, 0xd4a44a); R.rect(a + w, 16, 1, 2, 0x8a6a2a);
    const i = geo.libs.length;
    geo.libs.push({ x: a, w, y: 19, id: 'lib' + i });
    geo.lights.push({ id: 'lib' + i, kind: 'seg', x0: a - 6, x1: a + w + 6, y: 20, r: 200, k: 0.5 }); }
  yield;
}

// the wallpaper, a forest-green damask: a small fleuron in a lattice, half-dropped
function wallpaper(R, x0, x1, y0, y1) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const col = Math.floor((x + 700) / 14), tx = ((x % 14) + 14) % 14, ty = (((y + (col & 1) * 9) % 18) + 18) % 18;
    const dx = Math.abs(tx - 7), dy = ty - 9, dm = dx + Math.abs(dy) * 0.7;
    let c = 0x3b5546;
    if (tx === 0) c = 0x36503f;
    else if (dm < 1.2) c = 0x52705a;
    else if (dm > 3.2 && dm < 4.2 && dy < 2) c = 0x48644f;
    else if (dx === 0 && dy > 2 && dy < 6) c = 0x48644f;
    R.px(x, y, c);
  }
}

// the panelled wainscot under the chair rail
function wainscot(R, x0, x1) {
  R.rect(x0, 206, x1 - x0, 1, 0x9a7050); R.rect(x0, 207, x1 - x0, 2, 0x6a4a32); R.rect(x0, 209, x1 - x0, 1, 0x3a2618);
  R.rect(x0, 210, x1 - x0, 30, 0x553823);
  for (let px = x0 - (((x0 % 34) + 34) % 34) + 3; px < x1; px += 34) {
    R.rect(px, 213, 28, 24, 0x5e3f28); R.rect(px, 213, 28, 1, 0x7c5838); R.rect(px, 213, 1, 24, 0x7c5838); R.rect(px, 236, 28, 1, 0x3a2516); R.rect(px + 27, 213, 1, 24, 0x3a2516);
    R.rect(px + 3, 216, 22, 18, 0x664530); R.rect(px + 3, 216, 22, 1, 0x84603e); R.rect(px + 3, 233, 22, 1, 0x4a3020);
  }
  R.rect(x0, 240, x1 - x0, 6, 0x3e2818); R.rect(x0, 240, x1 - x0, 1, 0x7a5638); R.rect(x0, 245, x1 - x0, 1, 0x2a1a10);
}

// an arched window in a deep recess: architrave, plaster reveal, a dark sash, glazing bars; the
// glass is left clear for the night
function* archWindow(R, W, fan) {
  const { cx, cy, r } = W, outer = r + 16;
  for (let y = cy - outer; y < W.bot + 4; y++) for (let x = cx - outer; x < cx + outer; x++) {
    const dx = x + 0.5 - cx, dist = y < cy ? sq(dx, y + 0.5 - cy) : Math.abs(dx);
    if (dist >= outer) continue;
    if (y >= W.bot) { if (Math.abs(dx) < r + 4) R.px(x, y, y < W.bot + 3 ? 0x2a221c : 0x3e3226); continue; }
    let c;
    if (dist >= r + 12) c = dist >= r + 15 ? 0x3a2416 : dist >= r + 14 ? 0x8a603c : 0x5e3e26;
    else if (dist >= r + 4) {
      const k = (dist - r - 4) / 8;
      c = y < cy ? (k < 0.5 ? 0xb4a690 : 0xc4b8a0) : dx < 0 ? (k < 0.4 ? 0xc6ba9f : 0xd4c8b0) : (k < 0.4 ? 0xb0a48c : 0xc0b49c);
      if (y >= cy && Math.abs(Math.abs(dx) - (r + 6)) < 0.5 && (y & 3) === 0) c = mixc(c, 0x000000, 0.08);
    } else if (dist >= r) c = dist >= r + 3 ? 0x3e3226 : 0x2a221c;
    else { const i = R.at(x, y); if (i >= 0) R.d.fill(0, i, i + 4); continue; }
    R.px(x, y, c);
  }
  // the sill, deep, a little proud of the wall
  const sx0 = cx - r - 14, sx1 = cx + r + 14, sy = W.bot + 4;
  R.rect(sx0, sy, sx1 - sx0, 1, 0xe8dcc4); R.rect(sx0, sy + 1, sx1 - sx0, 2, 0xd0c4aa); R.rect(sx0, sy + 3, sx1 - sx0, 3, 0xa89a80); R.rect(sx0, sy + 6, sx1 - sx0, 1, 0x6a5e4c);
  R.shade(sx0, sy + 7, sx1 - sx0, 1, 0.55); R.shade(sx0, sy + 8, sx1 - sx0, 1, 0.75);
  // glazing bars: a mullion, transoms, and in the arch a fan of radial bars round a little hub
  const bar = 0x2e241c, barL = 0x4a3a2c, rows = W.rows;
  for (let y = W.top; y < W.bot; y++) if (inWin(W, cx - 1, y)) { R.px(cx - 1, y, barL); R.px(cx, y, bar); }
  for (const ry of rows) for (let x = W.x; x < W.x + W.w; x++) { R.px(x, ry, barL); R.px(x, ry + 1, bar); }
  if (fan) {
    for (const a of [Math.PI * 0.82, Math.PI * 0.6, Math.PI * 0.4, Math.PI * 0.18]) for (let k = 9; k < r; k++) { const x = Math.round(cx - 0.5 + Math.cos(a) * k), y = Math.round(cy - Math.sin(a) * k); if (inWin(W, x, y)) R.px(x, y, bar); }
    for (let a = 0; a <= Math.PI; a += 0.05) { const x = Math.round(cx - 0.5 + Math.cos(a) * 9), y = Math.round(cy - Math.sin(a) * 9); if (inWin(W, x, y)) R.px(x, y, bar); }
    // the casement's brass handle
    R.rect(cx + 1, 134, 1, 8, 0xd0a44c); R.px(cx + 1, 134, 0xf0d080); R.rect(cx + 1, 141, 2, 1, 0x9a7030); R.px(cx + 2, 142, 0x6a4a1c);
  }
  yield;
}

// the heavy velvet drapes either side of the window, gathered by gold cords
const drapeEdge = (y) => (y <= 140 ? 121 - 15 * Math.sin(((y - 18) / 122) * Math.PI / 2) : 106 + ((y - 140) / 106) * 14);
function drapes(R) {
  for (const side of [-1, 1]) for (let y = 17; y < FLOOR; y++) {
    const e = drapeEdge(y), x0 = side < 0 ? 94 : Math.round(320 - e), x1 = side < 0 ? Math.round(e) : 226, wd = Math.max(1, x1 - x0);
    for (let x = x0; x <= x1; x++) {
      const u = side < 0 ? (x - x0) / wd : (x1 - x) / wd;
      const v = Math.sin(u * Math.PI * 4.6 + 0.5 + (y > 140 ? (y - 140) * 0.01 : 0)) * 0.5 + 0.5 + (R.bay(x, y) - 0.5) * 0.06;
      let c = v > 0.84 ? 0xa8404a : v > 0.52 ? 0x8a2e38 : v > 0.22 ? 0x70222c : 0x521820;
      if (u > 0.92 && v > 0.5) c = 0xb85a60;
      if (x === x0 || x === x1) c = 0x3e1018;
      if (y >= 236) c = mixc(c, 0x2a0a10, 0.3);
      R.px(x, y, c);
    }
    if (y >= 138 && y <= 142) {
      for (let x = x0; x <= x1; x++) R.px(x, y, (x + y) % 3 === 0 ? 0x9a7028 : y === 138 ? 0xf0c868 : 0xd4a44a);
    }
  }
  // (the tassels hanging from the cords swing, so they are drawn each frame)
  // the rod, its rings and finials
  R.rect(88, 15, 144, 2, 0xc8963e); R.rect(88, 15, 144, 1, 0xf0d080);
  for (const fx of [87, 233]) { R.ell(fx, 16, 2, 2, 0xd4a44a); R.px(fx - 1, 15, 0xf8e0a0); }
  for (const [a, b] of [[95, 121], [199, 225]]) for (let x = a; x < b; x += 4) { R.rect(x, 17, 3, 2, 0xa8803a); R.px(x + 1, 17, 0x6a4a1c); }
  for (const bx of [91, 229]) R.rect(bx, 12, 2, 4, 0x8a6a2a);
}

// the fireplace on the chimney breast: a stone surround, an iron insert with an arched opening,
// firebrick, a grate and logs; the hearth, a fender and fire irons; an old map above it
function* fireplace(R) {
  // the chimney breast stands proud of the wall
  R.shade(226, 12, 2, 194, 0.62); R.rect(228, 12, 1, 194, 0x4a6654);
  R.shade(322, 12, 2, 194, 0.7);
  // the map, in a gilt frame
  R.rect(246, 58, 60, 54, 0xb8903e); R.rect(246, 58, 60, 1, 0xf0d080); R.rect(246, 58, 1, 54, 0xe0b860); R.rect(305, 58, 1, 54, 0x7a5a24); R.rect(246, 111, 60, 1, 0x6a4a1c);
  R.rect(248, 60, 56, 50, 0x8a6a2a); R.rect(249, 61, 54, 48, 0x5a4420);
  inkMap(R, 250, 62, 52, 46, 5, true);
  yield;
  // a brass picture light over it
  R.rect(276, 54, 1, 4, 0x8a6a2a); R.rect(262, 51, 29, 3, 0xb8863a); R.rect(262, 51, 29, 1, 0xf0d080); R.rect(262, 53, 29, 1, 0x7a5a24); R.px(261, 52, 0xd4a44a); R.px(291, 52, 0xd4a44a);
  yield;

  // the stone surround: the mantel shelf, a frieze with a carved tablet, two fluted pilasters
  const ST = 0xc4b8a2, STL = 0xdcd2be, STD = 0x9a8e7a, STDD = 0x7a705e;
  R.rect(230, 149, 94, 1, 0xece4d2); R.rect(230, 150, 94, 2, STL); R.rect(230, 152, 94, 3, ST); R.rect(230, 155, 94, 1, STD); R.rect(232, 156, 90, 2, STDD);
  R.rect(236, 158, 82, 13, ST); R.rect(236, 158, 82, 1, STL); R.rect(236, 170, 82, 1, STD);
  R.rect(262, 160, 28, 9, STL); R.rect(262, 160, 28, 1, 0xf2ecdc); R.rect(262, 168, 28, 1, STD); R.rect(289, 160, 1, 9, STD);
  for (let x = 265; x < 288; x += 3) { R.px(x, 163 + (x % 2), 0xa89c86); R.px(x + 1, 164, 0xa89c86); }
  R.ell(276, 164, 2, 2, 0xb0a48e); R.px(276, 164, 0xece4d2);
  for (const px of [236, 298]) {
    R.rect(px, 171, 18, 65, ST); R.rect(px, 171, 1, 65, STL); R.rect(px + 17, 171, 1, 65, STDD);
    R.rect(px - 1, 171, 20, 3, STL); R.rect(px - 1, 173, 20, 1, STD);
    for (let fx = px + 3; fx < px + 16; fx += 3) { R.rect(fx, 176, 1, 52, STD); R.rect(fx + 1, 176, 1, 52, 0xd4cab4); }
    R.rect(px - 1, 229, 20, 7, STL); R.rect(px - 1, 229, 20, 1, 0xece4d2); R.rect(px - 1, 235, 20, 1, STDD);
  }
  // the cast-iron insert and its arched opening
  R.rect(254, 171, 44, 65, 0x2a2624); R.rect(254, 171, 44, 1, 0x4a4440); R.rect(254, 171, 1, 65, 0x3a3634); R.rect(297, 171, 1, 65, 0x1a1816);
  for (let y = 172; y < 236; y++) for (let x = 255; x < 297; x++) {
    const dx = x + 0.5 - BOX.cx, dist = y < BOX.cy ? sq(dx, y + 0.5 - BOX.cy) : Math.abs(dx);
    if (dist < BOX.r + 3 && dist >= BOX.r + 1.5) R.px(x, y, dist < BOX.r + 2.2 ? 0x56504a : 0x3a3532);
    if (dist >= BOX.r || y >= BOX.bot) continue;
    // firebrick at the back, sooted toward the top; the cheeks darker
    const row = Math.floor((y - 180) / 3), off = row % 2 ? 3 : 0, mortar = (y - 180) % 3 === 2 || ((x + off) % 6) === 0;
    let c = mortar ? 0x2a1a14 : ((x + row * 5) % 7 < 3 ? 0x6a3a2a : 0x5e3226);
    const soot = Math.max(0, (204 - y) / 26);
    if (soot > 0) c = mixc(c, 0x120a08, Math.min(0.85, Math.round(soot * 4 + bay(x, y) * 0.9) / 4));
    if (Math.abs(dx) > BOX.r - 3) c = mixc(c, 0x120a08, 0.45);
    R.px(x, y, c);
  }
  // the ash bed, the grate's basket and legs, the logs
  for (let x = 261; x < 292; x++) for (let y = 230; y < 234; y++) R.px(x, y, (x * 3 + y) % 5 === 0 ? 0x7a7068 : 0x4a4440);
  R.thick(265, 218, 289, 215, 2, 0x4a3020); R.line(266, 216, 288, 213, 0x6a4a30); R.line(267, 220, 288, 217, 0x2a1a10);
  R.thick(262, 224, 287, 226, 2, 0x553422); R.line(263, 222, 286, 224, 0x7a5236); R.line(264, 226, 286, 228, 0x2e1c10);
  for (const [x, y] of [[270, 223], [279, 225], [274, 215], [283, 214]]) { R.px(x, y, 0x2a1a10); R.px(x + 1, y, 0x2a1a10); }
  R.ell(262, 225, 2, 2, 0xb08a5a); R.px(262, 225, 0x8a6a40); R.px(261, 224, 0xd8b080);
  R.rect(262, 227, 30, 1, 0x1a1614); R.rect(262, 233, 30, 1, 0x1a1614);
  for (let x = 263; x < 292; x += 3) R.rect(x, 227, 1, 7, 0x1e1a18);
  R.rect(262, 234, 2, 2, 0x1a1614); R.rect(290, 234, 2, 2, 0x1a1614);
  yield;
  // the hearth slab, the brass fender, the fire irons on their stand
  R.rect(238, 236, 76, 6, 0xb8ac96); R.rect(238, 236, 76, 1, 0xd4cab4); R.rect(238, 242, 76, 4, 0x8e8270); R.rect(238, 245, 76, 1, 0x6a604e);
  for (let x = 250; x < 304; x += 18) R.rect(x, 236, 1, 6, 0xa09480);
  R.rect(244, 239, 64, 2, 0xc8963e); R.rect(244, 239, 64, 1, 0xf0d080); R.rect(243, 236, 2, 6, 0xb8863a); R.rect(307, 236, 2, 6, 0xb8863a); R.px(243, 235, 0xf0d080); R.px(308, 235, 0xf0d080);
  // the fire irons hanging from their stand: a poker, a shovel, a brush, brass at the grips
  R.ell(246, 237, 5, 1, 0x2a2624); R.rect(245, 204, 2, 33, 0x2e2a28); R.px(245, 204, 0x5a5450); R.rect(244, 201, 4, 3, 0xd4a44a); R.px(244, 201, 0xf0d080);
  R.rect(240, 208, 13, 1, 0x2e2a28);
  for (const [tx, kind] of [[241, 'poker'], [251, 'shovel'], [248, 'brush']]) {
    R.rect(tx - 1, 206, 3, 3, 0xd4a44a); R.px(tx, 207, 0x5a4434); R.px(tx - 1, 206, 0xf0d080);
    R.rect(tx, 209, 1, 22, 0x3a3634); R.px(tx, 209, 0x5a5450);
    if (kind === 'poker') { R.rect(tx, 231, 1, 4, 0x3a3634); R.px(tx + 1, 233, 0x3a3634); }
    if (kind === 'shovel') { R.rect(tx - 2, 230, 5, 5, 0x34302e); R.rect(tx - 2, 230, 5, 1, 0x5a5450); }
    if (kind === 'brush') { R.rect(tx - 1, 230, 3, 5, 0x6a5440); for (let k = 0; k < 3; k++) R.px(tx - 1 + k, 235, 0x4a3a2a); }
  }
}

// the mantel shelf's things: a pair of candlesticks, two books, the bracket clock, a small globe
function mantel(R) {
  for (const [wx, wy] of CANDLES) {
    R.rect(wx - 4, 147, 9, 2, 0xc8963e); R.rect(wx - 4, 147, 9, 1, 0xf0d080);
    R.rect(wx - 1, wy + 15, 3, 12, 0xb8863a); R.px(wx - 1, wy + 15, 0xf0d080); R.rect(wx - 2, wy + 19, 5, 2, 0xd4a44a); R.rect(wx - 2, wy + 25, 5, 1, 0xd4a44a);
    R.rect(wx - 3, wy + 13, 7, 2, 0xd4a44a); R.px(wx - 3, wy + 13, 0xf8e0a0);
    R.rect(wx - 2, wy + 1, 5, 12, 0xeee4cc); R.rect(wx - 2, wy + 1, 1, 12, 0xfff8e8); R.rect(wx + 2, wy + 1, 1, 12, 0xc8bca0);
    R.px(wx - 2, wy + 4, 0xfff8e8); R.px(wx + 2, wy + 6, 0xe8dcc0); R.px(wx, wy, 0x2a1a10);
  }
  R.rect(247, 145, 15, 4, 0x2e5a3e); R.rect(247, 145, 15, 1, 0x4a7a5a); R.rect(249, 147, 1, 1, GILT); R.rect(259, 147, 1, 1, GILT); R.rect(261, 145, 1, 4, 0xeadcc0);
  R.rect(248, 141, 13, 4, 0x7a2a26); R.rect(248, 141, 13, 1, 0x9a4a3a); R.rect(250, 143, 9, 1, GILT); R.rect(260, 141, 1, 4, 0xeadcc0);
  // the bracket clock: mahogany, a bell top, a brass handle and feet, the dial, a window onto the pendulum
  const MH = 0x6a2e1e, MHL = 0x8e4428, MHD = 0x481c12;
  [12, 16, 20, 22, 24, 24, 26, 26].forEach((w, k) => { R.rect(277 - w / 2, 111 + k, w, 1, k < 2 ? MHL : MH); R.px(277 - w / 2, 111 + k, MHL); R.px(276 + w / 2, 111 + k, MHD); });
  R.rect(273, 107, 9, 1, 0xd4a44a); R.px(272, 108, 0xd4a44a); R.px(282, 108, 0xd4a44a); R.px(272, 109, 0xb8863a); R.px(282, 109, 0xb8863a); R.rect(276, 110, 3, 1, 0xa8803a);
  R.rect(264, 119, 26, 29, MH); R.rect(264, 119, 1, 29, MHL); R.rect(289, 119, 1, 29, MHD); R.rect(264, 119, 26, 1, 0xd4a44a);
  R.rect(263, 147, 28, 2, MHD); R.rect(263, 147, 28, 1, MH);
  for (const fx of [264, 287]) { R.rect(fx, 149, 3, 1, 0xd4a44a); }
  R.ell(277, 128, 8, 8, 0xd4a44a); R.ell(277, 128, 7, 7, 0xb8863a); R.ell(277, 128, 6, 6, 0xf0e6cc);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; R.px(Math.round(277 + Math.cos(a) * 5.2), Math.round(128 + Math.sin(a) * 5.2), k % 3 ? 0x8a7a60 : 0x2a2018); }
  R.rect(272, 138, 11, 9, 0xd4a44a); R.rect(273, 139, 9, 7, 0x1e1410); R.px(273, 139, 0x4a3a30);
  for (const [cx2, cy2] of [[266, 121], [287, 121], [266, 145], [287, 145]]) R.px(cx2, cy2, 0xd4a44a);
  // the little globe's stand and its brass meridian (the sphere turns, so it is drawn each frame)
  R.rect(295, 147, 13, 2, 0x4a2e1e); R.rect(295, 147, 13, 1, 0x6a4430); R.rect(300, 144, 3, 3, 0xb8863a);
  for (let a = -0.4; a < Math.PI + 0.4; a += 0.04) { const x = Math.round(GLOBE.x + Math.cos(a) * 8), y = Math.round(GLOBE.y + Math.sin(a) * 8); if (x >= GLOBE.x - 2) R.px(x, y, 0xc8963e); }
  R.px(GLOBE.x, GLOBE.y - 8, 0xf0d080); R.px(GLOBE.x, GLOBE.y + 8, 0xa8803a);
}

// a braided rug on the hearth, and the cat's velvet cushion
function hearthRug(R) {
  for (let y = 246; y < 270; y++) for (let x = 248; x < 324; x++) {
    const d = sq((x - 286) / 34, (y - 258) / 9);
    if (d > 1) continue;
    const ring = Math.floor(d * 7 + ((x * 0.5) % 1) * 0.3);
    R.px(x, y, [0x8a5a3a, 0x6a3a2a, 0xa8865a, 0x5a3a2e, 0x8a5a3a, 0x7a4a3a, 0xa8865a][ring % 7]);
  }
  R.ell(286, 259, 19, 4, 0x4a1a24);
  R.ell(286, 255, 19, 4, 0x6e2a3a); R.ell(285, 254, 15, 2, 0x8a3a4a); R.ell(283, 253, 8, 1, 0xa04a58);
  for (let x = 268; x < 305; x++) R.px(x, 258 + Math.round(Math.sin((x - 267) / 37 * Math.PI) * 1), 0xc8963e);
  for (const tx of [266, 305]) { R.rect(tx, 255, 2, 3, 0xd4a44a); R.rect(tx, 258, 2, 2, 0xa8803a); }
}

// the cat, a grey tabby curled on the cushion, painted from shapes; f: 0–2 breathing, 3 head up,
// 4 stretching (rump up, front legs reaching out), 5 yawning, 6 an ear twitched, 7 a flick of the tail
const CATC = { o: 0x1e1c22, b: 0x787680, s: 0x44424a, h: 0x9a98a2, d: 0x5c5a64, w: 0xe0dcd4, p: 0xd08a8e, e: 0x1e1c22, g: 0xb8c860, m: 0x8a3a44 };
const CAT0 = { x: 256, y: 226, w: 56, h: 34 }, CATG = new Map(), CATRIM = new Map();
function catGrid(f) {
  let G = CATG.get(f);
  if (G) return G;
  const W = CAT0.w, Hh = CAT0.h, DX = 2, DY = 6;   // shapes are laid out from (258, 232)
  G = Array.from({ length: Hh }, () => new Array(W).fill('.'));
  const set = (x, y, k) => { x = Math.round(x) + DX; y = Math.round(y) + DY; if (x >= 0 && y >= 0 && x < W && y < Hh) G[y][x] = k; };
  const ell = (cx, cy, rx, ry, fn) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) set(x, y, fn(x, y)); };
  const head = (hx, hy, eyes, earL = 0, earR = 0) => {
    ell(hx, hy, 6.2, 5, (x, y) => (y < hy - 2 ? 'h' : y > hy + 2 ? 'd' : 'b'));
    for (const [ex, dir, fl] of [[hx - 4, -1, earL], [hx + 3, 1, earR]]) for (let k = 0; k < 4 - fl; k++) for (let j = 0; j <= 3 - k; j++) set(ex + dir * (j * 0.5 + fl), hy - 4 - k + fl, 'b');
    if (!earL) { set(hx - 4, hy - 7, 'b'); set(hx - 4, hy - 6, 'p'); }
    if (!earR) { set(hx + 4, hy - 7, 'b'); set(hx + 4, hy - 6, 'p'); } else set(hx + 5, hy - 5, 'b');
    set(hx - 2, hy - 4, 's'); set(hx, hy - 4, 's'); set(hx + 2, hy - 4, 's'); set(hx, hy - 3, 's');
    set(hx - 1, hy + 2, 'w'); set(hx, hy + 2, 'w'); set(hx + 1, hy + 2, 'w'); set(hx, hy + 3, 'w'); set(hx, hy + 1, 'p');
    if (eyes === 'open') { set(hx - 3, hy, 'g'); set(hx - 2, hy, 'e'); set(hx + 2, hy, 'e'); set(hx + 3, hy, 'g'); }
    else if (eyes === 'yawn') { set(hx - 3, hy - 1, 'e'); set(hx - 2, hy, 'e'); set(hx + 2, hy, 'e'); set(hx + 3, hy - 1, 'e'); set(hx, hy + 3, 'm'); set(hx - 1, hy + 3, 'm'); set(hx + 1, hy + 3, 'm'); set(hx, hy + 4, 'm'); set(hx, hy + 2, 'p'); }
    else { set(hx - 3, hy, 'e'); set(hx - 2, hy + 1, 'e'); set(hx + 2, hy + 1, 'e'); set(hx + 3, hy, 'e'); }
  };
  if (f === 4) {
    // the stretch: the tail up, the rump high on straight back legs, the back sloping down to a low
    // chest, the front legs reaching far out along the cushion, the chin down between them
    for (let k = 0; k <= 14; k++) { const u = k / 14, x = 6 - u * 4 + Math.sin(u * 3) * 1.5, y = 4 - u * 10; set(x, y, k > 11 ? 's' : 'b'); set(x + 1, y, 'b'); }
    for (let y = 8; y < 24; y++) for (const [lx, c] of [[5, 'd'], [6, 'b'], [7, 'b'], [11, 'b'], [12, 'b'], [13, 'd']]) set(lx, y, y > 21 ? 'w' : c);
    ell(9.5, 6.5, 6.5, 5, (x, y) => (y < 3 ? 'h' : 'b'));
    for (let k = 0; k <= 14; k++) {
      const u = k / 14, cx = 12 + u * 19, cy = 7.5 + u * 9.5;
      ell(cx, cy, 5.2 - u * 1.4, 4.6 - u * 1.2, (x, y) => (y < cy - 2.6 + u ? 'h' : (Math.floor(x * 0.55 + y * 0.3) & 1) && y < cy + 1.5 ? 's' : 'b'));
    }
    for (let x = 28; x < 47; x++) { set(x, 21, x % 5 === 0 ? 's' : 'b'); set(x, 22, 'b'); set(x, 23, 'd'); }
    for (const px of [44, 46]) { set(px, 21, 'w'); set(px + 1, 21, 'w'); set(px, 22, 'w'); set(px + 1, 22, 'w'); set(px + 1, 23, 'w'); }
    head(36, 17, 'shut', 1, 1);
  } else {
    const up = f === 3 || f === 5;
    // the body: a curled loaf, its stripes running round it
    const bcx = 18, bry = 8.6 + Math.min(f === 6 || f === 7 ? 1 : f, 2) * 0.45, brx = 13.5, bcy = 23.5 - bry;
    ell(9, 16, 6.5, 6, () => 'b');
    ell(bcx, bcy, brx, bry, (x, y) => {
      const top = (y - (bcy - bry)) / (2 * bry), u = (x - bcx) * 0.8 - (y - bcy) * (x - bcx) * 0.035;
      if (top > 0.08 && top < 0.8 && (((u % 3.6) + 3.6) % 3.6) < 1.5 && Math.abs(x - bcx) < brx - 1.5) return 's';
      return top < 0.1 ? 'h' : top > 0.74 ? 'd' : 'b';
    });
    for (let x = 4; x < 32; x++) if (G[23 + DY][x + DX] !== '.') G[23 + DY][x + DX] = 'd';
    // the tail, wrapped round the front, its tip by the paws (lifted, in a flick)
    for (let k = 0; k <= 26; k++) {
      const u = k / 26, lift = f === 7 ? Math.max(0, u - 0.7) * 16 : 0;
      const x = (1 - u) ** 2 * 4 + 2 * u * (1 - u) * 6 + u * u * 28 + lift * 0.3, y = (1 - u) ** 2 * 18 + 2 * u * (1 - u) * 26 + u * u * 24 - lift;
      for (const [dx, dy] of [[0, 0], [0, -1], [1, 0]]) set(x + dx, y + dy, Math.floor(k / 3) % 2 ? 's' : 'b');
      if (k > 23) set(x, y, 'e');
    }
    const hx = up ? 34 : 33, hy = up ? 11 : 16;
    if (up) ell(31, 15, 4, 5, () => 'b');
    head(hx, hy, f === 3 ? 'open' : f === 5 ? 'yawn' : 'shut', 0, f === 6 ? 1 : 0);
    for (const px of [hx - 3, hx + 1]) { set(px, 21, 'w'); set(px + 1, 21, 'w'); set(px + 2, 21, 'w'); set(px, 22, 'w'); set(px + 1, 22, 'w'); set(px + 2, 22, 'w'); }
  }
  // an outline round it all
  const out = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (G[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G[y + dy]?.[x + dx] && G[y + dy][x + dx] !== '.' && G[y + dy][x + dx] !== 'o')) out.push([x, y]);
  for (const [x, y] of out) if (y < 24 + DY) G[y][x] = 'o';
  // the fur along its top, where the fire's light catches it
  const rim = [];
  for (let x = 0; x < W; x++) for (let y = 0; y < Hh; y++) { const k = G[y][x]; if (k === '.' || k === 'o') continue; if ('hbs'.includes(k)) rim.push([CAT0.x + x, CAT0.y + y]); break; }
  CATRIM.set(f, rim);
  CATG.set(f, G);
  return G;
}
function paintCat(S, f) {
  catGrid(f).forEach((row, y) => row.forEach((k, x) => { if (k !== '.') S.px(CAT0.x + x, CAT0.y + y, CATC[k]); }));
}
const catRim = (f) => (catGrid(f), CATRIM.get(f));

// a fern: fronds arching out of the pot and drooping, their leaflets alternating light and dark
function paintFern(S, bx, by, n, len, sway, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI * (0.06 + (0.88 * (i + r() * 0.6)) / n), dir = a0 > -Math.PI / 2 ? 1 : -1;
    const L = Math.round(len * (0.65 + r() * 0.45)), bend = 0.03 + r() * 0.03;
    let x = bx, y = by, ang = a0;
    for (let k = 0; k < L; k++) {
      ang += dir * bend * (k / L + 0.4);
      x += Math.cos(ang) * 0.9; y += Math.sin(ang) * 0.9;
      const f = k / L, px = x + sway * f ** 1.6 * 2.6, py = y;
      S.px(px, py, f < 0.3 ? 0x2e5a26 : 0x3a6e2e);
      const pl = f < 0.08 ? 0 : Math.max(1, Math.round((1 - f) * 3.2));
      if (k % 2 === 0 && pl) {
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        for (let j = 1; j <= pl; j++) {
          S.px(px + nx * j + Math.cos(ang) * j * 0.5, py + ny * j + Math.sin(ang) * j * 0.5, j === pl ? 0x8ac070 : 0x5a9a4a);
          S.px(px - nx * j + Math.cos(ang) * j * 0.5, py - ny * j + Math.sin(ang) * j * 0.5, j === pl ? 0x4a8a3e : 0x3a7a36);
        }
      }
    }
  }
}

// the stack of leather books on the table, spines to you
function bookStack(R) {
  const books = [[210, 34, 6, 0x7a2a26], [212, 30, 5, 0x2e5a3e], [209, 31, 5, 0x2a3a5c], [213, 30, 6, 0x8a5a2a], [214, 25, 4, 0x5c2234]];
  let y = 238;
  for (const [x, w, h, c] of books) {
    y -= h;
    R.rect(x, y, w, h, c); R.rect(x, y, w, 1, mixc(c, 0xffffff, 0.28)); R.rect(x, y + h - 1, w, 1, mixc(c, 0x000000, 0.4));
    R.rect(x + 2, y + 1, 1, h - 2, GILT); R.rect(x + w - 3, y + 1, 1, h - 2, GILT);
    R.rect(x + Math.floor(w / 2) - 4, y + Math.floor(h / 2), 8, 1, GILT);
    if (h > 4) R.rect(x + 5, y + 1, 1, h - 2, mixc(c, 0x000000, 0.3));
    R.px(x, y + 1, mixc(c, 0xffffff, 0.15));
  }
  R.shade(208, 238, 38, 2, 0.65);
}

// the open book: aged pages bowing up from the spine, a page block and an oxblood cover
const bookLift = (u) => { const a = Math.abs(u - 34) / 34; return Math.round(3.4 * (1 - a) ** 1.5 * Math.min(1, a * 6 + 0.35)); };
const pageTop = (u) => BOOK.y0 + 3 - bookLift(u);
const pageBot = (u) => BOOK.y0 + 25 - Math.round(bookLift(u) * 0.5);
function openBook(R) {
  for (let u = -2; u < 71; u++) {
    const x = BOOK.x0 + u, uc = clamp(u, 0, 68), t = pageTop(uc), b = pageBot(uc);
    R.rect(x, t - 1, 1, b - t + 6, 0x6a2420);
    R.px(x, b + 5, 0x3a1210);
  }
  for (let u = 0; u < 69; u++) {
    const x = BOOK.x0 + u, t = pageTop(u), b = pageBot(u), a = Math.abs(u - 34);
    for (let y = t; y <= b; y++) {
      let c = 0xeee0c0;
      if (a < 2) c = 0xb8a47e; else if (a < 4) c = 0xd2c098; else if (a < 6) c = 0xe2d2ae;
      else if (u < 3 || u > 65) c = 0xdcc8a0;
      if ((u * 7 + y * 3) % 41 === 0 && a > 6) c = 0xe0cca4;
      R.px(x, y, c);
    }
    R.px(x, b + 1, (u % 2) ? 0xd8c8a4 : 0xc4b088); R.px(x, b + 2, (u % 3) ? 0xc8b48c : 0xe0d0b0);
    R.px(x, t, a < 3 ? 0xc8b48c : 0xf6ecd4);
  }
  // the ribbon
  R.rect(161, pageBot(35) + 2, 2, 7, 0x9a2230); R.px(161, pageBot(35) + 9, 0x9a2230); R.px(162, pageBot(35) + 2, 0xc84050);
  R.shade(BOOK.x0 - 2, pageBot(0) + 6, 74, 2, 0.7);
}

// the teacup: a round bowl, a band of blue sprigs between gold lines, a clear loop of a handle,
// and inside, past a shadowed back rim, the tea (with a glint of the lamp) at its level
function paintCup(S, level) {
  const cx = CUP.x, top = 256, HW = [7, 7, 7, 7, 7, 6, 6, 5, 5, 4, 3];
  HW.forEach((hw, k) => {
    const y = top + k;
    for (let x = cx - hw; x <= cx + hw; x++) { const u = (x - (cx - hw)) / (2 * hw); S.px(x, y, u < 0.18 ? 0xfaf6ec : u > 0.84 ? 0xb4ac9c : u > 0.64 ? 0xd4cdbf : 0xece6da); }
    S.px(cx + hw + 1, y, 0x8a8274);
  });
  S.rect(cx - 3, top + HW.length, 7, 1, 0x8a8274);
  S.rect(cx - 7, top + 1, 15, 1, 0xc8a050); S.rect(cx - 7, top + 4, 15, 1, 0xc8a050);
  for (let x = cx - 6; x <= cx + 6; x++) S.px(x, top + 2 + (x & 1), (x % 3 === 0) ? 0x5a7ab8 : 0x3a5a98);
  // the handle: a loop with daylight through it
  for (const [dx, dy, c] of [[8, 1, 0xe2dccc], [9, 1, 0xd4cdbf], [10, 2, 0xc8c0b0], [10, 3, 0xc8c0b0], [10, 4, 0xb4ac9c], [10, 5, 0xb4ac9c], [9, 6, 0xb4ac9c], [8, 6, 0xc8c0b0], [11, 3, 0x8a8274], [11, 4, 0x8a8274], [10, 6, 0x8a8274]]) S.px(cx + dx, top + dy, c);
  // the rim, seen from a little above: a shadowed back edge, the tea, a bright front edge
  for (let x = cx - 7; x <= cx + 7; x++) {
    const e = Math.sqrt(Math.max(0, 1 - ((x - cx) / 7.6) ** 2)), up = Math.round(e * 2.2);
    S.px(x, top - up, Math.abs(x - cx) > 5 ? 0xe2dccc : 0xfaf6ec);
    for (let y = top - up + 1; y < top + up; y++) {
      const depth = y - (top - up + 1);
      let c = depth === 0 ? 0xa49c8e : 0xd8d2c4;
      if (level >= 3) c = depth === 0 ? 0x9a8a74 : 0x7a4218;
      else if (level === 2) c = depth < 2 ? 0xbcb4a6 : 0x6a3814;
      else if (level === 1) c = depth < 2 ? 0xbcb4a6 : y === top + up - 1 ? 0x5a3010 : 0xc4bcae;
      else c = depth === 0 ? 0xa49c8e : 0xd0c8b8;
      S.px(x, y, c);
    }
    S.px(x, top + up, 0xfaf6ec);
  }
  if (level >= 2) { S.px(cx - 3, top - (level >= 3 ? 0 : -1), 0xd8a068); S.px(cx - 2, top - (level >= 3 ? 0 : -1), 0xa86a32); }
}

// an old map drawn in ink on warm parchment: islands with a continuous inked coast and an echo
// line round them in the sea, a few wave strokes, a cartouche with its title, and on a big one a
// compass rose with its rhumb lines and a little ship
const INK = 0x2e1a0c, PARCH = 0xe2c992;
function inkMap(R, x0, y0, w, h, seed, big) {
  const r = rng(seed), m = new Float32Array(w * h), land = new Uint8Array(w * h), dist = new Uint8Array(w * h).fill(9);
  const n = big ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const cx = r() * w, cy = (big ? 6 : 3) + r() * (h - (big ? 12 : 6)), rx = (big ? 4 : 3) + r() * w * (big ? 0.17 : 0.24), ry = 2 + r() * h * (big ? 0.13 : 0.2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] += Math.max(0, 1 - sq((x - cx) / rx, (y - cy) / ry));
  }
  for (let i = 0; i < w * h; i++) land[i] = m[i] + Math.sin((i % w) * 0.7 + Math.floor(i / w) * 0.3) * 0.07 > 0.55 ? 1 : 0;
  // how far each bit of sea lies from a coast, for the echo line
  let front = [];
  for (let i = 0; i < w * h; i++) if (land[i]) { dist[i] = 0; front.push(i); }
  for (let d = 1; d < 6 && front.length; d++) {
    const next = [];
    for (const i of front) { const x = i % w; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && dist[j] > d) { dist[j] = d; next.push(j); } }
    front = next;
  }
  const isLand = (x, y) => x >= 0 && y >= 0 && x < w && y < h && land[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let c = (x * 7 + y * 13) % 31 === 0 ? 0xd2b47e : PARCH;
    if (sq(x - w * 0.12, y - h * 0.86) < 4 || sq(x - w * 0.86, y - h * 0.12) < 3) c = 0xccaa74;   // foxing
    if (land[i]) {
      const coast = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
      c = coast ? INK : (!isLand(x - 2, y) || !isLand(x, y - 2)) ? 0xa88a52 : 0xbe9c5e;
      if (!coast && big && (x + y * 2) % 7 === 0 && m[i] > 0.9) c = 0x8a7a4a;   // a few hills
    } else if (dist[i] === 2 && (x + y) % 2 === 0) c = 0x9a7e56;
    else if (dist[i] === 4 && (x * 3 + y) % 4 === 0) c = 0xbc9e6c;
    R.px(x0 + x, y0 + y, c);
  }
  // wave strokes out in the open sea
  for (let k = 0; k < (big ? 6 : 2); k++) {
    const x = 3 + Math.floor(r() * (w - 8)), y = 3 + Math.floor(r() * (h - 6));
    if (dist[y * w + x] < 6 || dist[y * w + x + 3] < 6) continue;
    R.px(x0 + x, y0 + y, 0x9a7c52); R.px(x0 + x + 1, y0 + y - 1, 0x9a7c52); R.px(x0 + x + 2, y0 + y, 0x9a7c52); R.px(x0 + x + 3, y0 + y - 1, 0x9a7c52);
  }
  // the cartouche: a scroll with the title in it
  const cw = big ? 20 : Math.min(14, w - 6), cx = x0 + 2, cy = y0 + 2;
  R.rect(cx, cy, cw, big ? 8 : 6, 0xf0e2b8); R.rect(cx, cy, cw, 1, INK); R.rect(cx, cy + (big ? 7 : 5), cw, 1, INK);
  R.rect(cx - 1, cy + 1, 1, big ? 6 : 4, INK); R.rect(cx + cw, cy + 1, 1, big ? 6 : 4, INK); R.px(cx - 2, cy + 1, INK); R.px(cx + cw + 1, cy + (big ? 6 : 4), INK);
  R.rect(cx + 2, cy + 2, cw - 4, 1, 0x7a4a2a); if (big) R.rect(cx + 4, cy + 4, cw - 8, 1, 0x9a7a5a);
  if (!big) return;
  // the compass rose and its rhumb lines, and a little ship under sail
  const rx = x0 + w - 10, ry = y0 + h - 10;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; for (let d = 8; d < 30; d += 3) { const x = Math.round(rx + Math.cos(a) * d), y = Math.round(ry + Math.sin(a) * d); if (x > x0 && x < x0 + w - 1 && y > y0 && y < y0 + h - 1 && !isLand(x - x0, y - y0)) R.px(x, y, 0xb89a6c); } }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 - Math.PI / 2, len = k % 2 ? 4 : 6; R.line(rx, ry, Math.round(rx + Math.cos(a) * len), Math.round(ry + Math.sin(a) * len), k === 0 ? 0xa83a2a : INK); }
  R.ell(rx, ry, 1, 1, 0xf0e2b8); R.px(rx, ry, 0xd4ac58);
  const sx = x0 + Math.round(w * 0.55), sy = y0 + h - 5;
  R.rect(sx - 3, sy, 7, 1, INK); R.rect(sx - 2, sy + 1, 5, 1, INK); R.rect(sx, sy - 5, 1, 5, INK); R.rect(sx - 2, sy - 4, 2, 3, 0xf6ecd4); R.rect(sx + 1, sy - 4, 2, 3, 0xf6ecd4); R.px(sx, sy - 6, 0xa83a2a);
}
// a framed map on the wall; maps are things you can click
function mapFrame(R, x, y, w, h, seed, frameC, geo) {
  R.rect(x, y, w, h, frameC); R.rect(x, y, w, 1, mixc(frameC, 0xffffff, 0.35)); R.rect(x + w - 1, y, 1, h, mixc(frameC, 0x000000, 0.4)); R.rect(x, y + h - 1, w, 1, mixc(frameC, 0x000000, 0.4));
  R.rect(x + 1, y + 1, w - 2, h - 2, mixc(frameC, 0x000000, 0.3));
  inkMap(R, x + 2, y + 2, w - 4, h - 4, seed, false);
  R.shade(x + 1, y + h, w, 1, 0.7);
  if (geo) { geo.maps.push({ x0: x, y0: y, x1: x + w, y1: y + h, seed }); geo.lights.push({ id: 'map' + geo.maps.length, kind: 'rect', x0: x + 1, x1: x + w - 1, y0: y + 1, y1: y + h - 1, k: 0.2, top: 0.06 }); }
}

// ——— the bays of the full-screen room ———
// the reading nook: an alcove in the panelling with a little arched window and a window seat
function* nookBay(R) {
  R.rect(-92, 50, 88, 196, 0x2e3e34);
  wallpaper(R, -86, -10, 50, 196); R.shade(-86, 50, 76, 146, 0.78);
  R.rect(-94, 40, 92, 10, 0x5a3a26); R.rect(-94, 40, 92, 1, 0x9a6a44); R.rect(-94, 49, 92, 1, 0x3a2618);
  for (let x = -90; x < -6; x += 6) R.rect(x, 44, 3, 3, 0x6e4a32);
  for (const px of [-94, -10]) { R.rect(px, 50, 8, 196, 0x5a3a26); R.rect(px, 50, 1, 196, 0x9a6a44); R.rect(px + 7, 50, 1, 196, 0x3a2618); for (let y = 60; y < 240; y += 44) { R.rect(px + 2, y, 4, 36, 0x664530); R.rect(px + 2, y, 4, 1, 0x84603e); } }
  R.shade(-86, 50, 6, 196, 0.6); R.shade(-16, 50, 6, 196, 0.7);
  yield* archWindow(R, NOOK, false);
  // the seat: a panelled box, a green velvet cushion, pillows, a folded blanket, a book left open
  R.rect(-86, 206, 76, 40, 0x553823); R.rect(-86, 206, 76, 1, 0x7a5638);
  for (let x = -82; x < -14; x += 23) { R.rect(x, 212, 19, 28, 0x5e3f28); R.rect(x, 212, 19, 1, 0x7c5838); R.rect(x, 239, 19, 1, 0x3a2516); }
  R.rect(-87, 197, 78, 9, 0x2e5a3e); R.rect(-87, 197, 78, 1, 0x4a7a5a); R.rect(-87, 198, 78, 1, 0x3a6a4c); R.rect(-87, 205, 78, 1, 0x1e3a28);
  for (let x = -80; x < -12; x += 10) { R.px(x, 200, 0x1e3a28); R.px(x + 5, 202, 0x1e3a28); }
  // pillows leaning in the corners: rounded, with a seam and a sag
  const pillow = (x0, y0, w, h, c, lean) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ex = Math.abs((x + 0.5) / w - 0.5) * 2, ey = Math.abs((y + 0.5) / h - 0.5) * 2;
      if (ex ** 3 + ey ** 3 > 1) continue;
      let k = c; if (y < h * 0.3 && x * lean < w * 0.5 * lean + 2) k = mixc(c, 0xffffff, 0.22); if (y > h * 0.7) k = mixc(c, 0x000000, 0.3);
      if (Math.abs(x - w / 2 + lean * (y - h / 2) * 0.3) < 0.6 && y > 1 && y < h - 2) k = mixc(c, 0x000000, 0.22);
      R.px(x0 + x + Math.round(lean * (h - y) * 0.15), y0 + y, k);
    }
  };
  pillow(-86, 183, 16, 15, 0xc8963a, 1); pillow(-30, 184, 15, 14, 0x7a2a26, -1);
  R.rect(-54, 192, 18, 5, 0x2a4a6a); for (let x = -54; x < -36; x += 3) R.rect(x, 192, 1, 5, 0xa83a2a); R.rect(-54, 194, 18, 1, 0xd8c890); R.rect(-54, 192, 18, 1, 0x3a5a7a); R.rect(-54, 196, 18, 1, 0x1a2a3a);
  R.poly([[-68, 196], [-57, 196], [-59, 192], [-63, 193], [-66, 192]], 0x7a2a26); R.line(-66, 193, -59, 193, 0xd8c8a0);
  // a brass lantern on the seat with a candle in it
  { const lx = NLAMP[0];
    R.rect(lx - 5, 195, 11, 2, 0x8a6a2a); R.rect(lx - 5, 195, 11, 1, 0xd4a44a);
    R.rect(lx - 4, 185, 9, 10, 0x3a2a1e); R.rect(lx - 3, 186, 7, 9, 0x5a4a3a);
    R.rect(lx - 3, 191, 7, 4, 0x6a5a48); R.rect(lx - 1, 191, 3, 4, 0xeee4cc);
    R.rect(lx - 4, 185, 1, 10, 0xb8863a); R.rect(lx + 4, 185, 1, 10, 0x8a6a2a); R.rect(lx, 186, 1, 9, 0x8a6a2a);
    for (let k = 0; k < 3; k++) R.rect(lx - 3 + k, 184 - k, 7 - k * 2, 1, 0xa8803a);
    R.px(lx, 180, 0xd4a44a); R.px(lx - 1, 179, 0xd4a44a); R.px(lx + 1, 179, 0xd4a44a); R.px(lx, 178, 0xd4a44a); }
  yield;
}
// a standing lamp with a fringed silk shade
function standingLamp(R, sx) {
  R.ell(sx, 244, 7, 2, 0x6a4a1c); R.ell(sx, 243, 6, 1, 0xc8963e); R.rect(sx, 140, 1, 102, 0xb8863a); R.px(sx, 170, 0xf0d080); R.rect(sx - 1, 200, 3, 2, 0xd4a44a);
  R.poly([[sx - 7, 120], [sx + 7, 120], [sx + 11, 138], [sx - 11, 138]], 0xd8b878); R.line(sx - 7, 120, sx + 7, 120, 0xe8d0a0);
  for (let x = sx - 6; x < sx + 7; x += 3) R.line(x, 121, x + Math.round((x - sx) * 0.3), 137, 0xc0a060);
  for (let x = sx - 11; x <= sx + 11; x += 2) R.px(x, 139, 0xa8803a);
  R.shade(sx - 8, 245, 17, 1, 0.6);
}
// a plant stand for a fern (the fern sways, so it is a sprite)
function fernStand(R, fx) {
  R.rect(fx - 9, 196, 19, 3, 0x5a3a26); R.rect(fx - 9, 196, 19, 1, 0x8a6040);
  R.rect(fx - 3, 199, 7, 40, 0x4e321f); R.rect(fx - 3, 199, 1, 40, 0x7a5236); R.rect(fx + 3, 199, 1, 40, 0x2e1c12);
  for (const y of [206, 226]) R.rect(fx - 4, y, 9, 2, 0x5a3a26);
  R.rect(fx - 8, 239, 17, 7, 0x5a3a26); R.rect(fx - 8, 239, 17, 1, 0x8a6040);
  R.rect(fx - 8, 184, 17, 12, 0xb8863a); R.rect(fx - 9, 183, 19, 2, 0xd4a44a); R.rect(fx - 8, 184, 1, 12, 0xf0d080); R.rect(fx + 8, 184, 1, 12, 0x7a5a24);
  for (let x = fx - 6; x < fx + 7; x += 3) R.px(x, 190, 0x9a7030);
  R.shade(fx - 8, 246, 17, 1, 0.6);
}
// a floor globe on its stand (the sphere turns, so it is drawn each frame)
function floorGlobe(R, g) {
  R.line(g.x - 10, 246, g.x - 4, g.y + 16, 0x4a2e1e); R.line(g.x + 10, 246, g.x + 4, g.y + 16, 0x4a2e1e); R.line(g.x, 246, g.x, g.y + 16, 0x5a3a26);
  R.rect(g.x - 12, g.y + 14, 25, 3, 0x6a4430); R.rect(g.x - 12, g.y + 14, 25, 1, 0x8a6040);
  for (let a = 0; a < Math.PI * 2; a += 0.02) { const x = Math.round(g.x + Math.cos(a) * (g.r + 2)), y = Math.round(g.y + Math.sin(a) * (g.r + 2)); if (x >= g.x - 2 || y > g.y + 6) R.px(x, y, 0xc8963e); }
  R.shade(g.x - 14, 244, 28, 2, 0.6);
}
// the writing desk under a second window: a gallery of pigeonholes with a candle on it, letters,
// a writing slope with a half-written sheet, an inkwell and its quill, sealing wax; drawers, legs
function* deskBay(R) {
  yield* archWindow(R, DWIN, false);
  const d0 = 330, d1 = 394;
  R.rect(d0 + 4, 188, d1 - d0 - 8, 22, 0x4e321f); R.rect(d0 + 4, 188, d1 - d0 - 8, 2, 0x7a5236); R.rect(d0 + 3, 188, 1, 22, 0x7a5236); R.rect(d1 - 4, 188, 1, 22, 0x2e1c12);
  for (let k = 0; k < 5; k++) {
    const px = d0 + 7 + k * 11;
    R.rect(px, 191, 9, 8, 0x22150e);
    if (k % 2 === 0) { R.rect(px + 1, 193, 7, 6, 0xe8dcc0); R.rect(px + 1, 193, 7, 1, 0xfff4dc); } else R.rect(px + 2, 194, 3, 5, 0xc8b890);
    R.rect(px, 201, 9, 7, 0x5e3f28); R.rect(px, 201, 9, 1, 0x7c5838); R.rect(px + 4, 204, 1, 1, 0xd4a44a);
  }
  R.rect(d0, 210, d1 - d0, 8, 0x6a4026);
  R.rect(d0 + 4, 211, d1 - d0 - 8, 6, 0x2e5a3e); R.rect(d0 + 5, 212, d1 - d0 - 10, 1, 0xc8a050);
  R.rect(d0 - 1, 218, d1 - d0 + 2, 2, 0x9a6a40); R.rect(d0 - 1, 220, d1 - d0 + 2, 2, 0x6a4026);
  R.rect(d0 + 2, 222, d1 - d0 - 4, 10, 0x4e321f);
  for (const x of [d0 + 4, d0 + 33]) { R.rect(x, 223, 27, 8, 0x5e3f28); R.rect(x, 223, 27, 1, 0x7c5838); R.rect(x + 12, 226, 3, 1, 0xd4a44a); }
  for (const lx of [d0 + 2, d1 - 7]) for (let y = 232; y < 246; y++) { const w = Math.round(5 - (y - 232) * 0.15); R.rect(lx + (5 - w) / 2, y, w, 1, 0x4e321f); R.px(lx + (5 - w) / 2, y, 0x7a5236); }
  R.shade(d0 + 4, 244, d1 - d0 - 8, 2, 0.6);
  // letters tied with string
  R.rect(334, 206, 12, 5, 0xe8dcc0); R.rect(334, 206, 12, 1, 0xfff4dc); R.rect(335, 208, 10, 1, 0xd8c8a8); R.rect(339, 206, 1, 5, 0x8a6a40);
  // the writing slope: a leather-topped wedge with a sheet on it (its lines are written each frame)
  R.poly([[348, 216], [376, 216], [374, 200], [350, 200]], 0x4e321f); R.line(350, 200, 374, 200, 0x7a5236);
  R.poly([[349, 214], [375, 214], [373, 202], [351, 202]], 0x2e5a3e); R.line(349, 214, 375, 214, 0x9a6a40);
  R.poly([[353, 213], [371, 213], [370, 203], [354, 203]], 0xeee2c4); R.line(354, 203, 370, 203, 0xfaf2dc); R.px(370, 212, 0xc8b898);
  // the inkwell, square glass on a brass collar, and the quill standing in it, its vane curling
  R.rect(377, 205, 9, 7, 0x2a3442); R.rect(377, 205, 9, 1, 0x6a7a8a); R.rect(378, 206, 1, 5, 0x8a9aaa); R.rect(379, 203, 5, 2, 0xc8963e); R.px(379, 203, 0xf0d080);
  R.rect(379, 207, 5, 4, 0x0e1218);
  for (let k = 0; k <= 26; k++) {
    const u = k / 26, x = Math.round(381 - u * 8 - u * u * 3), y = Math.round(203 - u * 24);
    R.px(x, y, 0xb8ac98);
    if (u > 0.22) { const wv = Math.round(Math.sin(((u - 0.22) / 0.78) * Math.PI) * 3 + 0.5); for (let j = 1; j <= wv; j++) { R.px(x - j, y + Math.round(j * 0.5), j === wv ? 0xd8d0c0 : 0xf4f0e6); R.px(x + j, y + Math.round(j * 0.3) - 1, j === wv ? 0xb0a898 : 0xe0d8c8); } }
  }
  R.rect(386, 213, 6, 2, 0xa82a2a); R.px(386, 213, 0xd04a4a);
  // the candle on the gallery
  const [cx, cy] = DESKC;
  R.rect(cx - 4, 186, 9, 2, 0xc8963e); R.rect(cx - 4, 186, 9, 1, 0xf0d080); R.rect(cx - 1, 181, 3, 5, 0xb8863a); R.rect(cx - 3, 180, 7, 2, 0xd4a44a);
  R.rect(cx - 2, cy + 1, 5, 9, 0xeee4cc); R.rect(cx - 2, cy + 1, 1, 9, 0xfff8e8); R.rect(cx + 2, cy + 1, 1, 9, 0xc8bca0); R.px(cx, cy, 0x2a1a10);
  yield;
}

function* paintBackWide(R, lay, geo) {
  for (const b of lay.bays) {
    if (b.kind === 'nook') yield* nookBay(R);
    else if (b.kind === 'desk') yield* deskBay(R);
    else if (b.kind === 'shelf') {
      if (b.side < 0) yield* shelves(R, b.x0 + 2, b.first ? 4 : b.x1 - 2, 12, FLOOR, 29, geo, { 2: [[18, 'plant']], 4: [[6, 'shell']] });
      else yield* shelves(R, b.x0 + 2, b.x1 - 2, 12, FLOOR, 41, geo, { 1: [[30, 'candle']], 3: [[10, 'bust']] });
    } else if (b.kind === 'lamp') standingLamp(R, b.x0 + 12);
    else if (b.kind === 'fern') fernStand(R, b.x0 + 18);
    else if (b.kind === 'globe') { floorGlobe(R, { x: b.x0 + 18, y: 198, r: 13 }); mapFrame(R, b.x0 + 4, 76, 28, 34, 67, 0x3a2416, geo); }
    yield;
  }
  // the plain wall left at either edge: a small framed map, where there is room for a whole one
  for (const [a, z, seed] of [[lay.vL, lay.lEnd, 61], [lay.rEnd, lay.vR, 9]]) {
    const w = z - a;
    if (w < 30) continue;
    const mw = Math.min(40, w - 12), mh = Math.round(mw * 0.8);
    mapFrame(R, Math.round((a + z - mw) / 2), 100 - (mh >> 1), mw, mh, seed, 0x3a2416, geo);
  }
}

function* paintBack(R, lay, geo) {
  const { L, RT } = lay;
  // the ceiling's edge and a deep cornice
  R.rect(L, 0, RT - L, 4, 0x2e2018); R.rect(L, 4, RT - L, 1, 0x8a6a4a); R.rect(L, 5, RT - L, 2, 0x6a4c34);
  for (let x = L; x < RT; x++) R.rect(x, 7, 1, 2, ((x % 4) + 4) % 4 < 2 ? 0x7a5a3e : 0x4a3222);
  R.rect(L, 9, RT - L, 2, 0x5a3e2a); R.rect(L, 11, RT - L, 1, 0x3a281c);
  wallpaper(R, L, RT, 12, 110);
  yield;
  wallpaper(R, L, RT, 110, 206);
  yield;
  wainscot(R, L, RT);
  // the floorboards, running away from you, and a large old rug
  const BOARD = [0x6a4630, 0x5e3e2a, 0x704a32, 0x644230];
  for (let y = FLOOR; y < H; y++) {
    const d = y - 108, z = 1000 / d, zp = 1000 / (d - 1);
    for (let x = L; x < RT; x++) {
      const X = ((x + 0.5 - 160) / d) * 100, b = Math.floor(X / 16), f = X / 16 - b, bpx = (16 * d) / 100;
      const off = (((b * 37) % 11) + 11) % 11 * 0.4;
      let c = BOARD[((b % 4) + 4) % 4];
      if (f * bpx < 1) c = 0x3a2618;
      else if (Math.floor((z + off) / 3.4) !== Math.floor((zp + off) / 3.4)) c = 0x452c1c;
      else if (((f * 4 + b * 0.37) % 1) < 0.08) c = mixc(c, 0x3a2618, 0.3);
      R.px(x, y, c);
    }
  }
  yield;
  for (let y = 258; y < H; y++) {
    const d = y - 108, z = 1000 / d;
    for (let x = L; x < RT; x++) {
      const X = ((x + 0.5 - 160) / d) * 100;
      if (Math.abs(X) > 160 || z > 6.55) continue;
      const bx = 160 - Math.abs(X), bz = (6.55 - z) / 0.03, e = Math.min(bx, bz);
      let c = 0x6a2226;
      if (e < 16) {
        c = e < 2 ? 0xc8a860 : e < 4 ? 0x22304e : e < 13 ? 0x2a3656 : e < 15 ? 0xc8a860 : 0x6a2226;
        if (e >= 5 && e < 12) { const u = bx < bz ? z * 8 : X / 5; if ((Math.floor(u) & 1) && Math.abs(e - 8.5) < 2.2) c = 0xa83a32; else if (Math.abs(e - 8.5) < 0.9) c = 0xd8c8a0; }
      } else {
        const u = X / 22, v = (z - 4.4) / 0.36, fu = u - Math.round(u), fv = v - Math.round(v), dm = Math.abs(fu) + Math.abs(fv);
        if (dm < 0.13) c = 0xd8c8a0; else if (dm > 0.32 && dm < 0.42) c = 0xc89a50; else if (((Math.round(u) + Math.round(v)) & 1) && dm < 0.27) c = 0x22304e;
        if ((x * 7 + y * 5) % 23 === 0) c = mixc(c, 0x000000, 0.15);
      }
      R.px(x, y, c);
    }
    if (z <= 6.55 && z > 6.45) for (let x = L; x < RT; x += 2) { const X = ((x + 0.5 - 160) / d) * 100; if (Math.abs(X) < 160) R.px(x, y - 1, 0xd8ccb0); }
  }
  yield;
  // the window, its drapes, the shelves to its left, the fireplace to its right
  yield* archWindow(R, WIN, true);
  yield* shelves(R, 4, 92, 12, FLOOR, 13, geo, { 1: [[18, 'bust']], 3: [[50, 'candle']], 4: [[10, 'jar']] });
  drapes(R);
  yield;
  yield* fireplace(R);
  mantel(R);
  hearthRug(R);
  R.shade(250, 262, 72, 2, 0.75);
  yield;
  if (lay.ox > 0) yield* paintBackWide(R, lay, geo);
}

// your chair, nearest of all: the wing of its back rising at the left edge, and its arm, oxblood
// leather rolled and studded with brass, lit along the crest by the lamp and the fire; a mustard
// throw, cable-knitted, folded over the arm and hanging in a few folds
const LE = 0x6e2420, LEL = 0x8e3a2e, LEH = 0xb05a46, LER = 0xd07a5a, LED = 0x4a1612, LEDD = 0x2e0e0c;
const crest = (x) => (x <= 38 ? 250 + (38 - x) * 0.5 + ((38 - x) / 60) ** 2 * 10 : 250 + ((x - 38) / 26) ** 2 * 28);
// the wing's inner edge: a little in from the left of what is always on screen, rounded at the top
const wingX = (lay, y) => Math.round(lay.vL + (y < 160 ? Math.sqrt(Math.max(0, 1 - ((160 - y) / 12) ** 2)) * 9 : 9) + ((y - 148) / (H - 148)) ** 2 * 6);
// a dark silhouette (its own colours, not lit by the bake): the lamp and the fire catch only its
// edge, drawn each frame
function paintWing(R, lay) {
  // its front edge is a roll, like the arm's, nailed with brass; inside it the dark inner face
  R.mark = 254;
  for (let y = 148; y < H; y++) {
    const xe = wingX(lay, y);
    for (let x = lay.L; x <= xe; x++) {
      const d = xe - x;
      let c = d === 0 ? 0x120504 : d === 1 ? 0x6a2a1e : d < 4 ? 0x4e1c14 : d < 6 ? 0x3a1410 : d === 6 ? 0x1a0807 : 0x260d0a;
      if (d > 7 && ((y * 2 + d * 5) % 29) === 0) c = 0x32120e;
      R.px(x, y, c);
    }
    if (y % 3 === 0 && xe - 7 >= lay.L) { R.px(xe - 7, y, 0x8a6a3a); if (y % 6 === 0) R.px(xe - 7, y - 1, 0xb8904a); }
  }
  R.mark = 0;
}
// the pixels along the wing's edge that catch the light, above the arm
function wingRim(lay) {
  const out = [];
  for (let y = 149; y < H; y++) { const xe = wingX(lay, y); if (y < crest(xe) - 1) { out.push([xe - 1, y, 1]); out.push([xe - 2, y, 0]); } }
  return out;
}
function paintArm(R, lay) {
  const L = lay.L, roll = (x) => 20 + Math.max(0, 38 - x) * 0.22;
  if (lay.vL >= -50) paintWing(R, lay);
  for (let x = Math.max(L, -140); x < 64; x++) {
    const top = Math.round(crest(x)), rh = roll(x);
    if (top >= H) continue;
    for (let y = top; y < H; y++) {
      const dy = y - top;
      let c;
      if (dy < rh) { const u = dy / rh; c = u < 0.1 ? (x > 4 && dy === 0 ? LER : LEH) : u < 0.32 ? LEL : u < 0.72 ? LE : LED; if (u > 0.18 && u < 0.32 && ((x * 5 + dy) % 13) < 2) c = LEH; if (u > 0.4 && u < 0.6 && ((x * 7 + dy * 3) % 19) === 0) c = LED; }
      else if (dy < rh + 2) c = LEDD;
      else { const p = Math.sin(x * 0.5 + dy * 0.05); c = p > 0.75 ? LEL : p < -0.8 ? LED : LE; if (x > 44) c = mixc(c, LEDD, 0.35); }
      R.px(x, y, c);
    }
    const ny = Math.round(top + rh + 1);
    if (x % 3 === 0 && ny < H) { R.px(x, ny, 0xb8863a); R.px(x, ny - 1, 0xfff0c0); }
  }
  // the scroll at the arm's end: a spiral pleat, its edge catching the lamp
  for (let a = 0.6; a < Math.PI * 2.6; a += 0.08) { const rr = 9 - a * 0.9, x = Math.round(52 + Math.cos(a) * rr), y = Math.round(270 + Math.sin(a) * rr * 1.1); if (rr > 2) R.px(x, y, LED); }
  R.px(51, 269, LER); R.px(46, 263, LEL);
  for (let a = -1.9; a < -0.2; a += 0.1) R.px(Math.round(52 + Math.cos(a) * 10), Math.round(270 + Math.sin(a) * 11), LER);
  // the throw, folded over the crest: cables four pixels wide with a dark purl channel between,
  // a twist every fourth row, a few folds in the drape, a fringe at its hem
  const WL = [0x5a3c0e, 0x8a6418, 0xb8862a, 0xdcaa44, 0xf4d070];
  const x0 = 17, x1 = 42;
  for (let x = x0; x < x1; x++) {
    const c5 = (x - x0) % 5, cable = Math.floor((x - x0) / 5), top = Math.round(crest(x)) - 2;
    const fold = Math.sin((x - x0) * 0.55 + 0.4), hem = top + 25 + Math.round(fold * 2.2) + Math.max(0, x - 34);
    for (let y = top; y < Math.min(H, hem); y++) {
      const ph = (y - top + cable * 2) % 4;
      let k = c5 === 0 ? 0 : ph === 3 ? (c5 === 1 || c5 === 4 ? 1 : 2) : c5 === 2 || c5 === 3 ? 3 : 2;
      if (y - top < 2) k = Math.min(4, k + 1);
      if (fold < -0.55) k = Math.max(0, k - 1); else if (fold > 0.7 && k > 0) k = Math.min(4, k + 1);
      if (x === x0 || x === x1 - 1) k = Math.min(k, 1);
      R.px(x, y, WL[k]);
    }
    if (x % 2 === 0) for (let y = hem; y < Math.min(H, hem + 4); y++) R.px(x, y, y === hem + 3 ? WL[1] : WL[3]);
  }
}

function* paintFront(R, lay) {
  // ——— the reading table: a walnut top with a green leather inset, a moulded edge, an apron and turned legs ———
  for (let y = TB; y < TF; y++) {
    const a = tL(y), b = tR(y), m = Math.round(8 + (y - TB) * 0.09);
    for (let x = a; x < b; x++) {
      const v = Math.sin(x * 0.06 + (y - TB) * 0.12) * 0.8 + Math.sin(x * 0.017) * 0.6 + (y - TB) * 0.05, f = v - Math.floor(v);
      R.px(x, y, f < 0.1 ? 0x5a3420 : f > 0.55 && f < 0.6 ? 0x8a5a36 : 0x6e4228);
    }
    R.px(a, y, 0x9a6a40); R.px(b - 1, y, 0x4a2a18);
    if (y > TB + 4 && y < TF - 5) {
      const la = a + m, lb = b - m;
      for (let x = la; x < lb; x++) {
        let c = (x * 3 + y * 5) % 13 === 0 ? 0x2a5236 : (x + y * 3) % 17 === 0 ? 0x346448 : 0x2e5a3e;
        if (y === TB + 7 || y === TF - 8 || x === la + 2 || x === lb - 3) c = 0xb8903e;
        if (x === la || y === TB + 5) c = 0x1e3a28;
        if (x === lb - 1 || y === TF - 6) c = 0x3e6a4e;
        R.px(x, y, c);
      }
    }
  }
  R.rect(tL(TB), TB, tR(TB) - tL(TB), 1, 0x8a5a36);
  const a = tL(TF) - 1, b = tR(TF) + 1;
  R.rect(a, TF, b - a, 1, 0xb08050); R.rect(a, TF + 1, b - a, 2, 0x8a5a36); R.rect(a, TF + 3, b - a, 1, 0x5a3420); R.rect(a, TF + 4, b - a, 2, 0x6e4228); R.rect(a, TF + 6, b - a, 1, 0x3a2012);
  R.rect(a + 4, TF + 7, b - a - 8, 11, 0x4e2e1a); R.rect(a + 4, TF + 7, b - a - 8, 1, 0x2a160c);
  R.rect(134, TF + 9, 52, 8, 0x5a3820); R.rect(134, TF + 9, 52, 1, 0x7a5030); R.rect(134, TF + 16, 52, 1, 0x3a2012);
  R.rect(157, TF + 12, 6, 2, 0xd4a44a); R.px(157, TF + 12, 0xf0d080);
  for (const lx of [a + 3, b - 13]) for (let y = TF + 7; y < H; y++) {
    const k = y - TF - 7, w = k < 3 ? 10 : k < 10 ? 8 : k < 14 ? 10 : k < 20 ? 7 : k < 26 ? 9 : 7, x = lx + Math.round((10 - w) / 2);
    R.rect(x, y, w, 1, 0x5a3820); R.px(x, y, 0x8a5a36); R.px(x + w - 1, y, 0x2e1a0e);
    if (k === 3 || k === 13 || k === 20) R.rect(x, y, w, 1, 0x3a2012);
  }
  R.shade(a + 13, TF + 18, b - a - 26, H - TF - 18, 0.55);
  yield;
  // ——— on the table ———
  R.shade(84, 240, 34, 4, 0.7); R.shade(100, 270, 28, 2, 0.72); R.shade(224, 262, 28, 3, 0.7); R.shade(203, 273, 22, 2, 0.75);
  // the banker's lamp: a brass base and stem, a green glass shade, a pull chain
  R.ell(101, 240, 11, 3, 0x9a7030); R.ell(101, 239, 10, 2, 0xc8963e); R.ell(99, 238, 6, 1, 0xf0d080);
  R.rect(100, 216, 2, 22, 0xb8863a); R.rect(100, 216, 1, 22, 0xf0d080); R.rect(99, 228, 4, 2, 0xd4a44a);
  R.rect(97, 213, 8, 3, 0xa8803a); R.px(97, 213, 0xf0d080);
  R.mark = 253;
  const SH = [0x1e4a32, 0x2a6a44, 0x3a8a58, 0x7ac08a, 0x4a9a64, 0x3a8a58, 0x2e7a4c, 0x2e7a4c, 0x245e3c, 0x1e4e32];
  SH.forEach((c, k) => { const y = 203 + k, inset = k === 0 ? 3 : k === 1 ? 1 : 0; R.rect(83 + inset, y, 36 - inset * 2, 1, c); });
  for (let x = 86; x < 116; x += 7) R.px(x, 206, 0xa8e0b0);
  R.mark = 0;
  R.rect(82, 204, 1, 9, 0xb8863a); R.rect(119, 204, 1, 9, 0x8a6a2a); R.px(82, 204, 0xf0d080);
  R.rect(83, 213, 36, 1, 0xc8963e);
  for (let y = 214; y < 224; y++) R.px(112, y, y % 2 ? 0xd4a44a : 0x8a6a2a); R.ell(112, 225, 1, 1, 0xd4a44a);
  // the stack of leather books, the hourglass sits on it (drawn each frame)
  bookStack(R);
  // the open book, its ribbon
  openBook(R);
  // the spectacles, folded: gold rims, pale lenses catching the lamp, the arms tucked behind
  { const gx = 205, gy = 270;
    R.line(gx + 1, gy - 2, gx + 8, gy - 4, 0x8a6a2a); R.line(gx + 17, gy - 2, gx + 10, gy - 4, 0x8a6a2a);
    for (const lx of [gx + 4, gx + 14]) {
      R.ell(lx, gy, 4, 2.5, 0xd4a44a); R.ell(lx, gy, 3, 1.5, 0xb8d4cc); R.rect(lx - 3, gy + 1, 7, 1, 0x9ab8b0);
      R.px(lx - 2, gy - 1, 0xffffff); R.px(lx - 1, gy - 1, 0xe8f6f2); R.rect(lx - 3, gy + 3, 7, 1, 0x8a6a2a);
    }
    R.rect(gx + 8, gy - 1, 3, 1, 0xd4a44a); R.px(gx + 9, gy - 2, 0xf0d080); }
  // the saucer the cup sits on (the cup itself lifts, so it is a sprite), and a silver spoon
  R.ell(CUP.x, CUP.y, 13, 3.5, 0xd8d2c4); R.ell(CUP.x, CUP.y - 0.5, 12, 2.5, 0xf2ecde); R.ell(CUP.x, CUP.y - 0.5, 7, 1.5, 0xe2dccc);
  for (let x = CUP.x - 12; x <= CUP.x + 12; x += 2) R.px(x, CUP.y + 2 - (Math.abs(x - CUP.x) > 9 ? 1 : 0), 0xc8a050);
  R.line(CUP.x + 9, CUP.y, CUP.x + 17, CUP.y - 3, 0xb8bcc8); R.line(CUP.x + 10, CUP.y + 1, CUP.x + 17, CUP.y - 2, 0x7a7e8a);
  R.rect(CUP.x + 6, CUP.y, 3, 2, 0xc8ccd6); R.px(CUP.x + 6, CUP.y, 0xffffff);
  // the teapot: a round cream body with a band of blue sprigs, a lid with its knob, a spout toward
  // your cup and a looped handle, edged dark against the hearth
  { const tx = 238, ty = 255;
    for (let y = -7; y <= 7; y++) for (let x = -10; x <= 10; x++) {
      const d = (x / 10.4) ** 2 + (y / 7.4) ** 2;
      if (d > 1) continue;
      const l = -x * 0.55 - y * 0.75;
      let c = l > 4 ? 0xfaf6ec : l > -2 ? 0xeee6d6 : l > -6 ? 0xd8cfbe : 0xbcb2a0;
      if (d > 0.82 && x + y > 2) c = 0x7a6e5e;
      R.px(tx + x, ty + y, c);
    }
    R.rect(tx - 9, ty - 3, 19, 1, 0xc8a050); R.rect(tx - 9, ty + 2, 19, 1, 0xc8a050);
    for (let x = -8; x <= 8; x++) R.px(tx + x, ty - 1 + ((x + 9) % 3 === 0 ? 0 : 1), (x & 1) ? 0x3a5a98 : 0x5a7ab8);
    // the lid: a rim, a dome, a knob
    R.ell(tx, ty - 7, 6, 1, 0xd8d0c0); R.rect(tx - 6, ty - 6, 13, 1, 0x9a907e);
    R.ell(tx, ty - 9, 4, 1.5, 0xeee6d6); R.px(tx - 2, ty - 10, 0xfaf6ec); R.rect(tx - 1, ty - 12, 3, 2, 0xd4a44a); R.px(tx - 1, ty - 12, 0xf0d080);
    // the spout, two pixels thick, rising toward the cup
    for (let k = 0; k <= 9; k++) { const x = tx - 10 - k, y = ty + 2 - Math.round(k * 0.85 + (k > 6 ? (k - 6) * 0.5 : 0)); R.px(x, y, 0xeee6d6); R.px(x, y + 1, 0xc8bfae); }
    R.px(tx - 20, ty - 7, 0xfaf6ec); R.px(tx - 21, ty - 8, 0xd8cfbe);
    // the handle, a loop with the table showing through it
    for (const [dx, dy, c] of [[10, -4, 0xe2dccc], [11, -4, 0xd8cfbe], [12, -3, 0xd8cfbe], [13, -2, 0xc8bfae], [13, -1, 0xc8bfae], [13, 0, 0xbcb2a0], [13, 1, 0xbcb2a0], [12, 2, 0xbcb2a0], [11, 3, 0xbcb2a0], [14, -1, 0x6a5e50], [14, 0, 0x6a5e50], [14, 1, 0x6a5e50], [13, 2, 0x6a5e50], [12, 3, 0x6a5e50]]) R.px(tx + dx, ty + dy, c);
    R.rect(tx - 7, ty + 7, 15, 1, 0x9a907e); }
  yield;
  // your chair, nearest of all
  paintArm(R, lay);
  yield;
}

/* ——— building a room for one width: in steps, so it can be spread over a few frames ——— */
const ROOMS = new Map();
function sprite(x0, y0, w, h, paint, back = false) { return { x0, y0, w, h, paint, back, ras: null, img: [] }; }
function spriteImg(RM, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = finish(bakeGen(sp.ras, sp.x0 + RM.ox, sp.y0, RM.F, k, sp.back));
  }
  return sp.img[k];
}
const roomW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);

function* buildRoom(rw, off) {
  const lay = layoutFor(rw), { ox, L, RT } = lay;
  const geo = { books: [], flames: [], lights: [], libs: [], maps: [] };
  const back = new Ras(rw, H, ox, 0), front = new Ras(rw, H, ox, 0);
  yield* paintBack(back, lay, geo);
  yield* paintFront(front, lay);
  // every warm light in the room, each with an id so it can be put out
  const lights = [
    { id: 'c0', kind: 'pt', x: CANDLES[0][0], y: CANDLES[0][1] + 4, r: 40, k: 0.35, sy: 1.1 },
    { id: 'c1', kind: 'pt', x: CANDLES[1][0], y: CANDLES[1][1] + 4, r: 40, k: 0.35, sy: 1.1 },
    { id: 'pic', kind: 'rect', x0: 248, x1: 304, y0: 58, y1: 110, k: 0.27, top: 0.12 },
    ...geo.lights,
  ];
  if (lay.nook) lights.push({ id: 'nook', kind: 'pt', x: NLAMP[0], y: NLAMP[1] + 2, r: 50, k: 0.32, sy: 1.6 });
  if (lay.lamp) lights.push({ id: 'stand', kind: 'pt', x: lay.lamp.x0 + 12, y: 146, r: 64, k: 0.36, sy: 0.85, p: 2.6 });
  if (lay.desk) lights.push({ id: 'desk', kind: 'pt', x: DESKC[0], y: DESKC[1] + 4, r: 72, k: 0.5, sy: 1.05 });
  const n = rw * H, F = { rw, C: new Float32Array(n), W: new Float32Array(n), L: new Float32Array(n), LB: new Float32Array(n), FI: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) {
      const cx = X - ox, j = y * rw + X;
      F.C[j] = coolAt(cx, y, rw, lay.wins); F.L[j] = lampAt(cx, y); F.LB[j] = lampBack(cx, y); F.FI[j] = fireAt(cx, y);
    }
    if (y % 24 === 23) yield;
  }
  fillWarm(F, ox, lights, off, { x0: 0, x1: rw, y0: 0, y1: H });
  yield;
  const fx2 = lay.fern ? lay.fern.x0 + 18 : 0;
  const RM = {
    bw: rw, ox, L, RT, lay, F, geo, lights, off: new Set(off || []), jobs: [],
    back: { x0: L, y0: 0, w: rw, h: H, ras: back, img: [], back: true }, front: { x0: L, y0: 0, w: rw, h: H, ras: front, img: [], back: false },
    cat: [0, 1, 2, 3, 4, 5, 6, 7].map((f) => sprite(256, 228, 56, 32, (S) => paintCat(S, f))),
    cup: [0, 1, 2, 3].map((lv) => sprite(104, 250, 24, 18, (S) => paintCup(S, lv))),
    fern: [-1, 0, 1].map((sw) => sprite(104, 168, 50, 50, (S) => { S.rect(124, 192, 9, 7, 0xb86a44); S.rect(123, 191, 11, 2, 0xc87a50); S.rect(131, 193, 1, 6, 0x8a4a2e); paintFern(S, 128, 190, 11, 20, sw, 7); }, true)),
    fern2: lay.fern ? [-1, 0, 1].map((sw) => sprite(fx2 - 24, 154, 48, 44, (S) => paintFern(S, fx2, 184, 15, 21, sw, 13), true)) : null,
  };
  RM.sprites = [...RM.cat, ...RM.cup, ...RM.fern, ...(RM.fern2 || [])];
  RM.wing = lay.vL >= -50 ? wingRim(lay) : null;
  for (const k of [0, 1, 2, 3]) for (const sp of [RM.back, RM.front]) { sp.img[k] = yield* bakeGen(sp.ras, 0, 0, F, k, sp.back); yield; }
  const small = [RM.cat[0], RM.cat[1], RM.cat[2], RM.cup[3], RM.fern[1], ...(RM.fern2 ? [RM.fern2[1]] : [])];
  for (const k of [0, 1, 2, 3]) { for (const sp of small) spriteImg(RM, sp, k); yield; }
  ROOMS.set(rw, RM);
  while (ROOMS.size > 2) ROOMS.delete(ROOMS.keys().next().value);
  return RM;
}
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value || true; if (performance.now() > end) return null; }
}
const roomFor = (rw) => ROOMS.get(rw) || finish(buildRoom(rw));
// a light put out or lit again: the warm light inside its box is summed afresh from the lights
// still lit, and just that patch of each bake (and any sprite in it) is baked again
function* relightGen(RM, id, off) {
  const lt = RM.lights.find((l) => l.id === id);
  RM.off = new Set(off);
  if (!lt) return;
  const b = lightBox(lt), ox = RM.ox;
  const box = { x0: clamp(b.x0 + ox, 0, RM.bw), x1: clamp(b.x1 + ox, 0, RM.bw), y0: clamp(b.y0, 0, H), y1: clamp(b.y1, 0, H) };
  if (box.x1 <= box.x0 || box.y1 <= box.y0) return;
  fillWarm(RM.F, ox, RM.lights, off, box);
  for (const sp of RM.sprites) if (sp.x0 + ox < box.x1 && sp.x0 + ox + sp.w > box.x0 && sp.y0 < box.y1 && sp.y0 + sp.h > box.y0) sp.img = [];
  const rect = { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
  for (const k of [0, 1, 2, 3]) for (const sp of [RM.back, RM.front]) { yield; yield* bakeGen(sp.ras, 0, 0, RM.F, k, sp.back, rect, sp.img[k]); }
}
// bring a room's lights into line with which are lit now (a room built or cached earlier)
function syncLights(RM, off) {
  for (const lt of RM.lights) if (RM.off.has(lt.id) !== off.has(lt.id)) RM.jobs.push(relightGen(RM, lt.id, off));
}

/* ——— glows and colour ladders for the moving parts ——— */
// the big window's light thrown down onto the table: its arch and bars, foreshortened, with the
// arch falling toward you. projOf takes a point on the glass to where its light lands
const PJ = { x0: 70, y0: 232, w: 180, h: 58 };
const projOf = (u, v) => { const t = (WIN.bot - v) * 0.3; return [160 + (u - 160) * (1 + t * 0.012) - t * 0.35, 236 + t]; };
function projMask() {
  const R = new Ras(PJ.w, PJ.h);
  for (let yy = 0; yy < PJ.h; yy++) for (let xx = 0; xx < PJ.w; xx++) {
    const x = PJ.x0 + xx + 0.5, y = PJ.y0 + yy + 0.5, t = y - 236;
    if (t < 0) continue;
    const v = WIN.bot - t / 0.3, u = 160 + (x + t * 0.35 - 160) / (1 + t * 0.012);
    if (!inWin(WIN, Math.floor(u), Math.floor(v))) continue;
    // the bars, kept at least a pixel wide where the light is squeezed
    if (Math.abs(u - WIN.cx) < 1.4 || WIN.rows.some((r) => Math.abs(v - r - 1) < 2.8)) continue;
    if (v < WIN.cy) {
      const dx = u - WIN.cx, dy = WIN.cy - v, rr = sq(dx, dy), a = Math.atan2(dy, dx);
      if (Math.abs(rr - 9) < 2.6 || (rr > 9 && [0.82, 0.6, 0.4, 0.18].some((k) => Math.abs(a - Math.PI * k) * rr < 1.6))) continue;
    }
    // only on the table's top and its front edge: the table shades the floor below
    const X = Math.floor(x), Y = Math.floor(y);
    if (Y < TB + 2 || Y > TF + 5 || X < tL(Y) + 1 || X > tR(Y) - 2) continue;
    R.px(xx, yy, 0x7a98d4);
  }
  return R.canvas();
}
let FX = null;
function fx() {
  if (FX) return FX;
  FX = {
    lip: glow(20, 6, 0xffe0a0, 0.9, 4), halo: glow(34, 18, 0xffc070, 0.32, 4), green: glow(24, 8, 0x60c080, 0.3, 3),
    fire: glow(64, 40, 0xff8a3a, 0.5, 5), fireIn: glow(22, 20, 0xffa040, 0.6, 4), hearth: glow(46, 10, 0xff9a40, 0.5, 4),
    // the small ones in a few flat steps, no dither
    pic: steps(16, 3, 0xffd890, [[1, 0.1], [0.5, 0.16]]),
    candle: steps(9, 9, 0xffb050, [[1, 0.1], [0.62, 0.16], [0.3, 0.28]]),
    candleBig: glow(24, 20, 0xffa850, 0.26, 4),
    nook: steps(11, 10, 0xffc078, [[1, 0.1], [0.6, 0.16], [0.3, 0.26]]),
    lib: steps(16, 5, 0xffd890, [[1, 0.1], [0.5, 0.2]]),
    stand: glow(28, 24, 0xffc078, 0.3, 4),
    steam: Array.from({ length: 11 }, (_, k) => rgba(0xe8eaf4, k * 0.04)),
    mote: Array.from({ length: 8 }, (_, k) => rgba(0xffe6c0, (k + 1) * 0.07)),
    smoke: Array.from({ length: 6 }, (_, k) => rgba(0xc8c0b8, (k + 1) * 0.06)),
    dust: Array.from({ length: 6 }, (_, k) => rgba(0xe8d8b8, (k + 1) * 0.1)),
    proj: projMask(),
  };
  // the lamp's beam, faint in the air under the shade
  const cone = new Ras(112, 36);
  for (let y = 0; y < 36; y++) {
    const u = y / 36, l = 30 - u * 24, r = 66 + u * 42;
    for (let x = Math.ceil(l); x < r; x++) {
      const e = Math.min(x - l, r - x) / (r - l), a = Math.min(1, e * 4) * (1 - u * 0.4);
      const q = band(a * 3, x, y);
      if (q > 0) cone.px(x, y, 0xffd9a0, q * 0.04);
    }
  }
  FX.cone = cone.canvas();
  const pc = document.createElement('canvas'); pc.width = PJ.w; pc.height = PJ.h;
  FX.pjc = pc; FX.pjg = pc.getContext('2d');
  return FX;
}

/* ——— state ——— */
function newRiv(r, panes, d, on) {
  const p = panes[Math.floor(r() * panes.length)];
  d.p = p; d.x = p[0] + 1 + Math.floor(r() * Math.max(1, p[2] - 4)); d.y = p[1] + r() * p[3] * 0.5; d.v = 0; d.hold = r() * 2.5; d.len = 0; d.kinks = []; d.big = r() < 0.4; d.on = on; d.dep = d.y;
  return d;
}
// the flame tongues and the embers, in the fire canvas's pixels
const FWD = 36, FHT = 48, FX0 = 258, FY0 = 186;
const TONGUES = [[7, 2.6, 13], [11, 3.2, 19], [15, 3.6, 24], [18.5, 3.8, 27], [22, 3.6, 23], [26, 3.2, 18], [29.5, 2.6, 12]].map(([x, w, h], i) => ({ x, w, h, base: 37 + (i % 3 === 1 ? 1 : 0) + (i === 3 ? -1 : 0), f: 3.1 + ((i * 1.37) % 1.9), sf: 1.1 + (i % 3) * 0.55, p: i * 1.7, top: 0 }));
const EMBERS = (() => { const r = rng(91), out = []; for (let i = 0; i < 46; i++) { const x = 4 + Math.floor(r() * 29), y = 39 + Math.floor(r() * 8); out.push({ x, y, sp: 0.6 + r() * 2.2, p: r() * 6.3, k: 0.55 + r() * 0.45 }); } for (const [x, y] of [[12, 37], [21, 39], [16, 30], [25, 29], [8, 40]]) out.push({ x, y, sp: 1 + r(), p: r() * 6, k: 0.8 }); return out; })();
const FPAL = [0, 0xff0a1a6a, 0xff123ac0, 0xff227af0, 0xff48bcff, 0xffb0f0ff];   // ABGR: deep red, orange-red, orange, yellow, white-hot

const LANDS = (() => { const W = 48, Hh = 16, r = rng(19), m = new Uint8Array(W * Hh); for (let i = 0; i < 10; i++) { const cx = r() * W, cy = 2 + r() * 12, rx = 3 + r() * 6, ry = 2 + r() * 3; for (let y = 0; y < Hh; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) m[y * W + (((x % W) + W) % W)] = 1; } return { W, H: Hh, m }; })();

function makeState(seed) {
  const r = rng(seed), O = outside();
  const s = {
    r, t: 0, dt: 0, rain: 2, rainLv: 1, lampOn: true, lamp: 1, fire: 0.5, boost: 0, surge: 0.5,
    sparks: [], smoke: [], steam: [], motes: [], ripples: [], tips: [], glints: [], puffs: [],
    cat: 0, catEv: 0, catEvK: 6, catEvT: 8 + r() * 10, bph: 0, lad: { x: 46, to: 46 }, pulls: [],
    page: 0, flip: 0, autoFlip: 40 + r() * 30, lift: 0, liftT: 6 + r() * 6,
    tea: 3, sip: 0, sand: 0.78, hop: 0, rot: 0.2, gv: 0, rot2: 0.6, gv2: 0, off: new Set(), tassel: [0, 0],
    write: { lines: 2, t: 0 }, fernKick: 0, fern2Kick: 0,
    bolt: null, boltWait: 9 + r() * 14, chimeUntil: 0,
    glass: [WIN, NOOK, DWIN].map((W, i) => { const panes = panesOf(W); return { W, panes, riv: Array.from({ length: i ? 6 : 18 }, () => newRiv(r, panes, {}, true)), beads: [] }; }),
    streaks: Array.from({ length: 140 }, (_, i) => ({ x: r() * PW, y: r() * PH, v: i < 70 ? 300 + r() * 110 : 190 + r() * 50, l: i < 70 ? 7 + Math.floor(r() * 6) : 3 + Math.floor(r() * 3), on: true })),
    buckets: [[], []],
    wins: O.geo.wins.map((w) => ({ ...w, on: true, timer: 6 + r() * 40 })),
    clock: { min: -1 },
  };
  for (let i = 0; i < 24; i++) s.motes.push({ x: 84 + r() * 70, y: 214 + r() * 44, vx: (r() - 0.5) * 2.4, vy: -0.6 - r() * 1.6, p: r() * 6.3 });
  return s;
}

/* ——— each frame ——— */
function boltEnv(t) {
  const p = (t0, k) => (t < t0 ? 0 : Math.min(1, (t - t0) / 0.03) * Math.exp(-(t - t0) * k));
  return Math.min(1, p(0, 9) + p(0.22, 6) * 0.8 + p(0.5, 4) * 0.35);
}
function update(s, dt) {
  s.t += dt; s.dt = dt;
  const t = s.t, r = Math.random;
  const settle = (v, to, k) => { const n = v + (to - v) * Math.min(1, dt * k); return Math.abs(n - to) < 0.004 ? to : n; };
  s.lamp = settle(s.lamp, s.lampOn ? 1 : 0, 5);
  s.rainLv = settle(s.rainLv, RLV[s.rain], 0.7);
  // the fire: a calm flicker over slow lulls and surges, brighter for a while after a poke
  s.boost = Math.max(0, s.boost - dt * 0.3);
  s.surge = 0.5 + 0.5 * Math.sin(t * 0.37 + 1.3) * Math.sin(t * 0.23 + 0.4);
  s.fire = clamp(0.34 + 0.26 * s.surge + 0.17 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1) + 0.1 * Math.sin(t * 9.7 + 2) + 0.06 * Math.sin(t * 15.1) + s.boost * 0.7, 0, 1);
  if (r() < dt * (0.25 + s.surge * 0.3 + s.boost * 6)) s.sparks.push({ x: FX0 + 8 + r() * 20, y: 220, vx: (r() - 0.5) * 8, vy: -18 - r() * 26, l: 1 });
  for (const p of s.sparks) { p.x += (p.vx + Math.sin(t * 7 + p.y) * 4) * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.4; p.l -= dt * 0.7; }
  s.sparks = s.sparks.filter((p) => p.l > 0 && p.y > 182);
  for (const p of s.tips) { p.a += dt; p.y -= p.v * dt; p.x += Math.sin(p.a * 9 + p.ph) * dt * 4; }
  s.tips = s.tips.filter((p) => p.a < p.life);
  // rain: streaks outside, rivulets running down the glass, rings in the puddles. As the rain
  // lightens, what is falling finishes its fall and fewer start
  const rl = s.rainLv, m = Math.min(1, rl * 1.3);
  for (const st of s.streaks) { st.y += st.v * dt; st.x -= st.v * dt * 0.07; if (st.y - st.l > PH) { st.y = -r() * 20; st.x = r() * (PW + 20); st.on = r() < rl; } if (st.x < -4) st.x += PW + 8; }
  for (const G of s.glass) {
    for (const d of G.riv) {
      if (!d.on) { d.hold -= dt; if (d.hold <= 0) { if (r() < m) newRiv(r, G.panes, d, true); else d.hold = 0.6 + r(); } continue; }
      if (d.hold > 0) { d.hold -= dt; d.len = Math.max(0, d.len - dt * 2.5); continue; }
      d.v = Math.min(58, d.v + 42 * dt); d.y += d.v * dt; d.len = Math.min(22, d.len + d.v * dt * 0.7);
      if (r() < dt * 2.6) { d.kinks.push([d.x, d.y]); d.x = clamp(d.x + (r() < 0.5 ? -1 : 1), d.p[0] + 1, d.p[0] + d.p[2] - 3); }
      while (d.kinks.length && d.kinks[0][1] < d.y - d.len) d.kinks.shift();
      // a beaded track left behind it, drying in a few seconds
      if (d.y - d.dep > 6 + r() * 9) { d.dep = d.y; if (G.beads.length < (G.W === WIN ? 56 : 18)) G.beads.push({ x: d.x + (r() < 0.3 ? 1 : 0), y: Math.round(d.y - 2), a: 0, life: 2 + r() * 2.5, big: r() < 0.25 }); }
      if (r() < dt * 0.9) { d.hold = 0.3 + r() * 1.8; d.v = 0; }
      if (d.y > d.p[1] + d.p[3] - 3) { d.on = false; d.hold = r() * 1.2; d.len = 0; }
    }
    for (const b of G.beads) b.a += dt;
    if (G.beads.length && G.beads[0].a > G.beads[0].life) G.beads = G.beads.filter((b) => b.a < b.life);
  }
  if (r() < dt * 7 * rl) { const [px, py, rx] = PUDDLES[Math.floor(r() * PUDDLES.length)]; s.ripples.push({ x: px + Math.round((r() * 2 - 1) * (rx - 3)), y: py, a: 0, m: Math.max(1, rx - 3), warm: px > 136 && px < 190 }); }
  for (const p of s.ripples) p.a += dt;
  s.ripples = s.ripples.filter((p) => p.a < 0.5);
  // far-off lightning, only while it rains hard
  if (s.bolt) { s.bolt.t += dt; if (s.bolt.t > 1.6) s.bolt = null; }
  else if (rl > 0.7) {
    s.boltWait -= dt;
    if (s.boltWait <= 0) { s.bolt = { t: 0, x: 60 + r() * 150, k: 0.55 + r() * 0.45 }; s.boltWait = 24 + r() * 36; if (s.onBolt) s.onBolt(s.bolt); }
  }
  for (const w of s.wins) { w.timer -= dt; if (w.timer <= 0) { w.on = !w.on; w.timer = w.on ? 20 + r() * 50 : 6 + r() * 20; } }
  // the cat breathes; after a stretch it settles again; now and then an ear or the tail twitches
  s.bph += dt * 1.6;
  s.cat = Math.max(0, s.cat - dt);
  s.catEv = Math.max(0, s.catEv - dt);
  s.catEvT -= dt; if (s.catEvT <= 0 && s.cat <= 0) { s.catEvK = r() < 0.5 ? 6 : 7; s.catEv = s.catEvK === 6 ? 0.35 : 0.8; s.catEvT = 9 + r() * 14; }
  // the ladder rolls toward where it was sent
  const ld = s.lad, gap = ld.to - ld.x;
  ld.x += Math.sign(gap) * Math.min(Math.abs(gap), Math.max(4, Math.abs(gap) * 1.6) * dt);
  // books out of their shelves and back
  for (const p of s.pulls) p.t += dt;
  s.pulls = s.pulls.filter((p) => p.t < 3.9);
  // the book: a page's corner lifts in a draught now and then; a page turns, now and then by itself
  s.lift = Math.max(0, s.lift - dt / 2.2);
  s.liftT -= dt; if (s.liftT <= 0 && s.flip <= 0) { s.lift = 1; s.liftT = 8 + r() * 12; }
  s.autoFlip -= dt; if (s.autoFlip <= 0 && s.flip <= 0) { s.flip = 1; s.autoFlip = 45 + r() * 40; if (s.onFlip) s.onFlip(); }
  if (s.flip > 0) { const was = s.flip; s.flip = Math.max(0, s.flip - dt / 1.2); if (was > 0.5 && s.flip <= 0.5) s.page += 1; }
  // tea: a sip lifts the cup; steam while there is tea in it
  if (s.sip > 0) { const was = s.sip; s.sip = Math.max(0, s.sip - dt / 1.5); if (was > 0.5 && s.sip <= 0.5) s.tea = Math.max(0, s.tea - 1); }
  if (s.tea > 0 && r() < dt * (5 + s.tea * 2)) s.steam.push({ x: CUP.x - 4 + r() * 8, y: 252, a: 0, life: 2.4 + r() * 1.4, ph: r() * 6.3 });
  for (const p of s.steam) { p.a += dt; p.y -= dt * (7 + p.a * 1.5); }
  s.steam = s.steam.filter((p) => p.a < p.life);
  // the hourglass runs down; the globes slow after a spin
  if (s.hop > 0) s.hop = Math.max(0, s.hop - dt); else s.sand = Math.max(0, s.sand - dt / 60);
  s.rot += s.gv * dt; s.gv *= Math.exp(-dt * 0.45); if (Math.abs(s.gv) < 0.003) s.gv = 0;
  s.rot2 += s.gv2 * dt; s.gv2 *= Math.exp(-dt * 0.35); if (Math.abs(s.gv2) < 0.003) s.gv2 = 0;
  // dust in the lamplight, smoke from a snuffed wick, a puff of dust from something touched, glints
  for (const mo of s.motes) {
    mo.x += (mo.vx + Math.sin(t * 0.5 + mo.p) * 1.2) * dt; mo.y += (mo.vy + Math.sin(t * 0.37 + mo.p * 2) * 0.8) * dt;
    if (mo.y < 206 || mo.x < 80 || mo.x > 160 || mo.y > 262) { mo.x = 86 + r() * 66; mo.y = 236 + r() * 24; }
  }
  for (const p of s.smoke) { p.a += dt; p.y -= dt * 9; }
  s.smoke = s.smoke.filter((p) => p.a < 2.4);
  for (const p of s.puffs) { p.a += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.8; }
  s.puffs = s.puffs.filter((p) => p.a < p.life);
  for (const p of s.glints) p.a += dt;
  s.glints = s.glints.filter((p) => p.a < 0.9);
  s.tassel = s.tassel.map((v) => Math.max(0, v - dt * 0.5));
  if (s.write.t > 0) { s.write.t = Math.max(0, s.write.t - dt); if (s.write.t === 0) s.write.lines = Math.min(4, s.write.lines + 1); }
  s.fernKick = Math.max(0, s.fernKick - dt); s.fern2Kick = Math.max(0, s.fern2Kick - dt);
}

function drawOutside(p, O, s) {
  const t = s.t, rl = s.rainLv, clr = clamp(1 - rl * 2.4, 0, 1);
  p.globalCompositeOperation = 'source-over'; p.globalAlpha = 1;
  p.drawImage(O.sky, 0, 0);
  if (clr > 0.01) {   // the moon, once the cloud thins
    p.globalAlpha = clr; p.drawImage(O.moon, MOON.x - 6, MOON.y - 6);
    p.globalCompositeOperation = 'lighter'; p.globalAlpha = clr * 0.55; p.drawImage(O.gMoon, MOON.x - 30, MOON.y - 30); p.globalCompositeOperation = 'source-over';
  }
  const ca = 0.45 + 0.55 * Math.min(1, rl * 1.6), e = s.bolt ? boltEnv(s.bolt.t) * s.bolt.k : 0;
  O.clouds.forEach((img, i) => {
    const v = [1.1, 2.3][i], y = [0, 14][i], x = -Math.floor((t * v) % PW);
    p.globalAlpha = ca * [0.85, 1][i]; p.drawImage(img, x, y); p.drawImage(img, x + PW, y);
    if (e > 0.02) { p.globalAlpha = e * 0.85; p.drawImage(O.cloudsLit[i], x, y); p.drawImage(O.cloudsLit[i], x + PW, y); }
  });
  if (e > 0.02) { p.globalCompositeOperation = 'lighter'; p.globalAlpha = e * 0.7; p.drawImage(O.gBolt, s.bolt.x - 90, -18); p.globalCompositeOperation = 'source-over'; }
  p.globalAlpha = 1;
  p.drawImage(O.town, 0, 0);
  p.fillStyle = '#10141e';
  for (const w of s.wins) if (!w.on) p.fillRect(w.x, w.y, w.w, w.h);
  { const mx = -Math.floor((t * 1.4) % O.mistW); p.globalAlpha = 0.55 + rl * 0.35; p.drawImage(O.mist, mx, 100); p.drawImage(O.mist, mx + O.mistW, 100); p.globalAlpha = 1; }
  p.drawImage(O.garden, 0, 0);
  // the gas lamp's light, breathing a little; the church clock's face, dim
  const lf = 0.93 + 0.04 * Math.sin(t * 7.1) * Math.sin(t * 2.9) + 0.03 * Math.sin(t * 0.7);
  p.globalCompositeOperation = 'lighter';
  p.globalAlpha = 0.8 * lf; p.drawImage(O.gLamp, LAMPP.x - 30, LAMPP.y - 32);
  p.globalAlpha = lf; p.drawImage(O.gLampCore, LAMPP.x - 8, LAMPP.y - 9);
  if (O.geo.church) { p.globalAlpha = 0.3; p.drawImage(O.gClock, O.geo.church[0] - 4, O.geo.church[1] - 4); }
  p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';
  // rings in the puddles: faint arcs of the puddle's own paler colour, gone in half a second
  for (const q of s.ripples) {
    const f = q.a / 0.5, w = 1 + Math.min(q.m, Math.floor(f * (q.m + 1)));
    p.fillStyle = q.warm ? `rgba(122,98,72,${(0.55 * (1 - f)).toFixed(2)})` : `rgba(62,76,104,${(0.6 * (1 - f)).toFixed(2)})`;
    p.fillRect(q.x - w + 1, q.y - 1, w * 2 - 1, 1); p.fillRect(q.x - w, q.y, 1, 1); p.fillRect(q.x + w, q.y, 1, 1);
  }
  // the rain, lit gold where it falls past the lamp
  p.fillStyle = 'rgba(140,165,205,0.2)';
  for (let i = 70; i < 140; i++) { const st = s.streaks[i]; if (st.on) p.fillRect(Math.round(st.x), Math.round(st.y - st.l), 1, st.l); }
  const B = s.buckets; B[0].length = 0; B[1].length = 0;
  for (let i = 0; i < 70; i++) {
    const st = s.streaks[i];
    if (!st.on) continue;
    const cx = clamp(Math.floor(st.x / 4), 0, O.tintCols - 1), cy = clamp(Math.floor(Math.max(0, st.y - st.l / 2) / 4), 0, Math.ceil(PH / 4) - 1);
    B[O.tint[cy * O.tintCols + cx]].push(st);
  }
  for (let ti = 0; ti < 2; ti++) for (let k = 0; k < 3; k++) {
    if (!B[ti].length) continue;
    p.fillStyle = STREAK[ti][k];
    for (const st of B[ti]) { const h = Math.ceil(st.l / 3); p.fillRect(Math.round(st.x + k * 0.3), Math.round(st.y - h * (k + 1)), 1, h); }
  }
  if (e > 0.02) { p.globalCompositeOperation = 'lighter'; p.fillStyle = `rgba(110,140,200,${(e * 0.12).toFixed(3)})`; p.fillRect(0, 0, PW, PH); p.globalCompositeOperation = 'source-over'; }
}
const STREAK = [
  [[190, 206, 240, 0.4], [170, 190, 230, 0.28], [150, 170, 220, 0.16]],
  [[255, 214, 160, 0.62], [240, 190, 140, 0.42], [220, 170, 130, 0.24]],
].map((ks) => ks.map(([r, g, b, a]) => `rgba(${r},${g},${b},${a})`));

// water running down the glass: a wet track two pixels wide behind each rivulet (a lit edge and a
// dark one), a bead at its head with a bright shoulder and a dark lip; beads it left drying
const RIV = { lit: 'rgba(205,220,250,0.3)', dark: 'rgba(4,6,14,0.36)', hi: 'rgba(240,246,255,0.92)', body: 'rgba(160,182,228,0.6)', lip: 'rgba(2,4,10,0.6)' };
const DRY = [0.14, 0.28, 0.46].map((a) => [`rgba(214,226,250,${a})`, `rgba(2,4,10,${(a * 0.7).toFixed(2)})`]);
function drawRivs(g, G, gx, gy) {
  for (let q = 0; q < 3; q++) {
    const [hi, lip] = DRY[q];
    g.fillStyle = hi;
    for (const b of G.beads) { const f = 1 - b.a / b.life; if ((f > 0.66 ? 2 : f > 0.33 ? 1 : 0) === q) g.fillRect(gx + b.x, gy + b.y, b.big ? 2 : 1, 1); }
    g.fillStyle = lip;
    for (const b of G.beads) { const f = 1 - b.a / b.life; if ((f > 0.66 ? 2 : f > 0.33 ? 1 : 0) === q) g.fillRect(gx + b.x, gy + b.y + 1, b.big ? 2 : 1, 1); }
  }
  for (const [style, dx] of [[RIV.lit, 0], [RIV.dark, 1]]) {
    g.fillStyle = style;
    for (const d of G.riv) {
      if (!d.on || d.len < 1) continue;
      let x = d.x, yb = d.y;
      const yt = d.y - d.len;
      for (let k = d.kinks.length - 1; k >= -1; k--) {
        const ky = k >= 0 ? Math.max(yt, d.kinks[k][1]) : yt;
        if (yb > ky) g.fillRect(gx + x + dx, Math.round(gy + ky), 1, Math.max(1, Math.round(yb - ky)));
        if (k < 0 || ky <= yt) break;
        x = d.kinks[k][0]; yb = ky;
      }
    }
  }
  g.fillStyle = RIV.body; for (const d of G.riv) if (d.on) g.fillRect(gx + d.x, Math.round(gy + d.y), 2, d.big ? 3 : 2);
  g.fillStyle = RIV.hi; for (const d of G.riv) if (d.on) g.fillRect(gx + d.x, Math.round(gy + d.y), 1, 1);
  g.fillStyle = RIV.lip; for (const d of G.riv) if (d.on) g.fillRect(gx + d.x, Math.round(gy + d.y) + (d.big ? 3 : 2), 2, 1);
}

function drawGlass(g, O, s, RM) {
  const ox = RM.ox, rl = s.rainLv, wet = 0.5 + 0.5 * Math.min(1, rl * 2 + 0.2);
  for (const G of s.glass) {
    if (!RM.lay.wins.includes(G.W)) continue;
    const gx = ox + G.W.x, gy = G.W.top;
    g.globalAlpha = wet; g.drawImage(O.glass[G.W.id], gx, gy); g.globalAlpha = 1;
    drawRivs(g, G, gx, gy);
  }
}

function drawLit(g, RM, sp, ord, dy = 0) {
  const x = RM.ox + sp.x0, y = sp.y0 - dy;
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(spriteImg(RM, sp, k), x, y); }
  g.globalAlpha = 1;
}
function order(s) {
  const l = s.lamp, f = s.fire, w = [(1 - l) * (1 - f), l * (1 - f), (1 - l) * f, l * f];
  let acc = 0;
  return [0, 1, 2, 3].filter((k) => w[k] > 0.004).sort((a, b) => w[b] - w[a]).map((k) => { acc += w[k]; return [k, w[k] / acc]; });
}

let FIRECV = null;
function drawFire(g, RM, s) {
  if (!FIRECV) {
    const c = document.createElement('canvas'); c.width = FWD; c.height = FHT;
    const img = new ImageData(FWD, FHT);
    FIRECV = { c, x: c.getContext('2d'), img, u32: new Uint32Array(img.data.buffer), heat: new Float32Array(FWD * FHT) };
  }
  const { heat, u32 } = FIRECV, t = s.t, lv = 0.78 + s.fire * 0.3 + s.boost * 0.45;
  heat.fill(0);
  for (const e of EMBERS) { const v = (0.42 + 0.26 * Math.sin(t * e.sp + e.p) + s.fire * 0.18 + s.boost * 0.3) * e.k, i = e.y * FWD + e.x; if (v > heat[i]) heat[i] = v; }
  for (const tg of TONGUES) {
    const pulse = Math.sin(t * tg.f + tg.p) * 0.5 + 0.5, h = tg.h * lv * (0.66 + 0.34 * pulse * (Math.sin(t * tg.f * 1.63 + tg.p * 3) * 0.3 + 0.7));
    const sway = Math.sin(t * tg.sf + tg.p * 2) * 1.7 + Math.sin(t * tg.sf * 2.3) * 0.6;
    // a tongue at its tallest lets a little flame go, which rises and dies
    if (pulse > 0.93 && tg.top < h - 1 && Math.random() < 0.25 + s.boost) s.tips.push({ x: tg.x + sway, y: tg.base - h, v: 16 + Math.random() * 14, a: 0, life: 0.22 + Math.random() * 0.25, ph: Math.random() * 6 });
    tg.top = h;
    for (let j = 0; j < h; j++) {
      const u = j / h, y = tg.base - j;
      if (y < 0) break;
      const half = tg.w * (1 - u) ** 0.85 * Math.min(1, u * 3 + 0.55), cx = tg.x + sway * u * u;
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half); x++) {
        if (x < 0 || x >= FWD) continue;
        const ed = 1 - Math.abs(x + 0.5 - cx) / (half + 0.6);
        if (ed <= 0) continue;
        const v = (1 - u) * 0.8 * (0.35 + ed * 0.85) + 0.14, i = y * FWD + x;
        if (v > heat[i]) heat[i] = v;
      }
    }
  }
  for (const p of s.tips) {
    const x = Math.round(p.x), y = Math.round(p.y), v = 0.62 * (1 - p.a / p.life) + 0.16;
    for (const [dx, dy] of p.a / p.life < 0.5 ? [[0, 0], [0, 1]] : [[0, 0]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < FWD && yy >= 0 && yy < FHT && v > heat[yy * FWD + xx]) heat[yy * FWD + xx] = v; }
  }
  for (let y = 0; y < FHT; y++) for (let x = 0; x < FWD; x++) {
    const i = y * FWD + x, v = heat[i];
    u32[i] = v < 0.1 ? 0 : FPAL[Math.min(5, band(v * 5, x + 1, y))];
  }
  FIRECV.x.putImageData(FIRECV.img, 0, 0);
  g.drawImage(FIRECV.c, RM.ox + FX0, FY0);
}
// the log at the front of the grate, hiding the flames' feet, its cracks glowing with the fire;
// and a thin thread of smoke drawn up into the flue
function drawFrontLog(g, RM, s) {
  const ox = RM.ox, F = fx();
  g.fillStyle = litB(RM, 276, 226, 0x4a2e1c, s); g.fillRect(ox + 264, 223, 25, 5); g.fillRect(ox + 263, 224, 27, 3);
  g.fillStyle = litB(RM, 276, 222, 0x7a5030, s); g.fillRect(ox + 265, 222, 23, 1);
  g.fillStyle = litB(RM, 276, 228, 0x24160c, s); g.fillRect(ox + 264, 228, 25, 1);
  g.fillStyle = litB(RM, 262, 225, 0x9a7650, s); g.fillRect(ox + 262, 223, 2, 5); g.fillStyle = litB(RM, 262, 225, 0x6a4a30, s); g.fillRect(ox + 262, 225, 1, 1);
  const hot = s.fire + s.boost * 0.5;
  g.fillStyle = hot > 0.7 ? '#ffc050' : hot > 0.5 ? '#ff9030' : hot > 0.32 ? '#e05818' : '#a83a10';
  g.fillRect(ox + 269, 225, 3, 1); g.fillRect(ox + 278, 224, 1, 2); g.fillRect(ox + 283, 226, 2, 1); g.fillRect(ox + 274, 227, 1, 1);
  g.fillStyle = hot > 0.55 ? '#c84010' : '#7a2808'; g.fillRect(ox + 272, 225, 1, 1); g.fillRect(ox + 285, 226, 1, 1);
  for (let k = 0; k < 9; k++) {
    const u = (s.t * 0.3 + k / 9) % 1, y = 205 - u * 26, x = 276 + Math.sin(s.t * 1.1 + u * 6) * (1 + u * 2.5);
    g.fillStyle = F.smoke[Math.max(0, Math.min(5, Math.round((1 - u) * 3.5) - 1))]; g.fillRect(ox + Math.round(x), Math.round(y), 1, 1);
  }
}

function drawLadder(g, RM, s) {
  const ox = RM.ox, cx = s.lad.x, top = RAILY - 1, bot = 252, OAK = 0xb07a48, OAKH = 0xdcaa6e, OAKD = 0x6e4628;
  const railX = (side, y) => Math.round(cx + side * (7 + ((y - top) / (bot - top)) * 3) - (side > 0 ? 1 : 0));
  // its shadow on the books, then the two rails, widening toward the floor
  g.fillStyle = 'rgba(10,6,8,0.28)';
  for (const side of [-1, 1]) { g.fillRect(ox + railX(side, 60) + 2, top + 4, 1, bot - top - 10); }
  for (const side of [-1, 1]) {
    let y = top;
    while (y < bot) {
      const x = railX(side, y);
      let y2 = y + 1; while (y2 < bot && railX(side, y2) === x && (y2 & 7)) y2++;
      g.fillStyle = litB(RM, x, y, OAK, s); g.fillRect(ox + x, y, 2, y2 - y);
      g.fillStyle = litB(RM, x, y, side < 0 ? OAKH : OAKD, s); g.fillRect(ox + x + (side < 0 ? 0 : 1), y, 1, y2 - y);
      y = y2;
    }
  }
  // the rungs, and the brass hooks over the rail
  for (let y = top + 16; y < bot - 4; y += 15) {
    const xl = railX(-1, y) + 2, xr = railX(1, y);
    g.fillStyle = litB(RM, cx, y, OAK, s); g.fillRect(ox + xl, y, xr - xl, 2);
    g.fillStyle = litB(RM, cx, y, OAKH, s); g.fillRect(ox + xl, y, xr - xl, 1);
  }
  g.fillStyle = litB(RM, cx, RAILY, 0xd4a44a, s);
  for (const side of [-1, 1]) { const x = railX(side, top); g.fillRect(ox + x - 1, RAILY - 2, 4, 1); g.fillRect(ox + x - 1, RAILY - 1, 1, 3); g.fillRect(ox + x + 2, RAILY - 1, 1, 2); }
}

// a book tipped part way out of its shelf: it comes forward (a little wider), its head showing,
// leaning a few pixels to one side, its lit edge bright; the gap it left dark behind it
function drawPull(g, RM, s, pl) {
  const b = pl.b, u = pl.t, p = u < 0.45 ? ease(u / 0.45) : u < 3.3 ? 1 : 1 - ease((u - 3.3) / 0.6);
  if (p <= 0.01) return;
  const ox = RM.ox, lean = p * 5 * pl.dir, grow = Math.round(p * 1.2), head = Math.round(p * 3), top = b.y + Math.round(p * 2) - head;
  const x0 = b.x - grow, w = b.w + grow * 2, n = b.h + head;
  g.fillStyle = '#0e0806'; g.fillRect(ox + b.x, b.y, b.w, b.h);
  const cHead = litB(RM, b.x, b.y, 0xf0e2c4, s), cSp = litB(RM, b.x, b.y + b.h / 2, b.c, s), cRim = litB(RM, b.x, b.y, mixc(b.c, 0xfff0d0, 0.55), s), cD = litB(RM, b.x, b.y, mixc(b.c, 0x000000, 0.45), s), cG = litB(RM, b.x, b.y, GILT, s);
  for (let j = 0; j < n; j++) {
    const y = top + j, sh = Math.round(lean * (1 - j / n)), x = ox + x0 + sh;
    if (j < head) { g.fillStyle = cHead; g.fillRect(x + 1, y, w - 2, 1); g.fillStyle = cD; g.fillRect(x, y, 1, 1); g.fillRect(x + w - 1, y, 1, 1); continue; }
    const k = j - head;
    g.fillStyle = k === 2 || k === b.h - 4 || (w > 3 && k === Math.floor(b.h * 0.3)) ? cG : cSp; g.fillRect(x, y, w, 1);
    g.fillStyle = pl.dir > 0 ? cD : cRim; g.fillRect(x, y, 1, 1);
    g.fillStyle = pl.dir > 0 ? cRim : cD; g.fillRect(x + w - 1, y, 1, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ox + x0 + (pl.dir > 0 ? -1 : w), b.y + 2, 1, b.h - 2);
}

// the clock's hands (the real time), and the pendulum swinging in its little window
function drawClock(g, RM, s, now) {
  const ox = RM.ox, mm = now.getMinutes() + now.getSeconds() / 60, hh = (now.getHours() % 12) + mm / 60;
  g.fillStyle = litB(RM, CLOCK.x, CLOCK.y, 0x1a1410, s);
  for (const [a, len] of [[(hh / 12) * Math.PI * 2, 3.4], [(mm / 60) * Math.PI * 2, 5.2]]) {
    for (let k = 0; k <= len; k += 0.5) g.fillRect(ox + Math.round(CLOCK.x + Math.sin(a) * k), Math.round(CLOCK.y - Math.cos(a) * k), 1, 1);
  }
  const sw = Math.sin(s.t * Math.PI * 1.6), bx = Math.round(sw * 2.6);
  g.fillStyle = litB(RM, 277, 142, 0xa8803a, s); g.fillRect(ox + 277 + Math.round(sw * 1.2), 139, 1, 3);
  g.fillStyle = litB(RM, 277, 144, 0xe0b45a, s); g.fillRect(ox + 276 + bx, 142, 3, 3);
  g.fillStyle = litB(RM, 277, 144, 0xfff0b0, s); g.fillRect(ox + 276 + bx, 142, 1, 1);
}

// a globe: continents turning under a little shading; cached until it turns or the light changes
const GLOBES = new Map();
function drawGlobe(g, RM, s, G, rot, key) {
  const step = Math.floor((((rot % 1) + 1) % 1) * LANDS.W * 2), k = `${key}|${RM.bw}|${step}|${s.lampOn ? 1 : 0}|${RM.off.size}`;
  let c = GLOBES.get(key);
  if (!c || c.k !== k) {
    const r = G.r, d = r * 2 + 1, cv = c?.cv || document.createElement('canvas');
    cv.width = d; cv.height = d;
    const x2 = cv.getContext('2d'), ss = { lamp: s.lampOn ? 1 : 0, fire: 0.5 };
    x2.clearRect(0, 0, d, d);
    const col = { sea: litB(RM, G.x, G.y, 0x5a8a96, ss), seaD: litB(RM, G.x, G.y, 0x345a68, ss), land: litB(RM, G.x, G.y, 0xd8bc80, ss), landD: litB(RM, G.x, G.y, 0xa08050, ss), hi: litB(RM, G.x, G.y, 0xe8f0e0, ss) };
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d2 = (x * x + y * y) / (r + 0.5) ** 2;
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2), lon = Math.atan2(x / (r + 0.5), z) / (Math.PI * 2) + step / (LANDS.W * 2), lat = y / (r + 0.5);
      const mx = Math.floor((((lon % 1) + 1) % 1) * LANDS.W), my = clamp(Math.floor((lat * 0.5 + 0.5) * LANDS.H), 0, LANDS.H - 1);
      const land = LANDS.m[my * LANDS.W + mx], dark = x + y * 0.4 > r * 0.5;
      x2.fillStyle = land ? (dark ? col.landD : col.land) : (dark ? col.seaD : col.sea);
      if (x < -r * 0.35 && y < -r * 0.35 && d2 < 0.55 && d2 > 0.3) x2.fillStyle = col.hi;
      x2.fillRect(x + r, y + r, 1, 1);
    }
    c = { cv, k }; GLOBES.set(key, c);
  }
  g.drawImage(c.cv, RM.ox + G.x - G.r, G.y - G.r);
}

function flame(g, x, y, t, on, big = false) {
  if (!on) return;
  const f = Math.sin(t * 11 + x) + Math.sin(t * 6.7 + x * 0.3) * 0.8, h = big ? 4 : 3;
  g.fillStyle = f > 0.3 ? '#ffd27a' : '#ffa848'; g.fillRect(x, y - h + 1, 1, h); g.fillRect(x + (f > 1.1 ? 1 : f < -1.1 ? -1 : 0), y - h, 1, 1);
  g.fillStyle = '#fff6d8'; g.fillRect(x, y - 1, 1, 1);
  if (big) { g.fillStyle = '#ff9a3a'; g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); }
}

// the tassels on the drapes' cords: still, or swinging when you touch the drape
function drawTassels(g, RM, s) {
  const ox = RM.ox;
  [99, 221].forEach((tx, i) => {
    const dx = s.tassel[i] > 0 ? Math.round(Math.sin(s.t * 8) * s.tassel[i] * 2.4) : 0;
    g.fillStyle = litB(RM, tx, 144, 0xd4a44a, s); g.fillRect(ox + tx - 1, 143, 3, 2);
    g.fillStyle = litB(RM, tx, 148, 0xc8963e, s); g.fillRect(ox + tx - 2 + dx, 145, 5, 7);
    g.fillStyle = litB(RM, tx, 148, 0xf0c868, s); g.fillRect(ox + tx - 1 + dx, 146, 1, 1);
    g.fillStyle = litB(RM, tx, 152, 0xd4a44a, s); for (const k of [0, 2, 4]) g.fillRect(ox + tx - 2 + k + dx, 152, 1, 1);
    g.fillStyle = litB(RM, tx, 152, 0x9a7028, s); for (const k of [1, 3]) g.fillRect(ox + tx - 2 + k + dx, 152, 1, 1);
  });
}

// the words on the open book's pages, following the bow of the paper; one canvas per page and light
const PAGES = new Map();
function pageText(n, ink, rub, gold) {
  const key = `${n}|${ink}|${rub}|${gold}`;
  let cv = PAGES.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = 70; cv.height = 34;
  const x2 = cv.getContext('2d'), r = rng(1000 + n * 31), oy = BOOK.y0 - 4;
  x2.fillStyle = ink;
  for (const side of [0, 1]) {
    const u0 = side ? 39 : 4, u1 = side ? 65 : 30, chapter = side === 0 && n % 3 === 0;
    for (let l = 0; l < 6; l++) {
      if (chapter && l < 1) continue;
      let u = u0 + (l === 0 || (l === 3 && r() < 0.5) ? 3 : 0) + (chapter && l < 3 ? 6 : 0);
      const end = l === 5 && r() < 0.5 ? u0 + 10 + r() * 12 : u1;
      while (u < end) { const w = 1 + Math.floor(r() * 5); if (u + w > end) break; for (let k = 0; k < w; k++) x2.fillRect(u + k, pageTop(u + k) + 4 + Math.round(l * 3.4) - oy, 1, 1); u += w + 1 + (r() < 0.2 ? 1 : 0); }
    }
    if (chapter) { const cy = pageTop(u0) + 7 - oy; x2.fillStyle = gold; x2.fillRect(u0, cy, 4, 5); x2.fillStyle = rub; x2.fillRect(u0 + 1, cy, 2, 5); x2.fillRect(u0, cy + 1, 1, 1); x2.fillRect(u0 + 3, cy + 3, 1, 1); x2.fillStyle = ink; }
  }
  x2.fillRect(16, pageBot(16) - 2 - oy, 2, 1); x2.fillRect(51, pageBot(51) - 2 - oy, 2, 1);
  PAGES.set(key, cv);
  if (PAGES.size > 8) PAGES.delete(PAGES.keys().next().value);
  return cv;
}

function drawBook(g, RM, s) {
  const ox = RM.ox, ink = lit(RM, 150, 258, 0x4a3a2e, s);
  g.drawImage(pageText(s.page, ink, lit(RM, 140, 256, 0xa83028, s), lit(RM, 140, 256, 0xd4ac58, s)), ox + BOOK.x0, BOOK.y0 - 4);
  const paper = lit(RM, 176, 258, 0xf2e6c8, s), back = lit(RM, 176, 258, 0xdccaa4, s), edge = lit(RM, 176, 258, 0xb8a47e, s);
  // a draught lifts the right page's corner a little
  if (s.lift > 0 && s.flip <= 0) {
    const a = Math.sin(Math.PI * (1 - s.lift)), n = Math.round(a * 9);
    for (let i = 0; i < n; i++) {
      const u = 68 - i, up = Math.round(a * 3 * (1 - i / Math.max(1, n)) ** 0.7), b = pageBot(u);
      if (up <= 0) continue;
      const h = Math.max(1, Math.round((n - i) * 0.8));
      g.fillStyle = 'rgba(40,24,10,0.35)'; g.fillRect(ox + BOOK.x0 + u, b - h + 1, 1, h);
      g.fillStyle = i === 0 ? edge : back; g.fillRect(ox + BOOK.x0 + u, b - h + 1 - up, 1, h);
    }
  }
  // a page turning over, from the right-hand page to the left
  if (s.flip > 0) {
    const k = 1 - s.flip, w = Math.round(Math.cos(k * Math.PI) * 33), lift = Math.round(Math.sin(k * Math.PI) * 8), n = Math.abs(w);
    for (let i = 0; i < n; i++) {
      const u = w >= 0 ? 35 + i : 33 - i, x = ox + BOOK.x0 + u, f = i / Math.max(1, n), up = Math.round(lift * Math.sin(f * Math.PI * 0.5 + 0.2));
      const t0 = pageTop(u) - up, b0 = pageBot(u) - Math.round(up * 0.6);
      g.fillStyle = i === n - 1 ? edge : w >= 0 ? paper : back; g.fillRect(x, t0, 1, Math.max(1, b0 - t0));
      if (w >= 0 && i % 2 === 0 && i > 2 && i < n - 2) { g.fillStyle = ink; for (let l = 0; l < 6; l += 2) g.fillRect(x, t0 + 4 + l * 3, 1, 1); }
    }
    if (n > 1) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(ox + BOOK.x0 + (w >= 0 ? 35 + n : 34 - n), pageTop(34) + 2, 1, 18); }
  }
}

function drawHourglass(g, RM, s) {
  const ox = RM.ox, hop = s.hop > 0 ? Math.round(Math.sin(Math.PI * (1 - s.hop / 0.5)) * 4) : 0, x = ox + HOUR.x, y = HOUR.y - hop;
  const wood = lit(RM, HOUR.x, HOUR.y + 8, 0x6a4228, s), woodL = lit(RM, HOUR.x, HOUR.y + 8, 0x9a6a40, s), glassC = lit(RM, HOUR.x, HOUR.y + 8, 0x8aa0a8, s), sand = lit(RM, HOUR.x, HOUR.y + 8, 0xe0c080, s);
  g.fillStyle = wood; g.fillRect(x - 5, y, 11, 2); g.fillRect(x - 5, y + 15, 11, 2); g.fillRect(x - 5, y + 2, 1, 13); g.fillRect(x + 5, y + 2, 1, 13);
  g.fillStyle = woodL; g.fillRect(x - 5, y, 11, 1); g.fillRect(x - 5, y + 15, 11, 1);
  const prof = [3, 3, 3, 2, 2, 1, 0], top = Math.round(s.sand * 6), bottom = Math.round((1 - s.sand) * 6);
  g.fillStyle = 'rgba(160,190,200,0.22)';
  prof.forEach((w, k) => { g.fillRect(x - w, y + 2 + k, w * 2 + 1, 1); g.fillRect(x - w, y + 14 - k, w * 2 + 1, 1); });
  g.fillStyle = glassC;
  prof.forEach((w, k) => { g.fillRect(x - w - 1, y + 2 + k, 1, 1); g.fillRect(x + w + 1, y + 2 + k, 1, 1); g.fillRect(x - w - 1, y + 14 - k, 1, 1); g.fillRect(x + w + 1, y + 14 - k, 1, 1); });
  g.fillStyle = sand;
  for (let k = 0; k < top; k++) { const row = 6 - k - 1, w = prof[row]; g.fillRect(x - w, y + 2 + row, w * 2 + 1, 1); }
  for (let k = 0; k < bottom; k++) { const w = Math.max(0, prof[k] - (k === bottom - 1 ? 1 : 0)); g.fillRect(x - w, y + 14 - k, w * 2 + 1, 1); }
  if (s.sand > 0 && !hop) { g.fillRect(x, y + 8, 1, 1); if (Math.sin(s.t * 20) > -0.3) g.fillRect(x, y + 9 + Math.floor((s.t * 12) % 4), 1, 1); }
}

// the window's light on the table, with the shadows of the drops running down the glass sliding
// across it; brighter when the rain stops and the moon is out, flashing with the lightning
function drawProjection(g, RM, s, e) {
  const F = fx(), clr = clamp(1 - s.rainLv * 2.4, 0, 1), a = (0.1 + 0.16 * clr) * (1 - 0.5 * s.lamp) + e * 0.6;
  if (a < 0.01) return;
  const pg = F.pjg;
  pg.globalCompositeOperation = 'copy'; pg.globalAlpha = 1; pg.drawImage(F.proj, 0, 0);
  pg.globalCompositeOperation = 'destination-out';
  const G = s.glass[0];
  pg.fillStyle = 'rgba(0,0,0,0.6)';
  for (const d of G.riv) if (d.on) { const [px, py] = projOf(WIN.x + d.x + 1, WIN.top + d.y + 1); pg.fillRect(Math.round(px) - PJ.x0 - 1, Math.round(py) - PJ.y0, 2, 1); }
  pg.fillStyle = 'rgba(0,0,0,0.3)';
  for (const b of G.beads) { const [px, py] = projOf(WIN.x + b.x, WIN.top + b.y); pg.fillRect(Math.round(px) - PJ.x0, Math.round(py) - PJ.y0, 1, 1); }
  pg.globalCompositeOperation = 'source-over';
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a);
  g.drawImage(F.pjc, RM.ox + PJ.x0, PJ.y0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function drawRoom(g, RM, O, s, now) {
  const { ox, lay } = RM, t = s.t, F = fx(), ord = order(s), off = s.off;
  const e = s.bolt ? boltEnv(s.bolt.t) * s.bolt.k : 0;
  drawLit(g, RM, RM.back, ord);
  drawFire(g, RM, s);
  drawFrontLog(g, RM, s);
  for (const f of RM.geo.flames) flame(g, ox + f.x, f.y, t + f.i, !off.has(f.id));
  for (const p of s.pulls) drawPull(g, RM, s, p);
  drawLadder(g, RM, s);
  drawClock(g, RM, s, now);
  drawGlobe(g, RM, s, GLOBE, s.rot, 'm');
  if (lay.globe) drawGlobe(g, RM, s, { x: lay.globe.x0 + 18, y: 198, r: 13 }, s.rot2, 'f');
  CANDLES.forEach(([x, y], i) => flame(g, ox + x, y, t + i * 3, !off.has('c' + i)));
  if (lay.desk) flame(g, ox + DESKC[0], DESKC[1], t + 7, !off.has('desk'));
  if (lay.nook) flame(g, ox + NLAMP[0], NLAMP[1], t + 11, !off.has('nook'));
  drawTassels(g, RM, s);
  // the sheet on the desk fills with lines as you write
  if (lay.desk) {
    const lines = s.write.lines + (s.write.t > 0 ? 1 : 0);
    g.fillStyle = litB(RM, 362, 208, 0x6a5862, s);
    for (let l = 0; l < lines; l++) {
      const w = l === s.write.lines && s.write.t > 0 ? Math.round(13 * (1 - s.write.t / 1.6)) : 13 - (l % 3) * 3;
      for (let u = 0, k = l * 3; u < w; k++) { const ww = Math.min(w - u, 2 + ((k * 7) % 3)); g.fillRect(ox + 356 + u, 205 + l * 2, ww, 1); u += ww + 1; }
    }
    if (s.write.t > 0) { g.fillStyle = litB(RM, 370, 196, 0xf2eee4, s); const qx = 356 + Math.round(13 * (1 - s.write.t / 1.6)), qy = 205 + s.write.lines * 2; g.fillRect(ox + qx, qy - 13, 1, 13); g.fillRect(ox + qx - 1, qy - 12, 1, 8); g.fillRect(ox + qx + 1, qy - 11, 1, 6); }
  }
  // the cat, the warm edge the fire puts along its back; the ferns
  const bs = Math.sin(s.bph);
  const catF = s.cat > 0 ? (() => { const u = 3.6 - s.cat; return u < 0.5 ? 3 : u < 2.2 ? 4 : u < 3 ? 5 : 3; })()
    : s.catEv > 0 && (s.catEvK === 6 || (s.catEv > 0.15 && s.catEv < 0.6)) ? s.catEvK : bs > 0.45 ? 2 : bs > -0.35 ? 1 : 0;
  drawLit(g, RM, RM.cat[catF], ord);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, 0.16 + 0.3 * s.fire + s.boost * 0.25); g.fillStyle = '#ff9040';
  for (const [x, y] of catRim(catF)) g.fillRect(ox + x, y, 1, 1);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const sw = (kick, ph) => { const v = Math.sin(t * 0.6 + ph) * 0.75 + (kick > 0 ? Math.sin(t * 14) * kick * 1.8 : 0); return v > 0.5 ? 2 : v < -0.5 ? 0 : 1; };
  drawLit(g, RM, RM.fern[sw(s.fernKick, 0)], ord);
  if (RM.fern2) drawLit(g, RM, RM.fern2[sw(s.fern2Kick, 2)], ord);
  drawLit(g, RM, RM.front, ord);
  // the edge of your chair's wing, catching the lamp and the fire
  if (RM.wing) {
    g.globalCompositeOperation = 'lighter';
    for (const [k, col] of [[1, '#8a3e22'], [0, '#3a160c']]) { g.globalAlpha = Math.min(1, 0.3 + 0.45 * s.lamp + 0.2 * s.fire); g.fillStyle = col; for (const [x, y, q] of RM.wing) if (q === k) g.fillRect(ox + x, y, 1, 1); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  drawBook(g, RM, s);
  // the cup, lifted for a sip and set down; steam while there is tea
  const lift = s.sip > 0 ? Math.round(Math.sin(Math.PI * clamp((1 - s.sip) * 1.15, 0, 1)) * 13) : 0;
  if (lift) { g.fillStyle = lit(RM, CUP.x, CUP.y, 0xe2dccc, s); g.fillRect(ox + CUP.x - 6, CUP.y - 1, 13, 2); }
  drawLit(g, RM, RM.cup[s.tea], ord, lift);
  for (const p of s.steam) {
    const u = p.a / p.life, a = Math.max(0, Math.min(10, Math.round((u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 8)));
    g.fillStyle = F.steam[a]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 2 + p.ph) * (1 + u * 3)), Math.round(p.y - lift), 1, u > 0.4 ? 2 : 1);
  }
  drawHourglass(g, RM, s);
  // the lamp's mouth: lit (a bright lip, the bulb under the shade) or dark
  if (s.lamp > 0.5) { g.fillStyle = '#ffe8b0'; g.fillRect(ox + 84, 213, 34, 1); g.fillStyle = '#fff6dc'; g.fillRect(ox + 94, 212, 14, 1); }
  else { g.fillStyle = '#2a2014'; g.fillRect(ox + 84, 213, 34, 1); }
  drawProjection(g, RM, s, e);
  // everything that glows
  g.globalCompositeOperation = 'lighter';
  if (s.lamp > 0.02) {
    const hum = 0.95 + 0.03 * Math.sin(t * 1.9) + 0.02 * Math.sin(t * 7.3);
    g.globalAlpha = s.lamp * 0.85 * hum; g.drawImage(F.lip, ox + 101 - 20, 214 - 6);
    g.globalAlpha = s.lamp * hum; g.drawImage(F.cone, ox + 101 - 56, 214);
    g.globalAlpha = s.lamp * 0.6 * hum; g.drawImage(F.halo, ox + 101 - 34, 212 - 18);
    g.globalAlpha = s.lamp * 0.5; g.drawImage(F.green, ox + 101 - 24, 207 - 8);
  }
  const fl = 0.75 + s.fire * 0.35 + s.boost * 0.5;
  g.globalAlpha = Math.min(1, 0.38 * fl); g.drawImage(F.fire, ox + 276 - 64, 214 - 40);
  g.globalAlpha = Math.min(1, 0.5 * fl); g.drawImage(F.fireIn, ox + 276 - 22, 214 - 20);
  g.globalAlpha = Math.min(1, 0.4 * fl); g.drawImage(F.hearth, ox + 278 - 46, 246 - 10);
  CANDLES.forEach(([x, y], i) => { if (!off.has('c' + i)) { g.globalAlpha = 0.7 + 0.2 * Math.sin(t * 9 + i) * Math.sin(t * 5.1); g.drawImage(F.candle, ox + x - 9, y - 11); g.globalAlpha = 0.45; g.drawImage(F.candleBig, ox + x - 24, y - 18); } });
  for (const f of RM.geo.flames) if (!off.has(f.id)) { g.globalAlpha = 0.65 + 0.2 * Math.sin(t * 8 + f.i * 2); g.drawImage(F.candle, ox + f.x - 9, f.y - 10); }
  for (const lb of RM.geo.libs) if (!off.has(lb.id)) { g.globalAlpha = 0.9; g.drawImage(F.lib, ox + lb.x + (lb.w >> 1) - 16, lb.y - 3); }
  if (lay.desk && !off.has('desk')) { g.globalAlpha = 0.7 + 0.2 * Math.sin(t * 8.4) * Math.sin(t * 4.7); g.drawImage(F.candle, ox + DESKC[0] - 9, DESKC[1] - 11); g.globalAlpha = 0.5; g.drawImage(F.candleBig, ox + DESKC[0] - 24, DESKC[1] - 17); }
  if (lay.nook && !off.has('nook')) { g.globalAlpha = 0.7 + 0.15 * Math.sin(t * 7.7) * Math.sin(t * 3.1); g.drawImage(F.nook, ox + NLAMP[0] - 11, NLAMP[1] - 8); }
  g.globalAlpha = 0.8; g.drawImage(F.pic, ox + 276 - 16, 55 - 2);
  if (lay.lamp && !off.has('stand')) { g.globalAlpha = 0.6; g.drawImage(F.stand, ox + lay.lamp.x0 + 12 - 28, 138 - 18); }
  // sparks rising from the fire
  for (const p of s.sparks) { g.globalAlpha = Math.max(0, Math.min(1, p.l * 1.4)); g.fillStyle = p.l > 0.5 ? '#ffd27a' : '#ff8a3a'; g.fillRect(ox + Math.round(p.x), Math.round(p.y), 1, 1); }
  // far lightning: the room a breath brighter (the window's own light on the table flashes above)
  if (e > 0.02) { g.globalAlpha = 1; g.fillStyle = `rgba(110,140,200,${(e * 0.05).toFixed(3)})`; g.fillRect(0, 0, RM.bw, H); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // lit lips: the picture light, the library lights, the standing lamp
  g.fillStyle = '#ffe8b8'; g.fillRect(ox + 263, 54, 27, 1);
  for (const lb of RM.geo.libs) { g.fillStyle = off.has(lb.id) ? '#3a2a18' : '#ffe8b8'; g.fillRect(ox + lb.x, lb.y, lb.w, 1); }
  if (lay.lamp && !off.has('stand')) { const sx = lay.lamp.x0 + 12; g.fillStyle = '#ffe2a8'; g.fillRect(ox + sx - 10, 138, 21, 1); g.fillStyle = '#fff4d8'; g.fillRect(ox + sx - 4, 137, 9, 1); }
  // dust in the lamplight, smoke from a snuffed wick, a puff of dust, glints
  if (s.lamp > 0.05) for (const mo of s.motes) { const a = Math.round((0.25 + 0.3 * Math.sin(t * 0.9 + mo.p)) * s.lamp / 0.07) - 1; if (a >= 0) { g.fillStyle = F.mote[Math.min(7, a)]; g.fillRect(ox + Math.round(mo.x), Math.round(mo.y), 1, 1); } }
  for (const p of s.smoke) { g.fillStyle = F.smoke[Math.max(0, Math.min(5, Math.round((1 - p.a / 2.4) * 5)))]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 3 + p.ph) * (1 + p.a)), Math.round(p.y), 1, 2); }
  for (const p of s.puffs) { g.fillStyle = F.dust[Math.max(0, Math.min(5, Math.round((1 - p.a / p.life) * 5)))]; g.fillRect(ox + Math.round(p.x), Math.round(p.y), 1, 1); }
  if (s.glints.length) {
    g.globalCompositeOperation = 'lighter';
    for (const p of s.glints) {
      const k = Math.sin(Math.PI * (p.a / 0.9)), arm = k > 0.6 ? 2 : 1;
      g.globalAlpha = k; g.fillStyle = '#fff2c8';
      g.fillRect(ox + p.x, p.y, 1, 1); g.fillRect(ox + p.x - arm, p.y, arm, 1); g.fillRect(ox + p.x + 1, p.y, arm, 1); g.fillRect(ox + p.x, p.y - arm, 1, arm); g.fillRect(ox + p.x, p.y + 1, 1, arm);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}

function render(g, pc, RM, O, s, now) {
  drawOutside(pc, O, s);
  g.clearRect(0, 0, RM.bw, H);
  for (const W of RM.lay.wins) g.drawImage(pc.canvas, W.src, W.top - PY, W.w, W.bot - W.top, RM.ox + W.x, W.top, W.w, W.bot - W.top);
  drawGlass(g, O, s, RM);
  drawRoom(g, RM, O, s, now);
}

function makeBuffers(bw) {
  const buf = document.createElement('canvas'); buf.width = bw; buf.height = H;
  const pan = document.createElement('canvas'); pan.width = PW; pan.height = PH;
  return { buf, g: buf.getContext('2d'), pc: pan.getContext('2d') };
}

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const O = outside(), RM = roomFor(320), s = makeState(5);
    for (let i = 0; i < 90; i++) update(s, 1 / 30);
    s.t = 21.4; s.lift = 0.55; s.cat = 0; s.catEv = 0;
    const B = makeBuffers(320), now = new Date(2026, 10, 17, 22, 10, 0);
    render(B.g, B.pc, RM, O, s, now);
    PREV = B.buf;
  }
  // sharp pixels at whatever size the thumbnail is shown: a whole-number blow-up, then a smooth fit
  const m = ctx.getTransform?.(), sc = Math.max(1, Math.abs(m?.a || 1)), k = Math.max(1, Math.ceil((640 * sc) / H));
  let up = PREVUP.get(k);
  if (!up) { up = document.createElement('canvas'); up.width = 320 * k; up.height = H * k; const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(PREV, 0, 0, 320 * k, H * k); PREVUP.set(k, up); }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(up, 0, 0, 640, 640); ctx.restore();
}

/* ——— invented books and places ——— */
const T1 = ['A Short History of', 'Notes on', 'The Quiet Art of', 'A Field Guide to', 'Letters on', 'An Atlas of', 'Remarks upon', 'A Treatise on', 'The Little Book of', 'Collected Essays on', 'A Gazetteer of', 'Observations of', 'A Natural History of', 'Sermons on'];
const T2 = ['Rain', 'Lighthouses', 'Forgotten Rivers', 'Moths', 'Tea', 'Northern Weather', 'Clocks', 'Small Islands', 'Lanterns', 'Ferns and Mosses', 'Old Roads', 'the Night Sky', 'Bees', 'Tides', 'Winter Gardens', 'Owls', 'Paper Boats', 'Candlemaking', 'Distant Bells', 'the Sea at Dusk', 'Quiet Libraries', 'Snow'];
const LONE = ['The Lamplighter’s Almanac', 'Moss & Lantern', 'The Rain Diaries, Vol. II', 'A Cartographer’s Last Map', 'The Owl at the Window', 'Seven Grey Harbours', 'The Book of Slow Evenings', 'Under the Elder Tree', 'The Tea Merchant’s Daughter', 'Nocturnes for Candle and Clock'];
const AUTH = ['E. Marlowe', 'A. Finch', 'H. Ashdown', 'M. Quill', 'T. Hollis', 'R. Penhallow', 'J. Wren', 'C. Ambrose', 'O. Thistlewood', 'I. Brightwater', 'L. Vane', 'S. Mereweather', 'G. Hartley', 'P. Linwood'];
function bookTitle(id) {
  const r = rng(id * 7919 + 13);
  const title = r() < 0.22 ? LONE[Math.floor(r() * LONE.length)] : `${T1[Math.floor(r() * T1.length)]} ${T2[Math.floor(r() * T2.length)]}`;
  return `“${title}” by ${AUTH[Math.floor(r() * AUTH.length)]}`;
}
const PLACES = ['the Isle of Wren', 'the Lantern Coast', 'the Saltmarsh Shires', 'the Bay of Grey Herons', 'the Northern Fells', 'the Harbour of St. Alder'];

/* ——— the lounge ——— */
export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const O = outside(), s = makeState((Date.now() % 100000) + 1);
  let B = null, RM = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false, shownAt = -1;
  const preW = roomW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  // how a pointer's logical x maps into the buffer (set by the blit each frame): bx = x * a + b
  const view = { a: 0.5, b: 0, sx: 0, dx: 0 };
  const timers = new Set();
  const later = (sec, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, sec * 1000); timers.add(id); return id; };
  const cancel = (id) => { if (id) { clearTimeout(id); timers.delete(id); } };
  // a sound a moment from now, which stop() can still call off
  const soon = (sec, fn) => later(sec, () => { if (!isPaused()) fn(); });

  const status = () => setScore(`${RAINS[s.rain]} · lamp ${s.lampOn ? 'on' : 'off'} · the fire crackling`);
  setScore('Click the book, the lamp, the fire, the window, the cat…');
  let hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0, crackleT = 0;
  const say = (text, sec = 3.5) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(status, sec * 1000); };

  const amb = playAmbience({ rain: 1, crackle: 0.6 }, isPaused);
  const stopMusic = playLoungeMusic('reading', isPaused);
  // thunder a few seconds after the far-off flash, soft
  s.onBolt = (b) => later(1.6 + (1 - b.k) * 3 + Math.random(), () => { if (!isPaused()) rumble(0.05 + b.k * 0.05, 3.6); });
  s.onFlip = () => swish(0.012);
  // the mantel clock: a little quarter tune, then the hour struck softly; once it has begun it
  // finishes before it will chime again
  const chime = (hour) => {
    [76, 72, 74, 67].forEach((m, i) => soon(i * 0.55, () => tone(m, { dur: 1.8, vol: 0.03 })));
    const n = ((hour + 11) % 12) + 1;
    for (let k = 0; k < n; k++) soon(2.8 + k * 1.2, () => { tone(55, { dur: 2.4, vol: 0.035 }); tone(67, { dur: 1.6, vol: 0.012 }); });
    s.chimeUntil = s.t + 2.8 + n * 1.2 + 1;
    return n;
  };
  const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  // a light put out or lit again; the patch of room it lights is re-baked over the next frames
  const toggle = (id) => {
    if (s.off.has(id)) s.off.delete(id); else s.off.add(id);
    if (RM) RM.jobs.push(relightGen(RM, id, s.off));
    return !s.off.has(id);
  };
  const snuff = (id, x, y, what) => {
    if (toggle(id)) { tone(88, { dur: 0.35, vol: 0.02 }); say(`The ${what} lit again`); }
    else { drip(0.025, 420, 160); for (let k = 0; k < 6; k++) s.smoke.push({ x, y: y - 2 - k * 3, a: k * 0.15, ph: k }); say(`The ${what} ${what === 'lantern' ? 'blown out' : 'snuffed'}`); }
  };
  const glint = (x, y) => s.glints.push({ x, y, a: 0 });
  const puff = (x, y, n = 8) => { for (let k = 0; k < n; k++) s.puffs.push({ x: x + (Math.random() - 0.5) * 10, y: y - Math.random() * 3, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, a: 0, life: 1.2 + Math.random() * 1.2 }); };
  const mapSay = () => { tone(72, { dur: 0.8, vol: 0.02 }); say(`An old map of ${PLACES[Math.floor(Math.random() * PLACES.length)]}`); };

  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!RM) return;
    const p = pointIn(canvas, e), lay = RM.lay;
    const x = p.x * view.a + view.b - view.dx + view.sx - RM.ox, y = p.y / 2;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const lx = s.lad.x, onDrape = y > 18 && y < FLOOR && ((x >= 94 && x <= drapeEdge(y)) || (x >= 320 - drapeEdge(y) && x <= 226));
    const shelfCandle = RM.geo.flames.find((f) => inR(f.x - 5, f.y - 3, f.x + 6, f.y + 16));
    const libLt = RM.geo.libs.find((lb) => inR(lb.x - 2, 11, lb.x + lb.w + 2, 21));
    const map = RM.geo.maps.find((m) => inR(m.x0, m.y0, m.x1, m.y1));
    if (inR(124, 240, 196, 278)) {
      if (s.flip <= 0) { s.flip = 1; s.lift = 0; swish(0.03); say(`You turn the page — page ${44 + (s.page + 1) * 2}`); }
    } else if (inR(80, 199, 122, 216) || inR(96, 214, 106, 238) || inR(88, 236, 114, 244) || inR(110, 213, 114, 227)) {
      s.lampOn = !s.lampOn; drip(0.03, 2400, 1600); soon(0.02, () => tone(s.lampOn ? 88 : 83, { dur: 0.08, vol: 0.015, type: 'square' }));
      say(`The green lamp ${s.lampOn ? 'on' : 'off'}`);
    } else if (inR(100, 246, 130, 274)) {
      if (s.sip > 0) return;
      if (s.tea > 0) { s.sip = 1; drip(0.045, 520, 260); soon(0.5, () => tone(64, { dur: 0.3, vol: 0.012 })); say(s.tea === 1 ? 'The last sip of tea' : 'A sip of tea, still warm'); }
      else { s.tea = 3; swish(0.025); drip(0.03, 700, 300); say('You pour another cup from the pot'); }
    } else if (inR(216, 240, 254, 266)) {
      if (s.tea < 3) { s.tea = 3; swish(0.025); drip(0.03, 700, 300); say('You pour another cup from the pot'); } else { note(4, { dur: 0.4, vol: 0.02 }); glint(234, 251); say('The teapot is still warm'); }
    } else if (inR(200, 264, 226, 276)) {
      tone(93, { dur: 0.6, vol: 0.015 }); soon(0.08, () => tone(98, { dur: 0.5, vol: 0.01 })); glint(207, 269); later(0.25, () => glint(217, 269)); say('You polish your reading glasses');
    } else if (inR(220, 186, 238, 212)) {
      s.hop = 0.5; s.sand = 1 - s.sand; swish(0.02); soon(0.25, () => tone(76, { dur: 0.3, vol: 0.015 })); say('The hourglass turned over');
    } else if (inR(206, 210, 248, 240)) {
      drip(0.02, 600, 400); puff(228, 213, 10); glint(214, 220); say('A stack of old leather bindings, dusty at the top');
    } else if (inR(256, 176, 296, 238) || inR(238, 202, 253, 240)) {
      s.boost = 1; for (let k = 0; k < 18; k++) s.sparks.push({ x: FX0 + 6 + Math.random() * 24, y: 214 + Math.random() * 10, vx: (Math.random() - 0.5) * 22, vy: -30 - Math.random() * 40, l: 1 + Math.random() * 0.4 });
      amb.set('crackle', 1.3); cancel(crackleT); crackleT = later(2.5, () => { crackleT = 0; amb.set('crackle', 0.6); });
      for (let k = 0; k < 5; k++) drip(0.012 + Math.random() * 0.01, 2600 + Math.random() * 800, 1800);
      tone(40, { dur: 0.3, vol: 0.02, type: 'triangle' });
      say('You poke the fire — sparks fly up');
    } else if (inR(262, 106, 292, 150)) {
      if (s.t < s.chimeUntil) say('The clock is still chiming', 2.5);
      else { const n = chime(new Date().getHours()); say(`The clock chimes ${NUM[n]}`, 4 + n * 1.2); }
    } else if (inR(292, 126, 310, 150)) {
      s.gv = 0.9 + Math.random() * 0.6; swish(0.02); say('The little globe spins');
    } else if (inR(235, 112, 247, 150) || inR(308, 114, 320, 150)) {
      const i = x < 280 ? 0 : 1; snuff('c' + i, CANDLES[i][0], CANDLES[i][1], 'candle');
    } else if (inR(244, 50, 308, 114)) {
      mapSay(); glint(250, 60);
    } else if (inR(258, 226, 312, 262)) {
      if (s.cat <= 0) { s.cat = 3.6; for (let k = 0; k < 6; k++) soon(0.4 + k * 0.2, () => tone(38 + (k % 2), { dur: 0.25, vol: 0.025, type: 'triangle' })); soon(2.1, () => note(7, { dur: 0.6, vol: 0.02 })); }
      say('The cat stretches, yawns, and curls up again');
    } else if (x < 64 && y > 248 + Math.max(0, 38 - x) * 0.5) {
      tone(41, { dur: 0.5, vol: 0.02, type: 'triangle' }); soon(0.12, () => tone(38, { dur: 0.6, vol: 0.015, type: 'triangle' })); say('You settle deeper into your chair');
    } else if (inR(116, 170, 146, 210)) {
      s.fernKick = 1.6; swish(0.025); say('The fern on the sill sways');
    } else if (shelfCandle) {
      snuff(shelfCandle.id, shelfCandle.x, shelfCandle.y, 'candle');
    } else if (libLt) {
      const on = toggle(libLt.id); drip(0.025, 2200, 1500); say(on ? 'The library light on' : 'The library light off');
    } else if (Math.abs(x - lx) <= 11 && y >= RAILY - 3 && y <= 250 && x < 92 && x > lay.ladLo - 12) {
      const lo = lay.ladLo, hi = 80;
      let to = lo + Math.random() * (hi - lo);
      if (Math.abs(to - lx) < 24) to = lx + (lx > (lo + hi) / 2 ? -1 : 1) * (24 + Math.random() * 20);
      s.lad.to = clamp(to, lo, hi);
      for (let k = 0; k < 4; k++) soon(k * 0.16, () => tone(45 + (k % 2), { dur: 0.18, vol: 0.012, type: 'triangle' }));
      swish(0.02); say('The ladder rolls along its rail');
    } else if (onDrape) {
      const i = x < 160 ? 0 : 1; s.tassel[i] = 1; swish(0.03); say('The heavy velvet sways; its tassel swings');
    } else if (lay.wins.some((W) => inWin(W, Math.floor(x), Math.floor(y)))) {
      s.rain = (s.rain + 2) % 3;
      amb.set('rain', RLV[s.rain]);
      note(s.rain === 0 ? 11 : s.rain === 1 ? 9 : 7, { dur: 1.2, vol: 0.035 });
      say(s.rain === 2 ? 'The rain comes down harder' : s.rain === 1 ? 'The rain softens' : 'The rain stops; the moon comes through');
    } else if (lay.nook && inR(-27, 176, -15, 198)) {
      snuff('nook', NLAMP[0], NLAMP[1], 'lantern');
    } else if (lay.nook && inR(-88, 180, -10, 208)) {
      swish(0.02); puff(-60, 197, 8); say('The window seat, with a blanket and a book left open');
    } else if (lay.lamp && inR(lay.lamp.x0, 116, lay.lamp.x1, 246)) {
      const on = toggle('stand'); drip(0.03, 2400, 1600); say(on ? 'The standing lamp on' : 'The standing lamp off');
    } else if (lay.globe && sq(x - lay.globe.x0 - 18, y - 198) < 16) {
      s.gv2 = 0.7 + Math.random() * 0.5; swish(0.03); say('The old globe turns');
    } else if (lay.fern && inR(lay.fern.x0, 156, lay.fern.x1, 200)) {
      s.fern2Kick = 1.8; swish(0.03); say('The fern sways on its stand');
    } else if (lay.desk && inR(382, 164, 393, 188)) {
      snuff('desk', DESKC[0], DESKC[1], 'desk candle');
    } else if (lay.desk && inR(346, 176, 390, 216)) {
      if (s.write.t <= 0) {
        if (s.write.lines >= 4) { s.write.lines = 0; swish(0.03); say('A fresh sheet of paper'); }
        else { s.write.t = 1.6; for (let k = 0; k < 6; k++) later(k * 0.25, () => swish(0.008)); drip(0.015, 900, 600); say('The quill scratches out a line'); }
      }
    } else if (lay.desk && inR(332, 186, 394, 246)) {
      swish(0.02); puff(338, 205, 5); say('A bundle of old letters, tied with string');
    } else if (map) {
      mapSay(); glint(map.x0 + 2, map.y0 + 1);
    } else {
      const b = RM.geo.books.find((bk) => x >= bk.x && x < bk.x + bk.w && y >= bk.y && y < bk.y + bk.h);
      if (!b || s.pulls.some((p) => p.b === b)) return;
      // a book already out goes back as the next comes out
      for (const p of s.pulls) if (p.t < 3.3) p.t = 3.3;
      s.pulls.push({ b, t: 0, dir: Math.random() < 0.5 ? -1 : 1 });
      swish(0.02); tone(47, { dur: 0.2, vol: 0.012, type: 'triangle' }); say(bookTitle(b.id), 4);
    }
  };
  canvas.addEventListener('pointerdown', onDown);

  // a new frame shape: rebuild the room only once the width has held for a moment, a little each
  // frame, showing the old room (centred, cropped or with dark edges) until the new one is ready.
  // The first room is built the same way behind a dark fade; once settled, the full-screen shape
  // is built ahead in small slices, so going full screen is instant.
  const settleRoom = (bw) => {
    const want = roomW(bw), now = performance.now();
    if (!RM) {
      if (!job || jobW !== want) { job = buildRoom(want, s.off); jobW = want; }
      const done = pump(job, 5);
      if (done) { RM = done; job = null; jobW = 0; shownAt = s.t; syncLights(RM, s.off); }
    } else if (RM.bw !== want) {
      const cached = ROOMS.get(want);
      if (cached) { RM = cached; syncLights(RM, s.off); }
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildRoom(want, s.off); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && !ROOMS.has(preW)) { job = buildRoom(preW, s.off); jobW = preW; preTried = true; }
    }
    if (job && RM) {
      const done = pump(job, jobW === want ? 5 : 3);
      if (done) { job = null; jobW = 0; if (done.bw === want) { RM = done; syncLights(RM, s.off); } }
    }
    // a light put out or lit: its patch of the room re-baked, a slice a frame
    if (RM && RM.jobs.length && pump(RM.jobs[0], 3)) RM.jobs.shift();
    if (RM && (!B || B.buf.width !== RM.bw)) B = makeBuffers(RM.bw);
  };

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, pw = canvas.width, ph = canvas.height;
    // whole steps: when the canvas is a whole multiple of the buffer's height, the buffer is made
    // as wide as the canvas needs at that step (the last part of a pixel is cropped), so the blit
    // never resamples; otherwise the room is blown up by whole steps and the last bit smoothed
    const exact = ph % H === 0, k = exact ? ph / H : Math.max(1, Math.ceil(ph / H));
    const bw = Math.max(320, exact ? Math.ceil(pw / k) : Math.round((320 * W) / 640));
    update(s, dt);
    settleRoom(bw);
    if (!RM) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = SIDE; ctx.fillRect(0, 0, pw, ph); ctx.restore(); return; }
    // a ladder left out of sight comes back along its rail
    if (s.lad.to < RM.lay.ladLo) s.lad.to = Math.min(80, RM.lay.ladLo + Math.random() * 20);
    const now = new Date();
    // the clock strikes the hour by itself
    if (now.getMinutes() === 0 && s.clock.min !== 0 && s.t > 2 && s.t >= s.chimeUntil) { const n = chime(now.getHours()); say(`The clock strikes ${NUM[n]}`, 4 + n * 1.2); }
    s.clock.min = now.getMinutes();
    render(B.g, B.pc, RM, O, s, now);
    // the first room fades up out of the dark
    const fade = 1 - clamp((s.t - shownAt) / 0.4, 0, 1);
    if (fade > 0) { B.g.globalAlpha = fade; B.g.fillStyle = SIDE; B.g.fillRect(0, 0, RM.bw, H); B.g.globalAlpha = 1; }
    view.sx = Math.max(0, (RM.bw - bw) >> 1); view.dx = Math.max(0, (bw - RM.bw) >> 1);
    const sw = Math.min(bw, RM.bw);
    if (exact) {
      const offX = -((bw * k - pw) >> 1);
      view.a = pw / (W * k); view.b = -offX / k;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
      if (view.dx) { ctx.fillStyle = SIDE; ctx.fillRect(0, 0, pw, ph); }
      ctx.drawImage(B.buf, view.sx, 0, sw, H, offX + view.dx * k, 0, sw * k, H * k);
      ctx.restore();
    } else {
      view.a = bw / W; view.b = 0;
      if (!up || up.width !== bw * k || up.height !== H * k) { up = document.createElement('canvas'); up.width = bw * k; up.height = H * k; upg = up.getContext('2d'); }
      upg.imageSmoothingEnabled = false;
      if (view.dx) { upg.fillStyle = SIDE; upg.fillRect(0, 0, up.width, up.height); }
      upg.drawImage(B.buf, view.sx, 0, sw, H, view.dx * k, 0, sw * k, H * k);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(up, 0, 0, W, 640);
    }
  }, isPaused);

  return () => {
    clearTimeout(hint);
    clearTimeout(msgT);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    s.onBolt = null; s.onFlip = null;
    stopLoop();
    stopMusic();
    amb.stop();
    canvas.removeEventListener('pointerdown', onDown);
  };
}
