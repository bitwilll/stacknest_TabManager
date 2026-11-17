// Koi Garden — a lounge, not a game: an evening on the engawa, the wooden veranda of an old
// house, looking out over a Japanese garden as the late-afternoon sun turns gold. In the middle a
// koi pond: clear water over a pebbled edge, the sky and the maple held in it, lily pads and a lotus,
// koi turning slow curves under them. A bamboo spout (kakei) trickles into a stone basin (tsukubai)
// that spills over into the pond; a stone lantern (toro) stands on the far bank, an arched bridge
// crosses the water, a red maple lets its leaves go, bamboo leans over raked gravel, dragonflies
// hover over the reeds. From the eaves hangs a wind chime, its paper strip turning in the breeze:
// every so often a breeze comes, the rods swing and each one sounds as the clapper meets it. On
// the boards a cat dozes beside a cup of tea. In full screen the garden goes on: more pond and the
// bridge further out, a bamboo fence, stepping stones through a moss garden, a second maple,
// raked gravel round a rock.
// Pixel art, as in the other lounges: painted into a buffer 320 px tall (as wide as the frame's
// shape) and scaled up by whole steps with no smoothing. Every still surface is painted once in
// daylight colours, then each pixel takes its colour from a short ramp made for that colour (cool
// shade, golden sun, the lantern's amber), stepped by the light that reaches it; inside a step the
// colour is flat, and only where two steps meet is there a narrow band of ordered dither. The
// garden is baked once per frame shape, per hour of the light and per lantern state; each frame
// only the moving things are drawn over it.

import { setupCanvas, runLoop, pointIn, tone, note, drip, splash, swish, playLoungeMusic, playAmbience } from './arcade-kit.js';

export const meta = { id: 'garden', title: 'Koi Garden', blurb: 'An engawa over a koi pond as the sun turns gold. Wind chimes, a red maple, a dozing cat.', keys: 'Click the pond, the chimes, the lantern…', lounge: true };

const H = 320;                     // buffer height; the core composition is 320 wide
const STEP = 16;                   // garden widths round up to this, so a resize doesn't rebuild every frame
const SIDE = '#24261e';            // the edges, for the moment a wider garden is still being built
const ENG = 266;                   // where the veranda's edge meets the garden
const WALL = 98;                   // the garden wall's plaster top (its tiles sit just above)
const TORO = { x: 206, y: 164 };   // the stone lantern: its centre line and the foot of its base
const MAPLE = { x: 30, y: 176 };   // the red maple's trunk foot
const SPOUT = { x: 56, y: 223 };   // the bamboo spout's mouth
const BASIN = { x: 64, y: 237 };   // the stone basin's water (its centre)
const CHIME = { x: 228, y: 13 };   // where the wind chime hangs from the eaves
const CAT = { x: 236, y: 274 };    // the cat's sprite (top-left)
const CUP = { x: 196, y: 288 };    // the tea cup (its centre bottom)
const FAN = { x: 44, y: 290 };     // the round fan on the boards
const LOTUS = { x: 150, y: 226 };
const STAGES = ['Late afternoon', 'Golden hour', 'Evening'];
const CHIME_MIDI = [76, 79, 81, 84, 86, 88];

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const hash = (x, y = 0) => {
  let t = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// smooth value noise, for clumps of leaves, moss and dappled shade
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
    const na = Math.round(oa * 255);
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 253 ? 255 : na;
  }
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
  clear(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = this.at(xx, yy); if (i >= 0) this.d.fill(0, i, i + 4); } }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  dith(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (bay(xx, yy) < lvl) this.px(xx, yy, c); }
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
  vgrad(x, y, w, h, cols) {
    for (let j = 0; j < h; j++) {
      const t = (h > 1 ? j / (h - 1) : 0) * (cols.length - 1), i0 = Math.floor(t), f = t - i0;
      for (let xx = x; xx < x + w; xx++) this.px(xx, y + j, f > 0.36 && (f > 0.64 || bay(xx, y + j) < (f - 0.36) / 0.28) ? cols[Math.min(cols.length - 1, i0 + 1)] : cols[i0]);
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
   For each painted colour, fourteen lit versions per hour of the light: seven on the shade side
   (blue-green, turning violet towards evening) and seven on the sun side (gold, turning amber and
   rose). A pixel's step comes from the total light on it, its side from how much of it is warm. */
const CT0 = [   // intensity, × r g b, + r g b
  [0.30, 0.62, 0.74, 1.10, 8, 10, 28], [0.40, 0.68, 0.79, 1.08, 6, 9, 22], [0.51, 0.74, 0.84, 1.05, 5, 8, 16],
  [0.63, 0.80, 0.89, 1.03, 4, 6, 10], [0.76, 0.86, 0.93, 1.01, 2, 4, 6], [0.89, 0.92, 0.97, 0.99, 1, 2, 2], [1.00, 0.97, 1.00, 0.98, 0, 0, 0],
];
const WT0 = [
  [0.38, 0.96, 0.74, 0.84, 16, 6, 14], [0.50, 1.03, 0.81, 0.80, 14, 6, 8], [0.62, 1.09, 0.87, 0.76, 12, 6, 4],
  [0.74, 1.13, 0.92, 0.73, 12, 6, 0], [0.86, 1.17, 0.96, 0.72, 14, 8, 0], [0.97, 1.20, 1.00, 0.72, 16, 10, 0], [1.08, 1.22, 1.03, 0.74, 20, 14, 4],
];
// the same ramps a little later in the day: shade bluer and dimmer, sun deeper amber
const TABLES = [0, 1, 2].map((s) => [
  CT0.map(([I, r, g, b, ar, ag, ab]) => [I * (1 - 0.05 * s), r * (1 + 0.035 * s), g * (1 - 0.045 * s), b * (1 + 0.02 * s), ar + 2 * s, ag, ab + 5 * s]),
  WT0.map(([I, r, g, b, ar, ag, ab]) => [I * (1 - 0.02 * s), r * (1 + 0.025 * s), g * (1 - 0.055 * s), b * (1 - 0.13 * s), ar + 5 * s, ag - s, ab + 2 * s]),
]);
const AMB = [0.55, 0.46, 0.35], SUN = [0.5, 0.5, 0.43];   // how much shade-light and sun reaches, by hour
const RAMPS = new Map();
function rampOf(c, st) {
  const key = c * 4 + st;
  let rp = RAMPS.get(key);
  if (rp) return rp;
  rp = new Int32Array(14);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  TABLES[st].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(key, rp);
  return rp;
}
// one lit version of a painted raster: key = hour × 2 + lantern. Alpha 254 glows by itself.
function bakeOne(src, x0, y0, F, key) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length), rw = F.rw, st = key >> 1, l = key & 1;
  const am = AMB[st], sn = SUN[st];
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = x0 + x;
      let cool = 0.3, warm = 0.2;
      if (X >= 0 && X < rw && Y >= 0 && Y < H) {
        const j = Y * rw + X;
        cool = F.A[j] * am; warm = F.S[j] * sn + l * F.L[j];
      }
      const tot = cool + warm, lv = Math.min(6, band(Math.min(6, Math.max(0, (tot - 0.1) / 0.15)), X, Y));
      const wf = warm / tot, side = wf > 0.42 ? 7 : wf < 0.3 ? 0 : bay(X + 2, Y + 1) < (wf - 0.3) / 0.12 ? 7 : 0;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c, st); }
      const o = rp[side + lv];
      out[i] = o >> 16; out[i + 1] = (o >> 8) & 255; out[i + 2] = o & 255; out[i + 3] = al >= 253 ? 255 : al;
    }
  }
  return toCanvas(out, w, h);
}
// the lit colour of one painted colour at one point, for the things drawn over the bake
function litOf(G, x, y, c, key) {
  const F = G.F, X = clamp(Math.round(x) + G.ox, 0, G.bw - 1), Y = clamp(Math.round(y), 0, H - 1), j = Y * G.bw + X, st = key >> 1;
  const cool = F.A[j] * AMB[st], warm = F.S[j] * SUN[st] + (key & 1) * F.L[j], tot = cool + warm;
  return rampOf(c, st)[(warm / tot > 0.36 ? 7 : 0) + Math.min(6, Math.round(Math.max(0, (tot - 0.1) / 0.15)))];
}

/* ——— the garden's shape for one width ——— */
function layout(rw) {
  const ox = Math.floor((rw - 320) / 2), L = -ox, RT = rw - ox, wide = RT >= 430;
  const ponds = [{ cx: 165, cy: 204, rx: 124, ry: 45, ph: 0.6 }];
  if (wide) ponds.push({ cx: 352 + Math.round(Math.min(40, Math.max(0, (RT - 448) * 0.4))), cy: 199, rx: 92, ry: 33, ph: 2.1 });
  const bridge = wide ? { x: ponds[1].cx + 18, y: 178, hw: 34, rise: 15 } : { x: 268, y: 175, hw: 27, rise: 12 };
  return {
    rw, ox, L, RT, wide, ponds, bridge,
    m2: L <= -112 ? { x: -96, y: 170 } : null,   // a second maple, gold, out on the left
    stones: L <= -70,            // the stepping-stone path through the moss garden
    rock: L <= -170 ? -186 : null,   // raked gravel round a rock, far out on the left
  };
}
// how far inside the pond a point is: > 0 in the water, 1 at a lobe's middle
function pondQ(G, x, y) {
  let sum = 0, one = -1;
  for (const p of G.ponds) {
    const dx = (x - p.cx) / p.rx, dy = (y - p.cy) / p.ry, th = Math.atan2(dy, dx);
    const wob = 1 + 0.055 * Math.sin(3 * th + p.ph) + 0.035 * Math.sin(5 * th + 2 * p.ph) + 0.02 * Math.sin(9 * th + p.ph * 3);
    one = Math.max(one, 1 - sq(dx, dy) / wob);
    sum += Math.exp(9 * (1 - sq(dx, dy) / wob));
  }
  return G.ponds.length > 1 ? Math.log(sum) / 9 : one;   // lobes melt into one another, no sharp cusp where they meet
}
const bridgeY = (B, x) => B.y - Math.round(B.rise * Math.max(0, 1 - ((x - B.x) / B.hw) ** 2));

// the light reaching each point, in three parts: shade-light (the sky), sun, the lantern
function shadeAt(G, x, y) {
  let s = 0;
  if (y > 140 && y < 262) {
    const wet = pondQ(G, x, y) > 0;
    const tree = (cx, cy, rx, ry, k) => {
      const d = sq((x - cx) / rx, (y - cy) / ry);
      if (d < 1) s = Math.max(s, k * (wet ? 0.3 : 1) * Math.min(1, (1 - d) * 3) * (vnoise(x / 6 + cx, y / 3.5) > 0.56 ? 0.2 : 0.55));
    };
    tree(MAPLE.x + 46, 196, 100, 32, 1);
    if (G.m2) tree(G.m2.x + 34, 190, 72, 24, 1);
    // the lantern's long shadow, thrown towards the front left by the low sun
    const vx = -34, vy = 24, u = clamp(((x - TORO.x) * vx + (y - TORO.y) * vy) / (vx * vx + vy * vy), 0, 1);
    if (!wet && sq(x - TORO.x - vx * u, y - TORO.y - vy * u) < 4 - u * 2) s = Math.max(s, 0.5 * (1 - u * 0.4));
    const B = G.bridge;
    if (Math.abs(x - B.x) < B.hw && y > bridgeY(B, x) + 3 && y < bridgeY(B, x) + 12 - Math.abs(x - B.x) * 0.1) s = Math.max(s, 0.55);
  }
  return s;
}
function fieldsFor(G) {
  const { rw, ox } = G, n = rw * H, F = { rw, A: new Float32Array(n), S: new Float32Array(n), L: new Float32Array(n) };
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < rw; X++) {
      const x = X - ox, j = y * rw + X;
      let a = 1, s;
      if (y < 14) { a = 0.5; s = 0.05; }
      else if (y >= ENG) {
        // under the eaves; the low sun reaches in, slanting across the boards from the right
        a = 0.7 - (y - ENG) * 0.003;
        s = Math.max(0.55, clamp((x - (y - ENG) * 0.9 - 112) / 30, 0, 1) * 0.9);
      } else {
        s = (y < 122 ? 0.88 : 1) - shadeAt(G, x, y);
        if (y > 122) a = 0.95;
        if (y > 150 && y < 262 && pondQ(G, x, y) > 0.02) { s *= 0.3; a = 1.1; }   // the water takes the sky's light more than the sun's
      }
      s *= 0.84 + 0.16 * clamp((x - G.L) / (G.RT - G.L), 0, 1);
      if (x < G.L + 12 || x >= G.RT - 12) { a = 0.62; s = 0.5; }   // the posts, under the roof like the boards
      const vx = (x - 160) / (rw / 2 + 80), vy = (y - 170) / 300;
      a *= 1 - Math.min(0.3, (vx * vx + vy * vy) * 0.45);
      let l = Math.max(0, 1 - sq(x - TORO.x, (y - 134) * 1.1) / 92) ** 1.7 * 1.05;
      if (y > 166 && y < 236 && Math.abs(x - TORO.x) < 9) l += 0.3 * (1 - Math.abs(x - TORO.x) / 9) * (1 - (y - 166) / 70);   // its light held in the water
      F.A[j] = a; F.S[j] = s; F.L[j] = y >= ENG ? l * 0.4 : l;
    }
  }
  return F;
}

/* ——— the sky, by the hour: not lit by the ramps but painted in its own colours ——— */
const SKY = [
  [0x7aa9c6, 0x8db5c8, 0xa2bfc6, 0xbdcabd, 0xd6d1aa, 0xe8d196, 0xf1cb82],
  [0x6690b8, 0x83a0bc, 0xa6abb2, 0xc9b39e, 0xe1b686, 0xedb470, 0xf3ad5c],
  [0x4d5f92, 0x6a6a9c, 0x92779c, 0xbc8594, 0xdb9480, 0xec9c66, 0xf29a50],
];
const CLOUD = [[0xe9e0cc, 0xf6ecd4, 0xc9b9a6], [0xf0d2b0, 0xfbe2be, 0xc4a094], [0xe8a890, 0xf6c49a, 0x9a7088]];
const HILLS = [[0x8ea6b4, 0x7a93a4], [0xa49aa8, 0x8a8698], [0x8a7896, 0x6e6486]];
function paintSky(G, st) {
  const R = new Ras(G.rw, 132, G.ox, 0), cols = SKY[st], L = G.L - 2, W = G.RT - G.L + 4;
  R.vgrad(L, 0, W, 112, cols);
  R.rect(L, 112, W, 20, cols[cols.length - 1]);
  // long thin clouds lying low, lit from beneath by the sun
  const r = rng(17), [mid, lit, dark] = CLOUD[st];
  for (let i = 0; i < Math.round(W / 46); i++) {
    const cx = L + r() * W, cy = 26 + r() * 50, len = 18 + r() * 46, th = 1 + r() * 2.2;
    for (let x = Math.floor(cx - len); x < cx + len; x++) {
      const u = (x - cx) / len, hh = Math.round(th * Math.sqrt(Math.max(0, 1 - u * u)) * (0.75 + 0.5 * vnoise(x / 6, i)));
      for (let k = -hh; k <= hh; k++) {
        const y = Math.round(cy + k + Math.sin(x * 0.05 + i) * 1.5);
        R.px(x, y, k === hh ? lit : k < -hh + 1 ? dark : mid, k === hh ? 0.9 : 0.6);
      }
    }
  }
  // far hills, faint in the haze between the trees
  const [h1, h2] = HILLS[st];
  for (let x = L; x < L + W; x++) {
    const a = 74 + Math.round(Math.sin(x * 0.021 + 1) * 7 + Math.sin(x * 0.053) * 3);
    const b = 84 + Math.round(Math.sin(x * 0.031 + 4) * 5 + Math.sin(x * 0.09) * 2);
    for (let y = a; y < 132; y++) R.px(x, y, y > a + 1 || bay(x, y) < 0.5 ? mixc(h1, cols[5], 0.35) : cols[5]);
    for (let y = b; y < 132; y++) R.px(x, y, h2);
  }
  return R.canvas();
}

