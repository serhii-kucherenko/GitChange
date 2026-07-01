import type { OpenWorkStatus } from "../types.js";

const STATUS_STYLES: Record<OpenWorkStatus, string> = {
  in_progress: "border-amber-700 bg-amber-950/40 text-amber-200",
  open: "border-sky-700 bg-sky-950/40 text-sky-200",
  stale: "border-slate-600 bg-slate-800/60 text-slate-300",
  completed: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
  unknown: "border-slate-600 bg-slate-800/60 text-slate-300",
};

const STATUS_LABELS: Record<OpenWorkStatus, string> = {
  in_progress: "In progress",
  open: "Open",
  stale: "Stale",
  completed: "Completed",
  unknown: "Unknown",
};

interface OpenWorkBadgeProps {
  status: OpenWorkStatus;
  compact?: boolean;
}

export function OpenWorkBadge({ status, compact = false }: OpenWorkBadgeProps) {
  const label = STATUS_LABELS[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${STATUS_STYLES[status]} ${
        compact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
      title={label}
    >
      {compact ? status.replace("_", " ") : label}
    </span>
  );
}
