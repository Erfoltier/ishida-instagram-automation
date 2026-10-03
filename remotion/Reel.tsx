import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS, SERIF, useFontsReady } from "./fonts";
import { buildReelTimeline, type ReelProps, type ReelSceneProps } from "./timing";

// Same brand constants as the carousel templates (src/render/svg.ts).
const INK = "#3C3033";
const GOLD = "#A58B62";
const IVORY = "#FFFAFA";
const IVORY_PANEL = "#FBF4F3";

// Instagram overlays its own UI on Reels (header at the top, caption/buttons at
// the bottom and right) — keep all text inside this band.
const SAFE_LEFT = 90;
const SAFE_RIGHT = 160;
const SAFE_BOTTOM = 380;

const FADE_FRAMES = 8;
const BGM_VOLUME = 0.5;
const BGM_FADE_SECONDS = 1.5;

function useSceneFade(durationInFrames: number, fadeIn: boolean) {
  const frame = useCurrentFrame();
  const inOpacity = fadeIn ? interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const outOpacity = interpolate(frame, [durationInFrames - FADE_FRAMES, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return Math.min(inOpacity, outOpacity);
}

/** Text that rises into place `delay` frames after its scene starts. */
const Rise: React.FC<{ delay: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * 40}px)`, ...style }}>
      {children}
    </div>
  );
};

/** A rule line that draws itself from left to right. */
const GrowingRule: React.FC<{ delay: number; width: number; color: string; thickness?: number }> = ({ delay, width, color, thickness = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return <div style={{ width: width * progress, height: thickness, backgroundColor: color }} />;
};

/** Slow Ken Burns zoom over the whole scene. */
const ZoomingPhoto: React.FC<{ src: string; durationInFrames: number; objectPosition: string }> = ({ src, durationInFrames, objectPosition }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12]);
  return (
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition, transform: `scale(${scale})`, transformOrigin: objectPosition }}
    />
  );
};

const Eyebrow: React.FC<{ text: string; color: string; delay: number }> = ({ text, color, delay }) => (
  <Rise delay={delay} style={{ display: "flex", alignItems: "center", gap: 24 }}>
    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 34, letterSpacing: 8, color }}>{text}</span>
    <GrowingRule delay={delay + 4} width={160} color={color} thickness={3} />
  </Rise>
);

const HookScene: React.FC<{ props: ReelProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneFade(durationInFrames, false);
  const panelProgress = spring({ frame, fps, config: { damping: 200 } });
  const PHOTO_HEIGHT = 1100;
  return (
    <AbsoluteFill style={{ backgroundColor: IVORY, opacity }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: PHOTO_HEIGHT, overflow: "hidden", backgroundColor: props.accentColor }}>
        {props.hookPhoto && <ZoomingPhoto src={props.hookPhoto} durationInFrames={durationInFrames} objectPosition="center" />}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: PHOTO_HEIGHT - 80,
          bottom: 0,
          backgroundColor: IVORY,
          transform: `translateY(${(1 - panelProgress) * 120}px)`,
          padding: `90px ${SAFE_RIGHT}px ${SAFE_BOTTOM}px ${SAFE_LEFT}px`,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <Eyebrow text={props.eyebrow} color={props.accentColor} delay={6} />
        <Rise delay={12}>
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 84, lineHeight: 1.35, color: INK, lineBreak: "strict", wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"], textWrap: "balance" }}>
            {props.hook}
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC<{ index: number; total: number; color: string; durationInFrames: number }> = ({ index, total, color, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", gap: 12, width: "100%" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 6, backgroundColor: `${color}33`, overflow: "hidden" }}>
          <div style={{ height: "100%", backgroundColor: color, width: `${i < index ? 100 : i === index ? fill * 100 : 0}%` }} />
        </div>
      ))}
    </div>
  );
};

const PointScene: React.FC<{ scene: ReelSceneProps; index: number; total: number; props: ReelProps; durationInFrames: number }> = ({ scene, index, total, props, durationInFrames }) => {
  const opacity = useSceneFade(durationInFrames, true);
  const number = String(index + 1).padStart(2, "0");
  const VISUAL_HEIGHT = 820;
  return (
    <AbsoluteFill style={{ backgroundColor: IVORY_PANEL, opacity }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: VISUAL_HEIGHT, overflow: "hidden", backgroundColor: props.accentColor }}>
        {scene.photo ? (
          <ZoomingPhoto src={scene.photo} durationInFrames={durationInFrames} objectPosition="center" />
        ) : (
          // Flat design (no texture photo uploaded for this category yet) — same
          // fallback idea as the carousel's renderFlatInformationSlide.
          <div style={{ position: "absolute", right: 70, bottom: -60, fontFamily: SERIF, fontWeight: 800, fontSize: 520, color: IVORY, opacity: 0.18, lineHeight: 1 }}>
            {number}
          </div>
        )}
        <div style={{ position: "absolute", left: SAFE_LEFT, top: 300 }}>
          {!scene.photo && <Eyebrow text={props.eyebrow} color={IVORY} delay={4} />}
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE_LEFT, right: SAFE_RIGHT, top: VISUAL_HEIGHT + 60, bottom: SAFE_BOTTOM, display: "flex", flexDirection: "column", gap: 36 }}>
        <ProgressBar index={index} total={total} color={props.accentColor} durationInFrames={durationInFrames} />
        <Rise delay={4}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 34, letterSpacing: 6, color: props.accentColor }}>
            POINT {number}
          </span>
        </Rise>
        <Rise delay={8}>
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 68, lineHeight: 1.35, color: INK, lineBreak: "strict", wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"], textWrap: "balance" }}>{scene.heading}</div>
        </Rise>
        <GrowingRule delay={14} width={120} color={GOLD} />
        <Rise delay={18}>
          <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 40, lineHeight: 1.75, color: INK, lineBreak: "strict", wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"] }}>{scene.body}</div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{ props: ReelProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: IVORY, opacity }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 24, backgroundColor: props.accentColor }} />
      <div style={{ position: "absolute", left: SAFE_LEFT, right: SAFE_RIGHT, top: 420, bottom: SAFE_BOTTOM, display: "flex", flexDirection: "column", gap: 48 }}>
        <Eyebrow text={props.eyebrow} color={props.accentColor} delay={4} />
        <Rise delay={8}>
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 76, lineHeight: 1.4, color: INK, lineBreak: "strict", wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"], textWrap: "balance" }}>{props.closing}</div>
        </Rise>
        <GrowingRule delay={16} width={200} color={GOLD} />
        <Rise delay={22} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {props.clinicInfo.map((line, i) => (
            <div key={line} style={{ fontFamily: i === 0 ? SERIF : SANS, fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? 46 : 34, color: INK, lineHeight: 1.5 }}>
              {line}
            </div>
          ))}
        </Rise>
        <Rise delay={30}>
          <div style={{ display: "inline-block", padding: "22px 34px", border: `3px solid ${props.accentColor}`, color: props.accentColor, fontFamily: SANS, fontWeight: 700, fontSize: 34 }}>
            {props.bookingNote}
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = props => {
  const { fps } = useVideoConfig();
  const timeline = buildReelTimeline(props);
  useFontsReady(
    [props.eyebrow, props.hook, ...props.scenes.flatMap(scene => [scene.heading, scene.body]), props.closing, ...props.clinicInfo, props.bookingNote, "POINT 0123456789"].join("")
  );
  const fadeFrames = Math.round(BGM_FADE_SECONDS * fps);
  return (
    // lang="ja" is what makes word-break: auto-phrase split at Japanese phrase boundaries.
    <AbsoluteFill lang="ja" style={{ backgroundColor: IVORY }}>
      <Sequence from={timeline.hook.from} durationInFrames={timeline.hook.durationInFrames} name="Hook">
        <HookScene props={props} durationInFrames={timeline.hook.durationInFrames} />
      </Sequence>
      {props.scenes.map((scene, index) => {
        const slot = timeline.scenes[index]!;
        return (
          <Sequence key={index} from={slot.from} durationInFrames={slot.durationInFrames} name={`Point ${index + 1}`}>
            <PointScene scene={scene} index={index} total={props.scenes.length} props={props} durationInFrames={slot.durationInFrames} />
          </Sequence>
        );
      })}
      <Sequence from={timeline.closing.from} durationInFrames={timeline.closing.durationInFrames} name="Closing">
        <ClosingScene props={props} durationInFrames={timeline.closing.durationInFrames} />
      </Sequence>
      {props.bgm && (
        <Audio
          src={staticFile(props.bgm)}
          loop
          volume={frame =>
            interpolate(
              frame,
              [0, fadeFrames, timeline.durationInFrames - fadeFrames, timeline.durationInFrames],
              [0, BGM_VOLUME, BGM_VOLUME, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )
          }
        />
      )}
    </AbsoluteFill>
  );
};
