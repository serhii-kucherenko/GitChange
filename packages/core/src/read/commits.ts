import { existsSync } from "node:fs";
import { join } from "node:path";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";

export const DEFAULT_COMMIT_PAGE_LIMIT = 50;
export const MAX_COMMIT_PAGE_LIMIT = 200;

export interface CommitSummary {
  sha: string;
  summary: string;
  committedAt: number;
  authorName: string;
  authorEmail: string;
}

export interface CommitListPage {
  commits: CommitSummary[];
  nextCursor: string | null;
}

export interface ListCommitsOptions {
  limit?: number;
  cursor?: string;
}

export class InvalidCommitCursorError extends Error {
  constructor(message = "invalid_cursor") {
    super(message);
    this.name = "InvalidCommitCursorError";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_COMMIT_PAGE_LIMIT;
  }
  return Math.min(Math.max(1, Math.floor(limit)), MAX_COMMIT_PAGE_LIMIT);
}

export function encodeCommitCursor(committedAt: number, sha: string): string {
  return Buffer.from(`${committedAt}:${sha}`, "utf-8").toString("base64url");
}

export function decodeCommitCursor(cursor: string): {
  committedAt: number;
  sha: string;
} {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) {
      throw new InvalidCommitCursorError();
    }

    const committedAt = Number.parseInt(decoded.slice(0, colonIndex), 10);
    const sha = decoded.slice(colonIndex + 1);
    if (!Number.isFinite(committedAt) || sha.length === 0) {
      throw new InvalidCommitCursorError();
    }

    return { committedAt, sha };
  } catch (error) {
    if (error instanceof InvalidCommitCursorError) {
      throw error;
    }
    throw new InvalidCommitCursorError();
  }
}

function buildCursorCondition(cursor: string) {
  const { committedAt, sha } = decodeCommitCursor(cursor);
  return or(
    lt(schema.commits.committedAt, committedAt),
    and(
      eq(schema.commits.committedAt, committedAt),
      lt(schema.commits.sha, sha),
    ),
  );
}

export function listCommits(
  gitchangeDir: string,
  options: ListCommitsOptions = {},
): CommitListPage {
  if (
    !existsSync(join(gitchangeDir, "index.sqlite")) ||
    !readManifest(gitchangeDir)
  ) {
    return { commits: [], nextCursor: null };
  }

  const limit = clampLimit(options.limit);
  const db = openDb(gitchangeDir);

  const author = schema.authors;
  const query = db
    .select({
      sha: schema.commits.sha,
      summary: schema.commits.summary,
      committedAt: schema.commits.committedAt,
      authorName: author.name,
      authorEmail: author.email,
    })
    .from(schema.commits)
    .innerJoin(author, eq(schema.commits.authorId, author.id))
    .orderBy(desc(schema.commits.committedAt), desc(schema.commits.sha))
    .limit(limit + 1);

  const rows = options.cursor
    ? query.where(buildCursorCondition(options.cursor)).all()
    : query.all();

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const commits: CommitSummary[] = pageRows.map((row) => ({
    sha: row.sha,
    summary: row.summary,
    committedAt: row.committedAt,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
  }));

  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCommitCursor(last.committedAt, last.sha)
      : null;

  return { commits, nextCursor };
}
