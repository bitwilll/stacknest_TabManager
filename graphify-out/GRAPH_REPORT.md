# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 63 files · ~230,780 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 1547 nodes · 4513 edges · 62 communities (58 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 204 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7d3a129`
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
- game-ripples.js
- game-brush.js
- normalize
- auth.js
- lounge-cafe.js
- wallpapers.js
- game-pebbles.js
- arcade-kit.js
- buildShell
- arcade.js
- ticker.js
- webbridge.js
- start
- render
- game-lantern.js
- zenpins.js
- applyBackup
- ui.js
- Ras
- tags.js
- StackNest — Tab Manager: Design
- fr
- el
- toast
- game-llama.js
- mutate
- painter
- tabs.js
- 5. Data shapes
- mixc
- tone
- rng
- luck.js
- drawRoom
- buildBack
- backupNow
- buildRoom
- mixHex
- closePop
- fgProp

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
- `Zen mode + wallpapers (2026-11-16)` --references--> `tone()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/arcade-kit.js
- `Reorderable Spaces / drag-and-drop (2026-07-06)` --references--> `reorderSpace()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/spacesStore.js
- `De-clutter pass (2026-07-04)` --references--> `domainOf()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `"Precision" redesign from reference images (2026-10-06)` --references--> `emptyState()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `Design-chief polish + launch readiness (2026-10-09)` --references--> `badgeText()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js

## Import Cycles
- 3-file cycle: `js/backup.js -> js/notes.js -> js/drive.js -> js/backup.js`
- 3-file cycle: `js/backup.js -> js/settings.js -> js/drive.js -> js/backup.js`

## Communities (62 total, 4 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.19
Nodes (22): isSessionUnlocked(), relock(), absorbFromChrome(), countEls, deleteBtn(), folderCount(), initMySpace(), loadSpace() (+14 more)

### Community 1 - "notes.js"
Cohesion: 0.12
Nodes (25): canStepScale(), stepScale(), buildFormatBar(), CARD_COLORS, clearDropMarks(), GUIDE, hideFormatBar(), KIND_LABEL (+17 more)

### Community 2 - "spaces.js"
Cohesion: 0.09
Nodes (58): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), exportBackup(), stamp(), pushHistory(), buildBookmarksHtml(), createEmpty(), datestamp() (+50 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (55): CLOUD_KEY, appearancePlate(), appearanceStatus(), applySettings(), backupPlate(), callout(), checkGroup(), DEFAULT_SETTINGS (+47 more)

### Community 4 - "support.js"
Cohesion: 0.06
Nodes (60): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+52 more)

### Community 5 - "drive.js"
Cohesion: 0.20
Nodes (18): Google Drive sync hardening (2026-07-08), api(), authError(), cloud, deleteFile(), disconnect(), downloadLive(), DriveError (+10 more)

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
Cohesion: 0.06
Nodes (45): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawGlass() (+37 more)

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
Nodes (78): NOTES, playChime(), emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown() (+70 more)

### Community 18 - "lock.js"
Cohesion: 0.14
Nodes (35): Collection-tile & duplicates refinements (2026-07-07), attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion() (+27 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (43): CANON, clamp(), rumble(), BASE, BASE_RGB, bike(), broadleaf(), car() (+35 more)

### Community 20 - "main"
Cohesion: 0.27
Nodes (9): main(), doRedo(), doUndo(), flash(), flashDeleted(), hide(), initHistory(), redoStack (+1 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.17
Nodes (22): pointIn(), runLoop(), setupCanvas(), start(), LIGHT, makeKoi(), meta, MORE_KOI (+14 more)

### Community 22 - "game-brush.js"
Cohesion: 0.07
Nodes (63): SUMI, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow(), clearTrace() (+55 more)

### Community 23 - "normalize"
Cohesion: 0.19
Nodes (17): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), clampScale(), detectKind(), focusItem(), hasContent(), importFromFile(), isObj(), mergeIn() (+9 more)

### Community 24 - "auth.js"
Cohesion: 0.18
Nodes (14): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken(), mintToken(), parseRedirect(), profileToken() (+6 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.15
Nodes (27): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+19 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.12
Nodes (32): buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank(), GREENS (+24 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.11
Nodes (30): CAPS, BOLS, BOSSA, buffers(), DAYAN, drum(), ensureCtx(), hallBus() (+22 more)

### Community 29 - "buildShell"
Cohesion: 0.23
Nodes (14): loadCloudState(), backupMenu(), buildShell(), closeAllMenus(), driveBackup(), driveRestore(), editingInMosaic(), menuButton() (+6 more)

### Community 30 - "arcade.js"
Cohesion: 0.15
Nodes (31): createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu(), stop() (+23 more)

### Community 31 - "ticker.js"
Cohesion: 0.18
Nodes (18): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, configure(), cryptoSym(), fetchCrypto(), fetchFx(), fmtPrice() (+10 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (54): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+46 more)

### Community 33 - "start"
Cohesion: 0.21
Nodes (25): card(), drip(), note(), playLoungeMusic(), swish(), tone(), start(), advance() (+17 more)

### Community 34 - "render"
Cohesion: 0.24
Nodes (10): consumeSelfWrite(), initNotes(), load(), openCount(), rearmAlarms(), render(), scheduleRender(), searchText() (+2 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (17): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+9 more)

### Community 37 - "applyBackup"
Cohesion: 0.33
Nodes (7): Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow(), isObj()

### Community 38 - "ui.js"
Cohesion: 0.16
Nodes (24): autoClean(), collectOccurrences(), FORGET_KEY, forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates() (+16 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "tags.js"
Cohesion: 0.18
Nodes (25): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, initTags(), itemGrid() (+17 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (26): Aesthetic direction, De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught, Notes mosaic: unified cards, drag-order, tags, tints (2026-07-08) (+18 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "el"
Cohesion: 0.14
Nodes (42): Audit + design refresh (2026-09-07), Section system + bento sidebar (2026-10-06), acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard() (+34 more)

### Community 44 - "toast"
Cohesion: 0.30
Nodes (16): Collection curation pass (2026-07-06), Spaces — Toby-style collections (2026-07-04), addLinkChecked(), addTabGhost(), colorOf(), column(), moveLinkChecked(), renderCollectionsNav() (+8 more)

### Community 45 - "game-llama.js"
Cohesion: 0.20
Nodes (17): PRELUDE, apple(), blend(), dayAt(), DAYS, makeGround(), meta, peak() (+9 more)

### Community 46 - "mutate"
Cohesion: 0.18
Nodes (31): addQuickReminder(), addRow(), armAlarm(), checkbox(), checkRow(), clearAlarm(), composer(), exportNotesOnly() (+23 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.27
Nodes (16): barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow(), saveWindow() (+8 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (23): StackNest on the web: one connected site can show the new tab (2026-11-17), 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site (+15 more)

### Community 50 - "mixc"
Cohesion: 0.23
Nodes (14): cloudStrip(), deskL(), deskR(), fairyY(), kbAt(), leaf(), mixc(), paintBack() (+6 more)

### Community 51 - "tone"
Cohesion: 0.36
Nodes (8): bell(), glassSpan(), newDrop(), newWalker(), seedParticles(), startVisitor(), step(), visitorStep()

### Community 52 - "rng"
Cohesion: 0.14
Nodes (21): build(), buildCity(), buildClouds(), building(), buildMid(), buildSky(), buildVignette(), layout() (+13 more)

### Community 53 - "luck.js"
Cohesion: 0.26
Nodes (11): BIP39_WORDS, frac32(), H0, K, lottoNumbers(), phraseFor(), PRIMES, rand() (+3 more)

### Community 54 - "drawRoom"
Cohesion: 0.18
Nodes (12): bakeOne(), calColours(), drawLit(), drawRoom(), hex(), lavaHW(), litHex(), order() (+4 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

### Community 56 - "backupNow"
Cohesion: 0.42
Nodes (11): Cloud sync · views · tags · duplicates · ticker (2026-07-07), backupNow(), connect(), isConfigured(), isLive(), NOT_CONFIGURED(), patchState(), restoreLatest() (+3 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "closePop"
Cohesion: 0.52
Nodes (7): closePop(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openTagPicker(), placePop()

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 365 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `zen.js`, `lock.js`, `main`, `normalize`, `arcade-kit.js`, `buildShell`, `arcade.js`, `ticker.js`, `render`, `ui.js`, `tags.js`, `toast`, `mutate`, `tabs.js`, `backupNow`, `closePop`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11965811965811966 - nodes in this community are weakly interconnected._
- **Why does `StackNest on the web: one connected site can show the new tab (2026-11-17)` connect `5. Data shapes` to `tabs.js`, `StackNest — Tab Manager: Design`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09201480698043363 - nodes in this community are weakly interconnected._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08116883116883117 - nodes in this community are weakly interconnected._
- **Should `support.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05621621621621622 - nodes in this community are weakly interconnected._