import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { openDb } from "../artifacts/db.js";
import { indexFull } from "./full.js";
import * as schema from "../schema/drizzle/schema.js";
import { ManifestSchema } from "../schema/manifest.js";

describe("indexFull", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
    vi.restoreAllMocks();
  });

  it("indexes BASIC_SCENARIO into schema-valid .gitchange artifacts", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitchangeDir = join(repo.dir, ".gitchange");
    const result = await indexFull({ repoPath: repo.dir, gitchangeDir });

    expect(existsSync(join(gitchangeDir, "index.sqlite"))).toBe(true);
    expect(existsSync(join(gitchangeDir, "manifest.json"))).toBe(true);

    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(join(gitchangeDir, "manifest.json"), "utf8")),
    );
    expect(manifest.indexCompleteness).toBe("complete");
    expect(manifest.lastIndexedCommit).toBe(repo.headSha);
    expect(manifest.repo.head).toBe(repo.headSha);
    expect(result.manifest.lastIndexedCommit).toBe(repo.headSha);

    const db = openDb(gitchangeDir);
    const commitCount = db.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
    const authorCount = db.select({ value: count() }).from(schema.authors).get()?.value ?? 0;
    const fileChangeCount =
      db.select({ value: count() }).from(schema.fileChanges).get()?.value ?? 0;

    expect(commitCount).toBe(repo.commitShas.length);
    expect(authorCount).toBeGreaterThan(0);
    expect(fileChangeCount).toBeGreaterThan(0);

    const evidenceRows = db.select().from(schema.fileChanges).all();
    for (const row of evidenceRows) {
      const evidence = JSON.parse(row.evidenceJson) as Array<{
        type: string;
        path?: string;
        commitSha?: string;
      }>;
      expect(evidence.length).toBeGreaterThan(0);
      for (const ref of evidence) {
        if (ref.type === "file") {
          expect(repo.commitShas).toContain(ref.commitSha);
          expect(row.path).toBe(ref.path);
        }
      }
    }
  });

  it("adds .gitchange/ to .gitignore on first index (idempotent)", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const gitignorePath = join(repo.dir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(false);

    await indexFull({ repoPath: repo.dir });
    expect(readFileSync(gitignorePath, "utf8")).toContain(".gitchange/");

    const before = readFileSync(gitignorePath, "utf8");
    await indexFull({ repoPath: repo.dir });
    expect(readFileSync(gitignorePath, "utf8")).toBe(before);
  });

  it("does not use the network during indexing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as typeof fetch;

    try {
      await indexFull({ repoPath: repo.dir });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("produces a stable manifest HEAD on repeated full indexes", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const first = await indexFull({ repoPath: repo.dir });
    const second = await indexFull({ repoPath: repo.dir });

    expect(second.manifest.lastIndexedCommit).toBe(first.manifest.lastIndexedCommit);
    expect(second.manifest.repo.head).toBe(repo.headSha);
  });
});
