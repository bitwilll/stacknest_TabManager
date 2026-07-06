// Live tabs: the open-tabs tray (current window) + the WINDOWS sidebar section.

import { el, icon, toast, tile, debounce, matches, actionBtn } from './ui.js';
import { addSpace } from './spacesStore.js';

const TAB_MIME = 'text/x-stacknest-tab';

let trayRoot, trayCount, windowsRoot, getQuery;
const expandedWindows = new Set(); // windowIds whose tab list is open in the sidebar

export function initTabs(options) {
  ({ trayRoot, trayCount, windowsRoot, getQuery } = options);

  const rerender = debounce(render, 120);
  for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onActivated', 'onAttached', 'onDetached', 'onReplaced']) {
    chrome.tabs[ev]?.addListener(rerender);
  }
  for (const ev of ['onCreated', 'onRemoved', 'onFocusChanged']) {
    chrome.windows?.[ev]?.addListener(rerender);
  }

  render();
  return { render };
}

function isOwnPage(tab) {
  const url = tab.url || tab.pendingUrl || '';
  if (url.startsWith('chrome://newtab')) return true;
  try { return chrome.runtime?.id && url.startsWith(chrome.runtime.getURL('')); }
  catch { return false; }
}

async function windowMap() {
  const [allTabs, wins] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows?.getAll ? chrome.windows.getAll() : Promise.resolve([]),
  ]);
  const tabs = allTabs.filter((t) => !isOwnPage(t));
  const byWindow = new Map();
  for (const t of tabs) {
    if (!byWindow.has(t.windowId)) byWindow.set(t.windowId, []);
    byWindow.get(t.windowId).push(t);
  }
  for (const list of byWindow.values()) list.sort((a, b) => a.index - b.index);
  const focusedId = wins.find((w) => w.focused)?.id ?? [...byWindow.keys()][0];
  return { byWindow, focusedId };
}

export async function render() {
  const q = getQuery();
  const { byWindow, focusedId } = await windowMap();

  // ——— tray: the focused window's tabs as chips ———
  const current = byWindow.get(focusedId) || [];
  trayCount.textContent = `${current.length} open tab${current.length === 1 ? '' : 's'}`;

  const chips = current.map((t) => chip(t, q));
  trayRoot.replaceChildren(...chips);
  if (!current.length) {
    trayRoot.append(el('span', { class: 'tray-empty', style: 'font: 500 12px var(--grot); color: var(--text-mut)', text: 'Nothing else open in this window.' }));
  }

  // ——— sidebar WINDOWS section (collapsible per window) ———
  const ids = [...byWindow.keys()].sort((a, b) => (a === focusedId ? -1 : b === focusedId ? 1 : a - b));
  const blocks = ids.map((wid, i) => windowBlock(wid, byWindow.get(wid), i + 1, wid === focusedId, q));
  windowsRoot.replaceChildren(...blocks);
  if (!ids.length) {
    windowsRoot.append(el('div', { class: 'navx', style: 'cursor: default; color: var(--text-mut)', text: 'No other windows' }));
  }
}

function chip(tab, q) {
  const url = tab.url || tab.pendingUrl || '';
  const node = el('div', {
    class: `tcard chip-tab ${tab.active ? 'is-active' : ''}`,
    draggable: 'true',
    role: 'button',
    tabindex: '0',
    title: url,
  });
  if (q && !matches(q, tab.title, url)) node.classList.add('filtered');

  node.append(
    tile(url, 20),
    el('span', { class: 'title', text: tab.title || url || 'Untitled' }),
    actionBtn('close', 'Close tab', async () => {
      node.remove();
      await chrome.tabs.remove(tab.id);
    }, 'danger acts'),
  );

  const activate = async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows?.update?.(tab.windowId, { focused: true });
  };
  node.addEventListener('click', activate);
  node.addEventListener('keydown', (e) => { if (e.key === 'Enter') activate(); });

  node.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData(TAB_MIME, JSON.stringify({ tabId: tab.id, title: tab.title || url, url }));
    e.dataTransfer.effectAllowed = 'copyMove';
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
  return node;
}

