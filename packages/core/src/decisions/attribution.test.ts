import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import * as schema from "../schema/drizzle/schema.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import {
  capInferredConfidence,
  INFERRED_MEDIUM_CONFIDENCE_CAP,
  resolveDecisionAttribution,
} from "./attribution.js";

describe("resolveDecisionAttribution", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("picks primary author from evidence commit SHAs", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const intelligence = IntelligenceArtifact.parse(
      JSON.parse(
        readFileSync(join(gitchangeDir, "intelligence.json"), "utf-8"),
      ),
    );

    const commitRow = db
      .select()
      .from(schema.commits)
      .all()
      .find((row) => row.summary.includes("refactor"));

    expect(commitRow).toBeDefined();

    const attribution = resolveDecisionAttribution(
      db,
      {
        evidence: [{ type: "commit", sha: commitRow!.sha }],
        relatedPaths: ["src/main.ts"],
      },
      intelligence,
    );

    expect(attribution).toBeDefined();
    expect(attribution?.authorId).toBeGreaterThan(0);
    expect(attribution?.name.length).toBeGreaterThan(0);
    expect(attribution?.email.length).toBeGreaterThan(0);
    expect(attribution?.rationale.length).toBeGreaterThan(0);
    expect(attribution?.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("returns undefined when evidence has no commit refs", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const intelligence = IntelligenceArtifact.parse(
      JSON.parse(
        readFileSync(join(gitchangeDir, "intelligence.json"), "utf-8"),
      ),
    );

    const attribution = resolveDecisionAttribution(
      db,
      {
        evidence: [
          {
            type: "interview",
            path: "interviews/test.json",
            recordedAt: "2026-07-01T00:00:00.000Z",
            excerpt: "confirmed migration",
          },
        ],
        relatedPaths: [],
      },
      intelligence,
    );

    expect(attribution).toBeUndefined();
  });
});

describe("capInferredConfidence", () => {
  it("caps confidence without interview evidence", () => {
    expect(
      capInferredConfidence(0.9, [{ type: "commit", sha: "a".repeat(40) }]),
    ).toBe(INFERRED_MEDIUM_CONFIDENCE_CAP);
  });

  it("preserves confidence when interview evidence is present", () => {
    expect(
      capInferredConfidence(0.9, [
        {
          type: "interview",
          path: "interviews/test.json",
          recordedAt: "2026-07-01T00:00:00.000Z",
          excerpt: "confirmed",
        },
      ]),
    ).toBe(0.9);
  });
});
