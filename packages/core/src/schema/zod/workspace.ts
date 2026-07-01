import { z } from "zod";

export const WORKSPACE_SCHEMA_VERSION = "1";

export const CrossRepoLinkKind = z.enum(["shared_migration", "manual"]);

export type CrossRepoLinkKind = z.infer<typeof CrossRepoLinkKind>;

export function assertCrossRepoLinkKind(value: CrossRepoLinkKind): void {
  switch (value) {
    case "shared_migration":
    case "manual":
      return;
    default: {
      const _exhaustive: never = value;
      throw new Error(`Unexpected cross-repo link kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export const CrossRepoLink = z.object({
  id: z.string().min(1),
  sourceRepoId: z.string().min(1),
  targetRepoId: z.string().min(1),
  kind: CrossRepoLinkKind,
  label: z.string().min(1),
  evidenceNote: z.string().optional(),
});

export type CrossRepoLink = z.infer<typeof CrossRepoLink>;

export const RepoEntry = z.object({
  repoId: z.string().min(1),
  label: z.string().min(1),
  repoPath: z.string().min(1),
  gitchangeDir: z.string().min(1),
});

export type RepoEntry = z.infer<typeof RepoEntry>;

export const WorkspaceArtifact = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  primaryRepoId: z.string().min(1),
  repos: z.array(RepoEntry).min(1),
  links: z.array(CrossRepoLink),
});

export type WorkspaceArtifact = z.infer<typeof WorkspaceArtifact>;
