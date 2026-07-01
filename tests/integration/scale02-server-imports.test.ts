import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SERVER_SRC = join(
  fileURLToPath(import.meta.url),
  "../../../packages/server/src",
);

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("SCALE-02: @gitchange/server must not import es-git", () => {
  it("has zero es-git imports in source tree", () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SERVER_SRC)) {
      const content = readFileSync(file, "utf-8");
      if (/from\s+["']es-git["']/.test(content) || /import\s*\(\s*["']es-git["']\s*\)/.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
