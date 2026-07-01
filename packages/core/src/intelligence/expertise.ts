import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import { getCoChangeEdges } from "./cochange.js";
import { isIntelligenceIgnoredPath } from "./path-filters.js";
import { getFileOwnershipRows } from "./ownership/index.js";

const MIN_PREFIX_TOUCHES = 3;
const MAX_CONTRIBUTORS_PER_TOPIC = 3;

interface TopicDefinition {
  topic: string;
  matchPath: (path: string) => boolean;
  matchScope: (scope: string | null) => boolean;
}

interface AuthorScore {
  authorId: number;
  rawScore: number;
  evidence: Evidence[];
  commitTouches: number;
  ownershipWeight: number;
  scopeMatches: number;
}

function pathPrefixTopics(paths: string[]): TopicDefinition[] {
  const prefixTouches = new Map<string, number>();

  for (const path of paths) {
    const segments = path.split("/");
    if (segments.length < 2) {
      continue;
    }

    const prefix = segments.slice(0, 2).join("/");
    prefixTouches.set(prefix, (prefixTouches.get(prefix) ?? 0) + 1);
  }

  const topics: TopicDefinition[] = [];

  for (const [prefix, touches] of prefixTouches) {
    if (touches < MIN_PREFIX_TOUCHES) {
      continue;
    }

    const topicLabel = prefix.split("/").pop() ?? prefix;
    topics.push({
      topic: topicLabel,
      matchPath: (path) => path === prefix || path.startsWith(`${prefix}/`),
      matchScope: () => false,
    });
  }

  return topics;
}

function scopeTopics(scopes: string[]): TopicDefinition[] {
  const counts = new Map<string, number>();

  for (const scope of scopes) {
    if (!scope) {
      continue;
    }
    counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_PREFIX_TOUCHES)
    .map(([scope]) => ({
      topic: scope,
      matchPath: () => false,
      matchScope: (value) => value === scope,
    }));
}

function coChangeTopics(db: DrizzleDb): TopicDefinition[] {
  const edges = getCoChangeEdges(db, 5);
  const topics: TopicDefinition[] = [];

  for (const edge of edges) {
    const hub = edge.pathA;
    topics.push({
      topic: `related:${hub}`,
      matchPath: (path) => path === hub || path === edge.pathB,
      matchScope: () => false,
    });
  }

  return topics;
}

function mergeTopicDefinitions(definitions: TopicDefinition[]): TopicDefinition[] {
  const merged = new Map<string, TopicDefinition>();

  for (const definition of definitions) {
    const existing = merged.get(definition.topic);
    if (!existing) {
      merged.set(definition.topic, definition);
      continue;
    }

    const priorPath = existing.matchPath;
    const priorScope = existing.matchScope;
    merged.set(definition.topic, {
      topic: definition.topic,
      matchPath: (path) => priorPath(path) || definition.matchPath(path),
      matchScope: (scope) => priorScope(scope) || definition.matchScope(scope),
    });
  }

  return [...merged.values()];
}

function buildRationale(score: AuthorScore): string {
  const parts: string[] = [];

  if (score.commitTouches > 0) {
    parts.push(`${score.commitTouches} commit touch${score.commitTouches === 1 ? "" : "es"}`);
  }
  if (score.ownershipWeight > 0) {
    parts.push(`${score.ownershipWeight.toFixed(0)}% HEAD ownership`);
  }
  if (score.scopeMatches > 0) {
    parts.push(`${score.scopeMatches} scope match${score.scopeMatches === 1 ? "" : "es"}`);
  }

  return parts.length > 0 ? parts.join("; ") : "contributor activity";
}

function normalizeScores(scores: AuthorScore[]): AuthorScore[] {
  const max = Math.max(...scores.map((score) => score.rawScore), 0);
  if (max <= 0) {
    return scores.map((score) => ({ ...score, rawScore: 0 }));
  }

  return scores.map((score) => ({
    ...score,
    rawScore: score.rawScore / max,
  }));
}

