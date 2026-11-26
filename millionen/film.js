// EINE MILLION · Firefly Pointillism · 1080×1920 · 60 fps.
// One fixed pool of points. The Milky Way's stars become the satellites; at the end they go back to being stars.
// 1 point = 8 satellites: 17,000 today = 2,125 points; 1,000,000 = 125,000 points.
const W = 1080, H = 1920, DUR = 62;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = k => { k = clamp(k); return k * k * k * (k * (k * 6 - 15) + 10); };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(2026), D2R = Math.PI / 180;

// —— timeline ——
const T = {
  rise: [6.0, 10.5],          // ground → space
  t17: [8.6, 9.8, 12.6],      // title "17.000" in, hold, out
  news: [14.6, 15.8, 19.6],   // title "1.000.000" (the permission) in, hold, out
  sat: [19.8, 21.4, 25.2],    // one compute satellite assembles out of stars, then goes back up
  flood: [25.6, 31.2],        // the Milky Way pours down into orbit
  t1m: [30.8, 31.8, 35.0],    // title "×60"
  de: [33.4, 35.6, 41.4],     // zoom onto Germany, "≈ 700"
  down: [41.6, 43.0],         // back to the ground, looking up from Germany
  back: [53.6, 58.8],         // the satellites lift back into the Milky Way
  end: 62,
};
const VO = [{ id: 'v1', t: .8 }, { id: 'v2', t: 6.6 }, { id: 'v3', t: 11.4 }, { id: 'v4', t: 20.0 }, { id: 'v5', t: 26.6 }, { id: 'v6', t: 33.6 }, { id: 'v7', t: 42.4 }, { id: 'v8', t: 49.0 }, { id: 'v9', t: 54.6 }];
const CUES = [
  [.8, 3.0, 'Schau dir diesen Himmel gut an.'], [3.0, 5.6, 'Vielleicht sieht er bald nie wieder so aus.'],
  [6.6, 10.9, 'Heute kreisen rund 17.000 aktive Satelliten um die Erde.'],
  [11.4, 14.6, 'Doch am 25. November hat die US-Behörde FCC'], [14.6, 19.4, 'SpaceX erlaubt, bis zu eine Million Satelliten zu starten.'],
  [20.0, 21.6, 'Nicht fürs Internet.'], [21.6, 25.9, 'Sie sollen Rechenzentren für künstliche Intelligenz werden. Im All.'],
  [26.6, 28.4, 'So sähe das aus.'], [28.4, 32.2, 'Eine Million. Fast 60-mal so viele wie heute.'],
  [33.6, 37.4, 'Über Deutschland wären rechnerisch ständig rund 700 gleichzeitig.'], [37.4, 41.6, 'Im Schnitt nur 25 Kilometer voneinander entfernt.'],
  [42.4, 44.8, 'Astronomen schlagen Alarm:'], [44.8, 48.4, 'Der Nachthimmel wäre voller Lichtpunkte, die über die Sterne ziehen.'],
  [49.0, 51.3, 'Ob alle wirklich starten, weiß niemand.'], [51.3, 53.8, 'Erlaubt ist es jetzt.'],
  [54.6, 58.8, 'Schau heute Nacht nach oben. Noch gehört der Himmel den Sternen.'],
];

// —— colours (linear) ——
const C = { sat: [1.0, .74, .34], star: [.86, .90, 1.0], land: [.42, .74, .26], landHi: [.62, .88, .30], sea: [.20, .34, .40], title: [1.0, .90, .58], hill: [.32, .62, .20], ring: [.86, 1.0, .40] };

// —— views ——
// ground view: sky coordinates (az, el in degrees) → screen; horizon at HY, 15 px per degree, looking south
const HY = 1640, PPD = 15.5, AZ0 = 180;
const skyXY = (az, el) => [W / 2 + (((az - AZ0 + 540) % 360) - 180) * PPD, HY - el * PPD];
// space view: an orthographic globe; centre, radius in px, the sub-camera point (lat, lon) and the Earth's spin
let G = { cx: 540, cy: 900, R: 330, lat: 25, lon: 10 };
const OBS = { lat: 51, lon: 10 };   // the observer on the ground (Germany)
const SPIN = t => t * 1.5;          // Earth's rotation in degrees (slowed for the picture)

