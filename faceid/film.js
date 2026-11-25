// FACE ID · Sci-fi Hologram HUD · 1080×1920 · 24 fps · 120 BPM (beat 0.5 s, bar 2 s).
// A procedural face (height field), projected in 3D by hand onto a 2D canvas; light layers composited with glow.
const W = 1080, H = 1920, DUR = 30;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = k => 1 - Math.pow(1 - clamp(k), 3);
const ei = k => Math.pow(clamp(k), 3);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const HUE = '#6FE7FF', HOT = '#E8FCFF', ACC = '#FF9A3C', BG = '#03080B';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const Tm = {
  burst0: 0.3, burst1: 2.6, scan0: 5.6, scan1: 7.8, bend: 8.0, lock1: 9.0, lock2: 10.0, map0: 12.0, whip0: 12.4, whip1: 14.0,
  photo0: 16.0, photoScan: 16.8, reject: 18.0, real0: 19.0, lockF: 20.0, unlock: 22.0, ignite: 24.0, title: 25.0, end: 30,
};
const VO = [{ id: 'v1', t: .3 }, { id: 'v2', t: 5.7 }, { id: 'v3', t: 8.1 }, { id: 'v4', t: 12.4 }, { id: 'v5', t: 16.2 }, { id: 'v6', t: 19.4 }, { id: 'v7', t: 24.0 }];
const CUES = [
  [.3, 2.8, 'Jedes Mal, wenn du entsperrst,'], [2.8, 5.5, 'schießt dir dein Handy 30.000 Laserpunkte ins Gesicht.'],
  [5.7, 7.9, 'Unsichtbar. Infrarot.'],
  [8.1, 10.2, 'Eine Kamera sieht, wie sich das Muster'], [10.2, 12.2, 'über Nase und Wangen verbiegt.'],
  [12.4, 15.9, 'Daraus baut ein Chip eine 3D-Karte deines Gesichts.'],
  [16.2, 19.0, 'Ein Foto? Ist flach. Abgelehnt.'],
  [19.4, 21.4, 'Dass ein Fremder dein Handy entsperrt:'], [21.4, 23.8, 'eins zu einer Million.'],
  [24.0, 25.8, 'Du siehst es nie.'], [25.8, 28.2, 'Aber dein Handy sieht dich in 3D.'],
];

// —— the face: a height field over an ellipse (front) and a plain shell behind ——
const FA = .72, FB = 1.0, FC = .8;
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (sx * sx) - ((y - cy) ** 2) / (sy * sy));
function inside(x, y) { return (x / FA) ** 2 + (y / FB) ** 2 < 1; }
function zFront(x, y, flat = 0) {
  const q = 1 - (x / FA) ** 2 - (y / FB) ** 2; if (q <= 0) return 0;
  let z = FC * Math.sqrt(q);
  const ax = Math.abs(x);
  const nose = .36 * Math.exp(-(x * x) / ((.07 + .1 * clamp((.3 - y) / .55)) ** 2)) * clamp((y + .3) / .12) * clamp((.32 - y) / .2) * (1 + .4 * g2(0, y, 0, -.2, 1, .08));
  const sockets = -.19 * g2(ax, y, .27, .19, .12, .08);
  const brow = .06 * g2(ax, y, .28, .36, .2, .05);
  const cheek = .06 * g2(ax, y, .36, -.08, .14, .14);
  const lips = .08 * g2(x, y, 0, -.47, .18, .05) - .04 * g2(x, y, 0, -.5, .15, .012);
  const chin = .05 * g2(x, y, 0, -.78, .17, .1);
  const z1 = z + nose + sockets + brow + cheek + lips + chin;
  return lerp(z1, .12, flat);   // a photo: everything on one plane
}
const zBack = (x, y) => { const q = 1 - (x / FA) ** 2 - (y / FB) ** 2; return q <= 0 ? 0 : -FC * 1.05 * Math.sqrt(q); };

// —— camera: yaw / pitch / distance, perspective, the subject's screen centre ——
let CAM = { yaw: 0, pitch: 0, dist: 4.2, cx: 540, cy: 820, f: 1500 };
function proj(x, y, z) {
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw), cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  let X = cy * x + sy * z, Z = -sy * x + cy * z; let Y = cp * y - sp * Z; Z = sp * y + cp * Z;
  const d = CAM.dist - Z, k = CAM.f / d;
  return [CAM.cx + X * k, CAM.cy - Y * k, Z];
}
const fog = z => clamp(.25 + .75 * (z + 1) / 2);   // near bright, far ~25 %

