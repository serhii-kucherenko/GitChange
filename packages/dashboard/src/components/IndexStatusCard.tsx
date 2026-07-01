import { formatIndexCompleteness, formatWarningCode } from "../snapshot.js";
import type { Manifest } from "../types.js";

interface IndexStatusCardProps {
  manifest: Manifest;
}

function formatIndexedAt(indexedAt: string): string {
  const date = new Date(indexedAt);
  if (Number.isNaN(date.getTime())) {
    return indexedAt;
  }
  return date.toLocaleString();
}

export function IndexStatusCard({ manifest }: IndexStatusCardProps) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100">
        Index status
      </h2>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Core schema version
          </dt>
          <dd className="font-mono text-sm text-slate-200">
            {manifest.schemaVersion}
          </dd>
        </div>
        {manifest.semanticSchemaVersion ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Semantic schema version
            </dt>
            <dd className="font-mono text-sm text-slate-200">
              {manifest.semanticSchemaVersion}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Indexed at
          </dt>
          <dd className="text-sm text-slate-200">
            {formatIndexedAt(manifest.indexedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Last indexed commit
          </dt>
          <dd className="font-mono text-sm text-slate-200">
            {manifest.lastIndexedCommit.slice(0, 7)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Index completeness
          </dt>
          <dd className="text-sm text-slate-200">
            {formatIndexCompleteness(manifest.indexCompleteness)}
          </dd>
        </div>
        {manifest.intelligenceComputedAt ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Intelligence computed
            </dt>
            <dd className="text-sm text-slate-200">
              {formatIndexedAt(manifest.intelligenceComputedAt)}
            </dd>
          </div>
        ) : null}
        {manifest.semanticComputedAt ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Semantic computed
            </dt>
            <dd className="text-sm text-slate-200">
              {formatIndexedAt(manifest.semanticComputedAt)}
            </dd>
          </div>
        ) : null}
        {manifest.intelligenceSchemaVersion ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Intelligence schema
            </dt>
            <dd className="font-mono text-sm text-slate-200">
              {manifest.intelligenceSchemaVersion}
            </dd>
          </div>
        ) : null}
      </dl>

      {manifest.warnings.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {manifest.warnings.map((warning) => (
            <span
              key={`${warning.code}-${warning.message}`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200"
              title={warning.message}
            >
              {formatWarningCode(warning.code)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
