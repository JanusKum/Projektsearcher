// film.js: EINSTEIN IN DEINER HOSENTASCHE. Top-down view straight above you: you, your city and the Earth's disc share one centre (0, 0).
// World units: metres. One camera: screen = (p − C)·z + S0, z = W / fov. Zooms interpolate log10(fov).
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const ei = k => Math.pow(clamp(k), 3);
const spr = (t, t0, w = 16, d = 8) => { const x = t - t0; return x <= 0 ? 0 : 1 - Math.exp(-d * x) * (Math.cos(w * x) + (d / w) * Math.sin(w * x)); };
const wob = (t, t0, w = 12, d = 5) => { const x = t - t0; return x <= 0 ? 0 : Math.exp(-d * x) * Math.sin(w * x); };
const blink = (t, t0) => eio(seg(t, t0, t0 + 0.07)) * (1 - eio(seg(t, t0 + 0.11, t0 + 0.22)));
function kf(t, keys) {   // [[t, v], ...] eased in-out between keys
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return lerp(va, vb, eio((t - a) / (b - a))); }
  return keys[keys.length - 1][1];
}

const S0 = [540, 880];
const RE = 6.371e6, RO = RE + 2.02e7;            // Earth radius, GPS orbit radius (20,200 km up)
const SAT_A = [-90, -18, 54, 126, 198, 270 - 36].map(d => d * Math.PI / 180);   // six markers on the ring (one per orbital plane, flattened)
const SAT0 = [Math.cos(SAT_A[0]) * RO, Math.sin(SAT_A[0]) * RO];               // the one we dive into (straight up the screen)
const FOUR = [0, 1, 3, 4];                       // the four that answer
const DRIFT = [7200, -7000];                     // where an uncorrected fix ends up after a day: ~10 km away
const C_ORB = 7.845;                             // log10 fov showing the whole orbit (70,000 km)

// —— camera ——
function camAt(t) {
  const lf = kf(t, [[0, -1.9], [2.0, -1.12], [4.8, -0.62], [5.4, -0.58], [8.9, C_ORB], [9.9, C_ORB - 0.02],
    [11.2, 1.45], [12.4, 1.38], [14.0, C_ORB], [19.2, C_ORB - 0.06], [25.2, C_ORB - 0.1], [26.4, 4.45], [31.0, 4.4], [33.6, 4.62]]);
  const fov = Math.pow(10, lf), z = W / fov;
  // through the ring: the satellite moves on screen from its place on the orbit to S0 as the camera dives (and back)
  let C = [0, 0];
  const dive = t < 12.4 ? eio(seg(t, T.dive0, T.dive1)) : 1 - eio(seg(t, T.back0, T.back1));
  if (dive > 0) {
    const zO = W / Math.pow(10, C_ORB), s0 = [SAT0[0] * zO, SAT0[1] * zO];        // the satellite's screen offset at orbit zoom
    const off = [s0[0] * (1 - dive), s0[1] * (1 - dive)];
    C = [SAT0[0] - off[0] / z, SAT0[1] - off[1] / z];
  }
  return { z, fov, C };
}
const toS = (cam, p) => [(p[0] - cam.C[0]) * cam.z + S0[0], (p[1] - cam.C[1]) * cam.z + S0[1]];

