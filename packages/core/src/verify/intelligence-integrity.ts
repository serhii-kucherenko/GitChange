import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";

export interface IntelligenceIntegrityReport {
  ok: boolean;
  errors: string[];
  danglingCommitRefs: string[];
  danglingFileRefs: Array<{ path: string; commitSha: string }>;
}

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function collectEvidenceFromArtifact(
  artifact: IntelligenceArtifactType,
): Evidence[] {
  const refs: Evidence[] = [];

  for (const file of artifact.churn.files) {
    refs.push(...file.evidence);
  }
  for (const file of artifact.ownership.files) {
    refs.push(...file.evidence);
  }
  for (const boundary of artifact.eraSignals.boundaries) {
    refs.push(...boundary.evidence);
  }
  for (const topic of artifact.expertise.topics) {
    for (const contributor of topic.suggestedContributors) {
      refs.push(...contributor.evidence);
    }
  }

  return refs;
}

function buildErrors(
  danglingCommitRefs: string[],
  danglingFileRefs: Array<{ path: string; commitSha: string }>,
): string[] {
  const errors: string[] = [];

  for (const sha of danglingCommitRefs) {
    errors.push(`Dangling commit evidence ref: ${sha}`);
  }
  for (const ref of danglingFileRefs) {
    errors.push(
      `Dangling file evidence ref: ${ref.path} @ ${ref.commitSha}`,
    );
  }

  return errors;
}

export function checkIntelligenceIntegrity(
  gitchangeDir: string,
): IntelligenceIntegrityReport {
  const intelligencePath = join(gitchangeDir, "intelligence.json");

  let artifact: IntelligenceArtifactType;
  try {
    const raw = readFileSync(intelligencePath, "utf-8");
    artifact = IntelligenceArtifact.parse(JSON.parse(raw));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [`Failed to load intelligence.json: ${message}`],
      danglingCommitRefs: [],
      danglingFileRefs: [],
    };
  }

  const db = openDb(gitchangeDir);
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

  const danglingCommitRefs: string[] = [];
  const danglingFileRefs: Array<{ path: string; commitSha: string }> = [];

  for (const ref of collectEvidenceFromArtifact(artifact)) {
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
      default:
        assertNever(ref);
    }
  }

  return {
    ok: danglingCommitRefs.length === 0 && danglingFileRefs.length === 0,
    errors: buildErrors(danglingCommitRefs, danglingFileRefs),
    danglingCommitRefs,
    danglingFileRefs,
  };
}
