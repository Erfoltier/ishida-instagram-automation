import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "source-cache");
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CHARS_PER_PAGE = 6000;

type CachedPage = { url: string; fetchedAt: string; text: string };

function cacheFileFor(url: string) {
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
  return path.join(CACHE_DIR, `${slug}.json`);
}

async function readCache(url: string): Promise<CachedPage | null> {
  try {
    const raw = await readFile(cacheFileFor(url), "utf8");
    const cached = JSON.parse(raw) as CachedPage;
    if (Date.now() - new Date(cached.fetchedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

async function writeCache(entry: CachedPage) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFileFor(entry.url), JSON.stringify(entry, null, 2), "utf8");
}

/**
 * Extracts the real body text of an official treatment page (mechanism, candidates,
 * downtime, pricing, comparisons, cited guidelines). This is the grounding material
 * fed to the LLM so carousel copy states actual facts instead of generic filler.
 */
export async function fetchOfficialPageText(url: string): Promise<string> {
  const cached = await readCache(url);
  if (cached) return cached.text;

  const response = await fetch(url, { headers: { "user-agent": "ishida-instagram-automation/1.0 (content grounding fetch)" } });
  if (!response.ok) throw new Error(`公式サイトの取得に失敗しました (${response.status}): ${url}`);
  const html = await response.text();
  const $ = load(html);
  const main = $("main").first();
  const scope = main.length > 0 ? main : $("article").first().length > 0 ? $("article").first() : $("body");
  scope.find("script, style, nav, header, footer, form, noscript").remove();
  const text = scope
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CHARS_PER_PAGE);

  await writeCache({ url, fetchedAt: new Date().toISOString(), text });
  return text;
}

export async function fetchOfficialSourceText(urls: string[]): Promise<string> {
  const pages = await Promise.all(urls.map(fetchOfficialPageText));
  return pages.map((text, index) => `--- 参照ページ${index + 1}: ${urls[index]} ---\n${text}`).join("\n\n");
}
