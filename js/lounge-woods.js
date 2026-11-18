// Forest Cabin — a lounge, not a game: a little timber cabin deep in a temperate rainforest on a
// wet afternoon, seen from a soft armchair. The middle of it is the gable's tall window, its panes
// running up into the triangle under the roof: beyond the glass a porch where the eaves drip into a
// puddle, a creek with stepping stones between mossy banks, sword ferns and a fallen log, and tall
// firs and cedars fading into the mist. Rain streaks down outside and runs down the glass; the lower
// panes mist over (wipe them clear); now and then a deer comes down to drink, an owl blinks on the
// near cedar's branch, a frog sits in the puddle; at dusk and at night the mushrooms on the log glow
// and fireflies drift over the ferns. Inside: a cast-iron wood stove on its hearth against green
// tiles, a copper kettle steaming on it; a low shelf with a record player, records, books and a
// candle; a monstera, a fern in a macramé hanger, a trailing pothos; a ginger cat on the window
// seat's cushion, watching the drops; string lights along the roof's A-frame truss, an old canoe
// paddle over the window, a brass barometer by the stovepipe; a braided rug,
// a slab-wood table with a field guide open, pinecones and a mug of tea; your chair's arm under a
// knitted blanket. In full screen the cabin goes on under its low wings, bay by bay, each drawn only
// when all of it is on screen: a kitchen corner with a little window, jars and herbs drying, a bed
// nook under the eaves with a patchwork quilt, a reading lamp and fairy lights, a blanket ladder;
// on the other side the door with a coat, boots, an umbrella and a lantern, the woodpile, and
// another window onto the forest.
// Pixel art, as in the other lounges: painted into a buffer 320 px tall (as wide as the frame's
// shape) and blown up by whole steps with no smoothing. Every still surface is painted once in
// daylight colours; each pixel then takes its colour from a short ramp made for that colour (the
// grey-green light of a wet forest, turning blue toward night, on one side; stove and string-light
// amber on the other), stepped by the light that reaches it, with ordered dither only where two
// steps meet. The room is baked per frame shape, per hour, with the string lights on and off and
// the stove low and high; each frame blends those and draws only the moving things over them.

import { setupCanvas, runLoop, pointIn, note, tone, drip, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'woods', title: 'Forest Cabin', blurb: 'A timber cabin in a rainy forest: the stove ticking, the kettle on, rain on the glass.', keys: 'Click the window, the stove, the kettle…', lounge: true };

const H = 320;                    // buffer height; the core composition is 320 wide
const STEP = 16;                  // room widths round up to this, so a resize doesn't rebuild every frame
const SIDE = '#121310';           // the edges, for the moment a wider room is still being built
const FLOOR = 250;                // where the floor meets the wall
// the roof, in one-point perspective toward (VPX, VPY): the gable wall's top runs up steeply from
// either side to a ridge just above the frame; past the main posts (|x - 160| > KINK) the low
// wings' roof falls gently to the eaves
const VPX = 160, VPY = 168, Y0 = -10, K1 = 0.75, KINK = 166, K2 = 0.22, YK = Y0 + KINK * K1;
const roofY = (x) => { const d = Math.abs(x - VPX); return d <= KINK ? Y0 + d * K1 : YK + (d - KINK) * K2; };
// the gable window: tall panes under a triangle that follows the roof, glazing bars at MUNT and a
// transom at the shoulders
const WIN = { id: 0, kind: 'gable', x0: 88, x1: 232, y0: 50, yB: 198, yS: 104, src: 170 };
const MUNT = [123, 124, 159, 160, 195, 196];
const winTop = (x) => WIN.yS - Math.max(0, 72 - Math.abs(x + 0.5 - VPX)) * K1;
// the little windows of the full-screen bays (each bay always sits at the same place when it's there)
const KWIN = { id: 1, kind: 'rect', x0: -52, x1: -22, y0: 136, yB: 174, src: 20 };
const BWIN = { id: 2, kind: 'rect', x0: -150, x1: -124, y0: 162, yB: 190, src: 84 };
const DWIN = { id: 3, kind: 'rect', x0: 350, x1: 366, y0: 144, yB: 166, src: 352 };
const RWIN = { id: 4, kind: 'rect', x0: 454, x1: 494, y0: 160, yB: 204, src: 404 };
const WINS = [WIN, KWIN, BWIN, DWIN, RWIN];
const inWin = (W, x, y) => x >= W.x0 && x < W.x1 && y < W.yB && y >= (W.kind === 'gable' ? winTop(x) : W.y0);
const isBar = (W, x, y) => (W.kind === 'gable' ? MUNT.includes(x) || y === 104 || y === 105 : x === ((W.x0 + W.x1) >> 1) || y === ((W.y0 + W.yB) >> 1));
const PW = 480, PH = 172, PY = 48;   // the forest: one panorama all the windows look onto (screen y = py + PY)
const KET = { x: 246, y: 174, w: 40, h: 26 };    // the kettle's sprite box (it sits on the stove's top plate)
const MUG = { x: 200, y: 276 };                  // the mug's foot
const CANDLE = [80, 195];                        // the candle's flame, in its jar on the shelf
const REC = { x: 61, y: 197 };                   // the record's middle
const BOOK = { x0: 136, x1: 176, y0: 269, y1: 278 };   // the field guide, open on the table
const FWIN = { x: 264, y: 210, w: 20, h: 19 };   // the stove door's glass
const CATX = 117;                                // the cat's head, over the window seat
const DRIPX = 262;                               // where the eaves drip, in panorama x (screen 180)
const PUD = { x: 262, y: 193, rx: 9 };           // the puddle on the porch (panorama x, screen y)
const OWLP = { x: 195, y: 127 };                 // the owl's perch on the near cedar's branch
const DEERY = 167, DEERSTOP = 262;               // the far bank, where the deer comes down to drink
const LOG = { x0: 238, x1: 268, y: 183 };        // the fallen log on the near bank, its mushrooms
const STAGES = ['Afternoon', 'Dusk', 'Night'];
const RLV = [0, 0.5, 1];
const RAINS = ['the rain has stopped', 'a soft rain on the glass', 'rain pouring off the eaves'];
const FLO = 0.5, FHI = 1;                        // the stove's light, low and high, for the two bakes
const AMB = [1, 0.62, 0.32];                     // how much daylight comes in, by the hour

