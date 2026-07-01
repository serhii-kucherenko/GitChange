# Feature Research

**Domain:** Git-history onboarding / temporal codebase intelligence
**Researched:** 2026-06-30
**Confidence:** HIGH (competitor docs + GitChange PROJECT.md); MEDIUM on market-wide table-stakes consensus (no formal standard exists)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when they pick a "understand this codebase from git history" tool. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Git history ingestion** | Every competitor starts here; without commits/authors/files/messages the product has no input | MEDIUM | Must handle merges, renames, conventional commits, large monorepos. Deterministic parsing is non-negotiable — Repowise, Historex, Vestige, git-story all build on parsed git signals first |
| **Evidence-linked claims** | Users distrust AI archaeology that cannot be verified; git-why, Repowise `get_why`, Vestige milestones all anchor narratives to commits | MEDIUM | Every summary, era label, and decision must link to commit SHA(s), file path(s), or doc excerpts. Confidence scores when inference is weak |
| **Authorship & ownership visibility** | "Who changed what?" is question #1 in PROJECT.md and universal in GitLens, Repowise (ownership %, bus factor), Vestige (expert recommendations) | LOW–MEDIUM | Aggregate `git blame` / commit co-authorship into per-file and per-era profiles. Table stakes in IDE extensions; expected in onboarding tools too |
| **Interactive timeline** | Users need to scrub time, not read a wall of text — Vestige Time Travel, git-story HTML timeline, Historex evolution dashboards, VS Code Timeline view | MEDIUM | Chronological commit stream with filters (author, path, date). Minimum viable navigation before "story" features |
| **File-centric history** | New hires land on a file and ask "what happened here?" — GitLens File History, Vestige file tours, Codebase Time Machine time-travel mode | MEDIUM | Per-file commit list, diff preview, major-change highlights. Foundational drill-down target |
| **Commit → change drill-down** | Users expect to click a claim and see the proof — standard in GitLens Inspect, Repowise evidence drawer, Understand-Anything node detail | LOW | Era/summary → commit → file → hunk. Without this, tours are slideshows, not archaeology |
| **Local-first / offline-capable indexing** | Sensitive private repos dominate onboarding use case; Repowise self-hosted, Historex local LLM, Vestige local git all emphasize this | MEDIUM | Index from local clone; `.gitchange/` cache on disk. No required cloud account for core flow |
| **Incremental re-index** | Stale context is worse than none (Meta/Riftmap research); Repowise syncs per commit, Understand-Anything `--auto-update` | MEDIUM–HIGH | Re-process only new commits; invalidate affected eras/decisions. Required for "living" onboarding artifact |
| **Search & filter** | Find commits by author, path, message keyword, date range — baseline in GitLens Search & Compare, git-story filters | LOW | Fuzzy message search + structured filters. Users won't scroll 100k commits |
| **IDE / agent integration surface** | Target users live in Cursor/Claude Code; Repowise MCP, Understand-Anything slash commands, cADR agent skill set expectation | MEDIUM | Slash commands + queryable index artifacts. Host AI is the LLM — tool exposes structured context, not a chat UI |
| **Privacy controls** | Private-repo onboarding is primary persona; secret redaction and ignore patterns are expected hygiene | LOW–MEDIUM | `.gitchangeignore`, path/author redaction, no telemetry. Table stakes for trust, not a differentiator |
| **Contributor profiles** | "Who do I ask about X?" — Vestige expert recommendations, Repowise contributor profiles, Codebase Time Machine "who to pair with" | MEDIUM | Derived from ownership %, commit themes, era participation. Supports expertise question without org-chart integration |
| **Churn / hotspot signals** | Engineers expect "where is it risky?" — Repowise hotspots, Historex risk analysis, Vestige churn annotations, git-of-theseus | MEDIUM | Churn × complexity or commit-frequency ranking. Table stakes for maintainers; nice-to-have for pure onboarding but expected in "intelligence" products |
| **Exportable / persistent artifacts** | Onboarding briefs must survive the session — Repowise `.repowise/`, Understand-Anything `knowledge-graph.json`, git-story HTML/JSON | LOW | Generated index under `.gitchange/`; optional commit to repo. Users expect to share a link or file, not re-run analysis every time |

