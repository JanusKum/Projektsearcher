// Rasterise Natural Earth 1:110m land (world-atlas, public domain) to a lon/lat point list (no borders).
import fs from 'fs'; import path from 'path'; import { feature } from 'topojson-client';
const here = path.dirname(new URL(import.meta.url).pathname);
const topo = JSON.parse(fs.readFileSync(path.join(here, '../node_modules/world-atlas/land-110m.json')));
const land = feature(topo, topo.objects.land);
const polys = []; for (const f of land.features) { const g = f.geometry; const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) polys.push(p); }
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const isLand = (x, y) => polys.some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)));
const out = []; const step = 0.75;
for (let lat = -84; lat <= 84; lat += step) { const dl = step / Math.max(.15, Math.cos(lat * Math.PI / 180)); for (let lon = -180; lon < 180; lon += dl) if (isLand(lon, lat)) out.push([+lon.toFixed(2), +lat.toFixed(2)]); }
fs.writeFileSync(path.join(here, 'land.json'), JSON.stringify(out)); console.log('land points', out.length);
