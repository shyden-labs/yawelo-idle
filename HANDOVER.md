# Handover: Yawelo Idle

**Written:** 2026-11-25 22:50 WIB, session `yawelo-idle-7a`. Branch `handover/2026-10-17-d`. develop at b77e60a3. Worktrees: `yawelo-idle-1107` (draft PR 1110), `yawelo-idle-probe1107` (scratch draft PR 1111, never merge), `yawelo-idle-1103` (PR #1105), `yawelo-idle-1074` (PR #1088), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. No local job running.

## Now

- **#1107 (P0), PR 1110** (`yawelo-idle-1107`, head 108cb7e5 = 047e582d + develop merged; unit 15,062 passed). Done this session: `readUpToCap` in its own module `apps/site/worker/body.ts`, unit-tested in-process (`body.test.ts`, red first: "expected 65 to be 17"); the endless route test is dropped. Probe round 3 gave no tally: the endless test OOMed Node in both jobs first.
  - Next: (1) read probe round 4 (PR 1111, the probe merged with 108cb7e5, no endless test): the 500 text in sonar-coverage's tally. (2) Decide from it: asset router absent with `prebuiltWorkerDir`, or the instrumented build? (3) Settle the whole-body declared route test (AC: no route test may race). (4) Close PR 1111, delete its branch and the `yawelo-idle-probe1107` worktree.
  - Progress posted on #1107 (comment 7167400531). CI on PR 1110 (108cb7e5) and probe PR 1111 (e1f8751d) started 22:55 WIB.
- **#1106**: PRs 1109 and 1112 merged. Sonar develop last analysed 11b50915; its run on b77e60a3 (#1112) was in progress at 22:46 WIB. The two open issues it shows (S9382 `scripts/worker-coverage-report.ts`, S8786 `scripts/no-email.ts`) predate it. Close #1106 once Sonar develop shows 0 open, read from the API (S9382 lands with PR #1105).
- **#1078 (P0, raised from P1: it blocks #1076)**: waits on shyden.co.uk#1262 (their PR #1289), then Shyden's Cloudflare steps. `shyden-co-uk-9f` will message at deploy, keys (`{ "2026-11": x }`) and host-map read-back. Doors stay off until then.
- **#860**: dev half met; blocked by #425/#426 (links added). ShyDesk DEV read back 11-25: ticket URL `https://dev.yaweloidle.com/support/ticket`. TEST loads PROD ShyDesk.
- **PR #1088**: coverage 93.9% because Worker files count 0% in Node coverage; waits on #1105.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. #1107 as above in `yawelo-idle-1107`; probe via PR 1111. Then close PR 1111 and delete its branch and worktree.
3. PR #1105 (waits on #1107): update from develop, green, merge. Then #1088, then close #1106 on Sonar 0.
4. Then ShyDesk's order: #860 (prod waits on #425/#426), #1076 (needs #1078), #1072, then #784.
