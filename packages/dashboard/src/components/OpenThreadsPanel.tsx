import { useQuery } from "@tanstack/react-query";
import { fetchOpenWorkThreads } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import type { OpenWorkKind, OpenWorkThreadSummary } from "../types.js";
import { OpenWorkBadge } from "./OpenWorkBadge.js";

const KIND_LABELS: Record<OpenWorkKind, string> = {
  migration: "Migration",
  refactor: "Refactor",
  wip: "WIP",
  stale: "Stale",
};

function formatLastEvent(timestamp: number | null): string {
  if (timestamp === null) {
    return "No events";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }
  return date.toLocaleDateString();
}

function ThreadRow({
  thread,
  isSelected,
  onSelect,
}: {
  thread: OpenWorkThreadSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className={`flex w-full flex-col gap-1 border-b border-slate-800 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
        isSelected ? "bg-slate-800 ring-1 ring-inset ring-sky-500" : ""
      }`}
      aria-current={isSelected ? "true" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {KIND_LABELS[thread.kind]}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
          {thread.title}
        </span>
        <OpenWorkBadge status={thread.status} compact />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{Math.round(thread.confidence * 100)}% confidence</span>
        <span>Last: {formatLastEvent(thread.lastEventAt)}</span>
      </div>
    </button>
  );
}

export function OpenThreadsPanel() {
  const selectedThreadId = useDrillStore((state) => state.selectedThreadId);
  const setSelectedThreadId = useDrillStore(
    (state) => state.setSelectedThreadId,
  );

  const query = useQuery({
    queryKey: ["open-work"],
    queryFn: fetchOpenWorkThreads,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading open work…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"
        role="alert"
      >
        Failed to load open work threads.
      </section>
    );
  }

  const threads = query.data?.threads ?? [];

  if (threads.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Open work
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          No open threads detected — no in-flight migrations or stale work found
          in the index.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-[24rem] flex-1 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Open work
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {threads.length} thread{threads.length === 1 ? "" : "s"}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            isSelected={selectedThreadId === thread.id}
            onSelect={setSelectedThreadId}
          />
        ))}
      </div>
    </section>
  );
}
