import { readFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { getIssueBody, extractDraftIdFromIssueBody, isApprovalComment, commentOnIssue, closeIssue } from "../src/approval/issue";
import { publishCarouselPost, buildRawGithubUrl } from "../src/publish/instagramGraph";
import { appendPostHistory } from "../src/state/history";

type Manifest = { draftId: string; subject: string; caption: string; hashtags: string[]; slides: Array<{ order: number; fileName: string }> };

async function main() {
  // Read from env vars, not argv/shell interpolation: github.event.comment.body is
  // attacker-controlled on a PUBLIC repo (anyone can comment), so it must never be
  // spliced into a `run:` shell command line — that's a classic script-injection hole.
  const issueNumber = Number(process.env.ISSUE_NUMBER);
  const commentBody = process.env.COMMENT_BODY ?? "";
  if (!issueNumber) throw new Error("ISSUE_NUMBER environment variable is required.");

  if (!isApprovalComment(commentBody)) {
    console.log(`承認コメントではないため何もしません: "${commentBody}"`);
    return;
  }

  const issueBody = await getIssueBody(issueNumber);
  const draftId = extractDraftIdFromIssueBody(issueBody);
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "drafts", draftId, "manifest.json"), "utf8")) as Manifest;

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not configured.");
  const commitSha = execSync("git rev-parse HEAD").toString().trim();
  const imageUrls = manifest.slides
    .sort((a, b) => a.order - b.order)
    .map(slide => buildRawGithubUrl(repository, commitSha, `drafts/${draftId}/${slide.fileName}`));

  const caption = `${manifest.caption}\n\n${manifest.hashtags.join(" ")}`;

  try {
    const result = await publishCarouselPost({ imageUrls, caption });
    await appendPostHistory({ subject: manifest.subject, publishedAt: new Date().toISOString() });
    await commentOnIssue(issueNumber, `Instagramへ公開しました。media_id: ${result.mediaId}`);
    await closeIssue(issueNumber);
    console.log(`公開しました: media_id=${result.mediaId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await commentOnIssue(issueNumber, `公開に失敗しました: ${message}\n\n修正後、再度 \`approve\` とコメントしてください。`);
    throw error;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
