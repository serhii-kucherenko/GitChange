export type EvidenceConfidenceLevel = "high" | "medium" | "low";

export type AttributionConfidence = "complete" | "degraded";

export function evidenceCountToLevel(count: number): EvidenceConfidenceLevel {
  if (count >= 3) {
    return "high";
  }
  if (count === 2) {
    return "medium";
  }
  return "low";
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
