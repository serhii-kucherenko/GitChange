import type { Repository } from "es-git";
import type { IndexWriter } from "../artifacts/writer.js";
import { captureDocSnapshots } from "../ingestion/doc-snapshot.js";
import { diffCommit } from "../ingestion/diff.js";
import { captureDiffHunks } from "../ingestion/hunks.js";
import { parseCommit } from "../ingestion/commit-parse.js";
import type { IgnoreMatcher } from "../privacy/gitchangeignore.js";
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

export function processCommit(options: ProcessCommitOptions): ProcessCommitResult {
  const { repo, sha, writer, matcher, maxBlobBytes } = options;
  const parsed = parseCommit(repo, sha);

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

  for (const finding of messagePrivacy.findings) {
    writer.addSecretFinding({
      commitSha: sha,
      filePath: null,
      ruleId: finding.ruleId,
      location: "message",
    });
  }

  writer.addCommit(sanitizedCommit);

  const rawChanges = diffCommit(repo, sha);
  let fileChanges = 0;

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
      writer.addSecretFinding({
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

    const record: FileChangeRecord = {
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
    };

    writer.addFileChange(record);
    fileChanges += 1;
  }

  const capturedDocs = captureDocSnapshots(repo, sha, rawChanges, {
    matcher,
    maxBlobBytes,
  });

  for (const captured of capturedDocs) {
    const docPrivacy = applyPrivacy({
      path: captured.path,
      content: captured.content,
      matcher,
    });

    for (const finding of docPrivacy.findings) {
      writer.addSecretFinding({
        commitSha: sha,
        filePath: captured.path,
        ruleId: finding.ruleId,
        location: "doc",
      });
    }

    const docRecord: DocSnapshot = {
      path: captured.path,
      commitSha: sha,
      contentHash: captured.contentHash,
      content: docPrivacy.content,
      frontmatter: captured.frontmatter,
      evidence: [{ type: "file", path: captured.path, commitSha: sha }],
    };

    writer.addDocSnapshot(docRecord);
  }

  return { fileChanges };
}
