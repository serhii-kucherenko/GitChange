import {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import type { DashboardEra, GraphNode, GraphResponse } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import { repoColorClass, useWorkspaceStore } from "../store/workspace.js";
import { RepoBadge } from "./RepoBadge.js";
import {
  layoutGraphNodes,
  resolveGraphNodeDrillAction,
  visibleGraphEdges,
  visibleGraphNodeIds,
} from "./temporal-graph-model.js";

interface TemporalGraphViewProps {
  graph: GraphResponse;
  eras: DashboardEra[];
  onDrillToTimeline: () => void;
}

function findEra(
  eras: DashboardEra[],
  eraId: string,
): DashboardEra | undefined {
  return eras.find((era) => era.id === eraId);
}

function nodeLabel(node: GraphNode): string {
  if (node.type === "era") {
    return node.data.label?.replace(/^era:/, "") ?? node.id;
  }
  if (node.type === "commit") {
    return node.data.commitSha?.slice(0, 7) ?? node.id;
  }
  return node.data.label ?? node.id;
}

function nodeClassName(node: GraphNode): string {
  const base =
    "rounded-md border px-3 py-2 text-xs shadow-sm transition-colors";
  if (node.repoId) {
    return `${base} ${repoColorClass(node.repoId)}`;
  }
  switch (node.type) {
    case "era":
      return `${base} border-sky-700 bg-sky-950/60 text-sky-100`;
    case "commit":
      return `${base} border-slate-600 bg-slate-900 text-slate-200`;
    case "inflection":
      return `${base} border-amber-700 bg-amber-950/50 text-amber-100`;
    default:
      return `${base} border-slate-700 bg-slate-900 text-slate-300`;
  }
}

function TemporalGraphCanvas({
  graph,
  eras,
  onDrillToTimeline,
}: TemporalGraphViewProps) {
  const [expandedEraIds, setExpandedEraIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const setSelectedEraId = useDrillStore((state) => state.setSelectedEraId);
  const setSelectedCommitSha = useDrillStore(
    (state) => state.setSelectedCommitSha,
  );
  const isMultiRepo = useWorkspaceStore(
    (state) => state.snapshot?.isMultiRepo ?? false,
  );

  const visibleIds = useMemo(
    () => visibleGraphNodeIds(graph, expandedEraIds),
    [expandedEraIds, graph],
  );

  const visibleNodes = useMemo(
    () => graph.nodes.filter((node) => visibleIds.has(node.id)),
    [graph.nodes, visibleIds],
  );

  const layouts = useMemo(
    () => layoutGraphNodes(graph.nodes, visibleIds),
    [graph.nodes, visibleIds],
  );

  const flowNodes: Node[] = useMemo(
    () =>
      visibleNodes.map((node) => {
        const layout = layouts.find((entry) => entry.id === node.id);
        return {
          id: node.id,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          data: { label: nodeLabel(node) },
          className: nodeClassName(node),
          style: { width: node.type === "era" ? 220 : 120 },
        };
      }),
    [layouts, visibleNodes],
  );

  const flowEdges: Edge[] = useMemo(() => {
    const edges = visibleGraphEdges(graph, visibleIds);
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.type === "era_contains_commit",
      label: edge.type === "files_co_changed" ? "co-changed" : undefined,
    }));
  }, [graph, visibleIds]);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  const toggleEraExpansion = useCallback((eraId: string) => {
    setExpandedEraIds((current) => {
      const next = new Set(current);
      if (next.has(eraId)) {
        next.delete(eraId);
      } else {
        next.add(eraId);
      }
      return next;
    });
  }, []);

  const applyDrillAction = useCallback(
    (node: GraphNode) => {
      const action = resolveGraphNodeDrillAction(node);
      switch (action.kind) {
        case "era": {
          const era = findEra(eras, action.eraId);
          if (era) {
            setSelectedEraId({
              id: era.id,
              name: era.name,
              startAt: era.startAt,
              endAt: era.endAt,
            });
            onDrillToTimeline();
          }
          break;
        }
        case "commit":
          setSelectedCommitSha(action.sha, action.repoId ?? null);
          onDrillToTimeline();
          break;
        case "inflection": {
          const era = findEra(eras, action.parentEraId);
          if (era) {
            setSelectedEraId({
              id: era.id,
              name: era.name,
              startAt: era.startAt,
              endAt: era.endAt,
            });
            onDrillToTimeline();
          }
          break;
        }
        case "none":
          break;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    },
    [eras, onDrillToTimeline, setSelectedCommitSha, setSelectedEraId],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, flowNode) => {
      const node = graph.nodes.find((entry) => entry.id === flowNode.id);
      if (!node) {
        return;
      }

      setSelectedNodeId(node.id);

      if (node.type === "era") {
        toggleEraExpansion(node.id);
      }

      applyDrillAction(node);
    },
    [applyDrillAction, graph.nodes, toggleEraExpansion],
  );

  return (
    <div className="flex min-h-[32rem] flex-1 flex-col gap-3">
      <div className="min-h-[32rem] flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={onNodeClick}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        {selectedNode ? (
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>
              <span className="text-slate-400">Type:</span> {selectedNode.type}
            </span>
            <span className="font-mono break-all">{selectedNode.id}</span>
            {selectedNode.repoId && isMultiRepo ? (
              <RepoBadge repoId={selectedNode.repoId} />
            ) : null}
            {selectedNode.type === "era" ? (
              <span>
                Click to expand commits in this era and drill the timeline.
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Select an era or inflection node to inspect drill targets.
          </p>
        )}
      </div>
    </div>
  );
}

export function TemporalGraphView(props: TemporalGraphViewProps) {
  return (
    <ReactFlowProvider>
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            Temporal knowledge graph
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Eras and inflection points load first. Click an era to reveal its
            commits, then drill into the timeline.
          </p>
        </header>
        <TemporalGraphCanvas {...props} />
      </section>
    </ReactFlowProvider>
  );
}
