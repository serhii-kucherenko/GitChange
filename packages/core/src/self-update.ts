import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type SelfUpdateResult = {
  checked: boolean;
  updated: boolean;
  alreadyLatest: boolean;
  headBefore?: string;
  headAfter?: string;
  reason?: string;
};

function runGit(args: string[], cwd: string): { ok: boolean; stdout: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
  };
}

function resolveUpstreamRef(root: string): string | null {
  const upstream = runGit(["rev-parse", "@{u}"], root);
  if (upstream.ok && upstream.stdout) {
    return upstream.stdout;
  }

  const originHead = runGit(["rev-parse", "origin/HEAD"], root);
  if (originHead.ok && originHead.stdout) {
    return originHead.stdout;
  }

  const main = runGit(["rev-parse", "origin/main"], root);
  if (main.ok && main.stdout) {
    return main.stdout;
  }

  return null;
}

export function getGitShortSha(root: string, ref = "HEAD"): string | null {
  const result = runGit(["rev-parse", "--short", ref], root);
  return result.ok ? result.stdout : null;
}

/**
 * Fetch and fast-forward pull GitChange from origin when behind upstream.
 * Non-fatal on fetch/pull failure — returns reason instead of throwing.
 */
export function pullLatestFromOrigin(root: string): SelfUpdateResult {
  if (!existsSync(join(root, ".git"))) {
    return {
      checked: false,
      updated: false,
      alreadyLatest: false,
      reason: "not a git repository",
    };
  }

  const fetch = runGit(["fetch", "--quiet", "origin"], root);
  if (!fetch.ok) {
    return {
      checked: true,
      updated: false,
      alreadyLatest: false,
      reason: "fetch failed (offline?)",
    };
  }

  const headBefore = runGit(["rev-parse", "HEAD"], root);
  const upstream = resolveUpstreamRef(root);
  if (!headBefore.ok || !upstream) {
    return {
      checked: true,
      updated: false,
      alreadyLatest: false,
      reason: "could not resolve HEAD or upstream",
    };
  }

  if (headBefore.stdout === upstream) {
    return {
      checked: true,
      updated: false,
      alreadyLatest: true,
      headBefore: headBefore.stdout,
      headAfter: headBefore.stdout,
    };
  }

  const pull = runGit(["pull", "--ff-only", "--quiet", "origin"], root);
  if (!pull.ok) {
    return {
      checked: true,
      updated: false,
      alreadyLatest: false,
      headBefore: headBefore.stdout,
      reason: "pull failed (local commits or diverged branch — re-run install.sh)",
    };
  }

  const headAfter = runGit(["rev-parse", "HEAD"], root);
  const updated = headAfter.ok && headAfter.stdout !== headBefore.stdout;
  return {
    checked: true,
    updated,
    alreadyLatest: !updated,
    headBefore: headBefore.stdout,
    headAfter: headAfter.ok ? headAfter.stdout : headBefore.stdout,
  };
}

export function installDepsAfterSelfUpdate(root: string): void {
  const frozen = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: root,
    stdio: "inherit",
  });
  if (frozen.status !== 0) {
    const fallback = spawnSync("pnpm", ["install"], {
      cwd: root,
      stdio: "inherit",
    });
    if (fallback.status !== 0) {
      throw new Error("pnpm install failed after GitChange update");
    }
  }
}

export const CLI_BUILD_FILTERS = [
  "@gitchange/core",
  "@gitchange/server",
  "@gitchange/cli",
] as const;

export function rebuildCliPackages(root: string): void {
  const buildArgs = [
    "build",
    ...CLI_BUILD_FILTERS.flatMap((pkg) => ["--filter", pkg]),
  ];
  const build = spawnSync("pnpm", buildArgs, {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    throw new Error("pnpm build failed for GitChange CLI packages");
  }
}

export type RunSelfUpdateResult = SelfUpdateResult & {
  rebuilt: boolean;
};

export type RunSelfUpdateOptions = {
  /** Rebuild CLI packages even when already on latest upstream. */
  forceRebuild?: boolean;
};

/** Pull from origin when behind, then install deps and rebuild when updated or forced. */
export function runSelfUpdate(
  root: string,
  options?: RunSelfUpdateOptions,
): RunSelfUpdateResult {
  const pullResult = pullLatestFromOrigin(root);
  let rebuilt = false;

  if (pullResult.updated || options?.forceRebuild) {
    installDepsAfterSelfUpdate(root);
    rebuildCliPackages(root);
    rebuilt = true;
  }

  return { ...pullResult, rebuilt };
}
