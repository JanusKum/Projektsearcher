// SCHWARZES LOCH · Firefly Pointillism · 1080×1920 · 60 fps. One fixed pool of soft points; every point is always something.
const W = 1080, H = 1920, DUR = 32;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = k => { k = clamp(k); return k * k * k * (k * (k * 6 - 15) + 10); };   // smootherstep
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(7);
// colours (linear) — one warm family; each character keeps its colour
const COL = { me: [1.0, .74, .34], friend: [.78, 1.0, .46], fly: [.86, 1.0, .40], star: [.86, .90, 1.0], disk: [1.0, .66, .30], diskHot: [1.0, .9, .62], title: [1.0, .90, .58], ember: [.7, .3, .08] };
const BH = { x: 540, y: 1180, rh: 120, rin: 175, rout: 470, sq: .26 };   // the hole's shadow radius, disk radii, tilt squash
const T = { form: [0.2, 2.6], fall: 4.2, stretch: [4.6, 8.2], strand: [8.2, 13.2], t1: [9.6, 10.6], t1out: 13.4, back: [13.8, 15.4], slow: 14.0, fade: [20.0, 25.6], dive: [26.0, 28.6], t2: [28.4, 29.6], end: 32 };
const VO = [{ id: 'v1', t: .6 }, { id: 'v2', t: 4.4 }, { id: 'v3', t: 8.0 }, { id: 'v4', t: 14.0 }, { id: 'v5', t: 20.2 }, { id: 'v6', t: 26.6 }];
const CUES = [
  [.6, 3.8, 'Stell dir vor, du fällst in ein Schwarzes Loch.'],
  [4.4, 7.6, 'An deinen Füßen zieht es stärker als an deinem Kopf.'],
  [8.0, 10.3, 'Du wirst lang gezogen wie Spaghetti.'], [10.3, 13.4, 'Forscher nennen das wirklich Spaghettifizierung.'],
  [14.0, 16.6, 'Doch deine Freunde draußen sehen etwas noch Seltsameres:'], [16.6, 19.6, 'Du wirst immer langsamer.'],
  [20.2, 22.4, 'Am Rand bleibst du für sie stehen.'], [22.4, 25.6, 'Wirst immer röter. Und verblasst.'],
  [26.6, 29.6, 'Und du selbst? Du fällst einfach weiter.'],
];

// —— shapes ——
function capsulePts(ax, ay, bx, by, r, nOut, nIn, arr, part, u0, u1) {
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, px = -uy, py = ux;
  for (let i = 0; i < nOut; i++) { const s = R() * (L + Math.PI * r), side = R() < .5 ? 1 : -1;
    let x, y; if (s < L) { x = ax + ux * s + px * r * side; y = ay + uy * s + py * r * side; } else { const a = (s - L) / r + (side > 0 ? 0 : Math.PI); const e = R() < .5; const cx = e ? bx : ax, cy = e ? by : ay; x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r; }
    arr.push({ x, y, part, edge: 1 }); }
  for (let i = 0; i < nIn; i++) { const s = R() * L, w = (R() * 2 - 1) * r * .8; arr.push({ x: ax + ux * s + px * w, y: ay + uy * s + py * w, part, edge: 0 }); }
}
function ellipsePts(cx, cy, rx, ry, nOut, nIn, arr, part) {
  for (let i = 0; i < nOut; i++) { const a = R() * 6.283; arr.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, part, edge: 1 }); }
  for (let i = 0; i < nIn; i++) { const a = R() * 6.283, r = Math.sqrt(R()) * .85; arr.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r, part, edge: 0 }); }
}
// the astronaut (local units: px at scale 1, height ≈ 360, origin at the hips); parts: 0 body, 1 left arm, 2 right arm, 3 legs
function astronaut() {
  const a = [];
  ellipsePts(0, -150, 52, 50, 150, 40, a, 0);            // helmet
  ellipsePts(6, -146, 30, 20, 50, 0, a, 0);              // visor
  capsulePts(0, -95, 0, -10, 52, 170, 70, a, 0);         // torso
  capsulePts(-38, -100, -38, -20, 22, 40, 0, a, 0);      // backpack edge
  capsulePts(-50, -85, -110, -150, 18, 70, 12, a, 1);    // left arm up
  capsulePts(50, -85, 112, -140, 18, 70, 12, a, 2);      // right arm up
  capsulePts(-24, 5, -48, 150, 21, 90, 18, a, 3);        // legs
  capsulePts(24, 5, 40, 155, 21, 90, 18, a, 3);
  for (const p of a) p.u = clamp((p.y + 200) / 360);       // 0 at the top of the helmet, 1 at the feet
  return a;
}
function textPts(lines, size, cx, cy, step, weight = 800) {
  const c = document.createElement('canvas'); c.width = W; c.height = 700; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = `${weight} ${size}px Nunito`; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, W / 2, 350 + (i - (lines.length - 1) / 2) * size * 1.05));
  const d = g.getImageData(0, 0, W, 700).data, out = [], r2 = rng(11);
  for (let y = 0; y < 700; y += step) for (let x = 0; x < W; x += step) { const jx = x + (r2() - .5) * step * .7, jy = y + (r2() - .5) * step * .7; const i = (Math.round(jy) * W + Math.round(jx)) * 4; if (jy >= 0 && jy < 700 && jx >= 0 && jx < W && d[i + 3] > 140) out.push([jx - W / 2 + cx, jy - 350 + cy]); }
  return out;
}

