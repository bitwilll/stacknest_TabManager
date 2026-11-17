// Shared bits for the Zen arcade's games: a fixed 640×640 drawing space on a crisp canvas, a
// frame loop that pauses itself, pointer coordinates in that space, and soft synthesised notes
// on a pentatonic scale (nothing to download, nothing that can sound wrong together).

export const SIZE = 640;
const SOUND_KEY = 'stacknest:arcade-sound';

// The backing store follows the size the canvas is actually shown at × the screen's pixel
// ratio (up to 2.5×), so every game is drawn sharp rather than stretched; it re-fits itself
// when the frame changes size. Games draw in a 640×640 space. A `wide` canvas (the lounges)
// keeps the 640 height but takes the width of the box it is shown in — square in the frame,
// the whole screen's shape in full screen — and publishes it as canvas._snW (read it every
// frame: it changes when the player goes full screen or the window is resized).
export function setupCanvas(canvas, { wide = false } = {}) {
  const ctx = canvas.getContext('2d');
  canvas._snWide = wide;
  const fit = () => {
    const dpr = globalThis.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    // hidden (the arcade page put away): keep the size it has rather than shrink to a default
    if ((!r.width || !r.height) && canvas._snFitted) return;
    const shownH = r.height || SIZE, shownW = r.width || SIZE;
    const aspect = wide && shownH > 0 ? Math.max(1, shownW / shownH) : 1;
    const scale = Math.min(2.5, Math.max(1, ((wide ? shownH : shownW) * dpr) / SIZE));
    const ph = Math.round(SIZE * scale), pw = Math.round(SIZE * aspect * scale);
    if (canvas.width !== pw || canvas.height !== ph) {
      // resizing clears the bitmap; carry the picture over, so a paused game (under the end
      // card, say) keeps showing it until the next frame is drawn
      let prev = null;
      if (canvas._snFitted && canvas.width && canvas.height) {
        prev = document.createElement('canvas');
        prev.width = canvas.width; prev.height = canvas.height;
        prev.getContext('2d').drawImage(canvas, 0, 0);
      }
      canvas.width = pw; canvas.height = ph;
      if (prev) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(prev, 0, 0, pw, ph); }
    }
    canvas._snFitted = true;
    canvas._snW = SIZE * aspect;
    ctx.setTransform(ph / SIZE, 0, 0, ph / SIZE, 0, 0);
  };
  fit();
  canvas._snFit = fit;
  if (!canvas._snObserver && 'ResizeObserver' in globalThis) {
    canvas._snObserver = new ResizeObserver(() => canvas._snFit?.());
    canvas._snObserver.observe(canvas);
  }
  return ctx;
}

// step(dt) runs every frame unless paused; dt is in seconds, capped so a stall never teleports
export function runLoop(step, isPaused) {
  let raf = 0, last = performance.now(), live = true;
  const frame = (t) => {
    if (!live) return;
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (!isPaused()) step(dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { live = false; cancelAnimationFrame(raf); };
}

// a pointer event in the canvas's own drawing space (x runs to canvas._snW on a wide canvas)
export function pointIn(canvas, e) {
  const r = canvas.getBoundingClientRect();
  const w = canvas._snW || SIZE;
  return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * SIZE };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function mix(c1, c2, t) {   // '#rrggbb' colours
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
}

/* ——— sound ——— */
const PENTA = [0, 2, 4, 7, 9];
let actx = null;
export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } };
export const setSound = (on) => { try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* session only */ } };

// step: a degree on the pentatonic scale from A3 (0) upward
export function note(step, opts = {}) {
  const oct = Math.floor(step / PENTA.length), deg = ((step % PENTA.length) + PENTA.length) % PENTA.length;
  tone(57 + oct * 12 + PENTA[deg], opts);
}

