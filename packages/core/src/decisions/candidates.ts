import { desc, eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { isDocPath } from "../ingestion/doc-snapshot.js";
import { isIntelligenceIgnoredPath } from "../intelligence/path-filters.js";
import type { Evidence } from "../schema/zod/evidence.js";
import * as schema from "../schema/drizzle/schema.js";

const MAX_CANDIDATES = 60;

const DECISION_KEYWORDS =
  /\b(migration|migrate|refactor|adr|breaking|wip|todo)\b/i;

const WIP_TODO_PATTERN = /\b(WIP|TODO)\b/;

const LOCKFILE_PATTERNS = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "go.sum",
] as const;

export interface DecisionCandidate {
  candidateId: string;
  title: string;
  seedEvidence: Evidence[];
  relatedPaths: string[];
  sourceSignals: string[];
}

interface CommitRow {
  sha: string;
  summary: string;
  message: string;
  committedAt: number;
  isMerge: boolean;
  ccType: string | null;
  ccScope: string | null;
  ccBreaking: boolean | null;
  paths: string[];
}

function isLockfilePath(path: string): boolean {
  return LOCKFILE_PATTERNS.some(
    (lockfile) => path === lockfile || path.endsWith(`/${lockfile}`),
  );
}

function isLockfileOnly(paths: string[]): boolean {
  if (paths.length === 0) {
    return false;
  }

  return paths.every((path) => isLockfilePath(path) || isIntelligenceIgnoredPath(path));
}

function isDocOrMetaPath(path: string): boolean {
  return (
    isDocPath(path) ||
    path.startsWith(".gitchange") ||
    path === ".env" ||
    path.startsWith(".env.")
  );
}

function hasStructuralPathChange(paths: string[]): boolean {
  return paths.some(
    (path) => !isIntelligenceIgnoredPath(path) && !isDocOrMetaPath(path),
  );
}

function isChoreDocsNoise(ccType: string | null, paths: string[]): boolean {
  if (ccType !== "chore" && ccType !== "docs") {
    return false;
  }

  return !hasStructuralPathChange(paths);
}

function isMigrationScopedPath(path: string): boolean {
  return /migrat|refactor|adr/i.test(path);
}

function hasMigrationScopedPaths(paths: string[]): boolean {
  return paths.some(isMigrationScopedPath);
}

function hasDecisionKeyword(text: string): boolean {
  return DECISION_KEYWORDS.test(text);
}

function hasAdrFrontmatter(
  frontmatter: Record<string, unknown> | null,
  path: string,
): boolean {
  if (!frontmatter) {
    return /adr|decision/i.test(path);
  }

  const status = frontmatter.status;
  if (typeof status === "string" && status.length > 0) {
    return true;
  }

  const decision = frontmatter.decision;
  if (typeof decision === "string" && decision.length > 0) {
    return true;
  }

  return /adr|decision/i.test(path);
}

function collectCommitRows(gitchangeDir: string): CommitRow[] {
  const db = openDb(gitchangeDir);
  const commits = db
    .select({
      sha: schema.commits.sha,
      summary: schema.commits.summary,
      message: schema.commits.message,
      committedAt: schema.commits.committedAt,
      isMerge: schema.commits.isMerge,
      ccType: schema.commits.ccType,
      ccScope: schema.commits.ccScope,
      ccBreaking: schema.commits.ccBreaking,
    })
    .from(schema.commits)
    .orderBy(desc(schema.commits.committedAt))
    .all();

  const pathsBySha = new Map<string, string[]>();

  for (const row of db.select().from(schema.fileChanges).all()) {
    const existing = pathsBySha.get(row.commitSha) ?? [];
    existing.push(row.path);
    pathsBySha.set(row.commitSha, existing);
  }

  return commits.map((commit) => ({
    ...commit,
    paths: pathsBySha.get(commit.sha) ?? [],
  }));
}

function buildCandidate(
  row: CommitRow,
  sourceSignals: string[],
): DecisionCandidate {
  const relatedPaths = [...new Set(row.paths)].filter(
    (path) => !isIntelligenceIgnoredPath(path),
  );

  return {
    candidateId: `candidate:${row.sha}`,
    title: row.summary,
    seedEvidence: [{ type: "commit", sha: row.sha }],
    relatedPaths,
    sourceSignals,
  };
}

function evaluateCommitSignals(row: CommitRow): string[] {
  const signals: string[] = [];

  if (row.ccBreaking) {
    signals.push("cc_breaking");
  }

  if (row.ccType === "feat" && hasDecisionKeyword(row.message)) {
    signals.push("feat_migration_keyword");
  }

  if (row.ccType === "refactor" || hasDecisionKeyword(row.message)) {
    signals.push("refactor_or_keyword");
  }

  if (WIP_TODO_PATTERN.test(row.summary) && hasMigrationScopedPaths(row.paths)) {
    signals.push("wip_on_migration_path");
  }

  return signals;
}

function collectDocCandidates(gitchangeDir: string): DecisionCandidate[] {
  const db = openDb(gitchangeDir);
  const rows = db
    .select({
      path: schema.docSnapshots.path,
      commitSha: schema.docSnapshots.commitSha,
      frontmatterJson: schema.docSnapshots.frontmatterJson,
      summary: schema.commits.summary,
    })
    .from(schema.docSnapshots)
    .innerJoin(
      schema.commits,
      eq(schema.docSnapshots.commitSha, schema.commits.sha),
    )
    .orderBy(desc(schema.commits.committedAt))
    .all()
    .filter((row) => isDocPath(row.path));

  const candidates: DecisionCandidate[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const frontmatter = row.frontmatterJson
      ? (JSON.parse(row.frontmatterJson) as Record<string, unknown>)
      : null;

    if (!hasAdrFrontmatter(frontmatter, row.path)) {
      continue;
    }

    const key = `${row.commitSha}:${row.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    candidates.push({
      candidateId: `candidate:doc:${row.commitSha}:${row.path}`,
      title: row.summary || `Doc update: ${row.path}`,
      seedEvidence: [
        {
          type: "doc",
          path: row.path,
          commitSha: row.commitSha,
          excerpt: `ADR or decision doc touched at ${row.path}`,
        },
      ],
      relatedPaths: [row.path],
      sourceSignals: ["doc_adr_frontmatter"],
    });
  }

  return candidates;
}

export function extractDecisionCandidates(
  gitchangeDir: string,
): DecisionCandidate[] {
  const commitRows = collectCommitRows(gitchangeDir);
  const candidates: DecisionCandidate[] = [];
  const seenIds = new Set<string>();

  for (const row of commitRows) {
    if (row.isMerge) {
      continue;
    }

    if (isLockfileOnly(row.paths)) {
      continue;
    }

    if (isChoreDocsNoise(row.ccType, row.paths)) {
      continue;
    }

    const sourceSignals = evaluateCommitSignals(row);
    if (sourceSignals.length === 0) {
      continue;
    }

    const candidate = buildCandidate(row, sourceSignals);
    if (seenIds.has(candidate.candidateId)) {
      continue;
    }

    seenIds.add(candidate.candidateId);
    candidates.push(candidate);
  }

  for (const docCandidate of collectDocCandidates(gitchangeDir)) {
    if (seenIds.has(docCandidate.candidateId)) {
      continue;
    }

    seenIds.add(docCandidate.candidateId);
    candidates.push(docCandidate);
  }

  return candidates.slice(0, MAX_CANDIDATES);
}
