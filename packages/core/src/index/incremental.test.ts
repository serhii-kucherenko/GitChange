import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "./full.js";
import { commitExists, indexIncremental } from "./incremental.js";
import * as schema from "../schema/drizzle/schema.js";
import { readManifest } from "../schema/manifest.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe("indexIncremental", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("delegates to indexFull when manifest is missing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    expect(existsSync(join(gitchangeDir, "manifest.json"))).toBe(false);

    const result = await indexIncremental({ repoPath: repo.dir, gitchangeDir });
    expect(result.commitsIndexed).toBe(repo.commitShas.length);
    expect(readManifest(gitchangeDir)?.lastIndexedCommit).toBe(repo.headSha);
  });

  it("indexes only commits after the manifest cursor", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const dbBefore = openDb(gitchangeDir);
    const commitsBefore = dbBefore.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
    const fileChangesBefore =
      dbBefore.select({ value: count() }).from(schema.fileChanges).get()?.value ?? 0;
    const indexedShasBefore = dbBefore
      .select({ sha: schema.commits.sha })
      .from(schema.commits)
      .all()
      .map((row) => row.sha);

    git(repo.dir, ["checkout", "main"]);
    git(repo.dir, ["commit", "--allow-empty", "-m", "chore: incremental fixture commit"]);

    const newHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo.dir,
      encoding: "utf8",
    }).trim();

    const result = await indexIncremental({ repoPath: repo.dir, gitchangeDir });
    expect(result.commitsIndexed).toBe(1);

    const dbAfter = openDb(gitchangeDir);
    const commitsAfter = dbAfter.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
    const fileChangesAfter =
      dbAfter.select({ value: count() }).from(schema.fileChanges).get()?.value ?? 0;

    expect(commitsAfter).toBe(commitsBefore + 1);
    expect(fileChangesAfter).toBe(fileChangesBefore);
    expect(commitExists(dbAfter, newHead)).toBe(true);

    for (const sha of indexedShasBefore) {
      expect(commitExists(dbAfter, sha)).toBe(true);
    }

    expect(readManifest(gitchangeDir)?.lastIndexedCommit).toBe(newHead);
  });

  it("refreshes indexedAt when HEAD equals the cursor", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const before = readManifest(gitchangeDir);
    expect(before).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await indexIncremental({ repoPath: repo.dir, gitchangeDir });
    expect(result.commitsIndexed).toBe(0);
    expect(result.manifest.lastIndexedCommit).toBe(before?.lastIndexedCommit);
    expect(result.manifest.indexedAt).not.toBe(before?.indexedAt);
  });
});
