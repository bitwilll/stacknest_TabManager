// Boot: mock fallback (dev preview only), theme, view switching, unified search.

const THEME_KEY = 'stacknest:theme';

async function main() {
  if (!globalThis.chrome?.tabs?.query) {
    await import('./mock.js');
  }
  const { initTabs, stashCurrentWindow, saveCurrentWindow } = await import('./tabs.js');
  const { initSpaces } = await import('./spaces.js');
  const { initBookmarks, saveHere } = await import('./bookmarks.js');
  const { addDropTarget } = await import('./ui.js');
  const { ensureWorkspaces } = await import('./spacesStore.js');
  const { initSettings, applySettings, loadSettings } = await import('./settings.js');
  const { initHistory } = await import('./history.js');
  const { initDuplicates } = await import('./duplicates.js');
  const { initTags } = await import('./tags.js');
  const { initNotes } = await import('./notes.js');
  const { initMySpace } = await import('./myspace.js');
  const { initTicker } = await import('./ticker.js');

  // apply saved typography before first paint; guarantee a default space exists
  applySettings(await loadSettings());
  await ensureWorkspaces();

  // — theme: auto (follows the OS, live) · light · dark · any extra theme the HTML declares —
  // Buttons carry data-theme-choice; a theme is a :root[data-theme='<id>'] token block in the CSS.
  const themeBtns = Object.fromEntries([...document.querySelectorAll('[data-theme-choice]')].map((b) => [b.dataset.themeChoice, b]));
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = (choice) => {
    const theme = choice === 'auto' ? (systemDark.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = theme;
    for (const [k, b] of Object.entries(themeBtns)) { b.classList.toggle('is-active', k === choice); b.setAttribute('aria-pressed', String(k === choice)); }
  };
  const themeChoice = () => { const v = localStorage.getItem(THEME_KEY); return Object.hasOwn(themeBtns, v) ? v : 'auto'; };
  applyTheme(themeChoice());
  systemDark.addEventListener('change', () => { if (themeChoice() === 'auto') applyTheme('auto'); });
  // On narrow screens the full four-choice segment would crowd out search. Cycle through
  // the same persisted choices with one explicit, labelled control instead.
  const mobileThemeCycle = document.getElementById('mobile-theme-cycle');
  const updateMobileThemeControl = () => {
    const current = themeChoice();
    const label = current === 'auto' ? 'Follow system theme' : `${current[0].toUpperCase()}${current.slice(1)} theme`;
    mobileThemeCycle.title = `${label}. Change theme`;
    mobileThemeCycle.setAttribute('aria-label', `${label}. Change theme`);
  };
  updateMobileThemeControl();
  for (const [k, b] of Object.entries(themeBtns)) {
    b.addEventListener('click', () => { localStorage.setItem(THEME_KEY, k); applyTheme(k); updateMobileThemeControl(); });
  }
  mobileThemeCycle.addEventListener('click', () => {
    const choices = Object.keys(themeBtns);
    const next = choices[(choices.indexOf(themeChoice()) + 1) % choices.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    updateMobileThemeControl();
  });

  // — sidebar: full, or folded to an icon rail (desktop widths only; remembered per browser) —
  // The rail keeps every view one click away with its count as a badge; the Collections and
  // Windows lists wait behind the expand button (the board and the tab strip carry the same).
  const SIDE_KEY = 'stacknest:sidebar';
  const sidebar = document.getElementById('sidebar');
  const sideBtn = document.getElementById('side-collapse');
  const wide = matchMedia('(min-width: 881px)');   // the rail is desktop-only (newtab.css)
  // In the rail a name shows as a CSS tooltip read from data-tip; a native title would pop a second,
  // slower one over it. A title moves to data-tip when its item is first pointed at or focused (Space
  // rows re-render, so this is lazy) and every parked title moves back when the rail goes away.
  const parkTitle = (e) => {
    if (document.documentElement.dataset.side !== 'rail' || !wide.matches) return;
    const item = e.target.closest?.('[title]');
    if (!item || !sidebar.contains(item)) return;
    item.dataset.tip = item.title;
    item.removeAttribute('title');
  };
  const unparkTitles = () => {
    for (const item of sidebar.querySelectorAll('[data-tip]')) { item.title = item.dataset.tip; delete item.dataset.tip; }
  };
  sidebar.addEventListener('pointerover', parkTitle);
  sidebar.addEventListener('focusin', parkTitle);
  wide.addEventListener('change', () => { if (!wide.matches) unparkTitles(); });   // the drawer shows the words again
  const applySide = (mode) => {
    const rail = mode === 'rail';
    if (!rail) unparkTitles();
    document.documentElement.dataset.side = rail ? 'rail' : 'full';
    const label = rail ? 'Expand sidebar' : 'Collapse sidebar';
    if (rail) { sideBtn.dataset.tip = label; sideBtn.removeAttribute('title'); } else sideBtn.title = label;
    sideBtn.setAttribute('aria-label', label);
    sideBtn.setAttribute('aria-expanded', String(!rail));
  };
  let sideMode = 'full';
  try { sideMode = localStorage.getItem(SIDE_KEY) === 'rail' ? 'rail' : 'full'; } catch { /* storage blocked: start full */ }
  applySide(sideMode);
  sideBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.side === 'rail' ? 'full' : 'rail';
    try { localStorage.setItem(SIDE_KEY, next); } catch { /* not remembered, still applied */ }
    applySide(next);
  });

  // — board layout: columns (kanban) · tiles (full-width rows) · mosaic (masonry of cards) —
  const BOARD_MODE_KEY = 'stacknest:boardmode';
  const boardEl = document.getElementById('board-root');
  const modeBtns = {
    columns: document.getElementById('view-columns'),
    tiles: document.getElementById('view-tiles'),
    mosaic: document.getElementById('view-mosaic'),
  };
  const applyBoardMode = (mode) => {
    if (!Object.hasOwn(modeBtns, mode)) mode = 'columns';   // an unknown stored value falls back
    boardEl.classList.toggle('tiles', mode === 'tiles');
    boardEl.classList.toggle('mosaic', mode === 'mosaic');
    for (const [k, b] of Object.entries(modeBtns)) { b.classList.toggle('is-active', k === mode); b.setAttribute('aria-pressed', String(k === mode)); }
  };
  applyBoardMode(localStorage.getItem(BOARD_MODE_KEY) || 'columns');
  for (const [k, b] of Object.entries(modeBtns)) {
    b.addEventListener('click', () => { localStorage.setItem(BOARD_MODE_KEY, k); applyBoardMode(k); });
  }

  // — views (Collections board / Library) —
  const views = {
    board: { el: document.getElementById('view-board'), title: 'Collections', kicker: 'Saved tabs' },
    myspace: { el: document.getElementById('view-myspace'), title: 'My Space', kicker: 'Out of Chrome' },
    vault: { el: document.getElementById('view-vault'), title: 'Vault', kicker: 'Behind a PIN' },
    library: { el: document.getElementById('view-library'), title: 'Library', kicker: 'Chrome bookmarks' },
    tags: { el: document.getElementById('view-tags'), title: 'Tags', kicker: 'Organize' },
    duplicates: { el: document.getElementById('view-duplicates'), title: 'Duplicates', kicker: 'Clean up' },
    notes: { el: document.getElementById('view-notes'), title: 'Notes & Todos', kicker: 'Scratchpad' },
    settings: { el: document.getElementById('view-settings'), title: 'Settings', kicker: 'Preferences' },
  };
  const viewTitle = document.getElementById('view-title');
  const viewKicker = document.getElementById('view-kicker');
  let currentView = 'board';
  const showView = (name) => {
    if (!views[name]) return;
    currentView = name;
    for (const [key, v] of Object.entries(views)) v.el.hidden = key !== name;
    viewTitle.textContent = views[name].title;
    viewKicker.textContent = views[name].kicker;
    // Which view is open is a root-level fact, so the stylesheet can decide what belongs
    // on screen (the horizontal tab strip is board-only). Doing this in
    // CSS rather than inline styles lets the "Open tabs bar" setting override it without
    // the two mechanisms fighting over `style.display`.
    document.documentElement.dataset.view = name;
    refreshView(name); // show current data when a view is opened
    document.querySelectorAll('.view-link').forEach((btn) => {
      const active = btn.dataset.view === name;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    // #view deep-links (e.g. the reminder notification opens newtab.html#notes)
    try { history.replaceState(null, '', name === 'board' ? location.pathname : `#${name}`); } catch { /* not navigable */ }
    closeDrawer();
  };
  document.querySelectorAll('.view-link').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // — narrow screens: the sidebar becomes a drawer behind a menu button —
  // While it is open everything behind it is inert, focus lands on the active view row, and
  // closing hands focus back to the menu button.
  const app = document.querySelector('.app');
  const narrow = matchMedia('(max-width: 880px)');
  const drawerBtn = document.getElementById('drawer-btn');
  const setDrawer = (open) => {
    const was = app.classList.contains('drawer-open');
    app.classList.toggle('drawer-open', open);
    drawerBtn.setAttribute('aria-expanded', String(open));
    // everything beside the sidebar goes inert, not just .main: in Vertical mode the tab rail
    // (#tabs-bar) is a sibling of .main, and its chips must not be reachable behind the scrim
    for (const n of app.children) if (n.id !== 'sidebar') n.inert = open && narrow.matches;
    if (open && !was) requestAnimationFrame(() => document.querySelector('#sidebar .view-link.is-active')?.focus());
    if (!open && was && document.getElementById('sidebar').contains(document.activeElement)) drawerBtn.focus();
  };
  function closeDrawer() { setDrawer(false); }
  drawerBtn.addEventListener('click', () => setDrawer(!app.classList.contains('drawer-open')));
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && app.classList.contains('drawer-open')) closeDrawer(); });
  // widening past the drawer breakpoint with it open must not leave the panel inert
  narrow.addEventListener('change', () => {
    for (const n of app.children) if (n.id !== 'sidebar') n.inert = app.classList.contains('drawer-open') && narrow.matches;
  });

  // — columns —
  const search = document.getElementById('search');
  const getQuery = () => search.value.trim();

  const tabsCol = initTabs({
    trayRoot: document.getElementById('tray-root'),
    trayCount: document.getElementById('tray-count'),
    windowsRoot: document.getElementById('windows-root'),
    getQuery,
  });
  const spacesCol = initSpaces({
    boardRoot: document.getElementById('board-root'),
    navRoot: document.getElementById('collections-nav'),
    wsRoot: document.getElementById('spaces-nav'),
    navCount: document.getElementById('nav-collections-count'),
    boardState: document.getElementById('board-state'),
    collectionsScope: document.getElementById('collections-scope'),
    getQuery,
    ensureBoardVisible: () => showView('board'),
    clearSearch: () => { search.value = ''; renderAll(); },
  });
  const bmCol = initBookmarks({
    root: document.getElementById('bookmarks-root'),
    getQuery,
  });
  initSettings({ root: document.getElementById('settings-root') });
  initHistory({ root: document.getElementById('undo-bar') });
  const dupCol = initDuplicates({
    root: document.getElementById('duplicates-root'),
    getQuery,
    countEl: document.getElementById('nav-duplicates-count'),
  });
  const tagsCol = initTags({
    root: document.getElementById('tags-root'),
    getQuery,
    countEl: document.getElementById('nav-tags-count'),
  });
  const notesCol = initNotes({
    root: document.getElementById('notes-root'),
    getQuery,
    countEl: document.getElementById('nav-notes-count'),
  });
  const spaceCol = initMySpace({
    spaceRoot: document.getElementById('myspace-root'),
    vaultRoot: document.getElementById('vault-root'),
    spaceCountEl: document.getElementById('nav-myspace-count'),
    vaultCountEl: document.getElementById('nav-vault-count'),
    getQuery,
  });
  const ticker = initTicker({ root: document.getElementById('ticker') });

  // re-render whichever view is being opened, so it reflects the latest data
  function refreshView(name) {
    if (name === 'board') spacesCol.render();
    else if (name === 'library') bmCol.render();
    else if (name === 'tags') tagsCol.render();
    else if (name === 'duplicates') dupCol.render();
    else if (name === 'notes') notesCol.render();
    else if (name === 'myspace' || name === 'vault') spaceCol.render();
  }

  // open on the view named in the hash, if any (notification click → #notes)
  const wanted = location.hash.slice(1);
  if (views[wanted] && wanted !== 'board') showView(wanted);
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1) || 'board'; if (views[v] && v !== currentView) showView(v); });

  // top-bar window actions (Save window, Stash & close, the narrow-screen stash) + sidebar caption actions
  document.getElementById('stash-window-btn').addEventListener('click', stashCurrentWindow);
  document.getElementById('mobile-stash-window-btn').addEventListener('click', stashCurrentWindow);
  document.getElementById('save-all-btn').addEventListener('click', saveCurrentWindow);
  document.getElementById('new-collection-btn').addEventListener('click', () => {
    showView('board');
    spacesCol.createEmpty();
  });
  document.getElementById('export-all-btn').addEventListener('click', () => spacesCol.exportAll());
  document.getElementById('new-space-btn').addEventListener('click', () => spacesCol.newWorkspace());
  // the board head: its one primary and the export circle (same handlers as the sidebar's)
  document.getElementById('board-new-btn').addEventListener('click', () => spacesCol.createEmpty());
  document.getElementById('board-export-btn').addEventListener('click', () => spacesCol.exportAll());

  // after a backup import, re-apply typography and re-render everything
  document.addEventListener('stacknest:imported', async () => {
    applySettings(await loadSettings());
    renderAll();
  });

  /* ——— where the open-tabs bar lives ———
     Horizontal keeps it in .main under the header. Vertical moves the same element out
     to sit between the sidebar and .main, so it reads as a rail of its own rather than a
     panel folded into the sidebar. Moving one node beats shipping two copies of the
     markup: the ids, the listeners and the render path all stay single. */
  const tabsBar = document.getElementById('tabs-bar');
  const appEl = document.querySelector('.app');
  const mainEl = document.querySelector('.main');
  const mountTabsBar = (mode) => {
    const wantParent = mode === 'side' ? appEl : mainEl;
    const wantBefore = mode === 'side' ? mainEl : mainEl.querySelector('.view');
    if (tabsBar.parentElement === wantParent && tabsBar.nextElementSibling === wantBefore) return;
    wantParent.insertBefore(tabsBar, wantBefore);
  };
  mountTabsBar(document.documentElement.dataset.tabsbar);
  document.addEventListener('stacknest:tabsbar', (e) => {
    mountTabsBar(e.detail);
    tabsCol.render(); // the chips are built per mode, so the new home gets fresh ones
  });

  // dropping an open tab on the Library nav item bookmarks it in the open folder
  addDropTarget(document.getElementById('nav-library'), 'text/x-stacknest-tab', async ({ title, url }) => {
    if (url) await saveHere({ title, url });
  });

  // — unified search —
  const searchBox = search.closest('.searchbox');
  const clearBtn = document.getElementById('search-clear');
  const renderAll = () => {
    searchBox.classList.toggle('has-query', !!search.value);
    tabsCol.render(); spacesCol.render(); bmCol.render(); dupCol.render(); tagsCol.render(); notesCol.render(); spaceCol.render();
  };
  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderAll, 90);
  });
  const clearSearch = () => { search.value = ''; renderAll(); };
  clearBtn.addEventListener('click', () => { clearSearch(); search.focus(); });

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
      search.blur();
    }
    if (e.key === 'Enter') {
      // Only offer a live tab if the bar is actually on screen. The horizontal strip is
      // board-only, so off the board its chips are still in the DOM but invisible — Enter
      // would have jumped to a tab the user could not see instead of the first result in
      // the view they were looking at. offsetParent is null under any display:none ancestor.
      const barShowing = !!tabsBar.offsetParent;
      const first = (barShowing && document.querySelector('.tray-chips .chip-tab:not(.filtered)'))
        || document.querySelector(`#view-${currentView} .tcard:not(.filtered)`)
        || document.querySelector('.board .tcard:not(.filtered)');
      first?.click();
    }
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea)$/i.test(document.activeElement?.tagName || '')
      || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  });
}

main();
