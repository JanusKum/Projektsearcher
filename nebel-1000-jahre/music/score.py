"""score.py — original chiptune score for "Nebel · 1000 Jahre" → music/score.wav (48 kHz stereo).
96 BPM, one bar = 2.5 s. One five-note motif in A minor that loses a layer of fidelity per fog era
(16-bit stereo + echo → 8-bit mono → 4-bit 11 kHz → muffled, hanging on the dominant), true silence, then the
full band returns in A major. Reads timeline.json. All melodies original; everything is synthesised with numpy."""
import os, json, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, 'timeline.json')))
SR = 48000; DUR = TL['dur']; N = int(DUR * SR)
B = 60 / TL['bpm']; BAR = 4 * B; E8 = B / 2; S16 = B / 4
rng = np.random.default_rng(3)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(round(d * SR))) / SR
def env(d, a=.005, dec=.0, sus=1.0, r=.04):
    t = tt(d); n = len(t); e = np.ones(n)
    if a > 0: e = np.minimum(e, t / a)
    if dec > 0: e = np.where(t > a, sus + (1 - sus) * np.exp(-(t - a) / dec), e)
    rel = np.clip((d - t) / max(r, 1e-4), 0, 1); return e * rel
def pulse(f, d, duty=.5, vib=0.0):
    t = tt(d); fr = f * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - .15) / .2, 0, 1))
    ph = np.cumsum(fr) / SR; return ((ph % 1) < duty).astype(float) * 2 - 1
def tri(f, d):
    ph = np.cumsum(np.full(len(tt(d)), f)) / SR; x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    return np.round(x * 7.5) / 7.5            # 4-bit steps, like the hardware
