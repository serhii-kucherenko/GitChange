import { existsSync } from "node:fs";
import { join } from "node:path";
import { and, desc, eq, exists, gte, lt, lte, or, sql } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";

export const DEFAULT_COMMIT_PAGE_LIMIT = 50;
export const MAX_COMMIT_PAGE_LIMIT = 200;
export const MAX_FILTER_STRING_LENGTH = 200;

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

export interface CommitListFilters {
  author?: string;
  path?: string;
  q?: string;
  after?: number;
  before?: number;
}

export interface ListCommitsOptions extends CommitListFilters {
  limit?: number;
  cursor?: string;
}

export class InvalidCommitCursorError extends Error {
  constructor(message = "invalid_cursor") {
    super(message);
    this.name = "InvalidCommitCursorError";
  }
}

export class InvalidCommitFilterError extends Error {
  constructor(
    message = "invalid_filter",
    readonly field?: string,
  ) {
    super(message);
    this.name = "InvalidCommitFilterError";
  }
}

const LIKE_ESCAPE = "\\";

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_COMMIT_PAGE_LIMIT;
  }
  return Math.min(Math.max(1, Math.floor(limit)), MAX_COMMIT_PAGE_LIMIT);
}

export function escapeLikePattern(input: string): string {
  return input
    .slice(0, MAX_FILTER_STRING_LENGTH)
    .replace(/\\/g, `${LIKE_ESCAPE}\\`)
    .replace(/%/g, `${LIKE_ESCAPE}%`)
    .replace(/_/g, `${LIKE_ESCAPE}_`);
}

function normalizeFilterString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, MAX_FILTER_STRING_LENGTH);
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

function likeContains(
  column:
    | typeof schema.authors.email
    | typeof schema.authors.name
    | typeof schema.commits.summary
    | typeof schema.commits.message,
  raw: string,
) {
  const pattern = `%${escapeLikePattern(raw)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

function buildAuthorCondition(authorFilter: string) {
  const author = schema.authors;
  return or(
    likeContains(author.email, authorFilter),
    likeContains(author.name, authorFilter),
  );
}

function buildMessageCondition(keyword: string) {
  return or(
    likeContains(schema.commits.summary, keyword),
    likeContains(schema.commits.message, keyword),
  );
}

function buildPathExistsCondition(pathPrefix: string, db: DrizzleDb) {
  const pattern = `${escapeLikePattern(pathPrefix)}%`;
  return exists(
    db
      .select({ id: schema.fileChanges.id })
      .from(schema.fileChanges)
      .where(
        and(
          eq(schema.fileChanges.commitSha, schema.commits.sha),
          sql`${schema.fileChanges.path} LIKE ${pattern} ESCAPE '\\'`,
        ),
      ),
  );
}

function buildFilterConditions(filters: CommitListFilters, db: DrizzleDb) {
  const conditions = [];

  const author = normalizeFilterString(filters.author);
  if (author) {
    conditions.push(buildAuthorCondition(author));
  }

  const path = normalizeFilterString(filters.path);
  if (path) {
    conditions.push(buildPathExistsCondition(path, db));
  }

  const q = normalizeFilterString(filters.q);
  if (q) {
    conditions.push(buildMessageCondition(q));
  }

  if (filters.after !== undefined) {
    if (!Number.isFinite(filters.after)) {
      throw new InvalidCommitFilterError("invalid_after", "after");
    }
    conditions.push(
      gte(schema.commits.committedAt, Math.floor(filters.after) * 1000),
    );
  }

  if (filters.before !== undefined) {
    if (!Number.isFinite(filters.before)) {
      throw new InvalidCommitFilterError("invalid_before", "before");
    }
    conditions.push(
      lte(schema.commits.committedAt, Math.floor(filters.before) * 1000),
    );
  }

  return conditions;
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
  const filterConditions = buildFilterConditions(options, db);
  if (options.cursor) {
    filterConditions.push(buildCursorCondition(options.cursor));
  }

  const whereClause =
    filterConditions.length > 0 ? and(...filterConditions) : undefined;

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

  const rows = whereClause ? query.where(whereClause).all() : query.all();

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
