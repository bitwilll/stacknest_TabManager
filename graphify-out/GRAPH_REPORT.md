# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 61 files · ~212,659 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 1462 nodes · 4319 edges · 55 communities (50 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 202 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `caac15f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- myspace.js
- notes.js
- spaces.js
- settings.js
- support.js
- drive.js
- render-icons.mjs
- manifest.json
- StackNest privacy policy
- 3. Owner actions
- lounge-room.js
- format.js
- mock.js
- Chrome Web Store listing: StackNest
- zen.js
- .impeccable.md
- package.sh
- lock.js
- game-drive.js
- main
- game-pebbles.js
- game-brush.js
- normalize
- auth.js
- lounge-cafe.js
- wallpapers.js
- createEyeRest
- arcade-kit.js
- buildShell
- arcade.js
- ticker.js
- webbridge.js
- note
- render
- StackNest on the web: the bridge, from the website's side
- get
- backup.js
- duplicates.js
- Ras
- tags.js
- StackNest — Tab Manager: Design
- fr
- bookmarks.js
- Redesign: Nothing's design psychology, type scale, contrast (2026-07-11)
- game-llama.js
- mutate
- painter
- tabs.js
- 5. Data shapes
- tone
- rng
- mutate
- buildBack

## God Nodes (most connected - your core abstractions)
1. `el()` - 134 edges
2. `icon()` - 76 edges
3. `toast()` - 62 edges
4. `update()` - 43 edges
5. `getKey()` - 40 edges
6. `StackNest — Tab Manager: Design` - 39 edges
7. `confirmDialog()` - 33 edges
8. `actionBtn()` - 29 edges
9. `render()` - 27 edges
10. `render()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Reorderable Spaces / drag-and-drop (2026-07-06)` --references--> `reorderSpace()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/spacesStore.js
- `De-clutter pass (2026-07-04)` --references--> `domainOf()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `"Precision" redesign from reference images (2026-10-06)` --references--> `emptyState()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `Design-chief polish + launch readiness (2026-10-09)` --references--> `badgeText()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `Why this mechanism` --references--> `matches()`  [INFERRED]
  docs/specs/stacknest-web-bridge.md → js/ui.js

## Import Cycles
- 3-file cycle: `js/backup.js -> js/notes.js -> js/drive.js -> js/backup.js`
- 3-file cycle: `js/backup.js -> js/settings.js -> js/drive.js -> js/backup.js`

## Communities (55 total, 5 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.12
Nodes (42): Section system + bento sidebar (2026-10-06), pushHistory(), isSessionUnlocked(), relock(), absorbFromChrome(), countEls, deleteBtn(), folderCount() (+34 more)

### Community 1 - "notes.js"
Cohesion: 0.12
Nodes (26): canStepScale(), stepScale(), buildFormatBar(), CARD_COLORS, clearDropMarks(), GUIDE, hideFormatBar(), KIND_LABEL (+18 more)

### Community 2 - "spaces.js"
Cohesion: 0.09
Nodes (72): Collection curation pass (2026-07-06), Spaces, Settings, Backup + hardening (2026-07-06), Spaces — Toby-style collections (2026-07-04), Undo / redo for deletes (2026-07-06), removeOccurrence(), addLinkChecked(), addTabGhost(), boardCounts() (+64 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (53): Collection-tile & duplicates refinements (2026-07-07), appearancePlate(), appearanceStatus(), applySettings(), backupPlate(), callout(), checkGroup(), DEFAULT_SETTINGS (+45 more)

### Community 4 - "support.js"
Cohesion: 0.06
Nodes (60): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+52 more)

### Community 5 - "drive.js"
Cohesion: 0.15
Nodes (31): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Google Drive sync hardening (2026-07-08), forgetAllTokens(), api(), authError(), backupNow(), cloud, CLOUD_KEY (+23 more)

### Community 6 - "render-icons.mjs"
Cohesion: 0.07
Nodes (24): check(), chrome, fmt(), LAVA, master, readPng(), ROOT, SIZES (+16 more)

