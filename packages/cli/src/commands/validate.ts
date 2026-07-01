import { join, resolve } from "node:path";
import {
  checkIntelligenceIntegrity,
  checkSemanticIntegrity,
  readErasArtifact,
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

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`gitchange validate: ${error}`);
    }
    process.exit(1);
  }

  console.log("gitchange validate: ok");
}
