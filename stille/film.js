// STILLE AUS MATHEMATIK · Oscilloscope Math · 1080×1920. Canvas 2D: light layers (beam, text, hot, amber) composited with bloom.
// Every value on screen comes from the same signal the audio is computed from (signal.js-style constants below, shared with mix.py via events).
const W = 1080, H = 1920, DUR = 31.5;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const ei = k => Math.pow(clamp(k), 3);
const COL = { bg: '#010402', amb: '#0B2412', beam: '#4DFF88', text: '#8DFFB0', hot: '#E6FFEC', amber: '#FFB547' };

// —— the signal (volts). Low part: engine-like hum the chip can follow; high part: a fast whine it cannot ——
const LOW = [[110, 1.0, 0.0], [165, 0.55, 1.1], [220, 0.32, 2.3]];     // [Hz, V, phase]
const HIGH = [2400, 0.06, 0.4];
const low = x => LOW.reduce((s, [f, a, p]) => s + a * Math.sin(2 * Math.PI * f * x + p), 0);
const high = x => HIGH[1] * Math.sin(2 * Math.PI * HIGH[0] * x + HIGH[2]);
const noise = x => low(x) + high(x);
const anti = x => -low(x);                       // what the chip plays (it inverts what it can follow)
const T = { on: 0.0, ch1: 1.0, samp: 7.8, mirror0: 11.8, mirror1: 13.4, merge0: 16.6, merge1: 17.6, zoom0: 20.2, zoom1: 21.3, pad0: 22.6, pad1: 24.4, back0: 25.0, back1: 26.0, title: 25.6, off0: 30.5, off1: 31.2 };
const padK = t => 1 - eio(seg(t, T.pad0, T.pad1));          // the cushions damp the rest
const VO = [{ id: 'v1', t: 0.4 }, { id: 'v2', t: 4.3 }, { id: 'v3', t: 7.8 }, { id: 'v4', t: 11.8 }, { id: 'v5', t: 16.9 }, { id: 'v6', t: 20.6 }, { id: 'v7', t: 25.4 }];
const CUES = [
  [0.4, 2.2, 'Deine Kopfhörer machen Lärm.'], [2.2, 4.2, 'Damit du keinen hörst.'],
  [4.3, 7.6, 'Das ist der Lärm um dich herum: eine Schallwelle.'],
  [7.8, 9.6, 'Ein Mikrofon misst sie.'], [9.6, 11.6, 'Tausende Male pro Sekunde.'],
  [11.8, 14.0, 'Ein Chip baut daraus ihr Spiegelbild.'], [14.0, 16.6, 'Wo sie steigt, fällt seine.'],
  [16.9, 20.2, 'Beide zusammen ergeben: fast nichts.'],
  [20.6, 22.6, 'Nur hohe Töne sind zu schnell für den Chip.'], [22.6, 25.0, 'Die schluckt das Polster.'],
  [25.4, 27.2, 'Stille ist hier keine Ruhe.'], [27.2, 30.3, 'Sie ist Mathematik.'],
];

// —— screen geometry: 10 × 10 divisions of 96 px ——
const DIV = 96, GX = 60, GY = 470, GW = DIV * 10, GH = DIV * 10, CY = GY + GH / 2;
const TDIV = 0.002;                               // 2 ms per division: 20 ms across the screen
// the trace is not live sound: it is the signal in slow motion (the window slides 1 ms per second)
const x0At = t => t * 0.001;

// —— layers ——
const out = document.getElementById('c'), O = out.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const LB = mk(), LT = mk(), LH = mk(), LA = mk();
const B = LB.getContext('2d'), Tx = LT.getContext('2d'), Hc = LH.getContext('2d'), A = LA.getContext('2d');

function line(g, pts, col, w, alpha = 1) {
  if (pts.length < 2) return;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore();
}
function txt(g, s, x, y, font, col, align = 'left', alpha = 1) { g.save(); g.globalAlpha = alpha; g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); g.restore(); }
const MONO = px => `${px}px "JetBrains Mono"`, SERIF = px => `${px}px "STIX Two Text"`, ITAL = px => `italic ${px}px "STIX Two Text"`;

