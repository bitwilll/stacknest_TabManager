# StackNest privacy policy

**Effective:** 9 October 2026 · applies to StackNest — Tab Manager 1.0.0 and later

StackNest is a Chrome extension that replaces the new tab page with a workspace for your open
tabs, saved tab collections, bookmarks and notes. This policy describes every piece of
information StackNest handles, where that information is kept, and when any of it leaves your
device.

**The short version:** your data stays in your browser. The developer runs no server and
receives none of it. StackNest has no analytics, no ads and no trackers, and it never sells
or shares your data. Only two optional features ever use the network, and you have to turn
each of them on yourself.

---

## 1. What StackNest handles, and where it lives

Everything below is stored **on your device**, in Chrome's extension storage
(`chrome.storage.local`). A few display preferences use the page's `localStorage`. Chrome Sync
does not copy any of it to your other devices.

| Information | Why StackNest uses it |
|---|---|
| **Open tabs and windows**: titles, addresses (URLs), which tab is active | To list your live tabs and let you switch to them, close them, or save them into a collection. Tabs are read when the page renders. They are stored only when you save or stash them. |
| **Chrome bookmarks**: titles, URLs, folders | To show the Library and the Duplicates scan, and to make the edits you ask for (new folder, rename, move, delete). |
| **Your content**: spaces, collections, saved links, tags, notes, to-do lists, reminders, My Space and Vault items, links you told Duplicates to forget | This is the content you create in StackNest. |
| **Settings**: theme, fonts, interface size, tab bar position, ticker choices, last Library folder | To remember how you like the app. |
| **Vault PIN** | The PIN itself is never stored. StackNest keeps a PBKDF2-SHA256 hash over a random salt and a count of failed attempts. |
| **Vault security question** | The question text is stored. The answer is stored only as a salted hash. |
| **Google account email** (only if you connect Google Drive) | To label the connected account in Settings, and to confirm it is you if you recover a locked Vault by signing in with Google. |
| **Site icons** | Read from Chrome's own local favicon cache. This makes no network request. |

StackNest does not read the content of the web pages you visit. It does not use your
browsing history, your location, or your keystrokes outside its own page.

## 2. When information leaves your device

Information leaves your device only in these four cases, and you start each one yourself.

### Google Drive backup (optional, off until you connect)

If you choose **Connect** in Settings › Backup & sync, Chrome asks you to sign in to Google
and approve two permissions:

- `drive.appdata` lets StackNest create and read **one file in a private app folder in your
  own Google Drive**. StackNest cannot see, open or change any of your other Drive files.
  The folder does not appear in your Drive file list.
- `userinfo.email` lets StackNest read your account's email address, for the label described
  above.

**Back up now** writes your StackNest data (section 1, and your bookmarks if you tick that
box) to that file. **Restore** reads it back. The data goes directly from your browser to
Google; it never passes through a server run by the developer. Google's handling of it is
governed by the [Google Privacy Policy](https://policies.google.com/privacy).
**Sign out** makes StackNest forget the account and its sign-in on this device. If you also
tick **Also remove StackNest's access to my Google account**, StackNest asks Google to revoke
the permission. You can also remove it at any time from your Google Account's third-party
access page.

### File export (optional)

**Export** saves the same backup as a JSON file to your computer, in a location you choose.
StackNest does not send that file anywhere.

### Market ticker (optional, off by default)

If you turn on the ticker in Settings › Market ticker, the new tab page fetches prices from:

- **CoinGecko** (`api.coingecko.com`): the coins you picked and your reference currency.
- **ExchangeRate-API** (`open.er-api.com`): your reference currency.

These requests contain no personal information and no data from your tabs, bookmarks or
notes. Like any web request, they reveal your IP address and browser type to those providers,
whose own privacy policies apply. Turning the ticker off stops the requests.

### Reminders

Reminder notifications are scheduled with Chrome's `alarms` API and shown with Chrome's
`notifications` API, both on your device. Nothing is sent to a server.

## 3. What StackNest never does

- It does not collect analytics, telemetry or crash reports.
- It does not show ads, and it contains no tracking pixels or third-party scripts.
- It does not sell, rent or share your data with anyone, and the developer never receives it.
- It does not use your data for advertising, for credit or lending decisions, or for any
  purpose other than the features described here.
- It does not load code from the internet. Everything it runs ships inside the extension.

## 4. Google API Services and Chrome Web Store user data

StackNest's use and transfer to any other app of information received from Google APIs will
adhere to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements. StackNest also complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including its Limited Use requirements.

## 5. Incognito

StackNest runs in incognito windows only if you turn on **Allow in incognito** in
`chrome://extensions`. Incognito windows then share the same StackNest storage as your normal
profile. Anything you save or stash while in incognito stays saved after the window closes.

## 6. Keeping or deleting your data

- **On your device:** your data stays until you delete it in StackNest or remove the
  extension. Removing StackNest from Chrome deletes its extension storage.
- **In Google Drive:** signing out leaves the backup file in place, so you can restore it
  later. To delete it, open Google Drive › Settings › Manage apps, find StackNest, and choose
  **Delete hidden app data**.
- **Exported files** are ordinary files on your computer. Delete them as you would any file.

The developer holds no copy of your data, so there is nothing for the developer to delete or
hand over.

## 7. Children

StackNest is a general productivity tool. It is not directed at children under 13 and does
not knowingly collect information from them.

## 8. Changes to this policy

If what StackNest handles changes, this file changes with it and the effective date above
is updated.

## 9. Contact

Questions or requests: open an issue at
<https://github.com/bitwilll/stacknest_TabManager/issues>.