// one soft note at a MIDI pitch (60 = middle C), with a little bell-like overtone
export function tone(midi, { dur = 0.9, vol = 0.09, type = 'sine', delay = 0 } = {}) {
  if (!soundOn()) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  actx = actx || new AC();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  const f = 440 * 2 ** ((midi - 69) / 12);
  const t = actx.currentTime + 0.01 + delay;
  for (const [mult, lvl] of [[1, 1], [2, 0.12]]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * lvl, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

// rounded text with a soft shadow, for the in-canvas title cards
export function card(ctx, lines, { y = SIZE / 2, color = '#fff', shadow = 'rgba(0,0,0,.35)' } = {}) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 18;
  let yy = y - ((lines.length - 1) * 34) / 2;
  for (const l of lines) {
    ctx.font = `${l.weight || 600} ${l.size || 22}px ${getComputedStyle(document.documentElement).getPropertyValue('--grot') || 'system-ui'}`;
    ctx.fillStyle = l.color || color;
    ctx.globalAlpha = l.alpha ?? 1;
    ctx.fillText(l.text, SIZE / 2, yy);
    yy += l.gap || 38;
  }
  ctx.restore();
}

/* ——— background music ———
   Public-domain pieces, arranged here as plain note lists and played on a soft synthesised
   piano-ish voice through a gentle echo: no recording is shipped. A score is
   { bpm, length (beats), events: [{ t, midi, dur, vol?, type? }] } and loops for as long as
   the game runs; it pauses with the game and follows the arcade's sound switch. */
let echo = null;
function musicBus() {
  if (echo) return echo;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  actx = actx || new AC();
  const input = actx.createGain(); input.gain.value = 0.55;
  const delay = actx.createDelay(1); delay.delayTime.value = 0.32;
  const fb = actx.createGain(); fb.gain.value = 0.28;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  input.connect(actx.destination);
  input.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(actx.destination);
  echo = input;
  return echo;
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
// soft drums for the loops: a round kick, a brushed snare, a closed hat (filtered noise)
function drum(kind, at, vol, bus) {
  buffers();
  if (kind === 'kick') {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    o.connect(g).connect(bus); o.start(at); o.stop(at + 0.35);
    return;
  }
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(), g = actx.createGain();
  if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.6; } else { f.type = 'highpass'; f.frequency.value = 7200; }
  const len = kind === 'snare' ? 0.2 : kind === 'shaker' ? 0.07 : 0.045;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g).connect(bus); src.start(at, Math.random() * 1.5); src.stop(at + len + 0.02);
}

function voice(ev, at, spb) {
  const bus = musicBus();
  if (!bus) return;
  if (ev.drum) { drum(ev.drum, at, ev.vol ?? 0.05, bus); return; }
  const dur = Math.max(0.2, ev.dur * spb * 1.6);
  const vol = (ev.vol ?? 0.06);
  for (const [mult, lvl, type] of [[1, 1, ev.type || 'triangle'], [2, 0.18, 'sine'], [3, 0.05, 'sine']]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = hz(ev.midi) * mult;
    const atk = ev.attack ?? 0.015;   // a slow attack reads as breath (a flute), a fast one as a pluck
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * lvl, at + atk);
    g.gain.exponentialRampToValueAtTime(vol * lvl * (ev.sustain ?? 0.35), at + Math.max(atk + 0.05, Math.min(0.5, dur * 0.4)));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(bus);
    o.start(at); o.stop(at + dur + 0.05);
  }
}

export function playMusic(score, isPaused) {
  const bus = musicBus();
  if (!bus) return () => {};
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  const events = [...score.events].sort((a, b) => a.t - b.t);
  const spb = 60 / score.bpm;
  let idx = 0, loops = 0, anchor = null;
  const nextBeat = () => events[idx].t + loops * score.length;
  const timer = setInterval(() => {
    if (isPaused() || !soundOn()) { anchor = null; return; }
    if (anchor === null) anchor = actx.currentTime + 0.15 - nextBeat() * spb;
    const horizon = actx.currentTime + 0.6;
    for (;;) {
      const at = anchor + nextBeat() * spb;
      if (at > horizon) break;
      if (at >= actx.currentTime - 0.05) voice(events[idx], Math.max(at, actx.currentTime), spb);
      idx += 1;
      if (idx >= events.length) { idx = 0; loops += 1; }
    }
  }, 120);
  return () => clearInterval(timer);
}

