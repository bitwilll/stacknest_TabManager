// Night Train — a lounge, not a game: a window seat in an old wooden carriage on a rainy evening.
// Pixel art, drawn into a small buffer (320 px tall, as wide as the frame's shape) and scaled up by
// whole steps with no smoothing, so every pixel stays square and crisp.
// Outside, the country goes by in layers, each at its own speed: clouds and far hills barely
// moving, a village with lit windows on the slopes, a river with an old stone bridge, fields and
// hedges, dark trees, telegraph poles whose wires dip and rise as they flash past, and the other
// line's rails close below, their joints ticking by in time with the wheels. Now and then a small
// lit halt slides past while the train eases, or a tunnel turns the glass into a dark mirror. Far
// off, the odd glow of lightning over the hills, and a soft roll of thunder a few seconds later.
// Inside: rain slanting across the glass, mist in its corners, a brass-and-cream reading lamp, a
// little table with a cup of tea trembling to the rhythm, a ticket, a paperback, headphones and a
// phone; green velvet seats, a luggage rack, an umbrella dripping, a coat swaying on its hook and a
// cat in a wicker basket on the seat opposite. In full screen the carriage carries on: the next bay
// with its own window and a passenger dozing, and the corridor door and the luggage stack.
// Light: every still surface is painted once in its plain colours, then each pixel takes its colour
// from a short ramp made for that colour (violet night shadow up to window teal on the cool side,
// dusky rose up to lamp amber on the warm), stepped by how much light reaches it, with a narrow band
// of ordered dither only where two steps meet. The carriage is baked once per frame shape (lamp on
// and off); the landscape layers are tiles, built once per time of day; each frame only the moving
// things are drawn.

import { setupCanvas, runLoop, pointIn, tone, note, drip, swish, rumble, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'train', title: 'Night Train', blurb: 'A window seat on a rainy night train: tea, a lamp, the hills going by.', keys: 'Click the window, the lamp, the tea…', lounge: true };

const H = 320;                                  // buffer height; the core composition is 320 wide
const GX = 76, GY = 58, GW = 168, GH = 114;     // the core window's glass, in core pixels
const TT = 180;                                 // where the table top meets the wall
const TF = 210, TY = 13;                        // the table's front edge; how far the things on it sit forward
const STEP = 16;                                // carriage widths round up to this
const BASE = 104;                               // px a second the poles go by at full speed
const JOINT = 132, AXLE = 0.1, BOGIE = 0.36;    // rail length (px of the near track) and the wheels' timing
const TODS = ['dusk', 'night', 'dawn'];
const TODTXT = { dusk: 'Evening, rain on the glass', night: 'Night, the rain keeps on', dawn: 'First light, still raining' };
const STATIONS = ['WRENMOOR', 'ASHBY FOLD', 'KETTLE CROSS', 'LINDEN VALE', 'OWLSCOMBE', 'FERNLEY', 'THISTLEWICK', 'MARRAM', 'HOLLOW BRIDGE', 'SALTCOTE'];
const TITLE = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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
const sm = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '.': '000000000000010', '-': '000000111000000', ':': '000010000010000', '/': '001001010100100',
};
const textW = (str) => str.length * 4 - 1;

/* ——— a little raster to paint the still layers in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  bay(x, y) { return bay(Math.floor(x + this.ox), Math.floor(y + this.oy)); }
  has(x, y) { const i = this.at(x, y); return i >= 0 && this.d[i + 3] > 0; }
  px(x, y, c, a = 1) {
    const i = this.at(x, y);
    if (i < 0 || a <= 0) return;
    const d = this.d, r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a), k = da * (1 - a);
    const na = Math.round(oa * 255);   // 254 is a flag (it glows by itself), never a blend's result
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 253 ? 255 : na;
  }
  tint(x, y, c, a) { const i = this.at(x, y); if (i >= 0 && this.d[i + 3]) this.px(x, y, c, a); }
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
  erect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.emit(xx, yy, c); }
  clear(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = this.at(xx, yy); if (i >= 0) this.d.fill(0, i, i + 4); } }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  dith(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.bay(xx, yy) < lvl) this.px(xx, yy, c); }
  dtint(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.bay(xx, yy) < lvl) this.tint(xx, yy, c, 1); }
  shade(x, y, w, h, f) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = this.at(xx, yy);
      if (i >= 0 && this.d[i + 3] && this.d[i + 3] !== 254) { this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f; }
    }
  }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.px(x0, y0, c, a);
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
  text(str, x, y, c) {
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') this.px(x + (k % 3), y + Math.floor(k / 3), c);
      x += 4;
    }
  }
  // a rounded rectangle, filled
  rrect(x, y, w, h, r, c) {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const cx = xx < r ? r - xx - 0.5 : xx >= w - r ? xx - (w - r) + 0.5 : 0, cy = yy < r ? r - yy - 0.5 : yy >= h - r ? yy - (h - r) + 0.5 : 0;
      if (cx && cy && cx * cx + cy * cy > r * r) continue;
      this.px(x + xx, y + yy, c);
    }
  }
  canvas() { return toCanvas(this.d, this.w, this.h); }
}
function toCanvas(d, w, h) {
  const c = mk(w, h);
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
   For each painted colour, fourteen lit versions: seven on the cool side (deep violet shadow up to
   window-lit teal-grey) and seven on the warm side (dusky rose up to lamp amber). A pixel's step
   comes from the total light on it, its side from how much of that light is warm. */
const CT = [   // intensity, × r g b, + r g b
  [0.2, 0.7, 0.72, 1.24, 10, 7, 26], [0.29, 0.74, 0.79, 1.2, 8, 7, 22], [0.39, 0.78, 0.86, 1.16, 6, 6, 16],
  [0.51, 0.82, 0.93, 1.12, 4, 5, 10], [0.64, 0.86, 0.99, 1.1, 2, 4, 6], [0.78, 0.91, 1.02, 1.07, 0, 2, 2], [0.92, 0.96, 1.03, 1.04, 0, 0, 0],
];
const WT = [
  [0.23, 0.92, 0.74, 1.04, 12, 6, 18], [0.33, 1.02, 0.8, 0.96, 10, 5, 12], [0.45, 1.1, 0.85, 0.86, 8, 4, 6],
  [0.58, 1.15, 0.87, 0.8, 6, 3, 2], [0.73, 1.18, 0.89, 0.76, 6, 3, 0], [0.89, 1.21, 0.93, 0.74, 8, 4, 0], [1.05, 1.24, 0.98, 0.75, 12, 7, 2],
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

/* ——— the carriage's plan, for one width ———
   The core is one bay: the window, the table, a seat either side. In full screen the carriage goes
   on: to the right the next bay (back to back with ours, its own window, someone asleep), to the
   left the end of the coach: the corridor door, a luggage stack, a notice or two. */
const BAY2 = 316;                                  // the next bay starts this far to the right
const DOOR = { x: -100, w: 64, y: 42 };            // the corridor door's frame (outer), core pixels
function plan(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox;
  const glass = [{ x: GX, y: GY, w: GW, h: GH, core: true }];
  if (RT > BAY2 + GX - 6) glass.push({ x: BAY2 + GX, y: GY, w: GW, h: GH, core: false });
  const ceil = [160];
  if (RT > BAY2 + 40) ceil.push(BAY2 + 160);
  if (L < -20) ceil.push(DOOR.x + DOOR.w / 2);
  return { rw, ox, L, RT, wide: ox > 0, glass, ceil, bay2: RT > BAY2 + 8, door: L < DOOR.x + DOOR.w - 8 };
}

// the light reaching a point of the carriage (core coordinates), in three parts
function coolAt(cx, cy, P) {   // the evening through the glass
  let best = 0;
  for (const g of P.glass) {
    const dx = cx < g.x ? g.x - cx : cx > g.x + g.w ? cx - g.x - g.w : 0;
    const dy = cy < g.y ? g.y - cy : cy > g.y + g.h ? cy - g.y - g.h : 0;
    best = Math.max(best, Math.max(0, 1 - sq(dx, dy * 0.8) / 84) ** 2 * 0.44);
  }
  let v = 0.24 + best;
  if (cy > 262) v *= 1 - ((cy - 262) / 58) * 0.3;
  const vx = (cx - 160) / (P.rw / 2 + 90), vy = (cy - 150) / 250;
  return v * (1 - Math.min(0.34, (vx * vx + vy * vy) * 0.55));
}
function warmAt(cx, cy, P) {   // the ceiling lights, always on, low; the corridor's night light
  let v = 0;
  for (const x of P.ceil) v += Math.max(0, 1 - sq((cx - x) / 2.4, (cy - 8) * 0.85) / 150) ** 1.5 * 0.3;
  if (P.door) v += Math.max(0, 1 - sq(cx - (DOOR.x + DOOR.w / 2), (cy - 40) * 1.2) / 70) ** 1.8 * 0.18;
  const tb = (b) => cy > TF + 6 && cy < 294 && cx > b + 78 && cx < b + 242;   // under the tables, shadow
  if (tb(0) || tb(BAY2)) v *= 0.5;
  return v;
}
function lampAt(cx, cy) {        // the reading lamp, left of the window, shining down on the table
  let i = 0;
  if (cy >= TT - 1 && cy <= TF + 6 && cx > 70 && cx < 250) i += Math.max(0, 1 - sq((cx - 106) / 2.2, (cy - 200) * 1.1) / 76) ** 1.1 * 1.25;
  else i += Math.max(0, 1 - sq((cx - 58) * 1.05, (cy - 132) * 0.95) / 78) ** 1.6 * 0.8;
  if (cy >= 222 && cy < 262 && cx > 0 && cx < 84) i += Math.max(0, 1 - sq((cx - 50) / 1.6, cy - 240) / 50) ** 1.3 * 0.7;   // your seat
  i += Math.max(0, 1 - sq(cx - 90, (cy - 200) * 0.9) / 190) ** 2 * 0.22;
  if (cy > TF + 6 && cy < 294 && cx > 78 && cx < 242) i *= 0.3;
  return i;
}

// one lit version of a painted raster (l = the reading lamp on). Alpha 254 glows by itself.
function bakeOne(src, x0, y0, F, l) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length), rw = F.rw;
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.26, warm = 0.05;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) { const j = Y * rw + X; cool = F.C[j]; warm = F.W[j] + l * F.L[j]; }
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
function litHex(RM, cx, cy, c, l) {
  const F = RM.F, X = Math.max(0, Math.min(RM.rw - 1, cx + RM.ox)), Y = Math.max(0, Math.min(H - 1, cy)), j = Y * RM.rw + X;
  const cool = F.C[j], warm = F.W[j] + l * F.L[j], tot = cool + warm;
  return hex(rampOf(c)[(warm / tot > 0.36 ? 7 : 0) + Math.min(6, Math.round(Math.max(0, (tot - 0.1) / 0.15)))]);
}

/* ——— painting the carriage, in its plain colours ——— */
const VEL = { base: 0x2c5a46, hi: 0x3c7058, lo: 0x1f4436, dk: 0x132c22, crease: 0x24503e, pipe: 0x7a2a34, gold: 0xb09048 };
const MAHO = { base: 0x52261a, hi: 0x7a3e28, lo: 0x34160c, mid: 0x5e2c1e };
const BRASS = { hi: 0xf0d080, base: 0xc89a48, lo: 0x8a6430 };

function paintShell(R, P) {
  const { L, RT } = P, W = RT - L;
  // the ceiling, curving up into shadow, with ribs; a cornice of brass
  R.vgrad(L, 0, W, 16, [0x3a2c26, 0x4e3e34, 0x665244, 0x7e6a56, 0x96806a, 0xaa947a, 0xbaa68a, 0xc6b294], 1);
  for (let x = L; x < RT; x++) if ((((x - 8) % 52) + 52) % 52 === 0) R.shade(x, 1, 1, 15, 0.8);
  R.rect(L, 16, W, 1, 0x5a3a24); R.rect(L, 17, W, 1, BRASS.base); R.rect(L, 18, W, 1, 0x8a6430);
  // the upper wall: cream lincrusta, a small embossed diamond
  for (let y = 19; y < 176; y++) for (let x = L; x < RT; x++) {
    const xm = ((x % 10) + 10) % 10, ym = (y + ((Math.floor(x / 10) & 1) ? 5 : 0)) % 10, dd = Math.abs(xm - 5) + Math.abs(ym - 5);
    R.px(x, y, dd === 4 ? (xm < 5 ? 0xe0d2b2 : 0xb8a684) : dd === 0 ? 0xc6b490 : 0xd2c29e);
  }
  // the dado rail, and mahogany panelling below
  R.rect(L, 176, W, 1, 0x8a5a34); R.rect(L, 177, W, 1, BRASS.base); R.rect(L, 178, W, 1, 0x6a3a20); R.rect(L, 179, W, 1, 0x2e1208);
  for (let y = 180; y < 288; y++) for (let x = L; x < RT; x++) R.px(x, y, (x * 7 + (y >> 3)) % 23 === 0 ? 0x4a2216 : MAHO.base);
  for (let px = Math.floor(L / 40) * 40 + 4; px < RT; px += 40) {
    R.rect(px, 210, 32, 58, MAHO.mid);
    R.rect(px, 210, 32, 1, MAHO.hi); R.rect(px, 210, 1, 58, MAHO.hi); R.rect(px, 267, 32, 1, MAHO.lo); R.rect(px + 31, 210, 1, 58, MAHO.lo);
    R.rect(px + 4, 214, 24, 50, 0x582a1c); R.rect(px + 4, 214, 24, 1, MAHO.lo); R.rect(px + 4, 263, 24, 1, MAHO.hi);
  }
  // the heater grille along the bottom, then the skirting and the carpet
  R.rect(L, 272, W, 1, BRASS.lo); R.rect(L, 273, W, 12, 0x2a120a); R.rect(L, 285, W, 1, BRASS.lo);
  for (let x = L; x < RT; x++) if ((x & 3) !== 0) R.rect(x, 275, 1, 9, (x & 3) === 1 ? 0x8a6430 : 0x6a4a24);
  R.rect(L, 286, W, 2, 0x3a1a10); R.rect(L, 288, W, 1, 0x6a3420); R.rect(L, 289, W, 7, 0x2e140c);
  R.rect(L, 296, W, 2, 0x22080e);
  for (let y = 298; y < H; y++) for (let x = L; x < RT; x++) {
    let c = 0x4a1a24;
    if (y < 302) c = y === 299 || y === 300 ? ((x >> 1) % 3 === 0 ? 0x2a0e12 : 0x8a6a34) : 0x5e2430;
    else {
      const u = ((x + 400) % 14) - 7, v = ((y - 302) % 10) - 5, dm = Math.abs(u) + Math.abs(v * 1.4);
      if (dm > 4.6 && dm < 5.8) c = 0x62262e; else if (dm < 1.2) c = 0xa8803a; else if (dm < 2.4) c = 0x6e2a32;
    }
    R.px(x, y, c);
  }
  // the luggage rack, all along: a back rail, a net, a brass front rail on curled brackets
  R.rect(L, 29, W, 1, 0x8a6430); R.rect(L, 30, W, 1, BRASS.base);
  for (let x = L; x < RT; x++) for (let y = 31; y < 34; y++) if ((x + y * 2) % 4 === 0 || (x - y * 2) % 4 === 0) R.px(x, y, 0x5a4630);
  for (let bx = Math.floor((L - 30) / 130) * 130 + 30; bx < RT; bx += 130) {
    R.rect(bx - 1, 20, 3, 5, BRASS.lo); R.px(bx, 21, BRASS.hi);
    R.line(bx, 25, bx + 1, 33, BRASS.base); R.px(bx + 2, 26, BRASS.base); R.px(bx + 3, 27, BRASS.lo);
  }
}

// the rack's front rail goes over the bags
function paintRail(R, P) {
  R.rect(P.L, 34, P.RT - P.L, 1, BRASS.hi); R.rect(P.L, 35, P.RT - P.L, 1, BRASS.lo);
  for (let bx = Math.floor((P.L - 30) / 130) * 130 + 30; bx < P.RT; bx += 130) R.rect(bx, 34, 2, 2, BRASS.base);
  R.shade(P.L, 36, P.RT - P.L, 1, 0.72); R.shade(P.L, 37, P.RT - P.L, 1, 0.88);
}

