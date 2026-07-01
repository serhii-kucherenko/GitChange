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
  type RepoSnapshotHighlights,
  type RepoSnapshotHighlightChurnFile,
  type RepoSnapshotHighlightExpertiseTopic,
  type RepoSnapshotStats,
} from "./read/snapshot.js";
export {
  readManifest,
  ManifestSchema,
  type Manifest,
  type ManifestWarningCode,
  type IndexCompleteness,
} from "./schema/manifest.js";
export {
  EraClaim,
  ErasArtifact,
  InflectionPoint,
  InflectionType,
  INTELLIGENCE_SCHEMA_VERSION,
  IntelligenceArtifact,
  NamedEra,
  SEMANTIC_SCHEMA_VERSION,
  TemporalGraphArtifact,
  type AttributionConfidence,
  type EraClaim as EraClaimType,
  type ErasArtifact as ErasArtifactType,
  type InflectionPoint as InflectionPointType,
  type IntelligenceArtifact as IntelligenceArtifactType,
  type NamedEra as NamedEraType,
  type TemporalGraphArtifact as TemporalGraphArtifactType,
} from "./schema/zod/index.js";
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
