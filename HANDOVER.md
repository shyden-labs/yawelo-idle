# Handover: Yawelo Idle

**Written:** 2026-11-05 (forty-second session). **Phones:** Shyden says USB devices are available (via a peer session, 2026-11-05); no ticket in hand needs them.
**Running when written:** nothing.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-second)

- **PR #881 (#873) merged** as `fb4850bd`. Dev deploy run 42001324697 passed every job. #873 is shut.
- **PR #882 (#863) merged** as `5d40b72e`, after an update-branch (develop is strict). Coverage on head `92aa8149`: statements 92.8%, branches 81.1%, quoted on #863. Dev deploy run 42003403187 passed every job. #863 is shut.
- **#874 rewritten** after Shyden's rulings: move to FSRS-7, all in #874; old saves would restart word memory, but no save is stored yet (AC 6). It is now 13 points, P2. ACs 1–8 are on the issue.

## Resume steps

1. #783 (P0) has nothing to do until the next release cut. Then watch `release-cut` refuse a non-cut head.
2. #874 is in worktree `../yawelo-idle-874`, branch `deps/874-ts-fsrs-6`, based on `fb4850bd`. It is uncommitted: only `ts-fsrs` 5.4.2 → 6.0.0 in `packages/core/package.json` and the lockfile. No production code is written yet. Strict TDD: write the failing tests first.
   - With ts-fsrs 6: typecheck is clean, and lint has 9 no-deprecated errors (memory.ts 29, 101, 162, 185, 240; tests at 30, 101, 106).
   - The probe at `.superpowers/sdd/874/probe.mjs` (git-ignored) showed `DefaultScheduler({version:'FSRS-6'})` equals the legacy scheduler over 12 reviews.
   - FSRS-7's curve is in `node_modules/ts-fsrs/dist/models/fsrs-7.mjs` (`prepare_fast`, `prepare_curve`, `compute_curve`). It mixes two power-law traces, weighted, with difficulty, plus `*0.99998 + 1e-5`. So `meanRetrievability` (used by `production.ts:91`) keeps a closed form per trace.
   - `DefaultScheduler` is async (top-level await in core); `defineScheduler` is sync. Decide which by measurement.
   - AC 5 (rank thresholds) goes to Shyden before any change lands.
   - Set the board to In Progress once the branch is pushed.
3. Then a P2 with no blocker: #402, #497, #513 or #523.

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
- Worktrees: `-874` (in work), `-dev-scripts`. These are merged and can be removed: `-863`, `-873`, `-591`, `-871`. Older ones are kept until Shyden says: `-36`, `-728b`, `-761`, `-752`, `-794`, `-728-probe`.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-05)

- By tickets: 41% (182 of 447). Pace is 5.14 a day over the 7 finished days to 2026-11-04. ETA 2026-12-27, medium confidence (6 of 7 days moved).
- By effort: 1,163 points remaining across 265 open stories. Pace is 14.00 a day. ETA 2027-01-28, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
