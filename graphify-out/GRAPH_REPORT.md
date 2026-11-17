# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 70 files · ~428,811 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2717 nodes · 7431 edges · 109 communities (101 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 241 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2e73b3d8`
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
- lock.js
- game-drive.js
- backup.js
- game-ripples.js
- game-brush.js
- normalize
- buildShell
- lounge-cafe.js
- wallpapers.js
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
- tags.js
- StackNest — Tab Manager: Design
- fr
- el
- lounge-temple.js
- game-llama.js
- zen.js
- painter
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
- openReminderEditor
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
- myspace.js
- start
- mk
- render
- drawBook
- outside
- placeFormatBar
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
- markdown.js
- createEyeRest
- thoughts.js
- createCalendar
- playChime

## God Nodes (most connected - your core abstractions)
1. `el()` - 135 edges
2. `icon()` - 76 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `note()` - 44 edges
6. `update()` - 43 edges
7. `buildRoom()` - 40 edges
8. `getKey()` - 40 edges
9. `StackNest — Tab Manager: Design` - 40 edges
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

## Communities (109 total, 8 thin omitted)

### Community 0 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 1 - "notes.js"
Cohesion: 0.11
Nodes (32): CARD_COLORS, cardDone(), clearDropMarks(), closePop(), consumeSelfWrite(), editingInMosaic(), GUIDE, initNotes() (+24 more)

### Community 2 - "spaces.js"
Cohesion: 0.08
Nodes (78): Collection curation pass (2026-07-06), Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), removeOccurrence(), flashDeleted(), pushHistory(), addLinkChecked(), addTabGhost() (+70 more)

