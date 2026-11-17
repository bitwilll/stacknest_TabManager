// The thought at the top of the Zen page: one a day (the same one all day, in every tab), a
// button for another, and a star to keep the ones that land. Lines with no `by` were written
// for StackNest; the Stoic and classical ones are short renderings of public-domain works.
//
// Starred thoughts live under THOUGHTS_KEY ({ fav: [text], only }) and go into a backup; with
// `only` on (and at least one star) the daily rotation draws from the starred ones alone.

export const THOUGHTS_KEY = 'stacknest:thoughts';

const OURS = [
  'One thing at a time. The rest can wait its turn.',
  'Slow is smooth, and smooth is how good work gets done.',
  'You do not have to finish today. You only have to begin.',
  'Small steps still cross the whole distance.',
  'Clear the desk, and the mind often follows.',
  'Rest is part of the work, not a break from it.',
  'Progress, not perfection.',
  'Do the next right thing, then the one after that.',
  'A calm mind sees further than a busy one.',
  'What you water grows. Tend to what matters.',
  'Begin where you are, with what you have.',
  'The hard part is starting. You are already here.',
  'Breathe in. Breathe out. Now the next task.',
  'Kindness to yourself is not a detour.',
  'Focus is choosing what to leave out.',
  'Every expert was once a beginner who kept going.',
  'Done today is better than perfect someday.',
  'A tidy list is a quiet promise to yourself.',
  'Notice one good thing in the next hour.',
  'Courage is often just showing up again.',
  'Let the important work have the best hours.',
  'You are allowed to do less and do it well.',
  'Patience is progress you cannot see yet.',
  'Light the next step; you need not see the whole path.',
  'Tiny habits, repeated, become a life.',
  'Make room for silence; ideas need somewhere to land.',
  'The mountain is climbed one ordinary step at a time.',
  'Be where your feet are.',
  'Gentle and steady outlasts fast and frantic.',
  'Finish one thing before you start the next.',
  'Curiosity is a fine reason to keep going.',
  'Today is a good day to make something.',
  'Your attention is precious. Spend it on purpose.',
  'Strong roots grow in quiet soil.',
  'A short walk can untie a long problem.',
  'Good work is mostly showing up, many times.',
  'Let go of what you cannot hold; carry what you can.',
  'Clarity comes from doing, not from waiting.',
  'Every closed tab is a little more room to think.',
  'Water carves stone by staying, not by force.',
  'Leave things a little better than you found them.',
  'Pause before you rush. The rush will keep.',
  'Grateful for this moment, ready for the next.',
].map((text) => ({ text }));

const CLASSICAL = [
  ['You have power over your mind, not outside events. Realise this, and you will find strength.', 'Marcus Aurelius'],
  ['Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', 'Marcus Aurelius'],
  ['Waste no more time arguing what a good person should be. Be one.', 'Marcus Aurelius'],
  ['Loss is nothing else but change, and change is nature’s delight.', 'Marcus Aurelius'],
  ['Confine yourself to the present.', 'Marcus Aurelius'],
  ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
  ['The best way of avenging yourself is not to become like the wrongdoer.', 'Marcus Aurelius'],
  ['Look within. Within is the fountain of good.', 'Marcus Aurelius'],
  ['Do every act of your life as though it were the very last.', 'Marcus Aurelius'],
  ['Our life is what our thoughts make it.', 'Marcus Aurelius'],
  ['Watch the stars in their courses as if you ran with them.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['While we are postponing, life speeds by.', 'Seneca'],
  ['No one was ever wise by chance.', 'Seneca'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste much of it.', 'Seneca'],
  ['As long as you live, keep learning how to live.', 'Seneca'],
  ['Difficulties strengthen the mind, as labour does the body.', 'Seneca'],
  ['True happiness is to enjoy the present, without anxious dependence on the future.', 'Seneca'],
  ['Wherever there is a human being, there is an opportunity for kindness.', 'Seneca'],
  ['It is not what happens to you, but how you respond to it that matters.', 'Epictetus'],
  ['No one is free who is not master of themselves.', 'Epictetus'],
  ['First say to yourself what you would be; then do what you have to do.', 'Epictetus'],
  ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['Make the best use of what is in your power, and take the rest as it happens.', 'Epictetus'],
  ['Wise is the one who does not grieve for what they have not, but rejoices in what they have.', 'Epictetus'],
  ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Be content with what you have; rejoice in the way things are.', 'Lao Tzu'],
  ['Adopt the pace of nature: her secret is patience.', 'Ralph Waldo Emerson'],
  ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
  ['It does not matter how slowly you go, as long as you do not stop.', 'Confucius'],
].map(([text, by]) => ({ text, by }));

export const THOUGHTS = [...OURS, ...CLASSICAL];

export function dayIndex(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - start) / 86_400_000) + d.getFullYear() * 7;
}

// a stable shuffle, so the daily walk interleaves our lines with the classical ones
const ORDER = (() => {
  const idx = THOUGHTS.map((_, i) => i);
  let s = 20261117;
  for (let i = idx.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.map((i) => THOUGHTS[i]);
})();

export function normalizeThoughts(raw) {
  const known = new Set(THOUGHTS.map((t) => t.text));
  const fav = Array.isArray(raw?.fav) ? [...new Set(raw.fav.filter((x) => typeof x === 'string' && known.has(x)))] : [];
  return { fav, only: !!raw?.only && fav.length > 0 };
}

// the thought `offset` steps on from today's, from the starred ones when `only` is on
export function thoughtFor(offset = 0, prefs = { fav: [], only: false }, d = new Date()) {
  const pool = prefs.only && prefs.fav.length ? ORDER.filter((t) => prefs.fav.includes(t.text)) : ORDER;
  const n = pool.length;
  return pool[(((dayIndex(d) + offset) % n) + n) % n];
}
