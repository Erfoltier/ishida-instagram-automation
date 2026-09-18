import { readdir } from "node:fs/promises";
import path from "node:path";

const LIBRARY_ROOT = path.join(process.cwd(), "assets", "texture-photos");

function categorySlug(eyebrow: string): string {
  // "MOUTH & MARIONETTE" -> "mouth-marionette": collapse any run of non-alphanumeric
  // characters (spaces, "&", etc.) into a single hyphen, matching the folder names
  // in assets/texture-photos/ (see its README for the full slug list).
  return eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
 * Picks a pre-uploaded texture photo for the theme's exact concern category. Returns
 * null (caller should fall back to the flat/icon design) if that category has no
 * photos yet — deliberately does NOT borrow from another category, since a photo
 * for the wrong concern would be worse than the flat design. The pick is
 * deterministic per `seed` (pass the draftId) so re-rendering the same draft
 * (e.g. after a text edit) keeps the same photo instead of jumping around.
 */
export async function pickTexturePhoto(eyebrow: string, seed: string): Promise<string | null> {
  const photos = await listPhotos(categorySlug(eyebrow));
  if (photos.length === 0) return null;

  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return photos[hash % photos.length]!;
}
