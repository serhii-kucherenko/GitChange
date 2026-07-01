import { createHash } from "node:crypto";
import type { Repository } from "es-git";
import matter from "gray-matter";
import { minimatch } from "minimatch";
import type { IgnoreMatcher } from "../privacy/gitchangeignore.js";
import type { RawFileChange } from "./diff.js";

const MATCH_OPTIONS = {
  dot: true,
  matchBase: true,
} as const;

/** Default doc path globs (D-13). Root `*.md` is handled separately in `isDocPath`. */
export const DEFAULT_DOC_GLOBS: readonly string[] = [
  "README*",
  "CHANGELOG*",
  "docs/**",
  "**/adr/**",
];

export interface CapturedDoc {
  path: string;
  commitSha: string;
  contentHash: string;
  content: string | null;
  frontmatter?: Record<string, unknown>;
}

function isRootMarkdown(path: string): boolean {
  return !path.includes("/") && path.toLowerCase().endsWith(".md");
}

export function isDocPath(path: string): boolean {
  if (isRootMarkdown(path)) {
    return true;
  }

  return DEFAULT_DOC_GLOBS.some((pattern) => minimatch(path, pattern, MATCH_OPTIONS));
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readTextBlob(
  repo: Repository,
  sha: string,
  filePath: string,
  maxBlobBytes: number,
): string | null {
  try {
    const entry = repo.getCommit(sha).tree().getPath(filePath);
    if (!entry || entry.type() !== "Blob") {
      return null;
    }

    const blob = entry.toObject(repo).peelToBlob();
    if (blob.isBinary()) {
      return null;
    }

    const size = Number(blob.size());
    if (size > maxBlobBytes) {
      return null;
    }

    const bytes = blob.content();
    if (bytes.byteLength > maxBlobBytes) {
      return null;
    }

    return Buffer.from(bytes).toString("utf8");
  } catch {
    return null;
  }
}

export function captureDocSnapshots(
  repo: Repository,
  sha: string,
  changes: RawFileChange[],
  opts: { matcher: IgnoreMatcher; maxBlobBytes: number },
): CapturedDoc[] {
  const snapshots: CapturedDoc[] = [];

  for (const change of changes) {
    if (change.changeType === "deleted" || change.isBinary || !isDocPath(change.path)) {
      continue;
    }

    const raw = readTextBlob(repo, sha, change.path, opts.maxBlobBytes);
    if (raw === null) {
      continue;
    }

    const contentHash = sha256(raw);

    if (opts.matcher.isIgnored(change.path)) {
      snapshots.push({
        path: change.path,
        commitSha: sha,
        contentHash,
        content: null,
      });
      continue;
    }

    const parsed = matter(raw);
    const body = parsed.content.trim();
    const frontmatter =
      Object.keys(parsed.data).length > 0
        ? (parsed.data as Record<string, unknown>)
        : undefined;

    snapshots.push({
      path: change.path,
      commitSha: sha,
      contentHash: sha256(body),
      content: body,
      frontmatter,
    });
  }

  return snapshots;
}
