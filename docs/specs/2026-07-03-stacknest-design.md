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

## Redesign: Nothing's design psychology, type scale, contrast (2026-07-11)

A full visual pass — CSS only, no markup or feature changes — moving the app from "monochrome
because it looks calm" to actually applying Nothing's *reasoning*.

**The psychology, not the motifs.** Nothing's position is that a device should ask for less of
your attention. The design consequences we adopted: colour is a budget spent once; flatness
removes fake depth that implies importance; exposed structure (the transparent back) treats the
user as someone who wants to understand the tool. The cargo-cult version of this is "black UI
with dots on it", which we deliberately avoided — the dot ground appears only where there is
genuinely nothing else (board canvas, tag graph, empty states), and never behind dense text.

- **One accent.** `--red: #c9141c` light / `#ff4d4d` dark, with an exhaustive permitted-use list
  written into the token comment: the live-tabs pulse, destructive confirm + armed delete, an
  overdue reminder, the duplicate-count badge, ticker-down. The tray pulse moved from green to
  red because that indicator does the same job as a recording light. It is the only permanently
  visible red, and it is 8px.
  Nothing's own red is `#D71921`; ours is a shade deeper because `#D71921` measured **4.35:1**
  as text on `--bg-inset`, under AA. Fidelity lost an argument to legibility, on purpose.
- **Flat everywhere.** Every gradient deleted (`.logo-tile`, `.foot-tile`, `.cloud-dot.pro`,
  `.cloud-badge`), every `--shadow-*` is `none` in both themes, and the raised-chip shadows on
  segmented controls became a fill + hairline. Five hand-rolled rgba blurs on the floating layer
  collapsed into one `--shadow-pop` token so light and dark stay in step.
- **True black.** Dark `--bg` went `#101216` → `#000000`, and the whole grey ramp lost its blue
  cast (`#16181d` → `#171717`, `#868c98` → `#5e5e5e`).
