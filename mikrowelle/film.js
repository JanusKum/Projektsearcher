// HEISS UND KALT · Thermal Camera · 1080×1920 @ 30 fps. 2D: one heat model → a simulated 120×213-class sensor → iron palette.
// Every temperature on screen is read from the same sensor buffer that is coloured.
const W = 1080, H = 1920, FPS = 30, DUR = 32.4;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const T = {
  scan0: 2.2, scan1: 3.8,                 // visible → heat
  exp0: 6.6, heat0: 7.0, heat1: 13.0,     // turntable off: a flat layer heats up (60 s shown in 6 s)
  iso: 12.2, meas: 14.2,                  // isotherm fires; distance between two hot spots
  rot0: 18.2, rheat0: 18.6, rheat1: 23.0, // turntable on: the same blob turns and heats (120 s in 4.4 s)
  cmp: 23.4, verdict: 26.4,               // same scale, two times
  back0: 29.2, back1: 30.8,               // scan back to the ordinary picture
};
const VO = [{ id: 'v1', t: 0.45 }, { id: 'v2', t: 6.7 }, { id: 'v3', t: 9.6 }, { id: 'v4', t: 14.0 }, { id: 'v5', t: 18.3 }, { id: 'v6', t: 23.5 }];
const CUES = [
  [0.45, 2.6, 'Zwei Minuten Mikrowelle.'], [2.6, 4.6, 'Außen kochend heiß, in der Mitte eiskalt.'], [4.6, 6.5, 'Warum?'],
  [6.7, 9.4, 'Schuld ist eine Welle, die stillsteht.'],
  [9.6, 11.4, 'Ohne Drehteller siehst du sie:'], [11.4, 13.9, 'heiße Punkte und kalte Lücken.'],
  [14.0, 15.9, 'Immer sechs Zentimeter auseinander.'], [15.9, 18.1, 'Eine halbe Wellenlänge.'],
  [18.3, 20.6, 'Der Drehteller schiebt dein Essen durch diese Punkte.'], [20.6, 23.3, 'Nur die Mitte bewegt sich nicht.'],
  [23.5, 25.4, 'Darum bleibt sie kalt.'], [25.4, 28.6, 'Leg dein Essen als Ring, dann wird alles heiß.'],
];

// —— physics ——
const HALF = 6.12;                                   // λ/2 at 2.45 GHz: c / f / 2 = 6.12 cm
const T_FRIDGE = 6, T_ROOM = 21, RATE = 3.0;        // °C per second at a full antinode
// the field's heating pattern in the oven's frame: antinodes every λ/2, the centre of the turntable on a node
function Q(x, y) {
  const a = Math.sin(Math.PI * x / HALF), b = Math.sin(Math.PI * y / HALF);
  const u = 0.866 * x + 0.5 * y, v = -0.5 * x + 0.866 * y, c = Math.sin(Math.PI * u / 8.6), d = Math.sin(Math.PI * v / 8.6);   // a second cavity mode
  return 0.7 * a * a * b * b + 0.3 * c * c * d * d;
}
const soft = T => T < 92 ? T : 92 + (T - 92) * 0.25 / (1 + (T - 92) * 0.05);   // water stops near boiling
// food shapes (cm, centred on the plate)
const hashN = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function blobR(a) { return 8.3 + 0.7 * Math.sin(3 * a + 0.6) + 0.45 * Math.sin(5 * a + 2.1) + 0.3 * Math.sin(8 * a); }
function food(kind, x, y) {   // 0..1 coverage
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  if (kind === 'blob') return clamp((blobR(a) - r) / 0.5 + 0.5);
  if (kind === 'ring') { const ro = 10.0 + 0.35 * Math.sin(4 * a + 1), ri = 3.1 + 0.25 * Math.sin(3 * a); return clamp(Math.min(ro - r, r - ri) / 0.5 + 0.5); }
  if (kind === 'layer') return clamp(Math.min(15 - Math.abs(x), 25 - Math.abs(y)) / 0.5 + 0.5);
  return 0;
}
// temperature of a food point after `sec` seconds of heating; rotating: ω = one turn in 10 s
function heatAt(x, y, sec, rotating) {
  if (sec <= 0) return T_FRIDGE;
  if (!rotating) return soft(T_FRIDGE + RATE * Q(x, y) * sec);
  const N = 40, w = 2 * Math.PI / 10; let s = 0;
  for (let i = 0; i < N; i++) { const th = w * sec * (i + 0.5) / N, c = Math.cos(th), sn = Math.sin(th); s += Q(c * x - sn * y, sn * x + c * y); }
  return soft(T_FRIDGE + RATE * (s / N) * sec * (1 + 0.15 * (hashN(x * 3, y * 3) - 0.5)));
}

