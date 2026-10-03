"""Relaxation-salon style BGM: harp arpeggios, sparse soft piano, warm pad and
slow strings over very quiet ocean waves, rendered with real instrument samples.

Requires: pip install mido; apt install fluidsynth fluid-soundfont-gm sox
The FluidR3_GM soundfont is MIT-licensed, so the rendered track can be used
commercially without attribution.

Usage: python3 scripts/bgm/compose_relax.py <out.wav> [seconds]
"""
import os
import subprocess
import sys
import tempfile

import mido

SOUNDFONT = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
BPM = 66
TPB = 480  # ticks per beat

# GM programs (0-indexed)
HARP, PIANO, WARM_PAD, SLOW_STRINGS, SEASHORE = 46, 0, 89, 49, 122

# D major, 8 bars + a final chord. (chord tones, bass)
BARS = [
    ([62, 66, 69, 73], 50),  # Dmaj7
    ([59, 62, 66, 69], 47),  # Bm7
    ([55, 59, 62, 66], 43),  # Gmaj7
    ([57, 61, 64, 69], 45),  # A
    ([62, 66, 69, 73], 42),  # D/F#
    ([55, 59, 62, 66], 43),  # Gmaj7
    ([52, 55, 59, 62], 40),  # Em7
    ([57, 62, 64, 69], 45),  # Asus4 (resolves to A on beat 3 in the melody)
    ([62, 66, 69, 76], 38),  # Dadd9 (final, rings out)
]

# Piano melody: (bar, beat, beats, note)
MELODY = [
    (1, 0, 2, 78), (1, 2, 1, 76), (1, 3, 1, 74),
    (2, 0, 3, 74), (2, 3, 1, 71),
    (3, 0, 2, 73), (3, 2, 2, 76),
    (4, 0, 2, 81), (4, 2, 1, 78), (4, 3, 1, 76),
    (5, 0, 3, 78), (5, 3, 1, 79),
    (6, 0, 2, 79), (6, 2, 2, 74),
    (7, 0, 2, 76), (7, 2, 2, 73),
    (8, 0, 4, 74),
]


def build_midi(path: str) -> None:
    mid = mido.MidiFile(ticks_per_beat=TPB)
    events: list[tuple[int, mido.Message]] = []

    def note(ch: int, start_beats: float, beats: float, pitch: int, vel: int) -> None:
        on = int(start_beats * TPB)
        events.append((on, mido.Message("note_on", channel=ch, note=pitch, velocity=vel)))
        events.append((on + int(beats * TPB), mido.Message("note_off", channel=ch, note=pitch, velocity=0)))

    setup = [
        (0, HARP, 112, 110, 20), (1, PIANO, 100, 110, 10), (2, WARM_PAD, 56, 120, 60),
        (3, SLOW_STRINGS, 50, 120, 50), (4, SEASHORE, 26, 60, 0),
    ]
    for ch, program, volume, reverb, chorus in setup:
        events.append((0, mido.Message("program_change", channel=ch, program=program)))
        events.append((0, mido.Message("control_change", channel=ch, control=7, value=volume)))
        events.append((0, mido.Message("control_change", channel=ch, control=91, value=reverb)))
        events.append((0, mido.Message("control_change", channel=ch, control=93, value=chorus)))

    for bar, (chord, bass) in enumerate(BARS):
        t = bar * 4
        last = bar == len(BARS) - 1
        # Harp: a gentle rolled arpeggio up two octaves, then a softer answer on beat 3.
        roll = chord + [n + 12 for n in chord]
        for i, pitch in enumerate(roll):
            note(0, t + i * 0.25, 4 if last else 3, pitch, 58 + (i % 3) * 6)
        if not last:
            for i, pitch in enumerate(chord[1:] + [chord[0] + 12]):
                note(0, t + 2 + i * 0.33, 2, pitch + 12, 40)
        # Pad + strings: sustained voicing, bass on strings.
        for pitch in chord:
            note(2, t, 6 if last else 4.05, pitch, 52)
        note(3, t, 6 if last else 4.05, bass, 48)
        note(3, t, 6 if last else 4.05, chord[0], 40)

    for bar, beat, beats, pitch in MELODY:
        note(1, bar * 4 + beat, beats, pitch, 54)

    # Ocean waves underneath the whole piece.
    note(4, 0, len(BARS) * 4 + 2, 60, 40)

    track = mido.MidiTrack()
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM)))
    events.sort(key=lambda e: (e[0], e[1].type == "note_on"))
    now = 0
    for tick, msg in events:
        track.append(msg.copy(time=tick - now))
        now = tick
    mid.tracks.append(track)
    mid.save(path)


def main() -> None:
    out = sys.argv[1]
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 30.0
    with tempfile.TemporaryDirectory() as tmp:
        midi_path = os.path.join(tmp, "relax.mid")
        raw_path = os.path.join(tmp, "raw.wav")
        build_midi(midi_path)
        subprocess.run(
            [
                "fluidsynth", "-ni", "-g", "0.6", "-r", "44100", "-F", raw_path,
                "-o", "synth.reverb.room-size=0.9", "-o", "synth.reverb.damp=0.35",
                "-o", "synth.reverb.width=1.0", "-o", "synth.reverb.level=0.9",
                "-o", "synth.chorus.depth=6", "-o", "synth.chorus.level=1.2",
                SOUNDFONT, midi_path,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        # Extra hall space, gentle top-end softening, fit to length with fades.
        subprocess.run(
            [
                "sox", raw_path, out,
                "highpass", "90", "lowpass", "9000", "reverb", "35", "50", "100", "100", "20",
                "trim", "0", str(seconds), "fade", "t", "1.2", str(seconds), "3",
                "gain", "-n", "-2",
            ],
            check=True,
        )
    print(f"{out} を書き出しました（{seconds:g}秒）。")


if __name__ == "__main__":
    main()
