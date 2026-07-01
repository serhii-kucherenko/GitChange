import { CommitParser } from "conventional-commits-parser";
import type { Repository } from "es-git";
import type { CommitRecord } from "../schema/zod/commit.js";

const conventionalParser = new CommitParser();

function signatureToEpochMs(signature: { timestamp: number }): number {
  return signature.timestamp * 1000;
}

function getParentShas(repo: Repository, sha: string): string[] {
  const parents: string[] = [];
  for (let index = 1; ; index++) {
    try {
      parents.push(repo.revparseSingle(`${sha}^${index}`));
    } catch {
      break;
    }
  }
  return parents;
}

function parseConventional(message: string): CommitRecord["conventional"] | undefined {
  const parsed = conventionalParser.parse(message);
  if (!parsed.type) {
    return undefined;
  }

  const breaking = Boolean(
    parsed.notes?.some((note) => note.title.toUpperCase() === "BREAKING CHANGE") ||
      parsed.header?.includes("!"),
  );

  return {
    type: parsed.type,
    scope: parsed.scope ?? undefined,
    breaking: breaking ? true : undefined,
  };
}

export function parseCommit(repo: Repository, sha: string): CommitRecord {
  const commit = repo.getCommit(sha);
  const author = commit.author();
  const committer = commit.committer();
  const message = commit.message();
  const parents = getParentShas(repo, sha);
  const parentCount = parents.length;

  return {
    sha: commit.id(),
    authorName: author.name,
    authorEmail: author.email,
    committerName: committer.name,
    committerEmail: committer.email,
    authoredAt: signatureToEpochMs(author),
    committedAt: signatureToEpochMs(committer),
    summary: commit.summary() ?? message.split("\n")[0] ?? "",
    message,
    isMerge: parentCount > 1,
    parentCount,
    parents,
    conventional: parseConventional(message),
  };
}
