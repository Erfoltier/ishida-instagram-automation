/**
 * Timing and props for GlossyReel.tsx — kept free of React/CSS imports so the
 * Node render script (scripts/render-glossy-reel.ts) can import it too.
 */
const FPS = 30;
const HOOK_SECONDS = 4.5;
const CLOSING_SECONDS = 6;
const CHARS_PER_SECOND = 11;
const SCENE_MIN_SECONDS = 4.5;

export type GlossyStat = { caption: string; value: string; unit: string };

export type GlossyScene = {
  label: string;
  heading: string;
  stat?: GlossyStat;
  /** Short phrases shown as round bubble badges. "\n" forces a line break inside a bubble. */
  bubbles?: string[];
  body?: string;
  /** Overrides the reading-speed estimate when the reel has a fixed target length. */
  seconds?: number;
  /** Small print under the panel (source, caveat). */
  note?: string;
};

export type GlossyReelProps = {
  hookBackground: string | null;
  sceneBackground: string | null;
  kicker: string;
  hookLines: string[];
  hookSub: string;
  hookSeconds?: number;
  closingSeconds?: number;
  scenes: GlossyScene[];
  closingLines: string[];
  closingSub: string;
  closingNote: string;
  clinicInfo: string[];
  bgm: string | null;
};

export function sceneText(scene: GlossyScene) {
  return [scene.heading, scene.body ?? "", ...(scene.bubbles ?? []), scene.stat ? scene.stat.caption + scene.stat.value : ""].join("");
}

export function glossySceneFrames(scene: GlossyScene) {
  if (scene.seconds) return Math.round(scene.seconds * FPS);
  return Math.round(Math.max(SCENE_MIN_SECONDS, 1.5 + sceneText(scene).length / CHARS_PER_SECOND) * FPS);
}

export function buildGlossyTimeline(props: Pick<GlossyReelProps, "scenes" | "hookSeconds" | "closingSeconds">) {
  const hook = { from: 0, durationInFrames: Math.round((props.hookSeconds ?? HOOK_SECONDS) * FPS) };
  let cursor = hook.durationInFrames;
  const scenes = props.scenes.map(scene => {
    const slot = { from: cursor, durationInFrames: glossySceneFrames(scene) };
    cursor += slot.durationInFrames;
    return slot;
  });
  const closing = { from: cursor, durationInFrames: Math.round((props.closingSeconds ?? CLOSING_SECONDS) * FPS) };
  return { hook, scenes, closing, durationInFrames: cursor + closing.durationInFrames };
}
