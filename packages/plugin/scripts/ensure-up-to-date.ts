import {
  installDepsAfterSelfUpdate,
  pullLatestFromOrigin,
  rebuildCliPackages,
  type SelfUpdateResult,
} from "@gitchange/core/self-update";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_INSTALL_DIR = join(homedir(), ".gitchange-plugin");

export type EnsureUpToDateResult = SelfUpdateResult;

function normalizeRoot(dir: string): string {
  try {
    return realpathSync.native(dir);
  } catch {
    return dir;
  }
}

/** Whether this install should auto-pull from origin before each command (end-user global install). */
export function shouldAutoUpdate(root: string): boolean {
  if (process.env.GITCHANGE_SKIP_UPDATE === "1") {
    return false;
  }
  if (process.env.GITCHANGE_DEV === "1") {
    return false;
  }

  if (!existsSync(DEFAULT_INSTALL_DIR)) {
    return false;
  }

  const globalInstall = normalizeRoot(DEFAULT_INSTALL_DIR);
  const resolvedRoot = normalizeRoot(root);
  return resolvedRoot === globalInstall;
}

/**
 * Pull latest GitChange from origin for the global install (~/.gitchange-plugin).
 * Offline or pull failures are non-fatal — local copy continues to run.
 */
export function ensureGitChangeUpToDate(root: string): EnsureUpToDateResult {
  if (!shouldAutoUpdate(root)) {
    return {
      checked: false,
      updated: false,
      alreadyLatest: false,
      reason: "auto-update disabled or not global install",
    };
  }

  return pullLatestFromOrigin(root);
}

export function installDepsAfterUpdate(root: string): void {
  installDepsAfterSelfUpdate(root);
}

export type RunGitChangeUpdateOptions = {
  /** When true, run even for dev checkouts (explicit `gitchange update`). */
  explicit?: boolean;
  /** Rebuild CLI after pull even when already on latest (e.g. dist missing). */
  forceRebuild?: boolean;
};

export type RunGitChangeUpdateResult = SelfUpdateResult & {
  rebuilt: boolean;
};

/** Explicit or silent update: pull, install deps, rebuild when needed. */
export function runGitChangeUpdate(
  root: string,
  options?: RunGitChangeUpdateOptions,
): RunGitChangeUpdateResult {
  const explicit = options?.explicit === true;

  if (!explicit && !shouldAutoUpdate(root)) {
    return {
      checked: false,
      updated: false,
      alreadyLatest: false,
      rebuilt: false,
      reason: "auto-update disabled or not global install",
    };
  }

  const pullResult = pullLatestFromOrigin(root);
  let rebuilt = false;

  if (pullResult.updated || options?.forceRebuild) {
    installDepsAfterSelfUpdate(root);
    rebuildCliPackages(root);
    rebuilt = true;
  }

  return { ...pullResult, rebuilt };
}
