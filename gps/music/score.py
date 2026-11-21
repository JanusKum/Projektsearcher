"""Original score for EINSTEIN IN DEINER HOSENTASCHE: numpy synthesis of tuned percussion, 100 BPM, D lydian, 33.6 s → music/score.wav
Same grid as story.js: beat 0.6 s, bar 2.4 s. Lead instrument per level: marimba (you, the city), bowed vibraphone + pad (space),
glockenspiel ticks (the atomic clock), timpani + triangle (the turn), everything together (the ending). Half-beat of silence 19.2–19.5.
LIB=<library> python music/score.py"""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.environ['LIB'], 'core/audio'))
from sfx import SR, t_, lp, hp, bp, norm, add

rng = np.random.default_rng(100)
BEAT, BAR, DUR = 0.6, 2.4, 33.6; N = int(DUR * SR)
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
mus = np.zeros((N, 2))


def marimba(m, v, d=0.9):
    tt = t_(d); f = mtof(m)
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.32) + 0.35 * np.sin(2 * np.pi * f * 3.93 * tt) * np.exp(-tt / 0.05) + 0.12 * np.sin(2 * np.pi * f * 9.2 * tt) * np.exp(-tt / 0.015)
    x[:48] *= np.linspace(0, 1, 48); return x * v


def vibes(m, v, d=2.4, bowed=False):
    tt = t_(d); f = mtof(m); trem = 1 + 0.25 * np.sin(2 * np.pi * 5.5 * tt)
    x = (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * f * 4 * tt) * np.exp(-tt / 0.3)) * trem
    env = np.minimum(1, tt / (0.6 if bowed else 0.004)) * (np.exp(-tt / 1.6) if not bowed else np.minimum(1, (d - tt) / 0.6))
    return x * env * v


def glock(m, v, d=1.2):
    tt = t_(d); f = mtof(m)
    x = sum(a * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt / tau) for k, a, tau in [(1, 1, .5), (2.76, .4, .2), (5.4, .2, .08)])
    x[:48] *= np.linspace(0, 1, 48); return x * v


def pizz(m, v, d=0.7):
    tt = t_(d); f = mtof(m); x = np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.2 * np.sin(6 * np.pi * f * tt)
    return np.tanh(x * 1.3) * np.exp(-tt / 0.22) * np.minimum(1, tt / 0.003) * v


def pad(ms, d, v, cut=1600):
    tt = t_(d); x = np.zeros_like(tt)
    for m in ms:
        for det in (-.06, 0, .05): x += 2 * ((mtof(m + det) * tt + rng.random()) % 1) - 1
    x = lp(x / (3 * len(ms)), cut); return x * np.minimum(1, tt / 0.8) * np.minimum(1, (d - tt) / 0.8) * v


def timp(m, v, d=2.0):
    tt = t_(d); f = mtof(m) * (1 + 0.08 * np.exp(-tt / 0.05))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.7) + lp(rng.standard_normal(len(tt)), 400) * np.exp(-tt / 0.06) * 0.4
    return x * v


def triangle(v, d=1.5):
    tt = t_(d); return sum(np.sin(2 * np.pi * f * tt) * a for f, a in [(4186, 1), (6100, .6), (7900, .4)]) * np.exp(-tt / 0.6) * v


D = 62   # D4; D lydian: D E F# G# A B C#
LYD = [0, 2, 4, 6, 7, 9, 11]
def deg(n, base=D): o, i = divmod(n, 7); return base + 12 * o + LYD[i]

# 0–4.8 · you: marimba ostinato on eighths, pizz bass on 1 and 3
pat = [0, 4, 2, 4, 1, 4, 2, 5]
for k in range(16):
    t = k * BEAT / 2
    add(mus, marimba(deg(pat[k % 8]), .32 if k % 2 else .42), t, 1, (-.3 if k % 2 else .3))
for k in range(4): add(mus, pizz(deg(0, 38) if k % 2 == 0 else deg(4, 38), .45), k * BEAT * 2, 1, 0)
add(mus, glock(deg(7), .3), 2.4, 1, .2)       # the lock on "Dein Standort"
# 4.8–9.6 · out to space: marimba thins out, a bowed vibraphone rises, pad opens
for k in range(8):
    t = 4.8 + k * BEAT / 2; add(mus, marimba(deg(pat[k % 8]), .3 * (1 - k / 9)), t, 1, (-.3 if k % 2 else .3))
