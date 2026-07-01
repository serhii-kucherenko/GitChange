import {
  type AttributionConfidence,
  attributionLabel,
  type EvidenceConfidenceLevel,
} from "../utils/confidence.js";

const EVIDENCE_LEVEL_STYLES: Record<EvidenceConfidenceLevel, string> = {
  high: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
  medium: "border-sky-700 bg-sky-950/40 text-sky-200",
  low: "border-amber-700 bg-amber-950/40 text-amber-200",
};

const ATTRIBUTION_STYLES: Record<AttributionConfidence, string> = {
  complete: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
  degraded: "border-amber-700 bg-amber-950/40 text-amber-200",
};

interface ConfidenceBadgeProps {
  level: EvidenceConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${EVIDENCE_LEVEL_STYLES[level]}`}
      title={`Heuristic from evidence count (${level})`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

interface AttributionBadgeProps {
  confidence: AttributionConfidence;
}

export function AttributionBadge({ confidence }: AttributionBadgeProps) {
  const label = attributionLabel(confidence);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ATTRIBUTION_STYLES[confidence]}`}
      title={label}
    >
      {confidence === "complete" ? "Complete" : "Degraded"}
    </span>
  );
}
