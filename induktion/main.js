// INDUKTION · Glass Product Render · 1080×1920
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';
import { clamp, seg, eio, eo, ei, ss, lerp, hash } from '/core/lib.js';
import { DUR, T, SHOTS, shotAt, PULSES, VO, BEAT, SFX } from './story.js';
import { makeHob, explode, setPulses, ACC_A, ACC_B } from './product.js';
import { makeStudio } from './studio.js';

const QS = new URLSearchParams(location.search), NOSUB = QS.has('nosub');
const SSAA = parseFloat(QS.get('ssaa') || '1');
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.1;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#000000');
const camera = new THREE.PerspectiveCamera(38, W / H, 1, 4000);
const post = makePost(renderer, scene, camera, W, H, { ssaa: SSAA, ao: false });
post.bloom.strength = .2; post.bloom.threshold = 1.1; post.bloom.radius = .45;
post.vig.uniforms.amt.value = .3; post.vig.uniforms.contrast.value = .12; post.vig.uniforms.sat.value = 1.0;

const studio = makeStudio(renderer, scene);
studio.U.uRes.value.set(W * SSAA, H * SSAA);
studio.U.uA.value = ACC_A.clone(); studio.U.uB.value = ACC_B.clone();
const hob = makeHob(); scene.add(hob.root);
const BASE_Y = 30; hob.root.position.y = BASE_Y;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

// Current pulses: every hit sends two comets from the centre of the coil outward
function current(t, on) {
  const list = []; let flash = 0;
  if (on > 0) for (const k of PULSES) {
    const dt = t - k.t; if (dt < 0 || dt > 1.4) continue;
    const A = (k.big ? 11 : 7) * Math.exp(-dt / .5) * on;
    list.push({ p: dt / .9, w: .035, a: A, h: clamp(dt * 1.2) });
    flash += (k.big ? 1.4 : 1) * Math.exp(-dt / .12) * on;
  }
  return { list: list.slice(-8), flash };
}

const SW = (t, a, b2) => { const u = seg(t, a, b2); return u > 0 && u < 1 ? u : null; };
const orbit = (az, el, d, c = V(0, 0, 0)) => c.clone().add(V(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d));

