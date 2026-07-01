import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  EraClaim,
  ErasArtifact,
  InflectionPoint,
  NamedEra,
} from "../schema/zod/eras.js";
import { assembleAndWriteTemporalGraph } from "../semantic/graph-io.js";
import { writeErasArtifact } from "../semantic/eras-io.js";
import {
  checkErasIntegrity,
  checkSemanticIntegrity,
  checkTemporalGraphIntegrity,
} from "./semantic-integrity.js";

describe("checkErasIntegrity", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function indexWithEras() {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

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

    expect(mainTouch).toBeDefined();

    const first = commits[0]!;
    const last = commits[commits.length - 1]!;

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: last.sha,
        sourceSignalCount: 1,
        eras: [
          NamedEra.parse({
            id: "era:01HABC",
            name: "Bootstrap era",
            summary: "Initial scaffold through first merge.",
            startCommitSha: first.sha,
            endCommitSha: last.sha,
            startAt: first.committedAt,
            endAt: last.committedAt,
            signalIds: [1],
            inflections: [
              InflectionPoint.parse({
                type: "tech_pivot",
                title: "Entry module rename",
                description: "Renamed the main entry module during bootstrap.",
                evidence: [
                  {
                    type: "file",
                    path: mainTouch!.path,
                    commitSha: mainTouch!.commitSha,
                  },
                ],
              }),
            ],
            claims: [
              EraClaim.parse({
                text: "Core scaffold landed in early commits.",
                evidence: [{ type: "commit", sha: first.sha }],
              }),
            ],
            evidence: [
              { type: "commit", sha: first.sha },
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

    return { gitchangeDir, first, mainTouch: mainTouch! };
  }

  it("passes on valid BASIC_SCENARIO eras artifact", async () => {
    const { gitchangeDir } = await indexWithEras();

    const report = checkErasIntegrity(gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.danglingCommitRefs).toEqual([]);
    expect(report.danglingFileRefs).toEqual([]);
    expect(report.danglingSignalIds).toEqual([]);
  });

  it("detects dangling commit SHA in era evidence", async () => {
    const { gitchangeDir } = await indexWithEras();
    const fakeSha = "0".repeat(40);

    const erasPath = join(gitchangeDir, "eras.json");
    const artifact = ErasArtifact.parse(
      JSON.parse(readFileSync(erasPath, "utf8")),
    );
    artifact.eras[0]!.evidence = [{ type: "commit", sha: fakeSha }];
    writeFileSync(erasPath, `${JSON.stringify(artifact, null, 2)}\n`);

    const report = checkErasIntegrity(gitchangeDir);

    expect(report.ok).toBe(false);
    expect(report.danglingCommitRefs).toContain(fakeSha);
    expect(report.errors.some((e) => e.includes(fakeSha))).toBe(true);
  });

  it("detects invalid signalIds", async () => {
    const { gitchangeDir } = await indexWithEras();

    const erasPath = join(gitchangeDir, "eras.json");
    const artifact = ErasArtifact.parse(
      JSON.parse(readFileSync(erasPath, "utf8")),
    );
    artifact.eras[0]!.signalIds = [9999];
    writeFileSync(erasPath, `${JSON.stringify(artifact, null, 2)}\n`);

    const report = checkErasIntegrity(gitchangeDir);

    expect(report.ok).toBe(false);
    expect(report.danglingSignalIds).toContain(9999);
  });
});

describe("checkTemporalGraphIntegrity", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("passes on assembled BASIC_SCENARIO graph", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

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
        computedAt: "2026-07-01T00:00:00.000Z",
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
            inflections: [
              InflectionPoint.parse({
                type: "tech_pivot",
                title: "Pivot",
                description: "A pivot happened.",
                evidence: [
                  {
                    type: "file",
                    path: mainTouch!.path,
                    commitSha: mainTouch!.commitSha,
                  },
                ],
              }),
            ],
            claims: [
              EraClaim.parse({
                text: "Scaffold landed.",
                evidence: [{ type: "commit", sha: commits[0]!.sha }],
              }),
            ],
            evidence: [{ type: "commit", sha: commits[0]!.sha }],
          }),
        ],
      }),
    );

    assembleAndWriteTemporalGraph(gitchangeDir);

    const report = checkTemporalGraphIntegrity(gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("detects dangling edge node references", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

    const db = openDb(gitchangeDir);
    const commits = db
      .select()
      .from(schema.commits)
      .orderBy(schema.commits.committedAt)
      .all();

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T00:00:00.000Z",
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
            evidence: [{ type: "commit", sha: commits[0]!.sha }],
          }),
        ],
      }),
    );

    assembleAndWriteTemporalGraph(gitchangeDir);

    const graphPath = join(gitchangeDir, "temporal-graph.json");
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    graph.edges.push({
      id: "edge:fake",
      source: "era:01HABC",
      target: "commit:nonexistent",
      type: "era_contains_commit",
    });
    writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);

    const report = checkTemporalGraphIntegrity(gitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("commit:nonexistent"))).toBe(
      true,
    );
  });
});

describe("checkSemanticIntegrity", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("combines eras and graph checks on valid fixture", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    await indexFull({ repoPath: repo.dir, gitchangeDir });
    await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

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
        computedAt: "2026-07-01T00:00:00.000Z",
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

    assembleAndWriteTemporalGraph(gitchangeDir);

    const report = checkSemanticIntegrity(gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });
});
