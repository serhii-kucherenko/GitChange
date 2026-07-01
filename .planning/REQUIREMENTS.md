# Requirements: GitChange

**Defined:** 2026-06-30
**Core Value:** Anyone onboarding or maintaining a codebase can answer five evidence-backed questions — who changed what, how the project evolved, what decisions/migrations were made, what's still in flight, and current progress.

## v1 Requirements

### Ingestion & Index (INGX)

- [x] **INGX-01**: User can index a local git clone and produce a `.gitchange/` derived index without network access
- [x] **INGX-02**: System parses commits, authors, timestamps, messages, merges, renames, and file-level diffs from local git
- [x] **INGX-03**: System analyzes docs tracked in git (README, CHANGELOG, docs/, ADRs) as they changed over time
- [x] **INGX-04**: System incrementally re-indexes only commits after `lastIndexedCommit` on subsequent runs
- [x] **INGX-05**: System detects force-push or shallow-clone conditions and surfaces index freshness warnings
- [x] **INGX-06**: User can search and filter commits by author, path, message keyword, and date range

### Evidence & Trust (EVD)

- [x] **EVD-01**: Every narrative claim (era label, decision summary, status) links to evidence (commit SHA, file path, or doc excerpt)
- [x] **EVD-02**: System assigns confidence scores to inferred claims and shows them in UI and agent responses
- [x] **EVD-03**: System shows "no recorded decision found" when evidence is below threshold instead of fabricating rationale
- [x] **EVD-04**: Golden fixture tests validate evidence link integrity for generated artifacts

### Timeline & Drill-Down (TIME)

- [x] **TIME-01**: User can view an interactive timeline of project history with era markers
- [x] **TIME-02**: User can drill down era → commit → file → diff hunk from the dashboard
- [x] **TIME-03**: User can view file-centric history scrubber for any indexed file
- [x] **TIME-04**: User can navigate migration-centric threads showing progress across commits and files

### Evolution & Eras (ERA)

- [x] **ERA-01**: System detects named engineering eras/chapters with evidence bundles (commits, file arrivals, pivot signals)
- [x] **ERA-02**: User can see how the project evolved through era summaries tied to proof
- [x] **ERA-03**: System detects inflection types: tech pivots, scope steering, process shifts, and team/ownership changes

### Guided Tours (TOUR)

- [x] **TOUR-01**: System generates a default guided onboarding tour (4–6 chapters) ordered by dependency and chronology
- [x] **TOUR-02**: User can take role-based tour variants (e.g., backend vs frontend emphasis)
- [x] **TOUR-03**: User can follow topic-thread tours (e.g., auth, database, named migration) across eras
- [x] **TOUR-04**: Tour player shows evidence on every stop with drill-down to commits and files

### Contributors & Ownership (CONT)

- [x] **CONT-01**: User can see who changed what with per-file and per-era ownership timelines
- [x] **CONT-02**: User can see decision attribution — who drove pivots with linked commits
- [x] **CONT-03**: User can view contributor expertise profiles inferred from history ("ask Alice about auth")
- [x] **CONT-04**: System computes ownership from line survival at HEAD with rename tracking and ignore-revs support

### Decisions & Migrations (DEC)

- [x] **DEC-01**: System auto-mines decisions and migrations from commits, messages, trailers, and doc deltas
- [x] **DEC-02**: User can browse decisions with status, evidence, and supersession relationships
- [x] **DEC-03**: Maintainer can confirm or reject auto-mined decisions via in-chat interview loop
- [x] **DEC-04**: Interview answers flow back into project docs or `.gitchange/` index as durable lore

### Status & Open Work (STAT)

- [x] **STAT-01**: System infers migration/task status using pattern-based, keyword/trailer, and docs-vs-code cross-reference methods
- [x] **STAT-02**: User can see open threads panel listing in-flight migrations, WIP refactors, and stale work
- [x] **STAT-03**: Tour stops and timeline show inline badges when related work appears incomplete
- [x] **STAT-04**: Agent can answer status queries (e.g., migration progress) with evidence and confidence

### Dashboard & Visualization (DASH)

- [x] **DASH-01**: User can open a local web dashboard served on localhost from indexed artifacts
- [ ] **DASH-02**: Dashboard includes timeline, temporal knowledge graph, and tour player views
- [x] **DASH-03**: Dashboard shows index freshness and schema version
- [x] **DASH-04**: Dashboard virtualizes large commit lists for responsive navigation

### Plugin & CLI (PLUG)

- [x] **PLUG-01**: User can run `/gitchange` slash command to trigger analysis pipeline from Cursor/Claude Code
- [x] **PLUG-02**: User can run `/gitchange-dashboard` to open the local web UI
- [x] **PLUG-03**: CLI supports `gitchange index`, `gitchange serve`, and `gitchange status` commands
- [x] **PLUG-04**: Plugin follows Understand-Anything packaging pattern (skills, agents, multi-platform install)
- [x] **PLUG-05**: Host AI is the LLM — GitChange supplies tools, schemas, and artifacts only

### Install & First Run (INST)

- [x] **INST-01**: User can install via plugin marketplace or one-line installer following the Understand-Anything pattern
- [x] **INST-02**: User completes first analysis with a single `/gitchange` slash command after install — no manual config required
- [x] **INST-03**: User opens dashboard with `/gitchange-dashboard` and sees initial value (index status, basic repo snapshot) without manual configuration
- [x] **INST-04**: Quickstart docs cover install → `/gitchange` → `/gitchange-dashboard` in under 5 steps

### Privacy (PRIV)

- [x] **PRIV-01**: System runs local-only with no telemetry
- [x] **PRIV-02**: System redacts secrets from generated artifacts at ingest
- [x] **PRIV-03**: User can configure `.gitchangeignore` for sensitive paths, authors, or commits
- [x] **PRIV-04**: Local server binds to localhost by default

