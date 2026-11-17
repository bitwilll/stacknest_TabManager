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

/* ——— temple instruments: tanpura, sitar and tabla ———
   For the Temple lounge's raga. A score event with `inst` is played by one of these instead of
   the piano-ish voice:
     { inst: 'tanpura', midi, dur, vol?, cents? }   one drone string, plucked and left to ring
     { inst: 'sitar', midi, dur, vol?, slide?, glide?, chik? }   a melody stroke, damped after `dur`
         beats; `slide` starts it that many semitones away and glides in (meend) over `glide` beats;
         `chik` strikes the high drone strings (the note and its octave) instead
     { inst: 'tabla', stroke, vol?, midi? }   a bol: na/ta, tin, tun on the dayan (tuned to `midi`,
         Sa by default), ge/ghe on the bayan (its pitch bends up), ka/ke (a dry slap), and the
         two-handed dha (na + ge) and dhin (tin + ge)
   They sound in a small hall of their own (a generated reverb, warm rather than bright), and every
   stroke disconnects its nodes once it has rung out. */
let hall = null;
function hallBus() {
  if (hall) return hall;
  const sr = actx.sampleRate, n = Math.floor(sr * 3.4), pre = Math.floor(sr * 0.024);
  const ir = actx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      lp += (0.6 - 0.45 * Math.min(1, t / 2.4)) * (Math.random() * 2 - 1 - lp);   // the tail darkens as it fades
      d[i] = lp * Math.exp(-t / 0.5);
    }
  }
  const input = actx.createGain(); input.gain.value = 0.85;
  const warm = actx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 3200; warm.Q.value = 0.5;
  const verb = actx.createConvolver(); verb.buffer = ir;
  const wet = actx.createGain(); wet.gain.value = 0.32;
  input.connect(warm); warm.connect(actx.destination); warm.connect(verb); verb.connect(wet); wet.connect(actx.destination);
  const side = (pan) => { const p = actx.createStereoPanner(); p.pan.value = pan; p.connect(input); return p; };
  hall = { sitar: input, tabla: side(0.18), tanpura: side(-0.2) };
  return hall;
}
// disconnect a stroke's nodes once every one of its sources has ended
function letRing(sources, nodes) {
  let left = sources.length;
  const done = () => { if (--left === 0) for (const n of nodes) n.disconnect(); };
  for (const s of sources) s.onended = done;
}

function tanpura(ev, at, spb, out) {
  const f = hz(ev.midi), vol = ev.vol ?? 0.016, len = Math.max(2, (ev.dur ?? 6) * spb);
  const body = actx.createBiquadFilter(), buzz = actx.createBiquadFilter(), swell = actx.createGain(), env = actx.createGain();
  body.type = 'lowpass'; body.frequency.value = Math.min(1200, f * 5); body.Q.value = 0.7;
  // the jawari: a narrow band of upper partials that blooms after the pluck and drifts back down
  buzz.type = 'bandpass'; buzz.Q.value = 4.5;
  buzz.frequency.setValueAtTime(Math.min(1500, f * 6), at);
  buzz.frequency.exponentialRampToValueAtTime(Math.min(2400, f * 15), at + 1.6);
  buzz.frequency.exponentialRampToValueAtTime(Math.min(1800, f * 8), at + len);
  swell.gain.setValueAtTime(0.8, at);
  swell.gain.linearRampToValueAtTime(4.5, at + 1.4);
  swell.gain.linearRampToValueAtTime(2.4, at + len);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(vol, at + 0.04);
  env.gain.exponentialRampToValueAtTime(vol * 0.6, at + 0.6);
  env.gain.exponentialRampToValueAtTime(vol * 0.25, at + len * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, at + len);
  // the string, and a twin a few cents off that only feeds the buzz, so it shimmers
  const oscs = [0, 3].map((c) => {
    const o = actx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (ev.cents ?? 0) + c;
    if (!c) o.connect(body);
    o.connect(buzz);
    o.start(at); o.stop(at + len + 0.05);
    return o;
  });
  body.connect(env); buzz.connect(swell).connect(env); env.connect(out);
  letRing(oscs, [...oscs, body, buzz, swell, env]);
}

