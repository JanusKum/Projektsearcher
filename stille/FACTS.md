# Facts used in the film

| Claim | Value used | Source |
|---|---|---|
| Active noise cancelling plays an inverted copy of the measured noise (destructive interference) | CH2 = −CH1 | standard ANC principle; e.g. Hansen, *Understanding Active Noise Cancellation* (Spon Press, 2001) |
| A microphone measures the noise thousands of times per second | 48,000 samples/s shown (a common audio rate; ANC DSPs run at 48 kHz or faster) | typical ANC DSP sample rates (e.g. Qualcomm / Analog Devices ANC application notes) |
| ANC works best on low frequencies; high frequencies are mostly blocked passively by the ear cushions | low part (110–220 Hz) cancelled, 2.4 kHz left to the cushions | e.g. Kuo & Morgan, "Active noise control: a tutorial review", Proc. IEEE 87 (1999); manufacturers state ANC is effective up to roughly 1 kHz |

All numbers on screen (Vpp, ΔV, dB) are computed live from the same signal that is drawn and heard (film.js and mix.py share LOW/HIGH). The signal itself (a hum of 110/165/220 Hz plus a 2.4 kHz whine) is illustrative, not a recording.
