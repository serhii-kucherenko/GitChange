import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { CommitListFilters } from "./api/client.js";
import {
  fetchEras,
  fetchGraph,
  fetchTour,
  fetchWorkspace,
  graph,
  tours,
} from "./api/client.js";
import { CommitDetailPanel } from "./components/CommitDetailPanel.js";
import { CommitFilterBar } from "./components/CommitFilterBar.js";
import { CommitList } from "./components/CommitList.js";
import {
  DecisionDetailDrawer,
  DecisionsPanel,
} from "./components/DecisionsPanel.js";
import { EraDetailPanel } from "./components/EraDetailPanel.js";
import { EraTimeline } from "./components/EraTimeline.js";
import { FileHistoryScrubber } from "./components/FileHistoryScrubber.js";
import { IndexStatusCard } from "./components/IndexStatusCard.js";
import { MigrationThreadPanel } from "./components/MigrationThreadPanel.js";
import { OpenThreadsPanel } from "./components/OpenThreadsPanel.js";
import { RepoFilterBar } from "./components/RepoFilterBar.js";
import { TemporalGraphView } from "./components/TemporalGraphView.js";
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
import { useWorkspaceStore } from "./store/workspace.js";

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
  const selectedDecisionId = useDrillStore(
    (state) => state.selectedDecisionId,
  );
  const activeTourId = useTourStore((state) => state.activeTourId);
  const hydrateFromStorage = useTourStore((state) => state.hydrateFromStorage);
  const persistToStorage = useTourStore((state) => state.persistToStorage);
  const setWorkspaceSnapshot = useWorkspaceStore((state) => state.setSnapshot);
  const selectedRepoId = useWorkspaceStore((state) => state.selectedRepoId);

  const headSha =
    loadState.status === "ready" ? loadState.data.manifest.repo.head : null;

  const tourDetailQuery = useQuery({
    queryKey: activeTourId
      ? tours.detail(activeTourId)
      : ["tours", "detail", "none"],
    queryFn: () => {
      if (!activeTourId) {
        throw new Error("no_active_tour");
      }
      return fetchTour(activeTourId);
    },
    enabled: Boolean(activeTourId) && intelligenceTab === "tours",
    staleTime: 60_000,
  });

  const graphQuery = useQuery({
    queryKey: [...graph.all, selectedRepoId],
    queryFn: () => fetchGraph(selectedRepoId),
    enabled: intelligenceTab === "graph" && loadState.status === "ready",
    staleTime: 60_000,
  });

  const erasQuery = useQuery({
    queryKey: ["eras"],
    queryFn: fetchEras,
    enabled: intelligenceTab === "graph" && loadState.status === "ready",
    staleTime: 60_000,
  });

  const mergedFilters = useMemo<CommitListFilters>(() => {
    const base = selectedEra
      ? {
          ...commitFilters,
          ...eraToCommitFilters(selectedEra),
        }
      : commitFilters;

    if (!selectedRepoId) {
      return base;
    }

    return {
      ...base,
      repoId: selectedRepoId,
    };
  }, [commitFilters, selectedEra, selectedRepoId]);

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

    void fetchWorkspace()
      .then((workspace) => {
        if (!cancelled) {
          setWorkspaceSnapshot(workspace);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceSnapshot({
            isMultiRepo: false,
            primaryRepoId: null,
            repos: [],
            links: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setWorkspaceSnapshot]);

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

  const isReady = loadState.status === "ready";

  const timelineRail = isReady ? (
    <>
      <IndexStatusCard manifest={loadState.data.manifest} />
      <EraDetailPanel />
      <FileHistoryScrubber pathSuggestions={pathSuggestions} />
    </>
  ) : null;

  const commitListPane = isReady ? (
    selectedCommitSha ? (
      <CommitDetailPanel />
    ) : (
      <CommitList filters={mergedFilters} />
    )
  ) : null;

  const intelligenceRail =
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
    ) : intelligenceTab === "graph" ? (
      <p className="text-xs text-slate-400">
        Click nodes in the graph to drill into eras and commits. Use the repo
        filter above the commit list when you return to the timeline.
      </p>
    ) : null;

  const intelligenceMain = isReady ? (
    selectedCommitSha ? (
      <CommitDetailPanel />
    ) : selectedThreadId && intelligenceTab === "open-work" ? (
      <MigrationThreadPanel />
    ) : intelligenceTab === "open-work" ? (
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
        Select a thread to view its migration timeline and drill into commits.
      </p>
    ) : intelligenceTab === "tours" ? (
      <TourPlayer
        onDrillToTimeline={() => setIntelligenceTab("timeline")}
        onDrillToDecisions={() => setIntelligenceTab("decisions")}
      />
    ) : intelligenceTab === "graph" ? (
      graphQuery.isLoading ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
          Loading temporal graph…
        </p>
      ) : graphQuery.isError ? (
        <p
          className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-6 text-sm text-red-200"
          role="alert"
        >
          Temporal graph not available yet. Run semantic synthesis to build{" "}
          <code>temporal-graph.json</code>.
        </p>
      ) : graphQuery.data ? (
        <TemporalGraphView
          graph={graphQuery.data}
          eras={erasQuery.data ?? []}
          onDrillToTimeline={() => setIntelligenceTab("timeline")}
        />
      ) : null
    ) : selectedDecisionId && intelligenceTab === "decisions" ? (
      <DecisionDetailDrawer decisionId={selectedDecisionId} />
    ) : (
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
        Select a decision to view its evidence and drill into commits.
      </p>
    )
  ) : null;

  return (
    <DashboardLayout
      loadState={loadState}
      intelligenceTab={intelligenceTab}
      onIntelligenceTabChange={setIntelligenceTab}
      eraTimeline={isReady ? <EraTimeline /> : null}
      filterBar={
        isReady ? (
          <div className="space-y-3">
            <RepoFilterBar />
            <CommitFilterBar
              filters={commitFilters}
              onChange={setCommitFilters}
            />
          </div>
        ) : null
      }
      timelineRail={timelineRail}
      commitList={commitListPane}
      intelligenceRail={intelligenceRail}
      intelligenceMain={intelligenceMain}
    />
  );
}
