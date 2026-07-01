import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

function runGitchangedIndex(repoPath: string): { exitCode: number; stderr: string } {
  try {
    execFileSync(
      "pnpm",
      ["exec", "tsx", CLI_BIN, "index", "--repo", repoPath],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "" },
      },
    );
    return { exitCode: 0, stderr: "" };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      status?: number;
      stderr?: string;
    };
    return {
      exitCode: execError.status ?? 1,
      stderr: execError.stderr?.toString() ?? "",
    };
  }
}

describe("integration: gitchange index CLI", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("indexes BASIC_SCENARIO repo into .gitchange/", () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const { exitCode } = runGitchangedIndex(repo.dir);
    expect(exitCode).toBe(0);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const manifestPath = join(gitchangeDir, "manifest.json");
    const intelligencePath = join(gitchangeDir, "intelligence.json");

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(intelligencePath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      lastIndexedCommit: string;
    };
    expect(manifest.lastIndexedCommit).toBe(repo.headSha);

    const intelligence = JSON.parse(readFileSync(intelligencePath, "utf8")) as {
      churn: { files: unknown[] };
    };
    expect(intelligence.churn.files.length).toBeGreaterThanOrEqual(1);
  });
});