function paintWindow(R, g, seat) {
  const x0 = g.x - 8, y0 = g.y - 9, w = g.w + 16, h = g.h + 16;
  R.rrect(x0, y0, w, h, 4, MAHO.base);
  R.rect(x0 + 2, y0 + 1, w - 4, 1, MAHO.hi); R.rect(x0 + 1, y0 + 2, 1, h - 4, MAHO.hi);
  R.rect(x0 + 2, y0 + h - 2, w - 4, 1, MAHO.lo); R.rect(x0 + w - 2, y0 + 2, 1, h - 4, MAHO.lo);
  for (let y = y0 + 3; y < y0 + h - 3; y++) if ((y * 5) % 17 === 0) { R.px(x0 + 3, y, 0x5e2c1e); R.px(x0 + w - 4, y, 0x46200f); }
  // the blind's box along the top, brass end caps, the rolled blind just showing
  R.rect(g.x - 5, g.y - 8, g.w + 10, 7, 0x6a3220); R.rect(g.x - 5, g.y - 8, g.w + 10, 1, 0x8a4a2c); R.rect(g.x - 5, g.y - 2, g.w + 10, 1, 0x2e1208);
  for (const ex of [g.x - 6, g.x + g.w + 4]) { R.rect(ex, g.y - 8, 2, 7, BRASS.base); R.px(ex, g.y - 8, BRASS.hi); R.px(ex + 1, g.y - 2, BRASS.lo); }
  // the glass, with a brass bead round it and rounded corners
  R.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, BRASS.lo);
  R.rect(g.x - 1, g.y + g.h, g.w + 2, 1, BRASS.hi); R.rect(g.x + g.w, g.y - 1, 1, g.h + 2, BRASS.base);
  R.clear(g.x, g.y, g.w, g.h);
  R.rect(g.x, g.y, g.w, 1, 0xe8dcc0); R.rect(g.x, g.y + 1, g.w, 1, 0xb8a888);   // the blind, rolled up
  for (const [cx, cy, sx, sy] of [[g.x, g.y, 1, 1], [g.x + g.w - 1, g.y, -1, 1], [g.x, g.y + g.h - 1, 1, -1], [g.x + g.w - 1, g.y + g.h - 1, -1, -1]]) {
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) if (sq(3.5 - dx, 3.5 - dy) > 4.1) R.px(cx + dx * sx, cy + dy * sy, sy > 0 ? BRASS.lo : BRASS.hi);
  }
  // the latches, and a little enamel plate with the seat numbers
  for (const lx of [g.x + 12, g.x + g.w - 18]) { R.rect(lx, g.y + g.h + 2, 6, 2, BRASS.base); R.px(lx, g.y + g.h + 2, BRASS.hi); R.px(lx + 5, g.y + g.h + 3, BRASS.lo); }
  const tw = textW(seat), px = g.x - 14 - tw, py = g.y + 4;
  R.rect(px - 1, py - 1, tw + 4, 9, 0x3a3a48); R.rect(px, py, tw + 2, 7, 0xe8e0cc); R.text(seat, px + 1, py + 1, 0x2a3a6a);
}

function paintTable(R, b) {
  for (let y = TT; y < TF; y++) {
    const k = (y - TT) / (TF - TT), x0 = Math.round(b + 86 - k * 12), x1 = Math.round(b + 234 + k * 12);
    for (let x = x0; x < x1; x++) {
      const gr = Math.sin(x * 0.05 + y * 0.55 + Math.sin(x * 0.018 + y * 0.21) * 3);
      let c = gr > 0.86 ? 0x7c4a2a : gr < -0.88 ? 0x52301a : 0x683c22;
      if (y <= TT + 1) c = 0x46260f;
      else if (y < TT + 5 && bay(x, y) < 0.55 - (y - TT - 2) * 0.16) c = 0x8e5a36;   // the lacquer holds the window
      if (x === x0) c = 0x8a5634; else if (x === x1 - 1) c = 0x4a2814;
      R.px(x, y, c);
    }
  }
  const x0 = b + 74, w = 172;
  R.rect(x0, TF, w, 1, BRASS.hi); R.rect(x0, TF + 1, w, 5, 0x4a2414); R.rect(x0, TF + 1, w, 1, 0x6a361e); R.rect(x0, TF + 6, w, 1, 0x2a1008);
  R.rect(x0, TF, 1, 7, 0x6a361e); R.rect(x0 + w - 1, TF, 1, 7, 0x2a1008);
  R.shade(b + 80, TF + 7, 160, 2, 0.55); R.shade(b + 80, TF + 9, 160, 3, 0.78);
  // the pedestal and its splayed foot
  for (let y = TF + 7; y < 290; y++) {
    const hw = y < TF + 13 ? 6 - (y - TF - 7) / 3 : y > 278 ? 3 + Math.round((y - 278) * 0.9) : 3;
    R.rect(b + 160 - Math.round(hw), y, Math.round(hw) * 2, 1, 0x3a2216);
    R.px(b + 160 - Math.round(hw), y, 0x5e3a24); R.px(b + 159 + Math.round(hw), y, 0x24140c);
  }
  R.rect(b + 156, TF + 18, 8, 2, BRASS.base); R.px(b + 156, TF + 18, BRASS.hi); R.rect(b + 147, 289, 26, 1, 0x1a0e08);
}

// a seat seen from its end: a tall tufted back, a deep cushion, a mahogany plinth. dir +1 runs right.
function paintSeat(R, edge, dir) {
  const S = (u, y, c) => R.px(dir > 0 ? edge + u : edge - u, y, c);
  // the back: tufted, leaning back a little, with a winged headrest
  const lean = (y) => Math.round((238 - y) / 44);
  for (let y = 112; y < 240; y++) {
    const wing = y < 150 ? Math.round(5 * Math.sin(((y - 112) / 38) * Math.PI) ** 0.7) : 0, uw = 24 + wing, l0 = lean(y);
    for (let u = 0; u <= uw; u++) {
      const cu = u < 6 ? 6 - u : u > uw - 6 ? u - (uw - 6) : 0, cy = y < 120 ? 120 - y : 0;
      if (cu && cy && cu * cu + cy * cy > 40) continue;
      const a = (u + y) % 12, bb = (u - y + 1200) % 12, inner = Math.min(a, 12 - a, bb, 12 - bb);
      let c = inner > 3 ? VEL.hi : inner > 1 ? VEL.base : VEL.crease;
      if (a === 0 && bb === 0) c = VEL.gold;
      if (u < 7) c = u === 0 ? VEL.dk : inner > 3 ? VEL.base : VEL.lo;          // the outer side, away from the light
      if (u >= uw - 1) c = u === uw ? VEL.dk : VEL.pipe;
      if (y <= 113 && c !== VEL.dk) c = 0x4c8468;
      if (y === 150 && u > 3 && u < uw - 1) c = VEL.dk;                       // the seam under the headrest
      S(u - l0, y, c);
    }
  }
  // the antimacassar, cream lace draped over the headrest
  for (let y = 110; y < 150; y++) for (let u = 1; u <= 31; u++) {
    const l0 = lean(y), wing = y < 150 ? Math.round(5 * Math.sin(((y - 112) / 38) * Math.PI) ** 0.7) : 0;
    if (u > 25 + wing + 1) continue;
    const scal = 144 + Math.round(Math.abs(Math.sin(u * 0.62)) * 3);
    if (y > scal || u < 9) continue;
    if (y < 114 && (u < 12 - (y - 110) * 2 || u > 22 + (y - 110) * 2)) continue;
    let c = 0xeae2ce;
    if (((u * 3 + y * 2) % 5 === 0 || (u * 2 - y + 400) % 6 === 0) && y > 116 && y < scal - 1) c = 0xbcb09a;
    if (y === scal || y === 110) c = 0xd2c6ae;
    if (u === 9) c = 0xc8bca4;
    S(u - l0, y, c);
  }
  // the cushion, its piping and a row of little gold lozenges
  for (let y = 236; y < 259; y++) for (let u = 0; u < 80; u++) {
    const cu = u > 73 ? u - 73 : 0, cy = y < 242 ? 242 - y : y > 254 ? y - 254 : 0;
    if (cu && cy && cu * cu + cy * cy > 36) continue;
    let c = y < 240 ? VEL.hi : y > 252 ? VEL.lo : VEL.base;
    if (y === 236 || y === 257) c = VEL.pipe;
    else if (y === 258) c = VEL.dk;
    const m = (u + 6) % 12;
    if (y >= 245 && y <= 249 && Math.abs(m - 6) + Math.abs(y - 247) <= 2) c = Math.abs(m - 6) + Math.abs(y - 247) === 2 ? VEL.gold : VEL.lo;
    if (u === 0) c = VEL.dk;
    S(u, y, c);
  }
  // the plinth
  for (let y = 259; y < H; y++) for (let u = 4; u < 74; u++) {
    let c = MAHO.base;
    if (y < 262) c = 0x1a0c08;
    else if (y >= 292 && y < 300) c = y === 292 ? BRASS.hi : y === 299 ? BRASS.lo : BRASS.base;
    else if (y >= 300) c = 0x2a120a;
    else if (u >= 10 && u < 68 && y >= 266 && y < 288) c = y === 266 || u === 10 ? MAHO.lo : y === 287 || u === 67 ? MAHO.hi : MAHO.mid;
    if (u === 73 && y < 292) c = MAHO.lo;
    S(u, y, c);
  }
}

// what's on your table: a ticket, a paperback, a pocket watch, the tea, headphones and a phone
function paintTableThings(R) {
  R.oy += TY;
  // the ticket, a little askew
  for (let y = 0; y < 7; y++) for (let x = 0; x < 18; x++) {
    const X = 98 + x + (y < 3 ? 1 : 0), Y = 185 + y;
    let c = 0xf0e2b8;
    if (x < 2) c = 0xb83a3a; else if (y === 6) c = 0xc8b890;
    else if ((y === 2 || y === 4) && x > 4 && x < 15 && (x * 7 + y) % 5) c = 0x6a5a48;
    if (x === 15 && y === 1) c = 0x5a3a24;
    R.px(X, Y, c);
  }
  R.text('C', 104, 186, 0x3a4a7a);
  // the paperback, open, pages bowing up to the spine
  for (let x = 120; x < 152; x++) {
    const u = x - 136, top = 183 + Math.round(Math.abs(u) / 8) - (Math.abs(u) < 3 ? 1 : 0);
    for (let y = top; y < 195; y++) {
      let c = 0xece0c4;
      if (y === 194 || x === 120 || x === 151) c = 0x2e5a4a;
      else if (Math.abs(u + 0.5) < 1) c = 0xb8a888;
      else if (y > top + 1 && y < 192 && (y - top) % 2 === 0 && Math.abs(u) > 2 && Math.abs(u) < 14 && (x * 13 + y * 7) % 9 > 1) c = 0x8a7c66;
      if (y === top && c === 0xece0c4) c = 0xfaf2e0;
      R.px(x, y, c);
    }
  }
  // a pocket watch on its chain
  R.ell(158, 190, 4, 3, BRASS.base); R.px(155, 188, BRASS.hi); R.px(156, 188, BRASS.hi); R.ell(158, 190, 3, 2, 0xf4ecd8);
  R.px(158, 190, 0x2a2420); R.px(159, 189, 0x2a2420); R.px(158, 191, 0x2a2420); R.rect(157, 186, 2, 1, BRASS.lo);
  for (let k = 0; k < 9; k++) R.px(162 + k, 193 - Math.round(Math.sin(k * 0.5) * 1.5), k % 2 ? BRASS.lo : BRASS.base);
  // the tea: saucer, a china cup with a blue band (its surface and steam are drawn live)
  R.ell(183, 192, 11, 2, 0xd8d2c8); R.ell(183, 191, 10, 2, 0xf2eee6); R.rect(176, 193, 15, 1, 0x9a948a);
  for (let y = 179; y < 191; y++) {
    const hw = y < 189 ? 7 : 7 - (y - 188);
    for (let x = 183 - hw; x < 183 + hw; x++) {
      let c = x > 183 + hw - 4 ? 0xd4cec4 : x < 183 - hw + 2 ? 0xe4dfd6 : 0xf6f2ea;
      if (y === 183 || y === 184) c = x > 183 + hw - 4 ? 0x46609a : 0x5a7ab8;
      if (y === 179) c = 0xffffff;
      R.px(x, y, c);
    }
  }
  R.rect(178, 180, 10, 1, 0x6a3a1a);
  for (const [x, y] of [[190, 182], [191, 182], [192, 183], [192, 184], [192, 185], [191, 186], [190, 186]]) R.px(x, y, 0xe8e2d8);
  R.px(191, 184, 0xb8b2a8);
  // a brown teapot and a sugar bowl at the back
  for (let y = -TY + 182; y < -TY + 196; y++) for (let x = 200; x < 216; x++) {
    const dx = (x - 207.5) / 7.5, dy = (y - (-TY + 190)) / 6.5;
    if (dx * dx + dy * dy > 1) continue;
    R.px(x, y, dx < -0.45 ? 0x8a4a2a : dx > 0.5 ? 0x3a1a0c : dy < -0.6 ? 0x7a3e20 : 0x5e2c14);
  }
  R.rect(205, -TY + 182, 6, 1, 0x4a200e); R.rect(207, -TY + 181, 2, 1, 0x8a4a2a); R.px(203, -TY + 186, 0xc87a4a);
  R.line(216, -TY + 188, 220, -TY + 185, 0x5e2c14); R.px(221, -TY + 184, 0x5e2c14);
  for (const [x, y] of [[199, -TY + 186], [198, -TY + 187], [198, -TY + 189], [199, -TY + 190]]) R.px(x, y, 0x4a200e);
  R.ell(230, -TY + 192, 3, 2, 0xf2eee6); R.rect(227, -TY + 190, 7, 1, 0xffffff); R.px(229, -TY + 189, 0xe8dcc0);
  // headphones, the cable curling off to the phone
  const band = [[200, 192], [200, 189], [201, 187], [203, 185], [206, 184], [210, 183], [214, 184], [217, 185], [219, 187], [220, 189], [220, 192]];
  for (let i = 0; i + 1 < band.length; i++) { R.line(band[i][0], band[i][1], band[i + 1][0], band[i + 1][1], 0x2a2830); R.line(band[i][0], band[i][1] - 1, band[i + 1][0], band[i + 1][1] - 1, 0x4a4856); }
  for (const cx of [201, 219]) { R.ell(cx, 192, 3, 2, 0x1e1c24); R.ell(cx, 192, 2, 1, 0x6ab8a0); R.px(cx - 1, 191, 0x9ae0c8); }
  for (let k = 0; k < 12; k++) R.px(203 + k * 2, 195 - Math.round(Math.abs(Math.sin(k * 1.3))), 0x2a2830);
  // the phone, face up
  R.rect(224, 185, 9, 10, 0x16161c); R.rect(224, 185, 9, 1, 0x3a3a48); R.rect(225, 186, 7, 8, 0x1c2638); R.px(228, 194, 0x2a2a34);
  R.oy -= TY;
}

function paintBay2Things(R, b) {
  R.oy += TY;
  // a folded newspaper, a flask of something hot and an enamel mug
  for (let y = 184; y < 195; y++) for (let x = b + 104; x < b + 142; x++) {
    let c = 0xd8d2c4;
    if (y === 184 || x === b + 104) c = 0xece8dc;
    else if (x === b + 122) c = 0xa8a294;
    else if (y < 188 && x > b + 107 && x < b + 120) c = 0x3a3a40;
    else if (y > 188 && (y % 2 === 0) && (x - b) % 9 < 7 && x !== b + 121) c = 0x8a867c;
    R.px(x, y, c);
  }
  R.rect(b + 124, 186, 14, 6, 0x9a9488); R.rect(b + 125, 187, 12, 4, 0x6a7a8a);
  for (let y = 166; y < 194; y++) { const c = y < 170 ? 0xb8bcc4 : y < 172 ? 0x6a6e78 : y > 182 && y < 186 ? 0xe8dcc0 : 0x9a3030; R.rect(b + 192, y, 7, 1, c); R.px(b + 192, y, mixc(c, 0xffffff, 0.3)); R.px(b + 198, y, mixc(c, 0x000000, 0.35)); }
  R.rect(b + 178, 186, 8, 7, 0xe8e4d8); R.rect(b + 178, 186, 8, 1, 0x2a3040); R.rect(b + 186, 188, 2, 3, 0xe8e4d8); R.rect(b + 179, 187, 6, 1, 0x5a3a20);
  R.oy -= TY;
}

// the reading lamp: a brass arm off a wall plate, a cream pleated shade with brass rims
function paintLamp(R) {
  R.ell(38, 102, 3, 6, BRASS.lo); R.ell(38, 102, 2, 5, BRASS.base); R.px(37, 98, BRASS.hi); R.px(37, 99, BRASS.hi);
  R.line(40, 101, 46, 97, BRASS.base); R.line(46, 97, 52, 97, BRASS.base); R.line(52, 97, 56, 101, BRASS.base);
  R.line(40, 102, 46, 98, BRASS.lo); R.px(47, 96, BRASS.hi); R.px(56, 101, BRASS.lo); R.px(56, 102, BRASS.lo);
  for (let y = 103; y < 117; y++) {
    const k = (y - 103) / 13, hw = Math.round(4 + k * 7);
    for (let x = 56 - hw; x <= 56 + hw; x++) {
      const rel = (x - (56 - hw)) / (2 * hw);
      let c = rel > 0.72 ? 0xc6b08a : rel < 0.2 ? 0xf4e8cc : 0xe6d6b2;
      if ((x - 56 + 40) % 3 === 0 && rel > 0.1 && rel < 0.9) c = mixc(c, 0x9a8460, 0.25);
      if (y === 103 || y === 116) c = y === 103 ? BRASS.hi : BRASS.base;
      R.px(x, y, c);
    }
  }
  R.rect(50, 117, 13, 1, 0x6a5030);
}
// the shade lit from within, laid over the plain one when the lamp is on
function paintLampLit(S) {
  for (let y = 103; y < 118; y++) {
    const k = (y - 103) / 13, hw = Math.round(4 + k * 7);
    for (let x = 56 - hw; x <= 56 + hw; x++) {
      if (y === 117) { if (Math.abs(x - 56) < 6) S.emit(x, y, Math.abs(x - 56) < 2 ? 0xffffff : 0xfff0c0); continue; }
      const rel = (x - (56 - hw)) / (2 * hw), seam = (x - 56 + 40) % 3 === 0 && rel > 0.1 && rel < 0.9;
      let c = rel > 0.75 ? 0xf0b868 : rel < 0.25 ? 0xffe6b0 : 0xffd890;
      if (seam) c = mixc(c, 0xc88848, 0.35);
      if (y === 103 || y === 116) c = 0xffd070;
      S.emit(x, y, c);
    }
  }
}

