import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  countActiveFilters,
  dateInputToAfterUnix,
  dateInputToBeforeUnix,
  type CommitListFilters,
} from "../api/client.js";
import { useDrillStore } from "../store/drill.js";

const EMPTY_FILTERS: CommitListFilters = {};

interface CommitFilterBarProps {
  filters: CommitListFilters;
  onChange: Dispatch<SetStateAction<CommitListFilters>>;
}

function filterInputClassName(): string {
  return "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
}

function labelClassName(): string {
  return "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";
}

export function CommitFilterBar({ filters, onChange }: CommitFilterBarProps) {
  const [authorInput, setAuthorInput] = useState(filters.author ?? "");
  const [pathInput, setPathInput] = useState(filters.path ?? "");
  const [qInput, setQInput] = useState(filters.q ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const clearDownstreamFromEra = useDrillStore(
    (state) => state.clearDownstreamFromEra,
  );
  const selectedEra = useDrillStore((state) => state.selectedEra);
  const clearEra = useDrillStore((state) => state.clearEra);

  useEffect(() => {
    setAuthorInput(filters.author ?? "");
    setPathInput(filters.path ?? "");
    setQInput(filters.q ?? "");
  }, [filters.author, filters.path, filters.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextAuthor = authorInput.trim() || undefined;
      onChange((previous) => {
        if (previous.author === nextAuthor) {
          return previous;
        }
        return { ...previous, author: nextAuthor };
      });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [authorInput, onChange]);

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const applyPath = (value: string) => {
    setPathInput(value);
    const nextPath = value.trim() || undefined;
    onChange((previous) => ({ ...previous, path: nextPath }));
  };

  const applyQ = (value: string) => {
    setQInput(value);
    const nextQ = value.trim() || undefined;
    onChange((previous) => ({ ...previous, q: nextQ }));
  };

  const applyDateFrom = (value: string) => {
    setDateFrom(value);
    onChange((previous) => ({
      ...previous,
      after: dateInputToAfterUnix(value),
    }));
  };

  const applyDateTo = (value: string) => {
    setDateTo(value);
    onChange((previous) => ({
      ...previous,
      before: dateInputToBeforeUnix(value),
    }));
  };

  const clearAll = () => {
    setAuthorInput("");
    setPathInput("");
    setQInput("");
    setDateFrom("");
    setDateTo("");
    clearEra();
    clearDownstreamFromEra();
    onChange(EMPTY_FILTERS);
  };

  const clearEraOnly = () => {
    clearEra();
    clearDownstreamFromEra();
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-200">Filter commits</h2>
          {activeCount > 0 ? (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
              {activeCount} active
            </span>
          ) : null}
        </div>
        {activeCount > 0 || selectedEra ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {selectedEra ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-800 bg-sky-950/50 px-3 py-1 text-xs text-sky-200">
            Era: {selectedEra.name}
          </span>
          <button
            type="button"
            onClick={clearEraOnly}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Clear era
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="block">
          <span className={labelClassName()}>Author</span>
          <input
            type="search"
            value={authorInput}
            onChange={(event) => setAuthorInput(event.target.value)}
            placeholder="email or name"
            className={filterInputClassName()}
          />
        </label>

        <label className="block">
          <span className={labelClassName()}>Path prefix</span>
          <input
            type="search"
            value={pathInput}
            onChange={(event) => applyPath(event.target.value)}
            placeholder="src/"
            className={filterInputClassName()}
          />
        </label>

        <label className="block">
          <span className={labelClassName()}>Message</span>
          <input
            type="search"
            value={qInput}
            onChange={(event) => applyQ(event.target.value)}
            placeholder="keyword"
            className={filterInputClassName()}
          />
        </label>

        <label className="block">
          <span className={labelClassName()}>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => applyDateFrom(event.target.value)}
            className={filterInputClassName()}
          />
        </label>

        <label className="block">
          <span className={labelClassName()}>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => applyDateTo(event.target.value)}
            className={filterInputClassName()}
          />
        </label>
      </div>
    </section>
  );
}
