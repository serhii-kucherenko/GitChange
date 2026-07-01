import { afterEach, describe, expect, it } from "vitest";
import {
  decodeCommitCursor,
  encodeCommitCursor,
  InvalidCommitCursorError,
  InvalidCommitFilterError,
  listCommits,
  type CommitListFilters,
} from "./commits.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

describe("listCommits pagination", () => {
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

describe("listCommits filters", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("filters by author email substring", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const all = listCommits(fixture.gitchangeDir, { limit: 50 });
    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      author: "fixture@gitchange",
    });

    expect(filtered.commits.length).toBeGreaterThan(0);
    expect(filtered.commits.length).toBeLessThanOrEqual(all.commits.length);
    for (const commit of filtered.commits) {
      expect(
        commit.authorEmail.toLowerCase().includes("fixture@gitchange"),
      ).toBe(true);
    }
  });

  it("filters by author name substring", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      author: "Fixture",
    });

    expect(filtered.commits.length).toBeGreaterThan(0);
    for (const commit of filtered.commits) {
      expect(commit.authorName.toLowerCase()).toContain("fixture");
    }
  });

  it("filters by path prefix", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const all = listCommits(fixture.gitchangeDir, { limit: 50 });
    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      path: "docs/",
    });

    expect(filtered.commits).toHaveLength(1);
    expect(filtered.commits.length).toBeLessThan(all.commits.length);
    expect(filtered.commits[0]?.summary.toLowerCase()).toContain("leak");
  });

  it("filters by message keyword in summary", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      q: "scaffold",
    });

    expect(filtered.commits).toHaveLength(1);
    expect(filtered.commits[0]?.summary.toLowerCase()).toContain("scaffold");
  });

  it("filters by message keyword in full message body", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      q: "wire endpoint",
    });

    expect(filtered.commits.length).toBeGreaterThanOrEqual(1);
    for (const commit of filtered.commits) {
      expect(commit.summary.toLowerCase()).toContain("wire endpoint");
    }
  });

  it("bounds committedAt with after inclusive", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const all = listCommits(fixture.gitchangeDir, { limit: 50 });
    const pivot = all.commits.at(-1);
    expect(pivot).toBeDefined();

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      after: Math.floor((pivot?.committedAt ?? 0) / 1000),
    });

    expect(filtered.commits.length).toBeGreaterThan(0);
    for (const commit of filtered.commits) {
      expect(commit.committedAt).toBeGreaterThanOrEqual(pivot?.committedAt ?? 0);
    }
  });

  it("bounds committedAt with before inclusive", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const all = listCommits(fixture.gitchangeDir, { limit: 50 });
    const pivot = all.commits[0];
    expect(pivot).toBeDefined();

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      before: Math.floor((pivot?.committedAt ?? 0) / 1000),
    });

    expect(filtered.commits.length).toBeGreaterThan(0);
    for (const commit of filtered.commits) {
      expect(commit.committedAt).toBeLessThanOrEqual(pivot?.committedAt ?? 0);
    }
  });

  it("ANDs combined filters together", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const filters: CommitListFilters = {
      author: "fixture",
      path: "src/",
      q: "feature",
    };
    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      ...filters,
    });

    expect(filtered.commits.length).toBeGreaterThan(0);
    for (const commit of filtered.commits) {
      expect(commit.authorEmail.toLowerCase()).toContain("fixture");
      expect(commit.summary.toLowerCase()).toContain("feature");
    }
  });

  it("returns empty page when filters match nothing", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const filtered = listCommits(fixture.gitchangeDir, {
      limit: 50,
      author: "nobody@example.com",
    });

    expect(filtered.commits).toHaveLength(0);
    expect(filtered.nextCursor).toBeNull();
  });

  it("rejects non-finite after/before values", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    expect(() =>
      listCommits(fixture.gitchangeDir, { after: Number.NaN }),
    ).toThrow(InvalidCommitFilterError);
    expect(() =>
      listCommits(fixture.gitchangeDir, { before: Number.POSITIVE_INFINITY }),
    ).toThrow(InvalidCommitFilterError);
  });
});