function discIn(cam, c, R) {   // 0 = off screen, 1 = partly in frame, 2 = covers the whole frame
  const [x, y] = toS(cam, c), r = R * cam.z;
  const dx = Math.max(0, Math.abs(x - W / 2) - W / 2), dy = Math.max(0, Math.abs(y - H / 2) - H / 2);
  if (Math.hypot(dx, dy) > r) return 0;
  const fx = Math.max(Math.abs(x), Math.abs(x - W)), fy = Math.max(Math.abs(y), Math.abs(y - H));
  return Math.hypot(fx, fy) < r ? 2 : 1;
}
// —— levels, drawn back to front; each only when it is visible at this field of view ——
function starfield(p, cam) {
  const R = rng(7);
  for (let i = 0; i < 160; i++) {
    const x = R() * W, y = R() * H, k = R(), r = k < 0.7 ? 1.5 + R() * 1.4 : 2.6 + R() * 2;
    el('circle', { cx: r1(x), cy: r1(y), r: r1(r), fill: k < 0.55 ? C.mist : k < 0.85 ? C.cream : C.sun }, p);
  }
  for (const [x, y, s, c] of [[150, 260, 14, C.cream], [930, 420, 11, C.sun], [880, 1500, 13, C.cream], [120, 1350, 10, C.sun], [700, 160, 9, C.cream]]) sparkle(p, x, y, s, c);
}
function earth(p, cam) {
  const [ex, ey] = toS(cam, [0, 0]), R = RE * cam.z;
  const vis = discIn(cam, [0, 0], RE); if (!vis) return;
  if (vis === 2 || R > 9000) { el('rect', { width: W, height: H, fill: C.mint }, p); return; }   // filling the frame: land
  el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R * 1.18), fill: C.n2 }, p);
  el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R * 1.08), fill: C.n3 }, p);
  const land = (G, dark) => {
    el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R), fill: dark ? C.blueD : C.blue }, G);
    const Rr = rng(5), L = dark ? C.mintD : C.mint, Cl = dark ? C.creamD : C.cream;
    for (const [cx, cy, rr, n] of [[0, 0, .46, 10], [-.55, -.35, .26, 8], [.5, .42, .3, 8], [.3, -.62, .2, 7], [-.4, .6, .18, 6]])
      el('path', { d: blobPath(polar(ex + cx * R, ey + cy * R, n, () => rr * R * (0.78 + 0.32 * Rr()))), fill: L }, G);
    for (const [cx, cy, w] of [[-.35, -.72, .5], [.45, -.15, .42], [-.6, .3, .36], [.15, .78, .5]])
      el('rect', { x: r1(ex + (cx - w / 2) * R), y: r1(ey + cy * R - R * .045), width: r1(w * R), height: r1(R * .09), rx: r1(R * .045), fill: Cl }, G);
  };
  twoTone(p, 'circle', { cx: r1(ex), cy: r1(ey), r: r1(R) }, R * .2, R * .16, land);
}
function city(p, cam) {
  const fov = cam.fov; if (fov > 2.5e6) return;
  // the region round the city: forests and lakes (drawn while the land fills the frame)
  if (fov > 1.5e4) { const R = rng(41);
    for (let i = 0; i < 26; i++) { const a = R() * 6.283, d = 2.5e4 + R() * 4.5e5, rr = 6e3 + R() * 4e4, c = [Math.cos(a) * d, Math.sin(a) * d];
      if (!discIn(cam, c, rr * 1.3)) { R(); R(); continue; }
      const [x, y] = toS(cam, c), col = R() < 0.35 ? C.blue : C.mintD, seed = R();
      el('path', { d: blobPath(polar(x, y, 8, q => rr * cam.z * (0.8 + 0.3 * Math.sin(q * 3 + seed * 9)))), fill: col }, p); } }
  if (!discIn(cam, [0, 0], 16000)) return;
  const [cx, cy] = toS(cam, [0, 0]), z = cam.z;
  // a city patch with a river, then streets and blocks when close enough
  if (fov > 3e4) {
    el('path', { d: blobPath(polar(cx, cy, 11, a => 9000 * z * (0.85 + 0.2 * Math.sin(a * 3 + 1)))), fill: C.mintD }, p);
  }
  if (fov < 6e4) {
    const G = g(p);
    el('rect', { width: W, height: H, fill: C.n3 }, G);   // streets (the ground between blocks)
    const B = fov > 15000 ? 1500 : fov > 5000 ? 600 : 120, st = B * 0.18;          // block pitch (m) and street width
    const x0 = Math.floor((cam.C[0] - (S0[0]) / z) / B) - 1, x1 = Math.ceil((cam.C[0] + (W - S0[0]) / z) / B) + 1;
    const y0 = Math.floor((cam.C[1] - S0[1] / z) / B) - 1, y1 = Math.ceil((cam.C[1] + (H - S0[1]) / z) / B) + 1;
    if ((x1 - x0) * (y1 - y0) < 2600) for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) {
      if (Math.abs(i * B) > 14000 || Math.abs(j * B) > 14000) continue;
      const h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
      const [sx, sy] = toS(cam, [i * B + st / 2, j * B + st / 2]), w = (B - st) * z;
      const col = h < 0.16 ? C.mint : h < 0.3 ? C.blueD : h < 0.75 ? C.n2 : '#3A3F86';
      el('rect', { x: r1(sx), y: r1(sy), width: r1(w), height: r1(w), rx: r1(Math.min(w * 0.12, 8)), fill: col }, G);
    }
    // the river
    const rv = []; for (let k = -12; k <= 12; k++) { const yy = k * 1500; rv.push(toS(cam, [-2600 + 900 * Math.sin(k * 0.7), yy])); }
    el('path', { d: 'M' + rv.map(q => `${r1(q[0])},${r1(q[1])}`).join('L'), fill: 'none', stroke: C.blue, 'stroke-width': r1(Math.max(4, 160 * z)), 'stroke-linejoin': 'round' }, G);
  }
}
function person(p, cam) {   // you, seen from straight above, holding the phone (only drawn up close)
  if (cam.fov > 1.4) { if (cam.fov < 40) phone(p, cam); return; }
  const S = q => toS(cam, q), z = cam.z;
  const [hx, hy] = S([0, 0.42]);
  el('ellipse', { cx: r1(hx), cy: r1(hy), rx: r1(0.27 * z), ry: r1(0.13 * z), fill: C.blueD }, p);        // shoulders
  shaded(p, 'ellipse', { cx: r1(hx), cy: r1(hy - 0.01 * z), rx: r1(0.25 * z), ry: r1(0.11 * z) }, C.blue, C.blueD, 0.02 * z, 0.02 * z);
  shaded(p, 'circle', { cx: r1(hx), cy: r1(hy - 0.02 * z), r: r1(0.095 * z) }, C.coralD, '#B83A3C', 0.012 * z, 0.012 * z);   // hair, top view
  for (const sx of [-1, 1]) {   // forearms reaching to the phone
    const [ax, ay] = S([sx * 0.2, 0.36]), [bx, by] = S([sx * 0.05, 0.05]);
    el('path', { d: `M${r1(ax)},${r1(ay)}L${r1(bx)},${r1(by)}`, stroke: C.blue, 'stroke-width': r1(0.07 * z), 'stroke-linecap': 'round' }, p);
  }
  phone(p, cam);
  for (const sx of [-1, 1]) {   // hands curl round the sides: palm, thumb, two knuckles
    const [px, py] = S([sx * 0.043, 0.035]);
    shaded(p, 'rect', { x: r1(px - 0.016 * z), y: r1(py - 0.03 * z), width: r1(0.032 * z), height: r1(0.075 * z), rx: r1(0.014 * z) }, C.cream, C.creamD, 0.004 * z, 0.004 * z);
    for (const dy of [-0.012, 0.008]) { const [kx, ky] = S([sx * 0.036, 0.035 + dy]); el('circle', { cx: r1(kx), cy: r1(ky), r: r1(0.005 * z), fill: C.creamD }, p); }
  }
}
function phone(p, cam) {
  const S = q => toS(cam, q), z = cam.z;
  const [x0, y0] = S([-0.036, -0.075]);
  el('rect', { x: r1(x0), y: r1(y0), width: r1(0.072 * z), height: r1(0.15 * z), rx: r1(0.011 * z), fill: '#151842' }, p);
  const [sx, sy] = S([-0.032, -0.071]), sw = 0.064 * z, sh = 0.142 * z;
  const G = g(p, { 'clip-path': clipOf('rect', { x: r1(sx), y: r1(sy), width: r1(sw), height: r1(sh), rx: r1(0.008 * z) }) });
  el('rect', { x: r1(sx), y: r1(sy), width: r1(sw), height: r1(sh), fill: C.mint }, G);
  // the map on the screen: a few streets and blocks (the same city, shrunk 1:20,000)
  const m = 0.064 / 2400;   // 2.4 km of city across the screen
  const st = 0.02 * z;
  for (let k = -6; k <= 6; k++) {
    const [ax] = S([k * 600 * m, 0]), [, ay] = S([0, k * 600 * m]);
    el('rect', { x: r1(ax - st / 2), y: r1(sy), width: r1(st * 0.22), height: r1(sh), fill: C.cream }, G);
    el('rect', { x: r1(sx), y: r1(ay - st / 2), width: r1(sw), height: r1(st * 0.22), fill: C.cream }, G);
  }
  const rv = []; for (let k = -6; k <= 6; k++) rv.push(S([(-2600 + 900 * Math.sin(k * 0.7)) * m, k * 1500 * m]));
  el('path', { d: 'M' + rv.map(q => `${r1(q[0])},${r1(q[1])}`).join('L'), fill: 'none', stroke: C.blue, 'stroke-width': r1(0.0035 * z), 'stroke-linejoin': 'round' }, G);
  const [dx, dy] = S([0, 0]);   // the blue dot
  el('circle', { cx: r1(dx), cy: r1(dy), r: r1(0.009 * z), fill: C.n3 }, G);
  el('circle', { cx: r1(dx), cy: r1(dy), r: r1(0.0045 * z), fill: C.blue }, G);
}
function orbit(p, cam, t) {
  const [ex, ey] = toS(cam, [0, 0]), R = RO * cam.z;
  if (R < 40 || R > 30000) return;
  el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R), fill: 'none', stroke: C.mint, 'stroke-width': 3, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round' }, p);
}
function satMarker(p, x, y, s, rot, lit = 0) {   // satellites are far too small at this scale: drawn as markers
  const G = g(p, { transform: `translate(${r1(x)},${r1(y)}) rotate(${r1(rot)})` });
  if (lit > 0) { el('circle', { r: r1(s * (0.9 + 0.5 * lit)), fill: C.n3 }, G); }
  el('rect', { x: r1(-s * 1.05), y: r1(-s * 0.05), width: r1(s * 2.1), height: r1(s * 0.1), fill: C.mist }, G);
  for (const sx of [-1, 1]) { const px = sx > 0 ? s * 0.42 : -s * 1.12; el('rect', { x: r1(px), y: r1(-s * 0.24), width: r1(s * 0.7), height: r1(s * 0.48), rx: r1(s * 0.05), fill: C.blueD }, G); el('rect', { x: r1(px), y: r1(-s * 0.24), width: r1(s * 0.7), height: r1(s * 0.22), rx: r1(s * 0.05), fill: C.blue }, G); }
  shaded(G, 'rect', { x: r1(-s * 0.3), y: r1(-s * 0.3), width: r1(s * 0.6), height: r1(s * 0.6), rx: r1(s * 0.12) }, C.cream, C.creamD, s * 0.1, s * 0.1);
  el('circle', { cy: r1(-s * 0.02), r: r1(s * 0.1), fill: C.coral }, G);
  return G;
}
function satellites(p, cam, t) {
  const R = RO * cam.z; if (R < 40 || cam.fov < 1e5) return;
  const sz = clamp(R / 18, 12, 46);
  SAT_A.forEach((a, i) => {
    const pos = toS(cam, [Math.cos(a) * RO, Math.sin(a) * RO]);
    const lit = (t > T.four && t < T.map0 && FOUR.includes(i)) ? 1 : 0;
    satMarker(p, pos[0], pos[1], sz, a * 180 / Math.PI + 90, lit);
  });
}
// the satellite up close (true size: about 12 m across the panels), with its atomic clock
function satClose(p, cam, t) {
  if (cam.fov > 1.2e5) return;
  const [x, y] = toS(cam, SAT0), s = Math.max(6 * cam.z, 14);   // s = half span in px (≈ 6 m)
  satMarker(p, x, y, s, 0);
  // the atomic clock: a frame-within-frame inset, leader to the body
  const k = eo(seg(t, T.clock, T.clock + 0.5)) * (1 - ei(seg(t, T.back0, T.back0 + 0.4)));
  if (k > 0.01) {
    const cx = 540, cy = 520, r = 170 * k;
    el('path', { d: `M${r1(x)},${r1(y - s * 0.3)}L${cx},${r1(cy + r)}`, stroke: C.sun, 'stroke-width': 3, 'stroke-linecap': 'round' }, p);
    el('circle', { cx, cy, r: r1(r + 22), fill: C.n2 }, p);
    el('circle', { cx, cy, r: r1(r + 10), fill: C.sun }, p);
    el('circle', { cx, cy, r: r1(r), fill: C.night }, p);
    // atom: nucleus + three orbits, electrons racing (the clock's ticking)
    const ph = t * 9;
    for (let i = 0; i < 3; i++) {
      const rot = i * 60;
      el('ellipse', { cx, cy, rx: r1(r * 0.72), ry: r1(r * 0.26), fill: 'none', stroke: C.blue, 'stroke-width': 4, transform: `rotate(${rot} ${cx} ${cy})` }, p);
      const a = ph + i * 2.1, ex = cx + Math.cos(a) * r * 0.72, ey = cy + Math.sin(a) * r * 0.26, ra = rot * Math.PI / 180;
      const qx = cx + (ex - cx) * Math.cos(ra) - (ey - cy) * Math.sin(ra), qy = cy + (ex - cx) * Math.sin(ra) + (ey - cy) * Math.cos(ra);
      el('circle', { cx: r1(qx), cy: r1(qy), r: r1(r * 0.07), fill: C.cream }, p);
    }
    shaded(p, 'circle', { cx, cy, r: r1(r * 0.17) }, C.coral, C.coralD, r * 0.04, r * 0.04);
    label(p, t, T.clock + 0.3, 600 + 0 * 0, 790, 'AN BORD', 'Atomuhr', 'start', 0, T.back0);
  }
}