// —— the sensor: 120 × 213 pixels over 36 × 64 cm (0.3 cm per pixel), then blown up ——
const SW = 120, SH = 213, CM = 36 / SW;
const sens = new Float32Array(SW * SH);
const scv = document.createElement('canvas'); scv.width = SW; scv.height = SH; const SC = scv.getContext('2d'); const IMG = SC.createImageData(SW, SH);
const IRON = ['#000008', '#120554', '#4D0894', '#991294', '#DB3352', '#FA7812', '#FFBF21', '#FFFADB'].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const LUT = Array.from({ length: 256 }, (_, i) => { const u = i / 255 * 7, k = Math.min(6, Math.floor(u)), f = u - k; return IRON[k].map((c, j) => Math.round(c + (IRON[k + 1][j] - c) * f)); });
function rnd(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const COLPAT = (() => { const r = rnd(5); return Array.from({ length: SW }, () => (r() - 0.5) * 0.35); })();
// scene → °C for one sensor pixel (world cm): plates on a counter
function sceneT(sc, x, y, t) {
  for (const p of sc.plates) {
    let dx = x - p.x, dy = y - p.y; const r = Math.hypot(dx, dy);
    if (p.ang) { const c = Math.cos(-p.ang), sn = Math.sin(-p.ang); [dx, dy] = [c * dx - sn * dy, sn * dx + c * dy]; }   // into the food's own frame
    const f = food(p.food, dx, dy);
    if (f > 0) { const Tf = heatAt(dx, dy, p.sec, p.rot); return lerp(p.plateT(r), Tf, f); }
    if (r < 13) return p.plateT(r);
  }
  return T_ROOM - 0.6 + 0.4 * Math.sin(x * 0.2 + y * 0.13);   // the counter
}
function sense(sc, t, frame) {
  const r = rnd(frame * 7919 + 3);
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const x = (i + 0.5) * CM - 18, y = (j + 0.5) * CM - 32;
    // 2×2 supersample against moiré, then the optics blur comes from the upscale
    let s = 0; for (const [ox, oy] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) s += sceneT(sc, x + ox * CM, y + oy * CM, t);
    const shade = -0.6 * (((i / SW - .5) ** 2 + (j / SH - .5) ** 2) * 2);
    sens[j * SW + i] = s / 4 + shade + COLPAT[i] + (r() - 0.5) * 0.3;
  }
}
function paint(lo, hi, iso = null) {
  const d = IMG.data;
  for (let k = 0; k < SW * SH; k++) {
    const v = sens[k]; let c;
    if (iso != null && v >= iso) c = [43, 209, 74];
    else c = LUT[Math.round(clamp((v - lo) / (hi - lo)) * 255)];
    d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255;
  }
  SC.putImageData(IMG, 0, 0);
}
const readAt = (x, y) => { const i = clamp(Math.floor((x + 18) / CM), 0, SW - 1), j = clamp(Math.floor((y + 32) / CM), 0, SH - 1); let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < SW && jj < SH) { s += sens[jj * SW + ii]; n++; } } return s / n; };
function boxStat(x0, y0, x1, y1, mask = () => true) { let mx = -1e9, mn = 1e9, s = 0, n = 0, mp = [0, 0];
  for (let j = Math.floor((y0 + 32) / CM); j < Math.floor((y1 + 32) / CM); j++) for (let i = Math.floor((x0 + 18) / CM); i < Math.floor((x1 + 18) / CM); i++) { if (i < 0 || j < 0 || i >= SW || j >= SH) continue; if (!mask((i + .5) * CM - 18, (j + .5) * CM - 32)) continue; const v = sens[j * SW + i]; s += v; n++; if (v > mx) { mx = v; mp = [(i + .5) * CM - 18, (j + .5) * CM - 32]; } if (v < mn) mn = v; }
  return { max: mx, min: mn, avg: s / Math.max(1, n), at: mp }; }
