import { listErasForDashboard } from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const EvidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("commit"),
    sha: z.string(),
  }),
  z.object({
    type: z.literal("file"),
    path: z.string(),
    commitSha: z.string(),
  }),
  z.object({
    type: z.literal("doc"),
    path: z.string(),
    commitSha: z.string(),
    excerpt: z.string(),
  }),
]);

const InflectionPointSchema = z.object({
  type: z.enum([
    "tech_pivot",
    "scope_steering",
    "process_shift",
    "team_ownership_change",
  ]),
  title: z.string(),
  description: z.string(),
  evidence: z.array(EvidenceSchema).min(1),
});

const EraClaimSchema = z.object({
  text: z.string(),
  evidence: z.array(EvidenceSchema).min(1),
});

const DashboardEraSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  startCommitSha: z.string(),
  endCommitSha: z.string(),
  startAt: z.number().int(),
  endAt: z.number().int(),
  inflections: z.array(InflectionPointSchema),
  claims: z.array(EraClaimSchema),
  commitCountInWindow: z.number().int().nonnegative(),
});

const ErasResponseSchema = z.array(DashboardEraSchema);

export interface ErasRouteOptions {
  gitchangeDir: string;
}

export function createErasRoutes(options: ErasRouteOptions): Hono {
  const app = new Hono();

  app.get("/eras", (context) => {
    const result = listErasForDashboard(options.gitchangeDir);
    if (!result) {
      return context.json({ error: "eras_not_available" }, 404);
    }

    const body = ErasResponseSchema.parse(result.eras);
    return context.json(body);
  });

  return app;
}
