import { readFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { createDraftApprovalIssue } from "../src/approval/issue";
import { buildRawGithubUrl } from "../src/publish/instagramGraph";

type Manifest = {
  draftId: string;
  subject: string;
  caption: string;
  hashtags: string[];
  complianceNotes: string;
  slides: Array<{ order: number; kind: string; title: string; body: string; fileName: string }>;
};

async function main() {
  const draftId = process.argv[2];
  if (!draftId) throw new Error("使い方: tsx scripts/create-issue.ts <draftId>");

  const manifestPath = path.join(process.cwd(), "drafts", draftId, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not configured.");
  // The commit that just pushed drafts/<draftId>/ — must run AFTER git push.
  const commitSha = execSync("git rev-parse HEAD").toString().trim();

  const imageUrls = manifest.slides
    .sort((a, b) => a.order - b.order)
    .map(slide => buildRawGithubUrl(repository, commitSha, `drafts/${draftId}/${slide.fileName}`));

  const { issueNumber, url } = await createDraftApprovalIssue({
    draftId: manifest.draftId,
    subject: manifest.subject,
    caption: manifest.caption,
    hashtags: manifest.hashtags,
    imageUrls,
    slideTexts: manifest.slides.map(({ order, title, body }) => ({ order, title, body })),
    complianceNotes: manifest.complianceNotes,
  });

  console.log(`承認Issueを作成しました: #${issueNumber} ${url}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
