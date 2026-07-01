import {
  DiffFlags,
  diffFlagsContains,
  type DeltaType,
  type DiffDelta,
  type Deltas,
  type Repository,
} from "es-git";
import type { ChangeType } from "../schema/zod/file-change.js";

export interface RawFileChange {
  commitSha: string;
  path: string;
  oldPath: string | null;
  changeType: ChangeType;
  isBinary: boolean;
}

function mapDeltaStatus(status: DeltaType): ChangeType | null {
  switch (status) {
    case "Added":
      return "added";
    case "Modified":
      return "modified";
    case "Deleted":
      return "deleted";
    case "Renamed":
      return "renamed";
    case "Copied":
      return "copied";
    case "Typechange":
      return "typechange";
    case "Unmodified":
    case "Ignored":
    case "Untracked":
    case "Unreadable":
    case "Conflicted":
      return null;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function pathsForDelta(
  changeType: ChangeType,
  oldPath: string | null,
  newPath: string | null,
): { path: string; oldPath: string | null } {
  switch (changeType) {
    case "deleted":
      return { path: oldPath ?? "", oldPath: null };
    case "renamed":
    case "copied":
      return { path: newPath ?? "", oldPath: oldPath };
    case "added":
    case "modified":
    case "typechange":
      return { path: newPath ?? oldPath ?? "", oldPath: null };
    default: {
      const _exhaustive: never = changeType;
      return _exhaustive;
    }
  }
}

function isZeroOid(oid: string): boolean {
  return /^0+$/.test(oid);
}

function isDeltaBinary(repo: Repository, delta: DiffDelta): boolean {
  if (diffFlagsContains(delta.flags(), DiffFlags.Binary)) {
    return true;
  }
  if (delta.oldFile().isBinary() || delta.newFile().isBinary()) {
    return true;
  }

  const candidateId = delta.newFile().exists()
    ? delta.newFile().id()
    : delta.oldFile().id();
  if (isZeroOid(candidateId)) {
    return false;
  }

  try {
    return repo.getObject(candidateId).peelToBlob().isBinary();
  } catch {
    return false;
  }
}

function getFirstParentSha(repo: Repository, sha: string): string | null {
  try {
    return repo.revparseSingle(`${sha}^1`);
  } catch {
    return null;
  }
}

function* iterateDeltas(deltas: Deltas): Generator<DiffDelta> {
  let result = deltas.next();
  while (!result.done) {
    yield result.value;
    result = deltas.next();
  }
}

export function diffCommit(repo: Repository, sha: string): RawFileChange[] {
  const commit = repo.getCommit(sha);
  const commitTree = commit.tree();
  const parentSha = getFirstParentSha(repo, sha);
  const parentTree = parentSha ? repo.getCommit(parentSha).tree() : null;

  const diff = repo.diffTreeToTree(parentTree, commitTree);
  diff.findSimilar({ renames: true });

  const changes: RawFileChange[] = [];
  for (const delta of iterateDeltas(diff.deltas())) {
    const changeType = mapDeltaStatus(delta.status());
    if (!changeType) {
      continue;
    }

    const oldPath = delta.oldFile().path();
    const newPath = delta.newFile().path();
    const paths = pathsForDelta(changeType, oldPath, newPath);

    changes.push({
      commitSha: sha,
      path: paths.path,
      oldPath: paths.oldPath,
      changeType,
      isBinary: isDeltaBinary(repo, delta),
    });
  }

  return changes;
}