- **Selection inverts.** `--accent-soft` (#e2e2e2) against `--bg-inset` (#ebebeb) was a ~1.04:1
  step — a selected ticker chip was effectively invisible. Chips now invert to solid ink; the
  active nav row keeps the soft fill but gains a 3px marker on its leading edge.

**Type scale — 1.125, base 13px.** Fifteen unrelated sizes became seven tokens (`--t1`..`--t7`),
applied by script across 109 rules, then hand-tuned. Where roles collapsed onto one size, the
hierarchy moved to weight + colour — which is *more* readable than shrinking the subordinate
text, and is what the brief asked for. Verified: the rendered ratios hold at 1.095–1.138
(rounding to half-pixels for crisp stems is the only deviation), and the app renders exactly 7
text sizes. The remaining off-scale values are all legitimate and were checked individually — a
UA-default `13.333px` on a text-less checkbox `<input>`, and the favicon letter-tiles whose size
is computed from the tile dimension in JS.

Radii tightened one step throughout (`6/8/10/12/14/16` → `4/6/8/10/12/14`) across 61 rules;
precision reads as instrument, softness reads as consumer app.

**Contrast, measured not assumed.** The first pass produced six AA failures, all on
`--bg-inset` — the surface a naive "check it on the main background" audit misses. Fixed by
lifting `--text-faint` (both themes), deepening red and green, and opening the dark
mut/faint gap. Final worst case across every text token × every surface × both themes:
**4.82:1**. Separately, `--text-ghost` was being used for `::placeholder` at 2.8:1 — a
placeholder is text, so those four rules moved to `--text-faint`, and `--text-ghost` was pinned
to the 3:1 non-text bar for idle icons only.

Smoke-tested after: all six views render, notes add/toggle/persist, no console errors or
unhandled rejections, and no horizontal overflow at any of the four interface-size zoom levels.

## Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10)

The single-line "todo" was really a reminder, so it was renamed — and **to-do** now means a card
holding a **checklist**, which is what "add todo under the same list" asks for.

| Kind | Shape |
|---|---|
| `note` | `{ title, body }` — body is Markdown |
| `todo` | `{ title, list: [{ id, text, done }] }` — the checklist |
| `reminder` | `{ text, done }` — the old single-line todo |

All three keep `tags[]`, `color`, `scale`, `createdAt` and an optional `reminder`.

**The migration is the dangerous part, and it is shape-driven, not name-driven.** The change renames
`kind:'todo'` → `'reminder'` *and* reuses the name `'todo'` for something with a different shape.
Every record already in `chrome.storage`, in every export and in every Drive backup says
`kind:'todo'`, and the stored blob carried **no version** (only the notes-only export had one). So
`detectKind()` asks about shape first: **a `list` array means a checklist; a `todo` without one is a
legacy single-line task, i.e. a reminder.** A blind rename in either direction destroys one of the
two populations. A stamp (`v: 3`) is written going forward so later changes have something cheaper
to read, but correctness never depends on it. Verified lossless and idempotent from all three
historical shapes, and non-throwing on `null`/junk entries (which previously crashed the view).

A parallel survey of the codebase before writing any code turned up ~90 sites that assumed exactly
two kinds. The ones that would have failed silently:

- `normalize()` is a **whitelist run on every read *and* every write** — an unlisted field isn't
  just ignored, it is destroyed and the destruction is persisted. Every new field (`list`, `scale`)
  had to be constructed in all three branches.
- Focus restore was keyed on `(card id, first CSS class)`. A checklist has N fields sharing
  `.check-text`, so `querySelector` would return row 0 and **throw the caret from row 5 to the top**
  on any render. The key now includes the **row id**.
- `queueSave` was a flat `id → field` map and could not address `list[3].text`; paths are now either
  a field name or `row:<rowId>`.
- The nav badge counted `kind === 'todo' && !done` — a checklist has no top-level `done`, so it
  would have read 0 forever. It now counts unticked reminders **plus** unticked checklist rows.
- `sw.js` suppressed a notification on a top-level `done`, so a **fully completed checklist would
  still nag**. It now treats "every row ticked" as finished, and adds "N of M left" to the message.
- `applyBackup` wrote the incoming notes blob **raw**, so restoring an old backup parked a legacy
  shape in storage. It now migrates on the way in — and re-arms alarms, closing a pre-existing gap
  where a restore or import left reminders with no `chrome.alarms` entry behind them.
- `mergeIn` re-issued only the top-level id; checklist **row** ids could collide across imported
  cards and cross-wire row-addressed saves. Rows are re-issued too.
- The delete confirm's `hasContent` returned false for a checklist full of items, so a populated
  list would have been deleted with no confirmation.

**Markdown** (`js/markdown.js`) is hand-rolled because there is no build step and a strict CSP. It
renders text that may have been pasted or imported, so the ordering is the whole security argument:
escape `& < > " '` **first**, then apply rules that emit only tags we construct, and pass link URLs
through a scheme allowlist (`http`, `https`, `mailto`, `#`). There is no ordering in which raw user
text becomes an element. Two deliberate details: `<u>`/`</u>` is un-escaped by an exact-match rule
(markdown has no underline) that admits no attributes, so no event handler can ride along; and
emitted tags are parked in NUL-delimited slots so a later rule can't chew through one already built
(an asterisk inside an href turning into an `<em>`). 22 payloads — `javascript:` in every casing and
with embedded tabs, `data:` URLs, `onerror`, attribute break-outs — produce zero dangerous nodes.

**Formatting** (`js/format.js`) writes Markdown into the text rather than styling a rich-text
document, so what the toolbar does survives export, import and Drive sync. Three things it gets
right that a naive version doesn't:

- **Native undo.** Assigning `field.value` destroys the browser's undo stack, so ⌘Z would stop
  working inside a note the moment you pressed B once. Edits go through the deprecated-but-only
  `document.execCommand('insertText')`, with a `setRangeText` fallback.
- **`*` vs `**`.** A plain string compare makes italic eat one asterisk off each of bold's markers
  (`**bold**` → `*bold*`). Repeated-character markers compare **run length** instead.
- **Markers hug the text.** Markdown ignores `** spaced **`, so wrapping a selection with trailing
  whitespace would silently render as literal asterisks; whitespace is left outside the markers.

A caret with no selection formats the word it is in — an empty `****` you have to retype into is
useless — and multi-line selections toggle per line, since `**` doesn't span a newline.

**Where the toolbar lives.** Not on the card: the footer already carries a grip, a date and four
actions inside a 250px column, and six more buttons would overflow it. It is **one shared bar** in
`<body>`, moved to whichever field has focus, with `mousedown` prevented so it never steals focus.

**Formatting has to be visible**, or the buttons just litter the text with markers. So every field
renders its markdown at rest and shows source while editing — the note body in full, single lines
(checklist rows, reminders) inline-only. A line with no markdown never swaps at all, staying a
directly-typable input. Each swap is driven by that one field's own focus/blur, never by a render,
so it cannot disturb the caret anywhere else; `restoreFocus` reveals a hidden input before focusing
it, since focusing a `display:none` node silently does nothing.

**A+/A−** is a per-card `--card-scale` custom property (0.85–1.5, five steps) driving every text
size on the card, with the checkbox sized in the same unit so it doesn't detach from its line. It is
independent of the global interface-size setting, which is implemented as root `zoom`.

## Notes: typing bug, task chaining, contrast, guide, undo (2026-07-09)

**The typing bug** (reported: "semicolon and shift then a capital letter won't type sometimes").
Root cause: the view re-rendered on *every* `chrome.storage.onChanged` — including the echo of
its own 400ms debounced auto-save — and `render()` did `root.replaceChildren()`. That destroyed
the focused field mid-word. The symptom singled out shifted characters because **reaching for
Shift is exactly what creates a >400ms pause**, so the destructive re-render landed in the gap
between pressing Shift and pressing the letter. Three layers now protect typing:

1. **The shell is built once.** `buildShell()` creates the header + composer + `.mosaic-host`
   and never replaces them; `render()` only ever swaps the mosaic's children. The composer
   input therefore keeps focus and in-flight text no matter what.
2. **Self-writes don't re-render.** Text edits batch into a `pending` map and flush with
   `{ rerender: false }`; each write leaves a timestamped marker the storage listener consumes,
   so our own echo is ignored. Markers expire after 3s so a coalesced event can't leave a stale
   marker that swallows somebody else's real change.
3. **Focus survives what's left.** Any render that does run snapshots `{card, field class,
   selectionStart/End}` and restores it. External changes arriving mid-edit are deferred to
   `focusout` rather than yanking the field.

Structural mutations `await flushSaves()` first, so a re-render can never resurrect a stale
value over what was just typed.

- **Task chaining**: task text is now an always-live `<input>` (no click-to-edit), so it can hold
  focus across renders. **Enter** inserts a fresh task directly below and focuses it; **Backspace**
  in an empty, untagged, reminder-less task deletes it and steps back up; the composer refocuses
  after Enter. Lists can be typed straight through.
- **Drag handle**: with the whole card surface now covered by live fields (which must not be
  hijacked by drags), reordering needed a grabbable target — a `<span>` grip in the footer
  (a span, not a button, so the drag guard doesn't reject it).
- **Contrast** on the notes bar: a rule under the header, tool buttons at `--accent-border` +
  `--text-strong` that fill with ink on hover, and micro-labels lifted off `--text-mut`
  (~2.9:1 on paper — under AA). Measured with alpha-composited ancestors: sub-line 8.6/8.0,
  chips 7.4/7.4, tool buttons 16.1/14.0, task text 11.6/13.7 (light/dark) — all clear AA.
  Card actions went 0.42 → 0.58 opacity.
- **`?` guide**: a scrollable modal, term-and-definition in two columns (one when narrow),
  covering creating / organising / reminders / undo / backup.
- **Undo**: deleting a card snapshots it with its index and registers an undo/redo pair with the
  shared `history.js` stack — ⌘Z restores it in place with tags, colour and reminder intact and
  re-arms its alarm; ⌘⇧Z re-deletes. The confirm dialog is kept as well, since the undo stack is
  session-scoped and doesn't survive closing the tab.

Two verification artifacts worth recording, both from the preview pane being a *hidden* document
(`document.hasFocus() === false`): blur/`focusout` events never fire (so click-away had to be
driven with a synthetic bubbling `focusout`), and CSS transitions never advance, freezing
`getComputedStyle().color` at the pre-theme-switch value — which is why `.mos-tag` read as dark
tokens on a light page. Neither is a product defect; measuring requires
`transition: none !important` first.

## Notes mosaic: unified cards, drag-order, tags, tints (2026-07-08)

Notes and todos stopped being two separate panels and became **peer cards in one
masonry mosaic**, so both kinds share ordering, tags, tints and reminders.

- **Model**: `{ todos, notes }` → `{ items: [{ id, kind:'note'|'todo', …, tags[], color,
  reminder }] }`. `migrateNotes()` folds the old split shape (and old backups / notes-only
  exports) into `items` on every read, newest-first — verified lossless, preserving
  `done`, `reminder` and note bodies. `sw.js` reads `items` with a fallback to the old shape.
- **Mosaic**: CSS `column-width: 250px` (not `column-count` + breakpoints) so the column
  count derives from the mosaic's own width — the sidebar and `max-width` make it far
  narrower than the viewport, so viewport breakpoints guessed wrong (2 columns at a
  1380px window).
- **Drag to reorder**: whole-card HTML5 DnD on a `text/x-stacknest-mos` payload; hovering
  a card's upper/lower half marks insert-before/after. Drags starting in an input,
  textarea or button are ignored so editing still works.
- **Tints**: 6 pastels applied as a *translucent wash* layered over the card surface
  (`linear-gradient(var(--tint)…), var(--bg-card)`), so one swatch reads as a pastel on
  paper and a quiet wash on ink without hurting text contrast; alpha is nudged up in dark.
- **Reminders now work on notes too**, not just tasks (the alarm/notification path is
  keyed on item id, so it was already kind-agnostic).
- Card actions (bell / tag / colour / delete) sit at 0.42 opacity rather than hover-only —
  hidden actions proved undiscoverable, and one visible icon among invisible siblings
  floated oddly off the right edge.

## Task reminders → browser notifications (2026-07-08)

Any todo can carry `reminder: { at: <ISO local target>, lead: 0|5|10|30|60 min }`. The notification
fires at `at − lead`.

- **Scheduling** (`js/notes.js`): a bell action / chip on each task opens a popover with a
  `datetime-local` input + a "remind me" lead select, live "Notifies …" preview, and Set/Clear.
  On save it stores the reminder on the todo and calls `chrome.alarms.create('reminder:<id>',
  { when: fireMs })`. Completing, deleting, or clearing cancels the alarm; re-opening a done task
  re-arms a still-future one.
- **Firing** (`js/sw.js`): `chrome.alarms.onAlarm` reads the task from storage and calls
  `chrome.notifications.create` — so it fires even with no StackNest tab open, and Chrome delivers
  alarms missed while the browser was closed on next start. Clicking the notification opens a tab.
- **Timezone**: all maths is in epoch ms; the `datetime-local` value is read as local and `Date`
  gives UTC ms, so local zone is handled for free. The chip and hint render via `toLocaleString`.
  Verified a round-trip (local build == local parse) and that fireMs == target − lead.
- **Permissions**: added `notifications` + `alarms`. Native pickers get `color-scheme` so the
  date/time control themes correctly in dark. Mock (`js/mock.js`) stubs `alarms`/`notifications`
  so the flow is testable in the dev preview (the real notification only fires in the packaged
  extension). Reminders live on the todo, so they ride along in backup + Drive sync automatically.

## Notes & Todos view (2026-07-08)

New sidebar view below Duplicates (`js/notes.js`), a nav line-icon + open-todo count badge.
Storage key `stacknest:notes = { todos:[{id,text,done,createdAt}], notes:[{id,title,body,
createdAt,updatedAt}] }`, mutated through the serialized `update()` queue.

- **Todos**: add (Enter), toggle done (custom ink checkbox), click-to-edit inline, delete, "Clear
  completed"; open tasks sort above done ones (strikethrough + muted).
- **Notes**: card grid; title input + auto-growing body textarea, both debounced-autosaved (400ms);
  new note prepends and focuses; delete confirms only when non-empty.
- **Toolbar menus** (progressive disclosure — one button each): Export (full backup incl. notes /
  notes-only file), Import (file / **Apple Notes** paste), Drive (back up / fetch).
- **Backup integration**: `buildBackup`/`applyBackup` now carry `notes`, so the existing local
  backup **and** Google Drive sync include notes automatically (per the user's "in existing backup"
  choice). Notes-only export is a separate `{type:'notes'}` file that import also accepts.
- **Apple Notes**: a browser extension can't reach Apple Notes (no API; sandbox blocks AppleScript),
  so import is by pasting exported text, optionally split into separate notes on blank lines.
- One bug caught in review-by-eye: `.notes-menu { display:flex }` beat the `[hidden]` UA rule so all
  three dropdowns showed at once — fixed with `.notes-menu[hidden]{ display:none }`.

Verified in preview (light+dark): CRUD, badge, autosave, notes-only export shape, Apple-paste
parsing, and a Drive backup→wipe→restore round-trip that brings notes back. No console errors, no overflow.

## Drive: whose Google account? (2026-07-09)

Raised as a worry that other users might end up backing up into the developer's account. They
can't: `oauth2.client_id` identifies the *extension*, not an account, and every install mints a
token for whoever signs in on that machine, writing to that person's own `appDataFolder`. Nothing
is pre-connected. That part needed no code change — but auditing it surfaced a real gap.

`chrome.identity.getAuthToken` uses the **Chrome profile's** account and offers no picker, so a
user signed into Chrome as A but wanting backups in B has no way to say so. Changes:

- **`js/auth.js`** — one module, imported by both the page and the worker, so incognito
  delegation can't drift from the page's behaviour. Two paths behind `mintToken()`:
  `getAuthToken` (default), or `launchWebAuthFlow` with `prompt=select_account consent` when
  `js/authConfig.js` supplies a **Web application** client ID. The web path caches the
  short-lived token under its own key, renews 2 min early, and silently re-mints with
  `prompt=none`.
- **Switch account** in Settings → Cloud sync. On the web path it opens the picker; on the
  default path it throws a specific, actionable message rather than reconnecting the same
  account and looking broken.
- **Disconnect** now revokes *and* calls `clearAllCachedAuthTokens()`.
- Settings states in plain language which account is in use and why — the honest answer differs
  per path, so the copy branches on `canChooseAccount()`.
- The token key is deliberately outside the backup key list; verified that a built backup
  contains no token and no account address.
- The worker became `"type": "module"` so it can share `auth.js`.

## Google Drive sync hardening (2026-07-08)

An adversarial multi-agent audit of the Drive OAuth path (`js/drive.js` + manifest + the
Settings cloud card) found and confirmed six real defects; all fixed and verified by stubbing
`chrome.identity` / `chrome.runtime.getManifest` / `fetch` to drive the live path deterministically:

- **Placeholder detection** — `isConfigured()` reads `oauth2.client_id` and rejects the shipped
  `REPLACE_WITH_…` placeholder. When live-but-unconfigured, the card shows a disabled **"Set up
  required"** with a note, and backup/restore fail fast with a plain message *without* even calling
  `getAuthToken` (no cryptic Chrome OAuth string). Verified: 0 tokens requested on the placeholder path.
- **401 self-heal** — Drive calls run through `withDrive()`, which on a 401/403 evicts the cached
  token (`removeCachedAuthToken`) and re-fetches, escalating to interactive re-consent if the silent
  mint fails. A stale/revoked token no longer bricks every backup/restore. Verified: first list → 401
  → evict → retry → success.
- **Real revoke on Disconnect** — now POSTs to `https://oauth2.googleapis.com/revoke` (added to
  `host_permissions`) before clearing the cache, so Disconnect severs access rather than hiding a label.