function sitar(ev, at, spb, out) {
  buffers();
  const f = hz(ev.midi), vol = ev.vol ?? 0.05, len = Math.max(0.3, (ev.dur ?? 1) * spb), end = at + len;
  const body = actx.createBiquadFilter(), zing = actx.createBiquadFilter(), zg = actx.createGain(), env = actx.createGain();
  body.type = 'lowpass'; body.Q.value = 1.5;     // a bright stroke that mellows as it rings
  body.frequency.setValueAtTime(Math.min(2600, f * 6), at);
  body.frequency.exponentialRampToValueAtTime(Math.max(650, f * 2.5), at + 0.35);
  body.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2), at + Math.max(0.6, len + 0.2));
  zing.type = 'bandpass'; zing.Q.value = 3.5;    // the bridge's buzz: a formant that sweeps down after the stroke
  zing.frequency.setValueAtTime(Math.min(1800, f * 5), at);
  zing.frequency.exponentialRampToValueAtTime(Math.min(1000, f * 2.5), at + 0.8);
  zg.gain.value = 1.2;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(vol, at + 0.005);
  env.gain.exponentialRampToValueAtTime(vol * 0.45, at + 0.25);
  env.gain.exponentialRampToValueAtTime(vol * 0.45 * Math.max(0.05, Math.exp(-(len - 0.25) / 1.5)), end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);   // the next stroke damps the string
  const srcs = (ev.chik ? [f, f * 2] : [f]).map((fr) => {
    const o = actx.createOscillator(); o.type = 'sawtooth';
    if (ev.slide && !ev.chik) {   // meend: start off the note and glide into it
      const from = fr * 2 ** (ev.slide / 12), glide = Math.max(0.1, (ev.glide ?? Math.min(0.45, (ev.dur ?? 1) * 0.4)) * spb);
      o.frequency.setValueAtTime(from, at);
      o.frequency.setValueAtTime(from, at + 0.05);
      o.frequency.exponentialRampToValueAtTime(fr, at + 0.05 + glide);
    } else o.frequency.setValueAtTime(fr, at);
    o.connect(body); o.connect(zing);
    o.start(at); o.stop(end + 0.2);
    return o;
  });
  body.connect(env); zing.connect(zg).connect(env); env.connect(out);
  const nodes = [...srcs, body, zing, zg, env];
  // the mizrab's little click
  const click = actx.createBufferSource(), cf = actx.createBiquadFilter(), cg = actx.createGain();
  click.buffer = noiseBuf; cf.type = 'bandpass'; cf.frequency.value = 1800; cf.Q.value = 1.2;
  cg.gain.setValueAtTime(0.0001, at); cg.gain.exponentialRampToValueAtTime(vol * 0.3, at + 0.002); cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  click.connect(cf).connect(cg).connect(out); click.start(at, Math.random() * 1.5); click.stop(at + 0.04);
  srcs.push(click); nodes.push(click, cf, cg);
  // the sympathetic strings: the note's octave and twelfth, a little out of tune with each other,
  // blooming just after the stroke and lingering once it is damped
  if (!ev.chik) {
    const sym = actx.createGain(), symEnd = end + 2.2;
    sym.gain.setValueAtTime(0.0001, at);
    sym.gain.exponentialRampToValueAtTime(vol * 0.1, at + 0.2);
    sym.gain.exponentialRampToValueAtTime(vol * 0.06, at + 0.9);
    sym.gain.exponentialRampToValueAtTime(0.0001, symEnd);
    for (const [m, c] of f < 520 ? [[2, 3], [2, -4], [3, 2]] : [[2, 3], [2, -4]]) {   // (no twelfth up high)
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; o.detune.value = c;
      o.connect(sym); o.start(at); o.stop(symEnd + 0.05);
      srcs.push(o); nodes.push(o);
    }
    sym.connect(out); nodes.push(sym);
  }
  letRing(srcs, nodes);
}

