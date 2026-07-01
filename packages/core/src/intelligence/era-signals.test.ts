import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import { computeIntelligence } from "./compute.js";
import { computeEraSignals, getEraBoundarySignals } from "./era-signals.js";

describe("computeEraSignals", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("persists era boundaries with resolvable commit evidence for BASIC_SCENARIO", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const boundaryCount = computeEraSignals(db);

    expect(boundaryCount).toBeGreaterThanOrEqual(1);

    const rows = db.select().from(schema.eraBoundaries).all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(8);

    const indexedShas = new Set(
      db.select({ sha: schema.commits.sha }).from(schema.commits).all().map((r) => r.sha),
    );

    for (const row of rows) {
      expect(indexedShas.has(row.startCommitSha)).toBe(true);
      expect(indexedShas.has(row.endCommitSha)).toBe(true);
      expect(row.signalType).toBeTruthy();
      expect(row.score).toBeGreaterThan(0);

      const evidence = JSON.parse(row.evidenceJson) as Array<{
        type: string;
        sha?: string;
      }>;
      expect(evidence.length).toBeGreaterThanOrEqual(1);
      const commitRef = evidence.find((ref) => ref.type === "commit");
      expect(commitRef?.sha).toBeTruthy();
      expect(indexedShas.has(commitRef!.sha!)).toBe(true);
    }
  });

  it("exports eraSignals.boundaries via computeIntelligence", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const boundaries = getEraBoundarySignals(db);
    expect(boundaries.length).toBeGreaterThanOrEqual(1);
  });
});