- **Plain-language errors** — `api()` maps status → friendly text (401/403 → reconnect, 5xx →
  temporarily unavailable, network → check connection); raw `path → status` goes to `console.error` only.
- **`fetchEmail`** no longer fabricates "Google account"; on failure it stores `null` and the label
  falls back to "Google Drive". State shape gained an explicit `connected` flag.
- **Bonus (unrelated)** — `loadSettings()` was dropping `grammarEnabled` from its return object, so the
  flag never round-tripped; added `grammarEnabled: !!m.grammarEnabled`.

The live path still requires the user's own OAuth client ID + a stable extension ID — see README
"Cloud sync setup". Two audit findings were correctly rejected on verification (a missing manifest
`key` is a setup requirement, not a code defect; the fixed multipart boundary can't collide because
`JSON.stringify` escapes all control chars, so the payload contains no raw CRLF).

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
- **Duplicates — choose which copies to keep (2026-07-07, was radio)**: each occurrence row has a
  **checkbox** (`.dup-keep`); tick **one or several** copies to keep — ticked rows highlight, and
  clicking anywhere on a row toggles it. **Keep selected** deletes only the unticked copies (so a
  single ticked folder removes every other duplicate of that link). The button disables with an
  explanatory tooltip when nothing is ticked (a link must survive) or when everything is ticked
  (nothing to remove). Rows show a COLLECTION/BOOKMARK kind tag; the view scrolls
  (`overflow-y: auto`). Collection removals keep their undo.
