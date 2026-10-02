import { readFile } from "node:fs/promises";
import path from "node:path";
import { getIssueBody, extractReelIdFromIssueBody, isApprovalComment, commentOnIssue, closeIssue } from "../src/approval/issue";
import { publishReelPost, buildRawGithubUrl } from "../src/publish/instagramGraph";
import { appendPostHistory, REEL_HISTORY_PATH } from "../src/state/history";

type Manifest = { reelId: string; articleId: string; subject: string; caption: string; hashtags: string[]; videoFileName: string; coverFileName: string };

async function main() {
  // Same rule as publish-approved.ts: the comment body is attacker-controlled on a
  // public repo, so it only ever arrives through env vars.
  const issueNumber = Number(process.env.ISSUE_NUMBER);
  const commentBody = process.env.COMMENT_BODY ?? "";
  if (!issueNumber) throw new Error("ISSUE_NUMBER environment variable is required.");

  if (!isApprovalComment(commentBody)) {
    console.log(`承認コメントではないため何もしません: "${commentBody}"`);
    return;
  }

  const reelId = extractReelIdFromIssueBody(await getIssueBody(issueNumber));
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "reels", reelId, "manifest.json"), "utf8")) as Manifest;

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not configured.");
  const rawUrl = (fileName: string) => buildRawGithubUrl(repository, "main", `reels/${reelId}/${fileName}`);
  const caption = `${manifest.caption}\n\n${manifest.hashtags.join(" ")}`;

  try {
    const result = await publishReelPost({ videoUrl: rawUrl(manifest.videoFileName), coverUrl: rawUrl(manifest.coverFileName), caption });
    await appendPostHistory({ subject: manifest.subject, articleId: manifest.articleId, publishedAt: new Date().toISOString() }, REEL_HISTORY_PATH);
    await commentOnIssue(issueNumber, `リールをInstagramへ公開しました。media_id: ${result.mediaId}`);
    await closeIssue(issueNumber);
    console.log(`公開しました: media_id=${result.mediaId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await commentOnIssue(issueNumber, `リールの公開に失敗しました: ${message}\n\n修正後、再度 \`approve\` とコメントしてください。`);
    throw error;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
