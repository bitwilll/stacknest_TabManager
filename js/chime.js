// A soft bell chime, synthesised with Web Audio (no sound file to ship or fetch): four rising
// notes of a major chord, each a sine with a quiet inharmonic overtone that gives it a bell's
// shimmer, a quick attack and a long, gentle fade. Played for a due reminder (from the offscreen
// document, js/offscreen.js) and when an eye-rest pause ends.

const NOTES = [1046.5, 1318.5, 1568.0, 2093.0];   // C6 E6 G6 C7
const STEP = 0.14;                                  // seconds between notes
const RING = 1.9;                                   // how long each note rings

let ctx = null;

// wait: false resolves as soon as the notes are scheduled (the worker posts its notification
// right away instead of after the last note has faded)
export async function playChime({ volume = 0.22, wait = true } = {}) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  ctx = ctx || new AC();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { return false; } }
  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  NOTES.forEach((f, i) => {
    const start = t0 + i * STEP;
    for (const [mult, level] of [[1, 1], [2.76, 0.18], [5.4, 0.05]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(level * (i === NOTES.length - 1 ? 0.9 : 0.7), start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + RING / mult ** 0.35);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + RING + 0.05);
    }
  });
  const total = (NOTES.length - 1) * STEP + RING + 0.1;
  const done = new Promise((r) => setTimeout(r, total * 1000)).then(() => master.disconnect());
  if (wait) await done;
  return true;
}
