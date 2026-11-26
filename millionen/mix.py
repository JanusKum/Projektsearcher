"""Sound for EINE MILLION: a night field (crickets, soft wind), a slow harp/glass/strings score, a swelling granular stream as the Milky Way pours
into orbit, an impact on "eine Million", a dense shimmering swarm over the ground sky, and the return. Narration over it.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(21)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR)); tt = np.arange(N) / SR
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
def env(d, a=.5, r=.5): x = t_(d); return np.minimum(1, np.minimum(x / a, (d - x) / r))
def night(d):   # crickets: chirp trains at ~4.5 kHz, plus a soft wind
    x = t_(d); out = np.zeros_like(x)
    for c in range(5):
        f = 4200 + c * 260; ph = rng.random() * 6; rate = 2.6 + .5 * c
        gate = (np.sin(2 * np.pi * rate * x + ph) > .55) * (np.sin(2 * np.pi * 28 * x) > 0)
        out += np.sin(2 * np.pi * f * x) * gate * .05
    return (lp(out, 8000) + lp(nz(d), 350) * .06) * env(d, 1.0, 1.0)
def rise(d): n = nz(d); x = t_(d); return lp(n, 900) * (x / d) ** 2 * np.minimum(1, (d - x) / .3) * .5
def gather(): d = 1.6; x = t_(d); n = np.zeros(len(x)); idx = rng.integers(0, len(x), 500); n[idx] = rng.standard_normal(len(idx)); return hp(n, 3500) * np.minimum(1, (d - x) / .5) * .9
def chime(m=84, v=.25): d = 2.6; x = t_(d); f = mtof(m); return sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x / tau) for k, a, tau in [(1, 1, 1.1), (2.76, .3, .35)]) * v
def boom(soft=0): d = 3.0; x = t_(d); f = 38 + 50 * np.exp(-x / .08); return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 1.1) * 2.2) * (.45 if soft else .9)
def flood(d):   # a granular stream that thickens and rises in pitch: every grain a point falling into orbit
    x = t_(d); out = np.zeros_like(x); dens = (x / d) ** 1.6
    for k in range(int(d * 900)):
        u = rng.random() ** .6; s = int(u * (len(x) - 2000)); f = 900 + 3200 * u + rng.random() * 400; L = 1200
        g = np.sin(2 * np.pi * f * np.arange(L) / SR) * np.hanning(L) * .03; out[s:s + L] += g
    return out * env(d, .4, .3) + lp(nz(d), 300 + 1500 * 0) * dens * .12
def whoosh(d):
    n = nz(d); o = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop): e = min(len(n), i + hop); f = 400 + 2600 * (i / len(n)); o[i:e] = bp(n[max(0, i - 4000):e], f * .6, f * 1.4)[-(e - i):]
    x = t_(d); return norm(o * np.sin(np.pi * x / d) ** 2) * .4
def swarm(d):   # a dense high shimmer: thousands of tiny moving lights
    x = t_(d); n = nz(d); return (bp(n, 5000, 9000) * (1 + .4 * np.sin(2 * np.pi * .3 * x)) * .05 + bp(n, 1800, 2600) * .015) * env(d, 1.2, 1.5)
def lift(d): return flood(d)[::-1] * .8
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'night': add(fx, night(e['d']), t, 1, 0)
    elif ty == 'rise': add(fx, rise(e['d']), t, 1, 0)
    elif ty == 'gather': add(fx, gather(), t, 1, .2)
    elif ty == 'chime': add(fx, chime(), t, 1, 0)
    elif ty == 'boom': add(fx, boom(e.get('soft', 0)), t, 1, 0)
    elif ty == 'flood': add(fx, flood(e['d']), t, 1, 0)
    elif ty == 'whoosh': add(fx, whoosh(e['d']), t, 1, 0)
    elif ty == 'swarm': add(fx, swarm(e['d']), t, 1, 0)
    elif ty == 'lift': add(fx, lift(e['d']), t, 1, 0)
    elif ty == 'chord':
        for k, m in enumerate([57, 64, 69, 72, 76]): add(fx, chime(m, .16), t + k * .08, 1, (-.3 + .15 * k))
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# —— score: A minor → F → C → G, harp arpeggios and long strings; darker under the swarm; the return in A major ——
def harp(m, v, d=1.8): x = t_(d); f = mtof(m); y = (np.sin(2 * np.pi * f * x) + .35 * np.sin(4 * np.pi * f * x) * np.exp(-x / .3)) * np.exp(-x / .8); y[:48] *= np.linspace(0, 1, 48); return y * v
def strings(ms, d, v, cut=1000): x = t_(d); return lp(sum(2 * ((mtof(m + dt) * x + rng.random()) % 1) - 1 for m in ms for dt in (-.05, .05)) / (2 * len(ms)), cut) * env(d, 1.5, 1.5) * v
PROG = [(0, [57, 60, 64]), (6.6, [53, 57, 60]), (11.4, [48, 52, 55]), (20.0, [55, 59, 62]), (25.6, [57, 60, 64]), (33.4, [53, 57, 60]), (41.6, [50, 53, 57]), (49.0, [52, 55, 59]), (53.6, [57, 61, 64])]
for k, (t0, ch) in enumerate(PROG):
    t1 = PROG[k + 1][0] if k + 1 < len(PROG) else 61.5
    add(mus, strings([ch[0] - 12] + ch, t1 - t0 + 1.0, .1 if k not in (4, 6) else .14, 900 if k != 8 else 1500), t0, 1, 0)
    n = int((t1 - t0) / .5)
    for i in range(n):
        if k == 6 and i % 2: continue   # sparser under the swarm
        add(mus, harp(ch[i % 3] + 12 * ((i // 3) % 2), .1), t0 + i * .5, 1, (-.35 if i % 2 else .35))
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
fxl = np.stack([limit(fx[:, 0], .6), limit(fx[:, 1], .6)], 1)
mix = musd * .85 + fxl * .6 * (1 - .3 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 4, vo):.0f}' for a in range(0, 60, 4))); print('music', ' '.join(f'{r(a, a + 4, musd * .85):.0f}' for a in range(0, 60, 4)))
