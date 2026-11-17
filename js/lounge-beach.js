// Sunset Beach — a lounge, not a game: a wooden deckchair on warm sand at the end of a long day,
// looking out over a little cove as the sun goes down into the sea. Over about ten minutes the sky
// turns from golden hour through orange and rose to a violet dusk with the first stars and a thin
// moon; layered clouds catch the light from beneath, a path of light shimmers across the water
// toward you, and a sailboat slips along the horizon. Waves gather out in the bay, curl with the low
// sun shining through them, break into foam, wash up the sand and draw back, leaving it glossy with
// the sky and fizzing with bubbles. A palm leans over from the left; a wooden pier runs out to sea on
// the right, its lanterns coming on one by one as the light goes. Gulls glide, crabs scuttle sideways
// from their holes, sandpipers run in and out with the water, and the sea smooths away the
// footprints. Close by: your deckchair's armrest with a tall drink and a paper umbrella, a straw
// hat, a book face down on a striped towel, sunglasses. In full screen the cove goes on: a hammock
// slung between two palms, a bonfire with friends round it further along the beach, dunes with
// grass in the wind; on the right the pier's steps down to the rocks and their tide pools, a
// lifeguard hut on stilts, a rowboat pulled up on the sand and a lighthouse out on the far point.
// Pixel art, as in the other lounges: painted into a buffer 320 px tall (as wide as the frame's
// shape) and scaled up by whole steps with no smoothing. Every still thing is painted once in
// daylight colours; each pixel then takes its colour from a short ramp made for that colour (a cool
// side for the sky's light, a warm side for the sun, the lanterns and the fire), stepped by the light
// that reaches it, flat inside a step, with ordered dither only where two steps meet. The sky, the
// clouds and the sea are painted in their own colours for each of six steps of the evening and
// crossfaded as it goes; the beach is baked once per frame shape, per step and per lantern state.
// Each frame only the moving things are drawn: the sun, the glitter, the waves (into a small band of
// pixels of their own), the creatures and the lights.

import { setupCanvas, runLoop, pointIn, tone, note, drip, splash, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'beach', title: 'Sunset Beach', blurb: 'A deckchair on the sand as the sun sinks into the sea. Waves, palms, a pier and its lanterns.', keys: 'Click the waves, the sun, the shells…', lounge: true };

const H = 320;                      // buffer height; the core composition is 320 wide
const STEP = 16;                    // beach widths round up to this, so a resize doesn't rebuild every frame
const SIDE = '#2c2236';             // the edges, for the moment a wider beach is still being built
const HZ = 120;                     // the horizon
const SUNX = 148;                   // the sun goes straight down into the sea here
const FAR0 = 92;                    // the sea's layer starts here: far land stands above the horizon
const SEA1 = 216;                   // and ends under the sand
const SAND0 = 150;                  // the sand's layer (the shore curves up to here at the sides)
const FRONT0 = 262;                 // the things close by: the towel, the hat, the armrest
const BY0 = 150, BY1 = 252, BH = BY1 - BY0;   // the band the waves are drawn into, live
const NST = 6;                      // steps of the evening's light
const DAYLEN = 600;                 // seconds from golden hour to dusk
const STAGE_TXT = ['Golden hour', 'Late golden hour', 'Sunset', 'The sun meets the sea', 'Afterglow', 'Dusk, the first stars'];
const PALM = { fx: 30, fy: 252, tx: 88, ty: 46, bend: 26 };   // the big palm: foot, crown, bow
const ARM = { x: 256, y: 283 };     // the armrest's rounded front end
const DRINK = { x: 264, y: 291 };   // the glass's foot, on the armrest
const SHADES = { x: 80, y: 300 };   // the sunglasses on the towel
const HAT = { x: 206, y: 301 };
const BOOK = { x: 119, y: 293 };
const STAR = { x: 178, y: 270 };    // the starfish
const HOLES = [[110, 252], [226, 258]];
const MOON = { x: 266, y: 34 };
// the pier: a post at distance z stands in the water at pGY(z); its deck's edge is at pDY(z)
const PIER = { xv: 206, C: 1540, A: 768, W: 190 };
const PZN = 10.6, PZF = 104;
const pGY = (z) => HZ + PIER.A / z, pDY = (z) => HZ - (0.1 * PIER.A) / z, pX = (z) => PIER.xv + PIER.C / z, pW = (z) => PIER.W / z;

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
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// a colour as one little-endian ImageData word, for the waves' band
const pack = (c, a = 1) => ((Math.round(a * 255) << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
const shoreY = (x) => 201 + 1.6 * Math.sin(x * 0.021 + 0.7) + 1.1 * Math.sin(x * 0.057 + 2) - 46 * ease((x - 300) / 180) - 40 * ease((-20 - x) / 170);

/* ——— a little raster to paint the still layers in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  has(x, y) { const i = this.at(x, y); return i >= 0 && this.d[i + 3] > 0; }
  get(x, y) { const i = this.at(x, y); return i < 0 || !this.d[i + 3] ? -1 : (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]; }
  px(x, y, c, a = 1) {
    const i = this.at(x, y);
    if (i < 0 || a <= 0) return;
    const d = this.d, r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a), k = da * (1 - a);
    const na = Math.round(oa * 255);   // 250–254 are flags (254 glows by itself, 252 is a rim), never a blend's result
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 250 ? 255 : na;
  }
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
  rimPx(x, y) { const i = this.at(x, y); if (i >= 0 && this.d[i + 3] === 255) this.d[i + 3] = 252; }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
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
  canvas() { return toCanvas(this.d, this.w, this.h); }
}
function toCanvas(d, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
  return c;
}
// edges that face the low sun catch its light: an opaque pixel with nothing behind it on the sun's
// side is flagged (alpha 252) for the bake to light as a rim
function rimPass(R, x0, y0, x1, y1, sy = 104) {
  const marks = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = R.at(x, y);
    if (i < 0 || R.d[i + 3] !== 255) continue;
    const dx = SUNX - x, dy = sy - y, d = sq(dx, dy) || 1;
    if (!R.has(Math.round(x + (dx / d) * 1.45), Math.round(y + (dy / d) * 1.45))) marks.push(x, y);
  }
  for (let k = 0; k < marks.length; k += 2) R.rimPx(marks[k], marks[k + 1]);
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

/* ——— the evening, in six steps: the sky's own colours for each ——— */
const SKY = [   // zenith → horizon
  [0x5e7cbc, 0x7e94c6, 0xa6a8c6, 0xceb6b0, 0xeac29a, 0xf4cc84, 0xf8d68a, 0xfce4a8],
  [0x4c62a4, 0x6c74a8, 0x9682a4, 0xc4929a, 0xe4a484, 0xf2b26a, 0xf8c066, 0xfcd07c],
  [0x3a4088, 0x5a4a8e, 0x88568e, 0xb86488, 0xdc747a, 0xf08e68, 0xf8a65a, 0xfcbe62],
  [0x2a2c6c, 0x44387c, 0x6c4486, 0x9a5086, 0xc85e80, 0xe87474, 0xf68e68, 0xfaa86a],
  [0x1c1e50, 0x282862, 0x3a3272, 0x543c7a, 0x76487e, 0x9a547c, 0xc0647a, 0xdc7c74],
  [0x0e1236, 0x161c48, 0x202456, 0x2e2c60, 0x423468, 0x5a3e6c, 0x784a70, 0x965872],
];
const GLOW = [[0xf8d07a, 0xfadc92], [0xf8be66, 0xfacc7e], [0xf8a656, 0xfab86a], [0xf68c5a, 0xf8a066], [0xe0806e, 0xeea07e], [0xb06878, 0xc8807c]];
const GLOWK = [0.9, 1, 1.1, 1.2, 0.9, 0.55];
const SUNREP = [64, 81, 98, 116, 136, 160];   // where the sun stands for each step's painted glow
const CLOUD = [   // dark body, body, lit, underside, top edge
  [0xa49aae, 0xcfb6b0, 0xf4d2a0, 0xfff0c0, 0xe2d2cc],
  [0x8a7aa0, 0xb0909e, 0xf0b88e, 0xffdca0, 0xc2acb8],
  [0x5c4c7c, 0x84608a, 0xd6867c, 0xffba82, 0x9e7894],
  [0x45386a, 0x684a7c, 0xbe607a, 0xf8987c, 0x84628a],
  [0x2e2a56, 0x423868, 0x784c74, 0xae6a7a, 0x584672],
  [0x1a1a3e, 0x262650, 0x3c325c, 0x5c4266, 0x322e58],
];
const SEA = [   // far → near
  [0x2c4c7c, 0x30588a, 0x376892, 0x3e7896, 0x488896, 0x579a98, 0x6aaa9c],
  [0x2e4478, 0x344e84, 0x3a5a8a, 0x42688e, 0x4c7690, 0x5a8692, 0x6c9696],
  [0x2c3670, 0x343e7a, 0x3c4a82, 0x465688, 0x52628a, 0x606e8c, 0x727c8e],
  [0x262a62, 0x2e326c, 0x383c76, 0x42487c, 0x4e5480, 0x5c6084, 0x6c6c88],
  [0x181c48, 0x1e2452, 0x252c5a, 0x2c3460, 0x343c66, 0x3e466a, 0x4a506e],
  [0x0e1234, 0x121840, 0x161e48, 0x1a244e, 0x202a54, 0x263058, 0x2e385c],
];
const PATH = [[0xfffbe0, 0xffe8a0, 0xf8c870], [0xfff4d0, 0xffd890, 0xf4b060], [0xffe8c0, 0xffbc78, 0xf09058], [0xffd8b8, 0xffa070, 0xe87868], [0xe8a8b8, 0xc07890, 0x905878], [0xa898c0, 0x786890, 0x584e78]];
const PATHK = [0.8, 0.95, 1, 1, 0.35, 0.12];
const SURF = [   // foam, foam shade, sheet over sand, deep sheet, light through the wave, the wet sand's sheen
  [0xfff8e8, 0xd8dccc, 0x78b8ae, 0x3e8a96, 0x9ae0c4, 0xf6dcae],
  [0xfff0dc, 0xdcd0c4, 0x76aaa6, 0x407a90, 0xb2d8b0, 0xf6cc9c],
  [0xffe8d8, 0xdcc0c0, 0x8494a6, 0x485e8a, 0xd8b4a0, 0xf6ae8e],
  [0xffe0d8, 0xd8b4bc, 0x82809c, 0x464e80, 0xe49c9a, 0xee988e],
  [0xb0a0c8, 0x8a7ca8, 0x58608a, 0x2c3462, 0x8a76a2, 0xae7e9a],
  [0x7c76a0, 0x5c5888, 0x3a4470, 0x1c2448, 0x5a5488, 0x6e5e8a],
];
const SUNC = [[0xfffff4, 0xfff2b0, 0xffc458], [0xfffcea, 0xffe496, 0xffb050], [0xfff2d2, 0xffc474, 0xff9c52], [0xffe4c4, 0xff9e5c, 0xf06a48], [0xffd0b0, 0xff8a58, 0xe05a48], [0xffc0a0, 0xf87a50, 0xd04c40]];
const GULLC = [[0x4c4656, 0xf8e6b8], [0x4a4054, 0xf8d4a0], [0x46384e, 0xf4b088], [0x402e4a, 0xf09888], [0x2e2440, 0xa07898], [0x221c36, 0x6a5a88]];
const SAILC = [0xfff0d0, 0xffe0b0, 0xffc8a0, 0xffb0a0, 0xc898b0, 0x8a7aa0];
const HAZE = 0xb4a4bc;

/* ——— light on the beach: colour ramps ———
   For each painted colour, fourteen lit versions per step of the evening: seven on the cool side (the
   sky's light: blue-violet shade, deeper violet toward dusk) and seven on the warm side (gold, then
   orange and coral, rose, and at dusk the lanterns' amber). A pixel's step comes from the total light
   on it, its side from how much of that light is warm. */
const TONES = [   // cool: × rgb in shadow, × rgb lit, + rgb in shadow; warm: the same
  { c0: [0.78, 0.76, 1.1], c1: [0.98, 0.97, 1.0], ca: [12, 10, 30], w0: [1.02, 0.84, 0.82], w1: [1.14, 1.0, 0.84], wa: [18, 8, 6] },
  { c0: [0.8, 0.74, 1.1], c1: [1.0, 0.95, 0.98], ca: [14, 10, 32], w0: [1.06, 0.8, 0.76], w1: [1.18, 0.94, 0.78], wa: [20, 6, 6] },
  { c0: [0.84, 0.7, 1.08], c1: [1.02, 0.9, 0.98], ca: [18, 8, 34], w0: [1.1, 0.72, 0.72], w1: [1.28, 0.86, 0.72], wa: [24, 6, 10] },
  { c0: [0.86, 0.66, 1.08], c1: [1.02, 0.86, 1.0], ca: [22, 8, 38], w0: [1.1, 0.66, 0.78], w1: [1.28, 0.8, 0.84], wa: [26, 4, 18] },
  { c0: [0.74, 0.64, 1.12], c1: [0.94, 0.84, 1.08], ca: [16, 10, 40], w0: [1.08, 0.78, 0.62], w1: [1.3, 0.98, 0.62], wa: [22, 8, 0] },
  { c0: [0.62, 0.6, 1.12], c1: [0.84, 0.8, 1.1], ca: [10, 10, 36], w0: [1.08, 0.78, 0.6], w1: [1.3, 0.98, 0.6], wa: [22, 8, 0] },
];
const AMB = [0.62, 0.58, 0.54, 0.5, 0.4, 0.3];   // how much sky light, sun and firelight reach, by step
const SUN = [0.62, 0.58, 0.52, 0.42, 0.1, 0];
const FIRE = [0.25, 0.3, 0.4, 0.55, 0.85, 1];
const RIM = [0xffe6a0, 0xffd080, 0xffac6c, 0xff8c78, 0xd884a4, 0x8c78b4];
const RIMK = [0.8, 0.8, 0.75, 0.7, 0.45, 0.3];
const RAMPS = new Map();
function rampOf(c, st) {
  const key = c * 8 + st;
  let rp = RAMPS.get(key);
  if (rp) return rp;
  rp = new Int32Array(14);
  const T = TONES[st], r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  for (let k = 0; k < 7; k++) {
    const u = k / 6, Ic = 0.28 + 0.72 * u, Iw = 0.36 + 0.72 * u;
    const cm = [0, 1, 2].map((i) => T.c0[i] + (T.c1[i] - T.c0[i]) * u), ca = T.ca.map((v) => v * (1 - u));
    const wm = [0, 1, 2].map((i) => T.w0[i] + (T.w1[i] - T.w0[i]) * u), wa = T.wa.map((v) => v * (0.5 + 0.5 * u));
    rp[k] = (ch(r * Ic * cm[0] + ca[0]) << 16) | (ch(g * Ic * cm[1] + ca[1]) << 8) | ch(b * Ic * cm[2] + ca[2]);
    rp[7 + k] = (ch(r * Iw * wm[0] + wa[0]) << 16) | (ch(g * Iw * wm[1] + wa[1]) << 8) | ch(b * Iw * wm[2] + wa[2]);
  }
  RAMPS.set(key, rp);
  return rp;
}
// one lit version of a painted raster: key = step × 2 + lanterns. Standing things (`stand`) face you
// with the sun behind them, so they take little of it but their rims. Alpha 254 glows by itself.
function bakeOne(src, x0, y0, F, key, stand) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length), rw = F.rw, st = key >> 1, l = key & 1;
  const am = AMB[st] * (stand ? 0.86 : 1), sn = SUN[st] * (stand ? 0.26 : 1), fk = FIRE[st], rim = RIM[st], rk = RIMK[st];
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.5, warm = 0.2;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) {
        const j = Y * rw + X;
        cool = F.A[j] * am; warm = F.S[j] * sn + l * F.L[j] + F.B[j] * fk;
      }
      const tot = cool + warm, lv = Math.min(6, band(Math.min(6, Math.max(0, (tot - 0.1) / 0.15)), X, Y));
      const wf = warm / tot, side = wf > 0.42 ? 7 : wf < 0.3 ? 0 : bay(X + 2, Y + 1) < (wf - 0.3) / 0.12 ? 7 : 0;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c, st); }
      let o = rp[side + lv];
      if (al === 252) o = mixc(rp[7 + Math.min(6, lv + 2)], rim, rk);
      out[i] = o >> 16; out[i + 1] = (o >> 8) & 255; out[i + 2] = o & 255; out[i + 3] = al >= 250 ? 255 : al;
    }
  }
  return toCanvas(out, w, h);
}
// the lit colour of one painted colour at one point, for the things drawn over the bake
function litOf(G, x, y, c, key, stand) {
  const F = G.F, X = clamp(Math.round(x) + G.ox, 0, G.bw - 1), Y = clamp(Math.round(y), 0, H - 1), j = Y * G.bw + X, st = key >> 1;
  const cool = F.A[j] * AMB[st] * (stand ? 0.86 : 1), warm = F.S[j] * SUN[st] * (stand ? 0.26 : 1) + (key & 1) * F.L[j] + F.B[j] * FIRE[st], tot = cool + warm;
  return rampOf(c, st)[(warm / tot > 0.36 ? 7 : 0) + Math.min(6, Math.round(Math.max(0, (tot - 0.1) / 0.15)))];
}

/* ——— the beach's shape for one width ———
   The core is the cove: the sea in the middle, the big palm on the left, the pier on the right. In
   full screen the beach curves out either side, and each little place along it is painted only where
   it fits whole: never cut in half by the edge of the screen. */
function layout(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox;
  return {
    rw, ox, L, RT, wide: ox > 0,
    hammock: L <= -88,       // two palms and a hammock slung between them
    fire: L <= -128,         // friends round a bonfire, further along the beach
    dunes: L <= -150,        // high dunes with grass, a sand fence
    stairs: RT >= 396,       // the pier's steps down to the sand, rocks and tide pools at their foot
    hut: RT >= 446,          // the lifeguard hut on its stilts
    rowboat: RT >= 504,      // a rowboat pulled up above the tide line
    light: RT >= 528,        // a lighthouse out on the far point
  };
}
function shoreFor(G) {
  const { rw, ox } = G;
  G.yb = new Int16Array(rw); G.persp = new Float32Array(rw); G.reach = new Float32Array(rw); G.sw0 = new Float32Array(rw);
  for (let X = 0; X < rw; X++) {
    const x = X - ox, y = shoreY(x), p = (y - HZ) / 81;
    G.yb[X] = Math.round(y); G.persp[X] = p;
    G.reach[X] = (15 + 10 * vnoise(x / 23, 3.7)) * p * p;
    G.sw0[X] = y - (y - HZ) * 0.42;
  }
}