- **"Nothing" monochrome redesign (2026-07-08)**: the whole visual system moved from a saturated
  indigo/blue accent to a monochrome **ink-on-paper (light) / chalk-on-ink (dark)** palette. Colour
  is now reserved almost entirely for the user's own data (Space / collection identity dots + tag
  dots), which were themselves re-tinted to a muted, dusty palette so they read as intentional
  against the greyscale chrome. Key moves, all token-driven:
  - `--accent` **is** ink (near-black light / near-white dark), so the primary action inverts
    between themes — a solid black "Stash window" / "Keep one of each" button in light becomes solid
    white in dark. The monochrome signature.
  - All coloured glow shadows removed (`--shadow-btn: none`, flat logo tile, flat column wells with
    hairline borders instead of `backdrop-filter: blur`). Engineered, not glassy.
  - Added a real **4px spacing scale** (`--s1..--s9`) and **radius scale** (`--r1..--r6`).
  - BROWSE nav dots → consistent thin **line icons** (matching the Settings gear); every marker —
    icon rows, dot rows, Settings — now shares one 16px optical slot so all labels sit on one rail.
  - Section micro-labels (BROWSE/SPACES/WINDOWS/COLLECTIONS) retuned to engineered mono: 10.5px,
    0.14em tracking, muted. Generous vertical rhythm between groups.
  - The `rise` view-entrance animation is already gated behind `prefers-reduced-motion`.
  Verified across all five views (board, library, tags, duplicates, settings) in both themes with
  zero console errors and zero horizontal overflow.
