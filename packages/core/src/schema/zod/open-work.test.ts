import { describe, expect, it } from "vitest";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "./open-work.js";

const SHA = "e".repeat(40);

function sampleThread(overrides: Partial<OpenWorkThread> = {}): OpenWorkThread {
  return OpenWorkThread.parse({
    id: "thread:01HABC",
    kind: "migration",
    status: "in_progress",
    title: "API module migration",
    summary: "Feature branch work still landing in main.",
    confidence: 0.55,
    relatedPaths: ["src/feature.ts"],
    events: [
      {
        commitSha: SHA,
        committedAt: 1_700_000_000_000,
        summary: "feat(api): wire endpoint",
        paths: ["src/feature.ts"],
      },
    ],
    evidence: [{ type: "commit", sha: SHA }],
    ...overrides,
  });
}

describe("OpenWorkThread", () => {
  it("requires thread: id prefix", () => {
    expect(() =>
      OpenWorkThread.parse({
        ...sampleThread(),
        id: "bad-thread",
      }),
    ).toThrow();
  });

  it("rejects empty evidence", () => {
    expect(() =>
      OpenWorkThread.parse({
        ...sampleThread(),
        evidence: [],
      }),
    ).toThrow();
  });

  it("requires events with commitSha and paths", () => {
    const parsed = sampleThread();
    expect(parsed.events[0]?.commitSha).toHaveLength(40);
    expect(parsed.events[0]?.paths.length).toBeGreaterThanOrEqual(1);
  });
});

describe("OpenWorkArtifact", () => {
  it("parses valid fixture", () => {
    const artifact = OpenWorkArtifact.parse({
      schemaVersion: OPEN_WORK_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: SHA,
      threads: [sampleThread()],
    });
    expect(artifact.threads).toHaveLength(1);
  });

  it("rejects more than 20 threads", () => {
    expect(() =>
      OpenWorkArtifact.parse({
        schemaVersion: OPEN_WORK_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: SHA,
        threads: Array.from({ length: 21 }, (_, index) =>
          sampleThread({ id: `thread:0${index}` }),
        ),
      }),
    ).toThrow();
  });
});
