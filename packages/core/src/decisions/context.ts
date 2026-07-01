import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { isDocPath } from "../ingestion/doc-snapshot.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { AttributionConfidence } from "../schema/zod/intelligence.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import type { InflectionType } from "../schema/zod/eras.js";
import { extractDecisionCandidates, type DecisionCandidate } from "./candidates.js";
import { readErasArtifact } from "../semantic/eras-io.js";

const MAX_CANDIDATES = 30;
const MAX_ERAS_SUMMARY = 8;
const MAX_CHURN_FILES = 10;
const MAX_DOC_DELTAS = 5;
const MAX_EXPERTISE_TOPICS = 5;
const MAX_EXCERPT_CHARS = 500;
const ERAS_SUMMARY_TEXT_MAX = 200;

const INTELLIGENCE_FILENAME = "intelligence.json";

export interface DecisionMiningEraSummary {
  name: string;
  summary: string;
  inflectionTypes: InflectionType[];
}

export interface DecisionMiningErasSummary {
  eraCount: number;
  inflectionCount: number;
  eras: DecisionMiningEraSummary[];
}

export interface DecisionMiningChurnFile {
  path: string;
  changeCount: number;
  insertions: number;
  deletions: number;
  lastTouchedAt: number;
}

export interface DecisionMiningDocDelta {
  path: string;
  commitSha: string;
  excerpt: string;
}

export interface DecisionMiningContext {
  candidates: DecisionCandidate[];
  erasSummary: DecisionMiningErasSummary | null;
  topChurnFiles: DecisionMiningChurnFile[];
  docDeltas: DecisionMiningDocDelta[];
  expertiseTopics: IntelligenceArtifactType["expertise"]["topics"];
  manifestWarnings: Array<{ code: string; message: string }>;
  attributionConfidence: AttributionConfidence;
}

function readIntelligenceArtifact(gitchangeDir: string): IntelligenceArtifactType {
  const intelligencePath = join(gitchangeDir, INTELLIGENCE_FILENAME);
  if (!existsSync(intelligencePath)) {
    throw new Error(
      `intelligence.json not found in ${gitchangeDir}. Run index and computeIntelligence first.`,
    );
  }

  const raw = readFileSync(intelligencePath, "utf-8");
  return IntelligenceArtifact.parse(JSON.parse(raw));
}

function truncateSummary(summary: string): string {
  if (summary.length <= ERAS_SUMMARY_TEXT_MAX) {
    return summary;
  }

  return `${summary.slice(0, ERAS_SUMMARY_TEXT_MAX - 1)}…`;
}

function buildErasSummary(gitchangeDir: string): DecisionMiningErasSummary | null {
  const erasArtifact = readErasArtifact(gitchangeDir);
  if (!erasArtifact) {
    return null;
  }

  const inflectionCount = erasArtifact.eras.reduce(
    (total, era) => total + era.inflections.length,
    0,
  );

  const eras = erasArtifact.eras.slice(0, MAX_ERAS_SUMMARY).map((era) => ({
    name: era.name,
    summary: truncateSummary(era.summary),
    inflectionTypes: era.inflections.map((inflection) => inflection.type),
  }));

  return {
    eraCount: erasArtifact.eras.length,
    inflectionCount,
    eras,
  };
}

function trimExcerpt(content: string | null): string | null {
  if (!content) {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length <= MAX_EXCERPT_CHARS
    ? trimmed
    : `${trimmed.slice(0, MAX_EXCERPT_CHARS - 1)}…`;
}

function collectDocDeltas(
  gitchangeDir: string,
  boundaryCommitShas: string[],
): DecisionMiningDocDelta[] {
  if (boundaryCommitShas.length === 0) {
    return [];
  }

  const db = openDb(gitchangeDir);
  const uniqueShas = [...new Set(boundaryCommitShas)];

  const rows = db
    .select({
      path: schema.docSnapshots.path,
      commitSha: schema.docSnapshots.commitSha,
      content: schema.docSnapshots.content,
      committedAt: schema.commits.committedAt,
    })
    .from(schema.docSnapshots)
    .innerJoin(
      schema.commits,
      eq(schema.docSnapshots.commitSha, schema.commits.sha),
    )
    .where(inArray(schema.docSnapshots.commitSha, uniqueShas))
    .orderBy(desc(schema.commits.committedAt))
    .all()
    .filter((row) => isDocPath(row.path));

  const latestByPath = new Map<string, DecisionMiningDocDelta>();

  for (const row of rows) {
    if (latestByPath.has(row.path)) {
      continue;
    }

    const excerpt = trimExcerpt(row.content);
    if (!excerpt) {
      continue;
    }

    latestByPath.set(row.path, {
      path: row.path,
      commitSha: row.commitSha,
      excerpt,
    });

    if (latestByPath.size >= MAX_DOC_DELTAS) {
      break;
    }
  }

  return [...latestByPath.values()];
}

function collectBoundaryCommitShas(
  gitchangeDir: string,
  intelligence: IntelligenceArtifactType,
): string[] {
  const erasArtifact = readErasArtifact(gitchangeDir);
  if (erasArtifact) {
    return erasArtifact.eras
      .slice(0, MAX_ERAS_SUMMARY)
      .flatMap((era) => [era.startCommitSha, era.endCommitSha]);
  }

  return intelligence.eraSignals.boundaries
    .slice(0, MAX_ERAS_SUMMARY)
    .flatMap((boundary) => [boundary.startCommitSha, boundary.endCommitSha]);
}

export function buildDecisionMiningContext(
  gitchangeDir: string,
): DecisionMiningContext {
  const intelligence = readIntelligenceArtifact(gitchangeDir);
  const manifest = readManifest(gitchangeDir);
  const erasSummary = buildErasSummary(gitchangeDir);

  const candidates = extractDecisionCandidates(gitchangeDir).slice(
    0,
    MAX_CANDIDATES,
  );

  const topChurnFiles = [...intelligence.churn.files]
    .sort((left, right) => right.changeCount - left.changeCount)
    .slice(0, MAX_CHURN_FILES)
    .map(({ path, changeCount, insertions, deletions, lastTouchedAt }) => ({
      path,
      changeCount,
      insertions,
      deletions,
      lastTouchedAt,
    }));

  const boundaryCommitShas = collectBoundaryCommitShas(gitchangeDir, intelligence);

  const docDeltas = collectDocDeltas(gitchangeDir, boundaryCommitShas);
  const expertiseTopics = intelligence.expertise.topics.slice(
    0,
    MAX_EXPERTISE_TOPICS,
  );

  return {
    candidates,
    erasSummary,
    topChurnFiles,
    docDeltas,
    expertiseTopics,
    manifestWarnings: manifest?.warnings ?? [],
    attributionConfidence: intelligence.attributionConfidence,
  };
}
