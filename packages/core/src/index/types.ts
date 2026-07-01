import type { Manifest } from "../schema/manifest.js";

export interface IndexOptions {
  repoPath: string;
  gitchangeDir?: string;
  batchSize?: number;
  maxBlobBytes?: number;
}

export interface IndexResult {
  commitsIndexed: number;
  fileChanges: number;
  manifest: Manifest;
}
