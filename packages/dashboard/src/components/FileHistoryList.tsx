import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { type FileHistoryEvent, fetchFileHistoryPage } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";

const PAGE_SIZE = 50;
const ROW_HEIGHT = 52;

function formatCommittedAt(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return String(timestampMs);
  }
  return date.toLocaleString();
}

function FileHistoryRow({
  event,
  isSelected,
  onSelect,
}: {
  event: FileHistoryEvent;
  isSelected: boolean;
  onSelect: (event: FileHistoryEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`flex w-full flex-col gap-1 border-b border-slate-800 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-800/60 ${
        isSelected ? "bg-slate-800/80" : ""
      }`}
      style={{ minHeight: ROW_HEIGHT }}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-xs text-slate-400">
          {event.commitSha.slice(0, 7)}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-100">
          {event.summary}
        </span>
        <span className="shrink-0 text-xs uppercase text-slate-500">
          {event.changeType}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{formatCommittedAt(event.committedAt)}</span>
        {event.oldPath ? (
          <span className="truncate font-mono">
            renamed from {event.oldPath}
          </span>
        ) : null}
      </div>
    </button>
  );
}

interface FileHistoryListProps {
  path: string;
}

export function FileHistoryList({ path }: FileHistoryListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCommitSha = useDrillStore((state) => state.selectedCommitSha);
  const selectedFilePath = useDrillStore((state) => state.selectedFilePath);
  const selectCommitAndFile = useDrillStore(
    (state) => state.selectCommitAndFile,
  );

  const query = useInfiniteQuery({
    queryKey: ["file-history", path],
    queryFn: ({ pageParam }) =>
      fetchFileHistoryPage(path, {
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: path.trim().length > 0,
  });

  const events = useMemo(
    () => query.data?.pages.flatMap((page) => page.events) ?? [],
    [query.data],
  );

  const rowCount =
    query.hasNextPage && !query.isFetchingNextPage
      ? events.length + 1
      : events.length;

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
      lastItem.index >= events.length - 1 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      void query.fetchNextPage();
    }
  }, [
    events.length,
    query.fetchNextPage,
    query.hasNextPage,
    query.isFetchingNextPage,
    virtualItems,
  ]);

  if (query.isLoading) {
    return <p className="text-sm text-slate-400">Loading file history…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-red-300" role="alert">
        Failed to load file history.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No indexed touches for this path.
      </p>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-64 overflow-auto rounded border border-slate-800"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= events.length;
          const event = events[virtualRow.index];

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
                  Loading more events…
                </div>
              ) : (
                <FileHistoryRow
                  event={event}
                  isSelected={
                    selectedCommitSha === event.commitSha &&
                    selectedFilePath === event.path
                  }
                  onSelect={(selected) =>
                    selectCommitAndFile(selected.commitSha, selected.path)
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
