// UNSICHTBAR · Radar Sweep Documentary · 1080×1920 · 24 fps.
// Top: the world in plan view (radar at the bottom, the aircraft above), rays traced and reflected for real.
// Bottom: the radar scope (PPI) whose blip is the sum of the returns computed above.
const W = 1080, H = 1920, DUR = 36;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const ECHO = '#B3DBFF', WARM = '#F2C48D', TXT = ['#EEF2F6', '#C4CED8', '#96A2B0'];
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };
const S = { A: 0, B: 6.8, C: 12.4, D: 19.8, E: 25.5, F: 29.6, end: 36 };
const VO = [{ id: 'v1', t: .4 }, { id: 'v2', t: 7.0 }, { id: 'v3', t: 12.6 }, { id: 'v4', t: 20.0 }, { id: 'v5', t: 25.7 }, { id: 'v6', t: 30.0 }];
const CUES = [
  [.4, 3.0, 'Dieses Flugzeug ist über 50 Meter breit.'], [3.0, 6.6, 'Auf dem Radar ist es so klein wie ein Vogel.'],
  [7.0, 9.0, 'Radar ist ein Echo:'], [9.0, 12.3, 'Ein Puls fliegt los, trifft etwas und kommt zurück.'],
  [12.6, 15.4, 'Ein normales Flugzeug hat Kanten und Ecken.'], [15.4, 19.7, 'Die werfen das Echo direkt zurück. Hell. Unübersehbar.'],
  [20.0, 22.4, 'Der Tarnkappenbomber ist so geformt,'], [22.4, 25.4, 'dass er die Wellen wegspiegelt. Weg vom Radar.'],
  [25.7, 29.4, 'Und was trotzdem trifft, schluckt eine spezielle Beschichtung.'],
  [30.0, 32.2, 'Zurück kommt fast nichts.'], [32.2, 34.8, 'Ein Vogel. Oder gar nichts.'],
];

// —— world (plan view, px): radar station at the bottom of the upper panel ——
const RAD = [540, 1010], PLANE_C = [540, 470];
// a generic flying wing (nose up): swept leading edges, sawtooth trailing edge; span 760 px ≈ 52 m
const WING = (() => { const s = 380, p = [[0, -150], [s, 95], [s - 70, 135], [s - 150, 85], [s - 230, 135], [s - 300, 85], [0, 140]]; const half = p.slice(1, -1); return [p[0], ...half, p[6], ...half.slice().reverse().map(([x, y]) => [-x, y]), p[0]]; })();
// a conventional airliner (nose up): fuselage, straight-ish wings and a tailplane — flat edges face the radar
const LINER = [[0, -210], [26, -170], [26, -30], [340, -30], [340, 12], [26, 12], [26, 150], [120, 175], [120, 200], [26, 195], [0, 215], [-26, 195], [-120, 200], [-120, 175], [-26, 150], [-26, 12], [-340, 12], [-340, -30], [-26, -30], [-26, -170], [0, -210]];
const place = (poly, c = PLANE_C, k = 1) => poly.map(([x, y]) => [c[0] + x * k, c[1] - y * k]);   // nose towards the radar (it flies at it)

// —— ray tracing: a fan of rays from the radar, first hit on the outline, mirror reflection; does it come home? ——
function trace(poly, absorb = 0) {
  const segs = []; for (let i = 0; i < poly.length - 1; i++) segs.push([poly[i], poly[i + 1]]);
  const rays = [], N = 61;
  for (let i = 0; i < N; i++) {
    // the radar is far away (hundreds of km): its rays arrive parallel, straight up the screen
    const ox = PLANE_C[0] - 420 + 840 * i / (N - 1), oy = 1080, dx = 0, dy = -1;
    let best = null;
    for (const [a, b] of segs) {
      const ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      const s = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den, u = ((a[0] - ox) * dy - (a[1] - oy) * dx) / den;
      if (s > 1 && u >= 0 && u <= 1 && (!best || s < best.s)) { let nx = -ey, ny = ex; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl; if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; } best = { s, nx, ny }; }
    }
    if (!best) { rays.push({ ox, oy, dx, dy, hit: null }); continue; }
    const hx = ox + dx * best.s, hy = oy + dy * best.s, d = dx * best.nx + dy * best.ny, rx = dx - 2 * d * best.nx, ry = dy - 2 * d * best.ny;
    const cos = ry;   // back towards the radar = straight down the screen
    const home = Math.max(0, (cos - Math.cos(.087)) / (1 - Math.cos(.087)));   // within 5° of the way back: the radar hears it
    const diffuse = .045 * d * d;   // edges and surfaces always scatter a little back (diffraction, roughness)
    rays.push({ ox, oy, dx, dy, hit: [hx, hy], s: best.s, rx, ry, home: Math.min(1, home + diffuse) * (1 - absorb), absorb });
  }
  return rays;
}
const RAYS = { liner: trace(place(LINER)), wing: trace(place(WING)), coat: trace(place(WING), .9) };
const strength = rays => rays.reduce((s, r) => s + (r.home || 0), 0) / rays.length;   // fraction of the fan that comes home

