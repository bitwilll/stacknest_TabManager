// A meditation timer for the Temple lounge. Pick a length (and, if you like, a gong every five
// minutes), press Start, and sit: one soft gong opens the sit, three close it. Every gong of the
// sit is scheduled on the audio clock the moment it starts, so the closing gongs ring on time even
// if the tab is hidden; pausing or ending cancels them. The lounge keeps playing around it, and
// the arcade's sound switch is respected (with sound off the sit simply ends quietly). The last
// choice and today's minutes are remembered on this device.

import { el, icon } from './ui.js';
import { soundOn } from './arcade-kit.js';

const PREF_KEY = 'stacknest:meditate';        // { mins, every } (localStorage)
const LOG_KEY = 'stacknest:meditate-today';   // { day: 'YYYY-MM-DD', mins }
const LENGTHS = [3, 5, 10, 15, 20, 30];
const EVERY = 5;                              // minutes between interval gongs, when on

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* this session only */ } };
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayMins = () => { const l = read(LOG_KEY, null); return l?.day === dayKey() ? l.mins : 0; };
const logMins = (m) => { if (m > 0) write(LOG_KEY, { day: dayKey(), mins: todayMins() + m }); };
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ——— the gong ———
   A bronze gong is a cluster of inharmonic partials, each a pair of slightly detuned tones (the
   slow beating is the shimmer), opening with a soft mallet thump and dying away over about ten
   seconds with a faint downward settle in pitch. */
let actx = null;
function audio() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  actx = actx || new AC();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
const PARTIALS = [   // [ratio, level, seconds to fade]
  [1, 1, 10], [1.505, 0.5, 8], [2.0, 0.42, 7], [2.47, 0.3, 5.5], [3.03, 0.2, 4.5], [3.72, 0.12, 3.5], [4.41, 0.08, 2.8],
];
export function strike(c, at, { vol = 0.15, base = 104 } = {}) {   // also renders offline (tests, previews)
  const nodes = [];
  const out = c.createGain(); out.gain.value = vol;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
  out.connect(lp).connect(c.destination);
  nodes.push(out, lp);
  for (const [ratio, level, fade] of PARTIALS) {
    for (const detune of [-0.12, 0.12]) {
      const o = c.createOscillator(), g = c.createGain();
      const f = base * ratio + detune * ratio;
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.004, at);
      o.frequency.exponentialRampToValueAtTime(f, at + 1.8);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level * 0.5, at + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, at + fade);
      o.connect(g).connect(out);
      o.start(at); o.stop(at + fade + 0.1);
      nodes.push(o, g);
    }
  }
  // the mallet: a short, low, padded thump
  const len = Math.floor(c.sampleRate * 0.2), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const n = c.createBufferSource(); n.buffer = buf;
  const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 320;
  const ng = c.createGain(); ng.gain.value = 0.5;
  n.connect(nf).connect(ng).connect(out); n.start(at);
  nodes.push(n, nf, ng);
  return nodes;
}
// a single soft gong now (also used when a sit is ended early)
export function gong(vol = 0.15) {
  if (!soundOn()) return;
  const c = audio(); if (c) strike(c, c.currentTime + 0.02, { vol });
}