// the dayan's ringing strokes, as partials of its tuning: [multiple, level, ring (s)]
const DAYAN = {
  na: [[1, 1.25, 0.9], [2, 0.7, 0.6], [3, 0.42, 0.45], [4, 0.2, 0.3]],
  tin: [[1, 1.25, 1], [2, 0.38, 0.5], [3, 0.12, 0.3]],
  tun: [[1, 1.25, 1.6], [2, 0.22, 0.6]],
};
const BOLS = { na: ['na'], ta: ['na'], tin: ['tin'], tun: ['tun'], ge: ['ge'], ghe: ['ge'], ka: ['ka'], ke: ['ka'], dha: ['na', 'ge'], dhin: ['tin', 'ge'] };
function tabla(ev, at, spb, out) {
  buffers();
  const vol = ev.vol ?? 0.03, f = hz(ev.midi ?? 62), srcs = [], nodes = [];
  const env = (peak, atk, ring) => {
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + atk); g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    g.connect(out); nodes.push(g);
    return g;
  };
  const sine = (freq, peak, atk, ring) => {
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, at);
    o.connect(env(peak, atk, ring)); o.start(at); o.stop(at + ring + 0.05);
    srcs.push(o); nodes.push(o);
    return o;
  };
  const noise = (freq, q, peak, ring) => {
    const s = actx.createBufferSource(), b = actx.createBiquadFilter();
    s.buffer = noiseBuf; b.type = 'bandpass'; b.frequency.value = freq; b.Q.value = q;
    s.connect(b).connect(env(peak, 0.002, ring)); s.start(at, Math.random() * 1.5); s.stop(at + ring + 0.02);
    srcs.push(s); nodes.push(s, b);
  };
  for (const part of BOLS[ev.stroke] || []) {
    if (DAYAN[part]) {
      for (const [m, lvl, ring] of DAYAN[part]) sine(f * m * 1.02, vol * lvl, 0.003, ring).frequency.exponentialRampToValueAtTime(f * m, at + 0.03);
      noise(part === 'na' ? 2200 : 1700, 1.5, vol * (part === 'na' ? 0.4 : 0.22), 0.012);   // the finger's tap
    } else if (part === 'ge') {
      // the bayan: a round low note that bends up (to Pa) as the heel of the hand presses the skin
      const f0 = hz(40), up = 2 ** ((ev.bend ?? 5) / 12);
      for (const [m, lvl, ring] of [[1, 1.4, 1.1], [2, 0.35, 0.6], [3, 0.08, 0.35]]) {
        const o = sine(f0 * m, vol * lvl, 0.006, ring);
        o.frequency.setValueAtTime(f0 * m, at + 0.025);
        o.frequency.exponentialRampToValueAtTime(f0 * m * up, at + 0.35);
      }
    } else {
      // ka / ke: the flat hand on the bayan, dry and short
      noise(650, 0.9, vol * 1.1, 0.07);
      sine(170, vol * 0.5, 0.003, 0.05);
    }
  }
  if (srcs.length) letRing(srcs, nodes);
}
const INSTRUMENTS = { tanpura, sitar, tabla };

