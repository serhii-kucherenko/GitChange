import { assembleOpenWork } from "../decisions/assemble-open-work.js";
import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import { readManifest, writeManifest } from "../schema/manifest.js";
import { DECISIONS_SCHEMA_VERSION } from "../schema/zod/decisions.js";
import { SEMANTIC_SCHEMA_VERSION } from "../schema/zod/eras.js";
import { OPEN_WORK_SCHEMA_VERSION } from "../schema/zod/open-work.js";
import { checkSemanticIntegrity } from "../verify/semantic-integrity.js";
import { readErasArtifact } from "./eras-io.js";
import { assembleAndWriteTemporalGraph } from "./graph-io.js";

export interface RunSemanticPipelineResult {
  ok: true;
}

export interface RunDecisionsPipelineResult {
  ok: true;
}

export function runSemanticPipeline(
  gitchangeDir: string,
): RunSemanticPipelineResult {
  const eras = readErasArtifact(gitchangeDir);
  if (!eras) {
    throw new Error(
      `eras.json not found in ${gitchangeDir}. Run era synthesis first.`,
    );
  }

  assembleAndWriteTemporalGraph(gitchangeDir);

  const report = checkSemanticIntegrity(gitchangeDir);
  if (!report.ok) {
    throw new Error(
      `Semantic integrity check failed: ${report.errors.join("; ")}`,
    );
  }

  const manifest = readManifest(gitchangeDir);
  if (!manifest) {
    throw new Error(`manifest.json not found in ${gitchangeDir}`);
  }

  writeManifest(gitchangeDir, {
    ...manifest,
    semanticComputedAt: eras.computedAt,
    semanticHeadSha: eras.headSha,
    semanticSchemaVersion: SEMANTIC_SCHEMA_VERSION,
  });

  return { ok: true };
}

export function runDecisionsPipeline(
  gitchangeDir: string,
): RunDecisionsPipelineResult {
  const eras = readErasArtifact(gitchangeDir);
  if (!eras) {
    throw new Error(
      `eras.json not found in ${gitchangeDir}. Run era synthesis first.`,
    );
  }

  const decisions = readDecisionsArtifact(gitchangeDir);
  if (!decisions) {
    throw new Error(
      `decisions.json not found in ${gitchangeDir}. Run decision mining first.`,
    );
  }

  const artifact = assembleOpenWork(gitchangeDir);

  const manifest = readManifest(gitchangeDir);
  if (!manifest) {
    throw new Error(`manifest.json not found in ${gitchangeDir}`);
  }

  writeManifest(gitchangeDir, {
    ...manifest,
    decisionsComputedAt: decisions.computedAt,
    openWorkComputedAt: artifact.computedAt,
    decisionsSchemaVersion: DECISIONS_SCHEMA_VERSION,
    openWorkSchemaVersion: OPEN_WORK_SCHEMA_VERSION,
  });

  return { ok: true };
}
