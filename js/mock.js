// Dev-only shim: fakes the chrome.* APIs with in-memory data so the page can be
// designed and tested outside Chrome. Never active inside the real extension.

const listeners = () => {
  const set = new Set();
  return { addListener: (cb) => set.add(cb), removeListener: (cb) => set.delete(cb), _fire: (...a) => set.forEach((cb) => cb(...a)) };
};

let nextId = 100;
let windowSeq = 3;

const windowMeta = {
  1: { id: 1, focused: true, type: 'normal' },
  2: { id: 2, focused: false, type: 'normal' },
};

const groups = [
  { id: 1, title: 'research', color: 'blue', windowId: 1 },
  { id: 2, title: 'side project', color: 'orange', windowId: 1 },
];
const tabs = [
  { id: 11, windowId: 1, index: 0, title: 'Understanding OKLCH color — evilmartians.com', url: 'https://evilmartians.com/chronicles/oklch-in-css', groupId: 1, active: false, pinned: true, audible: false },
  { id: 12, windowId: 1, index: 1, title: 'CSS color-mix() — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix', groupId: 1, active: false, pinned: false, audible: false },
  { id: 13, windowId: 1, index: 2, title: 'Schibsted Grotesk typeface specimen', url: 'https://fonts.google.com/specimen/Schibsted+Grotesk', groupId: 1, active: false, pinned: false, audible: false },
  { id: 14, windowId: 1, index: 3, title: 'chrome.tabGroups API reference', url: 'https://developer.chrome.com/docs/extensions/reference/api/tabGroups', groupId: 2, active: false, pinned: false, audible: false },
  { id: 15, windowId: 1, index: 4, title: 'Manifest V3 migration guide', url: 'https://developer.chrome.com/docs/extensions/develop/migrate', groupId: 2, active: false, pinned: false, audible: false },
  { id: 16, windowId: 1, index: 5, title: 'lofi beats to debug to — YouTube', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', groupId: -1, active: true, pinned: false, audible: true },
  { id: 17, windowId: 1, index: 6, title: 'Hacker News', url: 'https://news.ycombinator.com', groupId: -1, active: false, pinned: false, audible: false },
  { id: 18, windowId: 2, index: 0, title: 'Weeknight dan dan noodles — NYT Cooking', url: 'https://cooking.nytimes.com/recipes/1021339-dan-dan-noodles', groupId: -1, active: false, pinned: false, audible: false },
  { id: 19, windowId: 2, index: 1, title: 'The Home Cook — Recipes', url: 'https://www.seriouseats.com', groupId: -1, active: false, pinned: false, audible: false },
];

const bm = {
  0: { id: '0', title: '', children: ['1', '2'] },
  1: { id: '1', parentId: '0', title: 'Bookmarks Bar', children: ['20', '21', '30', '31', '32'] },
  2: { id: '2', parentId: '0', title: 'Other Bookmarks', children: [] },
  20: { id: '20', parentId: '1', title: 'Reading list', children: ['22', '23'] },
  21: { id: '21', parentId: '1', title: 'Recipes', children: ['24'] },
  22: { id: '22', parentId: '20', title: 'How to do great work — Paul Graham', url: 'http://paulgraham.com/greatwork.html' },
  23: { id: '23', parentId: '20', title: 'The Grug Brained Developer', url: 'https://grugbrain.dev' },
  24: { id: '24', parentId: '21', title: 'Marcella Hazan tomato sauce', url: 'https://cooking.nytimes.com/recipes/1015178' },
  30: { id: '30', parentId: '1', title: 'Figma', url: 'https://figma.com' },
  31: { id: '31', parentId: '1', title: 'Linear', url: 'https://linear.app' },
  32: { id: '32', parentId: '1', title: 'Are.na', url: 'https://are.na' },
};

const storageData = {
  'stacknest:workspaces': [
    { id: 'ws-personal', name: 'Personal', color: '#5b52ec' },
    { id: 'ws-work', name: 'Work', color: '#22c55e' },
  ],
  'stacknest:activeWorkspace': 'ws-personal',
  'stacknest:settings': { fontUi: 'hanken', fontMono: 'jetbrains', scale: 'default' },
  'stacknest:tags': {
    'https://refactoringui.com': { url: 'https://refactoringui.com', title: 'Refactoring UI', tags: ['design', 'reference'] },
    'https://typescale.com': { url: 'https://typescale.com', title: 'Type Scale', tags: ['design', 'typography'] },
    'https://cubic-bezier.com': { url: 'https://cubic-bezier.com', title: 'cubic-bezier.com', tags: ['design', 'animation'] },
    'https://grugbrain.dev': { url: 'https://grugbrain.dev', title: 'The Grug Brained Developer', tags: ['reading', 'engineering'] },
    'http://paulgraham.com/greatwork.html': { url: 'http://paulgraham.com/greatwork.html', title: 'How to do great work', tags: ['reading'] },
    'https://github.com': { url: 'https://github.com', title: 'GitHub', tags: ['engineering', 'work'] },
    'https://linear.app': { url: 'https://linear.app', title: 'Linear', tags: ['work', 'engineering'] },
  },
  'stacknest:spaces': [
    { id: 'demo-1', title: 'Design research', workspaceId: 'ws-personal', createdAt: 0, updatedAt: 0, tabs: [
      { title: 'Refactoring UI', url: 'https://refactoringui.com' },
      { title: 'Type Scale — A Visual Calculator', url: 'https://typescale.com' },
      { title: 'cubic-bezier.com', url: 'https://cubic-bezier.com' },
    ] },
    { id: 'demo-2', title: 'Weekend reading', workspaceId: 'ws-personal', createdAt: 0, updatedAt: 0, tabs: [
      { title: 'The Grug Brained Developer', url: 'https://grugbrain.dev' },
      { title: 'How to do great work — Paul Graham', url: 'http://paulgraham.com/greatwork.html' },
    ] },
    { id: 'demo-3', title: 'Frontend Eng', workspaceId: 'ws-work', collapsed: false, createdAt: 0, updatedAt: 0, tabs: [
      { title: 'GitHub — web-app', url: 'https://github.com' },
      { title: 'Vercel Dashboard', url: 'https://vercel.com' },
      { title: 'Linear — Sprint 24', url: 'https://linear.app' },
      { title: 'Sentry Issues', url: 'https://sentry.io' },
      { title: 'TypeScript Handbook', url: 'https://typescriptlang.org' },
      { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
      { title: 'Can I Use', url: 'https://caniuse.com' },
      { title: 'Vite', url: 'https://vitejs.dev' },
      { title: 'Vitest', url: 'https://vitest.dev' },
      { title: 'Playwright', url: 'https://playwright.dev' },
      { title: 'esbuild', url: 'https://esbuild.github.io' },
      { title: 'Bundlephobia', url: 'https://bundlephobia.com' },
    ] },
  ],
};

function bmNode(id, deep = false) {
  const n = bm[id];
  if (!n) throw new Error('not found: ' + id);
  const out = { id: n.id, parentId: n.parentId, title: n.title, url: n.url };
  if (!n.url) out.children = deep ? (n.children || []).map((c) => bmNode(c, true)) : (n.children || []).map((c) => bmNode(c));
  return out;
}

const storageEvents = listeners();
const bmEvents = { onCreated: listeners(), onRemoved: listeners(), onChanged: listeners(), onMoved: listeners(), onChildrenReordered: listeners() };

globalThis.chrome = {
  runtime: { id: undefined, getURL: (p) => p },
  windows: {
    getAll: async () => Object.values(windowMeta).map((w) => ({ ...w })),
    getCurrent: async () => ({ ...windowMeta[1] }),
    getLastFocused: async () => ({ ...(Object.values(windowMeta).find((w) => w.focused) || windowMeta[1]) }),
    update: async (id, props) => {
      if (!windowMeta[id]) return;
      Object.assign(windowMeta[id], props);
      if (props?.focused) Object.values(windowMeta).forEach((w) => { w.focused = w.id === id; });
    },
    create: async ({ url } = {}) => {
      const id = windowSeq++;
      windowMeta[id] = { id, focused: true, type: 'normal' };
      const urls = Array.isArray(url) ? url : url ? [url] : [];
      urls.forEach((u, i) => tabs.push({ id: nextId++, windowId: id, index: i, title: u, url: u, groupId: -1, active: i === 0, pinned: false, audible: false }));
      return { id, ...windowMeta[id] };
    },
    remove: async (id) => {
      for (let i = tabs.length - 1; i >= 0; i--) if (tabs[i].windowId === id) tabs.splice(i, 1);
      delete windowMeta[id];
    },
    onCreated: listeners(), onRemoved: listeners(), onFocusChanged: listeners(),
  },
  tabs: {
    query: async () => tabs.map((t) => ({ ...t })),
    update: async (id, props) => { const t = tabs.find((x) => x.id === id); if (t) Object.assign(t, props); },
    remove: async (ids) => { for (const id of [].concat(ids)) { const i = tabs.findIndex((t) => t.id === id); if (i >= 0) tabs.splice(i, 1); } },
    create: async ({ url }) => { const t = { id: nextId++, windowId: 1, index: tabs.length, title: url, url, groupId: -1, active: false, pinned: false, audible: false }; tabs.push(t); return t; },
    group: async ({ tabIds, groupId }) => {
      const gid = groupId ?? nextId++;
      if (groupId == null) groups.push({ id: gid, title: '', color: 'grey', windowId: 1 });
      for (const id of tabIds) { const t = tabs.find((x) => x.id === id); if (t) t.groupId = gid; }
      return gid;
    },
    ungroup: async (ids) => { for (const id of [].concat(ids)) { const t = tabs.find((x) => x.id === id); if (t) t.groupId = -1; } },
    onCreated: listeners(), onRemoved: listeners(), onUpdated: listeners(), onMoved: listeners(),
    onActivated: listeners(), onAttached: listeners(), onDetached: listeners(), onReplaced: listeners(),
  },
  tabGroups: {
    query: async () => groups.map((g) => ({ ...g })),
    update: async (id, props) => { Object.assign(groups.find((g) => g.id === id), props); },
    onCreated: listeners(), onRemoved: listeners(), onUpdated: listeners(), onMoved: listeners(),
  },
  bookmarks: {
    getTree: async () => [bmNode('0', true)],
    getSubTree: async (id) => [bmNode(id, true)],
    getChildren: async (id) => (bm[id].children || []).map((c) => bmNode(c)),
    get: async (id) => [bmNode(id)],
    search: async (q) => {
      const query = (typeof q === 'string' ? q : q.title || '').toLowerCase();
      return Object.values(bm).filter((n) => n.id !== '0' && (n.title || '').toLowerCase().includes(query)).map((n) => bmNode(n.id));
    },
    create: async ({ parentId, title, url }) => {
      const id = String(nextId++);
      bm[id] = { id, parentId, title, url, children: url ? undefined : [] };
      bm[parentId].children.push(id);
      bmEvents.onCreated._fire(id, bmNode(id));
      return bmNode(id);
    },
    update: async (id, { title }) => { bm[id].title = title; bmEvents.onChanged._fire(id, { title }); return bmNode(id); },
    move: async (id, { parentId }) => {
      const old = bm[bm[id].parentId];
      old.children = old.children.filter((c) => c !== id);
      bm[id].parentId = parentId;
      bm[parentId].children.push(id);
      bmEvents.onMoved._fire(id, { parentId });
    },
    remove: async (id) => {
      const p = bm[bm[id].parentId];
      p.children = p.children.filter((c) => c !== id);
      delete bm[id];
      bmEvents.onRemoved._fire(id, { parentId: p.id });
    },
    removeTree: async (id) => {
      const p = bm[bm[id].parentId];
      p.children = p.children.filter((c) => c !== id);
      const rm = (nid) => { (bm[nid]?.children || []).forEach(rm); delete bm[nid]; };
      rm(id);
      bmEvents.onRemoved._fire(id, { parentId: p.id });
    },
    ...bmEvents,
  },
  storage: {
    local: {
      get: async (keys) => {
        if (keys == null) return { ...storageData };
        if (typeof keys === 'string') return { [keys]: structuredClone(storageData[keys]) };
        if (Array.isArray(keys)) { const o = {}; keys.forEach((k) => { o[k] = structuredClone(storageData[k]); }); return o; }
        const o = {}; for (const k in keys) o[k] = (k in storageData) ? structuredClone(storageData[k]) : keys[k]; return o;
      },
      set: async (obj) => {
        const changes = {};
        for (const k in obj) { changes[k] = { oldValue: storageData[k], newValue: obj[k] }; storageData[k] = obj[k]; }
        storageEvents._fire(changes, 'local');
      },
      remove: async (keys) => {
        const changes = {};
        for (const k of [].concat(keys)) { changes[k] = { oldValue: storageData[k] }; delete storageData[k]; }
        storageEvents._fire(changes, 'local');
      },
    },
    onChanged: { addListener: (cb) => storageEvents.addListener(cb), removeListener: (cb) => storageEvents.removeListener(cb) },
  },
};

console.info('%cStackNest running on mock chrome.* data (dev preview)', 'color: #c45a38');
