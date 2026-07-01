import type { Repository } from "es-git";
import type { IndexWriter } from "../artifacts/writer.js";
import type { IgnoreMatcher } from "../privacy/gitchangeignore.js";
import { loadIgnorePatterns } from "../privacy/gitchangeignore.js";
import { processCommit } from "./process-commit.js";
import {
  closeIndexWorkerPool,
  createIndexWorkerPool,
  INDEX_WORKER_BATCH_SIZE,
  processCommitBatch,
  type IndexWorkerPool,
} from "./worker-pool.js";
import type { WorkerTask } from "./worker.js";

export const INDEX_PROGRESS_INTERVAL = 500;

export interface IndexProgress {
  indexed: number;
  rate: number;
  elapsedMs: number;
}

export interface IndexCommitStreamOptions {
  repo: Repository;
  repoPath: string;
  shas: Iterable<string>;
  writer: IndexWriter;
  matcher: IgnoreMatcher;
  maxBlobBytes: number;
  useWorkers: boolean;
  onProgress?: (progress: IndexProgress) => void;
}

export interface IndexCommitStreamResult {
  commitsIndexed: number;
  fileChanges: number;
  committerTimestamps: number[];
}

function emitProgress(
  indexed: number,
  startedAt: number,
  onProgress?: (progress: IndexProgress) => void,
): void {
  if (!onProgress || indexed === 0 || indexed % INDEX_PROGRESS_INTERVAL !== 0) {
    return;
  }

  const elapsedMs = Date.now() - startedAt;
  const elapsedSeconds = elapsedMs / 1000;
  const rate = elapsedSeconds > 0 ? indexed / elapsedSeconds : 0;
  onProgress({ indexed, rate, elapsedMs });
}

async function indexWithWorkers(
  options: IndexCommitStreamOptions,
): Promise<IndexCommitStreamResult> {
  const { repoPath, shas, writer, maxBlobBytes, onProgress } = options;
  const ignorePatterns = loadIgnorePatterns(repoPath);
  const pool = createIndexWorkerPool();
  const startedAt = Date.now();

  let commitsIndexed = 0;
  let fileChanges = 0;
  const committerTimestamps: number[] = [];
  let pendingTasks: WorkerTask[] = [];

  const flushBatch = async (): Promise<void> => {
    if (pendingTasks.length === 0) {
      return;
    }

    const batch = pendingTasks;
    pendingTasks = [];
    const batchResult = await processCommitBatch(pool, batch, writer);
    fileChanges += batchResult.fileChanges;
    committerTimestamps.push(...batchResult.committerTimestamps);
  };

  try {
    for (const sha of shas) {
      pendingTasks.push({ repoPath, sha, ignorePatterns, maxBlobBytes });
      commitsIndexed += 1;

      if (pendingTasks.length >= INDEX_WORKER_BATCH_SIZE) {
        await flushBatch();
        emitProgress(commitsIndexed, startedAt, onProgress);
      }
    }

    await flushBatch();
    emitProgress(commitsIndexed, startedAt, onProgress);
  } finally {
    await closeIndexWorkerPool(pool);
  }

  return { commitsIndexed, fileChanges, committerTimestamps };
}

function indexSingleThreaded(
  options: IndexCommitStreamOptions,
): IndexCommitStreamResult {
  const { repo, shas, writer, matcher, maxBlobBytes, onProgress } = options;
  const startedAt = Date.now();

  let commitsIndexed = 0;
  let fileChanges = 0;
  const committerTimestamps: number[] = [];

  for (const sha of shas) {
    const commit = repo.getCommit(sha);
    committerTimestamps.push(commit.committer().timestamp * 1000);
    const result = processCommit({ repo, sha, writer, matcher, maxBlobBytes });
    commitsIndexed += 1;
    fileChanges += result.fileChanges;
    emitProgress(commitsIndexed, startedAt, onProgress);
  }

  return { commitsIndexed, fileChanges, committerTimestamps };
}

export async function indexCommitStream(
  options: IndexCommitStreamOptions,
): Promise<IndexCommitStreamResult> {
  if (options.useWorkers) {
    return indexWithWorkers(options);
  }

  return indexSingleThreaded(options);
}

export type { IndexWorkerPool };