- **Interface-size zoom no longer overflows the viewport (2026-07-07)**: the size setting applies
  CSS `zoom` on the root, which multiplies every rendered length — including `.app { height:
  100vh }` — so at Comfortable (1.08) / Large (1.2) the app painted 8–20% taller than the window
  and the pinned Settings/footer clipped off-screen. `applySettings` now also sets `--app-zoom`,
  and the stylesheet divides every viewport unit by it (`.app` height, `#windows-root` cap, the
  ≤880px `min-height`). The tag-popover `place()` is zoom-aware too: rects/viewport are visual px
  while `style.top/left` are layout px, so writes divide by the zoom factor. Verified flush at all
  four scales × several window sizes.
- **Duplicates — one-click clean + Forget (2026-07-07)**: a **Keep one of each** primary button in
  the view header bulk-resolves every group — keeps the first copy of each link, removes the rest —
  behind a `confirmDialog` that states the exact counts (bookmark removals are irreversible).
  Each group card also has a **Forget** button (`.btnx.ghosty`): the link's normalized URL is
  stored under `stacknest:dupforgotten` (`{ url, title, at }`), the group leaves the scan (and the
  sidebar badge and the bulk clean), and it appears in a **Forgotten links** section at the bottom
  (dashed divider) with favicon, title/domain, current `n× saved` count, and a **Restore** button
  that deletes the ignore entry and re-flags the copies. The storage listener also re-renders on
  `dupforgotten` changes.

Verified in preview (light + dark): title no longer edits on click + rename action works; whole-
tile reorder in columns and tiles while tab-card moves still work; all four header icons visible in
tiles; duplicate multi-keep checkboxes + Keep-selected remove exactly the unticked copies. No
console errors.

## Files

```
manifest.json          newtab.html
css/newtab.css         js/app.js (boot, search, events)
js/tabs.js             js/bookmarks.js
js/ui.js (dom helpers, toast, favicon)   js/mock.js (dev-only shim)
fonts/ icons/          README.md (install steps)
```
