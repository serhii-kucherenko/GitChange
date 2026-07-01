import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import {
  readDecisionsArtifact,
  writeDecisionsArtifact,
} from "../decisions/decisions-io.js";
import { readOpenWorkArtifact } from "../decisions/open-work-io.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import * as schema from "../schema/drizzle/schema.js";
import { readManifest } from "../schema/manifest.js";
import { DecisionsArtifact } from "../schema/zod/decisions.js";
import { EraClaim, ErasArtifact, NamedEra } from "../schema/zod/eras.js";
import { OPEN_WORK_SCHEMA_VERSION } from "../schema/zod/open-work.js";
import { writeErasArtifact } from "./eras-io.js";
import { runDecisionsPipeline, runSemanticPipeline } from "./pipeline.js";

describe("runSemanticPipeline", () => {
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
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    return { gitchangeDir };
  }

  function writeValidEras(gitchangeDir: string) {
    const db = openDb(gitchangeDir);
    const commits = db
      .select()
      .from(schema.commits)
      .orderBy(schema.commits.committedAt)
      .all();
    const mainTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "src/main.ts"))
      .all()[0];

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T12:00:00.000Z",
        headSha: commits[commits.length - 1]!.sha,
        sourceSignalCount: 1,
        eras: [
          NamedEra.parse({
            id: "era:01HABC",
            name: "Bootstrap era",
            summary: "Initial scaffold.",
            startCommitSha: commits[0]!.sha,
            endCommitSha: commits[commits.length - 1]!.sha,
            startAt: commits[0]!.committedAt,
            endAt: commits[commits.length - 1]!.committedAt,
            signalIds: [1],
            inflections: [],
            claims: [
              EraClaim.parse({
                text: "Scaffold landed.",
                evidence: [{ type: "commit", sha: commits[0]!.sha }],
              }),
            ],
            evidence: [
              { type: "commit", sha: commits[0]!.sha },
              {
                type: "file",
                path: mainTouch!.path,
                commitSha: mainTouch!.commitSha,
              },
            ],
          }),
        ],
      }),
    );
  }

  it("throws when eras.json is missing", async () => {
    const { gitchangeDir } = await indexBasicScenario();

    expect(() => runSemanticPipeline(gitchangeDir)).toThrow(/eras\.json/);
  });

  it("sets semantic checkpoint on successful pipeline run", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    writeValidEras(gitchangeDir);

    const result = runSemanticPipeline(gitchangeDir);
    expect(result).toEqual({ ok: true });

    const manifest = readManifest(gitchangeDir);
    expect(manifest?.semanticComputedAt).toBe("2026-07-01T12:00:00.000Z");
    expect(manifest?.semanticHeadSha).toHaveLength(40);
    expect(manifest?.semanticSchemaVersion).toBe("1");
  });

  it("throws on integrity failure without setting semantic checkpoint", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    writeValidEras(gitchangeDir);

    const erasPath = join(gitchangeDir, "eras.json");
    const artifact = ErasArtifact.parse(
      JSON.parse(readFileSync(erasPath, "utf8")),
    );
    artifact.eras[0]!.evidence = [{ type: "commit", sha: "0".repeat(40) }];
    writeFileSync(erasPath, `${JSON.stringify(artifact, null, 2)}\n`);

    expect(() => runSemanticPipeline(gitchangeDir)).toThrow(
      /Semantic integrity check failed/,
    );

    const manifest = readManifest(gitchangeDir);
    expect(manifest?.semanticComputedAt).toBeUndefined();
    expect(manifest?.semanticHeadSha).toBeUndefined();
    expect(manifest?.semanticSchemaVersion).toBeUndefined();
  });
});

describe("runDecisionsPipeline", () => {
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
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    return { gitchangeDir };
  }

  function writeValidEras(gitchangeDir: string) {
    const db = openDb(gitchangeDir);
    const commits = db
      .select()
      .from(schema.commits)
      .orderBy(schema.commits.committedAt)
      .all();
    const mainTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "src/main.ts"))
      .all()[0];

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T12:00:00.000Z",
        headSha: commits[commits.length - 1]!.sha,
        sourceSignalCount: 1,
        eras: [
          NamedEra.parse({
            id: "era:01HABC",
            name: "Bootstrap era",
            summary: "Initial scaffold.",
            startCommitSha: commits[0]!.sha,
            endCommitSha: commits[commits.length - 1]!.sha,
            startAt: commits[0]!.committedAt,
            endAt: commits[commits.length - 1]!.committedAt,
            signalIds: [1],
            inflections: [],
            claims: [
              EraClaim.parse({
                text: "Scaffold landed.",
                evidence: [{ type: "commit", sha: commits[0]!.sha }],
              }),
            ],
            evidence: [
              { type: "commit", sha: commits[0]!.sha },
              {
                type: "file",
                path: mainTouch!.path,
                commitSha: mainTouch!.commitSha,
              },
            ],
          }),
        ],
      }),
    );
  }

  function writeValidDecisions(gitchangeDir: string) {
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
        computedAt: "2026-07-01T13:00:00.000Z",
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

  it("throws when decisions.json is missing", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    writeValidEras(gitchangeDir);

    expect(() => runDecisionsPipeline(gitchangeDir)).toThrow(/decisions\.json/);
  });

  it("produces open-work.json and updates manifest checkpoints", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    writeValidEras(gitchangeDir);
    writeValidDecisions(gitchangeDir);

    const result = runDecisionsPipeline(gitchangeDir);
    expect(result).toEqual({ ok: true });

    const openWork = readOpenWorkArtifact(gitchangeDir);
    expect(openWork?.threads.length).toBeGreaterThanOrEqual(1);

    const manifest = readManifest(gitchangeDir);
    expect(manifest?.decisionsComputedAt).toBe("2026-07-01T13:00:00.000Z");
    expect(manifest?.openWorkComputedAt).toBeTruthy();
    expect(manifest?.decisionsSchemaVersion).toBe("1");
    expect(manifest?.openWorkSchemaVersion).toBe(OPEN_WORK_SCHEMA_VERSION);
  });
});
