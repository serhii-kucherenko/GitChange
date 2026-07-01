import { z } from "zod";
import { Evidence } from "./evidence.js";

export const INTELLIGENCE_SCHEMA_VERSION = "1";

export const AttributionConfidence = z.enum(["complete", "degraded"]);

export type AttributionConfidence = z.infer<typeof AttributionConfidence>;

export const ChurnFileEntry = z.object({
  path: z.string(),
  changeCount: z.number().int().nonnegative(),
  insertions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  lastTouchedAt: z.number().int(),
  evidence: z.array(Evidence).min(1),
});

export type ChurnFileEntry = z.infer<typeof ChurnFileEntry>;

export const CoChangeEdge = z.object({
  pathA: z.string(),
  pathB: z.string(),
  coOccurrence: z.number().int().nonnegative(),
  lastCoChangeAt: z.number().int(),
  weight: z.number().nonnegative(),
  relationship: z.literal("co_change"),
  disclaimer: z.literal("historical correlation, not import dependency"),
});

export type CoChangeEdge = z.infer<typeof CoChangeEdge>;

export const OwnershipAuthor = z.object({
  authorId: z.number().int(),
  name: z.string(),
  email: z.string(),
  lineCount: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
});

export const OwnershipFileEntry = z.object({
  path: z.string(),
  authors: z.array(OwnershipAuthor),
  evidence: z.array(Evidence).min(1),
});

export const EraBoundarySignal = z.object({
  id: z.number().int(),
  signalType: z.string(),
  score: z.number(),
  startCommitSha: z.string(),
  endCommitSha: z.string(),
  startAt: z.number().int(),
  endAt: z.number().int(),
  evidence: z.array(Evidence).min(1),
});

export type EraBoundarySignal = z.infer<typeof EraBoundarySignal>;

export const ExpertiseProfile = z.object({
  authorId: z.number().int(),
  name: z.string(),
  email: z.string(),
  topic: z.string(),
  score: z.number(),
  evidence: z.array(Evidence).min(1),
});

export const IntelligenceArtifact = z.object({
  schemaVersion: z.string(),
  computedAt: z.string(),
  headSha: z.string().length(40),
  attributionConfidence: AttributionConfidence,
  churn: z.object({
    files: z.array(ChurnFileEntry),
  }),
  coChange: z.object({
    edges: z.array(CoChangeEdge),
  }),
  ownership: z.object({
    files: z.array(OwnershipFileEntry),
  }),
  eraSignals: z.object({
    boundaries: z.array(EraBoundarySignal),
  }),
  expertise: z.object({
    profiles: z.array(ExpertiseProfile),
  }),
});

export type IntelligenceArtifact = z.infer<typeof IntelligenceArtifact>;