/* ——— leaves in clumps: a crown made of round lobes, lit from the upper right ——— */
function foliage(R, blobs, pal, seed = 1, o = {}) {
  const lx = o.lx ?? 0.6, ly = o.ly ?? -0.8, rough = o.rough ?? 0.14, n = pal.length - 1;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const b of blobs) { x0 = Math.min(x0, b[0] - b[2]); x1 = Math.max(x1, b[0] + b[2]); y0 = Math.min(y0, b[1] - b[2]); y1 = Math.max(y1, b[1] + b[2]); }
  for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
    let best = 0, bb = null;
    for (const b of blobs) { const q = 1 - sq(x - b[0], (y - b[1]) * (b[3] || 1)) / b[2]; if (q > best) { best = q; bb = b; } }
    if (!bb) continue;
    if (best < rough && vnoise(x / 2.1 + seed * 3, y / 2.1 + seed) < 0.55 - best * 2) continue;   // a ragged, leafy edge
    const nx = (x - bb[0]) / bb[2], ny = ((y - bb[1]) * (bb[3] || 1)) / bb[2];
    let v = 0.42 + (o.g ? 0.3 : 0.55) * (nx * lx + ny * ly) + (vnoise(x / 3.2 + seed * 7, y / 2.6 + seed) - 0.5) * 0.85;
    if (o.g) v += 0.42 * (((x - o.g[0]) / o.g[2]) * lx + ((y - o.g[1]) / o.g[3]) * ly);
    if (vnoise(x / 6 + seed, y / 5 + seed * 2) < 0.3) v -= 0.25;   // pockets of shade between the clumps
    v += o.lift ?? 0;
    R.px(x, y, pal[clamp(band(clamp(v, 0, 1) * n, x, y), 0, n)]);
  }
}

const TREES = [0x1d3024, 0x27412d, 0x325337, 0x416a3f, 0x5a844a, 0x7d9f58];
const CEDAR = [0x1a2b24, 0x22382c, 0x2d4a35, 0x3d5f3c, 0x5a7c48];
const MOSS = [0x2c4426, 0x37532c, 0x446436, 0x54753e, 0x678948, 0x7e9e54];

// the trees beyond the wall: round crowns and tall cedars, lower where the sun goes down
function paintTrees(R, G) {
  for (let i = -30, x = G.L - 20; x < G.RT + 30; i++) {
    const r = rng(1000 + i * 31), w = 22 + Math.floor(r() * 26);
    const cx = x + w / 2, sunGap = Math.abs(cx - 246) < 24;
    if (r() < 0.32 && !sunGap) {
      // a cedar: a tall cone in tiers
      const top = 26 + Math.floor(r() * 16), hw = 9 + r() * 5;
      for (let y = top; y < WALL; y++) {
        const u = (y - top) / (WALL - top), tier = ((y - top) % 9) / 9;
        const half = Math.round(hw * Math.min(1, u * 1.4) * (0.7 + 0.3 * tier) + (hash(y, i) < 0.3 ? 1 : 0));
        for (let k = -half; k <= half; k++) {
          const lit = k / Math.max(1, half) * 0.6 - tier * 0.5 + 0.5 + (hash(cx + k, y) - 0.5) * 0.4;
          R.px(Math.round(cx + k), y, CEDAR[clamp(band(clamp(lit, 0, 0.99) * 4, Math.round(cx + k), y), 0, 4)]);
        }
      }
      R.line(Math.round(cx), top - 4, Math.round(cx), top, CEDAR[2]);
    } else {
      const top = sunGap ? 74 + Math.floor(r() * 8) : 38 + Math.floor(r() * 26), blobs = [];
      for (let k = 0; k < 5; k++) blobs.push([cx + (r() - 0.5) * w, top + 8 + r() * 12 + k * 4, 9 + r() * 9, 1.15]);
      blobs.push([cx, WALL - 6, w * 0.5, 1.3]);
      foliage(R, blobs, TREES, i + 3);
    }
    x += w * (0.55 + r() * 0.3);
  }
}

// the garden wall: a little roof of tiles over warm plaster on a course of stone
function paintWall(R, G) {
  const L = G.L, W = G.RT - G.L;
  R.rect(L, WALL - 9, W, 1, 0x56606a); R.rect(L, WALL - 8, W, 1, 0x6e7884);
  for (let x = L; x < G.RT; x++) {
    for (let y = WALL - 7; y < WALL - 2; y++) R.px(x, y, (x & 3) === 0 ? 0x313841 : y === WALL - 7 ? 0x55606b : 0x434b55);
    const m = ((x % 5) + 5) % 5;
    R.px(x, WALL - 2, m === 4 ? 0x2c3239 : 0x4c5560); R.px(x, WALL - 1, m === 0 || m === 4 ? 0x2c3239 : m === 2 ? 0x6a7480 : 0x56606b);
  }
  for (let y = WALL; y < 118; y++) for (let x = L; x < G.RT; x++) {
    const v = vnoise(x / 9, y / 4) + (y < WALL + 3 ? -0.35 : 0);
    R.px(x, y, v < 0.32 ? 0xbcae94 : v > 0.7 ? 0xd8ccb2 : 0xcbbea4);
  }
  for (let x = L; x < G.RT; x++) {
    const m = ((x % 58) + 58) % 58;
    if (m < 3) for (let y = WALL; y < 118; y++) R.px(x, y, m === 2 ? 0x7a6450 : m === 0 ? 0x3a2c22 : 0x5a4636);
    R.px(x, 111, 0x5a4636); R.px(x, 112, 0x7a6450); R.px(x, 113, 0x3e3026);
  }
  for (let y = 118; y < 124; y++) for (let x = L; x < G.RT; x++) {
    const row = y < 121 ? 0 : 1, m = (((x + row * 7) % 13) + 13) % 13;
    R.px(x, y, y === 118 || y === 121 || m === 0 ? 0x5e584c : hash(x >> 2, y) < 0.3 ? 0x8a8270 : 0x7c7564);
  }
}

// a bamboo fence in front of the wall (full screen): split canes bound to two rails with black cord
function paintFence(R, x0, x1) {
  for (let x = x0; x < x1; x++) {
    const m = ((x % 3) + 3) % 3, top = 101 + (hash(x >> 1, 7) < 0.4 ? 1 : 0);
    for (let y = top; y < 132; y++) {
      const node = ((y + (x >> 1) * 5) % 13) === 0;
      R.px(x, y, m === 2 ? 0x6e5c34 : node ? 0x8e7a46 : m === 0 ? 0xc8b276 : 0xae9a5e);
    }
  }
  for (const ry of [107, 123]) {
    R.rect(x0, ry, x1 - x0, 2, 0x8a7444); R.rect(x0, ry, x1 - x0, 1, 0xb49c62);
    for (let x = x0 + 3; x < x1; x += 9) { R.rect(x, ry - 1, 2, 4, 0x2a2420); R.px(x, ry - 1, 0x4a3e34); }
  }
  R.rect(x0, 100, x1 - x0, 2, 0x7a6640); R.rect(x0, 100, x1 - x0, 1, 0xa48c58);
}

function paintGround(R, G) {
  for (let y = 120; y < ENG; y++) for (let x = G.L; x < G.RT; x++) {
    const v = 2.3 + (vnoise(x / 5, y / 3) - 0.5) * 2.2 + (vnoise(x / 1.6, y / 1.2) - 0.5) * 0.9 + (y - 190) / 140;
    R.px(x, y, MOSS[clamp(band(v, x, y), 0, 5)]);
  }
}
// raked gravel: lines along the length, curving in rings round a stone
function paintGravel(R, x0, x1, y0, y1, rocks, edge) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (edge && !edge(x, y)) continue;
    let ring = -1;
    for (const [rx, ry, rr] of rocks) { const d = sq(x - rx, (y - ry) * 2.1); if (d < rr + 14) ring = Math.max(ring, d - rr); }
    const wy = y - y0 + Math.round(Math.sin(x * 0.06 + y * 0.1) * 0.8);
    const line = ring >= 0 ? Math.floor(ring) % 4 === 0 : wy % 3 === 0;
    const lit = ring >= 0 ? Math.floor(ring) % 4 === 1 : wy % 3 === 1;
    const h = hash(x, y);
    R.px(x, y, line ? 0x9c9684 : lit ? 0xd6d0be : h < 0.1 ? 0xa8a290 : h > 0.94 ? 0xdcd6c6 : 0xc2bca9);
  }
}
// a clipped hedge along the foot of the wall, in tight rounded lobes
const HEDGE = [0x1a2e22, 0x233c2a, 0x2e4e32, 0x3c623a, 0x507a44];
function paintHedge(R, G) {
  const blobs = [];
  for (let x = G.L - 12; x < G.RT + 12; x += 8) blobs.push([x, 128 + Math.sin(x * 0.07) * 2 + hash(x, 1) * 2, 8 + hash(x, 2) * 3, 1.6]);
  foliage(R, blobs, HEDGE, 21, { rough: 0.08, g: [(G.L + G.RT) / 2, 126, (G.RT - G.L) / 2, 10] });
}
// a cloud-pruned pine: a twisting trunk and flat pads of needles
const PINE = [0x15281e, 0x1f3826, 0x2a4a2e, 0x386038, 0x4e7a44];
function paintPine(R, x, y) {
  for (let j = 0; j < 44; j++) { const cx = x + Math.round(Math.sin(j * 0.09) * 6), w = j < 30 ? 2 : 1; for (let k = -w; k <= w; k++) R.px(cx + k, y - j, k === w ? 0x7a6252 : k === -w ? 0x2e2420 : 0x4e3e34); }
  R.line(x + 4, y - 20, x - 12, y - 24, 0x3e3028); R.line(x + 5, y - 28, x + 16, y - 31, 0x3e3028); R.line(x - 2, y - 36, x - 9, y - 39, 0x3e3028);
  for (const [px, py, rx, ry] of [[x - 14, y - 26, 11, 4], [x + 16, y - 33, 11, 4], [x - 8, y - 41, 9, 3.5], [x + 4, y - 49, 8, 3.5]]) {
    for (let yy = -Math.ceil(ry); yy <= ry; yy++) for (let xx = -rx - 1; xx <= rx + 1; xx++) {
      const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
      if (d > 1 + (hash(px + xx, py + yy) - 0.5) * 0.5) continue;
      const v = 2.4 - (yy / ry) * 1.6 + (xx / rx) * 0.6 + (vnoise((px + xx) / 2, (py + yy) / 1.5) - 0.5) * 1.6;
      R.px(px + xx, py + yy, PINE[clamp(band(v, px + xx, py + yy), 0, 4)]);
    }
  }
}
// a clump of hakone grass: fine blades arching over to one side, gold-green
function grass(R, x, y, n, seed, dir = 1) {
  for (let k = 0; k < n; k++) {
    const h = hash(k, seed), len = 8 + Math.floor(h * 8), bx = x + Math.round((k - n / 2) * 0.8), lean = dir * (0.5 + h * 0.9);
    for (let j = 0; j < len; j++) {
      const u = j / len, xx = Math.round(bx + lean * j * u * 1.1), yy = Math.round(y - j * (1 - u * 0.75));
      R.px(xx, yy, [0x4e6a26, 0x6e8c2e, 0x96ac3e, 0xc0c656][clamp(Math.floor(u * 3 + h), 0, 3)]);
    }
  }
}
// a mossy stone: rounded, lit from the upper right, a cap of moss on top
function stone(R, cx, cy, rx, ry, moss = 0.5, cols = [0x5a564c, 0x77726a, 0x948e82, 0xb0aa9a]) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = (x * x) / ((rx + 0.5) ** 2) + (y * y) / ((ry + 0.5) ** 2);
    if (d > 1) continue;
    const nx = x / rx, ny = y / ry;
    let v = 1.4 + nx * 1.1 - ny * 1.3 + (hash(cx + x, cy + y) - 0.5) * 0.6;
    if (d > 0.82 && ny > 0) v -= 0.8;
    let c = cols[clamp(band(v, cx + x, cy + y), 0, 3)];
    if (ny < -0.15 + (vnoise((cx + x) / 3, (cy + y) / 2) - 0.5) * 0.9 && moss > hash(cx + x, cy + y + 9) * 0.6) c = MOSS[clamp(band(2.6 + nx * 1.2 - ny, cx + x, cy + y), 1, 5)];
    R.px(cx + x, cy + y, c);
  }
}

