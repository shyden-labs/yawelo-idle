# Handover: Yawelo Idle

**Written:** 2026-11-25 22:40 WIB, session `yawelo-idle-7a`. Branch `handover/2026-10-17-d`. develop at b77e60a3 (#1112 merged; #1098 and #1109 merged earlier). Worktrees: `yawelo-idle-1107` (draft PR 1110, head d8b66b69, red), `yawelo-idle-probe1107` (scratch draft PR 1111, head 87134e74, never merge), `yawelo-idle-1103` (PR #1105), `yawelo-idle-1074` (PR #1088), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. No local job running. Progress page republished 22:37 WIB (v128).

## Now

- **#1107 (P0), PR 1110: the design changes.** All measurements are on #1107 (comment 7167063059): the edge waits for the whole body; build-and-test gave 413 ×200; the coverage job gave 413 ×144 and 500 ×56; an endless body OOMs build-and-test and resets in sonar-coverage; Content-Length `abc` gets 400 from the server (settled, no code). Commit d8b66b69 (declared check + capped `readUpToCap`) is the right Worker code; its endless-body route test is unworkable through either harness.
  - Next: (1) move `readUpToCap` to its own module and unit-test it in-process with an endless ReadableStream (413, cancelled, nothing read past the chunk that passes the cap). Red first: the unit test against a mutation that reads whole. (2) Drop the endless route test. (3) Measure why the coverage job differs: is the asset router absent with `prebuiltWorkerDir`, or is it the instrumented build? Capture the 500 text with probe PR 1111, run without the endless test. (4) Only then settle the whole-body declared route test. AC: no route test may race.
- **#1106**: PRs 1109 and 1112 merged. Sonar develop still shows S9382 in `scripts/worker-coverage-report.ts` (lands with PR #1105). Close #1106 once Sonar develop shows 0 open, read from the API.
- **#1078 (P0, raised from P1: it blocks #1076)**: waits on shyden.co.uk#1262 (their PR #1289), then Shyden's Cloudflare steps. `shyden-co-uk-9f` will message at deploy, keys (`{ "2026-11": x }`) and host-map read-back. Doors stay off until then.
- **#860**: dev half met; blocked by #425/#426 (links added). ShyDesk DEV read back 11-25: ticket URL `https://dev.yaweloidle.com/support/ticket`. TEST loads PROD ShyDesk.
- **PR #1088**: coverage 93.9% because Worker files count 0% in Node coverage; waits on #1105.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. #1107 as above in `yawelo-idle-1107`; probe via PR 1111. Then close PR 1111 and delete its branch and worktree.
3. PR #1105 (waits on #1107): update from develop, green, merge. Then #1088, then close #1106 on Sonar 0.
4. Then ShyDesk's order: #860 (prod waits on #425/#426), #1076 (needs #1078), #1072, then #784.
