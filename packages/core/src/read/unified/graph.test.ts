import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ManifestSchema } from "../../schema/manifest.js";
import { SEMANTIC_SCHEMA_VERSION } from "../../schema/zod/eras.js";
import { TemporalGraphArtifact } from "../../schema/zod/temporal-graph.js";
import { writeWorkspace } from "../../workspace/workspace-io.js";
import { readGraphUnified } from "./graph.js";
import { resolveWorkspaceContext } from "./workspace-context.js";

const SHA = "a".repeat(40);

function writeMinimalManifest(gitchangeDir: string, repoId: string): void {
  mkdirSync(gitchangeDir, { recursive: true });
  writeFileSync(
    join(gitchangeDir, "manifest.json"),
    `${JSON.stringify(
      ManifestSchema.parse({
        schemaVersion: "1",
        repoId,
        lastIndexedCommit: SHA,
        indexedAt: "2026-07-01T00:00:00.000Z",
        repo: { head: SHA, branch: "main" },
        indexCompleteness: "complete",
        warnings: [],
      }),
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(gitchangeDir, "index.sqlite"), "");
}

function seedGraph(gitchangeDir: string, eraId: string): void {
  writeGraphArtifact(gitchangeDir, eraId);
}

function writeGraphArtifact(gitchangeDir: string, eraId: string): void {
  writeFileSync(
    join(gitchangeDir, "temporal-graph.json"),
    `${JSON.stringify(
      TemporalGraphArtifact.parse({
        schemaVersion: SEMANTIC_SCHEMA_VERSION,
        nodes: [
          { id: eraId, type: "era" },
          { id: SHA, type: "commit" },
        ],
        edges: [
          {
            id: "edge-1",
            source: eraId,
            target: SHA,
            type: "era_contains_commit",
          },
        ],
      }),
      null,
      2,
    )}\n`,
  );
}

describe("readGraphUnified", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  function seedWorkspace() {
    const root = mkdtempSync(join(tmpdir(), "gitchange-unified-graph-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const alphaDir = join(root, "alpha", ".gitchange");
    const betaDir = join(root, "beta", ".gitchange");
    const workspaceDir = join(root, "workspace", ".gitchange");

    writeMinimalManifest(alphaDir, "alpha");
    writeMinimalManifest(betaDir, "beta");
    seedGraph(alphaDir, "era:alpha");
    seedGraph(betaDir, "era:beta");

    writeWorkspace(workspaceDir, {
      schemaVersion: "1",
      primaryRepoId: "alpha",
      repos: [
        {
          repoId: "alpha",
          label: "Alpha",
          repoPath: join(root, "alpha"),
          gitchangeDir: alphaDir,
        },
        {
          repoId: "beta",
          label: "Beta",
          repoPath: join(root, "beta"),
          gitchangeDir: betaDir,
        },
      ],
      links: [],
    });

    return resolveWorkspaceContext(workspaceDir);
  }

  it("merges graphs with repoId on nodes and prefixed ids", () => {
    const ctx = seedWorkspace();
    const graph = readGraphUnified(ctx);

    expect(graph).not.toBeNull();
    expect(graph!.nodes).toHaveLength(4);
    expect(graph!.nodes.map((node) => node.id).sort()).toEqual(
      [
        "alpha:era:alpha",
        `alpha:${SHA}`,
        "beta:era:beta",
        `beta:${SHA}`,
      ].sort(),
    );
    expect(graph!.nodes.every((node) => node.repoId)).toBe(true);
  });

  it("filters to a single repo when repoId is provided", () => {
    const ctx = seedWorkspace();
    const graph = readGraphUnified(ctx, { repoId: "alpha" });

    expect(graph!.nodes).toHaveLength(2);
    expect(graph!.nodes.every((node) => node.repoId === "alpha")).toBe(true);
    expect(graph!.nodes[0]?.id.startsWith("alpha:")).toBe(true);
  });

  it("delegates to single-repo readGraph without prefixes", () => {
    const root = mkdtempSync(join(tmpdir(), "gitchange-unified-graph-single-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const gitchangeDir = join(root, ".gitchange");
    writeMinimalManifest(gitchangeDir, "solo");
    seedGraph(gitchangeDir, "era:solo");

    const ctx = resolveWorkspaceContext(gitchangeDir);
    const graph = readGraphUnified(ctx);

    expect(graph!.nodes[0]?.id).toBe("era:solo");
    expect(graph!.nodes[0]?.repoId).toBeUndefined();
  });

  it("returns null when no graph artifacts exist", () => {
    const root = mkdtempSync(join(tmpdir(), "gitchange-unified-graph-empty-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const gitchangeDir = join(root, ".gitchange");
    writeMinimalManifest(gitchangeDir, "solo");

    const ctx = resolveWorkspaceContext(gitchangeDir);
    expect(readGraphUnified(ctx)).toBeNull();
  });
});
