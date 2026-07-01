import { openRepository, type Repository, type Revwalk } from "es-git";

export type { Repository };

export async function openRepo(repoPath: string): Promise<Repository> {
  return openRepository(repoPath);
}

function* iterateRevwalk(revwalk: Revwalk): Generator<string> {
  let sha: string | null = revwalk.next();
  while (sha !== null) {
    yield sha;
    sha = revwalk.next();
  }
}

export function walkFromHead(repo: Repository): Iterable<string> {
  return iterateRevwalk(repo.revwalk().pushHead());
}

export function walkRange(repo: Repository, cursorSha: string): Iterable<string> {
  return iterateRevwalk(repo.revwalk().pushRange(`${cursorSha}..HEAD`));
}
