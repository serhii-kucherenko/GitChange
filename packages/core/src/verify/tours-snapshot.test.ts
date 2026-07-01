import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDecisionsPipeline, runSemanticPipeline } from "../semantic/pipeline.js";
import { applyBasicScenarioToursFixture } from "../tours/bind-basic-scenario-tours.js";
import { readToursArtifact } from "../tours/tours-io.js";
import { ToursArtifact } from "../schema/zod/tours.js";
import {
  BASIC_SCENARIO_TOURS_SNAPSHOT,
  collectToursEvidenceSnapshot,
  verifyToursEvidenceIntegrity,
} from "./tours-snapshot.js";
import { applyBasicScenarioDecisionsFixture } from "../../../../tests/golden/decisions-fixture.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

async function toursFixture() {
  const fixture = await indexBasicScenario();
  applyBasicScenarioErasFixture(fixture.gitchangeDir);
  runSemanticPipeline(fixture.gitchangeDir);
  applyBasicScenarioDecisionsFixture(fixture.gitchangeDir);
  runDecisionsPipeline(fixture.gitchangeDir);
  applyBasicScenarioToursFixture(fixture.gitchangeDir);
  return fixture;
}

describe("tours evidence snapshot", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("collects BASIC_SCENARIO tours snapshot counts after bind", async () => {
    const fixture = await toursFixture();
    cleanups.push(fixture.cleanup);

    expect(collectToursEvidenceSnapshot(fixture.gitchangeDir)).toEqual(
      BASIC_SCENARIO_TOURS_SNAPSHOT,
    );
  });

  it("verifyToursEvidenceIntegrity passes on bound BASIC_SCENARIO fixture", async () => {
    const fixture = await toursFixture();
    cleanups.push(fixture.cleanup);

    const report = verifyToursEvidenceIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.snapshot).toEqual(BASIC_SCENARIO_TOURS_SNAPSHOT);
  });

  it("fails when a stop cites a commit missing from the index", async () => {
    const fixture = await toursFixture();
    cleanups.push(fixture.cleanup);

    const tours = readToursArtifact(fixture.gitchangeDir);
    if (!tours) {
      throw new Error("tours.json missing");
    }

    const bogusSha = "f".repeat(40);
    const corrupted = ToursArtifact.parse({
      ...tours,
      tours: tours.tours.map((tour) => ({
        ...tour,
        chapters: tour.chapters.map((chapter, chapterIndex) => ({
          ...chapter,
          stops: chapter.stops.map((stop, stopIndex) =>
            chapterIndex === 0 && stopIndex === 0
              ? {
                  ...stop,
                  evidence: [{ type: "commit" as const, sha: bogusSha }],
                  drillTarget: { commitSha: bogusSha },
                }
              : stop,
          ),
        })),
      })),
    });

    writeFileSync(
      join(fixture.gitchangeDir, "tours.json"),
      JSON.stringify(corrupted, null, 2),
      "utf-8",
    );

    const report = verifyToursEvidenceIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.danglingCommitRefs).toContain(bogusSha);
    expect(report.errors.some((error) => error.includes(bogusSha))).toBe(true);
  });
});
