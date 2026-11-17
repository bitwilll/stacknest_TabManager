// Pixel Café — a lounge in pixel art: a corner table in a small café on a rainy evening. Rain
// on the big window, umbrellas passing under the street lamp, a neon sign, a barista at the
// espresso machine, steam off your latte, a cat asleep on the window seat, a candle. A soft
// bossa plays over the murmur of the room. Click the cup to sip (the barista brings another),
// the window to change the weather, the sign to change its colour, or the cat.
// Drawn on a 160×160 grid and scaled up with smoothing off, so every pixel stays crisp.

import { SIZE, setupCanvas, runLoop, pointIn, tone, drip, playMusic, playAmbience, BOSSA } from './arcade-kit.js';

export const meta = { id: 'cafe', title: 'Pixel Café', blurb: 'A corner table on a rainy evening, in pixels.', keys: 'Click the cup, window, sign or cat', lounge: true };

const G = 160, PX = SIZE / G;
const GLYPH = {
  C: ['111', '100', '100', '100', '111'], A: ['010', '101', '111', '101', '101'], F: ['111', '100', '110', '100', '100'],
  E: ['111', '100', '110', '100', '111'], M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
  U: ['101', '101', '101', '101', '111'], O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
};
const NEON = [['#ff6fae', '#ffd1e6'], ['#5ff0d8', '#d6fff8'], ['#ffd25f', '#fff3c8']];

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function makeState() {
  const r = rng(11);
  return {
    t: 0, weather: 'rain', neon: 0, sip: 0, cup: 1, refill: 0, hearts: [], bell: 0,
    rain: Array.from({ length: 70 }, () => ({ x: 6 + r() * 64, y: 18 + r() * 74, v: 60 + r() * 30 })),
    flakes: Array.from({ length: 40 }, () => ({ x: 6 + r() * 64, y: 18 + r() * 74, v: 8 + r() * 8, p: r() * 6 })),
    walkers: [{ x: -10, v: 7, c: '#d9534f', dir: 1 }, { x: 90, v: 5, c: '#5b8bd9', dir: -1 }],
    barista: { x: 112, goal: 112, wait: 2 }, steam: [],
  };
}

