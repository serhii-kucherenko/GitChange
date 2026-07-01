import { asc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import type { EraBoundarySignal } from "../schema/zod/intelligence.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";

const DEFAULT_WINDOW_SIZE = 30;
const MAX_BOUNDARIES = 8;
const AUTHOR_SPIKE_THRESHOLD = 1;
const PATH_CHURN_JACCARD_THRESHOLD = 0.5;
const CC_SCOPE_SHARE_THRESHOLD = 0.2;
const TOP_PATH_LIMIT = 10;

interface IndexedCommit {
  sha: string;
  authorId: number;
  committedAt: number;
  ccScope: string | null;
}

interface BoundaryCandidate {
  boundaryCommitSha: string;
  boundaryCommittedAt: number;
  startCommitSha: string;
  endCommitSha: string;
  startAt: number;
  endAt: number;
  signalType: string;
  score: number;
  evidence: Evidence[];
}

function resolveWindowSize(commitCount: number): number {
  if (commitCount <= 3) {
    return commitCount;
  }
  return Math.min(DEFAULT_WINDOW_SIZE, Math.max(3, Math.floor(commitCount / 2)));
}

function jaccardDistance(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      intersection += 1;
    }
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) {
    return 0;
  }

  return 1 - intersection / union;
}

function topPathsForCommits(
  db: DrizzleDb,
  commitShas: Set<string>,
): Set<string> {
  if (commitShas.size === 0) {
    return new Set();
  }

  const counts = new Map<string, number>();

  const rows = db
    .select({
      commitSha: schema.fileChanges.commitSha,
      path: schema.fileChanges.path,
      contentIgnored: schema.fileChanges.contentIgnored,
    })
    .from(schema.fileChanges)
    .all();

  for (const row of rows) {
    if (!commitShas.has(row.commitSha)) {
      continue;
    }
    if (row.contentIgnored || isIntelligenceIgnoredPath(row.path)) {
      continue;
    }

    counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PATH_LIMIT)
    .map(([path]) => path);

  return new Set(ranked);
}

function scopeShares(commits: IndexedCommit[]): Map<string, number> {
  const counts = new Map<string, number>();
  let scoped = 0;

  for (const commit of commits) {
    if (!commit.ccScope) {
      continue;
    }
    scoped += 1;
    counts.set(commit.ccScope, (counts.get(commit.ccScope) ?? 0) + 1);
  }

  const shares = new Map<string, number>();
  if (scoped === 0) {
    return shares;
  }

  for (const [scope, count] of counts) {
    shares.set(scope, count / commits.length);
  }

  return shares;
}

function detectSignalsBetweenWindows(
  db: DrizzleDb,
  prior: IndexedCommit[],
  next: IndexedCommit[],
): BoundaryCandidate[] {
  if (prior.length === 0 || next.length === 0) {
    return [];
  }

  const candidates: BoundaryCandidate[] = [];
  const boundaryCommit = next[0]!;
  const startCommit = prior[0]!;
  const endCommit = next[next.length - 1]!;

  const baseWindow = {
    startCommitSha: startCommit.sha,
    endCommitSha: endCommit.sha,
    startAt: startCommit.committedAt,
    endAt: endCommit.committedAt,
    boundaryCommitSha: boundaryCommit.sha,
    boundaryCommittedAt: boundaryCommit.committedAt,
    evidence: [{ type: "commit" as const, sha: boundaryCommit.sha }],
  };

  const priorAuthors = new Set(prior.map((c) => c.authorId));
  const nextAuthors = new Set(next.map((c) => c.authorId));
  const authorDelta = nextAuthors.size - priorAuthors.size;

  if (authorDelta > AUTHOR_SPIKE_THRESHOLD) {
    candidates.push({
      ...baseWindow,
      signalType: "author_spike",
      score: authorDelta,
    });
  }

  const priorPaths = topPathsForCommits(db, new Set(prior.map((c) => c.sha)));
  const nextPaths = topPathsForCommits(db, new Set(next.map((c) => c.sha)));
  const pathDistance = jaccardDistance(priorPaths, nextPaths);

  if (pathDistance > PATH_CHURN_JACCARD_THRESHOLD) {
    candidates.push({
      ...baseWindow,
      signalType: "path_churn_pivot",
      score: pathDistance,
    });
  }

  const priorScopes = new Set(
    prior.map((c) => c.ccScope).filter((scope): scope is string => scope !== null),
  );
  const nextScopeShares = scopeShares(next);

  for (const [scope, share] of nextScopeShares) {
    if (!priorScopes.has(scope) && share >= CC_SCOPE_SHARE_THRESHOLD) {
      candidates.push({
        ...baseWindow,
        signalType: "cc_scope_shift",
        score: share,
      });
      break;
    }
  }

  return candidates;
}

