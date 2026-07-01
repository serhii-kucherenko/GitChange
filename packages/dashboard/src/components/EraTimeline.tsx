import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { DataSet } from "vis-data";
import { Timeline } from "vis-timeline/standalone";
import type { DashboardEra } from "../api/client.js";
import { fetchEras, fetchOpenWorkMatchableThreads } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import { useWorkspaceStore } from "../store/workspace.js";
import type { MatchableOpenWorkThread } from "../utils/open-work-match.js";
import { matchOpenWorkToSurface } from "../utils/open-work-match.js";
import { openWorkBadgeHtml } from "../utils/open-work-badge-html.js";
import { RepoBadge } from "./RepoBadge.js";

interface TimelineItem {
  id: string;
  content: string;
  title: string;
  start: Date;
  end: Date;
  type: "range";
}

function formatEraLabel(
  era: DashboardEra,
  threads: MatchableOpenWorkThread[],
): string {
  const matched = matchOpenWorkToSurface(threads, {
    eraId: era.id,
    eraWindow: { startAt: era.startAt, endAt: era.endAt },
  });
  if (matched.length === 0) {
    return era.name;
  }

  const badge = openWorkBadgeHtml(matched[0]!.status);
  return `${era.name} ${badge}`;
}

function toTimelineItems(
  eras: DashboardEra[],
  threads: MatchableOpenWorkThread[],
): TimelineItem[] {
  return eras.map((era) => ({
    id: era.id,
    content: formatEraLabel(era, threads),
    title: era.name,
    start: new Date(era.startAt),
    end: new Date(era.endAt),
    type: "range",
  }));
}

function findEraById(eras: DashboardEra[], id: string): DashboardEra | undefined {
  return eras.find((era) => era.id === id);
}

export function EraTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const itemsRef = useRef<DataSet<TimelineItem> | null>(null);
  const erasRef = useRef<DashboardEra[]>([]);

  const selectedEra = useDrillStore((state) => state.selectedEra);
  const setSelectedEraId = useDrillStore((state) => state.setSelectedEraId);
  const clearEra = useDrillStore((state) => state.clearEra);

  const query = useQuery({
    queryKey: ["eras"],
    queryFn: fetchEras,
    staleTime: 60_000,
  });

  const openWorkQuery = useQuery({
    queryKey: ["open-work-matchable"],
    queryFn: fetchOpenWorkMatchableThreads,
    staleTime: 60_000,
  });

  const eras = query.data ?? [];
  const matchableThreads = openWorkQuery.data ?? [];
  const isMultiRepo = useWorkspaceStore(
    (state) => state.snapshot?.isMultiRepo ?? false,
  );
  const primaryRepoId = useWorkspaceStore(
    (state) => state.snapshot?.primaryRepoId ?? null,
  );
  erasRef.current = eras;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || eras.length === 0) {
      return;
    }

    const items = new DataSet<TimelineItem>(toTimelineItems(eras, matchableThreads));
    itemsRef.current = items;

    const timeline = new Timeline(container, items, {
      editable: false,
      selectable: true,
      multiselect: false,
      showCurrentTime: false,
      stack: false,
      zoomMin: 86_400_000,
      margin: { item: 8 },
    });

    timeline.on("select", (properties) => {
      const selectedId = properties.items[0];
      if (typeof selectedId !== "string") {
        clearEra();
        return;
      }

      const era = findEraById(erasRef.current, selectedId);
      if (!era) {
        clearEra();
        return;
      }

      setSelectedEraId({
        id: era.id,
        name: era.name,
        startAt: era.startAt,
        endAt: era.endAt,
      });
    });

    timelineRef.current = timeline;

    return () => {
      timeline.destroy();
      timelineRef.current = null;
      itemsRef.current = null;
    };
  }, [clearEra, eras.length, matchableThreads, setSelectedEraId]);

  useEffect(() => {
    const items = itemsRef.current;
    const timeline = timelineRef.current;
    if (!items || !timeline || eras.length === 0) {
      return;
    }

    const nextItems = toTimelineItems(eras, matchableThreads);
    const existingIds = items.getIds();
    const nextIds = nextItems.map((item) => item.id);

    for (const id of existingIds) {
      const idString = String(id);
      if (!nextIds.includes(idString)) {
        items.remove(id);
      }
    }

    for (const item of nextItems) {
      if (items.get(item.id)) {
        items.update(item);
      } else {
        items.add(item);
      }
    }
  }, [eras, matchableThreads]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }

    if (selectedEra) {
      timeline.setSelection([selectedEra.id]);
      return;
    }

    timeline.setSelection([]);
  }, [selectedEra]);

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading project timeline…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200"
        role="alert"
      >
        Failed to load era timeline.
      </section>
    );
  }

  if (eras.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-200">Project timeline</h2>
        <p className="mt-2 text-sm text-slate-400">
          Run era synthesis to see project chapters on the timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-slate-200">Project timeline</h2>
          {isMultiRepo && primaryRepoId ? (
            <RepoBadge repoId={primaryRepoId} compact />
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Click an era band to filter commits to that chapter.
          {isMultiRepo
            ? " Era bands show the primary repository until federated era merge lands."
            : ""}
        </p>
      </header>
      <div
        ref={containerRef}
        className="era-timeline min-h-[8rem] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950"
      />
    </section>
  );
}
