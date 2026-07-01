import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ResolveError, resolveCliBin, resolveGitChangeRoot } from "./resolve-root.js";

function normPath(path: string): string {
  return realpathSync.native(path);
}

function makeGitChangeRoot(base: string): string {
  mkdirSync(join(base, ".cursor-plugin"), { recursive: true });
  writeFileSync(
    join(base, ".cursor-plugin", "plugin.json"),
    JSON.stringify({ name: "gitchange", skills: "./packages/plugin/skills/" }),
  );
  return base;
}

function makeCliDist(root: string): void {
  const distDir = join(root, "packages", "cli", "dist");
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "bin.js"), "#!/usr/bin/env node\n");
}

describe("resolveGitChangeRoot", () => {
  const envRestore = process.env.GITCHANGE_ROOT;
  const cwdRestore = process.cwd();
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    if (envRestore === undefined) {
      delete process.env.GITCHANGE_ROOT;
    } else {
      process.env.GITCHANGE_ROOT = envRestore;
    }
    process.chdir(cwdRestore);
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns GITCHANGE_ROOT when set and valid", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-env-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);
    process.env.GITCHANGE_ROOT = root;

    expect(normPath(resolveGitChangeRoot("/tmp/nowhere"))).toBe(normPath(root));
  });

  it("throws ResolveError when GITCHANGE_ROOT is invalid", () => {
    const bad = mkdtempSync(join(tmpdir(), "gc-bad-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", bad]);
    });
    process.env.GITCHANGE_ROOT = bad;

    expect(() => resolveGitChangeRoot()).toThrow(ResolveError);
  });

  it("walks up from cwd to find .cursor-plugin/plugin.json (monorepo layout)", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-mono-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);
    const nested = join(root, "packages", "plugin", "scripts");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    expect(normPath(resolveGitChangeRoot())).toBe(normPath(root));
  });

  it("walks up to find node_modules/.bin/gitchange (global install layout)", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-global-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);
    makeCliDist(root);
    const binDir = join(root, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    symlinkSync(join(root, "packages", "cli", "dist", "bin.js"), join(binDir, "gitchange"));

    const nested = join(root, "some", "nested", "cwd");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    expect(normPath(resolveGitChangeRoot())).toBe(normPath(root));
  });

  it("throws ResolveError from unrelated directory without env", () => {
    const orphan = mkdtempSync(join(tmpdir(), "gc-orphan-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", orphan]);
    });
    delete process.env.GITCHANGE_ROOT;
    const isolatedModule = join(orphan, "resolve-root.ts");
    writeFileSync(isolatedModule, "");

    expect(() =>
      resolveGitChangeRoot(orphan, { moduleFile: isolatedModule }),
    ).toThrow(ResolveError);
    expect(() =>
      resolveGitChangeRoot(orphan, { moduleFile: isolatedModule }),
    ).toThrow(/Could not resolve GitChange root/);
  });
});

describe("resolveCliBin", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns packages/cli/dist/bin.js when present", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-bin-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);
    makeCliDist(root);

    const bin = resolveCliBin(root);
    expect(bin).toBe(join(root, "packages", "cli", "dist", "bin.js"));
  });

  it("returns node_modules/.bin/gitchange when dist is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-bin-global-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);
    const binDir = join(root, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const target = join(root, "cli-stub.js");
    writeFileSync(target, "#!/usr/bin/env node\n");
    symlinkSync(target, join(binDir, "gitchange"));

    const bin = resolveCliBin(root);
    expect(bin).toBe(join(root, "node_modules", ".bin", "gitchange"));
  });

  it("returns pnpm exec gitchange as fallback", () => {
    const root = mkdtempSync(join(tmpdir(), "gc-bin-fallback-"));
    cleanups.push(() => {
      execFileSync("rm", ["-rf", root]);
    });
    makeGitChangeRoot(root);

    expect(resolveCliBin(root)).toBe("pnpm exec gitchange");
  });
});
