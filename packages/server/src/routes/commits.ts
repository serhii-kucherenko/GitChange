import {
  InvalidCommitCursorError,
  listCommits,
  MAX_COMMIT_PAGE_LIMIT,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const CommitSummarySchema = z.object({
  sha: z.string(),
  summary: z.string(),
  committedAt: z.number().int(),
  authorName: z.string(),
  authorEmail: z.string(),
});

const CommitsResponseSchema = z.object({
  commits: z.array(CommitSummarySchema),
  nextCursor: z.string().nullable(),
});

export interface CommitsRouteOptions {
  gitchangeDir: string;
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return Math.min(parsed, MAX_COMMIT_PAGE_LIMIT);
}

export function createCommitsRoutes(options: CommitsRouteOptions): Hono {
  const app = new Hono();

  app.get("/commits", (context) => {
    const limit = parseLimit(context.req.query("limit"));
    const cursor = context.req.query("cursor");

    try {
      const page = listCommits(options.gitchangeDir, { limit, cursor });
      const body = CommitsResponseSchema.parse(page);
      return context.json(body);
    } catch (error) {
      if (error instanceof InvalidCommitCursorError) {
        return context.json({ error: "invalid_cursor" }, 400);
      }
      throw error;
    }
  });

  return app;
}
