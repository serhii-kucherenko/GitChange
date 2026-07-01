import type {
  OpenWorkStatus,
  OpenWorkThreadEvent,
  OpenWorkThreadSummary,
} from "../types.js";

const INCOMPLETE_STATUSES = new Set<OpenWorkStatus>([
  "open",
  "in_progress",
  "stale",
]);

export interface MatchableOpenWorkThread extends OpenWorkThreadSummary {
  relatedPaths: string[];
  events: OpenWorkThreadEvent[];
}

export interface OpenWorkSurface {
  eraId?: string;
  commitSha?: string;
  path?: string;
  eraWindow?: { startAt: number; endAt: number };
}

function pathsOverlap(left: string[], right: string[]): boolean {
  for (const pathA of left) {
    for (const pathB of right) {
      if (
        pathA === pathB ||
        pathA.startsWith(`${pathB}/`) ||
        pathB.startsWith(`${pathA}/`)
      ) {
        return true;
      }
    }
  }
  return false;
}

function matchesSurface(
  thread: MatchableOpenWorkThread,
  surface: OpenWorkSurface,
): boolean {
  if (surface.commitSha) {
    const hasCommit = thread.events.some(
      (event) => event.commitSha === surface.commitSha,
    );
    if (hasCommit) {
      return true;
    }
  }

  if (surface.path) {
    const surfacePath = surface.path;
    const pathMatch =
      pathsOverlap(thread.relatedPaths, [surfacePath]) ||
      thread.events.some((event) => pathsOverlap(event.paths, [surfacePath]));
    if (pathMatch) {
      return true;
    }
  }

  if (surface.eraWindow) {
    const { startAt, endAt } = surface.eraWindow;
    const inWindow = thread.events.some(
      (event) => event.committedAt >= startAt && event.committedAt <= endAt,
    );
    if (inWindow) {
      return true;
    }
  }

  return false;
}

function toSummary(thread: MatchableOpenWorkThread): OpenWorkThreadSummary {
  return {
    id: thread.id,
    kind: thread.kind,
    status: thread.status,
    title: thread.title,
    confidence: thread.confidence,
    lastEventAt: thread.lastEventAt,
    linkedDecisionId: thread.linkedDecisionId,
  };
}

export function matchOpenWorkToSurface(
  threads: MatchableOpenWorkThread[],
  surface: OpenWorkSurface,
): OpenWorkThreadSummary[] {
  return threads
    .filter((thread) => INCOMPLETE_STATUSES.has(thread.status))
    .filter((thread) => matchesSurface(thread, surface))
    .map(toSummary);
}
