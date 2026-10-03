import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SANS, useFontsReady } from "./fonts";
import { BEAT_FRAMES, buildPopTimeline, type PopComparePair, type PopScene, type ReelPopProps } from "./popTiming";

// Brand ink/ivory shared with the carousel (src/render/svg.ts); the template adds
// a bolder telop treatment on top of it.
const INK = "#2E2629";
const SUB = "#6F6266";
const IVORY = "#FFFAFA";

// Instagram's own UI covers the top ~250px, bottom ~380px and right ~160px of a Reel.
const SAFE_TOP = 250;
const SAFE_BOTTOM = 380;
const SAFE_LEFT = 72;
const SAFE_RIGHT = 150;

const ja = { lineBreak: "strict", wordBreak: "auto-phrase" } as unknown as React.CSSProperties;

/** 0→1 spring that starts `delay` frames into the current Sequence. */
function usePop(delay: number, damping = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 180, mass: 0.7 } });
}

/** Decaying bump on every beat — drives the subtle "breathing" of photos and stickers. */
function useBeatPulse() {
  const frame = useCurrentFrame();
  return Math.exp(-(frame % BEAT_FRAMES) / 4);
}

/** Full-bleed photo: whip-zoom in on the cut, slow push afterwards, tiny beat bump. */
const PhotoBg: React.FC<{ src: string | null; durationInFrames: number; tint?: string; blur?: number }> = ({ src, durationInFrames, tint, blur = 0 }) => {
  const frame = useCurrentFrame();
  const pulse = useBeatPulse();
  const whip = interpolate(frame, [0, 9], [1.18, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const push = interpolate(frame, [0, durationInFrames], [1.02, 1.1]);
  const motionBlur = interpolate(frame, [0, 7], [14, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: tint ?? "#EEE7E4", overflow: "hidden" }}>
      {src && (
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${whip * push * (1 + 0.01 * pulse)})`,
            filter: `blur(${motionBlur + blur}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/** White flash on every cut — reads as a beat hit. */
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0.55, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity, pointerEvents: "none" }} />;
};

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

/**
 * Characters pop up one after another (the "telop typing" look). Characters are
 * grouped into words that never wrap internally, so lines still break at natural
 * Japanese word boundaries even though each character animates on its own.
 */
const PopChars: React.FC<{ text: string; delay: number; stagger?: number; style?: React.CSSProperties }> = ({ text, delay, stagger = 1.1, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let index = 0;
  return (
    <span style={style}>
      {Array.from(segmenter.segment(text), ({ segment }, w) => (
        <span key={w} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {Array.from(segment).map(char => {
            const i = index++;
            const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
            return (
              <span key={i} style={{ display: "inline-block", opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 34}px) scale(${0.7 + 0.3 * p})` }}>
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
};

/** Title with a highlighter stroke sweeping across `highlight`. */
const MarkedTitle: React.FC<{ title: string; highlight?: string; delay: number; marker: string; size: number }> = ({ title, highlight, delay, marker, size }) => {
  const frame = useCurrentFrame();
  const index = highlight ? title.indexOf(highlight) : -1;
  const [pre, mid, post]: [string, string, string] =
    highlight && index >= 0 ? [title.slice(0, index), highlight, title.slice(index + highlight.length)] : [title, "", ""];
  const sweepStart = delay + Array.from(pre).length * 1.1 + 6;
  const sweep = interpolate(frame, [sweepStart, sweepStart + 10], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const base: React.CSSProperties = { fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1.3, color: INK, letterSpacing: 1, ...ja };
  return (
    <div style={base}>
      <PopChars text={pre} delay={delay} />
      {mid && (
        <span
          style={{
            backgroundImage: `linear-gradient(transparent 58%, ${marker} 58%, ${marker} 92%, transparent 92%)`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${sweep}% 100%`,
          }}
        >
          <PopChars text={mid} delay={delay + Array.from(pre).length * 1.1} />
        </span>
      )}
      {post && <PopChars text={post} delay={delay + Array.from(pre + mid).length * 1.1} />}
    </div>
  );
};

const Chip: React.FC<{ text: string; color: string; delay: number }> = ({ text, color, delay }) => {
  const p = usePop(delay);
  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: "12px 28px",
        borderRadius: 999,
        backgroundColor: color,
        color: "#FFFFFF",
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 34,
        letterSpacing: 2,
        transform: `scale(${0.6 + 0.4 * p})`,
        transformOrigin: "left center",
        opacity: p,
      }}
    >
      {text}
    </div>
  );
};

const Progress: React.FC<{ index: number; total: number; color: string; durationInFrames: number }> = ({ index, total, color, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: SAFE_TOP + 14, left: SAFE_LEFT, right: SAFE_RIGHT, display: "flex", gap: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.55)", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}>
          <div style={{ height: "100%", backgroundColor: color, width: `${i < index ? 100 : i === index ? fill * 100 : 0}%` }} />
        </div>
      ))}
    </div>
  );
};