### Differentiators (Competitive Advantage)

Features that set GitChange apart. Not universally required, but aligned with PROJECT.md core value: **answer the five questions with evidence**, especially evolution, decisions, and open work.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Guided onboarding tours (era-based)** | Best-in-class narrative onboarding tied to real git evidence — gap vs Repowise (agent tools, no tour player), GitLens (blame, no story), Gource (eye candy, no learning path) | HIGH | Chapters ordered by dependency and chronology; progress tracking; importance badges. Vestige has file-level milestone tours; GitChange targets **project-level** era chapters |
| **Role-based tour variants** | Same repo, different onboarding paths — backend vs frontend vs PM — Codebase Time Machine "role-specific 2-week plans" validates demand; most tools don't ship this | MEDIUM | Filter eras/files/topics by role tags inferred from path ownership and commit themes |
| **Topic-thread tours** | Cross-cutting concerns (auth, payments, migration X) span eras — no competitor does this cleanly; Understand-Anything tours are structural, not temporal threads | HIGH | Thread = ordered stops across eras/commits/files for one concern. High value for "how did auth evolve?" |
| **Engineering era / chapter detection** | Answers "how did the project evolve?" with named phases — repo-saga heuristics, git-story chapters, Historex engineering eras, Vestige 8 milestone types | HIGH | Heuristic + LLM labeling with **evidence bundle** per era (commits, file arrivals, pivot signals). Differentiator when eras are editable and interview-validated |
| **Decision & migration mining** | Answers "what decisions were made?" — Repowise ADR layer, Drift decision mining, ContextWeaver archaeology, cADR generation; most stop at extraction, not ongoing tracker | HIGH | Extract from commit messages, doc deltas, conventional commits, inline markers. Link decisions to governed files in temporal graph |
| **Open-work / in-flight migration surfacing** | Answers "what's still in flight?" — **largely unaddressed** by competitors focused on past tense; PROJECT.md explicit differentiator | HIGH | Detect incomplete refactors (dual patterns, TODO clusters, partial directory moves), WIP conventional commits, stale migration docs. Open Threads panel + inline badges |
| **Status inference with confidence** | Distinguish "migration 80% done" from "abandoned experiment" — novel vs Repowise binary ADR status, Historex debt signals | HIGH | Pattern-based + keyword/trailer + docs-vs-code cross-ref; always show confidence and evidence |
| **Interview loop for weak evidence** | Closes gaps competitors leave fuzzy — ContextWeaver implies reasoning; GitChange makes maintainer Q&A first-class, flows into project docs | MEDIUM | Host AI asks maintainer when confidence low; answers become durable `.gitchange/` or project doc updates. Turns tool into living lore capture |
| **Temporal knowledge graph** | Files ↔ authors ↔ commits ↔ decisions ↔ eras in one navigable graph — Codebase Time Machine has this; Repowise has separate layers; GitChange unifies **time** as first-class dimension | HIGH | D3/similar interactive graph with time slider or era coloring. Structural graphs (UA, StakGraph) are adjacent, not substitutes |
| **Migration-centric tracker** | Track a named migration across commits/files (% complete, blockers) — no direct competitor; related to open-work surfacing | HIGH | User- or auto-detected migration threads with status timeline |
| **Multi-repo unified story** | Related repos (frontend + backend + infra) as one onboarding narrative — Repowise workspace mode validates cross-repo signals; few tools do **onboarding** across repos | HIGH | Manual repo selection at analysis time; unified era timeline and ownership. Deferred complexity but differentiating when shipped |
| **Tour player in local dashboard** | Understand-Anything pattern applied to **temporal** narrative — combined tour + timeline + graph in one UI | MEDIUM–HIGH | `/gitchange-dashboard` local server; era → commit → file drill-down in player. UX differentiation vs CLI-only archaeology tools (git-story, repo-saga) |
| **Docs-over-time analysis** | README/ADR/architecture doc evolution as evidence — Repowise wiki layer touches this; GitChange treats docs as canonical git-tracked evidence | MEDIUM | Diff doc files across eras; cross-reference doc claims vs code reality for status inference |
| **Plugin artifact pattern (`.gitchange/`)** | Team-opt-in committed index, agent-readable — proven by Understand-Anything `.understand-anything/` and Repowise `.repowise/` | LOW–MEDIUM | Enables CI refresh, PR review of lore, agent queries without re-index. Distribution pattern, not user-facing feature — but enables team workflows competitors scatter |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create trust, scope, or maintenance problems for a local-first git-history onboarding tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Ungrounded AI narratives** | "Just summarize the repo" feels fast | Hallucinated architecture, fabricated file paths, false confidence — research shows generated context can *decrease* agent success on well-known repos; worse on proprietary code | Every narrative block requires evidence links; show confidence; trigger interview loop when weak |
| **Cloud SaaS as core path** | Easier sharing, no local setup | Conflicts with privacy persona, adds ops burden, delays v1; PROJECT.md explicitly out of scope | Local server + optional committed `.gitchange/` artifacts; defer hosted mode |
| **GitHub/GitLab API as primary source** | Rich PR/issue context | Requires tokens, network, rate limits; misses local-only workflows; WhyLog/ContextWeaver depend on this — different product | Local git clone + tracked docs in v1; PR/issue mining as future optional layer |
| **Own LLM orchestration / model API** | "Built-in AI" marketing | Duplicates host Cursor/Claude; ongoing cost; splits trust model | Host chat is LLM; GitChange supplies tools, schema, artifacts, interview prompts |
| **Encyclopedic auto-generated wiki** | Copilot-style "docs for every file" | Noise, staleness, agents ignore walls of text; Repowise mitigates with incremental scoped wiki — still heavy | Era-scoped, tour-scoped narratives; link to evidence; regenerate surgically |
| **Full static dependency / call graph** | "Show me everything" | Understand-Anything, Repowise, StakGraph own this space; massive scope creep for temporal product | Temporal edges (co-change, co-authorship, decision governance) — not AST call graphs in v1 |
| **Animated repo visualization as primary UX** | Gource demos are impressive | Eye candy without learning path; doesn't answer "why" or "what's in flight"; performance cost on large repos | Optional export/screenshot; main UX = tour + timeline + evidence drill-down |
| **Replacing git blame / log / IDE history** | "One tool to rule them all" | GitLens/GitViz already excellent at line-level; users won't switch | Complement IDE tools; deep linking to file history; project-level story they lack |
| **Real-time collaborative lore editing** | Notion-like team wiki | CRDT/sync complexity, conflict with git-as-canonical; scope explosion | Maintainer interview → PR to project docs; `.gitchange/` as derived cache |
| **100% automated decision extraction** | "Zero manual ADRs" | Low recall on tacit decisions; false positives from noisy commits; Drift/ContextWeaver still need confidence thresholds | Auto-propose + human confirm via interview; explicit ADR import when present |
| **Mobile UI** | Read tours on phone | Poor fit for code evidence drill-down; PROJECT.md out of scope | Responsive dashboard nice-to-have; not a target platform |
| **Benchmark / code health scoring** | Repowise differentiator | Different product (defect prediction); requires static analysis corpus; distracts from onboarding spine | Surface churn/hotspot as context, not 1–10 health scores |
| **Always-on background indexing** | "Never think about it" | CPU/disk on dev machines; surprising network if misconfigured; privacy surprise | Explicit `/gitchange` invocation + optional hook; clear incremental updates |
| **Forking Understand-Anything codebase** | Faster start | Wrong abstraction (structural vs temporal); merge burden; PROJECT.md rejected | Inspired-by plugin packaging only; separate codebase |

