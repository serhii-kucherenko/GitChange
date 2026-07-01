import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InterviewRecord } from "../schema/zod/interview.js";
import {
  readInterviewRecord,
  writeInterviewRecord,
} from "./store.js";

const SHA = "a".repeat(40);

function sampleRecord(overrides: Partial<InterviewRecord> = {}): InterviewRecord {
  return InterviewRecord.parse({
    id: "01HINTERVIEW",
    decisionId: "decision:01HABC",
    question: "Did the team adopt SQLite for the local index store?",
    answer: "Yes — we chose SQLite for OLTP drill-down in .gitchange.",
    verdict: "confirm",
    recordedAt: "2026-07-01T12:00:00.000Z",
    maintainer: "alice@example.com",
    ...overrides,
  });
}

describe("interview store", () => {
  it("writes interview JSON under .gitchange/interviews/", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-"));
    const record = sampleRecord();

    try {
      writeInterviewRecord(dir, record);
      const filePath = join(dir, "interviews", "01HINTERVIEW.json");
      expect(existsSync(filePath)).toBe(true);

      const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(parsed.decisionId).toBe("decision:01HABC");
      expect(parsed.verdict).toBe("confirm");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips via readInterviewRecord", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-"));
    const record = sampleRecord({ id: "01HROUNDTRIP" });

    try {
      writeInterviewRecord(dir, record);
      const loaded = readInterviewRecord(dir, "01HROUNDTRIP");
      expect(loaded.id).toBe("01HROUNDTRIP");
      expect(loaded.answer).toContain("SQLite");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in interview id on read", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-"));

    try {
      expect(() => readInterviewRecord(dir, "../decisions")).toThrow(
        /path traversal|path segments/i,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in interview id on write", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-"));

    try {
      expect(() =>
        writeInterviewRecord(
          dir,
          sampleRecord({ id: "../evil" }),
        ),
      ).toThrow(/path traversal|path segments/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects answers over 2000 characters", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-interview-"));

    try {
      expect(() =>
        writeInterviewRecord(
          dir,
          sampleRecord({ answer: "x".repeat(2001) }),
        ),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires decisionId prefix", () => {
    expect(() =>
      sampleRecord({ decisionId: "not-a-decision" }),
    ).toThrow();
    expect(SHA).toHaveLength(40);
  });
});
