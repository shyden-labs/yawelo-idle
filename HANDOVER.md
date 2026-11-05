# Handover: Yawelo Idle

**Written:** 2026-11-05 (forty-fifth session). **Phones:** Shyden says USB devices are available (via a peer session, 2026-11-05); no ticket in hand needs them.
**Running when written:** nothing.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-fifth)

- **#883 shut, verified on dev.** PR #885 merged into develop (`6ca0b3c6`) after one fix: the no-skip guard expected a `tests/engines/determinism.spec.ts` that never existed (`1ee1b068`; the guards suite is CI-only). Equal totals on all five targets: engines 9, web 4, site 22 each, all passed (deploy-dev run 42046641886). Not player-facing, so no Website story.
- **#874 rulings by Shyden** (comment on #874): ranks follow FSRS-7's raw `stability` against 2/7/14/30; keep the short learning steps (`allowModelOverride: false`). Measured: a sync `defineScheduler(FSRS7Model, dateChrono)` with DefaultScheduler's seven middlewares equals `await DefaultScheduler({enableFuzz:false})` over 15 reviews (that probe had override on; re-prove with it off). `newCard` draws a random `cardId` unless given one, so pass the item id.
- **#874 AC 9 added** (a side note Shyden passed on): before/after `pacing:sweep` figures in the PR, `test:pacing` green; the site quotes only `BALANCE.memory.queueSize`. Its Estimate may need raising.

## Resume steps

0. **#874** in worktree `../yawelo-idle-874` (branch `deps/874-ts-fsrs-6`, fast-forwarded to `5d40b72e`, all uncommitted, not pushed, board not yet In Progress). AC 3's tests are written and seen red (322 failed: no `WEIGHTS`, old stability-only API; output not kept): `packages/core/test/{fsrs-reference,mean-r-reference,memory.test,memory-laws}.ts` and `packages/core/properties/memory.test.ts`. The decimal reference agrees with ts-fsrs `curve` to 6.4e-16 (`.superpowers/sdd/874/refcheck.ts`). Next, write `memory.ts`: `MemoryState {stability, stabilityFast, difficulty}`, `retrievability(state, days)` and `meanRetrievability(state, from, span)`, closed form per power-law trace, weighted, x0.99998 + 1e-5, with ts-fsrs's clamps. Then AC 2 (scheduler), 4, 6, 7, 8, 9. Strict TDD. Probes, rank/pacing measurements and the 6.0.0 changelog (for AC 1) are in `.superpowers/sdd/874/`.
1. #783 (P0) has nothing to do until the next release cut.
2. Then `board-next`.

## Waiting on Shyden

- #784 next steps (Gmail, Cloudflare, domains).
- Deleting test board project 6.
- The ETA confidence rule.
- Voyage map layout (#328/#331/#452).
- #655: his SonarCloud project and a `SONAR_TOKEN`.
- #858: where it goes.
- #830: approving its copy.
- Open PRs with no recent movement: #602 (waits on a Stryker runner release), #745, #767, and Dependabot #593, #594, #597, #750, #763, #764, #779 and #834.

## State

- The main checkout is on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-874` (in work), `-dev-scripts`. These are merged and can be removed: `-883`, `-863`, `-873`, `-591`, `-871`. Older ones are kept until Shyden says: `-36`, `-728b`, `-761`, `-752`, `-794`, `-728-probe`.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-05)

- By tickets: 41% (183 of 449). Pace is 5.14 a day over the 7 finished days to 2026-11-04. ETA 2026-12-27, medium confidence (6 of 7 days moved).
- By effort: 1,174 points remaining across 266 open stories. Pace is 14.00 a day. ETA 2027-01-28, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
