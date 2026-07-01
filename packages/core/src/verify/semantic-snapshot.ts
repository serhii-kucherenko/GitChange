import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ErasArtifact } from "../schema/zod/eras.js";
import { TemporalGraphArtifact } from "../schema/zod/temporal-graph.js";

export interface SemanticSnapshot {
  eraCount: number;
  inflectionCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
}

/** Locked counts for tests/fixtures/scenarios.ts BASIC_SCENARIO + basic-scenario eras fixture (Plan 04-05). */
export const BASIC_SCENARIO_SEMANTIC_SNAPSHOT: SemanticSnapshot = {
  eraCount: 2,
  inflectionCount: 2,
  graphNodeCount: 13,
  graphEdgeCount: 19,
};

export function collectSemanticSnapshot(
  gitchangeDir: string,
): SemanticSnapshot {
  const erasPath = join(gitchangeDir, "eras.json");
  const graphPath = join(gitchangeDir, "temporal-graph.json");

  const erasRaw = readFileSync(erasPath, "utf-8");
  const eras = ErasArtifact.parse(JSON.parse(erasRaw));

  const graphRaw = readFileSync(graphPath, "utf-8");
  const graph = TemporalGraphArtifact.parse(JSON.parse(graphRaw));

  const inflectionCount = eras.eras.reduce(
    (total, era) => total + era.inflections.length,
    0,
  );

  return {
    eraCount: eras.eras.length,
    inflectionCount,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
  };
}
