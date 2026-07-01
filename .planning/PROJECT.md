# GitChange

## What This Is

GitChange is an open-source, local-first tool that analyzes git history — commits, metadata, evolving docs, and everything else available from a local clone — to help **new team members** and **maintainers** understand how a project evolved step by step.

It answers five core questions with evidence you can drill into from a local web dashboard:

1. **Who changed what?** — authorship, ownership, and expertise over time
2. **How did the project evolve?** — eras, pivots, steering, and inflection points
3. **What decisions and migrations were made?** — extracted from history with linked proof
4. **What decisions and migrations are still in flight?** — open threads, incomplete refactors, WIP migrations
5. **What is the current progress?** — status and confidence on ongoing work

The product follows an IDE plugin pattern: slash commands in Cursor/Claude Code trigger a multi-agent analysis pipeline, write results to `.gitchange/`, and spin up a local server for an interactive UI (timeline, temporal graph, tour player, era → commit → file drill-down). The host AI chat is the LLM — GitChange supplies tools, context, and artifacts, not its own model layer.

## Core Value

Anyone onboarding or maintaining a codebase can **answer the five core questions above with evidence** — without hunting through years of git log or asking seniors who may have left.

If everything else fails, that must work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Analyze everything explorable from local git: history, commits, metadata, merge commits, conventional commits, and docs changed over time
- [ ] Generate `.gitchange/` index (derived cache; git/docs remain canonical source of truth)
- [ ] Guided tours: era-based chapters, role-based variants, and topic threads across time
- [ ] Local web dashboard: timeline, temporal knowledge graph, and tour player
- [ ] Full drill-down navigation: era → commit → file, file-centric history, and migration-centric tracker
- [ ] Auto-mine decisions and inflection points (tech pivots, scope steering, process shifts, team/ownership changes)
- [ ] In-chat interview loop when evidence is weak; maintainer answers flow back into project docs
- [ ] Contributor lens: per-file/era ownership, decision attribution, and expertise profiles
- [ ] Status inference (all methods + confidence scores): pattern-based, commit keywords/trailers, docs vs code cross-reference
- [ ] Open work surfacing: Open Threads panel, inline badges on tour/timeline, and agent status queries
- [ ] AI plugin with slash commands (`/gitchange`, `/gitchange-dashboard`, etc.) for Cursor, Claude Code, and similar tools
- [ ] User manually picks one or multiple related repos for unified story
- [ ] Privacy controls: local-only, no telemetry, secret redaction, `.gitchangeignore`
- [ ] Incremental re-index on new commits; living decision graph stays current
- [ ] TDD on deterministic git ingestion/parsing; schema validation and golden fixtures for AI outputs
- [ ] Scale for large monorepos (100k+ commits) with incremental indexing
- [ ] MIT license; dogfood on GitChange's own repo; another OSS project successfully adopts v1

### Out of Scope

- Cloud SaaS hosting — local plugin + server only in v1
- GitHub/GitLab API integration — local git clone only
- Mobile UI
- Forking or extending external plugin codebases — inspired-by, separate codebase; copy plugin packaging patterns only

## Context

**Problem:** New hires lose weeks reconstructing "why" from git history. Maintainers lose tribal knowledge when people leave. Existing AI tools (Copilot, Cursor) treat code as a snapshot, not a story.

**Differentiation vs similar tools (Repowise, Vestige, Codebase Time Machine, Historex):**
- Best-in-class **guided onboarding tour** tied to real git evidence
- **Decision depth** with interview loop for gaps competitors leave fuzzy
- IDE plugin **plugin + dashboard** UX applied to temporal/git narrative

**Building GitChange:**
- Project source maintained **AI-first from chat** — artifacts-first so agents can read, verify, and extend the codebase
- GSD workflow (`.planning/`) drives development
- Tech stack deferred to domain research

**Primary users:** New team hires onboarding onto existing codebases; maintainers preserving and extending project lore.

## Constraints

- **Deployment**: Local-first CLI + local web server; no cloud dependency for core flow
- **LLM**: Provided by host chat (Cursor, Claude Code); GitChange is a plugin, not a model provider
- **License**: MIT
- **Scale**: Large monorepos from v1; incremental indexing for updates
- **Testing**: TDD on core ingestion and schema validation; integration tests for API/UI as needed
- **Privacy**: All privacy controls in v1 for sensitive private repos

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IDE plugin pattern | Proven multi-platform distribution; slash commands → pipeline → `.folder/` → dashboard | — Pending |
| Separate codebase (not plugin fork) | GitChange is temporal/git-focused; plugin is structural/code-focused | — Pending |
| `.gitchange/` generated folder | Matches plugin `.gitchange/` pattern; team can opt-in commit | — Pending |
| Git/docs canonical; index derived | Artifacts live in history and project docs; `.gitchange/` is query cache | — Pending |
| All five core questions as product spine | User-defined success criteria for what the tool must answer | — Pending |
| Thin vertical slice v1 | Prove end-to-end: ingest → tour → dashboard → agent commands | — Pending |
| Manual multi-repo selection | User defines related repos at analysis time | — Pending |
| Chat interview for gaps | Host AI asks maintainer; no separate LLM orchestration | — Pending |
| Stack TBD | No language preference; research decides | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-30 after initialization*
