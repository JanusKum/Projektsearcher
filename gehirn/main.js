// DEIN GEHIRN LÜGT · Pop Art · 1080×1920 · 24 fps · 120 BPM (beat 0.5 s). Printed with the style's four-plate engine.
import { createPop, T, rectPts, ellipsePts } from './engine/pop.js';
const W = 1080, H = 1920, DUR = 30.0;
const pop = createPop(document.getElementById('c'), { W, H });
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const ei = k => Math.pow(clamp(k), 3);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const back = (k, s = 1.7) => { k = clamp(k) - 1; return 1 + k * k * ((s + 1) * k + s); };

const S = {   // shot starts
  hook: 0, wall: 3.5, blind: 6.5, strip: 9.0, hour: 11.4, mirror: 14.4, hush: 20.0, clock: 20.5, final: 26.0,
};
// saccades: three per second during the wall shots; each is a 2-frame jump of every iris at once
const SACC = []; for (let t = 3.9; t < 9.0; t += 1 / 3) SACC.push(+t.toFixed(3));
const VO = [{ id: 'v1', t: 0.3 }, { id: 'v2', t: 3.6 }, { id: 'v3', t: 6.8 }, { id: 'v4', t: 11.6 }, { id: 'v5', t: 14.6 }, { id: 'v6', t: 20.6 }, { id: 'v7', t: 26.4 }];
const CUES = [
  [0.3, 1.9, 'Dein Gehirn lügt dich an.'], [1.9, 3.5, 'Jeden Tag.'],
  [3.6, 6.5, 'Deine Augen springen dreimal pro Sekunde.'],
  [6.8, 8.7, 'Bei jedem Sprung bist du blind.'], [8.7, 11.3, 'Und dein Gehirn schneidet es einfach raus.'],
  [11.6, 14.3, 'Zusammen über eine Stunde am Tag.'],
  [14.6, 17.2, 'Test: Schau im Spiegel von einem Auge zum anderen.'], [17.2, 20.0, 'Du siehst sie nie wandern.'],
  [20.6, 22.6, 'Und die Lücke füllt dein Gehirn auf.'], [22.6, 25.9, 'Darum wirkt die erste Sekunde auf einer Uhr länger.'],
  [26.4, 29.4, 'Was siehst du sonst noch nicht?'],
];