// J. S. Bach, Prelude in C major, BWV 846 (1722): each bar one chord, broken in the
// famous figure: the two low notes held, the upper three rippling twice.
const PRELUDE_BARS = [
  [60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76],
  [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72],
  [57, 60, 64, 67, 72], [50, 57, 62, 66, 72], [55, 59, 62, 67, 71], [55, 58, 64, 67, 73],
  [53, 57, 62, 69, 74], [53, 56, 62, 65, 71], [52, 55, 60, 67, 72], [52, 53, 57, 60, 65],
  [50, 53, 57, 60, 65], [43, 50, 55, 59, 65], [48, 52, 55, 60, 64], [48, 52, 55, 60, 64],
];
export const PRELUDE = (() => {
  const events = [];
  PRELUDE_BARS.forEach((ch, b) => {
    for (const half of [0, 2]) {
      const t0 = b * 4 + half;
      events.push({ t: t0, midi: ch[0], dur: 2, vol: 0.05 });
      events.push({ t: t0 + 0.25, midi: ch[1], dur: 1.75, vol: 0.045 });
      [2, 3, 4, 2, 3, 4].forEach((k, j) => events.push({ t: t0 + 0.5 + j * 0.25, midi: ch[k], dur: 0.5, vol: 0.04 }));
    }
  });
  return { bpm: 58, length: PRELUDE_BARS.length * 4, events };
})();

// Johann Pachelbel, Canon in D (c. 1700): the ground bass under its eight chords, a broken
// chord in the middle, and the canon's opening violin line above.
export const CANON = (() => {
  const bass = [38, 33, 35, 30, 31, 26, 31, 33];                                // D A B F# G D G A
  const chords = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [54, 57, 61], [55, 59, 62], [50, 54, 57], [55, 59, 62], [57, 61, 64]];
  const lines = [[78, 76, 74, 73, 71, 69, 71, 73], [74, 73, 71, 69, 67, 66, 67, 64], [74, 78, 81, 79, 78, 74, 78, 76], [74, 71, 74, 73, 71, 69, 67, 69]];
  const events = [];
  lines.forEach((line, round) => {
    for (let i = 0; i < 8; i++) {
      const t0 = round * 16 + i * 2;
      events.push({ t: t0, midi: bass[i], dur: 2, vol: 0.06, type: 'sine' });
      const c = chords[i];
      [c[0], c[1], c[2], c[1]].forEach((m, j) => events.push({ t: t0 + j * 0.5, midi: m, dur: 0.6, vol: 0.026 }));
      events.push({ t: t0, midi: line[i], dur: 2, vol: 0.045, type: 'sine' });
    }
  });
  return { bpm: 62, length: 64, events };
})();

/* ——— ambience: rain, vinyl crackle, café murmur ———
   Made from noise buffers and filters, so there is nothing to download. Returns a controller:
   set(layer, level) to change one layer (0 = silent), stop() to end it. Like the music, it
   falls silent while the scene is paused or the arcade's sound is off. */
