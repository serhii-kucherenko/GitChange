import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { DECISIONS_SCHEMA_VERSION } from "../schema/zod/decisions.js";
import { buildDecisionMiningContext } from "./context.js";
import { readDecisionsArtifact } from "./decisions-io.js";
import { mergeDecisionMinerOutput } from "./merge-agent-output.js";

describe("mergeDecisionMinerOutput", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function indexedFixture() {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    return { repo, gitchangeDir };
  }

  function buildAgentOutput(
    gitchangeDir: string,
    overrides?: {
      candidateId?: string;
      evidence?: Array<{ type: "commit"; sha: string }>;
      supersededBy?: string;
      supersedes?: string[];
    },
  ) {
    const context = buildDecisionMiningContext(gitchangeDir);
    const candidate = context.candidates[0];
    expect(candidate).toBeDefined();

    const intelligence = JSON.parse(
      readFileSync(join(gitchangeDir, "intelligence.json"), "utf-8"),
    ) as { headSha: string };

    return {
      schemaVersion: DECISIONS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: intelligence.headSha,
      decisions: [
        {
          candidateId: overrides?.candidateId ?? candidate!.candidateId,
          id: "decision:01HABC",
          title: candidate!.title,
          summary: "Refactor decision backed by indexed evidence.",
          status: "accepted",
          confidence: 0.9,
          evidence: overrides?.evidence ?? candidate!.seedEvidence,
          relatedPaths: candidate!.relatedPaths,
          supersededBy: overrides?.supersededBy,
          supersedes: overrides?.supersedes,
        },
      ],
    };
  }

  it("merges valid agent output with attribution and pending review", async () => {
    const { gitchangeDir } = await indexedFixture();
    const agentJson = buildAgentOutput(gitchangeDir);

    const artifact = mergeDecisionMinerOutput(gitchangeDir, agentJson);

    expect(artifact.decisions).toHaveLength(1);
    expect(artifact.decisions[0]?.reviewStatus).toBe("pending");
    expect(artifact.decisions[0]?.miningSource).toBe("agent");
    expect(artifact.decisions[0]?.attribution).toBeDefined();
    expect(artifact.decisions[0]?.confidence).toBeLessThanOrEqual(0.65);

    const loaded = readDecisionsArtifact(gitchangeDir);
    expect(loaded?.decisions[0]?.id).toBe("decision:01HABC");
  });

  it("rejects unknown candidateId references", async () => {
    const { gitchangeDir } = await indexedFixture();
    const agentJson = buildAgentOutput(gitchangeDir, {
      candidateId: "candidate:unknown",
    });

    expect(() => mergeDecisionMinerOutput(gitchangeDir, agentJson)).toThrow(
      /unknown candidateId/,
    );
  });

  it("rejects decisions whose evidence SHAs are not in index", async () => {
    const { gitchangeDir } = await indexedFixture();
    const agentJson = buildAgentOutput(gitchangeDir, {
      evidence: [{ type: "commit", sha: "f".repeat(40) }],
    });

    expect(() => mergeDecisionMinerOutput(gitchangeDir, agentJson)).toThrow(
      /unindexed commit evidence/,
    );
  });

  it("rejects supersession cycles", async () => {
    const { gitchangeDir } = await indexedFixture();
    const context = buildDecisionMiningContext(gitchangeDir);
    const intelligence = JSON.parse(
      readFileSync(join(gitchangeDir, "intelligence.json"), "utf-8"),
    ) as { headSha: string };

    const candidate = context.candidates[0];
    expect(candidate).toBeDefined();

    const agentJson = {
      schemaVersion: DECISIONS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: intelligence.headSha,
      decisions: [
        {
          candidateId: candidate!.candidateId,
          id: "decision:01AAA",
          title: `${candidate!.title} (v1)`,
          summary: "First decision.",
          status: "superseded",
          confidence: 0.5,
          evidence: candidate!.seedEvidence,
          supersededBy: "decision:01BBB",
        },
        {
          candidateId: candidate!.candidateId,
          id: "decision:01BBB",
          title: `${candidate!.title} (v2)`,
          summary: "Second decision.",
          status: "superseded",
          confidence: 0.5,
          evidence: candidate!.seedEvidence,
          supersededBy: "decision:01AAA",
        },
      ],
    };

    expect(() => mergeDecisionMinerOutput(gitchangeDir, agentJson)).toThrow(
      /supersession cycle/,
    );
  });
});
