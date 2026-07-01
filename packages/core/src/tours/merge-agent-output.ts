import { ulid } from "ulid";
import { z } from "zod";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  TOURS_SCHEMA_VERSION,
  Tour,
  TourChapter,
  TourStop,
  ToursArtifact,
  type Tour as TourType,
  type ToursArtifact as ToursArtifactType,
} from "../schema/zod/tours.js";
import { buildTourSynthesisContext } from "./context.js";
import { writeToursArtifact } from "./tours-io.js";

export const AgentTourBuilderOutput = ToursArtifact;

export type AgentTourBuilderOutput = z.infer<typeof AgentTourBuilderOutput>;

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function assignStopId(stop: TourStop): TourStop {
  if (stop.id.startsWith("stop:")) {
    return stop;
  }

  return TourStop.parse({
    ...stop,
    id: `stop:${ulid()}`,
  });
}

function assignTourId(tour: TourType): TourType {
  if (tour.id.startsWith("tour:")) {
    return tour;
  }

  return Tour.parse({
    ...tour,
    id: `tour:${ulid()}`,
  });
}

function mergeDefaultTourChapters(
  outlineChapters: TourChapter[],
  agentChapters: TourChapter[],
): TourChapter[] {
  return outlineChapters.map((outlineChapter, index) => {
    const agentChapter =
      agentChapters.find((chapter) => chapter.order === outlineChapter.order) ??
      agentChapters.find(
        (chapter) =>
          chapter.eraIds.length === outlineChapter.eraIds.length &&
          chapter.eraIds.every(
            (eraId, eraIndex) => eraId === outlineChapter.eraIds[eraIndex],
          ),
      ) ??
      agentChapters[index];

    if (!agentChapter) {
      return TourChapter.parse({
        ...outlineChapter,
        stops: outlineChapter.stops.map(assignStopId),
      });
    }

    return TourChapter.parse({
      order: outlineChapter.order,
      eraIds: outlineChapter.eraIds,
      title: agentChapter.title,
      summary: agentChapter.summary,
      stops: agentChapter.stops.map(assignStopId),
    });
  });
}

function mergeDefaultTour(
  outlineChapters: TourChapter[],
  agentTour: Extract<TourType, { kind: "default" }>,
): Extract<TourType, { kind: "default" }> {
  return Tour.parse({
    kind: "default",
    id: agentTour.id,
    title: agentTour.title,
    description: agentTour.description,
    chapters: mergeDefaultTourChapters(outlineChapters, agentTour.chapters),
  }) as Extract<TourType, { kind: "default" }>;
}

function validateEvidenceRefs(
  db: ReturnType<typeof openDb>,
  evidence: Evidence[],
): string[] {
  const commitShas = new Set(
    db
      .select({ sha: schema.commits.sha })
      .from(schema.commits)
      .all()
      .map((row) => row.sha),
  );

  const fileChangeKeys = new Set(
    db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const docSnapshotKeys = new Set(
    db
      .select({
        path: schema.docSnapshots.path,
        commitSha: schema.docSnapshots.commitSha,
      })
      .from(schema.docSnapshots)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const errors: string[] = [];

  for (const ref of evidence) {
    switch (ref.type) {
      case "commit":
        if (!commitShas.has(ref.sha)) {
          errors.push(`unindexed commit evidence: ${ref.sha}`);
        }
        break;
      case "file":
        if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(`unindexed file evidence: ${ref.path}@${ref.commitSha}`);
        }
        break;
      case "doc":
        if (!docSnapshotKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(`unindexed doc evidence: ${ref.path}@${ref.commitSha}`);
        }
        break;
      case "hunk":
        if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(`unindexed hunk evidence: ${ref.path}@${ref.commitSha}`);
        }
        break;
      case "interview":
        break;
      default:
        assertNever(ref);
    }
  }

  return errors;
}

function collectTourEvidence(tours: TourType[]): Evidence[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) =>
      chapter.stops.flatMap((stop) => stop.evidence),
    ),
  );
}

function collectChapterEraIds(tours: TourType[]): string[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) => chapter.eraIds),
  );
}

function collectDrillDecisionIds(tours: TourType[]): string[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) =>
      chapter.stops
        .map((stop) => stop.drillTarget.decisionId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

function validateContextRefs(
  tours: TourType[],
  validEraIds: Set<string>,
  validDecisionIds: Set<string>,
): string[] {
  const errors: string[] = [];

  for (const eraId of collectChapterEraIds(tours)) {
    if (!validEraIds.has(eraId)) {
      errors.push(`unknown eraId: ${eraId}`);
    }
  }

  for (const tour of tours) {
    for (const chapter of tour.chapters) {
      for (const stop of chapter.stops) {
        if (stop.drillTarget.eraId && !validEraIds.has(stop.drillTarget.eraId)) {
          errors.push(`unknown eraId: ${stop.drillTarget.eraId}`);
        }
      }
    }

    if (tour.kind === "role" && !tour.roleTag) {
      errors.push("role tour requires roleTag");
    }

    if (tour.kind === "topic" && !tour.topicKey) {
      errors.push("topic tour requires topicKey");
    }
  }

  for (const decisionId of collectDrillDecisionIds(tours)) {
    if (!validDecisionIds.has(decisionId)) {
      errors.push(`unknown decisionId: ${decisionId}`);
    }
  }

  return errors;
}

export function mergeTourBuilderOutput(
  gitchangeDir: string,
  agentJson: unknown,
): ToursArtifactType {
  const parsed = AgentTourBuilderOutput.parse(agentJson);
  const context = buildTourSynthesisContext(gitchangeDir);

  const validEraIds = new Set(context.eraSummaries.map((era) => era.id));
  const validDecisionIds = new Set(
    context.decisionSeeds.map((decision) => decision.id),
  );

  const agentRefErrors = validateContextRefs(
    parsed.tours,
    validEraIds,
    validDecisionIds,
  );
  if (agentRefErrors.length > 0) {
    throw new Error(agentRefErrors.join("; "));
  }

  const mergedTours = parsed.tours.map((tour) => {
    const withId = assignTourId(tour);
    if (withId.kind === "default") {
      return mergeDefaultTour(context.outlineChapters, withId);
    }
    return withId;
  });

  const contextErrors = validateContextRefs(
    mergedTours,
    validEraIds,
    validDecisionIds,
  );
  if (contextErrors.length > 0) {
    throw new Error(contextErrors.join("; "));
  }

  const db = openDb(gitchangeDir);
  const evidenceErrors = validateEvidenceRefs(
    db,
    collectTourEvidence(mergedTours),
  );
  if (evidenceErrors.length > 0) {
    throw new Error(evidenceErrors.join("; "));
  }

  const artifact = ToursArtifact.parse({
    schemaVersion: parsed.schemaVersion ?? TOURS_SCHEMA_VERSION,
    computedAt: parsed.computedAt,
    headSha: parsed.headSha,
    defaultTourId: parsed.defaultTourId,
    tours: mergedTours,
  });

  writeToursArtifact(gitchangeDir, artifact);
  return artifact;
}
