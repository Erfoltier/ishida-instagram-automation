import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectScheduledTheme, getThemeSourceUrls } from "../src/content/themes";
import { fetchOfficialSourceText } from "../src/content/officialSource";
import { createPostCopy, createCarouselSlideCopy } from "../src/content/draftGeneration";
import { estimateSlideCount, buildCarouselSlidePlan } from "../src/content/carouselPlan";
import { renderCarouselSlides } from "../src/render/renderSlides";
import { readPostHistory } from "../src/state/history";

async function main() {
  const history = await readPostHistory();
  const theme = selectScheduledTheme(history);
  console.log(`選定テーマ: ${theme.subject}`);

  const sourceUrls = getThemeSourceUrls(theme);
  const sourceText = await fetchOfficialSourceText(sourceUrls);
  console.log(`参照ページ: ${sourceUrls.join(", ")}`);

  const draft = await createPostCopy(theme, sourceText);
  const slideCount = estimateSlideCount(draft.primarySubject, sourceText);
  console.log(`参照テキストの分量から${slideCount}枚構成を選定しました。`);
  const plan = buildCarouselSlidePlan(slideCount);
  const slides = await createCarouselSlideCopy(draft, plan, sourceText);

  const draftId = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
  const rendered = await renderCarouselSlides(draftId, draft, slides);

  const manifest = {
    draftId,
    subject: theme.subject,
    eyebrow: draft.eyebrow,
    caption: draft.caption,
    hashtags: draft.hashtags,
    complianceNotes: draft.complianceNotes,
    sourceUrls,
    slides: rendered.map(slide => ({ order: slide.order, kind: slide.kind, title: slide.title, body: slide.body, fileName: slide.fileName })),
  };

  const draftDir = path.join(process.cwd(), "drafts", draftId);
  await mkdir(draftDir, { recursive: true });
  await writeFile(path.join(draftDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`草案を生成しました: drafts/${draftId}/`);
  // GitHub Actions: expose draftId to later steps.
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `draft_id=${draftId}\n`, { flag: "a" });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
