import { invokeClaudeJSON } from "../llm/claude";
import type { CarouselSlidePlan } from "./carouselPlan";
import type { ScheduledTheme } from "./themes";

const LINE_URL = "https://lin.ee/OFlfdeH";
const FIXED_CLOSING = `\n\nご予約・ご相談は、プロフィールの公式LINEから承っています。\n${LINE_URL}\n※DMでは個別の診療相談・予約を承っていません。`;
const BANNED_PATTERNS = [
  "必ず", "絶対", "完治", "治る", "最安", "No\\.1", "ナンバーワン", "症例写真", "ビフォー", "アフター",
  "最短", "永久", "劇的", "保証", "限定価格", "診察室", "院内写真",
];
/** Stock AI-cliche phrases the grounded prompt should never fall back to when the source text runs out. */
const AI_CLICHE_PATTERNS = [
  "人それぞれ", "肌の状態は人によって", "選択肢を検討しましょう", "自分に合った方法を見つけ", "焦らず向き合",
];

export class MedicalAdvertisingCopyError extends Error {
  constructor(readonly matchedPatterns: string[]) {
    super(`医療広告ルールに抵触する可能性がある表現を検出しました: ${matchedPatterns.join(", ")}`);
    this.name = "MedicalAdvertisingCopyError";
  }
}

export type GeneratedDraft = {
  primarySubject: string;
  topic: string;
  treatmentTheme: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  caption: string;
  hashtags: string[];
  imageSearchQuery: string;
  complianceNotes: string;
};

function getThemeEyebrow(theme: string) {
  const normalized = theme.toLowerCase();
  if (normalized.includes("紫外線") || normalized.includes("uv")) return "UV CARE";
  if (normalized.includes("毛穴") || normalized.includes("くすみ")) return "PORE CARE";
  if (normalized.includes("ニキビ")) return "ACNE CARE";
  if (normalized.includes("シミ") || normalized.includes("肝斑")) return "SPOT CARE";
  if (normalized.includes("赤ら顔")) return "REDNESS CARE";
  if (normalized.includes("乾燥") || normalized.includes("ゆらぎ")) return "DRY SKIN CARE";
  return "SKIN CARE";
}

function assertNoBannedPatterns(combinedText: string) {
  const matched = BANNED_PATTERNS.filter(pattern => new RegExp(pattern, "i").test(combinedText));
  if (matched.length > 0) throw new MedicalAdvertisingCopyError(matched);
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    primarySubject: { type: "string", description: "12文字以内。単一の悩み・治療名だけ。" },
    topic: { type: "string" },
    treatmentTheme: { type: "string", description: "18文字以内。primarySubjectと同じ一主題。" },
    headline: { type: "string", description: "15〜26文字。読める日本語。" },
    subheadline: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    imageSearchQuery: { type: "string", description: "表紙に使う実写ストック写真を検索するための、英語の短い検索クエリ（人物の年齢層・表情・構図の指定を含む）" },
    complianceNotes: { type: "string" },
  },
  required: ["primarySubject", "topic", "treatmentTheme", "headline", "subheadline", "caption", "hashtags", "imageSearchQuery", "complianceNotes"],
} as const;

