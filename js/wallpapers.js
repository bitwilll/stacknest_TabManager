// Zen wallpapers — drawn here as SVG, so they ship inside the extension, cost no network and
// stay sharp at any size. Each is a CSS background value; `tone` says whether the picture is
// light or dark, so Zen can set its clock and captions in the ink that reads on it, and
// `motion` names the slow animation Zen lays over it (drifting mist, petals, stars, leaf shade,
// dust in a shaft of light, blown sand, soft light for a photo or the plain theme — see the
// .zen-fx rules in newtab.css; Settings → Zen → Animate the wallpaper turns it off).
//
// 'theme' is no picture at all (the current theme's own ground), and 'custom' is an image the
// person chose in Settings, kept on this device under WALLPAPER_KEY (never in a backup file:
// a photo would swell every export and every Drive sync).

export const WALLPAPER_KEY = 'stacknest:wallpaper';   // { images: [{ id, dataUrl, tone }], active } — your own images
export const MAX_OWN = 6;   // a handful of your own pictures (each kept under ~1.6 MB, so they fit the storage quota)

// your own images, whatever shape they were stored in: the list, and which one 'custom' shows.
// (Before the gallery there was one image, stored as { dataUrl, tone }: it becomes the first.)
const isImage = (x) => x && typeof x.dataUrl === 'string' && x.dataUrl.startsWith('data:image/');
export function ownWallpapers(raw) {
  if (isImage(raw)) return { images: [{ id: 'own1', dataUrl: raw.dataUrl, tone: raw.tone }], active: 'own1' };
  const images = Array.isArray(raw?.images) ? raw.images.filter(isImage).slice(0, MAX_OWN).map((x, i) => ({ id: String(x.id || `own${i + 1}`), dataUrl: x.dataUrl, tone: x.tone })) : [];
  const active = images.some((x) => x.id === raw?.active) ? raw.active : images[0]?.id || null;
  return { images, active };
}
export const activeOwn = (raw) => { const o = ownWallpapers(raw); return o.images.find((x) => x.id === o.active) || null; };
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

// a still lake at dawn: hills and their reflection, a band of mist on the water
const lake = svg(`
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#dfe6f1'/><stop offset='.55' stop-color='#f3e3dc'/><stop offset='.58' stop-color='#eadbd6'/><stop offset='1' stop-color='#c9d3e2'/></linearGradient>
  <linearGradient id='m' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f6efea' stop-opacity='0'/><stop offset='.5' stop-color='#f6efea' stop-opacity='.8'/><stop offset='1' stop-color='#f6efea' stop-opacity='0'/></linearGradient></defs>
  <rect width='1600' height='1000' fill='url(#s)'/>
  <circle cx='980' cy='410' r='70' fill='#fbe9d8'/>
  <path d='${ridge(540, 150, 71)}' fill='#a7aec4' opacity='.7' transform='translate(0 0)'/>
  <path d='${ridge(560, 90, 83)}' fill='#8890aa' opacity='.75'/>
  <rect y='560' width='1600' height='440' fill='#d3dae7'/>
  <g transform='translate(0 1120) scale(1 -1)' opacity='.35'><path d='${ridge(540, 150, 71)}' fill='#a7aec4'/><path d='${ridge(560, 90, 83)}' fill='#8890aa'/></g>
  <ellipse cx='980' cy='710' rx='40' ry='120' fill='#fbe9d8' opacity='.35'/>
  <rect y='520' width='1600' height='90' fill='url(#m)'/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x='${(120 + i * 160) % 1500}' y='${640 + i * 34}' width='${140 + (i % 3) * 60}' height='2' rx='1' fill='#fff' opacity='.45'/>`).join('')}`);

// warm dunes under a low sun
const dunes = svg(`
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f6dfc4'/><stop offset='.6' stop-color='#f2c9a2'/><stop offset='1' stop-color='#e2a77e'/></linearGradient>
  <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#fff1d6' stop-opacity='.9'/><stop offset='1' stop-color='#fff1d6' stop-opacity='0'/></radialGradient>
  <linearGradient id='d1' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#e6a77a'/><stop offset='1' stop-color='#d18b62'/></linearGradient>
  <linearGradient id='d2' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#c97a52'/><stop offset='1' stop-color='#b5673f'/></linearGradient></defs>
  <rect width='1600' height='1000' fill='url(#s)'/>
  <circle cx='1150' cy='420' r='240' fill='url(#g)'/><circle cx='1150' cy='420' r='70' fill='#fff3dc'/>
  <path d='M0 640 C300 560 520 600 760 650 S1250 560 1600 610 L1600 1000 L0 1000Z' fill='url(#d1)' opacity='.85'/>
  <path d='M0 760 C260 690 600 820 900 760 S1400 690 1600 740 L1600 1000 L0 1000Z' fill='url(#d2)'/>
  <path d='M0 880 C400 820 700 900 1000 860 S1450 830 1600 870 L1600 1000 L0 1000Z' fill='#a65b36'/>
  <path d='M760 650 C820 700 860 740 900 760' stroke='#f3c49c' stroke-width='3' fill='none' opacity='.6'/>`);

// a branch of blossom against a pale sky
const sakura = (() => {
  const r = rng(131);
  let blooms = '';
  const branch = [[1600, 120], [1380, 170], [1180, 150], [1000, 230], [860, 220], [700, 300]];
  for (let i = 0; i < 70; i++) {
    const seg = branch[Math.floor(r() * (branch.length - 1))];
    const x = seg[0] - r() * 220, y = seg[1] - 60 + r() * 160, rad = 7 + r() * 9, o = (0.55 + r() * 0.45).toFixed(2);
    blooms += `<g opacity='${o}'>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx='${(x + Math.cos(a * Math.PI / 180) * rad * 0.7).toFixed(1)}' cy='${(y + Math.sin(a * Math.PI / 180) * rad * 0.7).toFixed(1)}' rx='${(rad * 0.55).toFixed(1)}' ry='${(rad * 0.4).toFixed(1)}' fill='${r() < 0.5 ? '#f6c6d3' : '#f9d9e2'}' transform='rotate(${a} ${(x).toFixed(1)} ${(y).toFixed(1)})'/>`).join('')}<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${(rad * 0.2).toFixed(1)}' fill='#e88aa5'/></g>`;
  }
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f7eef0'/><stop offset='1' stop-color='#ecdfe6'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <circle cx='420' cy='360' r='120' fill='#fbe3e6' opacity='.8'/>
    <path d='${ridge(820, 120, 141)}' fill='#d9c6d3' opacity='.6'/>
    <path d='${ridge(900, 80, 151)}' fill='#c9b2c2' opacity='.6'/>
    <path d='M1600 110 C1500 140 1440 160 1380 170 S1240 140 1180 150 S1060 200 1000 230 S900 214 860 220 S760 260 700 300' stroke='#5a4148' stroke-width='16' fill='none' stroke-linecap='round'/>
    <path d='M1180 150 C1150 100 1120 80 1080 70 M1000 230 C980 280 940 310 900 330 M1380 170 C1370 230 1350 260 1320 290' stroke='#5a4148' stroke-width='7' fill='none' stroke-linecap='round'/>
    ${blooms}`);
})();

// a deep forest in fog at night
const forest = (() => {
  const r = rng(173);
  const row = (base, h, color, n, o) => {
    let g = '';
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 1700 - 50 + r() * 40, hh = h * (0.7 + r() * 0.5);
      g += `<path d='M${x.toFixed(0)} ${(base - hh).toFixed(0)} L${(x - hh * 0.28).toFixed(0)} ${base} L${(x + hh * 0.28).toFixed(0)} ${base}Z' fill='${color}' opacity='${o}'/>`;
    }
    return g;
  };
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0d1a1f'/><stop offset='.6' stop-color='#1d3a3a'/><stop offset='1' stop-color='#2c4a44'/></linearGradient>
    <linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#a9c9c0' stop-opacity='0'/><stop offset='1' stop-color='#a9c9c0' stop-opacity='.28'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <circle cx='1240' cy='200' r='44' fill='#e9f1e6' opacity='.85'/>
    ${row(640, 260, '#2b4c48', 26, 0.7)}<rect y='480' width='1600' height='200' fill='url(#f)'/>
    ${row(780, 330, '#1c3533', 20, 0.85)}<rect y='640' width='1600' height='180' fill='url(#f)'/>
    ${row(960, 420, '#0f2220', 14, 1)}`);
})();

