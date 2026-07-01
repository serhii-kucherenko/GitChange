# Phase 9: Dashboard UI Redesign - Research

**Researched:** 2026-07-01
**Domain:** Presentational redesign of an existing React 19 + Tailwind v4 local SPA dashboard
**Confidence:** HIGH (codebase-verified; every claim below is grounded in actual file paths and line references)

## Summary

Phase 9 is a **presentational redesign** of the working dashboard in `packages/dashboard/src/`. The design contract (`09-UI-SPEC.md`) is approved and locked. The job is to execute it safely — restructure JSX/class names and CSS, add per-view layouts, fix three named defects (era-label overlap, clipped list headers, cramped sidebar/dead-space) — **without touching component logic, API calls, or store wiring**.

The dashboard is a single-page app. All view orchestration lives in two files: `App.tsx` (state, queries, tab switching, content composition) and `layout/DashboardLayout.tsx` (the app frame + the fixed two-column grid that must be replaced). Every other component named in the UI-SPEC exists as a real file and is restyle-in-place. Data flow is: React Query fetches (`api/client.ts`, `snapshot.ts`) → Zustand stores (`store/drill.ts`, `store/tour.ts`, `store/workspace.ts`) → components render. Tab state is plain local `useState<IntelligenceTab>` in `App.tsx`; restyling the nav does not touch the handler.

The riskiest surface is `DashboardLayout.tsx`: it owns the shared frame AND the per-tab slotting logic (`intelligenceTab === "timeline" ? ...`). The UI-SPEC requires moving the tab nav out of the sidebar to a full-width bar, and replacing the single fixed grid with per-view layouts. This means `DashboardLayout` will be restructured (its props interface may change) and `App.tsx` will re-wire which nodes go into which slots — but the *content* nodes (`<EraTimeline/>`, `<CommitList/>`, etc.) and all the state/query logic stay identical.

**Primary recommendation:** Treat `DashboardLayout.tsx` as the single structural rewrite; treat all 20+ named components as scoped className/JSX-wrapper edits; treat `index.css` `.era-timeline` block as an additive CSS change. Validate with `turbo typecheck` + `turbo test` (existing suite must stay green — it is behavioral, not visual, so it will not break from restyling) + `turbo build` + a manual per-view visual checklist. Do NOT add new unit-test infrastructure for CSS.

## User Constraints (from CONTEXT.md)

No `*-CONTEXT.md` exists for this phase. The binding constraints come from the **approved `09-UI-SPEC.md`** (the design contract) and the phase objective. Treating those as locked:

### Locked Decisions
- **Theme:** Dark only. Keep existing Tailwind `slate-950/900` palette + `sky` accent. No light theme, no theme toggle. [CITED: 09-UI-SPEC.md §Locked Constraints]
- **Behavior preservation:** Presentational only. No changes to component logic, data fetching, or Zustand/React Query wiring. Preserve `api/client.ts`, `snapshot.ts`, `store/drill.ts`, `store/tour.ts`, `store/workspace.ts` unchanged. [CITED: 09-UI-SPEC.md §Scope guard]
- **No new dependencies.** Tailwind v4 (`@import "tailwindcss"`) + existing libs only (`vis-timeline`, `@xyflow/react`, `@tanstack/react-virtual`, `@tanstack/react-query`, `zustand`). No shadcn, no component library, no icon-font/icon dependency. [CITED: 09-UI-SPEC.md §Dependencies]
- **Design system values are fixed:** 4 type sizes / 2 weights, the spacing scale, the slate+sky color ladder, the 5 semantic state colors, the component treatment contract, and all copy strings are specified verbatim in the UI-SPEC and must be applied as written. [CITED: 09-UI-SPEC.md §Typography/§Spacing/§Color/§Copywriting]
- **Keep `onIntelligenceTabChange` handler** and existing `aria-current`/`role="alert"` usage. [CITED: 09-UI-SPEC.md §Primary tab nav / §Accessibility]

### Claude's Discretion
- **Active-tab treatment:** UI-SPEC allows underline (2px `sky-400` bottom border) OR filled `bg-slate-800` pill — spec states "underline preferred for the top-level nav." Planner picks one, applies consistently. [CITED: 09-UI-SPEC.md §Primary tab nav]
- **Whether `DashboardLayout` props interface changes.** The spec mandates the outcome (per-view layouts, full-width tab bar), not the exact prop shape. The planner may restructure the `DashboardLayoutProps` interface as long as `App.tsx` re-wiring stays behavior-neutral.
- **Whether to extract per-view layout sub-components** (e.g. a `TimelineViewLayout`) or keep it all in `DashboardLayout`. Either is acceptable; extraction may reduce diff risk.