async function createPostCopyOnce(theme: ScheduledTheme, sourceText: string, extraInstruction?: string): Promise<GeneratedDraft> {
  const draft = await invokeClaudeJSON<Omit<GeneratedDraft, "eyebrow">>({
    model: "claude-sonnet-5",
    maxTokens: 1800,
    toolName: "submit_instagram_draft",
    toolDescription: "Instagramカルーセル投稿の草案を提出する",
    schema: DRAFT_SCHEMA,
    system: `あなたは埼玉県東大宮の美容皮膚科のSNS編集者です。日本の医療広告ガイドラインに配慮し、誠実で上品な投稿案を作成します。架空の診察室・院内写真、医師の顔を中心に売り込む表現、ビフォーアフター、患者体験談、誇大表現、効果保証、価格訴求、限定訴求は禁止です。

最重要: 文章は「AIが書いたテンプレート」に見えてはいけません。以下は必ず守ってください。
- 下に渡す「参照テキスト（公式サイトの実際の記載）」に書かれている事実だけを根拠にする。参照テキストにない効果・数値・保証を作り出さない。
- 「人それぞれです」「選択肢を検討しましょう」のような、何も言っていない一般論の締めくくりを使わない。必ず参照テキストから拾った具体的な情報（原因の名称、比較対象、回数の目安、対象者の具体例など）を書く。
- 一文一文が、その投稿でしか成立しない具体的な内容になっているか自問し、他のどんなテーマにも使い回せる文なら書き直す。
- 地域SEOとして埼玉、大宮、東大宮を含むハッシュタグを8〜10個作る。`,
    user: `今回の投稿テーマは「${theme.subject}」です。${theme.request}

--- 参照テキスト（当院公式サイトの実際の記載。この内容だけを根拠にすること） ---
${sourceText}
--- 参照テキストここまで ---

primarySubjectには単一の悩み・治療・告知だけを12文字以内で記載してください。既存の投稿基準は、上品・清潔・静かな高級感です。imageSearchQueryは、表紙に使う実写ストック写真（Adobe Stock検索用）を探すための英語の短い検索クエリにしてください（例: "calm asian woman skin closeup natural daylight"）。${extraInstruction ?? ""}`,
  });

  const combined = `${draft.headline} ${draft.subheadline} ${draft.caption} ${draft.hashtags.join(" ")}`;
  assertNoBannedPatterns(combined);

  const hashtags = Array.from(new Set(
    ["#埼玉美容皮膚科", "#大宮美容皮膚科", "#東大宮皮膚科", "#いしだ皮フ科"].concat(
      draft.hashtags.map(tag => (tag.startsWith("#") ? tag : `#${tag}`))
    )
  )).slice(0, 10);

  return {
    ...draft,
    eyebrow: getThemeEyebrow(draft.treatmentTheme),
    hashtags,
    caption: `${draft.caption.trim()}${FIXED_CLOSING}`,
  };
}

function findCompoundSubject(draft: GeneratedDraft) {
  if (/(?:と|・|／|\/|&|＆|×|\+|や|または|若しくは)/.test(draft.primarySubject)) {
    return "primarySubjectに複数の対象を接続する表現";
  }
  if (/[・／/&＆×+]/.test(draft.treatmentTheme)) return "treatmentThemeに複数の悩み・治療を区切る記号";
  return null;
}

async function checkSingleSubject(draft: GeneratedDraft): Promise<string | null> {
  const deterministic = findCompoundSubject(draft);
  if (deterministic) return deterministic;

  const result = await invokeClaudeJSON<{ isSingleSubject: boolean; reason: string }>({
    maxTokens: 300,
    toolName: "submit_single_subject_check",
    toolDescription: "投稿案が単一主題かどうかの判定結果を提出する",
    schema: {
      type: "object",
      properties: { isSingleSubject: { type: "boolean" }, reason: { type: "string" } },
      required: ["isSingleSubject", "reason"],
    },
    system: "あなたは美容医療のSNS原稿を審査します。効果や適応は判断せず、文章が一つの悩み・治療・告知だけを主題としているかを判定してください。",
    user: `次の草案が複数の独立した主題を混在させていないか判定してください。\nprimarySubject: ${draft.primarySubject}\ntopic: ${draft.topic}\nheadline: ${draft.headline}`,
  });
  if (result.isSingleSubject) return null;
  return result.reason || "独立した単一主題の確認に失敗";
}

export async function createPostCopy(theme: ScheduledTheme, sourceText: string): Promise<GeneratedDraft> {
  let draft: GeneratedDraft;
  try {
    draft = await createPostCopyOnce(theme, sourceText);
  } catch (error) {
    if (!(error instanceof MedicalAdvertisingCopyError)) throw error;
    draft = await createPostCopyOnce(theme, sourceText, `\n重要: 前回の草案には禁止表現（${error.matchedPatterns.join("、")}）が含まれていました。効果を断定せず、誠実で安全な表現だけで作成してください。`);
  }

  const compoundReason = await checkSingleSubject(draft);
  if (!compoundReason) return draft;

  const retried = await createPostCopyOnce(theme, sourceText, `\n重要: 前回は「${compoundReason}」を混在させたため無効でした。必ず一主題だけで作り直してください。`);
  const retryReason = await checkSingleSubject(retried);
  if (retryReason) throw new Error(`投稿案が複数の主題を混在させています: ${retryReason}`);
  return retried;
}

