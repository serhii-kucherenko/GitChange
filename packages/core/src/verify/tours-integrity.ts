import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
} from "../schema/zod/decisions.js";
import type { ErasArtifact as ErasArtifactType } from "../schema/zod/eras.js";
import { ErasArtifact } from "../schema/zod/eras.js";
import type { Evidence } from "../schema/zod/evidence.js";
import type { DrillTarget, Tour, ToursArtifact as ToursArtifactType } from "../schema/zod/tours.js";
import { ToursArtifact } from "../schema/zod/tours.js";

export interface ToursIntegrityReport {
  ok: boolean;
  errors: string[];
  danglingCommitRefs: string[];
  danglingFileRefs: Array<{ path: string; commitSha: string }>;
  danglingEraIds: string[];
  danglingDecisionIds: string[];
}

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function loadTours(
  gitchangeDir: string,
): ToursArtifactType | { error: string } | null {
  const toursPath = join(gitchangeDir, "tours.json");

  try {
    const raw = readFileSync(toursPath, "utf-8");
    return ToursArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to load tours.json: ${message}` };
  }
}

function loadEras(
  gitchangeDir: string,
): ErasArtifactType | { error: string } | null {
  const erasPath = join(gitchangeDir, "eras.json");

  try {
    const raw = readFileSync(erasPath, "utf-8");
    return ErasArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to load eras.json: ${message}` };
  }
}

function loadDecisions(
  gitchangeDir: string,
): DecisionsArtifactType | null {
  const decisionsPath = join(gitchangeDir, "decisions.json");

  try {
    const raw = readFileSync(decisionsPath, "utf-8");
    return DecisionsArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
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

  const indexedPaths = new Set(
    db
      .select({ path: schema.fileChanges.path })
      .from(schema.fileChanges)
      .all()
      .map((row) => row.path),
  );

  return { commitShas, fileChangeKeys, docSnapshotKeys, indexedPaths };
}

function collectTourEvidence(tours: Tour[]): Evidence[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) =>
      chapter.stops.flatMap((stop) => stop.evidence),
    ),
  );
}

function collectDrillTargets(tours: Tour[]): DrillTarget[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) =>
      chapter.stops.map((stop) => stop.drillTarget),
    ),
  );
}

function collectChapterEraIds(tours: Tour[]): string[] {
  return tours.flatMap((tour) =>
    tour.chapters.flatMap((chapter) => chapter.eraIds),
  );
}

function validateEvidenceRefs(
  refs: Evidence[],
  commitShas: Set<string>,
  fileChangeKeys: Set<string>,
  docSnapshotKeys: Set<string>,
): Pick<ToursIntegrityReport, "danglingCommitRefs" | "danglingFileRefs"> {
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

function validateDrillTargets(
  targets: DrillTarget[],
  eraIds: Set<string>,
  commitShas: Set<string>,
  indexedPaths: Set<string>,
  decisionIds: Set<string>,
): string[] {
  const errors: string[] = [];

  for (const target of targets) {
    if (target.eraId && !eraIds.has(target.eraId)) {
      errors.push(`Dangling drillTarget eraId ref: ${target.eraId}`);
    }

    if (target.commitSha && !commitShas.has(target.commitSha)) {
      errors.push(`Dangling drillTarget commitSha ref: ${target.commitSha}`);
    }

    if (target.filePath && !indexedPaths.has(target.filePath)) {
      errors.push(`Dangling drillTarget filePath ref: ${target.filePath}`);
    }

    if (target.decisionId && !decisionIds.has(target.decisionId)) {
      errors.push(`Dangling drillTarget decisionId ref: ${target.decisionId}`);
    }
  }

  return errors;
}

export function checkToursIntegrity(
  gitchangeDir: string,
  artifact?: ToursArtifactType,
): ToursIntegrityReport {
  const toursResult = artifact ?? loadTours(gitchangeDir);

  if (toursResult && "error" in toursResult) {
    return {
      ok: false,
      errors: [toursResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingEraIds: [],
      danglingDecisionIds: [],
    };
  }

  if (!toursResult) {
    return {
      ok: true,
      errors: [],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingEraIds: [],
      danglingDecisionIds: [],
    };
  }

  const erasResult = loadEras(gitchangeDir);
  if (erasResult && "error" in erasResult) {
    return {
      ok: false,
      errors: [erasResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingEraIds: [],
      danglingDecisionIds: [],
    };
  }

  if (!erasResult) {
    return {
      ok: false,
      errors: ["eras.json is required when tours.json is present"],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingEraIds: [],
      danglingDecisionIds: [],
    };
  }

  const errors: string[] = [];

  if (!toursResult.tours.some((tour) => tour.id === toursResult.defaultTourId)) {
    errors.push(
      `defaultTourId ${toursResult.defaultTourId} not found in tours array`,
    );
  }

  const eraIds = new Set(erasResult.eras.map((era) => era.id));
  const danglingEraIds: string[] = [];

  for (const eraId of collectChapterEraIds(toursResult.tours)) {
    if (!eraIds.has(eraId)) {
      danglingEraIds.push(eraId);
      errors.push(`Dangling chapter eraId ref: ${eraId}`);
    }
  }

  const decisionsArtifact = loadDecisions(gitchangeDir);
  const decisionIds = new Set(
    (decisionsArtifact?.decisions ?? []).map((decision) => decision.id),
  );
  const danglingDecisionIds: string[] = [];

  for (const target of collectDrillTargets(toursResult.tours)) {
    if (target.decisionId && !decisionIds.has(target.decisionId)) {
      danglingDecisionIds.push(target.decisionId);
    }
  }

  const { commitShas, fileChangeKeys, docSnapshotKeys, indexedPaths } =
    loadIndexSets(gitchangeDir);

  const evidenceRefs = collectTourEvidence(toursResult.tours);
  const { danglingCommitRefs, danglingFileRefs } = validateEvidenceRefs(
    evidenceRefs,
    commitShas,
    fileChangeKeys,
    docSnapshotKeys,
  );

  for (const sha of danglingCommitRefs) {
    errors.push(`Dangling commit evidence ref: ${sha}`);
  }
  for (const ref of danglingFileRefs) {
    errors.push(`Dangling file evidence ref: ${ref.path} @ ${ref.commitSha}`);
  }

  errors.push(
    ...validateDrillTargets(
      collectDrillTargets(toursResult.tours),
      eraIds,
      commitShas,
      indexedPaths,
      decisionIds,
    ),
  );

  for (const decisionId of danglingDecisionIds) {
    if (!errors.some((error) => error.includes(decisionId))) {
      errors.push(`Dangling drillTarget decisionId ref: ${decisionId}`);
    }
  }

  const uniqueCommitRefs = [...new Set(danglingCommitRefs)];

  return {
    ok:
      errors.length === 0 &&
      uniqueCommitRefs.length === 0 &&
      danglingFileRefs.length === 0 &&
      danglingEraIds.length === 0 &&
      danglingDecisionIds.length === 0,
    errors,
    danglingCommitRefs: uniqueCommitRefs,
    danglingFileRefs,
    danglingEraIds: [...new Set(danglingEraIds)],
    danglingDecisionIds: [...new Set(danglingDecisionIds)],
  };
}