// —— the pool ——
const P = [];
const astro = astronaut();
for (const a of astro) P.push({ g: 'me', ...a, seed: R(), br: .7 + .6 * R() * R(), sx: R(), sy: R() });
const NDISK = 2600; for (let i = 0; i < NDISK; i++) { const r = BH.rin + (BH.rout - BH.rin) * Math.pow(R(), 1.6); P.push({ g: 'disk', r, th: R() * 6.283, seed: R(), br: .5 + .8 * R() * R(), sx: R(), sy: R() }); }
const NSTAR = 1900; for (let i = 0; i < NSTAR; i++) P.push({ g: 'star', x: R() * W, y: R() * H * .78, seed: R(), br: .15 + .5 * R() * R() * R(), f: R() < .25 ? .6 + .4 * R() : R() * .2 });
const NFR = 360; { const fr = astronaut(); for (let i = 0; i < NFR; i++) { const a = fr[Math.floor(R() * fr.length)]; P.push({ g: 'friend', x: a.x, y: a.y, part: a.part, edge: a.edge, seed: R(), br: .7 + .4 * R() }); } }
const NCLK = 140; for (let i = 0; i < NCLK; i++) P.push({ g: 'clock', k: i, seed: R(), br: .9 });
// title targets: from the stars (title 1) and from the disk (title 2)
let T1 = [], T2 = [];
function prepTitles() {
  T1 = textPts(['SPAGHETTI-', 'FIZIERUNG'], 128, 540, 400, 6);
  T2 = textPts(['DU FÄLLST', 'WEITER.'], 150, 540, 900, 6);
  let s = 0, d = 0;
  for (const p of P) {
    if (p.g === 'star' && s < T1.length) p.t1 = T1[s++];
    if (p.g === 'disk' && d < T2.length) p.t2 = T2[d++];
  }
}

// —— positions as functions of time ——
const fr = x => x - Math.floor(x);
const drift = (p, t, a = 3) => [a * Math.sin(t * (.3 + p.seed) + p.seed * 9), a * Math.cos(t * (.4 + p.seed * .8) + p.seed * 5)];
function diskPos(p, t, zoom = 1) {
  const w = .55 * Math.pow(BH.rin / p.r, 1.5), th = p.th + w * t;
  let x = Math.cos(th) * p.r, y = Math.sin(th) * p.r * BH.sq;
  // lensing: the far half of the disk is bent up over the shadow into an arch
  if (Math.sin(th) < 0) { const k = clamp(1.25 - (p.r - BH.rin) / (BH.rout - BH.rin)); y -= k * k * (Math.sqrt(Math.max(0, p.r * p.r - x * x)) * .62) * (-Math.sin(th)) ** .6; }
  return [BH.x + x * zoom, BH.y + y * zoom, Math.sin(th)];
}
// the astronaut's body in screen space at time t (before the strand takes over)
function meBody(p, t) {
  const fallK = sm(seg(t, T.fall, T.stretch[1]));
  const cx = lerp(560, 540, fallK), cy = lerp(560, 760, fallK) + 12 * Math.sin(t * .9);
  const sc = lerp(1, 1.05, fallK), rot = .25 * Math.sin(t * .35) + lerp(0, -.25, fallK);
  // the tidal stretch: feet pulled further than the head, the waist thinned
  const s = lerp(1, 2.3, sm(seg(t, T.stretch[0], T.stretch[1])));
  let x = p.x, y = p.y;
  if (p.part === 1 || p.part === 2) { const sh = p.part === 1 ? [-50, -85] : [50, -85], wave = .25 * Math.sin(t * 2.2 + p.part); const c = Math.cos(wave), sn = Math.sin(wave); const dx = x - sh[0], dy = y - sh[1]; x = sh[0] + c * dx - sn * dy; y = sh[1] + sn * dx + c * dy; }
  y = -200 + (y + 200) * s; x = x / Math.sqrt(s);
  const c = Math.cos(rot), sn = Math.sin(rot);
  return [cx + (c * x - sn * y) * sc, cy + (sn * x + c * y) * sc];
}
// the strand: a spiral from where the body was down into the horizon; feet lead
function strandPos(p, t) {
  const k = seg(t, T.strand[0], T.strand[1]), w = clamp(k * 1.5 - (1 - p.u) * .5);
  if (w <= 0) return null;
  const R0 = 520, Rh = BH.rh * 1.05, rad = lerp(R0, Rh, Math.pow(w, 1.1)), th = -1.57 + w * 2.6 * Math.PI + (p.seed - .5) * .04;
  const wid = (1 - w) * 10 * (p.seed - .5);
  return [BH.x + Math.cos(th) * rad + wid, BH.y + Math.sin(th) * rad * lerp(1, BH.sq * 1.6, w) + wid, w];
}
// outside view: the astronaut re-forms near the edge and creeps towards it ever slower
const creep = t => Math.exp(-Math.max(0, t - T.slow) / 2.2);
function meOutside(p, t) {
  const sc = .42, cx = BH.x, cy = BH.y - BH.rh - 70 - 150 * creep(t);
  const x = p.x, y = p.y; return [cx + x * sc, cy + (y + 30) * sc];
}

