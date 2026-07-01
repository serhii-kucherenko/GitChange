import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
} from "../schema/zod/tours.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import { outlineDefaultTourChapters } from "./outline.js";
import { readToursArtifact, writeToursArtifact } from "./tours-io.js";
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

describe("tours-io", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when tours.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-tours-"));

    try {
      expect(readToursArtifact(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips a valid tours artifact", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const artifact = buildValidArtifact(fixture.gitchangeDir);

    writeToursArtifact(fixture.gitchangeDir, artifact);
    expect(existsSync(join(fixture.gitchangeDir, "tours.json"))).toBe(true);

    const loaded = readToursArtifact(fixture.gitchangeDir);
    expect(loaded?.defaultTourId).toBe("tour:default");
    expect(loaded?.tours[0]?.kind).toBe("default");
  });

  it("rejects invalid artifacts at write boundary", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const artifact = buildValidArtifact(fixture.gitchangeDir);
    expect(() =>
      writeToursArtifact(fixture.gitchangeDir, {
        ...artifact,
        tours: [
          {
            ...artifact.tours[0]!,
            chapters: artifact.tours[0]!.chapters.map((chapter) => ({
              ...chapter,
              stops: [
                {
                  id: "stop:bad",
                  narrative: "Missing evidence.",
                  evidence: [],
                  drillTarget: { eraId: chapter.eraIds[0] },
                },
              ],
            })),
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects write when integrity check fails", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const artifact = buildValidArtifact(fixture.gitchangeDir);
    const bogusSha = "d".repeat(40);
    const badTour = Tour.parse({
      id: "tour:default",
      kind: "default",
      title: "Onboarding tour",
      description: "Default guided tour.",
      chapters: artifact.tours[0]!.chapters.map((chapter, index) =>
        TourChapter.parse({
          ...chapter,
          stops: [
            TourStop.parse({
              id: `stop:bad:${index}`,
              narrative: "Bogus evidence.",
              evidence: [{ type: "commit", sha: bogusSha }],
              drillTarget: { eraId: chapter.eraIds[0] },
            }),
          ],
        }),
      ),
    });

    expect(() =>
      writeToursArtifact(
        fixture.gitchangeDir,
        ToursArtifact.parse({
          ...artifact,
          tours: [badTour],
        }),
      ),
    ).toThrow(/integrity check failed/);
  });
});
