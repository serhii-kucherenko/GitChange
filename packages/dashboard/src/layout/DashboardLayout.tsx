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
  sidebar: ReactNode;
  fileHistory?: ReactNode;
  timeline?: ReactNode;
  commitFilterBar?: ReactNode;
  main: ReactNode;
  intelligencePanel?: ReactNode;
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
  sidebar,
  fileHistory,
  timeline,
  commitFilterBar,
  main,
  intelligencePanel,
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
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">GitChange</h1>
          <div className="flex flex-wrap items-center gap-3">
            {attributionBadge}
            {headSha ? (
              <p className="font-mono text-sm text-slate-400">
                HEAD {headSha.slice(0, 7)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="space-y-6">
          {loadState.status === "loading" ? (
            <p className="text-slate-400">Loading index status…</p>
          ) : null}

          {loadState.status === "error" ? (
            <div
              className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-red-200"
              role="alert"
            >
              {loadState.message}
            </div>
          ) : null}

          {loadState.status === "empty" ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-slate-300">
              Run <code className="text-slate-100">/gitchange</code> or{" "}
              <code className="text-slate-100">gitchange index</code> to analyze
              this repo.
            </div>
          ) : null}

          {loadState.status === "ready" ? (
            <>
              <nav
                aria-label="Intelligence views"
                className="flex rounded-lg border border-slate-700 bg-slate-900 p-1"
              >
                {(Object.keys(TAB_LABELS) as IntelligenceTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => onIntelligenceTabChange(tab)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      intelligenceTab === tab
                        ? "bg-slate-700 text-slate-100"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    aria-current={intelligenceTab === tab ? "page" : undefined}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </nav>

              {intelligenceTab === "timeline" ? (
                <>
                  {sidebar}
                  {fileHistory}
                </>
              ) : (
                intelligencePanel
              )}
            </>
          ) : null}
        </aside>

        <main className="min-h-[24rem] space-y-4">
          {intelligenceTab === "timeline" ? (
            <>
              {timeline}
              {commitFilterBar}
            </>
          ) : null}
          {main}
        </main>
      </div>
    </div>
  );
}
