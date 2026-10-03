"""
Procedurally synthesised chill-house / lo-fi BGM for reels (no samples, no
third-party audio, so there is no licensing question).

  python3 scripts/music/chill-house-bgm.py <out.wav> [bars]

112.5 BPM = exactly 16 frames per beat at 30 fps, so scene cuts in the
ReelPop template (remotion/ReelPop.tsx) land on beats. Arrangement for the
default 16 bars:
  bars 1-2   hook      : keys + soft kick, filter opening, riser into bar 3
  bars 3-13  points    : full groove (kick, clap, hats, bass, keys, pluck arp)
  bars 14-16 closing   : breakdown (no drums), keys + pad ring out
A short whoosh sits on every 2-bar boundary to underline the cuts.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 112.5
BEAT = 60.0 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(7)


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(signal, cutoff):
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / SR)
    spectrum *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spectrum, len(signal))


def highpass(signal, cutoff):
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / SR)
    spectrum *= 1 / np.sqrt(1 + (cutoff / np.maximum(freqs, 1e-3)) ** 4)
    return np.fft.irfft(spectrum, len(signal))


def env(length, attack, decay_tau):
    t = np.arange(length) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / decay_tau)


def place(track, sound, start_sec, gain=1.0):
    start = int(start_sec * SR)
    end = min(len(track), start + len(sound))
    if start < len(track):
        track[start:end] += sound[: end - start] * gain


# Fmaj9 | Em7 | Dm9 | Cmaj7  (relaxed, bright — fits a skincare/clinic mood)
CHORDS = [
    [53, 57, 60, 64, 67],  # F A C E G
    [52, 55, 59, 62, 66],  # E G B D F#  -> Em9-ish colour
    [50, 53, 57, 60, 64],  # D F A C E
    [48, 52, 55, 59, 62],  # C E G B D
]
BASS = [41, 40, 38, 36]


def keys_voice(midi, length):
    t = np.arange(length) / SR
    f = note_hz(midi)
    # Rhodes-ish: sine + soft bell partial + tremolo
    tone = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.15)
    tone *= 1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)
    return tone * env(length, 0.005, 0.9)


def pad_voice(midi, length):
    t = np.arange(length) / SR
    f = note_hz(midi)
    saw = sum(np.sin(2 * np.pi * f * k * (1 + d) * t) / k for k in range(1, 6) for d in (-0.003, 0.003))
    a = np.minimum(1, t / 0.6)
    r = np.minimum(1, (length / SR - t) / 0.4)
    return saw * a * np.clip(r, 0, 1)


def pluck(midi, length):
    t = np.arange(length) / SR
    f = note_hz(midi)
    tone = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.04)
    return tone * env(length, 0.002, 0.12)


def kick():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    freq = 45 + 85 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t / 0.16) + 0.3 * np.exp(-t / 0.004) * rng.standard_normal(n) * 0.2


def clap():
    n = int(0.25 * SR)
    noise = rng.standard_normal(n)
    noise = highpass(lowpass(noise, 6000), 900)
    t = np.arange(n) / SR
    e = np.exp(-t / 0.06)
    for offset in (0.0, 0.011, 0.022):
        e += 0.6 * np.exp(-np.maximum(t - offset, 0) / 0.008) * (t >= offset)
    return noise * e * 0.5


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    noise = highpass(rng.standard_normal(n), 7000)
    return noise * env(n, 0.001, 0.06 if open_ else 0.012)


def whoosh(length_sec):
    n = int(length_sec * SR)
    noise = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    # rising band of noise
    out = np.zeros(n)
    segments = 16
    for i in range(segments):
        seg = slice(i * n // segments, (i + 1) * n // segments)
        cutoff = 400 + 7000 * (i / segments) ** 2
        out[seg] = lowpass(noise, cutoff)[seg]
    return out * t ** 2 * 0.6


def render(bars):
    total = int((bars * BAR + 2.5) * SR)
    drums, bass, keys, pad, arp, fx = (np.zeros(total) for _ in range(6))
    side = np.ones(total)  # sidechain gain driven by the kick

    for bar in range(bars):
        t0 = bar * BAR
        chord = CHORDS[bar % 4]
        groove = 2 <= bar < bars - 3
        intro = bar < 2
        outro = bar >= bars - 3

        # keys: syncopated stabs (1, 2&, 4)
        for beat_pos, vel in ((0, 1.0), (1.5, 0.7), (3, 0.6)):
            if outro and beat_pos > 0:
                continue
            length = int((BEAT * (2.5 if outro else 1.4)) * SR)
            for m in chord:
                place(keys, keys_voice(m + 12, length), t0 + beat_pos * BEAT, 0.09 * vel)

        # pad under everything, louder in the breakdown
        length = int(BAR * SR)
        for m in chord[:4]:
            place(pad, pad_voice(m, length), t0, 0.018 if not outro else 0.03)

        if not outro:
            # four-on-the-floor kick (half-time feel in the intro)
            for b in range(4):
                if intro and b % 2:
                    continue
                place(drums, kick(), t0 + b * BEAT, 0.9 if groove else 0.55)
                s = int((t0 + b * BEAT) * SR)
                duck = 1 - 0.55 * np.exp(-np.arange(int(0.3 * SR)) / SR / 0.09)
                side[s : s + len(duck)] = np.minimum(side[s : s + len(duck)], duck[: len(side[s : s + len(duck)])])
            # bass on 1, 2&, 3&
            if not intro:
                for beat_pos, length_beats in ((0, 1.2), (1.5, 0.5), (2.5, 1.2)):
                    n = int(length_beats * BEAT * SR)
                    tt = np.arange(n) / SR
                    f = note_hz(BASS[bar % 4])
                    tone = np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * 2 * f * tt)
                    place(bass, tone * env(n, 0.01, 0.5), t0 + beat_pos * BEAT, 0.32)
        if groove:
            for b in (1, 3):
                place(drums, clap(), t0 + b * BEAT, 0.45)
            for eighth in range(8):
                place(drums, hat(open_=eighth % 2 == 1 and eighth == 7), t0 + eighth * BEAT / 2, 0.16 if eighth % 2 else 0.07)
            # 16th pluck arp, one octave up
            pattern = [0, 2, 3, 1, 4, 2, 3, 1]
            for step in range(16):
                m = chord[pattern[step % 8] % len(chord)] + 24
                place(arp, pluck(m, int(0.2 * SR)), t0 + step * BEAT / 4, 0.045 * (1.0 if step % 4 == 0 else 0.6))

        # whoosh into every 2-bar section change (and a longer riser into the drop)
        if bar % 2 == 0 and bar > 0 and bar < bars:
            length = BEAT * (2 if bar == 2 else 1)
            place(fx, whoosh(length), t0 - length, 0.12 if bar == 2 else 0.07)

    # simple stereo-ish width: delay the arp a touch in one channel later
    mix = drums + bass * side + keys * (0.6 + 0.4 * side) + pad * side + arp
    mix = lowpass(mix, 9000) + fx
    # intro filter sweep (bars 1-2 open up from 900 Hz)
    intro_len = int(2 * BAR * SR)
    swept = np.zeros(intro_len)
    steps = 24
    for i in range(steps):
        seg = slice(i * intro_len // steps, (i + 1) * intro_len // steps)
        swept[seg] = lowpass(mix[:intro_len], 900 + 8000 * (i / steps) ** 2)[seg]
    mix[:intro_len] = swept
    # tail fade
    fade = int(2.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix * 1.4) / np.tanh(1.4) * 0.89
    left = mix
    right = np.concatenate([np.zeros(int(0.012 * SR)), arp * 0.0 + mix])[: len(mix)]
    right = 0.85 * mix + 0.15 * right
    return np.stack([left, right], axis=1)


def main():
    out = sys.argv[1]
    bars = int(sys.argv[2]) if len(sys.argv) > 2 else 16
    audio = render(bars)
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{out}: {len(audio) / SR:.1f}s, {bars} bars @ {BPM} BPM")


if __name__ == "__main__":
    main()
