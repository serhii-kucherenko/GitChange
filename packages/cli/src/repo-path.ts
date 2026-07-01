import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function resolveRepoPath(cwd: string): string {
  let current = resolve(cwd);

  while (true) {
    const gitDir = resolve(current, ".git");
    if (existsSync(gitDir)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        "Not inside a git repository. Run from a repo root or pass --repo <path>.",
      );
    }
    current = parent;
  }
}
