# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 66 files · ~427,003 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2689 nodes · 7410 edges · 111 communities (103 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 246 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6185036`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- game-lantern.js
- notes.js
- spaces.js
- settings.js
- support.js
- drive.js
- smoke-test.mjs
- manifest.json
- StackNest privacy policy
- 3. Owner actions
- lounge-room.js
- format.js
- lock.js
- Chrome Web Store listing: StackNest
- lounge-cabin.js
- .impeccable.md
- package.sh
- backup.js
- game-drive.js
- ui.js
- tags.js
- game-brush.js
- normalize
- bookmarks.js
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
- toast
- StackNest — Tab Manager: Design
- fr
- game-ripples.js
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
- setKey
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
- icon
- start
- mk
- render
- drawBook
- outside
- backupNow
- clamp
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
- start
- render
- sq
- closePop
- sw.js

## God Nodes (most connected - your core abstractions)
1. `el()` - 136 edges
2. `icon()` - 77 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `note()` - 44 edges
6. `update()` - 43 edges
7. `StackNest — Tab Manager: Design` - 43 edges
8. `buildRoom()` - 40 edges
9. `getKey()` - 40 edges
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

## Communities (111 total, 8 thin omitted)

### Community 0 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 1 - "notes.js"
Cohesion: 0.11
Nodes (26): canStepScale(), stepScale(), buildFormatBar(), CARD_COLORS, clearDropMarks(), GUIDE, hideFormatBar(), KIND_LABEL (+18 more)

