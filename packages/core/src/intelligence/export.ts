import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DrizzleDb } from "../artifacts/db.js";
import {
  type AttributionConfidence,
  INTELLIGENCE_SCHEMA_VERSION,
  IntelligenceArtifact,
  type IntelligenceArtifact as IntelligenceArtifactType,
} from "../schema/zod/intelligence.js";
import { getFileChurnRows } from "./churn.js";
import { getFileOwnershipRows } from "./ownership/index.js";
import { getCoChangeEdges } from "./cochange.js";
import { getEraBoundarySignals } from "./era-signals.js";

const INTELLIGENCE_FILENAME = "intelligence.json";

export interface ExportIntelligenceOptions {
  gitchangeDir: string;
  headSha: string;
  attributionConfidence: AttributionConfidence;
}

export function buildIntelligenceArtifact(
  db: DrizzleDb,
  options: ExportIntelligenceOptions,
): IntelligenceArtifactType {
  const churnRows = getFileChurnRows(db);
  const ownershipRows = getFileOwnershipRows(db);

  const ownershipByPath = new Map<
    string,
    Array<{
      authorId: number;
      name: string;
      email: string;
      lineCount: number;
      percentage: number;
      evidence: ReturnType<typeof getFileOwnershipRows>[number]["evidence"];
    }>
  >();

  for (const row of ownershipRows) {
    const authors = ownershipByPath.get(row.path) ?? [];
    authors.push({
      authorId: row.authorId,
      name: row.name,
      email: row.email,
      lineCount: row.lineCount,
      percentage: row.percentage,
      evidence: row.evidence,
    });
    ownershipByPath.set(row.path, authors);
  }

  const ownershipFiles = [...ownershipByPath.entries()].map(([path, authors]) => ({
    path,
    authors: authors.map((author) => ({
      authorId: author.authorId,
      name: author.name,
      email: author.email,
      lineCount: author.lineCount,
      percentage: author.percentage,
    })),
    evidence: authors[0]?.evidence ?? [
      { type: "file" as const, path, commitSha: options.headSha },
    ],
  }));

  return IntelligenceArtifact.parse({
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    computedAt: new Date().toISOString(),
    headSha: options.headSha,
    attributionConfidence: options.attributionConfidence,
    churn: {
      files: churnRows.map((row) => ({
        path: row.path,
        changeCount: row.changeCount,
        insertions: row.insertions,
        deletions: row.deletions,
        lastTouchedAt: row.lastTouchedAt,
        evidence: row.evidence,
      })),
    },
    coChange: { edges: getCoChangeEdges(db) },
    ownership: { files: ownershipFiles },
    eraSignals: { boundaries: getEraBoundarySignals(db) },
    expertise: { profiles: [] },
  });
}

export function writeIntelligenceArtifact(
  gitchangeDir: string,
  artifact: IntelligenceArtifactType,
): void {
  IntelligenceArtifact.parse(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const intelligencePath = join(gitchangeDir, INTELLIGENCE_FILENAME);
  const tmpPath = `${intelligencePath}.tmp`;
  const content = `${JSON.stringify(artifact, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, intelligencePath);
}

export function exportIntelligence(
  db: DrizzleDb,
  options: ExportIntelligenceOptions,
): IntelligenceArtifactType {
  const artifact = buildIntelligenceArtifact(db, options);
  writeIntelligenceArtifact(options.gitchangeDir, artifact);
  return artifact;
}
