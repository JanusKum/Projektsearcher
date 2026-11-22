# NEBEL · 1000 JAHRE — Treatment

Stil: **16-bit Pixel RPG** · Hochformat 1080×1920 (Framebuffer 180×320, ×6 nearest-neighbour) · 24 fps · ca. 32 s · Deutsch, männliche Erzählstimme (edge-tts `de-DE-ChristophNeural`), Untertitel = die Dialogbox des Spiels.

## 1. Drei mögliche Strukturen

1. **Zeitraffer-Zähler (gewählt).** Ein fester Ort, ein Dorf. Oben im Systemfenster läuft der Jahreszähler: 0 → 1 → 100 → 500 → 1000. Mit jedem Sprung frisst der Nebel eine Farbstufe der Palette (16-bit → 8-bit → 4 Farben → verblasstes Blaugrau). Nur die orange Laternenflamme ist geschützt und bleibt über alle Epochen. Am Ende hebt sich der Nebel, die Farbe flutet zurück, und die Sonne steht genau dort, wo vorher die Flamme war.
2. **Speicherstände.** Ein Ladebildschirm mit vier Spielständen („JAHR 1“, „JAHR 100“…). Jeder Slot wird per Mosaik betreten. Schön, aber 30 s reichen kaum für Menü plus vier Einstiege. Der Rahmen frisst die Zeit.
3. **Kampf gegen den Nebel.** Rundenbasierter Kampf: Die Menschheit gegen „NEBEL“, jede Runde ein Jahrhundert, die Werte sinken. Lustig, macht aber aus einem stillen, unheimlichen Thema eine Parodie, und das will der Stil nicht.

**Warum 1:** Das Thema *ist* der Farbverlust. Nebel nimmt der Welt Licht und Farbe, und genau das kann dieses Medium wörtlich: die Palette stufenweise kollabieren lassen. Ein Ort, ein Zähler, ein geschütztes Orange – das liest sich auch auf dem Handy sofort. Aus Struktur 3 kommt nur ein Satz Kampf-Grammatik für den Hook („Der NEBEL erscheint!“).

## 2. Logline und Bogen

**Logline:** Ein Dorf verliert in tausend Jahren Nebel die Sonne, die Farben und schließlich die Erinnerung daran, bis ein Kind mit der letzten Laterne als Erstes wieder Licht sieht.

- **Setup (0–4,8 s):** Sonniges Dorf in vollen 16-bit-Farben. Eine Nebelwand rollt herein. Systemmeldung: „Der NEBEL erscheint!“
- **Wende (4,8–24 s):** Jahr 1: Ernte fault, Sonnenbalken fällt auf 0. Jahr 100: Netze fangen Wasser aus der Luft, Glocken weisen den Weg. Jahr 500: Moos und Riesenpilze überwuchern alles, die Welt hat nur noch vier Grautöne. Jahr 1000: Im Inventar steht „SONNE – ??? Nur eine Legende.“
- **Ende (24–32 s):** Stille. Ein Atemzug. Der Nebel reißt auf, die Farbe flutet zurück. Die Sonne erscheint an der Stelle der Laternenflamme. Das Kind: „Was… ist das?“

## 3. Benchmark

- **Mitte-90er-Konsolen-RPGs mit Epochen-Struktur** (dieselbe Welt in verschiedenen Zeitaltern). *Lernen:* Zeit als Ort erzählen, derselbe Bildausschnitt in mehreren Epochen, Systemfenster als Erzähler. *Nicht nehmen:* Figuren, Fenster-Rahmen, Schrift, Melodien, Namen.
- **Die Zeitraffer-Sequenz aus „The Time Machine“ (1960).** *Lernen:* ein fester Blick, die Welt ändert sich davor, ein Zähler macht das Tempo spürbar. *Nicht nehmen:* Einstellungen und Bilder.

## 4. Gestaltungsentscheidungen

