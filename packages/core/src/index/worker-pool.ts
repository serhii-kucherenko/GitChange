import { createRequire } from "node:module";
import { availableParallelism, cpus } from "node:os";
import { fileURLToPath } from "node:url";
import Piscina from "piscina";
import type { IndexWriter } from "../artifacts/writer.js";
import type { CommitBuildResult } from "./process-commit.js";
import { applyCommitRecords } from "./process-commit.js";
import type { WorkerTask } from "./worker.js";

export const INDEX_WORKER_BATCH_SIZE = 500;

export type IndexWorkerPool = Piscina<WorkerTask, CommitBuildResult>;

function resolveWorkerExecArgv(): string[] {
  const existingImport = process.execArgv.find((arg) => arg.startsWith("--import"));
  if (existingImport) {
    return process.execArgv;
  }

  try {
    const require = createRequire(import.meta.url);
    const tsxPath = require.resolve("tsx");
    return ["--import", tsxPath];
  } catch {
    return ["--import", "tsx"];
  }
}

function resolveMaxThreads(): number {
  const parallelism = availableParallelism?.() ?? cpus().length;
  return Math.max(1, parallelism - 1);
}

export function createIndexWorkerPool(maxThreads?: number): IndexWorkerPool {
  return new Piscina<WorkerTask, CommitBuildResult>({
    filename: fileURLToPath(new URL("./worker.ts", import.meta.url)),
    maxThreads: maxThreads ?? resolveMaxThreads(),
    execArgv: resolveWorkerExecArgv(),
  });
}

export async function processCommitBatch(
  pool: IndexWorkerPool,
  tasks: WorkerTask[],
  writer: IndexWriter,
): Promise<{ fileChanges: number; committerTimestamps: number[] }> {
  const results = await Promise.all(tasks.map((task) => pool.run(task)));
  let fileChanges = 0;
  const committerTimestamps: number[] = [];

  for (const result of results) {
    const applied = applyCommitRecords(writer, result);
    fileChanges += applied.fileChanges;
    committerTimestamps.push(result.committerTimestampMs);
  }

  return { fileChanges, committerTimestamps };
}

export async function closeIndexWorkerPool(pool: IndexWorkerPool): Promise<void> {
  await pool.destroy();
}
