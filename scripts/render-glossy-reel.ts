import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildGlossyTimeline, type GlossyReelProps } from "../remotion/glossyTiming";

/**
 * Renders a hand-written GlossyReel: reels/<REEL_ID>/props.json + reels/<REEL_ID>/assets/
 * (backgrounds, optional BGM) → reels/<REEL_ID>/reel.mp4 plus one still per scene.
 */
async function main() {
  const reelId = process.env.REEL_ID?.trim();
  if (!reelId) throw new Error("REEL_ID を指定してください。");
  const reelDir = path.join(process.cwd(), "reels", reelId);
  const inputProps = JSON.parse(await readFile(path.join(reelDir, "props.json"), "utf8")) as GlossyReelProps;

  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "remotion", "index.ts"), publicDir: path.join(reelDir, "assets") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const composition = await selectComposition({ serveUrl, id: "GlossyReel", inputProps, browserExecutable });

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    crf: 20,
    outputLocation: path.join(reelDir, "reel.mp4"),
    browserExecutable,
  });

  const timeline = buildGlossyTimeline(inputProps);
  const slots = [timeline.hook, ...timeline.scenes, timeline.closing];
  for (const [index, slot] of slots.entries()) {
    const frame = slot.from + Math.min(slot.durationInFrames - 10, 60);
    await renderStill({ serveUrl, composition, inputProps, frame, output: path.join(reelDir, `still-${String(index).padStart(2, "0")}.jpg`), imageFormat: "jpeg", jpegQuality: 88, browserExecutable });
  }
  console.log(`reels/${reelId}/reel.mp4 を書き出しました（${(composition.durationInFrames / composition.fps).toFixed(1)}秒）。`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
