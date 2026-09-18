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
  subject: string;
  caption: string;
  hashtags: string[];
  imageUrls: string[];
  slideTexts: Array<{ order: number; title: string; body: string }>;
  complianceNotes: string;
};

const APPROVAL_LABEL = "instagram-draft";

export async function createDraftApprovalIssue(input: DraftIssueInput): Promise<{ issueNumber: number; url: string }> {
  const imagesMarkdown = input.imageUrls.map((url, index) => `**${index + 1}枚目**\n\n![slide-${index + 1}](${url})`).join("\n\n");
  const slidesMarkdown = input.slideTexts.map(slide => `- **${slide.order}枚目**: ${slide.title} — ${slide.body}`).join("\n");
  const body = `## 投稿案: ${input.subject}

<!-- draft-id: ${input.draftId} -->

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

export function isApprovalComment(commentBody: string): boolean {
  return commentBody.trim().toLowerCase() === "approve";
}