// —— the eye print: one poster tile (page units, centred, size s = tile width) ——
const lookAt = (t, seed = 0) => {   // where the iris points: jumps between fixations on each saccade, holds still in between
  let k = 0; for (const s of SACC) if (t >= s) k++;
  if (t < SACC[0]) k = Math.floor(t * 1.5);
  const a = hash(k * 3.1 + seed) * 6.283, r = .55 + .45 * hash(k * 7.7 + seed);
  return [Math.cos(a) * r, Math.sin(a) * r * .6];
};
function eye(x, y, s, o = {}) {
  const g = o.ground || T.red, iris = o.iris || T.blue, look = o.look || [0, 0], lid = o.lid || 0;
  pop.save(); pop.translate(x, y);
  if (!o.noTile) { pop.fill(rectPts(-s / 2, -s / 2, s, s), g); pop.outline(rectPts(-s / 2, -s / 2, s, s), s * .012); }
  // the almond of the eye (two arcs), lids close by flattening it
  const ew = s * .40, eh = s * .22 * (1 - lid);
  const alm = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = Math.PI * u; alm.push([-ew * Math.cos(a), -eh * Math.sin(a) * (1.1 - .1 * Math.cos(a))]); }
  for (let i = 0; i <= 40; i++) { const u = i / 40, a = Math.PI * u; alm.push([ew * Math.cos(a), eh * Math.sin(a) * .85]); }
  pop.fill(alm, T.white);
  if (eh > s * .01) {
    pop.save(); pop.clip(alm);
    const ix = look[0] * ew * .5, iy = look[1] * eh * .5, R = s * .13;
    pop.fill(ellipsePts(ix, iy, R, R), iris);
    pop.over(ellipsePts(ix + R * .15, iy + R * .2, R * .95, R * .95), { r: .25, b: .55 });   // a darker lower half in dots
    pop.fill(ellipsePts(ix, iy, R * .45, R * .45), { r: .0 }); pop.black(ellipsePts(ix, iy, R * .45, R * .45));
    pop.knock(ellipsePts(ix - R * .38, iy - R * .38, R * .17, R * .17));
    pop.outline(ellipsePts(ix, iy, R, R), s * .008);
    pop.restore();
  }
  pop.line(alm, s * .02, { closed: true, taper: 0 });
  // lashes and brow
  for (let i = 0; i < 7; i++) { const u = (i + 1) / 8, a = Math.PI * u, px = -ew * Math.cos(a), py = -eh * Math.sin(a) * 1.05; pop.line([[px, py], [px * 1.18, py - s * .06 - (1 - lid) * s * .015]], s * .014, { taper: .4 }); }
  pop.line([[-ew * 1.05, -s * .3], [0, -s * .37], [ew * 1.05, -s * .3]], s * .03, { taper: .45 });
  pop.restore();
}
// big condensed headline, printed in: colour lands from an offset, the key snaps on
function headline(str, x, y, size, t0, t, o = {}) {
  const k = seg(t, t0, t0 + .35); if (k <= 0) return;
  const dx = (1 - eo(k)) * -60;
  pop.text(str, x + dx, y, { size, font: 'Anton', fill: o.fill || T.yellow, outline: size * .06, shadow: { dx: size * .05, dy: size * .05, ink: o.shadow || T.red }, letter: o.letter ?? 2, read: 'head:' + str, rot: o.rot || 0 });
}
// a paper slip label (top-left by default)
function label(x, y, text, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + .4) return;
  const e = eo(seg(t, t0, t0 + .4)), out = t > t1 ? -ei(seg(t, t1, t1 + .35)) * 1300 : 0;
  const size = o.size || 72, w = pop.measure(text, { size, font: 'Anton', letter: 1 }) + 60, h = size * 1.25 + 36;
  pop.save(); pop.translate(x + out + (1 - e) * -80, y); pop.rotate(o.rot ?? -.03);
  pop.fill(rectPts(12, 12, w, h), o.ink || T.blue); pop.fill(rectPts(0, 0, w, h), T.white); pop.outline(rectPts(0, 0, w, h), 5);
  pop.text(text, 30, h / 2 + 2, { size, font: 'Anton', align: 'left', letter: 1, read: 'label:' + text });
  pop.restore();
}
const screenSpace = () => { for (const g of [pop.P, pop.L, pop.S]) g.setTransform(1, 0, 0, 1, 0, 0); };
const bleed = ink => pop.fill(rectPts(-9000, -9000, 18000, 18000), ink);
// subtitles: paper slip, bottom centre, drawn in screen space
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  for (const g of [pop.P, pop.L, pop.S]) g.setTransform(1, 0, 0, 1, 0, 0);
  let size = 42; let w = pop.measure(c[2], { size, font: 'Archivo' }); if (w > 920) { size = Math.floor(size * 920 / w); w = pop.measure(c[2], { size, font: 'Archivo' }); }
  const p = eo(seg(t, c[0], c[0] + .14)), bw = w + 64, bh = 92, x = (W - bw) / 2, y = 1712 + (1 - p) * 20;
  pop.fill(rectPts(x + 9, y + 9, bw, bh), T.red); pop.fill(rectPts(x, y, bw, bh), T.white); pop.outline(rectPts(x, y, bw, bh), 4);
  pop.text(c[2], W / 2, y + bh / 2 + 2, { size, font: 'Archivo' });
}

