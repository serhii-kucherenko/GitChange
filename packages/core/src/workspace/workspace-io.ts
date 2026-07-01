import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  RepoEntry,
  WORKSPACE_SCHEMA_VERSION,
  WorkspaceArtifact,
  type WorkspaceArtifact as WorkspaceArtifactType,
} from "../schema/zod/workspace.js";

export const WORKSPACE_FILENAME = "workspace.json";

export interface AddRepoOptions {
  repoPath: string;
  label: string;
  repoId?: string;
  gitchangeDir?: string;
}

export interface AddRepoContext {
  cwd: string;
  workspace: WorkspaceArtifactType | null;
  workspaceGitchangeDir: string;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Label must produce a valid repo id");
  }

  return slug;
}

export function validateRepoPath(inputPath: string): string {
  if (inputPath.includes("\0")) {
    throw new Error("Invalid repository path");
  }

  const segments = inputPath.split(/[/\\]/);
  if (segments.some((segment) => segment === "..")) {
    throw new Error("Repository path must not contain '..' traversal segments");
  }

  const resolved = resolve(inputPath);

  if (!existsSync(resolved)) {
    throw new Error(`Repository path does not exist: ${resolved}`);
  }

  const absolute = realpathSync(resolved);

  if (!existsSync(join(absolute, ".git"))) {
    throw new Error(`Repository path must contain a .git directory: ${absolute}`);
  }

  return absolute;
}

export function findRepoRoot(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function getWorkspacePath(gitchangeDir: string): string {
  return join(gitchangeDir, WORKSPACE_FILENAME);
}

export function findWorkspaceGitchangeDir(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    const gitchangeDir = join(current, ".gitchange");
    if (existsSync(getWorkspacePath(gitchangeDir))) {
      return gitchangeDir;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveWorkspaceGitchangeDirForNew(
  cwd: string,
  firstRepoPath: string,
): string {
  const repoRoot = findRepoRoot(cwd);
  if (repoRoot) {
    return join(repoRoot, ".gitchange");
  }

  return join(firstRepoPath, ".gitchange");
}

export function resolveWorkspaceGitchangeDir(
  cwd: string,
  workspace: WorkspaceArtifactType | null,
): string {
  if (workspace) {
    const primary = workspace.repos.find(
      (repo) => repo.repoId === workspace.primaryRepoId,
    );
    if (!primary) {
      throw new Error(
        `Workspace primary repo '${workspace.primaryRepoId}' is missing`,
      );
    }
    return primary.gitchangeDir;
  }

  const discovered = findWorkspaceGitchangeDir(cwd);
  if (discovered) {
    return discovered;
  }

  const repoRoot = findRepoRoot(cwd);
  if (repoRoot) {
    return join(repoRoot, ".gitchange");
  }

  throw new Error(
    "No workspace found. Run 'gitchange workspace add <path>' from a repo root first.",
  );
}

function uniqueRepoId(
  label: string,
  requestedId: string | undefined,
  existingIds: Set<string>,
): string {
  const base = requestedId ?? slugifyLabel(label);
  if (!existingIds.has(base)) {
    return base;
  }

  if (requestedId) {
    throw new Error(`Repo id '${requestedId}' is already registered`);
  }

  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export function readWorkspace(gitchangeDir: string): WorkspaceArtifactType | null {
  const workspacePath = getWorkspacePath(gitchangeDir);

  try {
    const raw = readFileSync(workspacePath, "utf-8");
    return WorkspaceArtifact.parse(JSON.parse(raw));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export function writeWorkspace(
  gitchangeDir: string,
  artifact: WorkspaceArtifactType,
): void {
  const validated = WorkspaceArtifact.parse(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const workspacePath = getWorkspacePath(gitchangeDir);
  const tmpPath = `${workspacePath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, workspacePath);
}

export function addRepo(
  context: AddRepoContext,
  options: AddRepoOptions,
): WorkspaceArtifactType {
  const repoPath = validateRepoPath(options.repoPath);
  const gitchangeDir = options.gitchangeDir ?? join(repoPath, ".gitchange");
  const existing = context.workspace;
  const workspaceGitchangeDir = existing
    ? context.workspaceGitchangeDir
    : resolveWorkspaceGitchangeDirForNew(context.cwd, repoPath);

  const repos = existing?.repos ?? [];
  const duplicate = repos.find((repo) => repo.repoPath === repoPath);
  if (duplicate) {
    throw new Error(`Repository path is already registered as '${duplicate.repoId}'`);
  }

  const existingIds = new Set(repos.map((repo) => repo.repoId));
  const repoId = uniqueRepoId(options.label, options.repoId, existingIds);

  const entry = RepoEntry.parse({
    repoId,
    label: options.label,
    repoPath,
    gitchangeDir: resolve(gitchangeDir),
  });

  const nextRepos = [...repos, entry];
  const primaryRepoId = existing?.primaryRepoId ?? repoId;

  const workspace = WorkspaceArtifact.parse({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    primaryRepoId,
    repos: nextRepos,
    links: existing?.links ?? [],
  });

  writeWorkspace(workspaceGitchangeDir, workspace);
  return workspace;
}

export function removeRepo(
  workspaceGitchangeDir: string,
  workspace: WorkspaceArtifactType,
  repoId: string,
): WorkspaceArtifactType | null {
  const nextRepos = workspace.repos.filter((repo) => repo.repoId !== repoId);

  if (nextRepos.length === workspace.repos.length) {
    throw new Error(`Repo id '${repoId}' is not registered in this workspace`);
  }

  if (nextRepos.length === 0) {
    const workspacePath = getWorkspacePath(workspaceGitchangeDir);
    if (existsSync(workspacePath)) {
      renameSync(workspacePath, `${workspacePath}.removed`);
    }
    return null;
  }

  const removedPrimary = workspace.primaryRepoId === repoId;
  const primaryRepoId = removedPrimary
    ? (nextRepos[0]?.repoId ?? workspace.primaryRepoId)
    : workspace.primaryRepoId;

  const nextLinks = workspace.links.filter(
    (link) =>
      link.sourceRepoId !== repoId && link.targetRepoId !== repoId,
  );

  const nextWorkspace = WorkspaceArtifact.parse({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    primaryRepoId,
    repos: nextRepos,
    links: nextLinks,
  });

  const nextGitchangeDir = removedPrimary
    ? (nextRepos[0]?.gitchangeDir ?? workspaceGitchangeDir)
    : workspaceGitchangeDir;

  writeWorkspace(nextGitchangeDir, nextWorkspace);

  if (removedPrimary && nextGitchangeDir !== workspaceGitchangeDir) {
    const oldPath = getWorkspacePath(workspaceGitchangeDir);
    if (existsSync(oldPath)) {
      renameSync(oldPath, `${oldPath}.removed`);
    }
  }

  return nextWorkspace;
}

export function loadWorkspaceContext(cwd: string): AddRepoContext {
  const discoveredDir = findWorkspaceGitchangeDir(cwd);
  const workspace = discoveredDir ? readWorkspace(discoveredDir) : null;
  const workspaceGitchangeDir = workspace
    ? resolveWorkspaceGitchangeDir(cwd, workspace)
    : resolveWorkspaceGitchangeDir(cwd, null);

  return {
    cwd,
    workspace,
    workspaceGitchangeDir,
  };
}

export function narrowWorkspaceSchemaVersion(version: string): void {
  switch (version) {
    case WORKSPACE_SCHEMA_VERSION:
      return;
    default:
      assertNever(version as never);
  }
}
