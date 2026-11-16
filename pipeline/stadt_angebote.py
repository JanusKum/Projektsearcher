#!/usr/bin/env python3
"""Liest die Grundstücks- und Immobilienangebote der Stadt Münster.

Quelle ist die öffentliche Seite des Amts für Immobilienmanagement. Sie führt
Ausschreibungen nach Rubrik (Investoren, Privatpersonen, Gewerbe, kommende
Baugebiete …) mit Stadtteil, Adresse, Termin und Status.

Aufruf:  python pipeline/stadt_angebote.py           (gibt JSON aus)
"""
from __future__ import annotations

import html
import json
import re
import sys
import urllib.request

URL = "https://www.stadt-muenster.de/immobilien/immobilienangebote"
BASIS = "https://www.stadt-muenster.de"
UA = "standort-scout-prototype/0.1"
OHNE = ("abgeschlossene Vermarktungen",)  # Rubriken, die nicht mehr interessieren


def text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse(seite: str) -> list[dict]:
    main = re.search(r"<main.*?</main>", seite, re.S)
    body = main.group(0) if main else seite
    items = []
    # Jede Rubrik ist ein Akkordeon-Abschnitt: Überschrift, danach eine Tabelle
    for kopf, rest in re.findall(r'<button class="accordion-button[^>]*>(.*?)</button>(.*?)(?=<button class="accordion-button|$)', body, re.S):
        rubrik = text(kopf).lstrip(".… ").strip()
        if rubrik in OHNE:
            continue
        table = re.search(r"<table.*?</table>", rest, re.S)
        if not table:
            continue
        spalten = [text(th).lower() for th in re.findall(r"<th[^>]*>(.*?)</th>", table.group(0), re.S)]
        for zeile in re.findall(r"<tr>(.*?)</tr>", table.group(0).split("</thead>")[-1], re.S):
            zellen = re.findall(r"<td[^>]*>(.*?)</td>", zeile, re.S)
            if not zellen:
                continue
            wert = {}
            for name, zelle in zip(spalten, zellen):
                key = ("stadtteil" if "stadtteil" in name else "adresse" if "adresse" in name else "info" if "information" in name
                       else "termin" if "veröffentlichung" in name else "status" if "status" in name else None)
                if key:
                    wert[key] = text(zelle)
            link = re.search(r'href="(/[^"#]+)"', zeile)
            url = BASIS + link.group(1) if link else URL
            status = wert.get("status") or wert.get("termin", "")
            slug = re.sub(r"[^a-z0-9]+", "-", (link.group(1) if link else rubrik + "-" + wert.get("adresse", "")).lower()).strip("-")[-80:]
            items.append({
                "id": slug, "rubrik": rubrik, "stadtteil": wert.get("stadtteil", ""), "adresse": wert.get("adresse", ""),
                "info": wert.get("info", ""), "termin": wert.get("termin", ""), "status": wert.get("status", ""), "url": url,
                "offen": "abgeschlossen" not in status.lower(),
            })
    return items


def lade() -> list[dict]:
    req = urllib.request.Request(URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return parse(resp.read().decode("utf-8", errors="replace"))


if __name__ == "__main__":
    json.dump(lade(), sys.stdout, ensure_ascii=False, indent=1)
    print()
