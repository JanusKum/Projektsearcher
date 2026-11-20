"""Original score for INDUKTION: numpy synthesis, 96 BPM, D minor (dorian colour), 30 s → music/score.wav (48 kHz stereo)
Same grid as story.js: beat 0.625 s, bar 2.5 s. Total silence 19.375–20.0, drop on 20.0.
python music/score.py   (LIB must point at the library: it uses $LIB/core/audio/sfx.py)"""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, norm, add

rng = np.random.default_rng(96)
BEAT = 60 / 96; BAR = BEAT * 4; DUR = 30.0; N = int(DUR * SR)
HUSH, DROP = 19.375, 20.0
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
st = lambda: np.zeros((N, 2))
pad_, bass_, perc_, glass_, fx_ = st(), st(), st(), st(), st()


def adsr(d, a=.01, r=.2):
    n = int(round(d * SR)); e = np.ones(n); ai = max(1, int(a * SR)); ri = max(1, min(n - ai, int(r * SR)))
    e[:ai] = np.linspace(0, 1, ai); e[n - ri:] *= np.linspace(1, 0, ri); return e


def bowed(m, d, v):
    """Bowed / wet-finger glass: near-sine with slow vibrato and a few soft inharmonic partials"""
    tt = t_(d); f = mtof(m); vib = 1 + .003 * np.sin(2 * np.pi * 4.6 * tt)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = np.sin(ph) + .22 * np.sin(2.01 * ph) + .08 * np.sin(3.98 * ph + 1)
    return x * adsr(d, d * .35, d * .4) * v


def fm_glass(m, d, v, bright=1.0):
    """FM glass pluck: carrier + inharmonic modulator, index decays fast"""
    tt = t_(d); f = mtof(m)
    I = (2.2 * bright) * np.exp(-tt / .09)
    x = np.sin(2 * np.pi * f * tt + I * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt / .38)
    x += .25 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / .12)
    x[:96] *= np.linspace(0, 1, 96); return x * v


def bell(m, d, v):
    tt = t_(d); f = mtof(m); x = np.zeros_like(tt)
    for k, a, tau in [(1, 1, 1.4), (2.76, .4, .5), (5.4, .18, .22), (8.93, .08, .1)]:
        x += a * np.sin(2 * np.pi * f * k * tt + rng.random() * 6) * np.exp(-tt / tau)
    x[:96] *= np.linspace(0, 1, 96); return x * v


def pad(ms, d, v, cut=1800):
    """Warm pad: detuned saws, low-passed, slow swell"""
    tt = t_(d); x = np.zeros_like(tt)
    for m in ms:
        for det in (-.07, .0, .06):
            f = mtof(m + det); x += 2 * ((f * tt + rng.random()) % 1) - 1
    x = lp(x / (len(ms) * 3), cut, 2); return x * adsr(d, min(1.2, d * .4), min(1.5, d * .4)) * v


def kick(v):
    d = .32; tt = t_(d); f = 52 + 70 * np.exp(-tt / .025)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .12)
    x += hp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt / .004) * .25
    return np.tanh(x * 1.4) * v


