#!/usr/bin/env python3
"""Standort-Scout Münster – Vergleichswerte für die Bewertung von Kaufangeboten.

Quellen (alle amtlich und offen):

  * Immobilienrichtwerte des Gutachterausschusses Münster (BORIS NRW): zonale
    Vergleichswerte in €/m² Wohnfläche für Eigentumswohnungen und Einfamilienhäuser
  * Grundstücksmarktdaten NRW: durchschnittliche Kaufpreise nach Haustyp und Baujahr,
    Liegenschaftszinssätze, Mieten und Bewirtschaftungskosten für Münster
  * Immobilienangebote der Stadt Münster (Amt für Immobilienmanagement): laufende und
    kommende Ausschreibungen von Grundstücken
  * Hausnummernliste der Stadt Münster: Adressen mit Koordinaten, damit die App ein
    Angebot ohne Internetdienst auf der Karte verorten kann

Ergebnis: docs/markt.js

Aufruf:  python pipeline/build_market.py [--offline]
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import time
import urllib.request
import warnings
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
from pyproj import Transformer

import stadt_angebote

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "docs" / "markt.js"
UA = "standort-scout-prototype/0.1"
AGS = "05515000"  # Stadt Münster
BORIS = "https://www.opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris"
SOURCES = {
    "irw.zip": f"{BORIS}/IRW/IRW_EPSG25832_Shape.zip",
    "gmd.zip": f"{BORIS}/GMD/GMDNRW_CSV.zip",
    "hausnummern.csv": ("https://www.stadt-muenster.de/ows/mapserv706/odhsnrserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=1.0.0"
                        "&TYPENAME=ms:Hausnummern&OUTPUTFORMAT=CSV&EXCEPTIONS=XML&MAXFEATURES=70000"),
    "stadtteile.geojson": "https://opendata.stadt-muenster.de/sites/default/files/stadtteile-statistische-bezirke-muenster.geojson",
}
KLASSEN = ["neu", "20xx", "2009", "1994", "1974", "1949", "1919"]  # Baujahrsklassen der Grundstücksmarktdaten


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
                with urllib.request.urlopen(req, timeout=600) as resp:
                    target.write_bytes(resp.read())
                print(f"geladen  {name}")
                break
            except Exception as exc:  # noqa: BLE001 – Netzfehler: erneut versuchen
                if attempt == 3:
                    sys.exit(f"Download fehlgeschlagen: {url}\n{exc}")
                time.sleep(3 * (attempt + 1))


def zahl(text: str | None) -> float | None:
    """Zahl aus den Grundstücksmarktdaten; '-', '*', '.' und leer bedeuten: kein Wert."""
    if text is None or text.strip() in ("", "-", "*", "."):
        return None
    return float(text.replace(".", "").replace(",", ".")) if "," in text else float(text)


def gmd_row(zf: zipfile.ZipFile, name: str) -> dict:
    with zf.open(name) as fh:
        for row in csv.DictReader(io.TextIOWrapper(fh, encoding="cp1252"), delimiter=";"):
            if row["ags"] == AGS:
                return row
    sys.exit(f"Münster fehlt in {name}")


def market() -> dict:
    with zipfile.ZipFile(RAW / "gmd.zip") as zf:
        efh, we, lzs, bau, ums = (gmd_row(zf, f"{n}.csv") for n in ("efh", "we", "lzs", "baulandpreise", "umsatz"))

    kauf = {}
    for typ in ("efh350", "efh", "rehdhh", "rmh"):
        kauf[typ] = {}
        for k in KLASSEN:
            n = zahl(efh.get(f"{typ}_a_{k}"))
            if n:
                kauf[typ][k] = {"n": int(n), "gf": zahl(efh[f"{typ}_gf_{k}"]), "wf": zahl(efh[f"{typ}_wf_{k}"]),
                                "euqm": zahl(efh[f"{typ}_euqm_{k}"]), "preis": zahl(efh[f"{typ}_gp_{k}"])}
    kauf["etw"] = {}
    for key, name in (("neu", "neu"), ("w_z", "weiter"), ("u_z", "umwandlung")):
        n = zahl(we.get(f"we_a_{key}"))
        if n:
            kauf["etw"][name] = {"n": int(n), "wf": zahl(we[f"we_wf_{key}"]), "euqm": zahl(we[f"we_euqm_{key}"])}

    zins = {}
    for typ in ("efh", "zfh", "rhdhh", "dreifh", "mfh", "ggg", "handel", "buero", "gegi", "we_s", "we_v"):
        if zahl(lzs.get(f"{typ}_lzs")) is None:
            continue
        zins[typ] = {k: zahl(lzs.get(f"{typ}_{src}")) for k, src in (
            ("lzs", "lzs"), ("lzs_sd", "lzs_stabw"), ("n", "anz"), ("flaeche", "gr"), ("euqm", "kp"), ("euqm_sd", "kp_stabw"),
            ("miete", "miete"), ("miete_sd", "miete_stabw"), ("bwk", "bwk"), ("rnd", "rnd"))}
        zins[typ]["unsicher"] = lzs.get(f"{typ}_lzs_unsicher") == "ja"

    bauland = {typ: {lage: zahl(bau.get(f"{typ}_{kurz}_euqm")) for lage, kurz in (("gut", "gu"), ("mittel", "mi"), ("einfach", "ma"))}
               for typ in ("efh", "rehdhh", "rmh", "mfh20", "ge")}
    umsatz = {k: zahl(ums.get(k)) for k in ("efh_a", "mfh_a", "bvg_a", "gegi_a", "we_ges_a", "iwb_a", "gwb_a", "ge_a",
                                           "efh_preisentw", "mfh_preisentw", "we_ges_preisentw", "gwb_preisentw", "erbb_zins")}
    return {"jahr": int(efh["berichtsjahr"]), "kauf": kauf, "zins": zins, "bauland": bauland, "umsatz": umsatz}


def irw(city) -> tuple[dict, str]:
    folder = RAW / "irw"
    if not folder.exists():
        with zipfile.ZipFile(RAW / "irw.zip") as zf:
            zf.extractall(folder)
    g = gpd.read_file(next(folder.glob("*.shp")), bbox=city.bounds)
    g = g[g["GESL"] == AGS].copy()
    g["wert"] = pd.to_numeric(g["IMRW"], errors="coerce")
    g = g[g["wert"].notna()]
    g["geometry"] = g.geometry.make_valid().simplify(2, preserve_topology=True)
    stand = str(g["STAG"].iloc[0])
    ll = g.to_crs(4326)
    feats = []
    for _, r in ll.iterrows():
        geom = shapely.set_precision(r.geometry, 1e-5)
        parts = [p for p in shapely.get_parts(geom) if p.geom_type == "Polygon" and not p.is_empty]
        if not parts:
            continue
        geom = parts[0] if len(parts) == 1 else shapely.MultiPolygon(parts)
        # Teilmarkt 1 = Eigentumswohnungen, 2 = Ein- und Zweifamilienhäuser
        props = {"tm": "etw" if str(r["TEILMA"]) == "1" else "efh", "wert": float(r["wert"]), "nr": str(r["WNUM"]),
                 "bj": None if pd.isna(r["BJ"]) else int(r["BJ"]), "wf": r["WHNFL"] if isinstance(r["WHNFL"], str) else None,
                 "gf": r["FLAE"] if isinstance(r["FLAE"], str) else None}
        feats.append({"type": "Feature", "properties": {k: v for k, v in props.items() if v is not None},
                      "geometry": shapely.geometry.mapping(geom)})
    return {"type": "FeatureCollection", "features": feats}, stand


def addresses() -> dict:
    """Adressen je Straße: [lon0, lat0, [Hausnummer, dx, dy], …] – Abstände in 1e-5 Grad."""
    df = pd.read_csv(RAW / "hausnummern.csv", dtype=str, encoding="utf-8-sig").dropna(subset=["STR_NAME", "H_RW", "H_HW"])
    lon, lat = Transformer.from_crs(25832, 4326, always_xy=True).transform(df["H_RW"].astype(float).to_numpy(), df["H_HW"].astype(float).to_numpy())
    df["lon"], df["lat"] = lon, lat
    df["nr"] = (df["H_HSNR"].fillna("") + df["H_ZUS"].fillna("")).str.lower().str.replace(" ", "")
    out = {}
    for name, grp in df.groupby("STR_NAME"):
        lon0, lat0 = round(grp["lon"].mean(), 5), round(grp["lat"].mean(), 5)
        rows = sorted({(r.nr, int(round((r.lon - lon0) * 1e5)), int(round((r.lat - lat0) * 1e5))) for r in grp.itertuples()},
                      key=lambda t: (int("".join(c for c in t[0] if c.isdigit()) or 0), t[0]))
        out[name] = [lon0, lat0] + [list(r) for r in rows]
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="keine Downloads, nur vorhandene Rohdaten verwenden")
    args = ap.parse_args()
    fetch(args.offline)
    city = gpd.read_file(RAW / "stadtteile.geojson").to_crs(25832).geometry.union_all()
    zonen, stand = irw(city)
    # Ausschreibungen der Stadt: Momentaufnahme für die App ohne Datenbank (offline bleibt der letzte Stand)
    stadt_cache = RAW / "stadt_angebote.json"
    if not args.offline:
        stadt_cache.write_text(json.dumps({"stand": time.strftime("%Y-%m-%d"), "liste": stadt_angebote.lade()}, ensure_ascii=False), encoding="utf-8")
    stadt = json.loads(stadt_cache.read_text(encoding="utf-8")) if stadt_cache.exists() else {"stand": None, "liste": []}
    data = {"markt": market(), "irw": zonen, "irw_stand": stand, "stadt": stadt, "adressen": addresses()}
    OUT.write_text("window.SCOUT_MARKT=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    werte = {tm: sorted(f["properties"]["wert"] for f in zonen["features"] if f["properties"]["tm"] == tm) for tm in ("etw", "efh")}
    for tm, v in werte.items():
        print(f"Immobilienrichtwerte {tm}: {len(v)} Zonen, {v[0]:.0f} bis {v[-1]:.0f} €/m², Median {v[len(v) // 2]:.0f}")
    print(f"Adressen: {sum(len(v) - 2 for v in data['adressen'].values())} in {len(data['adressen'])} Straßen")
    print(f"geschrieben {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
