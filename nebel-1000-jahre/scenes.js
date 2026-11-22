// scenes.js — the places of "Nebel · 1000 Jahre", all at 180×320 in palette indices, plus the fog pass.
// One place seen across a thousand years: village (year 0) → field (1) → fog village (100) → mushroom ruins (500) → hill (1000).
import { W, H, C, T, PROTECT, bayer, bayer8, hash, clamp, lerp, eio } from './px.js';
import { FARMER, BEARER, bearerFrame, lantern } from './sprites.js';

export const SUNP = [120, 146];          // the sun of year 0 and the sun of the end sit on the same screen pixel

// —— 2D value noise ——
function vn2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
export const fbm = (x, y, s = 0) => vn2(x, y, s) * .6 + vn2(x * 2.1, y * 2.1, s + 7) * .3 + vn2(x * 4.3, y * 4.3, s + 13) * .1;

// —— Fog pass: density d(x,y) in 0..1 becomes dithered mist indices; protected (lantern) pixels stay.
// lights: [{x,y,r}] warm the mist around a flame with the protected glow colour.
export function fogPass(fb, dens, lights = []) {
  const d = fb.d;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = d[i]; if (PROTECT.has(c)) continue;
    const f = dens(x, y); if (f <= 0) continue;
    const b = bayer(x, y);
    let out = -1;
    if (b < f - .62) out = C.white; else if (b < f) out = C.silver; else if (b < f + .12 && f > .25) out = C.steel === c ? -1 : (c === C.ink || c === C.night ? C.dslate : -1);
    if (out < 0) continue;
    for (const L of lights) {
      const r = Math.hypot(x - L.x, (y - L.y) * 1.1), g = 1 - r / L.r;
      if (g > 0 && bayer8(x, y) < g * 1.35) { out = C.glow; break; }
    }
    d[i] = out;
  }
}
// flame halo where there is no fog (a stepped ring, never a blend)
export function halo(fb, x, y, r, t) {
  const fl = Math.floor(t * 12) % 2;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const q = Math.hypot(i, j * 1.1) / (r + fl); if (q > 1) continue;
    if (bayer8(x + i, y + j) < (1 - q) * .55) { const c = fb.get(x + i, y + j); if (c !== T && !PROTECT.has(c)) fb.px(x + i, y + j, C.glow); }
  }
}

