# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 70 files · ~431,378 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2728 nodes · 7461 edges · 113 communities (106 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 242 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1383d86`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- game-lantern.js
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
- lounge-cabin.js
- .impeccable.md
- package.sh
- backup.js
- game-drive.js
- duplicates.js
- game-ripples.js
- game-brush.js
- normalize
- auth.js
- lounge-cafe.js
- rng
- game-pebbles.js
- arcade-kit.js
- buildShell
- lounge-beach.js
- ticker.js
- webbridge.js
- note
- lounge-reading.js
- game-lantern.js
- zenpins.js
- lounge-woods.js
- lounge-garden.js
- Ras
- buildShell
- StackNest — Tab Manager: Design
- fr
- backupNow
- lounge-temple.js
- game-llama.js
- zen.js
- painter
- tabs.js
- 5. Data shapes
- mixc
- step
- rng
- lounge-train.js
- drawRoom
- buildBack
- Ras
- buildRoom
- mixHex
- reminderBody
- fgProp
- paintBack
- buildRoom
- sq
- drawRoom
- Ras
- Ras
- update
- bakeJob
- render
- Ras
- paintBack
- Ras
- buildGarden
- drawRoom
- buildRoom
- render
- buildJob
- Ras
- render
- Ras
- buildBeach
- rng
- paintArm
- sq
- sq
- el
- start
- mk
- render
- drawBook
- outside
- createEyeRest
- glassBeads
- mixc
- fx
- paintSea
- fx
- paintPier
- buildOutside
- update
- drawRoom
- drawFire
- glassState
- itemCard
- markdown.js
- thoughts.js
- sq
- removeCard
- buildFormatBar
- createCalendar
- playChime

## God Nodes (most connected - your core abstractions)
1. `el()` - 136 edges
2. `icon()` - 77 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `note()` - 44 edges
6. `update()` - 43 edges
7. `StackNest — Tab Manager: Design` - 42 edges
8. `buildRoom()` - 40 edges
9. `getKey()` - 40 edges
10. `swish()` - 37 edges

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

## Communities (113 total, 7 thin omitted)

### Community 0 - "game-lantern.js"
Cohesion: 0.15
Nodes (27): backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land(), lantern() (+19 more)

### Community 1 - "notes.js"
Cohesion: 0.10
Nodes (31): CARD_COLORS, cardDone(), clampScale(), clearDropMarks(), consumeSelfWrite(), editingInMosaic(), exportNotesOnly(), GUIDE (+23 more)

### Community 2 - "spaces.js"
Cohesion: 0.08
Nodes (78): Collection curation pass (2026-07-06), Spaces, Settings, Backup + hardening (2026-07-06), Spaces — Toby-style collections (2026-07-04), Undo / redo for deletes (2026-07-06), acceptMoves(), collectOccurrences(), loadSpace(), addLinkChecked() (+70 more)

