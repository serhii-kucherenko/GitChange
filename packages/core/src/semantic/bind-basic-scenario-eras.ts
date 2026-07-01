import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  ErasArtifact,
  type ErasArtifact as ErasArtifactType,
} from "../schema/zod/eras.js";
import { IntelligenceArtifact } from "../schema/zod/intelligence.js";
import { writeErasArtifact } from "./eras-io.js";

export function bindBasicScenarioErasTemplate(
  template: ErasArtifactType,
  gitchangeDir: string,
): ErasArtifactType {
  const db = openDb(gitchangeDir);
  const commits = db
    .select()
    .from(schema.commits)
    .orderBy(schema.commits.committedAt)
    .all();

  if (commits.length < 2) {
    throw new Error("BASIC_SCENARIO index must contain at least two commits");
  }

  const intelligencePath = join(gitchangeDir, "intelligence.json");
  const intelligence = IntelligenceArtifact.parse(
    JSON.parse(readFileSync(intelligencePath, "utf-8")),
  );
  const signals = intelligence.eraSignals.boundaries;

  const mainTouch = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.path, "src/main.ts"))
    .all()[0];

  const readmeTouch = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.path, "README.md"))
    .all()[0];

  if (!mainTouch) {
    throw new Error("BASIC_SCENARIO index missing src/main.ts touch");
  }

  const first = commits[0]!;
  const mid = commits[Math.floor(commits.length / 2)]!;
  const last = commits[commits.length - 1]!;
  const signalIds = signals.map((signal) => signal.id);

  const eras = template.eras.map((era, index) => {
    const isFirstEra = index === 0;
    const startCommit = isFirstEra ? first : mid;
    const endCommit = isFirstEra ? mid : last;
    const eraSignalId = signalIds[index] ?? signalIds[0]!;

    return {
      ...era,
      startCommitSha: startCommit.sha,
      endCommitSha: endCommit.sha,
      startAt: startCommit.committedAt,
      endAt: endCommit.committedAt,
      signalIds: [eraSignalId],
      inflections: era.inflections.map((inflection) => ({
        ...inflection,
        evidence: inflection.evidence.map((item) => {
          if (item.type === "file") {
            return {
              type: "file" as const,
              path: mainTouch.path,
              commitSha: mainTouch.commitSha,
            };
          }
          if (item.type === "doc" && readmeTouch) {
            return {
              type: "doc" as const,
              path: readmeTouch.path,
              commitSha: readmeTouch.commitSha,
              excerpt: item.excerpt,
            };
          }
          if (item.type === "commit") {
            return { type: "commit" as const, sha: startCommit.sha };
          }
          return item;
        }),
      })),
      claims: era.claims.map((claim) => ({
        ...claim,
        evidence: claim.evidence.map((item) =>
          item.type === "commit"
            ? { type: "commit" as const, sha: startCommit.sha }
            : item,
        ),
      })),
      evidence: era.evidence.map((item) => {
        if (item.type === "commit") {
          return { type: "commit" as const, sha: startCommit.sha };
        }
        if (item.type === "file") {
          return {
            type: "file" as const,
            path: mainTouch.path,
            commitSha: mainTouch.commitSha,
          };
        }
        if (item.type === "doc" && readmeTouch) {
          return {
            type: "doc" as const,
            path: readmeTouch.path,
            commitSha: readmeTouch.commitSha,
            excerpt: item.excerpt,
          };
        }
        return item;
      }),
    };
  });

  return ErasArtifact.parse({
    ...template,
    headSha: last.sha,
    sourceSignalCount: signals.length,
    eras,
  });
}

export function applyBasicScenarioErasTemplate(
  gitchangeDir: string,
  template: ErasArtifactType,
): void {
  writeErasArtifact(
    gitchangeDir,
    bindBasicScenarioErasTemplate(template, gitchangeDir),
  );
}
