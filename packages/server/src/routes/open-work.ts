import {
  getOpenWorkThread,
  listOpenWork,
  OpenWorkThreadNotFoundError,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const OpenWorkThreadSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(["migration", "refactor", "wip", "stale"]),
  status: z.enum(["open", "in_progress", "completed", "stale", "unknown"]),
  title: z.string(),
  confidence: z.number(),
  lastEventAt: z.number().int().nullable(),
  linkedDecisionId: z.string().optional(),
});

const OpenWorkListResponseSchema = z.object({
  threads: z.array(OpenWorkThreadSummarySchema),
});

const OpenWorkThreadEventSchema = z.object({
  commitSha: z.string().length(40),
  committedAt: z.number().int(),
  summary: z.string(),
  paths: z.array(z.string().min(1)).min(1),
});

const OpenWorkThreadDetailSchema = z.object({
  id: z.string(),
  kind: z.enum(["migration", "refactor", "wip", "stale"]),
  status: z.enum(["open", "in_progress", "completed", "stale", "unknown"]),
  title: z.string(),
  summary: z.string(),
  confidence: z.number(),
  relatedPaths: z.array(z.string().min(1)),
  linkedDecisionId: z.string().optional(),
  events: z.array(OpenWorkThreadEventSchema),
  order: z.literal("chronological"),
});

export interface OpenWorkRouteOptions {
  gitchangeDir: string;
}

export function createOpenWorkRoutes(options: OpenWorkRouteOptions): Hono {
  const app = new Hono();

  app.get("/open-work", (context) => {
    const result = listOpenWork(options.gitchangeDir);
    if (!result) {
      return context.json({ error: "open_work_not_available" }, 404);
    }

    const body = OpenWorkListResponseSchema.parse(result);
    return context.json(body);
  });

  app.get("/open-work/:id", (context) => {
    const id = context.req.param("id");
    try {
      const thread = getOpenWorkThread(options.gitchangeDir, id);
      const body = OpenWorkThreadDetailSchema.parse({
        ...thread,
        order: "chronological",
      });
      return context.json(body);
    } catch (error) {
      if (error instanceof OpenWorkThreadNotFoundError) {
        return context.json({ error: "thread_not_found" }, 404);
      }
      throw error;
    }
  });

  return app;
}