## Feature Dependencies

```
[Git history ingestion]
    └──requires──> [Deterministic commit/file index]
                       └──requires──> [Schema validation + golden fixtures]
                       ├──requires──> [Incremental re-index]
                       ├──requires──> [Privacy / redaction layer]
                       └──requires──> [Search & filter]

[Churn / hotspot signals]
    └──requires──> [Git history ingestion]

[Contributor profiles]
    └──requires──> [Git history ingestion]
    └──enhances──> [Guided tours], [Interview loop]

[Era / chapter detection]
    └──requires──> [Git history ingestion]
    └──requires──> [Docs-over-time analysis] (optional but improves accuracy)
    └──requires──> [Decision mining] (for pivot labeling)

[Decision & migration mining]
    └──requires──> [Git history ingestion]
    └──requires──> [Docs-over-time analysis]
    └──requires──> [Evidence-linked claims]

[Status inference + confidence]
    └──requires──> [Decision & migration mining]
    └──requires──> [Docs-over-time analysis]

[Open-work / in-flight surfacing]
    └──requires──> [Status inference]
    └──requires──> [Migration-centric tracker]

[Temporal knowledge graph]
    └──requires──> [Git history ingestion]
    └──requires──> [Contributor profiles]
    └──requires──> [Decision mining]
    └──enhances──> [Era detection], [Tour player]

[Guided onboarding tours]
    └──requires──> [Era / chapter detection]
    └──requires──> [Evidence-linked claims]
    └──requires──> [Temporal knowledge graph] (for cross-links)

[Role-based / topic-thread tour variants]
    └──requires──> [Guided onboarding tours]
    └──requires──> [Contributor profiles]

[Tour player + local dashboard]
    └──requires──> [Guided onboarding tours]
    └──requires──> [`.gitchange/` artifact index]
    └──requires──> [Commit → file drill-down]

[Interview loop]
    └──requires──> [Status inference] (weak-evidence detection)
    └──enhances──> [Decision mining], [Era labels], [Open-work status]
    └──writes──> [Project docs / `.gitchange/`]

[IDE / agent slash commands]
    └──requires──> [`.gitchange/` artifact index]
    └──enhances──> [Interview loop], [Open-work queries]

[Multi-repo unified story]
    └──requires──> [Git history ingestion] (per repo)
    └──requires──> [Era detection] (cross-repo alignment)
    └──conflicts──> [v1 thin slice] (defer)

[Migration-centric tracker]
    └──requires──> [Open-work surfacing]
    └──enhances──> [Topic-thread tours]
```

