# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 67 files · ~337,760 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2166 nodes · 6075 edges · 92 communities (85 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07308f57`
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
- ui.js
- game-ripples.js
- game-brush.js
- mutate
- auth.js
- lounge-cafe.js
- wallpapers.js
- game-pebbles.js
- arcade-kit.js
- buildShell
- arcade.js
- ticker.js
- webbridge.js
- note
- lounge-reading.js
- game-lantern.js
- zenpins.js
- main
- lounge-garden.js
- Ras
- tags.js
- StackNest — Tab Manager: Design
- fr
- el
- lounge-temple.js
- game-llama.js
- buildShell
- painter
- tabs.js
- 5. Data shapes
- mixc
- build
- rng
- lounge-train.js
- drawRoom
- buildBack
- Ras
- buildRoom
- mixHex
- openReminderEditor
- fgProp
- paintBack
- spacesStore.js
- sq
- drawRoom
- Ras
- Ras
- update
- bakeJob
- render
- Ras
- paintBack
- render
- buildGarden
- fx
- createEyeRest
- render
- buildJob
- markdown.js
- thoughts.js
- glassState
- createCalendar
- rng
- paintFront
- sq
- sq
- el
- start
- playChime
- arcade.js
- drawBook

## God Nodes (most connected - your core abstractions)
1. `el()` - 135 edges
2. `icon()` - 76 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `update()` - 43 edges
6. `getKey()` - 40 edges
7. `StackNest — Tab Manager: Design` - 40 edges
8. `buildRoom()` - 34 edges
9. `note()` - 33 edges
10. `confirmDialog()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Zen mode + wallpapers (2026-11-16)` --references--> `tone()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/arcade-kit.js
- `Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17)` --references--> `artwork()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/game-brush.js
- `Reorderable Spaces / drag-and-drop (2026-07-06)` --references--> `reorderSpace()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/spacesStore.js
- `De-clutter pass (2026-07-04)` --references--> `domainOf()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js
- `"Precision" redesign from reference images (2026-10-06)` --references--> `emptyState()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/ui.js

## Import Cycles
- 3-file cycle: `js/backup.js -> js/notes.js -> js/drive.js -> js/backup.js`
- 3-file cycle: `js/backup.js -> js/settings.js -> js/drive.js -> js/backup.js`

## Communities (92 total, 7 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.17
Nodes (30): Section system + bento sidebar (2026-10-06), pushHistory(), isSessionUnlocked(), absorbFromChrome(), countEls, deleteBtn(), folderCount(), gate() (+22 more)

### Community 1 - "notes.js"
Cohesion: 0.09
Nodes (40): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), CARD_COLORS, cardDone(), clampScale(), clearDropMarks(), consumeSelfWrite(), detectKind(), editingInMosaic() (+32 more)

### Community 2 - "spaces.js"
Cohesion: 0.11
Nodes (48): Collection curation pass (2026-07-06), Spaces — Toby-style collections (2026-07-04), exportBackup(), stamp(), addLinkChecked(), addTabGhost(), boardCounts(), buildBookmarksHtml() (+40 more)

### Community 3 - "settings.js"
Cohesion: 0.07
Nodes (58): Collection-tile & duplicates refinements (2026-07-07), CLOUD_KEY, LOCK_KEY, MAX_FAILS, SECURITY_QUESTIONS, appearancePlate(), appearanceStatus(), applySettings() (+50 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.14
Nodes (35): Calm structure + Linen theme (2026-09-07), Cloud sync · views · tags · duplicates · ticker (2026-07-07), Google Drive sync hardening (2026-07-08), Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBookmarkTree(), importBookmarkTree() (+27 more)

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
Nodes (33): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawOutside() (+25 more)

### Community 11 - "format.js"
Cohesion: 0.15
Nodes (23): canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+15 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "zen.js"
Cohesion: 0.15
Nodes (27): loadNotes(), NOTES_KEY, arrange(), check(), dueChip(), flash(), fmtDue(), folderPin() (+19 more)

### Community 18 - "lock.js"
Cohesion: 0.17
Nodes (31): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+23 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (39): BASE, BASE_RGB, bike(), broadleaf(), car(), CLOUDS, css(), curveAt() (+31 more)

### Community 20 - "ui.js"
Cohesion: 0.14
Nodes (29): autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates(), loadForgotten() (+21 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.20
Nodes (20): card(), koi(), LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS (+12 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (76): SUMI, BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow() (+68 more)

### Community 23 - "mutate"
Cohesion: 0.26
Nodes (19): addQuickReminder(), addRow(), buildShell(), composer(), exportNotesOnly(), flushSaves(), focusItem(), focusRow() (+11 more)

### Community 24 - "auth.js"
Cohesion: 0.17
Nodes (15): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken(), mintToken(), parseRedirect(), profileToken() (+7 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.13
Nodes (29): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+21 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.12
Nodes (31): buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank(), GREENS (+23 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.12
Nodes (26): BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus(), hz() (+18 more)

### Community 29 - "buildShell"
Cohesion: 0.26
Nodes (12): loadCloudState(), backupMenu(), closeAllMenus(), driveBackup(), driveRestore(), menuButton(), close(), onDoc() (+4 more)

### Community 30 - "arcade.js"
Cohesion: 0.21
Nodes (25): soundOn(), makeVoice(), audio(), clock(), createMeditation(), cancel(), close(), end() (+17 more)

### Community 31 - "ticker.js"
Cohesion: 0.27
Nodes (13): loadSettings(), TICKER_CRYPTOS, configure(), cryptoSym(), fetchCrypto(), fetchFx(), fmtPrice(), initTicker() (+5 more)

### Community 32 - "webbridge.js"
Cohesion: 0.10
Nodes (52): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+44 more)

### Community 33 - "note"
Cohesion: 0.25
Nodes (29): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), rumble(), runLoop() (+21 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (54): AUTH, BAYER, boltEnv(), BOOK, BOX, CANDLES, CAT0, CATC (+46 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (17): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+9 more)

### Community 37 - "main"
Cohesion: 0.18
Nodes (14): main(), doRedo(), doUndo(), flash(), flashDeleted(), hide(), initHistory(), redoStack (+6 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.21
Nodes (9): band(), buildScreens(), cloudStrip(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+1 more)

### Community 40 - "tags.js"
Cohesion: 0.20
Nodes (23): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, initTags(), itemGrid() (+15 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (28): Aesthetic direction, Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+20 more)

### Community 42 - "fr"
Cohesion: 0.17
Nodes (23): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+15 more)

### Community 43 - "el"
Cohesion: 0.23
Nodes (20): acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile(), getFolder() (+12 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (62): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+54 more)

### Community 45 - "game-llama.js"
Cohesion: 0.15
Nodes (28): clamp(), apple(), blend(), dayAt(), DAYS, makeGround(), meta, peak() (+20 more)

### Community 46 - "buildShell"
Cohesion: 0.21
Nodes (16): buildShell(), focusTodo(), initZen(), isOn(), normalizeLayout(), paintFolds(), paintPager(), paintThought() (+8 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.21
Nodes (19): Audit + design refresh (2026-09-07), deleteBtn(), navDeleteBtn(), barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage() (+11 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (20): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+12 more)

### Community 50 - "mixc"
Cohesion: 0.29
Nodes (12): deskL(), deskR(), fairyY(), leaf(), mixc(), paintBack(), paintFront(), paintLeft() (+4 more)

### Community 51 - "build"
Cohesion: 0.22
Nodes (13): build(), buildVignette(), glassSpan(), layout(), mk(), newDrop(), newWalker(), seedParticles() (+5 more)

### Community 52 - "rng"
Cohesion: 0.23
Nodes (12): buildCity(), buildClouds(), building(), buildSky(), makeState(), preview(), rng(), snowCap() (+4 more)

### Community 53 - "lounge-train.js"
Cohesion: 0.06
Nodes (56): BAYER, BRASS, buildRoom(), CAR, COAT, coolAt(), CT, DOOR (+48 more)

### Community 54 - "drawRoom"
Cohesion: 0.15
Nodes (15): bakeOne(), calColours(), drawLit(), drawRoom(), fx(), hex(), kbAt(), lavaHW() (+7 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

### Community 56 - "Ras"
Cohesion: 0.14
Nodes (14): bandN(), branch(), cloudStrip(), glassBeads(), glow(), inWin(), outside(), paintBead() (+6 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "openReminderEditor"
Cohesion: 0.25
Nodes (15): armAlarm(), clearAlarm(), closePop(), findItem(), mountPop(), onPopDown(), onPopKey(), onPopScroll() (+7 more)

### Community 60 - "fgProp"
Cohesion: 0.38
Nodes (7): blade(), bookY(), buildFront(), buildMid(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "spacesStore.js"
Cohesion: 0.12
Nodes (35): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), importFlow(), isObj(), FORGET_KEY, relock(), SPACE_KEY, removeCollection() (+27 more)

### Community 64 - "sq"
Cohesion: 0.16
Nodes (20): archWindow(), deskBay(), drapeEdge(), drapes(), fernStand(), fireplace(), floorGlobe(), hearthRug() (+12 more)

### Community 65 - "drawRoom"
Cohesion: 0.13
Nodes (24): band(), drawClock(), drawFire(), drawFrontLog(), drawGlobe(), drawHourglass(), drawLadder(), drawProjection() (+16 more)

### Community 68 - "update"
Cohesion: 0.14
Nodes (19): addRipple(), ease(), finish(), gardenFor(), gust(), keep(), landFly(), makeState() (+11 more)

### Community 69 - "bakeJob"
Cohesion: 0.19
Nodes (13): bakeJob(), band(), clamp(), glow(), hazeCanvas(), litAt(), mk(), rampOf() (+5 more)

### Community 70 - "render"
Cohesion: 0.17
Nodes (15): bakeOne(), disc(), drawChime(), drawKoi(), drawLit(), fill(), hex(), litOf() (+7 more)

### Community 71 - "Ras"
Cohesion: 0.23
Nodes (4): bay(), paintBamboo(), paintSky(), Ras

### Community 72 - "paintBack"
Cohesion: 0.19
Nodes (14): archTop(), garland(), paintArch(), paintBackJob(), paintBellFrame(), paintBuddha(), paintNiche(), paintPillar() (+6 more)

### Community 73 - "render"
Cohesion: 0.18
Nodes (15): drawLand(), drawLit(), drawRain(), drawRoom(), drawTunnel(), haltFor(), hex(), litHex() (+7 more)

### Community 74 - "buildGarden"
Cohesion: 0.21
Nodes (14): buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintGravel(), paintKakei() (+6 more)

### Community 75 - "fx"
Cohesion: 0.22
Nodes (12): bakeOne(), band(), buildLand(), cloudStrip(), fx(), glow(), paintTable(), rampOf() (+4 more)

### Community 76 - "createEyeRest"
Cohesion: 0.35
Nodes (11): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+3 more)

### Community 77 - "render"
Cohesion: 0.09
Nodes (26): bake(), bakeSprite(), ease(), famBow(), finish(), fr(), glowAt(), hex() (+18 more)

### Community 78 - "buildJob"
Cohesion: 0.16
Nodes (18): bodhiTree(), buildJob(), flagStrings(), grove(), layout(), mixc(), paintBell(), paintLantern() (+10 more)

### Community 79 - "markdown.js"
Cohesion: 0.38
Nodes (7): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl()

### Community 80 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 81 - "glassState"
Cohesion: 0.21
Nodes (12): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+4 more)

### Community 82 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

### Community 83 - "rng"
Cohesion: 0.18
Nodes (12): bookTitle(), EMBERS, LANDS, makeBuffers(), makeState(), newRiv(), paintFern(), paintTown() (+4 more)

### Community 84 - "paintFront"
Cohesion: 0.24
Nodes (10): bookStack(), crest(), paintArm(), paintFront(), paintWing(), projMask(), tL(), tR() (+2 more)

### Community 85 - "sq"
Cohesion: 0.15
Nodes (19): bakeGen(), buildRoom(), clamp(), coolAt(), drawLit(), fillWarm(), finish(), fireAt() (+11 more)

### Community 86 - "sq"
Cohesion: 0.18
Nodes (12): bellSound(), bowlSound(), coolAt(), droneSound(), fieldJob(), lift(), lightStick(), paintPose() (+4 more)

### Community 87 - "el"
Cohesion: 0.23
Nodes (23): createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu(), stop() (+15 more)

### Community 88 - "start"
Cohesion: 0.22
Nodes (14): drawGlass(), finish(), flicker(), makeBuffers(), makeState(), newCodeLine(), paneDrop(), preview() (+6 more)

### Community 90 - "arcade.js"
Cohesion: 0.29
Nodes (6): CAPS, setSound(), mosaicFor(), MOSAICS, SHELVES, UPLIFT

### Community 91 - "drawBook"
Cohesion: 0.60
Nodes (6): bookLift(), drawBook(), openBook(), pageBot(), pageText(), pageTop()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 537 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `drive.js`, `format.js`, `zen.js`, `lock.js`, `ui.js`, `mutate`, `buildShell`, `arcade.js`, `ticker.js`, `main`, `tags.js`, `el`, `buildShell`, `tabs.js`, `openReminderEditor`, `createEyeRest`, `createCalendar`, `arcade.js`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0859465737514518 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `drive.js`, `format.js`, `zen.js`, `lock.js`, `ui.js`, `mutate`, `buildShell`, `arcade.js`, `zenpins.js`, `main`, `tags.js`, `el`, `buildShell`, `tabs.js`, `openReminderEditor`, `createEyeRest`, `createCalendar`, `arcade.js`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11479591836734694 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `notes.js`, `lounge-reading.js`, `game-lantern.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `game-ripples.js`, `game-brush.js`, `lounge-train.js`, `start`, `lounge-cafe.js`, `arcade-kit.js`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07364114552893045 - nodes in this community are weakly interconnected._