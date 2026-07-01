import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ManifestSchema,
  SEMANTIC_SCHEMA_VERSION,
  TemporalGraphArtifact,
  writeWorkspace,
} from "@gitchange/core";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const SHA = "a".repeat(40);
const GRAPH_ROUTE_FILE = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "graph.ts",
);

function writeMinimalManifest(gitchangeDir: string, repoId = "default"): void {
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
  writeMinimalManifest(gitchangeDir);
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

describe("graph routes", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns 404 when temporal-graph.json is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-graph-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/graph");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "graph_not_available" });
  });

  it("returns graph from fixture", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-graph-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedGraph(dir, "era:01");

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/graph");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nodes).toHaveLength(2);
    expect(body.nodes[0]).toMatchObject({ id: "era:01", type: "era" });
  });

  it("filters graph by repoId in workspace mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "gitchange-graph-route-ws-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const alphaDir = join(root, "alpha", ".gitchange");
    const betaDir = join(root, "beta", ".gitchange");
    const workspaceDir = join(root, "workspace", ".gitchange");

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

    const app = createApp({ gitchangeDir: workspaceDir });
    const response = await app.request("/api/graph?repoId=beta");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nodes).toHaveLength(2);
    expect(body.nodes.every((node: { repoId?: string }) => node.repoId === "beta")).toBe(
      true,
    );
  });

  it("has zero es-git imports in graph route file", () => {
    const content = readFileSync(GRAPH_ROUTE_FILE, "utf-8");
    expect(/from\s+["']es-git["']/.test(content)).toBe(false);
    expect(/import\s*\(\s*["']es-git["']\s*\)/.test(content)).toBe(false);
  });
});