### Dependency Notes

- **Era detection requires ingestion first:** Cannot narrate evolution without parsed commits, file paths, and timestamps. Era labels without evidence bundles are a differentiator only if provably grounded.
- **Tours require eras (or equivalent chapters):** Vestige file-milestone tours work at file scope; GitChange project tours need era segmentation or topic threading as scaffolding.
- **Open-work requires status inference:** Surfacing "in flight" without confidence + evidence reintroduces the trust problem that kills archaeology tools.
- **Interview loop enhances mining, not replaces it:** Weak-evidence detection gates when to ask humans; answers backfill decisions and eras competitors leave implicit.
- **Temporal graph enhances but should not block MVP:** A minimal timeline + tour can ship before full graph; graph is P2 for v1.x per thin-slice strategy.
- **Multi-repo conflicts with v1 thin slice:** Manual multi-repo is in Active requirements but should follow single-repo proof of ingest → tour → dashboard → commands.

## MVP Definition

Aligned with PROJECT.md thin vertical slice: prove end-to-end **ingest → tour → dashboard → agent commands** against the five core questions.

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Git history ingestion + `.gitchange/` index** — foundation for everything; deterministic, incremental, privacy-aware
- [ ] **Evidence-linked claims everywhere** — trust gate; without this, differentiation collapses
- [ ] **Interactive timeline + commit/file drill-down** — answers "who changed what?" and supports verification
- [ ] **Era/chapter detection (basic)** — answers "how did the project evolve?" with named phases + evidence
- [ ] **Guided onboarding tour (single default path)** — primary UX differentiator; one complete tour beats many shallow views
- [ ] **Decision mining (basic) + contributor profiles** — answers "what decisions were made?" and "who knows what?"
- [ ] **Open-work surfacing (minimal)** — at least detect obvious WIP/migration signals; answers question 4 at basic level
- [ ] **Status inference with confidence scores** — required for honest open-work and decision status
- [ ] **Local web dashboard (timeline + tour player)** — makes artifacts usable without re-running agents
- [ ] **Plugin slash commands (`/gitchange`, `/gitchange-dashboard`)** — distribution and agent query surface
- [ ] **Interview loop (basic)** — ask maintainer when evidence weak; write-back to index or docs

### Add After Validation (v1.x)

Features to add once core loop works on GitChange dogfood + one external OSS adopter.

