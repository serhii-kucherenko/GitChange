import type { ReactNode } from "react";
import { AttributionBadge } from "../components/ConfidenceBadge.js";
import type { SnapshotLoadState } from "../snapshot.js";
import { resolveDisplayedAttribution } from "../utils/confidence.js";

export type IntelligenceTab =
  | "timeline"
  | "decisions"
  | "open-work"
  | "tours"
  | "graph";

interface DashboardLayoutProps {
  loadState: SnapshotLoadState;
  intelligenceTab: IntelligenceTab;
  onIntelligenceTabChange: (tab: IntelligenceTab) => void;
  /** Timeline view — full-width era strip on top. */
  eraTimeline?: ReactNode;
  /** Timeline view — full-width filter bar under the era strip. */
  filterBar?: ReactNode;
  /** Timeline view — left context rail (Index status + Era detail + File history). */
  timelineRail?: ReactNode;
  /** Timeline view — right pane (virtualized commit list). */
  commitList?: ReactNode;
  /** Decisions / Open work / Tours — left pane (list / picker). */
  intelligenceRail?: ReactNode;
  /** Decisions / Open work / Tours / Graph — right pane (detail / player / canvas). */
  intelligenceMain?: ReactNode;
}

const TAB_LABELS: Record<IntelligenceTab, string> = {
  timeline: "Timeline",
  decisions: "Decisions",
  "open-work": "Open work",
  tours: "Tours",
  graph: "Graph",
};

export function DashboardLayout({
  loadState,
  intelligenceTab,
  onIntelligenceTabChange,
  eraTimeline,
  filterBar,
  timelineRail,
  commitList,
  intelligenceRail,
  intelligenceMain,
}: DashboardLayoutProps) {
  const headSha =
    loadState.status === "ready" ? loadState.data.manifest.repo.head : null;
  const attributionBadge =
    loadState.status === "ready" ? (
      <AttributionBadge
        confidence={resolveDisplayedAttribution(
          loadState.data.intelligence?.attributionConfidence,
          loadState.data.manifest.warnings.length > 0,
        )}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 h-14 border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[96rem] items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">GitChange</h1>
          <div className="flex flex-wrap items-center gap-3">
            {attributionBadge}
            {headSha ? (
              <p className="font-mono text-xs text-slate-400">
                HEAD {headSha.slice(0, 7)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {loadState.status === "ready" ? (
        <div className="border-b border-slate-800 bg-slate-900/80">
          <nav
            role="tablist"
            aria-label="Primary views"
            className="mx-auto flex max-w-[96rem] gap-1 px-6"
          >
            {(Object.keys(TAB_LABELS) as IntelligenceTab[]).map((tab) => {
              const isActive = intelligenceTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onIntelligenceTabChange(tab)}
                  className={`min-h-[32px] whitespace-nowrap border-b-2 px-4 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? "border-sky-400 font-semibold text-slate-100"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}

      {loadState.status === "loading" ? (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <p className="text-slate-400">Loading index status…</p>
        </div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <div
            className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-red-200"
            role="alert"
          >
            Couldn't load the index. Confirm{" "}
            <code className="text-red-100">.gitchange/</code> exists and re-run{" "}
            <code className="text-red-100">gitchange index</code>, then reload.
          </div>
        </div>
      ) : null}

      {loadState.status === "empty" ? (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            No analysis yet
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Run <code className="text-slate-100">/gitchange</code> in your IDE,
            or <code className="text-slate-100">gitchange index</code> in this
            repo, then reload to explore its history.
          </p>
        </div>
      ) : null}

      {loadState.status === "ready" ? (
        <div className="mx-auto max-w-[96rem] px-6 py-8">
          {intelligenceTab === "timeline" ? (
            <div className="space-y-8">
              {eraTimeline}
              {filterBar}
              <div className="grid gap-8 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
                <div className="space-y-6">{timelineRail}</div>
                <div className="min-h-[24rem]">{commitList}</div>
              </div>
            </div>
          ) : intelligenceTab === "graph" ? (
            <div className="flex min-h-[32rem] flex-col gap-4">
              {intelligenceRail}
              <div className="min-h-[32rem] flex-1">{intelligenceMain}</div>
            </div>
          ) : intelligenceTab === "tours" ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
              <div className="space-y-6">{intelligenceRail}</div>
              <div className="min-h-[24rem]">{intelligenceMain}</div>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
              <div className="space-y-6">{intelligenceRail}</div>
              <div className="min-h-[24rem]">{intelligenceMain}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
