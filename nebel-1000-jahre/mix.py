"""mix.py — chip foley + narration + music (ducked under the voice) → out/mix.wav (48 kHz stereo); also writes subtitles_de.srt.
Reads events.json (node core/render/events.mjs), voice/*.wav, music/score.wav. All foley is synthesised; the fog eras
change its fidelity (8-bit in year 100, 4-bit in year 500). The breath after the silence is the only sound that is not "chip".
Structure follows the pixel-rpg demo's mixer (Lemo-Opuscar, MIT)."""
import sys, os, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ.get('LIB', '/root/lemo-opuscar')
sys.path.insert(0, os.path.join(LIB, 'core/audio')); sys.path.insert(0, os.path.join(LIB, 'core/render'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
N = int(DUR * SR); bus_sfx = np.zeros((N, 2)); bus_vo = np.zeros((N, 2)); rng = np.random.default_rng(7)
def put(bus, x, at, g=1.0, pan=0.0):
    s = int(at * SR); x = np.asarray(x, float) * g
    if s >= N: return
    x = x[:N - s]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[s:s + len(x), 0] += x * l * 1.414; bus[s:s + len(x), 1] += x * r * 1.414

def sq(f, d, duty=.5):
    tt = t_(d); f = np.broadcast_to(f, tt.shape) if np.ndim(f) else np.full(tt.shape, f)
    ph = np.cumsum(f) / SR; return ((ph % 1) < duty).astype(float) * 2 - 1
def tri(f, d):
    tt = t_(d); ph = np.cumsum(np.full(tt.shape, f) if not np.ndim(f) else f) / SR; x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    return np.round(x * 7) / 7
def crush(x, bits=8, sr=48000):
    if sr < SR: step = int(SR / sr); x = np.repeat(x[::step], step)[:len(x)]
    q = 2 ** (bits - 1); return np.round(x * q) / q
def adsr(d, a=.004, r=.05):
    tt = t_(d); e = np.minimum(1, tt / max(a, 1e-4)) * np.minimum(1, (d - tt) / max(r, 1e-4)); return np.clip(e, 0, 1)
def echo(x, taps=((.12, .3), (.21, .18))):
    y = np.concatenate([x, np.zeros(int((max(t for t, _ in taps) + .05) * SR))])
    for dt, g in taps: s = int(dt * SR); y[s:s + len(x)] += x * g
    return y
def era(t):          # fidelity of the foley follows the fog era
    return 'nes' if 10 <= t < 15 else 'gb' if 15 <= t < 20 else 'full'
def fid(x, t):
    e = era(t); return crush(x, 8, 22050) if e == 'nes' else crush(x, 4, 11025) if e == 'gb' else x

def S(ty, e):
    t0 = e['t']
    if ty == 'flutter':
        out = np.zeros(int(.6 * SR))
        for k in range(9): s = bp(noise(.04), 600, 2500) * env_exp(.04, .01); i = int(k * .055 * SR); out[i:i + len(s)] += s
        return norm(out) * .25, .5
    if ty == 'hit':                # the fog "appears": thump + crushed noise burst + falling square
        d = .7; x = sfx.thump(.5, 55)[:int(d * SR)]; x = np.pad(x, (0, int(d * SR) - len(x)))
        x = x + crush(lp(noise(d), 2500) * env_exp(d, .15), 6, 16000) * .6 + sq(np.linspace(500, 90, int(d * SR)), d, .5) * env_exp(d, .2) * .25
        return norm(x) * .55, 1.0
    if ty == 'openUI':
        a = sq(880, .04, .25) * adsr(.04); b = sq(1320, .06, .25) * adsr(.06); return np.concatenate([a, b]) * .2, .5
    if ty == 'blipUI':
        return sq(660, .022, .5) * adsr(.022, .001, .01) * .12, .6
    if ty == 'blipC':              # the child's text blips: higher, a little uneven
        f = 1180 * (1 + .05 * rng.standard_normal()); return sq(f, .03, .25) * adsr(.03, .001, .012) * .17, .8
    if ty == 'whoosh':
        return sfx.whoosh(.3, .14), .6
    if ty == 'bitdrop':
        k = e.get('k', 0); d = .45; f = np.linspace(700 / (1 + k * .45), 120 / (1 + k * .3), int(d * SR))
        x = sq(f, d, [.5, .25, .125][k]) * env_exp(d, .16); return crush(x, 7 - k * 1.5, [24000, 16000, 11025][k]) * .2, .9
    if ty == 'tick':
        return sq(2093, .015, .5) * adsr(.015, .001, .008) * .07, .8
    if ty == 'creak':              # stalks bending: slow bandpassed crackle
        d = .9; tt = t_(d); x = bp(noise(d), 300, 1400) * (np.abs(np.sin(2 * np.pi * 7 * tt)) ** 6) * np.minimum(1, (d - tt) / .3)
        return crush(norm(x), 8, 22050) * .18, .8
    if ty == 'kneel':
        return sfx.thump(.25, 90) * .5, .7
    if ty == 'mosaic':
        d = .4; f = np.linspace(300, 1400, int(d * SR))
        x = sq(f, d, .25) * adsr(d, .01, .1); return crush(x, 5, 16000) * .12, .5
    if ty == 'bell':               # struck bell: inharmonic partials; offscreen (far) = quieter and dull
        d = 2.6; tt = t_(d); f0 = 392
        x = sum(a * np.sin(2 * np.pi * f0 * r * tt) * np.exp(-tt / tau) for r, a, tau in [(1, 1, 1.4), (2.0, .5, .9), (2.4, .45, .7), (3.0, .3, .5), (4.2, .2, .35), (.5, .35, 1.8)])
        x = crush(norm(x), 8, 24000)
        if e.get('far'): x = lp(x, 900) * .5
        return echo(x * .5, ((.21, .3), (.42, .15))), .6
    if ty == 'step':
        d = .07; x = hp(noise(d), 600) * env_exp(d, .008) + np.sin(2 * np.pi * 150 * t_(d)) * env_exp(d, .01) * .6
        return echo(norm(x) * .3 * e.get('v', 1), ((.09, .25), (.19, .12))), .8
    if ty == 'drip':
        d = .12; f = np.linspace(1800, 2600, int(d * SR)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .025) * .1, .6
    if ty == 'shimmer':            # spores: triangle arpeggio, magic shimmer
        out = np.zeros(int(1.2 * SR))
        for k, f in enumerate([1047, 1319, 1568, 2093, 2637, 2093]): s = tri(f, .4) * env_exp(.4, .14); i = int(k * .06 * SR); out[i:i + len(s)] += s * .5
        return echo(out * .3, ((.15, .3), (.3, .15))), .6
    if ty == 'slide':
        return sfx.whoosh(.22, .12), .5
    if ty == 'cursor':
        return sq(1046, .035, .5) * adsr(.035, .001, .02) * .17, .6
    if ty == 'select':
        a = sq(1320, .035, .5) * adsr(.035); b = sq(1760, .07, .5) * adsr(.07, .002, .05); return np.concatenate([a, b]) * .2, .6
    if ty == 'breath':             # the only organic sound: inhale 0.6 s + exhale 0.4 s
        a = bp(noise(.62), 900, 3800) * np.sin(np.pi * t_(.62) / .62 / 2) ** 1.5 * np.linspace(.3, 1, int(round(.62 * SR)))
        b = bp(noise(.5), 400, 2200) * env_exp(.5, .16)
        x = np.concatenate([a * .8, np.zeros(int(.05 * SR)), b]); return norm(x) * .26, 1.0
    if ty == 'flood':
        d = 2.2; n = int(d * SR); x = bp(noise(d), 800, 6000) * np.linspace(0, 1, n) ** 2 * np.minimum(1, (d - t_(d)) / .4)
        sh = sum(np.sin(2 * np.pi * f * t_(d)) for f in (1760, 2217, 2637)) * np.linspace(0, 1, n) * .12
        return norm(x + sh) * .2, 1.0
    if ty == 'ignite':
        d = .35; return norm(bp(noise(d), 500, 4000) * env_exp(d, .1)) * .12, 1.0
    if ty == 'sparkle':
        out = np.zeros(int(.9 * SR))
        for k in range(5): f = 2637 * 2 ** (rng.integers(0, 5) / 12); s = np.sin(2 * np.pi * f * t_(.2)) * env_exp(.2, .05); i = int((k * .12 + .05) * SR); out[i:i + len(s)] += s
        return out * .07, .5
    if ty == 'savetick':
        return sq(1568, .012, .5) * adsr(.012, .001, .006) * .05, .5
    if ty == 'chirp':
        out = np.zeros(int(.5 * SR))
        for k in range(3): d = .07; f = np.linspace(2600, 3600, int(d * SR)) * (1 + .1 * k); s = sq(f, d, .25) * adsr(d, .003, .03); i = int(k * .1 * SR); out[i:i + len(s)] += s
        return out * .06, .6
    return None, 0

def bed(name, t0, t1, g):
    d = t1 - t0; n = int(round(d * SR)); tt = t_(d)
    if name == 'birds':
        x = np.zeros(n)
        for _ in range(int(d * 3)):
            i = int(rng.integers(0, max(1, n - 6000))); dd = .06; f = np.linspace(2800, 3900, int(dd * SR)) * rng.uniform(.85, 1.15)
            s = sq(f, dd, .25) * adsr(dd, .002, .03); x[i:i + len(s)] += s * rng.uniform(.3, 1)
        x = x * .05
    elif name == 'fogroll':        # the fog wall: a rising, filtered rumble
        x = lp(sfx.brown(d), 400) * .5 + bp(noise(d), 300, 1800) * .12; x = x * np.linspace(.2, 1, n) ** 1.5
    elif name == 'wind':
        x = bp(noise(d), 250, 1100) * (0.6 + .4 * np.sin(2 * np.pi * .23 * tt)) * .08
    elif name == 'hum':
        x = sum(a * np.sin(2 * np.pi * f * tt + p) for f, a, p in [(110, .5, 0), (164.8, .3, 1), (220, .2, 2), (110.7, .4, 3)]) * (0.75 + .25 * np.sin(2 * np.pi * .3 * tt))
        x = crush(x * .05, 4, 11025)
    else: return
    fade = np.minimum(1, np.minimum(tt / .3, (d - tt) / .3)); put(bus_sfx, x * fade, t0, g)

for e in EV:
    ty = e['type']
    if ty in ('vo', 'sub'): continue
    if ty == 'bed': bed(e['name'], e['t'], e['t1'], e.get('gain', 1)); continue
    x, g = S(ty, e)
    if x is None: print('unknown event', ty); continue
    if ty not in ('breath', 'bell'): x = fid(x, e['t'])
    put(bus_sfx, x, e['t'], g, e.get('pan', 0))

# —— narration: 24k → 48k, high-pass, compression, light early reflection ——
for e in EV:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(HERE, 'voice', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr); y = hp(y, 90); y = sfx.compress(y / max(1e-6, np.abs(y).max()) * .9, .3, 3.0)
    y = norm(y, .9); y2 = np.concatenate([y, np.zeros(int(.2 * SR))]); s = int(.023 * SR); y2[s:s + len(y)] += y * .1
    put(bus_vo, y2, e['t'], 1.0)

# —— music, ducked ~8 dB under the voice (fast attack, slow release) ——
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav')); mus = mus[:N]
if len(mus) < N: mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
envv = np.abs(bus_vo).max(1); k = int(.02 * SR); envv = np.convolve(envv, np.ones(k) / k, 'same') > .02
duck = np.where(envv, .4, 1.0)
a, r = np.exp(-1 / (.05 * SR)), np.exp(-1 / (.35 * SR)); d = np.empty(N); v = 1.0
for i in range(N): tgt = duck[i]; c = a if tgt < v else r; v = tgt + (v - tgt) * c; d[i] = v
mus = mus * d[:, None] * .45

# —— true silence before the end: everything to zero ——
s0, s1 = int(TL['hits']['silence'] * SR), int(TL['hits']['breath'] * SR)
mix = mus + bus_sfx * .9 + bus_vo * 1.0
f = int(.03 * SR); mix[s0 - f:s0] *= np.linspace(1, 0, f)[:, None]; mix[s0:s1] = 0
peak = np.abs(mix).max(); mix = mix / peak * .89 if peak > .89 else mix
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
for t0 in np.arange(0, DUR, 2.5):
    a_, b_ = int(t0 * SR), int(min(DUR, t0 + 2.5) * SR)
    rms = lambda b: 20 * np.log10(np.sqrt((b[a_:b_] ** 2).mean()) + 1e-9)
    print(f'{t0:5.1f}  mus {rms(mus):6.1f}  sfx {rms(bus_sfx):6.1f}  vo {rms(bus_vo):6.1f}  mix {rms(mix):6.1f}')

# —— subtitles from the same array as the dialogue box ——
cues = [{'t0': e['t'], 't1': e['t1'], 'text': e['text']} for e in EV if e['type'] == 'sub']
json.dump(cues, open(os.path.join(HERE, 'out', 'cues.json'), 'w'), ensure_ascii=False)
