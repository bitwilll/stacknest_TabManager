// Which Google sign-in StackNest uses.
//
// ——— What is NOT happening here ———
// The `oauth2.client_id` in manifest.json identifies the *extension* to Google, the
// way a package name does. It is not an account and it holds no credentials: every
// install mints a token for whoever is signed in on THAT computer, into THAT person's
// own Drive appDataFolder. No user's data ever touches the developer's account, and
// the developer can't read anyone's backup. Publishing that ID is expected — Google
// documents it as public.
//
// ——— What this file changes ———
// chrome.identity.getAuthToken (the default path) always uses the Google account the
// Chrome PROFILE is signed into, and offers no account picker. If you're signed into
// Chrome as one account but want backups in another, there's no way to say so.
//
// Filling in WEB_CLIENT_ID below switches sign-in to chrome.identity.launchWebAuthFlow,
// which opens Google's normal account chooser — so any account can be picked, and
// "Switch account" in Settings → Cloud sync can move to a different one at any time.
//
// To fill it in (Google Cloud Console → APIs & Services → Credentials):
//   1. Create Credentials → OAuth client ID → Application type: **Web application**
//      (a "Chrome Extension" client will NOT work here — it has no redirect URIs).
//   2. Under "Authorised redirect URIs" add exactly:
//        https://<YOUR_EXTENSION_ID>.chromiumapp.org/
//      The extension ID is fixed by the `key` in manifest.json; chrome://extensions
//      shows it, and chrome.identity.getRedirectURL() prints the full URI.
//   3. Paste the client ID (…apps.googleusercontent.com) below.
//   4. Make sure the Drive API is enabled and the consent screen lists the
//      drive.appdata and userinfo.email scopes.
//
// Leave it empty to keep the current behaviour (Chrome profile account, no picker).
export const WEB_CLIENT_ID = '';

// ——— Which extension IDs Google will sign in ———
// The Chrome Extension OAuth client (manifest.json › oauth2.client_id) is registered to ONE
// extension ID, its "Item ID". A copy running under any other ID gets Google's "Access
// blocked: … request is invalid (Error 400: invalid_request)" page, which tells the person
// nothing useful. That happens when StackNest is installed from a build without the manifest
// "key" (the Web Store zip from scripts/package.sh has none), so Chrome picks a random ID.
//
// Sign-in checks chrome.runtime.id against this list first and, on a mismatch, explains how
// to reinstall instead of opening Google's page. The ID here is the one the manifest "key"
// produces; scripts/smoke-test.mjs fails if the two ever drift apart.
//
// After launch (docs/store/launch-checklist.md §C), when the store's public key replaces the
// dev key and the client's Item ID is set to the store ID, put the store ID here instead.
export const OAUTH_EXTENSION_IDS = ['jcmhhjnegjiejjjcppfkejnclbljnldm'];
