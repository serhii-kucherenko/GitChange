import { desc } from "drizzle-orm";
import { ulid } from "ulid";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import { readManifest } from "../schema/manifest.js";
import type { DecisionRecord } from "../schema/zod/decisions.js";
import type { Evidence } from "../schema/zod/evidence.js";
import type {
  OpenWorkArtifact,
  OpenWorkKind,
  OpenWorkThread,
} from "../schema/zod/open-work.js";
import { type DocSnapshotRow, inferOpenWorkStatus } from "../status/infer.js";
import { buildThreadEvents } from "../status/thread-events.js";
import { extractDecisionCandidates } from "./candidates.js";
import { readDecisionsArtifact } from "./decisions-io.js";
import {
  MAX_OPEN_WORK_THREADS,
  OPEN_WORK_SCHEMA_VERSION,
  writeOpenWorkArtifact,
} from "./open-work-io.js";

const WIP_ORPHAN_SIGNAL = "wip_on_migration_path";

interface ThreadSource {
  id?: string;
  title: string;
  summary: string;
  relatedPaths: string[];
  evidence: Evidence[];
  linkedDecisionId?: string;
}

function pathsOverlap(a: string[], b: string[]): boolean {
  for (const pathA of a) {
    for (const pathB of b) {
      if (
        pathA === pathB ||
        pathA.startsWith(`${pathB}/`) ||
        pathB.startsWith(`${pathA}/`)
      ) {
        return true;
      }
    }
  }
  return false;
}

function clusterThreadSources(sources: ThreadSource[]): ThreadSource[][] {
  const clusters: ThreadSource[][] = [];

  for (const source of sources) {
    let merged = false;
    for (const cluster of clusters) {
      if (
        cluster.some((existing) =>
          pathsOverlap(existing.relatedPaths, source.relatedPaths),
        )
      ) {
        cluster.push(source);
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push([source]);
    }
  }

  return clusters;
}

function mergeCluster(cluster: ThreadSource[]): ThreadSource {
  const linkedDecision = cluster.find((source) => source.linkedDecisionId);
  const primary = linkedDecision ?? cluster[0];
  if (!primary) {
    throw new Error("Cannot merge empty thread cluster");
  }

  const relatedPaths = [
    ...new Set(cluster.flatMap((source) => source.relatedPaths)),
  ];

  return {
    id: primary.id,
    title: primary.title,
    summary: primary.summary,
    relatedPaths,
    evidence: dedupeEvidence(cluster.flatMap((source) => source.evidence)),
    linkedDecisionId: primary.linkedDecisionId,
  };
}

function dedupeEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];

  for (const item of evidence) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function decisionToSource(decision: DecisionRecord): ThreadSource {
  return {
    id: decision.id,
    title: decision.title,
    summary: decision.summary,
    relatedPaths: decision.relatedPaths ?? [],
    evidence: decision.evidence,
    linkedDecisionId: decision.id,
  };
}

function collectDocSnapshots(db: ReturnType<typeof openDb>): DocSnapshotRow[] {
  return db
    .select({
      path: schema.docSnapshots.path,
      commitSha: schema.docSnapshots.commitSha,
      content: schema.docSnapshots.content,
    })
    .from(schema.docSnapshots)
    .orderBy(desc(schema.docSnapshots.id))
    .all();
}

function assignKind(source: ThreadSource, status: string): OpenWorkKind {
  if (status === "stale") {
    return "stale";
  }

  const haystack =
    `${source.title} ${source.summary} ${source.relatedPaths.join(" ")}`.toLowerCase();

  if (/\bmigrat/.test(haystack)) {
    return "migration";
  }
  if (/\brefactor\b/.test(haystack)) {
    return "refactor";
  }
  if (/\b(wip|todo)\b/i.test(haystack)) {
    return "wip";
  }

  return "wip";
}

function loadThreadSources(gitchangeDir: string): ThreadSource[] {
  const sources: ThreadSource[] = [];
  const linkedDecisionIds = new Set<string>();

  const decisions = readDecisionsArtifact(gitchangeDir);
  if (decisions) {
    for (const decision of decisions.decisions) {
      if (decision.status !== "in_flight" && decision.status !== "unknown") {
        continue;
      }

      const paths = decision.relatedPaths ?? [];
      if (paths.length === 0) {
        continue;
      }

      sources.push(decisionToSource(decision));
      linkedDecisionIds.add(decision.id);
    }
  }

  const candidates = extractDecisionCandidates(gitchangeDir);
  for (const candidate of candidates) {
    if (!candidate.sourceSignals.includes(WIP_ORPHAN_SIGNAL)) {
      continue;
    }

    const overlapsDecision = [...linkedDecisionIds].some((decisionId) =>
      sources.some(
        (source) =>
          source.linkedDecisionId === decisionId &&
          pathsOverlap(source.relatedPaths, candidate.relatedPaths),
      ),
    );
    if (overlapsDecision) {
      continue;
    }

    sources.push({
      title: candidate.title,
      summary: candidate.title,
      relatedPaths: candidate.relatedPaths,
      evidence: candidate.seedEvidence,
    });
  }

  if (sources.length === 0 && candidates.length > 0) {
    const fallback = candidates[0];
    if (fallback && fallback.relatedPaths.length > 0) {
      sources.push({
        title: fallback.title,
        summary: fallback.title,
        relatedPaths: fallback.relatedPaths,
        evidence: fallback.seedEvidence,
      });
    }
  }

  return sources;
}

export function assembleOpenWork(gitchangeDir: string): OpenWorkArtifact {
  const manifest = readManifest(gitchangeDir);
  if (!manifest) {
    throw new Error(`manifest.json not found in ${gitchangeDir}`);
  }

  const db = openDb(gitchangeDir);
  const docSnapshots = collectDocSnapshots(db);
  const sources = loadThreadSources(gitchangeDir);
  const clusters = clusterThreadSources(sources).slice(
    0,
    MAX_OPEN_WORK_THREADS,
  );

  const threads: OpenWorkThread[] = [];

  for (const cluster of clusters) {
    const source = mergeCluster(cluster);
    if (source.relatedPaths.length === 0) {
      continue;
    }

    const events = buildThreadEvents(db, source.relatedPaths);
    const inference = inferOpenWorkStatus(
      { relatedPaths: source.relatedPaths, events },
      db,
      docSnapshots,
    );

    const threadEvidence =
      source.evidence.length > 0
        ? source.evidence
        : events[0]
          ? [{ type: "commit" as const, sha: events[0].commitSha }]
          : [];

    if (threadEvidence.length === 0) {
      continue;
    }

    threads.push({
      id: source.linkedDecisionId
        ? source.linkedDecisionId.replace(/^decision:/, "thread:")
        : `thread:${ulid()}`,
      kind: assignKind(source, inference.status),
      status: inference.status,
      title: source.title,
      summary: source.summary,
      confidence: inference.confidence,
      relatedPaths: source.relatedPaths,
      events,
      evidence: threadEvidence,
      linkedDecisionId: source.linkedDecisionId,
    });
  }

  const artifact = {
    schemaVersion: OPEN_WORK_SCHEMA_VERSION,
    computedAt: new Date().toISOString(),
    headSha: manifest.repo.head,
    threads,
  } satisfies OpenWorkArtifact;

  writeOpenWorkArtifact(gitchangeDir, artifact);
  return artifact;
}