// northern lights over snowy peaks
const aurora = (() => {
  const r = rng(211);
  let stars = '';
  for (let i = 0; i < 110; i++) stars += `<circle cx='${(r() * 1600).toFixed(0)}' cy='${(r() * 560).toFixed(0)}' r='${(0.5 + r() * 1.4).toFixed(2)}' fill='#fff' opacity='${(0.25 + r() * 0.6).toFixed(2)}'/>`;
  // a range of peaks; each summit gets a snow cap that follows its own slopes down a quarter way
  const PEAKS = [[0, 760], [220, 560], [330, 640], [520, 470], [700, 650], [860, 560], [1050, 700], [1240, 520], [1420, 660], [1600, 590]];
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let caps = '';
  for (let i = 1; i < PEAKS.length - 1; i++) {
    const p = PEAKS[i], l = PEAKS[i - 1], rt = PEAKS[i + 1];
    if (p[1] > l[1] || p[1] > rt[1]) continue;                       // only summits
    const a = at(p, l, 0.28), b = at(p, rt, 0.28), m1 = at(a, b, 0.33), m2 = at(a, b, 0.66);
    caps += `<path d='M${a[0].toFixed(0)} ${a[1].toFixed(0)} L${p[0]} ${p[1]} L${b[0].toFixed(0)} ${b[1].toFixed(0)} L${m2[0].toFixed(0)} ${(m2[1] - 14).toFixed(0)} L${m1[0].toFixed(0)} ${(m1[1] + 6).toFixed(0)}Z' fill='#e6f0f5' opacity='.85'/>`;
  }
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#050b17'/><stop offset='.7' stop-color='#0d2233'/><stop offset='1' stop-color='#14303f'/></linearGradient>
    <linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#7ef0c0' stop-opacity='0'/><stop offset='.5' stop-color='#58e0a8' stop-opacity='.55'/><stop offset='1' stop-color='#3bb0c8' stop-opacity='0'/></linearGradient>
    <filter id='b'><feGaussianBlur stdDeviation='18'/></filter>
    <linearGradient id='sh' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#000' stop-opacity='.25'/><stop offset='.5' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.3'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stars}
    <g filter='url(#b)' opacity='.9'>
      <path d='M-50 330 C250 180 500 360 800 240 S1300 120 1650 260 L1650 420 C1300 300 1100 420 800 400 S250 360 -50 470Z' fill='url(#a)'/>
      <path d='M200 220 C450 120 700 260 1000 170 S1400 110 1650 160 L1650 260 C1400 210 1150 300 950 270 S500 230 200 320Z' fill='#9b7cf0' opacity='.25'/></g>
    <path d='M${PEAKS.map(([x, y]) => `${x} ${y}`).join(' L')} L1600 1000 L0 1000Z' fill='#2b4a5f'/>
    <path d='M${PEAKS.map(([x, y]) => `${x} ${y}`).join(' L')} L1600 1000 L0 1000Z' fill='url(#sh)'/>
    ${caps}
    <path d='${ridge(900, 90, 223)}' fill='#0b1a26'/>`);
})();

// open sea, a soft horizon and long swells
const ocean = svg(`
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#dbe9f0'/><stop offset='.5' stop-color='#eef3f1'/><stop offset='.52' stop-color='#a9c6d0'/><stop offset='1' stop-color='#5f8ea0'/></linearGradient>
  <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#fff8e8' stop-opacity='.85'/><stop offset='1' stop-color='#fff8e8' stop-opacity='0'/></radialGradient></defs>
  <rect width='1600' height='1000' fill='url(#s)'/>
  <circle cx='600' cy='470' r='200' fill='url(#g)'/><circle cx='600' cy='470' r='52' fill='#fffaf0'/>
  ${Array.from({ length: 12 }, (_, i) => { const y = 540 + i * i * 3.2 + i * 14; return `<path d='M0 ${y} Q200 ${y - 6 - i} 400 ${y} T800 ${y} T1200 ${y} T1600 ${y}' stroke='#fff' stroke-width='${1 + i * 0.25}' fill='none' opacity='${(0.5 - i * 0.03).toFixed(2)}'/>`; }).join('')}
  <path d='M560 520 L640 520 L700 1000 L500 1000Z' fill='#fff8e8' opacity='.12'/>`);

/* ————— music and the Buddha (round five) —————
   Four scenes whose motion is tied to a place in the picture: a candle flame, a guitar's sound
   hole, a pond, three incense sticks. The .zen-fx rules for 'candle', 'notes', 'ripples' and
   'incense' in newtab.css place their effects by these same viewBox coordinates, so a point
   moved here must move there too (each is marked "anchor" below). */

// a page of sheet music: three staves and a scatter of notes
const staff = (x, y, seed) => {
  const r = rng(seed);
  let g = '';
  for (const dy of [0, 24, 48]) {
    for (let i = 0; i < 5; i++) g += `<rect x='${x}' y='${y + dy + i * 3}' width='86' height='.8' fill='#8a7a62'/>`;
    for (let n = 0; n < 6; n++) {
      const nx = x + 6 + n * 13 + r() * 4, ny = y + dy + Math.round(r() * 8) * 1.5;
      g += `<ellipse cx='${nx.toFixed(1)}' cy='${ny.toFixed(1)}' rx='2.3' ry='1.7' fill='#4f4232'/><rect x='${(nx + 1.7).toFixed(1)}' y='${(ny - 9).toFixed(1)}' width='.7' height='9' fill='#4f4232'/>`;
    }
  }
  return g;
};

// Nocturne: an upright piano under a tall window at night, one candle lit on its lid
// (anchor: the flame at 870,440; the keys 836–1324 at y 714; the window panes x 950–1290, y 120–520)
const nocturne = (() => {
  const r = rng(307);
  let stars = '';
  for (let i = 0; i < 56; i++) stars += `<circle cx='${(958 + r() * 324).toFixed(0)}' cy='${(130 + r() * 330).toFixed(0)}' r='${(0.6 + r() * 1.3).toFixed(2)}' fill='#fff' opacity='${(0.3 + r() * 0.6).toFixed(2)}'/>`;
  // the keyboard: 35 white keys from C, the black ones in their twos and threes
  const kx = 836, kw = 488 / 35;
  let keys = '';
  for (let i = 1; i < 35; i++) keys += `<rect x='${(kx + i * kw - 0.5).toFixed(1)}' y='714' width='1' height='38' fill='#7d7466'/>`;
  for (let i = 0; i < 34; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) keys += `<rect x='${(kx + (i + 1) * kw - 4.3).toFixed(1)}' y='714' width='8.6' height='23' rx='1.2' fill='#0b0a0e'/>`;
  const win = 'M950 520 L950 290 A170 170 0 0 1 1290 290 L1290 520 Z';
  const drape = (x, dir) => `<path d='M${x} 96 C${x + dir * 30} 220 ${x - dir * 6} 360 ${x + dir * 22} 520 C${x + dir * 34} 600 ${x + dir * 10} 640 ${x + dir * 26} 690 L${x + dir * 76} 690 C${x + dir * 66} 560 ${x + dir * 84} 380 ${x + dir * 70} 96 Z' fill='#271c30'/>
    <path d='M${x + dir * 30} 110 C${x + dir * 44} 300 ${x + dir * 28} 480 ${x + dir * 46} 680' stroke='#1a1222' stroke-width='5' fill='none'/>`;
  const leaf = (cx, cy, rot) => `<ellipse cx='${cx}' cy='${cy}' rx='30' ry='13' transform='rotate(${rot} ${cx} ${cy})' fill='#17271e' stroke='#2b3c2b' stroke-width='1.5'/>`;
  return svg(`
    <defs>
      <linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#141829'/><stop offset='1' stop-color='#1d2034'/></linearGradient>
      <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b1430'/><stop offset='.7' stop-color='#1e335e'/><stop offset='1' stop-color='#2b4472'/></linearGradient>
      <radialGradient id='c' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffbe6e' stop-opacity='.4'/><stop offset='.45' stop-color='#ff9f4a' stop-opacity='.11'/><stop offset='1' stop-color='#ff9f4a' stop-opacity='0'/></radialGradient>
      <radialGradient id='f' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffd890' stop-opacity='.75'/><stop offset='1' stop-color='#ffb060' stop-opacity='0'/></radialGradient>
      <radialGradient id='m' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#dfe8ff' stop-opacity='.45'/><stop offset='1' stop-color='#dfe8ff' stop-opacity='0'/></radialGradient>
      <linearGradient id='p' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#2b1e1d'/><stop offset='.3' stop-color='#18121a'/><stop offset='1' stop-color='#0f0d14'/></linearGradient>
      <linearGradient id='kk' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#e6d4b2'/><stop offset='.45' stop-color='#c2b69f'/><stop offset='1' stop-color='#9c9485'/></linearGradient>
      <clipPath id='k'><path d='${win}'/></clipPath>
      <mask id='cr'><circle cx='1205' cy='232' r='30' fill='#fff'/><circle cx='1219' cy='223' r='27' fill='#000'/></mask>
    </defs>
    <rect width='1600' height='1000' fill='url(#w)'/>
    <g clip-path='url(#k)'>
      <rect x='940' y='110' width='360' height='420' fill='url(#g)'/>${stars}
      <circle cx='1205' cy='232' r='120' fill='url(#m)'/>
      <circle cx='1205' cy='232' r='30' fill='#eef2ff' mask='url(#cr)'/>
      <path d='${ridge(500, 46, 311, 7)}' fill='#0a1122'/>
      <path d='M940 168 C1004 186 1052 226 1086 296 M1004 190 C1024 166 1046 156 1076 154 M1046 236 C1074 232 1096 246 1114 266' stroke='#0a1122' stroke-width='6' fill='none' stroke-linecap='round'/>
    </g>
    <path d='${win}' fill='none' stroke='#0a0b14' stroke-width='16'/>
    <path d='M1120 120 L1120 520 M950 300 L1290 300 M950 410 L1290 410' stroke='#0a0b14' stroke-width='8'/>
    <rect x='928' y='514' width='384' height='14' rx='3' fill='#262a40'/>
    <rect x='870' y='88' width='500' height='8' rx='4' fill='#3a3245'/><circle cx='870' cy='92' r='9' fill='#4a4058'/><circle cx='1370' cy='92' r='9' fill='#4a4058'/>
    ${drape(880, 1)}${drape(1360, -1)}
    <circle cx='870' cy='440' r='560' fill='url(#c)'/>
    <rect y='890' width='1600' height='16' fill='#11101b'/>
    <rect y='906' width='1600' height='94' fill='#100c12'/>
    <path d='M0 930 H1600 M0 958 H1600 M0 988 H1600' stroke='#1b151c' stroke-width='2'/>
    <path d='M684 822 L736 822 L728 906 L692 906 Z' fill='#1d1820'/>
    <path d='M710 822 C704 760 700 700 712 636' stroke='#13201a' stroke-width='4' fill='none'/>
    ${leaf(688, 782, -32)}${leaf(736, 752, 26)}${leaf(690, 712, -42)}${leaf(734, 684, 32)}${leaf(708, 648, -12)}
    <rect x='786' y='548' width='588' height='14' rx='3' fill='#0b0a10'/>
    <rect x='786' y='548' width='300' height='2' fill='#6a4a32' opacity='.8'/>
    <rect x='796' y='562' width='568' height='154' fill='url(#p)'/>
    <rect x='836' y='578' width='488' height='100' rx='6' fill='none' stroke='#2a2230' stroke-width='2'/>
    <g transform='rotate(-2 1010 640)'><rect x='958' y='598' width='104' height='84' fill='#e9d4ae'/>${staff(967, 610, 11)}</g>
    <g transform='rotate(2 1118 640)'><rect x='1066' y='598' width='104' height='84' fill='#d8c19c'/>${staff(1075, 610, 23)}</g>
    <rect x='826' y='680' width='508' height='10' rx='2' fill='#221b26'/>
    <rect x='796' y='700' width='40' height='62' fill='#0d0b11'/><rect x='1324' y='700' width='40' height='62' fill='#0d0b11'/>
    <rect x='836' y='714' width='488' height='38' fill='url(#kk)'/>${keys}
    <rect x='832' y='752' width='496' height='9' fill='#0f0c13'/>
    <rect x='806' y='761' width='548' height='134' fill='#110e15'/>
    <rect x='846' y='780' width='468' height='96' rx='6' fill='none' stroke='#221d29' stroke-width='2'/>
    <rect x='1046' y='880' width='16' height='6' rx='2' fill='#a8854a'/><rect x='1072' y='880' width='16' height='6' rx='2' fill='#a8854a'/><rect x='1098' y='880' width='16' height='6' rx='2' fill='#a8854a'/>
    <rect x='796' y='895' width='568' height='12' fill='#0a0910'/>
    <rect x='786' y='562' width='14' height='345' fill='#0c0a10'/><rect x='1360' y='562' width='14' height='345' fill='#0c0a10'/>
    <path d='M1196 548 L1212 476 L1230 476 L1246 548 Z' fill='#3b2417'/><path d='M1207 540 L1217 488 L1225 488 L1235 540 Z' fill='#5a3a24'/>
    <path d='M1221 534 L1232 492' stroke='#d8c39a' stroke-width='2'/><rect x='1225' y='500' width='9' height='6' fill='#d8c39a' transform='rotate(20 1229 503)'/>
    <rect x='1286' y='532' width='72' height='16' rx='2' fill='#3a2a3d'/><rect x='1292' y='520' width='60' height='12' rx='2' fill='#2c3b4a'/>
    <ellipse cx='870' cy='547' rx='24' ry='5' fill='#7a5a30'/>
    <path d='M862 547 L864 506 L876 506 L878 547 Z' fill='#a07c42'/>
    <ellipse cx='870' cy='506' rx='16' ry='4' fill='#b8904f'/>
    <rect x='862' y='462' width='16' height='44' rx='2' fill='#efe4cc'/><rect x='871' y='462' width='7' height='44' fill='#cbbd9d' opacity='.6'/>
    <path d='M870 455 L870 462' stroke='#2a1a10' stroke-width='1.6'/>
    <circle cx='870' cy='440' r='74' fill='url(#f)'/>
    <path d='M870 420 C878 432 881 444 870 458 C859 444 862 432 870 420Z' fill='#ffcf72'/>
    <path d='M870 432 C874 440 875 447 870 455 C865 447 866 440 870 432Z' fill='#fff4cf'/>`);
})();

// Serenade: a guitar leant against a warm wall in an afternoon window's light
// (anchor: the sound hole at about 1156,718; the window's light on the wall O=960,190 u=440,60 v=0,460)
const serenade = (() => {
  // the guitar, drawn upright from the middle of its foot, then leant against the wall
  const body = 'M0 0 C70 0 125 -30 125 -100 C125 -160 80 -180 80 -205 C80 -228 102 -245 102 -280 C102 -320 60 -340 0 -340 C-60 -340 -102 -320 -102 -280 C-102 -245 -80 -228 -80 -205 C-80 -180 -125 -160 -125 -100 C-125 -30 -70 0 0 0 Z';
  const nut = -650, saddle = -86, fretY = (n) => nut + (saddle - nut) * (1 - 2 ** (-n / 12));
  let frets = '', strings = '', pegs = '';
  for (let n = 1; n <= 14; n++) frets += `<rect x='-20.5' y='${(fretY(n) - 0.8).toFixed(1)}' width='41' height='1.6' fill='#cfc6b2'/>`;
  for (const n of [3, 5, 7, 9]) frets += `<circle cx='0' cy='${((fretY(n - 1) + fretY(n)) / 2).toFixed(1)}' r='3' fill='#e8e0cc'/>`;
  frets += `<circle cx='-8' cy='${((fretY(11) + fretY(12)) / 2).toFixed(1)}' r='3' fill='#e8e0cc'/><circle cx='8' cy='${((fretY(11) + fretY(12)) / 2).toFixed(1)}' r='3' fill='#e8e0cc'/>`;
  for (let i = 0; i < 6; i++) strings += `<path d='M${-15 + i * 6} ${saddle - 2} L${-12.5 + i * 5} ${nut} L${i < 3 ? -24 : 24} ${-672 - (i % 3) * 24}' stroke='#f1ead9' stroke-width='${(1.3 - i * 0.12).toFixed(2)}' fill='none' opacity='.85'/>`;
  for (let j = 0; j < 3; j++) pegs += `<rect x='-34' y='${-675 - j * 24}' width='12' height='5' fill='#b9a57c'/><circle cx='-36' cy='${-672 - j * 24}' r='6.5' fill='#d9c69c'/><rect x='22' y='${-675 - j * 24}' width='12' height='5' fill='#b9a57c'/><circle cx='36' cy='${-672 - j * 24}' r='6.5' fill='#d9c69c'/>`;
  const guitar = `
    <path d='${body}' fill='#4a2a14' stroke='#4a2a14' stroke-width='9'/>
    <path d='${body}' fill='url(#sb)' stroke='#f3e3c4' stroke-width='2.5'/>
    <path d='M34 -206 C58 -206 66 -180 56 -164 C46 -156 32 -164 30 -184 Z' fill='#4a2412' opacity='.32'/>
    <circle cx='0' cy='-232' r='47' fill='none' stroke='#8a5a2e' stroke-width='1.6'/>
    <circle cx='0' cy='-232' r='41' fill='none' stroke='#5a3519' stroke-width='3.5'/>
    <circle cx='0' cy='-232' r='34' fill='#1f120a'/>
    <path d='M-20 -300 L20 -300 L19 ${nut} L-19 ${nut} Z' fill='#3b2418'/>${frets}
    <path d='M-19 ${nut} L-25 -744 Q0 -754 25 -744 L19 ${nut} Z' fill='#3a2112'/>${pegs}
    <rect x='-20' y='${nut - 3}' width='40' height='4' fill='#efe7d6'/>
    <rect x='-46' y='-96' width='92' height='18' rx='5' fill='#3a2112'/><rect x='-34' y='-91' width='68' height='3' fill='#efe7d6'/>
    ${Array.from({ length: 6 }, (_, i) => `<circle cx='${-15 + i * 6}' cy='-82' r='1.8' fill='#efe7d6'/>`).join('')}
    ${strings}`;
  // the window's light on the wall: four panes, skewed by the low sun
  const P = (s, t) => `${(960 + s * 440).toFixed(0)} ${(190 + s * 60 + t * 460).toFixed(0)}`;
  const pane = (s0, s1, t0, t1) => `<path d='M${P(s0, t0)} L${P(s1, t0)} L${P(s1, t1)} L${P(s0, t1)} Z'/>`;
  const plant = Array.from({ length: 7 }, (_, i) => {
    const x0 = 1430 + i * 7, xt = 1380 + i * 22 + (i % 2) * 8, yt = 540 + ((i * 37) % 90);
    return `<path d='M${x0 - 12} 790 C${x0 - 20} 700 ${xt - 12} 620 ${xt} ${yt} C${xt + 12} 620 ${x0 + 20} 700 ${x0 + 12} 790 Z' fill='${i % 2 ? '#4d7a48' : '#5b8a52'}' stroke='#c9c46c' stroke-width='2'/>`;
  }).join('');
  return svg(`
    <defs>
      <linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f4e9d8'/><stop offset='1' stop-color='#e6d3ba'/></linearGradient>
      <radialGradient id='sb' cx='.5' cy='.68' r='.62'><stop offset='0' stop-color='#f3cb8c'/><stop offset='.55' stop-color='#da9b52'/><stop offset='.85' stop-color='#a8622c'/><stop offset='1' stop-color='#6e3a18'/></radialGradient>
      <linearGradient id='fl' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b9895b'/><stop offset='1' stop-color='#8e6240'/></linearGradient>
      <filter id='bl'><feGaussianBlur stdDeviation='4'/></filter><filter id='sh'><feGaussianBlur stdDeviation='9'/></filter>
    </defs>
    <rect width='1600' height='1000' fill='url(#w)'/>
    <g fill='#fff8e8' opacity='.62' filter='url(#bl)'>${pane(0, 0.485, 0, 0.485)}${pane(0.515, 1, 0, 0.485)}${pane(0, 0.485, 0.515, 1)}${pane(0.515, 1, 0.515, 1)}</g>
    <rect y='880' width='1600' height='22' fill='#efe3cf'/><rect y='880' width='1600' height='2' fill='#d6c4a8'/>
    <rect y='902' width='1600' height='98' fill='url(#fl)'/>
    <path d='M0 934 H1600 M0 968 H1600' stroke='#a37650' stroke-width='2'/>
    <path d='M240 902 V934 M710 934 V968 M1180 902 V934 M420 968 V1000 M1460 968 V1000' stroke='#a37650' stroke-width='2'/>
    <path d='M640 912 L1020 912 L1110 994 L700 994 Z' fill='#fff2d6' opacity='.22' filter='url(#bl)'/>
    <g transform='translate(1158 902) rotate(16) scale(.82)' opacity='.14' filter='url(#sh)' fill='#5a3a1c'><path d='${body}'/><path d='M-22 -340 L-25 -744 L25 -744 L22 -340 Z'/></g>
    <rect x='862' y='760' width='138' height='14' rx='6' fill='#8a5a34'/>
    <path d='M876 774 L866 902 M986 774 L996 902 M906 774 L911 902 M956 774 L951 902' stroke='#6e4526' stroke-width='7'/>
    <rect x='870' y='846' width='120' height='6' fill='#6e4526'/>
    <rect x='872' y='744' width='112' height='16' fill='#f4eee2'/><path d='M872 748 H984 M872 752 H984 M872 756 H984' stroke='#d8cfbd' stroke-width='1'/>
    <path d='M934 720 L960 720 L957 744 L937 744 Z' fill='#ece5d8'/><path d='M960 726 C970 726 970 738 958 738' stroke='#ece5d8' stroke-width='3' fill='none'/>
    <g transform='translate(1120 902) rotate(11) scale(.82)'>${guitar}</g>
    <path d='M1404 790 L1496 790 L1486 902 L1414 902 Z' fill='#c0704a'/><rect x='1398' y='780' width='104' height='14' rx='3' fill='#cd7c54'/>
    ${plant}`);
})();