/* ——— the light reaching each point: sky light, the sun, the lanterns, the fire ——— */
function* fieldsFor(G) {
  const { rw, ox } = G, n = rw * H, F = { rw, A: new Float32Array(n), S: new Float32Array(n), L: new Float32Array(n), B: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) {
      const x = X - ox, j = y * rw + X;
      let a = 1, s = 0.74;
      if (y > 150) s += 0.18 * Math.max(0, 1 - Math.abs(x - SUNX) / (34 + (y - 150) * 0.7));   // the sand along the path of light
      if (y >= FRONT0 + 10) s *= 0.92;
      const vx = (x - 160) / (rw / 2 + 60), vy = (y - 210) / 300;
      a *= 1 - Math.min(0.26, (vx * vx + vy * vy) * 0.45);
      F.A[j] = a; F.S[j] = s;
    }
    if (y % 64 === 63) yield;
  }
  // long shadows thrown toward you by the low sun ahead
  for (const sh of G.shadows) {
    for (let y = sh.y; y < Math.min(H, sh.y + sh.len); y++) {
      const u = (y - sh.y) / sh.len, cx = sh.x + (sh.x - SUNX) * 0.42 * (y - sh.y) / 100, hw = sh.w * (0.7 + u * 1.6);
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const X = x + ox; if (X < 0 || X >= rw) continue;
        const e = Math.abs(x - cx) / hw, k = sh.k + (1 - sh.k) * Math.max(u ** 1.5, e > 0.5 ? (e - 0.5) / 0.5 : 0);
        F.S[y * rw + X] *= k;
      }
    }
  }
  // the lanterns' pools of light, and the fire's
  const pool = (cx, cy, r, k, Arr, sy = 1.2) => {
    for (let y = Math.max(0, Math.floor(cy - r / sy)); y < Math.min(H, cy + r / sy); y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const X = x + ox; if (X < 0 || X >= rw) continue;
      const d = sq(x - cx, (y - cy) * sy) / r;
      if (d < 1) Arr[y * rw + X] = Math.min(1.3, Arr[y * rw + X] + (1 - d) ** 1.6 * k);
    }
  };
  for (const p of G.lanterns) pool(p.x, p.y + 2, 6 + p.s * 9, 1.05, F.L);
  if (G.hutLamp) pool(G.hutLamp.x, G.hutLamp.y + 6, 18, 0.6, F.L);
  if (G.fireAt) pool(G.fireAt.x, G.fireAt.y - 3, 40, 1.15, F.B, 1.6);
  yield;
  return F;
}

/* ——— the sky for one step: a stepped gradient, banded round the sun ——— */
function paintSky(G, st) {
  const R = new Ras(G.rw, HZ + 2, G.ox, 0), cols = SKY[st], n = cols.length - 1, sy = SUNREP[st], gc = GLOW[st], gk = GLOWK[st];
  for (let y = 0; y <= HZ + 1; y++) for (let x = G.L; x < G.RT; x++) {
    const v = (y / HZ) ** 0.82 * n;
    const d = sq((x - SUNX) / 2.6, (y - sy) * 1.15), g = Math.max(0, 1 - d / 74) ** 1.7 * 2.6 * gk;
    const lv = band(Math.min(n + 1.99, v + g), x, y);
    R.px(x, y, lv <= n ? cols[lv] : gc[lv - n - 1]);
  }
  return R.canvas();
}
// a strip of clouds that wraps round: banks of lumpy cloud on flat bases, their undersides lit by
// the low sun and their tops by the sky; high up, long thin streaks
const CW = 800;
function cloudStrip(st, seed, hi) {
  const h = hi ? 44 : 60, r = rng(seed), m = new Float32Array(CW * h), base = new Float32Array(CW).fill(-1), R = new Ras(CW, h), C = CLOUD[st];
  const stamp = (cx, cy, rad, sx, k, by) => {
    for (let y = Math.floor(cy - rad); y <= Math.min(by, cy + rad); y++) for (let x = Math.floor(cx - rad * sx); x <= cx + rad * sx; x++) {
      if (y < 0 || y >= h) continue;
      const d = sq((x - cx) / sx, y - cy) / rad;
      if (d >= 1) continue;
      const X = ((x % CW) + CW) % CW;
      m[y * CW + X] += (1 - d) * k;
      base[X] = Math.max(base[X], by);
    }
  };
  const n = hi ? 7 : 6;
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.2 + r() * 0.6) * CW) / n, len = (hi ? 70 : 46) + r() * (hi ? 90 : 70);
    if (hi) {
      // a streak of mackerel sky: thin lobes in a long, slightly wavy line
      const by = 8 + r() * 28, lobes = Math.round(len / 5);
      for (let k = 0; k < lobes; k++) { const u = k / (lobes - 1), x = cx - len / 2 + u * len, y = by + Math.sin(u * 5 + i) * 1.5; stamp(x, y, (1 + 1.6 * Math.sin(Math.PI * u)) * (0.7 + r() * 0.5), 3.2, 1.1, y + 1); }
      continue;
    }
    // a bank: lobes along a flat base, tallest toward the middle, a tail streaming off one end
    const by = 18 + r() * 34, thick = 3.5 + r() * 5, lobes = Math.round(len / 6);
    for (let k = 0; k < lobes; k++) {
      const u = k / (lobes - 1), rad = thick * (0.3 + 0.95 * Math.sin(Math.PI * u) ** 0.9) * (0.5 + r() * 0.9);
      stamp(cx - len / 2 + u * len + (r() - 0.5) * 6, by - rad * 0.45, rad, 1.5, 1.25, by + (hash(i, k) < 0.4 ? 1 : 0));
      if (u > 0.2 && u < 0.8 && r() < 0.3) stamp(cx - len / 2 + u * len, by - rad * 1.2 - 2, rad * (0.5 + r() * 0.3), 1.3, 1.2, by);   // a little tower
    }
    const dir = r() < 0.5 ? -1 : 1, tl = 30 + r() * 50;
    for (let k = 0; k < tl; k += 3) stamp(cx + dir * (len / 2 + k), by - 1 + (k / tl) * 2, 1.6 * (1 - k / tl) + 0.6, 3, 1, by + 1);
  }
  const at = (x, y) => (y < 0 || y >= h ? 0 : m[y * CW + (((x % CW) + CW) % CW)]);
  for (let y = 0; y < h; y++) for (let x = 0; x < CW; x++) {
    const v = m[y * CW + x];
    if (v < 0.3 || (v < 0.44 && bay(x, y) > (v - 0.3) / 0.14)) continue;
    const under = at(x, y + 1) < 0.3, under2 = at(x, y + 2) < 0.3, top = at(x, y - 1) < 0.3;
    let c = C[v > 1.5 ? 0 : 1];
    if (under) c = C[3];
    else if (under2 || (at(x, y + 3) < 0.3 && bay(x, y) < 0.5)) c = C[2];
    else if (top) c = C[4];
    else if (v > 1.5 && at(x + 1, y - 1) < 0.5) c = C[1];
    R.px(x, y, c);
  }
  return R.canvas();
}
const CLOUDS = [];
const cloudsFor = (st) => CLOUDS[st] || (CLOUDS[st] = [cloudStrip(st, 11, true), cloudStrip(st, 29, false)]);

/* ——— far land, the sea, and the sea's light for one step ——— */
function paintFar(R, G, st) {
  const sky = SKY[st], far = mixc(sky[6], 0x2c2240, 0.55), farD = mixc(sky[6], 0x2c2240, 0.7), farL = mixc(far, GLOW[st][0], 0.25);
  const hill = (x0, x1, top, k = 1) => {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0), hh = Math.round(top * Math.sin(u * Math.PI) ** 0.7 * (0.85 + 0.15 * vnoise(x / 5, k)) * k);
      for (let y = HZ - hh; y <= HZ; y++) R.px(x, y, y === HZ - hh && x > SUNX - 300 ? farL : far);
    }
  };
  const tinyPalm = (x, base, h, lean) => {
    for (let j = 0; j < h; j++) R.px(Math.round(x + lean * (j / h) ** 2), base - j, farD);
    const tx = Math.round(x + lean), ty = base - h;
    for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 1], [-1, -1], [1, -1], [0, -1], [-4, 2], [4, 2]]) R.px(tx + dx, ty + dy, farD);
  };
  // an island out on the horizon, two palms on it
  hill(34, 94, 5, 1); tinyPalm(52, HZ - 4, 7, 2); tinyPalm(60, HZ - 4, 9, -1);
  // the far points of the cove, in full screen
  if (G.L < -90) { hill(G.L - 40, -96, 12, 1.1); for (let x = -110; x > G.L; x -= 13 + Math.round(hash(x, 4) * 9)) tinyPalm(x, HZ - 6 - Math.round(hash(x, 5) * 3), 6 + Math.round(hash(x, 6) * 5), hash(x, 7) * 4 - 2); }
  if (G.RT > 430) {
    hill(436, G.RT + 60, 14, 1);
    for (let x = 452; x < G.RT; x += 15 + Math.round(hash(x, 8) * 8)) if (!(G.light && Math.abs(x - 508) < 10)) tinyPalm(x, HZ - 8 - Math.round(hash(x, 9) * 3), 6 + Math.round(hash(x, 3) * 5), hash(x, 2) * 4 - 2);
  }
  if (G.light) {   // a lighthouse on the point: white with a red band, its lamp drawn live
    const lx = 508, b = HZ - 11;
    for (let y = b - 14; y <= b; y++) { const hw = y < b - 10 ? 1 : 2; for (let x = -hw; x <= hw; x++) R.px(lx + x, y, (y > b - 8 && y < b - 4) ? mixc(0xb04040, far, 0.5) : mixc(0xe8e0d8, far, 0.45)); }
    R.rect(lx - 2, b - 17, 5, 1, farD); R.rect(lx - 1, b - 16, 3, 2, mixc(0x4a4040, far, 0.4)); R.px(lx, b - 18, farD);
    G.lightAt = { x: lx, y: b - 15 };
  }
  // the land's dark reflection just under the horizon
  for (let y = HZ + 1; y < HZ + 4; y++) for (let x = G.L; x < G.RT; x++) if (R.has(x, HZ - (y - HZ) * 2) && bay(x, y) < 0.7 - (y - HZ) * 0.15) R.px(x, y, farD);
}
function paintSea(G, st) {
  const R = new Ras(G.rw, SEA1 - FAR0, G.ox, -FAR0), S = SEA[st], sky = SKY[st], P = PATH[st], pk = PATHK[st], gc = GLOW[st][0];
  paintFar(R, G, st);
  for (let y = HZ + 1; y < SEA1; y++) {
    const dz = (y - HZ) / (201 - HZ), sc = 1 + dz * 5;
    for (let x = G.L; x < G.RT; x++) {
      if (R.has(x, y)) continue;
      let v = Math.min(1, dz) ** 0.75 * 6 + (vnoise(x / (5 * sc), y / (0.8 + dz * 2)) - 0.5) * 0.9;
      let c = S[clamp(band(v, x, y), 0, 6)];
      // the sky held in the water: long broken ridges catching its colour
      const rid = Math.sin(x / (2.2 * sc) + y * (1.6 - dz * 0.9) + vnoise(x / (14 * sc), y / 3) * 6);
      if (rid > 0.9 - dz * 0.05) c = mixc(c, sky[clamp(Math.round(7 - dz * 4), 3, 7)], 0.45);
      else if (rid < -0.94) c = mixc(c, 0x101030, 0.18);
      // the horizon's own glow, laid along the far water
      if (y < HZ + 5) c = mixc(c, gc, (0.5 - (y - HZ) * 0.1) * Math.max(0.25, 1 - Math.abs(x - SUNX) / 200));
      // the path of light under the sun, widening toward you
      if (pk > 0) {
        const pw = 3 + (y - HZ) * 0.55, e = Math.abs(x - SUNX) / pw;
        if (e < 1.25) {
          const h = hash(Math.floor((x - SUNX) / (1 + dz * 2.5)), y), k = pk * (1 - e * 0.7);
          if (h < 0.42 * k) c = mixc(c, P[h < 0.14 * k ? 0 : 1], Math.min(1, k + 0.2));
          else if (e < 1 && bay(x, y) < 0.32 * k) c = mixc(c, P[2], 0.6);
        }
      }
      // the shallows: clearer, greener water over the sand
      const yb = shoreY(x);
      if (y > yb - 9) { const u = (y - (yb - 9)) / 9; if (bay(x, y) < u * 1.2) c = mixc(c, mixc(S[6], 0xc8c090, 0.25), 0.55); }
      R.px(x, y, c);
    }
  }
  return R.canvas();
}
// a ridge of swell out on the open water, drawn live as it runs in: a dashed row per step
function ridgeStrip(G, st) {
  const R = new Ras(G.rw, 2), S = SEA[st], sky = SKY[st];
  for (let X = 0; X < G.rw; X++) {
    if (hash(X >> 2, 31) < 0.55) R.px(X, 0, mixc(S[5], sky[6], 0.5));
    if (hash((X + 2) >> 2, 37) < 0.5) R.px(X, 1, mixc(S[1], 0x101030, 0.2));
  }
  return R.canvas();
}

/* ——— the sand: damp and smooth by the water, dry and rippled further up ——— */
const DRY = [0xc8ac84, 0xd4b892, 0xdec4a0, 0xe8d2b0];
const DAMP = [0xc8aa82, 0xbc9e76, 0xae906a, 0xa0825e];
function* paintSand(R, G) {
  for (let X = 0; X < G.rw; X++) {
    const x = X - G.ox, yb = G.yb[X];
    for (let y = Math.max(SAND0, yb); y < H; y++) {
      const dd = y - yb, k = (y - HZ) / (H - HZ), ds = 32 * G.persp[X];
      let c;
      if (dd < ds - (bay(x, y) < 0.5 ? 0 : 1)) {
        const v = 3.2 - (dd / ds) * 3.1 + (vnoise(x / (4 + k * 8), y / 2.2) - 0.5) * 0.7;
        c = DAMP[clamp(band(v, x, y), 0, 3)];
      } else {
        const rip = Math.sin(x * 0.11 / (0.35 + k) + y * 0.75 / (0.4 + k) + vnoise(x / 22, y / 9) * 5);
        const v = 1.7 + (vnoise(x / (5 + k * 10), y / (3 + k * 5)) - 0.5) * 1.5 + (rip > 0.74 ? 0.8 : rip < -0.78 ? -0.75 : 0) - Math.max(0, 1 - (dd - ds) / 8) * 0.9;
        c = DRY[clamp(band(v, x, y), 0, 3)];
        const h = hash(x, y);
        if (h < 0.012) c = 0xa88c6a; else if (h > 0.992) c = 0xfff0d0;
      }
      R.px(x, y, c);
    }
    if (X % 96 === 95) yield;
  }
  // the high-tide line: dried weed and bits of shell
  for (let X = 0; X < G.rw; X++) {
    const x = X - G.ox, y = G.yb[X] + Math.round(36 * G.persp[X] + Math.sin(x * 0.05) * 2.5 + Math.sin(x * 0.17) * 1.2);
    if (vnoise(x / 9, 5) < 0.45) continue;   // in clumps, with bare sand between
    if (hash(x, 77) < 0.5) R.px(x, y, hash(x, 78) < 0.5 ? 0x6a6a34 : 0x7e6a40);
    if (hash(x, 79) < 0.2) R.px(x, y - 1, 0x5a5a2c);
    if (hash(x, 80) < 0.08) R.px(x + 1, y + 1, 0xf6eee0);
  }
  // crab holes, the starfish, the shadow under the hat
  for (const [hx, hy] of HOLES) { R.ell(hx, hy, 2, 1, 0x6a5038); R.px(hx, hy, 0x3a2a20); R.px(hx - 1, hy, 0x4a3828); R.px(hx + 3, hy + 1, 0xf6e2b6); R.px(hx - 3, hy + 1, 0xf6e2b6); R.px(hx + 1, hy + 2, 0xeed8a8); }
  const sx = STAR.x, sy = STAR.y;
  for (let a = 0; a < 5; a++) {
    const ang = -Math.PI / 2 + (a / 5) * Math.PI * 2 + 0.2;
    for (let j = 0; j <= 4; j++) { const x = Math.round(sx + Math.cos(ang) * j * 1.15), y = Math.round(sy + Math.sin(ang) * j * 0.7); R.px(x, y, j > 3 ? 0xd85a3a : 0xf07a44); if (j < 3) R.px(x + 1, y, 0xe86a3e); }
  }
  R.px(sx, sy, 0xf8a060); R.px(sx + 1, sy, 0xfab070); R.px(sx - 1, sy + 1, 0xc84a30);
  R.ell(HAT.x - 3, HAT.y + 3, 15, 4, 0xb8996c);
  if (G.hammock) R.ell(-34, 234, 16, 2, 0xc8a87a);
}