### Community 3 - "settings.js"
Cohesion: 0.05
Nodes (105): Collection-tile & duplicates refinements (2026-07-07), CLOUD_KEY, attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc (+97 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.22
Nodes (15): Google Drive sync hardening (2026-07-08), api(), authError(), cloud, deleteFile(), downloadLive(), DriveError, driveMessage() (+7 more)

### Community 6 - "render-icons.mjs"
Cohesion: 0.07
Nodes (25): check(), chrome, fmt(), LAVA, master, readPng(), ROOT, SIZES (+17 more)

### Community 7 - "manifest.json"
Cohesion: 0.06
Nodes (31): action, default_icon, default_title, background, service_worker, type, chrome_url_overrides, newtab (+23 more)

### Community 8 - "StackNest privacy policy"
Cohesion: 0.07
Nodes (28): 1. What StackNest handles, and where it lives, 2. When information leaves your device, 3. What StackNest never does, 4. Google API Services and Chrome Web Store user data, 5. Incognito, 6. Keeping or deleting your data, 7. Children, 8. Changes to this policy (+20 more)

### Community 9 - "3. Owner actions"
Cohesion: 0.17
Nodes (11): 1. Done in this repo, 2. Code changes for the store — done (2026-10-09), 3. Owner actions, A. Accounts and policy page, B. Build and upload a draft, C. Google sign-in for store users, D. Listing and submission, E. After launch (+3 more)

### Community 10 - "lounge-room.js"
Cohesion: 0.06
Nodes (45): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawGlass() (+37 more)

### Community 11 - "format.js"
Cohesion: 0.18
Nodes (20): canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+12 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "lounge-cabin.js"
Cohesion: 0.03
Nodes (65): AUR, BAYER, BOOK, BOOKC, BRASS, CHAIR, COLS, CT (+57 more)

### Community 18 - "backup.js"
Cohesion: 0.15
Nodes (20): Calm structure + Linen theme (2026-09-07), Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow() (+12 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (46): clamp(), rumble(), BASE, bike(), broadleaf(), car(), CLOUDS, css() (+38 more)

### Community 20 - "duplicates.js"
Cohesion: 0.18
Nodes (23): autoClean(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates(), loadForgotten(), removeOccurrence() (+15 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.19
Nodes (20): card(), SIZE, LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS (+12 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (76): SUMI, BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow() (+68 more)

### Community 23 - "normalize"
Cohesion: 0.29
Nodes (17): addQuickReminder(), addRow(), buildShell(), composer(), flushSaves(), focusItem(), focusRow(), mergeIn() (+9 more)

### Community 24 - "auth.js"
Cohesion: 0.16
Nodes (17): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken(), idRegistered(), mintToken(), parseRedirect() (+9 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "rng"
Cohesion: 0.29
Nodes (14): aurora, bamboo, forest, lotus, night, nocturne, ridge(), rng() (+6 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.12
Nodes (32): buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank(), GREENS (+24 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.12
Nodes (26): BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus(), hz() (+18 more)

### Community 29 - "buildShell"
Cohesion: 0.26
Nodes (12): loadCloudState(), backupMenu(), closeAllMenus(), driveBackup(), driveRestore(), menuButton(), close(), onDoc() (+4 more)

### Community 30 - "lounge-beach.js"
Cohesion: 0.04
Nodes (54): AMB, ARM, BAYER, BEACHES, beachFor(), beachW(), BIG_FRONDS, BOOK (+46 more)

### Community 31 - "ticker.js"
Cohesion: 0.17
Nodes (17): main(), loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, configure(), cryptoSym(), fetchCrypto(), fetchFx() (+9 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (54): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+46 more)

### Community 33 - "note"
Cohesion: 0.29
Nodes (30): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), runLoop(), setupCanvas() (+22 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (60): AUTH, BAYER, BOOK, BOX, CANDLES, CAT0, CATC, CATG (+52 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.11
Nodes (40): CAPS, createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu() (+32 more)

### Community 36 - "zenpins.js"
Cohesion: 0.30
Nodes (15): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+7 more)

### Community 37 - "lounge-woods.js"
Cohesion: 0.04
Nodes (50): AMB, BAYER, BAYS, BOOK, BULBC, BWIN, CANDLE, CATC (+42 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "buildShell"
Cohesion: 0.23
Nodes (15): buildShell(), flash(), focusTodo(), initZen(), isOn(), paintPager(), paintThought(), saveLayout() (+7 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.06
Nodes (30): Aesthetic direction, Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), Collections can be pinned to Zen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06) (+22 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "backupNow"
Cohesion: 0.36
Nodes (12): Cloud sync · views · tags · duplicates · ticker (2026-07-07), backupNow(), connect(), disconnect(), dropAllTokens(), isConfigured(), isLive(), NOT_CONFIGURED() (+4 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (62): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+54 more)

### Community 45 - "game-llama.js"
Cohesion: 0.10
Nodes (39): apple(), aurora(), backdrop(), blend(), css(), fog(), hourAt(), lightAt() (+31 more)

### Community 46 - "zen.js"
Cohesion: 0.14
Nodes (30): loadNotes(), arrange(), check(), collectionPin(), dueChip(), fmtDue(), folderPin(), FROM_LABEL (+22 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.22
Nodes (18): barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow(), saveWindow() (+10 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (21): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+13 more)

### Community 50 - "mixc"
Cohesion: 0.23
Nodes (14): cloudStrip(), deskL(), deskR(), fairyY(), kbAt(), leaf(), mixc(), paintBack() (+6 more)

### Community 51 - "step"
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
Cohesion: 0.14
Nodes (14): band(), bandN(), cloudStrip(), drawFire(), fx(), glassBeads(), glow(), outside() (+6 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "reminderBody"
Cohesion: 0.46
Nodes (8): checkbox(), checkRow(), lineView(), noteBody(), queueSave(), reminderBody(), todoBody(), wireField()

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "buildRoom"
Cohesion: 0.10
Nodes (31): buildRoom(), lineY(), mainPanes(), mixc(), paintBasket(), paintChair(), paintCorner(), paintCurtains() (+23 more)

### Community 64 - "sq"
Cohesion: 0.15
Nodes (20): archWindow(), deskBay(), drapeEdge(), drapes(), fernStand(), fireplace(), floorGlobe(), hearthRug() (+12 more)

### Community 65 - "drawRoom"
Cohesion: 0.14
Nodes (23): boltEnv(), clamp(), drawClock(), drawFrontLog(), drawGlobe(), drawHourglass(), drawLadder(), drawOutside() (+15 more)

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

### Community 73 - "Ras"
Cohesion: 0.16
Nodes (6): deerFrame(), foxFrame(), fx(), owlFrame(), Ras, rgba()

### Community 74 - "buildGarden"
Cohesion: 0.21
Nodes (14): buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintGravel(), paintKakei() (+6 more)

### Community 75 - "drawRoom"
Cohesion: 0.14
Nodes (20): bakeGen(), bandN(), bay(), drawFire(), drawGuide(), drawLayer(), drawLit(), drawRoom() (+12 more)

### Community 76 - "buildRoom"
Cohesion: 0.16
Nodes (17): buildRoom(), bulbsOf(), crestY(), fillString(), fireAt(), frac(), layoutFor(), lightAt() (+9 more)

### Community 77 - "render"
Cohesion: 0.09
Nodes (26): bake(), bakeSprite(), ease(), famBow(), finish(), fr(), glowAt(), hex() (+18 more)

### Community 78 - "buildJob"
Cohesion: 0.16
Nodes (18): bodhiTree(), buildJob(), flagStrings(), grove(), layout(), mixc(), paintBell(), paintLantern() (+10 more)

### Community 79 - "Ras"
Cohesion: 0.16
Nodes (7): cloudStrip(), drawLit(), Ras, ridgeFor(), ridgeStrip(), spriteImg(), toCanvas()

### Community 80 - "render"
Cohesion: 0.15
Nodes (22): bandPalette(), clamp(), cloudsFor(), disc(), drawCastle(), drawGull(), drawSun(), fill() (+14 more)

### Community 81 - "Ras"
Cohesion: 0.14
Nodes (11): band(), mistBand(), outside(), outT(), paintDeer(), paintFrog(), paintOwl(), Ras (+3 more)

### Community 82 - "buildBeach"
Cohesion: 0.16
Nodes (17): buildBeach(), fieldsFor(), fx(), glow(), layout(), paintCrown(), paintFire(), paintHut() (+9 more)

### Community 83 - "rng"
Cohesion: 0.25
Nodes (8): bookTitle(), branch(), EMBERS, LANDS, paintFern(), paintGarden(), paintTown(), rng()

### Community 84 - "paintArm"
Cohesion: 0.50
Nodes (5): crest(), paintArm(), paintWing(), wingRim(), wingX()

### Community 85 - "sq"
Cohesion: 0.17
Nodes (17): bakeGen(), buildRoom(), coolAt(), drawLit(), fillWarm(), fireAt(), lampAt(), lampBack() (+9 more)

### Community 86 - "sq"
Cohesion: 0.18
Nodes (12): bellSound(), bowlSound(), coolAt(), droneSound(), fieldJob(), lift(), lightStick(), paintPose() (+4 more)

### Community 87 - "el"
Cohesion: 0.08
Nodes (85): Audit + design refresh (2026-09-07), Section system + bento sidebar (2026-10-06), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile() (+77 more)

### Community 88 - "start"
Cohesion: 0.21
Nodes (25): fmt(), riderX(), riderY(), start(), airStep(), cash(), catchRail(), draw() (+17 more)

### Community 89 - "mk"
Cohesion: 0.11
Nodes (23): addLog(), animals(), drawFrost(), drawSnow(), finishJob(), flipCanvas(), glassClip(), glassState() (+15 more)

### Community 90 - "render"
Cohesion: 0.18
Nodes (15): drawLand(), drawLit(), drawRain(), drawRoom(), drawTunnel(), haltFor(), hex(), litHex() (+7 more)

### Community 91 - "drawBook"
Cohesion: 0.27
Nodes (11): bookLift(), bookStack(), drawBook(), openBook(), pageBot(), pageText(), pageTop(), paintFront() (+3 more)

### Community 92 - "outside"
Cohesion: 0.26
Nodes (12): bands(), bigTrunk(), fir(), mossRock(), mossyMaple(), paintFar(), paintGround(), paintHangingFern() (+4 more)

### Community 93 - "createEyeRest"
Cohesion: 0.35
Nodes (11): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+3 more)

### Community 94 - "glassBeads"
Cohesion: 0.21
Nodes (13): bedBay(), coolAt(), doorBay(), fern(), glassBeads(), inWin(), isBar(), kitchenBay() (+5 more)

### Community 95 - "mixc"
Cohesion: 0.26
Nodes (13): bulbPath(), ceilS(), ladderBay(), mixc(), paintBack(), paintBeams(), paintCeiling(), paintFloor() (+5 more)

### Community 96 - "fx"
Cohesion: 0.13
Nodes (26): clamp(), creekY(), drawGlass(), drawOutside(), drawRivs(), fillWarm(), fogMap(), fx() (+18 more)

### Community 97 - "paintSea"
Cohesion: 0.32
Nodes (13): bakeOne(), band(), bay(), drawBand(), mixc(), paintDunes(), paintFar(), paintFront() (+5 more)

### Community 98 - "fx"
Cohesion: 0.22
Nodes (12): bakeOne(), band(), buildLand(), cloudStrip(), fx(), glow(), paintTable(), rampOf() (+4 more)

### Community 99 - "paintPier"
Cohesion: 0.47
Nodes (6): paintPier(), paintStairs(), pDY(), pGY(), pW(), pX()

### Community 100 - "buildOutside"
Cohesion: 0.18
Nodes (16): band(), buildOutside(), cl(), drawOutside(), far2Y(), farY(), fieldY(), frostFor() (+8 more)

### Community 101 - "update"
Cohesion: 0.25
Nodes (11): ease(), frontAt(), gust(), makeState(), newGull(), newWave(), preview(), rng() (+3 more)

### Community 102 - "drawRoom"
Cohesion: 0.28
Nodes (8): bakeOne(), drawLit(), drawRoom(), drawTableThings(), litHex(), rampOf(), spriteImg(), toCanvas()

### Community 103 - "drawFire"
Cohesion: 0.40
Nodes (5): drawFire(), hash2(), kettleCanvas(), logsCanvas(), renderFire()

### Community 104 - "glassState"
Cohesion: 0.21
Nodes (12): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+4 more)

### Community 105 - "itemCard"
Cohesion: 0.30
Nodes (14): closePop(), findItem(), itemCard(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openColorPicker() (+6 more)

### Community 106 - "markdown.js"
Cohesion: 0.38
Nodes (7): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl()

### Community 107 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 108 - "sq"
Cohesion: 0.22
Nodes (10): coolAt(), fireAt(), lantAt(), moonPatch(), onMuntin(), paintBunk(), paintLanternLit(), sq() (+2 more)

### Community 109 - "removeCard"
Cohesion: 0.25
Nodes (11): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), armAlarm(), clearAlarm(), detectKind(), fireTime(), hasContent(), rearmAlarms(), remName() (+3 more)

### Community 110 - "buildFormatBar"
Cohesion: 0.36
Nodes (8): buildFormatBar(), hideFormatBar(), placeFormatBar(), runFormat(), runScale(), showFormatBar(), syncFormatBar(), updateBarState()

### Community 111 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 714 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `notes.js`, `spaces.js`, `settings.js`, `game-lantern.js`, `buildShell`, `itemCard`, `buildFormatBar`, `zen.js`, `tabs.js`, `createCalendar`, `backup.js`, `duplicates.js`, `createEyeRest`, `normalize`, `reminderBody`, `buildShell`, `ticker.js`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game-lantern.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1477832512315271 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `el` to `notes.js`, `spaces.js`, `game-lantern.js`, `settings.js`, `zenpins.js`, `buildShell`, `itemCard`, `buildFormatBar`, `zen.js`, `tabs.js`, `createCalendar`, `duplicates.js`, `createEyeRest`, `normalize`, `reminderBody`, `buildShell`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10416666666666667 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `game-lantern.js`, `fx`, `lounge-reading.js`, `lounge-woods.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `removeCard`, `lounge-cabin.js`, `game-ripples.js`, `game-brush.js`, `lounge-train.js`, `start`, `lounge-cafe.js`, `arcade-kit.js`, `lounge-beach.js`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08117283950617284 - nodes in this community are weakly interconnected._