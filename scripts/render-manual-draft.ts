import { readFile } from "node:fs/promises";
import path from "node:path";
import { regenerateSlide } from "../src/render/renderSlides";

/**
 * Renders slides for a hand-written draft (drafts/<id>/manifest.json written by
 * staff instead of generate-draft.ts). The cover needs drafts/<id>/cover-source.jpg
 * to be placed first; without it the cover is skipped and only the text slides render.
 */
async function main() {
  const draftId = process.env.DRAFT_ID?.trim();
  if (!draftId) throw new Error("DRAFT_ID を指定してください。");
  const draftDir = path.join(process.cwd(), "drafts", draftId);
  const manifest = JSON.parse(await readFile(path.join(draftDir, "manifest.json"), "utf8"));
  const hasCoverSource = await readFile(path.join(draftDir, "cover-source.jpg")).then(() => true, () => false);

  for (const slide of manifest.slides) {
    if (slide.kind === "cover" && !hasCoverSource) {
      console.log("cover-source.jpg が無いため表紙をスキップしました。");
      continue;
    }
    await regenerateSlide(draftId, slide, manifest.eyebrow, manifest.slides.length);
    console.log(`slide ${slide.order} を描画しました。`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
