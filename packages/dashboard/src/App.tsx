import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { CommitListFilters } from "./api/client.js";
import { fetchTour, tours } from "./api/client.js";
import { CommitDetailPanel } from "./components/CommitDetailPanel.js";
import { CommitFilterBar } from "./components/CommitFilterBar.js";
import { CommitList } from "./components/CommitList.js";
import { DecisionsPanel } from "./components/DecisionsPanel.js";
import { EraDetailPanel } from "./components/EraDetailPanel.js";
import { EraTimeline } from "./components/EraTimeline.js";
import { FileHistoryScrubber } from "./components/FileHistoryScrubber.js";
import { IndexStatusCard } from "./components/IndexStatusCard.js";
import { MigrationThreadPanel } from "./components/MigrationThreadPanel.js";
import { OpenThreadsPanel } from "./components/OpenThreadsPanel.js";
import { TourChapterNav } from "./components/TourChapterNav.js";
import { TourPicker } from "./components/TourPicker.js";
import { TourPlayer } from "./components/TourPlayer.js";
import {
  DashboardLayout,
  type IntelligenceTab,
} from "./layout/DashboardLayout.js";
import { fetchSnapshot, type SnapshotLoadState } from "./snapshot.js";
import { eraToCommitFilters, useDrillStore } from "./store/drill.js";
import { useTourStore } from "./store/tour.js";

export function App() {
  const [loadState, setLoadState] = useState<SnapshotLoadState>({
    status: "loading",
  });
  const [commitFilters, setCommitFilters] = useState<CommitListFilters>({});
  const [intelligenceTab, setIntelligenceTab] =
    useState<IntelligenceTab>("timeline");
  const selectedEra = useDrillStore((state) => state.selectedEra);
  const selectedCommitSha = useDrillStore((state) => state.selectedCommitSha);
  const selectedThreadId = useDrillStore((state) => state.selectedThreadId);
  const activeTourId = useTourStore((state) => state.activeTourId);
  const hydrateFromStorage = useTourStore((state) => state.hydrateFromStorage);
  const persistToStorage = useTourStore((state) => state.persistToStorage);

  const headSha =
    loadState.status === "ready" ? loadState.data.manifest.repo.head : null;

  const tourDetailQuery = useQuery({
    queryKey: activeTourId ? tours.detail(activeTourId) : ["tours", "detail", "none"],
    queryFn: () => {
      if (!activeTourId) {
        throw new Error("no_active_tour");
      }
      return fetchTour(activeTourId);
    },
    enabled: Boolean(activeTourId) && intelligenceTab === "tours",
    staleTime: 60_000,
  });

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

  const pathSuggestions = useMemo(
    () =>
      loadState.status === "ready"
        ? loadState.data.highlights.topChurnFiles.map((file) => file.path)
        : [],
    [loadState],
  );

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

  useEffect(() => {
    if (!headSha) {
      return;
    }
    hydrateFromStorage(headSha);
  }, [headSha, hydrateFromStorage]);

  useEffect(() => {
    if (!headSha) {
      return;
    }

    return useTourStore.subscribe(() => {
      persistToStorage(headSha);
    });
  }, [headSha, persistToStorage]);

  const intelligencePanel =
    intelligenceTab === "decisions" ? (
      <DecisionsPanel />
    ) : intelligenceTab === "open-work" ? (
      <OpenThreadsPanel />
    ) : intelligenceTab === "tours" ? (
      <div className="space-y-4">
        <TourPicker />
        {tourDetailQuery.data ? (
          <TourChapterNav chapters={tourDetailQuery.data.chapters} />
        ) : null}
      </div>
    ) : null;

  const mainContent =
    loadState.status === "ready" ? (
      <div className="space-y-4">
        {selectedCommitSha ? (
          <CommitDetailPanel />
        ) : selectedThreadId && intelligenceTab === "open-work" ? (
          <MigrationThreadPanel />
        ) : intelligenceTab === "timeline" ? (
          <CommitList filters={mergedFilters} />
        ) : intelligenceTab === "open-work" ? (
          <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
            Select a thread to view its migration timeline and drill into
            commits.
          </p>
        ) : intelligenceTab === "tours" ? (
          <TourPlayer
            onDrillToTimeline={() => setIntelligenceTab("timeline")}
            onDrillToDecisions={() => setIntelligenceTab("decisions")}
          />
        ) : (
          <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
            Select a decision to view evidence and drill into commits.
          </p>
        )}
      </div>
    ) : loadState.status === "loading" ? (
      <p className="text-slate-400">Loading commit history…</p>
    ) : null;

  return (
    <DashboardLayout
      loadState={loadState}
      intelligenceTab={intelligenceTab}
      onIntelligenceTabChange={setIntelligenceTab}
      sidebar={
        loadState.status === "ready" ? (
          <>
            <IndexStatusCard manifest={loadState.data.manifest} />
            <EraDetailPanel />
          </>
        ) : null
      }
      fileHistory={
        loadState.status === "ready" ? (
          <FileHistoryScrubber pathSuggestions={pathSuggestions} />
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
      intelligencePanel={intelligencePanel}
      main={mainContent}
    />
  );
}