// Full screen: the cabin goes on either side in whole bays, outward from the core's posts. A bay
// is painted, lit and clickable only when all of it is always on screen at this room width (the
// frame can be up to STEP - 1 narrower than the room); what is left at the edge is plain wall.
const LEFT_BAYS = [['kitchen', 72], ['bed', 120], ['ladder', 36]];
const RIGHT_BAYS = [['door', 72], ['wood', 40], ['window', 72]];
function layoutFor(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox;
  const vL = rw > 320 ? L + (STEP >> 1) : 0, vR = rw > 320 ? RT - (STEP >> 1) : 320;
  const lay = { rw, ox, L, RT, vL, vR, bays: [], wins: [WIN], kitchen: null, bed: null, ladder: null, door: null, wood: null, window: null };
  let x = -6;
  for (const [kind, w] of LEFT_BAYS) if (x - w >= vL) { const b = { kind, side: -1, x0: x - w, x1: x }; lay.bays.push(b); lay[kind] = b; x -= w; }
  lay.lEnd = x;
  x = 326;
  for (const [kind, w] of RIGHT_BAYS) if (x + w <= vR) { const b = { kind, side: 1, x0: x, x1: x + w }; lay.bays.push(b); lay[kind] = b; x += w; }
  lay.rEnd = x;
  if (lay.kitchen) lay.wins.push(KWIN);
  if (lay.bed) lay.wins.push(BWIN);
  if (lay.door) lay.wins.push(DWIN);
  if (lay.window) lay.wins.push(RWIN);
  lay.postL = vL <= -6; lay.postR = vR >= 326;
  return lay;
}

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const hash = (x, y = 0) => {
  let t = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
// a stepped level: flat inside each step, a narrow band of ordered dither where two steps meet
const band = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.36 ? i : f > 0.64 ? i + 1 : bay(x, y) < (f - 0.36) / 0.28 ? i + 1 : i; };
const bandN = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.43 ? i : f > 0.57 ? i + 1 : bay(x, y) < (f - 0.43) / 0.14 ? i + 1 : i; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.round(a * 1000) / 1000})`;
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = (v) => v - Math.floor(v);

/* ——— a little raster to paint the still layers in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
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
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
  tint(x, y, c, a) { const i = this.at(x, y); if (i >= 0 && this.d[i + 3]) this.px(x, y, c, a); }
  clear(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = this.at(xx, yy); if (i >= 0) this.d.fill(0, i, i + 4); } }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
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
  thick(x0, y0, x1, y1, r, c) {
    const n = Math.ceil(sq(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const u = i / n; this.ell(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), r, r, c); }
  }
  canvas() { return toCanvas(this.d, this.w, this.h); }
}
function toCanvas(d, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
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
// a sky (or a mist) in flat bands of colour, dithered only where two meet
function bands(R, x, y, w, h, cols) {
  for (let j = 0; j < h; j++) {
    const t = (h > 1 ? j / (h - 1) : 0) * (cols.length - 1);
    for (let xx = x; xx < x + w; xx++) R.px(xx, y + j, cols[Math.min(cols.length - 1, bandN(t, xx, y + j))]);
  }
}

/* ——— light: colour ramps ———
   For each painted colour, fourteen lit versions per hour: seven on the cool side (the window's
   light: grey-green in the afternoon, bluer at dusk, deep teal and indigo at night) and seven on
   the warm side (dusky oxblood up to stove and lamp honey). A pixel's step comes from the total
   light on it, its side from how much of that light is warm. */
const CTS = [
  [[0.2, 0.62, 0.78, 0.86, 4, 10, 12], [0.29, 0.67, 0.83, 0.9, 3, 9, 10], [0.39, 0.72, 0.87, 0.93, 3, 7, 8], [0.51, 0.77, 0.91, 0.96, 2, 5, 6], [0.64, 0.82, 0.94, 0.98, 1, 3, 4], [0.78, 0.87, 0.97, 0.99, 0, 2, 2], [0.93, 0.92, 1.0, 1.0, 0, 1, 1]],
  [[0.18, 0.64, 0.74, 1.08, 8, 9, 20], [0.26, 0.69, 0.79, 1.06, 7, 8, 16], [0.36, 0.75, 0.85, 1.04, 5, 7, 11], [0.48, 0.8, 0.9, 1.03, 4, 5, 7], [0.61, 0.86, 0.95, 1.02, 2, 3, 4], [0.75, 0.9, 0.98, 1.01, 1, 2, 2], [0.9, 0.95, 1.0, 1.0, 0, 0, 0]],
  [[0.17, 0.6, 0.74, 1.2, 7, 10, 22], [0.25, 0.66, 0.8, 1.16, 6, 9, 18], [0.35, 0.72, 0.87, 1.12, 5, 7, 13], [0.47, 0.79, 0.93, 1.08, 3, 5, 8], [0.6, 0.85, 0.98, 1.05, 2, 3, 4], [0.74, 0.91, 1.01, 1.03, 0, 2, 2], [0.9, 0.96, 1.02, 1.02, 0, 0, 0]],
];
const WT = [
  [0.21, 0.94, 0.72, 0.96, 12, 5, 12], [0.31, 1.03, 0.78, 0.86, 10, 4, 8], [0.43, 1.11, 0.84, 0.76, 8, 4, 4],
  [0.56, 1.16, 0.88, 0.7, 7, 3, 0], [0.71, 1.21, 0.92, 0.68, 8, 4, 0], [0.87, 1.25, 0.96, 0.68, 10, 6, 0], [1.03, 1.27, 1.0, 0.72, 14, 9, 2],
];
const RAMPS = new Map(), RHEX = new Map();
function rampOf(c, st) {
  const key = c * 4 + st;
  let rp = RAMPS.get(key);
  if (rp) return rp;
  rp = new Int32Array(14);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  [CTS[st], WT].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(key, rp);
  return rp;
}
function rampHex(c, st) { const key = c * 4 + st; let a = RHEX.get(key); if (!a) { a = Array.from(rampOf(c, st), hex); RHEX.set(key, a); } return a; }

// the light reaching a point of the room, in four parts: the daylight through the windows (C),
// the fixed warm lights (W), the string lights (S) and the stove (FI)
function coolAt(x, y, lay) {
  let v = 0.24;
  const ex = x < 88 ? 88 - x : x >= 232 ? x - 231 : 0, ty = winTop(clamp(x, 88, 231));
  const ey = y < ty ? ty - y : y > 198 ? y - 198 : 0;
  v += Math.max(0, 1 - sq(ex * 0.9, ey) / 140) ** 2 * 0.74;
  // the window's light on the seat, the floor before it and the rug
  if (y >= 198) v += Math.max(0, 1 - sq((x - 160) / 2.2, (y - 262) * 0.9) / 96) ** 2 * 0.36;
  if (y > 262 && x < lay.vL + 100) v += 0.2;   // your chair's arm, catching the window's light
  for (const W of lay.wins) {
    if (W === WIN) continue;
    const ex2 = x < W.x0 ? W.x0 - x : x >= W.x1 ? x - W.x1 + 1 : 0, ey2 = y < W.y0 ? W.y0 - y : y >= W.yB ? y - W.yB + 1 : 0;
    v += Math.max(0, 1 - sq(ex2, ey2 * 0.9) / 58) ** 2 * 0.42;
  }
  if (y < roofY(x)) v *= 0.8;   // the ceiling, high above the glass
  const vx = (x - 160) / (lay.rw / 2 + 120), vy = (y - 150) / 300;
  return v * (1 - Math.min(0.36, (vx * vx + vy * vy) * 0.85));
}
function fireAt(x, y) {   // the stove: hard on its hearth, a glow over the room
  const dx = x - 274, dy = y - 222;
  let v = Math.max(0, 1 - sq(dx, dy * 1.15) / 62) ** 1.6 * 0.9;
  v += Math.max(0, 1 - sq(dx * 0.72, dy) / 230) ** 2 * 0.32;
  if (y > 236) v += Math.max(0, 1 - sq(dx * 0.6, (y - 258) * 1.3) / 64) ** 1.4 * 0.55;
  // the iron box hides the fire from the tiles straight behind it and from its own flanks
  if (x >= 246 && x < 302 && y < 238 && y > 140) v *= 0.4 + 0.6 * clamp((Math.abs(dx) - 20) / 10, 0, 1);
  return v;
}
// lights with an id (so they can be put out): a point falling off over r (sy squashes it)
function lightBox(lt) { return { x0: Math.floor(lt.x - lt.r), x1: Math.ceil(lt.x + lt.r) + 1, y0: Math.floor(lt.y - lt.r / lt.sy), y1: Math.ceil(lt.y + lt.r / lt.sy) + 1 }; }
function lightAt(lt, x, y) { const d = sq(x - lt.x, (y - lt.y) * lt.sy); return d < lt.r ? (1 - d / lt.r) ** (lt.p || 1.6) * lt.k : 0; }
function fillWarm(F, ox, lights, off, box) {
  const rw = F.rw, x0 = clamp(box.x0, 0, rw), x1 = clamp(box.x1, 0, rw), y0 = clamp(box.y0, 0, H), y1 = clamp(box.y1, 0, H);
  for (let y = y0; y < y1; y++) F.W.fill(0, y * rw + x0, y * rw + x1);
  for (const lt of lights) {
    if (off && off.has(lt.id)) continue;
    const b = lightBox(lt), bx0 = Math.max(x0, b.x0 + ox), bx1 = Math.min(x1, b.x1 + ox), by0 = Math.max(y0, b.y0), by1 = Math.min(y1, b.y1);
    for (let y = by0; y < by1; y++) for (let X = bx0; X < bx1; X++) { const v = lightAt(lt, X - ox, y); if (v > 0) F.W[y * rw + X] += v; }
  }
}
// the string lights: a sparkle round each bulb and a soft warm wash under the truss
function* fillString(F, ox, bulbs) {
  const rw = F.rw;
  for (let y = 0; y < H; y++) for (let X = 0; X < rw; X++) {
    if (X === 0 && (y & 31) === 31) yield;
    const x = X - ox;
    F.S[y * rw + X] = Math.max(0, 1 - sq((x - 160) / 1.7, (y - 30) * 1.1) / 250) ** 1.5 * 0.09;
  }
  for (let i = 0; i < bulbs.length; i++) {
    const b = bulbs[i], r = 34;
    if ((i & 7) === 7) yield;
    const x0 = Math.max(0, Math.floor(b.x - r) + ox), x1 = Math.min(rw, Math.ceil(b.x + r) + ox), y0 = Math.max(0, Math.floor(b.y - r)), y1 = Math.min(H, Math.ceil(b.y + r));
    for (let y = y0; y < y1; y++) for (let X = x0; X < x1; X++) { const d = sq(X - ox - b.x, (y - b.y - 1) * 1.1); if (d < r) F.S[y * rw + X] += (1 - d / r) ** 2.4 * (b.g === 2 ? 0.05 : 0.085); }
  }
}

// one lit version of a painted raster; key = hour × 4 + string lights × 2 + stove high. Alpha 254
// glows by itself. In bands of rows, so a big one can be spread over frames; with a rect, only that
// part, written into the canvas `into`
function* bakeGen(src, x0, y0, F, key, rect, into) {
  const { w, d } = src, rw = F.rw, st = key >> 2, so = (key >> 1) & 1, fl = key & 1 ? FHI : FLO, am = AMB[st];
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
      let cool = 0.24 * am, warm = 0;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) {
        const j = Y * rw + X;
        cool = F.C[j] * am; warm = F.W[j] + so * F.S[j] + fl * F.FI[j];
      }
      const tot = cool + warm, lv = Math.min(6, bandN(Math.min(6, Math.max(0, (tot - 0.1) / 0.15)), X, Y));
      const wf = warm / tot, side = wf > 0.47 ? 7 : wf < 0.31 ? 0 : bay(X + 2, Y + 1) < (wf - 0.31) / 0.16 ? 7 : 0;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c, st); }
      const o = rp[side + lv];
      out[o4] = o >> 16; out[o4 + 1] = (o >> 8) & 255; out[o4 + 2] = o & 255; out[o4 + 3] = al >= 253 ? 255 : al;
    }
    if (yy % 24 === 23) yield;
  }
  if (into) { into.getContext('2d').putImageData(img, bx, by); return into; }
  const c = document.createElement('canvas');
  c.width = bw; c.height = bh; c.getContext('2d').putImageData(img, 0, 0);
  return c;
}
const flv = (s) => FLO + (FHI - FLO) * s.fire;
// the lit colour of one painted colour at one point, for the moving things drawn over the bake
function litIdx(RM, x, y, s) {
  const F = RM.F, X = clamp(Math.round(x) + RM.ox, 0, RM.bw - 1), Y = clamp(Math.round(y), 0, H - 1), j = Y * RM.bw + X;
  const cool = F.C[j] * AMB[s.st], warm = F.W[j] + s.str * F.S[j] + flv(s) * F.FI[j], tot = cool + warm;
  return (warm / tot > 0.38 ? 7 : 0) + Math.min(6, Math.max(0, Math.round((tot - 0.1) / 0.15)));
}
const lit = (RM, x, y, c, s) => rampHex(c, s.st)[litIdx(RM, x, y, s)];

/* ——— outside: the forest in the rain ———
   Painted once in afternoon colours, then turned to dusk and night by a mapping of every colour. */
const OUTC = new Map();
function outT(c, st) {
  if (!st) return c;
  const key = c * 3 + st;
  let o = OUTC.get(key);
  if (o !== undefined) return o;
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => clamp(Math.round(v), 0, 255);
  o = st === 1 ? (ch(r * 0.55 + 16) << 16) | (ch(g * 0.6 + 14) << 8) | ch(b * 0.74 + 34)
    : (ch(r * 0.2 + 6) << 16) | (ch(g * 0.25 + 11) << 8) | ch(b * 0.34 + 24);
  OUTC.set(key, o);
  return o;
}
function stageCanvases(R) {
  return [0, 1, 2].map((st) => {
    const d = new Uint8ClampedArray(R.d);
    if (st) for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const c = outT((d[i] << 16) | (d[i + 1] << 8) | d[i + 2], st); d[i] = c >> 16; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; }
    return toCanvas(d, R.w, R.h);
  });
}
// a fir: tiers of drooping boughs from a spire of a top, widening down the trunk; lit from the left
function fir(R, cx, tip, base, hw, cols, seed, crownTo = base, moss = 0) {
  const r = rng(seed), [body, shade, lit0] = cols, h = crownTo - tip, tierH = 6 + r() * 4;
  for (let y = Math.floor(tip); y < crownTo; y++) {
    const u = (y - tip) / Math.max(1, Math.min(h, hw * 6.5)), tu = frac((y - tip) / tierH);
    let w = hw * Math.min(1, u) ** 0.9 * (0.5 + 0.5 * tu) + (r() - 0.5) * 1.1;
    if (y - tip < 3) w = 0.3;
    const x0 = Math.round(cx - w), x1 = Math.round(cx + w);
    for (let x = x0; x <= x1; x++) R.px(x, y, x > cx + w * 0.2 ? shade : x < cx - w * 0.55 && tu > 0.25 ? lit0 : body);
    if (tu > 0.84 && w > 2) {
      R.px(x0 - 1, y + 1, body); R.px(x1 + 1, y + 1, shade);
      // moss hanging from the bough tips, in beards
      if (moss && r() < 0.45) for (let k = 0; k < 2 + r() * 3; k++) R.px(x0 + (r() < 0.5 ? 0 : 1), y + 2 + k, moss);
      if (moss && r() < 0.3) for (let k = 0; k < 2 + r() * 2; k++) R.px(x1, y + 2 + k, moss);
    }
  }
  const tw = Math.max(2, Math.round(hw / 5));
  if (crownTo < base) for (let y = crownTo; y < base; y++) { R.rect(Math.round(cx - tw / 2), y, tw + (y > base - 4 ? 1 : 0), 1, cols[3] ?? shade); if (tw > 2) R.px(Math.round(cx - tw / 2), y, mixc(cols[3] ?? shade, 0xffffff, 0.15)); }
}
// a sword fern: fronds arching out of a clump and over, leaflets either side shortening to the tip
function fern(R, x, y, n, len, seed, cols) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (n > 1 ? i / (n - 1) - 0.5 : 0) * 2.7 + (r() - 0.5) * 0.25, L = len * (0.7 + r() * 0.45), c = cols[(i + (r() < 0.4 ? 1 : 0)) % cols.length];
    const dir = Math.cos(a) < 0 ? -1 : 1, droop = 1 + r() * 0.6;
    let px = x, py = y;
    for (let k = 0; k < L; k++) {
      const u = k / L, ang = a + dir * u ** 1.4 * droop;
      px += Math.cos(ang); py += Math.sin(ang) * 0.85;
      R.px(Math.round(px), Math.round(py), c);
      if (k % 2 === 0 && u > 0.08 && u < 0.92) {
        const lw = Math.max(1, Math.round((1 - u) * 2.4)), nx = -Math.sin(ang), ny = Math.cos(ang);
        for (let q = 1; q <= lw; q++) { R.px(Math.round(px + nx * q), Math.round(py + ny * q * 0.8 + q * 0.3), c); R.px(Math.round(px - nx * q), Math.round(py - ny * q * 0.8 + q * 0.3), c); }
      }
    }
  }
}
// a rounded stone with a cap of moss, lit from the upper left
function mossRock(R, cx, cy, rx, ry, seed) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = sq(x / (rx + 0.5), y / (ry + 0.5));
    if (d > 1 || (y > ry * 0.6 && d > 0.85)) continue;
    const l = -x / rx * 0.5 - y / ry * 0.7 + (vnoise((cx + x) / 2.5 + seed, (cy + y) / 2.5) - 0.5) * 0.6;
    const moss = y / ry < -0.15 + vnoise((cx + x) / 3 + seed * 3, cy / 3) * 0.5;
    const c = moss ? (l > 0.35 ? 0x8aac52 : l > -0.1 ? 0x6a9040 : 0x4c6e32) : (l > 0.3 ? 0x8a8e86 : l > -0.2 ? 0x6e726c : 0x4e524e);
    R.px(cx + x, cy + y, c);
  }
}
// a big trunk close by: fibrous bark in vertical strands, moss up its shaded side, a flared foot
function bigTrunk(R, x0, w, top, base, seed) {
  for (let y = top; y < base; y++) {
    const flare = Math.max(0, (y - (base - 12)) / 12) ** 2 * 5, l = Math.round(x0 - flare), r = Math.round(x0 + w + flare * 0.8);
    for (let x = l; x < r; x++) {
      const u = (x - l) / Math.max(1, r - l), strand = vnoise(x * 0.9 + seed, y / 9);
      let c = strand > 0.62 ? 0x5a4636 : strand < 0.3 ? 0x2e241c : 0x40322a;
      if (u < 0.18) c = 0x5e4a3a; else if (u > 0.8) c = 0x261e18;
      if (u > 0.5 && vnoise(x / 3 + seed * 5, y / 6) > 0.52 - (y - top) / (base - top) * 0.2) c = vnoise(x / 2, y / 2) > 0.5 ? 0x6e9040 : 0x4e7034;
      R.px(x, y, c);
    }
  }
}
function creekY(x) { return 172 + Math.round(1.6 * Math.sin(x * 0.021 + 1) + 0.8 * Math.sin(x * 0.057)); }

function paintFar(R) {
  // the sky, bright and overcast, paler down into the mist
  bands(R, 0, PY, PW, 104, [0xa6bab4, 0xafc2bb, 0xb9cac3, 0xc2d0ca, 0xc9d5cf]);
  R.rect(0, PY + 104, PW, PH - 104, 0xc9d5cf);
  // the farthest firs, ghosts in the mist; a nearer row a shade darker
  const r = rng(5);
  for (let x = -10; x < PW + 10; x += 7 + r() * 9) fir(R, x, 92 + r() * 22, PY + PH, 5 + r() * 4, [0xa0b4ad, 0x98ada6, 0xa8bbb4], Math.floor(r() * 1e4));
  for (let x = -6; x < PW + 10; x += 11 + r() * 13) fir(R, x, 80 + r() * 26, PY + PH, 7 + r() * 5, [0x8aa199, 0x80978f, 0x94aaa2], Math.floor(r() * 1e4));
}
function paintMid(R) {
  const r = rng(9), MID = [0x5a766c, 0x4b675e, 0x6a877b, 0x40463f];
  // mid firs; leave a gap over the creek's middle so the misty ones far back show through
  const xs = [];
  for (let x = -4; x < PW + 8; x += 15 + r() * 16) if (x < 226 || x > 272) xs.push(x);
  for (const x of xs) {
    const tip = 54 + r() * 30, hw = 9 + r() * 6;
    fir(R, x, tip, 160, hw, MID, Math.floor(r() * 1e4), 126 + Math.floor(r() * 24), 0x7a9480);
  }
  // a few slimmer trees nearer the gap, darker, their lower trunks bare
  for (const [x, tip, hw] of [[218, 70, 8], [282, 64, 9]]) fir(R, x, tip, 162, hw, [0x4a665a, 0x3e584e, 0x5a7668, 0x36403a], x, 132, 0x6e8a74);
  mossyMaple(R, 304, 160, 5);
}
// a bigleaf maple, leaning, its trunk and limbs furred with moss, ferns along their tops, beards of
// moss hanging from them and a few clumps of pale leaves
function mossyMaple(R, x, base, seed) {
  const r = rng(seed), BARK = 0x3a4032, BARKL = 0x4e5644, M1 = 0x4e6e34, M2 = 0x6a8c40, M3 = 0x8aac52;
  // the trunk, leaning a little, out of the top of the view
  for (let y = PY; y < base; y++) {
    const cx = x - (base - y) * 0.09, w = 3.4 + Math.max(0, (y - base + 10) / 10) * 2;
    for (let xx = Math.round(cx - w); xx <= Math.round(cx + w); xx++) {
      const u = (xx - (cx - w)) / (2 * w), mossy = u < 0.55 && vnoise(xx / 2 + seed, y / 3) > 0.32 - u * 0.4;
      R.px(xx, y, mossy ? (u < 0.15 ? M3 : vnoise(xx, y / 2) > 0.5 ? M2 : M1) : u > 0.8 ? 0x2a2e24 : vnoise(xx, y / 5) > 0.5 ? BARKL : BARK);
    }
  }
  // a great limb reaching left over the creek, drooping at its end, furred with moss on top, ferns
  // along it and beards of moss hanging under it
  const limb = (x0, y0, len, droop, w) => {
    for (let k = 0; k <= len; k++) {
      const u = k / len, px = Math.round(x0 - k), py = Math.round(y0 - Math.sin(u * Math.PI * 0.8) * 6 + u * u * droop), ww = Math.max(1, Math.round(w * (1 - u * 0.6)));
      for (let j = 0; j < ww; j++) R.px(px, py + j, j === ww - 1 ? 0x2a2e24 : BARK);
      for (let j = 1; j <= 2; j++) if (vnoise(px / 2 + seed, j) > 0.3) R.px(px, py - j, j === 2 ? M3 : M2);
      if (k % 4 === 1 && r() < 0.7) for (let q = 0; q < 2 + r() * 7; q++) R.px(px, py + ww + q, q % 3 === 2 ? 0x8aa47a : 0x9cb28a);
      if (k % 5 === 2) { R.px(px, py - 3, 0x4a8434); R.px(px - 1, py - 4, 0x5a9a40); R.px(px + 1, py - 4, 0x4a8434); }
    }
  };
  limb(x - 5, 112, 44, 10, 3);
  limb(x - 9, 80, 22, 6, 2);
  // a few clumps of pale new leaves
  for (const [lx, ly] of [[x - 30, 98], [x - 46, 112], [x - 22, 70], [x - 40, 120]]) { R.rect(lx - 2, ly, 4, 2, 0x7a9a4a); R.px(lx - 1, ly - 1, 0x9ab85e); R.px(lx + 2, ly + 1, 0x6a8a40); }
}
function paintGround(R) {
  const r = rng(21);
  // the far bank: moss and low ferns at the foot of the trees
  for (let x = 0; x < PW; x++) {
    const top = 155 + Math.round(Math.sin(x * 0.07) * 1.2 + Math.sin(x * 0.023 + 2) * 1.5), cy = creekY(x);
    for (let y = top; y < cy - 4; y++) {
      const n = vnoise(x / 5, y / 3);
      R.px(x, y, y === top ? 0x627e44 : n > 0.64 ? 0x52703e : n < 0.3 ? 0x30482c : 0x40603a);
    }
  }
  // salal and huckleberry along the foot of the trees: low dark clumps, a few leaves catching the light
  for (let x = 2; x < PW; x += 5 + Math.floor(r() * 9)) {
    const w = 2.5 + r() * 4, h = 1.5 + r() * 2.2, y = 156 + Math.round(r() * 2);
    R.ell(x, y, w, h, r() < 0.5 ? 0x2a4430 : 0x30503a); R.px(x - 1, y - Math.round(h), 0x4e6e46); R.px(x + 1, y - Math.round(h) + 1, 0x5e7e4e);
  }
  for (let x = 4; x < PW; x += 9 + Math.floor(r() * 12)) fern(R, x, 162, 5, 5 + r() * 3, Math.floor(r() * 1e4), [0x5e8c42, 0x4a7638, 0x76a250]);
  // the creek: the pale sky held in it, darker where it runs deep, a wet lip at each edge
  for (let x = 0; x < PW; x++) {
    const cy = creekY(x);
    for (let y = cy - 4; y <= cy + 4; y++) {
      const k = y - (cy - 4);
      let c = k === 0 ? 0x2e4030 : k === 8 ? 0x2a3a28 : k < 3 ? 0x8aa29c : k < 6 ? 0x6e8c88 : 0x587470;
      if (k > 1 && k < 8 && vnoise(x / 2.6, 7) > 0.6) c = mixc(c, 0x2e4a40, 0.55);   // the trees held upside down in it
      if (k > 0 && k < 8 && vnoise(x / 6, y * 1.7) > 0.74) c = 0xb0c6c0;
      R.px(x, y, c);
    }
  }
  // stepping stones across it
  for (const [x, dy] of [[222, -3], [228, -1], [234, 1], [240, 3]]) {
    const cy = creekY(x) + dy;
    R.ell(x, cy, 2.5, 1, 0x5a5e58); R.rect(x - 2, cy - 1, 5, 1, 0x8e928a); R.px(x - 1, cy - 1, 0xa8ac9e); R.px(x + 2, cy, 0x6a8a44);
  }
  // the near bank: richer moss
  for (let x = 0; x < PW; x++) {
    const cy = creekY(x);
    for (let y = cy + 5; y < 188; y++) { const n = vnoise(x / 4 + 9, y / 3); R.px(x, y, n > 0.66 ? 0x5e8240 : n < 0.28 ? 0x3a5630 : 0x4a6c36); }
  }
  // the fallen log, moss along its top, its cut end pale with rings; a row of little mushrooms
  for (let x = LOG.x0; x < LOG.x1; x++) for (let y = LOG.y - 3; y <= LOG.y + 2; y++) {
    const k = y - (LOG.y - 3);
    let c = k === 0 ? 0x7aa04a : k === 1 ? (vnoise(x / 2, 3) > 0.45 ? 0x6a9040 : 0x5a4836) : k < 4 ? 0x4e3e30 : k === 4 ? 0x3e3026 : 0x2a221c;
    if (k === 1 && x % 7 === 3) c = 0x8ab454;
    R.px(x, y, c);
  }
  R.ell(LOG.x1, LOG.y, 1, 2.5, 0xb0946a); R.px(LOG.x1, LOG.y, 0x8a6e4a); R.px(LOG.x1 + 1, LOG.y - 1, 0x7a603e);
  for (const mx of [246, 249, 251, 254, 257]) { R.px(mx, LOG.y - 4, 0xd8ccb0); R.px(mx + 1, LOG.y - 4, 0xc8bc9e); R.px(mx, LOG.y - 5, 0xe8dcc0); }
  // rocks with moss caps
  for (const [x, y, rx, ry] of [[204, 182, 6, 4], [298, 183, 5, 3], [96, 181, 5, 3], [150, 158, 4, 2], [430, 182, 6, 4], [36, 182, 5, 3]]) mossRock(R, x, y, rx, ry, x);
  // the near cedar: a big trunk on the left of the gable window, a branch out over the bank with
  // moss hanging from it (the owl's perch), and its boughs drooping over the top of the view
  bigTrunk(R, 174, 12, PY, 188, 3);
  R.thick(186, 128, 214, 125, 1, 0x3a2e24); R.line(186, 127, 214, 124, 0x5a4636);
  for (const [x, len] of [[196, 6], [201, 9], [205, 5], [209, 8], [213, 4]]) for (let k = 0; k < len; k++) R.px(x + (k > len * 0.6 ? 1 : 0), 128 + k, k % 3 === 2 ? 0x8a9a7a : 0xa4b28e);
  for (let i = 0; i < 7; i++) {
    const bx = 150 + i * 14 + r() * 6, by = PY + r() * 10;
    for (let k = 0; k < 22; k++) {
      const x = Math.round(bx + k * 1.4), y = Math.round(by + (k / 22) ** 1.6 * 14);
      for (let j = 0; j < 4 - k / 8; j++) R.px(x, y + j, j === 0 ? 0x3a5a40 : j < 2 ? 0x2a4434 : 0x1e3428);
      if (k % 3 === 0) R.px(x + 1, y + 3, 0x2a4434);
    }
  }
  // more near trunks, for the other windows' views
  bigTrunk(R, 40, 7, PY, 188, 11); bigTrunk(R, 432, 9, PY, 189, 13); bigTrunk(R, 368, 5, PY, 160, 17);
  // the bird feeder hanging in the far window's view
  R.line(417, PY, 417, 166, 0x2a2420); R.rect(413, 166, 9, 2, 0x5a3e2a); R.rect(414, 168, 7, 6, 0xb08a54); R.rect(413, 174, 9, 1, 0x5a3e2a); R.rect(415, 170, 5, 3, 0x8a6a3a);
  // sword ferns on the near bank
  for (const [x, n, len] of [[132, 7, 9], [190, 6, 8], [222, 7, 10], [272, 6, 8], [318, 7, 9], [96, 8, 11], [60, 6, 8], [410, 7, 10], [356, 6, 8], [454, 6, 9]]) fern(R, x, 186, n, len, x * 7, [0x4e8034, 0x3a6a2c, 0x68983e]);
  // the porch: its edge board, wet boards (the sky's sheen on them), and the puddle under the eaves
  for (let y = 188; y < PY + PH; y++) for (let x = 0; x < PW; x++) {
    let c;
    if (y < 190) c = y === 188 ? 0x7a7268 : 0x3a2e26;
    else {
      const k = (y - 190) % 3;
      c = k === 2 ? 0x2a201a : Math.floor((y - 190) / 3) % 2 ? 0x5e4e42 : 0x665448;
      if (k === 0 && vnoise(x / 9, y) > 0.68) c = 0x8a8a82;
    }
    R.px(x, y, c);
  }
  R.ell(PUD.x, PUD.y, PUD.rx, 1, 0x7e928e); R.rect(PUD.x - PUD.rx + 2, PUD.y, PUD.rx * 2 - 3, 1, 0xa2b6b0); R.rect(PUD.x - 3, PUD.y - 1, 5, 1, 0x96aaa4);
}
// a band of mist that tiles and drifts
function mistBand(w, h, col, a0, seed) {
  const R = new Ras(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const env = Math.sin((y / (h - 1)) * Math.PI) ** 1.3;
    const n = 0.5 + 0.3 * Math.sin((x / w) * Math.PI * 2 * 3 + y * 0.15 + seed) + 0.2 * Math.sin((x / w) * Math.PI * 2 * 7 + seed * 2);
    const q = band(env * n * 3.4, x, y);
    if (q > 0) R.px(x, y, col, [0, a0, a0 * 1.8, a0 * 2.6][Math.min(3, q)]);
  }
  return R.canvas();
}
// light breaking through the trees once the rain stops: slanting shafts
function rays(col) {
  const R = new Ras(PW, PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const v = 0.5 + 0.5 * Math.sin((x + y * 0.55) * 0.11 + Math.sin(x * 0.013) * 3), f = Math.max(0, 1 - y / (PH * 0.95));
    const q = band(Math.max(0, v - 0.55) * 2.2 * f * 3, x, y);
    if (q > 0) R.px(x, y, col, q * 0.055);
  }
  return R.canvas();
}
// the creatures: a black-tailed deer, a little owl, a tree frog; painted small, one frame each
function paintDeer(R, f) {
  const B = 0x9a6c46, D = 0x5e3e28, L = 0xc09a70, K = 0x221810, fy = 19, bx = 6;
  const step = f === 0 ? 1 : f === 1 ? -1 : 0;
  for (const [lx, o] of [[bx + 1, step], [bx + 3, -step], [bx + 9, -step], [bx + 11, step]]) { R.rect(lx + o, fy - 5, 1, 5, D); R.px(lx + o, fy, K); }
  R.rect(bx, fy - 9, 13, 1, D); R.rect(bx - 1, fy - 8, 15, 2, B); R.rect(bx, fy - 6, 13, 1, L); R.rect(bx + 1, fy - 5, 11, 1, B);
  R.rect(bx + 13, fy - 8, 1, 2, 0xc8b090); R.px(bx + 14, fy - 8, K); R.px(bx + 14, fy - 7, K);   // the rump, the dark tail
  if (f === 3) {   // drinking: the neck down to the water
    R.line(bx + 1, fy - 8, bx - 2, fy - 3, B); R.line(bx + 2, fy - 8, bx - 1, fy - 3, B);
    R.rect(bx - 5, fy - 2, 4, 2, B); R.px(bx - 6, fy - 1, K); R.px(bx - 1, fy - 4, D); R.px(bx, fy - 5, D);
  } else {
    const up = f === 4 ? 2 : 0;
    R.rect(bx, fy - 12 - up, 2, 4 + up, B); R.px(bx - 1, fy - 11 - up, B);
    R.rect(bx - 3, fy - 14 - up, 4, 2, B); R.rect(bx - 4, fy - 13 - up, 2, 1, B); R.px(bx - 5, fy - 13 - up, K); R.px(bx - 1, fy - 14 - up, K);
    R.px(bx, fy - 15 - up, D); R.px(bx + 1, fy - 16 - up, D); if (f === 4) { R.px(bx + 1, fy - 17 - up, D); R.px(bx - 1, fy - 16 - up, D); }
  }
}
function paintOwl(R, f) {   // f: 0 eyes open, 1 shut, 2 hooting (puffed)
  const B = 0x6e5c48, C = 0x9a866a, F = 0xb4a486, K = 0x3a2e24, puff = f === 2 ? 1 : 0;
  R.ell(3, 6, 2.5 + puff, 3, B); R.rect(2 - puff, 6, 3 + puff * 2, 3, C); R.px(3, 7, B); R.px(2, 8, B); R.px(4, 6, B);
  R.rect(1, 1, 5, 4, B); R.px(0, 0, K); R.px(6, 0, K); R.px(1, 1, K); R.px(5, 1, K);
  R.rect(1, 2, 5, 2, F);
  const eye = f === 0 ? 0xe8c040 : 0x5a4a38;
  R.px(2, 2, eye); R.px(4, 2, eye); R.px(3, 3, 0x8a7a50);
  R.px(2, 9, 0x8a7a50); R.px(4, 9, 0x8a7a50);
}
function paintFrog(R, f) {
  R.rect(0, 2, 6, 2, 0x4a7a30); R.rect(1, 1, 4, 2, 0x6a9a40); R.px(1, 0, 0x7aaa48); R.px(4, 0, 0x7aaa48); R.px(1, 1, 0x1e2a14); R.px(4, 1, 0x1e2a14);
  R.px(0, 3, 0x3a6226); R.px(5, 3, 0x3a6226);
  if (f === 1) { R.rect(2, 3, 2, 2, 0xd8e0a0); }
}

let OUT = null;
function outside() {
  if (OUT) return OUT;
  const O = {};
  const far = new Ras(PW, PH, 0, -PY); paintFar(far); O.far = stageCanvases(far);
  const mid = new Ras(PW, PH, 0, -PY); paintMid(mid); O.mid = stageCanvases(mid);
  const gr = new Ras(PW, PH, 0, -PY); paintGround(gr); O.ground = stageCanvases(gr);
  const MC = [0xd4ded8, 0x7a8298, 0x2a3244];
  O.mistW = PW + 80;
  O.mistA = MC.map((c, st) => mistBand(O.mistW, 40, c, [0.09, 0.1, 0.11][st], 1));
  O.mistB = MC.map((c, st) => mistBand(O.mistW, 30, c, [0.08, 0.09, 0.1][st], 4));
  O.mistC = MC.map((c, st) => mistBand(O.mistW, 14, c, [0.07, 0.08, 0.09][st], 7));
  O.rays = [0xfff2c8, 0xffb070, 0xa8c0f0].map(rays);
  const sprites = (n, w, h, paint) => Array.from({ length: n }, (_, f) => { const R = new Ras(w, h); paint(R, f); return stageCanvases(R); });
  O.deer = sprites(5, 22, 22, paintDeer);
  O.owl = sprites(3, 7, 10, paintOwl);
  O.frog = sprites(2, 6, 5, paintFrog);
  // the forest standing still, for the drops on the glass to hold a little of it, at each hour
  O.beads = WINS.map(() => []);
  for (let st = 0; st < 3; st++) {
    const c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(O.far[st], 0, 0); g.drawImage(O.mistA[st], 0, 112 - PY); g.drawImage(O.mid[st], 0, 0); g.drawImage(O.mistB[st], 0, 138 - PY); g.drawImage(O.ground[st], 0, 0);
    const sd = g.getImageData(0, 0, PW, PH).data;
    const stillAt = (x, y) => { x = clamp(Math.round(x), 0, PW - 1); y = clamp(Math.round(y - PY), 0, PH - 1); const i = (y * PW + x) * 4; return (sd[i] << 16) | (sd[i + 1] << 8) | sd[i + 2]; };
    WINS.forEach((W, i) => { O.beads[i][st] = glassBeads(W, 31 + i * 6, stillAt, st); });
  }
  return (OUT = O);
}

/* ——— the glass ——— */
// the panes of a window, in screen pixels: [x, y, w, h]
function panesOf(W) {
  if (W.kind === 'gable') return [[88, 106, 35, 92], [125, 106, 34, 92], [161, 106, 34, 92], [197, 106, 35, 92]];
  const mx = (W.x0 + W.x1) >> 1, my = (W.y0 + W.yB) >> 1;
  return [[W.x0, W.y0, mx - W.x0, my - W.y0], [mx + 1, W.y0, W.x1 - mx - 1, my - W.y0], [W.x0, my + 1, mx - W.x0, W.yB - my - 1], [mx + 1, my + 1, W.x1 - mx - 1, W.yB - my - 1]];
}
// one drop on the glass: a bright shoulder where it catches the room, a body holding the forest from
// a few pixels above it (upside down, as a lens does, and a little brighter), a dark lip below
function paintBead(R, x, y, size, refr, hi) {
  const lip = 0x101810;
  if (size === 1) { R.px(x, y, refr(x, y, 3, 0.3), 0.6); R.px(x, y + 1, lip, 0.3); return; }
  if (size === 2) {
    R.px(x, y, hi, 0.6); R.px(x + 1, y, refr(x + 1, y, 4, 0.2), 0.7);
    R.px(x, y + 1, refr(x, y + 1, 5, 0.25), 0.75); R.px(x + 1, y + 1, refr(x + 1, y + 1, 8, 0.45), 0.85);
    R.px(x, y + 2, lip, 0.45); R.px(x + 1, y + 2, lip, 0.38);
    return;
  }
  R.px(x + 1, y, refr(x + 1, y, 3, 0.25), 0.7);
  R.px(x, y + 1, hi, 0.62); R.px(x + 1, y + 1, refr(x + 1, y + 1, 5, 0.25), 0.74); R.px(x + 2, y + 1, refr(x + 2, y + 1, 5, 0.2), 0.7);
  R.px(x, y + 2, refr(x, y + 2, 7, 0.3), 0.75); R.px(x + 1, y + 2, refr(x + 1, y + 2, 9, 0.5), 0.9); R.px(x + 2, y + 2, refr(x + 2, y + 2, 7, 0.3), 0.75);
  R.px(x, y + 3, lip, 0.32); R.px(x + 1, y + 3, lip, 0.52); R.px(x + 2, y + 3, lip, 0.32);
}
// drops already on a window's glass, gathered mostly along its bars and its foot
function glassBeads(W, seed, stillAt, st) {
  const gw = W.x1 - W.x0, gh = W.yB - W.y0, gl = new Ras(gw, gh, -W.x0, -W.y0), dr = rng(seed), taken = new Uint8Array(gw * gh);
  const hi = [0xf0f6f0, 0xd8e0f0, 0x9aa8c8][st], tintc = [0xe6eee8, 0xb8c2d8, 0x6a7898][st];
  const near = (x, y) => {
    let d = Math.min(x - W.x0, W.x1 - 1 - x, (W.yB - 1 - y) * 0.7);
    if (W.kind === 'gable') { for (const m of [124, 160, 196]) d = Math.min(d, Math.abs(x - m) - 1); d = Math.min(d, Math.abs(y - 105) - 1, (y - winTop(x)) * 0.8); }
    else { d = Math.min(d, Math.abs(x - ((W.x0 + W.x1) >> 1)), Math.abs(y - ((W.y0 + W.yB) >> 1)), y - W.y0); }
    return Math.max(0, d);
  };
  const refr = (x, y, up, k) => mixc(stillAt(W.src + x - W.x0, y - up), tintc, k);
  const n = Math.round((gw * gh) / 8);
  for (let i = 0; i < n; i++) {
    const x = W.x0 + Math.floor(dr() * (gw - 1)), y = W.y0 + Math.floor(dr() * (gh - 4)), size = dr() < 0.14 ? 3 : dr() < 0.5 ? 2 : 1;
    if (!inWin(W, x, y) || isBar(W, x, y) || dr() > 0.014 + 0.5 * Math.exp(-near(x, y) / 1.8)) continue;
    let free = true;
    for (let yy = y - 2; yy < y + size + 3 && free; yy++) for (let xx = x - 2; xx < x + size + 2; xx++) { const k = (yy - W.y0) * gw + xx - W.x0; if (xx >= W.x0 && yy >= W.y0 && xx < W.x1 && yy < W.yB && taken[k]) { free = false; break; } }
    if (!free) continue;
    for (let yy = y; yy < y + size + 1; yy++) for (let xx = x; xx < x + size; xx++) if (xx < W.x1 && yy < W.yB) taken[(yy - W.y0) * gw + xx - W.x0] = 1;
    paintBead(gl, x, y, size, refr, hi);
  }
  return gl.canvas();
}

/* ——— the room ——— */
const CEIL = [0xb08a60, 0xa98258, 0xb69066, 0xa47e56, 0xb28c5e];
const PLANK = [0x927052, 0x8b694c, 0x987656, 0x846448, 0x8f6d4f];
const OAK = [0x8a603c, 0x82593a, 0x916744, 0x7c5636, 0x8c6240];
const TIMBER = 0x70503a, TIMBERL = 0x9a7050, TIMBERD = 0x3e2a1c;
const RAFTERS = [1.12, 1.3, 1.62];
// how near the ceiling is at a point (1 at the back wall, more nearer you), and how far across the
// slope from the ridge it lies, at the back wall's scale
function ceilS(x, y) {
  const dx = Math.abs(x - VPX);
  let s = (VPY + K1 * dx - y) / (VPY - Y0);
  if (dx / s <= KINK) return [s, dx / s];
  s = (VPY + K2 * dx - y) / (VPY - (YK - KINK * K2));
  return [s, dx / s];
}
// the underside of the roof: boards running toward you (their seams meet far off), the rafters
// across them, the valley beam where the wings meet the gable (full screen)
function* paintCeiling(R, lay) {
  for (let x = lay.L; x < lay.RT; x++) {
    if ((x & 63) === 63) yield;
    const xc = x + 0.5, ry = roofY(xc), nb = xc < VPX ? 1 : -1;
    for (let y = 0; y < ry - 0.5 && y < H; y++) {
      const yc = y + 0.5, [s, u] = ceilS(xc, yc);
      let c = -1;
      for (const rf of RAFTERS) { const w = 0.022 * rf * rf; if (s >= rf && s < rf + w) { const f = (s - rf) / w; c = f > 0.8 ? 0x4a3222 : f < 0.2 ? 0x9a7250 : 0x7a5638; break; } }
      if (c < 0 && s < 1.024) c = s < 1.01 ? 0x5a3e28 : 0x7e5a3c;
      if (c < 0 && lay.rw > 320 && Math.abs(u - KINK) < 2.6) c = Math.abs(u - KINK) > 1.7 ? 0x4e3624 : 0x76543a;
      if (c < 0) {
        const u1 = ceilS(xc + nb, yc)[1], pk = Math.floor(u / 6.5);
        if (pk !== Math.floor(u1 / 6.5)) c = 0x6e5036;
        else {
          const o = hash(pk, 7) * 3, j = Math.floor(s * 2.2 + o);
          c = Math.floor(ceilS(xc, yc + 1)[0] * 2.2 + o) !== j ? 0x765638 : CEIL[Math.floor(hash(pk, j) * CEIL.length)];
          if (hash(x, y * 3) < 0.04) c = mixc(c, 0x6e5036, 0.4);
        }
      }
      R.px(x, y, c);
    }
  }
}
// the walls: wide boards laid level, their joints staggered, a knot here and there
function* paintWall(R, lay) {
  for (let x = lay.L; x < lay.RT; x++) {
    if ((x & 63) === 63) yield;
    const top = Math.max(0, Math.ceil(roofY(x + 0.5) - 0.5));
    for (let y = top; y < FLOOR; y++) {
      const row = Math.floor((y + 3) / 7), ry = (y + 3) % 7, sl = 84 + Math.floor(hash(row, 5) * 64), xo = x + 4000 + Math.floor(hash(row, 3) * 120), seg = Math.floor(xo / sl);
      let c = PLANK[Math.floor(hash(row, seg) * PLANK.length)];
      if (ry === 6) c = 0x5a3c26;
      else if (xo % sl === 0) c = 0x5e4028;
      else if (ry === 0) c = mixc(c, 0xd8b088, 0.14);
      else if (hash(x, y * 7 + row) < 0.035) c = mixc(c, 0x5a3c26, 0.35);
      R.px(x, y, c);
    }
  }
  // knots
  for (let row = 0; row < 36; row++) for (let k = 0; k < Math.ceil(lay.rw / 50); k++) {
    if (hash(row * 31 + k, 9) > 0.16) continue;
    const x = lay.L + k * 50 + Math.floor(hash(row, k) * 44), y = row * 7 - 3 + 3;
    if (y < roofY(x) + 3 || y > FLOOR - 3) continue;
    R.px(x, y, 0x6a4428); R.px(x + 1, y, 0x5a3a22); R.px(x - 1, y, 0x845a38); R.px(x + 2, y, 0x845a38);
  }
}
// the floor: wide oak boards running away from you, and the skirting
function* paintFloor(R, lay) {
  for (let y = FLOOR; y < H; y++) {
    if ((y & 15) === 15) yield;
    const yc = y + 0.5, k = (FLOOR + 1 - VPY) / (yc - VPY), z = 1 / (yc - VPY), z1 = 1 / (yc - 1 - VPY);
    for (let x = lay.L; x < lay.RT; x++) {
      const xc = x + 0.5, u = (xc - VPX) * k, b = Math.floor(u / 13), b1 = Math.floor((xc + (xc < VPX ? 1 : -1) - VPX) * k / 13);
      let c;
      if (b !== b1) c = 0x4e3420;
      else {
        const o = hash(b, 2) * 4, j = Math.floor(z * 520 + o);
        c = j !== Math.floor(z1 * 520 + o) && y > FLOOR ? 0x5a3c26 : OAK[Math.floor(hash(b, j) * OAK.length)];
        if (hash(x * 3 + b, y) < 0.05) c = mixc(c, 0x5a3c26, 0.3);
      }
      R.px(x, y, c);
    }
  }
  for (let x = lay.L; x < lay.RT; x++) { R.px(x, FLOOR - 4, 0x8a6444); R.px(x, FLOOR - 3, 0x6e4c32); R.px(x, FLOOR - 2, 0x6e4c32); R.px(x, FLOOR - 1, 0x4a3220); }
}
// a braided rug in rings of rust, mustard, moss, cream and slate
const RUG = [0x7a3424, 0xd6c6a0, 0x9a4a2e, 0x5e7248, 0xc8a048, 0x4e5c6c, 0xd6c6a0, 0x8e4028, 0x6a7c50, 0xc8a048, 0x9a4a2e];
function paintRug(R) {
  const cx = 158, cy = 294, rx = 118, ry = 25;
  for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = sq(dx, dy);
    if (d > 1) continue;
    const q = (1 - d) * 11, ring = Math.min(RUG.length - 1, Math.floor(q)), base = RUG[ring];
    const arc = Math.atan2(dy, dx) * (d * (rx + ry) * 0.5), k = Math.floor(arc / 2.4 + (ring % 2) * 0.5);
    let c = k & 1 ? base : mixc(base, 0xfff4e0, 0.12);
    if (frac(q) < 0.14 && ring > 0) c = mixc(base, 0x2a1810, 0.35);
    R.px(x, y, c);
  }
}
// a heavy post at the corner of the gable and a wing (full screen)
function post(R, x) {
  for (let y = Math.floor(roofY(x + 3)); y < FLOOR; y++) { R.rect(x, y, 6, 1, TIMBER); R.px(x, y, TIMBERL); R.px(x + 5, y, TIMBERD); if (y % 23 === 0) R.px(x + 2, y, 0x5a4030); }
  R.rect(x - 1, FLOOR - 6, 8, 6, 0x5e4230); R.rect(x - 1, FLOOR - 6, 8, 1, 0x8a6444);
}
// a small window in a bay: a timber frame lit along its inner edge, a cross of bars, a sill
function rectWindow(R, W) {
  const { x0, x1, y0, yB } = W;
  for (let y = y0 - 3; y < yB + 3; y++) for (let x = x0 - 3; x < x1 + 3; x++) {
    const g = inWin(W, x, y);
    if (g && !isBar(W, x, y)) { R.clear(x, y, 1, 1); continue; }
    let c = TIMBER;
    if (g) c = 0x6a4a34;
    else if (x === x0 - 1 || x === x1 || y === y0 - 1 || y === yB) c = TIMBERL;
    else if (x === x0 - 3 || x === x1 + 2 || y === y0 - 3) c = TIMBERD;
    R.px(x, y, c);
  }
  R.rect(x0 - 5, yB + 3, x1 - x0 + 10, 2, 0xa87c52); R.rect(x0 - 5, yB + 5, x1 - x0 + 10, 1, 0x5a3e28);
}
// the gable window: heavy posts, a head along the slope, glazing bars, and the window seat under it
function paintWindow(R) {
  const outTop = (x) => winTop(clamp(x, 88, 231)) - 6;
  for (let x = 82; x < 238; x++) for (let y = Math.floor(outTop(x + 0.5)); y < 198; y++) {
    const g = inWin(WIN, x, y), bar = g && isBar(WIN, x, y);
    if (g && !bar) { R.clear(x, y, 1, 1); continue; }
    let c;
    if (bar) c = x === 123 || x === 159 || x === 195 || y === 104 ? 0x8a6446 : 0x5e4230;
    else {
      const ng = inWin(WIN, x + 1, y) || inWin(WIN, x - 1, y) || inWin(WIN, x, y + 1) || inWin(WIN, x, y - 1);
      const edge = x === 82 || x === 237 || y < outTop(x + 0.5) + 1;
      c = ng ? TIMBERL : edge ? TIMBERD : hash(x, y >> 2) < 0.12 ? 0x64462f : TIMBER;
    }
    R.px(x, y, c);
  }
  // the seat: a deep top, its rounded lip, and a front of boards with two cubbies holding baskets
  R.rect(78, 198, 164, 5, 0xb08458); R.rect(78, 198, 164, 1, 0x8a6442); R.rect(78, 202, 164, 1, 0xc49866);
  R.rect(76, 203, 168, 3, 0x8a6040); R.rect(76, 203, 168, 1, 0xb08458); R.rect(76, 205, 168, 1, 0x5a3e28);
  for (let x = 80; x < 240; x++) for (let y = 206; y < FLOOR - 4; y++) R.px(x, y, (x - 80) % 11 === 0 ? 0x5e4028 : (x - 80) % 11 === 1 ? 0x9e7248 : 0x8e643f);
  for (const bx of [100, 188]) {
    R.rect(bx, 214, 32, 28, 0x2a1c14); R.rect(bx - 1, 213, 34, 1, 0x5a3e28); R.rect(bx - 1, 242, 34, 1, 0xa07450);
    // a woven basket in the cubby
    for (let y = 222; y < 242; y++) for (let x = bx + 2; x < bx + 30; x++) R.px(x, y, (x + (y >> 1)) % 3 === 0 ? 0x8a6a3e : y % 2 ? 0xb89058 : 0xa88050);
    R.rect(bx + 2, 222, 28, 1, 0xd0aa6c);
    if (bx === 100) { R.ell(bx + 10, 219, 6, 3, 0x9a4a3a); R.ell(bx + 10, 219, 3, 1, 0x7a3a2e); R.ell(bx + 21, 219, 6, 3, 0xd8ccb0); R.ell(bx + 21, 219, 3, 1, 0xb8ac90); }
    else { R.rect(bx + 5, 214, 3, 8, 0x3e5a6e); R.rect(bx + 8, 216, 4, 6, 0xc8a048); R.rect(bx + 12, 215, 3, 7, 0x8a3a2a); R.rect(bx + 17, 218, 9, 4, 0x5a7044); }
  }
  // the cat's cushion: sage green, plump, piped
  for (let y = 191; y < 199; y++) for (let x = 99; x < 142; x++) {
    const ex = Math.min(x - 99, 141 - x), ey = Math.min(y - 191, 198 - y);
    if (ex + ey < 2) continue;
    R.px(x, y, y === 191 || (y === 192 && ex < 3) ? 0xa4ba90 : y === 194 ? 0xc8d0a8 : y > 196 ? 0x5a7050 : 0x7e9670);
  }
  // a little potted fern and two books at the seat's other end
  R.rect(212, 190, 9, 8, 0xb86a44); R.rect(211, 189, 11, 2, 0xc87a50); R.rect(219, 191, 1, 7, 0x8a4a2e);
  fern(R, 216, 189, 6, 6, 41, [0x4e8a3c, 0x3a6e30, 0x6aa448]);
  R.rect(224, 195, 14, 3, 0x3e5a4a); R.rect(225, 192, 12, 3, 0xa8483a); R.rect(225, 192, 12, 1, 0xc86a52); R.rect(224, 195, 14, 1, 0x5a7a64);
}
// the stove: green tiles behind, a slate hearth, the cast-iron box on its legs, the stovepipe up
// into the roof (its fire, the kettle and the steam are drawn each frame)
const TILE = [0x6e9078, 0x668a72, 0x78987e, 0x62846c, 0x729480];
function paintStove(R) {
  for (let y = 148; y < FLOOR - 4; y++) for (let x = 244; x < 306; x++) {
    const row = Math.floor((y - 148) / 7), off = row % 2 ? 5 : 0, col = Math.floor((x - 244 + off) / 10);
    const gy = (y - 148) % 7 === 6, gx = (x - 244 + off) % 10 === 9;
    let c = gy || gx ? 0xb6ac94 : TILE[Math.floor(hash(row, col) * TILE.length)];
    if (!gy && !gx && (y - 148) % 7 === 0) c = mixc(c, 0xe8f0e0, 0.32);
    else if (!gy && !gx && (x - 244 + off) % 10 === 0) c = mixc(c, 0xe8f0e0, 0.15);
    R.px(x, y, c);
  }
  R.rect(242, 145, 66, 3, 0x6e4c32); R.rect(242, 145, 66, 1, 0x9a7050); R.rect(242, 147, 66, 1, 0x4a3222);
  // the hearth: a raised slab of slate
  for (let y = 246; y < 255; y++) {
    const l = Math.round(240 - (y - 246) * 0.6), r = Math.round(310 + (y - 246) * 0.6);
    for (let x = l; x < r; x++) R.px(x, y, y === 246 ? 0x6a6e74 : (x - l) % 13 === 0 || y === 250 ? 0x2e3034 : hash(x >> 2, y) < 0.3 ? 0x52565c : 0x4a4e54);
  }
  R.rect(234, 255, 82, 3, 0x34363a); R.rect(234, 255, 82, 1, 0x5a5e64);
  const I0 = 0x262428, I1 = 0x363436, I2 = 0x4a4848, I3 = 0x625e5c;
  // legs, cabriole-ish
  for (const lx of [255, 290]) { R.rect(lx, 237, 3, 10, I1); R.px(lx - 1, 246, I1); R.px(lx + 3, 246, I1); R.rect(lx, 237, 1, 9, I2); R.rect(lx - 1, 247, 5, 1, I0); }
  // the box, its right flank in shadow so it stands out from the wall
  R.rect(252, 202, 44, 36, I1); R.rect(296, 203, 4, 34, I0); R.rect(296, 203, 1, 34, I1);
  R.rect(252, 202, 44, 1, I3); R.rect(252, 203, 1, 34, I2); R.rect(252, 237, 48, 1, 0x1a181a);
  R.rect(254, 204, 40, 1, I2); R.rect(254, 235, 40, 1, I0);
  // a little fir cast into the flank
  for (let k = 0; k < 6; k++) R.rect(298 - (k >> 1), 212 + k * 2, 1 + (k >> 1), 1, I2);
  // the top plate with its lip
  R.rect(249, 197, 52, 5, I1); R.rect(249, 197, 52, 1, I3); R.rect(250, 198, 50, 1, I2); R.rect(249, 201, 52, 1, I0);
  // the door: a raised frame round the glass (the fire behind it is drawn each frame)
  R.rect(259, 206, 31, 28, I0); R.rect(260, 207, 29, 26, I2); R.rect(260, 207, 29, 1, I3); R.rect(260, 207, 1, 26, I3); R.rect(288, 208, 1, 25, I1);
  R.rect(263, 209, 22, 21, 0x141012); R.rect(FWIN.x, FWIN.y, FWIN.w, FWIN.h, 0x1e1410);
  // the handle: a coiled steel spring, a wooden knob
  for (let k = 0; k < 6; k++) R.px(290 + (k & 1), 214 + k, k & 1 ? 0x9a948a : 0x6a665e);
  R.rect(290, 220, 3, 3, 0x7a5232); R.px(290, 220, 0xa07448);
  R.rect(262, 233, 25, 2, I2); R.rect(262, 233, 25, 1, I3); R.px(274, 236, 0xb08a50); R.px(275, 236, 0x8a6a3a);
  // the pipe, joints every so often, a red damper grip, a collar where it meets the roof
  const pt = Math.floor(roofY(286));
  for (let y = pt; y < 197; y++) { R.rect(282, y, 8, 1, I1); R.px(282, y, I2); R.px(283, y, I3); R.px(288, y, I0); R.px(289, y, I0); if ((y - 90) % 26 === 0) { R.rect(281, y, 10, 1, I3); R.rect(281, y + 1, 10, 1, I0); } }
  R.rect(290, 168, 3, 1, I3); R.rect(292, 166, 3, 5, 0x9a3a2a); R.px(292, 166, 0xc85a42);
  R.rect(278, pt - 1, 16, 3, I2); R.rect(278, pt - 1, 16, 1, I3);
  // a basket of logs beside it, birch among them
  for (let y = 228; y < FLOOR; y++) for (let x = 300; x < 319; x++) {
    const w = (y - 228) < 2 ? 0xc8a068 : ((x + (y >> 1)) % 4 === 0 ? 0x7a5a32 : y % 3 === 0 ? 0x9a7444 : 0xae8650);
    R.px(x, y, w);
  }
  for (const [lx, ly, birch] of [[303, 225, 0], [309, 224, 1], [314, 226, 0], [306, 221, 1], [312, 220, 0]]) {
    R.ell(lx, ly, 2.5, 2.5, birch ? 0xe0dcd2 : 0x5a3e28); R.ell(lx, ly, 1.5, 1.5, birch ? 0xd2c4a2 : 0xc49a68); R.px(lx, ly, birch ? 0xb0a080 : 0x9a7048);
    if (birch) { R.px(lx - 2, ly, 0x2a2420); R.px(lx + 2, ly - 1, 0x2a2420); }
  }
  // the high shelf for the pothos and a jar of dried grasses
  R.rect(290, 116, 29, 3, 0x7a5638); R.rect(290, 116, 29, 1, 0xa07a52); R.rect(292, 119, 2, 4, 0x5a3e28); R.rect(314, 119, 2, 4, 0x5a3e28);
  R.rect(309, 106, 6, 10, 0xb8c8c0); R.rect(309, 106, 6, 1, 0xd8e4dc); R.rect(310, 108, 1, 7, 0xe0ece4);
  for (const [dx, h] of [[0, 9], [2, 12], [4, 8], [1, 11]]) { R.line(311 + dx * 0.5, 106, 309 + dx, 106 - h, 0xc8a868); R.px(309 + dx, 106 - h, 0xe0c890); }
}
// the low shelf: a record player on it, a stack of books and a candle; records and books inside.
// On the wall a pressed fern in a frame and a small shelf of jars
function paintLeft(R, geo) {
  const SH = 0x6e4a30, SHL = 0x946a46, SHD = 0x3e2a1c;
  R.rect(34, 204, 53, 3, SHL); R.rect(34, 204, 53, 1, 0xb08458); R.rect(34, 206, 53, 1, SH);
  R.rect(35, 207, 51, 37, SH); R.rect(35, 207, 1, 37, SHL); R.rect(85, 207, 1, 37, SHD);
  R.rect(37, 210, 21, 32, 0x24180f); R.rect(61, 210, 22, 32, 0x24180f); R.rect(59, 208, 1, 35, SHD);
  R.rect(35, 243, 51, 1, SHD);
  for (const lx of [38, 81]) { R.rect(lx, 244, 2, 6, SH); R.px(lx, 244, SHL); }
  // records on end, sleeves of every colour
  const SLV = [0xc8a048, 0x8a3a2a, 0x2e4a5e, 0xe0d8c4, 0x4a6a3e, 0xb05a34, 0x1e1e22, 0x6a4a7a, 0xd8b088, 0x3e6a6a, 0xa8483a, 0x2a2a2e];
  for (let x = 38; x < 57; x++) { const c = SLV[Math.floor(hash(x, 4) * SLV.length)], tp = 212 + Math.floor(hash(x, 8) * 3); R.rect(x, tp, 1, 242 - tp, c); if (hash(x, 9) < 0.3) R.px(x, tp + 4, mixc(c, 0xffffff, 0.3)); }
  geo.recs = { x0: 37, y0: 210, x1: 58, y1: 242 };
  // books lying flat, a little basket
  for (const [y, w, c] of [[236, 20, 0x3e5a4a], [232, 18, 0x8a3a2a], [229, 19, 0xc8a048], [226, 16, 0x2e4a5e]]) { R.rect(62, y, w, y === 236 ? 5 : 3, c); R.rect(62, y, w, 1, mixc(c, 0xffffff, 0.25)); R.rect(62 + w - 1, y, 1, 3, 0xe8dcc0); }
  for (let y = 214; y < 224; y++) for (let x = 64; x < 80; x++) R.px(x, y, (x + y) % 3 === 0 ? 0x8a6a3e : 0xb08a54);
  R.rect(64, 213, 16, 1, 0xd0aa6c); R.ell(70, 213, 2, 1, 0xc84a3a); R.ell(75, 213, 2, 1, 0x4a7a8a);
  // the record player: a light oak plinth, the record on its platter, the tonearm's base
  R.rect(50, 194, 25, 7, 0xc08c58); R.rect(50, 194, 25, 1, 0xd8a870); R.rect(49, 201, 27, 3, 0x8a5a36); R.rect(49, 201, 27, 1, 0xa87444);
  R.px(70, 202, 0xe0d0a8); R.px(67, 202, 0xe0d0a8); R.px(53, 202, 0x6ae070);
  R.ell(REC.x, REC.y, 9, 2, 0x16161a); R.ell(REC.x, REC.y, 7, 1.4, 0x26262c); R.ell(REC.x, REC.y, 5, 1, 0x18181c);
  R.rect(REC.x - 2, REC.y, 5, 1, 0xc8402e); R.px(REC.x - 1, REC.y - 1, 0xc8402e); R.px(REC.x + 1, REC.y - 1, 0xc8402e);
  R.rect(71, 193, 3, 2, 0x9a9a94); R.px(72, 192, 0xc8c8c0); R.rect(73, 198, 1, 2, 0x5a5a5e);
  // books stacked flat, a candle in an amber jar
  for (const [y, w, c] of [[201, 12, 0x2e4a5e], [198, 11, 0xa8483a], [196, 12, 0x5a7044], [193, 10, 0xd8c8a0]]) { R.rect(37, y, w, y === 201 ? 3 : 2, c); R.rect(37, y, w, 1, mixc(c, 0xffffff, 0.28)); }
  R.rect(77, 197, 7, 7, 0x8a5a2a); R.rect(77, 197, 7, 1, 0xb07a3a); R.rect(78, 198, 5, 2, 0xe8dcc0); R.rect(78, 200, 1, 3, 0xa87038); R.px(80, 197, 0x2a2018);
  // the pressed fern, framed
  R.rect(17, 119, 25, 31, 0x4e3624); R.rect(18, 120, 23, 29, 0x6e4c32); R.rect(20, 122, 19, 25, 0xe6dec8); R.rect(20, 122, 19, 1, 0xc8bea8);
  for (let k = 0; k < 18; k++) { const y = 144 - k, x = 29 + Math.round(Math.sin(k * 0.2) * 1.2); R.px(x, y, 0x5a7a44); if (k > 1 && k < 16 && k % 2 === 0) { const w = Math.round((1 - Math.abs(k - 7) / 10) * 4); for (let q = 1; q <= w; q++) { R.px(x - q, y + (q >> 1), 0x6a8a4e); R.px(x + q, y + (q >> 1), 0x6a8a4e); } } }
  // the little wall shelf: jars of honey, beans and pencils, a tiny cactus
  R.rect(48, 156, 35, 3, 0x7a5638); R.rect(48, 156, 35, 1, 0xa07a52); R.rect(50, 159, 2, 4, 0x5a3e28); R.rect(79, 159, 2, 4, 0x5a3e28);
  R.rect(52, 148, 6, 8, 0xc88a30); R.rect(52, 147, 6, 1, 0xe0d8c8); R.rect(53, 149, 1, 6, 0xe8b058);
  R.rect(60, 149, 6, 7, 0x9a5a3a); R.rect(60, 148, 6, 1, 0xd8d0c0); R.px(62, 151, 0xc88a6a); R.px(64, 153, 0x7a4028);
  R.rect(68, 150, 5, 6, 0x7a8a8a); for (const [dx, c] of [[0, 0xc84a3a], [2, 0x3e7aa8], [4, 0xe0c040], [1, 0x4a8a4a]]) R.line(68 + dx, 149, 68 + dx, 144 - (dx & 1), c);
  R.rect(75, 152, 5, 4, 0xb86a44); R.rect(76, 148, 3, 4, 0x5a8a4a); R.px(75, 149, 0x5a8a4a); R.px(79, 150, 0x5a8a4a); R.px(77, 147, 0xe0a0b0);
}
// the beams nearest you: the truss's collar across the top, and the string lights' wire looping
// along the rafters and under the collar (the bulbs themselves are drawn each frame)
function bulbPath(lay) {
  const pts = [], raf = (x) => K1 * Math.abs(x - VPX) - 63.4 + 2.5;
  for (let x = 1; x <= 53; x++) pts.push([x, raf(x) + 2.2 * Math.sin(Math.PI * frac((x - 1) / 17.33))]);
  for (let x = 54; x <= 266; x++) pts.push([x, 19.5 + 7 * Math.sin(Math.PI * frac((x - 54) / 53))]);
  for (let x = 267; x <= 319; x++) pts.push([x, raf(x) + 2.2 * Math.sin(Math.PI * frac((319 - x) / 17.33))]);
  const out = [{ pts, group: 0 }];
  // in full screen the string goes on along the same rafter over the wings, as far as the bays go
  const rafW = (x) => { const dx = Math.abs(x - VPX); return dx / 1.3 <= KINK ? K1 * dx - 63.4 + 2.5 : VPY + K2 * dx - 1.3 * (VPY - (YK - KINK * K2)) + 2.5; };
  for (const [a, b] of [[0, lay.lEnd + 6], [320, lay.rEnd - 6]]) {
    if (Math.abs(b - a) < 30) continue;
    const wp = [], dir = Math.sign(b - a), n = Math.abs(b - a), span = n / Math.max(1, Math.round(n / 26));
    for (let k = 0; k <= n; k++) { const x = a + dir * k; wp.push([x, rafW(x) + 2.6 * Math.sin(Math.PI * frac(k / span))]); }
    out.push({ pts: wp, group: 2 });
  }
  if (lay.bed) { const bp = []; for (let x = -194; x <= -84; x++) bp.push([x, roofY(x) + 6 + 3.5 * Math.sin(Math.PI * frac((x + 194) / 27.5))]); out.push({ pts: bp, group: 1 }); }
  return out;
}
const BULBC = [0xffd27a, 0xffeac4, 0xffb46a, 0xfff0d8];
function bulbsOf(paths) {
  const bulbs = [];
  for (const { pts, group } of paths) {
    let acc = 0, n = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += sq(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= (group ? 9 : 8)) { acc = 0; bulbs.push({ x: Math.round(pts[i][0]), y: Math.round(pts[i][1]), c: BULBC[n % BULBC.length], ph: hash(n, group) * 6.28, g: group }); n++; }
    }
  }
  return bulbs;
}
function paintBeams(R, lay, geo) {
  // the collar: its face toward you from y 3 to 13, its underside to 17, cut where it meets the rafters
  const xL = (y) => VPX - (y + 63.4) / K1;
  for (let y = 3; y < 18; y++) {
    const l = Math.ceil(xL(y)), r = Math.floor(320 - xL(y));
    for (let x = l; x < r; x++) {
      let c = y < 13 ? (y === 3 ? 0x4a3222 : y === 12 ? 0x5a3e28 : hash(x >> 3, y) < 0.15 ? 0x6a4a32 : 0x7a5638) : y === 13 ? 0xa07a52 : 0x8a6444;
      if (y >= 13 && y === 17) c = 0x5a3e28;
      R.px(x, y, c);
    }
  }
  // iron plates and bolts where it meets the rafters
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const x = sx < 0 ? 62 + k : 258 - k; R.rect(x, 5, 1, 7, 0x2a2626); }
  for (const [x, y] of [[63, 7], [64, 10], [257, 7], [256, 10]]) R.px(x, y, 0x8a8478);
  // the wire
  for (const { pts } of bulbPath(lay)) for (let i = 1; i < pts.length; i++) R.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0x2a221c);
  // the hook for the hanging fern
  R.rect(61, 17, 2, 2, 0x3a3634);
  // an old canoe paddle on two pegs over the window, its blade painted in bands
  for (const px of [134, 186]) { R.rect(px, 40, 2, 3, 0x4a3222); R.px(px, 39, 0x7a5638); }
  for (let x = 120; x < 200; x++) {
    const blade = x >= 168, hw = blade ? Math.min(3, 1 + (x - 168) * 0.4) * (x > 194 ? 1 - (x - 194) / 7 : 1) : x < 126 ? 1.6 : 0.9;
    for (let y = Math.round(38 - hw); y <= Math.round(38 + hw); y++) {
      let c = y < 38 ? 0xd8a870 : y > 38 ? 0x8a5a34 : 0xb88450;
      if (blade && x > 176 && x < 182) c = y < 38 ? 0xd85a3a : 0xa83a24;
      if (blade && x > 183 && x < 186) c = y < 38 ? 0x5a8a7a : 0x3e6a5e;
      R.px(x, y, c);
    }
  }
  R.rect(119, 37, 3, 3, 0x6a4428); R.px(119, 37, 0x9a6a42);
  // a brass barometer: its dial says rain
  R.ell(259, 120, 7, 7, 0x8a6a2a); R.ell(259, 120, 6, 6, 0xc8a048); R.ell(259, 120, 5, 5, 0xeee6d2); R.ell(259, 120, 5, 5, 0xe8e0cc, 0.4);
  for (let k = 0; k < 9; k++) { const a = Math.PI * (0.8 + k * 0.175); R.px(Math.round(259 + Math.cos(a) * 4), Math.round(120 + Math.sin(a) * 4), 0x6a5a48); }
  R.line(259, 120, 256, 117, 0x2a2420); R.px(259, 120, 0x9a3a2a); R.rect(257, 123, 5, 1, 0x8a7a68);
  R.px(259, 112, 0x8a6a2a); R.px(259, 111, 0x5a4a2a);
}

/* ——— the bays of the full-screen cabin ——— */
function kitchenBay(R, b, geo) {
  const x0 = b.x0, x1 = b.x1;
  // the herb rail, bundles drying on it
  R.rect(x0 + 2, 130, x1 - x0 - 4, 3, TIMBER); R.rect(x0 + 2, 130, x1 - x0 - 4, 1, TIMBERL);
  for (const [hx, c, c2] of [[x0 + 6, 0x6a8a4a, 0x8aa868], [x0 + 12, 0x7a7a9a, 0x9a8ab8], [x0 + 18, 0x5a7a44, 0x7a9a5a]]) {
    R.line(hx, 133, hx, 137, 0x8a7a5a); R.rect(hx - 1, 137, 3, 2, 0xc8b080);
    for (let k = 0; k < 12; k++) { const w = Math.round(1 + k * 0.28); R.rect(hx - w, 139 + k, w * 2 + 1, 1, k % 2 ? c : c2); }
    R.px(hx - 3, 151, c); R.px(hx + 3, 150, c2);
  }
  rectWindow(R, KWIN);
  // a shelf of jars under the herbs, enamel mugs on hooks below it
  R.rect(x0 + 2, 166, 22, 2, 0x8a6444); R.rect(x0 + 2, 166, 22, 1, 0xa87c52);
  for (const [jx, c, h] of [[x0 + 3, 0xa8483a, 6], [x0 + 9, 0xd8c8a0, 8], [x0 + 15, 0x8a5a2a, 7], [x0 + 20, 0x4a6a3a, 5]]) { R.rect(jx, 166 - h, 4, h, c); R.rect(jx, 165 - h, 4, 1, 0xc8c0b0); R.px(jx + 1, 166 - h + 1, mixc(c, 0xffffff, 0.35)); }
  for (const [mx, c] of [[x0 + 5, 0xe8e4dc], [x0 + 13, 0x3e6a8a], [x0 + 20, 0xe8e4dc]]) { R.px(mx + 1, 168, 0x2a2420); R.rect(mx, 170, 4, 4, c); R.rect(mx, 170, 4, 1, 0x2a2a30); R.px(mx + 4, 171, c); }
  // cream tiles behind the counter
  for (let y = 180; y < 200; y++) for (let x = x0; x < x1; x++) R.px(x, y, (y - 180) % 5 === 4 || (x - x0 + ((y - 180) / 5 & 1) * 3) % 6 === 5 ? 0xb4aa94 : 0xe0d8c4);
  // the counter, its cupboards painted sage green, brass knobs
  R.rect(x0, 200, x1 - x0, 4, 0xb48250); R.rect(x0, 200, x1 - x0, 1, 0xcc9c66); R.rect(x0, 203, x1 - x0, 1, 0x7a5232);
  R.rect(x0 + 1, 204, x1 - x0 - 2, 42, 0x6e8a6a); R.rect(x0 + 1, 246, x1 - x0 - 2, 4, 0x3a2e24);
  for (let d = 0; d < 3; d++) { const dx = x0 + 3 + d * 23; R.rect(dx, 207, 21, 37, 0x5e7a5c); R.rect(dx + 1, 208, 19, 35, 0x7a967a); R.rect(dx + 3, 210, 15, 31, 0x6e8a6a); R.px(dx + (d === 1 ? 2 : 18), 224, 0xd8b050); }
  // the sink under the window, a brass tap; a crock of wooden spoons, a cutting board, apples
  R.rect(-48, 199, 22, 3, 0xe8e6e0); R.rect(-46, 200, 18, 1, 0x9a9e9e);
  R.rect(-38, 190, 2, 9, 0xc89a48); R.rect(-38, 189, 5, 2, 0xc89a48); R.px(-34, 191, 0xc89a48); R.px(-38, 196, 0xe8c070);
  R.rect(-18, 191, 6, 9, 0x9a6a4a); R.rect(-18, 191, 6, 1, 0xb88a6a); for (const [dx, h] of [[1, 8], [3, 10], [4, 7]]) { R.line(-18 + dx, 191, -18 + dx, 191 - h, 0xc8a070); R.px(-18 + dx, 191 - h, 0xd8b080); }
  R.rect(x0 + 3, 184, 9, 16, 0xb88a58); R.rect(x0 + 3, 184, 9, 1, 0xd0a26c); R.ell(x0 + 7, 186, 1, 1, 0x5a3e28);
  for (const [ax, c] of [[x0 + 16, 0xa8302a], [x0 + 20, 0xc84a2a], [x0 + 18, 0x8aa040]]) { R.ell(ax, 197, 1.5, 1.5, c); R.px(ax - 1, 196, mixc(c, 0xffffff, 0.4)); }
  geo.spots.push({ x0: x0 + 2, y0: 133, x1: x0 + 24, y1: 152, id: 'herbs' }, { x0: x0 + 2, y0: 156, x1: x0 + 24, y1: 175, id: 'jars' }, { x0: x0, y0: 180, x1: x1, y1: 250, id: 'kitchen' });
}
const QUILT = [0xa4482a, 0xc89a40, 0x6a8452, 0xd8ccb0, 0x4e6278, 0x8a3a3a, 0xe0b878, 0x5a7a6a, 0xb86a44];
function bedBay(R, b, geo) {
  const x0 = b.x0;
  rectWindow(R, BWIN);
  // the platform and the mattress
  R.rect(x0 + 4, 232, 106, 14, 0x7a5234); R.rect(x0 + 4, 232, 106, 1, 0x9a6e46); R.rect(x0 + 4, 245, 106, 1, 0x4a3220);
  for (const lx of [x0 + 6, x0 + 104]) R.rect(lx, 246, 4, 4, 0x5a3e28);
  R.rect(x0 + 6, 222, 102, 10, 0xe6ded0); R.rect(x0 + 6, 222, 102, 1, 0xf4ece0);
  // the quilt: patches in rows, a stitched border, its hem hanging over the side
  for (let y = 210; y < 238; y++) {
    const l = x0 + 24 + Math.round(Math.sin(y * 0.4) * 0.6), r = x0 + 107;
    for (let x = l; x < r; x++) {
      if (y > 226 && y > 236 - Math.round(Math.sin((x - x0) * 0.35) * 1.5)) continue;
      const top = y < 218, pi = Math.floor((x - x0) / 6) + Math.floor((y - 210) / 5) * 3;
      let c = QUILT[Math.floor(hash(pi, 13) * QUILT.length)];
      if ((x - x0) % 6 === 0 || (y - 210) % 5 === 0) c = mixc(c, 0xf0e8d8, 0.35);
      if (!top) c = mixc(c, 0x2a1c14, 0.12);
      if (y === 210) c = mixc(c, 0xffffff, 0.2);
      R.px(x, y, c);
    }
  }
  // two pillows at the eave end, one striped
  R.ell(x0 + 14, 213, 9, 5, 0xe8e0d0); R.ell(x0 + 14, 212, 7, 3, 0xf4eee2);
  R.ell(x0 + 22, 215, 7, 5, 0xd8d4c8); for (let x = x0 + 16; x < x0 + 29; x += 2) R.line(x, 211, x, 219, 0x6a7a9a);
  // the reading lamp: a swing arm, a linen shade (lit or not)
  R.rect(x0 + 28, 176, 2, 6, 0x3a3634); R.line(x0 + 29, 178, x0 + 37, 172, 0x3a3634);
  R.poly([[x0 + 33, 172], [x0 + 41, 172], [x0 + 43, 180], [x0 + 31, 180]], 0xe0d0b0); R.rect(x0 + 32, 179, 11, 1, 0xc8b490);
  // a little shelf at the foot: a book, spectacles, a succulent
  R.rect(x0 + 98, 188, 18, 2, 0x8a6444); R.rect(x0 + 98, 188, 18, 1, 0xa87c52);
  R.rect(x0 + 100, 182, 8, 6, 0x3e5a4a); R.rect(x0 + 100, 182, 8, 1, 0x5a7a64); R.rect(x0 + 109, 184, 5, 4, 0xb86a44); R.rect(x0 + 110, 181, 3, 3, 0x7aa858);
  geo.spots.push({ x0: x0 + 28, y0: 170, x1: x0 + 44, y1: 182, id: 'bedlamp' }, { x0: x0 + 4, y0: 204, x1: x0 + 110, y1: 250, id: 'quilt' });
}
function ladderBay(R, b, geo) {
  const x0 = b.x0, railX = (a, y) => x0 + a + (249 - y) * 0.05;
  for (let y = 146; y < 250; y++) for (const a of [6, 26]) { const x = Math.round(railX(a, y)); R.px(x, y, 0xb88a5a); R.px(x + 1, y, 0x9a7048); R.px(x + 2, y, 0x6a4a30); }
  for (const y of [230, 208, 186, 164]) { const l = Math.round(railX(8, y)); R.rect(l + 1, y, 18, 2, 0xa87c52); R.rect(l + 1, y, 18, 1, 0xc8986a); R.rect(l + 1, y + 2, 18, 1, 0x5a3e28); }
  // blankets folded over the rungs, hanging in soft folds: a red plaid, a cream knit, mustard wool
  const blanket = (y, h, c1, c2, kind) => {
    const l = Math.round(railX(8, y)) + 2;
    for (let yy = y - 1; yy < y + h; yy++) {
      const sag = Math.round(Math.sin(((yy - y) / h) * Math.PI) * 1.2), r0 = l - 1 + (yy > y + h - 3 ? 1 : 0), r1 = l + 17 - (yy > y + h - 3 ? 1 : 0);
      for (let x = r0 + sag; x < r1 - sag; x++) {
        const fold = (x - l) % 6 === 5 ? 0.28 : (x - l) % 6 === 0 ? -0.12 : 0;
        let c = kind === 'plaid' ? (((x - l) >> 2) + ((yy - y) >> 2)) % 2 ? c1 : c2 : kind === 'knit' ? ((x + yy) % 4 < 2 ? c1 : c2) : c1;
        if (kind === 'plaid' && ((x - l) % 8 === 3 || (yy - y) % 8 === 3)) c = 0xe0c890;
        R.px(x, yy, fold > 0 ? mixc(c, 0x1a1008, fold) : fold < 0 ? mixc(c, 0xffffff, -fold) : c);
      }
    }
    R.rect(l - 1, y - 1, 18, 1, mixc(c1, 0xffffff, 0.3));
    for (let x = l; x < l + 16; x += 2) R.px(x, y + h, c2);
  };
  blanket(187, 18, 0x9a3a2a, 0x2e4a3a, 'plaid'); blanket(209, 14, 0xe4d8b8, 0xc8bc9c, 'knit'); blanket(165, 12, 0xc89a40, 0xa88030, 'wool');
  for (let y = 238; y < FLOOR; y++) for (let x = x0 + 1; x < x0 + 15; x++) R.px(x, y, (x + y) % 3 === 0 ? 0x8a6a3e : 0xb08a54);
  R.rect(x0 + 1, 238, 14, 1, 0xd0aa6c);
  R.ell(x0 + 5, 236, 3, 2, 0xa8483a); R.ell(x0 + 11, 236, 3, 2, 0x6a8452); R.px(x0 + 4, 235, 0xc86a5a); R.px(x0 + 10, 235, 0x8aa470);
  R.line(x0 + 8, 237, x0 + 15, 227, 0xd8c8a0); R.line(x0 + 9, 237, x0 + 17, 228, 0xd8c8a0);
  geo.spots.push({ x0: x0 + 1, y0: 146, x1: x0 + 34, y1: 250, id: 'ladder' });
}
function doorBay(R, b, geo) {
  // the casing and the door: boards, two ledges and a brace, strap hinges, a thumb latch
  R.rect(337, 128, 42, 122, 0x5e4028); R.rect(337, 128, 42, 1, 0x8a6444); R.rect(337, 128, 1, 122, 0x8a6444);
  for (let y = 132; y < FLOOR; y++) for (let x = 340; x < 376; x++) R.px(x, y, (x - 340) % 6 === 0 ? 0x4e3420 : (x - 340) % 6 === 1 ? 0x9a6e46 : hash((x - 340) / 6 | 0, 3) < 0.5 ? 0x8a5c38 : 0x825636);
  for (const ly of [150, 228]) { R.rect(340, ly, 36, 4, 0x7a5232); R.rect(340, ly, 36, 1, 0xa07448); R.rect(340, ly + 3, 36, 1, 0x4a3220); }
  for (let k = 0; k < 74; k++) { const x = Math.round(342 + k * 0.43), y = 227 - k; if (y > 154) { R.rect(x, y, 4, 1, 0x7a5232); R.px(x, y, 0xa07448); } }
  for (const hy of [156, 224]) { R.rect(340, hy, 17, 2, 0x26221e); R.px(356, hy - 1, 0x26221e); R.px(356, hy + 2, 0x26221e); R.px(344, hy, 0x5a5650); R.px(350, hy, 0x5a5650); }
  R.rect(370, 192, 2, 9, 0x26221e); R.rect(368, 196, 6, 2, 0x26221e); R.px(371, 191, 0x5a5650);
  rectWindow(R, DWIN);
  // a lantern on its hook
  R.line(330, 146, 334, 146, 0x2a2622); R.px(330, 147, 0x2a2622); R.rect(329, 148, 3, 1, 0x2a2622);
  R.rect(327, 152, 7, 2, 0x2a2622); R.rect(328, 154, 5, 9, 0xc8a870); R.rect(327, 154, 1, 9, 0x2a2622); R.rect(333, 154, 1, 9, 0x2a2622); R.rect(327, 163, 7, 2, 0x2a2622);
  R.px(330, 151, 0x2a2622); R.line(328, 152, 330, 149, 0x2a2622); R.line(332, 152, 330, 149, 0x2a2622);
  // the peg rail: a waxed coat, a knitted hat
  R.rect(379, 148, 18, 3, TIMBER); R.rect(379, 148, 18, 1, TIMBERL); R.px(383, 151, 0x5a3e28); R.px(392, 151, 0x5a3e28);
  for (let y = 151; y < 198; y++) {
    // the hood hanging from the peg, the shoulders, the sleeves either side of the body, the hem
    const cx = 383, w = y < 156 ? 1 + (y - 151) * 0.5 : y < 160 ? 3.5 + (y - 156) * 1.1 : Math.min(8, 7.5 + (y - 160) * 0.03);
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      const u = x - cx, sleeve = y > 161 && y < 186 && Math.abs(Math.abs(u) - w + 1.5) < 0.6;
      let c = u < -w + 1.5 ? 0xe8bc4a : u > w - 1.5 ? 0x9a7424 : 0xc89c34;
      if (sleeve) c = 0x8a6a1e;
      if (u === 0 && y > 159) c = 0x7a5c18;
      if (u === 1 && y > 162 && y % 6 === 0) c = 0x3a3a3a;
      if (y > 184 && Math.abs(u) > w - 2 && y < 189) c = 0x8a6a1e;   // the sleeves' cuffs
      R.px(x, y, c);
    }
  }
  R.rect(375, 197, 17, 1, 0x8a6a1e); R.rect(376, 196, 15, 1, 0xa88228);
  R.ell(392, 156, 3, 3, 0xa4482a); R.px(392, 152, 0xe0d4b4); for (let y = 154; y < 160; y += 2) R.rect(390, y, 5, 1, 0x8a3a24);
  // boots on a mat
  R.rect(378, 246, 20, 4, 0x8a6a3a); for (let x = 378; x < 398; x += 2) R.px(x, 247, 0xa88a54);
  for (const bx of [381, 389]) { R.rect(bx, 228, 5, 16, 0x2e4a34); R.rect(bx, 242, 7, 4, 0x2e4a34); R.rect(bx, 228, 5, 1, 0x4a6a4e); R.px(bx, 230, 0x4a6a4e); R.rect(bx, 245, 7, 1, 0x1a2a1e); R.px(bx + 2, 236, 0x6a5a3a); }
  // the umbrella leaning by the door, a little puddle at its tip
  for (let y = 210; y < 248; y++) { const w = y < 216 ? 0 : Math.min(2, (y - 216) * 0.15 + 1) * (1 - Math.max(0, (y - 236) / 12)); const cx = 330 + (y - 210) * 0.08; R.rect(Math.round(cx - w), y, Math.max(1, Math.round(w * 2) + 1), 1, w ? 0x8a2a24 : 0x3a3030); if (w && y % 5 === 0) R.px(Math.round(cx), y, 0xa83a30); }
  R.line(330, 210, 328, 206, 0x6a4a2a); R.line(328, 206, 326, 207, 0x6a4a2a);
  R.ell(333, 249, 4, 1, 0x6a7a80);
  geo.spots.push({ x0: 326, y0: 144, x1: 336, y1: 166, id: 'lantern' }, { x0: 376, y0: 148, x1: 398, y1: 200, id: 'coat' }, { x0: 377, y0: 226, x1: 398, y1: 250, id: 'boots' }, { x0: 324, y0: 204, x1: 337, y1: 250, id: 'umbrella' }, { x0: 340, y0: 132, x1: 376, y1: 250, id: 'door' });
}
function woodBay(R, b, geo) {
  const x0 = b.x0;
  R.rect(x0 + 2, 176, 36, 74, 0x5e4230); R.rect(x0 + 4, 179, 32, 69, 0x24180f); R.rect(x0 + 2, 176, 36, 1, 0x8a6444); R.rect(x0 + 2, 176, 1, 74, 0x8a6444);
  const r = rng(x0 + 999);
  for (let row = 0; row < 8; row++) {
    const y = 244 - row * 8, off = row % 2 ? 4 : 0;
    for (let x = x0 + 8 + off; x < x0 + 35; x += 8) {
      const birch = r() < 0.2, rr = 3.5 + r() * 0.8;
      R.ell(x, y, rr, rr, birch ? 0xd8d4ca : 0x4a3220); R.ell(x, y, rr - 1, rr - 1, birch ? 0xc8b088 : 0xc48a50); R.ell(x, y, rr - 2.2, rr - 2.2, birch ? 0xb89a70 : 0xa86e3a); R.ell(x, y, 0.6, 0.6, birch ? 0x8a6a48 : 0x7a4a26);
      if (r() < 0.4) R.px(x + 1, y - 1, birch ? 0xc0b090 : 0x9a7048);
      if (birch) { R.px(x - 3, y, 0x2a2420); R.px(x + 3, y + 1, 0x2a2420); }
    }
  }
  for (let k = 0; k < 6; k++) R.line(x0 + 6 + k * 5, 186, x0 + 9 + k * 5, 181, k % 2 ? 0x8a6a44 : 0xa88a5a);
  geo.spots.push({ x0: x0 + 2, y0: 176, x1: x0 + 38, y1: 250, id: 'wood' });
}
function windowBay(R, b, geo) {
  rectWindow(R, RWIN);
  // on the sill: binoculars, a bird book, a pot of thyme
  R.rect(458, 205, 3, 3, 0x2a2a2e); R.rect(462, 205, 3, 3, 0x2a2a2e); R.rect(461, 206, 1, 1, 0x4a4a50); R.px(458, 205, 0x6a6a74);
  R.rect(468, 206, 9, 2, 0x5a7a44); R.rect(468, 206, 9, 1, 0x7a9a5e);
  R.rect(482, 202, 7, 6, 0xb86a44); R.rect(481, 201, 9, 2, 0xc87a50); for (let k = 0; k < 7; k++) R.px(482 + k, 199 - (k % 3), k % 2 ? 0x6a8a4a : 0x8aa868);
  // a low bench under it with a folded blanket, a basket beneath
  R.rect(444, 224, 60, 4, 0x9a6e46); R.rect(444, 224, 60, 1, 0xb88a5a); R.rect(446, 228, 3, 22, 0x6a4a30); R.rect(499, 228, 3, 22, 0x6a4a30);
  for (let y = 218; y < 224; y++) for (let x = 452; x < 474; x++) R.px(x, y, ((x >> 1) + y) % 3 === 0 ? 0x4e6278 : 0x6a7e94);
  R.rect(452, 218, 22, 1, 0x8a9cb0);
  for (let y = 236; y < 250; y++) for (let x = 470; x < 494; x++) R.px(x, y, (x + y) % 3 === 0 ? 0x8a6a3e : 0xb08a54);
  // a snake plant at the end
  R.rect(441, 238, 8, 12, 0xd8d0c0); R.rect(440, 237, 10, 2, 0xe8e0d0);
  for (const [lx, h, lean] of [[442, 26, -0.1], [444, 32, 0.05], [446, 24, 0.15], [448, 20, 0.2]]) for (let k = 0; k < h; k++) { R.px(Math.round(lx + k * lean), 237 - k, k % 4 === 0 ? 0x8ab060 : 0x3e6a3a); if (k < h - 3) R.px(Math.round(lx + k * lean) + 1, 237 - k, 0x2e5430); }
  geo.spots.push({ x0: 456, y0: 202, x1: 478, y1: 209, id: 'binoculars' }, { x0: 444, y0: 214, x1: 504, y1: 250, id: 'bench' });
}
const BAYS = { kitchen: kitchenBay, bed: bedBay, ladder: ladderBay, door: doorBay, wood: woodBay, window: windowBay };

function* paintBack(R, lay, geo) {
  yield* paintCeiling(R, lay); yield;
  yield* paintWall(R, lay); yield;
  yield* paintFloor(R, lay); yield;
  paintRug(R); yield;
  if (lay.postL) post(R, -6);
  if (lay.postR) post(R, 320);
  for (const b of lay.bays) { BAYS[b.kind](R, b, geo); yield; }
  paintWindow(R); yield;
  paintStove(R); paintLeft(R, geo); yield;
  paintBeams(R, lay, geo);
}

// the slab table, the pinecones, the field guide's covers and pages; your chair's arm and the
// blanket over it, nearest of all
const crestY = (x) => 271 + (Math.max(0, x - 4) / 78) ** 2 * 44;
function* paintFront(R, lay) {
  // the slab: the grain running along it, a live edge toward you with the bark on, two stout legs
  for (const lx of [116, 211]) { R.rect(lx, 283, 7, 17, 0x5a3a22); R.rect(lx, 283, 2, 17, 0x7a5232); R.rect(lx - 1, 299, 9, 1, 0x3a2416); }
  for (let y = 268; y < 286; y++) {
    const l = Math.round(114 - (Math.min(y, 279) - 268) * 0.9), r = Math.round(220 + (Math.min(y, 279) - 268) * 0.9);
    for (let x = l; x < r; x++) {
      const fe = 279 + Math.round(Math.sin(x * 0.13) * 0.8 + Math.sin(x * 0.31 + 1) * 0.6);
      if (y > fe + 5) continue;
      let c;
      if (y <= fe) {
        const gr = Math.floor((y + Math.sin(x * 0.07) * 2.2 + Math.sin(x * 0.19) * 0.8) / 2.4);
        c = gr % 3 === 0 ? 0x9a6636 : gr % 3 === 1 ? 0xae7642 : 0xa66e3c;
        if (y === 268 || x === l) c = 0x8a5a32;
        if (y === fe) c = 0xc08a54;
      } else c = y - fe > 3 ? (hash(x, y) < 0.5 ? 0x3e2616 : 0x4e3220) : y - fe > 1 ? 0x6a4228 : 0x7a4c2a;
      R.px(x, y, c);
    }
  }
  R.ell(205, 273, 2, 1, 0x7a4a28); R.px(205, 273, 0x5a3420);
  // pinecones in a turned bowl
  R.ell(124, 271, 10, 4, 0xa06a3c); R.rect(116, 272, 17, 2, 0x8a5a32); R.rect(117, 274, 15, 1, 0x6a4226); R.ell(124, 269, 9, 2, 0x4a2e1a); R.rect(115, 268, 19, 1, 0xc89460);
  for (const [px, py] of [[119, 266], [129, 266], [124, 264], [126, 268]]) {
    R.ell(px, py, 2, 3, 0x6a4224);
    for (let k = 0; k < 6; k++) R.px(px - 1 + ((k + (py & 1)) & 1) * 2, py - 2 + k, k < 2 ? 0xc0884a : 0xa87442);
    R.px(px, py - 3, 0x3e2616); R.px(px, py + 3, 0x4a2e1a);
  }
  // the field guide: green cloth, two pages bowing from the spine
  R.rect(BOOK.x0 - 1, BOOK.y0, BOOK.x1 - BOOK.x0 + 2, BOOK.y1 - BOOK.y0 + 2, 0x2e4a34);
  for (let y = BOOK.y0; y < BOOK.y1; y++) for (let x = BOOK.x0; x < BOOK.x1; x++) {
    const u = Math.abs(x + 0.5 - 156) / 20, lift = Math.round((1 - u) * 1.2);
    if (y < BOOK.y0 + 1 - lift + (u > 0.9 ? 1 : 0)) continue;
    R.px(x, y, Math.abs(x - 156) < 1 ? 0xb8ac90 : u < 0.12 ? 0xd8ccb0 : 0xece2c8);
  }
  R.rect(BOOK.x0, BOOK.y1, BOOK.x1 - BOOK.x0, 1, 0xc8bca0);
  // your chair: a rolled arm in rust corduroy at the left edge of what is always on screen, and the
  // knitted blanket over it
  const ax = lay.vL;
  for (let x = lay.L; x < ax + 92; x++) {
    const bx = x - ax, top = Math.round(crestY(Math.max(0, bx)));
    for (let y = top; y < H; y++) {
      const d = y - top;
      let c;
      if (d === 0) c = 0xf0a878; else if (d < 3) c = 0xd88a58; else if (d < 5) c = 0xc06c40;
      else if (d < 7) c = 0x8a4228;   // the shadow under the roll
      else c = (x + Math.floor(y * 0.25)) % 3 === 0 ? 0x9a4c2c : 0xae5a34;   // the corduroy's wales down its side
      R.px(x, y, c);
    }
  }
  for (let x = ax + 16; x < ax + 54; x++) {
    const bx = x - ax, top = Math.round(crestY(bx)) - 1, hem = 314 + Math.round(Math.sin(bx * 0.5) * 1.5);
    for (let y = top; y < hem; y++) {
      const cx = (bx - 16) % 6, row = (y - top) % 6, twist = Math.floor((y - top) / 6) % 2;
      let c = cx === 5 ? 0x9a8a6a : cx === 0 ? 0xc0b090 : (twist ? (cx + row) % 4 < 2 : (cx - row + 8) % 4 < 2) ? 0xf0e6cc : 0xcab896;
      if (y > hem - 8 && y < hem - 4) c = cx === 5 ? 0x7a3420 : 0xa4482a;
      if (y - top < 2) c = mixc(c, 0xffffff, 0.15);
      if (bx === 16 || bx === 53) c = 0x9a8a6c;
      R.px(x, y, c);
    }
    if (bx % 2 === 0) { R.px(x, hem, 0xd2c4a4); R.px(x, hem + 1, 0xc4b496); R.px(x, hem + 2, 0xb8a888); }
  }
  yield;
}

/* ——— the things that move or change, as sprites lit like the room ——— */
// a monstera in a woven basket: big leaves split from the edge toward the midrib, lit from the window
const MON = [0x1a3a22, 0x24542c, 0x347038, 0x4a8c44, 0x66a852, 0x8cc86a];
const LEAVES = [[30, 166, 10, 13, -0.6], [12, 160, 10, 12, -2.3], [40, 190, 11, 10, 0.3], [7, 188, 10, 11, -2.9], [24, 148, 9, 11, -1.4], [20, 202, 10, 9, -1.9], [36, 212, 8, 7, 0.9], [9, 213, 7, 7, 3.6]];
function paintMonstera(S, sw) {
  for (let y = 226; y < 250; y++) for (let x = 3; x < 29; x++) {
    const w = 13 - (y - 226) * 0.08;
    if (Math.abs(x + 0.5 - 16) > w) continue;
    S.px(x, y, y === 226 ? 0xd0aa6c : y === 227 ? 0x8a6a3e : (x + (y >> 1)) % 3 === 0 ? 0x8a6a3e : y % 2 ? 0xb89058 : 0xa88050);
  }
  S.rect(5, 248, 22, 2, 0x6a4a2a);
  for (const [cx, cy, rx, ry, a] of LEAVES) {
    const k = (226 - cy) / 70, lx = cx + sw * Math.round(1 + k * 1.5), ca = Math.cos(a), sa = Math.sin(a);
    // the stem
    S.line(16 + (lx - 16) * 0.15, 226, lx - ca * ry * 0.85, cy - sa * ry * 0.85, 0x3a6a34);
    const R0 = Math.ceil(Math.max(rx, ry)) + 1;
    for (let y = Math.floor(cy - R0); y <= cy + R0; y++) for (let x = Math.floor(lx - R0); x <= lx + R0; x++) {
      const dx = x + 0.5 - lx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if ((v / rx) ** 2 + (u / ry) ** 2 > 1) continue;
      if (u < -ry * 0.6 && Math.abs(v) < (-ry * 0.6 - u) * 1.1) continue;   // the heart's notch at the stem
      if (Math.abs(v) > rx * 0.38 && frac((u + ry) / 3.4 + Math.abs(v) * 0.07) < 0.3) continue;   // the splits
      if (Math.abs(Math.abs(v) - rx * 0.24) < 0.6 && frac((u + ry) / 3.6 + 0.5) < 0.2) continue;   // and the little windows
      const l = -v / rx * Math.sign(-ca + 0.01) * 0.4 + u / ry * 0.25 + (dx > 0 ? 0.25 : -0.1);
      let ci = clamp(Math.round(2.6 + l * 2.2), 1, 5);
      if (Math.abs(v) < 0.7) ci = Math.min(5, ci + 1);
      S.px(x, y, MON[ci]);
    }
  }
}
// a Boston fern in a white pot, slung in a macramé hanger from the collar
function paintHangingFern(S, sw) {
  const hx = 62, px = hx + sw;
  // the cords: one from the hook to a knot, then four out and down to the pot in a diamond net
  S.line(hx, 19, px, 38, 0xd8ccb0); S.rect(px - 1, 38, 3, 3, 0xe8dcc0);
  const ends = [-9, -3, 3, 9];
  for (let i = 0; i < 4; i++) S.line(px, 41, px + ends[i], 86, 0xd0c4a6);
  for (const y of [56, 70]) { S.rect(px - 6, y, 2, 2, 0xe8dcc0); S.rect(px + 5, y, 2, 2, 0xe8dcc0); S.rect(px - 1, y + 7, 2, 2, 0xe8dcc0); }
  // fronds behind the pot
  const fr = rng(17);
  const frond = (a, len, c) => {
    let x = px, y = 86;
    for (let k = 0; k < len; k++) {
      const u = k / len, ang = a + Math.sign(Math.cos(a) || 1) * u * u * 2.1;
      x += Math.cos(ang) * 1.1; y += Math.sin(ang) * 0.95 + u * 0.4;
      const fx = Math.round(x + sw * u * 2), fy = Math.round(y);
      S.px(fx, fy, c);
      if (k % 2 === 0 && u > 0.1) { S.px(fx, fy + 1, c); S.px(fx + (Math.cos(ang) > 0 ? -1 : 1), fy + 1, c); }
    }
  };
  for (let i = 0; i < 12; i++) frond(-Math.PI / 2 + (i / 11 - 0.5) * 2.8, 14 + fr() * 12, i % 3 ? 0x3e7a3a : 0x2e6030);
  // the pot
  for (let y = 86; y < 100; y++) { const w = y < 96 ? 9 : 9 - (y - 95); for (let x = px - w; x <= px + w; x++) S.px(x, y, x < px - w + 2 ? 0xf0ece4 : x > px + w - 2 ? 0xb8b4aa : 0xdcd8ce); }
  S.rect(px - 10, 85, 21, 2, 0xe8e4da);
  // the cords gathered under it, and a tassel
  S.line(px - 6, 99, px, 104, 0xd0c4a6); S.line(px + 6, 99, px, 104, 0xd0c4a6); S.rect(px - 1, 104, 3, 3, 0xe8dcc0);
  for (let k = -2; k <= 2; k++) S.line(px + k * 0.5, 107, px + k, 116 + Math.abs(k), 0xd8ccb0);
  // fronds spilling over the rim, in front
  for (let i = 0; i < 10; i++) frond((i < 5 ? Math.PI * 0.75 : Math.PI * 0.25) + (fr() - 0.5) * 0.8, 16 + fr() * 14, i % 2 ? 0x5a9a48 : 0x4a8a40);
}
// a pothos on the high shelf, its vines trailing down the wall
function paintPothos(S, sw) {
  S.rect(295, 107, 11, 9, 0xb86a44); S.rect(294, 106, 13, 2, 0xc87a50); S.rect(303, 108, 1, 8, 0x8a4a2e);
  const vines = [[296, 54, 0.3], [299, 66, 1.6], [302, 46, 2.8], [305, 60, 4.1], [292, 30, 5.2]];
  for (const [vx, len, ph] of vines) {
    let side = 0;
    for (let k = 0; k < len; k++) {
      const y = 112 + k, x = Math.round(vx + Math.sin(k * 0.13 + ph) * 3 + (vx < 300 ? -k * 0.08 : k * 0.06) + sw * (k / 40));
      S.px(x, y, 0x3a5a2a);
      if (k % 4 === 0 && k > 2) {
        side = 1 - side; const lx = x + (side ? 2 : -2);
        S.rect(lx - 1, y, 3, 2, 0x3e7a34); S.px(lx, y + 2, 0x3e7a34); S.px(lx + (side ? 1 : -1), y, 0x6aa848); if ((k + vx) % 12 === 0) S.px(lx, y + 1, 0xc8c860);
      }
    }
  }
  // the leaves heaped over the pot's rim
  for (const [lx, ly] of [[294, 104], [298, 102], [302, 103], [306, 104], [300, 105]]) { S.rect(lx - 1, ly, 3, 2, 0x3e7a34); S.px(lx, ly - 1, 0x6aa848); S.px(lx, ly + 2, 0x2e5a2a); }
}
// the cat: a ginger tabby on the cushion, seen from behind, watching the rain. f: 0 looking ahead,
// 1 left, 2 right, 3 a paw up on the glass, 4 dozing (its tail is drawn each frame)
const CATC = { o: 0x5a2a12, d: 0xa45220, b: 0xd07a34, l: 0xe8a050, h: 0xf6c486, p: 0xf0a888 };
function paintCat(S, f) {
  const hx = [0, -2, 2, 0, 0][f], hy = [0, 0, 0, -1, 2][f], cx = 117.5;
  const inBody = (x, y) => {
    if (y < 178 || y >= 198) return false;
    const rx = y < 181 ? 4.6 : y < 192 ? 4.6 + 8.4 * Math.sqrt((y - 180.5) / 11.5) : 13 + (y - 192) * 0.3;
    return Math.abs(x + 0.5 - cx) < rx;
  };
  const inHead = (x, y) => sq((x + 0.5 - cx - hx) / 6.6, (y + 0.5 - 173.5 - hy) / 5.1) < 1;
  const inEar = (x, y) => { for (const [ex, dir] of [[112, -1], [123, 1]]) { const ey = 165 + hy, ax = ex + hx, k = y - ey; if (k >= 0 && k < 5 && Math.abs(x + 0.5 - ax - 0.5 - dir * (4 - k) * 0.25) <= k * 0.55 + 0.3) return true; } return false; };
  const inCat = (x, y) => inBody(x, y) || inHead(x, y) || inEar(x, y) || (f === 3 && x >= 127 && x < 130 && y >= 175 && y < 188 - (x - 127));
  for (let y = 162; y < 199; y++) for (let x = 100; x < 136; x++) {
    if (!inCat(x, y)) continue;
    const edge = !inCat(x, y - 1) || !inCat(x - 1, y) || !inCat(x + 1, y);
    const u = (x + 0.5 - cx) / 12;
    let c = CATC.b;
    if (inBody(x, y) && !inHead(x, y)) {
      if (frac((y - 182) / 4.2 - u * u * 1.4) < 0.3 && y < 196 && y > 181) c = CATC.d;   // the bands across its back
      if (Math.abs(x + 0.5 - cx) < 1 && y < 191) c = CATC.d;                  // and the stripe down its spine
      if (y < 181) c = CATC.d;                                               // the neck, in the head's shadow
      if (y > 195) c = mixc(CATC.d, CATC.o, 0.3);
    } else if (inHead(x, y)) {
      if (Math.abs(x + 0.5 - cx - hx) < 1.2 && y - hy < 176) c = CATC.d;
      else if ((y - hy === 171 || y - hy === 173) && Math.abs(x + 0.5 - cx - hx) < 4) c = CATC.d;
    } else if (inEar(x, y)) c = CATC.d;
    if (edge) c = y < 186 ? CATC.h : CATC.l;
    S.px(x, y, c);
  }
  if (f === 3) { S.px(128, 175, CATC.p); S.px(129, 175, CATC.h); }
}
// the copper kettle on the stove, level or tipped to pour
const COP = [0x5a2614, 0x8a4220, 0xb46030, 0xd88a50, 0xf4c890];
function paintKettle(S, tilt) {
  const bx = 267, by = 197, sh = tilt ? 0.35 : 0;
  const X = (x, y) => Math.round(x - (by - y) * sh);
  for (let y = 185; y < 197; y++) {
    const w = y < 187 ? 4 + (y - 185) * 2 : y > 194 ? 9 - (y - 194) : 9;
    for (let x = bx - w; x <= bx + w; x++) {
      const u = (x - bx) / w;
      const c = u < -0.6 ? COP[3] : u < -0.35 && y < 194 ? COP[4] : u > 0.6 ? COP[1] : y > 194 ? COP[1] : COP[2];
      S.px(X(x, y), y + (tilt ? Math.round((bx - x) * 0.12) : 0), c);
    }
  }
  // the spout, the lid and its knob, the handle with its wooden grip
  for (let k = 0; k < 8; k++) { const x = bx - 9 - k * 0.8, y = 192 - k * 0.8; S.rect(X(x, y), Math.round(y + (tilt ? 2 + k * 0.4 : 0)), 2, 2, k > 5 ? COP[3] : COP[2]); }
  S.rect(X(bx - 3, 184), 184, 7, 1, COP[3]); S.rect(X(bx - 1, 183), 183, 3, 1, 0x2a1e18); S.px(X(bx, 182), 182, 0x3a2a20);
  S.line(X(bx - 6, 186), 186, X(bx - 5, 180), 180, COP[1]); S.line(X(bx + 6, 186), 186, X(bx + 5, 180), 180, COP[1]);
  S.rect(X(bx - 4, 179), 179, 9, 2, 0x3a2418); S.rect(X(bx - 4, 179), 179, 9, 1, 0x6a4430);
}
// the mug on the table: speckled sage glaze, a tea tag over the rim; lv: how much tea is in it
function paintMug(S, lv) {
  const x0 = MUG.x - 5, y0 = MUG.y - 11;
  for (let y = y0 + 1; y < MUG.y; y++) for (let x = x0; x < x0 + 10; x++) S.px(x, y, x === x0 ? 0x8aa4a8 : x > x0 + 7 ? 0x4e6a70 : hash(x, y) < 0.15 ? 0x4a5e66 : 0x6a8a92);
  S.rect(x0 + 10, y0 + 3, 2, 1, 0x5a767c); S.rect(x0 + 11, y0 + 3, 1, 5, 0x5a767c); S.rect(x0 + 10, y0 + 7, 2, 1, 0x5a767c);
  S.rect(x0, y0, 10, 1, 0xe0dccc); S.rect(x0 + 1, MUG.y - 1, 8, 1, 0x3e5258);
  S.rect(x0 + 1, y0 + 1, 8, 1, lv > 0 ? [0, 0x6a3a1a, 0x7a4220, 0x8a4a22][lv] : 0x3a3a3a);
  if (lv > 2) S.px(x0 + 3, y0 + 1, 0xb07a44);
  S.line(x0 + 2, y0 + 1, x0 - 1, y0 + 5, 0xe8e0d0); S.rect(x0 - 2, y0 + 5, 3, 3, 0xd8b050);
}

/* ——— building a room for one width: in steps, so it can be spread over a few frames ——— */
const ROOMS = new Map();
function sprite(x0, y0, w, h, paint) { return { x0, y0, w, h, paint, ras: null, img: [] }; }
function spriteImg(RM, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = finish(bakeGen(sp.ras, sp.x0 + RM.ox, sp.y0, RM.F, k));
  }
  return sp.img[k];
}
const layerImg = (RM, L, k) => L.img[k] || (L.img[k] = finish(bakeGen(L.ras, 0, 0, RM.F, k)));
const roomW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);

function* buildRoom(rw, off, keys) {
  const lay = layoutFor(rw), { ox, L } = lay;
  const geo = { spots: [] };
  const back = new Ras(rw, H, ox, 0), front = new Ras(rw, H, ox, 0);
  yield* paintBack(back, lay, geo);
  yield* paintFront(front, lay);
  // the candle; and the room's warmth on your chair's arm (the string lights and the stove)
  const lights = [{ id: 'candle', x: CANDLE[0], y: CANDLE[1] + 3, r: 34, k: 0.34, sy: 1.1 }, { id: 'fill', x: lay.vL + 46, y: 300, r: 96, k: 0.15, sy: 1, p: 1.3 }];
  if (lay.bed) lights.push({ id: 'bed', x: lay.bed.x0 + 37, y: 184, r: 66, k: 0.5, sy: 0.9, p: 2 });
  if (lay.door) lights.push({ id: 'lantern', x: 330, y: 159, r: 54, k: 0.4, sy: 1 });
  const bulbs = bulbsOf(bulbPath(lay));
  const n = rw * H, F = { rw, C: new Float32Array(n), W: new Float32Array(n), S: new Float32Array(n), FI: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) { const x = X - ox, j = y * rw + X; F.C[j] = coolAt(x, y, lay); F.FI[j] = fireAt(x, y); }
    if (y % 16 === 15) yield;
  }
  fillWarm(F, ox, lights, off, { x0: 0, x1: rw, y0: 0, y1: H });
  yield* fillString(F, ox, bulbs);
  yield;
  const RM = {
    bw: rw, ox, L, lay, F, geo, lights, bulbs, off: new Set(off || []), jobs: [],
    back: { ras: back, img: [] }, front: { ras: front, img: [] },
    cat: [0, 1, 2, 3, 4].map((f) => sprite(98, 162, 40, 38, (S) => paintCat(S, f))),
    mon: [-1, 0, 1].map((sw) => sprite(-4, 136, 62, 116, (S) => paintMonstera(S, sw))),
    fern: [-1, 0, 1].map((sw) => sprite(28, 16, 70, 122, (S) => paintHangingFern(S, sw))),
    poth: [-1, 0, 1].map((sw) => sprite(282, 96, 38, 84, (S) => paintPothos(S, sw))),
    kettle: [0, 1].map((tl) => sprite(KET.x, KET.y, KET.w, KET.h, (S) => paintKettle(S, tl))),
    mug: [0, 1, 2, 3].map((lv) => sprite(MUG.x - 9, MUG.y - 13, 20, 15, (S) => paintMug(S, lv))),
  };
  RM.sprites = [...RM.cat, ...RM.mon, ...RM.fern, ...RM.poth, ...RM.kettle, ...RM.mug];
  RM.rim = [];
  for (let x = lay.L; x < lay.vL + 92; x++) { const y = Math.round(crestY(Math.max(0, x - lay.vL))); if (x < lay.vL + 16 || x >= lay.vL + 54) RM.rim.push([x, y]); }
  for (const k of keys) for (const sp of [RM.back, RM.front]) { if (!sp.img[k]) sp.img[k] = yield* bakeGen(sp.ras, 0, 0, F, k); yield; }
  const small = [RM.cat[0], RM.mon[1], RM.fern[1], RM.poth[1], RM.kettle[0], RM.mug[3]];
  for (const k of keys) { for (const sp of small) spriteImg(RM, sp, k); yield; }
  ROOMS.set(rw, RM);
  while (ROOMS.size > 2) ROOMS.delete(ROOMS.keys().next().value);
  return RM;
}
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value || true; if (performance.now() > end) return null; }
}
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
  for (let k = 0; k < 12; k++) for (const sp of [RM.back, RM.front]) if (sp.img[k]) { yield; yield* bakeGen(sp.ras, 0, 0, RM.F, k, rect, sp.img[k]); }
}
function syncLights(RM, off) { for (const lt of RM.lights) if (RM.off.has(lt.id) !== off.has(lt.id)) RM.jobs.push(relightGen(RM, lt.id, off)); }

/* ——— glows and colours for the moving parts ——— */
let FX = null;
function fx() {
  if (FX) return FX;
  FX = {
    bulb: steps(4, 4, 0xffc870, [[1, 0.1], [0.55, 0.2]]),
    bulbBig: glow(18, 14, 0xffb860, 0.2, 4),
    candle: steps(8, 9, 0xffb050, [[1, 0.1], [0.62, 0.16], [0.3, 0.28]]),
    candleBig: glow(22, 18, 0xffa850, 0.24, 4),
    stove: glow(58, 34, 0xff8a3a, 0.5, 5), stoveIn: glow(18, 16, 0xffa040, 0.6, 4), hearth: glow(44, 10, 0xff9a40, 0.5, 4),
    lamp: glow(34, 30, 0xffc078, 0.3, 4), lampIn: steps(9, 5, 0xffe2a8, [[1, 0.2], [0.5, 0.3]]),
    lantern: steps(11, 11, 0xffb860, [[1, 0.1], [0.6, 0.16], [0.3, 0.26]]),
    shroom: steps(4, 3, 0x7af0c8, [[1, 0.18], [0.5, 0.32]]),
    fly: steps(3, 3, 0xd8f070, [[1, 0.2], [0.45, 0.4]]),
    steam: Array.from({ length: 11 }, (_, k) => rgba(0xe8eaf0, k * 0.045)),
    smoke: Array.from({ length: 6 }, (_, k) => rgba(0xc8c4bc, (k + 1) * 0.06)),
  };
  // the window's light thrown down across the seat and the floor when the sun breaks through
  const P = new Ras(220, 72);
  for (let y = 250; y < 320; y++) for (let x = 60; x < 280; x++) {
    const t = y - 250, v = 198 - t * 2.15, u = x - t * 0.55 + 6;
    if (!inWin(WIN, Math.floor(u), Math.floor(v)) || isBar(WIN, Math.floor(u), Math.floor(v)) || MUNT.includes(Math.floor(u) - 1)) continue;
    P.px(x - 60, y - 250, 0xffffff, 1);
  }
  FX.patch = P.canvas();
  return FX;
}

/* ——— state ——— */
function newRiv(r, panes, d, on) {
  const p = panes[Math.floor(r() * panes.length)];
  d.p = p; d.x = p[0] + 1 + Math.floor(r() * Math.max(1, p[2] - 4)); d.y = p[1] + r() * p[3] * 0.5; d.v = 0; d.hold = r() * 2.5; d.len = 0; d.kinks = []; d.big = r() < 0.4; d.on = on; d.dep = d.y;
  return d;
}
const TONGUES = [[3.5, 2.2, 9], [6.5, 2.8, 12], [10, 3.2, 15], [13.5, 2.8, 12], [16.5, 2.2, 9]].map(([x, w, h], i) => ({ x, w, h, base: 15, f: 3.1 + ((i * 1.37) % 1.9), sf: 1.1 + (i % 3) * 0.55, p: i * 1.7 }));
const FPAL = [0, 0xff0a1a6a, 0xff123ac0, 0xff227af0, 0xff48bcff, 0xffb0f0ff];   // ABGR: deep red, orange-red, orange, yellow, white-hot
const GUIDE = [
  ['Sword fern', 'Polystichum munitum'], ['Chanterelle', 'Cantharellus formosus'], ['Western screech owl', 'Megascops kennicottii'],
  ['Black-tailed deer', 'Odocoileus hemionus'], ['Pacific tree frog', 'Pseudacris regilla'], ['Western red cedar', 'Thuja plicata'], ['Banana slug', 'Ariolimax columbianus'],
];
function makeState(seed) {
  const r = rng(seed);
  const s = {
    r, t: 0, stage: 0, sw: [1, 0, 0], st: 0, stageT: 0,
    rain: 1, rainLv: 0.5, rainW: 1, sun: 0, dryT: 0, wet: 1,
    strOn: true, str: 1, fire: 0.5, boost: 0, surge: 0.5, logT: 0, music: true, rec: 0, arm: 1,
    off: new Set(), tea: 3, sip: 0, pour: 0, kick: { mon: 0, fern: 0, poth: 0 }, page: 0, flip: 0,
    cat: { look: 0, lookT: 0, paw: 0, pawT: 40 + r() * 30, flick: 0 },
    steam: [], ksteam: [], sparks: [], smoke: [], rings: [], drops: [], dripT: 0.5, sideT: 1,
    deer: null, deerT: 14 + r() * 14, owl: { blink: 0, blinkT: 3, hoot: 0 }, frog: null, frogT: 25 + r() * 30,
    flies: Array.from({ length: 16 }, () => ({ x: r() * PW, y: 120 + r() * 66, vx: (r() - 0.5) * 4, vy: (r() - 0.5) * 2, ph: r() * 6.3, w: 0.8 + r() * 1.4 })),
    shroom: 0, glints: [], umbT: 4,
    streaks: Array.from({ length: 220 }, (_, i) => ({ x: r() * PW, y: PY + r() * PH, v: i < 110 ? 280 + r() * 110 : 170 + r() * 50, l: i < 110 ? 6 + Math.floor(r() * 6) : 3 + Math.floor(r() * 3), on: true })),
    glass: WINS.map((W) => { const panes = panesOf(W); return { W, panes, riv: Array.from({ length: W === WIN ? 18 : 4 }, () => newRiv(r, panes, {}, true)), beads: [] }; }),
    fog: null, fogDirty: true, fogT: 0,
  };
  return s;
}

// the mist that gathers on the inside of the gable window's lower panes
const FOGB = { x: 88, y: 50, w: 144, h: 148 };
let FOGM = null;
function fogMap() {
  if (FOGM) return FOGM;
  const { w, h } = FOGB, mask = new Uint8Array(w * h), tgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + FOGB.x, Y = y + FOGB.y, i = y * w + x;
    if (!inWin(WIN, X, Y) || isBar(WIN, X, Y)) continue;
    mask[i] = 1;
    let e = 99;
    for (const m of [123, 160, 196]) e = Math.min(e, Math.abs(X - m));
    e = Math.min(e, X - 88, 231 - X, 197 - Y);
    tgt[i] = clamp(0.12 + clamp((Y - 138) / 60, 0, 1) ** 1.3 * 0.9 + Math.max(0, 1 - e / 5) * 0.22 * clamp((Y - 110) / 40, 0, 1), 0, 1);
  }
  return (FOGM = { mask, tgt });
}
function wipe(s, cx, cy) {
  const { w, h } = FOGB, { mask } = fogMap();
  for (let y = -8; y <= 8; y++) for (let x = -18; x <= 18; x++) {
    const X = cx + x, Y = cy + y - Math.round((x / 18) ** 2 * 3), i = (Y - FOGB.y) * w + X - FOGB.x;
    if (X < FOGB.x || X >= FOGB.x + w || Y < FOGB.y || Y >= FOGB.y + h || !mask[i]) continue;
    const d = sq(x / 17, y / 6.5);
    if (d < 0.85 + hash(X, Y) * 0.15) s.fog[i] = 0;
    else if (d < 1.15) s.fog[i] = Math.min(1, s.fog[i] + 0.22);
  }
  s.fogDirty = true;
}

function stageWeights(s) {
  const w = [];
  for (let st = 0; st < 3; st++) if (s.sw[st] > 0.004) w.push([st, s.sw[st]]);
  w.sort((a, b) => b[1] - a[1]);
  let acc = 0;
  return w.map(([st, v]) => { acc += v; return [st, v / acc]; });
}
function order(s) {
  const f = s.fire, w = [];
  for (let st = 0; st < 3; st++) {
    if (s.sw[st] <= 0.004) continue;
    for (let so = 0; so < 2; so++) {
      const ws = so ? s.str : 1 - s.str;
      if (ws <= 0.004) continue;
      for (let fh = 0; fh < 2; fh++) { const v = s.sw[st] * ws * (fh ? f : 1 - f); if (v > 0.004) w.push([st * 4 + so * 2 + fh, v]); }
    }
  }
  w.sort((a, b) => b[1] - a[1]);
  let acc = 0;
  return w.map(([k, v]) => { acc += v; return [k, v / acc]; });
}

/* ——— each frame ——— */
function update(s, dt, lay, hooks) {
  s.t += dt;
  const t = s.t, r = Math.random;
  const settle = (v, to, k) => { const n = v + (to - v) * Math.min(1, dt * k); return Math.abs(n - to) < 0.004 ? to : n; };
  // the hour: crossfading toward the one chosen; it moves on by itself every few minutes
  s.stageT += dt;
  if (s.stageT > 170) { s.stage = (s.stage + 1) % 3; s.stageT = 0; if (hooks.stage) hooks.stage(); }
  for (let st = 0; st < 3; st++) s.sw[st] = settle(s.sw[st], st === s.stage ? 1 : 0, 0.55);
  const tot = s.sw[0] + s.sw[1] + s.sw[2]; for (let st = 0; st < 3; st++) s.sw[st] /= tot;
  s.st = s.sw.indexOf(Math.max(...s.sw));
  s.str = settle(s.str, s.strOn ? 1 : 0, 6);
  // rain gathers and eases in slow waves; stopped, it lets the light through, then comes back soft
  s.rainW = 0.72 + 0.28 * Math.sin(t * 0.043 + 1) * Math.sin(t * 0.017 + 0.3);
  s.rainLv = settle(s.rainLv, s.rain ? RLV[s.rain] * s.rainW : 0, 0.45);
  s.sun = settle(s.sun, !s.rain && s.rainLv < 0.12 ? 1 : 0, 0.5);
  if (!s.rain) { s.dryT += dt; if (s.dryT > 34) { s.rain = 1; s.dryT = 0; if (hooks.rainBack) hooks.rainBack(); } }
  s.wet = settle(s.wet, s.rainLv > 0.05 ? 1 : 0, s.rainLv > 0.05 ? 1 : 0.05);
  // the stove: a calm flicker over slow lulls and surges, a flare after a log
  s.boost = Math.max(0, s.boost - dt * 0.18);
  s.logT = Math.max(0, s.logT - dt);
  s.surge = 0.5 + 0.5 * Math.sin(t * 0.37 + 1.3) * Math.sin(t * 0.23 + 0.4);
  s.fire = clamp(0.34 + 0.24 * s.surge + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1) + 0.09 * Math.sin(t * 9.7 + 2) + 0.05 * Math.sin(t * 15.1) + s.boost * 0.6, 0, 1);
  if (r() < dt * (0.6 + s.boost * 10)) s.sparks.push({ x: 3 + r() * 14, y: 12 + r() * 3, vx: (r() - 0.5) * 8, vy: -12 - r() * 16, l: 1 });
  for (const p of s.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 1.4; }
  s.sparks = s.sparks.filter((p) => p.l > 0 && p.y > 0);
  // the record turns while the music plays; the arm swings over or back to its rest
  s.arm = settle(s.arm, s.music ? 1 : 0, 3);
  if (s.music && s.arm > 0.95) s.rec += dt * 3.5;
  // the kettle: always a thread of steam; a cloud of it when poured; the mug's own while it has tea
  s.pour = Math.max(0, s.pour - dt);
  if (r() < dt * (2.4 + (s.pour > 0 ? 18 : 0) + s.boost * 2)) s.ksteam.push({ x: 250 + r() * 2 - (s.pour > 0.3 ? 3 : 0), y: 184 + (s.pour > 0.3 ? 4 : 0), a: 0, life: 1.8 + r() * 1.2, ph: r() * 6.3 });
  for (const p of s.ksteam) { p.a += dt; p.y -= dt * (8 + p.a * 2); p.x -= dt * 2.5; }
  s.ksteam = s.ksteam.filter((p) => p.a < p.life);
  if (s.sip > 0) { const was = s.sip; s.sip = Math.max(0, s.sip - dt / 1.4); if (was > 0.5 && s.sip <= 0.5) s.tea = Math.max(0, s.tea - 1); }
  if (s.tea > 0 && r() < dt * (3 + s.tea * 2)) s.steam.push({ x: MUG.x - 3 + r() * 6, y: MUG.y - 13, a: 0, life: 2 + r() * 1.2, ph: r() * 6.3 });
  for (const p of s.steam) { p.a += dt; p.y -= dt * (6 + p.a * 1.5); }
  s.steam = s.steam.filter((p) => p.a < p.life);
  for (const p of s.smoke) { p.a += dt; p.y -= dt * 8; }
  s.smoke = s.smoke.filter((p) => p.a < 2.2);
  for (const k of Object.keys(s.kick)) s.kick[k] = Math.max(0, s.kick[k] - dt);
  if (s.flip > 0) { const was = s.flip; s.flip = Math.max(0, s.flip - dt / 0.9); if (was > 0.5 && s.flip <= 0.5) s.page = (s.page + 1) % GUIDE.length; }
  for (const p of s.glints) p.a += dt;
  s.glints = s.glints.filter((p) => p.a < 0.9);
  // rain outside: streaks; rivulets down the glass; rings in the creek and the puddle
  const rl = s.rainLv, m = Math.min(1, rl * 1.4);
  for (const st of s.streaks) { st.y += st.v * dt; st.x -= st.v * dt * 0.05; if (st.y - st.l > PY + PH) { st.y = PY - r() * 20; st.x = r() * (PW + 20); st.on = r() < rl; } if (st.x < -4) st.x += PW + 8; }
  for (const G of s.glass) {
    if (G.W !== WIN && !lay.wins.includes(G.W)) continue;
    for (const d of G.riv) {
      if (!d.on) { d.hold -= dt; if (d.hold <= 0) { if (r() < m) newRiv(r, G.panes, d, true); else d.hold = 0.6 + r(); } continue; }
      if (d.hold > 0) { d.hold -= dt; d.len = Math.max(0, d.len - dt * 2.5); continue; }
      d.v = Math.min(52, d.v + 40 * dt); d.y += d.v * dt; d.len = Math.min(20, d.len + d.v * dt * 0.7);
      if (r() < dt * 2.6) { d.kinks.push([d.x, d.y]); d.x = clamp(d.x + (r() < 0.5 ? -1 : 1), d.p[0] + 1, d.p[0] + d.p[2] - 3); }
      while (d.kinks.length && d.kinks[0][1] < d.y - d.len) d.kinks.shift();
      if (d.y - d.dep > 6 + r() * 9) { d.dep = d.y; if (G.beads.length < (G.W === WIN ? 56 : 14)) G.beads.push({ x: d.x + (r() < 0.3 ? 1 : 0), y: Math.round(d.y - 2), a: 0, life: 2 + r() * 2.5, big: r() < 0.25 }); }
      if (r() < dt * 0.9) { d.hold = 0.3 + r() * 1.8; d.v = 0; }
      if (d.y > d.p[1] + d.p[3] - 3) { d.on = false; d.hold = r() * 1.2; d.len = 0; }
    }
    for (const b of G.beads) b.a += dt;
    if (G.beads.length && G.beads[0].a > G.beads[0].life) G.beads = G.beads.filter((b) => b.a < b.life);
  }
  if (r() < dt * 9 * rl) { const x = 160 + r() * 150; s.rings.push({ x: Math.round(x), y: creekY(Math.round(x)) + Math.round((r() - 0.5) * 6), a: 0, m: 2 + Math.floor(r() * 2), k: 0 }); }
  if (r() < dt * 3 * rl) s.rings.push({ x: PUD.x + Math.round((r() * 2 - 1) * (PUD.rx - 3)), y: PUD.y, a: 0, m: 2 + Math.floor(r() * 3), k: 1 });
  if (r() < dt * 6 * rl) s.rings.push({ x: Math.round(r() * PW), y: 191 + Math.floor(r() * 25), a: 0, m: 1, k: 2 });
  // the eaves: a drop gathers and falls to the puddle, a beat of its own; faster in a downpour, and
  // it goes on dripping a while after the rain stops
  s.dripT -= dt;
  if (s.dripT <= 0) {
    if (s.wet > 0.08) s.drops.push({ x: DRIPX, y: 90, v: 0, land: PUD.y - 1, main: true });
    s.dripT = rl > 0.7 ? 0.55 + r() * 0.4 : rl > 0.2 ? 1.2 + r() * 1.3 : 2.6 + r() * 3;
  }
  s.sideT -= dt;
  if (s.sideT <= 0) {
    if (s.wet > 0.08) for (const W of lay.wins) if (W !== WIN && W !== DWIN) s.drops.push({ x: W.src + ((W.x1 - W.x0) >> 1) + 5, y: W.y0 - 4, v: 0, land: Math.min(W.yB + 2, 214), main: false });
    s.sideT = rl > 0.7 ? 0.8 + r() * 0.6 : 1.8 + r() * 2;
  }
  for (const d of s.drops) {
    d.v += 620 * dt; d.y += d.v * dt;
    if (d.y >= d.land) {
      d.dead = true;
      s.rings.push({ x: d.x, y: d.land + 1, a: 0, m: 3, k: d.main ? 1 : 2, splash: true });
      if (d.main && hooks.drip) hooks.drip();
    }
  }
  s.drops = s.drops.filter((d) => !d.dead);
  for (const p of s.rings) p.a += dt;
  s.rings = s.rings.filter((p) => p.a < 0.55);
  // the creatures: a deer now and then by day, the owl's blinks, a frog in the puddle while it rains
  if (s.deer) {
    const D = s.deer;
    D.t += dt;
    if (D.mode === 'in') { D.x -= 8 * dt; if (D.x <= DEERSTOP) { D.mode = 'drink'; D.t = 0; D.stay = 11 + r() * 8; } }
    else if (D.mode === 'drink') { if (D.t > D.stay) { D.mode = 'out'; D.t = 0; } }
    else if (D.mode === 'look') { if (D.t > 3.2) { D.mode = 'drink'; D.t = 0; D.stay = 4 + r() * 4; } }
    else { D.x -= 9 * dt; if (D.x < 140) s.deer = null; }
  } else if (s.stage < 2) { s.deerT -= dt; if (s.deerT <= 0) { s.deer = { x: 342, mode: 'in', t: 0 }; s.deerT = 55 + r() * 60; } }
  s.owl.blinkT -= dt; if (s.owl.blinkT <= 0) { s.owl.blink = 0.18; s.owl.blinkT = 2.5 + r() * 4; }
  s.owl.blink = Math.max(0, s.owl.blink - dt); s.owl.hoot = Math.max(0, s.owl.hoot - dt);
  if (s.frog) { s.frog.t += dt; if (s.frog.hop > 0) { s.frog.hop -= dt; s.frog.x -= dt * 40; if (s.frog.hop <= 0) s.frog = null; } else if (s.frog.t > s.frog.stay) s.frog.hop = 0.5; }
  else if (rl > 0.25) { s.frogT -= dt; if (s.frogT <= 0) { s.frog = { x: PUD.x + 2, t: 0, stay: 25 + r() * 25, hop: 0, croak: 0 }; s.frogT = 40 + r() * 50; } }
  if (s.frog) s.frog.croak = Math.max(0, s.frog.croak - dt);
  // fireflies at dusk and night, fewer in hard rain; the mushrooms on the log glow
  const dark = s.sw[1] * 0.7 + s.sw[2];
  for (const f of s.flies) {
    f.vx += (r() - 0.5) * dt * 6; f.vy += (r() - 0.5) * dt * 4; f.vx *= 1 - dt * 0.5; f.vy *= 1 - dt * 0.6;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y < 118) f.vy += dt * 6; if (f.y > 186) f.vy -= dt * 6;
    if (f.x < 0) f.x += PW; if (f.x > PW) f.x -= PW;
  }
  s.flyA = settle(s.flyA ?? 0, dark * (1 - Math.min(1, rl * 0.9)), 0.4);
  s.shroom = Math.max(0, s.shroom - dt * 0.4);
  // the cat watches the drops running down the glass in front of it
  const C = s.cat;
  C.lookT -= dt;
  if (C.lookT <= 0) {
    C.lookT = 0.35;
    let best = null, bd = 99;
    for (const d of s.glass[0].riv) if (d.on && d.hold <= 0 && d.y > 112 && d.y < 176) { const dd = Math.abs(d.x - CATX); if (dd < bd) { bd = dd; best = d; } }
    C.look = best ? (best.x < CATX - 7 ? 1 : best.x > CATX + 7 ? 2 : 0) : s.stage === 2 && s.rainLv < 0.3 ? 4 : C.look === 4 ? 4 : 0;
    C.watching = !!best;
  }
  C.paw = Math.max(0, C.paw - dt);
  C.pawT -= dt; if (C.pawT <= 0 && C.paw <= 0) { C.paw = 1.3; C.pawT = 45 + r() * 40; if (hooks.paw) hooks.paw(true); }
  C.flick += dt * (C.watching ? 5 : 1.6);
  // the mist on the glass creeps back where it was wiped
  if (s.fog) {
    const { mask, tgt } = fogMap(), k = [0.82, 0.95, 1.05][s.stage], rate = Math.min(1, dt * 0.022);
    const F = s.fog;
    for (let i = 0; i < F.length; i++) if (mask[i]) F[i] += (tgt[i] * k - F[i]) * rate;
    s.fogT -= dt; if (s.fogT <= 0) { s.fogT = 0.1; s.fogDirty = true; }
  }
  s.umbT -= dt;
}

const fill = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
// the forest, into the panorama canvas, for the windows to show
function drawOutside(p, O, s) {
  const t = s.t, rl = s.rainLv, SW = stageWeights(s), F = fx();
  p.globalCompositeOperation = 'source-over'; p.globalAlpha = 1;
  const layer = (L, x = 0, y = 0) => { for (const [st, a] of SW) { p.globalAlpha = a; p.drawImage(L[st], x, y); } p.globalAlpha = 1; };
  const mist = (L, y, v, a) => { const mx = -Math.floor((t * v) % O.mistW); for (const [st, w] of SW) { p.globalAlpha = a * w; p.drawImage(L[st], mx, y - PY); p.drawImage(L[st], mx + O.mistW, y - PY); } p.globalAlpha = 1; };
  layer(O.far);
  mist(O.mistA, 112, 1.6, 0.7 + rl * 0.3);
  layer(O.mid);
  mist(O.mistB, 138, 2.6, 0.6 + rl * 0.4);
  layer(O.ground);
  const st = s.st;
  // the creek running: glints carried along it
  const glc = [rgba(0xe8f4ee, 0.7), rgba(0xb8c4dc, 0.55), rgba(0x5a6a88, 0.5)][st];
  p.fillStyle = glc;
  for (let k = 0; k < 26; k++) { const x = Math.floor((k * 19.3 + t * (9 + (k % 3) * 3)) % PW), y = creekY(x) - 2 + (k % 4) * 1; p.fillRect(x, y - PY, 2 + (k % 2), 1); }
  // rings in the creek and the puddle, splashes on the boards
  for (const q of s.rings) {
    const f = q.a / 0.55, w = 1 + Math.min(q.m, Math.floor(f * (q.m + 1)));
    p.fillStyle = q.k === 2 ? rgba([0xb8c0bc, 0x8a90a8, 0x3a4052][st], 0.6 * (1 - f)) : rgba([0xd0e0da, 0x9aa4bc, 0x4a5468][st], 0.75 * (1 - f));
    if (q.k === 2 && !q.splash) { p.fillRect(q.x, q.y - PY - (f < 0.4 ? 1 : 0), 1, 1); continue; }
    p.fillRect(q.x - w + 1, q.y - 1 - PY, w * 2 - 1, 1); p.fillRect(q.x - w, q.y - PY, 1, 1); p.fillRect(q.x + w, q.y - PY, 1, 1);
    if (q.splash && f < 0.35) { p.fillRect(q.x - 2, q.y - 3 - PY - Math.round(f * 6), 1, 1); p.fillRect(q.x + 2, q.y - 3 - PY - Math.round(f * 5), 1, 1); p.fillRect(q.x, q.y - 4 - PY - Math.round(f * 8), 1, 1); }
  }
  // the deer, the owl, the frog
  if (s.deer) {
    const D = s.deer, f = D.mode === 'drink' ? (Math.sin(D.t * 0.8) > 0.92 ? 2 : 3) : D.mode === 'look' ? 4 : Math.floor(D.t * 4) % 2;
    layer(O.deer[f], Math.round(D.x) - 6, DEERY - 19 - PY);
  }
  const owlF = s.owl.hoot > 0 ? 2 : (s.sw[0] > 0.6 && s.owl.hoot <= 0) || s.owl.blink > 0 ? 1 : 0;
  layer(O.owl[owlF], OWLP.x - 3, OWLP.y - 10 - PY);
  if (owlF === 0 && s.sw[0] < 0.5) { p.globalCompositeOperation = 'lighter'; p.fillStyle = rgba(0xffd040, 0.55 * (1 - s.sw[0])); p.fillRect(OWLP.x - 1, OWLP.y - 8 - PY, 1, 1); p.fillRect(OWLP.x + 1, OWLP.y - 8 - PY, 1, 1); p.globalCompositeOperation = 'source-over'; }
  if (s.frog) layer(O.frog[s.frog.croak > 0 ? 1 : 0], Math.round(s.frog.x) - 3, PUD.y - 4 - PY - (s.frog.hop > 0 ? Math.round(Math.sin((0.5 - s.frog.hop) * 6.28 * 2) * 3) : 0));
  mist(O.mistC, 160, 3.6, 0.45 + rl * 0.4);
  // light breaking through once the rain stops
  if (s.sun > 0.01) {
    p.globalCompositeOperation = 'lighter';
    for (const [k, w] of SW) { p.globalAlpha = Math.min(1, s.sun * w * [1.5, 1.2, 0.8][k]); p.drawImage(O.rays[k], 0, 0); p.globalAlpha = s.sun * w; p.fillStyle = [rgba(0xfff0c8, 0.06), rgba(0xffa860, 0.05), rgba(0x8aa0d0, 0.04)][k]; p.fillRect(0, 0, PW, PH); }
    p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';
  }
  // the mushrooms on the log glow at dusk and after dark; fireflies drift over the ferns
  const dark = s.sw[1] * 0.6 + s.sw[2];
  if (dark > 0.02) {
    p.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.3) + s.shroom * 0.8;
    p.globalAlpha = Math.min(1, dark * pulse * 0.6); p.drawImage(F.shroom, 247, LOG.y - 8 - PY); p.drawImage(F.shroom, 252, LOG.y - 8 - PY);
    p.fillStyle = '#a8ffe0'; for (const mx of [246, 249, 251, 254, 257]) p.fillRect(mx, LOG.y - 5 - PY, 1, 1);
    p.globalAlpha = 1;
  }
  if (s.flyA > 0.02) {
    p.globalCompositeOperation = 'lighter';
    for (const f of s.flies) {
      const b = Math.max(0, Math.sin(t * f.w + f.ph)) ** 3 * s.flyA;
      if (b < 0.05) continue;
      p.globalAlpha = b; p.drawImage(F.fly, Math.round(f.x) - 3, Math.round(f.y) - 3 - PY);
      p.fillStyle = '#f0ffa0'; p.fillRect(Math.round(f.x), Math.round(f.y) - PY, 1, 1);
    }
    p.globalAlpha = 1;
  }
  p.globalCompositeOperation = 'source-over';
  // the eaves' drops falling to the puddle
  p.fillStyle = [rgba(0xf0f8f4, 0.85), rgba(0xc8d0e8, 0.75), rgba(0x8a98b8, 0.7)][st];
  for (const d of s.drops) p.fillRect(d.x, Math.round(d.y) - PY - 1, 1, d.v > 120 ? 3 : 2);
  // the rain, in two depths
  p.fillStyle = [rgba(0xd8e4e0, 0.22), rgba(0xa8b0c8, 0.2), rgba(0x6a7890, 0.22)][st];
  for (let i = 110; i < 220; i++) { const q = s.streaks[i]; if (q.on) p.fillRect(Math.round(q.x), Math.round(q.y - q.l) - PY, 1, q.l); }
  p.fillStyle = [rgba(0xeef6f2, 0.42), rgba(0xc0c8e0, 0.38), rgba(0x8a98b8, 0.36)][st];
  for (let i = 0; i < 110; i++) { const q = s.streaks[i]; if (q.on) p.fillRect(Math.round(q.x), Math.round(q.y - q.l) - PY, 1, q.l); }
}

// water running down the glass: a wet track behind each rivulet (a lit edge and a dark one), a bead
// at its head with a bright shoulder and a dark lip; beads it left drying
const RIVC = [
  { lit: 'rgba(230,240,236,0.3)', dark: 'rgba(10,20,14,0.3)', hi: 'rgba(250,255,250,0.92)', body: 'rgba(190,210,204,0.6)', lip: 'rgba(8,16,12,0.55)' },
  { lit: 'rgba(200,212,236,0.3)', dark: 'rgba(6,8,18,0.34)', hi: 'rgba(236,242,255,0.9)', body: 'rgba(160,176,214,0.6)', lip: 'rgba(4,6,14,0.58)' },
  { lit: 'rgba(150,170,210,0.28)', dark: 'rgba(2,4,10,0.36)', hi: 'rgba(210,222,250,0.85)', body: 'rgba(110,130,180,0.55)', lip: 'rgba(2,4,10,0.6)' },
];
function drawRivs(g, G, ox, st) {
  const RV = RIVC[st];
  for (let q = 0; q < 3; q++) {
    const a = [0.14, 0.28, 0.46][q];
    g.fillStyle = `rgba(222,232,236,${a})`;
    for (const b of G.beads) { const f = 1 - b.a / b.life; if ((f > 0.66 ? 2 : f > 0.33 ? 1 : 0) === q) g.fillRect(ox + b.x, b.y, b.big ? 2 : 1, 1); }
    g.fillStyle = `rgba(4,8,8,${(a * 0.7).toFixed(2)})`;
    for (const b of G.beads) { const f = 1 - b.a / b.life; if ((f > 0.66 ? 2 : f > 0.33 ? 1 : 0) === q) g.fillRect(ox + b.x, b.y + 1, b.big ? 2 : 1, 1); }
  }
  for (const [style, dx] of [[RV.lit, 0], [RV.dark, 1]]) {
    g.fillStyle = style;
    for (const d of G.riv) {
      if (!d.on || d.len < 1) continue;
      let x = d.x, yb = d.y;
      const yt = d.y - d.len;
      for (let k = d.kinks.length - 1; k >= -1; k--) {
        const ky = k >= 0 ? Math.max(yt, d.kinks[k][1]) : yt;
        if (yb > ky) g.fillRect(ox + x + dx, Math.round(ky), 1, Math.max(1, Math.round(yb - ky)));
        if (k < 0 || ky <= yt) break;
        x = d.kinks[k][0]; yb = ky;
      }
    }
  }
  g.fillStyle = RV.body; for (const d of G.riv) if (d.on) g.fillRect(ox + d.x, Math.round(d.y), 2, d.big ? 3 : 2);
  g.fillStyle = RV.hi; for (const d of G.riv) if (d.on) g.fillRect(ox + d.x, Math.round(d.y), 1, 1);
  g.fillStyle = RV.lip; for (const d of G.riv) if (d.on) g.fillRect(ox + d.x, Math.round(d.y) + (d.big ? 3 : 2), 2, 1);
}
let FOGCV = null;
function drawGlass(g, O, s, RM) {
  const ox = RM.ox, rl = s.rainLv, wet = 0.35 + 0.65 * Math.min(1, rl * 1.6 + s.wet * 0.3);
  for (const G of s.glass) {
    if (!RM.lay.wins.includes(G.W)) continue;
    const W = G.W;
    for (const [st, a] of stageWeights(s)) { g.globalAlpha = wet * a; g.drawImage(O.beads[W.id][st], ox + W.x0, W.y0); }
    g.globalAlpha = 1;
    drawRivs(g, G, ox, s.st);
  }
  // the mist on the inside of the lower panes, lit by the room
  if (!s.fog) { const { tgt } = fogMap(); s.fog = Float32Array.from(tgt, (v) => v * 0.9); }
  if (!FOGCV) { const c = document.createElement('canvas'); c.width = FOGB.w; c.height = FOGB.h; FOGCV = { c, x: c.getContext('2d'), img: new ImageData(FOGB.w, FOGB.h), key: '' }; }
  const key = `${s.st}|${s.strOn}`;
  if (s.fogDirty || FOGCV.key !== key) {
    s.fogDirty = false; FOGCV.key = key;
    const { mask } = fogMap(), d = FOGCV.img.data, F = s.fog, { w, h } = FOGB;
    const cool = [0xdce6e0, 0x9aa4bc, 0x4e566e][s.st], c = s.strOn ? mixc(cool, [0xf0dcc0, 0xd8b898, 0x9a7a6a][s.st], 0.3) : cool;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (!mask[i]) { d[o + 3] = 0; continue; }
      const q = bandN(F[i] * 3.2, x, y);
      if (q <= 0) { d[o + 3] = 0; continue; }
      d[o] = c >> 16; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = [0, 46, 88, 128, 156][Math.min(4, q)];
    }
    FOGCV.x.putImageData(FOGCV.img, 0, 0);
  }
  g.drawImage(FOGCV.c, ox + FOGB.x, FOGB.y);
}

function drawLit(g, RM, sp, ord, dx = 0, dy = 0) {
  const x = RM.ox + sp.x0 + dx, y = sp.y0 + dy;
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(spriteImg(RM, sp, k), x, y); }
  g.globalAlpha = 1;
}
function drawLayer(g, RM, L, ord) {
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(layerImg(RM, L, k), 0, 0); }
  g.globalAlpha = 1;
}
let FIRECV = null;
function drawFire(g, RM, s) {
  const FW = FWIN.w, FH = FWIN.h;
  if (!FIRECV) {
    const c = document.createElement('canvas'); c.width = FW; c.height = FH;
    const img = new ImageData(FW, FH);
    FIRECV = { c, x: c.getContext('2d'), img, u32: new Uint32Array(img.data.buffer), heat: new Float32Array(FW * FH) };
  }
  const { heat, u32 } = FIRECV, t = s.t, lv = 0.78 + s.fire * 0.3 + s.boost * 0.5;
  heat.fill(0);
  // the embers along the bottom, then the flames' tongues
  for (let x = 0; x < FW; x++) for (let y = FH - 4; y < FH; y++) { const v = (0.4 + 0.25 * Math.sin(t * (1.3 + (x * 7 % 5) * 0.4) + x * 1.7 + y) + s.fire * 0.2 + s.boost * 0.3) * (y === FH - 1 ? 0.7 : 1); heat[y * FW + x] = v; }
  for (const tg of TONGUES) {
    const pulse = Math.sin(t * tg.f + tg.p) * 0.5 + 0.5, h = Math.min(FH - 1, tg.h * lv * (0.66 + 0.34 * pulse * (Math.sin(t * tg.f * 1.63 + tg.p * 3) * 0.3 + 0.7)));
    const sway = Math.sin(t * tg.sf + tg.p * 2) * 1.4 + Math.sin(t * tg.sf * 2.3) * 0.5;
    for (let j = 0; j < h; j++) {
      const u = j / h, y = tg.base - j;
      if (y < 0) break;
      const half = tg.w * (1 - u) ** 0.85 * Math.min(1, u * 3 + 0.55), cx = tg.x + sway * u * u;
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half); x++) {
        if (x < 0 || x >= FW) continue;
        const ed = 1 - Math.abs(x + 0.5 - cx) / (half + 0.6);
        if (ed <= 0) continue;
        const v = (1 - u) * 0.8 * (0.35 + ed * 0.85) + 0.14, i = y * FW + x;
        if (v > heat[i]) heat[i] = v;
      }
    }
  }
  for (const p of s.sparks) { const x = Math.round(p.x), y = Math.round(p.y); if (x >= 0 && x < FW && y >= 0 && y < FH) heat[y * FW + x] = Math.max(heat[y * FW + x], 0.5 + p.l * 0.3); }
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const i = y * FW + x, v = heat[i]; u32[i] = v < 0.1 ? 0 : FPAL[Math.min(5, band(v * 5, x + 1, y))]; }
  FIRECV.x.putImageData(FIRECV.img, 0, 0);
  const ox = RM.ox;
  g.drawImage(FIRECV.c, ox + FWIN.x, FWIN.y);
  // the logs at the grate's front, their cracks glowing; a fresh log, dark until it catches
  const hot = s.fire + s.boost * 0.5;
  fill(g, '#2a1a10', ox + FWIN.x + 1, FWIN.y + FH - 4, FW - 2, 2); fill(g, '#3e2616', ox + FWIN.x + 2, FWIN.y + FH - 5, FW - 5, 1);
  fill(g, hot > 0.7 ? '#ffc050' : hot > 0.5 ? '#ff9030' : '#e05818', ox + FWIN.x + 5, FWIN.y + FH - 4, 2, 1); fill(g, hot > 0.6 ? '#ff9030' : '#c04010', ox + FWIN.x + 12, FWIN.y + FH - 3, 2, 1);
  if (s.logT > 0) { const k = Math.min(1, (6 - s.logT) / 2); fill(g, k < 0.5 ? '#4a2e1a' : '#3a2214', ox + FWIN.x + 3, FWIN.y + FH - 8, 14, 3); fill(g, '#6a4428', ox + FWIN.x + 3, FWIN.y + FH - 8, 14, 1); if (k > 0.4) { fill(g, '#ff9a30', ox + FWIN.x + 6, FWIN.y + FH - 6, 3, 1); fill(g, '#ffd060', ox + FWIN.x + 11, FWIN.y + FH - 7, 2, 1); } }
  // the glass's sheen
  fill(g, 'rgba(255,240,220,0.16)', ox + FWIN.x + 2, FWIN.y + 1, 1, 6); fill(g, 'rgba(255,240,220,0.1)', ox + FWIN.x + 3, FWIN.y + 1, 1, 3);
}
// the field guide's open pages: lines of text on the left, a little drawing on the right
const SKETCH = [
  [[0x4e7a3a, '...#...|..###..|.#.#.#.|..###..|.#.#.#.|..###..|...#...|...#...']],
  [[0xc88a30, '.#####.|#######|..###..|...#...|...#...'], [0xe8c060, '.#.#.#.']],
  [[0x7a6450, '#.....#|.#####.|##.#.##|.#####.|.#####.|..#.#..'], [0xe8c040, '.......|.......|..#.#..']],
  [[0x7a5232, '.#...#.|##...##|##...##|.#...#.|.......|.#...#.|##...##']],
  [[0x5a9a3a, '.#...#.|#######|.#####.|#.###.#|#.....#']],
  [[0x7a4a2a, '...#...|...#...|...#...|...#...'], [0x3e6a3a, '..###..|.#####.|#######|.#####.']],
  [[0xd8c040, '.......|.......|######.|#######|.######']],
];
function drawGuide(g, RM, s) {
  const ox = RM.ox, ink = lit(RM, 146, 273, 0x7a6a58, s);
  g.fillStyle = ink;
  for (let l = 0; l < 4; l++) for (let u = 0, k = l * 3 + s.page; u < 14; k++) { const w = Math.min(14 - u, 2 + ((k * 7) % 4)); g.fillRect(ox + 139 + u, 271 + l * 2, w, 1); u += w + 1; }
  const sk = SKETCH[s.page % SKETCH.length];
  if (s.flip > 0) {
    // the page turning over from right to left
    const u = 1 - s.flip, w = Math.round(Math.abs(Math.cos(u * Math.PI)) * 18), x = u < 0.5 ? 157 : 156 - w;
    g.fillStyle = lit(RM, 160, 272, 0xf4ecd8, s); g.fillRect(ox + x, 270 - Math.round(Math.sin(u * Math.PI) * 3), Math.max(1, w), 8);
    return;
  }
  for (const [c, pat] of sk) {
    g.fillStyle = lit(RM, 166, 273, c, s);
    pat.split('|').forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(ox + 163 + i, 270 + j, 1, 1); });
  }
}

function drawRoom(g, RM, O, s) {
  const { ox, lay } = RM, t = s.t, F = fx(), ord = order(s), off = s.off;
  drawLayer(g, RM, RM.back, ord);
  drawFire(g, RM, s);
  // the record turning, and its arm
  if (s.music && s.arm > 0.95) { const a = s.rec; fill(g, '#e8e0d0', ox + Math.round(REC.x + Math.cos(a) * 1.6), Math.round(REC.y + Math.sin(a) * 0.5)); fill(g, lit(RM, REC.x, REC.y, 0x8a8a94, s), ox + Math.round(REC.x + Math.cos(a + 2) * 7), Math.round(REC.y + Math.sin(a + 2) * 1.6)); }
  fill(g, lit(RM, REC.x - 5, 196, 0x6a6a74, s), ox + REC.x - 6, REC.y - 1, 3, 1);
  {
    const ax = Math.round(73 - 8 * s.arm), ay = Math.round(199 - 2 * s.arm);
    g.fillStyle = lit(RM, 70, 196, 0xd8d8d0, s);
    const n = 8;
    for (let k = 0; k <= n; k++) g.fillRect(ox + Math.round(72 + (ax - 72) * k / n), Math.round(193 + (ay - 193) * k / n), 1, 1);
    fill(g, lit(RM, ax, ay, 0x3a3a3e, s), ox + ax - 1, ay, 2, 1);
  }
  // the candle in its jar
  if (!off.has('candle')) { const h = Math.sin(t * 9) * Math.sin(t * 5.3) > 0.3 ? 3 : 2; fill(g, '#ffd070', ox + CANDLE[0], CANDLE[1] - h + 2, 1, h); fill(g, '#fff4d0', ox + CANDLE[0], CANDLE[1] + 1); }
  // plants swaying
  const sw = (kick, ph, sp = 0.5) => { const v = Math.sin(t * sp + ph) * 0.8 + (kick > 0 ? Math.sin(t * 9) * kick * 1.4 : 0); return v > 0.55 ? 2 : v < -0.55 ? 0 : 1; };
  drawLit(g, RM, RM.mon[sw(s.kick.mon, 0, 0.4)], ord);
  drawLit(g, RM, RM.fern[sw(s.kick.fern, 2, 0.33)], ord);
  drawLit(g, RM, RM.poth[sw(s.kick.poth, 4, 0.45)], ord);
  // the kettle, and its steam
  drawLit(g, RM, RM.kettle[s.pour > 0.3 ? 1 : 0], ord);
  if (s.pour > 0.3 && s.pour < 1.7) { g.fillStyle = 'rgba(220,230,240,0.6)'; for (let k = 0; k < 5; k++) g.fillRect(ox + 247 - k, 194 + k * 2, 1, 2); }
  for (const p of s.ksteam) {
    const u = p.a / p.life, a = Math.max(0, Math.min(10, Math.round((u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 7)));
    g.fillStyle = F.steam[a]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 2.2 + p.ph) * (1 + u * 3)), Math.round(p.y), 1, u > 0.4 ? 2 : 1);
  }
  // the cat, its tail hanging over the seat's lip, flicking
  const C = s.cat, cf = C.paw > 0 ? 3 : C.look;
  drawLit(g, RM, RM.cat[cf], ord);
  {
    const sway = Math.sin(C.flick) * (C.watching ? 1.6 : 1), tc = lit(RM, 132, 205, CATC.b, s), td = lit(RM, 132, 205, CATC.d, s);
    const pts = [[130, 196], [131, 198], [132, 200], [133, 202], [133, 204], [133, 206], [133, 208], [133 + sway * 0.3, 210], [133 + sway * 0.6, 212], [133 + sway, 214], [134 + sway * 1.3, 215]];
    pts.forEach(([x, y], i) => { g.fillStyle = i % 3 === 2 ? td : tc; g.fillRect(ox + Math.round(x), y, 2, 2); });
  }
  // the bed's lamp and the door's lantern (full screen)
  if (lay.bed && !off.has('bed')) { fill(g, '#ffe8b8', ox + lay.bed.x0 + 32, 180, 11, 1); }
  if (lay.door && !off.has('lantern')) { const h = Math.sin(t * 7) * Math.sin(t * 4.1) > 0.2 ? 3 : 2; fill(g, '#ffd070', ox + 330, 161 - h, 1, h); fill(g, '#fff4d0', ox + 330, 161); }
  // the umbrella still drips now and then
  if (lay.door) { const u = (s.t * 0.7) % 3; if (u < 0.5) fill(g, 'rgba(200,214,224,0.7)', ox + 333, Math.round(240 + u * 18), 1, 2); }
  // the sun's light falling across the floor when it breaks through
  if (s.sun > 0.01) {
    g.globalCompositeOperation = 'lighter';
    for (const [st, a] of stageWeights(s)) { g.globalAlpha = s.sun * a * [0.1, 0.09, 0.05][st]; g.drawImage(F.patch, ox + 60, 250); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  drawLayer(g, RM, RM.front, ord);
  // your chair's crest, catching the stove and the string lights
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = Math.min(1, 0.16 + 0.14 * s.fire + 0.16 * s.str + s.boost * 0.15); g.fillStyle = '#c06030';
  for (const [x, y] of RM.rim) g.fillRect(ox + x, y, 1, 2);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawGuide(g, RM, s);
  // the mug, lifted for a sip; its steam
  const lift = s.sip > 0 ? Math.round(Math.sin(Math.PI * clamp((1 - s.sip) * 1.15, 0, 1)) * 10) : 0;
  drawLit(g, RM, RM.mug[s.tea], ord, 0, -lift);
  for (const p of s.steam) {
    const u = p.a / p.life, a = Math.max(0, Math.min(10, Math.round((u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 8)));
    g.fillStyle = F.steam[a]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 2 + p.ph) * (1 + u * 3)), Math.round(p.y - lift), 1, u > 0.4 ? 2 : 1);
  }
  // everything that glows
  g.globalCompositeOperation = 'lighter';
  const fl = 0.7 + s.fire * 0.35 + s.boost * 0.6;
  g.globalAlpha = Math.min(1, 0.32 * fl); g.drawImage(F.stove, ox + 274 - 58, 222 - 34);
  g.globalAlpha = Math.min(1, 0.5 * fl); g.drawImage(F.stoveIn, ox + 274 - 18, 220 - 16);
  g.globalAlpha = Math.min(1, 0.42 * fl); g.drawImage(F.hearth, ox + 276 - 44, 254 - 10);
  if (!off.has('candle')) { g.globalAlpha = 0.7 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.1); g.drawImage(F.candle, ox + CANDLE[0] - 8, CANDLE[1] - 8); g.globalAlpha = 0.4; g.drawImage(F.candleBig, ox + CANDLE[0] - 22, CANDLE[1] - 16); }
  if (lay.bed && !off.has('bed')) { g.globalAlpha = 0.55; g.drawImage(F.lamp, ox + lay.bed.x0 + 37 - 34, 184 - 26); g.globalAlpha = 0.9; g.drawImage(F.lampIn, ox + lay.bed.x0 + 37 - 9, 181 - 5); }
  if (lay.door && !off.has('lantern')) { g.globalAlpha = 0.75 + 0.15 * Math.sin(t * 7.7) * Math.sin(t * 3.1); g.drawImage(F.lantern, ox + 330 - 11, 158 - 11); }
  // the string lights: a little twinkle in each bulb
  if (s.str > 0.02) {
    for (const b of RM.bulbs) {
      const tw = 0.82 + 0.18 * Math.sin(t * (0.8 + (b.ph % 1)) + b.ph);
      g.globalAlpha = s.str * tw * 0.85; g.drawImage(F.bulb, ox + b.x - 4 + 0.5, b.y + 2 - 4);
    }
    g.globalAlpha = s.str * 0.25;
    for (let i = 0; i < RM.bulbs.length; i += 5) { const b = RM.bulbs[i]; g.drawImage(F.bulbBig, ox + b.x - 18, b.y + 2 - 14); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const b of RM.bulbs) {
    if (s.str > 0.5) { fill(g, hex(b.c), ox + b.x, b.y + 1, 2, 2); fill(g, '#fffaf0', ox + b.x, b.y + 1); }
    else fill(g, lit(RM, b.x, b.y, 0x8a7a5a, s), ox + b.x, b.y + 1, 2, 2);
    fill(g, '#2a221c', ox + b.x, b.y, 2, 1);
  }
  for (const p of s.smoke) { g.fillStyle = F.smoke[Math.max(0, Math.min(5, Math.round((1 - p.a / 2.2) * 5)))]; g.fillRect(ox + Math.round(p.x + Math.sin(p.a * 3 + p.ph) * (1 + p.a)), Math.round(p.y), 1, 2); }
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

function render(g, pc, RM, O, s) {
  drawOutside(pc, O, s);
  g.clearRect(0, 0, RM.bw, H);
  for (const W of RM.lay.wins) g.drawImage(pc.canvas, W.src, W.y0 - PY, W.x1 - W.x0, W.yB - W.y0, RM.ox + W.x0, W.y0, W.x1 - W.x0, W.yB - W.y0);
  drawGlass(g, O, s, RM);
  drawRoom(g, RM, O, s);
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
    const O = outside(), s = makeState(7);
    s.stage = 1; s.sw = [0, 1, 0]; s.st = 1; s.rain = 1; s.rainLv = 0.55;
    const RM = ROOMS.get(320) || finish(buildRoom(320, s.off, [4, 5, 6, 7]));
    const lay = RM.lay;
    for (let i = 0; i < 120; i++) update(s, 1 / 30, lay, {});
    s.stage = 1; s.sw = [0, 1, 0]; s.st = 1; s.flyA = 0.9; s.cat.look = 0; s.cat.paw = 0; s.deer = { x: DEERSTOP, mode: 'drink', t: 1 };
    for (const f of s.flies) f.ph = 1.2;
    const B = makeBuffers(320);
    render(B.g, B.pc, RM, O, s);
    PREV = B.buf;
  }
  // sharp pixels at whatever size the thumbnail is shown: a whole-number blow-up, then a smooth fit
  const m = ctx.getTransform?.(), sc = Math.max(1, Math.abs(m?.a || 1)), k = Math.max(1, Math.ceil((640 * sc) / H));
  let up = PREVUP.get(k);
  if (!up) { up = document.createElement('canvas'); up.width = 320 * k; up.height = H * k; const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(PREV, 0, 0, 320 * k, H * k); PREVUP.set(k, up); }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(up, 0, 0, 640, 640); ctx.restore();
}

/* ——— the lounge ——— */
export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const O = outside(), s = makeState((Date.now() % 100000) + 1);
  fx(); fogMap();
  let B = null, RM = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false, shownAt = -1;
  const preW = roomW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  // how a pointer's logical x maps into the buffer (set by the blit each frame): bx = x * a + b
  const view = { a: 0.5, b: 0, sx: 0, dx: 0 };
  const timers = new Set();
  const later = (sec, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, sec * 1000); timers.add(id); return id; };
  const soon = (sec, fn) => later(sec, () => { if (!isPaused()) fn(); });
  const keysNow = () => [0, 1, 2, 3].map((k) => s.stage * 4 + k);

  const status = () => setScore(`${STAGES[s.stage]} in the woods · ${RAINS[s.rain]} · the stove ${s.boost > 0.3 ? 'roaring' : 'ticking'}${s.music ? ' · a record playing' : ''}`);
  setScore('Click the window, the stove, the kettle, the cat, the lights…');
  let hint = setTimeout(() => { hint = 0; status(); }, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0, crackleT = 0, rainSet = -1, rainAt = 0;
  const say = (text, sec = 3.5) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(() => { msgT = 0; status(); }, sec * 1000); };

  const amb = playAmbience({ rain: 0.8, crackle: 0.35 }, isPaused);
  const stopMusic = playLoungeMusic('woods', () => isPaused() || !s.music);
  let lastDrip = 0;
  const hooks = {
    drip() { if (s.t - lastDrip < 0.45 || isPaused() || (s.rainLv > 0.7 && Math.random() < 0.4)) return; lastDrip = s.t; drip(0.01 + Math.random() * 0.007, 1500 + Math.random() * 600, 480 + Math.random() * 200); },
    rainBack() { say('A light rain again, pattering on the porch'); },
    stage() { if (!msgT && !hint) status(); },
    paw(self) { if (self) catPaw(); },
  };
  const glint = (x, y) => s.glints.push({ x, y, a: 0 });
  const catPaw = () => {
    s.cat.paw = 1.3;
    const G = s.glass[0], d = G.riv.find((q) => !q.on) || G.riv[0];
    newRiv(s.r, G.panes, d, true); d.p = G.panes[1]; d.x = 128; d.y = 177; d.hold = 0.5; d.dep = d.y;
  };
  const addLog = (from) => {
    s.boost = 1; s.logT = 6;
    for (let k = 0; k < 14; k++) s.sparks.push({ x: 4 + Math.random() * 12, y: 10 + Math.random() * 4, vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 18, l: 1 });
    amb.set('crackle', 1); clearTimeout(crackleT); crackleT = later(4, () => { crackleT = 0; amb.set('crackle', 0.35); });
    tone(40, { dur: 0.3, vol: 0.022, type: 'triangle' }); soon(0.15, () => tone(43, { dur: 0.25, vol: 0.015, type: 'triangle' }));
    for (let k = 0; k < 4; k++) soon(0.4 + k * 0.25 + Math.random() * 0.2, () => drip(0.01 + Math.random() * 0.008, 2600 + Math.random() * 800, 1800));
    say(from ? 'A split log from the pile — the stove flares' : 'You feed the stove a log — it flares and roars');
  };
  const pourTea = () => {
    if (s.pour > 0) return;
    s.pour = 2; swish(0.02);
    for (let k = 0; k < 7; k++) soon(0.35 + k * 0.13, () => drip(0.012, 760 - k * 30, 320));
    soon(1.6, () => { s.tea = 3; });
    say(s.tea >= 3 ? 'You top up the tea; the kettle hisses' : 'You pour from the kettle — fresh tea, steaming');
  };
  const toggle = (id) => {
    if (s.off.has(id)) s.off.delete(id); else s.off.add(id);
    if (RM) RM.jobs.push(relightGen(RM, id, s.off));
    return !s.off.has(id);
  };
  const SPOTS = {
    herbs: () => { swish(0.025); say('Thyme, sage and lavender, drying from the rail'); },
    jars: () => { note(3, { dur: 0.5, vol: 0.02 }); say(['A jar of huckleberry jam', 'Dried beans and oats', 'Honey from down the valley'][Math.floor(Math.random() * 3)]); },
    kitchen: () => { tone(64, { dur: 0.4, vol: 0.015 }); say('The kitchen corner: a sink under the window, bread on the board'); },
    bedlamp: () => { const on = toggle('bed'); drip(0.025, 2400, 1600); say(on ? 'The reading lamp by the bed, on' : 'The reading lamp, off'); },
    quilt: () => { swish(0.03); say('The bed under the eaves, its patchwork quilt turned back'); },
    ladder: () => { swish(0.025); say('Blankets folded on the ladder for the cold nights'); },
    lantern: () => { const on = toggle('lantern'); tone(on ? 76 : 69, { dur: 0.4, vol: 0.015 }); say(on ? 'The lantern by the door, lit' : 'The lantern blown out'); },
    coat: () => { swish(0.03); say('Your waxed coat, still beaded with rain'); },
    boots: () => { tone(45, { dur: 0.2, vol: 0.02, type: 'triangle' }); say('Muddy boots on the mat'); },
    umbrella: () => { drip(0.02, 1400, 500); say('The umbrella drips by the door'); },
    door: () => { amb.set('rain', Math.min(1.4, 0.4 + s.rainLv * 1.2)); soon(2.2, () => { rainSet = -1; }); swish(0.04); tone(50, { dur: 0.5, vol: 0.015, type: 'triangle' }); say('The door creaks open — the smell of rain and cedar'); },
    wood: () => addLog(true),
    binoculars: () => { tone(81, { dur: 0.3, vol: 0.015 }); say('Binoculars on the sill, and a list of birds seen'); },
    bench: () => { swish(0.02); say('A bench under the window, a blanket folded on it'); },
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!RM) return;
    const p = pointIn(canvas, e), lay = RM.lay;
    const x = p.x * view.a + view.b - view.dx + view.sx - RM.ox, y = p.y / 2, xi = Math.floor(x), yi = Math.floor(y);
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    // things outside the gable window first (the owl, the deer, the frog), then the glass
    const px = WIN.src + x - WIN.x0;
    if (inWin(WIN, xi, yi) && !(inR(100, 166, 136, 199))) {
      if (sq(px - OWLP.x, y - OWLP.y + 5) < 6) {
        s.owl.hoot = 1.6; soon(0.05, () => tone(53, { dur: 0.45, vol: 0.03 })); soon(0.55, () => tone(53, { dur: 0.35, vol: 0.026 })); soon(1.15, () => tone(50, { dur: 0.7, vol: 0.022 }));
        say(s.sw[0] > 0.5 ? 'The little owl opens one eye — hoo, hoo-hoo' : 'The owl hoots softly from the cedar'); return;
      }
      if (s.deer && Math.abs(px - s.deer.x - 2) < 10 && y > DEERY - 20 && y < DEERY + 3) {
        if (s.deer.mode === 'drink' || s.deer.mode === 'in') { s.deer.mode = 'look'; s.deer.t = 0; }
        note(7, { dur: 0.6, vol: 0.02 }); say('The deer lifts its head and listens'); return;
      }
      if (s.frog && Math.abs(px - s.frog.x) < 6 && Math.abs(y - PUD.y) < 5) {
        s.frog.croak = 0.6; soon(0.05, () => { tone(43, { dur: 0.12, vol: 0.03, type: 'triangle' }); tone(46, { dur: 0.1, vol: 0.02, type: 'triangle', delay: 0.14 }); });
        later(0.8, () => { if (s.frog) s.frog.hop = 0.5; }); say('Krek-ek! The tree frog hops away'); return;
      }
      if (Math.abs(px - (LOG.x0 + LOG.x1) / 2) < 16 && Math.abs(y - LOG.y) < 5) { s.shroom = 1; note(9, { dur: 1, vol: 0.02 }); say(s.sw[0] > 0.6 ? 'Little pale mushrooms on the mossy log' : 'The mushrooms on the log glow softly'); return; }
      if (s.flyA > 0.2 && s.flies.some((f) => sq(f.x - px, f.y - y) < 8)) { for (const f of s.flies) { f.vx += (Math.random() - 0.5) * 20; f.vy -= Math.random() * 8; } note(11, { dur: 0.5, vol: 0.015 }); say('The fireflies scatter and drift back'); return; }
      if (y < WIN.yS) {   // the gable's triangle: the hour moves on
        s.stage = (s.stage + 1) % 3; s.stageT = 0;
        [0, 2, 4].forEach((k, i) => soon(i * 0.16, () => note(6 + k + s.stage, { dur: 1.1, vol: 0.02 })));
        say(['The afternoon light comes back through the trees', 'Dusk settles over the forest', 'Night in the woods; the stove glows'][s.stage], 4); return;
      }
      if (y > 150) {   // the misted lower panes: wiped with your sleeve
        wipe(s, xi, yi); swish(0.03); soon(0.12, () => tone(90, { dur: 0.08, vol: 0.006 }));
        const G = s.glass[0]; for (let k = 0; k < 2; k++) { const d = G.riv.find((q) => !q.on) || G.riv[k]; const pn = G.panes.find((q) => xi >= q[0] && xi < q[0] + q[2]) || G.panes[0]; newRiv(s.r, G.panes, d, true); d.p = pn; d.x = clamp(xi - 8 + k * 14, pn[0] + 1, pn[0] + pn[2] - 3); d.y = yi + 5; d.hold = 0.2; d.dep = d.y; }
        say('You wipe the mist from the glass'); return;
      }
      cycleRain(); return;
    }
    if (lay.wins.some((W) => W !== WIN && inWin(W, xi, yi))) { cycleRain(); return; }
    if (inR(100, 164, 138, 199)) { catPaw(); soon(0.1, () => { tone(76, { dur: 0.12, vol: 0.014, type: 'triangle' }); tone(81, { dur: 0.16, vol: 0.012, type: 'triangle', delay: 0.12 }); }); say('Mrrp — the cat paws at a drop on the glass'); return; }
    if (inR(129, 199, 138, 218)) { s.cat.flick += 3; tone(78, { dur: 0.1, vol: 0.01 }); say('The cat\'s tail twitches'); return; }
    if (inR(244, 176, 282, 199)) { pourTea(); return; }
    if (inR(250, 196, 302, 250)) { addLog(false); return; }
    if (inR(280, 84, 292, 196)) { tone(60, { dur: 0.3, vol: 0.012, type: 'triangle' }); say('The stovepipe ticks as it warms'); return; }
    if (inR(244, 146, 306, 250)) { note(5, { dur: 0.5, vol: 0.015 }); say('Green glazed tiles, warm to the touch'); return; }
    if (inR(232, 246, 316, 258)) { addLog(false); return; }
    if (inR(299, 218, 319, 250)) { addLog(true); return; }
    if (inR(0, 0, 320, 30) || RM.bulbs.some((b) => Math.abs(b.x - x) < 4 && Math.abs(b.y + 1 - y) < 4)) {
      s.strOn = !s.strOn; drip(0.022, 2400, 1600); soon(0.03, () => tone(s.strOn ? 88 : 83, { dur: 0.08, vol: 0.012, type: 'square' }));
      say(s.strOn ? 'The string lights glow along the beams' : 'The string lights off; just the stove and the rain'); return;
    }
    if (inR(48, 186, 75, 205)) {
      s.music = !s.music;
      if (s.music) { swish(0.012); soon(0.25, () => drip(0.008, 3000, 2600)); say('The needle drops — music on'); }
      else { tone(70, { dur: 0.15, vol: 0.01 }); say('You lift the needle; just the rain now'); }
      return;
    }
    if (inR(76, 190, 85, 205)) {
      const on = toggle('candle');
      if (on) { tone(88, { dur: 0.35, vol: 0.016 }); say('The candle lit again'); }
      else { drip(0.02, 420, 160); for (let k = 0; k < 6; k++) s.smoke.push({ x: CANDLE[0], y: CANDLE[1] - 2 - k * 3, a: k * 0.15, ph: k }); say('The candle snuffed'); }
      return;
    }
    if (inR(35, 188, 49, 205)) { swish(0.015); say(['“Mosses of the Northwest”', '“The Hidden Life of Trees”', '“A Year in the Rain Forest”', '“Notes from a Cedar Cabin”'][Math.floor(Math.random() * 4)]); return; }
    if (inR(36, 208, 59, 243)) { swish(0.015); say(['A record of rain-day jazz', 'Old folk songs, a little scratched', 'Piano nocturnes', 'Lo-fi beats for a wet afternoon'][Math.floor(Math.random() * 4)]); return; }
    if (inR(60, 208, 85, 243)) { swish(0.015); say('Books and a basket of yarn on the shelf'); return; }
    if (inR(BOOK.x0, BOOK.y0 - 2, BOOK.x1, BOOK.y1 + 1)) {
      if (s.flip <= 0) { s.flip = 1; swish(0.025); const [n, l] = GUIDE[(s.page + 1) % GUIDE.length]; say(`The field guide: ${n}, ${l}`, 4.5); }
      return;
    }
    if (inR(MUG.x - 7, MUG.y - 13, MUG.x + 8, MUG.y + 1)) {
      if (s.sip > 0) return;
      if (s.tea > 0) { s.sip = 1; drip(0.035, 520, 260); soon(0.5, () => tone(64, { dur: 0.3, vol: 0.012 })); say(s.tea === 1 ? 'The last of the tea' : 'A sip of tea, still hot'); }
      else pourTea();
      return;
    }
    if (inR(113, 262, 136, 277)) { tone(67, { dur: 0.15, vol: 0.016, type: 'triangle' }); soon(0.1, () => tone(64, { dur: 0.15, vol: 0.012, type: 'triangle' })); glint(124, 266); say('Pinecones from the trail by the creek'); return; }
    if (sq(x - 18, y - 186) < 30 || inR(2, 226, 30, 250)) { s.kick.mon = 1.8; swish(0.03); say('The monstera\'s big leaves sway'); return; }
    if (inR(36, 30, 92, 122)) { s.kick.fern = 2; swish(0.025); say('The fern swings gently in its macramé'); return; }
    if (inR(286, 96, 320, 180)) { s.kick.poth = 1.8; swish(0.025); say('The pothos trails down the wall'); return; }
    if (inR(17, 119, 42, 150)) { tone(72, { dur: 0.6, vol: 0.015 }); say('A pressed sword fern, framed'); return; }
    if (inR(118, 33, 202, 44)) { tone(57, { dur: 0.4, vol: 0.015, type: 'triangle' }); say('An old canoe paddle, from summers on the lake'); return; }
    if (sq(x - 259, y - 120) < 8) { tone(79, { dur: 0.3, vol: 0.012 }); soon(0.15, () => tone(76, { dur: 0.4, vol: 0.01 })); say(['The barometer says rain, as ever', 'The barometer: change', 'The barometer creeps toward fair'][s.rain === 0 ? 2 : s.rain === 1 ? 1 : 0]); return; }
    if (inR(48, 143, 83, 160)) { note(4, { dur: 0.4, vol: 0.015 }); say('Honey, beans, pencils and a tiny cactus'); return; }
    if (inR(96, 212, 134, 244) || inR(184, 212, 222, 244)) { swish(0.02); say('Baskets of blankets and books in the window seat'); return; }
    if (x < lay.vL + 92 && y > crestY(Math.max(0, x - lay.vL)) - 2) { tone(41, { dur: 0.5, vol: 0.02, type: 'triangle' }); say('You pull the knitted blanket closer'); return; }
    for (const sp of RM.geo.spots) if (inR(sp.x0, sp.y0, sp.x1, sp.y1)) { SPOTS[sp.id]?.(); return; }
    if (y > 262 && y < 320 && sq((x - 158) / 118, (y - 294) / 25) < 1) { swish(0.015); say('A braided rug, warm underfoot'); return; }
  };
  function cycleRain() {
    s.rain = s.rain === 1 ? 2 : s.rain === 2 ? 0 : 1; s.dryT = 0;
    note(s.rain === 0 ? 11 : s.rain === 1 ? 9 : 7, { dur: 1.2, vol: 0.03 });
    say(s.rain === 2 ? 'The rain gathers and pours down' : s.rain === 1 ? 'The rain eases to a soft patter' : ['The rain stops; sunlight breaks through the trees', 'The rain stops; a last glow through the trees', 'The rain stops; the clouds thin over the forest'][s.stage], 4);
  }
  canvas.addEventListener('pointerdown', onDown);

  // a new frame shape: rebuild the room only once the width has held for a moment, a little each
  // frame, showing the old room until the new one is ready. The first room is built the same way
  // behind a dark fade; once settled, the full-screen shape is built ahead in small slices, and the
  // lights likely to be wanted next (the next hour, the string lights the other way) are baked ahead
  const settleRoom = (bw) => {
    const want = roomW(bw), now = performance.now();
    if (!RM) {
      if (!job || jobW !== want) { job = buildRoom(want, s.off, keysNow()); jobW = want; }
      const done = pump(job, 6);
      if (done) { RM = done; job = null; jobW = 0; shownAt = s.t; syncLights(RM, s.off); }
    } else if (RM.bw !== want) {
      const cached = ROOMS.get(want);
      if (cached) { RM = cached; syncLights(RM, s.off); }
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildRoom(want, s.off, keysNow()); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && !ROOMS.has(preW)) { job = buildRoom(preW, s.off, keysNow()); jobW = preW; preTried = true; }
    }
    if (job && RM) {
      const done = pump(job, jobW === want ? 4 : 2.5);
      if (done) { job = null; jobW = 0; if (done.bw === want) { RM = done; syncLights(RM, s.off); } }
    }
    if (RM && RM.jobs.length && pump(RM.jobs[0], 2.5)) RM.jobs.shift();
    else if (RM && !job && s.t > 2) {
      // bake ahead, a slice a frame: this hour with the lights the other way, then the next hour
      if (!RM.ahead) {
        const want2 = [], so = s.strOn ? 1 : 0;
        for (const st of [s.stage, (s.stage + 1) % 3]) for (const o of st === s.stage ? [1 - so] : [so, 1 - so]) for (const fh of [0, 1]) want2.push(st * 4 + o * 2 + fh);
        const k = want2.find((kk) => !RM.back.img[kk] || !RM.front.img[kk]);
        if (k !== undefined) { const L = !RM.back.img[k] ? RM.back : RM.front; RM.ahead = { L, k, job: bakeGen(L.ras, 0, 0, RM.F, k) }; }
      }
      if (RM.ahead) { const done = pump(RM.ahead.job, 2.5); if (done) { RM.ahead.L.img[RM.ahead.k] = done; RM.ahead = null; } }
    }
    if (RM && !job) for (let st = 0; st < 3; st++) {
      if (st === s.stage || st === (s.stage + 1) % 3 || s.sw[st] > 0) continue;
      for (let k = st * 4; k < st * 4 + 4; k++) { RM.back.img[k] = undefined; RM.front.img[k] = undefined; }
    }
    if (RM && (!B || B.buf.width !== RM.bw)) B = makeBuffers(RM.bw);
  };

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, pw = canvas.width, ph = canvas.height;
    // whole steps: when the canvas is a whole multiple of the buffer's height, the buffer is made as
    // wide as the canvas needs at that step, so the blit never resamples; otherwise the room is blown
    // up by whole steps and the last bit smoothed
    const exact = ph % H === 0, k = exact ? ph / H : Math.max(1, Math.ceil(ph / H));
    const bw = Math.max(320, exact ? Math.ceil(pw / k) : Math.round((320 * W) / 640));
    settleRoom(bw);
    if (!RM) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = SIDE; ctx.fillRect(0, 0, pw, ph); ctx.restore(); return; }
    update(s, dt, RM.lay, hooks);
    // the rain's sound follows the rain you see, a step at a time
    const rv = Math.round(clamp(0.06 + s.rainLv * 1.45 - (1 - s.wet) * 0.04, 0.03, 1.3) * 20) / 20;
    if (rv !== rainSet && s.t - rainAt > 0.5) { rainSet = rv; rainAt = s.t; amb.set('rain', rv); }
    render(B.g, B.pc, RM, O, s);
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
    clearTimeout(crackleT);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    stopLoop();
    stopMusic();
    amb.stop();
    canvas.removeEventListener('pointerdown', onDown);
  };
}
