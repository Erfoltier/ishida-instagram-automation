import "@fontsource/yusei-magic/400.css";
import { useEffect, useState } from "react";
import { AbsoluteFill, Easing, Img, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Turns a finished carousel (text designed into the images) into a Reel while
 * keeping its exact typography: each slide is the carousel image with its text
 * inpainted away (scripts/carousel-reel/prepare.py), and the text blocks — cut
 * from the original image — are revealed on top one after another.
 */
import { CAROUSEL_FPS, OVERLAP, carouselTimeline, type CarouselLayer, type CarouselReelProps, type CarouselSlide, type Placed } from "./carouselTiming";

export { CAROUSEL_FPS, carouselTimeline };
export type { CarouselReelProps };

// 4:5 slide scaled to the full 1080 width, nudged up so its footer stays clear
// of Instagram's caption overlay at the bottom of the Reel.
const SLIDE_TOP = 210;

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

/** Time a text block needs to finish appearing, after which its highlighter is drawn. */
const TEXT_IN: Record<CarouselLayer["anim"], number> = { wipe: 15, rise: 9, pop: 9 };
const COUNT_FRAMES = 30;
const DECOR_LEAD = 7;
// Handwritten marker face close to the carousel's lettering, used while counting.
const COUNT_FONT = "'Yusei Magic', 'Noto Sans JP', sans-serif";
const INK = "#4A2D1E";

/** Frames, icons and photos: traced in diagonally, settling from a slight zoom. */
const Decor: React.FC<{ decor: Placed; delay: number; scale: number }> = ({ decor, delay, scale }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const edge = p * 130 - 30;
  const gradient = `linear-gradient(135deg, #000 ${edge}%, transparent ${edge + 30}%)`;
  return (
    <div style={{ position: "absolute", left: decor.x * scale, top: decor.y * scale, width: decor.w * scale, height: decor.h * scale, WebkitMaskImage: gradient, maskImage: gradient, transform: `scale(${1.04 - 0.04 * p})`, opacity: Math.min(1, p * 2) }}>
      <Img src={staticFile(decor.src)} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
};

/** Rolls the number up in a matching handwritten face, then swaps to the original artwork with a pop. */
const CountLayer: React.FC<{ layer: CarouselLayer; delay: number; scale: number }> = ({ layer, delay, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - delay;
  const count = layer.count!;
  const value = interpolate(t, [0, COUNT_FRAMES], [0, count.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const land = spring({ frame: t - COUNT_FRAMES, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
  const box: React.CSSProperties = { position: "absolute", left: layer.x * scale, top: layer.y * scale, width: layer.w * scale, height: layer.h * scale };
  if (t < 0) return null;
  if (t < COUNT_FRAMES) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: COUNT_FONT, fontSize: layer.h * scale * 0.82, lineHeight: 1, color: INK, letterSpacing: -2, whiteSpace: "nowrap" }}>
        {Math.round(value)}
        <span style={{ fontSize: "0.62em", marginLeft: 6 }}>{count.suffix}</span>
      </div>
    );
  }
  return (
    <div style={{ ...box, transform: `scale(${1 + 0.12 * (1 - land)})` }}>
      <Img src={staticFile(layer.src)} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
};

/** Slide progress along the top, inside the area Instagram leaves free. */
const Progress: React.FC<{ index: number; total: number; durationInFrames: number }> = ({ index, total, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 150, left: 72, right: 150, display: "flex", gap: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 8, borderRadius: 8, backgroundColor: "rgba(74,45,30,0.14)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 8, backgroundColor: "#E9B949", width: `${i < index ? 100 : i === index ? fill * 100 : 0}%` }} />
        </div>
      ))}
    </div>
  );
};
const MARK_FRAMES = 9;

/** Highlighter pen: swept in from left to right with a soft leading edge. */
const Marker: React.FC<{ mark: Placed; delay: number; scale: number }> = ({ mark, delay, scale }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, MARK_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const edge = p * 115 - 15;
  const gradient = `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 15}%)`;
  return (
    <div style={{ position: "absolute", left: mark.x * scale, top: mark.y * scale, width: mark.w * scale, height: mark.h * scale, WebkitMaskImage: gradient, maskImage: gradient }}>
      <Img src={staticFile(mark.src)} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
};

const Slide: React.FC<{ slide: CarouselSlide; props: CarouselReelProps; durationInFrames: number; index: number }> = ({ slide, props, durationInFrames, index }) => {
  const first = index === 0;
  const frame = useCurrentFrame();
  const scale = 1080 / props.width;
  const enter = first ? 1 : interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.035]);
  // Reveal all blocks within the first ~55% of the slide, leaving time to read.
  const n = slide.layers.length;
  // The opening frame must already carry the hook, so slide 1's title is fully
  // written at frame 0 and the rest follows quickly.
  const start = first ? -16 : OVERLAP + 2;
  const gap = first ? 7 : n > 1 ? Math.min(16, (durationInFrames * 0.55 - start) / (n - 1)) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: props.background, transform: `translateX(${(1 - enter) * 1080}px)`, boxShadow: first ? undefined : "-30px 0 60px rgba(60,40,20,0.12)" }}>
      <div style={{ position: "absolute", left: 0, top: SLIDE_TOP, width: 1080, height: props.height * scale, transform: `scale(${zoom})`, transformOrigin: "50% 40%" }}>
        <Img src={staticFile(slide.plate)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {/* Frames / icons / photos first, then highlighters, then the text on top. */}
        {slide.layers.map((layer, i) =>
          layer.decor ? <Decor key={layer.decor.src} decor={layer.decor} delay={start + i * gap - DECOR_LEAD} scale={scale} /> : null
        )}
        {slide.layers.map((layer, i) =>
          layer.mark ? <Marker key={layer.mark.src} mark={layer.mark} delay={start + i * gap + (layer.count ? COUNT_FRAMES + 4 : TEXT_IN[layer.anim])} scale={scale} /> : null
        )}
        {slide.layers.map((layer, i) => (
          layer.count ? <CountLayer key={layer.src} layer={layer} delay={start + i * gap} scale={scale} /> : <Layer key={layer.src} layer={layer} delay={start + i * gap} scale={scale} />
        ))}
      </div>
      <Progress index={index} total={props.slides.length} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};

/** Load the count-up face before any frame is captured. */
function useCountFontReady() {
  const [handle] = useState(() => delayRender("Loading count-up font"));
  useEffect(() => {
    document.fonts
      .load("400 40px 'Yusei Magic'", "0123456789mg")
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
}

export const CarouselReel: React.FC<CarouselReelProps> = props => {
  const { slots } = carouselTimeline(props);
  useCountFontReady();
  return (
    <AbsoluteFill style={{ backgroundColor: props.background }}>
      {props.slides.map((slide, i) => (
        <Sequence key={slide.plate} from={slots[i]!.from} durationInFrames={slots[i]!.durationInFrames} name={`Slide ${i + 1}`}>
          <Slide slide={slide} props={props} durationInFrames={slots[i]!.durationInFrames} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
