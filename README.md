# StackNest — Tab Manager

A Toby-style command center that opens on every new tab: your live windows, saved
**Collections** you can stash and revive, and your Chrome bookmarks — in a clean board UI
with proper light and dark themes. No build step, no dependencies, no data leaves your browser.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder (`StackNest - Tab Manager`).
4. Open a new tab — StackNest is your new-tab page.

> Chrome will ask to confirm the new-tab replacement the first time. Click **Keep it**.

### Use it in incognito

The manifest declares `"incognito": "spanning"`, so StackNest can run in incognito windows with
your **same** collections, bookmarks and settings (they live in shared storage). Chrome still
gates this behind a per-user switch you have to flip once — the extension cannot grant itself
incognito access:

1. `chrome://extensions` → StackNest → **Details**.
2. Turn on **Allow in incognito**.
3. Open a new tab in an incognito window — StackNest loads with your data.

Note the trade-off of "spanning": because storage is shared, anything you actively **stash or save
while in incognito persists** into your normal profile (it's you choosing to save it). Your saved
theme and board layout are the exception — those are kept in `localStorage`, which is per-session
in incognito, so they fall back to defaults there.

## The layout

- **Sidebar** — switch views (**Collections**, **Library**, **Settings**), pick your active
  **Space** (environment), and
  see every open **window** and every collection with live counts. Click a window to
  expand it into a tab list — click a tab to jump to it, hover to close it, or **drag it**
  into any collection (column or sidebar row) or the Library. Hovering another window's row
  also reveals **open** (switch to that window) next to save and stash. Searching
  auto-expands windows that contain matches. Hovering a collection row reveals **rename**
  and **delete**.
- **Topbar** — search (`⌘K` or `/`), the light/dark theme toggle, and **Stash window**.
- **Tray** — the current window's open tabs as chips. Click to jump, hover to close,
  **drag a chip anywhere** — onto a collection, the board, or the Library — to save it.
- **Board** — your collections as columns on a dotted canvas.

## What it does

**Spaces** (environments) — top-level workspaces, each with its own collections:
- The **SPACES** sidebar section lists them (a colored dot + name). Click one to switch — the
  board and the COLLECTIONS list swap to that space's collections. Windows and Library stay global.
- **+** creates a space; hover a space row to **rename** or **delete** it (delete removes the
  space *and* its collections, after a confirming second click; you always keep at least one).
- **Reorder spaces** by dragging a space row up or down — an accent line shows where it'll land
  (drop on a row's top half to go above it, bottom half to go below). The order persists.
- **Drag a collection onto a space row** to move it into that environment. New collections land
  in the active space. Existing data migrates into a default "Personal" space on first run.

**Collections** (saved tab sets, stored locally):
- **Stash window** saves this window's tabs to a new collection **and closes them** — frees
  memory; the dashboard survives. **Save all →** does the same but keeps tabs open. Both
  also exist per-window in the sidebar (hover a window row).
- **Open all** on a collection revives it in a **new window**; if it holds **more than 10
  links** it asks for confirmation first.
- Click a collection's name to rename; click its **dot** to cycle its color. **Reorder** by
  dragging a column's dot, or by dragging a collection row in the sidebar. **Collapse** a
  column with the chevron (persists; auto-expands while searching). Rename and delete are also
  on each sidebar row (hover); delete asks for a confirming second click.
- **Add tab** at the bottom of a column takes a pasted URL. **Move links** by dragging cards
  between columns (or onto a sidebar collection), and reorder within a column by dropping onto
  a card. Adding or moving a link that **already exists** in the target asks before duplicating.
- **Export** a single collection (download icon in its header) or **all collections** (download
  icon by the COLLECTIONS heading) as a standard **bookmarks `.html`** file, importable into
  any browser.

**Library** (your real, synced Chrome bookmarks):
- Folder-first card grid with breadcrumbs; **New folder**, rename, delete, **open all**.
- Drag bookmarks onto folders or breadcrumbs to move them. Drag a tray chip into the
  Library (or onto the sidebar Library item) to bookmark it in the open folder.

**Two board layouts** — the topbar has a **columns / tiles** toggle. *Columns* is the kanban
board; *Tiles* lays every collection out as a full-width gallery of uniform cards. Your choice
persists.

**Tags & mind-graph** — the **tag** action on any saved link or bookmark opens a small editor:
add as many tags as you like (they're shared by URL, so the same page is tagged once whether it's
in a collection or the Library). The **Tags** view shows a filter bar, a **mind-graph** (each tag
is a hub, every tagged link orbits its tags, and multi-tag links sit between their hubs — click a
hub to filter, click a dot to open), and a per-tag grid for sorting similar links together.

**Duplicates** — the **Duplicates** view scans every collection *and* all your Chrome bookmarks,
groups links saved more than once, and shows where each copy lives. Tick the copies you want to
keep — one folder or several — and **Keep selected** deletes the rest of that link's duplicates;
or remove copies one at a time. **Keep one of each** does it all in a single click: for every
duplicated link it keeps one copy and removes the rest (with a confirm first). Links you'd rather
not be nagged about get a **Forget** button — they move to a **Forgotten links** section at the
bottom, excluded from scans and from the one-click clean, restorable any time.

**Settings** (in the sidebar):
- **Typography** — pick the **interface font** and **monospace font** (offline-safe stacks, live
  preview) and an **interface size** (Compact · Default · Comfortable · Large). Applied instantly
  and saved.
- **Backup & restore** — **Export** everything (spaces, collections, settings) to a JSON file,
  optionally **including your Chrome bookmarks**. **Import** restores from that file (replaces
  your spaces/collections/settings after a confirm; bookmarks, if present, are added under a new
  "StackNest Import" folder — nothing is overwritten).
- **Cloud sync** — back up and restore the same data to your own **Google Drive**, so you can move
  between machines. The backup lives in a private *app folder* only StackNest can read — it never
  appears in your Drive. See [Cloud sync setup](#cloud-sync-setup) below (needs a one-time Google
  OAuth client). *StackNest Cloud (Pro)*, a managed subscription tier on stacknest.com, is marked
  **coming soon** — it needs a hosted backend that isn't built yet.
- **Market ticker** — an optional live **crypto + forex** marquee beside the search bar (**off by
  default**). Pick a **reference currency** and which coins (BTC, ETH, SOL, …) and FX pairs to
  show. Prices come from **CoinGecko** and **open.er-api.com** — enabling it makes network requests
  to those services (the only feature that talks to the network).

**Undo / redo** — accidentally deleted a collection, space, or saved link? A snackbar appears
bottom-right with **Undo**, or press **⌘Z / Ctrl+Z** (redo: **⌘⇧Z / Ctrl+Y**). Undo restores just
that item — deleting a space brings back its collections too — without reverting other edits.

**Search** — one field filters the tray, the board, and the Library as you type. `⌘K` or `/`
focuses it, `Enter` opens the first match, `Esc` clears.

Clicking a saved card navigates in place (it's your new tab); `Cmd/Ctrl`-click opens a
background tab. Theme follows your system until you pick one with the sun/moon toggle.

## Permissions

| Permission | Used for |
|---|---|
| `tabs` | listing, switching, closing, and reopening tabs and windows |
| `bookmarks` | the Library view |
| `storage` | saving your collections locally (`chrome.storage.local`) |
| `favicon` | Chrome's local favicon cache (no network requests) |
| `identity` | Google sign-in for **Cloud sync** (Drive backup) |
| `host_permissions` | `googleapis.com` (Drive backup), `api.coingecko.com` + `open.er-api.com` (market ticker) |

Cloud sync and the ticker are the only features that reach the network, and both are opt-in.

## Cloud sync setup

Google Drive backup uses `chrome.identity` OAuth, which needs a one-time client that's tied to
*your* extension's ID. The code is ready — it just needs the client ID. Until you add it, Settings
shows Cloud sync as **"Set up required"** (in the dev preview it's simulated, so you can try the
whole flow without Google).

1. **Load the extension unpacked** (`chrome://extensions` → Developer mode → *Load unpacked*) and
   copy its **ID**.
2. **Pin the ID so it survives moves/reinstalls** (recommended). `getAuthToken` only issues tokens
   to an extension whose ID matches the OAuth client, so a stable ID matters:
   - `chrome://extensions` → **Pack extension** on this folder → Chrome writes a `.pem` private key.
   - Derive the public `"key"` from it and add it as a top-level `"key": "<base64>"` in
     `manifest.json`, then reload. The ID is now fixed. *(For a single dev machine you can skip this
     and just register the current ID from step 1 — it stays the same as long as the folder doesn't move.)*
3. **Create the OAuth client.** In the [Google Cloud Console](https://console.cloud.google.com/):
   - **APIs & Services → Enable APIs → Google Drive API** → Enable.
   - **OAuth consent screen** → External → add scopes `.../auth/drive.appdata` and
     `.../auth/userinfo.email`, and add your Google account under **Test users** (while unpublished).
   - **Credentials → Create credentials → OAuth client ID → Application type: Chrome Extension**,
     and paste the extension **ID** from step 1/2.
4. **Wire it in.** Put the generated client ID into `manifest.json` → `oauth2.client_id` (replacing
   the `REPLACE_WITH_…` placeholder). It must end in `.apps.googleusercontent.com`.
5. **Reload the extension.** Settings → Cloud sync now shows **Connect** → sign in →
   **Back up now / Restore latest**. The backup lives in Drive's private `appDataFolder`
   (invisible in your Drive UI). **Disconnect** revokes the grant, not just the local token cache.

Robustness built in: a stale/revoked cached token self-heals (the token is evicted and re-fetched,
re-consenting if needed) instead of wedging backup/restore, and Drive/network errors surface as
plain-language messages rather than raw HTTP codes.

## Design

Implements the "Stash — Tab Manager" Claude Design project (in `new design/`): option **1a**
is the light theme, option **1c** the dark theme. Hanken Grotesk + JetBrains Mono, bundled
in `fonts/`. The `new design/` folder is reference material — delete it before packaging
for the Web Store.

## Development

The page runs outside Chrome too: serve the folder (`python3 -m http.server`) and open
`newtab.html` — `js/mock.js` shims the `chrome.*` APIs (tabs, windows, storage, bookmarks)
with demo data. The mock never activates inside Chrome.

```
manifest.json      MV3 manifest (new-tab override)
newtab.html        app shell (sidebar · topbar · tray · board · library)
css/newtab.css     all styling; light (1a) + dark (1c) theme tokens at the top
js/app.js          boot, theme, view switching, unified search
js/tabs.js         open-tabs tray + WINDOWS sidebar + save/stash
js/spaces.js       collections board (columns/tiles) + sidebar list
js/spacesStore.js  collections storage (chrome.storage.local), no DOM
js/bookmarks.js    Library view (bookmarks as card grid)
js/tags.js         tags data + editor popover + Tags view (mind-graph)
js/duplicates.js   Duplicates view (finds repeated links across collections + bookmarks)
js/drive.js        Google Drive cloud backup/restore (chrome.identity + Drive appData)
js/ticker.js       market ticker (CoinGecko crypto + open.er-api FX marquee)
js/settings.js     Settings view (typography, ticker, backup, cloud)
js/backup.js       full JSON backup/restore (spaces, collections, settings, bookmarks)
js/history.js      command-based undo/redo + snackbar
js/store.js        serialized chrome.storage.local write-queue
js/ui.js           DOM helpers, icons, letter-tiles, toast, favicons, drag helpers
js/mock.js         dev-only chrome.* shim
```
