#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InterviewRecord, writeInterviewRecord } from "@gitchange/core";

const gitchangeDir = process.argv[2];
const jsonPath = process.argv[3];

if (!gitchangeDir || !jsonPath) {
  console.error(
    "Usage: write-interview.ts <absolute-path-to-.gitchange> <path-to-interview-record.json>",
  );
  process.exit(1);
}

try {
  const raw = readFileSync(jsonPath, "utf-8");
  const agentJson: unknown = JSON.parse(raw);
  const record = writeInterviewRecord(
    resolve(gitchangeDir),
    InterviewRecord.parse(agentJson),
  );
  process.stdout.write(
    `Wrote interviews/${record.id}.json\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