### Deferred Ideas (OUT OF SCOPE)
- Federated/multi-repo era merge ("until federated era merge lands" copy stays as-is).
- Any write/delete/reset controls (dashboard is read-only over pre-built artifacts, SCALE-02).
- Light theme, theme toggle, icon library, shadcn/registry adoption.
- Swapping vis-timeline or @xyflow for another library.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | User can open a local web dashboard served on localhost from indexed artifacts | Already Complete (Phase 5). This phase must NOT regress the serve path: `packages/server/src/static.ts` serves `packages/dashboard/dist`. Redesign only changes what's inside the SPA; the build output contract (`vite build` → `dist/`) is unchanged. |
| DASH-02 | Dashboard includes timeline, temporal knowledge graph, and tour player views | All views exist (`EraTimeline`, `TemporalGraphView`, `TourPlayer`). Redesign gives each its own per-view layout. Logic preserved. |
| DASH-03 | Dashboard shows index freshness and schema version | `IndexStatusCard` (reads `loadState.data.manifest`) renders freshness/schema. Restyle-in-place as a rail card in the Timeline view. |
| DASH-04 | Dashboard virtualizes large commit lists for responsive navigation | `CommitList` (and `DecisionsPanel`, `MigrationThreadPanel`, `FileHistoryList`) use `@tanstack/react-virtual`. Redesign must keep virtualization intact — only container height/header placement changes (see Pitfall 1). |

**Note:** DASH-01..04 are all marked "Complete" in REQUIREMENTS.md from earlier phases. Phase 9 does not *implement* them — it improves their presentation. Verification is therefore "still works + looks per contract," not "newly built."

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App frame (header, tab nav, page width) | `layout/DashboardLayout.tsx` | `App.tsx` (slot wiring) | Shared chrome owns the frame; per-view body is slotted in |
| Per-view body layout (grid/split per tab) | `layout/DashboardLayout.tsx` | — | Spec moves layout ownership from one fixed grid to per-tab layouts here |
| View orchestration / tab state | `App.tsx` (`useState<IntelligenceTab>`) | — | Plain local state; not a store. Restyle must not relocate this |
| Data fetching | `api/client.ts`, `snapshot.ts` + React Query in `App.tsx`/components | — | LOCKED — untouched |
| Client UI state (selection, tour) | `store/drill.ts`, `store/tour.ts`, `store/workspace.ts` (Zustand) | — | LOCKED — untouched |
| Era timeline rendering | `EraTimeline.tsx` + `.era-timeline` in `index.css` | vis-timeline lib | Label strategy = CSS + `content`/`title` formatting only |
| List virtualization | `@tanstack/react-virtual` in list components | — | Height/header placement change only |
| Presentation (className, JSX wrappers, copy) | Every named component | `index.css` | The actual redesign surface |

## Standard Stack

No new packages. This phase uses only what is already installed. Verified from `packages/dashboard/package.json`:

### Core (already installed — DO NOT add or change versions)
| Library | Version (locked) | Purpose | Redesign role |
|---------|------------------|---------|---------------|
| react / react-dom | 19.2.7 | UI | JSX restructure only |
| vite | 8.1.2 | Bundler/dev server | `pnpm dev`, `vite build` |
| tailwindcss + @tailwindcss/vite | 4.3.2 | Styling (CSS-first) | The primary redesign tool |
| @tanstack/react-query | 5.101.2 | Server state | Untouched |
| @tanstack/react-virtual | 3.14.5 | List virtualization | Container/height adjustments only |
| vis-timeline + vis-data | 8.5.1 / 8.0.3 | Era timeline | `.era-timeline` CSS + label formatting |
| @xyflow/react | 12.11.1 | Temporal graph | Restyle canvas frame only |
| zustand | 5.0.14 | Client state | Untouched |

### Dev / validation tooling (already installed)
| Tool | Version | Purpose |
|------|---------|---------|
| typescript | 6.0.3 | `tsc --noEmit` typecheck (`pnpm typecheck`) |
| @biomejs/biome | 2.5.1 (root) | `biome check src` (`pnpm lint`) |
| vitest | (root workspace) | `turbo test` — jsdom env for `packages/dashboard/**` |
| @testing-library/react | 16.3.0 (root devDep) | Existing dashboard component tests |
| @testing-library/user-event | 14.6.1 (root devDep) | Interaction in existing tests |
| jsdom | (root) | Test env for dashboard, wired via `environmentMatchGlobs` |

**Installation:** none. `npm install`/`pnpm add` is a scope violation for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs **zero** external packages. All libraries are already present in `packages/dashboard/package.json` and the root workspace, and were verified in earlier phases. No slopcheck / registry run required.

