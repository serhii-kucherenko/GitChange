import { existsSync } from "node:fs";
import { join } from "node:path";
import { readManifest } from "../../schema/manifest.js";
import type {
  CrossRepoLink,
  WorkspaceArtifact,
} from "../../schema/zod/workspace.js";
import { readWorkspace } from "../../workspace/workspace-io.js";

export interface ResolvedRepo {
  repoId: string;
  label: string;
  gitchangeDir: string;
}

export interface WorkspaceReadContext {
  workspaceGitchangeDir: string;
  workspace: WorkspaceArtifact | null;
  repos: ResolvedRepo[];
  links: CrossRepoLink[];
  isMultiRepo: boolean;
}

function isIndexedRepo(gitchangeDir: string): boolean {
  return (
    existsSync(join(gitchangeDir, "index.sqlite")) &&
    readManifest(gitchangeDir) !== null
  );
}

export function resolveWorkspaceContext(
  gitchangeDir: string,
): WorkspaceReadContext {
  const workspace = readWorkspace(gitchangeDir);

  if (!workspace) {
    return {
      workspaceGitchangeDir: gitchangeDir,
      workspace: null,
      repos: isIndexedRepo(gitchangeDir)
        ? [
            {
              repoId: readManifest(gitchangeDir)?.repoId ?? "default",
              label: "default",
              gitchangeDir,
            },
          ]
        : [],
      links: [],
      isMultiRepo: false,
    };
  }

  const repos = workspace.repos
    .filter((entry) => isIndexedRepo(entry.gitchangeDir))
    .map((entry) => ({
      repoId: entry.repoId,
      label: entry.label,
      gitchangeDir: entry.gitchangeDir,
    }));

  return {
    workspaceGitchangeDir: gitchangeDir,
    workspace,
    repos,
    links: workspace.links,
    isMultiRepo: repos.length > 1,
  };
}

export function resolveRepoGitchangeDir(
  ctx: WorkspaceReadContext,
  repoId?: string,
): string | null {
  if (!repoId) {
    return ctx.repos[0]?.gitchangeDir ?? null;
  }

  return ctx.repos.find((repo) => repo.repoId === repoId)?.gitchangeDir ?? null;
}
