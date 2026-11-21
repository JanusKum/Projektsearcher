"""Mix for EINSTEIN IN DEINER HOSENTASCHE: score + small-machine foley (events.json) + vidIQ narration (voices/) → out/mix.wav
LIB=<library> python mix.py"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, norm, compress, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d

rng = np.random.default_rng(7)
ev = json.load(open(os.path.join(HERE, 'events.json')))
DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2))
def nz(d): return rng.standard_normal(int(round(d * SR)))
def swept(n, f0, f1):
    out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        e = min(len(n), i + hop); f = f0 + (f1 - f0) * (i / len(n)); out[i:e] = bp(n[max(0, i - 4000):e], f * .6, f * 1.4)[-(e - i):]
    return out
def blip(f, v=.5):
    d = .09; tt = t_(d); fr = f * (1 + .5 * tt / d); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / .03) * np.minimum(1, tt / .002) * v
def puff(v=.6):
    d = .25; tt = t_(d); return norm(lp(nz(d), 900) * np.exp(-tt / .06) * (1 - np.exp(-tt / .008))) * v
def shutter(v=.5):
    d = .06; tt = t_(d); return norm(hp(nz(d), 2500) * (np.exp(-tt / .004) + .6 * np.exp(-np.clip(tt - .03, 0, None) / .004) * (tt > .03))) * v
def lock(v=.7):
    d = 1.2; tt = t_(d); click = hp(nz(d), 3000) * np.exp(-tt / .002) * .7
    bell = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / tau) for f, a, tau in [(1760, 1, .35), (1760 * 2.76, .3, .12)])
    return norm(click + bell * .5) * v
def whoosh(d, v=.5, f0=300, f1=2600):
    tt = t_(d); return norm(swept(nz(d), f0, f1) * np.sin(np.pi * tt / d) ** 2) * v
def chirp(d, v=.3):
    tt = t_(d); f = 1400 + 900 * np.sin(2 * np.pi * 9 * tt)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, np.minimum(tt / .1, (d - tt) / .3)) * v * .4
def tape(d, v=.35):
    tt = t_(d); x = bp(nz(d), 1500, 4500) * (1 + .6 * np.sin(2 * np.pi * 38 * tt)); return norm(x * np.minimum(1, np.minimum(tt / .1, (d - tt) / .2))) * v
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'blip': add(fx, blip(e['f']), t, 1, 0)
    elif ty == 'puff': add(fx, puff(), t, 1, 0)
    elif ty == 'blink': add(fx, shutter(), t, 1, 0)
    elif ty == 'lock': add(fx, lock(), t, 1, 0)
    elif ty == 'whoosh': add(fx, whoosh(e['d']), t, 1, 0)
    elif ty == 'dive': add(fx, whoosh(e['d'], .6, 2600, 300), t, 1, 0)
    elif ty == 'chirp': add(fx, chirp(e['d']), t, 1, 0)
    elif ty == 'tape': add(fx, tape(e['d']), t, 1, .2)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
        if y.ndim > 1: y = y.mean(1)
        y = soxr.resample(y, sr, SR) if sr != SR else y; y = y / (np.abs(y).max() + 1e-9) * .9; add(vo, y, t, 1.0, 0)   # voice already EQ'd and lightly compressed (voices/*.wav at 48 kHz)
a, b = int(19.2 * SR), int(19.5 * SR); fx[a:b] = 0
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if msr != SR: mus = soxr.resample(mus, msr, SR)
mus = np.pad(mus[:N], ((0, max(0, N - len(mus))), (0, 0)))
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR))
k = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-14 / 20)) * k
# dip the music 300 Hz–4 kHz under the voice (the voice's band), on top of the duck
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1)
mus_d = mus - band * (0.7 * k)[:, None]
mix = mus_d * duck[:, None] * .8 + fx * .3 * (1 - .5 * k)[:, None] + vo
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
def rms(a, b, x): s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)
for name, x in [('music', mus_d * duck[:, None] * .8), ('fx', fx * .3), ('vo', vo)]: print(f'{name:6s}', ' '.join(f'{rms(a, a + 2.4, x):6.1f}' for a in np.arange(0, 33.6, 2.4)))
