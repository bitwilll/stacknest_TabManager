# StackNest — Tab Manager: Design

*2026-07-03 — built autonomously; decisions below are the defaults chosen. Review and ask for changes anytime.*

## What it is

A Chrome extension (Manifest V3) that replaces the New Tab page with a calm, clutter-free
command center for **open tabs** (left column, "Open now") and **bookmarks** (right column,
"Library").

## Scope & decisions

| Decision | Choice | Why |
|---|---|---|
| Stack | Vanilla JS (ES modules), no build step | Load-unpacked works instantly; zero deps |
| Permissions | `tabs`, `tabGroups`, `bookmarks`, `favicon` | Everything needed; nothing more (no history/storage) |
| Tab groups | Native Chrome tab groups via `chrome.tabGroups` | Groups made here appear in the real tab strip too |
| Bookmark "groups" | Native bookmark folders | Interops with Chrome's own manager & sync |
| Opening a bookmark | Navigates the current new-tab page (Cmd/Ctrl-click → background tab) | Seamless, no tab spam |
| Multi-select | None in v1 — drag & drop is the grouping gesture | Less UI chrome |
| Dev preview | `js/mock.js` shims `chrome.*` with demo data when APIs are absent | Page can be styled/tested outside Chrome |

## Features

**Open now (tabs)**
- All tabs across windows, sectioned by native tab group (colored dot + name), then "Ungrouped".
- Click row → activate tab (and focus its window). Hover reveals: bookmark-this-tab, close.
- Drag a tab row onto a group section → joins that group; onto "New group" → creates one; onto "Ungrouped" → ungroups.
- Group header: inline rename, color swatch cycle, **Stash** (saves all tabs into a bookmarks folder under `Other Bookmarks / StackNest Stashes`), close-all.
- Pinned (pin mark) and audible (sound mark) indicators. The extension's own new-tab pages are filtered out.

**Library (bookmarks)**
- Folder-first listing with breadcrumb navigation; folders show item counts.
- New folder inline; inline rename; delete (folders need a confirm second click).
- "Open all" on a folder opens its links **as a named tab group** — the inverse of Stash.
- Drag bookmarks onto folders or breadcrumb segments to move them.
- Drag a tab from the left column into the Library to bookmark it in the current folder.

**Search** — one bar filters both columns live (`/` focuses it; Enter jumps to the first matching open tab, else opens the first bookmark).

## Aesthetic direction

"Quiet library desk": warm paper background, ink text, terracotta accent; Schibsted Grotesk
(sharp display, tight tracking) + Instrument Sans body; hairline dividers instead of cards;
hover-revealed actions; automatic warm dark mode. No dashboards, no glow, no card grids.
*(2026-07-03: display font changed Fraunces → Schibsted Grotesk on user request for a
sleeker, sharper look; italic flourishes replaced with weight contrast.)*

## UX/UI refinement pass (2026-07-03)

Reworked for a cleaner, better-organized experience:
- **Compact sticky app header** replaces the floating hero search — `[wordmark · centered
  search · clock]` in one bar. Reclaims the large dead vertical space; the header stays put
  as tab lists scroll. Search is now a functional recessed field with a leading magnifier
  icon, focus ring, and click-anywhere-to-focus.
- **Two-pane structure**: a full-height hairline divider between "Open now" and "Library",
  shared max-width container so header and columns align to the same edges.
- **Keyboard-first**: `:focus-visible` rings on every interactive element; `↑`/`↓` move focus
  through rows within a column, `↑` from the first row returns to search; `/`, `Enter`, `Esc`
  retained.
- **Active tab** shown as a quiet terracotta left-accent bar + tint (was an off-canvas dot).
- **Details**: unified favicon sizing (`object-fit: contain`), tabular-num counts, on-brand
  thin scrollbars, clock switched to the sans face for clean punctuation, domain hidden below
  480px so titles get the full row, larger touch targets. No horizontal overflow at any width.

## De-clutter pass (2026-07-04)

User reported the UI felt cluttered and asked to import a Claude Design project
(`claude.ai/design/p/dc815756-…`). That import is **blocked**: the Claude Design MCP
(`DesignSync`) needs interactive `/design-login` (unavailable in this non-interactive
session), the share URL is 403, and no Chrome browser is connected to drive the authed
session. Pending the real design, applied a general clutter-reduction pass instead:

