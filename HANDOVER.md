# Handover: Yawelo Idle

**Written:** 2026-11-23 07:25 WIB, session `yawelo-idle-f6`. Branch `handover/2026-10-17-d`. develop at d43bcbdc. Worktrees: `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached). No Colima, simulator or USB claim.

## Now

- **#1074 (P1, In Progress), PR #1088 (draft), branch `1074-roadmap-reads-on-visit`, worktree `../yawelo-idle-1074`.** Commit 1 (`9415a9e2`) is the tests alone: `stale`/`readFailed` in `roadmap.openapi.json`, visit tests in `test/roadmap/roadmap.test.ts` (describe `reading on visit (#1074)` and four socket tests), no-schedule pin in `config.test.ts`, cron route test removed, fake GitHub `graphqlDelayMs`, test Worker `settled()`, stub `Roadmap.refreshing`. Next: read every new test failing by name on CI run 45087010769, then the Worker code (design below), then CI green, then merge.
- Design: `Roadmap` keeps `lastGoodReadAt`; `snapshot()` and `fetch()` (socket) call a visit step: when the last good read is over 600 000 ms old and no visit read runs, start `check()` as `refreshing`, broadcast the board with `stale: true`, and when it ends clear `refreshing` and broadcast again (reads during a refresh do not broadcast; the end does). `served()` adds `stale: refreshing !== null`, `readFailed: readFailingSince !== null`. First ever visit with no snapshot still awaits the read. Remove `scheduled` from `worker/index.ts` and the test Worker, and `triggers` from both wrangler configs.
- #1074 AC8 done: #759 AC4 amended and read back (comment on #759).
- #1081: probe on the ticket (`.astro` files are not the cause). A rerun of 3 lint runs at the default heap with `node --trace-gc node_modules/eslint/bin/eslint.js . --max-warnings 0` under `/usr/bin/time -l` in `../yawelo-idle-1074` was running at close-out: **DEAD after /clear**; rerun it and record peak heap, Mark-Compacts and any OOM on #1081.
- CI run 45087010769 (PR #1088) was still running at close-out; read it with `gh run view 45087010769 --log-failed`.
- Page half of #1074 (UI states, wording) is a second PR after Shyden approves the wording (draft in the latest #1074 comment).
- All P0s wait on Shyden: #784 (delete old DEV key; DEV-pass Cloudflare setup), #425/#426/#1072 (behind #784), #860 and #1013 (next production release), #992–#1000 (playwright-devices#7).

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
