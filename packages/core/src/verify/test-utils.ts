import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";

/** Appends a dangling file evidence ref to the first file_changes row (golden tests only). */
export function corruptFirstFileEvidence(
  db: DrizzleDb,
  dangling: { path: string; commitSha: string },
): void {
  const row = db.select().from(schema.fileChanges).limit(1).get();
  if (!row) {
    throw new Error("no file_changes row to corrupt");
  }

  const evidence = JSON.parse(row.evidenceJson) as unknown[];
  evidence.push({
    type: "file",
    path: dangling.path,
    commitSha: dangling.commitSha,
  });

  db.update(schema.fileChanges)
    .set({ evidenceJson: JSON.stringify(evidence) })
    .where(eq(schema.fileChanges.id, row.id))
    .run();
}
