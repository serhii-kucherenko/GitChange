import {
  getRepoSnapshot,
  IntelligenceArtifact,
  ManifestSchema,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const SnapshotStatsSchema = z.object({
  commitCount: z.number().int().nonnegative(),
  fileChangeCount: z.number().int().nonnegative(),
  authorCount: z.number().int().nonnegative(),
});

const SnapshotHighlightsSchema = z.object({
  topChurnFiles: z.array(
    z.object({
      path: z.string(),
      changeCount: z.number().int().nonnegative(),
    }),
  ),
  topExpertiseTopics: z.array(
    z.object({
      topic: z.string(),
      label: z.string(),
    }),
  ),
});

const SnapshotErasSummarySchema = z.object({
  eraCount: z.number().int().nonnegative(),
  inflectionCount: z.number().int().nonnegative(),
  eras: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      inflectionTypes: z.array(
        z.enum([
          "tech_pivot",
          "scope_steering",
          "process_shift",
          "team_ownership_change",
        ]),
      ),
    }),
  ),
});

const SnapshotResponseSchema = z.object({
  manifest: ManifestSchema,
  stats: SnapshotStatsSchema,
  intelligence: IntelligenceArtifact.nullable(),
  highlights: SnapshotHighlightsSchema,
  erasSummary: SnapshotErasSummarySchema.nullable(),
});

export interface SnapshotRouteOptions {
  gitchangeDir: string;
}

export function createSnapshotRoutes(options: SnapshotRouteOptions): Hono {
  const app = new Hono();

  app.get("/snapshot", (context) => {
    const snapshot = getRepoSnapshot(options.gitchangeDir);
    if (!snapshot.manifest) {
      return context.json({ error: "not_indexed" }, 404);
    }

    const body = SnapshotResponseSchema.parse({
      manifest: snapshot.manifest,
      stats: snapshot.stats,
      intelligence: snapshot.intelligence,
      highlights: snapshot.highlights,
      erasSummary: snapshot.erasSummary,
    });

    return context.json(body);
  });

  return app;
}