// Lotus: a seated Buddha on a plinth in a lotus pond at dusk, the moon rising behind his head
// (anchor: the moon at 1120,470; the plinth's foot in the water at y 760; lanterns at 560,840 780,905 1430,860)
const lotus = (() => {
  const r = rng(419);
  // the figure in meditation, drawn from the middle of the crossed legs; `sw` grows every part
  // a little, for the rim of light the moon puts round it
  const petals = (y0, dir) => Array.from({ length: 9 }, (_, i) => {
    const cx = -168 + i * 42, h = 38 * dir;
    return `<path d='M${cx - 23} ${y0} C${cx - 23} ${y0 - h * 0.6} ${cx - 8} ${y0 - h * 0.95} ${cx} ${y0 - h} C${cx + 8} ${y0 - h * 0.95} ${cx + 23} ${y0 - h * 0.6} ${cx + 23} ${y0} Z'/>`;
  }).join('');
  const figure = (c, sw) => `<g fill='${c}' stroke='${c}' stroke-width='${sw}' stroke-linejoin='round'>
    <rect x='-176' y='38' width='352' height='34' rx='3'/>${petals(44, 1)}
    <rect x='-206' y='70' width='412' height='40' rx='4'/>
    <ellipse cx='0' cy='-28' rx='172' ry='36'/>
    <path d='M-78 -40 C-82 -110 -88 -150 -86 -180 C-82 -200 -60 -212 -28 -218 L28 -218 C60 -212 82 -200 86 -180 C88 -150 82 -110 78 -40 Z'/>
    <path d='M-74 -196 C-104 -176 -118 -136 -116 -96 C-112 -62 -64 -48 -22 -52 M74 -196 C104 -176 118 -136 116 -96 C112 -62 64 -48 22 -52' fill='none' stroke-width='${30 + sw}' stroke-linecap='round'/>
    <ellipse cx='0' cy='-54' rx='44' ry='15'/>
    <rect x='-20' y='-236' width='40' height='30'/>
    <ellipse cx='0' cy='-270' rx='36' ry='44'/><ellipse cx='0' cy='-314' rx='19' ry='14'/>
    <ellipse cx='-37' cy='-258' rx='8' ry='24'/><ellipse cx='37' cy='-258' rx='8' ry='24'/></g>`;
  const buddha = `${figure('#b07a86', 7)}${figure('#291f33', 0)}
    <g fill='none' stroke='#b07a86' stroke-linecap='round' opacity='.32' stroke-width='3'>
      <path d='M-60 -206 C-20 -170 30 -120 72 -58'/><path d='M-150 -10 C-80 0 80 0 150 -10'/>
      <path d='M-20 -268 Q-12 -263 -5 -268 M5 -268 Q12 -263 20 -268'/></g>`;
  const scene = `<g transform='translate(1120 676) scale(.76)'>${buddha}</g>`;
  // pads: flat discs with their notch, larger nearer; a few carry a flower
  const pad = (cx, cy, rx) => {
    const ry = rx * 0.3, a = r() * Math.PI * 2, n = 0.22;
    const p = (t) => `${(cx + rx * Math.cos(t)).toFixed(1)} ${(cy + ry * Math.sin(t)).toFixed(1)}`;
    return `<ellipse cx='${cx}' cy='${(cy + 3).toFixed(1)}' rx='${rx}' ry='${ry.toFixed(1)}' fill='#141f1b'/><path d='M${cx} ${cy} L${p(a + n)} A${rx} ${ry.toFixed(1)} 0 1 1 ${p(a - n)} Z' fill='#2b4538' stroke='#73866a' stroke-width='1.4' stroke-opacity='.55'/>`;
  };
  const flower = (cx, cy, s) => [-62, -36, -12, 12, 36, 62, 0].map((a, i) => {
    const h = (i === 6 ? 30 : 40) * s, w = (i === 6 ? 20 : 24) * s;
    return `<path d='M0 0 C${-w / 2} ${-h * 0.35} ${-w / 3} ${-h * 0.85} 0 ${-h} C${w / 3} ${-h * 0.85} ${w / 2} ${-h * 0.35} 0 0 Z' transform='translate(${cx} ${cy}) rotate(${a})' fill='${Math.abs(a) > 40 ? '#d98aa2' : i === 6 ? '#fbd7df' : '#efb0c2'}'/>`;
  }).join('');
  let pads = '';
  const spots = [[380, 700], [620, 680], [820, 720], [300, 800], [520, 790], [760, 820], [1330, 720], [1460, 780], [1290, 830], [180, 900], [460, 930], [700, 965], [1370, 930], [1520, 880], [960, 900], [880, 980]];
  spots.forEach(([x, y], i) => {
    const rx = 18 + (y - 640) * 0.3;
    pads += pad(x, y, Math.round(rx));
    if ([1, 4, 7, 10, 12].includes(i)) pads += flower(x + rx * 0.15, y - 2, 0.5 + (y - 640) / 600);
  });
  const lantern = (x, y) => `<ellipse cx='${x}' cy='${y + 26}' rx='7' ry='34' fill='#ffcf8a' opacity='.22'/>
    <ellipse cx='${x}' cy='${y + 4}' rx='22' ry='6' fill='#2a1f30'/>${flower(x, y + 2, 0.42)}
    <circle cx='${x}' cy='${y - 6}' r='34' fill='url(#lg)'/><ellipse cx='${x}' cy='${y - 8}' rx='3' ry='6' fill='#fff1c0'/>`;
  let glints = '';
  for (let y = 778; y < 1000; y += 13) glints += `<rect x='${(1120 - 110 - r() * 50).toFixed(0)}' y='${y}' width='${(160 + r() * 120).toFixed(0)}' height='2' rx='1' fill='#f1b48e' opacity='${(0.14 + r() * 0.16).toFixed(2)}'/>`;
  return svg(`
    <defs>
      <linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#141530'/><stop offset='.45' stop-color='#3b2a55'/><stop offset='.75' stop-color='#95546f'/><stop offset='.93' stop-color='#e48c6d'/><stop offset='1' stop-color='#f6b27c'/></linearGradient>
      <linearGradient id='wa' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#d98a74'/><stop offset='.1' stop-color='#86506c'/><stop offset='.45' stop-color='#3a2a4a'/><stop offset='1' stop-color='#17142c'/></linearGradient>
      <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffd9a8' stop-opacity='.42'/><stop offset='1' stop-color='#ffd9a8' stop-opacity='0'/></radialGradient>
      <radialGradient id='sun' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffc98c' stop-opacity='.6'/><stop offset='1' stop-color='#ffc98c' stop-opacity='0'/></radialGradient>
      <radialGradient id='lg' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffd890' stop-opacity='.7'/><stop offset='1' stop-color='#ffb060' stop-opacity='0'/></radialGradient>
    </defs>
    <rect width='1600' height='610' fill='url(#s)'/>
    <circle cx='420' cy='610' r='320' fill='url(#sun)'/>
    <circle cx='1120' cy='470' r='250' fill='url(#g)'/><circle cx='1120' cy='470' r='72' fill='#fbe3c0' opacity='.96'/>
    <path d='${ridge(596, 56, 421, 8)}' fill='#6e4560' opacity='.6'/>
    <path d='M290 612 C380 560 440 553 480 553 C540 553 610 578 700 612 Z' fill='#5a3a55'/>
    <path d='M465 553 A15 14 0 0 1 495 553 Z M474 540 H486 V547 H474 Z M478 540 L480 512 L482 540 Z' fill='#4a3050'/>
    <path d='${ridge(612, 30, 433, 10)}' fill='#3e2a45'/>
    <rect y='608' width='1600' height='392' fill='url(#wa)'/>
    <g transform='translate(0 1520) scale(1 -1)' opacity='.3'>${scene}</g>
    ${glints}
    <ellipse cx='1120' cy='760' rx='190' ry='9' fill='#120f1f' opacity='.7'/>
    ${scene}${pads}
    ${lantern(560, 840)}${lantern(780, 905)}${lantern(1430, 860)}`);
})();

