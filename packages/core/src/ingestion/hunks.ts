import type { Repository } from "es-git";
import type { IgnoreMatcher } from "../privacy/gitchangeignore.js";
import { applyPrivacy } from "../privacy/redaction.js";
import type { ChangeType } from "../schema/zod/file-change.js";
import { HunkRecord, type HunkRecord as HunkRecordType } from "../schema/zod/hunk.js";

export const MAX_HUNKS_PER_FILE = 20;
export const MAX_PATCH_BYTES_PER_FILE = 32 * 1024;

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export interface CaptureDiffHunksInput {
  repo: Repository;
  sha: string;
  path: string;
  changeType: ChangeType;
  isBinary: boolean;
  contentIgnored: boolean;
  matcher: IgnoreMatcher;
}

export interface CaptureDiffHunksResult {
  hunks: HunkRecordType[];
  contentRedacted: boolean;
  secretFindings: Array<{ ruleId: string }>;
}

function getFirstParentSha(repo: Repository, sha: string): string | null {
  try {
    return repo.revparseSingle(`${sha}^1`);
  } catch {
    return null;
  }
}

function parseUnifiedPatch(patchText: string): HunkRecordType[] {
  const hunks: HunkRecordType[] = [];
  const lines = patchText.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const headerMatch = HUNK_HEADER_PATTERN.exec(line);
    if (!headerMatch) {
      index += 1;
      continue;
    }

    const newStart = Number.parseInt(headerMatch[3] ?? "0", 10);
    const newLines = Number.parseInt(headerMatch[4] ?? "1", 10);
    const hunkLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (HUNK_HEADER_PATTERN.test(nextLine)) {
        break;
      }
      if (nextLine.startsWith("diff --git ")) {
        break;
      }
      hunkLines.push(nextLine);
      index += 1;
    }

    const endLine = newLines > 0 ? newStart + newLines - 1 : newStart;
    hunks.push({
      startLine: Math.max(1, newStart),
      endLine: Math.max(1, endLine),
      patch: hunkLines.join("\n"),
    });
  }

  return hunks;
}

function applyHunkCaps(hunks: HunkRecordType[]): HunkRecordType[] {
  const capped: HunkRecordType[] = [];
  let totalBytes = 0;

  for (const hunk of hunks) {
    if (capped.length >= MAX_HUNKS_PER_FILE) {
      break;
    }

    const patchBytes = Buffer.byteLength(hunk.patch, "utf8");
    if (totalBytes + patchBytes > MAX_PATCH_BYTES_PER_FILE) {
      break;
    }

    capped.push(hunk);
    totalBytes += patchBytes;
  }

  return capped;
}

function redactHunks(
  path: string,
  hunks: HunkRecordType[],
  matcher: IgnoreMatcher,
): CaptureDiffHunksResult {
  const secretFindings: Array<{ ruleId: string }> = [];
  let contentRedacted = false;
  const redactedHunks: HunkRecordType[] = [];

  for (const hunk of hunks) {
    const privacy = applyPrivacy({
      path,
      content: hunk.patch,
      matcher,
    });

    for (const finding of privacy.findings) {
      secretFindings.push({ ruleId: finding.ruleId });
    }

    if (privacy.contentRedacted) {
      contentRedacted = true;
    }

    redactedHunks.push({
      ...hunk,
      patch: privacy.content ?? hunk.patch,
    });
  }

  return {
    hunks: redactedHunks,
    contentRedacted,
    secretFindings,
  };
}

export function captureDiffHunks(input: CaptureDiffHunksInput): CaptureDiffHunksResult {
  if (input.contentIgnored || input.isBinary) {
    return { hunks: [], contentRedacted: false, secretFindings: [] };
  }

  const commit = input.repo.getCommit(input.sha);
  const parentSha = getFirstParentSha(input.repo, input.sha);
  const parentTree = parentSha
    ? input.repo.getCommit(parentSha).tree()
    : null;
  const commitTree = commit.tree();

  const diff = input.repo.diffTreeToTree(parentTree, commitTree, {
    pathspecs: [input.path],
  });
  diff.findSimilar({ renames: true });

  const patchText = diff.print({ format: "Patch" });
  if (!patchText.trim()) {
    return { hunks: [], contentRedacted: false, secretFindings: [] };
  }

  const parsed = applyHunkCaps(parseUnifiedPatch(patchText));
  const validated = parsed.map((hunk) => HunkRecord.parse(hunk));
  return redactHunks(input.path, validated, input.matcher);
}
