import { useEffect, useState } from "react";
import { CommitList } from "./components/CommitList.js";
import { IndexStatusCard } from "./components/IndexStatusCard.js";
import { DashboardLayout } from "./layout/DashboardLayout.js";
import { fetchSnapshot, type SnapshotLoadState } from "./snapshot.js";

export function App() {
  const [loadState, setLoadState] = useState<SnapshotLoadState>({
    status: "loading",
  });

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
          <IndexStatusCard manifest={loadState.data.manifest} />
        ) : null
      }
      main={
        loadState.status === "ready" ? (
          <CommitList />
        ) : loadState.status === "loading" ? (
          <p className="text-slate-400">Loading commit history…</p>
        ) : null
      }
    />
  );
}
