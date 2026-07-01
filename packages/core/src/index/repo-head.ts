import type { Repository } from "es-git";

export function resolveHeadSha(repo: Repository): string {
  const headSha = repo.head().target();
  if (!headSha) {
    throw new Error("Repository HEAD is not set");
  }
  return headSha;
}

export function resolveBranchName(repo: Repository): string | null {
  const ref = repo.head().name();
  if (!ref) {
    return null;
  }
  const prefix = "refs/heads/";
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
}