## Existing Dashboard Component Tree (verified file map)

All files under `packages/dashboard/src/`:

```
App.tsx                         # view orchestration, queries, tab state, content composition
main.tsx                        # React root
index.ts                        # package entry
index.css                       # Tailwind @import + .era-timeline + .open-work-badge overrides
types.ts                        # local dashboard types (API duplicated — no @gitchange/core in bundle)
vite-env.d.ts
api/
  client.ts                     # LOCKED — fetch fns + react-query key helpers (tours/graph/etc.)
  commit-detail.ts              # LOCKED — commit detail fetch
  snapshot.ts (src/snapshot.ts) # LOCKED — fetchSnapshot / SnapshotLoadState
store/
  drill.ts                      # LOCKED — selectedEra/Commit/Thread, eraToCommitFilters
  tour.ts                       # LOCKED — activeTourId, hydrate/persist to storage
  workspace.ts                  # LOCKED — multi-repo snapshot
layout/
  DashboardLayout.tsx           # >>> STRUCTURAL REWRITE TARGET <<<
components/
  EraTimeline.tsx               # restyle + .era-timeline label strategy
  CommitList.tsx                # virtualized; header placement + container height
  CommitFilterBar.tsx           # restyle
  RepoFilterBar.tsx             # restyle
  IndexStatusCard.tsx           # restyle (rail card)  [DASH-03]
  EraDetailPanel.tsx            # restyle (rail card)
  FileHistoryScrubber.tsx       # restyle
  FileHistoryList.tsx           # virtualized; restyle
  FileHunkView.tsx              # restyle
  CommitDetailPanel.tsx         # restyle
  DecisionsPanel.tsx            # virtualized; two-pane restyle
  OpenThreadsPanel.tsx          # restyle
  MigrationThreadPanel.tsx      # virtualized; restyle
  TourPicker.tsx                # restyle
  TourChapterNav.tsx            # restyle
  TourPlayer.tsx                # restyle
  TourStopCard.tsx              # restyle (prose measure max-w-3xl)
  TemporalGraphView.tsx         # restyle canvas frame  (has .test.tsx)
  ConfidenceBadge.tsx           # exports ConfidenceBadge AND AttributionBadge — restyle
  OpenWorkBadge.tsx             # restyle (semantic state pill)
  RepoBadge.tsx                 # restyle
  DrillBreadcrumb.tsx           # restyle
  RepoSnapshot.tsx              # restyle
  temporal-graph-model.ts       # LOGIC — do not restyle (pure model)
utils/
  confidence.ts                 # LOGIC (+ .test.ts)
  open-work-match.ts            # LOGIC (+ .test.ts)
  open-work-badge-html.ts       # produces raw HTML string injected into vis-timeline item content
```

### Coverage check: UI-SPEC Component Inventory vs. actual files
- **Every component named in the UI-SPEC exists as a real file.** No missing components. `AttributionBadge` is a named export inside `ConfidenceBadge.tsx` (not its own file) — matches spec's `ConfidenceBadge`/`AttributionBadge` grouping. `TourStopCard.tsx` exists.
- **Files NOT covered by the UI-SPEC inventory (all logic/model — correctly excluded from restyle):** `api/*`, `snapshot.ts`, `store/*`, `types.ts`, `main.tsx`, `index.ts`, `temporal-graph-model.ts`, `utils/confidence.ts`, `utils/open-work-match.ts`, `utils/open-work-badge-html.ts`, `vite-env.d.ts`. These are LOCKED behavior — do not touch.
- **One nuance for the planner:** `utils/open-work-badge-html.ts` generates the `.open-work-badge` HTML string that `EraTimeline.formatEraLabel` injects into vis-timeline item `content`. The UI-SPEC keeps `.open-work-badge` classes (styled in `index.css`). The badge string counts against the era item's `max-width` budget — do NOT restyle the HTML generator; only ensure the CSS constrains the label box (see Era Timeline section).

## Architecture Patterns

### Current app frame + grid (the thing being replaced) — `layout/DashboardLayout.tsx`

Current skeleton (verified, lines 56-141):

