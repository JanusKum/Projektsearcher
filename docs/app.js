/* Standort-Scout Münster – Oberfläche. Liest window.SCOUT_DATA (docs/data.js). */
(function () {
  'use strict';

  const D = window.SCOUT_DATA;
  const $ = (id) => document.getElementById(id);
  const IND = Object.fromEntries(D.indikatoren.map((i) => [i.key, i]));
  const STT = Object.fromEntries(D.stadtteile.features.map((f) => [f.properties.id, f]));
  const IDS = Object.keys(STT).sort();
  const STAND = D.meta.stand;

  /* ---------------------------------------------------------- Profile */
  // Gewichte in Prozentpunkten. Sie sind eine fachliche Annahme und in der Oberfläche änderbar.
  const PROFILE = [
    {
      id: 'reihenhaus', label: 'Reihenhäuser',
      frage: 'Wo finden Familien bezahlbares Bauland mit Kita und Schule in der Nähe?',
      w: { hh_kinder: 16, brw_w: 16, prog: 14, d_familie: 12, bplan_ha: 10, trend_w: 8, bev_10: 6, d_bus: 6, d_bahn: 6, arbeitslos: 6 },
    },
    {
      id: 'mfh', label: 'Mehrfamilienhäuser',
      frage: 'Wo wächst die Nachfrage nach Wohnungen, bei guter Anbindung und stabilen Preisen?',
      w: { prog: 14, hh_single: 12, trend_w: 12, d_zentrum: 12, wanderung: 10, d_bus: 10, d_bahn: 10, bev_10: 6, bplan_ha: 6, brw_w: 4, arbeitslos: 4 },
    },
    {
      id: 'quartier', label: 'Quartiere',
      frage: 'Wo entsteht neues Baurecht auf großer Fläche, und wo trägt das Wachstum ein ganzes Quartier?',
      w: { bplan_ha: 28, prog: 16, brw_w: 14, d_bahn: 10, trend_w: 8, d_bus: 6, d_familie: 6, bev_10: 4, wanderung: 4, hh_kinder: 4 },
    },
    {
      id: 'gewerbe', label: 'Gewerbe & Büro',
      frage: 'Wo gibt es etablierte Gewerbelagen mit günstigem Boden und Anschluss an Bahn und Zentrum?',
      w: { ha_gm: 18, brw_gm: 14, d_bahn: 14, trend_gm: 12, d_zentrum: 12, d_bus: 10, bplan_ha: 10, prog: 6, wanderung: 4 },
    },
  ];

  const state = {
    profil: PROFILE[0],
    gewichte: Object.assign({}, PROFILE[0].w),
    farbe: 'score',
    auswahl: null,
    punkt: null,
    reiter: 'stadtteile',
    angebot: null,
  };
  let score = {}, rang = {}, reihenfolge = [];

  /* ---------------------------------------------------------- Format */
  const nfCache = {};
  const zahl = (v, d) => (nfCache[d] || (nfCache[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }))).format(v);
  function wert(key, v, mitVorzeichen) {
    const ind = IND[key];
    if (v == null) return 'keine Angabe';
    const vz = mitVorzeichen && v > 0 ? '+' : '';
    return vz + zahl(v, ind.digits).replace('-', '−') + ' ' + ind.unit;
  }
  const VORZEICHEN = { trend_w: 1, trend_gm: 1, bev_10: 1, prog: 1, wanderung: 1 };
  const w = (key, v) => wert(key, v, VORZEICHEN[key]);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* ---------------------------------------------------------- Score */
  function rechne() {
    const g = state.gewichte;
    score = {};
    IDS.forEach((id) => {
      let s = 0, sum = 0;
      for (const k in g) {
        const r = D.raenge[id][k];
        if (g[k] > 0 && r != null) { s += g[k] * r; sum += g[k]; }
      }
      score[id] = sum ? s / sum : null;
    });
    reihenfolge = IDS.slice().sort((a, b) => (score[b] == null ? -1 : score[b]) - (score[a] == null ? -1 : score[a]));
    rang = {};
    reihenfolge.forEach((id, i) => { rang[id] = i + 1; });
  }
  function staerken(id, n) {
    const g = state.gewichte;
    return Object.keys(g)
      .filter((k) => g[k] > 0 && D.raenge[id][k] != null && D.raenge[id][k] >= 60)
      .sort((a, b) => g[b] * D.raenge[id][b] - g[a] * D.raenge[id][a])
      .slice(0, n);
  }

  /* ---------------------------------------------------------- Geometrie */
  function imRing(x, y, ring) {
    let innen = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) innen = !innen;
    }
    return innen;
  }
  function imPolygon(x, y, coords) {
    if (!imRing(x, y, coords[0])) return false;
    for (let k = 1; k < coords.length; k++) if (imRing(x, y, coords[k])) return false;
    return true;
  }
  function inGeometrie(x, y, g) {
    return g.type === 'Polygon' ? imPolygon(x, y, g.coordinates) : g.coordinates.some((c) => imPolygon(x, y, c));
  }
  function rahmen(g) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const lauf = (ring) => ring.forEach((p) => { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0]; if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; });
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach((poly) => lauf(poly[0]));
    return [a, b, c, d];
  }
  [D.stadtteile, D.zonen, D.bplan_verfahren, D.bplan_recht].forEach((fc) => fc.features.forEach((f) => { f.bbox = rahmen(f.geometry); }));
  const treffer = (fc, x, y) => fc.features.filter((f) => x >= f.bbox[0] && x <= f.bbox[2] && y >= f.bbox[1] && y <= f.bbox[3] && inGeometrie(x, y, f.geometry));
  function meter(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180, dy = (lat2 - lat1) * r, dx = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
    return 6371000 * Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------------------------------------------------------- Karte */
  // Farben der Karte je Theme. Dach- und Baumfarben sind Darstellung, keine Messwerte.
  const PALETTE = {
    hell: {
      grund: '#e6e9e4',
      nutz: { acker: '#efeedd', gruenland: '#e2ebd0', natur: '#cfe0b6', wald: '#b9d4a3', park: '#d2e6bd', wohnen: '#ece7df', misch: '#e8e0d9', gewerbe: '#dfe0e8', sonst: '#e4e2d9', wasser: '#a6cbea', weg: '#f6f3ea', bahn: '#c9c9d1', strasse: '#ffffff' },
      wand: [[244, 239, 230], [226, 229, 236], [240, 231, 218], [224, 221, 214]],
      dach: [[181, 83, 60], [168, 73, 47], [150, 84, 66], [110, 113, 122], [92, 97, 107], [160, 104, 78]],
      flach: [[203, 202, 196], [188, 193, 202], [205, 198, 188], [196, 194, 188]],
      baum: [[88, 140, 72], [104, 154, 80], [76, 128, 70], [120, 160, 84]],
      dunst: [228, 234, 241], himmel: '#bcd8f2', horizont: '#eef3f8',
    },
    dunkel: {
      grund: '#0b1016',
      nutz: { acker: '#141a18', gruenland: '#15201a', natur: '#17261d', wald: '#162b1e', park: '#1a2c20', wohnen: '#1c212a', misch: '#1f222c', gewerbe: '#1e2130', sonst: '#191d23', wasser: '#10304f', weg: '#282e38', bahn: '#3a3f4b', strasse: '#353d4a' },
      wand: [[66, 77, 95], [58, 69, 90], [72, 79, 95], [50, 59, 73]],
      dach: [[122, 68, 58], [106, 60, 54], [82, 91, 110], [72, 81, 99], [96, 103, 120]],
      flach: [[84, 95, 113], [76, 88, 108], [88, 97, 113], [66, 75, 91]],
      baum: [[46, 96, 62], [54, 108, 68], [40, 86, 58]],
      dunst: [13, 19, 28], himmel: '#08121f', horizont: '#1b2738',
    },
  };
  const dunkel = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const pal = () => PALETTE[dunkel() ? 'dunkel' : 'hell'];
  const K = window.SCOUT_MAP;
  const nutzFarbe = () => { const p = pal().nutz, a = ['match', ['get', 'k']]; K.meta.klassen.forEach((name, i) => a.push(i, p[name])); a.push(p.sonst); return a; };

  const leer = { type: 'FeatureCollection', features: [] };
  const punkte = (liste) => ({ type: 'FeatureCollection', features: liste.map((x) => ({ type: 'Feature', properties: { name: x[0] }, geometry: { type: 'Point', coordinates: [x[1], x[2]] } })) });
  const zonenBauland = { type: 'FeatureCollection', features: D.zonen.features.filter((f) => f.properties.gruppe !== 'sonst') };
  const uebersicht = { type: 'FeatureCollection', features: K.meta.klassen.filter((k) => K.uebersicht[k]).map((k) => ({ type: 'Feature', properties: { k: K.meta.klassen.indexOf(k) }, geometry: K.uebersicht[k] })) };
  const GRENZEN = (function () { let a = 180, b = 90, c = -180, d = -90; IDS.forEach((id) => { const r = STT[id].bbox; a = Math.min(a, r[0]); b = Math.min(b, r[1]); c = Math.max(c, r[2]); d = Math.max(d, r[3]); }); return [[a, b], [c, d]]; })();

  let textVersion = 1;
  const textBild = (art) => ['concat', 'txt|' + textVersion + '|' + art + '|', ['get', 'name']];
  function stil() {
    const p = pal();
    return {
      version: 8,
      light: { anchor: 'map', position: [1.4, 215, 40], intensity: 0.28 },
      sources: {
        ueb: { type: 'geojson', data: uebersicht, tolerance: 0.3 },
        stt: { type: 'geojson', data: D.stadtteile, tolerance: 0.2 },
        zonen: { type: 'geojson', data: zonenBauland, tolerance: 0.2 },
        recht: { type: 'geojson', data: D.bplan_recht, tolerance: 0.2 },
        verf: { type: 'geojson', data: D.bplan_verfahren, tolerance: 0.1 },
        auswahl: { type: 'geojson', data: leer },
        punkt: { type: 'geojson', data: leer },
        angebote: { type: 'geojson', data: leer },
        bahn: { type: 'geojson', data: punkte(D.bahn.map((b) => [b.name, b.lon, b.lat])) },
        orte: { type: 'geojson', data: punkte(IDS.map((id) => [STT[id].properties.name, STT[id].properties.lon, STT[id].properties.lat])) },
        str: { type: 'geojson', data: punkte(K.strassen) },
      },
      layers: [
        { id: 'grund', type: 'background', paint: { 'background-color': p.grund } },
        { id: 'ueb', type: 'fill', source: 'ueb', paint: { 'fill-color': nutzFarbe() } },
        { id: 'stt-flach', type: 'fill', source: 'stt', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 14, 0.3, 16, 0.1] } },
        { id: 'zonen-fill', type: 'fill', source: 'zonen', layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.85, 15, 0.55, 17, 0.3], 'fill-outline-color': css('--surface') } },
        { id: 'stt-linie', type: 'line', source: 'stt', paint: { 'line-color': css('--ink-2'), 'line-width': 1.1, 'line-opacity': 0.75 } },
        { id: 'recht-fill', type: 'fill', source: 'recht', layout: { visibility: 'none' }, paint: { 'fill-color': css('--ink-2'), 'fill-opacity': 0.05 } },
        { id: 'recht-linie', type: 'line', source: 'recht', layout: { visibility: 'none' }, paint: { 'line-color': css('--ink-2'), 'line-width': 1 } },
        { id: 'verf-fill', type: 'fill', source: 'verf', paint: { 'fill-color': css('--plan'), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11.6, 0, 12.6, 0.14] } },
        { id: 'verf-linie', type: 'line', source: 'verf', paint: { 'line-color': css('--plan'), 'line-width': 2.4, 'line-dasharray': [2.4, 1.8], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 11.6, 0, 12.6, 1] } },
        // Übersicht: jeder Stadtteil als Säule, Höhe und Farbe folgen der gewählten Kennzahl.
        { id: 'stt-prisma', type: 'fill-extrusion', source: 'stt', paint: {
          'fill-extrusion-color': ['get', 'c'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 11.7, ['get', 'h'], 13.1, 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.95, 13.1, 0],
        } },
        { id: 'hervor', type: 'line', source: 'stt', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': css('--ink'), 'line-width': 2.5 } },
        { id: 'auswahl-rand', type: 'line', source: 'auswahl', paint: { 'line-color': css('--surface'), 'line-width': 6.5 } },
        { id: 'auswahl-linie', type: 'line', source: 'auswahl', paint: { 'line-color': css('--ink'), 'line-width': 2.5 } },
        { id: 'punkt', type: 'circle', source: 'punkt', paint: { 'circle-radius': 7, 'circle-color': css('--plan'), 'circle-stroke-color': css('--surface'), 'circle-stroke-width': 2.5, 'circle-pitch-alignment': 'map' } },
        { id: 'angebote', type: 'circle', source: 'angebote', paint: { 'circle-radius': 8, 'circle-color': ['match', ['get', 'stufe'], 'gut', '#0ca30c', 'warn', '#fab219', 'krit', '#d03b3b', css('--ink-2')], 'circle-stroke-color': css('--surface'), 'circle-stroke-width': 2.5 } },
        { id: 'bahn', type: 'circle', source: 'bahn', paint: { 'circle-radius': 5, 'circle-color': css('--ink'), 'circle-stroke-color': css('--surface'), 'circle-stroke-width': 2 } },
        { id: 'str-namen', type: 'symbol', source: 'str', minzoom: 15.2, layout: { 'icon-image': textBild('str'), 'icon-padding': 6 } },
        { id: 'bahn-namen', type: 'symbol', source: 'bahn', minzoom: 12.4, layout: { 'icon-image': textBild('bahn'), 'icon-anchor': 'bottom', 'icon-offset': [0, -14], 'icon-padding': 2 } },
        { id: 'orte', type: 'symbol', source: 'orte', layout: { 'icon-image': textBild('ort'), 'icon-padding': 4 } },
      ],
    };
  }

  let map = null, bereit = false, szene = null, tippFenster = null, angebotsPunkte = [];
  const nutzKacheln = [];
  const BESCHRIFTUNG = { ort: ['600 15px "Barlow Condensed", "Barlow", system-ui, sans-serif', 0.4], bahn: ['600 13px "Barlow Condensed", "Barlow", system-ui, sans-serif', 0.3], str: ['500 11.5px "Barlow", system-ui, sans-serif', 0] };
  // Beschriftungen entstehen als kleine Bilder aus der Seitenschrift – so braucht die Karte keinen Schriftserver.
  function zeichneText(art, text) {
    const f = BESCHRIFTUNG[art] || BESCHRIFTUNG.str, s = 2, c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    x.font = f[0];
    if (f[1] && 'letterSpacing' in x) x.letterSpacing = f[1] + 'px';
    const w = Math.ceil(x.measureText(text).width) + 10, h = 22;
    c.width = w * s; c.height = h * s;
    x.scale(s, s); x.font = f[0];
    if (f[1] && 'letterSpacing' in x) x.letterSpacing = f[1] + 'px';
    x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.strokeStyle = css('--halo'); x.lineWidth = 3.5; x.strokeText(text, 5, h / 2 + 0.5);
    x.fillStyle = art === 'str' ? css('--ink-2') : css('--ink'); x.fillText(text, 5, h / 2 + 0.5);
    return x.getImageData(0, 0, c.width, c.height);
  }
  const kamMeter = (zoom) => ((map.transform.cameraToCenterDistance || 1000) * 40075016.7 * Math.cos((51.96 * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
  const rand = () => {
    const breit = $('map').clientWidth > 720 && $('map').clientHeight >= 520;
    return { top: 20, bottom: 20, right: 30, left: breit ? 250 : 20 };
  };
  function ladeKacheln(ziel, zoom) {
    if (!szene) return;
    const c = ziel || map.getCenter(), z = zoom == null ? map.getZoom() : zoom;
    szene.ladeUm([c.lng, c.lat], z, kamMeter(z));
  }
  function fliege(bbox, opt) {
    const ziel = Object.assign({ padding: rand(), pitch: 58, bearing: -18, maxZoom: 15, duration: 2200, essential: false }, opt);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ziel.duration = 0;
    const kam = map.cameraForBounds(bbox, ziel);
    if (kam) ladeKacheln(kam.center, Math.min(kam.zoom, ziel.maxZoom));
    map.fitBounds(bbox, ziel);
  }
  // Die Stadt soll die Kartenfläche gut füllen: etwas näher heran, als die reine Einpassung ergibt.
  function ganzeStadt(sofort) {
    const kam = map.cameraForBounds(GRENZEN, { padding: rand(), pitch: 44, bearing: -12 });
    const ziel = { center: kam.center, zoom: Math.min(12.4, kam.zoom + 0.25), pitch: 44, bearing: -12, duration: 1800 };
    if (sofort || window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.jumpTo(ziel); else map.flyTo(ziel);
  }
  // Flug in den Ortskern eines Stadtteils, nah genug, dass die Gebäude stehen.
  function fliegeZuKern(id) {
    const p = STT[id].properties, ziel = { center: [p.klon, p.klat], zoom: 15.3, pitch: 60, bearing: -18, padding: rand(), duration: 2600 };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ziel.duration = 0;
    ladeKacheln({ lng: p.klon, lat: p.klat }, ziel.zoom);
    map.flyTo(ziel);
  }

  try {
    map = new maplibregl.Map({
      container: 'map', style: stil(), bounds: GRENZEN, fitBoundsOptions: { padding: rand(), pitch: 44, bearing: -12 },
      minZoom: 9.5, maxZoom: 19, maxPitch: 72, antialias: true, attributionControl: false,
      maxBounds: [[GRENZEN[0][0] - 0.5, GRENZEN[0][1] - 0.3], [GRENZEN[1][0] + 0.5, GRENZEN[1][1] + 0.3]],
    });
  } catch (fehler) {
    $('map').innerHTML = '<p class="kein-webgl">Die 3D-Karte braucht WebGL. Ranking und Steckbriefe funktionieren weiter.</p>';
  }
  if (map) {
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl({
      onAdd: () => {
        const el = document.createElement('div');
        el.className = 'maplibregl-ctrl ansicht';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Kartenansicht');
        el.innerHTML = '<button type="button" class="knopf" id="ganz">Ganze Stadt</button><button type="button" class="knopf" id="neigung">Draufsicht</button>';
        return el;
      },
      onRemove: () => {},
    }, 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: 'Geobasis NRW (dl-de/zero-2-0) · Stadt Münster, Gutachterausschuss, Stadtwerke Münster (dl-de/by-2-0)' }));
    map.on('styleimagemissing', (e) => {
      const t = e.id.split('|');
      if (t[0] === 'txt' && !map.hasImage(e.id)) map.addImage(e.id, zeichneText(t[2], t.slice(3).join('|')), { pixelRatio: 2 });
    });
    szene = window.Scout3D.erzeuge(map, {
      palette: () => {
        const p = pal();
        return p;
      },
      flaechenDa: (key, daten) => {
        const los = () => {
          if (map.getSource('n' + key)) return;
          map.addSource('n' + key, { type: 'geojson', data: daten, tolerance: 0.15, maxzoom: 17 });
          map.addLayer({ id: 'n' + key, type: 'fill', source: 'n' + key, minzoom: 12.4, paint: { 'fill-color': nutzFarbe() } }, 'stt-flach');
          nutzKacheln.push('n' + key);
        };
        if (bereit) los(); else map.once('load', los);
      },
    });
    map.on('load', () => {
      bereit = true;
      ganzeStadt(true);
      map.addLayer(szene.ebene, 'punkt');
      himmel();
      zeichneFlaechen();
      zeichneAuswahl();
      map.getSource('angebote').setData({ type: 'FeatureCollection', features: angebotsPunkte });
      ladeKacheln();
    });
    let takt = 0;
    map.on('move', () => { const t = Date.now(); if (t - takt > 350) { takt = t; ladeKacheln(); } });
    map.on('moveend', () => ladeKacheln());

    tippFenster = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'tipp', offset: 14, maxWidth: '260px' });
    const TIPP_EBENEN = ['angebote', 'bahn', 'verf-fill', 'recht-fill', 'zonen-fill', 'stt-prisma', 'stt-flach'];
    map.on('mousemove', (e) => {
      if (!bereit) return;
      const f = map.queryRenderedFeatures(e.point, { layers: TIPP_EBENEN })
        .sort((a, b) => TIPP_EBENEN.indexOf(a.layer.id) - TIPP_EBENEN.indexOf(b.layer.id))[0];
      map.getCanvas().style.cursor = f ? 'pointer' : '';
      if (!f) { tippFenster.remove(); markiereZeile(null); return; }
      const p = f.properties;
      let html = '';
      if (f.layer.id === 'angebote') html = `<b>${esc(p.titel)}</b><br><span>${zahl(+p.preis, 0)}\u00a0€ · ${esc(p.urteil)}</span>`;
      else if (f.layer.id === 'bahn') html = `<b>${esc(p.name)}</b><br><span>Bahnhof / Haltepunkt</span>`;
      else if (f.layer.id === 'verf-fill') html = `<b>B-Plan ${esc(p.plannr)} · im Verfahren</b><br><span>${esc(p.name)} · ${zahl(+p.ha, 1)} ha</span>`;
      else if (f.layer.id === 'recht-fill') html = `<b>B-Plan ${esc(p.plannr)}</b>${p.jahr ? ' · seit ' + p.jahr : ''}<br><span>${esc(p.name)}</span>`;
      else if (f.layer.id === 'zonen-fill') html = `<b>${esc(p.nuta_text)}</b><br><span>${zahl(+p.brw, 0)} €/m² · Zone ${esc(p.nr)}, ${esc(p.ort)}</span>`;
      else { html = tippStadtteil(p.id); markiereZeile(p.id); }
      tippFenster.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
    map.getCanvas().addEventListener('mouseleave', () => { tippFenster.remove(); markiereZeile(null); });

    map.on('click', (e) => {
      const ang = map.queryRenderedFeatures(e.point, { layers: ['angebote'] })[0];
      if (ang && window.ScoutAngebote) { state.reiter = 'angebote'; window.ScoutAngebote.waehle(ang.properties.id); return; }
      // In der Übersicht zählt die angeklickte Säule; hineingezoomt der genaue Punkt am Boden.
      const saeule = map.getZoom() < 13.1 && state.farbe !== 'zonen' ? map.queryRenderedFeatures(e.point, { layers: ['stt-prisma'] })[0] : null;
      if (saeule) waehle(saeule.properties.id, null);
      else {
        const s = treffer(D.stadtteile, e.lngLat.lng, e.lngLat.lat)[0];
        if (!s) return;
        waehle(s.properties.id, { lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
      const z = $('rolle').querySelector('.zeile[aria-current="true"]');
      if (z && !window.matchMedia('(max-width: 760px)').matches) z.scrollIntoView({ block: 'nearest' });
    });
    $('ganz').addEventListener('click', () => ganzeStadt(false));
    $('neigung').addEventListener('click', () => {
      const flach = map.getPitch() > 5;
      map.easeTo({ pitch: flach ? 0 : 58, bearing: flach ? 0 : -18, duration: 900 });
    });
    map.on('pitchend', () => { $('neigung').textContent = map.getPitch() > 5 ? 'Draufsicht' : '3D-Ansicht'; });
  }

  function himmel() {
    const p = pal();
    try { map.setSky({ 'sky-color': p.himmel, 'horizon-color': p.horizont, 'fog-color': p.horizont, 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.45 }); } catch (e) { /* ältere Kartenversion ohne Himmel */ }
  }
  function zeichneAuswahl() {
    if (!bereit) return;
    map.getSource('auswahl').setData(state.auswahl ? STT[state.auswahl] : leer);
    map.getSource('punkt').setData(state.punkt ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [state.punkt.lng, state.punkt.lat] } } : leer);
  }

  /* ---------------------------------------------------------- Einfärbung */
  function quantile(vals, n) {
    const s = vals.filter((v) => v != null).sort((a, b) => a - b);
    const g = [];
    for (let i = 1; i < n; i++) g.push(s[Math.min(s.length - 1, Math.floor((i * s.length) / n))]);
    return { grenzen: g.filter((v, i) => i === 0 || v > g[i - 1]), min: s[0], max: s[s.length - 1] };
  }
  const klasse = (v, grenzen) => grenzen.reduce((k, g) => k + (v >= g ? 1 : 0), 0);
  const farbeFuer = (k, n) => css('--seq-' + (n <= 1 ? 3 : 1 + Math.round((k * 4) / (n - 1))));

  function zeichneFlaechen() {
    const zonenModus = state.farbe === 'zonen';
    if (zonenModus) {
      const q = quantile(zonenBauland.features.map((f) => f.properties.brw), 5), n = q.grenzen.length + 1;
      zonenBauland.features.forEach((f) => { f.properties.c = farbeFuer(klasse(f.properties.brw, q.grenzen), n); });
      legende('Bodenrichtwert ' + STAND.brw, '€/m²', 0, q, 'Baureifes Land für Wohnen, Mischnutzung und Gewerbe. Außenbereich und Sonderflächen sind nicht eingefärbt.');
    } else {
      const key = state.farbe;
      const von = (id) => (key === 'score' ? score[id] : D.werte[id][key]);
      const q = quantile(IDS.map(von), 5), n = q.grenzen.length + 1;
      IDS.forEach((id) => {
        const v = von(id), p = STT[id].properties;
        p.c = v == null ? css('--nodata') : farbeFuer(klasse(v, q.grenzen), n);
        p.h = v == null ? 40 : 90 + (1500 * (v - q.min)) / ((q.max - q.min) || 1);
      });
      if (key === 'score') legende('Score ' + state.profil.label, 'Punkte', 0, q, 'In der Übersicht steht jeder Stadtteil als Säule: je höher, desto besser geeignet. 100 Punkte hieße: in jedem Kriterium der beste.');
      else legende(IND[key].label, IND[key].unit, IND[key].digits, q, IND[key].desc, IDS.some((id) => von(id) == null));
    }
    if (!bereit) return;
    const p = pal(), sichtbar = (id, an) => map.setLayoutProperty(id, 'visibility', an ? 'visible' : 'none');
    if (zonenModus) map.getSource('zonen').setData(zonenBauland); else map.getSource('stt').setData(D.stadtteile);
    sichtbar('zonen-fill', zonenModus); sichtbar('stt-prisma', !zonenModus); sichtbar('stt-flach', !zonenModus);
    sichtbar('verf-fill', $('l-verfahren').checked); sichtbar('verf-linie', $('l-verfahren').checked);
    sichtbar('recht-fill', $('l-recht').checked); sichtbar('recht-linie', $('l-recht').checked);
    sichtbar('bahn', $('l-bahn').checked); sichtbar('bahn-namen', $('l-bahn').checked);
    // Farben aus dem aktuellen Theme
    map.setPaintProperty('grund', 'background-color', p.grund);
    ['ueb'].concat(nutzKacheln).forEach((id) => map.setPaintProperty(id, 'fill-color', nutzFarbe()));
    map.setPaintProperty('zonen-fill', 'fill-outline-color', css('--surface'));
    map.setPaintProperty('stt-linie', 'line-color', css('--ink-2'));
    ['recht-fill', 'verf-fill'].forEach((id) => map.setPaintProperty(id, 'fill-color', css(id === 'recht-fill' ? '--ink-2' : '--plan')));
    map.setPaintProperty('recht-linie', 'line-color', css('--ink-2'));
    map.setPaintProperty('verf-linie', 'line-color', css('--plan'));
    map.setPaintProperty('hervor', 'line-color', css('--ink'));
    map.setPaintProperty('auswahl-rand', 'line-color', css('--surface'));
    map.setPaintProperty('auswahl-linie', 'line-color', css('--ink'));
    map.setPaintProperty('punkt', 'circle-color', css('--plan'));
    map.setPaintProperty('punkt', 'circle-stroke-color', css('--surface'));
    map.setPaintProperty('bahn', 'circle-color', css('--ink'));
    map.setPaintProperty('bahn', 'circle-stroke-color', css('--surface'));
    map.setPaintProperty('angebote', 'circle-stroke-color', css('--surface'));
  }
  function themaGewechselt() {
    if (!bereit) return;
    textVersion++;
    ['str', 'bahn', 'ort'].forEach((art) => map.setLayoutProperty(art === 'ort' ? 'orte' : art + '-namen', 'icon-image', textBild(art)));
    himmel();
    zeichneFlaechen();
    szene.neuFaerben();
  }
  function legende(titel, einheit, d, q, fuss, ohneAngabe) {
    const n = q.grenzen.length + 1, zeilen = [];
    for (let k = n - 1; k >= 0; k--) {
      const von = k === 0 ? q.min : q.grenzen[k - 1], bis = k === n - 1 ? q.max : q.grenzen[k];
      const text = k === n - 1 ? `ab ${zahl(von, d)}` : k === 0 ? `unter ${zahl(bis, d)}` : `${zahl(von, d)} bis unter ${zahl(bis, d)}`;
      zeilen.push(`<li><i style="background:${farbeFuer(k, n)}"></i><span class="num">${text.replace(/-/g, '−')}</span></li>`);
    }
    if (ohneAngabe) zeilen.push(`<li><i style="background:${css('--nodata')}"></i><span>keine Angabe</span></li>`);
    $('legende').innerHTML = `<h3>${esc(titel)} <span style="font-weight:400;color:var(--muted)">in ${esc(einheit)}</span></h3><ol>${zeilen.join('')}</ol><p class="fuss">${esc(fuss)}</p>`;
  }
  function tippStadtteil(id) {
    const p = STT[id].properties;
    let zeile = `Score ${zahl(score[id], 0)} · Rang ${rang[id]} von ${IDS.length}`;
    if (state.farbe !== 'score' && state.farbe !== 'zonen') zeile = `${esc(IND[state.farbe].label)}: ${w(state.farbe, D.werte[id][state.farbe])}<br>${zeile}`;
    return `<b>${esc(p.name)}</b><br><span>${zeile}</span>`;
  }

  /* ---------------------------------------------------------- Liste */
  function zeichneListe() {
    $('frage').textContent = state.profil.frage;
    $('tab-stadtteile').setAttribute('aria-selected', state.reiter === 'stadtteile');
    $('tab-plaene').setAttribute('aria-selected', state.reiter === 'plaene');
    $('tab-angebote').setAttribute('aria-selected', state.reiter === 'angebote');
    $('rolle').setAttribute('aria-labelledby', 'tab-' + state.reiter);
    if (state.reiter === 'angebote') {
      if (window.ScoutAngebote) window.ScoutAngebote.zeichneListe($('rolle'));
      else $('rolle').innerHTML = '<p class="hinweis">Der Angebots-Check wird geladen …</p>';
    } else if (state.reiter === 'stadtteile') {
      $('rolle').innerHTML = '<ol class="rang-liste">' + reihenfolge.map((id) => {
        const p = STT[id].properties;
        const gruende = staerken(id, 2).map((k) => `${esc(IND[k].short)} ${w(k, D.werte[id][k])}`).join(' · ') || 'keine ausgeprägte Stärke in diesem Profil';
        return `<li><button type="button" class="zeile" data-id="${id}" aria-current="${state.auswahl === id}">
          <span class="rang num">${rang[id]}</span>
          <span class="titel">${esc(p.name)} <span class="unter">${esc(p.bezirk)}</span></span>
          <span class="wert num">${zahl(score[id], 0)}</span>
          <span class="balken"><i style="width:${score[id]}%"></i></span>
          <span class="gruende">${gruende}</span>
        </button></li>`;
      }).join('') + '</ol>';
    } else {
      const plaene = D.bplan_verfahren.features.map((f) => f.properties).filter((p) => p.stt)
        .sort((a, b) => score[b.stt] - score[a.stt] || b.ha - a.ha);
      $('rolle').innerHTML = `<p class="hinweis">${plaene.length} Bebauungspläne sind im Aufstellungsverfahren. Hier entsteht neues Baurecht. Sortiert nach dem Score des Stadtteils für „${esc(state.profil.label)}“.</p><ol class="rang-liste">` + plaene.map((p) => `
        <li><button type="button" class="zeile plan-zeile" data-plan="${esc(p.plannr)}">
          <span class="titel">${esc(p.name)}</span>
          <span class="wert num">${zahl(p.ha, 1)} ha</span>
          <span class="gruende">B-Plan ${esc(p.plannr)} · ${esc(p.stt_name)} · Score ${zahl(score[p.stt], 0)} (Rang ${rang[p.stt]})</span>
        </button></li>`).join('') + '</ol>';
    }
  }
  let markiert = null;
  function markiereZeile(id) {
    if (markiert === id) return;
    const alt = markiert && $('rolle').querySelector(`.zeile[data-id="${markiert}"]`);
    if (alt) alt.classList.remove('hover');
    markiert = id;
    const neu = id && $('rolle').querySelector(`.zeile[data-id="${id}"]`);
    if (neu) neu.classList.add('hover');
  }
  $('rolle').addEventListener('click', (e) => {
    const z = e.target.closest('.zeile');
    if (!z || z.classList.contains('ang-zeile')) return;
    if (z.dataset.id) {
      waehle(z.dataset.id, null);
      if (map) fliegeZuKern(z.dataset.id);
    } else {
      const f = D.bplan_verfahren.features.find((x) => x.properties.plannr === z.dataset.plan);
      $('l-verfahren').checked = true; schalteEbenen();
      const r = f.bbox;
      if (map) fliege([[r[0], r[1]], [r[2], r[3]]], { maxZoom: 16.4, pitch: 60 });
      waehle(f.properties.stt, { lat: (r[1] + r[3]) / 2, lng: (r[0] + r[2]) / 2 });
    }
    if (window.matchMedia('(max-width: 760px)').matches) document.querySelector('.karte').scrollIntoView({ behavior: 'smooth' });
  });
  $('rolle').addEventListener('mouseover', (e) => { const z = e.target.closest('.zeile[data-id]'); hebeHervor(z ? z.dataset.id : null); });
  $('rolle').addEventListener('mouseleave', () => hebeHervor(null));
  let hervor = null;
  function hebeHervor(id) {
    if (hervor === id) return;
    hervor = id;
    if (bereit) map.setFilter('hervor', ['==', ['get', 'id'], id || '']);
  }
  ['stadtteile', 'plaene', 'angebote'].forEach((r) => $('tab-' + r).addEventListener('click', () => { state.reiter = r; zeichneListe(); }));

  /* ---------------------------------------------------------- Diagramm */
  // Eine Reihe als Linie; optional gestrichelte Fortsetzung (Prognose). Mit Fadenkreuz beim Überfahren.
  function diagramm(o) {
    const W = 330, H = 96, l = 4, r = 8, t = 12, b = 18;
    const jahre = o.jahre.concat(o.pJahre || []), werte = o.werte.concat(o.pWerte || []);
    const da = werte.filter((v) => v != null);
    if (da.length < 2) return '<p class="neben">Keine Zeitreihe verfügbar.</p>';
    let lo = Math.min.apply(null, da), hi = Math.max.apply(null, da);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    const x = (i) => l + ((W - l - r) * i) / (jahre.length - 1), y = (v) => t + (H - t - b) * (1 - (v - lo) / (hi - lo));
    const pfad = (von, bis) => { let d = ''; for (let i = von; i <= bis; i++) if (werte[i] != null) d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(werte[i]).toFixed(1); return d; };
    const n = o.werte.length, erst = werte.findIndex((v) => v != null), letzt = werte.length - 1;
    const ist = pfad(erst, n - 1);
    const flaeche = ist + `L${x(n - 1).toFixed(1)} ${H - b}L${x(erst).toFixed(1)} ${H - b}Z`;
    const prog = o.pWerte ? `<path class="c-prognose" d="${pfad(n - 1, letzt)}"/>` : '';
    const marke = o.pWerte ? `<text x="${x(n).toFixed(1)}" y="${H - b - 4}" text-anchor="start">Prognose</text>` : '';
    return `<div class="chart" data-chart='${JSON.stringify({ jahre, werte, n, d: o.d, e: o.einheit })}'>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titel)}">
        <line class="c-achse" x1="${l}" x2="${W - r}" y1="${H - b}" y2="${H - b}"/>
        <path class="c-flaeche" d="${flaeche}"/><path class="c-linie" d="${ist}"/>${prog}${marke}
        <line class="c-faden" y1="${t}" y2="${H - b}" x1="0" x2="0" visibility="hidden"/>
        <circle class="c-punkt" r="4" cx="${x(letzt).toFixed(1)}" cy="${y(werte[letzt]).toFixed(1)}"/>
        <text x="${x(erst)}" y="${H - 4}" text-anchor="start">${jahre[erst]}</text>
        <text x="${W - r}" y="${H - 4}" text-anchor="end">${jahre[letzt]}</text>
        <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      </svg><div class="c-info" hidden></div></div>`;
  }
  function verdrahteDiagramme(wurzel) {
    wurzel.querySelectorAll('.chart[data-chart]').forEach((el) => {
      const c = JSON.parse(el.dataset.chart), svg = el.querySelector('svg'), faden = el.querySelector('.c-faden'), punkt = el.querySelector('.c-punkt'), info = el.querySelector('.c-info');
      const W = 330, H = 96, l = 4, r = 8, t = 12, b = 18;
      const da = c.werte.filter((v) => v != null);
      let lo = Math.min.apply(null, da), hi = Math.max.apply(null, da);
      if (hi === lo) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
      const x = (i) => l + ((W - l - r) * i) / (c.jahre.length - 1), y = (v) => t + (H - t - b) * (1 - (v - lo) / (hi - lo));
      const letzt = c.werte.length - 1;
      const zeige = (i) => {
        punkt.setAttribute('cx', x(i)); punkt.setAttribute('cy', y(c.werte[i]));
        faden.setAttribute('x1', x(i)); faden.setAttribute('x2', x(i));
      };
      svg.addEventListener('pointermove', (e) => {
        const box = svg.getBoundingClientRect();
        let i = Math.round((((e.clientX - box.left) / box.width) * W - l) / ((W - l - r) / (c.jahre.length - 1)));
        i = Math.max(0, Math.min(letzt, i));
        while (c.werte[i] == null && i < letzt) i++;
        zeige(i); faden.setAttribute('visibility', 'visible');
        info.hidden = false;
        info.textContent = `${c.jahre[i]}${i >= c.n ? ' (Prognose)' : ''}: ${zahl(c.werte[i], c.d)} ${c.e}`;
      });
      svg.addEventListener('pointerleave', () => { zeige(letzt); faden.setAttribute('visibility', 'hidden'); info.hidden = true; });
    });
  }

  /* ---------------------------------------------------------- Steckbrief */
  // Reihenfolge im Standort-Check: baureifes Land, dann bebauter Außenbereich, dann Acker, Grünland, Forst
  const stufe = (z) => (z.gruppe !== 'sonst' ? 0 : z.asb ? 1 : 2);
  function standortCheck(pt) {
    const x = pt.lng, y = pt.lat;
    const zonen = treffer(D.zonen, x, y).map((f) => f.properties)
      .sort((a, b) => stufe(a) - stufe(b) || b.brw - a.brw);
    const recht = treffer(D.bplan_recht, x, y).map((f) => f.properties).sort((a, b) => (b.jahr || 0) - (a.jahr || 0));
    const verf = treffer(D.bplan_verfahren, x, y).map((f) => f.properties);
    const bahn = D.bahn.map((b) => ({ name: b.name, m: meter(y, x, b.lat, b.lon) })).sort((a, b) => a.m - b.m)[0];
    const zone = (z) => {
      const extra = [z.asb ? 'Außenbereich' : '', z.gez ? 'Geschosse ' + z.gez : '', z.gfz ? 'GFZ ' + zahl(z.gfz, 1) : '', z.entw === 'B' ? '' : 'kein baureifes Land'].filter(Boolean).join(' · ');
      return `<div><b class="num">${zahl(z.brw, z.brw < 20 ? 2 : 0)} €/m²</b> ${esc(z.nuta_text)}<small>${esc(extra)}${extra && z.bem ? ' · ' : ''}${esc(z.bem || '')}</small></div>`;
    };
    const plan = (p, zusatz) => `<div><a href="${esc(p.url)}" target="_blank" rel="noopener">B-Plan ${esc(p.plannr)}</a> ${zusatz}<small>${esc(p.name)}</small></div>`;
    let baurecht = recht.map((p) => plan(p, p.jahr ? `· rechtskräftig seit ${p.jahr}` : '· rechtskräftig')).join('') + verf.map((p) => plan(p, '· im Aufstellungsverfahren')).join('');
    if (!baurecht) baurecht = '<div>Kein Bebauungsplan an dieser Stelle.<small>Die Zulässigkeit richtet sich dann nach § 34 oder § 35 BauGB.</small></div>';
    return `<div class="check">
      <h3>Standort-Check <small class="num">${zahl(y, 5)}° N, ${zahl(x, 5)}° O</small></h3>
      <dl>
        <dt>Bodenrichtwert ${STAND.brw}</dt><dd>${zonen.map(zone).join('') || 'Keine Richtwertzone an dieser Stelle.'}</dd>
        <dt>Baurecht</dt><dd>${baurecht}</dd>
        <dt>Nächster Bahnhof</dt><dd>${esc(bahn.name)}, <span class="num">${zahl(bahn.m < 1000 ? Math.round(bahn.m / 10) * 10 : bahn.m / 1000, bahn.m < 1000 ? 0 : 1)} ${bahn.m < 1000 ? 'm' : 'km'}</span> Luftlinie</dd>
      </dl>
    </div>`;
  }

  function zeichneSteckbrief() {
    const el = $('steckbrief'), id = state.auswahl;
    if (window.ScoutAngebote && window.ScoutAngebote.zeichneDetail(el)) return;
    if (!id) {
      el.innerHTML = '<div class="abschnitt"><h3>Kein Stadtteil gewählt</h3><p class="lead">Wählen Sie einen Stadtteil in der Liste oder klicken Sie in die Karte. Hineingezoomt zeigt ein Klick auch Bodenrichtwert und Baurecht genau an dieser Stelle.</p></div>';
      return;
    }
    const p = STT[id].properties, v = D.werte[id], r = D.reihen[id], g = state.gewichte;
    const kriterien = Object.keys(g).filter((k) => g[k] > 0).sort((a, b) => g[b] - g[a]);
    const summe = kriterien.reduce((s, k) => s + g[k], 0);
    const meterZeilen = kriterien.map((k) => {
      const pr = D.raenge[id][k];
      return `<div class="meter-zeile" title="${esc(IND[k].desc)}">
        <span class="name">${esc(IND[k].label)} <small>Gewicht ${zahl((g[k] / summe) * 100, 0)} %</small></span>
        <span class="zahl">${w(k, v[k])}</span>
        <span class="spur"><i style="width:${pr == null ? 0 : pr}%"></i></span>
      </div>`;
    }).join('');
    const plaene = D.bplan_verfahren.features.map((f) => f.properties).filter((x) => x.stt === id).sort((a, b) => b.ha - a.ha);
    const basis = v.brw_w_basis === 'W' ? 'Wohnbauflächen' : 'Misch- und Kerngebiete (keine reine Wohnbaufläche)';
    const tabelle = D.indikatoren.map((i) => `<tr><td>${esc(i.label)}</td><td class="r">${w(i.key, v[i.key])}</td><td class="r">${w(i.key, i.median)}</td></tr>`).join('');

    el.innerHTML = `
      <div class="steck-kopf">
        <div><h2>${esc(p.name)}</h2><p>Stadtbezirk ${esc(p.bezirk)} · ${zahl(v.einwohner, 0)} Einwohner (${STAND.bev})</p></div>
        <div class="score-marke"><b class="num">${zahl(score[id], 0)}</b><span>Rang ${rang[id]} von ${IDS.length}</span></div>
      </div>
      ${state.punkt ? standortCheck(state.punkt) : ''}
      <div class="kacheln">
        <div class="kachel">
          <span class="etikett">Bodenrichtwert Wohnen</span>
          <div class="gross num">${v.brw_w == null ? '–' : zahl(v.brw_w, 0)} <small>€/m²</small></div>
          <div class="neben">${v.trend_w == null ? 'Entwicklung nicht vergleichbar' : w('trend_w', v.trend_w) + ' seit ' + D.meta.brw_jahre[(r.brw_w || []).findIndex((x) => x != null)]}</div>
          ${r.brw_w ? diagramm({ jahre: D.meta.brw_jahre, werte: r.brw_w, d: 0, einheit: '€/m²', titel: 'Bodenrichtwert Wohnen ' + p.name }) : ''}
        </div>
        <div class="kachel">
          <span class="etikett">Einwohner</span>
          <div class="gross num">${zahl(v.einwohner, 0)}</div>
          <div class="neben">Prognose ${D.meta.prog_jahre[D.meta.prog_jahre.length - 1]}: ${w('prog', v.prog)}</div>
          ${diagramm({ jahre: D.meta.bev_jahre, werte: r.bev, pJahre: D.meta.prog_jahre, pWerte: r.prog, d: 0, einheit: 'Einwohner', titel: 'Einwohner ' + p.name })}
        </div>
      </div>
      <div class="abschnitt">
        <h3>So entsteht der Score für „${esc(state.profil.label)}“</h3>
        <p class="lead">Balken = Prozentrang unter allen 45 Stadtteilen. Die Marke in der Mitte ist der Median.</p>
        <div class="meter">${meterZeilen}</div>
        <p class="meter-fuss">Bodenrichtwert Wohnen bezieht sich hier auf: ${basis}.</p>
      </div>
      <div class="abschnitt">
        <h3>Bebauungspläne im Verfahren</h3>
        ${plaene.length ? `<ul class="plaene">${plaene.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">B-Plan ${esc(x.plannr)}</a> · <span class="num">${zahl(x.ha, 1)} ha</span><small>${esc(x.name)}</small></li>`).join('')}</ul>` : '<p class="lead" style="margin-top:0">Derzeit kein Bebauungsplan im Aufstellungsverfahren mit Schwerpunkt in diesem Stadtteil.</p>'}
      </div>
      <div class="abschnitt">
        <h3>Alle Kennzahlen</h3>
        <div class="tab-wrap"><table class="zahlen"><thead><tr><th>Kennzahl</th><th class="r">${esc(p.name)}</th><th class="r">Median Stadt</th></tr></thead><tbody>${tabelle}</tbody></table></div>
      </div>`;
    verdrahteDiagramme(el);
  }

  function waehle(id, punkt) {
    if (state.angebot !== 'neu') state.angebot = null;   // ein offenes Formular bleibt stehen
    state.auswahl = id;
    state.punkt = punkt;
    zeichneAuswahl();
    $('rolle').querySelectorAll('.zeile[data-id]').forEach((z) => z.setAttribute('aria-current', z.dataset.id === id));
    zeichneSteckbrief();
  }

  /* ---------------------------------------------------------- Bedienung */
  function zeichneProfile() {
    $('profile').innerHTML = PROFILE.map((p) => `<button type="button" data-p="${p.id}" aria-pressed="${p === state.profil}">${esc(p.label)}</button>`).join('');
  }
  $('profile').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.profil = PROFILE.find((p) => p.id === b.dataset.p);
    state.gewichte = Object.assign({}, state.profil.w);
    zeichneProfile(); zeichneRegler(); allesNeu();
  });
  function zeichneRegler() {
    $('regler').innerHTML = D.indikatoren.map((i) => {
      const g = state.gewichte[i.key] || 0;
      return `<label for="g-${i.key}" title="${esc(i.desc)}">${esc(i.label)}</label><input type="range" id="g-${i.key}" data-k="${i.key}" min="0" max="30" step="1" value="${g}"><output for="g-${i.key}">${g}</output>`;
    }).join('');
  }
  $('regler').addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    state.gewichte[k] = +e.target.value;
    e.target.nextElementSibling.textContent = e.target.value;
    if (Object.values(state.gewichte).some((x) => x > 0)) allesNeu();
  });
  $('reset').addEventListener('click', () => { state.gewichte = Object.assign({}, state.profil.w); zeichneRegler(); allesNeu(); });

  $('farbe').innerHTML = '<optgroup label="Bewertung"><option value="score">Score des gewählten Profils</option></optgroup>'
    + '<optgroup label="Kennzahl je Stadtteil">' + D.indikatoren.map((i) => `<option value="${i.key}">${esc(i.label)}</option>`).join('') + '</optgroup>'
    + '<optgroup label="Detailkarte"><option value="zonen">Bodenrichtwertzonen ' + STAND.brw + '</option></optgroup>';
  $('farbe').addEventListener('change', (e) => { state.farbe = e.target.value; zeichneFlaechen(); });
  const schalteEbenen = () => zeichneFlaechen();
  ['l-verfahren', 'l-recht', 'l-bahn'].forEach((id) => $(id).addEventListener('change', schalteEbenen));
  if ($('map').clientHeight < 520 || window.matchMedia('(max-width: 760px)').matches) $('ebenen').open = false;

  function zeichneMethodik() {
    const quellen = Array.from(new Set(D.indikatoren.map((i) => i.src)));
    $('methodik-inhalt').innerHTML = `
      <p><b>Bewertung.</b> Jede Kennzahl wird in einen Prozentrang von 0 bis 100 unter den 45 Stadtteilen umgerechnet (100 = bester Stadtteil, je nach Kennzahl der höchste oder der niedrigste Wert). Der Score ist der gewichtete Mittelwert dieser Ränge. Fehlt ein Wert, zählt das Kriterium für diesen Stadtteil nicht mit.</p>
      <p><b>Bodenrichtwerte.</b> Auf dem Bauland liegt ein Raster aus 50-m-Messpunkten. An jedem Punkt wird der Richtwert der Jahre ${D.meta.brw_jahre[0]} bis ${STAND.brw} abgelesen. Die Preisentwicklung vergleicht nur Punkte, die in beiden Jahren einen Wert haben. Außenbereichszonen bleiben außen vor. 2022 wurden die Zonen neu zugeschnitten, ein Teil des Sprungs in diesem Jahr kann darauf zurückgehen.</p>
      <p><b>3D-Karte.</b> Gebäude und Dachformen stammen aus dem amtlichen 3D-Gebäudemodell (LoD2) von Geobasis NRW, Straßen, Gewässer und Grünflächen aus dem Liegenschaftskataster der Stadt, Bäume aus dem städtischen Baumkataster. Dach- und Fassadenfarben sowie die Baumgröße sind Darstellung, keine Messwerte.</p>
      <p><b>Erreichbarkeit.</b> Mittlere Luftlinie von denselben Messpunkten zur nächsten Kita, Grundschule, Bushaltestelle und zum nächsten Bahnhof. Luftlinie ist kürzer als der tatsächliche Weg.</p>
      <p><b>Grenzen.</b> Ein Bodenrichtwert ist ein Durchschnittswert für eine Zone und kein Kaufpreis für ein einzelnes Grundstück. Bebauungspläne im Verfahren sind nicht alle Neubaugebiete, manche überplanen den Bestand. Mieten, Kaufpreise und Autobahnanschlüsse fehlen noch. Der Score ersetzt keine Ankaufsprüfung.</p>
      <p><b>Quellen</b> (Datenlizenz Deutschland – Namensnennung 2.0, abgerufen ${D.meta.erstellt.split('-').reverse().join('.')}):</p>
      <ul>${quellen.map((q) => `<li>${esc(q)}</li>`).join('')}<li>Stadtteilgrenzen (statistische Bezirke), Stadt Münster</li><li>Tatsächliche Nutzung, Baumkataster, Straßenverzeichnis, Stadt Münster</li><li>3D-Gebäudemodell LoD2, Geobasis NRW (Datenlizenz Deutschland – Zero 2.0)</li></ul>
      <p>Alle Daten stammen aus dem <a href="https://opendata.stadt-muenster.de" target="_blank" rel="noopener">Open-Data-Portal der Stadt Münster</a>.</p>`;
  }

  function allesNeu() {
    rechne();
    zeichneListe();
    zeichneFlaechen();
    zeichneSteckbrief();
  }

  // Farben folgen dem Theme: bei Wechsel neu einfärben.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themaGewechselt);
  new MutationObserver(themaGewechselt).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (map) new ResizeObserver(() => map.resize()).observe($('map'));

  /* ---------------------------------------------------------- Schnittstelle für den Angebots-Check */
  const profilScores = {};
  function scoreFuer(profilId, sttId) {
    if (!profilScores[profilId]) {
      const g = PROFILE.find((p) => p.id === profilId).w, s = {};
      IDS.forEach((id) => { let a = 0, b = 0; for (const k in g) { const r = D.raenge[id][k]; if (r != null) { a += g[k] * r; b += g[k]; } } s[id] = b ? a / b : 0; });
      const folge = IDS.slice().sort((x, y) => s[y] - s[x]), r = {};
      folge.forEach((id, i) => { r[id] = i + 1; });
      profilScores[profilId] = { s, r };
    }
    return { score: profilScores[profilId].s[sttId], rang: profilScores[profilId].r[sttId] };
  }
  window.ScoutApp = {
    D, STT, IDS, PROFILE, state, zahl, esc, treffer, rahmen, scoreFuer, standortCheck, waehle,
    neuZeichnen: () => { zeichneListe(); zeichneSteckbrief(); },
    setzeAngebote: (features) => { angebotsPunkte = features; if (bereit) map.getSource('angebote').setData({ type: 'FeatureCollection', features }); },
    fliegeZu: (lon, lat, zoom) => {
      if (!map) return;
      const ziel = { center: [lon, lat], zoom, pitch: 60, bearing: -18, padding: rand(), duration: 2400 };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ziel.duration = 0;
      ladeKacheln({ lng: lon, lat }, zoom);
      map.flyTo(ziel);
    },
  };

  /* ---------------------------------------------------------- Start */
  zeichneProfile();
  zeichneRegler();
  zeichneMethodik();
  rechne();
  zeichneListe();
  waehle(reihenfolge[0], null);
  // Beschriftungen neu zeichnen, sobald die Schrift geladen ist.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (bereit) themaGewechselt(); else if (map) map.once('load', themaGewechselt); });
})();
