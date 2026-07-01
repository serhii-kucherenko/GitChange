import {
  CommitNotFoundError,
  getCommitDetail,
  InvalidCommitShaError,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const HunkSchema = z.object({
  startLine: z.number().int(),
  endLine: z.number().int(),
  patch: z.string(),
});

const CommitDetailResponseSchema = z.object({
  commit: z.object({
    sha: z.string(),
    summary: z.string(),
    message: z.string(),
    committedAt: z.number().int(),
    authorName: z.string(),
    authorEmail: z.string(),
  }),
  files: z.array(
    z.object({
      path: z.string(),
      changeType: z.string(),
      hunks: z.array(HunkSchema),
      contentIgnored: z.boolean(),
      contentRedacted: z.boolean(),
    }),
  ),
});

export interface CommitDetailRouteOptions {
  gitchangeDir: string;
}

export function createCommitDetailRoutes(
  options: CommitDetailRouteOptions,
): Hono {
  const app = new Hono();

  app.get("/commits/:sha", (context) => {
    const sha = context.req.param("sha");

    try {
      const detail = getCommitDetail(options.gitchangeDir, sha);
      const body = CommitDetailResponseSchema.parse(detail);
      return context.json(body);
    } catch (error) {
      if (error instanceof InvalidCommitShaError) {
        return context.json({ error: "invalid_commit_sha" }, 400);
      }
      if (error instanceof CommitNotFoundError) {
        return context.json({ error: "commit_not_found" }, 404);
      }
      throw error;
    }
  });

  return app;
}