export type GeneratedCarouselSlide = CarouselSlidePlan & { title: string; body: string };

const SLIDE_COPY_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "number" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["order", "title", "body"],
      },
    },
  },
  required: ["slides"],
} as const;

async function createCarouselSlideCopyOnce(
  draft: GeneratedDraft,
  plan: CarouselSlidePlan[],
  sourceText: string,
  extraInstruction?: string
): Promise<GeneratedCarouselSlide[]> {
  const result = await invokeClaudeJSON<{ slides: Array<{ order: number; title: string; body: string }> }>({
    maxTokens: 1500,
    toolName: "submit_carousel_slides",
    toolDescription: "カルーセル各ページのtitle/bodyを提出する",
    schema: SLIDE_COPY_SCHEMA,
    system: `あなたは美容皮膚科のSNS編集者です。日本の医療広告に配慮した、画像1枚ごとに一論点だけを示す短い日本語を書きます。効果保証、優位表現、価格・限定訴求、患者体験、症例、ビフォーアフター、架空の院内・施術描写を含めません。適応、痛み、回数、ダウンタイムは診察で個別に案内する表現に留めます。

各ページのbodyは、下に渡す「参照テキスト」から実際に引用・要約できる具体的な内容にしてください。「人それぞれです」のような何も言っていない一般論だけで終わらせるのは禁止です。titleを42文字以内、bodyを100文字以内にしてください。`,
    user: `主題は「${draft.primarySubject}」だけです。

--- 参照テキスト ---
${sourceText}
--- 参照テキストここまで ---

次の${plan.length}枚の構成に沿って、各ページのtitle/bodyを書いてください。構成の「factInstruction」は、そのページのbodyが実際に含むべき内容の指示です（そのままコピーせず、指示に従って参照テキストから内容を作ってください）。

構成:
${plan.map(slide => `${slide.order}. [${slide.kind}] 指示: ${slide.factInstruction}`).join("\n")}
${extraInstruction ?? ""}`,
  });

  if (result.slides.length !== plan.length) throw new Error("カルーセル説明文のページ数が指定構成と一致しません。");
  const byOrder = new Map(result.slides.map(slide => [slide.order, slide]));
  const slides = plan.map(slide => {
    const copied = byOrder.get(slide.order);
    if (!copied) throw new Error("カルーセル説明文のページ順が不足しています。");
    const title = copied.title.trim();
    const body = copied.body.trim();
    if (!title || !body || title.length > 42 || body.length > 100) throw new Error("カルーセル説明文の文字数が基準外です。");
    return { ...slide, title, body };
  });

  const combined = slides.map(slide => `${slide.title} ${slide.body}`).join(" ");
  assertNoBannedPatterns(combined);
  const cliches = AI_CLICHE_PATTERNS.filter(pattern => combined.includes(pattern));
  if (cliches.length > 0) throw new Error(`AIっぽい定型句が含まれています: ${cliches.join("、")}`);

  return slides;
}

export async function createCarouselSlideCopy(draft: GeneratedDraft, plan: CarouselSlidePlan[], sourceText: string): Promise<GeneratedCarouselSlide[]> {
  try {
    return await createCarouselSlideCopyOnce(draft, plan, sourceText);
  } catch (error) {
    if (!(error instanceof MedicalAdvertisingCopyError) && !(error instanceof Error && error.message.startsWith("AIっぽい"))) throw error;
    const reason = error instanceof MedicalAdvertisingCopyError ? `禁止表現（${error.matchedPatterns.join("、")}）` : error.message;
    return createCarouselSlideCopyOnce(draft, plan, sourceText, `\n重要: 前回は${reason}のため無効でした。参照テキストの具体的な事実だけを使って書き直してください。`);
  }
}
