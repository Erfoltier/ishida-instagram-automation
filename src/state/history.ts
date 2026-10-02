import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PublishedPostRecord } from "../content/themes";

const HISTORY_PATH = path.join(process.cwd(), "data", "post-history.json");
/** Reels walk the same article calendar independently of carousels, so they keep their own history. */
export const REEL_HISTORY_PATH = path.join(process.cwd(), "data", "reel-history.json");

export async function readPostHistory(historyPath = HISTORY_PATH): Promise<PublishedPostRecord[]> {
  try {
    const raw = await readFile(historyPath, "utf8");
    return JSON.parse(raw) as PublishedPostRecord[];
  } catch {
    return [];
  }
}

export async function appendPostHistory(record: PublishedPostRecord, historyPath = HISTORY_PATH): Promise<void> {
  const history = await readPostHistory(historyPath);
  history.push(record);
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
}
