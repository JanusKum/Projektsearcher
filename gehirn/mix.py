"""Sound for DEIN GEHIRN LÜGT: a 120-BPM surf/lounge groove (bass, bongos, claps, vibraphone), print-shop foley and the narration.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(5)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12); BEAT = .5
HUSH0, HUSH1 = 20.0, 20.5
# —— foley ——
def stamp(big=0):
    d = .35; x = t_(d); body = np.sin(2 * np.pi * (70 + 60 * np.exp(-x / .02)) * x) * np.exp(-x / .09)
    slap = bp(nz(d), 900, 4000) * np.exp(-x / .012) * .6
    return norm(body + slap) * (.95 if big else .5)
def thunk(): d = .2; x = t_(d); return norm(np.sin(2 * np.pi * 110 * x) * np.exp(-x / .05) + bp(nz(d), 300, 1500) * np.exp(-x / .01) * .4) * .55
def flick(f): d = .08; x = t_(d); return (bp(nz(d), 2000, 7000) * np.exp(-x / .008) * .5 + np.sin(2 * np.pi * f * x) * np.exp(-x / .03) * .35)
def zip_(): d = .14; x = t_(d); f = 600 + 4000 * x / d; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / d) * .3 + bp(nz(d), 3000, 8000) * np.sin(np.pi * x / d) * .2
def whoosh(d):
    n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        e = min(len(n), i + hop); f = 300 + 2500 * (i / len(n)); out[i:e] = bp(n[max(0, i - 4000):e], f * .6, f * 1.4)[-(e - i):]
    x = t_(d); return norm(out * np.sin(np.pi * x / d) ** 2) * .5
def snip(): d = .12; x = t_(d); return norm(hp(nz(d), 3500) * (np.exp(-x / .006) + .7 * np.exp(-np.clip(x - .04, 0, None) / .006) * (x > .04))) * .6
def slide(): d = .35; x = t_(d); return norm(bp(nz(d), 500, 3000) * np.sin(np.pi * x / d)) * .35
def flip(): d = .18; x = t_(d); return norm(bp(nz(d), 1500, 6000) * np.exp(-x / .02) + bp(nz(d), 400, 1200) * np.exp(-np.clip(x - .07, 0, None) / .02) * (x > .07)) * .55
def tick(big=0): d = .2; x = t_(d); return norm(hp(nz(d), 2000) * np.exp(-x / .004) + np.sin(2 * np.pi * 1800 * x) * np.exp(-x / .03) * .5) * (.8 if big else .5)
SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93]
nflick = 0
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'stamp': add(fx, stamp(e.get('big', 0)), t, 1, 0); add(fx, flick(mtof(SCALE[e['note'] % 10]))[:] * .6, t, 1, 0) if 'note' in e else None
    elif ty == 'thunk': add(fx, thunk(), t, 1, 0)
    elif ty == 'flick': add(fx, flick(mtof(SCALE[nflick % 10] - 12)), t, 1, (-.4 if nflick % 2 else .4)); nflick += 1
    elif ty == 'zip': add(fx, zip_(), t, 1, 0)
    elif ty == 'whoosh': add(fx, whoosh(e['d']), t, 1, 0)
    elif ty == 'snip': add(fx, snip(), t, 1, .2)
    elif ty == 'slide': add(fx, slide(), t, 1, -.2)
    elif ty == 'flip': add(fx, flip(), t, 1, 0)
    elif ty == 'tick': add(fx, tick(e.get('big', 0)), t, 1, .1)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# —— groove: E minor surf: bass on 1 and the & of 2, bongos on offbeats, claps on 2 and 4, vibraphone stabs ——
def bass(m, d, v): x = t_(d); f = mtof(m); y = np.sin(2 * np.pi * f * x) + .35 * np.sin(4 * np.pi * f * x) + .15 * np.sin(6 * np.pi * f * x); return np.tanh(y * 1.2) * np.exp(-x / .35) * np.minimum(1, x / .004) * v
def bongo(hi, v): d = .15; x = t_(d); f = (380 if hi else 260) * (1 + .3 * np.exp(-x / .01)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / .05) * v
def clap(v): d = .2; x = t_(d); e = sum(np.exp(-np.clip(x - o, 0, None) / .008) * (x >= o) for o in (0, .01, .02)) + .5 * np.exp(-x / .07); return bp(nz(d), 900, 4000) * e * v
def vib(ms, d, v): x = t_(d); return sum(np.sin(2 * np.pi * mtof(m) * x) * (1 + .25 * np.sin(2 * np.pi * 6 * x)) for m in ms) / len(ms) * np.exp(-x / .8) * np.minimum(1, x / .005) * v
def shaker(v): d = .06; x = t_(d); return hp(nz(d), 6000) * np.exp(-x / .015) * v
PROG = [(40, [64, 67, 71]), (40, [64, 67, 71]), (36, [60, 64, 67]), (38, [62, 66, 69])]   # Em Em C D
for bar in range(15):
    b0 = bar * 4 * BEAT
    if b0 >= 29.5: break
    root, ch = PROG[bar % 4]; strip_ = HUSH0 - 2.0 <= b0 < HUSH1 + .1
    for o, m in [(0, root), (1.5, root), (2.5, root + 7), (3, root + 12)]:
        tt = b0 + o * BEAT
        if not (HUSH0 <= tt < HUSH1): add(mus, bass(m, .45, .55), tt, 1, 0)
    if not strip_:
        for k in range(8):
            tt = b0 + k * BEAT / 2
            if not (HUSH0 <= tt < HUSH1): add(mus, bongo(k % 2, .25 if k % 2 else .15), tt, 1, (-.3 if k % 2 else .3)); add(mus, shaker(.08), tt + BEAT / 4, 1, .4)
        for o in (1, 3): add(mus, clap(.35), b0 + o * BEAT, 1, 0)
        for o in (0, 1.5): add(mus, vib(ch, 1.0, .18), b0 + o * BEAT, 1, -.2)
# the held low note before the turn, then the groove restarts on the flip
add(mus, bass(28, .5, .7) * 0, HUSH0, 1, 0)
x = t_(.5); add(mus, np.sin(2 * np.pi * mtof(40) * x) * .35 * np.minimum(1, (0.5 - x) / .05), HUSH0, 1, 0)
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
fxl = np.stack([limit(fx[:, 0], .6), limit(fx[:, 1], .6)], 1)   # stamps are hot: limit before the master
mix = musd * .42 + fxl * .55 * (1 - .35 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 30, 2))); print('music', ' '.join(f'{r(a, a + 2, musd * .42):.0f}' for a in range(0, 30, 2)))
