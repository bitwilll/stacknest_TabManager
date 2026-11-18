# Graph Report - StackNest  (2026-11-18)

## Corpus Check
- 66 files · ~441,499 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2769 nodes · 7696 edges · 114 communities (108 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 273 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da0f1cd3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- game-lantern.js
- notes.js
- tabs.js
- settings.js
- support.js
- lock.js
- smoke-test.mjs
- manifest.json
- StackNest privacy policy
- 3. Owner actions
- lounge-room.js
- format.js
- render
- Chrome Web Store listing: StackNest
- lounge-cabin.js
- .impeccable.md
- package.sh
- createEyeRest
- game-drive.js
- el
- tags.js
- game-brush.js
- duplicates.js
- markdown.js
- lounge-cafe.js
- wallpapers.js
- game-pebbles.js
- arcade-kit.js
- start
- lounge-beach.js
- ticker.js
- webbridge.js
- tone
- lounge-reading.js
- game-lantern.js
- zenpins.js
- lounge-woods.js
- lounge-garden.js
- Ras
- spacesStore.js
- StackNest — Tab Manager: Design
- fr
- spaces.js
- lounge-temple.js
- game-llama.js
- listCard
- painter
- thoughts.js
- 5. Data shapes
- mutate
- playLoungeMusic
- rng
- lounge-train.js
- start
- buildBack
- Ras
- toast
- buildRoom
- drive.js
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
- auth.js
- Ras
- buildGarden
- drawRoom
- buildRoom
- render
- paintBackJob
- Ras
- render
- Ras
- buildBeach
- sq
- itemCard
- sq
- collectionPin
- pointIn
- arcade.js
- mk
- render
- drawBook
- outside
- fx
- glassBeads
- mixc
- fx
- paintSea
- fx
- drip
- buildOutside
- update
- drawRoom
- drawFire
- glassState
- menuButton
- createCalendar
- api
- zen.js
- skyJob
- sq
- buildFormatBar
- checkRow
- sw.js

## God Nodes (most connected - your core abstractions)
1. `el()` - 143 edges
2. `icon()` - 81 edges
3. `toast()` - 62 edges
4. `StackNest — Tab Manager: Design` - 50 edges
5. `Ras` - 47 edges
6. `note()` - 44 edges
7. `update()` - 43 edges
8. `buildRoom()` - 40 edges
9. `getKey()` - 39 edges
10. `swish()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `Google sign-in: one extension ID everywhere, and a plain answer when it isn't (2026-11-17)` --references--> `main()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/app.js
- `A. Accounts and policy page` --references--> `main()`  [INFERRED]
  docs/store/launch-checklist.md → js/app.js
- `C. Google sign-in for store users` --references--> `main()`  [INFERRED]
  docs/store/launch-checklist.md → js/app.js
- `The open-tabs bar switches from the board, and from the bar itself (2026-11-18)` --references--> `saveSettings()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/settings.js
- `Reorderable Spaces / drag-and-drop (2026-07-06)` --references--> `reorderSpace()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/spacesStore.js

## Import Cycles
- 3-file cycle: `js/backup.js -> js/notes.js -> js/drive.js -> js/backup.js`
- 3-file cycle: `js/backup.js -> js/settings.js -> js/drive.js -> js/backup.js`

## Communities (114 total, 6 thin omitted)

### Community 0 - "game-lantern.js"
Cohesion: 0.14
Nodes (30): clamp(), backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+22 more)

### Community 1 - "notes.js"
Cohesion: 0.09
Nodes (39): Notes inside Zen: a fourth page beside Lounge (2026-11-18), CARD_COLORS, cardDone(), clampScale(), clearDropMarks(), consumeSelfWrite(), deleteNoteCard(), editingInMosaic() (+31 more)

### Community 2 - "tabs.js"
Cohesion: 0.21
Nodes (19): initDuplicates(), deleteBtn(), barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render() (+11 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (54): NOTES, playChime(), CLOUD_KEY, NO_SIGNIN_MSG, appearancePlate(), appearanceStatus(), applySettings(), backupPlate() (+46 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "lock.js"
Cohesion: 0.13
Nodes (34): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+26 more)

### Community 6 - "smoke-test.mjs"
Cohesion: 0.12
Nodes (6): ./js/drive.js, problems, { proc, send, on }, ROOT, signInIds, VIEWS

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
Nodes (32): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawOutside() (+24 more)

### Community 11 - "format.js"
Cohesion: 0.20
Nodes (19): Calm structure + Linen theme (2026-09-07), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+11 more)