function dedupeCandidates(candidates: BoundaryCandidate[]): BoundaryCandidate[] {
  const byBoundary = new Map<string, BoundaryCandidate>();

  for (const candidate of candidates) {
    const existing = byBoundary.get(candidate.boundaryCommitSha);
    if (!existing || candidate.score > existing.score) {
      byBoundary.set(candidate.boundaryCommitSha, candidate);
    }
  }

  return [...byBoundary.values()].sort((a, b) => b.score - a.score);
}

export function computeEraSignals(db: DrizzleDb): number {
  const commits = db
    .select({
      sha: schema.commits.sha,
      authorId: schema.commits.authorId,
      committedAt: schema.commits.committedAt,
      ccScope: schema.commits.ccScope,
    })
    .from(schema.commits)
    .orderBy(asc(schema.commits.committedAt))
    .all();

  if (commits.length === 0) {
    db.delete(schema.eraBoundaries).run();
    return 0;
  }

  const windowSize = resolveWindowSize(commits.length);
  const step = Math.max(1, Math.floor(windowSize / 2));
  const candidates: BoundaryCandidate[] = [];

  if (commits.length <= windowSize) {
    const midpoint = Math.floor(commits.length / 2);
    const prior = commits.slice(0, midpoint);
    const next = commits.slice(midpoint);
    candidates.push(...detectSignalsBetweenWindows(db, prior, next));
  } else {
    for (let start = 0; start + windowSize <= commits.length; start += step) {
      const prior = commits.slice(start, start + windowSize);
      const nextStart = start + step;
      const next = commits.slice(nextStart, nextStart + windowSize);
      if (next.length < Math.min(3, windowSize)) {
        break;
      }
      candidates.push(...detectSignalsBetweenWindows(db, prior, next));
    }
  }

  const selected = dedupeCandidates(candidates).slice(0, MAX_BOUNDARIES);

  const finalBoundaries =
    selected.length > 0
      ? selected
      : commits.length >= 2
        ? [
            {
              boundaryCommitSha: commits[Math.floor(commits.length / 2)]!.sha,
              boundaryCommittedAt:
                commits[Math.floor(commits.length / 2)]!.committedAt,
              startCommitSha: commits[0]!.sha,
              endCommitSha: commits[commits.length - 1]!.sha,
              startAt: commits[0]!.committedAt,
              endAt: commits[commits.length - 1]!.committedAt,
              signalType: "timeline_segment",
              score: 0.1,
              evidence: [
                {
                  type: "commit" as const,
                  sha: commits[Math.floor(commits.length / 2)]!.sha,
                },
              ],
            },
          ]
        : [];

  db.transaction((tx) => {
    tx.delete(schema.eraBoundaries).run();

    for (const boundary of finalBoundaries) {
      tx.insert(schema.eraBoundaries)
        .values({
          startCommitSha: boundary.startCommitSha,
          endCommitSha: boundary.endCommitSha,
          startAt: boundary.startAt,
          endAt: boundary.endAt,
          signalType: boundary.signalType,
          score: boundary.score,
          evidenceJson: JSON.stringify(boundary.evidence),
        })
        .run();
    }
  });

  return finalBoundaries.length;
}

export function getEraBoundarySignals(db: DrizzleDb): EraBoundarySignal[] {
  return db
    .select()
    .from(schema.eraBoundaries)
    .orderBy(asc(schema.eraBoundaries.startAt))
    .all()
    .map((row) => ({
      id: row.id,
      signalType: row.signalType,
      score: row.score,
      startCommitSha: row.startCommitSha,
      endCommitSha: row.endCommitSha,
      startAt: row.startAt,
      endAt: row.endAt,
      evidence: JSON.parse(row.evidenceJson) as Evidence[],
    }));
}