let noiseBuf = null, brownBuf = null, crackBuf = null;
function buffers() {
  if (noiseBuf) return;
  const n = actx.sampleRate * 2;
  noiseBuf = actx.createBuffer(1, n, actx.sampleRate);
  brownBuf = actx.createBuffer(1, n, actx.sampleRate);
  crackBuf = actx.createBuffer(1, n, actx.sampleRate);
  const w = noiseBuf.getChannelData(0), b = brownBuf.getChannelData(0), c = crackBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    w[i] = Math.random() * 2 - 1;
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5;
    c[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6) : 0;
  }
}
// the rain sits well under the music: a fifth of where it first was, which had it drowning the room
const RAIN_GAIN = 0.014;
export function playAmbience(levels, isPaused) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return { set() {}, stop() {} };
  actx = actx || new AC();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  buffers();
  const master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination);
  const make = (buf, filters, level) => {
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = actx.createGain(); g.gain.value = level;
    let node = src;
    for (const [type, freq, q] of filters) { const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; node.connect(f); node = f; }
    node.connect(g).connect(master);
    src.start();
    return { src, g };
  };
  const layers = {
    rain: make(noiseBuf, [['highpass', 500], ['lowpass', 5200]], (levels.rain ?? 0) * RAIN_GAIN),
    crackle: make(crackBuf, [['highpass', 1200], ['lowpass', 7000]], (levels.crackle ?? 0) * 0.35),
    murmur: make(brownBuf, [['lowpass', 650], ['peaking', 300, 0.8]], (levels.murmur ?? 0) * 0.16),
  };
  // the café murmur rises and falls a little, like a room of quiet conversations
  const lfo = actx.createOscillator(), depth = actx.createGain();
  lfo.frequency.value = 0.11; depth.gain.value = (levels.murmur ?? 0) * 0.05;
  lfo.connect(depth).connect(layers.murmur.g.gain); lfo.start();
  const scale = { rain: RAIN_GAIN, crackle: 0.35, murmur: 0.16 };
  const timer = setInterval(() => {
    const on = !isPaused() && soundOn();
    master.gain.setTargetAtTime(on ? 1 : 0, actx.currentTime, 0.4);
  }, 200);
  return {
    set(layer, level) { layers[layer]?.g.gain.setTargetAtTime(level * scale[layer], actx.currentTime, 0.6); },
    stop() {
      clearInterval(timer);
      master.gain.setTargetAtTime(0, actx.currentTime, 0.15);
      setTimeout(() => { for (const l of Object.values(layers)) { try { l.src.stop(); } catch { /* already */ } } try { lfo.stop(); } catch { /* already */ } master.disconnect(); }, 600);
    },
  };
}

// a lo-fi loop for the Night Room: warm ninth chords on an electric-piano-ish voice, a round
// bass, a few notes wandering over the top, and a lazy boom-bap with swung hats (an everyday
// progression, arranged here)
export const LOFI = (() => {
  const chords = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 66], [50, 53, 57, 60, 64], [43, 53, 57, 59, 64]];   // Fmaj9 Em9 Dm9 G13sus
  const roots = [41, 40, 38, 43];
  const tune = [[76, 1.5], [74, 2.5], [72, 3], [69, 1], [72, 2.5], [67, 1.5], [69, 3], [64, 2]];
  const events = [];
  for (let rep = 0; rep < 2; rep++) {
    chords.forEach((ch, b) => {
      const t0 = rep * 16 + b * 4;
      ch.forEach((m, k) => events.push({ t: t0 + k * 0.035, midi: m, dur: 3.3, vol: 0.024, type: 'sine', attack: 0.03, sustain: 0.5 }));
      events.push({ t: t0 + 2.75, midi: ch[2], dur: 0.8, vol: 0.016, type: 'sine' });
      events.push({ t: t0, midi: roots[b] - 12, dur: 1.6, vol: 0.06, type: 'sine', sustain: 0.6 });
      events.push({ t: t0 + 2.5, midi: roots[b] - 5, dur: 1.2, vol: 0.045, type: 'sine', sustain: 0.6 });
      const [m, at] = tune[(b + rep * 4) % tune.length];
      if ((b + rep) % 2 === 0) events.push({ t: t0 + at, midi: m, dur: 1.4, vol: 0.026, type: 'triangle', attack: 0.02 });
      // drums: kick on 1 and the "and" of 3, brushed snare on 2 and 4, swung hats
      for (const k of [0, 2.5]) events.push({ t: t0 + k, drum: 'kick', vol: 0.11 });
      if (b % 2 === 1) events.push({ t: t0 + 3.75, drum: 'kick', vol: 0.06 });
      for (const k of [1, 3]) events.push({ t: t0 + k, drum: 'snare', vol: 0.035 });
      for (let h = 0; h < 8; h++) events.push({ t: t0 + h * 0.5 + (h % 2 ? 0.09 : 0), drum: 'hat', vol: h % 2 ? 0.012 : 0.02 });
    });
  }
  return { bpm: 74, length: 32, events };
})();

