import type { Repository } from "es-git";
import type { IndexWriter } from "../artifacts/writer.js";
import { diffCommit } from "../ingestion/diff.js";
import { parseCommit } from "../ingestion/commit-parse.js";
import type { IgnoreMatcher } from "../privacy/gitchangeignore.js";
import { applyPrivacy } from "../privacy/redaction.js";
import { CommitRecord } from "../schema/zod/commit.js";
import type { FileChangeRecord } from "../schema/zod/file-change.js";

export interface ProcessCommitOptions {
  repo: Repository;
  sha: string;
  writer: IndexWriter;
  matcher: IgnoreMatcher;
}

export interface ProcessCommitResult {
  fileChanges: number;
}

export function processCommit(options: ProcessCommitOptions): ProcessCommitResult {
  const { repo, sha, writer, matcher } = options;
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

  let fileChanges = 0;
  for (const raw of diffCommit(repo, sha)) {
    const pathPrivacy = applyPrivacy({
      path: raw.path,
      content: null,
      matcher,
    });

    const record: FileChangeRecord = {
      commitSha: raw.commitSha,
      path: raw.path,
      oldPath: raw.oldPath,
      changeType: raw.changeType,
      isBinary: raw.isBinary,
      contentIgnored: pathPrivacy.contentIgnored,
      contentRedacted: pathPrivacy.contentRedacted,
      evidence: [{ type: "file", path: raw.path, commitSha: raw.commitSha }],
    };

    writer.addFileChange(record);
    fileChanges += 1;
  }

  return { fileChanges };
}
