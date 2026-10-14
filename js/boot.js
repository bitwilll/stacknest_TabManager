// Runs before first paint (a classic script in <head>, ahead of the stylesheet's first render):
// the remembered sidebar mode and theme go on <html> now, so a new tab never paints the full
// sidebar or the light theme and then snaps. app.js owns both settings after this; it re-applies
// them and wires their buttons. Ids must match app.js (THEME_KEY, SIDE_KEY).
try {
  const root = document.documentElement;
  root.dataset.side = localStorage.getItem('stacknest:sidebar') === 'rail' ? 'rail' : 'full';
  const t = localStorage.getItem('stacknest:theme');
  root.dataset.theme = t === 'light' || t === 'dark' || t === 'linen'
    ? t
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch { /* storage blocked: app.js applies the defaults */ }
