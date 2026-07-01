import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import { readOpenWorkArtifact } from "../decisions/open-work-io.js";
import { readManifest, writeManifest } from "../schema/manifest.js";
import { TOURS_SCHEMA_VERSION } from "../schema/zod/tours.js";
import { checkToursIntegrity } from "../verify/tours-integrity.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import { readToursArtifact } from "./tours-io.js";

export interface RunToursPipelineResult {
  ok: true;
}

export function runToursPipeline(
  gitchangeDir: string,
): RunToursPipelineResult {
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

  const openWork = readOpenWorkArtifact(gitchangeDir);
  if (!openWork) {
    throw new Error(
      `open-work.json not found in ${gitchangeDir}. Run decisions pipeline first.`,
    );
  }

  const tours = readToursArtifact(gitchangeDir);
  if (!tours) {
    throw new Error(
      `tours.json not found in ${gitchangeDir}. Run tour synthesis first.`,
    );
  }

  const report = checkToursIntegrity(gitchangeDir, tours);
  if (!report.ok) {
    throw new Error(
      `Tours integrity check failed: ${report.errors.join("; ")}`,
    );
  }

  const manifest = readManifest(gitchangeDir);
  if (!manifest) {
    throw new Error(`manifest.json not found in ${gitchangeDir}`);
  }

  writeManifest(gitchangeDir, {
    ...manifest,
    toursComputedAt: tours.computedAt,
    toursHeadSha: tours.headSha,
    toursSchemaVersion: TOURS_SCHEMA_VERSION,
  });

  return { ok: true };
}