// Shrine: a stone Buddha head among bamboo, moss on its curls, incense rising before it
// (anchor: the incense tips at 877,692 900,686 923,696)
const shrine = (() => {
  const r = rng(521);
  const stalks = (n, x0, x1, w0, w1, color, o0, o1) => {
    let g = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), w = w0 + r() * (w1 - w0), o = (o0 + r() * (o1 - o0)).toFixed(2);
      let nodes = '';
      for (let y = r() * 140; y < 1000; y += 130 + r() * 60) nodes += `<rect x='${(x - 2).toFixed(0)}' y='${y.toFixed(0)}' width='${(w + 4).toFixed(0)}' height='4' rx='2' fill='#1d3220' opacity='.4'/>`;
      g += `<g opacity='${o}'><rect x='${x.toFixed(0)}' y='0' width='${w.toFixed(0)}' height='1000' fill='${color}'/><rect x='${(x + w * 0.2).toFixed(0)}' y='0' width='${(w * 0.18).toFixed(1)}' height='1000' fill='#fff' opacity='.12'/>${nodes}</g>`;
    }
    return g;
  };
  const spray = (x, y, dir, n) => Array.from({ length: n }, (_, i) => {
    const a = dir * (20 + i * 14 + r() * 10), len = 70 + r() * 40;
    return `<ellipse cx='${x}' cy='${y}' rx='${(len / 2).toFixed(0)}' ry='7' transform='rotate(${a.toFixed(0)} ${x} ${y}) translate(${(len / 2).toFixed(0)} 0)' fill='${i % 2 ? '#3f6440' : '#4f7a4c'}'/>`;
  }).join('');
  // the head, from the middle of the face: curls on the crown and the ushnisha
  let curls = '';
  for (let y = -206; y <= -66; y += 17) {
    const hw = 160 * Math.sqrt(Math.max(0, 1 - ((-40 - y) / 178) ** 2)), off = ((y + 206) / 17) % 2 ? 8.5 : 0;
    for (let x = -hw + 10 + off; x <= hw - 10; x += 17) {
      if (y > -60 - 28 * (1 - (x / 150) ** 2) - 9) continue;
      curls += `<circle cx='${x.toFixed(1)}' cy='${y}' r='7.6' fill='#777b70'/><circle cx='${(x - 2).toFixed(1)}' cy='${y - 2}' r='3.2' fill='#a7ab9e' opacity='.55'/>`;
    }
  }
  for (let y = -262; y <= -212; y += 15) {
    const hw = 62 * Math.sqrt(Math.max(0, 1 - ((y + 232) / 42) ** 2));
    for (let x = -hw + 8; x <= hw - 8; x += 15) curls += `<circle cx='${x.toFixed(1)}' cy='${y}' r='7' fill='#777b70'/><circle cx='${(x - 2).toFixed(1)}' cy='${y - 2}' r='3' fill='#a7ab9e' opacity='.55'/>`;
  }
  const ear = `<path d='M-150 -46 C-178 -52 -192 -20 -188 30 C-185 80 -184 130 -170 158 C-162 174 -146 170 -146 150 C-148 110 -150 60 -148 10 Z' fill='#9a9e92'/><path d='M-160 -10 C-170 30 -168 80 -162 120' stroke='#6f736a' stroke-width='3' fill='none'/>`;
  const line = `stroke='#5c6057' stroke-linecap='round' fill='none'`;
  const head = `
    <path d='M-86 150 L-98 245 L98 245 L86 150 Z' fill='#8d9187'/>
    <path d='M-92 194 Q0 210 92 194 M-95 222 Q0 238 95 222' ${line} stroke-width='3' opacity='.6'/>
    <rect x='-200' y='240' width='400' height='80' rx='12' fill='#979b8f'/><rect x='-200' y='240' width='400' height='14' rx='7' fill='#b2b5a8'/>
    <path d='M-120 300 L-96 270 L-80 288 M130 262 L118 296' ${line} stroke-width='2' opacity='.5'/>
    ${ear}<g transform='scale(-1 1)'>${ear}</g>
    <path d='M-160 -40 C-165 -150 -95 -215 0 -215 C95 -215 165 -150 160 -40 Z' fill='#83877c'/>
    <ellipse cx='0' cy='-232' rx='62' ry='42' fill='#83877c'/>
    ${curls}
    <path d='M-150 -60 C-155 0 -140 90 -110 140 C-80 185 -40 200 0 200 C40 200 80 185 110 140 C140 90 155 0 150 -60 C100 -96 -100 -96 -150 -60 Z' fill='url(#fg)'/>
    <path d='M-125 -22 C-95 -48 -45 -50 -14 -24 M125 -22 C95 -48 45 -50 14 -24' ${line} stroke-width='4'/>
    <path d='M-14 -22 C-10 15 -14 50 -26 76 C-14 88 14 88 26 76 C14 50 10 15 14 -22' ${line} stroke-width='3.2'/>
    <path d='M-112 12 C-90 2 -55 2 -30 16 M112 12 C90 2 55 2 30 16' ${line} stroke-width='4.5'/>
    <path d='M-106 15 C-84 30 -55 30 -34 19 M106 15 C84 30 55 30 34 19' ${line} stroke-width='2.4' opacity='.7'/>
    <path d='M-42 118 C-25 108 -8 112 0 114 C8 112 25 108 42 118 M-30 127 C-15 140 15 140 30 127 M-42 118 C-46 114 -48 110 -47 106 M42 118 C46 114 48 110 47 106' ${line} stroke-width='3.2'/>
    <circle cx='0' cy='-48' r='5.5' fill='#6f736a'/>
    <path d='M-60 -80 L-70 -40 L-62 0 L-80 40' stroke='#7b7f74' stroke-width='1.8' fill='none' opacity='.7'/>
    <path d='M-150 -104 C-146 -126 -128 -136 -112 -128 C-104 -142 -86 -146 -76 -134 C-70 -122 -84 -112 -98 -110 C-112 -100 -134 -94 -150 -104 Z M-58 -196 C-44 -208 -20 -212 -6 -202 C-14 -192 -34 -186 -58 -196 Z M62 -168 C74 -178 92 -176 98 -164 C88 -158 72 -160 62 -168 Z' fill='#7f9a55' opacity='.85'/>
    <path d='M-40 -262 C-20 -276 12 -276 30 -266 C10 -258 -20 -256 -40 -262 Z' fill='#87a25a' opacity='.8'/>
    <path d='M-200 252 C-150 236 -90 244 -40 240 C-70 256 -130 262 -200 270 Z M90 240 C130 234 170 238 200 248 L200 262 C160 256 120 252 90 240 Z' fill='#7f9a55' opacity='.9'/>
    <path d='M-188 140 C-180 156 -170 164 -160 160 C-168 150 -176 144 -188 140 Z' fill='#7f9a55' opacity='.8'/>
    ${Array.from({ length: 14 }, () => `<circle cx='${(-130 + r() * 260).toFixed(0)}' cy='${(-60 + r() * 240).toFixed(0)}' r='${(2 + r() * 4).toFixed(1)}' fill='#dcdecf' opacity='.35'/>`).join('')}`;
  let moss = '';
  for (let i = 0; i < 140; i++) moss += `<ellipse cx='${(r() * 1600).toFixed(0)}' cy='${(870 + r() * 130).toFixed(0)}' rx='${(3 + r() * 9).toFixed(1)}' ry='${(1.5 + r() * 3).toFixed(1)}' fill='${r() < 0.5 ? '#5f7a48' : '#a9bb84'}' opacity='.5'/>`;
  for (let i = 0; i < 18; i++) { const x = (r() * 1600).toFixed(0), y = (880 + r() * 110).toFixed(0); moss += `<ellipse cx='${x}' cy='${y}' rx='14' ry='3.5' transform='rotate(${(r() * 60 - 30).toFixed(0)} ${x} ${y})' fill='${r() < 0.5 ? '#c3ad62' : '#9aa85a'}' opacity='.8'/>`; }
  const tips = [[877, 692], [900, 686], [923, 696]];
  return svg(`
    <defs>
      <linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e9efe2'/><stop offset='.6' stop-color='#cfdcc6'/><stop offset='1' stop-color='#b4c6a9'/></linearGradient>
      <linearGradient id='m' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f2f5ec' stop-opacity='0'/><stop offset='.5' stop-color='#f2f5ec' stop-opacity='.6'/><stop offset='1' stop-color='#f2f5ec' stop-opacity='0'/></linearGradient>
      <linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fffff0' stop-opacity='.55'/><stop offset='1' stop-color='#fffff0' stop-opacity='0'/></linearGradient>
      <linearGradient id='gr' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#9cae84'/><stop offset='1' stop-color='#6c8452'/></linearGradient>
      <linearGradient id='fg' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#c4c6b9'/><stop offset='.55' stop-color='#a9ad9f'/><stop offset='1' stop-color='#888c81'/></linearGradient>
      <filter id='bl'><feGaussianBlur stdDeviation='14'/></filter><filter id='sm'><feGaussianBlur stdDeviation='2.5'/></filter>
    </defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    ${stalks(28, -20, 1620, 8, 16, '#9fb596', 0.3, 0.55)}
    <rect y='560' width='1600' height='360' fill='url(#m)'/>
    ${stalks(12, 220, 1460, 16, 26, '#6d8c62', 0.5, 0.75)}
    <g filter='url(#bl)' opacity='.55'><path d='M150 -20 L330 -20 L1150 1000 L900 1000 Z' fill='url(#b)'/><path d='M520 -20 L620 -20 L1420 1000 L1260 1000 Z' fill='url(#b)'/></g>
    <path d='M0 872 C300 852 600 882 900 866 S1400 852 1600 870 L1600 1000 L0 1000 Z' fill='url(#gr)'/>${moss}
    ${stalks(2, 20, 150, 36, 48, '#3b5a3c', 0.9, 1)}${stalks(2, 1480, 1580, 36, 48, '#3b5a3c', 0.9, 1)}
    ${spray(1500, 160, -1, 6)}${spray(1540, 330, -1, 5)}${spray(90, 120, 1, 5)}${spray(1470, 60, -1, 4)}
    <ellipse cx='1160' cy='884' rx='230' ry='22' fill='#2e3d26' opacity='.35'/>
    <g transform='translate(1160 620) scale(.8)'>${head}</g>
    <ellipse cx='900' cy='882' rx='72' ry='14' fill='#a2a593'/><ellipse cx='900' cy='878' rx='72' ry='12' fill='#b4b7a6'/>
    <ellipse cx='812' cy='890' rx='20' ry='9' fill='#8d9180'/><ellipse cx='990' cy='893' rx='14' ry='7' fill='#9a9d8c'/>
    <path d='M862 846 C864 882 936 882 938 846 Z' fill='#6c5a3a'/><ellipse cx='900' cy='846' rx='40' ry='8' fill='#8b744a'/><ellipse cx='900' cy='846' rx='34' ry='5.5' fill='#d8cbb0'/>
    ${tips.map(([x, y], i) => `<path d='M${890 + i * 10} 846 L${x} ${y}' stroke='#7a3b2a' stroke-width='3'/><circle cx='${x}' cy='${y}' r='3.4' fill='#ff7a3a'/>`).join('')}
    <g filter='url(#sm)' fill='none' stroke='#fff' stroke-linecap='round' opacity='.45'>${tips.map(([x, y], i) => `<path d='M${x} ${y - 4} C${x - 12 + i * 6} ${y - 50} ${x + 14} ${y - 90} ${x + 2 - i * 4} ${y - 140} S${x - 16} ${y - 220} ${x + 6} ${y - 280}' stroke-width='${2.4 - i * 0.4}'/>`).join('')}</g>`);
})();
/* ————— end of round five's scenes ————— */

