import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { indexFull } from "../../packages/core/src/index/full.js";
import { indexIncremental } from "../../packages/core/src/index/incremental.js";
import { buildScaleRepo } from "../fixtures/scale-repo-builder.js";

const SCALE_100K_ENABLED = process.env.GITCHANGE_SCALE_100K === "1";
const INDEX_BUDGET_MS = 120_000;
const BENCHMARK_TEST_TIMEOUT_MS = 300_000;
const INCREMENTAL_TEST_TIMEOUT_MS = 120_000;

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe.sequential("scale index benchmark", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it(
    "full index of 10k commits completes under 120s with workers enabled",
    async () => {
      const repo = buildScaleRepo({ commitCount: 10_000 });
      repos.push(repo);

      const gitchangeDir = join(repo.dir, ".gitchange");
      const startedAt = Date.now();

      const result = await indexFull({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      const elapsedMs = Date.now() - startedAt;
      expect(result.commitsIndexed).toBe(10_000);
      expect(result.manifest.lastIndexDurationMs).toBeDefined();
      expect(result.manifest.lastIndexDurationMs).toBeLessThan(INDEX_BUDGET_MS);
      expect(elapsedMs).toBeLessThan(INDEX_BUDGET_MS);
    },
    BENCHMARK_TEST_TIMEOUT_MS,
  );

  it(
    "incremental index after one new commit processes at most five commits",
    async () => {
      const repo = buildScaleRepo({ commitCount: 200 });
      repos.push(repo);

      const gitchangeDir = join(repo.dir, ".gitchange");
      await indexFull({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      git(repo.dir, [
        "commit",
        "--allow-empty",
        "-m",
        "chore: incremental scale probe",
      ]);

      const incremental = await indexIncremental({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      expect(incremental.commitsIndexed).toBeGreaterThan(0);
      expect(incremental.commitsIndexed).toBeLessThanOrEqual(5);
    },
    INCREMENTAL_TEST_TIMEOUT_MS,
  );

  it(
    "incremental index on unchanged HEAD indexes zero commits",
    async () => {
      const repo = buildScaleRepo({ commitCount: 50 });
      repos.push(repo);

      const gitchangeDir = join(repo.dir, ".gitchange");
      await indexFull({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      const secondPass = await indexIncremental({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      expect(secondPass.commitsIndexed).toBe(0);
    },
    INCREMENTAL_TEST_TIMEOUT_MS,
  );

  it.skipIf(!SCALE_100K_ENABLED)(
    "full index of 100k commits completes with workers (GITCHANGE_SCALE_100K=1)",
    async () => {
      const repo = buildScaleRepo({ commitCount: 100_000 });
      repos.push(repo);

      const gitchangeDir = join(repo.dir, ".gitchange");
      const result = await indexFull({
        repoPath: repo.dir,
        gitchangeDir,
        useWorkers: true,
        rebuildIntelligence: false,
      });

      expect(result.commitsIndexed).toBe(100_000);
    },
    600_000,
  );
});
