# Handover: Yawelo Idle

**Written:** 2026-11-22 10:45 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (draft PR #1042), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Nothing running in the background. Progress page source: `.superpowers/road-to-launch.html`.

## Latest (2026-11-22, to 10:45 WIB, session `yawelo-idle-07`)

- **#1062 and #1003 closed** (comments with evidence): PR #1064 (squash 2ba7cfac) took playwright-devices 0.1.5. Develop deploy run 44979998936: `test / browsers` green, one-suite totals equal on all four browsers; `deploy` green. playwright-devices#42 was closed on this measurement.
- **#784:** the new DEV key is proven by the same run (every NONPROD step passed; comment on #784). Left: delete the old key `cfat...c5dc` in Yawelo's Cloudflare (Shyden's Yawelo Chrome).
- **#1066 filed (P0, 3 points, under #331):** that run's `verify-roadmap` went red with drift 2 at 01:30:38Z, just after the 13 epic Public title/summary writes. The cause is not yet measured. Org webhook 698318626's deliveries are kept until about 2026-11-25 and need Shyden's passkey (sudo) in Chrome. The tab is open at the deliveries page.
- **#52 / PR #1042:** fixed the content-report harness (each request from its own /24, quota 429s assert `daily_limit`, new route-limit test). Mutation 63384748 made only the new test fail (run 44973265398); reverted in fcfaf451 (tree = 1708bb17). CI green on fcfaf451 (build-and-test run 44979975357).
- **#830 roadmap redesign (Shyden, today):** the 160 story names were "way too much noise… too technical". He asked for features only, players' words, no "behind the scenes" mention, AND a simpler version of the rest of the page (progress bar, plain "expected around" line, recent things built; no points or ticket counts). The 42-feature draft (`.superpowers/sdd/830/groups.tsv`, page https://claude.ai/artifact/4J2uh8qm1TMURUnggAAzgq) is still too many: consolidate further, draft the whole page, ask before building.

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

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
2. #1066 (P0): once Shyden passes the passkey, read deliveries 01:15 to 01:35 UTC on org hook 698318626 (load every page, JS loop on "Load more deliveries"), with `/api/roadmap/health`; record them on #1066 and name the cause. Deadline about 2026-11-25.
3. PR #1042: mark ready, squash-merge on green head fcfaf451 (`--match-head-commit` from a file; the message keeps the commit reasons, without the mutation pair). Left on #52: AC2, AC5/AC9 (Shyden), AC6 (#174), AC11.
4. #830: draft the consolidated, player-facing roadmap (about 10 to 15 features in all, plus the simpler progress, ETA and recent sections); show it to Shyden as a page and ask.
5. #784: delete the old key `cfat...c5dc` with Shyden (Yawelo Chrome).
6. Next production release (Shyden approves): the tab icon and the API reserve; verify-api proves #1013 AC1.
