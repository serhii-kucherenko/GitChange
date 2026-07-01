import { describe, expect, it } from "vitest";
import { CommitRecord } from "./zod/commit.js";
import { DocSnapshot } from "./zod/doc-snapshot.js";
import { Evidence } from "./zod/evidence.js";
import { FileChangeRecord } from "./zod/file-change.js";

const SHA = "a".repeat(40);

const fileEvidence = {
  type: "file" as const,
  path: "src/index.ts",
  commitSha: SHA,
};

const commitEvidence = {
  type: "commit" as const,
  sha: SHA,
};

describe("Evidence", () => {
  it("accepts commit refs with 40-char sha", () => {
    expect(Evidence.parse(commitEvidence)).toEqual(commitEvidence);
  });

  it("rejects commit refs with sha length !== 40", () => {
    expect(() =>
      Evidence.parse({ type: "commit", sha: "abc" }),
    ).toThrow();
  });

  it("accepts file refs with 40-char commitSha", () => {
    expect(Evidence.parse(fileEvidence)).toEqual(fileEvidence);
  });

  it("rejects hunk refs (reserved, not implemented)", () => {
    expect(() =>
      Evidence.parse({
        type: "hunk",
        path: "src/index.ts",
        commitSha: SHA,
        startLine: 1,
        endLine: 10,
      }),
    ).toThrow();
  });
});

describe("FileChangeRecord", () => {
  const base = {
    commitSha: SHA,
    path: "src/index.ts",
    oldPath: null,
    changeType: "modified" as const,
    isBinary: false,
    contentIgnored: false,
    contentRedacted: false,
  };

  it("requires at least one evidence entry", () => {
    expect(() => FileChangeRecord.parse({ ...base, evidence: [] })).toThrow();
  });

  it("rejects missing evidence", () => {
    expect(() => FileChangeRecord.parse(base)).toThrow();
  });

  it("accepts valid narrative records", () => {
    expect(
      FileChangeRecord.parse({ ...base, evidence: [fileEvidence] }),
    ).toMatchObject({ evidence: [fileEvidence] });
  });
});

describe("DocSnapshot", () => {
  const base = {
    path: "README.md",
    commitSha: SHA,
    contentHash: "deadbeef",
  };

  it("requires at least one evidence entry", () => {
    expect(() => DocSnapshot.parse({ ...base, content: null, evidence: [] })).toThrow();
  });

  it("rejects missing evidence", () => {
    expect(() => DocSnapshot.parse({ ...base, content: "hello" })).toThrow();
  });

  it("allows null content while requiring evidence", () => {
    expect(
      DocSnapshot.parse({ ...base, content: null, evidence: [fileEvidence] }),
    ).toMatchObject({ content: null, evidence: [fileEvidence] });
  });
});

describe("CommitRecord", () => {
  it("is an evidence source without an evidence[] field", () => {
    const record = CommitRecord.parse({
      sha: SHA,
      authorName: "Ada",
      authorEmail: "ada@example.com",
      committerName: "Ada",
      committerEmail: "ada@example.com",
      authoredAt: 1,
      committedAt: 2,
      summary: "feat: init",
      message: "feat: init",
      isMerge: false,
      parentCount: 1,
      parents: [SHA],
    });

    expect(record).not.toHaveProperty("evidence");
  });
});
