/** Node-only @gitchange/core public surface. */
export { CORE_SCHEMA_VERSION, indexFull } from "./index/full.js";
export { indexIncremental } from "./index/incremental.js";
export type { IndexOptions, IndexResult } from "./index/types.js";
export type {
  ComputeIntelligenceOptions,
  ComputeIntelligenceResult,
} from "./intelligence/compute.js";
export { computeIntelligence } from "./intelligence/compute.js";
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
export { runSemanticPipeline } from "./semantic/pipeline.js";
export type { RunSemanticPipelineResult } from "./semantic/pipeline.js";
export {
  checkSemanticIntegrity,
  type SemanticIntegrityReport,
} from "./verify/semantic-integrity.js";
export {
  checkIntelligenceIntegrity,
  type IntelligenceIntegrityReport,
} from "./verify/intelligence-integrity.js";
export {
  BASIC_SCENARIO_SEMANTIC_SNAPSHOT,
  collectSemanticSnapshot,
  type SemanticSnapshot,
} from "./verify/semantic-snapshot.js";
