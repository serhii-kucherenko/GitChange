import { join } from "node:path";
import { buildRepo, type BuiltRepo } from "../fixtures/builder.js";
import type { CommitSpec } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { computeIntelligence } from "../../packages/core/src/intelligence/compute.js";
import { indexFull } from "../../packages/core/src/index/full.js";

export interface IndexedFixture {
  repo: BuiltRepo;
  gitchangeDir: string;
  cleanup: () => void;
}

export async function indexBasicScenario(): Promise<IndexedFixture> {
  const repo = buildRepo(BASIC_SCENARIO);
  return indexAndCompute(repo);
}

export async function indexAndCompute(repo: BuiltRepo): Promise<IndexedFixture> {
  const gitchangeDir = join(repo.dir, ".gitchange");
  await indexFull({ repoPath: repo.dir, gitchangeDir });
  await computeIntelligence({ repoPath: repo.dir, gitchangeDir });

  return {
    repo,
    gitchangeDir,
    cleanup: () => {
      repo.cleanup();
    },
  };
}

export async function indexScenario(
  scenario: CommitSpec[],
): Promise<IndexedFixture> {
  const repo = buildRepo(scenario);
  return indexAndCompute(repo);
}
