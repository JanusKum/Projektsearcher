// ui.js — game interface for the portrait frame: windows in four era skins, dialogue box (= subtitles), system window,
// year counter, SONNE bar, inventory with hand cursor. Window and cursor drawing follow the pixel-rpg demo (MIT).
import { W, C, sprFromRows } from './px.js';
import { text, textW, wrap } from './font.js';

export const GB = [C.ink, C.slate, C.steel, C.white];          // lands on the four moss4 steps

// skin: snes = blue gradient + white/silver border · nes = black with white frame · gb = light with dark frame
export function win(fb, x, y, w, h, skin = 'snes') {
  if (skin === 'gb') {
    const [K, D, , Wt] = GB;
    fb.rect(x + 1, y, w - 2, h, K); fb.rect(x, y + 1, w, h - 2, K);
    fb.rect(x + 1, y + 1, w - 2, h - 2, D); fb.rect(x + 2, y + 2, w - 4, h - 4, Wt); return;
  }
  if (skin === 'nes') {
    fb.rect(x + 1, y, w - 2, h, C.ink); fb.rect(x, y + 1, w, h - 2, C.ink);
    fb.rect(x + 2, y + 2, w - 4, h - 4, C.white); fb.rect(x + 4, y + 4, w - 8, h - 8, C.ink);
    fb.px(x + 2, y + 2, C.ink); fb.px(x + w - 3, y + 2, C.ink); fb.px(x + 2, y + h - 3, C.ink); fb.px(x + w - 3, y + h - 3, C.ink); return;
  }
  fb.rect(x + 2, y, w - 4, h, C.ink); fb.rect(x, y + 2, w, h - 4, C.ink); fb.rect(x + 1, y + 1, w - 2, h - 2, C.ink);
  fb.rect(x + 2, y + 1, w - 4, h - 2, C.white); fb.rect(x + 1, y + 2, w - 2, h - 4, C.white);
  fb.rect(x + 2, y + 2, w - 4, h - 4, C.silver);
  fb.gradV(x + 3, y + 3, w - 6, h - 6, [C.blue, C.navy, C.navy, C.night]);
  fb.hline(x + 3, x + w - 4, y + 3, C.blue);
}
const ink = skin => skin === 'gb' ? { col: GB[0], sh: null, dim: GB[1] } : skin === 'nes' ? { col: C.white, sh: null, dim: C.steel } : { col: C.white, sh: C.night, dim: C.silver };

// —— Dialogue box: the subtitle. Bottom of the frame, above the phone UI. ——
export const BOX = { x: 4, y: 230, w: 172, h: 46 };
export function dialog(fb, o) {
  const skin = o.skin || 'snes', { x: X, y: Y, w: Wd, h: Hd } = BOX, k = ink(skin);
  win(fb, X, Y, Wd, Hd, skin);
  let tx = X + 8;
  if (o.portrait) {
    const p = o.portrait, px = X + 6, py = Y + Math.round((Hd - p.h) / 2);
    if (skin === 'snes') { fb.rect(px - 1, py - 1, p.w + 2, p.h + 2, C.ink); fb.gradV(px, py, p.w, p.h, [C.navy, C.night]); }
    fb.blit(p, px, py); tx = px + p.w + 6;
  }
  const n = Math.max(0, Math.floor(o.t * (o.cps || 38)));
  const lines = wrap(o.text, X + Wd - tx - 7);
  const y0 = Y + Math.round((Hd - (lines.length * 11 - 4)) / 2) - 1;
  let used = 0;
  lines.forEach((ln, i) => { const vis = ln.slice(0, Math.max(0, n - used)); used += ln.length + 1; text(fb, vis, tx, y0 + i * 11, k.col, k.sh); });
  const total = o.text.length;
  if (n >= total && Math.floor(o.t * 3) % 2 === 0) text(fb, '▼', X + Wd - 12, Y + Hd - 10, skin === 'gb' ? GB[1] : C.white);
  return { n: Math.min(n, total), total };
}

