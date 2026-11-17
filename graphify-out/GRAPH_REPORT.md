# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 67 files · ~333,458 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2151 nodes · 6030 edges · 91 communities (82 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b3d1635`
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
- duplicates.js
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
- note
- lounge-reading.js
- game-lantern.js
- zenpins.js
- backup.js
- lounge-garden.js
- Ras
- tags.js
- StackNest — Tab Manager: Design
- fr
- el
- lounge-temple.js
- game-llama.js
- backupNow
- painter
- ui.js
- 5. Data shapes
- mixc
- tone
- rng
- lounge-train.js
- drawRoom
- buildBack
- Ras
- buildRoom
- mixHex
- mutate
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
- preview
- paintFront
- sq
- sq
- removeCard
- sw.js
- playChime
- paintGarden

## God Nodes (most connected - your core abstractions)
1. `el()` - 134 edges
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

## Communities (91 total, 9 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.17
Nodes (29): Audit + design refresh (2026-09-07), Section system + bento sidebar (2026-10-06), isSessionUnlocked(), absorbFromChrome(), countEls, deleteBtn(), folderCount(), gate() (+21 more)

### Community 1 - "notes.js"
Cohesion: 0.10
Nodes (35): buildFormatBar(), CARD_COLORS, clearDropMarks(), consumeSelfWrite(), editingInMosaic(), exportNotesOnly(), GUIDE, hideFormatBar() (+27 more)

