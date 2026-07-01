import { useQuery } from "@tanstack/react-query";
import {
  type CommitDetailFile,
  fetchCommitDetail,
} from "../api/commit-detail.js";
import { useDrillStore } from "../store/drill.js";
import { DrillBreadcrumb } from "./DrillBreadcrumb.js";
import { FileHunkView } from "./FileHunkView.js";

function formatCommittedAt(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }
  return date.toLocaleString();
}

export function CommitDetailPanel() {
  const selectedCommitSha = useDrillStore((state) => state.selectedCommitSha);
  const selectedRepoId = useDrillStore((state) => state.selectedRepoId);
  const selectedFilePath = useDrillStore((state) => state.selectedFilePath);
  const setSelectedFilePath = useDrillStore(
    (state) => state.setSelectedFilePath,
  );

  const query = useQuery({
    queryKey: ["commit-detail", selectedCommitSha, selectedRepoId],
    queryFn: () => {
      if (!selectedCommitSha) {
        throw new Error("No commit selected");
      }
      return fetchCommitDetail(selectedCommitSha, selectedRepoId);
    },
    enabled: Boolean(selectedCommitSha),
  });

  if (!selectedCommitSha) {
    return null;
  }

  const selectedFile: CommitDetailFile | undefined = query.data?.files.find(
    (file) => file.path === selectedFilePath,
  );

  return (
    <section className="flex h-[min(70vh,40rem)] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <header className="space-y-2 border-b border-slate-800 px-4 py-3">
        <DrillBreadcrumb />
        {query.isLoading ? (
          <p className="text-sm text-slate-400">Loading commit detail…</p>
        ) : null}
        {query.isError ? (
          <p className="text-sm text-red-300" role="alert">
            Failed to load commit detail.
          </p>
        ) : null}
        {query.data ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">
              {query.data.commit.summary}
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {query.data.commit.sha.slice(0, 7)} ·{" "}
              {query.data.commit.authorName} ·{" "}
              {formatCommittedAt(query.data.commit.committedAt)}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="overflow-auto border-b border-slate-800 lg:border-b-0 lg:border-r">
          {query.data ? (
            <ul className="divide-y divide-slate-800">
              {query.data.files.map((file) => {
                const isSelected = file.path === selectedFilePath;
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      onClick={() => setSelectedFilePath(file.path)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                        isSelected
                          ? "bg-slate-800 ring-1 ring-inset ring-sky-500"
                          : ""
                      }`}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <span className="truncate font-mono text-slate-100">
                        {file.path}
                      </span>
                      <span className="text-xs text-slate-400">
                        {file.changeType}
                        {file.hunks.length > 0
                          ? ` · ${file.hunks.length} hunk${file.hunks.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="overflow-auto p-4">
          {selectedFile ? (
            <FileHunkView file={selectedFile} />
          ) : (
            <p className="text-sm text-slate-400">
              Select a file to view diff hunks.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
