import { existsSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../artifacts/db.js";
import type { Manifest } from "../schema/manifest.js";
import { readManifest, writeManifest } from "../schema/manifest.js";
import type { AttributionConfidence } from "../schema/zod/intelligence.js";
import { INTELLIGENCE_SCHEMA_VERSION } from "../schema/zod/intelligence.js";
import { computeChurn, getChurnFileCount } from "./churn.js";
import { computeCoChange } from "./cochange.js";
import { computeEraOwnership } from "./era-ownership.js";
import { computeEraSignals } from "./era-signals.js";
import { computeExpertise } from "./expertise.js";
import { exportIntelligence } from "./export.js";
import { computeOwnership } from "./ownership/index.js";

export interface ComputeIntelligenceOptions {
  repoPath: string;
  gitchangeDir?: string;
}

export interface ComputeIntelligenceResult {
  churnFileCount: number;
  manifest: Manifest;
}

function resolveGitchangedir(repoPath: string, gitchangeDir?: string): string {
  return gitchangeDir ?? join(repoPath, ".gitchange");
}

function resolveAttributionConfidence(
  manifest: Manifest,
): AttributionConfidence {
  return manifest.indexCompleteness === "partial" ? "degraded" : "complete";
}

function assertIndexReady(gitchangeDir: string): void {
  const manifestPath = join(gitchangeDir, "manifest.json");
  const indexPath = join(gitchangeDir, "index.sqlite");

  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing manifest at ${manifestPath}. Run indexFull before computeIntelligence.`,
    );
  }

  if (!existsSync(indexPath)) {
    throw new Error(
      `Missing index at ${indexPath}. Run indexFull before computeIntelligence.`,
    );
  }
}

export async function computeIntelligence(
  options: ComputeIntelligenceOptions,
): Promise<ComputeIntelligenceResult> {
  const gitchangeDir = resolveGitchangedir(
    options.repoPath,
    options.gitchangeDir,
  );
  assertIndexReady(gitchangeDir);

  const manifest = readManifest(gitchangeDir);
  if (!manifest) {
    throw new Error(`Failed to read manifest from ${gitchangeDir}`);
  }

  const db = openDb(gitchangeDir);
  computeChurn(db);
  await computeOwnership(db, options.repoPath, manifest.repo.head);
  computeCoChange(db);
  computeEraSignals(db);
  computeEraOwnership(db);
  computeExpertise(db);

  const artifact = exportIntelligence(db, {
    gitchangeDir,
    headSha: manifest.repo.head,
    attributionConfidence: resolveAttributionConfidence(manifest),
  });

  const updatedManifest: Manifest = {
    ...manifest,
    intelligenceComputedAt: artifact.computedAt,
    intelligenceHeadSha: artifact.headSha,
    intelligenceSchemaVersion: INTELLIGENCE_SCHEMA_VERSION,
  };
  writeManifest(gitchangeDir, updatedManifest);

  return {
    churnFileCount: getChurnFileCount(db),
    manifest: updatedManifest,
  };
}
