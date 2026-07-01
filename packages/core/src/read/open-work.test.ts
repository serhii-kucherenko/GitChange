import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeOpenWorkArtifact } from "../decisions/open-work-io.js";
import { ManifestSchema } from "../schema/manifest.js";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "../schema/zod/open-work.js";
import {
  getOpenWorkThread,
  listOpenWork,
  OpenWorkThreadNotFoundError,
} from "./open-work.js";

const SHA = "c".repeat(40);

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

function sampleThread(
  overrides: Partial<OpenWorkThread> = {},
): OpenWorkThread {
  return OpenWorkThread.parse({
    id: "thread:01MIG",
    kind: "migration",
    status: "in_progress",
    title: "API migration",
    summary: "Feature module still evolving.",
    confidence: 0.6,
    relatedPaths: ["src/feature.ts"],
    events: [
      {
        commitSha: SHA,
        committedAt: 1_700_000_000_000,
        summary: "feat(api): wire endpoint",
        paths: ["src/feature.ts"],
      },
      {
        commitSha: "d".repeat(40),
        committedAt: 1_700_000_100_000,
        summary: "feat(api): follow-up",
        paths: ["src/feature.ts"],
      },
    ],
    evidence: [{ type: "commit", sha: SHA }],
    ...overrides,
  });
}

function seedOpenWork(gitchangeDir: string, threads: OpenWorkThread[]): void {
  writeMinimalManifest(gitchangeDir);
  writeOpenWorkArtifact(
    gitchangeDir,
    OpenWorkArtifact.parse({
      schemaVersion: OPEN_WORK_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: SHA,
      threads,
    }),
  );
}

describe("listOpenWork", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when open-work.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-open-work-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    expect(listOpenWork(dir)).toBeNull();
  });

  it("sorts threads with in_progress first", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-open-work-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedOpenWork(dir, [
      sampleThread({
        id: "thread:01STALE",
        status: "stale",
        title: "Stale thread",
      }),
      sampleThread({
        id: "thread:01ACTIVE",
        status: "in_progress",
        title: "Active migration",
      }),
      sampleThread({
        id: "thread:01OPEN",
        status: "open",
        title: "Open thread",
      }),
    ]);

    const result = listOpenWork(dir);
    expect(result?.threads.map((thread) => thread.id)).toEqual([
      "thread:01ACTIVE",
      "thread:01OPEN",
      "thread:01STALE",
    ]);
    expect(result?.threads[0]?.lastEventAt).toBe(1_700_000_100_000);
  });
});

describe("getOpenWorkThread", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns events in chronological order", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-open-work-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedOpenWork(dir, [sampleThread()]);

    const thread = getOpenWorkThread(dir, "thread:01MIG");
    expect(thread.events).toHaveLength(2);
    expect(thread.events[0]?.committedAt).toBeLessThanOrEqual(
      thread.events[1]?.committedAt ?? 0,
    );
    expect(thread.events[0]?.commitSha).toBe(SHA);
  });

  it("throws OpenWorkThreadNotFoundError for unknown id", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-open-work-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedOpenWork(dir, [sampleThread()]);

    expect(() => getOpenWorkThread(dir, "thread:missing")).toThrow(
      OpenWorkThreadNotFoundError,
    );
  });
});
