import { useEffect, useMemo, useState } from "react";
import { type CommitListFilters } from "./api/client.js";
import { CommitFilterBar } from "./components/CommitFilterBar.js";
import { CommitList } from "./components/CommitList.js";
import { EraDetailPanel } from "./components/EraDetailPanel.js";
import { EraTimeline } from "./components/EraTimeline.js";
import { IndexStatusCard } from "./components/IndexStatusCard.js";
import { DashboardLayout } from "./layout/DashboardLayout.js";
import { fetchSnapshot, type SnapshotLoadState } from "./snapshot.js";
import { eraToCommitFilters, useDrillStore } from "./store/drill.js";

export function App() {
  const [loadState, setLoadState] = useState<SnapshotLoadState>({
    status: "loading",
  });
  const [commitFilters, setCommitFilters] = useState<CommitListFilters>({});
  const selectedEra = useDrillStore((state) => state.selectedEra);

  const mergedFilters = useMemo<CommitListFilters>(() => {
    if (!selectedEra) {
      return commitFilters;
    }

    const eraWindow = eraToCommitFilters(selectedEra);
    return {
      ...commitFilters,
      after: eraWindow.after,
      before: eraWindow.before,
    };
  }, [commitFilters, selectedEra]);

  useEffect(() => {
    let cancelled = false;

    void fetchSnapshot().then((next) => {
      if (!cancelled) {
        setLoadState(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout
      loadState={loadState}
      sidebar={
        loadState.status === "ready" ? (
          <>
            <IndexStatusCard manifest={loadState.data.manifest} />
            <EraDetailPanel />
          </>
        ) : null
      }
      timeline={loadState.status === "ready" ? <EraTimeline /> : null}
      commitFilterBar={
        loadState.status === "ready" ? (
          <CommitFilterBar
            filters={commitFilters}
            onChange={setCommitFilters}
          />
        ) : null
      }
      main={
        loadState.status === "ready" ? (
          <CommitList filters={mergedFilters} />
        ) : loadState.status === "loading" ? (
          <p className="text-slate-400">Loading commit history…</p>
        ) : null
      }
    />
  );
}
