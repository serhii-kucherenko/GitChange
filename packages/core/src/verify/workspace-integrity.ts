import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Evidence } from "../schema/zod/evidence.js";
import { readManifest } from "../schema/manifest.js";
import { listCommitsUnified } from "../read/unified/commits.js";
import { mergeToursForWorkspace } from "../read/unified/tours.js";
import { resolveWorkspaceContext } from "../read/unified/workspace-context.js";
import { readWorkspace } from "../workspace/workspace-io.js";

export interface WorkspaceIntegrityReport {
  ok: boolean;
  errors: string[];
}

function collectTourEvidence(
  merged: NonNullable<ReturnType<typeof mergeToursForWorkspace>>,
): Evidence[] {
  return [...merged.toursById.values()].flatMap((tour) =>
    tour.chapters.flatMap((chapter) =>
      chapter.stops.flatMap((stop) => stop.evidence),
    ),
  );
}

export function checkWorkspaceIntegrity(
  gitchangeDir: string,
): WorkspaceIntegrityReport {
  const workspace = readWorkspace(gitchangeDir);
  if (!workspace) {
    return { ok: true, errors: [] };
  }

  const errors: string[] = [];
  const knownRepoIds = new Set(workspace.repos.map((repo) => repo.repoId));

  for (const link of workspace.links) {
    if (!knownRepoIds.has(link.sourceRepoId)) {
      errors.push(
        `workspace link '${link.id}' references unknown sourceRepoId '${link.sourceRepoId}'`,
      );
    }
    if (!knownRepoIds.has(link.targetRepoId)) {
      errors.push(
        `workspace link '${link.id}' references unknown targetRepoId '${link.targetRepoId}'`,
      );
    }
  }

  for (const repo of workspace.repos) {
    if (!existsSync(repo.repoPath)) {
      errors.push(`workspace repo path does not exist: ${repo.repoPath}`);
    }

    const manifestPath = join(repo.gitchangeDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      errors.push(
        `workspace repo '${repo.repoId}' is missing manifest.json at ${repo.gitchangeDir}`,
      );
      continue;
    }

    const manifest = readManifest(repo.gitchangeDir);
    if (!manifest) {
      errors.push(
        `workspace repo '${repo.repoId}' manifest could not be read at ${repo.gitchangeDir}`,
      );
      continue;
    }

    if (manifest.repoId !== repo.repoId) {
      errors.push(
        `workspace repo '${repo.repoId}' manifest.repoId '${manifest.repoId}' does not match`,
      );
    }

    if (!existsSync(join(repo.gitchangeDir, "index.sqlite"))) {
      errors.push(
        `workspace repo '${repo.repoId}' is missing index.sqlite at ${repo.gitchangeDir}`,
      );
    }
  }

  const ctx = resolveWorkspaceContext(gitchangeDir);

  if (ctx.isMultiRepo) {
    const page = listCommitsUnified(ctx, { limit: 500 });
    for (const commit of page.commits) {
      if (!commit.repoId) {
        errors.push(
          `unified commit ${commit.sha} is missing repoId in multi-repo workspace`,
        );
      }
    }

    const mergedTours = mergeToursForWorkspace(ctx);
    if (mergedTours) {
      for (const evidence of collectTourEvidence(mergedTours)) {
        if (!evidence.repoId) {
          errors.push(
            `tour evidence in multi-repo workspace is missing repoId (${evidence.type})`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
