# Pitfalls Research

**Domain:** Git-history onboarding / codebase archaeology tools (local-first, AI-plugin UX)
**Researched:** 2026-06-30
**Confidence:** HIGH (multiple corroborating sources: competitor implementations, MSR research, production post-mortems, GitChange requirements)

## Critical Pitfalls

### Pitfall 1: Treating Git History as Decision Evidence

**What goes wrong:**
The tool narrates *why* architecture changed from commit diffs and messages alone. Refactors, dependency bumps, formatting campaigns, and file moves get classified as "decisions" (e.g., "migrated to microservices" because folders moved). Users trust the tour/dashboard, then make wrong changes based on invented rationale.

**Why it happens:**
Git records *what* changed, not *why*. Competitors explicitly note that <5% of decisions are written as ADRs; teams fill the gap with LLM inference. Refactoring and renames produce large diffs that look architecturally significant. Decision-mining tools (Drift, Repowise) report high false-positive rates without confidence gating.

**How to avoid:**
- Separate **evidence** (commit SHA, diff hunk, doc quote) from **inference** (LLM summary) in the schema; never surface inference without linked proof.
- Implement a hard fallback: *"No recorded decision found"* when evidence is below threshold (archaeo pattern).
- Filter noise commits before decision clustering: merges, `bump`/`chore`/`format`/`lint`, lockfile-only, generated-code paths.
- Require multi-signal agreement for high-confidence decisions (commit message keywords + structural change pattern + doc mention).
- Mark all mined decisions `draft` until maintainer confirms (Drift `confirmed` / `rejected` workflow).

**Warning signs:**
- Decision list is longer than the repo's ADR/README count by an order of magnitude.
- "Migration complete" decisions with only rename/delete diffs and no message context.
- Tour chapters cite commit messages like `fix`, `wip`, `address review` as architectural rationale.
- Users report "this never happened" on the first dogfood repo.

**Phase to address:**
Phase 3 (Decision & Migration Mining) — design confidence model and evidence linking here; cannot be bolted on later.

---

### Pitfall 2: Hallucinated Narrative Without Drill-Down Proof

**What goes wrong:**
AI-generated tours, era summaries, and decision cards read convincingly but cite wrong files, stale line numbers, or commits that don't support the claim. Onboarding value collapses the first time a new hire verifies a cite and it's wrong.

**Why it happens:**
Host LLM fills gaps when the plugin doesn't enforce evidence contracts. Code-tour generators optimize for narrative flow over verifiable anchors. LACY study (controlled deployment): AI-only tours scored 57% on comprehension quizzes vs 83% for expert-curated tours with the same codebase.

**How to avoid:**
- Every narrative claim in `.gitchange/` must reference `commit_sha`, `path`, and optional `hunk_id` — schema-validated, not prompt-honor-system.
- Golden fixtures for AI outputs: expected decisions/tour steps with mandatory evidence fields; fail CI if missing.
- Dashboard drill-down is the proof path: clicking a claim must open the exact commit diff or doc excerpt, not a paraphrase.
- Distinguish **verified** (deterministic match) vs **inferred** (LLM) with visible confidence badges in UI and agent responses.
- Interview loop triggers when evidence is weak — ask maintainer, persist answer back to project docs (GitChange core differentiator).

**Warning signs:**
- Tour checkpoints reference `file:line` that don't exist at HEAD.
- Agent answers "why" without returning commit SHAs in tool output.
- Golden tests only check JSON shape, not evidence link integrity.
- Dashboard looks polished but "View evidence" links 404 or show unrelated diffs.

**Phase to address:**
Phase 3 (Decision Mining) and Phase 5 (Guided Tours) — shared evidence contract; Phase 6 (Dashboard) must enforce drill-down before v1 demo.

---

### Pitfall 3: Authorship and Ownership Conflation

**What goes wrong:**
"Who owns auth?" points to the release manager who squash-merged 80% of PRs, or the intern who ran `prettier --write`. Bus-factor and expertise profiles misidentify risk and misroute interview questions to wrong people.

**Why it happens:**
`git blame` and last-committer heuristics dominate because they're easy. Squash merges, rebase-squash workflows, and move+edit sequences attribute lines to the wrong author. git-archaeologist explicitly lists "commit authorship ≠ knowledge ownership" and "squash merges distort concentration scores" as known limitations.

