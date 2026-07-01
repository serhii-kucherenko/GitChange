import { eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import * as schema from "../schema/drizzle/schema.js";
import {
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
} from "../schema/zod/decisions.js";
import { writeDecisionsArtifact } from "./decisions-io.js";

export function bindBasicScenarioDecisionsTemplate(
  template: DecisionsArtifactType,
  gitchangeDir: string,
): DecisionsArtifactType {
  const db = openDb(gitchangeDir);
  const commits = db
    .select()
    .from(schema.commits)
    .orderBy(schema.commits.committedAt)
    .all();

  if (commits.length < 2) {
    throw new Error("BASIC_SCENARIO index must contain at least two commits");
  }

  const first = commits[0]!;
  const featureTouch = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.path, "src/feature.ts"))
    .all()
    .at(-1);

  const mainTouch = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.path, "src/main.ts"))
    .all()[0];

  const last = commits[commits.length - 1]!;

  const decisions = template.decisions.map((decision, index) => {
    const commitSha = index === 0 ? first.sha : (featureTouch?.commitSha ?? last.sha);

    return {
      ...decision,
      evidence: decision.evidence.map((item) => {
        if (item.type === "commit") {
          return { type: "commit" as const, sha: commitSha };
        }
        if (item.type === "file" && mainTouch) {
          return {
            type: "file" as const,
            path: mainTouch.path,
            commitSha: mainTouch.commitSha,
          };
        }
        return item;
      }),
      attribution: decision.attribution
        ? {
            ...decision.attribution,
            evidence: decision.attribution.evidence.map((item) =>
              item.type === "commit"
                ? { type: "commit" as const, sha: commitSha }
                : item,
            ),
          }
        : undefined,
      relatedPaths: decision.relatedPaths?.map((path) =>
        path === "src/feature.ts" && featureTouch
          ? featureTouch.path
          : path === "src/main.ts" && mainTouch
            ? mainTouch.path
            : path,
      ),
    };
  });

  return DecisionsArtifact.parse({
    ...template,
    headSha: last.sha,
    decisions,
  });
}

export function applyBasicScenarioDecisionsTemplate(
  gitchangeDir: string,
  template: DecisionsArtifactType,
): void {
  writeDecisionsArtifact(
    gitchangeDir,
    bindBasicScenarioDecisionsTemplate(template, gitchangeDir),
  );
}
