import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findWorkspaceGitchangeDir,
  getWorkspacePath,
} from "@gitchange/core";
import { resolveDashboardDist, startServer } from "@gitchange/server";
import { resolveRepoPath } from "../repo-path.js";

export interface ServeCommandOptions {
  repo?: string;
  port?: number;
  gitchangeDir?: string;
  host?: string;
}

export function runServeCommand(options: ServeCommandOptions): void {
  const repoPath = options.repo
    ? resolveRepoPath(resolve(options.repo))
    : resolveRepoPath(process.cwd());

  let gitchangeDir =
    options.gitchangeDir !== undefined
      ? resolve(options.gitchangeDir)
      : join(repoPath, ".gitchange");

  if (!existsSync(getWorkspacePath(gitchangeDir))) {
    const discovered = findWorkspaceGitchangeDir(repoPath);
    if (discovered) {
      gitchangeDir = discovered;
    }
  }

  const host = options.host ?? "127.0.0.1";
  const port =
    options.port ??
    Number.parseInt(process.env.GITCHANGE_PORT ?? "9876", 10);

  startServer({
    gitchangeDir,
    host,
    port,
    dashboardDistPath: resolveDashboardDist(),
  });
}
