# Handover: Yawelo Idle

**Written:** 2026-11-22 13:10 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Nothing running in the background. Progress page source: `.superpowers/road-to-launch.html`.

## Latest (2026-11-22, to 13:10 WIB, session `yawelo-idle-07`)

- **Merged:** PR #1064 (2ba7cfac, playwright-devices 0.1.5) and PR #1042 (b59e321e, content reports; #52 stays open, back to Todo). Worktrees and branches removed. **Shut by hand with evidence:** #1062, #1003. playwright-devices#42 was shut on our measurement.
- **#784:** the new DEV key is proven by develop deploy run 44979998936 (comment). Left: delete the old key `cfat...c5dc` (Shyden's Yawelo Chrome).
- **#1066 (P0):** AC1 done (comment, copy in `.superpowers/sdd/1066/`). All 26 epic-edit deliveries were sent and answered 202, so no webhook was missed. The Worker's accounting counted drift during a burst of edits a second apart. Refuted: text edits not moving the card's `updatedAt`. Next: the stale-fields experiment, then a failing `account()` test.
- **#1067 filed (P0, 1 point):** the org webhook still calls `dev.yawelo-idle.shyden.co.uk`; it must move to the new dev host before the old one only redirects.
- **#830 roadmap redesign:** Shyden picked **option 2, the island map**, with real island graphics. He wants at least 50 designs to mix and match: gallery https://claude.ai/artifact/CmgQ6copqWUPo59hK2hktK (source `.superpowers/sdd/830/island-designs.html`). The 13 features in players' words are in `.superpowers/sdd/830/features.tsv`, and the three shapes in `three-shapes.html`. Bar + "Expected: early 2027" + no ticket numbers, points or behind-the-scenes text, all agreed. Round 1 pick: design 1 (DB `picks/round1`). Round 2 picks: 2, 6, 7, 17, 19, 24 (DB `picks/round2`). Round 3 (20 navy-night combos, source `island-designs-round3.html`, DB `picks/round3`) is waiting on his picks.

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
2. #830: read Shyden's pick from the 50-island gallery; iterate until he settles. Then a plan: a feature grouping on the board (field or shared Public title), the page rebuilt as the map + bar + expected season, tests first, dev for his look, then translation (id) with Google read-back.
3. #1066: run the experiment (two text fields on one card a second apart; read updatedAt against the field values repeatedly), then a failing `account()` test, then the fix.
4. #1067: GitHub docs on redirects for webhooks; change the payload URL in Shyden's Chrome; read it back.
5. #784: delete the old key with Shyden. Next production release: tab icon and API reserve (#1013 AC1).
