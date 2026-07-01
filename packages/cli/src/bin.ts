#!/usr/bin/env node
import { Command } from "commander";
import { join, resolve } from "node:path";
import { runIndexCommand } from "./commands/index.js";
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
  .action(async (options: { repo?: string }) => {
    const repoPath = options.repo
      ? resolveRepoPath(resolve(options.repo))
      : resolveRepoPath(process.cwd());
    const gitchangeDir = join(repoPath, ".gitchange");
    await runIndexCommand({ repoPath, gitchangeDir });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gitchange: ${message}`);
  process.exit(1);
});
