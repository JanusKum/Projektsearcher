// main.js — director script for "Nebel · 1000 Jahre": shots, fog eras (palette tables), transitions, sound events (EV),
// subtitles (SUBS, the dialogue box) and readable texts (TEXTS). Everything is a function of t.
import { W, H, SCALE, FB, C, LUT, makeOut, mosaic, whiten, darken, bayer8, clamp, lerp, eio, eo, ss } from './px.js';
import { village, villageFog, field, fieldFog, FIELD, village100, vill100Fog, dropTimes, ruins, ruinsFog, hill, hillFog, fogPass, halo, SUNP } from './scenes.js';
import { childSprite, childPortrait, lantern, CHILD, FARMER, BEARER } from './sprites.js';
import { dialog, sysMsg, yearWin, sunWin, inventory, win, YEARWIN, SUNWIN, INV, BOX } from './ui.js';
import { text, textW, textOutlined } from './font.js';

const q = new URLSearchParams(location.search);
const NOSUB = q.has('nosub');
const fb = new FB(), out = makeOut(document.getElementById('c'));
const TL = await (await fetch('./timeline.json')).json();
const LINES = await (await fetch('./voice/lines.json')).json();
const VDUR = await (await fetch('./voice/dur.json')).json();
const LINE = Object.fromEntries(LINES.map(l => [l.id, l]));
const HIT = TL.hits;

// ———————— Subtitles (the dialogue box) ————————
const SUBS = [];
const SKIN = { l1: 'snes', l2: 'snes', l3: 'nes', l4: 'gb', l5: 'snes' };
for (const id of ['l1', 'l2', 'l3', 'l4', 'l5']) {
  const t0 = TL.vo[id], t1 = t0 + VDUR[id];
  SUBS.push({ id, t0: +(t0 - .05).toFixed(3), t1: +Math.max(t1 + .62, t0 + 1.8).toFixed(3), text: LINE[id].text, skin: SKIN[id], cps: 38 });
}
const CHILD_LINE = 'Was… ist das?';
SUBS.push({ id: 'child', t0: HIT.childLine, t1: 32.9, text: CHILD_LINE, skin: 'snes', cps: 13, portrait: true });
// each box ends where the next begins
for (let i = 0; i < SUBS.length - 1; i++) SUBS[i].t1 = Math.min(SUBS[i].t1, SUBS[i + 1].t0);

