"""Sound for SCHWARZES LOCH: deep drone + harp/glass score, the clock that slows (ticks computed from the same phase as the picture), redshift, dive, narration.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, math, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(9)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR)); tt = np.arange(N) / SR
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
seg = lambda a, b: np.clip((tt - a) / (b - a), 0, 1)
HUSH0, HUSH1 = 25.6, 26.0
# —— drone: sub + fifth, swelling as the fall nears the hole, gone in the hush, roaring in the dive ——
dr = (np.sin(2 * np.pi * 36.7 * tt) * .6 + np.sin(2 * np.pi * 55 * tt + .3) * .3 + lp(rng.standard_normal(N), 120) * .4)
drk = .25 + .35 * seg(4, 13) - .2 * seg(14, 16) + .1 * seg(20, 25)
drk = drk * (1 - ((tt >= HUSH0) & (tt < HUSH1))) + 1.2 * seg(26, 28.6) * (tt < 28.8)
mus += np.stack([dr * drk * .35] * 2, 1)
# —— harp / glass score: A minor, sparse; arpeggios when points gather ——
def harp(m, v, d=1.6): x = t_(d); f = mtof(m); y = (np.sin(2 * np.pi * f * x) + .4 * np.sin(4 * np.pi * f * x) * np.exp(-x / .3)) * np.exp(-x / .7); y[:48] *= np.linspace(0, 1, 48); return y * v
def glass(m, v, d=2.6): x = t_(d); f = mtof(m); y = sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x / tau) for k, a, tau in [(1, 1, 1.2), (2.76, .3, .4)]); y[:48] *= np.linspace(0, 1, 48); return y * v
def pad(ms, d, v): x = t_(d); return lp(sum(2 * ((mtof(m + dt) * x + rng.random()) % 1) - 1 for m in ms for dt in (-.06, .06)) / (2 * len(ms)), 1100) * np.minimum(1, np.minimum(x / 1.2, (d - x) / 1.2)) * v
for i, m in enumerate([57, 60, 64, 69, 72, 76, 81, 76, 72, 69, 64, 60]): add(mus, harp(m, .18), .3 + i * .2, 1, (-.4 if i % 2 else .4))
add(mus, pad([45, 52, 57, 60], 8, .12), .5, 1, 0); add(mus, pad([41, 48, 53, 57], 6, .12), 8, 1, 0); add(mus, pad([43, 50, 55, 59], 6, .1), 14, 1, 0); add(mus, pad([40, 47, 52, 55], 5.4, .1), 20, 1, 0)
for t0, m in [(4.4, 72), (8.0, 69), (9.6, 81), (14.0, 76), (20.2, 64)]: add(mus, glass(m, .2), t0, 1, 0)
for i, m in enumerate([69, 72, 76, 81, 84]): add(mus, harp(m, .2, 2.4), 28.4 + i * .18, 1, (-.3 + .15 * i))
add(mus, glass(81, .3, 3.5), 29.4, 1, 0); add(mus, pad([45, 52, 57, 64], 3.6, .16), 28.4, 1, 0)
# —— foley ——
def gather(d):   # crystalline crackle as points pull into focus
    x = t_(d); n = np.zeros(len(x)); idx = rng.integers(0, len(x), int(d * 260)); n[idx] = rng.standard_normal(len(idx)); return hp(n, 4000) * 1.2 * np.minimum(1, (d - x) / .4)
def stretch(d):  # a stretched tone bending down, with a rubbery noise
    x = t_(d); f = 220 * np.exp(-x / d * 1.4); return (np.sin(2 * np.pi * np.cumsum(f) / SR) * .4 + bp(nz(d), 200, 900) * .2) * np.sin(np.pi * x / d) * .6
def spiral(d):
    n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop): e = min(len(n), i + hop); f = 3000 - 2600 * (i / len(n)); out[i:e] = bp(n[max(0, i - 4000):e], f * .7, f * 1.3)[-(e - i):]
    x = t_(d); return norm(out * np.sin(np.pi * x / d)) * .45
def tick(v=.5): d = .05; x = t_(d); return (hp(nz(d), 3000) * np.exp(-x / .003) + np.sin(2 * np.pi * 2200 * x) * np.exp(-x / .012) * .6) * v
def redshift(d): x = t_(d); f = 660 * np.exp(-x / d * 2.0); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / (d * .5)) * .25
def dive(d):
    n = nz(d); x = t_(d); lo = lp(n, 500); hi = lp(n, 4500); k = (x / d) ** 2
    return (lo * (1 - k) + hi * k) * (x / d) ** 1.5 * .9
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'gather': add(fx, gather(e['d']), t, 1, 0)
    elif ty == 'stretch': add(fx, stretch(e['d']), t, 1, 0)
    elif ty == 'spiral': add(fx, spiral(e['d']), t, 1, 0)
    elif ty == 'rewind': add(fx, spiral(e['d'])[::-1], t, 1, 0)
    elif ty == 'redshift': add(fx, redshift(e['d']), t, 1, .2)
    elif ty == 'dive': add(fx, dive(e['d']), t, 1, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# the clock: same phase as the picture (film.js: ang/2π = .5·min(t,14) + .5·2.2·(1 − e^(−(t−14)/2.2))); a tick at every 1/12 turn while visible
phase = lambda t: .5 * min(t, 14.0) + .5 * 2.2 * (1 - math.exp(-max(0.0, t - 14.0) / 2.2))
prev = math.floor(phase(15.0) * 12)
for k in range(int(15.0 * 1000), int(25.4 * 1000)):
    t = k / 1000; n = math.floor(phase(t) * 12)
    if n != prev: add(fx, tick(.45 * (1 - .6 * max(0, (t - 20) / 5.4))), t, 1, .35); prev = n
a, b = int(HUSH0 * SR), int(HUSH1 * SR); mus[a:b] = 0; fx[a:b] = 0
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
mix = musd * .6 + fx * .55 * (1 - .3 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 32, 2))); print('music', ' '.join(f'{r(a, a + 2, musd * .6):.0f}' for a in range(0, 32, 2)))