/** White card the scene content sits on, rising from the bottom of the safe area. */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const p = usePop(2, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_LEFT - 16,
        right: SAFE_RIGHT - 40,
        bottom: SAFE_BOTTOM - 20,
        padding: "52px 52px 44px",
        borderRadius: 40,
        backgroundColor: "rgba(255,255,255,0.95)",
        boxShadow: "0 24px 60px rgba(46,38,41,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 30,
        transform: `translateY(${(1 - p) * 140}px)`,
        opacity: Math.min(1, p * 1.5),
      }}
    >
      {children}
    </div>
  );
};

const Footnote: React.FC<{ note?: string; source?: string; delay: number }> = ({ note, source, delay }) => {
  const p = usePop(delay);
  if (!note && !source) return null;
  return (
    <div style={{ opacity: p, display: "flex", flexDirection: "column", gap: 8 }}>
      {note && <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, lineHeight: 1.55, color: SUB, ...ja }}>{note}</div>}
      {source && <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 24, color: "#9A8D90", letterSpacing: 0.5 }}>{source}</div>}
    </div>
  );
};

const RowsBody: React.FC<{ scene: Extract<PopScene, { kind: "rows" }>; accent: string }> = ({ scene, accent }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {scene.rows.map((row, i) => (
      <RowLine key={row.name} row={row} accent={accent} delay={BEAT_FRAMES * (1 + i)} />
    ))}
  </div>
);

const RowLine: React.FC<{ row: { name: string; value: string }; accent: string; delay: number }> = ({ row, accent, delay }) => {
  const p = usePop(delay, 13);
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24, padding: "18px 0", borderBottom: "3px dashed #E9DFDD", opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: SUB }}>{row.name}</span>
      <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 84, color: accent, letterSpacing: 1 }}>{row.value}</span>
    </div>
  );
};

const CompareBody: React.FC<{ scene: Extract<PopScene, { kind: "compare" }>; accent: string }> = ({ scene, accent }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
    {scene.pairs.map((pair, i) => (
      <ComparePairView key={pair.name} pair={pair} accent={accent} delay={BEAT_FRAMES * (1 + i * 4)} />
    ))}
  </div>
);

