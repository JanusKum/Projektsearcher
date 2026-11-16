# Standort-Scout Münster

Ein Prototyp, der die 45 Stadtteile von Münster für Bauprojekte bewertet: Wo lohnt sich
das nächste Projekt? Die Bewertung nutzt ausschließlich offene Daten der Stadt Münster,
keine vertraulichen Firmendaten.

## Was das Tool zeigt

- **3D-Karte der ganzen Stadt**: rund 139.000 Gebäude mit echten Dachformen aus dem
  amtlichen 3D-Gebäudemodell, dazu Straßen, Gewässer, Grünflächen, Bäume und
  Straßennamen. In der Übersicht steht jeder Stadtteil als Säule, deren Höhe dem Score
  folgt. Beim Hineinzoomen sinken die Säulen ab und die Gebäude wachsen heraus.
- **Ranking** der Stadtteile für vier Projektarten: Reihenhäuser,
  Mehrfamilienhäuser, Quartiere, Gewerbe & Büro. Ein Klick fliegt in den Ortskern.
- **Steckbrief je Stadtteil**: Bodenrichtwert und Preisentwicklung 2016–2026, Einwohner
  mit Prognose bis 2035, und eine Aufschlüsselung, wie der Score zustande kommt.
- **Standort-Check**: Hineingezoomt zeigt ein Klick auf eine beliebige Stelle den
  Bodenrichtwert der Zone, den Bebauungsplan (mit Link zu den Planunterlagen der Stadt)
  und die Entfernung zum nächsten Bahnhof.
- **Flächen in Planung**: alle Bebauungspläne im Aufstellungsverfahren, sortiert nach
  dem Score ihres Stadtteils. Hier entsteht neues Baurecht.
- **Gewichtung anpassen**: Jedes Kriterium hat einen Regler. Das Ranking rechnet sofort neu.

## Öffnen

`docs/index.html` im Browser öffnen, ein Doppelklick genügt. Es ist kein Server und
keine Internetverbindung nötig, alle Kartendaten liegen im Ordner `docs/geo/`. Die Karte
braucht einen Browser mit WebGL.

Eine einzelne Datei zum Weitergeben (rund 27 MB) erzeugt:

```bash
python pipeline/build_single_file.py        # schreibt dist/standort-scout-muenster.html
```

## Daten aktualisieren

```bash
pip install -r pipeline/requirements.txt
python pipeline/build_data.py               # Kennzahlen: lädt die Rohdaten, schreibt docs/data.js
python pipeline/build_map3d.py              # 3D-Karte: lädt rund 3 GB, schreibt docs/geo/
```

Die Rohdaten landen in `pipeline/raw/` (nicht im Repository). Erscheinen neue
Bodenrichtwerte, genügt es, `BRW_YEARS` in `pipeline/build_data.py` um das neue Jahr zu
erweitern.

## Methodik

Jede Kennzahl wird in einen Prozentrang von 0 bis 100 unter den 45 Stadtteilen
umgerechnet. 100 bekommt der beste Stadtteil, je nach Kennzahl der mit dem höchsten oder
dem niedrigsten Wert. Der Score ist der gewichtete Mittelwert dieser Ränge. Die Gewichte
je Projektart stehen in `docs/app.js` (`PROFILE`) und sind eine fachliche Annahme, die
sich in der Oberfläche ändern lässt.

| Kennzahl | Quelle |
|---|---|
| Bodenrichtwert Wohnen und Gewerbe, Preisentwicklung 2016–2026, Gewerbeflächen | Gutachterausschuss für Grundstückswerte in der Stadt Münster |
| Bevölkerungswachstum, Prognose 2026–2035, Wanderungssaldo | Statistik der Stadt Münster |
| Haushalte mit Kindern, Einpersonenhaushalte, Arbeitslosenanteil, Wohnungsneubau | Statistik der Stadt Münster |
| Bebauungspläne (rechtskräftig und im Verfahren) | Geoportal der Stadt Münster |
| Wege zu Kita, Grundschule, Bushaltestelle, Bahnhof, Hauptbahnhof | Stadt Münster, Stadtwerke Münster |
| 3D-Karte: Gebäude und Dachformen (LoD2) | Geobasis NRW |
| 3D-Karte: Straßen, Gewässer, Grün (tatsächliche Nutzung), Bäume, Straßennamen | Liegenschaftskataster und Baumkataster der Stadt Münster |

