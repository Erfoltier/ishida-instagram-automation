import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PublishedPostRecord } from "../content/themes";

const HISTORY_PATH = path.join(process.cwd(), "data", "post-history.json");

export async function readPostHistory(): Promise<PublishedPostRecord[]> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    return JSON.parse(raw) as PublishedPostRecord[];
  } catch {
    return [];
  }
}

export async function appendPostHistory(record: PublishedPostRecord): Promise<void> {
  const history = await readPostHistory();
  history.push(record);
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");
}
