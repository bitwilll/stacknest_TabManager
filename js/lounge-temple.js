// Temple at Dusk — a lounge, not a game: the shrine hall of a Buddhist temple in India as the day
// ends. A great golden Buddha sits in meditation on a lotus throne in a deep red niche, a halo
// behind him, marigolds about his shoulders, butter lamps and water bowls on the steps before him.
// Incense smoke curls up in ribbons from a brass burner at the front. Monks sit chanting along both
// sides (maroon and saffron, an old monk, a young novice), the eldest now and then sounding a
// singing bowl; pilgrims bow with joined palms, one makes slow full prostrations on a wooden board,
// and others walk clockwise past the prayer wheels and turn them. Through cusped arches between
// carved pillars: the dusk sky, prayer flags stirring outside, a Bodhi tree inside its railing where
// birds settle, a brick spire floodlit at night. Lamps gutter and are lit again, sandals wait at
// the threshold, and a temple cat sleeps curled on the lowest step. In full screen the hall goes
// on: more pillars and arches, a stupa in the courtyard, more monks and nuns, side shrines, racks
// of lamps and more pilgrims. (An original scene, in the spirit of the pilgrimage temples.)
// Pixel art, drawn into a buffer 320 px tall (as wide as the frame's shape) and scaled up by whole
// steps with no smoothing. Every still surface is painted once in plain colours, then each pixel
// takes its colour from a short ramp made for that colour (indigo shadow, a neutral middle, lamp
// gold), stepped by the light reaching it; only where two steps meet is there a narrow band of
// ordered dither, and never between the cool and the warm side. The hall is baked once per frame
// width, a slice at a time; each frame only the moving things are drawn over it.

import { setupCanvas, runLoop, pointIn, tone, note, drip, swish, playLoungeMusic, playAmbience, soundOn } from './arcade-kit.js';

export const meta = {
  id: 'temple', title: 'Temple at Dusk',
  blurb: 'Butter lamps, curling incense and quiet chanting in a temple hall as the sky turns.',
  keys: 'Click the bell, the incense, the prayer wheels, the lamps…', lounge: true,
};

const H = 320, CORE = 320;
const FLOOR = 196;                     // where the wall meets the floor
const SKYH = 200;                      // the sky layer's height (it only shows through the arches)
const PITCH = 90;                      // one bay of pillar and arch, beyond the core in full screen
const STEP = 16;                       // hall widths round up to this, so a drag doesn't rebuild every frame
const WALK_Y = 226, WHEEL_Y = 210;     // the circuit before the altar, and before the prayer wheels
const MONK_Y = 256, FRONT_Y = 308;     // the monks' rows, the pilgrims at the front
const BOARD_Y = 239, PROS_X = 106;     // the prostration board's top, where the pilgrim stands on it
const SIDE = '#110b18';                // the edges, for the moment a wider hall is still being built
const TODS = ['dusk', 'night', 'dawn'];
const TODTXT = { dusk: 'Dusk', night: 'Night', dawn: 'First light' };

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
// a stepped level: flat inside each step, a narrow band of ordered dither where two steps meet
const band = (v, x, y) => { const i = Math.floor(v), f = v - i; return f < 0.44 ? i : f > 0.56 ? i + 1 : bay(x, y) < (f - 0.44) / 0.12 ? i + 1 : i; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function mixc(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const sq = (a, b) => Math.sqrt(a * a + b * b);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
function finish(job) { for (;;) { const r = job.next(); if (r.done) return r.value; } }
function pump(job, ms) { const end = performance.now() + ms; for (;;) { const r = job.next(); if (r.done) return r.value; if (performance.now() > end) return null; } }

/* ——— a little raster to paint the still layers and sprites in, pixel by pixel ——— */
class Ras {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
  at(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  bay(x, y) { return bay(Math.floor(x + this.ox), Math.floor(y + this.oy)); }
  px(x, y, c, a = 1) {
    const i = this.at(x, y);
    if (i < 0 || a <= 0) return;
    const d = this.d, r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a), k = da * (1 - a);
    const na = Math.round(oa * 255);   // 254 marks a pixel that glows by itself, never a blend's result
    d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa; d[i + 3] = na >= 253 ? 255 : na;
  }
  solid(x, y) { const i = this.at(x, y); return i >= 0 && this.d[i + 3] > 0; }
  col(x, y) { const i = this.at(x, y); return i < 0 || !this.d[i + 3] ? -1 : (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]; }
  tint(x, y, c, a = 1) { if (this.solid(x, y)) this.px(x, y, c, a); }
  emit(x, y, c) { const i = this.at(x, y); if (i < 0) return; const d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 254; }
  clear(x, y) { const i = this.at(x, y); if (i >= 0) this.d.fill(0, i, i + 4); }
  rect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  trect(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.tint(xx, yy, c, a); }
  dith(x, y, w, h, c, lvl) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.bay(xx, yy) < lvl) this.px(xx, yy, c); }
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
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / (ry + 0.01);
      if (dy < -1 || dy > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) this.px(x, y, c, a);
    }
  }
  clr(cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / (ry + 0.01);
      if (dy < -1 || dy > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) this.clear(x, y);
    }
  }
  thick(x0, y0, x1, y1, r, c) {
    const n = Math.ceil(sq(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c); }
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
  // a dark edge around everything painted so far (sprites)
  outline(c) {
    const on = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.solid(x, y)) continue;
      if (this.solid(x - 1, y) || this.solid(x + 1, y) || this.solid(x, y - 1) || this.solid(x, y + 1)) on.push(x, y);
    }
    for (let i = 0; i < on.length; i += 2) this.px(on[i], on[i + 1], c);
  }
  // the top edge of every shape, in a colour (light catching it)
  rim(c, a = 1, from = -this.ox, to = this.w - this.ox) {
    const on = [];
    for (let y = -this.oy; y < this.h - this.oy; y++) for (let x = from; x < to; x++) if (this.solid(x, y) && !this.solid(x, y - 1)) on.push(x, y);
    for (let i = 0; i < on.length; i += 2) this.px(on[i], on[i + 1], c, a);
  }
  stamp(src, x, y) {
    for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
      const i = (yy * src.w + xx) * 4, a = src.d[i + 3];
      if (!a) continue;
      const c = (src.d[i] << 16) | (src.d[i + 1] << 8) | src.d[i + 2];
      if (a === 254) this.emit(x + xx, y + yy, c); else this.px(x + xx, y + yy, c, a / 255);
    }
  }
  flipped() {
    const R = new Ras(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4, j = (y * this.w + (this.w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) R.d[j + k] = this.d[i + k];
    }
    return R;
  }
  // a bow: every row above the waist leans forward (to +x), the head lowered a little
  bowed(waist, k, drop) {
    const R = new Ras(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (!this.d[i + 3]) continue;
      const up = Math.max(0, waist - y), nx = x + Math.round(up * k), ny = y + Math.round(drop * Math.min(1, up / 8));
      if (nx < 0 || nx >= this.w || ny >= this.h) continue;
      const j = (ny * this.w + nx) * 4;
      for (let q = 0; q < 4; q++) R.d[j + q] = this.d[i + q];
    }
    return R;
  }
  canvas() { return toCanvas(this.d, this.w, this.h); }
}
function toCanvas(d, w, h) {
  const c = mk(w, h);
  c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
  return c;
}
// shapes in a figure's own units (v negative is up from the base line), scaled: a novice is smaller
function painter(R, ax, ay, S) {
  const X = (u) => ax + u * S, Y = (v) => ay + v * S;
  return {
    ell: (u, v, rx, ry, c) => R.ell(X(u), Y(v), rx * S, ry * S, c),
    poly: (pts, c) => R.poly(pts.map(([u, v]) => [X(u), Y(v)]), c),
    thick: (u0, v0, u1, v1, r, c) => R.thick(X(u0), Y(v0), X(u1), Y(v1), r * S, c),
    line: (u0, v0, u1, v1, c) => R.line(X(u0), Y(v0), X(u1), Y(v1), c),
    px: (u, v, c) => R.px(Math.floor(X(u)), Math.floor(Y(v)), c),
    rect: (u, v, w, h, c) => R.rect(Math.floor(X(u)), Math.floor(Y(v)), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S)), c),
  };
}

// a soft glow in a few flat steps, dithered only where the steps meet; drawn with 'lighter'
const GLOWS = new Map();
function glow(rx, ry, c, k = 1, lv = 5) {
  const key = `${rx}|${ry}|${c}|${k}|${lv}`;
  let g = GLOWS.get(key);
  if (g) return g;
  const R = new Ras(rx * 2 + 1, ry * 2 + 1);
  for (let y = 0; y <= ry * 2; y++) for (let x = 0; x <= rx * 2; x++) {
    const d = sq((x - rx) / rx, (y - ry) / ry);
    if (d >= 1) continue;
    const a = band((1 - d) ** 2 * k * lv, x, y) / lv;
    if (a > 0) R.px(x, y, c, Math.min(1, a));
  }
  g = R.canvas();
  GLOWS.set(key, g);
  return g;
}

/* ——— light: colour ramps ———
   For each painted colour, twenty-one lit versions in three families of seven steps: cool (indigo
   shadow up to stone lit by the sky), neutral, and warm (dusky rose up to lamp gold). A pixel's
   step comes from the total light on it, its family from how much of that light is warm. The
   families switch along a smooth contour and are never dithered into one another. */
const CT = [   // intensity, × r g b, + r g b
  [0.20, 0.64, 0.74, 1.22, 8, 9, 26], [0.29, 0.68, 0.80, 1.17, 7, 8, 21], [0.39, 0.74, 0.86, 1.12, 6, 7, 15],
  [0.51, 0.80, 0.92, 1.08, 4, 5, 10], [0.64, 0.86, 0.97, 1.05, 3, 3, 6], [0.78, 0.92, 1.0, 1.02, 1, 1, 2], [0.92, 0.97, 1.01, 1.0, 0, 0, 0],
];
const WT = [
  [0.24, 0.98, 0.76, 0.94, 12, 5, 16], [0.35, 1.06, 0.82, 0.84, 11, 4, 9], [0.47, 1.12, 0.87, 0.75, 10, 4, 4],
  [0.60, 1.16, 0.91, 0.69, 9, 4, 0], [0.75, 1.20, 0.94, 0.66, 10, 5, 0], [0.90, 1.22, 0.97, 0.66, 13, 7, 0], [1.05, 1.24, 1.0, 0.70, 18, 11, 2],
];
const NT = CT.map((c, k) => c.map((v, i) => (v + WT[k][i]) / 2));
const RAMPS = new Map();
function rampOf(c) {
  let rp = RAMPS.get(c);
  if (rp) return rp;
  rp = new Int32Array(21);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  [CT, NT, WT].forEach((T, o) => T.forEach(([I, mr, mg, mb, ar, ag, ab], k) => { rp[o * 7 + k] = (ch(r * I * mr + ar) << 16) | (ch(g * I * mg + ag) << 8) | ch(b * I * mb + ab); }));
  RAMPS.set(c, rp);
  return rp;
}
const sideOf = (wf) => (wf < 0.3 ? 0 : wf < 0.47 ? 7 : 14);

// one lit version of a painted raster whose (0,0) sits at buffer pixel (bx0, by0), a few rows at a
// time. Alpha 254 glows by itself and keeps its colour
function* bakeJob(src, bx0, by0, F, rows = 40) {
  const { w, h, d } = src, out = new Uint8ClampedArray(d.length);
  let lastC = -1, rp = null;
  for (let y = 0; y < h; y++) {
    const Y = by0 + y;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (!al) continue;
      if (al === 254) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = 255; continue; }
      const X = bx0 + x;
      let cool = 0.24, warm = 0.05;
      if (X >= 0 && X < F.bw && Y >= 0 && Y < H) { const j = Y * F.bw + X; cool = F.C[j]; warm = F.W[j]; }
      const tot = cool + warm, lv = Math.min(6, band(clamp((tot - 0.1) / 0.15, 0, 6), X, Y));
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== lastC) { lastC = c; rp = rampOf(c); }
      const o = rp[sideOf(warm / tot) + lv];
      out[i] = o >> 16; out[i + 1] = (o >> 8) & 255; out[i + 2] = o & 255; out[i + 3] = al;
    }
    if (y % rows === rows - 1) yield;
  }
  return toCanvas(out, w, h);
}
const bake = (src, bx0, by0, F) => finish(bakeJob(src, bx0, by0, F, 1e9));
// the lit colour of one painted colour at one buffer point (for the few things drawn per frame)
function litAt(F, X, Y, c) {
  X = clamp(Math.round(X), 0, F.bw - 1); Y = clamp(Math.round(Y), 0, H - 1);
  const j = Y * F.bw + X, cool = F.C[j], warm = F.W[j], tot = cool + warm;
  return rampOf(c)[sideOf(warm / tot) + Math.min(6, Math.round(Math.max(0, (tot - 0.1) / 0.15)))];
}

/* ——— the hall's plan, in core coordinates (the 320-wide square is 0…320; wider frames add bays) ——— */
const ARCH_TOP = 54, ARCH_SPRING = 94, SILL = 176;
const LEFTK = ['stupa', 'shrine', 'palms', 'shrine'], RIGHTK = ['shrine', 'grove', 'shrine', 'palms'];
// robes: Tibetan maroon over a yellow vest, Theravada saffron with the right shoulder bare, nuns
const ROBE = {
  tib: { style: 'tib', robe: 0x8a2228, robeD: 0x5e161c, robeH: 0xb43e3a, vest: 0xe8a82a, vestD: 0xb07818, skin: 0xa87048, skinD: 0x74462a, cush: 0xc8701a },
  thera: { style: 'thera', robe: 0xe48c1c, robeD: 0xa85c0e, robeH: 0xffb44c, vest: 0xe48c1c, vestD: 0xa85c0e, skin: 0x9a6440, skinD: 0x6a4026, cush: 0x7a2e2a },
  nun: { style: 'tib', robe: 0xa0343e, robeD: 0x6e2030, robeH: 0xc8545a, vest: 0xf0c050, vestD: 0xb88a28, skin: 0xb27a52, skinD: 0x7e5034, cush: 0x3a6a7a },
};
function layout(BW) {
  const ox = Math.floor((BW - CORE) / 2), lo = -ox, hi = BW - ox;
  const vis = (a, b) => Math.min(b, hi) - Math.max(a, lo);
  const fits = (a, b) => a >= lo + 1 && b <= hi - 1;
  const L = {
    BW, ox, lo, hi, wide: ox > 0, fits,
    pillars: [8, 92, 214, 298],                                    // left edges; each is 14 wide
    arches: [{ x0: 22, x1: 92, kind: 'tree', cx: 57 }, { x0: 228, x1: 298, kind: 'spire', cx: 263 }],
    lanterns: [57, 263], shrines: [], rows: [{ x0: 232, x1: 300 }], stupas: [],
    monks: [], extras: [], racks: [{ x: 22 }], tables: [{ x: 288 }], offerer: null,
  };
  for (let k = 1; k <= 6; k++) {
    const lp = 8 - PITCH * k, la = { x0: lp + 14, x1: lp + PITCH, kind: LEFTK[(k - 1) % 4], k, side: -1 };
    const rp = 298 + PITCH * k, ra = { x0: rp - PITCH + 14, x1: rp, kind: RIGHTK[(k - 1) % 4], k, side: 1 };
    for (const [p, a] of [[lp, la], [rp, ra]]) {
      if (vis(p - 5, p + 19) > 0) L.pillars.push(p);
      if (vis(a.x0, a.x1) < 30) continue;          // a sliver of a bay at the frame's edge stays plain wall
      a.cx = (a.x0 + a.x1) / 2;
      L.arches.push(a); L.lanterns.push(a.cx);
      if (a.kind === 'shrine') {
        a.wall = true; L.shrines.push(a.cx);
        if (!L.offerer && fits(a.cx - 10, a.cx + 10)) L.offerer = { x: a.cx, y: 207 };
      }
      if (k === 1 && a.side < 0) L.rows.push({ x0: a.x0 + 2, x1: a.x1 - 2 });
      if (a.kind === 'stupa' && fits(a.cx - 30, a.cx + 30)) L.stupas.push(a.cx);
    }
  }
  // the monks' rows, out from the aisle: an old monk with the singing bowl, a Theravada monk, a
  // novice...; in full screen nuns and more monks carry the rows into the side bays
  const LEFTM = [['tib', 'old'], ['thera'], ['tib'], ['nun'], ['nun'], ['tib', 'novice']];
  const RIGHTM = [['tib', 'novice'], ['thera'], ['tib'], ['tib'], ['thera'], ['nun', 'novice']];
  for (let i = 0; i < 6; i++) {
    for (const [x, side, def] of [[70 - 28 * i, 1, LEFTM[i]], [250 + 28 * i, -1, RIGHTM[i]]]) {
      if (!fits(x - 12, x + 12)) continue;
      L.monks.push({ x, side, v: ROBE[def[0]], old: def[1] === 'old', novice: def[1] === 'novice', lead: i === 0 && side > 0, key: `m${x}` });
    }
  }
  // more pilgrims (and lamps, offerings) out in the side bays, only where they fit whole
  const LX = [['wheelman', -40, 15], ['sitter', -102, 14], ['rack', -152, 22], ['lady', -196, 12], ['table', -246, 28]];
  const RX = [['lady', 344, 12], ['sitter', 418, 14], ['rack', 470, 22], ['wheelman', 524, 15], ['table', 580, 28]];
  for (const [kind, x, hw] of [...LX, ...RX]) {
    if (!fits(x - hw, x + hw)) continue;
    if (kind === 'rack') L.racks.push({ x });
    else if (kind === 'table') L.tables.push({ x });
    else L.extras.push({ kind, x, y: kind === 'lady' ? FRONT_Y : FRONT_Y - 1, key: `x${kind}${x}` });
  }
  L.wheels = [];
  for (const r of L.rows) {
    const n = Math.floor((r.x1 - r.x0 - 2) / 11), s0 = r.x0 + (r.x1 - r.x0 - n * 11) / 2 + 5.5;
    for (let i = 0; i < n; i++) { const x = Math.round(s0 + i * 11); if (fits(x - 5, x + 5)) L.wheels.push({ x, row: r }); }
  }
  return L;
}
// the circuit: in front of the altar, and up close to the prayer wheels wherever there is a row
function walkY(L, x) {
  let lift = 0;
  for (const r of L.rows) { const d = x < r.x0 + 8 ? r.x0 + 8 - x : x > r.x1 - 6 ? x - (r.x1 - 6) : 0; lift = Math.max(lift, ease(1 - d / 16)); }
  return WALK_Y - (WALK_Y - WHEEL_Y) * lift;
}

// the light reaching a point of the hall (core coordinates): cool from the sky through the arches
// and the dusk itself, warm from the butter lamps, the halo, the lanterns, the shrines and racks
function coolAt(L, cx, cy) {
  let v = 0.24;
  for (const a of L.arches) {
    if (a.wall) continue;
    const dx = cx < a.x0 ? a.x0 - cx : cx > a.x1 ? cx - a.x1 : 0;
    const dy = cy < ARCH_TOP ? ARCH_TOP - cy : cy > SILL ? (cy - SILL) * 0.75 : 0;
    v += Math.max(0, 1 - sq(dx, dy) / 48) ** 2 * 0.3;
  }
  const vx = (cx - 160) / (L.BW / 2 + 70), vy = (cy - 170) / 260;
  return v * (1 - Math.min(0.35, (vx * vx + vy * vy) * 0.55));
}
function warmAt(L, cx, cy) {
  let v = 0.07;
  v += Math.max(0, 1 - sq((cx - 160) / 1.35, (cy - 210) * (cy < FLOOR ? 1.25 : 0.9)) / 118) ** 1.6 * 0.8;   // the altar's lamps
  v += Math.max(0, 1 - sq(cx - 160, (cy - 92) * 0.85) / 56) ** 1.6 * 0.42;                                  // the halo
  for (const lx of L.lanterns) v += Math.max(0, 1 - sq(cx - lx, (cy - 42) * 1.1) / 40) ** 1.8 * 0.32;
  for (const sx of L.shrines) v += Math.max(0, 1 - sq((cx - sx) / 1.25, (cy - 176) * (cy > 186 ? 1.4 : 1.1)) / 50) ** 1.5 * 0.62;
  for (const sx of [86, 234]) v += Math.max(0, 1 - sq((cx - sx) / 1.2, (cy - 192) * 1.1) / 36) ** 1.6 * 0.3;   // the tall lamp stands
  for (const rk of L.racks) v += Math.max(0, 1 - sq((cx - rk.x) / 1.3, (cy - 290) * 1.05) / 62) ** 1.4 * 0.62;
  for (const tb of L.tables) v += Math.max(0, 1 - sq((cx - tb.x - 21) / 1.2, cy - 287) / 34) ** 1.5 * 0.3;
  v += Math.max(0, 1 - sq((cx - 94) / 1.3, cy - 250) / 26) ** 2 * 0.22;                                     // the bowl's lamp
  v += Math.max(0, 1 - sq((cx - 160) / 1.4, cy - 270) / 40) ** 1.5 * 0.14;                                 // the incense tips
  return v;
}
function* fieldJob(L) {
  const { BW, ox } = L, n = BW * H, C = new Float32Array(n), W = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < BW; X++) { const cx = X - ox, j = y * BW + X; C[j] = coolAt(L, cx, y); W[j] = warmAt(L, cx, y); }
    if (y % 12 === 11) yield;
  }
  return { bw: BW, C, W };
}

/* ——— the sky through the arches: dusk, night, dawn ——— */
const SKIES = {
  dusk: { g: [0x1c1b4a, 0x272459, 0x3a2b68, 0x5a3672, 0x864272, 0xb2546c, 0xd8705e, 0xf09658, 0xfbbd70], sil: 0x2a1a32, far: 0x5c3858, rim: 0xff9c62, sun: [250, 0xffd890] },
  night: { g: [0x04061a, 0x060a21, 0x090f2a, 0x0c1433, 0x101a3c, 0x152044, 0x1b264a, 0x222c50, 0x2c3256], sil: 0x06081a, far: 0x12182e, rim: 0x3a4a7a, sun: null },
  dawn: { g: [0x2b3a6c, 0x37477a, 0x4a5888, 0x666a96, 0x8c7ca0, 0xb48ea2, 0xdaa49e, 0xf2c098, 0xffdcaa], sil: 0x3a2c48, far: 0x86687e, rim: 0xffd09a, sun: [40, 0xfff0c0] },
};
const FLAGC = [0x3a6ad0, 0xf0ece0, 0xd84040, 0x3a9a5a, 0xf0c030];   // blue, white, red, green, yellow
const sag = (x0, y0, x1, y1, d, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * d]; });

