import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  TOURS_SCHEMA_VERSION,
  ToursArtifact,
  type ToursArtifact as ToursArtifactType,
} from "../schema/zod/tours.js";
import { checkToursIntegrity } from "../verify/tours-integrity.js";

const TOURS_FILENAME = "tours.json";

function validateToursArtifact(artifact: ToursArtifactType): ToursArtifactType {
  return ToursArtifact.parse(artifact);
}

export function readToursArtifact(
  gitchangeDir: string,
): ToursArtifactType | null {
  const toursPath = join(gitchangeDir, TOURS_FILENAME);

  try {
    const raw = readFileSync(toursPath, "utf-8");
    return validateToursArtifact(JSON.parse(raw));
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

export function writeToursArtifact(
  gitchangeDir: string,
  artifact: ToursArtifactType,
): void {
  const validated = validateToursArtifact(artifact);

  const integrity = checkToursIntegrity(gitchangeDir, validated);
  if (!integrity.ok) {
    throw new Error(
      `tours integrity check failed: ${integrity.errors.join("; ")}`,
    );
  }

  mkdirSync(gitchangeDir, { recursive: true });

  const toursPath = join(gitchangeDir, TOURS_FILENAME);
  const tmpPath = `${toursPath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, toursPath);
}

export { TOURS_SCHEMA_VERSION };
