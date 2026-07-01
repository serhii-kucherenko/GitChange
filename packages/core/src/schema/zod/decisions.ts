import { z } from "zod";
import { Evidence } from "./evidence.js";

export const DECISIONS_SCHEMA_VERSION = "1";

export const DecisionStatus = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "superseded",
  "in_flight",
  "unknown",
]);

export type DecisionStatus = z.infer<typeof DecisionStatus>;

export const DecisionReviewStatus = z.enum(["pending", "confirmed", "rejected"]);

export type DecisionReviewStatus = z.infer<typeof DecisionReviewStatus>;

export const DecisionMiningSource = z.enum([
  "deterministic",
  "agent",
  "interview",
  "manual",
]);

export type DecisionMiningSource = z.infer<typeof DecisionMiningSource>;

export const DecisionAttribution = z.object({
  authorId: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(Evidence).min(1),
});

export type DecisionAttribution = z.infer<typeof DecisionAttribution>;

export const DecisionRecord = z.object({
  id: z.string().startsWith("decision:"),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: DecisionStatus,
  confidence: z.number().min(0).max(1),
  evidence: z.array(Evidence).min(1),
  reviewStatus: DecisionReviewStatus,
  miningSource: DecisionMiningSource,
  relatedPaths: z.array(z.string()).optional(),
  supersededBy: z.string().startsWith("decision:").optional(),
  supersedes: z.array(z.string().startsWith("decision:")).optional(),
  attribution: DecisionAttribution.optional(),
});

export type DecisionRecord = z.infer<typeof DecisionRecord>;

export const DecisionsArtifact = z.object({
  schemaVersion: z.string(),
  computedAt: z.string(),
  headSha: z.string().length(40),
  decisions: z.array(DecisionRecord).max(40),
});

export type DecisionsArtifact = z.infer<typeof DecisionsArtifact>;