// the Bodhi tree inside its stone railing: a thick trunk on buttress roots, a broad crown with the
// sky showing through, heart-shaped leaves along its edge, cloths tied to the lower branches
function bodhiTree(S, a, c, detail, r, tod) {
  const cx = a.cx - 4, tx = a.x1 - 12;
  for (let i = 0; i < 44; i++) {
    const an = r() * Math.PI * 2, d = Math.sqrt(r());
    S.ell(cx + Math.cos(an) * d * 38, 108 + Math.sin(an) * d * 22 - (1 - d) * 4, 6 + r() * 6, 4 + r() * 4.5, c);
  }
  for (let i = 0; i < 10; i++) {   // gaps where the sky shows through
    const x = cx - 30 + r() * 60, y = 96 + r() * 26;
    if (S.solid(x - 4, y) && S.solid(x + 4, y) && S.solid(x, y - 4) && S.solid(x, y + 4)) S.clr(x, y, 1.6 + r() * 2.2, 1.2 + r() * 1.4);
  }
  // the trunk, its roots and the main limbs (drawn through the gaps)
  S.thick(tx, 176, tx - 2, 146, 3.6, c); S.thick(tx - 2, 150, tx - 3, 132, 2.6, c);
  S.thick(tx, 174, tx - 9, 178, 1.8, c); S.thick(tx, 174, tx + 8, 178, 1.8, c); S.ell(tx, 175, 7, 2.4, c);
  S.thick(tx - 2, 148, tx - 22, 122, 2.2, c); S.thick(tx - 1, 144, tx + 8, 120, 1.8, c);
  S.thick(tx - 12, 134, tx - 36, 120, 1.4, c); S.thick(tx - 3, 136, tx - 6, 110, 1.6, c); S.thick(tx - 22, 124, tx - 30, 106, 1.2, c);
  // bark: a little light down the trunk's edge
  for (let y = 140; y < 172; y += 2) S.px(tx + 2, y, detail);
  // heart-shaped leaves with drip tips along the crown's edge
  for (let k = 0; k < 220; k++) {
    const x = Math.round(cx - 46 + r() * 92), y = Math.round(84 + r() * 52);
    if (!S.solid(x, y) || S.solid(x, y - 1)) continue;
    S.px(x - 1, y - 2, c); S.px(x + 1, y - 2, c); S.px(x - 1, y - 1, c); S.px(x, y - 1, c); S.px(x + 1, y - 1, c);
    if (r() < 0.4 && !S.solid(x, y + 3)) { S.px(x, y + 1, c); S.px(x, y + 2, c); }
  }
  // leafy clumps catching a little light, so the crown has depth
  for (let k = 0; k < 80; k++) {
    const x = Math.round(cx - 34 + r() * 68), y = Math.round(90 + r() * 40);
    if (!S.solid(x, y) || !S.solid(x, y - 3) || !S.solid(x + 3, y + 1)) continue;
    S.rect(x, y, 3, 1, detail); S.px(x + 1, y - 1, detail); if (r() < 0.5) S.px(x - 1, y + 1, detail);
  }
  // cloths tied to the lower limbs
  const mute = tod === 'night' ? 0.78 : 0.5;
  for (const [x, y, k] of [[tx - 14, 132, 2], [tx - 8, 140, 4], [tx - 26, 126, 0], [tx + 4, 128, 1], [tx - 30, 122, 3]]) {
    const fc = mixc(FLAGC[k], c, mute);
    S.px(x, y, fc); S.px(x + 1, y, fc); S.px(x, y + 1, fc); S.px(x + 1, y + 1, fc); S.px(x, y + 2, mixc(fc, c, 0.3));
  }
  // the low stone railing round it, posts and three rails
  for (let x = a.x0 - 2; x <= a.x1 + 2; x++) { for (const y of [165, 169, 173]) S.px(x, y, c); S.px(x, 176, c); }
  for (let x = a.x0 + 1; x <= a.x1; x += 8) { S.rect(x, 162, 2, 15, c); S.px(x, 161, c); S.px(x + 1, 161, detail); for (const y of [165, 169, 173]) S.px(x + 2, y, detail); }
}
function spire(S, cx, c, detail, flood) {
  // floodlit at night: warm light from below, fading up the tower
  const col = (y) => (flood ? mixc(c, 0xc8884a, clamp(0.12 + ((y - 50) / 126) ** 1.3 * 0.7, 0, 0.82)) : c);
  const det = (y) => (flood ? mixc(col(y), 0xffd498, 0.32) : detail);
  for (let y = 160; y < 178; y++) S.rect(cx - (y < 164 ? 30 : 36), y, y < 164 ? 61 : 73, 1, col(y));
  for (const dx of [-26, 26]) {   // the corner towers
    for (let y = 126; y < 160; y++) { const hw = Math.round(1.5 + 4 * ((y - 126) / 34)); S.rect(cx + dx - hw, y, hw * 2 + 1, 1, col(y)); }
    S.ell(cx + dx, 125, 2.5, 1.2, col(125)); S.px(cx + dx, 122, col(122)); S.px(cx + dx, 123, col(123));
  }
  for (let y = 74; y < 160; y++) { const hw = Math.round(5 + 12 * ((y - 74) / 86) ** 0.85); S.rect(cx - hw, y, hw * 2 + 1, 1, col(y)); }
  // tiers and niches, just lighter than the silhouette (bright edges and dark niches when floodlit)
  for (let y = 80; y < 158; y += 7) {
    const hw = Math.round(5 + 12 * ((y - 74) / 86) ** 0.85);
    S.rect(cx - hw, y, hw * 2 + 1, 1, det(y));
    for (let x = cx - hw + 3; x < cx + hw - 2; x += 4) { S.px(x, y + 3, flood ? mixc(col(y), 0x1a0c10, 0.45) : mixc(detail, c, 0.6)); if (flood) S.px(x, y + 4, mixc(col(y), 0x1a0c10, 0.3)); }
  }
  if (flood) for (let y = 164; y < 178; y += 3) for (let x = cx - 33; x < cx + 33; x += 6) S.px(x, y, mixc(col(y), 0x1a0c10, 0.4));
  S.ell(cx, 71, 7, 2.6, col(71)); for (let x = cx - 6; x <= cx + 6; x += 2) S.px(x, 71, det(71));
  S.rect(cx - 2, 64, 5, 5, col(64)); S.rect(cx - 3, 62, 7, 2, col(62)); S.rect(cx - 1, 56, 3, 6, col(56)); S.px(cx, 53, col(53)); S.px(cx, 54, col(54)); S.px(cx, 55, col(55));
}
function stupa(S, cx, c, detail) {
  S.rect(cx - 32, 166, 64, 12, c); S.rect(cx - 25, 160, 50, 6, c);
  S.ell(cx, 160, 22, 19, c);
  S.rect(cx - 5, 134, 11, 7, c); S.rect(cx - 6, 133, 13, 1, detail);
  for (let i = 0; i < 9; i++) { const hw = Math.round(5 - i * 0.45); S.rect(cx - hw, 131 - i * 2.4, hw * 2 + 1, 2, i % 2 ? detail : c); }
  S.px(cx, 108, c); S.px(cx, 109, c);
  S.rect(cx - 22, 152, 45, 1, detail);
  for (let x = cx - 30; x <= cx + 30; x += 6) S.px(x, 170, detail);
}
function palms(S, cx, c, r) {
  for (const [dx, h, lean] of [[-14, 50, -0.25], [10, 62, 0.2], [22, 40, 0.35]]) {
    const bx = cx + dx, tx = bx + lean * h, ty = 176 - h;
    for (let k = 0; k <= h; k++) S.px(Math.round(bx + lean * k + Math.sin(k / 9) * 1.2), 176 - k, c);
    S.px(Math.round(bx + 1), 175, c);
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI * (0.05 + f * 0.15) + (r() - 0.5) * 0.2, len = 10 + r() * 6;
      for (let k = 0; k <= len; k++) S.px(Math.round(tx + Math.cos(a) * k), Math.round(ty + Math.sin(a) * k * 0.6 + (k / len) ** 2 * 6), c);
    }
  }
  // a little domed pavilion
  S.rect(cx - 30, 160, 16, 16, c); S.ell(cx - 22, 158, 8, 6, c); S.rect(cx - 22, 148, 1, 5, c);
}
function grove(S, cx, c, detail, r) {
  for (const [dx, rad, tall] of [[-20, 14, 30], [14, 17, 40], [34, 10, 22]]) {
    S.thick(cx + dx, 176, cx + dx, 176 - tall + rad, 1.5, c);
    for (let i = 0; i < 12; i++) S.ell(cx + dx + (r() - 0.5) * rad * 1.4, 176 - tall + (r() - 0.5) * rad, rad * 0.5, rad * 0.45, c);
  }
  // a small whitewashed chorten among the trees
  S.rect(cx - 6, 166, 12, 10, detail); S.ell(cx, 164, 5, 4, detail); S.rect(cx - 1, 154, 3, 7, detail); S.px(cx, 152, detail);
}
// strings of prayer flags outside, where the wind can carry the prayers: from the spire, across the
// tree, from the stupa's spire to the ground
function flagStrings(L) {
  const out = [];
  const add = (x0, y0, x1, y1, d) => out.push(sag(x0, y0, x1, y1, d, 18));
  for (const a of L.arches) {
    if (a.wall) continue;
    const cx = a.cx;
    if (a.kind === 'tree') { add(a.x0 + 1, 112, a.x1 - 1, 98, 9); add(a.x0 + 1, 136, a.x1 - 14, 126, 5); }
    else if (a.kind === 'spire') { const tx = cx + 4; add(tx, 66, a.x0 - 4, 148, 5); add(tx, 66, a.x1 + 4, 148, 5); add(tx, 96, a.x0 + 1, 170, 3); add(tx, 96, a.x1 - 1, 170, 3); }
    else if (a.kind === 'stupa') { for (const ex of [-48, 48, -30, 30]) add(cx, 112, cx + ex, Math.abs(ex) > 40 ? 172 : 168, 5); }
    else if (a.kind === 'palms') add(cx - 24, 128, cx + 20, 116, 6);
    else if (a.kind === 'grove') add(cx - 22, 146, cx + 14, 138, 5);
  }
  return out;
}

function* skyJob(L, tod) {
  const P = SKIES[tod], { BW, ox } = L, r = rng(4242);
  const R = new Ras(BW, SKYH, ox, 0);
  const g = P.g, n = g.length - 1;
  for (let y = 0; y < SKYH; y++) {
    const t = Math.max(0, Math.min(1, (y - 26) / 150)) ** 1.15 * n, i0 = Math.min(n - 1, Math.floor(t)), f = t - i0;
    for (let x = -ox; x < BW - ox; x++) R.px(x, y, f > R.bay(x, y) ? g[i0 + 1] : g[i0]);
    if (y % 50 === 49) yield;
  }
  // where the sun has just gone (or is about to come)
  if (P.sun) {
    const [sx, sc] = P.sun;
    for (let y = 110; y < 178; y++) for (let x = -ox; x < BW - ox; x++) {
      const d = sq((x - sx) / 92, (y - 180) / 34);
      if (d < 1) { const lv = band((1 - d) * 3, x, y) / 3; if (lv > 0) R.px(x, y, sc, lv * 0.55); }
    }
    yield;
  }
  // long thin clouds catching the colour
  for (let k = 0; k < Math.round(BW / 40); k++) {
    const cx = -ox + r() * BW, cy = 96 + r() * 56, w = 18 + r() * 40;
    const cc = tod === 'night' ? mixc(g[3], 0x404a70, 0.3) : mixc(g[Math.min(n, Math.floor(cy / 22))], P.rim, 0.45);
    R.ell(cx, cy, w, 1.2, cc, 0.85); R.ell(cx + w * 0.3, cy - 1, w * 0.5, 1, mixc(cc, 0xffffff, tod === 'night' ? 0.05 : 0.25), 0.8);
  }
  // the moon, at night
  if (tod === 'night') {
    for (let y = 60; y < 96; y++) for (let x = 226; x < 266; x++) { const d = sq(x - 246, y - 77) / 18; if (d < 1 && bay(x, y) < (1 - d) * 0.5) R.px(x, y, 0x3a4a78); }
    R.ell(246, 77, 6, 6, 0xf4f0d8); R.ell(249, 75, 5.5, 5.5, g[2]);
  }
  yield;
  // far trees and roofs along the horizon, then the near silhouettes behind each arch
  const far = new Ras(BW, SKYH, ox, 0), S = new Ras(BW, SKYH, ox, 0);
  for (let x = -ox; x < BW - ox; x++) {
    const h = 6 + Math.round(3 * Math.sin(x * 0.11) + 2 * Math.sin(x * 0.37 + 1) + (bay(x, 3) > 0.7 ? 1 : 0));
    far.rect(x, 172 - h, 1, h + 28, P.far);
  }
  const detail = mixc(P.sil, P.far, 0.45);
  for (const a of L.arches) {
    if (a.wall) continue;
    const cx = Math.round(a.cx);
    if (a.kind === 'tree') bodhiTree(S, a, P.sil, mixc(P.sil, P.far, 0.3), rng(77), tod);
    else if (a.kind === 'spire') spire(S, cx + 4, P.sil, detail, tod === 'night');
    else if (a.kind === 'stupa') stupa(S, cx, P.sil, detail);
    else if (a.kind === 'palms') palms(S, cx, P.sil, rng(31 + a.x0));
    else if (a.kind === 'grove') grove(S, cx, P.sil, tod === 'night' ? mixc(P.sil, 0x8090b0, 0.3) : mixc(0xf0e6d6, P.sil, 0.45), rng(53 + a.x0));
    yield;
  }
  S.rect(-ox, 177, BW, SKYH - 177, P.sil);
  far.rim(P.rim, tod === 'night' ? 0.25 : 0.4);
  S.rim(P.rim, tod === 'night' ? 0.3 : 0.6);
  R.stamp(far, -ox, 0); R.stamp(S, -ox, 0);
  // the flags' strings (the flags themselves move, drawn each frame)
  const sc = mixc(P.sil, 0x8a7a6a, 0.25);
  for (const pts of flagStrings(L)) for (let i = 0; i + 1 < pts.length; i++) R.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], sc);
  return { cv: R.canvas(), mask: S };
}

/* ——— the hall: painted once in plain colours, then lit ——— */
const C = {
  beam: 0x5e3a24, beamD: 0x3a2216, beamL: 0x8a5a3a, coffer: 0x22404c, cofferD: 0x162a34,
  plaster: 0xc8925a, plasterD: 0xb07e4c, dado: 0x8a2a26, dadoD: 0x6a1e1e,
  gold: 0xe2aa42, goldH: 0xffd878, goldM: 0xc08a30, goldD: 0x8a5a1c, goldK: 0x3a220c,
  stone: 0xcaa67c, stoneL: 0xe4c69a, stoneS: 0x9c7c5a, stoneD: 0x6c5440,
  floor: 0x9a7a60, floor2: 0x8e7058, grout: 0x645040,
  maroon: 0x8a2228, maroonD: 0x641820, maroonH: 0xac3a3a, saffron: 0xe8901e, saffronD: 0xb8660e,
  mari: 0xf08a1a, mariY: 0xffb428, mariD: 0xa84a08,
  lotus: 0xf2a4bc, lotusD: 0xd87896, lotusL: 0xffdce4, leaf: 0x3a7a4a, leafD: 0x24543a,
  brass: 0xc8963a, brassH: 0xf2cc68, brassD: 0x7a5420, bronze: 0x8a6434, bronzeD: 0x5a3e20, bronzeH: 0xc89a54, verd: 0x4a8a72,
  red: 0xa02a2a, niche: 0x6a1e22, nicheD: 0x44121a, water: 0x9ccad8,
  runner: 0x7a1e26, runnerD: 0x5a1420, wood: 0x5a3220, woodD: 0x3a1e12, woodL: 0x8a5432, plank: 0xb07a44, plankD: 0x7a4e26,
  lacq: 0x9a2a22, lacqD: 0x6a1a16, cream: 0xf0e4c8, creamD: 0xd0c0a0, ash: 0x7a6a5c, ashL: 0x9a8a7a,
};
const VAL = [0xe8b832, 0x2e8a5a, 0xc03a32, 0xece6d8, 0x2e5aa8];   // the valance: yellow, green, red, white, blue
const VP = { x: 160, y: 120 };    // the floor's vanishing point

// a cusped, slightly pointed arch: the top of the opening at x, for an arch centred at cx
function archTop(x, cx, hw, top, spring) {
  const u = Math.min(1, Math.abs(x - cx) / hw);
  return spring - (spring - top) * (1 - u) ** 0.55 + (u < 0.9 ? 2.2 * Math.abs(Math.sin(u * Math.PI * 2.5)) : 0);
}
// marigold beads along a curve
function garland(R, pts, n) {
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, seg = t * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(seg)), f = seg - j;
    const x = Math.round(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f), y = Math.round(pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f);
    const c = k++ % 2 ? C.mari : C.mariY;
    R.rect(x, y, 2, 2, c); R.px(x, y, mixc(c, 0xffffff, 0.3)); R.px(x + 1, y + 2, C.mariD);
  }
}
// a butter lamp: a little brass chalice (cup, stem, foot) with its wick at (x, y)
function lamp(R, L, x, y, id, grp) {
  R.px(x, y, C.goldK);
  R.rect(x - 1, y + 1, 3, 1, C.brassH); R.px(x + 1, y + 1, C.brass);
  R.px(x, y + 2, C.brass);
  R.rect(x - 1, y + 3, 3, 1, C.brassD);
  L.flames.push({ id, x, y, grp });
}

function paintShell(R, L) {
  const x0 = L.lo, x1 = L.hi;
  // the ceiling: joists, and between them coffered panels, each with a gilded lotus
  R.rect(x0, 0, L.BW, 17, C.beamD);
  for (let x = Math.floor(x0 / 16) * 16; x < x1; x += 16) {
    R.rect(x, 0, 4, 16, C.beam); R.rect(x, 0, 1, 16, C.beamL); R.rect(x + 3, 0, 1, 16, C.beamD);
    R.rect(x + 5, 2, 10, 12, C.coffer); R.rect(x + 5, 2, 10, 1, C.cofferD); R.rect(x + 5, 2, 1, 12, C.cofferD); R.rect(x + 5, 13, 10, 1, C.goldD);
    const cx = x + 10, cy = 8;
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; R.px(Math.round(cx - 0.5 + Math.cos(a) * 3.4), Math.round(cy - 0.5 + Math.sin(a) * 3.4), k % 2 ? C.goldD : C.goldM); }
    R.rect(cx - 2, cy - 2, 3, 3, C.red); R.px(cx - 1, cy - 1, C.gold); R.px(cx - 1, cy - 2, C.goldH);
  }
  R.rect(x0, 16, L.BW, 8, C.beam); R.rect(x0, 16, L.BW, 1, C.beamL); R.rect(x0, 23, L.BW, 1, C.beamD);
  for (let x = x0; x < x1; x += 3) R.px(x, 20, C.goldD);
  R.rect(x0, 24, L.BW, 9, C.dado); R.rect(x0, 24, L.BW, 1, C.goldM); R.rect(x0, 32, L.BW, 1, C.goldM);
  for (let x = Math.floor(x0 / 10) * 10; x < x1; x += 10) {
    R.px(x + 5, 26, C.gold); R.rect(x + 4, 27, 3, 2, C.gold); R.px(x + 3, 28, C.goldM); R.px(x + 7, 28, C.goldM); R.px(x + 5, 30, C.goldM);
    R.px(x, 28, C.goldD);
  }
  // plastered walls, a red dado with gold trim
  R.rect(x0, 33, L.BW, FLOOR - 33, C.plaster);
  R.dith(x0, 33, L.BW, 117, C.plasterD, 0.06);
  R.rect(x0, 150, L.BW, FLOOR - 150, C.dado); R.rect(x0, 150, L.BW, 1, C.goldM); R.rect(x0, 152, L.BW, 1, C.goldD);
  for (let x = Math.floor(x0 / 12) * 12; x < x1; x += 12) { R.px(x + 6, 164, C.goldD); R.px(x + 5, 165, C.goldD); R.px(x + 7, 165, C.goldD); R.px(x + 6, 166, C.goldD); }
  R.rect(x0, FLOOR - 4, L.BW, 4, C.dadoD);
}

// a ruffled valance in the five colours under the beam, between the pillars' capitals; silk
// ribbons hang from its ends (they move, drawn each frame)
function paintValance(R, L) {
  const ps = [...L.pillars].sort((a, b) => a - b);
  L.ribbons = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const a = ps[i] + 20, b = ps[i + 1] - 7;
    if (b - a < 20 || (a < 160 && b > 160)) continue;   // never across the Buddha's torana
    R.rect(a - 1, 33, b - a + 3, 1, C.goldD);
    for (let li = 4; li >= 0; li--) {
      const top = 34 + li * 2, c = VAL[li], cd = mixc(c, 0x000000, 0.16), cl = mixc(c, 0x000000, 0.3);
      for (let x = a; x <= b; x++) {
        const u = (x - a + li * 3) % 6;
        R.px(x, top, (x - a) % 2 ? cd : c); R.px(x, top + 1, (x - a) % 2 ? cd : c);
        if (u >= 1 && u <= 4) R.px(x, top + 2, cl);
      }
    }
    L.ribbons.push({ x: a + 1, ph: a * 0.31 }, { x: b - 1, ph: b * 0.29 + 1 });
  }
}

function paintArch(R, a, L) {
  const cx = (a.x0 + a.x1) / 2, hw = (a.x1 - a.x0) / 2 - 4;
  if (a.wall) return paintShrine(R, a, cx, L);
  for (let x = a.x0; x <= a.x1; x++) {
    if (x < a.x0 + 4 || x > a.x1 - 4) {   // the jambs
      const edge = x === a.x0 + 3 || x === a.x1 - 3;
      R.rect(x, ARCH_SPRING - 3, 1, SILL - ARCH_SPRING + 3, edge ? C.stoneL : x === a.x0 || x === a.x1 ? C.stoneD : C.stone);
      continue;
    }
    const yt = Math.round(archTop(x, cx, hw, ARCH_TOP, ARCH_SPRING));
    R.rect(x, yt - 4, 1, 1, C.stoneD); R.rect(x, yt - 3, 1, 2, C.stone); R.px(x, yt - 1, C.stoneL);
    for (let y = yt; y < SILL; y++) R.clear(x, y);
  }
  R.rect(a.x0 - 1, ARCH_SPRING - 4, 6, 2, C.stoneL); R.rect(a.x1 - 4, ARCH_SPRING - 4, 6, 2, C.stoneL);
  // rosettes in the spandrels, a lotus medallion over the crown
  for (const sx of [a.x0 + 7, a.x1 - 7]) { R.ell(sx, ARCH_TOP + 6, 3, 3, C.goldM); R.ell(sx, ARCH_TOP + 6, 1.5, 1.5, C.red); }
  R.ell(cx, ARCH_TOP - 8, 4, 3, C.goldM); R.ell(cx, ARCH_TOP - 8, 2, 1.5, C.gold); R.px(cx - 0.5, ARCH_TOP - 9, C.goldH);
  // a pierced stone screen below the opening
  R.rect(a.x0, SILL, a.x1 - a.x0 + 1, 3, C.stoneL); R.rect(a.x0, SILL + 2, a.x1 - a.x0 + 1, 1, C.stoneS);
  R.rect(a.x0, SILL + 3, a.x1 - a.x0 + 1, FLOOR - SILL - 3, C.stone);
  for (let y = SILL + 4; y < FLOOR - 4; y++) for (let x = a.x0 + 2; x < a.x1 - 1; x++) {
    const dx = (x - a.x0) % 6, dy = (y - SILL - 4) % 6;
    if (Math.abs(dx - 3) + Math.abs(dy - 2) <= 1) R.clear(x, y);
    else if (Math.abs(dx - 3) + Math.abs(dy - 2) === 2 && dy < 2) R.px(x, y, C.stoneS);
  }
  R.rect(a.x0, FLOOR - 3, a.x1 - a.x0 + 1, 3, C.stoneS);
}

