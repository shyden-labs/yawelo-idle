# Handover: Yawelo Idle

**Written:** 2026-11-23 07:45 WIB, session `yawelo-idle-f6`. Branch `handover/2026-10-17-d`. develop at d43bcbdc. Worktrees: `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached). No Colima, simulator or USB claim.

## Now

- **#1074 (P1, In Progress), PR #1088 (draft), branch `1074-roadmap-reads-on-visit`, worktree `../yawelo-idle-1074`, head `cfaf6388`.**
  - `9415a9e2` tests (red on CI by name, run 45087010769); `90274f4a` code (on-visit read, `stale`/`readFailed`, cron removed; CI run 45088372366 showed 4 test-side failures, fixed in `cfaf6388`).
  - `84015679` red test: a failed read holds visits off 10 minutes (security-review finding). `f521b99f` red tests: a read by another Worker version is stale; `verifyRoadmap` visits `/api/roadmap.json` before its first look; new verify messages (7 verify-dev unit tests red locally, on purpose).
  - CI run 45090579781 on `cfaf6388` was running: expect exactly those new tests red by name (harness: the hold test and the version test; unit: the 7 verify-dev tests).
  - Then code: in `visit()` also skip when `lastCheckAt` is within REFRESH_AFTER_MS; `version()` returns `env.CF_VERSION_METADATA.id` (add `"version_metadata": {"binding": "CF_VERSION_METADATA"}` to both site wrangler configs; regenerate worker types), store `readByVersion` on a good read, stale when it differs; `scripts/verify-dev.ts` `verifyRoadmap` GETs `/api/roadmap.json` once before the loop, messages as the tests say. Unit suite, push, CI green by step, un-draft, squash-merge, `verify-roadmap` on the dev deploy.
- **#1081 (P2, In Progress), PR #1089, branch `1081-lint-in-groups`, worktree `../yawelo-idle-1081`.** `npm run lint` = `node scripts/lint.ts` (5 runs in sequence). Unit 14966 locally after the worker-types fix; pre-push lint passed without NODE_OPTIONS (70.7 s, 1.39 GB RSS). CI run 45089610552 was running. Merge when green by step. AC3 (3 runs under load >100) owed.
- #1074 AC8 done. Page half of #1074 waits on Shyden's wording (latest #1074 comment).
- shytalk-34 got the full roadmap build description (Shyden: every roadmap copies Yawelo's).
- All P0s wait on Shyden: #784, #425/#426/#1072, #860 and #1013 (next production release), #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #830 AC1: approve the roadmap page's new short text (latest #830 comment).
2. #1074: approve "updating" / "could not update" wording, and whether a failed read hides the board or shows it dimmed (latest #1074 comment).
3. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket`.
4. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
5. #1081: raise its level? It now blocks ordinary pushes.
6. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
2. #1074: `gh run view <build-and-test run on PR #1088> --log-failed`; confirm each new test fails by name; write the code per the design above in `../yawelo-idle-1074`; unit suite and typecheck locally; push; CI green read by step; un-draft; squash-merge; check `verify-roadmap` on the dev deploy.
3. Act on Shyden's answers above.
