import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { DecisionRecord } from "../schema/zod/decisions.js";
import {
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
} from "../schema/zod/decisions.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  OpenWorkArtifact,
  type OpenWorkArtifact as OpenWorkArtifactType,
  type OpenWorkThread,
} from "../schema/zod/open-work.js";

export interface DecisionsIntegrityReport {
  ok: boolean;
  errors: string[];
  danglingCommitRefs: string[];
  danglingFileRefs: Array<{ path: string; commitSha: string }>;
}

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function collectDecisionEvidence(decisions: DecisionRecord[]): Evidence[] {
  const refs: Evidence[] = [];

  for (const decision of decisions) {
    refs.push(...decision.evidence);
    if (decision.attribution) {
      refs.push(...decision.attribution.evidence);
    }
  }

  return refs;
}

function collectOpenWorkEvidence(threads: OpenWorkThread[]): Evidence[] {
  return threads.flatMap((thread) => thread.evidence);
}

function validateEvidenceRefs(
  refs: Evidence[],
  commitShas: Set<string>,
  fileChangeKeys: Set<string>,
  docSnapshotKeys: Set<string>,
): Pick<DecisionsIntegrityReport, "danglingCommitRefs" | "danglingFileRefs"> {
  const danglingCommitRefs: string[] = [];
  const danglingFileRefs: Array<{ path: string; commitSha: string }> = [];

  for (const ref of refs) {
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

  return { danglingCommitRefs, danglingFileRefs };
}

function buildEvidenceErrors(
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

function loadIndexSets(gitchangeDir: string) {
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

  return { commitShas, fileChangeKeys, docSnapshotKeys };
}

function loadDecisions(
  gitchangeDir: string,
): DecisionsArtifactType | { error: string } | null {
  const decisionsPath = join(gitchangeDir, "decisions.json");

  try {
    const raw = readFileSync(decisionsPath, "utf-8");
    return DecisionsArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    const message =
      error instanceof Error ? error.message : String(error);
    return { error: `Failed to load decisions.json: ${message}` };
  }
}

function loadOpenWork(
  gitchangeDir: string,
): OpenWorkArtifactType | { error: string } | null {
  const openWorkPath = join(gitchangeDir, "open-work.json");

  try {
    const raw = readFileSync(openWorkPath, "utf-8");
    return OpenWorkArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    const message =
      error instanceof Error ? error.message : String(error);
    return { error: `Failed to load open-work.json: ${message}` };
  }
}

export function checkDecisionsIntegrity(
  gitchangeDir: string,
): DecisionsIntegrityReport {
  const decisionsResult = loadDecisions(gitchangeDir);
  if (decisionsResult && "error" in decisionsResult) {
    return {
      ok: false,
      errors: [decisionsResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
    };
  }

  const openWorkResult = loadOpenWork(gitchangeDir);
  if (openWorkResult && "error" in openWorkResult) {
    return {
      ok: false,
      errors: [openWorkResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
    };
  }

  if (!decisionsResult && !openWorkResult) {
    return {
      ok: true,
      errors: [],
      danglingCommitRefs: [],
      danglingFileRefs: [],
    };
  }

  const { commitShas, fileChangeKeys, docSnapshotKeys } =
    loadIndexSets(gitchangeDir);

  const evidenceRefs = [
    ...(decisionsResult
      ? collectDecisionEvidence(decisionsResult.decisions)
      : []),
    ...(openWorkResult ? collectOpenWorkEvidence(openWorkResult.threads) : []),
  ];

  const { danglingCommitRefs, danglingFileRefs } = validateEvidenceRefs(
    evidenceRefs,
    commitShas,
    fileChangeKeys,
    docSnapshotKeys,
  );

  const errors = [
    ...buildEvidenceErrors(danglingCommitRefs, danglingFileRefs),
  ];

  if (openWorkResult) {
    for (const thread of openWorkResult.threads) {
      for (const event of thread.events) {
        if (!commitShas.has(event.commitSha)) {
          danglingCommitRefs.push(event.commitSha);
          errors.push(
            `Dangling open-work event commit ref: ${event.commitSha}`,
          );
        }
      }
    }
  }

  const uniqueCommitRefs = [...new Set(danglingCommitRefs)];

  return {
    ok: uniqueCommitRefs.length === 0 && danglingFileRefs.length === 0,
    errors,
    danglingCommitRefs: uniqueCommitRefs,
    danglingFileRefs,
  };
}
