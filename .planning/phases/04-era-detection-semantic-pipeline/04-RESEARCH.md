# Phase 4: Era Detection & Semantic Pipeline - Research

**Researched:** 2026-07-01
**Domain:** Host-LLM semantic synthesis over Phase 2 intelligence — named eras, inflection points, temporal graph artifacts
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `04-CONTEXT.md` exists for this phase. Locked decisions inherited from Phases 1–3 and project research (`ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`).

### Inherited Locked Decisions (still binding)

- **D-01 / D-17:** `.gitchange/index.sqlite` + `manifest.json`; whole `.gitchange/` gitignored by default.
- **D-16 / EVD-01:** Every narrative claim carries mandatory `evidence[]` with resolvable commit/file/doc refs; Zod-validated at write boundary.
- **P2-D-05:** Phase 2 `era_boundaries` are **deterministic signals only**; Phase 4 **names** eras and writes human-readable summaries — must anchor to signal IDs and commit windows, not invent boundaries.
- **PLUG-05:** Host AI is the LLM — GitChange supplies agent specs, bounded context JSON, schemas, and deterministic validators only; **no embedded LLM SDK**.
- **P3-D-02:** `gitchange index` always runs `computeIntelligence` after index; semantic artifacts are a **separate pass** triggered by `/gitchange` skill Phase 2 (not automatic on every index unless user runs full analysis).
- **P3-D-03:** Read paths (server, validators) use pre-built `.gitchange/` only — no live git walks.

### Phase 4 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P4-D-01:** Semantic artifacts live as JSON beside SQLite: **`eras.json`**, **`temporal-graph.json`**; additive manifest checkpoint fields (`semanticComputedAt`, `semanticHeadSha`, `semanticSchemaVersion`).
- **P4-D-02:** Era synthesis is **host-LLM** via `era-synthesizer` agent spec; core provides **`buildEraSynthesisContext()`** (bounded input) and **`writeErasArtifact()`** (Zod gate on output).
- **P4-D-03:** Inflection taxonomy is fixed enum per ERA-03: `tech_pivot`, `scope_steering`, `process_shift`, `team_ownership_change` — each inflection requires `evidence[]` and maps from intelligence signals where possible.
- **P4-D-04:** Temporal graph assembly is **deterministic** in `@gitchange/core` — merges `eras.json` + `intelligence.json` + index IDs into nodes/edges; no LLM in assembler.
- **P4-D-05:** Graph reviewer is **deterministic** (like `checkIntelligenceIntegrity`) — validates node/edge referential integrity before manifest semantic checkpoint is set.
- **P4-D-06:** Stable artifact IDs use **`ulid`** (`era:01H…`, `inflection:01H…`, graph node IDs) — sortable, collision-resistant per STACK.md.
- **P4-D-07:** Extend `Evidence` union additively with **`doc`** type (`path`, `commitSha`, `excerpt`) for era summaries citing README/ADR deltas (EVD-01 doc excerpt requirement).

### Claude's Discretion

- Exact temporal graph node cap for v1 (recommend ≤500 nodes, era-level aggregation first per PITFALLS)
- Context bundle size limits (recommend top 8 era signals, top 10 churn files, top 5 doc deltas)
- Whether `gitchange validate` is top-level or `gitchange semantic validate` subcommand
- Golden fixture era names for BASIC_SCENARIO

### Deferred Ideas (OUT OF SCOPE)

- contributor-lens agent (CONT-02 → Phase 6)
- decision-miner, tour-builder, status-inferencer (Phases 6–7)
- Temporal graph **UI** (@xyflow/react — Phase 8 DASH-02)
- Full interactive timeline drill-down (Phase 5 TIME-01–03)
- Interview loop for weak era evidence (Phase 6)
- Multi-repo era alignment (Phase 8)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERA-01 | Named engineering eras/chapters with evidence bundles | `ErasArtifact` Zod + `era-synthesizer` agent; signal ID linkage; `eras.json` |
| ERA-02 | User sees project evolution through era summaries tied to proof | `claims[]` with per-claim `evidence[]`; doc excerpt evidence; snapshot/API era highlights |
| ERA-03 | Inflection types with linked proof | `InflectionType` enum; inflection nodes in temporal graph; signal→type mapping rules in agent spec |
</phase_requirements>

## Summary

Phase 4 is the **first semantic (host-LLM) layer** atop the deterministic index and intelligence passes. It answers "how did the project evolve?" by turning Phase 2 `eraSignals.boundaries` into **named eras with evidence-backed summaries and typed inflection points**, then assembling a **temporal knowledge graph** artifact that downstream dashboard (Phase 5) and tours (Phase 7) consume without re-running agents.