// rotate a unit vector from Earth-fixed (x: lon 0, y: lon 90E, z: north) into the camera frame (X right, Y up, Z towards the viewer)
function toCam(x, y, z) {
  const lo = -G.lon * D2R, la = G.lat * D2R;
  const x1 = x * Math.cos(lo) - y * Math.sin(lo), y1 = x * Math.sin(lo) + y * Math.cos(lo);   // turn so the camera's longitude is at x
  // camera looks along −x1 from +x1 side: Z = x1·cos(la) + z·sin(la); Y = z·cos(la) − x1·sin(la); X = y1
  return [y1, z * Math.cos(la) - x1 * Math.sin(la), x1 * Math.cos(la) + z * Math.sin(la)];
}
const llToVec = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];

// —— the pool ——
const NSAT = 125000, NTODAY = 2125;
const sx = new Float32Array(NSAT), sy = new Float32Array(NSAT), sf = new Float32Array(NSAT), sb = new Float32Array(NSAT);   // star (ground-sky) positions, focus, brightness
const oi = new Float32Array(NSAT), oO = new Float32Array(NSAT), ou = new Float32Array(NSAT), orr = new Float32Array(NSAT), seed = new Float32Array(NSAT);
const INCL = [[53, .45], [43, .15], [70, .15], [97.6, .2], [33, .05]];
for (let i = 0; i < NSAT; i++) {
  // the Milky Way: a band across the southern sky plus a field of faint stars
  const inBand = R() < .78; let az, el;
  if (inBand) { const s = R(), off = (R() + R() + R() + R() - 2) * 16 * (.7 + .5 * Math.sin(s * 7)); az = 138 + s * 95 + off * .55; el = 6 + s * 84 + off; }
  else { az = 140 + R() * 90; el = 2 + Math.pow(R(), .8) * 104; }
  const [x, y] = skyXY(az, el); sx[i] = x; sy[i] = y;
  const bright = R(), dust = inBand ? (.35 + .65 * Math.abs(Math.sin(az * .21 + el * .13))) : 1; sb[i] = (inBand ? .03 : .011) * dust + (bright > .997 ? 1.1 : bright > .985 ? .35 : 0); sf[i] = R() < .12 ? .35 + R() * .4 : R() * .15;
  // the orbit this point will fly
  let p = R(), inc = 53; for (const [v, w] of INCL) { if (p < w) { inc = v; break; } p -= w; }
  oi[i] = inc * D2R; oO[i] = R() * Math.PI * 2; ou[i] = R() * Math.PI * 2; orr[i] = 1 + (500 + R() * 502) / 6371; seed[i] = R();
}
// orbit position in Earth-fixed coordinates at time t (one orbit ≈ 55 s on screen; the Earth spins underneath)
function orbitVec(i, t) {
  const u = ou[i] + t * (2 * Math.PI / 55) * (1.08 / orr[i]) ** 1.5, ci = Math.cos(oi[i]), si = Math.sin(oi[i]), cO = Math.cos(oO[i]), sO = Math.sin(oO[i]);
  const xo = Math.cos(u), yo = Math.sin(u);
  const x = xo, y = yo * ci, z = yo * si;
  return [orr[i] * (x * cO - y * sO), orr[i] * (x * sO + y * cO), orr[i] * z];
}
// the Earth: land points (Natural Earth), sparse sea points
let LAND = []; const SEA = []; { const r2 = rng(5); for (let i = 0; i < 7000; i++) { const z = r2() * 2 - 1, a = r2() * Math.PI * 2; SEA.push([Math.asin(z) / D2R, a / D2R - 180]); } }
// hills on the horizon (ground view)
const HILL = []; { const r3 = rng(8); for (let i = 0; i < 4200; i++) { const x = r3() * W, h = 40 + 26 * Math.sin(x * .006 + 1) + 18 * Math.sin(x * .017) + 8 * Math.sin(x * .05); const y = HY + 60 - h + (r3() < .35 ? r3() * 260 : r3() * 6); HILL.push([x, y, r3()]); } }
// fixed background stars that never leave
const BG = []; { const r4 = rng(9); for (let i = 0; i < 2600; i++) BG.push([r4() * W, r4() * (HY - 40), .12 + .3 * r4() ** 4]); }

