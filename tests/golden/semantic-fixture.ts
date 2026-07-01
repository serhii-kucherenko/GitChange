import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ErasArtifact } from "../../packages/core/src/schema/zod/eras.js";
import { applyBasicScenarioErasTemplate } from "../../packages/core/src/semantic/bind-basic-scenario-eras.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "../fixtures/semantic/eras-basic-scenario.json",
);

export function applyBasicScenarioErasFixture(gitchangeDir: string): void {
  const template = ErasArtifact.parse(
    JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")),
  );
  applyBasicScenarioErasTemplate(gitchangeDir, template);
}