**How to avoid:**
- Compute ownership from **line survival at HEAD** with rename/move tracking (`git log --follow`, blame `-M/-C`), not last-committer alone.
- Support `.git-blame-ignore-revs` and equivalent ignore list in `.gitchangeignore` for formatting/rename campaigns.
- Treat squash-merge repos as lower-confidence for per-author expertise; surface "attribution degraded" warnings.
- Prefer co-change + review-proxy signals only when available locally; don't pretend PR reviewer data exists (v1 is clone-only).
- Folder-level bus factor, not repo-level aggregates (git-archaeologist pattern).

**Warning signs:**
- One author owns >50% of lines in a multi-team monorepo.
- Expertise profile peaks on `package-lock.json`, `go.sum`, or generated protobuf paths.
- Ownership heatmap flips entirely after a formatting commit.
- Contributor lens contradicts what the team knows about who designed a subsystem.

**Phase to address:**
Phase 2 (Temporal Analysis & Ownership) — ownership model must be designed before tours/decisions attribute people.

---

### Pitfall 4: Full-History Rescan Architecture

**What goes wrong:**
Initial analysis or dashboard load runs `git log -p` across 100k+ commits on every session. Cold start takes hours, laptops fan-spin, MCP/plugin commands timeout, and users abandon before seeing value.

**Why it happens:**
Teams prototype with small repos and shell out to git per query. Git Context post-mortem: "fragile chain of synchronous operations" and "reprocessing the same files over and over" broke at ~50k commits. libgit2-based indexers show poor multi-core scaling and memory starvation on UE-scale repos. Cursor-style per-clone full indexing fails at enterprise monorepo scale.

**How to avoid:**
- **Two-phase architecture** (agent-analyzer, Repowise, Chisel pattern): `init`/`update` builds `.gitchange/` artifact; all queries read the cache.
- Incremental `update` from `analyzedUpTo` SHA; detect force-push (recorded SHA missing) → full rebuild with explicit user notice.
- Batch git plumbing: group commits by topology, fetch path-scoped diffs, cache parse results keyed by `(path, blob_sha)`.
- Bounded first run: default commit window with clear "analyze deeper" option; Repowise docs note diminishing returns past ~300–500 commits for behavioral signals (GitChange may go deeper for narrative, but must be incremental).
- Monorepo path scoping and optional sharding for multi-package repos (Chisel `CHISEL_SHARDS` pattern).
- Progress streaming: newest-first partial results in UI while backfill continues (Gittyup indexer discussion).

**Warning signs:**
- Any dashboard interaction shells out to `git log`.
- Re-running `/gitchange` after one new commit reprocesses entire history.
- Memory grows linearly with total commits during query, not during index build.
- No `analyzedUpTo` / index version field in `.gitchange/` metadata.
- Dogfood on GitChange repo works; 100k-commit fixture times out.

**Phase to address:**
Phase 1 (Core Git Ingestion & Index Schema) — architectural commitment; hardest to retrofit.

---

### Pitfall 5: Ignoring Git History Integrity Edge Cases

**What goes wrong:**
Timeline shows impossible orderings (child older than parent), broken rename chains, missing pre-2014 history artifacts, or silent wrong results from shallow clones. Era boundaries land on rebases instead of product pivots.

**Why it happens:**
Git allows backdated commits, out-of-order timestamps, history rewrites, and shallow clones. MSR 2021 "Escaping the Time Pit" documents out-of-order commits and recommends filtering strategies. Rebase/squash breaks `git log -L` tracking (empirical clone-study paper). Teams clone with `--depth` for speed.

**How to avoid:**
- Index metadata records: `shallow`, `missing_parents`, `out_of_order_count`, `ignore_revs_file` applied.
- Filter or flag out-of-order commits; prefer committer date with author date fallback; document which timeline axis the UI uses.
- Detect shallow clone → banner: "History incomplete; ownership/decisions may be wrong."
- Force-push detection invalidates incremental cursor (agent-analyzer pattern).
- Era/changepoint detection uses robust signals (author count, path churn, message topics), not raw commit count alone; validate boundaries against doc milestones where possible.
- Support `git blame --ignore-revs-file` equivalent in ownership pipeline.

**Warning signs:**
- Timeline inversions (feature ships before it was created).
- Rename tracking drops file history after a move commit.
- Same repo analyzed on full vs shallow clone produces different era count with no warning.
- Changepoint on every large merge commit.

