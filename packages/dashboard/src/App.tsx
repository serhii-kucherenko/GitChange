import { useEffect, useState } from "react";
import { IndexStatusCard } from "./components/IndexStatusCard.js";
import { RepoSnapshot } from "./components/RepoSnapshot.js";
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

  const headSha =
    loadState.status === "ready" ? loadState.data.manifest.repo.head : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">GitChange</h1>
          {headSha ? (
            <p className="font-mono text-sm text-slate-400">
              HEAD {headSha.slice(0, 7)}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
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
            <IndexStatusCard manifest={loadState.data.manifest} />
            <RepoSnapshot
              stats={loadState.data.stats}
              highlights={loadState.data.highlights}
              intelligence={loadState.data.intelligence}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