function paintPillar(R, x) {
  const ramp = [C.stoneD, C.stoneS, C.stoneS, C.stone, C.stone, C.stone, C.stoneL, C.stoneL, C.stone, C.stone, C.stone, C.stoneS, C.stoneS, C.stoneD];
  R.rect(x - 2, 33, 18, 7, C.stoneS); R.rect(x - 2, 33, 18, 1, C.stone);
  for (let i = 0; i < 14; i++) R.rect(x + i, 62, 1, 122, ramp[i]);
  // the capital: a bracket over a full pot spilling foliage
  R.rect(x - 5, 40, 24, 3, C.stoneL); R.rect(x - 5, 43, 24, 3, C.stone); R.rect(x - 4, 46, 22, 2, C.stoneS);
  R.px(x - 5, 44, C.stoneD); R.px(x - 4, 45, C.stoneD); R.px(x + 18, 44, C.stoneD); R.px(x + 17, 45, C.stoneD);
  for (let i = 0; i < 18; i++) if (i % 3 !== 1) R.px(x - 2 + i, 48 + (i % 2), C.stoneL);
  R.rect(x - 2, 48, 18, 4, C.stone); for (let i = 0; i < 18; i += 3) { R.px(x - 2 + i, 49, C.stoneL); R.px(x - 1 + i, 51, C.stoneS); }
  R.ell(x + 7, 57, 8, 5, C.stone); R.ell(x + 5, 56, 3, 2, C.stoneL); R.rect(x - 1, 61, 16, 1, C.stoneS);
  // carved bands: a chain of little bells, faceted sections
  R.rect(x - 1, 98, 16, 6, C.stone); R.rect(x - 1, 98, 16, 1, C.stoneL); R.rect(x - 1, 103, 16, 1, C.stoneD);
  for (let i = 1; i < 14; i += 4) { R.px(x + i, 100, C.stoneD); R.px(x + i + 1, 100, C.stoneD); R.px(x + i, 101, C.stoneS); }
  R.rect(x, 116, 14, 1, C.stoneD);
  for (let i = 2; i < 13; i += 4) { R.rect(x + i, 118, 3, 3, C.stoneS); R.px(x + i + 1, 121, C.stoneD); R.px(x + i, 118, C.stoneL); }
  for (let y = 140; y < 160; y++) for (let i = 0; i < 14; i += 2) R.px(x + i, y, mixc(ramp[i], C.stoneD, 0.25));
  R.rect(x - 1, 139, 16, 1, C.stoneL); R.rect(x - 1, 160, 16, 1, C.stoneS);
  // the base
  R.rect(x - 1, 180, 16, 4, C.stone); R.rect(x - 1, 180, 16, 1, C.stoneL);
  R.rect(x - 3, 184, 20, FLOOR - 184, C.stone); R.rect(x - 3, 184, 20, 1, C.stoneL); R.rect(x - 3, 189, 20, 1, C.stoneS); R.rect(x - 3, FLOOR - 1, 20, 1, C.stoneD);
}

function paintShrine(R, a, cx, L) {
  const l = a.x0 + 12, r = a.x1 - 12, hw = (r - l) / 2;
  for (let x = l - 3; x <= r + 3; x++) {
    const yt = Math.round(archTop(x, cx, hw + 3, 82, 104));
    R.rect(x, yt, 1, 186 - yt, C.stone);
  }
  for (let x = l; x <= r; x++) {
    const yt = Math.round(archTop(x, cx, hw, 86, 106));
    for (let y = yt; y < 184; y++) R.px(x, y, (y - yt) < 6 ? C.nicheD : C.niche);
    R.px(x, yt, C.goldM);
  }
  // a painted cloth behind a small golden Buddha on his lotus, a halo, lamps on the ledge
  R.rect(cx - 13, 100, 27, 52, 0x2a5a66); R.rect(cx - 13, 100, 27, 2, C.red); R.rect(cx - 13, 150, 27, 2, C.red);
  R.rect(cx - 13, 100, 1, 52, C.goldM); R.rect(cx + 13, 100, 1, 52, C.goldM);
  for (let y = 104; y < 148; y += 6) for (let x = cx - 11; x < cx + 12; x += 6) R.px(x + ((y / 6) % 2) * 3, y, 0x4a8a8a);
  R.ell(cx + 0.5, 120, 9, 9, C.goldM); R.ell(cx + 0.5, 132, 11, 14, 0x7a2228); R.ell(cx + 0.5, 120, 7.5, 7.5, 0xb84a2a);
  R.ell(cx + 0.5, 121, 4, 5, C.gold); R.ell(cx + 0.5, 117, 4.2, 3, C.goldM); R.ell(cx + 0.5, 114.5, 2, 1.8, C.goldM);
  R.px(cx - 2, 121, C.goldD); R.px(cx + 2, 121, C.goldD);
  R.poly([[cx - 7, 127], [cx + 8, 127], [cx + 9, 140], [cx - 8, 140]], C.gold); R.rect(cx - 1, 126, 3, 2, C.gold);
  R.line(cx, 127, cx + 6, 140, C.goldM); R.rect(cx - 3, 136, 7, 1, C.goldH);
  R.ell(cx + 0.5, 142, 11, 4, C.goldM); R.ell(cx + 0.5, 139, 4, 1.5, C.goldH);
  for (let k = -3; k <= 3; k++) { R.ell(cx + 0.5 + k * 3.4, 148, 2, 3, C.gold); R.px(cx + k * 3.4, 146, C.goldH); }
  R.rect(l - 4, 184, r - l + 9, 3, C.stoneL); R.rect(l - 4, 187, r - l + 9, 2, C.stoneS);
  for (let k = -2; k <= 2; k++) lamp(R, L, Math.round(cx) + k * 7, 180, `s${Math.round(cx)}k${k}`, `s${Math.round(cx)}`);
  for (const fx of [l + 2, r - 2]) { R.rect(fx - 2, 176, 4, 6, C.brass); R.rect(fx - 3, 175, 6, 1, C.brassH); R.rect(fx - 3, 171, 3, 3, C.mari); R.rect(fx, 170, 3, 3, C.mariY); R.px(fx - 1, 173, C.leaf); }
}

function paintNiche(R) {
  const cx = 160, l = 108, r = 212, hw = (r - l) / 2;
  for (let x = l - 2; x <= r + 2; x++) {
    const yt = Math.round(archTop(x, cx, hw + 2, 31, 71));
    for (let y = yt; y < FLOOR; y++) R.px(x, y, C.goldM);
  }
  for (let x = l; x <= r; x++) {
    const yt = Math.round(archTop(x, cx, hw, 35, 74));
    for (let y = yt; y < FLOOR; y++) R.px(x, y, y - yt < 10 ? C.nicheD : C.niche);
    R.px(x, yt - 1, C.goldH);
  }
  // little gold flames along the torana's crest
  for (let x = l; x <= r; x += 5) { const yt = Math.round(archTop(x, cx, hw + 2, 31, 71)); R.px(x, yt - 1, C.gold); R.px(x, yt - 2, C.goldH); R.px(x + 1, yt - 1, C.goldM); }
  // the mandorla behind the body, the halo behind the head
  R.ell(cx + 0.5, 120, 42, 52, C.goldM); R.ell(cx + 0.5, 120, 40, 50, 0x7a2228);
  for (let a = 0; a < Math.PI * 2; a += 0.12) { const x = cx + Math.cos(a) * 37, y = 120 + Math.sin(a) * 47; R.px(x, y, (a * 10) % 2 < 1 ? C.goldD : C.goldM); }
  for (let y = 56; y <= 108; y++) for (let x = 134; x <= 186; x++) {
    const d = sq(x - cx, y - 82), ang = Math.atan2(y - 82, x - cx);
    if (d > 25) continue;
    if (d > 23.2) R.emit(x, y, d > 24.3 ? 0xf8c060 : 0xffe4a0);
    else if (d > 21) R.px(x, y, 0xb84a2a);
    else if (d > 10) R.px(x, y, Math.sin(ang * 12) > 0 ? 0xd8803a : 0xc06a30);
    else R.px(x, y, C.goldM);
  }
}

// the Buddha is gilded: painted straight in its lamp-lit colours (it glows by itself in the bake),
// shaded by hand for where the light really comes from: the rows of lamps below and the halo
// behind. The lap, the hands, the knees and the underside of the chin catch the lamplight; the
// crown of the head sinks into the niche's shadow, with a thin rim of halo light round it.
// Column 160 is the statue's middle (ellipses centre on 160.5 so they fall even both sides).
const G = { k: 0x3a1e08, d: 0x6e4012, m: 0xa06a1e, b: 0xd09a34, l: 0xf0c050, h: 0xffe08a, w: 0xfff2c0 };
const RB = { d: 0x5a2c0e, m: 0x8a5418, b: 0xb87c26, l: 0xd89c3c, h: 0xf0bc5a };
function paintBuddha() {
  const B = new Ras(100, 126, -110, -56);
  // the robe over the crossed legs, falling a little over the lotus
  B.poly([[122, 152], [121, 145], [127, 138], [140, 133], [181, 133], [194, 138], [200, 145], [199, 152]], RB.m);
  for (const kx of [130.5, 190.5]) { B.ell(kx, 146, 7.5, 4, RB.b); B.ell(kx, 147.6, 5, 2.2, RB.l); B.rect(Math.floor(kx) - 2, 149, 5, 1, RB.h); }
  B.line(128, 137, 141, 134, RB.d); B.line(192, 137, 179, 134, RB.d);    // shadow under the forearms
  B.line(150, 149, 134, 142, RB.d); B.line(170, 149, 186, 142, RB.d); B.line(155, 151, 139, 148, RB.d); B.line(165, 151, 181, 148, RB.d);
  B.line(152, 150, 137, 145, RB.l); B.line(168, 150, 183, 145, RB.l);
  // the soles, turned up on the thighs
  for (const [fx, s] of [[147, -1], [173, 1]]) {
    B.ell(fx + 0.5, 140.5, 5, 1.8, G.b); B.rect(fx - 2, 139, 5, 1, G.m); B.rect(fx - 3, 141, 7, 1, G.l); B.px(fx + 4 * s, 140, G.l);
  }
  // the hem fanning over the lotus, its lower edge lit
  B.poly([[150, 146], [171, 146], [173, 154], [148, 154]], RB.b);
  B.line(155, 147, 153, 153, RB.m); B.line(165, 147, 167, 153, RB.m); B.line(160, 147, 160, 153, RB.m);
  B.rect(149, 153, 23, 1, RB.h); B.rect(123, 151, 25, 1, RB.l); B.rect(173, 151, 25, 1, RB.l);
  // the body: sloping shoulders; bare on the right side, the robe over the left shoulder
  B.poly([[153, 96], [168, 96], [176, 98], [181, 102], [184, 109], [183, 121], [180, 133], [141, 133], [138, 121], [137, 109], [140, 102], [145, 98]], G.b);
  B.line(145, 99, 152, 97, G.m); B.line(139, 103, 144, 100, G.m);           // the tops of things in shadow
  B.line(142, 116, 155, 117, G.l); B.ell(154.5, 125, 4.5, 3.6, G.l); B.rect(153, 128, 2, 1, G.h);   // chest and belly lit from below
  B.line(136, 110, 139, 131, G.m);
  B.poly([[161, 96], [168, 96], [176, 98], [181, 102], [184, 109], [183, 121], [180, 133], [150, 133]], RB.b);
  B.line(161, 97, 150, 132, RB.h); B.line(162, 97, 151, 132, RB.l);
  B.line(170, 102, 165, 130, RB.m); B.line(177, 105, 172, 130, RB.m); B.line(183, 110, 178, 129, RB.d); B.line(171, 104, 167, 129, RB.l);
  B.line(166, 131, 180, 131, RB.l);
  // the arms resting against the body, soft at the elbows, the forearms coming in to the lap;
  // a darker crease where each arm meets the body, the undersides lit
  B.thick(140.5, 104, 137.5, 120, 3.2, G.b); B.ell(137.5, 121, 3.5, 3.3, G.b); B.thick(138.5, 123, 151.5, 132.5, 2.5, G.b);
  B.line(136, 107, 134, 118, G.m); B.line(143, 107, 141, 120, G.m); B.line(141, 122, 150, 129, G.m);
  B.line(138, 126, 149, 133, G.l); B.line(134, 121, 136, 124, G.l);
  B.thick(180.5, 104, 183.5, 120, 3.4, RB.b); B.ell(183.5, 121, 3.7, 3.4, RB.b); B.thick(182.5, 123, 169.5, 132.5, 2.6, RB.b);
  B.line(185, 106, 187, 118, RB.m); B.line(178, 107, 180, 120, RB.d); B.line(180, 122, 171, 129, RB.d);
  B.line(183, 126, 172, 133, RB.l); B.line(187, 121, 185, 124, RB.l);
  // the hands in the lap in meditation: right over left, palms up, fingers lying along each other,
  // the thumbs rising to touch over a small dark oval
  B.rect(152, 132, 5, 1, G.b); B.rect(164, 132, 5, 1, G.b);
  B.rect(151, 133, 19, 1, G.l); B.rect(151, 134, 19, 1, G.m); B.rect(150, 135, 21, 1, G.l); B.rect(151, 136, 19, 1, G.m);
  B.px(169, 134, G.b); B.px(151, 136, G.b); B.px(150, 135, G.b); B.px(170, 135, G.b);
  B.px(159, 130, G.l); B.px(160, 130, G.h); B.px(161, 130, G.l);
  B.px(157, 131, G.l); B.px(158, 131, G.l); B.px(159, 131, G.b); B.px(160, 131, G.k); B.px(161, 131, G.b); B.px(162, 131, G.l); B.px(163, 131, G.l);
  B.px(157, 132, G.m); B.px(158, 132, G.m); B.px(159, 132, G.m); B.px(160, 132, G.d); B.px(161, 132, G.m); B.px(162, 132, G.m); B.px(163, 132, G.m);
  // the neck with its three lines, lit beneath the chin
  B.rect(154, 91, 13, 7, G.b); B.rect(155, 93, 11, 1, G.m); B.rect(156, 95, 9, 1, G.m); B.rect(157, 96, 7, 1, G.l);
  // the crown of snail curls, and a low, rounded ushnisha
  B.ell(160.5, 78, 10.6, 9, G.d); B.ell(160.5, 69.5, 5.8, 4.4, G.d);
  for (let y = 65; y < 80; y += 2) {
    const off = ((y - 65) / 2) % 2 ? 1 : 0;
    for (let x = 149 + off; x < 172; x += 3) {
      if (B.col(x, y) !== G.d || B.col(x + 1, y + 1) !== G.d) continue;
      const lit = y > 71;
      B.px(x, y, lit ? G.m : G.d); B.px(x + 1, y, G.m); B.px(x, y + 1, lit ? G.b : G.m); B.px(x + 1, y + 1, lit ? G.m : G.d);
    }
  }
  // the long ears: narrow at the top, the lobes long and rounded, lit at the bottom
  for (const [ux, lx, ix] of [[148, 147, 148], [171, 171, 172]]) {
    B.rect(ux, 79, 2, 6, G.b); B.rect(lx, 85, 3, 8, G.b); B.rect(ux, 93, 2, 2, G.l);
    B.line(ix, 81, ix, 90, G.m); B.px(ix, 91, G.d);
  }
  // the face: serene, the eyes lowered, the faintest smile
  B.ell(160.5, 86, 9.6, 10.6, G.b);
  for (let x = 151; x <= 169; x++) if (B.col(x, 77) === G.b) B.px(x, 77, G.m);
  B.line(151, 86, 152, 92, G.m); B.line(169, 86, 168, 92, G.m);
  B.px(152, 81, G.m); B.rect(153, 80, 3, 1, G.m); B.px(156, 81, G.m);
  B.px(164, 81, G.m); B.rect(165, 80, 3, 1, G.m); B.px(168, 81, G.m);
  for (const ex of [153, 163]) { B.px(ex, 84, G.m); B.rect(ex + 1, 85, 3, 1, G.d); B.px(ex + 4, 84, G.m); B.rect(ex + 1, 86, 3, 1, G.l); }
  B.px(160, 81, G.l);
  B.line(161, 83, 161, 88, G.m); B.px(160, 88, G.l); B.px(160, 89, G.h); B.px(159, 89, G.m); B.px(161, 89, G.m);
  B.px(158, 91, G.m); B.rect(159, 92, 3, 1, G.m); B.px(160, 92, G.d); B.px(162, 91, G.m);
  B.rect(159, 93, 3, 1, G.l);
  B.rect(159, 95, 3, 1, G.l);
  // a marigold garland about the shoulders, one bloom at its lowest point
  garland(B, sag(142, 101, 179, 101, 23, 12), 30);
  B.rect(159, 124, 3, 2, C.mari); B.px(160, 124, C.mariY); B.px(160, 126, C.mariD);
  // a thin rim of halo light round the head and shoulders
  for (let x = 128; x < 194; x++) for (let y = 60; y < 110; y++) {
    if (!B.solid(x, y)) continue;
    const c = B.col(x, y);
    B.px(x, y, c === G.d ? G.m : c === G.b ? G.l : c === RB.b ? RB.l : c);
    break;
  }
  B.outline(G.k);
  for (let i = 3; i < B.d.length; i += 4) if (B.d[i]) B.d[i] = 254;
  return B;
}

function paintThrone(R) {
  // the lotus, gilded like the statue: a back row of petals, the red-tipped front row, a beaded
  // ring, a row turned down
  const T = new Ras(100, 28, -110, -144);
  const petal = (px, tip, h, w, c, hi, up, red) => {
    for (let j = 0; j < h; j++) {
      const t = j / (h - 1), hw = w * (t < 0.55 ? Math.sqrt(t / 0.55) : 1 - (t - 0.55) * 0.25), y = up ? tip + j : tip - j;
      for (let x = Math.round(px - hw); x <= Math.round(px + hw); x++) T.px(x, y, x >= Math.round(px + hw) - 1 ? G.m : c);
      T.px(px, y, j > 1 && j < h - 2 ? hi : c);
      if (red && j < 2) T.px(px, y, 0xd8606a);
    }
  };
  for (let k = 0; k < 9; k++) petal(124 + k * 9, 145, 9, 4.5, G.m, G.b, true, false);
  for (let k = 0; k < 10; k++) petal(119 + k * 9, 147, 11, 4.8, G.b, G.l, true, true);
  T.rect(116, 158, 89, 3, G.d); for (let x = 117; x < 204; x += 2) T.px(x, 159, G.h);
  for (let k = 0; k < 10; k++) petal(119 + k * 9, 170, 10, 4.4, G.m, G.b, false, false);
  T.rect(115, 170, 91, 2, G.d);
  T.outline(G.k);
  for (let i = 3; i < T.d.length; i += 4) if (T.d[i]) T.d[i] = 254;
  R.stamp(T, 110, 144);
  // the plinth, its altar cloth with the wheel of the Dharma
  R.rect(112, 172, 97, 3, C.goldM); R.rect(112, 172, 97, 1, C.goldH);
  R.rect(112, 175, 97, FLOOR - 175, C.stone); R.rect(112, 175, 1, FLOOR - 175, C.stoneL); R.rect(208, 175, 1, FLOOR - 175, C.stoneS);
  R.rect(120, 175, 81, 19, C.maroon); R.rect(120, 175, 2, 19, C.goldM); R.rect(199, 175, 2, 19, C.goldM); R.rect(120, 192, 81, 2, C.goldM);
  for (let x = 120; x < 201; x += 2) R.px(x, 194, C.gold);
  for (let x = 124; x < 197; x += 6) R.px(x, 189, C.goldD);
  R.ell(160.5, 184, 5.5, 5.5, C.gold); R.ell(160.5, 184, 4, 4, C.maroon);
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; R.line(160 + Math.cos(a) * 1.5, 184 + Math.sin(a) * 1.5, 160 + Math.cos(a) * 4, 184 + Math.sin(a) * 4, C.gold); }
  R.px(160, 184, C.goldH); R.px(160, 178, C.goldH); R.px(160, 190, C.goldH);
  garland(R, [...sag(121, 175, 148, 175, 7, 5), ...sag(148, 175, 173, 175, 7, 5).slice(1), ...sag(173, 175, 200, 175, 7, 5).slice(1)], 54);
  // a vase of lotuses at each corner
  for (const vx of [116, 204]) {
    const s = vx < 160 ? -1 : 1;
    R.line(vx, 160, vx + 6 * s, 147, C.leafD); R.line(vx, 160, vx, 144, C.leafD); R.line(vx, 160, vx - 5 * s, 150, C.leafD);
    R.ell(vx - 6 * s, 152, 3, 1.5, C.leaf); R.ell(vx + 5 * s, 156, 2.5, 1.2, C.leaf);
    for (const [bx, by] of [[vx + 6 * s, 146], [vx, 143]]) { R.ell(bx, by, 2.6, 2, C.lotus); R.px(bx, by - 2, C.lotusD); R.px(bx, by - 1, C.lotusL); R.px(bx - 2, by + 1, C.lotusD); R.px(bx + 2, by + 1, C.lotusD); }
    R.ell(vx - 5 * s, 149, 1.5, 2, C.lotusD); R.px(vx - 5 * s, 148, C.lotus);
    R.rect(vx - 3, 159, 7, 1, C.brassH); R.rect(vx - 1, 160, 3, 3, C.brass); R.ell(vx + 0.5, 167, 4.5, 4.5, C.brass); R.px(vx - 2, 165, C.brassH); R.px(vx - 1, 164, C.brassH);
    R.rect(vx - 2, 171, 5, 1, C.brassD);
  }
}

function paintAltar(R, L) {
  // two broad stone steps, a little darker than the gilding so the flames show, a shadow under each lip
  R.rect(100, 196, 121, 3, C.stone); R.rect(100, 196, 121, 1, C.stoneL);
  R.rect(100, 199, 121, 7, C.stoneS); R.rect(100, 199, 121, 1, C.stoneD);
  R.rect(92, 206, 137, 3, C.stone); R.rect(92, 206, 137, 1, C.stoneL);
  R.rect(92, 209, 137, 7, C.stoneS); R.rect(92, 209, 137, 1, C.stoneD); R.rect(92, 215, 137, 1, C.stoneD);
  R.rect(100, 199, 1, 7, C.stoneD); R.rect(220, 199, 1, 7, C.stoneD); R.rect(92, 209, 1, 7, C.stoneD); R.rect(228, 209, 1, 7, C.stoneD);
  R.rect(92, 216, 137, 1, C.grout);
  // a carved band of petals along each riser
  for (let x = 103; x < 218; x += 6) { R.px(x, 202, C.stone); R.px(x + 1, 201, C.stone); R.px(x + 2, 202, C.stone); R.px(x + 1, 203, C.stoneD); }
  for (let x = 95; x < 226; x += 6) { R.px(x, 212, C.stone); R.px(x + 1, 211, C.stone); R.px(x + 2, 212, C.stone); R.px(x + 1, 213, C.stoneD); }
  // seven water bowls, every other one heaped with marigolds; little lamps between them
  for (let k = 0; k < 7; k++) {
    const x = 118 + k * 14;
    R.rect(x - 3, 194, 7, 1, C.brassH); R.rect(x - 3, 195, 7, 1, C.brass); R.rect(x - 2, 196, 5, 1, C.brassD);
    if (k % 2) { R.rect(x - 2, 192, 5, 2, C.mari); R.px(x - 1, 192, C.mariY); R.px(x + 1, 193, C.mariY); R.px(x, 191, C.mariY); }
    else { R.rect(x - 2, 194, 5, 1, C.water); R.px(x - 1, 194, 0xe0f4ff); }
  }
  for (let k = 0; k < 6; k++) lamp(R, L, 125 + k * 14, 193, `u${k}`, 'altar');
  // the row of butter lamps on the lower step
  for (let k = 0; k < 11; k++) lamp(R, L, 105 + k * 10, 204, `a${k}`, 'altar');
  // lotus blossoms floating in two brass water bowls on the floor
  for (const bx of [128, 192]) {
    R.ell(bx + 0.5, 222, 9, 3, C.brassD); R.ell(bx + 0.5, 220.5, 9, 2.4, C.brass); R.ell(bx + 0.5, 220.5, 7.5, 1.6, C.water); R.rect(bx - 8, 220, 1, 2, C.brassH);
    R.ell(bx - 4, 220.5, 2.5, 1, C.leaf); R.ell(bx + 4, 221, 2, 0.8, C.leafD);
    R.ell(bx + 0.5, 219, 2.6, 1.6, C.lotus); R.px(bx, 217, C.lotusD); R.px(bx - 2, 218, C.lotusD); R.px(bx + 2, 218, C.lotusD); R.px(bx, 218, C.lotusL);
  }
}

