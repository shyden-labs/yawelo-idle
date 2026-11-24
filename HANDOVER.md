# Handover: Yawelo Idle

**Written:** 2026-11-24 15:18 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at 6f04f065. Worktrees: `yawelo-idle-1093` (PR #1094, draft, head b98f93ba, CI queued at 15:16 WIB, branch BEHIND develop by #1102's merge), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at 6f04f065). No Colima, simulator or USB claim. No background job running.

## Now

- **#1092 closed:** 11 warm Edge installs 17–24 s; limit 3 min kept (covers the uncached 54 s × 3). Evidence on the ticket.
- **#1101 closed:** PR #1102 merged as 6f04f065, worktree and branches removed. Dev deploy of 5069830d (run 45317594635) passed every job.
- **#830:** AC1 met (both pages measured on dev at 5069830d through `yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev`; Shyden 2026-11-24: the Indonesian ticket-titles note stays out). AC2 open; AC3 waits on #1074.
- **#1093 AC2 door, pushed as b98f93ba** on PR #1094: `tests/support/covered-start-worker.ts` (+ unit test, red first, 4 mutations caught) serves the door from its instrumented build under `unstable_startWorker`, saves counts before dispose; door in `WORKER_CONFIGS` and `sonar-project.properties`. Laptop: unit rc 0 (15,035), typecheck rc 0, lint rc 0. CI verdict not yet read.
- **#1093** (PR #1094 draft): the 57 roadmap 500s were the coverage wrapper's (`TestSite.fetch` static call on a class default export); fixed test-first in 6bfbbb46, all roadmap tests pass instrumented, `roadmap.ts` 120/120. **AC2 gap:** the door Worker itself (`apps/door/test/door-in-front.test.ts` starts it via `unstable_startWorker`, uninstrumented; `apps/door/worker/index.ts` in no Worker report). Findings on #1093.
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. #1093: `~/.claude/scripts/pr-verdict.sh 1094` (background); read each job by name on b98f93ba; in the `sonar-coverage` artifact check `worker-apps__door__wrangler/lcov.info` lists `apps/door/worker/index.ts` (AC2 evidence on the ticket). Then update the branch from develop (merge, no rebase), ready the PR, merge when green, then AC3 (#1088's Sonar per-file figure for `roadmap.ts`; #1088's gate now fails on new coverage 20.3% < 80) and AC4 (re-read thresholds in `scripts/coverage.ts`).
3. Then #1074 (PR #1088) on develop, then #830 AC3.