function pointState(p, t) {
  // returns { x, y, col, a (brightness), f (focus 0 sharp … 1 bokeh) }
  if (p.g === 'star') {
    const [dx, dy] = drift(p, t, 2); let x = p.x + dx, y = p.y + dy, a = p.br * (.75 + .25 * Math.sin(t * .9 + p.seed * 20)), f = p.f, col = COL.star;
    if (p.t1) { const ki = sm(seg(t, T.t1[0] + p.seed * .4, T.t1[1] + p.seed * .4)), ko = sm(seg(t, T.t1out + p.seed * .3, T.t1out + .9 + p.seed * .3)), k = ki * (1 - ko);
      if (k > 0) { x = lerp(x, p.t1[0], k); y = lerp(y, p.t1[1], k); a = lerp(a, 1.1, k); f = lerp(f, 0, k); col = k > .5 ? COL.title : col; } }
    // the dive: stars stream outward too
    const dz = seg(t, T.dive[0], T.dive[1]); if (dz > 0) { const Z = Math.exp(dz * dz * 2.2); x = BH.x + (x - BH.x) * Z; y = BH.y + (y - BH.y) * Z; a *= 1 - dz * .6; }
    return { x, y, col, a, f };
  }
  if (p.g === 'disk') {
    const dz = seg(t, T.dive[0], T.dive[1]), zoom = Math.exp(dz * dz * 2.6);
    let [x, y, back] = diskPos(p, t, zoom); const hot = clamp(1.2 - (p.r - BH.rin) / 160);
    let col = [lerp(COL.disk[0], COL.diskHot[0], hot), lerp(COL.disk[1], COL.diskHot[1], hot), lerp(COL.disk[2], COL.diskHot[2], hot)];
    let a = p.br * (back < 0 ? .75 : 1) * sm(seg(t, T.form[0] + p.seed * 1.2, T.form[1] + p.seed * 1.2)), f = back < 0 ? .15 : 0;
    if (t < T.form[1] + 1.2) { const k = sm(seg(t, T.form[0] + p.seed * 1.2, T.form[1] + p.seed * 1.2)); f = lerp(.9, f, k); x = lerp(BH.x + (p.sx - .5) * 1100, x, k); y = lerp(BH.y + (p.sy - .5) * 1100, y, k); }
    if (dz > 0) a *= 1 - .4 * dz;
    // the final title gathers out of the streaking disk
    if (p.t2) { const k = sm(seg(t, T.t2[0] + p.seed * .5, T.t2[1] + p.seed * .5)); if (k > 0) { x = lerp(x, p.t2[0], k); y = lerp(y, p.t2[1], k); col = k > .5 ? COL.title : col; a = lerp(a, 1.0, k); f = lerp(f, 0, k); }
      const sc = sm(seg(t, 31.3 + p.seed * .3, 31.9)); if (sc > 0) { f = sc; a *= 1 - .7 * sc; y += sc * 40 * (p.seed - .5); } }
    else if (t > T.t2[0]) a *= 1 - sm(seg(t, T.t2[0], T.t2[1])) * .85;
    return { x, y, col, a, f };
  }
  if (p.g === 'me') {
    let col = COL.me, a = p.br * (p.edge ? 1 : .45) * (.85 + .22 * Math.sin(t * 2.1 + p.seed * 30)), f = 0, x, y;
    // gather out of bokeh at the start
    const g0 = sm(seg(t, T.form[0] + p.seed * .9, T.form[1] + p.seed * .9));
    [x, y] = meBody(p, t);
    if (g0 < 1) { const sx = 540 + (p.sx - .5) * 1000, sy = 560 + (p.sy - .5) * 1000; x = lerp(sx, x, g0); y = lerp(sy, y, g0); f = 1 - g0; a *= .4 + .6 * g0; }
    // the strand
    const sp = strandPos(p, t);
    if (sp) { const k = sm(seg(sp[2], 0, .25)); x = lerp(x, sp[0], k); y = lerp(y, sp[1], k); a *= lerp(1, 1.3, k) * (1 - .9 * seg(sp[2], .92, 1)); if (sp[2] >= 1) { a = 0; } }
    // outside view: the points fly back out of the hole and re-form, then creep; reddening and fading
    const bk = sm(seg(t, T.back[0] + p.seed * .6, T.back[1] + p.seed * .6));
    if (bk > 0) { const [ox, oy] = meOutside(p, t); x = lerp(BH.x + (p.seed - .5) * 60, ox, bk); y = lerp(BH.y, oy, bk); a = p.br * (p.edge ? 1 : .45) * (.85 + .22 * Math.sin(t * 2.1 * creep(t) + p.seed * 30)) * bk; f = (1 - bk) * .5; }
    const fd = seg(t, T.fade[0], T.fade[1]);
    if (fd > 0) { const k = sm(fd); col = [lerp(COL.me[0], COL.ember[0], k), lerp(COL.me[1], COL.ember[1], k), lerp(COL.me[2], COL.ember[2], k)]; a *= 1 - .88 * k; f = lerp(f, .55, k); }
    const dz = seg(t, T.dive[0], T.dive[1]); if (dz > 0) { a *= 1 - dz; }
    return { x, y, col, a, f };
  }
  if (p.g === 'friend') {   // a small figure far out, watching (it gathers out of the dark and leaves the same way)
    const k = sm(seg(t, 14.4 + p.seed * .8, 15.6 + p.seed * .8)) * (1 - sm(seg(t, 25.6 + p.seed * .4, 26.4)));
    const sc = .3, x = 190 + p.x * sc + (1 - k) * (p.seed - .5) * 400, y = 330 + p.y * sc + (1 - k) * (Math.sin(p.seed * 50)) * 200;
    return { x, y, col: COL.friend, a: k * p.br * (p.edge ? 1 : .45), f: (1 - k) * .8 };
  }
  if (p.g === 'clock') {   // the friend sees your clock: a ring of 12 and a hand, ticking slower and slower
    const k = sm(seg(t, 15.0 + p.seed * .5, 15.9)) * (1 - sm(seg(t, 25.4, 26.2)));
    const meY = BH.y - BH.rh - 70 - 150 * creep(t), cx = BH.x + 160, cy = meY - 60;
    let x, y;
    const ang = 6.283 * (.5 * Math.min(t, T.slow) + .5 * 2.2 * (1 - creep(t)));   // phase = ∫ rate: the rate falls as e^(−t/2.2)
    if (p.k < 96) { const a = p.k / 96 * 6.283; const big = p.k % 8 === 0; x = cx + Math.cos(a) * (big ? 52 : 56); y = cy + Math.sin(a) * (big ? 52 : 56); }
    else { const s = (p.k - 96) / 44; x = cx + Math.sin(ang) * 46 * s; y = cy - Math.cos(ang) * 46 * s; }
    const fd = sm(seg(t, T.fade[0], T.fade[1]));
    return { x, y, col: [lerp(COL.fly[0], COL.ember[0], fd), lerp(COL.fly[1], COL.ember[1], fd), lerp(COL.fly[2], COL.ember[2], fd)], a: k * (1 - .8 * fd), f: 0 };
  }
}

