import { writeFile } from "node:fs/promises";

/**
 * Synthesizes an original background track as a 16-bit stereo WAV. Fully
 * generated here, so there is no third-party music licence to track.
 *
 * STYLE=bright (default): bright, clean, refined — major key, piano-like plucks,
 *   a light top melody and soft offbeat ticks (a calm, polished clinic space).
 * STYLE=calm: slower descending pad chords with a music-box arpeggio.
 *
 * Usage: OUT=reels/<id>/assets/bgm.wav SECONDS=30 STYLE=bright npx tsx scripts/synth-bgm.ts
 */
const SAMPLE_RATE = 44100;

type Style = {
  bpm: number;
  /** Chord tones (MIDI) per bar, looped. */
  chords: number[][];
  /** Bass note (MIDI) per bar. */
  bass: number[];
  arpPattern: number[];
  /** Top melody per 4-bar phrase: [bar, beat, MIDI note]. */
  melody: Array<[number, number, number]>;
  padGain: number;
  pluckGain: number;
  pluckDecay: number;
  ticks: boolean;
  echo: number;
};

const STYLES: Record<string, Style> = {
  bright: {
    bpm: 96,
    // Dmaj7 → A/C# (add9) → Bm7 → Gmaj7(9)
    chords: [
      [62, 66, 69, 73],
      [61, 64, 69, 71],
      [62, 66, 69, 71],
      [62, 66, 67, 71],
    ],
    bass: [38, 37, 35, 31],
    arpPattern: [0, 1, 2, 3, 2, 3, 1, 2],
    melody: [
      [0, 0, 78], [0, 2.5, 81], [1, 0, 76], [1, 2, 73],
      [2, 0, 74], [2, 2.5, 78], [3, 0, 79], [3, 2, 81],
    ],
    padGain: 0.03,
    pluckGain: 0.06,
    pluckDecay: 3.4,
    ticks: true,
    echo: 0.22,
  },
  calm: {
    bpm: 76,
    // Fmaj7 → Em7 → Dm7 → Cmaj7, a gentle descending loop.
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    bass: [41, 40, 38, 36],
    arpPattern: [0, 1, 2, 3, 2, 1, 2, 3],
    melody: [],
    padGain: 0.05,
    pluckGain: 0.07,
    pluckDecay: 2.4,
    ticks: false,
    echo: 0.32,
  },
};

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

async function main() {
  const seconds = Number(process.env.SECONDS ?? 30);
  const out = process.env.OUT;
  if (!out) throw new Error("OUT を指定してください。");
  const style = STYLES[process.env.STYLE ?? "bright"];
  if (!style) throw new Error(`STYLE は ${Object.keys(STYLES).join(" / ")} のいずれかです。`);
  const beat = 60 / style.bpm;
  const barLength = beat * 4;
  const total = Math.ceil(seconds * SAMPLE_RATE);
  const left = new Float32Array(total);
  const right = new Float32Array(total);

  const mix = (index: number, v: number, pan: number) => {
    left[index] = left[index]! + v * (1 - pan);
    right[index] = right[index]! + v * (1 + pan);
  };

  /** Sustained, slightly detuned pad voice. */
  const addPad = (startSec: number, durSec: number, hz: number, gain: number, pan: number) => {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const len = Math.floor(durSec * SAMPLE_RATE);
    for (let i = 0; i < len && start + i < total; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.9) * Math.min(1, (durSec - t) / 1.0);
      const phase = 2 * Math.PI * hz * t;
      mix(start + i, (Math.sin(phase) + 0.5 * Math.sin(phase * 1.003) + 0.15 * Math.sin(2 * phase * 0.998)) * env * gain, pan);
    }
  };

  /** Piano / music-box like pluck: fast attack, exponential decay, soft overtones. */
  const addPluck = (startSec: number, hz: number, gain: number, decay: number, pan: number) => {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const len = Math.floor((6 / decay) * SAMPLE_RATE);
    for (let i = 0; i < len && start + i < total; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * decay);
      const phase = 2 * Math.PI * hz * t;
      const wave = Math.sin(phase) + 0.3 * Math.sin(2 * phase) * Math.exp(-t * 4) + 0.1 * Math.sin(3.01 * phase) * Math.exp(-t * 7);
      mix(start + i, wave * env * gain, pan);
    }
  };

  /** Very soft, short high noise "tick" for a light sense of movement. */
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x3fffffff - 1;
  };
  const addTick = (startSec: number, gain: number, pan: number) => {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const len = Math.floor(0.05 * SAMPLE_RATE);
    let prev = 0;
    for (let i = 0; i < len && start + i < total; i++) {
      const n = noise();
      const high = n - prev; // crude high-pass
      prev = n;
      mix(start + i, high * Math.exp(-(i / SAMPLE_RATE) * 90) * gain, pan);
    }
  };

  for (let bar = 0; bar * barLength < seconds; bar++) {
    const chord = style.chords[bar % style.chords.length]!;
    const barStart = bar * barLength;
    for (const [k, note] of chord.entries()) addPad(barStart, barLength + 0.6, midiToHz(note), style.padGain, (k - 1.5) * 0.25);
    addPluck(barStart, midiToHz(style.bass[bar % style.bass.length]!), style.pluckGain * 1.2, 1.6, 0);
    addPluck(barStart + beat * 2, midiToHz(style.bass[bar % style.bass.length]! + 12), style.pluckGain * 0.7, 2.2, 0);
    for (let step = 0; step < 8; step++) {
      const note = chord[style.arpPattern[step]!]! + 12;
      addPluck(barStart + step * (beat / 2), midiToHz(note), style.pluckGain, style.pluckDecay, step % 2 === 0 ? -0.35 : 0.35);
    }
    for (const [mBar, mBeat, note] of style.melody) {
      if (mBar === bar % 4 && bar >= 2) addPluck(barStart + mBeat * beat, midiToHz(note), style.pluckGain * 0.85, 2.0, 0.1);
    }
    if (style.ticks && bar >= 1) {
      for (let b = 0; b < 4; b++) addTick(barStart + (b + 0.5) * beat, 0.05, b % 2 === 0 ? 0.3 : -0.3);
    }
  }

  // Ping-pong echo for space.
  const delay = Math.floor(beat * 0.75 * SAMPLE_RATE);
  for (let i = delay; i < total; i++) {
    left[i] = left[i]! + right[i - delay]! * style.echo;
    right[i] = right[i]! + left[i - delay]! * style.echo;
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
