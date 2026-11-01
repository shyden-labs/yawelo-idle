# Handover: Yawelo Idle

**Written:** 2026-11-02 (thirty-third session), stopped for a computer restart (Shyden, relayed). **Phones unavailable: no device work until Shyden says.**
**Running when written:** nothing local. External: nothing (PR #832's last CI run finished red, see below).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Skip #768 and #783 (wait on Shyden).

## Done this session

- #815, #816, #813 merged and shut (PRs #823, #824, #825). #814 closed as not planned (Shyden). Worktrees -813, -815, -816 removed.
- #342 split into #826–#830 (16 points, P1, under epic #331, blockers linked); #342 closed as split.
- #826 merged (PR #831, squash `96ffae6`) and shut: board fields `Public title`/`Public summary`; snapshot carries `parent`, `publicTitle`, `publicSummary`; `waiting-on-shyden` label; R4 measured in the PR.

## Next

1. **#827 (PR #832), worktree `../yawelo-idle-826`, branch `feat/827-voyage-map`, local head `259beb6` (committed, NOT pushed; origin has `fad360c`).** CI on `fad360c` failed in Guards: `tests/guards/erasable-syntax.test.ts` (tsconfig list) and `tests/guards/svelte-gates.test.ts` (components + workspaces). `259beb6` adds `tests/site/tsconfig.json` and the two components + `apps/site` to those lists, `noUnusedLocals`/`noUnusedParameters` to `apps/site/tsconfig.json`, `svelte-check` to the site's devDependencies and to the front of its `typecheck`. **That site typecheck now fails at svelte-check: run `cd apps/site && npx svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` and read why** (likely the `.astro/types.d.ts` include or the worker files). Then lint, `npm run typecheck`, `npm run test:unit`, push, read #832's checks by name, merge. After merge read deploy-dev's `site-smoke` job (first run of `tests/site`) and set its step limit to ≥3× the measured run (#476).
2. **#828**, branch `feat/828-roadmap-figures` (same worktree), local head `d1f3e54`, WIP, NOT pushed: failing tests for `etaDate` and `confidence` in `packages/progress` (11 red against throwing stubs). Confidence rule (mine, for Shyden to change): high at ≥6 of 7 days moved, medium at 4–5, low otherwise or a window under 7 days. Then the site's summary (what's left by epic + totals, both estimates, recently shipped, updated-ago, waiting on decisions). The branch was cut from #827's `fad360c`: merge develop in once #832 lands.
3. Then #829 (live updates); #830 waits on Shyden's copy approval.

## Waiting on Shyden

- **Test board** (shyden-labs project 6): keep or delete, his call.
- **Voyage order:** where the three epics with no milestone (#328 prestige, #331 website, #452 analytics) sit on the voyage; default now: after M8, by issue number (`byDelivery` in `apps/site/src/roadmap/voyage.ts`).
- **Other work:** 46 open stories have no epic; the map counts them in one "other work" line, on no island (default, PR #831).
- #768: old dev bucket's r2.dev address off (Shyden: in the morning, 2026-11-02). #783: a planted non-release PR into main seen refused (his to open, or the next release). #784, #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-01)

- By tickets: 36% (154 of 426), pace 2.00 a day, ETA 2027-03-17 (low confidence: 3 of 7 days moved nothing).
- By effort: 1,183 points remaining across 272 open stories, pace 4.86 a day, ETA 2027-07-03 (low confidence). Both before outside waits (#784's login, device sign-off).
