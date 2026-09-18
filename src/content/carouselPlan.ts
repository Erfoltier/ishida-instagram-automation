export const CAROUSEL_TEMPLATE = {
  keyPoints5: "key_points_5",
  clinical7: "clinical_7",
} as const;

export type CarouselTemplate = (typeof CAROUSEL_TEMPLATE)[keyof typeof CAROUSEL_TEMPLATE];

export type CarouselSlideKind =
  | "cover"
  | "insight"
  | "background"
  | "caution"
  | "option"
  | "consultation"
  | "summary"
  | "cta";

export type CarouselSlidePlan = {
  order: number;
  kind: CarouselSlideKind;
  /** What this slide's body must state — a concrete instruction, not filler text the LLM might keep verbatim. */
  factInstruction: string;
};

const CLINICAL_EXPLAINER_TERMS = /医療脱毛|ニードル脱毛|脱毛|肝斑|肌育|hifu|ハイフ|注入|ボトックス|ヒアルロン酸|ピーリング|ポテンツァ|ダーマペン|レーザー/i;

export function selectCarouselTemplate(primarySubject: string): CarouselTemplate {
  return CLINICAL_EXPLAINER_TERMS.test(primarySubject) ? CAROUSEL_TEMPLATE.clinical7 : CAROUSEL_TEMPLATE.keyPoints5;
}

const CTA_FACT = "次の文言をそのまま使う: title「診察で状態に合わせてご案内します」 body「ご予約・ご相談はプロフィールの公式LINEへ」";

/**
 * Unlike the original Manus template (which put placeholder TEXT like "選択肢を考える"
 * directly into the slide and asked the LLM to keep the vibe), this template puts an
 * INSTRUCTION for what fact to extract from the supplied official-site text. The LLM
 * never sees filler copy to imitate — only a directive to pull a specific real detail.
 */
export function buildCarouselSlidePlan(template: CarouselTemplate): CarouselSlidePlan[] {
  const cover: CarouselSlidePlan = {
    order: 1,
    kind: "cover",
    factInstruction: "参照テキストにある主題名・キャッチコピー的な一文を要約し、見出しにする（誇大表現は避ける）",
  };
  const cta: CarouselSlidePlan = {
    order: template === CAROUSEL_TEMPLATE.clinical7 ? 7 : 5,
    kind: "cta",
    factInstruction: CTA_FACT,
  };

  if (template === CAROUSEL_TEMPLATE.keyPoints5) {
    return [
      cover,
      { order: 2, kind: "insight", factInstruction: "参照テキストの中から、この悩み・状態の原因や見分け方について書かれた具体的な一文を要約する（例: 色や形の違い、混同されやすい状態との区別点）" },
      { order: 3, kind: "option", factInstruction: "参照テキストにある治療の選択肢や比較のうち、実在する1つを名前や特徴つきで要約する（一般論で終わらせない）" },
      { order: 4, kind: "consultation", factInstruction: "参照テキストにある診察の流れ・確認事項・回数の目安など、具体的な数字や手順があれば1つ引用して要約する" },
      cta,
    ];
  }

  return [
    cover,
    { order: 2, kind: "background", factInstruction: "参照テキストにある、原因・仕組み（メカニズム）についての具体的な一文を要約する" },
    { order: 3, kind: "caution", factInstruction: "参照テキストにある、自己判断しにくい点・受診が必要な状態・混同されやすい別の状態との違いを具体的に要約する" },
    { order: 4, kind: "option", factInstruction: "参照テキストにある治療の選択肢や比較表のうち、実在する1つを名前つきで要約する" },
    { order: 5, kind: "consultation", factInstruction: "参照テキストにあるダウンタイム・痛み・回数の目安など、具体的な記述を1つ要約する" },
    { order: 6, kind: "summary", factInstruction: "参照テキストにある「このような方に検討します」等の対象者の具体例を1つ要約する" },
    cta,
  ];
}
