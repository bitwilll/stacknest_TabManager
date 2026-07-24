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

Google Drive backup works in incognito too: `chrome.identity`'s OAuth flow can't run from an
incognito page, so incognito newtabs delegate token minting to the background service worker
(`js/sw.js`), which lives in the regular profile. The consent window, if one is needed, opens as a
normal-profile window.

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

**Notes & Todos** — a calm scratchpad in the sidebar (below Duplicates), laid out as a **mosaic** of
three kinds of card:

| Kind | What it is |
|---|---|
| **Note** | A title and a free-form body. The body understands **Markdown**. |
| **To-do list** | A title and a **checklist** — press Enter in an item to add the next one under it, so a whole list lives on one card. |
| **Reminder** | A single checkable line on its own card, optionally with a date/time notification. |

Everything **auto-saves as you type** — there is no Save button. Quick-add a reminder from the bar at
the top, or use **New ▾** for any of the three.

> **If you used StackNest before this:** what used to be called a *todo* — one checkable line per
> card — is now a **reminder**, and *to-do list* is the new checklist card. Your existing tasks
> migrate to reminders automatically, keeping their tick state, tags, colour and reminders. Nothing
> needs doing, and old exports and Drive backups still import correctly.

Writing a list is meant to flow: the composer **keeps focus** after Enter so you can rattle off
reminders one after another, **Enter inside a checklist item** creates the next one directly below
and jumps to it, and **Backspace in an empty item** removes it and steps back up, so a stray Enter
never strands a blank row. Every card can be:

- **Dragged** by the ⣿ handle in its footer to reorder (drop above or below any other card).
- **Tagged** — add as many labels as you like; each gets its own colour dot.
- **Tinted** — six soft pastels, applied as a translucent wash so they stay readable in both
  light and dark.
- **Reminded** — pick a date & time and how early to be nudged (at the time, or 5 / 10 / 30 / 60
  min before) and the extension fires a **browser notification** then, even with no StackNest tab
  open (a `chrome.alarms` entry wakes the service worker). Times are your **local** timezone;
  completing or deleting a task cancels its reminder. Notes can carry reminders too.
- **Undone** — deleting a card is reversible: a snackbar offers **Undo**, and **⌘Z / Ctrl+Z** puts
  it back where it was with its items, tags, colour and reminder intact (**⌘⇧Z / Ctrl+Y** to redo).

**Formatting.** Click into any text field and a formatting bar appears beneath it: **B / I / U / S**
and **A+ / A−**. With nothing selected, B/I/U/S formats the word the caret is in; press again to
remove it. **⌘B / ⌘I / ⌘U** do the same from the keyboard. Formatting is written as Markdown into the
text itself — so it survives export, import and Drive sync — and each field **renders** that
formatting when you click away, showing the source again the moment you edit it. **A+ / A−** scales
all the text on that one card through five steps, independently of the global interface size in
Settings.

