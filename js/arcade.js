// The Zen arcade: a square frame on Zen's second page with two shelves, chosen by a switch at
// the top: Games (small, calm games) and Lounge (places to sit in: a night room, a pixel café).
// Each shelf shows a still from each piece; picking one plays it in the same frame, with a bar
// for going back, the piece's own status, and a sound switch. Whatever is playing pauses while
// an eye-rest break is up or the tab is hidden, and stops when the page is left.

import { el, icon } from './ui.js';
import { soundOn, setSound } from './arcade-kit.js';
import { createMeditation } from './meditate.js';
import * as llama from './game-llama.js';
import * as lantern from './game-lantern.js';
import * as ripples from './game-ripples.js';
import * as drive from './game-drive.js';
import * as brush from './game-brush.js';
import * as pebbles from './game-pebbles.js';
import * as room from './lounge-room.js';
import * as cafe from './lounge-cafe.js';
import * as garden from './lounge-garden.js';

const SHELVES = {
  games: { list: [llama, drive, lantern, ripples, brush, pebbles], label: 'Games', h: 'A quiet corner',
    sub: 'Small, slow games for a pause. No timers, no losing streaks — soft music on the trail, the drive and the brush.' },
  lounge: { list: [room, cafe, garden], label: 'Lounge', h: 'Somewhere to sit',
    sub: 'Nothing to win. Rain on the window, a little music, things to touch. Stay as long as you like.' },
};
const SHELF_KEY = 'stacknest:arcade-shelf';

// a few kind words for the end of a round (written for StackNest)
const UPLIFT = [
  'You gave your mind a little room. That counts.',
  'A calm mind is a sharp tool, and you just sharpened it.',
  'Rested and ready. The next thing will feel lighter.',
  'Small pauses make long days kinder.',
  'That was time well spent. One more breath, then begin.',
  'You showed up for yourself just now.',
  'Clear head, steady hands. You’ve got this.',
  'Every reset is a fresh start. Here’s yours.',
  'Gentle play, real rest. Take the calm with you.',
  'Good things grow from quiet moments like this.',
  'You’re doing better than you think.',
  'Light heart, open mind. Onward, gently.',
  'A little joy goes a long way. Carry it with you.',
  'Well played. Now the day is yours again.',
];
const CAPS = ['well played', 'nicely done', 'lovely', 'that was nice', 'good pause'];