const ComparePairView: React.FC<{ pair: PopComparePair; accent: string; delay: number }> = ({ pair, accent, delay }) => {
  const frame = useCurrentFrame();
  const appear = usePop(delay);
  const max = Math.max(pair.base.value, pair.study.value);
  const grow = (start: number, value: number) =>
    interpolate(frame, [start, start + BEAT_FRAMES], [0, value / max], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const baseW = grow(delay + 2, pair.base.value);
  const studyW = grow(delay + BEAT_FRAMES, pair.study.value);
  const badge = usePop(delay + BEAT_FRAMES * 2, 9);
  const bar = (label: string, display: string, width: number, color: string, textColor: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <span style={{ width: 120, fontFamily: SANS, fontWeight: 700, fontSize: 28, color: SUB, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 64, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.max(width, 0.001) * 100}%`, backgroundColor: color, borderRadius: 14 }} />
        <span style={{ position: "absolute", left: 18, top: 0, lineHeight: "64px", fontFamily: SANS, fontWeight: 900, fontSize: 36, color: textColor, opacity: width > 0.05 ? 1 : 0, whiteSpace: "nowrap" }}>{display}</span>
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", opacity: appear, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 40, color: INK }}>{pair.name}</div>
      {bar(pair.base.label, pair.base.display, baseW, "#E6DCDA", INK)}
      {bar(pair.study.label, pair.study.display, studyW, accent, "#FFFFFF")}
      <div
        style={{
          position: "absolute",
          right: -6,
          top: -26,
          padding: "14px 22px",
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          border: `5px solid ${accent}`,
          color: accent,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 40,
          transform: `rotate(-7deg) scale(${badge * 1.0})`,
          opacity: badge,
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
        }}
      >
        {pair.badge}
      </div>
    </div>
  );
};

const StatBody: React.FC<{ scene: Extract<PopScene, { kind: "stat" }>; accent: string }> = ({ scene, accent }) => {
  const frame = useCurrentFrame();
  const start = BEAT_FRAMES;
  const value = interpolate(frame, [start, start + BEAT_FRAMES * 1.5], [0, scene.stat.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const landed = usePop(start + BEAT_FRAMES * 1.5, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, transform: `scale(${1 + 0.06 * landed * Math.exp(-(frame - start - 24) / 6) * (frame > start + 24 ? 1 : 0)})`, transformOrigin: "left bottom" }}>
        <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 190, lineHeight: 1, color: accent, letterSpacing: -2 }}>{Math.round(value).toLocaleString("en-US")}</span>
        <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 64, color: accent }}>{scene.stat.suffix}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {scene.lines.map((line, i) => (
          <CheckPill key={line} text={line} accent={accent} delay={BEAT_FRAMES * (3 + i)} />
        ))}
      </div>
    </div>
  );
};

const CheckPill: React.FC<{ text: string; accent: string; delay: number }> = ({ text, accent, delay }) => {
  const p = usePop(delay, 12);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderRadius: 999, backgroundColor: `${accent}1A`, opacity: p, transform: `scale(${0.7 + 0.3 * p})` }}>
      <svg width="34" height="34" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill={accent} />
        <path d="M6.5 12.5l3.5 3.5 7.5-8" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36, color: INK }}>{text}</span>
    </div>
  );
};

const SunMoon: React.FC<{ icon: "sun" | "moon"; color: string }> = ({ icon, color }) =>
  icon === "sun" ? (
    <svg width="64" height="64" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" fill={color} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={12 + Math.cos(a) * 8} y1={12 + Math.sin(a) * 8} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} stroke={color} strokeWidth="2" strokeLinecap="round" />;
      })}
    </svg>
  ) : (
    <svg width="64" height="64" viewBox="0 0 24 24">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill={color} />
    </svg>
  );

const MessageBody: React.FC<{ scene: Extract<PopScene, { kind: "message" }>; accent: string }> = ({ scene, accent }) => (
  <div style={{ display: "flex", gap: 22 }}>
    {(scene.chips ?? []).map((chip, i) => (
      <IconChip key={chip.text} chip={chip} accent={accent} delay={BEAT_FRAMES * (2 + i)} />
    ))}
  </div>
);

const IconChip: React.FC<{ chip: { icon: "sun" | "moon"; text: string }; accent: string; delay: number }> = ({ chip, accent, delay }) => {
  const p = usePop(delay, 10);
  const pulse = useBeatPulse();
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "22px 26px", borderRadius: 28, backgroundColor: `${accent}14`, border: `3px solid ${accent}33`, opacity: p, transform: `scale(${(0.6 + 0.4 * p) * (1 + 0.02 * pulse)})` }}>
      <SunMoon icon={chip.icon} color={chip.icon === "sun" ? "#E0A43A" : accent} />
      <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 44, color: INK }}>{chip.text}</span>
    </div>
  );
};

const PointScene: React.FC<{ scene: PopScene; index: number; total: number; props: ReelPopProps; durationInFrames: number }> = ({ scene, index, total, props, durationInFrames }) => (
  <AbsoluteFill>
    <PhotoBg src={scene.photo} durationInFrames={durationInFrames} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255,250,250,0) 30%, rgba(255,250,250,0.35) 55%, rgba(255,250,250,0.75) 100%)" }} />
    <Progress index={index} total={total} color={props.accentColor} durationInFrames={durationInFrames} />
    <Card>
      <Chip text={`POINT ${index + 1}　${scene.label}`} color={props.accentColor} delay={3} />
      <MarkedTitle title={scene.title} highlight={scene.highlight} delay={6} marker={props.markerColor} size={scene.title.length > 9 ? 76 : 88} />
      {scene.kind === "rows" && <RowsBody scene={scene} accent={props.accentColor} />}
      {scene.kind === "compare" && <CompareBody scene={scene} accent={props.accentColor} />}
      {scene.kind === "stat" && <StatBody scene={scene} accent={props.accentColor} />}
      {scene.kind === "message" && <MessageBody scene={scene} accent={props.accentColor} />}
      <Footnote note={scene.note} source={scene.source} delay={scene.kind === "compare" ? BEAT_FRAMES * 9 : BEAT_FRAMES * 4} />
    </Card>
    <CutFlash />
  </AbsoluteFill>
);

/** One telop line on its own white band, slammed in on a beat. */
const SlamLine: React.FC<{ text: string; delay: number; color: string; size: number }> = ({ text, delay, color, size }) => {
  const p = usePop(delay, 11);
  return (
    <div style={{ alignSelf: "flex-start", transform: `scale(${1.5 - 0.5 * p}) rotate(${(1 - p) * -4}deg)`, transformOrigin: "left center", opacity: Math.min(1, p * 2) }}>
      <span style={{ display: "inline-block", backgroundColor: "#FFFFFF", padding: "6px 28px 14px", borderRadius: 18, fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1.15, color, boxShadow: "0 14px 34px rgba(46,38,41,0.18)" }}>
        {text}
      </span>
    </div>
  );
};

const HookScene: React.FC<{ props: ReelPopProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const kicker = usePop(0, 14);
  const sticker = usePop(BEAT_FRAMES * 3, 9);
  const pulse = useBeatPulse();
  const { hook } = props;
  return (
    <AbsoluteFill>
      <PhotoBg src={hook.photo} durationInFrames={durationInFrames} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(46,38,41,0.28) 100%)" }} />
      <div style={{ position: "absolute", left: SAFE_LEFT, right: SAFE_RIGHT, top: 640, display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Visible from frame 1 — the opening frame has to carry the hook on its own,
            so the kicker uses the same white telop band as the punch lines, just smaller. */}
        <div style={{ alignSelf: "flex-start", transform: `scale(${1.08 - 0.08 * kicker})`, transformOrigin: "left center" }}>
          <span style={{ display: "inline-block", backgroundColor: "#FFFFFF", padding: "8px 26px 14px", borderRadius: 18, borderLeft: `14px solid ${props.accentColor}`, fontFamily: SANS, fontWeight: 900, fontSize: 104, lineHeight: 1.15, color: INK, boxShadow: "0 14px 34px rgba(46,38,41,0.18)" }}>
            {hook.kicker}
          </span>
        </div>
        {hook.lines.map((line, i) => (
          <SlamLine key={line} text={line} delay={4 + i * BEAT_FRAMES} color={i === hook.highlightLine ? props.accentColor : INK} size={150} />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: SAFE_RIGHT + 10,
          top: 420,
          width: 190,
          height: 190,
          borderRadius: "50%",
          backgroundColor: "#FFF4C2",
          border: `6px solid ${props.accentColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 50,
          color: props.accentColor,
          transform: `rotate(12deg) scale(${sticker * (1 + 0.04 * pulse)})`,
          opacity: sticker,
          boxShadow: "0 10px 26px rgba(0,0,0,0.15)",
        }}
      >
        保存版
      </div>
    </AbsoluteFill>
  );
};

const BookmarkIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="54" height="54" viewBox="0 0 24 24">
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" fill={color} />
  </svg>
);

