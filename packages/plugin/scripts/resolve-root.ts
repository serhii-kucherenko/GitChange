import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURSOR_PLUGIN_JSON = join(".cursor-plugin", "plugin.json");
const CLI_DIST_REL = join("packages", "cli", "dist", "bin.js");
const GLOBAL_BIN_REL = join("node_modules", ".bin", "gitchange");
const DEFAULT_INSTALL_DIR = join(homedir(), ".gitchange-plugin");

export class ResolveError extends Error {
  override readonly name = "ResolveError";

  constructor(message: string) {
    super(message);
  }
}

function normalizeRoot(dir: string): string {
  try {
    return realpathSync.native(dir);
  } catch {
    return resolve(dir);
  }
}

function isGitChangeRoot(dir: string): boolean {
  return existsSync(join(dir, CURSOR_PLUGIN_JSON));
}

function walkUp(start: string, matches: (dir: string) => boolean): string | null {
  let current = resolve(start);

  while (true) {
    if (matches(current)) {
      return normalizeRoot(current);
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export type ResolveGitChangeRootOptions = {
  /** Override module path for tests; defaults to this file. */
  moduleFile?: string;
  /** Override or disable `~/.gitchange-plugin` fallback (`false` in tests). */
  defaultInstallDir?: string | false;
};

function resolveFromModule(moduleFile: string): string | null {
  return walkUp(dirname(moduleFile), isGitChangeRoot);
}

/**
 * Resolve GitChange install root (P3-D-04 precedence):
 * 1. GITCHANGE_ROOT when set and valid
 * 2. Walk up from cwd for `.cursor-plugin/plugin.json`
 * 3. Walk up for `node_modules/.bin/gitchange`
 * 4. Walk up from this module's location (monorepo dev / Claude plugin path)
 * 5. Default install dir `~/.gitchange-plugin` (Cursor one-line install)
 */
export function resolveGitChangeRoot(
  cwd: string = process.cwd(),
  options?: ResolveGitChangeRootOptions,
): string {
  const envRoot = process.env.GITCHANGE_ROOT;
  if (envRoot) {
    const resolved = resolve(envRoot);
    if (!isGitChangeRoot(resolved)) {
      throw new ResolveError(
        `GITCHANGE_ROOT is set but invalid (missing ${CURSOR_PLUGIN_JSON}): ${resolved}`,
      );
    }
    return normalizeRoot(resolved);
  }

  const fromCwd = walkUp(cwd, isGitChangeRoot);
  if (fromCwd) {
    return fromCwd;
  }

  const fromGlobal = walkUp(cwd, (dir) => existsSync(join(dir, GLOBAL_BIN_REL)));
  if (fromGlobal && isGitChangeRoot(fromGlobal)) {
    return fromGlobal;
  }

  const moduleFile = options?.moduleFile ?? fileURLToPath(import.meta.url);
  const fromModule = resolveFromModule(moduleFile);
  if (fromModule) {
    return fromModule;
  }

  const defaultDir =
    options?.defaultInstallDir === false
      ? null
      : (options?.defaultInstallDir ?? DEFAULT_INSTALL_DIR);
  if (defaultDir && isGitChangeRoot(defaultDir)) {
    return normalizeRoot(defaultDir);
  }

  throw new ResolveError(
    "Could not resolve GitChange root. Cursor: run scripts/install.sh. Claude Code: install the GitChange marketplace plugin. Or set GITCHANGE_ROOT to a cloned copy.",
  );
}

/** Shell command prefix for plugin installs (no global CLI on PATH required). */
export function formatRunCliCommand(root: string, args: string[] = []): string {
  const quotedArgs = args.map((arg) => JSON.stringify(arg)).join(" ");
  return `pnpm --dir ${JSON.stringify(root)} exec tsx packages/plugin/scripts/run-cli.ts${quotedArgs ? ` ${quotedArgs}` : ""}`;
}

/** Path to the gitchange CLI binary, or `pnpm exec gitchange` when not on disk. */
export function resolveCliBin(root?: string): string {
  const gitchangeRoot = root ?? resolveGitChangeRoot();
  const distBin = join(gitchangeRoot, CLI_DIST_REL);
  if (existsSync(distBin)) {
    return distBin;
  }

  const globalBin = join(gitchangeRoot, GLOBAL_BIN_REL);
  if (existsSync(globalBin)) {
    return globalBin;
  }

  return "pnpm exec gitchange";
}