// —— layers ——
const out = document.getElementById('c'), O = out.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const LW = mk(), LH = mk(), LA = mk(), LT = mk();
const Wg = LW.getContext('2d'), Hg = LH.getContext('2d'), Ag = LA.getContext('2d'), Tg = LT.getContext('2d');
const RAJ = (px, w = 600) => `${w} ${px}px Rajdhani`, MONO = px => `${px}px "Share Tech Mono"`;

function polyline(g, pts, col, w, a) { if (pts.length < 2) return; g.strokeStyle = rgba(col, a); g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
// the wireframe: contour lines (const y) and meridians (const x), front and back; scan reveals up to yScan; flat blends to a photo
function wire(t, o = {}) {
  const yScan = o.yScan ?? 2, flat = o.flat || 0, alpha = o.alpha ?? 1, hotY = o.hotY;
  Wg.globalCompositeOperation = 'lighter';
  for (let side = 0; side < 2; side++) {
    for (let yi = -19; yi <= 19; yi++) {
      const y = yi * .05; if (y > yScan) continue; const xm = FA * Math.sqrt(Math.max(0, 1 - (y / FB) ** 2)); if (xm < .02) continue;
      let seg_ = [], zs = 0;
      for (let k = 0; k <= 48; k++) { const x = -xm + 2 * xm * k / 48, z = side ? zBack(x, y) : zFront(x, y, flat); const p = proj(x, y, z); seg_.push(p); zs += p[2]; }
      const a = fog(zs / 49) * (side ? .35 : 1) * alpha * (yi % 4 === 0 ? 1 : .55);
      polyline(Wg, seg_, HUE, yi % 4 === 0 ? 1.6 : 1.1, a);
      if (hotY != null && Math.abs(y - hotY) < .05) polyline(Wg, seg_, HOT, 2.2, .9 * alpha);
    }
    for (let xi = -11; xi <= 11; xi++) {
      const x = xi * .065, ym = FB * Math.sqrt(Math.max(0, 1 - (x / FA) ** 2)); let seg_ = [], zs = 0;
      for (let k = 0; k <= 48; k++) { const y = -ym + 2 * ym * k / 48; if (y > yScan) break; const z = side ? zBack(x, y) : zFront(x, y, flat); const p = proj(x, y, z); seg_.push(p); zs += p[2]; }
      polyline(Wg, seg_, HUE, xi % 4 === 0 ? 1.4 : 1.0, fog(zs / Math.max(1, seg_.length)) * (side ? .3 : .8) * alpha * (xi % 4 === 0 ? 1 : .5));
    }
  }
  // the scan front: a bright ellipse ring at yScan
  if (yScan < 1.0 && yScan > -1.0) {
    const xm = FA * Math.sqrt(Math.max(0, 1 - (yScan / FB) ** 2)), ring = [];
    for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2, x = Math.cos(a) * (xm + .12), z = Math.sin(a) * (FC + .12); ring.push(proj(x, yScan, z)); }
    polyline(Hg, ring, HOT, 3, .95);
  }
}
// structured light: a regular dot grid from a projector beside the camera; each dot lands where its ray meets the face
const DOTS = []; { for (let j = -44; j <= 44; j++) for (let i = -34; i <= 34; i++) { const gx = i * .022 + (j % 2) * .011, gy = j * .022; DOTS.push([gx, gy, hash(i * 91 + j * 7)]); } }
function landing(gx, gy, flat) {   // the projector sits to the side: x_hit = gx + K·z(x_hit)
  const K = .32; let x = gx; for (let it = 0; it < 3; it++) { const z = inside(x, gy) ? zFront(x, gy, flat) : 0; x = gx + K * z; }
  return inside(x, gy) ? [x, gy, zFront(x, gy, flat)] : null;
}
function dots(t, o = {}) {
  const k = o.k ?? 1, flat = o.flat || 0, a = o.alpha ?? 1, fly = o.fly ?? 1;
  Hg.globalCompositeOperation = 'lighter';
  for (const [gx, gy, h] of DOTS) {
    if (h > k) continue;
    const L = landing(gx, gy, flat); if (!L) continue;
    let p = proj(L[0], L[1], L[2]);
    if (fly < 1) {   // dots fly in from the projector (a point at the top edge), staggered by their seed
      const u = eo(clamp((fly * 1.6 - h * .6)));
      p = [lerp(720, p[0], u), lerp(-40, p[1], u), p[2]];
      if (u < .02) continue;
    }
    const r = 1.6 + .8 * fog(p[2]);
    Hg.fillStyle = rgba(HOT, a * (.45 + .55 * fog(p[2]))); Hg.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
  }
}
// solid hologram: Fresnel faces + interlace, lines stay on top
function solid(t, k) {
  if (k <= 0) return; Wg.globalCompositeOperation = 'lighter';
  const N = 26;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = -FA + 2 * FA * i / N, x1 = -FA + 2 * FA * (i + 1) / N, y0 = -FB + 2 * FB * j / N, y1 = -FB + 2 * FB * (j + 1) / N;
    if (!inside(x0, y0) || !inside(x1, y0) || !inside(x0, y1) || !inside(x1, y1)) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, e = .01, nx = -(zFront(cx + e, cy) - zFront(cx - e, cy)) / (2 * e), ny = -(zFront(cx, cy + e) - zFront(cx, cy - e)) / (2 * e);
    const nz = 1 / Math.hypot(nx, ny, 1), view = Math.abs(nz * Math.cos(CAM.yaw) - nx * nz * Math.sin(CAM.yaw));
    const wave = clamp(1 - Math.abs(cy - lerp(-1.2, 1.2, seg(t, Tm.ignite, Tm.ignite + 1.2))) * 3);
    const a = k * (.06 + .32 * (1 - view) ** 2 + .25 * wave);
    const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => proj(x, y, zFront(x, y)));
    Wg.fillStyle = rgba(HUE, a); Wg.beginPath(); P.forEach((p, n) => n ? Wg.lineTo(p[0], p[1]) : Wg.moveTo(p[0], p[1])); Wg.closePath(); Wg.fill();
  }
}
function pad(t) {   // the projector pad under the subject, in perspective, rotating slowly
  const yP = -1.25, rr = [1.0, 1.25, 1.5];
  rr.forEach((R, n) => { const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2 + t * .2 * (n % 2 ? -1 : 1); pts.push(proj(Math.cos(a) * R, yP, Math.sin(a) * R)); }
    Wg.setLineDash(n === 1 ? [6, 10] : []); polyline(Wg, pts, HUE, n === 0 ? 2 : 1.2, n === 0 ? .7 : .35); Wg.setLineDash([]); });
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2 + t * .2, p0 = proj(Math.cos(a) * 1.5, yP, Math.sin(a) * 1.5), p1 = proj(Math.cos(a) * 1.58, yP, Math.sin(a) * 1.58); polyline(Wg, [p0, p1], HUE, 1, .4); }
}
// —— HUD ——
const GL = '#%&@$*/\\<>=+0123456789ABCDEFXZ';
function roll(s, k, t) { const n = s.length, locked = Math.floor(n * clamp(k)); let o = ''; for (let i = 0; i < n; i++) { const fromRight = n - 1 - i; o += (fromRight < locked || s[i] === ' ') ? s[i] : GL[Math.floor(hash(i * 13 + Math.floor(t * 24)) * GL.length)]; } return o; }
function plate(g, x, y, w, h) { g.fillStyle = 'rgba(2,10,14,.78)'; g.fillRect(x, y, w, h); g.strokeStyle = rgba(HUE, .45); g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
  g.strokeStyle = rgba(HUE, .95); g.lineWidth = 2; for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * 14); g.lineTo(cx, cy); g.lineTo(cx + sx * 14, cy); g.stroke(); } }
