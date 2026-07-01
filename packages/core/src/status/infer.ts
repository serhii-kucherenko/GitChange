import { desc, eq, inArray } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type {
  OpenWorkStatus,
  OpenWorkThreadEvent,
} from "../schema/zod/open-work.js";

export const INFERENCE_SIGNAL_CODES = {
  KEYWORD_WIP_TODO: "keyword_wip_todo",
  TRAILER_REFS_OPEN: "trailer_refs_open",
  TRAILER_CLOSES: "trailer_closes",
  TRAILER_BREAKING_CHANGE: "trailer_breaking_change",
  DOCS_CODE_DIVERGENCE: "docs_code_divergence",
  STALE_NO_EVENTS: "stale_no_events",
  POSSIBLY_COMPLETE: "possibly_complete",
} as const;

export type InferenceSignalCode =
  (typeof INFERENCE_SIGNAL_CODES)[keyof typeof INFERENCE_SIGNAL_CODES];

export interface InferenceSignal {
  code: InferenceSignalCode;
  detail: string;
}

export interface InferOpenWorkStatusResult {
  status: OpenWorkStatus;
  confidence: number;
  signals: InferenceSignal[];
}

export interface ThreadInferenceInput {
  relatedPaths: string[];
  events: OpenWorkThreadEvent[];
}

export interface DocSnapshotRow {
  path: string;
  commitSha: string;
  content: string | null;
}

const MS_PER_DAY = 86_400_000;
const STALE_THRESHOLD_MS = 90 * MS_PER_DAY;
const RECENT_ACTIVITY_MS = 30 * MS_PER_DAY;

const KEYWORD_PATTERN = /\b(WIP|TODO|FIXME)\b/i;
const TRAILER_REFS_PATTERN = /\bRefs:\s*#?\S+/i;
const TRAILER_CLOSES_PATTERN = /\bCloses:\s*#?\S+/i;
const TRAILER_BREAKING_PATTERN = /\bBREAKING CHANGE:/i;
const COMPLETION_DOC_PATTERN =
  /\b(complete|completed|done|migrated|finished)\b/i;

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pathMatchesRelated(filePath: string, relatedPaths: string[]): boolean {
  for (const related of relatedPaths) {
    if (filePath === related || filePath.startsWith(`${related}/`)) {
      return true;
    }
  }
  return false;
}

function collectCommitMessages(db: DrizzleDb, eventShas: string[]): string[] {
  if (eventShas.length === 0) {
    return [];
  }

  const uniqueShas = [...new Set(eventShas)];
  const rows = db
    .select({
      message: schema.commits.message,
      summary: schema.commits.summary,
    })
    .from(schema.commits)
    .where(inArray(schema.commits.sha, uniqueShas))
    .all();

  return rows.map((row) => `${row.summary}\n${row.message}`);
}

function detectKeywordSignals(messages: string[]): InferenceSignal[] {
  const signals: InferenceSignal[] = [];
  for (const text of messages) {
    if (KEYWORD_PATTERN.test(text)) {
      signals.push({
        code: INFERENCE_SIGNAL_CODES.KEYWORD_WIP_TODO,
        detail: "Recent commit message contains WIP/TODO/FIXME",
      });
      break;
    }
  }
  return signals;
}

function detectTrailerSignals(messages: string[]): InferenceSignal[] {
  const signals: InferenceSignal[] = [];
  let hasRefs = false;
  let hasCloses = false;

  for (const text of messages) {
    if (TRAILER_REFS_PATTERN.test(text)) {
      hasRefs = true;
    }
    if (TRAILER_CLOSES_PATTERN.test(text)) {
      hasCloses = true;
    }
    if (TRAILER_BREAKING_PATTERN.test(text)) {
      signals.push({
        code: INFERENCE_SIGNAL_CODES.TRAILER_BREAKING_CHANGE,
        detail: "Commit message includes BREAKING CHANGE trailer",
      });
    }
  }

  if (hasRefs && !hasCloses) {
    signals.push({
      code: INFERENCE_SIGNAL_CODES.TRAILER_REFS_OPEN,
      detail: "Refs trailer present without matching Closes",
    });
  }

  if (hasCloses) {
    signals.push({
      code: INFERENCE_SIGNAL_CODES.TRAILER_CLOSES,
      detail: "Closes trailer present in commit history",
    });
  }

  return signals;
}

