# StackNest on the web: the bridge, from the website's side

**Protocol 1** · extension side: `js/webbridge.js` (worker and Settings) and
`js/webbridge-content.js` (the relay in the page) · Settings › 07 StackNest on the web

A StackNest website (the domain is not chosen yet) can act as a home page that shows the same
content as the extension's new tab: collections, the Library, My Space, notes and to-dos, tags,
and Zen with its settings. The data never leaves the person's browser for this: the extension
answers the site's page directly, inside the browser. This document is what the site needs to
build its side.

## 1. How a person connects

1. They type the site's address in **Settings › StackNest on the web** and switch **Connect**
   on. Only an `https://` origin is accepted, with no path, credentials, IP address or wildcard
   (`localhost` and names like `stacknest.test` are fine for development).
2. StackNest shows what will and won't be shared, then Chrome asks to allow StackNest on that
   site (Chrome's own prompt, naming the site).
3. StackNest registers a small relay script for that one origin. Pages on it can now ask.

**Switching it off** stops the answers at once, tells open pages (`disconnected`), unregisters
the relay and gives the site permission back to Chrome. Removing the site's access in Chrome's
own extension settings has the same effect.

The site cannot connect itself. Until the person does the above, the site sees nothing at all:
no marker, no events, no answers. So a page must work, and explain how to connect, when the
bridge is absent.

### Why this mechanism

The domain is chosen at run time, so it can't be written into the manifest.
`externally_connectable` and web-accessible resources both take a static `matches` list, and
a wildcard wide enough for any future domain isn't allowed (or, for web-accessible resources,
would let every site detect the extension). So the manifest declares
`optional_host_permissions: ["https://*/*"]`, which grants nothing and adds no install warning.
Connect requests the one origin and registers a content script for it with
`chrome.scripting.registerContentScripts`. The relay holds no data and can't read extension
storage; the service worker builds every answer after checking the sender's origin, frame and
the permission again.

## 2. Detecting the extension

Three signals, use any:

| Signal | When | Meaning |
|---|---|---|
| `document.documentElement.dataset.stacknestBridge === "1"` | Set at `document_start`, before any of the page's scripts run | The relay is in this page and speaks protocol 1 |
| `{ from: "stacknest", kind: "event", type: "ready" }` via `message` | Posted when the relay starts (also after a Connect while the page is open, or a re-connect) | Same, for pages that were already running |
| A `hello` request answered | Any time | Connected, and the worker answered. A missing reply after about 1 s means the bridge isn't there |

No marker and no answer means one of: StackNest isn't installed in this browser, this site
isn't the connected one, the person switched it off, or this page is in a frame (only the top
frame gets the relay). The site can't tell which, by design. Show how to connect.

## 3. Transport

Messages go through `window.postMessage` on the page's own window, addressed to the page's
own origin. Only the top frame takes part.

**Request** (page → StackNest):

```js
window.postMessage({ to: 'stacknest', v: 1, id: 'r1', type: 'get', payload: { sections: ['notes'] } }, location.origin);
```

| Field | |
|---|---|
| `to` | always `"stacknest"` |
| `v` | the protocol, `1` |
| `id` | a string or number of the page's choosing, echoed in the response |
| `type` | one of the types in section 4 |
| `payload` | plain JSON data (no functions, no DOM), at most 16 KB serialised; may be omitted |

**Response** (StackNest → page), one per request:

```js
{ from: 'stacknest', v: 1, kind: 'response', id: 'r1', type: 'get', ok: true, data: { … } }
{ from: 'stacknest', v: 1, kind: 'response', id: 'r1', type: 'get', ok: false, error: { code: 'not-connected', message: '…' } }
```

**Events** (StackNest → page, unasked):

| `type` | `data` | |
|---|---|---|
| `ready` | `{ protocol: 1 }` | the relay has started |
| `changed` | `{ sections: ['notes', …] }` | after `subscribe`: something in these sections changed. Names only, never values: ask again with `get` |
| `disconnected` | none | the person switched the connection off. Clear what you show from StackNest; nothing more will be answered |

Listen only for messages where `event.source === window`, `event.origin === location.origin`
and `event.data.from === "stacknest"`. Your own requests also arrive at your listener; they
carry `to`, not `from`.

