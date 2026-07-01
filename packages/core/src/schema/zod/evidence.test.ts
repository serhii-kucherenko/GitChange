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
});
