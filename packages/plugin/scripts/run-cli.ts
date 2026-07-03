#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { runGitChangeUpdate } from "./ensure-up-to-date.js";
import { ensureGitChangeReady } from "./ensure-ready.js";
import { resolveCliBin, resolveGitChangeRoot } from "./resolve-root.js";

const root = resolveGitChangeRoot();
const args = process.argv.slice(2);
const subcommand = args[0];

if (subcommand === "update") {
  const forceRebuild = args.includes("--rebuild");
  const result = runGitChangeUpdate(root, { explicit: true, forceRebuild });
  if (result.updated) {
    console.error("GitChange: updated to latest version from origin.");
  } else if (result.alreadyLatest) {
    console.error("GitChange: already up to date.");
  } else if (result.reason) {
    console.error(`GitChange update: ${result.reason}`);
    process.exit(1);
  }
  ensureGitChangeReady(root, { forceRebuild: result.updated || forceRebuild });
  process.exit(0);
}

const update = runGitChangeUpdate(root, {});
if (update.updated) {
  console.error("GitChange: updated to latest version from origin.");
}
ensureGitChangeReady(root, { forceRebuild: update.updated });

const cliBin = resolveCliBin(root);

const result = spawnSync(cliBin, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
