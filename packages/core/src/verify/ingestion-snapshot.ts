import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";

export interface IngestionSnapshot {
  commits: number;
  authors: number;
  merges: number;
  renames: number;
  fileChanges: number;
  docSnapshots: number;
}

/** Locked counts for tests/fixtures/scenarios.ts BASIC_SCENARIO (Plan 01-08). */
export const BASIC_SCENARIO_SNAPSHOT: IngestionSnapshot = {
  commits: 7,
  authors: 1,
  merges: 1,
  renames: 1,
  fileChanges: 9,
  docSnapshots: 2,
};

export function collectIngestionSnapshot(db: DrizzleDb): IngestionSnapshot {
  const commitRows = db.select().from(schema.commits).all();
  const fileChangeRows = db.select().from(schema.fileChanges).all();

  return {
    commits: commitRows.length,
    authors: db.select().from(schema.authors).all().length,
    merges: commitRows.filter((row) => row.parentCount > 1).length,
    renames: fileChangeRows.filter((row) => row.changeType === "renamed").length,
    fileChanges: fileChangeRows.length,
    docSnapshots: db.select().from(schema.docSnapshots).all().length,
  };
}