// —— renderer: splat into three blur levels, additive; 180° shutter streaks ——
const out = document.getElementById('c'), O = out.getContext('2d');
const mk = (s) => { const c = document.createElement('canvas'); c.width = W / s; c.height = H / s; return c; };
const L0 = mk(1), L1 = mk(2), L2 = mk(4); const G0 = L0.getContext('2d'), G1 = L1.getContext('2d'), G2 = L2.getContext('2d');
const css = (c, a) => `rgba(${Math.round(255 * Math.min(1, c[0]))},${Math.round(255 * Math.min(1, c[1]))},${Math.round(255 * Math.min(1, c[2]))},${clamp(a)})`;
function splat(t) {
  for (const g of [G0, G1, G2]) { g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; }
  const dt = 1 / 120;
  for (const p of P) {
    const s = pointState(p, t); if (!s || s.a <= .004) continue;
    const s0 = pointState(p, t - dt);
    const f = clamp(s.f), w0 = clamp(1 - f * 2), w1 = clamp(1 - Math.abs(f - .5) * 2), w2 = clamp(f * 2 - 1);
    const moved = s0 ? Math.hypot(s.x - s0.x, s.y - s0.y) : 0;
    const draw = (g, sc, r, wt) => { if (wt <= .01) return; const a = s.a * wt;
      if (moved > 2.5 && moved < 300 && f < .3) { g.strokeStyle = css(s.col, a * .7); g.lineWidth = r * 2 / sc; g.beginPath(); g.moveTo(s0.x / sc, s0.y / sc); g.lineTo(s.x / sc, s.y / sc); g.stroke(); }
      else { g.fillStyle = css(s.col, a); g.beginPath(); g.arc(s.x / sc, s.y / sc, r / sc, 0, 6.283); g.fill(); } };
    draw(G0, 1, 1.9, w0); draw(G1, 2, 5, w1 * .55); draw(G2, 4, 16, w2 * .35);
    if (s.a > .9 && w0 > .5) { G1.fillStyle = css(s.col, .16 * s.a); G1.beginPath(); G1.arc(s.x / 2, s.y / 2, 3, 0, 6.283); G1.fill(); }   // halo on bright points
  }
}
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  const k = sm(seg(t, c[0], c[0] + .25)) * (1 - sm(seg(t, c[1] - .2, c[1])));
  let fs = 42; O.font = `600 ${fs}px Nunito`; let w = O.measureText(c[2]).width; if (w > 960) { fs = Math.floor(fs * 960 / w); O.font = `600 ${fs}px Nunito`; }
  O.save(); O.globalAlpha = k; O.textAlign = 'center'; O.shadowColor = 'rgba(245,236,198,.55)'; O.shadowBlur = 14; O.fillStyle = '#F5ECC6'; O.fillText(c[2], W / 2, 1790); O.restore();
}
function frame(t) {
  splat(t);
  O.globalCompositeOperation = 'source-over'; O.filter = 'none';
  const gr = O.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#050708'); gr.addColorStop(1, '#060907'); O.fillStyle = gr; O.fillRect(0, 0, W, H);
  const dz = seg(t, T.dive[0], T.dive[1]) * (1 - seg(t, T.t2[0], T.t2[1])); if (dz > 0) { const r = BH.rh * Math.exp(seg(t, T.dive[0], T.dive[1]) ** 2 * 2.6) * .92; O.fillStyle = 'rgba(2,3,3,' + (.8 * dz) + ')'; O.beginPath(); O.arc(BH.x, BH.y, r, 0, 6.283); O.fill(); }
  O.globalCompositeOperation = 'lighter';
  O.filter = 'blur(10px)'; O.globalAlpha = .9; O.drawImage(L2, 0, 0, W, H);
  O.filter = 'blur(3px)'; O.globalAlpha = .9; O.drawImage(L1, 0, 0, W, H);
  O.filter = 'blur(2.5px)'; O.globalAlpha = .55; O.drawImage(L0, 0, 0);
  O.filter = 'none'; O.globalAlpha = 1; O.drawImage(L0, 0, 0);
  O.globalCompositeOperation = 'source-over';
  subtitle(t);
  if (t > DUR - .4) { O.fillStyle = `rgba(0,0,0,${seg(t, DUR - .4, DUR)})`; O.fillRect(0, 0, W, H); }
}
window.render = frame;
window.DUR = DUR;
window.EV = [
  { t: .2, type: 'gather', d: 2.4 }, { t: 4.6, type: 'stretch', d: 3.6 }, { t: 8.2, type: 'spiral', d: 5.0 }, { t: 9.6, type: 'chime' },
  { t: 13.8, type: 'rewind', d: 1.6 }, { t: 15.0, type: 'clock' }, { t: 20.0, type: 'redshift', d: 5.6 }, { t: 25.6, type: 'hush' }, { t: 26.0, type: 'dive', d: 2.6 }, { t: 28.6, type: 'chime' },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
document.fonts.load('800 100px Nunito').then(() => { prepTitles(); frame(0); window.READY = true; });
