import { z } from "zod";

export const TemporalGraphNodeType = z.enum([
  "era",
  "commit",
  "file",
  "contributor",
  "inflection",
]);

export type TemporalGraphNodeType = z.infer<typeof TemporalGraphNodeType>;

export const TemporalGraphEdgeType = z.enum([
  "era_contains_commit",
  "commit_touches_file",
  "contributor_authored_commit",
  "era_has_inflection",
  "files_co_changed",
]);

export type TemporalGraphEdgeType = z.infer<typeof TemporalGraphEdgeType>;

export const TemporalGraphNode = z.object({
  id: z.string().min(1),
  type: TemporalGraphNodeType,
});

export type TemporalGraphNode = z.infer<typeof TemporalGraphNode>;

export const TemporalGraphEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: TemporalGraphEdgeType,
});

export type TemporalGraphEdge = z.infer<typeof TemporalGraphEdge>;

export const TemporalGraphArtifact = z.object({
  schemaVersion: z.string(),
  nodes: z.array(TemporalGraphNode),
  edges: z.array(TemporalGraphEdge),
});

export type TemporalGraphArtifact = z.infer<typeof TemporalGraphArtifact>;
