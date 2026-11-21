// story.js: one timeline for picture, score, foley and subtitles. 100 BPM: beat 0.6 s, bar 2.4 s, 14 bars = 33.6 s.
const BPM = 100, BEAT = 0.6, BAR = 2.4, DUR = 33.6;
const T = {
  dot: 0.0, land: 1.7, here: 2.4,              // a dot in black → phone → Pin lands on the dot → label "Dein Standort"
  fire: 4.8, out0: 5.4, out1: 8.9,            // sight line up, log zoom out to the orbit
  gpsLab: 8.4,
  ring: 9.6, dive0: 9.9, dive1: 11.2,         // next-stop ring on a satellite, through the ring
  clock: 11.0, back0: 12.6, back1: 14.0,      // atomic clock inset; pull back to the orbit
  sig0: 13.8, sig1: 15.4,                     // signal walks to you (light speed: 0.067 s for real)
  four: 15.6, lock: 18.6,                     // four satellites, four ranges, position lock
  hush: 19.2, clocks: 19.5, plus: 21.6,       // half-beat of silence, two clocks, +38 µs a day
  map0: 25.2, map1: 26.4, drift0: 26.4, drift1: 29.8,   // back down to the city: the dot drifts 10 km
  snap: 31.2, end: 33.6,                      // the dot snaps back; title
};
// narration (vidIQ voice "Otto"); cues are split so no subtitle wraps
const VO = [
  { id: 'v1', t: 0.45 }, { id: 'v2', t: 5.0 }, { id: 'v3', t: 9.85 },
  { id: 'v4', t: 15.65 }, { id: 'v5', t: 19.6 }, { id: 'v6', t: 25.45 },
];
const CUES = [
  [0.45, 2.45, 'Dein Handy weiß, wo du bist.'],
  [2.45, 4.75, 'Auf wenige Meter genau.'],
  [5.0, 7.0, 'Dafür fragt es Satelliten.'],
  [7.0, 9.75, '20.000 km über dir.'],
  [9.85, 11.65, 'An Bord: Atomuhren.'],
  [11.65, 15.5, 'Ihr Signal rast mit Lichtgeschwindigkeit zu dir.'],
  [15.65, 17.45, 'Aus vier Laufzeiten berechnet'],
  [17.45, 19.25, 'dein Handy, wo du stehst.'],
  [19.6, 22.2, 'Aber da oben vergeht die Zeit schneller.'],
  [22.2, 25.2, '38 Mikrosekunden pro Tag.'],
  [25.45, 27.6, 'Ohne Einstein läge dein Navi'],
  [27.6, 30.6, 'jeden Tag 10 km daneben.'],
];
// foley events (mix.py reads them from events.json)
const SFX = [
  { t: 0.0, type: 'blip', f: 880 },
  { t: 1.7, type: 'puff' }, { t: 1.95, type: 'blink' },
  { t: 2.4, type: 'lock' },
  ...Array.from({ length: 9 }, (_, i) => ({ t: +(4.85 + i * 0.07).toFixed(3), type: 'blip', f: 660 + i * 60 })),
  { t: 5.35, type: 'whoosh', d: 3.6 },
  { t: 8.4, type: 'lock' },
  { t: 9.6, type: 'lock' }, { t: 9.9, type: 'dive', d: 1.3 },
  { t: 12.5, type: 'whoosh', d: 1.6 },
  { t: 13.8, type: 'chirp', d: 1.6 },
  ...[0, 1, 2, 3].map(i => ({ t: +(15.9 + i * 0.6).toFixed(2), type: 'blip', f: 990 + i * 110 })),
  { t: 18.6, type: 'lock' },
  { t: 19.5, type: 'timp' },
  { t: 21.6, type: 'lock' },
  { t: 25.2, type: 'whoosh', d: 1.3 },
  { t: 26.4, type: 'tape', d: 3.4 },
  { t: 29.8, type: 'timp' },
  { t: 31.2, type: 'lock' }, { t: 31.2, type: 'puff' },
];
