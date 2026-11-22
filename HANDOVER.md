# Handover: Yawelo Idle

**Written:** 2026-11-22 09:00 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (draft PR #1042), `yawelo-idle-1062` (PR #1064), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Background: two pr-verdict waiters (die with the session). Progress page source: `.superpowers/road-to-launch.html`.

## Latest (2026-11-22, 08:40 to 09:00 WIB, session `yawelo-idle-07`)

- **#52 / draft PR #1042:** 2b2ea9c4 failed 6 content-report harness tests: #1046's route limit (10 a minute per network) runs before the daily quota, and the harness keeps counts across tests. Fix 1708bb17: each test request has its own /24 (`cf-connecting-ip`), quota 429s assert `daily_limit`, new test for the route limit on reports (11th from one network: 429 `too_many_requests`, Retry-After, nothing stored). Then **mutation commit 63384748** (content-report limit 11) pushed to prove the new test red in CI. Unit 14,750 green.
- **#1062 / PR #1064:** playwright-devices 0.1.5 is on npm (shasum 6444564e…, checked on the registry; tarball holds `insideAnExpect`). Branch `1062-poll-counted-once` (worktree `../yawelo-idle-1062`), range `>=0.1.5`, unit 14,698 green, #1062 In Progress. playwright-devices-92 wants the per-browser shell.spec counts from the develop deploy after merge.
- Waiting on Shyden still: #784 old key delete after a green develop deploy, #830 part 2, next production release.

## Shyden's answers today (2026-11-21)

- **Tab icon: #10, twin sparkles on the night square** (from the 56-icon gallery, https://claude.ai/artifact/Cn5v3fC2xDvQJC2GX2szK5). In PR #1056: both `favicon.svg` swapped, pin test seen red first, unit 14,651 green; merged (see below).
- **Nameserver panel message:** ignore it. Nothing to do.
- **api.yaweloidle.com:** "Reserve the address now". PR #1058: assets-only Worker `yawelo-idle-sync` (apps/sync-worker/reserve), 404 "not open yet" en+id (Google read-back matched), noindex, robots disallow; deploy-prod stamps `commit.txt`, `scripts/verify-api.ts` checks it. First push failed two integration lists (script-loads, wrangler-steps dry-runs); fixed in 361123fa.
- **308 vs 301:** keep 308. #1013 AC2 rewritten and met.
- **#1013 AC4** measured in his Chrome: video plays on yaweloidle.com, test., dev-holding. (comment on #1013).
- **yawelo.com:** he signs in, I click. The connected Chrome is NOT the Yawelo login (shows ShyDesk / Shyden Labs Dev accounts). Asked him to open the Yawelo profile, connect Claude there, sign in to Yawelo's Cloudflare.
- **#343 AC2:** follows #635's answer; #343 now blocked by #635 (both P3).
- #1013 set In Progress (branch 1013-api-host).

## Since then

- **#1055 closed** with all four ACs evidenced (comments on #1055): PRs #1056, #1059 (holding page's own icon + CSP `img-src 'self'`), #1060 (`/favicon.ico`, 16/32/48 px; old-name guard reads `.ico` as media). Dev: `/favicon.svg`, `/play/favicon.svg`, `/favicon.ico` all 200, byte-checked. AC3 shell journey on all four browsers (run 44840564327). AC4: Shyden's own Chrome screenshot, plus an iPhone Air Safari tab-overview capture; both in `.superpowers/sdd/1055/` (ignored). Production gets the icon at the next release.
- **#1058 merged**: api.yaweloidle.com reserve, live at the next production release. #1013 is Todo (waits on that release and yawelo.com).
- #1054's board-orphans red is stale (ran while #1055 had no branch and was still open); it clears on that PR's next push.
- My slip: told Shyden the iPhone was "probably locked" when iphone-capture lost it; he said it never locked. Cause unknown; memory updated.

## This session (2026-11-21, 12:40 to 13:25 WIB)

- **#1003: PR #1054 merged** (squash 1c14d579) on playwright-devices 0.1.4. AC5(b) refused in run 44872497230 and AC5(a) in run 44785092678; AC1 to AC3 checked on develop (comment on #1003). playwright-devices#39 was closed by its own session on the AC5(b) run. Worktree and branches removed.
- **Develop is red; dev did not deploy.** Deploy run 44874197584 `test / browsers`: shell.spec's assertion counts were chromium 17, firefox 18, webkit 17, msedge 17. Cause, from Playwright 1.65.1's source: each `expect.poll` attempt is its own `expect` step, and the shared AssertionCounter counts them all. Filed **#1062 (P0, 2 points), blocked by playwright-devices#42**, which playwright-devices-ae is fixing (test first) and will send the version for. #1003 is blocked by #1062, its status is back to Todo, and AC4 is still open.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
2. PR #1042: `~/.claude/scripts/pr-verdict.sh 1042`. Expected on 63384748: build-and-test red on ONLY the new test "ten a minute from one network…" (11th answers 201). If so, `git revert --no-edit HEAD` in `../yawelo-idle-52`, unit, push; on green mark ready and squash-merge (message keeps the commit reasons, drop the mutation pair). If the other quota tests still fail, read the log first.
3. PR #1064: on green squash-merge into develop; read the develop deploy's `test / browsers` log for shell.spec counts on all four browsers and the `deploy` job; comment on #1062 (AC1, AC2) and #1003 (AC4), close both by hand; send the counts to playwright-devices-92; remove worktree `../yawelo-idle-1062` and branches.
4. #784: that green develop deploy proves the new DEV key; comment on #784, then delete the old key `cfat...c5dc` (Shyden's Yawelo Chrome).
5. Next production release (Shyden approves): tab icon + API reserve; deploy-prod's verify-api proves #1013 AC1.
6. #830 AC2 part 2: draft each player-facing story's Public title; ask Shyden.
