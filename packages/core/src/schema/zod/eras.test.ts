import { describe, expect, it } from "vitest";
import {
  EraClaim,
  ErasArtifact,
  InflectionPoint,
  InflectionType,
  NamedEra,
  SEMANTIC_SCHEMA_VERSION,
  assertInflectionType,
} from "./eras.js";

const SHA = "b".repeat(40);

function sampleClaim() {
  return EraClaim.parse({
    text: "The project scaffold landed with core modules.",
    evidence: [{ type: "commit", sha: SHA }],
  });
}

function sampleEra(overrides: Partial<NamedEra> = {}): NamedEra {
  return NamedEra.parse({
    id: "01HXYZ",
    name: "Initial scaffold",
    summary: "Bootstrap era with first commits.",
    startCommitSha: SHA,
    endCommitSha: SHA,
    startAt: 1_700_000_000_000,
    endAt: 1_700_000_100_000,
    signalIds: [1],
    inflections: [],
    claims: [sampleClaim()],
    evidence: [{ type: "commit", sha: SHA }],
    ...overrides,
  });
}

describe("InflectionType", () => {
  it("accepts all ERA-03 taxonomy values", () => {
    for (const value of [
      "tech_pivot",
      "scope_steering",
      "process_shift",
      "team_ownership_change",
    ] as const) {
      expect(InflectionType.parse(value)).toBe(value);
      assertInflectionType(value);
    }
  });
});

describe("InflectionPoint", () => {
  it("requires evidence on every inflection", () => {
    expect(() =>
      InflectionPoint.parse({
        type: "tech_pivot",
        title: "Stack change",
        description: "Moved to TypeScript monorepo.",
        evidence: [],
      }),
    ).toThrow();
  });
});

describe("NamedEra", () => {
  it("rejects eras missing claims", () => {
    expect(() =>
      NamedEra.parse({
        ...sampleEra(),
        claims: [],
      }),
    ).toThrow();
  });

  it("requires at least one signal id", () => {
    expect(() =>
      NamedEra.parse({
        ...sampleEra(),
        signalIds: [],
      }),
    ).toThrow();
  });
});

describe("ErasArtifact", () => {
  it("wraps named eras with metadata", () => {
    const artifact = ErasArtifact.parse({
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: SHA,
      sourceSignalCount: 1,
      eras: [sampleEra()],
    });

    expect(artifact.eras).toHaveLength(1);
    expect(artifact.eras[0]?.claims).toHaveLength(1);
  });
});
