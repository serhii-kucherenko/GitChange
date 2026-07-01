import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { extractDecisionCandidates } from "./candidates.js";

describe("extractDecisionCandidates", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("yields at least one candidate from BASIC_SCENARIO", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const candidates = extractDecisionCandidates(gitchangeDir);

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(60);

    for (const candidate of candidates) {
      expect(candidate.candidateId).toMatch(/^candidate:/);
      expect(candidate.title.length).toBeGreaterThan(0);
      expect(candidate.seedEvidence.length).toBeGreaterThanOrEqual(1);
      expect(candidate.sourceSignals.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("excludes merge commits from candidates", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const candidates = extractDecisionCandidates(gitchangeDir);
    const mergeCandidate = candidates.find((candidate) =>
      candidate.title.toLowerCase().includes("merge branch"),
    );

    expect(mergeCandidate).toBeUndefined();
  });

  it("excludes chore-only noise commits", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const candidates = extractDecisionCandidates(gitchangeDir);
    const choreCandidate = candidates.find((candidate) =>
      candidate.title.toLowerCase().includes("add ignored env"),
    );

    expect(choreCandidate).toBeUndefined();
  });
});