// ———————— Sound events ————————
const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
function typing(t0, s, cps, type, every = 2) { let k = 0; for (let i = 0; i < s.length; i++) { if (s[i] === ' ') continue; if (k++ % every === 0) ev(t0 + i / cps, type, { ch: i }); } }
for (const id of ['l1', 'l2', 'l3', 'l4', 'l5']) ev(TL.vo[id], 'vo', { id });
for (const s of SUBS) ev(s.t0, 'sub', { t1: s.t1, text: s.text });
// A · village
ev(0, 'bed', { name: 'birds', t1: 2.2, gain: .7 });
ev(0.5, 'bed', { name: 'fogroll', t1: 5.0, gain: .9 });
ev(1.55, 'flutter');
ev(HIT.nebelHit, 'hit'); ev(HIT.nebelHit, 'openUI'); typing(HIT.nebelHit + .05, 'NEBEL erscheint!', 45, 'blipUI');
ev(4.8, 'whoosh');
// B · year 1
ev(5.0, 'bed', { name: 'wind', t1: 9.9, gain: .7 });
ev(5.0, 'bitdrop', { k: 0 }); ev(7.5, 'bitdrop', { k: 1 });
for (let s = 5.6; s < 8.2; s += .1) ev(s, 'tick');
ev(7.55, 'creak'); ev(8.2, 'kneel');
ev(9.75, 'mosaic', { up: 1 });
// C · year 100
ev(10.0, 'bell', { far: 1 }); ev(HIT.bell2, 'bell'); ev(HIT.bell3, 'bell');
ev(10.0, 'bed', { name: 'wind', t1: 15.0, gain: .55 });
for (let s = 10.25; s < 14.8; s += .25) ev(s, 'step', { v: .55 + .3 * Math.sin(s * 3) ** 2 });
for (const d of dropTimes(10.2, 14.8)) ev(d, 'drip', { pan: -.2 });
ev(14.8, 'whoosh');
// D · year 500
ev(15.0, 'bitdrop', { k: 2 }); ev(15.0, 'bed', { name: 'hum', t1: 20.0, gain: .6 });
ev(17.4, 'shimmer'); ev(18.9, 'shimmer');
ev(19.75, 'mosaic', { up: 1 });
// E · year 1000
ev(20.0, 'bed', { name: 'wind', t1: 24.9, gain: .45 });
ev(HIT.invOpen, 'slide'); ev(HIT.invOpen + .3, 'openUI');
ev(HIT.cursorSun, 'cursor');
// silence 25.0–26.25, then the only organic sound
ev(HIT.breath, 'breath');
ev(26.5, 'flood'); for (let i = 0; i < 6; i++) ev(26.7 + i * .3, 'ignite', { pan: i % 2 ? .5 : -.5 });
ev(26.25, 'bed', { name: 'wind', t1: TL.dur, gain: .5 });
ev(HIT.sunFull, 'sparkle'); for (let s = HIT.sunFull + .05; s < HIT.sunFull + .85; s += .07) ev(s, 'savetick');
ev(HIT.childLine, 'openUI'); typing(HIT.childLine + .1, CHILD_LINE, 13, 'blipC', 1);
ev(29.8, 'bed', { name: 'birds', t1: TL.dur, gain: .5 }); ev(30.3, 'chirp'); ev(31.05, 'chirp'); ev(32.6, 'chirp');
ev(HIT.year1001, 'select');
window.EV = EV; window.SUBS = SUBS;

// ———————— helpers ————————
const shakeOff = (t, t0) => { const k = Math.floor((t - t0) * 24); return [[3, -3, 2, -2, 1, -1, 1, 0][k] || 0, [0, 2, -2, 1, -1, 0, 1, 0][k] || 0]; };
function shake(u32, dx, dy) { if (!dx && !dy) return; const src = u32.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = clamp(x - dx, 0, W - 1), sy = clamp(y - dy, 0, H - 1); u32[y * W + x] = src[sy * W + sx]; } }
function halfRes(f) { const d = f.d; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[y * W + x] = d[(y & ~1) * W + (x & ~1)]; }
const step12 = t => Math.floor(t * 12) / 12;
function drawSubs(t) {
  if (NOSUB) return;
  for (const s of SUBS) if (t >= s.t0 && t < s.t1) {
    dialog(fb, { skin: s.skin, text: s.text, t: t - s.t0 - .05, cps: s.cps, portrait: s.portrait ? childPortrait(Math.floor(t * 2.3) % 7 === 6) : null });
  }
}
// whiten in / out by palette steps around a cut
function stepFade(L, t, cut, w = .2) { if (t >= cut - w && t < cut) return whiten(L, (t - (cut - w)) / w); if (t >= cut && t < cut + w) return whiten(L, 1 - (t - cut) / w); return L; }
function mos(t, cut, w = .25) { if (t >= cut - w && t < cut) return Math.round(1 + 11 * ss(cut - w, cut, t)); if (t >= cut && t < cut + w) return Math.round(1 + 11 * (1 - ss(cut, cut + w, t))); return 1; }

// child pose over time (12 fps steps)
function childRaise(t) {
  t = step12(t);
  if (t < 25.1) return 0;
  if (t < 25.3) return -.08 * ss(25.1, 25.3, t);                    // anticipation: a small dip
  if (t < 26.0) return lerp(-.08, 1.06, eo(clamp((t - 25.3) / .7, 0, 1)));
  if (t < 26.2) return lerp(1.06, 1, (t - 26.0) / .2);
  if (t < 27.9) return 1;
  if (t < 28.5) return 1 - eio((t - 27.9) / .6);
  return 0;
}
const OX = 62, OY = 101;      // child sprite position: raised flame lands on SUNP
const floodR = t => t < 26.5 ? 0 : 262 * Math.pow(clamp((t - 26.5) / 2.2, 0, 1), 1.35);
const inFlood = (x, y, R) => Math.hypot(x - SUNP[0], (y - SUNP[1]) * 1.05) < R - bayer8(x, y) * 36;

