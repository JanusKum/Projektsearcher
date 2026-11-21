// pin.js: Pin, the guide. A sun-yellow map pin whose single eye is a zoom lens. Every state is a number so poses blend with easing.
//   pin(p, x, y, s, P): (x, y) = the tip of the pin (it stands on the location it marks); s = height of the pin in px.
//   P: rot (deg), look [lx, ly], lid 0..1, smile 0..1, wide 0..1, zoom 0..1, sq (squash >0 wider), wave 0..1 (arm up), wavePh (rad)
//   pinLens(x, y, s, P) → the lens centre (origin of the sight line).
function pinGeom(s) { const R = s * 0.36; return { R, cy: -s + R }; }   // head circle radius and its centre (tip at 0,0)
function pinLens(x, y, s, P = {}) {
  const { R, cy } = pinGeom(s), [lx, ly] = P.look || [0, 0], q = P.sq || 0, a = (P.rot || 0) * Math.PI / 180;
  const px = lx * R * 0.16 * (1 + q), py = (cy + ly * R * 0.12) * (1 - q * 0.85);
  return [x + Math.cos(a) * px - Math.sin(a) * py, y + Math.sin(a) * px + Math.cos(a) * py];
}
function pin(p, x, y, s, P = {}) {
  const { R, cy } = pinGeom(s), q = P.sq || 0, [lx, ly] = P.look || [0, 0];
  const G = g(p, { transform: `translate(${r1(x)},${r1(y)}) rotate(${r1(P.rot || 0)}) scale(${(1 + q).toFixed(4)},${(1 - q * 0.85).toFixed(4)})` });
  // the location it marks: two hard rings under the tip
  // body: a circle that tapers to the tip (one smooth outline)
  const k = 0.55, d = `M0,0C${r1(-R * 0.35)},${r1(cy + R * 1.05)} ${r1(-R * 1.0)},${r1(cy + R * 0.62)} ${r1(-R)},${r1(cy)}`
    + `A${r1(R)},${r1(R)} 0 1 1 ${r1(R)},${r1(cy)}C${r1(R * 1.0)},${r1(cy + R * 0.62)} ${r1(R * 0.35)},${r1(cy + R * 1.05)} 0,0Z`;
  // arms (mist capsules): the right one can wave
  const arm = (sx, up) => {
    const ax = sx * R * 0.92, ay = cy + R * 0.5, ang = sx > 0 ? (-30 - 120 * up + 18 * up * Math.sin(P.wavePh || 0)) : 30;
    const a = ang * Math.PI / 180, L = R * 0.55, ex = ax + Math.cos(a) * L * sx, ey = ay + Math.sin(a) * L * (sx > 0 ? 1 : -1) * -1;
    el('path', { d: `M${r1(ax)},${r1(ay)}L${r1(ex)},${r1(ey)}`, stroke: C.mist, 'stroke-width': r1(R * 0.16), 'stroke-linecap': 'round' }, G);
    el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R * 0.13), fill: C.cream }, G);
  };
  arm(-1, 0); arm(1, P.wave || 0);
  shaded(G, 'path', { d }, C.sun, C.sunD, R * 0.14, R * 0.12);
  // the lens: cream ring (+ barrel steps out on zoom), night glass, blue iris, highlight; lid and smile bend the iris, never cover it
  const z = Math.max(0, P.zoom || 0), ex = lx * R * 0.16, ey = cy + ly * R * 0.12;
  const R0 = R * 0.62, R1 = R * 0.49, Rc = R0 * (1 + 0.07 * z);
  if (z > 0.005) el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R0 * (1 + 0.16 * z)), fill: C.creamD }, G);
  el('circle', { cx: r1(ex), cy: r1(ey), r: r1(Rc), fill: C.cream }, G);
  if (z > 0.005) for (let i = 0; i < 6; i++) { const a = z * 1.3 + i * Math.PI / 3, rr = (Rc + R1) / 2; el('circle', { cx: r1(ex + Math.cos(a) * rr), cy: r1(ey + Math.sin(a) * rr), r: r1(R * 0.035 * Math.min(1, z * 2.5)), fill: C.creamD }, G); }
  el('circle', { cx: r1(ex), cy: r1(ey), r: r1(R1), fill: C.night }, G);
  const L = g(G, { 'clip-path': clipOf('circle', { cx: r1(ex), cy: r1(ey), r: r1(R1) }) });
  const sm = Math.max(0, Math.min(1, P.smile || 0));
  const ir = R * 0.3 * (1 + 0.22 * (P.wide || 0)) * (1 - 0.3 * z) * (1 + 0.2 * sm), ix = ex + lx * R * 0.08, iy = ey + ly * R * 0.06 - ir * 0.2 * sm;
  el('circle', { cx: r1(ix), cy: r1(iy), r: r1(ir), fill: C.blue }, L);
  el('circle', { cx: r1(ix), cy: r1(iy), r: r1(ir * (0.46 - 0.1 * z)), fill: C.night }, L);
  if (sm > 0.005) el('circle', { cx: r1(ix), cy: r1(iy + ir * (2.3 - 1.8 * sm)), r: r1(ir * (1 - 0.08 * sm)), fill: C.night }, L);
  if (sm < 0.995) el('circle', { cx: r1(ix - ir * 0.42), cy: r1(iy - ir * 0.46), r: r1(ir * 0.32 * (1 - sm)), fill: C.cream }, L);
  const lid = P.lid || 0;
  if (lid > 0.005) { const RL = R1 * 1.7; el('circle', { cx: r1(ex), cy: r1(ey - R1 - RL + 2 * R1 * lid), r: r1(RL), fill: C.sunD }, L); }
  for (const sx of [-1, 1]) el('ellipse', { cx: r1(ex + sx * R * 0.72), cy: r1(ey + R * 0.42 - R * 0.06 * sm), rx: r1(R * 0.14), ry: r1(R * 0.085), fill: C.coral }, G);
  if (sm > 0.005) { const w = R * 0.3 * sm, yb = ey + Rc + R * 0.1; el('path', { d: `M${r1(ex - w)},${r1(yb - R * 0.03)}Q${r1(ex)},${r1(yb + R * 0.09 * sm)} ${r1(ex + w)},${r1(yb - R * 0.03)}`, fill: 'none', stroke: C.sunD, 'stroke-width': r1(R * 0.06), 'stroke-linecap': 'round' }, G); }
  return G;
}
