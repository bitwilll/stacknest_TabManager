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

  // — theme: one button that flips, showing the icon for the theme it will switch TO —
  const themeBtn = document.getElementById('theme-toggle');
  let theme;
  const applyTheme = (next) => {
    theme = next;
    document.documentElement.dataset.theme = next;
    themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
    const to = next === 'dark' ? 'light' : 'dark';
    themeBtn.title = `Switch to ${to} theme`;
    themeBtn.setAttribute('aria-label', `Switch to ${to} theme`);
  };
  applyTheme(localStorage.getItem(THEME_KEY)
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  themeBtn.addEventListener('click', () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // — board layout (columns / tiles) —
  const BOARD_MODE_KEY = 'stacknest:boardmode';
  const boardEl = document.getElementById('board-root');
  const colBtn = document.getElementById('view-columns');
  const tileBtn = document.getElementById('view-tiles');
  const applyBoardMode = (mode) => {
    const tiles = mode === 'tiles';
    boardEl.classList.toggle('tiles', tiles);
    colBtn.classList.toggle('is-active', !tiles);
    tileBtn.classList.toggle('is-active', tiles);
  };
  applyBoardMode(localStorage.getItem(BOARD_MODE_KEY) || 'columns');
  colBtn.addEventListener('click', () => { localStorage.setItem(BOARD_MODE_KEY, 'columns'); applyBoardMode('columns'); });
  tileBtn.addEventListener('click', () => { localStorage.setItem(BOARD_MODE_KEY, 'tiles'); applyBoardMode('tiles'); });

  // — views (Collections board / Library) —
  const views = {
    board: { el: document.getElementById('view-board'), title: 'Collections' },
    myspace: { el: document.getElementById('view-myspace'), title: 'My Space' },
    vault: { el: document.getElementById('view-vault'), title: 'Vault' },
    library: { el: document.getElementById('view-library'), title: 'Library' },
    tags: { el: document.getElementById('view-tags'), title: 'Tags' },
    duplicates: { el: document.getElementById('view-duplicates'), title: 'Duplicates' },
    notes: { el: document.getElementById('view-notes'), title: 'Notes & Todos' },
    settings: { el: document.getElementById('view-settings'), title: 'Settings' },
  };
  const viewTitle = document.getElementById('view-title');
  let currentView = 'board';
  const showView = (name) => {
    if (!views[name]) return;
    currentView = name;
    for (const [key, v] of Object.entries(views)) v.el.hidden = key !== name;
    viewTitle.textContent = views[name].title;
    // Which view is open is a root-level fact, so the stylesheet can decide what belongs
    // on screen (the tab strip and the board-layout toggle are board-only). Doing this in
    // CSS rather than inline styles lets the "Open tabs bar" setting override it without
    // the two mechanisms fighting over `style.display`.
    document.documentElement.dataset.view = name;
    refreshView(name); // show current data when a view is opened
    document.querySelectorAll('.view-link').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === name);
    });
  };
  document.querySelectorAll('.view-link').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
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

  // topbar + tray actions
  document.getElementById('stash-window-btn').addEventListener('click', stashCurrentWindow);
  document.getElementById('save-all-btn').addEventListener('click', saveCurrentWindow);
  document.getElementById('new-collection-btn').addEventListener('click', () => {
    showView('board');
    spacesCol.createEmpty();
  });
  document.getElementById('export-all-btn').addEventListener('click', () => spacesCol.exportAll());
  document.getElementById('new-space-btn').addEventListener('click', () => spacesCol.newWorkspace());

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
  const renderAll = () => { tabsCol.render(); spacesCol.render(); bmCol.render(); dupCol.render(); tagsCol.render(); notesCol.render(); spaceCol.render(); };
  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderAll, 90);
  });

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      renderAll();
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