export function createMeditation() {
  const pref = read(PREF_KEY, { mins: 10, every: false });
  let mins = LENGTHS.includes(pref.mins) ? pref.mins : 10, every = !!pref.every;
  let available = false, running = false, paused = false;
  let total = 0, endAt = 0, left = 0, tick = 0, doneTimer = 0, scheduled = [];

  /* the bar button */
  const button = el('button', { class: 'arc-btn arc-med', type: 'button', hidden: '', title: 'Meditation timer', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    icon('gong', 14), el('span', { text: 'Meditate' }));

  /* the panel: length, interval gongs, start */
  const chips = el('div', { class: 'med-chips', role: 'radiogroup', 'aria-label': 'Length of the sit' });
  const paintChips = () => { for (const b of chips.children) { const on = Number(b.dataset.mins) === mins; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; } };
  for (const m of LENGTHS) {
    chips.append(el('button', { class: 'med-chip', type: 'button', role: 'radio', dataset: { mins: String(m) }, text: `${m} min`,
      onclick: () => { mins = m; paintChips(); write(PREF_KEY, { mins, every }); } }));
  }
  chips.addEventListener('keydown', (e) => {   // arrow keys move along the lengths, as radios do
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = (LENGTHS.indexOf(mins) + d + LENGTHS.length) % LENGTHS.length;
    mins = LENGTHS[i]; paintChips(); write(PREF_KEY, { mins, every });
    chips.children[i].focus();
  });
  const everyBox = el('input', { type: 'checkbox', class: 'med-every-box' });
  everyBox.addEventListener('change', () => { every = everyBox.checked; write(PREF_KEY, { mins, every }); });
  const today = el('p', { class: 'med-today' });
  const quiet = el('p', { class: 'med-quiet', text: 'Sound is off in the arcade, so the gongs will be silent.' });
  const startBtn = el('button', { class: 'med-start', type: 'button', onclick: () => start() }, icon('gong', 14), el('span', { text: 'Begin' }));
  const closeBtn = el('button', { class: 'med-x', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => close() }, icon('close', 13));
  const panel = el('div', { class: 'med-panel', role: 'dialog', 'aria-label': 'Meditation timer', hidden: '' },
    el('div', { class: 'med-head' }, el('span', { class: 'med-cap', text: 'meditation' }), closeBtn),
    el('h3', { class: 'med-h', text: 'Sit for a while' }),
    el('p', { class: 'med-sub', text: 'A soft gong begins the sit; three gongs end it.' }),
    chips,
    el('label', { class: 'med-every' }, everyBox, el('span', { text: `A gong every ${EVERY} minutes` })),
    quiet, startBtn, today);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });

  /* while sitting: a quiet ring and the time left; pause and end on hover or focus */
  const R = 26, C = 2 * Math.PI * R;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 64 64'); ring.setAttribute('class', 'med-ring'); ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = `<circle cx="32" cy="32" r="${R}" class="med-ring-track"/><circle cx="32" cy="32" r="${R}" class="med-ring-prog" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 32 32)"/>`;
  const prog = ring.querySelector('.med-ring-prog');
  const time = el('span', { class: 'med-time', role: 'timer', 'aria-label': 'Time left' });
  const label = el('span', { class: 'med-label', 'aria-live': 'polite' });
  const pauseBtn = el('button', { class: 'med-ctl', type: 'button', onclick: () => (paused ? resume() : pause()) });
  const endBtn = el('button', { class: 'med-ctl', type: 'button', title: 'End the sit', 'aria-label': 'End the sit', onclick: () => end({ early: true }) }, icon('close', 12));
  const hud = el('div', { class: 'med-hud', hidden: '' },
    el('div', { class: 'med-dial' }, ring, time), el('div', { class: 'med-side' }, label, el('div', { class: 'med-ctls' }, pauseBtn, endBtn)));

  const node = el('div', { class: 'med' }, panel, hud);

  function paintPause() {
    pauseBtn.replaceChildren(icon(paused ? 'chevron' : 'pause', 12));
    pauseBtn.title = paused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume the sit' : 'Pause the sit');
    hud.classList.toggle('is-paused', paused);
  }
  function paint() {
    if (!running) return;
    const c = audio();
    const remain = paused || !c ? left : Math.max(0, endAt - c.currentTime);
    time.textContent = clock(Math.ceil(remain));
    prog.setAttribute('stroke-dashoffset', String(C * (1 - remain / total)));
    if (!paused && remain <= 0) finish();
  }

  // every gong still to come in this sit, on the audio clock
  function schedule(remain) {
    cancel();
    const c = audio();
    if (!c || !soundOn()) return;
    const now = c.currentTime;
    if (every) {
      const done = total - remain;
      for (let t = Math.ceil((done + 0.5) / (EVERY * 60)) * EVERY * 60; t < total - 1; t += EVERY * 60) scheduled.push(...strike(c, now + (t - done), { vol: 0.09, base: 156 }));
    }
    for (let k = 0; k < 3; k++) scheduled.push(...strike(c, now + remain + k * 5, { vol: 0.15 - k * 0.02 }));
  }
  function cancel() {
    for (const n of scheduled) { try { n.stop?.(0); } catch { /* not started or already stopped */ } try { n.disconnect(); } catch { /* gone */ } }
    scheduled = [];
  }

  function start() {
    const c = audio();
    write(PREF_KEY, { mins, every });
    total = mins * 60; left = total; running = true; paused = false;
    clearTimeout(doneTimer);
    close({ focus: false });
    hud.hidden = false; hud.classList.remove('is-done');
    label.textContent = `${mins}-minute sit`;
    if (c) {
      if (soundOn()) strike(c, c.currentTime + 0.05, { vol: 0.14 });   // the opening gong
      endAt = c.currentTime + total;
      schedule(total);
    } else endAt = performance.now() / 1000 + total;
    paintPause(); paint();
    clearInterval(tick); tick = setInterval(paint, 250);
    button.classList.add('is-on');
    requestAnimationFrame(() => pauseBtn.focus({ preventScroll: true }));
  }
  function pause() {
    const c = audio(); if (!running || paused || !c) return;
    left = Math.max(0, endAt - c.currentTime); paused = true; cancel(); paintPause(); paint();
    label.textContent = 'Paused';
  }
  function resume() {
    const c = audio(); if (!running || !paused || !c) return;
    paused = false; endAt = c.currentTime + left; schedule(left); paintPause(); paint();
    label.textContent = `${Math.round(total / 60)}-minute sit`;
  }
  // the closing gongs were scheduled already; this marks the moment
  function finish() {
    running = false; clearInterval(tick);
    logMins(Math.round(total / 60));
    scheduled = [];   // they ring out on their own now
    hud.classList.add('is-done');
    time.textContent = '✓';
    prog.setAttribute('stroke-dashoffset', '0');
    label.textContent = `Your sit is complete. Today: ${todayMins()} min`;
    button.classList.remove('is-on');
    doneTimer = setTimeout(() => { hud.hidden = true; }, 12000);
  }
  function end({ early = false, quietly = false } = {}) {
    if (!running) { hud.hidden = true; return; }
    const c = audio();
    const sat = total - (paused || !c ? left : Math.max(0, endAt - c.currentTime));
    running = false; clearInterval(tick); cancel();
    logMins(Math.floor(sat / 60));
    button.classList.remove('is-on');
    if (early && !quietly) {
      gong(0.11);
      hud.classList.add('is-done');
      time.textContent = clock(Math.floor(sat));
      label.textContent = sat >= 60 ? `Ended after ${Math.floor(sat / 60)} min. Today: ${todayMins()} min` : 'Ended. Come back to it any time';
      clearTimeout(doneTimer); doneTimer = setTimeout(() => { hud.hidden = true; }, 6000);
      button.focus({ preventScroll: true });
    } else hud.hidden = true;
  }

  function open() {
    if (!available) return;
    paintChips(); everyBox.checked = every;
    const t = todayMins();
    today.textContent = t ? `Today: ${t} min` : '';
    today.hidden = !t;
    quiet.hidden = soundOn();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => chips.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }));
  }
  function close({ focus = true } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus({ preventScroll: true });
  }
  button.addEventListener('click', () => (panel.hidden ? open() : close()));

  return {
    button, node,
    get running() { return running; },
    // shown only for the pieces that want it (the Temple lounge)
    setAvailable(on) { available = !!on; button.hidden = !available; if (!available) { close({ focus: false }); end({ quietly: true }); hud.hidden = true; } },
    // Esc: closes the panel first; a running sit is left alone (the lounge's own Esc ends both)
    escape() { if (!panel.hidden) { close(); return true; } return false; },
    stop() { close({ focus: false }); end({ quietly: true }); clearTimeout(doneTimer); hud.hidden = true; },
  };
}
