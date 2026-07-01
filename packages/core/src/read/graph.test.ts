import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SEMANTIC_SCHEMA_VERSION } from "../schema/zod/eras.js";
import { TemporalGraphArtifact } from "../schema/zod/temporal-graph.js";
import { readGraph } from "./graph.js";

const SHA = "a".repeat(40);
const SHA_B = "b".repeat(40);

function writeGraph(
  gitchangeDir: string,
  artifact: ReturnType<typeof TemporalGraphArtifact.parse>,
): void {
  mkdirSync(gitchangeDir, { recursive: true });
  writeFileSync(
    join(gitchangeDir, "temporal-graph.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
}

function sampleArtifact() {
  return TemporalGraphArtifact.parse({
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    nodes: [
      { id: "era:01", type: "era" },
      { id: SHA, type: "commit" },
      { id: "inflection:01", type: "inflection" },
    ],
    edges: [
      {
        id: "edge-era-commit",
        source: "era:01",
        target: SHA,
        type: "era_contains_commit",
      },
      {
        id: "edge-era-inflection",
        source: "era:01",
        target: "inflection:01",
        type: "era_has_inflection",
      },
    ],
  });
}

describe("readGraph", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when temporal-graph.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-graph-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    expect(readGraph(dir)).toBeNull();
  });

  it("maps nodes to API DTOs with drill targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-graph-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeGraph(dir, sampleArtifact());

    const result = readGraph(dir);
    expect(result).not.toBeNull();

    const era = result!.nodes.find((node) => node.type === "era");
    expect(era).toMatchObject({
      id: "era:01",
      data: { eraId: "era:01" },
    });

    const commit = result!.nodes.find((node) => node.type === "commit");
    expect(commit).toMatchObject({
      id: SHA,
      data: { commitSha: SHA },
    });

    const inflection = result!.nodes.find((node) => node.type === "inflection");
    expect(inflection?.data.parentEraId).toBe("era:01");
    expect(result!.edges).toHaveLength(2);
  });

  it("does not attach repoId in single-repo read", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-graph-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeGraph(
      dir,
      TemporalGraphArtifact.parse({
        schemaVersion: SEMANTIC_SCHEMA_VERSION,
        nodes: [{ id: SHA_B, type: "commit" }],
        edges: [],
      }),
    );

    const result = readGraph(dir);
    expect(result!.nodes[0]?.repoId).toBeUndefined();
  });
});