- **Palette:** 32 Farben (ENDESGA-32, freie Palette) als Master. Tabellen per Luminanz: `16bit` (Identität) → `fog1` (entsättigt, Richtung Nebelgrau, warme Töne behalten) → `8bit` (≈15 Farben, mit Dunkelgrün und Dunkelbraun) → `4col` (4 Grautöne, nativ bei 90×160 gezeichnet und verdoppelt) → `faded` (`lum^0.8`, ≈7 Blaugraus).
- **Geschützte Farbe:** genau eine, das **Laternen-Orange** (+ sein heller Kern). Sie ist der rote Faden und ermöglicht den Match-Cut Flamme → Sonne.
- **Nebel:** Mehrere Ebenen aus 4×4-Bayer-Dither, die mit ganzzahligem Parallax driften. Nie Alpha-Mischung, sondern Indizes, die Richtung Nebelgrau gestuft werden.
- **Held:** Ein Kind im Kapuzenumhang mit langem Kapuzenzipfel (Silhouetten-Merkmal), immer mit Laterne in der hinteren Hand. Davor Erwachsene als Vorfahren in derselben Silhouette, in Jahr 100 ein Laternenträger.
- **Native Moves:** *Palette Collapse* (pro Epoche eine Stufe) und am Höhepunkt *Flood + Protected-Colour-Match-Cut* (Flamme → Sonne).

## 5. Shotliste (Framebuffer 180×320, Boden immer über der Dialogbox ab y≈236)

| # | Zeit | Einstellung | Kamera | Inhalt | Warum |
|---|---|---|---|---|---|
| 1 | 0,0–4,8 | Totale, Dorf unten, Sonne oben | starr, dann Shake 3-2-1 px bei 3,6 | Sonniges Dorf, Bauer im Feld. Ab 1,0 rollt eine Nebelwand von rechts herein. Systemfenster oben: „JAHR 0“. Bei 3,6: „Der NEBEL erscheint!“ | Hook: Welt und Bedrohung in einem Bild. Kampfgrammatik macht den Nebel zum Gegner |
| 2 | 4,8–9,6 | Halbtotale, Sonne → Feld | ganzzahliger Tilt runter (Himmel → Feld) | Sonne wird zur blassen Scheibe und verschwindet. Status „SONNE“-Balken tickt auf 0. Ähren knicken (8 fps). Palette `16bit → fog1` | Verlust ohne Bewegung: die Palette spricht |
| 3 | 9,6–14,4 | Seitenansicht | Side-Scroll mit 3 Parallax-Ebenen | Mosaik-Übergang mit Palettenwechsel `8bit`. Laternenträger geht nach links. Nebelnetze tropfen, Glockenturm schwingt | Reise, Alltag, Anpassung |
| 4 | 14,4–19,2 | Untersicht | Tilt hoch an einem Riesenpilz über Ruinen | `4col`, Moos überall. Nur die Laterne unten ist noch orange | Ehrfurcht, Maßstab: die Natur hat übernommen |
| 5 | 19,2–24,0 | Rückenansicht des Kindes auf Hügel, Inventar im oberen Drittel | starr, Menü gleitet ein | `faded`. Inventarfenster: „LATERNE ×1“, „SONNE – ??? Nur eine Legende.“ Cursorhand wippt und **bleibt stehen** auf SONNE | Das System erzählt das Vergessen |
| 6 | 24,0–25,2 | gleiche Einstellung | starr | **Stille** (echter Nullpegel). Kind hebt die Laterne | Atempause vor dem Höhepunkt |
| 7 | 25,2–32,4 | Kind auf Hügel, Himmel | Halt, dann Farbflut als Dither-Welle von oben | Atemzug. Nebel reißt in Bayer-Stufen auf, Farbe flutet zurück `faded → 16bit`. Die Sonne erscheint genau an der Bildposition der Flamme. Dialogbox mit Porträt (Textpieps, keine Stimme): „Was… ist das?“ | Signature-Shot. Bookend zu Shot 1: dieselbe Sonne, aber jetzt wie neu gesehen |

Vier verschiedene Kamerabewegungen: Shake, Tilt runter, Side-Scroll-Parallax, Tilt hoch. Dazu Halt mit Palettenwechsel.

## 6. Beat-Sheet

- 0,3 Stimme L1: „Was wäre, wenn der Nebel tausend Jahre bliebe?“
- 1,0 Nebelwand beginnt zu rollen
- 3,3 Musik bricht ab (Beinahe-Stille 1)
- 3,6 Shake + Kampfmeldung + Treffer-Sound
- 4,8 Cut (Palettenstufen-Fade) → Jahr 1, Zähler springt
- 5,0 L2: „Jahr eins: Die Sonne ist weg. Die Ernte verfault.“
- 9,6 Mosaik-Übergang → Jahr 100
- 9,8 L3: „Jahr hundert: Netze fangen Wasser aus der Luft. Glocken zeigen den Weg.“
- 14,4 Palettenstufen-Fade → Jahr 500
- 14,6 L4: „Jahr fünfhundert: Moos und Pilze herrschen. Farben kennt keiner mehr.“
- 19,2 Mosaik → Jahr 1000, Inventar gleitet ein
- 19,4 L5: „Jahr tausend: Die Sonne ist nur noch eine Legende.“
- 24,0 Stille 2 (echter Nullpegel)
- 25,2 Atemzug (einziger organischer Laut), Nebel beginnt aufzureißen
- 27,6 Sonne komplett, Item-Fanfare, volle Band kehrt zurück
- 28,2 Dialogbox: „Was… ist das?“ (Textpieps)
- 32,4 Ende, Echo klingt aus