**Error codes:** `not-connected` (switched off, or this isn't the connected site) ·
`unsupported` (wrong `v`, or an unknown `type`) · `bad-request` (payload missing, malformed or
too large) · `not-found` (no such to-do) · `needs-gesture` (`open` without a click) ·
`rate-limited` (more than 16 requests in flight, or `open` twice within 1.5 s) ·
`unavailable` (the extension was updated, reloaded or disabled; reload the page) · `error`
(anything else; `message` says what).

## 4. Message types

| `type` | `payload` | `data` on success |
|---|---|---|
| `hello` | none | `{ app: "StackNest", protocol: 1, version, origin, connectedAt, sections, defaultSections, writes: ["todo.setDone"], actions: ["open"] }` |
| `get` | `{ sections?: string[] }` | one key per section asked for (section 5). Without `sections`: everything except `wallpaper` |
| `subscribe` | none | `{ sections }`. From now on this page gets `changed` events |
| `unsubscribe` | none | `{}` |
| `todo.setDone` | `{ id, done }` for a reminder · `{ id, rowId, done }` for a row of a to-do list | `{ item }`: the whole card after the change, in the notes shape |
| `open` | `{ view?: "board" \| "library" \| "myspace" \| "notes" \| "tags" \| "settings" }` | `{}`. Opens StackNest in a new tab. Must follow a click on the page |

`todo.setDone` is the only write. Nothing else can be changed from the web: not a title, not a
collection, not a bookmark, not a setting.

Every answer counts as the site having "asked". Settings then shows *Connected · last asked
<time>* (written at most once a minute). Settings says *waiting for the site* until the first
request after connecting, and never claims the site is up.

## 5. Data shapes

Field names follow the extension's own storage, so the site can render what the new tab
renders. Fields may be added within protocol 1, so ignore ones you don't know. Times are
milliseconds since the epoch (numbers) unless noted as ISO strings.

### `board`: spaces and collections

```js
{
  workspaces: [{ id, name, color }],                // "Spaces" in the UI; color is a CSS hex or null
  activeWorkspace: 'id' | null,                     // the space the board shows
  collections: [{                                   // in display order
    id, title, color, workspaceId, collapsed, createdAt, updatedAt,
    tabs: [{ title, url }],                         // saved links, in order
  }],
}
```

Show the collections whose `workspaceId` is `activeWorkspace`, as the board does.

### `library`: Chrome's bookmarks

```js
{ roots: [ { id, title, dateAdded, children: [ { id, title, url, dateAdded } | { id, title, dateAdded, children: […] } ] } ] }
```

`roots` are Chrome's top folders (Bookmarks bar, Other bookmarks, Mobile bookmarks). Read only.

### `myspace`

```js
{ items: [{ id, url, title, group, addedAt }] }    // group is a string or null
```

Links moved out of Chrome into StackNest. **The Vault is not here** and can't be asked for:
its items, its count, its PIN and whether one is set are never sent.

### `notes`: notes, to-do lists and reminders

```js
{ v: 3, items: [
  { id, kind: 'note',     title, body, tags, color, pinned, createdAt, updatedAt, reminder? },
  { id, kind: 'todo',     title, list: [{ id, text, done }], tags, color, pinned, createdAt, updatedAt, reminder? },
  { id, kind: 'reminder', text, done, tags, color, pinned, createdAt, reminder? },
] }
```

`body` and `text` are Markdown. `createdAt`/`updatedAt` are ISO strings. `reminder` is
`{ at: ISO string, lead: minutes before }`. `pinned` means pinned to Zen. `color` is one of
`none, amber, rose, …` (a tint name).

### `tags`

```js
[{ url, title, tags: ['docs', …] }]
```

### `zen`

```js
{
  collection: 'collection id' | null,               // the one collection Zen shows; null or unknown = the active space's first
  wallpaper: 'mist' | 'lake' | 'sand' | 'enso' | 'bamboo' | 'sakura' | 'dunes' | 'ocean' | 'dusk' | 'forest' | 'night' | 'aurora'
    | 'nocturne' | 'serenade' | 'lotus' | 'shrine' | 'theme' | 'custom' | null,
  motion: true, eyeRest: true, chime: true,
  pins: [ { id, kind: 'link', url, title, from, at } | { id, kind: 'folder', bmId, title, from, at } ],   // bmId is a Library folder's id
  layout: { panes: ['col', 'todo', 'pinned'], order: { [pane]: ['item key', …] }, cal: true },
  thoughts: { starred: ['text', …], only: false },  // starred lines; `only` = rotate through starred ones alone
}
```

`wallpaper: null` means never changed: the default is `mist`. `custom` means the person's own
image (ask for `wallpaper`). Notes cards pinned to Zen are the notes with `pinned: true`. The
wallpapers themselves are drawn by the extension's CSS and are not part of the data.

### `settings`

Only fields the person has changed are present. A missing field has its default:

| Field | Default | Values |
|---|---|---|
| `fontUi` | `hanken` | `hanken, system, helvetica, georgia, verdana` |
| `fontMono` | `jetbrains` | `jetbrains, system, menlo, consolas, courier` |
| `scale` | `comfortable` | `compact, default (Standard), comfortable, large` |
| `typeSizes` | `{ heading: 1, title: 1, body: 1, small: 1 }` | multipliers from `0.85, 0.92, 1, 1.08, 1.16, 1.25, 1.35` |
| `tabsBar` | `top` | `top, side, off` |
| `newTab` | `true` | |
| `tickerEnabled`, `tickerBase`, `tickerCrypto`, `tickerFx` | `false`, `USD`, `[bitcoin, ethereum, solana]`, `[EUR, GBP]` | |

The colour theme (auto, light, dark, linen) is not included: the extension keeps it in its
page's own `localStorage`, out of the worker's reach. Follow `prefers-color-scheme`, or let the
person choose on the site.

### `wallpaper` (only when asked for by name)

```js
{ custom: { dataUrl: 'data:image/jpeg;base64,…', tone: 'dark' | 'light' } | null }   // tone: how light the picture is, for the text over it
```

Often several hundred KB, so it isn't in the default `get`.

### Never sent

The Vault and anything in it (also filtered out of Zen pins, the Zen arrangement and tags), the
PIN record and security question, the Google account email, OAuth tokens, Drive state, open
tabs and windows, history, the Duplicates "forgotten" list, arcade scores. The Library is the
person's Chrome bookmarks and is sent as is.

## 6. A minimal client

```js
const pending = new Map();
let seq = 0;
addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== location.origin || e.data?.from !== 'stacknest') return;
  const m = e.data;
  if (m.kind === 'response') { pending.get(m.id)?.(m); pending.delete(m.id); return; }
  if (m.type === 'changed') refresh(m.data.sections);
  if (m.type === 'disconnected') clearEverything();
  if (m.type === 'ready') start();          // connected while this page was open
});
function ask(type, payload, ms = 3000) {
  return new Promise((resolve) => {
    const id = `r${++seq}`;
    pending.set(id, resolve);
    postMessage({ to: 'stacknest', v: 1, id, type, payload }, location.origin);
    setTimeout(() => { if (pending.delete(id)) resolve({ ok: false, error: { code: 'timeout' } }); }, ms);
  });
}
async function start() {
  const hi = await ask('hello', null, 1000);
  if (!hi.ok) return showHowToConnect();
  render(await ask('get'));
  ask('subscribe');
}
async function refresh(sections) { render(await ask('get', { sections })); }
if (document.documentElement.dataset.stacknestBridge) start(); else showHowToConnect();
```

## 7. Rules for the site

- **Keep it in the page.** Don't put StackNest data in URLs, query strings, analytics,
  logs or error reports, and don't send it to a server unless the person has asked for that
  separately.
- **No third-party scripts on pages that use the bridge.** Any script running in the page can
  read the answers, because they are posted to the page's window. Use a strict CSP
  (`script-src 'self'`).
- **Clear on `disconnected`**, and treat `not-connected` the same way.
- **Don't poll.** `subscribe` once and re-`get` only the sections named in `changed`.
- **Version check.** If `hello.data.protocol` is higher than the site knows, carry on with
  protocol 1 (requests keep `v: 1`). A breaking change gets a new number. Additive changes
  (new sections, fields, types) keep `1`, and `hello` lists what exists.

## 8. Developing against it

Serve the site over https on `localhost` (any port) or a `.test` name with a certificate the
browser trusts (for headless tests, `--ignore-certificate-errors`), type that address in
Settings and connect. The extension's headless end-to-end check connects
`https://localhost:8443`, reads every section, ticks a to-do, follows change events, checks
that no Vault, PIN, token or account data appears in any answer, and disconnects.
