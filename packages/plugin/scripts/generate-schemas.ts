import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  DecisionsArtifact,
  ErasArtifact,
  EVD03_GAP_MESSAGE,
  Evidence,
  IntelligenceArtifact,
  InterviewRecord,
  ManifestSchema,
  TourChapter,
  ToursArtifact,
} from "@gitchange/core";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS_DIR = join(PLUGIN_ROOT, "schemas");

const SnapshotStatsSchema = z.object({
  commitCount: z.number().int().nonnegative(),
  fileChangeCount: z.number().int().nonnegative(),
  authorCount: z.number().int().nonnegative(),
});

const SnapshotHighlightsSchema = z.object({
  topChurnFiles: z.array(
    z.object({
      path: z.string(),
      changeCount: z.number().int().nonnegative(),
    }),
  ),
  topExpertiseTopics: z.array(
    z.object({
      topic: z.string(),
      label: z.string(),
    }),
  ),
});

const SnapshotErasSummarySchema = z.object({
  eraCount: z.number().int().nonnegative(),
  inflectionCount: z.number().int().nonnegative(),
  eras: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      inflectionTypes: z.array(
        z.enum([
          "tech_pivot",
          "scope_steering",
          "process_shift",
          "team_ownership_change",
        ]),
      ),
    }),
  ),
});

const SnapshotResponseSchema = z.object({
  manifest: ManifestSchema,
  stats: SnapshotStatsSchema,
  intelligence: IntelligenceArtifact.nullable(),
  highlights: SnapshotHighlightsSchema,
  erasSummary: SnapshotErasSummarySchema.nullable(),
});

const IntelligenceSummarySchema = IntelligenceArtifact.pick({
  schemaVersion: true,
  computedAt: true,
  headSha: true,
  attributionConfidence: true,
  churn: true,
  expertise: true,
});

const EraSynthesisEraSignalSchema = z.object({
  signalId: z.number().int(),
  signalType: z.string(),
  score: z.number(),
  startCommitSha: z.string().length(40),
  endCommitSha: z.string().length(40),
  startAt: z.number().int(),
  endAt: z.number().int(),
});

const EraSynthesisChurnFileSchema = z.object({
  path: z.string(),
  changeCount: z.number().int().nonnegative(),
  insertions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  lastTouchedAt: z.number().int(),
});

const EraSynthesisDocDeltaSchema = z.object({
  path: z.string(),
  commitSha: z.string().length(40),
  excerpt: z.string().max(500),
});

const ManifestWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const EraSynthesisContextSchema = z.object({
  eraSignals: z.array(EraSynthesisEraSignalSchema),
  topChurnFiles: z.array(EraSynthesisChurnFileSchema),
  docDeltas: z.array(EraSynthesisDocDeltaSchema),
  eraOwnership: IntelligenceArtifact.shape.eraOwnership,
  expertiseTopics: z.array(IntelligenceArtifact.shape.expertise.shape.topics.element),
  manifestWarnings: z.array(ManifestWarningSchema),
  attributionConfidence: IntelligenceArtifact.shape.attributionConfidence,
});

type JsonRecord = Record<string, unknown>;

function stripSchemaEnvelope(schema: JsonRecord): JsonRecord {
  const { $schema: _schema, $id: _id, title: _title, description: _description, ...rest } =
    schema;
  return rest;
}

function writeSchema(
  filename: string,
  schema: z.ZodType,
  meta?: { title?: string; description?: string },
): JsonRecord {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
  }) as JsonRecord;

  const output: JsonRecord = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://gitchange.dev/schemas/${filename}`,
    ...meta,
    ...generated,
  };

  writeFileSync(
    join(SCHEMAS_DIR, filename),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  return output;
}

