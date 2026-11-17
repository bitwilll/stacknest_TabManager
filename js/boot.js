// Runs before first paint (a classic script in <head>, ahead of the stylesheet's first render):
// the remembered sidebar mode and theme go on <html> now, so a new tab never paints the full
// sidebar or the light theme and then snaps — and a tab opened in Zen never flashes the board. app.js owns both settings after this; it re-applies
// them and wires their buttons. Ids must match app.js (THEME_KEY, SIDE_KEY).
try {
  const root = document.documentElement;
  root.dataset.side = localStorage.getItem('stacknest:sidebar') === 'rail' ? 'rail' : 'full';
  const t = localStorage.getItem('stacknest:theme');
  root.dataset.theme = t === 'light' || t === 'dark' || t === 'linen'
    ? t
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.zen = localStorage.getItem('stacknest:zen') === 'on' ? 'on' : 'off';   // ZEN_KEY in zen.js
  // the wallpaper behind the board (WALL_HINT / WALL_CSS in wallboard.js, which corrects it after)
  root.dataset.wall = localStorage.getItem('stacknest:wall') === 'on' ? 'on' : 'off';
  const wallCss = root.dataset.wall === 'on' && localStorage.getItem('stacknest:wallcss');
  if (wallCss) root.style.setProperty('--board-wall', wallCss);

  // Settings → New tab off: this page was opened as a new tab, so hand the tab to Chrome's own
  // new tab page. StackNest itself is opened from the toolbar (or a notification) with a query
  // or hash on the URL, which is how a plain new tab is told apart. Nothing paints meanwhile;
  // if Chrome refuses the hand-over, the page simply shows. NTP_KEY in settings.js.
  if (localStorage.getItem('stacknest:ntp') === 'off' && !location.search && !location.hash
      && location.protocol === 'chrome-extension:' && globalThis.chrome?.tabs?.getCurrent) {
    root.dataset.ntp = 'away';
    const stay = () => { delete root.dataset.ntp; };
    chrome.tabs.getCurrent((tab) => {
      if (chrome.runtime.lastError || !tab?.id) { stay(); return; }
      chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' }, () => { if (chrome.runtime.lastError) stay(); });
    });
    setTimeout(stay, 1500);   // never leave a blank tab behind
  }
} catch { /* storage blocked: app.js applies the defaults */ }
