import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DECISIONS_SCHEMA_VERSION,
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
} from "../schema/zod/decisions.js";

const DECISIONS_FILENAME = "decisions.json";
const MAX_DECISIONS = 40;

function validateDecisionsArtifact(
  artifact: DecisionsArtifactType,
): DecisionsArtifactType {
  const parsed = DecisionsArtifact.parse(artifact);
  if (parsed.decisions.length > MAX_DECISIONS) {
    throw new Error(`decisions array exceeds maximum of ${MAX_DECISIONS}`);
  }
  return parsed;
}

export function readDecisionsArtifact(
  gitchangeDir: string,
): DecisionsArtifactType | null {
  const decisionsPath = join(gitchangeDir, DECISIONS_FILENAME);

  try {
    const raw = readFileSync(decisionsPath, "utf-8");
    return validateDecisionsArtifact(JSON.parse(raw));
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

export function writeDecisionsArtifact(
  gitchangeDir: string,
  artifact: DecisionsArtifactType,
): void {
  const validated = validateDecisionsArtifact(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const decisionsPath = join(gitchangeDir, DECISIONS_FILENAME);
  const tmpPath = `${decisionsPath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, decisionsPath);
}

export const MAX_DECISIONS_ARTIFACT = MAX_DECISIONS;
export { DECISIONS_SCHEMA_VERSION };
