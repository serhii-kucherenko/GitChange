#!/usr/bin/env tsx
import { buildTourSynthesisContext } from "@gitchange/core";

const gitchangeDir = process.argv[2];

if (!gitchangeDir) {
  console.error(
    "Usage: build-tour-context.ts <absolute-path-to-.gitchange>",
  );
  process.exit(1);
}

try {
  const context = buildTourSynthesisContext(gitchangeDir);
  process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