- [ ] **Temporal knowledge graph UI** — trigger: users complete tours but still get lost cross-cutting; graph reduces disorientation
- [ ] **Role-based tour variants** — trigger: onboarding feedback that default tour is too broad
- [ ] **Topic-thread tours** — trigger: repeated questions about same concern across eras
- [ ] **Migration-centric tracker** — trigger: teams with named migrations want % complete, not just badges
- [ ] **Docs-over-time deep analysis** — trigger: decision mining false positives/negatives from code-only signals
- [ ] **Multi-repo unified story** — trigger: confirmed need from adopters with split repos
- [ ] **Auto-update on commit hook** — trigger: `.gitchange/` committed to repo and drifts annoy teams
- [ ] **Churn/hotspot dashboard panel** — trigger: maintainer persona adoption beyond new hires

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **GitHub/GitLab PR/issue mining** — rich archaeology but API-dependent; local-git wedge first
- [ ] **Hosted/synced team lore** — conflicts with local-first v1 positioning
- [ ] **IDE inline annotations (Vestige-style)** — different surface; dashboard + agent may suffice
- [ ] **Cross-repo static dependency federation** — Repowise territory; not temporal onboarding core
- [ ] **Animated history exports (Gource-style)** — marketing/demos, not learning path
- [ ] **ADR auto-write to `docs/adr/`** — cADR/Drift pattern; GitChange should propose, team chooses merge

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Git ingestion + incremental index | HIGH | HIGH | P1 |
| Evidence-linked claims + confidence | HIGH | MEDIUM | P1 |
| Timeline + commit/file drill-down | HIGH | MEDIUM | P1 |
| Era/chapter detection (basic) | HIGH | HIGH | P1 |
| Guided tour (default path) + tour player | HIGH | HIGH | P1 |
| Local dashboard | HIGH | MEDIUM | P1 |
| Plugin slash commands | HIGH | MEDIUM | P1 |
| Decision mining (basic) | HIGH | HIGH | P1 |
| Contributor profiles | HIGH | MEDIUM | P1 |
| Open-work surfacing (minimal) | HIGH | HIGH | P1 |
| Status inference | HIGH | HIGH | P1 |
| Interview loop | HIGH | MEDIUM | P1 |
| Privacy / `.gitchangeignore` | MEDIUM | LOW | P1 |
| Docs-over-time analysis | MEDIUM | MEDIUM | P2 |
| Temporal knowledge graph | HIGH | HIGH | P2 |
| Role-based tour variants | MEDIUM | MEDIUM | P2 |
| Topic-thread tours | HIGH | HIGH | P2 |
| Migration-centric tracker | MEDIUM | HIGH | P2 |
| Multi-repo unified story | MEDIUM | HIGH | P3 |
| Churn/hotspot panel | MEDIUM | LOW | P3 |
| PR/issue archaeology | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (thin vertical slice)
- P2: Should have, add when possible after v1 validation
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Repowise | Vestige | Codebase Time Machine | Historex / git-story | Understand-Anything | GitChange Approach |
|---------|----------|---------|----------------------|----------------------|---------------------|-------------------|
| **Primary lens** | Agent MCP + 5 intelligence layers | IDE temporal annotations | NL query + temporal graph | Engineering archaeology reports | Structural knowledge graph | **Temporal narrative + onboarding tours** |
| **Git ingestion** | ✅ 500–5k commits | ✅ Local git | ✅ Full history | ✅ Full history | ❌ Snapshot only | ✅ Full history, incremental |
| **Ownership / experts** | ✅ Ownership %, bus factor | ✅ Top 3 experts per file | ✅ Who to pair with | ✅ Contributor spread | ❌ | ✅ Per-file/era profiles |
| **Hotspots / churn** | ✅ Churn × complexity | ✅ Inline churn/age | ✅ Risk heatmap | ✅ Hotspot scoring | ❌ | ✅ Context signals (not health scores) |
| **Era / chapter narrative** | ⚠️ Significant commits only | ✅ 8 milestone types (file) | ⚠️ AI summaries | ✅ Engineering eras | ❌ | ✅ **Project-level eras + evidence** |
| **Guided tour** | ❌ | ✅ File milestone tour | ✅ Onboarding paths | ❌ | ✅ Structural tours | ✅ **Era + role + topic tours** |
| **Decision / ADR layer** | ✅ ADR + mining + `get_why` | ⚠️ Architecture milestone type | ✅ Auto ADRs | ✅ Decision journal | ❌ | ✅ Mining + **interview loop** |
| **Open / in-flight work** | ⚠️ ADR staleness only | ❌ | ❌ | ⚠️ Debt signals | ❌ | ✅ **Open Threads + migration tracker** |
| **Temporal graph** | ⚠️ Separate layers | ❌ | ✅ Files↔authors↔commits | ⚠️ Report visuals | ✅ Structural graph | ✅ **Time-first graph** |
| **Dashboard** | ✅ Local + hosted | ✅ VS Code panels | ✅ Web app | ✅ HTML + local web | ✅ Local web | ✅ Timeline + tour player |
| **Agent integration** | ✅ 9 MCP tools | ❌ | ⚠️ watsonx | ❌ | ✅ Slash commands | ✅ Slash commands + queries |
| **Local-first** | ✅ Self-hosted | ✅ | ⚠️ Cloud DB in README | ✅ | ✅ | ✅ Core requirement |
| **Multi-repo** | ✅ Workspace mode | ❌ | ❌ | ❌ | ⚠️ Path arg only | ✅ Manual selection (post-v1) |
| **Evidence drill-down** | ✅ Evidence drawer | ✅ Commit snapshots | ✅ Time scrub | ✅ Evidence-backed reports | ✅ Node detail | ✅ Era→commit→file |
| **Confidence / gaps** | ⚠️ Wiki confidence | ⚠️ AI fallback narratives | ❌ | ⚠️ LLM interpretation | ⚠️ Graph review | ✅ **Scores + interview loop** |