// the runner down the aisle, maroon with a gold border and a row of saffron diamonds, in perspective
function paintRunner(R) {
  for (let y = 217; y < 309; y++) {
    const hw = (30 * (y - VP.y)) / 189, xl = 160.5 - hw, xr = 160.5 + hw, rv = 2600 / (y - VP.y), fv = rv - Math.floor(rv);
    for (let x = Math.ceil(xl - 0.5); x < xr - 0.5; x++) {
      const e = Math.min(x + 0.5 - xl, xr - x - 0.5), u = (x + 0.5 - 160.5) / hw, dm = Math.abs(fv - 0.5) * 2 + Math.abs(u) * 1.8;
      R.px(x, y, e < 1 ? C.goldD : e < 2.2 ? C.goldM : e < 3.2 ? C.runnerD : dm < 0.16 ? C.mariY : dm < 0.4 ? C.saffronD : C.runner);
    }
  }
}
function rug(R, a, b) {
  if (b - a < 8) return;
  R.rect(a, 244, b - a, 15, C.maroonD); R.rect(a, 244, b - a, 1, C.goldM); R.rect(a, 258, b - a, 1, C.goldM);
  R.rect(a + 2, 246, b - a - 4, 1, C.goldD); R.rect(a + 2, 256, b - a - 4, 1, C.goldD);
  for (let x = a + 6; x < b - 4; x += 9) { R.px(x, 250, C.saffronD); R.px(x - 1, 251, C.saffronD); R.px(x + 1, 251, C.saffronD); R.px(x, 252, C.saffronD); R.px(x, 251, C.maroon); }
  R.rect(a, 259, b - a, 1, C.grout);
}
// a low lacquered table with a long loose-leaf text on it, wrapped at one end in saffron cloth
function monkTable(R, tx, side) {
  R.rect(tx - 5, 247, 11, 2, C.lacq); R.rect(tx - 5, 247, 11, 1, C.gold);
  R.rect(tx - 5, 249, 11, 5, C.lacqD); R.rect(tx - 4, 250, 9, 3, C.lacq); R.rect(tx - 2, 251, 5, 1, C.goldM);
  R.rect(tx - 5, 254, 2, 2, C.woodD); R.rect(tx + 4, 254, 2, 2, C.woodD);
  R.rect(tx - 4, 245, 9, 2, C.cream); R.rect(tx - 4, 246, 9, 1, C.creamD);
  const wx = side > 0 ? tx + 4 : tx - 4;
  R.px(wx, 245, C.saffron); R.px(wx, 246, C.saffronD);
}
// the singing bowl on its round cushion, with a small lamp beside it
function paintBowl(R, L, bx) {
  R.ell(bx + 0.5, 255, 7.5, 2.4, C.red); R.ell(bx + 0.5, 254.2, 6.5, 1.3, 0xc04a3a); R.rect(bx - 6, 257, 13, 1, C.maroonD);
  for (let y = 249; y <= 253; y++) {
    const hw = Math.round(6 - (y - 249) * 0.55);
    R.rect(bx - hw, y, hw * 2 + 1, 1, C.bronze); R.px(bx - hw, y, C.bronzeH); R.px(bx - hw + 1, y, C.bronzeH); R.px(bx + hw, y, C.bronzeD);
  }
  R.ell(bx + 0.5, 248.5, 6.6, 1.6, C.bronzeH); R.ell(bx + 0.5, 248.6, 5, 0.9, 0x3a2614); R.px(bx - 4, 248, 0xf8e0a0); R.px(bx - 3, 247, 0xf8e0a0);
  R.rect(bx - 3, 253, 7, 1, C.bronzeD);
  lamp(R, L, bx + 11, 249, 'bowl', 'bowl');
}
// the board a pilgrim makes prostrations on, a padded mat at the near end
function paintBoard(R) {
  R.rect(98, BOARD_Y, 58, 2, C.plank); R.rect(98, BOARD_Y, 58, 1, mixc(C.plank, 0xffffff, 0.18));
  for (let x = 102; x < 154; x += 7) R.px(x, BOARD_Y + 1, C.plankD);
  R.rect(98, BOARD_Y + 2, 58, 2, C.plankD); R.rect(98, BOARD_Y + 4, 58, 1, C.grout);
  R.rect(99, BOARD_Y - 2, 13, 3, C.maroon); R.rect(99, BOARD_Y - 2, 13, 1, C.maroonH); R.px(99, BOARD_Y - 2, C.maroon);
}
// a stepped rack of butter lamps
function paintRack(R, L, cx, id) {
  R.rect(cx - 23, 278, 2, 31, C.woodD); R.rect(cx + 22, 278, 2, 31, C.woodD); R.px(cx - 23, 277, C.brassH); R.px(cx + 23, 277, C.brassH);
  [[279, 15], [289, 18], [299, 21]].forEach(([ty, hw], i) => {
    R.rect(cx - hw, ty, hw * 2 + 1, 1, C.brassH); R.rect(cx - hw, ty + 1, hw * 2 + 1, 1, C.brass);
    R.rect(cx - hw, ty + 2, hw * 2 + 1, i === 2 ? 7 : 8, C.wood); R.rect(cx - hw, ty + 2, hw * 2 + 1, 1, C.woodD);
    for (let x = cx - hw + 2; x < cx + hw; x += 4) R.px(x, ty + 5, C.brassD);
    for (let x = cx - hw + 3; x <= cx + hw - 3; x += 5) lamp(R, L, x, ty - 4, `${id}t${i}x${x}`, id);
  });
  R.rect(cx - 21, 308, 43, 1, C.grout);
}
// a low table of offerings: marigolds, fruit, sweets, and a small lamp
function paintOffering(R, L, cx, id) {
  R.rect(cx - 26, 292, 53, 2, C.lacq); R.rect(cx - 26, 292, 53, 1, C.gold);
  R.rect(cx - 25, 294, 51, 9, C.lacqD); R.rect(cx - 23, 295, 47, 7, C.lacq); R.rect(cx - 21, 296, 43, 1, C.goldD); R.rect(cx - 21, 300, 43, 1, C.goldD);
  for (let x = cx - 18; x < cx + 20; x += 6) R.px(x, 298, C.gold);
  R.rect(cx - 25, 303, 3, 5, C.woodD); R.rect(cx + 23, 303, 3, 5, C.woodD); R.rect(cx - 25, 308, 51, 1, C.grout);
  for (const px of [cx - 16, cx - 1, cx + 13]) { R.ell(px + 0.5, 291, 7, 1.6, C.brass); R.rect(px - 6, 290, 13, 1, C.brassH); }
  // marigolds heaped
  R.ell(cx - 15.5, 288.5, 5.5, 2.6, C.mari);
  for (const [dx, dy] of [[-4, 288], [-2, 287], [0, 288], [2, 287], [-1, 289], [3, 289], [-3, 290]]) R.px(cx - 16 + dx, dy, C.mariY);
  R.px(cx - 18, 290, C.mariD); R.px(cx - 13, 290, C.mariD);
  // fruit: bananas, oranges, an apple
  R.line(cx - 6, 288, cx + 1, 286, 0xf0d040); R.line(cx - 6, 289, cx + 1, 287, 0xd8b030); R.px(cx + 2, 286, 0x5a4a20);
  R.ell(cx + 2.5, 288.5, 2.2, 2, 0xf09030); R.px(cx + 2, 287, 0xffc070); R.ell(cx - 2.5, 289, 2, 1.8, 0xc83030); R.px(cx - 3, 288, 0xf07070);
  // sweets
  for (const [dx, dy] of [[-3, 289], [0, 289], [3, 289], [-1.5, 287], [1.5, 287], [0, 285]]) { R.ell(cx + 13.5 + dx, dy, 1.6, 1.4, 0xf0a838); R.px(Math.round(cx + 13 + dx), dy - 1, 0xffd878); }
  lamp(R, L, cx + 21, 287, id, id);
}
// the brass incense burner at the front: a deep bowl on three lion-paw feet, a bed of ash in it
function paintBurner(R) {
  const B = new Ras(52, 30, -134, -279), cx = 160;
  for (const lx of [146, 160, 174]) { B.rect(lx - 1, 296, 3, 8, C.brassD); B.px(lx, 296, C.brass); B.ell(lx + 0.5, 305, 2.6, 1.4, C.brassD); B.px(lx - 1, 304, C.brass); }
  B.ell(cx + 0.5, 290, 22, 8, C.brass);
  B.ell(cx + 6.5, 293.5, 14, 4.2, C.brassD, 0.55);
  B.rect(cx - 20, 289, 41, 1, C.brassD);
  for (let x = cx - 17; x < cx + 19; x += 4) { B.px(x, 291, C.brassH); B.px(x + 1, 292, C.brassD); }
  B.px(cx - 18, 286, C.brassH); B.px(cx - 18, 287, C.brassH); B.px(cx - 17, 288, C.brassH);
  for (const [hx, s] of [[cx - 22, -1], [cx + 23, 1]]) { B.px(hx + s, 286, C.brassD); B.px(hx + 2 * s, 287, C.brassD); B.px(hx + 2 * s, 288, C.brassD); B.px(hx + s, 289, C.brassD); }
  B.ell(cx + 0.5, 283, 22.5, 3.2, C.brassH); B.ell(cx + 0.5, 283.2, 20.5, 2.2, C.ash);
  for (let x = cx - 16; x < cx + 17; x += 3) B.px(x, 283 + (x % 2), C.ashL);
  B.rect(cx - 20, 285, 41, 1, C.brass);
  B.outline(0x3a2410);
  R.stamp(B, 134, 279);
}
// pairs of sandals, left at the threshold
const SANDAL = [[0x5a3420, 0x8a5a34], [0x1e1a1c, 0x4a4448], [0xa02a2a, 0xe0c060], [0x2a5a9a, 0xe8e0d0], [0x7a4a2a, 0xc8a070], [0xc84a7a, 0xf0e0e8]];
function sandals(R, L) {
  const r = rng(907);
  for (let x = Math.floor(L.lo / 14) * 14 + 4; x < L.hi - 10; x += 14) {
    if (r() < 0.36) continue;
    const [c, s] = SANDAL[Math.floor(r() * SANDAL.length)], h = r() < 0.15 ? 3 : 5, xx = x + Math.floor(r() * 5);
    for (const [dx, dy] of [[0, 311 + (r() < 0.5 ? 1 : 0)], [4, 311 + (r() < 0.5 ? 1 : 0)]]) {
      R.px(xx + dx + 1, dy, c); R.rect(xx + dx, dy + 1, 3, h - 1, c);
      R.rect(xx + dx, dy + 1, 3, 1, s); R.px(xx + dx + 1, dy + h - 1, mixc(c, 0x000000, 0.3));
    }
  }
}

function* paintFloorJob(R, L) {
  const x0 = L.lo, x1 = L.hi, rows = [];
  for (let k = 0; k <= 10; k++) rows.push(FLOOR + Math.round(113 * (k / 10) ** 1.55));
  for (let y = FLOOR; y < 309; y++) {
    let ri = 0; while (ri < rows.length - 1 && y >= rows[ri + 1]) ri++;
    const sc = (309 - VP.y) / (y - VP.y);
    for (let x = x0; x < x1; x++) {
      const u = ((x - VP.x) * sc) / 26 + 0.5, ci = Math.floor(u), fu = u - ci;
      const edge = y === rows[ri] || fu < 0.035 * sc || fu > 1 - 0.035 * sc;
      R.px(x, y, edge ? C.grout : (ri + ci) % 2 ? C.floor : C.floor2);
    }
    if (y % 28 === 27) yield;
  }
  // the threshold, and the sandals left on it
  R.rect(x0, 309, L.BW, 1, C.stoneL); R.rect(x0, 310, L.BW, 8, C.stone); R.rect(x0, 318, L.BW, 2, C.stoneD);
  for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) R.rect(x, 310, 1, 8, C.stoneS);
  sandals(R, L);
  paintRunner(R);
  yield;
  // the monks' rugs and low tables, the singing bowl
  const lm = L.monks.filter((m) => m.side > 0), rm = L.monks.filter((m) => m.side < 0);
  if (lm.length) rug(R, Math.max(x0, Math.min(...lm.map((m) => m.x)) - 16), 101);
  if (rm.length) rug(R, 219, Math.min(x1, Math.max(...rm.map((m) => m.x)) + 16));
  for (const m of L.monks) if (!m.lead) monkTable(R, m.x + 17 * m.side, m.side);
  const lead = L.monks.find((m) => m.lead);
  if (lead) paintBowl(R, L, lead.x + 16);
  paintBoard(R);
  for (const rk of L.racks) paintRack(R, L, rk.x, `r${rk.x}`);
  for (const tb of L.tables) paintOffering(R, L, tb.x, `t${tb.x}`);
  paintBurner(R);
}

function paintBellFrame(R) {
  R.rect(18, 125, 58, 6, C.beam); R.rect(18, 125, 58, 1, C.beamL); R.rect(18, 130, 58, 1, C.beamD);
  R.rect(16, 123, 4, 3, C.beam); R.rect(74, 123, 4, 3, C.beam); R.px(16, 122, C.beamL); R.px(77, 122, C.beamL);
  for (const px of [26, 66]) { R.rect(px, 131, 4, 92, C.beam); R.rect(px, 131, 1, 92, C.beamL); R.rect(px + 3, 131, 1, 92, C.beamD); R.rect(px - 2, 220, 8, 3, C.beamD); R.rect(px - 2, 220, 8, 1, C.beam); }
  for (let x = 24; x < 70; x += 4) R.px(x, 128, C.goldD);
  R.rect(45, 131, 2, 2, C.goldK);
}

function paintRows(R, L) {
  for (const r of L.rows) {
    const w = r.x1 - r.x0;
    R.rect(r.x0 - 3, 171, w + 6, 4, C.maroon); R.rect(r.x0 - 3, 171, w + 6, 1, C.maroonH); R.rect(r.x0 - 3, 175, w + 6, 1, C.goldM);
    for (let x = r.x0 - 3; x < r.x1 + 3; x += 3) { R.px(x, 176, C.maroonD); R.px(x + 1, 176, C.maroonD); R.px(x + 1, 177, C.maroonD); }
    for (const px of [r.x0, r.x1 - 2]) { R.rect(px, 176, 2, 28, C.beam); R.px(px, 176, C.beamL); }
    R.rect(r.x0, 180, w, 2, C.beam); R.rect(r.x0, 180, w, 1, C.beamL);
    R.rect(r.x0, 200, w, 3, C.beam); R.rect(r.x0, 200, w, 1, C.beamL); R.rect(r.x0 - 1, 203, w + 2, 2, C.stoneS);
    for (let x = r.x0 + 3; x < r.x1 - 2; x += 5) R.px(x, 173, C.goldM);
  }
}

function* paintBackJob(L) {
  const R = new Ras(L.BW, H, L.ox, 0);
  L.flames = [];
  paintShell(R, L); yield;
  for (const a of L.arches) paintArch(R, a, L);
  yield;
  for (const p of L.pillars) paintPillar(R, p);
  paintValance(R, L); yield;
  paintNiche(R); R.stamp(paintBuddha(), 110, 56); yield;
  paintThrone(R); yield;
  yield* paintFloorJob(R, L);
  paintAltar(R, L); paintBellFrame(R); paintRows(R, L);
  yield;
  return R;
}

/* ——— the people and the moving things, as small sprites (painted facing right) ———
   Everyone in the hall is barefoot; their sandals wait at the threshold. Sizes follow the floor's
   depth: walkers by the altar about 33 px, the monks' rows a little larger, the front row 50–56. */
const OUTL = 0x22100c, DARK = 0x24140c;
const LAYP = { style: 'lay', robe: 0x3a5a8a, robeD: 0x283e62, robeH: 0x5a7aaa, vest: 0xe8dcc0, vestD: 0xc0b090, legs: 0xe0d4b8, skin: 0xa8704a, skinD: 0x7a4e30, cush: 0x8a3a3a, hair: 0x1a1412 };
const WHEELMAN = { style: 'lay', robe: 0x8a6a4a, robeD: 0x5e4630, robeH: 0xb08a62, vest: 0xe6e0d2, vestD: 0xb8b0a0, legs: 0xe6e0d2, skin: 0x9a6440, skinD: 0x6e4428, cush: 0x3a5a7a, hair: 0xd8d6d0, beard: 0xe4e2dc };

// seated cross-legged: a monk, a nun, a novice (smaller), or a lay pilgrim in meditation.
// act: 1 striker raised, 2 striking the bowl, 3 a hand to the text, 4 a hand prayer wheel (wf: its turn)
function paintMonk(m, br, ln, act, open, wf = 0) {
  const v = m.v, S = m.novice ? 0.82 : m.scale || 1, R = new Ras(40, 46), P = painter(R, 15, 45, S);
  const old = m.old ? 1 : 0, sx = ln + old, tv = -27 - br + old;
  const legs = v.legs || v.robe, hl = mixc(v.skin, 0xffffff, 0.24);
  // the cushion; the crossed legs under the lower robe, a knee forward
  P.ell(0.5, -1.8, 12.5, 2.4, v.cush); P.rect(-10, -4, 21, 1, mixc(v.cush, 0xffffff, 0.22));
  P.ell(1.5, -6.6, 12, 4.4, legs); P.ell(10.5, -6.8, 4.2, 3.8, legs);
  P.line(-10, -3, 13, -3, mixc(legs, 0x000000, 0.3)); P.line(4, -10, 13, -9, mixc(legs, 0xffffff, 0.18)); P.line(-6, -6, 4, -4, mixc(legs, 0x000000, 0.3));
  // the body: a vest under a robe wrapped diagonally across the chest (or the right shoulder bare)
  const body = [[-7, -8], [-7 + sx * 0.3, tv + 7], [-4 + sx, tv + 1], [2 + sx, tv], [6 + sx, tv + 3], [8, -8]];
  if (v.style === 'tib') {
    P.poly(body, v.vest); P.line(1 + sx, tv + 2, 6 + sx, tv + 4, v.vestD);
    P.poly([[-7, -8], [-7 + sx * 0.3, tv + 7], [-4 + sx, tv + 1], [-1 + sx, tv], [sx, tv + 6], [5.5, -11], [8, -8]], v.robe);
    P.line(sx, tv + 6, 5.5, -11, v.robeH);
    P.line(-5 + sx, tv + 5, -3, -10, v.robeD); P.line(-1 + sx, tv + 5, 3, -10, v.robeD);
  } else if (v.style === 'thera') {
    P.poly(body, v.robe);
    P.poly([[-1 + sx, tv], [2 + sx, tv], [6 + sx, tv + 3], [5.5 + sx, tv + 7], [sx, tv + 3]], v.skin);
    P.line(sx, tv + 3, 6 + sx, tv + 8, v.robeH);
    P.line(-5 + sx, tv + 5, -3, -10, v.robeD); P.line(-1 + sx, tv + 7, 3, -10, v.robeD); P.line(2 + sx, tv + 10, 6, -10, v.robeH);
  } else {
    P.poly(body, v.vest);
    P.poly([[-7, -8], [-7 + sx * 0.3, tv + 7], [-4 + sx, tv + 1], [2 + sx, tv], [5 + sx, tv + 2], [1 + sx, tv + 10], [-2, -8]], v.robe);
    P.line(5 + sx, tv + 2, 1 + sx, tv + 10, v.robeH); P.line(-4 + sx, tv + 5, -4, -9, v.robeD);
  }
  // the near arm: hands resting in the lap, or busy
  const shx = 3 + sx, shy = tv + 3, armC = v.style === 'lay' ? v.vestD : v.skin;
  if (act === 1) { P.thick(shx, shy, 8, tv + 9, 1.5, armC); P.thick(8, tv + 9, 11, tv + 4, 1.3, v.skin); P.line(11, tv + 4, 14, tv - 1, 0x8a5a3a); P.px(14, tv - 2, 0x5e3a24); }
  else if (act === 2) { P.thick(shx, shy, 8, tv + 10, 1.5, armC); P.thick(8, tv + 10, 12, -11, 1.3, v.skin); P.line(12, -11, 16, -9, 0x8a5a3a); }
  else if (act === 3) { P.thick(shx, shy, 6, -13, 1.5, armC); P.thick(6, -13, 13, -9.5, 1.3, v.skin); P.ell(13.5, -9.5, 1.6, 1.1, v.skin); }
  else if (act === 4) {
    P.thick(shx, shy, 6, -12, 1.5, armC); P.thick(6, -12, 10, -17, 1.3, v.skin); P.ell(10.5, -17, 1.5, 1.4, v.skin);
    P.line(10.5, -18, 11.5, -24, C.goldM);
    P.rect(9, -30, 5, 6, 0xb87840);
    for (let k = 0; k < 5; k++) { P.px(9 + k, -28 + ((k + wf) % 2), (k + wf) % 4 === 0 ? C.goldH : 0x7a3a1c); P.px(9 + k, -26, (k + wf) % 3 ? 0xc89050 : 0x7a3a1c); }
    P.rect(9, -31, 5, 1, C.goldH); P.px(11, -32, C.goldH); P.rect(9, -24, 5, 1, C.goldD);
    P.line(14, -28, 16, -27 + (wf % 2), C.goldD); P.px(17, -26 + (wf % 2), 0x3a3a3a);
  } else { P.thick(shx, shy, 4.5, -13, 1.5, armC); P.thick(4.5, -13, 9, -9.5, 1.3, v.skin); P.ell(10, -9.6, 2, 1.2, v.skin); P.px(10, -10, hl); }
  // the head: shaved (or not), the eyes lowered
  const hx = 2.5 + sx, hy = tv - 6.5;
  P.rect(hx - 1.5, tv - 2.5, 3, 3, v.skin);
  P.ell(hx, hy, 4.6, 5.2, v.skin);
  if (v.hair) { P.ell(hx - 0.8, hy - 2.6, 4.6, 3, v.hair); P.rect(hx - 4.6, hy - 2.5, 2, 5, v.hair); }
  else { P.px(hx - 1, hy - 4.6, hl); P.px(hx, hy - 4.8, hl); P.px(hx + 1, hy - 4.6, hl); }
  P.px(hx - 3.8, hy - 0.5, v.skinD); P.px(hx - 3.8, hy + 0.8, v.skinD);
  P.px(hx - 1, hy + 0.2, v.skinD); P.px(hx - 1, hy + 1.2, v.skinD);
  const brow = old || v.beard ? 0xc8c0b8 : v.hair || v.skinD;
  P.px(hx + 2, hy - 1.4, brow); P.px(hx + 3, hy - 1.4, brow);
  P.px(hx + 2, hy, v.skinD); P.px(hx + 3, hy, DARK);
  P.px(hx + 4.8, hy + 1, v.skin); P.px(hx + 3.8, hy + 2, v.skinD);
  P.px(hx + 3.2, hy + 3.4, open ? DARK : v.skinD);
  if (old) { P.px(hx + 2, hy + 1.3, v.skinD); P.px(hx - 2.5, hy - 3.6, 0xb8b0a8); P.px(hx - 3.4, hy - 2.4, 0xb8b0a8); }
  if (v.beard) { P.rect(hx + 1, hy + 2.5, 3.5, 2.5, v.beard); P.px(hx + 2, hy + 5, v.beard); }
  R.outline(OUTL);
  return R;
}

