import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeDecisionsArtifact } from "../decisions/decisions-io.js";
import { writeOpenWorkArtifact } from "../decisions/open-work-io.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../schema/zod/decisions.js";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "../schema/zod/open-work.js";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { buildTourSynthesisContext } from "./context.js";

describe("buildTourSynthesisContext", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("returns bounded context from indexed artifacts without live git", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    applyBasicScenarioErasFixture(gitchangeDir);

    const sha = (
      await import("../read/commits.js")
    ).listCommits(gitchangeDir, { limit: 1 })?.commits[0]?.sha;
    expect(sha).toBeDefined();

    writeDecisionsArtifact(
      gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha!,
        decisions: [
          DecisionRecord.parse({
            id: "decision:01GOOD",
            title: "Indexed decision",
            summary: "Above threshold.",
            status: "accepted",
            confidence: 0.8,
            evidence: [{ type: "commit", sha: sha! }],
            reviewStatus: "pending",
            miningSource: "deterministic",
          }),
        ],
      }),
    );

    writeOpenWorkArtifact(
      gitchangeDir,
      OpenWorkArtifact.parse({
        schemaVersion: OPEN_WORK_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha!,
        threads: [
          OpenWorkThread.parse({
            id: "thread:01OPEN",
            kind: "wip",
            status: "open",
            title: "Open thread",
            summary: "Fixture thread.",
            confidence: 0.6,
            relatedPaths: ["src/main.ts"],
            events: [
              {
                commitSha: sha!,
                committedAt: 1_700_000_000_000,
                summary: "Touch main",
                paths: ["src/main.ts"],
              },
            ],
            evidence: [{ type: "commit", sha: sha! }],
          }),
        ],
      }),
    );

    const context = buildTourSynthesisContext(gitchangeDir);

    expect(context.eraSummaries.length).toBeGreaterThanOrEqual(1);
    expect(context.outlineChapters.length).toBeGreaterThanOrEqual(4);
    expect(context.outlineChapters.length).toBeLessThanOrEqual(6);
    expect(context.decisionSeeds.length).toBeLessThanOrEqual(8);
    expect(context.openWorkSeeds.length).toBeLessThanOrEqual(5);
    expect(context.expertiseTopics.length).toBeLessThanOrEqual(10);
    expect(context.headSha).toHaveLength(40);
    expect(context.capsReminder.maxDefaultTours).toBe(1);
    expect(context.rolePathHints.backend.length).toBeGreaterThanOrEqual(0);
    expect(context.rolePathHints.frontend.length).toBeGreaterThanOrEqual(0);
  });

  it("excludes decisions below the evidence threshold", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    applyBasicScenarioErasFixture(gitchangeDir);

    const sha = (
      await import("../read/commits.js")
    ).listCommits(gitchangeDir, { limit: 1 })?.commits[0]?.sha;

    writeDecisionsArtifact(
      gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha!,
        decisions: [
          DecisionRecord.parse({
            id: "decision:01LOW",
            title: "Low confidence",
            summary: "Below threshold.",
            status: "proposed",
            confidence: 0.1,
            evidence: [{ type: "commit", sha: sha! }],
            reviewStatus: "pending",
            miningSource: "manual",
          }),
          DecisionRecord.parse({
            id: "decision:01HIGH",
            title: "High confidence",
            summary: "Above threshold.",
            status: "accepted",
            confidence: 0.9,
            evidence: [{ type: "commit", sha: sha! }],
            reviewStatus: "pending",
            miningSource: "deterministic",
          }),
        ],
      }),
    );

    const context = buildTourSynthesisContext(gitchangeDir);

    expect(context.decisionSeeds.map((seed) => seed.id)).toContain(
      "decision:01HIGH",
    );
    expect(context.decisionSeeds.map((seed) => seed.id)).not.toContain(
      "decision:01LOW",
    );
  });
});
