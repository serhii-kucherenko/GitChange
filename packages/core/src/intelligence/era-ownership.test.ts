import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import {
  ERA_OWNERSHIP_SCENARIO,
  OWNERSHIP_ALICE,
  OWNERSHIP_BOB,
} from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import { computeEraSignals } from "./era-signals.js";
import { computeEraOwnership, getEraOwnershipExport } from "./era-ownership.js";

/**
 * Era ownership uses a commit-window proxy: sum of add/modify/rename touches per
 * author per era per path. Full historical blame per era is deferred to Phase 8.
 */
describe("computeEraOwnership", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("shows Alice dominant in an early era and Bob gaining share in a later era", async () => {
    const repo = buildRepo(ERA_OWNERSHIP_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const boundaryCount = computeEraSignals(db);
    expect(boundaryCount).toBeGreaterThanOrEqual(1);

    const rowCount = computeEraOwnership(db);
    expect(rowCount).toBeGreaterThan(0);

    const authors = db.select().from(schema.authors).all();
    const alice = authors.find((a) => a.email === OWNERSHIP_ALICE.authorEmail);
    const bob = authors.find((a) => a.email === OWNERSHIP_BOB.authorEmail);
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();

    const ownershipRows = db.select().from(schema.eraOwnership).all();
    const sharedRows = ownershipRows.filter((row) => row.path === "src/lib/shared.ts");
    expect(sharedRows.length).toBeGreaterThan(0);

    const byEra = new Map<number, typeof sharedRows>();
    for (const row of sharedRows) {
      const eraRows = byEra.get(row.eraId) ?? [];
      eraRows.push(row);
      byEra.set(row.eraId, eraRows);
    }

    expect(byEra.size).toBeGreaterThanOrEqual(2);

    const eraDominant = [...byEra.entries()].map(([eraId, rows]) => {
      const top = [...rows].sort((a, b) => b.percentage - a.percentage)[0]!;
      return { eraId, authorId: top.authorId, percentage: top.percentage };
    });

    const aliceEra = eraDominant.find((entry) => entry.authorId === alice!.id);
    const bobEra = eraDominant.find((entry) => entry.authorId === bob!.id);
    expect(aliceEra).toBeDefined();
    expect(bobEra).toBeDefined();
    expect(aliceEra!.eraId).not.toBe(bobEra!.eraId);

    for (const row of sharedRows) {
      const evidence = JSON.parse(row.evidenceJson) as Array<{
        type: string;
        sha?: string;
        path?: string;
        commitSha?: string;
      }>;
      expect(evidence.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exports eraOwnership.eras with labels and per-file authors", async () => {
    const repo = buildRepo(ERA_OWNERSHIP_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    computeEraSignals(db);
    computeEraOwnership(db);

    const exported = getEraOwnershipExport(db);
    expect(exported.eras.length).toBeGreaterThanOrEqual(1);

    for (const era of exported.eras) {
      expect(era.label).toBeTruthy();
      expect(era.eraId).toBeGreaterThan(0);
      for (const file of era.files) {
        expect(file.authors.length).toBeGreaterThan(0);
        const totalPct = file.authors.reduce((sum, author) => sum + author.percentage, 0);
        expect(totalPct).toBeGreaterThan(0);
      }
    }
  });
});
