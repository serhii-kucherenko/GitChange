import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AttributionConfidence } from "../schema/zod/intelligence.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";

export interface IntelligenceSnapshot {
  churnFiles: number;
  coChangeEdges: number;
  ownershipFiles: number;
  eraBoundaries: number;
  expertiseTopics: number;
  attributionConfidence: AttributionConfidence;
}

/** Locked counts for tests/fixtures/scenarios.ts BASIC_SCENARIO (Plan 02-05). */
export const BASIC_SCENARIO_INTELLIGENCE_SNAPSHOT: IntelligenceSnapshot = {
  churnFiles: 6,
  coChangeEdges: 1,
  ownershipFiles: 5,
  eraBoundaries: 2,
  expertiseTopics: 3,
  attributionConfidence: "complete",
};

export function collectIntelligenceSnapshot(
  gitchangeDir: string,
): IntelligenceSnapshot {
  const intelligencePath = join(gitchangeDir, "intelligence.json");
  const raw = readFileSync(intelligencePath, "utf-8");
  const artifact = IntelligenceArtifact.parse(JSON.parse(raw));

  return {
    churnFiles: artifact.churn.files.length,
    coChangeEdges: artifact.coChange.edges.length,
    ownershipFiles: artifact.ownership.files.length,
    eraBoundaries: artifact.eraSignals.boundaries.length,
    expertiseTopics: artifact.expertise.topics.length,
    attributionConfidence: artifact.attributionConfidence,
  };
}
