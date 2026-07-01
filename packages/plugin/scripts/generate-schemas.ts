import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { IntelligenceArtifact, ManifestSchema } from "@gitchange/core";

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

const SnapshotResponseSchema = z.object({
  manifest: ManifestSchema,
  stats: SnapshotStatsSchema,
  intelligence: IntelligenceArtifact.nullable(),
  highlights: SnapshotHighlightsSchema,
});

const IntelligenceSummarySchema = IntelligenceArtifact.pick({
  schemaVersion: true,
  computedAt: true,
  headSha: true,
  attributionConfidence: true,
  churn: true,
  expertise: true,
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
    required: ["manifest", "stats", "intelligence", "highlights"],
    properties: {
      manifest: { $ref: "#/$defs/manifest" },
      stats: (snapshotGenerated.properties as JsonRecord).stats,
      intelligence: {
        oneOf: [{ type: "null" }, { $ref: "#/$defs/intelligence" }],
      },
      highlights: (snapshotGenerated.properties as JsonRecord).highlights,
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

// Sanity: generated schemas round-trip through fromJSONSchema for manifest.
const manifestPath = join(SCHEMAS_DIR, "manifest.schema.json");
const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8")) as JsonRecord;
z.fromJSONSchema(manifestJson);

console.log("Wrote plugin JSON schemas to packages/plugin/schemas/");