// a gentle bossa for the Pixel Café: Dm9 · G13 · Cmaj9 · A7sus, comped lightly
export const BOSSA = (() => {
  const chords = [[50, 53, 60, 64], [43, 53, 59, 64], [48, 52, 59, 62], [45, 55, 62, 64]];
  const bass = [[38, 45], [31, 38], [36, 43], [33, 40]];
  const tune = [[72, 0], [74, 1.5], [76, 2.5], [74, 0.5], [71, 2], [72, 1], [67, 2.5], [69, 0]];
  const events = [];
  for (let rep = 0; rep < 2; rep++) {
    chords.forEach((ch, b) => {
      const t0 = rep * 16 + b * 4;
      for (const hit of [0, 1.5, 2.5, 3.5]) ch.slice(1).forEach((m, k) => events.push({ t: t0 + hit + k * 0.02, midi: m, dur: hit === 0 ? 1.2 : 0.6, vol: 0.022, type: 'sine' }));
      events.push({ t: t0, midi: bass[b][0], dur: 1.4, vol: 0.06, type: 'sine' });
      events.push({ t: t0 + 2, midi: bass[b][1], dur: 1.4, vol: 0.05, type: 'sine' });
      const [m, at] = tune[(b + rep * 4) % tune.length];
      events.push({ t: t0 + at, midi: m, dur: 1.6, vol: 0.03, type: 'triangle' });
      // a soft shaker on the eighths and a rim click on the bossa's off-beat pattern
      for (let h = 0; h < 8; h++) events.push({ t: t0 + h * 0.5, drum: 'shaker', vol: h % 2 ? 0.014 : 0.009 });
      for (const k of [0, 1.5, 3]) events.push({ t: t0 + k, drum: 'hat', vol: 0.016 });
      events.push({ t: t0, drum: 'kick', vol: 0.05 });
    });
  }
  return { bpm: 76, length: 32, events };
})();


/* ——— little foley ——— */
function ensureCtx() {
  if (!soundOn()) return null;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  actx = actx || new AC();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  buffers();
  return actx;
}
// a brush dragged over paper: a short breath of filtered noise
export function swish(vol = 0.05) {
  const c = ensureCtx(); if (!c) return;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
  const g = c.createGain(); const t = c.currentTime;
  f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.22);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random()); src.stop(t + 0.3);
}
// distant thunder: a soft crack, then a long low roll that swells and dies away
export function rumble(vol = 0.2, dur = 3.2) {
  const c = ensureCtx(); if (!c) return;
  const t = c.currentTime;
  const roll = c.createBufferSource(); roll.buffer = brownBuf; roll.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(320, t); lp.frequency.exponentialRampToValueAtTime(90, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
  g.gain.exponentialRampToValueAtTime(vol * 0.45, t + 0.7);
  g.gain.exponentialRampToValueAtTime(vol * 0.7, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  roll.connect(lp).connect(g).connect(c.destination);
  roll.start(t, Math.random() * 2); roll.stop(t + dur + 0.1);
  const crack = c.createBufferSource(); crack.buffer = noiseBuf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  const cg = c.createGain();
  cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.02); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  crack.connect(bp).connect(cg).connect(c.destination); crack.start(t, Math.random()); crack.stop(t + 0.45);
}
// a drop of ink (or water) landing: a quick falling tone
export function drip(vol = 0.08, from = 1300, to = 380) {
  const c = ensureCtx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + 0.11);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.25);
}
// a pebble into water: the plunk and a little spray
export function splash(vol = 0.08) {
  const c = ensureCtx(); if (!c) return;
  drip(vol, 520, 140);
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
  const g = c.createGain(), t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(f).connect(g).connect(c.destination); src.start(t, Math.random()); src.stop(t + 0.4);
}

