import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { createWriter } from "../artifacts/writer.js";
import { openRepo, walkFromHead } from "../ingestion/git-walk.js";
import { loadIgnore } from "../privacy/gitchangeignore.js";
import * as schema from "../schema/drizzle/schema.js";
import { writeManifest, type Manifest } from "../schema/manifest.js";
import { ensureGitignored } from "./gitignore-guard.js";
import { processCommit } from "./process-commit.js";
import { resolveBranchName, resolveHeadSha } from "./repo-head.js";
import type { IndexOptions, IndexResult } from "./types.js";

export const CORE_SCHEMA_VERSION = "1";
export const DEFAULT_MAX_BLOB_BYTES = 1_048_576;

function resolveGitchangedir(repoPath: string, gitchangeDir?: string): string {
  return gitchangeDir ?? join(repoPath, ".gitchange");
}

function resetIndexStore(gitchangeDir: string): void {
  const dbPath = join(gitchangeDir, "index.sqlite");
  if (existsSync(dbPath)) {
    rmSync(dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${dbPath}${suffix}`;
      if (existsSync(sidecar)) {
        rmSync(sidecar);
      }
    }
  }
}

function countFileChanges(db: ReturnType<typeof openDb>): number {
  const row = db.select({ value: count() }).from(schema.fileChanges).get();
  return row?.value ?? 0;
}

function buildManifest(repo: Awaited<ReturnType<typeof openRepo>>): Manifest {
  const headSha = resolveHeadSha(repo);
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    lastIndexedCommit: headSha,
    indexedAt: new Date().toISOString(),
    repo: {
      head: headSha,
      branch: resolveBranchName(repo),
    },
    indexCompleteness: "complete",
    warnings: [],
  };
}

export async function indexFull(options: IndexOptions): Promise<IndexResult> {
  const gitchangeDir = resolveGitchangedir(options.repoPath, options.gitchangeDir);
  ensureGitignored(options.repoPath);
  resetIndexStore(gitchangeDir);

  const repo = await openRepo(options.repoPath);
  const db = openDb(gitchangeDir);
  const writer = createWriter(db, options.batchSize);
  const matcher = loadIgnore(options.repoPath);

  let commitsIndexed = 0;

  for (const sha of walkFromHead(repo)) {
    processCommit({ repo, sha, writer, matcher });
    commitsIndexed += 1;
  }

  writer.flush();

  const manifest = buildManifest(repo);
  writeManifest(gitchangeDir, manifest);

  console.log(
    `GitChange index complete: ${commitsIndexed} commits indexed (HEAD ${manifest.repo.head.slice(0, 7)})`,
  );

  return {
    commitsIndexed,
    fileChanges: countFileChanges(db),
    manifest,
  };
}
