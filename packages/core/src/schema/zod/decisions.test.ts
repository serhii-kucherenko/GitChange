import { describe, expect, it } from "vitest";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "./decisions.js";

const SHA = "c".repeat(40);

function sampleDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return DecisionRecord.parse({
    id: "decision:01HABC",
    title: "Adopt SQLite for local index",
    summary: "Indexed storage uses SQLite for OLTP drill-down.",
    status: "accepted",
    confidence: 0.72,
    evidence: [{ type: "commit", sha: SHA }],
    reviewStatus: "pending",
    miningSource: "deterministic",
    ...overrides,
  });
}

describe("DecisionRecord", () => {
  it("requires decision: id prefix", () => {
    expect(() =>
      DecisionRecord.parse({
        ...sampleDecision(),
        id: "bad-id",
      }),
    ).toThrow();
  });

  it("rejects empty evidence", () => {
    expect(() =>
      DecisionRecord.parse({
        ...sampleDecision(),
        evidence: [],
      }),
    ).toThrow();
  });

  it("accepts supersession fields", () => {
    const parsed = DecisionRecord.parse({
      ...sampleDecision(),
      supersededBy: "decision:01HNEW",
      supersedes: ["decision:01HOLD"],
    });
    expect(parsed.supersededBy).toBe("decision:01HNEW");
    expect(parsed.supersedes).toEqual(["decision:01HOLD"]);
  });

  it("accepts optional attribution with evidence", () => {
    const parsed = DecisionRecord.parse({
      ...sampleDecision(),
      attribution: {
        authorId: 1,
        name: "Alice",
        email: "alice@example.com",
        rationale: "Led the indexing spike.",
        evidence: [{ type: "commit", sha: SHA }],
      },
    });
    expect(parsed.attribution?.name).toBe("Alice");
  });

  it("rejects attribution without evidence", () => {
    expect(() =>
      DecisionRecord.parse({
        ...sampleDecision(),
        attribution: {
          authorId: 1,
          name: "Alice",
          email: "alice@example.com",
          rationale: "Led the indexing spike.",
          evidence: [],
        },
      }),
    ).toThrow();
  });
});

describe("DecisionsArtifact", () => {
  it("parses valid fixture", () => {
    const artifact = DecisionsArtifact.parse({
      schemaVersion: DECISIONS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: SHA,
      decisions: [sampleDecision()],
    });
    expect(artifact.decisions).toHaveLength(1);
  });

  it("rejects more than 40 decisions", () => {
    expect(() =>
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: SHA,
        decisions: Array.from({ length: 41 }, (_, index) =>
          sampleDecision({ id: `decision:0${index}` }),
        ),
      }),
    ).toThrow();
  });
});
