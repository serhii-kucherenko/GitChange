import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ErasArtifact,
  SEMANTIC_SCHEMA_VERSION,
  type ErasArtifact as ErasArtifactType,
} from "../schema/zod/eras.js";

const ERAS_FILENAME = "eras.json";
const MAX_ERAS = 8;

function validateErasArtifact(artifact: ErasArtifactType): ErasArtifactType {
  const parsed = ErasArtifact.parse(artifact);
  if (parsed.eras.length > MAX_ERAS) {
    throw new Error(`eras array exceeds maximum of ${MAX_ERAS}`);
  }
  return parsed;
}

export function readErasArtifact(
  gitchangeDir: string,
): ErasArtifactType | null {
  const erasPath = join(gitchangeDir, ERAS_FILENAME);

  try {
    const raw = readFileSync(erasPath, "utf-8");
    return validateErasArtifact(JSON.parse(raw));
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

export function writeErasArtifact(
  gitchangeDir: string,
  artifact: ErasArtifactType,
): void {
  const validated = validateErasArtifact(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const erasPath = join(gitchangeDir, ERAS_FILENAME);
  const tmpPath = `${erasPath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, erasPath);
}

export const MAX_NAMED_ERAS = MAX_ERAS;
export { MAX_ERAS, SEMANTIC_SCHEMA_VERSION };