### Community 3 - "settings.js"
Cohesion: 0.07
Nodes (65): Collection-tile & duplicates refinements (2026-07-07), CLOUD_KEY, MAX_FAILS, SECURITY_QUESTIONS, appearancePlate(), appearanceStatus(), applySettings(), backupPlate() (+57 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.10
Nodes (45): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Drive: whose Google account? (2026-07-09), Google Drive sync hardening (2026-07-08), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken(), mintToken() (+37 more)

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
Cohesion: 0.13
Nodes (26): canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+18 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "lounge-cabin.js"
Cohesion: 0.03
Nodes (62): AUR, BAYER, BOOK, BOOKC, BRASS, CHAIR, COLS, CT (+54 more)

### Community 18 - "lock.js"
Cohesion: 0.17
Nodes (31): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+23 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (46): clamp(), rumble(), BASE, bike(), broadleaf(), car(), CLOUDS, css() (+38 more)

### Community 20 - "backup.js"
Cohesion: 0.16
Nodes (19): Calm structure + Linen theme (2026-09-07), Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow() (+11 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.20
Nodes (19): card(), LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS, padsFor() (+11 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (75): BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow(), clearTrace() (+67 more)

### Community 23 - "normalize"
Cohesion: 0.21
Nodes (16): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), clampScale(), detectKind(), focusItem(), hasContent(), importFromFile(), isObj(), mergeIn() (+8 more)

### Community 24 - "buildShell"
Cohesion: 0.25
Nodes (14): buildShell(), focusTodo(), initZen(), isOn(), paintPager(), paintThought(), saveLayout(), setPage() (+6 more)

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
Nodes (27): BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus(), hz() (+19 more)

### Community 29 - "buildShell"
Cohesion: 0.26
Nodes (12): backupMenu(), buildShell(), closeAllMenus(), composer(), driveBackup(), menuButton(), close(), onDoc() (+4 more)

### Community 30 - "lounge-beach.js"
Cohesion: 0.04
Nodes (54): AMB, ARM, BAYER, BEACHES, beachFor(), beachW(), BIG_FRONDS, BOOK (+46 more)

### Community 31 - "ticker.js"
Cohesion: 0.14
Nodes (21): main(), doRedo(), doUndo(), flash(), hide(), initHistory(), redoStack, undoStack (+13 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (51): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, DEFAULT_SECTIONS (+43 more)

### Community 33 - "note"
Cohesion: 0.28
Nodes (31): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), runLoop(), setupCanvas() (+23 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (60): AUTH, BAYER, BOOK, BOX, CANDLES, CAT0, CATC, CATG (+52 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.12
Nodes (37): CAPS, createArcade(), launch(), setShelf(), showMenu(), stop(), zoomLaunch(), setSound() (+29 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (17): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+9 more)

### Community 37 - "lounge-woods.js"
Cohesion: 0.04
Nodes (52): AMB, BAYER, BAYS, BOOK, BULBC, BWIN, CANDLE, CATC (+44 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "tags.js"
Cohesion: 0.18
Nodes (25): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, initTags(), itemGrid() (+17 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (29): Aesthetic direction, Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+21 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "el"
Cohesion: 0.08
Nodes (80): Audit + design refresh (2026-09-07), Section system + bento sidebar (2026-10-06), fillTodos(), saveCanvas(), showCard(), acceptMoves(), bookmarkCard(), crumbsBar() (+72 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (62): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+54 more)

### Community 45 - "game-llama.js"
Cohesion: 0.10
Nodes (39): apple(), aurora(), backdrop(), blend(), css(), fog(), hourAt(), lightAt() (+31 more)

### Community 46 - "zen.js"
Cohesion: 0.14
Nodes (29): loadNotes(), NOTES_KEY, arrange(), check(), dueChip(), flash(), fmtDue(), folderPin() (+21 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

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

### Community 59 - "openReminderEditor"
Cohesion: 0.20
Nodes (28): addQuickReminder(), addRow(), armAlarm(), checkbox(), checkRow(), clearAlarm(), exportNotesOnly(), findItem() (+20 more)

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "buildRoom"
Cohesion: 0.08
Nodes (41): buildRoom(), coolAt(), fireAt(), lantAt(), lineY(), mainPanes(), mixc(), moonPatch() (+33 more)

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
Cohesion: 0.15
Nodes (9): band(), deerFrame(), foxFrame(), fx(), glow(), owlFrame(), Ras, rgba() (+1 more)

### Community 74 - "buildGarden"
Cohesion: 0.21
Nodes (14): buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintGravel(), paintKakei() (+6 more)

### Community 75 - "drawRoom"
Cohesion: 0.13
Nodes (21): bakeGen(), bandN(), bands(), bay(), drawFire(), drawGuide(), drawLayer(), drawLit() (+13 more)

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

### Community 87 - "myspace.js"
Cohesion: 0.26
Nodes (16): isSessionUnlocked(), absorbFromChrome(), countEls, deleteBtn(), groupedBody(), initMySpace(), loadSpace(), moveFromLibrary() (+8 more)

### Community 88 - "start"
Cohesion: 0.21
Nodes (25): fmt(), riderX(), riderY(), start(), airStep(), cash(), catchRail(), draw() (+17 more)

### Community 89 - "mk"
Cohesion: 0.12
Nodes (27): addLog(), animals(), drawFrost(), drawOutside(), drawSnow(), finishJob(), FIRETXT(), flipCanvas() (+19 more)

### Community 90 - "render"
Cohesion: 0.18
Nodes (15): drawLand(), drawLit(), drawRain(), drawRoom(), drawTunnel(), haltFor(), hex(), litHex() (+7 more)

### Community 91 - "drawBook"
Cohesion: 0.27
Nodes (11): bookLift(), bookStack(), drawBook(), openBook(), pageBot(), pageText(), pageTop(), paintFront() (+3 more)

### Community 92 - "outside"
Cohesion: 0.17
Nodes (18): band(), bigTrunk(), fir(), mistBand(), mossRock(), mossyMaple(), outside(), paintDeer() (+10 more)

### Community 93 - "placeFormatBar"
Cohesion: 0.60
Nodes (5): hideFormatBar(), placeFormatBar(), showFormatBar(), syncFormatBar(), updateBarState()

### Community 94 - "glassBeads"
Cohesion: 0.16
Nodes (18): clamp(), coolAt(), fern(), fillWarm(), fogMap(), glassBeads(), inWin(), isBar() (+10 more)

### Community 95 - "mixc"
Cohesion: 0.17
Nodes (18): bedBay(), bulbPath(), ceilS(), doorBay(), kitchenBay(), ladderBay(), mixc(), paintBack() (+10 more)

### Community 96 - "fx"
Cohesion: 0.17
Nodes (15): creekY(), drawGlass(), drawOutside(), drawRivs(), fx(), makeBuffers(), makeState(), newRiv() (+7 more)

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
Cohesion: 0.27
Nodes (11): buildOutside(), cl(), far2Y(), farY(), fieldY(), frostFor(), noise2(), paintFireplace() (+3 more)

### Community 101 - "update"
Cohesion: 0.25
Nodes (11): ease(), frontAt(), gust(), makeState(), newGull(), newWave(), preview(), rng() (+3 more)

### Community 102 - "drawRoom"
Cohesion: 0.22
Nodes (10): bakeOne(), drawLit(), drawRoom(), drawTableThings(), hex(), litHex(), rampOf(), sm() (+2 more)

### Community 103 - "drawFire"
Cohesion: 0.40
Nodes (5): drawFire(), hash2(), kettleCanvas(), logsCanvas(), renderFire()

### Community 104 - "glassState"
Cohesion: 0.21
Nodes (12): drawGlass(), finish(), glassState(), landFor(), makeBuffer(), makeState(), mk(), newDrop() (+4 more)

### Community 105 - "markdown.js"
Cohesion: 0.38
Nodes (7): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl()

### Community 106 - "createEyeRest"
Cohesion: 0.42
Nodes (10): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+2 more)

### Community 107 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 108 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 708 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `notes.js`, `spaces.js`, `game-lantern.js`, `settings.js`, `drive.js`, `tags.js`, `createEyeRest`, `format.js`, `createCalendar`, `zen.js`, `lock.js`, `backup.js`, `myspace.js`, `buildShell`, `openReminderEditor`, `buildShell`, `ticker.js`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game-lantern.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `game-lantern.js`, `lounge-reading.js`, `lounge-woods.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `lounge-cabin.js`, `lounge-cafe.js`, `game-ripples.js`, `game-brush.js`, `normalize`, `start`, `mk`, `lounge-train.js`, `arcade-kit.js`, `lounge-beach.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10873440285204991 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `el` to `notes.js`, `spaces.js`, `game-lantern.js`, `settings.js`, `drive.js`, `zenpins.js`, `tags.js`, `createEyeRest`, `format.js`, `createCalendar`, `zen.js`, `lock.js`, `myspace.js`, `buildShell`, `openReminderEditor`, `buildShell`, `ticker.js`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08364197530864198 - nodes in this community are weakly interconnected._