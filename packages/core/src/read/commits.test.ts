import { afterEach, describe, expect, it } from "vitest";
import {
  decodeCommitCursor,
  encodeCommitCursor,
  InvalidCommitCursorError,
  listCommits,
} from "./commits.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

describe("listCommits", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns commits ordered by committedAt desc on BASIC_SCENARIO", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const page = listCommits(fixture.gitchangeDir, { limit: 50 });
    expect(page.commits.length).toBeGreaterThanOrEqual(3);

    for (let index = 1; index < page.commits.length; index += 1) {
      const previous = page.commits[index - 1];
      const current = page.commits[index];
      expect(previous.committedAt).toBeGreaterThanOrEqual(current.committedAt);
      if (previous.committedAt === current.committedAt) {
        expect(previous.sha.localeCompare(current.sha)).toBeGreaterThanOrEqual(
          0,
        );
      }
    }

    for (const commit of page.commits) {
      expect(commit.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(commit.summary.length).toBeGreaterThan(0);
      expect(commit.authorName.length).toBeGreaterThan(0);
      expect(commit.authorEmail).toContain("@");
    }
  });

  it("returns disjoint second page when more commits exist than limit", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const firstPage = listCommits(fixture.gitchangeDir, { limit: 2 });
    expect(firstPage.commits).toHaveLength(2);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = listCommits(fixture.gitchangeDir, {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.commits.length).toBeGreaterThan(0);

    const firstShas = new Set(firstPage.commits.map((commit) => commit.sha));
    for (const commit of secondPage.commits) {
      expect(firstShas.has(commit.sha)).toBe(false);
    }
  });

  it("round-trips cursor encoding", () => {
    const cursor = encodeCommitCursor(1_700_000_000, "a".repeat(40));
    const decoded = decodeCommitCursor(cursor);
    expect(decoded).toEqual({
      committedAt: 1_700_000_000,
      sha: "a".repeat(40),
    });
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeCommitCursor("not-valid")).toThrow(
      InvalidCommitCursorError,
    );
  });
});
