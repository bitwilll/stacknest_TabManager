// Zen wallpapers — drawn here as SVG, so they ship inside the extension, cost no network and
// stay sharp at any size. Each is a CSS background value; `tone` says whether the picture is
// light or dark, so Zen can set its clock and captions in the ink that reads on it, and
// `motion` names the slow animation Zen lays over it (drifting mist, petals, stars… — see the
// .zen-fx rules in newtab.css; Settings → Zen → Animate the wallpaper turns it off).
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

export const WALLPAPERS = [
  { id: 'mist', label: 'Mist', tone: 'light', css: mist, motion: 'mist' },
  { id: 'lake', label: 'Lake', tone: 'light', css: lake, motion: 'mist' },
  { id: 'sand', label: 'Garden', tone: 'light', css: sand, motion: 'drift' },
  { id: 'enso', label: 'Ensō', tone: 'light', css: enso, motion: 'drift' },
  { id: 'bamboo', label: 'Bamboo', tone: 'light', css: bamboo, motion: 'leaves' },
  { id: 'sakura', label: 'Sakura', tone: 'light', css: sakura, motion: 'petals' },
  { id: 'dunes', label: 'Dunes', tone: 'light', css: dunes, motion: 'drift' },
  { id: 'ocean', label: 'Ocean', tone: 'light', css: ocean, motion: 'waves' },
  { id: 'dusk', label: 'Dusk', tone: 'dark', css: dusk, motion: 'fireflies' },
  { id: 'forest', label: 'Forest', tone: 'dark', css: forest, motion: 'fireflies' },
  { id: 'night', label: 'Night', tone: 'dark', css: night, motion: 'stars' },
  { id: 'aurora', label: 'Aurora', tone: 'dark', css: aurora, motion: 'aurora' },
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
  if (id === 'custom' && custom?.dataUrl) return { css: `url("${custom.dataUrl}") center / cover no-repeat`, tone: custom.tone === 'light' ? 'light' : 'dark', motion: 'drift' };
  if (id === 'theme') return { css: 'none', tone: 'theme', motion: 'none' };
  const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS.find((x) => x.id === DEFAULT_WALLPAPER);
  return { css: `${w.css} center / cover no-repeat`, tone: w.tone, motion: w.motion || 'drift' };
}
