// Night Room — a lounge, not a game: the view from your chair at a desk by a big window, late.
// Pixel art, drawn into a small buffer (320 px tall, as wide as the frame's shape) and scaled up
// by whole steps with no smoothing, so every pixel stays square and crisp; only when the frame
// isn't a whole multiple of 320 tall is the last little step taken with a high-quality filter.
// Outside, a rainy city in layers: far towers in the haze, lit windows, rooftop tanks and
// antennas, neon signs, an elevated train that passes now and then, and the street below —
// shops, cars, umbrellas, puddles holding the neon. Inside, fairy lights on the curtain rail, a
// desk lamp, a lava lamp, a monitor, a keyboard glowing pink to cyan, a record turning, a mug
// steaming and the cat asleep on the sill. In full screen the room goes on: the bed and a
// nightstand with a salt lamp on the left; a shelf, a neon moon, a monstera, a standing lamp, a
// guitar and a crate of records on the right.
// Light: every still surface is painted once in its daylight colours; then each pixel takes its
// colour from a short ramp made for that colour (shadow violet, night blue, window teal, lamp
// amber), stepped by how much cool light (the city, the screen) and warm light (lamps, candles)
// reaches it. Inside a step the colour is flat; only where two steps meet is there a narrow band
// of ordered dither. The room is baked once per frame shape and lamp state; each frame only the
// moving things are drawn over it.

import { setupCanvas, runLoop, pointIn, note, tone, drip, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'room', title: 'Night Room', blurb: 'A desk by a rainy window above the city, late. A lava lamp, a record, a sleeping cat.', keys: 'Click the lamp, screen, window, curtains, cat, record…', lounge: true };