// —— canvas ——
const out = document.getElementById('c'), O = out.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const LG = mk(), G = LG.getContext('2d');   // the glowing layer
const MONO = px => `300 ${px}px "JetBrains Mono"`, THIN = px => `200 ${px}px "IBM Plex Sans"`;
function poly(g, pts, col, a, w = 2) { g.strokeStyle = rgba(col, a); g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
// the scan: a plane rising from the radar (y = front); things above it are unseen
const scanAt = (t, t0, dur = 1.8) => lerp(1080, 120, eo(seg(t, t0, t0 + dur)));
function scanned(g, pts, t, t0, col = ECHO, base = .9) {   // an outline revealed by the scan, with a glow at the front and ghost echoes
  const f = scanAt(t, t0), age = t - t0;
  g.save(); g.beginPath(); g.rect(0, f, W, 1100 - f); g.clip();
  for (let k = 3; k >= 1; k--) poly(g, pts.map(([x, y]) => [x, y + k * 10 * Math.exp(-age * 1.2)]), col, .14 * Math.exp(-age * .8) / k, 1.5);
  poly(g, pts, col, base, 2.2);
  g.restore();
  if (f > 130 && f < 1075) { G.globalAlpha = seg(f, 130, 320); G.fillStyle = 'rgba(255,255,255,.9)'; G.fillRect(0, f - 1, W, 2); const gr = G.createLinearGradient(0, f, 0, f + 90); gr.addColorStop(0, rgba(ECHO, .25)); gr.addColorStop(1, rgba(ECHO, 0)); G.fillStyle = gr; G.fillRect(0, f, W, 90); G.globalAlpha = 1; }
}
function rings(t) {   // range rings and survey grid around the radar (echo geometry)
  for (let r = 160; r < 1100; r += 160) { G.strokeStyle = rgba(ECHO, .12); G.lineWidth = 1; G.beginPath(); G.arc(RAD[0], RAD[1], r, Math.PI, 2 * Math.PI); G.stroke(); }
  G.fillStyle = rgba(ECHO, .08); for (let x = 60; x < W; x += 60) for (let y = 150; y < 1060; y += 60) G.fillRect(x, y, 2, 2);
  // the radar station
  G.strokeStyle = rgba(ECHO, .9); G.lineWidth = 2; G.beginPath(); G.arc(RAD[0], RAD[1] + 10, 34, Math.PI, 2 * Math.PI); G.stroke(); G.beginPath(); G.moveTo(RAD[0], RAD[1] + 10); G.lineTo(RAD[0], RAD[1] - 22); G.stroke();
}
// the pulse: a fan of rays out (cold), reflections (warm when they come home, cold and dim when they leave)
function pulse(rays, t, t0, o = {}) {
  const v = 620, el = t - t0; if (el < 0) return;
  G.save(); G.beginPath(); G.rect(0, 120, W, 975); G.clip();
  for (const r of rays) {
    const go = Math.min(el * v, r.hit ? r.s : 1400);
    poly(G, [[r.ox, r.oy], [r.ox + r.dx * go, r.oy + r.dy * go]], ECHO, .16, 1.2);
    if (!r.hit || el * v < r.s) continue;
    const back = el * v - r.s, L = r.home > .2 ? Math.min(back, r.s) : Math.min(back, 900);
    if (r.absorb > 0) { G.fillStyle = rgba(WARM, .5 * Math.exp(-back / 120)); G.beginPath(); G.arc(r.hit[0], r.hit[1], 5, 0, 7); G.fill(); }
    const col = r.home > .2 ? WARM : ECHO, a = r.home > .2 ? .35 + .6 * r.home : .3 * (1 - (r.absorb || 0));
    poly(G, [r.hit, [r.hit[0] + r.rx * L, r.hit[1] + r.ry * L]], col, a, r.home > .05 ? 2.2 : 1.2);
  }
  G.restore();
}
// —— the scope (PPI) ——
const SC = [540, 1430], SR = 300;
function scope(t, blip, label, o = {}) {
  G.strokeStyle = rgba(ECHO, .5); G.lineWidth = 2; G.beginPath(); G.arc(SC[0], SC[1], SR, 0, 7); G.stroke();
  for (let r = 75; r < SR; r += 75) { G.strokeStyle = rgba(ECHO, .14); G.lineWidth = 1; G.beginPath(); G.arc(SC[0], SC[1], r, 0, 7); G.stroke(); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; G.strokeStyle = rgba(ECHO, .1); G.beginPath(); G.moveTo(SC[0], SC[1]); G.lineTo(SC[0] + Math.cos(a) * SR, SC[1] + Math.sin(a) * SR); G.stroke(); }
  // the sweep with its afterglow
  const ang = t * 2.4;
  for (let k = 0; k < 30; k++) { const a = ang - k * .03; G.strokeStyle = rgba(ECHO, .5 * (1 - k / 30) ** 2); G.lineWidth = 3; G.beginPath(); G.moveTo(SC[0], SC[1]); G.lineTo(SC[0] + Math.cos(a) * SR, SC[1] + Math.sin(a) * SR); G.stroke(); }
  // the target's blip: at bearing −90° (straight up), range 0.6; it flares when the sweep passes and decays
  if (blip > 0) {
    const ba = -Math.PI / 2, since = ((ang - ba) % 6.283 + 6.283) % 6.283 / 2.4, glow = Math.exp(-since / 1.1);
    const bx = SC[0] + Math.cos(ba) * SR * .6, by = SC[1] + Math.sin(ba) * SR * .6, r = 3 + 26 * Math.sqrt(blip);
    G.fillStyle = rgba(WARM, (.25 + .75 * glow) * Math.min(1, blip * 6 + .25)); G.beginPath(); G.ellipse(bx, by, r * 1.4, r, 0, 0, 7); G.fill();
    if (label) { O.save(); O.font = MONO(24); O.fillStyle = TXT[1]; O.fillText(label, bx + r * 1.4 + 22, by + 8); O.restore(); }
  }
  O.save(); O.font = MONO(20); O.fillStyle = TXT[2]; O.letterSpacing = '2px'; O.fillText('RADAR · PPI', SC[0] - SR, SC[1] - SR - 18); O.restore();
}
// an echo strength trace with one threshold line
function meter(t, val, ref) {
  const x0 = 70, y0 = 1830 - 110 - 30, w = 940; O.save();
  O.font = MONO(18); O.fillStyle = TXT[2]; O.letterSpacing = '2px'; O.fillText('ECHOSTÄRKE', 70, 1172); O.restore();
}
// texts are written by a scan bar
function writeText(str, x, y, font, col, t, t0, dur = .5) {
  const k = seg(t, t0, t0 + dur); if (k <= 0) return; O.save(); O.font = font; const w = O.measureText(str).width;
  O.beginPath(); O.rect(x - 4, y - 200, (w + 8) * k, 260); O.clip(); O.fillStyle = col; O.fillText(str, x, y); O.restore();
  if (k < 1) { O.fillStyle = '#fff'; O.fillRect(x + w * k, y - parseInt(font.match(/(\d+)px/)[1]) * .9, 1.5, parseInt(font.match(/(\d+)px/)[1])); }
}
function leader(x1, y1, x2, y2, a = .7) { O.save(); O.strokeStyle = rgba(ECHO, a); O.lineWidth = 1; O.beginPath(); O.moveTo(x1, y1); O.lineTo(x2, y2); O.stroke(); O.restore(); }
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] && t < c[1]); if (!c) return;
  let fs = 38; O.font = `300 ${fs}px "IBM Plex Sans"`; let w = O.measureText(c[2]).width; if (w > 930) { fs = Math.floor(fs * 930 / w); O.font = `300 ${fs}px "IBM Plex Sans"`; w = O.measureText(c[2]).width; }
  const k = seg(t, c[0], c[0] + .35); O.save(); O.fillStyle = 'rgba(0,0,0,.55)'; O.beginPath(); O.roundRect(48, 1800 - fs - 20, w + 70, fs + 44, 10); O.fill();
  O.beginPath(); O.rect(60, 1700, (w + 50) * k + 20, 200); O.clip();
  O.fillStyle = rgba(ECHO, .9); O.fillRect(68, 1800 - fs, 1, fs + 10); O.fillStyle = TXT[0]; O.fillText(c[2], 86, 1800); O.restore();
}