/* ——— things in the garden ——— */
const STONE = [0x57534a, 0x77716a, 0x968f80, 0xb6ae9b];
// the stone lantern (a kasuga toro): base, pillar, platform, the light box, its roof and jewel
function paintToro(R) {
  const X = TORO.x, Y = TORO.y;
  const slab = (y0, h, hw, tl = 0) => { for (let y = y0; y < y0 + h; y++) { const w = hw + Math.round(tl * (y - y0)); for (let x = -w; x <= w; x++) R.px(X + x, y, x >= w - 1 ? STONE[3] : x <= -w + 1 ? STONE[0] : y === y0 ? STONE[3] : STONE[2]); } };
  slab(Y - 4, 4, 10); slab(Y - 7, 3, 8); R.rect(X - 10, Y - 1, 21, 1, STONE[0]);
  for (let y = Y - 25; y < Y - 7; y++) for (let x = -3; x <= 3; x++) R.px(X + x, y, x === 3 ? STONE[3] : x === -3 ? STONE[0] : x > 0 ? STONE[2] : STONE[1]);
  R.rect(X - 4, Y - 17, 9, 2, STONE[2]); R.rect(X - 4, Y - 16, 9, 1, STONE[1]);
  slab(Y - 30, 2, 6, 1); slab(Y - 28, 3, 8);
  // the light box: four corner posts, the window (filled each frame), a lattice band
  for (let y = Y - 41; y < Y - 30; y++) for (let x = -6; x <= 6; x++) R.px(X + x, y, Math.abs(x) >= 5 ? (x > 0 ? STONE[3] : STONE[0]) : STONE[1]);
  R.clear(X - 3, Y - 39, 7, 7);
  R.rect(X - 4, Y - 32, 9, 1, STONE[0]);
  // the roof: wide, sloping, its corners turned up
  for (let y = Y - 49; y < Y - 41; y++) {
    const u = (y - (Y - 49)) / 7, w = Math.round(3 + u * 10);
    for (let x = -w; x <= w; x++) R.px(X + x, y, y === Y - 42 ? STONE[0] : x > w * 0.3 ? STONE[3] : x < -w * 0.5 ? STONE[1] : STONE[2]);
  }
  R.px(X - 14, Y - 44, STONE[2]); R.px(X + 14, Y - 44, STONE[3]); R.px(X - 14, Y - 43, STONE[1]); R.px(X + 14, Y - 43, STONE[2]);
  for (let x = -12; x <= 12; x++) if (vnoise((X + x) / 2.5, 3) > 0.55) R.px(X + x, Y - 45 - (Math.abs(x) < 6 ? 1 : 0), MOSS[3]);
  R.rect(X - 2, Y - 51, 5, 2, STONE[2]); R.rect(X - 1, Y - 54, 3, 3, STONE[2]); R.px(X + 1, Y - 53, STONE[3]); R.px(X, Y - 55, STONE[3]);
}
// the arched bridge: a vermilion rail on posts over a curved deck of boards
function paintBridge(R, B) {
  const x0 = B.x - B.hw, x1 = B.x + B.hw;
  for (const sx of [-0.62, 0.62]) { const lx = Math.round(B.x + sx * B.hw); R.rect(lx - 1, bridgeY(B, lx) + 3, 3, 12, 0x3e2a1e); R.px(lx + 1, bridgeY(B, lx) + 3, 0x5a3e2a); }
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    const y = bridgeY(B, clamp(x, x0, x1));
    R.px(x, y, 0xd6aa74); R.px(x, y + 1, (x & 3) ? 0xb48656 : 0x8a6440); R.px(x, y + 2, 0x6a4a2e); R.px(x, y + 3, 0x4a3220);
    const arch = B.y + 6 - Math.round((B.rise + 3) * Math.max(0, 1 - ((x - B.x) / (B.hw + 2)) ** 2));
    for (let yy = Math.max(y + 4, arch); yy <= arch + 1 && yy < y + 12; yy++) R.px(x, yy, 0x8a3424);
  }
  // the rails: the far one first, a little higher and in shadow
  for (const [dy, c0, c1] of [[-2, 0x7a2c1e, 0x98402a], [0, 0xa83c26, 0xd65c40]]) {
    for (let x = x0; x <= x1; x++) { const y = bridgeY(B, x) + dy; R.px(x, y - 7, c1); R.px(x, y - 6, c0); R.px(x, y - 3, c0); }
    for (let x = x0; x <= x1; x += 8) { const y = bridgeY(B, x) + dy; R.rect(x, y - 7, 2, 7, c0); R.px(x + 1, y - 7, c1); }
    for (const ex of [x0, x1]) { const y = bridgeY(B, ex) + dy; R.rect(ex - 1, y - 9, 3, 9, c0); R.px(ex, y - 11, 0xb89a4a); R.rect(ex - 1, y - 10, 3, 1, 0xa0863e); R.px(ex + 1, y - 9, c1); }
  }
}
// a clipped azalea mound in flower
function azalea(R, cx, cy, r, seed) {
  const AZ = [0x1f3a26, 0x2a4c30, 0x3a623a, 0x4f7a46, 0x6a9450];
  foliage(R, [[cx, cy, r, 1.5], [cx - r * 0.5, cy + 2, r * 0.7, 1.4], [cx + r * 0.55, cy + 2, r * 0.65, 1.4]], AZ, seed, { rough: 0.1 });
  for (let y = Math.floor(cy - r / 1.5); y < cy + r / 1.5; y++) for (let x = Math.floor(cx - r * 1.2); x < cx + r * 1.2; x++) {
    const i = R.at(x, y); if (i < 0 || !R.d[i + 3]) continue;
    const g = R.d[i + 1];
    if (hash(x * 3, y * 5 + seed) < 0.3 && vnoise(x / 2, y / 2 + seed) > 0.42 && g > 0x3a) R.px(x, y, g > 0x70 ? 0xf88ab4 : g > 0x55 ? 0xe2508a : 0xb03068);
  }
}
// the stone basin, its stones and the ladle resting on it
function paintBasin(R) {
  const X = BASIN.x, Y = BASIN.y;
  stone(R, X - 23, Y + 13, 7, 5, 0.7); stone(R, X + 25, Y + 15, 7, 5, 0.6); stone(R, X + 2, Y + 21, 14, 3, 0.4, [0x6a655a, 0x8a8476, 0xa8a090, 0xc4bca8]);
  stone(R, X, Y + 7, 15, 9, 0.5);
  R.ell(X, Y, 14, 4, 0xa8a090); R.ell(X, Y + 1, 13, 3, 0x6e695c); R.rect(X - 13, Y - 4, 27, 1, 0xc0b8a6);
  R.ell(X, Y + 1, 10, 2, 0x2a5256); R.rect(X - 8, Y + 1, 16, 1, 0x34646a); R.rect(X + 2, Y, 5, 1, 0x86b6b4); R.px(X - 4, Y + 2, 0x5a8a8a);
  R.line(X - 17, Y - 4, X + 8, Y - 6, 0xd8b878); R.line(X - 17, Y - 3, X + 8, Y - 5, 0x9a7a44);
  R.rect(X + 7, Y - 9, 6, 5, 0xb08c50); R.rect(X + 7, Y - 9, 6, 1, 0xe0c088); R.rect(X + 12, Y - 8, 1, 4, 0x7a5a30);
}
// the reeds' and irises' feet at the water's edge (the reeds themselves sway, drawn each frame)
function paintIris(R, x, y, n, seed) {
  for (let k = 0; k < n; k++) {
    const h = 7 + Math.floor(hash(k, seed) * 8), lean = (hash(k + 9, seed) - 0.5) * 6, bx = x + k * 2 - n;
    for (let j = 0; j < h; j++) R.px(Math.round(bx + (lean * j) / h), y - j, j > h - 3 ? 0x7aa858 : (k & 1) ? 0x3e6e36 : 0x548a42);
  }
  if (seed % 2) { R.px(x - 1, y - 12, 0x7a5ad0); R.px(x, y - 13, 0x9a7ae8); R.px(x, y - 12, 0xe8d860); R.px(x + 1, y - 12, 0x6a4ac0); }
}

// the water: depth in bands, a pebbled edge, and the garden held upside down in it
const WATER = [0x64a28e, 0x4e9086, 0x3e7c7e, 0x2f6870, 0x255664, 0x1d4656];
function paintWater(R, G, near, far) {
  const { rw, ox } = G, top = new Int16Array(rw).fill(-1), q = new Float32Array(rw * H);
  for (let X = 0; X < rw; X++) for (let y = 150; y < 262; y++) { const v = pondQ(G, X - ox, y); q[y * rw + X] = v; if (v > 0 && top[X] < 0) top[X] = y; }
  const sky = SKY[1];
  const out = [];
  for (let y = 150; y < 262; y++) for (let X = 0; X < rw; X++) {
    const v = q[y * rw + X];
    if (v <= 0) continue;
    const x = X - ox, yb = top[X], dy = y - yb;
    let c = WATER[clamp(band(v * 6.2 - 0.2, x, y), 0, 5)];
    if (v < 0.03) { out.push(x, y, 0x2e3c30); continue; }
    // what is mirrored here: the bank, the lantern, the bridge, the maple, the trees, the sky
    // (things near the water mirrored about their own feet, the far trees and wall about the wall's)
    const wob = Math.round(Math.sin(y * 0.9 + x * 0.04) * 1.2), sx = x + wob;
    let m = near.get(sx, yb - 1 - Math.round(dy * 1.15));
    if (m < 0) { const fy = 121 - Math.round(dy * 1.3); m = far.get(sx, fy); if (m < 0) m = fy < 0 ? sky[0] : sky[clamp(Math.floor((fy / 112) * 6), 0, 6)]; }
    const nr = (y - G.ponds[0].cy + G.ponds[0].ry) / (2 * G.ponds[0].ry);
    const w = (0.74 - clamp(nr, 0, 1) * 0.36) * (v < 0.14 ? 0.6 : 1);
    c = mixc(c, mixc(m, 0x183a46, 0.3), Math.round(w * 6) / 6);
    // the pebbled bottom, seen through the shallows
    if (v < 0.16) {
      const px = Math.floor(x / 2) + ((y & 1) ? 1 : 0), h = hash(px, Math.floor(y / 1.5) * 7);
      if (h < 0.55) c = mixc(c, [0xa49a7c, 0xbcb090, 0x847e6a, 0xcabe9c][Math.floor(h * 7.27) & 3], 0.45 * (1 - v / 0.2));
    }
    // a sheen of light lying along the water in thin streaks
    if ((y + (x >> 4)) % 6 === 0 && hash(x >> 2, y) < 0.45) c = mixc(c, 0xe0eef0, 0.22);
    out.push(x, y, c);
  }
  for (let i = 0; i < out.length; i += 3) R.px(out[i], out[i + 1], out[i + 2]);
  // the far bank's lip just above the water, the near bank's mossy overhang just below
  for (let X = 0; X < rw; X++) {
    const x = X - ox;
    if (top[X] > 0) { R.px(x, top[X] - 1, 0x4e4636); if (hash(x, 3) < 0.6) R.px(x, top[X] - 2, 0x645a46); }
    for (let y = 261; y > 150; y--) if (q[y * rw + X] > 0) { R.px(x, y + 1, MOSS[0]); if (hash(x, 5) < 0.5) R.px(x, y, MOSS[1]); break; }
  }
  return { q, top };
}
// stones along the rim, except where the basin, the reeds and the bridge's feet are
function rimStones(R, G) {
  for (const [pi, p] of G.ponds.entries()) {
    for (let th = 0; th < Math.PI * 2; th += 0.11 + hash(pi, Math.round(th * 100)) * 0.08) {
      const wob = 1 + 0.055 * Math.sin(3 * th + p.ph) + 0.035 * Math.sin(5 * th + 2 * p.ph) + 0.02 * Math.sin(9 * th + p.ph * 3);
      const x = Math.round(p.cx + Math.cos(th) * p.rx * wob), y = Math.round(p.cy + Math.sin(th) * p.ry * wob);
      if (G.ponds.some((o, oi) => oi !== pi && pondQ({ ponds: [o] }, x, y) > -0.06)) continue;
      if ((x > 34 && x < 92 && y > 222) || (x > 252 && x < 290 && y > 214 && y < 244) || Math.abs(x - G.bridge.x) > G.bridge.hw - 6 && Math.abs(x - G.bridge.x) < G.bridge.hw + 6 && y < 190) continue;
      const h = hash(x, y), back = y < p.cy;
      stone(R, x, y + (back ? -1 : 1), 3 + Math.floor(h * 5) - (back ? 1 : 0), 2 + Math.floor(h * 2.5), 0.6);
    }
  }
}