/* ——— the pier: posts in the water, a deck along the horizon, lanterns on the rail ——— */
const PIERC = { post: 0x5a4030, postD: 0x3e2c22, wet: 0x34382c, deck: 0x8a6646, deckHi: 0xb08a5e, under: 0x2e221c, rail: 0x7a5a40 };
function paintPier(R, G) {
  // where its steps can't be shown whole, the pier simply runs on out of the frame, onto the sand
  const zN = G.stairs ? PZN : Math.min(PZN, PIER.C / (G.RT + 14 - PIER.xv)), zs = [];
  for (let z = zN; z < PZF; z *= 1.16) zs.push(z);
  const hz = (c, z) => mixc(c, HAZE, clamp((z - 16) / 100, 0, 0.55));
  const vis = (x) => x > G.L - 30 && x < G.RT + 30;
  // the far side's posts, dark between the near ones
  for (const z of zs) {
    const x = Math.round(pX(z) + pW(z)), gy = Math.round(pGY(z)), dy = Math.round(pDY(z)), pw = Math.max(1, Math.round(20 / z));
    if (vis(x)) R.rect(x - pw, dy, pw, gy - dy - 1, hz(PIERC.postD, z * 1.15));
  }
  // the deck: the edge beam and its boards' ends, the underside in shadow beyond, the rail above
  const x0 = Math.floor(pX(PZF)), x1 = Math.ceil(pX(zN));
  for (let x = x0; x <= x1; x++) {
    if (!vis(x)) continue;
    const z = PIER.C / (x - PIER.xv), zr = (PIER.C + PIER.W) / (x - PIER.xv), gy = pGY(z), dy = Math.round(pDY(z));
    const th = Math.max(1, Math.round(0.06 * (gy - HZ))), rh = Math.max(2, Math.round(0.17 * (gy - HZ)));
    for (let y = dy; y <= Math.round(pDY(Math.min(PZF * 1.2, zr))); y++) R.px(x, y, hz(PIERC.under, z));
    for (let y = dy - th; y < dy; y++) R.px(x, y, hz(y === dy - th ? PIERC.deckHi : (x + y) % 9 === 0 ? PIERC.postD : PIERC.deck, z));
    R.px(x, dy - th - rh, hz(PIERC.rail, z));
    if (rh > 6) R.px(x, dy - th - Math.round(rh / 2), hz(PIERC.rail, z));
  }
  // balusters on the rail
  for (let z = zN; z < PZF; z *= 1.055) {
    const x = Math.round(pX(z)), gy = pGY(z), dy = Math.round(pDY(z)), th = Math.max(1, Math.round(0.06 * (gy - HZ))), rh = Math.max(2, Math.round(0.17 * (gy - HZ)));
    if (vis(x)) R.rect(x, dy - th - rh, 1, rh, hz(PIERC.rail, z));
  }
  // the near posts, with cross-braces under the nearer spans and weed where the water laps them
  const pts = zs.map((z) => ({ z, x: Math.round(pX(z)), gy: Math.round(pGY(z)), dy: Math.round(pDY(z)), pw: Math.max(1, Math.round(30 / z)) }));
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1];
    if (a.z > 30 || !vis(a.x)) continue;
    R.line(a.x, a.dy + 2, b.x, b.gy - Math.round((b.gy - b.dy) * 0.35), hz(PIERC.postD, a.z));
    R.line(b.x, b.dy + 2, a.x, a.gy - Math.round((a.gy - a.dy) * 0.35), hz(PIERC.postD, a.z));
  }
  for (const p of pts) {
    if (!vis(p.x)) continue;
    for (let y = p.dy; y < p.gy; y++) for (let k = 0; k < p.pw; k++) {
      const wet = y > p.gy - (p.gy - p.dy) * 0.16;
      R.px(p.x + k, y, hz(wet ? PIERC.wet : k === 0 && p.pw > 1 ? PIERC.postD : (y + k * 3) % 11 === 0 ? PIERC.postD : PIERC.post, p.z));
    }
  }
  // lanterns on posts above the rail, every other post; a little shelter at the far end
  G.lanterns = [];
  pts.forEach((p, k) => {
    if (k % 2 || p.z > 92) return;
    const gy = pGY(p.z), th = Math.max(1, Math.round(0.06 * (gy - HZ))), lh = Math.round(0.4 * (gy - HZ)), top = p.dy - th - lh, s = p.z < 15 ? 3 : p.z < 30 ? 2 : 1;
    if (!vis(p.x)) return;
    R.rect(p.x, top, 1, lh, hz(PIERC.postD, p.z));
    const lx = p.x - (s >> 1);
    R.rect(lx - (s > 1 ? 1 : 0), top - s - 1, s + (s > 1 ? 2 : 0), 1, hz(0x2a2220, p.z));
    R.rect(lx, top - s, s, s, hz(0x5a4434, p.z));
    G.lanterns.push({ x: p.x, y: top - Math.ceil(s / 2), gy, s, z: p.z, i: G.lanterns.length });
  });
  const ex = Math.round(pX(PZF)), ey = Math.round(pDY(PZF));
  R.rect(ex - 1, ey - 5, 5, 4, hz(0x6a5444, 90)); R.rect(ex - 2, ey - 6, 7, 1, hz(0x8a4a3a, 90)); R.px(ex + 1, ey - 7, hz(0x8a4a3a, 90));
}
// the pier's landward end (full screen): steps down to the sand, rocks and tide pools at their foot
function paintStairs(R, G) {
  // rocks first, round the last posts, the pools in their hollows (the water is drawn live)
  const rock = (cx, cy, rx, ry, seed) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1 + (vnoise((cx + x) / 2.5, (cy + y) / 2 + seed) - 0.5) * 0.5 || (y > 0 && d > 0.9)) continue;
      let v = 1.5 + (x / rx) * 0.6 - (y / ry) * 1.1 + (hash(cx + x, cy + y) - 0.5) * 0.7;
      if (d > 0.75 && y > 0) v -= 0.8;
      let c = [0x54463e, 0x766458, 0x98846e, 0xb8a48a][clamp(band(v, cx + x, cy + y), 0, 3)];
      if (y > ry * 0.3 && hash(cx + x, cy + y + 3) < 0.3) c = 0x4a5a32;
      if (hash(cx + x * 3, cy + y) < 0.05 && y < 0) c = 0xd8d0c0;
      R.px(cx + x, cy + y, c);
    }
  };
  const pool = (cx, cy, rx) => { R.ell(cx, cy, rx + 1, 2, 0x4a4440); R.ell(cx, cy, rx, 1, 0x3a3634); G.pools.push({ x: cx, y: cy, rx }); };
  G.pools = [];
  rock(326, 202, 8, 5, 1); rock(344, 197, 6, 4, 2); pool(340, 212, 6); rock(356, 206, 9, 6, 3); rock(330, 214, 5, 3, 4); pool(366, 220, 5); rock(377, 214, 6, 4, 5);
  // the steps: two stringers from the deck's end down to the sand, treads between, a handrail
  const z = PZN, xa = Math.round(pX(z)), xb = Math.round(pX(z) + pW(z)), top = Math.round(pDY(z)) - 1, bot = 216;
  const sx = (y, x) => Math.round(x + ((y - top) / (bot - top)) * 22);
  for (let y = top; y <= bot; y++) {
    const a = sx(y, xa), b = sx(y, xb - 2);
    R.px(a, y, PIERC.post); R.px(a + 1, y, PIERC.postD); R.px(b, y, PIERC.postD);
    if ((y - top) % 5 === 4) for (let x = a + 2; x < b; x++) R.px(x, y, x === a + 2 ? PIERC.deckHi : PIERC.deck);
    if ((y - top) % 5 === 0) for (let x = a + 2; x < b; x++) R.px(x, y, PIERC.under);
  }
  for (let y = top - 12; y <= bot - 10; y++) R.px(sx(y + 10, xa) - 1, y, PIERC.rail);
  for (let y = top; y <= bot; y += 18) R.rect(sx(y, xa) - 1, y - 10, 1, 10, PIERC.postD);
  R.rect(sx(bot, xa) - 2, bot - 12, 2, 13, PIERC.post);
  // a lamp post at the top of the steps
  const lx = xb + 3, ly = top - 30;
  R.rect(lx, ly, 1, 30, PIERC.postD); R.rect(lx - 2, ly - 1, 5, 1, 0x2a2220); R.rect(lx - 1, ly, 3, 3, 0x5a4434);
  G.lanterns.push({ x: lx, y: ly + 1, gy: 214, s: 3, z: 9, i: G.lanterns.length, land: true });
}

/* ——— the big palm and its friends ——— */
const TRUNK = [0x3e2e24, 0x5e4432, 0x80603e, 0xa07c50];
function paintTrunk(R, fx, fy, tx, ty, bend, w0, w1, seed) {
  const mx = (fx + tx) / 2 + bend, my = (fy + ty) / 2, n = Math.ceil(sq(tx - fx, ty - fy) * 1.8);
  let arc = 0, px = fx, py = fy;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (1 - u) ** 2, b = 2 * u * (1 - u), c = u * u;
    const x = a * fx + b * mx + c * tx, y = a * fy + b * my + c * ty;
    arc += sq(x - px, y - py); px = x; py = y;
    const hw = (w0 + (w1 - w0) * u + (u < 0.06 ? (0.06 - u) * 30 : 0)) / 2;
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
      const e = dx / hw;
      if (Math.abs(e) > 1.05) continue;
      const ring = ((arc + Math.abs(e) * 1.6 + seed) / 3.4) % 1;
      let col = e > 0.5 ? TRUNK[3] : e > -0.15 ? TRUNK[2] : e > -0.65 ? TRUNK[1] : TRUNK[0];
      if (ring < 0.28) col = e > 0.5 ? TRUNK[2] : TRUNK[0];
      else if (ring < 0.4 && e > -0.3) col = TRUNK[3];
      R.px(Math.round(x + dx), Math.round(y), col);
    }
  }
}
const FROND = [0x1a2e1e, 0x263e24, 0x34522a, 0x466a30, 0x5e823a];
// fronds: [direction (degrees, 0 right, 90 down), length, droop, leaflet length]
const BIG_FRONDS = [[-176, 68, 1.6, 13], [-152, 60, 1.45, 12], [-126, 46, 1.25, 11], [-100, 30, 1.0, 9], [-74, 36, 1.2, 10], [-46, 56, 1.5, 12], [-16, 70, 1.6, 13], [14, 60, 1.45, 12], [46, 40, 0.9, 10], [96, 26, 0.5, 8], [126, 40, 0.9, 10], [158, 56, 1.2, 11]];
const SMALL_FRONDS = [[-168, 34, 1.4, 8], [-138, 30, 1.1, 7], [-104, 22, 0.7, 6], [-72, 24, 0.9, 7], [-38, 32, 1.2, 8], [-8, 36, 1.4, 8], [30, 26, 1.1, 7], [140, 28, 1.0, 7]];
function paintCrown(S, cx, cy, fronds, sway, k, seed) {
  const order = [...fronds].sort((a, b) => Math.sin((b[0] * Math.PI) / 180) - Math.sin((a[0] * Math.PI) / 180));   // the lower fronds behind
  for (const [deg, len, droop, wd] of order) {
    const a0 = (deg * Math.PI) / 180, n = Math.round(len * k), sgn = Math.cos(a0) >= 0 ? 1 : -1;
    let x = cx, y = cy;
    const spine = [];
    for (let i = 0; i < n; i++) {
      const u = i / n, dir = a0 + sgn * droop * u * u;
      x += Math.cos(dir); y += Math.sin(dir);
      spine.push([x + sway * u * u * 3 * k, y + Math.abs(sway) * u * u * 0.6 * k, dir, u]);
    }
    // the leaflets: a fringe hanging under the rib on either side, longest mid-frond, swept back
    for (const side of [1, -1]) for (let i = 2; i < spine.length; i++) {
      const [sx, sy, dir, u] = spine[i];
      const ll = Math.round(wd * k * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.08)) ** 0.8 * (0.8 + 0.4 * hash(i, seed + side * 7)));
      const px = -Math.sin(dir) * side, py = Math.cos(dir) * side;   // across the rib
      let lx = px * 0.55 - Math.cos(dir) * 0.35, ly = py * 0.55 - Math.sin(dir) * 0.35 + 0.95;
      const nn = sq(lx, ly) || 1; lx /= nn; ly /= nn;
      for (let j = 1; j <= ll; j++) {
        const qx = Math.round(sx + lx * j), qy = Math.round(sy + ly * j + j * j * 0.025);
        S.px(qx, qy, FROND[j > ll - 2 ? (side > 0 ? 3 : 2) : j < ll * 0.4 ? 1 : side > 0 ? 2 : 1]);
      }
    }
    for (const [sx, sy, , u] of spine) { S.px(Math.round(sx), Math.round(sy), FROND[u < 0.55 ? 4 : 3]); if (u < 0.3) S.px(Math.round(sx), Math.round(sy) + 1, FROND[2]); }
  }
  // the crown's heart and its coconuts
  S.ell(cx, cy + 1, 3 * k + 1, 2 * k + 1, FROND[0]);
  if (k > 0.8) for (const [dx, dy] of [[-4, 4], [1, 6], [5, 3]]) { S.ell(cx + dx, cy + dy, 2.5, 2.5, 0x3a2618); S.px(cx + dx - 1, cy + dy - 1, 0x5a3c24); S.px(cx + dx + 1, cy + dy + 1, 0x24180e); }
}
function paintPalmSprite(S, x, y, fronds, sway, k, seed, bx0, by0, bx1, by1) { paintCrown(S, x, y, fronds, sway, k, seed); rimPass(S, bx0, by0, bx1, by1); }

/* ——— full screen, the left: the hammock's palms, the friends' bonfire, the dunes ——— */
const HAMMOCK = { a: [-12, 241, -2, 140, 8], b: [-62, 237, -56, 136, -6] };   // two palms: foot, crown, bow
const HAMY = (u, swing) => Math.round(206 + (204 - 206) * u + 13 * Math.sin(Math.PI * u) + swing * 0.5 * Math.sin(Math.PI * u));
function paintHammock(S, swing) {
  const xa = -10, xb = -59, n = xa - xb;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(xa - i + swing * Math.sin(Math.PI * u)), y = HAMY(u, swing), d = Math.round(1 + 4 * Math.sin(Math.PI * u));
    if (u < 0.12 || u > 0.88) { S.px(x, y, 0xd8c8a8); continue; }   // the cords
    const stripe = Math.floor(i / 3) % 4;
    for (let k = 0; k <= d; k++) S.px(x, y + k, k === d ? 0x8a3a3a : [0xe86a5a, 0xf4e4c4, 0x3a9a9a, 0xf4e4c4][stripe]);
    if (i % 2 === 0) S.px(x, y + d + 1, 0xf4e4c4);
  }
}
const DUNE = [0x8a7058, 0xa48a6c, 0xbca080, 0xd2b692, 0xe6cca6];
function paintDunes(R, G) {
  // the dune's face: a ridge of sand rising from the beach, wind ripples, grass at its foot and crest
  const top = (x) => Math.round(206 - 34 * ease((-124 - x) / 50) + 8 * ease((-176 - x) / 40) + Math.sin(x * 0.09) * 1.5);
  for (let x = G.L; x <= -122; x++) {
    const t = top(x);
    for (let y = t; y < 230; y++) {
      if (y > 210 + Math.sin(x * 0.07) * 3) break;
      const slope = top(x + 1) - top(x - 1), v = 2.6 - slope * 0.7 - (y - t) * 0.07 + (vnoise(x / 6, y / 3) - 0.5) * 0.9 + (Math.sin(x * 0.3 - y * 0.6) > 0.8 ? 0.6 : 0) + (y - t < 2 ? 0.8 : 0);
      R.px(x, y, DUNE[clamp(band(v, x, y), 0, 4)]);
    }
  }
  G.grass = G.grass || [];
  for (let x = G.L + 2; x <= -128; x += 3 + Math.round(hash(x, 11) * 4)) {
    const t = top(x) + 1 + Math.round(hash(x, 12) * 3);
    G.grass.push({ x, y: t, h: 5 + Math.round(hash(x, 13) * 6), n: 2 + Math.round(hash(x, 14) * 2), ph: hash(x, 15) * 6 });
    R.px(x, t, 0x4a5426); R.px(x + 1, t, 0x3e4822);
  }
  // a sand fence, its slats leaning this way and that
  for (let x = -136; x > G.L + 4; x -= 4) {
    const b = 214 + Math.round(Math.sin(x * 0.05) * 2), lean = Math.round((hash(x, 21) - 0.5) * 2), h = 8 + Math.round(hash(x, 22) * 2);
    R.line(x, b, x + lean, b - h, 0x8a7458); R.px(x + lean, b - h, 0xb09a78);
  }
  for (const wy of [-5, -2]) for (let x = -136; x > G.L + 4; x--) R.px(x, 214 + Math.round(Math.sin(x * 0.05) * 2) + wy, 0x5a4a3a);
}
function paintFire(R, G) {
  const fx = -105, fy = 203;
  G.fireAt = { x: fx, y: fy };
  // the stones round it and the logs
  for (let a = 0; a < 10; a++) { const ang = (a / 10) * Math.PI * 2, x = Math.round(fx + Math.cos(ang) * 6), y = Math.round(fy + Math.sin(ang) * 2); R.rect(x, y, 2, 1, a % 3 ? 0x5a5450 : 0x7a726a); }
  R.line(fx - 4, fy, fx + 3, fy - 2, 0x3a2418); R.line(fx - 3, fy - 2, fx + 4, fy, 0x4a2e1e);
  // the friends: one on a log hugging her knees, one with a guitar, one across the fire
  const SIL = 0x2e2430, HAIR = 0x3e2a2a, WOODG = 0x7a4a26;
  const figure = (x0, y0, rows) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== '.') R.px(x0 + i, y0 + j, ch === 'h' ? HAIR : ch === 'g' ? WOODG : ch === 'o' ? 0x2a1810 : SIL); } });
  R.rect(-126, 201, 12, 2, 0x4a3426); R.px(-126, 201, 0x6a4a34); R.px(-115, 201, 0x6a4a34);
  figure(-124, 190, ['..hhh....', '.hhhhh...', '.hh###...', '.h.##....', '..####...', '.#####...', '.######..', '.###.##..', '.###..##.', '.####.##.', '.########']);
  figure(-98, 189, ['....hh...', '...####..', '...####..', '....##...', '...####..', '..######.', '.gg#####.', 'goog####.', 'ggg#####.', '.g.######', '...######', '..####.##']);
  R.line(-99, 193, -104, 189, 0x5a3a20); R.px(-105, 188, 0x2a1810);
  figure(-109, 191, ['.##.', '####', '.##.', '####', '####', '####']);
  G.shadows.push({ x: -118, y: 202, w: 3, len: 30, k: 0.6 }, { x: -91, y: 202, w: 3, len: 30, k: 0.6 });
}

/* ——— full screen, the right: the lifeguard hut, a rowboat ——— */
function paintHut(R, G) {
  const cx = 420, fy = 208, fl = fy - 34;
  const WOOD = 0x8a7056, WOODD = 0x5e4a3a;
  // stilts and their braces, the back ones first
  for (const x of [cx - 10, cx + 9]) R.rect(x, fl, 1, fy - fl, 0x4a3a2e);
  R.line(cx - 14, fl + 2, cx + 13, fy - 3, WOODD); R.line(cx + 13, fl + 2, cx - 14, fy - 3, WOODD);
  for (const x of [cx - 15, cx + 13]) { R.rect(x, fl, 2, fy - fl, WOOD); R.px(x, fl, 0xa88a68); R.rect(x, fy - 4, 2, 4, 0x4a3e30); }
  // the platform and its rail; the ramp coming down toward you
  R.rect(cx - 19, fl - 1, 39, 2, WOOD); R.rect(cx - 19, fl - 1, 39, 1, 0xb0946e); R.rect(cx - 19, fl + 1, 39, 1, WOODD);
  R.rect(cx - 19, fl - 8, 39, 1, 0xd8d0c4);
  for (let x = cx - 19; x <= cx + 19; x += 4) R.rect(x, fl - 8, 1, 7, 0xc8c0b4);
  for (let y = fl + 2; y <= fy + 12; y++) { const u = (y - fl) / (fy + 12 - fl), w = Math.round(4 + u * 4), x0 = Math.round(cx + 2 + u * 6); for (let x = x0; x < x0 + w; x++) R.px(x, y, (y - fl) % 3 === 0 ? WOODD : WOOD); R.px(x0 - 1, y, 0xc8c0b4); }
  // the hut: pale teal boards, white corners, a window (its lamp drawn live), a coral roof
  for (let y = fl - 24; y < fl - 1; y++) for (let x = cx - 12; x <= cx + 12; x++) R.px(x, y, Math.abs(x - cx) >= 11 ? 0xf0ece4 : (x - cx + 20) % 4 === 0 ? 0x8aa8c8 : 0xb4cce0);
  R.rect(cx - 7, fl - 19, 14, 9, 0xe8e2d8); R.rect(cx - 6, fl - 18, 12, 7, 0x2a3040); R.rect(cx - 0, fl - 18, 1, 7, 0xe8e2d8);
  G.hutLamp = { x: cx, y: fl - 15, wx: cx - 6, wy: fl - 18 };
  for (let y = fl - 32; y < fl - 24; y++) { const u = (y - (fl - 32)) / 7, w = Math.round(4 + u * 13); for (let x = cx - w; x <= cx + w; x++) R.px(x, y, y === fl - 25 ? 0x8a3a30 : (x + y) % 5 === 0 ? 0xb84a3e : 0xd05c4a); }
  R.rect(cx + 15, fl - 46, 1, 45, 0xd8d0c4); R.px(cx + 15, fl - 47, 0xf0e0a0);
  G.flagAt = { x: cx + 16, y: fl - 46 };
  // a life ring on the rail
  for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2; R.px(Math.round(cx - 16 + Math.cos(ang) * 3), Math.round(fl - 5 + Math.sin(ang) * 3), (a >> 2) % 2 ? 0xf0ece4 : 0xe8603a); }
  G.shadows.push({ x: cx - 14, y: fy, w: 2, len: 40, k: 0.5 }, { x: cx + 14, y: fy, w: 2, len: 40, k: 0.5 }, { x: cx, y: fy + 10, w: 16, len: 26, k: 0.62 });
}
function paintRowboat(R, G) {
  const x0 = 458, y0 = 216;
  for (let i = 0; i < 40; i++) {
    const u = i / 39, depth = Math.round(5 * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.85))), top = y0 - Math.round(2 * (1 - Math.sin(Math.PI * u)));
    for (let k = 0; k <= depth; k++) R.px(x0 + i, top + k, k === 0 ? 0xd8d0c0 : k === 1 ? 0xc84a3a : k > depth - 2 ? 0x1e3a44 : 0x2a5a6a);
  }
  R.line(x0 + 10, y0 - 3, x0 + 34, y0 + 6, 0x8a6a48); R.line(x0 + 12, y0 - 3, x0 + 36, y0 + 5, 0xb08a5e);   // an oar across it
  R.rect(x0 + 18, y0 + 1, 6, 1, 0x6a5040);
  G.shadows.push({ x: x0 + 20, y: y0 + 5, w: 18, len: 18, k: 0.6 });
}

