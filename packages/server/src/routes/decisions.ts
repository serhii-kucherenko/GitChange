import {
  DecisionNotFoundError,
  getDecisionById,
  InvalidDecisionCursorError,
  listDecisions,
} from "@gitchange/core";
import { Hono } from "hono";
import { z } from "zod";

const DecisionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum([
    "proposed",
    "accepted",
    "rejected",
    "superseded",
    "in_flight",
    "unknown",
  ]),
  reviewStatus: z.enum(["pending", "confirmed", "rejected"]),
  confidence: z.number(),
  evidenceCount: z.number().int().nonnegative(),
  supersededBy: z.string().optional(),
});

const DecisionListResponseSchema = z.object({
  decisions: z.array(DecisionSummarySchema),
  nextCursor: z.string().nullable(),
});

const EvidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("commit"),
    sha: z.string(),
  }),
  z.object({
    type: z.literal("file"),
    path: z.string(),
    commitSha: z.string(),
  }),
  z.object({
    type: z.literal("doc"),
    path: z.string(),
    commitSha: z.string(),
    excerpt: z.string(),
  }),
  z.object({
    type: z.literal("hunk"),
    path: z.string(),
    commitSha: z.string(),
    startLine: z.number().int(),
    endLine: z.number().int(),
    excerpt: z.string(),
  }),
  z.object({
    type: z.literal("interview"),
    path: z.string(),
    recordedAt: z.string(),
    excerpt: z.string(),
  }),
]);

const DecisionRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  status: z.enum([
    "proposed",
    "accepted",
    "rejected",
    "superseded",
    "in_flight",
    "unknown",
  ]),
  confidence: z.number(),
  evidence: z.array(EvidenceSchema).min(1),
  reviewStatus: z.enum(["pending", "confirmed", "rejected"]),
  miningSource: z.enum(["deterministic", "agent", "interview", "manual"]),
  relatedPaths: z.array(z.string()).optional(),
  supersededBy: z.string().optional(),
  supersedes: z.array(z.string()).optional(),
  attribution: z
    .object({
      authorId: z.number().int().positive(),
      name: z.string(),
      email: z.string(),
      rationale: z.string(),
      evidence: z.array(EvidenceSchema).min(1),
    })
    .optional(),
});

const DecisionGapResponseSchema = z.object({
  id: z.string(),
  gap: z.literal("No recorded decision found"),
  evidence: z.array(z.never()),
});

const DecisionDetailResponseSchema = z.union([
  DecisionRecordSchema,
  DecisionGapResponseSchema,
]);

export interface DecisionsRouteOptions {
  gitchangeDir: string;
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function toDetailJson(
  detail: ReturnType<typeof getDecisionById>,
): z.infer<typeof DecisionDetailResponseSchema> {
  if (detail.kind === "gap") {
    return {
      id: detail.id,
      gap: detail.gap,
      evidence: [],
    };
  }
  return detail.decision;
}

export function createDecisionsRoutes(
  options: DecisionsRouteOptions,
): Hono {
  const app = new Hono();

  app.get("/decisions", (context) => {
    try {
      const result = listDecisions(options.gitchangeDir, {
        limit: parseLimit(context.req.query("limit")),
        cursor: context.req.query("cursor"),
      });
      if (!result) {
        return context.json({ error: "decisions_not_available" }, 404);
      }

      const body = DecisionListResponseSchema.parse(result);
      return context.json(body);
    } catch (error) {
      if (error instanceof InvalidDecisionCursorError) {
        return context.json({ error: "invalid_cursor" }, 400);
      }
      throw error;
    }
  });

  app.get("/decisions/:id", (context) => {
    const id = context.req.param("id");
    try {
      const detail = getDecisionById(options.gitchangeDir, id);
      const body = DecisionDetailResponseSchema.parse(toDetailJson(detail));
      return context.json(body);
    } catch (error) {
      if (error instanceof DecisionNotFoundError) {
        return context.json({ error: "decision_not_found" }, 404);
      }
      throw error;
    }
  });

  return app;
}