// the old woman: a slight stoop, a white sari with a maroon border drawn over her grey hair, a
// loop of prayer beads with a tassel hanging from her hand, one bead moving through her fingers
const ELDW = { sari: 0xece4d4, sariD: 0xc4b8a4, border: 0x8a2a3a, gold: 0xd8a840, skin: 0x9a6442, skinD: 0x6a4228, hair: 0xd0ccc4 };
function paintElder(bead, bow) {
  const v = ELDW, R = new Ras(26, 56);
  R.rect(12, 53, 4, 2, v.skin); R.px(15, 53, mixc(v.skin, 0xffffff, 0.2)); R.rect(7, 54, 3, 1, v.skinD);
  R.poly([[6, 30], [16, 30], [17, 53], [5, 53]], v.sari);
  R.line(12, 32, 13, 52, v.sariD); R.line(14, 33, 15, 52, v.sariD); R.line(8, 33, 7, 52, v.sariD);
  R.rect(5, 50, 13, 2, v.border); R.rect(5, 49, 13, 1, v.gold);
  R.poly([[5, 19], [11, 15], [16, 18], [17, 31], [6, 31]], v.sari);
  // the pallu: over the head, down the back, its border along the edge
  R.poly([[8, 8], [12, 5], [15, 8], [12, 16], [7, 34], [3, 31], [4, 17]], v.sari);
  R.line(4, 17, 3, 31, v.border); R.line(3, 31, 7, 34, v.border); R.line(8, 18, 6, 30, v.sariD);
  R.rect(12, 15, 3, 3, v.skin);
  R.ell(14.5, 12, 3.6, 4.2, v.skin);
  R.ell(13, 9.6, 3.8, 3, v.sari); R.line(11, 7, 16, 9, v.border); R.line(11, 8, 11, 15, v.border);
  R.px(15, 10, v.hair); R.px(16, 10, v.hair); R.px(14, 11, v.hair);
  R.px(16, 11, v.hair); R.px(16, 12, DARK); R.px(15, 12, v.skinD);
  R.px(18, 13, v.skin); R.px(17, 14, v.skinD); R.px(16, 15, v.skinD); R.px(15, 14, v.skinD);
  // the near arm and the beads
  R.thick(13, 20, 13, 26, 1.5, v.sariD); R.thick(13, 26, 17, 25, 1.3, v.skin); R.ell(18, 25, 1.6, 1.5, v.skin);
  const P = [];
  for (let k = 0; k < 12; k++) { const a = -Math.PI / 2 + (k / 12) * Math.PI * 2; P.push([Math.round(18 + Math.cos(a) * 2.3), Math.round(30.5 + Math.sin(a) * 4.2)]); }
  P.forEach(([x, y], i) => R.px(x, y, i === bead % 12 ? 0xe8c080 : 0x5a2a14));
  R.px(18, 35, 0xc03030); R.px(18, 36, 0xc03030); R.px(17, 37, 0xa02020); R.px(19, 37, 0xa02020);
  R.outline(OUTL);
  return bow ? R.bowed(31, 0.14 * bow, bow) : R;
}

const FATHER = { kurta: 0xece6d6, kurtaD: 0xc4bca8, legs: 0xd8d2c4, legsD: 0xaaa290, stole: 0xe0a030, skin: 0x9a6440, skinD: 0x6a4228, hair: 0x1a1414 };
function paintMan(v, bow) {
  const R = new Ras(26, 60);
  R.rect(12, 56, 5, 2, v.skin); R.px(16, 56, mixc(v.skin, 0xffffff, 0.2)); R.rect(8, 57, 4, 1, v.skinD);
  R.poly([[8, 38], [12, 38], [12, 57], [8, 57]], v.legsD); R.poly([[11, 38], [15, 38], [16, 56], [12, 56]], v.legs);
  R.poly([[7, 17], [16, 17], [18, 24], [19, 41], [6, 41], [6, 24]], v.kurta);
  R.line(17, 25, 18, 40, v.kurtaD); R.line(7, 24, 7, 40, v.kurtaD); R.line(16, 18, 16, 27, v.kurtaD); R.rect(6, 40, 14, 1, v.kurtaD);
  R.line(9, 17, 13, 40, v.stole); R.line(10, 17, 14, 40, mixc(v.stole, 0xffffff, 0.2));
  R.rect(11, 14, 4, 4, v.skin);
  R.ell(13.5, 8.5, 4.6, 5.6, v.skin);
  R.ell(12.5, 4.6, 4.8, 2.9, v.hair); R.rect(8, 4, 2, 7, v.hair); R.px(16, 6, v.hair);
  R.px(15, 6, v.hair); R.px(16, 8, DARK); R.px(15, 8, v.skinD);
  R.px(18, 9, v.skin); R.px(17, 10, v.skinD); R.rect(15, 11, 3, 1, v.hair); R.px(16, 12, v.skinD);
  R.px(11, 8, v.skinD); R.px(11, 9, v.skinD);
  R.thick(13, 19, 14, 28, 1.6, v.kurtaD); R.thick(14, 28, 17, 24, 1.5, v.kurta);
  R.rect(18, 19, 2, 6, v.skin); R.px(19, 19, mixc(v.skin, 0xffffff, 0.2)); R.px(17, 24, v.skinD);
  R.outline(OUTL);
  return bow ? R.bowed(39, 0.17 * bow, bow) : R;
}
const MOTHER = { sari: 0xc8386a, sariD: 0x962450, border: 0xe8b040, blouse: 0xe8961e, skin: 0x9e6a46, skinD: 0x704830, hair: 0x140e0e, flowers: 1 };
const LADY = { sari: 0x2a8a86, sariD: 0x1c625e, border: 0xe8c050, blouse: 0xc84040, skin: 0xb07a52, skinD: 0x80563a, hair: 0x1a1210, flowers: 0 };
function paintWoman(v, bow) {
  const R = new Ras(24, 56);
  R.rect(11, 52, 4, 2, v.skin); R.px(14, 52, mixc(v.skin, 0xffffff, 0.2)); R.px(10, 51, 0xd8c070);
  R.poly([[5, 29], [15, 29], [16, 52], [4, 52]], v.sari);
  R.line(13, 31, 14, 51, v.sariD); R.line(11, 31, 12, 51, v.sariD); R.line(6, 32, 5, 51, v.sariD);
  R.rect(4, 50, 13, 2, v.border);
  R.poly([[6, 16], [14, 16], [15, 29], [6, 29]], v.blouse); R.rect(8, 26, 6, 2, v.skin);
  R.poly([[5, 16], [9, 16], [15, 27], [11, 29], [5, 22]], v.sari); R.line(9, 16, 15, 27, v.border);
  R.rect(3, 16, 3, 22, v.sari); R.line(3, 16, 3, 37, v.border); R.rect(3, 37, 3, 1, v.border);
  R.rect(10, 13, 3, 4, v.skin);
  R.ell(12.5, 8, 4.1, 5, v.skin);
  R.ell(11.5, 4.6, 4.4, 2.6, v.hair); R.rect(7, 5, 2, 6, v.hair); R.rect(6, 9, 2, 16, v.hair); R.px(6, 25, v.border);
  if (v.flowers) { R.px(6, 10, 0xffffff); R.px(7, 11, 0xf4f0e0); R.px(6, 12, 0xffffff); R.px(7, 13, 0xf4f0e0); }
  R.px(14, 6, v.hair); R.px(15, 6, v.hair); R.px(16, 6, 0xd02020);
  R.px(15, 8, DARK); R.px(14, 8, v.skinD);
  R.px(17, 9, v.skin); R.px(16, 10, v.skinD); R.px(15, 12, v.skinD);
  R.px(10, 8, v.skinD); R.px(10, 9, 0xe8c050);
  R.thick(12, 18, 13, 26, 1.4, v.blouse); R.thick(13, 26, 15, 22, 1.3, v.skin);
  R.rect(16, 18, 2, 5, v.skin); R.px(17, 18, mixc(v.skin, 0xffffff, 0.2)); R.px(14, 23, 0xe8b040); R.px(15, 23, 0xc02040);
  R.outline(OUTL);
  return bow ? R.bowed(30, 0.17 * bow, bow) : R;
}
function paintChild(bow) {
  const R = new Ras(16, 38), top = 0xf0c040, topD = 0xc8962a, skin = 0xa06a44, skinD = 0x704628, hair = 0x161010, pj = 0x3a5a8a;
  R.rect(7, 35, 3, 2, skin); R.rect(4, 36, 3, 1, skinD);
  R.rect(4, 25, 3, 11, mixc(pj, 0x000000, 0.2)); R.rect(7, 25, 3, 10, pj);
  R.poly([[3, 12], [10, 12], [11, 27], [3, 27]], top); R.line(9, 13, 10, 26, topD); R.line(3, 14, 3, 26, topD);
  R.rect(6, 10, 3, 3, skin);
  R.ell(7.5, 6, 3.8, 4.4, skin); R.ell(6.8, 3.4, 4, 2.4, hair); R.rect(3, 3, 2, 5, hair);
  R.px(9, 6, DARK); R.px(9, 4, hair); R.px(10, 4, hair); R.px(11, 7, skin); R.px(10, 9, skinD);
  R.thick(7, 14, 8, 20, 1.3, topD); R.thick(8, 20, 10, 17, 1.2, skin); R.rect(10, 14, 2, 4, skin);
  R.outline(OUTL);
  return bow ? R.bowed(24, 0.2 * bow, bow) : R;
}

// the pilgrims who walk the circuit: a young traveller with a pack, a Tibetan woman in a chuba
const TRAV = { top: 0x2a6a72, topD: 0x1e4e56, legs: 0x2e3a58, skin: 0xc89068, skinD: 0x96643e, hair: 0x2a1a14, pack: 0xb8803a, packD: 0x8a5a24, scarf: 0xf2f0e8 };
const AMALA = { top: 0x7a3426, topD: 0x56221a, legs: 0x4a2a22, skin: 0x9a6440, skinD: 0x6a4228, hair: 0x2a1c18, pack: 0, scarf: 0xe8b838, chuba: 1 };
const LEGS = [[[12, 25], [14, 30]], [[10, 25], [10, 30]], [[7, 25], [5, 30]], [[9, 25], [9, 30]]];
const STRIPES = [0xc04040, 0x3a7ab0, 0xe0b040, 0x3a8a5a, 0xe8e0d0];
function paintWalker(fr, pose, v) {   // pose: 0 walking, 1 a hand on a prayer wheel, 2 paused, palms joined
  const R = new Ras(22, 34);
  for (const [k, c] of [[pose ? 3 : (fr + 2) % 4, mixc(v.legs, 0x000000, 0.25)], [pose ? 1 : fr, v.legs]]) {
    const [kn, ft] = LEGS[k];
    R.thick(9, 19, kn[0], kn[1], 1.5, c); R.thick(kn[0], kn[1], ft[0], ft[1], 1.3, c);
    R.rect(ft[0] - 1, 31, 2, 1, v.skin); R.rect(ft[0] - 1, 32, 4, 1, v.skin); R.px(ft[0] + 2, 32, mixc(v.skin, 0xffffff, 0.2));
  }
  R.poly([[6, 9], [13, 9], [14, 20], [6, 20]], v.top); R.line(13, 10, 13, 19, v.topD); R.rect(6, 19, 9, 1, v.topD);
  if (v.pack) { R.rect(2, 10, 5, 11, v.pack); R.rect(2, 10, 5, 1, mixc(v.pack, 0xffffff, 0.25)); R.rect(3, 15, 3, 3, v.packD); R.line(7, 10, 8, 16, v.packD); R.rect(2, 21, 5, 1, v.packD); }
  if (v.chuba) {
    R.poly([[5, 16], [14, 16], [15, 28], [5, 28]], v.top); R.line(6, 18, 6, 27, v.topD); R.rect(5, 27, 11, 1, v.topD);
    for (let y = 19; y < 28; y++) R.rect(11, y, 4, 1, STRIPES[y % 5]);
  }
  R.rect(9, 7, 3, 3, v.skin);
  R.ell(10.5, 4.2, 3.4, 4, v.skin); R.ell(9.4, 1.7, 3.6, 1.9, v.hair); R.rect(6, 2, 2, 4, v.hair);
  R.px(12, 3, v.hair); R.px(13, 3, v.hair); R.px(12, 5, DARK); R.px(14, 6, v.skin); R.px(12, 7, v.skinD);
  if (v.chuba) { R.rect(6, 5, 2, 12, v.hair); R.px(6, 17, 0xc03030); R.rect(7, 9, 6, 1, v.scarf); }
  else { R.rect(9, 8, 4, 2, v.scarf); R.line(11, 10, 12, 16, v.scarf); }
  if (pose === 1) { R.thick(9, 11, 13, 12, 1.3, v.top); R.thick(13, 12, 16, 12, 1.1, v.top); R.rect(16, 11, 2, 2, v.skin); }
  else if (pose === 2) { R.thick(9, 11, 10, 16, 1.3, v.topD); R.thick(10, 16, 13, 13, 1.1, v.top); R.rect(13, 9, 2, 5, v.skin); R.px(14, 8, v.skin); }
  else { const sw = [2, 0, -2, 0][fr]; R.thick(9, 11, 9 + sw * 0.5, 16, 1.3, v.topD); R.thick(9 + sw * 0.5, 16, 10 + sw, 19, 1.1, v.topD); R.px(10 + sw, 20, v.skin); }
  R.outline(OUTL);
  return R;
}

// a full prostration: palms joined at the crown, the throat and the heart; kneeling, hands to the
// board; sliding forward to lie full length, palms joined above the head; and back up. Joints
// are eased between the poses (a few in-betweens are cached per step)
const PIL = { robe: 0xa03a34, robeD: 0x6e2424, shirt: 0xf2e6cc, skin: 0x8a5434, skinD: 0x603820, hair: 0x1a1210, pad: 0xf6e4aa, sash: 0xe8a830 };
const PPOSE = [
  { f: [10, 44], k: [10, 34], h: [10, 25], s: [11, 14], hd: [11.5, 8.5], e: [14.5, 9], w: [13, 3] },
  { f: [10, 44], k: [10, 34], h: [10, 25], s: [11, 14], hd: [11.5, 8.5], e: [15.5, 19], w: [14.5, 13] },
  { f: [10, 44], k: [10, 34], h: [10, 25], s: [11, 14], hd: [11.5, 8.5], e: [15.5, 22], w: [15.5, 17] },
  { f: [2, 44], k: [12, 44], h: [6, 35], s: [9, 24], hd: [11, 18.5], e: [14, 32], w: [18, 41] },
  { f: [2, 44], k: [12, 44], h: [11, 38], s: [24, 37], hd: [29, 36], e: [29, 42], w: [35, 43] },
  { f: [2, 43], k: [14, 43], h: [25, 42], s: [39, 41], hd: [44, 40], e: [47, 42], w: [55, 42] },
  { f: [2, 43], k: [14, 43], h: [25, 42], s: [39, 41], hd: [44, 40], e: [49, 40], w: [57, 38.5] },
];
const PSEQ = [[0, 1.3, 1.2], [1, 0.8, 0.6], [2, 0.8, 0.6], [3, 1.4, 0.4], [4, 1.1, 0.2], [5, 1.0, 0.5], [6, 0.7, 1.6], [5, 0.6, 0.2], [4, 1.0, 0.2], [3, 1.0, 0.3], [2, 1.3, 1.2]];
function lerpPose(a, b, u) { const o = {}; for (const k in a) o[k] = [a[k][0] + (b[k][0] - a[k][0]) * u, a[k][1] + (b[k][1] - a[k][1]) * u]; return o; }
function paintPose(J, v = PIL) {
  const R = new Ras(64, 47), T = (a, b, r, c) => R.thick(a[0], a[1], b[0], b[1], r, c);
  const tx = J.s[0] - J.h[0], ty = J.s[1] - J.h[1], tl = sq(tx, ty) || 1, ux = tx / tl, uy = ty / tl, fx = -uy, fy = ux;   // along the body, and its front
  T(J.h, J.k, 2.4, v.robe); T(J.k, J.f, 2.1, v.robeD);
  R.rect(Math.round(J.f[0]) - 2, Math.round(J.f[1]) - 1, 3, 2, v.skin);
  for (let i = 1; i < 8; i++) { const t = i / 8; R.rect(Math.round(J.h[0] + (J.k[0] - J.h[0]) * t + fx * 1.6) - 1, Math.round(J.h[1] + (J.k[1] - J.h[1]) * t + fy * 1.6), 2, 1, STRIPES[i % 5]); }
  T(J.h, J.s, 3.4, v.robe);
  const bx = J.h[0] + ux * 2.5, byy = J.h[1] + uy * 2.5;   // a sash at the waist, across the body
  R.thick(bx - fx * 2.8, byy - fy * 2.8, bx + fx * 2.8, byy + fy * 2.8, 0.75, v.sash);
  R.ell(J.s[0] + fx * 1.4, J.s[1] + fy * 1.4 + 0.5, 1.6, 1.4, v.shirt);
  const nx = J.hd[0] - J.s[0], ny = J.hd[1] - J.s[1], nl = sq(nx, ny) || 1, nux = nx / nl, nuy = ny / nl, gx = -nuy, gy = nux;   // the face's way
  R.ell(J.hd[0], J.hd[1], 3.4, 3.7, v.skin);
  R.ell(J.hd[0] - gx * 1.3 + nux * 0.7, J.hd[1] - gy * 1.3 + nuy * 0.7, 3.1, 2.8, v.hair);
  R.thick(J.hd[0] - gx * 2.6, J.hd[1] - gy * 2.6, J.hd[0] - gx * 3.4 - nux * 4, J.hd[1] - gy * 3.4 - nuy * 4, 0.9, v.hair);
  if (gy < 0.6) { R.px(Math.round(J.hd[0] + gx * 2 + nux * 0.4), Math.round(J.hd[1] + gy * 2 + nuy * 0.4), DARK); R.px(Math.round(J.hd[0] + gx * 3.6), Math.round(J.hd[1] + gy * 3.6 - nuy * 0.6), v.skin); }
  T(J.s, J.e, 1.7, v.robeD); T(J.e, J.w, 1.4, v.shirt);
  R.rect(Math.round(J.w[0]) - 1, Math.round(J.w[1]) - 1, 3, 2, v.pad); R.px(Math.round(J.w[0]), Math.round(J.w[1]) - 1, 0xffffff);
  R.outline(OUTL);
  return R;
}

// the temple cat, curled up asleep: ginger and tabby patches, the tail wrapped round its paws
function paintCat(br, tail, ear) {
  const R = new Ras(21, 13), base = 0xead8b8, shade = 0xd0bc98, orng = 0xd8883a, orngD = 0xa8602a, dark = 0x3a2a24, pink = 0xe0a0a0;
  // the body, curled: a round back with a ginger patch, tabby stripes and a dark spot
  R.ell(8.5, 8.6 - br * 0.4, 7, 3.2 + br * 0.4, base);
  R.ell(7, 7.2 - br * 0.3, 4.2, 2.2, orng);
  for (const x of [4, 6, 8, 10]) { R.px(x, 6 - br, orngD); R.px(x, 7 - br, orngD); }
  R.ell(11, 6.6 - br * 0.4, 1.4, 1, dark);
  R.rect(4, 10, 9, 1, shade);
  // the head tucked down at the front, two pointed ears, the eye shut
  R.ell(15.5, 7.8, 3.4, 3, base); R.px(13, 9, shade); R.px(13, 10, shade);
  R.ell(15, 6, 2, 1, orng);
  R.px(13, 4, base); R.px(14, 4, pink); R.px(13, 3 - ear, base);
  R.px(18, 4, base); R.px(17, 4, pink); R.px(18, 3, base);
  R.px(16, 8, dark); R.px(17, 8, dark); R.px(19, 9, 0xd08080);
  // the tail wrapped round the front, its tip lifting when it twitches
  R.line(2, 10, 13, 11, orng); R.line(3, 11, 12, 11, orngD);
  R.px(14 + tail, 11 - tail, orngD); R.px(15 + tail, 10 - tail, dark); R.px(1, 9, orng); R.px(1, 10, orng);
  R.outline(0x2a1a10);
  return R;
}

// a pilgrim kneeling at a side shrine, seen from behind, holding a small lamp up to the ledge
function paintOfferer(lift) {
  const R = new Ras(16, 26), sari = 0xc8486a, sariD = 0x9a3050, skin = 0xa06c48, hair = 0x161010;
  R.ell(8.5, 22.5, 6, 2.6, sariD);
  R.poly([[3, 23], [4, 13], [8, 11], [13, 13], [14, 23]], sari);
  R.line(8, 13, 8, 22, sariD); R.rect(3, 22, 11, 1, 0xe8b040);
  const ly = 4 - lift;
  R.thick(5, 14, 6, ly + 5, 1, skin); R.thick(12, 14, 11, ly + 5, 1, skin);
  R.ell(8.5, 9, 3, 3.3, hair); R.ell(8.5, 6.6, 1.6, 1.3, hair); R.px(9, 6, 0xffffff); R.px(7, 7, 0xf4f0e0);
  R.rect(6, ly + 3, 5, 1, C.brassH); R.px(8, ly + 4, C.brassD); R.px(8, ly + 2, C.goldK);
  R.outline(OUTL);
  return R;
}

function paintLantern() {
  const R = new Ras(13, 26);
  R.px(6, 0, C.brassD); R.px(6, 1, C.brassD);
  R.rect(4, 2, 5, 2, C.brass); R.rect(2, 4, 9, 1, C.brassH); R.px(6, 2, C.brassH);
  for (let y = 5; y < 15; y++) {
    for (let x = 2; x <= 10; x++) {
      if (x === 2 || x === 6 || x === 10) R.px(x, y, x === 2 ? C.brassH : C.brass);
      else R.emit(x, y, y < 7 ? 0xffe0a0 : (x === 4 || x === 8) ? 0xffd27a : 0xffb050);
    }
  }
  R.rect(2, 9, 9, 1, C.brassD);
  R.rect(1, 15, 11, 1, C.brassH); R.rect(2, 16, 9, 2, C.brass); R.rect(4, 18, 5, 1, C.brassD); R.rect(5, 19, 3, 1, C.brass); R.px(6, 20, C.brassH);
  R.px(6, 21, 0xc03030); R.px(6, 22, 0xc03030); R.px(5, 23, 0xa02020); R.px(7, 23, 0xa02020);
  R.outline(0x2a1808);
  return R;
}

// the great bronze bell: a hanging loop, the clapper just showing at the mouth, its red rope
function paintBell() {
  const R = new Ras(32, 62), cx = 15.5, r = rng(9);
  R.ell(cx, 3, 3.4, 3, C.bronzeD); R.clr(cx, 3.2, 1.7, 1.5); R.px(14, 1, C.bronzeH); R.rect(13, 5, 5, 1, C.bronze);
  for (let y = 6; y < 38; y++) {
    const hw = y < 13 ? 5 + (y - 6) * 0.95 : y < 33 ? 11.6 + (y - 13) * 0.06 : 12.8 + (y - 33) * 0.7;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const u = (x - cx) / hw;
      R.px(x, y, u < -0.7 ? C.bronzeD : u < -0.25 ? C.bronze : u < 0.15 ? C.bronzeH : u < 0.65 ? C.bronze : C.bronzeD);
    }
  }
  for (const [y, c] of [[14, C.bronzeH], [15, C.bronzeD], [27, C.bronzeH], [28, C.bronzeD], [32, C.bronzeD]]) for (let x = 0; x < 32; x++) R.tint(x, y, c);
  for (let row = 0; row < 2; row++) for (let x = Math.round(cx - 8 + row); x <= cx + 8; x += 3) { R.px(x, 8 + row * 3, C.bronzeH); R.px(x, 9 + row * 3, C.bronzeD); }
  for (let x = Math.round(cx - 9); x <= cx + 9; x += 2) if (r() < 0.7) R.px(x, 19 + Math.floor(r() * 5), mixc(C.bronzeD, C.bronze, 0.4));
  for (let k = 0; k < 9; k++) { const x = cx - 10 + r() * 20, y = 10 + r() * 24; if (R.solid(x, y)) { R.px(x, y, C.verd); if (r() < 0.6) R.tint(x + 1, y, C.verd); } }
  R.rect(Math.round(cx - 13), 37, 27, 1, C.bronzeD); R.ell(cx, 37.5, 10, 0.8, 0x2a1a0c);
  R.ell(cx, 39.5, 2.2, 1.8, C.bronzeD); R.px(15, 39, C.bronzeH);
  R.rect(15, 41, 1, 15, 0xb83030); R.rect(16, 41, 1, 15, 0x7a1e1e); R.rect(14, 56, 4, 2, 0xd84848); R.px(14, 58, 0xa02a2a); R.px(16, 58, 0xa02a2a); R.px(17, 58, 0xa02a2a);
  R.outline(C.goldK);
  return R;
}
// the bell swinging: rows shift by how far they hang below the hook
function swung(R, k) {
  if (!k) return R;
  const S = new Ras(R.w, R.h);
  for (let y = 0; y < R.h; y++) {
    const dx = Math.round((k * y) / 24);
    for (let x = 0; x < R.w; x++) { const i = (y * R.w + x) * 4, nx = x + dx; if (!R.d[i + 3] || nx < 0 || nx >= R.w) continue; const j = (y * R.w + nx) * 4; for (let q = 0; q < 4; q++) S.d[j + q] = R.d[i + q]; }
  }
  return S;
}

