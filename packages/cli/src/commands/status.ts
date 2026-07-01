import { join, resolve } from "node:path";
import { getRepoSnapshot } from "@gitchange/core";
import { resolveRepoPath } from "../repo-path.js";

export interface StatusCommandOptions {
  repo?: string;
  gitchangeDir?: string;
}

function padLabel(label: string, width: number): string {
  return `${label}:`.padEnd(width);
}

export function runStatusCommand(options: StatusCommandOptions): void {
  const repoPath = options.repo
    ? resolveRepoPath(resolve(options.repo))
    : resolveRepoPath(process.cwd());

  const gitchangeDir =
    options.gitchangeDir !== undefined
      ? resolve(options.gitchangeDir)
      : join(repoPath, ".gitchange");

  const snapshot = getRepoSnapshot(gitchangeDir);
  const { manifest, stats, intelligence } = snapshot;

  if (!manifest) {
    console.error("gitchange: not indexed. Run `gitchange index` first.");
    process.exit(1);
  }

  const labelWidth = 22;
  const lines = [
    `${padLabel("Repository", labelWidth)} ${repoPath}`,
    `${padLabel("Head", labelWidth)} ${manifest.repo.head}`,
    `${padLabel("Last indexed", labelWidth)} ${manifest.lastIndexedCommit}`,
    `${padLabel("Indexed at", labelWidth)} ${manifest.indexedAt}`,
    `${padLabel("Index completeness", labelWidth)} ${manifest.indexCompleteness}`,
    `${padLabel("Commits", labelWidth)} ${stats.commitCount}`,
    `${padLabel("File changes", labelWidth)} ${stats.fileChangeCount}`,
    `${padLabel("Authors", labelWidth)} ${stats.authorCount}`,
  ];

  if (manifest.intelligenceComputedAt) {
    lines.push(
      `${padLabel("Intelligence computed", labelWidth)} ${manifest.intelligenceComputedAt}`,
    );
  } else if (intelligence?.computedAt) {
    lines.push(
      `${padLabel("Intelligence computed", labelWidth)} ${intelligence.computedAt}`,
    );
  }

  if (manifest.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of manifest.warnings) {
      lines.push(`  [${warning.code}] ${warning.message}`);
    }
  }

  console.log(lines.join("\n"));
}
