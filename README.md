# StackNest — Tab Manager

A Toby-style command center that opens on every new tab: your live windows, saved
**Collections** you can stash and revive, and your Chrome bookmarks — in a clean board UI
with proper light and dark themes. No build step, no dependencies, no data leaves your browser.

## Install (load unpacked)

Requires **Chrome 128 or later**.

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

- **Sidebar** — a column of tiles on the dark frame: **views** (Collections, My Space, Vault,
  Library, Tags, Duplicates, Notes — each with its live count), **spaces**, the active space's
  **collections**, open **windows**, and **Settings**. Pick your active **Space** (its row takes a
  wash of the Space's own colour), and
  see every open **window** and every collection with live counts. The button beside the
  wordmark **folds the sidebar to a 72px icon rail** — every view stays one click away with its
  count as a badge, spaces become their colour marks — and the choice is remembered; it is
  handy next to the vertical tab rail or on a smaller screen. Click a window to
  expand it into a tab list — click a tab to jump to it, hover to close it, or **drag it**
  into any collection (column or sidebar row) or the Library. Hovering another window's row
  also reveals **open** (switch to that window) next to save and stash. Searching
  auto-expands windows that contain matches. Hovering a collection row reveals **rename**
  and **delete**.
- **Topbar** — search (`⌘K` or `/`, with a clear button once you've typed; the box stays
  tinted while a filter is active), the theme segment (**auto** follows your OS and switches
  live, or pin **light** / **dark** / **linen**), and this window's two verbs: **Save window**
  (save its tabs to a new collection, keep them open) and **Stash & close**. On narrow windows the
  sidebar tucks away behind a **menu** button and slides in as a drawer with touch-sized rows and a
  close button, so every section (Spaces, Collections, Windows) stays reachable.
- **Every view has the same head** — under the top bar: what you are looking at (a scope such
  as "space · Personal" or "folder · Reading list"), its counts as large numerals (the first one
  is the same number as the sidebar badge), a "matching “…”" chip while you search, one plain
  sentence, and the view's own buttons with at most one lava button — the main thing to do
  there. Below it, content sits in captioned groups; empty, no-match and locked states live in
  the body, so the head never disappears.
- **Open tabs bar** — the current window's live tabs. Click to jump, hover to close,
  **drag one anywhere** — onto a collection, the board, or the Library — to save it.
  Settings → Appearance chooses where it lives:
  - **Horizontal** — a strip of chips under the header, on the board.
  - **Vertical** — its own rail beside the sidebar, on every view. A rail that vanished
    when you opened Notes would be a board widget, not a tab bar.
  - **Hidden** — neither; expand a window in the sidebar to reach its tabs.

  It is one element with two homes, re-parented rather than duplicated, so the ids,
  listeners and render path stay single. It used to render in both places at once, which
  is the same tabs twice and 64px of the board spent on the copy. Whichever you pick, the
  per-window rows — switch to it, save it, stash it — stay in the sidebar; those are
  window actions, not a tab list.
- **Board** — your collections as columns on a dotted canvas. Its head carries the layout
  switch (columns · tiles · mosaic), export, and **New collection**.
- **Library** — Chrome's bookmarks, browsed folder by folder. The breadcrumb starts at
  **All bookmarks**, which lists Chrome's permanent roots (Bookmarks Bar, Other Bookmarks,
  Mobile Bookmarks). Chrome refuses to rename, move or delete those, so on them the Library
  offers only "open all" rather than buttons that would fail.

## My Space and the Vault

Chrome bookmarks are visible everywhere: the bookmarks bar, `chrome://bookmarks`, address-bar
suggestions. Hiding one behind a PIN inside a new-tab page would be theatre. So StackNest does
the only thing that actually works — it **moves the bookmark out of Chrome** into its own
storage.

- **My Space** — bookmarks kept in StackNest only. In the **Library**, the move action on any
  bookmark or folder takes it out of Chrome and puts it here. A folder moves as a group and its
  name becomes the heading. Every move is reversible: **Put back in Chrome** recreates it.
- **Vault** — the same store, behind a PIN. Right-click the move action to send something
  straight here. The Vault relocks on **every new tab**, not on a timer.

**Set the PIN in Settings → Vault.** It is stored as a PBKDF2-SHA256 hash over a random salt —
the PIN itself is never written down. **Five wrong attempts in a row lock the Vault**, and a
correct PIN is refused after that; the counter lives in storage, so closing the tab does not
hand back a fresh five. Getting back in then needs one of two proofs of ownership:

