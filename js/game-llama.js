// Llama Trail — a llama on a little red sled, gliding down an endless mountainside through the
// snow. The slope rolls in long gentle swells, with soft crests and the odd kicker that lift you
// into the air; the speed builds and eases like real momentum and never stalls. Space, ↑ or a
// tap jumps; hold it in the air to flip backwards. Let go and the llama eases its sled back
// toward the slope, so an ordinary jump always comes down smoothly. Wooden fences and fallen
// pines lie along the slope on short posts: land on one, or reach it low, and the sled snaps on
// to grind it. Every trick before the sled is back on the snow (each flip, a grind, long air, an
// apple) adds to a combo, which multiplies its points on a clean landing; land clean on two or
// more and the sled takes off in a boost. A wobbly landing only breaks the combo. The run ends
// only on a truly bad landing (upside down, or head first): a tumble into soft snow, a sit-down,
// and the card. The sky turns through dawn, day, gold, dusk and a starry night (a shooting star,
// now and then an aurora), the weather comes and goes (clear spells, soft snow, a fog bank in a
// valley, wisps of cloud over the peaks), and Bach's Prelude in C plays softly underneath. As
// the speed rises the camera eases back and looks further ahead.
// Full screen widens the view (the canvas keeps 640 of height): the camera sees further down the
// slope, with the rider kept to the left third and the whole mountainside drawn to the edges.

import { SIZE, setupCanvas, runLoop, note, card, clamp, playMusic, PRELUDE, swish } from './arcade-kit.js';

export const meta = { id: 'llama', wide: true, title: 'Llama Trail', blurb: 'Glide an endless mountainside: flip, grind the fences, chain tricks into a boost.', keys: 'Space, ↑ or tap to jump · hold to flip · land on rails to grind' };
const BEST_KEY = 'stacknest:arcade-llama-best';

const H = SIZE;
// on the snow the speed builds against a drag that grows with it (a soft top speed rather than a
// wall), and never falls below a gentle glide; the air is floatier than the snow
const G = 1150, G_AIR = 1000, CREST_G = 1350, DRAG = 0.12, DRAG2 = 0.00082, MINV = 220, MAXV = 640, BOOSTV = 820;
const JUMP = 610, FLIP = 8.4, FLIP_AFTER = 0.16, LX = 210;
const CLEAN = 0.75, WOBBLE = 1.35;   // how far off the slope a landing may be: clean, wobbly, or a tumble beyond
const LONG_AIR = 1.2, BOOST_T = 2;
const PTS = { flip: 120, grind: 50, air: 40, apple: 10 };   // trick points, multiplied by the combo on landing
const M = 40;            // pixels to the metre
const SLOPE = 0.34;      // the mountainside's steady fall
const CALM = 250;        // metres of easy going at the start: only easy rails, spaced out
const TAU = Math.PI * 2;
// where the camera holds the rider on a screen W wide: (210, 380) in the square frame; on a wider
// one a touch further left of the same proportion and a little higher, so more of the falling
// slope ahead stays in view
const riderX = (W) => LX + (W - SIZE) * 0.28;
const riderY = (W) => 380 - (W - SIZE) * 0.1;
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const hash = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
// colours: '#rrggbb' or 'rgb(…)' strings, blended; and [r, g, b] arrays for the palettes
const rgbOf = (c) => (c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number));
const blend = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const WHITE = [255, 255, 255];

/* ——— the mountainside: long swells over a steady fall, a rounded kicker now and then, and the
   rails laid along it ahead of the rider. Nothing on it is steeper than a fair hill. Under a
   rail the small ripples and any kicker ease away (a weight w eases in and out over a few
   hundred pixels), so the rail runs smooth and nothing ever jumps. */
function makeGround(seed) {
  const p1 = seed * 1.7, p2 = seed * 2.9, p3 = seed * 4.3;
  const kicker = (x) => {   // a long rounded ramp and a gentle fall: airtime at speed, never a wall
    const k = ((x + seed * 97) % 1400 + 1400) % 1400;
    return k > 380 ? 0 : -38 * Math.sin((Math.PI * k) / 380) ** 2;
  };
  const feats = [];   // in order along the slope, never overlapping
  const featAt = (x) => { for (const f of feats) { if (x < f.x0) return null; if (x <= f.x1) return f; } return null; };
  const y = (x) => {
    const lo = 66 * Math.sin(x / 340 + p1), mid = 22 * Math.sin(x / 142 + p2), hi = 6 * Math.sin(x / 61 + p3), kk = kicker(x);
    let v = x * SLOPE + lo + mid + hi + kk;
    const f = featAt(x);
    if (f) v -= (x < f.a ? smooth((x - f.x0) / (f.a - f.x0)) : x > f.b ? 1 - smooth((x - f.b) / (f.x1 - f.b)) : 1) * (0.45 * lo + 0.5 * mid + hi + kk);
    return v;
  };
  const angle = (x) => Math.atan2(y(x + 2) - y(x - 2), 4);
  // a fence follows the snow on its posts; a log is straight, from end to end
  const railY = (f, x) => (f.type === 'log' ? f.y0 + ((f.y1 - f.y0) * (x - f.r0)) / (f.r1 - f.r0) : y(x) - railH(f, x));
  const railAngle = (f, x) => Math.atan2(railY(f, x + 2) - railY(f, x - 2), 4);
  const add = (f) => {
    feats.push(f);
    if (f.type === 'log') { f.y0 = y(f.r0) - (f.ramp ? f.h0 : f.h); f.y1 = y(f.r1) - f.h; }
    return f;
  };
  const prune = (x) => { while (feats.length && feats[0].x1 < x) feats.shift(); };
  return { y, angle, railY, railAngle, add, prune, feats, nextX: 1100 };
}

// A rail: a wooden fence or a fallen pine on short posts, about a jump's height over the snow.
// An easy one starts low (the log's end resting in the snow, the fence's first post short).
function railFeat(x, m, o = {}, rnd = Math.random) {
  const easy = m < CALM, log = o.type ? o.type === 'log' : rnd() < 0.45;
  const len = o.len ?? (log ? 320 + rnd() * 220 : easy ? 380 + rnd() * 220 : 440 + rnd() * 460);
  const h = log ? (easy ? 26 : 30) : easy ? 34 : 40 + rnd() * 6;
  const ramp = (o.ramp ?? (easy || rnd() < (log ? 0.5 : 0.35))) ? (log ? 120 : 90) : 0;
  const r0 = x + 420, r1 = r0 + len;
  return { kind: 'rail', type: log ? 'log' : 'fence', x0: x, a: r0 - 120, b: r1 + 120, x1: r1 + 420, r0, r1, h, h0: log ? 3 : 12, ramp };
}
const railH = (f, x) => (f.ramp ? f.h0 + (f.h - f.h0) * smooth((x - f.r0) / f.ramp) : f.h);

/* ——— the day: dawn, day, gold, dusk, night ———
   Each hour is a palette: a four-stop sky from the zenith down to the horizon, a hue for the
   ranges (each further range is hazed toward the horizon's colour), the forest, the snow and
   its shade, and the colour of the sun's (or the moon's) light. */
const PHASES = [
  { sky: ['#28306a', '#6c5d9a', '#d88f94', '#f8c59c'], range: '#474a78', forest: '#262b4a', snow: '#f7e9e6', shade: '#b6aed0', sun: '#ffd4ac', light: 0.8 },
  { sky: ['#3f86d0', '#6fade3', '#b5daf2', '#e9f5fb'], range: '#4b7299', forest: '#284a63', snow: '#f8fbff', shade: '#bfd2e6', sun: '#fff5d8', light: 1 },
  { sky: ['#7a7db2', '#d68e79', '#f5b57a', '#fde3ae'], range: '#7a5068', forest: '#432c44', snow: '#fff1de', shade: '#dfb9a8', sun: '#ffe1a0', light: 0.9 },
  { sky: ['#1f1f4e', '#4e3e77', '#ae678a', '#ea9082'], range: '#433558', forest: '#231f3b', snow: '#ead9e7', shade: '#a28fb5', sun: '#ffb48c', light: 0.62 },
  { sky: ['#050822', '#0b1236', '#18224e', '#2c3868'], range: '#161d45', forest: '#0b1128', snow: '#c8d2ee', shade: '#7a87b2', sun: '#cfd8ff', light: 0.42 },
].map((p) => ({ ...p, skyC: p.sky.map(rgbOf), rangeC: rgbOf(p.range), forestC: rgbOf(p.forest), snowC: rgbOf(p.snow), shadeC: rgbOf(p.shade), sunC: rgbOf(p.sun) }));
const hourAt = (c) => {   // c in [0,1): this hour, the next, and how far the turn between them is
  const n = PHASES.length, x = c * n, i = Math.floor(x) % n, t = x - Math.floor(x);
  return [i, (i + 1) % n, t < 0.6 ? 0 : ((t - 0.6) / 0.4) ** 2 * (3 - 2 * (t - 0.6) / 0.4)];   // hold each hour, then turn
};
const lightAt = (c) => { const [i, j, e] = hourAt(c); return PHASES[i].light + (PHASES[j].light - PHASES[i].light) * e; };
const nightOf = (light) => clamp((0.62 - light) / 0.2, 0, 1);
const sunPath = (c) => ((c + 0.92) % 1) / 0.78;   // 0 → 1 from sunrise to sunset; above 1 the sun is down

