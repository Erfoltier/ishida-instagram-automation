/**
 * Shared between the Remotion composition (remotion/) and the Node render script
 * (src/render/renderReel.ts) — keep this file free of React/Remotion imports so
 * both sides can use it.
 */
export const REEL_FPS = 30;
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

export type ReelSceneProps = {
  heading: string;
  body: string;
  /** File name inside the render's public dir, or null for the flat (no photo) design. */
  photo: string | null;
};

export type ReelProps = {
  eyebrow: string;
  accentColor: string;
  hook: string;
  /** File name inside the render's public dir (the AI cover photo, or a placeholder). */
  hookPhoto: string | null;
  scenes: ReelSceneProps[];
  closing: string;
  /** Fixed clinic name/access lines shown under the closing message. */
  clinicInfo: string[];
  /** Fixed booking route line shown at the very end (no URL — it's not tappable in a video). */
  bookingNote: string;
  /** File name inside the render's public dir, or null for a silent video. */
  bgm: string | null;
};

const HOOK_SECONDS = 3.5;
const CLOSING_SECONDS = 4.5;
/** Japanese reading speed on a phone, generous for a mostly older audience. */
const CHARS_PER_SECOND = 9;
const SCENE_MIN_SECONDS = 4;
const SCENE_BASE_SECONDS = 2;

export function sceneDurationInFrames(scene: Pick<ReelSceneProps, "heading" | "body">): number {
  const seconds = Math.max(SCENE_MIN_SECONDS, SCENE_BASE_SECONDS + (scene.heading.length + scene.body.length) / CHARS_PER_SECOND);
  return Math.round(seconds * REEL_FPS);
}

export type ReelTimeline = {
  hook: { from: number; durationInFrames: number };
  scenes: Array<{ from: number; durationInFrames: number }>;
  closing: { from: number; durationInFrames: number };
  durationInFrames: number;
};

export function buildReelTimeline(props: Pick<ReelProps, "scenes">): ReelTimeline {
  const hook = { from: 0, durationInFrames: Math.round(HOOK_SECONDS * REEL_FPS) };
  let cursor = hook.durationInFrames;
  const scenes = props.scenes.map(scene => {
    const entry = { from: cursor, durationInFrames: sceneDurationInFrames(scene) };
    cursor += entry.durationInFrames;
    return entry;
  });
  const closing = { from: cursor, durationInFrames: Math.round(CLOSING_SECONDS * REEL_FPS) };
  return { hook, scenes, closing, durationInFrames: cursor + closing.durationInFrames };
}