function lockBox(t, t0, x, y, w, h, label, value, tOut = 1e9, card = null) {
  if (t < t0 || t > tOut) return; const k = eo(seg(t, t0, t0 + .2)), flash = t - t0 > .2 && t - t0 < .2 + 3 / 24;
  const s = lerp(1.8, 1, k), rot = lerp(Math.PI / 4, 0, k), cx = x + w / 2, cy = y + h / 2;
  Tg.save(); Tg.translate(cx, cy); Tg.rotate(rot); Tg.scale(s, s); Tg.strokeStyle = flash ? HOT : rgba(HUE, lerp(.3, 1, k)); Tg.lineWidth = flash ? 3 : 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { Tg.beginPath(); Tg.moveTo(sx * w / 2, sy * (h / 2 - 22)); Tg.lineTo(sx * w / 2, sy * h / 2); Tg.lineTo(sx * (w / 2 - 22), sy * h / 2); Tg.stroke(); }
  Tg.restore();
  if (label && k > .9) { // leader + card with a rolling value
    const lk = eo(seg(t, t0 + .25, t0 + .7)), cw = 250, chh = 96, [cxp, cyp] = card || [cx + w / 2 + 80, cy - 70];
    const ax = cx - w / 2, ay = cy, bx = cxp + cw + 40, by = cyp, ex = lerp(bx, cxp + cw, lk);
    Tg.strokeStyle = rgba(HUE, .9); Tg.lineWidth = 1.5; Tg.beginPath(); Tg.arc(ax, ay, 6, 0, 7); Tg.moveTo(ax, ay); Tg.lineTo(lerp(ax, bx, Math.min(1, lk * 2)), lerp(ay, by, Math.min(1, lk * 2))); if (lk > .5) Tg.lineTo(ex, by); Tg.stroke();
    if (lk > .8) { const px = cxp; plate(Tg, px, by - chh / 2, cw, chh);
      Tg.font = RAJ(22); Tg.fillStyle = rgba(HUE, .9); Tg.fillText(label, px + 16, by - 14);
      const rk = seg(t, t0 + .7, t0 + 1.3); Tg.font = RAJ(44, 300); Tg.fillStyle = rk >= 1 ? ACC : HOT; Tg.fillText(roll(value, rk, t), px + 16, by + 32); }
  }
}
function furniture(t, mode, status) {
  // dot grid (slow parallax), corner brackets, rulers (faster parallax), status lines
  Tg.fillStyle = rgba(HUE, .12); const ox = (CAM.yaw * 60) % 60;
  for (let y = 0; y < H; y += 60) for (let x = -60; x < W + 60; x += 60) Tg.fillRect(x + ox, y, 2, 2);
  Tg.strokeStyle = rgba(HUE, .8); Tg.lineWidth = 2;
  for (const [x, y, sx, sy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) { Tg.beginPath(); Tg.moveTo(x, y + sy * 60); Tg.lineTo(x, y); Tg.lineTo(x + sx * 60, y); Tg.stroke(); }
  const ro = (CAM.yaw * 240) % 40;
  for (let y = 300; y < 1500; y += 20) { const big = Math.round((y + ro) / 20) % 5 === 0; Tg.fillStyle = rgba(HUE, big ? .6 : .25); Tg.fillRect(54, y + ro, big ? 22 : 10, 2); Tg.fillRect(W - 54 - (big ? 22 : 10), y - ro, big ? 22 : 10, 2); }
  Tg.font = MONO(22); Tg.fillStyle = rgba(HUE, .9); Tg.fillText(`SUBJECT // FACE   MODE: ${mode}`, 70, 92);
  Tg.textAlign = 'right'; Tg.fillText(status, W - 70, 92); Tg.textAlign = 'left';
  Tg.fillStyle = rgba(HUE, .6); Tg.fillText(`YAW ${(CAM.yaw * 57.3).toFixed(1).padStart(6)}°  PITCH ${(CAM.pitch * 57.3).toFixed(1).padStart(5)}°  T+${t.toFixed(2).padStart(5)}`, 70, H - 230);
}
function subtitle(t) {
  const c = CUES.find(c => t >= c[0] - .08 && t < c[1]); if (!c) return;
  let fs = 40; Tg.font = RAJ(fs); let w = Tg.measureText(c[2].toUpperCase()).width; if (w > 880) { fs = Math.floor(fs * 880 / w); Tg.font = RAJ(fs); w = Tg.measureText(c[2].toUpperCase()).width; }
  const bw = w + 130, bh = 84, x = (W - bw) / 2, y = 1740;
  plate(Tg, x, y, bw, bh);
  for (let i = 0; i < 8; i++) { const hh = 6 + 26 * Math.abs(Math.sin(t * 17 + i * 1.7)) * (t < c[1] - .4 ? 1 : .2); Tg.fillStyle = rgba(HUE, .8); Tg.fillRect(x + 22 + i * 7, y + bh / 2 - hh / 2, 3, hh); }
  Tg.font = RAJ(fs); Tg.fillStyle = HOT; Tg.fillText(c[2].toUpperCase(), x + 100, y + bh / 2 + fs * .35);
}
function composite(glitch) {
  O.globalCompositeOperation = 'source-over'; O.filter = 'none'; O.fillStyle = BG; O.fillRect(0, 0, W, H);
  const gr = O.createRadialGradient(W / 2, 820, 50, W / 2, 820, 900); gr.addColorStop(0, '#0B2730'); gr.addColorStop(1, BG); O.fillStyle = gr; O.fillRect(0, 0, W, H);
  O.globalCompositeOperation = 'lighter';
  for (const [L, blurs] of [[LW, [[14, .6], [4, .7], [0, 1]]], [LH, [[10, .8], [3, .8], [0, 1]]], [LA, [[10, .5], [0, 1]]]]) for (const [b, a] of blurs) { O.filter = b ? `blur(${b}px)` : 'none'; O.globalAlpha = a; O.drawImage(L, glitch ? (hash(glitch) - .5) * 40 : 0, 0); }
  O.filter = 'none'; O.globalAlpha = 1; O.globalCompositeOperation = 'source-over';
  O.drawImage(LT, 0, 0);
  const vg = O.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); O.fillStyle = vg; O.fillRect(0, 0, W, H);
  if (glitch) { for (let k = 0; k < 7; k++) { const y = hash(glitch * 3 + k) * H, h = 20 + hash(k + glitch) * 80; O.drawImage(out, 0, y, W, h, (hash(k * 7 + glitch) - .5) * 120, y, W, h); } }
}

