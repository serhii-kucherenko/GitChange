import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EraClaim, ErasArtifact, NamedEra } from "../schema/zod/eras.js";
import { readErasArtifact, writeErasArtifact } from "./eras-io.js";

const SHA = "d".repeat(40);

function sampleEra(): NamedEra {
  return NamedEra.parse({
    id: "01HABC",
    name: "Bootstrap era",
    summary: "Initial project setup and docs.",
    startCommitSha: SHA,
    endCommitSha: SHA,
    startAt: 1_700_000_000_000,
    endAt: 1_700_000_100_000,
    signalIds: [1],
    inflections: [],
    claims: [
      EraClaim.parse({
        text: "Core scaffold landed in the first commits.",
        evidence: [
          { type: "doc", path: "README.md", commitSha: SHA, excerpt: "# Fixture" },
        ],
      }),
    ],
    evidence: [{ type: "commit", sha: SHA }],
  });
}

function sampleArtifact(): ErasArtifact {
  return ErasArtifact.parse({
    schemaVersion: "1",
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    sourceSignalCount: 1,
    eras: [sampleEra()],
  });
}

describe("eras-io", () => {
  it("returns null when eras.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-eras-"));

    try {
      expect(readErasArtifact(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips signalIds and claim evidence", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-eras-"));
    const artifact = sampleArtifact();

    try {
      writeErasArtifact(dir, artifact);
      expect(existsSync(join(dir, "eras.json"))).toBe(true);

      const loaded = readErasArtifact(dir);
      expect(loaded?.eras[0]?.signalIds).toEqual([1]);
      expect(loaded?.eras[0]?.claims[0]?.evidence[0]?.type).toBe("doc");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid artifacts with empty claims at write time", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-eras-"));

    try {
      expect(() =>
        writeErasArtifact(dir, {
          ...sampleArtifact(),
          eras: [
            {
              ...sampleEra(),
              claims: [],
            },
          ],
        }),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on corrupt JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-eras-"));

    try {
      writeErasArtifact(dir, sampleArtifact());
      const erasPath = join(dir, "eras.json");
      const raw = readFileSync(erasPath, "utf-8").replace('"schemaVersion"', '"broken"');
      rmSync(erasPath);
      writeFileSync(erasPath, raw);

      expect(() => readErasArtifact(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects more than eight eras", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitchange-eras-"));
    const era = sampleEra();

    try {
      expect(() =>
        writeErasArtifact(dir, {
          ...sampleArtifact(),
          eras: Array.from({ length: 9 }, (_, index) => ({
            ...era,
            id: `era-${index}`,
            signalIds: [index + 1],
          })),
        }),
      ).toThrow(/exceeds maximum of 8/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
