"""Sound for FACE ID: a synth score on a 120-BPM grid (arp, pulse bass, hats, claps, saw pads), UI foley locked to the picture, the narration.
LIB=<library> python mix.py   (reads events.json from core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(3)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12); BEAT = .5; HUSH0, HUSH1 = 17.5, 18.0
def env(d, a=.005, r=.1): x = t_(d); return np.minimum(1, np.minimum(x / a, (d - x) / r))
def boom(): d = 1.6; x = t_(d); f = 45 + 120 * np.exp(-x / .05); return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / .5) * 2) * .9
def spray(d): x = t_(d); n = nz(d); k = np.zeros_like(n); idx = rng.integers(0, len(n), int(d * 900)); k[idx] = rng.standard_normal(len(idx)); return (hp(k, 3000) * 1.5 + bp(n, 4000, 9000) * .08) * np.minimum(1, (d - x) / .4)
def ping(f=1760): d = .6; x = t_(d); m = np.sin(2 * np.pi * f * 2.01 * x) * 2 * np.exp(-x / .05); return np.sin(2 * np.pi * f * x + m) * np.exp(-x / .25) * .35
def scan(d):
    n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        e = min(len(n), i + hop); f = 300 + 5000 * (i / len(n)); out[i:e] = bp(n[max(0, i - 4000):e], f * .7, f * 1.3)[-(e - i):]
    x = t_(d); return norm(out * np.sin(np.pi * x / d)) * .35
def lock(): d = .3; x = t_(d); return (np.sin(2 * np.pi * 2400 * x) * np.exp(-x / .03) + hp(nz(d), 4000) * np.exp(-x / .004) * .6) * .45
def ratchet():
    out = np.zeros(int(.6 * SR))
    for k in range(14): s = int(k * .04 * SR); c = hp(nz(.01), 3000) * np.exp(-t_(.01) / .002) * .4; out[s:s + len(c)] += c
    return out
def whip(d): x = t_(d); n = nz(d); return norm(bp(n, 800, 5000) * np.sin(np.pi * x / d) ** 3) * .5
def slide(): d = .5; x = t_(d); return norm(bp(nz(d), 300, 1500) * np.sin(np.pi * x / d)) * .3
def deny():
    d = .7; x = t_(d); a = np.sign(np.sin(2 * np.pi * 220 * x)) * (x < .25) + np.sign(np.sin(2 * np.pi * 165 * x)) * (x > .3) * (x < .6)
    b = np.zeros_like(x); bb = boom()[:len(x)]; b[:len(bb)] = bb
    return lp(a, 3000) * .3 + b * .6
def unlock(): d = .8; x = t_(d); return sum(np.sin(2 * np.pi * mtof(m) * x) * np.exp(-np.clip(x - o, 0, None) / .3) * (x >= o) for m, o in [(79, 0), (83, .08), (86, .16), (91, .24)]) * .25
def ignite():
    d = 2.0; x = t_(d); n = nz(d); b = np.zeros_like(x); bb = boom()[:len(x) - int(1.6 * SR)]; b[int(1.6 * SR):int(1.6 * SR) + len(bb)] = bb
    return (bp(n, 200, 3000) * (x / d) ** 2 * .5 + b) * env(d, .01, .2)
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'boom': add(fx, boom(), t, 1, 0)
    elif ty == 'spray': add(fx, spray(e['d']), t, 1, .2)
    elif ty == 'ping': add(fx, ping(), t, 1, 0)
    elif ty == 'scan': add(fx, scan(e['d']), t, 1, 0)
    elif ty == 'lock': add(fx, lock(), t, 1, .2)
    elif ty == 'ratchet': add(fx, ratchet(), t, 1, -.2)
    elif ty == 'whip': add(fx, whip(e['d']), t, 1, 0)
    elif ty == 'slide': add(fx, slide(), t, 1, 0)
    elif ty == 'deny': add(fx, deny(), t, 1, 0)
    elif ty == 'unlock': add(fx, unlock(), t, 1, 0)
    elif ty == 'ignite': add(fx, ignite(), t - 1.6, 1, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
# —— score: D minor; arp in 16ths (ping-pong), 8th pulse bass, hats, claps on 2/4; true silence 17.5–18.0; drop on the reject; half-time under the title ——
def saw(f, d): x = t_(d); return 2 * ((f * x) % 1) - 1
def pluck(m, v): d = .22; x = t_(d); return lp(saw(mtof(m), d), 2200) * np.exp(-x / .07) * v
def bassn(m, v, d=.24): x = t_(d); f = mtof(m); y = np.sign(np.sin(2 * np.pi * f * x)) * .5 + np.sin(2 * np.pi * f * x); return lp(y, 700) * env(d, .003, .05) * v
def hat(v): d = .04; x = t_(d); return hp(nz(d), 7000) * np.exp(-x / .01) * v
def clap(v): d = .2; x = t_(d); e = sum(np.exp(-np.clip(x - o, 0, None) / .008) * (x >= o) for o in (0, .01, .02)) + .5 * np.exp(-x / .07); return bp(nz(d), 900, 4000) * e * v
def pad(ms, d, v): x = t_(d); return lp(sum(saw(mtof(m + dt), d) for m in ms for dt in (-.08, .08)) / (2 * len(ms)), 1400) * env(d, .8, .8) * v
CH = [[62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 70], [57, 61, 64, 67]]   # Dm9-ish / Bb / C / A
for bar in range(15):
    b0 = bar * 4 * BEAT; ch = CH[bar % 4]; half = b0 >= 24
    for k in range(16):
        tt = b0 + k * BEAT / 4
        if HUSH0 <= tt < HUSH1 or tt >= 29.5: continue
        if not half or k % 2 == 0: add(mus, pluck(ch[k % 4] + (12 if k % 8 >= 4 else 0), .16), tt, 1, (-.5 if k % 2 else .5))
        if k % 2 == 0 and b0 >= 2: add(mus, hat(.12 if k % 4 else .2), tt, 1, .3)
    for k in range(8):
        tt = b0 + k * BEAT / 2
        if HUSH0 <= tt < HUSH1 or tt >= 29.5 or b0 < 2: continue
        if not half or k % 2 == 0: add(mus, bassn(ch[0] - 24, .4), tt, 1, 0)
    for o in (1, 3):
        tt = b0 + o * BEAT
        if b0 >= 4 and not (HUSH0 <= tt < HUSH1) and tt < 29.5: add(mus, clap(.3 if not half else .18), tt, 1, 0)
    if not (HUSH0 - 2 < b0 < HUSH1): add(mus, pad(ch, 2.0, .1), b0, 1, 0)
# the drop on the reject: 808 glide + wide saw chord
x = t_(1.6); f = mtof(38) * (1 + .5 * np.exp(-x / .04)) * (1 - .1 * x / 1.6); add(mus, np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * 1.8) * np.exp(-x / .8) * .7, 18.0, 1, 0)
add(mus, pad([50, 57, 62, 65, 69], 2.0, .18), 18.0, 1, 0)
a, b = int(HUSH0 * SR), int(HUSH1 * SR); mus[a:b] = 0; fx[a:b] = 0
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); kv = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * kv
band = np.stack([bp(mus[:, c], 1000, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * kv)[:, None]) * duck[:, None]
fxl = np.stack([limit(fx[:, 0], .6), limit(fx[:, 1], .6)], 1)
mix = musd * .28 + fxl * .5 * (1 - .35 * kv)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('voice', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 30, 2))); print('music', ' '.join(f'{r(a, a + 2, musd * .28):.0f}' for a in range(0, 30, 2)))
