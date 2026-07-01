import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import type { Manifest } from "../schema/manifest.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";

export interface RepoSnapshotStats {
  commitCount: number;
  fileChangeCount: number;
  authorCount: number;
}

export interface RepoSnapshotHighlightChurnFile {
  path: string;
  changeCount: number;
}

export interface RepoSnapshotHighlightExpertiseTopic {
  topic: string;
  label: string;
}

export interface RepoSnapshotHighlights {
  topChurnFiles: RepoSnapshotHighlightChurnFile[];
  topExpertiseTopics: RepoSnapshotHighlightExpertiseTopic[];
}

export interface RepoSnapshot {
  manifest: Manifest | null;
  stats: RepoSnapshotStats;
  intelligence: IntelligenceArtifactType | null;
  highlights: RepoSnapshotHighlights;
}

const EMPTY_STATS: RepoSnapshotStats = {
  commitCount: 0,
  fileChangeCount: 0,
  authorCount: 0,
};

const EMPTY_HIGHLIGHTS: RepoSnapshotHighlights = {
  topChurnFiles: [],
  topExpertiseTopics: [],
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

function readIntelligence(
  gitchangeDir: string,
): IntelligenceArtifactType | null {
  const intelligencePath = join(gitchangeDir, "intelligence.json");
  if (!existsSync(intelligencePath)) {
    return null;
  }

  try {
    const raw = readFileSync(intelligencePath, "utf-8");
    return IntelligenceArtifact.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function buildHighlights(
  intelligence: IntelligenceArtifactType | null,
): RepoSnapshotHighlights {
  if (!intelligence) {
    return EMPTY_HIGHLIGHTS;
  }

  const topChurnFiles = [...intelligence.churn.files]
    .sort((left, right) => right.changeCount - left.changeCount)
    .slice(0, 5)
    .map(({ path, changeCount }) => ({ path, changeCount }));

  const topExpertiseTopics = intelligence.expertise.topics
    .slice(0, 3)
    .map(({ topic }) => ({ topic, label: topic }));

  return { topChurnFiles, topExpertiseTopics };
}

export function getRepoSnapshot(gitchangeDir: string): RepoSnapshot {
  const manifest = readManifest(gitchangeDir);
  const intelligence = readIntelligence(gitchangeDir);

  return {
    manifest,
    stats: collectStats(gitchangeDir),
    intelligence,
    highlights: buildHighlights(intelligence),
  };
}