def noise(d, per=1):
    n = len(tt(d)); x = rng.uniform(-1, 1, n // per + 1).repeat(per)[:n]; return x
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def crush(x, bits, sr=SR):
    if sr < SR: st = int(round(SR / sr)); x = np.repeat(x[::st], st, axis=0)[:len(x)]
    q = 2 ** (bits - 1); return np.round(x * q) / q

def new(): return np.zeros((N, 2))
def put(buf, x, at, g=1.0, pan=0.0):
    s = int(round(at * SR));
    if s >= N or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    x = x[:N - s] * g; l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    buf[s:s + len(x), 0] += x * l; buf[s:s + len(x), 1] += x * r

# —— instruments ——
def lead(buf, at, m, d, v=.22, duty=.25, pan=0, vib=.004):
    put(buf, pulse(hz(m), d, duty, vib) * env(d, .004, .25, .7, .05), at, v, pan)
def arp(buf, at, ms, d, step=S16 / 2, v=.08, duty=.125, pan=0):
    n = int(d / step)
    for i in range(n): put(buf, pulse(hz(ms[i % len(ms)]), step, duty) * env(step, .002, 0, 1, .01), at + i * step, v, pan)
def bass(buf, at, m, d, v=.32):
    put(buf, tri(hz(m), d) * env(d, .003, 0, 1, .03), at, v, 0)
def kick(buf, at, v=.5):
    d = .14; t = tt(d); f = 160 * np.exp(-t * 28) + 45; ph = np.cumsum(f) / SR
    put(buf, np.sign(np.sin(2 * np.pi * ph)) * np.exp(-t * 22) * .8, at, v)
def snare(buf, at, v=.28):
    d = .16; put(buf, crush(noise(d, 2), 6) * np.exp(-tt(d) * 24), at, v, .1)
def hat(buf, at, v=.1):
    d = .04; put(buf, hp(noise(d), 7000) * np.exp(-tt(d) * 90), at, v, -.2)
def echo(buf, taps=((.188, .38, -.35), (.375, .24, .35), (.5625, .13, -.1)), fb_lp=3500):
    out = buf.copy(); mono = lp(buf.mean(1), fb_lp)
    for dt, g, pan in taps:
        s = int(dt * SR); l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        out[s:, 0] += mono[:N - s] * g * l; out[s:, 1] += mono[:N - s] * g * r
    return out
def mono_(buf): m = buf.mean(1); return np.stack([m, m], 1)

T = lambda bar, beat=0.0: bar * BAR + beat * B          # bar counted from 0

# A minor motif: A C E D | C B A E   (bar of eighths)
MOT = [69, 72, 76, 74, 72, 71, 69, 64]

# ———— A · year 0 (bars 0–1): full 16-bit band, a break before the hit ————
A = new()
for i, m in enumerate(MOT[:7]): lead(A, T(0) + i * E8, m, E8 * .92, pan=-.1)   # last eighth lost to the break (2.19 s)
for i in range(7): bass(A, T(0) + i * E8, 45 if i % 2 == 0 else 57, E8 * .9)
arp(A, T(0), [69, 72, 76, 81], 2.2, v=.05, pan=.3)
for b in range(4):
    if T(0, b) < 2.2: kick(A, T(0, b)); hat(A, T(0, b + .5))
for b in (1, 3):
    if T(0, b) < 2.2: snare(A, T(0, b))
# bar 1: the fog hits — stab chord on the downbeat, driving bass, motif an octave up, broken
for m in (65, 69, 72, 77): put(A, pulse(hz(m), .5, .5) * env(.5, .002, .12, .25, .1), T(1), .09, 0)
kick(A, T(1), .7); snare(A, T(1), .35)
for i in range(16): bass(A, T(1) + i * S16, 41 if i % 4 else 29 + 12, S16 * .85, .3)
seq = [(T(1, 1), 81, E8), (T(1, 1.5), 84, E8), (T(1, 2), 88, B * .9), (T(1, 3), 86, E8), (T(1, 3.5), 84, E8)]
for at, m, d in seq: lead(A, at, m, d, .17, .125)
for b in (1, 2, 3): kick(A, T(1, b), .45); hat(A, T(1, b + .5))
snare(A, T(1, 3), .3)
A = echo(A)

# ———— B · year 1 (bars 2–3): drums gone, motif slowed in D minor → A minor ————
Bb = new()
for at, m, d in [(T(2), 74, B), (T(2, 1), 77, B), (T(2, 2), 81, B), (T(2, 3), 79, B), (T(3), 76, B * 1.5), (T(3, 2), 72, B * 1.8)]:
    lead(Bb, at, m, d * .95, .18, .25)
for k, (r, ms) in enumerate([(50, [62, 65, 69]), (45, [60, 64, 69])]):
    bass(Bb, T(2 + k), r, BAR * .48); bass(Bb, T(2 + k, 2), r, BAR * .45)
    arp(Bb, T(2 + k), ms, BAR, step=E8 / 2, v=.04, pan=.35)
Bb = echo(Bb, fb_lp=2200)

# ———— C · year 100 (bars 4–5): 8-bit, mono: regional variation of the motif, Am → Em ————
Cc = new()
var = [(69, 1), (72, 1), (76, 1), (74, 1), (72, 1), (71, 1), (69, 1), (67, 1), (64, 1), (67, 1), (71, 1), (69, 1), (67, 1), (66, 1), (64, 2)]
at = T(4)
for m, n in var: lead(Cc, at, m, E8 * n * .9, .2, .5, vib=0); at += E8 * n
for k, r in enumerate([45, 52]):
    for b in range(4): bass(Cc, T(4 + k, b), r + (12 if b % 2 else 0), B * .8, .3)
for b in range(8): hat(Cc, T(4, b + .5), .06)
Cc = mono_(Cc); Cc = crush(Cc, 8, 24000)

# ———— D · year 500 (bars 6–7): 4-bit, 11 kHz, only bass and a sparse lead: F → E ————
Dd = new()
bass(Dd, T(6), 41, BAR * .95, .34); bass(Dd, T(7), 40, BAR * .95, .34)
for at, m, d in [(T(6), 72, B * 1.5), (T(6, 2), 69, B * 1.8), (T(7), 68, B * 1.5), (T(7, 2), 71, B * 1.8)]: lead(Dd, at, m, d, .17, .5, vib=0)
Dd = mono_(Dd); Dd = crush(Dd, 4, 11025); Dd = np.stack([lp(Dd[:, 0], 3000)] * 2, 1)

# ———— E · year 1000 (bars 8–9): muffled; the motif stops on the dominant and hangs ————
Ee = new()
for at, m, d in [(T(8), 69, E8), (T(8, .5), 72, E8), (T(8, 1), 76, B), (T(8, 2), 74, B * 2), (T(9), 72, B), (T(9, 1), 71, B), (T(9, 2), 76, B * 2)]:
    lead(Ee, at, m, d * .95, .16, .25)
bass(Ee, T(8), 38, BAR * .95, .28); bass(Ee, T(9), 40, BAR * .98, .28)
Ee = echo(Ee, fb_lp=1500); Ee = np.stack([lp(Ee[:, 0], 1300), lp(Ee[:, 1], 1300)], 1)

# ———— F · the fog lifts (bars 10.5–13.5): A major, the band returns ————
F0 = TL['secs'][-1]['t']                                   # 26.25
Ff = new()
# rising arpeggio pad under the flood (from 26.6)
arp(Ff, 26.6, [57, 61, 64, 69, 73, 76], F0 + BAR - 26.6, step=E8 / 2, v=.05, pan=.25)
for k in range(4): bass(Ff, F0 + .35 + k * B * 1.4, 45, B * 1.2, .22)
# item-get fanfare on the sun (28.75)
SF = TL['hits']['sunFull']
for i, m in enumerate([81, 85, 88]): lead(Ff, SF + i * S16 * .66, m, S16 * .6, .16, .125, 0)
lead(Ff, SF + 3 * S16 * .66, 93, B * 1.4, .17, .125, .006)
# full band, motif in A major: A C# E D | C# B A E → A | D … A
MAJ = [69, 73, 76, 74, 73, 71, 69, 64]
b0 = SF + B * 1.5
for i, m in enumerate(MAJ): lead(Ff, b0 + i * E8, m, E8 * .92, .2, .25)
end = [(b0 + 8 * E8, 76, B), (b0 + 8 * E8 + B, 74, E8), (b0 + 8 * E8 + 1.5 * B, 73, E8), (b0 + 8 * E8 + 2 * B, 71, B), (b0 + 8 * E8 + 3 * B, 69, B * 3.2)]
for at, m, d in end: lead(Ff, at, m, d * .95, .2, .25)
t = SF
while t < DUR - .5:
    k = int((t - SF) / B)
    r = 45 if (k // 4) % 2 == 0 else 50
    if t > b0 + 8 * E8 + 3 * B: r = 45
    bass(Ff, t, r + (12 if k % 2 else 0), B * .85, .28)
    if t < b0 + 8 * E8 + 3 * B: kick(Ff, t, .4) if k % 2 == 0 else snare(Ff, t, .22); hat(Ff, t + E8, .07)
    t += B
fin = b0 + 8 * E8 + 3 * B
for m in (57, 61, 64, 69): put(Ff, pulse(hz(m), DUR - fin, .25) * env(DUR - fin, .01, .6, .35, .5), fin, .05, (m - 63) / 12)
arp(Ff, SF, [69, 73, 76, 81], fin - SF, step=S16, v=.035, pan=-.3)
Ff = echo(Ff)

# —— assemble, with true silence in the gap and a short break before the hit ——
mix = A + Bb + Cc + Dd + Ee + Ff
def gate(t0, t1, fade=.01):
    s, e = int(t0 * SR), int(t1 * SR); f = int(fade * SR)
    mix[max(0, s - f):s] *= np.linspace(1, 0, min(f, s))[:, None]; mix[s:e] = 0
gate(TL['hits']['musicBreak'], TL['hits']['nebelHit'] - .002, .015)
gate(TL['hits']['silence'], TL['hits']['breath'] + .3, .04)          # true zero, echo tails included
peak = np.abs(mix).max(); mix = mix / peak * .85
os.makedirs(HERE, exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
print('score.wav', round(DUR, 2), 's, peak', round(float(peak), 3))
