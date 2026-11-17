// The Zen wallpaper behind the board too (Settings › Zen › "Show it outside Zen too").
// Held still: the board is for work. It lies under the frame (body::before in newtab.css, under
// :root[data-wall='on']) and the sidebar and the main panel turn to frosted glass over it.
// boot.js puts the last drawn scene up before first paint from WALL_HINT / WALL_CSS, so a new
// tab does not flash the plain frame first; a photo of your own is too large to keep there and
// arrives a moment later.
import { loadSettings, SETTINGS_KEY } from './settings.js';
import { getKey } from './store.js';
import { WALLPAPER_KEY, wallpaperFor } from './wallpapers.js';

const WALL_HINT = 'stacknest:wall';      // 'on' | 'off' — boot.js reads both keys
const WALL_CSS = 'stacknest:wallcss';    // the drawn scene's CSS background, when one is showing

export async function applyBoardWallpaper() {
  const s = await loadSettings();
  const root = document.documentElement;
  const custom = s.boardWallpaper && s.zenWallpaper === 'custom' ? await getKey(WALLPAPER_KEY, null) : null;
  const wp = s.boardWallpaper ? wallpaperFor(s.zenWallpaper, custom) : null;
  const on = !!wp && wp.css !== 'none';   // Plain is no picture at all
  root.dataset.wall = on ? 'on' : 'off';
  if (on) root.style.setProperty('--board-wall', wp.css);
  else root.style.removeProperty('--board-wall');
  try {
    localStorage.setItem(WALL_HINT, on ? 'on' : 'off');
    if (on && s.zenWallpaper !== 'custom') localStorage.setItem(WALL_CSS, wp.css);
    else localStorage.removeItem(WALL_CSS);
  } catch { /* storage blocked: boot.js simply waits for this */ }
}

export function initBoardWallpaper() {
  applyBoardWallpaper();
  // a change in Settings, Zen's shuffle, or another tab: follow it
  chrome.storage?.onChanged?.addListener((c, area) => {
    if (area === 'local' && (c[SETTINGS_KEY] || c[WALLPAPER_KEY])) applyBoardWallpaper();
  });
}