/* ——— close by: the towel, the book, the hat, the armrest ——— */
const TEAK = [0x3e2216, 0x5a301e, 0x7a4428, 0x9a5a34, 0xb8784a];
function* paintFront(R, G) {
  // the towel: cabana stripes, terry texture, a fringe along the far end
  const yt = (x) => 279 + ((x - 56) * 5) / 116, xl = (y) => 56 - ((y - 279) * 30) / 47, xr = (y) => 172 + ((y - 284) * 14) / 42;
  const STR = [0xe8705e, 0xf4e6c8, 0x3a9a9c, 0xf4e6c8, 0xf2c25a, 0xf4e6c8];
  for (let y = 279; y < H; y++) for (let x = Math.ceil(xl(y)); x <= xr(y); x++) {
    if (y < yt(x)) continue;
    const v = ((y - yt(x)) / (326 - yt(x))) ** 0.85;
    let c = STR[Math.floor(v * 11) % 6];
    if (hash(x, y) < 0.12) c = mixc(c, 0x000000, 0.12); else if (hash(x + 7, y) < 0.08) c = mixc(c, 0xffffff, 0.2);
    const fold = Math.abs(y - yt(x) - 12 - Math.sin(x * 0.06) * 2);
    if (fold < 0.8 && x > 70) c = mixc(c, 0x302030, 0.22);
    R.px(x, y, c);
  }
  for (let x = 58; x < 172; x += 2) R.px(x, Math.round(yt(x)) - 1, 0xf4e6c8);
  yield;
  // the book, face down and tented: the cover a little picture of a lighthouse at sunset
  const bx = BOOK.x, by = BOOK.y;
  R.rect(bx - 14, by + 4, 29, 1, 0x000000, 0.28); R.rect(bx - 12, by + 5, 25, 1, 0x000000, 0.14);
  for (let i = -14; i <= 13; i++) {
    const ridge = by - 5 + Math.round((i + 14) * 0.04);
    R.px(bx + i, ridge - 1, 0x1e4a66);
    R.px(bx + i, ridge, i % 6 === 0 ? 0x8ab8d0 : 0x14304a);
    for (let y = ridge + 1; y <= by + 3; y++) {
      const v = y - ridge;
      let c = v > 6 ? 0x4a8ab0 : v > 5 ? 0x3a7aa0 : 0x2a6a8c;
      if (v > 5 && (i + y) % 4 === 0) c = 0x8ac8e0;
      if (Math.abs(i) >= 13) c = (y + i) % 2 ? 0xf2e8d0 : 0xd8ccb0;   // the pages, at the ends
      R.px(bx + i, y, c);
    }
  }
  R.ell(bx + 6, by - 1, 2, 2, 0xf4c84a); R.px(bx + 6, by - 2, 0xfff0a0);
  R.rect(bx - 5, by - 3, 2, 6, 0xf0ece4); R.rect(bx - 5, by - 1, 2, 1, 0xc84a3a); R.px(bx - 5, by - 4, 0xffe0a0); R.rect(bx - 7, by + 3, 6, 1, 0x1e3a4a);
  // the straw hat: a wide brim, the crown, a coral ribbon
  const hx = HAT.x, hy = HAT.y;
  for (let y = -6; y <= 6; y++) for (let x = -16; x <= 16; x++) {
    const d = (x * x) / 256 + (y * y) / 36;
    if (d > 1) continue;
    let c = (x + y * 3) % 4 === 0 ? 0xc8a050 : hash(hx + x, hy + y) < 0.15 ? 0xf8e0a0 : 0xe8c878;
    if (d > 0.82) c = y > 0 ? 0xb8904a : 0xf4d890;
    R.px(hx + x, hy + y, c);
  }
  for (let y = -8; y <= 0; y++) for (let x = -8; x <= 8; x++) {
    const d = (x * x) / 64 + ((y + 1) * (y + 1)) / 49;
    if (d > 1 || y > 0) continue;
    R.px(hx + x, hy - 2 + y, y >= -1 ? (x > 4 ? 0xa83a32 : 0xd85448) : x > 4 ? 0xc89a50 : (x + y) % 3 === 0 ? 0xd0a85a : 0xecc87c);
  }
  yield;
  // the armrest: a teak plank running forward beside you, seen from above: its top, its inner edge,
  // the rounded front end, and the chair's front leg down to the sand
  const F0 = [ARM.x, ARM.y], dx = 54 / 71.6, dy = 47 / 71.6, nx = -dy, ny = dx;
  const hwA = (a) => 7 + 11 * a, thA = (a) => 3 + 4 * a;
  for (let y = ARM.y + 2; y < H; y++) for (let x = ARM.x - 6; x <= ARM.x + 1; x++) R.px(x, y, x === ARM.x - 6 ? TEAK[2] : x > ARM.x - 1 ? TEAK[0] : (y + x) % 7 === 0 ? TEAK[0] : TEAK[1]);
  for (let y = ARM.y - 10; y < H; y++) for (let x = ARM.x - 16; x < 350; x++) {
    const px = x - F0[0], py = y - F0[1], a = (px * dx + py * dy) / 71.6, b = px * nx + py * ny;
    if (a > 1.4) continue;
    const hw = hwA(Math.max(0, a)), inTop = a >= 0 ? Math.abs(b) <= hw : sq(a * 71.6 * 1.25, b) <= hw;
    if (inTop) {
      const g = Math.sin(b * 1.25 + vnoise(a * 9, b * 0.6) * 2.6);
      let c = g > 0.82 ? TEAK[4] : g < -0.8 ? TEAK[2] : TEAK[3];
      if (b < -hw + 1.2) c = TEAK[4];
      else if (b > hw - 1.2) c = TEAK[2];
      R.px(x, y, c);
    } else if (a >= -0.05 && b > hw && b <= hw + thA(Math.max(0, a)) * 0.76) R.px(x, y, b > hw + thA(Math.max(0, a)) * 0.6 ? TEAK[0] : TEAK[1]);
  }
}
function paintGlass(S, lv) {
  const x = DRINK.x, y = DRINK.y;
  const DR = [0xc8301e, 0xe8502a, 0xf4782c, 0xf8a038, 0xfac458];
  for (let j = 0; j < 18; j++) {
    const yy = y - 1 - j, hw = j < 2 ? 3 : j > 13 ? 5 : 4;
    for (let k = -hw; k <= hw; k++) {
      const fill = j >= 1 && j < 2 + lv * 3.4;
      let c, a = 1;
      if (j === 0) c = 0xc8d8dc;
      else if (fill) c = DR[clamp(Math.floor(((j - 1) / 15) * 5), 0, 4)];
      else { c = 0xd8e8ec; a = 0.3; }
      if (Math.abs(k) === hw) { c = k < 0 ? 0xf0f8fa : 0xa8bcc4; a = 0.85; }
      S.px(x + k, yy, c, a);
    }
  }
  if (lv > 0) { const iy = y - Math.round(lv * 3.4); S.rect(x - 2, iy, 3, 2, 0xf8e8c0); S.px(x - 2, iy, 0xffffff); S.rect(x + 1, iy + 1, 2, 2, 0xf8d8a0); }
  // condensation, a slice of lime, the straw, the paper umbrella
  for (const [dx, dy] of [[3, 4], [-3, 7], [2, 10], [-2, 13]]) S.px(x + dx, y - dy, 0xffffff);
  for (let a = 0; a < 7; a++) { const ang = Math.PI + (a / 6) * Math.PI; S.px(Math.round(x + 5 + Math.cos(ang) * 3), Math.round(y - 18 + Math.sin(ang) * 3), a % 3 ? 0x8ac840 : 0xd8f080); }
  S.px(x + 5, y - 19, 0xe8f8a0);
  for (let j = 0; j < 12; j++) S.px(x - 1 - Math.round(j * 0.35), y - 10 - j, j % 3 ? 0xf4f0ec : 0x3a8ab0);
  S.line(x + 1, y - 12, x - 4, y - 25, 0xc8a878);
  for (let k = -6; k <= 6; k++) { const yy = y - 26 - Math.round(2.4 * (1 - (k / 6) ** 2)) + Math.round(k * 0.3); for (let d = 0; d < 2 + (Math.abs(k) < 4 ? 1 : 0); d++) S.px(x - 4 + k, yy + d, d === 0 ? (Math.abs(k) % 3 === 0 ? 0xf8a8c8 : 0xe8508a) : 0xb83a6a); }
}
function paintShades(S) {
  const x = SHADES.x, y = SHADES.y;
  for (const cx of [x - 5, x + 4]) { S.ell(cx, y, 3, 2, 0x2a1a24); S.px(cx - 1, y - 1, 0x5a4058); S.emit(cx + 1, y - 1, 0xfff0d0); S.px(cx + 3, y, 0x7a3a1a); }
  S.rect(x - 2, y - 2, 3, 1, 0x7a3a1a); S.line(x - 8, y - 1, x - 12, y + 3, 0x8a4a22); S.line(x + 7, y - 1, x + 11, y + 3, 0x8a4a22);
}

/* ——— building a beach for one width: in steps, so it can be spread over a few frames ——— */
const BEACHES = new Map();   // the last two widths (the frame and full screen), so switching back is instant
function sprite(x0, y0, w, h, paint, stand = true) { return { x0: Math.floor(x0), y0: Math.floor(y0), w: Math.ceil(w) + 1, h: Math.ceil(h), paint, ras: null, img: [], stand }; }
function spriteImg(G, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = bakeOne(sp.ras, sp.x0 + G.ox, sp.y0, G.F, k, sp.stand);
  }
  return sp.img[k];
}
const beachW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);
function* buildBeach(rw) {
  const G = layout(rw);
  G.bw = rw; G.shadows = []; G.grass = [];
  shoreFor(G);
  const back = new Ras(rw, H - SAND0, G.ox, -SAND0), over = new Ras(rw, H, G.ox, 0), front = new Ras(rw, H - FRONT0, G.ox, -FRONT0);
  yield* paintSand(back, G);
  yield;
  // the standing things, far to near; the pier first
  paintPier(over, G);
  if (G.stairs) paintStairs(over, G);
  if (G.hut) paintHut(over, G);
  if (G.rowboat) paintRowboat(over, G);
  yield;
  if (G.dunes) paintDunes(over, G);
  if (G.fire) paintFire(over, G);
  if (G.hammock) for (const [fx, fy, tx, ty, bend] of [HAMMOCK.a, HAMMOCK.b]) { paintTrunk(over, fx, fy, tx, ty, bend, 7, 4, fx); G.shadows.push({ x: fx, y: fy, w: 3, len: 50, k: 0.66 }); }
  paintTrunk(over, PALM.fx, PALM.fy, PALM.tx, PALM.ty, PALM.bend, 11, 6, 0);
  G.shadows.push({ x: PALM.fx, y: PALM.fy, w: 5, len: 60, k: 0.5 });
  for (const [dx, dy] of [[-6, 2], [5, 1], [-2, 3]]) { over.ell(PALM.fx + dx, PALM.fy + dy, 2.5, 2, 0x5a3c22); over.px(PALM.fx + dx + 1, PALM.fy + dy - 1, 0x8a6038); }   // fallen coconuts
  // grass at the palms' feet and round the hut
  for (const [gx, gy, n] of [[PALM.fx - 12, PALM.fy + 1, 4], [PALM.fx + 12, PALM.fy + 2, 3], ...(G.hammock ? [[-20, 242, 3], [-70, 238, 3]] : []), ...(G.hut ? [[400, 210, 3], [438, 210, 4]] : []), ...(G.fire ? [[-125, 207, 3], [-92, 206, 3], [-112, 209, 2]] : []), ...(G.stairs ? [[386, 218, 3]] : [])]) {
    for (let k = 0; k < n; k++) G.grass.push({ x: gx + k * 2, y: gy, h: 4 + Math.round(hash(gx, k) * 4), n: 2, ph: hash(k, gx) * 6 });
  }
  yield;
  rimPass(over, G.L, 0, G.RT, H);
  yield;
  yield* paintFront(front, G);
  yield;
  G.F = yield* fieldsFor(G);
  yield;
  G.back = { x0: G.L, y0: SAND0, w: rw, h: H - SAND0, ras: back, img: [], stand: false };
  G.over = { x0: G.L, y0: 0, w: rw, h: H, ras: over, img: [], stand: true };
  G.front = { x0: G.L, y0: FRONT0, w: rw, h: H - FRONT0, ras: front, img: [], stand: false };
  const P = PALM;
  G.crown = [-2, -1, 0, 1, 2].map((sw) => sprite(P.tx - 84, 0, 178, 128, (S) => paintPalmSprite(S, P.tx, P.ty - 2, BIG_FRONDS, sw * 0.7, 1, 3, P.tx - 84, 0, P.tx + 94, 128)));
  if (G.hammock) {
    G.crownH = [HAMMOCK.a, HAMMOCK.b].map(([, , tx, ty], i) => [-1, 0, 1].map((sw) => sprite(tx - 44, ty - 30, 90, 76, (S) => paintPalmSprite(S, tx, ty, i ? SMALL_FRONDS.filter(([d]) => d > -150 && d < 135) : SMALL_FRONDS, sw, 0.95, 11 + i, tx - 44, ty - 30, tx + 46, ty + 46))));
    G.hammockS = [-2, -1, 0, 1, 2].map((sw) => sprite(-64, 200, 58, 24, (S) => paintHammock(S, sw)));
  }
  G.glass = [0, 1, 2, 3, 4].map((lv) => sprite(DRINK.x - 12, DRINK.y - 31, 24, 33, (S) => paintGlass(S, lv), false));
  G.shades = sprite(SHADES.x - 13, SHADES.y - 4, 26, 9, paintShades, false);
  // the waves' band, and the wet sand's memory of them
  G.bandCv = document.createElement('canvas'); G.bandCv.width = rw; G.bandCv.height = BH;
  G.bandCtx = G.bandCv.getContext('2d');
  G.bandImg = G.bandCtx.createImageData(rw, BH); G.band32 = new Uint32Array(G.bandImg.data.buffer);
  G.wet = new Float32Array(rw * BH);
  G.sky = []; G.sea = []; G.ridge = [];
  G.sky[0] = paintSky(G, 0); yield;
  G.sea[0] = paintSea(G, 0); yield;
  for (const k of [0, 1]) { spriteImg(G, G.back, k); spriteImg(G, G.over, k); spriteImg(G, G.front, k); yield; }
  return G;
}
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value; if (performance.now() > end) return null; }
}
function keep(G) { BEACHES.set(G.bw, G); while (BEACHES.size > 2) BEACHES.delete(BEACHES.keys().next().value); return G; }
const beachFor = (rw) => BEACHES.get(rw) || keep(finish(buildBeach(rw)));
const skyFor = (G, st) => G.sky[st] || (G.sky[st] = paintSky(G, st));
const seaFor = (G, st) => G.sea[st] || (G.sea[st] = paintSea(G, st));
const ridgeFor = (G, st) => G.ridge[st] || (G.ridge[st] = ridgeStrip(G, st));

