// Google sign-in, in one place — shared by the page (js/drive.js) and the background
// worker (js/sw.js), so incognito delegation can't drift out of sync with the page.
//
// Two paths, chosen by whether js/authConfig.js has a Web OAuth client ID:
//
//   • Default — chrome.identity.getAuthToken. Chrome mints a token for the account the
//     current Chrome PROFILE is signed into. Simple and refresh-free, but it offers no
//     account picker: one profile, one Google account.
//
//   • Account chooser — chrome.identity.launchWebAuthFlow against Google's normal
//     consent screen with prompt=select_account. Any account can be picked, regardless
//     of what Chrome itself is signed into, and Settings can switch between them.
//
// Either way the token belongs to whoever signs in on this machine, and the backup
// lands in that person's own Drive appDataFolder. See js/authConfig.js.

import { getKey, setKey } from './store.js';
import { WEB_CLIENT_ID } from './authConfig.js';

export const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.email'];

// Short-lived access token from the web flow. Deliberately its own key: it is never
// part of a backup (see backup.js — that reads an explicit list of keys).
const TOKEN_KEY = 'stacknest:cloud:tok'; // { token, exp }

export const canChooseAccount = () => !!WEB_CLIENT_ID;

/* ————— path A: launchWebAuthFlow (account picker) ————— */

function authUrl({ prompt, loginHint }) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', WEB_CLIENT_ID);
  u.searchParams.set('response_type', 'token');
  u.searchParams.set('redirect_uri', chrome.identity.getRedirectURL());
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('prompt', prompt);
  if (loginHint) u.searchParams.set('login_hint', loginHint);
  return u.toString();
}

// the implicit flow hands the token back in the redirect's fragment
function parseRedirect(redirectUrl) {
  const frag = new URLSearchParams(String(redirectUrl || '').split('#')[1] || '');
  const err = frag.get('error');
  if (err) throw new Error(err);
  const token = frag.get('access_token');
  if (!token) throw new Error('no access_token in redirect');
  const ttl = Number(frag.get('expires_in')) || 3600;
  return { token, exp: Date.now() + Math.max(60, ttl - 120) * 1000 }; // renew a couple of minutes early
}

async function webToken({ interactive, chooseAccount, loginHint }) {
  if (!chooseAccount) {
    const cached = await getKey(TOKEN_KEY, null);
    if (cached?.token && cached.exp > Date.now()) return cached.token;
  }
  // "select_account consent" forces the picker even when a session is already active;
  // "none" is the silent renew that must not pop any UI.
  const prompt = chooseAccount ? 'select_account consent' : (interactive ? 'select_account' : 'none');
  const url = authUrl({ prompt, loginHint: chooseAccount ? null : loginHint });
  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: !!(interactive || chooseAccount) });
  const t = parseRedirect(redirect);
  await setKey(TOKEN_KEY, t);
  return t.token;
}

/* ————— path B: getAuthToken (Chrome profile account) ————— */

function profileToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: SCOPES }, (token) => {
      const err = chrome.runtime.lastError;
      if (err || !token) reject(new Error(err?.message || 'No token returned.'));
      else resolve(token);
    });
  });
}

/* ————— public ————— */

export async function mintToken({ interactive = false, chooseAccount = false, loginHint = null } = {}) {
  if (canChooseAccount()) {
    try {
      return await webToken({ interactive, chooseAccount, loginHint });
    } catch (e) {
      await setKey(TOKEN_KEY, null); // a failed mint must not leave a half-dead cache
      throw e;
    }
  }
  return profileToken(interactive);
}

export async function forgetToken(token) {
  if (canChooseAccount()) { await setKey(TOKEN_KEY, null); return; }
  await new Promise((resolve) => { try { chrome.identity.removeCachedAuthToken({ token }, resolve); } catch { resolve(); } });
}

// Full local sign-out: drop everything we hold for this extension so the next connect
// starts clean. Does not revoke the grant — disconnect() does that separately.
export async function forgetAllTokens() {
  await setKey(TOKEN_KEY, null);
  await new Promise((resolve) => { try { chrome.identity.clearAllCachedAuthTokens(resolve); } catch { resolve(); } });
}
