import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ToursArtifact } from "../schema/zod/tours.js";
import { runDecisionsPipeline, runSemanticPipeline } from "../semantic/pipeline.js";
import { applyBasicScenarioDecisionsFixture } from "../../../../tests/golden/decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";
import { readManifest } from "../schema/manifest.js";
import { applyBasicScenarioToursTemplate } from "./bind-basic-scenario-tours.js";
import { runToursPipeline } from "./pipeline.js";
import { readToursArtifact } from "./tours-io.js";

const TOURS_FIXTURE_PATH = join(
  import.meta.dirname,
  "../../../../tests/fixtures/tours/tours-basic-scenario.json",
);

describe("runToursPipeline", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  async function toursPipelineFixture() {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);

    const template = ToursArtifact.parse(
      JSON.parse(readFileSync(TOURS_FIXTURE_PATH, "utf-8")),
    );
    applyBasicScenarioToursTemplate(fixture.gitchangeDir, template);

    return fixture;
  }

  it("throws when tours.json is missing", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);

    expect(() => runToursPipeline(fixture.gitchangeDir)).toThrow(/tours\.json/);
  });

  it("sets tours checkpoint on successful pipeline run", async () => {
    const { gitchangeDir } = await toursPipelineFixture();

    const result = runToursPipeline(gitchangeDir);
    expect(result).toEqual({ ok: true });

    const tours = readToursArtifact(gitchangeDir);
    expect(tours?.tours.length).toBeGreaterThanOrEqual(2);

    const manifest = readManifest(gitchangeDir);
    expect(manifest?.toursComputedAt).toBe("2026-07-01T14:00:00.000Z");
    expect(manifest?.toursHeadSha).toHaveLength(40);
    expect(manifest?.toursSchemaVersion).toBe("1");
  });
});
