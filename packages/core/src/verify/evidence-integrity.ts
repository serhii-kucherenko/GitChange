import type { DrizzleDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import { Evidence } from "../schema/zod/evidence.js";

export interface IntegrityReport {
  ok: boolean;
  danglingCommitRefs: string[];
  danglingFileRefs: Array<{ path: string; commitSha: string }>;
}

function parseEvidenceJson(evidenceJson: string): Evidence[] {
  const parsed: unknown = JSON.parse(evidenceJson);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const refs: Evidence[] = [];
  for (const item of parsed) {
    const result = Evidence.safeParse(item);
    if (result.success) {
      refs.push(result.data);
    }
  }
  return refs;
}

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

export function checkEvidenceIntegrity(db: DrizzleDb): IntegrityReport {
  const commitShas = new Set(
    db
      .select({ sha: schema.commits.sha })
      .from(schema.commits)
      .all()
      .map((row) => row.sha),
  );

  const fileChangeKeys = new Set(
    db
      .select({
        path: schema.fileChanges.path,
        commitSha: schema.fileChanges.commitSha,
      })
      .from(schema.fileChanges)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const docSnapshotKeys = new Set(
    db
      .select({
        path: schema.docSnapshots.path,
        commitSha: schema.docSnapshots.commitSha,
      })
      .from(schema.docSnapshots)
      .all()
      .map((row) => fileChangeKey(row.path, row.commitSha)),
  );

  const danglingCommitRefs: string[] = [];
  const danglingFileRefs: Array<{ path: string; commitSha: string }> = [];

  const narrativeRows = [
    ...db
      .select({ evidenceJson: schema.fileChanges.evidenceJson })
      .from(schema.fileChanges)
      .all(),
    ...db
      .select({ evidenceJson: schema.docSnapshots.evidenceJson })
      .from(schema.docSnapshots)
      .all(),
  ];

  for (const row of narrativeRows) {
    for (const ref of parseEvidenceJson(row.evidenceJson)) {
      switch (ref.type) {
        case "commit":
          if (!commitShas.has(ref.sha)) {
            danglingCommitRefs.push(ref.sha);
          }
          break;
        case "file":
          if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
            danglingFileRefs.push({ path: ref.path, commitSha: ref.commitSha });
          }
          break;
        case "doc":
          if (!docSnapshotKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
            danglingFileRefs.push({ path: ref.path, commitSha: ref.commitSha });
          }
          break;
        case "hunk":
          if (!commitShas.has(ref.commitSha)) {
            danglingCommitRefs.push(ref.commitSha);
          }
          if (!fileChangeKeys.has(fileChangeKey(ref.path, ref.commitSha))) {
            danglingFileRefs.push({ path: ref.path, commitSha: ref.commitSha });
          }
          break;
        case "interview":
          break;
        default:
          assertNever(ref);
      }
    }
  }

  return {
    ok: danglingCommitRefs.length === 0 && danglingFileRefs.length === 0,
    danglingCommitRefs,
    danglingFileRefs,
  };
}
