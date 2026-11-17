# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 67 files · ~344,457 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2203 nodes · 6190 edges · 95 communities (89 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 218 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `408a4c83`
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
- render
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
- backup.js
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
- skyJob
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
- removeCard
- drawBook
- paintFloorJob
- buildFormatBar
- reminderBody

## God Nodes (most connected - your core abstractions)
1. `el()` - 135 edges
2. `icon()` - 76 edges
3. `toast()` - 62 edges
4. `Ras` - 47 edges
5. `update()` - 43 edges
6. `getKey()` - 40 edges
7. `StackNest — Tab Manager: Design` - 40 edges
8. `note()` - 36 edges
9. `start()` - 35 edges
10. `buildRoom()` - 34 edges

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

## Communities (95 total, 6 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.16
Nodes (32): Section system + bento sidebar (2026-10-06), hasPin(), isSessionUnlocked(), promptUnlock(), absorbFromChrome(), countEls, deleteBtn(), folderCount() (+24 more)

### Community 1 - "notes.js"
Cohesion: 0.10
Nodes (31): CARD_COLORS, cardDone(), clampScale(), clearDropMarks(), consumeSelfWrite(), editingInMosaic(), exportNotesOnly(), GUIDE (+23 more)

### Community 2 - "spaces.js"
Cohesion: 0.09
Nodes (60): Collection curation pass (2026-07-06), Collection-tile & duplicates refinements (2026-07-07), Spaces, Settings, Backup + hardening (2026-07-06), Spaces — Toby-style collections (2026-07-04), lockedOutDialog(), addLinkChecked(), addTabGhost(), boardCounts() (+52 more)

