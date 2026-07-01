import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../packages/core/src/artifacts/db.js";
import * as schema from "../../packages/core/src/schema/drizzle/schema.js";
import {
  findSecretPrefixesInIndexedText,
  grepSecretPrefixesInSqliteFiles,
} from "../../packages/core/src/verify/secret-audit.js";
import { indexBasicScenario } from "./helpers.js";

describe("golden: secret leakage (PRIV-02)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("stores no secret prefixes in built SQLite bytes or text columns", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const rawHits = grepSecretPrefixesInSqliteFiles(fixture.gitchangeDir);
    const textHits = findSecretPrefixesInIndexedText(db);

    expect(rawHits).toEqual([]);
    expect(textHits).toEqual([]);
  });

  it("records metadata-only secret findings for message and doc sources", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const findings = db.select().from(schema.secretFindings).all();

    const messageFinding = findings.find((row) => row.location === "message");
    const docFinding = findings.find(
      (row) => row.location === "doc" && row.filePath === "docs/leak.md",
    );

    expect(messageFinding).toBeDefined();
    expect(messageFinding?.ruleId).toBe("github_pat");
    expect(docFinding).toBeDefined();
    expect(docFinding?.ruleId).toBe("aws_access_key");

    for (const finding of findings) {
      expect(Object.keys(finding)).toEqual(
        expect.arrayContaining(["id", "commitSha", "filePath", "ruleId", "location"]),
      );
      const serialized = JSON.stringify(finding);
      expect(serialized).not.toMatch(/AKIA|ghp_|sk-|BEGIN PRIVATE KEY/u);
    }

    expect(findings.some((row) => row.filePath === ".env")).toBe(false);
  });

  it("keeps secret-bearing commits indexed and drops ignored .env content", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const db = openDb(fixture.gitchangeDir);
    const messageFinding = db
      .select()
      .from(schema.secretFindings)
      .all()
      .find((row) => row.location === "message");
    expect(messageFinding).toBeDefined();

    const secretCommit = db
      .select()
      .from(schema.commits)
      .all()
      .find((row) => row.sha === messageFinding?.commitSha);
    expect(secretCommit).toBeDefined();

    const envChange = db
      .select()
      .from(schema.fileChanges)
      .all()
      .find((row) => row.path === ".env");
    expect(envChange).toBeDefined();
    expect(envChange?.contentIgnored).toBe(true);

    const envDoc = db
      .select()
      .from(schema.docSnapshots)
      .all()
      .find((row) => row.path === ".env");
    expect(envDoc).toBeUndefined();

    const sqliteBytes = readFileSync(join(fixture.gitchangeDir, "index.sqlite"));
    expect(sqliteBytes.includes(Buffer.from("ghp_ignored"))).toBe(false);
  });
});
