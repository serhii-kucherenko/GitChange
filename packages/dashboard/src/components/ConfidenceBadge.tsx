import {
  attributionLabel,
  type AttributionConfidence,
  type EvidenceConfidenceLevel,
  evidenceLevelLabel,
} from "../utils/confidence.js";

const EVIDENCE_LEVEL_STYLES: Record<EvidenceConfidenceLevel, string> = {
  high: "border-emerald-700/60 bg-emerald-950/50 text-emerald-200",
  medium: "border-sky-700/60 bg-sky-950/50 text-sky-200",
  low: "border-amber-700/60 bg-amber-950/50 text-amber-200",
};

const ATTRIBUTION_STYLES: Record<AttributionConfidence, string> = {
  complete: "border-emerald-700/60 bg-emerald-950/50 text-emerald-200",
  degraded: "border-amber-700/60 bg-amber-950/50 text-amber-200",
};

interface ConfidenceBadgeProps {
  level: EvidenceConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const label = evidenceLevelLabel(level);

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${EVIDENCE_LEVEL_STYLES[level]}`}
      aria-label={label}
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
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${ATTRIBUTION_STYLES[confidence]}`}
      aria-label={label}
      title={label}
    >
      {confidence === "complete" ? "Complete" : "Degraded"}
    </span>
  );
}
