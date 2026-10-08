# Launch checklist: StackNest 1.0.0 on the Chrome Web Store

Three parts: what is done in the repo, the code changes made for the store (all done), and the
steps only the owner can take (accounts, Google Cloud, the dashboard). Work top to bottom.

## Never upload these

`../StackNest.zip` and `../StackNest 2 J.zip` (one folder up) must never be uploaded. Both
contain `full backup.json` (2.2 MB of real tabs and bookmarks), the dev `key` and the
`new design/` sketches, whose `support.js` uses `new Function` and unpkg URLs that the review
scanner reads as remote code. One of them also nests everything under a subfolder and includes
`.git/`. Upload **only** the zip that `scripts/package.sh` prints.

---

## 1. Done in this repo

| Area | State | Evidence |
|---|---|---|
| Manifest description | 124 of 132 characters (was 151, which the store rejects) | `scripts/package.sh` enforces the limit |
| `short_name`, `homepage_url` | Added: `StackNest`, the GitHub repo | |
| `minimum_chrome_version` | `128` | Floor is set by code, not taste. `js/tags.js:104-121` and `js/notes.js:1035-1043` place popovers by dividing `getBoundingClientRect()` by the root CSS `zoom`, which is Chrome 128's standardized-zoom behaviour. At the default Comfortable size (zoom 1.08), older Chrome would land popovers about 7% off their anchors. The CSS floor alone would be 111 (`color-mix`). |
| `host_permissions` | **Removed.** That drops the "Read and change your data on a number of websites" install warning. | All four origins answer CORS for the extension. Verified in Chrome 155 with none declared: Drive list, media PATCH, multipart create, DELETE, userinfo and revoke all returned readable responses, and the ticker loaded live prices. |
| Content Security Policy | Added `extension_pages` CSP: `script-src 'self'`, `object-src 'none'`, `connect-src` limited to the four API origins, `img-src 'self' data:` | 0 violations across all views, themes, rail, ticker, favicons and `chrome://newtab`. A deliberate fetch to an unlisted origin was blocked as intended. |
| Dev `key` | Kept in `manifest.json` for unpacked dev (it pins ID `jcmhhjnegjiejjjcppfkejnclbljnldm`, which the OAuth client is registered to). Stripped from the upload by `package.sh`. | |
| Permissions | All seven API permissions are in use (see `permissions.md`). No change. | |
| Icons | New brand mark: Liquid Lava tile with the Dark Void bookmark glyph, matching the sidebar logo. Master in `icons/icon.svg`. PNGs at 16/32/48/128, pixel-snapped at small sizes, 128 at the store spec (96px tile with 16px transparent padding). | `node scripts/render-icons.mjs` renders and checks size, transparency, tile colour and glyph |
| Packaging | `sh scripts/package.sh` builds `dist/stacknest-1.0.0.zip` from an allowlist: 32 files, about 586 KB unpacked, no `key`, no `js/mock.js`, `manifest.json` at the root. `dist/` is git-ignored. | The script validates the manifest with node, checks store limits, checks that every import, script and stylesheet URL resolves inside the package, and rejects `eval`/`new Function`/remote code |
| `js/mock.js` excluded | Safe. `js/app.js:6-8` imports it only when `chrome.tabs.query` is missing, which never happens inside the extension. | Packaged build: mock.js never requested, 0 errors |
| Privacy policy | `PRIVACY.md`, written from the code | |
| Listing copy, permission justifications, data-use answers | `docs/store/listing.md`, `docs/store/permissions.md` | |
| Screenshots and promo tile | `docs/store/screenshots/01…06` (1280×800) and `docs/store/promo/small-promo-440x280.png` | `node scripts/store-assets.mjs` regenerates them |

### Smoke test of the real extension (headless Chrome 155)

Loaded with `Extensions.loadUnpacked`, both as the packaged build (`dist/stacknest-1.0.0`, no
key, store-like random ID) and as the dev folder (with key, ID `jcmh…`):

- `chrome://extensions`: **0 install warnings, 0 manifest errors, 0 runtime errors.**
- Install prompt warnings: *Replace the page you see when opening a new tab · Read your browsing
  history · Display notifications · Read and change your bookmarks* (four; there were five with
  host permissions).
- All 8 views, all 3 themes, all 3 tab-bar positions, rail on and off, and `chrome://newtab`
  rendering the override: **0 console errors, 0 exceptions, 0 CSP violations** from the app. The
  only errors logged came from the test's own bogus-token Drive probes (expected 401/400s) and
  from its deliberate blocked fetch.
- `/_favicon/` loads under `img-src 'self'`. `icons/icon128.png` loads for notifications.
- Reminder path: alarm → service worker → `chrome.notifications` produced the notification.
- Service worker: 0 errors.

---

## 2. Code changes for the store — done (2026-10-09)

All seven landed in the design-chief pass:

1. **The "StackNest Cloud PRO, coming soon" teaser is gone** (`js/settings.js`), with its CSS.
2. **No developer instructions in the UI.** The Drive notes and errors in `js/settings.js` and
   `js/drive.js` now speak to users; **Switch account** only renders where Chrome offers an
   account picker (`canChooseAccount()`).
