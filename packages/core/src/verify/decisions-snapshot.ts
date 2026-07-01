import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
} from "../schema/zod/decisions.js";
import {
  OpenWorkArtifact,
  type OpenWorkArtifact as OpenWorkArtifactType,
} from "../schema/zod/open-work.js";

export interface DecisionsSnapshot {
  decisionCount: number;
  threadCount: number;
  incompleteThreadCount: number;
}

/** Locked counts for BASIC_SCENARIO decisions fixture + pipeline (Plan 06-06). */
export const BASIC_SCENARIO_DECISIONS_SNAPSHOT: DecisionsSnapshot = {
  decisionCount: 3,
  threadCount: 1,
  incompleteThreadCount: 1,
};

export function collectDecisionsSnapshot(
  gitchangeDir: string,
): DecisionsSnapshot {
  const decisionsPath = join(gitchangeDir, "decisions.json");
  const openWorkPath = join(gitchangeDir, "open-work.json");

  const decisionsRaw = readFileSync(decisionsPath, "utf-8");
  const decisions = DecisionsArtifact.parse(
    JSON.parse(decisionsRaw),
  ) as DecisionsArtifactType;

  const openWorkRaw = readFileSync(openWorkPath, "utf-8");
  const openWork = OpenWorkArtifact.parse(
    JSON.parse(openWorkRaw),
  ) as OpenWorkArtifactType;

  const incompleteThreadCount = openWork.threads.filter((thread) =>
    ["open", "in_progress", "stale"].includes(thread.status),
  ).length;

  return {
    decisionCount: decisions.decisions.length,
    threadCount: openWork.threads.length,
    incompleteThreadCount,
  };
}