1. **Your security question** — set alongside the PIN, answer compared case- and
   space-insensitively.
2. **Google** — sign out of Drive and sign back in as the account that set the PIN. Signing in
   as a different account is refused.

> **What this is worth.** Moving a bookmark here genuinely removes it from Chrome's surfaces.
> But the Vault's contents live in `chrome.storage.local` in plain text: the PIN stops the
> interface from showing them, not someone reading storage directly with devtools. It is a
> locked drawer, not a safe. (An extension also cannot verify a Chrome profile password or
> drive the browser's own passkey — re-running the Google sign-in is the strongest account
> proof a page like this has.)

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
- **Stash & close** saves this window's tabs to a new collection **and closes them** — frees
  memory; the dashboard survives. **Save window** (beside it in the top bar) does the same but
  keeps the tabs open. Both
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

**Three board layouts** — the topbar has a **columns / tiles / mosaic** toggle. *Columns* is the
kanban board; *Tiles* lays every collection out as a full-width gallery of uniform cards; *Mosaic*
flows collections into a masonry of cards that size to their content (a very long collection
scrolls inside its card), the same layout the Notes view uses. Your choice persists.

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

**Formatting.** Click into any text field and a formatting bar docks at the bottom of that card —
only while you're writing in it: **B / I / U / S**, **bullet / numbered / checklist** lines, and
**A+ / A−**. The list buttons work in a note body (they mark the current line, or every selected
line; press again to remove); Enter continues a list and Enter on an empty item ends it. With nothing selected, B/I/U/S formats the word the caret is in; press again to
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
- **Appearance** — pick the **interface font** and **monospace font**, an **interface size**
  (Compact · Standard · **Comfortable**, the default for new installs · Large), **text sizes per role** —
  Headings, Titles, Body text and Small text each get a −/+ stepper from 85% to 135% with a
  live sample, so you can grow just the small print or calm down just the headings; one
  **Reset** puts them back — and where the **open tabs bar** lives
  (Horizontal · Vertical · Hidden). Applied instantly to the whole app and saved. Each
  entry in the menu is **rendered in its own typeface**, so the list is the preview.

  StackNest also **checks whether the font is actually on your machine**. A CSS font stack fails
  silently — ask for Consolas on a Mac and the browser quietly serves something else, so it looks
  like the setting did nothing. Missing faces are labelled **"— not installed"** and, if you pick
  one anyway, the row tells you exactly what you'll get instead. Only *Hanken Grotesk* and
  *JetBrains Mono* ship with the extension and are guaranteed everywhere; the rest are system
  fonts, so availability depends on your OS.
- **Backup & sync** (one Settings section: a file on this device, or your Google Drive)
  — **Export** everything — spaces, collections, notes, tags, forgotten
  duplicates, **My Space and the Vault** (contents plus the PIN record; the PIN itself is never
  stored, only its salted hash), and settings — to a JSON file, optionally **including your
  Chrome bookmarks**. **Import** restores from that file (replaces
  your spaces/collections/settings after a confirm; bookmarks, if present, are added under a new
  "StackNest Import" folder — nothing is overwritten).
