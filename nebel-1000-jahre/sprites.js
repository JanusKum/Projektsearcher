// sprites.js — characters of "Nebel · 1000 Jahre": the farmer (year 0/1), the lantern bearers (year 100/500),
// the child (year 1000, a closer back-view sprite) and the child's 32×32 portrait. Every hood has the long tail: the family's silhouette mark.
import { FB, C, T, sprFromRows, clamp, lerp } from './px.js';

// ———————— Farmer (front view, straw hat) ————————
const FMAP = { k: C.ink, y: C.amber, Y: C.yellow, s: C.skin, S: C.skinS, e: C.ink, r: C.rust, R: C.clay, n: C.navy, N: C.blue, b: C.umber };
export const FARMER = {
  stand: sprFromRows([
    '.....kkkk.....',
    '....kyyyyk....',
    '.kkkyYyyyykkk.',
    'kyyyyyyyyyyyyk',
    '.kkkkkkkkkkkk.',
    '....kssssk....',
    '....kesSek....',
    '....kssSSk....',
    '...kkrrrrkk...',
    '..krrRrrrrrk..',
    '.krkrRrrrrkrk.',
    '.krkrrrrrrkrk.',
    '.kskrrrrrrksk.',
    '..kkknnnnkkk..',
    '....knnnnk....',
    '....knnNnk....',
    '....knkknk....',
    '....knkknk....',
    '...kbbkkbbk...',
    '...kkkkkkkk...',
  ], FMAP),
  crouch: sprFromRows([
    '.....kkkk.....',
    '....kyyyyk....',
    '.kkkyYyyyykkk.',
    'kyyyyyyyyyyyyk',
    '.kkkkkkkkkkkk.',
    '....kSssSk....',
    '...kkrrrrkk...',
    '..krrRrrrrrk..',
    '.krkrRrrrrkrk.',
    '.kskrrrrrrksk.',
    '..kknnnnnnkk..',
    '...knnkknnk...',
    '..knnk..knnk..',
    '..kbbk..kbbk..',
    '..kkkk..kkkk..',
  ], FMAP),
  kneel: sprFromRows([
    '.....kkkk.....',
    '....kyyyyk....',
    '.kkkyYyyyykkk.',
    'kyyyyyyyyyyyyk',
    '.kkkkkkkkkkkk.',
    '...kkrrrrkk...',
    '..krrRrrrrrk..',
    '.krkrRrrrrkrk.',
    '.kskrrrrrrksk.',
    '..kkrrrrrrkk..',
    '...knnnnnnnk..',
    '..knnnnkknnnk.',
    '.kbbbk...knnk.',
    '.kkkkk...kbbk.',
    '.........kkkk.',
  ], FMAP),
};

// ———————— Lantern bearer (side view, walking right, hooded coat with the long hood tail) ————————
const BMAP = { k: C.ink, p: C.plum, P: C.rose, d: C.umber, s: C.skin, S: C.skinS, e: C.ink, b: C.dbrown };
const BUP = [
  '.....kkkkk......',
  '...kkpPPppk.....',
  '..kpPPpppppk....',
  '..kpPppppkssk...',
  '.kdpppppksssek..',
  'kddkppppkssSk...',
  'kdk.kpppkkkk....',
  'kk..kppppppk....',
  '...kpPpppppk....',
  '...kpPppppppk...',
  '...kpPpppppssk..',
  '...kpPpppppkk...',
  '...kpppppppk....',
  '..kpPppppppk....',
  '..kpppppppppk...',
  '..kdpppppppdk...',
  '..kkkkkkkkkkk...',
];
const LEGS_APART = [
  '...kbk..kbk.....',
  '..kbk....kbk....',
  '..kbk....kbk....',
  '.kbk......kbk...',
  'kbbk......kbbk..',
  'kkkk......kkkkk.',
];
const LEGS_PASS = [
  '....kbbk........',
  '....kbbk........',
  '....kbbk........',
  '....kbbk........',
  '....kbbbk.......',
  '....kkkkk.......',
];
export const BEARER = {
  apart: sprFromRows([...BUP, ...LEGS_APART], BMAP),
  pass: sprFromRows([...BUP, ...LEGS_PASS], BMAP),
  hand: [12, 11],                      // where the lantern hangs (relative to the sprite's top-left)
  h: BUP.length + 6,
};
// frame of a walk cycle at 8 fps: apart / pass (+1 px bob) / apart / pass
export function bearerFrame(t) { const k = Math.floor(t * 8) % 4; return { spr: k % 2 ? BEARER.pass : BEARER.apart, bob: k % 2 ? -1 : 0 }; }

