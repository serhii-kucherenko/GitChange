import { z } from "zod";
import { Evidence } from "./evidence.js";

export const OPEN_WORK_SCHEMA_VERSION = "1";

export const OpenWorkKind = z.enum(["migration", "refactor", "wip", "stale"]);

export type OpenWorkKind = z.infer<typeof OpenWorkKind>;

export const OpenWorkStatus = z.enum([
  "open",
  "in_progress",
  "completed",
  "stale",
  "unknown",
]);

export type OpenWorkStatus = z.infer<typeof OpenWorkStatus>;

export const OpenWorkThreadEvent = z.object({
  commitSha: z.string().length(40),
  committedAt: z.number().int(),
  summary: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

export type OpenWorkThreadEvent = z.infer<typeof OpenWorkThreadEvent>;

export const OpenWorkThread = z.object({
  id: z.string().startsWith("thread:"),
  kind: OpenWorkKind,
  status: OpenWorkStatus,
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  relatedPaths: z.array(z.string().min(1)).min(1),
  events: z.array(OpenWorkThreadEvent),
  evidence: z.array(Evidence).min(1),
  linkedDecisionId: z.string().startsWith("decision:").optional(),
});

export type OpenWorkThread = z.infer<typeof OpenWorkThread>;

export const OpenWorkArtifact = z.object({
  schemaVersion: z.string(),
  computedAt: z.string(),
  headSha: z.string().length(40),
  threads: z.array(OpenWorkThread).max(20),
});

export type OpenWorkArtifact = z.infer<typeof OpenWorkArtifact>;