// —— UI pieces ——
function label(p, t, t0, x, y, tag, line, anchor = 'start', col = 0, tOut = 1e9, big = false) {   // small-caps tag + one cream line, wiped left to right
  const k = eo(seg(t, t0, t0 + 0.45)) * (1 - ei(seg(t, tOut, tOut + 0.3)));
  if (k <= 0.001) return;
  const fs = big ? 64 : 36, w = Math.max(line.length * fs * 0.62, tag.length * 15) + 40;
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const G = g(p, { 'clip-path': clipOf('rect', { x: r1(x0 - 10), y: y - fs - 50, width: r1(w * k + 10), height: fs + 90 }) });
  el('rect', { x: r1(x0 - 22), y: y - fs - 40, width: r1(w + 24), height: fs + 64, rx: 20, fill: C.night }, G);
  text(G, x, y - fs - 8, tag, { 'font-size': 18, 'font-weight': 600, fill: col || C.sun, 'letter-spacing': 3, 'text-anchor': anchor });
  text(G, x, y, line, { 'font-size': fs, 'font-weight': 600, fill: C.cream, 'text-anchor': anchor });
}
function nextRing(p, t, t0, x, y, r, tOut = 1e9) {
  const k = spr(t, t0) * (1 - ei(seg(t, tOut, tOut + 0.25)));
  if (k <= 0.001) return;
  el('circle', { cx: r1(x), cy: r1(y), r: r1(r * k), fill: 'none', stroke: C.sun, 'stroke-width': 4 }, p);
  el('circle', { cx: r1(x), cy: r1(y), r: r1((r + 14) * k), fill: 'none', stroke: C.sun, 'stroke-width': 2.5, 'stroke-dasharray': '3 9', 'stroke-linecap': 'round' }, p);
}
function dots(p, t, t0, t1, A, B, gap = 22, r = 4, o = {}) {   // a sight line: dots pop out one by one, then stream toward B
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 1 || t < t0) return;
  const n = Math.floor(L / gap), pop = clamp((t - t0) / Math.max(0.01, t1 - t0)), shown = n * pop, flow = ((t - t0) * (o.speed || 40)) % gap;
  for (let i = 0; i < n; i++) {
    if (i > shown) break;
    const d = i * gap + (pop >= 1 ? flow : 0); if (d > L) continue;
    const s0 = clamp(shown - i) , s = s0 < 1 ? s0 * 1.3 : 1, k = d / L;
    const rr = r * s * Math.min(1, d / 30) * Math.min(1, (L - d) / 30 + 0.2);
    el('circle', { cx: r1(A[0] + (B[0] - A[0]) * k), cy: r1(A[1] + (B[1] - A[1]) * k), r: r1(Math.max(0, rr)), fill: o.col || C.sun }, p);
  }
}
function fovText(fov) {
  if (fov < 1) return [(fov * 100).toFixed(fov < 0.1 ? 1 : 0).replace('.', ','), 'cm'];
  if (fov < 1000) return [fov < 10 ? fov.toFixed(1).replace('.', ',') : Math.round(fov).toString(), 'm'];
  const km = fov / 1000; return [km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km).toLocaleString('de-DE'), 'km'];
}
function instrument(p, cam, t) {   // top right: field of view + a log ribbon from 1 cm to 100,000 km
  if (t > T.snap - 0.2) return;
  const x1 = 1010, y = 150, L = 380, x0 = x1 - L, e = Math.log10(cam.fov), pos = v => x0 + (v + 2) / 10 * L;
  const [num, unit] = fovText(cam.fov);
  el('rect', { x: x0 - 28, y: 38, width: L + 56, height: 178, rx: 26, fill: C.night }, p);
  text(p, x1, 72, 'SICHTFELD', { 'font-size': 18, 'font-weight': 600, fill: C.mist, 'letter-spacing': 3, 'text-anchor': 'end', 'data-noread': 1 });
  text(p, x1, 124, `${num}<tspan font-size="30" font-weight="500" fill="${C.mist}" dx="10">${unit}</tspan>`, { 'font-size': 52, 'font-weight': 600, fill: C.cream, 'text-anchor': 'end', 'data-noread': 1 });
  el('rect', { x: x0, y: y - 5, width: L, height: 10, rx: 5, fill: C.n3 }, p);
  el('rect', { x: x0, y: y - 5, width: r1(clamp(pos(e) - x0, 0, L)), height: 10, rx: 5, fill: C.sun }, p);
  for (const [v, lab] of [[-2, '1 cm'], [0, '1 m'], [3, '1 km'], [8, '100.000 km']]) {
    el('rect', { x: r1(pos(v) - 1.5), y: y + 12, width: 3, height: 10, rx: 1.5, fill: C.n3 }, p);
    text(p, pos(v), y + 44, lab, { 'font-size': 16, 'font-weight': 500, fill: C.mist, 'text-anchor': v === -2 ? 'start' : v === 8 ? 'end' : 'middle', 'data-noread': 1 });
  }
}
function iris(p, r, x = S0[0], y = S0[1]) {   // night everywhere outside a circle (a lens closing / opening)
  r = Math.max(0, r);
  el('path', { d: `M0,0H${W}V${H}H0Z M${r1(x - r)},${r1(y)}a${r1(r)},${r1(r)} 0 1,0 ${r1(2 * r)},0a${r1(r)},${r1(r)} 0 1,0 ${r1(-2 * r)},0Z`, fill: C.night, 'fill-rule': 'evenodd' }, p);
}
function subtitles(p, t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  const k = eo(seg(t, c[0], c[0] + 0.16)), y = 1770 + (1 - k) * 30;
  const G = g(p, { 'clip-path': clipOf('rect', { x: 0, y: 1700, width: W, height: 110 }) });
  let fs = 42; const w = c[2].length * fs * 0.5; if (w > 900) fs = Math.floor(fs * 900 / w);
  el('rect', { x: 36, y: r1(y - fs * 1.05), width: r1(c[2].length * fs * 0.5 + 84), height: r1(fs * 1.5), rx: 18, fill: C.night }, G);
  el('rect', { x: 56, y: r1(y - fs * 0.82), width: 6, height: r1(fs * 0.98), rx: 3, fill: C.sun }, G);
  text(G, 80, r1(y), c[2], { 'font-size': fs, 'font-weight': 500, fill: C.cream, 'data-noread': 1 });
}
function bigTitle(p, t, t0, lines, y0, fs = 104) {   // big words rise from below their own baseline through a clip
  lines.forEach((ln, i) => {
    const k = spr(t, t0 + i * 0.18, 14, 7), y = y0 + i * fs * 1.02;
    const G = g(p, { 'clip-path': clipOf('rect', { x: 0, y: r1(y - fs * 0.92), width: W, height: r1(fs * 1.16) }) });
    text(G, 64, r1(y + (1 - k) * fs * 1.1), ln, { 'font-size': fs, 'font-weight': 700, fill: i === lines.length - 1 ? C.sun : C.cream, 'letter-spacing': -2 });
  });
}
function clockDial(p, t, x, y, r, rate, tag, line, accent) {
  el('circle', { cx: x, cy: y, r: r + 26, fill: C.n2 }, p);
  el('circle', { cx: x, cy: y, r: r + 12, fill: accent }, p);
  shaded(p, 'circle', { cx: x, cy: y, r }, C.cream, C.creamD, r * 0.06, r * 0.06);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; el('rect', { x: r1(x - 3), y: r1(y - r + 10), width: 6, height: i % 3 ? 14 : 26, rx: 3, fill: C.night, transform: `rotate(${i * 30} ${x} ${y})` }, p); }
  const a = (t - T.clocks) * rate * 2.2;
  el('path', { d: `M${x},${y}L${r1(x + Math.sin(a) * r * 0.8)},${r1(y - Math.cos(a) * r * 0.8)}`, stroke: accent, 'stroke-width': 8, 'stroke-linecap': 'round' }, p);
  el('circle', { cx: x, cy: y, r: 11, fill: C.night }, p);
  text(p, x + r + 50, y - 8, tag, { 'font-size': 18, 'font-weight': 600, fill: accent, 'letter-spacing': 3 });
  text(p, x + r + 50, y + 34, line, { 'font-size': 34, 'font-weight': 600, fill: C.cream });
}

