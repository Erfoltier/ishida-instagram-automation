import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Turns a finished carousel (text designed into the images) into a Reel while
 * keeping its exact typography: each slide is the carousel image with its text
 * inpainted away (scripts/carousel-reel/prepare.py), and the text blocks — cut
 * from the original image — are revealed on top one after another.
 */
export type CarouselLayer = { src: string; x: number; y: number; w: number; h: number; anim: "wipe" | "rise" | "pop" };
export type CarouselSlide = { plate: string; seconds: number; layers: CarouselLayer[] };
export type CarouselReelProps = { width: number; height: number; background: string; slides: CarouselSlide[] };

export const CAROUSEL_FPS = 30;
const OVERLAP = 10;
// 4:5 slide scaled to the full 1080 width, nudged up so its footer stays clear
// of Instagram's caption overlay at the bottom of the Reel.
const SLIDE_TOP = 210;

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

const Layer: React.FC<{ layer: CarouselLayer; delay: number; scale: number }> = ({ layer, delay, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - delay;
  const box: React.CSSProperties = { position: "absolute", left: layer.x * scale, top: layer.y * scale, width: layer.w * scale, height: layer.h * scale };
  const img = <Img src={staticFile(layer.src)} style={{ width: "100%", height: "100%", display: "block" }} />;
  if (layer.anim === "wipe") {
    // Title written from left to right, with a soft leading edge.
    const p = interpolate(t, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    const edge = p * 112 - 12;
    return (
      <div style={{ ...box, WebkitMaskImage: `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 12}%)`, maskImage: `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 12}%)`, transform: `translateY(${(1 - p) * 10}px)` }}>
        {img}
      </div>
    );
  }
  if (layer.anim === "pop") {
    const p = spring({ frame: t, fps, config: { damping: 10, stiffness: 170, mass: 0.7 } });
    return <div style={{ ...box, opacity: Math.min(1, p * 1.6), transform: `scale(${0.55 + 0.45 * p})` }}>{img}</div>;
  }
  const p = spring({ frame: t, fps, config: { damping: 18, stiffness: 140 } });
  return <div style={{ ...box, opacity: p, transform: `translateY(${(1 - p) * 26}px)` }}>{img}</div>;
};

const Slide: React.FC<{ slide: CarouselSlide; props: CarouselReelProps; durationInFrames: number; first: boolean }> = ({ slide, props, durationInFrames, first }) => {
  const frame = useCurrentFrame();
  const scale = 1080 / props.width;
  const enter = first ? 1 : interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.035]);
  // Reveal all blocks within the first ~55% of the slide, leaving time to read.
  const n = slide.layers.length;
  // The opening frame must already carry the hook, so slide 1's title is fully
  // written at frame 0 and the rest follows quickly.
  const start = first ? -16 : OVERLAP + 2;
  const gap = first ? 7 : n > 1 ? Math.min(11, (durationInFrames * 0.55 - start) / (n - 1)) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: props.background, transform: `translateX(${(1 - enter) * 1080}px)`, boxShadow: first ? undefined : "-30px 0 60px rgba(60,40,20,0.12)" }}>
      <div style={{ position: "absolute", left: 0, top: SLIDE_TOP, width: 1080, height: props.height * scale, transform: `scale(${zoom})`, transformOrigin: "50% 40%" }}>
        <Img src={staticFile(slide.plate)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {slide.layers.map((layer, i) => (
          <Layer key={layer.src} layer={layer} delay={start + i * gap} scale={scale} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const CarouselReel: React.FC<CarouselReelProps> = props => {
  const { slots } = carouselTimeline(props);
  return (
    <AbsoluteFill style={{ backgroundColor: props.background }}>
      {props.slides.map((slide, i) => (
        <Sequence key={slide.plate} from={slots[i]!.from} durationInFrames={slots[i]!.durationInFrames} name={`Slide ${i + 1}`}>
          <Slide slide={slide} props={props} durationInFrames={slots[i]!.durationInFrames} first={i === 0} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
