#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { ErasArtifact, writeErasArtifact } from "@gitchange/core";

const gitchangeDir = process.argv[2];
const jsonPath = process.argv[3];

if (!gitchangeDir || !jsonPath) {
  console.error("Usage: write-eras.ts <absolute-path-to-.gitchange> <path-to-eras.json>");
  process.exit(1);
}

try {
  const raw = readFileSync(jsonPath, "utf-8");
  const artifact = ErasArtifact.parse(JSON.parse(raw));
  writeErasArtifact(gitchangeDir, artifact);
  process.stdout.write(
    `Wrote eras.json (${artifact.eras.length} era(s), ${artifact.eras.reduce((n, e) => n + e.inflections.length, 0)} inflection(s))\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
