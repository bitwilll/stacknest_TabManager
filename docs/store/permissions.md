# Privacy practices: StackNest

Paste-ready answers for the Developer Dashboard **Privacy practices** tab. Each section below
matches one field. Code references point at the line that uses the permission, so a reviewer's
question can be answered from the source.

## Single purpose

> StackNest replaces Chrome's new tab page with a workspace for organizing your open tabs,
> saved tab collections and bookmarks.

Notes, reminders, tags, backup and the optional ticker are tools inside that one new-tab
workspace; none of them works anywhere else in the browser. If a reviewer reads the ticker as
a second purpose, it is the feature to drop. It is opt-in and off by default.

## Permission justifications

The install dialog shows four warnings, verified in Chrome 155 with
`chrome.management.getPermissionWarningsByManifest`:
*Replace the page you see when opening a new tab · Read your browsing history · Display
notifications · Read and change your bookmarks.*

| Permission | Justification (paste into the field) | Used at |
|---|---|---|
| `tabs` | Reads the titles and URLs of open tabs so StackNest can list them on the new tab page, switch to or close a tab when the user clicks it, and save a window's tabs into a collection when the user asks. Tab data stays on the device. | `js/tabs.js:44` (query), `:111` (close), `:116` (switch) |
| `bookmarks` | The Library view shows and edits the user's Chrome bookmarks (new folder, rename, move, delete, open all). The Duplicates view scans bookmarks for links saved twice. "Move to My Space" moves a bookmark out of Chrome into StackNest's own storage. Every edit is one the user makes. | `js/bookmarks.js:29`, `:287`, `:352`; `js/duplicates.js:47`; `js/myspace.js:97` |
| `favicon` | Shows each saved link's site icon from Chrome's local favicon cache (`/_favicon/`), so no request is made to a third-party icon service. | `js/ui.js:310` |
| `storage` | Saves the user's collections, spaces, notes, tags, settings and Vault data in `chrome.storage.local` on their device. | `js/store.js:18`, `:26` |
| `identity` | Optional Google Drive backup. When the user clicks Connect, StackNest uses `chrome.identity` to sign in with Google and get a token for the `drive.appdata` and `userinfo.email` scopes. Nothing happens until the user starts it. | `js/auth.js:61`, `:71`; `js/drive.js:197` |
| `alarms` | Schedules the reminder times the user sets on notes and to-dos, so a reminder fires even when no StackNest tab is open. | `js/notes.js:81` |
| `notifications` | Shows the reminder the user scheduled, as a browser notification. Clicking it opens StackNest on the Notes view. | `js/sw.js:69`, `:81` |

**Host permissions:** none. The manifest asks for no host access. Google APIs, CoinGecko and
ExchangeRate-API all answer cross-origin requests from the extension. This was verified in
Chrome 155 with host permissions removed: each Drive call (list, media update, multipart create,
delete), userinfo and token revoke returned a readable response. The manifest's
`content_security_policy` limits `connect-src` to exactly those four origins.

**OAuth scopes** (in `manifest.json` `oauth2.scopes`; Google classes both as non-sensitive):

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/drive.appdata` | Reads and writes one backup file in StackNest's private app folder in the user's own Drive. It cannot see any other Drive file. |
| `https://www.googleapis.com/auth/userinfo.email` | Labels the connected account in Settings and confirms the owner when a locked Vault is recovered by signing in with Google. |

## Remote code

**Are you using remote code?** No.

> All JavaScript ships in the package and is loaded from the extension's own origin. The
> manifest CSP is `script-src 'self'`. There is no `eval`, no `new Function`, no remotely
> hosted script and no WebAssembly. The only network calls fetch JSON data: Google Drive
> backup files and, if the user enables the ticker, price quotes.

`scripts/package.sh` refuses to build a package that contains `eval`, `new Function`, a remote
`<script>` or an unresolved import.

## Data usage

Tick these data types. The dashboard asks what the item *handles*, even if the data never
leaves the device.

| Type | Tick | What StackNest handles |
|---|---|---|
| Personally identifiable information | **Yes** | The Google account email, stored locally only when the user connects Drive |
| Health information | No | |
| Financial and payment information | No | The ticker shows public market prices. It handles no user financial data. |
| Authentication information | **Yes** | The Vault PIN and security answer (stored only as salted PBKDF2 hashes) and the security question |
| Personal communications | No | |
| Location | No | |
| Web history | **Yes** | Titles and URLs of open tabs, saved collections and bookmarks |
| User activity | No | |
| Website content | No | StackNest never reads page content. |

Then tick all three certifications:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

The Drive backup is a transfer the user starts, into their own account, to provide a feature
they asked for. That is an approved use case.

**Privacy policy URL:** the published URL of `PRIVACY.md` (see the launch checklist).
