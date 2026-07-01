import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OPEN_WORK_SCHEMA_VERSION,
  OpenWorkArtifact,
  type OpenWorkArtifact as OpenWorkArtifactType,
} from "../schema/zod/open-work.js";

const OPEN_WORK_FILENAME = "open-work.json";
const MAX_THREADS = 20;

function validateOpenWorkArtifact(
  artifact: OpenWorkArtifactType,
): OpenWorkArtifactType {
  const parsed = OpenWorkArtifact.parse(artifact);
  if (parsed.threads.length > MAX_THREADS) {
    throw new Error(`threads array exceeds maximum of ${MAX_THREADS}`);
  }
  return parsed;
}

export function readOpenWorkArtifact(
  gitchangeDir: string,
): OpenWorkArtifactType | null {
  const openWorkPath = join(gitchangeDir, OPEN_WORK_FILENAME);

  try {
    const raw = readFileSync(openWorkPath, "utf-8");
    return validateOpenWorkArtifact(JSON.parse(raw));
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

export function writeOpenWorkArtifact(
  gitchangeDir: string,
  artifact: OpenWorkArtifactType,
): void {
  const validated = validateOpenWorkArtifact(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const openWorkPath = join(gitchangeDir, OPEN_WORK_FILENAME);
  const tmpPath = `${openWorkPath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, openWorkPath);
}

export const MAX_OPEN_WORK_THREADS = MAX_THREADS;
export { OPEN_WORK_SCHEMA_VERSION };
