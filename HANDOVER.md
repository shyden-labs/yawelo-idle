# Handover: Yawelo Idle

**Written:** 2026-11-22 08:37 WIB (progress page v79), session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (draft PR #1042), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop 1c14d579). No Colima, simulator or USB claim. Nothing running in the background. Progress page source: `.superpowers/road-to-launch.html` (v79).

## Latest (2026-11-22, 07:10 to 07:40 WIB, session `yawelo-idle-07`)

- Every P0 to P2 ticket waits on something outside this session: #1062/#1003 on playwright-devices#42 (open, still 0.1.4); #1013 on the next production release; #784 on Shyden's narrower DEV key (`NONPROD_CLOUDFLARE_API_TOKEN` in `dev` still `updated_at` 2026-11-16T02:02:04Z); #830 on Shyden; #992/#993 on playwright-devices#7.
- **#713:** production measured (comment on #713): media.yaweloidle.com answers 206 with Content-Range for .mp4 and .webm, 416 out of range; CORP now `cross-origin` (needed for shyden.co.uk's embed after the domain move). Only AC5 left: phones on production (blocked by #992, #993, links added) and the shyden.co.uk#835 embed (already blocked by #713).
- **#52 / draft PR #1042:** its old red was stale (squash-only ruleset fixed 2026-11-19). Merged develop in (785cdd72); CI then failed 22 content-report Worker tests with 500 `not_configured` (#1046 requires RATE_KEY; that harness set none). Fixed in 2b2ea9c4 (harness passes RATE_KEY), unit 14,750 passed, pushed; CI running.
- **#830 AC2 part 1 done:** Shyden approved the 13 epics' Public title/summary; written to the board and read back (comment on #830). Next: part 2, each player-facing story's Public title, drafted for his approval.
- **#784:** the narrower key "GitHub Actions: DEV deploys" made in his Yawelo Chrome (Individual Workers Editor on the four -dev Workers, D1 Write account-wide), measured (4 dev Workers 200, holding-test 403), stored in `dev` (updated 2026-11-22T01:33:41Z). Proof = next green develop deploy; then delete the old key `cfat...c5dc`.
- **pd#42:** fixed in playwright-devices v0.1.5 (PR #43); npm publish run 44883276209 waits on Shyden's approval in the `npm` environment. playwright-devices-92 messages this repo when it's on npm.

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
2. #52 / PR #1042: read the CI verdict on 2b2ea9c4 (`~/.claude/scripts/pr-verdict.sh 1042`). If green, mark ready and squash-merge into develop (develop's own deploy is still red on #1062, so AC11's dev read-back waits on it). Left on #52 after that: AC2 item ids (M2 content), AC5 staff API + AC9 rate rule (need Shyden), AC6 (needs #174), AC11.
3. #1062: when playwright-devices-92 sends the release with #42's fix: branch `1062-poll-counted-once` from develop, `npm install @shyden-labs/playwright-devices@">=<ver>"` and restore the `>=` range (npm rewrites it as `^`), run unit, open a PR, merge on green, then read the develop deploy (browsers' assertion counts equal, deploy green) onto #1062 and #1003 (AC4), and close both by hand.
4. #784: key stored 2026-11-22; prove it with the next develop deploy (after #1062) and comment on #784.
5. Next production release (Shyden approves): carries the tab icon and the API reserve; deploy-prod's verify-api proves #1013 AC1's API host.
6. #830 AC2 part 2: draft each player-facing story's Public title (open and closed) in the epics' voice; ask Shyden.
