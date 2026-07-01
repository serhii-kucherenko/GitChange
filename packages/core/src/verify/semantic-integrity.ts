import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  ErasArtifact,
  type ErasArtifact as ErasArtifactType,
  type NamedEra,
} from "../schema/zod/eras.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import {
  TemporalGraphArtifact,
  type TemporalGraphArtifact as TemporalGraphArtifactType,
} from "../schema/zod/temporal-graph.js";

export interface SemanticIntegrityReport {
  ok: boolean;
  errors: string[];
  danglingCommitRefs: string[];
  danglingFileRefs: Array<{ path: string; commitSha: string }>;
  danglingSignalIds: number[];
}

function fileChangeKey(path: string, commitSha: string): string {
  return `${path}\0${commitSha}`;
}

function collectEvidenceFromEras(eras: NamedEra[]): Evidence[] {
  const refs: Evidence[] = [];

  for (const era of eras) {
    refs.push(...era.evidence);
    for (const claim of era.claims) {
      refs.push(...claim.evidence);
    }
    for (const inflection of era.inflections) {
      refs.push(...inflection.evidence);
    }
  }

  return refs;
}

function validateEvidenceRefs(
  refs: Evidence[],
  commitShas: Set<string>,
  fileChangeKeys: Set<string>,
  docSnapshotKeys: Set<string>,
): Pick<
  SemanticIntegrityReport,
  "danglingCommitRefs" | "danglingFileRefs"