function voice(ev, at, spb) {
  const bus = musicBus();
  if (!bus) return;
  if (ev.drum) { drum(ev.drum, at, ev.vol ?? 0.05, bus); return; }
  if (INSTRUMENTS[ev.inst]) { const h = hallBus(); INSTRUMENTS[ev.inst](ev, at, spb, h[ev.inst]); return; }
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

// "Temple" — written for the Temple lounge: raga Yaman, an evening raga (S R G M# P D N, Sa on D),
// on a sitar over a tanpura drone. First a slow alap, the sitar alone finding the raga from Sa up
// to the high Sa and back; then a gentle gat in teentaal (16 beats) over a soft theka on the tabla
// (dha dhin dhin dha …) that ends in a tihai landing on sam; then a quiet coda that settles on Sa,
// so the loop comes round into the alap again. 160 beats at 64 bpm: two and a half minutes.
export const TEMPLE = (() => {
  const SA = 62;
  const SW = { S: 0, R: 2, G: 4, M: 6, P: 7, D: 9, N: 11 };   // Yaman's Ma is the raised (tivra) one
  const sw = (s) => SA + SW[s[0]] + (s.endsWith('.') ? -12 : s.endsWith("'") ? 12 : 0);
  const events = [];
  // a sitar line: [beat, swara, beats, slide in from this many semitones (meend), loudness];
  // swara '.' is the low octave, "'" the high one; '*' strikes the chikari (the high drone strings)
  const play = (t0, line, vol = 0.05) => {
    for (const [t, s, d = 0.5, slide = 0, v = 1] of line) {
      if (s === '*') { events.push({ t: t0 + t, inst: 'sitar', midi: SA + 12, dur: 0.4, vol: 0.012, chik: true }); continue; }
      const midi = sw(s);
      events.push({ t: t0 + t, inst: 'sitar', midi, dur: d, vol: vol * v * (midi > SA + 12 ? 0.85 : 1), slide });
    }
  };
  // the tanpura, round and round all the way through: Pa, Sa', Sa' (a hair sharp), low Sa
  for (let c = 0; c < 32; c++) {
    for (const [m, k, v, cents] of [[SA - 17, 0, 0.016, 0], [SA - 12, 1.2, 0.013, 0], [SA - 12, 2.4, 0.013, 3], [SA - 24, 3.6, 0.02, 0]]) {
      events.push({ t: c * 5 + k, inst: 'tanpura', midi: m, dur: 6.5, vol: v, cents });
    }
  }
  // alap: Sa and the low notes; N R G; up to Pa and down; up to the high Sa and back to Pa
  play(0, [
    [1, 'S', 3], [4.5, 'N.', 1, -2], [5.5, 'D.', 1.25], [6.75, 'N.', 0.75], [7.5, 'R', 0.75], [8.25, 'S', 3], [11.5, '*'],
    [12.5, 'N.', 0.75], [13.25, 'R', 0.75], [14, 'G', 2.5, -2], [16.5, 'R', 1, 2], [17.5, 'S', 3], [20.75, '*'],
    [21.5, 'N.', 0.5], [22, 'R', 0.5], [22.5, 'G', 1], [23.5, 'M', 0.75, -2], [24.25, 'P', 3], [27.25, 'M', 0.75], [28, 'G', 1.5, 2], [29.5, 'R', 0.75], [30.25, 'S', 2.5], [33, '*'],
    [33.75, 'G', 0.75], [34.5, 'M', 0.75], [35.25, 'D', 1.5, -2], [36.75, 'N', 1], [37.75, "S'", 2.5, -1], [40.25, 'N', 0.5], [40.75, 'D', 0.5], [41.25, 'P', 1.75], [43.25, '*'],
  ], 0.044);
  // gat: the mukhda (beats 12–16) leads every cycle into sam on Ga; six cycles from beat 48
  const MUKHDA = [[12, 'N.', 0.5], [12.5, 'R', 0.5], [13, 'G', 1], [14, 'R', 0.5], [14.5, 'G', 0.5], [15, 'M', 1, -2]];
  const CYCLES = [
    [[0, 'G', 1.5, 2], [1.5, 'R', 0.5], [2, 'G', 1], [3, '*'], [4, 'M', 0.5], [4.5, 'D', 0.5], [5, 'N', 1.5, -2], [6.5, 'D', 0.5], [7, 'P', 1.5], [8.5, '*'], [9, 'M', 0.5], [9.5, 'G', 0.5], [10, 'R', 0.75], [10.75, 'S', 1.25]],
    [[0, 'G', 1, 2], [1, 'M', 0.5], [1.5, 'D', 0.5], [2, 'N', 1], [3, "S'", 2, -1], [5, 'N', 0.5], [5.5, "R'", 0.5], [6, "S'", 1], [7, 'N', 0.5], [7.5, 'D', 0.5], [8, 'P', 2], [10, 'M', 0.5], [10.5, 'G', 0.5], [11, 'R', 1]],
    [[0, 'G', 1, 2], [1, '*'], [2, 'M', 0.5], [2.5, 'D', 0.5], [3, 'N', 0.5], [3.5, "S'", 1.5], [5, "R'", 0.5], [5.5, "G'", 1, -2], [6.5, "R'", 0.5], [7, "S'", 1.5], [8.5, 'N', 0.5], [9, 'D', 1, 2], [10, 'P', 2]],
    [[0, 'G', 1, 2], [1, 'P', 0.5], [1.5, 'M', 0.5], [2, 'G', 1], [3, 'M', 0.5], [3.5, 'D', 0.5], [4, 'N', 1], [5, "S'", 1.5], [6.5, 'N', 0.5], [7, 'D', 0.5], [7.5, 'P', 1], [8.5, 'M', 0.5], [9, 'G', 1, 2], [10, 'R', 0.5], [10.5, 'S', 1.5]],
    [[0, 'G', 1, 2], [1, 'R', 0.5], [1.5, 'G', 0.5], [2, 'M', 0.5], [2.5, 'D', 0.5], [3, 'N', 0.5], [3.5, 'D', 0.5], [4, 'P', 1],
      [5, 'M', 0.25], [5.25, 'D', 0.25], [5.5, 'N', 0.25], [5.75, "S'", 0.25], [6, "R'", 0.5], [6.5, "S'", 0.5], [7, 'N', 0.5], [7.5, 'D', 0.5], [8, 'P', 1.5], [9.5, 'M', 0.5], [10, 'G', 0.5], [10.5, 'R', 0.5], [11, 'S', 1]],
    [[0, 'G', 1.5, 2], [1.5, 'R', 0.5], [2, 'G', 1], [3, '*'], [4, 'M', 0.5], [4.5, 'D', 0.5], [5, 'N', 1.5, -2], [6.5, 'D', 0.5], [7, 'P', 1.5], [8.5, 'M', 0.5], [9, 'G', 1, 2], [10, 'R', 1],
      // tihai: G R S three times, the last Sa on sam
      [11, 'G', 0.5], [11.5, 'R', 0.5], [12, 'S', 1], [13, 'G', 0.5], [13.5, 'R', 0.5], [14, 'S', 1], [15, 'G', 0.5], [15.5, 'R', 0.5], [16, 'S', 3.5, 0, 1.1]],
  ];
  play(32, MUKHDA);
  CYCLES.forEach((line, c) => { play(48 + c * 16, line); if (c < CYCLES.length - 1) play(48 + c * 16, MUKHDA); });
  // the tabla's theka, soft, coming in on the first sam; the khali (beats 9–12) without the bayan
  const THEKA = ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'];
  const bol = (t, stroke, vol) => events.push({ t, inst: 'tabla', stroke, vol });
  for (let c = 0; c < CYCLES.length; c++) {
    const s0 = 48 + c * 16, soft = c === 0 ? 0.75 : 1, last = c === CYCLES.length - 1;
    THEKA.forEach((b, i) => {
      if (last && i > 10) return;                                // the tihai takes the end of the last cycle
      const nudge = (((i * 37 + c * 11) % 7) - 3) * 0.004;       // a touch of human timing
      bol(s0 + i + nudge, b, (i === 0 ? 0.036 : i === 8 ? 0.024 : 0.03) * soft);
    });
    if (last) continue;
    bol(s0 + 15.5, 'ge', 0.018 * soft);                          // a soft ghe leading back to sam
    if (c % 2) { bol(s0 + 7.5, 'ge', 0.014); bol(s0 + 11.5, 'ke', 0.012); }
  }
  // tihai: dha-ta-dha three times, the last dha on sam with the sitar's Sa
  for (const k of [139, 141, 143]) { bol(k, 'dha', 0.03); bol(k + 0.5, 'ta', 0.022); bol(k + 1, 'dha', k === 143 ? 0.036 : 0.028); }
  // coda: the sitar alone again, down into the low register and home to Sa
  play(144, [[3.75, '*'], [5, 'N.', 1, -2], [6, 'D.', 1], [7, 'P.', 2.5, 2], [10, 'D.', 0.75], [10.75, 'N.', 0.75], [11.5, 'R', 0.75], [12.25, 'S', 3.75]], 0.044);
  return { bpm: 64, length: 160, events };
})();


/* ——— lounge music ———
   The lounges ask for their music by kind ('room' | 'cafe' | 'temple') rather than by score. Each kind
   has a short playlist of recorded public-domain (CC0) lo-fi tracks shipped in audio/ (credits
   in audio/CREDITS.txt). It starts on a random track, plays the rest in turn, fades in and out
   with pause and the sound switch, and falls back to the synthesised loops above if a file is
   missing or the browser can't play it. Returns a stop function. */
// "Pages", written for the Reading Room: a slow piano waltz in D major (3/4, 64 bpm), the left
// hand a low note on one and a soft chord on two, the melody resting on the chord tones; the second
// half thins to a few high bell notes so the loop breathes. 32 bars, about a minute and a half.
export const READING = (() => {
  const G = [43, [59, 62, 66]], D = [38, [57, 61, 66]], Bm = [47, [57, 62, 66]], Em = [40, [59, 62, 67]];
  const Asus = [45, [62, 64, 67]], Fsm = [42, [57, 61, 64]], A = [45, [61, 64, 69]];
  const prog = [G, D, G, D, Bm, Em, G, Asus, D, Fsm, G, Em, Bm, G, Em, A];
  const events = [];
  for (let i = 0; i < 32; i++) {
    const [bass, chord] = prog[i % 16], t = i * 3;
    events.push({ t, midi: bass, dur: 2.6, vol: 0.07, sustain: 0.45 });
    for (const m of chord) events.push({ t: t + 1, midi: m, dur: 1.7, vol: 0.031, sustain: 0.35 });
  }
  const melody = [   // [bar, beat, midi, beats]
    [1, 1, 69, 1], [1, 2, 73, 1], [2, 0, 74, 2], [2, 2, 71, 1], [3, 0, 69, 3],
    [4, 0, 78, 2], [4, 2, 74, 1], [5, 0, 76, 1], [5, 1, 79, 1], [5, 2, 71, 1], [6, 0, 74, 3],
    [7, 0, 76, 2], [7, 2, 74, 1], [8, 0, 73, 3], [9, 1, 69, 1], [9, 2, 73, 1],
    [10, 0, 78, 2], [10, 2, 74, 1], [11, 0, 76, 1], [11, 1, 74, 1], [11, 2, 71, 1],
    [12, 0, 74, 2], [12, 2, 66, 1], [13, 0, 71, 3], [14, 0, 67, 1], [14, 1, 71, 1], [14, 2, 76, 1], [15, 0, 73, 2], [15, 2, 76, 1],
    [18, 0, 81, 3], [21, 1, 78, 2], [24, 0, 85, 3], [26, 1, 81, 2], [29, 0, 79, 3], [31, 1, 76, 2],
  ];
  for (const [bar, beat, midi, beats] of melody) events.push({ t: bar * 3 + beat, midi, dur: beats * 0.95, vol: bar >= 16 ? 0.05 : 0.077, attack: 0.02, sustain: bar >= 16 ? 0.5 : 0.32 });
  return { bpm: 64, length: 96, events };
})();

const LOUNGE_TRACKS = {
  room: ['audio/room-chill-lofi-loop.ogg', 'audio/room-softly.ogg'],
  cafe: ['audio/cafe-lofi-hip-hop-loop.ogg', 'audio/cafe-lofi-hip-hop.ogg'],
  temple: [],   // no recording yet, so the synthesised raga (TEMPLE) plays
  train: ['audio/room-chill-lofi-loop.ogg', 'audio/cafe-lofi-hip-hop-loop.ogg', 'audio/room-softly.ogg', 'audio/cafe-lofi-hip-hop.ogg'],   // all four lo-fi tracks, for a long ride
  garden: [],    // the koto-style SUMI
  reading: [],   // the piano waltz READING
};
// the synthesised score for a lounge with no recordings (or when a file can't play)
const LOUNGE_SCORES = { cafe: () => BOSSA, temple: () => TEMPLE, garden: () => SUMI, reading: () => READING };
const TRACK_VOL = 0.5;

export function playLoungeMusic(kind, isPaused) {
  const list = LOUNGE_TRACKS[kind] || [];
  const synth = () => playMusic(LOUNGE_SCORES[kind]?.() || LOFI, isPaused);
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
