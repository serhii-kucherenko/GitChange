import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "./full.js";
import * as schema from "../schema/drizzle/schema.js";
import { ManifestSchema } from "../schema/manifest.js";
import { createIndexWorkerPool, processCommitBatch } from "./worker-pool.js";
import { loadIgnorePatterns } from "../privacy/gitchangeignore.js";
import { closeIndexWorkerPool } from "./worker-pool.js";

describe("index worker pool", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(async () => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("indexes BASIC_SCENARIO with workers enabled", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const result = await indexFull({
      repoPath: repo.dir,
      gitchangeDir,
      useWorkers: true,
    });

    expect(result.commitsIndexed).toBe(repo.commitShas.length);

    const db = openDb(gitchangeDir);
    const commitCount = db.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
    expect(commitCount).toBe(repo.commitShas.length);
  });

  it("processCommitBatch writes the same commit count as single-threaded index", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange-worker-batch");
    if (existsSync(gitchangeDir)) {
      rmSync(gitchangeDir, { recursive: true, force: true });
    }

    const single = await indexFull({
      repoPath: repo.dir,
      gitchangeDir: join(repo.dir, ".gitchange-single"),
      useWorkers: false,
    });

    const workerDir = join(repo.dir, ".gitchange-worker-batch");
    const workerResult = await indexFull({
      repoPath: repo.dir,
      gitchangeDir: workerDir,
      useWorkers: true,
    });

    expect(workerResult.commitsIndexed).toBe(single.commitsIndexed);

    const workerDb = openDb(workerDir);
    const workerCommits =
      workerDb.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
    expect(workerCommits).toBe(single.commitsIndexed);
  });

  it("rejects invalid repo paths in worker tasks", async () => {
    const pool = createIndexWorkerPool(1);

    try {
      await expect(
        pool.run({
          repoPath: "/tmp/not-a-git-repo-gitchange-test",
          sha: "a".repeat(40),
          ignorePatterns: [],
          maxBlobBytes: 1024,
        }),
      ).rejects.toThrow(/Invalid repository path/);
    } finally {
      await closeIndexWorkerPool(pool);
    }
  });

  it("processCommitBatch applies rows from worker output", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange-batch-only");
    if (existsSync(gitchangeDir)) {
      rmSync(gitchangeDir, { recursive: true, force: true });
    }

    const db = openDb(gitchangeDir);
    const { createWriter } = await import("../artifacts/writer.js");
    const writer = createWriter(db);
    const pool = createIndexWorkerPool(2);
    const ignorePatterns = loadIgnorePatterns(repo.dir);

    try {
      const tasks = repo.commitShas.map((sha) => ({
        repoPath: repo.dir,
        sha,
        ignorePatterns,
        maxBlobBytes: 1_048_576,
      }));

      const batchResult = await processCommitBatch(pool, tasks, writer);
      writer.flush();

      expect(batchResult.committerTimestamps.length).toBe(repo.commitShas.length);
      const commitCount = db.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
      expect(commitCount).toBe(repo.commitShas.length);
    } finally {
      await closeIndexWorkerPool(pool);
    }
  });
});

describe("manifest lastIndexDurationMs", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("records lastIndexDurationMs after full index", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const result = await indexFull({
      repoPath: repo.dir,
      gitchangeDir,
      useWorkers: false,
    });

    expect(result.manifest.lastIndexDurationMs).toBeTypeOf("number");
    expect(result.manifest.lastIndexDurationMs).toBeGreaterThanOrEqual(0);

    const parsed = ManifestSchema.parse(result.manifest);
    expect(parsed.lastIndexDurationMs).toBe(result.manifest.lastIndexDurationMs);
  });
});
