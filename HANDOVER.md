# Handover: Yawelo Idle

**Written:** 2026-11-23 08:00 WIB, session `yawelo-idle-f6`. Branch `handover/2026-10-17-d`. develop at d43bcbdc. Worktrees: `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached). No Colima, simulator or USB claim.

## Now

- **#1074 (P1, In Progress), PR #1088 (draft), branch `1074-roadmap-reads-on-visit`, worktree `../yawelo-idle-1074`.**
  - `9415a9e2` tests: read red on CI run 45087010769, exactly the 15 new tests by name.
  - `90274f4a` code: on-visit read (`visit()`, `refreshing`, `lastGoodReadAt`, `LiveSnapshot` with `stale`/`readFailed`), cron and `scheduled` removed; 3 config unit tests run red then green locally; unit suite 14962/14962. CI run 45088372366 was running.
  - Local, NOT pushed (held so no push lands on running CI): (a) test commit "a failed read holds visits off for 10 minutes" (security review finding: failing reads restarted on every visit); (b) test commit "a deploy's first visit reads, and verify visits first" (version test in roadmap.test.ts, 7 verify-dev unit tests red locally).
  - Next: once 45088372366 is green, push (a)+(b), read the new harness tests red by name on CI, then code: in `visit()` also skip when `lastCheckAt` is within REFRESH_AFTER_MS; store `readByVersion` from `version()` (= `env.CF_VERSION_METADATA.id`, add `"version_metadata": {"binding": "CF_VERSION_METADATA"}` to both site wrangler configs) and treat a read by another version as stale; in `scripts/verify-dev.ts` `verifyRoadmap` GET `/api/roadmap.json` once before the loop and change the two messages to the tests' wording. Then unit suite, push, CI green by step, un-draft, squash-merge, `verify-roadmap` on the dev deploy.
- #1074 AC8 done (#759 AC4 amended, read back). Page half of #1074 waits on Shyden's wording (latest #1074 comment).
- #1081: two probes on the ticket; live heap peaks ~1.76 GB of ~2.04 GB limit, `.astro` not the cause. Next: heap snapshot at the peak.
- shytalk-34 asked for the roadmap build (Shyden ruled every roadmap copies Yawelo's); answered in full by message.
- All P0s wait on Shyden: #784, #425/#426/#1072 (behind #784), #860 and #1013 (next production release), #992–#1000 (playwright-devices#7).

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