function paintBags(R, b, kind) {
  if (kind === 0) {
    // a tan leather suitcase with straps and a label; a striped hatbox; a green canvas holdall
    R.rrect(b + 94, 12, 46, 22, 3, 0x9a5a2e); R.rect(b + 95, 13, 44, 1, 0xc07a44); R.rect(b + 95, 32, 44, 1, 0x6a3a1a);
    R.rect(b + 94, 20, 46, 1, 0x7a4422); R.rect(b + 94, 21, 46, 1, 0xb06e3a);
    for (const sx of [b + 102, b + 130]) { R.rect(sx, 12, 3, 22, 0x5a3018); R.rect(sx, 22, 3, 2, BRASS.base); }
    for (const [cx, cy] of [[b + 94, 12], [b + 137, 12], [b + 94, 31], [b + 137, 31]]) R.rect(cx, cy, 3, 3, BRASS.base);
    R.rect(b + 115, 10, 6, 2, 0x5a3018); R.rect(b + 114, 11, 1, 2, 0x5a3018); R.rect(b + 121, 11, 1, 2, 0x5a3018);
    R.line(b + 137, 24, b + 141, 36, 0xd8ccb0); R.rect(b + 139, 36, 6, 8, 0xf0e2b8); R.rect(b + 139, 36, 6, 2, 0xb83a3a); R.rect(b + 140, 40, 4, 1, 0x8a7a60);
    for (let y = 15; y < 34; y++) for (let x = b + 146; x < b + 170; x++) {
      const cu = Math.abs(x - (b + 157.5)) / 12;
      R.px(x, y, y < 18 ? (y === 15 ? 0xe8d8b8 : 0x8a3a3a) : ((x - b) >> 2) % 2 ? 0xd8c4a0 : 0x8a3a3a);
      if (cu > 0.86) R.shade(x, y, 1, 1, 0.75);
    }
    R.rect(b + 146, 18, 24, 1, 0x5a2424);
    for (let y = 16; y < 34; y++) {
      const bulge = Math.round(Math.sin(((y - 16) / 17) * Math.PI) * 3), x0 = b + 176 - bulge, x1 = b + 228 + bulge;
      for (let x = x0; x < x1; x++) {
        const f = Math.sin((x - b) * 0.31 + y * 0.2);
        R.px(x, y, y === 16 ? 0x6a7a52 : x === x0 ? 0x3a4a2c : x === x1 - 1 ? 0x2e3a22 : f > 0.75 ? 0x5a6a44 : f < -0.8 ? 0x3e4c30 : 0x4a5a3a);
      }
    }
    R.rect(b + 180, 19, 44, 1, 0x2e3a22); R.rect(b + 196, 11, 12, 2, 0x5a3018); R.rect(b + 195, 12, 1, 5, 0x5a3018); R.rect(b + 208, 12, 1, 5, 0x5a3018);
    R.rect(b + 178, 24, 4, 7, 0x6a4028); R.rect(b + 222, 24, 4, 7, 0x6a4028);
    // a bowler hat at the end of the rack
    R.ell(b + 270, 28, 9, 2, 0x1e1c22); R.ell(b + 270, 24, 6, 5, 0x24222a); R.rect(b + 264, 26, 13, 1, 0x6a2a34); R.px(b + 267, 20, 0x4a4856);
  } else if (kind === 1) {
    // a rucksack with a rolled mat, a parcel in brown paper and string, a basket
    R.rrect(b + 96, 10, 30, 24, 6, 0x8a4a3a); R.rect(b + 100, 20, 22, 8, 0x7a3e30); R.rect(b + 100, 20, 22, 1, 0xa86050); R.rect(b + 109, 16, 4, 3, BRASS.base);
    R.rrect(b + 92, 6, 38, 6, 3, 0x4a6a8a); R.rect(b + 98, 6, 1, 6, 0x2a4a6a); R.rect(b + 122, 6, 1, 6, 0x2a4a6a);
    R.rect(b + 150, 18, 40, 16, 0xb08a5a); R.rect(b + 150, 18, 40, 1, 0xd0a878); R.rect(b + 168, 18, 2, 16, 0xe8dcc0); R.rect(b + 150, 25, 40, 1, 0xe8dcc0); R.rect(b + 166, 15, 6, 3, 0xe8dcc0);
    for (let y = 20; y < 34; y++) for (let x = b + 204; x < b + 236; x++) R.px(x, y, ((x + (y >> 1) * 2) % 4) < 2 ? 0xc89a58 : 0x9a7038);
    R.rect(b + 204, 20, 32, 1, 0x7a5428); for (let k = 0; k < 18; k++) R.px(b + 210 + k, 19 - Math.round(Math.sin((k / 17) * Math.PI) * 7), 0x6a4028);
  } else {
    // a blanket roll in tartan
    for (let y = 22; y < 34; y++) for (let x = b; x < b + 34; x++) {
      const s = ((x >> 2) + (y >> 2)) % 3;
      R.px(x, y, (x % 4 === 0) ? 0xc8a040 : s === 0 ? 0x2a4a3a : s === 1 ? 0x7a2a2a : 0x3a2a4a);
    }
    R.rect(b + 8, 22, 2, 12, 0x5a3018); R.rect(b + 25, 22, 2, 12, 0x5a3018);
  }
}

// under the table: a brass foot rail, a doctor's bag on the floor, a folded newspaper by it
function paintCardigan(R) {
  // a grey-blue knit cardigan, folded on your seat
  for (let y = 226; y < 237; y++) for (let x = 26; x < 56; x++) {
    const k = y - 226, x0 = 26 + (k < 3 ? 3 - k : 0), x1 = 56 - (k < 2 ? 2 - k : 0);
    if (x < x0 || x >= x1) continue;
    let c = x % 2 ? 0x5e6a88 : 0x6e7a98;
    if (y === 226 || (y === 227 && x < x0 + 2)) c = 0x8a96b2;
    if (y === 231) c = 0x4a5470; if (y >= 235) c = 0x444e68;
    if (x === x1 - 1) c = 0x4a5470;
    R.px(x, y, c);
  }
  for (const bx of [34, 42, 50]) R.px(bx, 229, 0xd8d0c0);
}
function paintFloorThings(R) {
  R.rect(90, 262, 140, 2, BRASS.base); R.rect(90, 262, 140, 1, BRASS.hi); for (const x of [92, 226]) R.rect(x, 264, 2, 8, BRASS.lo);
  for (let y = 270; y < 297; y++) {
    const top = y < 276, hw = top ? 10 + (y - 270) : 16;
    for (let x = 122 - hw; x < 122 + hw; x++) {
      let c = 0x5a2a18;
      if (top) c = y === 270 ? 0x8a4a2a : 0x6a3420; else if (x < 122 - hw + 3) c = 0x7a3c22; else if (x > 122 + hw - 4) c = 0x3a180c;
      if (y === 280) c = 0x3a180c;
      if (y >= 294) c = 0x2a1008;
      R.px(x, y, c);
    }
  }
  R.rect(118, 265, 8, 2, 0x3a180c); R.rect(117, 266, 1, 4, 0x3a180c); R.rect(126, 266, 1, 4, 0x3a180c);
  R.rect(110, 276, 3, 3, BRASS.base); R.rect(131, 276, 3, 3, BRASS.base); R.px(110, 276, BRASS.hi); R.px(131, 276, BRASS.hi);
  R.shade(102, 297, 42, 2, 0.6);
  for (let y = 290; y < 297; y++) R.rect(176 + (296 - y), y, 26, 1, y === 290 ? 0xe8e2d4 : (y % 2 ? 0xc8c2b4 : 0xd8d2c4));
  R.rect(182, 292, 10, 1, 0x4a4a52);
}

// a closed umbrella hung by its crook from the rack, still wet
function paintUmbrella(R) {
  R.line(12, 30, 12, 36, 0x6a4028); R.px(13, 29, 0x6a4028); R.px(14, 29, 0x6a4028); R.px(15, 30, 0x6a4028); R.px(15, 31, 0x8a5a38);
  R.rect(12, 37, 1, 5, 0x9aa0a8);
  for (let y = 42; y < 104; y++) {
    const hw = y < 50 ? 1 + Math.round((y - 42) / 3) : Math.max(0, Math.round(4 - (y - 50) / 15));
    for (let x = 12 - hw; x <= 12 + hw; x++) {
      let c = x < 12 ? 0x8a3040 : x > 12 ? 0x4a1424 : 0x6a2030;
      if ((y + x * 3) % 11 === 0) c = 0xc06070;
      R.px(x, y, c);
    }
  }
  R.rect(10, 60, 5, 2, 0x3a1018); R.px(12, 60, BRASS.base);
  R.rect(12, 104, 1, 3, 0x9aa0a8);
}

// a wicker basket on the seat opposite, its door a little wire grille (the cat is drawn live)
const CAR = { x: 250, y: 204, w: 42, h: 33, dx: 255, dy: 211, dw: 17, dh: 20 };
function paintCarrier(R) {
  const { x, y, w, h } = CAR;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const top = yy < y + 4 && (xx < x + 2 + (y + 4 - yy) || xx > x + w - 3 - (y + 4 - yy));
    if (top) continue;
    let c = ((xx + (yy >> 1) * 2) % 4) < 2 ? 0xd0a466 : 0x9a6c38;
    if (yy % 4 === 0) c = 0xb88a50;
    if (yy < y + 3 || yy > y + h - 4) c = (xx & 1) ? 0x8a5e30 : 0xa87a44;
    if (xx === x || xx === x + w - 1) c = 0x6a4420;
    R.px(xx, yy, c);
  }
  for (let k = 0; k < 26; k++) R.px(x + 8 + k, y - 1 - Math.round(Math.sin((k / 25) * Math.PI) * 9), k % 3 ? 0x6a4028 : 0x8a5a38);
  R.rect(x + 7, y - 1, 2, 2, BRASS.base); R.rect(x + 33, y - 1, 2, 2, BRASS.base);
  R.rect(CAR.dx - 1, CAR.dy - 1, CAR.dw + 2, CAR.dh + 2, 0x6a4420); R.rect(CAR.dx, CAR.dy, CAR.dw, CAR.dh, 0x16101a);
  R.rect(x + 28, y + 14, 8, 6, 0xf0e2b8); R.text('M', x + 30, y + 15, 0x7a2a2a);   // a name tag: Mim
  R.shade(x - 2, y + h, w + 6, 1, 0.55);
}
function paintGrille(S) {
  for (let x = CAR.dx; x < CAR.dx + CAR.dw; x += 3) S.rect(x, CAR.dy, 1, CAR.dh, 0xa8acb4);
  S.rect(CAR.dx, CAR.dy + 6, CAR.dw, 1, 0x8a8e96); S.rect(CAR.dx, CAR.dy + 13, CAR.dw, 1, 0x8a8e96);
  S.rect(CAR.dx + CAR.dw - 3, CAR.dy + 8, 3, 3, BRASS.base);
}

// a camel coat on a wooden hanger, a wine scarf over it; k leans it (the swing, in five frames)
const COAT = { x: 258, y: 60, w: 46, h: 96 };
function paintCoat(S, k) {
  const R = new Ras(COAT.w, COAT.h, -COAT.x, -COAT.y);
  R.line(270, 68, 290, 68, 0x8a5a34); R.line(271, 67, 289, 67, 0xb07a4a); R.px(280, 66, BRASS.base); R.px(280, 65, BRASS.base);
  for (let y = 67; y < 152; y++) {
    const hw = y < 74 ? 6 + (y - 67) * 1.1 : 13 + (y - 74) * 0.03 + (y > 128 ? (y - 128) * 0.06 : 0);
    const x0 = Math.round(280 - hw), x1 = Math.round(280 + hw);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      let c = u < 0.18 ? 0xc8955a : u > 0.78 ? 0x7a5430 : 0xa87a44;
      if (y > 92 && (Math.abs(x - 274) < 1 || Math.abs(x - 286) < 1) && (y + x) % 9 > 1) c = 0x8a6034;
      if (x <= x0 + 1 || x >= x1 - 1) c = y > 76 && y < 128 ? (x <= x0 + 1 ? 0x9a6c3a : 0x6a4626) : c;   // the sleeves
      if (y >= 124 && y <= 127 && (x <= x0 + 1 || x >= x1 - 1)) c = 0x5a3a20;
      if (y >= 149) c = 0x6a4626;
      R.px(x, y, c);
    }
  }
  // lapels, collar, buttons, belt and pocket flaps
  for (let y = 68; y < 92; y++) { const d = Math.round((y - 68) / 6); R.px(276 + d, y, 0x6a4626); R.px(284 - d, y, 0x6a4626); R.px(277 + d, y, 0xb8884e); }
  R.rect(273, 67, 14, 3, 0x8a6034); R.rect(274, 67, 12, 1, 0xa87a44);
  for (const by of [96, 110, 122, 136]) { R.px(279, by, 0x3a2414); R.px(280, by, 0x3a2414); }
  R.rect(267, 104, 27, 2, 0x8a6034); R.rect(278, 103, 4, 4, BRASS.base); R.rect(279, 104, 2, 2, 0x8a6034);
  for (const px of [267, 285]) { R.rect(px, 116, 8, 2, 0x8a6034); R.rect(px, 116, 8, 1, 0xb8884e); }
  // the scarf, wine with cream stripes, hanging over the right shoulder
  for (let y = 68; y < 118; y++) { const x = 286 + Math.round(Math.sin(y * 0.09) * 0.6); const c = (y - 68) % 12 < 2 ? 0xe8d8b8 : y > 112 ? 0x9a3a44 : 0x7a2a34; R.rect(x, y, 4, 1, c); R.px(x + 3, y, mixc(c, 0x000000, 0.3)); }
  for (let x = 286; x < 290; x++) if (x % 2 === 0) R.rect(x, 118, 1, 3, 0x9a3a44);
  // the swing: rows further down shift further
  for (let y = 0; y < COAT.h; y++) {
    const dx = Math.round(k * Math.max(0, (y + COAT.y - 66) / 86) ** 1.3 * 1.6);
    for (let x = 0; x < COAT.w; x++) {
      const sx = x - dx; if (sx < 0 || sx >= COAT.w) continue;
      const i = (y * COAT.w + sx) * 4; if (!R.d[i + 3]) continue;
      S.px(COAT.x + x, COAT.y + y, (R.d[i] << 16) | (R.d[i + 1] << 8) | R.d[i + 2]);
    }
  }
}

// the cat in its basket: a grey tabby. f: 0 asleep, 1 asleep (breath in), 2 awake, 3 blinking, 4 head up, an ear turned
function paintCat(S, f) {
  const x = CAR.dx, o = f === 1 ? -1 : f === 4 ? -3 : f >= 2 ? -2 : 0, cx = x + 8, cy = CAR.dy + 12 + o;
  for (let yy = CAR.dy + 15; yy < CAR.dy + CAR.dh; yy++) for (let xx = x; xx < x + CAR.dw; xx++) S.px(xx, yy, (xx + yy) % 5 === 0 ? 0x5e5e6c : 0x8a8a9a);
  S.px(x + 4, CAR.dy + 19, 0xe8e4e0); S.px(x + 5, CAR.dy + 19, 0xe8e4e0); S.px(x + 11, CAR.dy + 19, 0xe8e4e0); S.px(x + 12, CAR.dy + 19, 0xe8e4e0);
  S.ell(cx, cy, 6, 5, 0x9a9aaa);
  S.rect(cx - 5, cy - 2, 10, 1, 0xb0b0be); S.px(cx - 6, cy + 1, 0x5e5e6c); S.px(cx + 6, cy + 1, 0x5e5e6c);
  for (const [ex, flip] of [[cx - 5, 1], [cx + 5, -1]]) {
    const turned = f === 4 && flip < 0;
    for (let k = 0; k < 4; k++) { const w = 3 - Math.floor(k * 0.8); for (let i = 0; i < w; i++) S.px(ex + (flip > 0 ? i : -i) + (turned ? 1 : 0), cy - 4 - k, k === 0 ? 0x7a7a88 : 0x6a6a78); }
    S.px(ex + flip, cy - 5, turned ? 0x9a8a90 : 0xd8a0a0);
  }
  for (const sx of [-2, 0, 2]) { S.px(cx + sx, cy - 4, 0x4e4e5c); S.px(cx + sx, cy - 3, 0x4e4e5c); }
  S.ell(cx, cy + 3, 3, 1.5, 0xe8e4e0); S.px(cx, cy + 2, 0xd88a8a); S.px(cx - 1, cy + 4, 0xa8a4a0); S.px(cx + 1, cy + 4, 0xa8a4a0);
  for (const ex of [cx - 3, cx + 2]) {
    if (f === 2 || f === 4) { S.rect(ex, cy - 1, 2, 2, 0xe8c040); S.px(ex + (ex < cx ? 1 : 0), cy - 1, 0x1a1a1a); S.px(ex + (ex < cx ? 1 : 0), cy, 0x1a1a1a); S.emit(ex, cy - 1, 0xfff0a0); }
    else if (f === 3) S.rect(ex, cy, 2, 1, 0x2a2a30);
    else { S.px(ex, cy, 0x2a2a30); S.px(ex + 1, cy, 0x2a2a30); S.px(ex + (ex < cx ? 0 : 1), cy - 1, 0x4e4e5c); }
  }
  for (const s of [-1, 1]) { S.px(cx + s * 4, cy + 3, 0xc8c8d0); S.px(cx + s * 6, cy + 3, 0xc8c8d0); }
}