// a trace: f(x) over the 20 ms window, drawn at screen resolution; steep parts dimmer (a fast beam leaves less light)
function trace(g, f, t, yC, vdiv, col, w, alpha = 1, xFrom = 0, xTo = 1, mirrorK = 1) {
  const x0 = x0At(t), N = Math.ceil(GW * (xTo - xFrom) / 1.5), pts = [];
  for (let i = 0; i <= N; i++) {
    const u = xFrom + (xTo - xFrom) * i / N, x = x0 + u * 10 * TDIV;
    let v = f(x) * mirrorK; const y = yC - v / vdiv * DIV;
    pts.push([GX + u * GW, clamp(y, GY - 40, GY + GH + 40)]);
  }
  line(g, pts, col, w, alpha);
  return pts;
}
function graticule(g, t, on, vfine = 0) {
  if (on <= 0) return;
  g.save(); g.globalAlpha = 0.55 * on; g.fillStyle = COL.text;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 50; j++) {   // dotted lines
    g.fillRect(GX + i * DIV - 1, GY + j * GH / 50 - 1, 2, 2); g.fillRect(GX + j * GW / 50 - 1, GY + i * DIV - 1, 2, 2);
  }
  g.globalAlpha = 0.8 * on; g.fillRect(GX, CY - 1, GW, 2); g.fillRect(GX + GW / 2 - 1, GY, 2, GH);
  for (let j = 0; j <= 50; j++) { g.fillRect(GX + j * GW / 50 - 1, CY - 6, 2, 12); g.fillRect(GX + GW / 2 - 6, GY + j * GH / 50 - 1, 12, 2); }
  if (vfine > 0) { g.globalAlpha = 0.35 * vfine * on; for (let j = 0; j <= 250; j++) g.fillRect(GX + GW / 2 - 3, GY + j * GH / 250, 6, 1); }   // the finer level fades in on the zoom
  g.restore();
}
function vpp(f, x0) { let lo = 1e9, hi = -1e9; for (let i = 0; i <= 2000; i++) { const v = f(x0 + i / 2000 * 0.02); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; }

// formula, top: lit glyph by glyph
function formula(t) {
  const parts = [['s(t)', T.ch1 + 0.4, COL.text], ['  +  ', T.mirror0 + 0.6, COL.text], ['(−s(t))', T.mirror0 + 0.8, COL.text], [t < T.zoom0 ? '  =  ' : '  ≈  ', T.merge1, t < T.zoom0 ? COL.text : COL.amber], ['0', T.merge1 + 0.2, t < T.zoom0 ? COL.hot : COL.amber]];
  let x = 90; Tx.font = ITAL(64);
  for (const [s, t0, col] of parts) {
    const n = Math.floor(s.length * seg(t, t0, t0 + 0.4));
    const sub = s.slice(0, n), flash = t - t0 < 0.5 && t > t0 ? 1 : 0;
    txt(t0 > T.zoom0 - 1 && col === COL.amber ? A : Tx, sub, x, 300, ITAL(64), col);
    if (flash && n) txt(Hc, sub, x, 300, ITAL(64), COL.hot, 'left', 0.6 * (1 - (t - t0) / 0.5));
    Tx.font = ITAL(64); x += Tx.measureText(s).width;
  }
  txt(Tx, 'ANC · ACTIVE NOISE CANCELLING', 90, 200, MONO(22), COL.text, 'left', 0.7 * seg(t, 0.8, 1.2));
}
function readouts(t, vdiv, ch2On, sum) {
  const y = GY + GH + 70, x0 = x0At(t);
  const vd = vdiv >= 0.1 ? vdiv.toFixed(2) : (vdiv * 1000).toFixed(0) + 'm';
  txt(Tx, `CH1  ${vd} V/DIV`, GX, y, MONO(26), COL.beam);
  txt(Tx, `TIME ${(TDIV * 1000).toFixed(0)} ms/DIV`, GX + GW, y, MONO(26), COL.text, 'right');
  const v1 = vpp(noise, x0);
  txt(Tx, `Vpp CH1 = ${v1.toFixed(2)} V`, GX, y + 44, MONO(24), COL.text, 'left', seg(t, 4.3, 4.8));
  if (ch2On > 0) txt(Tx, `Vpp CH2 = ${vpp(anti, x0).toFixed(2)} V`, GX, y + 82, MONO(24), COL.text, 'left', ch2On);
  if (sum > 0) { const vs = vpp(x => (noise(x) + anti(x)) * padK(t), x0); txt(Tx, `Vpp Σ   = ${vs < 0.1 ? (vs * 1000).toFixed(0) + ' mV' : vs.toFixed(2) + ' V'}`, GX, y + 120, MONO(24), vs < 0.5 ? COL.hot : COL.text, 'left', sum); }
  txt(Tx, `f₁ = ${LOW[0][0]} Hz`, GX + GW, y + 44, MONO(24), COL.text, 'right', seg(t, 4.8, 5.3));
}
function subtitles(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  const k = eo(seg(t, c[0], c[0] + 0.16)), y = 1800;
  let fs = 40; O.font = ITAL(fs); let w = O.measureText(c[2]).width; if (w > 900) { fs = Math.floor(fs * 900 / w); O.font = ITAL(fs); w = O.measureText(c[2]).width; }
  O.save(); O.globalAlpha = 0.75; O.fillStyle = '#000'; O.beginPath(); O.roundRect(40, y - fs - 18, w + 80, fs + 42, 14); O.fill(); O.restore();
  O.save(); O.globalAlpha = k; O.fillStyle = COL.beam; O.fillRect(56, y - fs + 2, 3, fs + 6);
  O.font = ITAL(fs); O.fillStyle = '#D8FFE4'; O.fillText(c[2], 78, y); O.restore();
}

// —— compositing: light layers onto the screen, with bloom ——
function composite(t, pow) {
  O.globalCompositeOperation = 'source-over'; O.filter = 'none';
  O.fillStyle = COL.bg; O.fillRect(0, 0, W, H);
  const gr = O.createRadialGradient(W / 2, CY, 60, W / 2, CY, 1100); gr.addColorStop(0, COL.amb); gr.addColorStop(1, COL.bg);
  O.globalAlpha = 0.9 * pow; O.fillStyle = gr; O.fillRect(0, 0, W, H); O.globalAlpha = 1;
  O.globalCompositeOperation = 'lighter';
  for (const [L, blurs] of [[LB, [[22, .55], [7, .8], [0, 1]]], [LA, [[16, .5], [5, .6], [0, 1]]], [LH, [[14, .7], [4, .8], [0, 1]]], [LT, [[3, .35], [0, 1]]]]) {
    for (const [b, a] of blurs) { O.filter = b ? `blur(${b}px)` : 'none'; O.globalAlpha = a; O.drawImage(L, 0, 0); }
  }
  O.filter = 'none'; O.globalAlpha = 1; O.globalCompositeOperation = 'source-over';
  // vignette
  const vg = O.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  O.fillStyle = vg; O.fillRect(0, 0, W, H);
}

// —— the film ——
function frame(t) {
  for (const g of [B, Tx, Hc, A]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); }
  // power: a dot → a line → the full screen (and the reverse at the end)
  const pOn = seg(t, 0.05, 0.25), pLine = eo(seg(t, 0.25, 0.7)), pScreen = eo(seg(t, 0.6, 1.0));
  const off1 = ei(seg(t, T.off0, T.off0 + 0.35)), off2 = ei(seg(t, T.off0 + 0.35, T.off1));
  const sx = pLine * (1 - off2), sy = pScreen * (1 - off1);      // horizontal and vertical extent of the picture
  if (t < 1.0 || t > T.off0) {
    const cx = W / 2, w = GW * Math.max(sx, 0.004) / 2, h = Math.max(2, GH * sy / 2);
    if (sy < 0.05) { line(Hc, [[cx - w, CY], [cx + w, CY]], COL.hot, 4, pOn * (t > T.off1 - 0.05 ? 1 - seg(t, T.off1 - 0.05, T.off1 + 0.25) : 1)); }
    Hc.save(); Hc.globalAlpha = pOn * (1 - seg(t, T.off1, T.off1 + 0.3)); Hc.fillStyle = COL.hot; Hc.beginPath(); Hc.arc(cx, CY, 7, 0, 7); Hc.fill(); Hc.restore();
    if (sy < 0.05 && t < 1.0) { composite(t, pOn); return; }
    // squash the whole picture for the power-off
    for (const g of [B, Tx, Hc, A]) g.setTransform(1, 0, 0, Math.max(0.002, sy), 0, CY * (1 - Math.max(0.002, sy)));
  }

  // camera = the vertical scale: V/DIV shrinks ×20 on the knob zoom, then back
  const zk = eio(seg(t, T.zoom0, T.zoom1)) * (1 - eio(seg(t, T.back0, T.back1)));
  const vdiv = 1.0 / Math.pow(20, zk);
  graticule(Tx, t, sy || 1, zk);

  // CH1 and CH2 positions: apart (±2.5 div) until the merge, then both on the centre line
  const mk = eio(seg(t, T.merge0, T.merge1));
  const y1 = lerp(CY - 2.5 * DIV, CY, mk), y2 = lerp(CY + 2.5 * DIV, CY, mk);
  const ch1On = eo(seg(t, T.ch1, T.ch1 + 0.6));
  const mir = eio(seg(t, T.mirror0, T.mirror1));                 // the copy flips about its axis: scale 1 → −1
  const ch2On = seg(t, T.mirror0, T.mirror0 + 0.3);
  const sumOn = mk;
  const vtrace = vdiv;

  // before the merge: CH1 noise, CH2 the flipping copy. After: the sum alone (both traces fade into it)
  const sep = 1 - seg(t, T.merge1 - 0.2, T.merge1 + 0.4);
  if (ch1On > 0) {
    // afterglow: a few earlier instants
    for (let k = 4; k >= 1; k--) trace(B, noise, t - k * 0.04, y1, 1.0, COL.beam, 2, 0.12 * (5 - k) / 4 * ch1On * sep);
    const reveal = seg(t, T.ch1, T.ch1 + 0.8);
    const pts = trace(B, noise, t, y1, 1.0, COL.beam, 2.6, ch1On * sep, 0, reveal);
    if (reveal < 1) { const p = pts[pts.length - 1]; Hc.fillStyle = COL.hot; Hc.beginPath(); Hc.arc(p[0], p[1], 6, 0, 7); Hc.fill(); }
    txt(Tx, 'CH1 · MIKROFON', GX + 10, y1 - 2.1 * DIV, MONO(24), COL.beam, 'left', ch1On * sep);
  }
  if (ch2On > 0) {
    const flipK = lerp(1, -1, mir);   // the mirror: amplitude goes through zero (the copy turns edge-on), then comes back inverted
    trace(B, low, t, y2, 1.0, COL.text, 2.4, ch2On * sep, 0, 1, flipK);
    if (mir < 1 && mir > 0) { line(Hc, [[GX, y2], [GX + GW, y2]], COL.hot, 2, 0.6 * Math.sin(mir * Math.PI)); }
    txt(Tx, 'CH2 · CHIP = −CH1', GX + 10, y2 + 2.4 * DIV, MONO(24), COL.text, 'left', ch2On * sep);
  }
  // sampling: dots ride the CH1 trace, one per sample (shown 1 in 8 at this scale)
  if (t > T.samp && t < T.mirror0 + 0.5) {
    const k = seg(t, T.samp + 0.2, T.samp + 1.4), x0 = x0At(t), n = 64;
    for (let i = 0; i < n * k; i++) {
      const u = i / n, v = noise(x0 + u * 10 * TDIV), px = GX + u * GW, py = y1 - v / 1.0 * DIV;
      Hc.save(); Hc.globalAlpha = (1 - seg(t, T.mirror0, T.mirror0 + 0.5)) * 0.95; Hc.fillStyle = COL.hot; Hc.beginPath(); Hc.arc(px, py, 4, 0, 7); Hc.fill(); Hc.restore();
    }
    txt(Tx, 'SAMPLE  48 000 /s', GX + GW - 10, y1 - 2.1 * DIV, MONO(24), COL.hot, 'right', seg(t, T.samp + 0.4, T.samp + 0.8) * (1 - seg(t, T.mirror0, T.mirror0 + 0.4)));
  }
  // the sum
  if (sumOn > 0) {
    const sum = x => (noise(x) + anti(x)) * padK(t);
    for (let k = 3; k >= 1; k--) trace(Hc, sum, t - k * 0.03, CY, vtrace, COL.hot, 2, 0.15 * (4 - k) / 3 * sumOn);
    trace(Hc, sum, t, CY, vtrace, COL.hot, 2.8, sumOn);
    txt(Tx, 'Σ = CH1 + CH2', GX + 10, CY - 0.6 * DIV, MONO(24), COL.hot, 'left', sumOn * (1 - zk) * (1 - seg(t, T.title - 0.4, T.title)));
    // amber cursors on the residual: its peak-to-peak, measured from the same function
    const ck = seg(t, T.zoom1, T.zoom1 + 0.4) * (1 - seg(t, T.back0, T.back0 + 0.3));
    if (ck > 0) {
      const r = vpp(sum, x0At(t)) / 2, ya = CY - r / vdiv * DIV, yb = CY + r / vdiv * DIV;
      for (const yy of [ya, yb]) { A.save(); A.globalAlpha = ck; A.strokeStyle = COL.amber; A.lineWidth = 2; A.setLineDash([10, 8]); A.beginPath(); A.moveTo(GX, yy); A.lineTo(GX + GW, yy); A.stroke(); A.restore(); }
      const lvl = 20 * Math.log10(Math.max(1e-6, vpp(sum, x0At(t))) / vpp(noise, x0At(t)));
      txt(A, `ΔV = ${(2 * r * 1000).toFixed(0)} mV`, GX + GW - 10, Math.min(ya, yb) - 24, MONO(26), COL.amber, 'right', ck);
      txt(A, `${lvl.toFixed(0)} dB`, GX + GW - 10, Math.max(ya, yb) + 50, MONO(40), COL.amber, 'right', ck);
      txt(A, t < T.pad0 ? 'REST: 2,4 kHz' : 'POLSTER DÄMPFT', GX + 10, Math.min(ya, yb) - 24, MONO(26), COL.amber, 'left', ck);
    }
  }
  formula(t);
  readouts(t, vdiv, ch2On * sep, sumOn);

  // title, written by the beam: a hot point runs along the line and the letters light up behind it
  if (t > T.title) {
    const k = seg(t, T.title, T.title + 1.4), k2 = seg(t, T.title + 1.2, T.title + 2.2);
    for (const [s, y, font, col, kk] of [['Stille', 690, ITAL(160), COL.beam, k], ['aus Mathematik', 820, SERIF(96), COL.text, k2]]) {
      if (kk <= 0) continue;
      Tx.font = font; const w = Tx.measureText(s).width, x0 = (W - w) / 2;
      // a dark slab keeps the trace out of the title
      O.save(); O.restore();
      const L = (col === COL.beam ? B : Tx);
      L.save(); L.beginPath(); L.rect(x0 - 10, y - 160, (w + 20) * kk, 220); L.clip(); txt(L, s, x0, y, font, col); L.restore();
      if (kk < 1) { Hc.fillStyle = COL.hot; Hc.beginPath(); Hc.arc(x0 + w * kk, y - 40, 9, 0, 7); Hc.fill(); }
    }
  }
  composite(t, 1);
}

window.render = t => { frame(t); subtitles(t); };
window.DUR = DUR;
window.EV = [
  { t: 0.05, type: 'relay' }, { t: 0.6, type: 'hum0' },
  ...Array.from({ length: 12 }, (_, i) => ({ t: +(T.samp + 0.2 + i * 0.1).toFixed(2), type: 'blip', f: 900 + i * 40 })),
  { t: T.mirror0, type: 'sweep', d: 1.6 }, { t: T.merge0, type: 'sweep', d: 1.0 },
  ...[0, 1, 2, 3, 4].map(i => ({ t: +(T.zoom0 + i * 0.22).toFixed(2), type: 'detent' })),
  ...[0, 1, 2].map(i => ({ t: +(T.back0 + i * 0.3).toFixed(2), type: 'detent' })),
  { t: T.off0, type: 'zap' }, { t: T.off0 + 0.02, type: 'relay' },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SIGNAL = { LOW, HIGH, T };
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([document.fonts.load('24px "JetBrains Mono"'), document.fonts.load('italic 64px "STIX Two Text"'), document.fonts.load('64px "STIX Two Text"')]).then(() => { window.render(0); window.READY = true; });