```tsx
<div className="min-h-screen bg-slate-950 text-slate-100">
  <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
    <div className="mx-auto flex max-w-7xl ...">
      <h1 className="text-2xl font-semibold tracking-tight">GitChange</h1>
      <div>{attributionBadge}{headSha && <p>HEAD {sha7}</p>}</div>
    </div>
  </header>

  {/* THE FIXED GRID TO REPLACE */}
  <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8
                  lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
    <aside className="space-y-6">
      {/* loading/error/empty states jammed here */}
      {loadState.status === "ready" && (
        <>
          <nav aria-label="Intelligence views" className="flex rounded-lg border ...">
            {/* TAB NAV lives INSIDE the sidebar today */}
          </nav>
          {intelligenceTab === "timeline" ? (<>{sidebar}{fileHistory}</>) : intelligencePanel}
        </>
      )}
    </aside>
    <main className="min-h-[24rem] space-y-4">
      {intelligenceTab === "timeline" ? (<>{timeline}{commitFilterBar}</>) : null}
      {main}
    </main>
  </div>
</div>
```

**Key structural facts the planner needs:**
1. The tab `<nav>` is currently a child of `<aside>` (line 97-116). Spec moves it OUT to a full-width bar under the header.
2. Loading/error/empty states currently render inside `<aside>` (lines 74-93). Spec moves them to centered content region (`max-w-md`, vertically centered).
3. The grid `lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]` (line 72) is the single fixed layout for ALL tabs — this is the cram/dead-space defect. Spec replaces with per-view layouts.
4. `DashboardLayoutProps` currently exposes slots: `sidebar`, `fileHistory`, `timeline`, `commitFilterBar`, `main`, `intelligencePanel` (lines 13-23). These slots were designed around the old two-column grid; a per-view layout may need a different slot shape. The planner may redesign this interface — `App.tsx` (lines 225-258) is the only caller.

### Tab navigation wiring (confirm restyle won't touch the handler)

- Tab state: `const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceTab>("timeline")` — `App.tsx:41-42`. Plain local state, NOT a Zustand store.
- Handler passed down: `onIntelligenceTabChange={setIntelligenceTab}` — `App.tsx:229`.
- `IntelligenceTab` union type + `TAB_LABELS` map defined in `DashboardLayout.tsx:6-31`.
- Tab buttons call `onClick={() => onIntelligenceTabChange(tab)}` — `DashboardLayout.tsx:105`.
- `TourPlayer` and `TemporalGraphView` also call `setIntelligenceTab("timeline")`/`("decisions")` as drill callbacks (`App.tsx:192-193, 212`). **These cross-view drill callbacks MUST be preserved** — they are behavior, not styling.

**Conclusion:** restyling the nav = changing the button className map + adding `role="tablist"/tab"/aria-selected"` + roving focus. The handler, the state, and the union type stay. No data-flow change.

### vis-timeline era label + CSS location

- `formatEraLabel` (era-label content) is set in `EraTimeline.tsx:22-36`. It writes `era.name` (plus an optional open-work badge HTML string) into the vis-timeline item `content` (`toTimelineItems`, lines 38-49). **The overlap defect originates here:** full names go straight into `content` with no width constraint, and there is currently **no `title` field** on items → no hover tooltip.
- `.era-timeline` CSS overrides live in `index.css:13-61`. Today they set item border/background/text color and axis text color, plus `.open-work-badge` variants. **There is currently NO `max-width` / `text-overflow` / `white-space` rule on `.vis-item-content`** — that is exactly what the label strategy must add.
- The timeline container carries `className="era-timeline min-h-[7rem] ..."` — `EraTimeline.tsx:225`. Spec raises this to `min-h-[8rem]`.

**Targeted change surface for the label fix (3 spots, all in-scope):**
1. `index.css` — add `.era-timeline .vis-item .vis-item-content { max-width; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 8px; }`.
2. `EraTimeline.tsx toTimelineItems` — add `title: era.name` (native tooltip) to each item object. This is a data-shape addition to the vis-timeline item, not a logic/behavior change — safe and spec-mandated.
3. `EraTimeline.tsx:225` — bump `min-h-[7rem]` → `min-h-[8rem]`.

**Do NOT** change vis-timeline options (`margin: { item: 8 }` stays — spec §Spacing), and do NOT alter the `select`/`setSelection` logic (lines 106-175).

### Virtualized list pattern + the "clipped header" defect

Verified pattern (identical shape in `CommitList`, `DecisionsPanel`, `MigrationThreadPanel`, `FileHistoryList`):

`CommitList.tsx:185-241`:
```tsx
<section className="flex h-[min(70vh,40rem)] flex-col overflow-hidden rounded-lg border ...">
  <header className="border-b border-slate-800 px-4 py-3">   {/* header OUTSIDE scroll */}
    <h2 className="text-lg ...">Commits</h2>
    <p className="text-xs text-slate-500">{count} loaded ...</p>
  </header>
  <div ref={parentRef} className="flex-1 overflow-auto">     {/* scroll region */}
    <div style={{ height: virtualizer.getTotalSize(), position:"relative" }}>
      {virtualItems.map(row => <div style={{ position:"absolute", transform:`translateY(${row.start}px)` }}>...)}
    </div>
  </div>
</section>
```