def b808(m, d, v, slide_to=None):
    tt = t_(d); f0 = mtof(m); f1 = mtof(slide_to) if slide_to else f0
    f = f0 + (f1 - f0) * np.clip((tt - d * .55) / (d * .3), 0, 1) + f0 * .9 * np.exp(-tt / .03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + .25 * np.sin(2 * ph) + .12 * np.sin(3 * ph)
    return np.tanh(x * 1.6) * adsr(d, .004, .12) * v


def clap(v):
    d = .25; n = rng.standard_normal(int(d * SR)); tt = t_(d)
    e = sum(np.exp(-np.clip(tt - o, 0, None) / .01) * (tt >= o) for o in (0, .011, .022)) + np.exp(-tt / .09) * .6
    return bp(n, 900, 3500) * e * v


def tick(v):
    d = .03; n = rng.standard_normal(int(d * SR)); return bp(n, 6000, 11000) * env_exp(d, .004) * v


def riser(d, v):
    tt = t_(d); u = tt / d; n = rng.standard_normal(len(tt)); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        f = 400 + 6000 * (i / len(n)) ** 2; e = min(len(n), i + hop); s = bp(n[max(0, i - 4000):e], f * .7, f * 1.3)[-(e - i):]; out[i:e] = s
    saw = 2 * ((np.cumsum(mtof(50) * (1 + 3 * u ** 2)) / SR) % 1) - 1
    return (norm(out) * .7 + lp(saw, 2500) * .2) * u ** 2 * v


D = 50  # D3
DM9 = [D, D + 3, D + 7, D + 10, D + 14]       # D F A C E
BB = [D - 4, D + 2, D + 5, D + 9]             # Bb D F A (the turn in the bowl section)

# —— Bars 1–2 (0–5): sub drone + bowed glass, dark
for ch in (0, 1):
    tt = t_(5.2); sub = np.sin(2 * np.pi * mtof(26) * tt) * .5 + np.sin(2 * np.pi * mtof(38) * tt) * .15
    add(pad_, sub * adsr(5.2, 1.5, 1.2) * .5, 0, 1, (-1) ** ch * .0)
add(glass_, bowed(D + 12, 5.0, .22), 0.0, 1, -.3)
add(glass_, bowed(D + 19, 4.4, .14), .6, 1, .3)
# —— Bars 3–4 (5–10): tick grid, pad, bell
add(glass_, bell(D + 26, 2.6, .35), 5.0, 1, 0)
add(pad_, pad(DM9[:4], 5.2, .22, 1400), 5.0, 1, 0)
for i in range(32):
    t = 5.0 + i * BEAT / 4; add(perc_, tick(.18 + (.12 if i % 4 == 0 else 0)), t, 1, (-.4 if i % 2 else .4))
# —— Bars 5–8 (10–19.375): kick, 808, FM glass plucks on eighths (= current pulses), claps; riser over the exploded view
arp = [D + 12, D + 15, D + 19, D + 22, D + 26, D + 22, D + 19, D + 15]
t = 10.0; i = 0
while t < HUSH - 1e-6:
    bright = .6 + .8 * min(1, (t - 10) / 9)
    add(glass_, fm_glass(arp[i % 8], .6, .32, bright), t, 1, (-.35 if i % 2 else .35)); t += BEAT / 2; i += 1
for bar in range(4, 8):
    b0 = bar * BAR
    for o in (0, 1, 2, 3):
        tk = b0 + o * BEAT
        if tk < HUSH - 1e-6: add(perc_, kick(.75 if o == 0 else .55), tk, 1, 0)
    for o, m, d in [(0, D - 24, BEAT * 1.4), (BEAT * 1.5, D - 24, BEAT * .4), (BEAT * 2, D - 21, BEAT * 1.6)]:
        if b0 + o < HUSH - .05: add(bass_, b808(m, min(d, HUSH - (b0 + o)), .5), b0 + o, 1, 0)
    if bar >= 6:
        for o in (1, 3):
            if b0 + o * BEAT < HUSH: add(perc_, clap(.35), b0 + o * BEAT, 1, 0)
add(pad_, pad(DM9, 9.4, .16, 1100), 10.0, 1, 0)
add(fx_, riser(HUSH - 15.0, .4), 15.0, 1, 0)
for k in range(8):
    add(perc_, tick(.25), 15.0 + k * BEAT / 2 + 2.5, 1, (-.5 if k % 2 else .5))
# —— 19.375–20.0: total silence (cut everything below, tails included)
# —— Drop 20.0: 808 hit + glass chord
add(bass_, b808(D - 24, 1.8, .9, slide_to=D - 26), DROP, 1, 0)
add(perc_, kick(1.0), DROP, 1, 0)
for m, p in [(D + 12, -.3), (D + 19, .3), (D + 26, 0), (D + 29, .15)]: add(glass_, bell(m, 3.0, .3), DROP, 1, p)
# —— Bars 9–10 (20–25): the cold proof: pad on Bb, high plucks on quarters only, no bass after the drop
add(pad_, pad(BB, 5.0, .2, 1600), 20.6, 1, 0)
t = 20.0; i = 0
while t < 25.0 - 1e-6:
    if t > DROP + .1: add(glass_, fm_glass([D + 31, D + 26, D + 29, D + 24][i % 4], .5, .18, .5), t, 1, (-.4 if i % 2 else .4))
    t += BEAT; i += 1
add(glass_, bell(D + 33, 2.2, .22), 22.2, 1, .2)   # glass-on-glass moment
# —— Bars 11–12 (25–30): resolution: kick + 808 return, bell motif, final chord, tail
for bar in (10, 11):
    b0 = bar * BAR
    for o in range(4):
        tk = b0 + o * BEAT
        if tk < 28.8: add(perc_, kick(.7 if o == 0 else .5), tk, 1, 0)
    if b0 < 27.6: add(bass_, b808(D - 24, BEAT * 3, .55), b0, 1, 0)
for k, m in enumerate([D + 24, D + 22, D + 19, D + 26]): add(glass_, bell(m, 2.0, .3), 25.0 + k * BEAT, 1, (-.3 + .2 * k))
add(pad_, pad(DM9, 5.0, .26, 2000), 25.0, 1, 0)
add(glass_, bell(D + 36, 3.0, .28), 27.5, 1, 0)
for m in (D - 12, D - 5): add(pad_, bowed(m + 12, 3.0, .18), 27.0, 1, 0)

# silence window
mix = pad_ + bass_ * 1.0 + perc_ * .9 + glass_ + fx_
a, b = int(HUSH * SR), int(DROP * SR); f = int(.01 * SR)
mix[a - f:a] *= np.linspace(1, 0, f)[:, None]; mix[a:b] = 0
fo = int(1.2 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
mix = mix / (np.abs(mix).max() + 1e-9) * .9
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
print('score.wav', DUR, 's')
