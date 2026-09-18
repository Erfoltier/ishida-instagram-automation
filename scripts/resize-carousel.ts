import { readFile, writeFile, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { fetchOfficialSourceText } from "../src/content/officialSource";
import { generateSingleSlideCopy } from "../src/content/draftGeneration";
import { factInstructionForContentSlide, type CarouselSlideKind } from "../src/content/carouselPlan";
import { regenerateSlide } from "../src/render/renderSlides";

type ManifestSlide = { order: number; kind: CarouselSlideKind; title: string; body: string; fileName: string };
type Manifest = {
  draftId: string;
  subject: string;
  eyebrow: string;
  sourceUrls: string[];
  slides: ManifestSlide[];
  [key: string]: unknown;
};

const MIN_TOTAL_SLIDES = 5;
const MAX_TOTAL_SLIDES = 10;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required.`);
  return value;
}

function fileNameFor(order: number) {
  return `slide-${String(order).padStart(2, "0")}.jpg`;
}

async function main() {
  const draftId = requireEnv("DRAFT_ID");
  const action = requireEnv("ACTION"); // "add" | "remove"
  // Only meaningful for "remove" (which content slide's order to delete). "add" always
  // appends a new content slide right before the CTA — POSITION is required by the
  // workflow input schema but ignored in that branch.
  const position = Number(requireEnv("POSITION"));

  const draftDir = path.join(process.cwd(), "drafts", draftId);
  const manifestPath = path.join(draftDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const oldFileNames = new Set(manifest.slides.map(slide => slide.fileName));

  const contentSlides = manifest.slides.filter(slide => slide.kind !== "cover" && slide.kind !== "cta").sort((a, b) => a.order - b.order);
  const coverSlide = manifest.slides.find(slide => slide.kind === "cover");
  const ctaSlide = manifest.slides.find(slide => slide.kind === "cta");
  if (!coverSlide || !ctaSlide) throw new Error("表紙または最終ページがmanifestに見つかりません。");

  if (action === "remove") {
    if (manifest.slides.length <= MIN_TOTAL_SLIDES) {
      throw new Error(`これ以上削除できません（最低${MIN_TOTAL_SLIDES}枚必要です）。`);
    }
    const index = contentSlides.findIndex(slide => slide.order === position);
    if (index === -1) throw new Error(`order=${position}の編集可能なページが見つかりません（表紙・最終ページは削除できません）。`);
    contentSlides.splice(index, 1);
  } else if (action === "add") {
    if (manifest.slides.length >= MAX_TOTAL_SLIDES) {
      throw new Error(`これ以上追加できません（Instagramの上限は${MAX_TOTAL_SLIDES}枚です）。`);
    }
    const sourceText = await fetchOfficialSourceText(manifest.sourceUrls);
    const { kind, factInstruction } = factInstructionForContentSlide(contentSlides.length);
    const { title, body } = await generateSingleSlideCopy(manifest.subject, sourceText, kind, factInstruction);
    contentSlides.push({ order: 0, kind, title, body, fileName: "" }); // order/fileName reassigned below
  } else {
    throw new Error(`不明なaction: ${action}`);
  }

  // Renumber everything sequentially: cover=1, content=2..N-1, cta=N.
  const total = contentSlides.length + 2;
  coverSlide.order = 1;
  coverSlide.fileName = fileNameFor(1);
  contentSlides.forEach((slide, index) => {
    slide.order = index + 2;
    slide.fileName = fileNameFor(index + 2);
  });
  ctaSlide.order = total;
  ctaSlide.fileName = fileNameFor(total);
  manifest.slides = [coverSlide, ...contentSlides, ctaSlide];

  // Re-render every slide so page counters ("03/07" etc.) stay correct across the whole set.
  // Cheap: no LLM/image-generation calls, just SVG+sharp compositing from stored text/photo.
  for (const slide of manifest.slides) {
    await regenerateSlide(draftId, slide, manifest.eyebrow, total);
  }

  // Clean up files left over from the old numbering (e.g. a removed slide's old file).
  const newFileNames = new Set(manifest.slides.map(slide => slide.fileName));
  for (const oldName of oldFileNames) {
    if (!newFileNames.has(oldName)) {
      await unlink(path.join(draftDir, oldName)).catch(() => {});
    }
  }
  // Also sweep any stray slide-*.jpg not accounted for (defensive; renumbering can leave gaps).
  const existingFiles = await readdir(draftDir);
  for (const file of existingFiles) {
    if (/^slide-\d+\.jpg$/.test(file) && !newFileNames.has(file)) {
      await unlink(path.join(draftDir, file)).catch(() => {});
    }
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`${action === "add" ? "追加" : "削除"}しました。現在${total}枚構成です。`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
