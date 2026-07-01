#!/usr/bin/env tsx
import { dirname, resolve } from "node:path";
import { mergeInterviewIntoDecisions } from "@gitchange/core";

const gitchangeDir = process.argv[2];
const interviewId = process.argv[3];
const repoRootArg = process.argv[4];

if (!gitchangeDir || !interviewId) {
  console.error(
    "Usage: merge-interview.ts <absolute-path-to-.gitchange> <interview-id> [repo-root]",
  );
  process.exit(1);
}

try {
  const artifact = mergeInterviewIntoDecisions(
    resolve(gitchangeDir),
    interviewId,
    {
      repoRoot: repoRootArg ? resolve(repoRootArg) : dirname(resolve(gitchangeDir)),
    },
  );
  const decision = artifact.decisions.find((row) =>
    row.evidence.some(
      (ref) => ref.type === "interview" && ref.path === `interviews/${interviewId}.json`,
    ),
  );
  process.stdout.write(
    `Merged interview ${interviewId} → ${decision?.id ?? "unknown"} (${decision?.reviewStatus ?? "n/a"})\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