**Phase to address:**
Phase 1 (Ingestion) for detection/flags; Phase 2 (Eras & Timeline) for segmentation logic.

---

### Pitfall 6: Co-Change and Hotspot False Signals

**What goes wrong:**
"Hidden coupling" warnings fire between `package-lock.json` and every touched source file. Hotspot scores flag generated code, vendored assets, or CI config. Risk map sends new hires away from the actual core logic.

**Why it happens:**
Co-change is computed from same-commit file sets without semantic filtering. Mass refactors, lockfile updates, and codegen commits create spurious edges. Repowise mitigates with temporal decay and import-graph distinction; git-archaeologist excludes changelogs/lockfiles from curse scores.

**How to avoid:**
- Exclude paths via `.gitchangeignore` (lockfiles, `dist/`, `vendor/`, generated stubs).
- Weight co-change by patch similarity or shared semantic module, not bare co-occurrence.
- Separate **behavioral** hotspots (human source churn) from **artifact** hotspots (generated/deps).
- Decay co-change edges over time (Repowise temporal decay pattern).
- Never present co-change as structural dependency in tours without "historical correlation, not import" label.

**Warning signs:**
- Top hotspots are lockfiles, snapshots, or `*.pb.go`.
- Co-change graph is dense clique around `pnpm-lock.yaml`.
- "Files that break together" list includes unrelated packages after a monorepo-wide rename commit.

**Phase to address:**
Phase 2 (Temporal Analysis) for metrics; Phase 4 (Open Threads / risk surfacing) for user-visible warnings.

---

### Pitfall 7: Stale or Forked Index vs Canonical Git/Docs

**What goes wrong:**
`.gitchange/` says migration X is in flight; `main` finished it last week. Team commits index to repo; branches diverge; dashboard shows contradictory state to different users. Maintainers stop trusting the tool.

**Why it happens:**
Treating generated index as source of truth instead of derived cache. No invalidation on new commits, branch switch, or doc update. UA pattern encourages committing graph JSON for sharing — works for structural graphs, riskier for temporal/inference state.

**How to avoid:**
- **Git + project docs are canonical**; `.gitchange/` is query cache (GitChange key decision). Store `indexed_at`, `head_sha`, `branch`, `index_schema_version`.
- Incremental re-index on new commits; hook from plugin after `/gitchange` or explicit `update` command.
- UI shows freshness: "Indexed 3 days behind `main`" with one-click refresh.
- Inference status cross-checks docs vs code (requirement: pattern + keywords + doc cross-ref).
- If index is committed, merge strategy must rebuild or rebase index like any generated artifact.

**Warning signs:**
- Open Threads panel unchanged after relevant merges land.
- `head_sha` in meta doesn't match `git rev-parse HEAD`.
- Two teammates see different migration status on same branch.
- Docs updated but decision graph still cites superseded README section.

**Phase to address:**
Phase 1 (schema/meta); Phase 4 (Status & Open Threads); Phase 7 (Incremental Scale).

---

### Pitfall 8: Local-First Privacy Leaking Secrets into Artifacts

**What goes wrong:**
Index stores raw diff hunks containing `.env` values, API keys from old commits, or internal URLs. Dashboard on `localhost` still exposes them to anyone on the network; agent context dumps secrets into chat logs.

**Why it happens:**
Full `git log -p` ingestion reads entire history including deleted secrets. Gitleaks/secret-history document that removed files remain in history. Tools focused on narrative miss redaction. Understand-Anything flagged serving `knowledge-graph.json` on shared machines.

**How to avoid:**
- Secret redaction pipeline during ingest (pattern + entropy, gitleaks-style rules); never persist raw secret values — store match type + location only.
- `.gitchangeignore` for paths and commit ranges known to contain credentials.
- Dashboard binds `127.0.0.1` by default; document risk if user exposes port.
- Agent tools return redacted excerpts; full hunks only on explicit maintainer drill-down with warning.
- Optional scan report: "N historical secret patterns detected — rotate credentials" without echoing values.

**Warning signs:**
- `.gitchange/` JSON greps match `AKIA`, `ghp_`, `sk-`, `BEGIN RSA PRIVATE KEY`.
- Dashboard diffs show literal passwords from 2019 commits.
- No redaction tests in golden fixtures.
- Telemetry accidentally includes diff content (GitChange v1: no telemetry — keep it that way).

