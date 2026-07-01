export type IndexCompleteness = "complete" | "partial";

export type ManifestWarningCode =
  | "shallow_clone"
  | "force_push_detected"
  | "out_of_order_commits";

export interface ManifestWarning {
  code: ManifestWarningCode;
  message: string;
}

export interface Manifest {
  schemaVersion: string;
  lastIndexedCommit: string;
  indexedAt: string;
  repo: {
    head: string;
    branch: string | null;
  };
  indexCompleteness: IndexCompleteness;
  warnings: ManifestWarning[];
  intelligenceComputedAt?: string;
  intelligenceHeadSha?: string;
  intelligenceSchemaVersion?: string;
  semanticComputedAt?: string;
  semanticHeadSha?: string;
  semanticSchemaVersion?: string;
}

export type AttributionConfidence = "complete" | "degraded";

export interface IntelligenceSnapshot {
  attributionConfidence?: AttributionConfidence;
}

export interface SnapshotResponse {
  manifest: Manifest;
  stats: {
    commitCount: number;
    fileChangeCount: number;
    authorCount: number;
  };
  intelligence: IntelligenceSnapshot | null;
  highlights: {
    topChurnFiles: { path: string; changeCount: number }[];
    topExpertiseTopics: { topic: string; label: string }[];
  };
}

export type DecisionStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "superseded"
  | "in_flight"
  | "unknown";

export type DecisionReviewStatus = "pending" | "confirmed" | "rejected";

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

export type DecisionEvidence =
  | { type: "commit"; sha: string }
  | { type: "file"; path: string; commitSha: string }
  | {
      type: "doc";
      path: string;
      commitSha: string;
      excerpt: string;
    }
  | {
      type: "hunk";
      path: string;
      commitSha: string;
      startLine: number;
      endLine: number;
      excerpt: string;
    }
  | {
      type: "interview";
      path: string;
      recordedAt: string;
      excerpt: string;
    };

export interface DecisionRecord {
  id: string;
  title: string;
  summary: string;
  status: DecisionStatus;
  confidence: number;
  evidence: DecisionEvidence[];
  reviewStatus: DecisionReviewStatus;
  miningSource: "deterministic" | "agent" | "interview" | "manual";
  relatedPaths?: string[];
  supersededBy?: string;
  supersedes?: string[];
}

export interface DecisionGapResponse {
  id: string;
  gap: string;
  evidence: [];
}

export type DecisionDetail = DecisionRecord | DecisionGapResponse;

export function isDecisionGap(
  detail: DecisionDetail,
): detail is DecisionGapResponse {
  return "gap" in detail;
}

export const EVD03_GAP_MESSAGE = "No recorded decision found";

export type OpenWorkKind = "migration" | "refactor" | "wip" | "stale";

export type OpenWorkStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "stale"
  | "unknown";

export interface OpenWorkThreadSummary {
  id: string;
  kind: OpenWorkKind;
  status: OpenWorkStatus;
  title: string;
  confidence: number;
  lastEventAt: number | null;
  linkedDecisionId?: string;
}

export interface OpenWorkListPage {
  threads: OpenWorkThreadSummary[];
}

export interface OpenWorkThreadEvent {
  commitSha: string;
  committedAt: number;
  summary: string;
  paths: string[];
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
  order: "chronological";
}

export type SidebarTab = "eras" | "decisions" | "open-work";