// todos: { list(): Promise<[{ id, rowId, text, due, overdue, from }]>, tick(item), focus(item | null) }
// — Zen's list, so the end-of-round card can offer the next thing to do
export function createArcade({ isPaused, onShelf, todos = null }) {
  let stopGame = null, current = null, upliftAt = 0;
  const med = createMeditation();   // the Temple lounge's meditation timer (its button sits on the bar)
  const STROKE_KEY = 'stacknest:arcade-art-stroke';
  const readStroke = () => { try { return localStorage.getItem(STROKE_KEY) !== 'off'; } catch { return true; } };
  const writeStroke = (on) => { try { localStorage.setItem(STROKE_KEY, on ? 'on' : 'off'); } catch { /* this session only */ } };
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
  soundBtn.addEventListener('click', () => { setSound(!soundOn()); paintSound(); (cardOpen ? againBtn : canvas).focus({ preventScroll: true }); });
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
    (cardOpen ? againBtn : canvas).focus({ preventScroll: true });
  });
  document.addEventListener('fullscreenchange', () => { paintFs(); canvas._snFit?.(); });
  // "Done": end any game or lounge on the same card a finished round gets (and never over a
  // card already up, which would lose that round's painting and its replay button)
  const doneBtn = el('button', { class: 'arc-btn arc-done', type: 'button', title: 'I’m done — what’s next?',
    onclick: () => { if (!cardOpen) showCard({ stats: score.textContent, againLabel: current?.meta.lounge ? 'Stay a little longer' : 'Keep playing', again: null }); } },
  icon('check', 14), el('span', { text: 'Done' }));

  /* ——— the end-of-round card ———
     A kind word, the round's own numbers, the painting to save when there is one, and the top
     three things on the to-do list: tick one off here, or go straight to it in Zen. */
  const cardCap = el('span', { class: 'arc-over-cap' });
  const cardMsg = el('h3', { class: 'arc-over-h', id: 'arc-over-h' });
  const cardStats = el('p', { class: 'arc-over-stats' });
  const cardArt = el('div', { class: 'arc-over-art' });
  const cardTodos = el('div', { class: 'arc-over-todos' });
  const againBtn = el('button', { class: 'arc-over-btn is-primary', type: 'button' });
  const toListBtn = el('button', { class: 'arc-over-btn', type: 'button', onclick: () => todos?.focus(null) },
    el('span', { text: 'Back to my list' }));
  const over = el('div', { class: 'arc-over', hidden: '', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'arc-over-h' },
    el('div', { class: 'arc-over-card' }, cardCap, cardMsg, cardStats, cardArt, cardTodos, el('div', { class: 'arc-over-acts' }, againBtn, toListBtn)));
  let cardOpen = false, cardAgain = null;
  // while the card is up the game behind it can't take focus or keys (it is paused, and a key
  // there would start a new round under the card)
  const hideCard = () => { cardOpen = false; over.hidden = true; cardArt.replaceChildren(); canvas.inert = false; doneBtn.disabled = false; };
  // rebuilding the list must not drop keyboard focus to the page: keep it on the same row's tick
  // (or the nearest one left), else the add link, else the main button
  const keepFocus = (rebuild) => {
    const ticks = () => [...cardTodos.querySelectorAll('.arc-over-tick')];
    const had = cardTodos.contains(document.activeElement);
    const at = had ? Math.max(0, ticks().indexOf(document.activeElement)) : -1;
    rebuild();
    if (!had) return;
    const t = ticks();
    (t[Math.min(at, t.length - 1)] || cardTodos.querySelector('.arc-over-link') || againBtn).focus({ preventScroll: true });
  };
  over.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); showMenu(); } });
  againBtn.addEventListener('click', () => {
    const again = cardAgain;
    hideCard();
    again?.();
    canvas.focus({ preventScroll: true });
  });

  async function fillTodos() {
    if (!todos) { cardTodos.replaceChildren(); return; }
    let items = [];
    try { items = (await todos.list()).slice(0, 3); } catch { items = []; }
    const head = el('div', { class: 'arc-over-todo-h', text: items.length ? 'When you’re ready, one of these' : 'Your list is clear' });
    if (!items.length) {
      keepFocus(() => cardTodos.replaceChildren(head, el('p', { class: 'arc-over-quiet', text: 'Nothing waiting. Enjoy the calm, or note down what’s next.' }),
        el('button', { class: 'arc-over-link', type: 'button', onclick: () => todos.focus(null) }, icon('plus', 13), el('span', { text: 'Add a to-do' }))));
      return;
    }
    keepFocus(() => cardTodos.replaceChildren(head, el('ul', { class: 'arc-over-list' }, ...items.map((it) => {
      // one-way: it marks the item done (never flips it back), and only once
      const tick = el('button', { class: 'arc-over-tick', type: 'button', role: 'checkbox', 'aria-checked': 'false', 'aria-label': `Mark “${it.text}” done`,
        onclick: async () => {
          if (tick.getAttribute('aria-checked') === 'true') return;
          tick.setAttribute('aria-checked', 'true'); tick.replaceChildren(icon('check', 11)); row.classList.add('is-done');
          try { await todos.tick(it); }
          catch { tick.setAttribute('aria-checked', 'false'); tick.replaceChildren(); row.classList.remove('is-done'); return; }
          setTimeout(fillTodos, 700);
        } });
      const go = el('button', { class: 'arc-over-go', type: 'button', title: 'Go to it in Zen', onclick: () => todos.focus(it) },
        el('span', { class: 'arc-over-text', text: it.text }),
        it.from ? el('span', { class: 'arc-over-from', text: it.from }) : null,
        it.due ? el('span', { class: `arc-over-due${it.overdue ? ' is-late' : ''}`, text: it.due }) : null,
        el('span', { class: 'arc-over-arrow', 'aria-hidden': 'true' }, icon('chevron', 12)));
      const row = el('li', { class: 'arc-over-item' }, tick, go);
      return row;
    }))));
    if (document.activeElement === againBtn) againBtn.scrollIntoView({ block: 'nearest' });
  }

  // summary: { title?, message?, stats, againLabel?, again?: fn | null (null just resumes), artwork?: ({ quote }) => canvas, artworkName? }
  function showCard(summary = {}) {
    if (!current) return;
    cardOpen = true;
    cardAgain = summary.again || null;
    // a fresh kind word each time, never the same one twice running
    upliftAt = (upliftAt + 1 + Math.floor(Math.random() * (UPLIFT.length - 1))) % UPLIFT.length;
    cardCap.textContent = summary.title || CAPS[Math.floor(Math.random() * CAPS.length)];
    cardMsg.textContent = summary.message || UPLIFT[upliftAt];   // a game may bring its own word
    cardStats.textContent = summary.stats || '';
    cardStats.hidden = !summary.stats;
    againBtn.replaceChildren(icon(summary.again ? 'reset' : 'chevron', 13), el('span', { text: summary.againLabel || 'Play again' }));
    cardArt.replaceChildren();
    if (summary.artwork) {
      try {
        // the painting, with the kind word inscribed on the sheet; a game that offers it can leave
        // its stroke out (Brush Stroke: the trace alone), remembered for next time
        let withStroke = summary.strokeToggle ? readStroke() : true;
        let art = null;
        const thumb = el('img', { class: 'arc-over-thumb', alt: 'Your painting' });
        const draw = () => {
          art = summary.artwork({ quote: cardMsg.textContent, stroke: withStroke });
          // the thumbnail from a small copy: encoding the full 1600 px sheet just to show 84 px stalls
          const small = el('canvas', { width: '168', height: '168' });
          small.getContext('2d').drawImage(art, 0, 0, art.width, art.width, 0, 0, 168, 168);   // the painting's square, not its foot
          thumb.src = small.toDataURL('image/png');
        };
        draw();
        const save = el('button', { class: 'arc-over-btn is-save', type: 'button', onclick: () => saveCanvas(art, summary.artworkName || 'stacknest-artwork.png', save) },
          icon('download', 13), el('span', { text: 'Save painting' }));
        const side = el('div', { class: 'arc-over-artside' }, save);
        if (summary.strokeToggle) {
          const sw = el('button', { class: 'arc-over-switch', type: 'button', role: 'switch' });
          const paintSw = () => {
            sw.setAttribute('aria-checked', String(withStroke));
            sw.replaceChildren(el('span', { class: 'arc-over-switch-track', 'aria-hidden': 'true' }, el('span', { class: 'arc-over-switch-knob' })),
              el('span', { text: withStroke ? 'Brush stroke shown' : 'Brush stroke hidden' }));
            sw.title = withStroke ? 'Leave the black stroke out of the saved painting' : 'Show the black stroke in the saved painting';
          };
          sw.addEventListener('click', () => {
            withStroke = !withStroke; writeStroke(withStroke); paintSw(); draw();
            save.replaceChildren(icon('download', 13), el('span', { text: 'Save painting' })); save.classList.remove('is-saved');
          });
          paintSw();
          side.append(sw);
        }
        cardArt.append(thumb, side);
      } catch { /* no painting this time */ }
    }
    over.hidden = false;
    canvas.inert = true;
    doneBtn.disabled = true;
    // the card takes focus only from the game (or from nowhere), never from a field being typed in
    const was = document.activeElement;
    const take = !was || was === document.body || node.contains(was);
    fillTodos();
    if (take) requestAnimationFrame(() => { againBtn.focus({ preventScroll: true }); againBtn.scrollIntoView({ block: 'nearest' }); });
  }

  // a PNG to the downloads folder, named for the moment it was made
  function saveCanvas(art, name, btn) {
    art.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (btn) { btn.replaceChildren(icon('check', 13), el('span', { text: 'Saved' })); btn.classList.add('is-saved'); }
    }, 'image/png');
  }

  const play = el('div', { class: 'arc-play', hidden: '' },
    el('div', { class: 'arc-bar' }, back, title, score, med.button, doneBtn, fsBtn, soundBtn), el('div', { class: 'arc-stage' }, canvas, med.node, over));
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
    // only a lounge fills the screen's shape in full screen; a game keeps its square, as large as
    // fits, so nothing in it stretches (setupCanvas reads the canvas's shown shape, so a square
    // element gives a square scene)
    canvas.classList.toggle('is-wide', !!g.meta.lounge);
    med.setAvailable(!!(g.meta.timer || g.meta.id === 'temple'));
    hideCard();
    stopGame = g.start(canvas, {
      setScore: (s) => { score.textContent = s; },
      isPaused: () => isPaused() || cardOpen,   // the game waits while the card is up
      finish: (summary) => showCard(summary),
    });
    requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
  }

  function stop() {
    stopGame?.();
    stopGame = null;
  }

  function showMenu() {
    const was = current;
    med.setAvailable(false);
    if (document.fullscreenElement === play) document.exitFullscreen().catch(() => {});
    hideCard();
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
    escape() { if (med.escape()) return true; if (current) { showMenu(); return true; } return false; },
    get playing() { return !!current; },
    focus() { (current ? canvas : shelf.children[0])?.focus({ preventScroll: true }); },
    stop() { if (current) showMenu(); },
    get shelf() { return shelfId; },
    // open a shelf (from Zen's own switch): back out of whatever is playing first
    showShelf(id) { if (current) showMenu(); if (id !== shelfId) setShelf(id); },
  };
}
