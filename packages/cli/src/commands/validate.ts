import { join, resolve } from "node:path";
import {
  checkDecisionsIntegrity,
  checkIntelligenceIntegrity,
  checkSemanticIntegrity,
  checkToursIntegrity,
  checkWorkspaceIntegrity,
  readDecisionsArtifact,
  readErasArtifact,
  readManifest,
  readToursArtifact,
  readWorkspace,
} from "@gitchange/core";
import { resolveRepoPath } from "../repo-path.js";

export interface ValidateCommandOptions {
  repo?: string;
  gitchangeDir?: string;
}

export function runValidateCommand(options: ValidateCommandOptions): void {
  const repoPath = options.repo
    ? resolveRepoPath(resolve(options.repo))
    : resolveRepoPath(process.cwd());

  const gitchangeDir =
    options.gitchangeDir !== undefined
      ? resolve(options.gitchangeDir)
      : join(repoPath, ".gitchange");

  const errors: string[] = [];

  const intelligenceReport = checkIntelligenceIntegrity(gitchangeDir);
  if (!intelligenceReport.ok) {
    errors.push(...intelligenceReport.errors);
  }

  const eras = readErasArtifact(gitchangeDir);
  if (!eras) {
    errors.push("semantic artifacts missing: eras.json not found");
  } else {
    const semanticReport = checkSemanticIntegrity(gitchangeDir);
    if (!semanticReport.ok) {
      errors.push(...semanticReport.errors);
    }
  }

  const manifest = readManifest(gitchangeDir);
  const decisions = readDecisionsArtifact(gitchangeDir);

  if (decisions) {
    const decisionsReport = checkDecisionsIntegrity(gitchangeDir);
    if (!decisionsReport.ok) {
      errors.push(...decisionsReport.errors);
    }
  } else if (
    manifest?.decisionsComputedAt ||
    manifest?.decisionsSchemaVersion
  ) {
    errors.push("decisions artifacts missing: decisions.json not found");
  }

  const tours = readToursArtifact(gitchangeDir);

  if (tours) {
    const toursReport = checkToursIntegrity(gitchangeDir);
    if (!toursReport.ok) {
      errors.push(...toursReport.errors);
    }
  } else if (manifest?.toursComputedAt || manifest?.toursSchemaVersion) {
    errors.push("tours artifacts missing: tours.json not found");
  }

  const workspace = readWorkspace(gitchangeDir);
  if (workspace) {
    const workspaceReport = checkWorkspaceIntegrity(gitchangeDir);
    if (!workspaceReport.ok) {
      errors.push(...workspaceReport.errors);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`gitchange validate: ${error}`);
    }
    process.exit(1);
  }

  console.log("gitchange validate: ok");
}
