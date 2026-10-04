/**
 * Props + timing for remotion/CarouselReel.tsx. Kept free of React/Remotion and
 * CSS imports so the Node render script (scripts/render-carousel-reel.ts) can use it.
 */
export type Placed = { src: string; x: number; y: number; w: number; h: number };
/** One text block, plus its highlighter / underline strokes (drawn after the text). */
export type CarouselLayer = Placed & {
  anim: "wipe" | "rise" | "pop";
  /** Highlighter / underline strokes, swept in after the text. */
  mark?: Placed;
  /** Frames, icons and photos that belong with this block, drawn just before it. */
  decor?: Placed;
  /** Count-up instead of a plain reveal: numbers roll up, then the original artwork lands. */
  count?: { to: number; suffix: string };
};
export type CarouselSlide = { plate: string; seconds: number; layers: CarouselLayer[] };
export type CarouselReelProps = { width: number; height: number; background: string; slides: CarouselSlide[] };

export const CAROUSEL_FPS = 30;
export const OVERLAP = 10;

export function carouselTimeline(props: Pick<CarouselReelProps, "slides">) {
  let cursor = 0;
  const slots = props.slides.map((slide, i) => {
    const durationInFrames = Math.round(slide.seconds * CAROUSEL_FPS) + (i < props.slides.length - 1 ? OVERLAP : 0);
    const slot = { from: cursor, durationInFrames };
    cursor += durationInFrames - OVERLAP;
    return slot;
  });
  return { slots, durationInFrames: cursor + OVERLAP };
}
