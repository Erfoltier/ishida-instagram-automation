const API_VERSION = "v26.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function graphFetch(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const body = (await response.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Graph API呼び出しに失敗しました (${response.status})`);
  return body;
}

export async function publishCarouselPost(input: { imageUrls: string[]; caption: string }): Promise<{ mediaId: string; containerId: string }> {
  if (input.imageUrls.length < 2 || input.imageUrls.length > 10) {
    throw new Error("カルーセルは2〜10枚の画像で作成してください。");
  }
  const accessToken = requireEnv("META_IG_ACCESS_TOKEN");
  const accountId = requireEnv("META_IG_PROFESSIONAL_ACCOUNT_ID");
  const createMediaUrl = `https://graph.instagram.com/${API_VERSION}/${accountId}/media`;

  const childContainerIds: string[] = [];
  for (const imageUrl of input.imageUrls) {
    const body = await graphFetch(createMediaUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, is_ai_generated: true }),
    });
    const id = body.id as string | undefined;
    if (!id) throw new Error("カルーセル子コンテナの作成に失敗しました。");
    childContainerIds.push(id);
  }

  const parentBody = await graphFetch(createMediaUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", children: childContainerIds, caption: input.caption, is_ai_generated: true }),
  });
  const containerId = parentBody.id as string | undefined;
  if (!containerId) throw new Error("カルーセル親コンテナの作成に失敗しました。");

  const publishBody = await graphFetch(`https://graph.instagram.com/${API_VERSION}/${accountId}/media_publish`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ creation_id: containerId }),
  });
  const mediaId = publishBody.id as string | undefined;
  if (!mediaId) throw new Error("カルーセル公開に失敗しました。");

  return { mediaId, containerId };
}

const REEL_STATUS_POLL_INTERVAL_MS = 10_000;
const REEL_STATUS_TIMEOUT_MS = 10 * 60_000;

/**
 * Reels are processed asynchronously on Meta's side: the container must reach
 * status_code FINISHED before media_publish accepts it.
 */
async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + REEL_STATUS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const body = await graphFetch(`https://graph.instagram.com/${API_VERSION}/${containerId}?fields=status_code,status`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const statusCode = body.status_code as string | undefined;
    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`リール動画の処理に失敗しました (${statusCode}): ${String(body.status ?? "")}`);
    }
    await new Promise(resolve => setTimeout(resolve, REEL_STATUS_POLL_INTERVAL_MS));
  }
  throw new Error("リール動画の処理が時間内に完了しませんでした。");
}

export async function publishReelPost(input: { videoUrl: string; coverUrl: string; caption: string }): Promise<{ mediaId: string; containerId: string }> {
  const accessToken = requireEnv("META_IG_ACCESS_TOKEN");
  const accountId = requireEnv("META_IG_PROFESSIONAL_ACCOUNT_ID");

  const containerBody = await graphFetch(`https://graph.instagram.com/${API_VERSION}/${accountId}/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: input.videoUrl,
      cover_url: input.coverUrl,
      caption: input.caption,
      share_to_feed: true,
      is_ai_generated: true,
    }),
  });
  const containerId = containerBody.id as string | undefined;
  if (!containerId) throw new Error("リールコンテナの作成に失敗しました。");

  await waitForContainerReady(containerId, accessToken);

  const publishBody = await graphFetch(`https://graph.instagram.com/${API_VERSION}/${accountId}/media_publish`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ creation_id: containerId }),
  });
  const mediaId = publishBody.id as string | undefined;
  if (!mediaId) throw new Error("リール公開に失敗しました。");

  return { mediaId, containerId };
}

/**
 * Meta requires image_url to be a URL their servers can fetch unauthenticated —
 * this only works if the GitHub repo (or a mirror of it) is PUBLIC. See README.
 */
export function buildRawGithubUrl(repository: string, ref: string, relativePath: string): string {
  return `https://raw.githubusercontent.com/${repository}/${ref}/${relativePath.replace(/\\/g, "/")}`;
}
