# Roadmap: GitChange

## Overview

GitChange delivers evidence-backed answers to five core onboarding questions — who changed what, how the project evolved, what decisions were made, what's still in flight, and current progress — through a local-first pipeline: deterministic git ingestion → repository intelligence → semantic agents (host LLM) → local dashboard and IDE slash commands. Eight vertical MVP phases follow the fact-before-fiction order: index and privacy first, then ownership metrics, CLI/plugin scaffold with smooth first-run install UX (Understand-Anything pattern), era detection, full interactive dashboard drill-down, decisions and open work, guided tours, and finally scale plus multi-repo unification.

## Phases

**Phase Numbering:**

- Integer phases (1–8): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Index Foundation** - Deterministic git/doc ingestion, `.gitchange/` schema, privacy, and golden fixtures (completed 2026-07-01)
- [x] **Phase 2: Repository Intelligence & Ownership** - Churn, co-change, and line-survival ownership profiles (completed 2026-07-01)
- [x] **Phase 3: CLI & Plugin Scaffold** - Install/first-run UX (UA pattern), CLI, `/gitchange`, minimal `/gitchange-dashboard` (completed 2026-07-01)
- [ ] **Phase 4: Era Detection & Semantic Pipeline** - Named eras, inflection points, and temporal graph artifacts
- [ ] **Phase 5: Dashboard & Evidence Drill-Down** - Full interactive dashboard expanding Phase 3 minimal first-run UI
- [ ] **Phase 6: Decisions, Status & Open Work** - Decision mining, open threads, status inference, and interview loop
- [ ] **Phase 7: Guided Tours & Onboarding UX** - Default, role-based, and topic-thread tours with evidence stops
- [ ] **Phase 8: Hardening, Scale & Multi-Repo** - 100k+ commit indexing, temporal graph UI, and unified multi-repo story

## Phase Details

### Phase 1: Index Foundation

**Goal**: User can index a local git clone into a trustworthy `.gitchange/` derived cache without network access
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INGX-01, INGX-02, INGX-03, INGX-04, INGX-05, PRIV-01, PRIV-02, PRIV-03, SCALE-03, EVD-01, EVD-04
**Success Criteria** (what must be TRUE):

  1. User indexes a local clone and produces a schema-valid `.gitchange/` folder with no network calls
  2. Re-indexing processes only commits after `lastIndexedCommit` without a full rescan
  3. User sees freshness warnings when force-push or shallow-clone conditions are detected
  4. Secrets from fixture repos do not appear in generated artifacts; `.gitchangeignore` excludes configured paths
  5. Golden fixture tests pass for ingestion output and evidence-link integrity on the index schema

**Plans**: 8 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Monorepo scaffold, @gitchange/core shell, Vitest, synthetic-repo fixture builder

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Zod schemas + evidence contract + Drizzle tables + [BLOCKING] schema push

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — es-git ingestion: revwalk, commit parse, tree diff + rename detection
- [x] 01-04-PLAN.md — Privacy gate: .gitchangeignore matcher + secret redaction

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Walking Skeleton: end-to-end index orchestrator (full + incremental) → .gitchange/

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Freshness: shallow-clone (partial) + force-push halt + out-of-order warnings

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-07-PLAN.md — Doc snapshot ingestion (README/CHANGELOG/docs/ADR) content-addressed with evidence

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-08-PLAN.md — Golden fixtures: evidence-integrity, secret-leakage grep, ingestion snapshot, dogfood

### Phase 2: Repository Intelligence & Ownership

**Goal**: User can see who changed what through ownership timelines and contributor expertise derived from git history
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):

  1. User views per-file ownership computed from line survival at HEAD with rename tracking and ignore-revs support
  2. User sees per-era ownership timelines showing how file stewardship shifted over time
  3. User views contributor expertise profiles that suggest who to ask about specific topics or areas
  4. Intelligence artifacts (churn, co-change, era boundary signals) are available in `.gitchange/` for downstream agents

**Plans**: 5 plans

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Intelligence walking skeleton: Zod + Drizzle tables, churn from index, `computeIntelligence`, `intelligence.json`

**Wave 2** *(blocked on Wave 1; parallel)*

