import { type FormEvent, useId, useState } from "react";
import { FileHistoryList } from "./FileHistoryList.js";

interface FileHistoryScrubberProps {
  pathSuggestions?: string[];
}

export function FileHistoryScrubber({
  pathSuggestions = [],
}: FileHistoryScrubberProps) {
  const inputId = useId();
  const listId = useId();
  const [inputValue, setInputValue] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    setActivePath(trimmed.length > 0 ? trimmed : null);
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-100">
        File history
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Browse indexed touch events for a file path, newest first.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-300" htmlFor={inputId}>
          File path
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="text"
            list={pathSuggestions.length > 0 ? listId : undefined}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="src/main.ts"
            className="min-h-[2rem] min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 transition-colors placeholder:text-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          />
          <button
            type="submit"
            className="min-h-[2rem] shrink-0 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Load
          </button>
        </div>
        {pathSuggestions.length > 0 ? (
          <datalist id={listId}>
            {pathSuggestions.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        ) : null}
      </form>

      {activePath ? (
        <div className="mt-4">
          <p className="mb-2 truncate font-mono text-xs text-slate-400">
            {activePath}
          </p>
          <FileHistoryList path={activePath} />
        </div>
      ) : null}
    </section>
  );
}
