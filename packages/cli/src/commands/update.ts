import {
  getGitShortSha,
  runSelfUpdate,
} from "@gitchange/core/self-update";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface UpdateCommandOptions {
  root?: string;
  rebuild?: boolean;
}

function resolveInstallRoot(options: UpdateCommandOptions): string {
  if (options.root) {
    return resolve(options.root);
  }
  if (process.env.GITCHANGE_ROOT) {
    return resolve(process.env.GITCHANGE_ROOT);
  }
  return join(homedir(), ".gitchange-plugin");
}

export function runUpdateCommand(options: UpdateCommandOptions): void {
  const root = resolveInstallRoot(options);

  if (!existsSync(join(root, ".cursor-plugin", "plugin.json"))) {
    console.error(
      `gitchange: invalid GitChange install (missing .cursor-plugin/plugin.json): ${root}`,
    );
    process.exit(1);
  }

  const before = getGitShortSha(root);
  const result = runSelfUpdate(root, { forceRebuild: options.rebuild === true });

  if (result.reason && !result.updated && !result.alreadyLatest) {
    console.error(`gitchange update: ${result.reason}`);
    process.exit(1);
  }

  const after = getGitShortSha(root) ?? before;

  if (result.updated) {
    console.log(`GitChange updated: ${before ?? "?"} → ${after ?? "?"}`);
    if (result.rebuilt) {
      console.log("Dependencies installed and CLI rebuilt.");
    }
    return;
  }

  if (result.alreadyLatest) {
    console.log(`GitChange is already up to date (${after ?? "current"}).`);
    if (options.rebuild && result.rebuilt) {
      console.log("CLI rebuilt (--rebuild).");
    }
    return;
  }

  if (result.reason) {
    console.log(`GitChange update skipped: ${result.reason}`);
  }
}