// "Sumi" — written for Brush Stroke: a low drone, koto-like plucks on the yo scale (D E G A B)
// and a breathy flute line that comes and goes
export const SUMI = (() => {
  const events = [
    { t: 0, midi: 38, dur: 15.5, vol: 0.03, type: 'sine', attack: 1.2, sustain: 0.8 },
    { t: 0, midi: 45, dur: 15.5, vol: 0.02, type: 'sine', attack: 1.6, sustain: 0.8 },
    { t: 16, midi: 38, dur: 15.5, vol: 0.03, type: 'sine', attack: 1.2, sustain: 0.8 },
    { t: 16, midi: 43, dur: 15.5, vol: 0.02, type: 'sine', attack: 1.6, sustain: 0.8 },
  ];
  const plucks = [[62, 64, 67, 69], [69, 67, 64, 62], [64, 67, 71, 74], [74, 71, 69, 67], [62, 67, 69, 74], [71, 69, 67, 64], [67, 69, 71, 74], [69, 64, 62, 57]];
  plucks.forEach((p, i) => p.forEach((m, k) => events.push({ t: i * 4 + [0, 0.5, 1, 1.75][k], midi: m, dur: 1.1, vol: 0.035, type: 'triangle', sustain: 0.2 })));
  for (const [m, t, d] of [[74, 4, 3], [76, 8, 2], [79, 10.5, 4], [76, 18, 2], [74, 20.5, 3.5], [71, 26, 4]]) {
    events.push({ t, midi: m, dur: d, vol: 0.03, type: 'sine', attack: 0.45, sustain: 0.75 });
  }
  return { bpm: 54, length: 32, events };
})();


/* ——— lounge music ———
   The lounges ask for their music by kind ('room' | 'cafe') rather than by score. Each kind
   has a short playlist of recorded public-domain (CC0) lo-fi tracks shipped in audio/ (credits
   in audio/CREDITS.txt). It starts on a random track, plays the rest in turn, fades in and out
   with pause and the sound switch, and falls back to the synthesised loops above if a file is
   missing or the browser can't play it. Returns a stop function. */
const LOUNGE_TRACKS = {
  room: ['audio/room-chill-lofi-loop.ogg', 'audio/room-softly.ogg'],
  cafe: ['audio/cafe-lofi-hip-hop-loop.ogg', 'audio/cafe-lofi-hip-hop.ogg'],
};
const TRACK_VOL = 0.5;

export function playLoungeMusic(kind, isPaused) {
  const list = LOUNGE_TRACKS[kind] || [];
  const synth = () => playMusic(kind === 'cafe' ? BOSSA : LOFI, isPaused);
  if (!list.length || typeof Audio === 'undefined') return synth();

  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0;
  let i = Math.floor(Math.random() * list.length), failed = 0, fallback = null, stopped = false;
  const load = () => { audio.src = list[i]; audio.load(); };
  audio.addEventListener('ended', () => { i = (i + 1) % list.length; load(); });
  audio.addEventListener('error', () => {
    if (stopped || fallback) return;
    failed += 1;
    if (failed >= list.length) { audio.removeAttribute('src'); audio.load(); fallback = synth(); return; }
    i = (i + 1) % list.length; load();
  });
  load();

  // a gentle fade toward wherever the music should be, a step every 100 ms
  const timer = setInterval(() => {
    if (fallback) return;
    const want = !isPaused() && soundOn();
    const target = want ? TRACK_VOL : 0;
    audio.volume = Math.max(0, Math.min(1, audio.volume + Math.sign(target - audio.volume) * Math.min(0.04, Math.abs(target - audio.volume))));
    if (want && audio.paused) audio.play().catch(() => { /* waits for the next tick */ });
    else if (!want && !audio.paused && audio.volume === 0) audio.pause();
  }, 100);

  return () => {
    stopped = true;
    clearInterval(timer);
    if (fallback) { fallback(); return; }
    const fade = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.08);
      if (audio.volume === 0) { clearInterval(fade); audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }, 40);
  };
}
