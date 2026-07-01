import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "../schema/zod/open-work.js";
import { readOpenWorkArtifact, writeOpenWorkArtifact } from "./open-work-io.js";

const SHA = "b".repeat(40);

function sampleThread(): OpenWorkThread {
  return OpenWorkThread.parse({
    id: "thread:01HABC",
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
    ],
    evidence: [{ type: "commit", sha: SHA }],
  });
}

function sampleArtifact(): OpenWorkArtifact {
  return OpenWorkArtifact.parse({
    schemaVersion: OPEN_WORK_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    threads: [sampleThread()],
  });
}

describe("open-work-io", () => {
  it("returns null when open-work.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-open-work-"));

    try {
      expect(readOpenWorkArtifact(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips valid open-work artifact", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-open-work-"));
    const artifact = sampleArtifact();

    try {
      writeOpenWorkArtifact(dir, artifact);
      expect(existsSync(join(dir, "open-work.json"))).toBe(true);

      const loaded = readOpenWorkArtifact(dir);
      expect(loaded?.threads[0]?.id).toBe("thread:01HABC");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects threads without evidence at write boundary", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-open-work-"));

    try {
      expect(() =>
        writeOpenWorkArtifact(dir, {
          ...sampleArtifact(),
          threads: [
            {
              ...sampleThread(),
              evidence: [],
            },
          ],
        }),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
