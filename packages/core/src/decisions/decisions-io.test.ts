import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../schema/zod/decisions.js";
import { readDecisionsArtifact, writeDecisionsArtifact } from "./decisions-io.js";

const SHA = "d".repeat(40);

function sampleDecision(): DecisionRecord {
  return DecisionRecord.parse({
    id: "decision:01HABC",
    title: "SQLite index store",
    summary: "Local-first OLTP index in .gitchange/index.sqlite.",
    status: "accepted",
    confidence: 0.8,
    evidence: [{ type: "commit", sha: SHA }],
    reviewStatus: "pending",
    miningSource: "deterministic",
  });
}

function sampleArtifact(): DecisionsArtifact {
  return DecisionsArtifact.parse({
    schemaVersion: DECISIONS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    decisions: [sampleDecision()],
  });
}

describe("decisions-io", () => {
  it("returns null when decisions.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-decisions-"));

    try {
      expect(readDecisionsArtifact(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips valid decisions artifact", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-decisions-"));
    const artifact = sampleArtifact();

    try {
      writeDecisionsArtifact(dir, artifact);
      expect(existsSync(join(dir, "decisions.json"))).toBe(true);

      const loaded = readDecisionsArtifact(dir);
      expect(loaded?.decisions[0]?.id).toBe("decision:01HABC");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid artifacts at write boundary", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-decisions-"));

    try {
      expect(() =>
        writeDecisionsArtifact(dir, {
          ...sampleArtifact(),
          decisions: [
            {
              ...sampleDecision(),
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