/* ————— four quiet weathers (2026-11-18): rain on a pond, snow on a temple hill, a sea of cloud at
   sunrise, lanterns on a river at night. Each has its own motion, anchored to the picture like
   round five's (container units on .zen-fx, see newtab.css). ————— */

// rain on a pond at dusk: hills going into cloud, a tea house on the far bank, lily pads and
// reeds; the rain and the rings it makes on the water are the motion ('rain')
const rain = (() => {
  const house = `<path d='M262 566 Q350 544 438 566 L452 576 Q350 560 248 576Z'/><path d='M344 547 L350 534 L356 547Z'/>
    <rect x='278' y='574' width='8' height='42'/><rect x='346' y='574' width='8' height='42'/><rect x='414' y='574' width='8' height='42'/>
    <rect x='270' y='596' width='160' height='5'/>`;
  const pad = (x, y, r) => `<path d='M${x} ${y} L${(x + r * 0.978).toFixed(1)} ${(y - r * 0.058).toFixed(1)} A${r} ${(r * 0.28).toFixed(1)} 0 1 0 ${(x + r * 0.978).toFixed(1)} ${(y + r * 0.058).toFixed(1)}Z'/>`;
  const pads = [[520, 812, 44], [606, 848, 30], [1090, 762, 38], [1186, 894, 52], [262, 916, 40], [1430, 712, 26], [812, 944, 34]].map((p) => pad(...p)).join('');
  const reeds = Array.from({ length: 15 }, (_, i) => {
    const x = 1350 + i * 16, h = 150 + ((i * 37) % 120), lean = ((i % 3) - 1) * 16;
    return `<path d='M${x} 1000 Q${x - 6} ${1000 - h / 2} ${x + lean} ${1000 - h}' stroke='#1d2925' stroke-width='3' fill='none'/>`
      + (i % 4 === 1 ? `<ellipse cx='${x + lean}' cy='${1000 - h + 14}' rx='5' ry='16' fill='#2b2420'/>` : '');
  }).join('');
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2c3745'/><stop offset='.45' stop-color='#4b5a69'/><stop offset='.61' stop-color='#6f7d89'/></linearGradient>
    <linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#5b6873'/><stop offset='.35' stop-color='#3e4a56'/><stop offset='1' stop-color='#222b35'/></linearGradient>
    <linearGradient id='m' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#93a0aa' stop-opacity='0'/><stop offset='.5' stop-color='#93a0aa' stop-opacity='.6'/><stop offset='1' stop-color='#93a0aa' stop-opacity='0'/></linearGradient>
    <radialGradient id='l' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffd79a' stop-opacity='.55'/><stop offset='1' stop-color='#ffd79a' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <path d='${ridge(470, 170, 211)}' fill='#5d6a77' opacity='.7'/>
    <rect y='390' width='1600' height='160' fill='url(#m)'/>
    <path d='${ridge(565, 100, 223)}' fill='#46525f' opacity='.9'/>
    <rect y='505' width='1600' height='110' fill='url(#m)'/>
    <rect y='608' width='1600' height='392' fill='url(#w)'/>
    <path d='M0 612 C200 600 420 606 640 604 S1100 598 1600 610 L1600 624 L0 624Z' fill='#2c3640'/>
    <circle cx='350' cy='588' r='70' fill='url(#l)'/><rect x='336' y='580' width='28' height='18' rx='3' fill='#ffd79a' opacity='.8'/>
    <g fill='#222b34'>${house}</g>
    <g fill='#222b34' opacity='.32' transform='translate(0 1240) scale(1 -1)'>${house}</g>
    <ellipse cx='350' cy='660' rx='18' ry='46' fill='#ffd79a' opacity='.16'/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x='${(90 + i * 190) % 1500}' y='${660 + i * 38}' width='${120 + (i % 3) * 70}' height='2' rx='1' fill='#c7d3dc' opacity='.22'/>`).join('')}
    <g fill='#3a5547' opacity='.95'>${pads}</g>
    <circle cx='1196' cy='884' r='9' fill='#e7a7b4'/><circle cx='1192' cy='880' r='4' fill='#f6d5dc'/>
    ${reeds}`);
})();