// —— Pin's performance (screen space; it stands on your location) ——
function pinPose(t) {
  return {
    look: [kf(t, [[4.4, 0], [4.8, 0.1], [9.0, 0.1], [9.4, 0], [19.4, 0], [19.6, 0.5], [25, 0.5], [26.4, 0.9], [30, 0.9], [31.2, 0]]),
           kf(t, [[1.9, 0.4], [2.6, 0], [4.4, 0], [4.8, -1], [9.0, -1], [9.4, 0], [15.6, 0], [16, -0.8], [18.6, -0.8], [19, 0], [19.4, 0], [19.6, -0.9], [25, -0.9], [26.4, 0.4], [31.2, 0]])],
    lid: blink(t, 1.95) + blink(t, 4.0) + blink(t, 17.3) + blink(t, 28.4),
    zoom: kf(t, [[4.5, 0], [4.85, 1], [8.9, 1], [9.4, 0], [15.6, 0], [16, 0.8], [18.6, 0.8], [19, 0]]),
    wide: kf(t, [[19.3, 0], [19.6, 1], [23, 1], [23.5, 0.4], [26.4, 0.4], [27, 1], [30.8, 1], [31.2, 0]]),
    smile: kf(t, [[2.4, 0], [2.7, 1], [4.4, 1], [4.7, 0], [18.6, 0], [18.9, 1], [19.2, 0], [31.2, 0], [31.5, 1]]),
    sq: 0.18 * wob(t, T.land, 16, 6) + 0.12 * wob(t, 18.6, 16, 6) + 0.15 * wob(t, T.snap, 16, 6) - 0.1 * eio(seg(t, 4.6, 4.8)) * (1 - eio(seg(t, 4.85, 5.0))),
    rot: 6 * wob(t, T.land + 0.05, 10, 4) + kf(t, [[26.4, 0], [27, -8], [30.8, -8], [31.2, 0]]),
    wave: kf(t, [[31.6, 0], [32, 1]]), wavePh: t * 9,
  };
}

