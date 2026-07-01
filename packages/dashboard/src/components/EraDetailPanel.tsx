import { useQuery } from "@tanstack/react-query";
import { fetchEras } from "../api/client.js";
import { useDrillStore } from "../store/drill.js";
import { evidenceCountToLevel } from "../utils/confidence.js";
import { ConfidenceBadge } from "./ConfidenceBadge.js";

function formatInflectionType(type: string): string {
  return type.replaceAll("_", " ");
}

export function EraDetailPanel() {
  const selectedEra = useDrillStore((state) => state.selectedEra);

  const query = useQuery({
    queryKey: ["eras"],
    queryFn: fetchEras,
    staleTime: 60_000,
  });

  if (!selectedEra) {
    return null;
  }

  const era = query.data?.find((item) => item.id === selectedEra.id);

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Loading era details…</p>
      </section>
    );
  }

  if (!era) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-200">{selectedEra.name}</h2>
        <p className="mt-2 text-sm text-slate-400">Era details unavailable.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <header className="mb-3 border-b border-slate-800 pb-3">
        <h2 className="text-lg font-medium text-slate-100">{era.name}</h2>
        <p className="mt-1 text-sm text-slate-400">{era.summary}</p>
        <p className="mt-2 text-xs text-slate-500">
          {era.commitCountInWindow} commit
          {era.commitCountInWindow === 1 ? "" : "s"} in this era
        </p>
      </header>

      {era.inflections.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Inflections
          </h3>
          <ul className="space-y-2">
            {era.inflections.map((inflection) => (
              <li
                key={`${inflection.type}-${inflection.title}`}
                className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-200">
                    {inflection.title}
                  </p>
                  <ConfidenceBadge
                    level={evidenceCountToLevel(inflection.evidence.length)}
                  />
                </div>
                <p className="text-xs capitalize text-slate-500">
                  {formatInflectionType(inflection.type)}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {inflection.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {era.claims.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Claims
          </h3>
          <ul className="space-y-2">
            {era.claims.map((claim) => (
              <li
                key={claim.text}
                className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-slate-200">{claim.text}</p>
                  <ConfidenceBadge
                    level={evidenceCountToLevel(claim.evidence.length)}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {claim.evidence.length} evidence item
                  {claim.evidence.length === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
