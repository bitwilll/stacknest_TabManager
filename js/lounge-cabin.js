// Mountain Cabin — a lounge, not a game: a log cabin high in the snowy mountains at night, seen from
// the rocking chair by the fire. Pixel art, drawn into a small buffer (320 px tall, as wide as the
// frame's shape) and scaled up by whole steps with no smoothing, so every pixel stays square.
// Outside the big many-paned window: snow falling at several depths, blown sideways in gusts that
// curl it into swirls; a moonlit peak, deep blue pine slopes, the warm lights of a village far down
// the valley, and, when the sky clears, stars and a slow aurora. Now and then a fox trots by on the
// snow, a deer picks its way across, or an owl lands on the pine by the window.
// Inside: a stone fireplace with a living fire (flames, embers, sparks, logs that settle and
// shift) whose light flickers over the room; a kettle on its hook, mittens drying on a line under
// the mantel, antlers above it; log walls, a shelf of jars and a hurricane lantern, a framed trail
// map, skis and snowshoes in the corner; a rocking chair with a knitted blanket, a low table with
// cocoa, a book and a candle in a jar, a braided rug, a log basket, and a dog asleep by the hearth.
// In full screen the cabin goes on: a bunk under a second window and a reading corner to the left;
// a woodpile, the door with its frosted pane, a coat rack hung with scarves, a sled and a washstand
// to the right.
// Light: every still surface is painted once in its plain colours, then each pixel takes its colour
// from a short ramp made for that colour (indigo night shadow up to moonlit blue on the cool side,
// dusky rose up to ember orange and honey on the warm), stepped by how much light reaches it, with a
// narrow band of ordered dither only where two steps meet. The cabin is baked once per frame shape
// for a low and a high fire (and the lantern on and off); each frame cross-fades the two fires by
// the flicker, so the firelight really moves over the logs. Only the moving things are drawn live.

import { setupCanvas, runLoop, pointIn, tone, note, drip, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'cabin', title: 'Mountain Cabin', blurb: 'A log cabin in the snowy mountains at night: a crackling fire, cocoa, a sleeping dog.', keys: 'Click the fire, the window, the cocoa…', lounge: true };

