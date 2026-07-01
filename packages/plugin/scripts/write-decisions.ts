#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { mergeDecisionMinerOutput } from "@gitchange/core";

const gitchangeDir = process.argv[2];
const jsonPath = process.argv[3];

if (!gitchangeDir || !jsonPath) {
  console.error(
    "Usage: write-decisions.ts <absolute-path-to-.gitchange> <path-to-decisions.json>",
  );
  process.exit(1);
}

try {
  const raw = readFileSync(jsonPath, "utf-8");
  const agentJson: unknown = JSON.parse(raw);
  const artifact = mergeDecisionMinerOutput(gitchangeDir, agentJson);
  process.stdout.write(
    `Wrote decisions.json (${artifact.decisions.length} decision(s))\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