- `CommitList` already puts its header outside the scroll region and uses a flex column with `flex-1 overflow-auto` — this is the *correct* pattern the spec wants. Its defect is the **fixed `h-[min(70vh,40rem)]`** on the section (line 186) rather than growing to fill the pane via flex from the parent layout.
- `DecisionsPanel.tsx:350-357` uses `max-h-[28rem] overflow-y-auto` on the scroll div — a **fixed max-height**, not a flex-fill. This is where "clipped first row / cramped" reads worst.
- `ROW_HEIGHT` constants are load-bearing for the virtualizer (`CommitList` ROW_HEIGHT=44, `DecisionsPanel` ROW_HEIGHT=56). **If a restyle changes row padding/height, the `estimateSize`/`ROW_HEIGHT` constant MUST be updated to match** or rows will overlap/gap. This is the single most likely way a "pure restyle" silently breaks a virtualized list — call it out in every list task.

**Spec contract for the fix:** header/toolbar stays outside the scroll region (already true), give the viewport an explicit min height that grows to fill the pane via flex (`min-h-[24rem]` + `flex-1`), add a persistent divider/fade so the boundary reads. No behavior change; container-class + row-height-constant change only.

### Recommended change taxonomy (for planner task grouping)

```
Wave A (frame) — DashboardLayout.tsx structural rewrite + App.tsx slot re-wiring
                 (header, full-width tab nav, per-view layouts, centered load/empty/error)
Wave B (CSS)   — index.css .era-timeline label strategy + EraTimeline.tsx title/min-h
Wave C (lists) — CommitList / DecisionsPanel / MigrationThreadPanel / FileHistoryList
                 header-outside-scroll + flex-fill height + ROW_HEIGHT audit
Wave D (leaf)  — restyle remaining leaf components + badges to the design-system contract
```
Waves B/C/D touch disjoint files and can parallelize once Wave A settles the layout slots.

### Anti-Patterns to Avoid
- **Rewriting a component's return-tree from scratch.** Wrap/adjust className; do not re-author the JSX logic. The smaller the structural diff, the lower the chance of breaking props/data flow.
- **Editing `store/*`, `api/*`, `snapshot.ts`, `utils/*.ts`, `temporal-graph-model.ts`.** These are logic, not presentation. Any diff here is a scope violation.
- **Changing a `ROW_HEIGHT`/`estimateSize` without changing the row's rendered height (or vice-versa).** They must move together.
- **Adding a `title`/tooltip via a new library or a React portal.** Use the native vis-timeline item `title` field.
- **Introducing new hues** (violet/rose etc.). Grep confirmed no `violet`/`rose-` currently in components — keep it that way; map any status onto the 5 semantic states.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List virtualization | Custom windowing | Existing `@tanstack/react-virtual` (already wired) | Already correct; only container height changes |
| Era tooltip on truncated label | React tooltip component / portal | vis-timeline native item `title` field | Zero deps, spec-mandated, no re-render risk |
| Tab state management | New store / context | Existing `useState<IntelligenceTab>` in App.tsx | Behavior is locked; only restyle the buttons |
| Focus rings / a11y states | Custom JS focus handling | Tailwind `focus-visible:ring-*` utilities | Spec specifies exact ring classes |
| Theme tokens | CSS-in-JS / config file | Tailwind v4 utility classes (+ existing `index.css`) | v4 is CSS-first; no `tailwind.config.js` exists |

**Key insight:** almost everything this phase needs already exists and works. The redesign is subtractive/reorganizing (move nav out, split layouts, constrain labels), not additive infrastructure.

## Common Pitfalls

### Pitfall 1: Restyle silently breaks a virtualized list
**What goes wrong:** Changing row padding without updating `ROW_HEIGHT`/`estimateSize` → overlapping or gapped rows; changing the scroll container so `parentRef`'s element no longer scrolls → virtualizer measures 0 height and renders nothing.
**Why:** `useVirtualizer` depends on (a) `getScrollElement()` returning the actual scrolling element and (b) `estimateSize` matching real row height.
**How to avoid:** Keep `ref={parentRef}` on the single scroll element; keep it `overflow-auto`; if a row's visual height changes, update the `ROW_HEIGHT` constant in the same edit. Affected files: `CommitList.tsx` (44), `DecisionsPanel.tsx` (56), `MigrationThreadPanel.tsx`, `FileHistoryList.tsx`.
**Warning signs:** blank list, jittery scroll, rows on top of each other.

