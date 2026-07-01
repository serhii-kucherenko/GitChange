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
  type AttributionConfidence,
  INTELLIGENCE_SCHEMA_VERSION,
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "./schema/zod/intelligence.js";
