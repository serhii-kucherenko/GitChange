import { describe, expect, it } from "vitest";
import { Evidence } from "./evidence.js";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
} from "./tours.js";

const SHA = "a".repeat(40);

function sampleStop(overrides: Partial<TourStop> = {}): TourStop {
  return TourStop.parse({
    id: "stop:01",
    narrative: "Fixture stop narrative.",
    evidence: [{ type: "commit", sha: SHA }],
    drillTarget: { eraId: "era:01" },
    ...overrides,
  });
}

function sampleChapter(order: number, eraId = "era:01"): TourChapter {
  return TourChapter.parse({
    order,
    title: `Chapter ${order}`,
    summary: "Chapter summary.",
    eraIds: [eraId],
    stops: [sampleStop()],
  });
}

function defaultTourChapters(count: number): TourChapter[] {
  return Array.from({ length: count }, (_, index) =>
    sampleChapter(index + 1, `era:0${index + 1}`),
  );
}

function sampleDefaultTour(
  chapters = defaultTourChapters(4),
): Extract<Tour, { kind: "default" }> {
  return Tour.parse({
    id: "tour:default",
    kind: "default",
    title: "Onboarding tour",
    description: "Default guided tour.",
    chapters,
  });
}

function sampleArtifact(
  tours: Tour[] = [sampleDefaultTour()],
): ToursArtifact {
  return ToursArtifact.parse({
    schemaVersion: TOURS_SCHEMA_VERSION,
    computedAt: "2026-07-01T00:00:00.000Z",
    headSha: SHA,
    defaultTourId: "tour:default",
    tours,
  });
}

describe("ToursArtifact", () => {
  it("parses a valid minimal default tour artifact", () => {
    const artifact = sampleArtifact();
    expect(artifact.schemaVersion).toBe("1");
    expect(artifact.tours).toHaveLength(1);
    expect(artifact.tours[0]?.kind).toBe("default");
    expect(artifact.tours[0]?.chapters).toHaveLength(4);
  });

  it("rejects a stop without evidence", () => {
    expect(() =>
      TourStop.parse({
        id: "stop:bad",
        narrative: "No evidence stop.",
        evidence: [],
        drillTarget: { commitSha: SHA },
      }),
    ).toThrow();
  });

  it("rejects a stop with empty drillTarget", () => {
    expect(() =>
      TourStop.parse({
        id: "stop:bad",
        narrative: "Missing drill target.",
        evidence: [{ type: "commit", sha: SHA }],
        drillTarget: {},
      }),
    ).toThrow(/drillTarget/);
  });

  it("rejects a default tour with only 3 chapters", () => {
    expect(() => sampleDefaultTour(defaultTourChapters(3))).toThrow();
  });

  it("rejects two default tours in one artifact", () => {
    expect(() =>
      sampleArtifact([
        sampleDefaultTour(),
        sampleDefaultTour(defaultTourChapters(5)),
      ]),
    ).toThrow(/default tour/);
  });

  it("rejects role tour without roleTag", () => {
    expect(() =>
      Tour.parse({
        id: "tour:role-backend",
        kind: "role",
        title: "Backend tour",
        description: "Backend emphasis.",
        chapters: [sampleChapter(1)],
      }),
    ).toThrow();
  });

  it("rejects topic tour without topicKey", () => {
    expect(() =>
      Tour.parse({
        id: "tour:topic-auth",
        kind: "topic",
        title: "Auth thread",
        description: "Auth across eras.",
        chapters: [sampleChapter(1)],
      }),
    ).toThrow();
  });

  it("rejects narrative longer than 400 characters", () => {
    expect(() =>
      sampleStop({ narrative: "x".repeat(401) }),
    ).toThrow();
  });

  it("accepts role and topic tours within caps", () => {
    const artifact = sampleArtifact([
      sampleDefaultTour(),
      Tour.parse({
        id: "tour:role-backend",
        kind: "role",
        roleTag: "backend",
        title: "Backend tour",
        description: "Backend paths.",
        chapters: [sampleChapter(1)],
      }),
      Tour.parse({
        id: "tour:topic-auth",
        kind: "topic",
        topicKey: "auth",
        title: "Auth thread",
        description: "Auth topic.",
        chapters: [sampleChapter(1)],
      }),
    ]);

    expect(artifact.tours).toHaveLength(3);
  });
});