// —— the film ——
function film(t) {
  const cam = camAt(t);
  el('rect', { width: W, height: H, fill: C.night });
  starfield(g(), cam);
  earth(g(), cam);
  city(g(), cam);
  person(g(), cam);
  const ui = g();
  orbit(ui, cam, t);
  const you = toS(cam, [0, 0]);

  // 1 · a dot in black: everything else is still black around it for the first half second
  if (t < 0.75) { const rr = 30 + 2300 * ei(seg(t, 0.3, 0.75)); iris(ui, rr); if (t < 0.5) el('circle', { cx: S0[0], cy: S0[1], r: r1(14 * (1 + 0.25 * spr(t, 0.05))), fill: C.sun }, ui); }

  // the satellites
  satellites(ui, cam, t);
  satClose(ui, cam, t);

  // 2 · sight line straight up from Pin's lens to the top of the frame, then the GPS label
  const ps = kf(t, [[0, 200], [6.0, 200], [8.0, 135], [25.2, 135], [26.4, 170]]), pinAt = [you[0], you[1]];
  const pinVis = t >= T.land - 0.4 && (t < T.dive0 + 0.6 || t >= T.back1 - 0.2);
  const P = pinPose(t);
  if (t > T.fire && t < 9.6) { const L0 = pinLens(pinAt[0], pinAt[1], ps, P); dots(ui, t, T.fire, T.fire + 0.6, L0, [L0[0], -30], 26, 5); }
  label(ui, t, T.here, 600, 1180, 'DEIN STANDORT', '± 5 Meter', 'start', 0, 4.9);
  if (t > T.gpsLab && t < T.ring) { const zO = cam.z, top = toS(cam, SAT0); label(ui, t, T.gpsLab, 1010, top[1] + 140, 'GPS-SATELLITEN', '20.200 km hoch', 'end', C.mint, 9.5); }

  // 3 · next-stop ring on the satellite at the top of the orbit, then through it; the signal walks back to you
  { const sp = toS(cam, SAT0); nextRing(ui, t, T.ring, sp[0], sp[1], 54, T.dive0 + 0.5); }
  if (t > T.sig0 && t < T.four) {
    const sp = toS(cam, SAT0), k = eio(seg(t, T.sig0, T.sig1));
    dots(ui, t, T.sig0, T.sig0 + 0.3, sp, [sp[0] + (you[0] - sp[0]) * k, sp[1] + (you[1] - sp[1]) * k], 24, 5, { col: C.cream });
    label(ui, t, T.sig0 + 0.3, 600, you[1] - 210, 'LAUFZEIT', '0,067 Sekunden', 'start', C.mint, T.four - 0.3);
  }

  // 4 · four satellites, four ranges: their circles meet in one point
  if (t > T.four && t < T.map0 + 0.2) {
    FOUR.forEach((i, n) => {
      const a = SAT_A[i], sp = toS(cam, [Math.cos(a) * RO, Math.sin(a) * RO]), tt = T.four + 0.3 + n * 0.6;
      dots(ui, t, tt, tt + 0.35, sp, you, 26, 4.2, { col: C.cream, speed: 60 });
      const rk = eo(seg(t, tt + 0.3, tt + 1.2)) * (1 - ei(seg(t, T.hush, T.hush + 0.3)));
      if (rk > 0.01) el('circle', { cx: r1(sp[0]), cy: r1(sp[1]), r: r1(Math.hypot(you[0] - sp[0], you[1] - sp[1]) * rk), fill: 'none', stroke: C.mist, 'stroke-width': 2.5 }, ui);
    });
    nextRing(ui, t, T.lock, you[0], you[1], 40, T.hush);
    label(ui, t, T.lock + 0.1, 540, you[1] + 230, '4 LAUFZEITEN', '= dein Ort', 'middle', 0, T.hush);
  }

  // 6 · back on the city map: the dot drifts 10 km, a tape measure follows it
  const drift = eio(seg(t, T.drift0, T.drift1)) * (1 - eio(seg(t, T.snap - 0.3, T.snap)));
  if (t > T.map1 - 0.6 && t < T.end) {
    const D = toS(cam, [DRIFT[0] * drift, DRIFT[1] * drift]);
    if (drift > 0.01) {
      const ang = Math.atan2(D[1] - you[1], D[0] - you[0]), L = Math.hypot(D[0] - you[0], D[1] - you[1]);
      const G = g(ui, { transform: `translate(${r1(you[0])},${r1(you[1])}) rotate(${r1(ang * 180 / Math.PI)})` });
      el('rect', { x: 0, y: -11, width: r1(L), height: 22, rx: 4, fill: C.sun }, G);
      el('rect', { x: 0, y: 5, width: r1(L), height: 6, rx: 3, fill: C.sunD }, G);
      for (let km = 1; km * 1000 * cam.z < L; km++) el('rect', { x: r1(km * 1000 * cam.z - 1.25), y: -11, width: 2.5, height: km % 5 ? 7 : 13, fill: C.night }, G);
      el('circle', { cx: r1(D[0]), cy: r1(D[1]), r: 24, fill: C.n3 }, ui);
      el('circle', { cx: r1(D[0]), cy: r1(D[1]), r: 14, fill: C.coral }, ui);
      const km = Math.round(Math.hypot(DRIFT[0], DRIFT[1]) * drift / 1000 * 10) / 10;
      if (t < T.snap - 0.3) {
        text(ui, r1(D[0]) - 20, r1(D[1]) - 52, 'DEIN NAVI GLAUBT', { 'font-size': 18, 'font-weight': 600, fill: C.coral, 'letter-spacing': 3, 'text-anchor': 'end', 'data-noread': 1 });
        text(ui, r1(D[0]) - 20, r1(D[1]) - 4, `${km.toFixed(1).replace('.', ',')} km`, { 'font-size': 56, 'font-weight': 700, fill: C.cream, 'text-anchor': 'end', 'data-noread': 1 });
      }
    }
    label(ui, t, T.drift0 + 0.4, 64, 420, 'OHNE KORREKTUR', 'nach nur einem Tag', 'start', C.coral, T.snap - 0.2);
  }

  // Pin
  if (pinVis) {
    const land = t < T.land ? 1 - eio(seg(t, T.land - 0.4, T.land)) : 0;
    halo(ui, pinAt[0], pinAt[1], 22, 38);
    el('circle', { cx: r1(pinAt[0]), cy: r1(pinAt[1]), r: 12, fill: C.sun }, ui);
    pin(ui, pinAt[0], pinAt[1] - 900 * land, ps, P);
  }

  // 5 · two clocks (frame within frame on a night plate)
  const ck = eo(seg(t, T.clocks, T.clocks + 0.5)) * (1 - ei(seg(t, T.map0 - 0.3, T.map0)));
  if (ck > 0.01) {
    const G = g(ui, { 'clip-path': clipOf('rect', { x: 0, y: 260, width: W, height: r1(880 * ck) }) });
    el('rect', { x: 40, y: 260, width: W - 80, height: 860, rx: 40, fill: C.night }, G);
    clockDial(G, t, 230, 470, 135, 1.0 + 0.35 * seg(t, T.plus - 0.5, T.plus), 'IM ORBIT', 'tickt schneller', C.sun);
    clockDial(G, t, 230, 880, 135, 1.0, 'AUF DER ERDE', 'normal', C.mint);
    const n = Math.round(38 * eio(seg(t, T.plus, T.plus + 1.6)));
    if (t > T.plus) {
      const k = spr(t, T.plus);
      text(G, 1000, 1080 - (1 - k) * 40, `+${n} µs`, { 'font-size': 64, 'font-weight': 700, fill: C.sun, 'text-anchor': 'end', 'data-noread': 1 });
      text(G, 1000, 1080 - 100 - (1 - k) * 40, 'PRO TAG', { 'font-size': 18, 'font-weight': 600, fill: C.mist, 'letter-spacing': 3, 'text-anchor': 'end', 'data-noread': 1 });
    }
  }

  // 7 · title
  if (t > T.snap) {
    bigTitle(ui, t, T.snap + 0.1, ['EINSTEIN', 'IN DEINER', 'HOSENTASCHE'], 330, 112);
    label(ui, t, T.snap + 0.8, 70, 1240, 'RELATIVITÄT', 'macht dein Navi genau', 'start', C.mint);
  }
  instrument(ui, cam, t);
  subtitles(ui, t);
  if (t > T.end - 0.6) { const yy = toS(cam, [0, 0]); iris(ui, 2300 * (1 - ei(seg(t, T.end - 0.6, T.end - 0.05))), yy[0], yy[1] - 60); }
}

window.render = function (t) { svg = document.getElementById('s'); svg.innerHTML = ''; uid = 0; defs = el('defs'); film(t); };
window.DUR = DUR;
window.EV = [...SFX, ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id }))];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
document.fonts.load('600 40px Jost').then(() => {
  window.TEXTS = t => { window.__TXT = []; window.render(t); const out = window.__TXT.filter(e => e.isConnected && e.textContent.trim()).map(e => { const r = e.getBoundingClientRect(); return { id: e.textContent, text: e.textContent, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; }); window.__TXT = null; return out; };
  window.render(0); window.READY = true;
});