**Markdown** works in a note body: `#` headings, `**bold**`, `*italic*`, `~~strikethrough~~`,
`` `code` ``, `<u>underline</u>`, `- ` bullets, `1.` numbered lists, `> ` quotes, ` ``` ` fences,
`---` rules, `- [ ]` task lines and `[links](https://example.com)`. Anything you paste or import is
escaped before it is rendered, and only `http`, `https` and `mailto` links are clickable — a note
carrying `<script>` or a `javascript:` link renders as inert text.

The **?** button in the toolbar opens a guide covering all of the above. The nav badge counts open
work — unticked reminders plus unticked checklist items. Everything lives in `chrome.storage`, so it
rides along in your backups and Google Drive sync. The toolbar offers **Export** (full backup incl.
notes, or notes-only), **Import** (a file, or paste from **Apple Notes** — a browser extension can't
read Apple Notes directly, so you paste exported text, optionally splitting on blank lines), and
**Drive** back-up / fetch (uses the same backup, so notes sync with everything else).

> **Typing is never interrupted.** The view builds its header and composer once and only ever
> rebuilds the mosaic, ignores the storage echo of its own auto-save, and restores focus and caret
> position across any rebuild that does happen. An outside change (another tab, a Drive restore)
> waits until you click away rather than yanking the field you're typing in.

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

### Whose Google account is used?

**Always the person using the extension — never the developer's.** The `oauth2.client_id` in
`manifest.json` identifies the *extension* to Google, the way a package name does. It is not an
account and carries no credentials, which is why Google documents it as public. Each install mints
a token for whoever signs in on **that** computer and writes to **that** person's own private Drive
folder. Nobody can read anyone else's backup, the developer included. Nothing is pre-connected:
Cloud sync starts disconnected until you press **Connect**.

There is one real limitation. `chrome.identity.getAuthToken` uses the account the **Chrome profile**
is signed into and offers no account picker, so if you're signed into Chrome as one account but want
backups in another, it can't be expressed. Settings says so plainly, and **Switch account** explains
the two ways out.

**To get a full account chooser**, fill in `WEB_CLIENT_ID` in [`js/authConfig.js`](js/authConfig.js).
Sign-in then goes through `chrome.identity.launchWebAuthFlow` with `prompt=select_account`, so any
Google account can be picked regardless of Chrome's own, and **Switch account** in Settings → Cloud
sync moves to a different one at any time. It needs a second OAuth client — Application type
**Web application** (not "Chrome Extension" — that type has no redirect URIs) with the redirect URI
`https://<YOUR_EXTENSION_ID>.chromiumapp.org/`. Full steps are in the file's header comment.

Either way the short-lived access token is kept under its own storage key and is **never** written
into an export or a Drive backup, and **Disconnect** revokes the grant and clears every cached
token for the extension.

## Design

The interface follows **Nothing's design psychology** — the London phone maker's argument that
technology should ask for less of your attention, not more. Four rules, and everything in
`css/newtab.css` follows from them:

1. **Monochrome, so attention is a budget.** The chrome is pure greyscale. Colour belongs to
   *your* data — space and collection dots, tag dots, note tints — and to exactly one signal:
   **red**. Red is permitted on the live-tabs pulse, destructive actions, an overdue reminder,
   the duplicate count, and ticker-down. Nowhere else. If red appears twice on one screen, one
   of them is a bug.
2. **Flat.** No gradients, no glows, no coloured shadows anywhere. Depth is a hairline and one
   honest step of background value. The only real elevation is the floating layer (modals,
   popovers), and it uses a single neutral shadow token shared by both themes.
3. **Structure is visible.** Hairline rules between sections and a **dot-matrix ground** on the
   board, the tag graph and every empty state — the grid the layout sits on, left exposed
   rather than painted over. It is Nothing's transparent back panel, applied to software.
4. **Neutral greys, true black.** The greys carry no blue cast, and dark mode is **#000000**,
   not a soft charcoal — on OLED that is Nothing's whole point, and on a monitor it keeps the
   same uncompromising character.

Selection **inverts** to solid ink rather than tinting, so a chosen chip is unmistakable; the
active nav row adds a hard marker on its leading edge. Micro-labels are mono, uppercase and
widely tracked — the app's signature piece of type.

**Type scale — 1.125 (major second), 13px base.** The sheet previously used fifteen unrelated
sizes (9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 16, 17, 18, 19px). Seven steps on
one ratio replace them, exposed as custom properties:

| Token | Size | Role |
|---|---|---|
| `--t1` | 10.5px | micro — mono uppercase section labels |
| `--t2` | 11.5px | meta — counts, timestamps, domains |
| `--t3` | 13px | base — body, nav, buttons, inputs |
| `--t4` | 14.5px | title — card and collection titles |
| `--t5` | 16.5px | section headings |
| `--t6` | 18.5px | view titles |
| `--t7` | 21px | display numerals |

1.125 is deliberately tight — an editorial 1.25 makes a dense tool shout. Where two roles
converged on 13px (a settings label and its description, say) the hierarchy moved to **weight
and colour** instead of size, which keeps the smaller text fully readable. Steps are rounded to
half-pixels so stems stay crisp.

**Contrast.** Every text token clears WCAG AA on every surface it is used on, in both themes —
the worst case is **4.8:1** against a 4.5 requirement, measured with proper alpha compositing.
Idle icons (`--text-ghost`) are held to the 3:1 non-text bar and are never used for text;
placeholders use `--text-faint`, since a placeholder *is* text.

Hanken Grotesk + JetBrains Mono, bundled in `fonts/` — no webfont requests. The `new design/`
folder is earlier reference material — delete it before packaging for the Web Store.

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
js/drive.js        Google Drive cloud backup/restore (Drive appData REST + connect/switch/disconnect)
js/auth.js         Google sign-in, shared by page + worker (getAuthToken or account-chooser flow)
js/authConfig.js   which sign-in path to use — and what the OAuth client ID is/isn't
js/sw.js           background service worker (reminder alarms + token broker for incognito pages)
js/ticker.js       market ticker (CoinGecko crypto + open.er-api FX marquee)
js/settings.js     Settings view (typography, ticker, backup, cloud)
js/backup.js       full JSON backup/restore (spaces, collections, settings, bookmarks)
js/notes.js        Notes & Todos mosaic — note / to-do list / reminder cards, migration
js/markdown.js     escape-first Markdown renderer (no dependencies, XSS-safe by construction)
js/format.js       B/I/U/S selection formatting + per-card text scale, native undo preserved
js/history.js      command-based undo/redo + snackbar
js/store.js        serialized chrome.storage.local write-queue
js/ui.js           DOM helpers, icons, letter-tiles, toast, favicons, drag helpers
js/mock.js         dev-only chrome.* shim
```