// someone asleep in the next bay, cap down, hands folded. f: 0 breath out, 1 breath in, 2 stirring
const PAS = { x: 334, y: 150, w: 66, h: 150 };
function paintPassenger(S, f) {
  const b = f === 1 ? -1 : 0, hy = f === 2 ? -2 : 0, hx = f === 2 ? -1 : 0;
  // legs: thighs along the cushion, shins down, shoes
  for (let x = 344; x < 388; x++) { const t = (x - 344) / 44, top = Math.round(226 - t * 2); for (let y = top; y < top + 11; y++) S.px(x, y, y === top ? 0x4e4e5a : y > top + 8 ? 0x2a2a32 : 0x3a3a44); }
  for (let y = 236; y < 291; y++) for (let x = 380; x < 390; x++) S.px(x, y, x === 380 ? 0x4e4e5a : x > 387 ? 0x2a2a32 : 0x3a3a44);
  S.rect(379, 291, 14, 4, 0x1e1a18); S.rect(380, 291, 12, 1, 0x4a3a30); S.rect(379, 295, 15, 1, 0x0e0a08);
  // the coat
  for (let y = 180 + b; y < 234; y++) {
    const front = 360 + Math.round(Math.sin(((y - 180) / 54) * Math.PI) * 3) + (y > 200 ? 1 : 0);
    for (let x = 340; x < front; x++) S.px(x, y, x === front - 1 ? 0x3a4668 : x < 343 ? 0x1c2236 : (x + y) % 13 === 0 ? 0x232a40 : 0x2a3450);
  }
  S.line(352, 186 + b, 356, 214 + b, 0x1c2236); S.line(353, 186 + b, 357, 214 + b, 0x3a4668);
  for (let x = 356; x < 364; x++) S.px(x, 215 + b + Math.round((x - 356) * 0.6), 0x232a40);
  // hands, folded in the lap
  S.rect(361, 219 + b, 9, 6, 0xd8a888); S.rect(361, 219 + b, 9, 1, 0xe8c0a0);
  for (const fx of [363, 365, 367]) S.px(fx, 221 + b, 0xb88468);
  S.rect(359, 220 + b, 2, 5, 0x232a40);
  // the scarf, the head bowed, the cap
  S.rect(346, 176 + b, 14, 6, 0xc89a40); S.rect(346, 176 + b, 14, 1, 0xe0b85a); S.rect(356, 181 + b, 3, 8, 0xb88a34);
  const cy = 169 + hy, cx = 353 + hx;
  S.ell(cx, cy, 6, 7, 0xd8a888);
  S.rect(cx - 6, cy - 3, 5, 9, 0x5a5450); S.px(cx - 1, cy + 1, 0xc08870);
  S.px(cx + 6, cy + 2, 0xd8a888); S.px(cx + 7, cy + 3, 0xc89878);
  if (f === 2) { S.px(cx + 3, cy, 0x2a2420); S.px(cx + 4, cy, 0x2a2420); } else S.rect(cx + 2, cy + 1, 3, 1, 0x8a5a48);
  S.px(cx + 4, cy + 5, 0xa86a5a);
  S.rect(cx - 7, cy - 8, 14, 5, 0x5a4a3a); S.rect(cx - 6, cy - 9, 11, 1, 0x6a5a48); S.rect(cx + 2, cy - 4, 9, 2, 0x4a3a2c); S.px(cx - 3, cy - 7, 0x7a6a56);
}

// the end of the coach: the corridor (behind the door), the door's frame, notices, a luggage stack
function paintEnd(R, P) {
  const d = DOOR, ix = d.x + 6, iw = d.w - 12, iy = d.y + 6;
  // the frame, then the corridor beyond: a dim wall, a window onto the far side's night, a
  // handrail, a runner, the corridor's own little light
  R.rect(d.x, d.y, d.w, 254, MAHO.base);
  R.rect(d.x + 1, d.y + 1, d.w - 2, 1, MAHO.hi); R.rect(d.x + 1, d.y + 1, 1, 252, MAHO.hi); R.rect(d.x + d.w - 2, d.y + 1, 1, 252, MAHO.lo);
  R.rect(ix - 1, iy - 1, iw + 2, 1, MAHO.lo); R.rect(ix - 1, iy, 1, 248, MAHO.lo); R.rect(ix + iw, iy, 1, 248, MAHO.hi);
  R.vgrad(ix, iy, iw, 210, [0x8a7c66, 0xa0907a, 0xb0a088, 0xa0907a, 0x7a6c58], 1);
  R.rect(ix + 8, iy + 24, iw - 16, 58, 0x3a2016); R.vgrad(ix + 10, iy + 26, iw - 20, 54, [0x0c1124, 0x121a32, 0x1a2440, 0x24304e], 1);
  for (let k = 0; k < 9; k++) R.px(ix + 12 + ((k * 13) % (iw - 24)), iy + 30 + ((k * 23) % 46), 0x6a7aa0);
  R.rect(ix, iy + 92, iw, 2, BRASS.base); R.rect(ix, iy + 92, iw, 1, BRASS.hi);
  R.vgrad(ix, iy + 186, iw, 62, [0x5a1e28, 0x6a2630, 0x4a1a22], 1);
  for (let y = iy + 190; y < iy + 246; y += 6) R.rect(ix + 4, y, iw - 8, 1, 0x8a6a34);
  R.erect(ix + 18, iy + 2, iw - 36, 3, 0xffe2b0);
  const t = 'COACH C', tw = textW(t), tx = d.x + Math.round((d.w - tw) / 2);
  R.rect(tx - 2, d.y - 9, tw + 4, 8, 0x1e2a4a); R.text(t, tx, d.y - 7, 0xe8dcc0);
  // a timetable on the narrow wall by our seat
  R.rect(-29, 62, 24, 40, 0x3a2016); R.rect(-28, 63, 22, 38, 0xeee4cc); R.rect(-28, 63, 22, 5, 0x7a2a34); R.text('UP', -22, 63, 0xeee4cc);
  for (let y = 71; y < 99; y += 3) { R.rect(-26, y, 7, 1, 0x6a5e50); R.rect(-17, y, 9, 1, (y % 2) ? 0x8a7e6c : 0x6a5e50); }
  // the luggage stack: an iron frame, trunks and cases
  if (P.L < -110) {
    const a = -178, b = -108;
    for (const sy of [128, 198, 268]) { R.rect(a, sy, b - a, 3, 0x3a3a42); R.rect(a, sy, b - a, 1, 0x6a6a78); R.shade(a, sy + 3, b - a, 2, 0.6); }
    R.rect(a, 60, 3, 236, 0x2a2a30); R.rect(b - 3, 60, 3, 236, 0x2a2a30); R.rect(a, 60, 1, 236, 0x5a5a66);
    R.rect(a + 4, 228, 38, 40, 0x2a3a5a); R.rect(a + 4, 228, 38, 2, 0x4a5a7a); for (const y of [238, 256]) R.rect(a + 4, y, 38, 2, 0x1a2236);
    for (const [x, y] of [[a + 4, 228], [a + 38, 228], [a + 4, 264], [a + 38, 264]]) R.rect(x, y, 4, 4, BRASS.base);
    R.rect(a + 20, 244, 6, 4, BRASS.base); R.rect(a + 44, 240, 20, 28, 0x8a2a2a); R.rect(a + 44, 240, 20, 1, 0xb04a44); R.rect(a + 50, 237, 8, 3, 0x3a1a14);
    R.rect(a + 6, 176, 30, 22, 0x4a5a3a); R.rect(a + 6, 176, 30, 1, 0x6a7a52); R.rect(a + 10, 164, 24, 12, 0x9a5a2e); R.rect(a + 10, 164, 24, 1, 0xc07a44); R.rect(a + 20, 161, 6, 3, 0x5a3018);
    for (let y = 180; y < 198; y++) for (let x = a + 40; x < a + 66; x++) R.px(x, y, ((x + (y >> 1) * 2) % 4) < 2 ? 0xc89a58 : 0x9a7038);
    R.rect(a + 8, 108, 28, 20, 0xb08a5a); R.rect(a + 8, 108, 28, 1, 0xd0a878); R.rect(a + 21, 108, 2, 20, 0xe8dcc0); R.rect(a + 8, 117, 28, 1, 0xe8dcc0);
    R.ell(a + 52, 120, 10, 8, 0x7a5a8a); R.rect(a + 42, 120, 21, 8, 0x7a5a8a); R.rect(a + 42, 121, 21, 1, 0xd8c8a8); R.ell(a + 52, 113, 10, 2, 0x8a6a9a);
  }
  // a route map and a fire extinguisher, further along
  if (P.L < -186) {
    R.rect(-216, 66, 32, 44, 0x3a2016); R.rect(-215, 67, 30, 42, 0xeee4cc);
    const pts = [[-212, 104], [-206, 96], [-208, 86], [-200, 80], [-196, 72], [-190, 76]];
    for (let i = 0; i + 1 < pts.length; i++) R.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0xb83a3a);
    for (const [x, y] of pts) { R.rect(x - 1, y - 1, 3, 3, 0x2a3a6a); R.px(x, y, 0xeee4cc); }
    R.rect(-206, 100, 14, 1, 0x6ab0d0); R.rect(-212, 88, 6, 6, 0x8ab070);
    R.rrect(-200, 204, 8, 30, 3, 0xb8302a); R.rect(-199, 205, 2, 26, 0xd85a4a); R.rect(-198, 200, 4, 4, 0x2a2a30); R.line(-194, 202, -189, 210, 0x2a2a30); R.rect(-201, 218, 10, 4, 0xe8dcc0);
  }
}
function paintDoor(S) {
  const d = DOOR, ix = d.x + 6, iw = d.w - 12, iy = d.y + 6;
  for (let y = iy; y < iy + 248; y++) for (let x = ix; x < ix + iw; x++) {
    const gx = x >= ix + 6 && x < ix + iw - 6 && y >= iy + 12 && y < iy + 104;
    if (gx) { S.px(x, y, 0x9ab0d0, (x + y) % 9 === 0 ? 0.3 : 0.12); continue; }
    let c = MAHO.base;
    if (y >= iy + 120 && y < iy + 236 && x >= ix + 6 && x < ix + iw - 6) {
      const top = y === iy + 120 || y === iy + 178, bot = y === iy + 175 || y === iy + 235;
      c = y > iy + 175 && y < iy + 178 ? MAHO.base : top || x === ix + 6 ? MAHO.lo : bot || x === ix + iw - 7 ? MAHO.hi : MAHO.mid;
    }
    if (x === ix || y === iy) c = MAHO.hi; else if (x === ix + iw - 1) c = MAHO.lo;
    if ((x === ix + 5 || x === ix + iw - 6) && y >= iy + 11 && y <= iy + 104) c = BRASS.base;
    if ((y === iy + 11 || y === iy + 104) && x >= ix + 5 && x <= ix + iw - 6) c = BRASS.base;
    S.px(x, y, c);
  }
  S.rect(ix + iw - 5, iy + 116, 2, 26, BRASS.base); S.rect(ix + iw - 5, iy + 116, 1, 26, BRASS.hi);
}

// the blind: a cream roller blind with a faded crest, a wooden batten and a brass ring to pull
const BLINDH = 66, REFY = 122;   // REFY: where the glass's reflection is taken from
function paintBlind(S) {
  for (let y = 0; y < BLINDH - 4; y++) for (let x = 0; x < GW; x++) {
    let c = (x % 6 === 0) ? 0xbca880 : (y % 4 === 0 && x % 2) ? 0xc4b088 : 0xccb890;
    if (x < 2 || x > GW - 3) c = 0xa89470;
    S.px(GX + x, GY + y, c, y < BLINDH - 4 ? 0.9 : 1);
  }
  // the crest: a winged wheel, faded
  const cx = GX + GW / 2, cy = GY + 30;
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = sq(x, y); if (d > 3.2 && d < 5) S.px(cx + x, cy + y, 0x9a6a5a); }
  S.px(cx, cy, 0x9a6a5a); S.line(cx - 3, cy, cx + 3, cy, 0xb08a78); S.line(cx, cy - 3, cx, cy + 3, 0xb08a78);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) S.line(cx + s * 6, cy - 2 + k * 1.5, cx + s * (14 - k * 2), cy - 4 + k * 2, 0xa87a68);
  S.rect(GX, GY + BLINDH - 4, GW, 3, 0x6a3a20); S.rect(GX, GY + BLINDH - 4, GW, 1, 0x8a5434);
  S.rect(cx - 2, GY + BLINDH - 1, 5, 1, BRASS.base); S.px(cx - 2, GY + BLINDH - 2, BRASS.base); S.px(cx + 2, GY + BLINDH - 2, BRASS.base);
}

/* ——— building the carriage for one width: in steps, so it can be spread over a few frames ——— */
const ROOMS = new Map();
function sprite(x0, y0, w, h, paint) { return { x0, y0, w, h, paint, ras: null, img: [] }; }
function spriteImg(RM, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = bakeOne(sp.ras, sp.x0 + RM.ox, sp.y0, RM.F, k);
    if (sp.img[0] && sp.img[1]) sp.ras = null;
  }
  return sp.img[k];
}
const roomW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);

function* buildRoom(rw) {
  const P = plan(rw), ox = P.ox;
  const back = new Ras(rw, H, ox, 0), front = new Ras(rw, H, ox, 0);
  paintShell(back, P); yield;
  if (P.door) paintEnd(back, P);
  P.glass.forEach((g, i) => paintWindow(back, g, i ? '17-20' : '13-16'));
  paintBags(back, 0, 0); if (P.bay2) paintBags(back, BAY2, 1); if (P.door) paintBags(back, DOOR.x + 16, 2);
  paintRail(back, P); yield;
  paintTable(back, 0); paintTableThings(back);
  if (P.bay2) { paintTable(back, BAY2); paintBay2Things(back, BAY2); back.ox += BAY2; paintLamp(back); back.ox -= BAY2; }
  paintLamp(back); paintUmbrella(back); paintFloorThings(back);
  back.rect(279, 58, 3, 3, BRASS.base); back.px(279, 58, BRASS.hi); back.px(281, 60, BRASS.lo);   // the coat hook
  yield;
  paintSeat(front, 2, 1); paintSeat(front, 318, -1);
  if (P.bay2) { paintSeat(front, BAY2 + 2, 1); paintSeat(front, BAY2 + 318, -1); }
  paintCarrier(front); paintCardigan(front); yield;
  const n = rw * H, F = { rw, C: new Float32Array(n), W: new Float32Array(n), L: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) { const cx = X - ox, j = y * rw + X; F.C[j] = coolAt(cx, y, P); F.W[j] = warmAt(cx, y, P); F.L[j] = lampAt(cx, y); }
    if (y % 40 === 39) yield;
  }
  const RM = {
    rw, ox, P, F,
    back: { x0: -ox, y0: 0, w: rw, h: H, ras: back, img: [] }, front: { x0: -ox, y0: 0, w: rw, h: H, ras: front, img: [] },
    coat: [-2, -1, 0, 1, 2].map((k) => sprite(COAT.x, COAT.y, COAT.w, COAT.h, (S) => paintCoat(S, k))),
    cat: [0, 1, 2, 3, 4].map((f) => sprite(CAR.dx, CAR.dy, CAR.dw, CAR.dh, (S) => paintCat(S, f))),
    grille: sprite(CAR.dx, CAR.dy, CAR.dw, CAR.dh, paintGrille),
    lampLit: sprite(42, 100, 28, 19, paintLampLit),
    blind: sprite(GX, GY, GW, BLINDH, paintBlind),
    pas: P.bay2 ? [0, 1, 2].map((f) => sprite(PAS.x, PAS.y, PAS.w, PAS.h, (S) => paintPassenger(S, f))) : null,
    door: P.door ? sprite(DOOR.x + 6, DOOR.y + 6, DOOR.w - 12, 248, paintDoor) : null,
  };
  for (const k of [0, 1]) { spriteImg(RM, RM.back, k); yield; spriteImg(RM, RM.front, k); yield; }
  const small = [...RM.coat, ...RM.cat, RM.grille, RM.lampLit, RM.blind, ...(RM.pas || []), ...(RM.door ? [RM.door] : [])];
  for (const k of [0, 1]) { for (const sp of small) spriteImg(RM, sp, k); yield; }
  // the carriage as the glass gives it back in a tunnel: the lit room, mirrored
  RM.refl = mk(rw, H);
  { const g = RM.refl.getContext('2d'); g.translate(rw, 0); g.scale(-1, 1); g.drawImage(RM.back.img[1], 0, 0); g.drawImage(RM.front.img[1], 0, 0); }
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

/* ——— outside: the country going by, in tiles that wrap ———
   Each layer is painted once per time of day and slides at its own fraction of the train's speed:
   the clouds and far hills hardly at all, the poles and the other line's rails flashing past. */
