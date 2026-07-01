import { describe, expect, it } from "vitest";
import { EraClaim, ErasArtifact, NamedEra } from "../schema/zod/eras.js";
import { outlineDefaultTourChapters } from "./outline.js";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function makeEra(
  id: string,
  name: string,
  startAt: number,
  endAt: number,
  sha = SHA_A,
): NamedEra {
  return NamedEra.parse({
    id,
    name,
    summary: `${name} summary.`,
    startCommitSha: sha,
    endCommitSha: sha,
    startAt,
    endAt,
    signalIds: [1],
    inflections: [],
    claims: [
      EraClaim.parse({
        text: `${name} claim.`,
        evidence: [{ type: "commit", sha }],
      }),
    ],
    evidence: [{ type: "commit", sha }],
  });
}

function makeArtifact(eras: NamedEra[]): ErasArtifact {
  return ErasArtifact.parse({
    schemaVersion: "1",
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA_A,
    sourceSignalCount: eras.length,
    eras,
  });
}

describe("outlineDefaultTourChapters", () => {
  it("returns 4-6 chapters for an 8-era fixture", () => {
    const eras = Array.from({ length: 8 }, (_, index) =>
      makeEra(
        `era:${index + 1}`,
        `Era ${index + 1}`,
        1_700_000_000_000 + index * 100_000,
        1_700_000_000_000 + (index + 1) * 100_000,
      ),
    );

    const chapters = outlineDefaultTourChapters(makeArtifact(eras));

    expect(chapters.length).toBeGreaterThanOrEqual(4);
    expect(chapters.length).toBeLessThanOrEqual(6);
    expect(chapters.map((chapter) => chapter.order)).toEqual(
      chapters.map((_, index) => index + 1),
    );
  });

  it("orders chapters by era chronology", () => {
    const eras = [
      makeEra("era:late", "Late", 3, 4),
      makeEra("era:early", "Early", 1, 2),
      makeEra("era:mid", "Mid", 2, 3),
      makeEra("era:last", "Last", 4, 5),
    ];

    const chapters = outlineDefaultTourChapters(makeArtifact(eras));

    expect(chapters[0]?.title).toContain("Early");
    expect(chapters[chapters.length - 1]?.title).toContain("Last");
  });

  it("includes placeholder stops with commit drill targets from era evidence", () => {
    const eras = [
      makeEra("era:1", "One", 1, 2, SHA_A),
      makeEra("era:2", "Two", 2, 3, SHA_B),
      makeEra("era:3", "Three", 3, 4, SHA_C),
      makeEra("era:4", "Four", 4, 5, SHA_A),
    ];

    const chapters = outlineDefaultTourChapters(makeArtifact(eras));

    for (const chapter of chapters) {
      expect(chapter.stops.length).toBeGreaterThanOrEqual(1);
      expect(chapter.stops[0]?.drillTarget.commitSha).toHaveLength(40);
      expect(chapter.stops[0]?.evidence.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("expands fewer than 4 eras by splitting the largest era", () => {
    const eras = [
      makeEra("era:1", "Bootstrap", 1, 10),
      makeEra("era:2", "Growth", 11, 12),
    ];

    const chapters = outlineDefaultTourChapters(makeArtifact(eras));

    expect(chapters.length).toBeGreaterThanOrEqual(4);
    expect(chapters.length).toBeLessThanOrEqual(6);
  });

  it("is deterministic for the same eras input", () => {
    const artifact = makeArtifact([
      makeEra("era:1", "One", 1, 2),
      makeEra("era:2", "Two", 2, 3),
      makeEra("era:3", "Three", 3, 4),
      makeEra("era:4", "Four", 4, 5),
      makeEra("era:5", "Five", 5, 6),
      makeEra("era:6", "Six", 6, 7),
      makeEra("era:7", "Seven", 7, 8),
    ]);

    const first = outlineDefaultTourChapters(artifact);
    const second = outlineDefaultTourChapters(artifact);

    expect(first).toEqual(second);
  });
});
