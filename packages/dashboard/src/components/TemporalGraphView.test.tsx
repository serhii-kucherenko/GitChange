// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphResponse } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import { TemporalGraphView } from "./TemporalGraphView.js";

const SHA = "b".repeat(40);

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    nodes,
    onNodeClick,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>;
    onNodeClick?: (
      event: unknown,
      node: { id: string; data: { label: string } },
    ) => void;
  }) => (
    <div data-testid="react-flow">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onNodeClick?.({}, node)}
        >
          {node.data.label}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
}));

function sampleGraph(): GraphResponse {
  return {
    nodes: [
      {
        id: "era:01",
        type: "era",
        data: { eraId: "era:01", label: "Bootstrap" },
      },
      {
        id: SHA,
        type: "commit",
        data: { commitSha: SHA, label: SHA.slice(0, 7) },
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "era:01",
        target: SHA,
        type: "era_contains_commit",
      },
    ],
  };
}

const sampleEras = [
  {
    id: "era:01",
    name: "Bootstrap",
    summary: "First era",
    startCommitSha: SHA,
    endCommitSha: SHA,
    startAt: 1_700_000_000_000,
    endAt: 1_800_000_000_000,
    inflections: [],
    claims: [],
    commitCountInWindow: 1,
  },
];

describe("TemporalGraphView", () => {
  afterEach(() => {
    cleanup();
    useDrillStore.getState().clearEra();
  });

  it("renders era nodes from the graph artifact", () => {
    render(
      <TemporalGraphView
        graph={sampleGraph()}
        eras={sampleEras}
        onDrillToTimeline={vi.fn()}
      />,
    );

    expect(screen.getByTestId("react-flow")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bootstrap" })).toBeTruthy();
  });

  it("calls drill store when an era node is clicked", async () => {
    const user = userEvent.setup();
    const onDrillToTimeline = vi.fn();
    useDrillStore.getState().clearEra();

    render(
      <TemporalGraphView
        graph={sampleGraph()}
        eras={sampleEras}
        onDrillToTimeline={onDrillToTimeline}
      />,
    );

    await user.click(
      within(screen.getByTestId("react-flow")).getByRole("button", {
        name: "Bootstrap",
      }),
    );

    expect(useDrillStore.getState().selectedEra?.id).toBe("era:01");
    expect(onDrillToTimeline).toHaveBeenCalled();
  });
});
