import { existsSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import type { Manifest } from "../schema/manifest.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";

export interface RepoSnapshotStats {
  commitCount: number;
  fileChangeCount: number;
  authorCount: number;
}

export interface RepoSnapshot {
  manifest: Manifest | null;
  stats: RepoSnapshotStats;
  intelligencePath: string;
}

const EMPTY_STATS: RepoSnapshotStats = {
  commitCount: 0,
  fileChangeCount: 0,
  authorCount: 0,
};

function collectStats(gitchangeDir: string): RepoSnapshotStats {
  if (!existsSync(join(gitchangeDir, "index.sqlite"))) {
    return EMPTY_STATS;
  }

  const db = openDb(gitchangeDir);
  return {
    commitCount:
      db.select({ value: count() }).from(schema.commits).get()?.value ?? 0,
    fileChangeCount:
      db.select({ value: count() }).from(schema.fileChanges).get()?.value ?? 0,
    authorCount:
      db.select({ value: count() }).from(schema.authors).get()?.value ?? 0,
  };
}

export function getRepoSnapshot(gitchangeDir: string): RepoSnapshot {
  const manifest = readManifest(gitchangeDir);
  const intelligencePath = join(gitchangeDir, "intelligence.json");

  return {
    manifest,
    stats: collectStats(gitchangeDir),
    intelligencePath,
  };
}
