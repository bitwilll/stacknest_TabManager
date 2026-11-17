// The Zen arcade: a square frame on Zen's second page with two shelves, chosen by a switch at
// the top: Games (small, calm games) and Lounge (places to sit in: a night room, a pixel café).
// Each shelf shows a still from each piece; picking one plays it in the same frame, with a bar
// for going back, the piece's own status, and a sound switch. Whatever is playing pauses while
// an eye-rest break is up or the tab is hidden, and stops when the page is left.

import { el, icon } from './ui.js';
import { soundOn, setSound } from './arcade-kit.js';
import * as llama from './game-llama.js';
import * as lantern from './game-lantern.js';
import * as ripples from './game-ripples.js';
import * as drive from './game-drive.js';
import * as brush from './game-brush.js';
import * as pebbles from './game-pebbles.js';
import * as room from './lounge-room.js';
import * as cafe from './lounge-cafe.js';

const SHELVES = {
  games: { list: [llama, drive, lantern, ripples, brush, pebbles], label: 'Games', h: 'A quiet corner',
    sub: 'Small, slow games for a pause. No timers, no losing streaks — soft music on the trail, the drive and the brush.' },
  lounge: { list: [room, cafe], label: 'Lounge', h: 'Somewhere to sit',
    sub: 'Nothing to win. Rain on the window, a little music, things to touch. Stay as long as you like.' },
};
const SHELF_KEY = 'stacknest:arcade-shelf';

export function createArcade({ isPaused, onShelf }) {
  let stopGame = null, current = null;
  let shelfId = 'games';
  try { if (localStorage.getItem(SHELF_KEY) === 'lounge') shelfId = 'lounge'; } catch { /* default */ }

  const tabBtn = (id) => el('button', { class: 'arc-tab', type: 'button', dataset: { shelf: id }, 'aria-pressed': 'false', onclick: () => setShelf(id, true) },
    icon(id === 'games' ? 'gamepad' : 'lounge', 14), el('span', { text: SHELVES[id].label }));
  const tabs = el('div', { class: 'arc-tabs', role: 'group', 'aria-label': 'Arcade shelves' }, tabBtn('games'), tabBtn('lounge'));
  const heading = el('h2', { class: 'arc-h' });
  const sub = el('p', { class: 'arc-sub' });
  const shelf = el('div', { class: 'arc-shelf', role: 'list' });
  const menu = el('div', { class: 'arc-menu' },
    el('header', { class: 'arc-head' }, el('div', { class: 'arc-head-row' }, el('span', { class: 'arc-cap', text: 'arcade' }), tabs), heading, sub),
    shelf);

  const title = el('span', { class: 'arc-title' });
  const score = el('span', { class: 'arc-score', 'aria-live': 'polite' });
  const soundBtn = el('button', { class: 'arc-btn arc-sound', type: 'button', role: 'switch' });
  const paintSound = () => {
    const on = soundOn();
    soundBtn.setAttribute('aria-checked', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.title = on ? 'Sound on' : 'Sound off';
    soundBtn.replaceChildren(icon(on ? 'bell' : 'bellOff', 14), el('span', { text: on ? 'Sound' : 'Muted' }));
  };
  soundBtn.addEventListener('click', () => { setSound(!soundOn()); paintSound(); canvas.focus({ preventScroll: true }); });
  const backLabel = el('span', { text: 'Games' });
  const back = el('button', { class: 'arc-btn', type: 'button', title: 'Back (Esc)', onclick: () => showMenu() },
    el('span', { class: 'arc-back-ic', 'aria-hidden': 'true' }, icon('chevron', 13)), backLabel);
  const canvas = el('canvas', { class: 'arc-canvas', tabindex: '0' });
  // full screen: the whole player (bar and picture) fills the screen; Esc or the button leaves
  const fsBtn = el('button', { class: 'arc-btn arc-fs', type: 'button' });
  const paintFs = () => {
    const on = document.fullscreenElement === play;
    fsBtn.replaceChildren(icon(on ? 'shrink' : 'expand', 14), el('span', { text: on ? 'Exit' : 'Full screen' }));
    fsBtn.title = on ? 'Leave full screen (Esc)' : 'Full screen';
    fsBtn.setAttribute('aria-label', fsBtn.title);
  };
  fsBtn.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await play.requestFullscreen({ navigationUI: 'hide' }); } catch { /* not allowed here */ }
    canvas.focus({ preventScroll: true });
  });
  document.addEventListener('fullscreenchange', () => { paintFs(); canvas._snFit?.(); });
  const play = el('div', { class: 'arc-play', hidden: '' },
    el('div', { class: 'arc-bar' }, back, title, score, fsBtn, soundBtn), el('div', { class: 'arc-stage' }, canvas));
  paintFs();

  const node = el('div', { class: 'arc-frame' }, menu, play);

  function setShelf(id, focus = false) {
    shelfId = id;
    try { localStorage.setItem(SHELF_KEY, id); } catch { /* not remembered */ }
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.shelf === id));
    onShelf?.(id);
    const S = SHELVES[id];
    heading.textContent = S.h;
    sub.textContent = S.sub;
    shelf.classList.toggle('is-lounge', id === 'lounge');
    shelf.replaceChildren(...S.list.map((g) => {
      const thumb = el('canvas', { class: 'arc-thumb', width: '480', height: '480', 'aria-hidden': 'true' });
      const card = el('button', { class: 'arc-card', type: 'button', role: 'listitem', onclick: () => launch(g) },
        thumb, el('span', { class: 'arc-card-t', text: g.meta.title }), el('span', { class: 'arc-card-s', text: g.meta.blurb }),
        el('span', { class: 'arc-card-k', text: g.meta.keys }));
      requestAnimationFrame(() => {
        const c = thumb.getContext('2d');
        c.setTransform(0.75, 0, 0, 0.75, 0, 0);
        try { g.preview(c); } catch { /* a still that fails to draw leaves the card plain */ }
      });
      return card;
    }));
    if (focus) requestAnimationFrame(() => tabs.querySelector(`[data-shelf="${id}"]`)?.focus({ preventScroll: true }));
  }

  function launch(g) {
    stop();
    current = g;
    menu.hidden = true;
    play.hidden = false;
    title.textContent = g.meta.title;
    backLabel.textContent = SHELVES[shelfId].label;
    canvas.setAttribute('aria-label', `${g.meta.title}. ${g.meta.keys}.`);
    paintSound();
    score.textContent = '';
    stopGame = g.start(canvas, { setScore: (s) => { score.textContent = s; }, isPaused });
    requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
  }

  function stop() {
    stopGame?.();
    stopGame = null;
  }

  function showMenu() {
    const was = current;
    if (document.fullscreenElement === play) document.exitFullscreen().catch(() => {});
    stop();
    current = null;
    play.hidden = true;
    menu.hidden = false;
    score.textContent = '';
    const i = SHELVES[shelfId].list.indexOf(was);
    requestAnimationFrame(() => (shelf.children[Math.max(0, i)])?.focus({ preventScroll: true }));
  }

  setShelf(shelfId);

  return {
    node,
    // Esc inside a game goes back to its shelf; on the shelf it is the page's to use
    escape() { if (current) { showMenu(); return true; } return false; },
    focus() { (current ? canvas : shelf.children[0])?.focus({ preventScroll: true }); },
    stop() { if (current) showMenu(); },
    get shelf() { return shelfId; },
    // open a shelf (from Zen's own switch): back out of whatever is playing first
    showShelf(id) { if (current) showMenu(); if (id !== shelfId) setShelf(id); },
  };
}
