import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderPreparedReel } from "../src/render/renderReel";
import { carouselTimeline, type CarouselReelProps } from "../remotion/carouselTiming";

/**
 * Renders reels/<reelId>/layers (from scripts/carousel-reel/prepare.py) with the
 * CarouselReel composition — a silent reel that animates a finished carousel:
 *   tsx scripts/render-carousel-reel.ts <reelId> [captionFile]
 * captionFile (optional) is a manuscript whose 【キャプション】 section becomes
 * the manifest caption; its last line is the hashtags.
 */
async function readCaption(captionFile: string | undefined) {
  if (!captionFile) return { caption: "", hashtags: [] as string[] };
  const text = await readFile(path.join(process.cwd(), captionFile), "utf8");
  const start = text.indexOf("【キャプション】");
  const lines = (start >= 0 ? text.slice(start + "【キャプション】".length) : text).trim().split("\n");
  const last = lines.at(-1)?.trim() ?? "";
  const hashtags = last.startsWith("#") ? last.split(/\s+/).filter(Boolean) : [];
  return { caption: (hashtags.length > 0 ? lines.slice(0, -1) : lines).join("\n").trim(), hashtags };
}

async function main() {
  const [reelId, captionFile] = process.argv.slice(2);
  if (!reelId) throw new Error("使い方: tsx scripts/render-carousel-reel.ts <reelId> [captionFile]");
  const reelDir = path.join(process.cwd(), "reels", reelId);
  const layersDir = path.join(reelDir, "layers");
  const inputProps = JSON.parse(await readFile(path.join(layersDir, "layers.json"), "utf8")) as CarouselReelProps;

  const publicDir = await mkdtemp(path.join(os.tmpdir(), `reel-${reelId}-`));
  try {
    for (const file of await readdir(layersDir)) {
      if (file.endsWith(".png")) await copyFile(path.join(layersDir, file), path.join(publicDir, file));
    }
    const { slots } = carouselTimeline(inputProps);
    const rendered = await renderPreparedReel({
      compositionId: "CarouselReel",
      inputProps,
      stillFrames: { hook: slots[0]!, scenes: slots.slice(1, -1), closing: slots.at(-1)! },
      publicDir,
      outputDir: reelDir,
      bgmPath: null,
    });
    console.log(`動画を書き出しました（${rendered.durationSeconds}秒、無音）。`);
    const { caption, hashtags } = await readCaption(captionFile);
    const manifest = {
      reelId,
      articleId: `MANUAL-${reelId}`,
      subject: "カルーセル画像から作成したリール",
      template: "carousel",
      hook: "",
      scenes: inputProps.slides.map((slide, i) => ({ heading: `スライド${i + 1}`, body: `${slide.layers.length}ブロックの文字を順に表示` })),
      closing: "",
      caption,
      hashtags,
      complianceNotes: "カルーセル画像（院内で作成・確認済み）の文字を順に表示するだけで、文言は変更していない。",
      sourceUrls: [],
      ...rendered,
    };
    await writeFile(path.join(reelDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  } finally {
    await rm(publicDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
