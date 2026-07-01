import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  ChurnFileEntry,
  IntelligenceArtifact,
} from "../schema/zod/intelligence.js";
import { computeChurn } from "./churn.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";

describe("isIntelligenceIgnoredPath", () => {
  it("ignores lockfiles and generated paths", () => {
    expect(isIntelligenceIgnoredPath("package-lock.json")).toBe(true);
    expect(isIntelligenceIgnoredPath("vendor/foo/bar.go")).toBe(true);
    expect(isIntelligenceIgnoredPath("src/main.ts")).toBe(false);
  });
});

describe("computeChurn", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("aggregates file_changes into file_churn excluding ignored paths", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const churnCount = computeChurn(db);

    expect(churnCount).toBeGreaterThanOrEqual(1);

    const churnRows = db.select().from(schema.fileChurn).all();
    expect(churnRows.length).toBe(churnCount);
    expect(churnRows.some((row) => row.path === "src/main.ts")).toBe(true);
    expect(churnRows.some((row) => row.path === ".env")).toBe(false);

    for (const row of churnRows) {
      expect(row.changeCount).toBeGreaterThanOrEqual(1);
      expect(row.lastTouchedAt).toBeGreaterThan(0);

      const evidence = JSON.parse(row.evidenceJson) as Array<{
        type: string;
        path?: string;
        commitSha?: string;
      }>;
      expect(evidence.length).toBeGreaterThanOrEqual(1);
      expect(evidence[0]?.type).toBe("file");
      expect(evidence[0]?.path).toBe(row.path);
    }
  });

  it("parses a churn-only IntelligenceArtifact sample", () => {
    const sample = IntelligenceArtifact.parse({
      schemaVersion: "1",
      computedAt: new Date().toISOString(),
      headSha: "a".repeat(40),
      attributionConfidence: "complete",
      churn: {
        files: [
          ChurnFileEntry.parse({
            path: "src/main.ts",
            changeCount: 2,
            insertions: 1,
            deletions: 0,
            lastTouchedAt: Date.now(),
            evidence: [
              { type: "file", path: "src/main.ts", commitSha: "b".repeat(40) },
            ],
          }),
        ],
      },
      coChange: { edges: [] },
      ownership: { files: [] },
      eraSignals: { boundaries: [] },
      expertise: { profiles: [] },
    });

    expect(sample.churn.files).toHaveLength(1);
    expect(sample.churn.files[0]?.evidence).toHaveLength(1);
  });
});
