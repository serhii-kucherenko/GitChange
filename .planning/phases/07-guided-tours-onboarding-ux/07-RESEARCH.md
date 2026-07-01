# Phase 7: Guided Tours & Onboarding UX — Research

**Researched:** 2026-07-01
**Domain:** Evidence-backed guided tours — default onboarding chapters, role/topic variants, tour player with drill-down
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `07-CONTEXT.md` exists for this phase. Locked decisions inherited from Phases 1–6 and project research (`ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md`).

### Inherited Locked Decisions (still binding)

- **D-16 / EVD-01:** Every narrative claim carries mandatory `evidence[]` with resolvable commit/file/doc refs; Zod-validated at write boundary.
- **PLUG-05:** Host AI is the LLM — GitChange supplies agent specs, bounded context JSON, schemas, and deterministic validators only; **no embedded LLM SDK**.
- **P3-D-03 / SCALE-02:** Dashboard and server read **pre-built `.gitchange/` only** — no live git walks in hot path.
- **P4-D-01:** Semantic artifacts live under `.gitchange/` with manifest checkpoint fields.
- **P4-D-06:** Stable artifact IDs use **`ulid`** prefixes (`tour:`, `chapter:`, `stop:`).
- **P6-D-07:** **`matchOpenWorkToSurface`** exported from `@gitchange/dashboard` for Phase 7 tour player — wire OpenWorkBadge on tour stops (STAT-03).
- **P6-D-03:** EVD-03 floor applies to decision-linked tour content — do not surface below-threshold decisions as affirmative tour claims.

