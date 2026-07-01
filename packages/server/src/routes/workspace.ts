import { resolveWorkspaceContext } from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const WorkspaceRepoSchema = z.object({
  repoId: z.string(),
  label: z.string(),
});

const WorkspaceLinkSchema = z.object({
  id: z.string(),
  sourceRepoId: z.string(),
  targetRepoId: z.string(),
  kind: z.enum(["shared_migration", "manual"]),
  label: z.string(),
  evidenceNote: z.string().optional(),
});

const WorkspaceResponseSchema = z.object({
  isMultiRepo: z.boolean(),
  primaryRepoId: z.string().nullable(),
  repos: z.array(WorkspaceRepoSchema),
  links: z.array(WorkspaceLinkSchema),
});

export interface WorkspaceRouteOptions {
  gitchangeDir: string;
}

export function createWorkspaceRoutes(options: WorkspaceRouteOptions): Hono {
  const app = new Hono();

  app.get("/workspace", (context) => {
    const ctx = resolveWorkspaceContext(options.gitchangeDir);
    const body = WorkspaceResponseSchema.parse({
      isMultiRepo: ctx.isMultiRepo,
      primaryRepoId: ctx.workspace?.primaryRepoId ?? ctx.repos[0]?.repoId ?? null,
      repos: ctx.repos.map((repo) => ({
        repoId: repo.repoId,
        label: repo.label,
      })),
      links: ctx.links,
    });
    return context.json(body);
  });

  return app;
}
