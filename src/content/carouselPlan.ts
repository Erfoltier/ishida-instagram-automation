export type CarouselSlideKind =
  | "cover"
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

const MIN_TOTAL_SLIDES = 5;
const MAX_TOTAL_SLIDES = 10; // Instagram's own carousel limit

/**
 * Auto-picks a total slide count (cover + content + CTA) from how much real
 * material the official-site reference text actually has to say — a thin page
 * (e.g. a short seasonal note) gets a short carousel; a page with mechanism +
 * comparison table + downtime + candidates gets more room. Clinical/procedural
 * topics get a floor bump since they genuinely need more explanation regardless
 * of raw text length (adaptation, downtime, comparison are all expected).
 */
export function estimateSlideCount(primarySubject: string, sourceText: string): number {
  const length = sourceText.length;
  const base = length > 9000 ? 8 : length > 6000 ? 7 : length > 3000 ? 6 : 5;
  const bump = CLINICAL_EXPLAINER_TERMS.test(primarySubject) ? 1 : 0;
  return Math.min(MAX_TOTAL_SLIDES, Math.max(MIN_TOTAL_SLIDES, base + bump));
}

const CTA_FACT = "次の文言をそのまま使う: title「診察で状態に合わせてご案内します」 body「ご予約・ご相談はプロフィールの公式LINEへ」";

/** The repertoire of content-slide roles, cycled to fill however many content slots a carousel has. */
export const CONTENT_SLIDE_KINDS: CarouselSlideKind[] = ["background", "caution", "option", "consultation", "summary"];

const FACT_INSTRUCTION_BY_KIND: Record<Exclude<CarouselSlideKind, "cover" | "cta">, string> = {
  background: "参照テキストにある、原因・仕組み（メカニズム）についての具体的な一文を要約する",
  caution: "参照テキストにある、自己判断しにくい点・受診が必要な状態・混同されやすい別の状態との違いを具体的に要約する",
  option: "参照テキストにある治療の選択肢や比較表のうち、実在する1つを名前つきで要約する",
  consultation: "参照テキストにあるダウンタイム・痛み・回数の目安など、具体的な記述を1つ要約する",
  summary: "参照テキストにある「このような方に検討します」等の対象者の具体例を1つ要約する",
};

/**
 * factInstruction for the Nth (0-indexed) content slide. Once the repertoire of 5
 * roles is exhausted (a carousel with more than 5 content slots), it cycles back
 * with an explicit instruction to cover a different aspect than earlier slides of
 * the same role, so repeats don't just restate the same fact.
 */
export function factInstructionForContentSlide(index: number): { kind: CarouselSlideKind; factInstruction: string } {
  const kind = CONTENT_SLIDE_KINDS[index % CONTENT_SLIDE_KINDS.length]!;
  const cycle = Math.floor(index / CONTENT_SLIDE_KINDS.length);
  const variantNote = cycle > 0 ? `（${cycle + 1}周目: 参照テキストの中の別の部分・別の観点から書き、前に出た同種のページと内容を重複させない）` : "";
  return { kind, factInstruction: FACT_INSTRUCTION_BY_KIND[kind as Exclude<CarouselSlideKind, "cover" | "cta">] + variantNote };
}

/**
 * Unlike the original Manus template (which put placeholder TEXT like "選択肢を考える"
 * directly into the slide and asked the LLM to keep the vibe), this template puts an
 * INSTRUCTION for what fact to extract from the supplied official-site text. The LLM
 * never sees filler copy to imitate — only a directive to pull a specific real detail.
 */
export function buildCarouselSlidePlan(totalSlides: number): CarouselSlidePlan[] {
  const clamped = Math.min(MAX_TOTAL_SLIDES, Math.max(MIN_TOTAL_SLIDES, totalSlides));
  const cover: CarouselSlidePlan = {
    order: 1,
    kind: "cover",
    factInstruction: "参照テキストにある主題名・キャッチコピー的な一文を要約し、見出しにする（誇大表現は避ける）",
  };
  const cta: CarouselSlidePlan = { order: clamped, kind: "cta", factInstruction: CTA_FACT };
  const contentCount = clamped - 2;
  const contentSlides: CarouselSlidePlan[] = Array.from({ length: contentCount }, (_, index) => {
    const { kind, factInstruction } = factInstructionForContentSlide(index);
    return { order: index + 2, kind, factInstruction };
  });
  return [cover, ...contentSlides, cta];
}
