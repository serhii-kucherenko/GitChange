import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo, type CommitSpec } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import { computeCoChange, getCoChangeEdges } from "./cochange.js";

const COCHANGE_PAIR_SCENARIO: CommitSpec[] = [
  {
    message: "feat: add paired modules",
    files: {
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 1;\n",
    },
  },
];

const LOCKFILE_SCENARIO: CommitSpec[] = [
  {
    message: "init",
    files: { "src/a.ts": "export const a = 1;\n" },
  },
  {
    message: "chore: lockfile bump",
    files: {
      "package-lock.json": '{ "lockfileVersion": 1 }\n',
      "src/a.ts": "export const a = 2;\n",
    },
  },
  {
    message: "feat: add b",
    files: {
      "src/a.ts": "export const a = 3;\n",
      "src/b.ts": "export const b = 1;\n",
    },
  },
];

const DECAY_SCENARIO: CommitSpec[] = [
  {
    message: "old co-change",
    committedAt: new Date("2023-01-01T12:00:00.000Z"),
    files: {
      "src/old1.ts": "export const o1 = 1;\n",
      "src/old2.ts": "export const o2 = 1;\n",
    },
  },
  {
    message: "recent co-change",
    committedAt: new Date("2024-06-01T12:00:00.000Z"),
    files: {
      "src/new1.ts": "export const n1 = 1;\n",
      "src/new2.ts": "export const n2 = 1;\n",
    },
  },
];

describe("computeCoChange", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function indexScenario(scenario: CommitSpec[]) {
    const repo = buildRepo(scenario);
    repos.push(repo);
    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    return { repo, gitchangeDir };
  }

  it("creates co-change edge when a commit touches multiple source files", async () => {
    const { gitchangeDir } = await indexScenario(COCHANGE_PAIR_SCENARIO);
    const db = openDb(gitchangeDir);

    computeCoChange(db);

    const edges = db.select().from(schema.coChangeEdges).all();
    expect(edges.some((e) => e.pathA === "src/a.ts" && e.pathB === "src/b.ts")).toBe(
      true,
    );
    const pair = edges.find((e) => e.pathA === "src/a.ts" && e.pathB === "src/b.ts");
    expect(pair?.coOccurrence).toBeGreaterThanOrEqual(1);
  });

  it("excludes lockfiles from co-change edges", async () => {
    const { gitchangeDir } = await indexScenario(LOCKFILE_SCENARIO);
    const db = openDb(gitchangeDir);

    computeCoChange(db);

    const edges = db.select().from(schema.coChangeEdges).all();
    expect(edges.some((e) => e.pathA.includes("lock") || e.pathB.includes("lock"))).toBe(
      false,
    );
    expect(edges.some((e) => e.pathA === "src/a.ts" && e.pathB === "src/b.ts")).toBe(
      true,
    );
  });

  it("applies temporal decay so older co-changes have lower weight", async () => {
    const { gitchangeDir } = await indexScenario(DECAY_SCENARIO);
    const db = openDb(gitchangeDir);
    const referenceAt = new Date("2024-06-15T12:00:00.000Z").getTime();

    computeCoChange(db, { halfLifeDays: 180, referenceAt });

    const edges = db.select().from(schema.coChangeEdges).all();
    const oldEdge = edges.find(
      (e) => e.pathA === "src/old1.ts" && e.pathB === "src/old2.ts",
    );
    const recentEdge = edges.find(
      (e) => e.pathA === "src/new1.ts" && e.pathB === "src/new2.ts",
    );

    expect(oldEdge).toBeDefined();
    expect(recentEdge).toBeDefined();
    expect(oldEdge!.coOccurrence).toBe(recentEdge!.coOccurrence);
    expect(oldEdge!.weight).toBeLessThan(recentEdge!.weight);
  });

  it("detects co-change pairs in BASIC_SCENARIO multi-file commits", async () => {
    const { gitchangeDir } = await indexScenario(BASIC_SCENARIO);
    const db = openDb(gitchangeDir);

    computeCoChange(db);

    const edges = getCoChangeEdges(db);
    expect(edges.length).toBeGreaterThanOrEqual(1);
    for (const edge of edges) {
      expect(edge.relationship).toBe("co_change");
      expect(edge.disclaimer).toBe(
        "historical correlation, not import dependency",
      );
    }
  });
});