// a maple's trunk and its main limbs, lit from the right
function paintTrunk(R, x0, y0, k, seed) {
  const limbs = [
    [[0, 0], [3, -20], [9, -40], [20, -58], [38, -76], [62, -88]],
    [[9, -40], [-4, -60], [-16, -82]],
    [[20, -58], [44, -66], [80, -74]],
    [[3, -20], [-10, -34], [-26, -44]],
  ];
  limbs.forEach((pts, li) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.ceil(sq(bx - ax, by - ay) * k);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = x0 + (ax + (bx - ax) * u) * k, y = y0 + (ay + (by - ay) * u) * k;
        const w = Math.max(1, Math.round((li ? 2.6 : 4.4) * k * (1 - (s + u) / (pts.length + 1)) + 0.4));
        for (let dx = -w; dx <= w; dx++) R.px(Math.round(x + dx), Math.round(y), dx >= w - 1 ? 0x8a6a52 : dx <= -w + 1 ? 0x3a2a24 : hash(Math.round(x + dx), Math.round(y) + seed) < 0.2 ? 0x6e5646 : 0x56443a);
      }
    }
  });
  for (let dx = -7; dx <= 8; dx++) R.px(x0 + dx, y0 + (Math.abs(dx) > 4 ? 0 : 1), dx > 2 ? MOSS[3] : MOSS[1]);   // roots in the moss
}
// a maple's crown: tiers of leaves, crimson in shade to orange-gold where the sun catches it
const MAPLE_RED = [0x3e0e16, 0x5c161c, 0x7e1e1e, 0xa02a20, 0xc03c22, 0xd85a28, 0xec8a3a];
const MAPLE_GOLD = [0x5a2c12, 0x7e4016, 0xa45a1a, 0xc87a20, 0xe09c2c, 0xf0c050, 0xf8dc84];
const CROWN = [[-4, 42, 28], [24, 28, 32], [58, 22, 30], [92, 30, 28], [120, 48, 22], [140, 68, 15], [42, 56, 28], [78, 62, 26], [108, 74, 18], [10, 70, 22], [-18, 62, 16], [58, 84, 16], [28, 88, 14], [126, 88, 10], [90, 92, 11]];
function paintCrown(S, x0, y0, k, sway, pal, seed) {
  const blobs = CROWN.map(([x, y, r]) => [x0 + x * k + sway * (1.6 - y / 70), y0 + y * k, r * k, 1.35]);
  foliage(S, blobs, pal, seed, { rough: 0.12, lift: 0.02, g: [x0 + 70 * k, y0 + 50 * k, 95 * k, 55 * k] });
  // single leaves at the fringe, a few in flight-ready silhouettes
  const r = rng(seed * 13 + 5);
  for (let i = 0; i < 70 * k; i++) {
    const b = blobs[Math.floor(r() * blobs.length)], a = r() * Math.PI * 2, d = b[2] * (0.9 + r() * 0.3);
    const x = Math.round(b[0] + Math.cos(a) * d), y = Math.round(b[1] + (Math.sin(a) * d) / 1.35), c = pal[Math.cos(a) > 0.2 && Math.sin(a) < 0.3 ? 5 : 3];
    S.px(x, y, c); S.px(x - 1, y, c); S.px(x + 1, y, c); S.px(x, y - 1, c); if (r() < 0.5) S.px(x, y + 1, pal[2]);
  }
}
// a grove of bamboo: green canes with pale nodes, sprays of narrow leaves that lean with the wind
const CANE = [0x3e6430, 0x5e8a42, 0x86ac58, 0xb2cc78];
const BLEAF = [0x23422a, 0x2f5a30, 0x447a3a, 0x62984a, 0x86b45c];
function paintBamboo(S, xs, sway) {
  xs.forEach((x0, i) => {
    const yb = 150 + (i % 3) * 5, lean = (hash(i, 31) - 0.5) * 8, wd = i % 2 ? 2 : 3;
    const at = (y) => x0 + (lean * (yb - y)) / 150 + sway * ((yb - y) / 150) ** 2 * 3;
    for (let y = 12; y < yb; y++) {
      const x = Math.round(at(y)), node = (y + i * 5) % 17;
      for (let k = 0; k < wd; k++) S.px(x + k, y, node === 0 ? CANE[0] : node === 1 ? CANE[3] : k === wd - 1 ? CANE[2] : k === 0 ? CANE[0] : CANE[1]);
    }
  });
  xs.forEach((x0, i) => {
    const yb = 150 + (i % 3) * 5, lean = (hash(i, 31) - 0.5) * 8;
    const at = (y) => x0 + (lean * (yb - y)) / 150 + sway * ((yb - y) / 150) ** 2 * 3;
    for (let y = 16 + (i % 3) * 5; y < 104; y += 13) {
      const side = ((y / 17) | 0) % 2 ? 1 : -1, cx = at(y) + side * 6;
      foliage(S, [[cx, y + 2, 3.5 + hash(i, y) * 2, 1.4]], BLEAF, i * 7 + y, { rough: 0.3, lx: 0.7, ly: -0.6 });
      for (let b = 0; b < 7; b++) {
        const h = hash(i * 13 + b, y), ang = 0.15 + b * 0.22 + h * 0.2, len = 7 + Math.floor(h * 6), bx = cx + side * (b - 3), by = y + 1 + (b & 1);
        const dir = b < 3 ? -side : side;
        for (let j = 0; j < len; j++) {
          const xx = Math.round(bx + Math.cos(ang) * j * dir), yy = Math.round(by + Math.sin(ang) * j * 0.7 + (j * j) / (len * 2.2));
          S.px(xx, yy, j === 0 || j > len - 3 ? BLEAF[1] : h < 0.4 ? BLEAF[4] : BLEAF[3]);
          if (j > 1 && j < len - 2 && h > 0.5) S.px(xx, yy + 1, BLEAF[2]);
        }
      }
    }
  });
}
// the cat, a calico: curled asleep (breathing in three steps), or stretching out with a yawn
const FUR = [0x8e8278, 0xc4b8ac, 0xe6ddd0, 0xfaf3e8], BLACK = [0x1e1c1a, 0x2e2a28, 0x46403a], GINGER = [0x94501e, 0xc4743a, 0xe09a5a];
function paintCat(S, pose, breath) {
  const X = CAT.x, Y = CAT.y;
  const shadeEll = (cx, cy, rx, ry, patch) => {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const d = (x * x) / ((rx + 0.5) ** 2) + (y * y) / ((ry + 0.5) ** 2);
      if (d > 1) continue;
      const v = 1.6 + (x / rx) * 0.9 - (y / ry) * 1.2 - (d > 0.75 && y > 0 ? 0.9 : 0), px = Math.round(cx + x), py = Math.round(cy + y);
      const p = patch ? patch(px - X, py - Y) : 0, pal = p === 1 ? BLACK : p === 2 ? GINGER : FUR;
      S.px(px, py, pal[clamp(band(v * (pal.length - 1) / 3, px, py), 0, pal.length - 1)]);
    }
  };
  const coat = (x, y) => (sq(x - 30, (y - 9) * 1.4) < 7 ? 1 : sq(x - 18, (y - 10) * 1.6) < 5 ? 2 : sq(x - 40, y - 14) < 4 ? 2 : 0);
  if (pose === 0) {
    S.rect(X + 6, Y + 21, 34, 2, 0x5e3e26); S.rect(X + 10, Y + 23, 26, 1, 0x7a5232);
    shadeEll(X + 25, Y + 15 - breath * 0.5, 15, 6 + breath * 0.5, coat);
    // the tail, wrapped round the front
    for (let k = 0; k <= 26; k++) { const u = k / 26, tx = X + 39 - u * 30, ty = Y + 19 + Math.sin(u * Math.PI) * 2; S.px(Math.round(tx), Math.round(ty), u > 0.8 ? BLACK[2] : FUR[k % 5 ? 2 : 1]); S.px(Math.round(tx), Math.round(ty) + 1, u > 0.8 ? BLACK[1] : FUR[1]); }
    shadeEll(X + 10, Y + 15, 6, 5, (x, y) => (x > 10 ? 2 : x < 8 && y < 14 ? 1 : 0));
    for (const [ex, dir] of [[X + 6, -1], [X + 13, 1]]) { S.px(ex, Y + 9, ex < X + 9 ? BLACK[1] : GINGER[1]); S.px(ex, Y + 10, ex < X + 9 ? BLACK[2] : GINGER[2]); S.px(ex + dir, Y + 10, FUR[2]); S.px(ex, Y + 11, 0xe8a0a0); }
    S.px(X + 7, Y + 15, 0x3a2a24); S.px(X + 8, Y + 15, 0x3a2a24); S.px(X + 11, Y + 15, 0x3a2a24); S.px(X + 12, Y + 15, 0x3a2a24);
    S.px(X + 9, Y + 17, 0xd88a8a); S.rect(X + 4, Y + 19, 5, 2, FUR[2]); S.px(X + 4, Y + 20, FUR[1]);
  } else {
    // stretching: front paws reaching forward, the back end up, the tail raised
    S.rect(X + 2, Y + 21, 40, 2, 0x5e3e26);
    shadeEll(X + 25, Y + 12, 15, 5, (x, y) => coat(x, y + 2));
    for (const [fx, fy] of [[X + 2, Y + 20], [X + 5, Y + 20]]) S.line(X + 13, Y + 15, fx, fy, FUR[2]);
    S.rect(X + 1, Y + 20, 5, 1, FUR[3]);
    for (const lx of [X + 34, X + 37]) S.line(lx, Y + 14, lx + 1, Y + 20, FUR[1]);
    for (let k = 0; k <= 14; k++) { const u = k / 14; S.px(Math.round(X + 39 + u * 4), Math.round(Y + 10 - u * 10 + u * u * 2), u > 0.7 ? BLACK[2] : FUR[2]); }
    shadeEll(X + 8, Y + 10, 5.5, 4.5, (x, y) => (x > 9 ? 2 : x < 7 && y < 9 ? 1 : 0));
    S.px(X + 4, Y + 5, BLACK[1]); S.px(X + 4, Y + 6, BLACK[2]); S.px(X + 11, Y + 5, GINGER[1]); S.px(X + 11, Y + 6, GINGER[2]);
    if (pose === 2) { S.rect(X + 6, Y + 12, 3, 2, 0xb84a5a); S.px(X + 7, Y + 12, 0xf0d0d0); }
    else { S.px(X + 6, Y + 13, 0xd88a8a); }
    S.px(X + 5, Y + 9, 0x3a2a24); S.px(X + 6, Y + 9, 0x3a2a24); S.px(X + 9, Y + 9, 0x3a2a24); S.px(X + 10, Y + 9, 0x3a2a24);
  }
}
// lily pads, one with a notch turned towards the light; a small white water lily or two
const PAD = [0x24482c, 0x356636, 0x4a8040, 0x6a9c4c, 0x90b860];
function paintPads(S, pads) {
  for (const [cx, cy, rx, ry, a, f] of pads) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / ((rx + 0.5) ** 2) + (y * y) / ((ry + 0.5) ** 2);
      if (d > 1) continue;
      let da = Math.atan2(y * rx / ry, x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.32 && d > 0.08) continue;
      const v = 2.2 + (x / rx) * 0.8 - (y / ry) * 0.9 - (d > 0.7 && y > 0 ? 1.2 : 0) + (d > 0.7 && y < 0 ? 0.6 : 0);
      S.px(cx + x, cy + y, PAD[clamp(band(v, cx + x, cy + y), 0, 4)]);
    }
    S.px(cx, cy, PAD[1]);
    if (f) { S.rect(cx - 1, cy - 2, 3, 2, 0xf6f0e6); S.px(cx - 2, cy - 1, 0xe8dcd8); S.px(cx + 2, cy - 1, 0xfaf6ee); S.px(cx, cy - 2, 0xf2d860); }
  }
}
function paintLotus(S, open) {
  const X = LOTUS.x, Y = LOTUS.y;
  S.line(X, Y - 1, X + 1, Y - 5, 0x4a7a3a);
  if (!open) {
    [[0, 1], [-1, 2], [-1, 3], [-1, 3], [-1, 3], [0, 2]].forEach(([dx, w], j) => { for (let k = 0; k < w; k++) S.px(X + dx + k, Y - 11 + j, j < 2 ? 0xd85a80 : k === w - 1 ? 0xfac2d0 : 0xee8aa6); });
    return;
  }
  const P = [0xc84a72, 0xe87e9e, 0xf8b4c8, 0xfde6ee];
  for (const [dx, h, c] of [[-4, 3, 1], [4, 3, 2], [-2, 5, 1], [3, 5, 2], [0, 6, 2]]) for (let j = 0; j < h; j++) { S.px(X + dx + (j > h - 2 ? Math.sign(dx) : 0), Y - 5 - j, j === h - 1 ? P[3] : P[c]); S.px(X + dx + (dx > 0 ? 1 : -1) * (j < 2 ? 1 : 0), Y - 5 - j, P[c - 1]); }
  S.rect(X - 1, Y - 7, 3, 2, 0xf2d050); S.px(X, Y - 7, 0xfaf0a0); S.rect(X - 5, Y - 5, 11, 1, P[0]);
}
// the bamboo spout on its crossed legs: level, or tipped down to pour
const PIPE = [0x6a6630, 0x9c9446, 0xc6bc6a, 0xe6dca0];
function paintKakei(S, tip) {
  for (const [a, b, c] of [[18, 28, 0x8a7a44], [19, 29, 0xb8a460], [20, 30, 0x6a5a30], [31, 21, 0xa8964e], [32, 22, 0xd0bc78], [33, 23, 0x7a6a3a]]) S.line(a, 250, b, 211, c);
  S.rect(22, 217, 6, 4, 0x2e2620); S.px(23, 217, 0x5a4a3a); S.px(26, 220, 0x5a4a3a);
  const ax = 2, ay = 213 + tip * 2, bx = SPOUT.x, by = SPOUT.y + tip * 3;
  const n = bx - ax;
  for (let i = 0; i <= n; i++) {
    const x = ax + i, y = Math.round(ay + ((by - ay) * i) / n), node = i % 14 === 6;
    S.px(x, y - 1, node ? PIPE[1] : PIPE[3]); S.px(x, y, node ? PIPE[0] : PIPE[2]); S.px(x, y + 1, PIPE[1]); S.px(x, y + 2, PIPE[0]);
  }
  S.px(bx + 1, by, 0xe8e0b8); S.px(bx + 1, by + 1, 0x3a4a2a);
}

/* ——— the still layers: the garden behind, the veranda in front ——— */
function* paintBack(R, G, extra) {
  paintTrees(R, G); yield;
  paintWall(R, G);
  const far = new Ras(R.w, R.h, R.ox, R.oy); far.d.set(R.d);   // the far garden as it stands, for the water to mirror
  if (G.wide) { paintFence(R, G.L, 26); paintFence(R, 300, G.RT); }
  paintGround(R, G);
  paintHedge(R, G); paintHedge(extra, G);
  paintPine(R, 150, 150); paintPine(extra, 150, 150);
  yield;
  // raked gravel in the near right corner (and on along the front in full screen)
  const gr = [[292, 256, 8]];
  if (G.RT > 420) gr.push([G.RT - 56, 252, 6]);
  paintGravel(R, 232, G.RT, 242, ENG, gr, (x, y) => x > 240 - (y - 242) * 0.5 && pondQ(G, x, y) < -0.03);
  for (const [x, y, r] of gr) stone(R, x, y - 3, r, Math.round(r * 0.65), 0.45);
  if (G.rock !== null) {
    paintGravel(R, G.L, -120, 128, 256, [[G.rock, 196, 11], [G.rock + 36, 222, 6]], (x, y) => x < -128 - ((y - 192) / 64) ** 2 * 34);
    stone(R, G.rock, 189, 10, 11, 0.3, [0x4a4842, 0x66625a, 0x847e72, 0xa49c8c]); stone(R, G.rock + 36, 219, 6, 4, 0.5); stone(R, G.rock - 8, 200, 5, 4, 0.6);
    for (let y = 132; y < 254; y += 5) stone(R, Math.round(-127 - ((y - 192) / 64) ** 2 * 34), y, 3, 2, 0.5);   // a kerb of small stones
  }
  if (G.stones) {
    for (let k = 0; k < 8; k++) {
      const t = k / 7, x = Math.round(-28 - 118 * t + 18 * Math.sin(t * Math.PI)), y = Math.round(262 - 104 * t);
      if (x < G.L + 8) break;
      foliage(R, [[x + 9 - t * 4, y + 2, 7 - t * 3, 1.8]], MOSS, k + 40, { rough: 0.3, lift: 0.15 });
      stone(R, x, y, Math.round(13 - 7 * t), Math.max(2, Math.round(4.6 - 2.2 * t)), 0.25, [0x5e5a50, 0x7e786c, 0x9c9584, 0xb8b09c]);
    }
  }
  yield;
  // the maples' trunks, the lantern, the azaleas, the basin, the irises
  paintTrunk(R, MAPLE.x, MAPLE.y, 1, 3);
  if (G.m2) paintTrunk(R, G.m2.x, G.m2.y, 0.72, 9);
  paintToro(R);
  const az = [[96, 148, 15, 1], [122, 156, 10, 2], [166, 147, 12, 3], [236, 152, 9, 4]];
  if (G.wide) az.push([-46, 150, 13, 5], [-8, 156, 9, 6]);
  if (G.RT > 470) az.push([G.RT - 34, 150, 12, 7]);
  for (const [x, y, r, sd] of az) if (x > G.L - 10 && x < G.RT + 10) { azalea(R, x, y, r, sd); azalea(extra, x, y, r, sd); }
  stone(R, 140, 158, 7, 4, 0.7); stone(R, 186, 160, 5, 3, 0.6); stone(R, 60, 160, 8, 5, 0.8); stone(R, 74, 165, 4, 3, 0.6);
  paintBasin(R);
  stone(R, 148, 262, 26, 5, 0.25, [0x6a655a, 0x8a8476, 0xa69e8e, 0xc2baa6]);   // the step stone below the veranda
  for (const [x, y, n, sd, d] of [[108, 262, 9, 1, 1], [196, 263, 11, 2, -1], [222, 256, 7, 3, 1], [20, 262, 10, 4, 1], [100, 162, 6, 5, -1], [252, 166, 7, 6, 1]]) grass(R, x, y, n, sd, d);
  if (G.wide) for (const [x, y, n, sd] of [[-60, 262, 10, 7], [G.RT - 70, 262, 9, 8], [G.RT - 120, 168, 8, 9]]) grass(R, x, y, n, sd, 1);
  yield;
  paintBridge(extra, G.bridge);
  paintToro(extra);
  const W = paintWater(R, G, extra, far);
  G.q = W.q; G.top = W.top;
  yield;
  rimStones(R, G);
  paintBridge(R, G.bridge);
  paintIris(R, 268, 236, 6, 1); paintIris(R, 283, 230, 4, 2); paintIris(R, 50, 214, 4, 3);
  if (G.wide) paintIris(R, G.ponds[1].cx - 40, G.ponds[1].cy + 30, 5, 5);
  yield;
}