const TODP = {
  dusk: {
    sky: [0x15163a, 0x1c1c46, 0x262352, 0x332a5e, 0x463268, 0x623a6e, 0x864670, 0xa8546e, 0xc4686a, 0xd8806a],
    cloud: [0x221e44, 0x2c2650, 0x3c2e5c, 0x5a3a68, 0x8a4a6c], far: 0x3e3060, farHi: 0x6a4a78, mid: 0x2a2248, midHi: 0x44325e,
    plain: 0x211c3a, field: [0x261f42, 0x2e2548, 0x1e1834], water: [0xb0607a, 0x84487a, 0x5e3a6c, 0x40305e], near: 0x17132a, nearHi: 0x2c2244,
    tree: 0x110e22, treeHi: 0x34244a, pole: 0x0e0a18, wire: 0x1c1428, rail: 0xb88a9a, railLo: 0x5a4a6a, ballast: [0x1c1830, 0x26203a, 0x14101e],
    lit: 0.62, star: 0, rain: '170,150,200',
  },
  night: {
    sky: [0x05081a, 0x070b20, 0x0a0f28, 0x0d1430, 0x111a38, 0x162042, 0x1c274a, 0x232e52, 0x2c3658, 0x363e5e],
    cloud: [0x0c1226, 0x111830, 0x18203a, 0x222a46, 0x2e3452], far: 0x141c36, farHi: 0x26304e, mid: 0x0e1428, midHi: 0x1c2440,
    plain: 0x0b1020, field: [0x0e1426, 0x121a2e, 0x0a0e1c], water: [0x3a4a72, 0x2c3a62, 0x1e2a4e, 0x141e3c], near: 0x080b16, nearHi: 0x161c30,
    tree: 0x05070f, treeHi: 0x141a2e, pole: 0x04050c, wire: 0x080a14, rail: 0x7a86a8, railLo: 0x323a56, ballast: [0x0c0e1a, 0x121522, 0x080a12],
    lit: 0.8, star: 1, rain: '120,140,190',
  },
  dawn: {
    sky: [0x1c2244, 0x252e58, 0x323c68, 0x444c74, 0x5a5a7c, 0x766a82, 0x967a84, 0xb88c84, 0xd6a286, 0xeab88a],
    cloud: [0x3a3e60, 0x4a4a6c, 0x645a74, 0x8a6e7a, 0xc08a7a], far: 0x4c4a70, farHi: 0x7a6a86, mid: 0x363a5a, midHi: 0x4e4c6a,
    plain: 0x2a2e46, field: [0x30344c, 0x383a52, 0x262a40], water: [0xf0c08e, 0xc8a08e, 0x8a7a8e, 0x5a5a7a], near: 0x1e2236, nearHi: 0x34364e,
    tree: 0x161828, treeHi: 0x3a3a52, pole: 0x10121e, wire: 0x22243a, rail: 0xd8b8a0, railLo: 0x6a6a82, ballast: [0x22243a, 0x2c2e44, 0x1a1c2e],
    lit: 0.25, star: 0, rain: '190,180,200',
  },
};
// a wrapped sine sum: periodic over the tile, so the ridge meets itself
const ridge = (x, W, parts) => parts.reduce((v, [k, a, p]) => v + a * Math.sin((x / W) * Math.PI * 2 * k + p), 0);
const LITC = [0xffc870, 0xffb45a, 0xffd890, 0xf0a050, 0xffe0a0];

function cloudStrip(seed, W, n, cols, density) {
  const h = 64, r = rng(seed), m = new Float32Array(W * h), R = new Ras(W, h);
  for (let i = 0; i < n; i++) {
    const cx = r() * W, cy = 10 + r() * 34, rad = 6 + r() * 14, st = 1.8 + r() * 1.6;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad * st); x <= cx + rad * st; x++) {
      if (y < 0 || y >= h) continue;
      const d = sq((x - cx) / st, y - cy) / rad;
      if (d < 1) m[y * W + (((x % W) + W) % W)] += (1 - d) * density;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
    const v = m[y * W + x];
    if (v < 0.25 || (v < 0.5 && bay(x, y) > (v - 0.25) / 0.25)) continue;
    const under = y < h - 1 && m[(y + 1) * W + x] < 0.3 ? 1 : 0;   // the undersides catch the light below
    const t = Math.min(1, Math.max(0, (y / h) * 0.8 + (0.6 - Math.min(v, 1.2) * 0.5)));
    const ci = t * (cols.length - 2), i0 = Math.floor(ci);
    R.px(x, y, under ? cols[cols.length - 1] : ci - i0 > bay(x + 1, y) ? cols[Math.min(cols.length - 2, i0 + 1)] : cols[i0]);
  }
  return R.canvas();
}

function* buildLand(tod) {
  const P = TODP[tod], O = { tod, P };
  // the sky: a tile of dithered gradient
  { const R = new Ras(64, GH); R.vgrad(0, 0, 64, 66, P.sky, 0.9); R.rect(0, 66, 64, GH - 66, P.sky[P.sky.length - 1]); O.sky = R.canvas(); }
  O.clouds = [cloudStrip(11, 640, 26, P.cloud, 0.7), cloudStrip(17, 512, 18, [P.cloud[1], P.cloud[2], P.cloud[3], P.cloud[4]], 0.8)];
  const lr = rng(tod.length * 31 + 7), lit = () => lr() < P.lit;
  yield;
  // far hills, hazy, a mast on one of them and a few farm lights
  { const W = 640, R = new Ras(W, GH);
    for (let x = 0; x < W; x++) {
      const top = Math.round(48 + ridge(x, W, [[2, 6, 1], [5, 3.5, 2], [11, 1.5, 0.4]]));
      for (let y = top; y < GH; y++) R.px(x, y, y === top ? P.farHi : y === top + 1 && bay(x, y) < 0.5 ? P.farHi : P.far);
      for (let y = top + 8; y < GH; y++) if (bay(x, y) < Math.min(0.5, (y - top - 8) / 30)) R.px(x, y, mixc(P.far, P.sky[8], 0.12));
    }
    const mx = 420, mt = Math.round(48 + ridge(mx, W, [[2, 6, 1], [5, 3.5, 2], [11, 1.5, 0.4]]));
    R.line(mx, mt, mx, mt - 12, P.farHi); R.line(mx - 2, mt, mx, mt - 8, P.farHi); R.line(mx + 2, mt, mx, mt - 8, P.farHi);
    O.mast = { x: mx, y: mt - 13 };
    for (let k = 0; k < 9; k++) { const x = Math.floor(lr() * W), top = Math.round(48 + ridge(x, W, [[2, 6, 1], [5, 3.5, 2], [11, 1.5, 0.4]])); if (lit()) R.px(x, top + 3 + Math.floor(lr() * 6), LITC[k % 5]); }
    O.far = R.canvas(); O.farW = W; }
  yield;
  // nearer hills with hedgerows, copses and a village climbing the slope: a church, lit windows
  { const W = 960, R = new Ras(W, GH), top = (x) => Math.round(62 + ridge(x, W, [[3, 4, 0.3], [7, 2.5, 1.7], [13, 1, 0.2]]));
    for (let x = 0; x < W; x++) {
      const t = top(x);
      for (let y = t; y < GH; y++) {
        let c = y === t ? P.midHi : P.mid;
        if ((x * 2 + y * 7) % 41 === 0 || ((x + y * 3) % 67 < 1)) c = mixc(P.mid, 0x000000, 0.3);
        R.px(x, y, c);
      }
    }
    for (let k = 0; k < 26; k++) {   // copses along the ridge
      const x = Math.floor(lr() * W), t = top(x), r = 2 + Math.floor(lr() * 3);
      R.ell(x, t - r + 1, r + 1, r, P.mid); R.px(x - 1, t - 2 * r + 1, P.midHi); R.px(x, t - 2 * r + 1, P.midHi);
    }
    const house = (x, base, w, h, roof) => {
      R.rect(x, base - h, w, h, mixc(P.mid, 0x2a1a2a, 0.3));
      for (let k = 0; k <= Math.ceil(w / 2); k++) R.rect(x - 1 + k, base - h - k, w + 2 - k * 2, 1, roof);
      if (lit()) { const c = LITC[Math.floor(lr() * 5)]; R.px(x + 1 + Math.floor(lr() * Math.max(1, w - 2)), base - h + 2, c); if (w > 5 && lit()) R.px(x + w - 2, base - h + 2, c); }
      if (lr() < 0.5) R.rect(x + w - 2, base - h - Math.ceil(w / 2) - 1, 1, 2, roof);
    };
    for (let k = 0; k < 12; k++) { const x = Math.floor(lr() * W); house(x, top(x) + 4 + Math.floor(lr() * 12), 4 + Math.floor(lr() * 3), 3, mixc(P.midHi, 0x3a2028, 0.4)); }
    O.village = [];
    for (const [vx, n] of [[300, 14], [760, 4], [90, 2]]) {
      for (let k = 0; k < n; k++) {
        const x = vx + Math.floor(lr() * n * 7) - n * 3, base = top(x) + 6 + Math.floor(lr() * 8);
        house(x, base, 4 + Math.floor(lr() * 5), 3 + Math.floor(lr() * 3), mixc(P.midHi, 0x3a2028, 0.4));
      }
      O.village.push(vx);
    }
    const cx = 330, cb = top(cx) + 8;   // the church: a tower, a spire, a lit clock
    R.rect(cx, cb - 16, 5, 16, mixc(P.mid, 0x2a1a2a, 0.35)); R.rect(cx + 5, cb - 8, 10, 8, mixc(P.mid, 0x2a1a2a, 0.3));
    for (let k = 0; k < 9; k++) R.rect(cx + 2 - Math.floor((8 - k) / 4), cb - 25 + k, 1 + Math.floor((8 - k) / 4) * 2, 1, P.midHi);
    R.px(cx + 2, cb - 13, 0xffe0a0); R.px(cx + 7, cb - 5, LITC[0]); R.px(cx + 11, cb - 5, LITC[2]);
    for (let x = 250; x < 380; x += 9) R.px(x, top(x) + 14 + Math.round(Math.sin(x * 0.07) * 2), 0xffd890);   // the lane's lamps
    O.mid = R.canvas(); O.midW = W; O.church = cx; }
  yield;
  // the river valley: a band of water holding the sky, and an old stone bridge over a side stream
  { const W = 1024, R = new Ras(W, GH), rv = (x) => 88 + Math.round(ridge(x, W, [[3, 2, 0.5], [7, 0.8, 2]]));
    for (let x = 0; x < W; x++) {
      for (let y = 76; y < GH; y++) R.px(x, y, (y + Math.floor(x / 40)) % 5 === 0 ? P.field[2] : (Math.floor(x / 34) % 3 === 0 ? P.field[1] : P.field[0]));
      R.px(x, 76, P.field[1]);
      const c = rv(x), w = 5 + Math.round(Math.sin((x / W) * Math.PI * 6) * 1.5);
      for (let y = c - 2; y < c + w - 2; y++) {
        const k = (y - (c - 2)) / w;
        let col = P.water[Math.min(3, Math.floor(k * 3.2 + (bay(x, y) - 0.5) * 0.6))];
        if ((x * 3 + y * 11) % 23 === 0) col = P.water[0];
        R.px(x, y, col);
      }
      R.px(x, c - 3, mixc(P.field[0], 0x000000, 0.35));
    }
    const bx = 600, sx = 628;   // a side stream running down to the river, the bridge across it
    for (let y = 77; y < 90; y++) { const hw = 1 + Math.round((y - 77) / 4); for (let x = sx - hw; x <= sx + hw; x++) R.px(x, y, P.water[y < 82 ? 2 : 1]); }
    const deck = 80, st = mixc(P.mid, 0x5a4a52, 0.4), stHi = mixc(st, 0xffffff, 0.18), stLo = mixc(st, 0x000000, 0.35);
    R.rect(bx, deck - 2, 56, 2, stHi); R.rect(bx, deck, 56, 7, st);
    for (const [ax, aw] of [[bx + 8, 10], [bx + 23, 12], [bx + 40, 10]]) for (let y = deck + 2; y < deck + 7; y++) {
      const hw = aw / 2 * Math.sqrt(Math.max(0, 1 - ((deck + 7 - y) / 5.5) ** 2));
      for (let x = Math.round(ax + aw / 2 - hw); x < ax + aw / 2 + hw; x++) R.px(x, y, y > deck + 4 ? P.water[1] : stLo);
    }
    for (let x = bx; x < bx + 56; x += 4) R.px(x, deck + 1, stLo);
    for (const lx of [bx + 4, bx + 51]) { R.rect(lx, deck - 6, 1, 4, P.pole); R.px(lx, deck - 7, 0xffe0a0); for (let k = 0; k < 4; k++) R.px(lx + (k & 1), rv(lx) + k, 0xd8a060); }
    O.lamps = [[bx + 4, deck - 7], [bx + 51, deck - 7]];
    O.river = R.canvas(); O.riverW = W; O.bridge = bx; }
  yield;
  // near fields: a hedge, furrows, fence posts and a gate
  { const W = 512, R = new Ras(W, GH);
    for (let x = 0; x < W; x++) {
      const hedge = 94 + Math.round(ridge(x, W, [[9, 1.2, 0], [23, 0.8, 1]]) + (x % 7 === 0 ? -1 : 0));
      for (let y = hedge; y < GH; y++) {
        let c = y < hedge + 3 ? P.nearHi : P.near;
        if (y >= hedge + 4 && ((x + (y - hedge) * 3) % 9 === 0)) c = mixc(P.near, P.field[1], 0.5);
        R.px(x, y, c);
      }
      R.px(x, hedge, mixc(P.nearHi, P.sky[6], 0.3));
    }
    for (let x = 6; x < W; x += 17) { R.rect(x, 96, 1, 8, P.tree); R.px(x, 95, P.nearHi); }
    R.rect(0, 98, W, 1, mixc(P.near, P.wire, 0.6));
    R.rect(300, 97, 14, 1, P.nearHi); R.rect(300, 100, 14, 1, P.nearHi); for (let k = 0; k < 4; k++) R.line(300 + k * 4, 100, 302 + k * 4, 97, P.nearHi);
    O.near = R.canvas(); O.nearW = W; }
  yield;
  // trees close to the line: dark masses with a rim of sky light, and wide gaps between
  { const W = 1280, R = new Ras(W, GH), tr = rng(tod.length * 5 + 3);
    const pine = (x, base, h) => { for (let y = 0; y < h; y++) { const hw = Math.round((y / h) * (h / 3.2) + (y % 5 === 4 ? 1 : 0)); for (let k = -hw; k <= hw; k++) R.px(x + k, base - h + y, k === -hw && y % 5 < 3 ? P.treeHi : P.tree); } R.rect(x, base, 1, GH - base, P.tree); };
    const round = (x, base, r) => { for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * (0.45 + tr() * 0.25); const bx = x + Math.cos(a) * r * 0.55, by = base - r + Math.sin(a) * r * 0.5; R.ell(bx, by, rr * 1.2, rr, P.tree); if (by < base - r) for (let q = -Math.round(rr); q <= 0; q++) if (bay(Math.round(bx) + q, Math.round(by - rr)) < 0.7) R.px(bx + q, by - rr, P.treeHi); } R.rect(x - 1, base, 2, GH - base, P.tree); };
    for (const cx of [60, 120, 470, 520, 560, 900, 1150, 1185]) {
      const n = 1 + Math.floor(tr() * 3);
      for (let k = 0; k < n; k++) { const x = cx + k * 9 + Math.floor(tr() * 6), base = 100 + Math.floor(tr() * 4); if (tr() < 0.7) pine(x, base, 26 + Math.floor(tr() * 30)); else round(x, base - 10, 6 + Math.floor(tr() * 5)); }
    }
    for (let x = 0; x < W; x++) R.rect(x, 104, 1, GH - 104, P.tree);   // the cutting's edge, close by
    for (let x = 0; x < W; x++) if (bay(x, 103) < 0.5) R.px(x, 103, P.tree);
    O.trees = R.canvas(); O.treesW = W; }
  yield;
  // telegraph poles and their sagging wires, one span to a tile
  { const W = 150, R = new Ras(W, GH), px = 20;
    for (let x = 0; x < W; x++) {
      const u = ((x - px + W) % W) / W;
      for (const [y0, sag] of [[23, 11], [27, 12], [33, 13]]) R.px(x, Math.round(y0 + sag * 4 * u * (1 - u)), P.wire);
    }
    R.rect(px, 18, 2, GH - 18, P.pole); R.px(px, 18, mixc(P.pole, P.treeHi, 0.6));
    R.rect(px - 8, 22, 18, 2, P.pole); R.rect(px - 6, 31, 14, 1, P.pole);
    for (const ix of [px - 7, px - 2, px + 3, px + 8]) R.px(ix, 21, mixc(P.wire, 0xd8e0f0, 0.4));
    R.line(px + 2, 40, px + 7, 30, P.pole);
    O.poles = R.canvas(); O.polesW = W; }
  yield;
  // the other line, close below: ballast, sleepers, two rails, and a joint every rail's length
  { const W = JOINT, R = new Ras(W, 13);
    for (let y = 0; y < 13; y++) for (let x = 0; x < W; x++) R.px(x, y, P.ballast[(x * 7 + y * 13 + (x >> 2)) % 5 < 2 ? 1 : (x + y) % 3 ? 0 : 2]);
    for (let x = 2; x < W; x += 6) R.rect(x, 6, 2, 6, 0x2a1a14);
    for (const [ry, hi] of [[3, 0.6], [8, 1]]) { R.rect(0, ry, W, 1, mixc(P.railLo, P.rail, hi)); R.rect(0, ry + 1, W, 2, P.railLo); }
    for (const ry of [3, 8]) { R.rect(0, ry, 1, 3, 0x0a0a10); R.rect(W - 4, ry + 1, 8, 1, P.rail); R.px(W - 2, ry + 1, 0xffffff); }
    O.rail = R.canvas(); }
  return O;
}
const LANDS = {};
const landFor = (tod) => LANDS[tod] || (LANDS[tod] = finish(buildLand(tod)));