function windowBlock(windowId, tabs, n, isCurrent, q) {
  const label = isCurrent ? 'This window' : `Window ${n}`;
  const hasMatch = q && tabs.some((t) => matches(q, t.title, t.url || t.pendingUrl));
  const isOpen = expandedWindows.has(windowId) || hasMatch; // searching peeks into windows

  const block = el('div', { class: 'win-block' });
  const row = el('div', {
    class: `navx win-row ${isOpen ? 'is-open' : ''}`,
    role: 'button',
    tabindex: '0',
    'aria-expanded': String(isOpen),
    title: isOpen ? 'Hide tabs' : 'Show tabs in this window',
  });
  const toggle = () => {
    if (expandedWindows.has(windowId)) expandedWindows.delete(windowId);
    else expandedWindows.add(windowId);
    render();
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (e) => { if (e.key === 'Enter') toggle(); });

  row.append(
    el('span', { class: 'win-chev', 'aria-hidden': 'true' }, icon('chevron', 12)),
    el('span', { class: 'nav-sq', style: `background: ${isCurrent ? 'var(--green)' : 'var(--text-ghost)'}` }),
    el('span', { class: 'nav-label', text: label }),
    el('span', { class: 'nav-n', text: String(tabs.length) }),
    el('span', { class: 'nav-acts' },
      isCurrent ? null : actionBtn('window', 'Open — switch to this window', async () => {
        await chrome.windows?.update?.(windowId, { focused: true });
        render();
      }),
      actionBtn('save', 'Save window to a collection (keeps tabs open)', () => saveWindow(tabs, label, false)),
      actionBtn('archive', 'Stash: save to a collection and close tabs (frees memory)', () => saveWindow(tabs, label, true), 'danger'),
    ),
  );
  block.append(row);

  if (isOpen) {
    block.append(el('div', { class: 'win-tabs' }, ...tabs.map((t) => winTabRow(t, q))));
  }
  return block;
}

function winTabRow(tab, q) {
  const url = tab.url || tab.pendingUrl || '';
  const row = el('div', { class: 'win-tab', draggable: 'true', role: 'button', tabindex: '0', title: url });
  if (q && !matches(q, tab.title, url)) row.classList.add('filtered');

  row.append(
    tile(url, 18),
    el('span', { class: 'title', text: tab.title || url || 'Untitled' }),
    actionBtn('close', 'Close tab', async () => {
      row.remove();
      await chrome.tabs.remove(tab.id);
    }, 'danger'),
  );

  const activate = async (e) => {
    e.stopPropagation();
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows?.update?.(tab.windowId, { focused: true });
  };
  row.addEventListener('click', activate);
  row.addEventListener('keydown', (e) => { if (e.key === 'Enter') activate(e); });

  row.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData(TAB_MIME, JSON.stringify({ tabId: tab.id, title: tab.title || url, url }));
    e.dataTransfer.effectAllowed = 'copyMove';
    row.classList.add('dragging');
  });
  row.addEventListener('dragend', () => row.classList.remove('dragging'));
  return row;
}

async function saveWindow(tabs, label, stash) {
  const saved = tabs
    .map((t) => ({ title: t.title || t.url || t.pendingUrl, url: t.url || t.pendingUrl }))
    .filter((t) => t.url);
  if (!saved.length) { toast('No tabs to save here'); return; }

  const date = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  await addSpace(`${label} · ${date}`, saved);

  if (stash) {
    await chrome.tabs.remove(tabs.map((t) => t.id));
    toast(`Stashed ${saved.length} tab${saved.length === 1 ? '' : 's'} — memory freed`);
  } else {
    toast(`Saved ${saved.length} tab${saved.length === 1 ? '' : 's'} to a collection`);
  }
}

async function currentWindowTabs() {
  const { byWindow, focusedId } = await windowMap();
  return byWindow.get(focusedId) || [];
}

export async function saveCurrentWindow() {
  await saveWindow(await currentWindowTabs(), 'This window', false);
}

export async function stashCurrentWindow() {
  await saveWindow(await currentWindowTabs(), 'This window', true);
}
