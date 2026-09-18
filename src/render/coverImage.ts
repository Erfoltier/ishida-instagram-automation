/**
 * Cover photo sourcing — the ONE seam meant to be swapped later (e.g. once Adobe
 * Stock for Enterprise / a comparable licensed-photo API is available). Every
 * other module only calls `getCoverPhoto(query)`; nothing else needs to change
 * to switch providers.
 */
export interface CoverPhotoProvider {
  /** Returns raw image bytes (JPEG/PNG) sized close to 1080x1080, no text/logo baked in. */
  getCoverPhoto(searchQuery: string): Promise<Buffer>;
}

const OPENAI_IMAGE_PROMPT_TEMPLATE = (searchQuery: string) => `Photographic background for a 1080x1080 Japanese dermatology clinic Instagram post — the same visual quality bar as a premium skincare brand campaign (think a high-end Shiseido or SK-II ad), not a stock-photo look.

Subject brief: ${searchQuery}.

Required composition: an elegant, photogenic Japanese woman appropriate to this topic, age 30-50, healthy radiant skin with natural (not plastic-looking) texture, a soft confident expression. Beautifully lit, flattering angle, in-focus eyes, professional beauty-editorial retouching level (polished but believable, not artificial). Place her portrait only in the RIGHT 35-40% of the square. Show one eye and most of the face, cropped naturally at the RIGHT edge. Keep the LEFT 65% low-detail, softly lit, light neutral tone so a separate ivory information panel can be composited on top later.

Style: quiet, refined, clinical editorial photography; warm ivory and muted neutral tones; natural daylight; high-resolution skin detail; shot on a full-frame camera with a prime lens look. Generate NO text, NO typography, NO logo, NO frame, NO colored lines, NO graphic panel — those are added separately.

Strict exclusions: no doctor, no medical staff, no examination room, no clinic interior, no equipment, no procedure, no treatment scene, no before-and-after comparison, no testimonial, no unflattering angle, no harsh flat lighting.`;

export const openAiCoverPhotoProvider: CoverPhotoProvider = {
  async getCoverPhoto(searchQuery: string): Promise<Buffer> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: OPENAI_IMAGE_PROMPT_TEMPLATE(searchQuery),
        size: "1024x1024",
        quality: "high",
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI画像生成に失敗しました (${response.status}): ${detail}`);
    }
    const body = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI画像生成の応答にb64_jsonが含まれていません。");
    return Buffer.from(b64, "base64");
  },
};

/**
 * Swap this export to point at an Adobe Stock (or other licensed-photo) provider
 * once that API access is approved. Nothing outside this file needs to change.
 */
export const coverPhotoProvider: CoverPhotoProvider = openAiCoverPhotoProvider;
