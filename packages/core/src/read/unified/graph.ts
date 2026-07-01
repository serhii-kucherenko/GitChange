import {
  readGraph,
  type GraphEdgeDto,
  type GraphNodeDto,
  type GraphReadResult,
} from "../graph.js";
import type { WorkspaceReadContext } from "./workspace-context.js";

export interface ReadGraphUnifiedOptions {
  repoId?: string;
}

function namespaceId(repoId: string, id: string): string {
  if (id.startsWith(`${repoId}:`)) {
    return id;
  }
  return `${repoId}:${id}`;
}

function namespaceNode(node: GraphNodeDto, repoId: string): GraphNodeDto {
  const namespacedId = namespaceId(repoId, node.id);
  const data: GraphNodeDto["data"] = {
    ...node.data,
    label: node.data.label,
  };

  if (data.eraId) {
    data.eraId = namespaceId(repoId, data.eraId);
  }
  if (data.parentEraId) {
    data.parentEraId = namespaceId(repoId, data.parentEraId);
  }

  return {
    id: namespacedId,
    type: node.type,
    repoId,
    data,
  };
}

function namespaceEdge(edge: GraphEdgeDto, repoId: string): GraphEdgeDto {
  return {
    ...edge,
    id: namespaceId(repoId, edge.id),
    source: namespaceId(repoId, edge.source),
    target: namespaceId(repoId, edge.target),
    ...(edge.disclaimer ? { disclaimer: edge.disclaimer } : {}),
  };
}

export function readGraphUnified(
  ctx: WorkspaceReadContext,
  options: ReadGraphUnifiedOptions = {},
): GraphReadResult | null {
  const repos = options.repoId
    ? ctx.repos.filter((repo) => repo.repoId === options.repoId)
    : ctx.repos;

  if (repos.length === 0) {
    return null;
  }

  if (!ctx.isMultiRepo) {
    const repo = repos[0];
    if (!repo) {
      return null;
    }
    return readGraph(repo.gitchangeDir);
  }

  const mergedNodes: GraphNodeDto[] = [];
  const mergedEdges: GraphEdgeDto[] = [];

  for (const repo of repos) {
    const graph = readGraph(repo.gitchangeDir);
    if (!graph) {
      continue;
    }

    for (const node of graph.nodes) {
      mergedNodes.push(namespaceNode(node, repo.repoId));
    }
    for (const edge of graph.edges) {
      mergedEdges.push(namespaceEdge(edge, repo.repoId));
    }
  }

  if (mergedNodes.length === 0) {
    return null;
  }

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
  };
}
