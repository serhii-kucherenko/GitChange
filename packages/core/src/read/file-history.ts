import { existsSync } from "node:fs";
import { join } from "node:path";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  DEFAULT_COMMIT_PAGE_LIMIT,
  MAX_COMMIT_PAGE_LIMIT,
} from "./commits.js";

export const MAX_FILE_PATH_LENGTH = 1024;

export interface FileHistoryEvent {
  commitSha: string;
  committedAt: number;
  changeType: string;
  summary: string;
  path: string;
  oldPath: string | null;
}

export interface FileHistoryPage {
  events: FileHistoryEvent[];
  nextCursor: string | null;
}

export interface GetFileHistoryOptions {
  limit?: number;
  cursor?: string;
}

export class InvalidFilePathError extends Error {
  constructor(message = "invalid_path") {
    super(message);
    this.name = "InvalidFilePathError";
  }
}

export class InvalidFileHistoryCursorError extends Error {
  constructor(message = "invalid_cursor") {
    super(message);
    this.name = "InvalidFileHistoryCursorError";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_COMMIT_PAGE_LIMIT;
  }
  return Math.min(Math.max(1, Math.floor(limit)), MAX_COMMIT_PAGE_LIMIT);
}

export function validateFilePath(path: string): string {
  if (path.length === 0 || path.length > MAX_FILE_PATH_LENGTH) {
    throw new InvalidFilePathError();
  }
  if (path.includes("\0")) {
    throw new InvalidFilePathError();
  }
  for (const segment of path.split("/")) {
    if (segment === "..") {
      throw new InvalidFilePathError();
    }
  }
  return path;
}

export function encodeFileHistoryCursor(
  committedAt: number,
  commitSha: string,
  fileChangeId: number,
): string {
  return Buffer.from(`${committedAt}:${commitSha}:${fileChangeId}`, "utf-8").toString(
    "base64url",
  );
}

export function decodeFileHistoryCursor(cursor: string): {
  committedAt: number;
  commitSha: string;
  fileChangeId: number;
} {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) {
      throw new InvalidFileHistoryCursorError();
    }

    const committedAt = Number.parseInt(parts[0] ?? "", 10);
    const commitSha = parts[1] ?? "";
    const fileChangeId = Number.parseInt(parts[2] ?? "", 10);
    if (
      !Number.isFinite(committedAt) ||
      commitSha.length === 0 ||
      !Number.isFinite(fileChangeId)
    ) {
      throw new InvalidFileHistoryCursorError();
    }

    return { committedAt, commitSha, fileChangeId };
  } catch (error) {
    if (error instanceof InvalidFileHistoryCursorError) {
      throw error;
    }
    throw new InvalidFileHistoryCursorError();
  }
}

function buildCursorCondition(cursor: string) {
  const { committedAt, commitSha, fileChangeId } =
    decodeFileHistoryCursor(cursor);

  return or(
    lt(schema.commits.committedAt, committedAt),
    and(
      eq(schema.commits.committedAt, committedAt),
      or(
        lt(schema.fileChanges.commitSha, commitSha),
        and(
          eq(schema.fileChanges.commitSha, commitSha),
          lt(schema.fileChanges.id, fileChangeId),
        ),
      ),
    ),
  );
}

export function getFileHistory(
  gitchangeDir: string,
  path: string,
  options: GetFileHistoryOptions = {},
): FileHistoryPage {
  if (
    !existsSync(join(gitchangeDir, "index.sqlite")) ||
    !readManifest(gitchangeDir)
  ) {
    return { events: [], nextCursor: null };
  }

  const limit = clampLimit(options.limit);
  const db = openDb(gitchangeDir);

  const pathMatch = or(
    eq(schema.fileChanges.path, path),
    eq(schema.fileChanges.oldPath, path),
  );

  const conditions = [pathMatch];
  if (options.cursor) {
    conditions.push(buildCursorCondition(options.cursor));
  }

  const rows = db
    .select({
      id: schema.fileChanges.id,
      commitSha: schema.fileChanges.commitSha,
      path: schema.fileChanges.path,
      oldPath: schema.fileChanges.oldPath,
      changeType: schema.fileChanges.changeType,
      committedAt: schema.commits.committedAt,
      summary: schema.commits.summary,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .where(and(...conditions))
    .orderBy(
      desc(schema.commits.committedAt),
      desc(schema.fileChanges.commitSha),
      desc(schema.fileChanges.id),
    )
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const events: FileHistoryEvent[] = pageRows.map((row) => ({
    commitSha: row.commitSha,
    committedAt: row.committedAt,
    changeType: row.changeType,
    summary: row.summary,
    path: row.path,
    oldPath: row.oldPath,
  }));

  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeFileHistoryCursor(last.committedAt, last.commitSha, last.id)
      : null;

  return { events, nextCursor };
}