const H = 320;                                   // buffer height; the core composition is 320 wide
const GX = 72, GY = 20, GW = 176, GH = 148;      // the window glass, in core pixels
const DESK = 206;                                // where the desk top meets the wall
const PANES = [[0, 0, 86, 46], [90, 0, 86, 46], [0, 50, 86, 98], [90, 50, 86, 98]];
const SCR = { x: 121, y: 143, w: 78, h: 46 };    // the monitor's screen
const TIE = 124;                                 // the curtains' tie-backs
const FL_X = 424;                                // the standing lamp, right of the desk (full screen)
const STEP = 16;                                 // room widths round up to this, so a resize doesn't rebuild every frame
const SIDE = '#191c31';                          // the edges, for the moment a wider room is still being built
const WEATHERS = ['rain', 'snow', 'clear'];
const WTXT = { rain: 'Rain on the window', snow: 'Snow falling', clear: 'A clear night' };

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
// a stepped level: flat inside each step, a narrow band of ordered dither where two steps meet
const band = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.36 ? i : f > 0.64 ? i + 1 : bay(x, y) < (f - 0.36) / 0.28 ? i + 1 : i; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.round(a * 1000) / 1000})`;
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);

const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
  ':': '000010000010000', '.': '000000000000010',
  A: '010101111101101', B: '110101110101110', E: '111100110100111', F: '111100110100100', H: '101101111101101',
  I: '111010010010111', L: '100100100100111', O: '111101101101111', R: '110101110101101', T: '111010010010010',
};

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
    const na = Math.round(oa * 255);   // 253 and 254 are flags (see bakeOne), never a blend's result
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 253 ? 255 : na;
  }
  tint(x, y, c, a) { const i = this.at(x, y); if (i >= 0 && this.d[i + 3]) this.px(x, y, c, a); }
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
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
  text(str, x, y, c, vert = false) {
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') this.px(x + (k % 3), y + Math.floor(k / 3), c);
      if (vert) y += 6; else x += 4;
    }
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
    const a = band((1 - d) ** 2 * k * lv, x, y) / lv;
    if (a > 0) R.px(x, y, c, Math.min(1, a));
  }
  return R.canvas();
}

/* ——— light: colour ramps ———
   For each painted colour, fourteen lit versions: seven on the cool side (deep violet shadow up
   to window-lit teal-grey) and seven on the warm side (dusky rose up to lamp amber). A pixel's
   step comes from the total light on it, its side from how much of that light is warm. */
const CT = [   // intensity, × r g b, + r g b
  [0.19, 0.70, 0.72, 1.22, 10, 7, 26], [0.28, 0.74, 0.79, 1.19, 8, 7, 22], [0.38, 0.78, 0.86, 1.16, 6, 6, 16],
  [0.50, 0.82, 0.93, 1.12, 4, 5, 10], [0.63, 0.86, 0.99, 1.10, 2, 4, 6], [0.77, 0.91, 1.02, 1.07, 0, 2, 2], [0.92, 0.96, 1.03, 1.04, 0, 0, 0],
];
const WT = [
  [0.22, 0.90, 0.74, 1.06, 12, 6, 20], [0.32, 1.00, 0.80, 0.98, 10, 5, 14], [0.44, 1.08, 0.85, 0.88, 8, 4, 8],
  [0.57, 1.13, 0.87, 0.81, 6, 3, 2], [0.72, 1.17, 0.89, 0.77, 6, 3, 0], [0.88, 1.21, 0.93, 0.75, 8, 4, 0], [1.04, 1.24, 0.98, 0.76, 12, 7, 2],
];
const RAMPS = new Map();
function rampOf(c) {
  let rp = RAMPS.get(c);
  if (rp) return rp;
  rp = new Int32Array(14);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  [CT, WT].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(c, rp);
  return rp;
}

// the light reaching a point of the room (core coordinates), in four parts
function coolAt(cx, cy, rw) {   // the night, the city through the window, the screen
  let v = 0.3;
  const dx = cx < GX ? GX - cx : cx > GX + GW ? cx - GX - GW : 0;
  const dy = cy < GY ? GY - cy : cy > GY + GH ? cy - GY - GH : 0;
  v += Math.max(0, 1 - sq(dx, dy * 0.9) / 90) ** 2 * 0.5;
  v += Math.max(0, 1 - sq((cx - 160) / 1.5, cy - 238) / 100) ** 1.5 * (cy > 196 ? 0.5 : 0.18);
  const vx = (cx - 160) / (rw / 2 + 90), vy = (cy - 150) / 270;
  return v * (1 - Math.min(0.36, (vx * vx + vy * vy) * 0.6));
}
function warmAt(cx, cy, wide) {  // always on: the candle, the fairy lights; in full screen the shelf strip, the salt lamp, the wall lamp
  let v = Math.max(0, 1 - sq(cx - 238, (cy - 212) * 1.1) / 80) ** 1.7 * 0.5;
  v += Math.max(0, 1 - Math.abs(cy - 13) / 44) ** 2 * 0.3;
  if (wide) {
    const sx = cx < 324 ? 324 - cx : cx > 370 ? cx - 370 : 0, sy = cy - 105;
    v += sy < -2 ? 0 : Math.max(0, 1 - sq(sx * 1.3, sy * 1.1) / 34) ** 1.5 * 0.36;
    v += Math.max(0, 1 - sq(cx + 106, (cy - 232) * (cy < 198 ? 2 : 1.15)) / 72) ** 1.5 * 0.5;   // the wall lamp over the bed
    v += Math.max(0, 1 - sq(cx + 50, (cy - 216) * 1.1) / 66) ** 1.5 * 0.5;
  }
  return v;
}
function lampAt(cx, cy) {        // the desk lamp
  let i;
  if (cy >= DESK) i = Math.max(0, 1 - sq((cx - 62) / 1.8, cy - 242) / 76) ** 1.1 * 1.25;
  else i = Math.max(0, 1 - sq((cx - 54) * 1.1, (cy - 178) * 1.2) / 92) ** 1.8 * 0.62;
  return i + Math.max(0, 1 - sq(cx - 70, cy - 220) / 220) ** 2 * 0.16;
}
function floorAt(cx, cy) {       // the standing lamp
  const shade = Math.max(0, 1 - sq(cx - FL_X, (cy - 84) * 0.85) / 86) ** 1.7 * 0.8;
  const pool = cy > 200 ? Math.max(0, 1 - sq((cx - FL_X) / 1.7, cy - 276) / 70) ** 1.3 * 0.6 : 0;
  return shade + pool;
}

// one lit version of a painted raster: l = desk lamp on, f = standing lamp on.
// alpha 254 glows by itself; alpha 253 is the desk lamp's own shade, lit evenly by its spill
function bakeOne(src, x0, y0, F, l, f) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length), rw = F.rw;
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.3, warm = 0;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) {
        const j = Y * rw + X;
        cool = F.C[j]; warm = F.W[j] + l * (al === 253 ? 0.35 : F.L[j]) + (F.F ? f * F.F[j] : 0);
      }
      const tot = cool + warm, lv = Math.min(6, band(Math.min(6, Math.max(0, (tot - 0.1) / 0.15)), X, Y));
      const wf = warm / tot, side = wf > 0.42 ? 7 : wf < 0.3 ? 0 : bay(X + 2, Y + 1) < (wf - 0.3) / 0.12 ? 7 : 0;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c); }
      const o = rp[side + lv];
      out[i] = o >> 16; out[i + 1] = (o >> 8) & 255; out[i + 2] = o & 255; out[i + 3] = al >= 253 ? 255 : al;
    }
  }
  return toCanvas(out, w, h);
}
// the lit colour of one painted colour at one point, for the few things drawn over the bake
function litHex(RM, cx, cy, c, k) {
  const F = RM.F, X = Math.max(0, Math.min(RM.bw - 1, cx + RM.ox)), j = cy * RM.bw + X;
  const cool = F.C[j], warm = F.W[j] + (k & 1 ? F.L[j] : 0) + (F.F && k & 2 ? F.F[j] : 0), tot = cool + warm;
  return hex(rampOf(c)[(warm / tot > 0.36 ? 7 : 0) + Math.min(6, Math.round(Math.max(0, (tot - 0.1) / 0.15)))]);
}

/* ——— outside: sky, clouds and the city, in layers ——— */
const SKY = {
  rain: [0x090d1f, 0x0c132a, 0x101a34, 0x15223f, 0x1b2c4b, 0x233656, 0x2f3e5e, 0x45465f, 0x5e4c5e],
  snow: [0x161d33, 0x1b253d, 0x212d47, 0x283652, 0x31405b, 0x3b4964, 0x48536c, 0x5a5c72, 0x6e6476],
  clear: [0x03051a, 0x050920, 0x080f28, 0x0b1531, 0x0f1c3b, 0x142545, 0x1c2f50, 0x2b3858, 0x463e5c],
};
function cloudStrip(seed, n, cols, k, density) {
  const w = 320, h = 64, r = rng(seed), m = new Float32Array(w * h), R = new Ras(w, h);
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = 12 + r() * 34, rad = 6 + r() * 15, st = 1.6 + r() * 1.4;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad * st); x <= cx + rad * st; x++) {
      if (y < 0 || y >= h) continue;
      const d = sq((x - cx) / st, y - cy) / rad;
      if (d < 1) m[y * w + (((x % w) + w) % w)] += (1 - d) * density;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = m[y * w + x];
    if (v < 0.25 || (v < 0.5 && bay(x, y) > (v - 0.25) / 0.25)) continue;
    const t = Math.min(1, Math.max(0, (y / h) * 0.9 + (0.6 - Math.min(v, 1.2) * 0.5)));
    const ci = t * (cols.length - 1), i0 = Math.floor(ci);
    R.px(x, y, ci - i0 > bay(x + 1, y) ? cols[Math.min(cols.length - 1, i0 + 1)] : cols[i0], k);
  }
  return R.canvas();
}

function waterTank(R, tx, top, snow) {
  R.line(tx + 1, top - 1, tx + 1, top - 3, 0x2a3048); R.line(tx + 5, top - 1, tx + 5, top - 3, 0x2a3048);
  R.rect(tx + 1, top - 2, 5, 1, 0x232a40);
  R.rect(tx, top - 10, 7, 7, 0x2b2a3c); R.rect(tx, top - 10, 1, 7, 0x3f3b55);
  R.rect(tx, top - 8, 7, 1, 0x3a374c); R.rect(tx, top - 5, 7, 1, 0x3a374c);
  R.rect(tx + 1, top - 11, 5, 1, 0x302e42); R.rect(tx + 2, top - 12, 3, 1, 0x302e42); R.px(tx + 3, top - 13, 0x302e42);
  if (snow) { R.rect(tx + 1, top - 11, 5, 1, 0xc8d2e4); R.rect(tx + 2, top - 12, 3, 1, 0xe2e9f4); R.px(tx + 3, top - 13, 0xe2e9f4); }
}

// the street under the elevated track: a row of little shops, the pavement, the wet road
const SHOPS = [[24, 45, 0xd8f4ff, 'konbini'], [46, 60, 0xffb450, 'ramen'], [61, 77, 0x3a4660, 'shutter'], [78, 96, 0xffc070, 'cafe'], [97, 112, 0x9ae8f0, 'laundry'], [113, 125, 0x101622, 'alley'], [126, 152, 0xff7ab8, 'flowers']];
function paintStreet(R, snow) {
  R.rect(0, 102, GW, 13, 0x0e1424);
  for (const [x0, x1, c, kind] of SHOPS) {
    const w = x1 - x0;
    if (kind === 'konbini') {
      R.rect(x0, 103, w, 1, 0x3a6ad8); R.rect(x0, 104, w, 1, 0xff9a40); R.rect(x0, 105, w, 4, c);
      for (let x = x0 + 1; x < x1 - 5; x += 3) { R.px(x, 106, 0x8ab0c8); R.px(x + 1, 106, 0xe0a0b0); R.px(x, 108, 0x9ac0d4); }
      R.rect(x1 - 5, 105, 3, 4, 0xa8d8e8); R.px(x1 - 4, 106, 0x6a8aa0);
    } else if (kind === 'ramen') {
      R.rect(x0, 103, w, 6, 0x2a1418); R.rect(x0 + 3, 103, w - 6, 1, 0xffe0b0); R.rect(x0 + 2, 105, w - 4, 4, c);
      for (let x = x0 + 2; x < x1 - 2; x++) { R.px(x, 105, x % 3 ? 0x9a2a3a : 0xffd0a0); if (x % 3) R.px(x, 106, 0x8a2232); }
      R.rect(x0, 104, 2, 3, 0xff5a40); R.px(x0, 105, 0xffd0a0); R.px(x0 + 1, 107, 0x8a2a20);
    } else if (kind === 'shutter') {
      for (let y = 103; y < 109; y++) R.rect(x0, y, w, 1, y % 2 ? 0x2a3448 : 0x34405a);
      for (let x = x0 + 2; x < x0 + 9; x++) if ((x * 5) % 7 < 3) R.px(x, 105 + (x % 2), 0xc05a8a);   // a bit of paint
      R.rect(x1 - 4, 103, 3, 6, 0xe8f8ff); R.px(x1 - 4, 104, 0xff6a6a); R.px(x1 - 3, 104, 0x6ab0ff); R.px(x1 - 2, 104, 0xffd060); R.rect(x1 - 4, 107, 3, 1, 0x7a9ab0);
    } else if (kind === 'cafe') {
      R.rect(x0, 103, w, 6, 0x2a1e1a); R.rect(x0 + 1, 103, w - 2, 1, 0x6a4a3a);
      R.rect(x0 + 2, 104, w - 4, 5, c); R.rect(x0 + 2, 104, w - 4, 1, 0xffe0a8);
      for (const k of [5, 9, 14]) { R.px(x0 + k, 106, 0x3a2418); R.px(x0 + k, 107, 0x3a2418); R.px(x0 + k + 1, 107, 0x4a3020); }
      R.px(x0 + 3, 107, 0x4a8a4a); R.px(x0 + 3, 106, 0x5aa05a);
    } else if (kind === 'laundry') {
      R.rect(x0, 103, w, 6, 0x1a2632); R.rect(x0 + 1, 104, w - 2, 5, c);
      for (let x = x0 + 2; x < x1 - 2; x += 4) { R.rect(x, 106, 2, 2, 0x3a6a78); R.px(x, 106, 0xd0f8ff); }
    } else if (kind === 'alley') {
      R.rect(x0, 103, w, 6, c); R.px(x0 + 4, 104, 0xffd890); R.px(x0 + 4, 105, 0x6a5a40);
      R.px(x0 + 7, 108, 0x2a3048); R.px(x0 + 8, 108, 0x2a3048); R.px(x0 + 8, 107, 0x3a4058);
    } else {
      R.rect(x0, 103, w, 6, 0x241a2a); R.rect(x0 + 2, 103, w - 4, 1, 0xffc0e0);
      R.rect(x0 + 1, 104, w - 2, 5, c);
      for (let x = x0 + 2; x < x1 - 2; x += 2) R.px(x, 108, [0xffe060, 0xffffff, 0xff5a7a, 0xb08aff, 0x7ae0ff][(x * 3) % 5]);
      R.px(x0 + 6, 106, 0x6a2a4a); R.px(x0 + 6, 107, 0x6a2a4a);
    }
  }
  // pavement, road, kerb and a crossing, all wet
  R.rect(0, 109, GW, 1, snow ? 0xb8c4d8 : 0x30384e);
  R.rect(0, 110, GW, 4, 0x141a2a);
  for (let x = 0; x < GW; x++) if (x % 7 < 3) R.px(x, 112, 0x3a4260);
  R.rect(0, 114, GW, 1, snow ? 0xc8d2e4 : 0x2a3248);
  R.rect(0, 115, GW, GH - 115, 0x121828);
  for (let y = 116; y < 123; y++) for (let x = 60; x < 92; x++) if ((x - 60) % 5 < 3) R.px(x, y, snow ? 0x9aa6c0 : 0x5a6280);
  // the shop lights, smeared in the wet road
  for (const [x0, x1, c, kind] of SHOPS) {
    if (kind === 'shutter' || kind === 'alley') continue;
    R.rect(x0 + 1, 109, x1 - x0 - 2, 1, mixc(c, 0x30384e, 0.45));
    [0.5, 0.36, 0.24, 0.14].forEach((a, k) => { for (let x = x0 + 1; x < x1 - 1; x++) if (bay(x, 110 + k) < a) R.px(x, 110 + k, mixc(c, 0x141a2a, 0.4 + k * 0.1)); });
  }
}

function paintCity(snow, geo) {
  const r = rng(97);
  const back = new Ras(GW, GH), front = new Ras(GW, GH);
  const cap = (R, x, y, w, far) => { if (snow) for (let i = 0; i < w; i++) R.px(x + i, y, far ? 0x7d8cab : i % 6 === 4 ? 0xb4c0d6 : 0xe2e9f4); };
  const pick = (a) => a[Math.floor(r() * a.length)];
  const WARMW = [0xffb35c, 0xffc878, 0xffdc9c, 0xf29a52, 0xffcf8a, 0xe8a070], COOL = [0x8fdcef, 0xc4f0ff, 0x9ec8ff];
  const lit = () => { const q = r(), a = pick(WARMW), b = pick(COOL); return q < 0.74 ? a : q < 0.95 ? b : 0xff9ccc; };
  // a lit window: some with a blind half down, a curtain, someone standing at it
  const cell = (R, wx, wy, ww, on, c, off, d) => {
    if (!on) { R.rect(wx, wy, ww, 2, off); return; }
    R.rect(wx, wy, ww, 2, c);
    if (ww >= 2) {
      if (d < 0.22) R.rect(wx, wy, ww, 1, mixc(c, 0x1a1420, 0.45));
      else if (d < 0.36) R.px(wx + (ww > 2 ? 1 : 0), wy + 1, mixc(c, 0x140e14, 0.72));
      else if (d < 0.5) R.px(wx + ww - 1, wy, mixc(c, 0x2a1a18, 0.5));
      else if (d < 0.6) R.rect(wx, wy + 1, ww, 1, mixc(c, 0xffffff, 0.22));
    } else if (d < 0.3) R.px(wx, wy, mixc(c, 0x1a1420, 0.4));
  };

  // far towers, soft in the haze
  for (let x = -2; x < GW + 2;) {
    const w = 6 + Math.floor(r() * 11), top = 44 + Math.floor(r() * 28);
    back.rect(x, top, w, GH - top, 0x1c2a47);
    back.rect(x, top, w, 1, 0x293b5e);
    for (let wy = top + 3; wy < GH; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) { const q = r(); if (q < 0.11) back.px(wx, wy, q < 0.035 ? 0xb88e5e : 0x56709a); }
    cap(back, x, top - 1, w, true);
    x += w + (r() < 0.3 ? 1 : 0);
  }
  // two landmarks: a tall tower with a stepped crown and a mast, and a slim spire
  back.rect(124, 22, 9, GH - 22, 0x1e2d4c); back.rect(125, 18, 7, 4, 0x1e2d4c); back.rect(127, 14, 3, 4, 0x223252);
  back.line(128, 4, 128, 13, 0x3a4a6a); back.px(127, 8, 0x3a4a6a); back.px(129, 8, 0x3a4a6a);
  for (let wy = 24; wy < GH; wy += 2) for (const wx of [126, 128, 130]) if (r() < 0.32) back.px(wx, wy, 0x6a84b0);
  back.rect(18, 32, 10, GH - 32, 0x1b2946); back.rect(20, 27, 6, 5, 0x1b2946); back.rect(22, 18, 2, 9, 0x22324f); back.px(22, 14, 0x3a4a6a); back.px(22, 15, 0x3a4a6a);
  for (let wy = 34; wy < GH; wy += 3) for (const wx of [20, 23, 26]) if (r() < 0.2) back.px(wx, wy, 0x8a7a64);
  cap(back, 124, 21, 9, true); cap(back, 125, 17, 7, true);
  if (geo) geo.blinkers.push({ x: 128, y: 3, p: 0 }, { x: 22, y: 13, p: 1.1 });
  for (let y = 12; y < GH; y++) { const a = Math.round((0.08 + 0.3 * ((y - 12) / (GH - 12))) * 20) / 20; for (let x = 0; x < GW; x++) back.tint(x, y, 0x2c3e64, a); }

  // the middle distance: blocks of separate lit windows, tanks and antennas on the roofs
  const MID = [0x111a31, 0x141e38, 0x0f182c, 0x172240];
  for (let x = -3; x < GW + 3;) {
    const w = 10 + Math.floor(r() * 15), top = 58 + Math.floor(r() * 36), col = pick(MID);
    const off = mixc(col, 0x2a3a5c, 0.28);
    back.rect(x, top, w, GH - top, col);
    back.rect(x, top, 1, GH - top, mixc(col, 0x3a4c70, 0.45));
    back.rect(x + w - 2, top + 1, 2, GH - top - 1, mixc(col, 0x000000, 0.3));
    back.rect(x, top, w, 1, 0x27355a);
    cap(back, x, top - 1, w, false);
    const style = Math.floor(r() * 3), busy = r();
    const ww = style + 1, sx = ww + 2, sy = style === 2 ? 3 : 4;
    for (let wy = top + 3; wy < GH - 2; wy += sy) for (let wx = x + 2; wx + ww <= x + w - 2; wx += sx) {
      const on = r() < 0.16 + busy * 0.32, c = lit(), d = r();
      cell(back, wx, wy, ww, on, c, off, d);
      if (on && geo) geo.wins.push({ x: wx, y: wy, w: ww, h: 2, on: c, off });
    }
    if (geo) geo.roofs.push([x, x + w - 1, top]);
    const qt = r(), tx = x + 1 + Math.floor(r() * Math.max(1, w - 9)), qa = r(), ax = x + w - 3 - Math.floor(r() * 3), ah = 4 + Math.floor(r() * 9), qb = r(), qc = r();
    if (w >= 11 && qt < 0.5) waterTank(back, tx, top, snow);
    if (qa < 0.55) {
      back.line(ax, top - 1, ax, top - ah, 0x3a4664); back.px(ax - 1, top - ah + 2, 0x3a4664); back.px(ax + 1, top - ah + 2, 0x3a4664);
      if (geo && qb < 0.6) geo.blinkers.push({ x: ax, y: top - ah - 1, p: qb * 5 });
    }
    if (qc < 0.4) { back.rect(x + 2, top - 2, 3, 2, 0x2b3757); back.px(x + 3, top - 2, 0x3c4a6c); }
    x += w + (r() < 0.4 ? 1 + Math.floor(r() * 2) : 0);
  }
  // a rooftop billboard on its posts: a crescent moon on a dusk sky
  back.rect(86, 70, 1, 9, 0x1a2032); back.rect(102, 70, 1, 9, 0x1a2032); back.rect(86, 74, 17, 1, 0x1a2032);
  back.rect(83, 58, 23, 12, 0x14141e);
  back.vgrad(84, 59, 21, 10, [0x3a2a6a, 0x6a2e7a, 0xa8407e, 0xe0607a], 1);
  back.ell(91, 63, 3, 3, 0xfff0d0); back.ell(92, 62, 2, 2, 0x5a2e78);
  back.rect(97, 62, 6, 1, 0xffe0f0); back.rect(97, 64, 4, 1, 0xf0b0d0);
  if (geo) geo.bill = [83, 58, 23, 12];
  // the elevated track, the street's glow, the street itself, then the track's pillars and lamps
  back.rect(0, 97, GW, 1, 0x56648a);
  back.rect(0, 98, GW, 3, 0x131b2d);
  for (let i = 1; i < GW; i += 4) back.px(i, 99, 0x26324e);
  back.rect(0, 101, GW, 1, 0x0b111e);
  paintStreet(back, snow);
  for (let y = 100; y < GH; y++) { const a = Math.round(((y - 100) / (GH - 100)) ** 1.5 * 0.6 * 20) / 20; for (let x = 0; x < GW; x++) back.tint(x, y, 0xff9550, a); }
  for (let px = 5; px < GW; px += 34) { back.rect(px, 102, 3, GH - 102, 0x0f1628); back.rect(px - 1, 102, 5, 1, 0x182238); back.rect(px, 109, 3, 1, 0x1a2236); }
  for (let lx = 11; lx < GW; lx += 17) { back.px(lx, 102, 0xffc070); if (geo) geo.lamps.push([lx, 102]); }
  cap(back, 0, 96, GW, false);

  // near blocks: big windows, a fire escape, a tank against the sky
  const NEAR = 0x0a1122;
  const nearWin = (x, y, q, c, d) => {
    front.rect(x - 1, y - 1, 5, 6, 0x0e1630);
    if (q < 0.45) {
      front.rect(x, y, 3, 4, c);
      front.rect(x, y, 3, 1, mixc(c, 0xffffff, 0.3));
      if (d < 0.3) { front.rect(x, y + 1, 3, 1, mixc(c, 0x000000, 0.35)); front.rect(x, y + 3, 3, 1, mixc(c, 0x000000, 0.35)); }
      else if (d < 0.55) { front.px(x, y + 3, 0x2e5a34); front.px(x + 1, y + 2, 0x3a6a3e); front.px(x, y + 2, 0x2e5a34); }
      else if (d < 0.7) { front.px(x + 2, y + 1, 0x2a2026); front.px(x + 2, y + 2, 0x2a2026); front.px(x + 2, y + 3, 0x2a2026); }
      if (geo && d > 0.85) geo.tvs.push([x, y]);
    } else { front.rect(x, y, 3, 4, 0x111a30); front.px(x, y, 0x1d2946); }
    front.rect(x, y + 4, 3, 1, 0x1a2640);
  };
  front.rect(0, 72, 26, GH - 72, NEAR);
  front.rect(25, 72, 1, GH - 72, 0x1d4458);
  front.rect(0, 72, 26, 1, 0x1c2640);
  cap(front, 0, 71, 26, false);
  for (let wy = 77; wy < GH - 4; wy += 8) for (let wx = 3; wx < 22; wx += 6) { const q = r(), c = lit(), d = r(); nearWin(wx, wy, q, c, d); }
  for (const py of [88, 104, 120, 136]) {
    front.rect(1, py, 23, 1, 0x2a3552);
    for (let k = 1; k < 24; k += 2) front.px(k, py - 2, 0x222c46);
    front.rect(1, py - 3, 23, 1, 0x222c46);
    front.line(5, py + 1, 19, py + 15, 0x1e2740);
  }
  front.rect(6, 63, 11, 9, 0x1e1e2c); front.rect(6, 63, 1, 9, 0x2e2c40); front.rect(6, 66, 11, 1, 0x2a2a3a); front.rect(6, 69, 11, 1, 0x2a2a3a);
  front.rect(7, 62, 9, 1, 0x24243a); front.rect(9, 61, 5, 1, 0x24243a); front.px(11, 60, 0x24243a);
  if (snow) { front.rect(7, 62, 9, 1, 0xd8e0ee); front.rect(9, 61, 5, 1, 0xe2e9f4); front.px(11, 60, 0xe2e9f4); }
  // the right-hand block, tall, with a mast
  front.rect(150, 44, 26, GH - 44, NEAR);
  front.rect(150, 44, 1, GH - 44, 0x24485e);
  front.rect(150, 44, 26, 1, 0x1c2640);
  cap(front, 150, 43, 26, false);
  for (let wy = 49; wy < GH - 4; wy += 8) for (let wx = 153; wx < 174; wx += 6) { const q = r(), c = lit(), d = r(); nearWin(wx, wy, q, c, d); }
  front.line(168, 43, 168, 26, 0x2a3450); front.rect(166, 32, 5, 1, 0x2a3450); front.rect(167, 29, 3, 1, 0x2a3450);
  if (geo) geo.blinkers.push({ x: 168, y: 25, p: 0.6 });
  // low roofs between, wet: puddles that hold the neon
  for (const [x0, x1, top] of [[26, 58, 116], [58, 92, 124], [92, 122, 112], [122, 150, 120]]) {
    front.rect(x0, top, x1 - x0, GH - top, 0x0c1427);
    front.rect(x0, top, x1 - x0, 1, 0x1a2440);
    cap(front, x0, top - 1, x1 - x0, false);
    if (geo) geo.roofs.push([x0, x1 - 1, top]);
  }
  for (const [px, py, pw] of [[29, 118, 9], [95, 114, 10], [133, 122, 11]]) { front.rect(px, py, pw, 2, snow ? 0xdce4f0 : 0x1c2640); if (!snow) front.rect(px + 1, py, pw - 2, 1, 0x26304c); }
  front.rect(34, 117, 6, 1, 0xffc878); front.rect(110, 104, 2, 8, 0x1e2638); front.rect(109, 103, 4, 1, 0x2a3450);
  for (let k = 0; k < 6; k++) front.px(128 + k * 3, 117, k % 2 ? 0xffd27a : 0xff9ccc);
  front.rect(126, 114, 1, 6, 0x1e2638); front.rect(142, 114, 1, 6, 0x1e2638);
  if (geo) geo.vents.push([111, 102]);
  for (let y = 126; y < GH; y++) { const a = Math.round(((y - 126) / (GH - 126)) * 0.35 * 20) / 20; for (let x = 0; x < GW; x++) front.tint(x, y, 0xff9550, a); }
  return { back, front };
}

// a neon sign: panel, letters with a halo, and a dim copy for when a letter flickers
function makeSign(x, y, glyphs, vert, tube, core, off, every) {
  const n = glyphs.length, w = vert ? 5 : n * 4 + 1, h = vert ? n * 6 + 1 : 7;
  const on = new Ras(w, h), dim = new Ras(w, h);
  for (const R of [on, dim]) { R.rect(0, 0, w, h, 0x0b0d18); R.rect(0, 0, w, 1, 0x232536); R.rect(0, h - 1, w, 1, 0x07080f); }
  const cells = [];
  glyphs.forEach((g, i) => {
    const gx = vert ? 1 : 1 + i * 4, gy = vert ? 1 + i * 6 : 1;
    cells.push([gx - 1, gy - 1, 5, 7]);
    const set = new Set();
    for (let k = 0; k < 15; k++) if (g[k] === '1') set.add(`${gx + (k % 3)},${gy + Math.floor(k / 3)}`);
    for (const key of set) {
      const [px, py] = key.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!set.has(`${px + dx},${py + dy}`)) on.px(px + dx, py + dy, tube, 0.42);
    }
    for (const key of set) { const [px, py] = key.split(',').map(Number); on.px(px, py, core); dim.px(px, py, off); }
  });
  return { x, y, w, h, n, every, tube, on: on.canvas(), off: dim.canvas(), cells, glow: glow(Math.ceil(w / 2) + 7, Math.ceil(h / 2) + 6, tube, 0.6, 4) };
}

// the rain that falls in front of a sign or a lamp picks up its colour
const RAINLIT = [[56, 74, 15, 28, 1], [145, 74, 15, 32, 2], [10, 109, 15, 9, 4], [131, 109, 13, 8, 3]];
const STREAK = [
  [[190, 206, 245, 0.42], [170, 190, 235, 0.3], [150, 170, 225, 0.18]],
  [[255, 172, 216, 0.62], [240, 140, 200, 0.42], [220, 120, 190, 0.26]],
  [[172, 246, 255, 0.62], [130, 226, 246, 0.42], [110, 200, 236, 0.26]],
  [[255, 214, 166, 0.52], [240, 190, 140, 0.36], [220, 170, 130, 0.22]],
  [[255, 152, 162, 0.56], [240, 122, 140, 0.4], [220, 110, 130, 0.24]],
].map((ks) => ks.map(([r, g, b, a]) => `rgba(${r},${g},${b},${a})`));

const PUDDLES = [[29, 118, 9, '#ff6fae', 0], [95, 114, 10, '#ffc070', -1], [133, 122, 11, '#5fe8ff', 1]];   // x, y, width, colour, the sign it holds
const TVS = ['#5a7ae0', '#a8c0ff', '#3a5ac0', '#d0e0ff'];

let OUT = null;
function outside() {
  if (OUT) return OUT;
  const O = { sky: {}, clouds: {} };
  for (const k of WEATHERS) { const R = new Ras(GW, GH); R.vgrad(0, 0, GW, GH, SKY[k], 1.15); O.sky[k] = R.canvas(); }
  O.clouds.rain = [cloudStrip(3, 30, [0x161e36, 0x1b243e, 0x232c48, 0x2e3452, 0x423e5c], 1, 0.7), cloudStrip(8, 22, [0x182038, 0x1f2842, 0x2a304c, 0x3a3a58, 0x564662], 1, 0.75)];
  O.clouds.snow = [cloudStrip(4, 30, [0x2a3550, 0x313c58, 0x3a4662, 0x46506a, 0x585a72], 1, 0.7), cloudStrip(9, 18, [0x2e3954, 0x36415c, 0x414b66, 0x50566e, 0x646276], 1, 0.75)];
  O.clouds.clear = [cloudStrip(5, 10, [0x0d1630, 0x121c38, 0x18233f, 0x1f2a46], 0.55, 0.5), null];
  const geo = { wins: [], blinkers: [], roofs: [], vents: [], lamps: [], tvs: [], bill: null };
  const plain = paintCity(false, geo), snowy = paintCity(true, null);
  O.back = { plain: plain.back.canvas(), snow: snowy.back.canvas() };
  O.front = { plain: plain.front.canvas(), snow: snowy.front.canvas() };
  O.geo = geo;
  const gr = rng(23), glyph = () => { let g; do { g = Array.from({ length: 15 }, () => (gr() < 0.48 ? '1' : '0')).join(''); } while (g.split('1').length < 7); return g; };
  O.signs = [
    makeSign(54, 58, [...'HOTEL'].map((c) => FONT[c]), true, 0xff4fa3, 0xffd0e8, 0x4a2238, 45),
    makeSign(143, 52, Array.from({ length: 7 }, glyph), true, 0x2fe6ff, 0xd0fcff, 0x1a3a48, 75),
    makeSign(4, 106, [...'BAR'].map((c) => FONT[c]), false, 0xff5a6a, 0xffd6dc, 0x4a1e26, 55),
    makeSign(127, 106, [...'24'].map((c) => FONT[c]), false, 0xffb040, 0xffeac0, 0x4a3418, 90),
  ];
  const sr = rng(61);
  O.stars = Array.from({ length: 80 }, () => ({ x: Math.floor(sr() * GW), y: Math.floor(sr() * 92), sp: 0.4 + sr() * 1.4, p: sr() * 6.3 }));
  const M = new Ras(15, 15);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const d = sq(x - 7, y - 7);
    if (d <= 7.2) M.px(x, y, (x - 7) + (y - 7) > 4 + bay(x, y) * 3 ? 0xd8cdb0 : 0xf6efd8);
  }
  for (const [x, y] of [[5, 4], [6, 4], [5, 5], [9, 9], [10, 9], [9, 10], [4, 9], [10, 5]]) M.px(x, y, 0xcbc0a4);
  O.moon = M.canvas();
  O.moonGlow = glow(30, 30, 0xb8c4f0, 0.5, 4);
  // drops already on the glass, and frost in the panes' corners for the snow
  const gl = new Ras(GW, GH), fr = new Ras(GW, GH), dr = rng(31);
  for (const [px, py, pw, ph] of PANES) {
    for (let i = 0; i < (pw * ph) / 85; i++) {
      const x = px + 1 + Math.floor(dr() * (pw - 2)), y = py + Math.floor(dr() * ph), big = dr() < 0.3;
      gl.px(x, y, 0xb8c8e8, 0.32);
      if (big) { gl.px(x + 1, y, 0x8aa0c8, 0.5); gl.px(x, y + 1, 0x54688e, 0.6); gl.px(x + 1, y + 1, 0x6a80a8, 0.45); gl.px(x, y, 0xdce8ff, 0.5); }
    }
    for (let y = py + ph - 14; y < py + ph; y++) for (let x = px; x < px + pw; x++) { const a = ((y - (py + ph - 14)) / 14) * 0.5; if (bay(x, y) < a) gl.px(x, y, 0x9fb2d4, 0.16); }
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
      const cdist = Math.min(sq(x - px, y - py), sq(x - px - pw, y - py), sq(x - px, y - py - ph), sq(x - px - pw, y - py - ph));
      const edge = Math.min(x - px, px + pw - 1 - x, y - py, py + ph - 1 - y);
      const v = Math.max(1 - cdist / 22, 1 - edge / 4) + (dr() - 0.5) * 0.25;
      if (v > 0 && bay(x, y) < v) fr.px(x, y, 0xe6eefc, 0.18 + v * 0.45);
    }
    for (let x = px; x < px + pw; x++) { const hgt = 1 + Math.round(1.5 + Math.sin(x * 0.4) + Math.sin(x * 0.13) * 1.2); fr.rect(x, py + ph - hgt, 1, hgt, 0xf2f6ff); }
  }
  O.glassRain = gl.canvas(); O.glassFrost = fr.canvas();
  // a band of mist between the middle distance and the near blocks; it tiles, and drifts
  const MW = GW + 64, mist = new Ras(MW, 28);
  for (let y = 0; y < 28; y++) for (let x = 0; x < MW; x++) {
    const env = Math.sin((y / 27) * Math.PI) ** 1.4;
    const n = 0.5 + 0.3 * Math.sin((x / MW) * Math.PI * 2 * 3 + y * 0.2) + 0.2 * Math.sin((x / MW) * Math.PI * 2 * 7 + 1.3);
    const q = band(env * n * 3.2, x, y);
    if (q > 0) mist.px(x, y, 0x8a9cc8, [0, 0.06, 0.11, 0.16][Math.min(3, q)]);
  }
  O.mist = mist.canvas(); O.mistW = MW;
  // which colour the rain takes, cell by cell (4 px cells)
  O.tintCols = Math.ceil(GW / 4); O.tint = new Uint8Array(O.tintCols * Math.ceil(GH / 4));
  for (let cy = 0; cy < Math.ceil(GH / 4); cy++) for (let cx = 0; cx < O.tintCols; cx++) {
    const x = cx * 4 + 2, y = cy * 4 + 2;
    let t = y > 100 ? 3 : 0;
    for (const [sx, sy, rx, ry, k] of RAINLIT) if (((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 < 1) t = k;
    O.tint[cy * O.tintCols + cx] = t;
  }
  O.reflect = glow(16, 12, 0xffb070, 0.4, 4);
  O.gMon = glow(46, 10, 0x6a8aff, 0.5, 4);
  O.gBlink = glow(4, 4, 0xff4040, 0.9, 4);
  O.gTrack = glow(4, 3, 0xffc070, 0.7, 4);
  O.gHead = glow(9, 5, 0xfff0c0, 0.9, 4);
  O.gCar = glow(4, 2, 0xfff0c8, 0.8, 3);
  O.gTail = glow(3, 2, 0xff3a3a, 0.8, 3);
  O.gBill = glow(18, 12, 0xd0508a, 0.45, 4);
  O.gStreet = glow(110, 34, 0xff8a40, 0.5, 5);
  O.gShop = glow(70, 10, 0xffd8a0, 0.35, 4);
  O.gTv = glow(4, 4, 0x6a8aff, 0.6, 4);
  buildScreens(O);
  return (OUT = O);
}

/* ——— the monitor's three screens, their still parts ——— */
const TOK = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b', '#a6accd'];
function buildScreens(O) {
  const C = new Ras(SCR.w, SCR.h);
  C.rect(0, 0, 78, 46, 0x1c2030);
  C.rect(0, 0, 78, 3, 0x2a2f44); C.px(2, 1, 0xff6b6b); C.px(4, 1, 0xffd166); C.px(6, 1, 0x06d6a0);
  C.rect(12, 0, 16, 3, 0x1c2030); C.rect(14, 1, 10, 1, 0x8a90b0); C.rect(30, 1, 9, 1, 0x4a5070);
  C.rect(0, 3, 13, 41, 0x171a2a);
  [0, 1, 1, 2, 2, 1, 0, 1, 1].forEach((ind, i) => {
    const yy = 6 + i * 4;
    C.px(2 + ind * 2, yy, i === 3 ? 0xd9a441 : 0x6a7298);
    C.rect(4 + ind * 2, yy, 3 + ((i * 3) % 5), 1, i === 3 ? 0xc8d0f0 : 0x4a5274);
  });
  C.rect(13, 3, 1, 41, 0x10121c);
  for (let i = 0; i < 13; i++) C.px(16, 5 + i * 3, 0x3a4058);
  C.rect(70, 4, 6, 38, 0x191c2c); for (let i = 0; i < 18; i++) C.rect(71, 5 + i * 2, 1 + ((i * 7) % 4), 1, 0x3a4060);
  C.rect(0, 44, 78, 2, 0x3b5aa8); C.rect(2, 44, 6, 1, 0x9ab4ff); C.rect(60, 44, 10, 1, 0x9ab4ff);
  O.scrCode = C.canvas();

  const M = new Ras(SCR.w, SCR.h);
  M.vgrad(0, 0, 78, 46, [0x2c1f46, 0x271f48, 0x212348, 0x1b2a46], 1);
  M.rect(2, 2, 22, 22, 0x140f1f);
  M.vgrad(3, 3, 20, 13, [0xffb08a, 0xff8a8a, 0xd86a9a, 0x8a5ab8, 0x4a4a9a], 1);
  for (let y = -5; y <= 0; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 27) M.px(13 + x, 15 + y, 0xfff0cc);
  M.vgrad(3, 16, 20, 7, [0x4a3a8a, 0x2e2a6a, 0x1e1e4e], 1);
  for (let y = 17; y < 23; y += 2) M.rect(11 - (y - 17) / 2, y, 5 + (y - 17), 1, 0xffd0a0);
  M.text('LOFI', 27, 4, 0xf3f0ff);
  M.rect(27, 18, 46, 1, 0x3f3b5c);
  M.rect(34, 22, 1, 3, 0xb8b2d8); M.px(35, 23, 0xb8b2d8); M.px(36, 22, 0xb8b2d8); M.px(36, 24, 0xb8b2d8);
  M.rect(62, 22, 1, 3, 0xb8b2d8); M.px(61, 23, 0xb8b2d8); M.px(60, 22, 0xb8b2d8); M.px(60, 24, 0xb8b2d8); M.px(61, 22, 0xb8b2d8); M.px(61, 24, 0xb8b2d8);
  M.rect(3, 43, 72, 1, 0x3a3660);
  O.scrMusic = M.canvas();

  const T = new Ras(SCR.w, SCR.h);
  T.vgrad(0, 0, 78, 46, [0x1a8cac, 0x147a9c, 0x0f6688, 0x0a4c6e, 0x073652, 0x05283e], 1);
  T.vgrad(0, 39, 78, 7, [0xe4d2a6, 0xd6c296, 0xc4ae82], 1);
  for (let x = 0; x < 78; x++) if (bay(x, 39) < 0.5) T.px(x, 39, 0x0a4c6e);
  for (const [x, c] of [[8, 0xa08a6a], [20, 0x8a7a68], [33, 0xb8a47a], [47, 0x9a8a72], [52, 0xa89470]]) { T.px(x, 42, c); T.px(x + 1, 42, c); }
  T.ell(64, 40, 6, 3, 0x5a5e70); T.rect(60, 38, 5, 1, 0x7a7e90); T.px(66, 39, 0x44485a);
  T.rect(10, 36, 7, 4, 0x8a5a2a); T.rect(10, 36, 7, 1, 0xa87038); T.rect(10, 38, 7, 1, 0xf0c850); T.px(13, 38, 0xfff0a0);
  T.rect(70, 40, 3, 1, 0x3a3e4a);
  O.scrTank = T.canvas();
  O.gScreen = [glow(56, 34, 0x6a7aff, 0.5, 4), glow(56, 34, 0xff6a9a, 0.5, 4), glow(56, 34, 0x40c8e8, 0.5, 4)];
}

/* ——— the room ——— */
const fairyY = (x) => { const m = (((x - 20) % 40) + 40) % 40; return 9 + Math.round(Math.sin((m / 40) * Math.PI) * 9); };
const deskL = (y) => -14 - ((Math.min(y, 301) - DESK) * 14) / 95;   // the desk top's sides, in perspective
const deskR = (y) => 352 + ((Math.min(y, 301) - DESK) * 14) / 95;
const LAVA = [
  { liquid: 0x6a2236, blob: 0xff7a3d, light: 0xffc06b, name: 'amber' },
  { liquid: 0x26246a, blob: 0xc56cf0, light: 0xeebcff, name: 'violet' },
  { liquid: 0x123e4e, blob: 0x4ed8e0, light: 0xc8f8ff, name: 'teal' },
  { liquid: 0x521e4c, blob: 0xff6fa8, light: 0xffc8e4, name: 'rose' },
];
const MOONS = [[0xff5aa8, 0xffd8ec, 'pink'], [0x3ae0ff, 0xd0faff, 'cyan'], [0xb07aff, 0xeadcff, 'violet']];

function leaf(R, x, y, flip, r) {
  const shape = ['.##.', '####', '####', '.##.', '..#.'];
  shape.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '#') return;
    const xx = flip ? x + 3 - i : x + i;
    let c = 0x5cb05a;
    if (j <= 1 && (flip ? i >= 2 : i <= 1)) c = 0x96d888;
    if (j >= 3 || (j === 2 && (flip ? i === 0 : i === 3))) c = 0x3e8c44;
    R.px(xx, y + j, c);
  }));
  if (r < 0.35) R.px(flip ? x + 1 : x + 2, y + 1, 0xe2e890);
}

function* paintBack(R, ox, rw, withFloor) {
  const L = -ox, RT = rw - ox, wide = ox > 0;
  // the wall, with a quiet wallpaper of fine stripes and small diamonds
  for (let y = 7; y < (wide ? 260 : DESK + 2); y++) for (let x = L; x < RT; x++) {
    const xm = ((x % 12) + 12) % 12, ym = (y + (Math.floor(x / 12) & 1) * 8) % 16;
    R.px(x, y, xm === 0 ? 0x727d9b : Math.abs(xm - 6) + Math.abs(ym - 8) <= 1 ? 0x8994b2 : 0x7c87a5);
  }
  R.rect(L, 0, RT - L, 4, 0x5c566e); R.rect(L, 4, RT - L, 1, 0xa79fb6); R.rect(L, 5, RT - L, 1, 0x8b84a0); R.rect(L, 6, RT - L, 1, 0x66708e);
  yield;
  if (wide) {
    // skirting and floorboards, rugs either side, and the desk's shadow on the wall and floor
    R.rect(L, 260, RT - L, 1, 0xf2e8d6); R.rect(L, 261, RT - L, 6, 0xd8ccb6); R.rect(L, 267, RT - L, 1, 0x8a7e6c);
    const seams = [268, 272, 277, 283, 290, 298, 307, 317];
    R.rect(L, 268, RT - L, 52, 0x6e4c3a);
    seams.forEach((sy, k) => {
      R.rect(L, sy, RT - L, 1, 0x4e3428); R.rect(L, sy + 1, RT - L, 1, 0x7e5a46);
      const next = seams[k + 1] ?? 320, step = 38 + k * 9;
      for (let jx = L - ((L % step) + step) % step + ((k * 23) % step); jx < RT; jx += step) R.rect(jx, sy + 1, 1, next - sy - 1, 0x56392c);
      for (let x = L; x < RT; x++) if ((x * 7 + k * 13) % 29 === 0) R.rect(x, sy + 3, 6, 1, 0x664436);
    });
    rug(R, L + 4, -36, 301, 0x2e4466, 0x8a3a3a, 0xd8b070);
    rug(R, 370, RT - 4, 297, 0x2e6a72, 0xd8ccb0, 0xe8a070);
    for (let y = DESK; y < H; y++) {
      const wdt = y < 268 ? 5 : 10, el = Math.round(deskL(y)), er = Math.round(deskR(y));
      for (let k = 1; k <= wdt; k++) { const f = 0.5 + 0.5 * (k / wdt) ** 0.8; R.shade(el - k, y, 1, 1, f); R.shade(er + k - 1, y, 1, 1, f); }
    }
    yield;
  }

  // the window: a painted frame, the glass left clear for the city
  const F = 0xe7dbc5, FD = 0xb3a58d, FL = 0xfff4de, FS = 0x8d816d;
  R.rect(GX - 7, GY - 7, GW + 14, GH + 7, F);
  R.rect(GX - 7, GY - 7, GW + 14, 1, FL); R.rect(GX - 7, GY - 7, 1, GH + 7, FL); R.rect(GX + GW + 6, GY - 7, 1, GH + 7, FD);
  R.rect(GX - 3, GY - 3, GW + 6, 1, FD); R.rect(GX - 3, GY - 3, 1, GH + 3, FD); R.rect(GX + GW + 2, GY - 3, 1, GH + 3, FL);
  R.rect(GX - 1, GY - 1, GW + 2, 1, FS); R.rect(GX - 1, GY - 1, 1, GH + 1, FS); R.rect(GX + GW, GY - 1, 1, GH + 1, FS);
  R.clear(GX, GY, GW, GH);
  R.rect(GX + 86, GY, 4, GH, F); R.rect(GX + 86, GY, 1, GH, FL); R.rect(GX + 89, GY, 1, GH, FD);
  R.rect(GX, GY + 46, GW, 4, F); R.rect(GX, GY + 46, GW, 1, FL); R.rect(GX, GY + 49, GW, 1, FD); R.rect(GX + 86, GY + 46, 4, 4, F);
  R.rect(GX + 85, GY + 90, 6, 2, 0xd8b060); R.px(GX + 85, GY + 90, 0xf4d890); R.rect(GX + 87, GY + 92, 2, 3, 0xb08a40);
  const SY = GY + GH;
  R.rect(GX - 14, SY, GW + 28, 1, 0xfff6e6); R.rect(GX - 14, SY + 1, GW + 28, 2, 0xefe3cc);
  R.rect(GX - 14, SY + 3, GW + 28, 5, 0xc4b49c); R.rect(GX - 14, SY + 8, GW + 28, 1, 0x8d816d);
  R.shade(GX - 14, SY + 9, GW + 28, 1, 0.55); R.shade(GX - 14, SY + 10, GW + 28, 1, 0.72); R.shade(GX - 14, SY + 11, GW + 28, 1, 0.86);
  // on the sill: a succulent and a bottle with a dried stem
  R.rect(214, 162, 8, 6, 0xd9cfc0); R.rect(213, 161, 10, 1, 0xece4d6); R.rect(220, 162, 2, 6, 0xb8ae9e);
  for (const [x, y, c] of [[215, 159, 0x6aa878], [216, 158, 0x8ac898], [218, 157, 0x6aa878], [219, 158, 0x4a8a5a], [220, 159, 0x6aa878], [217, 160, 0x4a8a5a], [214, 160, 0x4a8a5a], [221, 160, 0x4a8a5a], [218, 159, 0x8ac898], [217, 158, 0x4a8a5a]]) R.px(x, y, c);
  R.rect(232, 158, 5, 10, 0x6a98a4); R.rect(233, 155, 3, 3, 0x6a98a4); R.rect(233, 158, 1, 9, 0xc8eef0); R.rect(236, 159, 1, 8, 0x4a7280);
  R.line(234, 154, 232, 140, 0xb08a5a); R.line(235, 154, 238, 143, 0xa07a4a);
  for (const [x, y] of [[231, 139], [232, 138], [238, 142], [239, 141], [233, 144]]) R.px(x, y, 0xe8d0a0);
  // a radiator under the window, and the curtains' brass hooks
  R.rect(96, 180, 132, 1, 0xf6f0e4); R.rect(96, 181, 132, 2, 0xe9e1d0);
  for (let x = 98; x < 226; x++) { const m = (x - 98) % 4; R.rect(x, 183, 1, 23, m === 3 ? 0x8a8374 : m === 0 ? 0xe9e1d0 : 0xd0c6b2); }
  R.rect(228, 192, 4, 4, 0xc8983c); R.px(228, 192, 0xf0c870); R.rect(229, 196, 2, 10, 0xb8b0a0);
  for (const tx of [68, 252]) { R.rect(tx - 1, 127, 3, 3, 0xd9a84a); R.px(tx - 1, 127, 0xf0c868); R.px(tx, 130, 0xa0782a); }
  yield;

  // posters, a calendar and a cork board on the walls either side
  { const x = 5, y = 30, w = 26, h = 38;
    R.rect(x, y, w, h, 0xf2ebdf); R.rect(x, y + h - 1, w, 1, 0xc8c0b0);
    R.vgrad(x + 2, y + 2, w - 4, 22, [0x1a2248, 0x232c58, 0x2e3866, 0x3d4474], 1);
    for (const [sx, sy] of [[4, 4], [9, 7], [20, 5], [23, 10], [6, 12], [14, 3]]) R.px(x + sx, y + sy, 0xe8e4ff);
    R.ell(x + 16, y + 11, 4, 4, 0xf6e8c0); R.px(x + 17, y + 12, 0xe0d0a0); R.px(x + 15, y + 10, 0xe0d0a0);
    for (let yy = y + 24; yy < y + 32; yy++) { R.rect(x + 2, yy, w - 4, 1, yy % 2 ? 0x2a4a7a : 0x34588a); if (yy % 2) R.rect(x + 14 - ((yy - y - 24) >> 1), yy, 3 + (yy - y - 24), 1, 0xe8d8a8); }
    R.rect(x + 6, y + 22, 5, 2, 0x10142a); R.px(x + 8, y + 18, 0x10142a); R.line(x + 8, y + 19, x + 8, y + 21, 0x10142a); R.px(x + 9, y + 20, 0xe8e0d0);
    R.rect(x + 4, y + 34, 12, 1, 0x8a8494); R.rect(x + 4, y + 36, 7, 1, 0xb0aab8);
    R.rect(x + 10, y - 1, 6, 3, 0xf3b6c4); }
  { const x = 290, y = 30, w = 26, h = 38;
    R.rect(x, y, w, h, 0x1c1628);
    R.vgrad(x + 1, y + 1, w - 2, 22, [0x2a1e4a, 0x4a2a6a, 0x7a3a7a, 0xb0507a], 1);
    for (let dy = -8; dy <= 0; dy++) {
      if (dy > -5 && (dy & 1)) continue;
      const half = Math.floor(Math.sqrt(64 - dy * dy));
      R.rect(x + 13 - half, y + 21 + dy, half * 2 + 1, 1, mixc(0xffe08a, 0xff6a9a, (dy + 8) / 8));
    }
    R.rect(x + 1, y + 23, w - 2, h - 24, 0x160f2a);
    for (const gy of [24, 26, 29, 33]) R.rect(x + 1, y + gy, w - 2, 1, 0x2fb8c8);
    for (let k = -3; k <= 3; k++) R.line(x + 13 + k * 2, y + 23, x + 13 + k * 6, y + h - 2, 0x2a8aa0);
    R.rect(x + 7, y + 3, 12, 1, 0xffd0e0); }
  { const x = 8, y = 80;
    R.rect(x, y, 20, 24, 0xefeae0); R.rect(x, y, 20, 4, 0xc8504a); R.rect(x, y + 23, 20, 1, 0xc8c0b4);
    R.px(x + 5, y - 1, 0x3a3a44); R.px(x + 14, y - 1, 0x3a3a44);
    R.rect(x + 6, y + 6, 8, 1, 0x8a8496);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) R.px(x + 3 + c * 2, y + 10 + r * 3, 0xa09aac);
    R.rect(x + 8, y + 15, 3, 3, 0xd05050); R.px(x + 9, y + 16, 0xefeae0); }
  { const x = 290, y = 80;
    R.rect(x, y, 26, 20, 0x6e4e34); R.rect(x + 1, y + 1, 24, 18, 0xbb8c5c); R.dith(x + 1, y + 1, 24, 18, 0xa47648, 0.22);
    R.rect(x + 3, y + 3, 6, 6, 0xf4dc7a); R.rect(x + 4, y + 5, 4, 1, 0xc8b060); R.rect(x + 4, y + 7, 3, 1, 0xc8b060); R.px(x + 5, y + 3, 0xd84a4a);
    R.rect(x + 11, y + 4, 5, 6, 0xf4a8c0); R.px(x + 13, y + 4, 0x4a7ad8);
    R.rect(x + 18, y + 3, 6, 8, 0xf4f0ea); R.rect(x + 19, y + 4, 4, 3, 0x5a8ab0); R.rect(x + 19, y + 7, 4, 2, 0x6aa070); R.px(x + 20, y + 3, 0xe0c040);
    R.rect(x + 5, y + 12, 10, 5, 0xe8eef8); R.rect(x + 6, y + 14, 7, 1, 0x9aa8c0); R.px(x + 10, y + 12, 0x58b070); }
  yield;
  if (wide) { yield* paintLeft(R, L); yield* paintRight(R, RT, withFloor); }
}

// a rug on the floor, seen from above at a slant: a border, a field of diamonds, tassels
function rug(R, x0, x1, top, field, border, motif) {
  if (x1 - x0 < 8) return;
  for (let y = top; y < H; y++) for (let x = x0; x < x1; x++) {
    const bx = Math.min(x - x0, x1 - 1 - x), by = y - top;
    let c = field;
    if (bx < 2 || by < 2) c = border;
    else if (bx < 3 || by < 3) c = mixc(field, 0xffffff, 0.35);
    else {
      const mx = ((x - x0) % 12) - 6, my = ((by - 3) % 10) - 5;
      const dm = Math.abs(mx) + Math.abs(my * 1.2);
      if (dm > 3.2 && dm < 4.4) c = motif; else if (dm < 1.2) c = border;
    }
    R.px(x, y, c);
  }
  for (let x = x0 + 1; x < x1 - 1; x += 2) R.px(x, top - 1, 0xd8ccb0);
}

function* paintLeft(R, L) {
  // a botanical print
  { const x = -118, y = 28, w = 34, h = 48;
    R.rect(x, y, w, h, 0x2e2836); R.rect(x + 2, y + 2, w - 4, h - 4, 0xeee3c9);
    R.line(x + 17, y + 38, x + 17, y + 9, 0x4a7a44);
    for (const [lx, ly, s] of [[10, 12, -1], [20, 15, 1], [9, 21, -1], [21, 25, 1], [11, 30, -1]]) { R.ell(x + lx + (s < 0 ? 1 : 0), y + ly, 4, 2, 0x5f9a5c); R.line(x + lx - 3 * s, y + ly, x + 17, y + ly + 1, 0x3e6e3a); R.px(x + lx - s, y + ly - 1, 0x86c27c); }
    R.poly([[x + 12, y + 37], [x + 22, y + 37], [x + 21, y + 43], [x + 13, y + 43]], 0xc4724c); R.rect(x + 11, y + 36, 12, 2, 0xd8845a); }
  // a round mirror on a cord, holding a little of the window's light
  { const cx = -66, cy = 54, r = 12;
    R.line(cx, 27, cx - 8, cy - 10, 0x5a4a3c); R.line(cx, 27, cx + 8, cy - 10, 0x5a4a3c); R.rect(cx - 1, 25, 2, 2, 0x8a7a68);
    for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
      const d = sq(x, y);
      if (d > r + 1.5) continue;
      if (d > r - 0.5) { R.px(cx + x, cy + y, d > r + 0.6 ? 0x6a4e2a : x + y < 0 ? 0xe8c070 : 0xb08a40); continue; }
      const t = (y + r) / (2 * r), diag = x + y;
      let c = t < 0.35 ? 0x22305a : t < 0.7 ? 0x2a3a66 : 0x34406a;
      if (Math.abs(diag + 6) < 1.2 || Math.abs(diag + 1) < 0.6) c = 0x6a7cb0;
      R.emit(cx + x, cy + y, c);
    }
    for (const [x, y] of [[-6, 5], [-2, 7], [2, 7], [6, 5]]) R.emit(cx + x, cy + y, 0xe8a860); }
  // photos pegged on a string
  { const a = -122, b = -40, ys = (x) => 98 + Math.round(Math.sin(((x - a) / (b - a)) * Math.PI) * 5);
    for (let x = a; x <= b; x++) R.px(x, ys(x), 0x3a3440);
    R.rect(a - 1, 96, 2, 2, 0x8a8070); R.rect(b - 1, 96, 2, 2, 0x8a8070);
    [[0xf0a070, 0x6a4a8a], [0x4a8ab0, 0x2e5a7a], [0x5aa06a, 0x2e6a44], [0xe08aa8, 0x8a4a6a], [0xf4d080, 0x4a6a9a]].forEach(([c1, c2], k) => {
      const px = a + 4 + k * 16, py = ys(px + 5) + 1;
      R.rect(px, py + 1, 10, 12, 0xf2eee6); R.rect(px + 1, py + 2, 8, 7, c1); R.rect(px + 1, py + 6, 8, 3, c2);
      R.px(px + 2 + (k % 4), py + 3, mixc(c1, 0xffffff, 0.6)); R.rect(px + 5 - (k % 3), py + 5, 2, 2, mixc(c2, 0x000000, 0.4));
      R.rect(px + 4, py, 2, 3, 0xc89a60); R.rect(px, py + 12, 10, 1, 0xc8c2b6);
    }); }
  // a little wall shelf over the bed: books, a trailing plant, a cassette, a photo
  { const y = 150, a = -122, b = -76, lr = rng(41);
    R.shade(a + 1, y + 4, b - a - 2, 3, 0.72);
    R.rect(a, y, b - a, 2, 0xc89a68); R.rect(a, y, b - a, 1, 0xdcb080); R.rect(a, y + 2, b - a, 2, 0x8a603e);
    for (const bx of [a + 5, b - 8]) { R.rect(bx, y + 4, 2, 6, 0x2e2a34); R.line(bx + 2, y + 4, bx + 5, y + 4, 0x2e2a34); R.line(bx + 1, y + 9, bx + 5, y + 5, 0x2e2a34); }
    [[0x4a6a9a, 13], [0xc0604a, 11], [0xd8b060, 12]].forEach(([c, w], k) => { const yy = y - 2 - k * 2; R.rect(a + 2 + k, yy, w, 2, c); R.rect(a + 2 + k, yy, w, 1, mixc(c, 0xffffff, 0.3)); R.rect(a + k + w, yy, 2, 2, 0xeee4d0); });
    R.rect(a + 18, y - 7, 8, 7, 0xe8e0d4); R.rect(a + 17, y - 8, 10, 1, 0xf6f0e6); R.rect(a + 24, y - 7, 2, 7, 0xc0b8aa);
    leaf(R, a + 15, y - 12, 0, lr()); leaf(R, a + 22, y - 13, 1, lr()); leaf(R, a + 18, y - 15, 0, lr());
    for (let k = 0; k < 20; k++) { const x = a + 25 + Math.round(Math.sin(k * 0.33) * 2), yy = y + k - 1; R.px(x, yy, 0x4e8a3e); if (k % 4 === 1) leaf(R, x + (k % 8 < 4 ? -4 : 1), yy - 1, k % 8 < 4 ? 0 : 1, lr()); }
    R.rect(a + 31, y - 6, 9, 6, 0x2a2a34); R.rect(a + 32, y - 5, 7, 2, 0xf0d070); R.px(a + 33, y - 2, 0x8a8a98); R.px(a + 37, y - 2, 0x8a8a98);
    R.rect(a + 42, y - 10, 6, 10, 0x3a2e28); R.rect(a + 43, y - 9, 4, 7, 0xe08aa8); R.rect(a + 43, y - 5, 4, 3, 0x5a8ab0); }
  // a brass swing-arm wall lamp over the bed, its little shade glowing at the mouth
  { R.rect(-123, 182, 4, 8, 0x8a6a3a); R.px(-123, 182, 0xd8b060); R.rect(-122, 190, 2, 2, 0x6a4e2a);
    R.line(-119, 185, -108, 189, 0xc89a50); R.line(-119, 186, -108, 190, 0x8a6a3a); R.px(-108, 189, 0xd8b060);
    R.poly([[-111, 188], [-104, 186], [-99, 196], [-110, 198]], 0x2e5a52); R.line(-111, 188, -104, 186, 0x5a8a7a); R.line(-104, 186, -99, 196, 0x1e3e3a);
    for (let x = -109; x <= -101; x++) R.emit(x, 197 - Math.round((x + 109) * 0.12), x === -105 ? 0xfff6dc : 0xffd890);
    R.line(-121, 192, -124, 214, 0x2a2830); R.line(-124, 214, -126, 236, 0x2a2830); }
  // an ink sketch of hills over the nightstand
  { const x = -55, y = 162;
    R.rect(x, y, 18, 22, 0x2e2836); R.rect(x + 1, y + 1, 16, 20, 0xf0e8d8);
    R.line(x + 2, y + 15, x + 7, y + 8, 0x4a4450); R.line(x + 7, y + 8, x + 11, y + 13, 0x4a4450); R.line(x + 9, y + 11, x + 12, y + 7, 0x4a4450); R.line(x + 12, y + 7, x + 16, y + 14, 0x4a4450);
    R.ell(x + 12, y + 4, 1, 1, 0xd06a50); R.rect(x + 3, y + 17, 11, 1, 0xa8a0b0); }
  yield;
  if (L < -140) {
    // a print of the sea at night
    { const x = -206, y = 26, w = 42, h = 56;
      R.rect(x, y, w, h, 0x2a2430); R.rect(x + 2, y + 2, w - 4, h - 4, 0xf2ebdf);
      R.vgrad(x + 4, y + 4, w - 8, 28, [0x1e2250, 0x2e2c66, 0x5a3a7a, 0xb0607a, 0xe89a7a], 1);
      R.ell(x + 26, y + 14, 4, 4, 0xfff0d0);
      for (let yy = y + 32; yy < y + h - 6; yy++) { R.rect(x + 4, yy, w - 8, 1, yy % 2 ? 0x24305e : 0x2e3c6e); if (yy % 2 === 0) R.rect(x + 24 - ((yy - y - 32) >> 1), yy, 4 + (yy - y - 32), 1, 0xf0c890); }
      R.poly([[x + 8, y + 31], [x + 15, y + 31], [x + 12, y + 28]], 0x14162a); R.line(x + 12, y + 28, x + 12, y + 22, 0x14162a);
      R.rect(x + 8, y + h - 5, 18, 1, 0x8a8494); }
    // a hanging planter on a macramé cord
    { const x = -142, lr = rng(53);
      for (let y = 7; y < 112; y++) { R.px(x - 3 + Math.round((y - 7) / 105 * -1), y, 0xd8c8a8); R.px(x + 3, y, 0xc8b898); }
      for (let y = 100; y < 112; y++) if (y % 3 === 0) { R.px(x - 2, y, 0xb8a888); R.px(x + 2, y, 0xb8a888); }
      R.poly([[x - 7, 112], [x + 7, 112], [x + 5, 124], [x - 5, 124]], 0xc4704a); R.rect(x - 7, 112, 15, 2, 0xd8845a); R.line(x + 5, 113, x + 4, 123, 0x9a5434);
      leaf(R, x - 6, 106, 0, lr()); leaf(R, x + 2, 105, 1, lr()); leaf(R, x - 2, 103, 0, lr());
      for (const [dx, len] of [[-6, 34], [5, 26], [0, 40]]) for (let k = 0; k < len; k++) { const xx = x + dx + Math.round(Math.sin(k * 0.3 + dx) * 2), yy = 116 + k; R.px(xx, yy, 0x4e8a3e); if (k % 5 === 2) leaf(R, xx + (k % 10 < 5 ? -4 : 1), yy - 1, k % 10 < 5 ? 0 : 1, lr()); } }
  }
  yield;
  // the bed, its head against a slatted headboard by the nightstand
  { const hx = -66;
    R.rect(L, 284, hx - L, 8, 0x6e4a32); R.rect(L, 284, hx - L, 1, 0x9a6c48); R.rect(L, 291, hx - L, 1, 0x4a2e1e);
    for (let x = L; x < hx; x++) if ((x * 11) % 31 === 0) R.rect(x, 286, 4, 1, 0x5e3e2a);
    R.shade(L, 292, hx - L, 8, 0.6);
    R.rect(L, 272, hx - L, 12, 0xdcdde8); R.rect(L, 282, hx - L, 2, 0xb4b8cc);
    for (let y = 232; y < 282; y++) for (let x = L; x < hx; x++) {
      const lump = Math.round(Math.sin(x * 0.09) * 1.2 + Math.sin(x * 0.23) * 0.6);
      if (y < 236 + lump) continue;
      const hem = 277 + Math.round(Math.sin(x * 0.37) * 1.6 + Math.sin(x * 0.11));
      if (y > hem) continue;
      const top = y < 256;
      let c;
      if (top) {
        const crest = Math.sin(x * 0.11 + (y - 236) * 0.35) + Math.sin(x * 0.05 - y * 0.2) * 0.6;
        c = y < 239 + lump ? 0xb4c6ea : crest > 0.9 ? 0x9eb2de : crest < -0.9 ? 0x7c8ec0 : 0x8c9ed0;
      } else {
        const f = Math.sin(x * 0.3 + 0.8) + 0.5 * Math.sin(x * 0.11);
        c = f > 0.9 ? 0x8294c8 : f < -0.7 ? 0x55649a : 0x6a7ab0;
        if (y >= hem - 1) c = 0x4c5a8c;
      }
      if ((x + 600) % 9 === 4 && (y + ((x + 600) % 18 < 9 ? 0 : 4)) % 8 === (top ? 2 : 5)) c = 0xe2eafc;
      if (y === 256) c = 0xb8c8ee;
      R.px(x, y, c);
    }
    // two pillows against the headboard
    const pillow = (cx, cy, rx, ry, c) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const e = (x * x) / (rx * rx) + ((y * y) / (ry * ry)) * (1 + 0.25 * Math.abs(x / rx));
        if (e > 1) continue;
        let cc = c;
        if (y > ry * 0.35 || (e > 0.72 && y > 0)) cc = mixc(c, 0x6a6a8a, 0.3);
        if (y < -ry * 0.4 && x < rx * 0.3) cc = mixc(c, 0xffffff, 0.5);
        if (e > 0.86 && y <= 0 && x > rx * 0.4) cc = mixc(c, 0x6a6a8a, 0.15);
        R.px(cx + x, cy + y, cc);
      }
      R.line(cx - rx + 4, cy + 1, cx + rx - 4, cy, mixc(c, 0x6a6a8a, 0.2));
    };
    // a knitted mustard throw laid across the bed, its end hanging over the side in soft folds
    { const a = -150, b = -104;
      const fold = (x, y) => Math.sin((x - a) * 0.21 + Math.sin(y * 0.19 + x * 0.05) * 1.6);
      for (let y = 234; y < 258; y++) {
        const k = (y - 234) / 24, x0 = Math.round(a + k * 5 + Math.sin(y * 0.5) * 0.6), x1 = Math.round(b + k * 8);
        for (let x = Math.max(L, x0); x < x1; x++) {
          const lump = 236 + Math.round(Math.sin(x * 0.09) * 1.2 + Math.sin(x * 0.23) * 0.6) - 1;
          if (y < lump) continue;
          const f = fold(x, y);
          let c = f > 0.7 ? 0xf2c868 : f < -0.75 ? 0xb88228 : 0xdcaa44;
          if (y === lump) c = 0xf6d47c;
          if (((x * 3 + y * 2) % 5) === 0 && f > -0.75) c = mixc(c, 0x9a6a20, 0.18);
          if (x === x0) c = 0xc08a30; if (x === x1 - 1) c = 0x9a6a20;
          R.px(x, y, c);
        }
      }
      const x0 = a + 5, x1 = b + 8;
      for (let y = 258; y < 292; y++) for (let x = Math.max(L, x0); x < x1; x++) {
        const hem = 282 + Math.round(Math.sin(x * 0.42) * 2 + Math.sin(x * 0.13 + 1) * 1.5);
        if (y > hem) { if (y <= hem + 3 && x % 2 === 0) R.px(x, y, y === hem + 3 ? 0xa87428 : 0xc89038); continue; }
        const f = Math.sin((x - x0) * 0.38 + (y - 258) * 0.03) + Math.sin((x - x0) * 0.11) * 0.5;
        let c = f > 0.95 ? 0xe8b850 : f > 0.2 ? 0xd09a38 : f < -0.9 ? 0x8e5e1c : 0xb8822a;
        if (y === 258) c = 0xf6d47c; else if (y === 259) c = 0xe0b04c;
        if (y >= hem - 1) c = 0x8a5a1a;
        if (((x * 3 + y * 2) % 5) === 0) c = mixc(c, 0x7a5018, 0.16);
        if (x === x1 - 1) c = 0x7a4e18;
        R.px(x, y, c);
      } }
    pillow(-86, 229, 17, 8, 0xe2e0ee); pillow(-93, 239, 16, 7, 0xf4f2fa);
    // the headboard, a solid panel seen from its end: its face slants back to the wall
    R.poly([[-63, 190], [-73, 210], [-73, 300], [-63, 272]], 0x7a5236);
    R.line(-63, 190, -73, 210, 0xb88a5a); R.line(-63, 191, -73, 211, 0x9a6c48);
    R.line(-73, 211, -73, 300, 0xa87a50); R.line(-72, 212, -72, 300, 0x8a603e); R.line(-63, 192, -63, 271, 0x5a3a24);
    for (let k = 0; k < 4; k++) R.line(-71 + k * 2, 222 - k * 4, -71 + k * 2, 288 - k * 5, 0x6e4a30);
    R.rect(-75, 206, 5, 3, 0x9a6c48); R.rect(-74, 205, 3, 1, 0xd0a070); R.rect(-74, 296, 3, 4, 0x4e3222); }
  yield;
  // the nightstand: two drawers, a salt lamp glowing, a phone face down
  { const x0 = -58, x1 = -30;
    R.shade(x0 - 2, 289, x1 - x0 + 6, 5, 0.6);
    for (let y = 224; y < 230; y++) { const k = Math.floor((y - 224) / 3); R.rect(x0 + 2 - k, y, x1 - x0 - 4 + k * 2, 1, y === 224 ? 0x8a5a38 : 0xb07a4e); }
    R.rect(x0, 230, x1 - x0, 1, 0xd09a68); R.rect(x0, 231, x1 - x0, 2, 0x9a6440);
    R.rect(x0 + 1, 233, x1 - x0 - 2, 53, 0x8a5a38); R.rect(x0 + 1, 233, 1, 53, 0xa87048); R.rect(x1 - 2, 233, 1, 53, 0x5e3a24);
    for (const dy of [236, 260]) {
      R.rect(x0 + 3, dy, x1 - x0 - 6, 21, 0x9a6844); R.rect(x0 + 3, dy, x1 - x0 - 6, 1, 0xb88458); R.rect(x0 + 3, dy + 20, x1 - x0 - 6, 1, 0x5e3a24);
      R.rect(x0 + 3, dy, 1, 21, 0xa87450); R.rect(x1 - 4, dy, 1, 21, 0x6a4228);
      R.rect(-45, dy + 9, 3, 2, 0xd8b060); R.px(-45, dy + 9, 0xf4d890);
    }
    R.rect(x0 + 2, 286, 3, 5, 0x4e3222); R.rect(x1 - 5, 286, 3, 5, 0x4e3222);
    R.rect(-55, 222, 10, 2, 0x5a3a24); R.rect(-55, 222, 10, 1, 0x7a5236);
    [[-1, 1], [-2, 2], [-3, 2], [-3, 3], [-4, 3], [-4, 3], [-4, 4], [-4, 3], [-3, 4], [-4, 3]].forEach(([a, b], k) => {
      const y = 212 + k;
      for (let x = a; x <= b; x++) { const d = Math.abs(x - 0.3) + Math.abs(k - 6) * 0.45; R.emit(-50 + x, y, d < 1.4 ? 0xffc890 : d < 2.8 ? 0xf09060 : 0xc0583c); }
    });
    R.rect(-42, 225, 9, 3, 0x1a1a22); R.rect(-42, 225, 9, 1, 0x3a3a4a); R.px(-34, 226, 0x2a2a34); }
  yield;
}

function* paintRight(R, RT, withFloor) {
  // a shelf of books, a succulent and a candle, a warm light strip glowing under it
  R.shade(322, 104, 50, 3, 0.75);
  R.rect(322, 100, 50, 2, 0xc89a68); R.rect(322, 102, 50, 2, 0x8a603e); R.rect(322, 100, 50, 1, 0xdcb080);
  for (const bx of [328, 364]) { R.rect(bx, 105, 2, 6, 0x2e2a34); R.line(bx + 2, 105, bx + 6, 105, 0x2e2a34); R.line(bx + 1, 110, bx + 6, 106, 0x2e2a34); }
  let bx = 324;
  for (const [w, h, c] of [[3, 15, 0x4a6a9a], [4, 13, 0xc0604a], [3, 17, 0xd8b060], [3, 12, 0x5a8a6a], [4, 14, 0x8a5a8a], [3, 16, 0x3a7a8a]]) {
    R.rect(bx, 100 - h, w, h, c); R.rect(bx, 100 - h, w, 1, mixc(c, 0xffffff, 0.3)); R.rect(bx, 100 - h + 3, w, 1, mixc(c, 0xffffff, 0.45)); R.rect(bx + w - 1, 100 - h, 1, h, mixc(c, 0x000000, 0.25));
    bx += w;
  }
  R.poly([[bx + 1, 99], [bx + 4, 99], [bx + 11, 88], [bx + 8, 87]], 0xb05a5a); R.line(bx + 1, 99, bx + 8, 87, 0xd07a6a);
  R.rect(352, 94, 7, 6, 0xe8e0d4); R.rect(351, 93, 9, 1, 0xf6f0e6); R.rect(357, 94, 2, 6, 0xc0b8aa);
  for (const [x, y, c] of [[352, 91, 0x6aa878], [353, 90, 0x8ac898], [355, 89, 0x6aa878], [356, 90, 0x4a8a5a], [357, 91, 0x6aa878], [354, 92, 0x4a8a5a], [355, 91, 0x8ac898]]) R.px(x, y, c);
  R.rect(362, 93, 6, 7, 0xb8c4cc); R.rect(363, 95, 4, 4, 0xf0e6d0); R.rect(362, 93, 1, 7, 0xe0eaf0); R.px(365, 94, 0x2a2420);
  for (let x = 324; x < 370; x++) R.emit(x, 104, x & 1 ? 0xffc47a : 0xffdcaa);
  // a framed print, and a cassette poster
  { const x = 336, y = 38, w = 28, h = 22;
    R.rect(x, y, w, h, 0x3a2e28); R.rect(x + 1, y + 1, w - 2, h - 2, 0xf0e8da);
    R.vgrad(x + 3, y + 3, w - 6, h - 6, [0x23305a, 0x34407a, 0x6a5a92, 0xc88aa0], 1);
    R.ell(x + 18, y + 8, 2, 2, 0xfff0d0);
    R.poly([[x + 3, y + 19], [x + 10, y + 9], [x + 15, y + 14], [x + 19, y + 10], [x + 25, y + 19]], 0x2a2a4a);
    R.poly([[x + 8, y + 12], [x + 10, y + 9], [x + 12, y + 11]], 0xe8e4f4); }
  { const x = 378, y = 22, w = 36, h = 44;
    R.rect(x, y, w, h, 0x0e161c); R.vgrad(x + 1, y + 1, w - 2, h - 2, [0x1f3f48, 0x234a52, 0x2a5a62], 1);
    R.text('LOFI', x + 11, y + 5, 0xf4d0a0);
    R.rect(x + 6, y + 15, 24, 15, 0xe9dcc6); R.px(x + 6, y + 15, 0x234a52); R.px(x + 29, y + 15, 0x234a52);
    R.rect(x + 8, y + 17, 20, 4, 0xf08aa8); R.rect(x + 11, y + 22, 14, 5, 0x2a2a34);
    R.ell(x + 14, y + 24, 1, 1, 0xe9dcc6); R.ell(x + 22, y + 24, 1, 1, 0xe9dcc6); R.rect(x + 16, y + 23, 4, 1, 0x8a6a5a);
    R.rect(x + 10, y + 28, 16, 2, 0xc8bca6);
    R.rect(x + 9, y + 34, 18, 1, 0xf4d0a0); R.rect(x + 12, y + 37, 12, 1, 0x8ab8b8); }
  // the neon moon's mount (the tube is drawn each frame)
  R.px(339, 133, 0x8a8494); R.px(361, 133, 0x8a8494); R.px(339, 157, 0x8a8494); R.px(361, 157, 0x8a8494);
  yield;
  // the standing lamp
  if (withFloor) {
    const fx = FL_X;
    R.shade(fx - 12, 273, 26, 3, 0.65);
    R.ell(fx, 272, 8, 2, 0x2e2a34); R.rect(fx - 6, 271, 13, 1, 0x4a4450); R.rect(fx - 3, 270, 7, 1, 0x5a5462);
    R.rect(fx, 95, 2, 176, 0xb8904a); R.rect(fx, 95, 1, 176, 0xe0b86a);
    for (let y = 68; y < 95; y++) {
      const hw = Math.round(8 + ((y - 68) / 26) * 5);
      for (let x = fx - hw + 1; x <= fx + hw; x++) R.px(x, y, (x - fx + 40) % 4 === 0 ? 0xdccba6 : x - fx < -hw + 3 ? 0xfaf0d8 : 0xf3e6c8);
    }
    R.rect(fx - 7, 68, 16, 1, 0xcdbd98); R.rect(fx - 12, 94, 26, 1, 0xc8b490);
    for (let y = 96; y < 104; y++) R.px(fx + 7, y, 0xc8a060);
    R.rect(fx + 6, 104, 3, 2, 0xd8b060);
  }
  // a guitar leaning on the wall
  if (RT > 446) {
    const gx = 466;
    R.shade(gx + 6, 196, 10, 92, 0.82);
    R.line(gx - 3, 244, gx - 9, 197, 0x5a3a22); R.line(gx - 2, 244, gx - 8, 197, 0x6a4428); R.line(gx - 1, 244, gx - 7, 197, 0x5a3a22);
    for (let k = 0; k < 8; k++) { const t = k / 8; R.px(Math.round(gx - 2 - t * 6), Math.round(240 - t * 42), 0xd8d0c0); }
    R.rect(gx - 12, 184, 6, 13, 0x3a2414); R.rect(gx - 12, 184, 1, 13, 0x6a4428);
    for (const py of [186, 190, 194]) { R.px(gx - 13, py, 0xd8d0c0); R.px(gx - 5, py, 0xd8d0c0); }
    R.ell(gx, 274, 14, 12, 0x4a2a16); R.ell(gx - 1, 252, 11, 10, 0x4a2a16); R.rect(gx - 10, 252, 20, 22, 0x4a2a16);
    R.ell(gx, 274, 13, 11, 0xd8a058); R.ell(gx - 1, 252, 10, 9, 0xd8a058); R.rect(gx - 9, 254, 18, 18, 0xd8a058);
    for (let y = 244; y < 286; y++) for (let x = gx - 14; x < gx - 4; x++) { const i = R.at(x, y); if (i >= 0 && R.d[i] === 0xd8 && R.d[i + 1] === 0xa0 && R.at(x - 1, y) >= 0 && R.d[R.at(x - 1, y)] === 0x4a) R.px(x, y, 0xffe0a0); }
    for (let y = 244; y < 286; y++) for (let x = gx + 4; x < gx + 14; x++) { const i = R.at(x, y); if (i >= 0 && R.d[i] === 0xd8 && R.d[i + 1] === 0xa0) R.px(x, y, (x + y) % 5 ? 0xc08a48 : 0xb07a3c); }
    R.ell(gx - 1, 259, 3, 3, 0x8a5a2a); R.ell(gx - 1, 259, 2, 2, 0x1e120a);
    R.poly([[gx + 3, 262], [gx + 7, 264], [gx + 5, 269], [gx + 2, 266]], 0x6a3a1e);
    R.rect(gx - 5, 277, 10, 2, 0x3a2414); R.rect(gx - 4, 277, 8, 1, 0x5a3a22);
    R.line(gx - 2, 277, gx - 8, 197, 0xe8e0d0); R.line(gx, 277, gx - 6, 197, 0xc8c0b0);
    R.shade(gx - 14, 286, 28, 3, 0.65);
  }
  // a crate of records, a framed print of a lake above it
  if (RT > 478) {
    [0xd8584a, 0x2a2a34, 0xf0d070, 0x4a8ab0, 0xe08aa8, 0x2e6a72, 0xf2eee6, 0x8a5a8a, 0xd8a058, 0x3a3a5a].forEach((c, k) => {
      const x = 489 + k * 4, top = 251 - (k % 3) - (k === 4 ? 2 : 0);
      R.rect(x, top, 4, 14, c); R.rect(x, top, 4, 1, mixc(c, 0xffffff, 0.35)); R.rect(x + 3, top, 1, 14, mixc(c, 0x000000, 0.3));
    });
    R.rect(486, 262, 46, 30, 0x9a6a40); R.rect(486, 262, 46, 1, 0xc8946a);
    for (const yy of [271, 281]) { R.rect(486, yy, 46, 1, 0x5e3e24); R.rect(486, yy + 1, 46, 1, 0xb07e52); }
    R.rect(486, 262, 2, 30, 0x7a5232); R.rect(530, 262, 2, 30, 0x5e3e24);
    R.ell(509, 266, 4, 1, 0x3a2414);
    R.shade(484, 292, 50, 4, 0.6);
    const x = 486, y = 32, w = 42, h = 52;
    R.rect(x, y, w, h, 0x2e2836); R.rect(x + 2, y + 2, w - 4, h - 4, 0xf0e8da);
    R.vgrad(x + 4, y + 4, w - 8, 24, [0x2a5a7a, 0x4a8aa0, 0xc8a8a0, 0xf0c090], 1);
    R.ell(x + 28, y + 18, 3, 3, 0xfff0d0);
    R.poly([[x + 4, y + 30], [x + 15, y + 14], [x + 22, y + 24], [x + 28, y + 17], [x + 38, y + 30]], 0x34405a);
    R.poly([[x + 13, y + 17], [x + 15, y + 14], [x + 17, y + 17]], 0xe8eef8);
    for (let yy = y + 30; yy < y + h - 6; yy++) R.rect(x + 4, yy, w - 8, 1, yy % 2 ? 0x3a6a8a : 0x4a7a98);
    for (let yy = y + 31; yy < y + 40; yy += 2) R.rect(x + 26, yy, 4, 1, 0xf8d8a8);
    R.rect(x + 10, y + h - 5, 20, 1, 0x8a8494);
  }
  yield;
}

function* paintFront(R, ox, rw) {
  const L = -ox, RT = rw - ox;
  // the curtain rail and the fairy-light wire, all the way across
  R.rect(28, 7, 264, 2, 0x2e2a36); R.rect(28, 7, 264, 1, 0x5a5468);
  for (const x of [27, 293]) { R.rect(x - 2, 6, 4, 4, 0x6a6070); R.px(x - 1, 6, 0x9a90a0); }
  let prev = fairyY(L);
  for (let x = L; x < RT; x++) {
    const y = fairyY(x);
    for (let yy = Math.min(y, prev); yy <= Math.max(y, prev); yy++) R.px(x, yy, 0x2a2430);
    prev = y;
    const m = (((x - 20) % 40) + 40) % 40;
    if (m % 6 === 4 && m < 38) R.px(x, y + 1, 0x4a4450);
  }
  yield;

  // ——— the desk, in perspective: its sides open out towards us ———
  for (let y = DESK; y < 301; y++) {
    const a = Math.max(L, Math.round(deskL(y))), b = Math.min(RT, Math.round(deskR(y)));
    for (let x = a; x < b; x++) {
      const v = (y - DESK) ** 0.82 * 0.55 + Math.sin(x * 0.043 + (y - DESK) * 0.09) * 0.9 + Math.sin(x * 0.011) * 0.6;
      const f = v - Math.floor(v);
      R.px(x, y, f < 0.12 ? 0x97663f : f > 0.55 && f < 0.6 ? 0xbd8a5c : 0xab7a4f);
    }
    if (a > L) { R.px(a, y, 0xd8a676); R.px(a + 1, y, 0xc0905e); }
    if (b < RT) R.px(b - 1, y, 0x7a5236);
  }
  { const a = Math.max(L, Math.round(deskL(DESK))), b = Math.min(RT, Math.round(deskR(DESK))); R.rect(a, DESK, b - a, 1, 0x5a3e2a); }
  { const a = Math.max(L, Math.round(deskL(301))), b = Math.min(RT, Math.round(deskR(301)));
    R.rect(a, 301, b - a, 1, 0xd6a273); R.rect(a, 302, b - a, 1, 0xc08c5e); R.rect(a, 303, b - a, 15, 0x7c5236); R.rect(a, 318, b - a, 2, 0x3e2618);
    for (let x = a; x < b; x++) if ((x * 13) % 37 < 3) R.px(x, 305 + ((x * 7) % 11), 0x6e4830);
    if (a > L) { R.rect(a, 301, 1, 17, 0xa87650); R.px(a, 301, 0xe8b484); }
    if (b < RT) R.rect(b - 1, 301, 1, 17, 0x52341f); }
  R.rect(118, 305, 84, 1, 0x5c3a24); R.rect(118, 305, 1, 12, 0x5c3a24); R.rect(201, 305, 1, 12, 0x5c3a24); R.rect(119, 306, 82, 1, 0x8e6242);
  R.rect(157, 310, 6, 2, 0xd8b060); R.px(157, 310, 0xf4d890);
  yield;

  // a felt mat with a faint print of hills and a moon, and stitched edges
  R.rect(94, 248, 180, 50, 0x353a4c);
  for (let x = 96; x < 272; x++) { const y = 286 - Math.round(Math.sin(x * 0.045) * 4 + Math.sin(x * 0.11 + 1) * 2); R.px(x, y, 0x4a5068); R.rect(x, y + 1, 1, 295 - y, 0x30354a); }
  R.ell(228, 258, 3, 3, 0x464c64); R.ell(229, 257, 2, 2, 0x353a4c);
  for (const [x, y] of [[104, 256], [112, 262], [230, 268], [262, 254], [98, 270]]) R.px(x, y, 0x5a6080);
  R.rect(94, 248, 180, 1, 0x4a5066); R.rect(94, 248, 1, 50, 0x4a5066); R.rect(94, 297, 180, 1, 0x22263a); R.rect(273, 248, 1, 50, 0x22263a);
  for (let x = 97; x < 271; x += 3) { R.px(x, 250, 0x7a809a); R.px(x + 1, 250, 0x7a809a); R.px(x, 295, 0x6a7088); R.px(x + 1, 295, 0x6a7088); }
  for (let y = 251; y < 295; y += 3) { R.px(96, y, 0x7a809a); R.px(96, y + 1, 0x7a809a); R.px(271, y, 0x6a7088); R.px(271, y + 1, 0x6a7088); }

  // soft contact shadows, then the things on the desk
  R.shade(12, 230, 28, 6, 0.72); R.shade(38, 229, 48, 4, 0.75); R.shade(90, 229, 20, 3, 0.7); R.shade(142, 214, 36, 4, 0.7);
  R.shade(214, 242, 22, 3, 0.7); R.shade(242, 233, 54, 4, 0.72); R.shade(286, 259, 22, 4, 0.7); R.shade(102, 283, 118, 4, 0.7);
  R.shade(196, 244, 14, 2, 0.72);

  // the monitor, a sticky note on its bezel
  R.ell(160, 214, 15, 2, 0x22242c); R.rect(146, 213, 28, 1, 0x3a3d48);
  R.rect(157, 196, 7, 17, 0x26282f); R.rect(157, 196, 1, 17, 0x3a3d48);
  R.rect(118, 140, 84, 56, 0x22242c);
  R.rect(118, 140, 84, 1, 0x3c3f4c); R.rect(118, 140, 1, 56, 0x34374a); R.rect(201, 140, 1, 56, 0x16171c); R.rect(118, 195, 84, 1, 0x16171c);
  R.rect(119, 190, 82, 5, 0x1c1e25); R.px(160, 192, 0x5a5e70); R.px(160, 141, 0x0a0a0e);
  R.rect(192, 186, 8, 7, 0xf2d36b); R.rect(192, 186, 8, 1, 0xfff0a0); R.px(199, 192, 0xd8b850); R.rect(193, 188, 5, 1, 0xb09040); R.rect(193, 190, 4, 1, 0xb09040);
  yield;

  // the desk lamp, an architect's lamp in mustard; its shade isn't lit by its own bulb
  R.ell(25, 231, 11, 3, 0x2e2a30); R.ell(25, 230, 10, 2, 0x3e3840); R.rect(17, 229, 16, 1, 0x56505a);
  R.line(24, 229, 17, 192, 0xd9a441); R.line(25, 229, 18, 192, 0xa87a2a); R.line(28, 222, 21, 196, 0x8a8278);
  R.ell(18, 191, 1.5, 1.5, 0x3a3640);
  R.line(18, 190, 43, 158, 0xd9a441); R.line(19, 191, 44, 159, 0xa87a2a); R.line(22, 187, 41, 163, 0x8a8278);
  R.mark = 253;
  R.poly([[39, 154], [46, 149], [52, 150], [61, 162], [59, 167], [44, 168], [39, 161]], 0xb88428);
  R.line(39, 155, 39, 160, 0x96681e); R.line(52, 151, 60, 162, 0x8a5e1a); R.line(45, 163, 58, 163, 0xa07020);
  R.line(46, 149, 40, 154, 0xf2c260); R.line(47, 150, 52, 151, 0xf2c260); R.line(41, 155, 41, 158, 0xd8a440); R.px(43, 152, 0xd8a440);
  R.line(60, 163, 58, 167, 0x6a4a14); R.line(44, 168, 58, 167, 0x4a3410);
  R.rect(45, 147, 2, 2, 0x3a3640);
  R.mark = 0;
  // a cable from the lamp's base, off the back of the desk
  for (let x = 14; x > 2; x--) R.px(x, 229 - Math.round((14 - x) * 0.6 + Math.sin(x * 0.5)), 0x2a2830);

  // books with a little clock on top, sticky notes beside them
  for (const [x, y, w, h, c] of [[40, 222, 44, 8, 0x4a6aa0], [43, 215, 40, 7, 0xc8604a], [41, 209, 42, 6, 0xd9b464]]) {
    R.rect(x, y, w, h, c); R.rect(x, y, w, 1, mixc(c, 0xffffff, 0.35)); R.rect(x, y + h - 1, w, 1, mixc(c, 0x000000, 0.3));
    R.rect(x + w - 4, y + 1, 3, h - 2, 0xeee4d0); R.rect(x + w - 1, y, 1, h, mixc(c, 0x000000, 0.2));
    R.rect(x + 5, y + 1, 1, h - 2, mixc(c, 0xffffff, 0.3)); R.rect(x + 8, y + 2, 10, 1, mixc(c, 0xffffff, 0.5));
  }
  R.rect(50, 199, 24, 10, 0x2a2830); R.rect(50, 199, 24, 1, 0x48444e); R.rect(51, 200, 22, 8, 0x141218); R.rect(50, 208, 24, 1, 0x1a181e);
  R.shade(60, 249, 22, 2, 0.75);
  R.rect(60, 238, 10, 10, 0xf4dc7a); R.rect(60, 238, 10, 1, 0xfff0a0); R.px(69, 247, 0xc8b060); R.px(68, 247, 0xd8c068);
  for (const yy of [241, 243, 245]) R.rect(62, yy, 4 + (yy % 3), 1, 0xb8a050);
  R.rect(71, 242, 9, 8, 0xf4a8c0); R.rect(71, 242, 9, 1, 0xffc8d8); R.rect(73, 245, 5, 1, 0xc87890); R.px(75, 247, 0xd05050);
  yield;

  // the lava lamp's base and cap (the glass is drawn each frame)
  R.poly([[90, 231], [111, 231], [107, 218], [94, 218]], 0x8c91a0);
  R.line(93, 219, 91, 230, 0xc8ccd8); R.line(107, 219, 109, 230, 0x5a5e6a); R.rect(89, 231, 23, 1, 0x4a4e5a); R.rect(94, 218, 13, 1, 0xb0b4c0); R.rect(92, 225, 17, 1, 0x6e7280);
  R.poly([[96, 182], [105, 182], [103, 176], [98, 176]], 0x8c91a0); R.line(97, 181, 98, 177, 0xc8ccd8); R.rect(99, 175, 3, 1, 0x6a6e7a);

  // the record player, its sleeve leaning on the wall behind
  R.rect(268, 188, 20, 20, 0x2a7a84); R.rect(268, 188, 20, 1, 0x4a9aa0); R.rect(287, 188, 1, 20, 0x1e5a62);
  R.ell(278, 197, 6, 6, 0xf08a4a); R.ell(278, 197, 3, 3, 0xf4b0a0); R.px(278, 197, 0x2a7a84);
  R.rect(270, 205, 10, 1, 0xe8f0e8);
  R.rect(244, 208, 50, 20, 0x8e5c3a); R.rect(244, 208, 50, 1, 0xb07a52); R.rect(244, 227, 50, 1, 0xc08a5e);
  R.rect(244, 228, 50, 6, 0x5e3a24); R.rect(244, 208, 1, 26, 0xa06c48); R.rect(293, 208, 1, 26, 0x4a2c1c);
  R.px(282, 230, 0xd8d8e0); R.px(287, 230, 0xd8d8e0); R.px(282, 231, 0x8a8a94); R.px(287, 231, 0x8a8a94);
  R.emit(250, 230, 0x6af08a);
  R.ell(262, 218, 14, 6, 0xa8a8b4); R.ell(262, 218, 13, 5, 0x6a6a76);
  R.ell(285, 213, 2, 2, 0x9a9aa6); R.px(284, 212, 0xe0e0ea); R.rect(288, 222, 1, 3, 0x5a5a66);
  R.rect(276, 222, 3, 1, 0x707080);

  // a candle in a jar; the mug; a cutting rooting in a jar of water
  R.rect(235, 212, 8, 11, 0xb8c6d0); R.rect(236, 214, 6, 8, 0xf2e8d4); R.rect(235, 212, 1, 11, 0xe4eef4); R.rect(242, 212, 1, 11, 0x8a98a6);
  R.rect(235, 217, 8, 3, 0x7a5a9a); R.rect(236, 218, 6, 1, 0xd8c8e8); R.px(238, 213, 0x2a2420); R.rect(235, 222, 8, 1, 0x6a7886);
  R.rect(216, 226, 14, 16, 0xece0cc); R.rect(217, 227, 2, 14, 0xfff6e6); R.rect(227, 227, 3, 14, 0xc8b8a0); R.rect(216, 241, 14, 1, 0xb8a890);
  R.rect(216, 232, 14, 3, 0xd06a56); R.rect(227, 232, 3, 3, 0xa85444); R.rect(217, 232, 2, 3, 0xe88a76);
  R.rect(216, 224, 14, 2, 0xf6ecdc); R.rect(218, 224, 10, 2, 0x4a2c20); R.px(219, 224, 0x7a4a34); R.rect(217, 223, 12, 1, 0xfff8ec);
  R.rect(230, 229, 3, 1, 0xd8ccb8); R.rect(232, 230, 2, 6, 0xd8ccb8); R.rect(230, 236, 3, 1, 0xd8ccb8); R.px(233, 231, 0xb8aa94);
  R.rect(197, 232, 9, 12, 0x9ab4c0); R.rect(198, 236, 7, 7, 0x6a9ab0); R.rect(198, 236, 7, 1, 0xb8e0ec); R.rect(197, 232, 1, 12, 0xd8eef4); R.rect(205, 232, 1, 12, 0x5a7a88);
  R.rect(197, 231, 9, 1, 0xc8dce4); R.line(201, 242, 202, 226, 0x4e8a3e); R.px(201, 239, 0xd8e8c8); R.px(200, 240, 0xd8e8c8);
  { const lr = rng(7); leaf(R, 197, 223, 0, lr()); leaf(R, 202, 221, 1, 0.9); }

  // a pothos in a terracotta pot (its trailing vines are drawn separately, so they can sway)
  R.poly([[287, 241], [307, 241], [304, 261], [290, 261]], 0xc4704a);
  R.line(303, 242, 302, 260, 0x9a5434); R.line(289, 242, 291, 260, 0xe09068);
  R.rect(286, 238, 22, 3, 0xd8845a); R.rect(286, 238, 22, 1, 0xeca070); R.rect(288, 239, 18, 1, 0x3a2418);
  const lr = rng(17);
  for (const [x, y, f] of [[284, 230, 0], [289, 226, 0], [295, 222, 1], [300, 226, 1], [305, 230, 1], [292, 232, 0], [298, 231, 1], [287, 234, 0], [303, 234, 1], [296, 227, 0], [291, 219, 0], [301, 218, 1]]) leaf(R, x, y, f, lr());
  yield;

  // keyboard case (the keys are lit each frame), the mouse and its cable, a phone face up
  for (let y = 252; y <= 281; y++) { const u = (y - 252) / 29, x0 = Math.round(108 - u * 5), x1 = Math.round(213 + u * 5); R.rect(x0, y, x1 - x0, 1, 0x2c2e38); }
  R.rect(108, 252, 105, 1, 0x4a4d5c); R.rect(103, 282, 115, 3, 0x1a1b22);
  R.ell(242, 272, 5, 7, 0xc9c9d4); R.rect(239, 267, 2, 6, 0xeeeef6); R.rect(246, 270, 1, 6, 0x9a9aa8);
  R.rect(242, 265, 1, 5, 0x8a8a98); R.px(242, 267, 0x4a4a58); R.line(242, 264, 246, 250, 0x2a2a34); R.shade(237, 279, 11, 2, 0.75);
  R.shade(254, 282, 11, 2, 0.7);
  R.rect(254, 268, 10, 14, 0x1c1c26); R.rect(254, 268, 10, 1, 0x4a4a5a); R.rect(254, 268, 1, 14, 0x3a3a48); R.rect(255, 269, 8, 12, 0x101018); R.px(258, 280, 0x2a2a34);

  // a notebook and pen, the headphones put down beside it
  for (let y = 284; y < 301; y++) {
    const sx = 56 + Math.round((y - 284) * 0.35);
    R.rect(sx, y, 34, 1, 0xf0e7d4);
    if (y > 286 && (y - 286) % 3 === 0) R.rect(sx + 5, y, 27, 1, 0xb4c0d6);
    R.px(sx + 3, y, 0xe09090);
    if (y % 2 === 0) R.px(sx - 1, y, 0x6a6a74);
  }
  R.rect(62, 300, 34, 1, 0xc8bca6);
  R.line(64, 297, 86, 288, 0x2e4a7a); R.line(64, 298, 86, 289, 0x22385e); R.line(82, 290, 86, 288, 0xd8b060); R.px(63, 298, 0xc0c0c8);
  for (let a = 0; a <= 40; a++) {
    const th = Math.PI * (a / 40), x = 34 - Math.cos(th) * 16, y = 279 - Math.sin(th) * 15;
    R.px(x, y, 0x3a3a46); R.px(x, y + 1, 0x2a2a32); if (a > 12 && a < 28) R.px(x, y - 1, 0x5a5a68);
  }
  for (const cx of [18, 50]) { R.ell(cx, 282, 5, 7, 0x26262e); R.ell(cx, 282, 3, 5, 0x3c3c48); R.rect(cx - 3, 277, 2, 3, 0x5a5a68); R.px(cx + 4, 279, 0xd9a441); }

  if (RT > 326) {
    R.rect(328, 190, 14, 22, 0x2a2a32); R.rect(328, 190, 14, 1, 0x4a4a56); R.rect(341, 191, 1, 21, 0x1a1a20);
    R.ell(335, 204, 4, 4, 0x1a1a20); R.ell(335, 204, 2, 2, 0x3a3a46); R.ell(335, 195, 1.5, 1.5, 0x3a3a46); R.shade(326, 212, 18, 3, 0.7);
    R.rect(320, 238, 26, 13, 0xeeeae2); R.rect(321, 236, 24, 2, 0xe2ded6); for (let k = 0; k < 3; k++) R.rect(324, 241 + k * 3, 18, 1, 0xb0b0c0);
    R.line(322, 254, 344, 249, 0xe8b84a); R.px(344, 249, 0x3a2a2a); R.shade(320, 251, 27, 2, 0.75);
  }
  if (L < -6) {
    // a cup of pens and a little speaker at the desk's far left
    R.rect(-6, 214, 9, 11, 0x5a7a9a); R.rect(-6, 214, 9, 1, 0x7a9aba); R.rect(2, 214, 1, 11, 0x3a5a7a);
    for (const [x, c] of [[-5, 0xd8584a], [-3, 0xf0d070], [-1, 0x4a8ab0], [1, 0x2a2a34]]) R.line(x, 213, x + (x < -2 ? -1 : 1), 206, c);
    R.shade(-7, 225, 11, 2, 0.7);
  }
  yield;
}

// the curtains: tied back, or let down to cover the outer panes; p runs from 0 (tied) to 1 (drawn)
function curtainEdge(side, y, p) {
  const e = y < TIE ? Math.sin(((y - 10) / (TIE - 10)) * Math.PI / 2) : 1 - ((y - TIE) / (DESK - TIE)) * 0.5;
  const tied = side < 0 ? 82 - 15 * e : 238 + 15 * e;
  const drawn = side < 0 ? 128 + Math.sin(y * 0.07) * 1.2 : 192 - Math.sin(y * 0.07 + 1) * 1.2;
  return tied + (drawn - tied) * p;
}
function paintCurtain(S, side, p) {
  const outer = side < 0 ? 34 : 286, nf = 7 + p * 4;
  for (let y = 10; y < DESK; y++) {
    const inner = Math.round(curtainEdge(side, y, p));
    const x0 = Math.min(inner, outer), x1 = Math.max(inner, outer), wd = Math.max(1, x1 - x0);
    for (let x = x0; x <= x1; x++) {
      const overSill = side < 0 ? x >= 58 : x <= 262;
      const hem = overSill ? Math.round(DESK + (167 - DESK) * p) : DESK;
      if (y > hem) continue;
      const u = side < 0 ? (x - x0) / wd : (x1 - x) / wd;
      const v = Math.sin(u * Math.PI * nf + 0.6) * 0.5 + 0.5 + (S.bay(x, y) - 0.5) * 0.25;
      let c = v > 0.8 ? 0xcf90a0 : v < 0.26 ? 0x8a4b5e : 0xb36d7e;
      if (x === x0 || x === x1 || y === hem) c = 0x7a3e52;
      S.px(x, y, c);
    }
    if (p < 0.5 && y >= TIE - 1 && y <= TIE + 1) for (let x = x0; x <= x1; x++) S.px(x, y, (x + y) % 3 === 0 ? 0x9a7028 : y === TIE - 1 ? 0xf0c868 : 0xd9a84a);
  }
  const inTop = Math.round(curtainEdge(side, 10, p));
  for (let k = 0; k < 9 + p * 6; k++) { const x = side < 0 ? outer + 2 + k * ((inTop - outer - 4) / (8 + p * 6)) : outer - 3 - k * ((outer - inTop - 4) / (8 + p * 6)); S.rect(Math.round(x), 8, 2, 3, 0x6a6070); S.px(Math.round(x), 10, 0x9a90a0); }
  if (p < 0.5) { const tx = side < 0 ? 68 : 252; S.rect(tx - 1, 126, 3, 4, 0xd9a84a); S.px(tx, 130, 0xa0782a); S.px(tx - 1, 131, 0xd9a84a); S.px(tx + 1, 131, 0xd9a84a); }
}

// the cat, a ginger, curled on the sill: breathing, and now and then an ear flicks
const CAT = [
  '..o.....o...........................',
  '.obo...obo..........................',
  '.obpo.opbo....ooooooooooo...........',
  'obbbbobbbbo.oohhhhhhhhhhhoo.........',
  'obbbbbbbbbbohhbbsbbbbsbbbbhoo.......',
  'obbbbbbbbbbbhbbsbbbbsbbbbsbbhoo.....',
  'obeebbbbeebbbbbbbbbbbbbbbbbbbbbo....',
  'obbbbbbbbbbbsbbbbbbbbbbbbbbbbbbbo...',
  'obbbwwpwwbbbbsbbbbbbbbbbbbbbbbbbbo..',
  '.obwwwwwwwbbbbbbbbbbbbbbbbbbbbbbbbo.',
  '.oowwwwwwbbobbbbbbbbbbbbbbbbbbbbbdo.',
  '.owwwoowwwoddddddddddddddddddddddddo',
  '..ooo..ooootttttttttttttttttttttttto',
  '.........owwttttttttttttttttttttdddo',
  '..........ooooooooooooooooooooooooo.',
];
const CATC = { o: 0x4a2a1a, b: 0xd98a4c, s: 0xb86a34, h: 0xf0aa6a, d: 0xa85e30, w: 0xf2dcc0, p: 0xe89a9a, e: 0x3a2014, t: 0xc87a40 };
function paintCat(S, breath, twitch) {
  const ox = 76, oy = 154, grid = CAT.map((row) => [...row]);
  const span = breath === 2 ? [14, 30] : breath === 1 ? [17, 27] : null;
  if (span) for (let x = span[0]; x < span[1]; x++) { const y0 = grid.findIndex((row) => row[x] !== '.'); if (y0 > 0) { grid[y0 - 1][x] = 'o'; grid[y0][x] = 'h'; } }
  if (twitch) { grid[0][2] = '.'; grid[1][2] = 'o'; grid[1][1] = '.'; grid[2][1] = 'o'; }
  grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== '.') S.px(ox + x, oy + y, CATC[ch]); }));
  for (let x = 0; x < 36; x++) { const y0 = grid.findIndex((row) => row[x] !== '.'); if (y0 >= 0 && y0 < 11) S.emit(ox + x, oy + y0, x < 11 ? 0x9a8aa8 : 0xa8b4d0); }
}
// the tail, wrapped round the front of the cat on the sill, its tip over the edge; now and then it flicks
const TAILS = [
  [[111, 165], [111, 168], [107, 169], [100, 169], [94, 169], [90, 169], [88, 170], [87, 172]],
  [[111, 165], [111, 168], [107, 169], [100, 169], [94, 169], [90, 168], [88, 167], [87, 165]],
  [[111, 165], [111, 168], [107, 169], [100, 169], [94, 169], [90, 169], [87, 169], [85, 168]],
];
function paintTail(S, k) {
  const pts = TAILS[k], samples = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
    for (let j = 0; j < n; j++) samples.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  for (const [x, y] of samples) S.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, 0x4a2a1a);
  samples.forEach(([x, y], i) => {
    const stripe = Math.floor(i / 4) % 2, tip = i > samples.length - 5;
    S.px(Math.round(x), Math.round(y), tip ? 0xf0aa6a : stripe ? 0xb86a34 : 0xd98a4c);
  });
}

// the pothos vines trailing over the desk's edge; sway shifts the far ends a little
function paintVine(S, sway) {
  const r = rng(29);
  const vines = [
    [[305, 243], [312, 262], [316, 284], [317, 302], [318, 324]],
    [[290, 255], [284, 274], [279, 292], [277, 301], [276, 318]],
  ];
  for (const pts of vines) {
    const seg = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 12; k++) {
      const u = k / 12, [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      seg.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
    }
    seg.forEach(([x, y], i) => {
      const f = i / seg.length, dx = Math.round(sway * f ** 1.4 * 2.2);
      S.px(x + dx, y, 0x4e8a3e);
      if (i % 5 === 2) leaf(S, x + dx + (i % 10 < 5 ? -4 : 1), y - 1, i % 10 < 5 ? 0 : 1, r());
    });
  }
}

// a monstera in a woven basket beside the desk: big split leaves at different angles,
// overlapping, with a rim of lamplight on the side towards the standing lamp
const MONSTERA = [   // stem angle, stem length, leaf direction, leaf size, depth (0 = furthest)
  [-1.92, 74, -2.5, 25, 0], [-1.16, 80, -0.55, 26, 0], [-1.6, 108, -1.75, 23, 0], [-1.38, 66, -0.9, 22, 1],
  [-2.2, 92, -2.75, 22, 1], [-2.55, 46, 2.75, 22, 1], [-0.72, 50, 0.2, 23, 2], [-1.78, 50, -2.3, 20, 2],
];
function paintPlant(S, lean) {
  const bx = 386;
  const tips = MONSTERA.map(([a, l, th, s, d]) => ({ x: bx + Math.cos(a) * l + lean * (l / 100) * 2.4, y: 247 + Math.sin(a) * l, th: th + lean * 0.05, s, d, a, l }));
  for (const t of tips) {
    const sx = bx + Math.cos(t.a) * 3, cx = bx + Math.cos(t.a) * t.l * 0.25, cy = 247 + Math.sin(t.a) * t.l * 0.7, n = Math.ceil(t.l * 1.6);
    for (let k = 0; k <= n; k++) {
      const u = k / n, x = (1 - u) ** 2 * sx + 2 * u * (1 - u) * cx + u * u * t.x, y = (1 - u) ** 2 * 247 + 2 * u * (1 - u) * cy + u * u * t.y;
      S.px(x, y, t.d === 0 ? 0x2e5a2a : 0x3e7434); if (u < 0.5) S.px(x + 1, y, 0x2a5426);
    }
  }
  for (const t of [...tips].sort((a, b) => a.d - b.d)) {
    const ca = Math.cos(t.th), sa = Math.sin(t.th), R0 = t.s + 2, shade = [0.3, 0.13, 0][t.d];
    for (let y = Math.floor(t.y - R0); y <= t.y + R0; y++) for (let x = Math.floor(t.x - R0); x <= t.x + R0; x++) {
      const dx = x + 0.5 - t.x, dy = y + 0.5 - t.y, u = (dx * ca + dy * sa) / t.s, v = (-dx * sa + dy * ca) / t.s;
      if (u < -0.16 || u > 1) continue;
      // heart-shaped: two lobes at the stem, widest a third of the way out, a pointed tip
      const w = u < 0 ? 0.36 * Math.sqrt(1 + u / 0.16) : 0.44 * Math.sin(Math.PI * Math.min(1, (u + 0.02) * 0.98)) ** 0.7 * (1 - u * 0.25);
      const av = Math.abs(v);
      if (av > w || (u < 0.02 && av < 0.06)) continue;
      // deep splits running in from the edge, and a row of holes beside the midrib
      if (u > 0.1 && u < 0.92 && av > 0.12) { const sl = (u * 4.2 + av * 1.6) % 1; if (sl < 0.2) continue; }
      if (sq((u - 0.4) * 3, (av - 0.09) * 9) < 0.42 || sq((u - 0.66) * 3.2, (av - 0.08) * 9) < 0.36) continue;
      let c = v < 0 ? 0x5cb262 : 0x3c8a48;
      if (av < 0.03 && u > 0 && u < 0.9) c = 0x92d886;
      else if (v < -w * 0.6) c = 0x7ccc74;
      const edge = av > w - 0.08 || u > 0.94;
      if (edge) c = dx * 0.99 - dy * 0.15 > 0 ? 0xd2ec98 : 0x2a6232;
      S.px(x, y, mixc(c, 0x183820, shade));
    }
  }
  for (let y = 250; y < 280; y++) {
    const hw = Math.round(12 - ((y - 250) / 29) * 2);
    for (let x = bx - hw; x <= bx + hw; x++) {
      const weave = (x + (Math.floor(y / 3) % 2) * 2) % 4 < 2;
      S.px(x, y, x === bx - hw ? 0xd8aa70 : x === bx + hw ? 0x7a5432 : weave ? 0xb88c58 : 0x9a7244);
    }
  }
  S.rect(bx - 13, 248, 27, 3, 0xd0a46a); S.rect(bx - 13, 248, 27, 1, 0xe6bc80); S.rect(bx - 11, 249, 23, 1, 0x3a2a1e);
  for (let x = bx - 10; x < bx + 11; x++) S.px(x, 279, 0x5a3a22);
}

/* ——— building a room for one width: in steps, so it can be spread over a few frames ——— */
const ROOMS = new Map();   // a few recent widths (the frame and full screen), so switching back is instant
function sprite(x0, y0, w, h, paint) { return { x0, y0, w, h, paint, ras: null, img: [] }; }
function spriteImg(RM, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras && !sp.paint) return sp.img[k & 1] || sp.img[0];   // a baked layer whose raster was let go
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = bakeOne(sp.ras, sp.x0 + RM.ox, sp.y0, RM.F, k & 1, k >> 1);
  }
  return sp.img[k];
}
const roomW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);

function* buildRoom(rw) {
  const ox = Math.floor((rw - 320) / 2), wide = ox > 0, RT = rw - ox, withFloor = wide && RT > FL_X - 13;
  const back = new Ras(rw, H, ox, 0), front = new Ras(rw, H, ox, 0);
  yield* paintBack(back, ox, rw, withFloor);
  yield* paintFront(front, ox, rw);
  const n = rw * H, F = { rw, C: new Float32Array(n), W: new Float32Array(n), L: new Float32Array(n), F: withFloor ? new Float32Array(n) : null };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) {
      const cx = X - ox, j = y * rw + X;
      F.C[j] = coolAt(cx, y, rw); F.W[j] = warmAt(cx, y, wide); F.L[j] = lampAt(cx, y);
      if (F.F) F.F[j] = floorAt(cx, y);
    }
    if (y % 48 === 47) yield;
  }
  const RM = {
    bw: rw, ox, wide, withFloor, F, keys: withFloor ? [0, 1, 2, 3] : [0, 1],
    back: { x0: -ox, y0: 0, w: rw, h: H, ras: back, img: [] }, front: { x0: -ox, y0: 0, w: rw, h: H, ras: front, img: [] },
    cat: [], tail: [0, 1, 2].map((k) => sprite(82, 162, 34, 14, (S) => paintTail(S, k))),
    vine: [-1, 0, 1].map((sw) => sprite(270, 230, 52, 90, (S) => paintVine(S, sw))),
    plant: wide ? [-1, 0, 1].map((ln) => sprite(300, 104, 172, 178, (S) => paintPlant(S, ln))) : null,
    curt: [-1, 1].map((side) => Array.from({ length: 7 }, (_, f) => sprite(side < 0 ? 30 : 188, 6, 103, 202, (S) => paintCurtain(S, side, f / 6)))),
    bulbs: [],
  };
  for (const b of [0, 1, 2]) for (const tw of [0, 1]) RM.cat.push(sprite(74, 152, 44, 20, (S) => paintCat(S, b, tw)));
  for (const k of RM.keys) { spriteImg(RM, RM.back, k); yield; spriteImg(RM, RM.front, k); yield; }
  const small = [...RM.cat, ...RM.tail, ...RM.vine, ...(RM.plant || []), RM.curt[0][0], RM.curt[1][0]];
  for (const k of RM.keys) { for (const sp of small) spriteImg(RM, sp, k); yield; }
  RM.back.ras = null; RM.front.ras = null;
  for (let x = -ox; x < rw - ox; x++) { const m = (((x - 20) % 40) + 40) % 40; if (m % 6 === 4 && m < 38) RM.bulbs.push({ x, y: fairyY(x) + 2, i: RM.bulbs.length }); }
  ROOMS.set(rw, RM);
  while (ROOMS.size > 3) ROOMS.delete(ROOMS.keys().next().value);
  return RM;
}
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value; if (performance.now() > end) return null; }
}
const roomFor = (rw) => ROOMS.get(rw) || finish(buildRoom(rw));

/* ——— glows and colour ladders for the moving parts ——— */
let FX = null;
const KB = [0xd86aa8, 0x9a7ad8, 0x5ab8d8];   // the keyboard's colours: pink, violet, cyan, and back
const kbAt = (u) => { const t = (((u % 1) + 1) % 1) * 4, i = Math.floor(t), f = t - i, seq = [0, 1, 2, 1, 0]; return mixc(KB[seq[i]], KB[seq[i + 1]], f); };
function fx() {
  if (FX) return FX;
  const lad = (c, dim) => [0, 1, 2, 3].map((l) => hex(mixc(dim, c, 0.25 + l * 0.25)));
  const BW_ = [0xffd27a, 0xffb070, 0xffe9b0, 0xff9f80], BC = [0xff6fae, 0x5ff0e0, 0xffc060, 0xb08aff, 0xff8a70];
  FX = {
    warm: BW_.map((c) => ({ lad: lad(c, 0x3a2a24), g: glow(6, 6, c, 0.75, 4) })),
    white: { lad: lad(0xffe6b4, 0x3a2a24), g: glow(6, 6, 0xffe6b4, 0.75, 4) },
    col: BC.map((c) => ({ lad: lad(c, 0x2a2430), g: glow(6, 6, c, 0.8, 4) })),
    lip: glow(10, 5, 0xffd890, 0.9, 4), floorG: glow(46, 50, 0xffc078, 0.5, 5),
    lava: LAVA.map((p) => glow(22, 26, p.blob, 0.45, 4)), pool: LAVA.map((p) => glow(18, 5, p.blob, 0.7, 3)),
    lava2: LAVA.map((p) => ({ liquid: hex(p.liquid), blob: hex(p.blob), light: hex(p.light) })),
    clock: glow(16, 8, 0xff7a4a, 0.4, 4), candle: glow(10, 10, 0xffb050, 0.7, 4), led: glow(3, 3, 0x6af08a, 0.6, 3),
    salt: glow(16, 14, 0xff9a60, 0.55, 4), strip: glow(30, 7, 0xffc078, 0.45, 3), phone: glow(9, 9, 0x8ab8ff, 0.6, 3),
    heat: glow(64, 14, 0xff9a50, 0.35, 3),
    keys: Array.from({ length: 12 }, (_, i) => glow(66, 16, kbAt(i / 12), 0.4, 4)),
    kb: Array.from({ length: 48 }, (_, i) => { const c = kbAt(i / 48); return [0.22, 0.4, 0.58, 0.78, 1].map((m) => hex(mixc(0x161420, c, m))).concat(hex(mixc(c, 0xffffff, 0.35))); }),
    steam: Array.from({ length: 11 }, (_, k) => rgba(0xe2e8fa, k * 0.04)),
    mote: Array.from({ length: 8 }, (_, k) => rgba(0xffe6c0, (k + 1) * 0.07)),
    wisp: Array.from({ length: 6 }, (_, k) => rgba(0xffc890, (k + 1) * 0.05)),
  };
  // the desk lamp's beam, faint in the air: a few flat steps
  const cone = new Ras(110, 80);
  for (let y = 0; y < 72; y++) {
    const u = y / 72, l = 46 - u * 22, r = 58 + u * 54;
    for (let x = Math.ceil(l); x < r; x++) {
      const e = Math.min(x - l, r - x) / (r - l), a = Math.min(1, e * 4) * (1 - u * 0.45);
      const q = band(a * 3, x, y);
      if (q > 0) cone.px(x, y, 0xffd9a0, q * 0.035);
    }
  }
  FX.cone = cone.canvas();
  const fc = new Ras(120, 270);
  for (let y = 0; y < 270; y++) {
    const up = y < 70, u = up ? (70 - y) / 70 : (y - 95) / 175;
    if (!up && y < 95) continue;
    const hw = up ? 8 + u * 30 : 13 + u * 42;
    for (let x = Math.ceil(60 - hw); x < 60 + hw; x++) {
      const e = 1 - Math.abs(x - 60) / hw, a = Math.min(1, e * 3) * (1 - u * 0.75) * (up ? 1 : 0.65);
      const q = band(a * 3, x, y);
      if (q > 0) fc.px(x, y, 0xffd09a, q * 0.024);
    }
  }
  FX.floorCone = fc.canvas();
  // the neon moon: a crescent of tube and a little star, in three colours
  FX.moon = MOONS.map(([tube, core]) => {
    const R = new Ras(31, 31), inC = (x, y) => sq(x, y) <= 10.5 && sq(x - 4.5, y + 3) > 8.5;
    for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) {
      if (!inC(x, y)) continue;
      const edge = !inC(x + 1, y) || !inC(x - 1, y) || !inC(x, y + 1) || !inC(x, y - 1);
      if (edge) { R.px(x + 15, y + 15, core); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inC(x + dx, y + dy)) R.px(x + 15 + dx, y + 15 + dy, tube, 0.5); }
    }
    for (const [x, y] of [[9, -9], [9, -10], [9, -8], [8, -9], [10, -9]]) R.px(x + 15, y + 15, core);
    return { tube: R.canvas(), g: glow(28, 24, tube, 0.6, 4) };
  });
  const glyph = (rows) => { const R = new Ras(rows[0].length, rows.length); rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') R.px(x, y, 0xe6e8ff); })); return R.canvas(); };
  FX.z = glyph(['####', '..#.', '.#..', '####']);
  FX.note = glyph(['.##', '.#.', '##.', '##.']);
  FX.cursor = glyph(['#...', '##..', '###.', '####', '.#..']);
  FX.digits = {};
  for (const ch of '0123456789:.') { const R = new Ras(3, 5); R.text(ch, 0, 0, 0xff8a5a); FX.digits[ch] = R.canvas(); }
  return FX;
}

/* ——— state ——— */
function newCodeLine(r) {
  const n = 1 + Math.floor(r() * 5), tokens = [];
  for (let i = 0; i < n; i++) tokens.push({ w: 2 + Math.floor(r() * 9), c: Math.floor(r() * TOK.length) });
  return { indent: Math.floor(r() * 4), tokens, typed: 0, total: tokens.reduce((a, b) => a + b.w + 1, 0) };
}
function paneDrop(r, d) {
  const p = PANES[r() < 0.3 ? Math.floor(r() * 2) : 2 + Math.floor(r() * 2)];
  d.pane = p; d.x = p[0] + 2 + Math.floor(r() * (p[2] - 4)); d.y = p[1] + r() * p[3] * 0.6; d.v = 0; d.hold = r() * 2.5; d.len = 0; d.big = r() < 0.4;
  return d;
}
const UMBRELLAS = ['#ff6fae', '#5fe0e8', '#ffd060', '#e8e8f0', '#b08aff'];
const CARS = ['#2a3046', '#4a2a36', '#2e3e4a', '#3a3a44'];
function makeState(seed) {
  const r = rng(seed), O = outside();
  const s = {
    r, t: 0, weather: 'rain', lv: { rain: 1, snow: 0, clear: 0 },
    lampOn: true, lamp: 1, floorOn: true, floor: 1, screen: 0, lava: 0, fairy: 0,
    recordOn: true, arm: 1, spd: 3.5, spin: 0, vis: 1, candleOn: true,
    purr: 0, bph: 0, twitch: 0, tailT: 5, tailF: 0, zzz: [], notes: [], waves: [], steam: [], steamBoost: 0, vineKick: 0, plantKick: 0, dateT: 0,
    curt: [{ p: 0, to: 0 }, { p: 0, to: 0 }], moon: 0, moonF: 0, salt: 0, heat: 0, wisps: [], calT: -1, calDay: 0, horn: 0,
    ph: { on: 0, wait: 18 + r() * 20, every: 30 }, ph2: { on: 0, wait: 40 + r() * 40, every: 70 },
    cur: { t: 0, x: 40, y: 20, tx: 40, ty: 20 }, burst: 0, track: 0, trackT: 0, food: [],
    fish: [['#ffa040', 13], ['#ff6f91', 22], ['#7ee8fa', 30], ['#ffd84a', 17]].map(([c, y]) => ({ c, x: 10 + r() * 58, y, tx: 10 + r() * 58, ty: y, dir: 1, wait: r() * 4 })),
    code: [], drops: Array.from({ length: 30 }, () => paneDrop(r, {})),
    streaks: Array.from({ length: 110 }, (_, i) => ({ x: r() * (GW + 40), y: r() * GH, v: i < 60 ? 320 + r() * 120 : 200 + r() * 60, l: i < 60 ? 8 + Math.floor(r() * 6) : 4 + Math.floor(r() * 3), far: i >= 60 })),
    buckets: Array.from({ length: 5 }, () => []),
    flakes: Array.from({ length: 110 }, (_, i) => ({ x: r() * GW, y: r() * GH, v: i < 40 ? 20 + r() * 12 : 9 + r() * 7, p: r() * 6.3, big: i < 40 })),
    motes: Array.from({ length: 22 }, () => ({ x: 34 + r() * 90, y: 172 + r() * 70, vx: (r() - 0.5) * 3, vy: -1 - r() * 3, p: r() * 6.3 })),
    blobs: Array.from({ length: 5 }, (_, i) => ({ ph: r() * 6.3, sp: 0.08 + r() * 0.08, r: 2.2 + r() * 1.8, i })),
    splashes: [], puffs: [], train: { x: 0, dir: 1, on: false, wait: 6 + r() * 4 }, plane: null, planeWait: 14 + r() * 20, shooting: null,
    cars: [], carWait: 1, walkers: Array.from({ length: 3 }, (_, i) => ({ x: 30 + i * 40 + r() * 20, dir: r() < 0.5 ? 1 : -1, v: 1.6 + r() * 1.4, c: UMBRELLAS[Math.floor(r() * UMBRELLAS.length)] })),
    neon: O.signs.map((sg) => ({ ft: 0, dur: 1, dead: -1, wait: 8 + r() * sg.every })),
    flick: Array.from({ length: Math.min(22, O.geo.wins.length) }, () => { const w = O.geo.wins[Math.floor(r() * O.geo.wins.length)]; return { w, off: hex(w.off), on: true, timer: 3 + r() * 20 }; }),
    person: { x: 12, to: 12, wait: 4 },
    tv: O.geo.tvs.slice(0, 2).map(() => ({ c: 0, timer: 0 })),
    clock: { key: -1, str: '' },
  };
  s.phones = [s.ph, s.ph2];
  for (let i = 0; i < 9; i++) { const l = newCodeLine(r); l.typed = l.total; s.code.push(l); }
  s.code.push(newCodeLine(r));
  return s;
}

/* ——— each frame ——— */
function flicker(n, sg, r) { n.dur = n.ft = 0.7 + r() * 0.8; n.dead = r() < 0.75 ? Math.floor(r() * sg.n) : -1; n.wait = sg.every * (0.7 + r() * 0.6); }
function update(s, dt) {
  s.t += dt;
  const t = s.t, r = Math.random, ease = (k) => Math.min(1, dt * k);
  const settle = (v, to, k) => { const n = v + (to - v) * ease(k); return Math.abs(n - to) < 0.004 ? to : n; };
  s.lamp = settle(s.lamp, s.lampOn ? 1 : 0, 4);
  s.floor = settle(s.floor, s.floorOn ? 1 : 0, 4);
  s.arm += ((s.recordOn ? 1 : 0) - s.arm) * ease(2.5);
  s.spd += ((s.recordOn ? 3.5 : 0) - s.spd) * ease(1.2);
  s.spin += s.spd * dt;
  s.vis += ((s.recordOn ? 1 : 0) - s.vis) * ease(1.5);
  for (const k of WEATHERS) s.lv[k] += ((s.weather === k ? 1 : 0) - s.lv[k]) * ease(1.1);
  for (const c of s.curt) c.p = c.p < c.to ? Math.min(c.to, c.p + dt * 0.7) : Math.max(c.to, c.p - dt * 0.7);

  // rain on the glass: drops gather, hold, then slide in little runs
  for (const d of s.drops) {
    if (d.hold > 0) { d.hold -= dt; d.len = Math.max(0, d.len - dt * 3); continue; }
    d.v = Math.min(70, d.v + 50 * dt); d.y += d.v * dt; d.len = Math.min(16, d.len + d.v * dt * 0.6);
    if (r() < dt * 1.1) { d.hold = 0.3 + r() * 2.2; d.v = 0; }
    if (d.y > d.pane[1] + d.pane[3] - 2) paneDrop(r, d);
  }
  for (const st of s.streaks) { st.y += st.v * dt; st.x -= st.v * dt * 0.22; if (st.y - st.l > GH) { st.y = -r() * 30; st.x = r() * (GW + 40); } }
  for (const f of s.flakes) { f.y += f.v * dt; if (f.y > GH) { f.y = -2; f.x = r() * GW; } }
  if (s.lv.rain > 0.3 && r() < dt * 14) { const roofs = OUT.geo.roofs.filter((q) => q[2] < 118); const q = roofs[Math.floor(r() * roofs.length)]; if (q) s.splashes.push({ x: q[0] + Math.floor(r() * (q[1] - q[0] + 1)), y: q[2], l: 0.18 }); }
  for (const sp of s.splashes) sp.l -= dt;
  s.splashes = s.splashes.filter((sp) => sp.l > 0);
  for (const v of OUT.geo.vents) if (r() < dt * 2.5) s.puffs.push({ x: v[0] + r(), y: v[1], a: 0 });
  for (const p of s.puffs) { p.a += dt; p.y -= dt * 4; p.x += dt * (1.2 + Math.sin(p.a * 2) * 0.8); }
  s.puffs = s.puffs.filter((p) => p.a < 3);

  // the street: cars both ways, people under umbrellas
  if ((s.carWait -= dt) <= 0) { const dir = r() < 0.5 ? 1 : -1; s.cars.push({ x: dir > 0 ? 16 : 160, dir, v: 8 + r() * 8, c: CARS[Math.floor(r() * CARS.length)] }); s.carWait = 2.5 + r() * 6; }
  for (const c of s.cars) c.x += c.dir * c.v * dt;
  s.cars = s.cars.filter((c) => c.x > 12 && c.x < 164);
  for (const w of s.walkers) { w.x += w.dir * w.v * dt; if (w.x > 152) w.x = 24; if (w.x < 24) w.x = 152; }

  // the elevated train, a plane's lights, a shooting star on clear nights
  const tr = s.train;
  if (!tr.on) { tr.wait -= dt; if (tr.wait <= 0) { tr.on = true; tr.dir = r() < 0.5 ? 1 : -1; tr.x = tr.dir > 0 ? -132 : GW + 4; } }
  else { tr.x += tr.dir * 34 * dt; if ((tr.dir > 0 && tr.x > GW + 4) || (tr.dir < 0 && tr.x < -132)) { tr.on = false; tr.wait = 20 + r() * 25; } }
  s.horn = Math.max(0, s.horn - dt);
  if (!s.plane) { s.planeWait -= dt; if (s.planeWait <= 0) s.plane = { x: -3, y: 6 + r() * 22 }; }
  else { s.plane.x += dt * 5; s.plane.y += dt * 0.4; if (s.plane.x > GW + 3) { s.plane = null; s.planeWait = 30 + r() * 40; } }
  if (s.lv.clear > 0.6 && !s.shooting && r() < dt * 0.05) s.shooting = { x: 10 + r() * 90, y: 4 + r() * 30, l: 1 };
  if (s.shooting) { s.shooting.x += dt * 80; s.shooting.y += dt * 28; s.shooting.l -= dt * 1.6; if (s.shooting.l <= 0) s.shooting = null; }

  // neon: once in a while a letter falters, or a sign dims a little; windows go on and off
  OUT.signs.forEach((sg, i) => { const n = s.neon[i]; if (n.ft > 0) n.ft -= dt; else if ((n.wait -= dt) <= 0) flicker(n, sg, r); });
  for (const f of s.flick) { f.timer -= dt; if (f.timer <= 0) { f.on = !f.on; f.timer = f.on ? 8 + r() * 30 : 3 + r() * 12; } }
  for (const v of s.tv) { v.timer -= dt; if (v.timer <= 0) { v.c = Math.floor(r() * 4); v.timer = 0.15 + r() * 0.5; } }
  const pp = s.person;
  if (Math.abs(pp.to - pp.x) > 0.2) pp.x += Math.sign(pp.to - pp.x) * dt * 2.5;
  else if ((pp.wait -= dt) <= 0) { pp.to = 4 + Math.floor(r() * 16); pp.wait = 5 + r() * 12; }

  // the room
  s.steamBoost = Math.max(0, s.steamBoost - dt);
  if (r() < dt * (4 + s.steamBoost * 14)) s.steam.push({ x: 219 + r() * 8, y: 222, v: 6 + r() * 5, a: 0, life: 2 + r() * 1.5, ph: r() * 6.3 });
  for (const p of s.steam) { p.a += dt; p.y -= p.v * dt; }
  s.steam = s.steam.filter((p) => p.a < p.life);
  for (const m of s.motes) { m.x += (m.vx + Math.sin(t * 0.4 + m.p) * 1.5) * dt; m.y += m.vy * dt; if (m.y < 166 || m.x < 30 || m.x > 130) { m.y = 236 + r() * 10; m.x = 36 + r() * 88; } }
  s.bph += dt * (s.purr > 0 ? 2.6 : 1.2);
  if (s.twitch > 0) s.twitch -= dt; else if (r() < dt * 0.07) s.twitch = 0.25;
  if (s.tailF > 0) s.tailF -= dt; else if ((s.tailT -= dt) <= 0) { s.tailF = 1.4 + r() * 0.8; s.tailT = 7 + r() * 9; }
  if (s.purr > 0) { s.purr -= dt; if (r() < dt * 1.3) s.zzz.push({ x: 84 + r() * 4, y: 150, l: 1 }); }
  for (const z of s.zzz) { z.y -= 9 * dt; z.x += Math.sin(t * 2 + z.y * 0.2) * 3 * dt + 2 * dt; z.l -= dt * 0.32; }
  s.zzz = s.zzz.filter((z) => z.l > 0);
  for (const n of s.notes) { n.y -= 12 * dt; n.x += Math.sin(t * 3 + n.p) * 6 * dt; n.l -= dt * 0.4; }
  s.notes = s.notes.filter((n) => n.l > 0);
  for (const w of s.waves) { w.age += dt; w.l -= dt * 0.7; }
  s.waves = s.waves.filter((w) => w.l > 0);
  s.vineKick = Math.max(0, s.vineKick - dt); s.plantKick = Math.max(0, s.plantKick - dt); s.dateT = Math.max(0, s.dateT - dt);
  s.moonF = Math.max(0, s.moonF - dt); s.salt = Math.max(0, s.salt - dt); s.burst = Math.max(0, s.burst - dt);
  if (s.calT >= 0) { s.calT += dt * 1.6; if (s.calT >= 1) s.calT = -1; }
  s.heat = Math.max(0, s.heat - dt);
  if (s.heat > 0 && r() < dt * 16) s.wisps.push({ x: 100 + r() * 124, y: 179, a: 0, ph: r() * 6.3 });
  for (const w of s.wisps) { w.a += dt; w.y -= dt * 9; }
  s.wisps = s.wisps.filter((w) => w.a < 2.2);
  for (const p of s.phones) { if (p.on > 0) p.on -= dt; else if ((p.wait -= dt) <= 0) { p.on = 4; p.wait = p.every + r() * 40; } }
  if (s.cur.t > 0) { s.cur.t -= dt; s.cur.x += (s.cur.tx - s.cur.x) * ease(3); s.cur.y += (s.cur.ty - s.cur.y) * ease(3); }
  if (s.screen === 0) {
    const cur = s.code[s.code.length - 1];
    cur.typed += dt * (14 + Math.random() * 16) * (s.burst > 0 ? 4 : 1);
    if (cur.typed >= cur.total + 6) { s.code.push(newCodeLine(s.r)); if (s.code.length > 13) s.code.shift(); }
  }
  // the aquarium's fish wander, and come up for food
  for (const f of s.food) { f.y = Math.min(37, f.y + dt * 5); f.a += dt; }
  for (const f of s.fish) {
    const food = s.food[0];
    if (food) { f.tx = food.x; f.ty = Math.max(6, food.y); } else if ((f.wait -= dt) <= 0) { f.tx = 6 + r() * 66; f.ty = 8 + r() * 26; f.wait = 2 + r() * 4; }
    const sp = (food ? 16 : 6) * dt, dx = f.tx - f.x, dy = f.ty - f.y;
    f.x += Math.max(-sp, Math.min(sp, dx)); f.y += Math.max(-sp * 0.6, Math.min(sp * 0.6, dy));
    if (Math.abs(dx) > 0.5) f.dir = dx > 0 ? 1 : -1;
    if (food && Math.abs(dx) < 2 && Math.abs(dy) < 2) s.food.shift();
  }
  s.food = s.food.filter((f) => f.a < 12);
}

function blendSet(g, set, weights) {
  const ks = Object.keys(set).filter((k) => weights[k] > 0.004).sort((a, b) => weights[b] - weights[a]);
  let acc = 0;
  for (const k of ks) { acc += weights[k]; g.globalAlpha = weights[k] / acc; g.drawImage(set[k], 0, 0); }
  g.globalAlpha = 1;
}

function drawOutside(w, O, s) {
  const t = s.t, lv = s.lv;
  blendSet(w, O.sky, lv);
  if (lv.clear > 0.01) {
    w.globalAlpha = lv.clear;
    for (const st of O.stars) { const b = Math.sin(t * st.sp + st.p); w.fillStyle = b > 0.6 ? '#fff6e0' : b > -0.2 ? '#a8b4d8' : '#4a5480'; w.fillRect(st.x, st.y, 1, 1); }
    w.drawImage(O.moon, 132, 14);
    if (s.shooting) { const p = s.shooting; w.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) { w.globalAlpha = lv.clear * p.l * (1 - k / 6); w.fillRect(Math.round(p.x - k * 2.6), Math.round(p.y - k), 1, 1); } }
    w.globalAlpha = 1;
  }
  w.globalCompositeOperation = 'lighter';
  w.globalAlpha = 0.18 + lv.clear * 0.6; w.drawImage(O.moonGlow, 109, -9);
  w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
  for (const k of WEATHERS) {
    if (lv[k] < 0.01) continue;
    const [far, near] = O.clouds[k];
    w.globalAlpha = lv[k];
    for (const [img, v, y] of [[far, 1.1, k === 'clear' ? 8 : 0], [near, 2.6, 16]]) {
      if (!img) continue;
      const x = -Math.floor((t * v) % 320);
      w.drawImage(img, x, y); w.drawImage(img, x + 320, y);
    }
  }
  w.globalAlpha = 1;
  if (s.plane) { const p = s.plane; w.fillStyle = '#6a7090'; w.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); if ((t % 1.2) < 0.15) { w.fillStyle = '#ff5a5a'; w.fillRect(Math.round(p.x) - 1, Math.round(p.y), 1, 1); } if ((t % 1.7) < 0.08) { w.fillStyle = '#ffffff'; w.fillRect(Math.round(p.x) + 1, Math.round(p.y), 1, 1); } }

  const cityW = { plain: lv.rain + lv.clear, snow: lv.snow };
  blendSet(w, O.back, cityW);
  for (const f of s.flick) if (!f.on) { w.fillStyle = f.off; w.fillRect(f.w.x, f.w.y, f.w.w, f.w.h); }
  const sign = (i) => {
    const sg = O.signs[i], n = s.neon[i];
    w.drawImage(sg.on, sg.x, sg.y);
    if (n.ft <= 0) return 1;
    const u = 1 - n.ft / n.dur, off = !(u > 0.4 && u < 0.5);   // dark, a brief catch, dark again
    if (!off) return 1;
    if (n.dead < 0) return 0.6;
    const [cx, cy, cw, ch] = sg.cells[n.dead]; w.drawImage(sg.off, cx, cy, cw, ch, sg.x + cx, sg.y + cy, cw, ch);
    return 0.82;
  };
  const sa = [sign(0), 0, 0, 0];
  // street life between the shops and the near roofs
  for (const c of s.cars) {
    const x = Math.round(c.x), y = c.dir > 0 ? 110 : 112, fx = c.dir > 0 ? x + 5 : x, bx = c.dir > 0 ? x : x + 5;
    w.fillStyle = c.c; w.fillRect(x, y, 6, 2); w.fillRect(x + 1, y - 1, 4, 1);
    w.fillStyle = '#8aa0c8'; w.fillRect(x + (c.dir > 0 ? 3 : 1), y - 1, 2, 1);
    w.fillStyle = '#fff2cc'; w.fillRect(fx, y + 1, 1, 1);
    w.fillStyle = '#ff3a48'; w.fillRect(bx, y + 1, 1, 1);
  }
  for (const k of s.walkers) {
    const x = Math.round(k.x), step = Math.floor(t * 3 + k.x) % 2;
    w.fillStyle = k.c; w.fillRect(x - 1, 105, 3, 1); w.fillRect(x, 104, 1, 1);
    w.fillStyle = '#1a1c2a'; w.fillRect(x, 106, 1, 2); w.fillRect(x - (step ? 0 : 1), 108, 1, 1); w.fillRect(x + (step ? 1 : 0), 108, 1, 1);
  }
  if (s.train.on) drawTrain(w, s.train);
  // mist drifting between the middle distance and the near blocks
  { const mx = -Math.floor((t * 1.5) % O.mistW); w.globalAlpha = 0.6 + lv.rain * 0.4; w.drawImage(O.mist, mx, 82); w.drawImage(O.mist, mx + O.mistW, 82); w.globalAlpha = 1; }
  blendSet(w, O.front, cityW);
  sa[1] = sign(1); sa[2] = sign(2); sa[3] = sign(3);
  O.geo.tvs.slice(0, 2).forEach(([x, y], i) => { w.fillStyle = TVS[s.tv[i].c]; w.fillRect(x, y, 3, 4); });
  { const px = Math.round(s.person.x), walking = Math.abs(s.person.to - s.person.x) > 0.2;
    w.fillStyle = '#4a5a82'; w.fillRect(px, 99, 1, 1); w.fillStyle = '#34446a'; w.fillRect(px - 1, 100, 2, 2); w.fillRect(px - 1 + (walking && Math.floor(t * 4) % 2 ? 1 : 0), 102, 1, 2); w.fillRect(px, 102, 1, 2);
    if (!walking) { w.fillStyle = '#b0fbff'; w.fillRect(px + 1, 100, 1, 1); w.globalCompositeOperation = 'lighter'; w.globalAlpha = 0.6; w.drawImage(O.gTv, px - 3, 96); w.globalAlpha = 1; w.globalCompositeOperation = 'source-over'; } }
  w.fillStyle = '#8a9cc4';
  for (const p of s.puffs) { w.globalAlpha = Math.max(0, 0.45 * (1 - p.a / 3)); w.fillRect(Math.round(p.x), Math.round(p.y), 1 + (p.a > 1 ? 1 : 0), 1); }
  w.globalAlpha = 1;
  // the neon held in the rooftop puddles, trembling
  if (lv.snow < 0.6) {
    w.globalAlpha = 0.7 * (1 - lv.snow);
    for (const [px, py, pw, c, i] of PUDDLES) {
      if (i >= 0 && sa[i] < 1) continue;
      w.fillStyle = c;
      for (let x = px + 1; x < px + pw - 1; x++) if (Math.sin(t * 2.6 + x * 1.9) + Math.sin(t * 1.3 + x * 0.7) > -0.2) w.fillRect(x, py, 1, 1);
      if (lv.rain > 0.5 && Math.sin(t * 5 + px) > 0.92) { w.fillStyle = '#d8e4ff'; w.fillRect(px + 2 + Math.floor((t * 7) % (pw - 4)), py, 1, 1); }
    }
    w.globalAlpha = 1;
  }

  // weather in front of the city; the rain takes the colour of the lights it falls past
  if (lv.rain > 0.01) {
    const nNear = Math.round(60 * lv.rain), nFar = Math.round(50 * lv.rain);
    w.fillStyle = 'rgba(130,150,205,0.2)';
    for (let i = 60; i < 60 + nFar; i++) { const st = s.streaks[i]; w.fillRect(Math.round(st.x), Math.round(st.y - st.l), 1, st.l); }
    const B = s.buckets;
    for (const b of B) b.length = 0;
    for (let i = 0; i < nNear; i++) {
      const st = s.streaks[i], cx = Math.max(0, Math.min(O.tintCols - 1, Math.floor(st.x / 4))), cy = Math.max(0, Math.min(36, Math.floor(Math.max(0, st.y - st.l / 2) / 4)));
      B[O.tint[cy * O.tintCols + cx]].push(st);
    }
    for (let ti = 0; ti < 5; ti++) {
      if (!B[ti].length) continue;
      for (let k = 0; k < 3; k++) {
        w.fillStyle = STREAK[ti][k];
        for (const st of B[ti]) { const h = Math.ceil(st.l / 3); w.fillRect(Math.round(st.x + st.l * 0.22 * (k / 3)), Math.round(st.y - h * (k + 1)), 1, h); }
      }
    }
    w.fillStyle = 'rgba(200,215,245,0.7)';
    for (const sp of s.splashes) { w.fillRect(sp.x, sp.y - 1, 1, 1); if (sp.l < 0.1) { w.fillRect(sp.x - 1, sp.y - 2, 1, 1); w.fillRect(sp.x + 1, sp.y - 2, 1, 1); } }
  }
  if (lv.snow > 0.01) {
    const n = Math.round(110 * lv.snow);
    for (const big of [true, false]) {
      w.fillStyle = big ? '#eef3fc' : 'rgba(200,212,238,0.65)';
      for (let i = 0; i < n; i++) {
        const f = s.flakes[i];
        if (f.big !== big) continue;
        const x = Math.round(f.x + Math.sin(t * 0.9 + f.p) * (big ? 4 : 2)), sz = big && i % 3 === 0 ? 2 : 1;
        w.fillRect(x, Math.round(f.y), sz, sz);
      }
    }
  }

  // light: signs, blinking masts, the track's lamps, the shops, the cars, the street far below
  w.globalCompositeOperation = 'lighter';
  O.signs.forEach((sg, i) => { w.globalAlpha = 0.9 * sa[i]; w.drawImage(sg.glow, sg.x - 7, sg.y - 6); });
  w.globalAlpha = 1;
  for (const b of O.geo.blinkers) if ((t + b.p) % 2.4 < 0.55) { w.fillStyle = '#ff3a3a'; w.fillRect(b.x, b.y, 1, 1); w.drawImage(O.gBlink, b.x - 4, b.y - 4); }
  w.globalAlpha = 0.7;
  for (const [x, y] of O.geo.lamps) w.drawImage(O.gTrack, x - 4, y - 2);
  w.globalAlpha = 0.5; w.drawImage(O.gShop, 88 - 70, 106 - 10);
  w.globalAlpha = 0.8;
  for (const c of s.cars) {
    const x = Math.round(c.x), y = c.dir > 0 ? 111 : 113;
    w.drawImage(O.gCar, (c.dir > 0 ? x + 6 : x - 1) - 4, y - 2); w.drawImage(O.gTail, (c.dir > 0 ? x : x + 5) - 3, y - 2);
  }
  w.globalAlpha = 0.55 + 0.1 * Math.sin(t * 0.3);
  w.drawImage(O.gStreet, GW / 2 - 110, GH - 22);
  if (O.geo.bill) { w.globalAlpha = 0.8; w.drawImage(O.gBill, 94 - 18, 64 - 12); }
  w.globalAlpha = 0.5;
  O.geo.tvs.slice(0, 2).forEach(([x, y]) => w.drawImage(O.gTv, x - 3, y - 2));
  if (s.train.on) {
    const tr = s.train, hx = tr.dir > 0 ? Math.round(tr.x + 3 * 32 + 30) : Math.round(tr.x - 1);
    w.globalAlpha = 1; w.drawImage(O.gHead, hx - 9, 89);
    if (s.horn > 0) { w.globalAlpha = Math.min(1, s.horn); w.drawImage(O.gHead, hx - 9, 89); }
    w.globalAlpha = 0.14; w.fillStyle = '#ffd696'; w.fillRect(Math.round(tr.x), 98, 126, 2);
  }
  w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
}

function drawTrain(w, tr) {
  const y = 90, lit = ['#ffe4a8', '#fff0c8', '#d8f0ff'];
  for (let k = 0; k < 4; k++) {
    const cx = Math.round(tr.x + k * 32);
    if (cx > GW || cx + 30 < 0) continue;
    w.fillStyle = '#4a5674'; w.fillRect(cx, y, 30, 1);
    w.fillStyle = '#26304a'; w.fillRect(cx, y + 1, 30, 6);
    w.fillStyle = '#161c2c'; w.fillRect(cx, y + 6, 30, 1);
    w.fillStyle = '#34405e'; w.fillRect(cx + 14, y + 1, 2, 5);
    for (let i = 0; i < 9; i++) { if (i === 4) continue; w.fillStyle = lit[(k + i) % 3]; w.fillRect(cx + 2 + i * 3, y + 2, 2, 2); }
    w.fillStyle = '#2a2430'; w.fillRect(cx + 2 + ((k * 5 + 1) % 9) * 3, y + 3, 1, 1); w.fillRect(cx + 3 + ((k * 7 + 3) % 9) * 3, y + 3, 1, 1);
    w.fillStyle = '#10141e'; w.fillRect(cx + 30, y + 3, 2, 1);
  }
  const front = tr.dir > 0 ? Math.round(tr.x + 3 * 32 + 29) : Math.round(tr.x);
  w.fillStyle = '#fff6d8'; w.fillRect(front, y + 4, 1, 1);
}

function drawGlass(g, O, s, ox) {
  const gx = ox + GX, gy = GY, t = s.t;
  if (s.lv.rain > 0.01) {
    g.globalAlpha = s.lv.rain;
    g.drawImage(O.glassRain, gx, gy);
    g.fillStyle = 'rgba(190,206,240,0.2)';
    for (const d of s.drops) if (d.len >= 1) g.fillRect(gx + d.x, Math.round(gy + d.y - d.len), 1, Math.round(d.len));
    g.fillStyle = 'rgba(220,232,255,0.82)';
    for (const d of s.drops) g.fillRect(gx + d.x, Math.round(gy + d.y), d.big ? 2 : 1, 1);
    g.fillStyle = 'rgba(70,90,140,0.75)';
    for (const d of s.drops) g.fillRect(gx + d.x, Math.round(gy + d.y) + 1, d.big ? 2 : 1, 1);
  }
  if (s.lv.snow > 0.01) { g.globalAlpha = s.lv.snow; g.drawImage(O.glassFrost, gx, gy); }
  // the room, faintly, in the glass: the fairy lights along the top, the screen's glow, the lamp
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = '#ffb870';
  for (let x = 3; x < GW; x += 7) { if (x > 84 && x < 92) continue; g.globalAlpha = 0.16 + 0.1 * Math.sin(t * 1.2 + x * 1.7); g.fillRect(gx + x, gy + 2 + ((x * 5) % 3), 1, 1); }
  g.globalAlpha = 0.28; g.drawImage(O.gMon, gx + 88 - 46, gy + 112 - 10);
  if (s.lamp > 0.02) { g.globalAlpha = s.lamp * 0.45; g.drawImage(O.reflect, gx + 8, gy + 98); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function drawLit(g, RM, sp, ord) {
  const x = RM.ox + sp.x0, y = sp.y0;
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(spriteImg(RM, sp, k), x, y); }
  g.globalAlpha = 1;
}
function order(s, RM) {
  const l = s.lamp, f = RM.withFloor ? s.floor : 0, w = [(1 - l) * (1 - f), l * (1 - f), (1 - l) * f, l * f];
  let acc = 0;
  return [0, 1, 2, 3].filter((k) => w[k] > 0.004).sort((a, b) => w[b] - w[a]).map((k) => { acc += w[k]; return [k, w[k] / acc]; });
}
const lavaHW = (y) => Math.round(2.6 + (y - 182) * 0.105);
const pe = (p) => p * p * (3 - 2 * p);

function drawRoom(g, RM, O, s) {
  const { ox } = RM, t = s.t, F = fx(), ord = order(s, RM);
  drawLit(g, RM, RM.back, ord);
  if (RM.wide) {
    // the neon moon on the wall, and the warm strip under the shelf
    const M = F.moon[s.moon], br = s.moonF > 0 ? (Math.sin(s.moonF * 18) > 0 ? 0.55 : 1) : 1;
    g.globalAlpha = br; g.drawImage(M.tube, ox + 350 - 15, 145 - 15);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.7 * br; g.drawImage(M.g, ox + 350 - 28, 145 - 24);
    g.globalAlpha = 0.6; g.drawImage(F.strip, ox + 347 - 30, 106 - 7);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // the curtains, then the cat in front of them
  s.curt.forEach((c, i) => drawLit(g, RM, RM.curt[i][Math.round(pe(c.p) * 6)], ord));
  const bs = Math.sin(s.bph), breath = bs > 0.45 ? 2 : bs > -0.35 ? 1 : 0;
  drawLit(g, RM, RM.cat[breath * 2 + (s.twitch > 0 ? 1 : 0)], ord);
  drawLit(g, RM, RM.tail[s.tailF > 0 ? 1 + (Math.floor(s.tailF * 2.4) % 2) : 0], ord);
  const sw = (kick, ph) => { const v = Math.sin(t * 0.55 + ph) * 0.8 + (kick > 0 ? Math.sin(t * 16) * kick * 2 : 0); return v > 0.5 ? 2 : v < -0.5 ? 0 : 1; };
  if (RM.plant) drawLit(g, RM, RM.plant[sw(s.plantKick, 2)], ord);
  drawLit(g, RM, RM.front, ord);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5; g.drawImage(O.gScreen[s.screen], ox + 160 - 56, 170 - 34);
  g.globalAlpha = 0.6; g.drawImage(F.lava[s.lava], ox + 100 - 22, 198 - 26);
  g.globalAlpha = 0.65; g.drawImage(F.pool[s.lava], ox + 100 - 18, 233 - 5);
  g.globalAlpha = 0.4; g.drawImage(F.keys[Math.floor((((t * 0.05 + 0.25) % 1) + 1) % 1 * 12)], ox + 160 - 66, 266 - 16);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawLit(g, RM, RM.vine[sw(s.vineKick, 0)], ord);

  // the lava lamp: dark liquid, the blobs rising and falling, an outline and a highlight on the glass
  const LP = F.lava2[s.lava], cx = ox + 100;
  g.fillStyle = LP.liquid;
  for (let y = 182; y < 218; y++) { const hw = lavaHW(y); g.fillRect(cx - hw, y, hw * 2 + 1, 1); }
  for (const b of s.blobs) {
    const u = (Math.sin(t * b.sp * 2 + b.ph) + 1) / 2, by = 211 - u * 25, bx = cx + Math.round(Math.sin(t * 0.37 + b.ph) * (1 + (1 - u) * 2));
    const rr = b.r * (0.85 + 0.2 * Math.sin(t * 0.6 + b.i));
    for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
      const y = Math.round(by) + dy;
      if (y < 183 || y > 216) continue;
      const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy))), hw = lavaHW(y);
      const x0 = Math.max(cx - hw, bx - half), x1 = Math.min(cx + hw, bx + half);
      if (x1 < x0) continue;
      g.fillStyle = dy < -rr * 0.3 ? LP.light : LP.blob; g.fillRect(x0, y, x1 - x0 + 1, 1);
    }
  }
  g.fillStyle = LP.blob; g.fillRect(cx - 6, 215, 13, 3); g.fillRect(cx - 4, 213, 9, 2); g.fillStyle = LP.light; g.fillRect(cx - 3, 213, 4, 1);
  g.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 184; y < 214; y++) g.fillRect(cx - lavaHW(y) + 1, y, 1, 1);
  g.fillStyle = 'rgba(255,255,255,0.18)'; for (let y = 188; y < 206; y++) g.fillRect(cx - lavaHW(y) + 2, y, 1, 1);
  g.fillStyle = '#1c1824'; for (let y = 182; y < 218; y++) { const hw = lavaHW(y); g.fillRect(cx - hw - 1, y, 1, 1); g.fillRect(cx + hw + 1, y, 1, 1); }

  // the desk lamp's mouth: lit (a bright lip, the bulb inside) or dark
  if (s.lamp > 0.5) { g.fillStyle = '#ffe2a0'; g.fillRect(ox + 45, 166, 13, 1); g.fillStyle = '#fff6dc'; g.fillRect(ox + 47, 165, 9, 1); g.fillStyle = '#ffffff'; g.fillRect(ox + 50, 164, 3, 1); }
  else { g.fillStyle = '#3a2a1a'; g.fillRect(ox + 45, 166, 13, 1); g.fillStyle = '#6a6458'; g.fillRect(ox + 50, 165, 3, 1); }

  // the monitor
  const sx = ox + SCR.x, sy = SCR.y;
  if (s.screen === 0) {
    g.drawImage(O.scrCode, sx, sy);
    const last = s.code.length - 1;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(sx + 14, sy + 4 + last * 3, 56, 3);
    s.code.forEach((ln, i) => {
      const ly = sy + 5 + i * 3;
      let lx = sx + 19 + ln.indent * 3, drawn = 0;
      for (const tk of ln.tokens) {
        const ww = Math.min(tk.w, Math.floor(ln.typed - drawn));
        if (ww <= 0) break;
        g.fillStyle = TOK[tk.c]; g.fillRect(lx, ly, Math.min(ww, sx + 69 - lx), 1);
        lx += tk.w + 1; drawn += tk.w + 1;
      }
      if (i === last && Math.sin(t * 6) > 0) { g.fillStyle = '#e8e8f0'; g.fillRect(Math.min(lx, sx + 68), ly - 1, 1, 2); }
    });
  } else if (s.screen === 1) {
    g.drawImage(O.scrMusic, sx, sy);
    const [w1, w2] = [[24, 15], [18, 21], [28, 12], [21, 17]][s.track];
    g.fillStyle = '#9a94c0'; g.fillRect(sx + 27, sy + 11, w1, 1); g.fillStyle = '#6a6490'; g.fillRect(sx + 27, sy + 13, w2, 1);
    const prog = ((t - s.trackT) % 150) / 150;
    g.fillStyle = '#ff9a8b'; g.fillRect(sx + 27, sy + 18, Math.round(46 * prog), 1); g.fillStyle = '#ffffff'; g.fillRect(sx + 27 + Math.round(46 * prog), sy + 17, 1, 3);
    if (s.recordOn) { g.fillStyle = '#f3f0ff'; g.fillRect(sx + 47, sy + 21, 1, 5); g.fillRect(sx + 50, sy + 21, 1, 5); }
    else { g.fillStyle = '#f3f0ff'; g.fillRect(sx + 47, sy + 21, 1, 5); g.fillRect(sx + 48, sy + 22, 1, 3); g.fillRect(sx + 49, sy + 23, 1, 1); }
    for (let i = 0; i < 24; i++) {
      const v = (Math.sin(t * 3.1 + i * 0.7) + Math.sin(t * 5.3 + i * 1.9) + Math.sin(t * 1.7 + i * 0.3) + 3) / 6;
      const h = 1 + Math.round(v ** 1.3 * 15 * s.vis);
      g.fillStyle = F.kb[Math.floor((i / 24) * 24)][4]; g.fillRect(sx + 3 + i * 3, sy + 43 - h, 2, h);
      g.fillStyle = '#fff0f8'; g.fillRect(sx + 3 + i * 3, sy + 43 - h, 2, 1);
    }
  } else {
    g.drawImage(O.scrTank, sx, sy);
    g.fillStyle = 'rgba(170,230,255,0.07)';
    for (const k of [0, 1]) { const base = ((t * 3 + k * 40) % 100) - 20; for (let y = 0; y < 38; y++) g.fillRect(sx + Math.round(base + y * 0.5), sy + y, 6, 1); }
    g.fillStyle = 'rgba(200,240,255,0.35)'; for (let x = 0; x < 78; x += 2) if (Math.sin(t * 2 + x * 0.5) > 0.3) g.fillRect(sx + x, sy, 2, 1);
    [[6, 16], [9, 11], [24, 20], [50, 14], [57, 18], [44, 9]].forEach(([px, h], k) => {
      for (let j = 0; j < h; j++) {
        const dx = Math.round(Math.sin(t * 1.3 + j * 0.28 + k) * (j / h) * 1.6);
        g.fillStyle = j % 2 ? '#3aa060' : '#2a8048'; g.fillRect(sx + px + dx, sy + 39 - j, 1, 1);
        if (j % 3 === 1) { g.fillStyle = '#4ab870'; g.fillRect(sx + px + dx + (j % 6 === 1 ? 1 : -1), sy + 39 - j, 1, 1); }
      }
    });
    g.fillStyle = '#e8c890'; for (const f of s.food) g.fillRect(sx + Math.round(f.x), sy + Math.round(f.y), 1, 1);
    for (const f of s.fish) {
      const fxp = Math.round(sx + f.x), fy = Math.round(sy + f.y), dir = f.dir;
      g.fillStyle = f.c; g.fillRect(fxp - 1, fy - 1, 3, 1); g.fillRect(fxp - 2, fy, 5, 1); g.fillRect(fxp - 1, fy + 1, 3, 1);
      g.fillRect(fxp - dir * 3, fy - 1, 1, 3);
      g.fillStyle = '#10202a'; g.fillRect(fxp + dir, fy, 1, 1);
    }
    g.fillStyle = 'rgba(210,245,255,0.8)';
    for (let i = 0; i < 7; i++) { const by = 40 - ((t * 9 + i * 6) % 40); g.fillRect(sx + 71 + Math.round(Math.sin(by * 0.4 + i) * 1), sy + Math.round(by), 1, 1); }
  }
  if (s.cur.t > 0) { g.globalAlpha = Math.min(1, s.cur.t * 2); g.drawImage(F.cursor, sx + Math.round(s.cur.x), sy + Math.round(s.cur.y)); g.globalAlpha = 1; }
  g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(sx, sy, 2, SCR.h); g.fillRect(sx, sy, SCR.w, 1);

  // the keyboard: a slow wave of pink, violet and cyan under the keys; a click sends a ripple
  for (let r = 0; r < 5; r++) {
    const ky = 255 + r * 5, x0 = ox + 112 - r;
    for (let c = 0; c < 14; c++) {
      if (r === 4 && c > 4 && c < 10) continue;
      let w = 6;
      if (c === 13) w += 2 * r;
      if (r === 4 && c === 4) w = 41;
      const kx = x0 + c * 7;
      let light = 2;
      for (const wv of s.waves) light += Math.max(0, 1 - Math.abs(sq(c - wv.c, (r - wv.r) * 1.5) - wv.age * 14) / 1.6) * wv.l * 3;
      const lad = F.kb[Math.floor((((t * 0.05 + c * 0.035 + r * 0.015) % 1) + 1) % 1 * 48)], li = Math.min(4, Math.round(light));
      g.fillStyle = lad[li]; g.fillRect(kx, ky, w, 4);
      g.fillStyle = s.lamp > 0.5 ? '#4a4650' : '#383a46'; g.fillRect(kx, ky, w, 3);
      g.fillStyle = lad[Math.min(5, li + 1)]; g.fillRect(kx + 2, ky + 1, Math.min(2, w - 3), 1);
    }
  }

  // the clock (click: the date for a moment); its string is made once a half-second
  const key = Math.floor(Date.now() / 500) * 2 + (s.dateT > 0 ? 1 : 0);
  if (s.clock.key !== key) {
    const now = new Date(), two = (n) => String(n).padStart(2, '0');
    s.clock.key = key;
    s.clock.str = s.dateT > 0 ? `${two(now.getDate())}.${two(now.getMonth() + 1)}` : `${two(now.getHours())}${now.getMilliseconds() < 500 ? ':' : ' '}${two(now.getMinutes())}`;
  }
  [...s.clock.str].forEach((ch, i) => { const d = F.digits[ch]; if (d) g.drawImage(d, ox + 53 + i * 4 - (i > 2 ? 2 : 0) - (i === 2 ? 1 : 0), 201); });

  // the record and the tone arm
  g.fillStyle = '#1c1a22';
  for (let dy = -5; dy <= 5; dy++) { const half = Math.round(13 * Math.sqrt(1 - (dy / 5.5) ** 2)); g.fillRect(ox + 262 - half, 218 + dy, half * 2 + 1, 1); }
  g.fillStyle = '#2c2a34';
  for (const rr of [10, 7]) for (let a = 0; a < 24; a++) { const th = (a / 24) * Math.PI * 2; g.fillRect(ox + 262 + Math.round(Math.cos(th) * rr), 218 + Math.round(Math.sin(th) * rr * 0.42), 1, 1); }
  g.fillStyle = '#d8584a'; g.fillRect(ox + 259, 217, 7, 3); g.fillRect(ox + 260, 216, 5, 1); g.fillRect(ox + 260, 220, 5, 1);
  g.fillStyle = '#f2d0a0'; g.fillRect(ox + 262 + Math.round(Math.cos(s.spin) * 2), 218 + Math.round(Math.sin(s.spin) * 1), 1, 1);
  g.fillStyle = '#5a5866';
  for (const off of [0, Math.PI]) for (let k = 0; k < 3; k++) { const th = s.spin * 0.5 + off + k * 0.12; g.fillRect(ox + 262 + Math.round(Math.cos(th) * 11), 218 + Math.round(Math.sin(th) * 4.6), 1, 1); }
  g.fillStyle = '#c8c8d4';
  const ex = 287 + (271 - 287) * s.arm, ey = 223 + (217 - 223) * s.arm;
  const steps = Math.ceil(Math.max(Math.abs(ex - 285), Math.abs(ey - 213)));
  for (let k = 0; k <= steps; k++) g.fillRect(ox + Math.round(285 + ((ex - 285) * k) / steps), Math.round(213 + ((ey - 213) * k) / steps), 1, 1);
  g.fillStyle = '#e8e8f0'; g.fillRect(ox + Math.round(ex) - 1, Math.round(ey), 2, 1);

  // steam off the mug
  for (const p of s.steam) {
    const u = p.a / p.life, a = Math.max(0, Math.min(10, Math.round((u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 9 * (0.7 + s.steamBoost * 0.4))));
    g.fillStyle = F.steam[a]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 2.2 + p.ph) * (1 + u * 3)), Math.round(p.y), 1, u > 0.4 ? 2 : 1);
  }
  // warmth rising off the radiator
  for (const w of s.wisps) { g.fillStyle = F.wisp[Math.max(0, Math.min(5, Math.round((1 - w.a / 2.2) * 5)))]; g.fillRect(ox + Math.round(w.x + Math.sin(w.a * 3 + w.ph) * 2), Math.round(w.y), 1, 2); }

  // candle flames: in the jar on the desk, and on the shelf
  { const f = Math.sin(t * 11) + Math.sin(t * 6.7 + 1) * 0.8; g.fillStyle = f > 0.3 ? '#ffd27a' : '#ffa848'; g.fillRect(ox + 238, 210, 1, 3); g.fillRect(ox + 238 + (f > 1.2 ? 1 : 0), 209, 1, 1); g.fillStyle = '#fff6d8'; g.fillRect(ox + 238, 212, 1, 1); }
  if (RM.wide && s.candleOn) { g.fillStyle = Math.sin(t * 13) + Math.sin(t * 7.3) > 0.4 ? '#ffd27a' : '#ffa040'; g.fillRect(ox + 365, 91, 1, 2); g.fillStyle = '#fff4d0'; g.fillRect(ox + 365, 92, 1, 1); }
  if (RM.withFloor && s.floor > 0.02) { g.globalAlpha = s.floor; g.fillStyle = '#fff0c8'; g.fillRect(ox + FL_X - 11, 95, 24, 1); g.globalAlpha = 1; }
  // the phones: a message lights one now and then
  const phoneOn = (p) => (p.on > 0 ? Math.min(1, p.on * 2, (4 - p.on) * 4) : 0);
  const p1 = phoneOn(s.ph), p2 = RM.wide ? phoneOn(s.ph2) : 0;
  if (p1 > 0) { g.globalAlpha = p1; g.fillStyle = '#5a7ab8'; g.fillRect(ox + 255, 269, 8, 12); g.fillStyle = '#c8dcff'; g.fillRect(ox + 256, 271, 6, 2); g.fillStyle = '#8aa8e0'; g.fillRect(ox + 256, 274, 4, 1); g.globalAlpha = 1; }
  if (p2 > 0) { g.globalAlpha = p2; g.fillStyle = '#7a9ad8'; g.fillRect(ox - 41, 226, 7, 1); g.globalAlpha = 1; }
  // the calendar turning a page
  if (s.calDay && !RM.cal) RM.cal = calColours(RM, s.lamp > 0.5 ? 1 : 0);
  if (s.calT >= 0 && RM.cal) {
    const u = s.calT, ph = Math.round(20 * Math.cos(u * Math.PI));
    g.fillStyle = RM.cal.paper;
    if (ph > 0) g.fillRect(ox + 8, 84, 20, ph); else g.fillRect(ox + 8, 84 + ph, 20, -ph);
    g.fillStyle = RM.cal.line; if (ph > 3) for (let r = 0; r < Math.floor(ph / 5); r++) g.fillRect(ox + 11, 89 + r * 4, 14, 1);
  }
  if (s.calDay && (s.calT < 0 || s.calT > 0.5)) {
    const d = s.calDay, cx = 11 + (d % 7) * 2, cy = 90 + (Math.floor(d / 7) % 4) * 3;
    g.fillStyle = RM.cal.paper; g.fillRect(ox + 16, 95, 3, 3); g.fillStyle = RM.cal.dot; g.fillRect(ox + 17, 96, 1, 1);
    g.fillStyle = RM.cal.red; g.fillRect(ox + cx - 1, cy - 1, 3, 3); g.fillStyle = RM.cal.paper; g.fillRect(ox + cx, cy, 1, 1);
  }
  // dust in the lamplight
  if (s.lamp > 0.05) for (const m of s.motes) { const a = Math.round((0.25 + 0.3 * Math.sin(t * 0.9 + m.p)) * s.lamp / 0.07) - 1; if (a >= 0) { g.fillStyle = F.mote[Math.min(7, a)]; g.fillRect(ox + Math.round(m.x), Math.round(m.y), 1, 1); } }
  // z's and notes floating up
  for (const z of s.zzz) { g.globalAlpha = Math.max(0, Math.min(1, z.l)); g.drawImage(F.z, ox + Math.round(z.x), Math.round(z.y)); }
  for (const n of s.notes) { g.globalAlpha = Math.max(0, Math.min(1, n.l)); g.drawImage(F.note, ox + Math.round(n.x), Math.round(n.y)); }
  g.globalAlpha = 1;

  // fairy lights
  for (const b of RM.bulbs) {
    let set, br;
    if (s.fairy === 0) { set = F.warm[b.i % 4]; br = 0.62 + 0.38 * Math.sin(t * 1.2 + b.i * 1.7); }
    else if (s.fairy === 1) { set = F.white; br = 0.92; }
    else { set = F.col[b.i % 5]; br = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.5 - b.i * 0.45)); }
    b.br = br; b.set = set;
    g.fillStyle = set.lad[Math.min(3, Math.floor(br * 4))]; g.fillRect(ox + b.x, b.y, 1, 2);
  }

  // everything that glows
  g.globalCompositeOperation = 'lighter';
  for (const b of RM.bulbs) { g.globalAlpha = b.br * 0.8; g.drawImage(b.set.g, ox + b.x - 6, b.y - 5); }
  if (s.lamp > 0.02) { g.globalAlpha = s.lamp * 0.8; g.drawImage(F.lip, ox + 51 - 10, 166 - 5); g.globalAlpha = s.lamp; g.drawImage(F.cone, ox, 166); }
  if (RM.withFloor && s.floor > 0.02) { g.globalAlpha = s.floor * 0.5; g.drawImage(F.floorG, ox + FL_X - 46, 82 - 50); g.globalAlpha = s.floor; g.drawImage(F.floorCone, ox + FL_X - 60, 0); }
  g.globalAlpha = 0.6; g.drawImage(F.clock, ox + 61 - 16, 204 - 8);
  g.globalAlpha = 0.7; g.drawImage(F.led, ox + 250 - 3, 230 - 3);
  g.globalAlpha = 0.6 + 0.2 * Math.sin(t * 8.3) * Math.sin(t * 4.1); g.drawImage(F.candle, ox + 238 - 10, 211 - 10);
  if (p1 > 0) { g.globalAlpha = p1 * 0.6; g.drawImage(F.phone, ox + 259 - 9, 275 - 9); }
  if (s.heat > 0) { g.globalAlpha = Math.min(1, s.heat / 2) * 0.5; g.drawImage(F.heat, ox + 162 - 64, 192 - 14); }
  if (RM.wide) {
    if (s.candleOn) { g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.1); g.drawImage(F.candle, ox + 365 - 10, 92 - 10); }
    g.globalAlpha = 0.5 + 0.08 * Math.sin(t * 0.7) + (s.salt > 0 ? Math.min(0.35, s.salt * 0.2) : 0); g.drawImage(F.salt, ox - 50 - 16, 217 - 14);
    if (p2 > 0) { g.globalAlpha = p2 * 0.6; g.drawImage(F.phone, ox - 38 - 9, 226 - 9); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function render(g, wc, RM, O, s) {
  drawOutside(wc, O, s);
  g.clearRect(0, 0, RM.bw, H);
  g.drawImage(wc.canvas, RM.ox + GX, GY);
  drawGlass(g, O, s, RM.ox);
  drawRoom(g, RM, O, s);
}

function makeBuffers(bw) {
  const buf = document.createElement('canvas'); buf.width = bw; buf.height = H;
  const win = document.createElement('canvas'); win.width = GW; win.height = GH;
  return { buf, g: buf.getContext('2d'), wc: win.getContext('2d') };
}
function calColours(RM, k) {
  return { paper: litHex(RM, 18, 92, 0xefeae0, k), line: litHex(RM, 18, 92, 0xa09aac, k), red: litHex(RM, 18, 95, 0xd05050, k), dot: litHex(RM, 18, 95, 0xa09aac, k) };
}

export function preview(ctx) {
  const O = outside(), RM = roomFor(320), s = makeState(5);
  for (let i = 0; i < 120; i++) update(s, 1 / 30);
  s.t = 44.5; s.screen = 1; s.train = { x: 30, dir: 1, on: true, wait: 0 };
  const B = makeBuffers(320);
  render(B.g, B.wc, RM, O, s);
  const up = document.createElement('canvas'); up.width = 960; up.height = 960;
  const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(B.buf, 0, 0, 960, 960);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(up, 0, 0, 640, 640); ctx.restore();
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const O = outside(), s = makeState(Date.now() % 100000);
  let B = null, RM = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false;
  const preW = roomW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: 320, sx: 0, dx: 0 };

  const status = () => setScore(`${WTXT[s.weather]} · lamp ${s.lampOn ? 'on' : 'off'} · ${s.recordOn ? 'record playing' : 'record stopped'}`);
  setScore('Click the lamp, the screen, the window, the cat…');
  let hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0;
  const say = (text) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(status, 3000); };

  const amb = playAmbience({ rain: 1, crackle: 0.5 }, isPaused);
  // one track for the whole visit: lifting the needle fades it out, dropping it resumes it
  const stopMusic = playLoungeMusic('room', () => isPaused() || !s.recordOn);

  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!RM) return;
    const p = pointIn(canvas, e), W = canvas._snW || 640;
    const x = (p.x * view.bw) / W + view.sx - view.dx - RM.ox, y = p.y / 2;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const nearSeg = (ax, ay, bx, by, d) => { const vx = bx - ax, vy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))); return sq(x - ax - vx * u, y - ay - vy * u) <= d; };
    const lx = x - GX, ly = y - GY, inGlass = lx >= 0 && lx <= GW && ly >= 0 && ly <= GH;
    const curtainAt = (i) => { const c = s.curt[i], side = i ? 1 : -1, pp = pe(c.p); if (y < GY || y > DESK) return false; const inner = curtainEdge(side, y, pp), outer = side < 0 ? 34 : 286; if (!(side < 0 ? x >= outer && x <= inner : x <= outer && x >= inner)) return false; const overSill = side < 0 ? x >= 58 : x <= 262; return y <= (overSill ? DESK + (167 - DESK) * pp : DESK); };
    if (inR(74, 148, 118, 173)) {
      s.purr = 4; s.tailF = 1.6; for (let k = 0; k < 3; k++) s.zzz.push({ x: 82 + k * 3, y: 152 - k * 5, l: 1 + k * 0.25 });
      for (let k = 0; k < 8; k++) tone(38 + (k % 2), { dur: 0.22, vol: 0.03, type: 'triangle', delay: k * 0.17 });
      say('The cat purrs');
    } else if (inR(49, 197, 75, 210)) {
      s.dateT = 3; tone(84, { dur: 1.3, vol: 0.035 }); tone(79, { dur: 1.5, vol: 0.03, delay: 0.28 });
      say(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }));
    } else if (inR(37, 145, 63, 171) || nearSeg(18, 191, 44, 158, 3.5) || nearSeg(18, 192, 25, 229, 3.5) || inR(13, 225, 37, 235)) {
      s.lampOn = !s.lampOn; drip(0.03, 2400, 1600); note(s.lampOn ? 7 : 4, { dur: 0.5, vol: 0.04 });
      say(`Desk lamp ${s.lampOn ? 'on' : 'off'}`);
    } else if (inR(88, 173, 112, 232)) {
      s.lava = (s.lava + 1) % LAVA.length; note(9 + s.lava, { dur: 1.1, vol: 0.04 });
      say(`Lava lamp: ${LAVA[s.lava].name}`);
    } else if (inR(116, 138, 204, 198)) {
      s.screen = (s.screen + 1) % 3; drip(0.03, 3000, 2200); note(5 + s.screen, { dur: 0.4, vol: 0.035 });
      say(`Screen: ${['code', 'music player', 'aquarium'][s.screen]}`);
    } else if (inR(253, 266, 265, 283)) {
      s.ph.on = 4; drip(0.03, 1700, 2500); tone(88, { dur: 0.4, vol: 0.02, delay: 0.12 });
      say('Phone: a message — “sleep well”');
    } else if (inR(235, 262, 250, 282)) {
      s.cur = { t: 2.6, x: s.cur.x, y: s.cur.y, tx: 8 + Math.random() * 60, ty: 6 + Math.random() * 30 };
      tone(96, { dur: 0.05, vol: 0.02, type: 'square' });
      if (s.screen === 0) { s.burst = 2; say('A burst of typing'); }
      else if (s.screen === 1) { s.track = (s.track + 1) % 4; s.trackT = s.t; say('Next track'); }
      else { for (let k = 0; k < 5; k++) s.food.push({ x: 20 + Math.random() * 40, y: 1 + k, a: 0 }); say('Feeding the fish'); }
    } else if (inR(100, 250, 222, 288)) {
      s.waves.push({ c: (x - 110) / 7, r: (y - 255) / 5, age: 0, l: 1 });
      for (let k = 0; k < 4; k++) tone(88 + ((k * 5) % 7), { dur: 0.05, vol: 0.018, type: 'triangle', delay: k * 0.07 });
      say('Click-clack');
    } else if (inR(212, 218, 238, 246)) {
      s.steamBoost = 2.5; drip(0.05, 520, 240); say('Fresh tea, steaming');
    } else if (inR(242, 186, 296, 236)) {
      s.recordOn = !s.recordOn; amb.set('crackle', s.recordOn ? 0.5 : 0); drip(0.035, 900, 500);
      say(s.recordOn ? 'Record: needle down' : 'Record: needle up');
    } else if (inR(59, 237, 80, 250)) {
      tone(76, { dur: 0.5, vol: 0.025 }); say('A note: water the plants');
    } else if (inR(280, 216, 320, 320) || inR(270, 262, 320, 320)) {
      s.vineKick = 1.6; swish(0.035); say('The pothos sways');
    } else if (inR(10, 263, 55, 290)) {
      for (let k = 0; k < 3; k++) { s.notes.push({ x: 18 + k * 14, y: 268 - k * 4, l: 1.2, p: k * 2 }); note(6 + k * 2, { dur: 0.6, vol: 0.035, delay: k * 0.18 }); }
      say('A little tune');
    } else if (inR(96, 179, 232, 206)) {
      s.heat = 4; for (let k = 0; k < 3; k++) tone(98 - k, { dur: 0.04, vol: 0.014, type: 'square', delay: 0.15 + k * 0.45 });
      say('The radiator ticks, warm');
    } else if (inR(7, 78, 29, 104)) {
      s.calT = 0; s.calDay = 1 + Math.floor(Math.random() * 27); swish(0.03);
      say('The calendar turns a page');
    } else if (curtainAt(0) || curtainAt(1)) {
      const i = curtainAt(0) ? 0 : 1, c = s.curt[i];
      c.to = c.to ? 0 : 1; swish(0.045);
      say(c.to ? 'Curtain drawn' : 'Curtain tied back');
    } else if (y < GY - 1 || (y < 28 && (x < GX - 7 || x > GX + GW + 7))) {
      s.fairy = (s.fairy + 1) % 3; [0, 2, 4].forEach((k, i) => note(10 + k + s.fairy, { dur: 0.7, vol: 0.03, delay: i * 0.09 }));
      say(`Fairy lights: ${['warm twinkle', 'steady white', 'colour chase'][s.fairy]}`);
    } else if (RM.withFloor && (inR(FL_X - 13, 66, FL_X + 13, 97) || inR(FL_X - 2, 97, FL_X + 3, 268) || inR(FL_X - 9, 268, FL_X + 9, 276))) {
      s.floorOn = !s.floorOn; drip(0.03, 2200, 1500); note(s.floorOn ? 9 : 6, { dur: 0.5, vol: 0.04 });
      say(`Standing lamp ${s.floorOn ? 'on' : 'off'}`);
    } else if (RM.wide && inR(358, 84, 372, 101)) {
      s.candleOn = !s.candleOn; drip(0.025, s.candleOn ? 1800 : 700, s.candleOn ? 2600 : 300);
      say(s.candleOn ? 'Candle lit' : 'Candle out');
    } else if (RM.wide && inR(336, 130, 366, 160)) {
      s.moon = (s.moon + 1) % MOONS.length; s.moonF = 0.4; tone(45, { dur: 0.3, vol: 0.02, type: 'triangle' }); note(8 + s.moon, { dur: 0.8, vol: 0.03, delay: 0.1 });
      say(`Neon moon: ${MOONS[s.moon][2]}`);
    } else if (RM.wide && inR(340, 120, 440, 282)) {
      s.plantKick = 1.8; swish(0.04); say('The monstera sways');
    } else if (RM.wide && inR(450, 182, 482, 290)) {
      [0, 2, 4, 5, 7].forEach((st, i) => note(st, { dur: 1.6, vol: 0.03, type: 'triangle', delay: i * 0.035 }));
      say('A soft strum');
    } else if (RM.wide && inR(-44, 222, -32, 230)) {
      s.ph2.on = 4; drip(0.025, 1500, 2200); say('Phone: alarm set for 7:30');
    } else if (RM.wide && inR(-56, 209, -45, 224)) {
      s.salt = 3; note(3, { dur: 1.2, vol: 0.03 }); say('The salt lamp glows');
    } else if (inGlass) {
      const sg = O.signs.findIndex((g) => lx >= g.x - 2 && lx <= g.x + g.w + 2 && ly >= g.y - 2 && ly <= g.y + g.h + 2);
      const tr = s.train;
      if (sg >= 0) {
        flicker(s.neon[sg], O.signs[sg], Math.random); s.neon[sg].dead = Math.floor(Math.random() * O.signs[sg].n);
        tone(40, { dur: 0.25, vol: 0.02, type: 'square' }); say(sg === 0 ? 'The HOTEL sign flickers' : 'The sign flickers');
      } else if (tr.on && lx >= tr.x - 2 && lx <= tr.x + 128 && ly >= 87 && ly <= 99) {
        s.horn = 1.2; tone(55, { dur: 1.1, vol: 0.03, type: 'triangle' }); tone(59, { dur: 1.1, vol: 0.025, type: 'triangle', delay: 0.04 });
        tone(55, { dur: 0.9, vol: 0.025, type: 'triangle', delay: 0.6 }); say('The last train sounds its horn');
      } else {
        s.weather = WEATHERS[(WEATHERS.indexOf(s.weather) + 1) % 3];
        amb.set('rain', s.weather === 'rain' ? 1 : s.weather === 'snow' ? 0.1 : 0);
        note(s.weather === 'clear' ? 11 : 8, { dur: 1.2, vol: 0.04 });
        say(WTXT[s.weather]);
      }
    }
  };
  canvas.addEventListener('pointerdown', onDown);

  // a new frame shape: rebuild the room only once the width has held for a moment, a little each
  // frame, showing the old room (centred, cropped or with dark edges) until the new one is ready.
  // Once settled, the full-screen shape is built ahead in small slices, so going full screen is instant.
  const settleRoom = (bw) => {
    const want = roomW(bw), now = performance.now();
    if (!RM) RM = roomFor(want);
    if (RM.bw !== want) {
      const cached = ROOMS.get(want);
      if (cached) RM = cached;
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildRoom(want); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && !ROOMS.has(preW)) { job = buildRoom(preW); jobW = preW; preTried = true; }
    }
    if (job) {
      const done = pump(job, jobW === want ? 5 : 3);
      if (done) { job = null; jobW = 0; if (done.bw === want) RM = done; }
    }
    if (!B || B.buf.width !== RM.bw) B = makeBuffers(RM.bw);
  };

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, bw = Math.max(320, Math.round((320 * W) / 640));
    settleRoom(bw);
    update(s, dt);
    render(B.g, B.wc, RM, O, s);
    // whole-number steps without smoothing; any last fraction with a good filter
    view.bw = bw; view.sx = Math.max(0, (RM.bw - bw) >> 1); view.dx = Math.max(0, (bw - RM.bw) >> 1);
    const sw = Math.min(bw, RM.bw), k = Math.max(1, Math.ceil(canvas.height / H));
    if (canvas.height === H * k && canvas.width === bw * k) {
      ctx.imageSmoothingEnabled = false;
      if (view.dx) { ctx.fillStyle = SIDE; ctx.fillRect(0, 0, W, 640); }
      ctx.drawImage(B.buf, view.sx, 0, sw, H, (view.dx * W) / bw, 0, (sw * W) / bw, 640);
    } else {
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
    stopLoop();
    stopMusic();
    amb.stop();
    canvas.removeEventListener('pointerdown', onDown);
  };
}
