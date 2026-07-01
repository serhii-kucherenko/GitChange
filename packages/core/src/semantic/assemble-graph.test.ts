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
import { assembleTemporalGraph } from "./assemble-graph.js";
import { readErasArtifact, writeErasArtifact } from "./eras-io.js";

describe("assembleTemporalGraph", () => {
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

    return { repo, gitchangeDir };
  }

  function buildErasFixture(
    commits: Array<{ sha: string; committedAt: number }>,
    fileEvidence: { path: string; commitSha: string },
  ): ErasArtifact {
    const ordered = [...commits].sort((a, b) => a.committedAt - b.committedAt);
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;

    const inflection = InflectionPoint.parse({
      type: "tech_pivot",
      title: "Entry module rename",
      description: "Renamed the main entry module during bootstrap.",
      evidence: [
        {
          type: "file",
          path: fileEvidence.path,
          commitSha: fileEvidence.commitSha,
        },
      ],
    });

    const era = NamedEra.parse({
      id: "era:01HABC",
      name: "Bootstrap era",
      summary: "Initial scaffold through first merge.",
      startCommitSha: first.sha,
      endCommitSha: last.sha,
      startAt: first.committedAt,
      endAt: last.committedAt,
      signalIds: [1],
      inflections: [inflection],
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
          path: fileEvidence.path,
          commitSha: fileEvidence.commitSha,
        },
      ],
    });

    return ErasArtifact.parse({
      schemaVersion: "1",
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: last.sha,
      sourceSignalCount: 1,
      eras: [era],
    });
  }

  it("throws when eras.json is missing", async () => {
    const { gitchangeDir } = await indexBasicScenario();

    expect(() => assembleTemporalGraph(gitchangeDir)).toThrow(/eras\.json/);
  });

  it("assembles era, commit, inflection nodes with era links on BASIC_SCENARIO", async () => {
    const { gitchangeDir } = await indexBasicScenario();
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

    writeErasArtifact(
      gitchangeDir,
      buildErasFixture(commits, {
        path: mainTouch!.path,
        commitSha: mainTouch!.commitSha,
      }),
    );

    const graph = assembleTemporalGraph(gitchangeDir);

    expect(readErasArtifact(gitchangeDir)?.eras).toHaveLength(1);
    expect(graph.schemaVersion).toBe("1");
    expect(graph.nodes.length).toBeLessThanOrEqual(500);

    const eraNode = graph.nodes.find(
      (node) => node.id === "era:01HABC" && node.type === "era",
    );
    expect(eraNode).toBeDefined();

    const inflectionNodes = graph.nodes.filter(
      (node) => node.type === "inflection",
    );
    expect(inflectionNodes).toHaveLength(1);
    expect(inflectionNodes[0]?.id).toMatch(/^inflection:/);

    const commitNodes = graph.nodes.filter((node) => node.type === "commit");
    expect(commitNodes.length).toBeGreaterThanOrEqual(1);

    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "era_contains_commit" &&
          edge.source === "era:01HABC" &&
          commitNodes.some((node) => node.id === edge.target),
      ),
    ).toBe(true);

    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "era_has_inflection" &&
          edge.source === "era:01HABC" &&
          edge.target === inflectionNodes[0]?.id,
      ),
    ).toBe(true);
  });

  it("adds contributor and file nodes with co-change disclaimer metadata", async () => {
    const { gitchangeDir } = await indexBasicScenario();
    const db = openDb(gitchangeDir);

    const commits = db
      .select()
      .from(schema.commits)
      .orderBy(schema.commits.committedAt)
      .all();
    const readmeTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "README.md"))
      .all()[0];
    const indexTouch = db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.path, "src/main.ts"))
      .all()[0];

    expect(readmeTouch).toBeDefined();
    expect(indexTouch).toBeDefined();

    const era = NamedEra.parse({
      id: "era:01HFILES",
      name: "Multi-file bootstrap",
      summary: "Tracks README and main entry evidence.",
      startCommitSha: commits[0]!.sha,
      endCommitSha: commits[commits.length - 1]!.sha,
      startAt: commits[0]!.committedAt,
      endAt: commits[commits.length - 1]!.committedAt,
      signalIds: [1],
      inflections: [],
      claims: [
        EraClaim.parse({
          text: "README and main module co-evolved.",
          evidence: [
            {
              type: "file",
              path: readmeTouch!.path,
              commitSha: readmeTouch!.commitSha,
            },
          ],
        }),
      ],
      evidence: [
        {
          type: "file",
          path: readmeTouch!.path,
          commitSha: readmeTouch!.commitSha,
        },
        {
          type: "file",
          path: indexTouch!.path,
          commitSha: indexTouch!.commitSha,
        },
      ],
    });

    writeErasArtifact(
      gitchangeDir,
      ErasArtifact.parse({
        schemaVersion: "1",
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: commits[commits.length - 1]!.sha,
        sourceSignalCount: 1,
        eras: [era],
      }),
    );

    const graph = assembleTemporalGraph(gitchangeDir);

    expect(graph.nodes.some((node) => node.type === "contributor")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "file:README.md")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "file:src/main.ts")).toBe(
      true,
    );

    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "commit_touches_file" &&
          edge.target === "file:README.md",
      ),
    ).toBe(true);

    const coChangeEdge = graph.edges.find(
      (edge) => edge.type === "files_co_changed",
    );
    if (coChangeEdge) {
      expect(coChangeEdge.disclaimer).toBe(
        "historical correlation, not import dependency",
      );
    }
  });
});