### Pitfall 2: DashboardLayout prop-shape change desyncs App.tsx
**What goes wrong:** Restructuring `DashboardLayoutProps` without updating the single caller in `App.tsx:225-258` → TS error (good) or a slot silently rendered in the wrong place (bad).
**How to avoid:** Change the interface and the caller in the same task; rely on `tsc --noEmit` to catch mismatches. Preserve the cross-view drill callbacks (`onDrillToTimeline`, `onDrillToDecisions`) exactly.
**Warning signs:** typecheck failure; a view rendering another view's content.

### Pitfall 3: Tailwind v4 CSS-first assumptions
**What goes wrong:** Reaching for `tailwind.config.js` / `theme.extend` (v3 muscle memory) — there is **no config file**; v4 is wired purely via `@import "tailwindcss"` in `index.css` and the `@tailwindcss/vite` plugin in `vite.config.ts`.
**How to avoid:** Use utility classes directly. If a custom token is truly needed, use v4 `@theme { --color-...: ... }` inside `index.css` — but the spec's palette maps entirely to Tailwind's default slate/sky/emerald/amber/red scale, so no custom theme is required. Keep the existing `@import`, `.era-timeline`, and `.open-work-badge` blocks.
**Warning signs:** "unknown at-rule" errors; a config file appearing in the diff.

### Pitfall 4: Breaking the `.open-work-badge` HTML injected into vis-timeline
**What goes wrong:** Restyling `EraTimeline` and touching `open-work-badge-html.ts` or removing the `.open-work-badge` CSS classes → badges vanish or throw.
**How to avoid:** Leave `open-work-badge-html.ts` and the `.open-work-badge*` CSS classes (`index.css:34-61`) intact. Only add the `.vis-item-content` truncation rule around them.

### Pitfall 5: Losing accessibility that already exists
**What goes wrong:** Replacing the `<nav>`/`aria-current` tab markup with a new tablist and forgetting keyboard operability, or dropping `role="alert"` on error surfaces.
**How to avoid:** The spec's a11y contract is mostly additive — keep existing `aria-current`/`role="alert"`, add `role="tablist"/tab"/aria-selected"` + `focus-visible:ring-sky-400`. Verify tab is keyboard-reachable.

## Runtime State Inventory

This is a presentational redesign of source files only — no rename/migration of stored data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys/collections renamed. `store/tour.ts` persists tour position to storage keyed by `headSha` (unchanged). | None — verified: no store logic touched |
| Live service config | None — dashboard reads pre-built `.gitchange/` artifacts via `/api` proxy (`vite.config.ts` → `127.0.0.1:9876`). Server static path unchanged. | None |
| OS-registered state | None | None |
| Secrets/env vars | None referenced in dashboard restyle scope | None |
| Build artifacts | `packages/dashboard/dist/` is regenerated by `vite build`; served by `packages/server/src/static.ts`. A stale `dist` after redesign would serve the OLD UI. | Rebuild `dist` (`turbo build`) after changes; verify server serves new bundle |

**The canonical check:** after restyling, the ONLY runtime-affecting artifact is `packages/dashboard/dist/` — it must be rebuilt. Nothing else caches the UI.

## Code Examples

### Correct virtualized-list frame (header outside scroll, flex-fill) — target pattern
```tsx
// Source: existing packages/dashboard/src/components/CommitList.tsx:185-241 (already close to spec)
<section className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
  <header className="border-b border-slate-800 px-4 py-3">{/* sticky, non-scrolling */}</header>
  <div ref={parentRef} className="min-h-[24rem] flex-1 overflow-auto">
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {/* absolutely-positioned rows via translateY — UNCHANGED */}
    </div>
  </div>
</section>
```

### Era label truncation (CSS — additive to index.css)
```css
/* Source: 09-UI-SPEC.md §Era Timeline Label Strategy */
.era-timeline .vis-item .vis-item-content {
  max-width: 12rem;            /* planner picks a value that reads clean at ≤8 eras */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}
```
```tsx
// Source: EraTimeline.tsx toTimelineItems — add native tooltip
{ id: era.id, content: formatEraLabel(era, threads), title: era.name,
  start: new Date(era.startAt), end: new Date(era.endAt), type: "range" }
```

## State of the Art

| Old (in this codebase) | Redesign target | Impact |
|------------------------|-----------------|--------|
| One fixed `22rem`+`1fr` grid for all views | Per-view layouts under a shared frame | Fixes cram + dead space |
| Tab nav inside sidebar, `text-xs` pills that can wrap | Full-width tablist bar under header, `whitespace-nowrap` | Fixes "Open work" wrap defect |
| Era names dumped into vis-item `content`, no tooltip | `max-width`+ellipsis + native `title` | Fixes label overlap |
| Fixed `max-h`/`h-` on scroll panels | Flex-fill min-height panes | Fixes clipped rows / dead space |
| `slate-500` used for readable metadata | Raise floor to `slate-400` | WCAG AA compliance |

