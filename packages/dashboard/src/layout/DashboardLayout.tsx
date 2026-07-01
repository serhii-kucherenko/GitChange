import type { ReactNode } from "react";
import type { SnapshotLoadState } from "../snapshot.js";

interface DashboardLayoutProps {
  loadState: SnapshotLoadState;
  sidebar: ReactNode;
  main: ReactNode;
}

export function DashboardLayout({
  loadState,
  sidebar,
  main,
}: DashboardLayoutProps) {
  const headSha =
    loadState.status === "ready" ? loadState.data.manifest.repo.head : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">GitChange</h1>
          {headSha ? (
            <p className="font-mono text-sm text-slate-400">
              HEAD {headSha.slice(0, 7)}
            </p>
          ) : null}
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

          {loadState.status === "ready" ? sidebar : null}
        </aside>

        <main className="min-h-[24rem]">{main}</main>
      </div>
    </div>
  );
}
