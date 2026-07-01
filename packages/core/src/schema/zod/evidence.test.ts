import { describe, expect, it } from "vitest";
import { Evidence } from "./evidence.js";

const SHA = "a".repeat(40);

describe("Evidence", () => {
  it("accepts commit evidence", () => {
    const parsed = Evidence.parse({ type: "commit", sha: SHA });
    expect(parsed.type).toBe("commit");
  });

  it("accepts file evidence", () => {
    const parsed = Evidence.parse({
      type: "file",
      path: "src/index.ts",
      commitSha: SHA,
    });
    expect(parsed.path).toBe("src/index.ts");
  });

  it("accepts doc evidence with excerpt up to 500 chars", () => {
    const excerpt = "x".repeat(500);
    const parsed = Evidence.parse({
      type: "doc",
      path: "README.md",
      commitSha: SHA,
      excerpt,
    });
    expect(parsed.type).toBe("doc");
    expect(parsed.excerpt).toHaveLength(500);
  });

  it("rejects doc evidence excerpt over 500 chars", () => {
    expect(() =>
      Evidence.parse({
        type: "doc",
        path: "README.md",
        commitSha: SHA,
        excerpt: "x".repeat(501),
      }),
    ).toThrow();
  });

  it("round-trips doc evidence through JSON", () => {
    const input = {
      type: "doc" as const,
      path: "docs/adr-001.md",
      commitSha: SHA,
      excerpt: "We chose SQLite for local-first indexing.",
    };
    const roundTripped = Evidence.parse(JSON.parse(JSON.stringify(input)));
    expect(roundTripped).toEqual(input);
  });

  it("accepts interview evidence with path under interviews/", () => {
    const input = {
      type: "interview" as const,
      path: "interviews/01HINT.json",
      recordedAt: "2026-07-01T12:00:00.000Z",
      excerpt: "Maintainer confirmed the SQLite pivot.",
    };
    const parsed = Evidence.parse(input);
    expect(parsed.type).toBe("interview");
    expect(parsed.path).toBe("interviews/01HINT.json");
  });

  it("round-trips interview evidence through JSON", () => {
    const input = {
      type: "interview" as const,
      path: "interviews/abc123.json",
      recordedAt: "2026-07-01T00:00:00.000Z",
      excerpt: "We deferred multi-repo support.",
    };
    const roundTripped = Evidence.parse(JSON.parse(JSON.stringify(input)));
    expect(roundTripped).toEqual(input);
  });

  it("rejects interview path outside interviews/", () => {
    expect(() =>
      Evidence.parse({
        type: "interview",
        path: "../secrets.json",
        recordedAt: "2026-07-01T00:00:00.000Z",
        excerpt: "leak",
      }),
    ).toThrow();
  });

  it("rejects interview excerpt over 500 chars", () => {
    expect(() =>
      Evidence.parse({
        type: "interview",
        path: "interviews/x.json",
        recordedAt: "2026-07-01T00:00:00.000Z",
        excerpt: "x".repeat(501),
      }),
    ).toThrow();
  });
});
