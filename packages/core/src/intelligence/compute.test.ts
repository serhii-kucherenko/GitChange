import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import { computeIntelligence } from "./compute.js";

describe("computeIntelligence", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("writes schema-valid intelligence.json with churn after indexFull", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const result = await computeIntelligence({
      repoPath: repo.dir,
      gitchangeDir,
    });

    const intelligencePath = join(gitchangeDir, "intelligence.json");
    expect(existsSync(intelligencePath)).toBe(true);

    const artifact = IntelligenceArtifact.parse(
      JSON.parse(readFileSync(intelligencePath, "utf8")),
    );

    expect(artifact.schemaVersion).toBeTruthy();
    expect(artifact.headSha).toBe(repo.headSha);
    expect(artifact.churn.files.length).toBeGreaterThanOrEqual(1);

    for (const file of artifact.churn.files) {
      expect(file.path).toBeTruthy();
      expect(file.changeCount).toBeGreaterThanOrEqual(1);
      expect(file.lastTouchedAt).toBeGreaterThan(0);
      expect(file.evidence.length).toBeGreaterThanOrEqual(1);
      expect(file.evidence.some((ref) => ref.type === "file")).toBe(true);
    }

    expect(result.churnFileCount).toBe(artifact.churn.files.length);
    expect(result.manifest.repo.head).toBe(repo.headSha);

    expect(artifact.coChange.edges.length).toBeGreaterThanOrEqual(1);
    for (const edge of artifact.coChange.edges) {
      expect(edge.relationship).toBe("co_change");
      expect(edge.disclaimer).toBe(
        "historical correlation, not import dependency",
      );
    }

    expect(artifact.eraSignals.boundaries.length).toBeGreaterThanOrEqual(1);
    for (const boundary of artifact.eraSignals.boundaries) {
      expect(boundary.evidence.length).toBeGreaterThanOrEqual(1);
      expect(boundary.startCommitSha).toHaveLength(40);
      expect(boundary.endCommitSha).toHaveLength(40);
    }

    const srcOwnership = artifact.ownership.files.filter((file) =>
      file.path.startsWith("src/"),
    );
    expect(srcOwnership.length).toBeGreaterThan(0);
    for (const file of srcOwnership) {
      expect(file.authors.length).toBeGreaterThan(0);
      expect(file.evidence.length).toBeGreaterThan(0);
      expect(file.evidence[0]?.commitSha).toBe(repo.headSha);
    }
  });
});
