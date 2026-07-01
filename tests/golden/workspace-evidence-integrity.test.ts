import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDecisionsPipeline, runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { applyBasicScenarioDecisionsFixture } from "./decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "./semantic-fixture.js";
import { applyBasicScenarioToursFixture } from "./tours-fixture.js";
import {
  addRepo,
  loadWorkspaceContext,
  readWorkspace,
  writeWorkspace,
} from "../../packages/core/src/workspace/workspace-io.js";
import { indexWorkspace } from "../../packages/core/src/workspace/index-workspace.js";
import { checkWorkspaceIntegrity } from "../../packages/core/src/verify/workspace-integrity.js";
import { buildRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";

describe("golden: workspace evidence integrity (MULTI-01/02)", () => {
  const repos: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (repos.length > 0) {
      repos.pop()?.cleanup();
    }
  });

  async function bindSemanticAndTours(gitchangeDir: string): Promise<void> {
    applyBasicScenarioErasFixture(gitchangeDir);
    runSemanticPipeline(gitchangeDir);
    applyBasicScenarioDecisionsFixture(gitchangeDir);
    runDecisionsPipeline(gitchangeDir);
    applyBasicScenarioToursFixture(gitchangeDir);
  }

  it("passes integrity on two-repo BASIC_SCENARIO workspace with manual link", async () => {
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

    writeWorkspace(workspaceGitchangeDir, {
      ...loaded,
      links: [
        {
          id: "link-manual-1",
          sourceRepoId: "alpha",
          targetRepoId: "beta",
          kind: "manual",
          label: "shared auth migration",
          evidenceNote: "Both repos adopted JWT in the same quarter",
        },
      ],
    });

    await indexWorkspace(readWorkspace(workspaceGitchangeDir)!);

    for (const repo of readWorkspace(workspaceGitchangeDir)!.repos) {
      await bindSemanticAndTours(repo.gitchangeDir);
    }

    const report = checkWorkspaceIntegrity(workspaceGitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });
});