export function detectDocsCodeDivergence(
  relatedPaths: string[],
  docSnapshots: DocSnapshotRow[],
  db: DrizzleDb,
  nowMs: number = Date.now(),
): { diverged: boolean; signals: InferenceSignal[] } {
  const claimsComplete = docSnapshots.some((doc) => {
    const text = doc.content ?? "";
    return COMPLETION_DOC_PATTERN.test(text);
  });

  if (!claimsComplete) {
    return { diverged: false, signals: [] };
  }

  const cutoff = nowMs - RECENT_ACTIVITY_MS;
  const recentChanges = db
    .select({
      path: schema.fileChanges.path,
      committedAt: schema.commits.committedAt,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .orderBy(desc(schema.commits.committedAt))
    .all()
    .filter(
      (row) =>
        row.committedAt >= cutoff && pathMatchesRelated(row.path, relatedPaths),
    );

  if (recentChanges.length === 0) {
    return { diverged: false, signals: [] };
  }

  return {
    diverged: true,
    signals: [
      {
        code: INFERENCE_SIGNAL_CODES.DOCS_CODE_DIVERGENCE,
        detail:
          "Doc claims completion but code paths changed within last 30 days",
      },
    ],
  };
}

export function inferOpenWorkStatus(
  thread: ThreadInferenceInput,
  db: DrizzleDb,
  docSnapshots: DocSnapshotRow[],
  nowMs: number = Date.now(),
): InferOpenWorkStatusResult {
  const signals: InferenceSignal[] = [];
  const { events, relatedPaths } = thread;

  if (events.length === 0) {
    signals.push({
      code: INFERENCE_SIGNAL_CODES.STALE_NO_EVENTS,
      detail: "No indexed events on related paths",
    });
    return {
      status: "unknown",
      confidence: 0.35,
      signals,
    };
  }

  const latestEventAt = Math.max(...events.map((event) => event.committedAt));
  const ageMs = nowMs - latestEventAt;

  if (ageMs >= STALE_THRESHOLD_MS) {
    signals.push({
      code: INFERENCE_SIGNAL_CODES.STALE_NO_EVENTS,
      detail: "No activity on related paths in the last 90 days",
    });
    return {
      status: "stale",
      confidence: 0.7,
      signals,
    };
  }

  const eventShas = events.map((event) => event.commitSha);
  const messages = collectCommitMessages(db, eventShas);

  signals.push(...detectKeywordSignals(messages));
  signals.push(...detectTrailerSignals(messages));

  const { diverged, signals: docSignals } = detectDocsCodeDivergence(
    relatedPaths,
    docSnapshots,
    db,
    nowMs,
  );
  signals.push(...docSignals);

  const inProgressCodes = new Set<InferenceSignalCode>([
    INFERENCE_SIGNAL_CODES.KEYWORD_WIP_TODO,
    INFERENCE_SIGNAL_CODES.TRAILER_REFS_OPEN,
    INFERENCE_SIGNAL_CODES.TRAILER_BREAKING_CHANGE,
    INFERENCE_SIGNAL_CODES.DOCS_CODE_DIVERGENCE,
  ]);

  const hasInProgressSignal = signals.some((signal) =>
    inProgressCodes.has(signal.code),
  );

  if (hasInProgressSignal) {
    let confidence = 0.55;
    if (diverged) {
      confidence = 0.75;
    } else if (
      signals.some((s) => s.code === INFERENCE_SIGNAL_CODES.KEYWORD_WIP_TODO)
    ) {
      confidence = 0.65;
    }
    return {
      status: "in_progress",
      confidence: clampConfidence(confidence),
      signals,
    };
  }

  const hasClosesOnly =
    signals.some((s) => s.code === INFERENCE_SIGNAL_CODES.TRAILER_CLOSES) &&
    !hasInProgressSignal;

  if (hasClosesOnly) {
    signals.push({
      code: INFERENCE_SIGNAL_CODES.POSSIBLY_COMPLETE,
      detail: "Closes trailer suggests work may be finished",
    });
    return {
      status: "completed",
      confidence: 0.6,
      signals,
    };
  }

  signals.push({
    code: INFERENCE_SIGNAL_CODES.POSSIBLY_COMPLETE,
    detail: "No active WIP or trailer signals on recent commits",
  });

  return {
    status: "open",
    confidence: 0.5,
    signals,
  };
}
