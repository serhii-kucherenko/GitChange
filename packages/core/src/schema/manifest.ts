import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const ManifestWarningCode = z.enum([
  "shallow_clone",
  "force_push_detected",
  "out_of_order_commits",
]);

export type ManifestWarningCode = z.infer<typeof ManifestWarningCode>;

export const IndexCompleteness = z.enum(["complete", "partial"]);

export type IndexCompleteness = z.infer<typeof IndexCompleteness>;

export const ManifestSchema = z.object({
  schemaVersion: z.string(),
  lastIndexedCommit: z.string(),
  indexedAt: z.string(),
  repo: z.object({
    head: z.string(),
    branch: z.string().nullable(),
  }),
  indexCompleteness: IndexCompleteness,
  warnings: z.array(
    z.object({
      code: ManifestWarningCode,
      message: z.string(),
    }),
  ),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function narrowIndexCompleteness(value: IndexCompleteness): void {
  switch (value) {
    case "complete":
    case "partial":
      return;
    default:
      assertNever(value);
  }
}

export function narrowWarningCode(code: ManifestWarningCode): void {
  switch (code) {
    case "shallow_clone":
    case "force_push_detected":
    case "out_of_order_commits":
      return;
    default:
      assertNever(code);
  }
}

const MANIFEST_FILENAME = "manifest.json";

export function readManifest(gitchangeDir: string): Manifest | null {
  const manifestPath = join(gitchangeDir, MANIFEST_FILENAME);

  try {
    const raw = readFileSync(manifestPath, "utf-8");
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export function writeManifest(gitchangeDir: string, manifest: Manifest): void {
  ManifestSchema.parse(manifest);
  mkdirSync(gitchangeDir, { recursive: true });

  const manifestPath = join(gitchangeDir, MANIFEST_FILENAME);
  const tmpPath = `${manifestPath}.tmp`;
  const content = `${JSON.stringify(manifest, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, manifestPath);
}