// ———————— Lantern (drawn where it hangs; flame and glass are protected colours) ————————
export function lantern(fb, x, y, t, o = {}) {
  x = Math.round(x); y = Math.round(y);
  // handle
  fb.px(x, y, C.dslate); fb.px(x - 1, y + 1, C.dslate); fb.px(x + 1, y + 1, C.dslate);
  // cap, body, base
  fb.rect(x - 2, y + 2, 5, 1, C.ink); fb.rect(x - 3, y + 3, 7, 7, C.ink);
  fb.rect(x - 2, y + 4, 5, 5, C.rim);
  const fl = Math.floor(t * 12) % 3;
  fb.rect(x - 1, y + 5, 3, 4, C.flame); fb.px(x, y + 5 + (fl === 1 ? 1 : 0), C.core); fb.px(x, y + 6 + (fl === 2 ? 1 : 0), C.core);
  fb.rect(x - 2, y + 10, 5, 1, C.ink);
  return [x, y + 7];                    // flame centre
}

// ———————— Small helpers for sprites drawn from shapes ————————
function canvas(w, h) { const f = new FB(w, h); f.clear(T); return f; }
function outline(f, col = C.ink) {
  const src = f.d.slice(), w = f.w, h = f.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x] !== T) continue;
    const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] !== T;
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) f.d[y * w + x] = col;
  }
  return f;
}
function ellipse(f, cx, cy, rx, ry, col) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.02) col(x, y); }
function capsule(f, x0, y0, x1, y1, r, col) {
  const minx = Math.floor(Math.min(x0, x1) - r - 1), maxx = Math.ceil(Math.max(x0, x1) + r + 1), miny = Math.floor(Math.min(y0, y1) - r - 1), maxy = Math.ceil(Math.max(y0, y1) + r + 1);
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const u = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), px = x0 + dx * u, py = y0 + dy * u;
    if ((x - px) ** 2 + (y - py) ** 2 <= r * r) col(x, y, u);
  }
}
function stamp(dst, part, ox = 0, oy = 0) { dst.blit(part, ox, oy); }

