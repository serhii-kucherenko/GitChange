import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  TemporalGraphArtifact,
  type TemporalGraphArtifact as TemporalGraphArtifactType,
} from "../schema/zod/temporal-graph.js";
import { assembleTemporalGraph } from "./assemble-graph.js";

const GRAPH_FILENAME = "temporal-graph.json";

function validateTemporalGraph(
  artifact: TemporalGraphArtifactType,
): TemporalGraphArtifactType {
  return TemporalGraphArtifact.parse(artifact);
}

export function readTemporalGraph(
  gitchangeDir: string,
): TemporalGraphArtifactType | null {
  const graphPath = join(gitchangeDir, GRAPH_FILENAME);

  try {
    const raw = readFileSync(graphPath, "utf-8");
    return validateTemporalGraph(JSON.parse(raw));
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

export function writeTemporalGraph(
  gitchangeDir: string,
  artifact: TemporalGraphArtifactType,
): void {
  const validated = validateTemporalGraph(artifact);
  mkdirSync(gitchangeDir, { recursive: true });

  const graphPath = join(gitchangeDir, GRAPH_FILENAME);
  const tmpPath = `${graphPath}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, graphPath);
}

export function assembleAndWriteTemporalGraph(
  gitchangeDir: string,
): TemporalGraphArtifactType {
  const graph = assembleTemporalGraph(gitchangeDir);
  writeTemporalGraph(gitchangeDir, graph);
  return graph;
}
