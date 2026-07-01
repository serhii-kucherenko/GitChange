import { afterEach, describe, expect, it } from "vitest";
import { writeDecisionsArtifact } from "../decisions/decisions-io.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../schema/zod/decisions.js";
import { checkDecisionsIntegrity } from "./decisions-integrity.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";

describe("checkDecisionsIntegrity", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("passes when decision evidence refs resolve in SQLite", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    const sha = (
      await import("../read/commits.js")
    ).listCommits(fixture.gitchangeDir, { limit: 1 })?.commits[0]?.sha;
    expect(sha).toBeDefined();

    writeDecisionsArtifact(
      fixture.gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha!,
        decisions: [
          DecisionRecord.parse({
            id: "decision:01TEST",
            title: "Test decision",
            summary: "Fixture decision with indexed evidence.",
            status: "accepted",
            confidence: 0.8,
            evidence: [{ type: "commit", sha: sha! }],
            reviewStatus: "pending",
            miningSource: "deterministic",
          }),
        ],
      }),
    );

    const report = checkDecisionsIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("fails when decision cites a commit missing from the index", async () => {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);

    writeDecisionsArtifact(
      fixture.gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: "f".repeat(40),
        decisions: [
          DecisionRecord.parse({
            id: "decision:01BAD",
            title: "Bad decision",
            summary: "Dangling evidence ref.",
            status: "proposed",
            confidence: 0.5,
            evidence: [{ type: "commit", sha: "d".repeat(40) }],
            reviewStatus: "pending",
            miningSource: "manual",
          }),
        ],
      }),
    );

    const report = checkDecisionsIntegrity(fixture.gitchangeDir);
    expect(report.ok).toBe(false);
    expect(report.danglingCommitRefs).toContain("d".repeat(40));
  });
});
