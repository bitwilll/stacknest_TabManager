// Pebbles — tic-tac-toe on a pond. Nine lily pads are the board; you toss pale pebbles from the
// near bank, the pond answers with dark stones from the far one. Each one arcs through the air,
// lands on its pad with a splash, and the ripples spread across the water. A koi drifts below.
// The pond plays well but not perfectly (now and then it is simply admiring the view), so rounds
// can be won. Who starts alternates. Click a pad, or use the arrow keys and Enter (or 1–9).
// Every stone that lands rings the next step of the major scale (do, re, mi, fa, sol…), so a
// round climbs as it fills; a win resolves on a chord.

import { SIZE, setupCanvas, runLoop, tone, card, pointIn, splash } from './arcade-kit.js';
import { water, koi } from './game-ripples.js';

export const meta = { id: 'pebbles', title: 'Pebbles', blurb: 'Tic-tac-toe on a pond: toss a pebble onto a lily pad.', keys: 'Click a pad, arrows + Enter, or 1–9' };
const SCORE_KEY = 'stacknest:arcade-pebbles';
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const B = 456, X0 = (SIZE - B) / 2, Y0 = 150, CELL = B / 3, PAD = 60, FLIGHT = 0.8;

const DOREMI = [60, 62, 64, 65, 67, 69, 71, 72, 74];   // do re mi fa sol la ti do re
const centre = (i) => [X0 + (i % 3) * CELL + CELL / 2, Y0 + Math.floor(i / 3) * CELL + CELL / 2];
const PADS = Array.from({ length: 9 }, (_, i) => ({ a: ((i * 2.399) % (Math.PI * 2)), shade: i % 3 }));

const winner = (b) => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l }; return b.every(Boolean) ? { who: 'draw' } : null; };

function minimax(b, me, turn) {
  const w = winner(b);
  if (w) return { s: w.who === 'draw' ? 0 : w.who === me ? 10 : -10 };
  let best = { s: turn === me ? -Infinity : Infinity, i: -1 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const r = minimax(b, me, turn === 'P' ? 'G' : 'P');
    b[i] = null;
    const s = r.s - Math.sign(r.s) * 0.01;   // prefer quicker wins, slower losses
    if (turn === me ? s > best.s : s < best.s) best = { s, i };
  }
  return best;
}

