#!/usr/bin/env node
import { Command } from "commander";
import { join, resolve } from "node:path";
import { runIndexCommand } from "./commands/index.js";
import { runServeCommand } from "./commands/serve.js";
import { runStatusCommand } from "./commands/status.js";
import { runValidateCommand } from "./commands/validate.js";
import {
  runWorkspaceAddCommand,
  runWorkspaceIndexCommand,
  runWorkspaceListCommand,
  runWorkspaceRemoveCommand,
} from "./commands/workspace.js";
import { resolveRepoPath } from "./repo-path.js";

export const program = new Command();

program
  .name("gitchange")
  .description("Analyze git history into .gitchange/")
  .version("0.0.0");

program
  .command("index")
  .description("Index repository history into .gitchange/")
  .option("--repo <path>", "Repository path (default: auto-detect from cwd)")
  .option("--no-workers", "Disable parallel indexing workers")
  .action(async (options: { repo?: string; workers?: boolean }) => {
    const repoPath = options.repo
      ? resolveRepoPath(resolve(options.repo))
      : resolveRepoPath(process.cwd());
    const gitchangeDir = join(repoPath, ".gitchange");
    await runIndexCommand({
      repoPath,
      gitchangeDir,
      useWorkers: options.workers !== false,
    });
  });

program
  .command("status")
  .description("Show index freshness and stats for a repository")
  .option("--repo <path>", "Repository path (default: auto-detect from cwd)")
  .option(
    "--gitchange-dir <path>",
    "Path to .gitchange directory (default: <repo>/.gitchange)",
  )
  .action((options: { repo?: string; gitchangeDir?: string }) => {
    runStatusCommand(options);
  });

program
  .command("validate")
  .description("Validate intelligence and semantic artifact integrity")
  .option("--repo <path>", "Repository path (default: auto-detect from cwd)")
  .option(
    "--gitchange-dir <path>",
    "Path to .gitchange directory (default: <repo>/.gitchange)",
  )
  .action((options: { repo?: string; gitchangeDir?: string }) => {
    runValidateCommand(options);
  });

program
  .command("serve")
  .description("Start local dashboard API server")
  .option("--repo <path>", "Repository path (default: auto-detect from cwd)")
  .option("--port <number>", "Listen port (default: 9876)", (value) =>
    Number.parseInt(value, 10),
  )
  .option(
    "--gitchange-dir <path>",
    "Path to .gitchange directory (default: <repo>/.gitchange)",
  )
  .option(
    "--host <address>",
    "Listen address (default: 127.0.0.1; 0.0.0.0 is unsafe on shared machines)",
  )
  .action(
    (options: {
      repo?: string;
      port?: number;
      gitchangeDir?: string;
      host?: string;
    }) => {
      runServeCommand(options);
    },
  );

const workspace = program
  .command("workspace")
  .description("Manage multi-repo workspace registration and indexing");

workspace
  .command("add <path>")
  .description("Register a repository in workspace.json")
  .option("--label <name>", "Display label for the repository")
  .option("--id <repoId>", "Stable repo id slug (default: derived from label)")
  .action(
    async (
      pathArg: string,
      options: { label?: string; id?: string },
    ) => {
      await runWorkspaceAddCommand({
        cwd: process.cwd(),
        repoPath: pathArg,
        label: options.label,
        repoId: options.id,
      });
    },
  );

workspace
  .command("list")
  .description("List repositories registered in workspace.json")
  .action(() => {
    runWorkspaceListCommand(process.cwd());
  });

workspace
  .command("remove <repoId>")
  .description("Remove a repository from workspace.json")
  .action((repoId: string) => {
    runWorkspaceRemoveCommand({ cwd: process.cwd(), repoId });
  });

workspace
  .command("index")
  .description("Index all repositories in the workspace sequentially")
  .option("--full", "Run a full index rebuild for each repository")
  .option(
    "--rebuild-intelligence",
    "Rebuild intelligence artifacts during indexing",
  )
  .action(async (options: { full?: boolean; rebuildIntelligence?: boolean }) => {
    await runWorkspaceIndexCommand({
      cwd: process.cwd(),
      full: options.full,
      rebuildIntelligence: options.rebuildIntelligence,
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gitchange: ${message}`);
  process.exit(1);
});
