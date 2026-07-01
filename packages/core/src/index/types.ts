import type { Manifest } from "../schema/manifest.js";
import type { IndexProgress } from "./commit-stream.js";

export interface IndexOptions {
  repoPath: string;
  gitchangeDir?: string;
  batchSize?: number;
  maxBlobBytes?: number;
  /** When true, run computeIntelligence after manifest write (default false). */
  rebuildIntelligence?: boolean;
  /** When false, index on the main thread only (default true). */
  useWorkers?: boolean;
  /** Called every 500 commits during indexing. */
  onProgress?: (progress: IndexProgress) => void;
}

export interface IndexResult {
  commitsIndexed: number;
  fileChanges: number;
  manifest: Manifest;
}

export type { IndexProgress };
