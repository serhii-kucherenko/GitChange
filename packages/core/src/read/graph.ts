import type {
  TemporalGraphEdgeType,
  TemporalGraphNodeType,
} from "../schema/zod/temporal-graph.js";
import { readTemporalGraph } from "../semantic/graph-io.js";

export interface GraphNodeDrillData {
  eraId?: string;
  commitSha?: string;
  parentEraId?: string;
  label?: string;
}

export interface GraphNodeDto {
  id: string;
  type: TemporalGraphNodeType;
  repoId?: string;
  data: GraphNodeDrillData;
}

export interface GraphEdgeDto {
  id: string;
  source: string;
  target: string;
  type: TemporalGraphEdgeType;
  disclaimer?: "historical correlation, not import dependency";
}

export interface GraphReadResult {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

interface EdgeLookup {
  source: string;
  target: string;
  type: string;
}

function buildDrillData(
  node: { id: string; type: TemporalGraphNodeType },
  edges: EdgeLookup[],
): GraphNodeDrillData {
  switch (node.type) {
    case "era":
      return { eraId: node.id, label: node.id };
    case "commit":
      return { commitSha: node.id, label: node.id.slice(0, 7) };
    case "inflection": {
      const parentEdge = edges.find(
        (edge) =>
          edge.target === node.id && edge.type === "era_has_inflection",
      );
      return {
        parentEraId: parentEdge?.source,
        label: node.id,
      };
    }
    case "file":
      return { label: node.id.replace(/^file:/, "") };
    case "contributor":
      return { label: node.id.replace(/^contributor:/, "") };
    default: {
      const exhaustive: never = node.type;
      return exhaustive;
    }
  }
}

function nodeToDto(
  node: { id: string; type: TemporalGraphNodeType },
  edges: EdgeLookup[],
  repoId?: string,
): GraphNodeDto {
  const dto: GraphNodeDto = {
    id: node.id,
    type: node.type,
    data: buildDrillData(node, edges),
  };
  if (repoId) {
    dto.repoId = repoId;
  }
  return dto;
}

export function readGraph(gitchangeDir: string): GraphReadResult | null {
  const artifact = readTemporalGraph(gitchangeDir);
  if (!artifact) {
    return null;
  }

  return {
    nodes: artifact.nodes.map((node) => nodeToDto(node, artifact.edges)),
    edges: artifact.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      ...(edge.disclaimer ? { disclaimer: edge.disclaimer } : {}),
    })),
  };
}