function* paintFront(R, G) {
  const L = G.L, RT = G.RT, W = RT - L;
  // the eaves: the roof's underside, the rafters' ends, the beam they rest on
  for (let x = L; x < RT; x++) {
    for (let y = 0; y < 5; y++) R.px(x, y, ((x % 7) + 7) % 7 === 0 ? 0x1c1612 : 0x2a221c);
    const m = ((x % 8) + 8) % 8;
    for (let y = 5; y < 10; y++) R.px(x, y, m < 4 ? (y === 5 ? 0x9e7a58 : m === 3 ? 0x5a4230 : 0x7c5c42) : 0x1a1410);
    R.px(x, 10, 0x8a6a48); R.px(x, 11, 0x664a32); R.px(x, 12, 0x5a4230); R.px(x, 13, 0x34261a);
  }
  // a bamboo blind rolled up under the beam, tied with cord
  for (let x = L + 14; x < RT - 14; x++) {
    R.px(x, 14, 0xc8aa6c); R.px(x, 15, x & 1 ? 0xb08e52 : 0xa08046); R.px(x, 16, 0x7a6236);
    if ((((x - L) % 52) + 52) % 52 === 20) { R.rect(x, 14, 2, 6, 0x5a2e24); R.px(x, 20, 0x8a3a2a); R.px(x + 1, 21, 0x8a3a2a); }
  }
  // half-lowered blinds at the two ends: fine split cane, the garden showing between the slats
  for (const [x0, x1] of [[L + 11, L + 58], [RT - 58, RT - 11]]) {
    for (let y = 17; y < 40; y++) {
      if (y % 2 && y < 37) continue;
      for (let x = x0; x < x1; x++) R.px(x, y, y >= 37 ? (y === 37 ? 0xd2b478 : 0x7a5e34) : (x - x0) % 9 === 4 ? 0x8a6c3c : hash(x >> 2, y) < 0.3 ? 0xb08c54 : 0xc4a266);
    }
    for (const cx of [x0 + 10, x1 - 11]) { R.rect(cx, 17, 1, 23, 0x5a2e24); R.px(cx, 40, 0x8a3a2a); R.px(cx, 41, 0xa84a34); }
  }
  yield;
  // the boards of the engawa: long planks, darker seams, grain, the odd joint
  R.rect(L, ENG - 1, W, 1, 0x2a1e14); R.rect(L, ENG, W, 1, 0xe2be88); R.rect(L, ENG + 1, W, 2, 0xc89c68);
  const seams = [ENG + 3, 273, 279, 286, 294, 303, 313, 324];
  for (let b = 0; b < seams.length - 1; b++) {
    const y0 = seams[b], y1 = seams[b + 1], base = [0xb88a5a, 0xc29462, 0xae8152][b % 3], step = 70 + b * 13;
    for (let y = y0; y < Math.min(H, y1); y++) for (let x = L; x < RT; x++) {
      let c = base;
      const g = vnoise(x / 14 + b * 7, y * 1.7);
      if (g > 0.72) c = mixc(base, 0xd8aa76, 0.5); else if (g < 0.24) c = mixc(base, 0x8a6038, 0.45);
      if ((((x + b * 37) % step) + step) % step === 0) c = 0x6a4628;
      R.px(x, y, c);
    }
    R.rect(L, y0, W, 1, 0x5e3e24); R.rect(L, y0 + 1, W, 1, mixc(base, 0xf0c890, 0.4));
  }
  yield;
  // the posts at either end
  for (const px of [L + 2, RT - 11]) {
    for (let y = 0; y < H; y++) for (let k = 0; k < 9; k++) R.px(px + k, y, k === 0 ? 0x2e2016 : k === 8 ? 0x9a7654 : k > 5 ? 0x7a5a40 : hash(px + k, y >> 3) < 0.15 ? 0x5a4030 : 0x664a34);
    R.rect(px - 2, ENG - 2, 13, 3, 0x4a3424);
  }
  // tea: a little red-clay pot, a celadon cup on its wooden saucer, two sweets on a plate
  const tx = 172, ty = 285;
  R.ell(tx, ty + 4, 9, 2, 0x6a4628);
  for (let y = -5; y <= 4; y++) for (let x = -7; x <= 7; x++) {
    if ((x * x) / 56 + (y * y) / 25 > 1) continue;
    R.px(tx + x, ty + y, [0x5a2414, 0x7e321c, 0x9c4426, 0xbe5e34][clamp(band(1.6 + x / 5 - y / 4, tx + x, ty + y), 0, 3)]);
  }
  R.ell(tx, ty - 5, 4, 1, 0xa84c2a); R.px(tx, ty - 7, 0x7e321c); R.px(tx + 1, ty - 6, 0xbe5e34);
  R.line(tx + 7, ty - 1, tx + 11, ty - 4, 0x9c4426); R.px(tx + 11, ty - 5, 0xbe5e34);
  R.line(tx - 7, ty - 2, tx - 14, ty - 6, 0x2e1a10); R.line(tx - 7, ty - 1, tx - 14, ty - 5, 0x4a2a18);
  const cx = CUP.x, cy = CUP.y;
  R.ell(cx, cy + 1, 8, 2, 0x5a3420); R.rect(cx - 7, cy + 1, 15, 1, 0x7a4a2c);
  for (let y = cy - 8; y < cy; y++) for (let x = cx - 4; x <= cx + 4; x++) R.px(x, y, x === cx + 4 ? 0x5e7e6a : x >= cx + 2 ? 0x7a9c84 : x <= cx - 3 ? 0xc4dcc8 : 0x9cbca4);
  R.rect(cx - 4, cy - 9, 9, 1, 0xd8ecdc); R.rect(cx - 3, cy - 8, 7, 1, 0x8a9a38); R.rect(cx - 2, cy - 8, 3, 1, 0xa8b448);
  R.ell(214, 299, 9, 2, 0xe8e2d4); R.rect(206, 300, 17, 1, 0x8aa4bc); R.rect(208, 298, 13, 1, 0xf6f2ea);
  R.ell(211, 296, 2, 2, 0xf2b4c4); R.px(212, 295, 0xfde0e8); R.ell(217, 296, 2, 2, 0x9cc07e); R.px(218, 295, 0xc8e0a8);
  // a round paper fan laid down on the boards
  const fx = FAN.x, fy = FAN.y;
  R.line(fx + 8, fy + 3, fx + 17, fy + 8, 0x9a7a44); R.line(fx + 8, fy + 2, fx + 17, fy + 7, 0xd0b070);
  for (let y = -4; y <= 4; y++) for (let x = -10; x <= 10; x++) {
    const d = (x * x) / 110 + (y * y) / 20;
    if (d > 1) continue;
    let c = d > 0.8 ? 0x8a6a40 : 0xf2e8d2;
    if (d <= 0.8 && y > 0 && (x + y * 2) % 4 === 0) c = 0x4a6aa8;
    if (sq(x + 3, (y + 1) * 2) < 3.2) c = 0xc8483a;
    R.px(fx + x, fy + y, c);
  }
}

/* ——— building a garden for one width: in steps, so it can be spread over a few frames ——— */
const GARDENS = new Map();   // the last two widths (the frame and full screen), so switching back is instant
function sprite(x0, y0, w, h, paint) { return { x0: Math.floor(x0), y0: Math.floor(y0), w: Math.ceil(w) + 1, h: Math.ceil(h), paint, ras: null, img: [] }; }
function spriteImg(G, sp, k) {
  if (!sp.img[k]) {
    if (!sp.ras) { sp.ras = new Ras(sp.w, sp.h, -sp.x0, -sp.y0); sp.paint(sp.ras); }
    sp.img[k] = bakeOne(sp.ras, sp.x0 + G.ox, sp.y0, G.F, k);
  }
  return sp.img[k];
}
const gardenW = (bw) => Math.max(320, Math.ceil(bw / STEP) * STEP);
function lilyPads(G) {
  const pads = [[104, 219, 8, 3, 0.6, 0], [117, 229, 6, 2, 2.4, 0], [132, 217, 5, 2, 4, 1], [140, 234, 7, 2, 1.2, 0], [LOTUS.x, LOTUS.y + 1, 7, 2, 3.6, 0], [94, 232, 5, 2, 5, 0], [124, 239, 4, 1, 2, 0],
    [214, 188, 7, 2, 2, 0], [228, 195, 5, 2, 0.4, 1], [201, 197, 4, 1, 3, 0], [78, 204, 5, 2, 1.6, 0], [178, 238, 5, 2, 5.5, 0], [240, 186, 4, 1, 1, 0]];
  if (G.wide) { const p = G.ponds[1]; pads.push([p.cx - 30, p.cy + 14, 6, 2, 1, 0], [p.cx - 20, p.cy + 21, 4, 2, 3, 1], [p.cx + 40, p.cy + 10, 5, 2, 5, 0], [p.cx + 52, p.cy + 18, 4, 1, 2, 0]); }
  return pads.filter(([x, y]) => pondQ(G, x, y) > 0.12);
}
function* buildGarden(rw) {
  const G = layout(rw);
  G.bw = rw;
  const back = new Ras(rw, H, G.ox, 0), front = new Ras(rw, H, G.ox, 0), extra = new Ras(rw, H, G.ox, 0);
  paintCrown(extra, MAPLE.x - 30, 10, 1, 0, MAPLE_RED, 5);
  paintTrunk(extra, MAPLE.x, MAPLE.y, 1, 3);
  yield;
  yield* paintBack(back, G, extra);
  yield* paintFront(front, G);
  G.F = fieldsFor(G);
  yield;
  G.sky = [0, 1, 2].map((st) => paintSky(G, st));
  yield;
  G.back = { x0: G.L, y0: 0, w: rw, h: H, ras: back, img: [] };
  G.front = { x0: G.L, y0: 0, w: rw, h: H, ras: front, img: [] };
  G.maple = [-1, 0, 1].map((sw) => sprite(-40, 2, 200, 116, (S) => paintCrown(S, MAPLE.x - 30, 10, 1, sw, MAPLE_RED, 5)));
  const m2 = G.m2;
  G.maple2 = m2 && [-1, 0, 1].map((sw) => sprite(m2.x - 34, 34, 150, 90, (S) => paintCrown(S, m2.x - 16, 40, 0.68, sw, MAPLE_GOLD, 11)));
  const xs = [279, 284, 290, 295, 301, 306, 312, 317];
  if (G.RT > 330) xs.push(327, 335);
  if (G.RT - 46 > G.bridge.x + G.bridge.hw + 10) xs.push(G.RT - 44, G.RT - 37, G.RT - 29);
  G.bamboo = [-1, 0, 1].map((sw) => sprite(Math.min(...xs) - 24, 8, Math.max(...xs) - Math.min(...xs) + 50, 156, (S) => paintBamboo(S, xs, sw)));
  G.cat = [0, 1, 2].map((b) => sprite(CAT.x - 2, CAT.y, 50, 25, (S) => paintCat(S, 0, b)));
  G.cat.push(sprite(CAT.x - 2, CAT.y, 50, 25, (S) => paintCat(S, 1, 0)), sprite(CAT.x - 2, CAT.y, 50, 25, (S) => paintCat(S, 2, 0)));
  G.pads = lilyPads(G);
  let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
  for (const [x, y, rx, ry] of G.pads) { px0 = Math.min(px0, x - rx - 2); px1 = Math.max(px1, x + rx + 2); py0 = Math.min(py0, y - ry - 3); py1 = Math.max(py1, y + ry + 2); }
  G.padSpr = sprite(px0, py0, px1 - px0 + 1, py1 - py0 + 1, (S) => paintPads(S, G.pads));
  G.lotus = [0, 1].map((o) => sprite(LOTUS.x - 7, LOTUS.y - 13, 15, 14, (S) => paintLotus(S, o)));
  G.kakei = [0, 1].map((tp) => sprite(0, 205, 66, 46, (S) => paintKakei(S, tp)));
  G.reeds = [[262, 238, 26], [266, 236, 31], [270, 239, 22], [275, 235, 28], [279, 233, 24], [284, 231, 19], [44, 220, 18], [48, 222, 22]];
  if (G.wide) { const p = G.ponds[1]; G.reeds.push([p.cx - 44, p.cy + 31, 24], [p.cx - 40, p.cy + 33, 28], [p.cx - 36, p.cy + 31, 20]); }
  G.small = () => [...G.maple, ...(G.maple2 || []), ...G.bamboo, ...G.cat, G.padSpr, ...G.lotus, ...G.kakei];
  return G;
}
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) {
  const end = performance.now() + ms;
  for (;;) { const r = job.next(); if (r.done) return r.value; if (performance.now() > end) return null; }
}
function keep(G) { GARDENS.set(G.bw, G); while (GARDENS.size > 2) GARDENS.delete(GARDENS.keys().next().value); return G; }
const gardenFor = (rw) => GARDENS.get(rw) || keep(finish(buildGarden(rw)));

/* ——— the living garden ——— */
// koi: colours along the body, head to tail
const KOI = [
  { name: 'kohaku', body: [0xf4efe6, 0xe0462e, 0xe0462e, 0xf4efe6, 0xe0462e, 0xf4efe6, 0xf4efe6], fin: 0xf8f4ee },
  { name: 'orange', body: [0xf08a2a, 0xf49632, 0xf49632, 0xf08a2a, 0xea7e26, 0xe8782a, 0xf0a050], fin: 0xf8b868 },
  { name: 'gold', body: [0xf0c440, 0xf6d058, 0xf6d058, 0xf0c440, 0xe8b838, 0xe0b040, 0xf4d878], fin: 0xfae098 },
  { name: 'sanke', body: [0xf4efe6, 0xe0462e, 0xf4efe6, 0x2a2624, 0xe0462e, 0xf4efe6, 0xf4efe6], fin: 0xf8f4ee },
  { name: 'tancho', body: [0xd83a2a, 0xf4efe6, 0xf4efe6, 0xf4efe6, 0xf4efe6, 0xf4efe6, 0xf4efe6], fin: 0xf8f4ee },
  { name: 'showa', body: [0x2a2624, 0xe0462e, 0x2a2624, 0xf4efe6, 0xe0462e, 0x2a2624, 0x3a3634], fin: 0x5a5450 },
  { name: 'orange', body: [0xf4efe6, 0xf08a2a, 0xf08a2a, 0xf08a2a, 0xf4efe6, 0xf08a2a, 0xf0a050], fin: 0xf8d0a0 },
];
const KR = [2.1, 2.6, 2.7, 2.4, 1.9, 1.3, 0.8];
const qAt = (G, x, y) => { const X = Math.round(x) + G.ox, Y = Math.round(y); return X < 0 || X >= G.bw || Y < 150 || Y >= 262 ? -1 : G.q[Y * G.bw + X]; };
function pondSpot(G, r, minQ = 0.3) {
  for (let i = 0; i < 60; i++) {
    const p = G.ponds[Math.floor(r() * G.ponds.length)], x = p.cx + (r() * 2 - 1) * p.rx, y = p.cy + (r() * 2 - 1) * p.ry;
    if (qAt(G, x, y) > minQ) return [x, y];
  }
  return [G.ponds[0].cx, G.ponds[0].cy];
}
function newKoi(G, r, i) {
  const [x, y] = pondSpot(G, r, 0.35), a = r() * Math.PI * 2, len = 16 + Math.floor(r() * 6), seg = len / 6;
  return {
    i, pat: KOI[i % KOI.length], x, y, a, v: 6 + r() * 4, len, seg, ph: r() * 6, tx: x, ty: y, wait: 0,
    d: 0.4 + r() * 0.5, dT: 0.6, surf: 0, pts: Array.from({ length: 7 }, (_, k) => [x - Math.cos(a) * seg * k, y - Math.sin(a) * seg * k]), dart: 0,
  };
}
function makeState(seed, G) {
  const r = rng(seed);
  const s = {
    r, t: 0, day: 0.04, stage: 0, sw: [1, 0, 0], lanOn: false, lan: 0,
    wind: 0, wdir: 0, gust: null, nextGust: 3.5 + r() * 4,
    chime: { px: 0, pz: 0, vx: 0, vz: 0, rods: CHIME_MIDI.map((m, i) => ({ m, a: (i / 6) * Math.PI * 2 + 0.26, len: 23 - i * 2, sw: 0, sv: 0, cool: 0, ring: 0 })), twist: 0 },
    koi: [], food: [], ripples: [], leaves: [], floats: [], flies: [], steam: [], motes: [], spray: [], birds: [], birdT: 20 + r() * 20,
    cat: { pose: 0, t: 0, bph: r() * 6, z: [] }, tipT: 0, tip: 0, pourT: 0, dripT: 0, lotus: 1, kick: 0, bkick: 0, tea: 0, gulps: 0,
    frog: { on: true, t: 0, jump: 0 }, leafT: 2, cloud: r() * 400,
  };
  const nk = G.wide ? 9 : 6;
  for (let i = 0; i < nk; i++) s.koi.push(newKoi(G, r, i));
  for (let i = 0; i < (G.wide ? 3 : 2); i++) s.flies.push({ x: 120 + i * 90, y: 170 + i * 20, tx: 0, ty: 0, mode: 'hover', t: r() * 2, c: i % 2 ? 0x3a8eb0 : 0xc8402a, dir: 1, perch: -1, ph: r() * 6 });
  for (let i = 0; i < 16; i++) s.motes.push({ x: G.L + r() * (G.RT - G.L), y: 120 + r() * 140, p: r() * 6, v: 0.6 + r() });
  for (let i = 0; i < 7; i++) s.floats.push({ x: pondSpot(G, r, 0.2)[0], y: 0, c: 3 + Math.floor(r() * 4), a: 30 + r() * 30, ph: r() * 6 });
  for (const f of s.floats) f.y = pondSpot(G, () => (hash(f.x | 0, 3) * 7) % 1, 0.2)[1];
  return s;
}

const stageOf = (day) => (day < 0.36 ? 0 : day < 0.7 ? 1 : 2);
function sunAt(s) { return { x: 254 - s.day * 18, y: 24 + s.day * 62 }; }
function reedTip(G, s, i) {
  const [x, y, h] = G.reeds[i], b = Math.sin(s.t * 0.9 + i * 1.7) * 0.8 + s.wind * (1.5 + Math.sin(s.t * 3.1 + i) * 1.2);
  return [x + b, y - h];
}
function addRipple(s, x, y, big = 1) { s.ripples.push({ x, y, r: 0.5, v: 6 + 4 * big, life: 1, max: 9 + big * 9 }); if (s.ripples.length > 40) s.ripples.shift(); }
function gust(s, peak, dur) { s.gust = { t: 0, peak: Math.max(peak, s.gust ? s.gust.peak * 0.6 : 0), dur }; s.wdir = (s.r() - 0.5) * 1.8 + (s.r() < 0.3 ? Math.PI : 0); }

