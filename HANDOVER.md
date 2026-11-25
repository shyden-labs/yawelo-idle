# Handover: Yawelo Idle

**Written:** 2026-11-26 01:25 WIB, session `yawelo-idle-7a`. Branch `handover/2026-10-17-d`. develop at fd13d6d4 (#1113 merged; #1110 merged as 7d5c181a). Shyden is asleep (relayed by repo-template 25 Nov ~23:15 WIB): keep working by Priority, park his decisions. Worktrees: `yawelo-idle-1103` (PR #1105, head 99784682), `yawelo-idle-1074` (PR #1088), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. No local job running.

## Now

- **#1107: CLOSED** with evidence (comment 7170462981). PR #1110 merged; dev deploy run 45668410232: deploy and all verify jobs passed, smoke failed at the Edge install (→ #1115).
- **#1115 (new, P1, 2 pts, Todo):** deploy-dev's two Edge installs (`deploy-dev.yml` lines ~310 and ~375) lack #1092's cache and named stall; this run's smoke timed out on a slow Ubuntu mirror. dev-verified is skipped until it is fixed.
- **#1078 (P0, Todo):** AC1 and AC2 are merged in code (fd13d6d4). `production` environment variable `DEV_PASS_KEYS` set and read back. **Nothing is live**: the door deploys only through `deploy-door.yml` (workflow_dispatch, `production`, Shyden approves). Before that deploy (#1078 comment 7170734330):
  1. Move deploy-dev's verify, smoke and verify-holding jobs off `dev.` / `dev-api.` / `dev-holding.yaweloidle.com` onto the origins' workers.dev addresses with the door secret (AC3 first half). Tests red first.
  2. **Decision for Shyden (parked):** the roadmap webhook (org hook 698318626) posts to `https://dev.yaweloidle.com/hooks/github` through the door; a pass check would refuse it. Recommend (a): the site's dev door forwards `POST /hooks/github` without a pass (the Worker checks GitHub's HMAC first). Ask with `AskUserQuestion` when he is back.
  3. Then the door deploy (his approval), AC3 second half (drop the origins' `DEV_PASSWORD` gate), AC5 real-browser check in every desktop browser.
  - Keys rotate only when `shyden-co-uk-9f` announces it; add the kid, deploy, confirm back.
- **#1106**: Sonar develop: 1 open, S9382 `scripts/worker-coverage-report.ts`, lands with PR #1105. Close #1106 once the API shows 0.
- **PR #1105**: green on f4b29e9c, then behind; develop merged in, head 99784682 (unit 15,093 passed), CI running. Merge when green on that head.
- **PR #1088**: waits on #1105.
- **#860**: dev half met; blocked by #425/#426.
- repo-template filed #221 for the dev-pass Worker typing (it will message when it lands; Yawelo's casts stay until then).

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. `~/.claude/scripts/pr-verdict.sh 1105`: merge if green on 99784682 (`--match-head-commit` from a file); clean its worktree and branches; then read Sonar develop and close #1106 at 0; then #1088.
3. #1078 step 1 (CI off the doors), then #1115.
4. Ask Shyden the webhook question; then the door deploy with his approval.
5. Then ShyDesk's order: #860 (prod waits on #425/#426), #1076 (needs #1078), #1072, then #784.
