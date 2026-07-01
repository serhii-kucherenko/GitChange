import { readManifest, writeManifest } from "../schema/manifest.js";
import { SEMANTIC_SCHEMA_VERSION } from "../schema/zod/eras.js";
import { checkSemanticIntegrity } from "../verify/semantic-integrity.js";
import { readErasArtifact } from "./eras-io.js";
import { assembleAndWriteTemporalGraph } from "./graph-io.js";

export interface RunSemanticPipelineResult {
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
