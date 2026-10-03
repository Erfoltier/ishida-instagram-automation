import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS, SERIF, useFontsReady } from "./fonts";
import { buildGlossyTimeline, sceneText, type GlossyReelProps, type GlossyScene, type GlossyStat } from "./glossyTiming";

export { buildGlossyTimeline, type GlossyReelProps } from "./glossyTiming";

/**
 * "Glossy" reel style — modelled on the clinic's hand-made product posts
 * (セベリアバーム / 高濃度ビタミンC): soft photographic bubble backgrounds, a
 * kicker framed by ＼ ／, gradient Mincho headlines and round translucent
 * "bubble" badges. Text is always rendered here (never baked into the AI
 * background) so the Japanese stays exact.
 */

// Instagram overlays its UI on Reels — keep text inside this band (same values as Reel.tsx).
const SAFE_TOP = 250;
const SAFE_LEFT = 90;
const SAFE_RIGHT = 160;
const SAFE_BOTTOM = 380;

const PLUM = "#5B2A5E";
const ROSE = "#B03A73";
const INK = "#3C3033";
const HEADLINE_GRADIENT = `linear-gradient(100deg, ${PLUM} 0%, ${ROSE} 100%)`;
const FADE_FRAMES = 8;
const BGM_VOLUME = 0.5;

const JA_WRAP: React.CSSProperties = { lineBreak: "strict", wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"] };

function useFade(durationInFrames: number, fadeIn = true) {
  const frame = useCurrentFrame();
  const fin = fadeIn ? interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const fout = interpolate(frame, [durationInFrames - FADE_FRAMES, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return Math.min(fin, fout);
}

const Rise: React.FC<{ delay: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, ...style }}>{children}</div>;
};

const Background: React.FC<{ src: string | null; durationInFrames: number }> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.1]);
  return src ? (
    <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
  ) : (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 20%, #FBE3EE 0%, #F6EEF6 45%, #FFFAFA 100%)" }} />
  );
};

const GradientText: React.FC<{ children: React.ReactNode; size: number; style?: React.CSSProperties }> = ({ children, size, style }) => (
  <div
    style={{
      fontFamily: SERIF,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1.3,
      backgroundImage: HEADLINE_GRADIENT,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      filter: "drop-shadow(0 3px 10px rgba(255,255,255,0.9))",
      ...JA_WRAP,
      ...style,
    }}
  >
    {children}
  </div>
);

/** ＼ kicker ／ — the framing the reference posts use above their headline. */
const Kicker: React.FC<{ text: string; delay: number }> = ({ text, delay }) => (
  <Rise delay={delay} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, color: PLUM }}>＼</span>
    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 52, letterSpacing: 6, color: PLUM }}>{text}</span>
    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, color: PLUM }}>／</span>
  </Rise>
);

const Bubble: React.FC<{ text: string; size: number; delay: number; seed: number; fontSize?: number }> = ({ text, size, delay, seed, fontSize = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });
  const float = Math.sin((frame + seed * 17) / 22) * 6;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.82) 38%, rgba(246,224,240,0.78) 72%, rgba(214,180,222,0.72) 100%)",
        border: "2px solid rgba(255,255,255,0.95)",
        boxShadow: "inset -10px -14px 30px rgba(190,140,200,0.35), inset 8px 10px 22px rgba(255,255,255,0.9), 0 14px 34px rgba(120,60,120,0.18)",
        transform: `scale(${pop}) translateY(${float}px)`,
        opacity: Math.min(1, pop * 1.4),
        padding: 18,
      }}
    >
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize, lineHeight: 1.35, color: PLUM, whiteSpace: "pre-line" }}>{text}</span>
    </div>
  );
};

const Panel: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <Rise
    delay={delay}
    style={{
      background: "rgba(255,255,255,0.8)",
      border: "2px solid rgba(255,255,255,0.95)",
      borderRadius: 36,
      boxShadow: "0 18px 50px rgba(120,60,120,0.14)",
      padding: "40px 46px",
    }}
  >
    {children}
  </Rise>
);

const HookScene: React.FC<{ props: GlossyReelProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const opacity = useFade(durationInFrames, false);
  return (
    <AbsoluteFill style={{ opacity }}>
      <Background src={props.hookBackground} durationInFrames={durationInFrames} />
      <div style={{ position: "absolute", top: SAFE_TOP + 260, left: SAFE_LEFT - 20, right: SAFE_RIGHT - 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, textAlign: "center" }}>
        <Kicker text={props.kicker} delay={4} />
        {props.hookLines.map((line, i) => (
          <Rise key={line} delay={10 + i * 8}>
            <GradientText size={i === props.hookLines.length - 1 ? 108 : 92}>{line}</GradientText>
          </Rise>
        ))}
        <Rise delay={30}>
          <div style={{ height: 3, width: 520, background: HEADLINE_GRADIENT, margin: "6px auto 0" }} />
        </Rise>
        <Rise delay={34}>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46, letterSpacing: 4, color: INK }}>{props.hookSub}</div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

