import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { createWriter } from "../artifacts/writer.js";
import { openRepo, walkRange } from "../ingestion/git-walk.js";
import { loadIgnore } from "../privacy/gitchangeignore.js";
import * as schema from "../schema/drizzle/schema.js";
import { readManifest, writeManifest, type Manifest } from "../schema/manifest.js";
import { checkCursorReachable, ForcePushHaltError } from "./freshness.js";
import { ensureGitignored } from "./gitignore-guard.js";
import { CORE_SCHEMA_VERSION, indexFull } from "./full.js";
import { processCommit } from "./process-commit.js";
import { resolveBranchName, resolveHeadSha } from "./repo-head.js";
import type { IndexOptions, IndexResult } from "./types.js";

function resolveGitchangedir(repoPath: string, gitchangeDir?: string): string {
  return gitchangeDir ?? join(repoPath, ".gitchange");
}

function countCommits(db: ReturnType<typeof openDb>): number {
  const row = db.select({ value: count() }).from(schema.commits).get();
  return row?.value ?? 0;
}

function refreshManifest(
  repo: Awaited<ReturnType<typeof openRepo>>,
  previous: Manifest | null,
): Manifest {
  const headSha = resolveHeadSha(repo);
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    lastIndexedCommit: headSha,
    indexedAt: new Date().toISOString(),
    repo: {
      head: headSha,
      branch: resolveBranchName(repo),
    },
    indexCompleteness: previous?.indexCompleteness ?? "complete",
    warnings: previous?.warnings ?? [],
  };
}

export async function indexIncremental(options: IndexOptions): Promise<IndexResult> {
  const gitchangeDir = resolveGitchangedir(options.repoPath, options.gitchangeDir);
  const existingManifest = readManifest(gitchangeDir);

  if (!existingManifest) {
    return indexFull(options);
  }

  ensureGitignored(options.repoPath);

  const repo = await openRepo(options.repoPath);
  const headSha = resolveHeadSha(repo);

  if (existingManifest.lastIndexedCommit === headSha) {
    const manifest = refreshManifest(repo, existingManifest);
    writeManifest(gitchangeDir, manifest);
    return {
      commitsIndexed: 0,
      fileChanges: 0,
      manifest,
    };
  }

  const cursorCheck = checkCursorReachable(repo, existingManifest.lastIndexedCommit);
  if (cursorCheck.rewritten) {
    throw new ForcePushHaltError(
      `History was rewritten (${cursorCheck.reason ?? "cursor unreachable"}). Run a full index rebuild with indexFull / --full before incremental updates.`,
    );
  }

  const db = openDb(gitchangeDir);
  const commitsBefore = countCommits(db);
  const writer = createWriter(db, options.batchSize);
  const matcher = loadIgnore(options.repoPath);

  let commitsIndexed = 0;
  let fileChanges = 0;

  for (const sha of walkRange(repo, existingManifest.lastIndexedCommit)) {
    const result = processCommit({ repo, sha, writer, matcher });
    commitsIndexed += 1;
    fileChanges += result.fileChanges;
  }

  writer.flush();

  const manifest = refreshManifest(repo, existingManifest);
  writeManifest(gitchangeDir, manifest);

  if (commitsIndexed > 0) {
    console.log(
      `GitChange incremental index complete: ${commitsIndexed} new commits (HEAD ${manifest.repo.head.slice(0, 7)})`,
    );
  }

  const commitsAfter = countCommits(db);
  if (commitsIndexed > 0 && commitsAfter !== commitsBefore + commitsIndexed) {
    throw new Error(
      `Incremental commit count mismatch: expected ${commitsBefore + commitsIndexed}, got ${commitsAfter}`,
    );
  }

  return {
    commitsIndexed,
    fileChanges,
    manifest,
  };
}

export function commitExists(db: ReturnType<typeof openDb>, sha: string): boolean {
  const row = db
    .select({ sha: schema.commits.sha })
    .from(schema.commits)
    .where(eq(schema.commits.sha, sha))
    .get();
  return row !== undefined;
}
