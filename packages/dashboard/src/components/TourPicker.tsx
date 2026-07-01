import { useQuery } from "@tanstack/react-query";
import { fetchTours, tours } from "../api/client.js";
import { useTourStore } from "../store/tour.js";
import type { TourKind, TourRoleTag, TourSummary } from "../types.js";

const ROLE_LABELS: Record<TourRoleTag, string> = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Full stack",
  maintainer: "Maintainer",
};

const KIND_SECTIONS: Array<{ kind: TourKind; title: string }> = [
  { kind: "default", title: "Onboarding" },
  { kind: "role", title: "Role variants" },
  { kind: "topic", title: "Topic threads" },
];

function tourSubtitle(tour: TourSummary): string {
  if (tour.kind === "role" && tour.roleTag) {
    return ROLE_LABELS[tour.roleTag];
  }
  if (tour.kind === "topic" && tour.topicKey) {
    return tour.topicKey;
  }
  return `${tour.chapterCount} chapters`;
}

function TourGroup({
  title,
  items,
  defaultTourId,
  activeTourId,
  onSelect,
}: {
  title: string;
  items: TourSummary[];
  defaultTourId: string | null;
  activeTourId: string | null;
  onSelect: (tourId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((tour) => {
          const isDefault = tour.id === defaultTourId;
          const isActive = tour.id === activeTourId;

          return (
            <li key={tour.id}>
              <button
                type="button"
                onClick={() => onSelect(tour.id)}
                className={`flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "border-sky-700/60 bg-sky-950/40 text-sky-100"
                    : "border-slate-800 bg-slate-950/40 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                }`}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {tour.title}
                  {isDefault ? (
                    <span className="rounded-full border border-emerald-700/60 bg-emerald-950/50 px-1.5 py-0 text-[10px] font-semibold uppercase text-emerald-200">
                      Default
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-slate-500">{tourSubtitle(tour)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TourPicker() {
  const activeTourId = useTourStore((state) => state.activeTourId);
  const setActiveTour = useTourStore((state) => state.setActiveTour);

  const query = useQuery({
    queryKey: tours.list,
    queryFn: fetchTours,
    staleTime: 60_000,
    retry: false,
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading tours…</p>
      </section>
    );
  }

  if (query.isError) {
    const message =
      query.error instanceof Error && query.error.message === "tours_not_found"
        ? "Guided tours are not available yet. Run /gitchange tour synthesis in your AI chat to generate tours for this repo."
        : "Failed to load tours.";

    return (
      <section
        className="rounded-lg border border-slate-700 bg-slate-900 p-4"
        role="alert"
      >
        <h2 className="text-sm font-medium text-slate-200">Tours</h2>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
      </section>
    );
  }

  const page = query.data;
  if (!page || page.tours.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-200">Tours</h2>
        <p className="mt-2 text-sm text-slate-400">
          No tours found. Run /gitchange tour synthesis in your AI chat to
          generate guided tours.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-200">Pick a tour</h2>
      <div className="space-y-4">
        {KIND_SECTIONS.map((section) => (
          <TourGroup
            key={section.kind}
            title={section.title}
            items={page.tours.filter((tour) => tour.kind === section.kind)}
            defaultTourId={page.defaultTourId}
            activeTourId={activeTourId}
            onSelect={setActiveTour}
          />
        ))}
      </div>
    </section>
  );
}
