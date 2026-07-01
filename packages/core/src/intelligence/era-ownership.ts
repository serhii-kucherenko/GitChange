import { asc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";

interface TouchAggregate {
  touchCount: number;
  commitTouches: Map<string, number>;
}

interface OwnershipSegment {
  eraId: number;
  startAt: number;
  endAt: number;
}

function isCountableChange(changeType: string): boolean {
  return changeType !== "deleted";
}

function formatEraLabel(signalType: string, startAt: number, endAt: number): string {
  const start = new Date(startAt).toISOString().slice(0, 10);
  const end = new Date(endAt).toISOString().slice(0, 10);
  return `${signalType} (${start}–${end})`;
}

function buildOwnershipSegments(
  boundaries: Array<typeof schema.eraBoundaries.$inferSelect>,
): OwnershipSegment[] {
  return boundaries.map((boundary) => ({
    eraId: boundary.id,
    startAt: boundary.startAt,
    endAt: boundary.endAt,
  }));
}

function topCommitSha(commitTouches: Map<string, number>): string {
  let topSha = "";
  let topCount = -1;

  for (const [sha, count] of commitTouches) {
    if (count > topCount) {
      topCount = count;
      topSha = sha;
    }
  }

  return topSha;
}

export function computeEraOwnership(db: DrizzleDb): number {
  const boundaries = db
    .select()
    .from(schema.eraBoundaries)
    .orderBy(asc(schema.eraBoundaries.startAt))
    .all();

  const segments = buildOwnershipSegments(boundaries);
  if (segments.length === 0) {
    db.delete(schema.eraOwnership).run();
    return 0;
  }

  const rows = db
    .select({
      path: schema.fileChanges.path,
      changeType: schema.fileChanges.changeType,
      commitSha: schema.fileChanges.commitSha,
      committedAt: schema.commits.committedAt,
      authorId: schema.commits.authorId,
      contentIgnored: schema.fileChanges.contentIgnored,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .all();

  let inserted = 0;

  db.transaction((tx) => {
    tx.delete(schema.eraOwnership).run();

    for (const segment of segments) {
      const aggregates = new Map<string, Map<number, TouchAggregate>>();

      for (const row of rows) {
        if (row.contentIgnored || isIntelligenceIgnoredPath(row.path)) {
          continue;
        }
        if (!isCountableChange(row.changeType)) {
          continue;
        }
        if (row.committedAt < segment.startAt || row.committedAt > segment.endAt) {
          continue;
        }

        const pathMap = aggregates.get(row.path) ?? new Map();
        const authorEntry = pathMap.get(row.authorId) ?? {
          touchCount: 0,
          commitTouches: new Map<string, number>(),
        };

        authorEntry.touchCount += 1;
        authorEntry.commitTouches.set(
          row.commitSha,
          (authorEntry.commitTouches.get(row.commitSha) ?? 0) + 1,
        );
        pathMap.set(row.authorId, authorEntry);
        aggregates.set(row.path, pathMap);
      }

      for (const [path, authorMap] of aggregates) {
        const totalTouches = [...authorMap.values()].reduce(
          (sum, entry) => sum + entry.touchCount,
          0,
        );

        for (const [authorId, entry] of authorMap) {
          const percentage =
            totalTouches > 0 ? (entry.touchCount / totalTouches) * 100 : 0;
          const commitSha = topCommitSha(entry.commitTouches);
          const evidence: Evidence[] = [
            { type: "file", path, commitSha },
          ];

          tx.insert(schema.eraOwnership)
            .values({
              eraId: segment.eraId,
              path,
              authorId,
              touchCount: entry.touchCount,
              percentage,
              evidenceJson: JSON.stringify(evidence),
            })
            .run();
          inserted += 1;
        }
      }
    }
  });

  return inserted;
}

export function getEraOwnershipExport(db: DrizzleDb): {
  eras: Array<{
    eraId: number;
    label: string;
    files: Array<{
      path: string;
      authors: Array<{
        authorId: number;
        name: string;
        email: string;
        touchCount: number;
        percentage: number;
      }>;
    }>;
  }>;
} {
  const boundaries = db
    .select()
    .from(schema.eraBoundaries)
    .orderBy(asc(schema.eraBoundaries.startAt))
    .all();
  const boundaryById = new Map(boundaries.map((boundary) => [boundary.id, boundary]));

  const authors = db.select().from(schema.authors).all();
  const authorById = new Map(authors.map((author) => [author.id, author]));

  const ownershipRows = db
    .select()
    .from(schema.eraOwnership)
    .orderBy(asc(schema.eraOwnership.eraId), asc(schema.eraOwnership.path))
    .all();

  const filesByEra = new Map<
    number,
    Map<
      string,
      Array<{
        authorId: number;
        name: string;
        email: string;
        touchCount: number;
        percentage: number;
      }>
    >
  >();

  for (const row of ownershipRows) {
    const author = authorById.get(row.authorId);
    if (!author) {
      continue;
    }

    const eraFiles = filesByEra.get(row.eraId) ?? new Map();
    const authorsForPath = eraFiles.get(row.path) ?? [];
    authorsForPath.push({
      authorId: row.authorId,
      name: author.name,
      email: author.email,
      touchCount: row.touchCount,
      percentage: row.percentage,
    });
    eraFiles.set(row.path, authorsForPath);
    filesByEra.set(row.eraId, eraFiles);
  }

  const eras = [...filesByEra.entries()].map(([eraId, filesMap]) => {
    const boundary = boundaryById.get(eraId);
    const label = boundary
      ? formatEraLabel(boundary.signalType, boundary.startAt, boundary.endAt)
      : `era-${eraId}`;

    const files = [...filesMap.entries()].map(([path, authorsForPath]) => ({
      path,
      authors: authorsForPath.sort((a, b) => b.percentage - a.percentage),
    }));

    return { eraId, label, files };
  });

  return { eras };
}
