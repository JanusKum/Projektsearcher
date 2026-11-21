"""Sound for STILLE AUS MATHEMATIK: the audible signal (same numbers as the trace), a sparse synth score, instrument foley and the narration.
LIB=<library> python mix.py   (reads events.json written by core/render/events.mjs)"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, bp, lp, hp, norm, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
rng = np.random.default_rng(31)
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; N = int(round(DUR * SR)); tt = np.arange(N) / SR
seg = lambda a, b: np.clip((tt - a) / (b - a), 0, 1)
ease = lambda k: np.where(k < .5, 4 * k ** 3, 1 - (-2 * k + 2) ** 3 / 2)
# —— the signal: identical constants to film.js (LOW, HIGH) ——
LOW = [(110, 1.0, 0.0), (165, 0.55, 1.1), (220, 0.32, 2.3)]; HIGH = (2400, 0.06, 0.4)
T = dict(ch1=1.0, merge0=16.6, merge1=17.6, pad0=22.6, pad1=24.4, off0=30.5)
low = sum(a * np.sin(2 * np.pi * f * tt + p) for f, a, p in LOW); high = HIGH[1] * np.sin(2 * np.pi * HIGH[0] * tt + HIGH[2])
on = ease(seg(T['ch1'], T['ch1'] + 0.6)) * (1 - seg(T['off0'], T['off0'] + 0.3))
cancel = 1 - ease(seg(T['merge0'] + 0.3, T['merge1']))         # the anti-noise arrives as the traces merge
pad = 1 - ease(seg(T['pad0'], T['pad1']))
sig = (low * cancel + high * pad) * on
sig = sig / 2.0 * 0.22                                            # quiet bed: −13 dBFS peak before the mix
# —— score: soft plucks and bells, tied to the beats of the picture; nothing after the cancel until the title ——
mus = np.zeros((N, 2)); mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
def pluck(m, d, v, bright=1.0):
    x = t_(d); f = mtof(m); y = np.sin(2 * np.pi * f * x + bright * 1.2 * np.exp(-x / .08) * np.sin(2 * np.pi * f * 2 * x)) * np.exp(-x / .5)
    y[:64] *= np.linspace(0, 1, 64); return y * v
def bell(m, d, v):
    x = t_(d); f = mtof(m); y = sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x / tau) for k, a, tau in [(1, 1, 1.2), (2.76, .35, .4), (5.4, .15, .15)]); y[:64] *= np.linspace(0, 1, 64); return y * v
def padc(ms, d, v):
    x = t_(d); y = sum(np.sin(2 * np.pi * mtof(m) * x) + .3 * np.sin(4 * np.pi * mtof(m) * x) for m in ms) / len(ms)
    return y * np.minimum(1, np.minimum(x / 1.0, (d - x) / 1.0)) * v
A = 45  # A2 — a minor, the hum's own key (110 Hz = A2)
for i, t in enumerate(np.arange(1.0, 16.6, 0.625)):
    m = [57, 60, 64, 67, 64, 60][i % 6] + (2 if t > 11.8 else 0)
    add(mus, pluck(m, .8, .16, 0.4 + 0.6 * min(1, t / 16)), t, 1, (-.3 if i % 2 else .3))
add(mus, padc([A + 12, A + 19, A + 24], 15.6, .12), 1.0, 1, 0)
add(mus, bell(76, 2.5, .25), 4.3, 1, 0); add(mus, bell(79, 2.5, .22), 11.8, 1, 0)
add(mus, bell(81, 3.0, .3), T['merge1'], 1, 0)                  # the moment of silence gets one bell, then nothing
for k, m in enumerate([69, 72, 76, 81]): add(mus, bell(m, 3.0, .22), 25.6 + k * .3, 1, (-.3 + .2 * k))
add(mus, padc([A + 12, A + 16, A + 19, A + 24], 5.0, .12), 25.6, 1, 0)
# —— foley ——
fx = np.zeros((N, 2)); nz = lambda d: rng.standard_normal(int(round(d * SR)))
def relay(): d = .12; x = t_(d); return norm(hp(nz(d), 1500) * np.exp(-x / .004) + .5 * np.sin(2 * np.pi * 180 * x) * np.exp(-x / .02)) * .6
def blip(f): d = .07; x = t_(d); return np.sin(2 * np.pi * f * x) * np.exp(-x / .02) * .35
def detent(): d = .05; x = t_(d); return norm(bp(nz(d), 2500, 6000) * np.exp(-x / .004)) * .45
def sweep(d):
    n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        e = min(len(n), i + hop); f = 400 + 3000 * (i / len(n)); out[i:e] = bp(n[max(0, i - 4000):e], f * .7, f * 1.3)[-(e - i):]
    x = t_(d); return norm(out * np.sin(np.pi * x / d) ** 2) * .3
def zap(): d = .6; x = t_(d); f = 2000 * np.exp(-x / .12) + 60; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / .25) * .45
vo = np.zeros((N, 2))
for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'relay': add(fx, relay(), t, 1, 0)
    elif ty == 'blip': add(fx, blip(e['f']), t, 1, 0)
    elif ty == 'detent': add(fx, detent(), t, 1, .2)
    elif ty == 'sweep': add(fx, sweep(e['d']), t, 1, 0)
    elif ty == 'zap': add(fx, zap(), t, 1, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = soxr.resample(y, sr, SR) if sr != SR else y; add(vo, y / (np.abs(y).max() + 1e-9) * .9, t, 1, 0)
hum = (np.sin(2 * np.pi * 50 * tt) * .5 + np.sin(2 * np.pi * 100 * tt) * .3) * 0.004 * (1 - seg(30.6, 31.0))   # the instrument's own faint mains hum
venv = uniform_filter1d(maximum_filter1d(np.abs(vo).max(1), int(.25 * SR)), int(.12 * SR)); k = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-10 / 20)) * k
band = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); musd = (mus - band * (.6 * k)[:, None]) * duck[:, None]
sigd = sig * (1 - .45 * k)                                         # the signal makes some room too, but stays audible
mix = musd * .7 + fx * .5 + vo + np.stack([sigd + hum, sigd + hum], 1)
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .7), limit(mix[:, 1], .7)], 1) / .7 * .85
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
r = lambda a, b, x: 20 * np.log10(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print('signal dB:', ' '.join(f'{r(a, a + 2, sig):.0f}' for a in range(0, 30, 2)))
print('voice  dB:', ' '.join(f'{r(a, a + 2, vo):.0f}' for a in range(0, 30, 2)))
