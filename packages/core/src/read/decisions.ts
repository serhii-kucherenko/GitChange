import { existsSync } from "node:fs";
import { join } from "node:path";
import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import {
  EVD03_GAP_MESSAGE,
  isBelowEvidenceThreshold,
} from "../decisions/threshold.js";
import { readManifest } from "../schema/manifest.js";
import type {
  DecisionRecord,
  DecisionReviewStatus,
  DecisionStatus,
} from "../schema/zod/decisions.js";

export const DEFAULT_DECISION_PAGE_LIMIT = 50;
export const MAX_DECISION_PAGE_LIMIT = 100;

export interface DecisionSummary {
  id: string;
  title: string;
  status: DecisionStatus;
  reviewStatus: DecisionReviewStatus;
  confidence: number;
  evidenceCount: number;
  supersededBy?: string;
}

export interface DecisionListPage {
  decisions: DecisionSummary[];
  nextCursor: string | null;
}

export interface ListDecisionsOptions {
  limit?: number;
  cursor?: string;
}

export interface DecisionGapResponse {
  kind: "gap";
  id: string;
  gap: typeof EVD03_GAP_MESSAGE;
  evidence: [];
}

export interface DecisionRecordResponse {
  kind: "record";
  decision: DecisionRecord;
}

export type DecisionDetailResponse = DecisionGapResponse | DecisionRecordResponse;

export class DecisionNotFoundError extends Error {
  constructor(message = "decision_not_found") {
    super(message);
    this.name = "DecisionNotFoundError";
  }
}

export class InvalidDecisionCursorError extends Error {
  constructor(message = "invalid_cursor") {
    super(message);
    this.name = "InvalidDecisionCursorError";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_DECISION_PAGE_LIMIT;
  }
  return Math.min(Math.max(1, Math.floor(limit)), MAX_DECISION_PAGE_LIMIT);
}

function toSummary(decision: DecisionRecord): DecisionSummary {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    reviewStatus: decision.reviewStatus,
    confidence: decision.confidence,
    evidenceCount: decision.evidence.length,
    supersededBy: decision.supersededBy,
  };
}

function sortByConfidenceDesc(decisions: DecisionRecord[]): DecisionRecord[] {
  return [...decisions].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.id.localeCompare(right.id);
  });
}

export function encodeDecisionCursor(
  confidence: number,
  id: string,
): string {
  return Buffer.from(`${confidence}:${id}`, "utf-8").toString("base64url");
}

export function decodeDecisionCursor(cursor: string): {
  confidence: number;
  id: string;
} {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) {
      throw new InvalidDecisionCursorError();
    }
    const confidence = Number.parseFloat(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (!Number.isFinite(confidence) || id.length === 0) {
      throw new InvalidDecisionCursorError();
    }
    return { confidence, id };
  } catch (error) {
    if (error instanceof InvalidDecisionCursorError) {
      throw error;
    }
    throw new InvalidDecisionCursorError();
  }
}

function isIndexed(gitchangeDir: string): boolean {
  return (
    existsSync(join(gitchangeDir, "index.sqlite")) &&
    readManifest(gitchangeDir) !== null
  );
}

export function listDecisions(
  gitchangeDir: string,
  options: ListDecisionsOptions = {},
): DecisionListPage | null {
  if (!isIndexed(gitchangeDir)) {
    return null;
  }

  const artifact = readDecisionsArtifact(gitchangeDir);
  if (!artifact || artifact.decisions.length === 0) {
    return null;
  }

  const limit = clampLimit(options.limit);
  let sorted = sortByConfidenceDesc(artifact.decisions);

  if (options.cursor) {
    const { confidence, id } = decodeDecisionCursor(options.cursor);
    sorted = sorted.filter((decision) => {
      if (decision.confidence < confidence) {
        return true;
      }
      if (decision.confidence > confidence) {
        return false;
      }
      return decision.id > id;
    });
  }

  const page = sorted.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    sorted.length > limit && last
      ? encodeDecisionCursor(last.confidence, last.id)
      : null;

  return {
    decisions: page.map(toSummary),
    nextCursor,
  };
}

export function getDecisionById(
  gitchangeDir: string,
  id: string,
): DecisionDetailResponse {
  if (!isIndexed(gitchangeDir)) {
    throw new DecisionNotFoundError();
  }

  const artifact = readDecisionsArtifact(gitchangeDir);
  const decision = artifact?.decisions.find((item) => item.id === id);
  if (!decision) {
    throw new DecisionNotFoundError();
  }

  if (isBelowEvidenceThreshold(decision)) {
    return {
      kind: "gap",
      id: decision.id,
      gap: EVD03_GAP_MESSAGE,
      evidence: [],
    };
  }

  return {
    kind: "record",
    decision,
  };
}
