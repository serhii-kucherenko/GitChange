import { afterEach, describe, expect, it } from "vitest";
import { runDecisionsPipeline, runSemanticPipeline } from "../semantic/pipeline.js";
import { applyBasicScenarioDecisionsFixture } from "../../../../tests/golden/decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { applyBasicScenarioToursFixture } from "../../../../tests/golden/tours-fixture.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";
import { readManifest } from "../schema/manifest.js";
import { applyBasicScenarioToursFixture } from "../../../../tests/golden/tours-fixture.js";
import { runToursPipeline } from "./pipeline.js";
import { readToursArtifact } from "./tours-io.js";

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

    applyBasicScenarioToursFixture(fixture.gitchangeDir);

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
