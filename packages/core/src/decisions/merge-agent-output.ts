import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionRecord,
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
  type DecisionRecord as DecisionRecordType,
} from "../schema/zod/decisions.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import type { Evidence } from "../schema/zod/evidence.js";
import { buildDecisionMiningContext } from "./context.js";
import { writeDecisionsArtifact } from "./decisions-io.js";
import {
  capInferredConfidence,
  resolveDecisionAttribution,
} from "./attribution.js";

const INTELLIGENCE_FILENAME = "intelligence.json";

const AgentDecisionRecord = DecisionRecord.omit({
  reviewStatus: true,
  miningSource: true,
  attribution: true,
}).extend({
  candidateId: z.string().min(1),
});

export const AgentDecisionMinerOutput = DecisionsArtifact.omit({
  decisions: true,
}).extend({
  decisions: z.array(AgentDecisionRecord).max(40),
});

export type AgentDecisionMinerOutput = z.infer<typeof AgentDecisionMinerOutput>;

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function validateEvidenceRefs(
  db: ReturnType<typeof openDb>,
  evidence: Evidence[],
): string[] {
  const commitShas = new Set(
    db
      .select({ sha: schema.commits.sha })
      .from(schema.commits)
      .all()
      .map((row) => row.sha),
  );

  const fileChangeKeys = new Set(
    db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const docSnapshotKeys = new Set(
    db
      .select({
        path: schema.docSnapshots.path,
        commitSha: schema.docSnapshots.commitSha,
      })
      .from(schema.docSnapshots)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const errors: string[] = [];

  for (const ref of evidence) {
    switch (ref.type) {
      case "commit":
        if (!commitShas.has(ref.sha)) {
          errors.push(`unindexed commit evidence: ${ref.sha}`);
        }
        break;
      case "file":
        if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(
            `unindexed file evidence: ${ref.path}@${ref.commitSha}`,
          );
        }
        break;
      case "doc":
        if (!docSnapshotKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(`unindexed doc evidence: ${ref.path}@${ref.commitSha}`);
        }
        break;
      case "hunk":
        if (!commitShas.has(ref.commitSha)) {
          errors.push(`unindexed hunk commit: ${ref.commitSha}`);
        }
        if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
          errors.push(
            `unindexed hunk file: ${ref.path}@${ref.commitSha}`,
          );
        }
        break;
      case "interview":
        break;
      default:
        assertNever(ref);
    }
  }

  return errors;
}

function detectSupersessionCycle(decisions: DecisionRecordType[]): string | null {
  const graph = new Map<string, Set<string>>();

  const addEdge = (from: string, to: string) => {
    const edges = graph.get(from) ?? new Set<string>();
    edges.add(to);
    graph.set(from, edges);
  };

  for (const decision of decisions) {
    if (decision.supersededBy) {
      addEdge(decision.id, decision.supersededBy);
    }
    for (const priorId of decision.supersedes ?? []) {
      addEdge(decision.id, priorId);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of graph.keys()) {
    if (visit(node)) {
      return `supersession cycle detected involving decision ${node}`;
    }
  }

  return null;
}

function readIntelligenceArtifact(
  gitchangeDir: string,
): IntelligenceArtifactType {
  const intelligencePath = join(gitchangeDir, INTELLIGENCE_FILENAME);
  if (!existsSync(intelligencePath)) {
    throw new Error(
      `intelligence.json not found in ${gitchangeDir}. Run index and computeIntelligence first.`,
    );
  }

  const raw = readFileSync(intelligencePath, "utf-8");
  return IntelligenceArtifact.parse(JSON.parse(raw));
}

export function mergeDecisionMinerOutput(
  gitchangeDir: string,
  agentJson: unknown,
): DecisionsArtifactType {
  const parsed = AgentDecisionMinerOutput.parse(agentJson);
  const context = buildDecisionMiningContext(gitchangeDir);
  const validCandidateIds = new Set(
    context.candidates.map((candidate) => candidate.candidateId),
  );

  const db = openDb(gitchangeDir);
  const intelligence = readIntelligenceArtifact(gitchangeDir);
  const evidenceErrors: string[] = [];

  for (const decision of parsed.decisions) {
    if (!validCandidateIds.has(decision.candidateId)) {
      throw new Error(`unknown candidateId: ${decision.candidateId}`);
    }

    evidenceErrors.push(...validateEvidenceRefs(db, decision.evidence));
  }

  if (evidenceErrors.length > 0) {
    throw new Error(evidenceErrors.join("; "));
  }

  const mergedDecisions: DecisionRecordType[] = parsed.decisions.map(
    (decision) => {
      const { candidateId: _candidateId, ...rest } = decision;
      const attribution = resolveDecisionAttribution(db, rest, intelligence);

      return DecisionRecord.parse({
        ...rest,
        confidence: capInferredConfidence(rest.confidence, rest.evidence),
        reviewStatus: "pending",
        miningSource: "agent",
        attribution,
      });
    },
  );

  const cycleError = detectSupersessionCycle(mergedDecisions);
  if (cycleError) {
    throw new Error(cycleError);
  }

  const artifact = DecisionsArtifact.parse({
    schemaVersion: parsed.schemaVersion ?? DECISIONS_SCHEMA_VERSION,
    computedAt: parsed.computedAt,
    headSha: parsed.headSha,
    decisions: mergedDecisions,
  });

  writeDecisionsArtifact(gitchangeDir, artifact);
  return artifact;
}
