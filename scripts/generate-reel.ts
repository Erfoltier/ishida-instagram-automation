import { writeFile } from "node:fs/promises";
import path from "node:path";
import { REEL_THEME_CATALOG, selectScheduledTheme, getThemeSourceUrls } from "../src/content/themes";
import { fetchOfficialSourceText } from "../src/content/officialSource";
import { createReelScript } from "../src/content/reelScript";
import { renderReel } from "../src/render/renderReel";
import { readPostHistory, REEL_HISTORY_PATH } from "../src/state/history";
import { listOpenDraftArticleIds, REEL_APPROVAL_LABEL } from "../src/approval/issue";

async function main() {
  const requestedSubject = process.env.THEME_SUBJECT?.trim();
  let theme;
  if (requestedSubject) {
    theme = REEL_THEME_CATALOG.find(entry => entry.subject === requestedSubject || entry.articleId === requestedSubject);
    if (!theme) throw new Error(`指定されたテーマ「${requestedSubject}」がリール対象の記事に見つかりません（症例記事はリール対象外です）。`);
    console.log(`指定テーマ: ${theme.subject}`);
  } else {
    const [history, pendingArticleIds] = await Promise.all([readPostHistory(REEL_HISTORY_PATH), listOpenDraftArticleIds(REEL_APPROVAL_LABEL)]);
    theme = selectScheduledTheme(history, pendingArticleIds, REEL_THEME_CATALOG);
    if (pendingArticleIds.has(theme.articleId)) {
      throw new Error(
        `次の記事「${theme.subject}」(${theme.articleId}) はまだ承認待ちのリールIssueがあります。承認またはクローズしてから再実行してください。`
      );
    }
    console.log(`自動選定テーマ: ${theme.subject}`);
  }

  const sourceUrls = getThemeSourceUrls(theme);
  const sourceText = await fetchOfficialSourceText(sourceUrls);
  console.log(`参照ページ: ${sourceUrls.join(", ")}`);

  const script = await createReelScript(theme, sourceText);
  console.log(`台本を生成しました（ポイント${script.scenes.length}個）。`);

  const reelId = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
  const reelDir = path.join(process.cwd(), "reels", reelId);
  const rendered = await renderReel(reelId, script, reelDir);
  console.log(`動画を書き出しました（${rendered.durationSeconds}秒、BGM: ${rendered.bgmFileName ?? "なし"}）。`);

  const manifest = {
    reelId,
    articleId: theme.articleId,
    subject: theme.subject,
    eyebrow: script.eyebrow,
    hook: script.hook,
    scenes: script.scenes,
    closing: script.closing,
    caption: script.caption,
    hashtags: script.hashtags,
    complianceNotes: script.complianceNotes,
    sourceUrls,
    ...rendered,
  };
  await writeFile(path.join(reelDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`リール案を生成しました: reels/${reelId}/`);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `reel_id=${reelId}\n`, { flag: "a" });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
