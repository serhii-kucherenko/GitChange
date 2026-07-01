import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { ManifestSchema } from "../schema/manifest.js";
import {
  addRepo,
  loadWorkspaceContext,
  readWorkspace,
} from "./workspace-io.js";
import { indexWorkspace } from "./index-workspace.js";

describe("indexWorkspace", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  it("indexes two synthetic repos sequentially with distinct repoIds", async () => {
    const primary = buildRepo(BASIC_SCENARIO);
    const secondary = buildRepo(BASIC_SCENARIO);
    repos.push(primary, secondary);

    let workspace = addRepo(loadWorkspaceContext(primary.dir), {
      repoPath: primary.dir,
      label: "Primary",
      repoId: "primary",
    });

    workspace = addRepo(
      {
        cwd: primary.dir,
        workspace,
        workspaceGitchangeDir: join(primary.dir, ".gitchange"),
      },
      {
        repoPath: secondary.dir,
        label: "Secondary",
        repoId: "secondary",
      },
    );

    const loaded = readWorkspace(join(primary.dir, ".gitchange"));
    expect(loaded?.repos).toHaveLength(2);

    const result = await indexWorkspace(loaded!);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);

    for (const repo of loaded!.repos) {
      const manifestPath = join(repo.gitchangeDir, "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);
      expect(existsSync(join(repo.gitchangeDir, "index.sqlite"))).toBe(true);

      const manifest = ManifestSchema.parse(
        JSON.parse(readFileSync(manifestPath, "utf-8")),
      );
      expect(manifest.repoId).toBe(repo.repoId);
      expect(manifest.lastIndexedCommit).toBeTruthy();
    }

    expect(
      readFileSync(join(loaded!.repos[0]!.gitchangeDir, "manifest.json"), "utf-8"),
    ).not.toEqual(
      readFileSync(join(loaded!.repos[1]!.gitchangeDir, "manifest.json"), "utf-8"),
    );
  }, 60_000);

  it("indexes zero commits on unchanged HEAD for each repo", async () => {
    const primary = buildRepo(BASIC_SCENARIO);
    const secondary = buildRepo(BASIC_SCENARIO);
    repos.push(primary, secondary);

    let workspace = addRepo(loadWorkspaceContext(primary.dir), {
      repoPath: primary.dir,
      label: "Primary",
      repoId: "primary",
    });

    workspace = addRepo(
      {
        cwd: primary.dir,
        workspace,
        workspaceGitchangeDir: join(primary.dir, ".gitchange"),
      },
      {
        repoPath: secondary.dir,
        label: "Secondary",
        repoId: "secondary",
      },
    );

    const loaded = readWorkspace(join(primary.dir, ".gitchange"))!;
    await indexWorkspace(loaded);

    const secondPass = await indexWorkspace(loaded);
    expect(secondPass.succeeded).toBe(2);
    expect(secondPass.failed).toBe(0);
    for (const entry of secondPass.results) {
      expect(entry.commitsIndexed).toBe(0);
    }
  }, 60_000);

  it("continues indexing after a single-repo failure", async () => {
    const primary = buildRepo(BASIC_SCENARIO);
    repos.push(primary);

    const workspace = addRepo(loadWorkspaceContext(primary.dir), {
      repoPath: primary.dir,
      label: "Primary",
      repoId: "primary",
    });

    const brokenWorkspace = {
      ...workspace,
      repos: [
        ...workspace.repos,
        {
          repoId: "missing",
          label: "Missing",
          repoPath: join(primary.dir, "does-not-exist"),
          gitchangeDir: join(primary.dir, "does-not-exist", ".gitchange"),
        },
      ],
    };

    const result = await indexWorkspace(brokenWorkspace);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.find((entry) => entry.repoId === "missing")?.success).toBe(
      false,
    );
    expect(result.results.find((entry) => entry.repoId === "primary")?.success).toBe(
      true,
    );
  });
});
