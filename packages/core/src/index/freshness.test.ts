import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo, shallowCloneOf } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openRepo } from "../ingestion/git-walk.js";
import {
  checkCursorReachable,
  countOutOfOrder,
  isShallow,
} from "./freshness.js";

describe("freshness detection", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("isShallow returns true for a shallow clone fixture", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const shallow = shallowCloneOf(repo, 3);
    repos.push(shallow);

    const opened = await openRepo(shallow.dir);
    expect(isShallow(shallow.dir, opened)).toBe(true);
  });

  it("isShallow returns false for a full clone", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const opened = await openRepo(repo.dir);
    expect(isShallow(repo.dir, opened)).toBe(false);
  });

  it("checkCursorReachable returns rewritten=false when cursor is an ancestor of HEAD", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const opened = await openRepo(repo.dir);
    const ancestorSha = repo.commitShas[Math.floor(repo.commitShas.length / 2)];

    expect(checkCursorReachable(opened, ancestorSha)).toEqual({ rewritten: false });
  });

  it("checkCursorReachable returns rewritten=true for a missing cursor SHA", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const opened = await openRepo(repo.dir);
    const fabricatedSha = "0".repeat(40);

    const result = checkCursorReachable(opened, fabricatedSha);
    expect(result.rewritten).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it("checkCursorReachable returns rewritten=true when cursor is not reachable from HEAD", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    execFileSync("git", ["checkout", "--orphan", "orphan-root"], {
      cwd: repo.dir,
      encoding: "utf8",
    });
    execFileSync("git", ["commit", "--allow-empty", "-m", "orphan root"], {
      cwd: repo.dir,
      encoding: "utf8",
    });

    const orphanedCursor = repo.headSha;
    const opened = await openRepo(repo.dir);

    const result = checkCursorReachable(opened, orphanedCursor);
    expect(result.rewritten).toBe(true);
    expect(result.reason).toBe("cursor not ancestor of HEAD");
  });

  it("countOutOfOrder counts committer-date inversions in walk order", () => {
    const newestFirst = [2_000, 3_000, 1_000, 4_000];
    expect(countOutOfOrder(newestFirst)).toBe(2);
  });

  it("countOutOfOrder returns zero for monotonic newest-first timestamps", () => {
    expect(countOutOfOrder([5_000, 4_000, 3_000, 2_000])).toBe(0);
    expect(countOutOfOrder([])).toBe(0);
    expect(countOutOfOrder([1_000])).toBe(0);
  });
});
