import { useQuery } from "@tanstack/react-query";
import { fetchTour, tours } from "../api/client.js";
import { useTourStore } from "../store/tour.js";
import { TourStopCard } from "./TourStopCard.js";

interface TourPlayerProps {
  onDrillToTimeline: () => void;
  onDrillToDecisions: () => void;
}

export function TourPlayer({
  onDrillToTimeline,
  onDrillToDecisions,
}: TourPlayerProps) {
  const activeTourId = useTourStore((state) => state.activeTourId);
  const chapterIndex = useTourStore((state) => state.chapterIndex);
  const stopIndex = useTourStore((state) => state.stopIndex);
  const advanceStop = useTourStore((state) => state.advanceStop);
  const retreatStop = useTourStore((state) => state.retreatStop);
  const markStopComplete = useTourStore((state) => state.markStopComplete);

  const query = useQuery({
    queryKey: activeTourId ? tours.detail(activeTourId) : ["tours", "detail", "none"],
    queryFn: () => fetchTour(activeTourId!),
    enabled: Boolean(activeTourId),
    staleTime: 60_000,
  });

  if (!activeTourId) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
        Select a tour from the picker to begin.
      </p>
    );
  }

  if (query.isLoading) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
        Loading tour…
      </p>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p
        className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-6 text-sm text-red-200"
        role="alert"
      >
        Failed to load tour detail.
      </p>
    );
  }

  const tour = query.data;
  const chapters = tour.chapters;
  const chapterBounds = chapters.map((item) => ({ stops: item.stops }));
  const chapter = chapters[chapterIndex];
  const stop = chapter?.stops[stopIndex];

  if (!chapter || !stop) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-6 text-sm text-slate-400">
        Tour progress is out of range. Select a chapter to continue.
      </p>
    );
  }

  const isFirstStop = chapterIndex === 0 && stopIndex === 0;
  const isLastStop =
    chapterIndex === chapters.length - 1 &&
    stopIndex === chapter.stops.length - 1;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
        <h1 className="text-base font-medium text-slate-100">{tour.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{tour.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          Chapter {chapterIndex + 1} of {chapters.length} · Stop {stopIndex + 1} of{" "}
          {chapter.stops.length}
        </p>
      </header>

      <TourStopCard
        stop={stop}
        chapterTitle={chapter.title}
        onDrillToTimeline={onDrillToTimeline}
        onDrillToDecisions={onDrillToDecisions}
      />

      <nav
        aria-label="Tour stop navigation"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={() => retreatStop(chapterBounds)}
          disabled={isFirstStop}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous stop
        </button>
        <button
          type="button"
          onClick={() => {
            markStopComplete(stop.id);
            advanceStop(chapterBounds);
          }}
          disabled={isLastStop}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next stop
        </button>
      </nav>
    </div>
  );
}
