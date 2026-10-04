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
/** Look of the count-up digits, chosen to match the carousel's own lettering. */
export type CountStyle = {
  /** CSS font-family; the face must be bundled in CarouselReel.tsx. */
  fontFamily: string;
  color?: string;
  /** Forward slant in degrees, for slanted handwriting. */
  skewDeg?: number;
  /** Extra stroke to match a heavier pen. */
  strokePx?: number;
  /** Font size as a fraction of the layer height (default 0.82). */
  sizeRatio?: number;
  /** Size of the suffix (e.g. "人", "mg") relative to the digits (default 0.62). */
  suffixScale?: number;
  /** Horizontal squeeze for narrow handwriting (default 1). */
  widthScale?: number;
  /** "left" keeps the digits where the artwork's number starts (default "center"). */
  align?: "center" | "left";
};

export type CarouselReelProps = {
  width: number;
  height: number;
  background: string;
  slides: CarouselSlide[];
  countStyle?: CountStyle;
  /** File name inside the render's public dir, or omitted/null for a silent reel. */
  bgm?: string | null;
};

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