function update(s, G, dt, hooks) {
  const r = s.r;
  s.t += dt;
  const t = s.t;
  // the sun lowers: late afternoon to evening over ten minutes, then the evening stays
  if (s.day < 1) s.day = Math.min(1, s.day + dt / 600);
  const st = stageOf(s.day);
  if (st !== s.stage) { s.stage = st; hooks.stage?.(st); }
  for (let k = 0; k < 3; k++) s.sw[k] += ((k === s.stage ? 1 : 0) - s.sw[k]) * Math.min(1, dt / 2.2);
  s.lan += ((s.lanOn ? 1 : 0) - s.lan) * Math.min(1, dt * 2.6);
  if (Math.abs(s.lan - (s.lanOn ? 1 : 0)) < 0.004) s.lan = s.lanOn ? 1 : 0;
  for (let k = 0; k < 3; k++) if (Math.abs(s.sw[k] - (k === s.stage ? 1 : 0)) < 0.004) s.sw[k] = k === s.stage ? 1 : 0;

  // the wind: a faint stir always, and every six to fifteen seconds a breeze
  s.nextGust -= dt;
  if (s.nextGust <= 0) { gust(s, 0.45 + r() * 0.55, 2 + r() * 3); s.nextGust = 6 + r() * 9; hooks.breeze?.(); }
  let w = 0.06 + 0.04 * Math.sin(t * 0.37) + 0.03 * Math.sin(t * 1.13);
  if (s.gust) {
    const g = s.gust; g.t += dt;
    const env = g.t < 0.9 ? ease(g.t / 0.9) : g.t < g.dur ? 1 : 1 - ease((g.t - g.dur) / 1.8);
    w += g.peak * env * (0.85 + 0.15 * Math.sin(t * 5.3));
    if (g.t > g.dur + 1.8) s.gust = null;
    if (r() < dt * 3 * g.peak * env) spawnLeaf(s, G, r, false);
  }
  s.wind = w;
  s.cloud += dt * (1.2 + w * 3);

  // the chime: the clapper swings on its cord, pushed by the wind on the paper strip; whenever it
  // meets a rod, that rod sounds (the louder the knock, the louder the note) and swings away
  const C = s.chime;
  const fa = w * 22 * (0.55 + 0.45 * Math.sin(t * 2.35) + 0.25 * Math.sin(t * 5.3 + 1)), fb = w * 18 * (0.7 * Math.sin(t * 1.9 + 1) + 0.3 * Math.sin(t * 4.1));
  const cd = Math.cos(s.wdir), sd = Math.sin(s.wdir), fx = fa * cd - fb * sd, fz = fa * sd + fb * cd;
  C.vx += (fx - C.px * 6 - C.vx * 0.55) * dt; C.vz += (fz - C.pz * 6 - C.vz * 0.55) * dt;
  C.px += C.vx * dt; C.pz += C.vz * dt;
  const rr = sq(C.px, C.pz);
  if (rr > 4) {
    const nx = C.px / rr, nz = C.pz / rr, out = C.vx * nx + C.vz * nz, ang = Math.atan2(C.pz, C.px);
    let best = 0, bd = 9;
    C.rods.forEach((rod, i) => { const d = Math.abs(Math.atan2(Math.sin(ang - rod.a), Math.cos(ang - rod.a))); if (d < bd) { bd = d; best = i; } });
    if (out > 0) {
      const rod = C.rods[best];
      if (rod.cool <= 0 && out > 0.9) { hooks.strike?.(rod, Math.min(1, out / 9)); rod.cool = 0.1; rod.ring = 1; }
      rod.sv += out * 1.2 * Math.cos(rod.a) * 0.6;
      C.vx -= 1.55 * out * nx; C.vz -= 1.55 * out * nz;
    }
    C.px = nx * 4; C.pz = nz * 4;
  }
  for (const rod of C.rods) {
    rod.sv += (w * 1.4 * (0.6 + 0.4 * Math.sin(t * 1.9 + rod.a * 3)) - rod.sw * 7 - rod.sv * 1.1) * dt;
    rod.sw += rod.sv * dt; rod.cool -= dt; rod.ring = Math.max(0, rod.ring - dt * 0.8);
  }
  C.twist += (Math.sin(t * 1.7) * w * 2.2 + (C.vx * 0.05) - C.twist) * Math.min(1, dt * 3);

  // koi: slow curving paths, tails flicking, coming up for food, now and then surfacing
  for (const k of s.koi) {
    k.wait -= dt; k.dart = Math.max(0, k.dart - dt);
    let food = null, fd = 110;
    for (const f of s.food) { const d = sq(f.x - k.x, f.y - k.y); if (d < fd) { fd = d; food = f; } }
    if (food) { k.tx = food.x; k.ty = food.y; k.dT = 0; }
    else if (k.wait <= 0 || sq(k.tx - k.x, k.ty - k.y) < 6) {
      [k.tx, k.ty] = pondSpot(G, r, 0.3); k.wait = 5 + r() * 9;
      k.dT = r() < 0.12 ? 0 : 0.45 + r() * 0.5;
    }
    let want = Math.atan2(k.ty - k.y, k.tx - k.x), da = Math.atan2(Math.sin(want - k.a), Math.cos(want - k.a));
    const ahead = qAt(G, k.x + Math.cos(k.a) * 9, k.y + Math.sin(k.a) * 9 * 0.8);
    if (ahead < 0.16) { const p = G.ponds.reduce((b, q) => (sq(q.cx - k.x, q.cy - k.y) < sq(b.cx - k.x, b.cy - k.y) ? q : b)); want = Math.atan2(p.cy - k.y, p.cx - k.x); da = Math.atan2(Math.sin(want - k.a), Math.cos(want - k.a)); da = Math.sign(da || 1) * Math.max(Math.abs(da), 1.2); }
    const turn = (food ? 1.8 : 0.7) * (k.dart ? 3 : 1);
    k.a += clamp(da, -turn * dt, turn * dt);
    const vt = k.dart ? 34 : food ? (fd < 10 ? 6 : 14) : 6 + 2.5 * Math.sin(t * 0.3 + k.i);
    k.v += (vt - k.v) * Math.min(1, dt * 1.5);
    k.x += Math.cos(k.a) * k.v * dt; k.y += Math.sin(k.a) * k.v * dt * 0.8;
    k.ph += dt * (2.4 + k.v * 0.35);
    k.d += (k.dT - k.d) * Math.min(1, dt * 0.6);
    if (k.dT === 0 && k.d < 0.08 && !food && r() < dt * 0.5) { addRipple(s, k.x + Math.cos(k.a) * 3, k.y, 0.2); k.dT = 0.5 + r() * 0.4; }
    k.pts[0][0] = k.x; k.pts[0][1] = k.y;
    for (let i = 1; i < k.pts.length; i++) {
      const p = k.pts[i], q = k.pts[i - 1], dx = q[0] - p[0], dy = q[1] - p[1], d = sq(dx, dy);
      if (d > k.seg) { p[0] = q[0] - (dx / d) * k.seg; p[1] = q[1] - (dy / d) * k.seg; }
    }
    if (food && fd < 2.5 && k.d < 0.25) { s.food.splice(s.food.indexOf(food), 1); addRipple(s, food.x, food.y, 0.3); hooks.gulp?.(); }
  }
  for (const f of s.food) { f.t += dt; f.x += Math.sin(t + f.p) * 0.4 * dt + w * 0.8 * dt; }
  s.food = s.food.filter((f) => f.t < 18 && qAt(G, f.x, f.y) > 0.05);

  for (const p of s.ripples) { p.r += p.v * dt; p.v *= 1 - dt * 0.5; p.life = 1 - p.r / p.max; }
  s.ripples = s.ripples.filter((p) => p.life > 0);

  // maple leaves: drifting down, settling on the water (and floating there a while) or the moss
  s.leafT -= dt * (1 + w * 2);
  if (s.leafT <= 0) { spawnLeaf(s, G, r, false); s.leafT = 2.5 + r() * 4; }
  for (const l of s.leaves) {
    l.ph += dt * l.spin; l.y += (9 + Math.sin(l.ph) * 3) * dt; l.x += (Math.sin(l.ph * 0.7) * 6 + w * 26) * dt;
    if (l.y >= l.land) {
      l.done = true;
      if (qAt(G, l.x, l.y) > 0.04) { s.floats.push({ x: l.x, y: l.y, c: l.c, a: 40 + r() * 30, ph: r() * 6, gold: l.gold }); addRipple(s, l.x, l.y, 0.15); }
    }
  }
  s.leaves = s.leaves.filter((l) => !l.done && l.x < G.RT + 10);
  for (const f of s.floats) { f.a -= dt; f.x += (0.6 + w * 3) * dt; f.y += Math.sin(t * 0.4 + f.ph) * 0.3 * dt; if (qAt(G, f.x + 2, f.y) < 0.04) f.a = Math.min(f.a, 1); }
  s.floats = s.floats.filter((f) => f.a > 0);
  if (s.floats.length > 34) s.floats.splice(0, s.floats.length - 34);
  s.kick = Math.max(0, s.kick - dt); s.bkick = Math.max(0, s.bkick - dt);

  // dragonflies: hover, dart, hover; now and then rest on a reed tip
  for (const d of s.flies) {
    d.t -= dt;
    if (d.mode === 'perch') {
      [d.x, d.y] = reedTip(G, s, d.perch); d.y -= 1;
      if (d.t <= 0) { d.mode = 'hover'; d.t = 0.5; d.perch = -1; }
    } else if (d.mode === 'dart') {
      const dx = d.tx - d.x, dy = d.ty - d.y, dd = sq(dx, dy), sp = 90 * dt;
      if (dd <= sp) { d.x = d.tx; d.y = d.ty; d.mode = d.perch >= 0 ? 'perch' : 'hover'; d.t = d.perch >= 0 ? 5 + r() * 6 : 0.8 + r() * 2.4; }
      else { d.x += (dx / dd) * sp; d.y += (dy / dd) * sp; d.dir = dx > 0 ? 1 : -1; }
    } else {
      d.x += Math.sin(t * 7 + d.ph) * 4 * dt; d.y += Math.cos(t * 5.3 + d.ph) * 3 * dt;
      if (d.t <= 0) {
        if (r() < 0.22) landFly(s, G, d, Math.floor(r() * G.reeds.length));
        else { const [x, y] = pondSpot(G, r, 0.05); d.tx = clamp(x + (r() - 0.5) * 40, G.L + 20, G.RT - 20); d.ty = clamp(y - 10 - r() * 40, 120, 250); d.mode = 'dart'; }
      }
    }
  }
  // the cat breathes; a stretch, a yawn, and back to sleep
  const cat = s.cat;
  cat.bph += dt * 1.3;
  if (cat.pose) { cat.t += dt; if (cat.t > 3) { cat.pose = 0; cat.t = 0; } }
  for (const z of cat.z) { z.y -= dt * 4; z.x += Math.sin(z.y * 0.3) * dt * 2; z.l -= dt * 0.35; }
  cat.z = cat.z.filter((z) => z.l > 0);
  if (!cat.pose && r() < dt * 0.06) cat.z.push({ x: CAT.x + 6, y: CAT.y + 8, l: 1 });
  // steam off the tea
  s.tea = Math.max(0, s.tea - dt);
  if (r() < dt * (5 + s.tea * 6)) s.steam.push({ x: CUP.x - 2 + r() * 4, y: CUP.y - 10, a: 0, life: 2.2 + r() * 1.5, ph: r() * 6 });
  for (const p of s.steam) { p.a += dt; p.y -= dt * (5 + s.tea); p.x += (Math.sin(p.a * 2 + p.ph) * 2.5 + w * 8) * dt; }
  s.steam = s.steam.filter((p) => p.a < p.life);
  // the spout: tipped, it pours harder for a moment; the basin spills over into the pond
  s.tipT = Math.max(0, s.tipT - dt);
  s.tip += ((s.tipT > 0.5 ? 1 : 0) - s.tip) * Math.min(1, dt * 6);
  s.dripT -= dt * (1 + s.tip * 4);
  if (s.dripT <= 0) { s.dripT = 0.9 + r() * 0.8; s.spray.push({ x: BASIN.x + 14, y: BASIN.y + 1, vx: 4 + r() * 3, vy: 0, l: 0.8 }); }
  for (const p of s.spray) { p.vy += 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; if (qAt(G, p.x, p.y) > 0.01 && p.l > 0) { addRipple(s, p.x, p.y, 0.08); p.l = 0; } }
  s.spray = s.spray.filter((p) => p.l > 0);
  // the frog dives, and climbs back on its pad later
  const fr = s.frog;
  if (fr.jump > 0) { fr.jump -= dt; if (fr.jump <= 0) { fr.on = false; fr.t = 14 + r() * 10; addRipple(s, 126, 236, 0.8); hooks.plop?.(); } }
  else if (!fr.on) { fr.t -= dt; if (fr.t <= 0) { fr.on = true; addRipple(s, 117, 230, 0.2); } }
  // motes in the low sun; birds now and then, far off
  for (const m of s.motes) { m.y -= m.v * dt; m.x += (Math.sin(t * 0.5 + m.p) * 1.5 + w * 6) * dt; if (m.y < 112 || m.x > G.RT) { m.y = 250 + r() * 10; m.x = G.L + r() * (G.RT - G.L); } }
  s.birdT -= dt;
  if (s.birdT <= 0) { s.birdT = 40 + r() * 50; const y = 34 + r() * 26; for (let i = 0; i < 2 + Math.floor(r() * 2); i++) s.birds.push({ x: G.L - 10 - i * 9, y: y + i * 3, ph: r() * 6 }); }
  for (const b of s.birds) { b.x += 16 * dt; b.y += Math.sin(t * 0.8 + b.ph) * 1.5 * dt; }
  s.birds = s.birds.filter((b) => b.x < G.RT + 10);
}
function spawnLeaf(s, G, r, shake) {
  const x = MAPLE.x - 30 + r() * 170, y = 30 + r() * 70, land = 150 + r() * 100;
  const fromGold = G.m2 && !shake && r() < 0.35;
  s.leaves.push({ x: fromGold ? G.m2.x - 20 + r() * 100 : x, y: fromGold ? 50 + r() * 40 : y, land, ph: r() * 6, spin: 2 + r() * 3, c: 2 + Math.floor(r() * 5), gold: fromGold });
  if (s.leaves.length > 60) s.leaves.shift();
}
function landFly(s, G, d, i) {
  if (s.flies.some((o) => o !== d && o.perch === i)) i = (i + 3) % G.reeds.length;
  d.perch = i; [d.tx, d.ty] = reedTip(G, s, i); d.ty -= 1; d.mode = 'dart';
}

