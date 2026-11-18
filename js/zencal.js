// Zen's calendar: a month under the clock, folded or open (remembered in the Zen layout).
// Days with a reminder due carry a dot; picking a day lists what is due on it, and today or any
// later day takes a quick reminder at a time (it notifies, with the chime, via the notes store's
// alarm). Week start follows the browser's locale where it can be read (Monday in most places).

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

let calSeq = 0;
export function createCalendar({ onToggle, onAdd }) {
  const uid = `zen-cal-${++calSeq}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  let view = today(); view.setDate(1);
  let selected = today();
  let open = true;
  let dueByDay = new Map();

  const label = el('span', { class: 'zen-cal-month' });
  const toggle = el('button', { class: 'zen-cal-toggle', type: 'button', 'aria-expanded': 'true', 'aria-controls': `${uid}-body` },
    icon('calendar', 15), label, el('span', { class: 'zen-cal-chev', 'aria-hidden': 'true' }, icon('chevron', 13)));
  const prev = el('button', { class: 'zen-cal-nav zen-cal-prev', type: 'button', 'aria-label': 'Previous month', title: 'Previous month' }, icon('chevron', 13));
  const next = el('button', { class: 'zen-cal-nav', type: 'button', 'aria-label': 'Next month', title: 'Next month' }, icon('chevron', 13));
  const todayBtn = el('button', { class: 'zen-cal-today', type: 'button', text: 'Today' });
  const grid = el('div', { class: 'zen-cal-grid', role: 'grid', 'aria-label': 'Month' });
  const agendaList = el('div', { class: 'zen-cal-list', 'aria-live': 'polite' });

  // quick reminder for the picked day — built once, so a re-render never wipes what is typed
  const addText = el('input', { class: 'zen-cal-in', type: 'text', placeholder: 'Remind me to…', 'aria-label': 'Reminder', autocomplete: 'off', maxlength: '300' });
  const addTime = el('input', { class: 'zen-cal-tin', type: 'time', 'aria-label': 'Reminder time', step: '300' });
  const addBtn = el('button', { class: 'zen-cal-add', type: 'submit' }, icon('bell', 13), el('span', { text: 'Remind me' }));
  const addHint = el('p', { class: 'zen-cal-hint', 'aria-live': 'polite' });
  const form = el('form', { class: 'zen-cal-form', id: `${uid}-form`, hidden: '' }, addText, el('div', { class: 'zen-cal-form-row' }, addTime, addBtn));
  // the form stays folded behind one small button until it is wanted
  const addOpen = el('button', { class: 'zen-cal-addtoggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': `${uid}-form` },
    icon('bell', 12), el('span', { text: 'Add a reminder' }), el('span', { class: 'zen-cal-addchev', 'aria-hidden': 'true' }, icon('chevron', 11)));
  let formOpen = false;
  const setForm = (open, { focus = true } = {}) => {
    formOpen = open;
    addOpen.setAttribute('aria-expanded', String(open));
    form.hidden = !open;
    if (open && focus) requestAnimationFrame(() => addText.focus({ preventScroll: true }));
  };
  addOpen.addEventListener('click', () => setForm(!formOpen));
  form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setForm(false); addOpen.focus(); } });
  let defaultsFor = '';
  const pad = (n) => String(n).padStart(2, '0');
  const fmtAt = (d) => `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  function setDefaults() {
    const k = dayKey(selected);
    if (defaultsFor === k) return;
    defaultsFor = k;
    addHint.textContent = '';
    addHint.classList.remove('is-error');
    if (selected.getTime() === today().getTime()) {
      const n = new Date(Date.now() + 30 * 60_000);          // half an hour from now, on a 5-minute step
      n.setMinutes(Math.ceil(n.getMinutes() / 5) * 5, 0, 0);
      addTime.value = n.getDate() === selected.getDate() ? `${pad(n.getHours())}:${pad(n.getMinutes())}` : '23:55';
    } else addTime.value = '09:00';
  }
  const hint = (text, error = false) => { addHint.textContent = text; addHint.classList.toggle('is-error', error); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = addText.value.trim();
    if (!text) { hint('Write what to be reminded of.', true); addText.focus(); return; }
    const [h, m] = (addTime.value || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) { hint('Pick a time.', true); addTime.focus(); return; }
    const at = new Date(selected); at.setHours(h, m, 0, 0);
    if (at.getTime() <= Date.now()) { hint('Pick a time later than now.', true); addTime.focus(); return; }
    addBtn.disabled = true;
    try {
      await onAdd?.(text, at);
      addText.value = '';
      hint(`Set for ${fmtAt(at)}: a notification and a chime.`);
      setTimeout(() => { if (!addText.value && document.activeElement !== addText) setForm(false, { focus: false }); }, 2600);   // fold away again once seen
    } catch { hint('Could not save that reminder.', true); }
    finally { addBtn.disabled = false; }
  });
  const agenda = el('div', { class: 'zen-cal-agenda' }, agendaList, addOpen, form, addHint);
  const body = el('div', { class: 'zen-cal-body', id: `${uid}-body` }, grid, agenda);
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
    const past = selected.getTime() < t.getTime();
    addOpen.hidden = past;
    form.hidden = past || !formOpen;
    if (!past) setDefaults();
    agendaList.replaceChildren(
      el('div', { class: 'zen-cal-agenda-h', text: when }),
      ...(due.length
        ? due.map((x) => el('div', { class: `zen-cal-item${x.done ? ' is-done' : ''}` },
          el('span', { class: 'zen-cal-time', text: x.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }),
          el('span', { class: 'zen-cal-what', text: x.text })))
        : [el('div', { class: 'zen-cal-none', text: past ? 'Nothing was due.' : 'Nothing due.' })]));
  }

  // items: the notes store's cards; anything with a reminder time lands on its day
  // items: the notes store's cards (null keeps the ones already known — a fold-only refresh)
  function render(items, isOpen) {
    if (items) dueByDay = new Map();
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
