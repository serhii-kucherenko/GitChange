import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ManifestSchema } from "../../schema/manifest.js";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
} from "../../schema/zod/tours.js";
import { writeWorkspace } from "../../workspace/workspace-io.js";
import {
  getTourByIdUnified,
  listToursUnified,
  mergeToursForWorkspace,
} from "./tours.js";
import { resolveWorkspaceContext } from "./workspace-context.js";

const SHA = "a".repeat(40);

function writeMinimalManifest(gitchangeDir: string, repoId: string): void {
  mkdirSync(gitchangeDir, { recursive: true });
  writeFileSync(
    join(gitchangeDir, "manifest.json"),
    `${JSON.stringify(
      ManifestSchema.parse({
        schemaVersion: "1",
        repoId,
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

describe("mergeToursForWorkspace", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  function seedWorkspace() {
    const root = mkdtempSync(join(tmpdir(), "gitchange-unified-tours-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const alphaDir = join(root, "alpha", ".gitchange");
    const betaDir = join(root, "beta", ".gitchange");
    const workspaceDir = join(root, "workspace", ".gitchange");

    writeMinimalManifest(alphaDir, "alpha");
    writeMinimalManifest(betaDir, "beta");
    seedTours(alphaDir, [sampleDefaultTour()]);
    seedTours(betaDir, [sampleDefaultTour()]);

    writeWorkspace(workspaceDir, {
      schemaVersion: "1",
      primaryRepoId: "alpha",
      repos: [
        {
          repoId: "alpha",
          label: "Alpha",
          repoPath: join(root, "alpha"),
          gitchangeDir: alphaDir,
        },
        {
          repoId: "beta",
          label: "Beta",
          repoPath: join(root, "beta"),
          gitchangeDir: betaDir,
        },
      ],
      links: [
        {
          id: "link-1",
          sourceRepoId: "alpha",
          targetRepoId: "beta",
          kind: "manual",
          label: "Shared auth migration",
        },
      ],
    });

    return resolveWorkspaceContext(workspaceDir);
  }

  it("merges tours with repoId-prefixed ids", () => {
    const ctx = seedWorkspace();
    const merged = mergeToursForWorkspace(ctx);

    expect(merged).not.toBeNull();
    expect(merged!.list.tours).toHaveLength(2);
    expect(merged!.list.tours.map((tour) => tour.id)).toEqual([
      "alpha:tour:default",
      "beta:tour:default",
    ]);
    expect(merged!.list.defaultTourId).toBe("alpha:tour:default");
  });

  it("attaches repoId to every stop", () => {
    const ctx = seedWorkspace();
    const tour = getTourByIdUnified(ctx, "alpha:tour:default");

    expect(tour).not.toBeNull();
    const stop = tour!.chapters[0]?.stops[0];
    expect(stop?.repoId).toBe("alpha");
    expect(stop?.id).toBe("alpha:stop:1");
    expect(stop?.drillTarget.eraId).toBe("alpha:era:01");
  });

  it("surfaces manual link labels in tour descriptions", () => {
    const ctx = seedWorkspace();
    const tour = getTourByIdUnified(ctx, "alpha:tour:default");

    expect(tour?.description).toContain("Shared auth migration");
  });

  it("delegates to single-repo listTours when workspace has one repo", () => {
    const root = mkdtempSync(join(tmpdir(), "gitchange-unified-tours-single-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));

    const gitchangeDir = join(root, ".gitchange");
    writeMinimalManifest(gitchangeDir, "solo");
    seedTours(gitchangeDir, [sampleDefaultTour()]);

    const ctx = resolveWorkspaceContext(gitchangeDir);
    const list = listToursUnified(ctx);

    expect(list?.defaultTourId).toBe("tour:default");
    expect(list?.tours[0]?.id).toBe("tour:default");
  });
});
