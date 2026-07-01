import { z } from "zod";
import { Evidence } from "./evidence.js";

export const SEMANTIC_SCHEMA_VERSION = "1";

export const InflectionType = z.enum([
  "tech_pivot",
  "scope_steering",
  "process_shift",
  "team_ownership_change",
]);

export type InflectionType = z.infer<typeof InflectionType>;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function assertInflectionType(value: InflectionType): void {
  switch (value) {
    case "tech_pivot":
    case "scope_steering":
    case "process_shift":
    case "team_ownership_change":
      return;
    default:
      assertNever(value);
  }
}

export const InflectionPoint = z.object({
  type: InflectionType,
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(Evidence).min(1),
});

export type InflectionPoint = z.infer<typeof InflectionPoint>;

export const EraClaim = z.object({
  text: z.string().min(1),
  evidence: z.array(Evidence).min(1),
});

export type EraClaim = z.infer<typeof EraClaim>;

export const NamedEra = z.object({
  id: z.string().min(1),
  name: z.string().min(3).max(80),
  summary: z.string().max(500),
  startCommitSha: z.string().length(40),
  endCommitSha: z.string().length(40),
  startAt: z.number().int(),
  endAt: z.number().int(),
  signalIds: z.array(z.number().int()).min(1),
  inflections: z.array(InflectionPoint),
  claims: z.array(EraClaim).min(1),
  evidence: z.array(Evidence).min(1),
});

export type NamedEra = z.infer<typeof NamedEra>;

export const ErasArtifact = z.object({
  schemaVersion: z.string(),
  computedAt: z.string(),
  headSha: z.string().length(40),
  sourceSignalCount: z.number().int().nonnegative(),
  eras: z.array(NamedEra),
});

export type ErasArtifact = z.infer<typeof ErasArtifact>;