// titles made of points (taken from the pool for a while)
function textTargets(str, size, cy, step) {
  const c = document.createElement('canvas'); c.width = W; c.height = 500; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = `900 ${size}px Nunito`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(str, W / 2, 250);
  const d = g.getImageData(0, 0, W, 500).data, out = [], r5 = rng(str.length * 7 + size);
  for (let y = 0; y < 500; y += step) for (let x = 0; x < W; x += step) { const jx = x + (r5() - .5) * step * .7, jy = y + (r5() - .5) * step * .7, k = (Math.round(jy) * W + Math.round(jx)) * 4; if (d[k + 3] > 140) out.push([jx, jy - 250 + cy]); }
  return out;
}
let TT = {};
// the compute satellite (points): a chip block between two solar wings (screen px, centred)
const SATSHAPE = []; { const r6 = rng(12);
  for (let i = 0; i < 1400; i++) { const x = (r6() - .5) * 150, y = (r6() - .5) * 150; SATSHAPE.push([x, y, 1]); }                                  // the compute core
  for (const s of [-1, 1]) for (let i = 0; i < 1500; i++) { const cx = s * (95 + r6() * 330), cy = (r6() - .5) * 120; const grid = (Math.abs(((cx / 41) % 1)) < .08 || Math.abs(((cy / 30) % 1)) < .1) ? .45 : 1; SATSHAPE.push([cx, cy, grid * .7]); }   // solar wings with cell lines
  for (let i = 0; i < 160; i++) SATSHAPE.push([(r6() - .5) * 6, -75 - r6() * 90, 1]); }                                                                  // an antenna
const SAT_FROM = 30000;   // which pool points build the close-up (they are stars at the time)

// —— accumulation renderer: three blur levels, additive in linear light ——
const L0 = new Float32Array(W * H * 3), L1 = new Float32Array((W / 2) * (H / 2) * 3), L2 = new Float32Array((W / 4) * (H / 4) * 3);
const out = document.getElementById('c'), O = out.getContext('2d');
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const C0 = cv(W, H), C1 = cv(W / 2, H / 2), C2 = cv(W / 4, H / 4);
const I0 = C0.getContext('2d').createImageData(W, H), I1 = C1.getContext('2d').createImageData(W / 2, H / 2), I2 = C2.getContext('2d').createImageData(W / 4, H / 4);
function splatTo(L, w, h, x, y, r, g, b) {
  const ix = Math.floor(x), iy = Math.floor(y); if (ix < 0 || iy < 0 || ix >= w - 1 || iy >= h - 1) return;
  const fx = x - ix, fy = y - iy, k00 = (1 - fx) * (1 - fy), k10 = fx * (1 - fy), k01 = (1 - fx) * fy, k11 = fx * fy;
  let p = (iy * w + ix) * 3; L[p] += r * k00; L[p + 1] += g * k00; L[p + 2] += b * k00; L[p + 3] += r * k10; L[p + 4] += g * k10; L[p + 5] += b * k10;
  p += w * 3; L[p] += r * k01; L[p + 1] += g * k01; L[p + 2] += b * k01; L[p + 3] += r * k11; L[p + 4] += g * k11; L[p + 5] += b * k11;
}
function point(x, y, col, a, f) {   // f: 0 sharp → 1 bokeh
  if (a <= .002) return; f = clamp(f);
  const w0 = clamp(1 - f * 2), w1 = clamp(1 - Math.abs(f - .5) * 2), w2 = clamp(f * 2 - 1);
  if (w0 > 0) { const e = a * w0; splatTo(L0, W, H, x, y, col[0] * e, col[1] * e, col[2] * e); }
  if (w1 > 0) { const e = a * w1 * 1.6; splatTo(L1, W / 2, H / 2, x / 2, y / 2, col[0] * e, col[1] * e, col[2] * e); }
  if (w2 > 0) { const e = a * w2 * 3.2; splatTo(L2, W / 4, H / 4, x / 4, y / 4, col[0] * e, col[1] * e, col[2] * e); }
  if (a > .8 && w0 > .5) { const e = a * .16; splatTo(L1, W / 2, H / 2, x / 2, y / 2, col[0] * e, col[1] * e, col[2] * e); }   // a halo on bright points
}
function streak(x0, y0, x1, y1, col, a, f) { const n = Math.min(6, 1 + Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3)); for (let k = 0; k < n; k++) { const u = n === 1 ? 1 : k / (n - 1); point(lerp(x0, x1, u), lerp(y0, y1, u), col, a / n * 1.4, f); } }
function toImage(L, I, n, gain) { const d = I.data; for (let i = 0, j = 0; i < n; i++, j += 3) { d[i * 4] = 255 * Math.pow(1 - Math.exp(-L[j] * gain), 1 / 2.2); d[i * 4 + 1] = 255 * Math.pow(1 - Math.exp(-L[j + 1] * gain), 1 / 2.2); d[i * 4 + 2] = 255 * Math.pow(1 - Math.exp(-L[j + 2] * gain), 1 / 2.2); d[i * 4 + 3] = 255; } }

