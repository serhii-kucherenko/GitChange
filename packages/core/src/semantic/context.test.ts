import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { buildEraSynthesisContext } from "./context.js";

describe("buildEraSynthesisContext", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("returns bounded context with era signals after index and computeIntelligence", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const context = buildEraSynthesisContext(gitchangeDir);

    expect(context.eraSignals.length).toBeGreaterThanOrEqual(1);
    expect(context.eraSignals.length).toBeLessThanOrEqual(8);

    for (const signal of context.eraSignals) {
      expect(signal.signalId).toBeGreaterThan(0);
      expect(signal.signalType).toBeTruthy();
      expect(signal.startCommitSha).toHaveLength(40);
      expect(signal.endCommitSha).toHaveLength(40);
    }

    expect(context.topChurnFiles.length).toBeLessThanOrEqual(10);
    expect(context.docDeltas.length).toBeLessThanOrEqual(5);
    for (const delta of context.docDeltas) {
      expect(delta.excerpt.length).toBeLessThanOrEqual(500);
      expect(delta.commitSha).toHaveLength(40);
    }

    expect(context.expertiseTopics.length).toBeLessThanOrEqual(5);
    expect(["complete", "degraded"]).toContain(context.attributionConfidence);
  });

  it("throws when intelligence.json is missing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    expect(() => buildEraSynthesisContext(gitchangeDir)).toThrow(
      /intelligence\.json not found/,
    );
  });
});