- **Removed the per-row domain text** — every tab/bookmark row is now just favicon + title.
  The favicon identifies the site; the full URL stays in the row tooltip. Search still matches
  on the URL. (Dropped `domainOf` usage + unused imports in `tabs.js`/`bookmarks.js`.)
- **Removed the hairline between every row** — rows separate by whitespace + hover wash only.
- **Removed the full-height column divider** and the **persistent footer hint** — columns
  separate by generous whitespace; the two header underlines are the only structural lines.
- **Softened group labels** (less tracking/size) so they read as quiet section markers.
- More breathing room (row padding, group spacing); both light + dark themes re-checked for
  contrast. Verified clean at 1280px, 375px; no console errors; keyboard/search/folder-nav intact.

**To finish importing the real design**: authorize `/design-login` in an interactive `claude`
terminal, or share the project's exported HTML/CSS (or its tokens + screenshots) — then the
specific colors/components can replace this interim treatment.

## Spaces — Toby-style collections (2026-07-04)

Added a Toby-like layer and reshaped the page into **three columns**: Open now · Spaces · Library
(user chose 3-column over sidebar/segmented). New permission: `storage`.

**Spaces** = named, persisted tab collections in `chrome.storage.local` (`js/spacesStore.js` is the
pure data layer; `js/spaces.js` the column UI). Per space: **Open all** revives it into a *new
window*; inline **rename**; **delete** (confirm-twice); **+ space** for an empty one; drag a tab in
to stack it. Newest first. Saved tabs are draggable too — drop one on another tab to reorder
(insert-before) or on another space to move it (`SPACETAB_MIME` vs the open-tab `TAB_MIME`, so the
two drop paths never collide). `moveSpaceTab` handles the same-list index shift. Whole spaces
reorder by dragging the header dot (`SPACE_MIME`); `reorderSpace` inserts before the drop-target
space, or moves to the end when dropped on the column background.

**Open now** reorganized from tab-groups → **by window** ("This window" for the focused one, then
"Window N"). Each window header offers **Save** (copy tabs into a new Space, keep open) and
**Stash** (copy into a Space **and** `chrome.tabs.remove` the tabs → frees RAM; the StackNest
new-tab is filtered out so the dashboard survives). Tab-group *sections* were dropped to keep the
3-column layout uncluttered; `tabGroups` permission stays only for Library's open-all.

**Library** unchanged — the separate, synced bookmarks area. Split rationale: Spaces = local
working sets you park/revive; Library = permanent Chrome bookmarks.

Data model: `{ id, title, createdAt, updatedAt, tabs: [{title, url}] }`. Favicons resolve from the
URL via Chrome's `_favicon` cache, so saved (closed) tabs still show icons. Storage-change events
drive re-render. Verified in preview (light + dark): save, stash-closes-tabs, revive-opens-window,
rename, drag-to-stack, delete, and cross-column search all work; no console errors.

*Dev note:* the `_favicon`/module cache in the python preview is aggressive — bump the dev port
(`.claude/launch.json`) to force a clean module reload when iterating.

## "Stash" design implementation (2026-07-06)