// ———————— the frame ————————
const sectionTexts = [];
function frame(t) {
  fb.clear(C.ink);
  let L = LUT.full, pick = null, post = [];
  if (t < 5.0) {
    // A · year 0
    const edge = t < .6 ? 240 : t < 2.5 ? lerp(240, 112, (t - .6) / 1.9) : lerp(112, 20, eo((t - 2.5) / 2.5));
    const fl = Math.max(0, t - 1.55);
    const birdList = [{ x: 150 - 8 * t - 70 * fl * fl, y: 120 - 30 * fl, vx: 0, p: 0 }, { x: 166 - 9 * t - 76 * fl * fl, y: 112 - 26 * fl, vx: 0, p: 1.3 }];
    village(fb, t, { recoil: t >= HIT.nebelHit && t < HIT.nebelHit + .35, birdList });
    fogPass(fb, villageFog(t, edge));
    yearWin(fb, 'JAHR 0');
    if (t >= HIT.nebelHit - .08) sysMsg(fb, 'NEBEL erscheint!', 34, t - HIT.nebelHit + .08);
    drawSubs(t);
    L = stepFade(LUT.full, t, 5.0);
    if (t >= HIT.nebelHit && t < HIT.nebelHit + .34) post.push(u => shake(u, ...shakeOff(t, HIT.nebelHit)));
  } else if (t < 10.0) {
    // B · year 1
    const camY = Math.round(140 * eio(clamp((t - HIT.tiltB) / 1.25, 0, 1)));
    const wilt = clamp((t - HIT.wilt) / 1.0, 0, 1), sunF = 1 - clamp((t - 5.6) / 2.6, 0, 1);
    const pose = t < 8.2 ? 'stand' : t < 8.33 ? 'crouch' : 'kneel';
    field(fb, t, camY, { wilt, pose, sunR: Math.round(12 * sunF) });
    fogPass(fb, fieldFog(t, camY, 1 + .35 * clamp((t - 5) / 4, 0, 1)));
    yearWin(fb, 'JAHR 1'); sunWin(fb, sunF);
    drawSubs(t);
    L = t < HIT.wilt ? LUT.fog1 : LUT.fog2;
    L = stepFade(L, t, 5.0);
    const n = mos(t, 10.0); if (n > 1) post.push(u => mosaic(u, n));
  } else if (t < 15.0) {
    // C · year 100
    const camX = Math.round(150 * (t - 10) / 5);
    const bell = [10.0, HIT.bell2, HIT.bell3].reduce((s, r) => t >= r ? s + Math.sin((step12(t) - r) * 2 * Math.PI * 1.6) * Math.exp(-(t - r) * 1.1) : s, 0);
    const st = village100(fb, t, camX, { bell, bearerX: 40 + 36 * (t - 10) });
    fogPass(fb, vill100Fog(t), [{ x: st.flame[0], y: st.flame[1], r: 22 }]);
    halo(fb, st.flame[0], st.flame[1], 5, t);
    yearWin(fb, 'JAHR 100', 'nes');
    drawSubs(t);
    L = stepFade(LUT.nesKeep, t, 15.0);
    const n = mos(t, 10.0); if (n > 1) post.push(u => mosaic(u, n));
  } else if (t < 20.0) {
    // D · year 500 (drawn in four moss greys at half resolution; the lantern keeps its colour)
    const camY = Math.round(380 * (1 - eio(clamp((t - 15.6) / 3.8, 0, 1))));
    const st = ruins(fb, t, camY, {});
    fogPass(fb, ruinsFog(t, camY), [{ x: st.flame[0], y: st.flame[1], r: 18 }]);
    halfRes(fb);
    yearWin(fb, 'JAHR 500', 'gb');
    drawSubs(t);
    L = stepFade(LUT.moss4, t, 15.0);
    const n = mos(t, 20.0); if (n > 1) post.push(u => mosaic(u, n));
  } else {
    // E / F · year 1000 → the fog lifts
    const R = floodR(t), F = t >= 26.25;
    const sunR = t < 26.4 ? 0 : Math.round(12 * eo(clamp((t - 26.4) / .9, 0, 1)));
    hill(fb, t, { sunR, halo: clamp((t - 26.8) / 1.2, 0, 1), rays: clamp((t - HIT.sunFull) / .5, 0, 1), clouds: true, birds: t > 29.8, birdT: t - 29.8 });
    const raise = childRaise(t), breath = raise === 0 && Math.floor(t * .8) % 2 === 1;
    const sway = Math.round(Math.sin(t * (F ? 2.2 : 1.1)) * (F ? 2 : 1));
    const c = childSprite({ raise: Math.max(0, raise) + Math.min(0, raise), breath, sway });
    fb.blit(c.spr, OX, OY + (raise < 0 ? 1 : 0));
    const flame = lantern(fb, OX + c.hand[0], OY + c.hand[1] + (raise < 0 ? 1 : 0), t);
    const fog = hillFog(t);
    fogPass(fb, F ? (x, y) => fog(x, y) * (1 - clamp((R - Math.hypot(x - SUNP[0], y - SUNP[1])) / 40, 0, 1)) : fog,
      t < 27.6 ? [{ x: flame[0], y: flame[1], r: 26 }] : []);
    if (t >= 25.0) halo(fb, flame[0], flame[1], 4, t);
    // UI
    if (t < 25.0) yearWin(fb, 'JAHR 1000');
    if (t >= HIT.invOpen && t < 25.0) {
      const dy = t < HIT.invOpen + .3 ? Math.round(-110 * (1 - eo((t - HIT.invOpen) / .3))) : t > 24.8 ? Math.round(-110 * eio((t - 24.8) / .2)) : 0;
      const onSun = t >= HIT.cursorSun, mv = onSun ? clamp((t - HIT.cursorSun) / .15, 0, 1) : 0;
      inventory(fb, { dy, cursor: onSun ? 1 : 0, cursorY: Math.round(mv * 11) / 11, t, bob: t < HIT.cursorStop, desc: t >= HIT.cursorSun + .05 ? 'Nur eine Legende.' : '' });
    }
    if (t >= HIT.sunFull) sunWin(fb, clamp((t - HIT.sunFull - .05) / .8, 0, 1));
    if (t >= HIT.year1001) yearWin(fb, 'JAHR 1001', 'snes', Math.floor((t - HIT.year1001) * 6) % 2 === 0 && t < HIT.year1001 + .7);
    drawSubs(t);
    L = LUT.faded;
    if (F && t < 28.75) pick = (x, y) => inFlood(x, y, R);
    if (t >= 28.75) L = LUT.full;
    const n = mos(t, 20.0); if (n > 1 && t < 20.25) post.push(u => mosaic(u, n));
  }
  if (pick) out.present(fb, L, LUT.full, pick); else out.present(fb, L);
  for (const p of post) p(out.u32);
  out.post(() => {}); out.show();
}

