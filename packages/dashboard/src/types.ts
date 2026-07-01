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
