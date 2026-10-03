import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CLINIC_INFO_BLOCK, assertNoBannedPatterns } from "../src/content/draftGeneration";
import { REEL_TEXT_LIMITS } from "../src/content/reelScript";
import { bookingNoteFromBlock, pickBgm, renderPreparedReel } from "../src/render/renderReel";
import type { ReelProps } from "../remotion/timing";

/**
 * Renders a reel from a hand-written script instead of the Claude-generated one:
 *   tsx scripts/render-manual-reel.ts <reelId>
 * reads reels/<reelId>/script.json (photo paths relative to that folder) and the
 * caption from `captionFile` (the 【キャプション】 section of a manuscript; its last
 * line is the hashtags), then writes reel.mp4 / stills / manifest.json next to it
 * in the same shape scripts/create-reel-issue.ts expects.
 */
type ManualReelScript = {
  articleId: string;
  subject: string;
  eyebrow: string;
  accentColor: string;
  hook: string;
  hookPhoto: string | null;
  scenes: Array<{ heading: string; body: string; photo: string | null }>;
  closing: string;
  captionFile: string;
  complianceNotes: string;
};

function validate(script: ManualReelScript) {
  const problems: string[] = [];
  if (script.hook.length > REEL_TEXT_LIMITS.hook) problems.push(`hookが${REEL_TEXT_LIMITS.hook}文字を超えています`);
  if (script.closing.length > REEL_TEXT_LIMITS.closing) problems.push(`closingが${REEL_TEXT_LIMITS.closing}文字を超えています`);
  if (script.scenes.length < 1 || script.scenes.length > 5) problems.push("scenesは1〜5個");
  script.scenes.forEach((scene, index) => {
    if (scene.heading.length > REEL_TEXT_LIMITS.heading) problems.push(`${index + 1}番目のheadingが${REEL_TEXT_LIMITS.heading}文字を超えています`);
    if (scene.body.length > REEL_TEXT_LIMITS.body) problems.push(`${index + 1}番目のbodyが${REEL_TEXT_LIMITS.body}文字を超えています`);
  });
  if (problems.length > 0) throw new Error(`台本の修正が必要です: ${problems.join(" / ")}`);
  assertNoBannedPatterns([script.hook, ...script.scenes.flatMap(scene => [scene.heading, scene.body]), script.closing].join("\n"));
}

async function readCaption(captionFile: string): Promise<{ caption: string; hashtags: string[] }> {
  const text = await readFile(path.join(process.cwd(), captionFile), "utf8");
  const marker = "【キャプション】";
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${captionFile} に「${marker}」の見出しがありません。`);
  const lines = text.slice(start + marker.length).trim().split("\n");
  const last = lines.at(-1)?.trim() ?? "";
  const hashtags = last.startsWith("#") ? last.split(/\s+/).filter(Boolean) : [];
  const caption = (hashtags.length > 0 ? lines.slice(0, -1) : lines).join("\n").trim();
  return { caption, hashtags };
}

async function main() {
  const reelId = process.argv[2];
  if (!reelId) throw new Error("使い方: tsx scripts/render-manual-reel.ts <reelId>");
  const reelDir = path.join(process.cwd(), "reels", reelId);
  const script = JSON.parse(await readFile(path.join(reelDir, "script.json"), "utf8")) as ManualReelScript;
  validate(script);
  const { caption, hashtags } = await readCaption(script.captionFile);

  const publicDir = await mkdtemp(path.join(os.tmpdir(), `reel-${reelId}-`));
  try {
    const stage = async (relativePath: string | null, name: string) => {
      if (!relativePath) return null;
      const fileName = `${name}${path.extname(relativePath).toLowerCase()}`;
      await copyFile(path.join(reelDir, relativePath), path.join(publicDir, fileName));
      return fileName;
    };
    const hookPhoto = await stage(script.hookPhoto, "hook");
    const scenes: ReelProps["scenes"] = [];
    for (const [index, scene] of script.scenes.entries()) {
      scenes.push({ heading: scene.heading, body: scene.body, photo: await stage(scene.photo, `scene-${index + 1}`) });
    }
    const bgmPath = await pickBgm(reelId);
    const bgm = bgmPath ? `bgm${path.extname(bgmPath).toLowerCase()}` : null;
    if (bgmPath && bgm) await copyFile(bgmPath, path.join(publicDir, bgm));

    const inputProps: ReelProps = {
      eyebrow: script.eyebrow,
      accentColor: script.accentColor,
      hook: script.hook,
      hookPhoto,
      scenes,
      closing: script.closing,
      clinicInfo: CLINIC_INFO_BLOCK.split("\n"),
      bookingNote: bookingNoteFromBlock(),
      bgm,
    };
    const rendered = await renderPreparedReel(inputProps, publicDir, reelDir, bgmPath);
    console.log(`動画を書き出しました（${rendered.durationSeconds}秒、BGM: ${rendered.bgmFileName ?? "なし"}）。`);

    const manifest = {
      reelId,
      articleId: script.articleId,
      subject: script.subject,
      eyebrow: script.eyebrow,
      hook: script.hook,
      scenes: script.scenes.map(({ heading, body }) => ({ heading, body })),
      closing: script.closing,
      caption,
      hashtags,
      complianceNotes: script.complianceNotes,
      sourceUrls: [],
      ...rendered,
    };
    await writeFile(path.join(reelDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`リール案を書き出しました: reels/${reelId}/`);
  } finally {
    await rm(publicDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
