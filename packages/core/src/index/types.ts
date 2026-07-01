import type { Manifest } from "../schema/manifest.js";

export interface IndexOptions {
  repoPath: string;
  gitchangeDir?: string;
  batchSize?: number;
  maxBlobBytes?: number;
  /** When true, run computeIntelligence after manifest write (default false). */
  rebuildIntelligence?: boolean;
}

export interface IndexResult {
  commitsIndexed: number;
  fileChanges: number;
  manifest: Manifest;
}