### Community 12 - "render"
Cohesion: 0.22
Nodes (17): buildShell(), focusTodo(), goPage(), initZen(), isOn(), onSwipeWheel(), pageNow(), paintPager() (+9 more)

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "lounge-cabin.js"
Cohesion: 0.03
Nodes (62): AUR, BAYER, BOOK, BOOKC, BRASS, CHAIR, COLS, CT (+54 more)

### Community 18 - "createEyeRest"
Cohesion: 0.42
Nodes (10): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+2 more)

### Community 19 - "game-drive.js"
Cohesion: 0.08
Nodes (46): card(), rumble(), BASE, bike(), broadleaf(), car(), CLOUDS, css() (+38 more)

### Community 20 - "el"
Cohesion: 0.12
Nodes (51): Audit + design refresh (2026-09-07), Section system + bento sidebar (2026-10-06), fillTodos(), saveCanvas(), showCard(), render(), isSessionUnlocked(), relock() (+43 more)

### Community 21 - "tags.js"
Cohesion: 0.29
Nodes (14): closeTagEditor(), dedupe(), gatherItems(), graphView, loadTags(), onDocDown(), onDocKey(), onDocScroll() (+6 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (79): Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), runLoop(), BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk() (+71 more)

### Community 23 - "duplicates.js"
Cohesion: 0.11
Nodes (33): main(), autoClean(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), loadForgotten(), removeOccurrence() (+25 more)

