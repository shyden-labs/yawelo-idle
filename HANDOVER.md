# Handover: Yawelo Idle

**Written:** 2026-11-25, session `yawelo-idle-7a`. Branch `handover/2026-10-17-d`. develop at 11b50915 (#1098 merged). Worktrees: `yawelo-idle-1107` (draft PR 1110, head d8b66b69), `yawelo-idle-1106b` (PR #1112, head 2d118d6c), `yawelo-idle-probe1107` (scratch draft PR 1111, head 87134e74, never merge), `yawelo-idle-1103` (PR #1105), `yawelo-idle-1074` (PR #1088), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. Devices available again (Shyden via repo-template-56).

## Now

- **#1107 (P0), PR 1110.** Measured (record on #1107):
  - Cloudflare's edge (dev workers.dev) answers nothing to a headers-only POST, whatever its declared size (10 s timeout); with the whole 1 MiB + 1 body sent, 413 comes ~100 ms after the body. Wrangler's asset router (build-and-test) also waits for the body.
  - Coverage harness (no router, sonar-coverage) answered the headers-only POST at 8 ms. With the whole body sent, **200 posts gave 413 ×144 and 500 ×56** (probe round 2, commit 2's Worker). build-and-test: 413 ×200.
  - Content-Length `abc` → 400 from the server in both jobs (commit 304ce267): the security review's non-number point is settled, with no Worker code.
  - Red read by name: commit 2 (endless body), commit 304ce267 (declared whole-body test gets 401 with checks removed).
  - Commit 5 d8b66b69: declared check + capped streaming read (`readUpToCap`). CI running.
  - **Open:** the 500s. Probe round 3 (87134e74, on the capped read) captures the 500's text. If the 500s remain, the declared test is flaky in sonar-coverage, which the AC forbids. Find the cause before choosing.
- **#1106, PR #1112**: no-email linear scanner (Sonar S8786 still open on develop after #1109). Red first: 4 timing tests at 0.9–8.8 s. Fuzz: 0 differences in 300,000 strings. Sonar then flagged S3776 (complexity 17); refactored (efcb8f93), develop merged in. CI running. After it merges, Sonar develop must show 0 open (S9382 in worker-coverage-report.ts lands with PR #1105).
- **#1078 → P0** (blocks #1076). The sign-in Worker shyden.co.uk#1262 is in their PR #1289, then waits on Shyden's Cloudflare steps. `shyden-co-uk-9f` will message at deploy, keys (`{ "2026-11": x }`) and map read-back. Doors stay off until then.
- **#860**: dev half met (#1077, #1085, AC4/AC5 evidenced 11-22). Now blocked by #425/#426 (links added). ShyDesk DEV read back 11-25 by `shydesk-cd`: ticket URL `https://dev.yaweloidle.com/support/ticket`. TEST loads PROD ShyDesk.
- **PR #1088**: coverage 93.9% because Worker files count 0% in Node coverage; waits on #1105.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. Probe PR 1111 round 3: read both jobs' tallies and the 500 text; settle the cause; then PR 1110 green in both jobs; record AC2/AC3 on #1107; close PR 1111, delete its branch and worktree; ready and merge PR 1110.
3. PR #1112: green + Sonar 0, merge; Sonar develop read; close #1106 with evidence once #1105 lands too.
4. PR #1105: update from develop, green, merge. Then #1088.
5. Then ShyDesk's order: #860 (prod waits on #425/#426), #1076 (needs #1078), #1072, then #784.
