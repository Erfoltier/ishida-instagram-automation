import { invokeClaudeJSON } from "../llm/claude";
import {
  AI_CLICHE_PATTERNS,
  BOOKING_BLOCK,
  CLINIC_INFO_BLOCK,
  MedicalAdvertisingCopyError,
  assertNoBannedPatterns,
} from "./draftGeneration";
import type { ScheduledTheme } from "./themes";

/**
 * Reel-only script (separate from the carousel copy): a short vertical video is
 * read in ~30 seconds, so every on-screen line is much shorter than a carousel
 * page, and the structure is fixed to hook -> points -> closing.
 */
export type ReelScene = { heading: string; body: string };

export type ReelScript = {
  eyebrow: string;
  /** First 3 seconds — the line that makes viewers stop scrolling. */
  hook: string;
  scenes: ReelScene[];
  /** Last scene's message, shown above the fixed clinic info block. */
  closing: string;
  caption: string;
  hashtags: string[];
  imageSearchQuery: string;
  complianceNotes: string;
};

export const REEL_TEXT_LIMITS = { hook: 24, heading: 20, body: 50, closing: 30 } as const;
const MIN_SCENES = 3;
const MAX_SCENES = 5;

const REEL_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string", description: `${REEL_TEXT_LIMITS.hook}文字以内。冒頭3秒で表示する一言。` },
    scenes: {
      type: "array",
      description: `${MIN_SCENES}〜${MAX_SCENES}個。1シーン1論点。`,
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: `${REEL_TEXT_LIMITS.heading}文字以内の見出し` },
          body: { type: "string", description: `${REEL_TEXT_LIMITS.body}文字以内の補足` },
        },
        required: ["heading", "body"],
      },
    },
    closing: { type: "string", description: `${REEL_TEXT_LIMITS.closing}文字以内。最後のシーンで表示する締めの一言。` },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    imageSearchQuery: { type: "string", description: "冒頭シーンの背景写真をAI生成するための被写体の英語の短い説明" },
    complianceNotes: { type: "string" },
  },
  required: ["hook", "scenes", "closing", "caption", "hashtags", "imageSearchQuery", "complianceNotes"],
} as const;

function imageSubjectInstruction(theme: ScheduledTheme): string {
  return theme.persona === "C"
    ? `必ず"handsome, well-groomed Japanese man"を含めてください。`
    : `必ず"beautiful, elegant Japanese woman"を含めてください。`;
}

function validateReelScript(script: Omit<ReelScript, "eyebrow">): void {
  const problems: string[] = [];
  if (!script.hook?.trim() || script.hook.length > REEL_TEXT_LIMITS.hook) problems.push(`hookは1〜${REEL_TEXT_LIMITS.hook}文字`);
  if (!script.closing?.trim() || script.closing.length > REEL_TEXT_LIMITS.closing) problems.push(`closingは1〜${REEL_TEXT_LIMITS.closing}文字`);
  if (!Array.isArray(script.scenes) || script.scenes.length < MIN_SCENES || script.scenes.length > MAX_SCENES) {
    problems.push(`scenesは${MIN_SCENES}〜${MAX_SCENES}個`);
  } else {
    script.scenes.forEach((scene, index) => {
      if (!scene.heading?.trim() || scene.heading.length > REEL_TEXT_LIMITS.heading) problems.push(`${index + 1}番目のheadingは1〜${REEL_TEXT_LIMITS.heading}文字`);
      if (!scene.body?.trim() || scene.body.length > REEL_TEXT_LIMITS.body) problems.push(`${index + 1}番目のbodyは1〜${REEL_TEXT_LIMITS.body}文字`);
    });
  }
  if (problems.length > 0) throw new ReelScriptFormatError(problems);
}

class ReelScriptFormatError extends Error {
  constructor(readonly problems: string[]) {
    super(`リール台本の文字数・構成が基準外です: ${problems.join("、")}`);
    this.name = "ReelScriptFormatError";
  }
}

