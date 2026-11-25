"""Sound for HEISS UND KALT: the camera (fan, scan, beeps, shutter, alarm), the oven (hum, turntable motor, ding), a cold sparse score and the narration.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(11)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
def env(d, a=.01, r=.2): x = t_(d); return np.minimum(1, np.minimum(x / a, (d - x) / r))
def ding(v=.6):   # the oven's bell: two inharmonic partials, long ring
    d = 2.2; x = t_(d); return sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / tau) for f, a, tau in [(2093, 1, .9), (2093 * 2.76, .3, .3), (2093 * .5, .2, .5)]) * v
def fan(d): x = t_(d); return (lp(nz(d), 500) * .02 + np.sin(2 * np.pi * 120 * x) * .004) * np.minimum(1, x / .5)
def scan(d): x = t_(d); n = nz(d); return (bp(n, 1500, 6000) * .25 * np.sin(np.pi * x / d) + np.sin(2 * np.pi * 100 * x) * .06) * np.sin(np.pi * x / d)
def beep(f=2400): d = .09; x = t_(d); return np.sin(2 * np.pi * f * x) * env(d, .004, .03) * .3
def nuc(): d = .12; x = t_(d); return norm(hp(nz(d), 800) * np.exp(-x / .01) + .4 * np.sin(2 * np.pi * 160 * x) * np.exp(-x / .03)) * .45
def oven(d): x = t_(d); return (np.sin(2 * np.pi * 50 * x) * .3 + np.sin(2 * np.pi * 100 * x) * .2 + lp(nz(d), 300) * .15) * env(d, .3, .3) * .35
def motor(d): x = t_(d); return np.sin(2 * np.pi * 70 * x + 2 * np.sin(2 * np.pi * .1 * x)) * .08 * env(d, .4, .3)
def click(): d = .05; x = t_(d); return hp(nz(d), 2000) * np.exp(-x / .004) * .4
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'ding': add(fx, ding(), t, 1, 0)
    elif ty == 'fan': add(fx, fan(e['d']), t, 1, 0)
    elif ty == 'scan': add(fx, scan(e['d']), t, 1, 0)
    elif ty == 'lock': add(fx, beep(2600), t, 1, .2)
    elif ty == 'nuc': add(fx, nuc(), t, 1, 0)
    elif ty == 'alarm':
        for i in range(6): add(fx, beep(1800 if i % 2 else 2400), t + i * .18, 1, 0)
    elif ty == 'oven': add(fx, oven(e['d']), t, 1, 0)
    elif ty == 'motor': add(fx, motor(e['d']), t, 1, .1)
    elif ty == 'click': add(fx, click(), t, 1, 0)
    elif ty == 'verdict': pass
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# —— score: cold and sparse (bowed vibraphone, glockenspiel, low strings), one warm chord for the verdict ——
def vib(m, d, v): x = t_(d); return (np.sin(2 * np.pi * mtof(m) * x) * (1 + .2 * np.sin(2 * np.pi * 5 * x))) * env(d, .5, .8) * v
def glock(m, v, d=1.2): x = t_(d); f = mtof(m); return sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x / tau) for k, a, tau in [(1, 1, .5), (2.76, .35, .2)]) * v
def strings(ms, d, v): x = t_(d); return lp(sum(2 * ((mtof(m + dt) * x + rng.random()) % 1) - 1 for m in ms for dt in (-.05, .05)) / (2 * len(ms)), 900) * env(d, 1.2, 1.2) * v
for t, m in [(2.2, 76), (3.0, 79), (6.6, 74), (9.6, 76), (12.2, 81), (14.2, 79), (18.2, 74), (20.6, 72)]: add(mus, vib(m, 2.6, .12), t, 1, (-.3 if m % 2 else .3))
for k in range(16): add(mus, glock([88, 84, 91, 86][k % 4], .07), 9.6 + k * .3, 1, (-.4 if k % 2 else .4))
add(mus, strings([45, 52], 11.0, .16), 6.6, 1, 0); add(mus, strings([43, 50], 6.0, .16), 18.2, 1, 0)
add(mus, strings([48, 55, 60, 64], 6.0, .22), 26.4, 1, 0)                         # the warm chord: the ring is hot everywhere
for k, m in enumerate([72, 76, 79, 84]): add(mus, glock(m, .12, 2.0), 26.4 + k * .15, 1, 0)
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
mix = hp(np.ascontiguousarray(musd[:, 0]), 40)[:, None] * 0 + musd * .8 + fx * .6 * (1 - .4 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 30, 2))); print('music', ' '.join(f'{r(a, a + 2, musd * .8):.0f}' for a in range(0, 30, 2)))
