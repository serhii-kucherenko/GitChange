import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import {
  fetchCommitsPage,
  hasActiveFilters,
  type CommitListFilters,
  type CommitSummary,
} from "../api/client.js";
import { useDrillStore } from "../store/drill.js";

const PAGE_SIZE = 50;
const ROW_HEIGHT = 44;

function formatCommittedAt(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return String(timestampMs);
  }
  return date.toLocaleString();
}

function CommitRow({
  commit,
  isSelected,
  onSelect,
}: {
  commit: CommitSummary;
  isSelected: boolean;
  onSelect: (sha: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(commit.sha)}
      className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 text-left text-sm transition-colors hover:bg-slate-800/60 ${
        isSelected ? "bg-slate-800/80" : ""
      }`}
      style={{ height: ROW_HEIGHT }}
    >
      <span className="shrink-0 font-mono text-xs text-slate-400">
        {commit.sha.slice(0, 7)}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-100">
        {commit.summary}
      </span>
      <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
        {commit.authorName}
      </span>
      <span className="shrink-0 text-xs text-slate-500">
        {formatCommittedAt(commit.committedAt)}
      </span>
    </button>
  );
}

interface CommitListProps {
  filters: CommitListFilters;
}

export function CommitList({ filters }: CommitListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCommitSha = useDrillStore((state) => state.selectedCommitSha);
  const setSelectedCommitSha = useDrillStore(
    (state) => state.setSelectedCommitSha,
  );

  const filtersActive = hasActiveFilters(filters);

  const query = useInfiniteQuery({
    queryKey: ["commits", filters],
    queryFn: ({ pageParam }) =>
      fetchCommitsPage({
        limit: PAGE_SIZE,
        cursor: pageParam,
        ...filters,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const commits = useMemo(
    () => query.data?.pages.flatMap((page) => page.commits) ?? [],
    [query.data],
  );

  const rowCount =
    query.hasNextPage && !query.isFetchingNextPage
      ? commits.length + 1
      : commits.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems.at(-1);
    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= commits.length - 1 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      void query.fetchNextPage();
    }
  }, [
    commits.length,
    query.fetchNextPage,
    query.hasNextPage,
    query.isFetchingNextPage,
    virtualItems,
  ]);

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
        <p className="text-slate-400">Loading commits…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-lg border border-red-800 bg-red-950/40 p-5 text-red-200"
        role="alert"
      >
        Failed to load commits.
      </section>
    );
  }

  if (commits.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
        <p className="text-slate-400">
          {filtersActive
            ? "No commits match filters."
            : "No commits indexed yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-[min(70vh,40rem)] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-medium text-slate-100">Commits</h2>
        <p className="text-xs text-slate-500">
          {commits.length}
          {query.hasNextPage ? "+" : ""} loaded from index
          {filtersActive ? " (filtered)" : ""}
        </p>
      </header>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= commits.length;
            const commit = commits[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <div
                    className="flex items-center px-4 text-sm text-slate-500"
                    style={{ height: ROW_HEIGHT }}
                  >
                    Loading more commits…
                  </div>
                ) : (
                  <CommitRow
                    commit={commit}
                    isSelected={selectedCommitSha === commit.sha}
                    onSelect={setSelectedCommitSha}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
