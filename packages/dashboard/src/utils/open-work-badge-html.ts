import type { OpenWorkStatus } from "../types.js";

const STATUS_LABELS: Record<OpenWorkStatus, string> = {
  in_progress: "In progress",
  open: "Open",
  stale: "Stale",
  completed: "Completed",
  unknown: "Unknown",
};

const STATUS_CLASS: Record<OpenWorkStatus, string> = {
  in_progress: "open-work-badge--in-progress",
  open: "open-work-badge--open",
  stale: "open-work-badge--stale",
  completed: "open-work-badge--completed",
  unknown: "open-work-badge--unknown",
};

export function openWorkBadgeHtml(status: OpenWorkStatus): string {
  const label = STATUS_LABELS[status];
  const className = STATUS_CLASS[status];
  return `<span class="open-work-badge ${className}" title="${label}" aria-label="${label}">${label}</span>`;
}
