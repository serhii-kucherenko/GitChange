import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepo } from "../../../../tests/fixtures/builder.js";
import { BASIC_SCENARIO } from "../../../../tests/fixtures/scenarios.js";
import { ManifestSchema } from "../schema/manifest.js";
import {
  addRepo,
  loadWorkspaceContext,
  readWorkspace,
  writeWorkspace,
} from "../workspace/workspace-io.js";
import { indexWorkspace } from "../workspace/index-workspace.js";
import { checkWorkspaceIntegrity } from "./workspace-integrity.js";

describe("checkWorkspaceIntegrity", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function buildIndexedTwoRepoWorkspace() {
    const primary = buildRepo(BASIC_SCENARIO);
    const secondary = buildRepo(BASIC_SCENARIO);
    repos.push(primary, secondary);

    let workspace = addRepo(loadWorkspaceContext(primary.dir), {
      repoPath: primary.dir,
      label: "Primary",
      repoId: "alpha",
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
        repoId: "beta",
      },
    );

    const workspaceGitchangeDir = join(primary.dir, ".gitchange");
    const loaded = readWorkspace(workspaceGitchangeDir)!;
    await indexWorkspace(loaded);

    return { workspaceGitchangeDir, primary, secondary };
  }

  it("passes for a valid two-repo indexed workspace", async () => {
    const { workspaceGitchangeDir } = await buildIndexedTwoRepoWorkspace();
    const report = checkWorkspaceIntegrity(workspaceGitchangeDir);

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("rejects links that reference unknown repo ids", async () => {
    const { workspaceGitchangeDir } = await buildIndexedTwoRepoWorkspace();
    const workspace = readWorkspace(workspaceGitchangeDir)!;

    writeWorkspace(workspaceGitchangeDir, {
      ...workspace,
      links: [
        {
          id: "link-1",
          sourceRepoId: "alpha",
          targetRepoId: "missing",
          kind: "manual",
          label: "broken link",
        },
      ],
    });

    const report = checkWorkspaceIntegrity(workspaceGitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes("missing"))).toBe(true);
  });

  it("fails when a workspace repo manifest is missing", async () => {
    const { workspaceGitchangeDir, secondary } = await buildIndexedTwoRepoWorkspace();
    const manifestPath = join(secondary.dir, ".gitchange", "manifest.json");
    rmSync(manifestPath);

    const report = checkWorkspaceIntegrity(workspaceGitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => /manifest/i.test(error))).toBe(true);
  });

  it("fails when manifest repoId does not match workspace entry", async () => {
    const { workspaceGitchangeDir, primary } = await buildIndexedTwoRepoWorkspace();
    const manifestPath = join(primary.dir, ".gitchange", "manifest.json");
    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(manifestPath, "utf-8")),
    );

    writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, repoId: "wrong-id" }, null, 2)}\n`,
    );

    const report = checkWorkspaceIntegrity(workspaceGitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => /repoId/i.test(error))).toBe(true);
  });

  it("returns ok when workspace.json is absent", () => {
    const primary = buildRepo(BASIC_SCENARIO);
    repos.push(primary);

    const gitchangeDir = join(primary.dir, ".gitchange");
    mkdirSync(gitchangeDir, { recursive: true });

    const report = checkWorkspaceIntegrity(gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });
});
