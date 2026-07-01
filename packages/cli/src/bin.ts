#!/usr/bin/env node
import { join, resolve } from "node:path";
import { runIndexCommand } from "./commands/index.js";
import { resolveRepoPath } from "./repo-path.js";

function parseIndexArgs(argv: string[]): { repoPath?: string } {
  let repoPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--repo requires a path argument");
      }
      repoPath = value;
      i++;
    }
  }
  return { repoPath };
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "index") {
    console.error("Usage: gitchange index [--repo <path>]");
    process.exit(1);
  }

  const { repoPath } = parseIndexArgs(rest);
  const resolved = repoPath
    ? resolveRepoPath(resolve(repoPath))
    : resolveRepoPath(process.cwd());
  const gitchangeDir = join(resolved, ".gitchange");
  await runIndexCommand({ repoPath: resolved, gitchangeDir });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gitchange: ${message}`);
  process.exit(1);
});
