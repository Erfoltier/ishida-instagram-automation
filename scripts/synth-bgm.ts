import { writeFile } from "node:fs/promises";

/**
 * Synthesizes a calm, original background track (soft pad chords + music-box
 * arpeggio + light echo) as a 16-bit stereo WAV. Fully generated here, so there
 * is no third-party music licence to track.
 *
 * Usage: OUT=reels/<id>/assets/bgm.wav SECONDS=30 npx tsx scripts/synth-bgm.ts
 */
const SAMPLE_RATE = 44100;
const BPM = 76;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// Fmaj7 → Em7 → Dm7 → Cmaj7 (MIDI note numbers), a gentle descending loop.
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

async function main() {
  const seconds = Number(process.env.SECONDS ?? 30);
  const out = process.env.OUT;
  if (!out) throw new Error("OUT を指定してください。");
  const total = Math.ceil(seconds * SAMPLE_RATE);
  const left = new Float32Array(total);
  const right = new Float32Array(total);

  const addTone = (startSec: number, durSec: number, hz: number, gain: number, attack: number, release: number, pan: number, bell: boolean) => {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const len = Math.floor(durSec * SAMPLE_RATE);
    for (let i = 0; i < len && start + i < total; i++) {
      const t = i / SAMPLE_RATE;
      const env = bell
        ? Math.min(1, t / 0.008) * Math.exp(-t * 2.4)
        : Math.min(1, t / attack) * Math.min(1, (durSec - t) / release);
      const phase = 2 * Math.PI * hz * t;
      const wave = bell
        ? Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.08 * Math.sin(3.01 * phase)
        : Math.sin(phase) + 0.5 * Math.sin(phase * 1.003) + 0.2 * Math.sin(2 * phase * 0.998);
      const v = wave * env * gain;
      left[start + i] = left[start + i]! + v * (1 - pan);
      right[start + i] = right[start + i]! + v * (1 + pan);
    }
  };

  for (let bar = 0; bar * BAR < seconds; bar++) {
    const chord = CHORDS[bar % CHORDS.length]!;
    const barStart = bar * BAR;
    for (const [k, note] of chord.entries()) {
      addTone(barStart, BAR + 0.6, midiToHz(note), 0.05, 1.2, 1.0, (k - 1.5) * 0.25, false);
    }
    addTone(barStart, BAR + 0.6, midiToHz(chord[0]! - 12), 0.06, 0.8, 1.0, 0, false);
    // Music-box arpeggio, an octave up, eighth notes.
    for (let step = 0; step < 8; step++) {
      const note = chord[ARP_PATTERN[step]!]! + 12;
      addTone(barStart + step * (BEAT / 2), 2.2, midiToHz(note), 0.07, 0, 0, step % 2 === 0 ? -0.35 : 0.35, true);
    }
  }

  // Ping-pong echo for space.
  const delay = Math.floor(BEAT * 0.75 * SAMPLE_RATE);
  for (let i = delay; i < total; i++) {
    left[i] = left[i]! + right[i - delay]! * 0.32;
    right[i] = right[i]! + left[i - delay]! * 0.32;
  }

  // Fade in/out and normalize.
  const fade = 1.5 * SAMPLE_RATE;
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const g = Math.min(1, i / fade, (total - i) / fade);
    left[i] = left[i]! * g;
    right[i] = right[i]! * g;
    peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  }
  const norm = 0.8 / peak;

  const data = Buffer.alloc(total * 4);
  for (let i = 0; i < total; i++) {
    data.writeInt16LE(Math.round(left[i]! * norm * 32767), i * 4);
    data.writeInt16LE(Math.round(right[i]! * norm * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  await writeFile(out, Buffer.concat([header, data]));
  console.log(`${out} を書き出しました（${seconds}秒）。`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
