import type { Repository } from "es-git";
import { openRepository } from "es-git";
import {
  createIgnoreMatcher,
  type IgnoreMatcher,
} from "../privacy/gitchangeignore.js";
import type { CommitBuildResult } from "./process-commit.js";
import {
  buildCommitRecordsFromRepo,
  validateRepoPath,
} from "./process-commit.js";

export interface WorkerTask {
  repoPath: string;
  sha: string;
  ignorePatterns: readonly string[];
  maxBlobBytes: number;
}

let cachedRepoPath: string | undefined;
let cachedRepo: Repository | undefined;
const matcherCache = new Map<string, IgnoreMatcher>();

function matcherCacheKey(patterns: readonly string[]): string {
  return patterns.join("\0");
}

function getIgnoreMatcher(patterns: readonly string[]): IgnoreMatcher {
  const key = matcherCacheKey(patterns);
  const existing = matcherCache.get(key);
  if (existing) {
    return existing;
  }

  const matcher = createIgnoreMatcher(patterns);
  matcherCache.set(key, matcher);
  return matcher;
}

async function getWorkerRepo(repoPath: string): Promise<Repository> {
  if (cachedRepoPath === repoPath && cachedRepo) {
    return cachedRepo;
  }

  validateRepoPath(repoPath);
  cachedRepo = await openRepository(repoPath);
  cachedRepoPath = repoPath;
  return cachedRepo;
}

export default async function processCommitWorker(
  task: WorkerTask,
): Promise<CommitBuildResult> {
  const repo = await getWorkerRepo(task.repoPath);
  const matcher = getIgnoreMatcher(task.ignorePatterns);
  return buildCommitRecordsFromRepo(
    repo,
    task.sha,
    matcher,
    task.maxBlobBytes,
  );
}