// —— System message (battle-log grammar), centred ——
export function sysMsg(fb, s, y, t, skin = 'snes', cps = 45) {
  const w = Math.max(110, textW(s) + 20), x = Math.round((W - w) / 2), k = ink(skin);
  win(fb, x, y, w, 17, skin);
  const n = Math.floor(t * cps); text(fb, s.slice(0, n), x + Math.round((w - textW(s)) / 2), y + 5, k.col, k.sh);
  return { x, y, w, h: 17 };
}

// —— Year counter, top left ——
export const YEARWIN = { x: 6, y: 12, w: 62, h: 17 };
export function yearWin(fb, s, skin = 'snes', flash = false) {
  const { x, y, w, h } = YEARWIN, k = ink(skin);
  win(fb, x, y, w, h, skin);
  text(fb, s, x + Math.round((w - textW(s)) / 2), y + 5, flash ? (skin === 'gb' ? GB[1] : C.yellow) : k.col, k.sh);
  return { x, y, w, h };
}

// —— SONNE bar, top right (an HP bar for the sun) ——
export const SUNWIN = { x: 74, y: 12, w: 100, h: 17 };
export function sunWin(fb, f, skin = 'snes') {
  const { x, y, w, h } = SUNWIN, k = ink(skin);
  win(fb, x, y, w, h, skin);
  text(fb, 'SONNE', x + 7, y + 5, k.col, k.sh);
  const bx = x + 42, bw = w - 50; fb.rect(bx - 1, y + 5, bw + 2, 7, C.ink); fb.rect(bx, y + 6, bw, 5, C.night);
  const fw = Math.round(bw * f); fb.rect(bx, y + 6, fw, 2, C.yellow); fb.rect(bx, y + 8, fw, 3, C.amber);
  return { x, y, w, h };
}

// —— Hand cursor ——
const HAND = sprFromRows([
  '.kk......',
  'kwwk.....',
  'kwwwkkkk.',
  'kwwwwwwwk',
  'kwwwwkkk.',
  'kwwwwk...',
  '.kkkk....',
], { k: C.ink, w: C.white });
export function hand(fb, x, y, t, bob = true) { fb.blit(HAND, x + (bob && Math.floor(t * 4) % 2 ? 1 : 0), y); }

// —— Inventory: two items and a description line ——
export const INV = { x: 14, y: 40, w: 152, h: 62 };
export function inventory(fb, o) {
  const { x, w, h } = INV, y = INV.y + (o.dy || 0), k = ink('snes');
  win(fb, x, y, w, h);
  text(fb, 'INVENTAR', x + 10, y + 6, C.yellow, C.night);
  const rows = [['LATERNE', '×1'], ['SONNE', '???']];
  rows.forEach(([a, b], i) => {
    const ry = y + 19 + i * 11, sel = o.cursor === i;
    text(fb, a, x + 24, ry, sel ? C.white : C.silver, C.night);
    text(fb, b, x + w - 12 - textW(b), ry, i === 1 ? C.steel : C.silver, C.night);
  });
  // item icons: a tiny lantern (protected colours) and an empty dotted circle for the sun
  const lx = x + 15, ly = y + 18;
  fb.rect(lx + 1, ly, 3, 1, C.ink); fb.rect(lx, ly + 1, 5, 6, C.ink); fb.rect(lx + 1, ly + 2, 3, 4, C.rim); fb.px(lx + 2, ly + 3, C.core); fb.px(lx + 2, ly + 4, C.flame);
  const sx = x + 17, sy = y + 33;
  for (let a = 0; a < 12; a++) { if (a % 2) continue; fb.px(Math.round(sx + Math.cos(a / 12 * 6.283) * 3), Math.round(sy + Math.sin(a / 12 * 6.283) * 3), C.steel); }
  fb.hline(x + 8, x + w - 9, y + 42, C.navy);
  if (o.desc) text(fb, o.desc, x + 10, y + 47, C.white, C.night);
  if (o.cursor !== undefined && o.cursor !== null) hand(fb, x + 3, Math.round(y + 19 + o.cursorY * 11), o.t, o.bob);
  return { x, y, w, h };
}
