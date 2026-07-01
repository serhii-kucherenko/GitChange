import { describe, expect, it } from "vitest";
import type { GraphNode, GraphResponse } from "../api/client.js";
import {
  layoutGraphNodes,
  resolveGraphNodeDrillAction,
  visibleGraphEdges,
  visibleGraphNodeIds,
} from "./temporal-graph-model.js";

const SHA = "a".repeat(40);

function sampleGraph(): GraphResponse {
  return {
    nodes: [
      { id: "era:01", type: "era", data: { eraId: "era:01", label: "era:01" } },
      {
        id: SHA,
        type: "commit",
        data: { commitSha: SHA, label: SHA.slice(0, 7) },
      },
      {
        id: "inflection:01",
        type: "inflection",
        data: { parentEraId: "era:01", label: "inflection:01" },
      },
    ],
    edges: [
      {
        id: "e1",
        source: "era:01",
        target: SHA,
        type: "era_contains_commit",
      },
      {
        id: "e2",
        source: "era:01",
        target: "inflection:01",
        type: "era_has_inflection",
      },
    ],
  };
}

describe("temporal-graph-model", () => {
  it("shows era and inflection nodes before expansion", () => {
    const visible = visibleGraphNodeIds(sampleGraph(), new Set());
    expect([...visible].sort()).toEqual(["era:01", "inflection:01"].sort());
  });

  it("reveals commit nodes when era is expanded", () => {
    const visible = visibleGraphNodeIds(sampleGraph(), new Set(["era:01"]));
    expect(visible.has(SHA)).toBe(true);
  });

  it("filters edges to visible nodes only", () => {
    const visible = visibleGraphNodeIds(sampleGraph(), new Set(["era:01"]));
    const edges = visibleGraphEdges(sampleGraph(), visible);
    expect(edges.map((edge) => edge.id).sort()).toEqual(["e1", "e2"].sort());
  });

  it("resolves drill actions for era and commit nodes", () => {
    const eraNode: GraphNode = {
      id: "alpha:era:01",
      type: "era",
      repoId: "alpha",
      data: { eraId: "alpha:era:01" },
    };
    const commitNode: GraphNode = {
      id: `alpha:${SHA}`,
      type: "commit",
      repoId: "alpha",
      data: { commitSha: SHA },
    };

    expect(resolveGraphNodeDrillAction(eraNode)).toEqual({
      kind: "era",
      eraId: "alpha:era:01",
      repoId: "alpha",
    });
    expect(resolveGraphNodeDrillAction(commitNode)).toEqual({
      kind: "commit",
      sha: SHA,
      repoId: "alpha",
    });
  });

  it("assigns layout coordinates for visible nodes", () => {
    const graph = sampleGraph();
    const visible = visibleGraphNodeIds(graph, new Set());
    const layouts = layoutGraphNodes(graph.nodes, visible);
    expect(layouts).toHaveLength(2);
    expect(layouts[0]?.x).toBeGreaterThanOrEqual(0);
  });
});
