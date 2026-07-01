import type { CommitDetailFile } from "../api/commit-detail.js";

interface FileHunkViewProps {
  file: CommitDetailFile;
}

export function FileHunkView({ file }: FileHunkViewProps) {
  if (file.contentIgnored) {
    return (
      <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
        Path ignored by privacy rules — diff content is not stored.
      </div>
    );
  }

  if (file.hunks.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
        {file.contentRedacted
          ? "Content redacted — no safe diff hunks available."
          : "No diff hunks captured for this file."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {file.contentRedacted ? (
        <p className="text-xs text-amber-300">
          Some content in this diff was redacted for privacy.
        </p>
      ) : null}

      {file.hunks.map((hunk) => (
        <section
          key={`${hunk.startLine}-${hunk.endLine}-${hunk.patch.slice(0, 24)}`}
          className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
        >
          <header className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500">
            Lines {hunk.startLine}–{hunk.endLine}
          </header>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-slate-200">
            {hunk.patch}
          </pre>
        </section>
      ))}
    </div>
  );
}
