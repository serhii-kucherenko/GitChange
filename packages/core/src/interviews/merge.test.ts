import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
} from "../schema/zod/decisions.js";
import { InterviewRecord } from "../schema/zod/interview.js";
import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import { writeDecisionsArtifact } from "../decisions/decisions-io.js";
import { isBelowEvidenceThreshold } from "../decisions/threshold.js";
import { mergeInterviewIntoDecisions } from "./merge.js";
import { writeInterviewRecord } from "./store.js";

const SHA = "b".repeat(40);

function sampleDecision(
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  return DecisionRecord.parse({
    id: "decision:01HABC",
    title: "SQLite index store",
    summary: "Local-first OLTP index in .gitchange/index.sqlite.",
    status: "accepted",
    confidence: 0.4,
    evidence: [{ type: "commit", sha: SHA }],
    reviewStatus: "pending",
    miningSource: "agent",
    ...overrides,
  });
}

function seedFixture(
  verdict: "confirm" | "reject",
  options: { writeToDocs?: boolean; confidence?: number } = {},
) {
  const repoRoot = mkdtempSync(join(tmpdir(), "gitchange-repo-"));
  const dir = join(repoRoot, ".gitchange");
  const interviewId = "01HMERGE01";

  writeDecisionsArtifact(dir, {
    schemaVersion: DECISIONS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    decisions: [
      sampleDecision({ confidence: options.confidence ?? 0.4 }),
    ],
  });

  writeInterviewRecord(dir, {
    id: interviewId,
    decisionId: "decision:01HABC",
    question: "Was SQLite adopted for the index?",
    answer: "Yes, we standardized on SQLite for local drill-down.",
    verdict,
    recordedAt: "2026-07-01T12:00:00.000Z",
    maintainer: "bob@example.com",
    writeToDocs: options.writeToDocs,
  });

  return { dir, repoRoot, interviewId };
}

describe("mergeInterviewIntoDecisions", () => {
  it("confirms decision, bumps confidence to at least 0.7, and adds interview evidence", () => {
    const { dir, repoRoot, interviewId } = seedFixture("confirm");

    try {
      const artifact = mergeInterviewIntoDecisions(dir, interviewId);
      const decision = artifact.decisions[0];

      expect(decision?.reviewStatus).toBe("confirmed");
      expect(decision?.miningSource).toBe("interview");
      expect(decision?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(isBelowEvidenceThreshold(decision!)).toBe(false);

      const interviewEvidence = decision?.evidence.find(
        (ref) => ref.type === "interview",
      );
      expect(interviewEvidence).toMatchObject({
        type: "interview",
        path: `interviews/${interviewId}.json`,
        recordedAt: "2026-07-01T12:00:00.000Z",
      });
      expect(interviewEvidence && "excerpt" in interviewEvidence).toBe(true);

      const reloaded = readDecisionsArtifact(dir);
      expect(reloaded?.decisions[0]?.reviewStatus).toBe("confirmed");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects decision without removing it from the artifact", () => {
    const { dir, repoRoot, interviewId } = seedFixture("reject");

    try {
      const artifact = mergeInterviewIntoDecisions(dir, interviewId);
      const decision = artifact.decisions[0];

      expect(decision?.reviewStatus).toBe("rejected");
      expect(decision?.id).toBe("decision:01HABC");
      expect(decision?.miningSource).toBe("agent");
      expect(decision?.evidence.some((ref) => ref.type === "interview")).toBe(
        true,
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("writes docs/interviews markdown when writeToDocs is true on confirm", () => {
    const { dir, repoRoot, interviewId } = seedFixture("confirm", {
      writeToDocs: true,
    });

    try {
      mergeInterviewIntoDecisions(dir, interviewId, { repoRoot });
      const docPath = join(repoRoot, "docs", "interviews", `${interviewId}.md`);
      expect(existsSync(docPath)).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("skips docs writeback when writeToDocs is false", () => {
    const { dir, repoRoot, interviewId } = seedFixture("confirm", {
      writeToDocs: false,
    });

    try {
      mergeInterviewIntoDecisions(dir, interviewId, { repoRoot });
      expect(existsSync(join(repoRoot, "docs", "interviews", `${interviewId}.md`))).toBe(
        false,
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("throws when decisions.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-merge-"));
    const interviewId = "01HMISSING";

    try {
      writeInterviewRecord(dir, InterviewRecord.parse({
        id: interviewId,
        decisionId: "decision:01HABC",
        question: "Q?",
        answer: "A",
        verdict: "confirm",
        recordedAt: "2026-07-01T12:00:00.000Z",
      }));

      expect(() => mergeInterviewIntoDecisions(dir, interviewId)).toThrow(
        /decisions\.json/i,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when target decision is not found", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-merge-"));
    const interviewId = "01HNOTFOUND";

    try {
      writeDecisionsArtifact(dir, {
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: SHA,
        decisions: [sampleDecision({ id: "decision:OTHER" })],
      });

      writeInterviewRecord(dir, {
        id: interviewId,
        decisionId: "decision:01HABC",
        question: "Q?",
        answer: "A",
        verdict: "confirm",
        recordedAt: "2026-07-01T12:00:00.000Z",
      });

      expect(() => mergeInterviewIntoDecisions(dir, interviewId)).toThrow(
        /decision not found/i,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