function writeSnapshotSchema(
  manifestSchema: JsonRecord,
  intelligenceSchema: JsonRecord,
): void {
  const snapshotGenerated = z.toJSONSchema(SnapshotResponseSchema, {
    target: "draft-2020-12",
  }) as JsonRecord;

  const snapshot: JsonRecord = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://gitchange.dev/schemas/snapshot.schema.json",
    title: "GitChangeSnapshotResponse",
    description:
      "GET /api/snapshot response shape for host-AI tool registration.",
    type: "object",
    additionalProperties: false,
    required: ["manifest", "stats", "intelligence", "highlights", "erasSummary"],
    properties: {
      manifest: { $ref: "#/$defs/manifest" },
      stats: (snapshotGenerated.properties as JsonRecord).stats,
      intelligence: {
        oneOf: [{ type: "null" }, { $ref: "#/$defs/intelligence" }],
      },
      highlights: (snapshotGenerated.properties as JsonRecord).highlights,
      erasSummary: {
        oneOf: [
          { type: "null" },
          { $ref: "https://gitchange.dev/schemas/eras-summary.schema.json" },
        ],
      },
    },
    $defs: {
      manifest: stripSchemaEnvelope(manifestSchema),
      intelligence: stripSchemaEnvelope(intelligenceSchema),
    },
  };

  writeFileSync(
    join(SCHEMAS_DIR, "snapshot.schema.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
}

mkdirSync(SCHEMAS_DIR, { recursive: true });

const manifestSchema = writeSchema("manifest.schema.json", ManifestSchema, {
  title: "GitChangeManifest",
});

writeSchema("intelligence-summary.schema.json", IntelligenceSummarySchema, {
  title: "GitChangeIntelligenceSummary",
  description:
    "Trimmed intelligence artifact for host-AI chat context (churn + expertise only).",
});

const intelligenceSchema = writeSchema(
  "intelligence-full.schema.json",
  IntelligenceArtifact,
  {
    title: "GitChangeIntelligenceArtifact",
  },
);

writeSnapshotSchema(manifestSchema, intelligenceSchema);

writeSchema("era-synthesis-context.schema.json", EraSynthesisContextSchema, {
  title: "GitChangeEraSynthesisContext",
  description:
    "Bounded input for host-AI era synthesis from intelligence.json and doc snapshots.",
});

writeSchema("eras.schema.json", ErasArtifact, {
  title: "GitChangeErasArtifact",
  description: "Named eras with claims, inflections, and evidence bundles.",
});

writeSchema("eras-summary.schema.json", SnapshotErasSummarySchema, {
  title: "GitChangeErasSummary",
  description:
    "Bounded era highlights for snapshot API and host-AI presentation.",
});

const DecisionCandidateSchema = z.object({
  candidateId: z.string().min(1),
  title: z.string().min(1),
  seedEvidence: z.array(Evidence).min(1),
  relatedPaths: z.array(z.string()),
  sourceSignals: z.array(z.string()).min(1),
});

const DecisionMiningEraSummarySchema = z.object({
  name: z.string(),
  summary: z.string(),
  inflectionTypes: z.array(
    z.enum([
      "tech_pivot",
      "scope_steering",
      "process_shift",
      "team_ownership_change",
    ]),
  ),
});

const DecisionMiningContextSchema = z.object({
  candidates: z.array(DecisionCandidateSchema).max(30),
  erasSummary: z
    .object({
      eraCount: z.number().int().nonnegative(),
      inflectionCount: z.number().int().nonnegative(),
      eras: z.array(DecisionMiningEraSummarySchema),
    })
    .nullable(),
  topChurnFiles: z.array(EraSynthesisChurnFileSchema),
  docDeltas: z.array(EraSynthesisDocDeltaSchema),
  expertiseTopics: z.array(IntelligenceArtifact.shape.expertise.shape.topics.element),
  manifestWarnings: z.array(ManifestWarningSchema),
  attributionConfidence: IntelligenceArtifact.shape.attributionConfidence,
});

writeSchema("decision-mining-context.schema.json", DecisionMiningContextSchema, {
  title: "GitChangeDecisionMiningContext",
  description:
    "Bounded input for host-AI decision mining from intelligence.json and indexed SQLite.",
});

writeSchema("decisions.schema.json", DecisionsArtifact, {
  title: "GitChangeDecisionsArtifact",
  description:
    "Past decisions and migrations with status, evidence, supersession, and attribution.",
});

writeSchema("interview-record.schema.json", InterviewRecord, {
  title: "GitChangeInterviewRecord",
  description:
    "Maintainer interview answer persisted under .gitchange/interviews/ for DEC-03/DEC-04.",
});

const StatusQueryResponseSchema = z.object({
  query: z.string().min(1),
  answer: z.string().optional(),
  gap: z.literal(EVD03_GAP_MESSAGE).optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(Evidence),
  relatedThreads: z.array(z.string().startsWith("thread:")),
  relatedDecisions: z.array(z.string().startsWith("decision:")),
});

writeSchema("status-query-response.schema.json", StatusQueryResponseSchema, {
  title: "GitChangeStatusQueryResponse",
  description:
    "Host-AI response shape for migration progress and in-flight status queries (STAT-04).",
});

const TourEraSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  summary: z.string(),
  window: z.object({
    startAt: z.number().int(),
    endAt: z.number().int(),
  }),
});

const TourExpertiseTopicSchema = z.object({
  topic: z.string(),
  topPaths: z.array(z.string()),
});

const TourDecisionSeedSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: z.string(),
  confidence: z.number(),
});

const TourOpenWorkSeedSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: z.string(),
  relatedPaths: z.array(z.string()),
});

const TourRolePathHintsSchema = z.object({
  backend: z.array(z.string()),
  frontend: z.array(z.string()),
});

const TourSynthesisContextSchema = z.object({
  eraSummaries: z.array(TourEraSummarySchema),
  outlineChapters: z.array(TourChapter),
  expertiseTopics: z.array(TourExpertiseTopicSchema),
  decisionSeeds: z.array(TourDecisionSeedSchema),
  openWorkSeeds: z.array(TourOpenWorkSeedSchema),
  rolePathHints: TourRolePathHintsSchema,
  headSha: z.string().length(40),
  capsReminder: z.object({
    maxDefaultTours: z.number().int(),
    maxRoleTours: z.number().int(),
    maxTopicTours: z.number().int(),
    defaultChapterMin: z.number().int(),
    defaultChapterMax: z.number().int(),
    topicStopMax: z.number().int(),
  }),
});

writeSchema("tour-synthesis-context.schema.json", TourSynthesisContextSchema, {
  title: "GitChangeTourSynthesisContext",
  description:
    "Bounded input for host-AI tour synthesis from eras, decisions, open-work, and intelligence.",
});

writeSchema("tours.schema.json", ToursArtifact, {
  title: "GitChangeToursArtifact",
  description:
    "Guided tours: default onboarding, role variants, and topic-thread tours with evidence-backed stops.",
});

// Sanity: generated schemas round-trip through fromJSONSchema for manifest.
const manifestPath = join(SCHEMAS_DIR, "manifest.schema.json");
const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8")) as JsonRecord;
z.fromJSONSchema(manifestJson);

console.log("Wrote plugin JSON schemas to packages/plugin/schemas/");