### Phase 7 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P7-D-01:** New artifact **`.gitchange/tours.json`** (`ToursArtifact`) with multiple `Tour` definitions in one file; schema versioned via Zod; atomic tmp+rename write like `eras.json`.
- **P7-D-02:** **Default tour (TOUR-01):** exactly **4–6 chapters** ordered by era chronology with dependency hints (foundation/setup eras before feature eras); each chapter maps to 1+ `NamedEra` ids from `eras.json`.
- **P7-D-03:** **Role-based variants (TOUR-02):** `kind: "role"` tours with `roleTag` enum `backend | frontend | fullstack | maintainer`; path emphasis derived from `intelligence.expertise.topics[]` and top churn path prefixes — agent filters chapter stops, does not invent new eras.
- **P7-D-04:** **Topic-thread tours (TOUR-03):** `kind: "topic"` tours spanning multiple eras; seeds from `decisions.json` titles, `open-work.json` thread titles, and `expertise.topics[]`; ordered stops cross era boundaries via `eraIds[]` on chapters.
- **P7-D-05:** **TourStop contract:** every stop requires `narrative` (≤400 chars), `evidence.min(1)`, and `drillTarget` with at least one of `eraId`, `commitSha`, `filePath`, or `decisionId` — enables TOUR-04 drill-down without live git.
- **P7-D-06:** **Tour player drill-down:** `See evidence` actions call existing `useDrillStore` setters (`setSelectedEraId`, `setSelectedCommitSha`, `selectCommitAndFile`, `setSelectedDecisionId`) — same path as Phase 5/6 panels; switch main column to timeline drill when navigating from tour tab.
- **P7-D-07:** **Separate zustand `useTourStore`:** `activeTourId`, `chapterIndex`, `stopIndex`, `completedStopIds[]`; progress persisted to `localStorage` key `gitchange-tour-progress:<headSha>` (not server-side).
- **P7-D-08:** **Two-phase tour synthesis (TOUR-01):** (1) deterministic `outlineDefaultTourChapters()` from indexed eras + temporal graph era order; (2) host-LLM **tour-builder** agent refines narratives and adds role/topic tours — never invent era/decision/thread IDs absent from context bundle.
- **P7-D-09:** **Pipeline ordering:** Tour synthesis runs **after** `decisions.json` and `open-work.json` exist; extend pipeline with `runToursPipeline` setting manifest `toursComputedAt`, `toursHeadSha`, `toursSchemaVersion`.
- **P7-D-10:** **Caps (PITFALLS #9):** max 1 default tour, up to 3 role tours, up to 5 topic tours; default 4–6 chapters; topic tours max 8 stops; reject artifact exceeding caps at write boundary.
- **P7-D-11:** **Dashboard UX:** Add fourth intelligence tab **`tours`** beside Timeline | Decisions | Open work; tour player occupies sidebar + main split (picker in sidebar, player + drill panel in main).

### Claude's Discretion

- Exact roleTag → path prefix mapping table (recommend `packages/`, `src/server/` → backend; `src/components/`, `packages/dashboard/` → frontend)
- Topic tour title slugging from decision/thread ids
- Whether tour progress resets on headSha change (recommend yes — new progress key)
- `bindBasicScenarioToursTemplate` fixture names for golden tests

### Deferred Ideas (OUT OF SCOPE)

- Temporal knowledge graph **UI** (@xyflow/react — Phase 8 DASH-02)
- Multi-repo unified tours (Phase 8 MULTI-02)
- Tour completion analytics / telemetry (PRIV-01)
- Server-side progress sync
- Audio/video tour media
- LLM-generated tours without deterministic outline gate
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOUR-01 | Default guided onboarding tour 4–6 chapters by dependency and chronology | P7-D-02 outline + tour-builder agent; `ToursArtifact.defaultTourId` |
| TOUR-02 | Role-based tour variants (backend vs frontend emphasis) | P7-D-03 `kind: "role"` tours filtered by expertise paths |
| TOUR-03 | Topic-thread tours across eras (auth, database, migrations) | P7-D-04 seeds from decisions + open-work + expertise |
| TOUR-04 | Every stop shows linked evidence with drill-down to commits and files | P7-D-05 stop contract + P7-D-06 drillStore wiring |
</phase_requirements>

## Summary

Phase 7 delivers GitChange's **onboarding narrative layer** — the product differentiator called out in PROJECT.md and FEATURES.md. Phases 4–6 already produce eras, decisions, open-work threads, and a full drill-down dashboard. The gap is **no `tours.json` artifact**, **no tour-builder agent**, **no read API**, and **no tour player UI**.

The critical split mirrors Phase 4/6: **TypeScript outlines and validates** (deterministic chapter order from eras, Zod gate, integrity checker); **host LLM narrates** (tour-builder agent constrained to context IDs). PITFALLS #9 mandates ≤6 default chapters with evidence path on every stop — not a 25-step slideshow.

**Primary recommendation:** Five vertical MVP plans — (1) schemas + deterministic outline + context + I/O, (2) tour-builder agent + pipeline, (3) read API, (4) tour player + role/topic picker + drill integration, (5) golden fixtures + E2E gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tours Zod schemas | Core (`schema/zod/tours.ts`) | Plugin JSON Schema export | Contract before agents |
| Deterministic chapter outline | Core (`tours/outline.ts`) | eras.json order | TOUR-01 chronology without LLM |
| Tour synthesis context bundler | Core (`tours/context.ts`) | eras + decisions + open-work + intelligence | Bounded host-AI input |
| Artifact I/O + integrity | Core (`tours/tours-io.ts`, `verify/tours-integrity.ts`) | manifest checkpoint | Same pattern as eras/decisions |
| Tour-builder agent | Plugin (`agents/tour-builder.md`) | JSON schemas | PLUG-05 host LLM |
| Pipeline step | Core (`tours/pipeline.ts`) | `runToursPipeline` | After decisions pipeline |
| Read APIs | Server (`routes/tours.ts`) | core read fns | SCALE-02 |
| Tour player + picker | Client (`packages/dashboard`) | tourStore + drillStore | TOUR-02/03/04 UX |
| Open-work badges on stops | Client (`TourStopCard`) | `matchOpenWorkToSurface` | STAT-03 hook from Phase 6 |

**LLM tier:** tour-builder only — outline and integrity are deterministic.

## Standard Stack

### New for Phase 7

| Library | Version | Purpose | Package |
|---------|---------|---------|---------|
| *(none)* | — | Reuse existing stack | — |

`zustand@5.0.14` already in dashboard for drill state; add `useTourStore` in same package.

### Unchanged from Phase 1–6

| Library | Purpose |
|---------|---------|
| zod 4.4.3 | Artifact validation |
| hono 4.12.27 | Dashboard API |
| @tanstack/react-query 5.101.2 | Tour list/detail fetching |
| ulid 2.3.0 | Tour/chapter/stop IDs |

### Explicitly Deferred

| Item | Reason |
|------|--------|
| @xyflow/react tour graph view | Phase 8 DASH-02 |
| Multi-repo tour attribution | Phase 8 MULTI-02 |
| New tour npm UI library | Build on existing dashboard components |

## Package Legitimacy Audit

No new package-manager installs in Phase 7. Existing dependencies cover all capabilities.

| Package | Registry | Disposition |
|---------|----------|-------------|
| zustand | npm | [VERIFIED] already in @gitchange/dashboard |
| ulid | npm | [VERIFIED] already in @gitchange/core |
| zod | npm | [VERIFIED] |

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom tour JSON | Zod `ToursArtifact` + plugin JSON Schema | EVD-04 golden gate |
| Live git for stop evidence | Indexed artifact refs only | SCALE-02 |
| LLM-only tour structure | Deterministic outline gate | PITFALLS #9 overload + #2 hallucination |
| Separate drill navigation | Reuse `useDrillStore` | Phase 5/6 proven path |
| Third-party tour overlay lib | Native dashboard panels | Local-first; evidence drill is core UX |

## Common Pitfalls

### Pitfall 9: Tour Overload Without Evidence Path (PITFALLS.md)
**Mitigation:** P7-D-10 caps; default 4–6 chapters; every stop has `drillTarget`; reject stops without evidence at Zod write.

### Pitfall 2: Hallucinated Narrative
**Mitigation:** Agent constrained to context era/decision/thread IDs; `checkToursIntegrity` resolves all evidence SHAs against index; golden tests verify drill path.

### Pitfall 1: False Decision Claims in Tours
**Mitigation:** Skip decisions below EVD-03 floor in tour context bundler; tour-builder spec forbids citing `below_threshold` decisions.

## Codebase Starting Points

| Area | Path | Notes |
|------|------|-------|
| Era artifact | `packages/core/src/schema/zod/eras.ts` | Chapter era linkage |
| Decisions / open-work | `packages/core/src/schema/zod/decisions.ts`, `open-work.ts` | Topic tour seeds |
| Expertise topics | `packages/core/src/intelligence/expertise.ts` | Role path emphasis |
| Drill store | `packages/dashboard/src/store/drill.ts` | Extend consumers only |
| Open-work match | `packages/dashboard/src/utils/open-work-match.ts` | Phase 6 export |
| Decision agent pattern | `packages/plugin/agents/decision-miner.md` | Template for tour-builder |
| Pipeline | `packages/core/src/semantic/pipeline.ts` | Add `runToursPipeline` |
| Dashboard tabs | `packages/dashboard/src/layout/DashboardLayout.tsx` | Add `tours` tab |
| Orchestrator | `packages/plugin/agents/gitchange-orchestrator.md` | Phase 6 tour step |
| Validate CLI | `packages/cli/src/commands/validate.ts` | Optional tours integrity |

## Proposed ToursArtifact Shape

```typescript
// Conceptual — implement in packages/core/src/schema/zod/tours.ts

TourKind = "default" | "role" | "topic"
RoleTag = "backend" | "frontend" | "fullstack" | "maintainer"

TourStop = {
  id: string;           // stop:01H...
  title: string;
  narrative: string;    // max 400
  evidence: Evidence[]; // min 1
  drillTarget: {
    eraId?: string;
    commitSha?: string;
    filePath?: string;
    decisionId?: string;
  };
  eraIds?: string[];    // for topic-spanning context
}

TourChapter = {
  id: string;           // chapter:01H...
  order: number;
  title: string;
  summary: string;      // max 300
  eraIds: string[];     // min 1
  stops: TourStop[];    // min 1
}

Tour = {
  id: string;           // tour:01H...
  kind: TourKind;
  roleTag?: RoleTag;
  topicKey?: string;
  title: string;
  description: string;
  chapters: TourChapter[]; // default: 4-6
}

ToursArtifact = {
  schemaVersion: "1";
  computedAt: string;
  headSha: string;
  defaultTourId: string;
  tours: Tour[];        // 1 default + up to 3 role + up to 5 topic
}
```

## Multi-Source Coverage Audit (Planning)

| SOURCE | ID | Feature | Plan | Status |
|--------|-----|---------|------|--------|
| GOAL | — | Evidence-backed guided tours from dashboard | 07-04 | COVERED |
| REQ | TOUR-01 | Default 4–6 chapter tour | 07-01, 07-02, 07-05 | COVERED |
| REQ | TOUR-02 | Role-based variants | 07-02, 07-04 | COVERED |
| REQ | TOUR-03 | Topic-thread tours | 07-02, 07-04 | COVERED |
| REQ | TOUR-04 | Evidence + drill-down on every stop | 07-03, 07-04, 07-05 | COVERED |
| RESEARCH | P7-D-08 | Deterministic outline + LLM refine | 07-01, 07-02 | COVERED |
| RESEARCH | P7-D-07 | Tour progress localStorage | 07-04 | COVERED |
| RESEARCH | P7-D-06 | drillStore integration | 07-04 | COVERED |
| RESEARCH | STAT-03 hook | OpenWorkBadge on stops | 07-04 | COVERED |
| CONTEXT | P6-D-07 | matchOpenWorkToSurface reuse | 07-04 | COVERED |

---
*Research complete — ready for plan execution*
