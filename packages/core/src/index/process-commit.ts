import { statSync } from "node:fs";
import { join } from "node:path";
import type { Repository } from "es-git";
import { openRepository } from "es-git";
import type { IndexWriter, SecretFindingInput } from "../artifacts/writer.js";
import { captureDocSnapshots } from "../ingestion/doc-snapshot.js";
import { diffCommit } from "../ingestion/diff.js";
import { captureDiffHunks } from "../ingestion/hunks.js";
import { parseCommit } from "../ingestion/commit-parse.js";
import {
  createIgnoreMatcher,
  type IgnoreMatcher,
} from "../privacy/gitchangeignore.js";
import { applyPrivacy } from "../privacy/redaction.js";
import { CommitRecord } from "../schema/zod/commit.js";
import type { DocSnapshot } from "../schema/zod/doc-snapshot.js";
import type { FileChangeRecord } from "../schema/zod/file-change.js";

export interface ProcessCommitOptions {
  repo: Repository;
  sha: string;
  writer: IndexWriter;
  matcher: IgnoreMatcher;
  maxBlobBytes: number;
}

export interface ProcessCommitResult {
  fileChanges: number;
}

export interface CommitBuildResult {
  sha: string;
  commit: ReturnType<typeof CommitRecord.parse>;
  secretFindings: SecretFindingInput[];
  fileChanges: FileChangeRecord[];
  docSnapshots: DocSnapshot[];
  committerTimestampMs: number;
}

function signatureToEpochMs(signature: { timestamp: number }): number {
  return signature.timestamp * 1000;
}

export function validateRepoPath(repoPath: string): void {
  try {
    const repoStat = statSync(repoPath);
    if (!repoStat.isDirectory()) {
      throw new Error(`Not a directory: ${repoPath}`);
    }
    const gitStat = statSync(join(repoPath, ".git"));
    if (!gitStat.isDirectory() && !gitStat.isFile()) {
      throw new Error(`Missing .git at: ${repoPath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid repository path (${repoPath}): ${message}`);
  }
}

export function buildCommitRecordsFromRepo(
  repo: Repository,
  sha: string,
  matcher: IgnoreMatcher,
  maxBlobBytes: number,
): CommitBuildResult {
  const parsed = parseCommit(repo, sha);
  const committerTimestampMs = signatureToEpochMs(repo.getCommit(sha).committer());

  const messagePrivacy = applyPrivacy({
    path: "",
    content: parsed.message,
    matcher,
  });

  const redactedMessage = messagePrivacy.content ?? parsed.message;
  const sanitizedCommit = CommitRecord.parse({
    ...parsed,
    message: redactedMessage,
    summary: redactedMessage.split("\n")[0] ?? "",
  });

  const secretFindings: SecretFindingInput[] = [];
  for (const finding of messagePrivacy.findings) {
    secretFindings.push({
      commitSha: sha,
      filePath: null,
      ruleId: finding.ruleId,
      location: "message",
    });
  }

  const rawChanges = diffCommit(repo, sha);
  const fileChanges: FileChangeRecord[] = [];

  for (const raw of rawChanges) {
    const pathPrivacy = applyPrivacy({
      path: raw.path,
      content: null,
      matcher,
    });

    const hunkCapture = captureDiffHunks({
      repo,
      sha,
      path: raw.path,
      changeType: raw.changeType,
      isBinary: raw.isBinary,
      contentIgnored: pathPrivacy.contentIgnored,
      matcher,
    });

    for (const finding of hunkCapture.secretFindings) {
      secretFindings.push({
        commitSha: sha,
        filePath: raw.path,
        ruleId: finding.ruleId,
        location: "hunk",
      });
    }

    const evidence = [
      { type: "file" as const, path: raw.path, commitSha: raw.commitSha },
      ...hunkCapture.hunks.map((hunk) => ({
        type: "hunk" as const,
        path: raw.path,
        commitSha: raw.commitSha,
        startLine: hunk.startLine,
        endLine: hunk.endLine,
      })),
    ];

    fileChanges.push({
      commitSha: raw.commitSha,
      path: raw.path,
      oldPath: raw.oldPath,
      changeType: raw.changeType,
      isBinary: raw.isBinary,
      contentIgnored: pathPrivacy.contentIgnored,
      contentRedacted:
        pathPrivacy.contentRedacted || hunkCapture.contentRedacted,
      evidence,
      hunks: hunkCapture.hunks.length > 0 ? hunkCapture.hunks : undefined,
    });
  }

  const capturedDocs = captureDocSnapshots(repo, sha, rawChanges, {
    matcher,
    maxBlobBytes,
  });

  const docSnapshots: DocSnapshot[] = [];
  for (const captured of capturedDocs) {
    const docPrivacy = applyPrivacy({
      path: captured.path,
      content: captured.content,
      matcher,
    });

    for (const finding of docPrivacy.findings) {
      secretFindings.push({
        commitSha: sha,
        filePath: captured.path,
        ruleId: finding.ruleId,
        location: "doc",
      });
    }

    docSnapshots.push({
      path: captured.path,
      commitSha: sha,
      contentHash: captured.contentHash,
      content: docPrivacy.content,
      frontmatter: captured.frontmatter,
      evidence: [{ type: "file", path: captured.path, commitSha: sha }],
    });
  }

  return {
    sha,
    commit: sanitizedCommit,
    secretFindings,
    fileChanges,
    docSnapshots,
    committerTimestampMs,
  };
}

export function buildCommitRecords(
  repoPath: string,
  sha: string,
  ignorePatterns: readonly string[],
  maxBlobBytes: number,
): Promise<CommitBuildResult> {
  validateRepoPath(repoPath);
  const matcher = createIgnoreMatcher(ignorePatterns);
  return openRepository(repoPath).then((repo) =>
    buildCommitRecordsFromRepo(repo, sha, matcher, maxBlobBytes),
  );
}

export function applyCommitRecords(
  writer: IndexWriter,
  result: CommitBuildResult,
): ProcessCommitResult {
  for (const finding of result.secretFindings) {
    writer.addSecretFinding(finding);
  }

  writer.addCommit(result.commit);

  for (const record of result.fileChanges) {
    writer.addFileChange(record);
  }

  for (const docRecord of result.docSnapshots) {
    writer.addDocSnapshot(docRecord);
  }

  return { fileChanges: result.fileChanges.length };
}

export function processCommit(options: ProcessCommitOptions): ProcessCommitResult {
  const { repo, sha, writer, matcher, maxBlobBytes } = options;
  const result = buildCommitRecordsFromRepo(repo, sha, matcher, maxBlobBytes);
  return applyCommitRecords(writer, result);
}