/* ——— the ranges behind, in atmospheric perspective ——— */
const peak = (u) => 1 - Math.abs(Math.sin(u));
// A ridge never dips below base + amp/10, so each layer is only filled down to where the next one
// in front always covers it (`low`): the same picture, far fewer pixels.
const RANGES = [
  { f: 0.03, base: 300, amp: 150, w1: 300, w2: 131, w3: 53, s: 0.4, haze: 0.6, cap: 0.75, mist: 0.42, low: 372 },
  { f: 0.07, base: 350, amp: 160, w1: 250, w2: 107, w3: 44, s: 1.2, haze: 0.4, cap: 0.95, mist: 0.38, low: 418 },
  { f: 0.13, base: 402, amp: 128, w1: 190, w2: 83, w3: 37, s: 1.9, haze: 0.22, cap: 0.5, mist: 0.3, low: 470, rim: true },
  { f: 0.26, base: 456, amp: 86, w1: 150, w2: 64, w3: 29, s: 3.1, haze: 0.07, cap: 0, trees: true, low: SIZE, rim: true },
];
const SKY_LOW = 322;   // the far range always hides the sky below this
const ridgeY = (x, L) => L.base - L.amp * (0.6 * peak(x / L.w1 + L.s) + 0.3 * peak(x / L.w2 + L.s * 2.1) + 0.1 * Math.sin(x / L.w3));

// The palette for a moment of the day: the two hours either side blended, kept while it holds
// (each hour holds for most of its stretch) and re-blended in small steps as it turns.
let palKey = '', palVal = null;
function palette(c) {
  const [i, j, e0] = hourAt(c), e = Math.round(e0 * 240) / 240, key = `${i}|${j}|${e}`;
  if (key === palKey) return palVal;
  const A = PHASES[i], B = PHASES[j], m = (k) => mix(A[k], B[k], e);
  const horizon = mix(A.skyC[3], B.skyC[3], e), range = m('rangeC'), forest = m('forestC'), snow = m('snowC'), shade = m('shadeC'), sun = m('sunC');
  const light = A.light + (B.light - A.light) * e;
  palVal = {
    i, j, e, light, night: nightOf(light), horizon, sun, snowC: snow, shadeC: shade, forestC: forest,
    top: css(mix(A.skyC[0], B.skyC[0], e)), snow: css(snow), shade: css(shade),
    layers: RANGES.map((L) => css(mix(range, horizon, L.haze))),
    caps: RANGES.map((L) => mix(WHITE, horizon, L.haze * 0.55)),
    trees: css(mix(forest, horizon, 0.1)), slopePine: css(mix(forest, shade, 0.12)), fgPine: css(mix(forest, [8, 10, 24], 0.3)),
    mist: mix(horizon, snow, 0.3), fog: mix(snow, horizon, 0.3), wispC: mix(WHITE, horizon, 0.3),
    rim: css(mix(sun, WHITE, 0.25), 0.55 * (1 - 0.6 * nightOf(light))), edge: css(mix(WHITE, sun, 0.35), 0.85),
  };
  palKey = key;
  return palVal;
}
// Each hour's sky is drawn once into a thin strip and kept; a frame stretches it across the view,
// and while one hour turns into the next the two strips are cross-faded, which is the same as
// blending their colours.
const skyStrips = [];
function skyStrip(i) {
  if (skyStrips[i]) return skyStrips[i];
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256), s = PHASES[i].sky;
  [0, 0.38, 0.72, 1].forEach((at, k) => grd.addColorStop(at, s[k]));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  return (skyStrips[i] = c);
}
// two soft round sprites: white for the snow spray, a cool dark one for the shadow on the snow
const sprites = {};
function sprite(kind) {
  if (sprites[kind]) return sprites[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32), rgb = kind === 'shadow' ? '38,44,88' : '255,255,255';
  grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.45, `rgba(${rgb},.6)`); grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return (sprites[kind] = c);
}

// a soft dot in a colour (the cloud wisps), kept for the colour of the moment
let tintKey = '', tintVal = null;
function tinted(rgb) {
  const key = rgb.map(Math.round).join(',');
  if (key === tintKey) return tintVal;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${key},.9)`); grd.addColorStop(0.5, `rgba(${key},.45)`); grd.addColorStop(1, `rgba(${key},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  tintKey = key; tintVal = c;
  return c;
}

/* ——— the sky ——— */
function sky(ctx, P, S, W) {
  const k = W / SIZE, sh = SKY_LOW + 4;   // 1 in the square frame
  ctx.drawImage(skyStrip(P.i), 1, 0, 2, 256, 0, 0, W, 470);
  if (P.e > 0) { ctx.globalAlpha = P.e; ctx.drawImage(skyStrip(P.j), 1, 0, 2, 256, 0, 0, W, 470); ctx.globalAlpha = 1; }
  if (S.snow > 0.02) { ctx.fillStyle = css(P.shadeC, 0.16 * S.snow); ctx.fillRect(0, 0, W, sh); }   // a softer sky under snow
  const sunA = sunPath(S.cycle), sx = (80 + sunA * 480) * k, sy = 300 - Math.sin(sunA * Math.PI) * 230;
  if (sunA < 1) {   // the warm glow along the horizon while the sun is low
    const low = (1 - Math.sin(sunA * Math.PI)) ** 1.5;
    if (low > 0.02) {
      ctx.save(); ctx.translate(sx, SKY_LOW - 10); ctx.scale(1.8, 0.75);
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
      hg.addColorStop(0, css(P.sun, 0.5 * low)); hg.addColorStop(1, css(P.sun, 0));
      ctx.fillStyle = hg; ctx.fillRect(-260, -260, 520, 520); ctx.restore();
    }
  }
  const night = P.night;
  if (night > 0) {   // stars
    for (let i = 0, n = Math.round(80 * k); i < n; i++) {
      const x = ((hash(i, 1) * W * 1.4 - S.camX * 0.01) % W + W) % W, y = hash(i, 2) * 290;
      ctx.fillStyle = `rgba(255,255,255,${night * (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(S.t * (1 + hash(i, 3) * 2) + i)))})`;
      const r = hash(i, 4) < 0.12 ? 2.2 : 1.5;
      ctx.fillRect(x, y, r, r);
    }
    if (S.aurora > 0.01) aurora(ctx, W, S.t, S.aurora * night);
    // a shooting star now and then: a bright head and a tail that fades behind it
    ctx.lineCap = 'round'; ctx.lineWidth = 1.7;
    for (const s of S.shoot || []) {
      const a = night * clamp(s.l * 2.5, 0, 1) * clamp((1 - s.l) * 8, 0, 1);
      const tx = s.x - s.vx * 0.16, ty = s.y - s.vy * 0.16;
      const sg = ctx.createLinearGradient(tx, ty, s.x, s.y);
      sg.addColorStop(0, 'rgba(255,250,235,0)'); sg.addColorStop(1, `rgba(255,250,235,${a})`);
      ctx.strokeStyle = sg; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, TAU); ctx.fill();
    }
    if (night > 0.05) {   // the moon, with a faint halo
      const mx = 470 * k, my = 110;
      const mg = ctx.createRadialGradient(mx, my, 14, mx, my, 80);
      mg.addColorStop(0, `rgba(220,228,255,${0.2 * night})`); mg.addColorStop(1, 'rgba(220,228,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 80, my - 80, 160, 160);
      ctx.save(); ctx.beginPath(); ctx.arc(mx, my, 18, 0, TAU); ctx.clip();   // a crescent: the disc less an offset one
      ctx.fillStyle = `rgba(246,242,228,${night})`;
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, TAU); ctx.moveTo(mx + 24, my - 6); ctx.arc(mx + 8, my - 6, 16, 0, TAU); ctx.fill('evenodd');
      ctx.restore();
    }
  }
  if (sunA < 1) {   // the sun, with a soft bloom
    const bg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150);
    bg.addColorStop(0, css(P.sun, 0.6)); bg.addColorStop(0.18, css(P.sun, 0.26)); bg.addColorStop(1, css(P.sun, 0));
    ctx.fillStyle = bg; ctx.fillRect(sx - 150, sy - 150, 300, 300);
    ctx.fillStyle = css(mix(P.sun, WHITE, 0.6)); ctx.beginPath(); ctx.arc(sx, sy, 21, 0, TAU); ctx.fill();
  }
}

