import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  type NamedEra,
  SEMANTIC_SCHEMA_VERSION,
} from "../schema/zod/eras.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  type CoChangeEdge,
  IntelligenceArtifact,
} from "../schema/zod/intelligence.js";
import {
  TemporalGraphArtifact,
  type TemporalGraphArtifact as TemporalGraphArtifactType,
  type TemporalGraphEdge,
  type TemporalGraphNode,
} from "../schema/zod/temporal-graph.js";
import { readErasArtifact } from "./eras-io.js";

const INTELLIGENCE_FILENAME = "intelligence.json";
const MAX_GRAPH_NODES = 500;

function fileNodeId(path: string): string {
  return `file:${path}`;
}

function contributorNodeId(authorId: number): string {
  return `contributor:${authorId}`;
}

function collectEvidenceFileRefs(eras: NamedEra[]): Map<string, string> {
  const refs = new Map<string, string>();

  const addEvidence = (items: Evidence[]) => {
    for (const item of items) {
      if (item.type === "file") {
        refs.set(item.path, item.commitSha);
      }
    }
  };

  for (const era of eras) {
    addEvidence(era.evidence);
    for (const claim of era.claims) {
      addEvidence(claim.evidence);
    }
    for (const inflection of era.inflections) {
      addEvidence(inflection.evidence);
    }
  }

  return refs;
}

function readIntelligenceArtifact(gitchangeDir: string) {
  const intelligencePath = join(gitchangeDir, INTELLIGENCE_FILENAME);
  if (!existsSync(intelligencePath)) {
    throw new Error(
      `intelligence.json not found in ${gitchangeDir}. Run index and computeIntelligence first.`,
    );
  }

  const raw = readFileSync(intelligencePath, "utf-8");
  return IntelligenceArtifact.parse(JSON.parse(raw));
}

function assertNodeCap(nodes: TemporalGraphNode[]): void {
  if (nodes.length > MAX_GRAPH_NODES) {
    throw new Error(
      `temporal graph exceeds maximum of ${MAX_GRAPH_NODES} nodes (${nodes.length}); use era-level aggregation`,
    );
  }
}

export function assembleTemporalGraph(
  gitchangeDir: string,
): TemporalGraphArtifactType {
  const erasArtifact = readErasArtifact(gitchangeDir);
  if (!erasArtifact) {
    throw new Error(
      `eras.json not found in ${gitchangeDir}. Run era synthesis first.`,
    );
  }

  const intelligence = readIntelligenceArtifact(gitchangeDir);
  const db = openDb(gitchangeDir);

  const nodes = new Map<string, TemporalGraphNode>();
  const edges: TemporalGraphEdge[] = [];

  const addNode = (node: TemporalGraphNode) => {
    nodes.set(node.id, node);
  };

  const addEdge = (
    source: string,
    target: string,
    type: TemporalGraphEdge["type"],
    disclaimer?: CoChangeEdge["disclaimer"],
  ) => {
    edges.push({
      id: ulid(),
      source,
      target,
      type,
      ...(disclaimer ? { disclaimer } : {}),
    });
  };

  const evidenceFiles = collectEvidenceFileRefs(erasArtifact.eras);
  const authorRows = db.select().from(schema.authors).all();
  const authorIdsNeeded = new Set<number>();

  for (const era of erasArtifact.eras) {
    addNode({ id: era.id, type: "era" });

    for (const _ of era.inflections) {
      const inflectionId = `inflection:${ulid()}`;
      addNode({ id: inflectionId, type: "inflection" });
      addEdge(era.id, inflectionId, "era_has_inflection");
    }

    const eraCommits = db
      .select({
        sha: schema.commits.sha,
        authorId: schema.commits.authorId,
      })
      .from(schema.commits)
      .where(
        and(
          gte(schema.commits.committedAt, era.startAt),
          lte(schema.commits.committedAt, era.endAt),
        ),
      )
      .all();

    for (const commit of eraCommits) {
      addNode({ id: commit.sha, type: "commit" });
      addEdge(era.id, commit.sha, "era_contains_commit");
      authorIdsNeeded.add(commit.authorId);
      addEdge(
        contributorNodeId(commit.authorId),
        commit.sha,
        "contributor_authored_commit",
      );
    }
  }

  for (const authorId of authorIdsNeeded) {
    const author = authorRows.find((row) => row.id === authorId);
    if (!author) {
      continue;
    }
    addNode({ id: contributorNodeId(authorId), type: "contributor" });
  }

  for (const [path, commitSha] of evidenceFiles) {
    const nodeId = fileNodeId(path);
    addNode({ id: nodeId, type: "file" });
    addEdge(commitSha, nodeId, "commit_touches_file");
  }

  const graphFilePaths = new Set(evidenceFiles.keys());
  for (const coChange of intelligence.coChange.edges) {
    if (
      !graphFilePaths.has(coChange.pathA) ||
      !graphFilePaths.has(coChange.pathB)
    ) {
      continue;
    }

    addEdge(
      fileNodeId(coChange.pathA),
      fileNodeId(coChange.pathB),
      "files_co_changed",
      coChange.disclaimer,
    );
  }

  const nodeList = [...nodes.values()];
  assertNodeCap(nodeList);

  return TemporalGraphArtifact.parse({
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    nodes: nodeList,
    edges,
  });
}

export { MAX_GRAPH_NODES };
