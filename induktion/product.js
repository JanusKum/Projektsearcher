// Product: a fictional induction hob zone, built as glass, copper, ferrite and light. Units: millimetres. Plate top surface at y = 0.
// Parts (top → bottom): steel pan (or a clear glass bowl) · glass plate · copper coil · ferrite bars · aluminium shield.
import * as THREE from 'three';

// One accent family, reserved for light: amber → rose-orange (energy turning into heat)
export const ACC_A = new THREE.Color('#ffae4a');
export const ACC_B = new THREE.Color('#ff6a3d');

export function glass(o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({
    color: '#ffffff', metalness: 0, roughness: .015, transmission: 1, thickness: 4, ior: 1.5,
    dispersion: 5, attenuationColor: new THREE.Color('#f4f7f9'), attenuationDistance: 220,
    specularIntensity: 1, envMapIntensity: 1.25, side: THREE.DoubleSide,
  }, o));
}
const metal = (color, rough, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, metalness: 1, roughness: rough, envMapIntensity: 1.2 }, o));

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// Concentric brushing (pan bottom, shield)
const brushed = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { const r = R() * w * .72; const v = R() < .5 ? 255 : 0; g.strokeStyle = `rgba(${v},${v},${v},${.05 + R() * .08})`; g.lineWidth = .6 + R(); g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
}, false);
const WHITE = canvasTex(2, 2, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); });

// Copper with comet pulses running along the wire (uv.x = position along the spiral, 0 = centre, 1 = outer end)
export function copperMat() {
  const m = metal('#c97a4f', .24, { emissive: '#ffffff', emissiveMap: WHITE, clearcoat: .3, clearcoatRoughness: .2 });
  const U = { uP: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, .1, 0, 0)) }, uBase: { value: 0 }, uA: { value: ACC_A }, uB: { value: ACC_B } };
  m.userData.U = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uP[8]; uniform float uBase; uniform vec3 uA, uB;`)
      .replace('#include <emissivemap_fragment>', `{
        float x = vEmissiveMapUv.x; vec3 acc = uA * uBase;
        for (int i = 0; i < 8; i++) { vec4 P = uP[i]; if (P.z <= 0.) continue;
          float w = abs(P.y), s = sign(P.y + 1e-6), a = (x - P.x) * s;
          float head = exp(-a * a / (w * w * .25)), tail = a < 0. ? exp(a / (w * 4.)) * .55 : 0.;
          float k = max(head, tail);
          acc += (mix(uA, uB, P.w + (1. - head) * .3) * k + vec3(head * head * head * .35)) * P.z; }
        totalEmissiveRadiance = acc; }`);
  };
  m.customProgramCacheKey = () => 'copper';
  return m;
}
export function setPulses(mat, list, base = 0) {
  const U = mat.userData.U; U.uBase.value = base;
  for (let i = 0; i < 8; i++) { const p = list[i]; U.uP.value[i].set(p ? p.p : 0, p ? p.w : .1, p ? p.a : 0, p ? p.h : 0); }
}

// Pan bottom: steel whose emission shows the eddy currents (rotating rings) and the heat (a glow that spreads from the centre)
export function panBottomMat() {
  const m = metal('#b9bdc2', .2, { roughnessMap: brushed, emissive: '#ffffff', emissiveMap: WHITE });
  const U = { uEddy: { value: 0 }, uHeat: { value: 0 }, uTime: { value: 0 }, uA: { value: ACC_A }, uB: { value: ACC_B }, uR: { value: 52 } };
  m.userData.U = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLP; uniform float uEddy, uHeat, uTime, uR; uniform vec3 uA, uB;`)
      .replace('#include <emissivemap_fragment>', `{
        float r = length(vLP.xz) / uR, th = atan(vLP.z, vLP.x);
        // eddy currents: closed rings that circle the axis, dashes travelling round them (alternating direction per ring)
        float ring = 0.;
        for (int k = 0; k < 6; k++) { float rk = .2 + float(k) * .135; float dir = mod(float(k), 2.) < .5 ? 1. : -1.;
          float band = exp(-pow((r - rk) / .022, 2.));
          float dash = .35 + .65 * pow(.5 + .5 * sin(th * 6. + dir * uTime * (7. - float(k)) + float(k)), 3.);
          ring += band * dash; }
        float heat = smoothstep(1.02, .0, r) * (.55 + .45 * smoothstep(.95, .3, r));
        vec3 hc = mix(uB * .8, uA, smoothstep(.0, .9, uHeat * (1. - r * .4)));
        totalEmissiveRadiance = mix(uA, uB, r) * ring * uEddy * 2.2 + hc * heat * uHeat * 1.6 + vec3(1.) * ring * uEddy * uEddy * .25; }`);
  };
  m.customProgramCacheKey = () => 'panbottom';
  return m;
}

const lathe = (pts, seg = 160) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

