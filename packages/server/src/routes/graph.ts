import { readGraphUnified, resolveWorkspaceContext } from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const GraphNodeDrillDataSchema = z.object({
  eraId: z.string().optional(),
  commitSha: z.string().optional(),
  parentEraId: z.string().optional(),
  label: z.string().optional(),
});

const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["era", "commit", "file", "contributor", "inflection"]),
  repoId: z.string().optional(),
  data: GraphNodeDrillDataSchema,
});

const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum([
    "era_contains_commit",
    "commit_touches_file",
    "contributor_authored_commit",
    "era_has_inflection",
    "files_co_changed",
  ]),
  disclaimer: z
    .literal("historical correlation, not import dependency")
    .optional(),
});

const GraphResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export interface GraphRouteOptions {
  gitchangeDir: string;
}

export function createGraphRoutes(options: GraphRouteOptions): Hono {
  const app = new Hono();

  app.get("/graph", (context) => {
    const repoId = context.req.query("repoId")?.trim() || undefined;
    const ctx = resolveWorkspaceContext(options.gitchangeDir);
    const result = readGraphUnified(ctx, { repoId });

    if (!result) {
      return context.json({ error: "graph_not_available" }, 404);
    }

    const body = GraphResponseSchema.parse(result);
    return context.json(body);
  });

  return app;
}