// —— shared pieces ——
function sun(fb, cx, cy, r, t) {
  // halo rings (lighter sky), then the disc
  for (let j = -r - 9; j <= r + 9; j++) for (let i = -r - 9; i <= r + 9; i++) {
    const q = Math.hypot(i, j); if (q <= r || q > r + 9) continue;
    const k = 1 - (q - r) / 9; if (bayer(cx + i, cy + j) < k * .8) fb.px(cx + i, cy + j, k > .6 ? C.white : C.cyan);
  }
  fb.disc(cx, cy, r, C.amber); fb.disc(cx - 1, cy - 1, r - 2, C.yellow); fb.disc(cx - 3, cy - 3, Math.max(1, r * .35), C.white);
}
function cloud(fb, x, y, w) {
  x = Math.round(x);
  for (let k = 0; k < 4; k++) fb.disc(x + k * w / 4, y - (k === 1 || k === 2 ? 3 : 0), w / 5, C.white);
  fb.rect(x - w / 5 + 2, y, w + w / 5, 3, C.silver);
}
function hills(fb, y0, amp, freq, seed, col, col2, camX = 0) {
  for (let x = 0; x < W; x++) {
    const wx = x + camX, top = Math.round(y0 - amp * fbm(wx * freq, 0, seed));
    for (let y = top; y < H; y++) fb.px(x, y, col2 !== undefined && bayer(x, y) < clamp((y - top) / 14, 0, 1) * .5 ? col2 : col);
  }
}
function house(fb, x, y, w, h, roof, wall = C.sand, o = {}) {
  x = Math.round(x);
  fb.rect(x, y - h, w, h, wall); fb.rect(x + w - 3, y - h, 3, h, C.tan);
  fb.rect(x, y - h, 1, h, C.ink); fb.rect(x + w - 1, y - h, 1, h, C.ink); fb.rect(x, y - 1, w, 1, C.ink);
  for (let k = 0; k <= 4; k++) { const rw = w + 4 - k * (w / 5); fb.rect(x + (w - rw) / 2, y - h - 2 - k * 3, rw, 3, k === 0 ? C.ink : roof); fb.hline(x + (w - rw) / 2, x + (w - rw) / 2 + rw - 1, y - h - 2 - k * 3, C.ink); }
  // door with panels and a stud
  const dx = x + Math.round(w * .2); fb.rect(dx, y - 11, 7, 10, C.ink); fb.rect(dx + 1, y - 10, 5, 9, C.brown); fb.rect(dx + 2, y - 9, 3, 3, C.clay); fb.rect(dx + 2, y - 5, 3, 3, C.clay); fb.px(dx + 5, y - 6, C.amber);
  // window
  const wx = x + w - 12; fb.rect(wx, y - h + 5, 7, 6, C.ink); fb.rect(wx + 1, y - h + 6, 5, 4, o.lit ? C.amber : C.navy); fb.px(wx + 3, y - h + 6, C.ink); fb.hline(wx + 1, wx + 5, y - h + 8, C.ink);
}
// bell tower: stone, a roof and a bell that swings (angle in steps)
export function tower(fb, x, y, t, swing = 0, o = {}) {
  x = Math.round(x);
  const h = o.h || 62, w = o.w || 16;
  fb.rect(x, y - h, w, h, C.silver); fb.rect(x + w - 4, y - h, 4, h, C.steel);
  for (let j = y - h + 4; j < y; j += 6) for (let i = x + ((j / 6) & 1) * 3; i < x + w; i += 7) fb.hline(i, i + 4, j, C.steel);
  fb.rect(x, y - h, 1, h, C.ink); fb.rect(x + w - 1, y - h, 1, h, C.ink);
  // opening and bell
  fb.rect(x + 3, y - h + 6, 10, 14, C.ink); fb.rect(x + 4, y - h + 7, 8, 12, C.night);
  const a = Math.round(swing * 3);                   // -3..3 px
  const bx = x + 8 + a, by = y - h + 9;
  fb.line(x + 8, y - h + 7, bx, by, C.dslate);
  fb.rect(bx - 3, by, 6, 6, C.amber); fb.rect(bx - 4, by + 5, 8, 2, C.amber); fb.rect(bx - 2, by + 1, 1, 4, C.yellow); fb.rect(bx + 2, by, 1, 6, C.brown); fb.px(bx, by + 7, C.ink);
  // roof
  for (let k = 0; k < 8; k++) { const rw = w + 4 - k * 2.5; fb.rect(x + (w - rw) / 2, y - h - 2 - k * 2, rw, 2, o.roof ?? C.rust); }
  fb.rect(x + 7, y - h - 22, 2, 5, C.dslate);
  if (o.moss) for (let j = y - h; j < y; j++) for (let i = x; i < x + w; i++) if (fbm(i * .2, j * .2, 5) > .62 && bayer(i, j) < .7) fb.px(i, j, C.dgreen);
}
function birds(fb, t, list) {
  for (const b of list) {
    const x = Math.round(b.x + b.vx * t), y = Math.round(b.y + Math.sin(t * 3 + b.p) * 2), up = Math.floor(t * 8 + b.p) % 2;
    if (x < -4 || x > W + 4) continue;
    fb.px(x, y, C.ink); fb.px(x - 1, y - up, C.ink); fb.px(x + 1, y - up, C.ink); fb.px(x - 2, y - 1 + up * 0, C.ink); fb.px(x + 2, y - 1, C.ink);
  }
}