// a hot spot's centre, refined: search the buffer around a seed, then a weighted centroid of the top pixels
function peakNear(x, y, rcm = 2.4) { let best = -1e9, bi = 0, bj = 0; const ci = Math.floor((x + 18) / CM), cj = Math.floor((y + 32) / CM), R = Math.round(rcm / CM);
  for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) { if (i < 1 || j < 1 || i >= SW - 1 || j >= SH - 1) continue; const v = sens[j * SW + i]; if (v > best) { best = v; bi = i; bj = j; } }
  let sx = 0, sy = 0, sw = 0; for (let j = bj - 3; j <= bj + 3; j++) for (let i = bi - 3; i <= bi + 3; i++) { const v = sens[j * SW + i] - (best - 6); if (v > 0) { sx += v * i; sy += v * j; sw += v; } }
  return [(sx / sw + .5) * CM - 18, (sy / sw + .5) * CM - 32, best]; }

// —— screen ——
const out = document.getElementById('c'), O = out.getContext('2d');
const VIEW = { x: 0, y: 0, w: W, h: H };        // the sensor fills the frame (36 × 64 cm → 1080 × 1920: 30 px per cm)
const PX = W / 36, w2s = (x, y) => [(x + 18) * PX, (y + 32) * PX];
const MONO = px => `500 ${px}px "IBM Plex Mono"`, SANS = (px, w = 600) => `${w} ${px}px Inter`;