// ———————— texts on screen (for readcheck): boxes in output pixels ————————
const box6 = (id, s, b) => ({ id, text: s, x0: b.x * SCALE, y0: b.y * SCALE, x1: (b.x + b.w) * SCALE, y1: (b.y + b.h) * SCALE });
window.TEXTS = t => {
  const T = [];
  const yw = s => T.push(box6('year', s, YEARWIN));
  if (t < 5.0) yw('JAHR 0'); else if (t < 10) yw('JAHR 1'); else if (t < 15) yw('JAHR 100'); else if (t < 20) yw('JAHR 500'); else if (t < 25) yw('JAHR 1000');
  if (t >= HIT.year1001) yw('JAHR 1001');
  if (t >= HIT.nebelHit - .08 && t < 5.0) { const w = Math.max(110, textW('NEBEL erscheint!') + 20); T.push(box6('msg', 'NEBEL erscheint!', { x: (W - w) / 2, y: 34, w, h: 17 })); }
  if ((t >= 5.0 && t < 10) || t >= HIT.sunFull) T.push(box6('sun', 'SONNE', SUNWIN));
  if (t >= HIT.invOpen + .3 && t < 24.8) {
    T.push(box6('inv', 'INVENTAR LATERNE ×1 SONNE ???', INV));
    if (t >= HIT.cursorSun + .05) T.push(box6('desc', 'Nur eine Legende.', INV));
  }
  return T;
};

