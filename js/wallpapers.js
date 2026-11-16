// Zen wallpapers — drawn here as SVG, so they ship inside the extension, cost no network and
// stay sharp at any size. Each is a CSS background value; `tone` says whether the picture is
// light or dark, so Zen can set its clock and captions in the ink that reads on it.
//
// 'theme' is no picture at all (the current theme's own ground), and 'custom' is an image the
// person chose in Settings, kept on this device under WALLPAPER_KEY (never in a backup file:
// a photo would swell every export and every Drive sync).

export const WALLPAPER_KEY = 'stacknest:wallpaper';   // { dataUrl, tone } — the custom image
export const DEFAULT_WALLPAPER = 'mist';

const svg = (body, w = 1600, h = 1000) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>${body}</svg>`)}")`;

// a deterministic scatter (same stars every load, no Math.random)
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// one smooth ridge line across the width, closed down to the bottom edge
function ridge(base, amp, seed, steps = 9, w = 1600, h = 1000) {
  const r = rng(seed);
  const pts = Array.from({ length: steps + 1 }, (_, i) => [(i / steps) * w, base - r() * amp]);
  let d = `M0 ${h} L0 ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `${d} L${w} ${h} Z`;
}

const mist = svg(`
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#eef1ee'/><stop offset='.6' stop-color='#dfe6e3'/><stop offset='1' stop-color='#c9d4d1'/></linearGradient>
  <linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#eef1ee' stop-opacity='0'/><stop offset='1' stop-color='#eef1ee' stop-opacity='.85'/></linearGradient></defs>
  <rect width='1600' height='1000' fill='url(#s)'/>
  <circle cx='1120' cy='300' r='92' fill='#f7f4ec' opacity='.9'/>
  <path d='${ridge(560, 190, 7)}' fill='#a9bab8' opacity='.45'/>
  <rect y='480' width='1600' height='200' fill='url(#f)'/>
  <path d='${ridge(680, 160, 19)}' fill='#8ea4a2' opacity='.55'/>
  <rect y='620' width='1600' height='180' fill='url(#f)'/>
  <path d='${ridge(800, 120, 31)}' fill='#6f8987' opacity='.7'/>
  <rect y='760' width='1600' height='140' fill='url(#f)'/>
  <path d='${ridge(910, 70, 43)}' fill='#566f6d' opacity='.85'/>`);

const dusk = svg(`
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2a2440'/><stop offset='.45' stop-color='#7b4a62'/><stop offset='.75' stop-color='#d4826a'/><stop offset='1' stop-color='#f1c08a'/></linearGradient>
  <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffe2b0' stop-opacity='.9'/><stop offset='1' stop-color='#ffe2b0' stop-opacity='0'/></radialGradient></defs>
  <rect width='1600' height='1000' fill='url(#s)'/>
  <circle cx='520' cy='640' r='260' fill='url(#g)'/>
  <circle cx='520' cy='640' r='74' fill='#ffdcae'/>
  <path d='${ridge(650, 170, 11)}' fill='#5a3550' opacity='.75'/>
  <path d='${ridge(760, 140, 23)}' fill='#3f2742' opacity='.85'/>
  <path d='${ridge(880, 90, 37)}' fill='#261a2e'/>`);

const night = (() => {
  const r = rng(97);
  let stars = '';
  for (let i = 0; i < 140; i++) {
    const x = (r() * 1600).toFixed(0), y = (r() * 620).toFixed(0), rad = (0.6 + r() * 1.6).toFixed(2), o = (0.25 + r() * 0.7).toFixed(2);
    stars += `<circle cx='${x}' cy='${y}' r='${rad}' fill='#fff' opacity='${o}'/>`;
  }
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#070b1a'/><stop offset='.7' stop-color='#14203d'/><stop offset='1' stop-color='#1f3050'/></linearGradient>
    <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#dfe7ff' stop-opacity='.35'/><stop offset='1' stop-color='#dfe7ff' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stars}
    <circle cx='1180' cy='250' r='220' fill='url(#g)'/>
    <circle cx='1180' cy='250' r='58' fill='#eef2ff'/>
    <circle cx='1203' cy='236' r='52' fill='#0d1428' opacity='.12'/>
    <path d='${ridge(800, 150, 53)}' fill='#0f1830'/>
    <path d='${ridge(900, 80, 61)}' fill='#080d1c'/>`);
})();

// karesansui: raked gravel, three stones with their ripples
const sand = (() => {
  let lines = '';
  for (let y = 18; y < 1000; y += 22) lines += `<path d='M0 ${y} Q400 ${y - 6} 800 ${y} T1600 ${y}' stroke='#cbbd9f' stroke-width='2.2' fill='none' opacity='.8'/>`;
  const stone = (cx, cy, rx, ry, rings) => {
    let g = `<ellipse cx='${cx}' cy='${cy}' rx='${rx + rings * 22 + 10}' ry='${ry + rings * 22 + 10}' fill='#e7dcc6'/>`;
    for (let i = rings; i >= 1; i--) g += `<ellipse cx='${cx}' cy='${cy}' rx='${rx + i * 22}' ry='${ry + i * 22}' stroke='#cbbd9f' stroke-width='2.2' fill='none' opacity='.85'/>`;
    g += `<ellipse cx='${cx}' cy='${cy + ry * 0.35}' rx='${rx * 1.02}' ry='${ry * 0.55}' fill='#000' opacity='.12'/>`;
    g += `<ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' fill='#6e6a63'/><ellipse cx='${cx - rx * 0.25}' cy='${cy - ry * 0.3}' rx='${rx * 0.55}' ry='${ry * 0.4}' fill='#8a857c' opacity='.7'/>`;
    return g;
  };
  return svg(`<rect width='1600' height='1000' fill='#e7dcc6'/>${lines}${stone(430, 620, 70, 46, 6)}${stone(1180, 380, 52, 36, 5)}${stone(1290, 455, 26, 18, 2)}`);
})();

