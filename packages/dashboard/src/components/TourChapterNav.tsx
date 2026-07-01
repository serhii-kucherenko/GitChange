import { useTourStore } from "../store/tour.js";
import type { TourChapter } from "../types.js";

interface TourChapterNavProps {
  chapters: TourChapter[];
}

export function TourChapterNav({ chapters }: TourChapterNavProps) {
  const chapterIndex = useTourStore((state) => state.chapterIndex);
  const goToChapter = useTourStore((state) => state.goToChapter);

  if (chapters.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Tour chapters"
      className="rounded-lg border border-slate-700 bg-slate-900 p-4"
    >
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100">
        Chapters
      </h2>
      <ol className="mt-3 space-y-1">
        {chapters.map((chapter, index) => {
          const isActive = chapterIndex === index;

          return (
            <li key={`${chapter.order}-${chapter.title}`}>
              <button
                type="button"
                onClick={() => goToChapter(index)}
                className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  isActive
                    ? "bg-slate-800 text-slate-100 ring-1 ring-sky-500"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="font-medium">
                  {chapter.order}. {chapter.title}
                </span>
                <span className="text-xs text-slate-400">
                  {chapter.stops.length} stop
                  {chapter.stops.length === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
