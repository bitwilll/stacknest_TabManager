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

### Follow-up: two gaps the token audit could not have caught

A parallel design-research pass (Nothing's published language, three judged directions) landed
after the first push. Most of its spec was **not** adopted — it wanted the palette rewritten to
warm greys on brand claims ("N-Grey #DCD7D2") that could not be sourced, against a palette
already measured on the live page. But it made two objective accessibility claims that were
verified and were both real:

1. **Fading with `opacity` is unmeasurable, and it failed.** The token audit compared *colours
   against surfaces*; it never evaluated a *rendered element with `opacity` applied*.
   `.mos-acts .icb { opacity: .58 }` composited to **1.95:1** and `.mos-grip { opacity: .55 }`
   to 2.30:1 — both under the 3:1 that WCAG 1.4.11 requires of controls. No token change can
   repair this, because `opacity` multiplies the alpha of whatever colour it is given. The rule
   now is: **fade with colour, never with opacity.** Idle controls take `--text-ghost` (already
   floored at 3:1) and brighten to `--text-soft` on hover. `opacity` survives only where the
   element is genuinely hidden (`.acts` at 0, revealed on hover) or WCAG-exempt (`[disabled]`,
   `.dragging`) — hidden content has no contrast requirement.
2. **A border that IS the control needs 3:1.** Measured: `.searchbox` 1.25, `.btnx.ghosty` 1.25,
   `.set-select` 1.53, `.addtab` 1.53, unchecked `.todo-check` ~1.4. These are components whose
   only visual definition is their outline. `--line-strong` could not simply be darkened because
   it doubles as a decorative hairline, so a new additive token **`--edge`** (0.45 alpha light /
   0.38 dark, both 3:1) was introduced and pointed at the 13 controls where the border is the
   sole affordance. Dividers keep `--line` / `--line-strong` and stay quiet.

A third claim — that a translucent `--bg-col` over the dot lattice makes contrast inside a column
indeterminate — is true in principle and was measured at a **~3% luminance swing** between a lit
and an unlit lattice cell (backdrop varies #F8F8F8–#FFFFFF). Rejected: making columns opaque
would delete the "structure shows through" idea, which is the whole point of the dot ground, for
a variation that moves no ratio past a rounding place.

Final: every text token ≥ **4.82:1** (4.5 bar) and every non-text token ≥ **3.01:1** (3.0 bar),
across both themes and all four surfaces.
## Design-chief polish + launch readiness (2026-10-09)

The owner: "fix minor indentation and placement, also font size issues, and make this app launch
ready … make sure the appropriate icons are added where needed [only put icons where needed] …
while collapsing the side bar, make the side bar icons a little bigger and stylish."

**Method.** Five measured audits (placement · type · icon coverage · the collapsed rail · Chrome
Web Store readiness) on private servers; a design-chief synthesis resolved their conflicts into one
change list (29 CSS, 15 JS, 3 HTML items); the launch auditor went on to build the store kit.

**Placement.** One left edge in the sidebar (logo, view icons and captions at 22px), caption buttons
on the count-pill column, the column header on the cards' 12px inset, state and tools sharing one
centre line when a head has no note, scope/numeral/unit on one baseline, the column count on the
name's baseline, the vertical tab rail's hairline continuing the top bar's (`--top-h`), Notes and
Duplicates row glyphs on their neighbours' insets, crumbs on the head's text edge, index lists
hanging into the gutter, one 36px control height (`--ctl-h`), tools that start on the scope's edge
when the head stacks, and the sidebar markup re-indented.

**Type.** `--t1` is 11px (the smallest real text), captions and counts share it; timestamps moved
to `--t2`; popover chips match card tags; help text is grotesk, never mono prose; one section-heading
style (750 / --t5); control labels at 600 with only the primary at 700; view titles get line-height
1.25 so descenders never clip; Settings' text-size previews use the weights of the text they control.

**Icons — only where they help.** New glyphs: trash, library, columns, key, merge, cloudUp,
cloudDown, reset, paste. A permanent delete wears trash (× stays for remove/close/clear); a move or
go-to wears its destination (Library = books, Collections = columns); Drive arrows show direction;
the Vault's PIN actions wear a key; "Keep one of each" (the only head primary without one) gets
merge; the Library nav glyph no longer copies Stash's archive box; one tag glyph everywhere; every
labelled pill draws its glyph at 15px (13 in small pills, 16 when folded to a circle). Dead glyphs
(logo, sun, moon, refresh, person) removed. Badges cap at "99+" (`badgeText`).

**The rail.** 72px, one centre line for every mark; 40px view tiles with 20px glyphs (34/18 on
short windows); Spaces as 36px rings in their colour with the initial (filled when chosen); a dashed
new-Space slot; crisp count badges cut out of the tile; state drawn once (snow tile + lava edge);
anchored name tooltips (`data-tip`, so no doubled native title), keyboard- and reduced-motion-safe.

**Launch.** Manifest: description 124/132, `short_name`, `homepage_url`, `minimum_chrome_version`
128, a toolbar `action`, a strict `extension_pages` CSP with `connect-src` for exactly the four API
origins, and **no host permissions** (all four answer CORS). New brand icons (`icons/icon.svg` →
16/32/48/128). `scripts/package.sh` (allowlist zip, key stripped, mock excluded, store limits),
`scripts/smoke-test.mjs` (real extension, headless Chrome, every view × theme), `scripts/store-assets.mjs`
(1280×800 screenshots + promo tile), `scripts/render-icons.mjs`. `PRIVACY.md`, `docs/store/`
(listing, permission justifications, launch checklist), `fonts/OFL.txt`. Code: the "StackNest
Cloud PRO" teaser removed; developer copy out of the UI; Switch account only where Chrome can pick;
the ticker credits CoinGecko and ExchangeRate-API, caches FX an hour, pauses while hidden, times out
and keeps last-good prices; the worker re-arms reminders on install/update and startup.

**Verified.** Rendered-element contrast audit: zero AA failures across 8 views × 3 themes × 2
tab-bar modes × 2 sidebar modes; no horizontal overflow in any of them; every rail mark centred at
x=40 with no overflow; real-extension smoke test (store build and dev build): 0 exceptions, 0
console errors, 0 CSP violations, 0 failed loads.

## Section system + bento sidebar (2026-10-06)

The owner: "design the proper section and make sure it is well organized", then "make the side
bar a little more interesting and responsive, making it easy to read."

**How it was designed.** Nine auditors (one per section: board, My Space, Vault, Library, Tags,
Duplicates, Notes, Settings, app chrome) inventoried every control and its handler and listed
organization problems. Three independent proposals (consistency-first, scannability/ADHD-first,
minimal-risk) were scored by three judges (product design, codebase/feature safety,
accessibility/cognitive load); the judges split, so one spec grafted P3's mechanics, P1's anatomy
and P2's primary-action rules, and resolved every must-fix. The spec carried a per-section
preservation checklist; eight builders implemented it in parallel on disjoint files, a reconcile
pass audited classes/imports/syntax, and nine adversarial reviewers checked each section against
its checklist. Their 33 findings were all fixed, then four more reviewers verified the fixes and
the new sidebar.

**The section anatomy (rule 6).** `js/ui.js` gains `sectionHead` / `secState` / `setSecNote` /
`secGroup` / `noMatch` / `goTo` / `tabSourceHint` / `plural`, `emptyState` variants (`gate`,
`caption`, `steps`) and `confirmDialog({ alert })`. Every view renders `.sec-top` (trail? · head ·
bar?) → `.sec-body` of captioned `.sec-group`s → `.sec-foot?`. The head: scope, large light counts
(the first equals the sidebar badge), a "matching" chip with its own ×, one sentence, tools quiet →
loud with at most one lava primary. Heads are sticky on desktop (static at ≤880 and ≤700px tall);
`--sec-top-h` (published by a ResizeObserver) sets each scroller's `scroll-padding-top` so focus is
never hidden under the head. One `--gutter` aligns title, head, tray and content; one link-card grid
anatomy for `.tabcard` and `.bmcard` (full title up to two lines, domain + actions, tags).

**Per section.** Board: the layout switch, export and New collection moved from the top bar into
the board's head; empty Space is one drop-target block. Top bar: **Save window** (was "Save all →"
in the tray) sits beside Stash & close on every view. Library: trail above the head, folder scope,
folders/links groups, the new-folder field as the first folder cell. Tags: an index column (strip
when narrow) beside one graph or list. Duplicates: one primary with its true scope under it, cards
with visible keep-state text, forgotten links as an aside column on wide panels. Notes: one
"Backup & import" menu (grouped, keyboard-operable, clamped on screen), the New ▾ primary, the
composer as the head's bar. Settings: four numbered plates (Appearance · Backup & sync · Vault ·
Market ticker) with an index that follows the scroll, margin notes, switches, and exactly one lava
button. Vault/My Space: the head always renders; locked states are a gate card owning its button.

