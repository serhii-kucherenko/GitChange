import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "../index/full.js";
import { computeIntelligence } from "../intelligence/compute.js";
import * as schema from "../schema/drizzle/schema.js";
import { EraClaim, ErasArtifact, NamedEra } from "../schema/zod/eras.js";
import { TemporalGraphArtifact } from "../schema/zod/temporal-graph.js";
import { writeErasArtifact } from "./eras-io.js";
import {
  assembleAndWriteTemporalGraph,
  readTemporalGraph,
  writeTemporalGraph,
} from "./graph-io.js";

describe("graph-io", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function prepareIndexedWithEras() {
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
    const first = commits[0]!;
    const last = commits[commits.length - 1]!;
    const mainTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "src/main.ts"))
      .all()[0]!;

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: last.sha,
        sourceSignalCount: 1,
        eras: [
          NamedEra.parse({
            id: "era:01HIO",
            name: "Bootstrap era",
            summary: "Fixture era for graph I/O.",
            startCommitSha: first.sha,
            endCommitSha: last.sha,
            startAt: first.committedAt,
            endAt: last.committedAt,
            signalIds: [1],
            inflections: [],
            claims: [
              EraClaim.parse({
                text: "Main module evolved during bootstrap.",
                evidence: [
                  {
                    type: "file",
                    path: mainTouch.path,
                    commitSha: mainTouch.commitSha,
                  },
                ],
              }),
            ],
            evidence: [
              { type: "commit", sha: first.sha },
              {
                type: "file",
                path: mainTouch.path,
                commitSha: mainTouch.commitSha,
              },
            ],
          }),
        ],
      }),
    );

    return { gitchangeDir };
  }

  it("returns null when temporal-graph.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-graph-"));

    try {
      expect(readTemporalGraph(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates before atomic write and round-trips through Zod", async () => {
    const { gitchangeDir } = await prepareIndexedWithEras();
    const graph = assembleAndWriteTemporalGraph(gitchangeDir);

    expect(existsSync(join(gitchangeDir, "temporal-graph.json"))).toBe(true);

    const loaded = readTemporalGraph(gitchangeDir);
    expect(loaded).toEqual(graph);
    expect(TemporalGraphArtifact.parse(loaded)).toEqual(graph);
  });

  it("rejects invalid artifacts at write time", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-graph-"));

    try {
      expect(() =>
        writeTemporalGraph(dir, {
          schemaVersion: "1",
          nodes: [{ id: "bad", type: "unknown" }],
          edges: [],
        } as never),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on corrupt JSON", async () => {
    const { gitchangeDir } = await prepareIndexedWithEras();
    assembleAndWriteTemporalGraph(gitchangeDir);

    const graphPath = join(gitchangeDir, "temporal-graph.json");
    const raw = readFileSync(graphPath, "utf-8").replace(
      '"schemaVersion"',
      '"broken"',
    );
    rmSync(graphPath);
    writeFileSync(graphPath, raw);

    expect(() => readTemporalGraph(gitchangeDir)).toThrow();
  });
});