function scene(p, s) {
  const px = (x, y, w, h, c) => { p.fillStyle = c; p.fillRect(Math.round(x), Math.round(y), w, h); };
  const text = (str, x, y, c) => { let cx = x; for (const ch of str) { const g = GLYPH[ch]; if (g) g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') px(cx + rx, y + ry, 1, 1, c); })); cx += 4; } };

  // wall, ceiling, wainscot, floor
  px(0, 0, G, 104, '#4a3442'); px(0, 0, G, 6, '#2a1f28');
  for (let x = 0; x < G; x += 8) px(x, 6, 1, 98, '#43303c');
  px(0, 96, G, 12, '#6b4430'); for (let x = 2; x < G; x += 10) px(x, 97, 1, 10, '#5a3826');
  px(0, 108, G, 12, '#3a2a24');

  // the window and the street beyond
  const night = s.weather === 'clear' ? '#1d2550' : '#2a3358';
  px(6, 18, 64, 74, night);
  px(6, 18, 64, 20, s.weather === 'snow' ? '#5a6488' : '#384273');
  for (const [bx, bw, bh] of [[6, 14, 30], [21, 10, 38], [32, 18, 26], [51, 12, 34], [64, 6, 28]]) {
    px(bx, 92 - bh, bw, bh, '#1b1e3a');
    for (let wy = 92 - bh + 3; wy < 88; wy += 5) for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) if ((wx * 7 + wy * 13) % 5 < 2) px(wx, wy, 2, 2, (wx + wy) % 3 ? '#f5c86b' : '#9ad4f5');
  }
  px(6, 84, 64, 8, '#2c2f4a');   // the wet street
  for (let x = 8; x < 70; x += 9) px(x, 88, 5, 1, '#565c86');
  // the street lamp and its pool of light
  px(48, 48, 1, 40, '#121428'); px(46, 46, 5, 3, '#121428');
  p.globalAlpha = 0.25 + Math.sin(s.t * 2) * 0.02; px(41, 49, 15, 6, '#ffe9a8'); px(38, 55, 21, 8, '#ffe9a8'); px(36, 84, 25, 4, '#ffe9a8'); p.globalAlpha = 1;
  px(47, 48, 3, 2, '#fff3c8');
  // people passing with umbrellas
  for (const w of s.walkers) {
    const wx = Math.round(w.x), step = Math.floor(s.t * 4 + wx) % 2;
    px(wx - 4, 70, 9, 2, w.c); px(wx - 3, 69, 7, 1, w.c); px(wx, 72, 1, 3, '#cfc9c0');
    px(wx - 1, 74, 3, 7, '#2a2a33'); px(wx - 1 + step, 81, 1, 3, '#2a2a33'); px(wx + 1 - step, 81, 1, 3, '#2a2a33');
  }
  if (s.weather === 'rain') for (const d of s.rain) px(d.x, d.y, 1, 3, 'rgba(180,200,255,.55)');
  if (s.weather === 'snow') for (const f of s.flakes) px(f.x + Math.sin(s.t + f.p) * 1.5, f.y, 1, 1, '#ffffff');
  if (s.weather === 'clear') for (let i = 0; i < 9; i++) if (Math.sin(s.t * 1.7 + i * 2.3) > 0) px(10 + i * 7, 22 + (i * 5) % 12, 1, 1, '#ffffff');
  // drops on the glass
  if (s.weather === 'rain') for (let i = 0; i < 10; i++) { const y = 20 + ((s.t * (6 + i) + i * 17) % 70); px(9 + i * 6, y, 1, 2, 'rgba(220,230,255,.7)'); }
  // frame, mullions, sill
  px(4, 16, 68, 2, '#2b1d18'); px(4, 92, 68, 3, '#2b1d18'); px(4, 16, 2, 79, '#2b1d18'); px(70, 16, 2, 79, '#2b1d18');
  px(37, 18, 2, 74, '#2b1d18'); px(6, 54, 64, 2, '#2b1d18');
  // the neon sign hanging in the window
  const [nc, ng] = NEON[s.neon];
  const flick = Math.sin(s.t * 23) > 0.97 ? 0.5 : 1;
  p.globalAlpha = 0.25 * flick; px(17, 23, 21, 11, nc); p.globalAlpha = flick;
  text('CAFE', 20, 26, ng); p.globalAlpha = 1;
  px(27, 18, 1, 5, '#1a1218');

  // window seat with the cat
  px(4, 95, 70, 5, '#8a4b3d'); px(4, 100, 70, 3, '#6b3a30');
  const br = Math.sin(s.t * 1.3) > 0 ? 0 : 1;
  px(12, 89 + br, 14, 6 - br, '#e2a65c'); px(10, 90, 5, 5, '#e2a65c'); px(10, 88, 1, 2, '#e2a65c'); px(14, 88, 1, 2, '#e2a65c');
  px(11, 92, 1, 1, '#5a3a1a'); px(13, 92, 1, 1, '#5a3a1a'); px(16, 90 + br, 1, 4, '#c98845'); px(21, 90 + br, 1, 4, '#c98845');
  px(25, 93, 4, 2, '#e2a65c');
  for (const h of s.hearts) { p.globalAlpha = h.l; px(h.x, h.y, 1, 1, '#ff8fb1'); px(h.x + 2, h.y, 1, 1, '#ff8fb1'); px(h.x, h.y + 1, 3, 1, '#ff8fb1'); px(h.x + 1, h.y + 2, 1, 1, '#ff8fb1'); p.globalAlpha = 1; }

  // shelf, jars and a trailing plant; the chalkboard menu
  px(84, 30, 72, 2, '#5a3826');
  const jars = [['#c8796b', 6], ['#e6c06a', 5], ['#7aa3c4', 7], ['#9cc48a', 5], ['#d79ac0', 6], ['#e6c06a', 6]];
  let jx = 86; for (const [c, h] of jars) { px(jx, 30 - h, 6, h, c); px(jx + 1, 29 - h, 4, 1, '#3b2a22'); jx += 9; }
  px(145, 22, 6, 8, '#b8714f');
  for (let i = 0; i < 6; i++) px(146 + (i % 2) * 3 + Math.round(Math.sin(s.t + i) * 0.4), 32 + i * 3, 2, 2, '#4f9a58');
  px(96, 36, 54, 22, '#22302a'); px(95, 35, 56, 1, '#7a5a40'); px(95, 58, 56, 1, '#7a5a40');
  text('MENU', 115, 38, '#f2efe6');
  for (let row = 0; row < 3; row++) { px(100, 46 + row * 4, 20 + (row * 7) % 14, 1, '#cfd8cf'); px(140, 46 + row * 4, 6, 1, '#f2c14e'); }

  // pendant lamps and their warm cones
  for (const lx of [30, 80, 130]) {
    const sw = Math.round(Math.sin(s.t * 0.6 + lx) * 0.6);
    px(lx + sw, 6, 1, 8, '#1a1218');
    p.globalAlpha = 0.12; px(lx - 9 + sw, 17, 19, 8, '#ffcf87'); px(lx - 14 + sw, 25, 29, 12, '#ffcf87'); p.globalAlpha = 1;
    px(lx - 4 + sw, 13, 9, 3, '#2c3e3a'); px(lx - 5 + sw, 15, 11, 1, '#2c3e3a'); px(lx - 1 + sw, 16, 3, 1, '#ffe7b0');
  }

  // a fellow guest by the far wall, lit by a laptop
  px(77, 80, 10, 2, '#5a3826'); px(80, 82, 1, 14, '#3b2a22');
  px(79, 70, 5, 5, '#d8a07a'); px(78, 69, 7, 2, '#3b2a22'); px(78, 75, 7, 7, '#6d8f6b');
  px(85, 76, 6, 4, '#c9d3dc'); p.globalAlpha = 0.2 + Math.sin(s.t * 0.8) * 0.05; px(80, 72, 10, 8, '#bfe3ff'); p.globalAlpha = 1;

  // the counter: pastry case, espresso machine, the barista behind
  const b = s.barista, bx = Math.round(b.x);
  px(bx - 3, 58, 7, 6, '#d8a07a'); px(bx - 4, 56, 9, 3, '#4a2f25'); px(bx - 1, 60, 1, 1, '#3b2a22'); px(bx + 2, 60, 1, 1, '#3b2a22');
  px(bx - 5, 64, 11, 14, '#f2efe6'); px(bx - 4, 66, 9, 12, '#3d6b5c');
  if (s.refill > 0 && s.refill < 1.4) px(bx + 5, 66, 3, 3, '#f2efe6');
  px(88, 78, 72, 4, '#8a5a3c'); px(88, 82, 72, 26, '#6b4430');
  for (let x = 90; x < 160; x += 6) px(x, 84, 1, 22, '#5a3826');
  px(92, 68, 22, 10, '#a9c7d6'); p.globalAlpha = 0.4; px(93, 69, 20, 2, '#ffffff'); p.globalAlpha = 1;
  for (const [cx, c] of [[95, '#e2a65c'], [101, '#c8796b'], [107, '#f2d38b']]) px(cx, 74, 4, 3, c);
  px(124, 64, 18, 14, '#b9c0c8'); px(126, 66, 14, 4, '#8e979f'); px(130, 71, 2, 3, '#3a3a3a'); px(136, 71, 2, 3, '#3a3a3a');
  px(127, 66, 2, 2, Math.sin(s.t * 3) > 0 ? '#ff5a4a' : '#7a2a24');
  for (const st of s.steam) { p.globalAlpha = st.l * 0.6; px(st.x, st.y, 2, 2, '#ffffff'); p.globalAlpha = 1; }

  // your table: the latte, an open book, a candle
  px(0, 120, G, 40, '#7a4e33'); px(0, 120, G, 2, '#9a6844');
  for (let y = 126; y < G; y += 7) px(0, y, G, 1, '#6e452d');
  px(36, 136, 34, 6, '#e8e1d6'); px(38, 142, 30, 2, '#cfc6b8');   // saucer
  px(42, 124, 22, 14, '#f4efe6'); px(64, 127, 4, 7, '#f4efe6'); px(65, 128, 2, 5, '#7a4e33');
  const level = Math.max(0, s.cup);
  px(44, 124, 18, 3, level > 0.05 ? '#c9935f' : '#e8e1d6');
  if (level > 0.3) { px(51, 124, 2, 1, '#fff3e0'); px(53, 124, 2, 1, '#fff3e0'); px(52, 125, 2, 1, '#fff3e0'); }
  if (level > 0.05) for (let i = 0; i < 3; i++) { const sy = 120 - ((s.t * 6 + i * 4) % 12); p.globalAlpha = 0.5 * (1 - (120 - sy) / 12) * level; px(48 + i * 4 + Math.round(Math.sin(s.t * 2 + i) * 1), sy, 1, 2, '#ffffff'); p.globalAlpha = 1; }
  px(84, 132, 44, 20, '#f2ead8'); px(105, 132, 2, 20, '#cfc2a8');
  for (let i = 0; i < 4; i++) { px(88, 136 + i * 4, 14, 1, '#b9ad94'); px(110, 136 + i * 4, 14, 1, '#b9ad94'); }
  px(138, 126, 8, 10, '#d9c9a8'); p.globalAlpha = 0.6; px(138, 126, 8, 10, '#ffe2a8'); p.globalAlpha = 1;
  const fl = Math.round(Math.sin(s.t * 9) * 0.6);
  px(141 + fl, 121, 2, 4, '#ffb347'); px(141, 123, 2, 2, '#fff1c8');
  p.globalAlpha = 0.16 + Math.sin(s.t * 9) * 0.03; px(132, 114, 20, 18, '#ffcf87'); p.globalAlpha = 1;
}

export function preview(ctx) {
  const s = makeState(); s.t = 3;
  draw(ctx, s);
}

const buf = {};
function draw(ctx, s) {
  if (!buf.cv) { buf.cv = document.createElement('canvas'); buf.cv.width = G; buf.cv.height = G; }
  const p = buf.cv.getContext('2d');
  p.clearRect(0, 0, G, G);
  scene(p, s);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf.cv, 0, 0, SIZE, SIZE);
  ctx.restore();
}