// ———————— A · year 0: the sunny village. fogEdge = x where the fog wall stands ————————
export function village(fb, t, o) {
  fb.gradV(0, 0, W, 196, [C.blue, C.blue, C.blue, C.cyan, C.cyan]);
  if (!o.noSun) sun(fb, SUNP[0], SUNP[1], 12, t);
  cloud(fb, 20 + t * 2, 72, 30); cloud(fb, 118 - t * 1.5, 104, 22);
  hills(fb, 190, 22, .018, 3, C.green, C.dgreen);
  hills(fb, 203, 10, .04, 9, C.dgreen, C.teal);
  tower(fb, 22, 206, t, 0);
  house(fb, 46, 207, 30, 20, C.red); house(fb, 128, 206, 34, 22, C.rust);
  house(fb, 92, 204, 22, 15, C.crimson);
  // field: soil stripes and wheat
  fb.rect(0, 207, W, H - 207, C.brown);
  for (let y = 209; y < H; y += 5) {
    fb.hline(0, W - 1, y + 3, C.dbrown);
    for (let x = (y * 3) % 4; x < W; x += 3) {
      const sway = Math.round(Math.sin(t * 2 + x * .15 + y * .1) * .6);
      fb.px(x + sway, y, C.yellow); fb.px(x + sway, y + 1, C.amber); fb.px(x, y + 2, C.tan);
    }
  }
  // farmer
  const fs = FARMER.stand, fx = 54 + (o.recoil ? -1 : 0), fy = 224 - fs.h;
  fb.blit(fs, fx, fy);
  if (o.birdList) birds(fb, t, o.birdList);
}
export function villageFog(t, edgeX) {
  return (x, y) => {
    const e = edgeX + 16 * fbm(y * .045, t * .7, 21) - 8;
    if (x < e - 30) return 0;
    return clamp((x - e + 30) / 40, 0, 1) * (.75 + .3 * fbm(x * .05 - t * .8, y * .04, 4));
  };
}

// ———————— B · year 1: field and sky, tilted down. wilt 0..1, sunPale 0..1 ————————
export const FIELD = { worldH: 460, farmerFeet: 362 };
export function field(fb, t, camY, o) {
  const oy = -camY;
  fb.gradV(0, oy, W, 252, [C.blue, C.blue, C.cyan, C.cyan]);
  if (o.sunR > 0.5) {
    const cx = SUNP[0], cy = SUNP[1] + oy;
    fb.disc(cx, cy, o.sunR, C.amber); fb.disc(cx - 1, cy - 1, o.sunR - 2, C.yellow);
  }
  hills(fb, 252 + oy, 8, .03, 12, C.dgreen, C.teal);
  fb.rect(0, 254 + oy, W, FIELD.worldH - 254, C.dbrown);
  // wheat in clumps: back rows small, front rows tall; wilt bends the heads down and browns them
  for (let row = 0; row < 7; row++) {
    const by = 268 + row * 30 + oy, hgt = 10 + row * 5, sp = 8 + row, hh = 3 + (row >> 1);
    for (let x = (row * 13) % 11; x < W; x += 11) { fb.px(x, by + 3, C.umber); fb.px(x + 1, by + 3, C.umber); fb.px(x + 5, by + 9, C.brown); }
    for (let x0 = (row * 5) % sp; x0 < W + sp; x0 += sp) {
      const x = x0 + Math.round((hash(x0, row) - .5) * 3);
      const sway = Math.round(Math.sin(t * 1.4 + x * .2 + row) * (1 - o.wilt) * .8);
      const bend = o.wilt * (4 + row * 1.5) * (hash(x, row, 2) * .5 + .75);
      const tx = Math.round(x + sway + bend * .8), ty = Math.round(by - hgt + bend * .7);
      const stem = o.wilt > .6 ? C.brown : row < 3 ? C.dgreen : C.green;
      fb.line(x, by, tx, ty, stem); if (row > 3) fb.line(x + 1, by, tx + 1, ty, stem);
      const ly = Math.round(by - hgt * .45); fb.px(x - 1, ly, stem); fb.px(x - 2, ly - 1 + (o.wilt > .5 ? 2 : 0), stem); fb.px(x + 2, ly + 3, stem); fb.px(x + 3, ly + 2 + (o.wilt > .5 ? 2 : 0), stem);
      const head = o.wilt > .75 ? C.brown : o.wilt > .35 ? C.tan : C.amber, hi = o.wilt > .5 ? C.clay : C.yellow;
      const dir = o.wilt > .3 ? 1 : -1;            // upright heads grow up, wilted heads hang down
      for (let k = 0; k < hh; k++) { const yy = ty + dir * k, xx = tx + (o.wilt > .3 ? Math.round(k * .5) : 0); fb.px(xx, yy, k === 0 ? hi : head); fb.px(xx + 1, yy, head); fb.px(xx - 1, yy, k % 2 ? head : T); }
    }
    if (row === 3) {   // the farmer stands just in front of row 3, a clear patch of soil behind him
      const s = FARMER[o.pose];
      fb.blit(s, 82, FIELD.farmerFeet + oy - s.h + 4);
    }
  }
}
export function fieldFog(t, camY, k) {
  return (x, y) => { const wy = y + camY; const base = wy < 250 ? .5 : wy < 300 ? .3 : wy < 330 ? .12 : 0; return clamp((base + (fbm(x * .03 - t * .25, wy * .03, 2) - .5) * .4) * k, 0, 1); };
}

