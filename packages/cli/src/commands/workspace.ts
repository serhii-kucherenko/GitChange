import { resolve } from "node:path";
import {
  addRepo,
  findWorkspaceGitchangeDir,
  indexWorkspace,
  loadWorkspaceContext,
  readWorkspace,
  removeRepo,
} from "@gitchange/core";

export interface WorkspaceAddOptions {
  cwd: string;
  repoPath: string;
  label?: string;
  repoId?: string;
}

export async function runWorkspaceAddCommand(
  options: WorkspaceAddOptions,
): Promise<void> {
  const resolvedPath = resolve(options.repoPath);
  const label = options.label ?? resolvedPath.split("/").pop() ?? "repo";
  const context = loadWorkspaceContext(options.cwd);
  const workspace = addRepo(context, {
    repoPath: resolvedPath,
    label,
    repoId: options.repoId,
  });

  console.log(`Added repo '${workspace.repos.at(-1)?.repoId}' (${label})`);
}

export function runWorkspaceListCommand(cwd: string): void {
  const gitchangeDir = findWorkspaceGitchangeDir(cwd);
  if (!gitchangeDir) {
    throw new Error("No workspace.json found. Add a repo with 'gitchange workspace add'.");
  }

  const workspace = readWorkspace(gitchangeDir);
  if (!workspace) {
    throw new Error("No workspace.json found. Add a repo with 'gitchange workspace add'.");
  }

  console.log(`Workspace primary: ${workspace.primaryRepoId}`);
  for (const repo of workspace.repos) {
    console.log(`- ${repo.repoId}\t${repo.label}\t${repo.repoPath}`);
  }
}

export interface WorkspaceRemoveOptions {
  cwd: string;
  repoId: string;
}

export function runWorkspaceRemoveCommand(options: WorkspaceRemoveOptions): void {
  const context = loadWorkspaceContext(options.cwd);
  if (!context.workspace) {
    throw new Error("No workspace.json found.");
  }

  const removed = removeRepo(
    context.workspaceGitchangeDir,
    context.workspace,
    options.repoId,
  );

  if (removed) {
    console.log(`Removed repo '${options.repoId}'`);
    return;
  }

  console.log(`Removed repo '${options.repoId}' (workspace is now empty)`);
}

export interface WorkspaceIndexOptions {
  cwd: string;
  full?: boolean;
  rebuildIntelligence?: boolean;
}

export async function runWorkspaceIndexCommand(
  options: WorkspaceIndexOptions,
): Promise<void> {
  const context = loadWorkspaceContext(options.cwd);
  if (!context.workspace) {
    throw new Error("No workspace.json found. Add repos before indexing.");
  }

  const workspace = context.workspace;
  const result = await indexWorkspace(workspace, {
    full: options.full,
    rebuildIntelligence: options.rebuildIntelligence,
  });

  for (const entry of result.results) {
    if (entry.success) {
      console.log(
        `Indexed ${entry.repoId}: ${entry.commitsIndexed ?? 0} commit(s)`,
      );
      continue;
    }

    console.error(`Failed ${entry.repoId}: ${entry.error ?? "unknown error"}`);
  }

  console.log(`Workspace index complete: ${result.succeeded} succeeded, ${result.failed} failed`);

  if (result.failed > 0) {
    throw new Error("One or more repositories failed to index");
  }
}
