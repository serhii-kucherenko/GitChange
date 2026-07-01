import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { checkSemanticIntegrity } from "../../packages/core/src/verify/semantic-integrity.js";
import {
  BASIC_SCENARIO_SEMANTIC_SNAPSHOT,
  collectSemanticSnapshot,
} from "../../packages/core/src/verify/semantic-snapshot.js";
import { applyBasicScenarioErasFixture } from "./semantic-fixture.js";
import {
  indexBasicScenario,
  indexBasicScenarioWithSemantic,
} from "./helpers.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_BIN = join(REPO_ROOT, "packages/cli/src/bin.ts");

function runGitchangedValidate(
  repoPath: string,
): { exitCode: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync(
      "pnpm",
      ["exec", "tsx", CLI_BIN, "validate", "--repo", repoPath],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "" },
      },
    );
    return { exitCode: 0, stderr: "", stdout };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      status?: number;
      stderr?: string;
      stdout?: string;
    };
    return {
      exitCode: execError.status ?? 1,
      stderr: execError.stderr?.toString() ?? "",
      stdout: execError.stdout?.toString() ?? "",
    };
  }
}

describe("golden: semantic (ERA-01, ERA-02, ERA-03)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("locks BASIC_SCENARIO semantic snapshot counts after pipeline", async () => {
    const fixture = await indexBasicScenarioWithSemantic();
    cleanups.push(fixture.cleanup);

    expect(collectSemanticSnapshot(fixture.gitchangeDir)).toEqual(
      BASIC_SCENARIO_SEMANTIC_SNAPSHOT,
    );
  });

  it("passes semantic integrity on BASIC_SCENARIO fixture eras", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);

    const report = checkSemanticIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("gitchange validate exits 0 after full semantic pipeline", async () => {
    const fixture = await indexBasicScenarioWithSemantic();
    cleanups.push(fixture.cleanup);

    const { exitCode, stderr } = runGitchangedValidate(fixture.repo.dir);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
  });

  it("gitchange validate exits 1 when semantic artifacts are missing", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const { exitCode, stderr } = runGitchangedValidate(fixture.repo.dir);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/eras\.json|semantic artifacts missing/i);
  });
});
