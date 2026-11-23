# Handover: Yawelo Idle

**Written:** 2026-11-23 13:45 WIB, session `yawelo-idle-f6`. Branch `handover/2026-10-17-d`. develop at d43bcbdc. Worktrees: `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at d43bcbdc). No Colima, simulator or USB claim.

## Now

- **#1074 (P1, In Progress), PR #1088 (draft), branch `1074-roadmap-reads-on-visit`, worktree `../yawelo-idle-1074`, head `34307611`.**
  - `34307611` = verify-dev code (visit `/api/roadmap.json` once before the loop; new messages). The 7 verify-dev tests went red on CI run 45090579781 and pass locally now; unit 14962 passed, typecheck 0 errors.
  - The two harness tests (`84015679` hold, `f521b99f` version, in `apps/site/test/roadmap/roadmap.test.ts`) have NOT yet been seen red: the Worker-tests step was skipped on the earlier run. CI on `34307611` should get past unit and show exactly those two red by name. Read that run first.
  - Then the Worker code: `python3 .superpowers/sdd/1074-patch.py ../yawelo-idle-1074` (written, not yet applied: `readByVersion` state, `version()` = `env.CF_VERSION_METADATA.id`, visit skips when a good read by this version is under 10 min old or a read failed under 10 min ago, `version_metadata` in both site wrangler configs, cron comments fixed). Then regenerate worker types (`npx wrangler types` in apps/site, per the memory), typecheck, unit, push, CI green by step, un-draft, squash-merge, `verify-roadmap` on the dev deploy.
- **#1081 (P2, In Progress), PR #1089, branch `1081-lint-in-groups`, worktree `../yawelo-idle-1081`, head `7a6f0ed3`:** script-loads now lists `scripts/lint.ts` (the only failure on run 45089610552); unit 14966 passed locally. CI was queued at 13:45. Merge when green by step. AC3 (3 runs under load >100) still owed.
- #1074 AC8 done. **Page half ruled by Shyden 2026-11-23 (two latest #1074 comments; now a GLOBAL rule in ~/.claude/CLAUDE.md and reference-live-roadmap.md):** show the latest snapshot at once, swap the fresh one in live, one line "Last updated {date}, {time} {zone}" (visitor's local zone, named); no updating state, no failure message, no dimming (AC5 withdrawn). Next for the page: tests first (component + e2e), Indonesian with Google read-back, then code.
- #1090 filed (P2, 2 pts): no email address or mailto: on any web page, test over the built site (Shyden's ruling relayed by shytalk-34; none found in source today).
- shytalk-34 got the full roadmap build description (Shyden: every roadmap copies Yawelo's).
- All P0s wait on Shyden: #784, #425/#426/#1072, #860 and #1013 (next production release), #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #830 AC1: approve the roadmap page's new short text (latest #830 comment).
2. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket`.
3. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
4. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
2. #1081: read PR #1089's CI on `7a6f0ed3` by step (`pr-verdict.sh` returned at "queued" twice; use `gh run list --branch 1081-lint-in-groups`); squash-merge when green; clean the worktree and branches.
3. #1074: read CI on `34307611`: the two harness tests red by name, nothing else; then apply the patch per Now, and carry on as written there.
4. Act on Shyden's answers above.
