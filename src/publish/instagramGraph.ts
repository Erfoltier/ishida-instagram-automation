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

/**
 * Meta requires image_url to be a URL their servers can fetch unauthenticated —
 * this only works if the GitHub repo (or a mirror of it) is PUBLIC. See README.
 */
export function buildRawGithubUrl(repository: string, ref: string, relativePath: string): string {
  return `https://raw.githubusercontent.com/${repository}/${ref}/${relativePath.replace(/\\/g, "/")}`;
}
