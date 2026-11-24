# Handover: Yawelo Idle

**Written:** 2026-11-24 10:52 WIB, session `yawelo-idle-dd`. Branch `handover/2026-10-17-d`. develop at 6f04f065. Worktrees: `yawelo-idle-1093` (PR #1094, draft, head 6e31cc19, all green), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at 6f04f065). No Colima, simulator or USB claim. No background job running.

## Now

- **#1092 closed:** 11 warm Edge installs 17–24 s; limit 3 min kept (covers the uncached 54 s × 3). Evidence on the ticket.
- **#1101 closed:** PR #1102 merged as 6f04f065, worktree and branches removed. Dev deploy of 5069830d (run 45317594635) passed every job.
- **#830:** AC1 met (both pages measured on dev at 5069830d through `yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev`; Shyden 2026-11-24: the Indonesian ticket-titles note stays out). AC2 open; AC3 waits on #1074.
- **#1093** (PR #1094 draft): the 57 roadmap 500s were the coverage wrapper's (`TestSite.fetch` static call on a class default export); fixed test-first in 6bfbbb46, all roadmap tests pass instrumented, `roadmap.ts` 120/120. **AC2 gap:** the door Worker itself (`apps/door/test/door-in-front.test.ts` starts it via `unstable_startWorker`, uninstrumented; `apps/door/worker/index.ts` in no Worker report). Findings on #1093.
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. #1093 in `../yawelo-idle-1093`: test-first, add `apps/door/wrangler.jsonc` to `WORKER_CONFIGS`, start the door from its instrumented build when `WORKER_COVERAGE_DIR` is set, save its counts in `afterAll`; push, read the door's report in the `sonar-coverage` artifact. Then ready the PR, merge when green, and do AC3 (#1088's Sonar per-file figure for `roadmap.ts`) and AC4 (re-read thresholds in `scripts/coverage.ts`).
3. Then #1074 (PR #1088) on develop, then #830 AC3.