**Not deprecated, but reinforced:** Tailwind v4 CSS-first (no config file) is already the setup — keep it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `09-UI-SPEC.md` design contract is the binding source of locked decisions (no CONTEXT.md exists) | User Constraints | Low — spec status is `approved`; planner should still confirm no CONTEXT.md was added later |
| A2 | Existing dashboard tests are behavioral (store/interaction) and will not break from restyling | Validation Architecture | Low — verified: `TemporalGraphView.test.tsx` asserts store state + roles, not class names |
| A3 | A specific `max-width` value (e.g. `12rem`) for era labels reads clean at ≤8 eras | Code Examples | Low — planner/checker tunes at review; spec caps eras at 8 |

## Open Questions

1. **Does `DashboardLayoutProps` need a new slot shape for per-view layouts?**
   - What we know: current slots (`sidebar/fileHistory/timeline/commitFilterBar/main/intelligencePanel`) were built for the old grid; `App.tsx` is the only caller.
   - What's unclear: whether per-view layouts are cleaner as new props vs. as extracted sub-layout components.
   - Recommendation: planner decides; either is behavior-neutral. Keep the change in one Wave-A task with `App.tsx` so typecheck guards it.

2. **Exact era-label `max-width` and whether ellipsis alone suffices at realistic era counts.**
   - Recommendation: start with a value; the UI-checker validates "no run-together labels at 8 eras" per the spec's legibility target.

## Environment Availability

Purely source/config changes with no new external dependencies. All required tooling is in-repo (Node 22, pnpm, turbo, vite, vitest, biome — all present per root/dashboard `package.json`). No external service, database, or CLI beyond the existing dev toolchain is needed.

- Dev server: `pnpm --dir packages/dashboard dev` (Vite, proxies `/api` → `127.0.0.1:9876`).
- The `/api` backend (`@gitchange/server` on 9876) is only needed to see real data in the browser; it is NOT required for typecheck/test/build validation.

## Validation Architecture

> Proportionate to a **presentational** change. The correct validation is: types still compile, existing behavioral tests stay green (they assert logic/roles, not CSS), the production bundle builds, and a human confirms the visual contract per view. Do **not** stand up new CSS unit-test infrastructure.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root workspace config) + @testing-library/react 16.3.0 |
| Config file | `/vitest.config.ts` (dashboard runs under `jsdom` via `environmentMatchGlobs`) |
| Quick run command | `pnpm --dir packages/dashboard test` (→ `vitest run packages/dashboard/src`) |
| Full suite command | `turbo test` (all packages) |
| Typecheck | `turbo typecheck` (or `pnpm --dir packages/dashboard typecheck`) |
| Lint/format | `turbo lint` (Biome) |
| Build (bundle contract) | `turbo build` (→ `packages/dashboard/dist`, served by `@gitchange/server`) |

### Existing dashboard tests (must stay green — they gate behavior preservation)
- `components/TemporalGraphView.test.tsx` — renders graph, asserts drill-store state + `onDrillToTimeline` calls (mocks `@xyflow/react`). **Restyling must not change these outcomes.**
- `components/temporal-graph-model.test.ts` — pure model logic.
- `store/tour.test.ts` — tour store persistence.
- `utils/confidence.test.ts`, `utils/open-work-match.test.ts` — pure logic.

These are the behavioral safety net. Because they assert store state, ARIA roles, and callbacks — not class names — a correct restyle leaves them green. **A red test after a "restyle" is a signal that logic was accidentally touched.**

### Phase Requirements → Validation Map
| Req | Behavior to preserve/verify | Type | Automated command | New test needed? |
|-----|-----------------------------|------|-------------------|------------------|
| DASH-01 | SPA builds and serves from `dist` | build/manual | `turbo build` then load dashboard | No — build gate |
| DASH-02 | Timeline/Graph/Tours views render + drill | unit (existing) + manual | `pnpm --dir packages/dashboard test` (graph) + visual | No |
| DASH-03 | Index freshness/schema visible | manual visual | render `IndexStatusCard` in Timeline rail | No |
| DASH-04 | Large lists virtualized + full rows | manual visual + typecheck | scroll commit list; confirm no clipping | No |
| Contract | Design system applied per `09-UI-SPEC.md` | manual (UI-checker) | per-view visual checklist below | No |

