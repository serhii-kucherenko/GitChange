import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { buildDecisionMiningContext } from "./context.js";

describe("buildDecisionMiningContext", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("returns bounded context after index and computeIntelligence", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const context = buildDecisionMiningContext(gitchangeDir);

    expect(context.candidates.length).toBeGreaterThanOrEqual(1);
    expect(context.candidates.length).toBeLessThanOrEqual(30);
    expect(context.topChurnFiles.length).toBeLessThanOrEqual(10);
    expect(context.docDeltas.length).toBeLessThanOrEqual(5);
    expect(context.expertiseTopics.length).toBeLessThanOrEqual(5);
    expect(["complete", "degraded"]).toContain(context.attributionConfidence);
  });

  it("throws when intelligence.json is missing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    expect(() => buildDecisionMiningContext(gitchangeDir)).toThrow(
      /intelligence\.json not found/,
    );
  });
});
