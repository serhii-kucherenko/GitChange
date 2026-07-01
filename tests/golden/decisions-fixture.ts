import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBasicScenarioDecisionsTemplate } from "../../packages/core/src/decisions/bind-basic-scenario-decisions.js";
import { DecisionsArtifact } from "../../packages/core/src/schema/zod/decisions.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "../fixtures/decisions/basic-scenario-decisions.json",
);

export function applyBasicScenarioDecisionsFixture(gitchangeDir: string): void {
  const template = DecisionsArtifact.parse(
    JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")),
  );
  applyBasicScenarioDecisionsTemplate(gitchangeDir, template);
}
