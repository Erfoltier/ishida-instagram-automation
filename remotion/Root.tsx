import { Composition } from "remotion";
import { Reel } from "./Reel";
import { REEL_FPS, REEL_HEIGHT, REEL_WIDTH, buildReelTimeline, type ReelProps } from "./timing";

/** Sample props for `npx remotion studio remotion/index.ts` — the real ones come from scripts/generate-reel.ts. */
const defaultProps: ReelProps = {
  eyebrow: "SPOTS",
  accentColor: "#925D66",
  hook: "その茶色いシミ、本当にシミ？",
  hookPhoto: null,
  scenes: [
    { heading: "「シミ」には種類がある", body: "老人性色素斑・肝斑・炎症後色素沈着は、見た目が似ていても成り立ちが異なります。", photo: null },
    { heading: "肝斑はレーザーで濃くなることも", body: "左右対称にもやっと広がる肝斑は、スポット照射の対象外としています。", photo: null },
    { heading: "まずは見分けることから", body: "どの茶色がどの病変なのか、診察で確認してから治療法を検討します。", photo: null },
  ],
  closing: "気になる茶色、一度ご相談ください",
  clinicInfo: ["いしだ皮フ科・美容皮膚科", "東大宮駅東口 徒歩1分", "美容診療：水曜・祝日・特別診療日／予約制"],
  bookingNote: "ご予約・ご相談はプロフィールの公式LINEから",
  bgm: null,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    fps={REEL_FPS}
    width={REEL_WIDTH}
    height={REEL_HEIGHT}
    durationInFrames={buildReelTimeline(defaultProps).durationInFrames}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: buildReelTimeline(props).durationInFrames })}
  />
);