async function createReelScriptOnce(theme: ScheduledTheme, sourceText: string, extraInstruction?: string): Promise<ReelScript> {
  const script = await invokeClaudeJSON<Omit<ReelScript, "eyebrow">>({
    model: "claude-sonnet-5",
    maxTokens: 8192,
    toolName: "submit_instagram_reel_script",
    toolDescription: "Instagramリール動画の台本を提出する",
    schema: REEL_SCHEMA,
    system: `あなたは埼玉県東大宮の美容皮膚科のSNS編集者です。約30秒の縦型リール動画（1080x1920、音声ナレーションなし・テキストとBGMのみ）の台本を作ります。日本の医療広告ガイドラインに配慮し、架空の診察室・院内描写、ビフォーアフター、患者体験談、誇大表現、効果保証、価格訴求、限定訴求、根拠のない比較優位、過度な恐怖や羞恥、偽の希少性は禁止です。

構成は「hook（冒頭3秒の一言）→ scenes（${MIN_SCENES}〜${MAX_SCENES}個、1シーン1論点）→ closing（締めの一言）」で固定です。
- 画面のテキストはスマホで一瞬で読める長さにする。hookは${REEL_TEXT_LIMITS.hook}文字以内、各sceneのheadingは${REEL_TEXT_LIMITS.heading}文字以内、bodyは${REEL_TEXT_LIMITS.body}文字以内、closingは${REEL_TEXT_LIMITS.closing}文字以内。
- hookは答えを言わず「続きを見たくなる」問いかけ・言い切りにする。「知らないと損」「〜していませんか」の多用は避ける。
- 各sceneのbodyは、下に渡す「参照テキスト（公式サイトの実際の記載）」から引用・要約できる具体的な事実だけにする。参照テキストにない効果・数値・保証を作らない。
- 「人それぞれです」「選択肢を検討しましょう」のような何も言っていない一般論は禁止。
- closingは診察・相談への穏やかな誘導にする（予約を急かさない）。クリニック名・アクセス・予約導線は動画テンプレート側で固定表示するので、closingには書かない。
- captionは本文約8行。動画にない補足情報（対象・方法・期間・制限・リスクなど）を参照テキストから加える。
- 地域SEOとして埼玉、大宮、東大宮を含むハッシュタグを8〜10個作る。`,
    user: `今回のリールのテーマは「${theme.subject}」（記事ID: ${theme.articleId}、対象読者: ${theme.persona}）です。${theme.request}
動画を見た人に促す次の行動: ${theme.nextAction}

--- 参照テキスト（当院公式サイトの実際の記載。この内容だけを根拠にすること） ---
${sourceText}
--- 参照テキストここまで ---

imageSearchQueryは冒頭シーンの背景写真をAI生成するための被写体の英語の説明です。${imageSubjectInstruction(theme)}${extraInstruction ?? ""}`,
  });

  validateReelScript(script);
  if (script.complianceNotes === undefined) script.complianceNotes = "（生成時にコンプライアンスメモが取得できませんでした。内容を確認してください。）";

  const onScreenText = [script.hook, ...script.scenes.flatMap(scene => [scene.heading, scene.body]), script.closing].join(" ");
  assertNoBannedPatterns(`${onScreenText} ${script.caption} ${script.hashtags.join(" ")}`);
  const cliches = AI_CLICHE_PATTERNS.filter(pattern => onScreenText.includes(pattern));
  if (cliches.length > 0) throw new ReelScriptFormatError([`AIっぽい定型句（${cliches.join("、")}）を使わない`]);

  const hashtags = Array.from(new Set(
    ["#埼玉美容皮膚科", "#大宮美容皮膚科", "#東大宮皮膚科", "#いしだ皮フ科"].concat(
      script.hashtags.map(tag => (tag.startsWith("#") ? tag : `#${tag}`))
    )
  )).slice(0, 10);

  return {
    ...script,
    hook: script.hook.trim(),
    closing: script.closing.trim(),
    scenes: script.scenes.map(scene => ({ heading: scene.heading.trim(), body: scene.body.trim() })),
    eyebrow: theme.category?.label ?? "NEWS",
    hashtags,
    caption: `${script.caption.trim()}\n\n${theme.sourceUrls[0]}\n\n${CLINIC_INFO_BLOCK}\n\n${BOOKING_BLOCK}`,
  };
}

export async function createReelScript(theme: ScheduledTheme, sourceText: string): Promise<ReelScript> {
  try {
    return await createReelScriptOnce(theme, sourceText);
  } catch (error) {
    let reason: string;
    if (error instanceof MedicalAdvertisingCopyError) reason = `禁止表現（${error.matchedPatterns.join("、")}）が含まれていた`;
    else if (error instanceof ReelScriptFormatError) reason = `次の基準を満たしていなかった: ${error.problems.join("、")}`;
    else throw error;
    return createReelScriptOnce(theme, sourceText, `\n重要: 前回の台本は${reason}ため無効でした。参照テキストの具体的な事実だけを使い、文字数を守って作り直してください。`);
  }
}
