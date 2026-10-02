import { readFile } from "node:fs/promises";
import path from "node:path";
import { createReelApprovalIssue } from "../src/approval/issue";
import { buildRawGithubUrl } from "../src/publish/instagramGraph";

type ReelManifest = {
  reelId: string;
  articleId: string;
  subject: string;
  hook: string;
  scenes: Array<{ heading: string; body: string }>;
  closing: string;
  caption: string;
  hashtags: string[];
  complianceNotes: string;
  videoFileName: string;
  coverFileName: string;
  sceneStillFileNames: string[];
  bgmFileName: string | null;
  durationSeconds: number;
};

async function main() {
  const reelId = process.argv[2];
  if (!reelId) throw new Error("使い方: tsx scripts/create-reel-issue.ts <reelId>");

  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "reels", reelId, "manifest.json"), "utf8")) as ReelManifest;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not configured.");
  const rawUrl = (fileName: string) => buildRawGithubUrl(repository, "main", `reels/${reelId}/${fileName}`);

  const { issueNumber, url } = await createReelApprovalIssue({
    reelId: manifest.reelId,
    articleId: manifest.articleId,
    subject: manifest.subject,
    caption: manifest.caption,
    hashtags: manifest.hashtags,
    videoUrl: rawUrl(manifest.videoFileName),
    coverUrl: rawUrl(manifest.coverFileName),
    sceneStillUrls: manifest.sceneStillFileNames.map(rawUrl),
    hook: manifest.hook,
    scenes: manifest.scenes,
    closing: manifest.closing,
    durationSeconds: manifest.durationSeconds,
    bgmFileName: manifest.bgmFileName,
    complianceNotes: manifest.complianceNotes,
  });

  console.log(`リール承認Issueを作成しました: #${issueNumber} ${url}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
