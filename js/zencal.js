// Zen's calendar: a month under the clock, folded or open (remembered in the Zen layout).
// Days with a reminder due carry a dot; picking a day lists what is due on it. Week start
// follows the browser's locale where it can be read (Monday in most of the world).

import { el, icon } from './ui.js';

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function firstDayOfWeek() {
  try {
    const loc = new Intl.Locale(navigator.language || 'en-US');
    const info = loc.getWeekInfo?.() || loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;   // 1 = Monday … 7 = Sunday → 0
  } catch { /* old engine */ }
  return 0;
}

export function createCalendar({ onToggle }) {
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  let view = today(); view.setDate(1);
  let selected = today();
  let open = true;
  let dueByDay = new Map();

  const label = el('span', { class: 'zen-cal-month' });
  const toggle = el('button', { class: 'zen-cal-toggle', type: 'button', 'aria-expanded': 'true', 'aria-controls': 'zen-cal-body' },
    icon('calendar', 15), label, el('span', { class: 'zen-cal-chev', 'aria-hidden': 'true' }, icon('chevron', 13)));
  const prev = el('button', { class: 'zen-cal-nav zen-cal-prev', type: 'button', 'aria-label': 'Previous month', title: 'Previous month' }, icon('chevron', 13));
  const next = el('button', { class: 'zen-cal-nav', type: 'button', 'aria-label': 'Next month', title: 'Next month' }, icon('chevron', 13));
  const todayBtn = el('button', { class: 'zen-cal-today', type: 'button', text: 'Today' });
  const grid = el('div', { class: 'zen-cal-grid', role: 'grid', 'aria-label': 'Month' });
  const agenda = el('div', { class: 'zen-cal-agenda', 'aria-live': 'polite' });
  const body = el('div', { class: 'zen-cal-body', id: 'zen-cal-body' }, grid, agenda);
  const node = el('section', { class: 'zen-cal', 'aria-label': 'Calendar' },
    el('header', { class: 'zen-cal-head' }, toggle, el('span', { class: 'zen-cal-navs' }, todayBtn, prev, next)), body);

  toggle.addEventListener('click', () => { setOpen(!open); onToggle?.(open); });
  prev.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); draw(); });
  next.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); draw(); });
  todayBtn.addEventListener('click', () => { selected = today(); view = today(); view.setDate(1); draw(); });

  function setOpen(v) {
    open = !!v;
    node.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  }

  function draw() {
    label.textContent = view.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const t = today();
    todayBtn.hidden = view.getFullYear() === t.getFullYear() && view.getMonth() === t.getMonth() && selected.getTime() === t.getTime();

    const first = firstDayOfWeek();
    const start = new Date(view);
    start.setDate(1 - ((view.getDay() - first + 7) % 7));
    const heads = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      heads.push(el('span', { class: 'zen-cal-wd', role: 'columnheader', 'aria-label': d.toLocaleDateString([], { weekday: 'long' }),
        text: d.toLocaleDateString([], { weekday: 'narrow' }) }));
    }
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (i === 35 && d.getMonth() !== view.getMonth()) break;   // five rows when the month fits
      const due = dueByDay.get(dayKey(d)) || [];
      const isToday = d.getTime() === t.getTime();
      const isSel = d.getTime() === selected.getTime();
      const cls = ['zen-cal-day', d.getMonth() !== view.getMonth() && 'is-out', isToday && 'is-today', isSel && 'is-sel', due.length && 'has-due'].filter(Boolean).join(' ');
      const b = el('button', { class: cls, type: 'button', role: 'gridcell', 'aria-selected': String(isSel),
        'aria-label': `${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${due.length ? `, ${due.length} due` : ''}${isToday ? ', today' : ''}`,
        text: String(d.getDate()) });
      b.addEventListener('click', () => {
        selected = new Date(d);
        if (d.getMonth() !== view.getMonth()) { view = new Date(d); view.setDate(1); }
        draw();
      });
      cells.push(b);
    }
    grid.replaceChildren(...heads, ...cells);

    const due = dueByDay.get(dayKey(selected)) || [];
    const when = selected.getTime() === t.getTime() ? 'Today' : selected.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    agenda.replaceChildren(
      el('div', { class: 'zen-cal-agenda-h', text: when }),
      ...(due.length
        ? due.map((x) => el('div', { class: `zen-cal-item${x.done ? ' is-done' : ''}` },
          el('span', { class: 'zen-cal-time', text: x.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }),
          el('span', { class: 'zen-cal-what', text: x.text })))
        : [el('div', { class: 'zen-cal-none', text: 'Nothing due.' })]));
  }

  // items: the notes store's cards; anything with a reminder time lands on its day
  function render(items, isOpen) {
    dueByDay = new Map();
    for (const it of items || []) {
      if (!it?.reminder?.at) continue;
      const at = new Date(it.reminder.at);
      if (Number.isNaN(at.getTime())) continue;
      const done = it.kind === 'todo' ? (it.list || []).length > 0 && it.list.every((r) => r.done) : !!it.done;
      const k = dayKey(at);
      if (!dueByDay.has(k)) dueByDay.set(k, []);
      dueByDay.get(k).push({ at, done, text: it.kind === 'todo' ? (it.title || 'Checklist') : (it.text || it.title || 'Reminder') });
    }
    for (const list of dueByDay.values()) list.sort((a, b) => a.at - b.at);
    if (typeof isOpen === 'boolean') setOpen(isOpen);
    draw();
  }

  setOpen(true);
  return { node, render };
}
