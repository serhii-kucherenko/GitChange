import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runDecisionsPipeline, runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { checkDecisionsIntegrity } from "../../packages/core/src/verify/decisions-integrity.js";
import {
  BASIC_SCENARIO_DECISIONS_SNAPSHOT,
  collectDecisionsSnapshot,
} from "../../packages/core/src/verify/decisions-snapshot.js";
import { applyBasicScenarioDecisionsFixture } from "./decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "./semantic-fixture.js";
import { indexBasicScenario } from "./helpers.js";

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

describe("golden: decisions (STAT-03, STAT-04, EVD-03)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("locks BASIC_SCENARIO decisions snapshot counts after pipeline", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);

    expect(collectDecisionsSnapshot(fixture.gitchangeDir)).toEqual(
      BASIC_SCENARIO_DECISIONS_SNAPSHOT,
    );
  });

  it("passes decisions integrity on BASIC_SCENARIO fixture", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);

    const report = checkDecisionsIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("gitchange validate exits 0 when decisions artifacts are present", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);

    const result = runGitchangedValidate(fixture.repo.dir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("gitchange validate: ok");
  });
});
