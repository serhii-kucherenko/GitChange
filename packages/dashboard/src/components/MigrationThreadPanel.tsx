import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { fetchOpenWorkThread } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import type { OpenWorkThreadEvent } from "../types.js";
import { OpenWorkBadge } from "./OpenWorkBadge.js";

const ROW_HEIGHT = 64;

function formatCommittedAt(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return String(timestampMs);
  }
  return date.toLocaleString();
}

function EventRow({
  event,
  onSelectCommit,
}: {
  event: OpenWorkThreadEvent;
  onSelectCommit: (sha: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectCommit(event.commitSha)}
      className="flex w-full flex-col gap-1 border-b border-slate-800 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-800/60"
      style={{ minHeight: ROW_HEIGHT }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 font-mono text-xs text-sky-300">
          {event.commitSha.slice(0, 7)}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-100">
          {event.summary}
        </span>
        <span className="shrink-0 text-xs text-slate-500">
          {formatCommittedAt(event.committedAt)}
        </span>
      </div>
      <p className="truncate font-mono text-xs text-slate-500">
        {event.paths.join(", ")}
      </p>
    </button>
  );
}

export function MigrationThreadPanel() {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedThreadId = useDrillStore((state) => state.selectedThreadId);
  const setSelectedThreadId = useDrillStore(
    (state) => state.setSelectedThreadId,
  );
  const setSelectedCommitSha = useDrillStore(
    (state) => state.setSelectedCommitSha,
  );

  const query = useQuery({
    queryKey: ["open-work-thread", selectedThreadId],
    queryFn: () => {
      if (!selectedThreadId) {
        throw new Error("No thread selected");
      }
      return fetchOpenWorkThread(selectedThreadId);
    },
    enabled: Boolean(selectedThreadId),
    staleTime: 60_000,
  });

  const eventsNewestFirst = useMemo(() => {
    const events = query.data?.events ?? [];
    return [...events].sort((left, right) => {
      if (right.committedAt !== left.committedAt) {
        return right.committedAt - left.committedAt;
      }
      return right.commitSha.localeCompare(left.commitSha);
    });
  }, [query.data?.events]);

  const virtualizer = useVirtualizer({
    count: eventsNewestFirst.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (!selectedThreadId) {
    return null;
  }

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading thread events…</p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section
        className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"
        role="alert"
      >
        Failed to load thread detail.
      </section>
    );
  }

  const thread = query.data;

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <header className="space-y-2 border-b border-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setSelectedThreadId(null)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ← Back to threads
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            {thread.title}
          </h2>
          <OpenWorkBadge status={thread.status} />
        </div>
        <p className="text-sm text-slate-400">{thread.summary}</p>
        <p className="text-xs text-slate-400">
          {thread.relatedPaths.join(", ")} · {thread.events.length} event
          {thread.events.length === 1 ? "" : "s"}
        </p>
      </header>

      <div
        ref={parentRef}
        className="min-h-[24rem] max-h-[min(70vh,40rem)] flex-1 overflow-y-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const event = eventsNewestFirst[virtualRow.index];
            if (!event) {
              return null;
            }
            return (
              <div
                key={`${event.commitSha}-${virtualRow.index}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EventRow event={event} onSelectCommit={setSelectedCommitSha} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
