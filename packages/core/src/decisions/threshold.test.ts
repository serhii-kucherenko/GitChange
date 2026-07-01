import { describe, expect, it } from "vitest";
import {
  EVD03_GAP_MESSAGE,
  isBelowEvidenceThreshold,
} from "./threshold.js";
import type { DecisionRecord } from "../schema/zod/decisions.js";

const SHA = "f".repeat(40);

function sampleDecision(
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  return {
    id: "decision:01HABC",
    title: "Test decision",
    summary: "Summary",
    status: "accepted",
    confidence: 0.5,
    evidence: [{ type: "commit", sha: SHA }],
    reviewStatus: "pending",
    miningSource: "deterministic",
    ...overrides,
  };
}

describe("EVD03_GAP_MESSAGE", () => {
  it("matches the exact EVD-03 gap string", () => {
    expect(EVD03_GAP_MESSAGE).toBe("No recorded decision found");
  });
});

describe("isBelowEvidenceThreshold", () => {
  it("returns true when confidence is below 0.35", () => {
    expect(
      isBelowEvidenceThreshold(sampleDecision({ confidence: 0.34 })),
    ).toBe(true);
  });

  it("returns false when confidence is at least 0.35 with evidence", () => {
    expect(
      isBelowEvidenceThreshold(sampleDecision({ confidence: 0.35 })),
    ).toBe(false);
  });

  it("returns true when evidence is empty", () => {
    expect(
      isBelowEvidenceThreshold(sampleDecision({ evidence: [] })),
    ).toBe(true);
  });

  it("returns true when both confidence and evidence are weak", () => {
    expect(
      isBelowEvidenceThreshold(
        sampleDecision({ confidence: 0.1, evidence: [] }),
      ),
    ).toBe(true);
  });
});
