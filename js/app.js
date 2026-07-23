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
  const { initTicker } = await import('./ticker.js');

  // apply saved typography before first paint; guarantee a default space exists
  applySettings(await loadSettings());
  await ensureWorkspaces();

  // — theme —
  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    lightBtn.classList.toggle('is-active', theme === 'light');
    darkBtn.classList.toggle('is-active', theme === 'dark');
  };
  applyTheme(localStorage.getItem(THEME_KEY)
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  lightBtn.addEventListener('click', () => { localStorage.setItem(THEME_KEY, 'light'); applyTheme('light'); });
  darkBtn.addEventListener('click', () => { localStorage.setItem(THEME_KEY, 'dark'); applyTheme('dark'); });

  // — board layout (columns / tiles) —
  const BOARD_MODE_KEY = 'stacknest:boardmode';
  const boardEl = document.getElementById('board-root');
  const colBtn = document.getElementById('view-columns');
  const tileBtn = document.getElementById('view-tiles');
  const viewmodeSeg = document.getElementById('viewmode-seg');
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
    library: { el: document.getElementById('view-library'), title: 'Library' },
    tags: { el: document.getElementById('view-tags'), title: 'Tags' },
    duplicates: { el: document.getElementById('view-duplicates'), title: 'Duplicates' },
    notes: { el: document.getElementById('view-notes'), title: 'Notes & Todos' },
    settings: { el: document.getElementById('view-settings'), title: 'Settings' },
  };
  const viewTitle = document.getElementById('view-title');
  const tray = document.querySelector('.tray');
  let currentView = 'board';
  const showView = (name) => {
    if (!views[name]) return;
    currentView = name;
    for (const [key, v] of Object.entries(views)) v.el.hidden = key !== name;
    viewTitle.textContent = views[name].title;
    tray.style.display = name === 'board' ? '' : 'none'; // the open-tabs tray only matters on the board
    viewmodeSeg.style.display = name === 'board' ? '' : 'none'; // the layout toggle only applies to the board
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
    statsEl: document.getElementById('side-stats'),
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
  const ticker = initTicker({ root: document.getElementById('ticker') });

  // re-render whichever view is being opened, so it reflects the latest data
  function refreshView(name) {
    if (name === 'board') spacesCol.render();
    else if (name === 'library') bmCol.render();
    else if (name === 'tags') tagsCol.render();
    else if (name === 'duplicates') dupCol.render();
    else if (name === 'notes') notesCol.render();
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

  // dropping an open tab on the Library nav item bookmarks it in the open folder
  addDropTarget(document.getElementById('nav-library'), 'text/x-stacknest-tab', async ({ title, url }) => {
    if (url) await saveHere({ title, url });
  });

  // — unified search —
  const renderAll = () => { tabsCol.render(); spacesCol.render(); bmCol.render(); dupCol.render(); tagsCol.render(); notesCol.render(); };
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
      const first = document.querySelector('.tray-chips .chip-tab:not(.filtered)')
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
