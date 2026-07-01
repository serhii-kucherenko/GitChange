import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { AttributionConfidence } from "../schema/zod/intelligence.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import { isDocPath } from "../ingestion/doc-snapshot.js";

const MAX_ERA_SIGNALS = 8;
const MAX_CHURN_FILES = 10;
const MAX_DOC_DELTAS = 5;
const MAX_EXPERTISE_TOPICS = 5;
const MAX_EXCERPT_CHARS = 500;

const INTELLIGENCE_FILENAME = "intelligence.json";

export interface EraSynthesisEraSignal {
  signalId: number;
  signalType: string;
  score: number;
  startCommitSha: string;
  endCommitSha: string;
  startAt: number;
  endAt: number;
}

export interface EraSynthesisChurnFile {
  path: string;
  changeCount: number;
  insertions: number;
  deletions: number;
  lastTouchedAt: number;
}

export interface EraSynthesisDocDelta {
  path: string;
  commitSha: string;
  excerpt: string;
}

export interface EraSynthesisContext {
  eraSignals: EraSynthesisEraSignal[];
  topChurnFiles: EraSynthesisChurnFile[];
  docDeltas: EraSynthesisDocDelta[];
  eraOwnership: IntelligenceArtifactType["eraOwnership"];
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
): EraSynthesisDocDelta[] {
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

  const latestByPath = new Map<string, EraSynthesisDocDelta>();

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

export function buildEraSynthesisContext(gitchangeDir: string): EraSynthesisContext {
  const intelligence = readIntelligenceArtifact(gitchangeDir);
  const manifest = readManifest(gitchangeDir);

  const eraSignals = [...intelligence.eraSignals.boundaries]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_ERA_SIGNALS)
    .map((boundary) => ({
      signalId: boundary.id,
      signalType: boundary.signalType,
      score: boundary.score,
      startCommitSha: boundary.startCommitSha,
      endCommitSha: boundary.endCommitSha,
      startAt: boundary.startAt,
      endAt: boundary.endAt,
    }));

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

  const boundaryCommitShas = eraSignals.flatMap((signal) => [
    signal.startCommitSha,
    signal.endCommitSha,
  ]);

  const docDeltas = collectDocDeltas(gitchangeDir, boundaryCommitShas);

  const expertiseTopics = intelligence.expertise.topics.slice(0, MAX_EXPERTISE_TOPICS);

  return {
    eraSignals,
    topChurnFiles,
    docDeltas,
    eraOwnership: intelligence.eraOwnership,
    expertiseTopics,
    manifestWarnings: manifest?.warnings ?? [],
    attributionConfidence: intelligence.attributionConfidence,
  };
}
