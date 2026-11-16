#!/usr/bin/env python3
"""Packt die Web-App aus docs/ in eine einzige HTML-Datei.

Die Datei enthält Karte, Daten, 3D-Kacheln und Skripte (rund 30 MB) und lässt sich
weitergeben oder direkt im Browser öffnen.

Aufruf:  python pipeline/build_single_file.py [Zieldatei]
         python pipeline/build_single_file.py --fragment Zieldatei
           (ohne <html>-Gerüst, Bibliotheken vom CDN, 3D-Kacheln bleiben eigene
            Dateien unter geo/ – für Einbettungen)
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600'
         '&family=Barlow+Condensed:wght@500;600&display=swap">')
CDN = ('<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>\n'
       '<script src="https://unpkg.com/earcut@2.2.4/dist/earcut.min.js"></script>')


def read(name: str) -> str:
    return (DOCS / name).read_text(encoding="utf-8")


def inline_script(code: str) -> str:
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("ziel", nargs="?", default=str(ROOT / "dist" / "standort-scout-muenster.html"))
    ap.add_argument("--fragment", action="store_true", help="nur Seiteninhalt, Bibliotheken vom CDN")
    args = ap.parse_args()

    index = read("index.html")
    body = re.search(r"<!-- app:start -->(.*)<!-- app:end -->", index, re.S).group(1).strip()
    title = re.search(r"<title>.*?</title>", index, re.S).group(0)
    style = "<style>\n" + read("vendor/maplibre-gl.css") + "\n" + read("app.css") + "\n</style>"
    daten = [inline_script(read("data.js")), inline_script(read("geo/index.js")), inline_script(read("markt.js")), inline_script(read("map3d.js"))]
    app = inline_script(read("app.js")) + "\n" + inline_script(read("angebote.js"))

    if args.fragment:
        html = "\n".join([title, '<meta name="claude:viewport-fit-sides" content="cover">', FONTS, style, body, CDN, *daten, app])
    else:
        kacheln = "".join(p.read_text(encoding="ascii") for p in sorted((DOCS / "geo").glob("g_*.js")))
        html = "\n".join([
            '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            title, FONTS, style, "</head>\n<body>", body,
            inline_script(read("vendor/maplibre-gl.js")), inline_script(read("vendor/earcut.min.js")),
            *daten, inline_script(kacheln), app, "</body>\n</html>",
        ])
    target = Path(args.ziel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html + "\n", encoding="utf-8")
    print(f"geschrieben {target}  ({target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
