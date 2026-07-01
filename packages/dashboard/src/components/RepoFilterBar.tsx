import { useWorkspaceStore } from "../store/workspace.js";

export function RepoFilterBar() {
  const snapshot = useWorkspaceStore((state) => state.snapshot);
  const selectedRepoId = useWorkspaceStore((state) => state.selectedRepoId);
  const setSelectedRepoId = useWorkspaceStore(
    (state) => state.setSelectedRepoId,
  );

  if (!snapshot?.isMultiRepo || snapshot.repos.length < 2) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Repository
        </span>
        <button
          type="button"
          onClick={() => setSelectedRepoId(null)}
          className={`inline-flex min-h-[2rem] items-center rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
            selectedRepoId === null
              ? "border-sky-500 bg-slate-800 text-slate-100 ring-1 ring-sky-500"
              : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          }`}
          aria-pressed={selectedRepoId === null}
        >
          All repos
        </button>
        {snapshot.repos.map((repo) => (
          <button
            key={repo.repoId}
            type="button"
            onClick={() => setSelectedRepoId(repo.repoId)}
            className={`inline-flex min-h-[2rem] items-center rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              selectedRepoId === repo.repoId
                ? "border-sky-500 bg-slate-800 text-slate-100 ring-1 ring-sky-500"
                : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            }`}
            aria-pressed={selectedRepoId === repo.repoId}
          >
            {repo.label}
          </button>
        ))}
      </div>
    </section>
  );
}
