# Standort-Scout Münster

Ein Prototyp, der die 45 Stadtteile von Münster für Bauprojekte bewertet: Wo lohnt sich
das nächste Projekt? Die Bewertung nutzt ausschließlich offene Daten der Stadt Münster,
keine vertraulichen Firmendaten.

## Was das Tool zeigt

- **Karte mit Ranking** der Stadtteile für vier Projektarten: Reihenhäuser,
  Mehrfamilienhäuser, Quartiere, Gewerbe & Büro.
- **Steckbrief je Stadtteil**: Bodenrichtwert und Preisentwicklung 2016–2026, Einwohner
  mit Prognose bis 2035, und eine Aufschlüsselung, wie der Score zustande kommt.
- **Standort-Check**: Ein Klick auf eine beliebige Stelle der Karte zeigt den
  Bodenrichtwert der Zone, den Bebauungsplan (mit Link zu den Planunterlagen der Stadt)
  und die Entfernung zum nächsten Bahnhof.
- **Flächen in Planung**: alle Bebauungspläne im Aufstellungsverfahren, sortiert nach
  dem Score ihres Stadtteils. Hier entsteht neues Baurecht.
- **Gewichtung anpassen**: Jedes Kriterium hat einen Regler. Das Ranking rechnet sofort neu.

## Öffnen

`docs/index.html` im Browser öffnen, ein Doppelklick genügt. Es ist kein Server nötig.
Mit Internetverbindung liegt eine OpenStreetMap-Karte unter den Flächen, ohne Verbindung
funktioniert alles andere weiter.

Eine einzelne Datei zum Weitergeben per E-Mail erzeugt:

```bash
python pipeline/build_single_file.py        # schreibt dist/standort-scout-muenster.html
```

## Daten aktualisieren

```bash
pip install -r pipeline/requirements.txt
python pipeline/build_data.py               # lädt die Rohdaten und schreibt docs/data.js
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

Alle Datensätze stammen aus dem [Open-Data-Portal der Stadt Münster](https://opendata.stadt-muenster.de)
und stehen unter der Datenlizenz Deutschland – Namensnennung 2.0.

**Bodenrichtwerte.** Auf dem heutigen Bauland liegt ein Raster aus 50-m-Messpunkten. An
jedem Punkt wird für jedes Jahr der Richtwert der dort geltenden Zone abgelesen. Die
Preisentwicklung vergleicht nur Punkte, die im Anfangs- und im Endjahr einen Wert haben.
So verfälschen neu zugeschnittene Zonen das Ergebnis nicht. Außenbereichszonen bleiben
außen vor.

**Erreichbarkeit.** Mittlere Luftlinie von denselben Messpunkten zum nächsten Ziel.

## Grenzen

- Ein Bodenrichtwert ist ein Durchschnitt für eine Zone und kein Kaufpreis für ein
  einzelnes Grundstück.
- 2022 wurden die Richtwertzonen neu zugeschnitten. Ein Teil des Preissprungs in diesem
  Jahr kann darauf zurückgehen.
- Bebauungspläne im Verfahren sind nicht alle Neubaugebiete, manche überplanen den Bestand.
- Luftlinie ist kürzer als der tatsächliche Weg.
- Mieten, Kaufpreise, Autobahnanschlüsse und Nahversorgung fehlen noch.
- Der Score ist eine Vorauswahl und ersetzt keine Ankaufsprüfung.

## Mögliche nächste Schritte

- Mieten und Kaufpreise ergänzen (Zensus 2022 im 100-m-Gitter, Grundstücksmarktbericht).
- Autobahnanschlüsse und Nahversorgung aus OpenStreetMap ergänzen.
- Eigene Projekte und Ankaufsangebote als Punkte einblenden und automatisch bewerten.
- Bewertung auf Ebene einzelner Flächen statt ganzer Stadtteile.

## Aufbau

```
docs/                 Web-App (index.html, app.js, app.css, data.js, Leaflet)
pipeline/build_data.py         Rohdaten laden und zu Kennzahlen verdichten
pipeline/build_single_file.py  App in eine einzelne HTML-Datei packen
```
