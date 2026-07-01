import {
  decodeCommitCursor,
  encodeCommitCursor,
  InvalidCommitCursorError,
  listCommits,
  type CommitListFilters,
  type CommitSummary,
  type ListCommitsOptions,
} from "../commits.js";
import type { WorkspaceReadContext } from "./workspace-context.js";

export interface UnifiedCommitSummary extends CommitSummary {
  repoId?: string;
}

export interface UnifiedCommitListPage {
  commits: UnifiedCommitSummary[];
  nextCursor: string | null;
}

export interface ListCommitsUnifiedOptions extends ListCommitsOptions {
  repoId?: string;
}

interface SortableCommit extends CommitSummary {
  repoId: string;
}

export class InvalidUnifiedCommitCursorError extends Error {
  constructor(message = "invalid_cursor") {
    super(message);
    this.name = "InvalidUnifiedCommitCursorError";
  }
}

export function encodeUnifiedCommitCursor(
  committedAt: number,
  repoId: string,
  sha: string,
): string {
  return Buffer.from(`${committedAt}:${repoId}:${sha}`, "utf-8").toString(
    "base64url",
  );
}

export function decodeUnifiedCommitCursor(cursor: string): {
  committedAt: number;
  repoId: string;
  sha: string;
} {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const firstColon = decoded.indexOf(":");
    const lastColon = decoded.lastIndexOf(":");
    if (firstColon === -1 || lastColon === firstColon) {
      throw new InvalidUnifiedCommitCursorError();
    }

    const committedAt = Number.parseInt(
      decoded.slice(0, firstColon),
      10,
    );
    const repoId = decoded.slice(firstColon + 1, lastColon);
    const sha = decoded.slice(lastColon + 1);

    if (
      !Number.isFinite(committedAt) ||
      repoId.length === 0 ||
      sha.length === 0
    ) {
      throw new InvalidUnifiedCommitCursorError();
    }

    return { committedAt, repoId, sha };
  } catch (error) {
    if (error instanceof InvalidUnifiedCommitCursorError) {
      throw error;
    }
    throw new InvalidUnifiedCommitCursorError();
  }
}

export function compareUnifiedCommits(a: SortableCommit, b: SortableCommit): number {
  if (a.committedAt !== b.committedAt) {
    return b.committedAt - a.committedAt;
  }
  const repoCompare = a.repoId.localeCompare(b.repoId);
  if (repoCompare !== 0) {
    return repoCompare;
  }
  return b.sha.localeCompare(a.sha);
}

function ranksAfterCursor(
  commit: SortableCommit,
  cursor: { committedAt: number; repoId: string; sha: string },
): boolean {
  if (commit.committedAt < cursor.committedAt) {
    return true;
  }
  if (commit.committedAt > cursor.committedAt) {
    return false;
  }
  if (commit.repoId > cursor.repoId) {
    return true;
  }
  if (commit.repoId < cursor.repoId) {
    return false;
  }
  return commit.sha < cursor.sha;
}

function decodeCursorForContext(
  ctx: WorkspaceReadContext,
  cursor: string | undefined,
): { committedAt: number; repoId: string; sha: string } | null {
  if (!cursor) {
    return null;
  }

  if (ctx.isMultiRepo) {
    return decodeUnifiedCommitCursor(cursor);
  }

  const legacy = decodeCommitCursor(cursor);
  return {
    committedAt: legacy.committedAt,
    repoId: ctx.repos[0]?.repoId ?? "default",
    sha: legacy.sha,
  };
}

function toPublicCommit(
  commit: SortableCommit,
  isMultiRepo: boolean,
): UnifiedCommitSummary {
  if (!isMultiRepo) {
    return {
      sha: commit.sha,
      summary: commit.summary,
      committedAt: commit.committedAt,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
    };
  }

  return {
    sha: commit.sha,
    summary: commit.summary,
    committedAt: commit.committedAt,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    repoId: commit.repoId,
  };
}

export function listCommitsUnified(
  ctx: WorkspaceReadContext,
  options: ListCommitsUnifiedOptions = {},
): UnifiedCommitListPage {
  const limit = options.limit ?? 50;
  const repos = options.repoId
    ? ctx.repos.filter((repo) => repo.repoId === options.repoId)
    : ctx.repos;

  if (repos.length === 0) {
    return { commits: [], nextCursor: null };
  }

  if (!ctx.isMultiRepo) {
    const singleRepo = repos[0];
    if (!singleRepo) {
      return { commits: [], nextCursor: null };
    }

    const page = listCommits(singleRepo.gitchangeDir, options);
    return {
      commits: page.commits.map((commit) => toPublicCommit(
        { ...commit, repoId: singleRepo.repoId },
        false,
      )),
      nextCursor: page.nextCursor,
    };
  }

  let cursor: { committedAt: number; repoId: string; sha: string } | null =
    null;
  try {
    cursor = decodeCursorForContext(ctx, options.cursor);
  } catch (error) {
    if (error instanceof InvalidCommitCursorError) {
      throw new InvalidUnifiedCommitCursorError();
    }
    throw error;
  }

  const { repoId: _repoFilter, cursor: _cursor, limit: _limit, ...filters } =
    options;
  const perRepoLimit = limit + 1;
  const merged: SortableCommit[] = [];

  for (const repo of repos) {
    const page = listCommits(repo.gitchangeDir, {
      ...filters,
      limit: perRepoLimit,
    });

    for (const commit of page.commits) {
      merged.push({ ...commit, repoId: repo.repoId });
    }
  }

  merged.sort(compareUnifiedCommits);

  const filtered = cursor
    ? merged.filter((commit) => ranksAfterCursor(commit, cursor))
    : merged;

  const pageRows = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeUnifiedCommitCursor(last.committedAt, last.repoId, last.sha)
      : null;

  return {
    commits: pageRows.map((commit) => toPublicCommit(commit, true)),
    nextCursor,
  };
}
