import { and, eq } from "drizzle-orm";
import type { DrizzleDb } from "../../artifacts/db.js";
import * as schema from "../../schema/drizzle/schema.js";
import { isIntelligenceIgnoredPath } from "../path-filters.js";

export function getBlameablePaths(db: DrizzleDb): string[] {
  const rows = db
    .selectDistinct({ path: schema.fileChanges.path })
    .from(schema.fileChanges)
    .where(
      and(
        eq(schema.fileChanges.isBinary, false),
        eq(schema.fileChanges.contentIgnored, false),
      ),
    )
    .all();

  return [...new Set(rows.map((row) => row.path))].filter(
    (path) => !isIntelligenceIgnoredPath(path),
  );
}
