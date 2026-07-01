/** Node-only @gitchange/core public surface. */
export { CORE_SCHEMA_VERSION } from "./index/full.js";
export { indexFull } from "./index/full.js";
export { indexIncremental } from "./index/incremental.js";
export type { IndexOptions, IndexResult } from "./index/types.js";
export { computeIntelligence } from "./intelligence/compute.js";
export type {
  ComputeIntelligenceOptions,
  ComputeIntelligenceResult,
} from "./intelligence/compute.js";
export {
  INTELLIGENCE_SCHEMA_VERSION,
  IntelligenceArtifact,
  type AttributionConfidence,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "./schema/zod/intelligence.js";
export { computeIntelligence } from "./intelligence/compute.js";
export type {
  ComputeIntelligenceOptions,
  ComputeIntelligenceResult,
} from "./intelligence/compute.js";
export {
  INTELLIGENCE_SCHEMA_VERSION,
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "./schema/zod/intelligence.js";
