import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ManifestSchema } from "../schema/manifest.js";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
} from "../schema/zod/tours.js";
import { getTourById, listTours } from "./tours.js";

const SHA = "a".repeat(40);

function writeMinimalManifest(gitchangeDir: string): void {
  mkdirSync(gitchangeDir, { recursive: true });
  writeFileSync(
    join(gitchangeDir, "manifest.json"),
    `${JSON.stringify(
      ManifestSchema.parse({
        schemaVersion: "1",
        lastIndexedCommit: SHA,
        indexedAt: "2026-07-01T00:00:00.000Z",
        repo: { head: SHA, branch: "main" },
        indexCompleteness: "complete",
        warnings: [],
      }),
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(gitchangeDir, "index.sqlite"), "");
}

function sampleStop(id: string, eraId: string): TourStop {
  return TourStop.parse({
    id: `stop:${id}`,
    narrative: "Sample narrative for tour stop.",
    evidence: [{ type: "commit", sha: SHA }],
    drillTarget: { eraId },
  });
}

function sampleChapter(order: number, eraId: string): TourChapter {
  return TourChapter.parse({
    order,
    title: `Chapter ${order}`,
    summary: "Chapter summary.",
    eraIds: [eraId],
    stops: [sampleStop(String(order), eraId)],
  });
}

function sampleDefaultTour(): Tour {
  return Tour.parse({
    id: "tour:default",
    kind: "default",
    title: "Onboarding tour",
    description: "Default guided tour.",
    chapters: [1, 2, 3, 4].map((order) =>
      sampleChapter(order, `era:${String(order).padStart(2, "0")}`),
    ),
  });
}

function sampleRoleTour(): Tour {
  return Tour.parse({
    id: "tour:role-backend",
    kind: "role",
    roleTag: "backend",
    title: "Backend tour",
    description: "Backend-focused tour.",
    chapters: [sampleChapter(1, "era:01")],
  });
}

function seedTours(
  gitchangeDir: string,
  tours: Tour[],
  defaultTourId = "tour:default",
): void {
  writeMinimalManifest(gitchangeDir);
  const artifact = ToursArtifact.parse({
    schemaVersion: TOURS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    defaultTourId,
    tours,
  });
  writeFileSync(
    join(gitchangeDir, "tours.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
}

describe("listTours", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when tours.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-tours-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    expect(listTours(dir)).toBeNull();
  });

  it("returns summaries with chapter and stop counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-tours-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedTours(dir, [sampleDefaultTour(), sampleRoleTour()]);

    const result = listTours(dir);
    expect(result).not.toBeNull();
    expect(result?.defaultTourId).toBe("tour:default");
    expect(result?.tours).toHaveLength(2);

    const defaultSummary = result?.tours.find((tour) => tour.id === "tour:default");
    expect(defaultSummary).toMatchObject({
      kind: "default",
      title: "Onboarding tour",
      description: "Default guided tour.",
      chapterCount: 4,
      stopCount: 4,
    });
    expect(defaultSummary?.roleTag).toBeUndefined();
    expect(defaultSummary?.topicKey).toBeUndefined();

    const roleSummary = result?.tours.find((tour) => tour.id === "tour:role-backend");
    expect(roleSummary).toMatchObject({
      kind: "role",
      roleTag: "backend",
      chapterCount: 1,
      stopCount: 1,
    });
  });
});

describe("getTourById", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns full tour with chapters and stops", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-tours-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    const defaultTour = sampleDefaultTour();
    seedTours(dir, [defaultTour]);

    const tour = getTourById(dir, "tour:default");
    expect(tour).not.toBeNull();
    expect(tour?.chapters).toHaveLength(4);
    expect(tour?.chapters[0]?.stops[0]?.evidence).toHaveLength(1);
    expect(tour?.chapters[0]?.stops[0]?.drillTarget.eraId).toBe("era:01");
  });

  it("returns null for unknown tour id", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-tours-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedTours(dir, [sampleDefaultTour()]);

    expect(getTourById(dir, "tour:missing")).toBeNull();
  });

  it("returns null when tours.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-tours-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    expect(getTourById(dir, "tour:default")).toBeNull();
  });
});