const H = 320;                                  // buffer height; the core composition is 320 wide
const STEP = 16;                                // cabin widths round up to this
const GX = 104, GY = 36, GW = 114, GH = 112;    // the big window's glass, in core pixels
const COLS = [[0, 37], [39, 37], [78, 36]];     // its panes: columns and rows (x/y offset, size)
const ROWS = [[0, 32], [34, 38], [74, 38]];
const FLOOR = 238;                              // where the log wall meets the floor
const FB = { x: 22, y: 158, w: 56, h: 64 };     // the firebox opening
const FG = { x: 26, y: 166, w: 48, h: 50 };     // the flames' grid
const FLX = 50, FLY = 200;                      // where the firelight comes from
const MANTEL = 124;
const TBL = { x: 212, y: 244, w: 84 };          // the low table's top
const MUG = { x: 272, y: 233 };                 // the cocoa mug (top-left of its body)
const JAR = { x: 254, y: 237 };                 // the candle in its jar
const BOOK = { x: 218, y: 243 };
const DOG = { x: 26, y: 248, w: 66, h: 38 };
const CHAIR = { x: 94, y: 148, w: 140, h: 172, cx: 160, cy: 189, r: 115 };   // its sprite box; the runners' arc (centre, radius)
const LANT = { x: 236, y: 60 };                 // the hurricane lantern on the shelf
const KET = { x: 58, y: 170 };                  // the kettle on its hook (top-left)
const W2 = { x: -98, y: 56, w: 56, h: 76 };     // full screen: the window over the bunk
const DOOR = { x: 362, y: 108, w: 52 };         // full screen: the door's frame (outer)
const PANE = { x: 374, y: 122, w: 28, h: 38 };  // its frosted pane
const RACK = { x: 422, y: 96, w: 22, h: 142 };  // the coat rack
const SHELFX = -206;                            // the reading corner's bookshelf (very wide screens)
const SCONCE = { x: 338, y: 124 };              // full screen: a tin oil lamp on the wall by the door
const WXS = ['clear', 'snow', 'storm'];
const WXTXT = { clear: 'A clear night, the stars out', snow: 'Snow falling softly', storm: 'Heavy snow on the wind' };

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
// a stepped level: flat inside each step, a narrow band of ordered dither where two steps meet
const band = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.4 ? i : f > 0.6 ? i + 1 : bay(x, y) < (f - 0.4) / 0.2 ? i + 1 : i; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.round(a * 1000) / 1000})`;
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);
const sm = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
// a smooth value noise in one dimension, for the flicker and the wind
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = (x) => { const i = Math.floor(x), f = x - i; return hash1(i) + (hash1(i + 1) - hash1(i)) * f * f * (3 - 2 * f); };

const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', W: '101101111111101',
  Y: '101101010010010', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001',
  7: '111001010010010', 8: '111101111101111', 0: '111101101101111', '.': '000000000000010', '-': '000000111000000',
};

/* ——— a little raster to paint the still layers in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  bay(x, y) { return bay(Math.floor(x + this.ox), Math.floor(y + this.oy)); }
  has(x, y) { const i = this.at(x, y); return i >= 0 && this.d[i + 3] > 0; }
  get(x, y) { const i = this.at(x, y); return i < 0 || !this.d[i + 3] ? -1 : (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]; }
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
  clear(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = this.at(xx, yy); if (i >= 0) this.d.fill(0, i, i + 4); } }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  dith(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.bay(xx, yy) < lvl) this.px(xx, yy, c); }
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
   For each painted colour, twenty-one lit versions: seven on the cool side (deep indigo shadow up to
   moonlit blue-grey), seven on the warm side (dusky rose through ember orange up to honey) and seven
   between. A pixel's step comes from the total light on it, its side from how much of it is warm. */
const CT = [   // intensity, × r g b, + r g b
  [0.17, 0.6, 0.68, 1.32, 6, 6, 22], [0.25, 0.64, 0.74, 1.28, 6, 6, 20], [0.34, 0.69, 0.81, 1.23, 5, 6, 16],
  [0.45, 0.74, 0.87, 1.18, 4, 5, 12], [0.57, 0.8, 0.93, 1.14, 3, 4, 8], [0.71, 0.86, 0.98, 1.1, 2, 3, 4], [0.86, 0.92, 1.01, 1.06, 0, 2, 2],
];
const WT = [
  [0.23, 0.96, 0.7, 0.94, 12, 4, 14], [0.33, 1.06, 0.75, 0.82, 12, 4, 8], [0.45, 1.15, 0.8, 0.68, 10, 4, 2],
  [0.59, 1.21, 0.84, 0.6, 10, 4, 0], [0.74, 1.25, 0.88, 0.57, 12, 6, 0], [0.9, 1.27, 0.93, 0.6, 14, 8, 0], [1.06, 1.28, 0.98, 0.68, 18, 10, 4],
];
// between the two, a dusky middle ramp, so cool light shades into warm without a hard edge
const MT = CT.map((c, k) => c.map((v, i) => (v + WT[k][i]) / 2));
const RAMPS = new Map();
function rampOf(c) {
  let rp = RAMPS.get(c);
  if (rp) return rp;
  rp = new Int32Array(21);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  [CT, MT, WT].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(c, rp);
  return rp;
}

/* ——— the cabin's plan, for one width ———
   The core is the fireplace, the big window and the corner by the skis. In full screen the cabin
   goes on: to the left a bunk under a second window (and, on very wide screens, a reading corner);
   to the right the woodpile, the door with its frosted pane, the coat rack, a sled and a washstand. */
function plan(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox;
  const P = { rw, ox, L, RT, wide: ox > 0, left: L < W2.x + W2.w - 6, corner: L < SHELFX + 34, right: RT > DOOR.x + 8, far: RT > 452 };
  P.glass = [{ x: GX, y: GY, w: GW, h: GH, core: true }];
  if (P.left) P.glass.push({ x: W2.x, y: W2.y, w: W2.w, h: W2.h, core: false });
  if (P.right) P.glass.push({ x: PANE.x, y: PANE.y, w: PANE.w, h: PANE.h, core: false, door: true });
  return P;
}
const onMuntin = (lx, ly) => (lx >= 37 && lx < 39) || (lx >= 76 && lx < 78) || (ly >= 32 && ly < 34) || (ly >= 72 && ly < 74);
// the moonlight through the panes, laid on the floor in front of the window (0 or 1)
function moonPatch(cx, cy) {
  if (cy < 256 || cy > 318) return 0;
  const u = (cy - 256) / 62, x0 = GX - 30 - u * 40, w = GW * (1 + u * 0.4), s = (cx - x0) / w;
  if (s < 0 || s >= 1) return 0;
  return onMuntin(s * GW, (1 - u) * GH) ? 0 : 1;
}
const underTable = (cx, cy) => cy > 257 && cy < 279 && cx > TBL.x + 3 && cx < TBL.x + TBL.w - 3;

// the light reaching a point of the cabin (core coordinates), in four parts
function coolAt(cx, cy, P) {   // the moon and the snow, through the glass
  let best = 0;
  for (const g of P.glass) {
    const dx = cx < g.x ? g.x - cx : cx > g.x + g.w ? cx - g.x - g.w : 0;
    const dy = cy < g.y ? g.y - cy : cy > g.y + g.h ? cy - g.y - g.h : 0;
    const reach = g.core ? 100 : g.door ? 46 : 70, amt = g.core ? 0.46 : g.door ? 0.22 : 0.34;
    best = Math.max(best, Math.max(0, 1 - sq(dx, dy * 0.8) / reach) ** 2 * amt);
  }
  let v = 0.2 + best + moonPatch(cx, cy) * (underTable(cx, cy) ? 0.05 : 0.24);
  const vx = (cx - 160) / (P.rw / 2 + 80), vy = (cy - 150) / 240;
  return v * (1 - Math.min(0.34, (vx * vx + vy * vy) * 0.6));
}
function fireAt(cx, cy) {        // the fire, at full strength
  const inBox = cx >= FB.x && cx < FB.x + FB.w && cy >= FB.y && cy < FB.y + FB.h;
  if (inBox) return 0.62 + cl((cy - FB.y) / FB.h) * 0.3;
  let v = Math.max(0, 1 - sq(cx - FLX, (cy - FLY) * 1.05) / 300) ** 1.45 * 1.25;
  if (cx >= -2 && cx <= 102 && cy < FB.y + FB.h + 1) v *= cy < MANTEL ? 0.4 : cy < MANTEL + 9 ? 0.5 : 0.38 + cl((cy - 140) / 80) * 0.3;   // the chimney's face: only the glow from below
  else if (cy < FLOOR && cx < -2) v *= 0.42;                                                                                                // the walls the chimney shades
  else if (cy < FLOOR - 6 && cx > 102) v *= 0.7;
  if (underTable(cx, cy)) v *= 0.45;
  return v;
}
function lantAt(cx, cy) {        // the hurricane lantern on the shelf
  let v = Math.max(0, 1 - sq(cx - (LANT.x + 7), (cy - (LANT.y + 15)) * 1.1) / 104) ** 1.8 * 0.85;
  if (cy > 89 && cy < 104 && cx > 230 && cx < 318) v *= 0.45;   // under the shelf
  return v;
}
function steadyAt(cx, cy, P) {   // always on: the candle in its jar, the reading lamp in the corner
  let v = 0.03 + Math.max(0, 1 - sq(cx - (JAR.x + 4), (cy - (JAR.y + 6)) * 1.3) / 64) ** 2 * (cy < FLOOR - 2 ? 0.3 : 0.5);
  if (P.corner) v += Math.max(0, 1 - sq(cx - (SHELFX + 64), (cy - 74) * 1.05) / 116) ** 1.7 * 0.62;
  if (P.right) v += Math.max(0, 1 - sq(cx - (SCONCE.x + 3), (cy - (SCONCE.y + 8)) * 1.05) / 112) ** 1.6 * 0.55;
  if (P.far) v += Math.max(0, 1 - sq(cx - 481, (cy - 134) * 1.1) / 76) ** 1.7 * 0.45;
  return v;
}

const FLO = 0.5, FHI = 1;        // the two fires the cabin is baked for
// one lit version of a painted raster: k = fire (0 low, 1 high) × 2 + lantern (0 off, 1 on).
// Alpha 254 glows by itself.
function bakeOne(src, x0, y0, F, k) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length), rw = F.rw, fl = k >> 1 ? FHI : FLO, la = k & 1;
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.22, warm = 0.05;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) { const j = Y * rw + X; cool = F.C[j]; warm = F.K[j] + la * F.L[j] + fl * F.W[j]; }
      const tot = cool + warm, lv = Math.min(6, band(Math.min(6, Math.max(0, (tot - 0.12) / 0.17)), X, Y));
      const wf = warm / tot, b2 = bay(X + 2, Y + 1), side = wf < 0.29 ? 0 : wf < 0.335 ? (b2 < (wf - 0.29) / 0.045 ? 7 : 0) : wf < 0.415 ? 7 : wf < 0.46 ? (b2 < (wf - 0.415) / 0.045 ? 14 : 7) : 14;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c); }
      const o = rp[side + lv];
      out[i] = o >> 16; out[i + 1] = (o >> 8) & 255; out[i + 2] = o & 255; out[i + 3] = al >= 253 ? 255 : al;
    }
  }
  return toCanvas(out, w, h);
}
// the lit colour of one painted colour at one point, for the few things drawn over the bake
function litHex(RM, cx, cy, c, fire, la) {
  const F = RM.F, X = Math.max(0, Math.min(RM.rw - 1, Math.round(cx) + RM.ox)), Y = Math.max(0, Math.min(H - 1, Math.round(cy))), j = Y * RM.rw + X;
  const cool = F.C[j], warm = F.K[j] + la * F.L[j] + (FLO + (FHI - FLO) * fire) * F.W[j], tot = cool + warm;
  const wf = warm / tot;
  return hex(rampOf(c)[(wf > 0.44 ? 14 : wf > 0.32 ? 7 : 0) + Math.min(6, Math.round(Math.max(0, (tot - 0.12) / 0.17)))]);
}

/* ——— painting the cabin, in its plain colours ——— */
const LOG = { hi: 0xc08a54, base: 0xa0703e, mid: 0x8a5e32, lo: 0x6a4424, dk: 0x46280f, chink: 0xcabca0, chinkLo: 0x9c8e74, knot: 0x5a3818 };
const IRON = { hi: 0x5a5a64, base: 0x2e2e36, lo: 0x18181e };
const BRASS = { hi: 0xf0d080, base: 0xc89a48, lo: 0x8a6430 };
const STONES = [0x8a8478, 0x7a746a, 0x9a9488, 0x6e6a64, 0x8c7c6c, 0x747c84, 0x847868, 0x96908a];
const PLANK = [0x8e5c32, 0x7e5028, 0x9a683a, 0x86562e];

// the ceiling's boards and its great beam, the log wall, the sill log and the floorboards
function paintShell(R, P) {
  const { L, RT } = P, W = RT - L, r = rng(31);
  for (let y = 0; y < 4; y++) for (let x = L; x < RT; x++) R.px(x, y, (((x % 19) + 19) % 19) === 0 ? 0x2a1608 : y === 3 ? 0x3a2210 : 0x4a2c16);
  for (let y = 4; y < 16; y++) for (let x = L; x < RT; x++) {
    const g = Math.sin(x * 0.045 + y * 0.9 + Math.sin(x * 0.011) * 3);
    let c = y === 4 ? LOG.dk : y === 15 ? LOG.dk : y === 14 ? LOG.lo : y === 5 ? LOG.mid : g > 0.9 ? LOG.lo : LOG.mid;
    if (y >= 11 && y <= 13 && c === LOG.mid) c = bay(x, y) < (y - 10) * 0.3 ? LOG.base : LOG.mid;   // the underside, catching the fire
    R.px(x, y, c);
  }
  for (let bx = Math.floor((L - 40) / 150) * 150 + 40; bx < RT; bx += 150) { R.rect(bx, 8, 1, 4, LOG.dk); R.px(bx + 1, 9, LOG.lo); }   // old pegs
  // the logs, each one round: lit along its top, falling into shadow underneath, chinked between
  const T = 16, LH = 14;
  for (let k = 0; T + k * LH < FLOOR; k++) {
    const y0 = T + k * LH, ph = r() * 50, jo = Math.floor(r() * 170) + 60;
    const knots = Array.from({ length: Math.ceil(W / 60) }, () => [L + r() * W, y0 + 3 + r() * 6, 1 + r() * 1.5]);
    for (let y = y0; y < Math.min(FLOOR, y0 + LH); y++) {
      const rr = y - y0;
      for (let x = L; x < RT; x++) {
        const ragged = ((x * 7 + k * 13) % 23 === 0) || Math.sin(x * 0.21 + k) > 0.97;
        let c;
        if (rr >= 12 || (rr === 11 && ragged)) c = rr === 13 ? (bay(x, y) < 0.5 ? LOG.chinkLo : LOG.chink) : LOG.chink;
        else {
          c = rr === 0 ? LOG.hi : rr < 3 ? (bay(x, y) < 0.55 - rr * 0.15 ? LOG.hi : LOG.base) : rr < 8 ? LOG.base : rr < 10 ? LOG.mid : rr === 10 ? LOG.lo : LOG.dk;
          const g = Math.sin(x * 0.06 + ph + rr * 0.7 + Math.sin(x * 0.017 + ph) * 2.4);
          if (rr > 1 && rr < 10 && g > 0.93) c = rr < 6 ? LOG.mid : LOG.lo;
          if (rr > 2 && rr < 9 && ((x + ph * 7) % 97 + 97) % 97 < 9 && rr === 5 + (((x >> 3) + k) & 1)) c = LOG.lo;   // a long check in the wood
        }
        R.px(x, y, c);
      }
    }
    for (const [kx, ky, kr] of knots) { R.ell(kx, ky, kr + 0.6, kr * 0.7, LOG.lo); R.px(kx, ky, LOG.knot); R.px(kx + 1, ky, LOG.knot); }
    // a butt joint where one log ends and the next begins
    for (let jx = L + ((jo + k * 77) % 210); jx < RT; jx += 210 + ((k * 31) % 60)) { R.rect(jx, y0 + 1, 1, 10, LOG.dk); R.rect(jx + 1, y0 + 1, 1, 10, LOG.hi); R.px(jx - 1, y0 + 5, LOG.lo); }
  }
  // the sill log along the floor, the floorboards running out towards you
  R.rect(L, FLOOR - 3, W, 1, LOG.hi); R.rect(L, FLOOR - 2, W, 3, LOG.mid); R.rect(L, FLOOR + 1, W, 1, LOG.dk);
  for (let y = FLOOR + 2; y < H; y++) {
    const dz = y - 70;
    for (let x = L; x < RT; x++) {
      const u = ((x - 160) / dz) * 7.2, pi = Math.floor(u), f = u - pi, idx = ((pi % 4) + 4) % 4;
      let c = PLANK[idx];
      const g = Math.sin(u * 9 + y * 0.07 * (idx + 1) + Math.sin(y * 0.05 + pi) * 2);
      if (g > 0.86) c = mixc(c, 0x3a2010, 0.3); else if (g < -0.93) c = mixc(c, 0xc89060, 0.18);
      if (f < 0.06 * (220 / dz) || f > 1 - 0.02 * (220 / dz)) c = 0x3a2210;
      if (((y * 3 + pi * 37) % 61) === 0 && f > 0.1 && f < 0.9) c = 0x4a2a14;   // a board's end
      if (((x + y * 5 + pi * 11) % 53) === 0) c = 0x5a3a20;                    // a nail
      R.px(x, y, c);
    }
  }
  R.shade(L, FLOOR + 2, W, 2, 0.7);
}

// rounded fieldstones in a bed of mortar: shaded light at the top left, dark at the bottom right
function stones(R, x0, y0, w, h, seed, skip) {
  const r = rng(seed);
  R.rect(x0, y0, w, h, 0x4a443e);
  for (let y = y0; y < y0 + h;) {
    const sh = 8 + Math.floor(r() * 5);
    for (let x = x0 - Math.floor(r() * 8); x < x0 + w;) {
      const sw = 9 + Math.floor(r() * 10), c = STONES[Math.floor(r() * STONES.length)];
      const ax = Math.max(x0, x + 1), bx = Math.min(x0 + w, x + sw - 1), ay = y + 1, by = Math.min(y0 + h, y + sh - 1);
      for (let yy = ay; yy < by; yy++) for (let xx = ax; xx < bx; xx++) {
        if (skip && skip(xx, yy)) continue;
        const cx = Math.min(xx - ax, bx - 1 - xx), cy = Math.min(yy - ay, by - 1 - yy);
        if (cx + cy < 2 && cx < 2 && cy < 2) continue;   // rounded corners
        let col = c;
        if (yy === ay || (xx === ax && yy < by - 2)) col = mixc(c, 0xffffff, 0.16);
        else if (yy >= by - 2 || xx === bx - 1) col = mixc(c, 0x000000, yy === by - 1 ? 0.32 : 0.18);
        else if ((xx * 7 + yy * 13) % 17 === 0) col = mixc(c, 0x000000, 0.12);
        R.px(xx, yy, col);
      }
      x += sw;
    }
    y += sh;
  }
}

function paintFireplace(R) {
  const inOpen = (x, y) => {
    if (x < FB.x || x >= FB.x + FB.w || y < FB.y || y >= FB.y + FB.h) return false;
    const cx = x < FB.x + 9 ? FB.x + 9 - x : x >= FB.x + FB.w - 9 ? x - (FB.x + FB.w - 10) : 0, cy = y < FB.y + 9 ? FB.y + 9 - y : 0;
    return !(cx && cy && cx * cx + cy * cy > 81);
  };
  stones(R, 10, 0, 80, MANTEL, 7);
  R.shade(10, 0, 2, MANTEL, 0.7); R.shade(88, 0, 2, MANTEL, 0.75);
  stones(R, 0, MANTEL + 8, 100, 222 - MANTEL - 8, 19, inOpen);
  R.shade(0, MANTEL + 8, 100, 2, 0.6);
  // the lintel: one long dark stone over the opening
  for (let y = FB.y - 8; y < FB.y - 1; y++) for (let x = FB.x - 6; x < FB.x + FB.w + 6; x++) {
    if (inOpen(x, y)) continue;
    R.px(x, y, y === FB.y - 8 ? 0x8a8478 : y >= FB.y - 3 ? 0x4e4a46 : (x * 5 + y * 3) % 13 === 0 ? 0x5e5a54 : 0x6a6660);
  }
  // inside: firebrick, sooted towards the top, angled sides, an ash bed
  for (let y = FB.y; y < FB.y + FB.h; y++) for (let x = FB.x; x < FB.x + FB.w; x++) {
    if (!inOpen(x, y)) continue;
    const side = x < FB.x + 8 ? FB.x + 8 - x : x >= FB.x + FB.w - 8 ? x - (FB.x + FB.w - 9) : 0;
    const row = Math.floor((y - FB.y) / 4), bx = (x + (row & 1) * 4) % 8;
    let c = (y - FB.y) % 4 === 3 || bx === 0 ? 0x2a1410 : ((x >> 3) + row) % 3 === 0 ? 0x6a2a1e : 0x5c2418;
    if (side) c = (y + side) % 5 === 0 ? 0x2a1410 : mixc(0x4a1c12, 0x000000, side * 0.04);
    const soot = cl(1 - (y - FB.y) / 34);
    if (soot > 0 && bay(x, y) < soot * 1.1) c = mixc(c, 0x0c0806, 0.7);
    if (y >= 214) c = y === 214 ? 0x3a3430 : bay(x, y) < 0.3 ? 0x7a7068 : 0x5a524a;
    R.px(x, y, c);
  }
  // the grate and its andirons (the logs and fire are drawn live)
  R.rect(30, 212, 40, 1, IRON.hi); R.rect(30, 213, 40, 2, IRON.base);
  for (const ax of [31, 67]) { R.rect(ax, 202, 3, 20, IRON.base); R.rect(ax, 202, 1, 20, IRON.hi); R.ell(ax + 1, 200, 2, 2, IRON.base); R.px(ax, 199, IRON.hi); R.rect(ax - 2, 220, 7, 2, IRON.lo); }
  // the hearth: a raised slab of flat stones
  stones(R, -8, 225, 116, 12, 23);
  for (let x = -8; x < 108; x++) { R.px(x, 222, 0x9a948a); R.px(x, 223, (x % 23) === 0 ? 0x4a443e : 0x8a847a); R.px(x, 224, (x % 23) === 0 ? 0x4a443e : 0x7a746c); }
  R.shade(-8, 236, 116, 2, 0.55);
  // the mantel: a squared log, its end grain showing, on two stone corbels
  for (const cx of [4, 88]) { R.rect(cx, MANTEL + 8, 9, 6, 0x7a746a); R.rect(cx, MANTEL + 8, 9, 1, 0x9a948a); R.rect(cx + 1, MANTEL + 14, 7, 2, 0x6a645c); R.shade(cx, MANTEL + 15, 9, 1, 0.6); }
  for (let y = MANTEL; y < MANTEL + 9; y++) for (let x = -6; x < 106; x++) {
    const g = Math.sin(x * 0.08 + y * 1.3 + Math.sin(x * 0.02) * 2);
    R.px(x, y, y === MANTEL ? LOG.hi : y === MANTEL + 1 ? LOG.base : y === MANTEL + 8 ? LOG.dk : y === MANTEL + 7 ? LOG.lo : g > 0.88 ? LOG.lo : LOG.mid);
  }
  for (const ex of [-6, 104]) { R.rect(ex, MANTEL + 1, 2, 7, 0xb08050); R.px(ex + (ex < 0 ? 1 : 0), MANTEL + 4, LOG.lo); }
  R.shade(-6, MANTEL + 9, 112, 2, 0.6);
  // the antlers, on a shield of dark wood
  for (let y = 84; y < 101; y++) { const hw = y < 96 ? 6 : 6 - (y - 95); R.rect(50 - hw, y, hw * 2, 1, y === 84 ? 0x8a5a34 : 0x5a3418); R.px(50 - hw, y, 0x7a4a28); }
  const BONE = [0xeae0c8, 0xd2c4a4, 0xa89878];
  const tine = (pts) => { for (let i = 0; i + 1 < pts.length; i++) { R.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], BONE[1]); R.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], BONE[2]); } R.px(pts[pts.length - 1][0], pts[pts.length - 1][1], BONE[0]); };
  for (const s of [-1, 1]) {
    const X = (u) => 50 + s * u;
    tine([[X(2), 88], [X(7), 84], [X(13), 78], [X(17), 70], [X(18), 61], [X(16), 54]]);
    tine([[X(9), 82], [X(9), 74], [X(8), 68]]);
    tine([[X(14), 76], [X(19), 74], [X(23), 69]]);
    tine([[X(17), 66], [X(21), 61], [X(23), 56]]);
    R.ell(X(3), 88, 2, 1.5, BONE[2]); R.px(X(3), 87, BONE[0]);
  }
  // on the mantel: brass candlesticks, a photo, the clock, a tin of matches; a pine garland along it
  for (const cx of [14, 22]) { R.rect(cx - 2, MANTEL - 2, 5, 2, BRASS.base); R.rect(cx - 1, MANTEL - 7, 3, 5, BRASS.lo); R.px(cx - 1, MANTEL - 7, BRASS.hi); R.rect(cx - 1, MANTEL - 15 + (cx & 2), 3, 8 - (cx & 2), 0xeee4cc); R.px(cx + 1, MANTEL - 14 + (cx & 2), 0xc8bca4); R.px(cx, MANTEL - 16 + (cx & 2), 0x2a2018); }
  R.rect(30, MANTEL - 12, 11, 12, 0x6a3a1e); R.rect(31, MANTEL - 11, 9, 10, 0xd8ccb0); R.rect(32, MANTEL - 10, 7, 8, 0x7a8a9a); R.rect(33, MANTEL - 6, 5, 4, 0x4a5a4a); R.px(35, MANTEL - 8, 0xd8b090); R.px(36, MANTEL - 8, 0xd8b090);
  for (let y = MANTEL - 16; y < MANTEL; y++) { const hw = y < MANTEL - 12 ? Math.round(Math.sqrt(Math.max(0, 16 - (MANTEL - 12 - y) ** 2))) + 2 : 7; R.rect(68 - hw, y, hw * 2, 1, y === MANTEL - 1 ? 0x3a2010 : 0x7a4426); R.px(68 - hw, y, 0x9a5a34); }
  R.ell(68, MANTEL - 9, 3, 3, 0xf0e8d4); R.px(68, MANTEL - 9, 0x2a2018); R.px(68, MANTEL - 11, 0x2a2018); R.px(69, MANTEL - 9, 0x2a2018); R.px(68, MANTEL - 12, 0xb08a4a);
  R.rect(82, MANTEL - 6, 8, 6, 0x9a2a24); R.rect(82, MANTEL - 6, 8, 1, 0xc84a3a); R.rect(83, MANTEL - 4, 6, 2, 0xe8d8a8);
  for (let x = -4; x < 104; x++) {
    const sag = Math.round(Math.sin(((x + 4) / 36) * Math.PI) ** 2 * 4), y = MANTEL + 8 + sag;
    for (let k = -2; k <= 1; k++) if (bay(x, y + k) < 0.75 - Math.abs(k) * 0.15) R.px(x, y + k, (x + k * 3) % 4 === 0 ? 0x3a5a36 : 0x24402a);
    if ((x * 11) % 19 === 0) { R.px(x, y + 1, 0xc83a34); R.px(x + 1, y + 1, 0x8a1e1e); }
    if (x % 36 === 14) { R.ell(x, y + 3, 1.5, 2, 0x6a4026); R.px(x, y + 2, 0x9a6a3a); }
  }
  // the mitten line strung under the mantel, on two nails (the mittens are drawn live)
  for (let x = 2; x <= 98; x++) R.px(x, 137 + Math.round(Math.sin(((x - 2) / 96) * Math.PI) * 3), 0xd8ccb0);
  for (const nx of [2, 98]) { R.px(nx, 137, IRON.hi); R.px(nx, 138, IRON.base); }
  // the fire irons on their stand, by the hearth
  R.rect(93, 190, 1, 32, IRON.base); R.rect(90, 220, 8, 2, IRON.base); R.rect(91, 189, 6, 1, IRON.hi);
  R.rect(92, 191, 1, 26, IRON.lo); R.rect(95, 191, 1, 22, IRON.base); R.rect(94, 213, 3, 4, 0x6a4a2a); R.px(95, 217, 0x8a6a3a);
  R.ell(92, 218, 1.5, 2, IRON.base); R.px(93, 190, BRASS.base); R.px(95, 190, BRASS.base);
}

const FRAME = { hi: 0xa8723e, base: 0x7e4c26, lo: 0x52301a, dk: 0x341c0c };
const PLAID = (x, y) => { const u = ((x % 12) + 12) % 12, v = ((y % 12) + 12) % 12, a = u < 5, b = v < 5; if (u === 8 || v === 8) return a || b ? 0x9a7a48 : 0xd8b870; return a && b ? 0x4a1210 : a || b ? 0x761c18 : 0xa42c26; };
// a window in the log wall: a deep frame, its panes, a sill; the glass itself is left clear
function paintWindowFrame(R, g, cols, rows) {
  const x0 = g.x - 6, y0 = g.y - 6, w = g.w + 12, h = g.h + 13;
  R.rect(x0 - 1, y0 - 1, w + 2, h + 2, FRAME.dk);
  R.rect(x0, y0, w, h, FRAME.base);
  R.rect(x0, y0, w, 1, FRAME.hi); R.rect(x0, y0, 1, h, FRAME.hi); R.rect(x0 + w - 1, y0, 1, h, FRAME.lo);
  R.rect(x0 - 3, y0 - 4, w + 6, 4, FRAME.base); R.rect(x0 - 3, y0 - 4, w + 6, 1, FRAME.hi); R.rect(x0 - 3, y0 - 1, w + 6, 1, FRAME.dk);   // the head casing
  for (let y = y0 + 1; y < y0 + h; y++) if ((y * 7) % 19 === 0) { R.px(x0 + 2, y, FRAME.lo); R.px(x0 + w - 3, y, FRAME.dk); }
  R.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, FRAME.lo);   // the rebate
  R.clear(g.x, g.y, g.w, g.h);
  for (const [cx] of cols.slice(1)) { R.rect(g.x + cx - 2, g.y, 2, g.h, FRAME.base); R.rect(g.x + cx - 2, g.y, 1, g.h, FRAME.hi); }
  for (const [ry] of rows.slice(1)) { R.rect(g.x, g.y + ry - 2, g.w, 2, FRAME.base); R.rect(g.x, g.y + ry - 2, g.w, 1, FRAME.hi); }
  // the sill, deep enough for a few things
  const sy = g.y + g.h + 6;
  R.rect(x0 - 4, sy, w + 8, 1, FRAME.hi); R.rect(x0 - 4, sy + 1, w + 8, 3, FRAME.base); R.rect(x0 - 4, sy + 4, w + 8, 1, FRAME.lo); R.rect(x0 - 4, sy + 5, w + 8, 1, FRAME.dk);
  R.shade(x0 - 2, sy + 6, w + 4, 2, 0.6);
}
// plaid curtains on a wooden rod, tied back at the sides
function paintCurtains(R, g) {
  const ry = g.y - 13, x0 = g.x - 15, x1 = g.x + g.w + 15;
  R.rect(x0 - 2, ry, x1 - x0 + 4, 2, FRAME.lo); R.rect(x0 - 2, ry, x1 - x0 + 4, 1, FRAME.hi);
  for (const ex of [x0 - 4, x1 + 2]) { R.ell(ex, ry + 1, 2, 2, FRAME.base); R.px(ex - 1, ry, FRAME.hi); }
  for (const side of [-1, 1]) {
    const edge = side < 0 ? g.x - 15 : g.x + g.w + 15, tie = g.y + 62;
    for (let y = ry + 2; y < g.y + g.h + 2; y++) {
      const pinch = 1 - Math.max(0, 1 - Math.abs(y - tie) / 26) * 0.55, wd = Math.round((y < tie ? 11 + (y - ry) * 0.05 : 11 + (y - tie) * 0.12) * pinch) + 2;
      for (let u = 0; u < wd; u++) {
        const x = side < 0 ? edge + u : edge - u, fold = Math.sin(u * 1.1 + (y - ry) * 0.04);
        let c = PLAID(u + 40, y);
        if (fold < -0.55) c = mixc(c, 0x000000, 0.28); else if (fold > 0.8) c = mixc(c, 0xffffff, 0.08);
        if (u === wd - 1) c = mixc(c, 0x000000, 0.35);
        R.px(x, y, c);
      }
    }
    const tx = side < 0 ? edge + 1 : edge - 9;
    R.rect(tx, tie - 1, 9, 3, 0xd8c8a0); R.rect(tx, tie + 1, 9, 1, 0xa89870);
  }
}
function paintSillThings(R) {
  const sy = GY + GH + 6;
  for (const [x, s] of [[110, 1], [117, 0]]) { for (let k = 0; k < 5; k++) R.rect(x - 2 + (k & 1), sy - 1 - k * 1.2 - s, 4 - (k > 3 ? 2 : 0), 1, k % 2 ? 0x6a4026 : 0x8a5a34); R.px(x, sy - 7 - s, 0x5a3a20); }
  // a little carved bird and a jar of dried flowers
  R.ell(206, sy - 3, 4, 2, 0x9a6a3e); R.ell(203, sy - 5, 2, 2, 0x9a6a3e); R.px(201, sy - 5, 0xc8902e); R.px(203, sy - 6, 0x2a1a10); R.line(209, sy - 4, 212, sy - 6, 0x7a4e2a);
  R.rect(190, sy - 7, 5, 7, 0x8aa0a0); R.rect(190, sy - 7, 1, 7, 0xc8d8d8); R.rect(191, sy - 8, 3, 1, 0x6a7a7a);
  for (const [dx, h, c] of [[-1, 13, 0xc8a050], [1, 15, 0xa85a4a], [3, 11, 0xd8c8a0], [0, 17, 0x8a6a3a]]) { R.line(192 + dx, sy - 8, 192 + dx * 2, sy - 8 - h, 0x6a5a34); R.px(192 + dx * 2, sy - 9 - h, c); R.px(192 + dx * 2 + 1, sy - 8 - h, c); }
}

// the right-hand wall: a shelf of jars and the lantern, the trail map, skis and snowshoes
const JARS = [[254, 7, 13, 0xd8901e, 0xe8d8b0], [263, 8, 16, 0x8a1e30, 0xc8a050], [273, 7, 12, 0x6a8a3a, 0x8a8a90], [282, 9, 15, 0xc8a878, 0xe8d8b0], [293, 7, 11, 0xe8e0d0, 0x9a2a24], [302, 8, 14, 0x9a5a2a, 0xc8a050]];
function paintRightWall(R) {
  // the shelf, on two iron brackets
  R.rect(230, 88, 88, 1, LOG.hi); R.rect(230, 89, 88, 3, 0x8a5a32); R.rect(230, 92, 88, 1, LOG.dk);
  for (const bx of [240, 306]) { R.rect(bx, 93, 2, 9, IRON.base); R.line(bx + 1, 101, bx + 8 * (bx < 270 ? 1 : -1), 93, IRON.base); R.px(bx, 93, IRON.hi); }
  R.shade(230, 93, 88, 2, 0.6);
  for (const [x, w, h, fill, lid] of JARS) {
    const top = 88 - h;
    for (let y = top + 2; y < 88; y++) for (let xx = x; xx < x + w; xx++) {
      let c = y < top + 4 ? mixc(fill, 0xffffff, 0.35) : fill;
      if (xx === x) c = mixc(fill, 0xffffff, 0.5); else if (xx === x + 1) c = mixc(fill, 0xffffff, 0.22); else if (xx === x + w - 1) c = mixc(fill, 0x000000, 0.35);
      R.px(xx, y, c);
    }
    R.rect(x, top, w, 2, lid); R.rect(x - 1, top + 1, w + 2, 1, mixc(lid, 0x000000, 0.2));
    if (h > 12) { R.rect(x + 1, top + 6, w - 2, 4, 0xece0c4); R.rect(x + 2, top + 7, w - 4, 1, 0x8a6a4a); }
  }
  // a bundle of dried herbs hanging under the shelf
  for (let k = 0; k < 7; k++) R.line(270 + k, 94, 268 + k * 1.6, 106 + (k % 3), k % 2 ? 0x6a7a3a : 0x8a8a4a);
  R.rect(270, 93, 7, 2, 0xc8b890);
  // the lantern's tin base, wire guard, cap and bail (its glass is drawn live, lit or not)
  const { x, y } = LANT;
  R.rect(x, y + 22, 14, 6, 0x8a2a24); R.rect(x, y + 22, 14, 1, 0xc84a3a); R.rect(x - 1, y + 27, 16, 1, 0x4a1612); R.rect(x + 4, y + 24, 6, 1, BRASS.base);
  R.rect(x + 2, y + 4, 10, 2, 0x8a2a24); R.rect(x + 1, y + 6, 12, 1, 0x6a1e1a); R.rect(x + 5, y + 2, 4, 2, 0x8a2a24); R.px(x + 6, y + 1, 0x4a1612);
  for (let k = 0; k <= 12; k++) R.px(x + 1 + k, y + 1 - Math.round(Math.sin((k / 12) * Math.PI) * 6), IRON.base);
  for (const gx of [x + 1, x + 12]) R.rect(gx, y + 7, 1, 15, IRON.base);
  // the map: the ridge, the lake, the trail up to the hut
  R.rect(246, 104, 52, 38, 0x4a2a14); R.rect(247, 105, 50, 36, 0x7a4a28); R.rect(249, 107, 46, 32, 0xe2d2aa);
  for (let k = 0; k < 5; k++) for (let a = 0; a < 6.28; a += 0.06) { const px = 276 + Math.cos(a) * (4 + k * 3.4) * (1 + Math.sin(a * 3) * 0.08), py = 120 + Math.sin(a) * (3 + k * 2.4); if (px > 249 && px < 295 && py > 107 && py < 139) R.px(px, py, k === 0 ? 0x8a5a34 : 0xb8986a); }
  R.ell(258, 131, 5, 3, 0x6a9ab8); R.px(256, 130, 0x9ac8e0);
  for (let k = 0; k < 14; k++) if (k % 2 === 0) R.px(256 + k * 1.4, 128 - k * 0.6 - Math.sin(k) * 1.5, 0xb83a34);
  R.rect(275, 118, 3, 2, 0x5a3a24); R.px(276, 117, 0x5a3a24);
  R.text('N', 289, 109, 0x5a3a24); R.px(290, 108, 0x5a3a24);
  // the skis and their poles, leaning in the corner; the snowshoes in front
  const ski = (bx, tx) => {
    for (let y = 94; y < 237; y++) {
      const u = (y - 94) / 143, x = Math.round(tx + (bx - tx) * u) + (y < 102 ? Math.round(((102 - y) / 8) ** 2 * 3) : 0);
      const c = y < 106 ? 0xa83a2a : y > 160 && y < 168 ? 0x2a2a30 : 0xa86a3a;
      R.px(x, y, mixc(c, 0xffffff, 0.2)); R.rect(x + 1, y, 2, 1, c); R.px(x + 3, y, mixc(c, 0x000000, 0.35));
    }
  };
  ski(300, 307); ski(306, 313);
  for (const [bx, tx] of [[296, 300], [299, 304]]) { R.line(bx, 236, tx, 112, 0xc8b070); R.px(tx, 111, 0x2a2a30); R.ell(bx + 0.4, 226, 3, 1, 0x5a3a20); R.line(tx, 112, tx + 1, 118, 0x6a4a2a); }
  for (const [cx, cy] of [[262, 172], [282, 174]]) {
    for (let y = -22; y <= 22; y++) for (let x = -8; x <= 8; x++) {
      const e = (x / 8.5) ** 2 + (y / (y < 0 ? 22.5 : 22.5)) ** 2 * (1 + (y > 10 ? (y - 10) * 0.02 : 0));
      if (e > 1) continue;
      const rim = e > 0.72;
      if (rim) R.px(cx + x, cy + y, e > 0.86 ? 0x8a5a2a : 0xc89a5a);
      else if ((x + y + 40) % 4 === 0 || (x - y + 40) % 4 === 0) R.px(cx + x, cy + y, 0xd8c49a);
    }
    R.rect(cx - 6, cy - 4, 13, 1, 0xc89a5a); R.rect(cx - 6, cy + 6, 13, 1, 0xc89a5a); R.rect(cx - 2, cy - 3, 5, 3, 0x5a3a20);
    R.rect(cx, cy - 25, 1, 3, 0xc8b890); R.px(cx, cy - 26, IRON.hi); R.shade(cx + 9, cy - 18, 1, 38, 0.7);
  }
}

// the low table: a slab of pine on stout legs; the book, the candle's jar and the mug on it
function paintTable(R) {
  const { x, y, w } = TBL;
  for (let yy = y; yy < y + 10; yy++) {
    const k = (yy - y) / 9, x0 = Math.round(x + 5 - k * 5), x1 = Math.round(x + w - 5 + k * 5);
    for (let xx = x0; xx < x1; xx++) {
      const g = Math.sin(xx * 0.07 + yy * 0.6 + Math.sin(xx * 0.02 + yy * 0.3) * 2.5);
      let c = g > 0.86 ? 0x8a5430 : g < -0.88 ? 0x5a321a : 0x74462a;
      if (yy === y) c = 0x9a643a; else if (xx === x0) c = 0x9a643a; else if (xx === x1 - 1) c = 0x4a2814;
      R.px(xx, yy, c);
    }
  }
  R.rect(x, y + 10, w, 1, 0xa86e40); R.rect(x, y + 11, w, 4, 0x5a3218); R.rect(x, y + 15, w, 1, 0x341a0a);
  R.shade(x, y + 15, w, 1, 0.7);
  for (const lx of [x + 3, x + w - 10]) { R.rect(lx, y + 16, 7, 16, 0x5a3218); R.rect(lx, y + 16, 2, 16, 0x7a4a28); R.rect(lx + 6, y + 16, 1, 16, 0x341a0a); R.rect(lx - 1, y + 32, 9, 1, 0x2a1408); }
  for (const lx of [x + 14, x + w - 20]) { R.rect(lx, y + 16, 5, 9, 0x3a1e0c); }
  // an open book, its pages bowing up to the spine
  for (let xx = BOOK.x; xx < BOOK.x + 30; xx++) {
    const u = xx - (BOOK.x + 15), top = BOOK.y + Math.round(Math.abs(u) / 7) - (Math.abs(u) < 2 ? 1 : 0);
    for (let yy = top; yy < BOOK.y + 9; yy++) {
      let c = 0xece0c4;
      if (yy === BOOK.y + 8 || xx === BOOK.x || xx === BOOK.x + 29) c = 0x3a5a3a;
      else if (Math.abs(u + 0.5) < 1) c = 0xb8a888;
      else if (yy > top + 1 && yy < BOOK.y + 7 && (yy - top) % 2 === 0 && Math.abs(u) > 2 && Math.abs(u) < 13 && (xx * 13 + yy * 7) % 9 > 1) c = 0x8a7c66;
      if (yy === top && c === 0xece0c4) c = 0xfaf2e0;
      R.px(xx, yy, c);
    }
  }
  R.rect(BOOK.x + 18, BOOK.y + 8, 2, 4, 0xa83a2a);   // the ribbon
  // the candle in its jar: wax, a little burnt down; the glass with its highlights
  const jx = JAR.x, jy = JAR.y;
  R.rect(jx + 1, jy + 6, 7, 7, 0xeee0c0); R.rect(jx + 1, jy + 6, 7, 1, 0xd8c8a0); R.px(jx + 4, jy + 5, 0x2a2018);
  for (let yy = jy; yy < jy + 13; yy++) { R.px(jx, yy, 0x9ab0b0, 0.8); R.px(jx + 8, yy, 0x6a8080, 0.8); }
  R.rect(jx, jy + 13, 9, 1, 0x7a9090); R.rect(jx + 1, jy, 7, 1, 0xc8d8d8, 0.7); R.px(jx + 1, jy + 2, 0xffffff); R.px(jx + 1, jy + 3, 0xe8f0f0);
  R.line(jx + 2, jy - 1, jx + 6, jy - 1, 0xb89a6a); R.rect(jx + 3, jy - 2, 3, 1, 0xa83a2a);
  // the mug: red enamel, a white rim, on a wooden coaster (the cocoa and marshmallows are live)
  const mx = MUG.x, my = MUG.y;
  R.ell(mx + 6, my + 16, 9, 2, 0x6a3a1e); R.ell(mx + 6, my + 15, 8, 1.5, 0x9a643a);
  for (let yy = my; yy < my + 15; yy++) for (let xx = mx; xx < mx + 12; xx++) {
    let c = xx < mx + 2 ? 0xd85a4a : xx > mx + 9 ? 0x8a1e1a : 0xb8302a;
    if (yy <= my + 1) c = yy === my ? 0xf4f0e6 : 0xd8d2c4;
    if (yy === my + 14) c = 0x6a1612;
    if ((xx * 7 + yy * 5) % 23 === 0 && yy > my + 2) c = mixc(c, 0xffffff, 0.3);
    R.px(xx, yy, c);
  }
  for (const [hx, hy] of [[12, 3], [13, 3], [14, 4], [14, 5], [14, 6], [14, 7], [13, 8], [12, 8]]) R.px(mx + hx, my + hy, 0xa82a24);
  R.px(mx + 13, my + 5, 0x6a1612); R.px(mx + 13, my + 6, 0x6a1612);
  // a little plate of gingerbread, at the back
  const gx = TBL.x + 48, gy = TBL.y + 2;
  R.ell(gx, gy + 1, 6, 1.6, 0xe8e2d8); R.ell(gx, gy, 5, 1.2, 0xf4f0e8);
  for (const [dx, c] of [[-2, 0xa8642a], [2, 0x9a5a24]]) { R.ell(gx + dx, gy - 1, 2, 1.4, c); R.px(gx + dx, gy - 2, 0xf0e8d8); }
}

// the braided rug: rings of red, cream, blue, ochre and green, plaited
const RUGC = [0x9a2a24, 0xd8c8a0, 0x3a5a7a, 0xc8902e, 0x4a6a3a, 0x7a2a3a, 0xd8c8a0, 0x9a2a24, 0x3a5a7a, 0xc8902e];
function paintRug(R) {
  const cx = 150, cy = 292, rx = 118, ry = 24;
  for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    const e = sq((x - cx) / rx, (y - cy) / ry);
    if (e > 1) continue;
    const ring = Math.min(RUGC.length - 1, Math.floor((1 - e) * 11)), base = RUGC[ring], dir = ring & 1 ? 1 : -1;
    let c = ((x * dir + y * 2 + 400) % 4) < 2 ? base : mixc(base, 0x000000, 0.22);
    const f = (1 - e) * 11 - Math.floor((1 - e) * 11);
    if (f < 0.12) c = mixc(base, 0x000000, 0.4);
    if (e > 0.96) c = mixc(base, 0x000000, 0.45);
    R.px(x, y, c);
  }
  R.shade(cx - rx + 10, cy + ry, rx * 2 - 20, 2, 0.6);
}
// a wicker basket of split logs, by the hearth
function paintBasket(R) {
  const x = -4, y = 200, w = 24, h = 22;
  const end = (ex, ey, r2) => { R.ell(ex, ey, r2, r2 - 0.5, 0x6a4026); R.ell(ex, ey, r2 - 1, r2 - 1.5, 0xc8945a); R.px(ex, ey, 0x8a5a30); if (r2 > 3) R.ell(ex, ey, r2 - 2.5, r2 - 3, 0xb07a44); R.px(ex, ey, 0x7a4a24); };
  for (const [lx, ly, len] of [[x + 2, y - 4, 22], [x + 6, y - 8, 18], [x + 1, y - 9, 12]]) { R.rect(lx, ly - 3, len, 6, 0x5a3a20); R.rect(lx, ly - 3, len, 1, 0x7a5a34); for (let k = 0; k < len; k += 3) R.px(lx + k, ly - 1 + (k % 2), 0x3a2410); }
  end(x + 24, y - 4, 4); end(x + 24, y - 8, 3); end(x + 13, y - 9, 3); end(x + 3, y - 6, 3);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = ((xx + (yy >> 1) * 2) % 4) < 2 ? 0xc8984e : 0x8a6430;
    if (yy % 4 === 0) c = 0xa87a40;
    if (yy < y + 2) c = (xx & 1) ? 0x7a5428 : 0x9a7038;
    if (xx === x || xx === x + w - 1) c = 0x5a3a1a;
    R.px(xx, yy, c);
  }
  for (const hx of [x + 3, x + w - 5]) { R.rect(hx, y - 2, 2, 3, 0x6a4a24); }
  R.shade(x - 2, y + h, w + 4, 1, 0.7);
}

/* ——— full screen: the rest of the cabin ——— */
const QUILT = [0x9a2a24, 0xd8c8a0, 0x3a5a7a, 0xc8902e, 0x4a6a3a, 0x7a3a5a, 0xb86a3a, 0xe0d4b4, 0x2e4a6a];
// to the left: a bunk under the second window: log posts and rails, a thick mattress under a patchwork
// quilt, two pillows, a striped blanket folded at the foot, boots underneath
function paintBunk(R) {
  const x0 = -124, x1 = -4;
  R.rect(x0 + 6, 226, x1 - x0 - 12, 12, 0x1e140c);   // the dark under the bed
  for (const [bx, c] of [[-70, 0x4a3020], [-60, 0x3e281a]]) { R.rect(bx, 227, 7, 10, c); R.rect(bx, 234, 10, 3, c); R.rect(bx, 227, 7, 1, mixc(c, 0xffffff, 0.2)); R.px(bx + 2, 229, 0xb8a888); }
  const logPost = (px, top) => {
    for (let y = top; y < 238; y++) for (let x = px; x < px + 7; x++) R.px(x, y, x === px ? LOG.hi : x === px + 6 ? LOG.dk : x === px + 5 ? LOG.lo : (y * 3 + x) % 13 === 0 ? LOG.lo : LOG.base);
    R.ell(px + 3, top, 3.4, 2, LOG.hi); R.ell(px + 3, top, 2, 1, 0xc8945a); R.px(px + 3, top, LOG.mid);
  };
  logPost(x0, 168); logPost(x1 - 7, 186);
  // the headboard: two small logs between the head posts and the wall
  for (const [y, h] of [[176, 6], [186, 6]]) { R.rect(x0 + 7, y, 26, h, LOG.base); R.rect(x0 + 7, y, 26, 1, LOG.hi); R.rect(x0 + 7, y + h - 1, 26, 1, LOG.dk); }
  R.rect(x0 + 7, 222, x1 - x0 - 14, 6, LOG.base); R.rect(x0 + 7, 222, x1 - x0 - 14, 1, LOG.hi); R.rect(x0 + 7, 227, x1 - x0 - 14, 1, LOG.dk);   // the side rail
  // the quilt: its top, seen from a little above, then hanging over the side
  for (let y = 196; y < 224; y++) {
    const drape = y > 206 ? Math.round(Math.sin((y - 206) * 0.35) * 1.2) : 0;
    for (let x = x0 + 8; x < x1 - 8; x++) {
      if (y > 220 && (x + y) % 7 === 0) continue;
      const top = y < 206, qx = Math.floor((x + 200) / (top ? 9 : 8)), qy = Math.floor((y - (top ? 196 : 206) + drape) / (top ? 5 : 7));
      let c = QUILT[((qx * 3 + qy * 5 + ((qx * qy) % 4)) % QUILT.length + (top ? 3 : 0)) % QUILT.length];
      if ((x + 200) % (top ? 9 : 8) === 0 || (y - (top ? 196 : 206) + drape) % (top ? 5 : 7) === 0) c = mixc(c, 0x000000, 0.28);
      if (y === 196) c = mixc(c, 0xffffff, 0.2);
      if (y === 206) c = mixc(c, 0xffffff, 0.12);
      if (!top) c = mixc(c, 0x000000, 0.08 + (y - 206) * 0.012);
      R.px(x + (top ? 0 : drape), y, c);
    }
  }
  // the turned-down sheet and two pillows at the head
  R.rect(x0 + 8, 196, 30, 3, 0xece6d8); R.rect(x0 + 8, 199, 30, 1, 0xc8c0b0);
  for (const [px, py] of [[x0 + 12, 190], [x0 + 26, 192]]) for (let y = py - 5; y <= py + 5; y++) for (let x = px - 8; x <= px + 8; x++) { const e = sq((x - px) / 8.5, (y - py) / 5.2); if (e < 1) R.px(x, y, e > 0.82 ? 0xb8ae9a : y > py + 2 ? 0xd8d0c0 : (x % 5 === 0) ? 0xd0c8b8 : 0xf0eade); }
  // the striped blanket folded at the foot
  const ST = [0xf4ecdc, 0xe8dcc4, 0x2e5a3a, 0xe8dcc4, 0xb83a2a, 0xe8dcc4, 0xd8a83a, 0x2a3a6a, 0xe8dcc4];
  for (let y = 192; y < 201; y++) for (let x = x1 - 36; x < x1 - 10; x++) R.px(x, y, x === x1 - 36 ? mixc(ST[y - 192], 0x000000, 0.2) : ST[y - 192]);
  R.rect(x1 - 36, 201, 26, 1, 0x8a7e6a);
}
// further left on a very wide screen: a bookshelf, a hanging oil lamp, a stool with a basket of yarn
const BOOKC = [0x8a3a3a, 0x3a5a7a, 0xc8963a, 0x4a6a4a, 0x6a4a7a, 0xd8cbb0, 0x2f4f5f, 0xa0603a, 0x5a2a3a];
function paintCorner(R) {
  const x0 = SHELFX, w = 46, r = rng(77);
  R.rect(x0, 70, w, 168, 0x5a3418); R.rect(x0, 70, w, 2, 0x8a5a32); R.rect(x0, 70, 2, 168, 0x7a4a28); R.rect(x0 + w - 2, 70, 2, 168, 0x3a200e);
  for (let sy = 74; sy < 230; sy += 32) {
    R.rect(x0 + 2, sy, w - 4, 29, 0x2e1a0c);
    R.rect(x0 + 2, sy + 29, w - 4, 3, 0x7a4a28); R.rect(x0 + 2, sy + 29, w - 4, 1, 0x9a6a3a);
    for (let bx = x0 + 3; bx < x0 + w - 4;) {
      const bw = 2 + Math.floor(r() * 3), bh = 16 + Math.floor(r() * 11), c = BOOKC[Math.floor(r() * BOOKC.length)];
      if (r() < 0.12 && bx < x0 + w - 14) { R.ell(bx + 4, sy + 26, 4, 3, 0xa4553a); for (let k = 0; k < 5; k++) R.line(bx + 4, sy + 23, bx + k * 2, sy + 14 + (k % 2) * 3, 0x3a6a3a); bx += 10; continue; }
      if (bx + bw > x0 + w - 3) break;
      R.rect(bx, sy + 29 - bh, bw, bh, c); R.px(bx, sy + 29 - bh, mixc(c, 0xffffff, 0.3)); R.rect(bx, sy + 31 - bh + 3, bw, 1, mixc(c, 0xffffff, 0.35));
      bx += bw + (r() < 0.2 ? 1 : 0);
    }
  }
  // the oil lamp, on a chain from the beam
  const lx = SHELFX + 64;
  for (let y = 16; y < 58; y += 2) R.px(lx, y, IRON.hi);
  R.rect(lx - 4, 58, 9, 2, BRASS.lo); R.rect(lx - 2, 60, 5, 1, BRASS.base);
  for (let y = 61; y < 72; y++) { const hw = y < 64 ? 1 : y < 70 ? 3 : 2; for (let x = lx - hw; x <= lx + hw; x++) R.emit(x, y, Math.abs(x - lx) < 1 && y > 64 && y < 69 ? 0xfff4d0 : 0xffd890); }
  R.ell(lx, 75, 5, 3, BRASS.base); R.rect(lx - 5, 75, 11, 1, BRASS.hi); R.rect(lx - 3, 78, 7, 1, BRASS.lo);
  // a stool with a basket of yarn, knitting needles through it
  R.rect(lx - 14, 218, 26, 3, 0x7a4a28); R.rect(lx - 14, 218, 26, 1, 0xa06a3a); for (const k of [lx - 12, lx + 8]) R.rect(k, 221, 3, 17, 0x5a3418);
  R.ell(lx - 2, 212, 8, 6, 0x9a7038); for (const [bx, by, c] of [[-5, 207, 0xb83a3a], [1, 206, 0x3a6a8a], [-1, 210, 0xd8c8a0]]) R.ell(lx + bx, by, 3, 2.5, c);
  R.line(lx - 6, 200, lx + 2, 210, 0xc8c0b0); R.line(lx + 4, 199, lx - 1, 209, 0xc8c0b0);
}
// to the right: the woodpile, the door's frame and the threshold, the coat rack's pole
function paintWoodpile(R) {
  const x0 = 324, x1 = 356, r = rng(5);
  R.rect(x0 - 1, 234, x1 - x0 + 2, 4, 0x3a2410);
  for (let row = 0; row < 7; row++) {
    const yy = 230 - row * 7.5, off = row & 1 ? 4 : 0;
    for (let lx = x0 + off; lx < x1 - 2; lx += 8) {
      const rr = 3.6 + r() * 0.8, kind = r(), ex = lx + 4, ey = Math.round(yy);
      if (row > 4 && (lx < x0 + 4 || lx > x1 - 10)) continue;
      R.ell(ex, ey, rr, rr - 0.3, 0x4a2c14);
      if (kind < 0.5) { R.ell(ex, ey, rr - 1, rr - 1.3, 0xc8945a); R.ell(ex, ey, rr - 2.4, rr - 2.6, 0xb07a44); R.px(ex, ey, 0x8a5a30); }
      else { for (let y = -3; y <= 2; y++) for (let x = -3; x <= 3; x++) if (x + y < 2 && x * x + y * y < 12) R.px(ex + x, ey + y, x === -3 || y === -3 ? 0x5a3a20 : (x - y) % 3 === 0 ? 0xb07a44 : 0xd09c62); }
    }
  }
  R.line(359, 237, 354, 212, 0x8a5a32); R.line(360, 237, 355, 212, 0x6a4024); R.rect(350, 209, 8, 4, IRON.base); R.px(350, 209, IRON.hi); R.px(357, 212, 0xb8bcc4);
}
function paintDoorway(R) {
  const d = DOOR, ix = d.x + 4, iw = d.w - 8;
  R.rect(d.x - 1, d.y - 5, d.w + 2, 135, FRAME.dk);
  R.rect(d.x, d.y - 4, d.w, 134, FRAME.base); R.rect(d.x, d.y - 4, d.w, 1, FRAME.hi); R.rect(d.x, d.y - 4, 1, 134, FRAME.hi); R.rect(d.x + d.w - 1, d.y - 4, 1, 134, FRAME.lo);
  R.rect(d.x - 3, d.y - 8, d.w + 6, 4, FRAME.base); R.rect(d.x - 3, d.y - 8, d.w + 6, 1, FRAME.hi); R.rect(d.x - 3, d.y - 5, d.w + 6, 1, FRAME.dk);
  R.clear(ix, d.y, iw, FLOOR - d.y);
  R.rect(ix - 1, FLOOR - 2, iw + 2, 2, LOG.mid); R.rect(ix - 1, FLOOR - 2, iw + 2, 1, LOG.hi);
  // a carved sign over it, and a little drift of snow blown in on the boards
  R.rect(d.x + 8, d.y - 20, 36, 10, 0x6a3a1e); R.rect(d.x + 9, d.y - 19, 34, 8, 0x8a5a32); R.text('WELCOME', d.x + 13, d.y - 17, 0x3a1e0c);
  // a rag mat before the door, a little drift of snow blown in over it, boots by the coat rack
  for (let y = FLOOR + 3; y < FLOOR + 13; y++) for (let x = ix - 4 - (y - FLOOR) / 3; x < ix + iw + 4 + (y - FLOOR) / 3; x++) { const k = (y - FLOOR - 3); R.px(x, y, k === 0 || k === 9 ? 0x5a3a2a : [0x8a4a3a, 0x6a7a8a, 0xb89a6a, 0x5a6a4a][(k >> 1) % 4]); }
  for (let x = ix - 2; x < ix + 24; x++) { const h = Math.round(Math.max(0, 3 - Math.abs(x - ix - 7) / 5)); for (let y = FLOOR + 2; y < FLOOR + 2 + h; y++) R.px(x, y, y === FLOOR + 2 ? 0xf0f4fa : 0xd0d8e8); }
  for (const [bx, c] of [[420, 0x5a3a28], [429, 0x4e3222]]) { R.rect(bx, 232, 7, 12, c); R.rect(bx, 242, 10, 4, c); R.rect(bx, 232, 7, 2, 0x9a8a7a); R.rect(bx, 232, 1, 12, mixc(c, 0xffffff, 0.2)); R.rect(bx + 1, 245, 9, 1, 0xd8e0ec); R.shade(bx, 246, 11, 1, 0.6); }
}
function paintRackPole(R) {
  const cx = RACK.x + 11;
  R.rect(cx - 1, RACK.y, 3, RACK.h, 0x6a4024); R.rect(cx - 1, RACK.y, 1, RACK.h, 0x9a6a3a);
  R.ell(cx, RACK.y - 1, 2, 2, 0x8a5a32);
  for (const [dx, dy] of [[-6, 6], [5, 4], [-5, 14], [6, 12]]) R.line(cx, RACK.y + dy + 3, cx + dx, RACK.y + dy, 0x7a4a28);
  for (const s of [-1, 1]) R.line(cx, RACK.y + RACK.h - 8, cx + s * 9, RACK.y + RACK.h - 1, 0x5a3418);
  R.shade(RACK.x - 2, RACK.y + RACK.h, 26, 1, 0.5);
}
// a tin oil lamp on a bracket by the door, its reflector polished, its chimney glowing
function paintSconce(R) {
  const { x, y } = SCONCE;
  R.rect(x - 4, y - 6, 3, 22, 0x8a8e96); R.rect(x - 4, y - 6, 1, 22, 0xc8ccd4); R.ell(x - 3, y - 7, 3, 2, 0x9a9ea6);
  R.rect(x - 1, y + 14, 9, 2, IRON.base); R.ell(x + 3, y + 12, 4, 2.5, BRASS.base); R.rect(x, y + 11, 7, 1, BRASS.hi);
  for (let yy = y; yy < y + 10; yy++) { const hw = yy < y + 2 ? 1 : yy < y + 8 ? 2 : 1; for (let xx = x + 3 - hw; xx <= x + 3 + hw; xx++) R.emit(xx, yy, Math.abs(xx - x - 3) < 1 && yy > y + 3 && yy < y + 8 ? 0xfff4d0 : 0xffd890); }
}
// furthest right: a sled leaning on the wall, a washstand with its jug, a mirror and a towel
function paintFarRight(R) {
  for (let y = 168; y < 238; y++) {
    const curl = y < 180 ? Math.round(((180 - y) / 12) ** 2 * 6) : 0;
    for (let x = 454; x < 474; x++) { if ((x - 454) % 5 === 4) continue; R.px(x - curl, y, (x - 454) % 5 === 0 ? 0xc89a5a : (x - 454) % 5 === 3 ? 0x8a5a2a : 0xb07a40); }
  }
  for (const y of [186, 210, 230]) { R.rect(452, y, 24, 2, 0x6a3a1e); R.rect(452, y, 24, 1, 0x9a5a34); }
  R.line(452, 170, 446, 188, 0xd8c8a0); R.line(446, 188, 452, 200, 0xd8c8a0);
  const wx = 488;
  R.rect(wx, 198, 40, 40, 0x7a4a28); R.rect(wx, 198, 40, 2, 0xa06a3a); R.rect(wx + 3, 204, 34, 14, 0x5a3418); R.rect(wx + 3, 222, 34, 12, 0x5a3418);
  for (const ky of [210, 227]) R.rect(wx + 18, ky, 4, 2, BRASS.base);
  R.ell(wx + 14, 195, 11, 3, 0xe8e8ec); R.ell(wx + 14, 194, 9, 2, 0xb8c8d8); R.rect(wx + 4, 196, 21, 1, 0x3a5a8a);
  for (let y = 178; y < 196; y++) { const hw = y < 182 ? 3 : y < 186 ? 4 : 5; R.rect(wx + 31 - hw, y, hw * 2, 1, y === 188 ? 0x3a5a8a : 0xf0f0f4); R.px(wx + 31 + hw - 1, y, 0xb8bcc8); }
  R.line(wx + 36, 182, wx + 38, 188, 0xe8e8ec); R.rect(wx + 25, 178, 3, 2, 0xf0f0f4);
  R.rect(wx + 6, 120, 28, 40, 0x6a3a1e); R.rect(wx + 8, 122, 24, 36, 0x2a3450); for (let k = 0; k < 6; k++) R.px(wx + 12 + k * 2, 150 - k * 4, 0x4a5a80);
  R.rect(477, 140, 9, 2, IRON.base); R.line(478, 142, 482, 148, IRON.base); R.rect(479, 136, 4, 4, 0xeee0c0); R.rect(479, 136, 4, 1, 0xd8c8a0);   // a candle on a bracket
  R.emit(481, 133, 0xffd070); R.emit(481, 134, 0xfff0c0); R.emit(481, 135, 0xffb050);
  R.rect(wx + 40, 200, 2, 30, 0x5a3418); R.rect(wx + 39, 202, 4, 22, 0xd8c8a0); for (let y = 206; y < 224; y += 5) R.rect(wx + 39, y, 4, 1, 0xa83a2a);
}

/* ——— the things that move: painted once per frame of their motion, baked like the cabin ——— */
const FUR = { dk: 0x3e424c, base: 0x666a76, hi: 0x8a8e9a, wh: 0xeae6de, whLo: 0xc4c0b8, nose: 0x18181c, pink: 0xd88a8a };
// the dog, a grey-and-white husky curled on the rug. pose: breath, head (0 down, 1 up), eyes, tail
// (0 curled, 1/2 wagging), stretch
function paintDog(S, { breath = 0, head = 0, eyes = 0, tail = 0, stretch = 0 }) {
  const b = breath ? 1 : 0, by = stretch ? 2 : 0;
  // the tail first, behind or round the front
  if (tail === 0) {
    for (let k = 0; k <= 16; k++) { const a = Math.PI * (0.55 + k / 16 * 0.85), x = 46 + Math.cos(a) * 15, y = 278 + Math.sin(a) * 6; S.ell(x, y + 2, 3.2 - k * 0.08, 2.4, k > 13 ? FUR.wh : k > 9 ? FUR.hi : FUR.base); }
  } else {
    const sw = tail === 1 ? -1 : 1;
    for (let k = 0; k <= 12; k++) { const u = k / 12, x = 36 - u * 10 + sw * u * u * 6, y = 272 - u * 14 + by; S.ell(x, y, 3 - u, 2.6 - u * 0.6, k > 9 ? FUR.wh : k > 5 ? FUR.hi : FUR.base); }
  }
  // the haunch and the body, saddle-dark along the back, white underneath
  const bodyY = 274 - b + by;
  S.ell(42, 272 - b + (stretch ? -3 : 0), 12, 9, FUR.base);
  S.ell(58 + stretch * 2, bodyY, 21 + stretch * 3, 8, FUR.base);
  for (let y = 262; y < 286; y++) for (let x = 28; x < 84; x++) {
    if (!S.has(x, y)) continue;
    const c = S.get(x, y);
    if (c !== FUR.base) continue;
    if (y < bodyY - 5 + Math.round(Math.sin(x * 0.2) * 0.8)) S.px(x, y, FUR.dk);
    else if (y > bodyY + 4) S.px(x, y, FUR.whLo);
    else if (y > bodyY + 2) S.px(x, y, bay(x, y) < 0.5 ? FUR.wh : FUR.base);
    else if ((x * 3 + y * 7) % 11 === 0) S.px(x, y, FUR.hi);
  }
  S.ell(38, 270 - b + (stretch ? -3 : 0), 5, 4, FUR.hi); S.px(36, 268 - b, FUR.wh);
  S.ell(46, 282 + by, 8, 3, FUR.whLo); S.ell(46, 281 + by, 7, 2, FUR.wh);   // the hind leg, tucked
  // the front paws, out towards the table
  const pr = stretch ? 94 : 86;
  S.rect(70, 280 + by, pr - 70, 4, FUR.wh); S.rect(70, 283 + by, pr - 70, 1, FUR.whLo);
  for (const t of [2, 4]) S.px(pr - t, 283 + by, FUR.whLo);
  S.rect(68, 276 + by, 6, 6, FUR.base);
  // the head: resting on the paws, or up and listening
  const hx = stretch ? 86 : 79, hy = head ? 265 : stretch ? 276 : 274;
  if (head) { S.ell(73, 270, 5, 6, FUR.base); S.ell(75, 273, 3, 4, FUR.wh); }
  S.ell(hx, hy, 8, 6, FUR.base);
  S.ell(hx + 1, hy + 2, 6, 4, FUR.wh);
  S.rect(hx - 4, hy - 5, 9, 2, FUR.dk);
  S.ell(hx + 7, hy + 3, 4, 2.6, FUR.wh); S.px(hx + 10, hy + 2, FUR.nose); S.px(hx + 11, hy + 2, FUR.nose); S.px(hx + 10, hy + 3, FUR.nose);
  S.px(hx + 8, hy + 5, FUR.whLo); S.px(hx + 6, hy + 5, FUR.whLo);
  for (const [ex, tall] of [[hx - 5, 0], [hx + 1, 1]]) {
    const up = head ? 5 + tall : 3;
    for (let k = 0; k < up; k++) { const w = Math.max(1, 3 - Math.floor(k * 3 / up)); S.rect(ex + (head ? 0 : k > 1 ? -1 : 0), hy - 5 - k, w, 1, k === up - 1 ? FUR.dk : FUR.base); }
    if (head) S.px(ex + 1, hy - 6, FUR.pink);
  }
  // the eyes: shut in a line, or open and bright
  for (const ex of [hx + 1, hx + 5]) {
    if (eyes) { S.px(ex, hy - 1, 0x1a1410); S.px(ex + 1, hy - 1, 0x2a3a5a); S.emit(ex, hy - 2, 0xf8f0e0); }
    else { S.px(ex, hy, 0x2a2a30); S.px(ex + 1, hy, 0x2a2a30); }
  }
  S.px(hx + 3, hy - 2, FUR.wh); S.px(hx + 3, hy - 3, FUR.wh);
  if (head && eyes) { S.px(hx + 8, hy + 5, 0xd86a7a); S.px(hx + 9, hy + 5, 0xe88a8a); }   // a happy pant
}
const DOGPOSE = [
  { breath: 0 }, { breath: 1 },
  { head: 1, eyes: 1 }, { head: 1, eyes: 1, tail: 1 }, { head: 1, eyes: 1, tail: 2 },
  { stretch: 1, tail: 1 }, { head: 1, eyes: 0 },
];

const OAK = { hi: 0xb87e4a, base: 0x8a5430, lo: 0x5e361a, dk: 0x3a1e0c };
// the rocking chair, side on and a little from behind, facing the fire; a cushion, a knitted blanket
function paintChair(R) {
  const runner = (x) => 304 - ((x - 160) / 55) ** 2 * 12;
  const post = (x0, y0, x1, y1, w, c) => { for (let k = 0; k < w; k++) R.line(x0 + k, y0, x1 + k, y1, k === 0 ? c.hi : k === w - 1 ? c.dk : c.base); };
  const far = { hi: OAK.base, base: OAK.lo, dk: OAK.dk };
  // the far side first, darker: its runner, legs, back post and the spindles between
  for (let x = 112; x <= 220; x++) { const y = Math.round(runner(x - 6)) - 4; R.rect(x, y, 1, 2, OAK.lo); R.px(x, y + 2, OAK.dk); }
  post(134, 250, 134, Math.round(runner(128)) - 4, 3, far); post(178, 250, 178, Math.round(runner(172)) - 4, 3, far);
  post(178, 250, 188, 168, 3, far);
  for (let k = 0; k < 5; k++) { const u = (k + 1) / 6; R.line(179 + u * 13, 246 - u * 1, 188 + u * 12, 171 - u * 5, OAK.base); R.line(180 + u * 13, 246 - u * 1, 189 + u * 12, 171 - u * 5, OAK.lo); }
  // the crest rail across the top of the back
  for (let x = 186; x <= 205; x++) { const y = 170 - Math.round((x - 186) * 0.33) + (x > 200 ? 0 : 0); R.rect(x, y - 1, 1, 4, OAK.base); R.px(x, y - 1, OAK.hi); R.px(x, y + 2, OAK.dk); }
  // the near runner, its tips curled
  for (let x = 104; x <= 216; x++) { const y = Math.round(runner(x)); R.rect(x, y - 1, 1, 3, OAK.base); R.px(x, y - 1, OAK.hi); R.px(x, y + 1, OAK.dk); }
  R.ell(104, Math.round(runner(104)) - 1, 1.6, 1.6, OAK.hi); R.ell(216, Math.round(runner(216)) - 1, 1.6, 1.6, OAK.lo);
  // the seat, a slab seen from a little above, and its cushion
  for (let y = 243; y < 252; y++) {
    const x0 = 120 + (y < 248 ? (248 - y) * 2 : 0), x1 = 194 + (y < 248 ? (248 - y) : 0);
    for (let x = x0; x < x1; x++) R.px(x, y, y < 248 ? (y === 243 ? OAK.hi : (x + y) % 9 === 0 ? OAK.lo : 0x9a6236) : y === 248 ? OAK.hi : y === 251 ? OAK.dk : OAK.base);
  }
  for (let y = 236; y < 246; y++) for (let x = 146 + (246 - y); x < 188 + Math.round((246 - y) * 0.4); x++) {
    let c = PLAID(x, y);
    if (y === 236 || x === 146 + (246 - y)) c = mixc(c, 0xffffff, 0.12);
    if (y === 245) c = mixc(c, 0x000000, 0.3);
    R.px(x, y, c);
  }
  // the near legs and back post, turned, with rings
  post(124, 251, 124, Math.round(runner(125)) - 1, 4, OAK);
  post(186, 251, 186, Math.round(runner(187)) - 1, 4, OAK);
  post(186, 252, 198, 166, 4, OAK);
  for (const y of [262, 282]) { R.rect(123, y, 6, 2, OAK.hi); R.rect(185, y, 6, 2, OAK.hi); }
  R.rect(128, 274, 58, 2, OAK.base); R.rect(128, 274, 58, 1, OAK.hi);   // the stretcher
  // the arm: a curved rest on a turned spindle, scrolled at the front
  for (let x = 120; x < 196; x++) { const y = 222 + Math.round(((x - 156) / 38) ** 2 * 2) - Math.round((x - 120) * 0.06); R.rect(x, y, 1, 3, OAK.base); R.px(x, y, OAK.hi); R.px(x, y + 3, OAK.dk); }
  R.ell(120, 223, 2.5, 2.2, OAK.hi); R.px(119, 224, OAK.base);
  post(124, 225, 124, 244, 3, OAK); for (const y of [230, 238]) R.rect(123, y, 5, 1, OAK.hi);
  for (let k = 0; k < 4; k++) { const u = (k + 1) / 5; R.line(128 + u * 56, 243, 128 + u * 56, 226 - u * 2, OAK.lo); }
  // the far arm, darker, just showing above the near one
  for (let x = 130; x < 200; x++) { const y = 217 + Math.round(((x - 166) / 38) ** 2 * 2) - Math.round((x - 130) * 0.06); R.rect(x, y, 1, 2, OAK.lo); R.px(x, y, OAK.base); }
  R.ell(130, 218, 2, 1.6, OAK.base);
  // the blanket: chunky cream knit, red stripes, a cable down it; folded over the crest and hanging
  // down the back in a point, and a corner of it over the front of the seat
  const knit = (x, y, u, v, dark) => {
    const stripe = ((v % 22) + 22) % 22, cable = Math.abs(((u % 9) + 9) % 9 - 4);
    let c = stripe < 3 ? 0xa83028 : stripe === 3 ? 0x7a2018 : 0xe8dcc0;
    if (stripe >= 4 && cable < 2) c = (v + (cable ? 1 : 0)) % 4 < 2 ? 0xf4ecd8 : 0xc8b898;
    else if (stripe >= 4 && (x + y * 2) % 4 === 0) c = 0xd2c4a6;
    R.px(x, y, dark ? mixc(c, 0x000000, 0.3) : c);
  };
  const postX = (y) => 186 + Math.round(((252 - y) * 12) / 86);
  for (let y = 172; y < 194; y++) { const x0 = postX(y) - 9; for (let x = x0; x < x0 + 7; x++) knit(x, y, x - 180, y - 160, true); }   // the inner side
  for (let y = 167; y < 172; y++) for (let x = 185 + (171 - y); x < 207 - Math.max(0, 169 - y); x++) knit(x, y, x - 185, y - 156, false);   // over the crest
  for (let y = 172; y < 230; y++) {
    const x0 = postX(y) + 1, x1 = x0 + 17 + Math.round((y - 172) * 0.07) + Math.round(Math.sin(y * 0.22) * 0.7), cut = y > 200 ? Math.round((y - 200) * 0.62) : 0;
    for (let x = x0 + cut; x < x1; x++) knit(x, y, x - x0, y - 160, x < x0 + 2);
    if (x0 + cut < x1) { R.px(x0 + cut, y, 0xa89878); R.px(x1 - 1, y, 0xb8a888); }
    if (y > 200 && y % 2 === 0 && x0 + cut < x1) R.rect(x0 + cut - 1, y + 1, 1, 2, 0xd8ccb0);
  }
  for (let x = 206; x < 212; x += 2) R.rect(x, 230, 1, 3, 0xd8ccb0);
  for (let y = 240; y < 268; y++) {
    const half = y < 248 ? 15 : Math.max(0, 15 - Math.round((y - 248) * 0.8)), cx = 144 + Math.round((y - 240) * 0.15);
    for (let x = cx - half; x < cx + half; x++) knit(x, y, x - 128, y - 236, y < 248 && x > cx + 8);
    if (half) { R.px(cx - half, y, 0xa89878); R.px(cx + half - 1, y, 0xa89878); }
    if (y > 248 && half && y % 2 === 0) { R.px(cx - half - 1, y + 1, 0xd8ccb0); R.px(cx + half, y + 1, 0xd8ccb0); }
  }
}
// the chair rocked by an angle: rolled along its runners, nearest-pixel, no new colours
function rockChair(src, a) {
  const S = new Ras(CHAIR.w, CHAIR.h, -CHAIR.x, -CHAIR.y), ca = Math.cos(a), sa = Math.sin(a), dx = -CHAIR.r * a;
  for (let y = CHAIR.y; y < CHAIR.y + CHAIR.h; y++) for (let x = CHAIR.x; x < CHAIR.x + CHAIR.w; x++) {
    const px = x - CHAIR.cx - dx, py = y - CHAIR.cy, sx = Math.round(CHAIR.cx + px * ca + py * sa), sy = Math.round(CHAIR.cy - px * sa + py * ca);
    const c = src.get(sx, sy);
    if (c >= 0) S.px(x, y, c);
  }
  return S;
}
const ROCK = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => k * 0.017);

// the mittens and a sock, drying on the line, k: their sway (-1, 0, 1)
const MITS = [[16, 0xb8302a, 0xf0e8d8], [27, 0xb8302a, 0xf0e8d8], [47, 0x8a8e96, 0xa83028, 1], [66, 0x2e4e7a, 0xd8c8a0], [78, 0x2e4e7a, 0xd8c8a0]];
const lineY = (x) => 137 + Math.round(Math.sin(((x - 2) / 96) * Math.PI) * 3);
function paintMitten(S, i, k) {
  const [x, c, trim, sock] = MITS[i], y0 = lineY(x) + 1, lo = mixc(c, 0x000000, 0.3);
  const row = (y, x0, w, col) => { const sh = Math.round(k * Math.max(0, y - y0) / 12); S.rect(x0 + sh, y, w, 1, col); };
  if (sock) {
    for (let y = y0; y < y0 + 3; y++) row(y, x - 3, 7, y === y0 ? mixc(c, 0xffffff, 0.2) : (x + y) % 2 ? c : lo);
    for (let y = y0 + 3; y < y0 + 12; y++) row(y, x - 3, 7, y === y0 + 6 ? trim : c);
    for (let y = y0 + 12; y < y0 + 16; y++) row(y, x - 3 + (y - y0 - 12), 9, y > y0 + 13 ? trim : c);
  } else {
    for (let y = y0; y < y0 + 3; y++) row(y, x - 3, 7, (x + y) % 2 ? trim : mixc(trim, 0x000000, 0.15));
    for (let y = y0 + 3; y < y0 + 13; y++) { const w = y > y0 + 10 ? 7 - (y - y0 - 10) * 2 : 7; row(y, x - 3 + (7 - w) / 2, w, y === y0 + 6 ? trim : c); }
    for (let y = y0 + 5; y < y0 + 9; y++) row(y, i % 2 ? x + 4 : x - 5, 2, lo);
    row(y0 + 6, x - 2, 1, c); row(y0 + 6, x + 2, 1, c);
  }
  S.rect(x, y0 - 2, 1, 3, 0xc8a070); S.px(x, y0 - 2, 0xe0c090);
}

// on the coat rack: a plaid wool coat, a long striped scarf, a hat with a bobble. k: the sway
const RACKBOX = { x: 404, y: 84, w: 46, h: 120 };
function paintRackThings(S, k) {
  const cx = RACK.x + 11, sh = (y, top) => Math.round(k * Math.max(0, y - top) / 40);
  for (let y = 104; y < 176; y++) {
    const hw = y < 112 ? 3 + (y - 104) : 11 + (y - 112) * 0.04, x0 = Math.round(cx - 6 - hw), x1 = Math.round(cx - 6 + hw), s2 = sh(y, 104);
    for (let x = x0; x < x1; x++) {
      let c = PLAID(x + 3, y);
      c = mixc(c, 0x3a2a4a, 0.25);
      if (x === x0 || x === x1 - 1) c = mixc(c, 0x000000, 0.35);
      if (Math.abs(x - (cx - 6)) < 1 && y > 112) c = 0x2a1a1a;
      S.px(x + s2, y, c);
    }
  }
  for (let y = 112; y < 168; y += 10) S.px(cx - 5 + sh(y, 104), y, 0xd8c8a0);
  for (let y = 100; y < 192; y++) {
    const x = cx + 4 + Math.round(Math.sin(y * 0.08) * 0.8) + sh(y, 100), st = (y - 100) % 14;
    const c = st < 3 ? 0xe8dcc0 : st < 6 ? 0x3a6a5a : 0xc8902e;
    S.rect(x, y, 5, 1, c); S.px(x + 4, y, mixc(c, 0x000000, 0.3)); S.px(x, y, mixc(c, 0xffffff, 0.2));
  }
  for (let x = 0; x < 5; x += 2) S.rect(cx + 4 + x + sh(192, 100), 192, 1, 4, 0xe8dcc0);
  for (let y = 88; y < 97; y++) { const hw = y < 90 ? 3 : 5; for (let x = cx - hw; x <= cx + hw; x++) S.px(x, y, y > 94 ? 0xe8dcc0 : (x + y) % 2 ? 0x9a2a24 : 0x7a1e1a); }
  S.ell(cx, 86, 2, 2, 0xf0e8d8);
}

// the plank door: ledges and a brace, strap hinges, a latch, a wreath; its pane left clear
function paintDoor(S) {
  const ix = DOOR.x + 4, iw = DOOR.w - 8, y0 = DOOR.y, h = FLOOR - DOOR.y;
  for (let y = y0; y < y0 + h; y++) for (let x = ix; x < ix + iw; x++) {
    if (x >= PANE.x && x < PANE.x + PANE.w && y >= PANE.y && y < PANE.y + PANE.h) continue;
    const pl = (x - ix) % 9;
    let c = pl === 0 ? 0x3a200e : pl === 1 ? 0x9a643a : (x * 3 + (y >> 2)) % 29 === 0 ? 0x5a3418 : 0x7a4a28;
    if ((y - y0 > 52 && y - y0 < 60) || (y - y0 > h - 22 && y - y0 < h - 14)) c = y - y0 === 53 || y - y0 === h - 21 ? 0xa06a3a : 0x6a3e20;
    const by = y0 + 60 + (1 - (x - ix) / iw) * (h - 82);   // the brace
    if (y - y0 > 60 && y - y0 < h - 22 && Math.abs(y - by) < 3) c = Math.abs(y - by) < 1 ? 0xa06a3a : 0x6a3e20;
    S.px(x, y, c);
  }
  S.rect(PANE.x - 2, PANE.y - 2, PANE.w + 4, 2, 0x5a3418); S.rect(PANE.x - 2, PANE.y + PANE.h, PANE.w + 4, 2, 0x5a3418);
  S.rect(PANE.x - 2, PANE.y, 2, PANE.h, 0x5a3418); S.rect(PANE.x + PANE.w, PANE.y, 2, PANE.h, 0x5a3418);
  S.rect(PANE.x + 13, PANE.y, 2, PANE.h, 0x6a3e20); S.rect(PANE.x, PANE.y + 18, PANE.w, 2, 0x6a3e20);
  for (const hy of [y0 + 56, y0 + h - 18]) { S.rect(ix, hy - 1, 24, 3, IRON.base); S.rect(ix, hy - 1, 24, 1, IRON.hi); S.ell(ix + 24, hy, 2, 2, IRON.base); for (const nx of [ix + 6, ix + 14, ix + 21]) S.px(nx, hy, IRON.hi); }
  S.rect(ix + iw - 8, y0 + 70, 6, 2, IRON.base); S.rect(ix + iw - 5, y0 + 66, 2, 10, IRON.base); S.px(ix + iw - 5, y0 + 66, IRON.hi);
  const wcx = ix + iw / 2, wcy = y0 + 70;
  for (let a = 0; a < 6.28; a += 0.18) { const x = wcx + Math.cos(a) * 7, y = wcy + Math.sin(a) * 7; S.ell(x, y, 2, 2, (a * 10 | 0) % 3 ? 0x24402a : 0x3a5a36); }
  for (const a of [0.5, 1.9, 3.3, 4.6, 5.8]) { S.px(wcx + Math.cos(a) * 7, wcy + Math.sin(a) * 7, 0xc83a34); }
  S.rect(wcx - 3, wcy + 6, 7, 3, 0xb83030); S.px(wcx, wcy + 7, 0x7a1e1e); S.line(wcx - 1, wcy + 9, wcx - 3, wcy + 13, 0xb83030); S.line(wcx + 1, wcy + 9, wcx + 3, wcy + 13, 0xb83030);
}
// the lantern's glass, plain, and lit from within (laid over the plain one while it burns)
function paintLanternGlass(R) {
  const { x, y } = LANT;
  for (let yy = y + 7; yy < y + 22; yy++) { const hw = yy < y + 10 || yy > y + 19 ? 4 : 5; for (let xx = x + 7 - hw; xx < x + 7 + hw; xx++) R.px(xx, yy, xx === x + 7 - hw + 1 ? 0xc8d4d0 : 0x6e7c7a, xx === x + 7 - hw + 1 ? 0.9 : 0.6); }
  R.rect(x + 6, y + 17, 3, 3, 0x9a8a6a); R.px(x + 7, y + 16, 0x2a2018);
}
function paintLanternLit(S) {
  const { x, y } = LANT;
  for (let yy = y + 7; yy < y + 22; yy++) {
    const hw = yy < y + 10 || yy > y + 19 ? 4 : 5;
    for (let xx = x + 7 - hw; xx < x + 7 + hw; xx++) { const d = sq(xx - (x + 7), (yy - (y + 15)) * 0.8); S.emit(xx, yy, d < 1.6 ? 0xfffbe8 : d < 3 ? 0xffe6a8 : d < 4.4 ? 0xffc870 : 0xe89a48); }
  }
  for (const gx of [x + 1, x + 12]) S.rect(gx, y + 7, 1, 15, IRON.base);
}

/* ——— outside: the mountains at night, in layers ———
   Painted once per frame shape: the sky's gradient; the land (a far range, the moonlit peak, the
   pine slopes running down to the village, the snowfield and its fence); the near pines; and the
   snow piled on the panes. Stars, aurora, moon, clouds and the animals are drawn live between. */
const hash2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const peakY = (x) => { const d = Math.abs(x - 150); return 58 + d * 0.46 + d * d * 0.0006 + Math.sin(x * 0.21) * 2.2 * Math.min(1, d / 18) + Math.sin(x * 0.53) * 0.9; };
const far2Y = (x) => 84 + Math.sin(x * 0.019 + 2) * 9 + Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 1.5;
const farY = (x) => 97 + Math.sin(x * 0.031 + 1) * 7 + Math.sin(x * 0.077) * 4 + Math.sin(x * 0.19) * 1.6;
const slopeY = (x) => Math.max(94, 128 - Math.abs(x - 132) * 0.1 + Math.sin(x * 0.07) * 3);
const fieldY = (x) => 136 + Math.sin(x * 0.045) * 2 + Math.sin(x * 0.11);
const skyY = (x) => Math.min(far2Y(x), peakY(x), farY(x), slopeY(x));
const SKY = [0x05071a, 0x080b22, 0x0b102a, 0x0f1634, 0x141c3e, 0x1a2448, 0x212c52, 0x2a355c, 0x334066];
const PEAKL = [0xdae2f4, 0xc0cce8, 0xa4b2d8, 0x8a9aca], PEAKS = [0x6474a8, 0x56669a, 0x4a5a8c, 0x404e80];
const LITC = [0xffc870, 0xffb45a, 0xffd890, 0xf0a050, 0xffe0a0];

function* buildOutside(P) {
  const { rw, ox, L, RT } = P, O = { lights: [], stars: [] }, r = rng(97);
  { const R = new Ras(64, H); R.vgrad(0, 0, 64, 120, SKY, 0.95); R.rect(0, 120, 64, H - 120, SKY[SKY.length - 1]); O.sky = R.canvas(); }
  const R = new Ras(rw, H, ox, 0);
  // the farthest range, pale with distance
  for (let x = L; x < RT; x++) {
    const t = Math.round(far2Y(x)), lit = far2Y(x + 1) > far2Y(x);
    for (let y = t; y < 150; y++) R.px(x, y, y < t + 2 && lit ? 0x6a7aac : y < t + 1 ? 0x56669a : (y + x) % 7 === 0 && y < t + 9 ? 0x46548a : 0x3a4878);
  }
  yield;
  // the peak: a spine running down from the summit, the moon side lit, gullies and rock bands
  for (let x = L; x < RT; x++) {
    const t = Math.round(peakY(x));
    if (t > 150) continue;
    for (let y = t; y < 150; y++) {
      const sx = 150 + (y - 58) * 0.18 + Math.sin((y - 58) * 0.09) * 4, litSide = x > sx;
      const f = Math.sin((x - sx) * 0.22 - (y - 58) * 0.25 * (litSide ? 1 : -1));
      let lv = cl((y - 58) / 58) * 3;
      lv = Math.min(3, band(lv, x, y));
      let c = litSide ? (f < -0.82 ? PEAKS[Math.min(3, lv)] : PEAKL[lv]) : (f > 0.86 ? PEAKL[Math.min(3, lv + 1)] : PEAKS[lv]);
      if (y - t < 1) c = litSide ? 0xeef2fa : 0x7a8abc;
      // rock showing through in streaks down the fall line, mostly high up
      const n = noise2((x - sx) * 0.42 + y * 0.04, y * 0.075), hi = cl((100 - y) / 30);
      if (n > 0.8 - hi * 0.06 && y - t > 3 && y < 100) c = litSide ? 0x3a4268 : 0x1c2140;
      else if (n > 0.76 - hi * 0.06 && y - t > 3 && y < 100) c = litSide ? 0x7a88b8 : 0x2e3866;
      R.px(x, y, c);
    }
  }
  yield;
  // the nearer range
  for (let x = L; x < RT; x++) {
    const t = Math.round(farY(x)), lit = farY(x + 1) > farY(x) + 0.1;
    for (let y = t; y < 150; y++) {
      let c = 0x2a3664;
      if (y < t + 2) c = lit ? 0x7484b4 : 0x46568a;
      else if (lit && y < t + 6 && bay(x, y) < 0.5 - (y - t) * 0.08) c = 0x52629a;
      else if ((x * 3 + y * 5) % 23 === 0) c = 0x24305a;
      R.px(x, y, c);
    }
  }
  yield;
  // the pine slopes down to the valley, thick with trees except where the village sits
  for (let x = L; x < RT; x++) { const t = Math.round(slopeY(x)); for (let y = t; y < 150; y++) R.px(x, y, y === t ? 0x5a6a9e : (x + y * 2) % 9 === 0 ? 0x34427a : 0x3a4878); }
  const pine = (x, base, h, dark, hi, snow) => {
    for (let y = 0; y < h; y++) {
      const hw = Math.floor((y / h) * (h / 2.6)) + (y % 4 === 3 ? 1 : 0);
      for (let k = -hw; k <= hw; k++) R.px(x + k, base - h + y, k === hw && y % 4 < 3 ? hi : y % 4 === 0 && k < 0 && bay(x + k, y) < 0.6 ? snow : dark);
    }
    R.px(x, base, dark);
  };
  for (let row = 0; row < 3; row++) for (let x = L + Math.floor(r() * 4); x < RT; x += 3 + Math.floor(r() * 3)) {
    const t = slopeY(x), base = Math.round(t + 3 + row * 5 + r() * 3);
    if (x > 104 && x < 162 && base > 119) continue;
    if (base > 146) continue;
    pine(x, base, 6 + Math.floor(r() * 7) + (row === 2 ? 3 : 0), row === 2 ? 0x0a1028 : 0x0e1632, row === 2 ? 0x2a3a6a : 0x24345e, 0x7888ba);
  }
  yield;
  // the village in the valley: snowy roofs, lit windows, a church; farm lights up the slopes
  const lit = (x, y) => { const c = LITC[Math.floor(r() * LITC.length)]; R.px(x, y, c); O.lights.push({ x, y, c, p: r() * 6.3, sp: 0.4 + r() * 1.4 }); };
  for (const [hx, hb, w] of [[112, 129, 6], [119, 127, 5], [126, 130, 7], [135, 128, 5], [141, 131, 6], [153, 128, 5], [158, 130, 4], [108, 132, 4]]) {
    R.rect(hx, hb - 4, w, 4, 0x1c2038);
    for (let k = 0; k <= Math.ceil(w / 2); k++) R.rect(hx - 1 + k, hb - 5 - k, w + 2 - k * 2, 1, k === 0 ? 0xa8b8dc : 0x8a9ac8);
    lit(hx + 1 + Math.floor(r() * (w - 2)), hb - 2); if (w > 5 && r() < 0.6) lit(hx + w - 2, hb - 2);
    if (r() < 0.6) R.rect(hx + w - 2, hb - 7 - Math.ceil(w / 2) + 2, 1, 2, 0x1c2038);
  }
  R.rect(146, 117, 4, 13, 0x1c2038); for (let k = 0; k < 8; k++) R.rect(147 - Math.floor((7 - k) / 4) + 1, 109 + k, 1 + Math.floor((7 - k) / 4) * 2 - 1, 1, 0x8a9ac8); R.px(147, 121, 0xffe0a0); O.lights.push({ x: 147, y: 121, c: 0xffe0a0, p: 1, sp: 0.2 });
  for (let k = 0; k < 16; k++) { const x = L + Math.floor(r() * (RT - L)); if (x > 104 && x < 162) continue; const y = Math.round(slopeY(x) + 4 + r() * 12); if (y < 146) lit(x, y); }
  yield;
  // the snowfield, drifted, a split-rail fence across it
  for (let x = L; x < RT; x++) {
    const t = Math.round(fieldY(x));
    for (let y = t; y < H; y++) {
      const dr = Math.sin(x * 0.06 + y * 0.5 + Math.sin(x * 0.02) * 2), dist = cl((y - t) / 60);
      let c = dist < 0.15 ? 0x7a8ab8 : dist < 0.5 ? 0x8a9ac6 : 0x98a8d2;
      if (dr > 0.82) c = dist < 0.15 ? 0x9aaad4 : 0xb8c6e6; else if (dr < -0.86) c = 0x6a7aac;
      if (y === t) c = 0xa8b8dc;
      R.px(x, y, c);
    }
  }
  for (let x = L - ((L % 22) + 22) % 22; x < RT; x += 22) {
    if (x > 180 && x < 300) continue;
    const t = Math.round(fieldY(x)) + 6;
    R.rect(x, t - 9, 2, 10, 0x2a2438); R.px(x, t - 10, 0xd8e0f4); R.px(x + 1, t - 10, 0xd8e0f4);
    for (const ry of [t - 7, t - 3]) for (let k = 2; k < 22; k++) { const yy = ry + Math.round(Math.sin((k / 22) * Math.PI) * 1); R.px(x + k, yy, 0x3a3048); if (ry === t - 7 && k % 3) R.px(x + k, yy - 1, 0xc8d4ee); }
  }
  O.land = R.canvas();
  yield;
  // the near pines: one beside the big window (its long branch is the owl's), one by the
  // bunk's window, one past the door
  const N = new Ras(rw, H, ox, 0);
  const near = (cx, top, bottom, spread) => {
    N.rect(cx - 1, top, 3, bottom - top, 0x0c0c1a); N.rect(cx + 1, top, 1, bottom - top, 0x1e1e34);
    for (let k = 0; top + 4 + k * 12 < bottom - 8; k++) {
      const y0 = top + 4 + k * 12, hw = 5 + k * spread;
      for (let y = 0; y < 11; y++) {
        const w = Math.round(hw * (0.35 + 0.65 * (y / 10))), droop = Math.round((y / 10) * 2);
        for (let u = -w; u <= w; u++) {
          const yy = y0 + y + Math.round((Math.abs(u) / hw) ** 2 * 3) + droop - 2, edge = Math.abs(u) > w - 2;
          let c = (u + yy) % 5 === 0 ? 0x16224a : 0x0a1226;
          if (y < 2 || (y < 4 && bay(cx + u, yy) < 0.5)) c = u > 0 ? 0xc8d4ee : 0x9aaad0;
          if (edge && y > 6) c = 0x0e1834;
          N.px(cx + u, yy, c);
        }
      }
    }
  };
  near(213, 28, 152, 2.4);
  for (let x = 190; x < 212; x++) { const y = 93 + Math.round(((212 - x) / 22) ** 2 * 3); N.rect(x, y, 1, 2, 0x16121e); N.px(x, y - 1, 0xc8d4ee); if (x % 5 === 0) N.line(x, y + 1, x - 2, y + 4, 0x0a1226); }
  O.branch = { x: 196, y: 92 };
  if (P.left) near(-90, 44, 140, 2);
  if (P.right) near(398, 96, 240, 3.2);
  // snow piled on the panes, deepest in the corners
  const pile = (x0, y1, w, deep) => {
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - x0) / (w - 1), corner = Math.max(0, 1 - Math.min(u, 1 - u) * 6), h = Math.max(0, Math.round(deep * (0.45 + corner * 0.9) + (Math.sin(x * 0.7) * 0.6 + noise2(x * 0.3, deep) * 1.4 - 0.5) * Math.min(1, deep / 2)));
      for (let y = y1 - h; y < y1; y++) N.px(x, y, y === y1 - h ? 0xf4f8ff : y === y1 - h + 1 ? 0xdce4f4 : 0xb8c6e2);
    }
  };
  for (const [cx, cw] of COLS) for (const [ry, rh] of ROWS) pile(GX + cx, GY + ry + rh, cw, ry > 60 ? 3.6 : 0.7);
  if (P.left) for (const cx of [0, 29]) for (const ry of [0, 39]) pile(W2.x + cx, W2.y + ry + 37, 27, ry ? 3.4 : 0.7);
  O.near = N.canvas();
  // clouds for the snowy nights, a tile that drifts; and a haze for heavy snow
  { const W = 512, h = 120, m = new Float32Array(W * h), C = new Ras(W, h), cr = rng(41);
    for (let i = 0; i < 30; i++) {
      const cx = cr() * W, cy = 8 + cr() * 80, rad = 10 + cr() * 20, st = 1.6 + cr() * 1.4;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad * st); x <= cx + rad * st; x++) {
        if (y < 0 || y >= h) continue;
        const d = sq((x - cx) / st, y - cy) / rad;
        if (d < 1) m[y * W + (((x % W) + W) % W)] += (1 - d) * 0.75;
      }
    }
    const CC = [0x161c3a, 0x1e2546, 0x283052, 0x343c60, 0x444c72];
    for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
      const v = m[y * W + x];
      if (v < 0.22 || (v < 0.45 && bay(x, y) > (v - 0.22) / 0.23)) continue;
      const under = y < h - 1 && m[(y + 1) * W + x] < 0.26, t = cl(0.9 - Math.min(v, 1.4) * 0.5 + y / h * 0.3), i0 = Math.min(3, Math.floor(t * 3.99));
      C.px(x, y, under ? CC[4] : CC[i0]);
    }
    O.clouds = C.canvas(); O.cloudW = W; }
  { const Z = new Ras(rw, H);
    // flat veils of falling snow, thicker towards the mountains, in a few steps
    for (let y = 24; y < 240; y++) { const lvl = y < 56 ? (y - 24) / 32 * 0.3 : y < 128 ? 0.3 + (y - 56) / 72 * 0.25 : 0.55 - (y - 128) / 112 * 0.35; for (let x = 0; x < rw; x++) { const q = band(lvl * 5, x, y) / 5; if (q > 0) Z.px(x, y, 0x56628e, q); } }
    O.haze = Z.canvas(); }
  // the stars, only where there is sky
  for (let i = 0; i < Math.round(rw * 0.32); i++) {
    const X = Math.floor(r() * rw), x = X - ox, y = Math.floor(r() * 100);
    if (y < skyY(x) - 2) O.stars.push({ x: X, y, p: r() * 6.3, sp: 0.4 + r() * 1.6, big: r() < 0.08 });
  }
  return O;
}

/* ——— the animals outside, in moonlight colours ——— */
function flipCanvas(c) { const f = mk(c.width, c.height), g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return f; }
const FOXC = { body: 0x8a5440, dk: 0x5a3428, hi: 0xb07454, wh: 0xd8dcec, leg: 0x1a1620 };
// a fox trotting to the right, 26×12, its feet on the bottom row. f: the stride (0–3)
function foxFrame(f) {
  const R = new Ras(26, 12), o = f % 2 ? 0 : 1;
  R.ell(5, 5 - o * 0.5, 4, 2, FOXC.body); R.ell(2, 5 - o * 0.5, 2.5, 1.6, FOXC.hi); R.px(0, 5 - o, FOXC.wh); R.px(1, 5 - o, FOXC.wh);
  R.ell(13, 6 - o, 6, 2.4, FOXC.body); R.rect(9, 4 - o, 8, 1, FOXC.hi); R.rect(10, 8 - o, 7, 1, FOXC.dk);
  R.ell(20, 4 - o, 2.6, 2, FOXC.body); R.rect(21, 5 - o, 3, 1, FOXC.body); R.px(24, 5 - o, FOXC.leg); R.rect(20, 6 - o, 3, 1, FOXC.wh);
  R.px(19, 1 - o, FOXC.dk); R.px(19, 2 - o, FOXC.body); R.px(21, 1 - o, FOXC.dk); R.px(21, 2 - o, FOXC.body); R.px(21, 3 - o, 0x101018);
  const legs = [[[9, -1], [11, 1], [16, 1], [18, -1]], [[10, 0], [10, 0], [17, 0], [17, 0]], [[11, 1], [9, -1], [18, -1], [16, 1]], [[10, 0], [10, 0], [17, 0], [17, 0]]][f];
  for (const [lx, sw] of legs) { R.line(lx, 9 - o, lx + sw, 11, FOXC.leg); }
  R.px(16, 7 - o, FOXC.wh);
  return R.canvas();
}
const DEERC = { body: 0x6e5e5c, dk: 0x48403e, hi: 0x928482, belly: 0xa89c98, wh: 0xdcdcea, leg: 0x2a2428, ant: 0xb8aca0 };
// a deer walking to the right, 26×22. f: the stride (0–3), or 4: head down, nibbling at the snow
function deerFrame(f) {
  const R = new Ras(26, 22), graze = f === 4;
  R.ell(10, 10, 7, 3.4, DEERC.body); R.rect(5, 8, 11, 1, DEERC.hi); R.rect(6, 13, 9, 1, DEERC.belly); R.ell(3, 9, 2, 2, DEERC.wh); R.px(2, 8, DEERC.dk);
  if (graze) { R.line(15, 9, 19, 15, DEERC.body); R.line(16, 9, 20, 15, DEERC.body); R.ell(21, 17, 2.4, 1.6, DEERC.body); R.px(23, 18, DEERC.leg); R.px(19, 13, DEERC.dk); R.px(21, 14, DEERC.dk); }
  else {
    R.line(15, 8, 18, 3, DEERC.body); R.line(16, 9, 19, 4, DEERC.body); R.line(17, 9, 19, 5, DEERC.hi);
    R.ell(20, 3, 2.6, 1.8, DEERC.body); R.rect(21, 4, 3, 1, DEERC.body); R.px(24, 4, DEERC.leg); R.px(20, 2, 0x101018);
    R.px(18, 1, DEERC.dk); R.px(17, 0, DEERC.dk); R.px(21, 1, DEERC.dk);
    R.line(19, 1, 18, -2, DEERC.ant); R.line(20, 1, 22, -2, DEERC.ant);
  }
  const st = [[[5, -1], [7, 1], [14, 1], [16, -1]], [[6, 0], [6, 0], [15, 0], [15, 0]], [[7, 1], [5, -1], [16, -1], [14, 1]], [[6, 0], [6, 0], [15, 0], [15, 0]], [[5, 0], [7, 0], [14, 0], [16, 0]]][f];
  for (const [lx, sw] of st) { R.line(lx, 13, lx + sw, 21, DEERC.leg); R.px(lx, 13, DEERC.dk); }
  return R.canvas();
}
const OWLC = { body: 0x52463e, dk: 0x2e2622, chest: 0x8e8070, disc: 0xa89a86, eye: 0xffc040, rim: 0xb8b8d0 };
// the owl, 22×14. f: 0 sitting, 1 blinking, 2 head turned, 3 wings up, 4 wings down
function owlFrame(f) {
  const R = new Ras(22, 14), cx = 11;
  if (f >= 3) {
    const up = f === 3;
    for (let k = 0; k < 10; k++) { const y = up ? 4 - Math.round(Math.sin((k / 10) * Math.PI) * 3) - Math.floor(k / 4) : 6 + Math.floor(k / 3); R.rect(cx - 2 - k, y, 1, 2, k > 7 ? OWLC.dk : OWLC.body); R.rect(cx + 2 + k, y, 1, 2, k > 7 ? OWLC.dk : OWLC.body); }
    R.ell(cx, 6, 2.5, 3, OWLC.body); R.ell(cx, 5, 2, 2, OWLC.disc); R.px(cx - 1, 5, OWLC.eye); R.px(cx + 1, 5, OWLC.eye);
    return R.canvas();
  }
  R.ell(cx, 8, 4, 4.5, OWLC.body); R.ell(cx, 9, 2.2, 3, OWLC.chest);
  for (let y = 5; y < 12; y++) { R.px(cx - 4 + (y > 9 ? 1 : 0), y, OWLC.dk); R.px(cx + 4 - (y > 9 ? 1 : 0), y, OWLC.rim); }
  for (const [x, y] of [[cx - 1, 8], [cx + 1, 10], [cx, 11], [cx - 1, 10], [cx + 1, 7]]) R.px(x, y, OWLC.dk);
  R.rect(cx - 3, 12, 7, 1, OWLC.dk);
  const t = f === 2 ? 1 : 0;
  R.ell(cx + t, 3, 3, 2.5, OWLC.body); R.ell(cx + t, 3.5, 2.4, 1.8, OWLC.disc);
  R.px(cx - 3 + t, 0, OWLC.dk); R.px(cx + 3 + t, 0, OWLC.dk); R.px(cx - 2 + t, 1, OWLC.body); R.px(cx + 2 + t, 1, OWLC.body);
  if (f === 1) { R.px(cx - 1 + t, 3, OWLC.dk); R.px(cx + 1 + t, 3, OWLC.dk); }
  else { R.emit(cx - 1 + t, 3, OWLC.eye); R.emit(cx + 1 + t, 3, OWLC.eye); }
  R.px(cx + t, 4, 0x8a7a50);
  R.px(cx - 1, 13, 0x4a4030); R.px(cx + 1, 13, 0x4a4030);
  return R.canvas();
}

/* ——— glows, the moon, the frost: the cached bits of the moving picture ——— */
let FX = null;
function fx() {
  if (FX) return FX;
  FX = {
    room: glow(160, 80, 0xff9a40, 0.32, 5), hearth: glow(76, 20, 0xffa850, 0.5, 5), box: glow(30, 26, 0xffb050, 0.75, 5),
    candle: glow(24, 16, 0xffc070, 0.5, 4), halo: glow(6, 7, 0xffd890, 0.85, 3), lant: glow(44, 36, 0xffc878, 0.42, 5), lantHalo: glow(12, 12, 0xffe0a0, 0.7, 4),
    lamp: glow(34, 28, 0xffd090, 0.4, 4), moon: glow(26, 26, 0xb8c8f0, 0.5, 4), snowlit: glow(80, 56, 0x8aa0e0, 0.18, 4), ember: glow(3, 3, 0xff8030, 0.9, 2),
    eye: glow(2, 2, 0xffc040, 0.7, 2), kettle: glow(8, 6, 0xffb060, 0.6, 3), village: glow(3, 2, 0xffc070, 0.8, 2),
    steam: Array.from({ length: 9 }, (_, k) => rgba(0xf4f0ea, k * 0.065)),
    fox: [0, 1, 2, 3].map(foxFrame), deer: [0, 1, 2, 3, 4].map(deerFrame), owl: [0, 1, 2, 3, 4].map(owlFrame),
  };
  FX.foxL = FX.fox.map(flipCanvas); FX.deerL = FX.deer.map(flipCanvas); FX.owlL = FX.owl.map(flipCanvas);
  const M = new Ras(13, 13);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { const d = sq(x - 6, y - 6); if (d <= 6.2) M.px(x, y, (x - 6) * -0.7 + (y - 6) * 0.7 > 3 + bay(x, y) * 2 ? 0xd4d8e8 : 0xf6f4ec); }
  for (const [x, y] of [[4, 4], [5, 5], [8, 7], [3, 7], [7, 3]]) M.px(x, y, 0xc8ccdc);
  FX.moonImg = M.canvas();
  // a wipe: a hand's width, soft at its ends
  const Wp = new Ras(30, 15);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 30; x++) { const v = Math.min(1, Math.min(x, 29 - x) / 7) * (1 - Math.abs(y - 7) / 7.5) * 1.7; if (v > 0 && bay(x, y) < v) Wp.px(x, y, 0x000000); }
  FX.wipe = Wp.canvas();
  return FX;
}
// frost on a window: feathered crystals growing out of each pane's corners, thick along the sill
const FROSTS = new Map();
function frostFor(key, w, h, panes, heavy) {
  if (FROSTS.has(key)) return FROSTS.get(key);
  const acc = new Float32Array(w * h), r = rng(key.length * 131 + w);
  const add = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) acc[y * w + x] = Math.max(acc[y * w + x], v); };
  for (const p of panes) {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      const cd = Math.min(sq(x - p.x, y - p.y), sq(p.x + p.w - 1 - x, y - p.y), sq(x - p.x, p.y + p.h - 1 - y), sq(p.x + p.w - 1 - x, p.y + p.h - 1 - y));
      const ed = Math.min(x - p.x, p.x + p.w - 1 - x, y - p.y, p.y + p.h - 1 - y), bot = (y - (p.y + p.h - 9)) / 9;
      add(x, y, Math.max(1 - cd / (heavy ? 22 : 10), 1 - ed / 1.8, bot * 0.7, heavy ? 0.55 + noise2(x * 0.2, y * 0.2) * 0.35 : 0));
    }
    // the fronds: little branching walks from each corner
    for (const [cx, cy, sx, sy] of [[p.x, p.y, 1, 1], [p.x + p.w - 1, p.y, -1, 1], [p.x, p.y + p.h - 1, 1, -1], [p.x + p.w - 1, p.y + p.h - 1, -1, -1]]) {
      for (let n = 0; n < (heavy ? 7 : 4); n++) {
        let x = cx, y = cy, a = Math.atan2(sy, sx) + (r() - 0.5) * 1.4;
        const len = (heavy ? 10 : 5) + r() * (heavy ? 12 : 9);
        for (let k = 0; k < len; k++) {
          x += Math.cos(a); y += Math.sin(a); a += (r() - 0.5) * 0.5;
          if (x < p.x || y < p.y || x >= p.x + p.w || y >= p.y + p.h) break;
          add(x, y, 0.85 - k / len * 0.5);
          if (k % 3 === 2) for (const s of [-1, 1]) for (let j = 1; j < 3; j++) add(x + Math.cos(a + s * 0.8) * j, y + Math.sin(a + s * 0.8) * j, 0.6 - j * 0.12);
        }
      }
    }
  }
  const F = new Ras(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = band(cl(acc[y * w + x]) * 3, x, y);
    if (q > 0) F.px(x, y, 0xe2ecfa, [0, 0.2, 0.36, 0.55][Math.min(3, q)]);
  }
  const cv = F.canvas();
  FROSTS.set(key, cv);
  return cv;
}
const mainPanes = () => { const out = []; for (const [cx, cw] of COLS) for (const [ry, rh] of ROWS) out.push({ x: cx, y: ry, w: cw, h: rh }); return out; };
const w2Panes = () => [{ x: 0, y: 0, w: 27, h: 37 }, { x: 29, y: 0, w: 27, h: 37 }, { x: 0, y: 39, w: 27, h: 37 }, { x: 29, y: 39, w: 27, h: 37 }];

/* ——— building the cabin for one width: in steps, so it can be spread over a few frames ——— */
const ROOMS = new Map();
function sprite(x0, y0, w, h, paint) { return { x0, y0, w, h, paint, ras: null, img: [] }; }
function spriteImg(RM, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = bakeOne(sp.ras, sp.x0 + RM.ox, sp.y0, RM.F, k);
    if (sp.img[0] && sp.img[1] && sp.img[2] && sp.img[3]) sp.ras = null;
  }
  return sp.img[k];
}
const roomW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);

function* buildRoom(rw) {
  const P = plan(rw), ox = P.ox;
  const back = new Ras(rw, H, ox, 0);
  paintShell(back, P); yield;
  paintFireplace(back); yield;
  const main = { x: GX, y: GY, w: GW, h: GH };
  paintCurtains(back, main); paintWindowFrame(back, main, COLS, ROWS); paintSillThings(back);
  paintRightWall(back); paintLanternGlass(back);
  if (P.left) { paintCurtains(back, W2); paintWindowFrame(back, W2, [[0, 27], [29, 27]], [[0, 37], [39, 37]]); paintBunk(back); }
  if (P.corner) paintCorner(back);
  if (P.right) { paintWoodpile(back); paintDoorway(back); paintRackPole(back); paintSconce(back); }
  if (P.far) paintFarRight(back);
  yield;
  paintRug(back); paintBasket(back); paintTable(back);
  yield;
  const n = rw * H, F = { rw, C: new Float32Array(n), W: new Float32Array(n), L: new Float32Array(n), K: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) { const cx = X - ox, j = y * rw + X; F.C[j] = coolAt(cx, y, P); F.W[j] = fireAt(cx, y); F.L[j] = lantAt(cx, y); F.K[j] = steadyAt(cx, y, P); }
    if (y % 40 === 39) yield;
  }
  const chairSrc = new Ras(CHAIR.w, CHAIR.h, -CHAIR.x, -CHAIR.y);
  paintChair(chairSrc);
  const RM = {
    rw, ox, P, F,
    back: { x0: -ox, y0: 0, w: rw, h: H, ras: back, img: [] },
    dog: DOGPOSE.map((p) => sprite(DOG.x, DOG.y, DOG.w, DOG.h, (S) => paintDog(S, p))),
    chair: ROCK.map((a) => sprite(CHAIR.x, CHAIR.y, CHAIR.w, CHAIR.h, (S) => { S.d.set(rockChair(chairSrc, a).d); })),
    mits: MITS.map(([x], i) => [-1, 0, 1].map((k) => sprite(x - 9, lineY(x) - 2, 20, 22, (S) => paintMitten(S, i, k)))),
    lantLit: sprite(LANT.x, LANT.y + 6, 14, 17, paintLanternLit),
    rack: P.right ? [-1, 0, 1].map((k) => sprite(RACKBOX.x, RACKBOX.y, RACKBOX.w, RACKBOX.h, (S) => paintRackThings(S, k))) : null,
    door: P.right ? sprite(DOOR.x + 4, DOOR.y, DOOR.w - 8, FLOOR - DOOR.y, paintDoor) : null,
  };
  for (let k = 0; k < 4; k++) { spriteImg(RM, RM.back, k); yield; }
  const small = [...RM.dog, ...RM.mits.flat(), RM.lantLit, ...(RM.rack || []), ...(RM.door ? [RM.door] : [])];
  for (let k = 0; k < 4; k++) { for (const sp of small) spriteImg(RM, sp, k); yield; }
  for (const sp of RM.chair) { for (let k = 0; k < 4; k++) spriteImg(RM, sp, k); yield; }
  RM.O = yield* buildOutside(P);
  RM.frost = [frostFor('main', GW, GH, mainPanes(), false)];
  if (P.left) RM.frost.push(frostFor('w2', W2.w, W2.h, w2Panes(), false));
  if (P.right) RM.frost.push(frostFor('door', PANE.w, PANE.h, [{ x: 0, y: 0, w: PANE.w, h: PANE.h }], true));
  ROOMS.set(rw, RM);
  while (ROOMS.size > 3) ROOMS.delete(ROOMS.keys().next().value);
  return RM;
}
function finishJob(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value; if (performance.now() > end) return null; }
}
const roomFor = (rw) => ROOMS.get(rw) || finishJob(buildRoom(rw));

/* ——— state ——— */
const WXAMT = {   // what each weather asks of the sky: clouds, snow, haze, stars, aurora, wind
  clear: { cloud: 0.08, snow: 0.12, haze: 0, stars: 1, aurora: 1, wind: 0.45 },
  snow: { cloud: 0.7, snow: 0.55, haze: 0.12, stars: 0.12, aurora: 0, wind: 0.8 },
  storm: { cloud: 1, snow: 1, haze: 0.62, stars: 0, aurora: 0, wind: 1.3 },
};
const PAGES = ['A page turns: the hut above the treeline', 'A page turns: snow on the pass, a lantern in the dark', 'The next chapter: the long winter', 'A page turns: wolves far off, and a warm kitchen'];
const MUG_LINES = ['A sip of cocoa, rich and sweet', 'Warm hands round the mug', 'A marshmallow, melting', 'The last sip, still warm'];
const LOGS0 = [[29, 209, 69, 208, 3.6], [33, 215, 56, 205, 3], [45, 206, 69, 214, 3]];
function newLog([x0, y0, x1, y1, r]) { return { x0, y0, x1, y1, r, dy: 0, fall: 0, vy: 0 }; }
function makeState(seed) {
  const r = rng(seed);
  return {
    r, t: 0, wx: 1, wxPrev: 1, amt: { ...WXAMT.snow },
    windBase: -8, wind: -8, cloudX: 0, gust: 0, gustT: 0, gustLen: 0, gustK: 0, gustWait: 6 + r() * 6,
    flakes: Array.from({ length: 1100 }, () => ({ x: r() * 900, y: r() * 250, z: Math.min(3, Math.floor(r() * r() * 4.6)), ph: r() * 6.3, s: r(), k: r() })),
    fire: { fuel: 1, flare: 0, fi: 0.7, acc: 0, grid: new Uint8Array(FG.w * FG.h), logs: LOGS0.map(newLog), dirty: true, settle: 14 + r() * 14, sparks: [], embers: Array.from({ length: 46 }, () => ({ x: 30 + r() * 40, y: 213 + Math.floor(r() * 7), p: r() * 6.3, sp: 1 + r() * 3 })) },
    kettle: { t: 0, steam: [] }, cocoa: 1, sip: 0, steam: [], steamT: 0, steamBoost: 0, gutter: 0,
    lantOn: true, lant: 1, page: 0, pageN: 0,
    dog: { seq: [], st: 0, f: 0, bph: 0 }, chair: { a: 0, v: 0, lastSign: 0 }, mits: 0.25, rack: { a: 0, v: 0 },
    door: { open: 0, hold: 0 }, glass: [], animal: null, animalWait: 10 + r() * 10, owl: null, owlWait: 30 + r() * 30,
    shoot: null, shootWait: 12 + r() * 20, later: [],
  };
}
function glassState(s, i, RM) {
  if (!s.glass[i]) {
    const src = RM.frost[i], fog = mk(src.width, src.height), fg = fog.getContext('2d');
    fg.drawImage(src, 0, 0);
    s.glass[i] = { fog, fg, wipes: [], dirty: false, src };
  }
  return s.glass[i];
}

/* ——— the fire: a little heat field that rises and cools, fed along the logs ——— */
const FIREPAL = [0, 0x5a1206, 0x8a2008, 0xb8360c, 0xe05412, 0xf47a1a, 0xfca42c, 0xffcc50, 0xffe896, 0xfffae0];
const FIREA = [0, 0.5, 0.85, 1, 1, 1, 1, 1, 1, 1];
function stepFire(F, t) {
  const W = FG.w, Hh = FG.h, g = F.grid, fuel = F.fuel, boost = 0.55 + fuel * 0.45 + F.flare * 0.9;
  // the source: hot where the logs are, in clumps that wander
  for (let x = 0; x < W; x++) {
    const bx = FG.x + x, onLog = F.logs.some((l) => bx >= Math.min(l.x0, l.x1) + 2 && bx <= Math.max(l.x0, l.x1) - 2);
    const clump = noise1(x * 0.35 + t * 2.3) * 0.7 + noise1(x * 0.9 - t * 3.7 + 9) * 0.3;
    const v = onLog ? 36 * Math.min(1, (0.35 + clump * 0.8) * Math.min(1.15, boost)) : 0;
    g[(Hh - 1) * W + x] = v; g[(Hh - 2) * W + x] = Math.max(g[(Hh - 2) * W + x], v * 0.9);
  }
  const dmax = 2.25 / boost;
  for (let y = 0; y < Hh - 2; y++) for (let x = 0; x < W; x++) {
    const src = g[(y + 1) * W + x], j = Math.floor(Math.random() * 3);
    const dx = Math.min(W - 1, Math.max(0, x + j - 1));
    g[y * W + dx] = Math.max(0, src - Math.floor(Math.random() * dmax) - (src < 12 && Math.random() < 0.3 ? 1 : 0));
  }
}
function renderFire(F, img) {
  const d = img.data, g = F.grid, W = FG.w;
  for (let i = 0; i < g.length; i++) {
    const x = i % W, h = (g[i] * 4 + (x > 0 ? g[i - 1] : 0) + (x < W - 1 ? g[i + 1] : 0) + (i >= W ? g[i - W] : 0) + (i + W < g.length ? g[i + W] : g[i])) / 8;
    const k = Math.min(9, Math.floor(h / 3.7)), o = i * 4;
    if (!k) { d[o + 3] = 0; continue; }
    const c = FIREPAL[k]; d[o] = c >> 16; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = FIREA[k] * 255;
  }
}

/* ——— each frame ——— */
function update(s, dt, RM, io) {
  s.t += dt;
  const t = s.t, r = Math.random, P = RM.P, ease = (k) => Math.min(1, dt * k);
  for (let i = s.later.length - 1; i >= 0; i--) if (s.later[i].at <= t) { const f = s.later[i].fn; s.later.splice(i, 1); f(); }
  // the weather eases towards what it asks for
  const want = WXAMT[WXS[s.wx]];
  for (const k in want) s.amt[k] += (want[k] - s.amt[k]) * ease(0.6);
  // the wind: a slow drift, and gusts that come and go, stronger in a storm
  s.windBase = -(4 + noise1(t * 0.05) * 10) * s.amt.wind;
  if (s.gustT > 0) {
    s.gustT += dt;
    const u = s.gustT / s.gustLen;
    s.gust = (u < 0.25 ? sm(u / 0.25) : u < 0.55 ? 1 : 1 - sm((u - 0.55) / 0.45)) * s.gustK;
    if (u >= 1) { s.gustT = 0; s.gust = 0; s.gustWait = (s.wx === 2 ? 5 : s.wx === 1 ? 11 : 20) + r() * (s.wx === 2 ? 8 : 16); }
  } else if ((s.gustWait -= dt) <= 0) { s.gustT = 0.001; s.gustLen = 4 + r() * 3; s.gustK = (0.6 + r() * 0.4) * Math.min(1.2, 0.5 + s.amt.wind * 0.6); if (s.gustK > 0.55) io.gust(); }
  const doorWind = s.door.open * 0.8;
  s.wind = s.windBase - (s.gust + doorWind) * 62;
  s.cloudX -= (s.wind * 0.12 - 1.2) * dt;
  io.weather(s);
  // the snow, at four depths, curling in the gusts
  const bw = RM.rw;
  for (const f of s.flakes) {
    const zf = [0.4, 0.6, 0.85, 1.15][f.z], fall = [9, 15, 24, 36][f.z] * (0.75 + f.s * 0.5) * (1 + s.gust * 0.3);
    const swirl = Math.sin(f.y * 0.07 + t * 2.1 + f.ph) * (6 + (s.gust + doorWind) * 34) + Math.sin(t * 0.7 + f.ph) * 3;
    f.x += (s.wind * zf + swirl * zf) * dt; f.y += (fall + Math.cos(f.y * 0.05 + t * 1.7 + f.ph) * (s.gust * 14)) * dt;
    if (f.y > 246) { f.y = -4 - r() * 10; f.x = r() * (bw + 60) - 30; }
    if (f.x < -30) f.x += bw + 60; else if (f.x > bw + 30) f.x -= bw + 60;
  }
  // the fire: it burns down slowly; the flare after a poke dies away; now and then a log settles
  const F = s.fire;
  F.fuel = Math.max(0.32, F.fuel - dt / 260);
  F.flare = Math.max(0, F.flare - dt * 0.45);
  const base = cl((F.fuel - 0.25) / 0.85), flick = (noise1(t * 3.1) * 0.6 + noise1(t * 7.3 + 5) * 0.4 - 0.5) * 0.55;
  F.fi = cl(base * 0.82 + flick + F.flare * 0.55 + (s.gust + doorWind) * 0.12 * Math.sin(t * 9));
  F.acc += dt;
  if (F.acc > 1 / 30) { F.acc = Math.min(F.acc - 1 / 30, 0.1); stepFire(F, t); F.fresh = true; }
  for (const l of F.logs) if (l.fall > 0) {
    l.vy += 300 * dt; l.fall = Math.max(0, l.fall - l.vy * dt); F.dirty = true;
    if (l.fall === 0) { if (l.vy > 60) { l.fall = 0.01; l.vy = -l.vy * 0.25; io.knock(0.8); F.flare = Math.max(F.flare, 0.8); sparks(s, 18); } else l.vy = 0; }
  }
  if ((F.settle -= dt) <= 0) { F.settle = 22 + r() * 30; settle(s); io.knock(0.45); io.say('A log settles in the grate'); }
  if (r() < dt * (1.2 + F.fuel + F.flare * 6)) sparks(s, 1);
  for (const p of F.sparks) { p.age += dt; p.vy -= 22 * dt; p.vx += (noise1(p.ph + t * 2) - 0.5) * 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  F.sparks = F.sparks.filter((p) => p.age < p.life && p.y > FB.y + 1 && p.x > FB.x - 10 && p.x < FB.x + FB.w + 10);
  // the kettle, singing once it is put on; its steam
  const K = s.kettle;
  if (K.t > 0) {
    K.t += dt;
    if (K.t > 2.2 && K.t < 9 && r() < dt * 14) K.steam.push({ x: KET.x - 3, y: KET.y + 4, vx: -14 - r() * 10, vy: -8 - r() * 6, a: 0, life: 1 + r() * 0.8 });
    if (K.t > 10) K.t = 0;
  } else if (r() < dt * 0.4) K.steam.push({ x: KET.x - 3, y: KET.y + 4, vx: -3, vy: -5, a: 0, life: 1.4 });
  for (const w of K.steam) { w.a += dt; w.x += w.vx * dt; w.y += w.vy * dt; w.vx *= 1 - dt * 1.5; w.vy -= 6 * dt; }
  K.steam = K.steam.filter((w) => w.a < w.life);
  // the cocoa's steam
  s.sip = Math.max(0, s.sip - dt * 1.3); s.steamBoost = Math.max(0, s.steamBoost - dt); s.gutter = Math.max(0, s.gutter - dt);
  if (s.cocoa > 0.02 && (s.steamT -= dt * (1 + s.steamBoost * 1.5)) <= 0) { s.steamT = 0.3; s.steam.push({ x: MUG.x + 3 + r() * 6, y: MUG.y - 1, a: 0, p: r() * 6.3, life: 2.2 + r() * 1.3 }); }
  for (const w of s.steam) { w.a += dt; w.y -= (5 + w.a * 2) * dt; w.x += (Math.sin(t * 1.2 + w.p) * 2.5 + s.door.open * -6) * dt; }
  s.steam = s.steam.filter((w) => w.a < w.life);
  s.lant += ((s.lantOn ? 1 : 0) - s.lant) * ease(7); if (Math.abs(s.lant - (s.lantOn ? 1 : 0)) < 0.01) s.lant = s.lantOn ? 1 : 0;
  s.page = Math.max(0, s.page - dt * 1.6);
  // the dog: asleep and breathing, unless something is happening in its sequence
  const D = s.dog;
  D.bph += dt * 1.9;
  if (D.seq.length) { D.st -= dt; if (D.st <= 0) { const [f, d, fn] = D.seq.shift(); D.f = f; D.st = d; if (fn) fn(); } }
  else D.f = Math.sin(D.bph) > 0.15 ? 1 : 0;
  // the chair rocks and settles; the mittens and the coats sway
  const C = s.chair;
  C.v += (-C.a * 9 - C.v * 0.55) * dt; C.a += C.v * dt;
  const sg = Math.sign(C.v);
  if (sg && sg !== C.lastSign && Math.abs(C.a) > 0.025) io.creak(Math.abs(C.a));
  C.lastSign = sg;
  s.mits = Math.max(0.22 + s.door.open * 0.8, s.mits - dt * 0.35);
  const Rk = s.rack;
  Rk.v += (-Rk.a * 5 - Rk.v * 0.8 + s.door.open * Math.sin(t * 4) * 3) * dt; Rk.a += Rk.v * dt;
  // the door: open a while, then shut against the cold
  const Dr = s.door;
  if (Dr.hold > 0) { Dr.hold -= dt; Dr.open = Math.min(1, Dr.open + dt * 1.6); if (Dr.hold <= 0) io.doorShut(); }
  else Dr.open = Math.max(0, Dr.open - dt * 1.4);
  // the frost creeps back over any wipe
  P.glass.forEach((g, i) => { const G = glassState(s, i, RM); if (G.wipes.length) { for (const w of G.wipes) w.a -= dt / 36; G.wipes = G.wipes.filter((w) => w.a > 0); G.dirty = true; } });
  // the sky: a shooting star now and then on a clear night
  if (s.shoot) { s.shoot.l -= dt * 1.6; s.shoot.x -= 90 * dt; s.shoot.y += 30 * dt; if (s.shoot.l <= 0) s.shoot = null; }
  else if ((s.shootWait -= dt) <= 0) { s.shootWait = 18 + r() * 30; if (s.amt.stars > 0.6) s.shoot = { x: RM.ox + GX + 40 + r() * 90, y: GY + 4 + r() * 20, l: 1 }; }
  animals(s, dt, RM, io);
}
function sparks(s, n) {
  for (let i = 0; i < n; i++) s.fire.sparks.push({ x: FG.x + 8 + Math.random() * 32, y: 200 + Math.random() * 8, vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 30 - (n > 4 ? 20 : 0), age: 0, life: 0.8 + Math.random() * 1.4, ph: Math.random() * 50 });
}
function settle(s) {
  const F = s.fire, l = F.logs[Math.floor(Math.random() * F.logs.length)];
  if (l.dy < 3) l.dy += 1; else { l.y0 += Math.random() < 0.5 ? 1 : 0; l.y1 += 1; }
  F.dirty = true; F.flare = Math.max(F.flare, 0.35); sparks(s, 10);
}
function addLog(s) {
  const F = s.fire, top = [[31, 202, 67, 200, 3.4], [34, 199, 64, 204, 3.2], [38, 203, 66, 198, 3]][Math.floor(Math.random() * 3)];
  if (F.logs.length >= 5) { F.logs.shift(); sparks(s, 12); }
  for (const l of F.logs) if (l.dy < 2) l.dy += 1;
  const nl = newLog(top); nl.fall = 22; nl.vy = 0; F.logs.push(nl);
  F.fuel = Math.min(1.25, F.fuel + 0.38); F.dirty = true;
}

// a fox or a deer crossing the snowfield now and then; an owl coming to the pine by the window
function animals(s, dt, RM, io) {
  const r = Math.random, P = RM.P;
  const A = s.animal;
  if (A) {
    if (A.stop > 0) { A.stop -= dt; if (A.stop <= 0) A.graze = 0; }
    else { A.x += A.dir * A.v * dt; A.f += dt * (A.kind === 'fox' ? 9 : 5); if (A.kind === 'deer' && r() < dt * 0.1) { A.stop = 2 + r() * 2; A.graze = 1; } }
    if (!A.said && Math.abs(A.x - (GX + GW / 2)) < 40) { A.said = true; io.say(A.kind === 'fox' ? 'A fox trots by on the snow' : 'A deer picks its way across the snow'); }
    if ((A.dir > 0 && A.x > P.RT + 40) || (A.dir < 0 && A.x < P.L - 40)) { s.animal = null; s.animalWait = 35 + r() * 45; }
  } else if ((s.animalWait -= dt) <= 0) {
    const dir = r() < 0.5 ? 1 : -1, kind = r() < 0.55 ? 'fox' : 'deer';
    s.animal = { kind, dir, x: dir > 0 ? P.L - 30 : P.RT + 30, v: kind === 'fox' ? 15 : 7, f: 0, stop: 0, graze: 0, said: false };
  }
  const O = s.owl, perch = { x: RM.O.branch.x - 11, y: RM.O.branch.y - 14 };
  if (O) {
    O.t += dt;
    if (O.stage === 'in') {
      const u = Math.min(1, O.t / 3.6), e = 1 - (1 - u) ** 2;
      O.x = O.x0 + (perch.x - O.x0) * e; O.y = O.y0 + (perch.y - O.y0) * e - Math.sin(u * Math.PI) * 10;
      O.f = u > 0.92 ? 0 : Math.floor(O.t * 7) % 2 ? 3 : 4;
      if (u >= 1) { O.stage = 'sit'; O.t = 0; O.stay = 28 + r() * 20; O.blink = 2; io.say('An owl lands on the pine by the window'); io.hoot(0.6); }
    } else if (O.stage === 'sit') {
      O.blink -= dt; O.look = Math.max(0, O.look - dt);
      O.f = O.look > 0 ? 2 : O.blink < 0 ? 1 : 0;
      if (O.blink < -0.15) O.blink = 2 + r() * 4;
      if (r() < dt * 0.08) O.look = 1.2 + r();
      if (O.t > O.stay) { O.stage = 'out'; O.t = 0; O.x0 = O.x; O.y0 = O.y; }
    } else {
      const u = Math.min(1, O.t / 3.2);
      O.x = O.x0 - u * 170; O.y = O.y0 - Math.sin(u * Math.PI * 0.6) * 46 - u * 10; O.f = Math.floor(O.t * 7) % 2 ? 3 : 4; O.dir = -1;
      if (u >= 1) { s.owl = null; s.owlWait = 60 + r() * 60; }
    }
  } else if ((s.owlWait -= dt) <= 0) {
    s.owl = { stage: 'in', t: 0, x0: perch.x + 150, y0: perch.y - 50, x: perch.x + 150, y: perch.y - 50, f: 3, look: 0, dir: -1 };
  }
}

/* ——— drawing ——— */
function tile(g, img, W, off, y, bw) { for (let x = -Math.round(((off % W) + W) % W); x < bw; x += W) g.drawImage(img, x, y); }
const AUR = [0x58f0b0, 0x30c890, 0x7a58c8];
function drawOutside(g, RM, s) {
  const O = RM.O, F = fx(), t = s.t, bw = RM.rw, ox = RM.ox, a = s.amt;
  tile(g, O.sky, 64, 0, 0, bw);
  if (a.stars > 0.02) {
    for (const st of O.stars) { const b = Math.sin(t * st.sp + st.p); g.globalAlpha = a.stars * (b > 0.5 ? 1 : b > -0.4 ? 0.65 : 0.35); g.fillStyle = b > 0.5 ? '#fff6e0' : '#a8b4dc'; g.fillRect(st.x, st.y, 1, 1); if (st.big && b > 0.7) { g.globalAlpha *= 0.4; g.fillRect(st.x - 1, st.y, 3, 1); g.fillRect(st.x, st.y - 1, 1, 3); } }
    if (s.shoot) { g.fillStyle = '#ffffff'; for (let k = 0; k < 7; k++) { g.globalAlpha = a.stars * s.shoot.l * (1 - k / 7); g.fillRect(Math.round(s.shoot.x + k * 3), Math.round(s.shoot.y - k), 2, 1); } }
  }
  // the aurora: slow curtains of green, fringed with violet, only on a clear night
  if (a.aurora > 0.02) {
    g.globalCompositeOperation = 'lighter';
    for (const gl of RM.P.glass) {
      if (gl.door) continue;
      for (let x = ox + gl.x; x < ox + gl.x + gl.w; x++) {
        const cx = x - ox, ray = 0.55 + 0.45 * noise1(cx * 0.38 + t * 0.35), I = cl(noise1(cx * 0.04 + t * 0.1) * 1.6 - 0.4) * ray * a.aurora, q = band(I * 4, x, 0) / 4;
        if (q <= 0) continue;
        const bot = Math.round(52 + Math.sin(cx * 0.021 + t * 0.13) * 9 + Math.sin(cx * 0.067 - t * 0.27) * 4), len = Math.round(18 + noise1(cx * 0.11 + t * 0.25) * 22), top = bot - len;
        g.globalAlpha = q * 0.55; g.fillStyle = hex(AUR[0]); g.fillRect(x, bot - 2, 1, 2);
        g.globalAlpha = q * 0.3; g.fillStyle = hex(AUR[1]); g.fillRect(x, bot - 2 - Math.round(len * 0.45), 1, Math.round(len * 0.45));
        g.globalAlpha = q * 0.15; g.fillRect(x, top + 4, 1, bot - 2 - Math.round(len * 0.45) - top - 4);
        g.globalAlpha = q * 0.12; g.fillStyle = hex(AUR[2]); g.fillRect(x, top - 3, 1, 7);
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
  // the moon, and its halo; dimmed behind the clouds
  const mx = ox + 194, my = 50, ma = 1 - a.cloud * 0.75;
  g.globalAlpha = ma; g.drawImage(F.moonImg, mx - 6, my - 6);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = ma * 0.55; g.drawImage(F.moon, mx - 26, my - 26); g.globalCompositeOperation = 'source-over';
  if (a.cloud > 0.02) { g.globalAlpha = Math.min(1, a.cloud * 1.1); tile(g, O.clouds, O.cloudW, s.cloudX, 0, bw); }
  g.globalAlpha = 1;
  g.drawImage(O.land, 0, 0);
  if (a.haze > 0.02) { g.globalAlpha = a.haze; g.drawImage(O.haze, 0, 0); g.globalAlpha = 1; }
  // the village's windows, twinkling a little through the cold air
  g.globalCompositeOperation = 'lighter';
  for (const L of O.lights) {
    const v = 0.55 + 0.45 * Math.sin(t * L.sp + L.p);
    g.globalAlpha = (0.25 + v * 0.35) * (1 - a.haze * 0.8); g.drawImage(F.village, L.x + ox - 3, L.y - 2);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const A = s.animal;
  if (A) {
    const set = A.kind === 'fox' ? (A.dir > 0 ? F.fox : F.foxL) : A.dir > 0 ? F.deer : F.deerL;
    const fr = A.graze ? 4 : A.stop > 0 ? 1 : Math.floor(A.f) % 4, img = set[Math.min(set.length - 1, fr)];
    g.globalAlpha = 1 - a.haze * 0.5; g.drawImage(img, Math.round(ox + A.x - img.width / 2), 143 - img.height + 1); g.globalAlpha = 1;
  }
  g.drawImage(O.near, 0, 0);
  const W = s.owl;
  if (W) { const set = W.stage === 'out' ? F.owlL : F.owl; g.drawImage(set[W.f], Math.round(ox + W.x), Math.round(W.y)); }
}

function glassClip(g, RM, s, withDoor) {
  const ox = RM.ox;
  g.beginPath();
  for (const gl of RM.P.glass) g.rect(ox + gl.x, gl.y, gl.w, gl.h);
  if (withDoor && RM.P.right && s.door.open > 0.02) g.rect(ox + DOOR.x + 4, DOOR.y, DOOR.w - 8, FLOOR - DOOR.y);
  g.clip();
}
const FLAKEC = ['rgba(150,166,210,0.55)', 'rgba(200,214,240,0.8)', 'rgba(236,242,255,0.95)', 'rgba(248,250,255,0.85)'];
function drawSnow(g, RM, s) {
  g.save(); glassClip(g, RM, s, true);
  const amt = s.amt.snow;
  for (let z = 0; z < 4; z++) {
    g.fillStyle = FLAKEC[z];
    for (const f of s.flakes) {
      if (f.z !== z || f.k > amt) continue;
      const x = Math.round(f.x), y = Math.round(f.y);
      if (z === 3) { g.fillRect(x, y, 2, 2); } else g.fillRect(x, y, 1, 1);
      if (z >= 2 && Math.abs(s.wind) > 30) g.fillRect(x + (s.wind > 0 ? -1 : 1), y, 1, 1);   // a streak in the gust
    }
  }
  g.restore();
}
function drawFrost(g, RM, s, frame) {
  const F = fx();
  RM.P.glass.forEach((gl, i) => {
    if (gl.door && s.door.open > 0.04) return;
    const G = glassState(s, i, RM);
    if (G.dirty && frame % 3 === 0) {
      const f = G.fg;
      f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.clearRect(0, 0, G.fog.width, G.fog.height); f.drawImage(G.src, 0, 0);
      f.globalCompositeOperation = 'destination-out';
      for (const w of G.wipes) { f.globalAlpha = Math.min(1, w.a * 1.6); f.drawImage(F.wipe, Math.round(w.x - 15), Math.round(w.y - 7)); }
      f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
      G.dirty = G.wipes.length > 0;
    }
    g.drawImage(G.fog, RM.ox + gl.x, gl.y);
  });
}

// the logs in the grate, painted again only when they move: bark lit along the top by the flames,
// charred underneath, cracks that glow, the end grain ringed with embers
const LOGY = 176;
function logsCanvas(F) {
  if (!F.dirty && F.cv) return F.cv;
  const R = new Ras(FB.w, FB.y + FB.h - LOGY, -FB.x, -LOGY), cracks = new Map();
  F.logs.forEach((l, li) => {
    const len = Math.ceil(sq(l.x1 - l.x0, l.y1 - l.y0)), oy = l.dy - l.fall, rr = Math.ceil(l.r);
    for (let k = 0; k <= len * 2; k++) {
      const u = k / (len * 2), X = Math.round(l.x0 + (l.x1 - l.x0) * u), yc = l.y0 + (l.y1 - l.y0) * u + oy;
      for (let v = -rr; v <= rr; v++) {
        const y = Math.round(yc + v);
        let c = v <= -rr + 0.5 ? 0xc0682e : v === -rr + 1 ? 0x7a4220 : v < 0 ? ((X * 3 + v * 5 + li) % 7 === 0 ? 0x2a1810 : 0x4a2c18) : v < 2 ? 0x34200f : 0x1c1009;
        if (v > -rr + 1 && v < 2 && hash2(X * 0.71 + li * 13, v) > 0.91) { c = 0x2a1008; cracks.set(X + ',' + y, [X, y, hash2(X, li) * 6.3]); }
        R.px(X, y, c);
      }
    }
    const ex = Math.round(l.x1), ey = Math.round(l.y1 + oy);
    R.ell(ex, ey, l.r - 0.4, l.r - 0.4, 0x6a3a1c); R.ell(ex, ey, l.r - 1.4, l.r - 1.4, 0x9a6232); R.px(ex, ey, 0x5a3418);
    for (let a = 0.4; a < 6.28; a += 1.6) cracks.set('e' + li + a, [Math.round(ex + Math.cos(a) * (l.r - 0.5)), Math.round(ey + Math.sin(a) * (l.r - 0.5)), a * 3]);
  });
  F.cv = R.canvas(); F.cracks = [...cracks.values()]; F.dirty = false;
  return F.cv;
}
// the kettle: black iron on a chain from the lintel
let KETTLE = null;
function kettleCanvas() {
  if (KETTLE) return KETTLE;
  const R = new Ras(26, 32, -(KET.x - 6), -(FB.y - 2));
  for (let y = FB.y; y < KET.y - 3; y++) R.px(KET.x + 8, y, y % 2 ? 0x5a5054 : 0x3a3236);
  for (let k = 0; k <= 12; k++) R.px(KET.x + 2 + k, KET.y + 4 - Math.round(Math.sin((k / 12) * Math.PI) * 7), 0x2e2a2c);
  R.ell(KET.x + 8, KET.y + 11, 7, 5.5, 0x221e20);
  for (let y = KET.y + 6; y < KET.y + 17; y++) for (let x = KET.x + 1; x < KET.x + 16; x++) {
    if (!R.has(x, y)) continue;
    const dx = x - (KET.x + 8), dy = y - (KET.y + 11);
    if (dx + dy < -6) R.px(x, y, 0x4a4448); else if (dy > 3) R.px(x, y, dy > 4 ? 0xa04a20 : 0x5a2a18);
  }
  R.rect(KET.x + 5, KET.y + 5, 7, 2, 0x2e2a2c); R.rect(KET.x + 5, KET.y + 5, 7, 1, 0x4a4448); R.rect(KET.x + 7, KET.y + 3, 3, 2, 0x2e2a2c); R.px(KET.x + 8, KET.y + 3, 0x5a5458);
  for (let k = 0; k < 6; k++) { R.px(KET.x + 1 - k * 0.7, KET.y + 10 - k, 0x2e2a2c); R.px(KET.x + 2 - k * 0.7, KET.y + 10 - k, 0x1a1618); }
  KETTLE = R.canvas();
  return KETTLE;
}
const FIRECV = { cv: null, g: null, img: null };
function drawFire(g, RM, s) {
  const F = s.fire, ox = RM.ox, t = s.t, fx0 = fx();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.25 + F.fi * 0.4; g.drawImage(fx0.box, ox + FLX - 30, 192 - 26);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (!FIRECV.cv) { FIRECV.cv = mk(FG.w, FG.h); FIRECV.g = FIRECV.cv.getContext('2d'); FIRECV.img = FIRECV.g.createImageData(FG.w, FG.h); }
  if (F.fresh) { renderFire(F, FIRECV.img); FIRECV.g.putImageData(FIRECV.img, 0, 0); F.fresh = false; }
  g.drawImage(FIRECV.cv, ox + FG.x, FG.y);
  // the bed of embers, breathing
  for (const e of F.embers) {
    const b = (0.5 + 0.5 * Math.sin(t * e.sp + e.p)) * (0.5 + F.fi * 0.5);
    g.fillStyle = b > 0.72 ? '#ffb848' : b > 0.42 ? '#e8641c' : b > 0.2 ? '#9a2c10' : '#5a1a0c';
    g.fillRect(ox + Math.round(e.x), e.y, 1, 1);
  }
  g.drawImage(logsCanvas(F), ox + FB.x, LOGY);
  for (const [x, y, p] of F.cracks) {
    const b = 0.5 + 0.5 * Math.sin(t * 2.3 + p) * (0.6 + F.fi * 0.4);
    g.fillStyle = b > 0.8 ? '#ffc050' : b > 0.45 ? '#f07020' : '#a0300c';
    g.fillRect(ox + x, y, 1, 1);
  }
  for (const p of F.sparks) {
    const u = p.age / p.life;
    g.fillStyle = u < 0.3 ? '#fff0b0' : u < 0.6 ? '#ffb040' : u < 0.85 ? '#e86020' : '#8a2a10';
    g.fillRect(ox + Math.round(p.x), Math.round(p.y), 1, 1);
  }
  g.drawImage(kettleCanvas(), ox + KET.x - 6, FB.y - 2);
  g.fillStyle = F.fi > 0.6 ? '#e8742a' : '#b0501e'; g.fillRect(ox + KET.x + 4, KET.y + 16, 8, 1);
  for (const w of s.kettle.steam) { const k = Math.round((1 - w.a / w.life) * 8 * Math.min(1, w.a * 4)); if (k <= 0) continue; g.fillStyle = fx0.steam[Math.min(8, k + 1)]; g.fillRect(ox + Math.round(w.x), Math.round(w.y), w.a > 0.3 ? 2 : 1, 1); }
}

function drawLit(g, RM, sp, fi, la, dx = 0, dw = 0) {
  const x = RM.ox + sp.x0 + dx, y = sp.y0, lm = la >= 0.5 ? 1 : 0, wo = lm ? 1 - la : la;
  const put = (k, a) => { if (a <= 0.004) return; g.globalAlpha = Math.min(1, a); const im = spriteImg(RM, sp, k); if (dw) g.drawImage(im, 0, 0, im.width, im.height, x, y, dw, im.height); else g.drawImage(im, x, y); };
  put(lm, 1); put(2 + lm, fi);
  if (wo > 0.004) { put(1 - lm, wo); put(3 - lm, wo * fi); }
  g.globalAlpha = 1;
}

function drawTableThings(g, RM, s) {
  const ox = RM.ox, t = s.t, fi = s.fire.fi, la = s.lant >= 0.5 ? 1 : 0, F = fx(), ls = (c, x, y) => litHex(RM, x, y, c, fi, la);
  // the cocoa: its surface, the marshmallows going one by one; or the empty mug's inside
  const mx = MUG.x, my = MUG.y;
  if (s.cocoa > 0.02) {
    g.fillStyle = ls(0x5a2c18, mx + 6, my); g.fillRect(ox + mx + 1, my + 1, 10, 1);
    const n = s.cocoa > 0.75 ? 3 : s.cocoa > 0.45 ? 2 : s.cocoa > 0.2 ? 1 : 0;
    for (let k = 0; k < n; k++) { const bx = mx + 2 + k * 3 + Math.round(Math.sin(t * 0.6 + k) * 0.4); g.fillStyle = ls(0xf8f4ec, bx, my); g.fillRect(ox + bx, my, 2, 1); g.fillStyle = ls(0xd8d0c4, bx, my); g.fillRect(ox + bx, my + 1, 2, 1); }
    if (s.cocoa < 0.5) { g.fillStyle = ls(0xe8e2d6, mx + 6, my); g.fillRect(ox + mx + 1, my + 1, 10, 1); g.fillStyle = ls(0x6a3420, mx + 6, my); g.fillRect(ox + mx + 3, my + 1, 6, 1); }
  } else { g.fillStyle = ls(0xe8e2d6, mx + 6, my); g.fillRect(ox + mx + 1, my + 1, 10, 1); g.fillStyle = ls(0x7a4a30, mx + 6, my); g.fillRect(ox + mx + 5, my + 1, 2, 1); }
  if (s.sip > 0) { g.fillStyle = ls(0xffffff, mx, my); g.globalAlpha = Math.sin(s.sip * Math.PI); g.fillRect(ox + mx - 1, my - 1, 14, 1); g.globalAlpha = 1; }
  for (const w of s.steam) {
    const k = Math.min(8, Math.round((1 - w.a / w.life) * 6 * Math.min(1, w.a * 2)) + (s.steamBoost > 0 ? 2 : 0));
    if (k <= 0) continue;
    g.fillStyle = F.steam[k]; g.fillRect(ox + Math.round(w.x), Math.round(w.y), 1, 2);
    if (w.a > 0.8) g.fillRect(ox + Math.round(w.x + Math.sin(w.p + t) * 1.5), Math.round(w.y) - 2, 1, 1);
  }
  // a page turning
  if (s.page > 0) {
    const u = 1 - s.page, cx = BOOK.x + 15, x = Math.round(cx + Math.cos(u * Math.PI) * 13), top = Math.round(BOOK.y + 1 - Math.sin(u * Math.PI) * 7);
    g.fillStyle = ls(0xf4ead2, cx, BOOK.y + 4);
    for (let y = top; y < BOOK.y + 8; y++) g.fillRect(ox + Math.min(x, cx), y, Math.max(1, (Math.abs(x - cx) * 0.3) | 0), 1);
    g.fillRect(ox + x, top, 1, BOOK.y + 8 - top);
  }
  // the candle's flame in its jar
  const fl = Math.sin(t * 11) * 0.5 + Math.sin(t * 17.3) * 0.5 + (s.gutter > 0 ? Math.sin(t * 40) * s.gutter : 0) + s.door.open * Math.sin(t * 23) * 0.8;
  const hgt = Math.max(1, 3 + Math.round(fl * 0.8) - (s.gutter > 0.5 ? 1 : 0)), sway = Math.round(Math.sin(t * 2.7) * 0.4 + s.door.open * -0.8), cx = ox + JAR.x + 4;
  g.fillStyle = '#ff9a3a'; g.fillRect(cx + sway, JAR.y + 5 - hgt, 1, hgt); g.fillStyle = '#fff2c0'; g.fillRect(cx, JAR.y + 4, 1, 1);
  if (hgt > 2) { g.fillStyle = '#ffd070'; g.fillRect(cx + sway, JAR.y + 3 - hgt + 2, 1, 1); }
}

function drawRoom(g, RM, s, frame) {
  const { ox, P } = RM, t = s.t, F = fx(), fi = s.fire.fi, la = s.lant;
  drawLit(g, RM, RM.back, fi, la);
  if (RM.door) { const o = sm(s.door.open), w = Math.max(4, Math.round((DOOR.w - 8) * (1 - o * 0.84))); drawLit(g, RM, RM.door, fi, la, 0, w); }
  if (RM.rack) drawLit(g, RM, RM.rack[Math.max(-1, Math.min(1, Math.round(s.rack.a))) + 1], fi, la);
  RM.mits.forEach((set, i) => drawLit(g, RM, set[Math.max(-1, Math.min(1, Math.round(Math.sin(t * 1.3 + i * 1.7) * s.mits))) + 1], fi, la));
  drawFire(g, RM, s);
  drawLit(g, RM, RM.dog[s.dog.f], fi, la);
  drawTableThings(g, RM, s);
  drawLit(g, RM, RM.chair[Math.max(0, Math.min(8, Math.round(s.chair.a / 0.017) + 4))], fi, la);
  if (la > 0.01) { g.globalAlpha = la; g.drawImage(spriteImg(RM, RM.lantLit, 3), ox + LANT.x, LANT.y + 6); g.globalAlpha = 1; if (Math.sin(t * 13) + Math.sin(t * 7.1) > 1.2) { g.fillStyle = '#ffffff'; g.fillRect(ox + LANT.x + 7, LANT.y + 14, 1, 1); } }
  // light: the fire over the room, the hearth's pool, the candle, the lantern, the reading lamp
  g.globalCompositeOperation = 'lighter';
  const fl = s.fire.flare;
  g.globalAlpha = 0.16 + fi * 0.2 + fl * 0.22; g.drawImage(F.room, ox + FLX - 160, FLY - 80);
  g.globalAlpha = 0.22 + fi * 0.28 + fl * 0.2; g.drawImage(F.hearth, ox + FLX + 20 - 76, 236 - 20);
  const cf = 0.85 + Math.sin(t * 11) * 0.06 + Math.sin(t * 17.3) * 0.05 - s.gutter * 0.2;
  g.globalAlpha = 0.5 * cf; g.drawImage(F.candle, ox + JAR.x + 4 - 24, JAR.y + 4 - 16);
  g.globalAlpha = 0.7 * cf; g.drawImage(F.halo, ox + JAR.x + 4 - 6, JAR.y + 2 - 7);
  if (la > 0.01) { g.globalAlpha = la * (0.42 + Math.sin(t * 5.3) * 0.03); g.drawImage(F.lant, ox + LANT.x + 7 - 44, LANT.y + 15 - 36); g.globalAlpha = la * 0.8; g.drawImage(F.lantHalo, ox + LANT.x + 7 - 12, LANT.y + 15 - 12); }
  if (P.corner) { g.globalAlpha = 0.5 + Math.sin(t * 3.1) * 0.03; g.drawImage(F.lamp, ox + SHELFX + 64 - 34, 68 - 28); }
  if (P.right) { g.globalAlpha = 0.45 + Math.sin(t * 2.7 + 1) * 0.03 + s.door.open * Math.sin(t * 19) * 0.08; g.drawImage(F.lamp, ox + SCONCE.x + 3 - 34, SCONCE.y + 6 - 28); }
  if (s.kettle.t > 2) { g.globalAlpha = 0.3; g.drawImage(F.kettle, ox + KET.x - 11, KET.y - 2); }
  if (s.dog.f >= 2 && s.dog.f !== 5 && s.dog.f !== 6) { g.globalAlpha = 0.18 * (0.5 + fi * 0.5); g.drawImage(F.eye, ox + 80, 262); g.drawImage(F.eye, ox + 84, 262); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function vignette(RM) {
  if (RM.vig) return RM.vig;
  const { rw } = RM, R = new Ras(rw, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < rw; x++) {
    const vx = (x - rw / 2) / (rw / 2), vy = (y - 170) / 170, v = Math.max(0, vx * vx * 0.55 + vy ** 4 * 0.7 - 0.12);
    const q = band(Math.min(3, v * 5), x, y);
    if (q > 0) R.px(x, y, 0x0a0610, [0, 0.14, 0.26, 0.38][q]);
  }
  RM.vig = R.canvas();
  return RM.vig;
}

function render(g, RM, s, frame) {
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#05071a'; g.fillRect(0, 0, RM.rw, H);
  drawOutside(g, RM, s);
  drawSnow(g, RM, s);
  drawFrost(g, RM, s, frame);
  drawRoom(g, RM, s, frame);
  g.drawImage(vignette(RM), 0, 0);
}
function makeBuffer(bw) { const buf = mk(bw, H); return { buf, g: buf.getContext('2d') }; }

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
const QUIET = { say() {}, knock() {}, creak() {}, hoot() {}, gust() {}, weather() {}, doorShut() {} };
export function preview(ctx) {
  if (!PREV) {
    const RM = roomFor(320), s = makeState(11);
    s.wx = 0; Object.assign(s.amt, WXAMT.clear, { snow: 0.3 }); s.animalWait = 1e9; s.owlWait = 1e9; s.fire.settle = 1e9;
    for (let i = 0; i < 120; i++) update(s, 1 / 30, RM, QUIET);
    s.amt.snow = 0.3;
    s.owl = { stage: 'sit', t: 0, stay: 1e9, blink: 3, look: 0, f: 0, x: RM.O.branch.x - 11, y: RM.O.branch.y - 14, dir: -1 };
    s.fire.fi = 0.85; s.cocoa = 0.9;
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
const JARTXT = ['Wild honey from the valley', 'Lingonberry jam, picked in August', 'Pickled beans, a little sour', 'Oats for the morning', 'Sugar, for the cocoa', 'Dried apple rings'];
const FIRETXT = (f) => (f > 0.92 ? 'the fire crackling' : f > 0.58 ? 'the fire burning steady' : 'the fire burning low');
export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const s = makeState(Date.now() % 100000);
  let B = null, RM = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false, frame = 0;
  const preW = roomW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: 320, sx: 0, dx: 0 };
  let jarI = 0, pageI = 0, mugI = 0;

  const status = () => setScore(`${WXTXT[WXS[s.wx]]} · ${FIRETXT(s.fire.fuel)}${s.lantOn ? '' : ' · lantern out'}`);
  setScore('Click the fire, the window, the cocoa, the lantern, the dog…');
  let hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0;
  const say = (text) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(status, 3800); };

  // the fire's crackle, and the murmur layer's slow swell as the wind round the cabin
  const amb = playAmbience({ crackle: 0.7, murmur: 0.3 }, isPaused);
  const stopMusic = playLoungeMusic('cabin', isPaused);
  const later = (sec, fn) => s.later.push({ at: s.t + sec, fn });
  let ambWind = 0.3, ambFire = 0.7;
  const io = {
    say,
    knock(a) { tone(38, { dur: 0.13, vol: 0.03 * a, type: 'triangle' }); tone(31, { dur: 0.18, vol: 0.024 * a, type: 'sine' }); swish(0.018 * a); },
    creak(a) { tone(46 + Math.random() * 3, { dur: 0.32, vol: Math.min(0.012, 0.004 + a * 0.12), type: 'triangle' }); },
    hoot(v = 1) { tone(55, { dur: 0.5, vol: 0.028 * v, type: 'sine' }); tone(52, { dur: 0.75, vol: 0.024 * v, type: 'sine', delay: 0.55 }); },
    gust() { swish(0.01); },
    weather(st) {
      const w = Math.min(1, 0.2 + st.amt.wind * 0.1 + (st.gust + st.door.open) * 0.55), f = Math.min(1, 0.45 + st.fire.fuel * 0.22 + st.fire.flare * 0.4);
      if (Math.abs(w - ambWind) > 0.03) { ambWind = w; amb.set('murmur', w); }
      if (Math.abs(f - ambFire) > 0.03) { ambFire = f; amb.set('crackle', f); }
    },
    doorShut() { later(0.6, () => { tone(36, { dur: 0.2, vol: 0.03, type: 'triangle' }); tone(29, { dur: 0.25, vol: 0.02 }); }); },
  };

  const poke = () => {
    const F = s.fire;
    F.flare = 1; sparks(s, 26); settle(s); io.knock(1); swish(0.035);
    for (let k = 0; k < 4; k++) later(0.15 + k * 0.17 + Math.random() * 0.1, () => drip(0.012, 2600 + Math.random() * 900, 1500));
    say(F.fuel < 0.58 ? 'You stir the embers: it wants another log' : 'You poke the fire: it flares, sparks fly up');
  };
  const putLog = (from) => {
    addLog(s); swish(0.03); later(0.25, () => io.knock(0.7));
    say(from === 'pile' ? 'You fetch a split log from the pile and lay it on' : 'Another log on the fire');
  };
  const wipe = (i, lx, ly) => {
    const G = glassState(s, i, RM);
    G.wipes.push({ x: lx, y: ly, a: 1 }); G.dirty = true;
    tone(86, { dur: 0.1, vol: 0.009 }); tone(90, { dur: 0.09, vol: 0.007, delay: 0.09 }); swish(0.02);
    const A = s.animal;
    say(A && Math.abs(A.x - (RM.P.glass[i].x + lx)) < 60 ? (A.kind === 'fox' ? 'A clear patch in the frost: the fox, red against the snow' : 'A clear patch in the frost: the deer, looking back') : s.wx === 2 ? 'A clear patch in the frost: snow whirling past' : 'A clear patch in the frost');
  };
  const sky = () => {
    s.wx = (s.wx + 1) % WXS.length;
    [9, 7, 5].forEach((n, i) => note(n + (s.wx === 0 ? 2 : s.wx === 2 ? -2 : 0), { dur: 1, vol: 0.022, delay: i * 0.22 }));
    if (s.wx === 2) { s.gustWait = 0.5; }
    say(['The clouds part: stars, and the aurora', 'The clouds come over, the snow begins', 'The wind gets up, the snow thickens'][s.wx]);
  };
  const wakeDog = () => {
    const D = s.dog;
    if (D.seq.length) { D.seq.unshift(...[3, 4, 3, 4].map((f) => [f, 0.14, () => tone(34, { dur: 0.12, vol: 0.026 })])); say('Thump, thump: the tail again'); return; }
    tone(43, { dur: 0.2, vol: 0.02, type: 'triangle' });
    D.seq = [[2, 0.9], ...[3, 4, 3, 4, 3, 4].map((f) => [f, 0.14, () => tone(34, { dur: 0.12, vol: 0.024 })]), [2, 0.5], [5, 1.5, () => tone(40, { dur: 0.5, vol: 0.014, type: 'triangle' })], [2, 0.6], [6, 0.15], [2, 0.7], [0, 0.4]];
    D.st = 0;
    say('Juniper wakes, wags, and stretches by the fire');
  };

  // what is under the pointer, as the thing to do if it's clicked (null: nothing there)
  const target = (x, y) => {
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1, P = RM.P;
    if (inR(KET.x - 5, KET.y - 3, KET.x + 16, KET.y + 18)) return () => {
      if (s.kettle.t > 0) { say('The kettle is already singing'); return; }
      s.kettle.t = 0.01; drip(0.02, 900, 700);
      later(2.2, () => { tone(91, { dur: 1.2, vol: 0.005 }); tone(93, { dur: 3.4, vol: 0.008, delay: 0.7 }); tone(93.18, { dur: 3.4, vol: 0.006, delay: 0.7 }); });
      later(6.2, () => tone(92, { dur: 2.4, vol: 0.005 }));
      say('The kettle swings over the flames; soon it starts to sing');
    };
    if (inR(FB.x, FB.y, FB.x + FB.w, FB.y + FB.h + 2) || inR(88, 186, 100, 222)) return poke;
    if (inR(-6, 186, 21, 222)) return () => putLog('basket');
    if (inR(MUG.x - 3, MUG.y - 8, MUG.x + 16, MUG.y + 18)) return () => {
      if (s.cocoa > 0.02) {
        s.sip = 1; s.cocoa = Math.max(0, s.cocoa - 0.25); drip(0.045, 520, 260); tone(64, { dur: 0.3, vol: 0.013, delay: 0.25 });
        say(s.cocoa <= 0.02 ? MUG_LINES[3] : MUG_LINES[mugI++ % 3]);
        if (s.cocoa <= 0.02) s.cocoa = 0;
      } else {
        s.cocoa = 1; s.steamBoost = 3; [0, 0.12, 0.24, 0.36].forEach((d, i) => later(d, () => drip(0.02, 700 - i * 60, 380)));
        say('You pour another cup of cocoa, and drop in marshmallows');
      }
    };
    if (inR(JAR.x - 3, JAR.y - 7, JAR.x + 11, JAR.y + 14)) return () => { s.gutter = 1.4; tone(88, { dur: 0.3, vol: 0.012 }); say('The candle gutters in its jar, then steadies'); };
    if (inR(BOOK.x - 1, BOOK.y - 3, BOOK.x + 31, BOOK.y + 12)) return () => { s.page = 1; swish(0.04); say(PAGES[pageI++ % PAGES.length]); };
    if (inR(TBL.x + 41, TBL.y - 4, TBL.x + 55, TBL.y + 4)) return () => { tone(74, { dur: 0.2, vol: 0.014 }); drip(0.02, 900, 500); say('A bite of gingerbread, still soft'); };
    if (inR(DOG.x, DOG.y + 6, DOG.x + DOG.w + 4, DOG.y + DOG.h)) return wakeDog;
    if (inR(104, 160, 216, 306)) return () => { s.chair.v += 0.32 * (s.chair.v >= 0 ? 1 : -1) || 0.32; io.creak(0.08); say('The rocking chair rocks, and slowly settles'); };
    if (inR(LANT.x - 3, LANT.y - 6, LANT.x + 16, LANT.y + 29)) return () => { s.lantOn = !s.lantOn; drip(0.03, 2400, 1600); note(s.lantOn ? 7 : 4, { dur: 0.5, vol: 0.03 }); say(`The lantern ${s.lantOn ? 'lit again' : 'turned down and out'}`); };
    if (inR(250, 66, 316, 92)) return () => { note(6 + (jarI % 3), { dur: 0.3, vol: 0.022 }); tone(96, { dur: 0.15, vol: 0.006, delay: 0.05 }); say(JARTXT[jarI++ % JARTXT.length]); };
    if (inR(246, 104, 298, 142)) return () => { note(5, { dur: 0.4, vol: 0.022 }); say('The trail map: up past the lake to the hut on the ridge'); };
    if (inR(294, 92, 318, 238)) return () => { note(8, { dur: 0.4, vol: 0.02 }); say('The skis, waxed for the morning'); };
    if (inR(252, 146, 292, 200)) return () => { note(6, { dur: 0.4, vol: 0.02 }); say('Snowshoes, for the ridge trail tomorrow'); };
    if (inR(26, 52, 74, 101)) return () => { note(3, { dur: 0.5, vol: 0.02 }); say('Antlers found on the ridge trail, years ago'); };
    if (inR(60, MANTEL - 18, 76, MANTEL)) return () => { [84, 80, 77, 72].forEach((n, i) => tone(n, { dur: 1.1, vol: 0.016, delay: i * 0.32, type: 'triangle' })); const d = new Date(); say(`The little clock chimes: ${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`); };
    if (inR(4, 134, 98, 158)) return () => { s.mits = 1.4; swish(0.02); say('The mittens are nearly dry'); };
    const gi = P.glass.findIndex((g) => !g.door && inR(g.x, g.y, g.x + g.w, g.y + g.h));
    if (gi >= 0) {
      const g = P.glass[gi], lx = x - g.x, ly = y - g.y, O = s.owl;
      if (O && O.stage === 'sit' && inR(O.x, O.y - 2, O.x + 22, O.y + 15)) return () => { O.look = 1.6; io.hoot(1); say('The owl turns its head: hoo, hoo'); };
      const A = s.animal;
      if (A && Math.abs(A.x - x) < 14 && y > 118 && y < 146) return () => { A.stop = 1.8; A.graze = 0; note(8, { dur: 0.3, vol: 0.018 }); say(A.kind === 'fox' ? 'The fox stops, one paw up, and listens' : 'The deer lifts its head and looks your way'); };
      if (ly < (g.core ? 32 : 37)) return sky;
      return () => wipe(gi, lx, ly);
    }
    if (P.right && inR(DOOR.x, DOOR.y, DOOR.x + DOOR.w, FLOOR)) return () => {
      if (s.door.hold > 0 || s.door.open > 0.1) return;
      s.door.hold = 2.6; s.rack.v += 1.5; s.mits = 1.2; swish(0.05); tone(41, { dur: 0.3, vol: 0.016, type: 'triangle' });
      say('The door opens on the cold: snow blows in, the fire roars');
    };
    if (P.right && inR(324, 180, 360, 238)) return () => putLog('pile');
    if (P.right && inR(SCONCE.x - 6, SCONCE.y - 8, SCONCE.x + 9, SCONCE.y + 17)) return () => { note(7, { dur: 0.4, vol: 0.02 }); say('The little oil lamp by the door, for coming home in the dark'); };
    if (P.right && inR(RACKBOX.x, RACKBOX.y, RACKBOX.x + RACKBOX.w, FLOOR)) return () => { s.rack.v += 2.2; swish(0.025); say('Scarves and a wool coat, still cold from outside'); };
    if (P.left && inR(-124, 166, -4, 238)) return () => { note(2, { dur: 0.6, vol: 0.02 }); note(4, { dur: 0.6, vol: 0.018, delay: 0.18 }); say('The bunk, the quilt pieced from old flannel shirts'); };
    if (P.corner && inR(SHELFX, 70, SHELFX + 46, 238)) return () => { swish(0.03); say('Field guides, a book of knots, old paperback westerns'); };
    if (P.corner && inR(SHELFX + 50, 52, SHELFX + 80, 84)) return () => { note(6, { dur: 0.4, vol: 0.02 }); say('The oil lamp in the reading corner, turned low'); };
    if (P.far && inR(446, 166, 478, 238)) return () => { note(7, { dur: 0.4, vol: 0.02 }); say('The old sled, for the hill behind the cabin'); };
    if (P.far && inR(486, 118, 530, 238)) return () => { drip(0.03, 800, 500); say('The washstand: a jug of water, cold as the creek'); };
    return null;
  };
  const toLocal = (e) => { const p = pointIn(canvas, e), W = canvas._snW || 640; return [(p.x * view.bw) / W + view.sx - view.dx - RM.ox, p.y / 2]; };
  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!RM) return;
    const act = target(...toLocal(e));
    if (act) act();
  };
  const onMove = (e) => { if (RM) canvas.style.cursor = target(...toLocal(e)) ? 'pointer' : ''; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);

  // a new frame shape: rebuild the cabin only once the width has held for a moment, a little each
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
      if (done) { job = null; jobW = 0; if (done.rw === want) { RM = done; s.glass = []; } }
    }
    if (RM.rw !== (B && B.buf.width)) { B = makeBuffer(RM.rw); s.glass = []; }
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
      if (view.dx) { upg.fillStyle = '#140c0a'; upg.fillRect(0, 0, up.width, up.height); }
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
    s.later.length = 0;
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.style.cursor = '';
  };
}