const StatBlock: React.FC<{ stat: GlossyStat; delay: number }> = ({ stat, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110 } });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transform: `scale(${0.6 + pop * 0.4})`, opacity: pop }}>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 42, color: INK }}>{stat.caption}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <GradientText size={190} style={{ lineHeight: 1.05 }}>{stat.value}</GradientText>
        <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 70, color: ROSE }}>{stat.unit}</span>
      </div>
    </div>
  );
};

const InfoScene: React.FC<{ scene: GlossyScene; props: GlossyReelProps; durationInFrames: number }> = ({ scene, props, durationInFrames }) => {
  const opacity = useFade(durationInFrames);
  const bubbles = scene.bubbles ?? [];
  const bubbleSize = bubbles.length >= 4 ? 300 : 320;
  return (
    <AbsoluteFill style={{ opacity }}>
      <Background src={props.sceneBackground} durationInFrames={durationInFrames} />
      <div style={{ position: "absolute", top: SAFE_TOP + 90, left: SAFE_LEFT, right: SAFE_RIGHT - 70, bottom: SAFE_BOTTOM - 40, display: "flex", flexDirection: "column", gap: 34 }}>
        <Rise delay={2} style={{ alignSelf: "flex-start" }}>
          <span style={{ display: "inline-block", padding: "10px 30px", borderRadius: 999, background: HEADLINE_GRADIENT, color: "#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 34, letterSpacing: 5 }}>{scene.label}</span>
        </Rise>
        <Rise delay={6}>
          <GradientText size={82}>{scene.heading}</GradientText>
        </Rise>
        {scene.stat && (
          <div style={{ marginTop: 10 }}>
            <StatBlock stat={scene.stat} delay={14} />
          </div>
        )}
        {bubbles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 26, marginTop: 6 }}>
            {bubbles.map((text, i) => (
              <Bubble key={text} text={text} size={bubbleSize} delay={14 + i * 6} seed={i} fontSize={text.length > 9 ? 38 : 44} />
            ))}
          </div>
        )}
        {scene.body && (
          <Panel delay={scene.stat || bubbles.length ? 28 : 14}>
            <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 42, lineHeight: 1.7, color: INK, ...JA_WRAP }}>{scene.body}</div>
          </Panel>
        )}
        {scene.note && (
          <Rise delay={36}>
            <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 28, lineHeight: 1.6, color: "#6E6266", whiteSpace: "pre-line" }}>{scene.note}</div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{ props: GlossyReelProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity }}>
      <Background src={props.hookBackground} durationInFrames={durationInFrames} />
      <div style={{ position: "absolute", top: SAFE_TOP + 180, left: SAFE_LEFT, right: SAFE_RIGHT - 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, textAlign: "center" }}>
        {props.closingLines.map((line, i) => (
          <Rise key={line} delay={4 + i * 8}>
            <GradientText size={86}>{line}</GradientText>
          </Rise>
        ))}
        <Rise delay={22}>
          <div style={{ height: 3, width: 460, background: HEADLINE_GRADIENT, margin: "4px auto" }} />
        </Rise>
        <Rise delay={26}>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 50, color: INK, ...JA_WRAP }}>{props.closingSub}</div>
        </Rise>
        <Rise delay={32}>
          <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.6, color: "#6E6266", ...JA_WRAP }}>{props.closingNote}</div>
        </Rise>
        <Rise delay={40} style={{ marginTop: 50 }}>
          <Panel delay={0}>
            {props.clinicInfo.map((line, i) => (
              <div key={line} style={{ fontFamily: i === 0 ? SERIF : SANS, fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? 46 : 34, color: INK, lineHeight: 1.6 }}>
                {line}
              </div>
            ))}
          </Panel>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

export const GlossyReel: React.FC<GlossyReelProps> = props => {
  const { fps } = useVideoConfig();
  const timeline = buildGlossyTimeline(props);
  useFontsReady(
    [props.kicker, ...props.hookLines, props.hookSub, ...props.scenes.flatMap(s => [s.label, sceneText(s), s.stat?.unit ?? "", s.note ?? ""]), ...props.closingLines, props.closingSub, props.closingNote, ...props.clinicInfo, "＼／0123456789"].join("")
  );
  const fadeFrames = Math.round(1.5 * fps);
  return (
    <AbsoluteFill lang="ja" style={{ backgroundColor: "#FFFAFA" }}>
      <Sequence from={timeline.hook.from} durationInFrames={timeline.hook.durationInFrames} name="Hook">
        <HookScene props={props} durationInFrames={timeline.hook.durationInFrames} />
      </Sequence>
      {props.scenes.map((scene, index) => {
        const slot = timeline.scenes[index]!;
        return (
          <Sequence key={index} from={slot.from} durationInFrames={slot.durationInFrames} name={`Scene ${index + 1}`}>
            <InfoScene scene={scene} props={props} durationInFrames={slot.durationInFrames} />
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
          volume={f => interpolate(f, [0, fadeFrames, timeline.durationInFrames - fadeFrames, timeline.durationInFrames], [0, BGM_VOLUME, BGM_VOLUME, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};
