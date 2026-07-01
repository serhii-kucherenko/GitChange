import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import {
  EXPERTISE_SCENARIO,
  OWNERSHIP_ALICE,
  OWNERSHIP_BOB,
} from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import { computeIntelligence } from "./compute.js";
import { computeExpertise, getExpertiseExport } from "./expertise.js";

describe("computeExpertise", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("ranks Alice top for auth topic with resolvable evidence", async () => {
    const repo = buildRepo(EXPERTISE_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const rowCount = computeExpertise(db);
    expect(rowCount).toBeGreaterThan(0);

    const authors = db.select().from(schema.authors).all();
    const alice = authors.find((a) => a.email === OWNERSHIP_ALICE.authorEmail);
    const bob = authors.find((a) => a.email === OWNERSHIP_BOB.authorEmail);
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();

    const authTopicRows = db
      .select()
      .from(schema.contributorExpertise)
      .all()
      .filter((row) => row.topic === "auth" || row.topic === "src/auth");

    expect(authTopicRows.length).toBeGreaterThan(0);

    const aliceRow = authTopicRows.find((row) => row.authorId === alice!.id);
    expect(aliceRow).toBeDefined();
    expect(aliceRow!.score).toBeGreaterThan(0);

    const bobRow = authTopicRows.find((row) => row.authorId === bob!.id);
    if (bobRow) {
      expect(aliceRow!.score).toBeGreaterThanOrEqual(bobRow.score);
    }

    const indexedShas = new Set(
      db.select({ sha: schema.commits.sha }).from(schema.commits).all().map((r) => r.sha),
    );

    for (const row of authTopicRows) {
      const evidence = JSON.parse(row.evidenceJson) as Array<{
        type: string;
        sha?: string;
        path?: string;
        commitSha?: string;
      }>;
      expect(evidence.length).toBeGreaterThanOrEqual(1);
      const fileRef = evidence.find((ref) => ref.type === "file");
      expect(fileRef?.path).toMatch(/^src\/auth\//);
      const commitSha = fileRef?.commitSha ?? evidence.find((r) => r.type === "commit")?.sha;
      expect(commitSha).toBeTruthy();
      expect(indexedShas.has(commitSha!)).toBe(true);
    }
  });

  it("exports expertise.topics via computeIntelligence", async () => {
    const repo = buildRepo(EXPERTISE_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const intelligencePath = join(gitchangeDir, "intelligence.json");
    expect(existsSync(intelligencePath)).toBe(true);

    const artifact = IntelligenceArtifact.parse(
      JSON.parse(readFileSync(intelligencePath, "utf8")),
    );

    expect(artifact.expertise.topics.length).toBeGreaterThan(0);

    const authTopic = artifact.expertise.topics.find(
      (topic) => topic.topic === "auth" || topic.topic === "src/auth",
    );
    expect(authTopic).toBeDefined();
    expect(authTopic!.suggestedContributors.length).toBeGreaterThan(0);

    const topContributor = authTopic!.suggestedContributors[0]!;
    expect(topContributor.email).toBe(OWNERSHIP_ALICE.authorEmail);
    expect(topContributor.evidence.length).toBeGreaterThanOrEqual(1);
    expect(topContributor.rationale).toBeTruthy();
  });

  it("rejects expertise records without evidence in Zod export parse", () => {
    const invalid = {
      schemaVersion: "1",
      computedAt: new Date().toISOString(),
      headSha: "a".repeat(40),
      attributionConfidence: "complete",
      churn: { files: [] },
      coChange: { edges: [] },
      ownership: { files: [] },
      eraSignals: { boundaries: [] },
      eraOwnership: { eras: [] },
      expertise: {
        topics: [
          {
            topic: "auth",
            suggestedContributors: [
              {
                authorId: 1,
                name: "Alice",
                email: "alice@test",
                score: 0.9,
                rationale: "top commits",
                evidence: [],
              },
            ],
          },
        ],
      },
    };

    expect(() => IntelligenceArtifact.parse(invalid)).toThrow();
  });

  it("getExpertiseExport returns topics with evidence", async () => {
    const repo = buildRepo(EXPERTISE_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    computeExpertise(db);

    const exported = getExpertiseExport(db);
    expect(exported.topics.length).toBeGreaterThan(0);
    for (const topic of exported.topics) {
      for (const contributor of topic.suggestedContributors) {
        expect(contributor.evidence.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
