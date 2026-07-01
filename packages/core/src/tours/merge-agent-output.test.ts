import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeDecisionsArtifact } from "../decisions/decisions-io.js";
import { writeOpenWorkArtifact } from "../decisions/open-work-io.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
} from "../schema/zod/decisions.js";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  OpenWorkThread,
} from "../schema/zod/open-work.js";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  type TourChapter,
} from "../schema/zod/tours.js";
import { applyBasicScenarioErasFixture } from "../../../../tests/golden/semantic-fixture.js";
import { indexBasicScenario } from "../../../../tests/golden/helpers.js";
import { buildTourSynthesisContext } from "./context.js";
import { mergeTourBuilderOutput } from "./merge-agent-output.js";
import { readToursArtifact } from "./tours-io.js";

describe("mergeTourBuilderOutput", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  async function toursFixture() {
    const fixture = await indexBasicScenario();
    cleanups.push(fixture.cleanup);
    applyBasicScenarioErasFixture(fixture.gitchangeDir);

    const sha = JSON.parse(
      readFileSync(join(fixture.gitchangeDir, "intelligence.json"), "utf-8"),
    ).headSha as string;

    writeDecisionsArtifact(
      fixture.gitchangeDir,
      DecisionsArtifact.parse({
        schemaVersion: DECISIONS_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha,
        decisions: [
          DecisionRecord.parse({
            id: "decision:01GOOD",
            title: "Indexed decision",
            summary: "Above threshold.",
            status: "accepted",
            confidence: 0.8,
            evidence: [{ type: "commit", sha }],
            reviewStatus: "pending",
            miningSource: "deterministic",
          }),
        ],
      }),
    );

    writeOpenWorkArtifact(
      fixture.gitchangeDir,
      OpenWorkArtifact.parse({
        schemaVersion: OPEN_WORK_SCHEMA_VERSION,
        computedAt: "2026-07-01T00:00:00.000Z",
        headSha: sha,
        threads: [
          OpenWorkThread.parse({
            id: "thread:01OPEN",
            kind: "wip",
            status: "open",
            title: "Open thread",
            summary: "Fixture thread.",
            confidence: 0.6,
            relatedPaths: ["src/main.ts"],
            events: [
              {
                commitSha: sha,
                committedAt: 1_700_000_000_000,
                summary: "Touch main",
                paths: ["src/main.ts"],
              },
            ],
            evidence: [{ type: "commit", sha }],
          }),
        ],
      }),
    );

    return fixture;
  }

  function buildAgentOutput(gitchangeDir: string) {
    const context = buildTourSynthesisContext(gitchangeDir);
    const defaultTourId = "tour:01DEFAULT";

    const chapters: TourChapter[] = context.outlineChapters.map((chapter) => ({
      ...chapter,
      title: `Agent ${chapter.title}`,
      summary: `Agent summary for ${chapter.title}.`,
      stops: chapter.stops.map((stop) => ({
        ...stop,
        narrative: "Agent-refined narrative backed by indexed evidence.",
      })),
    }));

    const defaultTour = Tour.parse({
      id: defaultTourId,
      kind: "default",
      title: "Onboarding tour",
      description: "Default guided tour for new contributors.",
      chapters,
    });

    return {
      schemaVersion: TOURS_SCHEMA_VERSION,
      computedAt: "2026-07-01T00:00:00.000Z",
      headSha: context.headSha,
      defaultTourId,
      tours: [
        defaultTour,
        Tour.parse({
          id: "tour:01BACKEND",
          kind: "role",
          roleTag: "backend",
          title: "Backend tour",
          description: "Backend path emphasis.",
          chapters: [chapters[0]!],
        }),
      ],
    };
  }

  it("merges valid agent output preserving default outline chapter order", async () => {
    const { gitchangeDir } = await toursFixture();
    const context = buildTourSynthesisContext(gitchangeDir);
    const agentJson = buildAgentOutput(gitchangeDir);

    const artifact = mergeTourBuilderOutput(gitchangeDir, agentJson);

    expect(artifact.tours).toHaveLength(2);
    const defaultTour = artifact.tours.find((tour) => tour.kind === "default");
    expect(defaultTour?.chapters.map((chapter) => chapter.order)).toEqual(
      context.outlineChapters.map((chapter) => chapter.order),
    );
    expect(defaultTour?.chapters.map((chapter) => chapter.eraIds)).toEqual(
      context.outlineChapters.map((chapter) => chapter.eraIds),
    );
    expect(defaultTour?.chapters[0]?.title).toMatch(/^Agent /);

    const loaded = readToursArtifact(gitchangeDir);
    expect(loaded?.defaultTourId).toBe("tour:01DEFAULT");
  });

  it("rejects invented era id references", async () => {
    const { gitchangeDir } = await toursFixture();
    const agentJson = buildAgentOutput(gitchangeDir);
    const defaultTour = agentJson.tours[0]!;
    defaultTour.chapters[0]!.eraIds = ["era:INVENTED"];

    expect(() => mergeTourBuilderOutput(gitchangeDir, agentJson)).toThrow(
      /unknown eraId/,
    );
  });

  it("rejects role tour without roleTag", async () => {
    const { gitchangeDir } = await toursFixture();
    const agentJson = buildAgentOutput(gitchangeDir);
    const roleTour = agentJson.tours[1] as Record<string, unknown>;
    delete roleTour.roleTag;

    expect(() => mergeTourBuilderOutput(gitchangeDir, agentJson)).toThrow();
  });
});
