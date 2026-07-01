import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createWriter } from "./writer.js";
import * as schema from "../schema/drizzle/schema.js";
import type { CommitRecord } from "../schema/zod/commit.js";
import type { DocSnapshot } from "../schema/zod/doc-snapshot.js";
import type { FileChangeRecord } from "../schema/zod/file-change.js";

const SAMPLE_COMMIT: CommitRecord = {
  sha: "a".repeat(40),
  authorName: "Author",
  authorEmail: "author@example.com",
  committerName: "Committer",
  committerEmail: "committer@example.com",
  authoredAt: 1_700_000_000_000,
  committedAt: 1_700_000_000_000,
  summary: "feat: sample",
  message: "feat: sample",
  isMerge: false,
  parentCount: 0,
  parents: [],
};

const SAMPLE_FILE_CHANGE: FileChangeRecord = {
  commitSha: SAMPLE_COMMIT.sha,
  path: "README.md",
  oldPath: null,
  changeType: "added",
  isBinary: false,
  contentIgnored: false,
  contentRedacted: false,
  evidence: [{ type: "file", path: "README.md", commitSha: SAMPLE_COMMIT.sha }],
};

const SAMPLE_DOC_SNAPSHOT: DocSnapshot = {
  commitSha: SAMPLE_COMMIT.sha,
  path: "README.md",
  contentHash: "abc123",
  content: "# Hello",
  evidence: [{ type: "file", path: "README.md", commitSha: SAMPLE_COMMIT.sha }],
};

describe("openDb", () => {
  let gitchangeDir = "";

  afterEach(() => {
    if (gitchangeDir) {
      rmSync(gitchangeDir, { recursive: true, force: true });
      gitchangeDir = "";
    }
  });

  it("creates WAL-mode sqlite under the gitchange directory", () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-db-"));
    const db = openDb(gitchangeDir);
    const journalMode = db.$client
      .prepare("PRAGMA journal_mode")
      .pluck()
      .get() as string;
    expect(journalMode.toLowerCase()).toBe("wal");
    expect(
      db.$client.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(),
    ).not.toHaveLength(0);
  });
});

describe("createWriter", () => {
  let gitchangeDir = "";

  afterEach(() => {
    if (gitchangeDir) {
      rmSync(gitchangeDir, { recursive: true, force: true });
      gitchangeDir = "";
    }
  });

  it("deduplicates authors by name and email", () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-writer-"));
    const db = openDb(gitchangeDir);
    const writer = createWriter(db, 100);

    writer.addCommit(SAMPLE_COMMIT);
    writer.addCommit({
      ...SAMPLE_COMMIT,
      sha: "b".repeat(40),
      summary: "chore: second",
      message: "chore: second",
    });
    writer.flush();

    const authorCount = db.select({ value: count() }).from(schema.authors).get()?.value ?? 0;
    expect(authorCount).toBe(2);
  });

  it("rejects file changes without evidence before buffering", () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-writer-"));
    const db = openDb(gitchangeDir);
    const writer = createWriter(db, 100);

    expect(() =>
      writer.addFileChange({
        ...SAMPLE_FILE_CHANGE,
        evidence: [],
      }),
    ).toThrow();
  });

  it("rejects doc snapshots without evidence before buffering", () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-writer-"));
    const db = openDb(gitchangeDir);
    const writer = createWriter(db, 100);

    expect(() =>
      writer.addDocSnapshot({
        ...SAMPLE_DOC_SNAPSHOT,
        evidence: [],
      }),
    ).toThrow();
  });

  it("flushes buffered rows in a batched transaction", () => {
    gitchangeDir = mkdtempSync(join(tmpdir(), "gitchange-writer-"));
    const db = openDb(gitchangeDir);
    const writer = createWriter(db, 1);

    writer.addCommit(SAMPLE_COMMIT);
    writer.addFileChange(SAMPLE_FILE_CHANGE);
    writer.flush();

    const commitRow = db
      .select()
      .from(schema.commits)
      .where(eq(schema.commits.sha, SAMPLE_COMMIT.sha))
      .get();
    expect(commitRow?.summary).toBe("feat: sample");

    const fileChangeRow = db
      .select()
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.commitSha, SAMPLE_COMMIT.sha))
      .get();
    expect(JSON.parse(fileChangeRow?.evidenceJson ?? "[]")).toEqual(SAMPLE_FILE_CHANGE.evidence);
  });
});