/* ——— drawing a frame ——— */
// colours for the moving things, lit for one key and kept
function palette(G, key) {
  G.pal = G.pal || [];
  if (G.pal[key]) return G.pal[key];
  const lit = (c, x, y) => litOf(G, x, y, c, key), H6 = (c) => hex(c);
  const wc = lit(WATER[3], 165, 214);
  const P = {
    koi: KOI.map((p) => [0, 0.24, 0.42, 0.58].map((m) => p.body.concat(p.fin).map((c) => H6(mixc(lit(c, 165, 205), wc, m))))),
    rip: [0.3, 0.5, 0.7].map((m) => H6(mixc(wc, lit(0xeaf6f2, 165, 205), m))), ripD: H6(mixc(wc, 0x0e2a30, 0.35)),
    shim: H6(mixc(wc, lit(0xf4fbf6, 165, 200), 0.55)),
    leaf: MAPLE_RED.map((c) => H6(lit(c, 150, 170))), gold: MAPLE_GOLD.map((c) => H6(lit(c, 0, 170))),
    reed: [0x3e6a34, 0x5e8e44, 0x86b058].map((c) => H6(lit(c, 272, 214))), tail: [0x5a3420, 0x84522e].map((c) => H6(lit(c, 272, 214))),
    frog: [0x2e5a2a, 0x4a8a3a, 0x7ab454, 0xe8e0b0].map((c) => H6(lit(c, 117, 228))),
    pellet: [H6(lit(0xc8965a, 150, 210)), H6(lit(0xe8c088, 150, 210))],
    stream: [H6(lit(0xcfe8ea, 60, 228)), H6(lit(0x9cc8cc, 60, 228)), H6(lit(0xffffff, 60, 228))],
    rod: [[0x6e7680, 0xa8b2bc, 0xf0f4f8], [0x76727a, 0xb8b0b0, 0xfff0dc], [0x6a6070, 0xb0a0a8, 0xffe0d0]][key >> 1].map(H6), wood: [0x5a3e28, 0x8a6440, 0xb08458].map((c) => H6(lit(c, CHIME.x, 40))),
    paper: [0xf4ead0, 0xcab994, 0x3a3040, 0xc8483a].map((c) => H6(lit(c, CHIME.x, 60))), cord: H6(lit(0x3a2a22, CHIME.x, 30)),
  };
  G.pal[key] = P;
  return P;
}
// the still layers, crossfaded where the light is changing (the hour, the lantern)
function order(s) {
  const w = [];
  for (let st = 0; st < 3; st++) for (let l = 0; l < 2; l++) { const v = s.sw[st] * (l ? s.lan : 1 - s.lan); if (v > 0.004) w.push([st * 2 + l, v]); }
  w.sort((a, b) => b[1] - a[1]);
  let acc = 0;
  return w.map(([k, v]) => { acc += v; return [k, v / acc]; });
}
function drawLit(g, G, sp, ord) {
  const x = G.ox + sp.x0, y = sp.y0;
  for (const [k, a] of ord) { g.globalAlpha = a; g.drawImage(spriteImg(G, sp, k), x, y); }
  g.globalAlpha = 1;
}
let FX = null;
function fx() {
  if (FX) return FX;
  // the low sun's rays, slanting down to the left from it through the maple and over the water
  const RW = 380, RH = 300, R = new Ras(RW, RH);
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const dx = x - (RW - 30), dy = y - 10, d = sq(dx, dy);
    if (d < 20 || dx > 0) continue;
    const a = Math.atan2(dy, -dx), v = 0.5 + 0.5 * Math.sin(a * 34 + Math.sin(a * 11) * 2.4), f = Math.max(0, 1 - d / 400) * Math.min(1, (d - 20) / 60);
    const lv = band(Math.max(0, v - 0.45) * 2 * f * 3, x, y);
    if (lv > 0) R.px(x, y, 0xffd88c, lv / 8);
  }
  FX = {
    rays: R.canvas(),
    sun: [0xfff0c0, 0xffd890, 0xffb468].map((c) => glow(44, 40, c, 0.9, 6)),
    haze: glow(70, 46, 0xffc880, 0.6, 5),
    lan: glow(30, 26, 0xffb860, 0.85, 6), lanW: glow(8, 26, 0xffc070, 0.6, 4), lanSm: glow(9, 8, 0xfff0c0, 1, 4),
    glint: glow(5, 3, 0xfff2c8, 1, 3),
    steam: [0.12, 0.2, 0.3, 0.4].map((a) => `rgba(246,240,230,${a})`),
    z: [0.3, 0.55, 0.8].map((a) => `rgba(236,228,244,${a})`),
    wing: [0.35, 0.6].map((a) => `rgba(226,240,250,${a})`),
  };
  return FX;
}
const fill = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  const ry = Math.max(0.6, r * 0.8);
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const u = dy / (ry + 0.35);
    if (Math.abs(u) > 1) continue;
    const half = Math.floor(r * Math.sqrt(1 - u * u) + 0.35);
    g.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}
function drawKoi(g, ox, k, P) {
  const pi = KOI.indexOf(k.pat), lv = clamp(Math.round(k.d * 3.4), 0, 3), lad = P.koi[pi][lv], fin = P.koi[pi][Math.min(3, lv + 1)][7];
  const amp = [0, 0.1, 0.22, 0.4, 0.65, 0.95, 1.3], sc = k.len / 16, wagK = k.dart ? 1.7 : 1;
  const pts = k.pts.map((p, i) => {
    const a = k.pts[Math.max(0, i - 1)], b = k.pts[Math.min(6, i + 1)], dx = a[0] - b[0], dy = a[1] - b[1], d = sq(dx, dy) || 1;
    const wg = Math.sin(k.ph - i * 0.75) * amp[i] * wagK;
    return [p[0] - (dy / d) * wg + ox, p[1] + (dx / d) * wg * 0.8, dx / d, dy / d];
  });
  // the tail fin, flicking, and the pectoral fins
  const [tx, ty, tdx, tdy] = pts[6], fl = Math.sin(k.ph * 1.1 - 5) * 0.55;
  g.fillStyle = fin;
  for (const side of [-1, 1]) {
    const ang = Math.atan2(-tdy, -tdx) + side * 0.5 + fl;
    for (let j = 1; j <= Math.round(3.5 * sc); j++) g.fillRect(Math.round(tx + Math.cos(ang) * j), Math.round(ty + Math.sin(ang) * j * 0.8), 1, 1);
  }
  const [hx, hy, hdx, hdy] = pts[1], pf = Math.sin(k.ph * 1.6) > 0 ? 1 : 0;
  for (const side of [-1, 1]) g.fillRect(Math.round(hx - hdy * side * (3 + pf) * sc - hdx), Math.round(hy + hdx * side * (2.4 + pf) * sc), 1, 1);
  for (let i = 6; i >= 0; i--) disc(g, pts[i][0], pts[i][1], KR[i] * sc, lad[i]);
  if (k.d < 0.12) { fill(g, '#fffaf0', Math.round(pts[1][0]), Math.round(pts[1][1] - 1)); fill(g, '#fffaf0', Math.round(pts[3][0]), Math.round(pts[3][1] - 1)); }
}

