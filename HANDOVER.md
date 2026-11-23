# Handover: Yawelo Idle

**Written:** 2026-11-23 22:58 WIB, session `yawelo-idle-44`. Branch `handover/2026-10-17-d`. develop at 0835db5f. Worktrees: `yawelo-idle-1093` (PR #1094, draft), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Road to Launch page republished 22:55 WIB (version 106).

## Now

The chain: **#1092 → #1081 → #1093 → #1074**, all P1 (#1081 and #1092 raised from P2 by the blocker rule, with blocked-by links set).

- **#1090: done.** PR #1091 squash-merged (0835db5f), issue closed with evidence.
- **#1092 (P1, Todo):** Edge install. The AC1 figures are on the ticket: 40 runs, 35 passed in 19–54 s and 4 stalled at 180 s, so the fix is to cache the download, not raise the limit. A correction comment says the 3-minute limit _was_ measured (PR #1054). Next: keep Edge between runs (an actions/cache of the .deb, or an image that holds it), with a test pinning the step.
- **#1081 (P1, In Progress), PR #1089, head `05ac223b`:** its fix is the lint OOM that now blocks #1093. It waits on a green browsers run (#1092). AC3 (3 runs under load >100) is still owed.
- **#1093 (P1, In Progress), PR #1094 (draft), worktree `../yawelo-idle-1093`:**
  - Remote head `cc2da36b`.
  - Local and unpushed: `a60b3517` (adds the two scripts to `tests/integration/script-loads.test.ts`) and `ebc7086b` (switches the harness tests to `tests/support/create-covered-harness.ts`).
  - The push is refused by the pre-push lint, which runs out of heap (`FATAL ... heap out of memory`, exit 134, twice). Measured on the #1093 ticket: develop peaks at 2.27 GB and passes; V8's limit is 2,144 MB. That is #1081.
  - The AC1 route is on the ticket: workerd refuses V8 coverage, so istanbul-instrumented bundles are read over the harness's RPC.
  - The unit tests and mutation runs are done (14 mutations, all caught).
  - CI on `cc2da36b`: sonar-coverage failed only at script-loads, which `a60b3517` fixes.
- **#1074 (P1), PR #1088 (draft), head `5322d65f`:** blocked by #1093 (Sonar new-code coverage).
- All P0s wait on Shyden: #784, #425/#426/#1072, #860 and #1013 (next production release), and #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #830 AC1: approve the roadmap page's new short text (latest #830 comment).
2. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket`.
3. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
4. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. Start #1092 in a new worktree: tests first (a workflow test pinning the cached install), then the step. The red-first test lives in tests/unit (workflow text), so it can run locally.
3. Once #1092 merges, read a green browsers run on PR #1089, do #1081's AC3, and merge it.
4. Then in `../yawelo-idle-1093`, after `git merge origin/develop`: push `a60b3517` alone (`git push origin a60b3517:refs/heads/1093-worker-coverage`). Read sonar-coverage failing at "Measure the Worker suites' coverage" with `no counts for apps/site/wrangler.jsonc`, then push the rest.
5. Next on #1093: measure the new step's time on 5 runs and set its limit (#476); then check that PR #1088's Sonar per-file figure for `apps/site/worker/roadmap.ts` reads covered (AC3) and re-read the coverage thresholds (AC4). Gap to ticket: the door's own Worker and `health-broken-d1` start through `unstable_startWorker`, so they are not counted.