// ———————— C · year 100: fog village, side scroll. Nets catch water, the bell shows the way. ————————
export const VILL100 = { ground: 222, worldW: 340 };
export function village100(fb, t, camX, o) {
  fb.gradV(0, 0, W, 200, [C.steel, C.silver, C.silver]);
  // far: grey silhouettes of houses (parallax 0.35)
  hills(fb, 186, 16, .02, 31, C.steel, undefined, camX * .35);
  for (let k = 0; k < 5; k++) { const x = Math.round(k * 52 - camX * .35) % 260; fb.rect(x, 172 - (k % 3) * 4, 18, 30, C.steel); for (let j = 0; j < 4; j++) fb.rect(x - 2 + j * 1, 170 - (k % 3) * 4 - j * 2, 22 - j * 2, 2, C.steel); }
  // nearer silhouettes (parallax 0.6): bare trees and roofs, one step darker
  for (let k = 0; k < 7; k++) { const x = Math.round(((k * 61 + 20 - camX * .6) % 360 + 360) % 360) - 40; const by = 214;
    if (k % 2) { fb.vline(x, by - 46, by, C.slate); fb.vline(x + 1, by - 46, by, C.slate); for (let j = 0; j < 4; j++) { fb.line(x, by - 20 - j * 7, x - 7 + j, by - 28 - j * 7, C.slate); fb.line(x + 1, by - 24 - j * 7, x + 8 - j, by - 31 - j * 7, C.slate); } }
    else { fb.rect(x - 10, by - 26, 24, 26, C.slate); for (let j = 0; j < 7; j++) fb.rect(x - 12 + j * 2, by - 28 - j * 2, 28 - j * 4, 2, C.slate); } }
  // mid (parallax 1)
  const G = VILL100.ground;
  fb.rect(0, G, W, H - G, C.dbrown);
  for (let y = G + 2; y < H; y += 4) for (let x = (y * 5) % 7; x < W; x += 7) fb.px(x, y, C.brown);
  const X = wx => Math.round(wx - camX);
  house(fb, X(12), G, 34, 24, C.rust, C.tan, { lit: true });
  net(fb, X(56), G, t, 0);
  house(fb, X(110), G, 28, 18, C.crimson, C.tan, { lit: true });
  net(fb, X(150), G, t, 1.1);
  house(fb, X(196), G, 36, 26, C.rust, C.tan, { lit: true });
  tower(fb, X(262), G, t, o.bell, { moss: true, roof: C.dbrown, h: 96, w: 20 });
  net(fb, X(292), G, t, 2.3);
  // lantern bearer
  const fr = bearerFrame(t), bx = Math.round(o.bearerX - camX), byy = G - BEARER.h + fr.bob + 1;
  fb.blit(fr.spr, bx, byy);
  const fl = lantern(fb, bx + BEARER.hand[0], byy + BEARER.hand[1], t);
  // foreground posts and grass (parallax 1.4)
  for (let k = 0; k < 6; k++) { const x = Math.round(k * 70 - camX * 1.4 + 30); if (x < -6 || x > W) continue; fb.rect(x, G - 10, 4, 26, C.umber); fb.rect(x, G - 10, 1, 26, C.ink); fb.rect(x + 3, G - 10, 1, 26, C.ink); fb.rect(x - 1, G - 12, 6, 2, C.ink); }
  for (let x = 0; x < W; x++) { const wx = x + camX * 1.4; if (fbm(wx * .08, 0, 8) > .55) { const h = 2 + Math.round(fbm(wx * .3, 1, 9) * 4); fb.vline(x, G + 8 - h, G + 8, C.dgreen); } }
  return { flame: fl };
}
// fog-catcher net: two poles, a mesh, drops that fall into a barrel (12 fps)
function net(fb, x, G, t, ph) {
  if (x < -40 || x > W + 4) return;
  const top = G - 70, w = 30;
  fb.rect(x, top, 2, 70, C.brown); fb.rect(x + w, top, 2, 70, C.brown); fb.hline(x, x + w + 1, top, C.umber);
  for (let j = top + 2; j < top + 50; j++) for (let i = x + 2; i < x + w; i++) if (((i + j) % 3 === 0) || ((i - j) % 3 === 0)) fb.px(i, j, C.silver);
  fb.hline(x + 2, x + w - 1, top + 50, C.steel);
  // barrel
  const bx = x + w / 2 - 5; fb.rect(bx, G - 10, 11, 10, C.dbrown); fb.rect(bx, G - 10, 11, 1, C.ink); fb.rect(bx, G - 5, 11, 1, C.umber); fb.rect(bx + 1, G - 9, 9, 2, C.navy);
  // drops
  for (let k = 0; k < 3; k++) {
    const p = ((t * 1.3 + ph + k / 3) % 1), dx = Math.round(bx + 2 + k * 3), dy = Math.round(top + 27 + p * (G - 10 - top - 27));
    fb.px(dx, dy, C.cyan); if (p > .1) fb.px(dx, dy - 1, C.blue);
  }
}
export function vill100Fog(t) {
  return (x, y) => clamp(.22 + .32 * fbm(x * .02 - t * .35, y * .05, 6) - (y > 222 ? .1 : 0) + (y < 150 ? .12 : 0), 0, 1);
}
export const dropTimes = (t0, t1) => { const out = []; for (const ph of [0, 1.1, 2.3]) for (let k = 0; k < 3; k++) { let n = Math.ceil((t0 * 1.3 + ph + k / 3) - 1); for (;; n++) { const tt = (n + 1 - ph - k / 3) / 1.3; if (tt >= t1) break; if (tt >= t0) out.push(+tt.toFixed(3)); } } return out.sort((a, b) => a - b); };

