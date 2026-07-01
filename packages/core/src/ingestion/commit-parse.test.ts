import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openRepo, parseCommit, walkFromHead } from "./index.js";

const FIXTURE_AUTHOR = {
  name: "GitChange Fixture",
  email: "fixture@gitchange.test",
};
const FIXTURE_BASE_MS = Date.parse("2024-01-15T12:00:00.000Z");

describe("parseCommit", () => {
  it("parses author, committer, timestamps, summary, and message for the root commit", async () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const rootSha = repo.commitShas[0];
      const record = parseCommit(gitRepo, rootSha);

      expect(record.sha).toBe(rootSha);
      expect(record.authorName).toBe(FIXTURE_AUTHOR.name);
      expect(record.authorEmail).toBe(FIXTURE_AUTHOR.email);
      expect(record.committerName).toBe(FIXTURE_AUTHOR.name);
      expect(record.committerEmail).toBe(FIXTURE_AUTHOR.email);
      expect(record.authoredAt).toBe(FIXTURE_BASE_MS);
      expect(record.committedAt).toBe(FIXTURE_BASE_MS);
      expect(record.summary).toBe("feat(core): initial scaffold");
      expect(record.message).toBe("feat(core): initial scaffold\n");
      expect(record.parentCount).toBe(0);
      expect(record.parents).toEqual([]);
      expect(record.isMerge).toBe(false);
      expect(record.conventional).toEqual({
        type: "feat",
        scope: "core",
        breaking: undefined,
      });
    } finally {
      repo.cleanup();
    }
  });

  it("marks merge commits with two parents", async () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const mergeSha = repo.headSha;
      const record = parseCommit(gitRepo, mergeSha);

      expect(record.isMerge).toBe(true);
      expect(record.parentCount).toBe(2);
      expect(record.parents).toHaveLength(2);
    } finally {
      repo.cleanup();
    }
  });

  it("leaves conventional fields undefined for non-conventional messages", async () => {
    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const mergeSha = repo.headSha;
      const record = parseCommit(gitRepo, mergeSha);

      expect(record.message).toContain("Merge branch");
      expect(record.conventional).toBeUndefined();
    } finally {
      repo.cleanup();
    }
  });
});

describe("walkFromHead", () => {
  it("streams SHAs newest to oldest without materializing the full list", async () => {
    const source = readFileSync(new URL("./git-walk.ts", import.meta.url), "utf8");
    expect(source).toMatch(/function\* iterateRevwalk|yield sha/);

    const repo = buildRepo(BASIC_SCENARIO);

    try {
      const gitRepo = await openRepo(repo.dir);
      const walked: string[] = [];
      for (const sha of walkFromHead(gitRepo)) {
        walked.push(sha);
      }

      expect(walked[0]).toBe(repo.headSha);
      expect(walked.at(-1)).toBe(repo.commitShas[0]);
      expect(walked.length).toBe(repo.commitShas.length);
    } finally {
      repo.cleanup();
    }
  });
});
