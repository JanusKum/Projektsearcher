#!/usr/bin/env python3
"""Standort-Scout Münster – Datenaufbereitung.

Lädt offene Daten der Stadt Münster (Open-Data-Portal, Geoportal,
Gutachterausschuss) und verdichtet sie je Stadtteil (45 statistische Bezirke)
zu Kennzahlen. Ergebnis: docs/data.js, das die Web-App direkt einliest.

Aufruf:  python pipeline/build_data.py            (lädt fehlende Rohdaten nach)
         python pipeline/build_data.py --offline  (nur vorhandene Rohdaten)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.request
import warnings
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
import shapely.ops
from scipy.spatial import cKDTree
from shapely.geometry import Point

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "docs" / "data.js"
UTM = 25832  # ETRS89 / UTM 32N – metrische Rechnungen
UA = "standort-scout-prototype/0.1"

OD = "https://opendata.stadt-muenster.de/sites/default/files"
SMS = "https://www.stadt-muenster.de/fileadmin/user_upload/stadt-muenster/61_stadtentwicklung/pdf/sms/05515000_csv_"
OWS = "https://www.stadt-muenster.de/ows"
BPLAN = ("https://geo.stadt-muenster.de/mapserv/bplan_serv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0"
         "&TYPENAME=ms:{layer}&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=10000&SRSNAME=EPSG:4326")

BRW_YEARS = list(range(2016, 2027))


def brw_url(year: int) -> str:
    if year <= 2023:
        return (f"{OWS}/mapserv621/odrichtw_{year}serv?REQUEST=GetFeature&SERVICE=WFS&VERSION=1.0.0"
                f"&TYPENAME=richtw{year}&OUTPUTFORMAT=SHAPEZIP&EXCEPTIONS=XML")
    return (f"{OWS}/mapserv621/odrichtw_{year}serv?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
            f"&TYPENAME=richtw{year}&outputFormat=SHAPEZIP")


SOURCES = {
    "stadtteile.geojson": f"{OD}/stadtteile-statistische-bezirke-muenster.geojson",
    "prognose.csv": f"{OD}/KBP_2025_2035_utf8.csv",
    "bevoelkerungsentwicklung_altersgruppen.csv": f"{SMS}bevoelkerungsentwicklung_altersgruppen.csv",
    "bevoelkerungsbewegungen_saldiert.csv": f"{SMS}bevoelkerungsbewegungen_saldiert.csv",
    "indikatoren_haushalte.csv": f"{SMS}indikatoren_haushalte.csv",
    "indikatoren_erwerbstaetigkeit.csv": f"{SMS}indikatoren_erwerbstaetigkeit.csv",
    "wohnbautaetigkeit.csv": f"{SMS}wohnbautaetigkeit.csv",
    "schulen.geojson": (f"{OWS}/mapserv706/schulenserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0"
                        "&TYPENAME=ms:schulen&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=1000&SRSNAME=EPSG:4326"),
    "kitas.geojson": (f"{OWS}/mapserv706/kitaserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0"
                      "&TYPENAME=ms:kitas01&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=1000&SRSNAME=EPSG:4326"),
    "haltestellen.geojson": "https://raw.githubusercontent.com/od-ms/converter-scripts/master/stadtwerke/data/haltestellen.geojson",
    "bplan_verfahren.geojson": BPLAN.format(layer="bplan1"),
    "bplan_rechtskraft.geojson": BPLAN.format(layer="bplan2"),
    **{f"brw_{y}.zip": brw_url(y) for y in BRW_YEARS},
}


# ---------------------------------------------------------------- Rohdaten

def fetch(offline: bool) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        target = RAW / name
        if target.exists() and target.stat().st_size > 0:
            continue
        if offline:
            sys.exit(f"Rohdatei fehlt: {target} (ohne --offline erneut starten)")
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=180) as resp:
                    target.write_bytes(resp.read())
                print(f"geladen  {name}")
                break
            except Exception as exc:  # noqa: BLE001 – Netzfehler: erneut versuchen
                if attempt == 3:
                    sys.exit(f"Download fehlgeschlagen: {url}\n{exc}")
                time.sleep(2 ** (attempt + 1))


def read_stat(name: str) -> pd.DataFrame:
    """Statistik-CSV der Stadt (ZEIT;RAUM;MERKMAL;WERT) mit Jahr und Stadtteil-Nr."""
    path = RAW / name
    for enc in ("utf-8-sig", "cp1252"):
        try:
            df = pd.read_csv(path, sep=";", encoding=enc, dtype=str)
            break
        except UnicodeDecodeError:
            continue
    df["WERT"] = pd.to_numeric(df["WERT"].str.strip().str.replace(",", "."), errors="coerce")
    df["jahr"] = df["ZEIT"].str.extract(r"(\d{4})\s*$|^(\d{4})").bfill(axis=1)[0].astype(int)
    nr = df["RAUM"].str.extract(r"^(\d{2})\s")[0]
    df["id"] = nr
    return df


def read_brw(year: int) -> gpd.GeoDataFrame:
    folder = RAW / f"brw_{year}"
    if not folder.exists():
        with zipfile.ZipFile(RAW / f"brw_{year}.zip") as zf:
            zf.extractall(folder)
    g = gpd.read_file(next(folder.glob("*.shp")))
    g = g.to_crs(UTM)
    g["brw"] = pd.to_numeric(g["BRW"].astype(str).str.replace(",", "."), errors="coerce")
    g["gruppe"] = g["NUTA"].map(NUTA_GRUPPE).fillna("sonst")
    g.loc[g["ENTW"] != "B", "gruppe"] = "sonst"  # nur baureifes Land zählt als Bauland
    # Außenbereichszonen (ERGNUTA = ASB) überdecken ganze Ortsteile und würden jeden
    # Mittelwert verzerren. 2020/2021 ist das Kennzeichen im Datensatz bei allen Zonen
    # gesetzt, dort hilft nur die Flächengröße.
    asb = g["ERGNUTA"].eq("ASB")
    if asb.mean() > 0.5:
        asb = g.area > 1e7
    g["asb"] = asb
    g.loc[asb, "gruppe"] = "sonst"
    g["geometry"] = g.geometry.make_valid()
    return g[g["brw"].notna()].reset_index(drop=True)


NUTA_GRUPPE = {"W": "wohnen", "MI": "misch", "MK": "misch", "MU": "misch", "GE": "gewerbe", "GI": "gewerbe"}
NUTA_TEXT = {
    "W": "Wohnbaufläche", "MI": "Mischgebiet", "MK": "Kerngebiet", "MU": "Urbanes Gebiet",
    "GE": "Gewerbegebiet", "GI": "Industriegebiet", "SO": "Sondergebiet", "SN": "Sondernutzung",
    "A": "Ackerland", "GR": "Grünland", "F": "Forst",
}


# ---------------------------------------------------------------- Helfer

def grid_points(geom, step: float) -> np.ndarray:
    """Rasterpunkte (x, y) im Abstand `step` Meter, die in der Geometrie liegen."""
    if geom.is_empty:
        return np.empty((0, 2))
    minx, miny, maxx, maxy = geom.bounds
    gx, gy = np.meshgrid(np.arange(minx + step / 2, maxx, step), np.arange(miny + step / 2, maxy, step))
    pts = shapely.points(gx.ravel(), gy.ravel())
    shapely.prepare(geom)
    pts = pts[shapely.contains(geom, pts)]
    return np.column_stack([shapely.get_x(pts), shapely.get_y(pts)])


def brw_at_points(pts: gpd.GeoDataFrame, zones: gpd.GeoDataFrame, gruppe: str) -> pd.Series:
    """Bodenrichtwert der Zone(n) einer Nutzungsgruppe an jedem Messpunkt."""
    z = zones[zones["gruppe"] == gruppe][["brw", "geometry"]]
    hit = gpd.sjoin(pts[["geometry"]], z, predicate="within", how="left")
    return hit.groupby(level=0)["brw"].mean()


def cagr(first: float, last: float, years: int) -> float | None:
    if not first or not last or first <= 0 or pd.isna(first) or pd.isna(last):
        return None
    return ((last / first) ** (1 / years) - 1) * 100


def pct(first: float, last: float) -> float | None:
    if not first or pd.isna(first) or pd.isna(last):
        return None
    return (last / first - 1) * 100


def rank_score(values: pd.Series, higher_is_better: bool) -> pd.Series:
    """Prozentrang 0–100 unter den Stadtteilen; 100 = bester Stadtteil."""
    r = values.rank(method="average", ascending=higher_is_better)
    n = values.notna().sum()
    return ((r - 1) / (n - 1) * 100).round(1)


def to_geojson(g: gpd.GeoDataFrame, props: list[str], tol: float) -> dict:
    g = g.copy()
    if tol:
        g["geometry"] = g.geometry.simplify(tol, preserve_topology=True)
    g = g[~g.geometry.is_empty].to_crs(4326)
    g["geometry"] = [polygons_only(x) for x in shapely.set_precision(g.geometry.values, 1e-5)]
    g = g[~g.geometry.is_empty & g.geometry.notna()]
    feats = []
    for _, row in g.iterrows():
        p = {}
        for k in props:
            v = row[k]
            if v is None or (isinstance(v, float) and np.isnan(v)):
                continue
            if isinstance(v, (np.integer,)):
                v = int(v)
            elif isinstance(v, (np.floating, float)):
                v = round(float(v), 5 if k in ("lat", "lon") else 2)
            p[k] = v
        feats.append({"type": "Feature", "properties": p, "geometry": shapely.geometry.mapping(row.geometry)})
    return {"type": "FeatureCollection", "features": feats}


def polygons_only(geom):
    """Nur Flächenanteile behalten (make_valid kann Linien und Punkte erzeugen)."""
    parts = [p for p in shapely.get_parts(geom) if p.geom_type == "Polygon" and not p.is_empty]
    if not parts:
        return shapely.Polygon()
    return parts[0] if len(parts) == 1 else shapely.MultiPolygon(parts)


def label_point(geom):
    """Punkt mit größtem Randabstand in der größten Teilfläche – Ankerpunkt für die Beschriftung."""
    biggest = max(shapely.get_parts(geom), key=lambda p: p.area)
    return shapely.ops.polylabel(biggest, tolerance=20)


def num(v, digits=1):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return round(float(v), digits)


# ---------------------------------------------------------------- Aufbau

def build() -> dict:
    # --- Stadtteile -------------------------------------------------------
    stt = gpd.read_file(RAW / "stadtteile.geojson").to_crs(UTM)
    stt["id"] = stt["NR_STATIST"].astype(str).str.zfill(2)
    stt["name"] = stt["NAME_STATI"]
    stt["bezirk"] = stt["STADTBEZIR"].str.replace(r"^\d+\s+", "", regex=True)
    stt["geometry"] = stt.geometry.make_valid()
    stt = stt.sort_values("id").reset_index(drop=True)
    stt["flaeche_ha"] = stt.area / 1e4
    city = stt.geometry.union_all()
    ids = list(stt["id"])
    val = pd.DataFrame(index=ids)
    series: dict[str, dict] = {i: {} for i in ids}

    # --- Bodenrichtwerte 2016–2026 ---------------------------------------
    # Verfahren: 50-m-Messpunkte auf dem heutigen Bauland. An jedem Punkt wird für jedes
    # Jahr der Richtwert der dort geltenden Zone abgelesen. Verglichen werden nur Punkte,
    # die im Anfangs- und im Endjahr einen Wert haben – so verfälschen neu zugeschnittene
    # Zonen die Preisentwicklung nicht.
    STEP = 50
    PT_HA = STEP * STEP / 1e4
    MIN_PTS = 8
    y0, y1 = BRW_YEARS[0], BRW_YEARS[-1]
    zones_by_year = {year: read_brw(year) for year in BRW_YEARS}
    zones_now = zones_by_year[y1]
    stt_of = stt[["id", "geometry"]]
    samples = {}
    for gruppe in ("wohnen", "misch", "gewerbe"):
        land = zones_now[zones_now["gruppe"] == gruppe].geometry.union_all()
        xy = grid_points(land, STEP)
        pts = gpd.GeoDataFrame(geometry=shapely.points(xy[:, 0], xy[:, 1]), crs=UTM)
        pts["id"] = gpd.sjoin(pts, stt_of, predicate="within", how="left").groupby(level=0)["id"].first()
        pts = pts.dropna(subset=["id"]).reset_index(drop=True)
        for year in BRW_YEARS:
            pts[year] = brw_at_points(pts, zones_by_year[year], gruppe)
        samples[gruppe] = pts

    def brw_stats(pts: pd.DataFrame):
        """Niveau, Trend und Zeitreihe aus den Messpunkten eines Stadtteils."""
        if len(pts) < MIN_PTS:
            return None
        level = pts[y1].mean()
        for start in BRW_YEARS:
            if y1 - start < 5:
                return dict(level=level, trend=None, reihe=None, ha=len(pts) * PT_HA)
            m = pts[pts[start].notna() & pts[y1].notna()]
            if len(m) >= MIN_PTS:
                reihe = [None if y < start else num(m[y].mean(), 0) for y in BRW_YEARS]
                return dict(level=level, trend=cagr(m[start].mean(), m[y1].mean(), y1 - start),
                            reihe=reihe, ha=len(pts) * PT_HA)

    val["brw_w_basis"] = "W"
    for i in ids:
        st = {g: brw_stats(samples[g][samples[g]["id"] == i]) for g in samples}
        w = st["wohnen"]
        if w is None and st["misch"] is not None:  # Innenstadtlagen ohne reine Wohnbaufläche
            w = st["misch"]
            val.loc[i, "brw_w_basis"] = "MI/MK"
        gm = st["gewerbe"] or st["misch"]
        for key, x in (("w", w), ("gm", gm), ("g", st["gewerbe"]), ("m", st["misch"])):
            if x is None:
                continue
            val.loc[i, f"brw_{key}"] = x["level"]
            if key in ("w", "gm"):
                val.loc[i, f"trend_{key}"] = x["trend"]
                if x["reihe"]:
                    series[i][f"brw_{key}"] = x["reihe"]
        for key, g in (("w", "wohnen"), ("g", "gewerbe"), ("m", "misch")):
            val.loc[i, f"ha_{key}"] = st[g]["ha"] if st[g] else len(samples[g][samples[g]["id"] == i]) * PT_HA
    # Gewerbe- und Mischflächen als Maß für eine etablierte Gewerbelage
    val["ha_gm"] = val["ha_g"] + val["ha_m"]

    # --- Bevölkerung ------------------------------------------------------
    bev = read_stat("bevoelkerungsentwicklung_altersgruppen.csv").dropna(subset=["id"])
    tot = bev.groupby(["id", "jahr"])["WERT"].sum().unstack("jahr").reindex(ids)
    jung = bev[bev["MERKMAL"].str.contains("0 bis 19")].groupby(["id", "jahr"])["WERT"].sum().unstack("jahr").reindex(ids)
    b1 = int(tot.columns.max())
    b0 = b1 - 10
    val["einwohner"] = tot[b1]
    val["bev_10"] = [pct(a, b) for a, b in zip(tot[b0], tot[b1])]
    val["anteil_u20"] = jung[b1] / tot[b1] * 100
    val["dichte"] = val["einwohner"] / stt.set_index("id")["flaeche_ha"]
    bev_years = [int(c) for c in tot.columns]
    for i in ids:
        series[i]["bev"] = [int(v) if not pd.isna(v) else None for v in tot.loc[i]]

    prog = pd.read_csv(RAW / "prognose.csv", sep=";", encoding="utf-8-sig")
    prog = prog[(prog["GESCHLECHT"] == "insgesamt") & (prog["ALTERSGRUPPE"] == "insgesamt")].copy()
    prog["id"] = prog["RAUM"].str.extract(r"^(\d{2})\s")[0]
    pp = prog.dropna(subset=["id"]).pivot(index="id", columns="ZEIT", values="WERT").reindex(ids)
    p0, p1 = int(pp.columns.min()), int(pp.columns.max())
    val["prog"] = [pct(a, b) for a, b in zip(pp[p0], pp[p1])]
    val["prog_abs"] = pp[p1] - pp[p0]
    prog_years = [int(c) for c in pp.columns]
    for i in ids:
        series[i]["prog"] = [int(v) if not pd.isna(v) else None for v in pp.loc[i]]

    wan = read_stat("bevoelkerungsbewegungen_saldiert.csv").dropna(subset=["id"])
    w1 = int(wan["jahr"].max())
    sel = wan[(wan["jahr"] > w1 - 5) & wan["MERKMAL"].str.contains("Umzugsgewinn|Zuzugsgewinn|sonstige")]
    saldo = sel.groupby("id")["WERT"].sum().reindex(ids)
    val["wanderung"] = saldo / val["einwohner"] * 1000 / 5  # je 1.000 Einwohner und Jahr

    # --- Haushalte, Arbeitsmarkt -----------------------------------------
    hh = read_stat("indikatoren_haushalte.csv").dropna(subset=["id"])
    h1 = int(hh["jahr"].max())
    hh = hh[hh["jahr"] == h1]
    val["hh_kinder"] = hh[hh["MERKMAL"].str.contains("Haushalte mit Kindern")].set_index("id")["WERT"].reindex(ids)
    val["hh_single"] = hh[hh["MERKMAL"].str.startswith("Anteil der Einpersonenhaushalte")].set_index("id")["WERT"].reindex(ids)

    erw = read_stat("indikatoren_erwerbstaetigkeit.csv").dropna(subset=["id"])
    e1 = int(erw["jahr"].max())
    alq = erw[(erw["jahr"] == e1) & erw["MERKMAL"].str.startswith("Anteil der Arbeitslosen an der Wohnberechtigten")]
    val["arbeitslos"] = alq.set_index("id")["WERT"].reindex(ids)

    # --- Wohnungsbau ------------------------------------------------------
    bau = read_stat("wohnbautaetigkeit.csv").dropna(subset=["id"])
    bau = bau[bau["MERKMAL"] == "Fertigstellungen - Wohnungen (insgesamt)"]
    f1 = int(bau["jahr"].max())
    fert = bau[bau["jahr"] > f1 - 5].groupby("id")["WERT"].sum().reindex(ids).fillna(0)
    val["neubau"] = fert / val["einwohner"] * 1000 / 5  # Wohnungen je 1.000 Einwohner und Jahr
    val["neubau_abs"] = fert

    # --- Bebauungspläne ---------------------------------------------------
    bv = gpd.read_file(RAW / "bplan_verfahren.geojson").to_crs(UTM)
    bv["geometry"] = bv.geometry.make_valid()
    # Mehrere Teilflächen desselben Plans zusammenfassen
    bv = bv.dissolve(by=["plannr"], aggfunc={"name": lambda s: " · ".join(dict.fromkeys(s)), "scanurl": "first"}).reset_index()
    bv["ha"] = bv.area / 1e4
    iv = gpd.overlay(bv[["plannr", "geometry"]], stt[["id", "name", "geometry"]], how="intersection", keep_geom_type=True)
    iv["ha_teil"] = iv.area / 1e4
    iv = iv[iv["ha_teil"] > 0.05]
    val["bplan_ha"] = iv.groupby("id")["ha_teil"].sum().reindex(ids).fillna(0)
    val["bplan_n"] = iv.groupby("id")["plannr"].nunique().reindex(ids).fillna(0)
    haupt = iv.sort_values("ha_teil", ascending=False).drop_duplicates("plannr").set_index("plannr")
    bv["stt"] = bv["plannr"].map(haupt["id"])
    bv["stt_name"] = bv["plannr"].map(haupt["name"])
    bv = bv.rename(columns={"scanurl": "url"})

    br = gpd.read_file(RAW / "bplan_rechtskraft.geojson").to_crs(UTM)
    br["geometry"] = br.geometry.make_valid()
    br["jahr"] = pd.to_datetime(br["datum"], errors="coerce").dt.year
    br["ha"] = br.area / 1e4
    br = br.rename(columns={"scanurl": "url"})
    neu = br[br["jahr"] >= y1 - 10]
    ir = gpd.overlay(neu[["plannr", "geometry"]], stt[["id", "geometry"]], how="intersection", keep_geom_type=True)
    ir["ha_teil"] = ir.area / 1e4
    val["bplan_neu_ha"] = ir.groupby("id")["ha_teil"].sum().reindex(ids).fillna(0)

    # --- Erreichbarkeit ---------------------------------------------------
    stops = gpd.read_file(RAW / "haltestellen.geojson").to_crs(UTM)
    stops = stops[stops.within(city.buffer(300))]
    stops["x"], stops["y"] = stops.geometry.x, stops.geometry.y
    bus = stops.groupby("stop_name")[["x", "y"]].mean().reset_index()
    bahn = bus[bus["stop_name"].str.contains(r"Bahnhof$|^Hauptbahnhof$|Zentrum Nord", regex=True)].copy()
    bahn["name"] = bahn["stop_name"].str.replace("Haltepunkt ", "").str.replace(" Bahnhof", "").replace({"Hauptbahnhof": "Münster Hbf"})
    hbf = bahn[bahn["stop_name"] == "Hauptbahnhof"][["x", "y"]].to_numpy()

    schulen = gpd.read_file(RAW / "schulen.geojson").to_crs(UTM)
    grund = schulen[schulen["SchoolType"].isin(["Grundschule", "PRIMUS-Schule", "Montessorischule"])]
    weiter = schulen[schulen["SchoolType"].isin(["Gymnasium", "Realschule", "Gesamtschule", "Hauptschule", "PRIMUS-Schule", "Waldorfschule"])]
    kitas = gpd.read_file(RAW / "kitas.geojson").to_crs(UTM)

    def tree(g):
        pts = np.column_stack([g.geometry.x, g.geometry.y]) if isinstance(g, gpd.GeoDataFrame) else g
        return cKDTree(pts)

    trees = {
        "d_bus": tree(bus[["x", "y"]].to_numpy()),
        "d_bahn": tree(bahn[["x", "y"]].to_numpy()),
        "d_kita": tree(kitas),
        "d_grund": tree(grund),
        "d_weiter": tree(weiter),
        "d_zentrum": tree(hbf),
    }
    # Messpunkte: dieselben 50-m-Punkte auf dem Bauland wie bei den Bodenrichtwerten
    def xy_of(gruppen, i, fallback):
        parts = [samples[g][samples[g]["id"] == i].geometry for g in gruppen]
        geoms = pd.concat(parts)
        if len(geoms) < MIN_PTS:
            p = fallback.representative_point()
            return np.array([[p.x, p.y]])
        return np.column_stack([geoms.x, geoms.y])

    for _, row in stt.iterrows():
        dist = {
            "wohn": xy_of(("wohnen", "misch"), row["id"], row.geometry),
            "alle": xy_of(("wohnen", "misch", "gewerbe"), row["id"], row.geometry),
        }
        for key, t in trees.items():
            base = dist["wohn"] if key in ("d_kita", "d_grund", "d_weiter") else dist["alle"]
            val.loc[row["id"], key] = float(np.mean(t.query(base)[0]))
    val["d_familie"] = (val["d_kita"] + val["d_grund"]) / 2
    val["d_zentrum"] = val["d_zentrum"] / 1000  # km zum Hauptbahnhof

    # --- Kennzahlen-Katalog ----------------------------------------------
    S_BRW = "Bodenrichtwerte, Gutachterausschuss für Grundstückswerte in der Stadt Münster"
    S_STAT = "Statistik der Stadt Münster (Stadtplanungsamt)"
    indicators = [
        dict(key="brw_w", label="Bodenrichtwert Wohnen", short="Bodenpreis Wohnen", unit="€/m²", digits=0, better="low",
             desc=f"Mittlerer Bodenrichtwert der Wohnbauflächen (ohne Außenbereich), Stichtag 01.01.{y1}. Niedrig = günstiger Einstieg.", src=S_BRW),
        dict(key="trend_w", label="Preisentwicklung Wohnen", short="Preisdynamik Wohnen", unit="% p. a.", digits=1, better="high",
             desc=f"Mittlere jährliche Veränderung des Bodenrichtwerts Wohnen {y0}–{y1}, gemessen an identischen Standorten.", src=S_BRW),
        dict(key="bev_10", label="Bevölkerungswachstum", short="Wachstum bisher", unit="%", digits=1, better="high",
             desc=f"Veränderung der wohnberechtigten Bevölkerung {b0}–{b1}.", src=S_STAT),
        dict(key="prog", label="Bevölkerungsprognose", short="Prognose", unit="%", digits=1, better="high",
             desc=f"Kleinräumige Bevölkerungsprognose der Stadt, Veränderung {p0}–{p1}.", src=S_STAT),
        dict(key="wanderung", label="Wanderungssaldo", short="Zuzug", unit="je 1.000 EW/Jahr", digits=1, better="high",
             desc=f"Saldo aus Zu-, Fort- und Umzügen je 1.000 Einwohner und Jahr, Mittel {w1 - 4}–{w1}.", src=S_STAT),
        dict(key="hh_kinder", label="Haushalte mit Kindern", short="Familienanteil", unit="%", digits=1, better="high",
             desc=f"Anteil der Haushalte mit Kindern an allen Haushalten, {h1}.", src=S_STAT),
        dict(key="hh_single", label="Einpersonenhaushalte", short="Singlehaushalte", unit="%", digits=1, better="high",
             desc=f"Anteil der Einpersonenhaushalte an allen Haushalten, {h1}. Hoch = Nachfrage nach kleinen Wohnungen.", src=S_STAT),
        dict(key="arbeitslos", label="Arbeitslosenanteil", short="Arbeitsmarkt", unit="%", digits=1, better="low",
             desc=f"Arbeitslose je 100 Einwohner im Alter von 15 bis 64 Jahren, {e1}.", src=S_STAT),
        dict(key="bplan_ha", label="Bebauungspläne im Verfahren", short="Baurecht in Arbeit", unit="ha", digits=1, better="high",
             desc="Fläche der Bebauungspläne im Aufstellungsverfahren, die im Stadtteil liegen.", src="Bebauungspläne, Stadt Münster"),
        dict(key="neubau", label="Wohnungsneubau", short="Bautätigkeit", unit="WE je 1.000 EW/Jahr", digits=1, better="high",
             desc=f"Fertiggestellte Wohnungen (Saldo inkl. Umbau) je 1.000 Einwohner und Jahr, Mittel {f1 - 4}–{f1}.", src=S_STAT),
        dict(key="d_familie", label="Weg zu Kita und Grundschule", short="Kita & Grundschule", unit="m", digits=0, better="low",
             desc="Mittlere Luftlinie von den Wohnbauflächen zur nächsten Kita und Grundschule.", src="Schulen und Kindertagesstätten, Stadt Münster"),
        dict(key="d_bus", label="Weg zur Bushaltestelle", short="Busanbindung", unit="m", digits=0, better="low",
             desc="Mittlere Luftlinie vom Bauland zur nächsten Bushaltestelle.", src="Haltestellen, Stadtwerke Münster"),
        dict(key="d_bahn", label="Weg zum Bahnhof", short="Bahnanschluss", unit="m", digits=0, better="low",
             desc="Mittlere Luftlinie vom Bauland zum nächsten Bahnhof oder Haltepunkt.", src="Haltestellen, Stadtwerke Münster"),
        dict(key="d_zentrum", label="Entfernung zum Hauptbahnhof", short="Zentralität", unit="km", digits=1, better="low",
             desc="Mittlere Luftlinie vom Bauland zum Hauptbahnhof Münster.", src="Haltestellen, Stadtwerke Münster"),
        dict(key="ha_gm", label="Gewerbe- und Mischflächen", short="Gewerbelage", unit="ha", digits=0, better="high",
             desc=f"Fläche der Richtwertzonen für Gewerbe-, Industrie-, Misch- und Kerngebiete, {y1}.", src=S_BRW),
        dict(key="brw_gm", label="Bodenrichtwert Gewerbe", short="Bodenpreis Gewerbe", unit="€/m²", digits=0, better="low",
             desc=f"Mittlerer Bodenrichtwert der Gewerbegebiete, ersatzweise der Misch- und Kerngebiete, Stichtag 01.01.{y1}.", src=S_BRW),
        dict(key="trend_gm", label="Preisentwicklung Gewerbe", short="Preisdynamik Gewerbe", unit="% p. a.", digits=1, better="high",
             desc=f"Mittlere jährliche Veränderung des Bodenrichtwerts Gewerbe {y0}–{y1}, gemessen an identischen Standorten.", src=S_BRW),
    ]
    info_only = ["einwohner", "dichte", "anteil_u20", "prog_abs", "neubau_abs", "bplan_n", "bplan_neu_ha",
                 "brw_g", "brw_m", "ha_w", "ha_g", "ha_m", "d_kita", "d_grund", "d_weiter", "brw_w_basis"]

    scores = pd.DataFrame(index=ids)
    for ind in indicators:
        scores[ind["key"]] = rank_score(val[ind["key"]], ind["better"] == "high")
        v = val[ind["key"]].dropna()
        ind["median"] = num(v.median(), 2)
        ind["min"] = num(v.min(), 2)
        ind["max"] = num(v.max(), 2)

    keys = [i["key"] for i in indicators] + info_only
    values = {i: {k: (val.loc[i, k] if isinstance(val.loc[i, k], str) else num(val.loc[i, k], 2)) for k in keys} for i in ids}
    score_out = {i: {k: (None if pd.isna(scores.loc[i, k]) else float(scores.loc[i, k])) for k in scores.columns} for i in ids}

    # --- Geometrien -------------------------------------------------------
    stt_simple = stt.copy()
    anker = gpd.GeoSeries([label_point(g) for g in stt.geometry], crs=UTM).to_crs(4326)
    stt_simple["lat"] = [round(p.y, 5) for p in anker]
    stt_simple["lon"] = [round(p.x, 5) for p in anker]
    stt_simple["geometry"] = shapely.coverage_simplify(stt_simple.geometry.values, 12)
    zones_now = zones_now.copy()
    zones_now["nuta_text"] = zones_now["NUTA"].map(NUTA_TEXT).fillna(zones_now["NUTA"])
    zones_now["gfz"] = pd.to_numeric(zones_now.get("GFZ"), errors="coerce")
    zones_now = zones_now.rename(columns={"NUTA": "nuta", "GEZ": "gez", "ORTST": "ort", "BEM": "bem", "BRWZNR": "nr", "ENTW": "entw"})
    # Große Flächen zuerst zeichnen, damit kleine Zonen obenauf klickbar bleiben
    zones_now = zones_now.assign(_a=zones_now.area).sort_values("_a", ascending=False)

    bahn_ll = gpd.GeoDataFrame(bahn, geometry=[Point(xy) for xy in zip(bahn["x"], bahn["y"])], crs=UTM).to_crs(4326)

    return {
        "meta": {
            "erstellt": dt.date.today().isoformat(),
            "brw_jahre": BRW_YEARS,
            "bev_jahre": bev_years,
            "prog_jahre": prog_years,
            "stand": {"brw": y1, "bev": b1, "haushalte": h1, "arbeitsmarkt": e1, "neubau": f1, "wanderung": w1},
        },
        "indikatoren": indicators,
        "werte": values,
        "raenge": score_out,
        "reihen": series,
        "stadtteile": to_geojson(stt_simple, ["id", "name", "bezirk", "lat", "lon"], 0),
        "zonen": to_geojson(zones_now, ["nr", "brw", "nuta", "nuta_text", "gruppe", "entw", "asb", "gez", "gfz", "ort", "bem"], 4),
        "bplan_verfahren": to_geojson(bv, ["plannr", "name", "url", "ha", "stt", "stt_name"], 3),
        "bplan_recht": to_geojson(br, ["plannr", "name", "jahr", "url"], 5),
        "bahn": [{"name": r["name"], "lat": round(r.geometry.y, 5), "lon": round(r.geometry.x, 5)} for _, r in bahn_ll.iterrows()],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="keine Downloads, nur vorhandene Rohdaten verwenden")
    args = ap.parse_args()
    fetch(args.offline)
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("window.SCOUT_DATA=" + payload + ";\n", encoding="utf-8")
    print(f"geschrieben {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
