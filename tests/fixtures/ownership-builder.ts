import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BuiltRepo, buildRepo } from "./builder.js";
import {
  OWNSHIP_SCENARIO,
  OWNSHIP_SCENARIO_WITH_FORMAT,
} from "./scenarios.js";

export interface BuildOwnershipRepoOptions {
  withIgnoreRevs?: boolean;
  withFormattingCommit?: boolean;
}

export function buildOwnershipRepo(
  options: BuildOwnershipRepoOptions = {},
): BuiltRepo {
  const scenario = options.withFormattingCommit
    ? OWNSHIP_SCENARIO_WITH_FORMAT
    : OWNSHIP_SCENARIO;
  const repo = buildRepo(scenario);

  if (options.withIgnoreRevs) {
    if (!options.withFormattingCommit) {
      throw new Error(
        "withIgnoreRevs requires withFormattingCommit so a rev can be ignored",
      );
    }
    const formatSha = repo.commitShas[2];
    if (!formatSha) {
      throw new Error("Expected formatting commit at index 2 in ownership fixture");
    }
    writeFileSync(
      join(repo.dir, ".git-blame-ignore-revs"),
      `${formatSha}\n`,
      "utf8",
    );
  }

  return repo;
}
