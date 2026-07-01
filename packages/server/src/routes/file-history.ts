import {
  getFileHistory,
  InvalidFileHistoryCursorError,
  InvalidFilePathError,
  MAX_FILE_PATH_LENGTH,
  validateFilePath,
  MAX_COMMIT_PAGE_LIMIT,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const FileHistoryEventSchema = z.object({
  commitSha: z.string(),
  committedAt: z.number().int(),
  changeType: z.string(),
  summary: z.string(),
  path: z.string(),
  oldPath: z.string().nullable(),
});

const FileHistoryResponseSchema = z.object({
  events: z.array(FileHistoryEventSchema),
  nextCursor: z.string().nullable(),
  order: z.literal("newest_first"),
});

export interface FileHistoryRouteOptions {
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

function decodePathParam(encodedPath: string): string {
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    throw new InvalidFilePathError("invalid_path_encoding");
  }
}

export function createFileHistoryRoutes(
  options: FileHistoryRouteOptions,
): Hono {
  const app = new Hono();

  app.get("/files/:path{.+}/history", (context) => {
    const encodedPath = context.req.param("path") ?? "";
    if (encodedPath.length > MAX_FILE_PATH_LENGTH * 3) {
      return context.json({ error: "invalid_path" }, 400);
    }

    let path: string;
    try {
      path = validateFilePath(decodePathParam(encodedPath));
    } catch (error) {
      if (error instanceof InvalidFilePathError) {
        return context.json({ error: "invalid_path" }, 400);
      }
      throw error;
    }

    const limit = parseLimit(context.req.query("limit"));
    const cursor = context.req.query("cursor");

    try {
      const page = getFileHistory(options.gitchangeDir, path, {
        limit,
        cursor,
      });
      const body = FileHistoryResponseSchema.parse({
        ...page,
        order: "newest_first",
      });
      return context.json(body);
    } catch (error) {
      if (error instanceof InvalidFileHistoryCursorError) {
        return context.json({ error: "invalid_cursor" }, 400);
      }
      throw error;
    }
  });

  return app;
}
