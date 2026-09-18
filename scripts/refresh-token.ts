import sodium from "libsodium-wrappers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function refreshInstagramToken(currentToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);
  const response = await fetch(url);
  const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!response.ok || !body.access_token || !body.expires_in) {
    throw new Error(body.error?.message ?? "Instagramトークンの更新に失敗しました。");
  }
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

/** Encrypts a new secret value and writes it via the GitHub Actions Secrets API. Requires REPO_ADMIN_TOKEN with repo "Secrets: write" permission. */
async function updateGithubSecret(secretName: string, secretValue: string) {
  await sodium.ready;
  const adminToken = requireEnv("REPO_ADMIN_TOKEN");
  const repository = requireEnv("GITHUB_REPOSITORY");
  const headers = { authorization: `Bearer ${adminToken}`, accept: "application/vnd.github+json" };

  const keyResponse = await fetch(`https://api.github.com/repos/${repository}/actions/secrets/public-key`, { headers });
  if (!keyResponse.ok) throw new Error(`公開鍵の取得に失敗しました (${keyResponse.status})`);
  const { key, key_id: keyId } = (await keyResponse.json()) as { key: string; key_id: string };

  const messageBytes = sodium.from_string(secretValue);
  const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  const putResponse = await fetch(`https://api.github.com/repos/${repository}/actions/secrets/${secretName}`, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId }),
  });
  if (!putResponse.ok) throw new Error(`シークレットの更新に失敗しました (${putResponse.status})`);
}

async function main() {
  const currentToken = requireEnv("META_IG_ACCESS_TOKEN");
  const { accessToken, expiresInSeconds } = await refreshInstagramToken(currentToken);
  await updateGithubSecret("META_IG_ACCESS_TOKEN", accessToken);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  console.log(`Instagramアクセストークンを更新しました。新しい有効期限: ${expiresAt.toISOString()}`);
}

main().catch(error => {
  console.error(`トークン更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
