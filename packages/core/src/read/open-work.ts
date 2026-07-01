import { existsSync } from "node:fs";
import { join } from "node:path";
import { readOpenWorkArtifact } from "../decisions/open-work-io.js";
import { readManifest } from "../schema/manifest.js";
import type {
  OpenWorkKind,
  OpenWorkStatus,
  OpenWorkThread,
  OpenWorkThreadEvent,
} from "../schema/zod/open-work.js";
import { validateFilePath } from "./file-history.js";

const STATUS_PRIORITY: Record<OpenWorkStatus, number> = {
  in_progress: 0,
  open: 1,
  unknown: 2,
  stale: 3,
  completed: 4,
};

export interface OpenWorkThreadSummary {
  id: string;
  kind: OpenWorkKind;
  status: OpenWorkStatus;
  title: string;
  confidence: number;
  lastEventAt: number | null;
  linkedDecisionId?: string;
}

export interface OpenWorkListResult {
  threads: OpenWorkThreadSummary[];
}

export interface OpenWorkThreadDetail {
  id: string;
  kind: OpenWorkKind;
  status: OpenWorkStatus;
  title: string;
  summary: string;
  confidence: number;
  relatedPaths: string[];
  linkedDecisionId?: string;
  events: OpenWorkThreadEvent[];
}

export class OpenWorkThreadNotFoundError extends Error {
  constructor(message = "thread_not_found") {
    super(message);
    this.name = "OpenWorkThreadNotFoundError";
  }
}

function isIndexed(gitchangeDir: string): boolean {
  return (
    existsSync(join(gitchangeDir, "index.sqlite")) &&
    readManifest(gitchangeDir) !== null
  );
}

function sanitizePaths(paths: string[]): string[] {
  const sanitized: string[] = [];
  for (const path of paths) {
    try {
      sanitized.push(validateFilePath(path));
    } catch {
      // drop traversal or invalid paths from API output
    }
  }
  return sanitized;
}

function sanitizeEvent(event: OpenWorkThreadEvent): OpenWorkThreadEvent | null {
  const paths = sanitizePaths(event.paths);
  if (paths.length === 0) {
    return null;
  }
  return {
    ...event,
    paths,
  };
}

function sortThreads(threads: OpenWorkThread[]): OpenWorkThread[] {
  return [...threads].sort((left, right) => {
    const priorityDiff = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const leftLast = left.events.at(-1)?.committedAt ?? 0;
    const rightLast = right.events.at(-1)?.committedAt ?? 0;
    return rightLast - leftLast;
  });
}

function toSummary(thread: OpenWorkThread): OpenWorkThreadSummary {
  const lastEvent = thread.events.reduce<OpenWorkThreadEvent | null>(
    (latest, event) => {
      if (!latest || event.committedAt > latest.committedAt) {
        return event;
      }
      return latest;
    },
    null,
  );

  return {
    id: thread.id,
    kind: thread.kind,
    status: thread.status,
    title: thread.title,
    confidence: thread.confidence,
    lastEventAt: lastEvent?.committedAt ?? null,
    linkedDecisionId: thread.linkedDecisionId,
  };
}

function chronologicalEvents(
  events: OpenWorkThreadEvent[],
): OpenWorkThreadEvent[] {
  return [...events]
    .sort((left, right) => {
      if (left.committedAt !== right.committedAt) {
        return left.committedAt - right.committedAt;
      }
      return left.commitSha.localeCompare(right.commitSha);
    })
    .flatMap((event) => {
      const sanitized = sanitizeEvent(event);
      return sanitized ? [sanitized] : [];
    });
}

export function listOpenWork(gitchangeDir: string): OpenWorkListResult | null {
  if (!isIndexed(gitchangeDir)) {
    return null;
  }

  const artifact = readOpenWorkArtifact(gitchangeDir);
  if (!artifact || artifact.threads.length === 0) {
    return null;
  }

  return {
    threads: sortThreads(artifact.threads).map(toSummary),
  };
}

export function getOpenWorkThread(
  gitchangeDir: string,
  id: string,
): OpenWorkThreadDetail {
  if (!isIndexed(gitchangeDir)) {
    throw new OpenWorkThreadNotFoundError();
  }

  const artifact = readOpenWorkArtifact(gitchangeDir);
  const thread = artifact?.threads.find((item) => item.id === id);
  if (!thread) {
    throw new OpenWorkThreadNotFoundError();
  }

  return {
    id: thread.id,
    kind: thread.kind,
    status: thread.status,
    title: thread.title,
    summary: thread.summary,
    confidence: thread.confidence,
    relatedPaths: sanitizePaths(thread.relatedPaths),
    linkedDecisionId: thread.linkedDecisionId,
    events: chronologicalEvents(thread.events),
  };
}
