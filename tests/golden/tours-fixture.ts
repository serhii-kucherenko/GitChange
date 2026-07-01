import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ToursArtifact } from "../../packages/core/src/schema/zod/tours.js";
import { applyBasicScenarioToursTemplate } from "../../packages/core/src/tours/bind-basic-scenario-tours.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "../fixtures/tours/tours-basic-scenario.json",
);

export function applyBasicScenarioToursFixture(gitchangeDir: string): void {
  const template = ToursArtifact.parse(
    JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")),
  );
  applyBasicScenarioToursTemplate(gitchangeDir, template);
}