**Phase to address:**
Phase 1 (Ingestion redaction); Phase 8 (Privacy Controls) for `.gitchangeignore` and operator docs.

---

### Pitfall 9: Onboarding Tour Overload Without Evidence Path

**What goes wrong:**
New hire gets a 25-chapter tour covering every subsystem; abandons at step 4. Or gets a slick AI summary with no way to verify claims. Tool becomes shelfware; seniors still run live walkthroughs.

**Why it happens:**
Generators optimize for comprehensiveness (Tour de Code AI markets 15–25 checkpoints). Feature-showcase syndrome in product onboarding UX. Competitors emphasize tour length over completion rate. GitChange differentiator is *guided tour tied to git evidence* — easy to lose one half.

**How to avoid:**
- Default tour: 4–6 chapters to first meaningful milestone (role-based: "backend hire → auth path" not "whole monorepo").
- Each chapter = era or topic thread with **one primary evidence anchor** (commit cluster or doc) + optional deep links.
- Completion tracking; separate optional deep-dive tours (architecture, testing, migrations).
- Every tour step: "See evidence" → era → commit → file drill-down (product spine).
- Measure tour completion in dogfood; target >60% for default path.

**Warning signs:**
- Single tour exceeds 10 steps with no branching.
- Tour text readable without opening dashboard.
- No role-based variants despite multi-surface monorepo.
- LACY-style gap: no maintainer edit/curation loop for wrong AI steps.

**Phase to address:**
Phase 5 (Guided Tours) — content model and UX gates; depends on Phase 6 drill-down.

---

### Pitfall 10: Assuming Remote Metadata That v1 Doesn't Have

**What goes wrong:**
Product promises PR review thread recovery, issue links, and "why" from GitHub discussions — but v1 is local-clone-only. Features silently fail or hallucinate links. Users expect archaeo-level PR recovery (97.7% on PR-driven repos with remote access) without supplying tokens.

**Why it happens:**
Competitive landscape (ContextWeaver, archaeo) blends git + PR + issue data. Roadmap creep from compelling demos. Chat interview loop is meant to fill gaps — but only if product admits local-only limits upfront.

**How to avoid:**
- Hard scope boundary in UI and agent responses: v1 = commits, merge metadata, conventional commit trailers, local docs.
- Parse `Co-authored-by`, `Signed-off-by`, `Fixes #` trailers when present in commit messages — label as "reference only, not fetched."
- Interview loop explicitly for missing PR/issue context; write answers to `docs/` or `.gitchange/interviews/`.
- Architecture leaves extension point for future host integration without pretending it exists.

**Warning signs:**
- Decision cards cite PR URLs that 404 without API access.
- Marketing copy mentions "review discussions" but no ingestion path exists.
- Tests mock GitHub API in a "local-only" milestone.

**Phase to address:**
Phase 3 (Decision Mining) and Phase 7 (Plugin) — agent skill text and tool contracts.

---

### Pitfall 11: Multi-Repo Unified Story Without Explicit Linkage

**What goes wrong:**
User selects three related repos; timeline interleaves unrelated commits by date. False "cross-repo migration" narrative appears because two repos bumped the same dependency the same week.

**Why it happens:**
Manual multi-repo selection (GitChange requirement) without a user-defined linking model defaults to timestamp merge. Cross-repo co-change is valuable (Repowise workspace mode) but needs shared identifiers (issue refs, shared tags, user annotations).

**How to avoid:**
- Require user-defined **story scope**: repo set + optional tag/era alignment + cross-repo links (shared migration ID, manual edges).
- Cross-repo signals only when explicit: matching trailer refs, shared version bumps in named packages, or user-confirmed link from interview loop.
- Per-repo indexes + overlay graph; don't flatten into one commit stream without rules.
- UI clearly labels which repo each evidence item comes from.

**Warning signs:**
- Unified timeline shows repo A infra commits interleaved with repo B feature work with no causal story.
- Cross-repo "decision" inferred solely from temporal proximity.
- No schema field for `repo_id` on evidence objects.

**Phase to address:**
Phase 8 (Multi-repo & Scale) — after single-repo pipeline is proven.

---

### Pitfall 12: Plugin Packaging and Path Fragility