// —— the film ——
function camFor(t) {
  // rise: the globe comes up from below; dez: zoom onto Germany; down: the globe sinks away as we land on the ground again
  const rise = sm(seg(t, ...T.rise)), dez = sm(seg(t, T.de[0], T.de[1])) * (1 - sm(seg(t, T.de[2], T.down[0] + .3))), down = sm(seg(t, T.down[0], T.down[1]));
  G.R = lerp(330, 1250, dez); G.lat = lerp(22, 51, dez); G.lon = lerp(-20 + t * .6, 10 + SPIN(t), dez);
  G.cx = 540; G.cy = lerp(2300, 900, rise) + down * 1600;
  return { rise, dez, down, space: rise * (1 - down) };
}
// a satellite's position on the ground observer's sky (Germany), or null if below the horizon
const OBSV = llToVec(OBS.lat, OBS.lon);
function skyOfSat(i, t) {
  const v = orbitVec(i, t), lon = (OBS.lon + SPIN(t)) * D2R, la = OBS.lat * D2R;
  const o = [Math.cos(la) * Math.cos(lon), Math.cos(la) * Math.sin(lon), Math.sin(la)];   // observer in the same rotating frame as the orbits
  const dx = v[0] - o[0], dy = v[1] - o[1], dz = v[2] - o[2];
  const up = o, east = [-Math.sin(lon), Math.cos(lon), 0], north = [-Math.sin(la) * Math.cos(lon), -Math.sin(la) * Math.sin(lon), Math.cos(la)];
  const U = dx * up[0] + dy * up[1] + dz * up[2], E = dx * east[0] + dy * east[1], N = dx * north[0] + dy * north[1] + dz * north[2];
  const el = Math.atan2(U, Math.hypot(E, N)) / D2R; if (el < 1) return null;
  const az = (Math.atan2(E, N) / D2R + 360) % 360; return skyXY(az, el);
}
function frame(t) {
  L0.fill(0); L1.fill(0); L2.fill(0);
  const cam = camFor(t), space = cam.space;
  // where each satellite is in the space view
  const proj = (v) => { const [X, Y, Z] = toCam(v[0], v[1], v[2]); const hidden = Z < 0 && X * X + Y * Y < 1; return [G.cx + X * G.R, G.cy - Y * G.R, Z, hidden]; };

  // 1 · background stars (never leave), fading under the Earth in space
  for (const [x, y, b] of BG) { const dx = x - G.cx, dy = y - G.cy; const occ = space > .05 && dx * dx + dy * dy < (G.R * 1.02) ** 2 ? 1 - space : 1; point(x, y, C.star, b * 1.5 * occ * (.8 + .2 * Math.sin(t * .7 + x)), .05); }
  // 2 · the Earth (space view)
  if (space > .01) {
    const lit = (v) => { const sunlon = (-40 + SPIN(t)) * D2R; return clamp(.35 + .8 * (v[0] * Math.cos(sunlon) + v[1] * Math.sin(sunlon))); };
    for (const [la, lo] of LAND) { const v = llToVec(la, lo + SPIN(t)), p = proj(v); if (p[2] < 0) continue; const b = 1.1 * (1 - .55 * cam.dez) * space * lit(llToVec(la, lo)) * (.55 + .45 * p[2]); point(p[0], p[1], C.land, b, 0); if (cam.dez > .2) for (let q = 1; q < 4; q++) point(p[0] + (Math.sin(la * 91 + q * 7) * .5) * G.R * .0128, p[1] + (Math.cos(lo * 37 + q * 3) * .5) * G.R * .0128, C.land, b * .8, 0); }
    for (const [la, lo] of SEA) { const v = llToVec(la, lo + SPIN(t)), p = proj(v); if (p[2] < 0) continue; point(p[0], p[1], C.sea, .32 * space * (.4 + .6 * p[2]), .25); }
    // the limb: a thin ring of soft light
    for (let k = 0; k < 900; k++) { const a = k / 900 * Math.PI * 2; point(G.cx + Math.cos(a) * G.R * 1.015, G.cy + Math.sin(a) * G.R * 1.015, C.sea, .22 * space, .55); }
  }
  // 3 · the hills (ground view)
  const ground = 1 - space;
  if (ground > .01) for (const [x, y, s] of HILL) point(x, y + (1 - ground) * 500, C.hill, .5 * ground * (.6 + .4 * s), s < .2 ? .4 : .05);

  // 4 · the pool: star / today's satellite / title / close-up / flood / back
  const fl0 = T.flood[0], fl1 = T.flood[1];
  for (let i = 0; i < NSAT; i++) {
    const isToday = i < NTODAY;
    // when does this point become a satellite? today's fleet: from the start; the rest: during the flood (accelerating)
    const join = isToday ? -1 : fl0 + (fl1 - fl0 - 1.2) * Math.sqrt((i - NTODAY) / (NSAT - NTODAY));
    const kSat = isToday ? 1 : sm(seg(t, join, join + 1.2));
    const kBack = isToday ? 0 : sm(seg(t, T.back[0] + seed[i] * 3.6, T.back[0] + seed[i] * 3.6 + 1.4));
    const sat = kSat * (1 - kBack);
    // the star (ground-sky) state
    let x = sx[i], y = sy[i], a = sb[i] * (.8 + .2 * Math.sin(t * .9 + seed[i] * 40)), f = sf[i], col = C.star;
    if (sat > 0) {
      // the satellite state, in the space view or on the ground sky
      let px, py, pa, pf = 0, vis = true;
      if (space > .5 || (t > T.rise[0] && t < T.down[0])) { const p = proj(orbitVec(i, t)); px = p[0]; py = p[1]; vis = !p[3]; pa = (isToday ? .9 : .55 + 1.1 * cam.dez) * (p[2] < 0 ? .45 : 1); }
      else { const q = skyOfSat(i, t); if (q) { px = q[0]; py = q[1]; pa = 1.3; } else vis = false; }
      if (!vis) { pa = 0; px = x; py = y; }
      if (sat < 1 && !isToday) { const u = sat; x = lerp(x, px, u); y = lerp(y, py, u); a = lerp(a, pa, u); f = lerp(f, 0, u); col = u > .5 ? C.sat : C.star; if (u > .05 && u < .95) { const ux = lerp(sx[i], px, sm(seg(t - 1 / 60, join, join + 1.2))), uy = lerp(sy[i], py, sm(seg(t - 1 / 60, join, join + 1.2))); streak(ux, uy, x, y, col, a, f); continue; } }
      else { x = px; y = py; a = pa; f = pf; col = C.sat; }
      // in the sky view satellites move: draw them with their motion trail
      if (space < .5 && vis && sat >= 1) { const q0 = skyOfSat(i, t - 1 / 30); if (q0) { streak(q0[0], q0[1], x, y, col, a, 0); continue; } }
    }
    // titles and the close-up borrow points for a while
    for (const key in TT) { const tg = TT[key]; const j = i - tg.from; if (j >= 0 && j < tg.pts.length) { const [t0, t1, t2] = tg.time; const k = sm(seg(t, t0 + (j % 97) / 97 * .5, t1 + (j % 97) / 97 * .5)) * (1 - sm(seg(t, t2 + (j % 89) / 89 * .4, t2 + .9 + (j % 89) / 89 * .4))); if (k > 0) { const [tx, ty, tb] = tg.pts[j]; x = lerp(x, tx, k); y = lerp(y, ty, k); a = lerp(a, (tb ?? 1) * (tg.a || 1.1), k); f = lerp(f, 0, k); col = k > .5 ? (tg.col || C.title) : col; } } }
    if (col === C.star && space > .05) { const dx = x - G.cx, dy = y - G.cy; if (dx * dx + dy * dy < (G.R * 1.02) ** 2) a *= 1 - space; }
    point(x, y, col, a, f);
  }
  // the ring around Germany (space view, zoomed): marks the area the 700 are counted over
  if (cam.dez > .9 && t < T.de[2] + .3) { const k = sm(seg(t, T.de[1] - .4, T.de[1] + .4)) * (1 - sm(seg(t, T.de[2] - .3, T.de[2] + .3))); const c = proj(llToVec(51, 10 + SPIN(t))); const r = 3.9 * D2R * G.R; for (let q = 0; q < 160; q++) { const ang = q / 160 * Math.PI * 2; if (q % 4 === 3) continue; point(c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r * .78, C.ring, .9 * k, 0); } }

  // develop: tone-map each level, blur the wide ones, add them up
  toImage(L0, I0, W * H, 1.6); toImage(L1, I1, W * H / 4, 1.6); toImage(L2, I2, W * H / 16, 1.6);
  C0.getContext('2d').putImageData(I0, 0, 0); C1.getContext('2d').putImageData(I1, 0, 0); C2.getContext('2d').putImageData(I2, 0, 0);
  O.globalCompositeOperation = 'source-over'; O.filter = 'none';
  const gr = O.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#050708'); gr.addColorStop(1, '#060907'); O.fillStyle = gr; O.fillRect(0, 0, W, H);
  O.globalCompositeOperation = 'lighter'; O.imageSmoothingEnabled = true;
  O.filter = 'blur(6px)'; O.drawImage(C2, 0, 0, W, H);
  O.filter = 'blur(2px)'; O.drawImage(C1, 0, 0, W, H);
  O.filter = 'blur(1.2px)'; O.globalAlpha = .6; O.drawImage(C0, 0, 0); O.globalAlpha = 1; O.filter = 'none'; O.drawImage(C0, 0, 0);
  O.globalCompositeOperation = 'source-over';
  subtitle(t);
  if (t < .6) { O.fillStyle = `rgba(0,0,0,${1 - sm(seg(t, 0, .6))})`; O.fillRect(0, 0, W, H); }
  if (t > DUR - 1.2) { O.fillStyle = `rgba(0,0,0,${sm(seg(t, DUR - 1.2, DUR))})`; O.fillRect(0, 0, W, H); }
}
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  const k = sm(seg(t, c[0], c[0] + .25)) * (1 - sm(seg(t, c[1] - .2, c[1])));
  let fs = 42; O.font = `700 ${fs}px Nunito`; let w = O.measureText(c[2]).width; if (w > 980) { fs = Math.floor(fs * 980 / w); O.font = `700 ${fs}px Nunito`; }
  O.save(); O.globalAlpha = k; O.textAlign = 'center'; O.shadowColor = 'rgba(0,0,0,.9)'; O.shadowBlur = 16; O.fillStyle = '#F5ECC6'; O.fillText(c[2], W / 2, 1810); O.shadowColor = 'rgba(245,236,198,.4)'; O.shadowBlur = 10; O.fillText(c[2], W / 2, 1810); O.restore();
}
window.render = frame;
window.DUR = DUR;
window.EV = [
  { t: .2, type: 'night', d: 6.2 }, { t: T.rise[0], type: 'rise', d: 4.5 }, { t: T.t17[0], type: 'gather' }, { t: T.news[0], type: 'gather' }, { t: T.news[0] + 1.2, type: 'boom', soft: 1 },
  { t: T.sat[0], type: 'gather' }, { t: T.sat[1], type: 'chime' }, { t: T.flood[0], type: 'flood', d: T.flood[1] - T.flood[0] }, { t: T.t1m[0] + .6, type: 'boom' },
  { t: T.de[0], type: 'whoosh', d: 2.2 }, { t: T.de[1], type: 'chime' }, { t: T.down[0], type: 'whoosh', d: 1.4 }, { t: T.down[1], type: 'night', d: 10.6 }, { t: T.down[1], type: 'swarm', d: 10.6 },
  { t: T.back[0], type: 'lift', d: 5.2 }, { t: 58.8, type: 'chord' },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([fetch('data/land.json').then(r => r.json()), document.fonts.load('900 100px Nunito'), document.fonts.load('700 40px Nunito')]).then(([land]) => {
  LAND = land;
  // titles: points borrowed from the pool (stars at that time, or satellites, they leave and come back)
  TT.t17 = { from: 60000, pts: textTargets('17.000', 230, 360, 5), time: T.t17 };
  TT.news = { from: 70000, pts: textTargets('1.000.000', 190, 360, 5), time: T.news };
  TT.sat = { from: SAT_FROM, pts: SATSHAPE.map(([x, y, b]) => [540 + x, 820 + y, b]), time: T.sat, col: C.sat, a: .9 };
  TT.x60 = { from: 80000, pts: textTargets('× 60', 260, 330, 5), time: T.t1m };
  TT.de = { from: 90000, pts: textTargets('≈ 700', 230, 330, 5), time: [T.de[1], T.de[1] + 1.0, T.de[2] - .6] };
  frame(0); window.READY = true;
});
