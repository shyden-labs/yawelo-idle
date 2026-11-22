# Handover: Yawelo Idle

**Written:** 2026-11-22 15:55 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Nothing running in the background. Progress page source: `.superpowers/road-to-launch.html` (v80).

## Latest (2026-11-22, to 15:55 WIB, session `yawelo-idle-07`)

- **Merged:** PR #1064 (2ba7cfac, playwright-devices 0.1.5), PR #1042 (b59e321e, content reports; #52 stays open, Todo). **Shut by hand with evidence:** #1062, #1003. Worktrees and branches for both removed.
- **#784:** the new DEV key is proven (comment). Left: delete the old key `cfat...c5dc` with Shyden (Yawelo Chrome).
- **#1066 (P0):** AC1 done (comment). All 26 epic-edit deliveries were sent and answered 202, so no webhook was missed. The Worker's accounting counted drift during a burst a second apart. Refuted: text edits not moving `updatedAt`. Next: the stale-fields experiment, then a failing `account()` test.
- **#1067 (P0, 1 point):** the org webhook must move off `dev.yawelo-idle.shyden.co.uk`.
- **#830 / #1068:** Shyden redesigned the public roadmap (all in the #830 comment). The 160 story titles were dropped. The design is one voyage map of the **9 build stages in order**, each island done / under way / not started from its own stories' closed share. The final look is round 6, map 3 (gallery https://claude.ai/artifact/CmgQ6copqWUPo59hK2hktK, source `.superpowers/sdd/830/island-designs-round6.html`, picks in its DB). The page keeps only the map, one progress bar and an expected season. **#1068 filed (P1, 8 points)** for the build. #830 keeps AC1 (simpler page text) and AC3.
- Progress page v80 published 15:55 WIB.

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
2. #1066 (P0): the experiment (two text fields on one card a second apart; read `updatedAt` against the field values repeatedly), then a failing `account()` test, then the fix.
3. #1067 (P0): GitHub's docs on webhook redirects; change the payload URL with Shyden in Chrome; read it back; check a delivery.
4. #1068 (P1): spec and plan (reviewed to zero), then TDD. First, ask Shyden to approve which player features each island lists (`.superpowers/sdd/830/features.tsv`, regrouped by stage).
5. #784: delete the old key with Shyden. Next production release (Shyden approves): the tab icon and the API reserve (#1013 AC1).
