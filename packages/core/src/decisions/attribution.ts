import { eq, inArray } from "drizzle-orm";
import type { DrizzleDb } from "../artifacts/db.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { DecisionRecord } from "../schema/zod/decisions.js";
import type { DecisionAttribution } from "../schema/zod/decisions.js";
import type { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import type { Evidence } from "../schema/zod/evidence.js";

/** Max decision confidence when attribution is inferred without interview evidence (P6-D-09). */
export const INFERRED_MEDIUM_CONFIDENCE_CAP = 0.65;

interface AuthorScore {
  authorId: number;
  name: string;
  email: string;
  commitTouches: number;
  expertiseBoost: number;
  evidence: Evidence[];
}

function collectCommitShas(evidence: Evidence[]): string[] {
  const shas = new Set<string>();

  for (const ref of evidence) {
    switch (ref.type) {
      case "commit":
        shas.add(ref.sha);
        break;
      case "file":
      case "doc":
      case "hunk":
        shas.add(ref.commitSha);
        break;
      case "interview":
        break;
      default:
        assertNever(ref);
    }
  }

  return [...shas];
}

function pathMatchesTopic(path: string, topic: string): boolean {
  if (topic.startsWith("related:")) {
    const hub = topic.slice("related:".length);
    return path === hub || path.endsWith(`/${hub}`) || path.startsWith(`${hub}/`);
  }

  const segments = path.split("/");
  if (segments.length < 2) {
    return false;
  }

  const label = segments.slice(0, 2).join("/").split("/").pop();
  return topic === label;
}

function expertiseBoostForAuthor(
  authorId: number,
  relatedPaths: string[],
  intelligence: IntelligenceArtifact,
): number {
  if (relatedPaths.length === 0) {
    return 0;
  }

  let boost = 0;

  for (const topicEntry of intelligence.expertise.topics) {
    const pathMatch = relatedPaths.some((path) =>
      pathMatchesTopic(path, topicEntry.topic),
    );
    if (!pathMatch) {
      continue;
    }

    const contributor = topicEntry.suggestedContributors.find(
      (entry) => entry.authorId === authorId,
    );
    if (contributor) {
      boost += contributor.score;
    }
  }

  return boost;
}

function buildAttributionRationale(score: AuthorScore): string {
  const parts: string[] = [];

  if (score.commitTouches > 0) {
    parts.push(
      `${score.commitTouches} evidence commit touch${score.commitTouches === 1 ? "" : "es"}`,
    );
  }
  if (score.expertiseBoost > 0) {
    parts.push(
      `expertise match (score ${score.expertiseBoost.toFixed(2)}) on related paths`,
    );
  }

  return parts.length > 0
    ? parts.join("; ")
    : "primary author from decision evidence commits";
}

export function resolveDecisionAttribution(
  db: DrizzleDb,
  decision: Pick<DecisionRecord, "evidence" | "relatedPaths">,
  intelligence: IntelligenceArtifact,
): DecisionAttribution | undefined {
  const commitShas = collectCommitShas(decision.evidence);
  if (commitShas.length === 0) {
    return undefined;
  }

  const rows = db
    .select({
      sha: schema.commits.sha,
      authorId: schema.commits.authorId,
      name: schema.authors.name,
      email: schema.authors.email,
    })
    .from(schema.commits)
    .innerJoin(schema.authors, eq(schema.commits.authorId, schema.authors.id))
    .where(inArray(schema.commits.sha, commitShas))
    .all();

  if (rows.length === 0) {
    return undefined;
  }

  const relatedPaths = decision.relatedPaths ?? [];
  const scores = new Map<number, AuthorScore>();

  for (const row of rows) {
    const entry = scores.get(row.authorId) ?? {
      authorId: row.authorId,
      name: row.name,
      email: row.email,
      commitTouches: 0,
      expertiseBoost: 0,
      evidence: [],
    };

    entry.commitTouches += 1;
    entry.evidence.push({ type: "commit", sha: row.sha });
    scores.set(row.authorId, entry);
  }

  for (const entry of scores.values()) {
    entry.expertiseBoost = expertiseBoostForAuthor(
      entry.authorId,
      relatedPaths,
      intelligence,
    );
  }

  const ranked = [...scores.values()].sort((left, right) => {
    const leftScore = left.commitTouches + left.expertiseBoost;
    const rightScore = right.commitTouches + right.expertiseBoost;
    return rightScore - leftScore;
  });

  const winner = ranked[0];
  if (!winner) {
    return undefined;
  }

  const evidence = winner.evidence.slice(0, 5);
  if (evidence.length === 0) {
    return undefined;
  }

  return {
    authorId: winner.authorId,
    name: winner.name,
    email: winner.email,
    rationale: buildAttributionRationale(winner),
    evidence,
  };
}

export function capInferredConfidence(
  confidence: number,
  evidence: Evidence[],
): number {
  const hasInterview = evidence.some((ref) => ref.type === "interview");
  if (hasInterview) {
    return confidence;
  }

  return Math.min(confidence, INFERRED_MEDIUM_CONFIDENCE_CAP);
}
