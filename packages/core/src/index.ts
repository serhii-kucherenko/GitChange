/** Node-only @gitchange/core public surface. */

export { assembleOpenWork } from "./decisions/assemble-open-work.js";
export {
  capInferredConfidence,
  INFERRED_MEDIUM_CONFIDENCE_CAP,
  resolveDecisionAttribution,
} from "./decisions/attribution.js";
export {
  type DecisionCandidate,
  extractDecisionCandidates,
} from "./decisions/candidates.js";
export {
  buildDecisionMiningContext,
  type DecisionMiningContext,
  type DecisionMiningDocDelta,
  type DecisionMiningErasSummary,
} from "./decisions/context.js";
export {
  readDecisionsArtifact,
  writeDecisionsArtifact,
} from "./decisions/decisions-io.js";
export {
  AgentDecisionMinerOutput,
  mergeDecisionMinerOutput,
} from "./decisions/merge-agent-output.js";
export {
  readOpenWorkArtifact,
  writeOpenWorkArtifact,
} from "./decisions/open-work-io.js";
export {
  EVD03_GAP_MESSAGE,
  isBelowEvidenceThreshold,
} from "./decisions/threshold.js";
export { CORE_SCHEMA_VERSION, indexFull } from "./index/full.js";
export { indexIncremental } from "./index/incremental.js";
export type { IndexOptions, IndexResult } from "./index/types.js";
export type {
  ComputeIntelligenceOptions,
  ComputeIntelligenceResult,
} from "./intelligence/compute.js";
export { computeIntelligence } from "./intelligence/compute.js";
export {
  type CommitDetail,
  type CommitDetailCommit,
  type CommitDetailFile,
  CommitNotFoundError,
  getCommitDetail,
  InvalidCommitShaError,
} from "./read/commit-detail.js";
export {
  type CommitListFilters,
  type CommitListPage,
  type CommitSummary,
  DEFAULT_COMMIT_PAGE_LIMIT,
  decodeCommitCursor,
  encodeCommitCursor,
  InvalidCommitCursorError,
  InvalidCommitFilterError,
  type ListCommitsOptions,
  listCommits,
  MAX_COMMIT_PAGE_LIMIT,
} from "./read/commits.js";
export {
  type DashboardEra,
  type DashboardErasResult,
  listErasForDashboard,
} from "./read/eras.js";
export {
  decodeFileHistoryCursor,
  encodeFileHistoryCursor,
  type FileHistoryEvent,
  type FileHistoryPage,
  type GetFileHistoryOptions,
  getFileHistory,
  InvalidFileHistoryCursorError,
  InvalidFilePathError,
  MAX_FILE_PATH_LENGTH,
  validateFilePath,
} from "./read/file-history.js";
export {
  getRepoSnapshot,
  type RepoSnapshot,
  type RepoSnapshotEraHighlight,
  type RepoSnapshotErasSummary,
  type RepoSnapshotHighlightChurnFile,
  type RepoSnapshotHighlightExpertiseTopic,
  type RepoSnapshotHighlights,
  type RepoSnapshotStats,
} from "./read/snapshot.js";
export {
  type IndexCompleteness,
  type Manifest,
  ManifestSchema,
  type ManifestWarningCode,
  readManifest,
} from "./schema/manifest.js";
export {
  type AttributionConfidence,
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  type DecisionRecord as DecisionRecordType,
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
  Evidence,
  EraClaim,
  type EraClaim as EraClaimType,
  ErasArtifact,
  type ErasArtifact as ErasArtifactType,
  INTELLIGENCE_SCHEMA_VERSION,
  InflectionPoint,
  type InflectionPoint as InflectionPointType,
  InflectionType,
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
  NamedEra,
  type NamedEra as NamedEraType,
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  type OpenWorkArtifact as OpenWorkArtifactType,
  OpenWorkThread,
  type OpenWorkThread as OpenWorkThreadType,
  SEMANTIC_SCHEMA_VERSION,
  TemporalGraphArtifact,
  type TemporalGraphArtifact as TemporalGraphArtifactType,
} from "./schema/zod/index.js";
export { assembleTemporalGraph } from "./semantic/assemble-graph.js";
export {
  buildEraSynthesisContext,
  type EraSynthesisChurnFile,
  type EraSynthesisContext,
  type EraSynthesisDocDelta,
  type EraSynthesisEraSignal,
} from "./semantic/context.js";
export {
  MAX_ERAS,
  readErasArtifact,
  writeErasArtifact,
} from "./semantic/eras-io.js";
export {
  assembleAndWriteTemporalGraph,
  readTemporalGraph,
  writeTemporalGraph,
} from "./semantic/graph-io.js";
export type {
  RunDecisionsPipelineResult,
  RunSemanticPipelineResult,
} from "./semantic/pipeline.js";
export {
  runDecisionsPipeline,
  runSemanticPipeline,
} from "./semantic/pipeline.js";
export {
  detectDocsCodeDivergence,
  INFERENCE_SIGNAL_CODES,
  type InferenceSignal,
  type InferenceSignalCode,
  type InferOpenWorkStatusResult,
  inferOpenWorkStatus,
} from "./status/infer.js";
export {
  buildThreadEvents,
  MAX_THREAD_EVENTS,
} from "./status/thread-events.js";
export {
  checkIntelligenceIntegrity,
  type IntelligenceIntegrityReport,
} from "./verify/intelligence-integrity.js";
export {
  checkSemanticIntegrity,
  type SemanticIntegrityReport,
} from "./verify/semantic-integrity.js";
export {
  BASIC_SCENARIO_SEMANTIC_SNAPSHOT,
  collectSemanticSnapshot,
  type SemanticSnapshot,
} from "./verify/semantic-snapshot.js";