function paintWheel(fr) {
  const R = new Ras(11, 20), cop = [C.brassD, 0x9a6230, 0xb87840, 0xd8a058, 0xe8b868, 0xd8a058, 0xb87840, 0x9a6230, C.brassD];
  R.px(5, 0, C.brassD); R.px(5, 19, C.brassD);
  R.rect(2, 1, 7, 2, C.brassH); R.rect(1, 3, 9, 1, C.brass);
  for (let x = 0; x < 9; x++) {
    for (let y = 4; y < 15; y++) R.px(x + 1, y, cop[x]);
    for (let y = 6; y < 13; y++) {
      const g = (x + fr * 2) % 4, lit = cop[x] === 0xe8b868 || cop[x] === 0xd8a058;
      R.px(x + 1, y, lit ? 0xb02828 : 0x7a1c1c);
      if ((g === 0 && y !== 9) || (g === 1 && (y === 7 || y === 11))) R.px(x + 1, y, lit ? C.goldH : C.goldM);
    }
  }
  R.rect(1, 6, 9, 1, C.brassH); R.rect(1, 12, 9, 1, C.brassD);
  R.rect(1, 15, 9, 1, C.brass); R.rect(2, 16, 7, 2, C.brassD); R.px(5, 18, C.brassD);
  return R;
}

// a tall brass lamp stand beside the altar (a sprite, so people pass behind it properly)
function paintStand(sx) {
  const R = new Ras(16, 54, -(sx - 8), -171);
  R.ell(sx + 0.5, 223, 5, 2, C.brassD); R.ell(sx + 0.5, 222, 4, 1.5, C.brass); R.rect(sx - 1, 186, 2, 36, C.brass); R.rect(sx - 1, 186, 1, 36, C.brassH);
  R.ell(sx, 200, 3, 1, C.brassH); R.ell(sx, 186, 6, 1.6, C.brass); R.rect(sx - 6, 185, 12, 1, C.brassH);
  R.rect(sx - 1, 178, 2, 7, C.brass); R.ell(sx, 177, 2.5, 2, C.brass); R.px(sx, 175, C.brassH);
  for (const dx of [-5, -2, 2, 5]) { R.px(sx + dx, 184, C.goldK); R.px(sx + dx - 1, 185, C.brassH); R.px(sx + dx + 1, 185, C.brassH); }
  R.outline(0x2a1808);
  return R;
}

/* ——— building the hall for one width, a slice at a time ——— */
const ELDER_X = 64, FAMILY = [[186, 'child'], [204, 'mother'], [224, 'father']], CAT = { x: 220, y: 208 }, STANDS = [86, 234];
const SLOTS = [[-12, -0.34], [-8, -0.2], [-4, -0.09], [0, 0], [4, 0.09], [8, 0.2], [12, 0.34]];
const SMK = { x0: 56, x1: 264, y0: 90, y1: 290 };   // where the incense smoke can drift (core coordinates)
const SCENES = new Map();
const sceneW = (bw) => Math.max(CORE, Math.ceil(bw / STEP) * STEP);

// a sprite painted facing right, baked where it stands: (x, y) is its anchor in core coordinates,
// (ax, ay) the anchor inside the painted sprite; flip turns it to face left. Keeps its alpha for clicks.
function bakeSprite(sc, R, ax, ay, x, y, flip) {
  const axx = flip ? R.w - 1 - ax : ax;
  if (flip) R = R.flipped();
  const bx = Math.round(sc.ox + x - axx), by = Math.round(y - ay);
  const a = new Uint8Array(R.w * R.h);
  for (let i = 0; i < a.length; i++) a[i] = R.d[i * 4 + 3];
  return { cv: bake(R, bx, by, sc.F), bx, by, dx: bx - Math.round(sc.ox + x), w: R.w, h: R.h, a };
}
function spr(sc, key, make, ax, ay, x, y, flip) {
  let e = sc.cache.get(key);
  if (!e) { e = bakeSprite(sc, make(), ax, ay, x, y, flip); sc.cache.set(key, e); }
  return e;
}
// the walkers are baked every 8 px along their way (the light changes as they go); a short memory
function sprW(sc, key, make, ax, ay, x, y, flip) {
  let e = sc.wcache.get(key);
  if (e) { sc.wcache.delete(key); sc.wcache.set(key, e); return e; }
  e = bakeSprite(sc, make(), ax, ay, x, y, flip);
  sc.wcache.set(key, e);
  if (sc.wcache.size > 140) sc.wcache.delete(sc.wcache.keys().next().value);
  return e;
}

function* shaftsJob(L, warm) {
  const R = new Ras(L.BW, H, L.ox, 0), c = warm ? 0xffc88a : 0x8aa8ff;
  for (const a of L.arches) {
    if (a.wall) continue;
    // a faint beam in the air from the opening, and the patch it lays on the floor, spreading
    // towards us in perspective
    const l = a.x0 + 9, r = a.x1 - 9;
    for (let y = SILL; y < 300; y++) {
      const t = (y - 92) / 208, xl = l + (l - 160) * 0.38 * t, xr = r + (r - 160) * 0.38 * t;
      const floor = y >= 210 ? Math.max(0, 1 - (y - 210) / 70) ** 1.1 : 0;
      const air = Math.min(1, (y - SILL) / 14) * (1 - t * 0.6);
      for (let x = Math.floor(xl); x < xr; x++) {
        const u = (x - xl) / (xr - xl), edge = Math.min(1, u * 5, (1 - u) * 5);
        const lv = band(edge * (air * 0.1 + floor * 0.22) * 5, x, y) / 5;
        if (lv > 0) R.px(x, y, c, lv);
      }
    }
    yield;
  }
  return R.canvas();
}
// the corners darken in a few flat steps
function vignette(BW) {
  const R = new Ras(BW, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < BW; x++) {
    const vx = (x - BW / 2) / (BW / 2), vy = (y - 150) / 170, d = Math.max(0, Math.sqrt(vx * vx * 0.6 + vy * vy * 0.7) - 0.62);
    const lv = Math.min(3, Math.floor(d * 7));
    if (lv > 0) R.px(x, y, 0x0a0614, lv * 0.1);
  }
  return R.canvas();
}
// night inside: the sky's light gone from the hall, only the lamps left. A multiply layer in four
// flat steps, cool where the light was cool, clear where the lamps reach; the statue's head and
// shoulders sink into the dark above its lamp-lit lap
const SHADE = [0xffffff, 0xc8c8e4, 0x9a9cc8, 0x7072aa];
function* shadeJob(L, F, back) {
  const { BW, ox } = L, out = new Uint8ClampedArray(BW * H * 4);
  for (let y = 0; y < H; y++) {
    for (let X = 0; X < BW; X++) {
      const i = (y * BW + X) * 4;
      if (!back.d[i + 3]) continue;
      const j = y * BW + X, w = F.W[j], c = F.C[j], wf = w / (w + c), cx = X - ox;
      let dk = clamp(1.3 * (1 - wf) - 0.3, 0, 1) * clamp(1.25 - w * 0.7, 0, 1);
      if (cx > 112 && cx < 209 && y > 40 && y < 134) dk = Math.max(dk, 0.42 * clamp((132 - y) / 22, 0, 1));
      const col = SHADE[band(dk * 3, X, y)];
      out[i] = col >> 16; out[i + 1] = (col >> 8) & 255; out[i + 2] = col & 255; out[i + 3] = 255;
    }
    if (y % 40 === 39) yield;
  }
  return toCanvas(out, BW, H);
}
// incense haze gathering under the beams (shown more as more sticks burn)
function hazeCanvas(L) {
  const R = new Ras(L.BW, 130, L.ox, 0);
  for (let y = 30; y < 128; y++) for (let x = 30; x < 290; x++) {
    const k = Math.max(0, 1 - Math.abs(x - 160) / 130) * clamp((128 - y) / 70, 0, 1) * clamp((y - 30) / 12, 0, 1);
    const lv = Math.floor(k * 4);
    if (lv > 0) R.px(x, y, 0xd8ccd4, lv * 0.09);
  }
  return R.canvas();
}
// which of four smoke tones each point of the smoke's region takes, from the light there
function smokeLUT(L, F) {
  const w = SMK.x1 - SMK.x0, h = SMK.y1 - SMK.y0, lut = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = clamp(L.ox + SMK.x0 + x, 0, L.BW - 1), j = (SMK.y0 + y) * L.BW + X, wm = F.W[j];
    lut[y * w + x] = wm > 0.78 ? 3 : wm > 0.46 ? 2 : wm > 0.26 ? 1 : 0;
  }
  return lut;
}
const SMOKEP = { day: [0x8c90aa, 0xa69ca8, 0xc0a892, 0xd4b89c], night: [0x5c627a, 0x7a7488, 0x9a8678, 0xb49a84] };
const SMOKEA = [210, 150, 92];
const packed = {};
for (const k in SMOKEP) packed[k] = SMOKEA.map((a) => SMOKEP[k].map((c) => ((a << 24) | ((c & 255) << 16) | (((c >> 8) & 255) << 8) | ((c >> 16) & 255)) >>> 0));

function* buildJob(BW) {
  const L = layout(BW); yield;
  const F = yield* fieldJob(L);
  const back = yield* paintBackJob(L);
  for (const sx of STANDS) for (const dx of [-5, -2, 2, 5]) L.flames.push({ id: `st${sx}${dx}`, x: sx + dx, y: 184, grp: 'stand' });
  const sc = { BW, L, F, ox: L.ox, cache: new Map(), wcache: new Map(), sky: {}, skyJob: null, hits: [] };
  sc.back = yield* bakeJob(back, 0, 0, F);
  sc.shade = yield* shadeJob(L, F, back);
  sc.buf = mk(BW, H); sc.g = sc.buf.getContext('2d');
  sc.shaftW = yield* shaftsJob(L, true); sc.shaftC = yield* shaftsJob(L, false);
  sc.vig = vignette(BW); yield;
  sc.haze = hazeCanvas(L); yield;
  // the flags outside: one every few pixels along each string
  sc.oflags = [];
  let ci = 0;
  for (const pts of flagStrings(L)) {
    let acc = 2;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = sq(x1 - x0, y1 - y0);
      while (acc < d) { const u = acc / d; sc.oflags.push({ x: Math.round(x0 + (x1 - x0) * u), y: Math.round(y0 + (y1 - y0) * u), ci: ci++ % 5, ph: (x0 + acc) * 0.41 }); acc += 4; }
      acc -= d;
    }
  }
  sc.flagCols = {};
  for (const tod of TODS) sc.flagCols[tod] = FLAGC.map((c) => hex(mixc(c, SKIES[tod].sil, tod === 'night' ? 0.72 : 0.36)));
  sc.lantern = L.lanterns.map((lx) => ({ x: lx, e: spr(sc, `lan${lx}`, paintLantern, 6, 0, lx, 36, false) }));
  yield;
  sc.bellSpr = [-2, -1, 0, 1, 2].map((k) => spr(sc, `bell${k}`, () => swung(paintBell(), k), 15, 0, 46, 132, false));
  yield;
  sc.wheelSpr = L.wheels.map((w) => [0, 1, 2, 3].map((f) => spr(sc, `wh${w.x}|${f}`, () => paintWheel(f), 5, 0, w.x, 181, false)));
  yield;
  sc.stands = STANDS.map((sx) => spr(sc, `st${sx}`, () => paintStand(sx), 8, 52, sx, 223, false));
  yield;
  const sw = SMK.x1 - SMK.x0, sh = SMK.y1 - SMK.y0;
  sc.smk = new ImageData(sw, sh); sc.smk32 = new Uint32Array(sc.smk.data.buffer); sc.smkCv = mk(sw, sh); sc.smkG = sc.smkCv.getContext('2d');
  sc.smkLut = smokeLUT(L, F);
  sc.sky.dusk = yield* skyJob(L, 'dusk');
  sc.stars = []; sc.perches = [];
  const r = rng(321), M = sc.sky.dusk.mask;
  for (let i = 0; i < BW / 3; i++) { const x = L.lo + r() * BW, y = 6 + r() ** 1.3 * 150; if (!M.solid(x, y) && !M.solid(x, y + 2)) sc.stars.push({ x: Math.floor(x), y: Math.floor(y), ph: r() * 6, sp: 0.6 + r() * 1.8, b: r() }); }
  const tree = L.arches.find((a) => a.kind === 'tree');
  for (let x = tree.x0 + 8; x <= tree.x1 - 6; x += 6) {
    let y = 60; while (y < 170 && !M.solid(x, y)) y++;
    if (y < 150 && y > archTop(x, tree.cx, (tree.x1 - tree.x0) / 2 - 4, ARCH_TOP, ARCH_SPRING) + 3) sc.perches.push({ x, y: y - 1 });
  }
  SCENES.set(BW, sc);
  while (SCENES.size > 3) SCENES.delete(SCENES.keys().next().value);
  return sc;
}
// a sky for a time of day: painted ahead in quiet moments, finished at once if it is needed now
function sky(sc, tod) {
  if (!sc.sky[tod]) {
    const j = sc.skyJob && sc.skyJob.tod === tod ? sc.skyJob.job : skyJob(sc.L, tod);
    sc.sky[tod] = finish(j);
    if (sc.skyJob && sc.skyJob.tod === tod) sc.skyJob = null;
  }
  return sc.sky[tod];
}
function pumpSky(sc, ms) {
  if (!sc.skyJob) { const tod = TODS.find((d) => !sc.sky[d]); if (!tod) return; sc.skyJob = { tod, job: skyJob(sc.L, tod) }; }
  const done = pump(sc.skyJob.job, ms);
  if (done) { sc.sky[sc.skyJob.tod] = done; sc.skyJob = null; }
}

/* ——— the living scene ——— */
function makeState(seed) {
  const r = rng(seed);
  const s = {
    r, t: 0, tod: 0, todFrom: 0, todK: 1,
    chant: 0, lead: { next: 9 + r() * 6, t: -1 }, rings: [], bell: { a: 0, v: 0, next: 70 + r() * 40 },
    lamps: new Map(), litQ: [], flare: 0, halo: 0,
    sticks: [], puffs: [], ashes: [], haze: 0.12, autoStick: 30,
    wheels: new Map(),
    walkers: [{ x: 250, wait: 0, pause: 0, reach: 0, dist: 0, v: 8.5, k: 0 }, { x: 0, wait: 17, pause: 0, reach: 0, dist: 0, v: 6.5, k: 1 }],
    pros: { i: 0, t: 0.4 }, fam: { t: 6, every: 15 }, elder: { bead: 0, bt: 0, bow: 0, next: 12 },
    wind: 0, birds: null, birdNext: 14, motes: [],
    cat: { purr: 0, tail: 0, ear: 0, earNext: 9 }, lan: {}, ripples: [], petals: [], shrineFlare: {},
    pages: {}, spire: 0, stupa: {}, offer: { lift: 0, next: 6 }, hand: { a: 0, v: 1.4 },
    drone: { next: 5 + r() * 6 },
  };
  for (const [slot, len, ash] of [[2, 21, 1.2], [3, 24, 0.4], [5, 18, 2]]) s.sticks.push({ slot, dx: SLOTS[slot][0], lean: SLOTS[slot][1] + (r() - 0.5) * 0.05, len, t0: -30 - r() * 5, out: null, ph: r() * 6, ash });
  return s;
}
// state keyed by what things are, not where they fall in a list, so a new width keeps it
function seed(s, sc) {
  const r = s.r, L = sc.L;
  for (const f of L.flames) if (!s.lamps.has(f.id)) {
    const dark = f.grp === 'altar' && (f.x * 7 + f.y) % 5 === 2;
    s.lamps.set(f.id, { on: !dark, fuel: 25 + r() * 420 });
  }
  for (const w of L.wheels) if (!s.wheels.has(w.x)) s.wheels.set(w.x, { a: r(), v: 0 });
  if (!s.birds) {
    s.birds = Array.from({ length: 7 }, (_, i) => {
      const p = sc.perches[i % Math.max(1, sc.perches.length)] || { x: 57, y: 100 };
      return i < 4 ? { st: 'perch', x: p.x, y: p.y, p: i, ph: r() * 6, hop: 0 } : { st: 'home', x: 120 + i * 30, y: 40 + i * 6, p: i, ph: r() * 6, hop: 0 };
    });
  }
  for (const b of s.birds) b.p = b.p % Math.max(1, sc.perches.length);
  s.motes = [];
  for (const a of L.arches) if (!a.wall) for (let i = 0; i < 9; i++) s.motes.push({ a, u: r(), t: r(), v: 0.03 + r() * 0.04, ph: r() * 6, sp: 0.5 + r() });
}
function lightStick(s) {
  const r = s.r, used = new Set(s.sticks.filter((k) => k.out == null).map((k) => k.slot));
  let slot = [3, 2, 4, 1, 5, 0, 6].find((i) => !used.has(i));
  if (slot == null) {   // every slot taken: the shortest burns out and a fresh one goes in its place
    const old = s.sticks.filter((k) => k.out == null).sort((a, b) => a.len - b.len)[0];
    old.out = s.t; slot = old.slot;
  }
  const st = { slot, dx: SLOTS[slot][0], lean: SLOTS[slot][1] + (r() - 0.5) * 0.05, len: 20 + Math.round(r() * 4), t0: s.t, out: null, ph: r() * 6, ash: 0 };
  s.sticks.push(st);
  const tx = 160 + st.dx + st.lean * st.len, ty = 283 - st.len;
  for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2, v = 5 + r() * 9; s.puffs.push({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 4, age: 0, life: 1.4 + r() * 0.8 }); }
  if (s.puffs.length > 40) s.puffs.splice(0, s.puffs.length - 40);
}

function update(s, sc, dt, voice) {
  const r = s.r, L = sc.L;
  s.t += dt;
  const t = s.t;
  if (s.todK < 1) s.todK = Math.min(1, s.todK + dt / 4);
  s.chant = Math.max(0, s.chant - dt); s.flare = Math.max(0, s.flare - dt * 0.12); s.halo = Math.max(0, s.halo - dt * 0.15);
  s.wind = Math.max(0, s.wind - dt * 0.25); s.spire = Math.max(0, s.spire - dt * 0.05);
  // butter lamps burn down and gutter out, a few minutes each; dark ones are lit one after another
  for (const lp of s.lamps.values()) if (lp.on) { lp.fuel -= dt; if (lp.fuel <= 0) lp.on = false; }
  if (s.litQ.length) { s.litQ[0].t -= dt; if (s.litQ[0].t <= 0) { const lp = s.lamps.get(s.litQ.shift().id); if (lp) { lp.on = true; lp.fuel = 150 + r() * 330; } } }
  // the eldest monk sounds the singing bowl now and then
  const ld = s.lead;
  if (ld.t < 0) { ld.next -= dt; if (ld.next <= 0) ld.t = 0; }
  else {
    const was = ld.t; ld.t += dt;
    const lead = L.monks.find((m) => m.lead);
    if (was < 0.9 && ld.t >= 0.9) { if (lead) s.rings.push({ x: lead.x + 16, y: 249, age: 0, big: false }); bowlSound(voice, ld.big); }
    if (ld.t > 1.8) { ld.t = -1; ld.big = false; ld.next = 28 + r() * 18; }
  }
  // the bell, struck now and then (softer than when asked)
  const b = s.bell;
  b.v += (-b.a * 6 - b.v * 0.9) * dt; b.a += b.v * dt;
  b.next -= dt; if (b.next <= 0) { ringBell(s, voice, true); b.next = 90 + r() * 60; }
  for (const q of s.rings) q.age += dt;
  s.rings = s.rings.filter((q) => q.age < (q.big ? 3.4 : 2.6));
  // a low drone now and then, under the murmur
  s.drone.next -= dt; if (s.drone.next <= 0) { droneSound(voice, false); s.drone.next = 20 + r() * 10; }
  // incense: sticks burn down, ash builds and drops, a burnt-out stick's smoke trails away; when
  // few are burning a fresh one is lit
  for (const st of s.sticks) {
    if (st.out != null) continue;
    st.len -= dt * 0.045; st.ash += dt * 0.045;
    if (st.ash > 2.6) { st.ash = 0.5; s.ashes.push({ x: 160 + st.dx + st.lean * st.len, y: 283 - st.len, vy: 0 }); }
    if (st.len < 5) st.out = t;
  }
  s.sticks = s.sticks.filter((st) => st.out == null || t - st.out < 13);
  const burning = s.sticks.filter((st) => st.out == null).length;
  s.autoStick -= dt; if (burning < 2 && s.autoStick <= 0) { lightStick(s); s.autoStick = 40 + r() * 30; }
  s.haze += (Math.min(0.6, 0.08 + burning * 0.075) - s.haze) * Math.min(1, dt * 0.03);
  for (const a of s.ashes) { a.vy += 70 * dt; a.y += a.vy * dt; }
  s.ashes = s.ashes.filter((a) => a.y < 283);
  for (const p of s.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; p.vy -= dt * 3; }
  s.puffs = s.puffs.filter((p) => p.age < p.life);
  // prayer wheels slow down; walkers turn them as they pass
  for (const w of s.wheels.values()) { w.a += w.v * dt; w.v *= Math.exp(-dt * 0.4); if (w.v < 0.02) w.v = 0; }
  // (clockwise round the shrine: across the front of it, right to left)
  const xl = L.lo - 24, xr = L.hi + 24;
  for (const wk of s.walkers) {
    if (wk.wait > 0) { wk.wait -= dt; if (wk.wait <= 0) wk.x = xr; }
    else if (wk.pause > 0) wk.pause -= dt;
    else {
      wk.x -= wk.v * dt; wk.dist += wk.v * dt;
      if (walkY(L, wk.x) < WHEEL_Y + 3) for (const w of L.wheels) { const ws = s.wheels.get(w.x); if (Math.abs(wk.x - 6 - w.x) < 1.6 && ws && ws.v < 1.5) { ws.v = 2.4; wk.reach = 0.5; } }
      if (wk.x < xl) { wk.wait = 8 + r() * 10; wk.x = xl - 10; }
    }
    if (wk.x > xr + 30 && wk.wait <= 0) wk.x = xr;
    wk.reach = Math.max(0, wk.reach - dt);
  }
  // the prostrating pilgrim, the family's bows, the old woman's beads
  const pr = s.pros, ps = PSEQ[pr.i];
  pr.t += dt; if (pr.t > ps[1] + ps[2]) { pr.i = (pr.i + 1) % PSEQ.length; pr.t = 0; }
  s.fam.t += dt; if (s.fam.t > s.fam.every) { s.fam.t = 0; s.fam.every = 14 + r() * 8; }
  const el = s.elder; el.bt += dt; if (el.bt > 0.9) { el.bt = 0; el.bead = (el.bead + 1) % 12; }
  el.next -= dt; if (el.next <= 0) { el.bow = 2.4; el.next = 16 + r() * 10; } el.bow = Math.max(0, el.bow - dt);
  // birds: they wheel about and come home to the tree
  s.birdNext -= dt;
  if (s.birdNext <= 0) { const bd = s.birds[Math.floor(r() * s.birds.length)]; if (bd.st === 'perch') lift(bd, r, 4 + r() * 4); s.birdNext = 10 + r() * 14; }
  for (const bd of s.birds) {
    bd.hop = Math.max(0, bd.hop - dt);
    if (bd.st === 'fly') {
      bd.ang += bd.w * dt; bd.x = bd.cx + Math.cos(bd.ang) * bd.rx; bd.y = bd.cy + Math.sin(bd.ang) * bd.ry; bd.left -= dt;
      if (bd.left <= 0) bd.st = 'home';
    } else if (bd.st === 'home') {
      const p = sc.perches[bd.p] || { x: 57, y: 100 }, dx = p.x - bd.x, dy = p.y - bd.y, d = sq(dx, dy);
      if (d < 1) { bd.st = 'perch'; bd.x = p.x; bd.y = p.y; } else { const v = Math.min(d, 26 * dt); bd.x += (dx / d) * v; bd.y += (dy / d) * v; }
    } else if (r() < dt * 0.05) bd.hop = 0.25;
  }
  for (const m of s.motes) { m.t += m.v * dt; if (m.t > 1) { m.t = 0; m.u = r(); } }
  // the cat, the lanterns, ripples, petals, pages, the offering at the side shrine, the hand wheel
  const cat = s.cat;
  cat.purr = Math.max(0, cat.purr - dt); cat.tail = Math.max(0, cat.tail - dt); cat.ear = Math.max(0, cat.ear - dt);
  cat.earNext -= dt; if (cat.earNext <= 0) { cat.ear = 0.3; cat.earNext = 8 + r() * 12; }
  for (const k in s.lan) s.lan[k] = Math.max(0, s.lan[k] - dt * 0.35);
  for (const q of s.ripples) q.age += dt;
  s.ripples = s.ripples.filter((q) => q.age < 2);
  for (const p of s.petals) { p.age += dt; p.y += p.vy * dt; p.x += Math.sin(t * 2 + p.ph) * 6 * dt; }
  s.petals = s.petals.filter((p) => p.age < p.life);
  for (const k in s.shrineFlare) s.shrineFlare[k] = Math.max(0, s.shrineFlare[k] - dt * 0.2);
  for (const k in s.pages) s.pages[k] = Math.max(0, s.pages[k] - dt);
  const of = s.offer; of.next -= dt; if (of.next <= 0) { of.lift = 3.5; of.next = 12 + r() * 8; } of.lift = Math.max(0, of.lift - dt);
  s.hand.a += s.hand.v * dt; s.hand.v += (1.4 - s.hand.v) * Math.min(1, dt * 0.3);
}
function lift(bd, r, secs) {
  bd.st = 'fly'; bd.cx = 40 + r() * 50; bd.cy = 70 + r() * 30; bd.rx = 28 + r() * 40; bd.ry = 10 + r() * 16;
  bd.ang = Math.atan2(bd.y - bd.cy, bd.x - bd.cx); bd.w = (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.6); bd.left = secs;
}

