import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { fetchDecisionDetail, fetchDecisionsPage } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import {
  type DecisionEvidence,
  type DecisionReviewStatus,
  type DecisionStatus,
  type DecisionSummary,
  EVD03_GAP_MESSAGE,
  isDecisionGap,
} from "../types.js";
import { decisionConfidenceToLevel } from "../utils/confidence.js";
import { ConfidenceBadge } from "./ConfidenceBadge.js";

const PAGE_SIZE = 50;
const ROW_HEIGHT = 56;

const STATUS_STYLES: Record<DecisionStatus, string> = {
  proposed: "border-sky-700/60 bg-sky-950/50 text-sky-200",
  accepted: "border-emerald-700/60 bg-emerald-950/50 text-emerald-200",
  rejected: "border-red-700/60 bg-red-950/50 text-red-200",
  superseded: "border-slate-600/60 bg-slate-800/50 text-slate-400",
  in_flight: "border-amber-700/60 bg-amber-950/50 text-amber-200",
  unknown: "border-slate-600/60 bg-slate-800/50 text-slate-400",
};

const REVIEW_STYLES: Record<DecisionReviewStatus, string> = {
  pending: "border-amber-700/60 bg-amber-950/40 text-amber-200",
  confirmed: "border-emerald-700/60 bg-emerald-950/40 text-emerald-200",
  rejected: "border-red-700/60 bg-red-950/40 text-red-200",
};

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function evidenceCommitSha(evidence: DecisionEvidence): string | null {
  switch (evidence.type) {
    case "commit":
      return evidence.sha;
    case "file":
    case "doc":
    case "hunk":
      return evidence.commitSha;
    case "interview":
      return null;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

function evidenceStableKey(evidence: DecisionEvidence): string {
  switch (evidence.type) {
    case "commit":
      return `commit-${evidence.sha}`;
    case "file":
      return `file-${evidence.commitSha}-${evidence.path}`;
    case "doc":
      return `doc-${evidence.commitSha}-${evidence.path}-${evidence.excerpt.slice(0, 32)}`;
    case "hunk":
      return `hunk-${evidence.commitSha}-${evidence.path}-${evidence.startLine}-${evidence.endLine}`;
    case "interview":
      return `interview-${evidence.path}-${evidence.excerpt.slice(0, 32)}`;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

function DecisionRow({
  decision,
  isSelected,
  onSelect,
}: {
  decision: DecisionSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const isSuperseded =
    decision.status === "superseded" || Boolean(decision.supersededBy);

  return (
    <button
      type="button"
      onClick={() => onSelect(decision.id)}
      className={`flex w-full flex-col gap-1 border-b border-slate-800 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-800/60 ${
        isSelected ? "bg-slate-800/80" : ""
      }`}
      style={{ minHeight: ROW_HEIGHT }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate font-medium text-slate-100 ${
            isSuperseded ? "line-through decoration-slate-500" : ""
          }`}
        >
          {decision.title}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[decision.status]}`}
        >
          {decision.status.replace("_", " ")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span
          className={`rounded-full border px-1.5 py-0.5 ${REVIEW_STYLES[decision.reviewStatus]}`}
        >
          {decision.reviewStatus}
        </span>
        <span>{formatConfidence(decision.confidence)}</span>
        <span>
          {decision.evidenceCount} evidence
          {decision.evidenceCount === 1 ? "" : "s"}
        </span>
        {decision.supersededBy ? (
          <span className="text-slate-600">→ {decision.supersededBy}</span>
        ) : null}
      </div>
    </button>
  );
}

function DecisionDetailDrawer({ decisionId }: { decisionId: string }) {
  const setSelectedCommitSha = useDrillStore(
    (state) => state.setSelectedCommitSha,
  );
  const setSelectedDecisionId = useDrillStore(
    (state) => state.setSelectedDecisionId,
  );

  const query = useQuery({
    queryKey: ["decision-detail", decisionId],
    queryFn: () => fetchDecisionDetail(decisionId),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
        Loading decision detail…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div
        className="border-t border-slate-800 px-4 py-3 text-sm text-red-300"
        role="alert"
      >
        Failed to load decision detail.
      </div>
    );
  }

  const detail = query.data;

  if (isDecisionGap(detail)) {
    return (
      <div className="border-t border-slate-800 px-4 py-4">
        <button
          type="button"
          onClick={() => setSelectedDecisionId(null)}
          className="mb-3 text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to list
        </button>
        <p
          className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200"
          role="status"
        >
          {EVD03_GAP_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 px-4 py-4">
      <button
        type="button"
        onClick={() => setSelectedDecisionId(null)}
        className="mb-3 text-xs text-slate-500 hover:text-slate-300"
      >
        ← Back to list
      </button>
      <header className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium text-slate-100">
            {detail.title}
          </h3>
          <ConfidenceBadge
            level={decisionConfidenceToLevel(
              detail.confidence,
              detail.reviewStatus,
              detail.evidence.length,
            )}
          />
        </div>
        <p className="text-sm text-slate-400">{detail.summary}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full border px-2 py-0.5 ${STATUS_STYLES[detail.status]}`}
          >
            {detail.status.replace("_", " ")}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 ${REVIEW_STYLES[detail.reviewStatus]}`}
          >
            {detail.reviewStatus}
          </span>
          <span className="text-slate-500">
            {formatConfidence(detail.confidence)} confidence
          </span>
        </div>
      </header>

      {detail.attribution ? (
        <section className="mb-4 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Attribution
          </h4>
          <p className="text-sm font-medium text-slate-200">
            {detail.attribution.name}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {detail.attribution.rationale}
          </p>
          {(() => {
            const commitSha = detail.attribution.evidence
              .map((item) => evidenceCommitSha(item))
              .find((sha): sha is string => sha !== null);
            return commitSha ? (
              <button
                type="button"
                onClick={() => setSelectedCommitSha(commitSha)}
                className="mt-2 font-mono text-xs text-sky-300 hover:text-sky-200"
              >
                {commitSha.slice(0, 7)}
              </button>
            ) : null;
          })()}
        </section>
      ) : null}

      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Evidence
      </h4>
      <ul className="space-y-2">
        {detail.evidence.map((item) => {
          const commitSha = evidenceCommitSha(item);
          return (
            <li
              key={evidenceStableKey(item)}
              className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase text-slate-500">
                  {item.type}
                </span>
                {commitSha ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCommitSha(commitSha)}
                    className="font-mono text-xs text-sky-300 hover:text-sky-200"
                  >
                    {commitSha.slice(0, 7)}
                  </button>
                ) : null}
                {"path" in item ? (
                  <span className="truncate font-mono text-xs text-slate-400">
                    {item.path}
                  </span>
                ) : null}
              </div>
              {"excerpt" in item && item.excerpt ? (
                <p className="mt-1 text-xs text-slate-500">{item.excerpt}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DecisionsPanel() {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedDecisionId = useDrillStore((state) => state.selectedDecisionId);
  const setSelectedDecisionId = useDrillStore(
    (state) => state.setSelectedDecisionId,
  );

  const query = useInfiniteQuery({
    queryKey: ["decisions"],
    queryFn: ({ pageParam }) =>
      fetchDecisionsPage({
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const decisions = useMemo(
    () => query.data?.pages.flatMap((page) => page.decisions) ?? [],
    [query.data],
  );

  const virtualizer = useVirtualizer({
    count: decisions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading decisions…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"
        role="alert"
      >
        Failed to load decisions.
      </section>
    );
  }

  if (decisions.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Decisions
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          No recorded decisions found for this repo.
        </p>
      </section>
    );
  }

  if (selectedDecisionId) {
    return (
      <section className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <header className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-200">
            Decision detail
          </h2>
        </header>
        <DecisionDetailDrawer decisionId={selectedDecisionId} />
      </section>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Decisions
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {decisions.length} decision{decisions.length === 1 ? "" : "s"}
        </p>
      </header>
      <div ref={parentRef} className="min-h-[24rem] flex-1 overflow-y-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const decision = decisions[virtualRow.index];
            if (!decision) {
              return null;
            }
            return (
              <div
                key={decision.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <DecisionRow
                  decision={decision}
                  isSelected={selectedDecisionId === decision.id}
                  onSelect={setSelectedDecisionId}
                />
              </div>
            );
          })}
        </div>
      </div>
      {query.hasNextPage ? (
        <footer className="border-t border-slate-800 px-4 py-2">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </footer>
      ) : null}
    </section>
  );
}
