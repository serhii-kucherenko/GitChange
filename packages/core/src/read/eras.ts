import { existsSync } from "node:fs";
import { join } from "node:path";
import { and, count, gte, lte } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readManifest } from "../schema/manifest.js";
import type { EraClaim, InflectionPoint, NamedEra } from "../schema/zod/eras.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import * as schema from "../schema/drizzle/schema.js";

export interface DashboardEra {
  id: string;
  name: string;
  summary: string;
  startCommitSha: string;
  endCommitSha: string;
  startAt: number;
  endAt: number;
  inflections: InflectionPoint[];
  claims: EraClaim[];
  commitCountInWindow: number;
}

export interface DashboardErasResult {
  eras: DashboardEra[];
}

function countCommitsInWindow(
  gitchangeDir: string,
  startAt: number,
  endAt: number,
): number {
  const db = openDb(gitchangeDir);
  const row = db
    .select({ total: count() })
    .from(schema.commits)
    .where(
      and(
        gte(schema.commits.committedAt, startAt),
        lte(schema.commits.committedAt, endAt),
      ),
    )
    .get();

  return row?.total ?? 0;
}

function toDashboardEra(
  gitchangeDir: string,
  era: NamedEra,
): DashboardEra {
  return {
    id: era.id,
    name: era.name,
    summary: era.summary,
    startCommitSha: era.startCommitSha,
    endCommitSha: era.endCommitSha,
    startAt: era.startAt,
    endAt: era.endAt,
    inflections: era.inflections,
    claims: era.claims,
    commitCountInWindow: countCommitsInWindow(
      gitchangeDir,
      era.startAt,
      era.endAt,
    ),
  };
}

export function listErasForDashboard(
  gitchangeDir: string,
): DashboardErasResult | null {
  if (
    !existsSync(join(gitchangeDir, "index.sqlite")) ||
    !readManifest(gitchangeDir)
  ) {
    return null;
  }

  const artifact = readErasArtifact(gitchangeDir);
  if (!artifact || artifact.eras.length === 0) {
    return null;
  }

  return {
    eras: artifact.eras.map((era) => toDashboardEra(gitchangeDir, era)),
  };
}
