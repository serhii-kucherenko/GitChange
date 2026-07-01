import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadIgnoreRevs(repoPath: string): Set<string> {
  const filePath = join(repoPath, ".git-blame-ignore-revs");
  if (!existsSync(filePath)) {
    return new Set();
  }

  const shas = new Set<string>();
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    shas.add(trimmed);
  }

  return shas;
}
