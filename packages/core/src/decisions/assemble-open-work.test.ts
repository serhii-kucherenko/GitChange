import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import * as schema from "../schema/drizzle/schema.js";
import { readManifest } from "../schema/manifest.js";
import { DecisionsArtifact } from "../schema/zod/decisions.js";
import { OpenWorkArtifact } from "../schema/zod/open-work.js";
import { assembleOpenWork } from "./assemble-open-work.js";
import { writeDecisionsArtifact } from "./decisions-io.js";
import { readOpenWorkArtifact } from "./open-work-io.js";

describe("assembleOpenWork", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function indexBasicScenario() {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });

    return { gitchangeDir };
  }

  function writeInFlightDecisions(gitchangeDir: string) {
    const db = openDb(gitchangeDir);
    const commits = db
      .select()
      .from(schema.commits)
      .orderBy(schema.commits.committedAt)
      .all();
    const featureTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "src/feature.ts"))
      .all()[0];

    writeDecisionsArtifact(
      gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T12:00:00.000Z",
        headSha: commits[commits.length - 1]!.sha,
        decisions: [
          {
            id: "decision:01HABC",
            title: "API feature rollout",
            summary: "Feature module migration still in flight.",
            status: "in_flight",
            confidence: 0.55,
            evidence: [{ type: "commit", sha: featureTouch!.commitSha }],
            reviewStatus: "pending",
            miningSource: "deterministic",
            relatedPaths: ["src/feature.ts"],
          },
        ],
      }),
    );
  }

  it("assembles open-work.json with at least one thread on BASIC_SCENARIO", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    writeInFlightDecisions(gitchangeDir);

    const artifact = assembleOpenWork(gitchangeDir);

    expect(artifact.threads.length).toBeGreaterThanOrEqual(1);
    expect(OpenWorkArtifact.parse(artifact)).toBeTruthy();

    const thread = artifact.threads[0]!;
    expect(thread.evidence.length).toBeGreaterThanOrEqual(1);
    expect(thread.confidence).toBeGreaterThanOrEqual(0);
    expect(thread.confidence).toBeLessThanOrEqual(1);
    expect(thread.events.length).toBeGreaterThanOrEqual(1);
    expect(thread.events[0]!.committedAt).toBeGreaterThanOrEqual(
      thread.events[thread.events.length - 1]!.committedAt,
    );

    const loaded = readOpenWorkArtifact(gitchangeDir);
    expect(loaded?.threads.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to deterministic candidates when no in_flight decisions exist", async () => {
    const { gitchangeDir } = await indexBasicScenario();

    const artifact = assembleOpenWork(gitchangeDir);

    expect(artifact.threads.length).toBeGreaterThanOrEqual(1);
    expect(readManifest(gitchangeDir)?.repo.head).toBe(artifact.headSha);
  });
});
