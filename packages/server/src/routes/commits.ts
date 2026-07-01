import {
  InvalidCommitCursorError,
  InvalidCommitFilterError,
  InvalidUnifiedCommitCursorError,
  listCommitsUnified,
  MAX_COMMIT_PAGE_LIMIT,
  resolveRepoGitchangeDir,
  resolveWorkspaceContext,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const CommitSummarySchema = z.object({
  sha: z.string(),
  summary: z.string(),
  committedAt: z.number().int(),
  authorName: z.string(),
  authorEmail: z.string(),
  repoId: z.string().optional(),
});

const CommitsResponseSchema = z.object({
  commits: z.array(CommitSummarySchema),
  nextCursor: z.string().nullable(),
});

const CommitFiltersSchema = z.object({
  author: z.string().max(200).optional(),
  path: z.string().max(200).optional(),
  q: z.string().max(200).optional(),
  after: z.number().int().optional(),
  before: z.number().int().optional(),
  repoId: z.string().min(1).optional(),
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

function parseTimestamp(
  raw: string | undefined,
  field: "after" | "before",
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      throw new InvalidCommitFilterError(`invalid_${field}`, field);
    }
    return parsed;
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) {
    throw new InvalidCommitFilterError(`invalid_${field}`, field);
  }
  return Math.floor(parsedMs / 1000);
}

function parseFilters(context: {
  req: { query: (name: string) => string | undefined };
}): z.infer<typeof CommitFiltersSchema> {
  const after = parseTimestamp(context.req.query("after"), "after");
  const before = parseTimestamp(context.req.query("before"), "before");

  return CommitFiltersSchema.parse({
    author: context.req.query("author"),
    path: context.req.query("path"),
    q: context.req.query("q"),
    after,
    before,
    repoId: context.req.query("repoId"),
  });
}

function resolveRepoIdFromQuery(
  ctx: ReturnType<typeof resolveWorkspaceContext>,
  requestedRepoId: string | undefined,
): string | undefined {
  if (!requestedRepoId) {
    return undefined;
  }

  const known = ctx.repos.some((repo) => repo.repoId === requestedRepoId);
  if (!known) {
    throw new InvalidCommitFilterError("invalid_repo_id", "repoId");
  }

  return requestedRepoId;
}

export function createCommitsRoutes(options: CommitsRouteOptions): Hono {
  const app = new Hono();

  app.get("/commits", (context) => {
    const limit = parseLimit(context.req.query("limit"));
    const cursor = context.req.query("cursor");

    try {
      const workspaceCtx = resolveWorkspaceContext(options.gitchangeDir);
      const filters = parseFilters(context);
      const repoId = resolveRepoIdFromQuery(workspaceCtx, filters.repoId);
      const page = listCommitsUnified(workspaceCtx, {
        limit,
        cursor,
        ...filters,
        repoId,
      });
      const body = CommitsResponseSchema.parse(page);
      return context.json(body);
    } catch (error) {
      if (
        error instanceof InvalidCommitCursorError ||
        error instanceof InvalidUnifiedCommitCursorError
      ) {
        return context.json({ error: "invalid_cursor" }, 400);
      }
      if (error instanceof InvalidCommitFilterError) {
        return context.json(
          { error: error.message, field: error.field ?? null },
          400,
        );
      }
      if (error instanceof z.ZodError) {
        return context.json({ error: "invalid_filter" }, 400);
      }
      throw error;
    }
  });

  return app;
}

export function resolveCommitDetailGitchangeDir(
  gitchangeDir: string,
  repoId: string | undefined,
): string {
  const ctx = resolveWorkspaceContext(gitchangeDir);
  if (!ctx.isMultiRepo) {
    return ctx.repos[0]?.gitchangeDir ?? gitchangeDir;
  }

  if (!repoId) {
    return ctx.repos[0]?.gitchangeDir ?? gitchangeDir;
  }

  const resolved = resolveRepoGitchangeDir(ctx, repoId);
  if (!resolved) {
    throw new InvalidCommitFilterError("invalid_repo_id", "repoId");
  }

  return resolved;
}
