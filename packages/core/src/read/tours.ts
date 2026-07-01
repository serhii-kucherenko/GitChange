import { existsSync } from "node:fs";
import { join } from "node:path";
import { readManifest } from "../schema/manifest.js";
import type { RoleTag, Tour, TourKind } from "../schema/zod/tours.js";
import { readToursArtifact } from "../tours/tours-io.js";

export interface TourSummary {
  id: string;
  kind: TourKind;
  title: string;
  description: string;
  roleTag?: RoleTag;
  topicKey?: string;
  chapterCount: number;
  stopCount: number;
}

export interface TourListResult {
  tours: TourSummary[];
  defaultTourId: string;
}

function isIndexed(gitchangeDir: string): boolean {
  return (
    existsSync(join(gitchangeDir, "index.sqlite")) &&
    readManifest(gitchangeDir) !== null
  );
}

function countStops(tour: Tour): number {
  return tour.chapters.reduce(
    (total, chapter) => total + chapter.stops.length,
    0,
  );
}

function toSummary(tour: Tour): TourSummary {
  const summary: TourSummary = {
    id: tour.id,
    kind: tour.kind,
    title: tour.title,
    description: tour.description,
    chapterCount: tour.chapters.length,
    stopCount: countStops(tour),
  };

  if (tour.kind === "role") {
    return { ...summary, roleTag: tour.roleTag };
  }

  if (tour.kind === "topic") {
    return { ...summary, topicKey: tour.topicKey };
  }

  return summary;
}

export function listTours(gitchangeDir: string): TourListResult | null {
  if (!isIndexed(gitchangeDir)) {
    return null;
  }

  const artifact = readToursArtifact(gitchangeDir);
  if (!artifact || artifact.tours.length === 0) {
    return null;
  }

  return {
    tours: artifact.tours.map(toSummary),
    defaultTourId: artifact.defaultTourId,
  };
}

export function getTourById(
  gitchangeDir: string,
  tourId: string,
): Tour | null {
  if (!isIndexed(gitchangeDir)) {
    return null;
  }

  const artifact = readToursArtifact(gitchangeDir);
  if (!artifact) {
    return null;
  }

  return artifact.tours.find((tour) => tour.id === tourId) ?? null;
}