### Community 7 - "manifest.json"
Cohesion: 0.06
Nodes (31): action, default_icon, default_title, background, service_worker, type, chrome_url_overrides, newtab (+23 more)

### Community 8 - "StackNest privacy policy"
Cohesion: 0.07
Nodes (27): 1. What StackNest handles, and where it lives, 2. When information leaves your device, 3. What StackNest never does, 4. Google API Services and Chrome Web Store user data, 5. Incognito, 6. Keeping or deleting your data, 7. Children, 8. Changes to this policy (+19 more)

### Community 9 - "3. Owner actions"
Cohesion: 0.17
Nodes (11): 1. Done in this repo, 2. Code changes for the store — done (2026-10-09), 3. Owner actions, A. Accounts and policy page, B. Build and upload a draft, C. Google sign-in for store users, D. Listing and submission, E. After launch (+3 more)

### Community 10 - "lounge-room.js"
Cohesion: 0.05
Nodes (80): bakeOne(), BAYER, blendSet(), buildRoom(), calColours(), CARS, CAT, CATC (+72 more)

### Community 11 - "format.js"
Cohesion: 0.19
Nodes (19): Calm structure + Linen theme (2026-09-07), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+11 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "zen.js"
Cohesion: 0.05
Nodes (81): NOTES, playChime(), emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown() (+73 more)

### Community 18 - "lock.js"
Cohesion: 0.14
Nodes (35): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+27 more)

### Community 19 - "game-drive.js"
Cohesion: 0.10
Nodes (35): BASE, BASE_RGB, bike(), broadleaf(), car(), CLOUDS, css(), curveAt() (+27 more)

### Community 20 - "main"
Cohesion: 0.27
Nodes (9): main(), doRedo(), doUndo(), flash(), flashDeleted(), hide(), initHistory(), redoStack (+1 more)

### Community 21 - "game-pebbles.js"
Cohesion: 0.13
Nodes (30): SIZE, splash(), centre(), DOREMI, lilyPad(), LINES, meta, minimax() (+22 more)

### Community 22 - "game-brush.js"
Cohesion: 0.11
Nodes (38): SUMI, artwork(), clearTrace(), DIRS, fadeBy(), fadeTrace(), grain(), h1() (+30 more)

### Community 23 - "normalize"
Cohesion: 0.19
Nodes (17): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), clampScale(), detectKind(), focusItem(), hasContent(), importFromFile(), isObj(), mergeIn() (+9 more)

### Community 24 - "auth.js"
Cohesion: 0.16
Nodes (14): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetToken(), mintToken(), parseRedirect(), profileToken(), SCOPES (+6 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.14
Nodes (28): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+20 more)

### Community 27 - "createEyeRest"
Cohesion: 0.35
Nodes (11): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+3 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.11
Nodes (40): BOLS, BOSSA, buffers(), CANON, DAYAN, drip(), drum(), ensureCtx() (+32 more)

### Community 29 - "buildShell"
Cohesion: 0.23
Nodes (14): loadCloudState(), backupMenu(), buildShell(), closeAllMenus(), composer(), driveBackup(), driveRestore(), menuButton() (+6 more)

### Community 30 - "arcade.js"
Cohesion: 0.13
Nodes (36): CAPS, createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu() (+28 more)

### Community 31 - "ticker.js"
Cohesion: 0.17
Nodes (19): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, draw(), configure(), cryptoSym(), fetchCrypto(), fetchFx() (+11 more)

### Community 32 - "webbridge.js"
Cohesion: 0.10
Nodes (52): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+44 more)

### Community 33 - "note"
Cohesion: 0.22
Nodes (20): card(), clamp(), note(), firefly(), lantern(), meta, preview(), rng() (+12 more)

### Community 34 - "render"
Cohesion: 0.25
Nodes (9): consumeSelfWrite(), editingInMosaic(), initNotes(), load(), openCount(), render(), scheduleRender(), searchText() (+1 more)

