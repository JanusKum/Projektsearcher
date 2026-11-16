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
  const map = L.map('map', { zoomSnap: 0.25, minZoom: 10, maxZoom: 18, attributionControl: true });
  map.attributionControl.setPrefix('');
  map.zoomControl.setPosition('topright');
  map.attributionControl.addAttribution('Daten: Stadt Münster, Gutachterausschuss Münster, Stadtwerke Münster (dl-de/by-2-0)');
  ['flaeche', 'zonen', 'recht', 'verfahren', 'auswahl'].forEach((name, i) => { map.createPane(name).style.zIndex = 410 + i * 10; });
  map.getPane('auswahl').style.pointerEvents = 'none';

  // Hintergrundkarte: nur wenn die Kacheln geladen werden dürfen (sonst reicht die Flächenkarte).
  let kachelnDa = false, kachelFehler = 0;
  const kacheln = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap-Mitwirkende' });
  kacheln.on('tileload', () => { if (!kachelnDa) { kachelnDa = true; zeichneFlaechen(); } });
  kacheln.on('tileerror', () => { if (!kachelnDa && ++kachelFehler >= 3) map.removeLayer(kacheln); });
  kacheln.addTo(map);

  const tipp = { sticky: true, className: 'tipp', direction: 'top', offset: [0, -6], opacity: 1 };
  const stadtteilLayer = L.geoJSON(D.stadtteile, { pane: 'flaeche' }).addTo(map);
  stadtteilLayer.eachLayer((l) => {
    const id = l.feature.properties.id;
    l.bindTooltip(() => tippStadtteil(id), tipp);
    l.on('mouseover', () => markiereZeile(id, true));
    l.on('mouseout', () => markiereZeile(id, false));
  });
  const zonenBauland = { type: 'FeatureCollection', features: D.zonen.features.filter((f) => f.properties.gruppe !== 'sonst') };
  const zonenLayer = L.geoJSON(zonenBauland, { pane: 'zonen' });
  zonenLayer.eachLayer((l) => {
    const p = l.feature.properties;
    l.bindTooltip(`<b>${esc(p.nuta_text)}</b><br><span>${zahl(p.brw, 0)} €/m² · Zone ${esc(p.nr)}, ${esc(p.ort)}</span>`, tipp);
  });
  const rechtLayer = L.geoJSON(D.bplan_recht, { pane: 'recht' });
  rechtLayer.eachLayer((l) => {
    const p = l.feature.properties;
    l.bindTooltip(`<b>B-Plan ${esc(p.plannr)}</b>${p.jahr ? ' · seit ' + p.jahr : ''}<br><span>${esc(p.name)}</span>`, tipp);
  });
  const verfahrenLayer = L.geoJSON(D.bplan_verfahren, { pane: 'verfahren' }).addTo(map);
  verfahrenLayer.eachLayer((l) => {
    const p = l.feature.properties;
    l.bindTooltip(`<b>B-Plan ${esc(p.plannr)} · im Verfahren</b><br><span>${esc(p.name)} · ${zahl(p.ha, 1)} ha</span>`, tipp);
  });
  const bahnLayer = L.layerGroup(D.bahn.map((b) => L.marker([b.lat, b.lon], {
    icon: L.divIcon({ className: 'bahnhof', iconSize: [10, 10] }), keyboard: false,
  }).bindTooltip(`<b>${esc(b.name)}</b><br><span>Bahnhof / Haltepunkt</span>`, Object.assign({}, tipp, { sticky: false })))).addTo(map);
  const namenLayer = L.layerGroup(IDS.map((id) => {
    const p = STT[id].properties;
    const m = L.marker([p.lat, p.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="ortsname">${esc(p.name)}</div>` }) });
    m.sid = id;
    return m;
  })).addTo(map);
  // Auswahl: helle Unterlage plus dunkle Linie, damit der Umriss auf jeder Farbstufe sichtbar bleibt.
  const auswahlRand = L.geoJSON(null, { pane: 'auswahl', interactive: false }).addTo(map);
  const auswahlLayer = L.geoJSON(null, { pane: 'auswahl', interactive: false }).addTo(map);
  let punktMarker = null;

  function zeigeNamen() {
    namenLayer.eachLayer((m) => {
      if (!m.getElement()) return;
      const b = STT[m.sid].bbox;
      const a = map.latLngToContainerPoint([b[1], b[0]]), c = map.latLngToContainerPoint([b[3], b[2]]);
      const passt = Math.abs(c.x - a.x) > m.getElement().firstChild.offsetWidth + 14 && Math.abs(c.y - a.y) > 30;
      m.getElement().style.visibility = passt ? 'visible' : 'hidden';
    });
  }
  map.on('zoomend', zeigeNamen);
  // Breite Karte: Platz für das Ebenen-Feld links freihalten.
  const breit = $('map').clientWidth > 720 && $('map').clientHeight >= 520;
  map.fitBounds(stadtteilLayer.getBounds(), { paddingTopLeft: [breit ? 250 : 10, 10], paddingBottomRight: [10, 10] });

  /* ---------------------------------------------------------- Einfärbung */
  let klassen = null; // { grenzen: [..], werteVon(feature) }
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
    const linie = css('--ink-2'), deck = kachelnDa ? 0.72 : 0.94;
    if (zonenModus) {
      if (!map.hasLayer(zonenLayer)) zonenLayer.addTo(map);
      const q = quantile(zonenBauland.features.map((f) => f.properties.brw), 5);
      const n = q.grenzen.length + 1;
      zonenLayer.setStyle((f) => ({ fillColor: farbeFuer(klasse(f.properties.brw, q.grenzen), n), fillOpacity: deck, color: css('--surface'), weight: 0.7 }));
      stadtteilLayer.setStyle({ fillOpacity: 0, color: linie, weight: 1.2 });
      legende('Bodenrichtwert ' + STAND.brw, '€/m²', 0, q, 'Baureifes Land für Wohnen, Mischnutzung und Gewerbe. Außenbereich und Sonderflächen sind nicht eingefärbt.');
    } else {
      if (map.hasLayer(zonenLayer)) map.removeLayer(zonenLayer);
      const key = state.farbe;
      const von = (id) => (key === 'score' ? score[id] : D.werte[id][key]);
      const q = quantile(IDS.map(von), 5);
      const n = q.grenzen.length + 1;
      stadtteilLayer.setStyle((f) => {
        const v = von(f.properties.id);
        return { fillColor: v == null ? css('--nodata') : farbeFuer(klasse(v, q.grenzen), n), fillOpacity: deck, color: css('--surface'), weight: 1.2 };
      });
      if (key === 'score') legende('Score ' + state.profil.label, 'Punkte', 0, q, 'Die oberste Stufe steht für die am besten geeigneten Stadtteile. 100 Punkte hieße: in jedem Kriterium der beste.');
      else legende(IND[key].label, IND[key].unit, IND[key].digits, q, IND[key].desc, IDS.some((id) => von(id) == null));
    }
    verfahrenLayer.setStyle({ color: css('--plan'), weight: 2.2, dashArray: '6 5', fillColor: css('--plan'), fillOpacity: 0.12 });
    rechtLayer.setStyle({ color: css('--ink-2'), weight: 1, fillOpacity: 0.04, fillColor: css('--ink-2') });
    auswahlRand.setStyle({ color: css('--surface'), weight: 6.5, fill: false });
    auswahlLayer.setStyle({ color: css('--ink'), weight: 2.5, fill: false });
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
    $('rolle').setAttribute('aria-labelledby', 'tab-' + state.reiter);
    if (state.reiter === 'stadtteile') {
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
  function markiereZeile(id, an) {
    const el = $('rolle').querySelector(`.zeile[data-id="${id}"]`);
    if (el) el.classList.toggle('hover', an);
  }
  $('rolle').addEventListener('click', (e) => {
    const z = e.target.closest('.zeile');
    if (!z) return;
    if (z.dataset.id) {
      waehle(z.dataset.id, null);
      map.flyToBounds(L.geoJSON(STT[z.dataset.id]).getBounds(), { padding: [60, 60], maxZoom: 14, duration: 0.6 });
    } else {
      const f = D.bplan_verfahren.features.find((x) => x.properties.plannr === z.dataset.plan);
      $('l-verfahren').checked = true; schalteEbenen();
      const b = L.geoJSON(f).getBounds(), c = b.getCenter();
      map.flyToBounds(b, { padding: [80, 80], maxZoom: 16, duration: 0.6 });
      waehle(f.properties.stt, { lat: c.lat, lng: c.lng });
    }
    if (window.matchMedia('(max-width: 760px)').matches) document.querySelector('.karte').scrollIntoView({ behavior: 'smooth' });
  });
  $('rolle').addEventListener('mouseover', (e) => { const z = e.target.closest('.zeile[data-id]'); hebeHervor(z ? z.dataset.id : null); });
  $('rolle').addEventListener('mouseleave', () => hebeHervor(null));
  let hervor = null;
  function hebeHervor(id) {
    if (hervor === id) return;
    hervor = id;
    stadtteilLayer.eachLayer((l) => l.setStyle({ weight: l.feature.properties.id === id ? 3 : 1.2, color: l.feature.properties.id === id ? css('--ink') : (state.farbe === 'zonen' ? css('--ink-2') : css('--surface')) }));
  }
  ['stadtteile', 'plaene'].forEach((r) => $('tab-' + r).addEventListener('click', () => { state.reiter = r; zeichneListe(); }));

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
  function standortCheck(pt) {
    const x = pt.lng, y = pt.lat;
    const zonen = treffer(D.zonen, x, y).map((f) => f.properties)
      .sort((a, b) => (a.gruppe === 'sonst') - (b.gruppe === 'sonst') || (a.asb ? 1 : 0) - (b.asb ? 1 : 0) || b.brw - a.brw);
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
    if (!id) {
      el.innerHTML = '<div class="abschnitt"><h3>Kein Stadtteil gewählt</h3><p class="lead">Wählen Sie einen Stadtteil in der Liste oder klicken Sie in die Karte. Ein Klick zeigt auch Bodenrichtwert und Baurecht genau an dieser Stelle.</p></div>';
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
    state.auswahl = id;
    state.punkt = punkt;
    auswahlRand.clearLayers();
    auswahlLayer.clearLayers();
    if (id) { auswahlRand.addData(STT[id]); auswahlLayer.addData(STT[id]); }
    if (punktMarker) { map.removeLayer(punktMarker); punktMarker = null; }
    if (punkt) punktMarker = L.circleMarker(punkt, { radius: 7, color: css('--surface'), weight: 2, fillColor: css('--plan'), fillOpacity: 1, interactive: false }).addTo(map);
    zeichneFlaechen();
    $('rolle').querySelectorAll('.zeile[data-id]').forEach((z) => z.setAttribute('aria-current', z.dataset.id === id));
    zeichneSteckbrief();
  }
  map.on('click', (e) => {
    const s = treffer(D.stadtteile, e.latlng.lng, e.latlng.lat)[0];
    if (!s) return;
    waehle(s.properties.id, { lat: e.latlng.lat, lng: e.latlng.lng });
    const z = $('rolle').querySelector('.zeile[aria-current="true"]');
    if (z && !window.matchMedia('(max-width: 760px)').matches) z.scrollIntoView({ block: 'nearest' });
  });

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
  function schalteEbenen() {
    [['l-verfahren', verfahrenLayer], ['l-recht', rechtLayer], ['l-bahn', bahnLayer]].forEach(([id, layer]) => {
      if ($(id).checked && !map.hasLayer(layer)) layer.addTo(map);
      if (!$(id).checked && map.hasLayer(layer)) map.removeLayer(layer);
    });
    zeichneFlaechen();
  }
  ['l-verfahren', 'l-recht', 'l-bahn'].forEach((id) => $(id).addEventListener('change', schalteEbenen));
  if ($('map').clientHeight < 520 || window.matchMedia('(max-width: 760px)').matches) $('ebenen').open = false;

  function zeichneMethodik() {
    const quellen = Array.from(new Set(D.indikatoren.map((i) => i.src)));
    $('methodik-inhalt').innerHTML = `
      <p><b>Bewertung.</b> Jede Kennzahl wird in einen Prozentrang von 0 bis 100 unter den 45 Stadtteilen umgerechnet (100 = bester Stadtteil, je nach Kennzahl der höchste oder der niedrigste Wert). Der Score ist der gewichtete Mittelwert dieser Ränge. Fehlt ein Wert, zählt das Kriterium für diesen Stadtteil nicht mit.</p>
      <p><b>Bodenrichtwerte.</b> Auf dem Bauland liegt ein Raster aus 50-m-Messpunkten. An jedem Punkt wird der Richtwert der Jahre ${D.meta.brw_jahre[0]} bis ${STAND.brw} abgelesen. Die Preisentwicklung vergleicht nur Punkte, die in beiden Jahren einen Wert haben. Außenbereichszonen bleiben außen vor. 2022 wurden die Zonen neu zugeschnitten, ein Teil des Sprungs in diesem Jahr kann darauf zurückgehen.</p>
      <p><b>Erreichbarkeit.</b> Mittlere Luftlinie von denselben Messpunkten zur nächsten Kita, Grundschule, Bushaltestelle und zum nächsten Bahnhof. Luftlinie ist kürzer als der tatsächliche Weg.</p>
      <p><b>Grenzen.</b> Ein Bodenrichtwert ist ein Durchschnittswert für eine Zone und kein Kaufpreis für ein einzelnes Grundstück. Bebauungspläne im Verfahren sind nicht alle Neubaugebiete, manche überplanen den Bestand. Mieten, Kaufpreise und Autobahnanschlüsse fehlen noch. Der Score ersetzt keine Ankaufsprüfung.</p>
      <p><b>Quellen</b> (Datenlizenz Deutschland – Namensnennung 2.0, abgerufen ${D.meta.erstellt.split('-').reverse().join('.')}):</p>
      <ul>${quellen.map((q) => `<li>${esc(q)}</li>`).join('')}<li>Stadtteilgrenzen (statistische Bezirke), Stadt Münster</li></ul>
      <p>Alle Daten stammen aus dem <a href="https://opendata.stadt-muenster.de" target="_blank" rel="noopener">Open-Data-Portal der Stadt Münster</a>.</p>`;
  }

  function allesNeu() {
    rechne();
    zeichneListe();
    zeichneFlaechen();
    zeichneSteckbrief();
  }

  // Farben folgen dem Theme: bei Wechsel neu einfärben.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', zeichneFlaechen);
  new MutationObserver(zeichneFlaechen).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(() => { map.invalidateSize(); zeigeNamen(); }).observe($('map'));

  /* ---------------------------------------------------------- Start */
  zeichneProfile();
  zeichneRegler();
  zeichneMethodik();
  rechne();
  zeichneListe();
  waehle(reihenfolge[0], null);
  zeigeNamen();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(zeigeNamen);
})();