/* ——— sounds ———
   The long, resonant voices (bell, bowl, drone, chimes) go through this lounge's own little audio
   graph, so leaving the lounge silences them at once; the short taps use the arcade's tone/note. */
function makeVoice(isPaused) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  let ac;
  try { ac = new AC(); } catch { return null; }
  const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
  const bus = ac.createGain(); bus.connect(out);
  // a little room: a soft feedback echo through a low-pass
  const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
  dl.delayTime.value = 0.19; fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 1500; wet.gain.value = 0.3;
  bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
  const gate = () => {
    const on = !isPaused() && soundOn();
    out.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, on ? 0.05 : 0.3);
    if (on && ac.state === 'suspended') ac.resume().catch(() => {});
  };
  gate();
  const timer = setInterval(gate, 200);
  let live = true;
  const partial = (f, vol, dur, { delay = 0, type = 'sine', attack = 0.008, swell = 0 } = {}) => {
    if (!live || !soundOn() || vol <= 0) return;
    const t = ac.currentTime + 0.02 + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    if (swell) { g.gain.linearRampToValueAtTime(vol, t + swell); g.gain.setValueAtTime(vol, t + Math.max(swell, dur - swell)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else { g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
  };
  return {
    partial,
    tn(midi, { dur = 0.9, vol = 0.03, delay = 0, type = 'sine' } = {}) { const f = 440 * 2 ** ((midi - 69) / 12); partial(f, vol, dur, { delay, type }); partial(f * 2, vol * 0.12, dur * 0.7, { delay, type }); },
    stop() {
      live = false; clearInterval(timer);
      try { out.gain.setTargetAtTime(0, ac.currentTime, 0.04); } catch { /* closed */ }
      setTimeout(() => ac.close().catch(() => {}), 250);
    },
  };
}
const pn = (voice, step, opts) => { if (voice) voice.tn(57 + Math.floor(step / 5) * 12 + [0, 2, 4, 7, 9][((step % 5) + 5) % 5], opts); };
// bronze: inharmonic partials (hum, prime, tierce, quint, nominal...), each a detuned pair beating slowly
const BELL = [[0.5, 1, 9.5], [1, 0.75, 7.5], [1.19, 0.42, 6], [1.5, 0.26, 4.6], [2, 0.34, 4], [2.51, 0.13, 2.8], [2.66, 0.1, 2.4]];
function bellSound(voice, soft) {
  if (!voice) return;
  const f0 = 174.6, v = soft ? 0.024 : 0.044;
  for (const [ratio, lvl, dur] of BELL) for (const d of [-0.55, 0.55]) voice.partial(f0 * ratio + d * ratio, v * lvl * 0.5, dur);
  voice.partial(f0 * 3.2, v * 0.22, 0.25, { type: 'triangle' });
}
// a singing bowl: partials near 1, 2.7 and 5.2, each beating at a few hertz
function bowlSound(voice, big) {
  if (!voice) return;
  const f0 = 262, v = big ? 0.03 : 0.021;
  for (const [ratio, lvl, dur, beat] of [[1, 1, 10, 2.4], [2.71, 0.45, 6.5, 3.2], [5.18, 0.16, 3.2, 3.8]]) {
    voice.partial(f0 * ratio, v * lvl * 0.55, dur, { attack: 0.006 }); voice.partial(f0 * ratio + beat, v * lvl * 0.45, dur, { attack: 0.006 });
  }
}
// a quiet drone a fifth apart, like voices chanting far off; it swells when the monks chant
function droneSound(voice, swell) {
  if (!voice) return;
  const dur = swell ? 9 : 6 + Math.random() * 2, v = swell ? 0.03 : 0.011;
  voice.partial(73.42, v, dur, { type: 'triangle', swell: 2.4 }); voice.partial(110, v * 0.7, dur, { type: 'triangle', swell: 2.6, delay: 0.3 });
  if (swell) voice.partial(146.83, v * 0.35, dur - 1, { type: 'triangle', swell: 2.8, delay: 0.6 });
}
function ringBell(s, voice, soft) {
  s.bell.v += soft ? 2.4 : 3.2;
  s.rings.push({ x: 46, y: 152, age: 0, big: true });
  bellSound(voice, soft);
}

/* ——— each frame: the sky, the baked hall, then only the moving things ——— */
function fr(g, x, y, w, h, c, a = 1) { if (a <= 0.004) return; g.globalAlpha = Math.min(1, a); g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function glowAt(g, cv, x, y, a) { if (a <= 0.01) return; g.globalAlpha = Math.min(1, a); g.drawImage(cv, Math.round(x - (cv.width >> 1)), Math.round(y - (cv.height >> 1))); }
const famBow = (tc) => (tc < 0 ? 0 : tc < 0.8 ? 1 : tc < 3.2 ? 2 : tc < 3.9 ? 1 : 0);
const WALKERS = [TRAV, AMALA];
const XTRA = { wheelman: { v: WHEELMAN, scale: 1.12 }, sitter: { v: LAYP, scale: 1.12 } };

// the incense smoke: from each glowing tip a ribbon rises, slowing as it climbs; it wavers, splits
// into two curling strands, widens into a thin veil and thins out by dither, tinted by the light
function drawSmoke(sc, s, night) {
  const W = SMK.x1 - SMK.x0, Hh = SMK.y1 - SMK.y0, px = sc.smk32, lut = sc.smkLut, pal = packed[night ? 'night' : 'day'], ox = sc.ox, t = s.t;
  px.fill(0);
  const put = (x, y, dens, tier) => {
    const ix = Math.round(x) - SMK.x0, iy = Math.round(y) - SMK.y0;
    if (ix < 0 || iy < 0 || ix >= W || iy >= Hh || bay(ix + SMK.x0 + ox, iy + SMK.y0) >= dens) return;
    const i = iy * W + ix;
    if (px[i] >>> 24 >= SMOKEA[tier]) return;
    px[i] = pal[tier][lut[i]];
  };
  const seg = (p, q) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(q[1] - p[1]), Math.abs(q[0] - p[0]))));
    for (let k = 0; k < n; k++) {
      const u = k / n, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, h = p[2] + (q[2] - p[2]) * u, f = p[3] + (q[3] - p[3]) * u, sd = p[4];
      // a solid thread low down; then a 2-px ribbon with a veil on one side; then a thin core in a
      // 3-px veil. It thins out by dither, not by fading
      if (h < 24) put(x, y, 2, 0);
      else if (h < 70) { put(x, y, f > 0.5 ? 2 : f / 0.5, 0); put(x + sd, y, 0.5 * f, 2); }
      else { put(x, y, f > 0.4 ? 2 : f / 0.4, 1); put(x - 1, y, 0.55 * f, 2); put(x + 1, y, 0.55 * f, 2); }
    }
  };
  const LIFE = 12, DT = 0.1, HMAX = 170, TAU = 4.4;
  for (const st of s.sticks) {
    const len = st.len, tipx = 160 + st.dx + st.lean * len, tipy = 283 - len, age0 = t - st.t0;
    if (age0 < 0) continue;
    const frac = age0 % DT;
    let pa = null, pb = null;
    for (let j = 0; ; j++) {
      const a = frac + j * DT;
      if (a > LIFE || a > age0) break;
      const born = t - a;
      if (st.out != null && born > st.out) { pa = pb = null; continue; }
      const h = HMAX * (1 - Math.exp(-a / TAU));
      // a slow waver set when the smoke left the tip, a curl travelling up the ribbon, a lean
      const sway = Math.sin(born * 0.35 + st.ph) * Math.min(1, h / 50) * 4.5;
      const curl = Math.sin(h * 0.075 - t * 1.1 + st.ph) * (0.4 + h * 0.085) + Math.sin(h * 0.19 - t * 1.7 + st.ph * 2) * h * 0.025 + Math.sin(h * 0.02 + t * 0.15 + st.ph) * h * 0.07;
      const pull = Math.min(1, h / 110) * 0.7;   // the sticks' ribbons drift together into one plume
      const xc = tipx + (160 - tipx) * pull + sway + curl + s.wind * h * 0.3 + h * 0.02, y = tipy - h;
      const fade = (1 - a / LIFE) ** 1.2;
      // above the first thread it splits into two strands that twist round each other
      const sep = h < 22 ? 0 : Math.min(6, (h - 22) * 0.09), tw = Math.sin(h * 0.06 - t * 0.7 + st.ph);
      const na = [xc + sep * tw, y, h, fade, 1], nb = [xc - sep * tw, y, h, fade * 0.8, -1];
      if (pa) seg(pa, na);
      if (pb && sep > 0) seg(pb, nb);
      pa = na; pb = nb;
    }
  }
  for (const p of s.puffs) { const f = 0.9 * (1 - p.age / p.life); put(p.x, p.y, f, 1); put(p.x + 1, p.y, f * 0.7, 2); put(p.x, p.y - 1, f * 0.7, 2); put(p.x + 1, p.y + 1, f * 0.5, 2); }
  sc.smkG.putImageData(sc.smk, 0, 0);
  sc.g.globalAlpha = 1;
  sc.g.drawImage(sc.smkCv, ox + SMK.x0, SMK.y0);
}

function render(sc, s) {
  const g = sc.g, L = sc.L, ox = sc.ox, t = s.t, X = (x) => ox + x;
  const hits = (sc.hits = []);
  g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const now = TODS[s.tod], old = TODS[s.todFrom], k = ease(s.todK);
  const amt = { dusk: 0, night: 0, dawn: 0 }; amt[old] += 1 - k; amt[now] += k;
  // the sky, its first stars, the birds and the prayer flags outside, seen only through the arches
  if (k < 1) g.drawImage(sky(sc, old).cv, 0, 0);
  g.globalAlpha = k; g.drawImage(sky(sc, now).cv, 0, 0); g.globalAlpha = 1;
  const starA = amt.night + amt.dusk * 0.5 + amt.dawn * 0.15;
  for (const st of sc.stars) {
    if (st.b < 0.94 - amt.night * 0.8) continue;   // at dusk and dawn only the brightest show
    const a = starA * (0.4 + 0.6 * Math.abs(Math.sin(t * st.sp * 0.5 + st.ph)));
    fr(g, X(st.x), st.y, 1, 1, '#fff4dc', a);
    if (st.b > 0.96) { fr(g, X(st.x) - 1, st.y, 3, 1, '#fff4dc', a * 0.3); fr(g, X(st.x), st.y - 1, 1, 3, '#fff4dc', a * 0.3); }
  }
  const bc = amt.night > 0.5 ? '#04050e' : '#1c1224';
  for (const bd of s.birds) {
    const x = Math.round(X(bd.x)), y = Math.round(bd.y);
    if (bd.st === 'perch') { const hy = bd.hop > 0 ? -1 : 0; fr(g, x - 1, y - 1 + hy, 3, 1, bc); fr(g, x + 1, y - 2 + hy, 1, 1, bc); }
    else if (Math.sin(t * 13 + bd.ph) > 0) { fr(g, x, y, 1, 1, bc); fr(g, x - 1, y - 1, 1, 1, bc); fr(g, x + 1, y - 1, 1, 1, bc); fr(g, x - 2, y - 2, 1, 1, bc); fr(g, x + 2, y - 2, 1, 1, bc); }
    else fr(g, x - 2, y, 5, 1, bc);
  }
  g.globalAlpha = 1;
  const fcol = sc.flagCols[amt.night > 0.5 ? 'night' : amt.dawn > 0.5 ? 'dawn' : 'dusk'], fa = 0.7 + s.wind * 1.6, fsp = 2.2 + s.wind * 3;
  for (const f of sc.oflags) {
    const sw = Math.sin(t * fsp + f.ph) * fa, x = X(f.x) - 1;
    g.fillStyle = fcol[f.ci];
    g.fillRect(x, f.y + 1, 3, 1); g.fillRect(x + Math.round(sw * 0.5), f.y + 2, 3, 1); g.fillRect(x + Math.round(sw), f.y + 3, 3, 1);
  }
  // the floodlit spire glows at night; lamps round the stupa, once lit
  g.globalCompositeOperation = 'lighter';
  const sp = L.arches.find((a) => a.kind === 'spire');
  if (amt.night > 0.01) glowAt(g, glow(34, 62, 0xffb060, 0.5, 4), X(sp.cx + 4), 132, amt.night * (0.12 + s.spire * 0.32));
  for (const cx of L.stupas) {
    const n = s.stupa[cx] || 0;
    for (let i = 0; i < n; i++) { const lx = X(cx - 28 + i * 5); fr(g, lx, 164, 1, 1, '#ffe0a0', 0.9); fr(g, lx, 163, 1, 1, '#ff9a40', 0.5 + 0.3 * Math.sin(t * 7 + i)); }
    if (n) glowAt(g, glow(36, 10, 0xffa040, 0.6, 4), X(cx), 165, (n / 12) * 0.35);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.drawImage(sc.back, 0, 0);

  // light: the halo breathing, shafts of the last light, the lanterns
  g.globalCompositeOperation = 'lighter';
  glowAt(g, glow(36, 36, 0xffc060, 0.9, 5), X(160), 82, (0.14 + 0.04 * Math.sin(t * 0.6)) * (1 - amt.night * 0.4) + s.halo * 0.4);
  glowAt(g, glow(60, 70, 0xffb050, 0.5, 4), X(160), 112, s.halo * 0.3);
  const shA = (amt.dusk * 0.5 + amt.dawn * 0.4) * (0.88 + 0.12 * Math.sin(t * 0.21));
  if (shA > 0.01) { g.globalAlpha = shA; g.drawImage(sc.shaftW, 0, 0); }
  if (amt.night > 0.01) { g.globalAlpha = amt.night * 0.3; g.drawImage(sc.shaftC, 0, 0); }
  const lg = glow(16, 16, 0xffb050, 0.8, 4);
  for (const ln of sc.lantern) glowAt(g, lg, X(ln.x), 47, 0.2 + 0.04 * Math.sin(t * 5.1 + ln.x) + (s.lan[ln.x] || 0) * 0.35);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (const ln of sc.lantern) {
    const kick = s.lan[ln.x] || 0, sw = Math.round(Math.sin(t * 0.8 + ln.x) * 0.6 + kick * Math.sin(t * 4) * 2.2);
    for (let y = 24; y < 36; y += 2) fr(g, X(ln.x) + Math.round((sw * (y - 24)) / 12), y, 1, 1, '#2a1a10');
    g.globalAlpha = 1; g.drawImage(ln.e.cv, ln.e.bx + sw, ln.e.by);
  }
  // the bell, the prayer wheels
  const be = sc.bellSpr[clamp(Math.round(s.bell.a), -2, 2) + 2];
  g.globalAlpha = 1; g.drawImage(be.cv, be.bx, be.by);
  hits.push({ bx: be.bx, by: be.by, e: be, kind: 'bell' });
  L.wheels.forEach((w, i) => { const ws = s.wheels.get(w.x), e = sc.wheelSpr[i][Math.floor((ws ? ws.a : 0) * 8) % 4]; g.drawImage(e.cv, e.bx, e.by); });
  // the butter lamps' flames (those on the stands come after the people), their light on the floor
  const fl = L.flames, flick = sc.flick && sc.flick.length === fl.length ? sc.flick : (sc.flick = new Float32Array(fl.length));
  let altarOn = 0, altarN = 0;
  const flame = (i) => {
    const f = fl[i], lp = s.lamps.get(f.id);
    if (f.grp === 'altar') altarN++;
    if (!lp || !lp.on) { flick[i] = 0; return; }
    if (f.grp === 'altar') altarOn++;
    const kk = 0.55 + 0.3 * Math.sin(t * 7.3 + i * 1.7) + 0.15 * Math.sin(t * 13.1 + i * 0.9), low = lp.fuel < 8 ? lp.fuel / 8 : 1;
    flick[i] = kk * (0.35 + 0.65 * low);
    const x = X(f.x), y = f.y, big = s.flare > 0.35 || (s.shrineFlare[f.grp] || 0) > 0.3 ? 1 : 0;
    const h = low < 0.6 ? 1 : (kk > 0.62 ? 3 : 2) + big, lean = Math.sin(t * 1.3 + i * 2.3) > 0.8 ? 1 : 0;
    fr(g, x, y - 1, 1, 1, '#fff6d0');
    if (h > 1) fr(g, x + (h > 2 ? lean : 0), y - h, 1, h - 1, '#ffc23e');
    fr(g, x + lean, y - h - 1, 1, 1, '#ff8a20', 0.85);
    if (f.grp === 'altar' && f.y === 204) fr(g, x, 218, 1, 3 + Math.round(kk * 4), '#ffb860', 0.08 + kk * 0.06);
  };
  for (let i = 0; i < fl.length; i++) if (fl[i].grp !== 'stand') flame(i);
  // the wooden striker rests on the bowl's cushion until the old monk takes it up
  const lm = L.monks.find((m) => m.lead);
  if (lm && s.lead.t < 0) { const sx0 = X(lm.x + 15); fr(g, sx0, 256, 4, 1, sc.strikerC || (sc.strikerC = hex(litAt(sc.F, sx0, 256, 0x9a6a40)))); fr(g, sx0 + 4, 256, 1, 1, '#4a2a18'); }

  // the people, back to front
  const items = [];
  const add = (y, e, kind, ref) => items.push({ y, e, kind, ref });
  for (const m of L.monks) {
    const ph = m.x * 0.13, chanting = s.chant > 0;
    const br = Math.sin((t * Math.PI * 2) / 4.6 + ph * 1.3) > 0 ? 1 : 0;
    const ln = chanting ? (Math.sin((t * Math.PI * 2) / 2.6 + ph) > 0.25 ? 1 : 0) : (Math.sin((t * Math.PI * 2) / 7.5 + ph * 2.1) > 0.55 ? 1 : 0);
    const open = chanting && Math.sin(t * 5.3 + ph * 3) > -0.2 ? 1 : 0;
    let act = 0;
    if (m.lead && s.lead.t >= 0) act = s.lead.t < 0.6 ? 1 : s.lead.t < 1.2 ? 2 : 0;
    else if ((s.pages[m.key] || 0) > 0) act = 3;
    add(MONK_Y, spr(sc, `${m.key}|${br}${ln}${act}${open}`, () => paintMonk(m, br, ln, act, open), 15, 45, m.x, MONK_Y, m.side < 0), 'monk', m);
  }
  for (const wk of s.walkers) {
    if (wk.wait > 0) continue;
    const wy = walkY(L, wk.x), f = Math.floor(wk.dist / 3) % 4, pose = wk.reach > 0 ? 1 : wk.pause > 0 ? 2 : 0, q = Math.round(wk.x / 8) * 8, qy = Math.round(wy);
    const e = sprW(sc, `w${wk.k}|${q}|${qy}|${pose ? 9 : f}${pose}`, () => paintWalker(f, pose, WALKERS[wk.k]), 10, 32, q, qy, true);
    items.push({ y: wy + wk.k * 0.1, e, kind: 'walker', ref: wk, x: wk.x, move: true });
  }
  const ps = PSEQ[s.pros.i], prev = PSEQ[(s.pros.i + PSEQ.length - 1) % PSEQ.length], qn = Math.round(ease(Math.min(1, s.pros.t / ps[1])) * 8);
  add(BOARD_Y, spr(sc, `pr|${prev[0]}|${ps[0]}|${qn}`, () => paintPose(lerpPose(PPOSE[prev[0]], PPOSE[ps[0]], qn / 8)), 10, 44, PROS_X, BOARD_Y, false), 'pros');
  const el = s.elder, elb = el.bow > 0.3 && el.bow < 2.1 ? 1 : 0;
  add(FRONT_Y, spr(sc, `el|${el.bead}|${elb}`, () => paintElder(el.bead, elb), 13, 54, ELDER_X, FRONT_Y, false), 'elder');
  for (const [x, who] of FAMILY) {
    const lv = famBow(s.fam.t - (who === 'child' ? 0.5 : who === 'mother' ? 0.2 : 0));
    if (who === 'child') add(FRONT_Y, spr(sc, `ch|${lv}`, () => paintChild(lv), 8, 36, x, FRONT_Y, true), 'family');
    else if (who === 'mother') add(FRONT_Y, spr(sc, `mo|${lv}`, () => paintWoman(MOTHER, lv), 12, 53, x, FRONT_Y, true), 'family');
    else add(FRONT_Y, spr(sc, `fa|${lv}`, () => paintMan(FATHER, lv), 13, 57, x, FRONT_Y, true), 'family');
  }
  const cat = s.cat, cb = Math.sin(t * (cat.purr > 0 ? 3.2 : 1.5)) > 0 ? 1 : 0, ct = cat.tail > 0 ? (Math.sin(t * 9) > 0 ? 1 : 0) : 0, ce = cat.ear > 0 ? 1 : 0;
  add(CAT.y, spr(sc, `cat|${cb}${ct}${ce}`, () => paintCat(cb, ct, ce), 10, 12, CAT.x, CAT.y, false), 'cat');
  sc.stands.forEach((e, i) => add(223, e, 'stand', STANDS[i]));
  for (const ex of L.extras) {
    const br = Math.sin(t * 1.3 + ex.x) > 0 ? 1 : 0, flip = ex.x > 160;
    if (ex.kind === 'lady') { const lv = famBow(((s.fam.t + 5) % s.fam.every) - 0.3); add(ex.y, spr(sc, `${ex.key}|${lv}`, () => paintWoman(LADY, lv), 12, 53, ex.x, ex.y, flip), 'lady', ex); }
    else {
      const wf = ex.kind === 'wheelman' ? Math.floor(s.hand.a * 6) % 4 : 0;
      add(ex.y, spr(sc, `${ex.key}|${br}|${wf}`, () => paintMonk(XTRA[ex.kind], br, 0, ex.kind === 'wheelman' ? 4 : 0, 0, wf), 15, 45, ex.x, ex.y, flip), ex.kind, ex);
    }
  }
  if (L.offerer) { const lf = s.offer.lift > 0.4 && s.offer.lift < 3.1 ? 2 : 0; add(L.offerer.y, spr(sc, `off|${lf}`, () => paintOfferer(lf), 8, 25, L.offerer.x, L.offerer.y, false), 'offerer'); }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const bx = it.move ? Math.round(X(it.x)) + it.e.dx : it.e.bx;
    g.globalAlpha = 1; g.drawImage(it.e.cv, bx, it.e.by);
    hits.push({ bx, by: it.e.by, e: it.e, kind: it.kind, ref: it.ref });
  }
  for (let i = 0; i < fl.length; i++) if (fl[i].grp === 'stand') flame(i);
  if (L.offerer) { const lf = s.offer.lift > 0.4 && s.offer.lift < 3.1 ? 2 : 0, fx = X(L.offerer.x), fy = L.offerer.y - 25 + 4 - lf + 1; fr(g, fx, fy, 1, 1, '#fff6d0'); fr(g, fx, fy - 2, 1, 2, '#ffc23e'); }
  // the incense sticks, burning down, a little ash at each tip
  for (const st of s.sticks) {
    const len = Math.round(st.len), bx0 = 160 + st.dx;
    for (let k2 = 0; k2 < len; k2++) fr(g, X(bx0 + st.lean * k2), 283 - k2, 1, 1, k2 < 3 ? '#4a2216' : st.out != null || k2 >= len - st.ash ? '#a49a90' : '#7a3226');
    if (st.out == null) fr(g, X(bx0 + st.lean * len), 283 - len, 1, 1, '#ff7a30');
  }
  for (const a of s.ashes) fr(g, X(a.x), a.y, 1, 1, '#b4aaa0', 0.9);

  // night inside: the sky's light gone, only the lamps; dawn a cooler, paler version
  if (amt.night > 0.01) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = amt.night; g.drawImage(sc.shade, 0, 0); }
  if (amt.dawn > 0.01) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = amt.dawn * 0.32; g.drawImage(sc.shade, 0, 0); }
  // the lamps' light, over everything
  g.globalCompositeOperation = 'lighter';
  const aLit = altarN ? altarOn / altarN : 1;
  glowAt(g, glow(72, 26, 0xffa040, 0.7, 5), X(160), 204, (0.07 + 0.15 * aLit + 0.03 * Math.sin(t * 3.1)) + s.flare * 0.26);
  const sg = glow(5, 5, 0xffb050, 0.9, 3);
  for (let i = 0; i < fl.length; i++) if (flick[i]) glowAt(g, sg, X(fl[i].x), fl[i].y - 2, 0.42 * flick[i] * (1 + s.flare * 0.8 + (s.shrineFlare[fl[i].grp] || 0)));
  for (const x of L.shrines) glowAt(g, glow(24, 16, 0xffa040, 0.6, 4), X(x), 178, 0.16 + (s.shrineFlare[`s${Math.round(x)}`] || 0) * 0.5);
  for (const rk of L.racks) glowAt(g, glow(30, 16, 0xffa040, 0.6, 4), X(rk.x), 288, 0.14 + s.flare * 0.2);
  const tg = glow(2, 2, 0xff6020, 1, 2);
  for (const st of s.sticks) if (st.out == null) glowAt(g, tg, X(160 + st.dx + st.lean * st.len), 283 - st.len, 0.75);
  // dust in the shafts of light
  const ma = shA * 1.6 + amt.night * 0.4;
  if (ma > 0.01) for (const m of s.motes) {
    const y = 180 + m.t * 116, tt = (y - 92) / 208, l = m.a.x0 + 9, r = m.a.x1 - 9;
    const x0 = l + (l - 160) * 0.38 * tt, x1 = r + (r - 160) * 0.38 * tt, x = x0 + (x1 - x0) * m.u + Math.sin(t * 0.5 + m.ph) * 2;
    fr(g, X(x), y, 1, 1, amt.night > 0.5 ? '#a8c0ff' : '#ffe0b0', ma * (0.3 + 0.7 * Math.abs(Math.sin(t * m.sp + m.ph))) * (1 - m.t) * 0.55);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // the smoke
  drawSmoke(sc, s, amt.night > 0.5);
  // sound made visible: soft rings from the bowl and the bell; ripples, petals, a page turning
  for (const q of s.rings) {
    const life = q.big ? 3.4 : 2.6;
    for (let j = 0; j < 3; j++) {
      const age = q.age - j * 0.35;
      if (age <= 0) continue;
      const rr = 3 + age * (q.big ? 13 : 8), a = (1 - age / life) * 0.3;
      for (let an = 0; an < Math.PI * 2; an += 0.3) fr(g, X(q.x) + Math.cos(an) * rr, q.y + Math.sin(an) * rr * 0.5, 1, 1, '#ffe6b0', a);
    }
  }
  for (const q of s.ripples) {
    const rr = 1 + q.age * 3.2, a = 0.5 * (1 - q.age / 2);
    for (let an = 0; an < Math.PI * 2; an += 0.5) fr(g, X(q.x) + Math.cos(an) * rr, q.y + Math.sin(an) * rr * 0.3, 1, 1, '#e8f6ff', a);
  }
  for (const p of s.petals) fr(g, X(p.x), p.y, 1, 1, p.c, Math.min(1, (p.life - p.age) * 2));
  for (const m of L.monks) {
    const pg = s.pages[m.key] || 0;
    if (pg <= 0 || pg > 0.9) continue;
    const tx = m.x + 17 * m.side, th = (1 - pg / 0.9) * Math.PI, ex = tx - Math.cos(th) * 4 * m.side, ey = 245 - Math.sin(th) * 5;
    for (let q = 0; q <= 4; q++) fr(g, X(tx + (ex - tx) * (q / 4)), 245 + (ey - 245) * (q / 4), 1, 1, '#f4ead4');
  }
  // silk ribbons hanging from the valance, stirring
  const ra = 0.5 + s.wind * 2.2, rs = 1.6 + s.wind * 3;
  for (const rb of L.ribbons) for (let row = 0; row < 9; row++) {
    const off = Math.round(Math.sin(t * rs + rb.ph + row * 0.45) * ra * (row / 8));
    fr(g, X(rb.x) + off, 45 + row, 1, 1, row % 3 === 2 ? '#e8b832' : '#c03a32');
    fr(g, X(rb.x) + 1 + Math.round(Math.sin(t * rs + rb.ph + 1 + row * 0.45) * ra * (row / 8)), 45 + row, 1, 1, row % 3 === 1 ? '#2e5aa8' : '#2e8a5a');
  }
  g.globalAlpha = s.haze; g.drawImage(sc.haze, 0, 0);
  g.globalAlpha = 1; g.drawImage(sc.vig, 0, 0);
}

