# Handover: Yawelo Idle

**Written:** 2026-11-05 (fortieth session). Shyden AFK until about 12:30 local. **Phones: not authorised; no device work.**
**Running when written:** CI on PR #880 (head `9270463f`) and PR #881 (head `fbd6cdb6`). Read with `~/.claude/scripts/pr-verdict.sh 880` and `~/.claude/scripts/pr-verdict.sh 881`.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (fortieth)

- **#591 closed:** deploy run 41943602578 for `692ceb2a` (#870) was green on every job, dev-verified included.
- **PR #880 (#464):** CI's integration suite was red: `scripts/licence-check.ts` was missing from `tests/integration/script-loads.test.ts`. The fix is commit `9270463f`, which also merges develop in. Unit suite: 13,016 passed. Pushed.
- **Shyden's rulings (2026-11-05), recorded on each issue:**
  - #873: route (c), an exception with a reason and an expiry date.
  - #863: route (a), leave the harness test files out of the coverage figure.
  - #783: check it at the next release cut, not with a test PR now.
- **#873 is in PR #881** (branch `fix/873-audit-exception`, worktree `../yawelo-idle-873`). It adds `scripts/npm-audit.ts`, which checks `npm audit --json` against `EXCEPTIONS`. One exception is recorded: GHSA-gcqx-w48m-w2h4, expiring 2027-01-04. Built test-first with twelve unit tests; the mutation pass caught all five mutants. Unit suite: 12,993 passed. The board shows In Progress.

## Resume steps

1. When PR #880 is green on `9270463f`, merge it into develop (squash), check that dev deploys, then close #464 by hand. After that, remove the `../yawelo-idle-464` worktree (it belongs to closed PR #878).
2. When PR #881 is green, merge it, check dev, then close #873 by hand. That leaves #720 blocked only by #710. #720's audit step should run `node scripts/npm-audit.ts`.
3. #863 route (a): coverage leaves out `apps/*/test/**` and `apps/sync-worker/test/**`. Write a test for each pattern, seen red first. Measure the new figure on a PR.
4. #783: there is nothing to do until the next release cut. Then watch `release-cut` refuse a non-cut head.
5. Then a P2 with no blocker: #874 (ts-fsrs 6), #402, #497, #513 or #523.

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
- Worktrees: `-873` (PR #881), `-464b` (PR #880), `-464` (closed PR #878), `-591` and `-871` (both merged; can be removed), `-dev-scripts`. Older ones are kept until Shyden says: `-36`, `-728b`, `-761`, `-752`, `-794`, `-728-probe`.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-05)

- By tickets: 40% (179 of 447). Pace is 5.14 a day over the 7 finished days to 2026-11-04. ETA 2026-12-28, medium confidence (6 of 7 days moved).
- By effort: 1,162 points remaining across 268 open stories. Pace is 14.00 a day. ETA 2027-01-27, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
