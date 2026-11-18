# Graph Report - StackNest  (2026-11-18)

## Corpus Check
- 66 files · ~431,234 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2719 nodes · 7542 edges · 100 communities (94 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 262 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a29017bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- game-lantern.js
- notes.js
- duplicates.js
- settings.js
- support.js
- lock.js
- smoke-test.mjs
- manifest.json
- StackNest privacy policy
- 3. Owner actions
- lounge-room.js
- format.js
- sw.js
- Chrome Web Store listing: StackNest
- lounge-cabin.js
- .impeccable.md
- package.sh
- createEyeRest
- game-drive.js
- bridgeY
- tags.js
- game-brush.js
- markdown.js
- lounge-cafe.js
- wallpapers.js
- game-pebbles.js
- arcade-kit.js
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
- spaces.js
- StackNest — Tab Manager: Design
- fr
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
- Ras
- buildGarden
- drawRoom
- buildRoom
- render
- Ras
- render
- Ras
- buildBeach
- rng
- paintArm
- sq
- icon
- start
- mk
- render
- drawBook
- outside
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
- createCalendar
- sq

## God Nodes (most connected - your core abstractions)
1. `el()` - 141 edges
2. `icon()` - 80 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `StackNest — Tab Manager: Design` - 45 edges
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
- `Zen mode + wallpapers (2026-11-16)` --references--> `tone()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/arcade-kit.js
- `Reorderable Spaces / drag-and-drop (2026-07-06)` --references--> `reorderSpace()`  [INFERRED]
  docs/specs/2026-07-03-stacknest-design.md → js/spacesStore.js

## Import Cycles
- 3-file cycle: `js/backup.js -> js/notes.js -> js/drive.js -> js/backup.js`
- 3-file cycle: `js/backup.js -> js/settings.js -> js/drive.js -> js/backup.js`

## Communities (100 total, 6 thin omitted)

### Community 0 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 1 - "notes.js"
Cohesion: 0.06
Nodes (107): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), Zen edits notes in place, and a quick note waits in the top-right corner (2026-11-18), addNoteRow(), addQuickNote(), addQuickReminder(), addRow(), armAlarm(), backupMenu() (+99 more)

### Community 2 - "duplicates.js"
Cohesion: 0.11
Nodes (32): Audit + design refresh (2026-09-07), main(), autoClean(), collectOccurrences(), FORGET_KEY, forgetLink(), forgottenSection(), groupCard() (+24 more)

### Community 3 - "settings.js"
Cohesion: 0.07
Nodes (57): Collection-tile & duplicates refinements (2026-07-07), NOTES, playChime(), CLOUD_KEY, NO_SIGNIN_MSG, appearancePlate(), appearanceStatus(), applySettings() (+49 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "lock.js"
Cohesion: 0.14
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
Nodes (45): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawGlass() (+37 more)

### Community 11 - "format.js"
Cohesion: 0.22
Nodes (17): canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), MARKERS, replaceRange(), runAfter() (+9 more)

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "lounge-cabin.js"
Cohesion: 0.03
Nodes (65): AUR, BAYER, BOOK, BOOKC, BRASS, CHAIR, COLS, CT (+57 more)

### Community 18 - "createEyeRest"
Cohesion: 0.42
Nodes (10): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+2 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (42): clamp(), BASE, bike(), broadleaf(), car(), CLOUDS, css(), curveAt() (+34 more)

### Community 21 - "tags.js"
Cohesion: 0.19
Nodes (23): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, itemGrid(), itemMatches() (+15 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (76): Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow() (+68 more)

### Community 24 - "markdown.js"
Cohesion: 0.38
Nodes (7): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl()

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.14
Nodes (28): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+20 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.08
Nodes (51): card(), buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank() (+43 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.12
Nodes (26): BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus(), hz() (+18 more)

### Community 30 - "lounge-beach.js"
Cohesion: 0.04
Nodes (54): AMB, ARM, BAYER, BEACHES, beachFor(), beachW(), BIG_FRONDS, BOOK (+46 more)

### Community 31 - "ticker.js"
Cohesion: 0.17
Nodes (19): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, draw(), configure(), cryptoSym(), fetchCrypto(), fetchFx() (+11 more)

### Community 32 - "webbridge.js"
Cohesion: 0.10
Nodes (52): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+44 more)

### Community 33 - "note"
Cohesion: 0.23
Nodes (34): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), rumble(), runLoop() (+26 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (60): AUTH, BAYER, BOOK, BOX, CANDLES, CAT0, CATC, CATG (+52 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.12
Nodes (39): CAPS, createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu() (+31 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (16): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+8 more)

### Community 37 - "lounge-woods.js"
Cohesion: 0.04
Nodes (50): AMB, BAYER, BAYS, BOOK, BULBC, BWIN, CANDLE, CATC (+42 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "spaces.js"
Cohesion: 0.07
Nodes (85): Calm structure + Linen theme (2026-09-07), Collection curation pass (2026-07-06), Notes & Todos view (2026-07-08), Spaces, Settings, Backup + hardening (2026-07-06), Spaces — Toby-style collections (2026-07-04), Undo / redo for deletes (2026-07-06), applyBackup(), buildBackup() (+77 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.06
Nodes (30): Aesthetic direction, Collections can be pinned to Zen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+22 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.03
Nodes (88): AMALA, archTop(), BAYER, BELL, bellSound(), bowlSound(), C, CAT (+80 more)

### Community 45 - "game-llama.js"
Cohesion: 0.10
Nodes (40): PRELUDE, apple(), aurora(), backdrop(), blend(), css(), fog(), hourAt() (+32 more)

### Community 46 - "zen.js"
Cohesion: 0.07
Nodes (71): listContinuation(), replaceText(), KIND_LABEL, loadNotes(), saveNoteField(), CLASSICAL, dayIndex(), normalizeThoughts() (+63 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.25
Nodes (16): barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow(), saveWindow() (+8 more)

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
Nodes (54): BAYER, BRASS, buildRoom(), CAR, COAT, coolAt(), CT, DOOR (+46 more)

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

### Community 59 - "drive.js"
Cohesion: 0.10
Nodes (49): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Drive says "not available here" instead of pretending (2026-11-18), Drive: whose Google account? (2026-07-09), Google Drive sync hardening (2026-07-08), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken() (+41 more)

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.18
Nodes (20): azalea(), band(), foliage(), grass(), paintBack(), paintBasin(), paintCrown(), paintFence() (+12 more)

### Community 63 - "buildRoom"
Cohesion: 0.10
Nodes (31): buildRoom(), lineY(), mainPanes(), mixc(), paintBasket(), paintChair(), paintCorner(), paintCurtains() (+23 more)

### Community 64 - "sq"
Cohesion: 0.15
Nodes (20): archWindow(), deskBay(), drapeEdge(), drapes(), fernStand(), fireplace(), floorGlobe(), hearthRug() (+12 more)

### Community 65 - "drawRoom"
Cohesion: 0.14
Nodes (23): boltEnv(), clamp(), drawClock(), drawFrontLog(), drawGlobe(), drawHourglass(), drawLadder(), drawOutside() (+15 more)

### Community 66 - "Ras"
Cohesion: 0.12
Nodes (9): band(), bodhiTree(), glow(), grove(), palms(), Ras, shaftsJob(), skyJob() (+1 more)

### Community 67 - "Ras"
Cohesion: 0.16
Nodes (6): buildLand(), cloudStrip(), haltFor(), Ras, ridge(), rng()

### Community 68 - "update"
Cohesion: 0.18
Nodes (18): addRipple(), ease(), finish(), gardenFor(), gust(), keep(), landFly(), makeState() (+10 more)

### Community 69 - "bakeJob"
Cohesion: 0.11
Nodes (25): bakeJob(), buildJob(), clamp(), hazeCanvas(), hex(), layout(), litAt(), makeState() (+17 more)

### Community 70 - "render"
Cohesion: 0.24
Nodes (14): clamp(), disc(), drawChime(), drawKoi(), fill(), hex(), litOf(), mixc() (+6 more)

### Community 71 - "Ras"
Cohesion: 0.15
Nodes (9): bakeOne(), bay(), drawLit(), paintBamboo(), paintSky(), paintWater(), Ras, spriteImg() (+1 more)

### Community 73 - "Ras"
Cohesion: 0.16
Nodes (6): deerFrame(), foxFrame(), fx(), owlFrame(), Ras, rgba()

### Community 74 - "buildGarden"
Cohesion: 0.20
Nodes (15): buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintCat(), paintGravel() (+7 more)

### Community 75 - "drawRoom"
Cohesion: 0.14
Nodes (20): bakeGen(), bandN(), bay(), drawFire(), drawGuide(), drawLayer(), drawLit(), drawRoom() (+12 more)

### Community 76 - "buildRoom"
Cohesion: 0.16
Nodes (17): buildRoom(), bulbsOf(), crestY(), fillString(), fireAt(), frac(), layoutFor(), lightAt() (+9 more)

### Community 77 - "render"
Cohesion: 0.11
Nodes (24): bake(), bakeSprite(), drawSmoke(), ease(), famBow(), finish(), fr(), glowAt() (+16 more)

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

### Community 87 - "icon"
Cohesion: 0.09
Nodes (69): Section system + bento sidebar (2026-10-06), acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile() (+61 more)

### Community 88 - "start"
Cohesion: 0.21
Nodes (25): fmt(), riderX(), riderY(), start(), airStep(), cash(), catchRail(), draw() (+17 more)

### Community 89 - "mk"
Cohesion: 0.11
Nodes (23): addLog(), animals(), drawFrost(), drawSnow(), finishJob(), flipCanvas(), glassClip(), glassState() (+15 more)

### Community 90 - "render"
Cohesion: 0.24
Nodes (12): bakeOne(), drawLit(), drawRain(), drawRoom(), hex(), litHex(), rampOf(), render() (+4 more)

### Community 91 - "drawBook"
Cohesion: 0.27
Nodes (11): bookLift(), bookStack(), drawBook(), openBook(), pageBot(), pageText(), pageTop(), paintFront() (+3 more)

### Community 92 - "outside"
Cohesion: 0.26
Nodes (12): bands(), bigTrunk(), fir(), mossRock(), mossyMaple(), paintFar(), paintGround(), paintHangingFern() (+4 more)

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
Cohesion: 0.24
Nodes (9): band(), drawLand(), drawTunnel(), fx(), glow(), rgba(), tile(), tilePos() (+1 more)

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
Nodes (16): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+8 more)

### Community 106 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

### Community 108 - "sq"
Cohesion: 0.22
Nodes (10): coolAt(), fireAt(), lantAt(), moonPatch(), onMuntin(), paintBunk(), paintLanternLit(), sq() (+2 more)

## Knowledge Gaps
- **2 isolated node(s):** `RFC-2606`, `./js/drive.js`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 692 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `zen.js` to `notes.js`, `duplicates.js`, `game-lantern.js`, `settings.js`, `lock.js`, `spaces.js`, `createCalendar`, `tabs.js`, `createEyeRest`, `tags.js`, `icon`, `drive.js`, `ticker.js`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **What connects `RFC-2606`, `./js/drive.js` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game-lantern.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `game-lantern.js`, `notes.js`, `lounge-room.js`, `lounge-cabin.js`, `game-brush.js`, `lounge-cafe.js`, `game-pebbles.js`, `arcade-kit.js`, `lounge-beach.js`, `lounge-reading.js`, `lounge-woods.js`, `lounge-garden.js`, `lounge-temple.js`, `game-llama.js`, `lounge-train.js`, `update`, `start`, `fx`, `glassState`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05946313285762827 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `icon` to `notes.js`, `duplicates.js`, `settings.js`, `game-lantern.js`, `lock.js`, `zenpins.js`, `spaces.js`, `createCalendar`, `zen.js`, `tabs.js`, `createEyeRest`, `tags.js`, `drive.js`, `ticker.js`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `duplicates.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11411411411411411 - nodes in this community are weakly interconnected._