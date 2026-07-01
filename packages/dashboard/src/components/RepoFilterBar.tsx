import { useWorkspaceStore } from "../store/workspace.js";

export function RepoFilterBar() {
  const snapshot = useWorkspaceStore((state) => state.snapshot);
  const selectedRepoId = useWorkspaceStore((state) => state.selectedRepoId);
  const setSelectedRepoId = useWorkspaceStore((state) => state.setSelectedRepoId);

  if (!snapshot?.isMultiRepo || snapshot.repos.length < 2) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Repository
        </span>
        <button
          type="button"
          onClick={() => setSelectedRepoId(null)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            selectedRepoId === null
              ? "bg-sky-700 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          All repos
        </button>
        {snapshot.repos.map((repo) => (
          <button
            key={repo.repoId}
            type="button"
            onClick={() => setSelectedRepoId(repo.repoId)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              selectedRepoId === repo.repoId
                ? "bg-sky-700 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {repo.label}
          </button>
        ))}
      </div>
    </section>
  );
}
