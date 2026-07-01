import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";

interface ChurnAggregate {
  path: string;
  changeCount: number;
  insertions: number;
  deletions: number;
  lastTouchedAt: number;
  lastCommitSha: string;
}

function countLineDelta(changeType: string): {
  insertions: number;
  deletions: number;
} {
  switch (changeType) {
    case "added":
      return { insertions: 1, deletions: 0 };
    case "deleted":
      return { insertions: 0, deletions: 1 };
    case "modified":
    case "renamed":
    case "copied":
    case "typechange":
      return { insertions: 0, deletions: 0 };
    default: {
      const exhaustive: never = changeType as never;
      throw new Error(`Unexpected change type: ${exhaustive}`);
    }
  }
}

function buildChurnEvidence(path: string, commitSha: string): Evidence[] {
  return [{ type: "file", path, commitSha }];
}

export function computeChurn(db: DrizzleDb): number {
  const rows = db
    .select({
      path: schema.fileChanges.path,
      changeType: schema.fileChanges.changeType,
      commitSha: schema.fileChanges.commitSha,
      committedAt: schema.commits.committedAt,
      contentIgnored: schema.fileChanges.contentIgnored,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .all();

  const aggregates = new Map<string, ChurnAggregate>();

  for (const row of rows) {
    if (row.contentIgnored || isIntelligenceIgnoredPath(row.path)) {
      continue;
    }

    const delta = countLineDelta(row.changeType);
    const existing = aggregates.get(row.path);

    if (!existing) {
      aggregates.set(row.path, {
        path: row.path,
        changeCount: 1,
        insertions: delta.insertions,
        deletions: delta.deletions,
        lastTouchedAt: row.committedAt,
        lastCommitSha: row.commitSha,
      });
      continue;
    }

    existing.changeCount += 1;
    existing.insertions += delta.insertions;
    existing.deletions += delta.deletions;

    if (row.committedAt >= existing.lastTouchedAt) {
      existing.lastTouchedAt = row.committedAt;
      existing.lastCommitSha = row.commitSha;
    }
  }

  db.transaction((tx) => {
    tx.delete(schema.fileChurn).run();

    for (const aggregate of aggregates.values()) {
      tx.insert(schema.fileChurn)
        .values({
          path: aggregate.path,
          changeCount: aggregate.changeCount,
          insertions: aggregate.insertions,
          deletions: aggregate.deletions,
          lastTouchedAt: aggregate.lastTouchedAt,
          evidenceJson: JSON.stringify(
            buildChurnEvidence(aggregate.path, aggregate.lastCommitSha),
          ),
        })
        .run();
    }
  });

  return aggregates.size;
}

export function getFileChurnRows(db: DrizzleDb): Array<{
  path: string;
  changeCount: number;
  insertions: number;
  deletions: number;
  lastTouchedAt: number;
  evidence: Evidence[];
}> {
  return db
    .select()
    .from(schema.fileChurn)
    .all()
    .map((row) => ({
      path: row.path,
      changeCount: row.changeCount,
      insertions: row.insertions,
      deletions: row.deletions,
      lastTouchedAt: row.lastTouchedAt,
      evidence: JSON.parse(row.evidenceJson) as Evidence[],
    }));
}

export function getChurnFileCount(db: DrizzleDb): number {
  const row = db
    .select({ value: sql<number>`count(*)` })
    .from(schema.fileChurn)
    .get();
  return row?.value ?? 0;
}