Implemented the user's Claude Design project (`fb6ea5c6…`, file `new design/Stash - Tab
Manager.dc.html`, delivered locally after MCP auth stayed blocked). The file contains three
directions; per its own light/dark toggle, **option 1a = light theme** and **option 1c = dark
theme**, switched by the topbar sun/moon segment (persisted in `localStorage`, default follows
system). Fonts: **Hanken Grotesk + JetBrains Mono**, bundled locally.

Layout (replaces the three-column page): app frame with **sidebar** (logo, BROWSE nav =
Collections/Library views, WINDOWS section with per-window save/stash, COLLECTIONS list with
counts + "+"), **topbar** (view title, ⌘K search, theme toggle, primary **Stash window**
button), **open-tabs tray** (current window's tabs as chips, green pulse count, "Save all →"),
and the **collections board** — horizontal kanban columns on a dotted grid, each column =
one saved collection (colored dot cycles the design's 7-color palette and is the drag handle
for reordering; inline rename; open-all; confirm-twice delete; "Add tab" ghost accepts a
pasted URL; hover-revealed actions). Tab cards use the design's **letter-tile** treatment:
pastel plate hue-hashed from the domain with the favicon layered on top (letter shows if the
favicon fails). Library view renders bookmarks as the same card language in a responsive grid
with breadcrumbs. All drag flows kept: chip→column/nav-item, card between columns/reorder,
column reorder, bookmark→folder/crumb; dropping a chip on the sidebar Library item bookmarks
it. `tabGroups` permission dropped (revive and open-all now open a **new window**).

Verified in preview (light + dark): save-all (kept 7 tabs open), stash (closed 7), revive
(new window), rename, dot color cycle, add-by-URL (auto-https), card move, column reorder,
chip→Library bookmark, view switching, ⌘K/`/` search filtering — no console errors; token
spot-checks match the design exactly (#4c8dff/#06111f button, #0b0e12 sidebar in dark).

## Sidebar upgrades (2026-07-06, second pass)

- **Collapsible windows**: each WINDOWS row is now an expander (chevron rotates; row click or
  Enter toggles; state in a session-scoped `expandedWindows` set). Expanded, it lists that
  window's tabs (18px letter-tile + title): click activates the tab + focuses its window,
  hover reveals close, and every row is **draggable** with the same `TAB_MIME` payload as tray
  chips — so it drops onto board columns, sidebar collection rows, the New-collection ghost,
  and the Library. A non-empty search **auto-expands** windows containing matches and filters
  their rows. `#windows-root` caps at 34vh and scrolls.
- **Sidebar collection actions**: hover a COLLECTIONS row for **rename** (inline input) and
  **delete** (confirm-twice) — same operations as the board column header, now reachable from
  the sidebar. Rows changed `<button>` → `div[role=button]` (nested buttons are invalid HTML).
  `.nav-acts` buttons are 22px so rows don't jump on hover.

Verified in preview: expand/collapse both windows, drag win-tab → column (3→4) and → sidebar
row (2→3), close-from-dropdown, search "noodles" auto-peeked only the matching window, sidebar
rename persisted, sidebar delete armed then removed. No console errors.

- **Open-window button** (third pass): non-current window rows get an **open** action (window
  icon, leftmost, next to save/stash) that focuses that window via `chrome.windows.update`.
  Omitted on the current window's row. Mock's `windows.update` now makes `focused` exclusive
  so the swap is testable; verified the row relabels to "This window" and the tray switches
  to that window's tabs.

## Collection curation pass (2026-07-06)