**Positioning summary:** Repowise wins on agent-tool breadth and static+git fusion. Vestige wins on in-editor temporal UX. UA wins on structural exploration. Historex/git-story/repo-saga win on one-shot archaeology reports. **GitChange wins on guided temporal onboarding with decision depth, open-work awareness, and maintainer interview loop** — the only product explicitly optimized for all five PROJECT.md questions in one evidence-backed flow.

## Sources

- [Repowise docs — What is repowise](https://docs.repowise.dev/getting-started/what-is-repowise) — five intelligence layers, git signals, ADR layer, MCP tools (HIGH)
- [Repowise Git history docs](https://docs.repowise.dev/intelligence/git-history) — hotspots, co-change, ownership (HIGH)
- [Vestige v1 README](https://github.com/codecharlan/vestige-v1) — inline temporal, file tours, milestones (HIGH)
- [Understand-Anything README](https://github.com/Egonex-AI/Understand-Anything) — plugin pattern, tours, dashboard (HIGH)
- [Codebase Time Machine README](https://github.com/yfwmaniish/codebase-time-machine) — temporal graph, onboarding mode, time travel (MEDIUM — thin repo metadata)
- [Historex README](https://github.com/beingbiplov/Historex) — engineering eras, archaeology reports (HIGH)
- [git-story README](https://github.com/sudokatie/git-story) — chapter detection, narrative HTML (HIGH)
- [repo-saga README](https://github.com/teee32/repo-saga) — heuristic era detectors with evidence (HIGH)
- [git-why README](https://github.com/muin-company/git-why) — function-level why narratives (HIGH)
- [ContextWeaver README](https://github.com/psreek-ai/ContextWeaver) — archaeology agent, briefing agent (HIGH)
- [Drift Decision Mining wiki](https://github.com/dadbodgeoff/drift/wiki/Decision-Mining) — ADR mining from git (HIGH)
- [GitLens marketplace](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) — IDE table-stakes features (HIGH)
- [AgentPatterns — onboarding artefact failure modes](https://agentpatterns.ai/workflows/agent-generated-onboarding-guide/) — anti-features for unreviewed guides (MEDIUM)
- [Riftmap — Meta tribal knowledge / graph-first](https://riftmap.dev/blog/meta-tribal-knowledge-engine-build-the-graph-first/) — stale context, evidence grounding (MEDIUM)
- GitChange `.planning/PROJECT.md` — five core questions, scope, differentiation intent (HIGH)

---
*Feature research for: git-history onboarding / temporal codebase intelligence (GitChange)*
*Researched: 2026-06-30*