- [x] 02-02-PLAN.md — Line-survival ownership at HEAD via es-git blame + simple-git ignore-revs (CONT-04)
- [x] 02-03-PLAN.md — Co-change graph with path filters + era boundary signals (pre-LLM)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — Per-era ownership timelines + contributor expertise profiles (CONT-01, CONT-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-05-PLAN.md — Golden intelligence fixtures, evidence integrity, manifest checkpoint, optional index hook

### Phase 3: CLI & Plugin Scaffold

**Goal**: User can install GitChange, complete a first analysis, and open a minimal dashboard in a few steps — matching the Understand-Anything install → slash command → dashboard pattern
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, INST-01, INST-02, INST-03, INST-04
**Success Criteria** (what must be TRUE):

  1. User installs via plugin marketplace or one-line installer following the Understand-Anything packaging pattern (no manual config required)
  2. User completes first analysis with a single `/gitchange` slash command after install and sees meaningful output without extra setup
  3. User opens a minimal localhost dashboard via `/gitchange-dashboard` and sees initial value (index status, basic repo snapshot) without manual configuration
  4. User runs `gitchange index`, `gitchange serve`, and `gitchange status` successfully on an indexed repo from terminal
  5. Quickstart docs walk install → `/gitchange` → `/gitchange-dashboard` in under 5 steps
  6. Host AI receives structured tools and schemas only — GitChange does not embed its own LLM runtime

**Plans**: 6 plans

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Package scaffold + walking skeleton `gitchange index` (index + intelligence E2E)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — Hono server + `gitchange serve` / `gitchange status` + `/api/snapshot`

**Wave 3** *(blocked on Wave 2; 03-04 parallel with 03-02 after 03-01)*

- [x] 03-03-PLAN.md — Minimal React dashboard SPA (index status + repo snapshot)
- [x] 03-04-PLAN.md — Plugin slash commands (`/gitchange`, `/gitchange-dashboard`) + host-AI schemas

**Wave 4** *(blocked on Wave 3 partial — 03-04)*

- [x] 03-05-PLAN.md — Install UX + plugin path resolver (UA pattern)

**Wave 5** *(blocked on Waves 3–4)*

- [x] 03-06-PLAN.md — QUICKSTART (≤5 steps) + first-run integration test + validation matrix
**UI hint**: yes

### Phase 4: Era Detection & Semantic Pipeline

**Goal**: User can understand how the project evolved through named eras and inflection points backed by evidence bundles
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ERA-01, ERA-02, ERA-03
**Success Criteria** (what must be TRUE):

  1. User sees named engineering eras/chapters with bundled evidence (commits, file arrivals, pivot signals)
  2. Era summaries explain project evolution with every claim linked to commit SHA, file path, or doc excerpt
  3. User identifies inflection types — tech pivots, scope steering, process shifts, team/ownership changes — with linked proof
  4. Temporal graph artifact passes referential integrity validation before downstream consumption

**Plans**: TBD

### Phase 5: Dashboard & Evidence Drill-Down

**Goal**: User can explore project history interactively on localhost with full evidence drill-down from the pre-built index — expanding the minimal first-run dashboard delivered in Phase 3 into the complete drill-down experience
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-03, DASH-04, TIME-01, TIME-02, TIME-03, INGX-06, PRIV-04, EVD-02, SCALE-02
**Success Criteria** (what must be TRUE):

  1. User opens the full local web dashboard on localhost (same `/gitchange-dashboard` entry point from Phase 3) with era-aware views served from indexed artifacts
  2. User navigates an interactive timeline with era markers and drills era → commit → file → diff hunk
  3. User views a file-centric history scrubber for any indexed file without triggering live full-repo git walks
  4. User searches and filters commits by author, path, message keyword, and date range in the dashboard
  5. Dashboard shows index freshness and schema version; large commit lists remain responsive via virtualization

**Plans**: TBD
**UI hint**: yes

### Phase 6: Decisions, Status & Open Work

**Goal**: User can see what decisions were made, what's still in flight, and current progress — with honest confidence when evidence is weak
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: DEC-01, DEC-02, DEC-03, DEC-04, STAT-01, STAT-02, STAT-03, STAT-04, TIME-04, CONT-02, EVD-03
**Success Criteria** (what must be TRUE):

  1. User browses auto-mined decisions and migrations with status, evidence spans, and supersession relationships
  2. User sees "no recorded decision found" when evidence is below threshold instead of fabricated rationale
  3. Maintainer confirms or rejects auto-mined decisions via in-chat interview; answers persist to project docs or index
  4. User views open threads panel listing in-flight migrations, WIP refactors, and stale work with confidence scores
  5. Agent answers status queries (e.g., migration progress) with evidence citations and confidence; timeline and tour surfaces show inline badges for incomplete related work

**Plans**: TBD
**UI hint**: yes

### Phase 7: Guided Tours & Onboarding UX

**Goal**: New team members can take evidence-backed guided tours through project history from the dashboard
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04
**Success Criteria** (what must be TRUE):

  1. User completes a default guided onboarding tour of 4–6 chapters ordered by dependency and chronology
  2. User selects role-based tour variants (e.g., backend vs frontend emphasis) from the same indexed history
  3. User follows topic-thread tours (auth, database, named migrations) that span multiple eras
  4. Every tour stop shows linked evidence with drill-down to commits and files
  5. Tour player integrates with the Phase 5 dashboard drill-down surfaces for evidence navigation

**Plans**: TBD
**UI hint**: yes

### Phase 8: Hardening, Scale & Multi-Repo

**Goal**: User can analyze large monorepos and link multiple related repos into one unified, attributed story
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: SCALE-01, MULTI-01, MULTI-02, DASH-02
**Success Criteria** (what must be TRUE):

  1. System indexes repositories with 100k+ commits using incremental two-phase architecture within acceptable time
  2. User manually selects one or multiple related repos and sees a unified timeline with explicit repo attribution
  3. Unified tours present cross-repo narrative with clear repo attribution on every stop
  4. Dashboard includes timeline, temporal knowledge graph, and tour player views — all reading pre-existing index only

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Index Foundation | 8/8 | Complete   | 2026-07-01 |
| 2. Repository Intelligence & Ownership | 5/5 | Complete   | 2026-07-01 |
| 3. CLI & Plugin Scaffold | 6/6 | Complete   | 2026-07-01 |
| 4. Era Detection & Semantic Pipeline | 0/TBD | Not started | - |
| 5. Dashboard & Evidence Drill-Down | 0/TBD | Not started | - |
| 6. Decisions, Status & Open Work | 0/TBD | Not started | - |
| 7. Guided Tours & Onboarding UX | 0/TBD | Not started | - |
| 8. Hardening, Scale & Multi-Repo | 0/TBD | Not started | - |

---
*Roadmap created: 2026-06-30*
*Last revised: 2026-06-30 — Phase 3 First Run / Install UX; INST requirements; Phase 5 expands minimal dashboard*
*Granularity: fine (8 phases)*
*Mode: mvp (vertical slices)*
