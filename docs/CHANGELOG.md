# GitChange Changes Log

Session-driven delivery log for marketing-focused feature iterations.

---

## Iteration 1 — 2026-07-02 18:24 PDT

### Review

**Uncommitted work (pre-ship):**

- Self-update core (`packages/core/src/self-update.ts`) — git fetch/ff-only pull, pnpm install, CLI rebuild
- Plugin runner (`run-cli.ts`) — auto-update before every CLI invocation for global installs
- Explicit `gitchange update` CLI command + `/gitchange-update` Cursor slash command
- Install script overhaul — symlink local dev checkout, idempotent command linking, update messaging
- Schema regeneration (additive fields across artifact schemas)
- Skill/command docs updated for auto-update behavior

**Already on main (unpushed, 5 commits):**

- Dashboard UI fixes: era band stacking, decisions two-pane, tab overflow, commit dates/diff colors, virtualized list pagination, commit detail back navigation

**Roadmap status:** v1.0 milestone complete — all 9 phases verified (50/50 plans).

### Marketing analysis

| Signal | Insight |
|--------|---------|
| **Core promise** | Five evidence-backed onboarding questions — who, evolution, decisions, open work, progress |
| **Distribution friction** | Users must reinstall or manually pull to get fixes; blocks word-of-mouth |
| **First impression** | Dashboard screenshots in README are strong; recent UI fixes improve polish |
| **Competitive angle** | Local-first + IDE-native beats cloud SaaS for private repos and air-gapped teams |
| **Missing for launch narrative** | No public changelog, no `--version` with build identity, no "what's new" hook |

**Positioning statement (draft):**

> GitChange turns years of git history into an interactive onboarding dashboard — eras, decisions, tours, and drill-down evidence — without sending your code anywhere.

### Features selected this session

1. **Ship self-update / auto-update** (this iteration) — removes reinstall friction; every `/gitchange` run stays current
2. **Marketing README + version identity** (iteration 2) — `--version` with git SHA, tighten hero copy
3. **Post-install "first 5 minutes" guide** (iteration 3) — onboarding checklist in docs for evaluators

### Delivered (iteration 1)

- Committed and pushed self-update feature end-to-end
- Added `/gitchange-update` slash command to Cursor install bundle
- CI validates update command + ensure-up-to-date unit tests
- This changelog file created

### Verification

- `pnpm exec vitest run packages/core/src/self-update.test.ts packages/plugin/scripts/ensure-up-to-date.test.ts packages/plugin/scripts/resolve-root.test.ts` — 15 passed
- `pnpm build --filter @gitchange/cli --filter @gitchange/core` — success