// ———————— Child, closer back view (~70 px). pose: { raise 0..1, breath 0/1, sway (px), t } ————————
export const CHILD = { w: 72, h: 98, feet: [35, 95] };
export function armHand(raise) {
  const a = lerp(100, -50, raise) * Math.PI / 180, sx = 46, sy = 51;
  return [sx + Math.cos(a) * 18, sy + Math.sin(a) * 18];
}
export function childSprite(p) {
  const f = canvas(CHILD.w, CHILD.h), by = p.breath ? -1 : 0, cx = 35;
  // boots
  const boots = canvas(CHILD.w, CHILD.h);
  boots.rect(27, 88, 7, 6, C.dbrown); boots.rect(38, 88, 7, 6, C.dbrown); boots.rect(27, 88, 7, 1, C.umber); boots.rect(38, 88, 7, 1, C.umber);
  stamp(f, outline(boots));
  // cloak (light from the upper left)
  const cloak = canvas(CHILD.w, CHILD.h);
  for (let y = 45 + by; y <= 90; y++) {
    const k = (y - 45) / 45, hw = lerp(11, 17, k);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - cx) / hw; let c = C.plum;
      if (u < -.55) c = ((x + y) & 1) && u > -.75 ? C.plum : C.rose;
      if (u > .5) c = u > .75 || ((x + y) & 1) ? C.umber : C.plum;
      if (y >= 88) c = C.umber;
      cloak.px(x, y, c);
    }
  }
  for (const fx of [-6, 3, 9]) for (let y = 62; y < 88; y++) if ((y + fx) % 9 < 6) cloak.px(cx + fx + Math.round((y - 62) / 10), y, C.umber);
  ellipse(cloak, cx, 47 + by, 14, 5, (x, y) => cloak.px(x, y, x < cx - 7 ? C.rose : x > cx + 8 ? C.umber : C.plum));
  // left arm under the cloak (a sleeve bump)
  capsule(cloak, 23, 52 + by, 21, 66, 3, (x, y) => cloak.px(x, y, C.plum));
  stamp(f, outline(cloak));
  // hood (back of the head)
  const hood = canvas(CHILD.w, CHILD.h);
  ellipse(hood, cx, 33 + by, 12, 13, (x, y) => { const u = (x - cx) / 12, v = (y - 33 - by) / 13; hood.px(x, y, u + v < -.9 ? C.rose : u > .55 ? C.umber : C.plum); });
  for (let y = 24 + by; y < 45 + by; y++) hood.px(cx + 1, y, C.umber);
  stamp(f, outline(hood));
  // hood tail: the family mark, falls over the left shoulder and swings
  const tail = canvas(CHILD.w, CHILD.h), sw = p.sway || 0;
  const P = [[30, 22], [23, 25], [19, 33], [17, 45], [16, 57], [15 + sw, 67]];
  for (let i = 0; i < P.length - 1; i++) {
    const r = lerp(2.6, 1.3, i / (P.length - 1));
    capsule(tail, P[i][0], P[i][1] + by, P[i + 1][0], P[i + 1][1] + by, r, (x, y, u) => tail.px(x, y, (x + y) % 5 === 0 ? C.rose : C.plum));
  }
  ellipse(tail, 15 + sw, 69 + by, 2.2, 2.2, (x, y) => tail.px(x, y, C.rose));
  stamp(f, outline(tail));
  // right arm (holds the lantern), drawn last so it reads over the cloak
  const arm = canvas(CHILD.w, CHILD.h), [hx, hy] = armHand(p.raise), sx = 46, sy = 51 + by;
  capsule(arm, sx, sy, hx, hy + by * (1 - p.raise), 2.6, (x, y, u) => arm.px(x, y, u > .88 ? C.skin : y < sy - 1 && x < hx ? C.rose : C.plum));
  stamp(f, outline(arm));
  return { spr: f, hand: [hx, hy + by * (1 - p.raise)] };
}

// ———————— Child portrait 32×32 (3/4 view, eyes wide) ————————
export function childPortrait(blink = false) {
  const f = canvas(32, 32);
  const hood = canvas(32, 32);
  ellipse(hood, 16, 16, 13, 14, (x, y) => hood.px(x, y, x + y < 20 ? C.rose : x > 24 ? C.umber : C.plum));
  capsule(hood, 22, 6, 30, 3, 2, (x, y) => hood.px(x, y, C.plum));
  hood.rect(5, 27, 22, 5, C.plum); hood.rect(5, 27, 5, 5, C.rose);
  stamp(f, outline(hood));
  const face = canvas(32, 32);
  ellipse(face, 15, 19, 8.5, 8.5, (x, y) => face.px(x, y, x > 20 ? C.skinS : C.skin));
  // fringe: three big spikes
  face.rect(7, 11, 16, 3, C.dbrown);
  for (const [x, l] of [[8, 3], [12, 4], [17, 3]]) for (let i = 0; i < l; i++) { face.px(x + i, 14, C.dbrown); if (i > 0 && i < l - 1) face.px(x + i, 15, C.dbrown); }
  // eyes
  for (const ex of [10, 17]) {
    if (blink) { face.hline(ex, ex + 3, 19, C.ink); continue; }
    face.rect(ex, 17, 4, 4, C.white); face.rect(ex + 1, 18, 2, 3, C.ink); face.px(ex + 1, 18, C.white);
    face.hline(ex, ex + 3, 15, C.dbrown);           // brows raised: awe
  }
  face.px(8, 22, C.pink); face.px(22, 22, C.pink);
  face.rect(14, 23, 2, 2, C.ink); face.px(14, 24, C.crimson);   // small "o"
  stamp(f, outline(face, C.ink));
  return f;
}
