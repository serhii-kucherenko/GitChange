import { useDrillStore } from "../store/drill.js";

interface DrillBreadcrumbProps {
  eraLabel?: string | null;
}

export function DrillBreadcrumb({ eraLabel }: DrillBreadcrumbProps) {
  const selectedCommitSha = useDrillStore((state) => state.selectedCommitSha);
  const selectedFilePath = useDrillStore((state) => state.selectedFilePath);
  const selectedEra = useDrillStore((state) => state.selectedEra);
  const clearDownstreamFromEra = useDrillStore(
    (state) => state.clearDownstreamFromEra,
  );
  const clearDownstreamFromCommit = useDrillStore(
    (state) => state.clearDownstreamFromCommit,
  );

  if (!selectedEra && !selectedCommitSha && !selectedFilePath) {
    return null;
  }

  const eraName =
    eraLabel ?? (selectedEra ? selectedEra.name : null);

  return (
    <nav
      aria-label="Drill-down breadcrumb"
      className="flex flex-wrap items-center gap-2 text-sm text-slate-400"
    >
      {eraName ? (
        <>
          <button
            type="button"
            onClick={clearDownstreamFromEra}
            className="rounded px-1 text-sky-300 underline-offset-2 transition-colors hover:bg-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {eraName}
          </button>
          {(selectedCommitSha || selectedFilePath) && (
            <span aria-hidden="true">›</span>
          )}
        </>
      ) : null}

      {selectedCommitSha ? (
        <>
          <button
            type="button"
            onClick={clearDownstreamFromCommit}
            className="rounded px-1 font-mono text-sky-300 underline-offset-2 transition-colors hover:bg-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {selectedCommitSha.slice(0, 7)}
          </button>
          {selectedFilePath ? <span aria-hidden="true">›</span> : null}
        </>
      ) : null}

      {selectedFilePath ? (
        <span className="truncate font-mono text-slate-100">
          {selectedFilePath}
        </span>
      ) : null}
    </nav>
  );
}
