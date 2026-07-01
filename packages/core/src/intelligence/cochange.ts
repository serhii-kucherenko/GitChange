import { desc, eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type { CoChangeEdge } from "../schema/zod/intelligence.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";

const DEFAULT_HALF_LIFE_DAYS = 180;
const MS_PER_DAY = 86_400_000;

export interface ComputeCoChangeOptions {
  halfLifeDays?: number;
  referenceAt?: number;
}

interface EdgeAggregate {
  pathA: string;
  pathB: string;
  coOccurrence: number;
  lastCoChangeAt: number;
}

function canonicalPair(pathA: string, pathB: string): [string, string] {
  return pathA < pathB ? [pathA, pathB] : [pathB, pathA];
}

function computeDecayWeight(
  count: number,
  lastCoChangeAt: number,
  halfLifeDays: number,
  referenceAt: number,
): number {
  const ageDays = Math.max(0, (referenceAt - lastCoChangeAt) / MS_PER_DAY);
  return count * Math.exp(-ageDays / halfLifeDays);
}

function unorderedPairs(paths: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      pairs.push(canonicalPair(paths[i]!, paths[j]!));
    }
  }
  return pairs;
}

export function computeCoChange(
  db: DrizzleDb,
  opts?: ComputeCoChangeOptions,
): number {
  const halfLifeDays = opts?.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const referenceAt = opts?.referenceAt ?? Date.now();

  const rows = db
    .select({
      commitSha: schema.fileChanges.commitSha,
      path: schema.fileChanges.path,
      committedAt: schema.commits.committedAt,
      contentIgnored: schema.fileChanges.contentIgnored,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .all();

  const pathsByCommit = new Map<string, { paths: Set<string>; committedAt: number }>();

  for (const row of rows) {
    if (row.contentIgnored || isIntelligenceIgnoredPath(row.path)) {
      continue;
    }

    let entry = pathsByCommit.get(row.commitSha);
    if (!entry) {
      entry = { paths: new Set(), committedAt: row.committedAt };
      pathsByCommit.set(row.commitSha, entry);
    }
    entry.paths.add(row.path);
    if (row.committedAt > entry.committedAt) {
      entry.committedAt = row.committedAt;
    }
  }

  const aggregates = new Map<string, EdgeAggregate>();

  for (const { paths, committedAt } of pathsByCommit.values()) {
    const pathList = [...paths];
    if (pathList.length < 2) {
      continue;
    }

    for (const [pathA, pathB] of unorderedPairs(pathList)) {
      const key = `${pathA}\0${pathB}`;
      const existing = aggregates.get(key);

      if (!existing) {
        aggregates.set(key, {
          pathA,
          pathB,
          coOccurrence: 1,
          lastCoChangeAt: committedAt,
        });
        continue;
      }

      existing.coOccurrence += 1;
      if (committedAt >= existing.lastCoChangeAt) {
        existing.lastCoChangeAt = committedAt;
      }
    }
  }

  db.transaction((tx) => {
    tx.delete(schema.coChangeEdges).run();

    for (const aggregate of aggregates.values()) {
      tx.insert(schema.coChangeEdges)
        .values({
          pathA: aggregate.pathA,
          pathB: aggregate.pathB,
          coOccurrence: aggregate.coOccurrence,
          lastCoChangeAt: aggregate.lastCoChangeAt,
          weight: computeDecayWeight(
            aggregate.coOccurrence,
            aggregate.lastCoChangeAt,
            halfLifeDays,
            referenceAt,
          ),
        })
        .run();
    }
  });

  return aggregates.size;
}

export function getCoChangeEdges(
  db: DrizzleDb,
  limit?: number,
): CoChangeEdge[] {
  let query = db
    .select()
    .from(schema.coChangeEdges)
    .orderBy(desc(schema.coChangeEdges.weight))
    .$dynamic();

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  return query.all().map((row) => ({
    pathA: row.pathA,
    pathB: row.pathB,
    coOccurrence: row.coOccurrence,
    lastCoChangeAt: row.lastCoChangeAt,
    weight: row.weight,
    relationship: "co_change" as const,
    disclaimer: "historical correlation, not import dependency" as const,
  }));
}

export function getCoChangeEdgeCount(db: DrizzleDb): number {
  const row = db
    .select({ value: sql<number>`count(*)` })
    .from(schema.coChangeEdges)
    .get();
  return row?.value ?? 0;
}