// an aurora on some nights: soft curtains of green (and a little violet above), bright along
// their lower hem and fading up into the dark, slowly folding
function aurora(ctx, W, t, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [rgb, y0, h, sp, k, step] of [['100,240,180', 78, 150, 1, 1, 8], ['170,130,255', 46, 90, 1.3, 0.5, 12]]) {
    for (let x = 0; x < W; x += step) {
      const xm = x + step / 2;
      const hem = y0 + h + 26 * Math.sin(xm / 170 + t * 0.07 * sp) + 12 * Math.sin(xm / 63 - t * 0.11 * sp);
      const len = h * (0.7 + 0.3 * Math.sin(xm / 90 + t * 0.1 * sp));
      const fold = 0.5 + 0.5 * Math.sin(xm / 41 + t * 0.21 * sp) * Math.sin(xm / 107 - t * 0.05);
      const peak = 0.2 * a * k * (0.25 + 0.75 * fold);
      const g = ctx.createLinearGradient(0, hem - len, 0, hem + 14);
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.65, `rgba(${rgb},${peak * 0.45})`); g.addColorStop(0.9, `rgba(${rgb},${peak})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x, hem - len, step + 0.6, len + 14);
    }
  }
  ctx.restore();
}

// long soft wisps of cloud drifting past the far peaks, tinted by the hour
const PUFFS = [[0, 0, 0.55, 1.2], [-0.22, -0.5, 0.26, 1], [0.1, -0.45, 0.3, 1.1], [0.34, 0.1, 0.22, 0.8], [-0.4, 0.15, 0.2, 0.7]];
function wisps(ctx, P, camX, t, W) {
  const dot = tinted(P.wispC);
  for (let i = 0, n = Math.max(3, Math.round(3 * W / SIZE)); i < n; i++) {
    const span = W + 900, len = 150 + hash(i, 54) * 120, th = 6 + hash(i, 55) * 4;
    const x = (((hash(i, 51) * span - camX * 0.09 - t * (4 + hash(i, 52) * 6)) % span) + span) % span - 450;
    const y = 172 + hash(i, 53) * 96;
    ctx.globalAlpha = (0.26 + 0.3 * P.light) * (0.7 + 0.3 * hash(i, 56));
    for (const [dx, dy, rx, ry] of PUFFS) {
      const cx = x + dx * len, cy = y + dy * th, w = rx * len * 1.35, h = ry * th * 1.9;
      ctx.drawImage(dot, cx - w, cy - h, w * 2, h * 2);
    }
  }
  ctx.globalAlpha = 1;
}

// a bank of fog lying in the valley: stacked soft bands, thickest in the middle of the bank,
// thinning to nothing at its ends and toward its top
function fog(ctx, P, banks, W, base, depth, alpha, t) {
  if (!banks || !banks.length) return;
  const col = P.fog;
  for (const b of banks) {
    const l = b.cx - b.w / 2, r = b.cx + b.w / 2;
    if (r < -20 || l > W + 20) continue;
    const g = ctx.createLinearGradient(l, 0, r, 0);
    g.addColorStop(0, css(col, 0)); g.addColorStop(0.5, css(col, alpha * b.a)); g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    const x0 = Math.max(-20, l), x1 = Math.min(W + 20, r);
    for (let i = 0; i < 3; i++) {
      const hgt = depth * (0.4 + 0.3 * i);
      ctx.beginPath(); ctx.moveTo(x0, H);
      for (let x = x0; x <= x1 + 11; x += 12) {
        const xx = Math.min(x, x1), u = (xx - l) / b.w;
        ctx.lineTo(xx, base - hgt * Math.sin(Math.PI * u) ** 0.7 * (0.82 + 0.18 * Math.sin(xx / 37 + t * 0.35 + i * 2)));
      }
      ctx.lineTo(x1, H); ctx.closePath(); ctx.fill();
    }
  }
}

function pine(ctx, x, base, h, color, rim, side) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const top = base - h + k * h * 0.22, w = h * (0.2 + k * 0.1);
    ctx.moveTo(x, top); ctx.lineTo(x - w, top + h * 0.42); ctx.lineTo(x + w, top + h * 0.42);
  }
  ctx.fill();
  ctx.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.13);
  if (rim) {   // the edges toward the light
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, h / 70);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const top = base - h + k * h * 0.22, w = h * (0.2 + k * 0.1); ctx.moveTo(x, top + 1); ctx.lineTo(x + side * w * 0.92, top + h * 0.4); }
    ctx.stroke();
  }
}

function backdrop(ctx, P, S, W) {
  RANGES.forEach((L, li) => {
    const ox = S.camX * L.f;
    ctx.beginPath(); ctx.moveTo(0, L.low);
    for (let sx = 0; sx <= W + 8; sx += 8) ctx.lineTo(sx, ridgeY(sx + ox, L));
    ctx.lineTo(W, L.low); ctx.closePath();
    ctx.fillStyle = P.layers[li]; ctx.fill();
    if (L.cap) {   // snow on the high ground, hazed like the rock beneath it
      ctx.save(); ctx.clip();
      const g = ctx.createLinearGradient(0, L.base - L.amp, 0, L.base - L.amp * 0.35);
      g.addColorStop(0, css(P.caps[li], 0.9 * L.cap)); g.addColorStop(1, css(P.caps[li], 0));
      ctx.fillStyle = g; ctx.fillRect(0, L.base - L.amp - 1, W, L.amp * 0.65 + 3);
      ctx.restore();
    }
    if (L.rim) {   // a thread of light along the ridge
      ctx.strokeStyle = P.rim; ctx.globalAlpha = li === 3 ? 0.5 : 0.35; ctx.lineWidth = 1.3;
      ctx.beginPath(); for (let sx = 0; sx <= W + 8; sx += 8) { const yy = ridgeY(sx + ox, L) + 0.6; sx ? ctx.lineTo(sx, yy) : ctx.moveTo(sx, yy); } ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (L.trees) for (let k = 0, n = Math.max(64, Math.ceil(W / 12) + 2); k < n; k++) {
      const wx = Math.floor(ox / 12) * 12 + k * 12, sx = wx - ox;
      if (hash(Math.floor(wx / 12), 5) < 0.45) continue;
      pine(ctx, sx, ridgeY(wx, L) + 6, 18 + hash(Math.floor(wx / 12), 6) * 16, P.trees);
    }
    if (L.mist) {   // mist gathering at the foot of the range, in front of everything further away
      const y0 = L.base - L.amp * 0.32, g = ctx.createLinearGradient(0, y0, 0, L.low);
      g.addColorStop(0, css(P.mist, 0)); g.addColorStop(1, css(P.mist, L.mist));
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, L.low - y0);
    }
    if (li === 1) wisps(ctx, P, S.camX, S.t, W);
    if (li === 2) fog(ctx, P, S.fog, W, 440, 74, 0.38, S.t);   // in the valley behind the near hills
  });
  fog(ctx, P, S.fog, W, 506, 70, 0.32, S.t + 3);   // and over their feet
}

/* ——— the llama on its sled. Origin at the sled's foot, facing right, before rotation ——— */
function rider(ctx, P, pose, t, light, fx = {}) {
  const shade = (c) => blend(c, '#1b2140', (1 - light) * 0.55);
  const wool = shade('#f6ecdb'), line = shade('#c8b28c'), dark = '#4f3e30';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (pose !== 'sit') {
    // the sled: two curled runners and a red deck
    ctx.strokeStyle = shade('#6b4a2e'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-36, -2); ctx.lineTo(26, -2); ctx.quadraticCurveTo(40, -2, 38, -14); ctx.quadraticCurveTo(36, -20, 30, -16); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); for (const x of [-26, -6, 14]) { ctx.moveTo(x, -2); ctx.lineTo(x, -9); } ctx.stroke();
    ctx.fillStyle = shade('#cc543b'); ctx.beginPath(); ctx.roundRect(-36, -14, 66, 7, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-33, -13.2, 60, 1.6);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-34, -9.4, 62, 1.4);
    if (pose === 'sled') return;   // the sled on its own, after a tumble
  }
  const by = pose === 'sit' ? -20 : pose === 'grind' ? -31 : -32;
  // tucked legs reaching for the front of the sled
  ctx.strokeStyle = line; ctx.lineWidth = 6.5;
  ctx.beginPath();
  if (pose === 'sit') { ctx.moveTo(8, by + 8); ctx.lineTo(28, by + 18); ctx.moveTo(-18, by + 10); ctx.lineTo(-2, by + 20); }
  else { ctx.moveTo(10, by + 8); ctx.lineTo(26, -16); ctx.moveTo(-14, by + 10); ctx.lineTo(6, -15); }
  ctx.stroke();
  // body and tail
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.arc(-34, by - 6, 8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, by, 31, 18, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  // neck and head
  const lean = pose === 'air' ? -0.06 : pose === 'grind' ? -0.03 : 0;
  ctx.save(); ctx.rotate(lean);
  ctx.fillStyle = wool;
  ctx.beginPath(); ctx.moveTo(12, by - 8); ctx.quadraticCurveTo(18, by - 34, 18, by - 48); ctx.lineTo(32, by - 48); ctx.quadraticCurveTo(31, by - 24, 28, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  const hx = 30, hy = by - 54;
  ctx.beginPath(); ctx.ellipse(hx, hy, 14, 10, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade('#eadbc0'); ctx.beginPath(); ctx.ellipse(hx + 10, hy + 3, 6.5, 5.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = wool;
  for (const ex of [-6, 1]) { ctx.beginPath(); ctx.moveTo(hx + ex, hy - 7); ctx.lineTo(hx + ex - 4, hy - 20); ctx.lineTo(hx + ex + 4, hy - 9); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 2;
  if (pose === 'sit') { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 2.3, 0, TAU); ctx.fill(); }
  // a scarf, its tail streaming back in the wind: longer and livelier with speed, flaring bright in a boost
  const len = pose === 'sit' ? 1 : fx.len ?? 1, flare = fx.flare ?? 0, sp = fx.speed ?? 0;
  ctx.fillStyle = shade(flare > 0.02 ? blend('#2f8f84', '#86ead8', flare * 0.8) : '#2f8f84');
  ctx.beginPath(); ctx.roundRect(13, by - 30, 19, 7, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15, by - 28);
  const flap = pose === 'sit' ? 0.2 : 1 + sp * 0.5 + flare * 0.6, seg = 6 * len, wv = 12 + sp * 7 + flare * 4;
  for (let k = 1; k <= 6; k++) ctx.lineTo(15 - k * seg, by - 28 + Math.sin(t * wv - k) * 2.2 * flap * k / 3 + (pose === 'sit' ? k * 2.6 : k * 0.4 / len));
  for (let k = 6; k >= 0; k--) ctx.lineTo(15 - k * seg, by - 22 + Math.sin(t * wv - k) * 2.2 * flap * k / 3 + (pose === 'sit' ? k * 2.8 : k * 0.6 / len) - (k === 6 ? 2 : 0));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function apple(ctx, sx, sy, t) {
  const bob = Math.sin(t * 3 + sx * 0.05) * 3;
  ctx.fillStyle = 'rgba(255,240,200,.25)'; ctx.beginPath(); ctx.arc(sx, sy + bob, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9443a'; ctx.beginPath(); ctx.arc(sx, sy + bob, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(sx - 3, sy + bob - 3, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy + bob - 8); ctx.lineTo(sx + 2, sy + bob - 13); ctx.stroke();
  ctx.fillStyle = '#5f9a4a'; ctx.beginPath(); ctx.ellipse(sx + 5, sy + bob - 11, 4, 2, -0.5, 0, TAU); ctx.fill();
}

/* ——— rails: a wooden fence, or a fallen pine on short posts ——— */
function railPath(ctx, f, ground, camX, camY, frac, off) {
  ctx.beginPath();
  for (let x = f.r0; ; x += 12) {
    const xx = Math.min(x, f.r1), yy = ground.y(xx) - railH(f, xx) * frac - camY + off;
    xx === f.r0 ? ctx.moveTo(xx - camX, yy) : ctx.lineTo(xx - camX, yy);
    if (xx >= f.r1) break;
  }
}
function rail(ctx, P, f, ground, camX, camY, light) {
  const shade = (c) => blend(c, '#1b2140', (1 - light) * 0.55);
  const snow = 'rgba(255,255,255,.9)';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (f.type === 'fence') {
    const wood = shade('#a0714a'), dark = shade('#6e4a2e'), n = Math.max(2, Math.round((f.r1 - f.r0) / 70));
    ctx.fillStyle = dark;
    const caps = [];
    for (let i = 0; i <= n; i++) {   // the posts, each a little above the top rail
      const x = f.r0 + ((f.r1 - f.r0) * i) / n, gy = ground.y(x) - camY, top = gy - railH(f, x) - 5;
      ctx.fillRect(x - camX - 2.5, top, 5, gy - top + 4);
      caps.push([x - camX, top]);
    }
    ctx.strokeStyle = dark; ctx.lineWidth = 3.4; railPath(ctx, f, ground, camX, camY, 0.45, 0); ctx.stroke();
    ctx.strokeStyle = wood; ctx.lineWidth = 5; railPath(ctx, f, ground, camX, camY, 1, 2.5); ctx.stroke();
    ctx.strokeStyle = snow; ctx.lineWidth = 2; railPath(ctx, f, ground, camX, camY, 1, -0.2); ctx.stroke();
    ctx.fillStyle = snow;
    ctx.beginPath(); for (const [x, y] of caps) { ctx.moveTo(x + 3.5, y + 1); ctx.ellipse(x, y + 1, 3.5, 2.2, 0, 0, TAU); } ctx.fill();
  } else {
    const bark = shade('#7d5536'), barkL = shade('#a27650'), barkD = shade('#4f3420'), cut = shade('#dcb98e');
    const x0 = f.r0 - camX, y0 = f.y0 - camY, x1 = f.r1 - camX, y1 = f.y1 - camY;
    const seg = (off, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0 + off); ctx.lineTo(x1, y1 + off); ctx.stroke(); };
    // crossed stakes holding the log up (none under the end resting in the snow)
    ctx.strokeStyle = barkD; ctx.lineWidth = 3; ctx.beginPath();
    const stakes = [];
    for (let x = f.r0 + (f.ramp ? f.ramp + 20 : 26); x < f.r1 - 30; x += 150) stakes.push(x);
    stakes.push(f.r1 - 18);
    for (const x of stakes) {
      const gy = ground.y(x) - camY, ly = ground.railY(f, x) - camY + 9, sx = x - camX;
      ctx.moveTo(sx - 9, gy + 3); ctx.lineTo(sx + 7, ly); ctx.moveTo(sx + 9, gy + 3); ctx.lineTo(sx - 7, ly);
    }
    ctx.stroke();
    seg(6, 12, bark); seg(10, 3, barkD); seg(3, 3, barkL);
    ctx.setLineDash([9, 17]); seg(7, 1.4, barkD); ctx.setLineDash([]);
    seg(0.6, 3.2, snow);
    // the sawn end, and the root end sunk in a drift
    ctx.fillStyle = cut; ctx.beginPath(); ctx.ellipse(x1 + 1, y1 + 6, 4, 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = barkD; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x1 + 1, y1 + 6, 1.6, 2.6, 0, 0, TAU); ctx.stroke();
    if (f.ramp) { const gy = ground.y(f.r0) - camY; ctx.fillStyle = P.snow; ctx.beginPath(); ctx.ellipse(x0 + 2, gy + 1, 18, 7, 0, Math.PI, TAU); ctx.fill(); }
  }
}

// everything in one pass: the sky, the ranges with their mist, wisps and fog, then the near
// slope (zoomed with the camera) with its pines, track, rails, apples, spray and the rider, then
// the foreground pines, the snowfall, the wind and the combo
function scene(ctx, S) {
  const P = palette(S.cycle), light = P.light, W = S.W, z = S.z || 1, { ground, camX, camY } = S;
  const sunA = sunPath(S.cycle), side = (sunA < 1 ? (80 + sunA * 480) * (W / SIZE) : 470 * (W / SIZE)) > W * 0.45 ? 1 : -1;   // which way the light falls
  sky(ctx, P, S, W);
  backdrop(ctx, P, S, W);
  ctx.save(); ctx.scale(z, z);
  const VW = W / z + 12, VH = H / z + 12;
  const gy = (x) => ground.y(x) - camY;
  // pines standing on the slope behind the rider, dark against the snow, lit along one edge
  for (let k = Math.floor((camX - 80) / 230); k <= Math.floor((camX + VW + 80) / 230); k++) {
    if (hash(k, 11) < 0.5) continue;
    const wx = k * 230 + hash(k, 12) * 120;
    pine(ctx, wx - camX, gy(wx) + 4, 70 + hash(k, 13) * 70, P.slopePine, P.rim, side);
  }
  // the slope
  ctx.beginPath(); ctx.moveTo(-12, VH);
  for (let sx = -12; sx <= VW; sx += 6) ctx.lineTo(sx, gy(camX + sx));
  ctx.lineTo(VW, VH); ctx.closePath();
  const sg = ctx.createLinearGradient(0, 200, 0, VH);
  sg.addColorStop(0, P.snow); sg.addColorStop(1, P.shade);
  ctx.fillStyle = sg; ctx.fill();
  const line = (dy) => { ctx.beginPath(); for (let sx = -12; sx <= VW; sx += 6) { const yy = gy(camX + sx) + dy; sx < -8 ? ctx.moveTo(sx, yy) : ctx.lineTo(sx, yy); } ctx.stroke(); };
  ctx.save(); ctx.clip();
  ctx.strokeStyle = blend(P.shade, P.snow, 0.4); ctx.globalAlpha = 0.5; ctx.lineWidth = 10; line(9);
  ctx.restore();
  ctx.strokeStyle = P.edge; ctx.lineWidth = 1.8; line(0.5);   // the crest of the snow catching the light
  // the sled's track
  ctx.strokeStyle = css(mix(P.shadeC, [90, 103, 136], 0.25), 0.55); ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  for (const p of S.track) { if (!p) { pen = false; continue; } const x = p[0] - camX, y = p[1] - camY + 1; pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
  ctx.stroke();
  // a soft shadow on the snow under the rider, smaller and fainter the higher it flies
  const gU = ground.y(S.px), lift = Math.max(0, gU - S.py), sk = clamp(1 - lift / 340, 0, 1);
  if (sk > 0 && S.pose !== 'sit') {
    ctx.save(); ctx.translate(S.px - camX - 4, gU - camY + 1); ctx.rotate(ground.angle(S.px));
    ctx.globalAlpha = (0.2 + 0.12 * light) * sk * (S.alpha ?? 1);
    const w = 92 * (0.5 + 0.5 * sk), h = 15 * (0.6 + 0.4 * sk);
    ctx.drawImage(sprite('shadow'), -w / 2, -h / 2, w, h); ctx.restore();
  }
  for (const f of ground.feats) if (f.r1 > camX - 20 && f.r0 < camX + VW + 20) rail(ctx, P, f, ground, camX, camY, light);
  for (const a of S.apples) if (!a.got && a.x > camX - 20 && a.x < camX + VW + 20) apple(ctx, a.x - camX, a.y - camY, S.t);
  // snow thrown up behind the sled: soft puffs that swell and fade as they fall; sparks off a fence
  const dot = sprite('snow');
  for (const s of S.spray) {
    if (s.spark) continue;
    const r = s.r * (1.7 + (1 - s.l) * 1.9);
    ctx.globalAlpha = Math.min(1, s.l * 1.1) * 0.9;
    ctx.drawImage(dot, s.x - camX - r, s.y - camY - r, r * 2, r * 2);
  }
  ctx.fillStyle = '#ffdc90';
  for (const s of S.spray) { if (!s.spark) continue; ctx.globalAlpha = Math.min(1, s.l * 2); ctx.fillRect(s.x - camX - s.r / 2, s.y - camY - s.r / 2, s.r, s.r); }
  ctx.globalAlpha = 1;
  if (S.sled) {   // after a tumble, the sled slides on alone
    ctx.save(); ctx.translate(S.sled.x - camX, S.sled.y - camY); ctx.rotate(S.sled.rot); rider(ctx, P, 'sled', S.t, light); ctx.restore();
  }
  // a boost: a ribbon of light streaming off the sled, and a glow about it
  const tr = S.trail || [];
  if (tr.length > 2) {   // one smooth tapering ribbon, fading toward its tail, with a brighter core
    const n = tr.length, head = tr[n - 1], tail = tr[0];
    const g = ctx.createLinearGradient(tail.x - camX, tail.y - camY, head.x - camX, head.y - camY);
    g.addColorStop(0, 'rgba(255,214,140,0)'); g.addColorStop(1, `rgba(255,224,160,${0.62 * head.l})`);
    const ribbon = (wid) => {
      ctx.beginPath();
      for (let side = 1; side >= -1; side -= 2) {
        for (let k = 0; k < n; k++) {
          const i = side > 0 ? k : n - 1 - k, a = tr[Math.max(0, i - 1)], b = tr[Math.min(n - 1, i + 1)];
          const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, w = wid * (0.15 + 0.85 * (i / (n - 1))) * tr[i].l * side;
          const x = tr[i].x - camX - ((b.y - a.y) / d) * w, y = tr[i].y - camY + ((b.x - a.x) / d) * w;
          k || side < 0 ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = g; ribbon(7);
    ctx.fillStyle = `rgba(255,250,232,${0.55 * head.l})`; ribbon(2.4);
  }
  if (S.boost > 0.02) {
    const bx = S.px - camX - Math.cos(S.rot) * 4 + Math.sin(S.rot) * 12, by = S.py - camY - Math.sin(S.rot) * 4 - Math.cos(S.rot) * 12;
    const bg = ctx.createRadialGradient(bx, by, 2, bx, by, 54);
    bg.addColorStop(0, `rgba(255,236,190,${0.42 * S.boost})`); bg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = bg; ctx.fillRect(bx - 54, by - 54, 108, 108);
  }
  ctx.save(); ctx.translate(S.px - camX, S.py - camY); ctx.rotate(S.rot);
  if (S.squash) ctx.scale(1 + 0.1 * S.squash, 1 - 0.16 * S.squash);   // a landing's weight
  if (S.pose === 'sit') { ctx.save(); ctx.rotate(-S.rot + ground.angle(S.px)); rider(ctx, P, 'sit', S.t, light); ctx.restore(); }
  else rider(ctx, P, S.pose, S.t, light, S.scarf);
  ctx.restore();
  for (const w of S.words) {
    ctx.save(); ctx.globalAlpha = Math.min(1, w.l * 1.6); ctx.textAlign = 'center'; ctx.font = `700 ${w.size || 20}px system-ui`;
    ctx.fillStyle = w.gold ? '#ffe6a6' : '#fff'; ctx.shadowColor = 'rgba(30,40,80,.45)'; ctx.shadowBlur = 10;
    ctx.fillText(w.text, S.px + w.dx - camX, S.py - w.dy - camY); ctx.restore();
  }
  ctx.restore();
  // now and then a pine right in front, sliding past as a dark silhouette along the bottom
  const fo = camX * z * 1.3;
  for (let k = Math.floor((fo - 200) / 760); k <= Math.floor((fo + W + 200) / 760); k++) {
    if (hash(k, 71) > 0.32) continue;
    const x = k * 760 + hash(k, 72) * 400 - fo, h = 92 + hash(k, 73) * 46;
    pine(ctx, x, H + h * 0.5, h, P.fgPine, P.rim, side);
  }
  // the snowfall over everything: a few flakes in a clear spell, soft snow in a shower
  const n = Math.round((8 + 84 * (S.snow ?? 0.4)) * W / SIZE);
  ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const near = i % 3 === 0;
    const x = ((hash(i, 21) * W + S.t * (14 + hash(i, 22) * 20) - camX * (near ? 0.8 : 0.5)) % W + W) % W;
    const y = ((hash(i, 23) * H + S.t * (40 + hash(i, 24) * 40) * (near ? 1.3 : 1)) % H + H) % H;
    const r = (1 + hash(i, 25) * 1.6) * (near ? 1.3 : 1);
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  if (S.wind > 0.01) {   // faint streaks of wind at speed, each bright at its head and fading behind
    ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const s of S.streaks) {
      const g = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y + s.len * 0.2);
      g.addColorStop(0, `rgba(255,255,255,${0.26 * S.wind})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y + s.len * 0.2); ctx.stroke();
    }
  }
  if (S.combo) {   // the combo, small by the rider while it builds
    const cx = (S.px - camX) * z + 54 * z, cy = (S.py - camY) * z - 40 * z;   // just right of the rider's chest
    ctx.save(); ctx.textAlign = 'left'; ctx.shadowColor = 'rgba(30,40,80,.5)'; ctx.shadowBlur = 6;
    ctx.font = '700 15px system-ui'; ctx.fillStyle = 'rgba(255,240,205,.95)'; ctx.fillText(`×${S.combo.n}`, cx, cy);
    const w = ctx.measureText(`×${S.combo.n}`).width;
    ctx.font = '600 12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText(fmt(S.combo.pts), cx + w + 6, cy);
    ctx.restore();
  }
}