> {
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

  const commitTimes = new Map(
    db
      .select({
        sha: schema.commits.sha,
        committedAt: schema.commits.committedAt,
      })
      .from(schema.commits)
      .all()
      .map((row) => [row.sha, row.committedAt] as const),
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

  return { commitShas, commitTimes, fileChangeKeys, docSnapshotKeys };
}

function loadIntelligence(
  gitchangeDir: string,
): IntelligenceArtifactType | { error: string } {
  const intelligencePath = join(gitchangeDir, "intelligence.json");

  try {
    const raw = readFileSync(intelligencePath, "utf-8");
    return IntelligenceArtifact.parse(JSON.parse(raw));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { error: `Failed to load intelligence.json: ${message}` };
  }
}

function loadEras(
  gitchangeDir: string,
): ErasArtifactType | { error: string } {
  const erasPath = join(gitchangeDir, "eras.json");

  try {
    const raw = readFileSync(erasPath, "utf-8");
    return ErasArtifact.parse(JSON.parse(raw));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { error: `Failed to load eras.json: ${message}` };
  }
}

function loadTemporalGraph(
  gitchangeDir: string,
): TemporalGraphArtifactType | { error: string } {
  const graphPath = join(gitchangeDir, "temporal-graph.json");

  try {
    const raw = readFileSync(graphPath, "utf-8");
    return TemporalGraphArtifact.parse(JSON.parse(raw));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { error: `Failed to load temporal-graph.json: ${message}` };
  }
}

export function checkErasIntegrity(
  gitchangeDir: string,
): SemanticIntegrityReport {
  const erasResult = loadEras(gitchangeDir);
  if ("error" in erasResult) {
    return {
      ok: false,
      errors: [erasResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingSignalIds: [],
    };
  }

  const intelligenceResult = loadIntelligence(gitchangeDir);
  if ("error" in intelligenceResult) {
    return {
      ok: false,
      errors: [intelligenceResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingSignalIds: [],
    };
  }

  const { commitShas, fileChangeKeys, docSnapshotKeys } =
    loadIndexSets(gitchangeDir);

  const evidenceRefs = collectEvidenceFromEras(erasResult.eras);
  const { danglingCommitRefs, danglingFileRefs } = validateEvidenceRefs(
    evidenceRefs,
    commitShas,
    fileChangeKeys,
    docSnapshotKeys,
  );

  const signalIds = new Set(
    intelligenceResult.eraSignals.boundaries.map((boundary) => boundary.id),
  );
  const danglingSignalIds: number[] = [];

  for (const era of erasResult.eras) {
    for (const signalId of era.signalIds) {
      if (!signalIds.has(signalId)) {
        danglingSignalIds.push(signalId);
      }
    }

    if (!commitShas.has(era.startCommitSha)) {
      danglingCommitRefs.push(era.startCommitSha);
    }
    if (!commitShas.has(era.endCommitSha)) {
      danglingCommitRefs.push(era.endCommitSha);
    }
  }

  const errors = [
    ...buildEvidenceErrors(danglingCommitRefs, danglingFileRefs),
    ...danglingSignalIds.map(
      (id) => `Dangling era signalId ref: ${id}`,
    ),
  ];

  return {
    ok:
      danglingCommitRefs.length === 0 &&
      danglingFileRefs.length === 0 &&
      danglingSignalIds.length === 0,
    errors,
    danglingCommitRefs: [...new Set(danglingCommitRefs)],
    danglingFileRefs,
    danglingSignalIds: [...new Set(danglingSignalIds)],
  };
}

export function checkTemporalGraphIntegrity(
  gitchangeDir: string,
): SemanticIntegrityReport {
  const graphResult = loadTemporalGraph(gitchangeDir);
  if ("error" in graphResult) {
    return {
      ok: false,
      errors: [graphResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingSignalIds: [],
    };
  }

  const erasResult = loadEras(gitchangeDir);
  if ("error" in erasResult) {
    return {
      ok: false,
      errors: [erasResult.error],
      danglingCommitRefs: [],
      danglingFileRefs: [],
      danglingSignalIds: [],
    };
  }

  const { commitTimes } = loadIndexSets(gitchangeDir);
  const errors: string[] = [];

  const nodeIds = new Set(graphResult.nodes.map((node) => node.id));
  const eraById = new Map(
    erasResult.eras.map((era) => [era.id, era] as const),
  );

  for (const edge of graphResult.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Dangling graph edge source: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Dangling graph edge target: ${edge.target}`);
    }
  }

  for (const edge of graphResult.edges) {
    if (edge.type !== "era_contains_commit") {
      continue;
    }

    const era = eraById.get(edge.source);
    if (!era) {
      errors.push(
        `era_contains_commit edge references unknown era node: ${edge.source}`,
      );
      continue;
    }

    const committedAt = commitTimes.get(edge.target);
    if (committedAt === undefined) {
      errors.push(
        `era_contains_commit edge references unknown commit: ${edge.target}`,
      );
      continue;
    }

    if (committedAt < era.startAt || committedAt > era.endAt) {
      errors.push(
        `Commit ${edge.target} outside era window for ${era.id} (${era.startAt}–${era.endAt}, got ${committedAt})`,
      );
    }
  }

  const inflectionNodes = graphResult.nodes.filter(
    (node) => node.type === "inflection",
  );
  const inflectionParents = new Map<string, string>();

  for (const edge of graphResult.edges) {
    if (edge.type === "era_has_inflection") {
      inflectionParents.set(edge.target, edge.source);
    }
  }

  for (const inflection of inflectionNodes) {
    const parentEraId = inflectionParents.get(inflection.id);
    if (!parentEraId) {
      errors.push(`Inflection node missing parent era: ${inflection.id}`);
      continue;
    }
    if (!eraById.has(parentEraId)) {
      errors.push(
        `Inflection ${inflection.id} linked to unknown era: ${parentEraId}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    danglingCommitRefs: [],
    danglingFileRefs: [],
    danglingSignalIds: [],
  };
}

export function checkSemanticIntegrity(
  gitchangeDir: string,
): SemanticIntegrityReport {
  const erasReport = checkErasIntegrity(gitchangeDir);
  const graphReport = checkTemporalGraphIntegrity(gitchangeDir);

  const danglingCommitRefs = [
    ...new Set([
      ...erasReport.danglingCommitRefs,
      ...graphReport.danglingCommitRefs,
    ]),
  ];
  const danglingFileRefs = [
    ...erasReport.danglingFileRefs,
    ...graphReport.danglingFileRefs,
  ];
  const danglingSignalIds = [
    ...new Set([
      ...erasReport.danglingSignalIds,
      ...graphReport.danglingSignalIds,
    ]),
  ];
  const errors = [...erasReport.errors, ...graphReport.errors];

  return {
    ok: erasReport.ok && graphReport.ok,
    errors,
    danglingCommitRefs,
    danglingFileRefs,
    danglingSignalIds,
  };
}
