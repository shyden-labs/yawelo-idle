# Handover: Yawelo Idle

**Written:** 2026-11-02 early hours (thirty-third session, overnight). Shyden asleep until about 06:00 his time; work continues by Priority.
**Running when written:** typecheck + unit on `feat/827-voyage-map` in `../yawelo-idle-826` (dies with the session: re-run `npm run typecheck && npm run test:unit` there).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Skip #768 and #783 (wait on Shyden).

## Done this session

- #815, #816, #813 merged and shut (PRs #823, #824, #825). #814 closed as not planned (Shyden). Worktrees -813, -815, -816 removed.
- #342 split into #826–#830 (16 points, all P1, under epic #331, blockers linked); #342 closed as split.
- #826 merged (PR #831, squash `96ffae6`) and shut: board has `Public title`/`Public summary` fields; snapshot carries `parent`, `publicTitle`, `publicSummary`; `waiting-on-shyden` label; R4 measured in the PR. Dev roadmap verify green.

## Next

1. #827 (voyage map) on `feat/827-voyage-map` in `../yawelo-idle-826` (worktree name is old; branch is right), In Progress. Built: `apps/site/src/roadmap/{voyage.ts,VoyageMap.svelte,Island.svelte}` (voyage.ts 100% covered, 39 unit tests), `Roadmap.astro`, placeholder `VoyageCopy` in `copy.ts`, `playwright.site.config.ts` + `tests/site/roadmap.spec.ts`, deploy-dev job `site-smoke` (3 min first limit: re-measure after its first run), import test `apps/site/src/views/roadmap-page.test.ts`. Plan: `.superpowers/sdd/827/plan.md`.
   Remaining: green typecheck/unit, commit (squash message from the wip commit), push, PR; the Playwright suite first runs in deploy-dev after merge, so read that job by name and set its limit from the measured run.
   Note: two Svelte components with `<style>` made Astro's CSS plugin warn under Rolldown (the build fails on warnings); all island CSS lives in VoyageMap.svelte as `.voyage :global(...)` (measured: 1 warning with two styled components, 0 with one).
2. Then #828 (progress, what's left, decisions) and #829 (live updates); #830 waits on Shyden's copy approval.

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
