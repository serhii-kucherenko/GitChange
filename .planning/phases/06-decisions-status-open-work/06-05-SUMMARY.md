---
phase: 06-decisions-status-open-work
plan: 05
subsystem: plugin
tags: [interview, decisions, DEC-03, DEC-04, maintainer-loop, durable-lore]

requires:
  - phase: 06-02
    provides: Decision miner artifacts with reviewStatus pending and attribution
provides:
  - /gitchange-interview skill for maintainer confirm/reject loop
  - InterviewRecord persistence under .gitchange/interviews/
  - mergeInterviewIntoDecisions with interview evidence and confidence bump
  - write-interview.ts and merge-interview.ts CLI helpers
  - interview-synthesizer agent spec for host LLM structuring
affects: [06-06, 07-tour-player]

tech-stack:
  added: []
  patterns:
    - "Interview JSON stored at .gitchange/interviews/<ulid>.json with path traversal guards"
    - "Confirm verdict sets reviewStatus confirmed, miningSource interview, confidence min 0.7"
    - "Reject verdict keeps decision row with reviewStatus rejected"
    - "docs/interviews writeback only when writeToDocs explicit opt-in; never auto-git-commit"

key-files:
  created:
    - packages/core/src/schema/zod/interview.ts
    - packages/core/src/interviews/store.ts
    - packages/core/src/interviews/merge.ts
    - packages/plugin/skills/gitchange-interview/SKILL.md
    - packages/plugin/agents/interview-synthesizer.md
    - packages/plugin/scripts/write-interview.ts
    - packages/plugin/scripts/merge-interview.ts
    - packages/plugin/schemas/interview-record.schema.json
  modified:
    - packages/core/src/index.ts
    - packages/core/src/schema/zod/index.ts
    - packages/plugin/scripts/generate-schemas.ts
    - packages/plugin/skills/gitchange/SKILL.md
    - packages/plugin/package.json
    - tests/integration/plugin-schemas.test.ts

key-decisions:
  - "Interview answer capped at 2000 chars in record; evidence excerpt truncated to 500 at merge"
  - "Confirmed confidence floor 0.7 clears EVD-03 threshold without deleting prior evidence"
  - "Doc writeback applies redact() and requires maintainer manual git commit"

patterns-established:
  - "Host chat structures InterviewRecord via interview-synthesizer; core handles persistence and merge"
  - "Rejected decisions retain audit trail with interview evidence appended"

requirements-completed: [DEC-03, DEC-04]

duration: 22min
completed: 2026-07-01
---

# Phase 6 Plan 05: Maintainer Interview Loop Summary

**Maintainer confirm/reject interviews persist under `.gitchange/interviews/` and merge into `decisions.json` with interview evidence and raised confidence.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3 completed
- **Files modified:** 18

## Accomplishments

- `InterviewRecord` Zod schema + JSON schema with path-traversal-safe store under `.gitchange/interviews/`.
- `mergeInterviewIntoDecisions` updates `reviewStatus`, appends `interview` evidence, bumps confidence on confirm, optional `docs/interviews/` markdown export with redaction.
- `/gitchange-interview` skill and `interview-synthesizer` agent spec document the full DEC-03/DEC-04 loop; main `/gitchange` skill links pending decisions to the interview flow.
- `write-interview.ts` and `merge-interview.ts` scripts verified on fixture (Node 22).

## Task Commits

1. **Task 1: Interview record store + schema** - `a543b7a` (test)
2. **Task 2: Merge interview into decisions artifact** - `64a6bdc` (feat)
3. **Task 3: /gitchange-interview skill + agent spec** - `abfed1c` (feat)

## Files Created/Modified

- `packages/core/src/interviews/store.ts` - write/read interview JSON with traversal guards
- `packages/core/src/interviews/merge.ts` - merge into decisions.json + optional docs export
- `packages/plugin/skills/gitchange-interview/SKILL.md` - DEC-03 entry point
- `packages/plugin/agents/interview-synthesizer.md` - host LLM output contract

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/core/src/interviews/store.ts
- FOUND: packages/core/src/interviews/merge.ts
- FOUND: packages/plugin/skills/gitchange-interview/SKILL.md
- FOUND: packages/plugin/agents/interview-synthesizer.md
- FOUND: packages/plugin/schemas/interview-record.schema.json
- FOUND: a543b7a
- FOUND: 64a6bdc
- FOUND: abfed1c
