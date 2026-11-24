# Handover: Yawelo Idle

**Written:** 2026-11-24 09:25 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at c0fbec80. Worktrees: `yawelo-idle-830` (PR #1097), `yawelo-idle-1093` (PR #1094, draft), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. A background waiter on PRs #1089 and #1097's CI may be running; it dies with this session (harmless, re-run `~/.claude/scripts/pr-verdict.sh <pr>`).

## Now

- **#1075 closed** (PR #1096 merged as c0fbec80; both ACs measured on dev at c0fbec80, evidence on the ticket and in `.superpowers/sdd/1075/`; worktree and branches removed). The ticket pages' one console 404 (`support-api/ticket` with no ticket link) is ShyDesk's normal answer, same before and after.
- The P1 chain **#1092 → #1081 → #1093 → #1074**:
  - **#1092:** AC1 warm runs 2 of 5 posted (PR #1089 run 1; PR #1096 run 2: restore 4 s, install 18 s). 3 more, then close.
  - **#1081: all 3 ACs met and ticked** (AC3: 3 lint runs passed at load 129.71–348.10, heaviest group `apps/site` 1266.0 MB committed of a 2144.0 MB limit; evidence comment on #1081). PR #1089 branch updated with develop to head `e2f0b307`; merge once CI is green on that head, then close #1081 by hand.
  - **#1093** (PR #1094 draft, local unpushed `a60b3517`, `ebc7086b`) waits on #1081; **#1074** (PR #1088 draft) waits on #1093.
- **#830 AC1: PR #1097** (branch `830-roadmap-words`, head `53eb32d3`, worktree `../yawelo-idle-830`; #830 In Progress). English approved 08:20 WIB, Indonesian read back by Google; tests red then green, unit 14993 passed. Merge when green; AC1 then needs the page seen on dev (en + id) before ticking. AC3 blocked by #1074 (linked). **#860's live ticket address approved** (recorded).
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).
- Weekly clean-up done 2026-11-24 (`~global` + B/D): 127 expired backups, 9 finished scratch files; pass log in `~/.claude/global-rules/reference/reference-cleanup.md`.

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. #1092 AC1: read the next 3 browsers runs that restore `msedge-debs-*` ("Install Edge" step times, cache line in the job log via `gh api --allow-escape-sequences …/jobs/<id>/logs`), post, re-check the limit by #476, close.
3. Merge PR #1089 when green on `e2f0b307` (`--match-head-commit` from a file), close #1081, remove its worktree and branches; then #1093 per its ticket (in `../yawelo-idle-1093`: `git merge origin/develop`, unit, push `a60b3517` alone, read sonar-coverage fail at "Measure the Worker suites' coverage", push the rest).
