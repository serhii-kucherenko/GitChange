import type { CrossRepoLink } from "../../schema/zod/workspace.js";
import type { Tour, RoleTag } from "../../schema/zod/tours.js";
import { readToursArtifact } from "../../tours/tours-io.js";
import {
  getTourById,
  listTours,
  type TourListResult,
  type TourSummary,
} from "../tours.js";
import type { WorkspaceReadContext } from "./workspace-context.js";

export interface MergedToursResult {
  list: TourListResult;
  toursById: Map<string, Tour>;
}

function namespaceId(repoId: string, id: string): string {
  if (id.includes(":") && id.startsWith(`${repoId}:`)) {
    return id;
  }
  return `${repoId}:${id}`;
}

function linkLabelsForRepo(
  repoId: string,
  links: CrossRepoLink[],
): string[] {
  return links
    .filter(
      (link) =>
        link.sourceRepoId === repoId || link.targetRepoId === repoId,
    )
    .map((link) => link.label);
}

function namespaceDrillTarget(
  repoId: string,
  target: Tour["chapters"][number]["stops"][number]["drillTarget"],
): Tour["chapters"][number]["stops"][number]["drillTarget"] {
  return {
    ...target,
    eraId: target.eraId ? namespaceId(repoId, target.eraId) : undefined,
    decisionId: target.decisionId
      ? namespaceId(repoId, target.decisionId)
      : undefined,
  };
}

function namespaceStop(
  repoId: string,
  stop: Tour["chapters"][number]["stops"][number],
): Tour["chapters"][number]["stops"][number] {
  return {
    ...stop,
    id: namespaceId(repoId, stop.id),
    repoId,
    evidence: stop.evidence.map((item) => ({ ...item, repoId })),
    drillTarget: namespaceDrillTarget(repoId, stop.drillTarget),
  };
}

function namespaceTour(
  tour: Tour,
  repoId: string,
  links: CrossRepoLink[],
): Tour {
  const linkNotes = linkLabelsForRepo(repoId, links);
  const description =
    linkNotes.length > 0
      ? `${tour.description}\n\nCross-repo links: ${linkNotes.join(", ")}`
      : tour.description;

  const chapters = tour.chapters.map((chapter) => ({
    ...chapter,
    eraIds: chapter.eraIds.map((eraId) => namespaceId(repoId, eraId)),
    stops: chapter.stops.map((stop) => namespaceStop(repoId, stop)),
  }));

  const namespaced: Tour = {
    ...tour,
    id: namespaceId(repoId, tour.id),
    description,
    chapters,
  };

  return namespaced;
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
    return { ...summary, roleTag: tour.roleTag as RoleTag };
  }

  if (tour.kind === "topic") {
    return { ...summary, topicKey: tour.topicKey };
  }

  return summary;
}

export function mergeToursForWorkspace(
  ctx: WorkspaceReadContext,
): MergedToursResult | null {
  const mergedTours: Tour[] = [];
  const primaryRepoId =
    ctx.workspace?.primaryRepoId ?? ctx.repos[0]?.repoId ?? null;

  for (const repo of ctx.repos) {
    const artifact = readToursArtifact(repo.gitchangeDir);
    if (!artifact) {
      continue;
    }

    for (const tour of artifact.tours) {
      mergedTours.push(namespaceTour(tour, repo.repoId, ctx.links));
    }
  }

  if (mergedTours.length === 0) {
    return null;
  }

  const defaultTour =
    mergedTours.find(
      (tour) =>
        tour.kind === "default" &&
        primaryRepoId &&
        tour.id === namespaceId(primaryRepoId, "tour:default"),
    ) ??
    mergedTours.find((tour) => tour.kind === "default") ??
    mergedTours[0]!;

  const list: TourListResult = {
    tours: mergedTours.map(toSummary),
    defaultTourId: defaultTour.id,
  };

  return {
    list,
    toursById: new Map(mergedTours.map((tour) => [tour.id, tour])),
  };
}

export function listToursUnified(
  ctx: WorkspaceReadContext,
): TourListResult | null {
  if (!ctx.isMultiRepo) {
    const repo = ctx.repos[0];
    if (!repo) {
      return null;
    }
    return listTours(repo.gitchangeDir);
  }

  return mergeToursForWorkspace(ctx)?.list ?? null;
}

export function getTourByIdUnified(
  ctx: WorkspaceReadContext,
  tourId: string,
): Tour | null {
  if (!ctx.isMultiRepo) {
    const repo = ctx.repos[0];
    if (!repo) {
      return null;
    }
    return getTourById(repo.gitchangeDir, tourId);
  }

  return mergeToursForWorkspace(ctx)?.toursById.get(tourId) ?? null;
}
