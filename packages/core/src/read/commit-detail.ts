import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { ChangeType } from "../schema/zod/file-change.js";
import { HunkRecord, type HunkRecord as HunkRecordType } from "../schema/zod/hunk.js";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export class CommitNotFoundError extends Error {
  constructor(sha: string) {
    super(`commit_not_found:${sha}`);
    this.name = "CommitNotFoundError";
  }
}

export class InvalidCommitShaError extends Error {
  constructor() {
    super("invalid_commit_sha");
    this.name = "InvalidCommitShaError";
  }
}

export interface CommitDetailCommit {
  sha: string;
  summary: string;
  message: string;
  committedAt: number;
  authorName: string;
  authorEmail: string;
}

export interface CommitDetailFile {
  path: string;
  changeType: ChangeType;
  hunks: HunkRecordType[];
  contentIgnored: boolean;
  contentRedacted: boolean;
}

export interface CommitDetail {
  commit: CommitDetailCommit;
  files: CommitDetailFile[];
}

function parseHunksJson(raw: string | null): HunkRecordType[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const hunks: HunkRecordType[] = [];
    for (const item of parsed) {
      const result = HunkRecord.safeParse(item);
      if (result.success) {
        hunks.push(result.data);
      }
    }
    return hunks;
  } catch {
    return [];
  }
}

export function getCommitDetail(
  gitchangeDir: string,
  sha: string,
): CommitDetail {
  if (!SHA_PATTERN.test(sha)) {
    throw new InvalidCommitShaError();
  }

  if (
    !existsSync(join(gitchangeDir, "index.sqlite")) ||
    !readManifest(gitchangeDir)
  ) {
    throw new CommitNotFoundError(sha);
  }

  const db = openDb(gitchangeDir);
  const author = schema.authors;

  const commitRow = db
    .select({
      sha: schema.commits.sha,
      summary: schema.commits.summary,
      message: schema.commits.message,
      committedAt: schema.commits.committedAt,
      authorName: author.name,
      authorEmail: author.email,
    })
    .from(schema.commits)
    .innerJoin(author, eq(schema.commits.authorId, author.id))
    .where(eq(schema.commits.sha, sha))
    .get();

  if (!commitRow) {
    throw new CommitNotFoundError(sha);
  }

  const fileRows = db
    .select({
      path: schema.fileChanges.path,
      changeType: schema.fileChanges.changeType,
      contentIgnored: schema.fileChanges.contentIgnored,
      contentRedacted: schema.fileChanges.contentRedacted,
      hunksJson: schema.fileChanges.hunksJson,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.commitSha, sha))
    .all();

  const files: CommitDetailFile[] = fileRows.map((row) => ({
    path: row.path,
    changeType: row.changeType as ChangeType,
    hunks: parseHunksJson(row.hunksJson),
    contentIgnored: row.contentIgnored,
    contentRedacted: row.contentRedacted,
  }));

  return {
    commit: {
      sha: commitRow.sha,
      summary: commitRow.summary,
      message: commitRow.message,
      committedAt: commitRow.committedAt,
      authorName: commitRow.authorName,
      authorEmail: commitRow.authorEmail,
    },
    files,
  };
}