> **Nach der Sprachaufnahme angepasst:** 96 BPM, ein Takt = 2,5 s, Länge 34,4 s. Schnitte bei 5,0 / 10,0 / 15,0 / 20,0 s, Stille 25,0–26,25 s, Sonne voll bei 28,75 s, „JAHR 1001“ ab 31,9 s. Verbindlich ist `timeline.json`.

## 7. Cue-Map

96 BPM, 4/4, ein Takt = 2,5 s (die Zeiten unten sind die ersten Planwerte; die endgültigen stehen in `timeline.json`). Moll-Motiv (5 Töne), das am Ende in Dur aufgelöst wird.

| Abschnitt | Takte | Zeit | Besetzung | Treffer |
|---|---|---|---|---|
| A Dorf | 1–2 | 0–4,8 | 16-bit: Pulse-Lead 25 % + Triangle-Bass + Noise-Drums, Stereo-Echo | Abbruch 3,3; Treffer 3,6 (Takt 2, Schlag 3) |
| B Jahr 1 | 3–4 | 4,8–9,6 | Drums weg, Lead in Moll, Echo bleibt | Bit-Drop auf 4,8 und 7,2 |
| C Jahr 100 | 5–6 | 9,6–14,4 | 8-bit mono: Pulse 50 % + Triangle, Glocken-Arpeggio | Glocke auf Takt 5/1 und 6/1 |
| D Jahr 500 | 7–8 | 14,4–19,2 | 4-bit-Lautstärkestufen, niedrige Samplerate, nur Bass + karger Lead | Bit-Drop 14,4 |
| E Jahr 1000 | 9–10 | 19,2–24,0 | gedämpft (Tiefpass), Motiv endet auf der Dominante | Cursor-Stopp ≈ 22,2 |
| Stille | – | 24,0–25,2 | Nullpegel, inkl. Echo-Fahnen | – |
| F Flut | 11–13 | 25,2–32,4 | volle Band kehrt mit Tonartwechsel nach oben zurück, Motiv löst sich in Dur auf | Fanfare 27,6; Dialog 28,2 |

## 8. Sound-Design

| Abschnitt | Atmo | Foley | Musik |
|---|---|---|---|
| A | Vögel-Chirps (Pulse) | Nebel-Rauschen schwillt an, Treffer-Thump, Shake | volle Band |
| B | dumpfer Wind | HP-Tick-Down des Sonnenbalkens, Bit-Drop pro Palettenstufe, Ähren-Knick | ohne Drums, Moll |
| C | Wind, Tropfen | Schritte mit Echo, Tropfen von Netzen, Glocke | 8-bit mono |
| D | tiefes Brummen | Bit-Drop, Pilz-Schimmer (Triangle-Arpeggio) | 4-bit, karg |
| E | fast nichts | Menü-Slide, Cursor-Blips, Cursor-Stopp | gedämpft, hängt auf Dominante |
| Stille | – | – | – |
| F | Wind dreht auf, Vögel kehren zurück | Atemzug, Dither-Wellen-Schimmer, Item-Fanfare, Textpieps | volle Band, Dur |

Musik duckt ca. 7–8 dB unter der Stimme. Ziel −14 LUFS. Kein Grain.

## 9. Untertitel und Titel

- **Die Dialogbox ist der Untertitel**: unten im Bild, geschichteter Rahmen, eigener variabler Pixelfont (Großbuchstaben ≈7 px, inkl. Ä Ö Ü ß), 1-px-Schatten. Tippt mit ca. 38 Zeichen/s mit der Stimme, ▼ blinkt am Ende.
- **Rahmen folgt der Epoche:** blau (16-bit) → schwarz mit weißem Rahmen (8-bit) → hell (4 Farben) → blaugrau (verblasst) → wieder blau.
- **Systemfenster oben**: Jahreszähler und Kampfmeldung.
- `.srt` aus demselben Untertitel-Array (`subtitles_de.srt`, weil die Untertitel ins Bild gebrannt sind).