export function computeExpertise(db: DrizzleDb): number {
  const changeRows = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
      authorId: schema.commits.authorId,
      ccScope: schema.commits.ccScope,
      contentIgnored: schema.fileChanges.contentIgnored,
    })
    .from(schema.fileChanges)
    .innerJoin(
      schema.commits,
      eq(schema.fileChanges.commitSha, schema.commits.sha),
    )
    .all();

  const indexedPaths = changeRows
    .filter((row) => !row.contentIgnored && !isIntelligenceIgnoredPath(row.path))
    .map((row) => row.path);

  const scopes = changeRows
    .map((row) => row.ccScope)
    .filter((scope): scope is string => scope !== null && scope.length > 0);

  const topicDefs = mergeTopicDefinitions([
    ...pathPrefixTopics(indexedPaths),
    ...scopeTopics(scopes),
    ...coChangeTopics(db),
  ]);

  const ownershipRows = getFileOwnershipRows(db);
  const ownershipByPathAuthor = new Map<string, number>();
  for (const row of ownershipRows) {
    ownershipByPathAuthor.set(`${row.path}\0${row.authorId}`, row.percentage);
  }

  let inserted = 0;

  db.transaction((tx) => {
    tx.delete(schema.contributorExpertise).run();

    for (const topicDef of topicDefs) {
      const scores = new Map<number, AuthorScore>();

      for (const row of changeRows) {
        if (row.contentIgnored || isIntelligenceIgnoredPath(row.path)) {
          continue;
        }

        const pathMatches = topicDef.matchPath(row.path);
        const scopeMatches = topicDef.matchScope(row.ccScope);
        if (!pathMatches && !scopeMatches) {
          continue;
        }

        const entry = scores.get(row.authorId) ?? {
          authorId: row.authorId,
          rawScore: 0,
          evidence: [],
          commitTouches: 0,
          ownershipWeight: 0,
          scopeMatches: 0,
        };

        if (pathMatches) {
          entry.commitTouches += 1;
          entry.rawScore += 1;
          entry.ownershipWeight = Math.max(
            entry.ownershipWeight,
            ownershipByPathAuthor.get(`${row.path}\0${row.authorId}`) ?? 0,
          );
          entry.rawScore += (ownershipByPathAuthor.get(`${row.path}\0${row.authorId}`) ?? 0) / 100;
          entry.evidence.push({
            type: "file",
            path: row.path,
            commitSha: row.commitSha,
          });
        }

        if (scopeMatches) {
          entry.scopeMatches += 1;
          entry.rawScore += 1.5;
          entry.evidence.push({
            type: "commit",
            sha: row.commitSha,
          });
        }

        scores.set(row.authorId, entry);
      }

      const ranked = normalizeScores(
        [...scores.values()]
          .filter((score) => score.evidence.length > 0)
          .sort((a, b) => b.rawScore - a.rawScore)
          .slice(0, MAX_CONTRIBUTORS_PER_TOPIC),
      );

      for (const score of ranked) {
        const evidence = score.evidence.slice(0, 5);
        tx.insert(schema.contributorExpertise)
          .values({
            authorId: score.authorId,
            topic: topicDef.topic,
            score: score.rawScore,
            evidenceJson: JSON.stringify(evidence),
          })
          .run();
        inserted += 1;
      }
    }
  });

  return inserted;
}

export function getExpertiseExport(db: DrizzleDb): {
  topics: Array<{
    topic: string;
    suggestedContributors: Array<{
      authorId: number;
      name: string;
      email: string;
      score: number;
      rationale: string;
      evidence: Evidence[];
    }>;
  }>;
} {
  const authors = db.select().from(schema.authors).all();
  const authorById = new Map(authors.map((author) => [author.id, author]));

  const rows = db.select().from(schema.contributorExpertise).all();
  const byTopic = new Map<string, typeof rows>();

  for (const row of rows) {
    const topicRows = byTopic.get(row.topic) ?? [];
    topicRows.push(row);
    byTopic.set(row.topic, topicRows);
  }

  const topics = [...byTopic.entries()].map(([topic, topicRows]) => {
    const suggestedContributors = topicRows
      .sort((a, b) => b.score - a.score)
      .map((row) => {
        const author = authorById.get(row.authorId);
        const evidence = JSON.parse(row.evidenceJson) as Evidence[];

        return {
          authorId: row.authorId,
          name: author?.name ?? "unknown",
          email: author?.email ?? "unknown",
          score: row.score,
          rationale: buildRationale({
            authorId: row.authorId,
            rawScore: row.score,
            evidence,
            commitTouches: evidence.filter((ref) => ref.type === "file").length,
            ownershipWeight: 0,
            scopeMatches: evidence.filter((ref) => ref.type === "commit").length,
          }),
          evidence,
        };
      });

    return { topic, suggestedContributors };
  });

  return { topics };
}
