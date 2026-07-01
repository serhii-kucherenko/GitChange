import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Repository } from "es-git";
import type { ManifestWarningCode } from "../schema/manifest.js";
import { assertNever } from "../schema/manifest.js";
import { walkFromHead } from "../ingestion/git-walk.js";

export interface ForcePushResult {
  rewritten: boolean;
  reason?: string;
}

export class ForcePushHaltError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForcePushHaltError";
  }
}

export function isShallow(repoPath: string, repo: Repository): boolean {
  if (existsSync(join(repoPath, ".git", "shallow"))) {
    return true;
  }

  return repo.isShallow();
}

export function checkCursorReachable(repo: Repository, cursorSha: string): ForcePushResult {
  try {
    repo.revparseSingle(cursorSha);
  } catch {
    return { rewritten: true, reason: "cursor commit no longer exists" };
  }

  const headSha = repo.revparseSingle("HEAD");
  if (cursorSha === headSha) {
    return { rewritten: false };
  }

  for (const sha of walkFromHead(repo)) {
    if (sha === cursorSha) {
      return { rewritten: false };
    }
  }

  return { rewritten: true, reason: "cursor not ancestor of HEAD" };
}

/** Counts committer-date inversions along revwalk order (newest-first from HEAD). */
export function countOutOfOrder(commitTimestamps: number[]): number {
  let inversions = 0;

  for (let index = 1; index < commitTimestamps.length; index += 1) {
    if (commitTimestamps[index] > commitTimestamps[index - 1]) {
      inversions += 1;
    }
  }

  return inversions;
}

export function formatWarningMessage(code: ManifestWarningCode, detail?: string): string {
  switch (code) {
    case "shallow_clone":
      return detail ?? "Repository is a shallow clone; index history may be incomplete";
    case "force_push_detected":
      return detail ?? "History was rewritten; run a full index rebuild";
    case "out_of_order_commits":
      return detail ?? "Some commits have out-of-order committer timestamps";
    default:
      assertNever(code);
  }
}

export function echoWarnings(warnings: Array<{ code: ManifestWarningCode; message: string }>): void {
  for (const warning of warnings) {
    narrowWarningCodeForEcho(warning.code);
    console.log(`GitChange warning [${warning.code}]: ${warning.message}`);
  }
}

function narrowWarningCodeForEcho(code: ManifestWarningCode): void {
  switch (code) {
    case "shallow_clone":
    case "force_push_detected":
    case "out_of_order_commits":
      return;
    default:
      assertNever(code);
  }
}