### Community 2 - "spaces.js"
Cohesion: 0.11
Nodes (46): Collection curation pass (2026-07-06), Collection-tile & duplicates refinements (2026-07-07), Spaces — Toby-style collections (2026-07-04), addLinkChecked(), addTabGhost(), boardCounts(), buildBookmarksHtml(), colorOf() (+38 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (53): CLOUD_KEY, appearancePlate(), appearanceStatus(), applySettings(), backupPlate(), callout(), checkGroup(), DEFAULT_SETTINGS (+45 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.19
Nodes (18): Google Drive sync hardening (2026-07-08), forgetAllTokens(), forgetToken(), api(), authError(), cloud, deleteFile(), downloadLive() (+10 more)

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
Cohesion: 0.17
Nodes (21): Calm structure + Linen theme (2026-09-07), canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS (+13 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "zen.js"
Cohesion: 0.14
Nodes (34): arrange(), buildShell(), flash(), fmtDue(), focusTodo(), folderPin(), FROM_LABEL, initZen() (+26 more)

### Community 18 - "lock.js"
Cohesion: 0.13
Nodes (34): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+26 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (42): card(), rumble(), BASE, BASE_RGB, bike(), broadleaf(), car(), CLOUDS (+34 more)

### Community 20 - "duplicates.js"
Cohesion: 0.14
Nodes (31): autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates(), loadForgotten() (+23 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.19
Nodes (19): SIZE, LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS, padsFor() (+11 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (77): Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), SUMI, BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk() (+69 more)

### Community 23 - "normalize"
Cohesion: 0.23
Nodes (15): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), clampScale(), detectKind(), focusItem(), importFromFile(), isObj(), mergeIn(), migrateNotes() (+7 more)

### Community 24 - "auth.js"
Cohesion: 0.31
Nodes (9): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), mintToken(), parseRedirect(), profileToken(), SCOPES, webToken() (+1 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.14
Nodes (28): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+20 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.12
Nodes (32): buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank(), GREENS (+24 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.10
Nodes (29): CAPS, BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus() (+21 more)

### Community 29 - "buildShell"
Cohesion: 0.23
Nodes (15): loadCloudState(), backupMenu(), buildShell(), closeAllMenus(), composer(), driveBackup(), driveRestore(), flushSaves() (+7 more)

### Community 30 - "arcade.js"
Cohesion: 0.21
Nodes (25): soundOn(), makeVoice(), audio(), clock(), createMeditation(), cancel(), close(), end() (+17 more)

### Community 31 - "ticker.js"
Cohesion: 0.18
Nodes (18): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, configure(), cryptoSym(), fetchCrypto(), fetchFx(), fmtPrice() (+10 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (54): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+46 more)

### Community 33 - "note"
Cohesion: 0.30
Nodes (26): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), runLoop(), setupCanvas() (+18 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (48): AUTH, BAYER, boltEnv(), BOOK, BOX, CANDLES, CATC, CLOCK (+40 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.15
Nodes (27): backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land(), lantern() (+19 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (16): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+8 more)

### Community 37 - "backup.js"
Cohesion: 0.20
Nodes (14): applyBackup(), exportBackup(), importBookmarkTree(), importFlow(), isObj(), stamp(), FORGET_KEY, relock() (+6 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "tags.js"
Cohesion: 0.12
Nodes (41): createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu(), stop() (+33 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (27): Aesthetic direction, De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught, Notes mosaic: unified cards, drag-order, tags, tints (2026-07-08) (+19 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "el"
Cohesion: 0.24
Nodes (22): acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile(), getFolder() (+14 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (62): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+54 more)

### Community 45 - "game-llama.js"
Cohesion: 0.14
Nodes (29): clamp(), PRELUDE, apple(), blend(), dayAt(), DAYS, makeGround(), meta (+21 more)

### Community 46 - "backupNow"
Cohesion: 0.27
Nodes (16): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Notes & Todos view (2026-07-08), buildBackup(), exportBookmarkTree(), backupNow(), connect(), disconnect(), isConfigured() (+8 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "ui.js"
Cohesion: 0.13
Nodes (27): main(), barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow() (+19 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (20): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+12 more)

### Community 50 - "mixc"
Cohesion: 0.23
Nodes (14): cloudStrip(), deskL(), deskR(), fairyY(), kbAt(), leaf(), mixc(), paintBack() (+6 more)

### Community 51 - "tone"
Cohesion: 0.36
Nodes (8): bell(), glassSpan(), newDrop(), newWalker(), seedParticles(), startVisitor(), step(), visitorStep()

### Community 52 - "rng"
Cohesion: 0.14
Nodes (21): build(), buildCity(), buildClouds(), building(), buildMid(), buildSky(), buildVignette(), layout() (+13 more)

### Community 53 - "lounge-train.js"
Cohesion: 0.06
Nodes (56): BAYER, BRASS, buildRoom(), CAR, COAT, coolAt(), CT, DOOR (+48 more)

### Community 54 - "drawRoom"
Cohesion: 0.18
Nodes (12): bakeOne(), calColours(), drawLit(), drawRoom(), hex(), lavaHW(), litHex(), order() (+4 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

### Community 56 - "Ras"
Cohesion: 0.15
Nodes (12): bakeGen(), band(), bandN(), cloudStrip(), fx(), glow(), outside(), paintCat() (+4 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "mutate"
Cohesion: 0.18
Nodes (27): addRow(), checkbox(), checkRow(), closePop(), findItem(), focusRow(), itemCard(), lineView() (+19 more)

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "spacesStore.js"
Cohesion: 0.19
Nodes (25): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), addSpace(), addWorkspace(), deleteSpace(), deleteWorkspace(), DOT_COLORS, ensureWorkspaces() (+17 more)

### Community 64 - "sq"
Cohesion: 0.11
Nodes (29): archWindow(), bookTitle(), deskBay(), drapeEdge(), drapes(), EMBERS, fernStand(), fireplace() (+21 more)

### Community 65 - "drawRoom"
Cohesion: 0.17
Nodes (17): drawClock(), drawFire(), drawGlobe(), drawHourglass(), drawLadder(), drawPull(), drawRoom(), ease() (+9 more)

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
Cohesion: 0.42
Nodes (10): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+2 more)

### Community 77 - "render"
Cohesion: 0.09
Nodes (25): bake(), bakeSprite(), ease(), famBow(), finish(), fr(), glowAt(), lerpPose() (+17 more)

### Community 78 - "buildJob"
Cohesion: 0.15
Nodes (19): bodhiTree(), buildJob(), flagStrings(), grove(), hex(), layout(), mixc(), paintBell() (+11 more)

### Community 79 - "markdown.js"
Cohesion: 0.28
Nodes (10): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl(), listCard() (+2 more)

### Community 80 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 81 - "glassState"
Cohesion: 0.21
Nodes (12): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+4 more)

### Community 82 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

### Community 83 - "preview"
Cohesion: 0.25
Nodes (9): drawLit(), finish(), makeBuffers(), makeState(), newRiv(), preview(), roomFor(), spriteImg() (+1 more)

### Community 84 - "paintFront"
Cohesion: 0.21
Nodes (13): bookLift(), bookStack(), crest(), drawBook(), openBook(), pageBot(), pageText(), pageTop() (+5 more)

### Community 85 - "sq"
Cohesion: 0.20
Nodes (16): buildRoom(), clamp(), coolAt(), fillWarm(), fireAt(), lampAt(), lampBack(), layoutFor() (+8 more)

### Community 86 - "sq"
Cohesion: 0.18
Nodes (12): bellSound(), bowlSound(), coolAt(), droneSound(), fieldJob(), lift(), lightStick(), paintPose() (+4 more)

### Community 87 - "removeCard"
Cohesion: 0.29
Nodes (10): addQuickReminder(), armAlarm(), clearAlarm(), fireTime(), hasContent(), now(), rearmAlarms(), remName() (+2 more)

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 534 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `tags.js` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `zen.js`, `lock.js`, `duplicates.js`, `arcade-kit.js`, `buildShell`, `arcade.js`, `ticker.js`, `backup.js`, `el`, `backupNow`, `ui.js`, `mutate`, `createEyeRest`, `markdown.js`, `createCalendar`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0960960960960961 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `tags.js` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `zenpins.js`, `el`, `createEyeRest`, `backupNow`, `zen.js`, `ui.js`, `lock.js`, `createCalendar`, `duplicates.js`, `mutate`, `arcade-kit.js`, `buildShell`, `arcade.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11285846438482887 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `lounge-reading.js`, `game-lantern.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `game-ripples.js`, `game-brush.js`, `normalize`, `lounge-train.js`, `lounge-cafe.js`, `arcade-kit.js`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08455625436757512 - nodes in this community are weakly interconnected._