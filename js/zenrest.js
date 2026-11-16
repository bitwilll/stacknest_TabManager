// Eye rest: after every 30 minutes of screen time in Zen, a 30-second pause to look away.
//
// Screen time is counted only while a Zen page is open AND visible. The count is shared
// through localStorage ({ acc, last }), so two StackNest tabs add up to one clock rather than
// two: each visible tick adds the time since the *last tick by anyone*, capped, and moves
// `last` on. Being away for five minutes or more (no visible Zen tab ticking) counts as a
// rest and starts the count again. Switched on and off with the zenEyeRest setting.

import { el, icon } from './ui.js';

const SCREEN_KEY = 'stacknest:zen-screen';
export const REST_EVERY = 30 * 60_000;
const REST_FOR = 30;              // seconds
const TICK = 15_000;
const AWAY = 5 * 60_000;

const read = () => {
  try { const v = JSON.parse(localStorage.getItem(SCREEN_KEY) || 'null'); return v && Number.isFinite(v.acc) && Number.isFinite(v.last) ? v : { acc: 0, last: 0 }; }
  catch { return { acc: 0, last: 0 }; }
};
const write = (v) => { try { localStorage.setItem(SCREEN_KEY, JSON.stringify(v)); } catch { /* counted in memory only */ } };

export function createEyeRest({ isActive, onStatus }) {
  let enabled = false;
  let timer = null;
  let countdown = null;
  let restoreFocus = null;

  const R = 54, C = 2 * Math.PI * R;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 128 128');
  ring.setAttribute('class', 'zen-rest-ring');
  ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = `<circle cx="64" cy="64" r="${R}" class="zen-rest-track"/><circle cx="64" cy="64" r="${R}" class="zen-rest-prog" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 64 64)"/>`;
  const prog = ring.querySelector('.zen-rest-prog');
  const secs = el('span', { class: 'zen-rest-secs', text: String(REST_FOR) });
  const title = el('h2', { class: 'zen-rest-h', id: 'zen-rest-h', text: 'Rest your eyes' });
  const msg = el('p', { class: 'zen-rest-msg', text: 'Look at something far away — out a window, across the room — and let your eyes soften. Blink slowly.' });
  const skip = el('button', { class: 'zen-btn-pill zen-rest-skip', type: 'button', text: 'Skip' });
  const node = el('div', { class: 'zen-rest', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'zen-rest-h', hidden: '' },
    el('div', { class: 'zen-rest-card' },
      el('div', { class: 'zen-rest-dial' }, ring, el('span', { class: 'zen-rest-eye', 'aria-hidden': 'true' }, icon('eye', 22)), secs),
      title, msg, skip));
  skip.addEventListener('click', () => finish(false));

  const isShowing = () => !node.hidden;

  function show() {
    if (isShowing()) return;
    write({ acc: 0, last: Date.now() });            // this tab takes the break; the others start fresh
    restoreFocus = document.activeElement;
    title.textContent = 'Rest your eyes';
    msg.textContent = 'Look at something far away — out a window, across the room — and let your eyes soften. Blink slowly.';
    skip.textContent = 'Skip';
    node.hidden = false;
    let left = REST_FOR;
    const paint = () => {
      secs.textContent = String(left);
      prog.setAttribute('stroke-dashoffset', String(C * (1 - left / REST_FOR)));
    };
    paint();
    requestAnimationFrame(() => skip.focus({ preventScroll: true }));
    clearInterval(countdown);
    countdown = setInterval(() => {
      left -= 1;
      paint();
      if (left <= 0) finish(true);
    }, 1000);
  }

  function finish(completed) {
    clearInterval(countdown);
    countdown = null;
    write({ acc: 0, last: Date.now() });
    status();
    if (!completed) { close(); return; }
    title.textContent = 'Welcome back';
    msg.textContent = 'Nicely done. The next pause comes after another 30 minutes in Zen.';
    skip.textContent = 'Back to it';
    skip.onclick = () => { skip.onclick = null; close(); };
    setTimeout(() => { if (!countdown) close(); }, 2200);
  }

  function close() {
    if (node.hidden) return;
    node.hidden = true;
    skip.onclick = null;
    (restoreFocus?.isConnected ? restoreFocus : null)?.focus?.({ preventScroll: true });
  }

  function tick() {
    if (!enabled || !isActive() || document.visibilityState !== 'visible' || isShowing()) return;
    const now = Date.now();
    const s = read();
    const gap = now - s.last;
    const acc = gap >= AWAY || s.last === 0 ? 0 : s.acc + Math.min(Math.max(gap, 0), TICK * 1.5);
    write({ acc, last: now });
    status(acc);
    if (acc >= REST_EVERY) show();
  }

  function status(acc = read().acc) {
    const left = Math.max(0, Math.ceil((REST_EVERY - acc) / 60_000));
    onStatus?.(enabled, left);
  }

  function start() {
    stop();
    if (!enabled) { status(); return; }
    tick();
    timer = setInterval(tick, TICK);
  }
  function stop() { clearInterval(timer); timer = null; }

  document.addEventListener('visibilitychange', () => { if (timer && document.visibilityState === 'visible') tick(); });

  return {
    node,
    isShowing,
    skip: () => finish(false),
    setEnabled(v) {
      const was = enabled;
      enabled = !!v;
      if (enabled !== was || (enabled && !timer && isActive())) { if (isActive()) start(); else status(); }
      if (!enabled) { stop(); if (isShowing()) finish(false); }
    },
    start,
    stop() { stop(); },
    restNow: show,   // for testing from the console
  };
}