/* ——— the shelf thumbnail ——— */
let PREV = null;
const PREVUP = new Map();
export function preview(ctx) {
  if (!PREV) {
    const sc = SCENES.get(CORE) || finish(buildJob(CORE)), s = makeState(11);
    seed(s, sc);
    for (const lp of s.lamps.values()) { lp.on = true; lp.fuel = 999; }
    s.walkers[1].wait = 99; s.fam.t = 1.5; s.fam.every = 99; s.pros.i = 6; s.pros.t = 0.9;
    for (let i = 0; i < 60; i++) update(s, sc, 1 / 30, null);
    s.walkers[0].x = 268; s.walkers[0].wait = 0; s.walkers[0].pause = 0; s.walkers[0].reach = 1;
    render(sc, s);
    PREV = mk(CORE, H); PREV.getContext('2d').drawImage(sc.buf, 0, 0);
  }
  // sharp pixels at whatever size the thumbnail is shown: a whole-number blow-up, then a smooth fit
  const m = ctx.getTransform?.(), scl = Math.max(1, Math.abs(m?.a || 1)), k = Math.max(1, Math.ceil((640 * scl) / H));
  let up = PREVUP.get(k);
  if (!up) { up = mk(CORE * k, H * k); const u = up.getContext('2d'); u.imageSmoothingEnabled = false; u.drawImage(PREV, 0, 0, CORE * k, H * k); PREVUP.set(k, up); }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(up, 0, 0, 640, 640); ctx.restore();
}

/* ——— the lounge ——— */
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas, { wide: true });
  const s = makeState((Date.now() % 100000) + 1);
  const voice = makeVoice(isPaused);
  let sc = null, job = null, jobW = 0, pendW = 0, pendT = 0, preTried = false, up = null, upg = null;
  const preW = sceneW(Math.round((320 * (globalThis.screen?.width || 640)) / (globalThis.screen?.height || 640)));   // full screen's likely shape
  const view = { bw: CORE, sx: 0, dx: 0 };

  const lampsLit = () => { let n = 0; for (const f of sc.L.flames) if (s.lamps.get(f.id)?.on) n++; return n; };
  const status = () => {
    const n = s.sticks.filter((k) => k.out == null).length;
    setScore(`${TODTXT[TODS[s.tod]]} at the temple · ${NUM[n]} stick${n === 1 ? '' : 's'} of incense · ${sc ? lampsLit() : 'the'} lamps burning`);
  };
  setScore('Click the bell, the incense, the prayer wheels, the lamps…');
  let hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  let msgT = 0, chantT = 0;
  const say = (text) => { clearTimeout(hint); clearTimeout(msgT); setScore(text); msgT = setTimeout(status, 3800); };

  const amb = playAmbience({ murmur: 0.3 }, isPaused);
  const stopMusic = playLoungeMusic('temple', isPaused);

  const inR = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const lightLamps = (filter, already, none) => {
    const dark = sc.L.flames.filter((f) => filter(f) && !s.lamps.get(f.id)?.on && !s.litQ.some((q) => q.id === f.id));
    if (dark.length) { dark.forEach((f, k) => s.litQ.push({ id: f.id, t: k ? 0.16 : 0.05 })); pn(voice, 7, { dur: 1.4, vol: 0.02 }); say(none); return true; }
    if (already) say(already); return false;
  };
  const chant = () => {
    s.chant = 7; amb.set('murmur', 0.9); droneSound(voice, true);
    clearTimeout(chantT); chantT = setTimeout(() => amb.set('murmur', 0.3), 7000);
  };
  // the people and anything else drawn as a sprite answer first, front-most first
  function actOn(h, x, y) {
    const r = s.r;
    switch (h.kind) {
      case 'bell': ringBell(s, voice, false); say('The great bell rings out'); return;
      case 'monk': chant(); s.pages[h.ref.key] = 1.1; swish(0.012); say(h.ref.lead ? 'The old monk leads the chant' : h.ref.v === ROBE.nun ? 'The nuns chant with the monks' : 'The monks chant together; a page is turned'); return;
      case 'walker': h.ref.pause = 3; note(5, { dur: 1, vol: 0.018 }); say(h.ref.k ? 'A pilgrim pauses on her round, palms together' : 'The traveller pauses, palms together'); return;
      case 'pros': if (s.pros.i === 0 || s.pros.i === 10) { s.pros.i = (s.pros.i + 1) % PSEQ.length; s.pros.t = 0; } swish(0.02); say('A pilgrim makes a full prostration'); return;
      case 'elder': s.elder.bt = -0.6; s.elder.bow = Math.max(s.elder.bow, 2.4); for (let k = 0; k < 6; k++) tone(100 + (k % 2), { dur: 0.03, vol: 0.006, type: 'triangle', delay: k * 0.28 }); say('An old woman counts her prayer beads'); return;
      case 'family':
        if (s.fam.t > 4) s.fam.t = 0;
        for (let k = 0; k < 8; k++) s.petals.push({ x: 196 + r() * 22, y: FRONT_Y - 34 + r() * 6, vy: 6 + r() * 8, ph: r() * 6, age: 0, life: 2.4 + r(), c: r() < 0.5 ? '#ffb428' : '#f07a1a' });
        note(4, { dur: 1.2, vol: 0.02 }); note(6, { dur: 1.2, vol: 0.016, delay: 0.2 }); say('A family bows and offers marigolds'); return;
      case 'cat': s.cat.purr = 4; s.cat.tail = 1.5; s.cat.ear = 0.5; for (let k = 0; k < 8; k++) tone(38 + (k % 2), { dur: 0.22, vol: 0.02, type: 'triangle', delay: k * 0.17 }); say('The temple cat purrs in its sleep'); return;
      case 'stand': lightLamps((f) => f.grp === 'stand', 'The lamp stands burn steady', 'The lamp stands are lit'); if (s.lamps.size) s.flare = Math.max(s.flare, 0.4); return;
      case 'wheelman': s.hand.v = 6; tone(91, { dur: 0.6, vol: 0.01 }); say('An old man turns his hand prayer wheel'); return;
      case 'sitter': note(5, { dur: 1, vol: 0.016 }); say('A pilgrim sits in quiet meditation'); return;
      case 'lady': note(5, { dur: 1, vol: 0.016 }); say('A pilgrim bows, palms joined'); return;
      case 'offerer': s.offer.lift = 3.5; s.offer.next = 14; pn(voice, 8, { dur: 1.2, vol: 0.018 }); say('A pilgrim offers a lamp at the shrine'); return;
      default:
    }
  }
  function act(x, y, bx, by) {
    const L = sc.L, r = s.r, lead = L.monks.find((m) => m.lead);
    // the singing bowl first (the old monk's knee is right beside it)
    if (lead && inR(x, y, lead.x + 10, 244, lead.x + 23, 258)) { if (s.lead.t < 0) { s.lead.t = 0.3; s.lead.big = true; s.lead.next = 30; } say('The old monk sounds the singing bowl'); return; }
    for (let i = sc.hits.length - 1; i >= 0; i--) {
      const h = sc.hits[i], lx = Math.floor(bx) - h.bx, ly = by - h.by;
      if (lx < -1 || ly < -1 || lx > h.e.w || ly > h.e.h) continue;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) {
        const xx = lx + dx, yy = ly + dy;
        if (xx >= 0 && yy >= 0 && xx < h.e.w && yy < h.e.h && h.e.a[yy * h.e.w + xx]) hit = true;
      }
      if (hit) return actOn(h, x, y);
    }
    // the incense burner
    if (inR(x, y, 134, 256, 186, 306)) {
      lightStick(s);
      swish(0.03); drip(0.015, 900, 1900); if (voice) voice.tn(76, { dur: 1.6, vol: 0.012, delay: 0.25 });
      say('A new stick of incense is lit'); return;
    }
    // the prayer wheels
    const wi = L.wheels.findIndex((w) => inR(x, y, w.x - 5, 176, w.x + 5, 205));
    if (wi >= 0) {
      L.wheels.forEach((w, i) => { const d = Math.abs(i - wi), ws = s.wheels.get(w.x); if (ws && d <= 1 && w.row === L.wheels[wi].row) ws.v = Math.max(ws.v, d ? 1.4 : 3); });
      swish(0.02); tone(91, { dur: 1.1, vol: 0.012, delay: 0.12 }); tone(98, { dur: 0.8, vol: 0.006, delay: 0.5 });
      say('A prayer wheel spins: om mani padme hum'); return;
    }
    // the statue: only the light answers
    if (inR(x, y, 122, 56, 198, 172)) {
      s.halo = 1.4; s.flare = Math.max(s.flare, 0.5);
      if (voice) { voice.tn(64, { dur: 3.2, vol: 0.018 }); voice.tn(71, { dur: 3.2, vol: 0.013, delay: 0.3 }); voice.tn(76, { dur: 3, vol: 0.009, delay: 0.6 }); }
      say('The lamps glow a little brighter before the Buddha'); return;
    }
    // the butter lamps: light the dark ones, or let them all flare
    if (inR(x, y, 92, 186, 228, 216)) {
      if (!lightLamps((f) => f.grp === 'altar' || f.grp === 'bowl', '', 'More butter lamps are lit')) {
        s.flare = 1; pn(voice, 7, { dur: 1.8, vol: 0.022 }); pn(voice, 9, { dur: 1.8, vol: 0.018, delay: 0.14 }); say('The butter lamps burn bright');
      }
      return;
    }
    for (const rk of L.racks) if (inR(x, y, rk.x - 23, 270, rk.x + 23, 308)) {
      if (!lightLamps((f) => f.grp === `r${rk.x}`, '', 'A pilgrim lights the lamps on the rack')) { s.flare = Math.max(s.flare, 0.7); pn(voice, 6, { dur: 1.6, vol: 0.02 }); say('Rows of lamps burn on the rack'); }
      return;
    }
    for (const tb of L.tables) if (inR(x, y, tb.x - 27, 280, tb.x + 27, 308)) {
      const lp = s.lamps.get(`t${tb.x}`);
      if (lp && !lp.on) { lp.on = true; lp.fuel = 200 + r() * 200; }
      for (let k = 0; k < 6; k++) s.petals.push({ x: tb.x - 20 + r() * 12, y: 284 + r() * 3, vy: 4 + r() * 5, ph: r() * 6, age: 0, life: 1.4 + r(), c: r() < 0.5 ? '#ffb428' : '#f07a1a' });
      note(3, { dur: 1, vol: 0.016 }); say('Marigolds, fruit and sweets are offered'); return;
    }
    // the lotus bowls, the lanterns, the valance and its ribbons
    for (const bx2 of [128, 192]) if (inR(x, y, bx2 - 10, 215, bx2 + 10, 225)) { s.ripples.push({ x: bx2 + (r() - 0.5) * 6, y: 220.5, age: 0 }); drip(0.04, 760, 320); say('Ripples among the lotuses'); return; }
    for (const lx of L.lanterns) if (inR(x, y, lx - 7, 26, lx + 7, 64)) { s.lan[lx] = 1; tone(86, { dur: 0.7, vol: 0.012 }); tone(93, { dur: 0.5, vol: 0.006, delay: 0.1 }); say('A lantern sways'); return; }
    if (y < 56 && (y < 33 || L.ribbons.some((rb) => Math.abs(rb.x - x) < 4) || y < 46)) { s.wind = 1.4; swish(0.05); say('A breeze stirs the silk and the prayer flags'); return; }
    // the side shrines
    for (const sx of L.shrines) if (inR(x, y, sx - 34, 80, sx + 34, 190)) {
      const grp = `s${Math.round(sx)}`;
      s.shrineFlare[grp] = 1;
      for (const f of L.flames) if (f.grp === grp) { const lp = s.lamps.get(f.id); if (lp && !lp.on) { lp.on = true; lp.fuel = 150 + r() * 300; } }
      pn(voice, 8, { dur: 1.4, vol: 0.02 }); tone(88, { dur: 1.2, vol: 0.008, delay: 0.2 }); say('Lamps glow at a side shrine'); return;
    }
    // through the arches: the flags, the Bodhi tree and its birds, the spire, the stupa, or the sky
    for (const a of L.arches) {
      if (a.wall || !inR(x, y, a.x0 + 3, ARCH_TOP - 2, a.x1 - 3, SILL)) continue;
      if (sc.oflags.some((f) => Math.abs(f.x - x) <= 2 && y >= f.y - 1 && y <= f.y + 4)) { s.wind = 1.4; swish(0.05); say('A breeze stirs the prayer flags'); return; }
      const M = sky(sc, 'dusk').mask, onIt = M.solid(x, y) || M.solid(x, y + 2);
      if (a.kind === 'tree' && onIt) {
        for (const bd of s.birds) if (bd.st === 'perch' || r() < 0.5) lift(bd, r, 4 + r() * 5);
        swish(0.03); for (let k = 0; k < 5; k++) tone(96 + Math.round(r() * 5), { dur: 0.07, vol: 0.008, delay: 0.1 + k * 0.13 + r() * 0.05 });
        say('Birds lift from the Bodhi tree, and settle again'); return;
      }
      if (a.kind === 'spire' && onIt && TODS[s.tod] === 'night') { s.spire = 1; pn(voice, 9, { dur: 2, vol: 0.016 }); say('The great spire glows in its lights'); return; }
      if (a.kind === 'stupa' && onIt && L.stupas.includes(a.cx)) {
        const n = s.stupa[a.cx] || 0;
        if (n < 12) { s.stupa[a.cx] = 12; pn(voice, 6, { dur: 1.4, vol: 0.018 }); say('Lamps are lit around the stupa'); }
        else { s.stupa[a.cx] = 0; say('The lamps round the stupa burn out'); }
        return;
      }
      s.todFrom = s.tod; s.tod = (s.tod + 1) % 3; s.todK = 0;
      const tn = TODS[s.tod];
      sky(sc, tn);
      if (tn === 'night') { pn(voice, 2, { dur: 2.2, vol: 0.022 }); pn(voice, 6, { dur: 2.2, vol: 0.016, delay: 0.25 }); }
      else if (tn === 'dawn') { pn(voice, 9, { dur: 2, vol: 0.02 }); pn(voice, 11, { dur: 2, vol: 0.016, delay: 0.2 }); }
      else { pn(voice, 5, { dur: 2, vol: 0.02 }); pn(voice, 7, { dur: 2, vol: 0.016, delay: 0.2 }); }
      say(tn === 'night' ? 'Night falls; the stars come out, the spire is lit' : tn === 'dawn' ? 'The sky pales towards dawn' : 'Dusk again, the sky glowing');
      return;
    }
  }
  const onDown = (e) => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (!sc) return;
    const p = pointIn(canvas, e), W = canvas._snW || 640, bx = (p.x / W) * view.bw + view.sx - view.dx, by = Math.floor(p.y / 2);
    act(bx - sc.ox, p.y / 2, bx, by);
  };
  canvas.addEventListener('pointerdown', onDown);

  // a new frame shape: the hall is rebuilt only once the width has held for a moment, a slice each
  // frame, showing the old hall (centred, cropped or with dark edges) until the new one is ready.
  // Once settled, the full-screen shape is built ahead in slices, so going full screen is instant;
  // the other skies are painted ahead too
  const settle = (bw) => {
    const want = sceneW(bw), now = performance.now();
    if (!sc) { sc = SCENES.get(want) || finish(buildJob(want)); seed(s, sc); }
    if (sc.BW !== want) {
      const cached = SCENES.get(want);
      if (cached) { sc = cached; seed(s, sc); }
      else {
        if (pendW !== want) { pendW = want; pendT = now; }
        if (jobW !== want && now - pendT > 150) { job = buildJob(want); jobW = want; }
      }
    } else {
      pendW = 0;
      if (!job && !preTried && s.t > 1.5 && preW !== want && !SCENES.has(preW)) { job = buildJob(preW); jobW = preW; preTried = true; }
    }
    if (job) {
      const done = pump(job, jobW === want ? 6 : 3);
      if (done) { job = null; jobW = 0; if (done.BW === want) { sc = done; seed(s, sc); } }
    } else if (s.t > 0.05) pumpSky(sc, 3);
  };

  const stopLoop = runLoop((dt) => {
    const W = canvas._snW || 640, bw = Math.max(CORE, Math.round((H * W) / 640));
    settle(bw);
    update(s, sc, dt, voice);
    render(sc, s);
    // whole-number steps without smoothing; any last fraction with a good filter
    view.bw = bw; view.sx = Math.max(0, (sc.BW - bw) >> 1); view.dx = Math.max(0, (bw - sc.BW) >> 1);
    const sw = Math.min(bw, sc.BW), k = Math.max(1, Math.ceil(canvas.height / H));
    if (canvas.height === H * k && canvas.width === bw * k) {
      ctx.imageSmoothingEnabled = false;
      if (view.dx) { ctx.fillStyle = SIDE; ctx.fillRect(0, 0, W, 640); }
      ctx.drawImage(sc.buf, view.sx, 0, sw, H, (view.dx * W) / bw, 0, (sw * W) / bw, 640);
    } else {
      if (!up || up.width !== bw * k || up.height !== H * k) { up = mk(bw * k, H * k); upg = up.getContext('2d'); }
      upg.imageSmoothingEnabled = false;
      if (view.dx) { upg.fillStyle = SIDE; upg.fillRect(0, 0, up.width, up.height); }
      upg.drawImage(sc.buf, view.sx, 0, sw, H, view.dx * k, 0, sw * k, H * k);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(up, 0, 0, W, 640);
    }
  }, isPaused);

  return () => {
    clearTimeout(hint); clearTimeout(msgT); clearTimeout(chantT);
    stopLoop(); stopMusic(); amb.stop(); if (voice) voice.stop();
    canvas.removeEventListener('pointerdown', onDown);
  };
}
