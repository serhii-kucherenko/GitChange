import {
  getTourByIdUnified,
  listToursUnified,
  resolveWorkspaceContext,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const TourKindSchema = z.enum(["default", "role", "topic"]);

const TourSummarySchema = z.object({
  id: z.string(),
  kind: TourKindSchema,
  title: z.string(),
  description: z.string(),
  roleTag: z
    .enum(["backend", "frontend", "fullstack", "maintainer"])
    .optional(),
  topicKey: z.string().optional(),
  chapterCount: z.number().int().nonnegative(),
  stopCount: z.number().int().nonnegative(),
});

const TourListResponseSchema = z.object({
  tours: z.array(TourSummarySchema),
  defaultTourId: z.string(),
});

const EvidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("commit"),
    sha: z.string().length(40),
    repoId: z.string().optional(),
  }),
  z.object({
    type: z.literal("file"),
    path: z.string(),
    commitSha: z.string().length(40),
    repoId: z.string().optional(),
  }),
  z.object({
    type: z.literal("doc"),
    path: z.string(),
    commitSha: z.string().length(40),
    excerpt: z.string(),
    repoId: z.string().optional(),
  }),
  z.object({
    type: z.literal("hunk"),
    path: z.string(),
    commitSha: z.string().length(40),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    repoId: z.string().optional(),
  }),
  z.object({
    type: z.literal("interview"),
    path: z.string(),
    recordedAt: z.string(),
    excerpt: z.string(),
    repoId: z.string().optional(),
  }),
]);

const DrillTargetSchema = z
  .object({
    eraId: z.string().min(1).optional(),
    commitSha: z.string().length(40).optional(),
    filePath: z.string().min(1).optional(),
    decisionId: z.string().min(1).optional(),
  })
  .refine(
    (target) =>
      Boolean(
        target.eraId ??
          target.commitSha ??
          target.filePath ??
          target.decisionId,
      ),
    {
      message:
        "drillTarget requires at least one of eraId, commitSha, filePath, decisionId",
    },
  );

const TourStopSchema = z.object({
  id: z.string().min(1),
  narrative: z.string().max(400),
  evidence: z.array(EvidenceSchema).min(1),
  drillTarget: DrillTargetSchema,
  repoId: z.string().optional(),
});

const TourChapterSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().max(300),
  eraIds: z.array(z.string().min(1)).min(1),
  stops: z.array(TourStopSchema).min(1),
});

const TourDetailSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("default"),
    title: z.string(),
    description: z.string(),
    chapters: z.array(TourChapterSchema).min(4).max(6),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("role"),
    title: z.string(),
    description: z.string(),
    roleTag: z.enum(["backend", "frontend", "fullstack", "maintainer"]),
    chapters: z.array(TourChapterSchema).min(1),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("topic"),
    title: z.string(),
    description: z.string(),
    topicKey: z.string().min(1),
    chapters: z.array(TourChapterSchema).min(1),
  }),
]);

export interface ToursRouteOptions {
  gitchangeDir: string;
}

export function createToursRoutes(options: ToursRouteOptions): Hono {
  const app = new Hono();

  app.get("/tours", (context) => {
    const ctx = resolveWorkspaceContext(options.gitchangeDir);
    const result = listToursUnified(ctx);
    if (!result) {
      return context.json({ error: "tours not found" }, 404);
    }

    const body = TourListResponseSchema.parse(result);
    return context.json(body);
  });

  app.get("/tours/:tourId", (context) => {
    const tourId = context.req.param("tourId");
    if (!tourId || tourId.includes("..") || tourId.includes("/")) {
      return context.json({ error: "tour_not_found" }, 404);
    }

    const ctx = resolveWorkspaceContext(options.gitchangeDir);
    const tour = getTourByIdUnified(ctx, tourId);
    if (!tour) {
      return context.json({ error: "tour_not_found" }, 404);
    }

    const body = TourDetailSchema.parse(tour);
    return context.json(body);
  });

  return app;
}
