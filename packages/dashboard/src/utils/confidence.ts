export type EvidenceConfidenceLevel = "high" | "medium" | "low";

export type AttributionConfidence = "complete" | "degraded";

export type DecisionReviewStatus = "pending" | "confirmed" | "rejected";

export type DecisionConfidenceLevel =
  | "verified"
  | "inferred_high"
  | "medium"
  | "low";

export function evidenceCountToLevel(count: number): EvidenceConfidenceLevel {
  if (count >= 3) {
    return "high";
  }
  if (count === 2) {
    return "medium";
  }
  return "low";
}

export function classifyDecisionConfidence(
  confidence: number,
  reviewStatus: DecisionReviewStatus,
  evidenceCount: number,
): DecisionConfidenceLevel {
  if (evidenceCount < 1 || confidence < 0.35) {
    return "low";
  }
  if (reviewStatus === "confirmed" && confidence >= 0.7) {
    return "verified";
  }
  if (reviewStatus === "confirmed" || confidence >= 0.7) {
    return "inferred_high";
  }
  if (confidence >= 0.5) {
    return "medium";
  }
  return "low";
}

export function decisionConfidenceToLevel(
  confidence: number,
  reviewStatus: DecisionReviewStatus,
  evidenceCount: number,
): EvidenceConfidenceLevel {
  const level = classifyDecisionConfidence(
    confidence,
    reviewStatus,
    evidenceCount,
  );
  switch (level) {
    case "verified":
    case "inferred_high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default: {
      const exhaustive: never = level;
      return exhaustive;
    }
  }
}

export function resolveDisplayedAttribution(
  attribution: AttributionConfidence | undefined,
  hasManifestWarnings: boolean,
): AttributionConfidence {
  if (hasManifestWarnings) {
    return "degraded";
  }
  return attribution ?? "degraded";
}

export function evidenceLevelLabel(level: EvidenceConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
    default: {
      const exhaustive: never = level;
      return exhaustive;
    }
  }
}

export function attributionLabel(confidence: AttributionConfidence): string {
  switch (confidence) {
    case "complete":
      return "Attribution complete";
    case "degraded":
      return "Attribution degraded";
    default: {
      const exhaustive: never = confidence;
      return exhaustive;
    }
  }
}
