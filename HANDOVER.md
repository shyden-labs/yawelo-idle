# Handover: Yawelo Idle

**Written:** 2026-11-17 10:50 WIB for session `yawelo-idle-d1`. Colima, simulators and USB phones were not claimed. No background subagent; nothing is waiting. Clean-up pass done today (ledger recorded). Road to Launch page republished 10:50 WIB (version 58).

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## The rule that leads (Shyden, 2026-11-17)

`~/.claude/global-rules/same-tests-on-every-device-before-device-runs.md`: open `unified-tests` tickets first; no device run except one that measures them. shyden-labs/playwright-devices is now the shared package for phones AND desktop browsers. Yawelo keeps #996's check as is, not extended; switch-over is #1003.

Totals: desktop chromium 17, firefox 17, webkit 17 (develop deploy run 43992705377); real phones and tablets 0.

## In flight

- **#1004 SonarCloud scans develop** (Shyden approved the extra CI): PR 1005 merged as `a1fa1f85`, worktree and branches removed, ticket back to Todo. AC2 met and quoted on the ticket (1 analysis, ncloc 20402, coverage 85.4). But the develop run 44005792164 is red: `qualitygates/project_status?projectKey=shyden-labs_yawelo-idle&branch=develop` is `NONE` with no conditions on this first analysis, and `scripts/sonar-verdict.ts` fails anything but OK. At the next push to develop, read that gate again: if still NONE, fix the verdict step under #1004 (test first); then check AC3 (the next PR's sonarcloud check) and close by hand.
- **#160 (backups), draft PR 986**, worktree `../yawelo-idle-160`, head `35dd4007`. AC3's notice is done (`SaveNotice.svelte`, `saved-ago.ts`, four `save.*` keys with review, licence and `docs/translations/2026-11-17-save-notice-id.md`). CI fixes: the Svelte-gates list (`266ed61`), and the first-paint tripwire in `apps/web/test/bundle.test.ts` raised 15,000 → 16,000 (Shyden, 2026-11-17: develop 14,924, branch 15,164, measured). CI on `35dd4007` green on every required check (board-orphans, build-and-test, coverage, sonar-coverage, sonarcloud); the PR is behind develop by #1004 only and stays a draft. Nothing mounts the notice yet: `/play/` is still the coming-soon shell. What is left (AC6 real IndexedDB on every target, the journey) waits on #992/#993.
- **#1003** browser switch-over (P0, 3 pts): blocked by playwright-devices#16 and #17 (linked, read back). **#992/#993** blocked by playwright-devices#7 and #16. #997 to #1000 wait on them.
- **#783 and #757** (P0, board-next's top) wait on the next release cut (Shyden, 2026-11-05); nothing to do before then.
- **#971** (1 s unit timeouts under load): two more occurrences logged today, at load 160 and 73 with swap ~5.3 GB; each passed alone and on a full re-run.

## Resume steps

1. #160: nothing to do until #992/#993; update the branch from develop when work resumes.
2. At the next develop push, read develop's Sonar gate and finish #1004 as above.
3. Follow playwright-devices#7, #16, #17; when they land, start #992, #993, #1003.
4. Later: #784 (ask Shyden about deleting the old Yawelo resources in Shyden Labs Dev), #127, #163.
