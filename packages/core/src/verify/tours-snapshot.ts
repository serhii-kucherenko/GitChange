import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ToursArtifact,
  type ToursArtifact as ToursArtifactType,
} from "../schema/zod/tours.js";
import {
  checkToursIntegrity,
  type ToursIntegrityReport,
} from "./tours-integrity.js";

const MIN_DEFAULT_CHAPTERS = 4;
const MAX_DEFAULT_CHAPTERS = 6;

export interface ToursEvidenceSnapshot {
  tourCount: number;
  defaultTourChapterCount: number;
  roleTourCount: number;
  topicTourCount: number;
  totalStopCount: number;
}

/** Locked counts for BASIC_SCENARIO tours fixture after bind (Plan 07-05). */
export const BASIC_SCENARIO_TOURS_SNAPSHOT: ToursEvidenceSnapshot = {
  tourCount: 3,
  defaultTourChapterCount: 4,
  roleTourCount: 1,
  topicTourCount: 1,
  totalStopCount: 6,
};

export interface ToursEvidenceIntegrityReport extends ToursIntegrityReport {
  snapshot: ToursEvidenceSnapshot;
}

function loadToursArtifact(
  gitchangeDir: string,
): ToursArtifactType | null {
  const toursPath = join(gitchangeDir, "tours.json");

  try {
    const raw = readFileSync(toursPath, "utf-8");
    return ToursArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function collectToursEvidenceSnapshot(
  gitchangeDir: string,
): ToursEvidenceSnapshot {
  const tours = loadToursArtifact(gitchangeDir);
  if (!tours) {
    return {
      tourCount: 0,
      defaultTourChapterCount: 0,
      roleTourCount: 0,
      topicTourCount: 0,
      totalStopCount: 0,
    };
  }

  const defaultTour = tours.tours.find((tour) => tour.kind === "default");
  const roleTourCount = tours.tours.filter((tour) => tour.kind === "role").length;
  const topicTourCount = tours.tours.filter(
    (tour) => tour.kind === "topic",
  ).length;

  const totalStopCount = tours.tours.reduce(
    (total, tour) =>
      total +
      tour.chapters.reduce(
        (chapterTotal, chapter) => chapterTotal + chapter.stops.length,
        0,
      ),
    0,
  );

  return {
    tourCount: tours.tours.length,
    defaultTourChapterCount: defaultTour?.chapters.length ?? 0,
    roleTourCount,
    topicTourCount,
    totalStopCount,
  };
}

export function verifyToursEvidenceIntegrity(
  gitchangeDir: string,
): ToursEvidenceIntegrityReport {
  const integrity = checkToursIntegrity(gitchangeDir);
  const snapshot = collectToursEvidenceSnapshot(gitchangeDir);
  const errors = [...integrity.errors];

  const tours = loadToursArtifact(gitchangeDir);
  if (!tours) {
    errors.push("tours.json not found");
    return {
      ...integrity,
      ok: false,
      errors,
      snapshot,
    };
  }

  const defaultTour = tours.tours.find((tour) => tour.kind === "default");
  if (!defaultTour) {
    errors.push("default kind tour missing from tours artifact");
  } else if (
    defaultTour.chapters.length < MIN_DEFAULT_CHAPTERS ||
    defaultTour.chapters.length > MAX_DEFAULT_CHAPTERS
  ) {
    errors.push(
      `default tour chapter count ${defaultTour.chapters.length} outside ${MIN_DEFAULT_CHAPTERS}-${MAX_DEFAULT_CHAPTERS}`,
    );
  }

  if (snapshot.roleTourCount < 1) {
    errors.push("at least one role tour required in fixture");
  }

  if (snapshot.topicTourCount < 1) {
    errors.push("at least one topic tour required in fixture");
  }

  for (const tour of tours.tours) {
    for (const chapter of tour.chapters) {
      for (const stop of chapter.stops) {
        if (stop.evidence.length === 0) {
          errors.push(`stop ${stop.id} has no evidence`);
        }
      }
    }
  }

  return {
    ...integrity,
    ok: errors.length === 0,
    errors,
    snapshot,
  };
}
