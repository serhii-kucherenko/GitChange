import { afterEach, describe, expect, it } from "vitest";
import { runDecisionsPipeline, runSemanticPipeline } from "../../packages/core/src/semantic/pipeline.js";
import { applyBasicScenarioToursFixture } from "./tours-fixture.js";
import {
  BASIC_SCENARIO_TOURS_SNAPSHOT,
  collectToursEvidenceSnapshot,
  verifyToursEvidenceIntegrity,
} from "../../packages/core/src/verify/tours-snapshot.js";
import { applyBasicScenarioDecisionsFixture } from "./decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "./semantic-fixture.js";
import { indexBasicScenario } from "./helpers.js";

describe("golden: tours evidence integrity (EVD-04)", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("locks BASIC_SCENARIO tours snapshot after bindBasicScenarioToursTemplate", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);
    applyBasicScenarioToursFixture(fixture.gitchangeDir);

    expect(collectToursEvidenceSnapshot(fixture.gitchangeDir)).toEqual(
      BASIC_SCENARIO_TOURS_SNAPSHOT,
    );
  });

  it("passes tours evidence integrity on BASIC_SCENARIO fixture", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    applyBasicScenarioErasFixture(fixture.gitchangeDir);
    runSemanticPipeline(fixture.gitchangeDir);
    applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
    runDecisionsPipeline(fixture.gitchangeDir);
    applyBasicScenarioToursFixture(fixture.gitchangeDir);

    const report = verifyToursEvidenceIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.snapshot.defaultTourChapterCount).toBeGreaterThanOrEqual(4);
    expect(report.snapshot.defaultTourChapterCount).toBeLessThanOrEqual(6);
    expect(report.snapshot.roleTourCount).toBeGreaterThanOrEqual(1);
    expect(report.snapshot.topicTourCount).toBeGreaterThanOrEqual(1);
  });
});