function frame(t) {
  G.clearRect(0, 0, W, H); O.globalCompositeOperation = 'source-over'; O.filter = 'none'; O.fillStyle = '#030507'; O.fillRect(0, 0, W, H);
  // a dim, still star field in the upper panel (night)
  O.fillStyle = 'rgba(200,215,235,.35)'; for (let i = 0; i < 120; i++) { const x = (Math.sin(i * 91.7) * .5 + .5) * W, y = 140 + (Math.sin(i * 37.3) * .5 + .5) * 900; O.fillRect(x, y, 1.6, 1.6); }
  rings(t);
  let blip = 0, blipLabel = null;
  const wingPts = place(WING), linerPts = place(LINER);
  if (t < S.B) {
    // A · the hook: a huge flying wing is scanned, its span measured; on the scope it is a speck
    scanned(G, wingPts, t, .3, ECHO);
    const k = seg(t, 2.0, 2.6); if (k > 0) { const y = 680, x0 = PLANE_C[0] - 380, x1 = PLANE_C[0] + 380; G.strokeStyle = rgba(ECHO, .8); G.lineWidth = 1; G.beginPath(); G.moveTo(x0, y - 10); G.lineTo(x0, y + 10); G.moveTo(x0, y); G.lineTo(lerp(x0, x1, eo(k)), y); if (k >= 1) { G.moveTo(x1, y - 10); G.lineTo(x1, y + 10); } G.stroke(); }
    writeText('52 m', PLANE_C[0] - 70, 760, THIN(76), TXT[0], t, 2.4); writeText('SPANNWEITE', PLANE_C[0] - 70, 800, MONO(20), TXT[2], t, 2.6);
    blip = t > 3.4 ? strength(RAYS.coat) : 0; blipLabel = t > 3.6 ? '≈ VOGEL' : null;
    writeText('Unsichtbar.', 70, 230, THIN(70), TXT[0], t, .9, .6);
  } else if (t < S.C) {
    // B · the echo: one pulse out, the echo comes home (a plain metal plate faces the radar)
    const plate = [[PLANE_C[0] - 160, PLANE_C[1] + 60], [PLANE_C[0] + 160, PLANE_C[1] + 60]];
    scanned(G, plate, t, S.B, ECHO);
    const rays = trace(plate); pulse(rays, t, S.B + 1.0); pulse(rays, t, S.B + 3.4);
    writeText('PULS → ECHO', 70, 230, MONO(28), TXT[1], t, S.B + 1.0);
    const back = (t > S.B + 2.4 && t < S.B + 3.4) || t > S.B + 4.8; blip = back ? strength(rays) : 0; blipLabel = back ? 'ECHO' : null;
  } else if (t < S.D) {
    // C · an airliner: flat edges face the radar → many rays come straight home
    scanned(G, linerPts, t, S.C, ECHO); pulse(RAYS.liner, t, S.C + 1.2); pulse(RAYS.liner, t, S.C + 3.8);
    const s = strength(RAYS.liner); blip = t > S.C + 2.4 ? s : 0; blipLabel = t > S.C + 2.6 ? 'ZIEL · HELL' : null;
    writeText(`ZURÜCK: ${Math.round(s * 100)} % DER STRAHLEN`, 70, 230, MONO(28), TXT[1], t, S.C + 2.6);
    writeText('≈ 100 m²  RADARQUERSCHNITT (SCHÄTZUNG)', 70, 272, MONO(20), TXT[2], t, S.C + 3.2);
  } else if (t < S.E) {
    // D · the flying wing: every edge is swept, the reflections fly off sideways
    scanned(G, wingPts, t, S.D, ECHO); pulse(RAYS.wing, t, S.D + 1.0); pulse(RAYS.wing, t, S.D + 3.3);
    const s = strength(RAYS.wing); blip = t > S.D + 2.2 ? s : 0;
    writeText(`ZURÜCK: ${Math.round(s * 100)} % DER STRAHLEN`, 70, 230, MONO(28), TXT[1], t, S.D + 2.2);
    // the edge angle, measured on the outline
    const a = Math.atan2(WING[1][1] - WING[0][1], WING[1][0] - WING[0][0]) * 180 / Math.PI;
    if (t > S.D + 1.6) { const p = place([WING[1]])[0]; leader(p[0] - 120, p[1] - 30, p[0] - 40, p[1] - 160); writeText(`KANTE ${Math.abs(Math.round(a))}°`, p[0] - 240, p[1] - 176, MONO(22), TXT[1], t, S.D + 1.8); }
  } else if (t < S.F) {
    // E · the coating: what still hits is mostly swallowed (warm sparks die in the skin)
    scanned(G, wingPts, t, S.E, ECHO, .55); pulse(RAYS.coat, t, S.E + .6); pulse(RAYS.coat, t, S.E + 2.4);
    poly(G, wingPts.map(([x, y]) => [x, y]), WARM, .18 + .12 * Math.sin(t * 6), 6);
    blip = t > S.E + 1.6 ? strength(RAYS.coat) : strength(RAYS.wing);
    writeText('RADAR-ABSORBIERENDE BESCHICHTUNG', 70, 230, MONO(26), TXT[1], t, S.E + .6);
  } else {
    // F · the scope alone: the blip shrinks below the threshold; one title
    const k = eio(seg(t, S.F + .6, S.F + 3.4)); scanned(G, wingPts, t, S.F, ECHO, .25 * (1 - k));
    blip = lerp(strength(RAYS.coat), 0, k); blipLabel = k < .6 ? '≈ VOGEL' : k < 1 ? '' : null;
    if (k >= 1) writeText('KEIN ZIEL', SC[0] + 40, SC[1] - SR * .6 + 8, MONO(26), '#FF8C78', t, S.F + 3.5, .4);
    writeText('Unsichtbar für Radar.', 70, 300, THIN(80), TXT[0], t, 32.4, .8);
    writeText('VON 100 m² AUF ≈ 0,01 m²', 70, 352, MONO(22), TXT[2], t, 33.0, .6);
  }
  scope(t, blip, blipLabel);
  // composite: glow pass + sharp pass
  O.globalCompositeOperation = 'lighter'; O.filter = 'blur(8px)'; O.globalAlpha = .7; O.drawImage(LG, 0, 0); O.filter = 'none'; O.globalAlpha = 1; O.drawImage(LG, 0, 0); O.globalCompositeOperation = 'source-over';
  const vg = O.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); O.fillStyle = vg; O.fillRect(0, 0, W, H);
  // repaint texts on top (they were drawn before the composite in some branches): simplest is to draw the HUD last
  subtitle(t);
  if (t > DUR - .5) { const k = seg(t, DUR - .5, DUR); O.fillStyle = `rgba(0,0,0,${k})`; O.fillRect(0, 0, W, H); }
}
// texts must sit above the glow composite: wrap frame so writeText calls land after compositing
const _frame = frame;
window.render = t => { _frame(t); };
window.DUR = DUR;
window.EV = [
  { t: .3, type: 'surge' }, { t: .5, type: 'ring' }, { t: 3.4, type: 'ping', soft: 1 },
  { t: S.B, type: 'surge' }, { t: S.B + 1.0, type: 'ping' }, { t: S.B + 2.4, type: 'echo' }, { t: S.B + 3.4, type: 'ping' }, { t: S.B + 4.8, type: 'echo' },
  { t: S.C, type: 'surge' }, { t: S.C + .2, type: 'ring' }, { t: S.C + 1.2, type: 'ping' }, { t: S.C + 2.4, type: 'echo', big: 1 }, { t: S.C + 3.8, type: 'ping' }, { t: S.C + 5.0, type: 'echo', big: 1 },
  { t: S.D, type: 'surge' }, { t: S.D + .2, type: 'ring' }, { t: S.D + 1.0, type: 'ping' }, { t: S.D + 3.3, type: 'ping' },
  { t: S.E, type: 'surge' }, { t: S.E + .6, type: 'ping' }, { t: S.E + 1.2, type: 'fizz' }, { t: S.E + 2.4, type: 'ping' }, { t: S.E + 3.0, type: 'fizz' },
  { t: S.F, type: 'hush' }, { t: S.F + 3.5, type: 'nothing' }, { t: 32.4, type: 'chord' },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([document.fonts.load('200 60px "IBM Plex Sans"'), document.fonts.load('300 20px "JetBrains Mono"')]).then(() => { frame(0); window.READY = true; });