// snow on a temple hill: a pagoda among pines, the far range white under a grey-blue sky;
// the falling flakes are the motion ('snow')
const snowfall = (() => {
  const pine = (x, base, h) => [0, 1, 2].map((k) => {
    const w = (h * (0.34 - k * 0.07)).toFixed(1), top = base - h * (0.42 + k * 0.29), bot = base - h * (k * 0.27);
    return `<path d='M${x} ${top.toFixed(1)} L${(x + +w).toFixed(1)} ${bot.toFixed(1)} L${(x - +w).toFixed(1)} ${bot.toFixed(1)}Z' fill='#2d4646'/>`
      + `<path d='M${(x - w * 0.55).toFixed(1)} ${(top + (bot - top) * 0.62).toFixed(1)} L${x} ${top.toFixed(1)} L${(x + w * 0.55).toFixed(1)} ${(top + (bot - top) * 0.62).toFixed(1)}' stroke='#f4f7fa' stroke-width='5' fill='none' stroke-linejoin='round' opacity='.9'/>`;
  }).join('') + `<rect x='${x - 4}' y='${base}' width='8' height='${(h * 0.12).toFixed(0)}' fill='#3c3230'/>`;
  const pagoda = (() => {
    let g = `<rect x='1062' y='596' width='76' height='54' fill='#6a4238'/><rect x='1088' y='614' width='24' height='36' fill='#2b1f1d'/>`;
    for (let k = 0; k < 4; k++) {
      const w = 190 - k * 34, y = 598 - k * 54, x0 = 1100 - w / 2, x1 = 1100 + w / 2;
      if (k) g += `<rect x='${1100 - w * 0.28}' y='${y}' width='${w * 0.56}' height='36' fill='#6a4238'/>`;
      g += `<path d='M${x0} ${y} Q1100 ${y - 26} ${x1} ${y} L${x1 + 12} ${y + 9} Q1100 ${y - 12} ${x0 - 12} ${y + 9}Z' fill='#2f2a34'/>`
        + `<path d='M${x0 + 4} ${y - 2} Q1100 ${y - 27} ${x1 - 4} ${y - 2}' stroke='#f6f8fb' stroke-width='6' fill='none' stroke-linecap='round'/>`;
    }
    return g + `<path d='M1100 438 L1100 380' stroke='#2f2a34' stroke-width='4'/>${[396, 408, 420].map((y) => `<ellipse cx='1100' cy='${y}' rx='9' ry='3' fill='#2f2a34'/>`).join('')}`;
  })();
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#9fb0c5'/><stop offset='.5' stop-color='#cdd8e3'/><stop offset='.7' stop-color='#e9eef3'/></linearGradient>
    <linearGradient id='h' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#dfe6ee'/><stop offset='1' stop-color='#c5d0dd'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <circle cx='420' cy='250' r='44' fill='#f4f6f8' opacity='.7'/>
    <path d='${ridge(560, 220, 307)}' fill='url(#h)'/>
    <path d='${ridge(610, 120, 311)}' fill='#d3dce6' opacity='.9'/>
    <path d='M0 700 C260 660 520 640 760 650 S1200 620 1600 660 L1600 1000 L0 1000Z' fill='#eef2f6'/>
    ${pagoda}
    ${[[900, 668, 120], [960, 676, 150], [1262, 664, 140], [1330, 676, 110], [1400, 690, 160], [190, 720, 170], [270, 712, 130], [120, 736, 120]].map((p) => pine(...p)).join('')}
    <path d='M0 800 C320 770 640 790 900 780 S1350 760 1600 790 L1600 1000 L0 1000Z' fill='#f8fafc'/>
    ${[[600, 830, 190], [700, 846, 140], [1500, 840, 200]].map((p) => pine(...p)).join('')}
    <path d='M0 900 C400 880 800 900 1200 885 S1500 890 1600 900 L1600 1000 L0 1000Z' fill='#fdfefe'/>`);
})();

// a sea of cloud at sunrise, seen from high up: peaks standing out of it, the sun just up;
// the banks of cloud drift and a few birds cross ('clouds')
const cloudsea = (() => {
  const r = rng(419);
  const puffs = (y0, n, fill, o) => Array.from({ length: n }, () => {
    const x = (r() * 1700 - 50).toFixed(0), y = (y0 + r() * 60).toFixed(0), rx = (120 + r() * 160).toFixed(0), ry = (34 + r() * 30).toFixed(0);
    return `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' fill='${fill}' opacity='${o}'/>`;
  }).join('');
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#8ea3c4'/><stop offset='.42' stop-color='#d9c2cc'/><stop offset='.62' stop-color='#f3d6c3'/><stop offset='1' stop-color='#f8e6d6'/></linearGradient>
    <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#fff3df' stop-opacity='.95'/><stop offset='1' stop-color='#fff3df' stop-opacity='0'/></radialGradient>
    <linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fdf6ef'/><stop offset='1' stop-color='#efdfd6'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <circle cx='520' cy='520' r='300' fill='url(#g)'/><circle cx='520' cy='520' r='62' fill='#fff6e8'/>
    <path d='M0 650 L90 600 L170 628 L300 520 L380 590 L470 560 L560 618 L700 610 L800 540 L860 500 L930 560 L1010 530 L1120 600 L1230 470 L1300 520 L1390 500 L1480 580 L1600 560 L1600 1000 L0 1000Z' fill='#8d8fae' opacity='.75'/>
    <path d='M760 700 L860 560 L905 590 L980 470 L1040 540 L1080 520 L1180 700Z' fill='#6c6f91'/>
    <path d='M980 470 L955 510 L965 503 L972 515 L983 502 L993 511 L1006 500Z' fill='#f6efe9' opacity='.7'/>
    <path d='M1180 720 L1300 580 L1350 620 L1420 520 L1520 640 L1600 610 L1600 760Z' fill='#5c5f80'/>
    <path d='M0 740 L80 640 L150 690 L220 610 L330 740Z' fill='#64678a'/>
    ${puffs(600, 14, '#fbf2ea', 0.75)}
    <rect y='640' width='1600' height='360' fill='url(#c)'/>
    ${puffs(640, 18, '#fffaf5', 0.9)}${puffs(760, 16, '#f3e4da', 0.8)}${puffs(880, 14, '#fff8f2', 0.95)}`);
})();

// lanterns on a river at night: dark hills and an arched bridge against a deep blue sky, the
// water holding their light; lanterns rising off the water are the motion ('lanterns')
const lanterns = (() => {
  const r = rng(503);
  let stars = '';
  for (let i = 0; i < 70; i++) stars += `<circle cx='${(r() * 1600).toFixed(0)}' cy='${(r() * 460).toFixed(0)}' r='${(0.6 + r() * 1.2).toFixed(2)}' fill='#fff' opacity='${(0.2 + r() * 0.5).toFixed(2)}'/>`;
  const lantern = (x, y, s, glow = true) => `${glow ? `<circle cx='${x}' cy='${y}' r='${(s * 3.4).toFixed(1)}' fill='url(#lg)'/>` : ''}`
    + `<rect x='${(x - s * 0.7).toFixed(1)}' y='${(y - s).toFixed(1)}' width='${(s * 1.4).toFixed(1)}' height='${(s * 1.9).toFixed(1)}' rx='${(s * 0.42).toFixed(1)}' fill='url(#lf)'/>`;
  const floating = [[240, 760, 13], [430, 820, 16], [610, 744, 10], [760, 870, 18], [980, 790, 14], [1140, 900, 19], [1290, 760, 11], [1450, 840, 15], [860, 720, 8], [1360, 700, 8]];
  const rising = [[300, 420, 9], [520, 300, 7], [700, 470, 8], [930, 260, 6], [1180, 380, 8], [1400, 240, 6], [1080, 520, 9], [180, 230, 5]];
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#090f2a'/><stop offset='.5' stop-color='#1b2150'/><stop offset='.64' stop-color='#3a2c58'/></linearGradient>
    <linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1a1d42'/><stop offset='1' stop-color='#080b1e'/></linearGradient>
    <radialGradient id='lg' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffb860' stop-opacity='.55'/><stop offset='1' stop-color='#ffb860' stop-opacity='0'/></radialGradient>
    <radialGradient id='lf' cx='.5' cy='.62' r='.62'><stop offset='0' stop-color='#fff4c8'/><stop offset='.5' stop-color='#ffbd5a'/><stop offset='1' stop-color='#e2702a'/></radialGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stars}
    <path d='${ridge(600, 130, 509)}' fill='#141838'/>
    <path d='${ridge(640, 70, 521)}' fill='#0d1029'/>
    <path d='M560 646 Q800 520 1040 646 L1040 660 L1010 660 Q800 556 590 660 L560 660Z' fill='#0b0e24'/>
    <rect x='540' y='640' width='520' height='8' fill='#0b0e24'/>
    <rect y='652' width='1600' height='348' fill='url(#w)'/>
    <path d='M560 664 Q800 790 1040 664' stroke='#0f1330' stroke-width='14' fill='none' opacity='.6'/>
    ${floating.map(([x, y, s]) => `<ellipse cx='${x}' cy='${y + s * 3.2}' rx='${(s * 0.9).toFixed(1)}' ry='${(s * 4).toFixed(1)}' fill='#ffb05a' opacity='.18'/>`).join('')}
    ${floating.map(([x, y, s]) => lantern(x, y, s)).join('')}
    ${rising.map(([x, y, s]) => lantern(x, y, s)).join('')}`);
})();

/* ————— storms far off and quiet snow (2026-11-18): thunder over a sea at dusk, a storm round a
   cabin at night, a frozen lake at dawn, a cabin under a winter moon. The lightning is soft and
   seldom (a glow inside the cloud, now and then a far bolt), never a flash across the screen;
   the snow falls slowly. Motion anchored like the four weathers (see newtab.css). ————— */

// a pine in the snow: three tiers, their upper edges white (fill and snow colours per scene)
const snowyPine = (x, base, h, fill, snow) => [0, 1, 2].map((k) => {
  const w = h * (0.34 - k * 0.07), top = base - h * (0.42 + k * 0.29), bot = base - h * (k * 0.27);
  return `<path d='M${x} ${top.toFixed(1)} L${(x + w).toFixed(1)} ${bot.toFixed(1)} L${(x - w).toFixed(1)} ${bot.toFixed(1)}Z' fill='${fill}'/>`
    + `<path d='M${(x - w * 0.55).toFixed(1)} ${(top + (bot - top) * 0.62).toFixed(1)} L${x} ${top.toFixed(1)} L${(x + w * 0.55).toFixed(1)} ${(top + (bot - top) * 0.62).toFixed(1)}' stroke='${snow}' stroke-width='${Math.max(2, h / 36).toFixed(1)}' fill='none' stroke-linejoin='round' opacity='.9'/>`;
}).join('') + `<rect x='${x - 3}' y='${base}' width='6' height='${(h * 0.1).toFixed(0)}' fill='#2a2426'/>`;
// a plain dark pine, for silhouettes
const darkPine = (x, base, h, fill) => [0, 1, 2].map((k) => {
  const w = h * (0.3 - k * 0.07), top = base - h * (0.4 + k * 0.3), bot = base - h * (k * 0.28);
  return `<path d='M${x} ${top.toFixed(1)} L${(x + w).toFixed(1)} ${bot.toFixed(1)} L${(x - w).toFixed(1)} ${bot.toFixed(1)}Z' fill='${fill}'/>`;
}).join('');