export function start(canvas, { setScore, isPaused }) {
  const ctx = setupCanvas(canvas);
  const s = makeState();
  const status = () => setScore(`${s.weather === 'rain' ? 'Rain on the window' : s.weather === 'snow' ? 'Snow outside' : 'A clear evening'} · latte ${Math.round(Math.max(0, s.cup) * 100)}%`);
  setScore('Click the cup, the window, the sign or the cat…');
  const hint = setTimeout(status, 6000);   // cleared on stop, so it never writes over the next scene
  const amb = playAmbience({ rain: 0.8, murmur: 1 }, isPaused);
  const stopMusic = playMusic(BOSSA, isPaused);

  const onDown = (e) => {
    canvas.focus({ preventScroll: true });
    const q = pointIn(canvas, e), x = q.x / PX, y = q.y / PX;
    if (x >= 36 && x <= 70 && y >= 116 && y <= 146) {
      if (s.cup > 0.05) { s.cup = Math.max(0, s.cup - 0.25); drip(0.05, 500, 260); if (s.cup <= 0.05) { s.refill = 2.4; } }
    } else if (x >= 15 && x <= 40 && y >= 20 && y <= 36) { s.neon = (s.neon + 1) % NEON.length; tone(76, { dur: 0.5, vol: 0.04 }); }
    else if (x >= 6 && x <= 32 && y >= 84 && y <= 100) { for (let k = 0; k < 3; k++) s.hearts.push({ x: 12 + k * 4, y: 86, l: 1 + k * 0.2 }); tone(79, { dur: 0.8, vol: 0.035 }); }
    else if (x >= 6 && x <= 70 && y >= 18 && y <= 92) {
      s.weather = s.weather === 'rain' ? 'snow' : s.weather === 'snow' ? 'clear' : 'rain';
      amb.set('rain', s.weather === 'rain' ? 0.8 : 0);
      tone(s.weather === 'clear' ? 84 : 81, { dur: 1, vol: 0.035 });
    }
    status();
  };
  canvas.addEventListener('pointerdown', onDown);

  function update(dt) {
    s.t += dt;
    for (const d of s.rain) { d.y += d.v * dt; if (d.y > 90) { d.y = 18; d.x = 6 + Math.random() * 64; } }
    for (const f of s.flakes) { f.y += f.v * dt; if (f.y > 90) { f.y = 18; f.x = 6 + Math.random() * 64; } }
    for (const w of s.walkers) { w.x += w.v * w.dir * dt; if (w.x > 80) { w.x = -6; } if (w.x < -6) { w.x = 80; } }
    // the barista drifts between till and machine, and brings a fresh cup when yours is empty
    const b = s.barista;
    b.wait -= dt;
    if (b.wait <= 0) { b.goal = b.goal > 120 ? 104 : 132; b.wait = 3 + Math.random() * 4; }
    b.x += Math.sign(b.goal - b.x) * Math.min(Math.abs(b.goal - b.x), dt * 9);
    if (Math.abs(b.x - 132) < 2 && Math.random() < dt * 2) s.steam.push({ x: 128 + Math.random() * 8, y: 62, l: 1 });
    for (const st of s.steam) { st.y -= dt * 8; st.x += Math.sin(s.t * 3 + st.y) * dt * 3; st.l -= dt * 0.7; }
    s.steam = s.steam.filter((st) => st.l > 0);
    for (const h of s.hearts) { h.y -= dt * 6; h.l -= dt * 0.5; }
    s.hearts = s.hearts.filter((h) => h.l > 0);
    if (s.refill > 0) { s.refill -= dt; if (s.refill <= 0) { s.cup = 1; [72, 76, 79].forEach((m, i) => tone(m, { dur: 1.2, vol: 0.035, delay: i * 0.12 })); status(); } }
    draw(ctx, s);
  }
  const stop = runLoop(update, isPaused);
  return () => { clearTimeout(hint); stop(); stopMusic(); amb.stop(); canvas.removeEventListener('pointerdown', onDown); };
}