### Community 35 - "StackNest on the web: the bridge, from the website's side"
Cohesion: 0.25
Nodes (7): 1. How a person connects, 2. Detecting the extension, 6. A minimal client, 7. Rules for the site, 8. Developing against it, StackNest on the web: the bridge, from the website's side, Why this mechanism

### Community 36 - "get"
Cohesion: 0.33
Nodes (7): StackNest on the web: one connected site can show the new tab (2026-11-17), 3. Transport, 4. Message types, `wallpaper` (only when asked for by name), createRegistry(), bump(), get()

### Community 37 - "backup.js"
Cohesion: 0.18
Nodes (16): Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow(), isObj() (+8 more)

### Community 38 - "duplicates.js"
Cohesion: 0.20
Nodes (20): autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates(), loadForgotten() (+12 more)

### Community 39 - "Ras"
Cohesion: 0.16
Nodes (15): draw(), press(), ride(), band(), buildScreens(), cloudStrip(), fx(), glow() (+7 more)

### Community 40 - "tags.js"
Cohesion: 0.18
Nodes (26): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, initTags(), itemGrid() (+18 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.08
Nodes (23): Aesthetic direction, De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Notes mosaic: unified cards, drag-order, tags, tints (2026-07-08), Notes: typing bug, task chaining, contrast, guide, undo (2026-07-09) (+15 more)

### Community 42 - "fr"
Cohesion: 0.14
Nodes (28): activity(), armPos(), bookY(), bubble(), curtain(), door(), ease(), farWalker() (+20 more)

### Community 43 - "bookmarks.js"
Cohesion: 0.26
Nodes (20): acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile(), getFolder() (+12 more)

### Community 45 - "game-llama.js"
Cohesion: 0.22
Nodes (16): apple(), blend(), dayAt(), DAYS, makeGround(), meta, peak(), pine() (+8 more)

### Community 46 - "mutate"
Cohesion: 0.19
Nodes (25): addQuickReminder(), armAlarm(), clearAlarm(), closePop(), findItem(), fireTime(), itemCard(), mountPop() (+17 more)

### Community 47 - "painter"
Cohesion: 0.16
Nodes (21): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+13 more)

### Community 48 - "tabs.js"
Cohesion: 0.25
Nodes (17): Audit + design refresh (2026-09-07), barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow() (+9 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.22
Nodes (9): 5. Data shapes, `board`: spaces and collections, `library`: Chrome's bookmarks, `myspace`, Never sent, `notes`: notes, to-do lists and reminders, `settings`, `tags` (+1 more)

### Community 51 - "tone"
Cohesion: 0.27
Nodes (11): Zen mode + wallpapers (2026-11-16), tone(), bell(), glassSpan(), newDrop(), newWalker(), order(), seedParticles() (+3 more)

### Community 52 - "rng"
Cohesion: 0.13
Nodes (25): blade(), build(), buildCity(), buildClouds(), buildFront(), building(), buildMid(), buildSky() (+17 more)

### Community 53 - "mutate"
Cohesion: 0.29
Nodes (13): addRow(), checkbox(), checkRow(), exportNotesOnly(), flushSaves(), focusRow(), lineView(), noteBody() (+5 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 355 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `bookmarks.js` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `drive.js`, `zen.js`, `lock.js`, `main`, `normalize`, `createEyeRest`, `buildShell`, `arcade.js`, `ticker.js`, `render`, `duplicates.js`, `tags.js`, `mutate`, `tabs.js`, `mutate`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `myspace.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12050739957716702 - nodes in this community are weakly interconnected._
- **Why does `get()` connect `get` to `StackNest on the web: the bridge, from the website's side`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._
- **Why does `StackNest on the web: one connected site can show the new tab (2026-11-17)` connect `get` to `tabs.js`, `StackNest — Tab Manager: Design`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08589411329137357 - nodes in this community are weakly interconnected._