/* ——— the living beach ——— */
const SHELLS = {
  scallop: { px: ['.bcb.', 'bcbcb', 'cbcbc', '.aaa.'], c: [0xb8604a, 0xf0a088, 0xf8c8b0], msg: 'A scallop shell, ridged and rosy', midi: [64, 71] },
  cowrie: { px: ['.bbb.', 'bcacb', '.bbb.'], c: [0x6a4a2a, 0xe8d4b0, 0xb08a5a], msg: 'A cowrie, smooth as glass and freckled', midi: [67, 74] },
  conch: { px: ['..bb..', '.bccb.', 'bcaacb', '.bbbc.'], c: [0xf0905a, 0xf4e0c8, 0xf8b898], msg: 'A little conch: hold it close and hear the sea', midi: [60, 67] },
  moon: { px: ['.bb.', 'bacb', 'bccb', '.bb.'], c: [0x6a7088, 0xb8bccc, 0xe0e2ec], msg: 'A moon snail, its spiral like a tiny galaxy', midi: [62, 69] },
  clam: { px: ['.ccc.', 'cbcbc', 'aaaaa'], c: [0x8a6a9a, 0xc8a8d8, 0xe8d8f0], msg: 'A clam shell, violet inside, like the sky', midi: [65, 72] },
};
const SHELL_KINDS = Object.keys(SHELLS);
const W_BRK = 0.35;
function newWave(s, size, x0) {
  const r = s.r;
  return { born: s.t, size, x0: x0 ?? 20 + r() * 280, peel: 55 + r() * 45, app: 4.6 + r() * 0.8, up: 2.1 + size * 0.5, back: 3 + r() * 0.6, rk: 0.85 + r() * 0.3, peaked: false };
}
const waveDone = (s, w, G) => s.t > w.born + w.app + Math.max(Math.abs(G.L - w.x0), Math.abs(G.RT - w.x0)) / w.peel + W_BRK + w.up + w.back;
// where the water has reached on the sand at one point of the shore, and whether it is going back
function frontAt(s, x, yb, R0) {
  let f = -1, rec = false;
  for (const w of s.waves) {
    const p = s.t - w.born - w.app - Math.abs(x - w.x0) / w.peel - W_BRK;
    if (p < 0) continue;
    const R = R0 * (1 + 0.16 * Math.sin(x * 0.13 + w.x0) + 0.1 * Math.sin(x * 0.31 + w.born));
    let y;
    if (p < w.up) y = yb + R * w.size * w.rk * (1 - (1 - p / w.up) ** 2.4);
    else if (p < w.up + w.back) y = yb + R * w.size * w.rk * (1 - ease((p - w.up) / w.back));
    else continue;
    if (y > f) { f = y; rec = p >= w.up; }
  }
  return f < 0 ? null : { f, rec };
}
const shoreAt = (G, x) => { const X = clamp(Math.round(x) + G.ox, 0, G.bw - 1); return [G.yb[X], G.reach[X]]; };
function makeState(seed, G) {
  const r = rng(seed);
  const s = {
    r, t: 0, day: 0.02, stage: 0, sw: [1, 0, 0, 0, 0, 0], lanOn: false, lanUser: false, lan: 0, lanK: [], hutOn: false, hutUser: false,
    wind: 0, gust: null, nextGust: 5 + r() * 5, kick: 0, cloud: r() * 800, swell: r(),
    waves: [], queue: [], nextWave: 1.2, bubbles: [], prints: [], castles: [], shells: [], pipers: [], crabs: [], gulls: [], sparks: [], flies: [], shoots: [], dolphins: [],
    boat: { x: 262, lamp: false, wait: 0 }, drink: 4, sipT: 0, refill: 0, shades: false, swing: 0, swingV: 0, flagPh: 0, fish: null, beam: 0,
  };
  s.waves.push({ ...newWave(s, 1, 120), born: -7.2 }, { ...newWave(s, 0.9, 230), born: -2.6 });
  s.nextWave = 5;
  // your own footprints, from the towel down to the water
  for (let k = 0; k < 13; k++) {
    const u = k / 12, y = Math.round(286 - u * 72), x = Math.round(140 + u * 34 + (k % 2 ? 3 : -3) * (1 - u * 0.5));
    s.prints.push({ x, y, a: 1, s: y > 256 ? 2 : 1, own: true });
  }
  const spots = [[66, 238, 'scallop'], [196, 244, 'cowrie'], [250, 234, 'moon'], [92, 262, 'conch']];
  for (const [x, y, kind] of spots) s.shells.push({ x, y, kind });
  for (const [hx, hy] of HOLES) s.crabs.push({ hx, hy, x: hx, y: hy, mode: 'in', t: 2 + r() * 6, tx: hx, ty: hy, ph: r() * 6, dir: 1, wave: 0 });
  for (let i = 0; i < 3; i++) s.pipers.push({ x: 190 + i * 14, y: 214, tx: 190 + i * 14, ty: 214, mode: 'stand', t: r() * 2, ph: r() * 6, fly: 0, vx: 0, vy: 0 });
  for (let i = 0; i < 3; i++) s.gulls.push(newGull(r, G, i));
  for (let i = 0; i < 12; i++) s.flies.push({ x: G.L + r() * (G.RT - G.L), y: 150 + r() * 80, ph: r() * 6, sp: 0.5 + r() });
  s.stars = Array.from({ length: Math.round((G.RT - G.L) / 5) }, () => ({ x: G.L + r() * (G.RT - G.L), y: 2 + r() * (HZ - 24), p: r() * 6, sp: 0.6 + r() * 1.6, b: r() }));
  return s;
}
function newGull(r, G, i) {
  const big = i === 0;
  return { x: G.L + r() * (G.RT - G.L), y: 26 + r() * 60, vx: (r() < 0.5 ? -1 : 1) * (6 + r() * 5), ph: r() * 6, flap: 0, big, bob: r() * 6, call: 0 };
}
const stepOf = (day) => Math.min(NST - 1, Math.floor(day * NST));
const sunY = (day) => 56 + day * 100;
function gust(s, peak, dur) { s.gust = { t: 0, peak: Math.max(peak, s.gust ? s.gust.peak * 0.6 : 0), dur }; }

function update(s, G, dt, hooks) {
  const r = s.r;
  s.t += dt;
  const t = s.t;
  // the evening goes by: ten minutes from golden hour to dusk, and then the dusk stays
  if (s.day < 1) s.day = Math.min(1, s.day + dt / DAYLEN);
  const st = stepOf(s.day);
  if (st !== s.stage) { s.stage = st; hooks.stage?.(st); }
  for (let k = 0; k < NST; k++) { s.sw[k] += ((k === st ? 1 : 0) - s.sw[k]) * Math.min(1, dt / 2.6); if (Math.abs(s.sw[k] - (k === st ? 1 : 0)) < 0.004) s.sw[k] = k === st ? 1 : 0; }
  // the lanterns come on by themselves as the sun reaches the sea, one after another along the pier
  if (!s.lanUser && !s.lanOn && s.day > 0.58) { s.lanOn = true; hooks.lanterns?.(true, false); }
  if (!s.hutUser) s.hutOn = s.lanOn;
  s.lan += ((s.lanOn ? 1 : 0) - s.lan) * Math.min(1, dt * 1.6);
  if (Math.abs(s.lan - (s.lanOn ? 1 : 0)) < 0.004) s.lan = s.lanOn ? 1 : 0;
  const nl = G.lanterns.length;
  for (let i = 0; i < nl; i++) {
    const want = s.lanOn ? 1 : 0, lagged = s.lanOn ? clamp((s.lanT ?? 9) - i * 0.32, 0, 1) : 0;
    s.lanK[i] = s.lanK[i] ?? 0;
    s.lanK[i] += ((s.lanOn ? lagged : 0) - s.lanK[i]) * Math.min(1, dt * (want ? 5 : 3));
  }
  s.lanT = s.lanOn ? (s.lanT ?? 0) + dt : 0;
  if (s.day > 0.64 && !s.boat.lampSet) { s.boat.lamp = true; s.boat.lampSet = true; }

  // the wind: a faint stir always, and every eight to sixteen seconds a breeze off the sea
  s.nextGust -= dt;
  if (s.nextGust <= 0) { gust(s, 0.4 + r() * 0.5, 2 + r() * 3); s.nextGust = 8 + r() * 8; }
  let w = 0.08 + 0.04 * Math.sin(t * 0.33) + 0.03 * Math.sin(t * 1.21);
  if (s.gust) {
    const g = s.gust; g.t += dt;
    w += g.peak * (g.t < 1 ? ease(g.t) : g.t < g.dur ? 1 : 1 - ease((g.t - g.dur) / 2)) * (0.85 + 0.15 * Math.sin(t * 4.7));
    if (g.t > g.dur + 2) s.gust = null;
  }
  s.wind = w;
  s.kick = Math.max(0, s.kick - dt);
  s.cloud += dt * (1 + w * 2);
  s.swell += dt * 0.05;
  // the hammock rocks on its own a little, more in a breeze
  s.swingV += (-s.swing * 1.6 - s.swingV * 0.35 + w * Math.sin(t * 1.3) * 1.6) * dt;
  s.swing += s.swingV * dt;
  s.flagPh += dt * (3 + w * 10);
  s.beam += dt;

  // the waves: one every seven to ten seconds, now and then a set of two or three
  if (s.queue.length && t >= s.queue[0].at) { const q = s.queue.shift(); s.waves.push(newWave(s, q.size, q.x0)); }
  s.nextWave -= dt;
  if (s.nextWave <= 0) {
    s.nextWave = 7 + r() * 3.5;
    s.waves.push(newWave(s, 0.75 + r() * 0.4));
    if (r() < 0.18) { s.queue.push({ at: t + 3.3, size: 0.95 + r() * 0.25 }); s.nextWave += 3.5; }
  }
  s.waves = s.waves.filter((wv) => !waveDone(s, wv, G));
  // a wave at its height may leave a shell behind on the sand
  for (const wv of s.waves) {
    if (wv.peaked) continue;
    const p = t - wv.born - wv.app - W_BRK;
    if (p > wv.up) {
      wv.peaked = true;
      if (s.shells.length < 6 && r() < 0.16 * wv.size) {
        const x = clamp(wv.x0 + (r() - 0.5) * 60, 20, 300), [yb, R] = shoreAt(G, x);
        s.shells.push({ x, y: Math.round(yb + R * wv.size * wv.rk * 0.9), kind: SHELL_KINDS[Math.floor(r() * SHELL_KINDS.length)], fresh: 1 });
      }
    }
  }
  // the wet sand dries: the sheen fades from where the water has been
  const wet = G.wet, dk = Math.exp(-dt / 3.2);
  for (let i = 0; i < wet.length; i++) if (wet[i] > 0) wet[i] = wet[i] < 0.02 ? 0 : wet[i] * dk;
  // bubbles left by the water going back, popping one by one
  for (let k = 0; k < 6; k++) {
    const x = G.L + r() * (G.RT - G.L), [yb, R] = shoreAt(G, x), fr = frontAt(s, x, yb, R);
    if (fr && fr.rec && fr.f > yb + 2 && s.bubbles.length < 110) s.bubbles.push({ x: Math.round(x), y: Math.round(fr.f + r() * 2), t: 0, life: 0.6 + r() * 1.8 });
  }
  for (const b of s.bubbles) b.t += dt;
  s.bubbles = s.bubbles.filter((b) => b.t < b.life);
  // the water smooths away the footprints it reaches, and softens the sandcastles
  for (const p of s.prints) {
    const [yb, R] = shoreAt(G, p.x), fr = frontAt(s, p.x, yb, R);
    if (fr && fr.f >= p.y) p.wash = true;
    p.a = Math.max(0, p.a - dt * (p.wash ? 1.4 : p.own ? 0 : 0.03));
  }
  s.prints = s.prints.filter((p) => p.a > 0.02);
  for (const c of s.castles) {
    const [yb, R] = shoreAt(G, c.x), fr = frontAt(s, c.x, yb, R), hit = fr && fr.f >= c.y - 1;
    if (hit && !c.wet) { c.wet = true; c.lv = Math.max(0, c.lv - 0.75); c.soft = Math.min(1.2, c.soft + 0.45); hooks.castle?.(c); }
    else if (!hit && fr === null) c.wet = false;
    c.damp = Math.max(0, (c.damp || 0) - dt * 0.05); if (hit) c.damp = 1;
  }
  s.castles = s.castles.filter((c) => c.lv > 0.05 || c.soft < 1.15);
  for (const sh of s.shells) sh.fresh = Math.max(0, (sh.fresh || 0) - dt * 0.4);

  // sandpipers: they run down after the water going back, and up again ahead of it
  for (const p of s.pipers) {
    p.ph += dt;
    if (p.fly > 0) {
      p.fly -= dt; p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.fly * 3) * 4 * dt;
      if (p.fly <= 0) { p.mode = 'stand'; p.tx = p.x; p.ty = p.y; }
      continue;
    }
    const [yb, R] = shoreAt(G, p.x), fr = frontAt(s, p.x, yb, R);
    if (fr && fr.f > p.y - 3) { p.ty = fr.f + 5; p.mode = 'run'; }
    else if ((!fr || fr.f < p.y - 10) && p.y > yb + 6 && p.t <= 0) { p.ty = Math.max(yb + 3, (fr ? fr.f : yb) + 3); p.tx = clamp(p.x + (r() - 0.5) * 30, G.L + 10, G.RT - 10); p.mode = 'run'; p.t = 1 + r() * 2.5; }
    p.t -= dt;
    const dx = p.tx - p.x, dy = p.ty - p.y, d = sq(dx, dy);
    if (d > 0.6) { const sp = 30 * dt; p.x += (dx / d) * Math.min(d, sp); p.y += (dy / d) * Math.min(d, sp); p.mode = 'run'; if (hash(Math.floor(p.ph * 8), p.x | 0) < 0.25 && p.y > yb + 1) s.prints.push({ x: Math.round(p.x), y: Math.round(p.y) + 1, a: 0.7, s: 0, own: false }); }
    else p.mode = 'stand';
  }
  if (s.prints.length > 160) s.prints.splice(13, s.prints.length - 160);
  // crabs: out of their holes now and then, scuttling sideways in little dashes
  for (const c of s.crabs) {
    c.t -= dt; c.ph += dt;
    if (c.mode === 'in') { if (c.t <= 0) { c.mode = 'out'; c.t = 0.6; } continue; }
    if (c.mode === 'out') { if (c.t <= 0) { c.mode = 'pause'; c.t = 0.6 + r(); c.trip = 7 + r() * 9; } continue; }
    if (c.mode === 'dig') { if (c.t <= 0) { c.mode = 'in'; c.t = 6 + r() * 10; c.x = c.hx; c.y = c.hy; } continue; }
    c.trip -= dt;
    const home = c.mode === 'home' || c.trip <= 0;
    if (home) { c.tx = c.hx; c.ty = c.hy; }
    const [yb, R] = shoreAt(G, c.x), fr = frontAt(s, c.x, yb, R);
    if (fr && fr.f > c.y - 6 && c.mode !== 'home') { c.ty = fr.f + 10; c.mode = 'walk'; }
    const dx = c.tx - c.x, dy = c.ty - c.y, d = sq(dx, dy);
    if (c.mode === 'pause') {
      if (c.t <= 0 || home) { c.mode = home ? 'home' : 'walk'; if (!home) { c.tx = clamp(c.hx + (r() - 0.5) * 70, G.L + 8, G.RT - 8); c.ty = clamp(c.hy + (r() - 0.5) * 14, 222, 276); } }
    } else {
      const sp = (c.mode === 'home' ? 34 : 15) * dt;
      if (d < 1) {
        if (c.mode === 'home' || home) { c.mode = 'dig'; c.t = 0.5; }
        else { c.mode = 'pause'; c.t = 0.5 + r() * 2; }
      } else { c.x += (dx / d) * Math.min(d, sp); c.y += (dy / d) * Math.min(d, sp) * 0.6; c.dir = dx > 0 ? 1 : -1; }
    }
  }
  // gulls gliding, a few wingbeats now and then
  for (const g of s.gulls) {
    g.x += g.vx * dt; g.bob += dt; g.y += Math.sin(g.bob * 0.6) * 3 * dt;
    g.flap = Math.max(0, g.flap - dt); if (r() < dt * 0.12) g.flap = 1 + r();
    g.call = Math.max(0, g.call - dt);
    if (g.x < G.L - 30 || g.x > G.RT + 30) { Object.assign(g, newGull(r, G, g.big ? 0 : 1)); g.x = g.vx > 0 ? G.L - 20 : G.RT + 20; }
  }
  // the sailboat, slipping along the horizon
  const b = s.boat;
  if (b.wait > 0) b.wait -= dt;
  else { b.x -= dt * 0.45; if (b.x < G.L - 24) { b.wait = 40; b.x = G.RT + 20; } }
  // dolphins, sparks off the fire, shooting stars, fireflies at dusk
  for (const d of s.dolphins) d.t += dt;
  s.dolphins = s.dolphins.filter((d) => d.t < 2.6);
  if (G.fireAt && r() < dt * (2 + (s.sparkBoost || 0) * 20)) s.sparks.push({ x: G.fireAt.x + (r() - 0.5) * 4, y: G.fireAt.y - 4, vx: (r() - 0.5) * 6, vy: -10 - r() * 14, t: 0, life: 0.8 + r() * 1.4 });
  s.sparkBoost = Math.max(0, (s.sparkBoost || 0) - dt);
  for (const p of s.sparks) { p.t += dt; p.x += (p.vx + w * 12) * dt; p.y += p.vy * dt; p.vy += 4 * dt; }
  s.sparks = s.sparks.filter((p) => p.t < p.life);
  for (const p of s.shoots) p.t += dt;
  s.shoots = s.shoots.filter((p) => p.t < 1.1);
  if (s.day > 0.86 && r() < dt / 45) s.shoots.push({ x: G.L + r() * (G.RT - G.L), y: 8 + r() * 40, vx: -60 - r() * 40, vy: 22 + r() * 10, t: 0 });
  for (const f of s.flies) { f.ph += dt * f.sp; f.x += Math.sin(f.ph * 0.7) * 6 * dt + w * 4 * dt; f.y += Math.cos(f.ph * 0.9) * 4 * dt; if (f.x > G.RT) f.x = G.L; }
  if (s.fish) { s.fish.t += dt; if (s.fish.t > 1.4) s.fish = null; }
  // the drink: another one, a little while after the last sip
  s.sipT = Math.max(0, s.sipT - dt);
  if (s.refill > 0 && (s.refill -= dt) <= 0) { s.drink = 4; hooks.refill?.(); }
}

/* ——— drawing a frame ——— */
function stepOrder(s) {
  const w = [];
  for (let k = 0; k < NST; k++) if (s.sw[k] > 0.004) w.push([k, s.sw[k]]);
  w.sort((a, b) => b[1] - a[1]);
  let acc = 0;
  return w.map(([k, v]) => { acc += v; return [k, v / acc]; });
}
function order(s) {
  const w = [];
  for (let st = 0; st < NST; st++) for (let l = 0; l < 2; l++) { const v = s.sw[st] * (l ? s.lan : 1 - s.lan); if (v > 0.004) w.push([st * 2 + l, v]); }
  w.sort((a, b) => b[1] - a[1]);
  let acc = 0;
  return w.map(([k, v]) => { acc += v; return [k, v / acc]; });
}
function drawLit(g, G, sp, ord) {
  const x = G.ox + sp.x0, y = sp.y0;
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(spriteImg(G, sp, k), x, y); }
  g.globalAlpha = 1;
}
function mixSteps(list, sw) {
  let r = 0, gg = 0, b = 0, tot = 0;
  for (let k = 0; k < NST; k++) { const w = sw[k]; if (w <= 0) continue; const c = list[k]; r += ((c >> 16) & 255) * w; gg += ((c >> 8) & 255) * w; b += (c & 255) * w; tot += w; }
  return (Math.round(r / tot) << 16) | (Math.round(gg / tot) << 8) | Math.round(b / tot);
}
// colours for the moving things on the beach, lit for one key and kept
function palette(G, key) {
  G.pal = G.pal || [];
  if (G.pal[key]) return G.pal[key];
  const L = (c, x, y, stand) => hex(litOf(G, x, y, c, key, stand));
  const P = {
    crab: [0x8a2a1a, 0xd04a2a, 0xf88a52, 0x1a1210].map((c) => L(c, 160, 252)),
    castle: [0x9a7650, 0xc49c6e, 0xe0be8a, 0xf2d6a4].map((c) => L(c, 160, 236)),
    castleWet: [0x8a6a48, 0xa8865e, 0xbc9a70, 0xc8a87c].map((c) => L(c, 160, 236)),
    dent: L(0xb8986c, 160, 262), dentHi: L(0xfae6bc, 160, 262), dentWet: L(0x8e7050, 160, 220),
    piper: [0x4a3a2c, 0x8a7660, 0xf2eadc, 0x2a2420].map((c) => L(c, 210, 216, true)),
    grass: [0x4a5a26, 0x6a7a30, 0x9a9a44].map((c) => L(c, 160, 250, true)),
    flag: [0xe84a3a, 0xf6c040].map((c) => L(c, 436, 128, true)),
    shells: Object.fromEntries(SHELL_KINDS.map((k) => [k, SHELLS[k].c.map((c) => L(c, 160, 244))])),
    pool: hex(mixc(mixSteps(SKY.map((p) => p[6]), [0, 1, 2, 3, 4, 5].map((k) => +(k === key >> 1))), 0x2a3050, 0.35)), poolHi: hex(mixc(mixSteps(SKY.map((p) => p[5]), [0, 1, 2, 3, 4, 5].map((k) => +(k === key >> 1))), 0x2a3050, 0.2)),
  };
  G.pal[key] = P;
  return P;
}
let FX = null;
function fx() {
  if (FX) return FX;
  FX = {
    haze: glow(120, 50, 0xffc070, 0.75, 6), core: glow(30, 26, 0xfff0c8, 0.95, 5), after: glow(150, 30, 0xff8a7a, 0.6, 5),
    lan: [glow(4, 4, 0xffc060, 1, 3), glow(8, 7, 0xffb050, 0.95, 4), glow(15, 13, 0xffa848, 0.9, 5)],
    fire: glow(34, 18, 0xff9a40, 0.9, 5), fireSm: glow(8, 7, 0xffd080, 1, 4), hut: glow(15, 11, 0xff9a50, 0.75, 4),
    moon: glow(14, 14, 0xc8c8f4, 0.5, 4), fly: glow(2, 2, 0xe8ff90, 1, 2), light: glow(10, 8, 0xfff0c0, 0.9, 4),
  };
  // the thin moon: a crescent, lit on its sunward side
  const M = new Ras(9, 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (sq(x - 4, y - 4) <= 4.2 && sq(x - 5.8, y - 3.2) > 3.8) M.px(x, y, sq(x - 4, y - 4) > 3.4 ? 0xe8e0cc : 0xfff8e4);
  FX.moonImg = M.canvas();
  return FX;
}
const fill = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function disc(g, cx, cy, rx, ry, c, maxY = 1e9) {
  g.fillStyle = c;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const u = dy / (ry + 0.35);
    if (Math.abs(u) > 1 || cy + dy > maxY) continue;
    const half = Math.floor(rx * Math.sqrt(1 - u * u) + 0.35);
    g.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}
const GULL = {
  glide: ['.xx...xx.', 'x..xxx..x'],
  up: ['x.......x', '.xx...xx.', '...xxx...'],
  down: ['...xxx...', '.xx...xx.', 'x.......x'],
  bglide: ['..xx.....xx..', '.x..x...x..x.', 'x....xxx....x'],
  bup: ['x...........x', '.x.........x.', '..xx.....xx..', '....xxxxx....'],
  bdown: ['....xxxxx....', '..xx.....xx..', '.x.........x.', 'x...........x'],
};
function drawGull(g, gl, t, C) {
  const fr = gl.flap > 0 ? ['up', 'glide', 'down', 'glide'][Math.floor(t * 9 + gl.ph) % 4] : 'glide', key = (gl.big ? 'b' : '') + fr, rows = GULL[key];
  const w = rows[0].length, x0 = Math.round(gl.x) - (w >> 1), y0 = Math.round(gl.y) - (rows.length >> 1);
  rows.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === 'x') fill(g, j === rows.length - 1 && fr === 'glide' && i > 2 && i < w - 3 ? C[1] : C[0], x0 + i, y0 + j); });
}