// ———————— model sheet: ?sheet=1 ————————
function sheet() {
  fb.clear(C.night);
  fb.gradV(0, 0, W, H, [C.night, C.dslate]);
  text(fb, 'NEBEL · MODELLBLATT', 6, 5, C.white, C.ink);
  fb.blit(FARMER.stand, 6, 20); fb.blit(FARMER.crouch, 24, 25); fb.blit(FARMER.kneel, 42, 25);
  fb.blit(BEARER.apart, 62, 18); lantern(fb, 62 + BEARER.hand[0], 18 + BEARER.hand[1], .1);
  fb.blit(BEARER.pass, 82, 17); lantern(fb, 82 + BEARER.hand[0], 17 + BEARER.hand[1], .2);
  fb.blit(childPortrait(), 104, 16); fb.blit(childPortrait(true), 140, 16);
  [0, .5, 1].forEach((r, i) => { const c = childSprite({ raise: r, breath: false, sway: 0 }); fb.blit(c.spr, -6 + i * 60, 56); lantern(fb, -6 + i * 60 + c.hand[0], 56 + c.hand[1], .3 * i); });
  text(fb, 'PALETTEN: VOLL / NEBEL1 / NEBEL2 / 8BIT / MOOS4 / VERBLASST', 4, 162, C.white, C.ink);
  out.present(fb, LUT.full);
  const eras = [LUT.full, LUT.fog1, LUT.fog2, LUT.nesKeep, LUT.moss4, LUT.faded];
  out.post(u => { eras.forEach((Lt, r) => { for (let i = 0; i < 36; i++) for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) u[(176 + r * 10 + y) * W + 6 + i * 4 + x] = Lt[i]; }); });
  dialog(fb, { text: 'Die Dialogbox: ÄÖÜ äöü ß … 1000', t: 9 });
  out.present(fb, LUT.full);
  out.post(u => { eras.forEach((Lt, r) => { for (let i = 0; i < 36; i++) for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) u[(176 + r * 10 + y) * W + 6 + i * 4 + x] = Lt[i]; }); });
  out.show();
}
// ———————— poster: ?poster=1 ————————
function poster() {
  frame(30.6);
  const s1 = 'NEBEL', s2 = '1000 JAHRE';
  const col = y => y < 2 ? C.white : y < 4 ? C.yellow : y < 6 ? C.amber : C.orange;
  fb.clear(C.ink);
  const R = 999;
  hill(fb, 30.6, { sunR: 12, halo: 1, rays: 1, clouds: true, birds: true, birdT: .8 });
  const c = childSprite({ raise: 0, breath: false, sway: 1 }); fb.blit(c.spr, OX, OY); lantern(fb, OX + c.hand[0], OY + c.hand[1], .3);
  win(fb, 20, 40, 140, 58);
  textOutlined(fb, s1, Math.round((W - textW(s1, 3)) / 2), 48, col, C.ink, 3);
  text(fb, s2, Math.round((W - textW(s2)) / 2), 80, C.silver, C.night);
  out.present(fb, LUT.full); out.show();
}
window.render = t => q.has('sheet') ? sheet() : q.has('poster') ? poster() : frame(t);
window.DUR = TL.dur; window.READY = true;
