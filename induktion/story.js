// Timeline: 96 BPM, 1 beat = 0.625 s, 1 bar = 2.5 s, 12 bars = 30 s. Every cut lands on a bar line; score, foley and light read the same numbers.
export const BPM = 96, BEAT = 60 / 96, BAR = BEAT * 4;
export const DUR = 30;
export const b = n => n * BAR;

export const T = {
  sweep1: [0.15, 1.45], sweep2: [2.6, 3.9],
  clear: [5.6, 8.4],                     // frosted plate turns clear
  rack: [7.6, 9.2],                      // focus: glass surface → coil
  explode: [15.0, 17.5], hush: 19.375, snap: 20.0,   // apart → hover → total silence 19.375–20.0 → snap on the downbeat 20.0, push-in after it
  bowlDown: [21.25, 22.2],               // glass bowl settles on the plate (glass-on-glass tick)
  title: [25.0, 30.0],
};

export const SHOTS = [
  [0, 5, 'hook'], [5, 10, 'reveal'], [10, 15, 'current'], [15, 21.25, 'explode'], [21.25, 25, 'bowl'], [25, 30, 'end'],
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

// Current pulses in the coil: on every eighth from bar 4 (t = 10) to the silence; in the bowl shot and the ending on quarters
export const PULSES = [];
for (let t = b(4); t < 19.3; t += BEAT / 2) PULSES.push({ t: +t.toFixed(4), big: Math.abs((t / BAR) % 1) < 1e-6 });
for (let t = b(8); t < 29.4; t += BEAT) PULSES.push({ t: +t.toFixed(4), big: Math.abs((t / BAR) % 1) < 1e-6 });

// Narration (de-DE-ConradNeural)
export const VO = [
  { id: 'v1', t: 0.65, text: 'Dieser Herd kocht. Aber er wird nicht heiß.' },
  { id: 'v2', t: 5.45, text: 'Unter dem Glas liegt eine Kupferspule.' },
  { id: 'v3', t: 10.3, text: 'Der Strom wechselt 20.000-mal pro Sekunde.' },
  { id: 'v4', t: 15.25, text: 'Das Magnetfeld geht durchs Glas – und erzeugt Wirbelströme im Topf.' },
  { id: 'v5', t: 21.75, text: 'Ein Glastopf? Bleibt kalt.' },
  { id: 'v6', t: 25.7, text: 'Die Hitze entsteht im Topf selbst.' },
];

export const SFX = [
  { t: 0.1, type: 'sweep', d: 1.4, pan: [-.8, .8], v: .5 },
  { t: 2.55, type: 'sweep', d: 1.4, pan: [.8, -.8], v: .45 },
  { t: 0.0, type: 'sizzle', d: 5.0, v: .22 },
  { t: 5.0, type: 'ding', v: .55 },
  { t: 5.6, type: 'frost', d: 2.8, v: .35 },
  { t: 10.0, type: 'hum', d: 9.3, v: .16 },
  ...[0, 1, 2, 3, 4].map(i => ({ t: 15.02 + i * .09, type: 'puff', v: .3 + (i % 2) * .06, pan: -.5 + i * .25 })),
  { t: 15.0, type: 'slowwhoosh', d: 2.6, v: .45 },
  { t: 19.45, type: 'revwhoosh', d: .5, v: .8 },
  { t: 20.0, type: 'snap', v: 1.0 },
  { t: 22.2, type: 'tick', v: .7 },
  { t: 25.0, type: 'sweep', d: 1.4, pan: [-.8, .8], v: .45 },
  { t: 25.0, type: 'sizzle', d: 5.0, v: .2 },
];