function frame(t) {
  const [t0, t1, name] = shotAt(t), u = seg(t, t0, t1);
  let pos, look, fov = 38, focus = null, aper = 200;
  const envO = { left: 1, right: 1, top: 1, front: .6, back: 1, key: 0 };
  let bg = .35, sweep = null, bloom = .2, spot = .02;
  let coilDim = 1, fieldOver = false, inside = true, clear = 0, heat = 0, eddy = 0, fieldI = 0, cur = 0, coilBase = 0, panVis = true, bowlVis = false, fieldTop = 3, caus = 0, e = 0, spin = 0;
  hob.root.quaternion.identity();
  const C = V(0, BASE_Y, 0);

  switch (name) {
    case 'hook': {   // low 3/4 from just under the plate: a glowing pan bottom above cool, frosted glass
      const amb = ss(seg(t, .6, 3.2));
      Object.assign(envO, { left: .15 + .85 * amb, right: .15 + .85 * amb, top: .1 + .6 * amb, front: 0, back: .2 + .9 * amb });
      const s1 = SW(t, ...T.sweep1), s2 = SW(t, ...T.sweep2);
      if (s1 != null) sweep = { x: lerp(-1, 1, s1), I: 7 * Math.sin(s1 * Math.PI) };
      if (s2 != null) sweep = { x: lerp(1, -1, s2), I: 6 * Math.sin(s2 * Math.PI), tilt: .25 };
      pos = orbit(lerp(-.55, -.42, eio(u)), lerp(-.12, -.08, eio(u)), lerp(520, 455, eio(u)), C.clone().add(V(0, 10, 0)));
      look = C.clone().add(V(0, 20, 0)); focus = C.clone().add(V(-10, 0, 40)); aper = 120; inside = false;
      heat = .75 + .25 * ss(seg(t, 0, 2.5)); eddy = .0; bg = .3 * amb; spot = .03; caus = .25;
      break;
    }
    case 'reveal': {   // top-down macro: the frost clears and the coil appears; focus pulls from the surface to the copper
      panVis = false; clear = eio(seg(t, ...T.clear));
      pos = C.clone().add(V(10, lerp(250, 205, eio(u)), lerp(120, 92, eio(u)))); look = C.clone().add(V(0, -8, 4));
      focus = C.clone().add(V(0, 0, 30)).lerp(C.clone().add(V(0, -10, 20)), ss(seg(t, ...T.rack))); aper = 500;
      coilBase = .02 + .05 * ss(seg(t, 7, 9.5)); bg = .45;
      const s = SW(t, 5.0, 6.3); if (s != null) sweep = { x: lerp(-1, 1, s), I: 5 * Math.sin(s * Math.PI), tilt: -.4 };
      Object.assign(envO, { front: 0, top: 1.3 });
      break;
    }
    case 'current': {   // side macro orbit just above the glass: current runs as light, field loops rise out of the coil
      panVis = false; clear = 1;
      const az = lerp(-.5, .1, eio(u));
      pos = orbit(az, lerp(.17, .12, eio(u)), lerp(330, 290, eio(u)), C.clone().add(V(0, -6, 0))); look = C.clone().add(V(4, 14, 0)); coilDim = .35;
      focus = C.clone().add(V(Math.sin(az) * 40, -8, Math.cos(az) * 40)); aper = 380;
      cur = 1; fieldI = ss(seg(t, 11.2, 13.6)); fieldTop = 99; bg = .5; caus = .3;
      Object.assign(envO, { front: .2, top: 1.2 });
      break;
    }
    case 'explode': {   // axis ~40° to the view; parts drift apart, hover, hold in silence, snap together on the downbeat
      clear = 1; Object.assign(envO, { left: 1.3, right: 1.3, top: 1.5, front: .5, back: 1.5, key: 1.1 }); bg = .9;
      if (t < T.explode[1]) e = eo(seg(t, ...T.explode));
      else if (t < T.hush) e = 1 + .03 * seg(t, T.explode[1], T.hush);
      else if (t < T.snap - .25) e = 1.03;
      else if (t < T.snap) e = 1.03 * (1 - ei(seg(t, T.snap - .25, T.snap)));
      else e = 0;
      spin = (Math.min(t, T.snap) - 15) * 1.2;
      hob.root.quaternion.setFromAxisAngle(V(1, 0, 0), .38).premultiply(new THREE.Quaternion().setFromAxisAngle(Y, .3));
      const push = eo(seg(t, T.snap, T.snap + 1.1));
      const az = lerp(.15, .38, eio(seg(t, 15, 21.25)));
      pos = orbit(az, lerp(.5, .42, push), lerp(640, 380, push) - 40 * eio(seg(t, 15, 19.4)), C.clone().add(V(0, 20 * (1 - push), 0)));
      look = C.clone().add(V(0, 6 * e + 6, 0)).add(V(0, -40 * e, 0)); coilDim = .5; fov = 38; focus = C.clone().add(V(0, 20 * e, 0)); aper = lerp(60, 180, push);
      fieldI = t < T.snap ? .6 * ss(seg(t, 15.3, 16.8)) * (t >= T.hush ? .35 : 1) : .9; fieldTop = 3 + 62 * e;
      cur = t < T.hush ? 1 : t < T.snap ? 0 : 1;
      eddy = t < T.snap ? .55 * ss(seg(t, 16.0, 17.6)) * (t >= T.hush ? .4 : 1) : 1;
      heat = t < T.snap ? .1 : .2 + .8 * eo(seg(t, T.snap, T.snap + 1.0));
      if (t >= T.snap) { const k = Math.exp(-(t - T.snap) / .08), fr = Math.floor(t * 24); pos.add(V(hash(fr) - .5, hash(fr + 9) - .5, 0).multiplyScalar(k * 5)); }
      bloom = .25; caus = .4;
      break;
    }
    case 'bowl': {   // straight-on front, slight push: the glass bowl lets the field through and stays cold
      panVis = false; bowlVis = true; clear = 1;
      pos = C.clone().add(V(lerp(30, 18, eio(u)), lerp(120, 104, eio(u)), lerp(340, 300, eio(u)))); look = C.clone().add(V(0, 16, 0));
      focus = C.clone().add(V(0, 16, 20)); aper = 160;
      cur = 1; fieldI = .9; fieldTop = 99; bg = 1.25; caus = .9; spot = .04; coilDim = .4; fieldOver = true;
      Object.assign(envO, { front: 0, back: 2.6, top: 1.6, left: 1.6, right: 1.6 });
      break;
    }
    case 'end': {   // pull-back into negative space under the title; the pan glows on its own
      clear = 1;
      const s = SW(t, 25.0, 26.4); if (s != null) sweep = { x: lerp(-1, 1, s), I: 6 * Math.sin(s * Math.PI) };
      pos = orbit(lerp(-.3, -.18, eio(u)), lerp(.16, .22, eio(u)), lerp(330, 440, eio(u)), C.clone().add(V(0, 10, 0)));
      look = C.clone().add(V(0, lerp(14, 70, eio(u)), 0)); focus = C.clone(); aper = 120;
      cur = 1; fieldI = .5 * (1 - ss(seg(t, 27, 29))); heat = 1; eddy = .7 - .4 * ss(seg(t, 27, 29.5)); bg = 1.0; bloom = .3; caus = .5; spot = .05;
      Object.assign(envO, { back: 2.2, left: 1.2, right: 1.2, front: 0, top: 1.3 });
      break;
    }
  }

  explode(hob, e, spin);
  for (const k of ['coil', 'ferrite', 'shield']) hob.parts[k].g.visible = inside;
  // the bowl settles onto the plate
  hob.parts.bowl.g.position.y = hob.parts.bowl.y + (name === 'bowl' ? 40 * (1 - eo(seg(t, ...T.bowlDown))) : 0);
  hob.parts.pan.g.visible = panVis; hob.parts.bowl.g.visible = bowlVis;

  // Plate: frosted → clear
  const pm = hob.plateMat;
  pm.roughness = lerp(.4, .015, clear); pm.transmission = lerp(.86, 1, clear); pm.thickness = lerp(9, 5, clear);
  pm.color.set('#eef1f4').lerp(new THREE.Color('#ffffff'), clear);

  // Light inside: current pulses, coil glow, field, eddies, heat
  const c = current(t, cur);
  setPulses(hob.coilMat, c.list, coilBase + c.flash * .05);
  hob.coilL.intensity = (coilBase * 60 + c.flash * 120) * coilDim;
  hob.fieldMat.depthTest = !fieldOver; hob.field.renderOrder = fieldOver ? 10 : 0;
  hob.fieldMat.uniforms.uI.value = fieldI * (.55 + .45 * clamp(c.flash));
  hob.fieldMat.uniforms.uPh.value = t * 1.6;
  hob.fieldMat.uniforms.uTop.value = fieldTop;
  hob.field.visible = fieldI > .001;
  const pb = hob.panBottomM.userData.U; pb.uEddy.value = eddy * (.7 + .3 * clamp(c.flash)); pb.uHeat.value = heat; pb.uTime.value = t;
  hob.heatL.intensity = panVis ? heat * 110 : 0;
  hob.heatL.position.y = (hob.parts.pan.g.position.y) + 2;

  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
  const az = Math.atan2(camera.position.x, camera.position.z);
  if (sweep) sweep.az = az + Math.PI;
  studio.updateEnv(Object.assign(envO, { sweep: sweep || { I: 0 }, aura: { I: c.flash * .35 * coilDim, col: ACC_A } }));
  scene.backgroundIntensity = bg; studio.U.uBgI.value = bg;
  post.dof.focus = focus ? camera.position.distanceTo(focus) : 300; post.dof.aper = aper; post.dof.maxCoc = 12;
  post.bloom.strength = bloom + c.flash * .04 + heat * .05;
  const U = studio.U; U.uTime.value = t * .6; U.uSpot.value = spot;
  U.uC.value[0].set(0, 0, 70, caus * (.5 + .5 * clamp(c.flash)) + (sweep ? sweep.I / 14 : 0));
  U.uC.value[1].set(0, 0, 1, 0); U.uC.value[2].set(0, 0, 1, 0);
  for (const wv of U.uWave.value) wv.set(0, 0, 0, 0);
  let wi = 0;
  if (name === 'bowl' || name === 'end' || (name === 'explode' && t >= T.snap)) for (const k of PULSES) {
    const dt = t - k.t; if (dt < 0 || dt > 2.2 || !k.big || wi >= 12) continue;
    U.uWave.value[wi++].set(0, 0, 40 + 55 * dt, .5 * Math.exp(-dt / .7));
  }
  if (name === 'explode' && t >= T.snap && wi < 12) { const dt = t - T.snap; U.uWave.value[wi++].set(0, 0, 30 + 70 * dt, 1.1 * Math.exp(-dt / .8)); }
  return name;
}

