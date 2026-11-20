"""Mix for INDUKTION: score (music/score.wav) + glass/metal/electric foley (events.json) + narration (voices/) → out/mix.wav (48 kHz stereo)
LIB=<library> python mix.py"""
import json, os, sys, numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, norm, compress, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d

rng = np.random.default_rng(31)
ev = json.load(open(os.path.join(HERE, 'events.json')))
DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2))
HUSH, DROP = 19.375, 20.0


def nz(d): return rng.standard_normal(int(round(d * SR)))


def swept_bp(n, f0, f1, wl=.6, wh=1.4):
    out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        e = min(len(n), i + hop); f = f0 + (f1 - f0) * (i / len(n))
        out[i:e] = bp(n[max(0, i - 4000):e], f * wl, f * wh)[-(e - i):]
    return out


def sweep(d, v):
    """Strip-light sweep over glass: rising band-passed shimmer + inharmonic partials"""
    tt = t_(d); out = swept_bp(nz(d), 2500, 8000, .8, 1.25)
    part = sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) for f, a in [(2349, .5), (3520, .35), (4699, .25), (6272, .15)])
    return norm((out * .7 + part * .12) * np.sin(np.pi * tt / d) ** 2) * v


def panned(buf, x, at, p0, p1):
    s = int(at * SR); n = len(x); pan = np.linspace(p0, p1, n)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); e = min(len(buf), s + n)
    buf[s:e, 0] += x[:e - s] * l[:e - s] * 1.414; buf[s:e, 1] += x[:e - s] * r[:e - s] * 1.414


def sizzle(d, v):
    """Hot pan: soft crackle (sparse random clicks through a band-pass) over a faint hiss"""
    n = int(d * SR); x = np.zeros(n); k = rng.integers(0, n, int(d * 140))
    x[k] = rng.standard_normal(len(k)) * rng.random(len(k)) ** 2
    x = bp(x, 2500, 9000) * 3 + bp(nz(d), 4000, 10000) * .08
    e = np.minimum(1, np.minimum(t_(d) / .6, (d - t_(d)) / .6)); return norm(x * e) * v


def frost(d, v):
    """Frost clearing: fine crystalline crackle that thins out"""
    n = int(d * SR); x = np.zeros(n); k = rng.integers(0, n, int(d * 260)); x[k] = rng.standard_normal(len(k))
    x = hp(x, 5000) * np.exp(-t_(d) / (d * .5)); tt = t_(d)
    x += sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(5274, .03), (7040, .02)]) * np.exp(-tt / (d * .4))
    return norm(x) * v


def hum(d, v):
    """Coil hum: a faint high whine with a low electrical buzz (the real coil runs above hearing; this is its stand-in)"""
    tt = t_(d); x = .5 * np.sin(2 * np.pi * 100 * tt) + .25 * np.sin(2 * np.pi * 200 * tt) + .12 * np.sin(2 * np.pi * 6300 * tt)
    x += bp(nz(d), 5800, 6800) * .05
    e = np.minimum(1, np.minimum(tt / .8, (d - tt) / .3)); return norm(x * e) * v


def mag_click(v=1.0):
    d = .12; tt = t_(d)
    tr = hp(nz(d), 3000) * env_exp(d, .0012)
    res = sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) * env_exp(d, tau) for f, a, tau in [(3300, .55, .018), (4900, .35, .012), (1800, .3, .025)])
    body = np.sin(2 * np.pi * 110 * tt * (1 - .3 * tt)) * env_exp(d, .018) * .6
    return norm(tr + res + body) * v


def glass_ding(freqs, d=2.4, v=1.0):
    tt = t_(d); x = np.zeros_like(tt)
    for f in freqs:
        for m, a, tau in [(1, 1, .9), (2.76, .35, .4), (5.4, .15, .18)]:
            x += a * np.sin(2 * np.pi * f * m * tt + rng.random() * 6) * env_exp(d, tau)
    x[:96] *= np.linspace(0, 1, 96); return norm(x) * v