// —— shots ——
function frame(t) {
  let cam = { x: 0, y: 0, zoom: 1, rot: 0 }, fx = { cell: 5.6 };
  const shake = (t0, amp = 14) => { const k = Math.exp(-(t - t0) / .09); if (t >= t0 && k > .02) { const f = Math.floor(t * 24); cam.x += (hash(f) - .5) * amp * k / cam.zoom; cam.y += (hash(f + 5) - .5) * amp * k / cam.zoom; } };
  const sacc = SACC.find(s => t >= s && t < s + 2 / 24);   // the two frames of a jump

  if (t < S.wall) {
    // HOOK: a stamp on bare paper → one huge eye; the headline prints in; the eye darts
    const st = seg(t, 0.05, 0.25), sc = lerp(1.25, 1, eo(st));
    cam.zoom = lerp(1.0, 1.12, eio(seg(t, .3, 3.5)));
    shake(.25, 26); shake(2.0, 12); shake(2.5, 12);
    pop.begin(cam);
    if (t > .05) {
      bleed(T.yellow);
      pop.save(); pop.scale(sc); eye(0, 160, 1000, { ground: T.red, iris: T.blue, look: t < 2.0 ? [0, 0] : t < 2.5 ? [-.9, -.2] : t < 3.0 ? [.9, .25] : [0, 0] }); pop.restore();
    }
    screenSpace();
    headline('DEIN GEHIRN', W / 2, 250, 170, .55, t, { fill: T.white, rot: -.04 });
    headline('LÜGT.', W / 2, 470, 260, 1.1, t, { fill: T.red, shadow: T.blue, rot: -.04 });
    fx.mask = [1, 1, 1, 1];
    if (t < .05) fx.mask = [0, 0, 0, 0];
  } else if (t < S.blind) {
    // WALL: push into the pupil, then pull back to a wall of eyes stamped faster and faster; all jump together
    const u = seg(t, S.wall, S.wall + 2.2);
    cam.zoom = Math.exp(lerp(Math.log(2.6), Math.log(.34), eio(u)));
    cam.y = lerp(80, 0, eio(u));
    pop.begin(cam);
    const order = []; for (let j = -5; j <= 5; j++) for (let i = -3; i <= 3; i++) order.push([i, j, Math.hypot(i, j * .8)]);
    order.sort((a, b) => a[2] - b[2]);
    order.forEach(([i, j], n) => {
      const ts = S.wall + .15 + .9 * Math.sqrt(n / order.length) * 1.4;   // stamps accelerate
      if (t < ts) return;
      const k = seg(t, ts, ts + .12), sc = lerp(1.15, 1, eo(k));
      const grounds = [T.red, T.yellow, T.blue], irises = [T.blue, T.blue, T.yellow];
      const gi = (i + j + 9) % 3;
      pop.save(); pop.translate(i * 1000, j * 1000 + (i === 0 && j === 0 ? 80 : 0)); pop.scale(sc);
      eye(0, 0, 1000, { ground: grounds[gi], iris: irises[gi], look: lookAt(t, 0) });
      pop.restore();
    });
    screenSpace(); label(40, 120, '3 SPRÜNGE / SEKUNDE', t, 4.4, 6.3, { size: 76, ink: T.red });
    if (sacc) fx.mask = [0, 0, 0, 1];   // during the jump: no colour reaches the brain
  } else if (t < S.strip) {
    // BLIND: same wall, every jump knocks out all plates for two frames (bare paper), a slip says so
    cam.zoom = lerp(.34, .42, eio(seg(t, S.blind, S.strip)));
    pop.begin(cam);
    for (let j = -5; j <= 5; j++) for (let i = -3; i <= 3; i++) { const gi = (i + j + 9) % 3; eye(i * 1000, j * 1000, 1000, { ground: [T.red, T.yellow, T.blue][gi], iris: [T.blue, T.blue, T.yellow][gi], look: lookAt(t, 0), lid: 0 }); }
    screenSpace(); label(40, 120, 'BEI JEDEM SPRUNG: BLIND', t, 6.8, 8.8, { size: 76, ink: T.yellow });
    if (sacc) { fx.mask = [0, 0, 0, 1]; headline('BLIND', W / 2, H / 2 - 80, 320, sacc - .5, t, { fill: T.white, shadow: T.red }); }
  } else if (t < S.hour) {
    // STRIP: a long strip of frames tracks past; every third frame is blank paper; the blanks are cut out and the strip snaps shut
    const u = seg(t, S.strip, S.hour);
    cam.zoom = .95; cam.x = lerp(-1700, 1900, eio(u)); cam.y = 0;
    const cut = eo(seg(t, 9.9, 10.5)), close = eio(seg(t, 10.5, 11.1));
    shake(10.5, 16); shake(11.05, 20);
    pop.begin(cam);
    bleed(T.blue); for (let k = -12; k < 12; k++) pop.over(rectPts(-9000, k * 380, 18000, 190), { b: .45 });
    let x = -2600;
    for (let n = 0; n < 12; n++) {
      const blank = n % 3 === 2, fw = 900;
      if (blank) {
        const yy = -cut * 2600 * (n % 2 ? 1 : -1), rot = cut * .4 * (n % 2 ? 1 : -1);
        pop.save(); pop.translate(x + fw / 2, yy); pop.rotate(rot);
        pop.fill(rectPts(-fw / 2, -fw / 2 - 160, fw, fw + 320), T.white); pop.outline(rectPts(-fw / 2, -fw / 2 - 160, fw, fw + 320), 10);
        pop.text('BLIND', 0, 0, { size: 200, font: 'Anton', fill: T.white, outline: 10 });
        pop.restore();
        x += fw * (1 - close);
      } else {
        pop.save(); pop.translate(x + fw / 2, 0);
        pop.fill(rectPts(-fw / 2, -fw / 2 - 160, fw, fw + 320), T.yellow); pop.outline(rectPts(-fw / 2, -fw / 2 - 160, fw, fw + 320), 10);
        for (let k = 0; k < 5; k++) { pop.fill(rectPts(-fw / 2 + 50 + k * 170, -fw / 2 - 120, 90, 60), T.white); pop.fill(rectPts(-fw / 2 + 50 + k * 170, fw / 2 + 60, 90, 60), T.white); }
        eye(0, 0, fw - 80, { ground: n % 2 ? T.red : T.blue, iris: n % 2 ? T.blue : T.yellow, look: [hash(n) * 1.6 - .8, hash(n + 3) - .5] });
        pop.restore();
        x += fw;
      }
    }
    // the scissors' cut lines
    if (t > 9.6 && t < 10.6) for (let n = 2; n < 12; n += 3) { const cx = -2600 + n * 900; pop.line([[cx, -900], [cx, 900]], 8, { dash: 1 }); pop.line([[cx + 900, -900], [cx + 900, 900]], 8); }
    screenSpace(); label(40, 120, 'GEHIRN SCHNEIDET RAUS', t, 9.4, 11.1, { size: 76, ink: T.red });
  } else if (t < S.mirror) {
    // HOUR: closed eyes stamped in a ring around a giant headline, faster and faster
    const u = seg(t, S.hour, S.mirror);
    cam.zoom = lerp(.62, .7, eio(u)); cam.rot = lerp(-.04, .02, u);
    shake(11.6, 22);
    pop.begin(cam, { desk: '#1d2330' });
    pop.fill(rectPts(-1200, -1700, 2400, 3400), T.blue);
    const N = 22;
    for (let n = 0; n < N; n++) {
      const ts = S.hour + .1 + 1.6 * Math.pow(n / N, .6); if (t < ts) continue;
      const a = n / N * 6.283 - 1.57, R = 1150 + 180 * (n % 2);
      pop.save(); pop.translate(Math.cos(a) * R * .8, Math.sin(a) * R * 1.25); pop.rotate(a + 1.57); pop.scale(lerp(1.3, 1, eo(seg(t, ts, ts + .1))));
      eye(0, 0, 340, { ground: n % 2 ? T.yellow : T.red, iris: T.blue, lid: 1 }); pop.restore();
    }
    headline('ÜBER', 0, -380, 220, 11.7, t, { fill: T.white, shadow: T.red });
    headline('1 STUNDE', 0, -60, 400, 11.95, t, { fill: T.yellow, shadow: T.red, rot: -.03 });
    headline('BLIND / TAG', 0, 320, 230, 12.3, t, { fill: T.white, shadow: T.red });
  } else if (t < S.clock) {
    // MIRROR: a mirror print; two eyes inside jump left/right with no travel in between; a card flip brings it in
    const flip = seg(t, S.mirror, S.mirror + .3), sx = Math.abs(Math.cos(Math.PI * (1 - flip) / 2 * 0 + (1 - flip) * Math.PI / 2));
    cam.zoom = lerp(.5, .56, eio(seg(t, S.mirror, S.hush)));
    pop.begin(cam); bleed(T.red);
    pop.save(); pop.scale(Math.max(.02, eo(flip)), 1);
    pop.fill(rectPts(-1150, -1500, 2300, 3000), T.yellow); pop.outline(rectPts(-1150, -1500, 2300, 3000), 14);
    pop.fill(ellipsePts(0, -60, 820, 1120), T.blue); pop.over(ellipsePts(-200, -360, 520, 740), { b: .35 });
    pop.line(ellipsePts(0, -60, 820, 1120), 28, { closed: true, taper: 0 });
    pop.fill(rectPts(-200, 1060, 400, 260), T.red); pop.outline(rectPts(-200, 1060, 400, 260), 12);
    // the face in the mirror: two eyes. Jumps every 0.8 s; between, nothing moves
    const k = Math.floor(Math.max(0, t - S.mirror - .5) / .8), side = k % 2 ? .85 : -.85;
    for (const ex of [-330, 330]) eye(ex, -200, 600, { noTile: true, look: [side, 0], iris: T.blue });
    pop.line([[-60, 150], [0, 300], [60, 260]], 16);   // nose
    pop.restore();
    screenSpace(); label(40, 120, 'SPIEGEL-TEST', t, 14.8, 19.8, { size: 76, ink: T.red });
    if (t > 17.3) headline('KEINE BEWEGUNG?', W / 2, 1600, 110, 17.3, t, { fill: T.white, shadow: T.blue, rot: .03 });
    if (t > S.hush) { fx.gain = 1 + .4 * seg(t, S.hush, S.clock); }    // the held note: the print darkens
  } else if (t < S.final) {
    // CLOCK: a card flip to a clock print; the first second after the glance holds 1.6 s, then normal ticks
    const flip = seg(t, S.clock, S.clock + .3);
    cam.zoom = lerp(.6, .68, eio(seg(t, S.clock, S.final)));
    shake(S.clock + .3, 18);
    pop.begin(cam); bleed(T.blue);
    pop.save(); pop.scale(Math.max(.02, eo(flip)), 1);
    pop.fill(rectPts(-1100, -1500, 2200, 3000), T.yellow); pop.outline(rectPts(-1100, -1500, 2200, 3000), 14);
    pop.fill(ellipsePts(0, 0, 760, 760), T.white); pop.over(ellipsePts(120, 140, 700, 700), { b: .18 });
    pop.line(ellipsePts(0, 0, 760, 760), 34, { closed: true, taper: 0 });
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, r0 = i % 5 ? 690 : 640; pop.line([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * 735, Math.sin(a) * 735]], i % 5 ? 8 : 16, { taper: 0 }); }
    // ticks: glance at 21.6; the first tick comes 1.6 s later, then every 1 s
    const g0 = 21.6; let sec = 0;
    if (t >= g0 + 1.6) sec = 1 + Math.floor(t - g0 - 1.6);
    const a = (sec - 15) / 60 * 6.283 - (t > g0 ? 0 : 0);
    pop.line([[0, 0], [Math.cos(a) * 640, Math.sin(a) * 640]], 22, { taper: .1 });
    pop.fill(ellipsePts(Math.cos(a) * 640, Math.sin(a) * 640, 40, 40), T.red); pop.outline(ellipsePts(Math.cos(a) * 640, Math.sin(a) * 640, 40, 40), 8);
    pop.fill(ellipsePts(0, 0, 60, 60), T.red); pop.outline(ellipsePts(0, 0, 60, 60), 10);
    // the stretched first second: a red tape grows while the hand hangs
    if (t > g0 && t < g0 + 3.5) { const L = 1200 * clamp((t - g0) / 1.6), y0 = 860; pop.fill(rectPts(-600, y0, L, 120), T.red); pop.outline(rectPts(-600, y0, L, 120), 10); pop.text(t < g0 + 1.6 ? '1 SEKUNDE …' : '1 SEKUNDE!', -560, y0 + 62, { size: 90, font: 'Anton', align: 'left', fill: T.white, outline: 6 }); }
    pop.restore();
    // a little eye glances at the clock (bottom left), stamped in
    if (t > 21.0) { pop.save(); pop.translate(560, -1100); pop.scale(lerp(1.3, 1, eo(seg(t, 21, 21.15)))); eye(0, 0, 520, { ground: T.blue, iris: T.yellow, look: t < g0 ? [-.6, -.3] : [.8, .5] }); pop.restore(); }
    screenSpace(); label(40, 120, 'GEHIRN STRECKT SIE', t, 22.7, 25.8, { size: 76, ink: T.red });
  } else {
    // FINAL: pull back to the wall; one tile flips to another colourway and looks straight at you
    const u = seg(t, S.final, S.final + 2.0);
    cam.zoom = Math.exp(lerp(Math.log(.9), Math.log(.3), eio(u)));
    shake(26.2, 14); shake(28.2, 26);
    pop.begin(cam);
    for (let j = -5; j <= 5; j++) for (let i = -3; i <= 3; i++) {
      const gi = (i + j + 9) % 3, me = i === 0 && j === 0;
      const fl = me ? seg(t, 26.9, 27.2) : 0, sx = me ? Math.abs(Math.cos(fl * Math.PI)) : 1, other = me && fl > .5;
      pop.save(); pop.translate(i * 1000, j * 1000); pop.scale(Math.max(.02, sx), 1);
      eye(0, 0, 1000, { ground: other ? T.white : [T.red, T.yellow, T.blue][gi], iris: other ? T.red : [T.blue, T.blue, T.yellow][gi], look: other ? [0, 0] : [-.8 + .2 * gi, .3 - .2 * ((i + 9) % 2)], lid: other ? 0 : .35 });
      pop.restore();
    }
    screenSpace();
    headline('WAS SIEHST DU', W / 2, 260, 150, 28.2, t, { fill: T.white, shadow: T.red, rot: -.03 });
    headline('NICHT?', W / 2, 450, 230, 28.45, t, { fill: T.yellow, shadow: T.red, rot: -.03 });
  }
  subtitle(t);
  pop.present({ off: [[0, 0], [1.4, -.9], [-1.1, 1.2]], offMax: 7, ...fx });
}
window.render = frame;
window.DUR = DUR;
window.EV = [
  { t: .25, type: 'stamp', big: 1 }, { t: .55, type: 'thunk' }, { t: 1.1, type: 'thunk' }, { t: 2.0, type: 'zip' }, { t: 2.5, type: 'zip' },
  { t: S.wall, type: 'whoosh', d: 2.2 },
  ...Array.from({ length: 30 }, (_, n) => ({ t: +(S.wall + .15 + .9 * Math.sqrt(n / 77) * 1.4 * Math.sqrt(77 / 30) * 0 + .9 * 1.4 * Math.sqrt((n * 77 / 30) / 77)).toFixed(3), type: 'stamp', note: n })),
  ...SACC.map(t => ({ t, type: 'flick' })),
  { t: 9.4, type: 'slide' }, { t: 9.9, type: 'snip' }, { t: 10.15, type: 'snip' }, { t: 10.4, type: 'snip' }, { t: 10.5, type: 'whoosh', d: .6 }, { t: 11.05, type: 'stamp', big: 1 },
  { t: 11.4, type: 'stamp', big: 1 }, ...Array.from({ length: 22 }, (_, n) => ({ t: +(11.5 + 1.6 * Math.pow(n / 22, .6)).toFixed(3), type: 'stamp', note: n })),
  { t: S.mirror, type: 'flip' }, ...Array.from({ length: 6 }, (_, k) => ({ t: +(S.mirror + .5 + k * .8).toFixed(2), type: 'zip' })), { t: 17.3, type: 'thunk' },
  { t: S.clock, type: 'flip' }, { t: 21.0, type: 'stamp' }, { t: 21.6, type: 'zip' }, { t: 23.2, type: 'tick', big: 1 }, ...[24.2, 25.2].map(t => ({ t, type: 'tick' })), { t: 22.7, type: 'slide' },
  { t: S.final, type: 'whoosh', d: 2.0 }, { t: 26.9, type: 'flip' }, { t: 28.2, type: 'stamp', big: 1 }, { t: 28.45, type: 'stamp', big: 1 },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([document.fonts.load('100px Anton'), document.fonts.load('40px Archivo')]).then(() => { frame(0); window.READY = true; });