Die Datensätze der Stadt stammen aus dem [Open-Data-Portal der Stadt Münster](https://opendata.stadt-muenster.de)
und stehen unter der Datenlizenz Deutschland – Namensnennung 2.0. Das 3D-Gebäudemodell
stellt [Geobasis NRW](https://www.opengeodata.nrw.de) unter der Datenlizenz Deutschland – Zero 2.0 bereit.

**Bodenrichtwerte.** Auf dem heutigen Bauland liegt ein Raster aus 50-m-Messpunkten. An
jedem Punkt wird für jedes Jahr der Richtwert der dort geltenden Zone abgelesen. Die
Preisentwicklung vergleicht nur Punkte, die im Anfangs- und im Endjahr einen Wert haben.
So verfälschen neu zugeschnittene Zonen das Ergebnis nicht. Außenbereichszonen bleiben
außen vor.

**Erreichbarkeit.** Mittlere Luftlinie von denselben Messpunkten zum nächsten Ziel.

**3D-Karte.** `build_map3d.py` liest aus dem LoD2-Modell die Dachflächen jedes Gebäudes
und packt sie in Kacheln von 2 × 2 km. Die App zieht daraus die Wände bis zum Boden,
berechnet die Beleuchtung und zeichnet alles als eigene WebGL-Ebene in MapLibre. Lage und
Höhe der Gebäude sind amtlich. Dach- und Fassadenfarben sowie die Größe der Bäume sind
Darstellung.

## Grenzen

- Ein Bodenrichtwert ist ein Durchschnitt für eine Zone und kein Kaufpreis für ein
  einzelnes Grundstück.
- 2022 wurden die Richtwertzonen neu zugeschnitten. Ein Teil des Preissprungs in diesem
  Jahr kann darauf zurückgehen.
- Bebauungspläne im Verfahren sind nicht alle Neubaugebiete, manche überplanen den Bestand.
- Luftlinie ist kürzer als der tatsächliche Weg.
- Das Baumkataster enthält nur knapp die Hälfte der städtischen Bäume und keine privaten.
- Die 3D-Karte hat kein Geländemodell. Münster ist flach, alle Gebäude stehen auf einer Ebene.
- Mieten, Kaufpreise, Autobahnanschlüsse und Nahversorgung fehlen noch.
- Der Score ist eine Vorauswahl und ersetzt keine Ankaufsprüfung.

## Mögliche nächste Schritte

- Mieten und Kaufpreise ergänzen (Zensus 2022 im 100-m-Gitter, Grundstücksmarktbericht).
- Autobahnanschlüsse und Nahversorgung aus OpenStreetMap ergänzen.
- Eigene Projekte und Ankaufsangebote als Punkte einblenden und automatisch bewerten.
- Bewertung auf Ebene einzelner Flächen statt ganzer Stadtteile.

## Aufbau

```
docs/                 Web-App (index.html, app.js, map3d.js, app.css, data.js, MapLibre)
docs/geo/             3D-Karte: Übersicht (index.js) und 108 Kacheln mit Gebäuden, Flächen, Bäumen
pipeline/build_data.py         Rohdaten laden und zu Kennzahlen verdichten
pipeline/build_map3d.py        3D-Gebäudemodell und Kataster zu Kartenkacheln verarbeiten
pipeline/build_single_file.py  App in eine einzelne HTML-Datei packen
```
