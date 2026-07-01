import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  InterviewRecord,
  type InterviewRecord as InterviewRecordType,
} from "../schema/zod/interview.js";

const INTERVIEWS_DIR = "interviews";

function assertSafeInterviewId(interviewId: string): void {
  if (
    interviewId.includes("..") ||
    interviewId.includes("/") ||
    interviewId.includes("\\") ||
    interviewId.includes("\0") ||
    interviewId.length === 0
  ) {
    throw new Error(`interview id rejected: path traversal or invalid segments (${interviewId})`);
  }
}

function resolveInterviewPath(
  gitchangeDir: string,
  interviewId: string,
): string {
  assertSafeInterviewId(interviewId);

  const interviewsDir = resolve(gitchangeDir, INTERVIEWS_DIR);
  const filePath = resolve(interviewsDir, `${interviewId}.json`);

  if (!filePath.startsWith(interviewsDir)) {
    throw new Error(`interview path escapes interviews directory: ${interviewId}`);
  }

  return filePath;
}

export function writeInterviewRecord(
  gitchangeDir: string,
  record: InterviewRecordType,
): InterviewRecordType {
  const validated = InterviewRecord.parse(record);
  const filePath = resolveInterviewPath(gitchangeDir, validated.id);

  mkdirSync(join(gitchangeDir, INTERVIEWS_DIR), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");

  return validated;
}

export function readInterviewRecord(
  gitchangeDir: string,
  interviewId: string,
): InterviewRecordType {
  const filePath = resolveInterviewPath(gitchangeDir, interviewId);

  if (!existsSync(filePath)) {
    throw new Error(`interview record not found: ${interviewId}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  return InterviewRecord.parse(JSON.parse(raw));
}