### Sampling Rate
- **Per task commit:** `pnpm --dir packages/dashboard typecheck` + (if the touched file has a test) `pnpm --dir packages/dashboard test`.
- **Per wave merge:** `turbo typecheck && turbo lint && turbo test`.
- **Phase gate:** `turbo build` green + full `turbo test` green + manual per-view visual verification (checkpoint).

### Manual / visual verification checkpoints (the real acceptance surface for a restyle)
Run `pnpm --dir packages/dashboard dev` (with the server on 9876 for data) and confirm per view:
- [ ] **Header + tab nav:** full-width, tabs never wrap, active tab has `sky-400` underline, keyboard-focusable with visible ring.
- [ ] **Timeline:** era strip full-width `min-h-[8rem]`; labels ellipsis + hover tooltip, no run-together labels at ≤8 eras; rail cards (Index status, Era detail, File history) not cramped; commit list fills width, full header + first row visible, virtualization scrolls smoothly.
- [ ] **Decisions / Open work:** two-pane split; empty-pane copy per contract; no clipped rows.
- [ ] **Tours:** picker + player readable; prose at `max-w-3xl`; Next/Previous stop CTAs.
- [ ] **Graph:** canvas fills content width; helper strip, not a 22rem sidebar.
- [ ] **States:** loading/empty/error centered in content region (`max-w-md`), `role="alert"` preserved on error.
- [ ] **Contrast:** metadata `slate-400` (not `slate-500`) on card surfaces.

### Wave 0 Gaps
- **None required.** Existing test infra (Vitest + jsdom + Testing Library) already covers the behavioral safety net; a presentational redesign does not warrant new CSS unit tests. If the planner wants a single regression guard, the highest-value addition is a smoke render of `App`/`DashboardLayout` asserting each tab renders its view region without throwing — optional, not blocking.

## Security Domain

Not applicable to this presentational change under a meaningful threat model, but recorded for completeness:
- The dashboard is **read-only** over pre-built local artifacts (SCALE-02); this phase adds **no** data-fetching, no user input beyond existing filters, no write/delete actions (§Copywriting "Destructive actions: none").
- **V5 Input Validation:** unchanged — no new inputs introduced. Existing filters untouched.
- **One thing to preserve, not weaken:** `EraTimeline` injects an HTML string (`open-work-badge-html.ts`) into vis-timeline item `content`. This is existing, trusted, template-generated HTML (not user-derived). The redesign must NOT start injecting arbitrary/user strings as HTML into `content` — keep era names in text-truncated content and the badge as the existing controlled template. No new `dangerouslySetInnerHTML` should appear.
- No secrets, auth, crypto, or network surface changes. `security_enforcement` here reduces to "do not introduce an HTML-injection vector while restyling."

## Sources

### Primary (HIGH confidence — codebase-verified this session)
- `packages/dashboard/src/layout/DashboardLayout.tsx` — app frame, fixed grid, tab nav location
- `packages/dashboard/src/App.tsx` — tab state, queries, content composition, drill callbacks
- `packages/dashboard/src/components/EraTimeline.tsx` — `formatEraLabel`, `toTimelineItems`, no `title`, `min-h-[7rem]`
- `packages/dashboard/src/components/CommitList.tsx` / `DecisionsPanel.tsx` — virtualization pattern, ROW_HEIGHT, header/scroll structure
- `packages/dashboard/src/index.css` — Tailwind v4 `@import`, `.era-timeline`, `.open-work-badge`
- `packages/dashboard/package.json`, `vite.config.ts`, `tsconfig.json` — locked deps, Tailwind v4 vite plugin, no config file
- `/vitest.config.ts` — jsdom for dashboard, @testing-library present
- `packages/server/src/static.ts` / `paths.ts` — serves `dashboard/dist`
- `.planning/phases/09-dashboard-ui-redesign/09-UI-SPEC.md` — approved design contract
- `.planning/ROADMAP.md` §Phase 9, `.planning/REQUIREMENTS.md` DASH-01..04

### Project skills
- Checked `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, `.codex/skills/` — **none present** (confirmed by CLAUDE.md "No project skills found" and directory check). No UI/dashboard skill to apply.

## Metadata

**Confidence breakdown:**
- Component map / file paths: HIGH — every file listed was read or stat-verified.
- Structural change surface (`DashboardLayout`, tab wiring, era labels, virtualization): HIGH — exact line references.
- Validation approach: HIGH — existing tests read; framework/config verified.
- Exact numeric values (era `max-width`, final pane heights): MEDIUM — planner/checker tunes at review per spec's legibility target.

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (stable — no fast-moving external deps; bounded by internal codebase drift)
