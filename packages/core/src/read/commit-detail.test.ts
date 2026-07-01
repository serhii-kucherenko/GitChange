import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import {
  CommitNotFoundError,
  getCommitDetail,
  InvalidCommitShaError,
} from "./commit-detail.js";

describe("getCommitDetail", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns commit message and files with parsed hunks_json", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const gitchangeDir = `${repo.dir}/.gitchange`;
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const featureCommitIdx = BASIC_SCENARIO.findIndex((spec) =>
      spec.message?.includes("wire endpoint"),
    );
    const sha = repo.commitShas[featureCommitIdx];

    const detail = getCommitDetail(gitchangeDir, sha);

    expect(detail.commit.sha).toBe(sha);
    expect(detail.commit.message).toContain("wire endpoint");
    expect(detail.files.length).toBeGreaterThanOrEqual(1);

    const featureFile = detail.files.find((file) => file.path === "src/feature.ts");
    expect(featureFile).toBeDefined();
    expect(featureFile!.hunks.length).toBeGreaterThanOrEqual(1);
    expect(featureFile!.hunks[0]?.patch).toMatch(/^@@ /);
  });

  it("throws CommitNotFoundError for unknown sha", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const gitchangeDir = `${repo.dir}/.gitchange`;
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    expect(() => getCommitDetail(gitchangeDir, "f".repeat(40))).toThrow(
      CommitNotFoundError,
    );
  });

  it("throws InvalidCommitShaError for malformed sha", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    cleanups.push(repo.cleanup);

    const gitchangeDir = `${repo.dir}/.gitchange`;
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    expect(() => getCommitDetail(gitchangeDir, "not-a-sha")).toThrow(
      InvalidCommitShaError,
    );
  });
});