**Sidebar.** Bento tiles on the frame, one per group, each caption inside its tile; labels 13.5px
(15px in the drawer) in `--text-body`; view icons in 28px tiles that invert to a snow disc when
active; mono count pills; the active Space washed in its own colour; Windows moved below
Collections. Responsive: compact rows when the window is ≤760px tall, 44px touch rows in the ≤880
drawer (now with a close button, focus management and everything behind it `inert`), and an icon
**rail** (`#side-collapse`, `data-side='rail'`, remembered in localStorage) that keeps every view
one click away with count badges and folds Collections/Windows behind the expand button.

**Second verification round** (four lenses: fixes landed · sidebar features · accessibility +
responsive · cascade) found 25 more items, all fixed: a pre-paint `js/boot.js` (classic script in
<head>) applies the remembered sidebar mode *and theme*, so neither flashes on a new tab; New space
from the rail expands the sidebar first, and in the drawer the board waits until the name is in;
rail Spaces carry their initial in a ring of their colour (not colour alone) and the active row has
`aria-current`; very short windows (≤640px tall, e.g. a tiled laptop window) scroll the whole
sidebar as one column; Linen's active-Space marker is deepened to clear 3:1; rail badges use the
caption size; captions keep every letter beside an aside; the collections scope wraps instead of
truncating; the search keeps one width on every view (a 154px title slot); crumbs align with the
head text; the Tags strip only takes the wheel while it can still move, and its nudges convert
zoomed px; graph labels grow at ≤520; Settings' sticky index strip gets scroll padding.