export function makeHob() {
  const root = new THREE.Group();
  const parts = {};
  const add = (name, obj, y) => { const g = new THREE.Group(); g.add(obj); g.position.y = y; root.add(g); parts[name] = { g, y }; return g; };

  // Glass plate: a thick round slab with a softly rounded edge (frosted by default; uClear animates it to clear)
  const R = 74, H = 6, e = 1.6, prof = [[0, -H]];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; prof.push([R - e + Math.cos(a) * e, -H / 2 + Math.sin(a) * (H / 2)]); }
  prof.push([0, 0]);
  const plateMat = glass({ thickness: 9, roughness: .4, transmission: .86, color: '#eef1f4', dispersion: 3 });
  const plate = new THREE.Mesh(lathe(prof), plateMat);
  add('plate', plate, 0);
  // a printed ring on the plate's surface marks the cooking zone (thin satin metal line)
  const zone = new THREE.Mesh(new THREE.TorusGeometry(60, .25, 8, 200), metal('#c9cdd2', .3)); zone.rotation.x = Math.PI / 2; zone.position.y = .05; parts.plate.g.add(zone);

  // Copper coil: a flat Archimedean spiral of round wire, 11 turns, r 9 → 58
  const pts = [], turns = 11, N = 1400;
  for (let i = 0; i <= N; i++) { const u = i / N, r = 9 + 49 * u, a = u * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const coilMat = copperMat();
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 2400, 1.75, 10), coilMat);
  add('coil', coil, -10);
  // Ferrite bars: eight radial dark-grey bars that send the field upward
  const fer = new THREE.Group(), ferM = new THREE.MeshPhysicalMaterial({ color: '#2a2c2f', roughness: .55, metalness: .2, clearcoat: .2 });
  for (let k = 0; k < 8; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(36, 3, 7), ferM); const a = k * Math.PI / 4; bar.position.set(Math.cos(a) * 34, 0, Math.sin(a) * 34); bar.rotation.y = -a; fer.add(bar); }
  add('ferrite', fer, -15);
  // Aluminium shield: a thin brushed disc
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(66, 66, 1.4, 160), metal('#aab0b6', .32, { roughnessMap: brushed }));
  add('shield', shield, -19);

  // Steel pan: brushed walls + a thick bottom disc that carries the eddy currents and the heat
  const pan = new THREE.Group();
  const wallP = [[52, 2.8], [53.5, 4], [54.5, 10], [55.5, 40], [57.5, 42.5], [58.5, 42.5], [56.6, 40], [55.6, 10], [54.6, 2.6], [52.6, 0]];
  const panBottomM = panBottomMat();
  const walls = new THREE.Mesh(lathe(wallP), metal('#c7cbd0', .18, { side: THREE.DoubleSide }));
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(53, 52.6, 3, 160), panBottomM); bottom.position.y = 1.5;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 70, 32), metal('#bfc4c9', .22)); handle.rotation.z = Math.PI / 2; handle.position.set(-56 - 35, 34, 0);
  pan.add(walls, bottom, handle);
  add('pan', pan, .2);

  // Clear glass bowl (the proof): the same footprint, no glow anywhere
  const bowlP = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI / 2; bowlP.push([Math.max(0, 50 * Math.sin(a) + 4 * (1 - Math.cos(a))), 46 - 44 * Math.cos(a)]); }
  const inner = bowlP.slice().reverse().map(([x, y]) => [Math.max(0, x - 2.6), y + 2.6]);
  const bowl = new THREE.Mesh(lathe([[0, 1.2], ...bowlP.slice(1), [54.5, 46.5], ...inner]), glass({ thickness: 3.5 }));
  add('bowl', bowl, .3);

  // Field lines: closed loops through the coil's middle, over the top and back round the outside (additive light, pulsing with the current)
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uPh: { value: 0 }, uA: { value: ACC_A }, uB: { value: ACC_B }, uTop: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uI, uPh, uTop; uniform vec3 uA, uB; varying vec2 vUv; varying float vY;
      void main(){ float x = vUv.x; float dash = pow(.5 + .5 * sin((x * 6. - uPh) * 6.2831), 6.);
        float cap = smoothstep(uTop, uTop - 8., vY);   // the loops end where a pan's metal would stop them
        vec3 c = mix(uA, uB, .5 + .5 * sin(x * 6.2831)); gl_FragColor = vec4(c * (.18 + dash * .9) * uI * cap, 1.); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const field = new THREE.Group();
  for (let k = 0; k < 10; k++) for (const s of [.55, .85]) {
    const a = k / 10 * Math.PI * 2, lp = [];
    for (let i = 0; i <= 120; i++) { const u = i / 120 * Math.PI * 2; const rr = 32 * s, cx = 30 * s, hy = 34 * s; lp.push(new THREE.Vector3(Math.cos(a) * (cx + Math.cos(u) * rr * .95), Math.sin(u) * hy - 10, Math.sin(a) * (cx + Math.cos(u) * rr * .95))); }
    field.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp, true), 240, .32 + .1 * s, 6, true), fieldMat));
  }
  root.add(field);

  // Inner lights: heat glow under the pan and a faint coil glow (to light the metals around them)
  const heatL = new THREE.PointLight(ACC_B.clone(), 0, 160, 2); heatL.position.set(0, -2, 0); root.add(heatL);
  const coilL = new THREE.PointLight(ACC_A.clone(), 0, 120, 2); coilL.position.set(0, -6, 0); root.add(coilL);

  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { root, parts, plateMat, coilMat, panBottomM, fieldMat, field, heatL, coilL };
}

// Exploded view along the local Y axis: e 0..1
const OFF = { pan: 62, plate: 30, coil: 0, ferrite: -20, shield: -38 };
const ROT = { pan: [.1, .2, -.06], plate: [-.08, -.25, .1], coil: [.06, .5, -.05], ferrite: [-.1, -.3, .08], shield: [.08, .2, -.1] };
export function explode(hob, e, spin = 0) {
  for (const k in OFF) {
    const p = hob.parts[k]; if (!p) continue;
    p.g.position.y = p.y + OFF[k] * e;
    const r = ROT[k]; p.g.rotation.set(r[0] * e, r[1] * e + spin * OFF[k] * .003 * e, r[2] * e);
  }
  hob.field.position.y = 0; hob.field.scale.setScalar(1);
}
