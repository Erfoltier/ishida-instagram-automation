import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedDraft, GeneratedCarouselSlide } from "../content/draftGeneration";
import { buildLayoutSvg, buildCarouselInformationSvg } from "./svg";
import { coverPhotoProvider } from "./coverImage";

export type RenderedSlide = {
  order: number;
  kind: GeneratedCarouselSlide["kind"];
  title: string;
  body: string;
  filePath: string;
  fileName: string;
};

function pixelAt(data: Buffer, x: number, y: number) {
  const offset = (y * 1080 + x) * 3;
  return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0] as const;
}

function isNearColor(actual: readonly number[], expected: readonly number[], tolerance: number) {
  return actual.every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= tolerance);
}

async function validateBrandTemplate(image: Buffer) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1080 || info.height !== 1080 || info.channels !== 3) {
    throw new Error("画像のサイズまたはカラーチャンネルが基準外です。");
  }
  const hasGoldRule = isNearColor(pixelAt(data, 75, 500), [184, 160, 96], 16);
  const hasTealRule = isNearColor(pixelAt(data, 100, 102), [61, 98, 112], 16);
  const hasIvoryPanel = isNearColor(pixelAt(data, 240, 760), [251, 250, 246], 16);
  if (!hasGoldRule || !hasTealRule || !hasIvoryPanel) {
    throw new Error("固定デザインの品質基準（ゴールドライン・チークライン・アイボリーパネル）を満たしていません。");
  }
}

async function renderCoverSlide(draft: GeneratedDraft, slide: Pick<GeneratedCarouselSlide, "title" | "body">): Promise<Buffer> {
  const photo = await coverPhotoProvider.getCoverPhoto(draft.imageSearchQuery);
  const composited = await sharp(photo)
    .resize(1080, 1080, { fit: "cover", position: "right" })
    .composite([{ input: Buffer.from(buildLayoutSvg({ eyebrow: draft.eyebrow, headline: slide.title, subheadline: slide.body })), top: 0, left: 0 }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  await validateBrandTemplate(composited);
  return composited;
}

async function renderInformationSlide(slide: GeneratedCarouselSlide, eyebrow: string): Promise<Buffer> {
  const rendered = await sharp(Buffer.from(buildCarouselInformationSvg(slide, eyebrow)))
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  await validateBrandTemplate(rendered);
  return rendered;
}

/** Renders all slides and writes them under drafts/<draftId>/. The caller (generate-draft.ts) commits this folder. */
export async function renderCarouselSlides(draftId: string, draft: GeneratedDraft, slides: GeneratedCarouselSlide[]): Promise<RenderedSlide[]> {
  const draftDir = path.join(process.cwd(), "drafts", draftId);
  await mkdir(draftDir, { recursive: true });

  const rendered: RenderedSlide[] = [];
  for (const slide of slides) {
    const buffer = slide.kind === "cover"
      ? await renderCoverSlide(draft, slide)
      : await renderInformationSlide(slide, draft.eyebrow);
    const fileName = `slide-${String(slide.order).padStart(2, "0")}.jpg`;
    const filePath = path.join(draftDir, fileName);
    await writeFile(filePath, buffer);
    rendered.push({ order: slide.order, kind: slide.kind, title: slide.title, body: slide.body, filePath, fileName });
  }
  return rendered;
}