// ———————— D · year 500: the ruins under a giant mushroom (drawn in the four moss greys + the lantern) ————————
export const RUINS = { worldH: 700, ground: 602 };
const [K, D, L, Wt] = [C.ink, C.slate, C.steel, C.white];
function dome(fb, cx, top, rx, ry, cols, spots = []) {
  // a mushroom cap: upper half-ellipse, lit from the upper left, flat bands (no dither)
  for (let y = Math.round(top); y <= Math.round(top + ry); y++) {
    const v = (y - top) / ry, hw = rx * Math.sqrt(clamp(1 - (1 - v) ** 2, 0, 1));
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - cx) / (hw + 1e-3); let c = cols.mid;
      if (u < -.35 && v < .75) c = cols.lit;
      if (u > .5) c = cols.dark;
      if (Math.abs(u) > .94 || y === Math.round(top)) c = K;
      for (const [sx, sy, sr] of spots) if (Math.hypot(x - sx, (y - sy) * 1.25) < sr) c = cols.spot;
      fb.px(x, y, c);
    }
  }
  fb.hline(cx - rx, cx + rx, Math.round(top + ry), K);
}
export function ruins(fb, t, camY, o) {
  const oy = -camY, G = RUINS.ground + oy;
  // sky: flat bright mist, one darker step near the ground
  fb.rect(0, 0, W, H, Wt);
  if (G - 120 < H) fb.rect(0, G - 120, W, 120, Wt);
  // distant mushrooms (one grey)
  for (const [x, top, r] of [[20, 476, 15], [160, 440, 20], [58, 530, 9]]) {
    const ty = top + oy; fb.rect(x - 2, ty + r * .6, 5, G - ty, L);
    dome(fb, x, ty, r, r * .7, { lit: L, mid: L, dark: L, spot: L });
  }
  // stem: three flat tones and a few vertical fibres
  const cx = 104;
  for (let wy = 128; wy < RUINS.ground + 4; wy++) {
    const y = wy + oy; if (y < -2 || y > H + 2) continue;
    const hw = 11 + Math.pow((wy - 128) / 474, 2) * 13;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - cx) / hw; let c = u > .4 ? D : u < -.5 ? Wt : L;
      if (u > .88 || u < -.94) c = K;
      if (Math.abs(u + .1) < .05 || Math.abs(u - .25) < .04) c = D;
      fb.px(x, y, c);
    }
    if (fbm(cx * .1, wy * .05, 41) > .62) for (let x = Math.round(cx + hw * .1); x <= Math.round(cx + hw * .85); x++) fb.px(x, y, D);   // moss streaks on the shadow side
  }
  // the ring (annulus)
  for (let k = 0; k < 7; k++) { const y = 230 + k + oy, hw = 24 - k * 1.6; fb.hline(cx - hw, cx + hw, y, k === 6 ? K : k < 2 ? Wt : L); fb.px(cx - hw, y, K); fb.px(cx + hw, y, K); }
  // the cap and its gills
  const capY = 40 + oy, rx = 90;
  dome(fb, cx, capY, rx, 92, { lit: L, mid: D, dark: D, spot: Wt }, [[cx - 42, capY + 28, 10], [cx + 8, capY + 14, 12], [cx + 48, capY + 48, 8], [cx - 66, capY + 64, 7], [cx - 10, capY + 56, 7]]);
  for (let x = cx - rx + 2; x <= cx + rx - 2; x++) { const d = Math.abs(x - cx) / rx, gy = capY + 93 + Math.round(10 * (1 - d * d)); for (let y = capY + 93; y <= gy; y++) fb.px(x, y, (x % 4 === 0) ? K : D); }
  // ruins: two broken walls, an arch stub
  const wall = (x, y, w, h, jag) => {
    for (let i = 0; i < w; i++) { const top = y + Math.round(jag * hash(i >> 2, x)); fb.rect(x + i, top, 1, G - top, L); }
    for (let j = y; j < G; j += 5) { fb.hline(x, x + w - 1, j, D); for (let i = x + ((j / 5) & 1) * 4; i < x + w; i += 8) fb.vline(i, j, j + 4, D); }
    fb.rect(x, y, 1, G - y, K); fb.rect(x + w - 1, y, 1, G - y, K);
  };
  wall(4, G - 38, 24, 38, 10); wall(150, G - 46, 26, 46, 12);
  // moss caps on the walls
  for (const [x, w, y] of [[4, 24, G - 38], [150, 26, G - 46]]) for (let i = 0; i < w; i++) { let yy = G; for (let j = y - 2; j < G; j++) if (fb.get(x + i, j) === L || fb.get(x + i, j) === D) { yy = j; break; } fb.px(x + i, yy, D); fb.px(x + i, yy + 1, D); }
  // ground: one tone with a dark root band
  fb.rect(0, G, W, H - G, D); fb.rect(0, G, W, 2, K);
  for (let x = 0; x < W; x += 9) fb.vline(x + (x * 7) % 5, G + 6, G + 6 + (x % 4) * 3, K);
  // the fallen bell of the old tower, mossy
  const bx = 140, by = G - 9;
  fb.rect(bx - 6, by, 13, 9, L); fb.rect(bx - 7, by + 7, 15, 2, L); fb.rect(bx + 3, by + 1, 3, 8, D);
  fb.hline(bx - 6, bx + 6, by, K); fb.rect(bx - 7, by, 1, 9, K); fb.rect(bx + 7, by, 1, 9, K); fb.px(bx - 3, by + 2, Wt);
  for (let i = -6; i < 7; i += 3) fb.px(bx + i, by + 1, D);
  // small mushrooms
  for (const [x, s] of [[66, 5], [73, 3], [124, 4]]) { fb.rect(x, G - s - 2, 2, s + 2, Wt); fb.rect(x - s + 1, G - s - 4, 2 * s, 2, D); fb.hline(x - s + 1, x + s, G - s - 5, K); }
  // the bearer of year 500 (standing, breathing) with the lantern, against the bright mist
  const s = BEARER.pass, bxp = 40, byp = G - BEARER.h + (Math.floor(t * 1.5) % 2 ? -1 : 0) + 1;
  fb.blit(s, bxp, byp);
  const fl = lantern(fb, bxp + BEARER.hand[0], byp + BEARER.hand[1], t);
  // spores: slow glints rising (12 fps twinkle) — dark specks on the bright sky, light ones on the cap
  for (let k = 0; k < 22; k++) {
    const sx = Math.round((hash(k, 1) * W + Math.sin(t * .7 + k) * 6) % W), sy = Math.round(((hash(k, 2) * 700 - t * 9) % 700 + 700) % 700 + oy);
    if (Math.floor(t * 12 + k) % 5 === 0) continue;
    const under = fb.get(sx, sy); fb.rect(sx, sy, 2, 2, under === Wt ? L : Wt);
  }
  return { flame: fl };
}
export function ruinsFog(t, camY) {
  return (x, y) => { const wy = y + camY; const band = Math.sin(wy * .025 + 1) * .5 + .5; return wy > RUINS.ground - 30 && wy < RUINS.ground + 4 ? clamp(.25 * fbm(x * .04 - t * .4, wy * .05, 12), 0, 1) : 0; };
}

