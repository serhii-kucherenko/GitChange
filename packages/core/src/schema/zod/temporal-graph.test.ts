import { describe, expect, it } from "vitest";
import { TemporalGraphArtifact } from "./temporal-graph.js";

const SHA = "c".repeat(40);

describe("TemporalGraphArtifact", () => {
  it("accepts nodes and edges with typed enums", () => {
    const artifact = TemporalGraphArtifact.parse({
      schemaVersion: "1",
      nodes: [
        { id: "era:01H", type: "era" },
        { id: SHA, type: "commit" },
      ],
      edges: [
        {
          id: "edge:01H",
          source: "era:01H",
          target: SHA,
          type: "era_contains_commit",
        },
      ],
    });

    expect(artifact.nodes).toHaveLength(2);
    expect(artifact.edges[0]?.type).toBe("era_contains_commit");
  });

  it("rejects unknown node types", () => {
    expect(() =>
      TemporalGraphArtifact.parse({
        schemaVersion: "1",
        nodes: [{ id: "x", type: "unknown" }],
        edges: [],
      }),
    ).toThrow();
  });
});
