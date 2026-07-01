import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_GITCHANGEIGNORE } from "./default-gitchangeignore.js";
import { createIgnoreMatcher, loadIgnore } from "./gitchangeignore.js";

describe("DEFAULT_GITCHANGEIGNORE", () => {
  it("includes all five D-10 patterns", () => {
    expect(DEFAULT_GITCHANGEIGNORE).toEqual([
      ".env*",
      "**/secrets/**",
      "*credentials*",
      "*.pem",
      "*.key",
    ]);
  });
});

describe("createIgnoreMatcher", () => {
  const matcher = createIgnoreMatcher([...DEFAULT_GITCHANGEIGNORE]);

  it("ignores .env at repo root", () => {
    expect(matcher.isIgnored(".env")).toBe(true);
  });

  it("does not ignore ordinary source paths", () => {
    expect(matcher.isIgnored("src/app.ts")).toBe(false);
  });

  it("ignores .pem files in nested directories", () => {
    expect(matcher.isIgnored("config/prod.pem")).toBe(true);
  });

  it("ignores paths under secrets directories", () => {
    expect(matcher.isIgnored("deploy/secrets/api.key")).toBe(true);
  });

  it("honors negation patterns with last-match-wins ordering", () => {
    const withNegation = createIgnoreMatcher([".env*", "!keep.env"]);
    expect(withNegation.isIgnored(".env")).toBe(true);
    expect(withNegation.isIgnored("keep.env")).toBe(false);
  });
});

describe("loadIgnore", () => {
  it("falls back to the default template when no repo file exists", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "gitchange-ignore-"));
    const matcher = loadIgnore(repoRoot);
    expect(matcher.isIgnored(".env")).toBe(true);
    expect(matcher.isIgnored("src/app.ts")).toBe(false);
  });

  it("prefers repo .gitchangeignore over the default template", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "gitchange-ignore-"));
    writeFileSync(
      join(repoRoot, ".gitchangeignore"),
      "# comment line\n\nonly-this.txt\n",
      "utf8",
    );
    const matcher = loadIgnore(repoRoot);
    expect(matcher.isIgnored("only-this.txt")).toBe(true);
    expect(matcher.isIgnored(".env")).toBe(false);
  });
});
