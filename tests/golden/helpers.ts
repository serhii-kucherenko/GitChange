import { join } from "node:path";
import { buildRepo, type BuiltRepo } from "../fixtures/builder.js";
import { BASIC_SCENARIO } from "../fixtures/scenarios.js";
import { indexFull } from "../../packages/core/src/index/full.js";

export interface IndexedFixture {
  repo: BuiltRepo;
  gitchangeDir: string;
  cleanup: () => void;
}

export async function indexBasicScenario(): Promise<IndexedFixture> {
  const repo = buildRepo(BASIC_SCENARIO);
  const gitchangeDir = join(repo.dir, ".gitchange");
  await indexFull({ repoPath: repo.dir, gitchangeDir });

  return {
    repo,
    gitchangeDir,
    cleanup: () => {
      repo.cleanup();
    },
  };
}