add(mus, pad([deg(0, 50), deg(4, 50), deg(6, 50), deg(9, 50)], 10.0, .2, 1200), 5.4, 1, 0)
for i, (t, n) in enumerate([(5.4, 7), (6.6, 9), (7.8, 11), (8.4, 13)]): add(mus, vibes(deg(n), .22, 2.6, bowed=True), t, 1, (-.25 if i % 2 else .25))
add(mus, glock(deg(11), .32), 8.4, 1, -.2)
# 9.6–15.6 · the satellite and its clock: glockenspiel ticks on sixteenths, soft vibes chords
add(mus, glock(deg(14), .35), 9.6, 1, 0)
for k in range(int(5.4 / (BEAT / 4))):
    t = 10.2 + k * BEAT / 4
    if t < 15.5: add(mus, glock(deg(14 if k % 4 == 0 else 11), .1 if k % 4 else .16, .25), t, 1, (-.4 if k % 2 else .4))
for t, ns in [(9.6, [0, 4, 6]), (12.0, [1, 4, 7]), (14.4, [0, 4, 7])]:
    for n in ns: add(mus, vibes(deg(n), .12, 2.4), t, 1, 0)
add(mus, pizz(deg(0, 38), .4), 12.0, 1, 0); add(mus, pizz(deg(4, 38), .4), 14.4, 1, 0)
# 15.6–19.2 · four answers: marimba returns, one rising note per satellite, lock on 18.6
for k in range(12):
    t = 15.6 + k * BEAT / 2; add(mus, marimba(deg(pat[k % 8]), .3), t, 1, (-.3 if k % 2 else .3))
for i in range(4): add(mus, vibes(deg(7 + i * 2), .2, 1.4), 15.9 + i * .6, 1, (-.5 + i * .33))
add(mus, glock(deg(14), .35), 18.6, 1, 0); add(mus, pizz(deg(0, 38), .5), 15.6, 1, 0); add(mus, pizz(deg(4, 38), .5), 16.8, 1, 0); add(mus, pizz(deg(5, 38), .5), 18.0, 1, 0)
# 19.2–19.5 silence; 19.5 the turn: timpani + triangle, a darker pad (B minor colour), two ticking clocks a little out of step
add(mus, timp(deg(0, 38), .8), 19.5, 1, 0); add(mus, triangle(.18), 19.5, 1, .3)
add(mus, pad([47, 54, 59, 62], 5.7, .18, 1000), 19.5, 1, 0)
for k in range(9): add(mus, glock(deg(7), .1, .2), 19.8 + k * .6, 1, -.4)            # the clock on Earth
for k in range(11): add(mus, glock(deg(11), .1, .2), 19.8 + k * .6 * 0.82, 1, .4)    # the clock in orbit, faster
add(mus, timp(deg(4, 38), .6), 21.6, 1, 0); add(mus, glock(deg(14), .3), 21.6, 1, 0)
# 25.2–31.2 · back to the map: full marimba + pizz, rising tension while the dot drifts
for k in range(20):
    t = 25.2 + k * BEAT / 2; add(mus, marimba(deg(pat[k % 8] + (k // 8)), .34), t, 1, (-.3 if k % 2 else .3))
for k in range(5): add(mus, pizz(deg([0, 4, 5, 6, 7][k], 38), .5), 25.2 + k * 1.2, 1, 0)
add(mus, pad([deg(0, 50), deg(4, 50), deg(6, 50)], 4.6, .14, 1500), 26.4, 1, 0)
add(mus, timp(deg(4, 38), .6), 29.8, 1, 0)
# 31.2 · snap back and title: the big chord on everything, then a long ring-out
for n in (0, 4, 7, 9, 11): add(mus, vibes(deg(n), .16, 2.4), 31.2, 1, 0)
for n in (7, 9, 11, 14): add(mus, glock(deg(n), .22, 1.6), 31.2 + (n - 7) * .05, 1, 0)
add(mus, marimba(deg(0, 50), .5, 1.5), 31.2, 1, 0); add(mus, pizz(deg(0, 38), .6, 1.4), 31.2, 1, 0); add(mus, triangle(.2), 31.2, 1, .3)

a, b = int(19.2 * SR), int(19.5 * SR); f = int(.01 * SR)
mus[a - f:a] *= np.linspace(1, 0, f)[:, None]; mus[a:b] = 0
fo = int(.8 * SR); mus[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
mus = mus / (np.abs(mus).max() + 1e-9) * .9
sf.write(os.path.join(HERE, 'score.wav'), mus.astype(np.float32), SR, subtype='FLOAT')
print('score.wav', DUR, 's')