const ClosingScene: React.FC<{ props: ReelPopProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { closing } = props;
  const save = usePop(BEAT_FRAMES * 3, 9);
  const info = usePop(BEAT_FRAMES * 5);
  const bounce = Math.abs(Math.sin((frame / BEAT_FRAMES) * Math.PI)) * 10;
  return (
    <AbsoluteFill>
      <PhotoBg src={closing.photo} durationInFrames={durationInFrames} blur={10} />
      <AbsoluteFill style={{ backgroundColor: "rgba(255,250,250,0.72)" }} />
      <div style={{ position: "absolute", left: SAFE_LEFT, right: SAFE_RIGHT, top: SAFE_TOP + 60, bottom: SAFE_BOTTOM, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <MarkedTitle title={closing.title} highlight={closing.title} delay={4} marker={props.markerColor} size={100} />
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: INK, ...ja }}>
          <PopChars text={closing.subtitle} delay={BEAT_FRAMES * 1.5} stagger={0.8} />
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "22px 36px",
            borderRadius: 999,
            backgroundColor: props.accentColor,
            color: "#FFFFFF",
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 46,
            transform: `translateY(${-bounce * save}px) scale(${0.6 + 0.4 * save})`,
            opacity: save,
            boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
          }}
        >
          <BookmarkIcon color="#FFFFFF" />
          {closing.saveCta}
        </div>
        <div style={{ marginTop: 20, opacity: info, transform: `translateY(${(1 - info) * 30}px)`, display: "flex", flexDirection: "column", gap: 10 }}>
          {closing.clinicInfo.map((line, i) => (
            <div key={line} style={{ fontFamily: SANS, fontWeight: i === 0 ? 900 : 500, fontSize: i === 0 ? 50 : 34, color: INK, lineHeight: 1.45 }}>
              {line}
            </div>
          ))}
          <div style={{ marginTop: 16, alignSelf: "flex-start", padding: "18px 28px", border: `4px solid ${props.accentColor}`, borderRadius: 18, color: props.accentColor, fontFamily: SANS, fontWeight: 800, fontSize: 34, backgroundColor: IVORY }}>
            {closing.bookingNote}
          </div>
        </div>
      </div>
      <CutFlash />
    </AbsoluteFill>
  );
};

export const ReelPop: React.FC<ReelPopProps> = props => {
  const { fps } = useVideoConfig();
  const timeline = buildPopTimeline(props);
  const allText = [
    props.hook.kicker,
    ...props.hook.lines,
    "保存版POINT 0123456789,",
    ...props.scenes.flatMap(scene => [
      scene.label,
      scene.title,
      scene.note ?? "",
      scene.source ?? "",
      ...(scene.kind === "rows" ? scene.rows.flatMap(r => [r.name, r.value]) : []),
      ...(scene.kind === "compare" ? scene.pairs.flatMap(p => [p.name, p.badge, p.base.label, p.base.display, p.study.label, p.study.display]) : []),
      ...(scene.kind === "stat" ? [...scene.lines, scene.stat.suffix] : []),
      ...(scene.kind === "message" ? (scene.chips ?? []).map(c => c.text) : []),
    ]),
    props.closing.title,
    props.closing.subtitle,
    props.closing.saveCta,
    ...props.closing.clinicInfo,
    props.closing.bookingNote,
  ].join("");
  useFontsReady(allText);
  const fade = Math.round(1.5 * fps);
  return (
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
          volume={frame => interpolate(frame, [0, timeline.durationInFrames - fade, timeline.durationInFrames], [0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};
