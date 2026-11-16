#!/usr/bin/env python3
"""Packt die Web-App aus docs/ in eine einzige HTML-Datei.

Die Datei enthält Karte, Daten und Skripte und lässt sich per E-Mail weitergeben
oder direkt im Browser öffnen.

Aufruf:  python pipeline/build_single_file.py [Zieldatei]
         python pipeline/build_single_file.py --fragment Zieldatei
           (ohne <html>-Gerüst, Kartenbibliothek vom CDN – für Einbettungen)
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600'
         '&family=Barlow+Condensed:wght@500;600&display=swap">')
LEAFLET_CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>'


def read(name: str) -> str:
    return (DOCS / name).read_text(encoding="utf-8")


def inline_script(code: str) -> str:
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("ziel", nargs="?", default=str(ROOT / "dist" / "standort-scout-muenster.html"))
    ap.add_argument("--fragment", action="store_true", help="nur Seiteninhalt, Leaflet vom CDN")
    args = ap.parse_args()

    index = read("index.html")
    body = re.search(r"<!-- app:start -->(.*)<!-- app:end -->", index, re.S).group(1).strip()
    title = re.search(r"<title>.*?</title>", index, re.S).group(0)
    # Leaflet-CSS verweist auf Bilddateien (Standard-Marker, Ebenenschalter), die die App nicht nutzt.
    leaflet_css = re.sub(r"url\([^)]*\)", "none", read("vendor/leaflet.css"))
    style = "<style>\n" + leaflet_css + "\n" + read("app.css") + "\n</style>"
    scripts = inline_script(read("data.js")) + "\n" + inline_script(read("app.js"))

    if args.fragment:
        html = "\n".join([title, '<meta name="claude:viewport-fit-sides" content="cover">', FONTS, style, body, LEAFLET_CDN, scripts])
    else:
        html = "\n".join([
            '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            title, FONTS, style, "</head>\n<body>", body, inline_script(read("vendor/leaflet.js")), scripts, "</body>\n</html>",
        ])
    target = Path(args.ziel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html + "\n", encoding="utf-8")
    print(f"geschrieben {target}  ({target.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
