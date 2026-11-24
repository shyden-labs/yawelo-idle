# Handover: Yawelo Idle

**Written:** 2026-11-24 10:21 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at 5069830d. Worktrees: `yawelo-idle-1101` (PR #1102), `yawelo-idle-1093` (PR #1094, draft), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Background waiters on dev deploy run 45317594635 and PR #1102 may be running; it dies with this session (harmless, re-run `~/.claude/scripts/pr-verdict.sh <pr>`).

## Now

- **#1075 closed** (PR #1096 merged as c0fbec80; both ACs measured on dev at c0fbec80, evidence on the ticket and in `.superpowers/sdd/1075/`; worktree and branches removed). The ticket pages' one console 404 (`support-api/ticket` with no ticket link) is ShyDesk's normal answer, same before and after.
- The P1 chain **#1092 → #1081 → #1093 → #1074**:
  - **#1092:** AC1 warm runs 4 of 5 posted (slowest install 24 s). 1 more (PR #1099 or the next PR), then set the limit by #476 and close.
  - **#1081 closed** (PR #1089 merged as 35ad0f1b; worktree and branches removed. The AC3 run logs went with the worktree; the figures are on #1081).
  - **#1093** (PR #1094 draft): red read and posted on #1093 (`no counts for apps/site/wrangler.jsonc` at the new Worker step, a60b3517); rest pushed as `f969aa38`: sonar-coverage now fails with 57 `test/roadmap/*` tests answering 500 under the instrumented build only (findings on #1093). Next: make the 500 print its error on CI, measure, then fix; **#1074** (PR #1088 draft) waits on #1093.
- **#830: PR #1099 merged as 5069830d** (worktree/branches removed, #830 back to Todo). AC1 still needs /roadmap and /id/roadmap seen on dev at 5069830d (headless Playwright + dev password, memory `feedback-dev-access-without-shyden`) before ticking. AC3 blocked by #1074. **#860's live ticket address approved** (recorded).
- **Dev deploy for 35ad0f1b FAILED** at verify: `✗ web /id/: request to https://dev.yaweloidle.com/id/ failed: fetch failed` (run 45312652143); laptop got 401 in 0.55 s at 09:4x WIB. Cause unknown: verify drops `error.cause`, filed **#1101** (1 pt, P2), built test-first as **PR #1102** (head `53d92a46`, unit 15006 passed, In Progress): merge when green, then shut the ticket by hand and clean up. Read the 5069830d deploy (run 45317594635) verdict first; told Shyden.
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).
- Weekly clean-up done 2026-11-24 (`~global` + B/D): 127 expired backups, 9 finished scratch files; pass log in `~/.claude/global-rules/reference/reference-cleanup.md`.

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. #1092 AC1: read the next 3 browsers runs that restore `msedge-debs-*` ("Install Edge" step times, cache line in the job log via `gh api --allow-escape-sequences …/jobs/<id>/logs`), post, re-check the limit by #476, close.
3. #830 per Now; then #1093 per its ticket (in `../yawelo-idle-1093`: `git merge origin/develop`, unit, push `a60b3517` alone, read sonar-coverage fail at "Measure the Worker suites' coverage", push the rest).
