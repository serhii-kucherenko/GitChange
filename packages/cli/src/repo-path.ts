import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function walkUp(start: string, matches: (dir: string) => boolean): string | null {
  let current = resolve(start);

  while (true) {
    if (matches(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveRepoPath(cwd: string): string {
  const found = walkUp(cwd, (dir) => existsSync(resolve(dir, ".git")));
  if (found) {
    return found;
  }

  throw new Error(
    "Not inside a git repository. Run from a repo root or pass --repo <path>.",
  );
}
