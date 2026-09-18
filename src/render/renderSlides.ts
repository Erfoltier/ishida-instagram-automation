import sharp from "sharp";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedDraft, GeneratedCarouselSlide } from "../content/draftGeneration";
import { buildLayoutSvg, buildCarouselInformationSvg, buildPhotoOverlaySvg } from "./svg";
import { coverPhotoProvider } from "./coverImage";
import { pickTexturePhoto } from "./texturePhotoLibrary";

export type RenderedSlide = {
  order: number;
  kind: GeneratedCarouselSlide["kind"];
  title: string;
  body: string;
  filePath: string;
  fileName: string;
};

const COVER_SOURCE_FILE_NAME = "cover-source.jpg";

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

/** Composites a (possibly cached) photo with the headline/subheadline overlay. No network call. */
async function compositeCoverSlide(photo: Buffer, eyebrow: string, title: string, body: string): Promise<Buffer> {
  const composited = await sharp(photo)
    .resize(1080, 1080, { fit: "cover", position: "right" })
    .composite([{ input: Buffer.from(buildLayoutSvg({ eyebrow, headline: title, subheadline: body })), top: 0, left: 0 }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  await validateBrandTemplate(composited);
  return composited;
}

const CROP_GRAVITIES = ["north", "centre", "south", "east", "west"] as const;

// The region the title/body text actually occupies (see buildPhotoOverlaySvg's
// fixed layout) — sampled on the CROPPED photo, before the gradient is applied,
// to decide whether that gradient needs to be stronger than the default.
const TEXT_ZONE = { left: 90, top: 420, width: 900, height: 560 };
const BRIGHT_LUMINANCE_THRESHOLD = 130; // 0-255 scale

async function isTextZoneBright(croppedPhoto: Buffer): Promise<boolean> {
  const { channels } = await sharp(croppedPhoto).extract(TEXT_ZONE).stats();
  const [r, g, b] = channels;
  const luminance = 0.299 * (r?.mean ?? 0) + 0.587 * (g?.mean ?? 0) + 0.114 * (b?.mean ?? 0);
  return luminance > BRIGHT_LUMINANCE_THRESHOLD;
}

/** Composites the same texture photo (different crop per page) with the gradient+text overlay. No brand-color validation — the background is a photo, not the flat template. */
async function renderPhotoInformationSlide(photoPath: string, slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number): Promise<Buffer> {
  const photo = await readFile(photoPath);
  const gravity = CROP_GRAVITIES[slide.order % CROP_GRAVITIES.length];
  const croppedPhoto = await sharp(photo).resize(1080, 1080, { fit: "cover", position: gravity }).jpeg().toBuffer();
  const needsStrongScrim = await isTextZoneBright(croppedPhoto);
  const rendered = await sharp(croppedPhoto)
    .composite([{ input: Buffer.from(buildPhotoOverlaySvg(slide, eyebrow, totalSlides, needsStrongScrim)), top: 0, left: 0 }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const { info } = await sharp(rendered).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1080 || info.height !== 1080) throw new Error("画像のサイズが基準外です。");
  return rendered;
}

/** Flat-design fallback (no photo available for this theme's category yet) — icon badge + boxed text. */
async function renderFlatInformationSlide(slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number): Promise<Buffer> {
  const rendered = await sharp(Buffer.from(buildCarouselInformationSvg(slide, eyebrow, totalSlides)))
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  await validateBrandTemplate(rendered);
  return rendered;
}

async function renderInformationSlide(draftId: string, slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number): Promise<Buffer> {
  const photoPath = await pickTexturePhoto(eyebrow, draftId);
  return photoPath
    ? renderPhotoInformationSlide(photoPath, slide, eyebrow, totalSlides)
    : renderFlatInformationSlide(slide, eyebrow, totalSlides);
}

function draftDirFor(draftId: string) {
  return path.join(process.cwd(), "drafts", draftId);
}

/** Renders all slides and writes them under drafts/<draftId>/. The caller (generate-draft.ts) commits this folder. */
export async function renderCarouselSlides(draftId: string, draft: GeneratedDraft, slides: GeneratedCarouselSlide[]): Promise<RenderedSlide[]> {
  const draftDir = draftDirFor(draftId);
  await mkdir(draftDir, { recursive: true });

  // Fetch the AI cover photo once and keep the untouched source around, so a later
  // text-only edit (see regenerateSlide below) can recomposite without another
  // OpenAI call — that would cost money and silently swap the photo staff already liked.
  let coverPhoto: Buffer | undefined;

  const rendered: RenderedSlide[] = [];
  for (const slide of slides) {
    let buffer: Buffer;
    if (slide.kind === "cover") {
      coverPhoto ??= await coverPhotoProvider.getCoverPhoto(draft.imageSearchQuery);
      await writeFile(path.join(draftDir, COVER_SOURCE_FILE_NAME), coverPhoto);
      buffer = await compositeCoverSlide(coverPhoto, draft.eyebrow, slide.title, slide.body);
    } else {
      buffer = await renderInformationSlide(draftId, slide, draft.eyebrow, slides.length);
    }
    const fileName = `slide-${String(slide.order).padStart(2, "0")}.jpg`;
    const filePath = path.join(draftDir, fileName);
    await writeFile(filePath, buffer);
    rendered.push({ order: slide.order, kind: slide.kind, title: slide.title, body: slide.body, filePath, fileName });
  }
  return rendered;
}

/**
 * Re-renders ONE slide with edited title/body (staff web UI "edit" action). For the
 * cover slide this reuses the saved source photo instead of generating a new one.
 * Overwrites the existing slide file in place; caller commits the change.
 */
export async function regenerateSlide(
  draftId: string,
  slide: Pick<GeneratedCarouselSlide, "order" | "kind" | "title" | "body">,
  eyebrow: string,
  totalSlides: number
): Promise<void> {
  const draftDir = draftDirFor(draftId);
  const buffer = slide.kind === "cover"
    ? await compositeCoverSlide(await readFile(path.join(draftDir, COVER_SOURCE_FILE_NAME)), eyebrow, slide.title, slide.body)
    : await renderInformationSlide(draftId, slide as GeneratedCarouselSlide, eyebrow, totalSlides);
  const fileName = `slide-${String(slide.order).padStart(2, "0")}.jpg`;
  await writeFile(path.join(draftDir, fileName), buffer);
}
