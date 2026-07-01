import { z } from "zod";
import { Evidence } from "./evidence.js";

export const TOURS_SCHEMA_VERSION = "1";

export const TourKind = z.enum(["default", "role", "topic"]);

export type TourKind = z.infer<typeof TourKind>;

export const RoleTag = z.enum(["backend", "frontend", "fullstack", "maintainer"]);

export type RoleTag = z.infer<typeof RoleTag>;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function assertTourKind(value: TourKind): void {
  switch (value) {
    case "default":
    case "role":
    case "topic":
      return;
    default:
      assertNever(value);
  }
}

export const DrillTarget = z
  .object({
    eraId: z.string().min(1).optional(),
    commitSha: z.string().length(40).optional(),
    filePath: z.string().min(1).optional(),
    decisionId: z.string().min(1).optional(),
  })
  .refine(
    (target) =>
      Boolean(
        target.eraId ?? target.commitSha ?? target.filePath ?? target.decisionId,
      ),
    {
      message:
        "drillTarget requires at least one of eraId, commitSha, filePath, decisionId",
    },
  );

export type DrillTarget = z.infer<typeof DrillTarget>;

export const TourStop = z.object({
  id: z.string().min(1),
  narrative: z.string().max(400),
  evidence: z.array(Evidence).min(1),
  drillTarget: DrillTarget,
  repoId: z.string().min(1).optional(),
});

export type TourStop = z.infer<typeof TourStop>;

export const TourChapter = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().max(300),
  eraIds: z.array(z.string().min(1)).min(1),
  stops: z.array(TourStop).min(1),
});

export type TourChapter = z.infer<typeof TourChapter>;

const TourBase = z.object({
  id: z.string().startsWith("tour:"),
  title: z.string().min(1),
  description: z.string().min(1),
  chapters: z.array(TourChapter).min(1),
});

export const Tour = z.discriminatedUnion("kind", [
  TourBase.extend({
    kind: z.literal("default"),
    chapters: z.array(TourChapter).min(4).max(6),
  }),
  TourBase.extend({
    kind: z.literal("role"),
    roleTag: RoleTag,
  }),
  TourBase.extend({
    kind: z.literal("topic"),
    topicKey: z.string().min(1),
    chapters: z
      .array(TourChapter)
      .refine(
        (chapters) =>
          chapters.reduce((total, chapter) => total + chapter.stops.length, 0) <=
          8,
        { message: "topic tour exceeds maximum of 8 stops" },
      ),
  }),
]);

export type Tour = z.infer<typeof Tour>;

const MAX_DEFAULT_TOURS = 1;
const MAX_ROLE_TOURS = 3;
const MAX_TOPIC_TOURS = 5;

function countToursByKind(tours: Tour[]): Record<TourKind, number> {
  const counts: Record<TourKind, number> = {
    default: 0,
    role: 0,
    topic: 0,
  };

  for (const tour of tours) {
    counts[tour.kind] += 1;
  }

  return counts;
}

export const ToursArtifact = z
  .object({
    schemaVersion: z.literal(TOURS_SCHEMA_VERSION),
    computedAt: z.string(),
    headSha: z.string().length(40),
    defaultTourId: z.string().startsWith("tour:"),
    tours: z.array(Tour),
  })
  .superRefine((artifact, context) => {
    const counts = countToursByKind(artifact.tours);

    if (counts.default > MAX_DEFAULT_TOURS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `at most ${MAX_DEFAULT_TOURS} default tour allowed`,
        path: ["tours"],
      });
    }

    if (counts.role > MAX_ROLE_TOURS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `at most ${MAX_ROLE_TOURS} role tours allowed`,
        path: ["tours"],
      });
    }

    if (counts.topic > MAX_TOPIC_TOURS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `at most ${MAX_TOPIC_TOURS} topic tours allowed`,
        path: ["tours"],
      });
    }

    if (!artifact.tours.some((tour) => tour.id === artifact.defaultTourId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultTourId must reference a tour in tours",
        path: ["defaultTourId"],
      });
    }

    const defaultTour = artifact.tours.find((tour) => tour.kind === "default");
    if (defaultTour && defaultTour.id !== artifact.defaultTourId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultTourId must match the default kind tour id",
        path: ["defaultTourId"],
      });
    }
  });

export type ToursArtifact = z.infer<typeof ToursArtifact>;

export const TOURS_CAPS = {
  maxDefaultTours: MAX_DEFAULT_TOURS,
  maxRoleTours: MAX_ROLE_TOURS,
  maxTopicTours: MAX_TOPIC_TOURS,
  defaultChapterMin: 4,
  defaultChapterMax: 6,
  topicStopMax: 8,
} as const;
