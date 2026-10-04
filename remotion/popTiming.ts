/**
 * Props + timing for the "ReelPop" template (remotion/ReelPop.tsx) — a faster,
 * beat-synced, telop-heavy style modelled on high-retention Instagram Reels:
 * text from frame 1, a cut every 1-3 bars, big numbers, save CTA at the end.
 * Kept free of React/Remotion imports so the Node render script can use it.
 */
export const POP_FPS = 30;
/** 112.5 BPM = exactly 16 frames per beat at 30 fps (scripts/music/chill-house-bgm.py). */
export const BEAT_FRAMES = 16;
export const BAR_FRAMES = BEAT_FRAMES * 4;

export type PopRow = { name: string; value: string };
export type PopComparePair = {
  name: string;
  base: { label: string; value: number; display: string };
  study: { label: string; value: number; display: string };
  badge: string;
};

type PopSceneBase = {
  /** Small chip above the title, e.g. "定番の美白内服". */
  label: string;
  title: string;
  /** Substring of `title` drawn with the highlighter marker. */
  highlight?: string;
  note?: string;
  source?: string;
  photo: string | null;
  bars: number;
};

export type PopScene =
  | (PopSceneBase & { kind: "rows"; rows: PopRow[] })
  | (PopSceneBase & { kind: "compare"; pairs: PopComparePair[] })
  | (PopSceneBase & { kind: "stat"; stat: { to: number; suffix: string }; lines: string[] })
  | (PopSceneBase & { kind: "message"; chips?: Array<{ icon: "sun" | "moon"; text: string }> });

export type ReelPopProps = {
  accentColor: string;
  /** Highlighter marker colour (semi-transparent is fine). */
  markerColor: string;
  hook: { kicker: string; lines: string[]; highlightLine: number; photo: string | null; bars: number };
  scenes: PopScene[];
  closing: {
    title: string;
    subtitle: string;
    saveCta: string;
    clinicInfo: string[];
    bookingNote: string;
    photo: string | null;
    bars: number;
  };
  bgm: string | null;
};

export type PopSlot = { from: number; durationInFrames: number };

export function buildPopTimeline(props: Pick<ReelPopProps, "hook" | "scenes" | "closing">) {
  const hook: PopSlot = { from: 0, durationInFrames: props.hook.bars * BAR_FRAMES };
  let cursor = hook.durationInFrames;
  const scenes = props.scenes.map(scene => {
    const slot: PopSlot = { from: cursor, durationInFrames: scene.bars * BAR_FRAMES };
    cursor += slot.durationInFrames;
    return slot;
  });
  const closing: PopSlot = { from: cursor, durationInFrames: props.closing.bars * BAR_FRAMES };
  return { hook, scenes, closing, durationInFrames: cursor + closing.durationInFrames, totalBars: props.hook.bars + props.scenes.reduce((n, s) => n + s.bars, 0) + props.closing.bars };
}
