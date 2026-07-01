import { repoColorClass, useWorkspaceStore } from "../store/workspace.js";

interface RepoBadgeProps {
  repoId: string;
  compact?: boolean;
}

export function RepoBadge({ repoId, compact = false }: RepoBadgeProps) {
  const label = useWorkspaceStore((state) => state.repoLabel(repoId));
  const colorClass = repoColorClass(repoId);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium ${colorClass} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"
      }`}
      title={`Repository: ${label}`}
    >
      {label}
    </span>
  );
}
