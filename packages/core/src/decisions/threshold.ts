import type { DecisionRecord } from "../schema/zod/decisions.js";

export const EVD03_GAP_MESSAGE = "No recorded decision found";

export function isBelowEvidenceThreshold(
  decision: Pick<DecisionRecord, "confidence" | "evidence">,
): boolean {
  return decision.confidence < 0.35 || decision.evidence.length < 1;
}