### Community 2 - "spaces.js"
Cohesion: 0.10
Nodes (56): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), buildBookmarksHtml(), createEmpty(), datestamp(), deleteBtn(), disarmRename(), esc() (+48 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (60): CLOUD_KEY, appearancePlate(), appearanceStatus(), applySettings(), backupPlate(), callout(), checkGroup(), DEFAULT_SETTINGS (+52 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.21
Nodes (15): Google Drive sync hardening (2026-07-08), forgetAllTokens(), api(), authError(), cloud, deleteFile(), downloadLive(), DriveError (+7 more)

### Community 6 - "smoke-test.mjs"
Cohesion: 0.12
Nodes (5): problems, { proc, send, on }, ROOT, signInIds, VIEWS

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
Nodes (33): BAYER, blendSet(), CARS, CAT, CATC, CT, curtainEdge(), drawOutside() (+25 more)

### Community 11 - "format.js"
Cohesion: 0.19
Nodes (19): Calm structure + Linen theme (2026-09-07), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+11 more)

### Community 12 - "lock.js"
Cohesion: 0.15
Nodes (27): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasSecurityQuestion() (+19 more)

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "lounge-cabin.js"
Cohesion: 0.03
Nodes (65): AUR, BAYER, BOOK, BOOKC, BRASS, CHAIR, COLS, CT (+57 more)

### Community 18 - "backup.js"
Cohesion: 0.22
Nodes (14): Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow(), isObj() (+6 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (46): clamp(), rumble(), BASE, bike(), broadleaf(), car(), CLOUDS, css() (+38 more)

### Community 20 - "ui.js"
Cohesion: 0.11
Nodes (37): main(), autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates() (+29 more)

### Community 21 - "tags.js"
Cohesion: 0.18
Nodes (28): fillTodos(), saveCanvas(), showCard(), buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems() (+20 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (76): Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow() (+68 more)

### Community 23 - "normalize"
Cohesion: 0.19
Nodes (17): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), clampScale(), detectKind(), focusItem(), hasContent(), importFromFile(), isObj(), mergeIn() (+9 more)

### Community 24 - "bookmarks.js"
Cohesion: 0.22
Nodes (21): acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile(), getFolder() (+13 more)

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
Cohesion: 0.21
Nodes (15): loadCloudState(), backupMenu(), buildShell(), closeAllMenus(), driveBackup(), driveRestore(), editingInMosaic(), menuButton() (+7 more)

### Community 30 - "lounge-beach.js"
Cohesion: 0.04
Nodes (54): AMB, ARM, BAYER, BEACHES, beachFor(), beachW(), BIG_FRONDS, BOOK (+46 more)

### Community 31 - "ticker.js"
Cohesion: 0.19
Nodes (17): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, configure(), cryptoSym(), fetchCrypto(), fetchFx(), fmtPrice() (+9 more)

### Community 32 - "webbridge.js"
Cohesion: 0.10
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
Cohesion: 0.23
Nodes (19): cache, FROM, initZenPins(), isZenPinned(), keyOf(), keys, loadZenPins(), normalize() (+11 more)

### Community 37 - "lounge-woods.js"
Cohesion: 0.04
Nodes (52): AMB, BAYER, BAYS, BOOK, BULBC, BWIN, CANDLE, CATC (+44 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.21
Nodes (9): band(), buildScreens(), cloudStrip(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+1 more)

### Community 40 - "toast"
Cohesion: 0.20
Nodes (22): Collection curation pass (2026-07-06), Collection-tile & duplicates refinements (2026-07-07), Spaces — Toby-style collections (2026-07-04), hasPin(), pinField(), promptUnlock(), requirePin(), addLinkChecked() (+14 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.06
Nodes (30): Aesthetic direction, Collections can be pinned to Zen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+22 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "game-ripples.js"
Cohesion: 0.20
Nodes (19): card(), LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS, padsFor() (+11 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (62): AMALA, BAYER, BELL, C, CAT, CT, ELDW, FAMILY (+54 more)

### Community 45 - "game-llama.js"
Cohesion: 0.10
Nodes (39): apple(), aurora(), backdrop(), blend(), css(), fog(), hourAt(), lightAt() (+31 more)

### Community 46 - "zen.js"
Cohesion: 0.06
Nodes (76): NOTES, playChime(), emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown() (+68 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.23
Nodes (18): Audit + design refresh (2026-09-07), barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow() (+10 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (21): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+13 more)

### Community 50 - "mixc"
Cohesion: 0.29
Nodes (12): deskL(), deskR(), fairyY(), leaf(), mixc(), paintBack(), paintFront(), paintLeft() (+4 more)

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
Cohesion: 0.15
Nodes (15): bakeOne(), calColours(), drawLit(), drawRoom(), fx(), hex(), kbAt(), lavaHW() (+7 more)

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

### Community 59 - "setKey"
Cohesion: 0.21
Nodes (15): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetToken(), idRegistered(), mintToken(), parseRedirect(), profileToken() (+7 more)

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

### Community 87 - "icon"
Cohesion: 0.14
Nodes (34): Section system + bento sidebar (2026-10-06), isLockedOut(), isSessionUnlocked(), relock(), absorbFromChrome(), countEls, deleteBtn(), folderCount() (+26 more)

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
Cohesion: 0.17
Nodes (18): band(), bigTrunk(), fir(), mistBand(), mossRock(), mossyMaple(), outside(), paintDeer() (+10 more)

### Community 93 - "backupNow"
Cohesion: 0.33
Nodes (14): Cloud sync · views · tags · duplicates · ticker (2026-07-07), backupNow(), connect(), disconnect(), isConfigured(), isLive(), NOT_CONFIGURED(), patchState() (+6 more)

### Community 94 - "clamp"
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
Cohesion: 0.19
Nodes (29): addQuickReminder(), addRow(), armAlarm(), checkbox(), checkRow(), clearAlarm(), composer(), findItem() (+21 more)

### Community 106 - "start"
Cohesion: 0.22
Nodes (14): drawGlass(), finish(), flicker(), makeBuffers(), makeState(), newCodeLine(), paneDrop(), preview() (+6 more)

### Community 107 - "render"
Cohesion: 0.20
Nodes (11): consumeSelfWrite(), exportNotesOnly(), initNotes(), load(), now(), openCount(), rearmAlarms(), render() (+3 more)

### Community 108 - "sq"
Cohesion: 0.22
Nodes (10): coolAt(), fireAt(), lantAt(), moonPatch(), onMuntin(), paintBunk(), paintLanternLit(), sq() (+2 more)

### Community 109 - "closePop"
Cohesion: 0.52
Nodes (7): closePop(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openTagPicker(), placePop()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 690 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `tags.js` to `notes.js`, `spaces.js`, `settings.js`, `lock.js`, `backup.js`, `ui.js`, `normalize`, `bookmarks.js`, `buildShell`, `ticker.js`, `game-lantern.js`, `toast`, `zen.js`, `tabs.js`, `icon`, `backupNow`, `itemCard`, `render`, `closePop`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game-lantern.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `game-lantern.js`, `lounge-reading.js`, `lounge-woods.js`, `lounge-garden.js`, `lounge-room.js`, `game-ripples.js`, `start`, `game-llama.js`, `lounge-cabin.js`, `lounge-temple.js`, `lounge-train.js`, `game-brush.js`, `normalize`, `start`, `lounge-cafe.js`, `arcade-kit.js`, `lounge-beach.js`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11375661375661375 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `tags.js` to `notes.js`, `spaces.js`, `game-lantern.js`, `settings.js`, `zenpins.js`, `toast`, `itemCard`, `render`, `closePop`, `zen.js`, `tabs.js`, `ui.js`, `backupNow`, `icon`, `bookmarks.js`, `buildShell`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09643483343074226 - nodes in this community are weakly interconnected._