// a small halt: a lamplit platform, a little station house with its canopy, a bench, someone
// waiting under an umbrella, and the name board. One per name and time of day, made when needed.
const STW = 380;
const HALTS = new Map();
function haltFor(name, tod) {
  const key = `${name}|${tod}`;
  if (HALTS.has(key)) return HALTS.get(key);
  const P = TODP[tod], R = new Ras(STW, GH), lamps = [];
  const brick = mixc(0x5a3436, P.mid, 0.35), brickLo = mixc(brick, 0x000000, 0.3), slate = mixc(0x2a2a3a, P.mid, 0.3);
  // railings at the back of the platform
  for (let x = 0; x < STW; x++) { if (x % 3 === 0) R.rect(x, 86, 1, 10, P.pole); }
  R.rect(0, 86, STW, 1, P.pole); R.rect(0, 90, STW, 1, P.pole);
  // the station house and its canopy
  R.rect(120, 62, 80, 34, brick);
  for (let y = 63; y < 96; y += 3) for (let x = 120 + ((y / 3) & 1) * 3; x < 200; x += 6) R.px(x, y, brickLo);
  for (let k = 0; k < 8; k++) R.rect(116 + k, 54 + k, 88 - k * 2, 1, k === 0 ? mixc(slate, 0xffffff, 0.2) : slate);
  R.rect(132, 70, 12, 12, 0x2a1a14); R.erect(133, 71, 10, 10, 0xffc878); R.rect(137, 71, 1, 10, 0x6a4a30); R.rect(133, 75, 10, 1, 0x6a4a30);
  R.erect(134, 72, 2, 2, 0xffe8b0);
  R.rect(176, 74, 10, 22, 0x3a2418); R.erect(178, 76, 6, 6, 0xffd890); R.px(184, 86, BRASS.base);
  R.rect(150, 74, 14, 18, 0xe8dcc0); R.rect(151, 75, 12, 8, 0x3a6a8a); R.rect(151, 84, 12, 6, 0xc04a3a); R.rect(153, 78, 6, 2, 0xf0e0b0);
  R.rect(96, 62, 140, 3, mixc(0x3a4a3a, P.mid, 0.25)); R.rect(96, 62, 140, 1, mixc(0x5a6a4a, P.mid, 0.2));
  for (let x = 96; x < 236; x += 2) R.px(x, 65, mixc(0x3a4a3a, P.mid, 0.25));
  for (const px of [100, 232]) R.rect(px, 65, 1, 31, P.pole);
  R.ell(214, 70, 3, 3, 0x2a2a30); R.ell(214, 70, 2, 2, 0xf4ecd8); R.px(214, 69, 0x2a2420); R.px(215, 70, 0x2a2420); R.rect(214, 65, 1, 2, P.pole);
  // the name board on its posts
  const tw = textW(name), bx = 250, bw = tw + 8;
  R.rect(bx + 3, 70, 1, 26, P.pole); R.rect(bx + bw - 4, 70, 1, 26, P.pole);
  R.rect(bx, 61, bw, 10, 0xe8dcc0); R.rect(bx + 1, 62, bw - 2, 8, 0x1e3a2e); R.text(name, bx + 4, 64, 0xf0e6cc);
  // a bench, and someone waiting under an umbrella
  R.rect(56, 90, 18, 2, 0x5a3a24); R.rect(56, 87, 18, 1, 0x5a3a24); R.rect(57, 92, 1, 4, P.pole); R.rect(72, 92, 1, 4, P.pole);
  R.rect(84, 82, 4, 11, 0x2a3048); R.rect(85, 93, 1, 3, 0x1a1a22); R.rect(87, 93, 1, 3, 0x1a1a22); R.rect(85, 80, 2, 2, 0xd8a888);
  for (let k = 0; k < 4; k++) R.rect(80 + k, 76 + (3 - k), 13 - k * 2, 1, k === 3 ? 0xd06070 : 0x8a2a3a); R.rect(86, 79, 1, 3, 0x2a2a30);
  // the lamps, and the platform: a pale edge, wet flags holding the lamplight, a brick face
  for (const lx of [24, 108, 240, 340]) {
    R.rect(lx, 42, 1, 54, P.pole); R.rect(lx - 2, 38, 5, 3, P.pole); R.rect(lx - 1, 37, 3, 1, P.pole);
    R.erect(lx - 1, 41, 3, 1, 0xffe0a0); lamps.push(lx);
  }
  for (let x = 0; x < STW; x++) {
    R.px(x, 96, 0xd8d0b8); R.px(x, 97, 0xb89a40);
    for (let y = 98; y < 102; y++) R.px(x, y, (x + y) % 11 === 0 ? mixc(P.near, 0x8a8aa0, 0.3) : mixc(P.near, 0x5a5a6a, 0.35));
    for (let y = 102; y < GH; y++) R.px(x, y, ((x + (((y - 102) / 3) | 0) * 3) % 8 === 0 || (y - 102) % 3 === 0) ? mixc(brickLo, 0x000000, 0.4) : mixc(brick, 0x000000, 0.35));
  }
  for (const lx of [...lamps, 138]) for (let y = 98; y < 102; y++) for (let x = lx - 3; x <= lx + 3; x++) if (bay(x, y) < 0.55 - Math.abs(x - lx) * 0.12) R.px(x, y, 0xc89a60);
  const H2 = { cv: R.canvas(), lamps, win: [138, 76] };
  HALTS.set(key, H2);
  while (HALTS.size > 4) HALTS.delete(HALTS.keys().next().value);
  return H2;
}

/* ——— glows, the tunnel, the glass, the steam: the cached bits of the moving picture ——— */
let FX = null;
function fx() {
  if (FX) return FX;
  FX = {
    pool: glow(56, 16, 0xffc070, 0.55, 5), wall: glow(30, 26, 0xffb860, 0.45, 4), shade: glow(14, 10, 0xffd890, 0.8, 4),
    ceil: glow(46, 12, 0xffd8a0, 0.32, 4), night: glow(16, 8, 0xffe0b0, 0.5, 3), phone: glow(10, 8, 0x8ab8ff, 0.6, 3),
    lamp: glow(9, 9, 0xffd890, 0.8, 4), lampSm: glow(4, 4, 0xffe0a0, 0.9, 3), win: glow(10, 7, 0xffc070, 0.6, 3),
    flash: glow(120, 46, 0xc8c8ff, 0.7, 5), moon: glow(26, 26, 0xb8c4f0, 0.5, 4), tunLamp: glow(8, 8, 0xff9a40, 0.8, 4),
    dawn: glow(150, 70, 0xffb890, 0.35, 4), heat: glow(120, 12, 0xff8a40, 0.4, 4), dusk: glow(150, 70, 0xc070a0, 0.3, 4), eye: glow(2, 2, 0xffe060, 0.8, 2),
    steam: Array.from({ length: 9 }, (_, k) => rgba(0xeef0fa, k * 0.045)),
  };
  // the reading lamp's cone in the air, faint, in a few flat steps
  const cone = new Ras(70, 80);
  for (let y = 0; y < 76; y++) {
    const u = y / 76, l = 30 - u * 22 - y * 0.05, r = 42 + u * 30;
    for (let x = Math.ceil(l); x < r; x++) {
      const e = Math.min(x - l, r - x) / (r - l), a = Math.min(1, e * 4) * (1 - u * 0.5);
      const q = band(a * 3, x, y);
      if (q > 0) cone.px(x, y, 0xffd9a0, q * 0.04);
    }
  }
  FX.cone = cone.canvas();
  // the moon, for the night
  const M = new Ras(11, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) { const d = sq(x - 5, y - 5); if (d <= 5.2) M.px(x, y, (x - 5) + (y - 5) > 3 + bay(x, y) * 2 ? 0xd8cdb0 : 0xf6efd8); }
  for (const [x, y] of [[4, 3], [5, 4], [7, 7], [3, 6]]) M.px(x, y, 0xcbc0a4);
  FX.moonImg = M.canvas();
  // the tunnel: sooty rock and concrete ribs, cable runs; and the portal's stone face
  const T = new Ras(96, GH), tr = rng(5);
  const rowC = Array.from({ length: GH }, (_, y) => (y > 100 ? 0x0b0a0e : [0x0f0e15, 0x121019, 0x0d0c12, 0x141219][Math.floor(tr() * 4)]));
  for (let y = 0; y < GH; y++) for (let x = 0; x < 96; x++) {
    let c = rowC[y];
    if (((x + y * 37) % 96) < 14 + (y % 7)) c = mixc(c, 0x2a2632, 0.35);
    if (x % 48 === 0 && y < 100) c = 0x1c1a22;
    T.px(x, y, c);
  }
  FX.tunnel = T.canvas();
  const Pt = new Ras(16, GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < 16; x++) Pt.px(x, y, (y % 7 === 0 || (x + ((y / 7) | 0) * 5) % 8 === 0) ? 0x1e1c26 : x < 3 ? 0x4a4656 : 0x36323e);
  FX.portal = Pt.canvas();
  // the mist on the glass: thick in the corners and along the bottom, a breath elsewhere
  const fr = rng(71), F = new Ras(GW, GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const cd = Math.min(sq(x, y), sq(GW - x, y), sq(x, GH - y), sq(GW - x, GH - y)), ed = Math.min(x, GW - 1 - x, y, GH - 1 - y);
    const v = Math.max(1 - cd / 26, 1 - ed / 4, ((y - (GH - 24)) / 24) * 0.7) + (fr() - 0.5) * 0.16 + Math.sin(x * 0.09 + y * 0.05) * 0.05;
    const q = band(Math.max(0, v) * 3, x, y);
    if (q > 0) F.px(x, y, 0xc8d0e4, [0, 0.13, 0.24, 0.36, 0.44][Math.min(4, q)]);
  }
  FX.fog = F.canvas();
  // a wipe: a hand's width, soft at its ends
  const Wp = new Ras(64, 13);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 64; x++) {
    const ex = Math.min(x, 63 - x) / 14, ey = 1 - Math.abs(y - 6) / 6.5, v = Math.min(1, ex) * ey * 1.6;
    if (v > 0 && bay(x, y) < v) Wp.px(x, y, 0x000000);
  }
  FX.wipe = Wp.canvas();
  // drops already beading on the glass
  const B = new Ras(GW, GH), br = rng(37);
  for (let i = 0; i < (GW * GH) / 150; i++) {
    const x = 1 + Math.floor(br() * (GW - 2)), y = 1 + Math.floor(br() * (GH - 3)), big = br() < 0.25;
    B.px(x, y, 0xd0dcf4, 0.38); B.px(x, y + 1, 0x3a4a6a, 0.32);
    if (big) { B.px(x + 1, y, 0xa8b8d8, 0.4); B.px(x + 1, y + 1, 0x3a4a6a, 0.4); B.px(x, y, 0xeef4ff, 0.6); }
  }
  FX.beads = B.canvas();
  return FX;
}

/* ——— state ——— */
const MESSAGES = ['A message: “Save me a seat at breakfast”', 'A message: “Is it still raining where you are?”', 'A message: “Mim will love the sea”', 'No signal in the hills · 64% battery'];
const PAGES = ['Chapter nine: the lighthouse in winter', 'A page turns: the letter, at last', 'Chapter ten: the long way round', 'A page turns: snow on the harbour wall'];
function newDrop(r, anywhere) { return { x: 2 + r() * (GW - 4), y: anywhere ? r() * GH : r() * GH * 0.9, hold: 0.3 + r() * 3, len: 0, big: r() < 0.35 }; }
function makeState(seed) {
  const r = rng(seed);
  return {
    r, t: 0, dist: 300 + r() * 2000, v: 1, todI: 0, todFrom: 0, todK: 1,
    lampOn: true, lamp: 1, blind: 0, blindTo: 0, tea: 1, sip: 0, refill: 0, steam: [], steamT: 0, steamBoost: 0,
    ripple: 0.3, bump: 0, coat: 0, coatV: 0, umb: [], umbT: 1, cat: { f: 0, stir: 0, blink: 3, bph: 0 }, pas: { f: 0, stir: 0, bph: 1 },
    door: 0, doorTo: 0, ticket: 0, page: 0, pageN: 0, phone: { on: 0, wait: 20 + r() * 25, msg: 0 }, music: true, bags: 0,
    jn: null, knocks: [], later: [],
    station: null, stationWait: 22 + r() * 16, stationI: Math.floor(r() * STATIONS.length),
    tunnel: null, tunnelWait: 52 + r() * 24, inTun: 0,
    flash: 0, flashT: [], flashX: 0, thunder: -1, lightWait: 14 + r() * 16,
    glass: [], streaks: Array.from({ length: 96 }, () => ({ x: r() * 800, y: r() * GH, s: 0.7 + r() * 0.6, l: 3 + Math.floor(r() * 4) })),
    stars: Array.from({ length: 70 }, () => ({ x: r() * 800, y: r() * 52, p: r() * 6.3, sp: 0.5 + r() * 1.5 })),
  };
}
function glassState(s, i) {
  if (!s.glass[i]) {
    const fog = mk(GW, GH), fg = fog.getContext('2d');
    fg.drawImage(fx().fog, 0, 0);
    s.glass[i] = { drops: Array.from({ length: 34 }, () => newDrop(s.r, true)), fog, fg, wipes: [], dirty: false };
  }
  return s.glass[i];
}
const nextStation = (s) => s.station ? s.station.name : STATIONS[(s.stationI + 1) % STATIONS.length];

