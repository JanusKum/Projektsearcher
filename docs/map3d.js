/* Standort-Scout Münster – 3D-Kartenebene.
   Lädt die Kacheln aus docs/geo/ nach und zeichnet Gebäude (mit echten Dachformen aus dem
   LoD2-Modell) und Bäume als eigene WebGL-Ebene in der MapLibre-Karte. Flächennutzung wird
   als GeoJSON an die Karte übergeben. */
(function () {
  'use strict';

  const M = window.SCOUT_MAP;
  const R = 6378137, C = 2 * Math.PI * R;
  const Q = M.meta.q, QZ = M.meta.qz;
  const COS = Math.cos((M.meta.lat * Math.PI) / 180);
  const KX = Q * COS;                       // Meter am Boden je Lage-Einheit
  const SONNE = (function () { const v = [-0.5, -0.45, 0.74], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const UMGEBUNG = 0.64, DIREKT = 0.42;

  /* ---------------------------------------------------------- Kacheln laden */
  const puffer = {};
  window.SCOUT_GEO = function (art, key, ox, oy, b64) {
    const k = puffer[key] || (puffer[key] = { ox: ox, oy: oy });
    k[art] = b64;
  };
  const ZEILE = /SCOUT_GEO\("(\w)","([\d_]+)",(-?\d+),(-?\d+),"([^"]*)"\)/g;
  function ladeDatei(key) {
    if (puffer[key]) return Promise.resolve();          // schon in der Seite enthalten (Einzeldatei)
    const url = 'geo/g_' + key + '.js';
    const perScript = () => new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = url; s.onload = () => { s.remove(); ok(); }; s.onerror = () => { s.remove(); fehler(new Error('Kachel ' + key)); };
      document.head.appendChild(s);
    });
    if (location.protocol === 'file:') return perScript();
    return fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((text) => {
      let m; ZEILE.lastIndex = 0;
      while ((m = ZEILE.exec(text))) window.SCOUT_GEO(m[1], m[2], +m[3], +m[4], m[5]);
    }).catch(perScript);
  }
  function bytes(b64) {
    const bin = atob(b64), n = bin.length, u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  /* ---------------------------------------------------------- Netz */
  // 12 Byte je Eckpunkt: x, y, z (u16), Füllwert, RGBA (u8).
  function Netz(cap) { this.cap = cap; this.n = 0; this.buf = new ArrayBuffer(cap * 12); this.u16 = new Uint16Array(this.buf); this.u8 = new Uint8Array(this.buf); }
  Netz.prototype.v = function (x, y, z, r, g, b) {
    if (this.n === this.cap) {
      const neu = new ArrayBuffer(this.cap * 24);
      new Uint8Array(neu).set(this.u8);
      this.cap *= 2; this.buf = neu; this.u16 = new Uint16Array(neu); this.u8 = new Uint8Array(neu);
    }
    const i = this.n++, a = i * 6, c = i * 12 + 8;
    this.u16[a] = x; this.u16[a + 1] = y; this.u16[a + 2] = z;
    this.u8[c] = r; this.u8[c + 1] = g; this.u8[c + 2] = b; this.u8[c + 3] = 255;
  };
  Netz.prototype.daten = function () { return new Uint8Array(this.buf, 0, this.n * 12); };
  const hash = (i) => { let h = (i + 1) * 2654435761; h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return h >>> 0; };
  const k8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v) | 0;

  function baueGebaeude(u8, pal, saat) {
    const netz = new Netz(Math.max(1024, u8.length * 3));
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let o = 0, nr = 0;
    const kanten = new Map();
    while (o < u8.length) {
      const cls = u8[o], np = u8[o + 1]; o += 2; nr++;
      const h = hash(nr + saat * 7919);
      const hell = 0.95 + ((h >>> 8) % 100) / 1000;                 // leichte Streuung je Gebäude
      const wand = pal.wand[cls], steil = pal.dach[h % pal.dach.length], flach = pal.flach[cls];
      const polys = [];
      for (let p = 0; p < np; p++) {
        const n = u8[o]; o += 1;
        const a = new Uint16Array(n * 3);
        for (let i = 0; i < n * 3; i++) a[i] = dv.getUint16(o + i * 2, true);
        o += n * 6;
        polys.push(a);
      }
      kanten.clear();
      const drehung = [];
      for (let p = 0; p < polys.length; p++) {
        const a = polys[p], n = a.length / 3;
        // Flächennormale (Newell) in Metern
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = a[i * 3] * KX, yi = a[i * 3 + 1] * KX, zi = a[i * 3 + 2] * QZ, xj = a[j * 3] * KX, yj = a[j * 3 + 1] * KX, zj = a[j * 3 + 2] * QZ;
          nx += (yj - yi) * (zj + zi); ny += (zj - zi) * (xj + xi); nz += (xj - xi) * (yj + yi);
        }
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        drehung.push(nz >= 0 ? 1 : -1);
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const licht = UMGEBUNG + DIREKT * Math.max(0, nx * SONNE[0] + ny * SONNE[1] + nz * SONNE[2]);
        const f = nz > 0.985 ? flach : steil, s = licht * hell;
        const r = k8(f[0] * s), g = k8(f[1] * s), b = k8(f[2] * s);
        let idx;
        if (n === 3) idx = [0, 1, 2];
        else {
          const eben = new Array(n * 2), ax = Math.abs(nx), ay = Math.abs(ny);
          for (let i = 0; i < n; i++) {
            if (nz >= ax && nz >= ay) { eben[i * 2] = a[i * 3]; eben[i * 2 + 1] = a[i * 3 + 1]; }
            else if (ax >= ay) { eben[i * 2] = a[i * 3 + 1] * KX; eben[i * 2 + 1] = a[i * 3 + 2] * QZ; }
            else { eben[i * 2] = a[i * 3] * KX; eben[i * 2 + 1] = a[i * 3 + 2] * QZ; }
          }
          idx = window.earcut(eben);
        }
        for (let t = 0; t < idx.length; t++) { const i = idx[t] * 3; netz.v(a[i], a[i + 1], a[i + 2], r, g, b); }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ka = a[i * 3] + ',' + a[i * 3 + 1] + ',' + a[i * 3 + 2], kb = a[j * 3] + ',' + a[j * 3 + 1] + ',' + a[j * 3 + 2];
          const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
          const e = kanten.get(key);
          if (e) e.n++; else kanten.set(key, { n: 1, p: p, i: i, j: j });
        }
      }
      // Wände: jede Dachkante, die nur zu einer Dachfläche gehört, bis zum Boden herunterziehen
      kanten.forEach((e) => {
        if (e.n !== 1) return;
        const a = polys[e.p];
        const x1 = a[e.i * 3], y1 = a[e.i * 3 + 1], z1 = a[e.i * 3 + 2], x2 = a[e.j * 3], y2 = a[e.j * 3 + 1], z2 = a[e.j * 3 + 2];
        if (z1 === 0 && z2 === 0) return;
        let wx = (y2 - y1) * drehung[e.p], wy = -(x2 - x1) * drehung[e.p];
        const wl = Math.hypot(wx, wy) || 1;
        wx /= wl; wy /= wl;
        const s = (UMGEBUNG + DIREKT * Math.max(0, wx * SONNE[0] + wy * SONNE[1]) * 0.9) * hell, u = s * 0.8;
        const r = k8(wand[0] * s), g = k8(wand[1] * s), b = k8(wand[2] * s), ru = k8(wand[0] * u), gu = k8(wand[1] * u), bu = k8(wand[2] * u);
        netz.v(x1, y1, z1, r, g, b); netz.v(x2, y2, z2, r, g, b); netz.v(x2, y2, 0, ru, gu, bu);
        netz.v(x1, y1, z1, r, g, b); netz.v(x2, y2, 0, ru, gu, bu); netz.v(x1, y1, 0, ru, gu, bu);
      });
    }
    return netz;
  }

  // Bäume: schlichte Doppelpyramide mit fünf Seiten. Standort aus dem Baumkataster, Größe ist Darstellung.
  const SEITEN = 5;
  const WINKEL = Array.from({ length: SEITEN }, (_, i) => { const a = (i / SEITEN) * 2 * Math.PI; return [Math.cos(a), Math.sin(a)]; });
  function baueBaeume(u8, pal, saat) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = u8.length / 4;
    const netz = new Netz(n * SEITEN * 6 + 6);
    for (let t = 0; t < n; t++) {
      const x = dv.getUint16(t * 4, true), y = dv.getUint16(t * 4 + 2, true);
      const h = hash(t + saat * 104729), gr = 0.75 + (h % 1000) / 1800;
      const farbe = pal.baum[(h >>> 10) % pal.baum.length];
      const rad = (3.1 * gr) / KX, zu = (2.2 * gr) / QZ, zm = (6.2 * gr) / QZ, zo = (11 * gr) / QZ;
      for (let i = 0; i < SEITEN; i++) {
        const a = WINKEL[i], b = WINKEL[(i + 1) % SEITEN];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const licht = UMGEBUNG + DIREKT * Math.max(0, mx * 0.8 * SONNE[0] + my * 0.8 * SONNE[1] + 0.6 * SONNE[2]);
        const o = licht, u = licht * 0.72;
        const x1 = x + a[0] * rad, y1 = y + a[1] * rad, x2 = x + b[0] * rad, y2 = y + b[1] * rad;
        netz.v(x1, y1, zm, k8(farbe[0] * o), k8(farbe[1] * o), k8(farbe[2] * o));
        netz.v(x2, y2, zm, k8(farbe[0] * o), k8(farbe[1] * o), k8(farbe[2] * o));
        netz.v(x, y, zo, k8(farbe[0] * o * 1.08), k8(farbe[1] * o * 1.08), k8(farbe[2] * o * 1.08));
        netz.v(x1, y1, zm, k8(farbe[0] * u), k8(farbe[1] * u), k8(farbe[2] * u));
        netz.v(x2, y2, zm, k8(farbe[0] * u), k8(farbe[1] * u), k8(farbe[2] * u));
        netz.v(x, y, zu, k8(farbe[0] * u * 0.8), k8(farbe[1] * u * 0.8), k8(farbe[2] * u * 0.8));
      }
    }
    return netz;
  }

  // Flächennutzung -> GeoJSON in Längen- und Breitengrad
  function baueFlaechen(u8, ox, oy) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), features = [];
    const lon = (x) => (((ox + x * Q) / R) * 180) / Math.PI;
    const lat = (y) => ((2 * Math.atan(Math.exp((oy + y * Q) / R)) - Math.PI / 2) * 180) / Math.PI;
    let o = 0;
    while (o < u8.length) {
      const cls = u8[o], nr = u8[o + 1]; o += 2;
      const ringe = [];
      for (let r = 0; r < nr; r++) {
        const n = dv.getUint16(o, true); o += 2;
        const ring = new Array(n + 1);
        for (let i = 0; i < n; i++) ring[i] = [lon(dv.getUint16(o + i * 4, true)), lat(dv.getUint16(o + i * 4 + 2, true))];
        ring[n] = ring[0];
        o += n * 4;
        ringe.push(ring);
      }
      features.push({ type: 'Feature', properties: { k: cls }, geometry: { type: 'Polygon', coordinates: ringe } });
    }
    return { type: 'FeatureCollection', features: features };
  }

  /* ---------------------------------------------------------- Ebene */
  const VS = 'attribute vec3 aPos; attribute vec4 aCol; uniform mat4 uM; uniform float uH; uniform float uCam; uniform vec3 uDunst; varying vec3 vCol;'
    + 'void main(){ gl_Position = uM * vec4(aPos.xy, aPos.z * uH, 1.0);'
    + ' float d = smoothstep(1.3, 3.6, gl_Position.w / uCam); vCol = mix(aCol.rgb, uDunst, d * 0.82); }';
  const FS = 'precision mediump float; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }';

  function erzeuge(map, opt) {
    const kacheln = {};          // key -> { status, ox, oy, roh, b, t, flaechen }
    const reihe = [];            // Kacheln, deren Netze noch gebaut werden müssen
    let gl = null, prog = null, loc = null, laufend = 0, mobil = window.matchMedia('(max-width: 760px)').matches;
    const MAX_B = mobil ? 22 : 64, MAX_N = mobil ? 30 : 70;
    const mitte = (key) => { const b = M.meta.kacheln[key]; return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
    const abstand = (key, c) => { const m = mitte(key); return Math.hypot((m[0] - c[0]) * 111320 * COS, (m[1] - c[1]) * 110540); };

    function puffere(netz) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, netz.daten(), gl.STATIC_DRAW);
      return { buf: buf, n: netz.n };
    }
    function loesche(k, art) { if (k[art]) { gl.deleteBuffer(k[art].buf); k[art] = null; } }
    function baue(key) {
      const k = kacheln[key], pal = opt.palette(), saat = parseInt(key.replace('_', ''), 10) % 9973;
      if (!gl || !k || !k.roh) return;
      loesche(k, 'b'); loesche(k, 't');
      if (k.roh.b) k.b = puffere(baueGebaeude(k.roh.b, pal, saat));
      if (k.roh.t) k.t = puffere(baueBaeume(k.roh.t, pal, saat));
      k.gebaut = true;
    }
    function arbeite() {
      const key = reihe.shift();
      if (key && kacheln[key] && kacheln[key].will) { baue(key); map.triggerRepaint(); }
      if (reihe.length) requestAnimationFrame(arbeite);
    }
    function einreihen(key) { if (reihe.indexOf(key) < 0) { reihe.push(key); if (reihe.length === 1) requestAnimationFrame(arbeite); } }

    function hole(key) {
      const k = kacheln[key] = { status: 'laedt', will: false };
      laufend++;
      ladeDatei(key).then(() => {
        const p = puffer[key]; delete puffer[key];
        k.ox = p.ox; k.oy = p.oy;
        k.roh = { b: p.b ? bytes(p.b) : null, t: p.t ? bytes(p.t) : null };
        if (p.n) { k.flaechen = baueFlaechen(bytes(p.n), p.ox, p.oy); opt.flaechenDa(key, k.flaechen); }
        k.status = 'da';
        if (k.will) einreihen(key);
      }).catch(() => { k.status = 'fehler'; }).then(() => { laufend--; if (wunsch) ladeUm(wunsch[0], wunsch[1], wunsch[2]); });
    }

    // Kacheln rund um den Kartenmittelpunkt anfordern; weit entfernte Netze wieder freigeben.
    let wunsch = null;
    function ladeUm(c, zoom, kamMeter) {
      wunsch = [c, zoom, kamMeter];
      const keys = Object.keys(M.meta.kacheln).sort((a, b) => abstand(a, c) - abstand(b, c));
      const rN = zoom < 12.6 ? 0 : Math.min(9000, Math.max(3500, kamMeter * 2.6));
      const rB = zoom < 13.2 ? 0 : Math.min(8000, Math.max(3000, kamMeter * 2.4));
      let nB = 0, nN = 0;
      keys.forEach((key) => {
        const d = abstand(key, c), k = kacheln[key];
        const willN = d < rN + 1500 && nN < MAX_N, willB = d < rB + 1500 && nB < MAX_B;
        if (willN) nN++;
        if (willB) nB++;
        if (!k) { if (willN && laufend < 5) hole(key); return; }
        k.will = willB;
        if (k.status !== 'da') return;
        if (willB && !k.gebaut) einreihen(key);
        if (!willB && k.gebaut && d > rB + 4000 && gl) { loesche(k, 'b'); loesche(k, 't'); k.gebaut = false; }
      });
    }

    const ebene = {
      id: 'gebaeude', type: 'custom', renderingMode: '3d',
      onAdd: function (_map, kontext) {
        gl = kontext;
        const sh = (typ, quelle) => { const s = gl.createShader(typ); gl.shaderSource(s, quelle); gl.compileShader(s); return s; };
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        loc = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aCol'), m: gl.getUniformLocation(prog, 'uM'), h: gl.getUniformLocation(prog, 'uH'), cam: gl.getUniformLocation(prog, 'uCam'), dunst: gl.getUniformLocation(prog, 'uDunst') };
        Object.keys(kacheln).forEach((key) => { const k = kacheln[key]; k.b = k.t = null; k.gebaut = false; if (k.will && k.status === 'da') einreihen(key); });
      },
      render: function (_gl, matrix) {
        const zoom = map.getZoom();
        if (zoom < 13.2 || !prog) return;
        const pal = opt.palette(), m = matrix, mat = new Float32Array(16);
        const wachs = Math.min(1, Math.max(0.02, (zoom - 13.2) / 0.9));      // Gebäude wachsen beim Hineinzoomen
        const baumAn = zoom >= 15.2;
        gl.useProgram(prog);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        gl.uniform1f(loc.cam, map.transform.cameraToCenterDistance || 1);
        gl.uniform3f(loc.dunst, pal.dunst[0] / 255, pal.dunst[1] / 255, pal.dunst[2] / 255);
        gl.enableVertexAttribArray(loc.pos); gl.enableVertexAttribArray(loc.col);
        const sx = Q / C, sz = QZ / (C * COS);
        for (const key in kacheln) {
          const k = kacheln[key];
          if (!k.gebaut || !k.will) continue;
          // Kachelmatrix = Kartenmatrix · Verschiebung zum Kachelursprung · Skalierung (in doppelter Genauigkeit gerechnet)
          const tx = k.ox / C + 0.5, ty = 0.5 - k.oy / C;
          for (let i = 0; i < 4; i++) {
            mat[i] = m[i] * sx; mat[4 + i] = -m[4 + i] * sx; mat[8 + i] = m[8 + i] * sz;
            mat[12 + i] = m[i] * tx + m[4 + i] * ty + m[12 + i];
          }
          gl.uniformMatrix4fv(loc.m, false, mat);
          const zeichne = (netz, h) => {
            if (!netz || !netz.n) return;
            gl.uniform1f(loc.h, h);
            gl.bindBuffer(gl.ARRAY_BUFFER, netz.buf);
            gl.vertexAttribPointer(loc.pos, 3, gl.UNSIGNED_SHORT, false, 12, 0);
            gl.vertexAttribPointer(loc.col, 4, gl.UNSIGNED_BYTE, true, 12, 8);
            gl.drawArrays(gl.TRIANGLES, 0, netz.n);
          };
          zeichne(k.b, wachs);
          if (baumAn) zeichne(k.t, Math.min(1, (zoom - 15.2) / 0.5));
        }
        gl.disableVertexAttribArray(loc.pos); gl.disableVertexAttribArray(loc.col);
      },
    };

    return {
      ebene: ebene,
      ladeUm: ladeUm,
      // Farben neu einbrennen, z. B. nach einem Wechsel zwischen hell und dunkel
      neuFaerben: function () { Object.keys(kacheln).forEach((key) => { const k = kacheln[key]; if (k.gebaut) einreihen(key); }); },
      flaechen: function () { const o = {}; Object.keys(kacheln).forEach((key) => { if (kacheln[key].flaechen) o[key] = kacheln[key].flaechen; }); return o; },
      stand: function () { let b = 0, v = 0; Object.keys(kacheln).forEach((key) => { const k = kacheln[key]; if (k.gebaut && k.b) { b++; v += k.b.n; } }); return { kacheln: b, ecken: v, laufend: laufend, reihe: reihe.length }; },
    };
  }

  window.Scout3D = { erzeuge: erzeuge };
})();