const bamboo = (() => {
  const r = rng(29);
  let stalks = '';
  for (let i = 0; i < 22; i++) {
    const x = r() * 1600, w = 14 + r() * 26, o = (0.18 + r() * 0.5).toFixed(2);
    let nodes = '';
    for (let y = r() * 120; y < 1000; y += 120 + r() * 60) nodes += `<rect x='${(x - 2).toFixed(0)}' y='${y.toFixed(0)}' width='${(w + 4).toFixed(0)}' height='4' rx='2' fill='#0f2a1d' opacity='.55'/>`;
    stalks += `<g opacity='${o}'><rect x='${x.toFixed(0)}' y='0' width='${w.toFixed(0)}' height='1000' fill='#1f4a33'/>${nodes}</g>`;
  }
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#d9e6c8'/><stop offset='.5' stop-color='#9fbf8a'/><stop offset='1' stop-color='#4d7a55'/></linearGradient>
    <radialGradient id='l' cx='.3' cy='.15' r='.7'><stop offset='0' stop-color='#fbfbe8' stop-opacity='.75'/><stop offset='1' stop-color='#fbfbe8' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stalks}<rect width='1600' height='1000' fill='url(#l)'/>`);
})();

// ensō: one ink circle on rice paper, left open
const enso = svg(`
  <defs><filter id='t'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .33  0 0 0 .08 0'/></filter>
  <filter id='b'><feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='3' seed='9'/><feDisplacementMap in='SourceGraphic' scale='14'/></filter></defs>
  <rect width='1600' height='1000' fill='#f3eee3'/><rect width='1600' height='1000' filter='url(#t)'/>
  <g filter='url(#b)'><circle cx='1060' cy='470' r='230' fill='none' stroke='#26221d' stroke-width='38' stroke-linecap='round' stroke-dasharray='1270 175' transform='rotate(-62 1060 470)' opacity='.9'/>
  <circle cx='1060' cy='470' r='222' fill='none' stroke='#26221d' stroke-width='12' stroke-linecap='round' stroke-dasharray='900 545' transform='rotate(-40 1060 470)' opacity='.35'/></g>
  <rect x='1290' y='690' width='26' height='26' rx='3' fill='#b8432f' opacity='.85'/>`);

export const WALLPAPERS = [
  { id: 'mist', label: 'Mist', tone: 'light', css: mist },
  { id: 'sand', label: 'Garden', tone: 'light', css: sand },
  { id: 'enso', label: 'Ensō', tone: 'light', css: enso },
  { id: 'bamboo', label: 'Bamboo', tone: 'light', css: bamboo },
  { id: 'dusk', label: 'Dusk', tone: 'dark', css: dusk },
  { id: 'night', label: 'Night', tone: 'dark', css: night },
];

// every id a setting may hold: the drawn ones, the theme's plain ground, the person's own image
export const WALLPAPER_IDS = [...WALLPAPERS.map((w) => w.id), 'theme', 'custom'];

/* ————— the custom image —————
   Downscaled and re-encoded on the way in: a 12-megapixel photo would otherwise eat most of
   chrome.storage.local's quota. Its average luminance decides the ink Zen sets on it. */
export async function prepareWallpaper(file, maxSide = 2400) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choose an image file');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  // luminance from a 24×24 thumbnail: cheap, and enough to call it light or dark
  const t = document.createElement('canvas');
  t.width = 24; t.height = 24;
  const tc = t.getContext('2d');
  tc.drawImage(canvas, 0, 0, 24, 24);
  const px = tc.getImageData(0, 0, 24, 24).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  const lum = sum / (px.length / 4) / 255;
  let q = 0.84, dataUrl = canvas.toDataURL('image/jpeg', q);
  while (dataUrl.length > 3_000_000 && q > 0.45) { q -= 0.12; dataUrl = canvas.toDataURL('image/jpeg', q); }
  return { dataUrl, tone: lum > 0.58 ? 'light' : 'dark' };
}

// the CSS background + tone for a setting id (custom needs the stored image, passed in)
export function wallpaperFor(id, custom = null) {
  if (id === 'custom' && custom?.dataUrl) return { css: `url("${custom.dataUrl}") center / cover no-repeat`, tone: custom.tone === 'light' ? 'light' : 'dark' };
  if (id === 'theme') return { css: 'none', tone: 'theme' };
  const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS.find((x) => x.id === DEFAULT_WALLPAPER);
  return { css: `${w.css} center / cover no-repeat`, tone: w.tone };
}
