import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  DecisionsArtifact,
  type DecisionsArtifact as DecisionsArtifactType,
  type DecisionRecord,
} from "../schema/zod/decisions.js";
import type { Evidence } from "../schema/zod/evidence.js";
import { redact } from "../privacy/redaction.js";
import { readDecisionsArtifact, writeDecisionsArtifact } from "../decisions/decisions-io.js";
import { readInterviewRecord } from "./store.js";

const CONFIRMED_MIN_CONFIDENCE = 0.7;
const INTERVIEW_EVIDENCE_EXCERPT_MAX = 500;

export interface MergeInterviewOptions {
  /** Repository root (parent of .gitchange). Required for optional docs writeback. */
  repoRoot?: string;
}

function interviewEvidencePath(interviewId: string): string {
  return `interviews/${interviewId}.json`;
}

function excerptForEvidence(answer: string): string {
  const trimmed = answer.trim();
  if (trimmed.length <= INTERVIEW_EVIDENCE_EXCERPT_MAX) {
    return trimmed;
  }
  return `${trimmed.slice(0, INTERVIEW_EVIDENCE_EXCERPT_MAX - 1)}…`;
}

function buildInterviewEvidence(
  interviewId: string,
  recordedAt: string,
  answer: string,
): Evidence {
  return {
    type: "interview",
    path: interviewEvidencePath(interviewId),
    recordedAt,
    excerpt: excerptForEvidence(answer),
  };
}

function mergeDecision(
  decision: DecisionRecord,
  interview: ReturnType<typeof readInterviewRecord>,
): DecisionRecord {
  const interviewEvidence = buildInterviewEvidence(
    interview.id,
    interview.recordedAt,
    interview.answer,
  );

  const evidenceHasInterview = decision.evidence.some((ref) => {
    if (ref.type !== "interview") {
      return false;
    }
    return ref.path === interviewEvidencePath(interview.id);
  });
  const evidence = evidenceHasInterview
    ? decision.evidence
    : [...decision.evidence, interviewEvidence];

  if (interview.verdict === "confirm") {
    return {
      ...decision,
      reviewStatus: "confirmed",
      miningSource: "interview",
      confidence: Math.max(decision.confidence, CONFIRMED_MIN_CONFIDENCE),
      evidence,
    };
  }

  return {
    ...decision,
    reviewStatus: "rejected",
    evidence,
  };
}

function writeDocsInterviewSnippet(
  repoRoot: string,
  interview: ReturnType<typeof readInterviewRecord>,
): void {
  const docsDir = join(repoRoot, "docs", "interviews");
  mkdirSync(docsDir, { recursive: true });

  const { redacted: safeAnswer } = redact(interview.answer);
  const { redacted: safeQuestion } = redact(interview.question);
  const maintainerLine = interview.maintainer
    ? `**Maintainer:** ${interview.maintainer}\n\n`
    : "";

  const content = `# Interview: ${interview.decisionId}

${maintainerLine}**Recorded:** ${interview.recordedAt}

## Question

${safeQuestion}

## Answer

${safeAnswer}

---
*Generated from GitChange interview \`${interview.id}\`. Commit this file manually when ready.*
`;

  writeFileSync(join(docsDir, `${interview.id}.md`), content, "utf-8");
}

export function mergeInterviewIntoDecisions(
  gitchangeDir: string,
  interviewId: string,
  options: MergeInterviewOptions = {},
): DecisionsArtifactType {
  const interview = readInterviewRecord(gitchangeDir, interviewId);
  const existing = readDecisionsArtifact(gitchangeDir);

  if (!existing) {
    throw new Error("decisions.json is missing — run decision synthesis first");
  }

  const index = existing.decisions.findIndex(
    (decision) => decision.id === interview.decisionId,
  );

  if (index < 0) {
    throw new Error(`decision not found: ${interview.decisionId}`);
  }

  const updatedDecisions = [...existing.decisions];
  updatedDecisions[index] = mergeDecision(updatedDecisions[index]!, interview);

  const artifact = DecisionsArtifact.parse({
    ...existing,
    decisions: updatedDecisions,
  });

  writeDecisionsArtifact(gitchangeDir, artifact);

  if (
    interview.verdict === "confirm" &&
    interview.writeToDocs === true
  ) {
    const repoRoot = options.repoRoot ?? dirname(gitchangeDir);
    writeDocsInterviewSnippet(repoRoot, interview);
  }

  return artifact;
}
