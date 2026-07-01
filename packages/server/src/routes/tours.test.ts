import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ManifestSchema,
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
} from "@gitchange/core";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const SHA = "a".repeat(40);
const TOURS_ROUTE_FILE = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "tours.ts",
);

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

function seedTours(gitchangeDir: string, tours: Tour[]): void {
  writeMinimalManifest(gitchangeDir);
  const artifact = ToursArtifact.parse({
    schemaVersion: TOURS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    defaultTourId: "tour:default",
    tours,
  });
  writeFileSync(
    join(gitchangeDir, "tours.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
}

describe("tours routes", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns 404 when tours.json is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-tours-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/tours");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "tours not found" });
  });

  it("returns tour list from fixture", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-tours-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedTours(dir, [sampleDefaultTour()]);

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/tours");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.defaultTourId).toBe("tour:default");
    expect(body.tours).toHaveLength(1);
    expect(body.tours[0]).toMatchObject({
      id: "tour:default",
      kind: "default",
      chapterCount: 4,
      stopCount: 4,
    });
  });

  it("returns full tour detail by id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-tours-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedTours(dir, [sampleDefaultTour()]);

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/tours/tour%3Adefault");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("tour:default");
    expect(body.chapters).toHaveLength(4);
    expect(body.chapters[0]?.stops[0]?.evidence).toHaveLength(1);
  });

  it("returns 404 for unknown tour id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-tours-route-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedTours(dir, [sampleDefaultTour()]);

    const app = createApp({ gitchangeDir: dir });
    const response = await app.request("/api/tours/tour%3Amissing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "tour_not_found" });
  });

  it("has zero es-git imports in tours route file", () => {
    const content = readFileSync(TOURS_ROUTE_FILE, "utf-8");
    expect(/from\s+["']es-git["']/.test(content)).toBe(false);
    expect(/import\s*\(\s*["']es-git["']\s*\)/.test(content)).toBe(false);
  });
});
