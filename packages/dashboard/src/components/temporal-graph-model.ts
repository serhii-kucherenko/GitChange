import type { GraphEdge, GraphNode, GraphResponse } from "../api/client.js";

export type GraphDrillAction =
  | { kind: "era"; eraId: string; repoId?: string }
  | { kind: "commit"; sha: string; repoId?: string }
  | { kind: "inflection"; parentEraId: string; repoId?: string }
  | { kind: "none" };

export function resolveGraphNodeDrillAction(node: GraphNode): GraphDrillAction {
  switch (node.type) {
    case "era":
      return node.data.eraId
        ? { kind: "era", eraId: node.data.eraId, repoId: node.repoId }
        : { kind: "none" };
    case "commit":
      return node.data.commitSha
        ? { kind: "commit", sha: node.data.commitSha, repoId: node.repoId }
        : { kind: "none" };
    case "inflection":
      return node.data.parentEraId
        ? {
            kind: "inflection",
            parentEraId: node.data.parentEraId,
            repoId: node.repoId,
          }
        : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

export function visibleGraphNodeIds(
  graph: GraphResponse,
  expandedEraIds: ReadonlySet<string>,
): Set<string> {
  const visible = new Set<string>();

  for (const node of graph.nodes) {
    if (node.type === "era" || node.type === "inflection") {
      visible.add(node.id);
    }
  }

  for (const edge of graph.edges) {
    if (
      edge.type === "era_contains_commit" &&
      expandedEraIds.has(edge.source)
    ) {
      visible.add(edge.target);
    }
  }

  return visible;
}

export function visibleGraphEdges(
  graph: GraphResponse,
  visibleNodeIds: ReadonlySet<string>,
): GraphEdge[] {
  return graph.edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  );
}

export interface FlowNodeLayout {
  id: string;
  x: number;
  y: number;
}

export function layoutGraphNodes(
  nodes: GraphNode[],
  visibleIds: ReadonlySet<string>,
): FlowNodeLayout[] {
  const eraNodes = nodes.filter(
    (node) => node.type === "era" && visibleIds.has(node.id),
  );
  const inflectionNodes = nodes.filter(
    (node) => node.type === "inflection" && visibleIds.has(node.id),
  );
  const commitNodes = nodes.filter(
    (node) => node.type === "commit" && visibleIds.has(node.id),
  );

  const layouts: FlowNodeLayout[] = [];
  const eraXById = new Map<string, number>();

  eraNodes.forEach((node, index) => {
    const x = index * 280;
    eraXById.set(node.id, x);
    layouts.push({ id: node.id, x, y: 120 });
  });

  for (const node of inflectionNodes) {
    const parentEraId = node.data.parentEraId;
    const x = parentEraId ? (eraXById.get(parentEraId) ?? 0) : 0;
    layouts.push({ id: node.id, x: x + 40, y: 20 });
  }

  commitNodes.forEach((node, index) => {
    layouts.push({ id: node.id, x: (index % 4) * 140, y: 240 + Math.floor(index / 4) * 80 });
  });

  return layouts;
}