// the waves, drawn pixel by pixel into their own band and laid over the sand in one go
function drawBand(g, G, s, BP) {
  const { rw, ox } = G, u32 = G.band32, wet = G.wet, t = s.t, fr = Math.floor(t * 10);
  u32.fill(0);
  const put = (X, y, c) => { if (y >= BY0 && y < BY1) u32[(y - BY0) * rw + X] = c; };
  const washF = (w, x, yb, Rch, p) => {   // where one wave's wash has reached, and whether it is going back
    const R = Rch * w.size * w.rk * (1 + 0.16 * Math.sin(x * 0.13 + w.x0) + 0.1 * Math.sin(x * 0.31 + w.born));
    return p < w.up ? yb + R * (1 - (1 - p / w.up) ** 2.4) : yb + R * (1 - ease((p - w.up) / w.back));
  };
  for (let X = 0; X < rw; X++) {
    const x = X - ox, yb = G.yb[X], pk = G.persp[X], Rch = G.reach[X];
    // first, how far up the sand the water reaches here, all the waves together
    let fMax = -1;
    for (const w of s.waves) {
      const p = t - w.born - w.app - Math.abs(x - w.x0) / w.peel - W_BRK;
      if (p < 0 || p >= w.up + w.back) continue;
      fMax = Math.max(fMax, washF(w, x, yb, Rch, p));
    }
    // one sheet of water over the sand: the shallows' own colour by the sea, thinning to the edge
    const fy = Math.round(fMax);
    if (fy > yb) {
      const step = 2.5 + 3 * pk;   // graded by the distance back from its edge, so neighbours agree
      for (let y = yb; y <= fy; y++) {
        const ci = Math.min(2, band((fy - y) / step + 0.2 + (y - yb < 2 ? 1 : 0), X, y));
        put(X, y, ci === 2 ? BP.deep : ci === 1 ? BP.sheet : BP.thin);
        if (y >= BY0 && y < BY1) wet[(y - BY0) * rw + X] = 1;
      }
    }
    for (const w of s.waves) {
      const dB = Math.abs(x - w.x0) / w.peel, tau = t - w.born - w.app - dB;
      if (tau < 0) {
        // the swell runs in almost square to the shore, then stands at the water's edge as a steep
        // wall, the low sun shining through it, until the break peels along to it
        const u = Math.min(1, (t - w.born - dB * 0.3) / w.app);
        if (u < 0.06) continue;
        const wait = clamp(-tau / 1.2, 0, 1), y0 = G.sw0[X], wob = Math.round((Math.sin(x * 0.045 + w.x0 * 0.1) * 1.2 + (vnoise(x / 18, w.born) - 0.5) * 2.4) * u);
        const hgt = Math.max(1, Math.round((0.4 + 3.2 * u * u) * w.size * pk * (0.7 + 0.6 * vnoise(x / 14, w.born + 3))));
        const yt = Math.round(y0 + (yb - y0) * u ** 1.6) + (u >= 1 ? -Math.round(wait * 1.5 * pk) : wob), cy = yt - hgt;
        if (u < 0.35) { put(X, cy, BP.crest); if (bay(X, cy + 1) < 0.5) put(X, cy + 1, BP.face); continue; }   // far out: only a glint of crest
        const lit = u > 0.55 && vnoise(x / 6, w.born + 7) > 0.35;
        for (let k = 1; k <= hgt; k++) put(X, cy + k, k === hgt && hgt > 2 ? BP.trough : lit && k === 1 ? BP.glow : BP.face);
        put(X, cy, tau > -0.5 ? (hash(X, fr) < 0.75 ? BP.foam : BP.lip) : u > 0.4 ? BP.lip : BP.crest);
        if (tau > -0.3 && hash(X >> 1, fr) < 0.5) put(X, cy - 1, BP.foamS);
        continue;
      }
      // breaking: a tumble of foam along the line, a little spray thrown up
      if (tau < 0.75) {
        const age = tau / 0.75, lift = Math.round((1 - age) * 2.2 * w.size * pk + hash(X >> 1, w.x0 | 0) * 1.4), deep = Math.round(1 + age * 2.6 * w.size * pk), top = yb - 1 - lift;
        for (let y = top; y <= yb + deep; y++) {
          const h = hash(X, y + fr), e = Math.min(y - top, yb + deep - y);
          if (e === 0 && h > 0.55) continue;   // a ragged, churning edge
          put(X, y, h < 0.26 + age * 0.34 ? BP.foamS : BP.foam);
        }
        if (tau < 0.45) for (let k = 0; k < 3; k++) if (hash(X * 3 + k, fr) < 0.28 * w.size) put(X, yb - 2 - lift - Math.round(hash(X, k + fr) * 4 * w.size * pk), BP.foam);
      }
      const p = tau - W_BRK;
      if (p < 0 || p >= w.up + w.back) continue;
      // its foam: lace drifting in the sheet, a bright scalloped edge running up, a fading line going back
      const back = p >= w.up, q = back ? (p - w.up) / w.back : p / w.up, f = washF(w, x, yb, Rch, p), wy = Math.round(f);
      if (wy <= yb) continue;
      const lace = back ? 0.16 * (1 - q) : 0.5 * (1 - q) + 0.12, sp = wy - yb;
      for (let y = yb; y <= wy; y++) {
        const rel = (wy - y) / sp, n = vnoise(X / 2.3 + w.x0, (y - f * 0.85) / 1.4 + w.born);
        if (n < lace * (rel < 0.4 ? 1.1 : 0.7)) put(X, y, n < lace * 0.45 ? BP.foamS : BP.foam);
        if (!back && y >= wy - 1) put(X, y, hash(X, y + fr) < 0.9 ? BP.foam : BP.foamS);
        else if (!back && y === wy - 2 && hash(X, fr) < 0.5) put(X, y, BP.foamS);
        else if (back && y === wy && hash(X, y) < 0.55 * (1 - q)) put(X, y, BP.foam);
      }
    }
  }
  // the wet sand left behind: glossy with the sky, and the sun's own path across it
  for (let y = BY0; y < BY1; y++) {
    const row = (y - BY0) * rw, pw = 6 + (y - HZ) * 0.55;
    for (let X = 0; X < rw; X++) {
      const i = row + X, v = wet[i];
      if (v < 0.04 || u32[i]) continue;
      const lv = band(v * 3.2, X, y);
      if (lv <= 0) continue;
      u32[i] = Math.abs(X - ox - SUNX) < pw * (0.6 + 0.4 * hash(X >> 1, y)) ? BP.sunSheen[Math.min(2, lv - 1)] : BP.sheen[Math.min(2, lv - 1)];
    }
  }
  for (const b of s.bubbles) {
    const X = b.x + ox;
    if (X < 0 || X >= rw || b.y < BY0 || b.y >= BY1) continue;
    const u = b.t / b.life;
    u32[(b.y - BY0) * rw + X] = u > 0.85 ? BP.foam : BP.bubble;
  }
  G.bandCtx.putImageData(G.bandImg, 0, 0);
  g.drawImage(G.bandCv, 0, BY0);
}
function bandPalette(s) {
  const sw = s.sw, m = (i) => mixSteps(SURF.map((p) => p[i]), sw), sea = (i) => mixSteps(SEA.map((p) => p[i]), sw), path = (i) => mixSteps(PATH.map((p) => p[i]), sw), sky = (i) => mixSteps(SKY.map((p) => p[i]), sw);
  const foam = m(0), foamS = m(1), sheet = m(2), deep = m(3), glowC = m(4), sheen = m(5);
  const sunK = clamp((HZ + 14 - sunY(s.day)) / 24, 0, 1);
  return {
    face: pack(mixc(sea(3), 0x100c28, 0.2)), trough: pack(mixc(sea(2), 0x0a0a20, 0.3)), crest: pack(mixc(sea(6), sky(7), 0.5)), lip: pack(mixc(sea(6), foam, 0.6)), glow: pack(mixc(glowC, path(1), 0.25 * sunK)),
    foam: pack(foam), foamS: pack(foamS), deep: pack(mixc(mixc(sea(6), 0xc8c090, 0.25), sea(5), 0.3), 0.94), sheet: pack(mixc(mixc(sea(6), 0xc8c090, 0.25), sky(7), 0.18), 0.72), thin: pack(mixc(sheet, sky(7), 0.3), 0.42),
    sheen: [pack(sheen, 0.16), pack(sheen, 0.3), pack(mixc(sheen, sky(7), 0.3), 0.46)],
    sunSheen: [pack(path(2), 0.18 + 0.1 * sunK), pack(path(1), 0.3 + 0.2 * sunK), pack(path(0), 0.45 + 0.3 * sunK)],
    bubble: pack(foam, 0.75),
  };
}