export function preview(ctx) {
  // a grind along a fence in the gold of the afternoon, sparks flying, apples ahead
  const ground = makeGround(0);
  const f = ground.add(railFeat(900, 600, { type: 'fence', ramp: false, len: 620 }, () => 0.5));
  const px = f.r0 + 190, py = ground.railY(f, px), z = 0.94, rot = ground.railAngle(f, px);
  const camX = px - 228 / z, camY = py - 330 / z;
  const apples = [0, 1, 2, 3].map((k) => { const x = px + 110 + k * 62; return { x, y: ground.railY(f, x) - 44, got: false }; });
  const spray = Array.from({ length: 16 }, (_, i) => ({ x: px - 12 - i * 7 - hash(i, 3) * 10, y: py - 4 - hash(i, 4) * 26 + i * 0.6, r: 1.4 + hash(i, 5) * 1.3, l: 0.25 + 0.6 * hash(i, 6), spark: i % 3 !== 0 }));
  const track = Array.from({ length: 36 }, (_, i) => { const x = f.r0 - 330 + i * 7; return [x, ground.y(x)]; });
  scene(ctx, { W: SIZE, ground, camX, camY, z, cycle: 0.47, t: 1.3, px, py, rot, pose: 'grind', apples, spray, track, words: [], sled: null,
    scarf: { len: 1.6, flare: 0, speed: 0.75 }, snow: 0.2, fog: [], shoot: [], streaks: [], wind: 0, aurora: 0, combo: { n: 2, pts: 170 } });
}

