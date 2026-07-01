import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeDecisionsArtifact } from "../decisions/decisions-io.js";
import { EVD03_GAP_MESSAGE } from "../decisions/threshold.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../schema/zod/decisions.js";
import { ManifestSchema } from "../schema/manifest.js";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  getDecisionById,
  listDecisions,
  DecisionNotFoundError,
} from "./decisions.js";

const SHA = "a".repeat(40);

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

function sampleDecision(
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  return DecisionRecord.parse({
    id: "decision:01HIGH",
    title: "SQLite index store",
    summary: "Local-first OLTP index in .gitchange/index.sqlite.",
    status: "accepted",
    confidence: 0.8,
    evidence: [{ type: "commit", sha: SHA }],
    reviewStatus: "pending",
    miningSource: "deterministic",
    ...overrides,
  });
}

function seedDecisions(
  gitchangeDir: string,
  decisions: DecisionRecord[],
): void {
  writeMinimalManifest(gitchangeDir);
  writeDecisionsArtifact(
    gitchangeDir,
    DecisionsArtifact.parse({
      schemaVersion: DECISIONS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: SHA,
      decisions,
    }),
  );
}

describe("listDecisions", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns null when decisions.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeMinimalManifest(dir);

    expect(listDecisions(dir)).toBeNull();
  });

  it("returns summaries sorted by confidence descending", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedDecisions(dir, [
      sampleDecision({
        id: "decision:01LOW",
        title: "Low confidence",
        confidence: 0.4,
      }),
      sampleDecision({
        id: "decision:01HIGH",
        title: "High confidence",
        confidence: 0.9,
      }),
    ]);

    const result = listDecisions(dir);
    expect(result).not.toBeNull();
    expect(result?.decisions.map((item) => item.id)).toEqual([
      "decision:01HIGH",
      "decision:01LOW",
    ]);
    expect(result?.decisions[0]?.evidenceCount).toBe(1);
    expect(result?.decisions[0]?.reviewStatus).toBe("pending");
  });

  it("paginates with cursor", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedDecisions(dir, [
      sampleDecision({ id: "decision:01A", confidence: 0.9 }),
      sampleDecision({ id: "decision:01B", confidence: 0.8 }),
      sampleDecision({ id: "decision:01C", confidence: 0.7 }),
    ]);

    const firstPage = listDecisions(dir, { limit: 2 });
    expect(firstPage?.decisions).toHaveLength(2);
    expect(firstPage?.nextCursor).toBeTruthy();

    const secondPage = listDecisions(dir, {
      limit: 2,
      cursor: firstPage?.nextCursor ?? undefined,
    });
    expect(secondPage?.decisions).toHaveLength(1);
    expect(secondPage?.nextCursor).toBeNull();
  });
});

describe("getDecisionById", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns full record when above evidence threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedDecisions(dir, [sampleDecision()]);

    const detail = getDecisionById(dir, "decision:01HIGH");
    expect(detail.kind).toBe("record");
    if (detail.kind === "record") {
      expect(detail.decision.summary).toContain("sqlite");
      expect(detail.decision.title).toBe("SQLite index store");
    }
  });

  it("returns gap response when below evidence threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    seedDecisions(dir, [
      sampleDecision({ id: "decision:01LOW", confidence: 0.2 }),
    ]);

    const detail = getDecisionById(dir, "decision:01LOW");
    expect(detail.kind).toBe("gap");
    if (detail.kind === "gap") {
      expect(detail.id).toBe("decision:01LOW");
      expect(detail.gap).toBe(EVD03_GAP_MESSAGE);
      expect(detail.evidence).toEqual([]);
      expect("summary" in detail).toBe(false);
      expect("title" in detail).toBe(false);
    }
  });

  it("throws DecisionNotFoundError for unknown id", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-read-decisions-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    seedDecisions(dir, [sampleDecision()]);

    expect(() => getDecisionById(dir, "decision:missing")).toThrow(
      DecisionNotFoundError,
    );
  });
});