**What goes wrong:**
`/gitchange` works in one install (cloned repo) but fails in Cursor global plugin path, symlinked skill dir, or Windows paths. Pipeline can't find core binaries; dashboard never launches.

**Why it happens:**
Understand-Anything SKILL.md explicitly warns: don't assume plugin root from skill path — symlinks, `~/.agents/`, and multi-platform installs differ. GitChange copies UA packaging pattern without inheriting UA codebase.

**How to avoid:**
- Resolve plugin root at runtime from host-provided paths first, then universal symlinks, then walk-up discovery (UA precedence order).
- Integration test matrix: cloned repo, global plugin install, symlinked skill.
- `doctor` command: verify git, index writable, dashboard port, schema version.
- Don't launch dashboard unless index validation passes (UA Phase 6 gate).

**Warning signs:**
- Hardcoded `../../` paths to core package.
- CI only tests from monorepo dev layout.
- "Plugin not built" errors on fresh install without documented build step.
- Dashboard launch skipped silently on validation warnings.

**Phase to address:**
Phase 7 (Plugin & Agent Integration).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Shell `git log` per analysis run | Fast to prototype | Cannot scale; flaky timeouts | Never past Phase 1 spike |
| Store LLM prose in index without evidence IDs | Readable tours quickly | Unverifiable output; re-index can't reproduce | Never for shipped claims |
| Skip merge commits in all pipelines | Cleaner attribution | Misses integration decisions and branch topology | Only for ownership metrics, not for era boundaries |
| Default full-history scan with no bounds | "Complete" story on small repos | Hours-long first run on monorepos | Dev fixtures only; production must be incremental |
| Commit `.gitchange/` to repo without rebuild CI | Team shares dashboard instantly | Stale/conflicting index across branches | Only if CI regenerates on merge |
| Use libgit2 for all git ops | Single library dependency | Poor diff performance at huge scale (UE 45min+ reports) | Benchmark first; git CLI for hot paths |
| Single global confidence threshold | Simpler UX | Hides weak decisions or over-prunes real ones | MVP with maintainer review queue only |
| Reuse UA graph schema for temporal data | Faster UI bootstrap | Wrong abstractions for time, eras, migrations | Never — temporal schema is distinct |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Host LLM (Cursor / Claude Code) | Letting chat improvise answers when tools return empty | Tools return structured "insufficient evidence"; skill triggers interview loop |
| Host LLM | Passing entire `.gitchange/` into context | Task-shaped tools with bounded payloads (Repowise MCP pattern) |
| Local git CLI | Parsing porcelain output | Plumb with `--format`, stable hashes, documented flags |
| Local git CLI | Ignoring `GIT_DIR` / worktrees / submodules | Resolve repo root; document submodule depth policy |
| Local web dashboard | Binding `0.0.0.0` by default | `127.0.0.1` default; explicit opt-in for LAN |
| Project docs (README, ADR) | Mining docs without version at commit | Store doc snapshot hash or commit when quoted |
| Multi-repo manual selection | Implicit merge by date | User-scoped story graph with explicit cross-repo links |
| Conventional commits | Treating every `feat:` as a decision | Map types to signals; require corroboration for "decision" classification |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-commit full-tree diff | CPU pegged, hours to index | Path-scoped diffs; batch commits; blob-level cache | ~10k–50k commits (Git Context experience) |
| In-memory full index | OOM on large repos | SQLite/embedded store; stream commits; shard by path (Chisel) | 100k+ commits or 500k+ files |
| Synchronous plugin pipeline | MCP/command timeout | Background job + progress file; partial index usable | >5 min analysis (Chisel `force=True` fallback) |
| Re-parse unchanged files | Linear slowdown on monorepo core | Cache keyed by `(path, blob_sha)` | Repos with stable core + long history |
| Graph layout on full file tree | Dashboard freeze | Era/tour-level aggregation; lazy expand on drill-down | >5k nodes in temporal graph |
| libgit2 diff for large blobs | Single-threaded stall | Cap blob size; skip binary; prefer CLI for big diffs | Unity/UE-class assets |
| Co-change all-pairs | Exploding edge count | Top-K partners per file; temporal decay | Repos with large multi-file commits |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Persisting raw historical secrets in `.gitchange/` | Credential exposure via index leak or chat context | Redact on ingest; store finding metadata only |
| Serving dashboard on all interfaces | LAN colleague reads architecture + diffs | Bind localhost; document exposure |
| Agent tool returns full env diff | Secrets in host LLM logs | Redacted excerpts; maintainer-only expand |
| `.gitchangeignore` too weak | Accidental indexing of `*.pem`, `.env*` | Sensible defaults + `doctor` scan |
| Interview answers written to world-readable paths | Tribal knowledge leak on shared machine | Respect umask; keep under `.gitchange/` with gitignore guidance |
| Trusting committer email for identity | Wrong expertise attribution (GitHub email spoofing UX) | Show email + "unverified identity" label; don't link to profiles without host integration |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Wall of commits timeline | Same paralysis as `git log` | Era chapters + inflection points first |
| Confidence scores without explanation | Mistrust or blind trust | Show evidence count, signals used, "verify" drill-down |
| No "index stale" indicator | Decisions wrong silently | Freshness badge + one-click update |
| Tour without role variants | Backend hire reads frontend deep-dive | Role/topic thread selection at start |
| Hiding weak evidence | Feels authoritative until disproven | "Inferred" / "Needs maintainer input" badges |
| Feature dump dashboard | Cognitive overload | Five core questions as nav spine (GitChange product) |
| Forcing cloud account | Breaks private-repo promise | Local-only path always works |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Git ingestion:** Often missing shallow-clone detection — verify `shallow: true` in meta on `--depth` clone
- [ ] **Incremental index:** Often missing force-push invalidation — verify rebase simulation drops `analyzedUpTo`
- [ ] **Decision mining:** Often missing rejected/draft workflow — verify maintainer can mark false positives
- [ ] **Tours:** Often missing evidence links per step — verify every step has `primary_commit` or doc anchor
- [ ] **Dashboard drill-down:** Often missing hunk-level diff — verify click-through lands on correct patch
- [ ] **Ownership:** Often missing ignore-revs — verify formatting commit doesn't reset expertise map
- [ ] **Open threads:** Often missing doc↔code cross-check — verify WIP code + "done" doc surfaces conflict
- [ ] **Privacy:** Often missing redaction tests — verify known secret fixtures never appear in output JSON
- [ ] **Plugin:** Often missing non-dev install path — verify fresh plugin install runs end-to-end
- [ ] **Multi-repo:** Often missing repo provenance on evidence — verify `repo_id` on every cross-repo claim

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Full-rescan architecture | HIGH | Introduce `.gitchange/` cache + migration script; freeze features until query path uses index only |
| Hallucinated decision corpus | MEDIUM | Bulk mark `rejected`; re-run mining with higher threshold; interview loop to replace top 10 tour claims |
| Corrupted incremental cursor after force-push | LOW | Detect missing SHA; prompt full rebuild; preserve interviews/manual overrides separately |
| Secret leaked into index | MEDIUM | Delete `.gitchange/`; add redaction rules; rebuild; rotate exposed credentials |
| Wrong ownership map | MEDIUM | Add ignore-revs; rebuild ownership layer only (don't re-run LLM passes) |
| Unusable 25-step tour | LOW | Split into default 5-step + optional modules; regen from era graph |
| Plugin path breaks on install | MEDIUM | Centralize root resolver; ship `doctor`; document build/install matrix |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Git history ≠ decision evidence | Phase 3: Decision & Migration Mining | Golden fixtures; maintainer reject rate <20% on dogfood |
| Hallucinated narrative | Phase 3 + 5 + 6 | Schema rejects claims without `evidence[]`; tour drill-down e2e test |
| Ownership conflation | Phase 2: Temporal Analysis & Ownership | Squash-merge fixture repo; ignore-revs test |
| Full-history rescan | Phase 1: Core Git Ingestion | 100k-commit fixture completes incrementally; query uses no git shell |
| History integrity edge cases | Phase 1 + 2 | Shallow + out-of-order fixtures; warning banners in UI |
| Co-change false signals | Phase 2 | Lockfile mass-commit doesn't create top coupling edge |
| Stale index vs git/docs | Phase 4 + 7 | New commit triggers diff in Open Threads within one `update` |
| Secret leakage | Phase 1 + 8 | Gitleaks-style fixture; grep `.gitchange/` in CI |
| Tour overload | Phase 5 | Default tour ≤6 steps; completion metric in dogfood |
| Remote metadata assumed | Phase 3 + 7 | No PR URL in output without `source: trailer_only` label |
| Multi-repo false narrative | Phase 8 | Three-repo fixture requires manual link for cross-repo decision |
| Plugin path fragility | Phase 7 | CI matrix: clone + global plugin paths; `doctor` passes |

### Suggested phase order rationale (pitfall-driven)

1. **Phase 1 — Ingestion & index schema** before anything else: rescan trap, secrets, shallow/force-push detection are foundational.
2. **Phase 2 — Temporal/ownership** before decisions/tours: bad ownership poisons contributor lens and interview routing.
3. **Phase 3 — Decision mining** with evidence contract before UI polish: prevents beautiful lies.
4. **Phase 4 — Status & open threads** once index exists: needs doc↔code cross-ref on cached data.
5. **Phase 5–6 — Tours + dashboard** together: tour without drill-down is a critical UX failure.
6. **Phase 7 — Plugin** after pipeline stable: packaging fragility wastes early iteration.
7. **Phase 8 — Multi-repo & scale hardening** last: depends on correct single-repo semantics.

## Sources

- [GitChange PROJECT.md](../PROJECT.md) — product spine, local-first scope, five core questions
- [agent-sh/agent-analyzer](https://github.com/agent-sh/agent-analyzer) — two-phase index, incremental `analyzedUpTo`, merge-skip, shallow flag, force-push fallback (HIGH)
- [Repowise architecture & git intelligence](https://www.repowise.dev/architecture) — GitIndexer, co-change, significant commits, graceful degradation, commit window (HIGH)
- [Git Context scaling post-mortem](https://dashwood.net/blog/2025-11-28-how-we-scaled-git-context-s-analysis-pipeline-with-batching-caching-and-dependen) — batching, caching, DAG orchestration (MEDIUM)
- [Drift Decision Mining wiki](https://github.com/dadbodgeoff/drift/wiki/Decision-Mining) — false positives, confidence thresholds, draft/confirmed/rejected (HIGH)
- [archaeo / DEV validation article](https://dev.to/vanshit_ahuja_0d472c769a8/we-tested-whether-engineering-decisions-are-recoverable-from-git-history-1e02) — evidence-only rule, PR recovery limits without remote (MEDIUM)
- [git-archaeologist limitations](https://github.com/SushantVerma7969/git-archaeologist) — authorship ≠ ownership, squash distortion (HIGH)
- [rmacklin: why not squash merge](https://github.com/rmacklin/why_i_dont_recommend_squash_and_merge) — blame attribution loss (HIGH)
- [MSR 2021: Escaping the Time Pit](https://doi.org/10.1109/msr52588.2021.00022) — out-of-order commits, date filtering (HIGH)
- [LACY onboarding study](https://arxiv.org/html/2603.25391) — AI-only vs expert-guided tour comprehension (HIGH)
- [AI Codebase Tour workflow](https://aitoolsguidebook.com/en/articles/ai-codebase-tour-workflow/) — verify file:line cites; hallucination risk (MEDIUM)
- [Tour Kit contributor onboarding](https://usertourkit.com/blog/product-tours-open-source-contributor-onboarding) — ≤6 steps, completion drop (MEDIUM)
- [Understand-Anything SKILL.md](https://github.com/Egonex-AI/Understand-Anything) — plugin path resolution, dashboard launch gate (HIGH)
- [Understand-Anything security note](https://ddewhurst.com/blog/understand-anything-knowledge-graph-for-your-codebase/) — local server exposure (MEDIUM)
- [Gittyup indexer issue #876](https://github.com/Murmele/Gittyup/issues/876) — full index scale limits, streaming results (MEDIUM)
- [Chisel README](https://github.com/IronAdamant/Chisel) — sharding, incremental update, MCP timeout fallback (MEDIUM)
- [gitleaks](https://github.com/gitleaks/gitleaks) — `git log -p` secret exposure in history scans (HIGH)
- [ContextWeaver](https://github.com/psreek-ai/ContextWeaver) — implied reasoning vs explicit docs; PR/issue dependency (MEDIUM)
- [Kognita: Cursor monorepo indexing limits](https://www.kognita.co/blog/cursor-monorepo-indexing-enterprise-limits) — per-developer full index failure mode (MEDIUM)

---
*Pitfalls research for: GitChange — git-history onboarding / codebase archaeology*
*Researched: 2026-06-30*
