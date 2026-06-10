import { readdirSync, statSync, readFileSync } from "fs";
import { resolve } from "path";

export function collectFiles(
  dir: string,
  base: string
): Array<{ relativePath: string; content: Buffer }> {
  const results: Array<{ relativePath: string; content: Buffer }> = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    const entryStat = statSync(fullPath);
    if (entryStat.isFile()) {
      results.push({ relativePath: rel, content: readFileSync(fullPath) });
    } else if (entryStat.isDirectory()) {
      results.push(...collectFiles(fullPath, rel));
    }
  }
  return results;
}
