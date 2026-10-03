import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { BOOKING_BLOCK, CLINIC_INFO_BLOCK } from "../content/draftGeneration";
import type { ReelScript } from "../content/reelScript";
import { buildReelTimeline, type ReelProps } from "../../remotion/timing";
import { coverPhotoProvider } from "./coverImage";
import { pickAccentColor } from "./svg";
import { pickTexturePhoto } from "./texturePhotoLibrary";

const BGM_LIBRARY_ROOT = path.join(process.cwd(), "assets", "bgm");
const COMPOSITION_ID = "Reel";
export const REEL_VIDEO_FILE_NAME = "reel.mp4";
export const REEL_COVER_FILE_NAME = "cover.jpg";
const COVER_SOURCE_FILE_NAME = "cover-source.jpg";

export type RenderedReel = {
  videoFileName: string;
  coverFileName: string;
  /** One still per point scene, for the approval Issue (GitHub can't inline-play a raw mp4 URL). */
  sceneStillFileNames: string[];
  bgmFileName: string | null;
  durationSeconds: number;
};

function seededPick<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items[hash % items.length]!;
}

/** Royalty-free tracks staff upload to assets/bgm/ (see its README). Deterministic per reel. */
export async function pickBgm(seed: string): Promise<string | null> {
  try {
    const files = (await readdir(BGM_LIBRARY_ROOT)).filter(file => /\.(mp3|m4a|aac|wav)$/i.test(file)).sort();
    const picked = seededPick(files, seed);
    return picked ? path.join(BGM_LIBRARY_ROOT, picked) : null;
  } catch {
    return null;
  }
}

/** The booking line without the URL/DM notice — a URL isn't tappable inside a video. */
export function bookingNoteFromBlock(): string {
  return BOOKING_BLOCK.split("\n")[0]!.replace(/承っています。$/, "");
}

/**
 * Renders reels/<reelId>/reel.mp4 (+ cover.jpg and one still per point scene)
 * with Remotion. Assets are copied into a throwaway public dir so the bundle only
 * ever contains this reel's files, not the whole repo.
 */
export async function renderReel(reelId: string, script: ReelScript, outputDir: string): Promise<RenderedReel> {
  await mkdir(outputDir, { recursive: true });
  const publicDir = await mkdtemp(path.join(os.tmpdir(), `reel-${reelId}-`));
  try {
    // Same AI cover photo provider as the carousel. Kept next to the video so a
    // later re-render doesn't need (or pay for) another generation.
    const coverPhoto = await coverPhotoProvider.getCoverPhoto(script.imageSearchQuery);
    await writeFile(path.join(outputDir, COVER_SOURCE_FILE_NAME), coverPhoto);
    await sharp(coverPhoto).jpeg({ quality: 92 }).toFile(path.join(publicDir, "hook.jpg"));

    // Different crop per scene comes from the template; one photo per scene keeps
    // the visual consistent with the carousel's photo pages.
    const scenes: ReelProps["scenes"] = [];
    for (const [index, scene] of script.scenes.entries()) {
      const texturePath = await pickTexturePhoto(script.eyebrow, `${reelId}-${index}`);
      let photo: string | null = null;
      if (texturePath) {
        photo = `scene-${index + 1}${path.extname(texturePath).toLowerCase()}`;
        await copyFile(texturePath, path.join(publicDir, photo));
      }
      scenes.push({ heading: scene.heading, body: scene.body, photo });
    }

    const bgmPath = await pickBgm(reelId);
    let bgm: string | null = null;
    if (bgmPath) {
      bgm = `bgm${path.extname(bgmPath).toLowerCase()}`;
      await copyFile(bgmPath, path.join(publicDir, bgm));
    }

    const inputProps: ReelProps = {
      eyebrow: script.eyebrow,
      accentColor: pickAccentColor(reelId),
      hook: script.hook,
      hookPhoto: "hook.jpg",
      scenes,
      closing: script.closing,
      clinicInfo: CLINIC_INFO_BLOCK.split("\n"),
      bookingNote: bookingNoteFromBlock(),
      bgm,
    };

    return await renderPreparedReel(inputProps, publicDir, outputDir, bgmPath);
  } finally {
    await rm(publicDir, { recursive: true, force: true });
  }
}

/**
 * Bundles the Remotion project against `publicDir` (which must already hold every
 * file `inputProps` references) and writes reel.mp4, cover.jpg and the scene stills.
 */
export async function renderPreparedReel(inputProps: ReelProps, publicDir: string, outputDir: string, bgmPath: string | null): Promise<RenderedReel> {
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "remotion", "index.ts"), publicDir });
  // Local sandboxes may already have a Chromium; on GitHub Actions leave this
  // unset and Remotion downloads its own headless shell.
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });

  const videoPath = path.join(outputDir, REEL_VIDEO_FILE_NAME);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    audioCodec: "aac",
    // Instagram Reels spec: H.264 + AAC, yuv420p, 9:16.
    pixelFormat: "yuv420p",
    crf: 20,
    outputLocation: videoPath,
    browserExecutable,
  });

  // Stills are taken once the scene's entrance animation has settled.
  const timeline = buildReelTimeline(inputProps);
  const settle = (slot: { from: number; durationInFrames: number }) => slot.from + Math.min(slot.durationInFrames - 10, 45);
  await renderStill({ serveUrl, composition, inputProps, frame: settle(timeline.hook), output: path.join(outputDir, REEL_COVER_FILE_NAME), imageFormat: "jpeg", jpegQuality: 90, browserExecutable });
  const sceneStillFileNames: string[] = [];
  for (const [index, slot] of timeline.scenes.entries()) {
    const fileName = `scene-${String(index + 1).padStart(2, "0")}.jpg`;
    await renderStill({ serveUrl, composition, inputProps, frame: settle(slot), output: path.join(outputDir, fileName), imageFormat: "jpeg", jpegQuality: 85, browserExecutable });
    sceneStillFileNames.push(fileName);
  }
  const closingStill = "scene-closing.jpg";
  await renderStill({ serveUrl, composition, inputProps, frame: settle(timeline.closing), output: path.join(outputDir, closingStill), imageFormat: "jpeg", jpegQuality: 85, browserExecutable });
  sceneStillFileNames.push(closingStill);

  return {
    videoFileName: REEL_VIDEO_FILE_NAME,
    coverFileName: REEL_COVER_FILE_NAME,
    sceneStillFileNames,
    bgmFileName: bgmPath ? path.basename(bgmPath) : null,
    durationSeconds: Math.round((composition.durationInFrames / composition.fps) * 10) / 10,
  };
}
