function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function githubFetch(path: string, init: RequestInit) {
  const token = requireEnv("GITHUB_TOKEN");
  const repo = requireEnv("GITHUB_REPOSITORY");
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub API呼び出しに失敗しました (${response.status}): ${detail}`);
  }
  return response.json();
}

export type DraftIssueInput = {
  draftId: string;
  articleId: string;
  subject: string;
  caption: string;
  hashtags: string[];
  imageUrls: string[];
  slideTexts: Array<{ order: number; title: string; body: string }>;
  complianceNotes: string;
  requiresManualPhoto?: boolean;
};

const APPROVAL_LABEL = "instagram-draft";
/** Separate label so publish.yml / the staff worker (carousel-only) never pick up reel Issues. */
export const REEL_APPROVAL_LABEL = "instagram-reel";

export async function createDraftApprovalIssue(input: DraftIssueInput): Promise<{ issueNumber: number; url: string }> {
  const imagesMarkdown = input.imageUrls.map((url, index) => `**${index + 1}枚目**\n\n![slide-${index + 1}](${url})`).join("\n\n");
  const slidesMarkdown = input.slideTexts.map(slide => `- **${slide.order}枚目**: ${slide.title} — ${slide.body}`).join("\n");
  const manualPhotoWarning = input.requiresManualPhoto
    ? `\n> ⚠️ **症例記事です。表紙は仮の写真です。** 実際の同意済み症例写真を \`drafts/${input.draftId}/slide-01.jpg\` に差し替えてから承認してください（GitHubのファイルアップロード画面から、同じファイル名で上書きアップロードできます）。写真の差し替え忘れのまま承認すると、仮写真のまま公開されます。\n`
    : "";
  const body = `## 投稿案: ${input.subject}

<!-- draft-id: ${input.draftId} -->
<!-- article-id: ${input.articleId} -->
${manualPhotoWarning}
### キャプション

${input.caption}

${input.hashtags.join(" ")}

### 各ページのテキスト

${slidesMarkdown}

### 医療広告配慮メモ

${input.complianceNotes}

### プレビュー

${imagesMarkdown}

---

**承認する場合は、このIssueに \`approve\` とだけコメントしてください。** 修正が必要な場合は却下理由をコメントし、Issueをクローズしてください（次回の定期実行で新しい草案が作られます）。`;

  const issue = (await githubFetch("/issues", {
    method: "POST",
    body: JSON.stringify({ title: `[承認待ち] ${input.subject}`, body, labels: [APPROVAL_LABEL] }),
  })) as { number: number; html_url: string };

  return { issueNumber: issue.number, url: issue.html_url };
}

export type ReelIssueInput = {
  reelId: string;
  articleId: string;
  subject: string;
  caption: string;
  hashtags: string[];
  videoUrl: string;
  coverUrl: string;
  sceneStillUrls: string[];
  hook: string;
  scenes: Array<{ heading: string; body: string }>;
  closing: string;
  durationSeconds: number;
  bgmFileName: string | null;
  complianceNotes: string;
};

export async function createReelApprovalIssue(input: ReelIssueInput): Promise<{ issueNumber: number; url: string }> {
  const scenesMarkdown = input.scenes.map((scene, index) => `${index + 1}. **${scene.heading}** — ${scene.body}`).join("\n");
  const stillsMarkdown = input.sceneStillUrls.map(url => `<img src="${url}" width="180">`).join(" ");
  const bgmLine = input.bgmFileName
    ? `BGM: \`${input.bgmFileName}\``
    : `> ⚠️ **BGMなしで書き出されています。** \`assets/bgm/\` に著作権フリーの音源を置くと、次回から自動で動画に入ります。`;
  const body = `## リール案: ${input.subject}

<!-- reel-id: ${input.reelId} -->
<!-- article-id: ${input.articleId} -->

### 動画

**[▶ 動画ファイルを開く（reel.mp4・${input.durationSeconds}秒）](${input.videoUrl})** ※ブラウザによってはダウンロードされます

${bgmLine}

<img src="${input.coverUrl}" width="270">

### 各シーンの静止画

${stillsMarkdown}

### 台本

- **冒頭**: ${input.hook}
${scenesMarkdown}
- **締め**: ${input.closing}

### キャプション

${input.caption}

${input.hashtags.join(" ")}

### 医療広告配慮メモ

${input.complianceNotes}

---

**承認する場合は、このIssueに \`approve\` とだけコメントしてください。** リールとしてInstagramに公開されます。修正が必要な場合は却下理由をコメントし、Issueをクローズしてください。`;

  const issue = (await githubFetch("/issues", {
    method: "POST",
    body: JSON.stringify({ title: `[リール承認待ち] ${input.subject}`, body, labels: [REEL_APPROVAL_LABEL] }),
  })) as { number: number; html_url: string };

  return { issueNumber: issue.number, url: issue.html_url };
}

export function extractReelIdFromIssueBody(body: string): string {
  const match = body.match(/<!-- reel-id: (.+?) -->/);
  if (!match) throw new Error("Issue本文からreel-idを抽出できませんでした。");
  return match[1]!;
}

export async function commentOnIssue(issueNumber: number, body: string): Promise<void> {
  await githubFetch(`/issues/${issueNumber}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

export async function closeIssue(issueNumber: number): Promise<void> {
  await githubFetch(`/issues/${issueNumber}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
}

export async function getIssueBody(issueNumber: number): Promise<string> {
  const issue = (await githubFetch(`/issues/${issueNumber}`, { method: "GET" })) as { body: string };
  return issue.body;
}

export function extractDraftIdFromIssueBody(body: string): string {
  const match = body.match(/<!-- draft-id: (.+?) -->/);
  if (!match) throw new Error("Issue本文からdraft-idを抽出できませんでした。");
  return match[1]!;
}

/**
 * articleIds already sitting in an open (not yet approved/closed) approval Issue.
 * Re-running the generate workflow before staff approve the current draft would
 * otherwise pick the same next-in-sequence article again — see selectScheduledTheme
 * in src/content/themes.ts, which excludes these in addition to published posts.
 */
export async function listOpenDraftArticleIds(label = APPROVAL_LABEL): Promise<Set<string>> {
  const issues = (await githubFetch(`/issues?state=open&labels=${label}&per_page=100`, { method: "GET" })) as Array<{ body: string | null }>;
  const articleIds = issues
    .map(issue => issue.body?.match(/<!-- article-id: (.+?) -->/)?.[1])
    .filter((id): id is string => Boolean(id));
  return new Set(articleIds);
}

export function isApprovalComment(commentBody: string): boolean {
  return commentBody.trim().toLowerCase() === "approve";
}
