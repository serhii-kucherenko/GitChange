import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import { readOpenWorkArtifact } from "../decisions/open-work-io.js";
import { isBelowEvidenceThreshold } from "../decisions/threshold.js";
import {
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import type { TourChapter } from "../schema/zod/tours.js";
import { TOURS_CAPS } from "../schema/zod/tours.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import { outlineDefaultTourChapters } from "./outline.js";

const MAX_DECISION_SEEDS = 8;
const MAX_OPEN_WORK_SEEDS = 5;
const MAX_EXPERTISE_TOPICS = 10;
const ERAS_SUMMARY_TEXT_MAX = 200;

const INTELLIGENCE_FILENAME = "intelligence.json";

const BACKEND_PREFIXES = [
  "packages/core/",
  "packages/server/",
  "src/api/",
  "src/db/",
  "src/lib/",
];

const FRONTEND_PREFIXES = [
  "packages/dashboard/",
  "src/components/",
  "src/app/",
  "apps/web/",
];

export interface TourEraSummary {
  id: string;
  name: string;
  summary: string;
  window: {
    startAt: number;
    endAt: number;
  };
}

export interface TourExpertiseTopic {
  topic: string;
  topPaths: string[];
}

export interface TourDecisionSeed {
  id: string;
  title: string;
  status: string;
  confidence: number;
}

export interface TourOpenWorkSeed {
  id: string;
  title: string;
  status: string;
  relatedPaths: string[];
}

export interface TourRolePathHints {
  backend: string[];
  frontend: string[];
}

export interface TourSynthesisContext {
  eraSummaries: TourEraSummary[];
  outlineChapters: TourChapter[];
  expertiseTopics: TourExpertiseTopic[];
  decisionSeeds: TourDecisionSeed[];
  openWorkSeeds: TourOpenWorkSeed[];
  rolePathHints: TourRolePathHints;
  headSha: string;
  capsReminder: typeof TOURS_CAPS;
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

function collectPathsForTopic(
  topic: string,
  churnPaths: string[],
): string[] {
  const normalizedTopic = topic.toLowerCase();
  const matched = churnPaths.filter((path) =>
    path.toLowerCase().includes(normalizedTopic),
  );

  if (matched.length > 0) {
    return matched.slice(0, 5);
  }

  return churnPaths.slice(0, 3);
}

function collectRolePathHints(
  intelligence: IntelligenceArtifactType,
): TourRolePathHints {
  const churnPaths = intelligence.churn.files.map((file) => file.path);

  const backend = churnPaths
    .filter((path) => BACKEND_PREFIXES.some((prefix) => path.startsWith(prefix)))
    .slice(0, 10);

  const frontend = churnPaths
    .filter((path) => FRONTEND_PREFIXES.some((prefix) => path.startsWith(prefix)))
    .slice(0, 10);

  return { backend, frontend };
}

export function buildTourSynthesisContext(
  gitchangeDir: string,
): TourSynthesisContext {
  const intelligence = readIntelligenceArtifact(gitchangeDir);
  const erasArtifact = readErasArtifact(gitchangeDir);
  const decisionsArtifact = readDecisionsArtifact(gitchangeDir);
  const openWorkArtifact = readOpenWorkArtifact(gitchangeDir);

  if (!erasArtifact) {
    throw new Error(
      `eras.json not found in ${gitchangeDir}. Run era synthesis before tour synthesis.`,
    );
  }

  const eraSummaries = erasArtifact.eras.map((era) => ({
    id: era.id,
    name: era.name,
    summary: truncateSummary(era.summary),
    window: {
      startAt: era.startAt,
      endAt: era.endAt,
    },
  }));

  const outlineChapters = outlineDefaultTourChapters(erasArtifact);

  const churnPaths = [...intelligence.churn.files]
    .sort((left, right) => right.changeCount - left.changeCount)
    .map((file) => file.path);

  const expertiseTopics = intelligence.expertise.topics
    .slice(0, MAX_EXPERTISE_TOPICS)
    .map((entry) => ({
      topic: entry.topic,
      topPaths: collectPathsForTopic(entry.topic, churnPaths),
    }));

  const decisionSeeds = (decisionsArtifact?.decisions ?? [])
    .filter((decision) => !isBelowEvidenceThreshold(decision))
    .slice(0, MAX_DECISION_SEEDS)
    .map((decision) => ({
      id: decision.id,
      title: decision.title,
      status: decision.status,
      confidence: decision.confidence,
    }));

  const openWorkSeeds = (openWorkArtifact?.threads ?? [])
    .slice(0, MAX_OPEN_WORK_SEEDS)
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      status: thread.status,
      relatedPaths: thread.relatedPaths,
    }));

  return {
    eraSummaries,
    outlineChapters,
    expertiseTopics,
    decisionSeeds,
    openWorkSeeds,
    rolePathHints: collectRolePathHints(intelligence),
    headSha: erasArtifact.headSha,
    capsReminder: TOURS_CAPS,
  };
}