/* ——— each frame ——— */
function update(s, dt, RM, io) {
  s.t += dt;
  const t = s.t, r = Math.random, ease = (k) => Math.min(1, dt * k), P = RM.P, cx0 = RM.ox + GX;
  // a halt now and then: ease down while it slides past, then pick up again
  let vT = 1;
  const st = s.station;
  if (st) {
    const bx = st.x - s.dist;
    if (bx < RM.rw + 50 && bx + STW > 30) vT = 0.42;
    if (!st.said && bx < cx0 + GW) { st.said = true; io.say(`Easing through ${TITLE(st.name)}`); }
    if (bx + STW < -30) { s.station = null; s.stationWait = 64 + r() * 50; }
  } else if ((s.stationWait -= dt) <= 0 && !s.tunnel) {
    s.stationI = (s.stationI + 1) % STATIONS.length;
    s.station = { name: STATIONS[s.stationI], x: s.dist + RM.rw + 170, said: false };
  }
  // a tunnel now and then: the glass goes dark, and the carriage looks back at itself
  const tu = s.tunnel;
  if (tu) {
    const a = tu.a - s.dist, b = tu.b - s.dist;
    s.inTun = Math.max(0, Math.min(1, (Math.min(cx0 + GW, b) - Math.max(cx0, a)) / GW));
    if (!tu.in && a < cx0 + GW / 2) { tu.in = true; io.say('Into the hills, through a tunnel'); io.amb.set('rain', 0.1); }
    if (tu.in && !tu.out && b < cx0 + GW / 2) { tu.out = true; io.say('Out into the rain again'); io.amb.set('rain', 0.6); }
    if (b < -30) { s.tunnel = null; s.tunnelWait = 58 + r() * 40; }
  } else {
    s.inTun = 0;
    if ((s.tunnelWait -= dt) <= 0 && !s.station) { const a = s.dist + RM.rw + 30; s.tunnel = { a, b: a + 940, in: false, out: false }; }
  }
  s.v += (vT - s.v) * ease(0.32);
  s.dist += s.v * BASE * dt;
  // the wheels over the rail joints: two quick knocks for the front bogie, a pause, two for the back,
  // each set off as a joint of the other line passes the middle of the window
  const xr = RM.ox + 160, jn = Math.floor((s.dist * 1.25 + xr) / JOINT);
  if (s.jn !== null && jn !== s.jn) {
    const k = 1 / Math.max(0.3, s.v);
    for (const [d, a] of [[0, 1], [AXLE, 0.75], [BOGIE, 0.9], [BOGIE + AXLE, 0.7]]) s.knocks.push({ at: t + d * k, a });
  }
  s.jn = jn;
  for (let i = s.knocks.length - 1; i >= 0; i--) {
    const kn = s.knocks[i];
    if (kn.at > t) continue;
    s.knocks.splice(i, 1); io.knock(kn.a, s.inTun);
    s.bump = Math.max(s.bump, kn.a); s.ripple = Math.min(1.3, s.ripple + 0.35 * kn.a); s.coatV += (r() - 0.5) * 0.5;
    for (const w of s.steam) w.x += (r() - 0.5) * 0.8 * kn.a;   // the steam shivers with the jolt
  }
  for (let i = s.later.length - 1; i >= 0; i--) if (s.later[i].at <= t) { const f = s.later[i].fn; s.later.splice(i, 1); f(); }
  s.bump = Math.max(0, s.bump - dt * 7);
  s.ripple = Math.max(0.12 * s.v, s.ripple * Math.exp(-dt * 1.6));
  // the coat swings on its hook: a spring, nudged by the rocking and the joints
  s.coatV += (-s.coat * 3 - s.coatV * 0.5 + Math.sin(t * 1.05) * 0.32) * dt;
  s.coat += s.coatV * dt;
  s.lamp += ((s.lampOn ? 1 : 0) - s.lamp) * ease(6); if (Math.abs(s.lamp - (s.lampOn ? 1 : 0)) < 0.01) s.lamp = s.lampOn ? 1 : 0;
  s.blind = s.blind < s.blindTo ? Math.min(s.blindTo, s.blind + dt * 0.9) : Math.max(s.blindTo, s.blind - dt * 0.9);
  s.door = s.door < s.doorTo ? Math.min(s.doorTo, s.door + dt * 1.3) : Math.max(s.doorTo, s.door - dt * 1.3);
  s.todK = Math.min(1, s.todK + dt / 3);
  s.sip = Math.max(0, s.sip - dt * 1.2); s.ticket = Math.max(0, s.ticket - dt); s.page = Math.max(0, s.page - dt * 1.6); s.bags = Math.max(0, s.bags - dt * 2);
  s.steamBoost = Math.max(0, s.steamBoost - dt);
  if (s.refill > 0 && (s.refill -= dt) <= 0) { s.tea = 1; s.steamBoost = 3; io.say('The trolley comes by: a fresh pot of tea'); }
  // steam off the tea, while there is tea
  if (s.tea > 0.02 && (s.steamT -= dt * (1 + s.steamBoost)) <= 0) { s.steamT = 0.32; s.steam.push({ x: 183 + (r() - 0.5) * 6, y: 177 + TY, a: 0, p: r() * 6.3, life: 2.2 + r() * 1.2 }); }
  for (const w of s.steam) { w.a += dt; w.y -= (6 + w.a * 2) * dt; w.x += (Math.sin(t * 1.3 + w.p) * 3 - s.v * 1.5) * dt; }
  s.steam = s.steam.filter((w) => w.a < w.life);
  // the umbrella drips on the seat back
  if ((s.umbT -= dt) <= 0) { s.umbT = 1.4 + r() * 2.6; s.umb.push({ y: 107, v: 0 }); }
  for (const d of s.umb) { d.v += 260 * dt; d.y += d.v * dt; }
  s.umb = s.umb.filter((d) => d.y < 117);
  // the cat: asleep and breathing; awake for a while if stirred, or when the train slows at a halt
  const c = s.cat;
  c.bph += dt * 1.5; c.blink -= dt;
  if (c.stir > 0) { c.stir -= dt; c.f = c.stir > 3.1 ? 2 : c.stir > 1.7 ? 4 : c.stir > 0.7 ? 2 : 1; }
  else c.f = s.v < 0.62 ? 2 : Math.sin(c.bph) > 0.2 ? 1 : 0;
  if (c.f === 2 && c.blink < 0) { c.f = 3; if (c.blink < -0.14) c.blink = 2 + r() * 3; }
  const pa = s.pas;
  pa.bph += dt * 1.1; if (pa.stir > 0) pa.stir -= dt;
  pa.f = pa.stir > 0 ? 2 : Math.sin(pa.bph) > 0 ? 1 : 0;
  // the phone lights up with a message now and then
  const ph = s.phone;
  if (ph.on > 0) ph.on -= dt; else if ((ph.wait -= dt) <= 0) { ph.on = 3.5; ph.wait = 40 + r() * 40; }
  // lightning far off over the hills, and its thunder a few seconds later
  if ((s.lightWait -= dt) <= 0) {
    s.lightWait = 34 + r() * 46;
    if (!s.tunnel) { s.flashX = cx0 + 20 + r() * (GW - 40) + (r() < 0.4 ? (r() - 0.5) * RM.rw * 0.6 : 0); s.flashT = [0, 0.13, 0.4].map((d) => t + d); s.thunder = t + 2.4 + r() * 2.6; }
  }
  s.flash = 0;
  s.flashT.forEach((ft, i) => { const d = t - ft; if (d >= 0 && d < 0.7) s.flash = Math.max(s.flash, (d < 0.05 ? 1 : Math.exp(-(d - 0.05) * 8)) * (i === 1 ? 0.55 : 1)); });
  if (s.flashT.length && t - s.flashT[s.flashT.length - 1] > 0.7) s.flashT = [];
  if (s.thunder > 0 && t >= s.thunder) { s.thunder = -1; io.thunder(); }
  // rain outside, slanting back with the speed
  const bw = RM.rw;
  for (const q of s.streaks) {
    q.x -= (60 + 110 * s.v) * q.s * dt; q.y += 150 * q.s * dt;
    if (q.y > GH) { q.y -= GH + 6; q.x = r() * (bw + 80); }
    if (q.x < -6) q.x += bw + 12;
  }
  // drops on the glass: they bead, hold, then run back across it, pushed by the wind of the train
  const vx = -(14 + 82 * s.v), vy = 12 + 30 * (1 - s.v);
  P.glass.forEach((g, i) => {
    const G = glassState(s, i);
    for (const d of G.drops) {
      if (d.hold > 0) { d.hold -= dt; d.len = Math.max(0, d.len - dt * 8); continue; }
      d.x += vx * dt * (d.big ? 1.15 : 0.9); d.y += vy * dt; d.len = Math.min(16, d.len + 40 * dt);
      if (r() < dt * 0.45) d.hold = 0.3 + r() * 2.2;
      if (d.x < -3 || d.y > GH + 2) Object.assign(d, newDrop(r, false), { x: GW * (0.25 + r() * 0.75) });
    }
    if (G.wipes.length) { for (const w of G.wipes) w.a -= dt / 30; G.wipes = G.wipes.filter((w) => w.a > 0); G.dirty = true; }
  });
}

/* ——— drawing ——— */
function tile(g, img, W, off, y, bw) { for (let x = -Math.round(((off % W) + W) % W); x < bw; x += W) g.drawImage(img, x, y); }
function tilePos(W, off, at, bw, cb) { for (let x = at - Math.round(((off % W) + W) % W); x < bw + 20; x += W) if (x > -20) cb(x); }
function textF(g, str, x, y, c) {
  g.fillStyle = c;
  for (const ch of str) { const gl = FONT[ch]; if (gl) for (let k = 0; k < 15; k++) if (gl[k] === '1') g.fillRect(x + (k % 3), y + Math.floor(k / 3), 1, 1); x += 4; }
}
const todW = (s) => { const w = { dusk: 0, night: 0, dawn: 0 }; w[TODS[s.todI]] += s.todK; w[TODS[s.todFrom]] += 1 - s.todK; return w; };

