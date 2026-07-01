import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { indexFull } from "../index/full.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import { checkIntelligenceIntegrity } from "./intelligence-integrity.js";

describe("checkIntelligenceIntegrity", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("passes on a clean BASIC_SCENARIO intelligence export", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const report = checkIntelligenceIntegrity(gitchangeDir);
    expect(report).toEqual({
      ok: true,
      errors: [],
      danglingCommitRefs: [],
      danglingFileRefs: [],
    });
  });

  it("detects a corrupted file evidence ref after tampering", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const intelligencePath = join(gitchangeDir, "intelligence.json");
    const artifact = IntelligenceArtifact.parse(
      JSON.parse(readFileSync(intelligencePath, "utf8")),
    );
    const fakeSha = "0".repeat(40);
    const fakePath = "nonexistent/corrupted.ts";

    if (artifact.churn.files[0]) {
      artifact.churn.files[0].evidence = [
        { type: "file", path: fakePath, commitSha: fakeSha },
      ];
    }

    writeFileSync(intelligencePath, `${JSON.stringify(artifact, null, 2)}\n`);

    const report = checkIntelligenceIntegrity(gitchangeDir);

    expect(report.ok).toBe(false);
    expect(report.danglingFileRefs).toContainEqual({
      path: fakePath,
      commitSha: fakeSha,
    });
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
