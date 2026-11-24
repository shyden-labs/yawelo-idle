# Handover: Yawelo Idle

**Written:** 2026-11-24 07:15 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at 0835db5f. Worktrees: `yawelo-idle-1092` (PR #1095), `yawelo-idle-1093` (PR #1094, draft), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. This session's background check waiter on PR #1095 is DEAD after `/clear`; step 2 re-reads the checks.

## Now

The chain: **#1092 → #1081 → #1093 → #1074**, all P1.

- **#1092 (P1, In Progress), PR #1095, branch `1092-cache-edge`, head `01fd8aa6` (read from pr-verdict), CI running:**
  - The browsers job's apt keeps its downloads in `/root/edge-debs`, restored by prefix (`msedge-debs-`) and saved under the installed Edge version with actions/cache v6.1.0. The install runs inside `timeout 165` and prints apt's last `Get:` line on a stall (AC2).
  - Tests: `tests/unit/edge-install-ci.test.ts` (12, red first); `tests/unit/edge-install.ts` finds the install inside its step; `tests/unit/ci-fast-path.test.ts` accepts `skip && more`, never `||`. Mutations: 4 on the workflow and 2 on the skip check, all caught. Unit suite 14,993 passed.
  - To read on CI: the browsers job passes, and "Save the Edge download" ran. AC1 still owed: the install time over 5 runs once the cache is warm (a develop run saves it for every PR), and the 3-minute limit re-checked from them.
- **#1081 (P1, In Progress), PR #1089, head `05ac223b`:** waits on a green browsers run (#1092). AC3 (3 pre-push lint runs under load >100) still owed: load was 2.6 at 07:10 WIB, and forcing 100 would starve the other sessions, so run it when real load is that high.
- **#1093 (P1, In Progress), PR #1094 (draft):** local unpushed `a60b3517` and `ebc7086b`; push refused by the pre-push lint OOM, which is #1081.
- **#1074 (P1), PR #1088 (draft):** blocked by #1093.
- All P0s wait on Shyden: #784, #425/#426/#1072, #860 and #1013, and #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #830 AC1: approve the roadmap page's new short text (latest #830 comment).
2. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket`.
3. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
4. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. Read PR #1095's checks by name (`gh pr checks 1095 -R shyden-labs/yawelo-idle`). Green on the head: squash-merge into develop, then clean the worktree and branches. Red: read the failing step's log.
3. After merge, measure "Install Edge" on 5 runs with a warm cache (GitHub API step times), post the figures on #1092, set the limit by #476, and close #1092 with evidence.
4. Update PR #1089 from develop, read a green browsers run, do #1081's AC3, merge.
5. Then #1093 per its ticket: in `../yawelo-idle-1093`, `git merge origin/develop`, push `a60b3517` alone and read sonar-coverage fail at "Measure the Worker suites' coverage", then push the rest.