### Community 24 - "markdown.js"
Cohesion: 0.26
Nodes (10): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl(), fmtDue() (+2 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.12
Nodes (38): activeOwn(), aurora, bamboo, cloudsea, darkPine(), DEFAULT_WALLPAPER, dunes, dusk (+30 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.08
Nodes (51): SIZE, buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank() (+43 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.11
Nodes (28): BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus(), hz() (+20 more)

### Community 29 - "start"
Cohesion: 0.20
Nodes (28): note(), swish(), fmt(), riderX(), riderY(), start(), airStep(), cash() (+20 more)

### Community 30 - "lounge-beach.js"
Cohesion: 0.04
Nodes (51): AMB, ARM, BAYER, BEACHES, BIG_FRONDS, BOOK, CLOUD, CLOUDS (+43 more)

### Community 31 - "ticker.js"
Cohesion: 0.17
Nodes (19): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, draw(), configure(), cryptoSym(), fetchCrypto(), fetchFx() (+11 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (54): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+46 more)

### Community 33 - "tone"
Cohesion: 0.15
Nodes (22): Zen mode + wallpapers (2026-11-16), tone(), bake(), bellSound(), bowlSound(), droneSound(), finish(), lift() (+14 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (52): AUTH, BAYER, BOOK, BOX, CANDLES, CAT0, CATC, CATG (+44 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.21
Nodes (25): soundOn(), makeVoice(), audio(), clock(), createMeditation(), cancel(), close(), end() (+17 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (18): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+10 more)

### Community 37 - "lounge-woods.js"
Cohesion: 0.04
Nodes (50): AMB, BAYER, BAYS, BOOK, BULBC, BWIN, CANDLE, CATC (+42 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, bridgeY(), CANE, CAT (+36 more)

### Community 39 - "Ras"
Cohesion: 0.18
Nodes (12): bakeOne(), band(), buildScreens(), cloudStrip(), glow(), makeSign(), outside(), paintCity() (+4 more)

### Community 40 - "spacesStore.js"
Cohesion: 0.10
Nodes (44): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), applyBackup(), exportBackup(), importBookmarkTree(), importFlow(), isObj(), stamp() (+36 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.06
Nodes (33): Aesthetic direction, Collections can be pinned to Zen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+25 more)

### Community 42 - "fr"
Cohesion: 0.14
Nodes (28): activity(), armPos(), bookY(), bubble(), curtain(), door(), ease(), farWalker() (+20 more)

### Community 43 - "spaces.js"
Cohesion: 0.12
Nodes (42): Collection curation pass (2026-07-06), Collection-tile & duplicates refinements (2026-07-07), Spaces — Toby-style collections (2026-07-04), addLinkChecked(), addTabGhost(), boardCounts(), buildBookmarksHtml(), colorOf() (+34 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (59): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+51 more)

### Community 45 - "game-llama.js"
Cohesion: 0.11
Nodes (37): apple(), aurora(), backdrop(), blend(), css(), fog(), hourAt(), lightAt() (+29 more)

### Community 46 - "listCard"
Cohesion: 0.18
Nodes (22): saveNoteField(), areaField(), cardActs(), caretEnd(), check(), createNotesPage(), paint(), createQuickNote() (+14 more)

### Community 47 - "painter"
Cohesion: 0.16
Nodes (21): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+13 more)

### Community 48 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (21): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+13 more)

### Community 50 - "mutate"
Cohesion: 0.17
Nodes (30): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), Zen edits notes in place, and a quick note waits in the top-right corner (2026-11-18), addNoteCard(), addNoteRow(), addQuickNote(), addQuickReminder(), addRow(), armAlarm() (+22 more)

### Community 51 - "playLoungeMusic"
Cohesion: 0.16
Nodes (19): playLoungeMusic(), bell(), build(), buildVignette(), glassSpan(), layout(), mk(), newDrop() (+11 more)

### Community 52 - "rng"
Cohesion: 0.21
Nodes (13): buildCity(), buildClouds(), building(), buildSky(), makeState(), preview(), rng(), snowCap() (+5 more)

### Community 53 - "lounge-train.js"
Cohesion: 0.06
Nodes (54): BAYER, BRASS, buildRoom(), CAR, COAT, coolAt(), CT, DOOR (+46 more)

### Community 54 - "start"
Cohesion: 0.12
Nodes (24): boltEnv(), bookTitle(), clamp(), drawGlass(), drawGlobe(), drawOutside(), drawRivs(), fillWarm() (+16 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

### Community 57 - "toast"
Cohesion: 0.23
Nodes (22): acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile(), getFolder() (+14 more)

### Community 58 - "buildRoom"
Cohesion: 0.16
Nodes (22): buildRoom(), coolAt(), deskL(), deskR(), fairyY(), floorAt(), lampAt(), leaf() (+14 more)

### Community 59 - "drive.js"
Cohesion: 0.18
Nodes (24): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Notes & Todos view (2026-07-08), forgetAllTokens(), idRegistered(), buildBackup(), exportBookmarkTree(), assertUsable(), authError() (+16 more)

### Community 60 - "fgProp"
Cohesion: 0.60
Nodes (5): blade(), buildFront(), buildMid(), fgProp(), rim()

### Community 62 - "paintBack"
Cohesion: 0.19
Nodes (18): azalea(), foliage(), grass(), paintBack(), paintBasin(), paintCrown(), paintFence(), paintGround() (+10 more)

### Community 63 - "buildRoom"
Cohesion: 0.08
Nodes (41): buildRoom(), coolAt(), fireAt(), lantAt(), lineY(), mainPanes(), mixc(), moonPatch() (+33 more)

### Community 64 - "sq"
Cohesion: 0.15
Nodes (20): archWindow(), deskBay(), drapeEdge(), drapes(), fernStand(), fireplace(), floorGlobe(), hearthRug() (+12 more)

### Community 65 - "drawRoom"
Cohesion: 0.13
Nodes (23): band(), drawClock(), drawFire(), drawFrontLog(), drawHourglass(), drawLadder(), drawProjection(), drawPull() (+15 more)

### Community 67 - "Ras"
Cohesion: 0.16
Nodes (6): buildLand(), cloudStrip(), haltFor(), Ras, ridge(), rng()

### Community 68 - "update"
Cohesion: 0.16
Nodes (22): setupCanvas(), addRipple(), ease(), finish(), gardenFor(), gardenW(), gust(), keep() (+14 more)

### Community 69 - "bakeJob"
Cohesion: 0.13
Nodes (21): bakeJob(), band(), buildJob(), clamp(), glow(), hazeCanvas(), hex(), layout() (+13 more)

### Community 70 - "render"
Cohesion: 0.24
Nodes (14): clamp(), disc(), drawChime(), drawKoi(), fill(), hex(), litOf(), mixc() (+6 more)

### Community 71 - "Ras"
Cohesion: 0.15
Nodes (9): bakeOne(), bay(), drawLit(), paintBamboo(), paintSky(), paintWater(), Ras, spriteImg() (+1 more)

### Community 72 - "auth.js"
Cohesion: 0.19
Nodes (16): Drive says "not available here" instead of pretending (2026-11-18), Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), mintToken(), NO_SIGNIN, parseRedirect(), profileToken() (+8 more)

### Community 73 - "Ras"
Cohesion: 0.15
Nodes (9): band(), deerFrame(), foxFrame(), fx(), glow(), owlFrame(), Ras, rgba() (+1 more)

### Community 74 - "buildGarden"
Cohesion: 0.19
Nodes (17): band(), buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintCat() (+9 more)

### Community 75 - "drawRoom"
Cohesion: 0.14
Nodes (20): bakeGen(), bandN(), bay(), drawFire(), drawGuide(), drawLayer(), drawLit(), drawRoom() (+12 more)

### Community 76 - "buildRoom"
Cohesion: 0.16
Nodes (17): buildRoom(), bulbsOf(), crestY(), fillString(), fireAt(), frac(), layoutFor(), lightAt() (+9 more)

### Community 77 - "render"
Cohesion: 0.14
Nodes (16): bakeSprite(), drawSmoke(), ease(), famBow(), fr(), glowAt(), lerpPose(), paintCat() (+8 more)

### Community 78 - "paintBackJob"
Cohesion: 0.17
Nodes (15): archTop(), flagStrings(), garland(), paintArch(), paintBackJob(), paintBellFrame(), paintBuddha(), paintNiche() (+7 more)

### Community 79 - "Ras"
Cohesion: 0.16
Nodes (7): cloudsFor(), cloudStrip(), drawLit(), Ras, rng(), spriteImg(), toCanvas()

### Community 80 - "render"
Cohesion: 0.18
Nodes (17): bandPalette(), disc(), drawCastle(), drawGull(), drawSun(), fill(), hex(), mixSteps() (+9 more)

### Community 81 - "Ras"
Cohesion: 0.14
Nodes (11): band(), mistBand(), outside(), outT(), paintDeer(), paintFrog(), paintOwl(), Ras (+3 more)

### Community 82 - "buildBeach"
Cohesion: 0.15
Nodes (18): buildBeach(), fieldsFor(), fx(), glow(), layout(), paintCrown(), paintFire(), paintGlass() (+10 more)

### Community 83 - "sq"
Cohesion: 0.18
Nodes (17): bandN(), branch(), cloudStrip(), EMBERS, glassBeads(), glow(), LANDS, outside() (+9 more)

### Community 84 - "itemCard"
Cohesion: 0.25
Nodes (16): closePop(), findItem(), itemCard(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openColorPicker() (+8 more)

### Community 85 - "sq"
Cohesion: 0.22
Nodes (11): bakeGen(), buildRoom(), coolAt(), drawLit(), finish(), lampBack(), layoutFor(), paintCup() (+3 more)

### Community 86 - "collectionPin"
Cohesion: 0.23
Nodes (15): arrange(), collectionPin(), editingField(), folderPin(), linkPin(), linkRow(), normalizeLayout(), paintFolds() (+7 more)

### Community 87 - "pointIn"
Cohesion: 0.20
Nodes (15): pointIn(), drawGlass(), finish(), flicker(), makeBuffers(), makeState(), newCodeLine(), paneDrop() (+7 more)

### Community 88 - "arcade.js"
Cohesion: 0.23
Nodes (12): CAPS, createArcade(), launch(), setShelf(), showMenu(), stop(), zoomLaunch(), setSound() (+4 more)

### Community 89 - "mk"
Cohesion: 0.12
Nodes (27): addLog(), animals(), drawFrost(), drawOutside(), drawSnow(), finishJob(), FIRETXT(), flipCanvas() (+19 more)

### Community 90 - "render"
Cohesion: 0.24
Nodes (12): bakeOne(), drawLit(), drawRain(), drawRoom(), hex(), litHex(), rampOf(), render() (+4 more)

### Community 91 - "drawBook"
Cohesion: 0.27
Nodes (11): bookLift(), bookStack(), drawBook(), openBook(), pageBot(), pageText(), pageTop(), paintFront() (+3 more)

### Community 92 - "outside"
Cohesion: 0.26
Nodes (12): bands(), bigTrunk(), fir(), mossRock(), mossyMaple(), paintFar(), paintGround(), paintHangingFern() (+4 more)

### Community 93 - "fx"
Cohesion: 0.17
Nodes (13): calColours(), drawLit(), drawRoom(), fx(), hex(), kbAt(), lavaHW(), litHex() (+5 more)

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
Cohesion: 0.31
Nodes (14): bakeOne(), band(), bay(), drawBand(), ease(), mixc(), paintDunes(), paintFar() (+6 more)

### Community 98 - "fx"
Cohesion: 0.24
Nodes (9): band(), drawLand(), drawTunnel(), fx(), glow(), rgba(), tile(), tilePos() (+1 more)

### Community 99 - "drip"
Cohesion: 0.18
Nodes (20): drip(), ensureCtx(), splash(), beachFor(), beachW(), clamp(), finish(), keep() (+12 more)

### Community 100 - "buildOutside"
Cohesion: 0.27
Nodes (11): buildOutside(), cl(), far2Y(), farY(), fieldY(), frostFor(), noise2(), paintFireplace() (+3 more)

### Community 101 - "update"
Cohesion: 0.31
Nodes (9): frontAt(), gust(), makeState(), newGull(), newWave(), preview(), stepOf(), update() (+1 more)

### Community 102 - "drawRoom"
Cohesion: 0.22
Nodes (10): bakeOne(), drawLit(), drawRoom(), drawTableThings(), hex(), litHex(), rampOf(), sm() (+2 more)

### Community 103 - "drawFire"
Cohesion: 0.40
Nodes (5): drawFire(), hash2(), kettleCanvas(), logsCanvas(), renderFire()

### Community 104 - "glassState"
Cohesion: 0.21
Nodes (16): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+8 more)

### Community 105 - "menuButton"
Cohesion: 0.29
Nodes (11): loadCloudState(), backupMenu(), closeAllMenus(), driveBackup(), driveRestore(), menuButton(), close(), onDoc() (+3 more)

### Community 106 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

### Community 107 - "api"
Cohesion: 0.25
Nodes (10): Google Drive sync hardening (2026-07-08), api(), deleteFile(), downloadLive(), DriveError, driveMessage(), fetchEmail(), isConfigured() (+2 more)

### Community 108 - "zen.js"
Cohesion: 0.12
Nodes (33): KIND_LABEL, NOTES_KEY, beginSwipe(), calm, dropSwipe(), finishOut(), followSwipe(), FROM_LABEL (+25 more)

### Community 109 - "skyJob"
Cohesion: 0.19
Nodes (14): bodhiTree(), grove(), mixc(), paintBell(), painter(), paintMan(), paintMonk(), paintWalker() (+6 more)

### Community 110 - "sq"
Cohesion: 0.50
Nodes (5): coolAt(), fieldJob(), paintPose(), sq(), warmAt()

### Community 111 - "buildFormatBar"
Cohesion: 0.27
Nodes (10): canStepScale(), stepScale(), buildFormatBar(), hideFormatBar(), placeFormatBar(), runList(), runScale(), showFormatBar() (+2 more)

### Community 112 - "checkRow"
Cohesion: 0.36
Nodes (8): checkbox(), checkRow(), focusRow(), onRowKey(), removeRow(), runFormat(), todoBody(), wireField()

### Community 113 - "sw.js"
Cohesion: 0.33
Nodes (3): forgetToken(), isFinished(), rearmReminders()

## Knowledge Gaps
- **2 isolated node(s):** `RFC-2606`, `./js/drive.js`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 700 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `notes.js`, `tabs.js`, `settings.js`, `lock.js`, `format.js`, `render`, `createEyeRest`, `tags.js`, `duplicates.js`, `ticker.js`, `game-lantern.js`, `spaces.js`, `listCard`, `mutate`, `toast`, `drive.js`, `itemCard`, `collectionPin`, `arcade.js`, `menuButton`, `createCalendar`, `zen.js`, `buildFormatBar`, `checkRow`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `RFC-2606`, `./js/drive.js` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game-lantern.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1350806451612903 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `start` to `game-lantern.js`, `lounge-room.js`, `lounge-cabin.js`, `game-brush.js`, `lounge-cafe.js`, `game-pebbles.js`, `arcade-kit.js`, `lounge-beach.js`, `tone`, `lounge-reading.js`, `lounge-woods.js`, `lounge-garden.js`, `lounge-temple.js`, `game-llama.js`, `mutate`, `playLoungeMusic`, `lounge-train.js`, `start`, `update`, `pointIn`, `mk`, `fx`, `drip`, `glassState`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08658536585365853 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `el` to `notes.js`, `tabs.js`, `settings.js`, `lock.js`, `render`, `createEyeRest`, `tags.js`, `duplicates.js`, `ticker.js`, `game-lantern.js`, `zenpins.js`, `spaces.js`, `listCard`, `mutate`, `toast`, `drive.js`, `itemCard`, `collectionPin`, `arcade.js`, `menuButton`, `createCalendar`, `zen.js`, `buildFormatBar`, `checkRow`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07894736842105263 - nodes in this community are weakly interconnected._