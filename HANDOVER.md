# Handover: Yawelo Idle

**Written:** 2026-11-24 10:20 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at 35ad0f1b. Worktrees: `yawelo-idle-830` (PR #1099, draft), `yawelo-idle-830x` (scratch PR #1100), `yawelo-idle-1093` (PR #1094, draft), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Background waiters on PR #1100 / #1094 CI may be running; it dies with this session (harmless, re-run `~/.claude/scripts/pr-verdict.sh <pr>`).

## Now

- **#1075 closed** (PR #1096 merged as c0fbec80; both ACs measured on dev at c0fbec80, evidence on the ticket and in `.superpowers/sdd/1075/`; worktree and branches removed). The ticket pages' one console 404 (`support-api/ticket` with no ticket link) is ShyDesk's normal answer, same before and after.
- The P1 chain **#1092 → #1081 → #1093 → #1074**:
  - **#1092:** AC1 warm runs 4 of 5 posted (slowest install 24 s). 1 more (PR #1099 or the next PR), then set the limit by #476 and close.
  - **#1081 closed** (PR #1089 merged as 35ad0f1b; worktree and branches removed. The AC3 run logs went with the worktree; the figures are on #1081).
  - **#1093** (PR #1094 draft): `a60b3517` pushed alone to the PR branch 10:00 WIB (CI on it: read sonar-coverage's expected fail at "Measure the Worker suites' coverage" by name). Local branch has `ebc7086b` + merge of develop `f969aa38` (unit 15029 passed), unpushed; `backup/1093-ebc7086b-2026-11-24` keeps ebc7086b (30 days). After the red is read and posted: push the branch; **#1074** (PR #1088 draft) waits on #1093.
- **#830 AC1: draft PR #1099** (branch `830-roadmap-words-2`, worktree `../yawelo-idle-830`, #830 In Progress). PR #1097 closed for a test-first slip (CI-only `apps/site/test/site.test.ts` still expected the removed note). Commit 1 `250bbab6` is the tests alone: unit red read and posted on #1099 (5 by name). Harness red is on scratch draft PR #1100 (`x/830-harness-red`, worktree `../yawelo-idle-830x`): read `the id roadmap … with no ticket-titles note` failing, post it, close #1100 and remove its worktree/branches; then write `copy-en.ts` (intro + howToRead citing `2026-11-24-roadmap-words-id.md`) and `copy.ts` (id intro, howToRead, `englishNote: null`) new, green, mark ready, merge; then see /roadmap and /id/roadmap on dev before ticking AC1. AC3 blocked by #1074. **#860's live ticket address approved** (recorded).
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).
- Weekly clean-up done 2026-11-24 (`~global` + B/D): 127 expired backups, 9 finished scratch files; pass log in `~/.claude/global-rules/reference/reference-cleanup.md`.

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. #1092 AC1: read the next 3 browsers runs that restore `msedge-debs-*` ("Install Edge" step times, cache line in the job log via `gh api --allow-escape-sequences …/jobs/<id>/logs`), post, re-check the limit by #476, close.
3. #830 per Now; then #1093 per its ticket (in `../yawelo-idle-1093`: `git merge origin/develop`, unit, push `a60b3517` alone, read sonar-coverage fail at "Measure the Worker suites' coverage", push the rest).
