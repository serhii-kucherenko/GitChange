---
phase: 03-cli-plugin-scaffold
plan: 04
subsystem: plugin
tags: [slash-commands, json-schema, host-ai, plug-05, cursor-plugin, claude-plugin]

requires:
  - phase: 03-cli-plugin-scaffold
    provides: gitchange index CLI, serve/status, getRepoSnapshot
provides:
  - /gitchange and /gitchange-dashboard SKILL.md slash commands
  - Cursor and Claude plugin manifests + marketplace listing
  - Host-AI JSON schemas (manifest, snapshot, intelligence-summary)
  - PLUG-05 static grep gate in integration tests
  - gitchange-orchestrator agent spec
affects: [03-05-PLAN, 03-06-PLAN, INST-02, INST-03]

tech-stack:
  added: [zod toJSONSchema code generation for plugin schemas]
  patterns: [PLUG-05 host AI is LLM; GitChange artifacts only, snapshot schema uses local $defs]

key-files:
  created:
    - .cursor-plugin/plugin.json
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - packages/plugin/skills/gitchange/SKILL.md
    - packages/plugin/skills/gitchange-dashboard/SKILL.md
    - packages/plugin/agents/gitchange-orchestrator.md
    - packages/plugin/schemas/manifest.schema.json
    - packages/plugin/schemas/snapshot.schema.json
    - packages/plugin/schemas/intelligence-summary.schema.json
    - packages/plugin/scripts/generate-schemas.ts
    - tests/integration/plugin-schemas.test.ts
  modified:
    - packages/plugin/package.json
    - package.json

key-decisions:
  - "Snapshot JSON schema embeds manifest and intelligence in local $defs so z.fromJSONSchema validates without external $ref"
  - "intelligence-full.schema.json generated for snapshot $defs; intelligence-summary.schema.json is the bounded host-AI export"
  - "Skills gate dashboard on manifest.json and only recommend gitchange CLI — no remote curl|bash"

patterns-established:
  - "Plugin build regenerates JSON schemas from @gitchange/core Zod types"
  - "PLUG-05 grep gate covers LLM SDK imports and non-localhost fetch in plugin/cli/server"

requirements-completed: [PLUG-01, PLUG-02, PLUG-05, INST-02]

duration: 25min
completed: 2026-07-01
---

# Phase 3 Plan 04: Plugin Slash Commands + Host-AI Schemas Summary

**`/gitchange` and `/gitchange-dashboard` skills with Zod-derived JSON schemas — host AI presents analysis, no embedded LLM in GitChange**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T02:38:00Z
- **Completed:** 2026-07-01T02:44:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Cursor (`.cursor-plugin/`) and Claude (`.claude-plugin/`) manifests point at `packages/plugin/skills/` and `agents/`
- `/gitchange` skill: resolve repo root, run `gitchange index`, present manifest warnings and expertise topics (INST-02)
- `/gitchange-dashboard` skill: manifest gate, `gitchange serve`, open `http://127.0.0.1:9876` (PLUG-02)
- JSON schemas for manifest, snapshot API shape, and trimmed intelligence summary
- Integration tests validate fixtures against schemas and enforce PLUG-05 (no LLM SDK imports)

## Task Commits

1. **Task 1: Plugin manifests + slash command skills** - `ebec5c1` (feat)
2. **Task 2: Host-AI schemas + PLUG-05 grep gate** - `f41d257` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/plugin/skills/gitchange/SKILL.md` — first-run index orchestration for host AI
- `packages/plugin/skills/gitchange-dashboard/SKILL.md` — localhost dashboard launch gate
- `packages/plugin/agents/gitchange-orchestrator.md` — index → present → follow-up phases
- `packages/plugin/scripts/generate-schemas.ts` — Zod → JSON Schema export from core types
- `tests/integration/plugin-schemas.test.ts` — schema validation + PLUG-05 grep gates

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/plugin/skills/gitchange/SKILL.md
- FOUND: .cursor-plugin/plugin.json
- FOUND: packages/plugin/schemas/snapshot.schema.json
- FOUND: ebec5c1
- FOUND: f41d257
