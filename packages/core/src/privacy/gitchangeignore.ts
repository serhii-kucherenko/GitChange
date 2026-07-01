import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { minimatch } from "minimatch";
import { DEFAULT_GITCHANGEIGNORE } from "./default-gitchangeignore.js";

const MATCH_OPTIONS = {
  dot: true,
  matchBase: true,
} as const;

export interface IgnoreMatcher {
  isIgnored(path: string): boolean;
}

function parseIgnoreFile(content: string): string[] {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function createIgnoreMatcher(patterns: readonly string[]): IgnoreMatcher {
  const normalizedPatterns = [...patterns];

  return {
    isIgnored(path: string): boolean {
      let ignored = false;

      for (const pattern of normalizedPatterns) {
        if (pattern.startsWith("!")) {
          const negatedPattern = pattern.slice(1);
          if (minimatch(path, negatedPattern, MATCH_OPTIONS)) {
            ignored = false;
          }
          continue;
        }

        if (minimatch(path, pattern, MATCH_OPTIONS)) {
          ignored = true;
        }
      }

      return ignored;
    },
  };
}

export function loadIgnore(repoRoot: string): IgnoreMatcher {
  const ignorePath = join(repoRoot, ".gitchangeignore");

  if (existsSync(ignorePath)) {
    const content = readFileSync(ignorePath, "utf8");
    return createIgnoreMatcher(parseIgnoreFile(content));
  }

  return createIgnoreMatcher(DEFAULT_GITCHANGEIGNORE);
}

export { DEFAULT_GITCHANGEIGNORE } from "./default-gitchangeignore.js";