def glass_tick(v):
    d = .5; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(2900, 1, .12), (4100, .5, .07), (7300, .25, .04)])
    x += hp(nz(d), 4000) * env_exp(d, .002) * .5; return norm(x) * v


def whoosh_air(d, v, f0=500, f1=2200, rev=False):
    tt = t_(d); out = swept_bp(nz(d), f0, f1)
    e = (tt / d) ** 3 if rev else np.sin(np.pi * tt / d) ** 2
    if rev: e[-int(.01 * SR):] *= np.linspace(1, 0, int(.01 * SR))
    return norm(out * e) * v


def puff(v):
    d = .22; tt = t_(d); return norm(lp(nz(d), 900) * env_exp(d, .05) * (1 - np.exp(-tt / .008))) * v


for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'sweep': panned(fx, sweep(e['d'], e['v']), t, *e['pan'])
    elif ty == 'sizzle': add(fx, sizzle(e['d'], e['v']), t, 1, 0)
    elif ty == 'ding': add(fx, glass_ding((1175, 1760), 2.6, e['v']), t, 1, 0)
    elif ty == 'frost': add(fx, frost(e['d'], e['v']), t, 1, 0)
    elif ty == 'hum': add(fx, hum(e['d'], e['v']), t, 1, 0)
    elif ty == 'puff': add(fx, puff(e['v']), t, 1, e.get('pan', 0))
    elif ty == 'slowwhoosh': add(fx, whoosh_air(e['d'], e['v'], 1400, 250), t, 1, 0)
    elif ty == 'revwhoosh': add(fx, whoosh_air(e['d'], e['v'], 400, 3000, rev=True), t, 1, 0)
    elif ty == 'snap':
        for k in range(6): add(fx, mag_click(.55 + .08 * k), t - .075 + k * .015, 1, (k - 2.5) * .25)
        add(fx, glass_ding((1175, 1480, 1760), 2.8, .7), t, 1, 0)
    elif ty == 'tick': add(fx, glass_tick(e['v']), t, 1, .1)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
        if y.ndim > 1: y = y.mean(1)
        y = soxr.resample(y, sr, SR)
        y = hp(y, 90); y = compress(y / (np.abs(y).max() + 1e-9) * .9, .3, 3.0); add(vo, y, t, 1.0, 0)

# the silence before the drop holds for foley too, apart from the reverse whoosh
a, b = int(HUSH * SR), int((DROP - .55) * SR); fx[a:b] *= 0


def early(x):
    out = x.copy()
    for dl, g in [(.011, .22), (.019, .16), (.031, .1), (.047, .06)]:
        s = int(dl * SR); out[s:] += x[:-s] * g
    return out
vo = np.stack([early(vo[:, 0]), early(vo[:, 1])], 1)

mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if mus.ndim == 1: mus = np.stack([mus, mus], 1)
if msr != SR: mus = soxr.resample(mus, msr, SR)
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))

venv = np.abs(vo).max(1)
venv = uniform_filter1d(maximum_filter1d(venv, int(.25 * SR)), int(.12 * SR))
k = np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
duck = 1 - (1 - 10 ** (-12 / 20)) * k          # music −12 dB under the voice
fxduck = 1 - (1 - 10 ** (-6 / 20)) * k         # foley −6 dB
mix = mus * duck[:, None] * .85 + fx * .34 * fxduck[:, None] + vo * 1.0
mix = mix / (np.abs(mix).max() + 1e-9) * .89
mix = np.stack([limit(mix[:, 0], .63), limit(mix[:, 1], .63)], 1) / .63 * .85   # shave the biggest bass peaks so loudnorm stays linear
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')


def rms(a, b, x): s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)
print('out/mix.wav', DUR, 's')
for name, x in [('music', mus * duck[:, None] * .85), ('fx', fx * .34), ('vo', vo)]:
    print(f'{name:6s}', ' '.join(f'{rms(a, a + 2.5, x):6.1f}' for a in np.arange(0, 30, 2.5)))
