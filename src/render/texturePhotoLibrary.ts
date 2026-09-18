import { readdir } from "node:fs/promises";
import path from "node:path";

const LIBRARY_ROOT = path.join(process.cwd(), "assets", "texture-photos");
const FALLBACK_CATEGORY = "skin-care";

function categorySlug(eyebrow: string): string {
  return eyebrow.toLowerCase().replace(/\s+/g, "-");
}

async function listPhotos(category: string): Promise<string[]> {
  try {
    const files = await readdir(path.join(LIBRARY_ROOT, category));
    return files.filter(file => /\.(jpe?g|png)$/i.test(file)).map(file => path.join(LIBRARY_ROOT, category, file));
  } catch {
    return [];
  }
}

/**
 * Picks a pre-uploaded texture photo for the theme's category, falling back to the
 * catch-all "skin-care" folder, then to null (caller should fall back to the
 * flat/icon design) if nothing has been uploaded yet at all. The pick is
 * deterministic per `seed` (pass the draftId) so re-rendering the same draft
 * (e.g. after a text edit) keeps the same photo instead of jumping around.
 */
export async function pickTexturePhoto(eyebrow: string, seed: string): Promise<string | null> {
  let photos = await listPhotos(categorySlug(eyebrow));
  if (photos.length === 0) photos = await listPhotos(FALLBACK_CATEGORY);
  if (photos.length === 0) return null;

  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return photos[hash % photos.length]!;
}
