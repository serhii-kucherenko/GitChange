import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRepo, shallowCloneOf } from "../../../../tests/fixtures/builder.js";
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
    const docSnapshotCount =
      db.select({ value: count() }).from(schema.docSnapshots).get()?.value ?? 0;

    expect(commitCount).toBe(repo.commitShas.length);
    expect(authorCount).toBeGreaterThan(0);
    expect(fileChangeCount).toBeGreaterThan(0);
    expect(docSnapshotCount).toBeGreaterThan(0);

    const docRows = db.select().from(schema.docSnapshots).all();
    for (const row of docRows) {
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

  it("indexes a shallow clone as partial with a shallow_clone warning", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const shallow = shallowCloneOf(repo, 3);
    repos.push(shallow);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const gitchangeDir = join(shallow.dir, ".gitchange");

    try {
      const result = await indexFull({ repoPath: shallow.dir, gitchangeDir });

      expect(result.manifest.indexCompleteness).toBe("partial");
      expect(result.manifest.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "shallow_clone" }),
        ]),
      );
      expect(result.commitsIndexed).toBe(shallow.commitShas.length);

      const db = openDb(gitchangeDir);
      const commitCount = db.select({ value: count() }).from(schema.commits).get()?.value ?? 0;
      expect(commitCount).toBe(shallow.commitShas.length);

      expect(
        logSpy.mock.calls.some((call) =>
          String(call[0]).includes("GitChange warning [shallow_clone]"),
        ),
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("records out-of-order committer timestamps as a warning without failing", async () => {
    const repo = buildRepo(BASIC_SCENARIO);
    repos.push(repo);

    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["checkout", "main"], { cwd: repo.dir, encoding: "utf8" });
    execFileSync(
      "git",
      ["commit", "--allow-empty", "-m", "chore: backdated commit"],
      {
        cwd: repo.dir,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_COMMITTER_DATE: "2000-01-01T00:00:00",
        },
      },
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const gitchangeDir = join(repo.dir, ".gitchange");

    try {
      const result = await indexFull({ repoPath: repo.dir, gitchangeDir });

      expect(result.manifest.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "out_of_order_commits" }),
        ]),
      );
      expect(result.commitsIndexed).toBeGreaterThan(0);
      expect(
        logSpy.mock.calls.some((call) =>
          String(call[0]).includes("GitChange warning [out_of_order_commits]"),
        ),
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});
