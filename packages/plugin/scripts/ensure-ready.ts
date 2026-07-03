import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { rebuildCliPackages } from "@gitchange/core/self-update";

const CLI_DIST_REL = join("packages", "cli", "dist", "bin.js");

export function isGitChangeReady(root: string): boolean {
  return (
    existsSync(join(root, "node_modules")) && existsSync(join(root, CLI_DIST_REL))
  );
}

export type EnsureReadyOptions = {
  /** Rebuild CLI packages even when dist already exists (after git pull). */
  forceRebuild?: boolean;
};

function runBuild(root: string): void {
  rebuildCliPackages(root);
}

/** Install deps and build CLI packages when the plugin clone is not built yet. */
export function ensureGitChangeReady(root: string, options?: EnsureReadyOptions): void {
  if (!existsSync(join(root, "node_modules"))) {
    const install = spawnSync("pnpm", ["install"], {
      cwd: root,
      stdio: "inherit",
    });
    if (install.status !== 0) {
      throw new Error("pnpm install failed — Node 22+ and pnpm 11+ are required");
    }
  }

  if (existsSync(join(root, CLI_DIST_REL)) && !options?.forceRebuild) {
    return;
  }

  runBuild(root);
}
