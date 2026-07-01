import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { ManifestSchema } from "../schema/manifest.js";
import {
  addRepo,
  findWorkspaceGitchangeDir,
  loadWorkspaceContext,
  readWorkspace,
  removeRepo,
  slugifyLabel,
  validateRepoPath,
  writeWorkspace,
} from "./workspace-io.js";
import { WorkspaceArtifact } from "../schema/zod/workspace.js";

describe("workspace-io", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  function trackRepo(repo: { cleanup: () => void }): typeof repo {
    repos.push(repo);
    return repo;
  }

  function cleanupRepos(): void {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  }

  it("slugifies labels into repo ids", () => {
    expect(slugifyLabel("Frontend App")).toBe("frontend-app");
    expect(slugifyLabel("API_v2")).toBe("api-v2");
  });

  it("rejects invalid repo paths without .git", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-workspace-"));

    try {
      expect(() => validateRepoPath(dir)).toThrow(/\.git directory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects repo paths containing .. traversal segments", () => {
    expect(() => validateRepoPath("../outside")).toThrow(/traversal/);
  });

  it("round-trips workspace.json via atomic write", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-workspace-"));
    const workspace = WorkspaceArtifact.parse({
      schemaVersion: "1",
      primaryRepoId: "app",
      repos: [
        {
          repoId: "app",
          label: "App",
          repoPath: "/tmp/app",
          gitchangeDir: "/tmp/app/.gitchange",
        },
      ],
      links: [],
    });

    try {
      writeWorkspace(dir, workspace);
      expect(existsSync(join(dir, "workspace.json"))).toBe(true);
      expect(readWorkspace(dir)).toEqual(workspace);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("adds repos with unique ids and rejects duplicate paths", () => {
    const primary = trackRepo(buildRepo(BASIC_SCENARIO));
    const secondary = trackRepo(buildRepo(BASIC_SCENARIO));

    try {
      const context = loadWorkspaceContext(primary.dir);
      const workspace = addRepo(context, {
        repoPath: primary.dir,
        label: "Primary",
      });

      expect(workspace.primaryRepoId).toBe("primary");
      expect(workspace.repos[0]?.gitchangeDir).toBe(
        join(validateRepoPath(primary.dir), ".gitchange"),
      );

      const withSecond = addRepo(
        {
          cwd: primary.dir,
          workspace,
          workspaceGitchangeDir: join(primary.dir, ".gitchange"),
        },
        {
          repoPath: secondary.dir,
          label: "Secondary",
        },
      );

      expect(withSecond.repos).toHaveLength(2);
      expect(withSecond.repos.map((repo) => repo.repoId)).toEqual([
        "primary",
        "secondary",
      ]);

      expect(() =>
        addRepo(
          {
            cwd: primary.dir,
            workspace: withSecond,
            workspaceGitchangeDir: join(primary.dir, ".gitchange"),
          },
          {
            repoPath: secondary.dir,
            label: "Duplicate",
          },
        ),
      ).toThrow(/already registered/);
    } finally {
      cleanupRepos();
    }
  });

  it("discovers workspace.json while walking up from nested cwd", () => {
    const primary = trackRepo(buildRepo(BASIC_SCENARIO));

    try {
      addRepo(loadWorkspaceContext(primary.dir), {
        repoPath: primary.dir,
        label: "Primary",
      });

      const nested = join(primary.dir, "packages", "core");
      expect(findWorkspaceGitchangeDir(nested)).toBe(
        join(primary.dir, ".gitchange"),
      );
    } finally {
      cleanupRepos();
    }
  });

  it("removes repos and clears workspace when last repo is removed", () => {
    const primary = trackRepo(buildRepo(BASIC_SCENARIO));

    try {
      const workspace = addRepo(loadWorkspaceContext(primary.dir), {
        repoPath: primary.dir,
        label: "Only",
        repoId: "only",
      });
      const gitchangeDir = join(primary.dir, ".gitchange");

      const removed = removeRepo(gitchangeDir, workspace, "only");
      expect(removed).toBeNull();
      expect(existsSync(join(gitchangeDir, "workspace.json"))).toBe(false);
    } finally {
      cleanupRepos();
    }
  });

  it("parses optional manifest repoId", () => {
    const manifest = ManifestSchema.parse({
      schemaVersion: "1",
      repoId: "frontend",
      lastIndexedCommit: "a".repeat(40),
      indexedAt: "2026-07-01T00:00:00.000Z",
      repo: { head: "a".repeat(40), branch: "main" },
      indexCompleteness: "complete",
      warnings: [],
    });

    expect(manifest.repoId).toBe("frontend");

    const withoutRepoId = ManifestSchema.parse({
      schemaVersion: "1",
      lastIndexedCommit: "a".repeat(40),
      indexedAt: "2026-07-01T00:00:00.000Z",
      repo: { head: "a".repeat(40), branch: "main" },
      indexCompleteness: "complete",
      warnings: [],
    });

    expect(withoutRepoId.repoId).toBeUndefined();
  });

  it("writes workspace.json as formatted JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-workspace-"));

    try {
      writeWorkspace(
        dir,
        WorkspaceArtifact.parse({
          schemaVersion: "1",
          primaryRepoId: "app",
          repos: [
            {
              repoId: "app",
              label: "App",
              repoPath: "/tmp/app",
              gitchangeDir: "/tmp/app/.gitchange",
            },
          ],
          links: [],
        }),
      );

      const raw = readFileSync(join(dir, "workspace.json"), "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(raw).toContain('"schemaVersion": "1"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
