"""Sound for UNSICHTBAR: night ambience, sonar pings with echoes (pulses on the picture's times), a metallic ring when the scan meets a plane,
low strings and bowed vibraphone, a vibraphone pulse when a signal comes back, a near silence before the end, one bright chord. Narration over it.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(4)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR)); tt = np.arange(N) / SR
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
HUSH0, HUSH1 = 29.6, 30.0
def env(d, a=.005, r=.1): x = t_(d); return np.minimum(1, np.minimum(x / a, (d - x) / r))
def ping(v=.5, f=1400):
    d = 1.6; x = t_(d); y = np.zeros_like(x)
    for k, (dl, g) in enumerate([(0, 1), (.32, .35), (.64, .14)]):
        m = x >= dl; xx = x[m] - dl; y[m] += np.sin(2 * np.pi * f * xx) * np.exp(-xx / .25) * g
    return y * v
def surge(): d = .9; x = t_(d); return norm(lp(nz(d), 900) * np.sin(np.pi * x / d) ** 2) * .3
def ring(): d = 2.0; x = t_(d); return sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / tau) for f, a, tau in [(620, 1, .9), (620 * 2.76, .35, .4), (620 * 5.4, .12, .2)]) * .25
def echo(big=0): d = .8; x = t_(d); return np.sin(2 * np.pi * 980 * x) * np.exp(-x / .2) * (.5 if big else .3)
def fizz(): d = .6; x = t_(d); return hp(nz(d), 3000) * np.exp(-x / .15) * .2
def nothing(): d = 1.2; x = t_(d); return np.sin(2 * np.pi * 330 * x) * (x < .12) * .25 + np.sin(2 * np.pi * 247 * x) * ((x > .2) & (x < .5)) * .25
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'ping': add(fx, ping(.25 if e.get('soft') else .45), t, 1, 0)
    elif ty == 'surge': add(fx, surge(), t, 1, 0)
    elif ty == 'ring': add(fx, ring(), t, 1, .1)
    elif ty == 'echo': add(fx, echo(e.get('big', 0)), t, 1, 0)
    elif ty == 'fizz': add(fx, fizz(), t, 1, .2)
    elif ty == 'nothing': add(fx, nothing(), t, 1, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# night wind bed
wind = lp(rng.standard_normal(N), 300) * (1 + .5 * np.sin(2 * np.pi * .07 * tt)) * .05
mus += np.stack([wind, np.roll(wind, 4000)], 1)
def strings(ms, d, v): x = t_(d); return lp(sum(2 * ((mtof(m + dt) * x + rng.random()) % 1) - 1 for m in ms for dt in (-.05, .05)) / (2 * len(ms)), 800) * np.minimum(1, np.minimum(x / 1.5, (d - x) / 1.5)) * v
def vib(m, d, v, bowed=True): x = t_(d); y = np.sin(2 * np.pi * mtof(m) * x) * (1 + .2 * np.sin(2 * np.pi * 5 * x)); return y * (np.minimum(1, np.minimum(x / .8, (d - x) / .8)) if bowed else np.exp(-x / .8)) * v
add(mus, strings([38, 45, 50], 7, .2), 0, 1, 0); add(mus, strings([36, 43, 48], 6, .2), 6.8, 1, 0); add(mus, strings([41, 48, 53], 7.5, .2), 12.4, 1, 0)
add(mus, strings([38, 45, 50, 53], 5.7, .2), 19.8, 1, 0); add(mus, strings([34, 41, 46], 4.1, .18), 25.5, 1, 0)
add(mus, vib(74, 6, .1), .5, 1, -.3); add(mus, vib(69, 5, .08), 20, 1, .3)
for t0 in (9.2, 11.6, 14.8, 17.4): 
    for k in range(4): add(mus, vib([74, 77, 81, 77][k], .6, .12, False), t0 + k * .15, 1, (-.3 if k % 2 else .3))   # signal comes back
for i, m in enumerate([50, 57, 62, 66, 69, 74]): add(mus, vib(m, 3.6, .1), 32.4 + i * .05, 1, (-.3 + .12 * i))   # the bright chord
a, b = int(HUSH0 * SR), int(HUSH1 * SR); mus[a:b] *= .05; fx[a:b] = 0
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
mix = musd * .7 + fx * .5 * (1 - .3 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 36, 2))); print('music', ' '.join(f'{r(a, a + 2, musd * .7):.0f}' for a in range(0, 36, 2)))
