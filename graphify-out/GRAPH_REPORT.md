# Graph Report - StackNest  (2026-11-17)

## Corpus Check
- 67 files · ~302,683 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .woff2 2, .css 1)

## Summary
- 2014 nodes · 5640 edges · 87 communities (81 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 206 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d6a17d37`
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
- backup.js
- lounge-garden.js
- Ras
- tags.js
- StackNest — Tab Manager: Design
- fr
- el
- lounge-temple.js
- game-llama.js
- reminderBody
- painter
- tabs.js
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
- itemCard
- fgProp
- paintBack
- spacesStore.js
- sq
- drawRoom
- Ras
- Ras
- update
- build
- render
- Ras
- paintBack
- el
- buildGarden
- buildFormatBar
- createEyeRest
- render
- paintSky
- markdown.js
- thoughts.js
- createArcade
- createCalendar
- preview
- drawBook
- buildRoom
- sq

## God Nodes (most connected - your core abstractions)
1. `el()` - 134 edges
2. `icon()` - 76 edges
3. `toast()` - 62 edges
4. `Ras` - 43 edges
5. `update()` - 43 edges
6. `getKey()` - 40 edges
7. `StackNest — Tab Manager: Design` - 40 edges
8. `confirmDialog()` - 33 edges
9. `note()` - 31 edges
10. `actionBtn()` - 29 edges

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

## Communities (87 total, 6 thin omitted)

### Community 0 - "myspace.js"
Cohesion: 0.13
Nodes (39): Section system + bento sidebar (2026-10-06), isSessionUnlocked(), absorbFromChrome(), countEls, deleteBtn(), folderCount(), gate(), groupedBody() (+31 more)

### Community 1 - "notes.js"
Cohesion: 0.10
Nodes (33): Three kinds: note / to-do list / reminder, + Markdown & formatting (2026-07-10), CARD_COLORS, clampScale(), clearDropMarks(), consumeSelfWrite(), detectKind(), editingInMosaic(), exportNotesOnly() (+25 more)

### Community 2 - "spaces.js"
Cohesion: 0.11
Nodes (50): Collection curation pass (2026-07-06), Spaces — Toby-style collections (2026-07-04), addLinkChecked(), addTabGhost(), boardCounts(), buildBookmarksHtml(), colorOf(), column() (+42 more)

### Community 3 - "settings.js"
Cohesion: 0.07
Nodes (59): Collection-tile & duplicates refinements (2026-07-07), CLOUD_KEY, MAX_FAILS, SECURITY_QUESTIONS, appearancePlate(), appearanceStatus(), applySettings(), backupPlate() (+51 more)

### Community 4 - "support.js"
Cohesion: 0.05
Nodes (63): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), getDC(), Dispatcher() (+55 more)

### Community 5 - "drive.js"
Cohesion: 0.17
Nodes (29): Cloud sync · views · tags · duplicates · ticker (2026-07-07), Google Drive sync hardening (2026-07-08), api(), authError(), backupNow(), cloud, connect(), deleteFile() (+21 more)

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
Cohesion: 0.12
Nodes (29): NOTES, playChime(), loadNotes(), buildShell(), flash(), fmtDue(), focusTodo(), FROM_LABEL (+21 more)

### Community 18 - "lock.js"
Cohesion: 0.17
Nodes (31): attemptsLeft(), b64(), clearFailures(), clearPin(), derive(), enc, getQuestion(), hasPin() (+23 more)

### Community 19 - "game-drive.js"
Cohesion: 0.09
Nodes (39): BASE, BASE_RGB, bike(), broadleaf(), car(), CLOUDS, css(), curveAt() (+31 more)

### Community 20 - "duplicates.js"
Cohesion: 0.14
Nodes (25): main(), autoClean(), collectOccurrences(), forgetLink(), forgottenSection(), groupCard(), groupDuplicates(), initDuplicates() (+17 more)

### Community 21 - "game-ripples.js"
Cohesion: 0.20
Nodes (20): card(), koi(), LIGHT, makeKoi(), meta, MORE_KOI, pad(), PADS (+12 more)

### Community 22 - "game-brush.js"
Cohesion: 0.06
Nodes (75): BIP39_WORDS, artwork(), BOARDS, brushOnRest(), brushRest(), buildDesk(), castShadow(), clearTrace() (+67 more)

### Community 23 - "mutate"
Cohesion: 0.22
Nodes (22): addQuickReminder(), addRow(), armAlarm(), clearAlarm(), composer(), flushSaves(), focusItem(), importFromFile() (+14 more)

### Community 24 - "auth.js"
Cohesion: 0.18
Nodes (14): Drive: whose Google account? (2026-07-09), authUrl(), canChooseAccount(), forgetAllTokens(), forgetToken(), mintToken(), parseRedirect(), profileToken() (+6 more)

### Community 25 - "lounge-cafe.js"
Cohesion: 0.05
Nodes (39): ARM, AWN, BAY, BLD, BOOK, BOOKCOL, BRICK, C (+31 more)

### Community 26 - "wallpapers.js"
Cohesion: 0.14
Nodes (28): activeOwn(), aurora, bamboo, DEFAULT_WALLPAPER, dunes, dusk, enso, forest (+20 more)

### Community 27 - "game-pebbles.js"
Cohesion: 0.12
Nodes (31): buildScenery(), buildSide(), caustics(), centre(), decorPad(), DOREMI, drawBank(), GREENS (+23 more)

### Community 28 - "arcade-kit.js"
Cohesion: 0.09
Nodes (31): CAPS, BOLS, BOSSA, buffers(), CANON, DAYAN, drum(), hallBus() (+23 more)

### Community 29 - "buildShell"
Cohesion: 0.25
Nodes (14): loadCloudState(), backupMenu(), buildShell(), closeAllMenus(), driveBackup(), driveRestore(), menuButton(), close() (+6 more)

### Community 30 - "arcade.js"
Cohesion: 0.23
Nodes (24): soundOn(), audio(), clock(), createMeditation(), cancel(), close(), end(), finish() (+16 more)

### Community 31 - "ticker.js"
Cohesion: 0.16
Nodes (20): loadSettings(), SETTINGS_KEY, TICKER_CRYPTOS, draw(), configure(), cryptoSym(), fetchCrypto(), fetchFx() (+12 more)

### Community 32 - "webbridge.js"
Cohesion: 0.10
Nodes (52): RFC-2606, ACTIONS, arr(), boardOut(), BRIDGE_FILE, BRIDGE_SCRIPT_ID, CHANNEL, connectWeb() (+44 more)

### Community 33 - "note"
Cohesion: 0.20
Nodes (33): drip(), ensureCtx(), note(), playAmbience(), playLoungeMusic(), pointIn(), rumble(), runLoop() (+25 more)

### Community 34 - "lounge-reading.js"
Cohesion: 0.04
Nodes (49): AUTH, BAYER, BOOK, bookStack(), BOX, CANDLES, CATC, CLOCK (+41 more)

### Community 35 - "game-lantern.js"
Cohesion: 0.14
Nodes (28): SIZE, backdrop(), beyond(), ease(), firefly(), hill(), hillLine(), land() (+20 more)

### Community 36 - "zenpins.js"
Cohesion: 0.25
Nodes (17): cache, FROM, initZenPins(), isZenPinned(), keyOf(), loadZenPins(), normalize(), paint() (+9 more)

### Community 37 - "backup.js"
Cohesion: 0.19
Nodes (16): Notes & Todos view (2026-07-08), applyBackup(), buildBackup(), exportBackup(), exportBookmarkTree(), importBookmarkTree(), importFlow(), isObj() (+8 more)

### Community 38 - "lounge-garden.js"
Cohesion: 0.04
Nodes (44): AMB, BASIN, BAYER, BLACK, BLEAF, CANE, CAT, CEDAR (+36 more)

### Community 39 - "Ras"
Cohesion: 0.19
Nodes (11): band(), buildScreens(), fx(), glow(), makeSign(), outside(), paintCity(), paintStreet() (+3 more)

### Community 40 - "tags.js"
Cohesion: 0.15
Nodes (29): removeTab(), tabCard(), SPACES_KEY, buildGraph(), chip(), closeTagEditor(), dedupe(), gatherItems() (+21 more)

### Community 41 - "StackNest — Tab Manager: Design"
Cohesion: 0.07
Nodes (28): Aesthetic direction, Brush Stroke's saved painting gets a foot, a little luck and a sigil; games keep their shape in full screen (2026-11-17), De-clutter pass (2026-07-04), Design-chief polish + launch readiness (2026-10-09), Features, Files, Fix: invisible collection-header actions (2026-07-06), Follow-up: two gaps the token audit could not have caught (+20 more)

### Community 42 - "fr"
Cohesion: 0.19
Nodes (22): activity(), armPos(), bubble(), curtain(), door(), ease(), farWalker(), fr() (+14 more)

### Community 43 - "el"
Cohesion: 0.21
Nodes (23): Audit + design refresh (2026-09-07), acceptMoves(), bookmarkCard(), crumbsBar(), deleteBtn(), ensureFolder(), folderCard(), folderTile() (+15 more)

### Community 44 - "lounge-temple.js"
Cohesion: 0.05
Nodes (38): AMALA, BAYER, C, CAT, CT, ELDERMAN, FAMILY, FATHER (+30 more)

### Community 45 - "game-llama.js"
Cohesion: 0.15
Nodes (28): clamp(), apple(), blend(), dayAt(), DAYS, makeGround(), meta, peak() (+20 more)

### Community 46 - "reminderBody"
Cohesion: 0.31
Nodes (10): checkbox(), checkRow(), focusRow(), lineView(), noteBody(), onRowKey(), queueSave(), reminderBody() (+2 more)

### Community 47 - "painter"
Cohesion: 0.22
Nodes (16): armSprite(), baristaFrame(), carSprite(), catFrame(), coreStroke(), croissantSprite(), cupSprite(), dogFrame() (+8 more)

### Community 48 - "tabs.js"
Cohesion: 0.28
Nodes (15): barMode(), chip(), currentWindowTabs(), initTabs(), isOwnPage(), render(), saveCurrentWindow(), saveWindow() (+7 more)

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
Cohesion: 0.08
Nodes (22): bakeOne(), band(), BAYER, coolAt(), CT, DOOR, FONT, glow() (+14 more)

### Community 54 - "drawRoom"
Cohesion: 0.18
Nodes (12): bakeOne(), calColours(), drawLit(), drawRoom(), hex(), lavaHW(), litHex(), order() (+4 more)

### Community 55 - "buildBack"
Cohesion: 0.32
Nodes (12): backModule(), bricks(), buildBack(), floorBoards(), framedPicture(), jar(), pick(), plantPot() (+4 more)

### Community 56 - "Ras"
Cohesion: 0.17
Nodes (11): bakeOne(), band(), cloudStrip(), fx(), glow(), outside(), paintCat(), Ras (+3 more)

### Community 57 - "buildRoom"
Cohesion: 0.29
Nodes (10): buildRoom(), coolAt(), floorAt(), lampAt(), paintCat(), paintPlant(), paintTail(), sprite() (+2 more)

### Community 58 - "mixHex"
Cohesion: 0.25
Nodes (9): guestFrame(), guestSpr(), mixHex(), nearWalker(), rimOf(), umbrellaSprite(), umbSpr(), walkerFrame() (+1 more)

### Community 59 - "itemCard"
Cohesion: 0.29
Nodes (14): closePop(), findItem(), itemCard(), mountPop(), onPopDown(), onPopKey(), onPopScroll(), openColorPicker() (+6 more)

### Community 60 - "fgProp"
Cohesion: 0.47
Nodes (6): blade(), bookY(), buildFront(), fgProp(), pageText(), rim()

### Community 62 - "paintBack"
Cohesion: 0.17
Nodes (25): azalea(), band(), bridgeY(), clamp(), foliage(), grass(), mixc(), paintBack() (+17 more)

### Community 63 - "spacesStore.js"
Cohesion: 0.21
Nodes (21): Spaces, Settings, Backup + hardening (2026-07-06), Undo / redo for deletes (2026-07-06), addSpace(), addWorkspace(), deleteSpace(), deleteWorkspace(), ensureWorkspaces(), insertSpaceAt() (+13 more)

### Community 64 - "sq"
Cohesion: 0.16
Nodes (23): archWindow(), bookTitle(), branch(), drapeEdge(), drapes(), EMBERS, fireplace(), hearthRug() (+15 more)

### Community 65 - "drawRoom"
Cohesion: 0.13
Nodes (22): boltEnv(), clamp(), drawClock(), drawFire(), drawGlass(), drawGlobe(), drawHourglass(), drawLadder() (+14 more)

### Community 68 - "update"
Cohesion: 0.14
Nodes (19): addRipple(), ease(), finish(), gardenFor(), gust(), keep(), landFly(), makeState() (+11 more)

### Community 69 - "build"
Cohesion: 0.14
Nodes (17): bake(), band(), build(), glow(), hex(), layout(), litAt(), paintIncense() (+9 more)

### Community 70 - "render"
Cohesion: 0.17
Nodes (15): bakeOne(), disc(), drawChime(), drawKoi(), drawLit(), fill(), hex(), litOf() (+7 more)

### Community 71 - "Ras"
Cohesion: 0.23
Nodes (4): bay(), paintBamboo(), paintSky(), Ras

### Community 72 - "paintBack"
Cohesion: 0.17
Nodes (15): archTop(), garland(), paintAltar(), paintArch(), paintBack(), paintBellFrame(), paintBuddha(), paintFloor() (+7 more)

### Community 73 - "el"
Cohesion: 0.35
Nodes (15): el(), arrange(), check(), dueChip(), folderPin(), linkPin(), linkRow(), listCard() (+7 more)

### Community 74 - "buildGarden"
Cohesion: 0.21
Nodes (14): buildGarden(), fieldsFor(), fx(), glow(), layout(), lilyPads(), paintGravel(), paintKakei() (+6 more)

### Community 75 - "buildFormatBar"
Cohesion: 0.23
Nodes (12): canStepScale(), stepScale(), buildFormatBar(), hideFormatBar(), placeFormatBar(), runFormat(), runList(), runScale() (+4 more)

### Community 76 - "createEyeRest"
Cohesion: 0.35
Nodes (11): createEyeRest(), close(), finish(), show(), start(), status(), stop(), tick() (+3 more)

### Community 77 - "render"
Cohesion: 0.18
Nodes (11): ease(), famBow(), fr(), glowAt(), paintCat(), paintChild(), paintElder(), paintPose() (+3 more)

### Community 78 - "paintSky"
Cohesion: 0.27
Nodes (10): bodhiTree(), grove(), mixc(), paintBell(), paintSky(), paintStander(), palms(), rng() (+2 more)

### Community 79 - "markdown.js"
Cohesion: 0.38
Nodes (7): emphasis(), ESC, escapeHtml(), inline(), renderInline(), renderMarkdown(), safeUrl()

### Community 80 - "thoughts.js"
Cohesion: 0.25
Nodes (8): CLASSICAL, dayIndex(), normalizeThoughts(), ORDER, OURS, thoughtFor(), THOUGHTS, THOUGHTS_KEY

### Community 81 - "createArcade"
Cohesion: 0.46
Nodes (8): createArcade(), fillTodos(), launch(), saveCanvas(), setShelf(), showCard(), showMenu(), stop()

### Community 82 - "createCalendar"
Cohesion: 0.50
Nodes (7): createCalendar(), draw(), render(), setDefaults(), setOpen(), dayKey(), firstDayOfWeek()

### Community 83 - "preview"
Cohesion: 0.33
Nodes (7): finish(), makeBuffers(), makeState(), newRiv(), preview(), roomFor(), update()

### Community 84 - "drawBook"
Cohesion: 0.60
Nodes (6): bookLift(), drawBook(), openBook(), pageBot(), pageText(), pageTop()

### Community 85 - "buildRoom"
Cohesion: 0.33
Nodes (6): buildRoom(), coolAt(), paintCup(), paintFern(), sprite(), warmAt()

### Community 86 - "sq"
Cohesion: 0.67
Nodes (4): coolAt(), makeField(), sq(), warmAt()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-2606`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 514 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `drive.js`, `zen.js`, `lock.js`, `duplicates.js`, `mutate`, `arcade-kit.js`, `buildShell`, `arcade.js`, `ticker.js`, `backup.js`, `tags.js`, `el`, `reminderBody`, `tabs.js`, `itemCard`, `buildFormatBar`, `createEyeRest`, `createArcade`, `createCalendar`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **What connects `RFC-2606` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `myspace.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12560975609756098 - nodes in this community are weakly interconnected._
- **Why does `icon()` connect `buildShell` to `myspace.js`, `notes.js`, `spaces.js`, `settings.js`, `drive.js`, `zen.js`, `lock.js`, `duplicates.js`, `mutate`, `arcade-kit.js`, `arcade.js`, `ticker.js`, `zenpins.js`, `tags.js`, `el`, `reminderBody`, `tabs.js`, `itemCard`, `el`, `buildFormatBar`, `createEyeRest`, `createArcade`, `createCalendar`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `notes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0957983193277311 - nodes in this community are weakly interconnected._
- **Why does `note()` connect `note` to `notes.js`, `lounge-reading.js`, `game-lantern.js`, `lounge-garden.js`, `lounge-room.js`, `lounge-temple.js`, `game-llama.js`, `game-ripples.js`, `game-brush.js`, `lounge-train.js`, `lounge-cafe.js`, `arcade-kit.js`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `spaces.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11058823529411765 - nodes in this community are weakly interconnected._