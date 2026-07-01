import type { SnapshotResponse } from "../types.js";

interface RepoSnapshotProps {
  stats: SnapshotResponse["stats"];
  highlights: SnapshotResponse["highlights"];
  intelligence: SnapshotResponse["intelligence"];
}

export function RepoSnapshot({
  stats,
  highlights,
  intelligence,
}: RepoSnapshotProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
        <h2 className="mb-4 text-lg font-medium text-slate-100">
          Repository snapshot
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Commits
            </dt>
            <dd className="text-2xl font-semibold text-slate-100">
              {stats.commitCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              File changes
            </dt>
            <dd className="text-2xl font-semibold text-slate-100">
              {stats.fileChangeCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Authors
            </dt>
            <dd className="text-2xl font-semibold text-slate-100">
              {stats.authorCount}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
            Top churn files
          </h3>
          {highlights.topChurnFiles.length === 0 ? (
            <p className="text-sm text-slate-500">No churn data yet.</p>
          ) : (
            <ul className="space-y-2">
              {highlights.topChurnFiles.map((file) => (
                <li
                  key={file.path}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-mono text-slate-200">
                    {file.path}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    {file.changeCount} changes
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
            Expertise topics
          </h3>
          {highlights.topExpertiseTopics.length === 0 ? (
            <p className="text-sm text-slate-500">No expertise topics yet.</p>
          ) : (
            <ul className="space-y-2">
              {highlights.topExpertiseTopics.map((topic) => (
                <li key={topic.topic} className="text-sm text-slate-200">
                  Ask <span className="text-slate-100">{topic.label}</span>{" "}
                  about{" "}
                  <span className="font-mono text-slate-300">
                    {topic.topic}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {intelligence ? (
        <p className="text-xs text-slate-500">
          Intelligence artifact loaded for dashboard highlights.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Intelligence not computed yet — run index with intelligence enabled.
        </p>
      )}
    </section>
  );
}
