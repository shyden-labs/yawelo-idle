# Handover: Yawelo Idle

**Written:** 2026-11-17 21:00 WIB for session `yawelo-idle-63`. Colima, simulators and USB phones were not claimed (the phones are plugged in, but Yawelo has no device run allowed until playwright-devices#7, #16, #17 land). No background subagent; nothing is waiting. Road to Launch page republished at this close-out.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## The rule that leads (Shyden, 2026-11-17)

`~/.claude/global-rules/same-tests-on-every-device-before-device-runs.md`: open `unified-tests` tickets first; no device run except one that measures them. shyden-labs/playwright-devices is now the shared package for phones AND desktop browsers. Yawelo keeps #996's check as is, not extended; switch-over is #1003.

Totals: desktop chromium 17, firefox 17, webkit 17 (develop deploy run 43992705377); real phones and tablets 0.

## Done this session

- **#784: old DEV deleted from Shyden Labs Dev** (Shyden, 2026-11-17: "Delete without a backup"): Workers site-dev, holding-dev, web-dev, sync-dev and D1 `yawelo-idle-dev`, with evidence on the ticket (comment 6950140035). Only the `yawelo-idle-dev-hosts` Pages project stays there, until the PROD move's doors go live. #784 stays open for TEST, PROD (Shyden's approval) and the doors.
- **#1004, #1006, #1007 closed** with their evidence quoted. SonarCloud on develop `8f93f962` (run 44032624363): 0 bugs, 0 vulnerabilities, gate OK. The first gate read `NONE` only because there was no earlier analysis; `sonar-verdict.ts` is unchanged. `sonar-project.properties` marks S6505 (allowScripts proven) and S4036 (Shyden's choice) with their reasons.
- **#1010 filed** (P3, 5 pts): triage the 114 Sonar code smells, starting with 16 S2699 (tests with no assertion).

## In flight

- **#160 (backups), draft PR 986**, worktree `../yawelo-idle-160`, head `35dd4007`. AC3's notice is done (`SaveNotice.svelte`, `saved-ago.ts`, four `save.*` keys with review, licence and `docs/translations/2026-11-17-save-notice-id.md`). CI fixes: the Svelte-gates list (`266ed61`), and the first-paint tripwire in `apps/web/test/bundle.test.ts` raised 15,000 → 16,000 (Shyden, 2026-11-17: develop 14,924, branch 15,164, measured). CI on `35dd4007` green on every required check (board-orphans, build-and-test, coverage, sonar-coverage, sonarcloud); the PR is behind develop by #1004, #1006 and #1007 and stays a draft. Nothing mounts the notice yet: `/play/` is still the coming-soon shell. What is left (AC6 real IndexedDB on every target, the journey) waits on #992/#993.
- **#1003** browser switch-over (P0, 3 pts): blocked by playwright-devices#16 and #17 (linked, read back). **#992/#993** blocked by playwright-devices#7 and #16. #997 to #1000 wait on them.
- **#783 and #757** (P0, board-next's top) wait on the next release cut (Shyden, 2026-11-05); nothing to do before then.
- **#971** (1 s unit timeouts under load): two more occurrences logged today, at load 160 and 73 with swap ~5.3 GB; each passed alone and on a full re-run.

## Resume steps

1. #160: nothing to do until #992/#993; update the branch from develop when work resumes.
2. Follow playwright-devices#7, #16, #17; when they land, start #992, #993, #1003.
3. #784's remaining ACs (TEST environment in the non-PROD account; PROD move needs Shyden's approval), then #127, #163.
