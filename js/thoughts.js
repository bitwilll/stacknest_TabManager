// The thought at the top of the Zen page: one a day (the same one all day, in every tab),
// with a button for another. Written for StackNest, so there is nothing to attribute.

export const THOUGHTS = [
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
  'Learn something small, then share it.',
  'Good work is mostly showing up, many times.',
  'Let go of what you cannot hold; carry what you can.',
  'Clarity comes from doing, not from waiting.',
  'Every closed tab is a little more room to think.',
  'Water carves stone by staying, not by force.',
  'Leave things a little better than you found them.',
  'Pause before you rush. The rush will keep.',
  'Grateful for this moment, ready for the next.',
];

export function dayIndex(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - start) / 86_400_000) + d.getFullYear() * 7;
}

export const thoughtFor = (offset = 0, d = new Date()) => THOUGHTS[(((dayIndex(d) + offset) % THOUGHTS.length) + THOUGHTS.length) % THOUGHTS.length];
