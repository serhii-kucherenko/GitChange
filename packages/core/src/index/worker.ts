import type { CommitBuildResult } from "./process-commit.js";
import { buildCommitRecords } from "./process-commit.js";

export interface WorkerTask {
  repoPath: string;
  sha: string;
  ignorePatterns: readonly string[];
  maxBlobBytes: number;
}

export default async function processCommitWorker(
  task: WorkerTask,
): Promise<CommitBuildResult> {
  return buildCommitRecords(
    task.repoPath,
    task.sha,
    task.ignorePatterns,
    task.maxBlobBytes,
  );
}