// ———————— E / F · year 1000: the hill. sunR 0 = no sun; flood handled by the caller ————————
export const HILL = { top: 195 };
export function hill(fb, t, o) {
  fb.gradV(0, 0, W, 200, [C.blue, C.blue, C.cyan, C.cyan, C.white]);
  if (o.sunR > .5) {
    const r = o.sunR, cx = SUNP[0], cy = SUNP[1];
    for (let j = -r - 10; j <= r + 10; j++) for (let i = -r - 10; i <= r + 10; i++) { const q = Math.hypot(i, j); if (q <= r || q > r + 10) continue; const k = 1 - (q - r) / 10; if (bayer(cx + i, cy + j) < k * .8 * o.halo) fb.px(cx + i, cy + j, k > .6 ? C.white : C.cyan); }
    fb.disc(cx, cy, r, C.amber); fb.disc(cx - 1, cy - 1, Math.max(1, r - 2), C.yellow); if (r > 6) fb.disc(cx - 3, cy - 3, r * .35, C.white);
    // rays: 8 dithered spokes that turn slowly
    if (o.rays > 0) for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2 + t * .15; for (let q = r + 4; q < r + 4 + 10 * o.rays; q++) { const x = Math.round(cx + Math.cos(an) * q), y = Math.round(cy + Math.sin(an) * q); if ((q & 1) === 0) fb.px(x, y, C.yellow); } }
  }
  if (o.clouds) { cloud(fb, 14 + t * 2, 64, 26); cloud(fb, 150 - t * 1.6, 92, 20); }
  // horizon: distant giant mushrooms (the world kept them)
  for (const [x, top, r] of [[24, 160, 12], [62, 172, 7], [168, 150, 16], [142, 176, 6]]) { fb.rect(x - 2, top + r * .7, 4, 40, C.teal); dome(fb, x, top, r, r * .7, { lit: C.teal, mid: C.teal, dark: C.dgreen, spot: C.teal }); }
  hills(fb, 200, 10, .03, 51, C.dgreen, C.teal);
  // the hill
  for (let x = 0; x < W; x++) {
    const top = Math.round(HILL.top + ((x - 98) / 70) ** 2 * 16);
    for (let y = top; y < H; y++) {
      let c = C.green;
      if (y === top) c = C.lime; else if (bayer(x, y) < clamp((y - top) / 60, 0, .6)) c = C.dgreen;
      fb.px(x, y, c);
    }
    if (hash(x, 3) > .55) fb.vline(x, top - 2 - Math.round(hash(x, 4) * 2), top, C.lime);
  }
  // flowers: grey in the fog, they bloom when the colour returns
  for (let k = 0; k < 34; k++) {
    const x = Math.round(hash(k, 7) * W), y = Math.round(HILL.top + 14 + hash(k, 8) * 110);
    const c = [C.pink, C.white, C.yellow, C.rose][k % 4];
    fb.px(x, y, c); fb.px(x + 1, y, c); fb.px(x, y + 1, c); fb.px(x + 1, y + 1, C.lime === c ? c : c); fb.px(x, y + 2, C.dgreen);
  }
  if (o.birds) birds(fb, o.birdT, [{ x: -10, y: 70, vx: 22, p: 0 }, { x: -24, y: 82, vx: 20, p: 1.1 }, { x: 200, y: 58, vx: -18, p: .5 }]);
}
export function hillFog(t) {
  return (x, y) => clamp(.42 + .3 * (fbm(x * .025 - t * .2, y * .03, 33) - .5) - (y > 196 ? .12 : 0) - (Math.abs(x - 97) < 22 && y > 120 && y < 196 ? .1 : 0), 0, 1);
}