function render(g, G, s) {
  const ox = G.ox, t = s.t, F = fx(), ord = order(s), key = ord[0][0], st0 = key >> 1, P = palette(G, key), sk = stepOrder(s), sw = s.sw;
  const sy = sunY(s.day), sunVis = clamp((HZ + 8 - sy) / 22, 0, 1), dusk = clamp((s.day - 0.66) / 0.24, 0, 1);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, G.bw, H);
  // the sky, the stars coming out, the thin moon
  for (const [st, a] of sk) { g.globalAlpha = a; g.drawImage(skyFor(G, st), 0, 0); }
  g.globalAlpha = 1;
  if (dusk > 0.02) {
    for (const st of s.stars) {
      const b = Math.sin(t * st.sp + st.p), a = dusk * (st.b < 0.3 ? 1 : 0.7) * clamp((HZ - 14 - st.y) / 30, 0.2, 1);
      if (b < -0.2 || a < 0.1 || st.y > HZ - 4) continue;
      g.globalAlpha = Math.round(a * (b > 0.7 ? 1 : 0.6) * 4) / 4; fill(g, b > 0.7 && st.b < 0.25 ? '#fff6e0' : '#c8c4ec', ox + Math.round(st.x), Math.round(st.y));
    }
    g.globalAlpha = 1;
  }
  const moonA = clamp((s.day - 0.6) / 0.16, 0, 1);
  if (moonA > 0.02) {
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = moonA * 0.4; g.drawImage(F.moon, ox + MOON.x - 14, MOON.y - 14); g.globalCompositeOperation = 'source-over';
    g.globalAlpha = moonA; g.drawImage(F.moonImg, ox + MOON.x - 4, MOON.y - 4); g.globalAlpha = 1;
  }
  for (const p of s.shoots) {
    const u = p.t / 1.1;
    for (let k = 0; k < 7; k++) { g.globalAlpha = (1 - u) * (1 - k / 7); fill(g, '#fff4e0', ox + Math.round(p.x + p.vx * p.t + k * 2.2), Math.round(p.y + p.vy * p.t - k * 0.8)); }
    g.globalAlpha = 1;
  }
  // the sun: its haze, the disc flattening a little and banded with haze as it nears the sea
  const sunUp = sy - 12 < HZ;
  if (sunUp) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.32 * Math.max(0.2, sunVis); g.drawImage(F.haze, ox + SUNX - 120, Math.round(sy) - 50);
    g.globalAlpha = 0.12 * sunVis; g.drawImage(F.core, ox + SUNX - 30, Math.round(sy) - 26);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    drawSun(g, ox, sy, sw);
  }
  if (s.day > 0.6) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * clamp((s.day - 0.6) / 0.1, 0, 1) * (1 - dusk * 0.7); g.drawImage(F.after, ox + SUNX - 150, HZ - 26); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  // the clouds, drifting
  for (const [st, a] of sk) {
    const [hi, lo] = cloudsFor(st);
    g.globalAlpha = a;
    for (let x = -Math.round((s.cloud * 0.5) % CW); x < G.bw; x += CW) g.drawImage(hi, x, 4);
    for (let x = -Math.round((s.cloud + 300) % CW); x < G.bw; x += CW) g.drawImage(lo, x, 44);
  }
  g.globalAlpha = 1;
  // the clouds nearest the sun take its glow, and it shows through them where they are thin
  if (sunUp) {
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.14 * sunVis; g.drawImage(F.haze, ox + SUNX - 120, Math.round(sy) - 50); g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.45; drawSun(g, ox, sy, sw); g.globalAlpha = 1;
  }
  // the sea and the far land
  for (const [st, a] of sk) { g.globalAlpha = a; g.drawImage(seaFor(G, st), 0, FAR0); }
  g.globalAlpha = 1;
  if (G.lightAt && dusk > 0) {   // the lighthouse's lamp, turning
    const ph = (s.beam * 0.5) % 1, on = ph < 0.18;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = dusk * (on ? 0.9 : 0.25); g.drawImage(F.light, ox + G.lightAt.x - 10, G.lightAt.y - 8); g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1; fill(g, on ? '#fff6d0' : '#e8c890', ox + G.lightAt.x, G.lightAt.y);
  }
  // swell running in over the open water
  const rg = ridgeFor(G, st0);
  for (let k = 0; k < 7; k++) {
    const ph = (s.swell + k / 7) % 1, y = Math.round(HZ + 3 + (G.sw0[clamp(ox + 160, 0, G.bw - 1)] - HZ - 4) * ph ** 1.7);
    g.globalAlpha = Math.min(1, ph * 3) * 0.8; g.drawImage(rg, Math.round(Math.sin(k * 2.1) * 8) - 8, y);
  }
  g.globalAlpha = 1;
  // the glitter on the path of light, and once the sun has gone, the moon's faint path
  const pkk = PATHK.reduce((a, v, k) => a + v * sw[k], 0) * Math.max(0.2, sunVis * 1.1);
  const pc = [0, 1, 2].map((i) => hex(mixSteps(PATH.map((p) => p[i]), sw)));
  for (let i = 0; i < 90 * pkk; i++) {
    const tk = Math.floor(t * 2.4 + i * 0.37), h1 = hash(i, tk), y = HZ + 2 + Math.floor(h1 ** 1.5 * 76), pw = 3 + (y - HZ) * 0.55, x = SUNX + (hash(i + 50, tk) - 0.5) * 2 * pw;
    fill(g, h1 < 0.25 ? pc[0] : hash(i, tk + 3) < 0.6 ? pc[1] : pc[2], ox + Math.round(x), y, 1 + Math.floor(hash(i + 90, tk) * (1 + (y - HZ) / 22)), 1);
  }
  if (moonA > 0.2) for (let i = 0; i < 26 * moonA; i++) {
    const tk = Math.floor(t * 1.7 + i * 0.41), h1 = hash(i + 7, tk), y = HZ + 3 + Math.floor(h1 ** 1.4 * 70), pw = 2 + (y - HZ) * 0.3;
    g.globalAlpha = 0.6; fill(g, '#d8d4f0', ox + Math.round(MOON.x - 10 + (y - HZ) * 0.2 + (hash(i, tk + 9) - 0.5) * 2 * pw), y, 1 + (h1 > 0.6 ? 1 : 0), 1);
  }
  g.globalAlpha = 1;
  // the lanterns held in the water, broken by the ripples
  for (const L of G.lanterns) {
    const k = s.lanK[L.i] || 0;
    if (k < 0.05 || L.land) continue;
    const len = Math.round((L.gy - L.y) * 0.8), x = ox + L.x;
    g.globalAlpha = k * 0.85;
    for (let j = 2; j < len; j += 2) { const yy = Math.round(L.gy + j), jt = Math.round(Math.sin(t * 3 + j * 0.8 + L.i) * (1 + j * 0.05)); if (yy >= shoreY(L.x)) break; fill(g, j < len * 0.4 ? '#ffd890' : '#e8a060', x + jt - (L.s > 2 ? 1 : 0), yy, L.s > 2 ? 2 : 1, 1); }
  }
  g.globalAlpha = 1;
  // the sailboat and its reflection, its mast light at dusk
  const bx = ox + Math.round(s.boat.x), sc = mixSteps(SAILC, sw), dk = hex(mixSteps(GULLC.map((p) => p[0]), sw));
  if (s.boat.wait <= 0) {
    fill(g, dk, bx - 4, HZ, 9, 1); fill(g, dk, bx - 3, HZ + 1, 7, 1); fill(g, dk, bx, HZ - 12, 1, 12);
    for (let k = 0; k < 10; k++) { const w2 = Math.round(k * 0.5); fill(g, hex(k < 2 ? mixc(sc, 0x403048, 0.3) : sc), bx + 1, HZ - 11 + k, w2, 1); }
    for (let k = 3; k < 10; k++) { const w2 = Math.round((k - 3) * 0.45); if (w2) fill(g, hex(mixc(sc, 0x403048, 0.35)), bx - w2, HZ - 11 + k, w2, 1); }
    g.globalAlpha = 0.5; for (let j = 2; j < 6; j++) fill(g, dk, bx - 3 + Math.round(Math.sin(t * 2 + j) * 1), HZ + j, 4 + (j & 1), 1); g.globalAlpha = 1;
    if (s.boat.lamp) { fill(g, '#ffe8a0', bx, HZ - 13); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.drawImage(F.lan[0], bx - 4, HZ - 17); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  }
  // dolphins out in the light
  for (const d of s.dolphins) {
    const u = d.t / 1.3;
    if (u < 1) {
      const x = ox + Math.round(d.x + u * 16 * d.dir), y = Math.round(d.y - Math.sin(u * Math.PI) * 6);
      for (let k = -3; k <= 3; k++) { const yy = y + Math.round((k * k) / 5) + (u < 0.5 ? (k * d.dir < 0 ? 0 : 0) : 0); if (yy < d.y) fill(g, dk, x + k * d.dir, yy, 1, 2); }
      if (u > 0.1 && u < 0.9) fill(g, dk, x - d.dir, y - 1);
    }
    if (u >= 0.85) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, rr = 1 + Math.min(3, (d.t - 1.1) * 4); g.globalAlpha = Math.max(0, 1 - (d.t - 1.1)); fill(g, pc[1], ox + Math.round(d.x + 16 * d.dir + Math.cos(a) * rr * 1.6), Math.round(d.y + Math.sin(a) * rr * 0.4)); }
    g.globalAlpha = 1;
  }

  // the sand
  drawLit(g, G, G.back, ord);
  // footprints, shells, the tide pools' water
  for (const p of s.prints) {
    if (p.a < 0.05) continue;
    const x = ox + p.x, y = p.y, [yb] = shoreAt(G, p.x), wetp = y < yb + 32 * G.persp[clamp(p.x + ox, 0, G.bw - 1)];
    g.globalAlpha = Math.round(p.a * 4) / 4;
    if (p.s === 0) fill(g, wetp ? P.dentWet : P.dent, x, y);
    else { fill(g, wetp ? P.dentWet : P.dent, x, y, p.s + 1, p.s); fill(g, P.dentHi, x, y - 1, p.s + 1, 1); }
  }
  g.globalAlpha = 1;
  for (const sh of s.shells) {
    const S = SHELLS[sh.kind], C = P.shells[sh.kind], rows = S.px, x0 = ox + Math.round(sh.x) - (rows[0].length >> 1), y0 = Math.round(sh.y) - rows.length + 1;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== '.') fill(g, C['abc'.indexOf(ch)], x0 + i, y0 + j); } });
    if (sh.fresh > 0.3 && Math.sin(t * 8) > 0) fill(g, '#ffffff', x0 + 1, y0);
  }
  // the waves
  drawBand(g, G, s, bandPalette(s));
  // the standing things: the pier, the trunks, the hut, the dunes
  drawLit(g, G, G.over, ord);
  // the tide pools' still water, holding the sky; a tiny fish now and then
  if (G.pools) for (const pl of G.pools) {
    fill(g, P.pool, ox + pl.x - pl.rx + 1, pl.y - 1, pl.rx * 2 - 1, 1); fill(g, P.poolHi, ox + pl.x - pl.rx + 2, pl.y, pl.rx * 2 - 3, 1);
    fill(g, pc[1], ox + pl.x - 2 + (Math.floor(t * 1.5) % 4), pl.y - 1);
    if (s.fish && s.fish.pool === pl) fill(g, '#f0a040', ox + pl.x + Math.round((s.fish.t / 1.4 - 0.5) * pl.rx * 1.6), pl.y - (s.fish.t % 0.4 < 0.2 ? 1 : 0));
  }
  // the hut's lamp, its flag; the bonfire
  if (G.hutLamp && (s.hutK = (s.hutK || 0) + ((s.hutOn ? 1 : 0) - (s.hutK || 0)) * 0.08) > 0.03) {
    const L = G.hutLamp;
    g.globalAlpha = s.hutK; fill(g, '#ffc878', ox + L.wx, L.wy, 6, 7); fill(g, '#ffe0a0', ox + L.wx + 7, L.wy, 5, 7); fill(g, '#fff0c8', ox + L.wx + 2, L.wy + 2, 2, 3);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = s.hutK * 0.45; g.drawImage(F.hut, ox + L.x - 15, L.y - 11); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  if (G.flagAt) {
    const fxp = ox + G.flagAt.x, fyp = G.flagAt.y;
    for (let i = 0; i < 8; i++) { const wv = Math.round(Math.sin(s.flagPh - i * 0.7) * (0.5 + i * 0.12) * (0.6 + s.wind)); fill(g, P.flag[(i >> 1) % 2], fxp + i, fyp + wv, 1, 4); }
  }
  if (G.fireAt) {
    const x = ox + G.fireAt.x, y = G.fireAt.y, fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * fl * (0.6 + dusk * 0.4); g.drawImage(F.fire, x - 34, y - 20); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    for (let k = -2; k <= 2; k++) { const h = Math.round((4 - Math.abs(k)) * (0.8 + 0.4 * Math.sin(t * 13 + k * 2.1))) + 1; for (let j = 0; j < h; j++) fill(g, j > h - 2 ? '#fff0a0' : j > h * 0.5 ? '#ffb040' : '#f06a28', x + k, y - 1 - j); }
    fill(g, '#fff8d0', x, y - 2);
    for (const p of s.sparks) { g.globalAlpha = 1 - p.t / p.life; fill(g, p.t < 0.4 ? '#ffe8a0' : '#ff9a40', ox + Math.round(p.x), Math.round(p.y)); }
    g.globalAlpha = 1;
  }
  // grass in the wind
  for (const gr of G.grass) for (let k = 0; k < gr.n; k++) {
    const h = gr.h - k, b = Math.sin(t * 1.3 + gr.ph + k) * 0.6 + s.wind * (2 + Math.sin(t * 3.3 + gr.ph) * 1.2) + (s.kick > 0 ? Math.sin(t * 12 + k) * s.kick : 0);
    const fan = (k - (gr.n - 1) / 2) * 1.6;
    for (let j = 0; j < h; j++) fill(g, P.grass[j < h * 0.4 ? 0 : j < h * 0.8 ? 1 : 2], ox + Math.round(gr.x + k + (fan + b * (k % 2 ? 1 : 0.8)) * (j / h) ** 1.6), gr.y - j);
  }
  // crabs and sandpipers, the sandcastles
  for (const c of s.crabs) {
    if (c.mode === 'in') continue;
    const sink = c.mode === 'out' ? Math.round((c.t / 0.6) * 3) : c.mode === 'dig' ? Math.round((1 - c.t / 0.5) * 3) : 0;
    const x = ox + Math.round(c.x) - 3, y = Math.round(c.y) - 3 + sink, moving = c.mode === 'walk' || c.mode === 'home', lg = moving && Math.floor(c.ph * 14) % 2;
    const wave = c.mode === 'pause' && Math.sin(c.ph * 6) > 0.6;
    if (sink < 3) {
      fill(g, P.crab[1], x + 1, y + 1, 5, 2); fill(g, P.crab[2], x + 2, y + 1, 3, 1); fill(g, P.crab[0], x + 1, y + 3, 5, 1);
      fill(g, P.crab[1], x - 1 + (wave ? 0 : 0), y + (wave ? -1 : 0), 2, 2); fill(g, P.crab[1], x + 6, y + (wave ? -1 : 0), 2, 2);
      fill(g, P.crab[3], x + 2, y, 1, 1); fill(g, P.crab[3], x + 4, y, 1, 1);
      if (sink < 2) for (const lx of [0, 1, 5, 6]) fill(g, P.crab[0], x + lx + (lg ? (lx < 3 ? -1 : 1) : 0), y + 4, 1, 1);
    }
  }
  for (const p of s.pipers) {
    const x = ox + Math.round(p.x), y = Math.round(p.y), run = p.mode === 'run' && p.fly <= 0, lg = Math.floor(p.ph * 16) % 2, peck = p.mode === 'stand' && Math.sin(p.ph * 3 + p.x) > 0.7;
    if (p.fly > 0) { const up = Math.floor(p.ph * 18) % 2; fill(g, P.piper[1], x - 1, y - 3, 3, 1); fill(g, P.piper[0], x - 3, y - 3 - up, 2, 1); fill(g, P.piper[0], x + 2, y - 3 - up, 2, 1); continue; }
    fill(g, P.piper[1], x - 1, y - 3, 3, 1); fill(g, P.piper[2], x - 1, y - 2, 3, 1); fill(g, P.piper[1], x + 1, y - 4 + (peck ? 2 : 0), 1, 1); fill(g, P.piper[3], x + 2, y - 4 + (peck ? 3 : 0), 1, 1);
    fill(g, P.piper[3], x - (run && lg ? 1 : 0), y - 1, 1, 1); fill(g, P.piper[3], x + (run && !lg ? 1 : 0), y - 1, 1, 1);
  }
  for (const c of s.castles) drawCastle(g, ox, c, c.damp > 0.5 ? P.castleWet : P.castle);
  // gulls
  const gc = [hex(mixSteps(GULLC.map((p) => p[0]), sw)), hex(mixSteps(GULLC.map((p) => p[1]), sw))];
  for (const gl of s.gulls) drawGull(g, { ...gl, x: gl.x + ox }, t, gc);
  // the palms' crowns, swaying; the hammock
  const swv = (ph, n) => { const v = Math.sin(t * 0.55 + ph) * 0.45 + s.wind * Math.sin(t * 2.1 + ph) * 1.6 + (s.kick > 0 ? Math.sin(t * 9) * s.kick * 1.6 : 0); return clamp(Math.round(v * (n >> 1) + (n >> 1)), 0, n - 1); };
  if (G.hammockS) {
    drawLit(g, G, G.hammockS[clamp(Math.round(s.swing * 2) + 2, 0, 4)], ord);
    G.crownH.forEach((fr, i) => drawLit(g, G, fr[swv(2 + i * 1.7, 3)], ord));
  }
  drawLit(g, G, G.crown[swv(0, 5)], ord);
  // lights: the lanterns along the pier, the fireflies
  for (const L of G.lanterns) {
    const k = s.lanK[L.i] || 0;
    if (k < 0.03) continue;
    const fl = 0.88 + 0.12 * Math.sin(t * (7 + L.i) + L.i * 2) * Math.sin(t * 4.3 + L.i);
    const x = ox + L.x - (L.s >> 1), y = L.y - (L.s >> 1);
    g.globalAlpha = k; fill(g, '#ffd27e', x, y, L.s, L.s); if (L.s > 1) fill(g, '#fff4c8', x + (L.s > 2 ? 1 : 0), y + (L.s > 2 ? 1 : 0), 1, 1);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = k * 0.75 * fl;
    const gs = F.lan[L.s - 1], gw = gs.width >> 1, gh = gs.height >> 1;
    g.drawImage(gs, ox + L.x - gw, L.y - gh);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  if (dusk > 0.1) {
    g.globalCompositeOperation = 'lighter';
    for (const f of s.flies) { const a = dusk * Math.max(0, Math.sin(f.ph * 1.7)); if (a < 0.1) continue; g.globalAlpha = a; g.drawImage(F.fly, ox + Math.round(f.x) - 2, Math.round(f.y) - 2); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  // close by: the towel, the hat, the armrest, the drink, the sunglasses
  drawLit(g, G, G.front, ord);
  drawLit(g, G, G.glass[clamp(s.drink, 0, 4)], ord);
  if (s.sipT > 0) { g.globalAlpha = Math.min(1, s.sipT * 2); fill(g, '#ffffff', ox + DRINK.x - 2, DRINK.y - 2 - Math.round(s.drink * 3.4) - Math.round(Math.sin(s.sipT * 9) * 1), 3, 1); g.globalAlpha = 1; }
  if (!s.shades) drawLit(g, G, G.shades, ord);
  if (s.shades) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#e8b890'; g.fillRect(0, 0, G.bw, H); g.globalCompositeOperation = 'source-over'; }
}
// the sun's disc: a warm rim, a pale body, a white heart; flattened and banded with haze near the sea
function drawSun(g, ox, sy, sw) {
  const sc = [0, 1, 2].map((i) => hex(mixSteps(SUNC.map((p) => p[i]), sw))), a = g.globalAlpha;
  const low = clamp((sy - 92) / 26, 0, 1), rx = 11, ry = 11 * (1 - 0.12 * low);
  disc(g, ox + SUNX, sy, rx, ry, sc[2], HZ); disc(g, ox + SUNX, sy, rx - 1.2, ry - 1.2, sc[1], HZ); disc(g, ox + SUNX - 1, sy - 1, rx - 4.5, ry - 4.5, sc[0], HZ);
  if (low > 0.2) {
    g.fillStyle = hex(mixSteps(SKY.map((p) => p[6]), sw));
    for (let k = 0; k < 3; k++) { const yy = Math.round(sy + 3 + k * 3), hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - ((yy - sy) / ry) ** 2))); if (yy < HZ && hw > 0 && low > 0.2 + k * 0.25) g.fillRect(ox + SUNX - hw, yy, hw * 2 + 1, 1); }
  }
  g.globalAlpha = a;
}
function drawCastle(g, ox, c, C) {
  const x = ox + Math.round(c.x), y = Math.round(c.y), lv = c.lv, soft = clamp(c.soft, 0, 1), hk = 1 - soft * 0.6;
  // the mound, then the keep, then the towers and the flag, slumping as the water softens them
  const mw = Math.round(6 + Math.min(3, lv) * 2 + soft * 3);
  for (let k = 0; k < 3; k++) fill(g, C[k === 0 ? 0 : k === 1 ? 1 : 2], x - mw + k * 2, y - k, (mw - k * 2) * 2 + 1, 1);
  if (lv < 0.6) return;
  const kh = Math.round(6 * hk * Math.min(1, lv - 0.4)), kw = 4;
  if (kh > 0) { fill(g, C[1], x - kw, y - 2 - kh, kw * 2 + 1, kh); fill(g, C[3], x - kw, y - 2 - kh, 2, kh); fill(g, C[0], x + kw, y - 2 - kh, 1, kh); fill(g, C[0], x - 1, y - 4, 2, 2); }
  if (soft < 0.4 && kh > 2) for (let i = -kw; i <= kw; i += 2) fill(g, C[2], x + i, y - 3 - kh, 1, 1);
  if (lv < 1.6) return;
  const th = Math.round(5 * hk * Math.min(1, lv - 1.4));
  for (const sx of [-kw - 3, kw + 1]) if (th > 0) { fill(g, C[1], x + sx, y - 2 - th, 3, th); fill(g, C[3], x + sx, y - 2 - th, 1, th); if (soft < 0.4) fill(g, C[2], x + sx + 1, y - 3 - th, 1, 1); }
  if (lv >= 2.6 && soft < 0.3) { fill(g, C[0], x, y - 9 - kh, 1, 6); fill(g, '#e84a3a', x + 1, y - 9 - kh, 3, 2); }
}

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const G = beachFor(320), s = makeState(7, G);
    s.day = 0.44; s.stage = stepOf(s.day); s.sw = [0, 0, 1, 0, 0, 0]; s.lanOn = true; s.lanUser = true; s.lan = 1;
    s.waves = []; s.nextWave = 99;
    for (let i = 0; i < 160; i++) update(s, G, 1 / 30, {});
    s.lanK = G.lanterns.map(() => 1);
    s.waves = [{ born: s.t - 4.6 - 0.35 - 1.2, size: 1.1, x0: 150, peel: 80, app: 4.6, up: 2.6, back: 3.2, rk: 1, peaked: true }, { born: s.t - 3.4, size: 0.9, x0: 220, peel: 70, app: 4.6, up: 2.5, back: 3.2, rk: 1, peaked: true }];
    const scratch = document.createElement('canvas').getContext('2d');   // the wet sand remembers the last few frames of water
    for (let i = 0; i < 30; i++) { s.t += 1 / 30; drawBand(scratch, G, s, bandPalette(s)); }
    s.gulls[0].x = 200; s.gulls[0].y = 44; s.gulls[1].x = 228; s.gulls[1].y = 58; s.gulls[2].x = 60; s.gulls[2].y = 90;
    s.boat.x = 96; s.boat.wait = 0; s.crabs[0].mode = 'pause'; s.crabs[0].x = 118; s.crabs[0].y = 250;
    const buf = document.createElement('canvas'); buf.width = 320; buf.height = H;
    render(buf.getContext('2d'), G, s);
    PREV = buf;
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
  let G = null, B = null, job = null, jobW = 0, pendW = 0, pendT = 0, up = null, upg = null, preTried = false, s = null;
  const preW = beachW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: 320, sx: 0, dx: 0 };
  const timers = new Set();
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  const status = () => setScore(`${STAGE_TXT[s.stage]} · ${s.lanOn ? 'lanterns lit along the pier' : 'the waves rolling in'}${s.shades ? ' · sunglasses on' : ''}`);
  setScore('Click the waves, the sun, the shells, the pier, the drink…');
  let msgT = 0;
  const hint = setTimeout(() => { if (!msgT && s) status(); }, 6000);   // cleared on stop, so it never writes over the next scene
  const say = (text) => { clearTimeout(msgT); setScore(text); msgT = setTimeout(() => { msgT = 0; status(); }, 3600); };

  // the sea's two voices: the hiss of foam ('rain') and the low roar of the breaking ('murmur'),
  // swelled in time with each wave as it breaks and runs up the sand, eased back as it draws away
  const amb = playAmbience({ rain: 0.15, murmur: 0.2 }, isPaused);
  const stopMusic = playLoungeMusic('beach', isPaused);
  let surfT = 0, lastRoar = 0.2, lastFizz = 0.15;
  const surf = () => {
    let roar = 0, fizz = 0;
    const tt = s.t + 0.45;   // a little ahead, since the levels glide over about half a second
    for (const w of s.waves) for (let k = 0; k < 9; k++) {
      const x = 10 + k * 37.5, tau = tt - w.born - w.app - Math.abs(x - w.x0) / w.peel;
      if (tau < -w.app) continue;
      if (tau < -0.6) { roar += 0.05 * w.size * (1 + tau / w.app); continue; }
      roar += w.size * (tau < 0.15 ? ease((tau + 0.6) / 0.75) : Math.exp(-(tau - 0.15) / 0.6));
      const p = tau - W_BRK;
      if (p > 0 && p < w.up) fizz += w.size * (0.95 - (0.45 * p) / w.up);
      else if (p >= w.up && p < w.up + w.back) fizz += w.size * 0.5 * (1 - (p - w.up) / w.back);
    }
    return [Math.min(1.3, roar / 9), Math.min(1.3, fizz / 9)];
  };
  const hooks = {
    stage() { if (!msgT) status(); },
    lanterns(on, byHand) { if (!byHand && !msgT) say('The pier lanterns come on, one by one'); },
    castle() { if (!msgT) say('A wave softens your sandcastle'); },
    refill() { tone(91, { dur: 0.3, vol: 0.012 }); tone(94, { dur: 0.3, vol: 0.01, delay: 0.12 }); if (!msgT) say('Another one arrives, ice clinking'); },
  };
  const gullCall = (v = 1) => { drip(0.024 * v, 2300, 1350); later(150, () => drip(0.02 * v, 2150, 1300)); later(330, () => drip(0.016 * v, 2000, 1250)); };

  const settle = (bw) => {
    const want = beachW(bw), now = performance.now();
    if (!G) { G = beachFor(want); s = makeState(Date.now() % 100000, G); }
    if (G.bw !== want) {
      const cached = BEACHES.get(want);
      if (cached) adopt(cached);
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildBeach(want); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && !BEACHES.has(preW)) { job = buildBeach(preW); jobW = preW; preTried = true; }
    }
    if (job) {
      const done = pump(job, jobW === want ? 5 : 3);
      if (done) { keep(done); job = null; jobW = 0; if (done.bw === want) adopt(done); }
    } else if (s.t > 2) {
      // paint ahead what the evening needs next (the next step's sky and sea, the lantern's other
      // state, the next step's light), a piece a frame
      const nx = Math.min(NST - 1, s.stage + 1);
      if (!G.sky[nx]) { skyFor(G, nx); return finishBuf(); }
      if (!G.sea[nx]) { seaFor(G, nx); return finishBuf(); }
      if (!CLOUDS[nx]) { cloudsFor(nx); return finishBuf(); }
      const next = [s.stage * 2 + 1 - (s.lanOn ? 1 : 0), nx * 2 + (s.lanOn || nx >= 3 ? 1 : 0), nx * 2];
      const sprites = [G.back, G.over, G.front, ...G.crown, G.glass[clamp(s.drink, 0, 4)], G.shades, ...(G.hammockS || []), ...(G.crownH ? G.crownH.flat() : [])];
      for (const k of next) for (const sp of sprites) if (!sp.img[k]) { spriteImg(G, sp, k); return finishBuf(); }
    }
    finishBuf();
  };
  const finishBuf = () => { if (!B || B.width !== G.bw) { B = document.createElement('canvas'); B.width = G.bw; B.height = H; B.g = B.getContext('2d'); } };
  // a beach of another width: the creatures keep their places, those left off the edges come back on
  function adopt(N) {
    G = N;
    for (const gl of s.gulls) gl.x = clamp(gl.x, G.L - 20, G.RT + 20);
    for (const f of s.flies) f.x = G.L + ((f.x - G.L) % (G.RT - G.L) + (G.RT - G.L)) % (G.RT - G.L);
    s.stars = s.stars.filter((st) => st.x >= G.L && st.x < G.RT);
    while (s.stars.length < (G.RT - G.L) / 5) s.stars.push({ x: G.L + s.r() * (G.RT - G.L), y: 2 + s.r() * (HZ - 24), p: s.r() * 6, sp: 0.6 + s.r() * 1.6, b: s.r() });
    for (const p of s.pipers) { p.x = clamp(p.x, G.L + 10, G.RT - 10); p.tx = p.x; }
    if (s.boat.x > G.RT + 20) s.boat.x = G.RT + 20;
  }

  // what is under the pointer, as the thing to do if it's clicked (null: nothing there)
  function target(x, y) {
    if (!G || !s) return null;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const [yb] = shoreAt(G, x);
    // close by first
    if (inR(DRINK.x - 8, DRINK.y - 30, DRINK.x + 9, DRINK.y + 1)) return () => {
      if (s.drink > 0) {
        s.drink -= 1; s.sipT = 0.8; drip(0.03, 640, 280); later(220, () => tone(90, { dur: 0.25, vol: 0.012 }));
        if (s.drink === 0) { s.refill = 9; say('The last sip, all ice and sunset'); } else say(['A sip of something cold, with a little umbrella', 'Passion fruit and orange, sunset in a glass', 'A sip; the ice clinks'][s.drink % 3]);
      } else say('Someone is bringing another');
    };
    if (!s.shades && inR(SHADES.x - 13, SHADES.y - 4, SHADES.x + 12, SHADES.y + 4)) return () => { s.shades = true; tone(62, { dur: 0.2, vol: 0.02, type: 'triangle' }); say('Sunglasses on: the glare softens to amber'); };
    if (s.shades && inR(SHADES.x - 13, SHADES.y - 4, SHADES.x + 12, SHADES.y + 4)) return () => { s.shades = false; tone(66, { dur: 0.2, vol: 0.02, type: 'triangle' }); say('Sunglasses off'); };
    if (inR(BOOK.x - 14, BOOK.y - 6, BOOK.x + 14, BOOK.y + 3)) return () => { swish(0.025); say(['A paperback, face down at chapter twelve: the lighthouse keeper', '“The tide went out as quietly as it came in”', 'You will finish it tomorrow, on the same towel'][Math.floor(s.t) % 3]); };
    if (inR(HAT.x - 16, HAT.y - 10, HAT.x + 16, HAT.y + 6)) return () => { swish(0.03); say('A straw hat, still warm from the sun'); };
    if (y >= 279 + ((x - 56) * 5) / 116 && x >= 56 - ((y - 279) * 30) / 47 && x <= 172 + ((y - 284) * 14) / 42) return () => { swish(0.02); say('A striped towel, warm, and a little sandy'); };
    const ax = x - ARM.x, ay = y - ARM.y, aa = (ax * 54 + ay * 47) / 5126, ab = (ay * 54 - ax * 47) / 71.6, ahw = 7 + 11 * Math.max(0, aa);
    if (aa > -0.12 && aa < 1.4 && ab > -ahw - 1 && ab < ahw + 6) return () => { tone(47, { dur: 0.2, vol: 0.024, type: 'triangle' }); later(240, () => tone(45, { dur: 0.22, vol: 0.02, type: 'triangle' })); say('The deckchair creaks as you settle back; teak, worn smooth'); };
    if (x > ARM.x - 7 && x < ARM.x + 2 && y > ARM.y) return () => { tone(45, { dur: 0.22, vol: 0.026, type: 'triangle' }); say('Your deckchair, its feet deep in the sand'); };
    // creatures
    const crab = s.crabs.find((c) => c.mode !== 'in' && c.mode !== 'dig' && Math.abs(c.x - x) < 6 && Math.abs(c.y - 1 - y) < 5);
    if (crab) return () => { crab.mode = 'home'; crab.tx = crab.hx; crab.ty = crab.hy; drip(0.018, 1800, 900); later(90, () => drip(0.014, 1700, 900)); say('The crab scuttles back into its hole'); };
    if (HOLES.some(([hx, hy]) => Math.abs(x - hx) < 4 && Math.abs(y - hy) < 3)) return () => { const c = s.crabs.find((q) => Math.abs(q.hx - x) < 5); if (c && c.mode === 'in') c.t = Math.min(c.t, 0.6); tone(52, { dur: 0.15, vol: 0.02, type: 'triangle' }); say('A crab hole: someone is home'); };
    const shell = s.shells.find((sh) => Math.abs(sh.x - x) < 5 && y > sh.y - 6 && y < sh.y + 3);
    if (shell) return () => {
      const S = SHELLS[shell.kind];
      s.shells.splice(s.shells.indexOf(shell), 1);
      tone(S.midi[0], { dur: 1.5, vol: 0.03 }); tone(S.midi[1], { dur: 1.1, vol: 0.012, delay: 0.04 }); tone(S.midi[0] - 12, { dur: 1.2, vol: 0.014, delay: 0.02 });
      say(S.msg);
    };
    if (Math.abs(x - STAR.x) < 6 && Math.abs(y - STAR.y) < 4) return () => { note(7, { dur: 0.8, vol: 0.022 }); later(160, () => note(9, { dur: 0.8, vol: 0.016 })); say('A starfish, sunning itself on the sand'); };
    const piper = s.pipers.find((p) => Math.abs(p.x - x) < 6 && Math.abs(p.y - 2 - y) < 5);
    if (piper) return () => {
      for (const p of s.pipers) { const d = (s.r() < 0.5 ? -1 : 1); p.fly = 1.2 + s.r() * 0.6; p.vx = d * (30 + s.r() * 20); p.vy = -4 + s.r() * 4; }
      [0, 80, 170, 260].forEach((ms) => later(ms, () => tone(96 + (ms % 3), { dur: 0.07, vol: 0.008 })));
      say('The sandpipers scatter, peeping, and land a little way off');
    };
    const castle = s.castles.find((c) => Math.abs(c.x - x) < 9 && y > c.y - 14 && y < c.y + 3);
    if (castle) return () => { castle.lv = Math.min(3, Math.floor(castle.lv) + 1); castle.soft = Math.max(0, castle.soft - 0.5); swish(0.03); later(140, () => tone(45, { dur: 0.16, vol: 0.026, type: 'triangle' })); say(castle.lv >= 3 ? 'A flag on top: a fine castle' : 'Another tower for the sandcastle'); };
    const gull = s.gulls.find((gl) => Math.abs(gl.x - x) < (gl.big ? 9 : 7) && Math.abs(gl.y - y) < 5);
    if (gull) return () => { gull.flap = 1.6; gull.call = 1; gullCall(gull.big ? 1.1 : 0.8); say('A gull calls over the water'); };
    // full screen's places
    if (G.hammockS && inR(-62, 196, -8, 224)) return () => { s.swingV += 2.4; tone(43, { dur: 0.35, vol: 0.02, type: 'triangle' }); later(700, () => tone(45, { dur: 0.3, vol: 0.016, type: 'triangle' })); say('The hammock rocks, gently'); };
    if (G.fireAt && inR(G.fireAt.x - 22, G.fireAt.y - 16, G.fireAt.x + 18, G.fireAt.y + 4)) return () => {
      s.sparkBoost = 1.2;
      for (let k = 0; k < 6; k++) later(k * 90 + s.r() * 60, () => drip(0.01, 2800 + s.r() * 1600, 1400));
      [57, 61, 64, 69, 73, 76].forEach((m, i) => later(500 + i * 120, () => tone(m, { dur: 1.6, vol: 0.022, type: 'triangle' })));
      say('Someone strums a guitar by the fire');
    };
    if (G.hutLamp && inR(396, 120, 444, 210)) return () => { s.hutUser = true; s.hutOn = !s.hutOn; drip(0.02, 2400, 1700); say(s.hutOn ? 'A lamp in the lifeguard hut' : 'The lifeguard hut goes dark'); };
    if (G.pools) { const pl = G.pools.find((q) => Math.abs(x - q.x) <= q.rx + 2 && Math.abs(y - q.y) < 4); if (pl) return () => { s.fish = { pool: pl, t: 0 }; drip(0.02, 900, 420); say('A tide pool: anemones, and a tiny fish darting'); }; }
    if (G.stairs && inR(320, 196, 392, 222)) return () => { splash(0.02); say('Rocks round the pier\'s feet, barnacled and warm'); };
    if (G.dunes && x < -122 && y > 160 && y < 220) return () => { s.kick = 1.5; gust(s, 0.7, 1.6); swish(0.045); say('The dune grass bends in the breeze'); };
    if (G.rowboat && inR(456, 208, 500, 224)) return () => { tone(40, { dur: 0.4, vol: 0.024, type: 'triangle' }); say('A rowboat, pulled up above the tide line'); };
    if (G.lightAt && Math.abs(x - G.lightAt.x) < 6 && y > G.lightAt.y - 6 && y < HZ) return () => { s.beam = 0; note(4, { dur: 1.4, vol: 0.02 }); say('The lighthouse turns its slow eye over the sea'); };
    // the sky and the sea
    if (sunY(s.day) < HZ + 6 ? sq(x - SUNX, y - sunY(s.day)) < 15 : sq((x - SUNX) / 2, y - HZ + 5) < 11) return () => skip();
    if (s.boat.wait <= 0 && Math.abs(x - s.boat.x) < 7 && y > HZ - 14 && y < HZ + 3) return () => { s.boat.lamp = !s.boat.lamp; s.boat.lampSet = true; note(4, { dur: 1, vol: 0.02 }); say(s.boat.lamp ? 'A sailboat heading home; its mast light comes on' : 'A sailboat, heading home on the last of the wind'); };
    // the pier and its lanterns
    const zPier = PIER.C / Math.max(1, x - PIER.xv);
    if (x > pX(PZF) - 3 && zPier >= 7 && zPier <= PZF * 1.1 && y > pDY(zPier) - 0.6 * (pGY(zPier) - HZ) - 4 && y < pGY(zPier)) return () => {
      s.lanOn = !s.lanOn; s.lanUser = true; s.lanT = 0;
      const ns = G.lanterns.length;
      for (let i = 0; i < ns; i++) later(i * 320, () => tone(s.lanOn ? [72, 74, 76, 79, 81, 84, 86, 88][i % 8] : [84, 81, 79, 76, 74, 72, 69, 67][i % 8], { dur: 0.9, vol: 0.011 }));
      say(s.lanOn ? 'The pier lanterns flicker on, one by one' : 'The lanterns go out along the pier');
    };
    // the palms
    const P = PALM, inTrunk = y > P.ty && y < P.fy && Math.abs(x - (P.fx + (P.tx - P.fx) * ((P.fy - y) / (P.fy - P.ty)) + P.bend * Math.sin(Math.PI * ((P.fy - y) / (P.fy - P.ty))) * 0.9)) < 7;
    const inCrown = sq((x - P.tx) / 70, (y - P.ty - 10) / 44) < 1 && y < 108;
    const inSmall = G.hammockS && [HAMMOCK.a, HAMMOCK.b].some(([, , tx, ty]) => sq((x - tx) / 28, (y - ty) / 20) < 1);
    if (inTrunk || inCrown || inSmall) return () => { s.kick = 1.6; gust(s, 0.55, 1.4); swish(0.05); later(260, () => swish(0.035)); say('A breeze through the palms'); };
    // the waves: where they break and run up, a bigger set rolls in; out on the open water, dolphins
    if (y > yb - 34 && y < yb + 32 && y > HZ + 20) return () => {
      const at = s.t;
      [[0, 1.35], [3.1, 1.6], [6.3, 1.4]].forEach(([d, size]) => s.queue.push({ at: at + 0.6 + d, size, x0: clamp(x, 10, 310) + (s.r() - 0.5) * 40 }));
      s.queue.sort((a, b) => a.at - b.at); s.nextWave = Math.max(s.nextWave, 11);
      swish(0.03);
      say('A bigger set rolls in from the bay');
    };
    if (y > HZ + 1 && y <= yb - 34) return () => {
      const n = 1 + (s.r() < 0.6 ? 1 : 0), dir = s.r() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i++) s.dolphins.push({ x: x - 8 * dir + i * 7 * dir, y: Math.round(y) + i, t: -i * 0.35, dir });
      later(1100, () => splash(0.03)); later(1450, () => splash(0.022));
      say(n > 1 ? 'Dolphins, out in the light' : 'A dolphin, out in the light');
    };
    if (y < HZ) return () => {
      if (s.day > 0.7) { s.shoots.push({ x: x + 20, y: Math.max(6, y - 10), vx: -70, vy: 26, t: 0 }); note(12, { dur: 1.2, vol: 0.016 }); later(200, () => note(14, { dur: 1.2, vol: 0.012 })); say('A shooting star: make a wish'); }
      else { const gl = s.gulls[1 + Math.floor(s.r() * 2)]; gl.x = s.r() < 0.5 ? G.L - 10 : G.RT + 10; gl.vx = gl.x < 0 ? 14 : -14; gl.y = clamp(y, 20, 100); gl.flap = 2; gullCall(0.6); say('A gull drifts over, calling'); }
    };
    // the dry sand: a little sandcastle
    if (y > yb + 8 && y < 276 && !(y > 276 && x < 190)) return () => {
      const cy = Math.round(y);
      s.castles.push({ x: Math.round(x), y: cy, lv: 1, soft: 0, wet: false, damp: 0 });
      if (s.castles.length > 4) s.castles.shift();
      swish(0.03); later(150, () => tone(45, { dur: 0.16, vol: 0.026, type: 'triangle' })); later(330, () => tone(47, { dur: 0.14, vol: 0.022, type: 'triangle' }));
      say('You pat up a little sandcastle');
    };
    return null;
  }
  // the sun: on through the evening, one step at a time (after dusk, another golden hour)
  function skip() {
    const st = s.stage;
    s.day = st >= NST - 1 ? 0.02 : (st + 1) / NST + 0.005;
    if (st >= NST - 1) { s.lanUser = false; s.lanOn = false; s.boat.lampSet = false; s.boat.lamp = false; }
    [9, 7, 5].forEach((n, i) => later(i * 170, () => note(n + (st >= NST - 1 ? 3 : 0), { dur: 1.1, vol: 0.022 })));
    say(st >= NST - 1 ? 'Another evening: golden hour again' : ['The sun slips lower', 'The sky turns orange and coral', 'The sun touches the sea', 'Gone: the afterglow', 'Dusk, and the first stars'][st]);
  }
  const at = (e) => {
    const p = pointIn(canvas, e), W = canvas._snW || 640;
    return [(p.x * view.bw) / W + view.sx - view.dx - (G ? G.ox : 0), p.y / 2];
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const act = target(...at(e));
    if (act) act();
  };
  const onMove = (e) => { if (G) canvas.style.cursor = target(...at(e)) ? 'pointer' : ''; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, bw = Math.max(320, Math.round((320 * W) / 640));
    settle(bw);
    update(s, G, dt, hooks);
    render(B.g, G, s);
    // the sea's voice, following the waves
    surfT -= dt;
    if (surfT <= 0) {
      surfT = 0.1;
      const [roar, fizz] = surf(), mr = 0.12 + 0.6 * roar, rf = 0.08 + 0.85 * fizz;
      if (Math.abs(mr - lastRoar) > 0.012) { amb.set('murmur', mr); lastRoar = mr; }
      if (Math.abs(rf - lastFizz) > 0.012) { amb.set('rain', rf); lastFizz = rf; }
    }
    // whole-number steps without smoothing; any last fraction with a good filter
    view.bw = bw; view.sx = Math.max(0, (G.bw - bw) >> 1); view.dx = Math.max(0, (bw - G.bw) >> 1);
    const sw = Math.min(bw, G.bw), k = Math.max(1, Math.ceil(canvas.height / H));
    if (canvas.height === H * k && canvas.width === bw * k) {
      ctx.imageSmoothingEnabled = false;
      if (view.dx) { ctx.fillStyle = SIDE; ctx.fillRect(0, 0, W, 640); }
      ctx.drawImage(B, view.sx, 0, sw, H, (view.dx * W) / bw, 0, (sw * W) / bw, 640);
    } else {
      if (!up || up.width !== bw * k || up.height !== H * k) { up = document.createElement('canvas'); up.width = bw * k; up.height = H * k; upg = up.getContext('2d'); }
      upg.imageSmoothingEnabled = false;
      if (view.dx) { upg.fillStyle = SIDE; upg.fillRect(0, 0, up.width, up.height); }
      upg.drawImage(B, view.sx, 0, sw, H, view.dx * k, 0, sw * k, H * k);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(up, 0, 0, W, 640);
    }
  }, isPaused);

  return () => {
    clearTimeout(hint);
    clearTimeout(msgT);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    stopLoop();
    stopMusic();
    amb.stop();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.style.cursor = '';
  };
}