### Community 3 - "settings.js"
Cohesion: 0.08
Nodes (55): exportBackup(), stamp(), CLOUD_KEY, MAX_FAILS, SECURITY_QUESTIONS, appearancePlate(), appearanceStatus(), applySettings() (+47 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.17
Nodes (28): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Google Drive sync hardening (2026-07-08), forgetAllTokens(), api(), authError(), backupNow(), cloud, connect() (+20 more)

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
Cohesion: 0.18
Nodes (20): canStepScale(), DEFAULT_SCALE, enclosingPair(), isRun(), lineKind(), listContinuation(), MARKERS, replaceRange() (+12 more)

### Community 12 - "mock.js"
Cohesion: 0.13
Nodes (8): bm, bmEvents, bmNode(), groups, storageData, storageEvents, tabs, windowMeta

### Community 13 - "Chrome Web Store listing: StackNest"
Cohesion: 0.14
Nodes (12): Additional fields, Chrome Web Store listing: StackNest, Detailed description, Graphic assets, Privacy practices tab, Product details, Screenshot captions, Data usage (+4 more)

### Community 14 - "render"
Cohesion: 0.33
Nodes (11): arrange(), folderPin(), linkPin(), linkRow(), normalizeLayout(), paintFolds(), quiet(), render() (+3 more)

### Community 18 - "lock.js"
Cohesion: 0.18
Nodes (25): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasSecurityQuestion() (+17 more)

### Community 19 - "game-drive.js"
Cohesion: 0.08
Nodes (46): clamp(), BASE, bike(), broadleaf(), car(), CLOUDS, css(), curveAt() (+38 more)

### Community 20 - "ui.js"
Cohesion: 0.18
Nodes (26): Undo / redo for deletes (2026-07-06), autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates() (+18 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.20
Nodes (20): card(), koi(), LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS (+12 more)

### Community 22 - "game-brush.js"
Cohesion: 0.05
Nodes (75): Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow() (+67 more)

### Community 23 - "mutate"
Cohesion: 0.29
Nodes (17): addQuickReminder(), addRow(), buildShell(), composer(), flushSaves(), focusItem(), focusRow(), mergeIn() (+9 more)

### Community 24 - "auth.js"
Cohesion: 0.18
Nodes (12): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetToken(), mintToken(), parseRedirect(), profileToken(), SCOPES (+4 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.14
Nodes (28): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+20 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.11
Nodes (32): SIZE, buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank() (+24 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.09
Nodes (33): CAPS, BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus() (+25 more)

### Community 29 - "buildShell"
Cohesion: 0.26
Nodes (12): loadCloudState(), backupMenu(), closeAllMenus(), driveBackup(), driveRestore(), menuButton(), close(), onDoc() (+4 more)

### Community 30 - "arcade.js"
Cohesion: 0.21
Nodes (25): soundOn(), makeVoice(), audio(), clock(), createMeditation(), cancel(), close(), end() (+17 more)

### Community 31 - "ticker.js"
Cohesion: 0.17
Nodes (21): loadSettings(), TICKER_CRYPTOS, zenPlate(), draw(), chain, getKey(), configure(), cryptoSym() (+13 more)

### Community 32 - "webbridge.js"
Cohesion: 0.09
Nodes (54): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+46 more)

### Community 33 - "note"
Cohesion: 0.26
Nodes (30): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), rumble(), runLoop() (+22 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (54): AUTH, BAYER, boltEnv(), BOOK, BOX, CANDLES, CAT0, CATC (+46 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.15
Nodes (27): backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land(), lantern() (+19 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (15): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+7 more)

### Community 37 - "main"
Cohesion: 0.13
Nodes (19): main(), doRedo(), doUndo(), flash(), flashDeleted(), hide(), initHistory(), redoStack (+11 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "tags.js"
Cohesion: 0.17
Nodes (27): buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems(), graphView, initTags(), itemGrid() (+19 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (27): Aesthetic direction, De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught, Notes mosaic: unified cards, drag-order, tags, tints (2026-07-08) (+19 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "el"
Cohesion: 0.16
Nodes (33): Audit + design refresh (2026-09-07), acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile() (+25 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.04
Nodes (56): AMALA, BAYER, BELL, bellSound(), bowlSound(), C, CAT, CT (+48 more)

### Community 45 - "game-llama.js"
Cohesion: 0.13
Nodes (31): apple(), backdrop(), blend(), chasmBack(), chasmFeat(), dayAt(), DAYS, fog() (+23 more)

### Community 46 - "buildShell"
Cohesion: 0.14
Nodes (27): loadNotes(), NOTES_KEY, buildShell(), flash(), fmtDue(), focusTodo(), FROM_LABEL, initZen() (+19 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.30
Nodes (14): barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow(), saveWindow() (+6 more)

### Community 49 - "5. Data shapes"
Cohesion: 0.10
Nodes (20): 1. How a person connects, 2. Detecting the extension, 3. Transport, 4. Message types, 5. Data shapes, 6. A minimal client, 7. Rules for the site, 8. Developing against it (+12 more)

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
Nodes (14): bandN(), branch(), cloudStrip(), glassBeads(), glow(), inWin(), outside(), paintBead() (+6 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "openReminderEditor"
Cohesion: 0.30
Nodes (14): closePop(), findItem(), itemCard(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openColorPicker() (+6 more)

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "backup.js"
Cohesion: 0.21
Nodes (16): Calm structure + Linen theme (2026-09-07), Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow(), isObj() (+8 more)

### Community 64 - "sq"
Cohesion: 0.16
Nodes (20): archWindow(), deskBay(), drapeEdge(), drapes(), fernStand(), fireplace(), floorGlobe(), hearthRug() (+12 more)

### Community 65 - "drawRoom"
Cohesion: 0.13
Nodes (24): band(), drawClock(), drawFire(), drawFrontLog(), drawGlobe(), drawHourglass(), drawLadder(), drawProjection() (+16 more)

### Community 66 - "Ras"
Cohesion: 0.15
Nodes (3): drawSmoke(), Ras, spire()

### Community 68 - "update"
Cohesion: 0.14
Nodes (19): addRipple(), ease(), finish(), gardenFor(), gust(), keep(), landFly(), makeState() (+11 more)

### Community 69 - "bakeJob"
Cohesion: 0.11
Nodes (25): bakeJob(), band(), buildJob(), clamp(), glow(), hazeCanvas(), layout(), litAt() (+17 more)

### Community 70 - "render"
Cohesion: 0.17
Nodes (15): bakeOne(), disc(), drawChime(), drawKoi(), drawLit(), fill(), hex(), litOf() (+7 more)

### Community 71 - "Ras"
Cohesion: 0.23
Nodes (4): bay(), paintBamboo(), paintSky(), Ras

### Community 72 - "paintBack"
Cohesion: 0.17
Nodes (15): archTop(), flagStrings(), garland(), paintArch(), paintBackJob(), paintBellFrame(), paintBuddha(), paintNiche() (+7 more)

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
Cohesion: 0.11
Nodes (24): bake(), bakeSprite(), ease(), famBow(), finish(), fr(), glowAt(), hex() (+16 more)

### Community 78 - "skyJob"
Cohesion: 0.29
Nodes (7): bodhiTree(), grove(), palms(), pump(), pumpSky(), skyJob(), stupa()

### Community 79 - "markdown.js"
Cohesion: 0.23
Nodes (13): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl(), check() (+5 more)

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
Cohesion: 0.50
Nodes (5): coolAt(), fieldJob(), paintPose(), sq(), warmAt()

### Community 87 - "el"
Cohesion: 0.31
Nodes (13): createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu(), stop() (+5 more)

### Community 88 - "start"
Cohesion: 0.19
Nodes (27): fmt(), riderX(), riderY(), start(), airStep(), cash(), catchRail(), draw() (+19 more)

### Community 90 - "removeCard"
Cohesion: 0.25
Nodes (11): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), armAlarm(), clearAlarm(), detectKind(), fireTime(), hasContent(), rearmAlarms(), remName() (+3 more)

### Community 91 - "drawBook"
Cohesion: 0.60
Nodes (6): bookLift(), drawBook(), openBook(), pageBot(), pageText(), pageTop()

### Community 92 - "paintFloorJob"
Cohesion: 0.22
Nodes (11): lamp(), monkTable(), paintAltar(), paintBoard(), paintBowl(), paintBurner(), paintFloorJob(), paintOffering() (+3 more)

### Community 93 - "buildFormatBar"
Cohesion: 0.36
Nodes (8): buildFormatBar(), hideFormatBar(), placeFormatBar(), runFormat(), runScale(), showFormatBar(), syncFormatBar(), updateBarState()

### Community 94 - "reminderBody"
Cohesion: 0.46
Nodes (8): checkbox(), checkRow(), lineView(), noteBody(), queueSave(), reminderBody(), todoBody(), wireField()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 540 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `render`, `lock.js`, `ui.js`, `mutate`, `arcade-kit.js`, `buildShell`, `arcade.js`, `ticker.js`, `main`, `tags.js`, `el`, `buildShell`, `tabs.js`, `openReminderEditor`, `backup.js`, `createEyeRest`, `markdown.js`, `createCalendar`, `buildFormatBar`, `reminderBody`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10416666666666667 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `render`, `lock.js`, `ui.js`, `mutate`, `arcade-kit.js`, `buildShell`, `arcade.js`, `ticker.js`, `zenpins.js`, `main`, `tags.js`, `buildShell`, `tabs.js`, `openReminderEditor`, `createEyeRest`, `markdown.js`, `createCalendar`, `el`, `buildFormatBar`, `reminderBody`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08672659968270756 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `lounge-reading.js`, `game-lantern.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `game-ripples.js`, `game-brush.js`, `lounge-train.js`, `start`, `lounge-cafe.js`, `removeCard`, `arcade-kit.js`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07532467532467532 - nodes in this community are weakly interconnected._