// —— 2D layer: subtitles (frosted-glass bar), title ——
const ov = document.getElementById('ov'), g = ov.getContext('2d');
let DURS = {};
try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }
const voDur = v => DURS[v.id] ?? v.text.length * .065;
const subEnd = v => v.t + Math.max(1.8, voDur(v) + .6);
await document.fonts.load('200 100px "Inter Tight"'); await document.fonts.load('300 40px "Inter Tight"'); await document.fonts.load('500 20px "Inter Tight"');

function spaced(text, x, y, font, spacing) {
  g.font = font; g.letterSpacing = spacing + 'px'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x + spacing / 2, y); g.letterSpacing = '0px';
}
function glintText(text, y, font, spacing, a, gx) {
  g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(240,242,245,.94)'; spaced(text, W / 2, y, font, spacing); g.restore();
  if (gx == null) return;
  g.save(); g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(gx - 140, 0, gx + 140, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,200,140,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(.58, 'rgba(255,140,110,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, y - 110, W, 220); g.restore();
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (g.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL; }
  if (cur) lines.push(cur); return lines;
}
const SUB_Y = H - 360;
function subtitle(text, a) {
  g.font = '300 44px "Inter Tight"'; g.letterSpacing = '0.5px';
  const lines = wrap(text, 860), lh = 58;
  const tw = Math.max(...lines.map(l => g.measureText(l).width)), pw = tw + 96, ph = 34 + lh * lines.length, x = (W - pw) / 2, y = SUB_Y - ph / 2, rad = Math.min(40, ph / 2);
  g.save(); g.globalAlpha = a;
  g.save(); g.beginPath(); g.roundRect(x, y, pw, ph, rad); g.clip(); g.filter = 'blur(20px) brightness(1.3)';
  g.drawImage(renderer.domElement, 0, 0, W, H); g.filter = 'none';
  g.fillStyle = 'rgba(225,230,238,.11)'; g.fillRect(x, y, pw, ph); g.restore();
  g.lineWidth = 1.2; const eg = g.createLinearGradient(x, y, x + pw, y + ph);
  eg.addColorStop(0, 'rgba(255,255,255,.55)'); eg.addColorStop(.5, 'rgba(255,255,255,.12)'); eg.addColorStop(1, 'rgba(255,255,255,.35)');
  g.strokeStyle = eg; g.beginPath(); g.roundRect(x + .5, y + .5, pw - 1, ph - 1, rad); g.stroke();
  g.strokeStyle = 'rgba(255,174,74,.45)'; g.beginPath(); g.moveTo(x + 40, y + 1.5); g.lineTo(x + pw * .45, y + 1.5); g.stroke();
  g.strokeStyle = 'rgba(255,106,61,.38)'; g.beginPath(); g.moveTo(x + pw * .45, y + 1.5); g.lineTo(x + pw - 40, y + 1.5); g.stroke();
  g.fillStyle = 'rgba(246,247,249,.97)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, W / 2, y + 17 + lh * (i + .5) + 1));
  g.letterSpacing = '0px'; g.restore();
}
function hud(t) {
  g.clearRect(0, 0, W, H);
  if (t < .25) { g.fillStyle = `rgba(0,0,0,${1 - ss(seg(t, 0, .25))})`; g.fillRect(0, 0, W, H); }
  if (NOSUB) return;
  const v = VO.find(v => t >= v.t - .05 && t < subEnd(v));
  if (v) { const e = subEnd(v), a = ss(seg(t, v.t - .05, v.t + .15)) * (1 - ss(seg(t, e - .2, e))); subtitle(v.text, a); }
  // Title card: kicker + INDUKTION, a glint sweeping across with the strip light
  if (t >= T.title[0]) {
    const a = ss(seg(t, T.title[0] + .2, T.title[0] + 1.0));
    const sw = seg(t, 25.0, 26.4), gx = sw > 0 && sw < 1 ? lerp(W * .1, W * .9, sw) : null;
    g.save(); g.globalAlpha = a * .8; g.fillStyle = '#d3d8de'; spaced('SO FUNKTIONIERT', W / 2, 330, '500 26px "Inter Tight"', 12); g.restore();
    glintText('INDUKTION', 430, '200 116px "Inter Tight"', 22, a, gx);
  }
  const fo = seg(t, DUR - .6, DUR); if (fo > 0) { g.fillStyle = `rgba(0,0,0,${ss(fo)})`; g.fillRect(0, 0, W, H); }
}

window.render = t => {
  frame(t);
  scene.updateMatrixWorld(); camera.updateMatrixWorld();
  studio.reflect(camera);
  post.composer.render();
  hud(t);
};
window.DUR = DUR;
window.EV = [...SFX, ...PULSES.map(p => ({ t: p.t, type: 'pulse', big: p.big })), ...VO.map(v => ({ t: v.t, type: 'vo', id: v.id, text: v.text }))];
window.SUBS = VO.map(v => ({ t0: v.t, t1: subEnd(v), text: v.text }));
window.TEXTS = t => {
  const o = []; const v = VO.find(v => t >= v.t && t < subEnd(v));
  if (v) o.push({ id: v.id, text: v.text, x0: 90, y0: SUB_Y - 60, x1: W - 90, y1: SUB_Y + 60 });
  if (t >= T.title[0]) o.push({ id: 'title', text: 'SO FUNKTIONIERT INDUKTION', x0: 60, y0: 300, x1: W - 60, y1: 480 });
  return o;
};
window.READY = true;
