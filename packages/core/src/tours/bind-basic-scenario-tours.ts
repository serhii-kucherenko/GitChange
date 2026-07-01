import { eq } from "drizzle-orm";
import { openDb } from "../artifacts/db.js";
import { readDecisionsArtifact } from "../decisions/decisions-io.js";
import { assertNever } from "../schema/manifest.js";
import * as schema from "../schema/drizzle/schema.js";
import type { Evidence } from "../schema/zod/evidence.js";
import {
  ToursArtifact,
  type TourChapter,
  type TourStop,
  type ToursArtifact as ToursArtifactType,
} from "../schema/zod/tours.js";
import { readErasArtifact } from "../semantic/eras-io.js";
import { outlineDefaultTourChapters } from "./outline.js";
import { writeToursArtifact } from "./tours-io.js";

const PLACEHOLDER_FIRST = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PLACEHOLDER_MID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const PLACEHOLDER_LAST = "cccccccccccccccccccccccccccccccccccccccc";

function remapSha(
  sha: string,
  first: string,
  mid: string,
  last: string,
): string {
  if (sha === PLACEHOLDER_FIRST) {
    return first;
  }
  if (sha === PLACEHOLDER_MID) {
    return mid;
  }
  if (sha === PLACEHOLDER_LAST) {
    return last;
  }
  return sha;
}

function bindEvidence(
  evidence: Evidence,
  first: string,
  mid: string,
  last: string,
  mainTouch: { path: string; commitSha: string } | undefined,
  readmeTouch: { path: string; commitSha: string } | undefined,
  featureTouch: { path: string; commitSha: string } | undefined,
): Evidence {
  switch (evidence.type) {
    case "commit":
      return {
        type: "commit",
        sha: remapSha(evidence.sha, first, mid, last),
      };
    case "file":
      return {
        type: "file",
        path:
          evidence.path === "src/main.ts" && mainTouch
            ? mainTouch.path
            : evidence.path === "src/feature.ts" && featureTouch
              ? featureTouch.path
              : evidence.path,
        commitSha: remapSha(evidence.commitSha, first, mid, last),
      };
    case "doc":
      return {
        type: "doc",
        path:
          evidence.path === "README.md" && readmeTouch
            ? readmeTouch.path
            : evidence.path,
        commitSha: remapSha(evidence.commitSha, first, mid, last),
        excerpt: evidence.excerpt,
      };
    case "hunk":
      return {
        type: "hunk",
        path: evidence.path,
        commitSha: remapSha(evidence.commitSha, first, mid, last),
        hunkId: evidence.hunkId,
      };
    case "interview":
      return evidence;
    default:
      assertNever(evidence);
  }
}

function bindStop(
  stop: TourStop,
  first: string,
  mid: string,
  last: string,
  mainTouch: { path: string; commitSha: string } | undefined,
  readmeTouch: { path: string; commitSha: string } | undefined,
  featureTouch: { path: string; commitSha: string } | undefined,
  validDecisionIds: Set<string>,
): TourStop {
  const drillTarget = { ...stop.drillTarget };

  if (drillTarget.commitSha) {
    drillTarget.commitSha = remapSha(drillTarget.commitSha, first, mid, last);
  }

  if (drillTarget.filePath === "src/main.ts" && mainTouch) {
    drillTarget.filePath = mainTouch.path;
    drillTarget.commitSha ??= mainTouch.commitSha;
  }

  if (
    drillTarget.decisionId &&
    !validDecisionIds.has(drillTarget.decisionId)
  ) {
    const fallback = [...validDecisionIds][0];
    if (fallback) {
      drillTarget.decisionId = fallback;
    }
  }

  return {
    ...stop,
    evidence: stop.evidence.map((item) =>
      bindEvidence(item, first, mid, last, mainTouch, readmeTouch, featureTouch),
    ),
    drillTarget,
  };
}

function overlayOutlineChapters(
  outlineChapters: TourChapter[],
  templateChapters: TourChapter[],
  first: string,
  mid: string,
  last: string,
  mainTouch: { path: string; commitSha: string } | undefined,
  readmeTouch: { path: string; commitSha: string } | undefined,
  featureTouch: { path: string; commitSha: string } | undefined,
  validDecisionIds: Set<string>,
): TourChapter[] {
  return outlineChapters.map((outlineChapter, index) => {
    const templateChapter =
      templateChapters.find((chapter) => chapter.order === outlineChapter.order) ??
      templateChapters[index];

    if (!templateChapter) {
      return outlineChapter;
    }

    return {
      order: outlineChapter.order,
      eraIds: outlineChapter.eraIds,
      title: templateChapter.title,
      summary: templateChapter.summary,
      stops: templateChapter.stops.map((stop) =>
        bindStop(
          stop,
          first,
          mid,
          last,
          mainTouch,
          readmeTouch,
          featureTouch,
          validDecisionIds,
        ),
      ),
    };
  });
}

function bindTourChapters(
  chapters: TourChapter[],
  first: string,
  mid: string,
  last: string,
  mainTouch: { path: string; commitSha: string } | undefined,
  readmeTouch: { path: string; commitSha: string } | undefined,
  featureTouch: { path: string; commitSha: string } | undefined,
  validDecisionIds: Set<string>,
): TourChapter[] {
  return chapters.map((chapter) => ({
    ...chapter,
    stops: chapter.stops.map((stop) =>
      bindStop(
        stop,
        first,
        mid,
        last,
        mainTouch,
        readmeTouch,
        featureTouch,
        validDecisionIds,
      ),
    ),
  }));
}

export function bindBasicScenarioToursTemplate(
  template: ToursArtifactType,
  gitchangeDir: string,
): ToursArtifactType {
  const eras = readErasArtifact(gitchangeDir);
  if (!eras) {
    throw new Error("eras.json required to bind BASIC_SCENARIO tours fixture");
  }

  const decisions = readDecisionsArtifact(gitchangeDir);
  const validDecisionIds = new Set(
    (decisions?.decisions ?? []).map((decision) => decision.id),
  );

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
  const mid = commits[Math.floor(commits.length / 2)]!;
  const last = commits[commits.length - 1]!;

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
    .all()
    .at(-1);

  const featureTouch = db
    .select({
      path: schema.fileChanges.path,
      commitSha: schema.fileChanges.commitSha,
    })
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.path, "src/feature.ts"))
    .all()
    .at(-1);

  const outlineChapters = outlineDefaultTourChapters(eras);
  const templateDefault = template.tours.find((tour) => tour.kind === "default");

  const tours = template.tours.map((tour) => {
    if (tour.kind === "default" && templateDefault) {
      return {
        ...tour,
        chapters: overlayOutlineChapters(
          outlineChapters,
          templateDefault.chapters,
          first.sha,
          mid.sha,
          last.sha,
          mainTouch,
          readmeTouch,
          featureTouch,
          validDecisionIds,
        ),
      };
    }

    return {
      ...tour,
      chapters: bindTourChapters(
        tour.chapters,
        first.sha,
        mid.sha,
        last.sha,
        mainTouch,
        readmeTouch,
        featureTouch,
        validDecisionIds,
      ),
    };
  });

  return ToursArtifact.parse({
    ...template,
    headSha: last.sha,
    tours,
  });
}

export function applyBasicScenarioToursTemplate(
  gitchangeDir: string,
  template: ToursArtifactType,
): void {
  writeToursArtifact(
    gitchangeDir,
    bindBasicScenarioToursTemplate(template, gitchangeDir),
  );
}
