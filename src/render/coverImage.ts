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

const OPENAI_IMAGE_PROMPT_TEMPLATE = (searchQuery: string) => `Photographic background for a 1080x1080 Japanese dermatology clinic Instagram post.

Subject brief: ${searchQuery}.

Required composition: a Japanese woman appropriate to this topic, age 30-50, natural untreated skin texture, calm neutral expression. Place her portrait only in the RIGHT 35-40% of the square. Show one eye and most of the face, cropped naturally at the RIGHT edge. Keep the LEFT 65% low-detail, softly lit, light neutral tone so a separate ivory information panel can be composited on top later.

Style: quiet, refined, clinical editorial photography; warm ivory and muted neutral tones; natural daylight; high-resolution skin detail. Generate NO text, NO typography, NO logo, NO frame, NO colored lines, NO graphic panel — those are added separately.

Strict exclusions: no doctor, no medical staff, no examination room, no clinic interior, no equipment, no procedure, no treatment scene, no before-and-after comparison, no testimonial.`;

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
        quality: "medium",
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
