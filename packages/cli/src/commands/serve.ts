import { join, resolve } from "node:path";
import { startServer } from "@gitchange/server";
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

  const gitchangeDir =
    options.gitchangeDir !== undefined
      ? resolve(options.gitchangeDir)
      : join(repoPath, ".gitchange");

  const host = options.host ?? "127.0.0.1";
  const port =
    options.port ??
    Number.parseInt(process.env.GITCHANGE_PORT ?? "9876", 10);

  startServer({ gitchangeDir, host, port });
}