The critical split: **LLM names and narrates** (era-synthesizer); **TypeScript assembles and validates** (context bundler, graph assembler, graph reviewer). This mirrors ARCHITECTURE Pattern 1 (deterministic-first, LLM-second) and avoids Pitfall 2 (hallucinated narrative without drill-down proof).

**Primary recommendation:** Five vertical MVP plans — (1) semantic schemas + context bundler walking skeleton, (2) era-synthesizer agent + plugin orchestration, (3) deterministic temporal graph assembler, (4) graph reviewer + manifest semantic checkpoint, (5) golden fixtures + `gitchange validate` + snapshot era slice for ERA-02 visibility.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Era/inflection/graph Zod schemas | Core (`schema/zod/`) | Plugin JSON Schema export | Contract for host AI + validators |
| Era synthesis context bundler | Core (`semantic/context.ts`) | intelligence.json, doc snapshots | Bounded JSON input to host LLM |
| Era artifact write/read | Core (`semantic/eras.ts`) | `.gitchange/eras.json` | Zod gate at persistence boundary |
| Era synthesizer agent | Plugin (`agents/era-synthesizer.md`) | Host AI runtime | LLM naming + summaries (PLUG-05) |
| Slash command orchestration | Plugin (skills, orchestrator) | CLI index output | Extends `/gitchange` Phase 2 semantic step |
| Temporal graph assembler | Core (`semantic/assemble-graph.ts`) | eras + intelligence + index | Deterministic merge — no LLM |
| Graph reviewer | Core (`verify/semantic-integrity.ts`) | golden tests | Referential integrity (ROADMAP success #4) |
| User-visible era summary | Server snapshot + plugin schemas | `getRepoSnapshot` era slice | ERA-02 without full dashboard |

**No new LLM tier in GitChange packages** — host chat executes agent markdown.

## Standard Stack

### Core (unchanged)
| Library | Version | Purpose |
|---------|---------|---------|
| **zod** | 4.4.3 | Eras, inflection, temporal graph validation |
| **better-sqlite3** | 12.11.1 | Resolve evidence refs in graph reviewer |
| **drizzle-orm** | 0.45.2 | Commit/file lookups for integrity checks |

### Added for Phase 4
| Library | Version | Purpose | When |
|---------|---------|---------|------|
| **ulid** | 2.3.0 | Stable era/inflection/graph node IDs | P4-D-06; Plan 04-01 |

### Unchanged / Explicitly Not Added
| Library | Reason |
|---------|--------|
| @xyflow/react | Graph **UI** deferred to Phase 8 |
| OpenAI/Anthropic SDK | Forbidden by PLUG-05 |
| vis-timeline | Dashboard timeline — Phase 5 |

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| ulid | npm 2.3.0 | **[OK]** — STACK.md approved; ~2M weekly downloads |

No other new runtime packages in Phase 4.

## Architecture Patterns

### Semantic Pipeline (post-intelligence)

```
.gitchange/intelligence.json (eraSignals, churn, coChange, eraOwnership, expertise)
.gitchange/index.sqlite (commits, file_changes, doc_snapshots)
        │
        ├─▶ buildEraSynthesisContext() ──▶ bounded JSON for host AI
        │
Host LLM: era-synthesizer agent spec
        │
        └─▶ writeErasArtifact() ──▶ .gitchange/eras.json (Zod-validated)
                │
                ▼
        assembleTemporalGraph() ──▶ .gitchange/temporal-graph.json
                │
                ▼
        checkSemanticIntegrity() ──▶ manifest semantic checkpoint
```

### Pattern 1: Signal-Anchored Eras
Every era record includes `signalIds[]` referencing `intelligence.eraSignals.boundaries[].id` and commit window `[startCommitSha, endCommitSha]` that must overlap the linked signals. Agent must not create eras outside indexed commit range.

### Pattern 2: Claims Array for ERA-02
Era `summary` is a short lead; detailed evolution narrative uses `claims: [{ text, evidence[] }]` so every sentence is individually provable (EVD-01).

### Pattern 3: Inflection Taxonomy (ERA-03)
| InflectionType | Typical signal sources |
|----------------|------------------------|
| `tech_pivot` | `path_churn_pivot`, new top-level dirs, stack file arrivals |
| `scope_steering` | `cc_scope_shift`, README scope language deltas |
| `process_shift` | Conventional commit type ratio changes, CI/config churn |
| `team_ownership_change` | `author_spike`, `eraOwnership` steward shifts |

### Pattern 4: Temporal Graph Node Types (v1)
`era`, `commit`, `file`, `contributor`, `inflection` nodes; edges: `era_contains_commit`, `commit_touches_file`, `contributor_authored_commit`, `era_has_inflection`, `files_co_changed` (from co-change, labeled correlation).

Cap graph at era-level file aggregation initially — file nodes only for files referenced in era evidence bundles (PITFALLS graph layout).

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Random era/graph IDs | ulid | Sortable stable IDs across artifacts |
| LLM boundary detection | Phase 2 era signals + agent naming | P2-D-05; avoid hallucinated boundaries |
| Custom JSON schema | Zod → plugin JSON Schema (existing pattern) | PLUG-05 bounded payloads |
| Graph integrity checks | Extend `verify/` pattern from Phase 2 | Proven EVD-04 approach |

## Common Pitfalls

### Pitfall 2: Hallucinated Narrative
**Mitigation:** Zod `claims[].evidence.min(1)`; graph reviewer rejects dangling refs; golden fixtures test link integrity.

### Pitfall 5: Shallow History
**Mitigation:** Propagate `attributionConfidence: degraded` from intelligence into era context; agent spec instructs lower confidence language.

### Pitfall 9: Tour/Era Overload
**Mitigation:** Cap named eras at 4–8 chapters aligned with signal count; agent spec enforces limit.

## Code Examples

### Doc evidence (additive EVD-01)
```typescript
// schema/zod/evidence.ts — add to discriminated union
z.object({
  type: z.literal("doc"),
  path: z.string(),
  commitSha: z.string().length(40),
  excerpt: z.string().max(500),
})
```

### Era record shape (abbreviated)
```typescript
const NamedEra = z.object({
  id: z.string(), // ulid
  name: z.string().min(3).max(80),
  summary: z.string().max(500),
  startCommitSha: z.string().length(40),
  endCommitSha: z.string().length(40),
  startAt: z.number().int(),
  endAt: z.number().int(),
  signalIds: z.array(z.number().int()).min(1),
  inflections: z.array(InflectionPoint),
  claims: z.array(EraClaim).min(1),
  evidence: z.array(Evidence).min(1),
});
```

## Validation Architecture

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| ERA-01 | eras.json validates; signalIds resolve | unit/golden | `pnpm vitest run tests/golden/semantic` |
| ERA-02 | Every claim has ≥1 evidence ref | unit | `pnpm vitest run packages/core/src/verify/semantic-integrity` |
| ERA-03 | Each inflection has typed category + evidence | unit | same |
| GOAL #4 | temporal-graph.json passes referential integrity | golden | `pnpm vitest run tests/golden/semantic` |
| PLUG-05 | No LLM SDK in core/plugin/cli | integration grep | `pnpm vitest run tests/integration/plugin-schemas` |

### Wave 0 Gaps
- [ ] `tests/fixtures/semantic/eras-basic-scenario.json` golden era artifact
- [ ] `tests/golden/semantic.test.ts`
- [ ] `packages/core/src/schema/zod/eras.ts`, `temporal-graph.ts`

## Security Domain

| Threat | Category | Mitigation |
|--------|----------|------------|
| Host AI writes unbounded eras.json | Tampering | Zod max lengths; `writeErasArtifact` rejects oversize |
| Dangling evidence refs in semantic artifacts | Tampering | `checkSemanticIntegrity` before manifest checkpoint |
| Malicious excerpt injection in doc evidence | Information Disclosure | Excerpt max 500 chars; no raw secret content from index (PRIV-02 already redacts at ingest) |
| ulid typosquat on npm install | Supply chain | Package audit [OK]; T-04-SC in threat model |

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Phase 2 BASIC_SCENARIO produces ≥1 era boundary signal | Low — `timeline_segment` fallback exists |
| A2 | Host AI can produce valid JSON matching schema when given agent spec + context | Medium — golden fixture provides deterministic fallback for tests |
| A3 | Era-level graph (not full file tree) sufficient for Phase 4 success criteria | Low — full file nodes added only for evidence-referenced paths |

## Open Questions

1. **Auto-run semantic on index?** Recommendation: **no** — semantic pass explicit in `/gitchange` skill after index (user may re-run intelligence without re-synthesizing eras).
2. **Incremental semantic updates?** Recommendation: defer to Phase 8; Phase 4 full regenerate on semantic pass.

## Sources

- `.planning/research/{ARCHITECTURE,SUMMARY,PITFALLS,FEATURES}.md`
- Phase 2 summaries `02-03`, `02-05` — era signals + integrity patterns
- Phase 3 summaries `03-04`, `03-06` — plugin orchestration + PLUG-05 gates
- `packages/core/src/intelligence/era-signals.ts` — signal types and evidence pattern
- `packages/core/src/verify/intelligence-integrity.ts` — integrity checker template
- STACK.md — ulid for artifact IDs

**Research date:** 2026-07-01
**Valid until:** ~2026-08-01
