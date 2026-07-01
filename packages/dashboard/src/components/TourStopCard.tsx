import { useQuery } from "@tanstack/react-query";
import { fetchEras, fetchOpenWorkMatchableThreads } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import type {
  TourDrillTarget,
  TourEvidence,
  TourStop,
} from "../types.js";
import { matchOpenWorkToSurface } from "../utils/open-work-match.js";
import { OpenWorkBadge } from "./OpenWorkBadge.js";

const DOC_EXCERPT_MAX = 120;

interface TourStopCardProps {
  stop: TourStop;
  chapterTitle: string;
  onDrillToTimeline: () => void;
  onDrillToDecisions: () => void;
}

function truncateExcerpt(text: string): string {
  if (text.length <= DOC_EXCERPT_MAX) {
    return text;
  }
  return `${text.slice(0, DOC_EXCERPT_MAX).trimEnd()}…`;
}

function evidenceLabel(evidence: TourEvidence): string {
  switch (evidence.type) {
    case "commit":
      return evidence.sha.slice(0, 7);
    case "file":
      return evidence.path;
    case "doc":
      return `${evidence.path} — ${truncateExcerpt(evidence.excerpt)}`;
    case "hunk":
      return `${evidence.path}:${evidence.startLine}-${evidence.endLine}`;
    case "interview":
      return `${evidence.path} — ${truncateExcerpt(evidence.excerpt)}`;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

function evidenceDrillTarget(evidence: TourEvidence): TourDrillTarget {
  switch (evidence.type) {
    case "commit":
      return { commitSha: evidence.sha };
    case "file":
      return { commitSha: evidence.commitSha, filePath: evidence.path };
    case "doc":
    case "hunk":
      return { commitSha: evidence.commitSha, filePath: evidence.path };
    case "interview":
      return {};
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

export function TourStopCard({
  stop,
  chapterTitle,
  onDrillToTimeline,
  onDrillToDecisions,
}: TourStopCardProps) {
  const setSelectedEraId = useDrillStore((state) => state.setSelectedEraId);
  const setSelectedCommitSha = useDrillStore((state) => state.setSelectedCommitSha);
  const selectCommitAndFile = useDrillStore((state) => state.selectCommitAndFile);
  const setSelectedDecisionId = useDrillStore(
    (state) => state.setSelectedDecisionId,
  );

  const erasQuery = useQuery({
    queryKey: ["eras"],
    queryFn: fetchEras,
    staleTime: 60_000,
  });

  const openWorkQuery = useQuery({
    queryKey: ["open-work-matchable"],
    queryFn: fetchOpenWorkMatchableThreads,
    staleTime: 60_000,
  });

  const eraForTarget = stop.drillTarget.eraId
    ? erasQuery.data?.find((era) => era.id === stop.drillTarget.eraId)
    : undefined;

  const linkedThreads = matchOpenWorkToSurface(openWorkQuery.data ?? [], {
    eraId: stop.drillTarget.eraId,
    commitSha: stop.drillTarget.commitSha,
    path: stop.drillTarget.filePath,
    eraWindow: eraForTarget
      ? { startAt: eraForTarget.startAt, endAt: eraForTarget.endAt }
      : undefined,
  });

  const drillFromTarget = (target: TourDrillTarget) => {
    if (target.decisionId) {
      setSelectedDecisionId(target.decisionId);
      onDrillToDecisions();
      return;
    }

    if (target.filePath && target.commitSha) {
      selectCommitAndFile(target.commitSha, target.filePath);
      return;
    }

    if (target.eraId) {
      const era = erasQuery.data?.find((item) => item.id === target.eraId);
      if (era) {
        setSelectedEraId({
          id: era.id,
          name: era.name,
          startAt: era.startAt,
          endAt: era.endAt,
        });
        onDrillToTimeline();
        return;
      }
    }

    if (target.commitSha) {
      setSelectedCommitSha(target.commitSha);
    }
  };

  const hasDrillTarget =
    Boolean(stop.drillTarget.decisionId) ||
    Boolean(stop.drillTarget.filePath && stop.drillTarget.commitSha) ||
    Boolean(stop.drillTarget.eraId) ||
    Boolean(stop.drillTarget.commitSha);

  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <header className="mb-4 border-b border-slate-800 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {chapterTitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium text-slate-100">Tour stop</h2>
          {linkedThreads.map((thread) => (
            <OpenWorkBadge key={thread.id} status={thread.status} compact />
          ))}
        </div>
      </header>

      <p className="text-sm leading-relaxed text-slate-300">{stop.narrative}</p>

      {stop.evidence.length > 0 ? (
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Evidence
          </h3>
          <ul className="flex flex-wrap gap-2">
            {stop.evidence.map((item, index) => {
              const target = evidenceDrillTarget(item);
              const clickable =
                Boolean(target.commitSha) ||
                Boolean(target.decisionId) ||
                Boolean(target.eraId);

              return (
                <li key={`${item.type}-${index}`}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => drillFromTarget(target)}
                      className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-mono text-xs text-sky-300 hover:border-sky-800 hover:text-sky-200"
                    >
                      {evidenceLabel(item)}
                    </button>
                  ) : (
                    <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 font-mono text-xs text-slate-500">
                      {evidenceLabel(item)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {hasDrillTarget ? (
        <footer className="mt-6">
          <button
            type="button"
            onClick={() => drillFromTarget(stop.drillTarget)}
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            See evidence
          </button>
        </footer>
      ) : null}
    </article>
  );
}