**Verified.** Rendered-element contrast audit: zero AA failures across 8 views × 3 themes × 2
tab-bar modes × 2 sidebar modes; search width constant across views (1440 and 1280); no overflow at
1440, 1280, 1024 (with the vertical rail), 683×384 and 375; drawer inert/focus checks; New space
from the rail and the drawer. Flagged, unchanged: search-Enter still falls back to a board card
from other views (a behaviour change needing the owner's yes).

## "Precision" redesign from reference images (2026-10-06)

The owner supplied four references and asked for a redesign with every feature and function
unchanged: a framed bento card ("Impact." — lava block with a hatched header, a big light "72",
a mono `client: NOVA` caption between circular arrow buttons); a palette sheet (Dark Void
#151419, Liquid Lava #F56E0F, Gluon #1B1B1E, Slate #262626, Dusty #878787, Snow #FBFBFB); an
orange studio wall behind frosted glass; and a Swiss technical poster ("Craft & Precision") set
in monospace with small orange annotations and hairline rules.

**What changed (CSS-first; behaviour untouched).**
- *Shell.* `body` is `--frame`; `.app` pads the frame around rounded panels (`--panel-r` 18px,
  `--frame-gap` 8px). The sidebar sits on the frame and re-declares the ink tokens for that
  surface (`:root:not([data-theme='linen']) .side { … }`), so every row, count, rename field and
  drop line inside it works unchanged. `.main` and the vertical tab rail (`data-tabsbar='side'`)
  are panels; `.main` clips to its radius.
- *Palette.* Light: paper #ECECE9, columns #F6F6F4, Snow cards, ink #151419, accent #E8590C
  (lava one step deeper so it clears 3:1 on paper), `--accent-text` #A33E08, crimson danger
  #B3243A. Dark: Dark Void panels in a #0C0B0E frame, Gluon columns, lava #F56E0F as-is.
  Linen: unchanged tokens, frame is paper (#ECE5D9) — the all-light option. New tokens:
  `--frame`, `--hatch`, `--pill`, `--panel-r`, `--frame-gap`, `--red-contrast` (the dark danger
  is light, so its label is ink — fixes white-on-#ff6b6b at 2.8:1 in the danger confirm).
- *Shape.* Containers are rounded rectangles; buttons, fields, segments and chips are pills;
  single-glyph `.icb` buttons are circles (`.armed` grows into a pill). Segments show the chosen
  option as a solid ink disc.
- *Type.* Captions (`.side-label`, `.side-nav-label`, `.tray-label`, `.seg-label`, `.view-kicker`,
  popover headers…) are one rule: mono, lowercase, 0.06em. Sidebar captions carry a hairline
  out to their actions. `--t7` is now 24px and sets the view title, which ends in a lava full
  stop (`.view-title::after`), as does the wordmark. The kicker is lava ink led by a short rule.
- *Numerals.* The tray count is a large light numeral beside "live / open tabs" — `tabs.js`
  now renders `.tray-num` + `.tray-unit` spans instead of one text node (same words, same
  element). Each collection's count is a large light numeral in its header.
- *Hatching* only on space-to-fill: `.newcol`, `.addtab:hover`, `.drop-target` (lava hatch),
  `.empty-ic`.
- *Settings* cards are numbered 01, 02… with a CSS counter on `.set-h::before`.
- *Vault / My Space* states now use the shared `emptyState()` (the old `.lib-empty` blocks had
  their buttons left-aligned under centred text); dead `.lib-empty` / `.vault-shut` CSS removed.
  Bookmark folder tiles are ink, not accent — a folder is a kind, not a state.
- *Responsive.* `.main` is a size container (`container: main / inline-size`), so the header
  folds by panel width — which the vertical tab rail changes — not window width: captions →
  Stash label (icon-only; `font-size: 0` keeps the accessible name) → theme segment folds into
  the existing cycle button → search takes its own row. The ≤880px drawer + two-row grid header
  is kept. The previous "2026 workspace refresh" override layer was folded into the base rules.

**Verified** in the mock preview: an automated rendered-element contrast audit (alpha-composited
backgrounds) found zero AA failures across all eight views × both tab-bar modes × all three
themes; header fit checked at 1440, 1024 (top and side rail) and 375 (drawer).

**Review fixes.** An independent diff review found no broken features and five small CSS issues,
all fixed: (1) the lava ring was 2.76:1 on the grey wells — focus now has its own token,
`--focus` (#C84D0A in light: 3.6 inset / 3.9 paper; plain accent elsewhere); (2) in Linen a
hovered nav row's count fell to 4.15:1 — hovered counts lift to `--text-soft` like active ones;
(3) the large count numerals follow the **Small text** dial (`calc(24px|30px * var(--fs-small))`),
as Settings promises, not the Headings dial; (4) at ≤580px panel width the header wrapped to three
rows — the title now shrinks (ellipsis) before anything wraps; (5) the icon-only Stash button is a
38px circle, not an oval. Also: the Undo button's ring on the inverted snackbar uses `--bg`
(was 2.85:1 in dark — pre-existing).

## Calm structure + Linen theme (2026-09-07)

The owner: "a little boring — keep it minimal but add some professional and ADHD-friendly vibes,
and one more theme that's a little colourful." Four independent design proposals were judged by
three judges (product-design polish · ADHD/cognitive-load evidence · codebase feasibility);
"Calm structure & wayfinding" won and the best of the others was grafted in.

**Direction.** Keep the ink-on-paper skeleton; spend colour on two jobs only. (1) The user's own
Space/collection colours become fixed-position wayfinding marks — a rail on the active Space row,
a swatch beside the board title, a 3px inset top edge on each collection column. (2) One accent
family carries every "you are here / do this" state — the active-nav rail, focus ring, selection,
current tab chip, checked boxes, drop targets, checklist progress. Nothing important is hover-only
any more. The colour contract is a comment at the top of `:root`.

**Custom properties set by JS:** `--ws-color` on each `.ws-row` (spaces.js), `--space-color` on
`<html>` for the active Space (spaces.js `render`), `--col-color` on each `.colcard`, and `--done`
(0–1) on `.check-prog` (notes.js). A checklist whose rows are all ticked now counts as a done card
(`cardDone`), matching `sw.js isFinished`.

**Tokens.** Light `--text-mut` #656c79 / `--text-faint` #80868f (AA on every light surface, ≥3:1
for icons at rest); dark `--text-ghost` #707788 (chevrons 4.36:1); `--accent-soft` two steps from
`--bg-inset` in both; `--accent-ring` alphas raised so the focus halo is visible on the dot grid;
dark tray joins the canvas colour with a `--line-strong` bottom rule; dark `--shadow-tile` is a 1px
inset top highlight; `--tint-a` is one intensity dial for the six note-card tints (.13 light, .16
dark and Linen).

**Linen** (`:root[data-theme='linen']`): linen paper #faf7f2, walnut ink #2a2420, pine accent
#0d6b64 (5.95:1 on paper; 6.36:1 for white on it), plum #7c4a69 only as the logo/foot gradient
tail. Every one of the 38 tokens is defined; contrast recomputed: body/labels ≥4.5:1, domains
4.79:1, icons at rest ≥4.2:1. Pine was chosen over terracotta because terracotta is 1.03:1 in
luminance and 14° in hue from `--red` — primary and delete would have been one colour. Section
labels render sentence-case in Hanken under Linen only; light/dark keep the tracked-caps mono
signature. `color-scheme: light` so native pickers match. Theme buttons are discovered from
`[data-theme-choice]`, so the theme was one HTML button + one CSS block.

**Components (in order):** section labels `--text-soft` + uppercase via CSS (HTML text is now
sentence case); hairline chunking between scrolling sidebar groups, 34px rows, tabular counts in
`--text-faint`; active rail (`.navx.is-active::before`, `var(--ws-color)` on Space rows) and the
`--space-color` title swatch; `.colcard` inset top edge in `--col-color`; column header count stays
visible and its actions rest at .55; `.acts`/`.icb` visible at rest app-wide (`.icb` colour
`--text-faint`); `:focus-visible` no longer forces `border-radius: 4px` — cards and chips keep
their radius and get a halo ring; current tray chip has a soft fill + bold title and `Save all` is
an outline so `Stash window` is the only solid button on the board; `.searchbox.has-query` keeps
the accent border after blur; checklist progress track/fill with a green fill when done, done
cards settle (full opacity, tint off, struck title) instead of ghosting; checkbox borders in
`--text-faint`; tinted empty-state icon; danger shadow follows `--red`; landing ring animation on
`.colcard.highlight`; ticker slowed to 40s; dot grid at 26px; a real reduced-motion block.

**Review pass (26 confirmed findings from a 5-lens × 3-skeptic adversarial review).** Actions now
dim by COLOUR (`--text-faint` at rest, `--text-soft` on hover) instead of group opacity — .55 opacity
had sunk every rest-state icon below 3:1, and the `hover: none` fallback lost its specificity fights.
Card/chip focus ring is a solid 2px accent + 4px halo that survives `.chip-tab.is-active` and hover;
`.tray-chips`/`.colbody` gained the padding to not clip it; window rows draw the ring inside the
scroll box. The reduced-motion block moved to the END of the stylesheet (a media query adds no
specificity, so mid-file it lost to every later transition). Chevrons, tag-remove and the duplicates
source icon/kind left `--text-ghost`; domains, counts, ghost buttons and placeholders left
`--text-faint` for `--text-mut` (AA). Light `--red` #b03a49 / `--green` #2b7f52 and Linen `--red`
#a63a31 (danger text ≥4.5:1 on its 10% wash). Theme and layout chips carry `aria-pressed`. Linen's
notes toolbar hovers neutral (pine means state). `.drop-target` no longer forces a 12px radius; the
column title no longer advertises editing. The checklist bar carries its previous `--done` across a
rebuild so it eases; a reminder set on a fully ticked list says it only notifies once an item is
re-opened.

**Formatting bar (owner request):** docked at the bottom of the card being edited — notes.js appends
the one shared bar into the focused card and removes it on blur — instead of floating over the page. It
also carries **bullet / numbered / checklist** buttons (`toggleList` in format.js): they toggle the
marker on the current or selected lines, renumber numbered blocks, keep a ticked box ticked when
converting, and go through the same undoable `replaceRange`. Enter in a list line continues it
(`listContinuation`); Enter on an empty item removes the marker. The three are disabled on
single-line fields, where block syntax would render literally.

**Mosaic board layout (owner request):** a third layout beside columns and tiles — `.board.mosaic`
is the same `column-width: 300px` masonry the Notes view uses; each `.colcard` is `break-inside:
avoid` with its body capped at 64vh (internal scroll) so one long collection can't dwarf the rest;
the New-collection ghost and the empty state `column-span: all`. `app.js` keeps the three modes in
one `modeBtns` map (persisted under `stacknest:boardmode`, unknown values fall back to columns) and
stamps `aria-pressed`. No JS in spaces.js changed — the DOM is identical, so drag/drop, collapse and
rename work unchanged.

**Reconciled onto main (2026-09-07).** This folder turned out to be a snapshot from commit 6e509a6,
while the GitHub `main` had moved on (My Space + Vault, the vertical tabs rail, the graphite dark
theme and type scale, the Drive sign-out). Today's work was re-parented onto 6e509a6 and rebased onto
main so nothing on main was lost: JS/HTML conflicts resolved by hand (four-choice theme segment kept;
`data-view` on `<html>`, the tabs-bar modes, the non-primary Stash button and the no-caption nav
taken from main; the `mini-nav` dropped for the drawer), and the stylesheet rebuilt by two
independent merge agents plus a judge on top of main's token system (--t scale, `--edge`, graphite
dark) with Linen added as a complete third token block. Verified in the preview: all three themes,
My Space, the Vault (set PIN → move a bookmark out of Chrome → unlock), the vertical rail, the docked
formatting bar, mosaic, drawer, Library/Tags/Duplicates.

**Text sizes per role + Comfortable default (owner request, 2026-09-07).** The seven scale tokens
are now computed from four role multipliers set on `:root` by `applySettings` (`--fs-heading` →
t5/t6/t7, `--fs-title` → t4, `--fs-body` → t3, `--fs-small` → t1/t2). Settings › Appearance gets one
stepper per role (seven steps, 85%–135%, with the sample set in the role's own token) and a Reset
row that appears when anything is off 100%; values are sanitised to the ladder on read. Line
heights are unitless so they follow. `DEFAULT_SETTINGS.scale` is now `comfortable` for profiles that never chose a size (a stored
choice still wins — earlier saves baked `default` into storage), the zoom-1 option is labelled
**Standard** (id unchanged), and the mock no longer seeds a scale so the preview shows the default.
Review fixes: the settings view no longer rebuilds on its own writes (a stepper is a repeat-press
control — the rebuild destroyed the pressed button and dropped focus to `<body>`); external
rebuilds re-focus the same control by aria-label; one `normalize()` sanitises on read AND write so
a bad `typeSizes` from a backup cannot take effect on a later unrelated save; the ticker only
re-fetches when a ticker field changed; checkboxes scale with `--fs-body` like their text; samples
never truncate; the explanation + Reset live in an always-visible row (Reset disabled at 100%).

**Backup completeness + single Drive file (owner request, 2026-09-07).** `buildBackup` is
version 2: besides spaces/collections/settings/notes it now carries `tags`, `dupForgotten`,
`myspace` (the My Space + Vault store) and `lock` (the Vault's salt + PBKDF2 hash and the
security-answer hash — never the PIN). `applyBackup` restores each only when present, so older
files leave current values alone, and calls `relock()` after restoring a PIN record so a restored
Vault starts locked; the import confirm lists what the file carries. `drive.js` replaced
`findFileId` (first match only) with `listBackupFiles` (newest first, `trashed=false`): upload
PATCHes the newest in place, deletes every other copy, and re-prunes after a create so two racing
first backups leave one file; restore reads the newest.

**Rejected:** terracotta accent (collides with danger), Space-tinted canvas/tray washes, a
three-level elevation system and rest shadows on every card, a global type-scale bump, the search
box growing on focus, solid accent borders on selected chips, always-visible actions on sidebar
collection rows, green "done" text (3.36:1 on paper), editing the identity palette.

## Audit + design refresh (2026-09-07)

A full read of every module, then a pass that fixed what the read found and tightened the
design without touching the feature set.

**Bugs fixed**
- Clicking the **reminder chip** on a card threw (`el()` passes only the event to `onclick`, but
  the handler expected `(e, btn)` the way `actionBtn` does) — the reminder editor never opened
  from the chip. Now anchors on `e.currentTarget`.
- **New folder** in the Library could commit twice (Enter removes the input, which can fire blur);
  guarded like the other inline editors.
- **New collection / new space** tried to `.focus()` a display-only `<span>`, so neither opened its
  rename field. A `renameOnRender` marker now starts the rename on the render that paints the new
  row, and stays armed until that rename commits — creation triggers two renders (add, then
  activate) and the second would otherwise replace the input the first had opened.
- `js/grammar.js` was dead code (never imported) that would have posted search text to
  api.languagetool.org — undeclared in `host_permissions` and contradicting the README's "only
  Drive and the ticker touch the network". Deleted, with its orphaned `grammarEnabled` setting.
- The narrow-screen `mini-nav` was `aria-hidden` yet held the only focusable navigation; it is gone
  (see drawer below). Duplicate `ui.js` import in settings.js merged; unused `jumpToUrl` dropped.

**Performance**
- Hidden views no longer rebuild their DOM on every storage/bookmark event. `viewHidden()` (ui.js)
  lets Library, Tags, Duplicates and Notes compute their nav badge and return; `app.js` already
  re-renders a view when it opens. Duplicates + Tags bookmark listeners are debounced (a bulk clean
  fires one event per removal).

**Design**
- **Contrast**: dark-mode card surfaces/lines lifted so cards read as cards on ink
  (`--bg-card` .024 → .05, `--card-line-2` .075 → .11); `--text-mut` now clears 4.5:1 in both
  themes (light #868c98 → #6f7683, dark #767c88 → #8b919d); `--text-faint` lifted likewise.
- **Theme**: three-state segment — **auto** (follows `prefers-color-scheme` live via a
  `matchMedia` change listener) · light · dark. Stored under the same `stacknest:theme` key;
  an unknown/missing value means auto.
- **Search** gains a clear (×) button once there is a query (the ⌘K hint hides then), and Enter
  only prefers an open-tab chip while on the board.
- **Empty states** unified into one `emptyState()` component (icon tile · title · one-sentence
  hint · actions) used by the board, Library, Tags, Duplicates and Notes, each with the action
  that fills it (New collection / New folder / New note + New to-do list).
- **Board**: the "New collection" ghost is a short tile (`align-self: flex-start`) instead of a
  full-height dashed cage beside the columns.
- **Narrow screens (≤880px)**: the sidebar becomes an off-canvas **drawer** (menu button in the
  topbar, scrim, Esc closes, closes on view switch) so Spaces / Windows / Collections stay
  reachable — the old chip row only switched views.
- The tray and layout toggle are now shown/hidden by `body[data-view]` in CSS rather than inline
  styles. Views are deep-linkable by hash (`#notes` …); the reminder notification opens
  `newtab.html#notes`. The view entrance animation is 0.28s (it replays on every switch).

Verified in preview, light + dark, 1440px and 700px: reminder chip opens its editor; new space
opens in rename and lands on the board's empty state; search clear; drawer open/close/scrim;
hash deep-link; hidden views stay empty until opened while badges stay live; no console errors.
*Preview note:* the pane freezes CSS transitions/animations while unfocused — inject
`* { transition: none !important; animation: none !important }` before measuring or screenshotting.

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
