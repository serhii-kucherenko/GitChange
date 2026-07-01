import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../../tests/fixtures/scenarios.js";
import {
  addRepo,
  loadWorkspaceContext,
  readWorkspace,
} from "../../workspace/workspace-io.js";
import { indexWorkspace } from "../../workspace/index-workspace.js";
import { indexFull } from "../../index/full.js";
import {
  compareUnifiedCommits,
  decodeUnifiedCommitCursor,
  encodeUnifiedCommitCursor,
  listCommitsUnified,
} from "./commits.js";
import { resolveWorkspaceContext } from "./workspace-context.js";

describe("compareUnifiedCommits sort key", () => {
  it("orders by committedAt desc, repoId asc, sha desc", () => {
    const base = {
      summary: "x",
      authorName: "a",
      authorEmail: "a@b.c",
    };

    const newer = {
      ...base,
      sha: "b".repeat(40),
      committedAt: 2_000,
      repoId: "beta",
    };
    const olderSameTimeHigherRepo = {
      ...base,
      sha: "a".repeat(40),
      committedAt: 1_000,
      repoId: "beta",
    };
    const olderSameTimeLowerRepo = {
      ...base,
      sha: "c".repeat(40),
      committedAt: 1_000,
      repoId: "alpha",
    };

    const sorted = [newer, olderSameTimeLowerRepo, olderSameTimeHigherRepo].sort(
      compareUnifiedCommits,
    );

    expect(sorted.map((item) => [item.committedAt, item.repoId, item.sha[0]])).toEqual([
      [2_000, "beta", "b"],
      [1_000, "alpha", "c"],
      [1_000, "beta", "a"],
    ]);
  });
});

describe("listCommitsUnified", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function buildTwoRepoWorkspace() {
    const primary = buildRepo(BASIC_SCENARIO);
    const secondary = buildRepo(BASIC_SCENARIO);
    repos.push(primary, secondary);

    let workspace = addRepo(loadWorkspaceContext(primary.dir), {
      repoPath: primary.dir,
      label: "Primary",
      repoId: "alpha",
    });

    workspace = addRepo(
      {
        cwd: primary.dir,
        workspace,
        workspaceGitchangeDir: join(primary.dir, ".gitchange"),
      },
      {
        repoPath: secondary.dir,
        label: "Secondary",
        repoId: "beta",
      },
    );

    const workspaceGitchangeDir = join(primary.dir, ".gitchange");
    const loaded = readWorkspace(workspaceGitchangeDir)!;
    await indexWorkspace(loaded);

    return {
      workspaceGitchangeDir,
      ctx: resolveWorkspaceContext(workspaceGitchangeDir),
    };
  }

  it("returns commits from both repos with distinct repoId fields", async () => {
    const { ctx } = await buildTwoRepoWorkspace();
    const page = listCommitsUnified(ctx, { limit: 200 });

    expect(page.commits.length).toBeGreaterThan(0);
    const repoIds = new Set(page.commits.map((commit) => commit.repoId));
    expect(repoIds).toEqual(new Set(["alpha", "beta"]));

    for (const commit of page.commits) {
      expect(commit.repoId).toBeTruthy();
      expect(commit.sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("sorts merged commits by committedAt desc with repoId tiebreaker", async () => {
    const { ctx } = await buildTwoRepoWorkspace();
    const page = listCommitsUnified(ctx, { limit: 200 });

    for (let index = 1; index < page.commits.length; index += 1) {
      const previous = page.commits[index - 1]!;
      const current = page.commits[index]!;
      expect(previous.committedAt).toBeGreaterThanOrEqual(current.committedAt);
      if (previous.committedAt === current.committedAt) {
        expect(
          (previous.repoId ?? "").localeCompare(current.repoId ?? ""),
        ).toBeLessThanOrEqual(0);
        if (previous.repoId === current.repoId) {
          expect(previous.sha.localeCompare(current.sha)).toBeGreaterThanOrEqual(
            0,
          );
        }
      }
    }
  });

  it("filters commits to a single repo when repoId is set", async () => {
    const { ctx } = await buildTwoRepoWorkspace();
    const filtered = listCommitsUnified(ctx, { repoId: "alpha", limit: 200 });

    expect(filtered.commits.length).toBeGreaterThan(0);
    for (const commit of filtered.commits) {
      expect(commit.repoId).toBe("alpha");
    }
  });

  it("omits repoId for single-repo workspaces", async () => {
    const primary = buildRepo(BASIC_SCENARIO);
    repos.push(primary);

    const gitchangeDir = join(primary.dir, ".gitchange");
    await indexFull({ repoPath: primary.dir, gitchangeDir });

    const ctx = resolveWorkspaceContext(gitchangeDir);
    const page = listCommitsUnified(ctx, { limit: 10 });

    expect(page.commits.length).toBeGreaterThan(0);
    for (const commit of page.commits) {
      expect(commit.repoId).toBeUndefined();
    }
  });

  it("round-trips unified cursor encoding", () => {
    const cursor = encodeUnifiedCommitCursor(1_700_000_000, "alpha", "a".repeat(40));
    expect(decodeUnifiedCommitCursor(cursor)).toEqual({
      committedAt: 1_700_000_000,
      repoId: "alpha",
      sha: "a".repeat(40),
    });
  });
});