// the ordinary picture (visible light): a plate on a dark counter, lit from the upper left
function visible(g, sc) {
  g.fillStyle = '#2a1c14'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(${k % 2 ? 70 : 20},${k % 2 ? 46 : 12},${k % 2 ? 30 : 8},0.35)`; g.lineWidth = 3 + (k % 5); g.beginPath(); const y0 = k * 52 + 10 * Math.sin(k); g.moveTo(0, y0); g.bezierCurveTo(300, y0 + 18 * Math.sin(k * 1.7), 700, y0 - 14, W, y0 + 8 * Math.cos(k)); g.stroke(); }
  const lg = g.createRadialGradient(W * .2, H * .15, 100, W * .4, H * .4, 1700); lg.addColorStop(0, 'rgba(255,220,170,.22)'); lg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
  for (const p of sc.plates) {
    const [cx, cy] = w2s(p.x, p.y), R = 13 * PX;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx + 18, cy + 26, R, R, 0, 0, 7); g.fill();
    let pg = g.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R); pg.addColorStop(0, '#fbfaf6'); pg.addColorStop(.8, '#e7e3da'); pg.addColorStop(1, '#bdb6a8');
    g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = 'rgba(150,140,125,.55)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R * .78, 0, 7); g.stroke();
    // the food: mashed potatoes, a pale yellow with soft peaks
    g.save(); g.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2; let r; if (p.food === 'ring') r = 10.0 + .35 * Math.sin(4 * a + 1); else r = blobR(a); const [x, y] = w2s(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    if (p.food === 'ring') { for (let i = 120; i >= 0; i--) { const a = i / 120 * Math.PI * 2, r = 3.1 + .25 * Math.sin(3 * a); const [x, y] = w2s(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); g.lineTo(x, y); } }
    g.closePath(); g.clip('evenodd');
    const fg = g.createRadialGradient(cx - R * .25, cy - R * .3, 10, cx, cy, R * .85); fg.addColorStop(0, '#fff3c4'); fg.addColorStop(.7, '#efd690'); fg.addColorStop(1, '#c9a75a'); g.fillStyle = fg; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const r2 = rnd(p.seed || 1); for (let k = 0; k < 260; k++) { const a = r2() * 7, d = r2() * R * .8, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; g.fillStyle = r2() < .5 ? 'rgba(255,250,225,.55)' : 'rgba(160,120,50,.22)'; g.beginPath(); g.ellipse(x, y, 6 + r2() * 14, 3 + r2() * 6, r2() * 3, 0, 7); g.fill(); }
    g.restore();
  }
}

// —— instruments ——
function scaleBar(lo, hi) {
  const x = W - 74, y0 = 330, y1 = 1330;
  O.save(); O.fillStyle = 'rgba(0,0,0,.55)'; O.fillRect(x - 14, y0 - 60, 76, y1 - y0 + 120);
  for (let k = 0; k < 256; k++) { const c = LUT[k]; O.fillStyle = `rgb(${c})`; O.fillRect(x, y1 - (k + 1) * (y1 - y0) / 256, 30, (y1 - y0) / 256 + 1); }
  O.font = MONO(24); O.fillStyle = '#fff'; O.textAlign = 'right'; O.shadowColor = '#000'; O.shadowBlur = 6;
  O.fillText(`${hi.toFixed(0)}°`, x + 44, y0 - 18); O.fillText(`${lo.toFixed(0)}°`, x + 44, y1 + 40); O.restore();
}
function stamp(t) {
  const s = 18 * 3600 + 42 * 60 + 7 + Math.floor(t), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
  O.save(); O.font = MONO(24); O.fillStyle = '#fff'; O.shadowColor = '#000'; O.shadowBlur = 6;
  O.fillText(`25.11.2026  ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}   ε 0.95`, 40, 70); O.restore();
}
const readNum = (v, t) => (Math.round(v * 10) / 10 + (Math.floor(t * 6) % 2 ? 0 : 0.1)).toFixed(1).replace('.', ',');   // last digit flickers at 6 Hz
function spot(x, y, v, t, k, label, side = 1) {
  if (k <= 0) return; const [sx, sy] = w2s(x, y), r = lerp(70, 22, eo(k));
  O.save(); O.globalAlpha = clamp(k * 2); O.strokeStyle = '#fff'; O.lineWidth = 3; O.shadowColor = '#000'; O.shadowBlur = 8;
  O.beginPath(); O.moveTo(sx - r, sy); O.lineTo(sx - 8, sy); O.moveTo(sx + 8, sy); O.lineTo(sx + r, sy); O.moveTo(sx, sy - r); O.lineTo(sx, sy - 8); O.moveTo(sx, sy + 8); O.lineTo(sx, sy + r); O.stroke();
  const shown = lerp(T_ROOM, v, eo(seg(k, .3, 1)));
  O.font = MONO(38); O.fillStyle = '#fff'; O.textAlign = side > 0 ? 'left' : 'right'; O.fillText(`${readNum(shown, t)} °C`, sx + side * 36, sy - 14);
  O.font = SANS(22); O.fillText(label, sx + side * 36, sy + 22); O.restore();
}
function label(x, y, lx, ly, tag, k) {
  if (k <= 0) return; const [sx, sy] = w2s(x, y);
  O.save(); O.globalAlpha = clamp(k * 2); O.strokeStyle = '#fff'; O.lineWidth = 2.5; O.shadowColor = '#000'; O.shadowBlur = 8;
  O.beginPath(); O.moveTo(sx, sy); O.lineTo(lx, ly); O.stroke(); O.font = SANS(30); O.fillStyle = '#fff'; O.textAlign = lx > sx ? 'left' : 'right'; O.fillText(tag, lx + (lx > sx ? 10 : -10), ly + 10); O.restore();
}
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  O.save(); let fs = 42; O.font = SANS(fs, 600); let w = O.measureText(c[2]).width; if (w > 920) { fs = Math.floor(fs * 920 / w); O.font = SANS(fs, 600); w = O.measureText(c[2]).width; }
  const y = 1760, k = eo(seg(t, c[0], c[0] + .15));
  O.globalAlpha = k; O.fillStyle = 'rgba(0,0,0,.72)'; O.beginPath(); O.roundRect((W - w) / 2 - 30, y - fs - 16, w + 60, fs + 40, 16); O.fill();
  O.fillStyle = '#fff'; O.textAlign = 'center'; O.fillText(c[2], W / 2, y); O.restore();
}

// —— scenes ——
const plateT = r => 24 + 2.5 * Math.exp(-((r - 8) ** 2) / 8);
function sceneAt(t) {
  if (t < T.exp0) return { plates: [{ x: 0, y: -2, food: 'blob', sec: 120, rot: true, plateT, seed: 3 }] };
  if (t < T.rot0) { const sec = 60 * eio(seg(t, T.heat0, T.heat1)); return { plates: [{ x: 0, y: 0, food: 'layer', sec, rot: false, plateT: () => T_ROOM }], layer: true, sec }; }
  if (t < T.cmp) { const sec = 120 * seg(t, T.rheat0, T.rheat1), ang = (2 * Math.PI / 10) * sec; return { plates: [{ x: 0, y: -2, food: 'blob', sec, rot: true, plateT, seed: 3, ang }], sec, turn: ang }; }
  return { plates: [{ x: 0, y: -17, food: 'blob', sec: 120, rot: true, plateT, seed: 3 }, { x: 0, y: 13, food: 'ring', sec: 120, rot: true, plateT, seed: 9 }] };
}
const vcv = document.createElement('canvas'); vcv.width = W; vcv.height = H; const VG = vcv.getContext('2d');
function frame(t) {
  const fr = Math.round(t * FPS), sc = sceneAt(t);
  // the turntable: in the rotating shot the food turns on screen too (the heat pattern is computed in the food's own frame)
  const turn = sc.turn != null ? sc.turn : 0;
  O.setTransform(1, 0, 0, 1, 0, 0); O.fillStyle = '#000'; O.fillRect(0, 0, W, H);
  sense(sc, t, fr);
  // scale: wide for the overview, the same locked scale for the comparison
  const lo = 0, hi = 100;
  const iso = (t > T.iso && t < T.rot0) ? 55 : null;
  paint(lo, hi, iso);
  // composite: thermal everywhere, the visible picture where the scan line hasn't passed yet (or has passed back)
  const scanIn = seg(t, T.scan0, T.scan1), scanOut = seg(t, T.back0, T.back1);
  O.imageSmoothingEnabled = true; O.imageSmoothingQuality = 'high';
  O.drawImage(scv, 0, 0, W, H);
  const visCut = t < T.scan1 ? H * (1 - scanIn) : t > T.back0 ? H * (1 - scanOut) : -1;   // visible below this y? (scan runs bottom → top)
  if (visCut >= 0) {
    const vsc = t < T.exp0 ? sc : { plates: [{ x: 0, y: 16, food: 'ring', seed: 9 }] };
    visible(VG, t > T.back0 ? { plates: [{ x: 0, y: -17, food: 'blob', seed: 3 }, { x: 0, y: 13, food: 'ring', seed: 9 }] } : vsc);
    if (t < T.scan1) { O.drawImage(vcv, 0, 0, W, visCut, 0, 0, W, visCut); }
    else { O.drawImage(vcv, 0, visCut, W, H - visCut, 0, visCut, W, H - visCut); }
    if ((t > T.scan0 && t < T.scan1) || (t > T.back0 && t < T.back1)) { O.fillStyle = '#fff'; O.fillRect(0, visCut - 2, W, 4); const gl = O.createLinearGradient(0, visCut, 0, visCut + 80); gl.addColorStop(0, 'rgba(255,170,60,.35)'); gl.addColorStop(1, 'rgba(255,170,60,0)'); O.fillStyle = gl; O.fillRect(0, visCut, W, 80); }
  }
  const thermalShown = !(t < T.scan0 || t > T.back1);
  if (thermalShown) { scaleBar(lo, hi); }
  stamp(t);

  // 1 · spot meters on the rim and the centre
  if (t > T.scan1 && t < T.exp0 - 0.2) {
    const hot = peakNear(-3.4, -5.0, 1.6), mid = [0, -2];
    spot(hot[0], hot[1], hot[2], t, seg(t, T.scan1, T.scan1 + .5), 'AUSSEN', -1);
    spot(mid[0], mid[1], readAt(...mid), t, seg(t, T.scan1 + .5, T.scan1 + 1.0), 'MITTE', 1);
  }
  // 2–3 · turntable off: a heating layer, live timer; isotherm at 55 °C
  if (sc.layer) {
    O.save(); O.font = MONO(30); O.fillStyle = '#fff'; O.shadowColor = '#000'; O.shadowBlur = 8;
    O.fillText('DREHTELLER AUS', 40, 140); O.fillText(`t = ${Math.round(sc.sec)} s   f = 2,45 GHz`, 40, 186);
    if (iso) { O.fillStyle = '#2BD14A'; O.fillText('ISOTHERME > 55 °C', 40, 232); }
    O.restore();
    // 4 · two neighbouring hot spots, found in the buffer; the distance between them measured
    if (t > T.meas) {
      const k = eo(seg(t, T.meas, T.meas + .6));
      const a = peakNear(HALF * 0.5, HALF * 0.5), b = peakNear(HALF * 1.5, HALF * 0.5);
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const [ax, ay] = w2s(a[0], a[1]), [bx, by] = w2s(b[0], b[1]);
      O.save(); O.globalAlpha = k; O.strokeStyle = '#fff'; O.lineWidth = 3; O.shadowColor = '#000'; O.shadowBlur = 8;
      for (const [x, y] of [[ax, ay], [bx, by]]) { O.beginPath(); O.moveTo(x, y - 22); O.lineTo(x - 18, y - 52); O.lineTo(x + 18, y - 52); O.closePath(); O.fillStyle = '#fff'; O.fill(); }
      const yy = ay + 90; O.beginPath(); O.moveTo(ax, yy); O.lineTo(ax + (bx - ax) * k, yy); O.moveTo(ax, yy - 16); O.lineTo(ax, yy + 16); if (k > .95) { O.moveTo(bx, yy - 16); O.lineTo(bx, yy + 16); } O.stroke();
      O.font = MONO(40); O.fillStyle = '#fff'; O.textAlign = 'center'; O.fillText(`${d.toFixed(1).replace('.', ',')} cm`, (ax + bx) / 2, yy + 56);
      O.font = SANS(26); O.fillText('≈ λ/2', (ax + bx) / 2, yy + 92); O.restore();
    }
  }
  // 5 · turntable on: label, timer, the centre meter rides along (it stays cold)
  if (sc.turn != null) {
    O.save(); O.font = MONO(30); O.fillStyle = '#fff'; O.shadowColor = '#000'; O.shadowBlur = 8;
    O.fillText('DREHTELLER AN', 40, 140); O.fillText(`t = ${Math.round(sc.sec)} s`, 40, 186); O.restore();
    spot(0, -2, readAt(0, -2), t, seg(t, T.rheat0 + 1.2, T.rheat0 + 1.8), 'MITTE', 1);
    const rx = -4.4 * Math.cos(turn), ry = -2 - 4.4 * Math.sin(turn);   // a point of the food 4.4 cm out, riding the turntable
    spot(rx, ry, readAt(rx, ry), t, seg(t, T.rheat0 + 1.8, T.rheat0 + 2.4), 'AUSSEN', -1);
  }
  // 6 · same scale, two times: box statistics on each plate, the verdict on the ring
  if (t >= T.cmp && t < T.back0 + 0.3) {
    for (const [p, y, name, kind] of [[0, -17, 'HAUFEN', 'blob'], [1, 13, 'RING', 'ring']]) {
      const k = seg(t, T.cmp + .3 + p * .5, T.cmp + .9 + p * .5); if (k <= 0) continue;
      const st = boxStat(-11, y - 11, 11, y + 11, (x, yy) => food(kind, x, yy - y) > 0.95), [bx, by] = w2s(-11, y - 11), bw = 22 * PX;
      O.save(); O.globalAlpha = k; O.strokeStyle = (p === 1 && t > T.verdict) ? '#7DFFA0' : '#fff'; O.lineWidth = (p === 1 && t > T.verdict) ? 7 : 3; O.shadowColor = '#000'; O.shadowBlur = 8;
      O.strokeRect(bx, by, bw, bw); O.font = MONO(30); O.fillStyle = '#fff';
      O.fillText(`${name}   min ${st.min.toFixed(0)}°  max ${st.max.toFixed(0)}°`, bx, by - 18); O.restore();
    }
    if (t > T.verdict) { O.save(); O.globalAlpha = seg(t, T.verdict, T.verdict + .4); O.font = SANS(34, 700); O.fillStyle = '#7DFFA0'; O.shadowColor = '#000'; O.shadowBlur = 8; const [, y] = w2s(0, -1); O.textAlign = 'center'; O.fillText('ÜBERALL HEISS ↓', W / 2, y + 12); O.restore(); }
  }
  subtitle(t);
}
window.render = frame;
window.DUR = DUR;
window.EV = [
  { t: 0.0, type: 'ding' }, { t: 0.0, type: 'fan', d: DUR },
  { t: T.scan0, type: 'scan', d: T.scan1 - T.scan0 }, { t: T.scan1 + .1, type: 'lock' }, { t: T.scan1 + .6, type: 'lock' },
  { t: T.exp0, type: 'nuc' }, { t: T.heat0, type: 'oven', d: T.heat1 - T.heat0 },
  { t: T.iso, type: 'alarm' }, { t: T.meas, type: 'lock' }, { t: T.meas + .6, type: 'lock' },
  { t: T.rot0, type: 'nuc' }, { t: T.rheat0, type: 'oven', d: T.rheat1 - T.rheat0 }, { t: T.rheat0, type: 'motor', d: T.rheat1 - T.rheat0 },
  { t: T.rheat1, type: 'ding' },
  { t: T.cmp, type: 'click' }, { t: T.verdict, type: 'verdict' },
  { t: T.back0, type: 'scan', d: T.back1 - T.back0 },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([document.fonts.load('500 24px "IBM Plex Mono"'), document.fonts.load('600 30px Inter')]).then(() => { frame(0); window.READY = true; });
