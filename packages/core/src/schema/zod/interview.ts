import { z } from "zod";

export const INTERVIEW_RECORD_SCHEMA_VERSION = "1";

export const InterviewVerdict = z.enum(["confirm", "reject"]);

export type InterviewVerdict = z.infer<typeof InterviewVerdict>;

function isSafeInterviewId(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("..") &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

export const InterviewRecord = z.object({
  id: z
    .string()
    .min(1)
    .refine(isSafeInterviewId, { message: "interview id must not contain path segments" }),
  decisionId: z.string().startsWith("decision:"),
  question: z.string().min(1),
  answer: z.string().max(2000),
  verdict: InterviewVerdict,
  recordedAt: z.string().min(1),
  maintainer: z.string().min(1).optional(),
  writeToDocs: z.boolean().optional(),
});

export type InterviewRecord = z.infer<typeof InterviewRecord>;