// a storm far out over a calm sea at dusk: the tall cloud, a rain curtain under it, the afterglow
// low on the left, a lighthouse on the rocks; the cloud lit from inside now and then, once in a
// while a far bolt to the water, glints on the sea ('thunder')
const farstorm = (() => {
  const r = rng(601);
  let stars = '';
  for (let i = 0; i < 34; i++) stars += `<circle cx='${(r() * 820).toFixed(0)}' cy='${(r() * 280).toFixed(0)}' r='${(0.6 + r() * 1).toFixed(2)}' fill='#fff' opacity='${(0.15 + r() * 0.4).toFixed(2)}'/>`;
  const puffs = [[1080, 196, 340, 52], [930, 214, 210, 40], [1236, 206, 236, 44], [1080, 300, 172, 110], [1008, 374, 192, 112],
    [1152, 392, 186, 108], [1080, 462, 252, 104], [948, 502, 172, 72], [1226, 506, 196, 72], [1086, 538, 300, 40],
    [1182, 330, 112, 72], [978, 304, 104, 62], [1252, 444, 124, 62], [904, 446, 112, 58], [1110, 250, 120, 60]];
  const rims = [[1040, 276, 120, 60], [968, 352, 130, 62], [1020, 440, 160, 56], [900, 488, 110, 40], [880, 200, 150, 26]];
  const glints = Array.from({ length: 16 }, (_, i) => `<rect x='${(120 + r() * 560).toFixed(0)}' y='${(632 + i * 9 + r() * 6).toFixed(0)}' width='${(40 + r() * 120).toFixed(0)}' height='2' rx='1' fill='#efb79c' opacity='${(0.12 + r() * 0.22).toFixed(2)}'/>`).join('');
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1b2233'/><stop offset='.38' stop-color='#343a52'/><stop offset='.55' stop-color='#685c75'/><stop offset='.62' stop-color='#c39286'/></linearGradient>
    <linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4c4a62'/><stop offset='.3' stop-color='#302f45'/><stop offset='1' stop-color='#161827'/></linearGradient>
    <linearGradient id='cl' gradientUnits='userSpaceOnUse' x1='0' y1='140' x2='0' y2='560'><stop offset='0' stop-color='#6d6c88'/><stop offset='.55' stop-color='#45465f'/><stop offset='1' stop-color='#2b2d42'/></linearGradient>
    <linearGradient id='rc' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#33354b' stop-opacity='.85'/><stop offset='1' stop-color='#33354b' stop-opacity='.1'/></linearGradient>
    <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#f2b392' stop-opacity='.6'/><stop offset='1' stop-color='#f2b392' stop-opacity='0'/></radialGradient>
    <radialGradient id='lg' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffd88f' stop-opacity='.55'/><stop offset='1' stop-color='#ffd88f' stop-opacity='0'/></radialGradient>
    <linearGradient id='bm' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ffe2a8' stop-opacity='.1'/><stop offset='1' stop-color='#ffe2a8' stop-opacity='0'/></linearGradient>
    <filter id='soft' x='-10%' y='-20%' width='120%' height='140%'><feGaussianBlur stdDeviation='5'/></filter>
    <filter id='haze' x='-20%' y='-40%' width='140%' height='180%'><feGaussianBlur stdDeviation='12'/></filter></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stars}
    <ellipse cx='330' cy='620' rx='520' ry='170' fill='url(#g)'/>
    <path d='M902 546 L1268 546 L1236 626 L872 626Z' fill='url(#rc)' filter='url(#haze)'/>
    <g fill='url(#cl)' filter='url(#soft)'>${puffs.map(([x, y, rx, ry]) => `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}'/>`).join('')}</g>
    <g fill='#a08a98' opacity='.26' filter='url(#haze)'>${rims.map(([x, y, rx, ry]) => `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}'/>`).join('')}</g>
    <path d='M0 622 L0 602 C60 596 120 588 180 596 C240 604 300 612 360 622Z' fill='#2a2a3c'/>
    <rect y='620' width='1600' height='380' fill='url(#w)'/>
    ${glints}
    <ellipse cx='1080' cy='650' rx='280' ry='14' fill='#262839' opacity='.32' filter='url(#haze)'/>
    <path d='M246 620 L780 556 L780 700Z' fill='url(#bm)'/>
    <path d='M0 1000 L0 818 C60 798 120 804 170 790 C220 776 282 786 332 812 C384 838 424 862 472 902 C512 934 542 968 560 1000Z' fill='#11131b'/>
    <path d='M0 818 C60 798 120 804 170 790 C220 776 282 786 332 812' stroke='#2a2b3a' stroke-width='3' fill='none'/>
    <circle cx='230' cy='626' r='76' fill='url(#lg)'/>
    <path d='M203 800 L257 800 L248 652 L212 652Z' fill='#d6d0d2'/>
    <path d='M206.5 752 L253.5 752 L252.4 736 L207.6 736Z' fill='#6c5564'/><path d='M209.5 704 L250.5 704 L249.5 690 L210.5 690Z' fill='#6c5564'/>
    <rect x='224' y='716' width='12' height='14' rx='2' fill='#2a2730'/>
    <rect x='206' y='640' width='48' height='12' fill='#2a2730'/>
    <rect x='214' y='612' width='32' height='28' fill='#ffd88f'/>
    <path d='M207 613 L230 590 L253 613Z' fill='#2a2730'/>`);
})();

// a storm at night round a cabin: heavy cloud low over the hills, a meadow, the cabin's windows
// warm on the wet path, pines; rain over everything and the cloud lit from behind now and then ('storm')
const stormnight = (() => {
  const r = rng(613);
  const cloud = Array.from({ length: 30 }, () => `<ellipse cx='${(r() * 1800 - 100).toFixed(0)}' cy='${(30 + r() * 360).toFixed(0)}' rx='${(170 + r() * 220).toFixed(0)}' ry='${(46 + r() * 54).toFixed(0)}' fill='${['#2c3447', '#242b3c', '#323b50'][Math.floor(r() * 3)]}' opacity='.92'/>`).join('');
  const streaks = Array.from({ length: 70 }, () => { const x = r() * 1700, y = r() * 900; return `<path d='M${x.toFixed(0)} ${y.toFixed(0)} l-${(18 + r() * 8).toFixed(0)} ${(80 + r() * 40).toFixed(0)}'/>`; }).join('');
  const pines = [[880, 712, 150], [940, 706, 110], [1290, 712, 170], [1350, 716, 120], [140, 760, 230], [230, 752, 160], [1500, 780, 250], [60, 790, 170]];
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#121825'/><stop offset='.45' stop-color='#263045'/><stop offset='.6' stop-color='#39435b'/></linearGradient>
    <radialGradient id='wg' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffcf7f' stop-opacity='.5'/><stop offset='1' stop-color='#ffcf7f' stop-opacity='0'/></radialGradient>
    <linearGradient id='m' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4a5468' stop-opacity='0'/><stop offset='.5' stop-color='#4a5468' stop-opacity='.55'/><stop offset='1' stop-color='#4a5468' stop-opacity='0'/></linearGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    ${cloud}
    <path d='${ridge(560, 110, 617)}' fill='#1d2331'/>
    <rect y='500' width='1600' height='120' fill='url(#m)'/>
    <path d='${ridge(640, 70, 619)}' fill='#161b27'/>
    <path d='M0 1000 L0 700 C300 682 600 692 900 702 S1400 690 1600 704 L1600 1000Z' fill='#121821'/>
    <path d='M1124 760 C1110 820 1000 900 890 1000 L1020 1000 C1090 900 1142 820 1142 760Z' fill='#1d242f'/>
    ${[[1112, 800, 6, 22], [1080, 850, 8, 26], [1040, 905, 10, 30], [990, 960, 12, 30]].map(([x, y, rx, ry]) => `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' fill='#ffcf7f' opacity='.13'/>`).join('')}
    <circle cx='1097' cy='717' r='66' fill='url(#wg)'/><circle cx='1161' cy='717' r='66' fill='url(#wg)'/>
    <rect x='1166' y='648' width='14' height='34' fill='#1c191d'/>
    <rect x='1070' y='690' width='120' height='70' fill='#262327'/>
    <path d='M1054 694 L1130 638 L1206 694Z' fill='#17151a'/>
    <rect x='1086' y='708' width='22' height='18' fill='#ffcf7f'/><rect x='1150' y='708' width='22' height='18' fill='#ffcf7f'/>
    <rect x='1121' y='720' width='18' height='40' fill='#1c1a1e'/>
    <g>${pines.map(([x, b, h]) => darkPine(x, b, h, '#0c1118')).join('')}</g>
    <g stroke='#aab6c8' stroke-width='1.2' opacity='.1'>${streaks}</g>`);
})();

// a frozen lake at dawn: a soft pink sky, snowy peaks, a far line of pines, the ice pale blue,
// birches on the near bank and snowy pines; a few flakes falling slowly, mist on the ice ('snowlight')
const snowlake = (() => {
  const r = rng(631);
  const treeline = Array.from({ length: 70 }, (_, i) => {
    const x = (i / 70) * 1640 - 20 + r() * 12, h = 14 + r() * 18, b = 662 - r() * 4;
    return `<path d='M${x.toFixed(1)} ${(b - h).toFixed(1)} L${(x + h * 0.28).toFixed(1)} ${b.toFixed(1)} L${(x - h * 0.28).toFixed(1)} ${b.toFixed(1)}Z'/>`;
  }).join('');
  const birch = (x, top, w, lean) => {
    let g = `<path d='M${x - w / 2} 1000 L${x + lean - w / 3} ${top} L${x + lean + w / 3} ${top} L${x + w / 2} 1000Z' fill='#f2f1ee'/>`;
    for (let y = top + 20; y < 990; y += 26 + r() * 30) {
      const t = (y - top) / (1000 - top), cx = x + lean * (1 - t);
      g += `<rect x='${(cx - w * (0.1 + r() * 0.35)).toFixed(1)}' y='${y.toFixed(0)}' width='${(w * (0.25 + r() * 0.4)).toFixed(1)}' height='${(2 + r() * 3).toFixed(1)}' rx='1' fill='#3c3a40' opacity='.8'/>`;
    }
    for (let k = 0; k < 6; k++) {
      const y = top + 30 + k * 60 + r() * 30, t = (y - top) / (1000 - top), cx = x + lean * (1 - t), d = k % 2 ? 1 : -1, len = 30 + r() * 40;
      const ex = cx + d * len * 0.8, ey = y - len * 0.7;
      g += `<path d='M${cx.toFixed(1)} ${y.toFixed(0)} q${(d * len * 0.45).toFixed(0)} ${(-len * 0.18).toFixed(0)} ${(d * len * 0.8).toFixed(0)} ${(-len * 0.7).toFixed(0)}`
        + ` M${(cx + d * len * 0.45).toFixed(1)} ${(y - len * 0.3).toFixed(1)} l${(d * len * 0.3).toFixed(1)} ${(-len * 0.08).toFixed(1)}`
        + ` M${ex.toFixed(1)} ${ey.toFixed(1)} l${(d * 6).toFixed(0)} -10 M${ex.toFixed(1)} ${ey.toFixed(1)} l${(-d * 3).toFixed(0)} -12' stroke='#7a7680' stroke-width='1.2' fill='none' stroke-linecap='round' opacity='.75'/>`;
    }
    return g;
  };
  const streaks = Array.from({ length: 12 }, (_, i) => `<rect x='${(r() * 1400).toFixed(0)}' y='${(680 + i * 14).toFixed(0)}' width='${(140 + r() * 260).toFixed(0)}' height='2' rx='1' fill='#fff' opacity='${(0.3 + r() * 0.3).toFixed(2)}'/>`).join('');
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#aab6cf'/><stop offset='.4' stop-color='#d6cddf'/><stop offset='.58' stop-color='#f1dfdb'/><stop offset='.66' stop-color='#f7e9e2'/></linearGradient>
    <radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#fff2e4' stop-opacity='.85'/><stop offset='1' stop-color='#fff2e4' stop-opacity='0'/></radialGradient>
    <linearGradient id='ice' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e6ecf4'/><stop offset='1' stop-color='#c7d4e3'/></linearGradient>
    <filter id='soft' x='-60%' y='-30%' width='220%' height='160%'><feGaussianBlur stdDeviation='9'/></filter></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>
    <circle cx='1120' cy='560' r='260' fill='url(#g)'/><circle cx='1120' cy='560' r='44' fill='#fff6ec' opacity='.9'/>
    <path d='M0 620 L120 560 L210 590 L330 470 L430 560 L520 522 L640 600 L760 540 L860 450 L960 540 L1080 500 L1200 580 L1320 490 L1440 560 L1600 520 L1600 662 L0 662Z' fill='#c2c8dc'/>
    <path d='M330 470 L300 505 L318 500 L330 512 L344 498 L362 506Z M860 450 L828 488 L846 482 L860 494 L874 480 L894 488Z M1320 490 L1294 520 L1310 516 L1322 526 L1334 514 L1350 520Z' fill='#f7f8fc'/>
    <path d='${ridge(648, 56, 637)}' fill='#a9b2c8'/>
    <g fill='#7b879d'>${treeline}</g>
    <rect y='660' width='1600' height='200' fill='url(#ice)'/>
    <ellipse cx='1120' cy='706' rx='22' ry='48' fill='#fff3e7' opacity='.45' filter='url(#soft)'/>
    ${streaks}
    <path d='M0 1000 L0 852 C260 832 520 848 800 854 S1300 838 1600 858 L1600 1000Z' fill='#f6f8fb'/>
    <path d='M0 900 C300 884 640 902 980 892 S1400 896 1600 906' stroke='#e2e8f1' stroke-width='10' fill='none'/>
    ${birch(150, 300, 16, -18)}${birch(222, 380, 13, 10)}${birch(296, 470, 11, -8)}
    ${[[1310, 900, 200], [1410, 930, 280], [1520, 950, 330]].map(([x, b, h]) => snowyPine(x, b, h, '#3a5252', '#f6f8fb')).join('')}`);
})();

// a cabin under a winter moon: stars, moonlit hills, the cabin's windows warm on the snow, snowy
// pines; flakes catching the light as they fall, smoke from the chimney ('snownight')
const winternight = (() => {
  const r = rng(641);
  let stars = '';
  for (let i = 0; i < 90; i++) stars += `<circle cx='${(r() * 1600).toFixed(0)}' cy='${(r() * 520).toFixed(0)}' r='${(0.6 + r() * 1.2).toFixed(2)}' fill='#fff' opacity='${(0.2 + r() * 0.55).toFixed(2)}'/>`;
  const forest = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 60) * 1640 - 20 + r() * 14, h = 18 + r() * 22, b = 668 - r() * 10;
    return `<path d='M${x.toFixed(1)} ${(b - h).toFixed(1)} L${(x + h * 0.3).toFixed(1)} ${b.toFixed(1)} L${(x - h * 0.3).toFixed(1)} ${b.toFixed(1)}Z'/>`;
  }).join('');
  const pines = [[820, 742, 170], [880, 732, 120], [1180, 736, 190], [1250, 744, 140], [200, 810, 240], [300, 800, 170], [1470, 830, 270], [90, 840, 180]];
  return svg(`
    <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0a1430'/><stop offset='.45' stop-color='#1a2b52'/><stop offset='.62' stop-color='#34497a'/></linearGradient>
    <radialGradient id='h' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#d4dcf2' stop-opacity='.4'/><stop offset='1' stop-color='#d4dcf2' stop-opacity='0'/></radialGradient>
    <radialGradient id='wg' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffc66e' stop-opacity='.55'/><stop offset='1' stop-color='#ffc66e' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='1000' fill='url(#s)'/>${stars}
    <circle cx='400' cy='210' r='200' fill='url(#h)'/><circle cx='400' cy='210' r='44' fill='#f4f1e4'/>
    <circle cx='388' cy='200' r='9' fill='#e2ddcd' opacity='.6'/><circle cx='414' cy='226' r='6' fill='#e2ddcd' opacity='.5'/>
    <path d='${ridge(600, 120, 643)}' fill='#6e83ad'/>
    <path d='${ridge(664, 70, 647)}' fill='#8ea2c7'/>
    <g fill='#1c2b47'>${forest}</g>
    <path d='M0 1000 L0 722 C300 702 640 718 900 714 S1350 702 1600 728 L1600 1000Z' fill='#c3d1e9'/>
    <path d='M0 1000 L0 862 C400 842 800 872 1200 852 S1500 862 1600 872 L1600 1000Z' fill='#dae4f3'/>
    <ellipse cx='978' cy='760' rx='64' ry='13' fill='#ffc66e' opacity='.2'/><ellipse cx='1062' cy='760' rx='64' ry='13' fill='#ffc66e' opacity='.2'/>
    <circle cx='978' cy='698' r='70' fill='url(#wg)'/><circle cx='1062' cy='698' r='70' fill='url(#wg)'/>
    <rect x='1060' y='622' width='14' height='34' fill='#3a2d2a'/><rect x='1057' y='617' width='20' height='6' rx='2' fill='#eef3fb'/>
    <rect x='950' y='670' width='140' height='64' fill='#3a2d2a'/>
    <path d='M934 674 L1020 618 L1106 674Z' fill='#2a2024'/>
    <path d='M930 672 L1020 612 L1110 672 L1104 679 L1020 623 L936 679Z' fill='#eef3fb'/>
    <rect x='966' y='688' width='24' height='20' fill='#ffc66e'/><rect x='1050' y='688' width='24' height='20' fill='#ffc66e'/>
    <rect x='1008' y='694' width='22' height='40' fill='#2a2024'/>
    ${Array.from({ length: 7 }, (_, i) => `<ellipse cx='${1012 - i * 34 + (i % 2) * 10}' cy='${752 + i * 22}' rx='5' ry='3' fill='#9fb0d0'/>`).join('')}
    ${pines.map(([x, b, h]) => snowyPine(x, b, h, '#1b2a3e', '#e8eef8')).join('')}`);
})();

export const WALLPAPERS = [
  { id: 'mist', label: 'Mist', tone: 'light', css: mist, motion: 'mist' },
  { id: 'lake', label: 'Lake', tone: 'light', css: lake, motion: 'mist' },
  { id: 'sand', label: 'Garden', tone: 'light', css: sand, motion: 'dapple' },
  { id: 'enso', label: 'Ensō', tone: 'light', css: enso, motion: 'motes' },
  { id: 'bamboo', label: 'Bamboo', tone: 'light', css: bamboo, motion: 'leaves' },
  { id: 'sakura', label: 'Sakura', tone: 'light', css: sakura, motion: 'petals' },
  { id: 'dunes', label: 'Dunes', tone: 'light', css: dunes, motion: 'sand' },
  { id: 'ocean', label: 'Ocean', tone: 'light', css: ocean, motion: 'waves' },
  { id: 'dusk', label: 'Dusk', tone: 'dark', css: dusk, motion: 'fireflies' },
  { id: 'forest', label: 'Forest', tone: 'dark', css: forest, motion: 'fireflies' },
  { id: 'night', label: 'Night', tone: 'dark', css: night, motion: 'stars' },
  { id: 'aurora', label: 'Aurora', tone: 'dark', css: aurora, motion: 'aurora' },
  // round five: two musical scenes and two of the Buddha, each with motion tied to the picture
  { id: 'nocturne', label: 'Nocturne', tone: 'dark', css: nocturne, motion: 'candle' },
  { id: 'serenade', label: 'Serenade', tone: 'light', css: serenade, motion: 'notes' },
  { id: 'lotus', label: 'Lotus', tone: 'dark', css: lotus, motion: 'ripples' },
  { id: 'shrine', label: 'Shrine', tone: 'light', css: shrine, motion: 'incense' },
  // four quiet weathers: rain on a pond, snow on a temple hill, a sea of cloud, lanterns at night
  { id: 'rain', label: 'Rain', tone: 'dark', css: rain, motion: 'rain' },
  { id: 'snowfall', label: 'Snowfall', tone: 'light', css: snowfall, motion: 'snow' },
  { id: 'cloudsea', label: 'Cloud sea', tone: 'light', css: cloudsea, motion: 'clouds' },
  { id: 'lanterns', label: 'Lanterns', tone: 'dark', css: lanterns, motion: 'lanterns' },
  // storms far off and quiet snow: thunder over a dusk sea, a storm round a cabin, a frozen lake, a winter moon
  { id: 'farstorm', label: 'Far storm', tone: 'dark', css: farstorm, motion: 'thunder' },
  { id: 'stormnight', label: 'Storm night', tone: 'dark', css: stormnight, motion: 'storm' },
  { id: 'snowlake', label: 'Snow lake', tone: 'light', css: snowlake, motion: 'snowlight' },
  { id: 'winternight', label: 'Winter night', tone: 'dark', css: winternight, motion: 'snownight' },
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
  while (dataUrl.length > 1_600_000 && q > 0.4) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q); }
  return { dataUrl, tone: lum > 0.58 ? 'light' : 'dark' };
}

// the CSS background + tone for a setting id (custom needs the stored images, passed in)
export function wallpaperFor(id, custom = null) {
  const own = id === 'custom' ? activeOwn(custom) : null;   // custom: the stored images (any shape); the active one shows
  if (own) return { css: `url("${own.dataUrl}") center / cover no-repeat`, tone: own.tone === 'light' ? 'light' : 'dark', motion: 'bokeh' };
  if (id === 'theme') return { css: 'none', tone: 'theme', motion: 'glow' };
  const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS.find((x) => x.id === DEFAULT_WALLPAPER);
  return { css: `${w.css} center / cover no-repeat`, tone: w.tone, motion: w.motion || 'bokeh' };
}