function drawLand(g, L, s, bw, a, RM) {
  const d = s.dist, t = s.t, F = fx(), P = L.P;
  g.globalAlpha = a;
  tile(g, L.sky, 64, 0, GY, bw);
  if (P.star) {
    for (const st of s.stars) { if (st.x > bw) continue; const b = Math.sin(t * st.sp + st.p); g.fillStyle = b > 0.6 ? '#fff4dc' : b > -0.3 ? '#9aa4cc' : '#4a5278'; g.fillRect(Math.round(st.x), GY + Math.round(st.y), 1, 1); }
  }
  tile(g, L.clouds[0], 640, d * 0.01 + t * 1.1, GY - 14, bw);
  if (s.flash > 0.01) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * s.flash * 0.85; g.drawImage(F.flash, Math.round(s.flashX - 120), GY + 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = a; }
  tile(g, L.clouds[1], 512, d * 0.025 + t * 2.2, GY - 6, bw);
  if (P.star) {   // the moon, low and hazy between the clouds
    g.globalAlpha = a * 0.92; g.drawImage(F.moonImg, RM.ox + GX + 122, GY + 9);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.5; g.drawImage(F.moon, RM.ox + GX + 101, GY - 12); g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
  }
  tile(g, L.far, L.farW, d * 0.045, GY, bw);
  if ((t % 2.2) < 0.5) tilePos(L.farW, d * 0.045, L.mast.x, bw, (x) => { g.fillStyle = '#ff4a4a'; g.fillRect(x, GY + L.mast.y, 1, 1); });
  tile(g, L.mid, L.midW, d * 0.12, GY, bw);
  tile(g, L.river, L.riverW, d * 0.26, GY, bw);
  tile(g, L.near, L.nearW, d * 0.52, GY, bw);
  tile(g, L.trees, L.treesW, d * 0.84, GY, bw);
  const st = s.station, H2 = st ? haltFor(st.name, L.tod) : null;
  if (st) g.drawImage(H2.cv, Math.round(st.x - d), GY);
  tile(g, L.poles, L.polesW, d, GY, bw);
  tile(g, L.rail, JOINT, d * 1.25, GY + GH - 13, bw);
  // their lights, softly
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a * 0.7;
  for (const [lx, ly] of L.lamps) tilePos(L.riverW, d * 0.26, lx, bw, (x) => g.drawImage(F.lampSm, x - 4, GY + ly - 4));
  g.globalAlpha = a * 0.45;
  tilePos(L.midW, d * 0.12, L.church, bw, (x) => g.drawImage(F.win, x - 10, GY + 52));
  if (st) {
    const sx = Math.round(st.x - d);
    g.globalAlpha = a * 0.9;
    for (const lx of H2.lamps) g.drawImage(F.lamp, sx + lx - 9, GY + 41 - 9);
    g.globalAlpha = a * 0.6; g.drawImage(F.win, sx + H2.win[0] - 10, GY + H2.win[1] - 7);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

function drawTunnel(g, s, bw) {
  const tu = s.tunnel;
  if (!tu) return;
  const a = Math.round(tu.a - s.dist), b = Math.round(tu.b - s.dist), x0 = Math.max(0, a), x1 = Math.min(bw, b), F = fx();
  if (x1 <= x0) return;
  g.save(); g.beginPath(); g.rect(x0, GY - 2, x1 - x0, GH + 4); g.clip();
  tile(g, F.tunnel, 96, s.dist, GY, bw); g.fillStyle = '#0c0b10'; g.fillRect(x0, GY + GH, x1 - x0, 3);
  g.restore();
  g.drawImage(F.portal, a - 2, GY); g.drawImage(F.portal, b - 14, GY);
  g.globalCompositeOperation = 'lighter';
  for (let wx = tu.a + 70; wx < tu.b - 40; wx += 192) {
    const x = Math.round(wx - s.dist);
    if (x < x0 - 8 || x > x1 + 8) continue;
    g.globalAlpha = 1; g.fillStyle = '#ffb060'; g.fillRect(x, GY + 34, 2, 1); g.drawImage(F.tunLamp, x - 7, GY + 26);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function drawRain(g, s, bw, P) {
  const tu = s.tunnel, a = tu ? tu.a - s.dist : 1e9, b = tu ? tu.b - s.dist : -1e9;
  for (const [alpha, head] of [[0.2, false], [0.2, true]]) {
    g.fillStyle = `rgba(${P.rain},${alpha})`;
    for (const q of s.streaks) {
      const x = Math.round(q.x), y = GY + Math.round(q.y);
      if (x > bw || (x > a && x < b)) continue;
      if (head) g.fillRect(x, y, 1, 1);
      else for (let k = 1; k <= q.l; k++) g.fillRect(x + k, y - k, 1, 1);
    }
  }
}

function drawGlass(g, RM, s, i, gl, nightW, frame) {
  const G = glassState(s, i), x0 = RM.ox + gl.x, y0 = gl.y, F = fx();
  let cov = 0;
  if (s.tunnel) { const a = s.tunnel.a - s.dist, b = s.tunnel.b - s.dist; cov = Math.max(0, Math.min(1, (Math.min(x0 + GW, b) - Math.max(x0, a)) / GW)); }
  // the carriage given back by the glass: faint at night, plain in a tunnel
  const ra = 0.04 + nightW * 0.04 + cov * 0.4;
  const sx = Math.max(0, Math.min(RM.rw - GW, Math.round(RM.rw - 2 * (x0 + GW / 2) + x0)));
  g.globalAlpha = ra; g.drawImage(RM.refl, sx, REFY, GW, GH, x0, y0, GW, GH);
  if (gl.core && s.lamp > 0.02 && ra > 0.08) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = ra * s.lamp * 0.9; g.drawImage(F.shade, Math.round(2 * (x0 + GW / 2) - RM.ox - 56) - 14, y0 + 6); g.drawImage(F.pool, Math.round(2 * (x0 + GW / 2) - RM.ox - 106) - 56, y0 + 60); g.globalCompositeOperation = 'source-over'; }
  g.globalAlpha = 1 - cov * 0.7; g.drawImage(F.beads, x0, y0);
  // running drops and their trails
  const vx = -(14 + 82 * s.v), vy = 12 + 30 * (1 - s.v), n = sq(vx, vy), ux = vx / n, uy = vy / n;
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(190,206,240,0.22)';
  for (const d of G.drops) if (d.len >= 1) for (let k = 1; k <= d.len; k += 1.5) g.fillRect(Math.round(x0 + d.x - ux * k), Math.round(y0 + d.y - uy * k), 1, 1);
  g.fillStyle = 'rgba(226,236,255,0.85)';
  for (const d of G.drops) g.fillRect(Math.round(x0 + d.x), Math.round(y0 + d.y), d.big ? 2 : 1, 1);
  g.fillStyle = 'rgba(40,56,92,0.6)';
  for (const d of G.drops) g.fillRect(Math.round(x0 + d.x), Math.round(y0 + d.y) + 1, d.big ? 2 : 1, 1);
  // the mist, with any wipes slowly misting over again
  if (G.dirty && frame % 3 === 0) {
    const f = G.fg;
    f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.clearRect(0, 0, GW, GH); f.drawImage(F.fog, 0, 0);
    f.globalCompositeOperation = 'destination-out';
    for (const w of G.wipes) { f.globalAlpha = Math.min(1, w.a * 1.5); for (let k = -1; k <= 1; k++) f.drawImage(F.wipe, Math.round(w.x - 32 + k * 20), Math.round(w.y - 6 + Math.abs(k) * 2 * w.arc)); }
    f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
    G.dirty = G.wipes.length > 0;
  }
  g.globalAlpha = 0.85; g.drawImage(G.fog, x0, y0); g.globalAlpha = 1;
}

function drawLit(g, RM, sp, l, dx = 0) {
  const x = RM.ox + sp.x0 + dx, y = sp.y0, main = l >= 0.5 ? 1 : 0;
  g.globalAlpha = 1; g.drawImage(spriteImg(RM, sp, main), x, y);
  const w = main ? 1 - l : l;
  if (w > 0.004) { g.globalAlpha = w; g.drawImage(spriteImg(RM, sp, 1 - main), x, y); }
  g.globalAlpha = 1;
}

function drawRoom(g, RM, s) {
  const { ox, P } = RM, t = s.t, F = fx(), l = s.lamp, ls = (c, x, y) => litHex(RM, x, y, c, l >= 0.5 ? 1 : 0);
  // the blind, pulled part way down over the glass
  if (s.blind > 0.004) {
    const hb = Math.round(sm(s.blind) * BLINDH);
    for (const [k, a] of [[1, l], [0, 1 - l]]) if (a > 0.004) { g.globalAlpha = a; g.drawImage(spriteImg(RM, RM.blind, k), 0, BLINDH - hb, GW, hb, ox + GX, GY, GW, hb); }
    g.globalAlpha = 1;
  }
  drawLit(g, RM, RM.back, l);
  if (RM.door) {
    const iw = DOOR.w - 12, p = Math.round(sm(s.door) * (iw - 4)), img = spriteImg(RM, RM.door, l >= 0.5 ? 1 : 0);
    g.drawImage(img, p, 0, iw - p, 248, ox + DOOR.x + 6, DOOR.y + 6, iw - p, 248);
  }
  // the umbrella's drips
  g.fillStyle = ls(0xb8c8e8, 12, 110);
  for (const d of s.umb) g.fillRect(ox + 12, Math.round(d.y), 1, 2);
  drawLit(g, RM, RM.coat[Math.max(0, Math.min(4, Math.round(s.coat * 2.2) + 2))], l);
  drawLit(g, RM, RM.front, l);
  drawLit(g, RM, RM.cat[s.cat.f], l);
  drawLit(g, RM, RM.grille, l);
  if (RM.pas) drawLit(g, RM, RM.pas[s.pas.f], l);
  // the tea: its surface trembling with the rhythm, or the dregs
  if (s.tea > 0.02) {
    g.fillStyle = ls(0x6a3a1a, 183, 180 + TY); g.fillRect(ox + 178, 180 + TY, 10, 1);
    g.fillStyle = ls(0xc88a4a, 183, 180 + TY);
    const n = 1 + Math.round(s.ripple * 3);
    for (let k = 0; k < n; k++) { const x = 178 + Math.floor((t * (9 + s.ripple * 14) + k * 3.7 + Math.sin(t * 23) * s.ripple * 2) % 10); g.fillRect(ox + x, 180 + TY, 1, 1); }
    if (s.tea < 0.5) { g.fillStyle = ls(0xe4ded4, 183, 180 + TY); g.fillRect(ox + 178, 180 + TY, 10, 1); g.fillStyle = ls(0x8a4a1a, 183, 180 + TY); g.fillRect(ox + 180, 180 + TY, 6, 1); }
  } else { g.fillStyle = ls(0xe4ded4, 183, 180 + TY); g.fillRect(ox + 178, 180 + TY, 10, 1); g.fillStyle = ls(0x8a5a3a, 183, 180 + TY); g.fillRect(ox + 182, 180 + TY, 2, 1); }
  if (s.sip > 0) { g.fillStyle = ls(0xffffff, 183, 179 + TY); g.fillRect(ox + 177, 179 + TY - Math.round(Math.sin(s.sip * Math.PI) * 2), 12, 1); }
  for (const w of s.steam) {
    const k = Math.min(8, Math.round((1 - w.a / w.life) * 6 * Math.min(1, w.a * 2)) + (s.steamBoost > 0 ? 2 : 0));
    if (k <= 0) continue;
    g.fillStyle = F.steam[Math.min(8, k)]; g.fillRect(ox + Math.round(w.x), Math.round(w.y), 1, 2);
    if (w.a > 0.8) g.fillRect(ox + Math.round(w.x + Math.sin(w.p + t) * 1.5), Math.round(w.y) - 2, 1, 1);
  }
  // a page turning
  if (s.page > 0) {
    const u = 1 - s.page, x = Math.round(136 + Math.cos(u * Math.PI) * 13), top = Math.round(184 + TY - Math.sin(u * Math.PI) * 7);
    g.fillStyle = ls(0xf4ead2, 136, 188 + TY); for (let y = top; y < 193 + TY; y++) g.fillRect(ox + Math.min(x, 136), y, Math.max(1, Math.abs(x - 136) * 0.3 | 0) || 1, 1);
    g.fillRect(ox + x, top, 1, 193 + TY - top);
  }
  // the phone: a message, a small light blinking
  const ph = s.phone;
  if (ph.on > 0) {
    const a = Math.min(1, ph.on * 2, (4 - ph.on) * 4);
    g.globalAlpha = a; g.fillStyle = '#a8ccff'; g.fillRect(ox + 225, 186 + TY, 7, 8); g.fillStyle = '#e8f2ff'; g.fillRect(ox + 225, 186 + TY, 7, 1);
    g.fillStyle = '#4a6aa8'; for (const y of [188, 190, 192]) g.fillRect(ox + 226, y + TY, y === 192 ? 3 : 5, 1);
    g.globalAlpha = 1;
  } else if ((t % 2.6) < 0.18) { g.fillStyle = '#6af0a0'; g.fillRect(ox + 231, 185 + TY, 1, 1); }
  // the ticket, held up to the light
  if (s.ticket > 0) {
    const a = Math.min(1, s.ticket * 3, (4.5 - s.ticket) * 4), x = ox + 116, y = 134;
    g.globalAlpha = a;
    g.fillStyle = '#3a2a1a'; g.fillRect(x + 1, y + 1, 76, 36);
    g.fillStyle = ls(0xf0e2b8, 120, 160); g.fillRect(x, y, 76, 36);
    g.fillStyle = ls(0xb83a3a, 120, 160); g.fillRect(x, y, 4, 36); g.fillRect(x + 4, y + 30, 72, 2);
    textF(g, 'SINGLE', x + 8, y + 3, ls(0x6a5a48, 120, 150));
    textF(g, 'PORT ELLERY', x + 8, y + 11, ls(0x1e2a5a, 120, 150));
    textF(g, 'COACH C  SEAT 14', x + 8, y + 19, ls(0x6a5a48, 120, 150));
    g.fillStyle = ls(0x2a2a30, 120, 150); g.fillRect(x + 66, y + 3, 3, 3);
    g.globalAlpha = 1;
  }
  // light: the lamp and its pool, the ceiling lamps, the phone, the window's colour
  g.globalCompositeOperation = 'lighter';
  if (l > 0.01) {
    g.globalAlpha = l; g.drawImage(spriteImg(RM, RM.lampLit, 1), ox + 42, 100);
    g.globalAlpha = l * (0.5 + 0.03 * Math.sin(t * 2.3)); g.drawImage(F.pool, ox + 106 - 56, 198 - 16);
    g.globalAlpha = l * 0.45; g.drawImage(F.wall, ox + 56 - 30, 128 - 26);
    g.globalAlpha = l * 0.9; g.drawImage(F.cone, ox + 56 - 36, 117); g.drawImage(F.shade, ox + 56 - 14, 110 - 10);
  }
  g.globalAlpha = 0.32 + 0.05 * Math.sin(t * 0.4); g.drawImage(F.heat, ox + 160 - 120, 280 - 12);
  if (P.bay2) g.drawImage(F.heat, ox + BAY2 + 160 - 120, 280 - 12);
  for (const x of P.ceil) {
    if (x < 0) { g.globalAlpha = 0.6; g.drawImage(F.night, ox + x - 16, DOOR.y + 4); continue; }
    g.globalAlpha = 0.34 + 0.03 * Math.sin(t * 0.8 + x); g.drawImage(F.ceil, ox + x - 46, 1);
  }
  if (ph.on > 0) { g.globalAlpha = Math.min(1, ph.on * 2, (4 - ph.on) * 4) * 0.8; g.drawImage(F.phone, ox + 228 - 10, 190 + TY - 8); }
  if (s.cat.f === 2 || s.cat.f === 4) { g.globalAlpha = 0.5; g.drawImage(F.eye, ox + CAR.dx + 4, CAR.dy + 8 - (s.cat.f === 4 ? 1 : 0)); g.drawImage(F.eye, ox + CAR.dx + 9, CAR.dy + 8 - (s.cat.f === 4 ? 1 : 0)); }
  const w = todW(s), open = (1 - s.inTun) * (1 - sm(s.blind) * 0.45);
  for (const gl of P.glass) {
    const cx = ox + gl.x + GW / 2;
    if (w.dawn > 0.01) { g.globalAlpha = w.dawn * 0.3 * open; g.drawImage(F.dawn, cx - 150, GY + 40 - 70); }
    if (w.dusk > 0.01) { g.globalAlpha = w.dusk * 0.26 * open; g.drawImage(F.dusk, cx - 150, GY + 40 - 70); }
    if (s.flash > 0.01) { g.globalAlpha = s.flash * 0.22 * open; g.drawImage(F.flash, cx - 120, GY + 30); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function render(g, RM, s, frame) {
  const bw = RM.rw, P = RM.P, w = todW(s);
  g.globalAlpha = 1; g.fillStyle = '#1a0f0c'; g.fillRect(0, 0, bw, H);
  g.fillStyle = hex(TODP[TODS[s.todI]].ballast[0]); g.fillRect(0, GY, bw, GH + 3);
  drawLand(g, landFor(TODS[s.todI]), s, bw, 1, RM);
  if (s.todK < 1) drawLand(g, landFor(TODS[s.todFrom]), s, bw, 1 - sm(s.todK), RM);
  drawTunnel(g, s, bw);
  drawRain(g, s, bw, TODP[TODS[s.todI]]);
  // the carriage rocks a little: a jolt at the joints, a slow sway
  const dy = Math.sin(s.t * 1.7) * 0.45 + Math.sin(s.t * 0.61) * 0.35 + s.bump * 0.6 > 0.72 ? 1 : 0;
  g.save(); g.translate(0, dy);
  P.glass.forEach((gl, i) => drawGlass(g, RM, s, i, gl, w.night, frame));
  drawRoom(g, RM, s);
  g.restore();
}

function makeBuffer(bw) { const buf = mk(bw, H); return { buf, g: buf.getContext('2d') }; }

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const RM = roomFor(320), s = makeState(9);
    s.dist = 1460; s.jn = null;
    for (let i = 0; i < 90; i++) update(s, 1 / 30, RM, { say() {}, knock() {}, thunder() {}, amb: { set() {} } });
    s.t = 12.3; s.cat.f = 2; s.phone.on = 2; s.coat = 0.3; s.station = null; s.tunnel = null; s.inTun = 0; s.flash = 0;
    const B = makeBuffer(320);
    render(B.g, RM, s, 0);
    PREV = B.buf;
  }
  const m = ctx.getTransform?.(), sc = Math.max(1, Math.abs(m?.a || 1)), k = Math.max(1, Math.ceil((640 * sc) / H));
  let up = PREVUP.get(k);
  if (!up) { up = mk(320 * k, H * k); const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(PREV, 0, 0, 320 * k, H * k); PREVUP.set(k, up); }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(up, 0, 0, 640, 640); ctx.restore();
}

/* ——— the lounge ——— */
export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const s = makeState(Date.now() % 100000);
  let B = null, RM = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false, frame = 0, landJob = null, landTod = null;
  const preW = roomW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: 320, sx: 0, dx: 0 };

  const status = () => setScore(s.inTun > 0.5 ? 'In a tunnel under the hills' : `${TODTXT[TODS[s.todI]]} · next stop ${TITLE(nextStation(s))}${s.lampOn ? '' : ' · lamp off'}`);
  setScore('Click the window, the sky, the lamp, the tea, the cat, the watch…');
  let hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0;
  const say = (text) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(status, 3800); };

  const amb = playAmbience({ rain: 0.6 }, isPaused);
  // the music is in your headphones: take them off and it fades away
  const stopMusic = playLoungeMusic('train', () => isPaused() || !s.music);
  const later = (sec, fn) => s.later.push({ at: s.t + sec, fn });
  const io = {
    say, amb,
    // the wheels on a joint: a low, muffled knock (a touch of echo in a tunnel)
    knock(a, tun) {
      tone(38, { dur: 0.12, vol: 0.034 * a * (tun ? 1.3 : 1), type: 'triangle' });
      tone(31, { dur: 0.16, vol: 0.026 * a, type: 'sine' });
      if (tun) later(0.09, () => tone(38, { dur: 0.1, vol: 0.011 * a, type: 'triangle' }));
    },
    thunder() { rumble(0.13, 3.8); },
  };
  const horn = () => {
    for (const [d, v] of [[0, 1], [0.85, 0.8]]) later(d, () => { tone(56, { dur: 0.9, vol: 0.026 * v, type: 'triangle' }); tone(60, { dur: 0.9, vol: 0.02 * v, type: 'triangle' }); tone(63, { dur: 0.85, vol: 0.012 * v, type: 'sine' }); });
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!RM) return;
    const p = pointIn(canvas, e), W = canvas._snW || 640;
    const x = (p.x * view.bw) / W + view.sx - view.dx - RM.ox, y = p.y / 2;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const P = RM.P;
    const gi = P.glass.findIndex((g) => inR(g.x, g.y, g.x + g.w, g.y + g.h));
    const blindH = sm(s.blind) * BLINDH;
    if (inR(42, 94, 70, 120) || inR(34, 94, 44, 112)) {
      s.lampOn = !s.lampOn; drip(0.03, 2400, 1600); note(s.lampOn ? 7 : 4, { dur: 0.5, vol: 0.035 });
      say(`Reading lamp ${s.lampOn ? 'on' : 'off'}`);
    } else if (inR(171, 170 + TY, 197, 196 + TY)) {
      if (s.tea > 0.02) {
        s.sip = 1; s.tea = Math.max(0, s.tea - 0.25); drip(0.045, 520, 260); tone(64, { dur: 0.3, vol: 0.014, delay: 0.25 });
        if (s.tea <= 0.02) { s.tea = 0; s.refill = 6; say('The last of the tea'); } else say('A sip of tea, still warm');
      } else say('The trolley is on its way');
    } else if (inR(96, 183 + TY, 118, 195 + TY)) {
      s.ticket = 4.5; swish(0.03); note(9, { dur: 0.6, vol: 0.03 });
      say('Your ticket: single to Port Ellery · coach C, seat 14');
    } else if (inR(119, 181 + TY, 152, 196 + TY)) {
      s.page = 1; s.pageN = (s.pageN + 1) % PAGES.length; swish(0.04); say(PAGES[s.pageN]);
    } else if (inR(152, 185 + TY, 173, 196 + TY)) {
      s.todFrom = s.todI; s.todI = (s.todI + 1) % TODS.length; s.todK = 0; landFor(TODS[s.todI]);
      [9, 7, 5].forEach((n, i) => note(n + (s.todI === 2 ? 2 : 0), { dur: 1, vol: 0.026, delay: i * 0.22 }));
      say(['The evening comes on', 'Deep in the night', 'Dawn, grey and rosy'][s.todI]);
    } else if (inR(197, 181 + TY, 223, 197 + TY)) {
      s.music = !s.music; drip(0.02, 1200, 900); say(s.music ? 'Headphones on: the music again' : 'Headphones off: just the rain and the rails');
    } else if (inR(223, 183 + TY, 234, 196 + TY)) {
      s.phone.on = 3.8; s.phone.msg = (s.phone.msg + 1) % MESSAGES.length; drip(0.03, 1700, 2500); tone(88, { dur: 0.35, vol: 0.016, delay: 0.12 });
      say(MESSAGES[s.phone.msg]);
    } else if (inR(GX - 6, GY - 9, GX + GW + 6, GY) || (blindH > 3 && inR(GX, GY, GX + GW, GY + blindH + 2))) {
      s.blindTo = s.blindTo ? 0 : 1; swish(0.05); tone(50, { dur: 0.15, vol: 0.015, type: 'triangle', delay: 0.3 });
      say(s.blindTo ? 'The blind pulled half down' : 'The blind let up');
    } else if (inR(CAR.x - 2, CAR.y - 11, CAR.x + CAR.w + 2, CAR.y + CAR.h)) {
      s.cat.stir = 4.2; s.cat.blink = 1.2; drip(0.025, 900, 620); later(0.35, () => drip(0.02, 820, 560));
      for (let k = 0; k < 6; k++) later(0.9 + k * 0.22, () => tone(40 + (k % 2), { dur: 0.2, vol: 0.022, type: 'triangle' }));
      say('Mim stirs, blinks at you, and settles');
    } else if (inR(262, 62, 300, 154)) {
      s.coatV += 2.6; swish(0.03); say('The coat sways on its hook');
    } else if (inR(5, 27, 19, 110)) {
      for (let k = 0; k < 4; k++) s.umb.push({ y: 104 - k * 3, v: k * 20 }); [0, 0.15, 0.32].forEach((d) => later(d, () => drip(0.025, 1500, 900)));
      say('The umbrella drips onto the seat');
    } else if (P.bay2 && inR(PAS.x, PAS.y, PAS.x + PAS.w, PAS.y + PAS.h - 4)) {
      s.pas.stir = 2.6; tone(45, { dur: 0.4, vol: 0.02, type: 'triangle' }); say('Your neighbour stirs, then dozes again');
    } else if (P.door && inR(DOOR.x, DOOR.y, DOOR.x + DOOR.w, 296)) {
      s.doorTo = s.doorTo ? 0 : 1; swish(0.06); later(0.7, () => tone(36, { dur: 0.2, vol: 0.03, type: 'triangle' }));
      say(s.doorTo ? 'The corridor door slides open' : 'The corridor door slides shut');
    } else if (P.door && inR(-29, 62, -5, 102)) {
      note(5, { dur: 0.4, vol: 0.025 }); say(`Next ${TITLE(nextStation(s))}, then the coast by morning`);
    } else if (inR(-216, 66, -184, 110)) {
      note(7, { dur: 0.4, vol: 0.025 }); say('The route: over the hills, along the river, down to the sea');
    } else if (gi >= 0) {
      const g = P.glass[gi], lx = x - g.x, ly = y - g.y;
      if (ly < 30 && s.inTun < 0.5) { horn(); say('Far ahead, the engine sounds its horn'); }
      else {
        const G = glassState(s, gi);
        G.wipes.push({ x: lx, y: ly, a: 1, arc: Math.random() < 0.5 ? -1 : 1 }); G.dirty = true;
        tone(86, { dur: 0.1, vol: 0.01 }); tone(90, { dur: 0.09, vol: 0.008, delay: 0.09 }); swish(0.025);
        say(s.inTun > 0.5 ? 'A clear streak: only the dark, and the carriage looking back' : s.station ? `A clear streak: ${TITLE(s.station.name)} going by` : 'A clear streak in the mist');
      }
    }
  };
  canvas.addEventListener('pointerdown', onDown);

  // a new frame shape: rebuild the carriage only once the width has held for a moment, a little each
  // frame, showing the old one until the new one is ready; once settled, the full-screen shape is
  // built ahead in small slices, so going full screen is instant
  const settleRoom = (bw) => {
    const want = roomW(bw), now = performance.now();
    if (!RM) RM = roomFor(want);
    if (RM.rw !== want) {
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
      if (done) { job = null; jobW = 0; if (done.rw === want) RM = done; }
    } else if (s.t > 3) {
      // the other times of day, painted a slice at a time in quiet frames
      if (!landJob) { landTod = TODS.find((k) => !LANDS[k]); if (landTod) landJob = buildLand(landTod); }
      if (landJob) { const done = pump(landJob, 3); if (done) { LANDS[landTod] = done; landJob = null; } }
    }
    if (!B || B.buf.width !== RM.rw) B = makeBuffer(RM.rw);
  };

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, bw = Math.max(320, Math.round((320 * W) / 640));
    settleRoom(bw);
    update(s, dt, RM, io);
    render(B.g, RM, s, frame++);
    // whole-number steps without smoothing; any last fraction with a good filter
    view.bw = bw; view.sx = Math.max(0, (RM.rw - bw) >> 1); view.dx = Math.max(0, (bw - RM.rw) >> 1);
    const sw = Math.min(bw, RM.rw), k = Math.max(1, Math.ceil(canvas.height / H));
    if (canvas.height === H * k && canvas.width === bw * k && !view.dx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(B.buf, view.sx, 0, sw, H, 0, 0, W, 640);
    } else {
      if (!up || up.width !== bw * k || up.height !== H * k) { up = mk(bw * k, H * k); upg = up.getContext('2d'); }
      upg.imageSmoothingEnabled = false;
      if (view.dx) { upg.fillStyle = '#1a0f0c'; upg.fillRect(0, 0, up.width, up.height); }
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
    s.knocks.length = 0; s.later.length = 0;
    canvas.removeEventListener('pointerdown', onDown);
  };
}
