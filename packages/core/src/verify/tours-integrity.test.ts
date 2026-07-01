import { afterEach, describe, expect, it } from "vitest";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  ToursArtifact,
} from "../schema/zod/tours.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import { writeToursArtifact } from "../tours/tours-io.js";
import { outlineDefaultTourChapters } from "../tours/outline.js";
import { checkToursIntegrity } from "./tours-integrity.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

function buildValidArtifact(gitchangeDir: string): ToursArtifact {
  const erasArtifact = readErasArtifact(gitchangeDir);
  if (!erasArtifact) {
    throw new Error("eras.json missing in fixture dir");
  }

  const chapters = outlineDefaultTourChapters(erasArtifact);
  const defaultTour = Tour.parse({
    id: "tour:default",
    kind: "default",
    title: "Onboarding tour",
    description: "Default guided tour.",
    chapters,
  });

  return ToursArtifact.parse({
    schemaVersion: TOURS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: erasArtifact.headSha,
    defaultTourId: "tour:default",
    tours: [defaultTour],
  });
}

describe("checkToursIntegrity", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("passes when tour evidence and drill targets resolve", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const artifact = buildValidArtifact(fixture.gitchangeDir);
    writeToursArtifact(fixture.gitchangeDir, artifact);

    const report = checkToursIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("fails when a stop cites a commit missing from the index", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const erasArtifact = readErasArtifact(fixture.gitchangeDir);
    if (!erasArtifact) {
      throw new Error("eras.json missing");
    }

    const bogusSha = "d".repeat(40);
    const chapters = outlineDefaultTourChapters(erasArtifact).map(
      (chapter, index) => ({
        ...chapter,
        stops: [
          {
            id: `stop:bad:${index}`,
            narrative: "Bogus commit evidence.",
            evidence: [{ type: "commit" as const, sha: bogusSha }],
            drillTarget: { eraId: chapter.eraIds[0] },
          },
        ],
      }),
    );

    const artifact = ToursArtifact.parse({
      schemaVersion: TOURS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: erasArtifact.headSha,
      defaultTourId: "tour:default",
      tours: [
        Tour.parse({
          id: "tour:default",
          kind: "default",
          title: "Onboarding tour",
          description: "Default guided tour.",
          chapters,
        }),
      ],
    });

    const report = checkToursIntegrity(fixture.gitchangeDir, artifact);
    expect(report.ok).toBe(false);
    expect(report.danglingCommitRefs).toContain(bogusSha);
    expect(report.errors.some((error) => error.includes(bogusSha))).toBe(true);
  });
});