- **Google Drive** — back up and restore the same data to your own **Google Drive**, so you can move
  between machines. The backup lives in a private *app folder* only StackNest can read — it never
  appears in your Drive. It is **one file, overwritten in place** on every backup: the upload
  patches the existing file rather than creating another, and if stray copies ever exist (two
  machines' first-ever backups can race) it keeps the newest and deletes the rest, so no extra
  Drive space is ever taken. Restore reads the newest copy. A restored Vault starts locked. See [Cloud sync setup](#cloud-sync-setup) below (needs a one-time Google
  OAuth client).
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
background tab. Theme follows your system until you pin one with the sun / moon / leaf buttons in
the topbar theme segment; the auto button hands it back to the OS. **Linen** is the third, warmer theme: the
all-paper one — linen paper inside a paper frame, walnut ink and one pine accent.

**Wayfinding.** Colour marks where you are and what you own: the active view carries a short
rail; the active **Space** row's rail is that Space's own colour and the board title shows the
same swatch; every collection column wears its colour as a 3px top edge. Counts and actions are
visible at rest and brighten on hover — nothing important is hover-only — and a checklist card
shows a progress bar that fills as you tick, turning green when the list is done.

Views can be deep-linked with a hash — `newtab.html#notes`, `#library`, `#tags`, `#duplicates`,
`#settings` — which is how clicking a reminder notification lands you on the Notes view.

Every view shares one empty-state pattern: an icon, a plain sentence about what goes there, and
the one or two actions that fill it (new collection, new folder, new note or list).

## Permissions

| Permission | Used for |
|---|---|
| `tabs` | listing, switching, closing, and reopening tabs and windows |
| `bookmarks` | the Library view |
| `storage` | saving your collections locally (`chrome.storage.local`) |
| `favicon` | Chrome's local favicon cache (no network requests) |
| `identity` | Google sign-in for **Google Drive backup** (Settings › Backup & sync) |
| `alarms` | scheduling Notes reminders, so they fire with no StackNest tab open |
| `notifications` | showing a reminder when it is due |

There are **no host permissions**: the four services StackNest can talk to — Google Drive and its
sign-in (`www.googleapis.com`, `oauth2.googleapis.com`) and the market ticker's price sources
(`api.coingecko.com`, `open.er-api.com`) — all answer cross-origin requests, and the manifest's
content security policy (`connect-src`) allows exactly those four and nothing else.

Drive backup and the ticker are the only features that reach the network, and both are opt-in.
The ticker credits both price sources on screen, as their terms ask, fetches exchange rates at
most once an hour, and pauses while the tab is hidden. See [PRIVACY.md](PRIVACY.md).
(An unused grammar-check module that would have sent search text to a third-party service was
removed so that statement stays true.)

## Cloud sync setup

Google Drive backup uses `chrome.identity` OAuth, which needs a one-time client that's tied to
*your* extension's ID. The code is ready — it just needs the client ID. Until you add it, Settings
shows Google Drive (Settings › Backup & sync) as **"Set up required"** (in the dev preview it's simulated, so you can try the
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
     `.../auth/userinfo.email` (both non-sensitive). While the app is in **Testing**, only the
     **Test users** you list can sign in, and their grants expire after 7 days — fine for your own
     machine. For a public release, fill in Branding (name, support email, home page, privacy
     policy URL) and **publish the app to In production**; see `docs/store/launch-checklist.md`.
   - **Credentials → Create credentials → OAuth client ID → Application type: Chrome Extension**,
     and paste the extension **ID** from step 1/2.
4. **Wire it in.** Put the generated client ID into `manifest.json` → `oauth2.client_id` (replacing
   the `REPLACE_WITH_…` placeholder). It must end in `.apps.googleusercontent.com`.
5. **Reload the extension.** Settings → Backup & sync now shows **Connect** → sign in →
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

**"Precision"** (2026-10-06) — an instrument panel, not a dashboard. The direction comes from
four references the owner chose: a framed bento card with a lava-orange block and a hatched
header, a Dark Void / Liquid Lava / Snow palette, an orange studio wall seen through frosted
glass, and a Swiss technical poster set in monospace with orange annotations. Five rules, and
everything in `css/newtab.css` follows from them:

1. **A frame and its panels.** The app is a Dark Void shell (`--frame`, #151419). The sidebar
   lives on the frame; the main view — and the vertical tab rail, when it's on — are rounded
   paper panels set into it. Where you are and where your work is are two different materials,
   readable at a glance.
2. **One lava accent.** Liquid Lava (#F56E0F; one step deeper, #E8590C, on light paper so it
   clears 3:1) is the only chrome colour. It marks state — the active row's rail, the current
   tab, the primary action, focus, checked boxes, drop targets, finished-progress fills, the
   live pulse — and the full stop at the end of every view title and the wordmark
   ("Collections."). Everything else is ink, paper and four greys. Your own colours (Spaces,
   collections, tags, note tints) stay as wayfinding. Danger is a separate crimson, 50° away
   from the lava, so "this deletes" never reads as "this is selected".
3. **Rectangles hold, pills act.** Containers — panels, columns, cards, popovers — are rounded
   rectangles. Anything you press or type into — buttons, fields, segments, chips — is a pill.
   Single-glyph buttons are circles. A chosen segment is a solid ink disc (snow in dark).
4. **Mono annotates.** JetBrains Mono is the drafting hand: counts, domains, dates, section
   captions (lowercase, lightly tracked, each with a hairline running out to its actions) and
   the lava kicker above each view title. Counts that matter read as large light numerals —
   the live-tab readout ("7 live / open tabs") and each collection's tab count. Settings is
   four numbered plates — 01 Appearance, 02 Backup & sync, 03 Vault, 04 Market ticker — with an
   index beside them that follows your scroll, like the plates of a drawing set.
5. **Hatching means "space to fill".** Diagonal hatch appears only where something is waiting:
   the New collection tile, an Add tab slot under the pointer, drop targets, the empty-state
   mark. Never on content.
6. **One section anatomy.** The top bar names the view. Under it every view has the same head —
   what is here now, one sentence, its tools quiet → loud with at most one lava primary last —
   then captioned groups, then margin notes. States never remove the head; a locked or empty
   state lives in the body and owns its one button.

**Themes.** *Light* is ink on paper inside the void frame. *Dark* is snow on Dark Void inside a
deeper void (#0C0B0E), with Gluon #1B1B1E columns and cards between Gluon and Slate. *Linen* is
the all-paper theme — the frame is warm paper too, walnut ink, one pine accent — for anyone who
wants no dark surface on screen.

**Type scale — 13px base**, exposed as custom properties and multiplied by the per-role text-size
dials in Settings › Appearance:

| Token | Size | Role |
|---|---|---|
| `--t1` | 11px | caption — mono, lowercase: section labels, kicker, units, counts in pills |
| `--t2` | 11.5px | meta — counts, timestamps, domains |
| `--t3` | 13px | base — body, nav, buttons, inputs |
| `--t4` | 14.5px | title — card and collection titles |
| `--t5` | 16.5px | section headings |
| `--t6` | 18.5px | in-view headings |
| `--t7` | 24px | view titles and large numerals |

**Contrast.** Every text token clears WCAG AA on the lightest surface it can land on, in every
theme — verified on rendered elements across all eight views, both tab-bar modes and all three
themes with proper alpha compositing. Lava text uses its own deeper token (`--accent-text`);
the label on a lava fill is ink (5.1:1), never white (3.6:1). Two rules keep it that way:

- **Fade with colour, never with `opacity`.** `opacity` is reserved for genuinely hidden things
  and WCAG-exempt states (`[disabled]`, `.dragging`).
- **A border that *is* the control uses `--edge`** (≥3:1), not the decorative hairlines.

**Responsive.** The header answers to its *panel*, not the window: `.main` is a size container,
so turning on the vertical tab rail folds the header just as a narrower window would — segment
captions go first, then the Stash label (icon-only, still named), then the theme segment folds
into one cycling button, and only then does search drop to its own row. Below 881px the sidebar
becomes a drawer and the header a two-row grid.

Hanken Grotesk + JetBrains Mono, bundled in `fonts/` — no webfont requests. The `new design/`
folder is earlier reference material — delete it before packaging for the Web Store.

## Release (Chrome Web Store)

```
sh scripts/package.sh
```

builds `dist/stacknest-<version>.zip` from an allowlist — the manifest without its dev `"key"`,
`newtab.html`, `css/`, `js/` (minus the dev-only `js/mock.js`), `fonts/` (with `OFL.txt`) and the
icon PNGs — and checks the store limits (description ≤ 132 characters, version format, every file
the manifest names). `node scripts/smoke-test.mjs` then loads that build into a throwaway headless
Chrome as the real extension and walks every view in every theme — it exits non-zero on any
exception, console error, CSP violation or failed load. Upload **only** that zip.
`node scripts/store-assets.mjs` re-captures the
1280×800 store screenshots and the promo tile; `node scripts/render-icons.mjs` re-renders the
icons from `icons/icon.svg`. The listing copy, permission justifications and the owner's launch
steps are in `docs/store/`; the privacy policy is [PRIVACY.md](PRIVACY.md). Bump `version` in
`manifest.json` for every upload.

## Development

The page runs outside Chrome too: serve the folder (`python3 -m http.server`) and open
`newtab.html` — `js/mock.js` shims the `chrome.*` APIs (tabs, windows, storage, bookmarks)
with demo data. The mock never activates inside Chrome.

```
manifest.json      MV3 manifest (new-tab override, toolbar action, CSP)
newtab.html        app shell (sidebar · topbar · tray · board · library)
js/boot.js         pre-paint: applies the remembered theme and sidebar mode (no flash)
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