function lilyPad(ctx, x, y, a, shade, dip, glow) {
  ctx.save();
  ctx.translate(x, y + dip * 3);
  ctx.scale(1 - dip * 0.05, 1 - dip * 0.05);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.arc(5, 7, PAD, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(5, 7); ctx.fill();
  ctx.fillStyle = ['#5c9a5a', '#67a462', '#548f53'][shade];
  ctx.beginPath(); ctx.arc(0, 0, PAD, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(0, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.arc(-8, -10, PAD * 0.7, 0.22, Math.PI * 2 - 0.05); ctx.lineTo(0, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,40,.32)'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 8; k++) { const r = 0.5 + k * 0.72; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(r) * PAD * 0.92, Math.sin(r) * PAD * 0.92); ctx.stroke(); }
  ctx.restore();
  if (glow) {
    ctx.strokeStyle = glow; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + dip * 3, PAD + 9, 0, Math.PI * 2); ctx.stroke();
  }
}

function stone(ctx, x, y, kind, s = 1) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,30,20,.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 8, 28 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kind === 'P' ? '#f3efe6' : '#3f4247';
  ctx.beginPath(); ctx.ellipse(x, y, 28 * s, 21 * s, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kind === 'P' ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.ellipse(x - 9 * s, y - 7 * s, 10 * s, 5.5 * s, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function preview(ctx) {
  water(ctx, 1);
  const b = ['P', null, 'G', null, 'P', null, 'G', null, null];
  for (let i = 0; i < 9; i++) { const [x, y] = centre(i); lilyPad(ctx, x, y, PADS[i].a, PADS[i].shade, 0, null); if (b[i]) stone(ctx, x, y, b[i]); }
  ctx.strokeStyle = 'rgba(220,250,245,.5)'; ctx.lineWidth = 2;
  const [x, y] = centre(8);
  for (const r of [72, 92, 112]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); }
}

export function start(canvas, { setScore, isPaused, finish: showCard }) {
  const ctx = setupCanvas(canvas);
  let tally = { you: 0, garden: 0, draw: 0 };
  try { tally = { ...tally, ...JSON.parse(localStorage.getItem(SCORE_KEY) || '{}') }; } catch { /* fresh */ }
  let t = 0, board = Array(9).fill(null), turn = 'P', starter = 'P', cursor = 4, result = null, thinkT = 0, showCursor = false, moves = 0, hover = -1;
  let throws = [], ripples = [], spray = [], bob = Array(9).fill(0), winT = 0;
  const fish = { x: 120, y: 520, a: 0.2, c0: '#f5f1ea', c1: '#e8643a', p: 0, wander: 0 };
  const say = () => setScore(`You ${tally.you} · Pond ${tally.garden} · Even ${tally.draw}`);

  const finish = () => {
    result = winner(board);
    if (!result) return false;
    winT = 0;
    // a resolving chord: rising and bright for you, gently falling for the pond, warm when even
    const chord = result.who === 'P' ? [72, 76, 79, 84] : result.who === 'G' ? [79, 76, 72, 67] : [65, 69, 72, 77];
    chord.forEach((m, i) => tone(m, { dur: 1.8, vol: 0.06, delay: 0.45 + i * 0.16 }));
    if (result.who === 'P') tally.you += 1; else if (result.who === 'G') tally.garden += 1; else tally.draw += 1;
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(tally)); } catch { /* not kept */ }
    say();
    return true;
  };
  let resultT = 0, carded = false;
  const newRound = () => { board = Array(9).fill(null); result = null; resultT = 0; carded = false; starter = starter === 'P' ? 'G' : 'P'; turn = starter; thinkT = 0.8; moves = 0; };

  const toss = (who, i) => {
    const [tx, ty] = centre(i);
    throws.push({ who, cell: i, p: 0, from: who === 'P' ? [SIZE / 2 + (Math.random() - 0.5) * 160, SIZE + 40] : [SIZE / 2 + (Math.random() - 0.5) * 220, -50], to: [tx, ty] });
    turn = 'flying';
  };
  const land = (th) => {
    board[th.cell] = th.who; moves += 1;
    const [x, y] = th.to;
    bob[th.cell] = 1;
    for (let k = 0; k < 3; k++) ripples.push({ x, y, r: PAD * 0.6, l: 1, delay: k * 0.22 });
    for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 80; spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, z: 0, vz: 120 + Math.random() * 80, l: 0.7 }); }
    splash(0.06);
    tone(DOREMI[Math.min(DOREMI.length - 1, moves - 1)], { dur: 1.6, vol: 0.075, type: th.who === 'P' ? 'sine' : 'triangle' });
    if (!finish()) { turn = th.who === 'P' ? 'G' : 'P'; if (turn === 'G') thinkT = 0.6 + Math.random() * 0.5; }
  };

  const place = (i) => {
    if (result) { newRound(); return; }
    if (turn !== 'P' || board[i] || throws.length) return;
    toss('P', i);
  };
  const pondMove = () => {
    const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const relaxed = Math.random() < (moves < 2 ? 0.5 : 0.22);   // a gentle opponent
    toss('G', relaxed ? free[Math.floor(Math.random() * free.length)] : minimax(board.slice(), 'G', 'G').i);
  };

  const padAt = (p) => { for (let i = 0; i < 9; i++) { const [x, y] = centre(i); if (Math.hypot(p.x - x, p.y - y) < PAD + 14) return i; } return -1; };
  const onDown = (e) => { canvas.focus({ preventScroll: true }); showCursor = false; const i = padAt(pointIn(canvas, e)); if (result) newRound(); else if (i >= 0) place(i); };
  const onMove = (e) => { hover = padAt(pointIn(canvas, e)); };
  const onKey = (e) => {
    const k = e.key;
    if (/^[1-9]$/.test(k)) { e.preventDefault(); showCursor = true; cursor = Number(k) - 1; place(cursor); return; }
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[k];
    if (mv) { e.preventDefault(); showCursor = true; const n = cursor + mv; if (n >= 0 && n < 9 && !(Math.abs(mv) === 1 && Math.floor(n / 3) !== Math.floor(cursor / 3))) cursor = n; return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); showCursor = true; place(cursor); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('keydown', onKey);

  function update(dt) {
    t += dt;
    if (!result && turn === 'G' && !throws.length) { thinkT -= dt; if (thinkT <= 0) pondMove(); }
    for (const th of throws) th.p += dt / FLIGHT;
    const landed = throws.filter((th) => th.p >= 1);
    throws = throws.filter((th) => th.p < 1);
    for (const th of landed) land(th);
    for (const r of ripples) { if (r.delay > 0) { r.delay -= dt; continue; } r.r += 60 * dt; r.l -= dt * 0.38; }
    ripples = ripples.filter((r) => r.l > 0);
    for (const s of spray) { s.x += s.vx * dt; s.y += s.vy * dt; s.vz -= 520 * dt; s.z += s.vz * dt; s.l -= dt; }
    spray = spray.filter((s) => s.l > 0 && s.z > -2);
    for (let i = 0; i < 9; i++) bob[i] *= Math.exp(-dt * 2.2);
    // the koi drifts in slow loops under the pads
    fish.wander += dt * 0.25;
    const gx = 320 + Math.cos(fish.wander) * 250, gy = 330 + Math.sin(fish.wander * 1.3) * 230;
    let d = Math.atan2(gy - fish.y, gx - fish.x) - fish.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    fish.a += d * Math.min(1, dt * 1.2); fish.x += Math.cos(fish.a) * 28 * dt; fish.y += Math.sin(fish.a) * 28 * dt;
    // a round over: let the chord ring and the line glow, then the card (Another round / the list)
    if (result) {
      resultT += dt;
      if (resultT > 2 && !carded && showCard) {
        carded = true;
        showCard({ title: result.who === 'P' ? 'three in a row' : result.who === 'G' ? 'the pond wins this one' : 'still water',
          stats: `You ${tally.you} · Pond ${tally.garden} · Even ${tally.draw}`, againLabel: 'Another round', again: newRound });
      }
    }
    if (result?.line) { winT += dt; if (Math.floor(winT / 1.4) !== Math.floor((winT - dt) / 1.4)) for (const i of result.line) { const [x, y] = centre(i); ripples.push({ x, y, r: PAD, l: 0.8, delay: result.line.indexOf(i) * 0.18 }); } }

    water(ctx, t);
    koi(ctx, fish, t);
    for (const r of ripples) {
      if (r.delay > 0) continue;
      ctx.strokeStyle = `rgba(225,250,245,${0.6 * r.l})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const [x, y] = centre(i);
      const dip = bob[i] * Math.sin(t * 9 + i);
      const win = result?.line?.includes(i);
      const glow = win ? `rgba(255,236,180,${0.55 + Math.sin(t * 3) * 0.25})`
        : !result && turn === 'P' && !board[i] && ((showCursor && cursor === i) || (!showCursor && hover === i)) ? 'rgba(255,255,255,.55)' : null;
      lilyPad(ctx, x, y + Math.sin(t * 0.8 + i * 1.7) * 1.5, PADS[i].a, PADS[i].shade, dip, glow);
      if (board[i]) stone(ctx, x, y + dip * 3 + Math.sin(t * 0.8 + i * 1.7) * 1.5, board[i]);
    }
    for (const s of spray) { ctx.fillStyle = `rgba(235,250,255,${Math.min(1, s.l * 1.6)})`; ctx.beginPath(); ctx.arc(s.x, s.y - s.z, 2.4, 0, Math.PI * 2); ctx.fill(); }
    // pebbles in the air: the shadow skims the water, the stone arcs above it
    for (const th of throws) {
      const e = th.p, gx2 = th.from[0] + (th.to[0] - th.from[0]) * e, gy2 = th.from[1] + (th.to[1] - th.from[1]) * e;
      const h = Math.sin(Math.PI * e);
      ctx.fillStyle = `rgba(10,30,20,${0.12 + 0.18 * (1 - h)})`;
      ctx.beginPath(); ctx.ellipse(gx2, gy2 + 8, 26 * (1 - h * 0.4), 13 * (1 - h * 0.4), 0, 0, Math.PI * 2); ctx.fill();
      stone(ctx, gx2, gy2 - h * 150, th.who, 1 + h * 0.45);
    }
    const msg = result
      ? (result.who === 'P' ? 'Three in a row — your pebbles.' : result.who === 'G' ? 'The pond’s stones line up.' : 'Even. Still water.')
      : turn === 'flying' ? ' ' : turn === 'P' ? (moves ? 'Your toss' : starter === 'P' ? 'You begin — toss a pebble' : 'Your toss') : 'The pond is choosing…';
    card(ctx, [{ text: msg, size: 22, weight: 700 }, { text: result ? 'Tap or press Enter for another round' : ' ', size: 15, weight: 500, alpha: 0.9 }], { y: 72, shadow: 'rgba(0,30,30,.55)' });
  }
  say();
  const stop = runLoop(update, isPaused);
  return () => { stop(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('keydown', onKey); };
}