Six additions to the collections system (`js/spaces.js`, `js/spacesStore.js`, `js/ui.js`):
- **Collapse/expand** per collection via a header chevron. `space.collapsed` persisted through a
  new `setSpaceProp` (no `updatedAt` bump — it's UI state). Collapsed columns drop to
  `height:auto`; a live search **auto-expands** them so matches stay visible.
- **Reorder collections** by dragging the column color-dot *or* a sidebar collection row
  (both emit `SPACE_MIME`; the ghost + every column + every sidebar row accept it → `reorderSpace`).
  Sidebar `dragstart` is guarded so dragging from `.nav-acts` or the rename input doesn't start a move.
- **Move saved links** between collections by dragging cards (`SPACETAB_MIME`) onto a column *or*
  a sidebar collection row; drop onto a card to insert-before.
- **Duplicate protection**: `normalizeUrl` (drop www / trailing slash / hash / case) backs
  `addLinkChecked` + `moveLinkChecked`. A dupe prompts a promise-based `confirmDialog` ("Link
  already exists — Add/Move anyway"); decline = no-op. Applied to URL-add, tab-drop (column +
  sidebar), and cross-collection moves. Fixed a latent Enter+blur **double-commit** in `addTabGhost`.
- **Export** to a Netscape bookmarks `.html` (`buildBookmarksHtml`, HTML-escaped) via
  `exportDownload` (blob + anchor). Per-collection (header download icon) and all (COLLECTIONS
  heading icon → `exportAll`); empty collections skipped.
- **Open-all guard**: `revive` asks via `confirmDialog` when a collection has **>10** links.

Verified in preview (fresh port each cache-bust): collapse persist + search auto-expand; dedupe
add (one modal, trailing-slash match, cancel blocks) and non-dupe silent add; export per-collection
(1 folder) + all (3 folders, 17 links) as valid Netscape HTML; open-12 confirm (cancel=no window,
confirm=+1); board dot-drag + sidebar-row reorder; link move between collections; move-into-dupe
confirm. Light + dark visually confirmed. An adversarial multi-agent review workflow
(`stash-collections-review`) cross-checked all six dimensions.

## Spaces, Settings, Backup + hardening (2026-07-06)

Landed a large pass; first fixed 7 confirmed findings from an adversarial review of the
collection code, then built three features on top.

**Foundation / fixes** (`js/store.js` new):
- **Serialized write-queue** — `queued()` chains every read-modify-write; `update(key, fb, fn)`
  re-reads inside the critical section. All store mutations route through it → the concurrent
  read-modify-write data-loss race (two fast edits clobbering) is gone.
- `normalizeUrl` (ui.js): keep the **port** (`url.host`) and **preserve path/query case**; only
  scheme+host are lowercased — no more localhost:3000 vs :4000 or `?v=ID`-case false dupes.
- `moveSpaceTab` takes a **linkKey** and re-resolves the source index by URL identity inside the
  queue (a mutation during an open confirm dialog can't move the wrong tab); the same-collection
  move-to-end **off-by-one** guard is now `toIndex != null`.
- Sidebar collection **jump()** clears the search + re-renders when the target column is
  search-hidden, then flashes it (targets by `data-id`, not index).

**Spaces / environments** (`spacesStore.js`): a workspace layer. Each collection carries a
`workspaceId`; `loadActiveSpaces()` scopes the board + COLLECTIONS list to the active space.
`ensureWorkspaces()` migrates existing data into a default "Personal" space on first run.
Add/rename/delete space (delete removes its collections, keeps ≥1, fixes the active pointer),
switch active, and drag a collection onto a SPACES row → `moveSpaceToWorkspace`. New SPACES
sidebar section; `stashWindow`/`saveWindow` land in the active space.

**Settings** (`settings.js`, new view): interface font + mono font (offline-safe stacks) →
`--grot`/`--mono`; interface size → `documentElement.zoom`. Persisted; applied before first paint.

**Backup** (`backup.js`): export JSON of workspaces + collections + settings, optionally the
bookmark tree; import validates (`app:'StackNest'`), confirms (danger), replaces via a queued
batch, rebuilds bookmarks under a new "StackNest Import" folder, and fires `stacknest:imported`
so app.js re-applies settings + re-renders.

Verified in preview: space switch (Personal↔Work swaps the board), new/rename/delete space,
drag collection between spaces, font + size settings apply/persist, export (with/without
bookmarks) JSON shape, import event re-renders, and the three regression fixes (port dedupe,
move-to-end, filtered-jump). Light + dark. A second adversarial review workflow
(`stacknest-spaces-settings-review`) swept the new modules.

## Fix: invisible collection-header actions (2026-07-06)

The column-header actions (export / open-all / delete) were permanently invisible: `.acts` is
`opacity: 0` by default and the only reveal rule was `.tcard:hover .acts`, but the header row is
not a `.tcard`, so they never showed (and reserved dead space after the count). Fixed to match the
sidebar pattern — header `.acts` are `display: none` at rest and revealed on `.colcard:hover /
:focus-within`, where they take the count's place (`.col-count` hides on hover). Touch (`hover:
none`) shows them always. Resting headers now read cleanly `[chevron][dot][name][count]` with the
count flush to the edge.

## Undo / redo for deletes (2026-07-06)

`js/history.js` — **command-based** undo/redo for destructive board actions (delete collection,
delete space, remove saved link). Each delete pushes `{ label, undo, redo }` where `undo`
restores *only that item* (via new store helpers `insertSpaceAt` / `insertTabAt` /
`restoreWorkspace`) and `redo` re-deletes it — so undo never reverts unrelated edits made
afterwards (the failure mode of whole-state snapshots). In-memory session stacks (cap 100).
Space-undo also re-adds the space's collections and re-activates it.

UI: a transient bottom-right snackbar (`#undo-bar`) — "Deleted X · Undo" after a delete, then
"Restored X · Redo" / "Deleted X · Undo" as you toggle; auto-hides after 7s. Keyboard:
**Cmd/Ctrl+Z** undo, **Cmd/Ctrl+Shift+Z / Ctrl+Y** redo (skipped while typing in an input or a
contenteditable so native text-undo still works). Verified: collection/space/link delete →
undo → redo via both the button and the keyboard; space-undo restores its collections and
reactivates it. No console errors.

## Reorderable Spaces / drag-and-drop (2026-07-06)

Spaces (environments) in the SPACES sidebar are now **draggable to reorder**, matching the
collections' reorder gesture. Each `.ws-row` is `draggable` and emits a dedicated
`WS_MIME = 'text/x-stacknest-workspace'` payload — separate from the collection `SPACE_MIME`,
so the existing *drop-a-collection-onto-a-space* move and the new *reorder-the-spaces* drag
never collide on the same row (each row is a drop target for both; each handler ignores the
other's MIME). `reorderWorkspace(fromId, beforeId)` in `spacesStore.js` (mirrors `reorderSpace`)
does the move through the serialized write-queue.

Drop is **position-aware**: a per-row `dragover`/`drop` handler compares the pointer's Y to the
row midpoint — top half inserts *before* the row, bottom half *after* it (before the next row, or
to the very end past the last row) — so every slot is reachable. An accent drop-line (`::after`,
`.drop-before` / `.drop-after`) previews the landing spot; `.navx.dragging` fades the source.
`dragstart` is guarded so grabbing the rename/delete buttons doesn't start a move.

Verified in preview (dark, 1280px): reorder down (Personal→below Work) and back up both persist
to storage; the active-space highlight follows the active id (not position); the collection→space
move still works and shows its distinct `.drop-target` box; the action-button dragstart guard
suppresses the drag. No console errors.

## Settings pinned bottom-left (2026-07-07)

Moved **Settings** out of the top BROWSE nav to the **bottom-left** of the sidebar — a pinned
row just above the `SN` footer — so it frames the column symmetrically against the logo at the
top-left. It swaps its old colored dot for a **gear icon** (inline stroke SVG in a `.nav-ic`
lead slot; `currentColor`, so it dims at rest / brightens when active like the row text).
Structure: a `.side-settings` wrapper (reuses `.side-sec` padding, so it stays flush-left with
the other nav rows) carries the single hairline divider (`border-top`) that used to live on
`.side-foot`, giving one clean line separating the bottom cluster (Settings + branding) from the
scrolling COLLECTIONS list. It keeps `class="view-link" data-view="settings"`, so the existing
view-switch + `is-active` wiring is unchanged.

Verified in preview (light + dark, 1280px): BROWSE now lists only Collections + Library; the
Settings row sits above the footer at the bottom-left (left: 12px), renders the gear, click opens
the Settings view (title + populated `#settings-root`) with the accent-soft active treatment, and
toggles off when leaving. No console errors.

## Cloud sync · views · tags · duplicates · ticker (2026-07-07)

A five-feature batch. The three fully-local features are verified end-to-end in preview;
the two with external dependencies were built with the user's explicit go-ahead (Google
Drive real code + UI; CoinGecko/FX ticker accepting outbound requests).

**Tile view** (`app.js` + CSS): a columns/tiles segmented toggle in the topbar (only shown on
the board). Tiles mode is a CSS reflow — `#board-root.tiles` turns each collection into a
full-width section whose `.colbody` becomes a `repeat(auto-fill, minmax(190px,1fr))` grid of
vertical tiles; all drag/collapse/rename logic is unchanged. Mode persists in `localStorage`
(`stacknest:boardmode`).

**Tags + mind-graph** (`tags.js`, new view): any saved link or bookmark can carry multiple
tags. Tags are stored once per **normalized URL** in `chrome.storage.local` (`stacknest:tags` =
`{ key: { url, title, tags[] } }`), so a URL shares tags across collections and the Library. A
`tag` action on every collection card and bookmark card opens an inline popover editor
(chips + typeahead of known tags). Cards show up to 3 inline tag chips. The **Tags view** has a
tag filter bar (with counts), a deterministic **mind-graph** (SVG: tag hubs on a ring, items
clustered around their tag(s), edges item→tag; hubs click-to-filter, item dots click-to-open),
and a per-tag grid ("sorting space"). spaces.js/bookmarks.js re-render on `stacknest:tags`
changes so chips stay live.

**Duplicates view** (`duplicates.js`, new view): flattens every saved link across all
collections + the whole bookmark tree, groups by normalized URL, and lists groups with 2+
copies (most-duplicated first). Each occurrence shows where it lives; a per-copy remove and a
"Keep one" (remove all but the first) prune redundancy. Collection removals use the same
command-undo as the board; bookmark removals rely on Chrome's own undo. Nav badge = redundant
copy count.

**Cloud sync — Google Drive** (`drive.js` + Settings card): `chrome.identity` OAuth + the Drive
**appDataFolder** REST API keep a single private `stacknest-backup.json` (invisible in the user's
Drive). `connect` / `disconnect` / `backupNow` / `restoreLatest` reuse `buildBackup`/`applyBackup`
from backup.js. Manifest gained `identity`, an `oauth2` block (placeholder client_id — the user
supplies their own and loads the extension keyed), and `host_permissions` for googleapis. Outside
the packaged extension (`!isLive()`) the same API is backed by an in-memory store so the whole UX
is exercisable in preview. **StackNest Cloud (Pro)** is a disabled "coming soon" placeholder — a
hosted subscription backend that does not exist and was not fabricated.

**Market ticker** (`ticker.js` + Settings card): a live crypto+FX marquee beside the search bar,
**off by default**. Crypto from CoinGecko (`simple/price` with 24h change), FX from open.er-api.com,
both quoted against a configurable **reference currency**; which crypto/FX tickers show is chosen
in Settings. Refreshes every 60s, pauses on hover, gracefully shows "unavailable" on fetch
failure. Settings schema (`settings.js`) extended with `tickerEnabled/tickerBase/tickerCrypto/
tickerFx`, all sanitized in `loadSettings`. Manifest `host_permissions` cover the two APIs.

Also: `app.js` now re-renders a view when it's opened; `mock.js` fires bookmark events and seeds
`stacknest:tags`, so Library/Duplicates/Tags reflect live changes in preview. Verified (light +
dark, 1280–1320px): tile toggle + persistence; tag add/remove + graph + filter; duplicate detect
(3 groups) + prune + counts; Drive connect→backup→restore (preview shim); ticker live prices
(BTC/ETH/SOL + USD/EUR/GBP) + base-currency switch. No console errors.

## Collection-tile & duplicates refinements (2026-07-07)

- **No accidental rename**: the board column title is now a display-only span (was
  `contenteditable`). Renaming is an explicit **rename** action added to the column header
  (`startColRename` swaps in an inline input) — a click on the title never edits it.
- **Whole tile is the drag handle**: the entire `.colcard` is now `draggable` and emits
  `SPACE_MIME` for reordering, in **both** column and tile views (the color dot is now click-to-
  recolor only). The dragstart is guarded (`input, textarea, [contenteditable], .acts, .col-chev`)
  and tab cards keep `stopPropagation`, so moving a saved link still fires `SPACETAB_MIME`, not a
  tile move. Header shows a `grab` cursor.
- **Tile view keeps the header icons visible**: in tiles mode the column header actions
  (rename/export/open-all/delete) are always shown (not hover-gated), and the count stays visible.
- **Duplicates — choose which copy to keep**: each occurrence row now has a **radio**; the
  selected row is highlighted, clicking anywhere on a row selects it, and **Keep selected** removes
  every other copy (replaces the old "keep the first" behaviour). Rows show a COLLECTION/BOOKMARK
  kind tag; the view scrolls (`overflow-y: auto`). Collection removals keep their undo.

Verified in preview (light + dark): title no longer edits on click + rename action works; whole-
tile reorder in columns and tiles while tab-card moves still work; all four header icons visible in
tiles; duplicate radio selection + Keep-selected removes the right copies. No console errors.

## Files

```
manifest.json          newtab.html
css/newtab.css         js/app.js (boot, search, events)
js/tabs.js             js/bookmarks.js
js/ui.js (dom helpers, toast, favicon)   js/mock.js (dev-only shim)
fonts/ icons/          README.md (install steps)
```
