import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { createWriter } from "../artifacts/writer.js";
import { openRepo, walkFromHead } from "../ingestion/git-walk.js";
import { loadIgnore } from "../privacy/gitchangeignore.js";
import * as schema from "../schema/drizzle/schema.js";
import { computeIntelligence } from "../intelligence/compute.js";
import {
  writeManifest,
  type IndexCompleteness,
  type Manifest,
  type ManifestWarningCode,
} from "../schema/manifest.js";
import {
  countOutOfOrder,
  echoWarnings,
  formatWarningMessage,
  isShallow,
} from "./freshness.js";
import { ensureGitignored } from "./gitignore-guard.js";
import { indexCommitStream } from "./commit-stream.js";
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

function buildManifest(
  repo: Awaited<ReturnType<typeof openRepo>>,
  options: {
    indexCompleteness: IndexCompleteness;
    warnings: Manifest["warnings"];
    lastIndexDurationMs?: number;
  },
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
    indexCompleteness: options.indexCompleteness,
    warnings: options.warnings,
    ...(options.lastIndexDurationMs !== undefined
      ? { lastIndexDurationMs: options.lastIndexDurationMs }
      : {}),
  };
}

function createWarning(
  code: ManifestWarningCode,
  message: string,
): Manifest["warnings"][number] {
  switch (code) {
    case "shallow_clone":
    case "force_push_detected":
    case "out_of_order_commits":
      return { code, message };
    default: {
      const exhaustive: never = code;
      throw new Error(`Unexpected warning code: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export async function indexFull(options: IndexOptions): Promise<IndexResult> {
  const startedAt = Date.now();
  const gitchangeDir = resolveGitchangedir(options.repoPath, options.gitchangeDir);
  ensureGitignored(options.repoPath);
  resetIndexStore(gitchangeDir);

  const repo = await openRepo(options.repoPath);
  const db = openDb(gitchangeDir);
  const writer = createWriter(db, options.batchSize);
  const matcher = loadIgnore(options.repoPath);

  const warnings: Manifest["warnings"] = [];
  let indexCompleteness: IndexCompleteness = "complete";

  if (isShallow(options.repoPath, repo)) {
    indexCompleteness = "partial";
    warnings.push(
      createWarning(
        "shallow_clone",
        formatWarningMessage("shallow_clone"),
      ),
    );
  }

  const maxBlobBytes = options.maxBlobBytes ?? DEFAULT_MAX_BLOB_BYTES;
  const useWorkers = options.useWorkers !== false;

  const streamResult = await indexCommitStream({
    repo,
    repoPath: options.repoPath,
    shas: walkFromHead(repo),
    writer,
    matcher,
    maxBlobBytes,
    useWorkers,
    onProgress: options.onProgress,
  });

  writer.flush();

  const outOfOrderCount = countOutOfOrder(streamResult.committerTimestamps);
  if (outOfOrderCount > 0) {
    warnings.push(
      createWarning(
        "out_of_order_commits",
        formatWarningMessage(
          "out_of_order_commits",
          `${outOfOrderCount} commits out of chronological order`,
        ),
      ),
    );
  }

  const lastIndexDurationMs = Date.now() - startedAt;
  let manifest = buildManifest(repo, {
    indexCompleteness,
    warnings,
    lastIndexDurationMs,
  });
  writeManifest(gitchangeDir, manifest);

  if (options.rebuildIntelligence) {
    const intelligence = await computeIntelligence({
      repoPath: options.repoPath,
      gitchangeDir,
    });
    manifest = intelligence.manifest;
  }

  echoWarnings(manifest.warnings);

  console.log(
    `GitChange index complete: ${streamResult.commitsIndexed} commits indexed (HEAD ${manifest.repo.head.slice(0, 7)})`,
  );

  return {
    commitsIndexed: streamResult.commitsIndexed,
    fileChanges: countFileChanges(db),
    manifest,
  };
}
