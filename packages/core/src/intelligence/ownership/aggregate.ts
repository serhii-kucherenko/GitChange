import { and, eq } from "drizzle-orm";
import type { DrizzleDb } from "../../artifacts/db.js";
import * as schema from "../../schema/drizzle/schema.js";
import type { Evidence } from "../../schema/zod/evidence.js";
import type { BlameLineAttribution } from "./blame.js";
import { blameFileAtHead, openBlameRepo } from "./blame.js";
import { loadIgnoreRevs } from "./ignore-revs.js";
import { getBlameablePaths } from "./paths.js";

interface AuthorLineAggregate {
  authorId: number;
  lineCount: number;
  percentage: number;
}

function resolveAuthorId(
  db: DrizzleDb,
  name: string,
  email: string,
  authorCache: Map<string, number>,
): number {
  const cacheKey = `${name}\0${email}`;
  const cached = authorCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const existing = db
    .select()
    .from(schema.authors)
    .where(and(eq(schema.authors.name, name), eq(schema.authors.email, email)))
    .get();

  if (existing) {
    authorCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const inserted = db
    .insert(schema.authors)
    .values({ name, email })
    .returning({ id: schema.authors.id })
    .get();

  authorCache.set(cacheKey, inserted.id);
  return inserted.id;
}

function loadMergeCommitShas(db: DrizzleDb): Set<string> {
  const rows = db
    .select({ sha: schema.commits.sha })
    .from(schema.commits)
    .where(eq(schema.commits.isMerge, true))
    .all();
  return new Set(rows.map((row) => row.sha));
}

function resolveAttributedLine(
  line: BlameLineAttribution,
  mergeShas: Set<string>,
): BlameLineAttribution {
  if (!mergeShas.has(line.finalCommitId)) {
    return line;
  }

  return {
    ...line,
    finalCommitId: line.origCommitId,
  };
}

export function aggregateBlameLines(
  lines: BlameLineAttribution[],
  db: DrizzleDb,
  mergeShas: Set<string>,
  authorCache: Map<string, number>,
): AuthorLineAggregate[] {
  const counts = new Map<number, number>();

  for (const rawLine of lines) {
    const line = resolveAttributedLine(rawLine, mergeShas);
    const authorId = resolveAuthorId(db, line.name, line.email, authorCache);
    counts.set(authorId, (counts.get(authorId) ?? 0) + 1);
  }

  const totalLines = lines.length;
  if (totalLines === 0) {
    return [];
  }

  return [...counts.entries()].map(([authorId, lineCount]) => ({
    authorId,
    lineCount,
    percentage: (lineCount / totalLines) * 100,
  }));
}

function buildOwnershipEvidence(path: string, headSha: string): Evidence[] {
  return [{ type: "file", path, commitSha: headSha }];
}

export async function computeOwnership(
  db: DrizzleDb,
  repoPath: string,
  headSha: string,
): Promise<number> {
  const ignoreRevs = loadIgnoreRevs(repoPath);
  const gitRepo = await openBlameRepo(repoPath);
  const paths = getBlameablePaths(db);
  const mergeShas = loadMergeCommitShas(db);
  const authorCache = new Map<string, number>();
  const fileAggregates = new Map<string, AuthorLineAggregate[]>();

  for (const path of paths) {
    try {
      const lines = await blameFileAtHead(repoPath, gitRepo, path, ignoreRevs);
      const attributedLines =
        ignoreRevs.size > 0
          ? lines.filter((line) => !ignoreRevs.has(line.origCommitId))
          : lines;
      if (attributedLines.length === 0) {
        continue;
      }
      const aggregates = aggregateBlameLines(
        attributedLines,
        db,
        mergeShas,
        authorCache,
      );
      if (aggregates.length > 0) {
        fileAggregates.set(path, aggregates);
      }
    } catch {}
  }

  db.transaction((tx) => {
    tx.delete(schema.fileOwnership).run();

    for (const [path, aggregates] of fileAggregates.entries()) {
      const totalLines = aggregates.reduce(
        (sum, row) => sum + row.lineCount,
        0,
      );
      for (const aggregate of aggregates) {
        tx.insert(schema.fileOwnership)
          .values({
            path,
            authorId: aggregate.authorId,
            lineCount: aggregate.lineCount,
            percentage:
              totalLines > 0 ? (aggregate.lineCount / totalLines) * 100 : 0,
            evidenceJson: JSON.stringify(buildOwnershipEvidence(path, headSha)),
          })
          .run();
      }
    }
  });

  return fileAggregates.size;
}

export function getFileOwnershipRows(db: DrizzleDb): Array<{
  path: string;
  authorId: number;
  name: string;
  email: string;
  lineCount: number;
  percentage: number;
  evidence: Evidence[];
}> {
  const rows = db
    .select({
      path: schema.fileOwnership.path,
      authorId: schema.fileOwnership.authorId,
      lineCount: schema.fileOwnership.lineCount,
      percentage: schema.fileOwnership.percentage,
      evidenceJson: schema.fileOwnership.evidenceJson,
      name: schema.authors.name,
      email: schema.authors.email,
    })
    .from(schema.fileOwnership)
    .innerJoin(
      schema.authors,
      eq(schema.fileOwnership.authorId, schema.authors.id),
    )
    .all();

  return rows.map((row) => ({
    path: row.path,
    authorId: row.authorId,
    name: row.name,
    email: row.email,
    lineCount: row.lineCount,
    percentage: row.percentage,
    evidence: JSON.parse(row.evidenceJson) as Evidence[],
  }));
}