function render(g, G, s) {
  const ox = G.ox, t = s.t, F = fx(), ord = order(s), key = ord[0][0], P = palette(G, key), sun = sunAt(s);
  const sunVis = clamp((84 - sun.y) / 14, 0.2, 1);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, G.bw, H);
  // the sky, the sun behind the trees, a wisp or two of cloud, birds far off
  let acc = 0;
  [0, 1, 2].map((st) => [st, s.sw[st]]).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]).forEach(([st, v]) => { acc += v; g.globalAlpha = v / acc; g.drawImage(G.sky[st], 0, 0); });
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55 * sunVis; g.drawImage(F.sun[s.stage], ox + Math.round(sun.x) - 44, Math.round(sun.y) - 40);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  disc(g, ox + sun.x, sun.y, 6.5, ['#fff6dc', '#ffe6b0', '#ffcf8a'][s.stage]); disc(g, ox + sun.x, sun.y, 4.5, '#fffaf0');
  for (let i = 0; i < 3; i++) {
    const span = G.bw + 80, x = ((s.cloud * (0.6 + i * 0.25) + i * 170) % span) - 40, y = 30 + i * 13;
    g.fillStyle = ['rgba(255,244,224,0.45)', 'rgba(255,232,200,0.4)', 'rgba(255,214,190,0.4)'][s.stage];
    g.fillRect(Math.round(x), y, 18 + i * 6, 1); g.fillRect(Math.round(x) + 4, y - 1, 9 + i * 3, 1);
  }
  g.fillStyle = 'rgba(58,52,64,0.75)';
  for (const b of s.birds) { const up = Math.sin(t * 9 + b.ph) > 0, x = ox + Math.round(b.x), y = Math.round(b.y); g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y - (up ? 1 : 0), 1, 1); g.fillRect(x + 1, y - (up ? 1 : 0), 1, 1); }

  drawLit(g, G, G.back, ord);
  const swv = (kick, ph) => { const v = Math.sin(t * 0.6 + ph) * 0.35 + s.wind * Math.sin(t * 2.6 + ph) * 1.5 + (kick > 0 ? Math.sin(t * 15) * kick * 1.5 : 0); return v > 0.45 ? 2 : v < -0.45 ? 0 : 1; };
  if (G.maple2) drawLit(g, G, G.maple2[swv(s.kick, 4)], ord);
  drawLit(g, G, G.bamboo[swv(s.bkick, 1.3)], ord);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 * sunVis; g.drawImage(F.haze, ox + Math.round(sun.x) - 70, Math.round(sun.y) - 30);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

  // under the water: the koi (the deepest first) and the food
  for (const k of [...s.koi].sort((a, b) => b.d - a.d)) drawKoi(g, ox, k, P);
  for (const f of s.food) { fill(g, P.pellet[0], ox + Math.round(f.x), Math.round(f.y)); if ((f.t * 2 | 0) % 3 === 0) fill(g, P.pellet[1], ox + Math.round(f.x), Math.round(f.y) - 1); }
  drawLit(g, G, G.padSpr, ord);
  drawLit(g, G, G.lotus[s.lotus], ord);
  const fr = s.frog;
  if (fr.on || fr.jump > 0) {
    const u = fr.jump > 0 ? 1 - fr.jump / 0.5 : 0, x = ox + Math.round(115 + u * 9), y = Math.round(227 + u * 7 - Math.sin(u * Math.PI) * 6);
    fill(g, P.frog[1], x, y, 5, 2); fill(g, P.frog[0], x, y + 2, 5, 1); fill(g, P.frog[2], x + 1, y, 3, 1);
    fill(g, P.frog[3], x, y - 1); fill(g, P.frog[3], x + 4, y - 1); fill(g, '#1a1a14', x + 4, y - 1);
    if (Math.sin(t * 0.8) > 0.92) fill(g, P.frog[3], x + 4, y + 1);
  }
  // on the surface: the sun's glitter, a sheen, the ripples, leaves afloat
  const top = G.top[clamp(Math.round(sun.x) + ox, 0, G.bw - 1)];
  if (top > 0) {
    for (let i = 0; i < 26; i++) {
      const tk = Math.floor(t * 2.4 + i * 0.37), h1 = hash(i, tk), y = top + 3 + Math.floor(h1 * h1 * 58), x = sun.x + (hash(i + 50, tk) - 0.5) * (5 + (y - top) * 0.55);
      if (qAt(G, x, y) < 0.06) continue;
      fill(g, h1 < 0.3 ? '#fffbe8' : '#ffe6a8', ox + Math.round(x), y, h1 < 0.5 ? 2 : 1, 1);
    }
  }
  g.fillStyle = P.shim;
  for (let i = 0; i < 30 + Math.round(s.wind * 40); i++) {
    const p = G.ponds[i % G.ponds.length], tk = Math.floor(t * 0.7 + i * 0.29), x = p.cx + (hash(i, tk) - 0.5) * p.rx * 1.8 + t * (2 + s.wind * 12) % 6, y = p.cy + (hash(i + 7, tk) - 0.5) * p.ry * 1.8;
    if (qAt(G, x, y) > 0.08 && Math.sin(t * 2 + i) > -0.2) g.fillRect(ox + Math.round(x), Math.round(y), 2 + (i % 3 === 0 ? 1 : 0), 1);
  }
  for (const p of s.ripples) {
    const n = Math.max(10, Math.round(p.r * 4.6)), c = P.rip[p.life > 0.66 ? 2 : p.life > 0.33 ? 1 : 0];
    for (const [rr, col] of [[p.r, c], [p.r - 1.4, P.ripD]]) {
      if (rr < 0.6) continue;
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.round(p.x + Math.cos(a) * rr), y = Math.round(p.y + Math.sin(a) * rr * 0.42);
        if (qAt(G, x, y) > 0.02) g.fillRect(ox + x, y, 1, 1);
      }
    }
  }
  for (const f of s.floats) {
    const L = f.gold ? P.gold : P.leaf, x = ox + Math.round(f.x), y = Math.round(f.y + Math.sin(t * 1.3 + f.ph) * 0.4);
    fill(g, L[f.c], x, y, 2, 1); fill(g, L[Math.max(1, f.c - 2)], x + ((f.ph * 3 | 0) & 1), y + 1); if (f.c > 3) fill(g, L[f.c + 1] || L[6], x, y);
  }

  // the spout, its trickle into the basin, the basin's spill
  drawLit(g, G, G.kakei[s.tip > 0.5 ? 1 : 0], ord);
  const mx = SPOUT.x + 1, my = SPOUT.y + 1 + Math.round(s.tip * 3), fall = BASIN.y - my;
  for (let j = 0; j < fall; j++) {
    const x = mx + Math.round((j / fall) ** 2 * (2 + s.tip * 3)), c = P.stream[(j + Math.floor(t * 24)) % 4 === 0 ? 2 : (j + Math.floor(t * 24)) % 4 === 2 ? 1 : 0];
    fill(g, c, ox + x, my + j, 1, 1); fill(g, P.stream[s.tip > 0.5 ? 0 : 1], ox + x + 1, my + j, s.tip > 0.5 ? 2 : 1, 1);
  }
  const bx = mx + 2 + Math.round(s.tip * 3), ph = (t * 1.6) % 1;
  fill(g, P.stream[2], ox + bx - 1, BASIN.y - 1 - (Math.sin(t * 20) > 0 ? 1 : 0)); fill(g, P.stream[0], ox + bx + 1, BASIN.y - 1);
  for (const side of [-1, 1]) fill(g, P.stream[ph < 0.5 ? 0 : 1], ox + bx + side * Math.round(2 + ph * 4), BASIN.y);
  for (const p of s.spray) fill(g, P.stream[0], ox + Math.round(p.x), Math.round(p.y));

  // the maple, then the reeds and what flies in front of the water
  drawLit(g, G, G.maple[swv(s.kick, 0)], ord);
  G.reeds.forEach(([x, y, h], i) => {
    const [tx2] = reedTip(G, s, i), b = tx2 - x;
    for (let j = 0; j < h; j++) fill(g, P.reed[j < h * 0.4 ? 0 : j < h * 0.8 ? 1 : 2], ox + Math.round(x + b * (j / h) ** 2), y - j);
    if (i % 2 === 0) { const cx = ox + Math.round(x + b * 0.8), cy = y - h + 3; fill(g, P.tail[0], cx, cy, 2, 5); fill(g, P.tail[1], cx + 1, cy, 1, 4); }
  });
  for (const d of s.flies) {
    const x = ox + Math.round(d.x), y = Math.round(d.y), dir = d.dir, fly = d.mode !== 'perch', up = fly && Math.floor(t * 28 + d.ph) % 2;
    g.fillStyle = F.wing[fly ? 0 : 1];
    g.fillRect(x - dir * 1 - 3, y - 1 - (up ? 1 : 0), 3, 1); g.fillRect(x - dir * 1 + 1, y - 1 - (up ? 1 : 0), 3, 1);
    g.fillRect(x - dir * 2 - 2, y - (up ? 1 : 0), 2, 1); g.fillRect(x - dir * 2 + 1, y - (up ? 1 : 0), 2, 1);
    for (let k = 0; k < 6; k++) fill(g, k === 0 ? '#1e2a2a' : hex(d.c), x - dir * k, y);
    fill(g, hex(mixc(d.c, 0xffffff, 0.3)), x - dir, y - 1);
  }
  for (const l of s.leaves) {
    const L = l.gold ? P.gold : P.leaf, x = ox + Math.round(l.x), y = Math.round(l.y), f = Math.floor(l.ph * 1.5) % 3;
    fill(g, L[l.c], x, y, f === 0 ? 2 : 1, f === 1 ? 2 : 1); fill(g, L[Math.max(0, l.c - 2)], x + (f === 2 ? 1 : 0), y + (f === 2 ? 1 : 0));
  }

  // the low sun's rays, then the veranda, then the chime hanging from its eaves
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = (0.05 + 0.05 * s.sw[1] + 0.03 * s.sw[2]) * sunVis * (0.85 + 0.15 * Math.sin(t * 0.3)); g.drawImage(F.rays, ox + Math.round(sun.x) - 350, Math.round(sun.y) - 10);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawLit(g, G, G.front, ord);
  drawChime(g, ox, s, P);
  // the cat, its dreams, the tea's steam
  const bs = Math.sin(s.cat.bph), cat = s.cat;
  drawLit(g, G, G.cat[cat.pose ? (cat.t < 0.5 || cat.t > 2.4 ? 3 : 4) : bs > 0.45 ? 2 : bs > -0.35 ? 1 : 0], ord);
  for (const z of cat.z) { g.fillStyle = F.z[clamp(Math.floor(z.l * 3), 0, 2)]; const x = ox + Math.round(z.x), y = Math.round(z.y); g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 3, 1); }
  for (const p of s.steam) { const u = p.a / p.life, a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8; g.fillStyle = F.steam[clamp(Math.floor(a * (3 + Math.min(1, s.tea))), 0, 3)]; g.fillRect(ox + Math.round(p.x), Math.round(p.y), 1, u > 0.5 ? 2 : 1); }

  // light: the lantern's window and glow, the sun's rays, motes drifting in them
  const lx = ox + TORO.x, ly = TORO.y;
  if (s.lan > 0.02) {
    const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
    g.globalAlpha = s.lan; fill(g, '#ffd27e', lx - 3, ly - 39, 7, 7); fill(g, '#fff0c0', lx - 1, ly - 37, 3, 3 + (fl > 0.9 ? 1 : 0)); fill(g, '#ffb860', lx - 3, ly - 33, 7, 1);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = s.lan * 0.8 * fl; g.drawImage(F.lan, lx - 30, ly - 62);
    g.globalAlpha = s.lan * 0.9; g.drawImage(F.lanSm, lx - 9, ly - 44);
    g.globalAlpha = s.lan * 0.35 * fl; g.drawImage(F.lanW, lx - 8, ly + 6);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  for (const m of s.motes) { const a = 0.25 + 0.3 * Math.sin(t * 0.9 + m.p); if (a > 0.1 && m.y < ENG - 4) { g.fillStyle = `rgba(255,236,190,${Math.round(a * 8) / 8})`; g.fillRect(ox + Math.round(m.x), Math.round(m.y), 1, 1); } }
}
function drawChime(g, ox, s, P) {
  const C = s.chime, X = ox + CHIME.x, t = s.t, RY = 23;
  fill(g, P.cord, X, 14, 1, RY - 14);
  const rods = C.rods.map((r) => ({ r, x: X + Math.round(Math.cos(r.a) * 7.5), z: Math.sin(r.a) })).sort((a, b) => a.z - b.z);
  const cx = X + Math.round(C.px * 1.1), cy = RY + 13 + Math.round(C.pz * 0.3);
  const rod = ({ r, x, z }) => {
    const n = r.len, sw = clamp(r.sw, -4, 4);
    for (let j = 0; j < n; j++) {
      const xx = x + Math.round((sw * j) / n), lit = r.ring > 0.7 || (r.ring > 0.3 && (j + Math.floor(t * 20)) % 3 === 0);
      fill(g, lit || j < 2 ? P.rod[2] : z < 0 ? P.rod[0] : P.rod[1], xx, RY + 2 + j);
      if (z > 0.2) fill(g, P.rod[0], xx + 1, RY + 2 + j);
    }
  };
  for (const q of rods) if (q.z < 0) rod(q);
  for (let j = 0; j <= 11; j++) fill(g, P.cord, X + Math.round(((cx - X) * j) / 11), RY + 1 + j);
  fill(g, P.wood[1], cx - 2, cy, 5, 2); fill(g, P.wood[2], cx - 1, cy, 3, 1); fill(g, P.wood[0], cx - 2, cy + 1, 1, 1);
  for (const q of rods) if (q.z >= 0) rod(q);
  fill(g, P.wood[2], X - 4, RY - 1, 9, 1); fill(g, P.wood[1], X - 7, RY, 15, 1); fill(g, P.wood[0], X - 6, RY + 1, 13, 1);
  // the paper strip below, catching the wind
  const sx0 = cx + Math.round(C.px * 0.4), tw = Math.cos(C.twist), w = Math.max(1, Math.round(4 * Math.abs(tw)));
  for (let j = 0; j < 5; j++) fill(g, P.cord, Math.round(cx + ((sx0 - cx) * j) / 5), cy + 2 + j);
  for (let j = 0; j < 17; j++) {
    const u = j / 17, off = Math.round(C.px * 0.7 * u + Math.sin(t * 6.5 + j * 0.55) * (0.25 + s.wind * 2.2) * u);
    const x = sx0 - (w >> 1) + off, y = cy + 7 + j;
    fill(g, P.paper[tw > 0 ? 0 : 1], x, y, w, 1);
    if (w >= 3 && tw > 0 && j > 2 && j < 12 && j % 2) fill(g, P.paper[2], x + (w >> 1), y);
    if (w >= 3 && tw > 0 && j === 14) fill(g, P.paper[3], x + (w >> 1), y);
  }
}

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const G = gardenFor(320), s = makeState(11, G);
    s.day = 0.5; s.stage = 1; s.sw = [0, 1, 0]; s.lanOn = true; s.lan = 1;
    for (let i = 0; i < 150; i++) update(s, G, 1 / 30, {});
    s.chime.px = 1.5; s.chime.twist = 0.3;
    for (const k of s.koi) k.d = 0.12;
    s.leaves.push({ x: 96, y: 130, land: 999, ph: 1, spin: 0, c: 4 }, { x: 150, y: 168, land: 999, ph: 0, spin: 0, c: 5 }, { x: 60, y: 150, land: 999, ph: 2, spin: 0, c: 3 });
    s.flies[0].x = 186; s.flies[0].y = 180; s.flies[0].mode = 'hover';
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
  const preW = gardenW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: 320, sx: 0, dx: 0 };
  const timers = new Set();
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  const status = () => setScore(`${STAGES[s.stage]} · lantern ${s.lanOn ? 'lit' : 'unlit'} · ${s.koi.length} koi in the pond`);
  setScore('Click the pond, the chimes, the lantern, the maple…');
  let msgT = 0;
  const hint = setTimeout(() => { if (!msgT) status(); }, 6000);   // cleared on stop, so it never writes over the next scene
  const say = (text) => { clearTimeout(msgT); setScore(text); msgT = setTimeout(() => { msgT = 0; status(); }, 3500); };

  const amb = playAmbience({ rain: 0.25 }, isPaused);   // a soft trickle of water from the spout
  const stopMusic = playLoungeMusic('garden', isPaused);
  let lastStrike = 0, strikes = 0, gulpAt = 0, waterT = 0;
  const hooks = {
    // one rod meeting the clapper: a high, bell-like note with the faint inharmonic ring of a metal bar
    strike(rod, amp) {
      const now = s.t;
      if (now - lastStrike > 1) strikes = 0;
      if (strikes > 5) return;
      strikes += 1; lastStrike = now;
      const v = 0.007 + amp * 0.02;
      tone(rod.m, { dur: 2.4 + amp, vol: v });
      tone(rod.m + 17.55, { dur: 0.8, vol: v * 0.28 });
    },
    gulp() { if (s.t - gulpAt > 0.25) { gulpAt = s.t; drip(0.018, 760, 300); } },
    plop() { splash(0.035); },
    stage() { if (!msgT) status(); },
  };

  const settle = (bw) => {
    const want = gardenW(bw), now = performance.now();
    if (!G) { G = gardenFor(want); s = makeState(Date.now() % 100000, G); }
    if (G.bw !== want) {
      const cached = GARDENS.get(want);
      if (cached) adopt(cached);
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildGarden(want); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && !GARDENS.has(preW)) { job = buildGarden(preW); jobW = preW; preTried = true; }
    }
    if (job) {
      const done = pump(job, jobW === want ? 5 : 3);
      if (done) { keep(done); job = null; jobW = 0; if (done.bw === want) adopt(done); }
    } else if (s.t > 2) {
      // bake ahead the lights likely next (the lantern either way, the next hour) a layer a frame
      const next = [s.stage * 2 + 1 - (s.lanOn ? 1 : 0), Math.min(2, s.stage + 1) * 2 + (s.lanOn ? 1 : 0)];
      for (const k of next) for (const sp of [G.back, G.front, G.padSpr]) if (!sp.img[k]) { spriteImg(G, sp, k); return finishBuf(); }
    }
    finishBuf();
  };
  const finishBuf = () => { if (!B || B.width !== G.bw) { B = document.createElement('canvas'); B.width = G.bw; B.height = H; B.g = B.getContext('2d'); } };
  // a garden of another width: the koi, flies and the rest keep their places; any left on dry
  // ground (a pond lobe that isn't there any more) slip back into the water
  function adopt(N) {
    G = N;
    const want = G.wide ? 9 : 6;
    while (s.koi.length > want) s.koi.pop();
    while (s.koi.length < want) s.koi.push(newKoi(G, s.r, s.koi.length));
    for (const k of s.koi) if (qAt(G, k.x, k.y) < 0.15) { const [x, y] = pondSpot(G, s.r); k.x = x; k.y = y; for (const p of k.pts) { p[0] = x; p[1] = y; } k.tx = x; k.ty = y; }
    for (const d of s.flies) { d.mode = 'hover'; d.perch = -1; d.x = clamp(d.x, G.L + 20, G.RT - 20); }
    while (s.flies.length > (G.wide ? 3 : 2)) s.flies.pop();
    s.food = s.food.filter((f) => qAt(G, f.x, f.y) > 0.05);
    s.floats = s.floats.filter((f) => qAt(G, f.x, f.y) > 0.04);
  }

  // what is under the pointer, as the thing to do if it's clicked (null: nothing there)
  function target(x, y) {
    if (!G) return null;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (inR(CHIME.x - 11, 13, CHIME.x + 11, 64)) return () => {
      const a = s.r() * Math.PI * 2;
      s.chime.vx += Math.cos(a) * 7; s.chime.vz += Math.sin(a) * 7; gust(s, 0.3, 1.2);
      say('The wind chime rings');
    };
    if (inR(CAT.x - 2, CAT.y + 2, CAT.x + 46, CAT.y + 24)) return () => {
      if (!s.cat.pose) { s.cat.pose = 1; s.cat.t = 0; }
      for (let k = 0; k < 7; k++) later(k * 190, () => tone(38 + (k % 2), { dur: 0.24, vol: 0.026, type: 'triangle' }));
      say('The cat stretches, yawns, and settles again');
    };
    if (inR(158, 276, 205, 292)) return () => { s.tea = 2.5; drip(0.03, 620, 280); later(260, () => tone(69, { dur: 0.5, vol: 0.016 })); say('A sip of sencha, still warm'); };
    if (inR(203, 292, 225, 303)) return () => { note(9, { dur: 0.6, vol: 0.026 }); say('Sakura mochi and a little matcha sweet'); };
    if (inR(FAN.x - 11, FAN.y - 5, FAN.x + 18, FAN.y + 9)) return () => {
      gust(s, 0.95, 2.2); swish(0.05); later(240, () => swish(0.035));
      say('A breeze, from the fan');
    };
    if (y >= ENG) return () => { tone(45, { dur: 0.25, vol: 0.03, type: 'triangle' }); say('The boards are warm from the sun'); };
    if (inR(TORO.x - 15, TORO.y - 57, TORO.x + 15, TORO.y)) return () => {
      s.lanOn = !s.lanOn;
      if (s.lanOn) { drip(0.02, 2600, 1900); later(120, () => tone(64, { dur: 1, vol: 0.026, type: 'triangle' })); }
      else { drip(0.02, 900, 380); later(120, () => tone(57, { dur: 0.9, vol: 0.022, type: 'triangle' })); }
      say(s.lanOn ? 'The stone lantern is lit' : 'The lantern is dimmed');
    };
    if (inR(0, 206, 80, 260)) return () => {
      s.tipT = 1.6; amb.set('rain', 0.42); splash(0.04);
      later(1300, () => { tone(50, { dur: 0.16, vol: 0.06, type: 'triangle' }); tone(62, { dur: 0.1, vol: 0.025, type: 'triangle' }); });
      later(2400, () => amb.set('rain', 0.25));
      for (let k = 0; k < 4; k++) s.spray.push({ x: BASIN.x + 13 + k, y: BASIN.y, vx: 5 + k * 2, vy: -6, l: 1 });
      say('The bamboo spout tips and pours');
    };
    if ((s.frog.on && sq(x - 117, y - 228) < 6) || (s.frog.on && inR(112, 223, 123, 232))) return () => { s.frog.jump = 0.5; s.frog.on = false; say('Plop — the frog dives'); };
    if (inR(LOTUS.x - 7, LOTUS.y - 13, LOTUS.x + 7, LOTUS.y + 1)) return () => { s.lotus = 1 - s.lotus; note(s.lotus ? 9 : 6, { dur: 1.2, vol: 0.028 }); say(s.lotus ? 'The lotus opens' : 'The lotus closes for the evening'); };
    const fly = s.flies.find((d) => sq(d.x - x, d.y - y) < 8);
    const reeds = G.reeds.findIndex(([rx, ry, h]) => x > rx - 4 && x < rx + 4 && y > ry - h - 3 && y < ry);
    if (fly || reeds >= 0) return () => {
      const d = fly || s.flies.reduce((b, q) => (sq(q.x - x, q.y - y) < sq(b.x - x, b.y - y) ? q : b));
      landFly(s, G, d, reeds >= 0 ? reeds : Math.floor(s.r() * G.reeds.length));
      tone(93, { dur: 0.12, vol: 0.008 });
      say('A dragonfly rests on a reed');
    };
    const Bg = G.bridge;
    if (Math.abs(x - Bg.x) < Bg.hw + 3 && y > bridgeY(Bg, x) - 12 && y < bridgeY(Bg, x) + 6) return () => {
      [0, 330, 640].forEach((ms, i) => later(ms, () => tone(52 - i, { dur: 0.14, vol: 0.04, type: 'triangle' })));
      say('Footsteps on the old bridge');
    };
    if (qAt(G, x, y) > 0.02) return () => {
      const near = s.koi.find((k) => sq(k.x - x, k.y - y) < 5);
      addRipple(s, x, y, 0.8);
      if (near) { near.dart = 0.8; near.a += Math.PI * (0.6 + s.r() * 0.6); near.dT = 0.9; drip(0.02, 500, 200); say('The koi flicks away'); return; }
      for (let k = 0; k < 4; k++) s.food.push({ x: x + (s.r() - 0.5) * 9, y: y + (s.r() - 0.5) * 4, t: 0, p: s.r() * 6 });
      drip(0.025, 1200, 450); later(140, () => drip(0.015, 1500, 600));
      if (s.t - waterT > 1) say('The koi come up for the food');
      waterT = s.t;
    };
    if (sq((x - 64) / 100, (y - 58) / 56) < 1 || inR(18, 100, 46, 178) || (G.m2 && sq((x - G.m2.x - 30) / 72, (y - 80) / 42) < 1)) return () => {
      s.kick = 1.4; swish(0.06); later(260, () => swish(0.04));
      for (let k = 0; k < 18; k++) later(k * 70, () => spawnLeaf(s, G, s.r, true));
      say('Maple leaves come drifting down');
    };
    if (x > 274 && x < 348 && y < 158) return () => { s.bkick = 1.4; gust(s, 0.4, 1); swish(0.045); say('The bamboo leans and whispers'); };
    if (y < WALL - 8) return () => {
      s.day = [0.4, 0.74, 0.04][s.stage];
      [0, 2, 4].forEach((k, i) => later(i * 160, () => note(6 + k + s.stage, { dur: 1.1, vol: 0.022 })));
      say(`${STAGES[stageOf(s.day)]}`);
    };
    if (y > 236 && x > 232 && qAt(G, x, y) < 0) return () => { swish(0.025); say('Raked gravel, still as water'); };
    return null;
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