### Scale & Performance (SCALE)

- [x] **SCALE-01**: System indexes repositories with 100k+ commits using incremental two-phase architecture
- [x] **SCALE-02**: Dashboard and agent queries read pre-built index — no live full-repo git walks in UI hot path
- [x] **SCALE-03**: Core ingestion and parsing covered by TDD with golden fixtures

### Multi-Repo (MULTI)

- [x] **MULTI-01**: User can manually select one or multiple related repos for unified analysis
- [x] **MULTI-02**: Unified timeline and tours present cross-repo story with explicit repo attribution

## v2 Requirements

Deferred until v1 validated on GitChange dogfood + external OSS adopter.

### Integrations (INTG)

- **INTG-01**: GitHub/GitLab PR and issue comment mining via API
- **INTG-02**: Auto-update index via post-commit hook
- **INTG-03**: MCP tools in addition to slash commands

### Platform (PLAT)

- **PLAT-01**: Hosted/synced team lore SaaS
- **PLAT-02**: Mobile-optimized dashboard
- **PLAT-03**: IDE inline annotations (Vestige-style)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud SaaS as core path | v1 is local-first; conflicts with privacy persona |
| GitHub/GitLab API as primary source | v1 uses local git clone only |
| Mobile UI | Poor fit for code evidence drill-down |
| Forking Understand-Anything codebase | Separate temporal-focused codebase; copy plugin patterns only |
| Static dependency/call graphs | Repowise/UA territory; not temporal onboarding core |
| Own LLM orchestration | Host chat (Cursor/Claude) is the model |
| Ungrounded AI narratives | Trust failure mode; evidence contract required |
| Real-time collaborative lore editing | Scope explosion; maintainer interview → docs PR instead |
| Animated Gource-style viz as primary UX | Eye candy without learning path |

## User Stories

- As a **new hire**, I want a guided tour through project eras so I can understand how the codebase evolved without asking seniors.
- As a **new hire**, I want to drill from any tour claim to the exact commit and file diff that proves it.
- As a **maintainer**, I want weak-evidence gaps surfaced in chat so I can capture tribal knowledge before it is lost.
- As a **maintainer**, I want to see open migrations and their progress so I know what work is still in flight.
- As a **contributor using Cursor**, I want slash commands that index history and open a dashboard without leaving my IDE.

## Acceptance Criteria

- A new hire completes the default tour and can explain three key project pivots with linked evidence.
- Agent correctly answers "why did we switch X?" with commit/doc citations and confidence score.
- Another OSS project successfully adopts GitChange for onboarding.
- Index incrementally updates on new commits without full rescan.
- No secrets appear in `.gitchange/` artifacts for fixture repos containing simulated credentials.

## Definition of Done

- All v1 requirements mapped to roadmap phases with verification criteria
- Core ingestion tests pass (golden fixtures)
- End-to-end flow works: `/gitchange` → index → `/gitchange-dashboard` → tour with drill-down
- MIT licensed; documented install path for Cursor and Claude Code
- Dogfooded on GitChange's own repository

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGX-01 | Phase 1 | Complete |
| INGX-02 | Phase 1 | Complete |
| INGX-03 | Phase 1 | Complete |
| INGX-04 | Phase 1 | Complete |
| INGX-05 | Phase 1 | Complete |
| INGX-06 | Phase 5 | Complete |
| EVD-01 | Phase 1 | Complete |
| EVD-02 | Phase 5 | Complete |
| EVD-03 | Phase 6 | Complete |
| EVD-04 | Phase 1 | Complete |
| TIME-01 | Phase 5 | Complete |
| TIME-02 | Phase 5 | Complete |
| TIME-03 | Phase 5 | Complete |
| TIME-04 | Phase 6 | Complete |
| ERA-01 | Phase 4 | Complete |
| ERA-02 | Phase 4 | Complete |
| ERA-03 | Phase 4 | Complete |
| TOUR-01 | Phase 7 | Complete |
| TOUR-02 | Phase 7 | Complete |
| TOUR-03 | Phase 7 | Complete |
| TOUR-04 | Phase 7 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 6 | Complete |
| CONT-03 | Phase 2 | Complete |
| CONT-04 | Phase 2 | Complete |
| DEC-01 | Phase 6 | Complete |
| DEC-02 | Phase 6 | Complete |
| DEC-03 | Phase 6 | Complete |
| DEC-04 | Phase 6 | Complete |
| STAT-01 | Phase 6 | Complete |
| STAT-02 | Phase 6 | Complete |
| STAT-03 | Phase 6 | Complete |
| STAT-04 | Phase 6 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 5 | Complete |
| DASH-04 | Phase 5 | Complete |
| PLUG-01 | Phase 3 | Complete |
| PLUG-02 | Phase 3 | Complete |
| PLUG-03 | Phase 3 | Complete |
| PLUG-04 | Phase 3 | Complete |
| PLUG-05 | Phase 3 | Complete |
| INST-01 | Phase 3 | Complete |
| INST-02 | Phase 3 | Complete |
| INST-03 | Phase 3 | Complete |
| INST-04 | Phase 3 | Complete |
| PRIV-01 | Phase 1 | Complete |
| PRIV-02 | Phase 1 | Complete |
| PRIV-03 | Phase 1 | Complete |
| PRIV-04 | Phase 5 | Complete |
| SCALE-01 | Phase 8 | Complete |
| SCALE-02 | Phase 5 | Complete |
| SCALE-03 | Phase 1 | Complete |
| MULTI-01 | Phase 8 | Complete |
| MULTI-02 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 after First Run / Install UX revision (INST-01–04, PLUG-02 → Phase 3)*
