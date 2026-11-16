#!/usr/bin/env python3
"""Standort-Scout Münster – 3D-Karte.

Baut aus amtlichen Geodaten die Kartengrundlage der Web-App:

  * 3D-Gebäudemodell LoD2 (Geobasis NRW): Dachflächen jedes Gebäudes mit Höhen
  * Tatsächliche Nutzung aus dem Liegenschaftskataster (Stadt Münster):
    Straßen, Wege, Gewässer, Wald, Grün, Siedlungsflächen
  * Baumkataster und Straßenverzeichnis (Stadt Münster)

Ergebnis: docs/geo/ – ein Übersichtsdatensatz (index.js) plus Kacheln von 2 × 2 km, die die
App beim Hineinzoomen nachlädt. Die Kacheln sind kompakte Binärdaten (Base64 in
.js-Dateien), damit die App auch per Doppelklick ohne Server läuft.

Aufruf:  python pipeline/build_map3d.py            (lädt fehlende Rohdaten, ca. 3 GB)
         python pipeline/build_map3d.py --offline
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import re
import struct
import sys
import time
import urllib.request
import warnings
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "docs" / "geo"
UA = "standort-scout-prototype/0.1"

CHUNK = 2000          # Kachelgröße in Metern (UTM)
Q = 0.1               # Lage-Auflösung in Web-Mercator-Metern (≈ 6 cm am Boden)
QZ = 0.05             # Höhen-Auflösung in Metern
HALF = 3276.0         # halbe Kantenlänge des 16-Bit-Wertebereichs in Mercator-Metern
UTM, MERC = 25832, 3857
TO_MERC = Transformer.from_crs(UTM, MERC, always_xy=True)
TO_LL = Transformer.from_crs(UTM, 4326, always_xy=True)

NRW = "https://www.opengeodata.nrw.de/produkte/geobasis/3dg/lod2_gml/lod2_gml"
OWS = "https://www.stadt-muenster.de/ows/mapserv706"
SOURCES = {
    "nutzungen.geojson": f"{OWS}/odalkisserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAME=ms:nutzungen"
                         "&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=200000&SRSNAME=EPSG:25832",
    "baeume.geojson": "https://geo.stadt-muenster.de/mapserv/odgruen_serv?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
                      "&TYPENAME=Baeume&OUTPUTFORMAT=geojson",
    "strassen.geojson": f"{OWS}/odstrasseserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAME=ms:Strassen"
                        "&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=5000&SRSNAME=EPSG:4326",
    "stadtteile.geojson": "https://opendata.stadt-muenster.de/sites/default/files/stadtteile-statistische-bezirke-muenster.geojson",
}

# Nutzungsarten des Liegenschaftskatasters -> Kartenklasse (Reihenfolge = Zeichenreihenfolge)
KLASSEN = ["acker", "gruenland", "natur", "wald", "park", "wohnen", "misch", "gewerbe", "sonst", "wasser", "weg", "bahn", "strasse"]
NUTZUNG = {
    "AX_Landwirtschaft": "acker", "AX_Wald": "wald", "AX_Gehoelz": "natur", "AX_Heide": "natur", "AX_Sumpf": "natur",
    "AX_SportFreizeitUndErholungsflaeche": "park", "AX_Friedhof": "park",
    "AX_Wohnbauflaeche": "wohnen", "AX_FlaecheGemischterNutzung": "misch", "AX_FlaecheBesondererFunktionalerPraegung": "misch",
    "AX_IndustrieUndGewerbeflaeche": "gewerbe",
    "AX_Strassenverkehr": "strasse", "AX_Platz": "strasse", "AX_Weg": "weg", "AX_Bahnverkehr": "bahn",
    "AX_Fliessgewaesser": "wasser", "AX_StehendesGewaesser": "wasser", "AX_Hafenbecken": "wasser",
    "AX_UnlandVegetationsloseFlaeche": "sonst", "AX_Schiffsverkehr": "sonst", "AX_Flugverkehr": "sonst",
}


# ---------------------------------------------------------------- Download

def download(url: str, target: Path) -> None:
    if target.exists() and target.stat().st_size > 0:
        return
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = resp.read()
            target.write_bytes(data)
            return
        except Exception as exc:  # noqa: BLE001 – Netzfehler: erneut versuchen
            if attempt == 3:
                sys.exit(f"Download fehlgeschlagen: {url}\n{exc}")
            time.sleep(3 * (attempt + 1))


def lod2_tiles(city) -> list[str]:
    """Namen der 1-km-Kacheln des LoD2-Modells, die das Stadtgebiet berühren."""
    minx, miny, maxx, maxy = city.bounds
    names = []
    for e in range(int(minx // 1000), int(maxx // 1000) + 1):
        for n in range(int(miny // 1000), int(maxy // 1000) + 1):
            if shapely.box(e * 1000, n * 1000, e * 1000 + 1000, n * 1000 + 1000).intersects(city):
                names.append(f"LoD2_32_{e}_{n}_1_NW.gml")
    return names


def fetch(offline: bool, tiles: list[str]) -> None:
    (RAW / "lod2").mkdir(parents=True, exist_ok=True)
    jobs = [(url, RAW / name) for name, url in SOURCES.items()]
    jobs += [(f"{NRW}/{name}", RAW / "lod2" / name) for name in tiles]
    missing = [(u, t) for u, t in jobs if not (t.exists() and t.stat().st_size > 0)]
    if missing and offline:
        sys.exit(f"{len(missing)} Rohdateien fehlen, z. B. {missing[0][1]} (ohne --offline erneut starten)")
    if missing:
        print(f"lade {len(missing)} Dateien …")
        with ThreadPoolExecutor(4) as pool:
            list(pool.map(lambda job: download(*job), missing))


# ---------------------------------------------------------------- Kacheln

def chunk_origin(cx: int, cy: int) -> tuple[float, float]:
    """Mercator-Ursprung der 16-Bit-Koordinaten einer Kachel (um den Kachelmittelpunkt zentriert)."""
    mx, my = TO_MERC.transform(cx * CHUNK + CHUNK / 2, cy * CHUNK + CHUNK / 2)
    return round(mx - HALF), round(my - HALF)


def quantize(xy: np.ndarray, origin: tuple[float, float]) -> np.ndarray:
    q = np.rint((xy - np.array(origin)) / Q)
    return np.clip(q, 0, 65535).astype("<u2")


def chunk_bbox(cx: int, cy: int) -> list[float]:
    xs = [cx * CHUNK, cx * CHUNK + CHUNK]
    ys = [cy * CHUNK, cy * CHUNK + CHUNK]
    lon, lat = TO_LL.transform([xs[0], xs[1], xs[0], xs[1]], [ys[0], ys[0], ys[1], ys[1]])
    return [round(min(lon), 5), round(min(lat), 5), round(max(lon), 5), round(max(lat), 5)]


def write_chunk(kind: str, key: tuple[int, int], payload: bytes) -> int:
    cx, cy = key
    ox, oy = chunk_origin(cx, cy)
    b64 = base64.b64encode(payload).decode("ascii")
    line = f'window.SCOUT_GEO&&window.SCOUT_GEO("{kind}","{cx}_{cy}",{ox},{oy},"{b64}");\n'
    # Eine Datei je Kachel; Gebäude, Flächen und Bäume stehen als eigene Zeilen darin.
    with open(OUT / f"g_{cx}_{cy}.js", "a", encoding="ascii") as fh:
        fh.write(line)
    return len(line)


# ---------------------------------------------------------------- Gebäude (LoD2)

RE_MEMBER = re.compile(r"<core:cityObjectMember>(.*?)</core:cityObjectMember>", re.S)
RE_FUNC = re.compile(r"<bldg:function>(\d+)_(\d+)")
RE_ROOF = re.compile(r"<bldg:RoofSurface.*?</bldg:RoofSurface>", re.S)
RE_GROUND = re.compile(r"<bldg:GroundSurface.*?</bldg:GroundSurface>", re.S)
RE_EXT = re.compile(r"<gml:exterior>.*?<gml:posList[^>]*>([^<]+)</gml:posList>", re.S)
RE_POS = re.compile(r"<gml:posList[^>]*>([^<]+)</gml:posList>")


def building_class(katalog: str, code: int) -> int:
    """0 Wohnen · 1 Gewerbe · 2 öffentlich · 3 Nebengebäude (Garage, Schuppen, Überdachung)."""
    if katalog != "31001":
        return 3
    if code in (1313, 2460, 2461, 2462, 2463, 2464, 2465, 2523, 2721, 2723, 2724, 2726, 2740, 2741, 2742):
        return 3
    if code < 2000:
        return 0
    if code < 3000:
        return 1
    return 2


def parse_tile(path: str) -> dict:
    """Liest eine CityGML-Kachel und liefert je 2-km-Kachel die gepackten Dachflächen."""
    text = Path(path).read_text(encoding="utf-8")
    buildings = []  # (klasse, z0, [ndarray (n,3)])
    for member in RE_MEMBER.findall(text):
        if "<bldg:Building" not in member:
            continue
        func = RE_FUNC.search(member)
        cls = building_class(func.group(1), int(func.group(2))) if func else 0
        ground = [np.array(p.split(), dtype=float).reshape(-1, 3)[:, 2].min() for g in RE_GROUND.findall(member) for p in RE_POS.findall(g)]
        polys = []
        for roof in RE_ROOF.findall(member):
            for pos in RE_EXT.findall(roof):
                pts = np.array(pos.split(), dtype=float).reshape(-1, 3)[:-1]  # Schlusspunkt weglassen
                if len(pts) >= 3:
                    polys.append(pts)
        if not polys:
            continue
        z0 = min(ground) if ground else min(p[:, 2].min() for p in polys) - 2.5
        buildings.append((cls, z0, polys))
    if not buildings:
        return {}

    flat = np.vstack([p for _, _, polys in buildings for p in polys])
    mx, my = TO_MERC.transform(flat[:, 0], flat[:, 1])
    merc = np.column_stack([mx, my])
    out: dict[tuple[int, int], list[bytes]] = defaultdict(list)
    counts: dict[tuple[int, int], int] = defaultdict(int)
    i = 0
    for cls, z0, polys in buildings:
        key = (int(polys[0][0, 0] // CHUNK), int(polys[0][0, 1] // CHUNK))
        origin = chunk_origin(*key)
        packed = []
        for p in polys:
            n = len(p)
            xy = quantize(merc[i:i + n], origin)
            z = np.clip(np.rint((p[:, 2] - z0) / QZ), 0, 65535).astype("<u2")
            i += n
            if n > 255:  # sehr feine Rundungen ausdünnen
                keep = np.linspace(0, n - 1, 255).astype(int)
                xy, z, n = xy[keep], z[keep], 255
            packed.append(struct.pack("<B", n) + np.column_stack([xy, z]).astype("<u2").tobytes())
        for start in range(0, len(packed), 255):
            part = packed[start:start + 255]
            out[key].append(struct.pack("<BB", cls, len(part)) + b"".join(part))
        counts[key] += 1
    return {k: (b"".join(v), counts[k]) for k, v in out.items()}


def build_buildings(tiles: list[str]) -> dict:
    paths = [str(RAW / "lod2" / t) for t in tiles]
    merged: dict[tuple[int, int], list[bytes]] = defaultdict(list)
    total = 0
    with ProcessPoolExecutor(4) as pool:
        for done, result in enumerate(pool.map(parse_tile, paths, chunksize=4), 1):
            for key, (payload, n) in result.items():
                merged[key].append(payload)
                total += n
            if done % 60 == 0:
                print(f"  Gebäude: {done}/{len(paths)} Kacheln gelesen")
    index = {}
    size = 0
    for key, parts in sorted(merged.items()):
        size += write_chunk("b", key, b"".join(parts))
        index[f"{key[0]}_{key[1]}"] = chunk_bbox(*key)
    print(f"Gebäude: {total} Gebäude in {len(index)} Kacheln, {size / 1e6:.1f} MB")
    return index


# ---------------------------------------------------------------- Flächennutzung

def polygons_of(geom):
    return [p for p in shapely.get_parts(geom) if p.geom_type == "Polygon" and not p.is_empty and p.area > 1]


def pack_polygons(rows, origin) -> bytes:
    """rows: (klasse, Polygon in UTM). Format je Fläche: u8 Klasse, u8 Ringe, je Ring u16 Punkte + u16-Paare."""
    out = []
    for cls, poly in rows:
        rings = [poly.exterior] + list(poly.interiors)[:254]
        body = []
        for ring in rings:
            xy = np.asarray(ring.coords)[:-1]
            if len(xy) < 3:
                continue
            mx, my = TO_MERC.transform(xy[:, 0], xy[:, 1])
            q = quantize(np.column_stack([mx, my]), origin)
            body.append(struct.pack("<H", len(q)) + q.tobytes())
        if body:
            out.append(struct.pack("<BB", cls, len(body)) + b"".join(body))
    return b"".join(out)


def build_landuse(city) -> tuple[dict, dict]:
    g = gpd.read_file(RAW / "nutzungen.geojson")
    g["klasse"] = g["bezeichnung"].map(NUTZUNG).fillna("sonst")
    g.loc[(g["klasse"] == "acker") & g["veg"].astype(str).isin(["1020", "1021"]), "klasse"] = "gruenland"
    g["geometry"] = g.geometry.make_valid()
    g = g[["klasse", "geometry"]]

    # Übersicht: je Klasse verschmolzen und vereinfacht, für die Ansicht der ganzen Stadt
    overview = {}
    for klasse, tol, min_area in (("wasser", 4, 400), ("wald", 8, 2500), ("natur", 8, 5000), ("park", 6, 2500),
                                  ("wohnen", 6, 1500), ("misch", 6, 1500), ("gewerbe", 6, 1500),
                                  ("strasse", 1.5, 300), ("bahn", 2, 300)):
        merged = g[g["klasse"] == klasse].geometry.union_all().simplify(tol, preserve_topology=True)
        parts = [p for p in polygons_of(merged) if p.area >= min_area]
        ll = gpd.GeoSeries(parts, crs=UTM).to_crs(4326)
        geoms = [x for x in shapely.set_precision(ll.values, 1e-5) if not x.is_empty]
        overview[klasse] = shapely.geometry.mapping(shapely.MultiPolygon([p for x in geoms for p in polygons_of_ll(x)]))

    # Detail: je 2-km-Kachel ausgeschnitten, gleiche Klassen verschmolzen
    minx, miny, maxx, maxy = city.bounds
    index, size, count = {}, 0, 0
    sindex = g.sindex
    for cx in range(int(minx // CHUNK), int(maxx // CHUNK) + 1):
        for cy in range(int(miny // CHUNK), int(maxy // CHUNK) + 1):
            box = shapely.box(cx * CHUNK, cy * CHUNK, cx * CHUNK + CHUNK, cy * CHUNK + CHUNK)
            sub = g.iloc[sindex.query(box, predicate="intersects")]
            if sub.empty:
                continue
            rows = []
            for ci, klasse in enumerate(KLASSEN):
                geoms = sub[sub["klasse"] == klasse].geometry
                if geoms.empty:
                    continue
                merged = shapely.intersection(geoms.union_all(), box).simplify(0.3, preserve_topology=True)
                rows += [(ci, p) for p in polygons_of(merged)]
            if not rows:
                continue
            size += write_chunk("n", (cx, cy), pack_polygons(rows, chunk_origin(cx, cy)))
            index[f"{cx}_{cy}"] = chunk_bbox(cx, cy)
            count += len(rows)
    print(f"Flächennutzung: {count} Flächen in {len(index)} Kacheln, {size / 1e6:.1f} MB")
    return index, overview


def polygons_of_ll(geom):
    return [p for p in shapely.get_parts(geom) if p.geom_type == "Polygon" and not p.is_empty]


# ---------------------------------------------------------------- Bäume, Straßennamen

def build_trees() -> dict:
    t = gpd.read_file(RAW / "baeume.geojson")
    if t.crs is None:
        t = t.set_crs(4326)
    t = t.to_crs(UTM)
    t = t[~t.geometry.is_empty & t.geometry.notna()]
    x, y = t.geometry.x.to_numpy(), t.geometry.y.to_numpy()
    mx, my = TO_MERC.transform(x, y)
    keys = np.column_stack([x // CHUNK, y // CHUNK]).astype(int)
    index, size = {}, 0
    for key in sorted({tuple(k) for k in keys}):
        sel = (keys[:, 0] == key[0]) & (keys[:, 1] == key[1])
        q = quantize(np.column_stack([mx[sel], my[sel]]), chunk_origin(*key))
        size += write_chunk("t", key, q.tobytes())
        index[f"{key[0]}_{key[1]}"] = chunk_bbox(*key)
    print(f"Bäume: {len(t)} Bäume in {len(index)} Kacheln, {size / 1e6:.1f} MB")
    return index


def build_streets() -> list:
    s = gpd.read_file(RAW / "strassen.geojson")
    s = s[~s.geometry.is_empty & s.geometry.notna()]
    return [[row["NAME"], round(row.geometry.x, 5), round(row.geometry.y, 5)] for _, row in s.iterrows() if row["NAME"]]


# ---------------------------------------------------------------- Start

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="keine Downloads, nur vorhandene Rohdaten verwenden")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    download(SOURCES["stadtteile.geojson"], RAW / "stadtteile.geojson") if not args.offline else None
    city = gpd.read_file(RAW / "stadtteile.geojson").to_crs(UTM).geometry.union_all()
    tiles = lod2_tiles(city)
    fetch(args.offline, tiles)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.js"):
        old.unlink()

    index = {"b": build_buildings(tiles)}
    index["n"], overview = build_landuse(city)
    index["t"] = build_trees()
    lat0 = TO_LL.transform(*city.centroid.coords[0])[1]
    kacheln = {}
    for kind in index.values():
        kacheln.update(kind)
    meta = {"q": Q, "qz": QZ, "klassen": KLASSEN, "lat": round(lat0, 4), "kacheln": kacheln}
    payload = {"meta": meta, "uebersicht": overview, "strassen": build_streets()}
    target = OUT / "index.js"
    target.write_text("window.SCOUT_MAP=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in OUT.glob("*.js"))
    print(f"geschrieben {OUT.relative_to(ROOT)}/  ({len(list(OUT.glob('*.js')))} Dateien, {total / 1e6:.1f} MB, index.js {target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