// —— the film ——
function frame(t) {
  for (const g of [Wg, Hg, Ag, Tg]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  // camera path: front → 3/4 → whip turntable → front for the photo → 3/4 → slow orbit under the title
  CAM.yaw = t < Tm.bend ? lerp(.0, .08, seg(t, 0, Tm.bend)) : t < Tm.whip0 ? lerp(.08, .55, eio(seg(t, Tm.bend, Tm.bend + 1.2))) : t < Tm.photo0 ? .55 + 2 * Math.PI * eio(seg(t, Tm.whip0, Tm.whip1)) : t < Tm.real0 ? lerp(.55, .0, eio(seg(t, Tm.photo0, Tm.photo0 + .6))) : t < Tm.ignite ? lerp(0, -.45, eio(seg(t, Tm.real0, Tm.real0 + 1.5))) : -.45 + .5 * eio(seg(t, Tm.ignite, Tm.end));
  CAM.pitch = lerp(.05, .12, seg(t, 0, 30));
  CAM.dist = t < Tm.burst1 ? lerp(3.2, 4.2, eo(seg(t, 0, Tm.burst1))) : t > Tm.title ? lerp(4.2, 5.3, eio(seg(t, Tm.title, Tm.end))) : 4.2;
  CAM.cy = t > Tm.title ? lerp(820, 940, eio(seg(t, Tm.title, Tm.title + 1.5))) : 820;
  let mode = 'IR-SCAN', status = 'PROJECTOR ON', glitch = 0;
  const shake = (t0, a) => { const k = Math.exp(-(t - t0) / .08); if (t >= t0 && k > .03) { CAM.cx = 540 + (hash(Math.floor(t * 24)) - .5) * a * k; } };
  CAM.cx = 540; shake(Tm.burst0, 30); shake(Tm.reject, 40); shake(Tm.unlock, 24);

  if (t < Tm.scan0) {
    // 1 · the burst: 30 000 dots fly from the projector and land on a face that isn't drawn yet
    dots(t, { fly: seg(t, Tm.burst0, Tm.burst1), k: 1 });
    const n = Math.round(30000 * eo(seg(t, Tm.burst0, Tm.burst1)));
    Tg.font = RAJ(120, 300); Tg.textAlign = 'center'; Tg.fillStyle = n >= 30000 ? ACC : HOT; Tg.fillText(n.toLocaleString('de-DE'), W / 2, 300); Tg.font = RAJ(30); Tg.fillStyle = rgba(HUE, .9); Tg.fillText('INFRAROT-LASERPUNKTE', W / 2, 350); Tg.textAlign = 'left';
    status = `DOTS ${n.toLocaleString('de-DE')}`;
  } else if (t < Tm.map0) {
    // 2–3 · scan plane grows the wireframe; dots bend over nose and cheeks; target boxes lock
    const yS = lerp(-1.05, 1.05, eio(seg(t, Tm.scan0, Tm.scan1)));
    pad(t); wire(t, { yScan: yS }); dots(t, { alpha: t < Tm.bend ? .9 : .75 });
    if (t > Tm.scan0 + .2 && t < Tm.scan1 + 1.5) { Tg.font = RAJ(54, 300); Tg.fillStyle = HOT; Tg.textAlign = 'center'; Tg.fillText('UNSICHTBAR · INFRAROT', W / 2, 300); Tg.textAlign = 'left'; }
    const nose = proj(0, -.15, zFront(0, -.15)), cheek = proj(.36, -.08, zFront(.36, -.08));
    lockBox(t, Tm.lock1, nose[0] - 70, nose[1] - 90, 140, 180, 'NASE VOR WANGE', `+${Math.round((zFront(0, -.15) - zFront(.33, -.15)) * 104)} MM`, Tm.map0, [70, 470]);
    lockBox(t, Tm.lock2, cheek[0] - 75, cheek[1] + 40, 150, 150, 'WANGE VOR OHR', `+${Math.round((zFront(.36, -.08) - zFront(.66, -.08)) * 104)} MM`, Tm.map0, [70, 1330]);
    mode = 'STRUCTURED LIGHT'; status = 'DOTS 30.000';
  } else if (t < Tm.photo0) {
    // 4 · the 3D map: a whip around the head on the turntable, depth contours light up front to back
    pad(t); wire(t, { hotY: lerp(-1, 1, (t * .8) % 1) }); dots(t, { alpha: .5 });
    const k = seg(t, Tm.whip1, Tm.whip1 + .6);
    Tg.font = RAJ(64, 300); Tg.textAlign = 'center'; Tg.fillStyle = k >= 1 ? ACC : HOT; Tg.fillText(roll('3D-KARTE: FERTIG', k, t), W / 2, 300); Tg.textAlign = 'left';
    mode = 'DEPTH MAP'; status = 'CHIP: MATCHING';
  } else if (t < Tm.real0) {
    // 5 · a photo: the same face pressed flat; the dots stay straight; depth 0 → rejected (one glitch)
    const fk = eo(seg(t, Tm.photo0, Tm.photo0 + .5));
    pad(t);
    const fr = [[-FA - .1, -FB - .1], [FA + .1, -FB - .1], [FA + .1, FB + .1], [-FA - .1, FB + .1], [-FA - .1, -FB - .1]].map(([x, y]) => proj(x, y, .12));
    polyline(Wg, fr, HOT, 3, fk);
    wire(t, { flat: 1, alpha: fk, yScan: lerp(-1.05, 1.05, seg(t, Tm.photoScan, Tm.photoScan + .8)) }); dots(t, { flat: 1, alpha: .8 * fk });
    const dk = seg(t, Tm.photoScan + .8, Tm.reject);
    Tg.font = RAJ(64, 300); Tg.textAlign = 'center'; Tg.fillStyle = dk >= 1 ? ACC : HOT; Tg.fillText(roll('TIEFE: 0 MM', dk, t), W / 2, 300);
    if (t > Tm.reject) { Tg.font = RAJ(110, 600); Tg.fillStyle = HOT; Tg.fillText('ABGELEHNT', W / 2, 1520); }
    Tg.textAlign = 'left';
    if (t >= Tm.reject && t < Tm.reject + 3 / 24) glitch = Math.floor(t * 24);
    mode = 'SPOOF CHECK'; status = t > Tm.reject ? 'ACCESS DENIED' : 'CHIP: MATCHING';
  } else {
    // 6–7 · the real face: a full-face lock, 1 : 1 000 000, the padlock opens; the hologram ignites; the name rolls in
    const sk = seg(t, Tm.ignite, Tm.ignite + .8);
    pad(t); solid(t, sk); wire(t, { yScan: lerp(-1.05, 1.05, eio(seg(t, Tm.real0, Tm.real0 + .8))) }); dots(t, { alpha: .6 * (1 - sk) });
    const top = proj(0, 1.0, .2), bot = proj(0, -1.0, .2);
    lockBox(t, Tm.lockF, CAM.cx - 330, top[1] - 30, 660, bot[1] - top[1] + 60, null, null, Tm.ignite);
    const rk = seg(t, Tm.lockF + .3, Tm.unlock);
    if (t < Tm.title) { Tg.font = RAJ(96, 300); Tg.textAlign = 'center'; Tg.fillStyle = rk >= 1 ? ACC : HOT; Tg.fillText(roll('1 : 1.000.000', rk, t), W / 2, 310); Tg.font = RAJ(28); Tg.fillStyle = rgba(HUE, .9); Tg.fillText('CHANCE, DASS EIN FREMDER ENTSPERRT', W / 2, 356); Tg.textAlign = 'left'; }
    // padlock: wireframe, the shackle lifts on the unlock
    const ul = eo(seg(t, Tm.unlock, Tm.unlock + .4)), px = W / 2, py = 1500, lk = seg(t, Tm.lockF, Tm.lockF + .3) * (1 - seg(t, Tm.ignite, Tm.ignite + .4));
    if (lk > 0) { Wg.globalCompositeOperation = 'lighter'; Wg.strokeStyle = rgba(ul > .5 ? HOT : HUE, lk); Wg.lineWidth = 4; Wg.strokeRect(px - 60, py - 30, 120, 90);
      Wg.beginPath(); Wg.arc(px + (ul * 0), py - 30 - ul * 40, 40, Math.PI, 0); Wg.lineTo(px + 40, py - 30 - ul * 40 + (ul > .2 ? -10 : 0)); Wg.moveTo(px - 40, py - 30 - ul * 40); Wg.lineTo(px - 40, py - 30 + (1 - ul) * 0); Wg.stroke(); }
    if (t > Tm.title) {
      const k = seg(t, Tm.title, Tm.title + .8); Tg.textAlign = 'center';
      Tg.font = RAJ(150, 300); Tg.letterSpacing = '18px'; Tg.fillStyle = k >= 1 ? ACC : HOT; Tg.fillText(roll('FACE ID', k, t), W / 2 + 9, 330); Tg.letterSpacing = '0px';
      Tg.font = MONO(24); Tg.fillStyle = rgba(HUE, .9); Tg.fillText('30.000 PUNKTE · INFRAROT · 3D', W / 2, 390); Tg.textAlign = 'left';
    }
    mode = t > Tm.ignite ? 'HOLOGRAM' : 'VERIFY'; status = t > Tm.unlock ? 'ACCESS GRANTED' : 'CHIP: MATCHING';
  }
  furniture(t, mode, status);
  subtitle(t);
  composite(glitch);
  if (t > Tm.end - .5) { O.fillStyle = `rgba(3,8,11,${ei(seg(t, Tm.end - .5, Tm.end))})`; O.fillRect(0, 0, W, H); }
}
window.render = frame;
window.DUR = DUR;
window.EV = [
  { t: .25, type: 'boom' }, { t: Tm.burst0, type: 'spray', d: Tm.burst1 - Tm.burst0 }, { t: Tm.burst1, type: 'ping' },
  { t: Tm.scan0, type: 'scan', d: Tm.scan1 - Tm.scan0 }, { t: Tm.lock1, type: 'lock' }, { t: Tm.lock1 + .7, type: 'ratchet' }, { t: Tm.lock2, type: 'lock' }, { t: Tm.lock2 + .7, type: 'ratchet' },
  { t: Tm.whip0, type: 'whip', d: Tm.whip1 - Tm.whip0 }, { t: Tm.whip1, type: 'ratchet' }, { t: Tm.whip1 + .6, type: 'ping' },
  { t: Tm.photo0, type: 'slide' }, { t: Tm.photoScan, type: 'scan', d: .8 }, { t: Tm.reject, type: 'deny' },
  { t: Tm.real0, type: 'scan', d: .8 }, { t: Tm.lockF, type: 'lock' }, { t: Tm.lockF + .3, type: 'ratchet' }, { t: Tm.unlock, type: 'unlock' },
  { t: Tm.ignite, type: 'ignite' }, { t: Tm.title, type: 'ratchet' }, { t: Tm.title + .8, type: 'ping' },
  ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id })),
];
window.SUBS = CUES.map(c => ({ t0: c[0], t1: c[1], text: c[2] }));
Promise.all([document.fonts.load('600 30px Rajdhani'), document.fonts.load('300 60px Rajdhani'), document.fonts.load('22px "Share Tech Mono"')]).then(() => { frame(0); window.READY = true; });
