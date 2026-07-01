import { indexFull } from "../index/full.js";
import { indexIncremental } from "../index/incremental.js";
import type { IndexResult } from "../index/types.js";
import { computeIntelligence } from "../intelligence/compute.js";
import { readManifest, writeManifest } from "../schema/manifest.js";
import type { WorkspaceArtifact } from "../schema/zod/workspace.js";

export interface IndexWorkspaceOptions {
  full?: boolean;
  rebuildIntelligence?: boolean;
}

export interface RepoIndexResult {
  repoId: string;
  label: string;
  success: boolean;
  commitsIndexed?: number;
  error?: string;
  indexResult?: IndexResult;
}

export interface IndexWorkspaceResult {
  results: RepoIndexResult[];
  succeeded: number;
  failed: number;
}

function stampRepoIdOnManifest(
  gitchangeDir: string,
  repoId: string,
  indexResult: IndexResult,
): void {
  const manifest = readManifest(gitchangeDir) ?? indexResult.manifest;
  if (manifest.repoId === repoId) {
    return;
  }

  writeManifest(gitchangeDir, {
    ...manifest,
    repoId,
  });
}

export async function indexWorkspace(
  workspace: WorkspaceArtifact,
  options: IndexWorkspaceOptions = {},
): Promise<IndexWorkspaceResult> {
  const results: RepoIndexResult[] = [];

  for (const repo of workspace.repos) {
    try {
      const existingManifest = readManifest(repo.gitchangeDir);
      const useFull = options.full === true || existingManifest === null;

      const indexResult = useFull
        ? await indexFull({
            repoPath: repo.repoPath,
            gitchangeDir: repo.gitchangeDir,
            rebuildIntelligence: options.rebuildIntelligence,
          })
        : await indexIncremental({
            repoPath: repo.repoPath,
            gitchangeDir: repo.gitchangeDir,
            rebuildIntelligence: options.rebuildIntelligence,
          });

      if (!options.rebuildIntelligence) {
        await computeIntelligence({
          repoPath: repo.repoPath,
          gitchangeDir: repo.gitchangeDir,
        });
      }

      stampRepoIdOnManifest(repo.gitchangeDir, repo.repoId, indexResult);

      results.push({
        repoId: repo.repoId,
        label: repo.label,
        success: true,
        commitsIndexed: indexResult.commitsIndexed,
        indexResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        repoId: repo.repoId,
        label: repo.label,
        success: false,
        error: message,
      });
    }
  }

  const succeeded = results.filter((result) => result.success).length;
  const failed = results.length - succeeded;

  return { results, succeeded, failed };
}