export function start(canvas, { setScore, isPaused, finish }) {
  const ctx = setupCanvas(canvas, { wide: true });
  let W = canvas._snW || SIZE, lx = riderX(W);   // the view's width, read every frame; the rider's place across it
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* none */ }
  // with reduced motion the camera barely zooms and there is no wind
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let still = !!motion?.matches;
  const onMotion = () => { still = !!motion.matches; };
  motion?.addEventListener?.('change', onMotion);

  let ground, state = 'ready', t = 0, cycle = 0.02, held = false, carded = false, restT = 0;
  let px, py, vx, vy, grounded, rot, spin, startX, camX, camY, airT = 0, longAir = false, endM = null, endScore = null, newBest = false;
  let grind = null, cool = null, coolT = 0;   // the rail being ground; the one just left (not caught again at once)
  let chain, tricks, flips, grinds, apples;
  let fruit, spray, track, words, trail, sled, nextFruit, trackGap;
  let boostT = 0, boostAmt = 0, squash = 0, sf = 0, z = 1, wind = 0;
  let snowNow = 0.3, fogNow = [], auroraNow = 0, starNext = 4;
  const shoot = [], streaks = [];
  const wseed = Math.random() * 100, fseed = Math.floor(Math.random() * 1000);

  const reset = () => {
    ground = makeGround(Math.random() * 1000);
    px = 0; py = ground.y(0); vx = 0; vy = 0; grounded = true; rot = ground.angle(0); spin = 0;
    startX = px; lx = riderX(W); z = 1; sf = 0; camX = px - lx; camY = py - riderY(W);
    airT = 0; longAir = false; endM = null; endScore = null; newBest = false;
    grind = null; cool = null; coolT = 0;
    chain = { n: 0, pts: 0 }; tricks = 0; flips = 0; grinds = 0; apples = 0;
    fruit = []; spray = []; track = []; words = []; trail = []; sled = null;
    nextFruit = 620; trackGap = 0; boostT = 0; boostAmt = 0; squash = 0;
    spawn();
  };
  const meters = () => endM ?? Math.max(0, Math.floor((px - startX) / M));   // fixed when the run ends
  const scoreNow = () => endScore ?? meters() + tricks;
  const status = () => setScore(`${fmt(meters())} m · ${fmt(scoreNow())} points${best ? ` · best ${fmt(best)}` : ''}`);

  function ride() { reset(); carded = false; state = 'run'; const a = ground.angle(px); vx = 240 * Math.cos(a); vy = 240 * Math.sin(a); status(); swish(0.05); }
  function press() {
    if (state === 'ready') { ride(); return; }
    if (state === 'rest') { if (restT > 0.6) ride(); return; }
    if (state === 'run' && (grounded || grind)) {   // off the snow, or off a rail mid-grind
      const a = grind ? ground.railAngle(grind.f, px) : ground.angle(px);
      if (grind) leaveRail();
      vy = Math.min(vy, 0) * 0.3 + vy * 0.7 - JUMP * Math.cos(a);
      vx += JUMP * Math.sin(a) * 0.35;
      grounded = false; spin = 0; airT = 0; longAir = false;
      track.push(null);
      note(4, { dur: 0.35, vol: 0.05 });
    }
  }
  const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'Enter') { e.preventDefault(); if (!held) { held = true; press(); } } };
  const onKeyUp = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'Enter') held = false; };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); held = true; press(); };
  const onUp = () => { held = false; };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  /* ——— tricks, the combo and the boost ——— */
  // a word floats up by the rider and keeps up with it; words at once stack rather than overlap
  const word = (text, size, l, dy = 100, gold = false) => {
    while (words.some((o) => Math.abs(o.dy - dy) < size + 2)) dy += size + 3;
    words.push({ text, dx: 0, dy, l, size, gold });
  };
  function trick(name, pts, quiet = false) {
    chain.n += 1; chain.pts += pts;
    if (!quiet) word(name, 15, 0.75, 104);
  }
  function flipped(turns) {
    chain.n += turns; chain.pts += PTS.flip * turns; flips += turns;
    word(turns > 1 ? `${turns}× backflip` : 'backflip', 20, 1, 92);
    note(7, { dur: 0.6, vol: 0.06 }); note(9, { dur: 0.8, vol: 0.05, delay: 0.09 }); if (turns > 1) note(11, { dur: 0.9, vol: 0.05, delay: 0.18 });
  }
  // the sled is back on the snow: a clean landing pays the combo (and boosts on two or more), a
  // wobbly one keeps the tricks' points but breaks the combo. Returns a little speed to add.
  function cash(clean) {
    const { n, pts } = chain;
    chain = { n: 0, pts: 0 };
    if (!clean) { tricks += pts; word('wobbly…', 20, 0.8, 80); return 0; }
    if (!n) { note(2, { dur: 0.3, vol: 0.03 }); return 0; }
    const gained = pts * n;
    tricks += gained;
    if (n < 2) { word(`+${fmt(gained)}`, 16, 0.9, 120); return 40; }
    boostT = BOOST_T;
    word(`×${n}`, 30, 1.3, 132, true); word(`+${fmt(gained)}`, 16, 1.1, 104);
    note(9, { dur: 0.5, vol: 0.05, delay: 0.05 }); note(11, { dur: 0.6, vol: 0.05, delay: 0.14 }); note(14, { dur: 0.9, vol: 0.045, delay: 0.24 });
    swish(0.06);
    return 120;
  }
  function puff(x, y, n, s) {
    for (let i = 0; i < n; i++) spray.push({ x: x - 16 + Math.random() * 40, y: y - 2, vx: (Math.random() - 0.6) * (120 + 140 * s), vy: -30 - Math.random() * (80 + 120 * s), r: 2 + Math.random() * (2 + 2.5 * s), l: 0.85 });
  }

  function tumble() {   // a truly bad landing: into the soft snow, and the run is over
    state = 'rest'; restT = 0;
    endM = meters(); endScore = endM + tricks;
    if (endScore > best) { best = endScore; newBest = true; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* not kept */ } }
    chain = { n: 0, pts: 0 }; grind = null; boostT = 0;
    sled = { x: px, y: py, rot, vx: Math.max(160, Math.hypot(vx, vy) * 0.7) };
    for (let i = 0; i < 24; i++) spray.push({ x: px + (Math.random() - 0.5) * 40, y: py - 10, vx: (Math.random() - 0.3) * 260, vy: -80 - Math.random() * 260, r: 2 + Math.random() * 4, l: 1 });
    note(0, { dur: 1.1, vol: 0.06 }); note(2, { dur: 1.1, vol: 0.04 });
    status();
  }

  function land() {
    const a = ground.angle(px), diff = Math.abs(wrapAng(rot - a));
    const turns = Math.floor((spin + 0.9) / TAU);
    const hit = Math.max(0, vy * Math.cos(a) - vx * Math.sin(a));   // how hard it came down into the snow
    py = ground.y(px); grounded = true; track.push([px, py]);
    if (diff > WOBBLE) { tumble(); return; }
    // keep the speed that runs along the snow
    let v = vx * Math.cos(a) + vy * Math.sin(a);
    if (diff < CLEAN) {
      if (turns > 0) flipped(turns);
      v += cash(true);
    } else { v *= 0.85; cash(false); }
    v = clamp(v, MINV, (boostT > 0 ? BOOSTV : MAXV) + 60);
    vx = v * Math.cos(a); vy = v * Math.sin(a); rot = a; spin = 0;
    squash = clamp(hit / 700, 0.15, 1);
    puff(px, py, 6 + Math.round(squash * 12), squash);
    status();
  }

  /* ——— rails ——— */
  function startGrind(f, lift, v) {
    grind = { f, lift: clamp(lift, -8, 48), dist: 0, v: Math.max(MINV, v) };
    grounded = false; spin = 0; airT = 0; longAir = false;
    grinds += 1; trick('grind', PTS.grind);
    track.push(null);
    squash = Math.max(squash, 0.3);
    swish(0.035); note(5, { dur: 0.45, vol: 0.04 });
    puff(px, ground.railY(f, px), 5, 0.3);
  }
  function leaveRail() {
    chain.pts += Math.min(40, Math.round(grind.dist * 0.06));   // a long grind is worth a little more
    cool = grind.f; coolT = 0.3; grind = null;
  }
  // in the air, over a rail: coming down onto it, or reaching it low, snaps the sled on
  function catchRail(ox, oy) {
    for (const f of ground.feats) {
      if (px < f.r0 + 2 || px > f.r1 - 8) continue;
      const below = py - ground.railY(f, px);
      if (vy >= 0 && oy <= ground.railY(f, ox) + 1 && below >= 0) return f;
      if (below > -3 && below < 30 && !(f === cool && coolT > 0)) return f;
    }
    return null;
  }
  function landOnRail(f) {
    const a = ground.railAngle(f, px), diff = Math.abs(wrapAng(rot - a));
    const turns = Math.floor((spin + 0.9) / TAU);
    if (diff > WOBBLE) { tumble(); return; }
    if (diff < CLEAN) { if (turns > 0) flipped(turns); }
    else cash(false);
    startGrind(f, py - ground.railY(f, px), Math.min(vx * Math.cos(a) + vy * Math.sin(a), (boostT > 0 ? BOOSTV : MAXV) + 40));
  }

  /* ——— the slope ahead: rails laid in well before they come into view ——— */
  function plan(kind, o = {}) {
    const x = ground.nextX, m = x / M;
    if (!kind) kind = Math.random() < (m < CALM ? 0.85 : 0.75) ? 'rail' : 'open';
    if (kind === 'rail') {
      const f = ground.add(railFeat(x, m, o));
      if (o.apples ?? Math.random() < 0.6) {   // an arc of apples a hop above the rail: jump off it to gather them
        const n = 3 + Math.floor(Math.random() * 3), c = 0.35 + Math.random() * 0.35;
        for (let k = 0; k < n; k++) { const ax = f.r0 + (f.r1 - f.r0) * c + (k - (n - 1) / 2) * 36; fruit.push({ x: ax, y: ground.railY(f, ax) - 112 - Math.sin((k / (n - 1)) * Math.PI) * 40, got: false }); }
      }
      ground.nextX = f.x1 + (m < CALM ? 500 + Math.random() * 900 : 100 + Math.random() * 900);
    } else ground.nextX = x + 900 + Math.random() * 900;
  }
  function spawn() {
    const view = camX + W / z;
    while (ground.nextX < view + 2600) plan();
    while (nextFruit < view + 300) {   // an arc of apples over the open snow, high enough to be jumped for
      const x0 = nextFruit, n = 3 + Math.floor(Math.random() * 3);
      const r = ground.feats.find((f) => x0 + n * 34 > f.r0 - 120 && x0 < f.r1 + 120);
      if (r) { nextFruit = r.r1 + 140; continue; }
      for (let k = 0; k < n; k++) { const x = x0 + k * 34; fruit.push({ x, y: ground.y(x) - 118 - Math.sin((k / (n - 1)) * Math.PI) * 55, got: false }); }
      nextFruit += 700 + Math.random() * 900;
    }
    fruit = fruit.filter((a) => a.x > camX - 40 && !a.got);
    ground.prune(camX - 600);
  }

  /* ——— moving ——— */
  // speed along the snow (or a rail, with less friction): gravity down the slope against the
  // drag; above the top speed it bleeds back gently, and a boost raises the top and pushes on
  function speed(v, s, dt, d = 1) {
    const cap = boostT > 0 ? BOOSTV : MAXV;
    v += (G * s - d * (DRAG * v + DRAG2 * v * v)) * dt;
    if (boostT > 0) v += 200 * dt;
    if (v > cap) v -= (v - cap) * Math.min(1, dt * 2.5);
    return Math.max(MINV, v);
  }
  function groundStep(dt) {
    const a = ground.angle(px), tx = Math.cos(a), ty = Math.sin(a);
    const v = speed(vx * tx + vy * ty, ty, dt);
    vx = v * tx; vy = v * ty;
    const nx = px + vx * dt, by = py + vy * dt + 0.5 * CREST_G * dt * dt;
    if (ground.y(nx) - by > 1.5 && v > 280) {   // over a crest fast enough: the snow falls away
      grounded = false; spin = 0; airT = 0; longAir = false; px = nx; py = by; vy += G_AIR * dt; track.push(null);
      return;
    }
    px = nx; py = ground.y(px);
    rot += wrapAng(ground.angle(px) - rot) * Math.min(1, dt * 14);
    trackGap += vx * dt;
    if (trackGap > 7) { track.push([px, py]); trackGap = 0; }
    if (Math.random() < (v / 600) * (1 + sf)) spray.push({ x: px - 30, y: py - 2, vx: -v * 0.25 - Math.random() * 60, vy: -30 - Math.random() * (90 + 70 * sf), r: (1.4 + Math.random() * 2.2) * (0.8 + 0.7 * sf), l: 0.7 });
    for (const f of ground.feats) if (px >= f.r0 && px <= f.r1 - 8) { startGrind(f, py - ground.railY(f, px), v); break; }   // reaching a rail: up onto it
  }
  function grindStep(dt) {
    const f = grind.f, a = ground.railAngle(f, px), tx = Math.cos(a), ty = Math.sin(a);
    grind.v = speed(grind.v, ty, dt, 0.6);
    vx = grind.v * tx; vy = grind.v * ty;
    px += vx * dt;
    grind.lift *= Math.exp(-dt * 16);   // a quick hop up onto it when caught low
    grind.dist += grind.v * dt;
    py = ground.railY(f, px) + grind.lift;
    rot += wrapAng(a - rot) * Math.min(1, dt * 16);
    if (f.type === 'fence') { if (Math.random() < 0.8) spray.push({ x: px - 10 + Math.random() * 8, y: py - 1, vx: -grind.v * 0.35 - Math.random() * 90, vy: -50 - Math.random() * 130, r: 1.4 + Math.random() * 1.2, l: 0.45, spark: true }); }
    else if (Math.random() < 0.6) spray.push({ x: px - 14, y: py - 2, vx: -grind.v * 0.2 - Math.random() * 50, vy: -20 - Math.random() * 70, r: 1.4 + Math.random() * 2, l: 0.65 });
    if (px >= f.r1 - 8) { leaveRail(); airT = 0; longAir = false; spin = 0; track.push(null); }   // off the end, into the air
  }
  function airStep(dt) {
    const ox = px, oy = py, avy = Math.abs(vy);
    vy += G_AIR * (avy < 170 ? 0.6 + 0.4 * (avy / 170) : 1) * dt;   // a little hang at the top of the arc
    vx *= 1 - dt * 0.04;
    px += vx * dt; py += vy * dt;
    airT += dt;
    if (held && airT > FLIP_AFTER) { rot -= FLIP * dt; spin += FLIP * dt; }   // a tap is a jump; holding on flips
    else {
      // let go, and the llama eases its sled toward the slope it is coming down onto; a flip
      // let go past halfway carries on round, and that counts toward it
      const step = wrapAng(ground.angle(px + vx * 0.12) - rot) * Math.min(1, dt * (spin > 0.4 ? 4.5 : 3.2));
      rot += step;
      if (spin > 0.4 && step < 0) spin -= step;
    }
    if (!longAir && airT > LONG_AIR) { longAir = true; trick('long air', PTS.air); }
    const r = catchRail(ox, oy);
    if (r) { landOnRail(r); return; }
    const hx = px + Math.sin(rot) * 58, hy = py - Math.cos(rot) * 58;   // the top of the rider
    if (py >= ground.y(px)) land();
    else if (Math.cos(rot - ground.angle(px)) < 0.2 && hy >= ground.y(hx) - 4) { py = Math.min(py, ground.y(px)); tumble(); }   // head first into the snow
  }

  function weather(dt) {
    // snow comes and goes: clear spells, then a soft shower
    const s = 0.6 * Math.sin(t / 29 + wseed) + 0.4 * Math.sin(t / 53 + wseed * 1.7);
    snowNow = smooth((s + 0.15) / 0.9);
    // now and then a bank of fog drifts through the valley
    const rx = camX * 0.2 + t * 9;
    fogNow = [];
    for (let k = Math.floor((rx - 1500) / 2600); k <= Math.floor((rx + W + 1500) / 2600); k++) {
      if (hash(k + fseed, 32) > 0.5) continue;
      fogNow.push({ cx: k * 2600 + 700 + hash(k + fseed, 31) * 1100 - rx, w: 760 + hash(k + fseed, 33) * 600, a: 1 });
    }
    // the night: shooting stars, and on some nights an aurora
    const night = nightOf(lightAt(cycle));
    auroraNow = night * smooth((0.7 * Math.sin(t / 41 + wseed * 0.7) + 0.3 * Math.sin(t / 97 + wseed) - 0.1) / 0.5);
    starNext -= dt;
    if (night > 0.6 && starNext <= 0) {
      const dir = Math.random() < 0.7 ? -1 : 1;
      shoot.push({ x: W * (0.25 + Math.random() * 0.6), y: 30 + Math.random() * 120, vx: dir * (420 + Math.random() * 260), vy: 110 + Math.random() * 90, l: 1, d: 0.7 + Math.random() * 0.5 });
      starNext = 3 + Math.random() * 6;
    }
    for (const st of shoot) { st.x += st.vx * dt; st.y += st.vy * dt; st.l -= dt / st.d; }
    while (shoot.length && shoot[0].l <= 0) shoot.shift();
    // wind streaks at speed (none with reduced motion)
    wind += ((still ? 0 : smooth((sf - 0.5) / 0.5)) - wind) * Math.min(1, dt * 2);
    if (wind > 0.01) {
      const fresh = (s0, init) => Object.assign(s0, { x: init ? Math.random() * W : W + Math.random() * 240, y: 280 + Math.random() * (H - 300), len: 50 + Math.random() * 80, sp: 900 + Math.random() * 700 });
      while (streaks.length < Math.round(12 * W / SIZE)) streaks.push(fresh({}, true));
      for (const st of streaks) { st.x -= st.sp * dt; st.y -= st.sp * 0.2 * dt; if (st.x + st.len < -10 || st.y < 150) fresh(st, false); }
    }
  }

  function update(dt) {
    W = canvas._snW || SIZE;
    const lxTo = riderX(W);   // after a resize the camera glides to the new framing
    lx = Math.abs(lxTo - lx) < 0.5 ? lxTo : lx + (lxTo - lx) * Math.min(1, dt * 3);
    t += dt;
    cycle = (cycle + dt / 240) % 1;
    coolT -= dt;
    if (state === 'run') {
      if (grind) grindStep(dt);
      else if (grounded) groundStep(dt);
      else airStep(dt);
      if (state === 'run') {
        for (const a of fruit) {
          if (!a.got && Math.hypot(a.x - px, a.y - (py - 40)) < 34) {
            a.got = true; apples += 1; note(7 + (apples % 5), { dur: 0.6, vol: 0.07 });
            if (grounded && !grind) tricks += PTS.apple; else trick('apple', PTS.apple, true);   // in the air, part of the combo
          }
        }
        spawn();
      }
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) status();
    } else if (state === 'rest') {
      restT += dt;
      // the llama skids to a stop in the snow; the sled runs on a little and stops
      const a = ground.angle(px);
      const v = Math.max(0, Math.hypot(vx, vy) * Math.exp(-dt * 3.2));
      vx = v * Math.cos(a); vy = v * Math.sin(a);
      px += vx * dt; py += (ground.y(px) - py) * Math.min(1, dt * 12);
      rot += wrapAng(a - rot) * Math.min(1, dt * 6);
      if (sled) {
        sled.vx *= Math.exp(-dt * 1.4); sled.x += sled.vx * dt; sled.y += (ground.y(sled.x) - sled.y) * Math.min(1, dt * 12);
        sled.rot += wrapAng(ground.angle(sled.x) - sled.rot) * Math.min(1, dt * 8);
      }
    }
    if (state === 'ready') { rot = ground.angle(px); }
    // the boost: its light ribbon, the glow and the flaring scarf ease in and out
    boostT = Math.max(0, boostT - dt);
    boostAmt += ((boostT > 0 ? 1 : 0) - boostAmt) * Math.min(1, dt * (boostT > 0 ? 8 : 2.2));
    if (boostAmt > 0.03 && state === 'run') trail.push({ x: px + Math.sin(rot) * 7, y: py - Math.cos(rot) * 7, l: boostAmt });
    for (const p of trail) p.l -= dt * 2.4;
    trail = trail.filter((p) => p.l > 0);
    squash *= Math.exp(-dt * 10);
    for (const s of spray) { s.vy += 600 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt * 1.6; }
    spray = spray.filter((s) => s.l > 0);
    for (const w of words) { w.dy += 30 * dt; w.l -= dt * 0.9; }
    words = words.filter((w) => w.l > 0);
    if (track.length > 260) track.splice(0, track.length - 260);
    // the camera: as the speed builds it eases back and looks a little further ahead; it keeps
    // the rider a little left of centre and follows the slope (and, less, a jump) up and down
    const v = state === 'run' ? (grind ? grind.v : Math.hypot(vx, vy)) : 0;
    sf += (clamp((v - 320) / 440, 0, 1) - sf) * (1 - Math.exp(-dt * 0.9));
    z = 1 - (still ? 0.04 : 0.13) * sf;
    const lxS = lx - 46 * sf, lyS = riderY(W) - 34 * sf;
    camX = px - lxS / z;
    const aim = state === 'run' && !grounded && !grind ? py * 0.7 + Math.min(ground.y(px), py + 260) * 0.3 : py;
    camY += (aim - lyS / z - camY) * Math.min(1, dt * 3.5);
    weather(dt);
    draw();
  }

  const comboNow = () => {
    if (state !== 'run' || (grounded && !grind)) return null;
    const turns = !grind && spin > 0 ? Math.floor((spin + 0.9) / TAU) : 0;   // flips so far, as a landing would count them
    const n = chain.n + turns;
    return n ? { n, pts: chain.pts + turns * PTS.flip } : null;
  };
  function draw() {
    const pose = state === 'rest' ? 'sit' : grind ? 'grind' : grounded ? 'ride' : 'air';
    scene(ctx, { W, ground, camX, camY, z, cycle, t, px, py, rot, pose, apples: fruit, spray, track, words, sled, trail, boost: boostAmt, squash,
      scarf: { len: 1 + 0.8 * sf + 0.5 * boostAmt, flare: boostAmt, speed: sf }, snow: snowNow, fog: fogNow, aurora: auroraNow, shoot, streaks, wind, combo: comboNow() });
    const cx = (W - SIZE) / 2;   // cards stay in the middle of the screen
    if (state === 'ready') { ctx.save(); ctx.translate(cx, 0); card(ctx, [{ text: 'Llama Trail', size: 34, weight: 700 }, { text: 'tap to jump · hold to flip · land on rails to grind', size: 17, weight: 500, alpha: 0.95 }, { text: 'Space, ↑ or tap to set off', size: 15, weight: 500, alpha: 0.8 }], { y: 150, shadow: 'rgba(30,40,80,.45)' }); ctx.restore(); }
    // after a breath sitting in the snow, the round's card: a kind word, the ride, what's next
    if (state === 'rest' && restT > 1.1 && !carded && finish) {
      carded = true;
      const stats = `${fmt(meters())} m · ${fmt(scoreNow())} points · ${flips} flip${flips === 1 ? '' : 's'} · ${grinds} grind${grinds === 1 ? '' : 's'} · ${apples} apple${apples === 1 ? '' : 's'}${newBest ? ' · a new best' : best ? ` · best ${fmt(best)}` : ''}`;
      finish({ title: 'a soft landing in the snow', stats, againLabel: 'Ride again', again: ride });
    }
    if (state === 'rest' && !finish) { ctx.save(); ctx.translate(cx, 0); card(ctx, [{ text: 'A soft landing.', size: 28, weight: 700 }, { text: restT > 0.6 ? 'Tap to ride again' : ' ', size: 16, weight: 500, alpha: 0.85 }], { y: 200 }); ctx.restore(); }
  }

  reset();
  status();
  draw();
  const stopLoop = runLoop(update, isPaused);
  const stopMusic = playMusic(PRELUDE, isPaused);
  return () => {
    stopLoop();
    stopMusic();
    motion?.removeEventListener?.('change', onMotion);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  };
}
