import type { Repository } from "es-git";
import simpleGit from "simple-git";
import { openRepo } from "../../ingestion/git-walk.js";

export interface BlameLineAttribution {
  lineNumber: number;
  email: string;
  name: string;
  origCommitId: string;
  finalCommitId: string;
}

const BLAME_TRACKING_OPTIONS = {
  trackLinesMovement: true,
  trackCopiesSameCommitMoves: true,
  trackCopiesAnyCommitCopies: true,
} as const;

const PORCELAIN_HEADER =
  /^([0-9a-f]{40})\s+\d+\s+(\d+)(?:\s+\d+)?(?:\s+(\d+))?/;

function normalizeAuthorEmail(mail: string): string {
  return mail.replace(/^<|>$/g, "");
}

function expandEsGitBlame(blame: Awaited<ReturnType<Repository["blameFile"]>>): BlameLineAttribution[] {
  const lines: BlameLineAttribution[] = [];
  let lineNumber = 1;
  const hunkCount = blame.getHunkCount();

  for (let index = 0; index < hunkCount; index += 1) {
    const hunk = blame.getHunkByIndex(index);
    const signature = hunk.origSignature;
    if (!signature) {
      continue;
    }
    for (let offset = 0; offset < hunk.linesInHunk; offset += 1) {
      lines.push({
        lineNumber: lineNumber + offset,
        email: signature.email,
        name: signature.name,
        origCommitId: hunk.origCommitId,
        finalCommitId: hunk.finalCommitId,
      });
    }
    lineNumber += hunk.linesInHunk;
  }

  return lines;
}

export function parsePorcelainBlame(output: string): BlameLineAttribution[] {
  const lines: BlameLineAttribution[] = [];
  const shaAuthors = new Map<string, { name: string; email: string }>();
  let currentSha = "";
  let pendingAuthorName = "";
  let pendingAuthorEmail = "";
  let pendingLineNumber = 0;

  const rememberAuthorForCurrentSha = (): void => {
    if (!currentSha || !pendingAuthorName || !pendingAuthorEmail) {
      return;
    }
    shaAuthors.set(currentSha, {
      name: pendingAuthorName,
      email: pendingAuthorEmail,
    });
  };

  for (const line of output.split("\n")) {
    if (!line) {
      continue;
    }

    const headerMatch = PORCELAIN_HEADER.exec(line);
    if (headerMatch) {
      rememberAuthorForCurrentSha();
      currentSha = headerMatch[1] ?? "";
      pendingLineNumber = Number(headerMatch[2]);
      pendingAuthorName = "";
      pendingAuthorEmail = "";
      continue;
    }

    if (line.startsWith("author ")) {
      pendingAuthorName = line.slice("author ".length);
      continue;
    }

    if (line.startsWith("author-mail ")) {
      pendingAuthorEmail = normalizeAuthorEmail(line.slice("author-mail ".length));
      rememberAuthorForCurrentSha();
      continue;
    }

    if (line.startsWith("\t")) {
      const author = shaAuthors.get(currentSha);
      const name = pendingAuthorName || author?.name || "";
      const email = pendingAuthorEmail || author?.email || "";
      lines.push({
        lineNumber: pendingLineNumber,
        email,
        name,
        origCommitId: currentSha,
        finalCommitId: currentSha,
      });
      pendingLineNumber += 1;
    }
  }

  return lines;
}

async function blameWithSimpleGit(
  repoPath: string,
  path: string,
): Promise<BlameLineAttribution[]> {
  const git = simpleGit(repoPath);
  const output = await git.raw([
    "blame",
    "--porcelain",
    "--ignore-revs-file",
    ".git-blame-ignore-revs",
    "HEAD",
    "--",
    path,
  ]);
  return parsePorcelainBlame(output);
}

async function blameWithEsGit(
  gitRepo: Repository,
  path: string,
): Promise<BlameLineAttribution[]> {
  const blame = await gitRepo.blameFile(path, BLAME_TRACKING_OPTIONS);
  return expandEsGitBlame(blame);
}

export async function blameFileAtHead(
  repoPath: string,
  gitRepo: Repository,
  path: string,
  ignoreRevs: Set<string>,
): Promise<BlameLineAttribution[]> {
  if (ignoreRevs.size > 0) {
    return blameWithSimpleGit(repoPath, path);
  }
  return blameWithEsGit(gitRepo, path);
}

export async function openBlameRepo(repoPath: string): Promise<Repository> {
  return openRepo(repoPath);
}
