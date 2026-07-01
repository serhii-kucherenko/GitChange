import { desc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import { validateFilePath } from "../read/file-history.js";
import * as schema from "../schema/drizzle/schema.js";
import type { OpenWorkThreadEvent } from "../schema/zod/open-work.js";

export const MAX_THREAD_EVENTS = 100;

function pathMatchesRelated(filePath: string, relatedPaths: string[]): boolean {
  for (const related of relatedPaths) {
    if (filePath === related || filePath.startsWith(`${related}/`)) {
      return true;
    }
  }
  return false;
}

export function buildThreadEvents(
  db: DrizzleDb,
  relatedPaths: string[],
): OpenWorkThreadEvent[] {
  const validatedPaths = relatedPaths.map((path) => validateFilePath(path));
  if (validatedPaths.length === 0) {
    return [];
  }

  const rows = db
    .select({
      commitSha: schema.fileChanges.commitSha,
      path: schema.fileChanges.path,
      committedAt: schema.commits.committedAt,
      summary: schema.commits.summary,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .orderBy(desc(schema.commits.committedAt))
    .all()
    .filter((row) => pathMatchesRelated(row.path, validatedPaths));

  const bySha = new Map<
    string,
    {
      commitSha: string;
      committedAt: number;
      summary: string;
      paths: Set<string>;
    }
  >();

  for (const row of rows) {
    const existing = bySha.get(row.commitSha);
    if (existing) {
      existing.paths.add(row.path);
      continue;
    }

    bySha.set(row.commitSha, {
      commitSha: row.commitSha,
      committedAt: row.committedAt,
      summary: row.summary,
      paths: new Set([row.path]),
    });
  }

  return [...bySha.values()].slice(0, MAX_THREAD_EVENTS).map((event) => ({
    commitSha: event.commitSha,
    committedAt: event.committedAt,
    summary: event.summary,
    paths: [...event.paths].sort(),
  }));
}