3. **The market ticker follows its providers' terms** (`js/ticker.js`): on-screen "Powered by
   CoinGecko" and "Rates By Exchange Rate API" credits (≥ 10px); FX cached for an hour in
   `chrome.storage.local` (stale rates beat none); no polling while the tab is hidden, one
   refresh on return; 8 s timeouts on both fetches; a failed refresh keeps the last good prices;
   a generation counter stops overlapping `configure()` calls from leaking an interval.
4. **Font licences ship**: `fonts/OFL.txt` (SIL OFL 1.1 with both fonts' copyright lines).
5. **README**: permissions table (no host permissions; `alarms`, `notifications` added; the CSP
   `connect-src`), Chrome 128+, a Release section, and production OAuth steps.
6. **Reminders re-arm in the worker** on `runtime.onInstalled` and `runtime.onStartup`
   (`js/sw.js`), so a silent store update can't drop them.
7. **Toolbar button**: `"action"` in the manifest opens a new tab (StackNest) via
   `chrome.action.onClicked` in `js/sw.js`.

`sh scripts/package.sh` and `node scripts/store-assets.mjs` were re-run after these changes, so
the zip and screenshots match the submitted build.

---

## 3. Owner actions

### A. Accounts and policy page

- [ ] **Register as a Chrome Web Store developer** at
      <https://chrome.google.com/webstore/devconsole>. Use the Google account that should own
      the listing. You'll accept the developer agreement and pay the one-time registration fee
      (shown in the dashboard). Turn on 2-Step Verification for the account; publishing
      requires it.
- [ ] **Account page:** set a contact email and verify it. Complete the trader / non-trader
      declaration the dashboard asks for (it applies to EU listings).
- [ ] **Publish the privacy policy at a public URL.** The simplest option is to merge to `main`
      and use `https://github.com/bitwilll/stacknest_TabManager/blob/main/PRIVACY.md`. For the
      OAuth consent screen (step C), Google prefers a policy on a domain you can verify. GitHub
      Pages (for example `https://bitwilll.github.io/stacknest_TabManager/privacy`) can be
      verified in Search Console.
- [ ] **Fix the repo's homepage link.** GitHub lists `stacknest-tab-manager.vercel.app`, which
      returns 404. Point it at the repo or the Pages site.
- [ ] **Choose a licence (optional).** The README doesn't name one, so the code is currently
      "all rights reserved" though public. That is why the listing says "Source code", not
      "open source". If you want it open, add `LICENSE` (MIT, Apache-2.0, …).

### B. Build and upload a draft

- [ ] Finish section 2, then run `sh scripts/package.sh`.
- [ ] Dashboard › **Add new item** › upload `dist/stacknest-1.0.0.zip`. Copy the **Item ID**,
      and the **public key** (Package › View public key).

### C. Google sign-in for store users

The OAuth client `599136003782-49rr…` (type *Chrome Extension*) is registered to the dev ID
`jcmh…`. Store installs get the store's Item ID, so until this step Drive sign-in would fail for
every user. Keep one ID for both dev and store:

- [ ] Replace the `"key"` in `manifest.json` with the store's public key. Unpacked dev builds
      then load with the store's ID. (`package.sh` still strips it from uploads, so the package
      doesn't change.)
- [ ] Google Cloud Console › APIs & Services › Credentials › the Chrome Extension client: set
      **Item ID** to the store's Item ID. The client ID string doesn't change, so
      `oauth2.client_id` stays as it is and nothing needs re-uploading.
- [ ] Google Auth Platform › **Branding:** app name *StackNest*, a support email, the app home
      page and the privacy policy URL from step A, and that site's domain under authorized
      domains.
- [ ] **Data access:** confirm the only scopes are `…/auth/drive.appdata` and
      `…/auth/userinfo.email`. Google classes both as non-sensitive, so no scope verification
      review should be needed. If you add a logo, Google may ask for brand verification.
- [ ] **Audience › Publish app** (move from *Testing* to *In production*). In Testing, only
      listed test users (at most 100) can sign in, and their grants expire after 7 days.
- [ ] Make sure the Google Drive API is enabled in the same project.

### D. Listing and submission

- [ ] **Store listing:** paste from `docs/store/listing.md`. Upload `icons/icon128.png`, the
      small promo tile and screenshots 01 to 05.
- [ ] **Privacy practices:** paste from `docs/store/permissions.md`, and add the privacy policy
      URL.
- [ ] **Distribution:** Free, all regions. Set visibility to **Unlisted** for the first
      release.
- [ ] Submit for review.
- [ ] Once approved, install from the store link and test **Settings › Backup & sync ›
      Connect**, **Back up now** and **Restore** on the store build. Then switch visibility to
      **Public**.

### E. After launch

- [ ] Tag the release: `git tag v1.0.0`.
- [ ] Add the store link to the README.
- [ ] For each update: bump `version` in `manifest.json` (the store rejects a version it has
      seen), run `sh scripts/package.sh`, and upload the new zip.
