import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSlideText } from "../src/content/draftGeneration";
import { regenerateSlide } from "../src/render/renderSlides";

type ManifestSlide = { order: number; kind: string; title: string; body: string; fileName: string };
type Manifest = { draftId: string; eyebrow: string; slides: ManifestSlide[] };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required.`);
  return value;
}

async function main() {
  // Read from env vars, not argv: this is ultimately staff-edited free text relayed
  // through the Worker, so avoid any shell-interpolation surface (same reasoning as
  // publish-approved.ts).
  const draftId = requireEnv("DRAFT_ID");
  const order = Number(requireEnv("SLIDE_ORDER"));
  const title = requireEnv("SLIDE_TITLE");
  const body = requireEnv("SLIDE_BODY");

  validateSlideText(title, body);

  const manifestPath = path.join(process.cwd(), "drafts", draftId, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const slide = manifest.slides.find(item => item.order === order);
  if (!slide) throw new Error(`draft ${draftId} にorder=${order}のスライドが見つかりません。`);
  if (slide.kind === "cta") throw new Error("最終ページ（CTA）の文言は固定のため編集できません。");

  slide.title = title;
  slide.body = body;

  await regenerateSlide(draftId, { order: slide.order, kind: slide.kind as never, title, body }, manifest.eyebrow);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`再生成しました: drafts/${draftId}/${slide.fileName}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
